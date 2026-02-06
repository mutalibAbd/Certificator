/**
 * Unified data file parser for CSV and Excel files.
 * Returns a common { headers, rows } format regardless of input type.
 *
 * NOTE: xlsx (SheetJS, ~1MB) is loaded lazily only when an Excel file
 * is actually selected.  CSV parsing is zero-dependency.
 */

export interface ParsedData {
  headers: string[];
  rows: string[][];
}

/**
 * Parse a data file (CSV or Excel) into headers and rows.
 * Detects file type by extension.
 */
export async function parseDataFile(file: File): Promise<ParsedData> {
  const ext = file.name.split('.').pop()?.toLowerCase() || '';

  if (ext === 'csv') {
    const text = await file.text();
    return parseCSVText(text);
  }

  if (ext === 'xlsx' || ext === 'xls') {
    const buffer = await file.arrayBuffer();
    return parseExcelBuffer(buffer);
  }

  throw new Error(`Unsupported file type: .${ext}. Please use CSV or Excel (.xlsx) files.`);
}

/* -------------------------------------------------------------------------- */
/*  CSV Parser (zero-dependency, RFC 4180 compliant)                           */
/* -------------------------------------------------------------------------- */

/**
 * Parse CSV text into headers and rows.
 *
 * Handles:
 * - Comma delimiters
 * - Quoted fields (fields wrapped in double quotes)
 * - Escaped quotes ("" -> ")
 * - Mixed line endings (\r\n, \n, \r)
 * - Empty fields
 * - Skips empty lines
 */
export function parseCSVText(text: string): ParsedData {
  const rows: string[][] = [];
  let current = 0;
  const len = text.length;

  while (current < len) {
    const { fields, nextPos } = parseLine(text, current);
    current = nextPos;

    // Skip empty lines (lines with a single empty field)
    if (fields.length === 1 && fields[0] === '') {
      continue;
    }

    rows.push(fields);
  }

  if (rows.length === 0) {
    return { headers: [], rows: [] };
  }

  const headers = rows[0];
  const dataRows = rows.slice(1);

  return { headers, rows: dataRows };
}

/**
 * Parse a single CSV line starting at position `start`.
 * Returns the parsed fields and the position after the line ending.
 */
function parseLine(
  text: string,
  start: number,
): { fields: string[]; nextPos: number } {
  const fields: string[] = [];
  let pos = start;
  const len = text.length;

  while (pos <= len) {
    if (pos === len) {
      // End of text — push empty field if we just passed a comma
      if (pos > start && text[pos - 1] === ',') {
        fields.push('');
      } else if (fields.length === 0) {
        // Reached end with nothing parsed on this line
        fields.push('');
      }
      break;
    }

    const ch = text[pos];

    // Check for line ending (this line is done)
    if (ch === '\r' || ch === '\n') {
      // If we haven't parsed any fields yet, push an empty one to signal empty line
      if (fields.length === 0) {
        fields.push('');
      }
      // Skip past the line ending
      if (ch === '\r' && pos + 1 < len && text[pos + 1] === '\n') {
        pos += 2;
      } else {
        pos += 1;
      }
      return { fields, nextPos: pos };
    }

    // Parse the next field
    if (ch === '"') {
      // Quoted field
      const { value, nextPos } = parseQuotedField(text, pos);
      fields.push(value);
      pos = nextPos;
    } else {
      // Unquoted field
      const { value, nextPos } = parseUnquotedField(text, pos);
      fields.push(value);
      pos = nextPos;
    }

    // After a field, expect comma or end-of-line
    if (pos < len && text[pos] === ',') {
      pos++; // skip comma
      // If comma is the last character before EOL or EOF, there's a trailing empty field
      if (pos >= len || text[pos] === '\r' || text[pos] === '\n') {
        fields.push('');
      }
    }
  }

  return { fields, nextPos: len };
}

/**
 * Parse a quoted field starting at position `start` (which points to the opening quote).
 * Handles escaped quotes ("").
 */
function parseQuotedField(
  text: string,
  start: number,
): { value: string; nextPos: number } {
  let pos = start + 1; // skip opening quote
  const len = text.length;
  let value = '';

  while (pos < len) {
    const ch = text[pos];

    if (ch === '"') {
      // Check for escaped quote ""
      if (pos + 1 < len && text[pos + 1] === '"') {
        value += '"';
        pos += 2;
      } else {
        // Closing quote
        pos += 1;
        return { value, nextPos: pos };
      }
    } else {
      value += ch;
      pos += 1;
    }
  }

  // Reached end of text without closing quote — return what we have
  return { value, nextPos: pos };
}

/**
 * Parse an unquoted field starting at position `start`.
 * Reads until comma, line ending, or end of text.
 */
function parseUnquotedField(
  text: string,
  start: number,
): { value: string; nextPos: number } {
  let pos = start;
  const len = text.length;

  while (pos < len) {
    const ch = text[pos];
    if (ch === ',' || ch === '\r' || ch === '\n') {
      break;
    }
    pos++;
  }

  return { value: text.slice(start, pos), nextPos: pos };
}

/* -------------------------------------------------------------------------- */
/*  Excel Parser (using SheetJS / xlsx)                                        */
/* -------------------------------------------------------------------------- */

/**
 * Parse an Excel file buffer into headers and rows.
 *
 * Reads the first sheet from the workbook and converts all values to strings.
 * Throws if the sheet has fewer than 1 header row + 1 data row.
 */
export async function parseExcelBuffer(buffer: ArrayBuffer): Promise<ParsedData> {
  const XLSX = await import('xlsx');
  const workbook = XLSX.read(buffer, { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];

  if (!firstSheetName) {
    throw new Error('The Excel file contains no sheets.');
  }

  const sheet = workbook.Sheets[firstSheetName];
  const raw = XLSX.utils.sheet_to_json<string[]>(sheet, {
    header: 1,
    raw: false,
    defval: '',
  });

  if (raw.length === 0) {
    throw new Error('The Excel file is empty.');
  }

  // Convert all values to strings
  const allRows = raw.map((row) => row.map((cell) => String(cell)));

  const headers = allRows[0];
  const dataRows = allRows.slice(1);

  if (headers.length === 0) {
    throw new Error('Could not parse headers from the Excel file.');
  }

  if (dataRows.length === 0) {
    throw new Error('The Excel file contains headers but no data rows.');
  }

  return { headers, rows: dataRows };
}
