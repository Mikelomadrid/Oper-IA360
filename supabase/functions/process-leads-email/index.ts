import { createClient } from "npm:@supabase/supabase-js@2";
import { ImapFlow } from "npm:imapflow@2.9.1";
import { simpleParser } from "npm:mailparser@3.12.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-worker-secret",
};

type Mode = "archive_historical" | "activate" | "process_new";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

function clean(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function first(text: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return clean(match[1]);
  }
  return "";
}

function sourceFor(subject: string, from: string, text: string) {
  const value = `${subject} ${from} ${text}`.toLowerCase();
  if (/oyrsa|maestro\s*fontanero|maestrofontanero/.test(value)) return "Maestro Fontanero";
  if (/orkaled|solicitud de presupuesto web/.test(value)) return "Web";
  return null;
}

function parseLead(subject: string, from: string, text: string) {
  const source = sourceFor(subject, from, text);
  const reply = /^\s*(re|rv|fwd|fw)\s*:/i.test(subject);
  const spam = /seo|backlink|guest post|casino|crypto|viagra|website design|dear webmaster/i.test(text);
  const email = first(text, [
    /(?:correo|email|e-?mail|déjanos tu mejor email)\s*:\s*([^\s,;<>]+@[^\s,;<>]+)/i,
    /<([^\s<>]+@[^\s<>]+)>/i,
  ]).toLowerCase();
  const phone = first(text, [
    /(?:teléfono(?: de contacto)?|telefono(?: de contacto)?|móvil|movil|phone)\s*:\s*([^\n\r]+)/i,
  ]).replace(/[^\d+]/g, "");
  const name = first(text, [
    /(?:^|\n)\s*nombre\s*:\s*([^\n\r]+)/i,
    /(?:^|\n)\s*name\s*:\s*([^\n\r]+)/i,
  ]);
  const company = first(text, [/(?:empresa|company)\s*:\s*([^\n\r]+)/i]);
  const message = first(text, [
    /(?:cuerpo del mensaje|en que podemos ayudarte|mensaje|message)\s*:\s*([\s\S]+)/i,
  ]);
  const phoneOk = /^(?:\+34|0034)?\d{9}$/.test(phone);
  const ready = Boolean(source && !reply && !spam && name && phoneOk);
  return {
    source,
    reply,
    spam,
    name,
    company,
    email: email || null,
    phone: phone || null,
    message: message || text.slice(0, 8000),
    ready,
    reason: !source ? "origen_no_identificado" : reply ? "respuesta" : spam ? "spam" : !name ? "sin_nombre" : !phoneOk ? "telefono_revision" : null,
  };
}

function attachmentIsRelevant(filename: string, contentType: string) {
  const name = filename.toLowerCase();
  if (/firma|signature|logo|disclaimer|social|^image001\.(gif|png|jpg|jpeg)$/.test(name)) return false;
  return Boolean(contentType && !contentType.startsWith("text/"));
}

