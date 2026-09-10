import React from 'react';
import { SvgXml } from 'react-native-svg';
import { ISO_TIERS } from './village';

/* v22 isometric village tiles — SVG strings ported verbatim from the prototype,
   rendered through SvgXml. */

const ISO_GROUND =
  '<polygon points="60,102 112,76 60,50 8,76" fill="#A8CE9E"/>' +
  '<polygon points="60,102 112,76 112,83 60,109" fill="#86B07C"/>' +
  '<polygon points="60,102 8,76 8,83 60,109" fill="#6F9866"/>';

export const ISO_BODY: Record<string, string> = {
  pondok: '<polygon points="36,80 60,92 60,66 36,54" fill="#C89F63"/>' +
    '<polygon points="84,80 60,92 60,66 84,54" fill="#A87F45"/>' +
    '<polygon points="62,86 72,81 72,68 62,73" fill="#5B4226"/>' +
    '<polygon points="60,32 28,58 60,72" fill="#8A6A3E"/>' +
    '<polygon points="60,32 92,58 60,72" fill="#6E5330"/>' +
    '<circle cx="60" cy="32" r="3" fill="#5B4226"/>',
  kampung: '<polygon points="34,78 60,90 60,58 34,46" fill="#EBDCBC"/>' +
    '<polygon points="86,78 60,90 60,58 86,46" fill="#D3BE97"/>' +
    '<polygon points="60,26 24,44 34,52 60,38" fill="#6B8688"/>' +
    '<polygon points="60,26 96,44 86,52 60,38" fill="#52696B"/>' +
    '<polygon points="64,72 76,66 76,57 64,63" fill="#35494A"/>' +
    '<polygon points="42,73 52,78 52,64 42,59" fill="#7A5C33"/>',
  teres: '<polygon points="60,30 90,45 60,60 30,45" fill="#F0EAD9"/>' +
    '<polygon points="30,45 60,60 60,94 30,79" fill="#E6DFC9"/>' +
    '<polygon points="90,45 60,60 60,94 90,79" fill="#CEC5A8"/>' +
    '<polygon points="66,66 82,58 82,64 66,72" fill="#35494A"/>' +
    '<polygon points="66,78 82,70 82,76 66,84" fill="#35494A"/>' +
    '<polygon points="38,72 48,77 48,89 38,84" fill="#4E6668"/>',
  kondo: '<polygon points="60,22 86,35 60,48 34,35" fill="#DDEBEA"/>' +
    '<polygon points="34,35 60,48 60,98 34,85" fill="#7FA6AA"/>' +
    '<polygon points="86,35 60,48 60,98 86,85" fill="#5E878B"/>' +
    '<polygon points="64,58 82,49 82,54 64,63" fill="#DFF3F2" opacity=".9"/>' +
    '<polygon points="64,70 82,61 82,66 64,75" fill="#DFF3F2" opacity=".9"/>' +
    '<polygon points="64,82 82,73 82,78 64,87" fill="#DFF3F2" opacity=".9"/>' +
    '<polygon points="38,53 56,62 56,67 38,58" fill="#B9D2D3" opacity=".8"/>' +
    '<polygon points="38,65 56,74 56,79 38,70" fill="#B9D2D3" opacity=".8"/>',
  istana: '<polygon points="30,80 60,94 60,64 30,50" fill="#EFE6D2"/>' +
    '<polygon points="90,80 60,94 60,64 90,50" fill="#D8CBAC"/>' +
    '<polygon points="60,30 26,52 60,66" fill="#E7B93B"/>' +
    '<polygon points="60,30 94,52 60,66" fill="#C79612"/>' +
    '<polygon points="60,16 44,28 60,36" fill="#F2CD5C"/>' +
    '<polygon points="60,16 76,28 60,36" fill="#D9A81F"/>' +
    '<line x1="60" y1="16" x2="60" y2="4" stroke="#6B4F1F" stroke-width="2.4"/>' +
    '<polygon points="60,4 75,8 60,12" fill="#E24A1B"/>' +
    '<polygon points="64,84 76,78 76,66 64,72" fill="#6B4F2A"/>',
};

/* One tier on its ground tile (used by the legend). */
export function isoHouseXml(tierId: string): string {
  return `<svg viewBox="0 0 120 118" xmlns="http://www.w3.org/2000/svg">${ISO_GROUND}${ISO_BODY[tierId] || ''}</svg>`;
}

/* One contiguous isometric island: shared tile edges, a thick base, houses drawn back to front. */
export function isoIslandXml(cells: number[]): string {
  const cx = 220, cy = 165, tw = 52, th = 26, base = 16;
  const top = cy - 4 * th, right = cx + 4 * tw, bottom = cy + 4 * th, left = cx - 4 * tw;
  let s = '<svg viewBox="0 0 440 292" xmlns="http://www.w3.org/2000/svg">';
  s += `<polygon points="${left},${cy} ${cx},${bottom} ${cx},${bottom + base} ${left},${cy + base}" fill="#7FA275"/>`;
  s += `<polygon points="${right},${cy} ${cx},${bottom} ${cx},${bottom + base} ${right},${cy + base}" fill="#6B8F62"/>`;
  s += `<polygon points="${cx},${top} ${right},${cy} ${cx},${bottom} ${left},${cy}" fill="#B9D9AE"/>`;
  for (let k = 1; k < 4; k++) {
    s += `<line x1="${cx - k * tw}" y1="${cy + (k - 4) * th}" x2="${cx + (4 - k) * tw}" y2="${cy + k * th}" stroke="#A3C797" stroke-width="1.5"/>`;
    s += `<line x1="${cx + k * tw}" y1="${cy + (k - 4) * th}" x2="${cx - (4 - k) * tw}" y2="${cy + k * th}" stroke="#A3C797" stroke-width="1.5"/>`;
  }
  const order: number[] = [];
  for (let i = 0; i < 16; i++) if (cells[i]) order.push(i);
  order.sort((a, b) => (((a >> 2) + (a & 3)) - ((b >> 2) + (b & 3))) || ((a >> 2) - (b >> 2)));
  for (const i of order) {
    const r = i >> 2, c = i & 3, x = cx + (c - r) * tw, y = cy + (c + r - 3) * th;
    s += `<g transform="translate(${x - 60},${y - 76})">${ISO_BODY[ISO_TIERS[cells[i] - 1]]}</g>`;
  }
  return s + '</svg>';
}

export function IsoIsland({ cells, width }: { cells: number[]; width: number }) {
  return <SvgXml xml={isoIslandXml(cells)} width={width} height={width * 292 / 440} />;
}

export function IsoHouse({ tier, size }: { tier: string; size: number }) {
  return <SvgXml xml={isoHouseXml(tier)} width={size} height={size * 118 / 120} />;
}
