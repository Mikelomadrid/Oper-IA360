"""Analiza facturas emitidas 2025-2026 sin modificar los originales."""
import argparse,csv,hashlib,json,re,unicodedata
from collections import Counter,defaultdict
from dataclasses import asdict,dataclass
from pathlib import Path
from pypdf import PdfReader

INVOICE_RE=re.compile(r"(?:N.mero\s+de\s+factura|Numero\s+de\s+factura)\s*:\s*([^\s]+)",re.I)
DATE_RE=re.compile(r"Fecha\s*:\s*(\d{2}/\d{2}/\d{4})",re.I)
LINE_DATE_RE=re.compile(r"^\s*\d{1,2}/\d{1,2}/\d{2,4}\s*$")
CATEGORIES={
 "Electricidad e iluminación":("electric","lumin","led","bombilla","downlight","fluorescen","enchufe","interruptor","cuadro","diferencial","magnetoterm","cable","reloj de encendido","sensor","portero","telefonillo","antena"),
 "Fontanería y saneamiento":("fontaner","tuber","desag","sumider","sifon","grifo","cisterna","inodoro","lavabo","ducha","fuga","llave de paso","bajante","canalon","agua"),
 "Albañilería":("alban","ladrillo","mortero","cemento","solado","alicat","azulejo","baldosa","enfosc","tabique","murete","roza","yeso","escayola","remate"),
 "Pintura":("pint","barniz","esmalte","imprimacion","gotele"),
 "Pladur y falsos techos":("pladur","placa de yeso","falso techo","techo registrable"),
 "Carpintería y cerrajería":("carpinter","cerrajer","puerta","cerradura","bisagra","ventana","persiana","barandilla","reja","aluminio","armario","mueble","cristal","vidrio"),
 "Climatización y calefacción":("climat","aire acondicionado","caldera","radiador","termostato","calefaccion","ventilacion","extractor"),
 "Cubiertas e impermeabilización":("impermeabil","cubierta","tejado","teja","tela asfalt","filtracion","humedad","sellado","silicona"),
 "Limpieza y desescombro":("limpieza","limpiar","desescombro","escombro","contenedor"),
 "Mantenimiento y reparación":("mantenimiento","repar","averia","revision","visita","sustitu","cambio de","mano de obra"),
 "Anticipos, certificaciones y abonos":("adelanto","pago a cuenta","cantidad acordada","arranque de obra","factura final","devolucion","abono"),
 "Servicios por horas y partes":("trabajo por horas","trabajos realizados en parte"),
 "Gestión, tasas e informes":("tramitacion","impuestos","tasas","inspeccion","informe","proyecto","pedido"),
 "Equipamiento y suministros":("electrodomest","fregadero","fitpanel","junquillo"),
}

@dataclass
class InvoiceWork:
 year:int; invoice_number:str; invoice_date:str; source_file:str
 work_description:str; categories:str; text_hash:str

def fold(value):
 value=unicodedata.normalize("NFKD",value.replace("�",""))
 return "".join(c for c in value if not unicodedata.combining(c)).lower()

def clean_description(text):
 m=re.search(r"Concepto\s+Uds\.\s+Base Ud\..*?% IVA\s+IVA",text,re.I)
 if not m:return ""
 section=re.split(r"\nBase Imponible\b",text[m.end():],maxsplit=1,flags=re.I)[0]
 kept=[]
 for raw in section.splitlines():
  line=" ".join(raw.strip().split())
  if not line or LINE_DATE_RE.match(line) or re.fullmatch(r"[-\d.,% €]+",line):continue
  if re.match(r"^\d+(?:[.,]\d+)?\s+[-\d.,]+.*\d{1,2}%\s+[-\d.,]+",line):continue
  kept.append(line)
 return re.sub(r"\s+"," "," ".join(kept)).strip(" -;,")

def classify(desc):
 f=fold(desc); found=[n for n,terms in CATEGORIES.items() if any(fold(t) in f for t in terms)]
 return found or ["Otros trabajos"]

