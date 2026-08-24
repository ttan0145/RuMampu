import React from 'react';
import { SvgXml } from 'react-native-svg';
import { C } from './theme';

/* SVG artwork ported verbatim from the prototype (logo, onboarding heroes, row icons). */

const LOGO_INNER =
  '<circle cx="50" cy="50" r="50" fill="#28343A"/>' +
  '<g transform="rotate(-42 50 50)">' +
  '<rect x="32" y="45.8" width="56" height="8.4" rx="4.2" fill="#FFFFFF"/>' +
  '<rect x="54" y="29" width="6" height="17" rx="3" fill="#4C9F58"/>' +
  '<rect x="63" y="35" width="6" height="11" rx="3" fill="#F4C64D"/>' +
  '<rect x="72" y="31" width="6" height="15" rx="3" fill="#4C9F58"/>' +
  '<rect x="81" y="38" width="6" height="8" rx="3" fill="#D95436"/>' +
  '<circle cx="32" cy="50" r="16.5" fill="#FFFFFF"/>' +
  '<path d="M32 43.5 L40 50 L40 57 L24 57 L24 50 Z" fill="#28343A"/>' +
  '</g>';

export function Logo({ size }: { size: number }) {
  const xml = `<svg width="${size}" height="${size}" viewBox="0 0 100 100">${LOGO_INNER}</svg>`;
  return <SvgXml xml={xml} width={size} height={size} />;
}

