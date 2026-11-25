/* Narrative content: causes, actions, KPI links, agents, prompt backlog, programmes. */

export const CZ: Record<string, string> = {
  prod: 'Output is running under plan because available line hours were lost to unplanned stoppages, so the volume was never made.',
  batch: 'Fewer batches were released than planned — campaign changeovers ran long and squeezed the schedule.',
  margin: 'Margin is compressed because the material and overhead lines are both running ahead of plan while turnover holds flat.',
  dofc: 'Finished-goods cover is drifting from plan as despatch is lagging the production it is meant to clear.',
  dobc: 'Bulk cover is off plan because intermediate stock is building faster than it is being consumed downstream.',
  pwr: 'Power cost per unit is above plan — grid tariff revision plus heavier DG dependence during maintenance windows.',
  dsl: 'Diesel rate is above plan, driven by higher DG running hours and a dearer procurement slab.',
  brq: 'Briquette rate is above plan on fuel moisture variation and a firmer supplier price.',
  sales: 'Volume, not price, is setting the top line; the shortfall traces to campaigns lost to asset downtime.',
  opex: 'Utility tariff revision and contract-manpower cover account for most of the overrun; material spend is on budget.',
  cogs: 'Stage-level yield loss on high-value products is flowing straight into unit cost.',
  conv: 'Fixed-cost absorption is weak where volume slipped; the balance is utility rate and overtime.',
  opexTo: 'Cost is growing faster than the sales base — a cost-side issue, not a demand shortfall.',
  fv: 'A high fixed share leaves the plant exposed when volume dips, because cost cannot follow output down.',
  olY: 'Every basis point of yield against baseline converts straight into gross contribution.',
  olC: 'Unit-cost drift against standard is multiplied by the full production quantity.',
  yield: 'Granulation-stage losses on a small number of products are the only material drag.',
  cap: 'Available hours are lost to unplanned stoppage and changeover, not to demand.',
  otif: 'Dispatch reliability is tracking the output shortfall on exposed SKUs.',
  inv: 'Slow-moving stock beyond 90 days is concentrated in a few intermediates, carrying provision risk.',
  util: 'Grid tariff revision is running ahead of the rate assumed in budget.',
  man: 'Manned hours held flat while output fell, so the index tracks the volume loss directly.',
  prpo: 'The requisition cycle is stretching at approval and vendor-finalisation stages.',
};
export const CZP: Record<string, string> = {
  'behror:opex': 'Outage-response cost — overtime and expedited freight during the Compressor-3 failure.',
  'behror:conv': 'Fixed costs were absorbed over roughly 24 MT less output, lifting cost per kg.',
  'behror:sales': 'Compressor-3 downtime removed campaign output that could not be re-phased inside the period.',
  'behror:cap': 'A Compressor-3 bearing failure took API Block 1 down for 14 hours, plus two repeat trips.',
  'behror:otif': 'Lost campaign hours pushed a small number of committed lines past their dates.',
  'behror:inv': 'Solvent-recovery intermediates have aged past 180 days while the block was down.',
  'behror:man': 'Manned hours continued through the outage while output did not.',
  'unit2:opex': 'Utilities are ~55% of the overrun after a tariff revision; the rest is Line 3 overtime cover.',
  'unit2:util': 'A mid-quarter tariff revision raised the effective grid rate ~7%.',
  'unit2:cap': 'Line 3 changeover backlog is holding available hours below plan.',
};
export const AZ: Record<string, string> = {
  prod: 'Clear the downtime backlog on the constraint line and re-phase the campaign plan to recover the lost volume.',
  batch: 'Tighten changeover discipline on the slowest campaign and release the held batches.',
  margin: 'Attack the two largest overhead lines and re-baseline material cost on the flagged products.',
  dofc: 'Align despatch scheduling to the production plan and clear the ageing finished-goods block.',
  dobc: 'Re-sequence intermediate production to consumption and hold bulk releases until cover normalises.',
  pwr: 'Restore the deferred compressor maintenance to cut DG dependence and renegotiate the tariff slab.',
  dsl: 'Reduce DG running hours once grid supply stabilises and consolidate diesel procurement.',
  brq: 'Tighten fuel-moisture acceptance at receipt and re-tender the briquette contract.',
  sales: 'Protect the order book on the exposed SKUs and re-phase despatch once output recovers.',
  opex: 'Shift utility-heavy operations to off-peak tariff windows and convert sustained overtime into planned shifts.',
  cogs: 'Close the stage-level yield loss on the flagged products, then re-baseline unit cost.',
  conv: 'Rebuild volume on the affected lines before re-testing the cost-per-unit baseline.',
  opexTo: 'Close the OPEx actions first — the ratio recovers without separate intervention.',
  fv: 'Target the most fixed-loaded GLs and re-contract them onto usage-linked pricing.',
  olY: 'Close the yield gap on the flagged products — the value is already quantified per product.',
  olC: 'Attack unit cost on the flagged products first; the quantity multiplier makes them the largest prize.',
  yield: 'Investigate the flagged products at the granulation stage and validate the recent raw-material batch change.',
  cap: 'Clear the breakdown and changeover backlog on the lowest-utilisation block.',
  otif: 'Hold finished-goods cover on the SKUs most exposed to the output shortfall.',
  inv: 'Raise provision or liquidation cases for items beyond 180 days before quarter close.',
  util: 'Renegotiate the tariff slab and move load into off-peak windows.',
  man: 'Re-balance manning to actual output and convert sustained overtime into planned shifts.',
  prpo: 'Set an approval service level and pre-qualify vendors for the highest-volume categories.',
};
export const AZP: Record<string, string> = {
  'behror:cap': 'Expedite the Compressor-3 spare, complete the permanent repair, and audit remaining overdue PM orders.',
  'behror:sales': 'Schedule a recovery campaign once Compressor-3 is back and re-sequence the API plan.',
  'behror:conv': 'Restore Behror volume first — cost per kg is an absorption effect, not a rate problem.',
  'behror:prpo': 'Escalate the four requisitions past SLA; the compressor spare is on the critical path.',
  'unit2:opex': 'Move Unit-2 utility load off-peak and convert the Line 3 overtime cover to a planned shift.',
};
export const cz = (k: string, p?: string | null) => (p && CZP[p + ':' + k]) || CZ[k] || '';
export const az = (k: string, p?: string | null) => (p && AZP[p + ':' + k]) || AZ[k] || '';