async function main(req: Request) {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const secret = Deno.env.get("LEADS_EMAIL_WORKER_SECRET");
  if (!secret || req.headers.get("x-worker-secret") !== secret) return json({ error: "unauthorized" }, 401);

  const body = await req.json().catch(() => ({}));
  const mode = (body.mode || "process_new") as Mode;
  if (!["archive_historical", "activate", "process_new"].includes(mode)) return json({ error: "invalid_mode" }, 400);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const imapPassword = Deno.env.get("LEADS_IMAP_PASSWORD");
  if (!supabaseUrl || !serviceKey || !imapPassword) return json({ error: "missing_server_secrets" }, 500);
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const mailbox = Deno.env.get("LEADS_IMAP_MAILBOX") || "miguel@orkaled.com";
  const folder = Deno.env.get("LEADS_IMAP_FOLDER") || "LEADS WEB";
  const client = new ImapFlow({
    host: Deno.env.get("LEADS_IMAP_HOST") || "imap.hostinger.es",
    port: Number(Deno.env.get("LEADS_IMAP_PORT") || 993),
    secure: true,
    auth: { user: Deno.env.get("LEADS_IMAP_USER") || mailbox, pass: imapPassword },
    logger: false,
  });
  await client.connect();
  const opened = await client.mailboxOpen(folder, { readOnly: true });
  const result = { mode, archived: 0, created: 0, review: 0, spam: 0, skipped: 0, attachments: 0 };

  if (mode === "activate") {
    const lastUid = Math.max(0, Number(opened.uidNext || 1) - 1);
    const { error } = await admin.from("lead_email_ingestion_checkpoints").upsert({ mailbox, folder, activated_at: new Date().toISOString(), last_uid: lastUid, mode: "active", updated_at: new Date().toISOString() });
    if (error) throw error;
    await client.logout();
    return json({ ...result, activated_at_uid: lastUid });
  }

  let uidRange: string | undefined;
  if (mode === "archive_historical") uidRange = "1:*";
  else {
    const { data: checkpoint, error } = await admin.from("lead_email_ingestion_checkpoints").select("last_uid, mode").eq("mailbox", mailbox).eq("folder", folder).maybeSingle();
    if (error) throw error;
    if (!checkpoint || checkpoint.mode !== "active") return json({ error: "not_activated", hint: "Ejecuta activate antes de process_new." }, 409);
    uidRange = `${Number(checkpoint.last_uid || 0) + 1}:*`;
  }

  const uids = await client.search({ uid: uidRange }, { uid: true });
  for await (const message of client.fetch(uids, { uid: true, envelope: true, source: true }, { uid: true })) {
    const sourceBytes = message.source ? new Uint8Array(message.source) : new Uint8Array();
    const parsed = await simpleParser(sourceBytes);
    const subject = clean(parsed.subject || message.envelope?.subject);
    const from = clean(parsed.from?.text || message.envelope?.from?.[0]?.address);
    const text = clean(parsed.text || parsed.html || "");
    const lead = parseLead(subject, from, text);
    const status = mode === "archive_historical" ? "historico_no_importar" : lead.spam ? "spam" : lead.ready ? "pendiente" : "revision";
    const { data: archive, error: archiveError } = await admin.from("lead_email_archive").upsert({ mailbox, folder, imap_uid: message.uid, message_id: parsed.messageId || null, subject, from_address: from, received_at: parsed.date?.toISOString() || null, source: lead.source, status, parsed_data: lead, raw_email_bucket: "lead-email-archive", raw_email_path: `${mailbox}/${folder}/${message.uid}.eml` }, { onConflict: "mailbox,folder,imap_uid" }).select("id").single();
    if (archiveError) throw archiveError;
    result.archived++;
    if (status === "spam") result.spam++;
    else if (status === "revision") result.review++;
    if (mode === "archive_historical") continue;
    if (!lead.ready) { result.skipped++; continue; }

    const rawPath = `${mailbox}/${folder}/${message.uid}.eml`;
    await admin.storage.from("lead-email-archive").upload(rawPath, sourceBytes, { contentType: "message/rfc822", upsert: true });
    for (const attachment of parsed.attachments || []) {
      const filename = attachment.filename || "adjunto";
      if (!attachmentIsRelevant(filename, attachment.contentType || "")) continue;
      const path = `${mailbox}/${folder}/${message.uid}/${filename}`;
      const upload = await admin.storage.from("lead-email-archive").upload(path, attachment.content, { contentType: attachment.contentType || "application/octet-stream", upsert: true });
      if (upload.error) throw upload.error;
      const { error } = await admin.from("lead_email_archive_attachments").upsert({ archive_id: archive.id, bucket: "lead-email-archive", path, filename, mime: attachment.contentType, size_bytes: attachment.size || attachment.content.length, attachment_type: attachment.contentType?.startsWith("image/") ? "foto" : "doc" }, { onConflict: "bucket,path" });
      if (error) throw error;
      result.attachments++;
    }

    const owner = Deno.env.get("LEADS_DEFAULT_OWNER_USER_ID");
    if (!owner) { await admin.from("lead_email_archive").update({ status: "revision" }).eq("id", archive.id); result.review++; continue; }
    const { data: existing } = await admin.from("leads").select("id").or(`email.ilike.${lead.email || "__none__"},telefono.eq.${lead.phone}`).limit(1);
    if (existing?.length) { await admin.from("lead_email_archive").update({ status: "procesado" }).eq("id", archive.id); result.skipped++; continue; }
    const { data: created, error: leadError } = await admin.from("leads").insert({ nombre_contacto: lead.name, nombre_empresa: lead.company || null, telefono: lead.phone, email: lead.email, comentario: lead.message, estado: "nuevo", origen: lead.source, owner_user_id: owner, created_by: owner, created_by_name: "Email LEADS WEB", created_by_role: "admin" }).select("id").single();
    if (leadError) throw leadError;
    await admin.from("lead_email_archive").update({ status: "procesado", parsed_data: { ...lead, lead_id: created.id } }).eq("id", archive.id);
    result.created++;
  }
  await client.logout();
  return json(result);
}

Deno.serve((req) => main(req).catch((error) => json({ error: error?.message || String(error) }, 500)));
