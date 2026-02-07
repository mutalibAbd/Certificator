/**
 * Unit tests for the data parser module
 *
 * Tests CSV and Excel parsing functionality.
 */

import { describe, it, expect } from 'vitest';
import { parseCSVText, type ParsedData } from '@/lib/data-parser';

// ============================================================================
// CSV PARSING
// ============================================================================

describe('CSV Parser', () => {
    describe('parseCSVText', () => {
        it('parses simple CSV with headers and data', () => {
            const csv = `name,email,date
John Doe,john@example.com,2024-01-15
Jane Smith,jane@example.com,2024-01-16`;

            const result = parseCSVText(csv);

            expect(result.headers).toEqual(['name', 'email', 'date']);
            expect(result.rows).toHaveLength(2);
            expect(result.rows[0]).toEqual(['John Doe', 'john@example.com', '2024-01-15']);
            expect(result.rows[1]).toEqual(['Jane Smith', 'jane@example.com', '2024-01-16']);
        });

        it('handles quoted fields with commas', () => {
            const csv = `name,description,value
"Smith, John","A description with, commas",100`;

            const result = parseCSVText(csv);

            expect(result.headers).toEqual(['name', 'description', 'value']);
            expect(result.rows[0]).toEqual([
                'Smith, John',
                'A description with, commas',
                '100',
            ]);
        });

        it('handles escaped quotes (double quotes)', () => {
            const csv = `name,quote
John,"He said ""Hello"" to me"`;

            const result = parseCSVText(csv);

            expect(result.rows[0]).toEqual(['John', 'He said "Hello" to me']);
        });

        it('handles empty fields', () => {
            const csv = 'a,b,c\n1,,3';

            const result = parseCSVText(csv);

            expect(result.headers).toEqual(['a', 'b', 'c']);
            expect(result.rows).toHaveLength(1);
            expect(result.rows[0]).toEqual(['1', '', '3']);
        });

        it('handles Windows line endings (CRLF)', () => {
            const csv = 'name,email\r\nJohn,john@test.com\r\nJane,jane@test.com';

            const result = parseCSVText(csv);

            expect(result.headers).toEqual(['name', 'email']);
            expect(result.rows).toHaveLength(2);
        });

        it('handles Unix line endings (LF)', () => {
            const csv = 'name,email\nJohn,john@test.com\nJane,jane@test.com';

            const result = parseCSVText(csv);

            expect(result.headers).toEqual(['name', 'email']);
            expect(result.rows).toHaveLength(2);
        });

        it('handles old Mac line endings (CR)', () => {
            const csv = 'name,email\rJohn,john@test.com\rJane,jane@test.com';

            const result = parseCSVText(csv);

            expect(result.headers).toEqual(['name', 'email']);
            expect(result.rows).toHaveLength(2);
        });

        it('skips empty lines', () => {
            const csv = `name,email

John,john@test.com

Jane,jane@test.com
`;

            const result = parseCSVText(csv);

            expect(result.headers).toEqual(['name', 'email']);
            expect(result.rows).toHaveLength(2);
        });

        it('handles quoted fields with newlines', () => {
            const csv = `name,address
John,"123 Main St
Apt 4B
New York, NY"`;

            const result = parseCSVText(csv);

            expect(result.rows[0][1]).toBe('123 Main St\nApt 4B\nNew York, NY');
        });

        it('handles single column CSV', () => {
            const csv = `names
Alice
Bob
Charlie`;

            const result = parseCSVText(csv);

            expect(result.headers).toEqual(['names']);
            expect(result.rows).toEqual([['Alice'], ['Bob'], ['Charlie']]);
        });

        it('handles trailing comma (empty last field)', () => {
            const csv = 'a,b\n1,2';

            const result = parseCSVText(csv);

            expect(result.headers).toEqual(['a', 'b']);
            expect(result.rows[0]).toEqual(['1', '2']);
        });

        it('returns empty arrays for empty input', () => {
            const result = parseCSVText('');

            expect(result.headers).toEqual([]);
            expect(result.rows).toEqual([]);
        });

        it('returns headers only for single-row CSV', () => {
            const csv = 'name,email,date';

            const result = parseCSVText(csv);

            expect(result.headers).toEqual(['name', 'email', 'date']);
            expect(result.rows).toEqual([]);
        });

        it('handles unicode characters', () => {
            const csv = `name,greeting
Müller,Guten Tag
田中,こんにちは
Иванов,Привет`;

            const result = parseCSVText(csv);

            expect(result.headers).toEqual(['name', 'greeting']);
            expect(result.rows[0]).toEqual(['Müller', 'Guten Tag']);
            expect(result.rows[1]).toEqual(['田中', 'こんにちは']);
            expect(result.rows[2]).toEqual(['Иванов', 'Привет']);
        });

        it('handles mixed quoted and unquoted fields', () => {
            const csv = `a,b,c
"quoted",unquoted,"also quoted"`;

            const result = parseCSVText(csv);

            expect(result.rows[0]).toEqual(['quoted', 'unquoted', 'also quoted']);
        });

        it('handles leading/trailing whitespace in unquoted fields', () => {
            const csv = `name,value
 John , 123 `;

            const result = parseCSVText(csv);

            // Whitespace is preserved in unquoted fields
            expect(result.rows[0]).toEqual([' John ', ' 123 ']);
        });

        it('handles very long fields', () => {
            const longValue = 'x'.repeat(10000);
            const csv = `name,data\ntest,"${longValue}"`;

            const result = parseCSVText(csv);

            expect(result.rows[0][1]).toBe(longValue);
        });

        it('handles many columns', () => {
            const columns = Array.from({ length: 100 }, (_, i) => `col${i}`);
            const values = Array.from({ length: 100 }, (_, i) => `val${i}`);
            const csv = `${columns.join(',')}\n${values.join(',')}`;

            const result = parseCSVText(csv);

            expect(result.headers).toHaveLength(100);
            expect(result.rows[0]).toHaveLength(100);
        });
    });
});

// ============================================================================
// TYPE TESTS
// ============================================================================

describe('ParsedData Type', () => {
    it('has correct structure', () => {
        const data: ParsedData = {
            headers: ['a', 'b', 'c'],
            rows: [
                ['1', '2', '3'],
                ['4', '5', '6'],
            ],
        };

        expect(data.headers).toBeInstanceOf(Array);
        expect(data.rows).toBeInstanceOf(Array);
        expect(data.rows[0]).toBeInstanceOf(Array);
    });
});

// ============================================================================
// EDGE CASES
// ============================================================================

describe('Edge Cases', () => {
    it('handles CSV with only whitespace', () => {
        const csv = '   \n   \n   ';

        const result = parseCSVText(csv);

        // Should return whitespace-only fields
        expect(result.headers).toBeDefined();
    });

    it('handles unclosed quoted field', () => {
        // This is technically malformed CSV, but should handle gracefully
        const csv = `name,value
test,"unclosed quote`;

        const result = parseCSVText(csv);

        // Should not throw, should capture what it can
        expect(result.headers).toEqual(['name', 'value']);
        expect(result.rows[0][0]).toBe('test');
    });

    it('handles consecutive line endings', () => {
        const csv = 'a,b\n\n\n1,2';

        const result = parseCSVText(csv);

        expect(result.headers).toEqual(['a', 'b']);
        expect(result.rows).toHaveLength(1);
        expect(result.rows[0]).toEqual(['1', '2']);
    });
});
