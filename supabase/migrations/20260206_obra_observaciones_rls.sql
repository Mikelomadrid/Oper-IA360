-- ==============================================================================
-- Migration: Update RLS Policies for 'obra_observaciones'
-- Description:
--   - Allow any authenticated user to INSERT (add comments)
--   - Allow any authenticated user to SELECT (view comments)
--   - Allow ONLY admins to DELETE (remove comments)
-- ==============================================================================

-- 1. Ensure RLS is enabled
ALTER TABLE public.obra_observaciones ENABLE ROW LEVEL SECURITY;

-- 2. Drop specific existing policies to replace them with new rules
--    (We keep p_obra_obs_update_admin if it exists, to preserve admin update capability)
DROP POLICY IF EXISTS "p_obra_obs_select" ON public.obra_observaciones;
DROP POLICY IF EXISTS "p_obra_obs_insert" ON public.obra_observaciones;
DROP POLICY IF EXISTS "p_obra_obs_delete_admin" ON public.obra_observaciones;

-- 3. Policy: SELECT
--    Intent: Allow any authenticated user (Technicians, Admins, etc.) to view comments.
CREATE POLICY "obra_observaciones_select_all_authenticated"
ON public.obra_observaciones
FOR SELECT
TO authenticated
USING (true);

-- 4. Policy: INSERT
--    Intent: Allow any authenticated user to post a new comment.
CREATE POLICY "obra_observaciones_insert_all_authenticated"
ON public.obra_observaciones
FOR INSERT
TO authenticated
WITH CHECK (true);

-- 5. Policy: DELETE
--    Intent: Allow only users with 'admin' role in public.empleados to delete.
CREATE POLICY "obra_observaciones_delete_admin_only"
ON public.obra_observaciones
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 
    FROM public.empleados e
    WHERE e.auth_user_id = auth.uid()
      AND e.rol = 'admin'::app_role
  )
);