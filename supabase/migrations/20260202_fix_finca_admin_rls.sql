-- Fix RLS Policy for Finca Admin on LEADS table
-- Previous policy incorrectly compared created_by (Employee ID) with auth.uid() (User ID).
-- This update ensures Finca Admins can see leads they created OR leads they own.

DROP POLICY IF EXISTS "leads_select_policy" ON leads;

CREATE POLICY "leads_select_policy" ON leads FOR SELECT USING (
  -- 1. Admin/Encargado see all
  (EXISTS ( SELECT 1 FROM empleados WHERE ((empleados.auth_user_id = auth.uid()) AND (empleados.rol = ANY (ARRAY['admin'::app_role, 'encargado'::app_role]))))) 
  OR 
  -- 2. Finca Admin: See leads they Created OR Own
  (
    (EXISTS ( SELECT 1 FROM empleados WHERE ((empleados.auth_user_id = auth.uid()) AND (empleados.rol = 'finca_admin'::app_role)))) 
    AND 
    (
        -- Fix: Compare created_by with Employee ID derived from Auth ID
        created_by IN (SELECT id FROM empleados WHERE auth_user_id = auth.uid()) 
        OR 
        -- Fix: Compare owner_user_id with Auth ID
        owner_user_id = auth.uid()
    )
  ) 
  OR 
  -- 3. Tecnico: Assigned directly or via Assignments table
  (
    (EXISTS ( SELECT 1 FROM empleados WHERE ((empleados.auth_user_id = auth.uid()) AND (empleados.rol = 'tecnico'::app_role)))) 
    AND 
    (
        (empleado_asignado_id IN ( SELECT empleados.id FROM empleados WHERE (empleados.auth_user_id = auth.uid()))) 
        OR 
        (EXISTS ( SELECT 1 FROM leads_asignaciones la WHERE ((la.lead_id = leads.id) AND (la.usuario_id = auth.uid()))))
    )
  )
  OR 
  -- 4. Catch-all Owner (Colaborador, etc)
  (owner_user_id = auth.uid())
);