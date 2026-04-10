/* global describe, test, expect */
import { calculateFichajeDuration } from '../lib/utils';

describe('calculateFichajeDuration logic', () => {
    
    // Example: 08:30 to 14:35 = 6h 05min = 21900 seconds
    test('calculateFichajeDuration calculates correct duration for standard Madrid shift', () => {
        const record = {
            // Naive time string (Stored as Naive in DB)
            hora_entrada: '2026-01-09 08:30:00',
            // UTC string (Stored as TZ in DB). 14:35 Madrid is 13:35 UTC (Winter)
            hora_salida: '2026-01-09T13:35:00Z', 
            pausa_segundos: 0
        };

        const seconds = calculateFichajeDuration(record);
        
        // 14:35 - 08:30 = 6 hours 5 minutes
        // 6 * 3600 = 21600
        // 5 * 60 = 300
        // Total = 21900
        expect(seconds).toBe(21900);
    });

    test('calculateFichajeDuration handles pause subtraction correctly', () => {
        const record = {
            hora_entrada: '2026-01-09 08:00:00',
            hora_salida: '2026-01-09T16:00:00Z', // 17:00 Madrid (if winter)
            pausa_segundos: 3600 // 1 hour pause
        };
        // 08:00 to 17:00 is 9 hours. Minus 1 hour pause = 8 hours.
        // 8 * 3600 = 28800
        
        const seconds = calculateFichajeDuration(record);
        expect(seconds).toBe(28800);
    });
});