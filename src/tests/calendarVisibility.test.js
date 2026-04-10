/* global describe, test, expect */
import { canViewEvent, MIKELO_UID } from '../utils/calendarPermissions';

describe('Calendar Visibility Logic', () => {
    
    // Mock Users
    const adminUser = { id: 'admin-1', rol: 'admin', auth_user_id: 'auth-admin-1' };
    const encargadoUser = { id: 'encargado-1', rol: 'encargado', auth_user_id: 'auth-encargado-1' };
    const otherEncargado = { id: 'encargado-2', rol: 'encargado', auth_user_id: 'auth-encargado-2' };
    const techUser = { id: 'tech-1', rol: 'tecnico', auth_user_id: 'auth-tech-1' };
    const otherTech = { id: 'tech-2', rol: 'tecnico', auth_user_id: 'auth-tech-2' };
    
    // Mikelo User (The Special One)
    const mikeloUser = { id: 'mikelo-id', rol: 'admin', auth_user_id: MIKELO_UID };

    // Mock Owners (attached to events)
    const ownerAdmin = { id: 'admin-1', rol: 'admin', auth_user_id: 'auth-admin-1' };
    const ownerEncargado = { id: 'encargado-1', rol: 'encargado', auth_user_id: 'auth-encargado-1' };
    const ownerOtherEncargado = { id: 'encargado-2', rol: 'encargado', auth_user_id: 'auth-encargado-2' };
    const ownerTech = { id: 'tech-1', rol: 'tecnico', auth_user_id: 'auth-tech-1' };
    const ownerMikelo = { id: 'mikelo-id', rol: 'admin', auth_user_id: MIKELO_UID };

    // --- MIKELO PRIVACY TESTS ---
    test('Mikelo should see his own events', () => {
        expect(canViewEvent(mikeloUser, ownerMikelo)).toBe(true);
    });

    test('Admin should NOT see Mikelo events', () => {
        expect(canViewEvent(adminUser, ownerMikelo)).toBe(false);
    });

    test('Encargado should NOT see Mikelo events', () => {
        expect(canViewEvent(encargadoUser, ownerMikelo)).toBe(false);
    });

    test('Technician should NOT see Mikelo events', () => {
        expect(canViewEvent(techUser, ownerMikelo)).toBe(false);
    });

    test('Mikelo should see other Admin events (as he is admin)', () => {
        expect(canViewEvent(mikeloUser, ownerAdmin)).toBe(true);
    });

    // --- STANDARD ADMIN TESTS ---
    test('Admin should see everything (except Mikelo)', () => {
        expect(canViewEvent(adminUser, ownerAdmin)).toBe(true);
        expect(canViewEvent(adminUser, ownerEncargado)).toBe(true);
        expect(canViewEvent(adminUser, ownerTech)).toBe(true);
    });

    // --- STANDARD ENCARGADO TESTS ---
    test('Encargado should see their own events', () => {
        expect(canViewEvent(encargadoUser, ownerEncargado)).toBe(true); // Self is ownerEncargado here? No, ownerEncargado matches ID
        // Actually match ID for self test:
        expect(canViewEvent(encargadoUser, { ...ownerEncargado, id: encargadoUser.id })).toBe(true);
    });

    test('Encargado should see technician events', () => {
        expect(canViewEvent(encargadoUser, ownerTech)).toBe(true);
    });

    test('Encargado should see admin events', () => {
        expect(canViewEvent(encargadoUser, ownerAdmin)).toBe(true);
    });

    test('Encargado should NOT see other encargados events', () => {
        expect(canViewEvent(encargadoUser, ownerOtherEncargado)).toBe(false);
    });

    // --- STANDARD TECHNICIAN TESTS ---
    test('Technician should see their own events', () => {
        expect(canViewEvent(techUser, { ...ownerTech, id: techUser.id })).toBe(true);
    });

    test('Technician should NOT see other technician events', () => {
        expect(canViewEvent(techUser, { ...ownerTech, id: 'other-tech-id' })).toBe(false);
    });

    test('Technician should NOT see encargado events', () => {
        expect(canViewEvent(techUser, ownerEncargado)).toBe(false);
    });
});