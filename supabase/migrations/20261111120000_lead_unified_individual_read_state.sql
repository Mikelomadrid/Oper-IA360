-- Unifica el semáforo de leads: la actividad es naranja para los demás usuarios
-- asignados y el autor de la actividad queda leído automáticamente.

CREATE OR REPLACE FUNCTION public.mark_lead_seen_for_current_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    INSERT INTO public.lead_lecturas (lead_id, usuario_id, visto_at)
    VALUES (NEW.id, auth.uid(), now())
    ON CONFLICT (lead_id, usuario_id)
    DO UPDATE SET visto_at = EXCLUDED.visto_at;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_lead_mark_author_seen ON public.leads;
CREATE TRIGGER trg_lead_mark_author_seen
AFTER INSERT OR UPDATE ON public.leads
FOR EACH ROW EXECUTE FUNCTION public.mark_lead_seen_for_current_user();