export const HERO = `<svg width="330" height="291" viewBox="0 0 470 415" fill="none" xmlns="http://www.w3.org/2000/svg">
<rect width="330" height="291" rx="18" fill="#EFEDE0"/>
<g>
  <circle cx="46" cy="34" r="13" fill="#28343A"/>
  <g transform="rotate(-42 46 34)">
    <rect x="41" y="32.9" width="15" height="2.2" rx="1.1" fill="#FFFFFF"/>
    <rect x="47" y="28.5" width="1.7" height="4.5" rx="0.8" fill="#4C9F58"/>
    <rect x="49.5" y="30" width="1.7" height="3" rx="0.8" fill="#F4C64D"/>
    <rect x="52" y="29" width="1.7" height="4" rx="0.8" fill="#4C9F58"/>
    <rect x="54.5" y="31" width="1.7" height="2.2" rx="0.8" fill="#D95436"/>
    <circle cx="41" cy="34" r="4.4" fill="#FFFFFF"/>
    <path d="M41 32.2 L43.2 34 L43.2 35.9 L38.8 35.9 L38.8 34 Z" fill="#28343A"/>
  </g>
  <text x="70" y="43" font-family="Helvetica Neue, Arial, sans-serif" font-weight="800" font-size="26" fill="#20262A">RuMampu</text>
</g>
<rect x="20" y="62" width="430" height="336" rx="16" fill="#F5F3E9"/>
<ellipse cx="402" cy="112" rx="82" ry="66" fill="#E9E6D4"/>
<ellipse cx="70" cy="372" rx="72" ry="44" fill="#E9E6D4"/>
<circle cx="235" cy="205" r="86" stroke="#E4E1CE" stroke-width="2"/>
<circle cx="235" cy="205" r="62" stroke="#E4E1CE" stroke-width="2"/>
<ellipse cx="238" cy="374" rx="112" ry="13" fill="#DDD9C8"/>
<g fill="#D9D5C4">
  <circle cx="88" cy="112" r="2.2"/><circle cx="98" cy="112" r="2.2"/><circle cx="108" cy="112" r="2.2"/>
  <circle cx="88" cy="122" r="2.2"/><circle cx="98" cy="122" r="2.2"/><circle cx="108" cy="122" r="2.2"/>
  <circle cx="88" cy="132" r="2.2"/><circle cx="98" cy="132" r="2.2"/><circle cx="108" cy="132" r="2.2"/>
  <circle cx="392" cy="348" r="2.2"/><circle cx="402" cy="348" r="2.2"/><circle cx="412" cy="348" r="2.2"/>
  <circle cx="392" cy="358" r="2.2"/><circle cx="402" cy="358" r="2.2"/><circle cx="412" cy="358" r="2.2"/>
  <circle cx="392" cy="368" r="2.2"/><circle cx="402" cy="368" r="2.2"/><circle cx="412" cy="368" r="2.2"/>
</g>
<path d="M128 84 l4.5 11 11 4.5 -11 4.5 -4.5 11 -4.5 -11 -11 -4.5 11 -4.5 Z" fill="#F0C24B"/>
<path d="M398 292 l3.4 8 8 3.4 -8 3.4 -3.4 8 -3.4 -8 -8 -3.4 8 -3.4 Z" fill="#F0C24B"/>
<circle cx="374" cy="120" r="6" fill="#CE8A70"/>
<circle cx="80" cy="292" r="5" fill="#8FA9AB"/>
<rect x="32" y="158" width="124" height="74" rx="11" fill="#2F6B4F"/>
<circle cx="54" cy="178" r="10.5" stroke="#F5F3E9" stroke-width="2.5"/>
<text x="54" y="182" text-anchor="middle" font-family="Arial, sans-serif" font-weight="700" font-size="9" fill="#F5F3E9">RM</text>
<circle cx="136" cy="178" r="9.5" stroke="#F5F3E9" stroke-width="2" stroke-dasharray="3 3"/>
<text x="136" y="181" text-anchor="middle" font-family="Arial, sans-serif" font-weight="700" font-size="7" fill="#F5F3E9">RM</text>
<rect x="72" y="172" width="42" height="5" rx="2.5" fill="#BFD2C4"/>
<rect x="72" y="182" width="50" height="5" rx="2.5" fill="#9FBCA8"/>
<rect x="46" y="208" width="62" height="5" rx="2.5" fill="#9FBCA8"/>
<g>
  <rect x="112" y="266" width="46" height="9" rx="4.5" fill="#2A3238"/>
  <rect x="120" y="250" width="7" height="17" rx="3.5" fill="#4C9F58"/>
  <rect x="131" y="255" width="7" height="12" rx="3.5" fill="#F4C64D"/>
  <rect x="142" y="252" width="7" height="15" rx="3.5" fill="#4C9F58"/>
  <rect x="153" y="258" width="7" height="9" rx="3.5" fill="#D95436"/>
  <circle cx="98" cy="271" r="24" fill="#2A3238"/>
  <path d="M98 259 L109 267.5 L104.5 280 L91.5 280 L87 267.5 Z" fill="#F5F3E9"/>
</g>
<path d="M150 336 Q168 306 218 300 L252 300 Q302 306 322 336 Q300 352 236 352 Q172 352 150 336 Z" fill="#3A4247"/>
<path d="M186 232 Q186 202 220 198 L252 198 Q286 202 286 232 L286 290 Q286 306 262 306 L210 306 Q186 306 186 290 Z" fill="#4CA24E"/>
<polyline points="188,268 202,254 216,268 230,254 244,268 258,254 272,268 284,258" stroke="#F4C64D" stroke-width="8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<g transform="rotate(-8 210 300)">
  <rect x="196" y="276" width="28" height="48" rx="7" fill="#2A3238"/>
  <rect x="201" y="286" width="12" height="4" rx="2" fill="#4C9F58"/>
  <rect x="201" y="294" width="16" height="4" rx="2" fill="#8C979B"/>
  <circle cx="207" cy="310" r="5" stroke="#F4C64D" stroke-width="2.5"/>
</g>
<circle cx="212" cy="280" r="9" fill="#E8B28A"/>
<rect x="227" y="188" width="17" height="14" rx="5" fill="#E8B28A"/>
<circle cx="236" cy="160" r="34" fill="#E9B489"/>
<circle cx="203" cy="164" r="6.5" fill="#E9B489"/>
<path d="M204 150 Q208 116 242 117 Q270 120 270 146 L270 152 Q238 138 204 156 Z" fill="#3E7C46"/>
<ellipse cx="199" cy="148" rx="8" ry="15" transform="rotate(-18 199 148)" fill="#2F6B3F"/>
<circle cx="264" cy="133" r="4.5" fill="#F4C64D"/>
<path d="M206 155 Q222 146 240 146 L240 152 Q224 152 208 160 Z" fill="#22282B"/>
<path d="M222 150 q6 -4 11 -1" stroke="#3B2F27" stroke-width="2.5" fill="none" stroke-linecap="round"/>
<path d="M246 148 q6 -3 10 0" stroke="#3B2F27" stroke-width="2.5" fill="none" stroke-linecap="round"/>
<circle cx="229" cy="160" r="2.8" fill="#33302C"/>
<circle cx="252" cy="158" r="2.8" fill="#33302C"/>
<path d="M231 174 Q241 182 253 172" stroke="#3B2F27" stroke-width="3" fill="none" stroke-linecap="round"/>
<circle cx="221" cy="170" r="4.5" fill="#E19A76" opacity="0.7"/>
<g>
  <rect x="318" y="138" width="126" height="114" rx="13" fill="#FFFFFF"/>
  <rect x="332" y="154" width="58" height="7" rx="3.5" fill="#D8D6CC"/>
  <path d="M414 150 L428 160 L428 172 L400 172 L400 160 Z" fill="#2F6B4F"/>
  <rect x="410" y="164" width="8" height="8" fill="#F5F3E9"/>
  <rect x="332" y="182" width="23" height="23" rx="6" fill="#D95436"/>
  <circle cx="343.5" cy="193.5" r="17" stroke="#F4C64D" stroke-width="4"/>
  <rect x="362" y="182" width="23" height="23" rx="6" fill="#3D7F84"/>
  <rect x="392" y="182" width="23" height="23" rx="6" fill="#3D7F84"/>
  <rect x="332" y="212" width="23" height="23" rx="6" fill="#3D7F84"/>
  <rect x="362" y="212" width="23" height="23" rx="6" fill="#F4C64D"/>
  <rect x="392" y="212" width="23" height="23" rx="6" fill="#3D7F84"/>
</g>
<path d="M280 238 Q318 214 344 206 L350 220 Q322 228 286 254 Z" fill="#4CA24E"/>
<circle cx="350" cy="212" r="10" fill="#E8B28A"/>
<g>
  <path d="M196 322 L280 322 L268 338 L208 338 Z" fill="#EDEBDF"/>
  <rect x="176" y="330" width="124" height="58" rx="9" fill="#FFFFFF"/>
  <path d="M196 344 q30 -10 60 0 q-24 8 -46 2" stroke="#C9C6B8" stroke-width="4" fill="none" stroke-linecap="round"/>
  <g fill="#2A3238">
    <rect x="190" y="362" width="3" height="16"/><rect x="196" y="362" width="2" height="16"/>
    <rect x="201" y="362" width="4" height="16"/><rect x="208" y="362" width="2" height="16"/>
    <rect x="213" y="362" width="3" height="16"/><rect x="219" y="362" width="2" height="16"/>
    <rect x="224" y="362" width="4" height="16"/><rect x="231" y="362" width="2" height="16"/>
  </g>
  <text x="288" y="377" text-anchor="end" font-family="Helvetica Neue, Arial, sans-serif" font-weight="700" font-size="17" fill="#2F6B4F">3,720</text>
</g>
</svg>`;

