// Behind the Vial: tiny inline stroke icons drawn for this project (no third-party set).
// 24×24 grid, 1.6 px stroke, currentColor. Always decorative (aria-hidden).
import { raw } from './util.js';

const P = {
  phone: '<path d="M6.6 3.5h2.6l1.5 4.2-2 1.4a12 12 0 0 0 6.2 6.2l1.4-2 4.2 1.5v2.6a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 4.6 5.7a2 2 0 0 1 2-2.2Z"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  alert: '<path d="M10.3 4.2 2.9 17.5A2 2 0 0 0 4.6 20.5h14.8a2 2 0 0 0 1.7-3L13.7 4.2a2 2 0 0 0-3.4 0Z"/><path d="M12 9.5v4.2"/><path d="M12 17h.01"/>',
  target: '<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2.2"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3"/>',
  arrow: '<path d="M4.5 12h14"/><path d="m13 6.5 5.5 5.5-5.5 5.5"/>',
  external: '<path d="M14 4.5h5.5V10"/><path d="M19.5 4.5 11 13"/><path d="M17.5 13.5v4.5a1.5 1.5 0 0 1-1.5 1.5H6A1.5 1.5 0 0 1 4.5 18V8A1.5 1.5 0 0 1 6 6.5h4.5"/>',
  info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5"/><path d="M12 7.9h.01"/>',
  flask: '<path d="M9.5 3.5h5"/><path d="M10.5 3.5v5.2L5.3 17.6A2 2 0 0 0 7 20.5h10a2 2 0 0 0 1.7-2.9l-5.2-8.9V3.5"/><path d="M7.6 14.5h8.8"/>',
  question: '<circle cx="12" cy="12" r="8.5"/><path d="M9.6 9.5a2.5 2.5 0 1 1 3.4 2.3c-.6.3-1 .8-1 1.5v.4"/><path d="M12 16.6h.01"/>',
  lock: '<rect x="5" y="10.5" width="14" height="9.5" rx="2"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>',
  progress: '<path d="M12 3.5a8.5 8.5 0 1 1-8.5 8.5"/><path d="M12 7.5V12l2.8 1.8"/>',
  quote: '<path d="M5 18.5h3.5l1.5-4V7.5H4.5v7H7"/><path d="M14 18.5h3.5l1.5-4V7.5h-5.5v7H16"/>',
  message: '<path d="M4.5 6.5A2 2 0 0 1 6.5 4.5h11a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H10l-4.5 3.5v-3.5h0a1 1 0 0 1-1-1Z"/>',
  layers: '<path d="m12 4 8.5 4.5L12 13 3.5 8.5Z"/><path d="m3.5 12.5 8.5 4.5 8.5-4.5"/>',
  vial: '<path d="M9 3.5h6"/><path d="M10 3.5v14a2 2 0 0 0 4 0v-14"/><path d="M10 11h4"/>',
  eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="2.8"/>',
  list: '<path d="M9 6.5h11M9 12h11M9 17.5h11"/><path d="M4.5 6.5h.01M4.5 12h.01M4.5 17.5h.01"/>',
};

/** icon('phone') → Safe <svg>. size in px. */
export function icon(name, { size = 18, cls = '' } = {}) {
  const body = P[name] || P.info;
  return raw(`<svg class="c-ico${cls ? ` ${cls}` : ''}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`);
}

/** Small front-view body glyph with one region lit: 'abdomen' | 'thigh' | 'arm'. Decorative. */
export function bodyGlyph(site, { size = 56 } = {}) {
  const regions = {
    abdomen: '<ellipse cx="24" cy="37.5" rx="6.2" ry="5.2"/>',
    thigh: '<ellipse cx="18.6" cy="57" rx="3.6" ry="7.2"/>',
    arm: '<ellipse cx="11.6" cy="27.5" rx="2.9" ry="6"/>',
  };
  const dot = { abdomen: [24, 37.5], thigh: [18.6, 57], arm: [11.6, 27.5] }[site] || [24, 37.5];
  const w = Math.round(size * 48 / 88);
  return raw(`<svg class="c-glyph" width="${w}" height="${size}" viewBox="0 0 48 88" aria-hidden="true" focusable="false">
  <g class="c-glyph__body">
    <circle cx="24" cy="8" r="5.6"/>
    <path d="M17.2 16.4c4.4-1.6 9.2-1.6 13.6 0 1.6.6 2.6 2.1 2.5 3.8l-.9 24.6c-.1 1.6-1.2 2.9-2.8 3.2-2.4.5-5 .6-7.6.6s-5.2-.1-7.6-.6c-1.6-.3-2.7-1.6-2.8-3.2l-.9-24.6c-.1-1.7.9-3.2 2.5-3.8Z"/>
    <path d="M13.6 19.4 10.2 34l-1.4 14.5" class="c-glyph__limb"/>
    <path d="M34.4 19.4 37.8 34l1.4 14.5" class="c-glyph__limb"/>
    <path d="M19.4 47.5 18.4 66l-.2 17" class="c-glyph__leg"/>
    <path d="M28.6 47.5 29.6 66l.2 17" class="c-glyph__leg"/>
  </g>
  <g class="c-glyph__region">${regions[site] || ''}</g>
  <circle class="c-glyph__dot" cx="${dot[0]}" cy="${dot[1]}" r="1.5"/>
</svg>`);
}
