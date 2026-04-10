/* global describe, test, expect */
import { parseMadridToUTC, getGreetingByHour } from '../lib/utils';

describe('Timezone Handling Tests', () => {
    
    test('parseMadridToUTC correctly shifts naive "08:00" to UTC based on Madrid offset', () => {
        // Test Summer Time (DST) - Madrid is UTC+2
        const summerDateStr = '2023-07-15';
        const summerTimeStr = '08:00';
        
        // Expected: 08:00 Madrid -> 06:00 UTC
        const resultSummer = parseMadridToUTC(summerDateStr, summerTimeStr);
        expect(resultSummer).not.toBeNull();
        expect(resultSummer.toISOString()).toBe('2023-07-15T06:00:00.000Z');

        // Test Winter Time (Standard) - Madrid is UTC+1
        const winterDateStr = '2023-12-15';
        const winterTimeStr = '08:00';
        
        // Expected: 08:00 Madrid -> 07:00 UTC
        const resultWinter = parseMadridToUTC(winterDateStr, winterTimeStr);
        expect(resultWinter).not.toBeNull();
        expect(resultWinter.toISOString()).toBe('2023-12-15T07:00:00.000Z');
    });

    test('getGreetingByHour handles day phases correctly', () => {
        // We mock Date to check specific hours relative to Madrid
        
        // This test is slightly tricky because getGreetingByHour depends on how Date is constructed in the test environment (often UTC)
        // AND how Intl converts it to Madrid.
        // Let's create specific UTC dates that correspond to Madrid hours.
        
        // 1. Madrid 08:00 (Buenos días) -> Winter UTC+1 -> 07:00 UTC
        const morningDate = new Date('2023-12-15T07:00:00Z'); 
        expect(getGreetingByHour(morningDate)).toBe('Buenos días');

        // 2. Madrid 15:00 (Buenas tardes) -> Winter UTC+1 -> 14:00 UTC
        const afternoonDate = new Date('2023-12-15T14:00:00Z');
        expect(getGreetingByHour(afternoonDate)).toBe('Buenas tardes');

        // 3. Madrid 22:00 (Buenas noches) -> Winter UTC+1 -> 21:00 UTC
        const nightDate = new Date('2023-12-15T21:00:00Z');
        expect(getGreetingByHour(nightDate)).toBe('Buenas noches');

        // 4. Madrid 02:00 (Buenas noches) -> Winter UTC+1 -> 01:00 UTC
        const lateNightDate = new Date('2023-12-15T01:00:00Z');
        expect(getGreetingByHour(lateNightDate)).toBe('Buenas noches');
    });
});