export const HERO2 = `<svg width="330" height="291" viewBox="0 0 470 415" fill="none" xmlns="http://www.w3.org/2000/svg">
<rect width="330" height="291" rx="18" fill="#EFEDE0"/>
<g><circle cx="46" cy="34" r="13" fill="#28343A"/>
<g transform="rotate(-42 46 34)"><rect x="41" y="32.9" width="15" height="2.2" rx="1.1" fill="#FFFFFF"/><rect x="47" y="28.5" width="1.7" height="4.5" rx="0.8" fill="#4C9F58"/><rect x="49.5" y="30" width="1.7" height="3" rx="0.8" fill="#F4C64D"/><rect x="52" y="29" width="1.7" height="4" rx="0.8" fill="#4C9F58"/><rect x="54.5" y="31" width="1.7" height="2.2" rx="0.8" fill="#D95436"/><circle cx="41" cy="34" r="4.4" fill="#FFFFFF"/><path d="M41 32.2 L43.2 34 L43.2 35.9 L38.8 35.9 L38.8 34 Z" fill="#28343A"/></g></g>
<text x="70" y="43" font-family="Helvetica Neue, Arial, sans-serif" font-weight="800" font-size="26" fill="#20262A">RuMampu</text>
<rect x="20" y="62" width="430" height="336" rx="16" fill="#F5F3E9"/>
<ellipse cx="90" cy="110" rx="70" ry="58" fill="#E9E6D4"/>
<ellipse cx="410" cy="360" rx="66" ry="42" fill="#E9E6D4"/>
<g fill="#D9D5C4"><circle cx="392" cy="100" r="2.2"/><circle cx="402" cy="100" r="2.2"/><circle cx="412" cy="100" r="2.2"/><circle cx="392" cy="110" r="2.2"/><circle cx="402" cy="110" r="2.2"/><circle cx="412" cy="110" r="2.2"/><circle cx="392" cy="120" r="2.2"/><circle cx="402" cy="120" r="2.2"/><circle cx="412" cy="120" r="2.2"/></g>
<g fill="#D9D5C4"><circle cx="60" cy="330" r="2.2"/><circle cx="70" cy="330" r="2.2"/><circle cx="80" cy="330" r="2.2"/><circle cx="60" cy="340" r="2.2"/><circle cx="70" cy="340" r="2.2"/><circle cx="80" cy="340" r="2.2"/><circle cx="60" cy="350" r="2.2"/><circle cx="70" cy="350" r="2.2"/><circle cx="80" cy="350" r="2.2"/></g>
<path d="M392 196 l4.1 10 10 4.1 -10 4.1 -4.1 10 -4.1 -10 -10 -4.1 10 -4.1 Z" fill="#F0C24B"/>
<path d="M120 300 l3.28 8 8 3.28 -8 3.28 -3.28 8 -3.28 -8 -8 -3.28 8 -3.28 Z" fill="#F0C24B"/>
<circle cx="378" cy="112" r="6" fill="#CE8A70"/>
<circle cx="66" cy="180" r="5" fill="#8FA9AB"/>
<ellipse cx="330" cy="374" rx="86" ry="12" fill="#DDD9C8"/>
<circle cx="240" cy="240" r="86" stroke="#E4E1CE" stroke-width="2"/>
<g>
  <rect x="52" y="140" width="200" height="164" rx="14" fill="#FFFFFF"/>
  <rect x="70" y="158" width="70" height="8" rx="4" fill="#D8D6CC"/>
  <rect x="70" y="252" width="24" height="34" rx="3" fill="#3C5152"/>
  <rect x="102" y="230" width="24" height="56" rx="3" fill="#3C5152"/>
  <rect x="134" y="216" width="24" height="70" rx="3" fill="#3C5152"/>
  <rect x="166" y="240" width="24" height="46" rx="3" fill="#3C5152"/>
  <rect x="198" y="222" width="24" height="64" rx="3" fill="#3C5152"/>
  <rect x="74" y="234" width="16" height="16" rx="2" fill="#D95436"/>
  <rect x="60" y="232" width="186" height="3.5" rx="1.75" fill="#3C5152"/>
  <path d="M246 230 l10 3.75 -10 3.75 Z" fill="#3C5152"/>
</g>
<g>
  <path d="M292 336 Q300 312 336 308 L360 308 Q392 312 398 336 L398 356 Q360 366 330 366 Q300 366 292 352 Z" fill="#3A4247"/>
  <path d="M296 240 Q296 216 322 212 L352 212 Q378 216 378 240 L378 300 Q378 316 356 316 L318 316 Q296 316 296 300 Z" fill="#4CA24E"/>
  <polyline points="298,278 310,266 322,278 334,266 346,278 358,266 370,278 376,272" stroke="#F4C64D" stroke-width="7" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M304 246 Q286 260 282 278 L296 284 Q302 268 312 258 Z" fill="#4CA24E"/>
  <circle cx="290" cy="284" r="9" fill="#E8B28A"/>
  <rect x="326" y="200" width="16" height="14" rx="5" fill="#E8B28A"/>
  <circle cx="334" cy="174" r="31" fill="#E9B489"/>
  <circle cx="304" cy="178" r="6" fill="#E9B489"/>
  <path d="M305 164 Q308 132 340 133 Q366 136 366 160 L366 166 Q336 152 305 170 Z" fill="#3E7C46"/>
  <ellipse cx="300" cy="162" rx="7" ry="14" transform="rotate(-18 300 162)" fill="#2F6B3F"/>
  <circle cx="361" cy="148" r="4.2" fill="#F4C64D"/>
    <path d="M320 163.5 q5 -2.8 9 -0.5" stroke="#3B2F27" stroke-width="2.4" fill="none" stroke-linecap="round"/>
  <path d="M343 163.5 q5 -2.8 9 -0.5" stroke="#3B2F27" stroke-width="2.4" fill="none" stroke-linecap="round"/>
  <circle cx="326" cy="174" r="2.6" fill="#33302C"/>
  <circle cx="348" cy="172" r="2.6" fill="#33302C"/>
  <path d="M330 188 Q338 194 348 186" stroke="#3B2F27" stroke-width="2.8" fill="none" stroke-linecap="round"/>
  <circle cx="318" cy="184" r="4" fill="#E19A76" opacity="0.7"/>
  <path d="M352 214 Q368 208 372 196 L360 190 Q356 200 346 206 Z" fill="#4CA24E"/>
  <circle cx="362" cy="190" r="8.5" fill="#E8B28A"/>
</g>
<g>
  <rect x="112" y="316" width="46" height="9" rx="4.5" fill="#2A3238" transform="rotate(8 112 316)"/>
  <circle cx="100" cy="320" r="20" fill="#2A3238"/>
  <path d="M100 310 L109 317 L105.5 327 L94.5 327 L91 317 Z" fill="#F5F3E9"/>
  <rect x="122" y="304" width="6" height="14" rx="3" fill="#4C9F58" transform="rotate(8 122 304)"/>
  <rect x="132" y="308" width="6" height="10" rx="3" fill="#F4C64D" transform="rotate(8 132 308)"/>
  <rect x="142" y="306" width="6" height="12" rx="3" fill="#4C9F58" transform="rotate(8 142 306)"/>
</g>
</svg>`;

