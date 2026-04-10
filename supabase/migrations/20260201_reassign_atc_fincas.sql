-- Migration Script: Reassign ATC User Data and Update Profile
-- Target User UID: 9e3e6fcf-7966-4949-8543-b5d7a82e13dd
-- Target Email: administracion@atcfincas.es
-- Target Name: ATC Fincas

DO $$
DECLARE
    target_uid uuid := '9e3e6fcf-7966-4949-8543-b5d7a82e13dd';
    target_email text := 'administracion@atcfincas.es';
    target_name text := 'ATC Fincas';
    v_empleado_id uuid;
    v_count integer;
BEGIN
    RAISE NOTICE 'Starting migration for ATC Fincas...';

    -- 1. EMPLOYEES TABLE SYNC
    -- Ensure the employee record exists and is linked to the correct Auth UID
    SELECT id INTO v_empleado_id FROM public.empleados WHERE auth_user_id = target_uid;

    IF v_empleado_id IS NULL THEN
        -- Fallback: Find by email if auth link is missing
        SELECT id INTO v_empleado_id FROM public.empleados WHERE email = target_email LIMIT 1;
        
        IF v_empleado_id IS NOT NULL THEN
            UPDATE public.empleados 
            SET auth_user_id = target_uid, 
                nombre = target_name,
                rol = 'finca_admin',
                activo = true
            WHERE id = v_empleado_id;
            RAISE NOTICE 'Linked existing employee record to target UID.';
        ELSE
            -- Create new employee record
            INSERT INTO public.empleados (id, nombre, email, rol, auth_user_id, activo, costo_por_hora)
            VALUES (gen_random_uuid(), target_name, target_email, 'finca_admin', target_uid, true, 0)
            RETURNING id INTO v_empleado_id;
            RAISE NOTICE 'Created new employee record for ATC Fincas.';
        END IF;
    ELSE
        -- Update existing linked employee
        UPDATE public.empleados 
        SET nombre = target_name, 
            email = target_email,
            rol = 'finca_admin',
            activo = true 
        WHERE id = v_empleado_id;
        RAISE NOTICE 'Updated existing employee record.';
    END IF;

    -- 2. UPDATE LEADS
    -- Update owner_user_id (Auth ID)
    UPDATE public.leads 
    SET owner_user_id = target_uid 
    WHERE (owner_user_id != target_uid AND owner_user_id IN (SELECT id FROM auth.users WHERE email = target_email));
    
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RAISE NOTICE 'Updated % leads (owner_user_id).', v_count;

    -- Update created_by (Employee ID used in AddLeadModal)
    UPDATE public.leads 
    SET created_by = v_empleado_id
    WHERE (created_by != v_empleado_id AND created_by IN (SELECT id FROM public.empleados WHERE email = target_email));

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RAISE NOTICE 'Updated % leads (created_by -> EmployeeID).', v_count;

    -- Update display names in leads
    UPDATE public.leads
    SET created_by_name = target_name
    WHERE created_by = v_empleado_id OR owner_user_id = target_uid;

    -- 3. UPDATE PARTES
    -- created_by, tecnico_asignado_id, administrador_finca_id -> These reference EMPLEADOS
    
    UPDATE public.partes SET created_by = v_empleado_id 
    WHERE created_by != v_empleado_id AND created_by IN (SELECT id FROM public.empleados WHERE email = target_email);
    
    UPDATE public.partes SET administrador_finca_id = v_empleado_id 
    WHERE administrador_finca_id != v_empleado_id AND administrador_finca_id IN (SELECT id FROM public.empleados WHERE email = target_email);

    -- 4. UPDATE FINCA TABLES (If populated)
    UPDATE public.finca_partes_trabajo SET created_by = v_empleado_id 
    WHERE created_by != v_empleado_id AND created_by IN (SELECT id FROM public.empleados WHERE email = target_email);

    -- 5. UPDATE USER PROFILE (Public)
    INSERT INTO public.user_profile (user_id, display_name)
    VALUES (target_uid, target_name)
    ON CONFLICT (user_id) DO UPDATE SET display_name = target_name;

    -- 6. ATTEMPT AUTH METADATA UPDATE (Might require superuser, purely optional for display in Supabase dashboard)
    -- This block might fail if run without sufficient privileges, but usually works in self-hosted or migrations
    BEGIN
        UPDATE auth.users 
        SET raw_user_meta_data = 
            COALESCE(raw_user_meta_data, '{}'::jsonb) || 
            jsonb_build_object('full_name', target_name, 'name', target_name, 'display_name', target_name)
        WHERE id = target_uid;
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Could not update auth.users metadata: %', SQLERRM;
    END;

    RAISE NOTICE 'Migration completed successfully for ATC Fincas.';
END $$;