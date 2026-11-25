/* Hypothetical cockpit data — ported 1:1 from the v14.7 prototype.
   Replace with Databricks SQL queries once real business logic is shared. */

export type Platform = 'formulation' | 'api';
export type GroupId = 'fin' | 'val' | 'out' | 'utl' | 'scm';
export type BandRule =
  | 'pctPlan' | 'pctOver' | 'pctBelow' | 'ppOver' | 'ppBelow' | 'ppBand'
  | 'absHi' | 'absLo' | 'slaDays' | 'loss';

export interface Plant { id: string; n: string; s: string; p: Platform }
export interface Kpi {
  id: string; n: string; s: string; g: GroupId; ic: string;
  agg: 'sum' | 'avg' | 'der'; dir: 'hi' | 'lo';
  vm: 'pct' | 'pp' | 'day' | 'cur';
  u: Record<Platform, string>; dec: number; decApi?: number;
  band: BandRule; tol: [number, number]; drill: string;
}

export const PLANTS: Plant[] = [
  { id: 'unit1', n: 'Unit -1', s: 'Unit-1', p: 'formulation' },
  { id: 'unit2', n: 'Unit -2', s: 'Unit-2', p: 'formulation' },
  { id: 'unit3', n: 'Unit -3', s: 'Unit-3', p: 'formulation' },
  { id: 'sikkim', n: 'Sikkim', s: 'Sikkim', p: 'formulation' },
  { id: 'behror', n: 'API -1 · Behror', s: 'Behror', p: 'api' },
  { id: 'vizag', n: 'API -2 · Vizag', s: 'Vizag', p: 'api' },
];
export const PBY: Record<string, Plant> = Object.fromEntries(PLANTS.map((p) => [p.id, p]));
export const PLAT: Record<Platform, { l: string; b: string }> = {
  formulation: { l: 'Formulation', b: 'per pack' },
  api: { l: 'API', b: 'per kg' },
};

