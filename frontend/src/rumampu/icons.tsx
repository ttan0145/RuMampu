import React from 'react';
import { SvgXml } from 'react-native-svg';
import { AppData } from './mock';

/* v22 line icons for income sources and expense categories, keyed by the
   prototype ids (backend rows carry a slug through `k`, e.g. src_ehail).
   Anything unrecognised falls back to the briefcase / tag icon. */

export const SRC_ICO: Record<string, string> = {
  ehail: '<path d="M4 15.5 5.5 10h13l1.5 5.5"/><rect x="3" y="15.5" width="18" height="4" rx="1.5"/><circle cx="7.5" cy="19.5" r="1.5"/><circle cx="16.5" cy="19.5" r="1.5"/>',
  freelance: '<rect x="4" y="5" width="16" height="11" rx="2"/><path d="M2 19h20"/>',
  parttime: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  deliv: '<circle cx="7" cy="17" r="3"/><circle cx="18" cy="17" r="3"/><path d="M7 17l3.5-7H15l3 7"/><rect x="13" y="4" width="7" height="5" rx="1"/>',
  bar: '<path d="M5 4h14l-7 8z"/><path d="M12 12v7M8 19h8"/>',
  own: '<rect x="3" y="7" width="18" height="12" rx="2"/><path d="M9 7V5h6v2M3 12h18"/>',
};

export const CAT_ICO: Record<string, string> = {
  meals: '<path d="M7 3v8M5 3v4a2 2 0 0 0 4 0V3M7 11v10"/><path d="M17 3c-2 0-3 2.5-3 5v3h3v10"/>',
  groc: '<path d="M3 4h2l2.4 11h11l2-8H6.5"/><circle cx="9" cy="19.5" r="1.5"/><circle cx="17" cy="19.5" r="1.5"/>',
  transp: '<path d="M4 15.5 5.5 10h13l1.5 5.5"/><rect x="3" y="15.5" width="18" height="4" rx="1.5"/><circle cx="7.5" cy="19.5" r="1.5"/><circle cx="16.5" cy="19.5" r="1.5"/>',
  family: '<circle cx="9" cy="8" r="3"/><circle cx="17" cy="9.5" r="2.3"/><path d="M3.5 19c.6-3.4 2.7-5.5 5.5-5.5s4.9 2.1 5.5 5.5M14.5 19c.3-2.2 1.4-3.6 2.8-3.6s2.5 1.4 2.8 3.6"/>',
  other: '<circle cx="6" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="18" cy="12" r="1.5"/>',
  own: '<path d="M3.5 12.5 12.5 3.5H20v7.5l-9 9z"/><circle cx="16" cy="8" r="1.3"/>',
};

function lineSvg(paths: string, size: number, color: string, strokeWidth = 1.8): string {
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="${color}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg">${paths}</svg>`;
}

/* Backend rows use numeric ids with a slug in `k` (src_xxx / xc_xxx); resolve either. */
function slugOf(data: { id: string; k?: string }[] | undefined, id: string, prefix: string): string {
  if (!data) return id;
  const row = data.find(x => x.id === id);
  const k = row?.k;
  return k && k.startsWith(prefix) ? k.slice(prefix.length) : id;
}

export function SrcIcon({ id, data, size = 20, color = '#3C5152' }: {
  id: string; data?: AppData; size?: number; color?: string;
}) {
  const slug = slugOf(data?.sources, id, 'src_');
  return <SvgXml xml={lineSvg(SRC_ICO[slug] || SRC_ICO.own, size, color)} width={size} height={size} />;
}

export function CatIcon({ id, data, size = 20, color = '#3C5152' }: {
  id: string; data?: AppData; size?: number; color?: string;
}) {
  const slug = slugOf(data?.expenseCats, id, 'xc_');
  return <SvgXml xml={lineSvg(CAT_ICO[slug] || CAT_ICO.own, size, color)} width={size} height={size} />;
}

/* v22 merchant classifiers used by the CSV importer and scan flows. */
export function guessCat(text: string): string {
  const s = (text || '').toLowerCase();
  if (/mamak|restaurant|restoran|cafe|kopitiam|food|makan|nasi|mcd|kfc|grabfood|foodpanda|warung|bakery/.test(s)) return 'meals';
  if (/grocer|mart|tesco|lotus|aeon|giant|99|speedmart|mydin|pasar|jaya|supermarket/.test(s)) return 'groc';
  if (/toll|touch|parking|park|petrol|shell|petronas|lrt|mrt|rapid|grab|bus/.test(s)) return 'transp';
  if (/family|keluarga|mak|ayah|mum|dad|school|sekolah/.test(s)) return 'family';
  return 'other';
}

export function guessSrc(text: string, sources: { id: string; k?: string }[], fallback: string): string {
  const s = (text || '').toLowerCase();
  const bySlug = (slug: string) => sources.find(x => x.id === slug || x.k === 'src_' + slug)?.id;
  if (/panda|deliver|lalamove|grabfood|shopee|courier/.test(s) && bySlug('deliv')) return bySlug('deliv')!;
  if (/grab|ehail|taxi|ride|maxim|indrive/.test(s) && bySlug('ehail')) return bySlug('ehail')!;
  if (/free|upwork|fiverr|design|project|client/.test(s) && bySlug('freelance')) return bySlug('freelance')!;
  if (/part|salary|gaji|wage/.test(s) && bySlug('parttime')) return bySlug('parttime')!;
  return fallback;
}