def extract(path,root):
 try:text="\n".join(p.extract_text() or "" for p in PdfReader(str(path)).pages)
 except Exception as exc:return InvoiceWork(0,"ERROR_LECTURA","",str(path.relative_to(root)),str(exc),"Error","")
 m=INVOICE_RE.search(text)
 if not m:return None
 number=m.group(1).strip(); ym=re.search(r"(20\d{2})",number)
 if not ym or int(ym.group(1)) not in (2025,2026):return None
 dm=DATE_RE.search(text); desc=clean_description(text)
 return InvoiceWork(int(ym.group(1)),number,dm.group(1) if dm else "",str(path.relative_to(root)),desc," | ".join(classify(desc)),hashlib.sha256(text.encode(errors="replace")).hexdigest()[:16])

def main():
 ap=argparse.ArgumentParser();ap.add_argument("--source",required=True,type=Path);ap.add_argument("--output",required=True,type=Path);a=ap.parse_args()
 a.output.mkdir(parents=True,exist_ok=True)
 files=sorted(p for y in ("2025","2026") for p in (a.source/y).rglob("*.pdf") if "VENTAS" in {x.upper() for x in p.parts} and p.name.lower().startswith("factura_"))
 rows=[x for p in files if (x:=extract(p,a.source))]
 grouped=defaultdict(list)
 for x in rows:grouped[x.invoice_number].append(x)
 dup={n:r for n,r in grouped.items() if len(r)>1}
 exact_dup={n:r for n,r in dup.items() if len({x.work_description for x in r})==1}
 conflict_dup={n:r for n,r in dup.items() if len({x.work_description for x in r})>1}
 unique=[max(r,key=lambda x:len(x.work_description)) for r in grouped.values()]
 unique.sort(key=lambda x:(x.year,x.invoice_date,x.invoice_number))
 fields=list(asdict(unique[0])) if unique else ["year"]
 with (a.output/"trabajos_facturados_2025_2026.csv").open("w",encoding="utf-8-sig",newline="") as h:
  w=csv.DictWriter(h,fieldnames=fields);w.writeheader();w.writerows(asdict(x) for x in unique)
 (a.output/"trabajos_facturados_2025_2026.json").write_text(json.dumps([asdict(x) for x in unique],ensure_ascii=False,indent=2),encoding="utf-8")
 all_fields=fields+["duplicate_status"]
 with (a.output/"documentos_facturas_2025_2026.csv").open("w",encoding="utf-8-sig",newline="") as h:
  w=csv.DictWriter(h,fieldnames=all_fields);w.writeheader()
  for x in rows:
   status="conflicto_numero" if x.invoice_number in conflict_dup else ("copia_repetida" if x.invoice_number in exact_dup else "unico")
   w.writerow({**asdict(x),"duplicate_status":status})
 cats=Counter(); years=Counter(x.year for x in unique)
 for x in unique:cats.update(x.categories.split(" | "))
 summary=["# Análisis de trabajos facturados 2025-2026","",
  "Lectura de las carpetas `VENTAS`; los originales no se han modificado.","",
  "## Cobertura","",f"- PDFs candidatos: {len(files)}",
  f"- Facturas únicas: {len(unique)}",f"- 2025: {years[2025]}",
  f"- 2026: {years[2026]}",f"- Números duplicados: {len(dup)}",
  f"- Copias repetidas: {len(exact_dup)}",f"- Conflictos reales de numeración: {len(conflict_dup)}",
  f"- Sin descripción: {sum(not x.work_description for x in unique)}","",
  "## Familias detectadas","","| Familia | Facturas |","|---|---:|"]
 summary += [f"| {n} | {c} |" for n,c in cats.most_common()]
 summary += ["","## Duplicados",""]+[f"- [{'CONFLICTO' if n in conflict_dup else 'COPIA'}] {n}: "+"; ".join(x.source_file for x in r) for n,r in sorted(dup.items())]
 (a.output/"resumen_trabajos_facturados_2025_2026.md").write_text("\n".join(summary)+"\n",encoding="utf-8")
 print(json.dumps({"candidates":len(files),"unique":len(unique),
  "by_year":dict(years),"duplicates":len(dup),"exact_duplicates":len(exact_dup),
  "number_conflicts":len(conflict_dup),
  "empty":sum(not x.work_description for x in unique),
  "categories":cats.most_common(),"output":str(a.output)},ensure_ascii=False,indent=2))

if __name__=="__main__":main()
