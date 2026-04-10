-- Fix RLS Policies for Finca Admin to ensure full access to their own leads
-- This covers LEADS (Select, Update, Delete) and related tables (Comments, Photos, Attachments)

-- 1. LEADS TABLE POLICIES
-- SELECT Policy
DROP POLICY IF EXISTS "leads_select_policy" ON leads;
CREATE POLICY "leads_select_policy" ON leads FOR SELECT USING (
  -- 1. Admin/Encargado see all
  (EXISTS (SELECT 1 FROM empleados WHERE auth_user_id = auth.uid() AND rol IN ('admin', 'encargado')))
  OR
  -- 2. Finca Admin: See leads they Created (Auth ID) OR Own (Auth ID)
  (
    (EXISTS (SELECT 1 FROM empleados WHERE auth_user_id = auth.uid() AND rol = 'finca_admin'))
    AND
    (created_by = auth.uid() OR owner_user_id = auth.uid())
  )
  OR
  -- 3. Tecnico: Assigned directly or via Assignments table
  (
    (EXISTS (SELECT 1 FROM empleados WHERE auth_user_id = auth.uid() AND rol = 'tecnico'))
    AND
    (
        (empleado_asignado_id IN (SELECT id FROM empleados WHERE auth_user_id = auth.uid()))
        OR
        (EXISTS (SELECT 1 FROM leads_asignaciones la WHERE la.lead_id = leads.id AND la.usuario_id = auth.uid()))
    )
  )
  OR
  -- 4. Catch-all Owner
  (owner_user_id = auth.uid())
);

-- UPDATE Policy
DROP POLICY IF EXISTS "leads_update_policy" ON leads;
CREATE POLICY "leads_update_policy" ON leads FOR UPDATE USING (
  -- Admin/Encargado
  (EXISTS (SELECT 1 FROM empleados WHERE auth_user_id = auth.uid() AND rol IN ('admin', 'encargado')))
  OR
  -- Finca Admin / Creator / Owner
  (
    (created_by = auth.uid()) 
    OR 
    (owner_user_id = auth.uid())
  )
  OR
  -- Assigned Technician (can update status/comments of their assigned leads)
  (
    (EXISTS (SELECT 1 FROM empleados WHERE auth_user_id = auth.uid() AND rol = 'tecnico'))
    AND
    (
        (empleado_asignado_id IN (SELECT id FROM empleados WHERE auth_user_id = auth.uid()))
        OR
        (EXISTS (SELECT 1 FROM leads_asignaciones la WHERE la.lead_id = leads.id AND la.usuario_id = auth.uid()))
    )
  )
);

-- DELETE Policy
DROP POLICY IF EXISTS "leads_delete_policy" ON leads;
CREATE POLICY "leads_delete_policy" ON leads FOR DELETE USING (
  -- Admin/Encargado
  (EXISTS (SELECT 1 FROM empleados WHERE auth_user_id = auth.uid() AND rol IN ('admin', 'encargado')))
  OR
  -- Creator / Owner (e.g. Finca Admin deleting their own draft)
  (
    (created_by = auth.uid()) 
    OR 
    (owner_user_id = auth.uid())
  )
);


-- 2. RELATED TABLES POLICIES (Comments, Photos, Attachments)
-- Ensure Finca Admin can manage content on leads they have access to (created or owned)

-- LEAD_COMENTARIOS
DROP POLICY IF EXISTS "lead_com_select" ON lead_comentarios;
CREATE POLICY "lead_com_select" ON lead_comentarios FOR SELECT USING (
  -- Admin/Encargado
  (EXISTS (SELECT 1 FROM empleados WHERE auth_user_id = auth.uid() AND rol IN ('admin', 'encargado')))
  OR
  -- Parent Lead Access (Creator/Owner/Assigned)
  (EXISTS (
    SELECT 1 FROM leads l 
    WHERE l.id = lead_comentarios.lead_id 
    AND (
      l.owner_user_id = auth.uid() 
      OR l.created_by = auth.uid()
      OR l.empleado_asignado_id IN (SELECT id FROM empleados WHERE auth_user_id = auth.uid())
      OR l.colaborador_id IN (SELECT id FROM empleados WHERE auth_user_id = auth.uid())
    )
  ))
  OR
  (EXISTS (SELECT 1 FROM leads_asignaciones la WHERE la.lead_id = lead_comentarios.lead_id AND la.usuario_id = auth.uid()))
);

