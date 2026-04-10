-- Fix RLS Policies for Finca Admin to ensure full access to their own leads
-- This migration updates RLS on leads, lead_comentarios, lead_fotos, and lead_adjuntos.
-- It ensures that any user (including 'finca_admin') who is the Creator or Owner of a lead has full access.

-- ==============================================================================
-- 1. LEADS TABLE
-- ==============================================================================

DROP POLICY IF EXISTS "leads_select_policy" ON leads;
CREATE POLICY "leads_select_policy" ON leads FOR SELECT USING (
  -- 1. Admin/Encargado see all
  (EXISTS (SELECT 1 FROM empleados WHERE auth_user_id = auth.uid() AND rol IN ('admin', 'encargado')))
  OR
  -- 2. Tecnico: See leads assigned to them (directly or via assignments table)
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
  -- 3. Owner/Creator Access (Crucial for Finca Admin & Colaboradores)
  -- Checks if the current auth user is the one who created the lead OR is the assigned owner
  (created_by = auth.uid() OR owner_user_id = auth.uid())
);

DROP POLICY IF EXISTS "leads_update_policy" ON leads;
CREATE POLICY "leads_update_policy" ON leads FOR UPDATE USING (
  -- Admin/Encargado
  (EXISTS (SELECT 1 FROM empleados WHERE auth_user_id = auth.uid() AND rol IN ('admin', 'encargado')))
  OR
  -- Owner/Creator (Finca Admin)
  (created_by = auth.uid() OR owner_user_id = auth.uid())
  OR
  -- Technician (Assigned) - Can usually update status/comments
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

DROP POLICY IF EXISTS "leads_delete_policy" ON leads;
CREATE POLICY "leads_delete_policy" ON leads FOR DELETE USING (
  -- Admin/Encargado
  (EXISTS (SELECT 1 FROM empleados WHERE auth_user_id = auth.uid() AND rol IN ('admin', 'encargado')))
  OR
  -- Owner/Creator can delete their own leads (e.g. drafts)
  (created_by = auth.uid() OR owner_user_id = auth.uid())
);


-- ==============================================================================
-- 2. LEAD_COMENTARIOS
-- ==============================================================================

DROP POLICY IF EXISTS "lead_com_select" ON lead_comentarios;
CREATE POLICY "lead_com_select" ON lead_comentarios FOR SELECT USING (
  -- Admin/Encargado
  (EXISTS (SELECT 1 FROM empleados WHERE auth_user_id = auth.uid() AND rol IN ('admin', 'encargado')))
  OR
  -- Users who have access to the parent Lead
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
  -- Assigned via auxiliary table
  (EXISTS (SELECT 1 FROM leads_asignaciones la WHERE la.lead_id = lead_comentarios.lead_id AND la.usuario_id = auth.uid()))
);

DROP POLICY IF EXISTS "lead_com_delete_policy" ON lead_comentarios;
CREATE POLICY "lead_com_delete_policy" ON lead_comentarios FOR DELETE USING (
  -- Admin/Encargado
  (EXISTS (SELECT 1 FROM empleados WHERE auth_user_id = auth.uid() AND rol IN ('admin', 'encargado')))
  OR
  -- The author of the comment
  (autor_id = auth.uid())
  OR
  -- The Owner/Creator of the Lead (Finca Admin) can moderate comments on their lead
  (EXISTS (
    SELECT 1 FROM leads l 
    WHERE l.id = lead_comentarios.lead_id 
    AND (l.created_by = auth.uid() OR l.owner_user_id = auth.uid())
  ))
);

-- ==============================================================================
-- 3. LEAD_FOTOS
-- ==============================================================================

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
  -- Lead Owner/Creator can delete photos on their lead
  (EXISTS (
    SELECT 1 FROM leads l 
    WHERE l.id = lead_fotos.lead_id 
    AND (l.created_by = auth.uid() OR l.owner_user_id = auth.uid())
  ))
);

-- ==============================================================================
-- 4. LEAD_ADJUNTOS
-- ==============================================================================

DROP POLICY IF EXISTS "adjuntos_admin_all" ON lead_adjuntos;
DROP POLICY IF EXISTS "adjuntos_owner_all" ON lead_adjuntos;
DROP POLICY IF EXISTS "lead_adjuntos_access_policy" ON lead_adjuntos;
DROP POLICY IF EXISTS "lead_adjuntos_select_policy" ON lead_adjuntos;
DROP POLICY IF EXISTS "lead_adjuntos_insert_policy" ON lead_adjuntos;
DROP POLICY IF EXISTS "lead_adjuntos_delete_policy" ON lead_adjuntos;

CREATE POLICY "lead_adjuntos_select_policy" ON lead_adjuntos FOR SELECT USING (
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

CREATE POLICY "lead_adjuntos_insert_policy" ON lead_adjuntos FOR INSERT WITH CHECK (
  -- Allow insert if user has access to the lead (simplified check or just auth)
  auth.role() = 'authenticated'
);

CREATE POLICY "lead_adjuntos_delete_policy" ON lead_adjuntos FOR DELETE USING (
  (EXISTS (SELECT 1 FROM empleados WHERE auth_user_id = auth.uid() AND rol IN ('admin', 'encargado')))
  OR
  (uploaded_by = auth.uid())
  OR
  -- Lead Owner/Creator can delete attachments on their lead
  (EXISTS (
    SELECT 1 FROM leads l 
    WHERE l.id = lead_adjuntos.lead_id 
    AND (l.created_by = auth.uid() OR l.owner_user_id = auth.uid())
  ))
);

-- ==============================================================================
-- 5. LEAD_FOTOS_CARPETAS (Optional but recommended for full coverage)
-- ==============================================================================

DROP POLICY IF EXISTS "carpetas_select_policy" ON lead_fotos_carpetas;
CREATE POLICY "carpetas_select_policy" ON lead_fotos_carpetas FOR SELECT USING (
  (EXISTS (SELECT 1 FROM empleados WHERE auth_user_id = auth.uid() AND rol IN ('admin', 'encargado')))
  OR
  (EXISTS (
    SELECT 1 FROM leads l 
    WHERE l.id = lead_fotos_carpetas.lead_id 
    AND (
        l.owner_user_id = auth.uid() 
        OR l.created_by = auth.uid()
        OR l.empleado_asignado_id IN (SELECT id FROM empleados WHERE auth_user_id = auth.uid())
    )
  ))
  OR
  (EXISTS (SELECT 1 FROM leads_asignaciones la WHERE la.lead_id = lead_fotos_carpetas.lead_id AND la.usuario_id = auth.uid()))
);

DROP POLICY IF EXISTS "carpetas_modification_policy" ON lead_fotos_carpetas;
CREATE POLICY "carpetas_modification_policy" ON lead_fotos_carpetas FOR ALL USING (
  (EXISTS (SELECT 1 FROM empleados WHERE auth_user_id = auth.uid() AND rol IN ('admin', 'encargado')))
  OR
  (EXISTS (
    SELECT 1 FROM leads l 
    WHERE l.id = lead_fotos_carpetas.lead_id 
    AND (l.created_by = auth.uid() OR l.owner_user_id = auth.uid())
  ))
);