export const KPIS: Kpi[] = [
  /* Profit & Loss */
  { id: 'sales', n: 'Sales / Turnover', s: 'Sales / Turnover', g: 'fin', ic: 'rise', agg: 'sum', dir: 'hi', vm: 'pct', u: { formulation: '₹ Cr', api: '₹ Cr' }, dec: 1, band: 'pctPlan', tol: [99, 96], drill: 'product' },
  { id: 'cogs', n: 'COGS / RMC', s: 'COGS / RMC', g: 'fin', ic: 'pkg', agg: 'avg', dir: 'lo', vm: 'pct', u: { formulation: '₹/pack', api: '₹/kg' }, dec: 2, decApi: 0, band: 'pctOver', tol: [1, 2.5], drill: 'product' },
  { id: 'opex', n: 'Budget vs Actual OPEx', s: 'OPEx vs Budget', g: 'fin', ic: 'rupee', agg: 'sum', dir: 'lo', vm: 'pct', u: { formulation: '₹ Cr', api: '₹ Cr' }, dec: 2, band: 'pctOver', tol: [1, 3], drill: 'gl' },
  { id: 'margin', n: 'Plant Operating Margin', s: 'Operating Margin', g: 'fin', ic: 'wallet', agg: 'der', dir: 'hi', vm: 'pct', u: { formulation: '₹ Cr', api: '₹ Cr' }, dec: 2, band: 'pctPlan', tol: [99, 96], drill: 'margin' },
  /* Value at stake */
  { id: 'olY', n: 'Opportunity Loss / Gain — Yield', s: 'Opp. L/G · Yield', g: 'val', ic: 'flask', agg: 'sum', dir: 'hi', vm: 'cur', u: { formulation: '₹ Cr', api: '₹ Cr' }, dec: 2, band: 'loss', tol: [0.25, 0.25], drill: 'product' },
  { id: 'olC', n: 'Opportunity Loss / Gain — COGS', s: 'Opp. L/G · COGS', g: 'val', ic: 'coins', agg: 'sum', dir: 'hi', vm: 'cur', u: { formulation: '₹ Cr', api: '₹ Cr' }, dec: 2, band: 'loss', tol: [0.5, 0.5], drill: 'product' },
  /* Output & efficiency */
  { id: 'prod', n: 'Production Output', s: 'Production Output', g: 'out', ic: 'stack', agg: 'sum', dir: 'hi', vm: 'pct', u: { formulation: 'Cr pk', api: 'MT' }, dec: 1, band: 'pctPlan', tol: [99, 96], drill: 'block' },
  { id: 'batch', n: 'Batch Count', s: 'Batch Count', g: 'out', ic: 'grid2', agg: 'sum', dir: 'hi', vm: 'pct', u: { formulation: 'Number', api: 'Number' }, dec: 0, band: 'pctPlan', tol: [99, 96], drill: 'block' },
  { id: 'yield', n: 'Yield', s: 'Yield', g: 'out', ic: 'flask', agg: 'avg', dir: 'hi', vm: 'pp', u: { formulation: '%', api: '%' }, dec: 1, band: 'ppBelow', tol: [0.25, 1], drill: 'product' },
  { id: 'cap', n: 'Capacity Utilisation', s: 'Capacity Util.', g: 'out', ic: 'speed', agg: 'avg', dir: 'hi', vm: 'pp', u: { formulation: '%', api: '%' }, dec: 1, band: 'absHi', tol: [85, 75], drill: 'block' },
  { id: 'man', n: 'Manpower Productivity', s: 'Manpower Prod.', g: 'out', ic: 'hand', agg: 'avg', dir: 'hi', vm: 'pct', u: { formulation: 'pk/hr', api: 'kg/hr' }, dec: 1, band: 'pctBelow', tol: [1, 5], drill: 'dept' },
  { id: 'conv', n: 'Conversion Cost', s: 'Conversion Cost', g: 'out', ic: 'fact', agg: 'avg', dir: 'lo', vm: 'pct', u: { formulation: '₹/pack', api: '₹/kg' }, dec: 2, decApi: 0, band: 'pctOver', tol: [1, 3], drill: 'convdec' },
  { id: 'fv', n: 'Fixed–Variable Split (of OPEx)', s: 'Fixed–Var Split', g: 'out', ic: 'layers', agg: 'avg', dir: 'lo', vm: 'pp', u: { formulation: '% fix|var', api: '% fix|var' }, dec: 1, band: 'ppBand', tol: [0.5, 2], drill: 'gl' },
  { id: 'opexTo', n: 'OPEx / Turnover Ratio', s: 'OPEx-to-Turnover', g: 'out', ic: 'pctg', agg: 'der', dir: 'lo', vm: 'pp', u: { formulation: '%', api: '%' }, dec: 2, band: 'ppOver', tol: [0.25, 1], drill: 'gl' },
  /* Utility rates */
  { id: 'pwr', n: 'Power Rate', s: 'Power Rate', g: 'utl', ic: 'plug', agg: 'avg', dir: 'lo', vm: 'pct', u: { formulation: '₹/kWh', api: '₹/kWh' }, dec: 2, band: 'pctOver', tol: [1, 3], drill: 'utility' },
  { id: 'dsl', n: 'Diesel Rate', s: 'Diesel Rate', g: 'utl', ic: 'fuel', agg: 'avg', dir: 'lo', vm: 'pct', u: { formulation: '₹/L', api: '₹/L' }, dec: 1, band: 'pctOver', tol: [1, 3], drill: 'utility' },
  { id: 'brq', n: 'Briquette Rate', s: 'Briquette Rate', g: 'utl', ic: 'flame', agg: 'avg', dir: 'lo', vm: 'pct', u: { formulation: '₹/MT', api: '₹/MT' }, dec: 0, band: 'pctOver', tol: [1, 3], drill: 'utility' },
  /* Supply chain & working capital */
  { id: 'otif', n: 'Service Level (OTIF)', s: 'Service Level', g: 'scm', ic: 'truck', agg: 'avg', dir: 'hi', vm: 'pp', u: { formulation: '%', api: '%' }, dec: 1, band: 'absHi', tol: [98, 95], drill: 'customer' },
  { id: 'dofc', n: 'DOFC — Days of Finished Cover', s: 'DOFC', g: 'scm', ic: 'hour', agg: 'avg', dir: 'lo', vm: 'day', u: { formulation: 'days', api: 'days' }, dec: 1, band: 'pctOver', tol: [3, 10], drill: 'agebucket' },
  { id: 'dobc', n: 'DOBC — Days of Bulk Cover', s: 'DOBC', g: 'scm', ic: 'clock', agg: 'avg', dir: 'lo', vm: 'day', u: { formulation: 'days', api: 'days' }, dec: 1, band: 'pctOver', tol: [3, 10], drill: 'agebucket' },
  { id: 'inv', n: 'Inventory Ageing', s: 'Inventory Ageing', g: 'scm', ic: 'drum', agg: 'avg', dir: 'lo', vm: 'pp', u: { formulation: '% >90d', api: '% >90d' }, dec: 1, band: 'absLo', tol: [5, 10], drill: 'agebucket' },
  { id: 'prpo', n: 'PR to PO TAT', s: 'PR→PO TAT', g: 'scm', ic: 'clip', agg: 'avg', dir: 'lo', vm: 'day', u: { formulation: 'days', api: 'days' }, dec: 1, band: 'slaDays', tol: [0, 3], drill: 'pr' },
];
export const KBY: Record<string, Kpi> = Object.fromEntries(KPIS.map((k) => [k.id, k]));
export const KORD: Record<string, number> = Object.fromEntries(KPIS.map((k, i) => [k.id, i]));
export const GRP: Record<GroupId, string> = {
  fin: 'Profit & Loss', val: 'Value at Stake', out: 'Output & Efficiency',
  utl: 'Utility Rates', scm: 'Supply Chain & Working Capital',
};
export const GRP_ORDER: GroupId[] = ['fin', 'val', 'out', 'utl', 'scm'];
export const GRPS: Record<GroupId, string> = { fin: 'Profit & loss', out: 'Output', scm: 'Supply chain', val: 'Value at stake', utl: 'Utilities' };
/* Plant Health Index group weights — leadership call */
export const PHIW: Record<GroupId, number> = { fin: 30, out: 25, scm: 20, val: 15, utl: 10 };