export const HERO3 = `<svg width="330" height="291" viewBox="0 0 470 415" fill="none" xmlns="http://www.w3.org/2000/svg">
<rect width="330" height="291" rx="18" fill="#EFEDE0"/>
<g><circle cx="46" cy="34" r="13" fill="#28343A"/>
<g transform="rotate(-42 46 34)"><rect x="41" y="32.9" width="15" height="2.2" rx="1.1" fill="#FFFFFF"/><rect x="47" y="28.5" width="1.7" height="4.5" rx="0.8" fill="#4C9F58"/><rect x="49.5" y="30" width="1.7" height="3" rx="0.8" fill="#F4C64D"/><rect x="52" y="29" width="1.7" height="4" rx="0.8" fill="#4C9F58"/><rect x="54.5" y="31" width="1.7" height="2.2" rx="0.8" fill="#D95436"/><circle cx="41" cy="34" r="4.4" fill="#FFFFFF"/><path d="M41 32.2 L43.2 34 L43.2 35.9 L38.8 35.9 L38.8 34 Z" fill="#28343A"/></g></g>
<text x="70" y="43" font-family="Helvetica Neue, Arial, sans-serif" font-weight="800" font-size="26" fill="#20262A">RuMampu</text>
<rect x="20" y="62" width="430" height="336" rx="16" fill="#F5F3E9"/>
<ellipse cx="400" cy="118" rx="76" ry="60" fill="#E9E6D4"/>
<ellipse cx="66" cy="368" rx="66" ry="42" fill="#E9E6D4"/>
<g fill="#D9D5C4"><circle cx="84" cy="110" r="2.2"/><circle cx="94" cy="110" r="2.2"/><circle cx="104" cy="110" r="2.2"/><circle cx="84" cy="120" r="2.2"/><circle cx="94" cy="120" r="2.2"/><circle cx="104" cy="120" r="2.2"/><circle cx="84" cy="130" r="2.2"/><circle cx="94" cy="130" r="2.2"/><circle cx="104" cy="130" r="2.2"/></g>
<g fill="#D9D5C4"><circle cx="392" cy="346" r="2.2"/><circle cx="402" cy="346" r="2.2"/><circle cx="412" cy="346" r="2.2"/><circle cx="392" cy="356" r="2.2"/><circle cx="402" cy="356" r="2.2"/><circle cx="412" cy="356" r="2.2"/><circle cx="392" cy="366" r="2.2"/><circle cx="402" cy="366" r="2.2"/><circle cx="412" cy="366" r="2.2"/></g>
<path d="M126 86 l4.1 10 10 4.1 -10 4.1 -4.1 10 -4.1 -10 -10 -4.1 10 -4.1 Z" fill="#F0C24B"/>
<path d="M398 286 l3.28 8 8 3.28 -8 3.28 -3.28 8 -3.28 -8 -8 -3.28 8 -3.28 Z" fill="#F0C24B"/>
<circle cx="372" cy="112" r="6" fill="#CE8A70"/>
<circle cx="80" cy="290" r="5" fill="#8FA9AB"/>
<ellipse cx="238" cy="374" rx="112" ry="13" fill="#DDD9C8"/>
<circle cx="235" cy="215" r="86" stroke="#E4E1CE" stroke-width="2"/>
<circle cx="235" cy="215" r="62" stroke="#E4E1CE" stroke-width="2"/>
<g>
  <rect x="42" y="146" width="128" height="96" rx="12" fill="#FFFFFF"/>
  <rect x="56" y="140" width="8" height="14" rx="4" fill="#3C5152"/>
  <rect x="146" y="140" width="8" height="14" rx="4" fill="#3C5152"/>
  <rect x="56" y="166" width="100" height="6" rx="3" fill="#D8D6CC"/>
  <rect x="54" y="182" width="13" height="13" rx="3" fill="#4CA24E"/>
  <rect x="71" y="182" width="13" height="13" rx="3" fill="#4CA24E"/>
  <rect x="88" y="182" width="13" height="13" rx="3" fill="#4CA24E"/>
  <rect x="105" y="182" width="13" height="13" rx="3" fill="#4CA24E"/>
  <rect x="122" y="182" width="13" height="13" rx="3" fill="#4CA24E"/>
  <rect x="139" y="182" width="13" height="13" rx="3" fill="none" stroke="#C9C6B8" stroke-width="1.6"/>
  <rect x="54" y="202" width="13" height="13" rx="3" fill="none" stroke="#C9C6B8" stroke-width="1.6"/>
  <rect x="71" y="202" width="13" height="13" rx="3" fill="none" stroke="#C9C6B8" stroke-width="1.6"/>
  <rect x="88" y="202" width="13" height="13" rx="3" fill="none" stroke="#C9C6B8" stroke-width="1.6"/>
  <rect x="105" y="202" width="13" height="13" rx="3" fill="none" stroke="#C9C6B8" stroke-width="1.6"/>
  <rect x="122" y="202" width="13" height="13" rx="3" fill="none" stroke="#C9C6B8" stroke-width="1.6"/>
  <rect x="139" y="202" width="13" height="13" rx="3" fill="none" stroke="#C9C6B8" stroke-width="1.6"/>
</g>
<g>
  <rect x="306" y="150" width="132" height="58" rx="11" fill="#FFFFFF"/>
  <circle cx="330" cy="179" r="13" fill="#32B14A"/>
  <path d="M323 179 l5 5 9 -10" stroke="#FFFFFF" stroke-width="3.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  <rect x="352" y="168" width="52" height="7" rx="3.5" fill="#D8D6CC"/>
  <rect x="352" y="182" width="70" height="7" rx="3.5" fill="#4CA24E"/>
</g>
<circle cx="290" cy="132" r="12" fill="#F4C64D"/>
<circle cx="290" cy="132" r="7.5" stroke="#E0AC28" stroke-width="2.4"/>
<path d="M150 336 Q168 306 218 300 L252 300 Q302 306 322 336 Q300 352 236 352 Q172 352 150 336 Z" fill="#3A4247"/>
<path d="M186 232 Q186 202 220 198 L252 198 Q286 202 286 232 L286 290 Q286 306 262 306 L210 306 Q186 306 186 290 Z" fill="#4CA24E"/>
<polyline points="188,268 202,254 216,268 230,254 244,268 258,254 272,268 284,258" stroke="#F4C64D" stroke-width="8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<g>
  <rect x="216" y="262" width="40" height="62" rx="8" fill="#2A3238"/>
  <rect x="223" y="274" width="18" height="5" rx="2.5" fill="#4C9F58"/>
  <rect x="223" y="284" width="24" height="5" rx="2.5" fill="#8C979B"/>
  <circle cx="236" cy="306" r="7" stroke="#F4C64D" stroke-width="2.6"/>
</g>
<circle cx="212" cy="290" r="9" fill="#E8B28A"/>
<circle cx="262" cy="290" r="9" fill="#E8B28A"/>
<rect x="227" y="188" width="17" height="14" rx="5" fill="#E8B28A"/>
<circle cx="236" cy="160" r="34" fill="#E9B489"/>
<circle cx="203" cy="164" r="6.5" fill="#E9B489"/>
<path d="M204 150 Q208 116 242 117 Q270 120 270 146 L270 152 Q238 138 204 156 Z" fill="#3E7C46"/>
<ellipse cx="199" cy="148" rx="8" ry="15" transform="rotate(-18 199 148)" fill="#2F6B3F"/>
<circle cx="264" cy="133" r="4.5" fill="#F4C64D"/>
<path d="M222 150 q5.5 -3 10 -0.5" stroke="#3B2F27" stroke-width="2.5" fill="none" stroke-linecap="round"/>
<path d="M246 150 q5.5 -3 10 -0.5" stroke="#3B2F27" stroke-width="2.5" fill="none" stroke-linecap="round"/>
<circle cx="229" cy="160" r="2.8" fill="#33302C"/>
<circle cx="252" cy="158" r="2.8" fill="#33302C"/>
<path d="M231 174 Q241 182 253 172" stroke="#3B2F27" stroke-width="3" fill="none" stroke-linecap="round"/>
<circle cx="221" cy="170" r="4.5" fill="#E19A76" opacity="0.7"/>
</svg>`;

