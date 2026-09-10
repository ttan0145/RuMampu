/* v22 CSV importer — a real in-app CSV parser ported verbatim from the
   prototype: auto-detects the delimiter, header row, and the date/amount/
   description columns. Pure functions; the screens drive the state. */

export interface ParsedCsv {
  headers: string[];
  rows: string[][];
  map: { d: number; a: number; desc: number };
  cols: number;
}

function isoOf(x: Date): string {
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
}

export function parseDateAny(v: string): string | null {
  v = (v || '').trim();
  let m: RegExpMatchArray | null;
  if ((m = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/))) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  if ((m = v.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/))) {
    const y = m[3].length === 2 ? '20' + m[3] : m[3];
    return `${y}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  }
  const t = Date.parse(v);
  if (!isNaN(t)) return isoOf(new Date(t));
  return null;
}

export function csvNumeric(v: string): boolean {
  return /^-?[\d,]*\.?\d+$/.test((v || '').replace(/^RM\s*/i, ''));
}

export function csvAmount(v: string): number {
  return Math.round(parseFloat((v || '').replace(/^RM\s*/i, '').replace(/,/g, '')) * 100) / 100;
}

export function parseCsv(text: string): ParsedCsv | null {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (!lines.length) return null;
  const delim = (lines[0].match(/;/g) || []).length > (lines[0].match(/,/g) || []).length ? ';' : ',';
  const split = (l: string) => {
    const out: string[] = [];
    let cur = '', q = false;
    for (const ch of l) {
      if (ch === '"') q = !q;
      else if (ch === delim && !q) { out.push(cur); cur = ''; }
      else cur += ch;
    }
    out.push(cur);
    return out.map(x => x.trim());
  };
  let rows = lines.map(split);
  const first = rows[0];
  const hasHeader = !first.some(csvNumeric) && !first.some(v => parseDateAny(v));
  const headers = hasHeader ? first : first.map((_, i) => 'Column ' + (i + 1));
  if (hasHeader) rows = rows.slice(1);
  const cols = headers.length;
  const score = (fn: (v: string) => boolean) => headers.map((_, c) => rows.filter(r => fn(r[c])).length);
  const ds = score(v => !!parseDateAny(v)), as = score(csvNumeric);
  const dCol = ds.indexOf(Math.max(...ds));
  const aCol = (() => { const s = as.map((v, i) => (i === dCol ? -1 : v)); return s.indexOf(Math.max(...s)); })();
  let descCol = headers.findIndex((_, c) => c !== dCol && c !== aCol && rows.some(r => r[c] && !csvNumeric(r[c]) && !parseDateAny(r[c])));
  if (descCol < 0) descCol = -1;
  return { headers, rows, map: { d: dCol, a: aCol, desc: descCol }, cols };
}

export const CSV_SAMPLE = 'date,amount,description\n2026-03-06,880,Grab weekly payout\n2026-03-13,927,Grab weekly payout\n2026-03-14,550,Freelance design\n2026-04-03,1010,Grab weekly payout\n2026-04-10,1150,Freelance project\n2026-05-08,1020,Grab weekly payout\n2026-05-15,780,Freelance design\n2026-06-05,940,Grab weekly payout\n2026-06-12,850,Freelance design\n2026-07-03,1030,Grab weekly payout\n2026-08-07,990,Grab weekly payout\n2026-08-14,720,foodpanda payout\n2026-08-21,1005,Grab weekly payout';

export const CSV_SAMPLE_EX = 'date,amount,description\n2026-08-02,12.50,Mamak Bistro\n2026-08-03,58.20,99 Speedmart\n2026-08-05,4.00,Touch n Go toll\n2026-08-08,21.00,Nasi Kandar Pelita\n2026-08-11,150.00,Family transfer\n2026-08-14,9.00,Parking KLCC\n2026-08-16,64.30,Lotus grocery\n2026-08-20,18.00,Kopitiam breakfast';