/* [actual, target] for the current FY period. rmc only feeds Operating Margin. */
type Pair = [number, number];
export const D: Record<string, Record<string, Pair>> = {
  sales: { unit1: [33.7, 33.5], unit2: [35.8, 35.4], unit3: [31.6, 31.4], sikkim: [27.9, 27.7], behror: [32.4, 34.8], vizag: [29.8, 29.2] },
  rmc: { unit1: [18.9, 18.7], unit2: [20.4, 19.9], unit3: [17.8, 17.6], sikkim: [15.4, 15.5], behror: [19.6, 18.9], vizag: [16.6, 16.7] },
  opex: { unit1: [3.1, 3.15], unit2: [3.62, 3.4], unit3: [3.05, 3.0], sikkim: [2.48, 2.55], behror: [3.55, 3.2], vizag: [2.8, 2.7] },
  cogs: { unit1: [17.6, 17.9], unit2: [18.42, 18.1], unit3: [18.05, 18.0], sikkim: [17.2, 17.5], behror: [9120, 8800], vizag: [8480, 8600] },
  conv: { unit1: [5.05, 5.2], unit2: [5.38, 5.3], unit3: [5.22, 5.28], sikkim: [4.92, 5.1], behror: [2610, 2450], vizag: [2380, 2420] },
  fv: { unit1: [41.0, 40.0], unit2: [46.9, 41.0], unit3: [43.5, 41.5], sikkim: [38.9, 40.0], behror: [52.3, 45.0], vizag: [44.1, 45.0] },
  prod: { unit1: [21.4, 21.0], unit2: [22.6, 23.4], unit3: [19.8, 20.2], sikkim: [17.9, 17.5], behror: [172, 196], vizag: [163, 158] },
  batch: { unit1: [428, 420], unit2: [452, 468], unit3: [396, 404], sikkim: [358, 350], behror: [86, 98], vizag: [82, 79] },
  yield: { unit1: [96.4, 95.2], unit2: [95.6, 96.0], unit3: [95.3, 95.1], sikkim: [97.1, 95.5], behror: [93.9, 95.2], vizag: [96.2, 94.7] },
  cap: { unit1: [87.4, 85.0], unit2: [83.1, 85.0], unit3: [80.6, 85.0], sikkim: [89.2, 85.0], behror: [71.8, 85.0], vizag: [84.9, 85.0] },
  man: { unit1: [412, 400], unit2: [372, 395], unit3: [381, 392], sikkim: [428, 405], behror: [26.4, 29.5], vizag: [31.2, 30.4] },
  pwr: { unit1: [7.62, 7.55], unit2: [8.14, 7.6], unit3: [7.71, 7.65], sikkim: [6.98, 7.2], behror: [8.46, 7.9], vizag: [7.55, 7.6] },
  dsl: { unit1: [92.4, 90.0], unit2: [94.8, 90.5], unit3: [91.6, 90.2], sikkim: [88.9, 89.5], behror: [96.2, 91.0], vizag: [90.8, 90.5] },
  brq: { unit1: [7150, 7000], unit2: [7480, 7050], unit3: [7220, 7100], sikkim: [6820, 6950], behror: [7860, 7300], vizag: [7040, 7100] },
  otif: { unit1: [98.4, 98.0], unit2: [97.2, 98.0], unit3: [98.1, 98.0], sikkim: [98.9, 98.0], behror: [93.6, 98.0], vizag: [97.8, 98.0] },
  dofc: { unit1: [26.4, 28.0], unit2: [33.1, 28.0], unit3: [29.6, 28.0], sikkim: [24.8, 28.0], behror: [37.2, 30.0], vizag: [28.4, 30.0] },
  dobc: { unit1: [17.2, 18.0], unit2: [22.4, 18.0], unit3: [19.1, 18.0], sikkim: [16.4, 18.0], behror: [26.8, 20.0], vizag: [18.6, 20.0] },
  inv: { unit1: [4.2, 5.0], unit2: [6.8, 5.0], unit3: [5.4, 5.0], sikkim: [3.1, 5.0], behror: [12.6, 5.0], vizag: [7.2, 5.0] },
  prpo: { unit1: [8.4, 9.0], unit2: [10.6, 9.0], unit3: [9.8, 9.5], sikkim: [7.9, 9.0], behror: [14.2, 10.0], vizag: [9.2, 9.5] },
  olY: { unit1: [0.04, 0], unit2: [-0.18, 0], unit3: [-0.07, 0], sikkim: [0.13, 0], behror: [-0.31, 0], vizag: [0.26, 0] },
  olC: { unit1: [0.2, 0], unit2: [-0.24, 0], unit3: [-0.02, 0], sikkim: [0.2, 0], behror: [-0.78, 0], vizag: [0.3, 0] },
};

