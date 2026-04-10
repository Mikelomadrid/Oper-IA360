/**
 * calendarPermissions.js
 * 
 * Centralizes the security model for Calendar Event Visibility.
 * 
 * RULES (Based on requirements):
 * 
 * 1. MIKELO PRIVACY EXCEPTION (Top Priority):
 *    - If an event belongs to MIKELO (owner_user_id = MIKELO_UID), 
 *      ONLY Mikelo can see it.
 *    - This overrides Admin/Encargado visibility rules.
 * 
 * 2. ADMIN:
 *    - Sees EVERYTHING (except Mikelo's private events).
 * 
 * 3. ENCARGADO (Supervisor):
 *    - Sees OWN events (assigned to self).
 *    - Sees ADMIN events (assigned to an admin).
 *    - Sees TECHNICIAN events (assigned to any technician).
 *    - DOES NOT SEE events assigned to OTHER Encargados (unless it's themselves).
 * 
 * 4. TECNICO (Technician):
 *    - Sees OWN events (assigned to self).
 *    - Sees GLOBAL/SYSTEM events (e.g. Holidays) - usually handled separately or ownerless.
 *    - DOES NOT SEE events assigned to others (other technicians, encargados, or admins).
 * 
 * @param {Object} viewer - The current user { id: string, rol: string, auth_user_id: string }
 * @param {Object} eventOwner - The owner of the event { id: string, rol: string, auth_user_id: string }
 * @returns {boolean} - True if visible, False otherwise
 */

// Mikelo's Auth User ID (from database/auth system)
export const MIKELO_UID = 'f293384c-7f83-46e8-bf8c-d2b7df191f08';

export const canViewEvent = (viewer, eventOwner) => {
    if (!viewer || !viewer.rol) return false;

    // --- MIKELO EXCEPTION ---
    // Identify if the event owner is Mikelo based on Auth ID
    const ownerAuthId = eventOwner?.auth_user_id;
    const viewerAuthId = viewer.auth_user_id;

    if (ownerAuthId === MIKELO_UID) {
        // Only Mikelo sees Mikelo's events
        return viewerAuthId === MIKELO_UID;
    }

    // 1. Admin sees all (non-Mikelo events)
    if (viewer.rol === 'admin') return true;

    // Normalize IDs for comparison
    const viewerId = viewer.id;
    const ownerId = eventOwner?.id;
    const ownerRole = eventOwner?.rol;

    // Event without specific owner (e.g., global holiday) implies visibility
    if (!ownerId) return true; 

    // 2. Self-ownership (Applies to everyone)
    if (viewerId === ownerId) return true;

    // 3. Encargado Logic
    if (viewer.rol === 'encargado') {
        // Can see Technician events
        if (ownerRole === 'tecnico') return true;
        // Can see Admin events
        if (ownerRole === 'admin') return true;
        // Cannot see other Encargados
        return false;
    }

    // 4. Technician Logic
    if (viewer.rol === 'tecnico') {
        // Already handled self-ownership above.
        // Explicitly cannot see others.
        return false;
    }

    // Default deny
    return false;
};

/**
 * Filter a list of events based on the viewer's role.
 * Expects events to have an 'owner' property or similar that contains { id, rol, auth_user_id }.
 * 
 * @param {Array} events - List of event objects
 * @param {Object} viewer - Current user { id, rol, auth_user_id }
 * @param {Function} getOwnerFn - Accessor to get owner object from event (defaults to e => e.owner)
 * @returns {Array} - Filtered events
 */
export const filterEventsByRole = (events, viewer, getOwnerFn = (e) => e.owner) => {
    if (!events || !Array.isArray(events)) return [];
    return events.filter(event => {
        // Always allow global types (Festivos) if they don't have an owner
        if (event.type === 'FESTIVO' || event.type === 'festivo') return true;
        
        const owner = getOwnerFn(event);
        return canViewEvent(viewer, owner);
    });
};