DROP POLICY IF EXISTS "lead_com_delete_policy" ON lead_comentarios;
CREATE POLICY "lead_com_delete_policy" ON lead_comentarios FOR DELETE USING (
  (EXISTS (SELECT 1 FROM empleados WHERE auth_user_id = auth.uid() AND rol IN ('admin', 'encargado')))
  OR
  (autor_id = auth.uid())
  OR
  -- Lead Owner/Creator can delete any comment on their lead
  (EXISTS (
    SELECT 1 FROM leads l 
    WHERE l.id = lead_comentarios.lead_id 
    AND (l.created_by = auth.uid() OR l.owner_user_id = auth.uid())
  ))
);

-- LEAD_FOTOS
DROP POLICY IF EXISTS "lead_fotos_select_policy" ON lead_fotos;
CREATE POLICY "lead_fotos_select_policy" ON lead_fotos FOR SELECT USING (
  (EXISTS (SELECT 1 FROM empleados WHERE auth_user_id = auth.uid() AND rol IN ('admin', 'encargado')))
  OR
  (EXISTS (
    SELECT 1 FROM leads l 
    WHERE l.id = lead_fotos.lead_id 
    AND (
        l.owner_user_id = auth.uid() 
        OR l.created_by = auth.uid()
        OR l.empleado_asignado_id IN (SELECT id FROM empleados WHERE auth_user_id = auth.uid())
    )
  ))
  OR
  (EXISTS (SELECT 1 FROM leads_asignaciones la WHERE la.lead_id = lead_fotos.lead_id AND la.usuario_id = auth.uid()))
);

DROP POLICY IF EXISTS "lead_fotos_delete_policy" ON lead_fotos;
CREATE POLICY "lead_fotos_delete_policy" ON lead_fotos FOR DELETE USING (
  (EXISTS (SELECT 1 FROM empleados WHERE auth_user_id = auth.uid() AND rol IN ('admin', 'encargado')))
  OR (uploaded_by = auth.uid())
  OR (usuario_id = auth.uid())
  OR
  -- Lead Owner/Creator can delete any photo on their lead
  (EXISTS (
    SELECT 1 FROM leads l 
    WHERE l.id = lead_fotos.lead_id 
    AND (l.created_by = auth.uid() OR l.owner_user_id = auth.uid())
  ))
);

-- LEAD_ADJUNTOS
-- Consolidate policies
DROP POLICY IF EXISTS "adjuntos_admin_all" ON lead_adjuntos;
DROP POLICY IF EXISTS "adjuntos_owner_all" ON lead_adjuntos;

CREATE POLICY "lead_adjuntos_access_policy" ON lead_adjuntos FOR ALL USING (
  (EXISTS (SELECT 1 FROM empleados WHERE auth_user_id = auth.uid() AND rol IN ('admin', 'encargado')))
  OR
  (EXISTS (
    SELECT 1 FROM leads l 
    WHERE l.id = lead_adjuntos.lead_id 
    AND (
        l.owner_user_id = auth.uid() 
        OR l.created_by = auth.uid()
        OR l.empleado_asignado_id IN (SELECT id FROM empleados WHERE auth_user_id = auth.uid())
    )
  ))
  OR
  (EXISTS (SELECT 1 FROM leads_asignaciones la WHERE la.lead_id = lead_adjuntos.lead_id AND la.usuario_id = auth.uid()))
);