/* ---------- drill-down reference data ---------- */
export interface Gl { h: string; n: string; c: string; sh: number; fx: number; pot: 'high' | 'medium' | 'low'; note: string }
export const GLS: Gl[] = [
  { h: 'Utilities', n: 'Power – Grid', c: 'GL 5101', sh: 0.17, fx: 0.35, pot: 'high', note: 'Move to a demand-linked tariff slab.' },
  { h: 'Utilities', n: 'Fuel – Briquette', c: 'GL 5103', sh: 0.07, fx: 0.2, pot: 'low', note: 'Already consumption-linked.' },
  { h: 'Utilities', n: 'DG Fuel', c: 'GL 5104', sh: 0.03, fx: 0.15, pot: 'low', note: 'Runs with usage.' },
  { h: 'Utilities', n: 'Water & ETP', c: 'GL 5106', sh: 0.03, fx: 0.55, pot: 'medium', note: 'ETP minimum charge can be re-contracted.' },
  { h: 'Manpower', n: 'Salaries – Permanent', c: 'GL 6001', sh: 0.18, fx: 0.95, pot: 'medium', note: 'Non-GMP support roles can move to a managed service.' },
  { h: 'Manpower', n: 'Contract Labour', c: 'GL 6004', sh: 0.08, fx: 0.3, pot: 'low', note: 'Already flexes with volume.' },
  { h: 'Manpower', n: 'Overtime', c: 'GL 6007', sh: 0.04, fx: 0.05, pot: 'low', note: 'Fully variable.' },
  { h: 'Manpower', n: 'Staff Welfare', c: 'GL 6012', sh: 0.03, fx: 0.8, pot: 'low', note: 'Headcount-linked.' },
  { h: 'Quality & Testing', n: 'QC Consumables', c: 'GL 6201', sh: 0.04, fx: 0.25, pot: 'low', note: 'Consumption-linked.' },
  { h: 'Quality & Testing', n: 'External Lab Testing', c: 'GL 6205', sh: 0.03, fx: 0.6, pot: 'medium', note: 'Retainer can shift to pay-per-sample.' },
  { h: 'Quality & Testing', n: 'Stability Studies', c: 'GL 6208', sh: 0.02, fx: 0.9, pot: 'medium', note: 'Low-volume products can go external.' },
  { h: 'Maintenance', n: 'AMC – Fixed', c: 'GL 6301', sh: 0.05, fx: 0.95, pot: 'high', note: 'Shift AMC to per-call pricing.' },
  { h: 'Maintenance', n: 'Spares Consumption', c: 'GL 6305', sh: 0.05, fx: 0.25, pot: 'low', note: 'Usage-linked.' },
  { h: 'Maintenance', n: 'Breakdown Repairs', c: 'GL 6309', sh: 0.03, fx: 0.1, pot: 'low', note: 'Event-driven.' },
  { h: 'Stores', n: 'Packing Consumables', c: 'GL 6401', sh: 0.04, fx: 0.1, pot: 'low', note: 'Volume-linked.' },
  { h: 'Stores', n: 'General Consumables', c: 'GL 6404', sh: 0.03, fx: 0.2, pot: 'low', note: 'Volume-linked.' },
  { h: 'Logistics', n: 'Inward Freight', c: 'GL 6501', sh: 0.02, fx: 0.15, pot: 'low', note: 'Movement-linked.' },
  { h: 'Logistics', n: 'Outward Freight', c: 'GL 6505', sh: 0.02, fx: 0.1, pot: 'low', note: 'Despatch-linked.' },
  { h: 'Admin', n: 'Rent & Rates', c: 'GL 7001', sh: 0.02, fx: 1, pot: 'low', note: 'Structurally fixed.' },
  { h: 'Admin', n: 'Insurance', c: 'GL 7004', sh: 0.01, fx: 1, pot: 'low', note: 'Structurally fixed.' },
  { h: 'Admin', n: 'IT & Licences', c: 'GL 7008', sh: 0.01, fx: 1, pot: 'medium', note: 'Per-seat licences can flex.' },
];
export const FXD: Record<string, number> = { unit1: -0.07, unit2: -0.01, unit3: -0.045, sikkim: -0.09, behror: 0.045, vizag: -0.038 };

