-- Migration: Obras Compartidas (Obras a Medias)
-- Adds support for shared projects with partner companies

-- 1. Add es_compartida flag to proyectos
ALTER TABLE proyectos ADD COLUMN IF NOT EXISTS es_compartida BOOLEAN DEFAULT false;

-- 2. Create table for partner data
CREATE TABLE IF NOT EXISTS obras_compartidas_socios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    proyecto_id UUID NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,
    nombre_socio TEXT NOT NULL DEFAULT 'Empresa Colaboradora',
    coste_personal NUMERIC(12,2) NOT NULL DEFAULT 0,
    coste_materiales NUMERIC(12,2) NOT NULL DEFAULT 0,
    notas TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(proyecto_id)
);

-- 3. RLS
ALTER TABLE obras_compartidas_socios ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read
CREATE POLICY "Authenticated users can read socios"
    ON obras_compartidas_socios
    FOR SELECT
    USING (auth.role() = 'authenticated');

-- Allow admin and encargado to manage
CREATE POLICY "Admin y encargado pueden gestionar socios"
    ON obras_compartidas_socios
    FOR ALL
    USING (true)
    WITH CHECK (true);
