import type { CSSProperties } from 'react';

const P: Record<string, string> = {
  wallet: '<rect x="3" y="6" width="18" height="13" rx="2.5"/><path d="M3 10h18"/><circle cx="16.5" cy="14.5" r="1.3"/>',
  stack: '<rect x="3" y="14" width="5.5" height="7" rx="1"/><rect x="9.2" y="9" width="5.5" height="12" rx="1"/><rect x="15.5" y="4" width="5.5" height="17" rx="1"/>',
  grid2: '<rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.5"/>',
  hour: '<path d="M7 3h10"/><path d="M7 21h10"/><path d="M8 3v3.5L12 11l4-4.5V3"/><path d="M8 21v-3.5L12 13l4 4.5V21"/>',
  fuel: '<rect x="4" y="7" width="9" height="13" rx="1.6"/><path d="M4 11h9"/><path d="M13 10h3.2a2 2 0 012 2v4.4a1.6 1.6 0 003.2 0V9.4L18.6 6"/>',
  flame: '<path d="M12 3s5 4.2 5 8.6a5 5 0 01-10 0C7 8.6 9.6 6.4 12 3z"/><path d="M12 20a2.6 2.6 0 01-2.6-2.6c0-1.6 2.6-3.6 2.6-3.6s2.6 2 2.6 3.6A2.6 2.6 0 0112 20z"/>',
  lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8.5 11V8.2a3.5 3.5 0 017 0V11"/>',
  target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.8"/><circle cx="12" cy="12" r="1.3"/>',
  wrench: '<path d="M14.7 6.3a4 4 0 00-5.4 5.2L4 16.8 7.2 20l5.3-5.3a4 4 0 005.2-5.4l-2.5 2.5-2.1-2.1z"/>',
  doc: '<path d="M7 3h7l4 4v13a1 1 0 01-1 1H7a1 1 0 01-1-1V4a1 1 0 011-1z"/><path d="M14 3v4h4"/><path d="M9 13h6"/><path d="M9 17h4"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.6 1.6 0 00-2.7 1.1v.3a2 2 0 01-4 0v-.1a1.6 1.6 0 00-2.8-1.1l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.6 1.6 0 00-1.1-2.7H3a2 2 0 010-4h.1a1.6 1.6 0 001.1-2.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.6 1.6 0 002.7-1.1V3a2 2 0 014 0v.1a1.6 1.6 0 002.8 1.1l.1-.1a2 2 0 112.8 2.8l-.1.1a1.6 1.6 0 001.1 2.7h.3a2 2 0 010 4h-.1a1.6 1.6 0 00-1.5 1z"/>',
  coins: '<circle cx="9" cy="9" r="5.5"/><path d="M14.5 5.2a5.5 5.5 0 010 11"/><path d="M9 6.5v5"/><path d="M7.2 8h3.2"/>',
  drum: '<ellipse cx="12" cy="6" rx="7" ry="2.6"/><path d="M5 6v12c0 1.4 3.1 2.6 7 2.6s7-1.2 7-2.6V6"/><path d="M5 12c0 1.4 3.1 2.6 7 2.6s7-1.2 7-2.6"/>',
  pkg: '<path d="M12 3l8 4.2v9.6L12 21l-8-4.2V7.2z"/><path d="M4 7.2l8 4.2 8-4.2"/><path d="M12 11.4V21"/>',
  clip: '<rect x="6" y="4" width="12" height="17" rx="2"/><path d="M9.5 4V2.8h5V4"/><path d="M9 10h6"/><path d="M9 14h4"/>',
  speed: '<path d="M4.5 18a8.5 8.5 0 1115 0"/><path d="M12 18l4.2-4.8"/><circle cx="12" cy="18" r="1.3"/>',
  hand: '<path d="M9 11V5.5a1.5 1.5 0 013 0V11"/><path d="M12 11V4.5a1.5 1.5 0 013 0V11"/><path d="M15 11V6.5a1.5 1.5 0 013 0V15a6 6 0 01-6 6h-1a6 6 0 01-6-6v-3.5a1.5 1.5 0 013 0"/>',
  pctg: '<circle cx="7" cy="7" r="2.6"/><circle cx="17" cy="17" r="2.6"/><path d="M19 5L5 19"/>',
  rupee: '<path d="M6 4h12"/><path d="M6 8h12"/><path d="M6 4a5 5 0 010 8h-2l8 8"/>',
  flask: '<path d="M9 3h6"/><path d="M10 3v6L5 19a1 1 0 001 1.5h12A1 1 0 0019 19l-5-10V3"/>',
  fact: '<path d="M3 20V10l5 3V10l5 3V7l6 4v9z"/><path d="M3 20h18"/>',
  layers: '<path d="M12 3l9 4.5-9 4.5-9-4.5z"/><path d="M3 12l9 4.5 9-4.5"/>',
  truck: '<rect x="2" y="7" width="12" height="9" rx="1.5"/><path d="M14 10h4l3 3v3h-7z"/><circle cx="6.5" cy="18" r="1.6"/><circle cx="17" cy="18" r="1.6"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',
  plug: '<path d="M9 2v6"/><path d="M15 2v6"/><path d="M7 8h10v3a5 5 0 01-10 0z"/><path d="M12 16v6"/>',
  rise: '<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
  bulb: '<path d="M9 18h6"/><path d="M10 22h4"/><path d="M12 2a7 7 0 00-4 12.7c.6.5 1 1.2 1 2.3h6c0-1.1.4-1.8 1-2.3A7 7 0 0012 2z"/>',
  check: '<path d="M4 12.5l5 5L20 6.5"/>',
  spark: '<path d="M12 2l2.2 6.4L20.6 10l-6.4 1.6L12 18l-2.2-6.4L3.4 10l6.4-1.6z"/>',
  back: '<path d="M19 12H5"/><path d="M11 18l-6-6 6-6"/>',
  chev: '<path d="M9 6l6 6-6 6"/>',
  down: '<path d="M6 9l6 6 6-6"/>',
  close: '<path d="M6 6l12 12"/><path d="M18 6L6 18"/>',
  bell: '<path d="M6 9a6 6 0 1112 0v5l2 3H4l2-3z"/><path d="M10 20a2 2 0 004 0"/>',
  cal: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18"/><path d="M8 3v4"/><path d="M16 3v4"/>',
  plant: '<path d="M3 21V10l5 3V10l5 3V7l6 4v10z"/><path d="M3 21h18"/>',
  type: '<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>',
  speaker: '<path d="M4 9v6h4l6 5V4l-6 5z"/><path d="M17 9a4 4 0 010 6"/>',
  stop: '<rect x="6" y="6" width="12" height="12" rx="2"/>',
  export: '<path d="M12 3v12"/><path d="M8 7l4-4 4 4"/><path d="M5 15v4h14v-4"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3.5 6.5l8.5 6.5 8.5-6.5"/>',
  sub: '<path d="M4 5h11a4 4 0 010 8H8"/><path d="M11 16l-3-3 3-3"/><circle cx="19" cy="18" r="2.4"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-6 6"/>',
  pdf: '<path d="M7 3h7l4 4v13H7z"/><path d="M14 3v4h4"/>',
  slide: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M12 16v4"/><path d="M8 20h8"/>',
  max: '<path d="M4 9V4h5"/><path d="M20 15v5h-5"/><path d="M15 4h5v5"/><path d="M9 20H4v-5"/>',
  min: '<path d="M9 4v5H4"/><path d="M15 20v-5h5"/><path d="M20 9h-5V4"/><path d="M4 15h5v5"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0014 0"/><path d="M12 18v3"/>',
  send: '<path d="M4 12l16-8-6 16-3-7-7-1z"/>',
  attach: '<path d="M20.5 11.5l-8.2 8.2a5 5 0 01-7.1-7.1l8.6-8.6a3.4 3.4 0 014.8 4.8l-8.6 8.6a1.7 1.7 0 01-2.4-2.4l7.9-7.9"/>',
  sheet: '<rect x="3.5" y="3.5" width="17" height="17" rx="2"/><path d="M3.5 9h17"/><path d="M3.5 14.5h17"/><path d="M9.5 3.5v17"/>',
  history: '<path d="M3.5 12a8.5 8.5 0 102.5-6"/><path d="M3.5 4.5V8H7"/><path d="M12 7.5V12l3 2"/>',
  pencil: '<path d="M14.5 5.5l4 4"/><path d="M4 20l1-4.5L15.8 4.7a1.8 1.8 0 012.5 0l1 1a1.8 1.8 0 010 2.5L8.5 19z"/>',
  trash: '<path d="M4 7h16"/><path d="M9.5 7V4.5h5V7"/><path d="M6.5 7l1 12.5h9l1-12.5"/>',
  plus: '<path d="M12 5v14"/><path d="M5 12h14"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 00-1-1H5a1 1 0 00-1 1v10a1 1 0 001 1h3"/>',
  arrowUp: '<path d="M12 19V5"/><path d="M6 11l6-6 6 6"/>',
  arrowDown: '<path d="M12 5v14"/><path d="M6 13l6 6 6-6"/>',
  arrowRight: '<path d="M5 12h14"/><path d="M13 6l6 6-6 6"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><path d="M12 8h.01"/>',
  collapse: '<path d="M15 6l-6 6 6 6"/>',
  expand: '<path d="M9 6l6 6-6 6"/>',
};

export function Icon({ n, size = 16, style, className, sw = 1.9 }: { n: string; size?: number; style?: CSSProperties; className?: string; sw?: number }) {
  return (
    <svg className={'ic ' + (className || '')} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" style={style} aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: P[n] || P.target }} />
  );
}

/** Ask Vectron mascot (animated in CSS) */
export function Bot({ size = 22 }: { size?: number }) {
  return (
    <svg className="botmark" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <circle className="b-ant" cx="12" cy="2.9" r="1.35" />
      <path d="M12 4.3v2.1" />
      <rect className="b-hd" x="4.4" y="6.4" width="15.2" height="11.2" rx="3.4" />
      <path d="M2.7 10.4v3.2M21.3 10.4v3.2" />
      <circle className="b-eye" cx="9.1" cy="11.6" r="1.45" />
      <circle className="b-eye b-eye2" cx="14.9" cy="11.6" r="1.45" />
      <path className="b-mo" d="M9.4 15h5.2" />
    </svg>
  );
}