export interface Product { id: string; n: string; pl: string; blk: string; by: number; ay: number; q: number; gc: number; cb: number; ca: number; tf: number }
export const PRODUCTS: Product[] = [
  { id: 'p1', n: 'Amoxicillin 500 Cap', pl: 'unit1', blk: 'OSD Block A', by: 96.5, ay: 96.8, q: 2600000, gc: 34, cb: 17.9, ca: 17.5, tf: 0.98 },
  { id: 'p2', n: 'Pantoprazole 40 Tab', pl: 'unit1', blk: 'OSD Block A', by: 96.2, ay: 96.4, q: 2000000, gc: 38, cb: 18.0, ca: 17.7, tf: 1.0 },
  { id: 'p3', n: 'Cefixime 200 Tab', pl: 'unit1', blk: 'OSD Block B', by: 96.0, ay: 95.9, q: 1600000, gc: 36, cb: 17.8, ca: 17.6, tf: 1.01 },
  { id: 'p4', n: 'Montelukast 10 Tab', pl: 'unit2', blk: 'OSD Block A', by: 96.4, ay: 94.9, q: 2200000, gc: 45, cb: 18.1, ca: 18.9, tf: 1.07 },
  { id: 'p5', n: 'Azithromycin 500 Tab', pl: 'unit2', blk: 'OSD Block B', by: 95.8, ay: 95.2, q: 1900000, gc: 41, cb: 18.2, ca: 18.6, tf: 1.04 },
  { id: 'p6', n: 'Amoxicillin 500 Cap', pl: 'unit2', blk: 'OSD Block A', by: 96.0, ay: 96.3, q: 1700000, gc: 34, cb: 18.0, ca: 17.9, tf: 0.99 },
  { id: 'p7', n: 'Levocetirizine 5 Tab', pl: 'unit3', blk: 'OSD Block A', by: 95.6, ay: 95.1, q: 1900000, gc: 33, cb: 18.0, ca: 18.2, tf: 1.04 },
  { id: 'p8', n: 'Pantoprazole 40 Tab', pl: 'unit3', blk: 'OSD Block B', by: 96.2, ay: 95.8, q: 1700000, gc: 38, cb: 18.1, ca: 18.0, tf: 1.01 },
  { id: 'p9', n: 'Rabeprazole 20 Tab', pl: 'unit3', blk: 'OSD Block B', by: 95.4, ay: 95.1, q: 1500000, gc: 35, cb: 17.9, ca: 17.9, tf: 0.99 },
  { id: 'p10', n: 'Telmisartan 40 Tab', pl: 'sikkim', blk: 'OSD Block A', by: 96.8, ay: 97.4, q: 2400000, gc: 39, cb: 17.5, ca: 17.1, tf: 0.97 },
  { id: 'p11', n: 'Atorvastatin 10 Tab', pl: 'sikkim', blk: 'OSD Block A', by: 96.5, ay: 97.0, q: 2100000, gc: 37, cb: 17.4, ca: 17.2, tf: 0.98 },
  { id: 'p12', n: 'Metformin 500 Tab', pl: 'sikkim', blk: 'OSD Block B', by: 96.2, ay: 96.8, q: 1900000, gc: 30, cb: 17.6, ca: 17.3, tf: 0.99 },
  { id: 'p13', n: 'Pantoprazole Sodium', pl: 'behror', blk: 'API Block 1', by: 95.2, ay: 93.6, q: 8400, gc: 7200, cb: 8750, ca: 9310, tf: 1.18 },
  { id: 'p14', n: 'Telmisartan API', pl: 'behror', blk: 'API Block 1', by: 94.8, ay: 94.1, q: 7100, gc: 6900, cb: 8820, ca: 9160, tf: 1.1 },
  { id: 'p15', n: 'Montelukast Sodium', pl: 'behror', blk: 'API Block 2', by: 94.4, ay: 94.0, q: 5700, gc: 6600, cb: 8840, ca: 8960, tf: 1.04 },
  { id: 'p16', n: 'Atorvastatin Calcium', pl: 'vizag', blk: 'API Block 1', by: 94.6, ay: 96.4, q: 9600, gc: 7000, cb: 8620, ca: 8480, tf: 0.95 },
  { id: 'p17', n: 'Cefixime Trihydrate', pl: 'vizag', blk: 'API Block 2', by: 94.9, ay: 96.1, q: 8200, gc: 6800, cb: 8580, ca: 8460, tf: 0.97 },
  { id: 'p18', n: 'Rabeprazole Sodium', pl: 'vizag', blk: 'API Block 2', by: 94.5, ay: 96.0, q: 7000, gc: 6500, cb: 8600, ca: 8510, tf: 1.0 },
];
export const PRBY: Record<string, Product[]> = {};
PRODUCTS.forEach((x) => { (PRBY[x.pl] = PRBY[x.pl] || []).push(x); });