export interface KLink { dir: 'drives' | 'improves with'; k: string; eff: string }
export const KLINKS: Record<string, KLink[]> = {
  fv: [
    { dir: 'drives', k: 'margin', eff: 'A high fixed share traps cost when volume falls, compressing Operating Margin directly.' },
    { dir: 'drives', k: 'conv', eff: 'Fixed cost spread over fewer units raises Conversion Cost per unit mechanically.' },
    { dir: 'improves with', k: 'prod', eff: 'If output recovers to plan, the same fixed base covers more units — split improves even before GL renegotiation.' },
  ],
  opex: [
    { dir: 'drives', k: 'margin', eff: 'Every rupee above budget flows straight through to Operating Margin reduction.' },
    { dir: 'drives', k: 'opexTo', eff: 'OPEx over-run on flat turnover pushes the OPEx-to-Turnover ratio above target.' },
  ],
  prod: [
    { dir: 'drives', k: 'man', eff: 'Lower output on the same headcount reduces Manpower Productivity.' },
    { dir: 'drives', k: 'conv', eff: 'Fixed cost absorbed over lower volume lifts Conversion Cost per unit.' },
    { dir: 'drives', k: 'margin', eff: 'Volume shortfall reduces revenue while fixed cost holds — Operating Margin compresses.' },
  ],
  cogs: [{ dir: 'drives', k: 'margin', eff: 'COGS/RMC is a direct input to Plant Operating Margin — every rupee above target reduces margin.' }],
  margin: [
    { dir: 'improves with', k: 'sales', eff: 'Higher turnover spreads fixed cost more favourably.' },
    { dir: 'improves with', k: 'opex', eff: 'OPEx coming within budget is the fastest lever on Margin.' },
    { dir: 'improves with', k: 'prod', eff: 'Volume recovery reduces absorption cost and lifts revenue simultaneously.' },
  ],
  cap: [
    { dir: 'drives', k: 'prod', eff: 'Capacity Utilisation and Production Output move together — utilisation is the upstream signal.' },
    { dir: 'drives', k: 'man', eff: 'Low utilisation means manpower is under-absorbed against the output base.' },
  ],
  pwr: [{ dir: 'drives', k: 'conv', eff: 'Power Rate feeds directly into Conversion Cost as the largest utility component.' }],
  dsl: [{ dir: 'drives', k: 'conv', eff: 'Diesel Rate is a direct Conversion Cost driver when grid dependency is high.' }],
  brq: [{ dir: 'drives', k: 'conv', eff: 'Briquette Rate affects steam cost and therefore Conversion Cost at formulation sites.' }],
  otif: [{ dir: 'drives', k: 'sales', eff: 'Service Level shortfalls can defer revenue recognition on delivered orders.' }],
  inv: [{ dir: 'drives', k: 'dofc', eff: 'Ageing inventory ties up working capital and risks write-off.' }],
};

/* ---------- Hindi narration ---------- */
export const HIM = ['अप्रैल', 'मई', 'जून', 'जुलाई', 'अगस्त', 'सितंबर', 'अक्टूबर', 'नवंबर', 'दिसंबर', 'जनवरी', 'फ़रवरी', 'मार्च'];
export const HIP: Record<string, string> = { unit1: 'यूनिट 1', unit2: 'यूनिट 2', unit3: 'यूनिट 3', sikkim: 'सिक्किम', behror: 'ए पी आई 1 बहरोड़', vizag: 'ए पी आई 2 वाइज़ैग' };
export const HIK: Record<string, string> = {
  sales: 'सेल्स टर्नओवर', opex: 'ओपेक्स बनाम बजट', cogs: 'सीओजीएस', conv: 'कन्वर्ज़न कॉस्ट', opexTo: 'ओपेक्स टू टर्नओवर',
  fv: 'फिक्स्ड और वेरिएबल स्प्लिट', olY: 'यील्ड से अवसर लाभ या हानि', olC: 'सीओजीएस से अवसर लाभ या हानि', yield: 'यील्ड',
  cap: 'कैपेसिटी यूटिलाइज़ेशन', otif: 'सर्विस लेवल', inv: 'इन्वेंटरी एजिंग', man: 'मैनपावर प्रोडक्टिविटी', prpo: 'पी आर से पी ओ टी ए टी',
  prod: 'प्रोडक्शन आउटपुट', batch: 'बैच काउंट', margin: 'ऑपरेटिंग मार्जिन', pwr: 'पावर रेट', dsl: 'डीज़ल रेट', brq: 'ब्रिकेट रेट',
  dofc: 'डी ओ एफ सी', dobc: 'डी ओ बी सी',
};
export const hiNum = (s: string) =>
  String(s).replace(/₹\s?([\d.,]+)\s*Cr/g, '$1 करोड़ रुपये').replace(/₹\s?([\d.,]+)/g, '$1 रुपये')
    .replace(/pp\b/g, ' परसेंटेज पॉइंट').replace(/%/g, ' प्रतिशत').replace(/−/g, 'माइनस ').replace(/\+/g, 'प्लस ');
