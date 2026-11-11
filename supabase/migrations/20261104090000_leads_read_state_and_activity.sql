-- Lectura de leads por usuario y actividad unificada para avisos de técnicos.
CREATE TABLE IF NOT EXISTS public.lead_lecturas (
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  usuario_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  visto_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (lead_id, usuario_id)
);

CREATE INDEX IF NOT EXISTS lead_lecturas_usuario_idx
  ON public.lead_lecturas (usuario_id, lead_id);

ALTER TABLE public.lead_lecturas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS lead_lecturas_select_own ON public.lead_lecturas;
CREATE POLICY lead_lecturas_select_own ON public.lead_lecturas
  FOR SELECT USING (usuario_id = auth.uid());

DROP POLICY IF EXISTS lead_lecturas_insert_own ON public.lead_lecturas;
CREATE POLICY lead_lecturas_insert_own ON public.lead_lecturas
  FOR INSERT WITH CHECK (usuario_id = auth.uid());

DROP POLICY IF EXISTS lead_lecturas_update_own ON public.lead_lecturas;
CREATE POLICY lead_lecturas_update_own ON public.lead_lecturas
  FOR UPDATE USING (usuario_id = auth.uid())
  WITH CHECK (usuario_id = auth.uid());

-- Conserva el comportamiento anterior para los usuarios ya asignados.
INSERT INTO public.lead_lecturas (lead_id, usuario_id, visto_at)
SELECT DISTINCT l.id, u.usuario_id, l.visto_primera_vez_at
FROM public.leads l
JOIN (
  SELECT lead_id, usuario_id FROM public.leads_asignaciones
  UNION
  SELECT id AS lead_id, owner_user_id AS usuario_id FROM public.leads WHERE owner_user_id IS NOT NULL
  UNION
  SELECT id AS lead_id, created_by AS usuario_id FROM public.leads WHERE created_by IS NOT NULL
) u ON u.lead_id = l.id
WHERE l.visto_primera_vez_at IS NOT NULL
ON CONFLICT (lead_id, usuario_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.touch_lead_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_lead_id uuid := COALESCE(NEW.lead_id, OLD.lead_id);
BEGIN
  UPDATE public.leads
  SET updated_at = now()
  WHERE id = v_lead_id;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_lead_comentarios_touch_activity ON public.lead_comentarios;
CREATE TRIGGER trg_lead_comentarios_touch_activity
AFTER INSERT OR UPDATE OR DELETE ON public.lead_comentarios
FOR EACH ROW EXECUTE FUNCTION public.touch_lead_activity();

DROP TRIGGER IF EXISTS trg_lead_fotos_touch_activity ON public.lead_fotos;
CREATE TRIGGER trg_lead_fotos_touch_activity
AFTER INSERT OR UPDATE OR DELETE ON public.lead_fotos
FOR EACH ROW EXECUTE FUNCTION public.touch_lead_activity();

DROP TRIGGER IF EXISTS trg_lead_adjuntos_touch_activity ON public.lead_adjuntos;
CREATE TRIGGER trg_lead_adjuntos_touch_activity
AFTER INSERT OR UPDATE OR DELETE ON public.lead_adjuntos
FOR EACH ROW EXECUTE FUNCTION public.touch_lead_activity();

DROP TRIGGER IF EXISTS trg_lead_fotos_carpetas_touch_activity ON public.lead_fotos_carpetas;
CREATE TRIGGER trg_lead_fotos_carpetas_touch_activity
AFTER INSERT OR UPDATE OR DELETE ON public.lead_fotos_carpetas
FOR EACH ROW EXECUTE FUNCTION public.touch_lead_activity();

DROP TRIGGER IF EXISTS trg_leads_asignaciones_touch_activity ON public.leads_asignaciones;
CREATE TRIGGER trg_leads_asignaciones_touch_activity
AFTER INSERT OR UPDATE OR DELETE ON public.leads_asignaciones
FOR EACH ROW EXECUTE FUNCTION public.touch_lead_activity();

-- La ficha de presupuesto/visita también forma parte de la actividad del lead.
DROP TRIGGER IF EXISTS trg_visitas_presupuesto_touch_activity ON public.visitas_presupuesto;
CREATE TRIGGER trg_visitas_presupuesto_touch_activity
AFTER INSERT OR UPDATE OR DELETE ON public.visitas_presupuesto
FOR EACH ROW EXECUTE FUNCTION public.touch_lead_activity();

DROP TRIGGER IF EXISTS trg_presupuesto_emisiones_touch_activity ON public.presupuesto_emisiones;
CREATE TRIGGER trg_presupuesto_emisiones_touch_activity
AFTER INSERT OR UPDATE OR DELETE ON public.presupuesto_emisiones
FOR EACH ROW EXECUTE FUNCTION public.touch_lead_activity();

DROP TRIGGER IF EXISTS trg_presupuesto_emision_eventos_touch_activity ON public.presupuesto_emision_eventos;
CREATE TRIGGER trg_presupuesto_emision_eventos_touch_activity
AFTER INSERT OR UPDATE OR DELETE ON public.presupuesto_emision_eventos
FOR EACH ROW EXECUTE FUNCTION public.touch_lead_activity();

CREATE OR REPLACE FUNCTION public.touch_lead_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  -- Abrir el lead solo actualiza la marca de lectura y no genera un aviso nuevo.
  IF (to_jsonb(NEW) - ARRAY['updated_at', 'visto_primera_vez_at']) IS DISTINCT FROM
     (to_jsonb(OLD) - ARRAY['updated_at', 'visto_primera_vez_at']) THEN
    NEW.updated_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_leads_touch_updated_at ON public.leads;
CREATE TRIGGER trg_leads_touch_updated_at
BEFORE UPDATE ON public.leads
FOR EACH ROW EXECUTE FUNCTION public.touch_lead_updated_at();