export const PRS = [
  { id: 'PR-27-0481', pl: 'behror', cat: 'Compressor spare – bearing assembly', v: 18.4, age: 24, st: 'Awaiting vendor finalisation', o: 'Procurement – Rotating' },
  { id: 'PR-27-0507', pl: 'behror', cat: 'Reactor gasket set', v: 6.2, age: 19, st: 'Awaiting technical approval', o: 'Engineering' },
  { id: 'PR-27-0533', pl: 'behror', cat: 'Solvent recovery column packing', v: 31.7, age: 17, st: 'Awaiting budget sanction', o: 'Finance – Capex' },
  { id: 'PR-27-0549', pl: 'behror', cat: 'Nitrogen plant AMC renewal', v: 9.8, age: 15, st: 'In contract review', o: 'Legal' },
  { id: 'PR-27-0562', pl: 'unit2', cat: 'Blister tooling change parts', v: 12.1, age: 21, st: 'Awaiting vendor finalisation', o: 'Procurement – Packing' },
  { id: 'PR-27-0575', pl: 'unit2', cat: 'HVAC filter bank', v: 7.4, age: 16, st: 'Awaiting technical approval', o: 'Engineering' },
  { id: 'PR-27-0588', pl: 'unit2', cat: 'Granulator spare – impeller', v: 5.6, age: 14, st: 'Awaiting PO release', o: 'Procurement – Rotating' },
  { id: 'PR-27-0601', pl: 'unit3', cat: 'QC column & consumables', v: 4.3, age: 13, st: 'Awaiting technical approval', o: 'Quality' },
  { id: 'PR-27-0614', pl: 'unit3', cat: 'Boiler tube replacement', v: 22.5, age: 12, st: 'Awaiting budget sanction', o: 'Finance – Capex' },
  { id: 'PR-27-0627', pl: 'unit1', cat: 'Packing conveyor belt', v: 3.1, age: 11, st: 'Awaiting PO release', o: 'Procurement – General' },
  { id: 'PR-27-0653', pl: 'sikkim', cat: 'Cooling tower fill media', v: 6.8, age: 7, st: 'Awaiting vendor finalisation', o: 'Procurement – Utilities' },
  { id: 'PR-27-0666', pl: 'vizag', cat: 'Centrifuge bag filters', v: 4.6, age: 9, st: 'Awaiting PO release', o: 'Procurement – General' },
];
export const CUST = [
  { pl: 'behror', n: 'Alkem Labs (contract)', fail: 4, ord: 18, rc: 'Batch release delay' },
  { pl: 'behror', n: 'Zydus Wellness', fail: 3, ord: 14, rc: 'Campaign shortfall' },
  { pl: 'behror', n: 'Emcure Pharma', fail: 2, ord: 11, rc: 'Campaign shortfall' },
  { pl: 'unit2', n: 'Apollo Pharmacy', fail: 2, ord: 34, rc: 'Changeover backlog' },
  { pl: 'unit2', n: 'MedPlus Retail', fail: 1, ord: 28, rc: 'Packing line stop' },
  { pl: 'unit3', n: 'Wellness Forever', fail: 1, ord: 22, rc: 'QC hold' },
  { pl: 'vizag', n: 'Cipla (contract)', fail: 1, ord: 16, rc: 'Documentation' },
];
export const BLOCKS = [
  { pl: 'behror', n: 'API Block 1', u: 68.4, dt: 14.2, rc: 'Compressor-3 breakdown' },
  { pl: 'behror', n: 'API Block 2', u: 75.1, dt: 8.1, rc: 'Planned shutdown overrun' },
  { pl: 'unit2', n: 'OSD Block A', u: 80.2, dt: 9.4, rc: 'Changeover backlog' },
  { pl: 'unit2', n: 'OSD Block B', u: 86.0, dt: 4.1, rc: '—' },
  { pl: 'unit3', n: 'OSD Block A', u: 78.9, dt: 10.6, rc: 'PM backlog' },
  { pl: 'unit3', n: 'OSD Block B', u: 82.3, dt: 6.2, rc: '—' },
  { pl: 'unit1', n: 'OSD Block A', u: 88.1, dt: 3.4, rc: '—' },
  { pl: 'unit1', n: 'OSD Block B', u: 86.7, dt: 4.0, rc: '—' },
  { pl: 'sikkim', n: 'OSD Block A', u: 90.2, dt: 2.8, rc: '—' },
  { pl: 'sikkim', n: 'OSD Block B', u: 88.1, dt: 3.5, rc: '—' },
  { pl: 'vizag', n: 'API Block 1', u: 85.4, dt: 5.1, rc: '—' },
  { pl: 'vizag', n: 'API Block 2', u: 84.3, dt: 6.0, rc: '—' },
];
export const UTIL = [
  { pl: 'behror', n: 'Power – Grid', u: '₹/kWh', a: 8.46, b: 7.9, cons: 6.2 },
  { pl: 'behror', n: 'Steam', u: '₹/MT', a: 2180, b: 2050, cons: 4.1 },
  { pl: 'behror', n: 'Water', u: '₹/KL', a: 38.2, b: 36.0, cons: 2.0 },
  { pl: 'unit2', n: 'Power – Grid', u: '₹/kWh', a: 8.14, b: 7.6, cons: 1.8 },
  { pl: 'unit2', n: 'Steam', u: '₹/MT', a: 1980, b: 1940, cons: 3.4 },
  { pl: 'unit2', n: 'Water', u: '₹/KL', a: 34.1, b: 34.5, cons: -1.2 },
  { pl: 'unit1', n: 'Power – Grid', u: '₹/kWh', a: 7.62, b: 7.55, cons: 0.8 },
  { pl: 'unit3', n: 'Power – Grid', u: '₹/kWh', a: 7.71, b: 7.65, cons: 1.1 },
  { pl: 'sikkim', n: 'Power – Grid', u: '₹/kWh', a: 6.98, b: 7.2, cons: -2.1 },
  { pl: 'vizag', n: 'Power – Grid', u: '₹/kWh', a: 7.55, b: 7.6, cons: 0.4 },
];
export const AGE = [
  { pl: 'behror', b: '>180 days', v: 1.92, item: 'Solvent recovery intermediates' },
  { pl: 'behror', b: '91–180 days', v: 1.34, item: 'Slow-moving RM' },
  { pl: 'unit2', b: '>180 days', v: 0.61, item: 'Discontinued pack material' },
  { pl: 'unit2', b: '91–180 days', v: 0.74, item: 'PM – blister foil' },
  { pl: 'unit3', b: '91–180 days', v: 0.52, item: 'RM – excipients' },
  { pl: 'vizag', b: '91–180 days', v: 0.63, item: 'API intermediates' },
  { pl: 'unit1', b: '91–180 days', v: 0.41, item: 'PM – cartons' },
  { pl: 'sikkim', b: '91–180 days', v: 0.28, item: 'RM – excipients' },
];
export const DEPTS = [
  { pl: 'behror', n: 'Production – API', idx: 88, ot: 14.2 },
  { pl: 'behror', n: 'Utilities', idx: 92, ot: 11.8 },
  { pl: 'behror', n: 'Quality Control', idx: 97, ot: 6.1 },
  { pl: 'unit2', n: 'Production – OSD', idx: 92, ot: 12.4 },
  { pl: 'unit2', n: 'Packing', idx: 95, ot: 9.8 },
  { pl: 'unit3', n: 'Production – OSD', idx: 96, ot: 8.2 },
  { pl: 'unit1', n: 'Production – OSD', idx: 103, ot: 5.1 },
  { pl: 'sikkim', n: 'Production – OSD', idx: 106, ot: 4.2 },
  { pl: 'vizag', n: 'Production – API', idx: 103, ot: 6.4 },
];