export const HEROES = [HERO, HERO2, HERO3];

export function Hero({ index, width }: { index: number; width: number }) {
  const h = Math.round((width / 330) * 291);
  return <SvgXml xml={HEROES[index] || HERO} width={width} height={h} />;
}

/* Row icons — stroke line art, 24x24 viewBox, matching .rowico styling. */
const ICONS: Record<string, string> = {
  banknote: '<rect x="2.5" y="6.5" width="19" height="11.5" rx="2"/><circle cx="12" cy="12.2" r="2.7"/><path d="M6 10v4.4M18 10v4.4"/>',
  wrench: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>',
  calendar: '<rect x="3" y="4.5" width="18" height="17" rx="2"/><path d="M16 2.5v4M8 2.5v4M3 10.5h18M8 15h3"/>',
  receipt: '<path d="M6 2.8h12v18.4l-2-1.6-2 1.6-2-1.6-2 1.6-2-1.6-2 1.6z"/><path d="M9 8h6M9 12h6"/>',
  bars: '<path d="M5.5 20V13M12 20V4.5M18.5 20v-9.5"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M16.3 16.3L21 21"/>',
  book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2.5H20v19H6.5A2.5 2.5 0 0 1 4 19V5a2.5 2.5 0 0 1 2.5-2.5z"/>',
  wallet: '<rect x="2.5" y="5.5" width="19" height="14.5" rx="2.5"/><path d="M2.5 10h19"/><circle cx="16.8" cy="15" r="1.3"/>',
  ring: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3.8"/><path d="M5.7 5.7l3.6 3.6M14.7 14.7l3.6 3.6M18.3 5.7l-3.6 3.6M9.3 14.7l-3.6 3.6"/>',
  file: '<path d="M14 2.5H6.5A1.5 1.5 0 0 0 5 4v16a1.5 1.5 0 0 0 1.5 1.5h11A1.5 1.5 0 0 0 19 20V7.5z"/><path d="M14 2.5V8h5M9 12h6M9 16h6"/>',
  band: '<path d="M4 12h16"/><path d="M4 8.5v7M20 8.5v7"/><circle cx="12" cy="12" r="2.4"/>',
  columns: '<path d="M3.5 20h17"/><rect x="5" y="9" width="3.6" height="8" rx="1.2"/><rect x="10.2" y="5.5" width="3.6" height="11.5" rx="1.2"/><rect x="15.4" y="11.5" width="3.6" height="5.5" rx="1.2"/>',
  trend: '<path d="M21.5 17.5L13 9l-4 4-6.5-6.5"/><path d="M16 17.5h5.5V12"/>',
  camera: '<path d="M3 7.5a1.5 1.5 0 0 1 1.5-1.5h2.6L9 3.5h6L16.9 6h2.6A1.5 1.5 0 0 1 21 7.5V18a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18z"/><circle cx="12" cy="12.5" r="3.6"/>',
  calsum: '<rect x="3" y="4.5" width="18" height="17" rx="2"/><path d="M16 2.5v4M8 2.5v4M3 10.5h18"/><path d="M8 17.5v-3M12 17.5v-4.5M16 17.5v-2"/>',
  gauge: '<path d="M5 19a9 9 0 1 1 14 0"/><path d="M12 13.5l3.5-4"/><circle cx="12" cy="14" r="1.6"/>',
  eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
  calday: '<rect x="3" y="4.5" width="18" height="17" rx="2"/><path d="M16 2.5v4M8 2.5v4M3 10.5h18"/><circle cx="12" cy="15.5" r="1.6"/>',
  swap: '<path d="M17 3.5l4 4-4 4"/><path d="M21 7.5H8"/><path d="M7 12.5l-4 4 4 4"/><path d="M3 16.5h13"/>',
};

export type IconName = keyof typeof ICONS & string;

export function Ico({ name, size = 22 }: { name: string; size?: number }) {
  const xml = `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${C.ink}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICONS[name] || ''}</svg>`;
  return <SvgXml xml={xml} width={size} height={size} />;
}
