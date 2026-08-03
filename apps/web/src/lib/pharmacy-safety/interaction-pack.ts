/**
 * Curated deterministic drug–drug interaction pack.
 * High-signal pairs for East African retail / hospital outpatient pharmacy.
 * Always cite KNOWLEDGE_VERSION in API responses. Not a full formulary.
 */

export const KNOWLEDGE_VERSION = 'synapse-ddi-pack-2026.08.2'
export const KNOWLEDGE_SOURCE =
  'Synapse curated DDI pack (clinical references; pharmacist verification required)'

export type PackSeverity = 'major' | 'moderate' | 'minor'

export type PackInteraction = {
  a: string
  b: string
  severity: PackSeverity
  description: string
  recommendation: string
}

/** Canonical aliases → keys used in the pack. */
const ALIASES: Record<string, string> = {
  asa: 'aspirin',
  acetylsalicylic: 'aspirin',
  'acetylsalicylic acid': 'aspirin',
  aspirin: 'aspirin',
  paracetamol: 'paracetamol',
  acetaminophen: 'paracetamol',
  panadol: 'paracetamol',
  brufen: 'ibuprofen',
  nurofen: 'ibuprofen',
  voltaren: 'diclofenac',
  ibuprofen: 'ibuprofen',
  diclofenac: 'nsaid',
  naproxen: 'nsaid',
  mefenamic: 'nsaid',
  celecoxib: 'nsaid',
  nsaid: 'nsaid',
  cotrimoxazole: 'co-trimoxazole',
  septrin: 'co-trimoxazole',
  bactrim: 'co-trimoxazole',
  'co-trimoxazole': 'co-trimoxazole',
  amoxil: 'amoxicillin',
  amoxicillin: 'amoxicillin',
  flagyl: 'metronidazole',
  metronidazole: 'metronidazole',
  cipro: 'ciprofloxacin',
  ciprofloxacin: 'ciprofloxacin',
  levofloxacin: 'fluoroquinolone',
  moxifloxacin: 'fluoroquinolone',
  ofloxacin: 'fluoroquinolone',
  norfloxacin: 'fluoroquinolone',
  lasix: 'furosemide',
  furosemide: 'furosemide',
  glucophage: 'metformin',
  metformin: 'metformin',
  warfarin: 'warfarin',
  coumadin: 'warfarin',
  methotrexate: 'methotrexate',
  digoxin: 'digoxin',
  lanoxin: 'digoxin',
  theophylline: 'theophylline',
  erythromycin: 'erythromycin',
  clarithromycin: 'clarithromycin',
  azithromycin: 'azithromycin',
  fluconazole: 'fluconazole',
  ketoconazole: 'ketoconazole',
  itraconazole: 'itraconazole',
  rifampicin: 'rifampicin',
  rifampin: 'rifampicin',
  isoniazid: 'isoniazid',
  inh: 'isoniazid',
  pyrazinamide: 'pyrazinamide',
  ethambutol: 'ethambutol',
  efavirenz: 'efavirenz',
  ritonavir: 'ritonavir',
  artemether: 'artemether-lumefantrine',
  lumefantrine: 'artemether-lumefantrine',
  coartem: 'artemether-lumefantrine',
  'artemether-lumefantrine': 'artemether-lumefantrine',
  aluvia: 'lopinavir-ritonavir',
  lopinavir: 'lopinavir-ritonavir',
  'lopinavir-ritonavir': 'lopinavir-ritonavir',
  dolutegravir: 'dolutegravir',
  dtg: 'dolutegravir',
  tenofovir: 'tenofovir',
  tdf: 'tenofovir',
  taf: 'tenofovir',
  sildenafil: 'sildenafil',
  viagra: 'sildenafil',
  tadalafil: 'sildenafil',
  cialis: 'sildenafil',
  nitroglycerin: 'nitrates',
  isosorbide: 'nitrates',
  gtn: 'nitrates',
  'glyceryl trinitrate': 'nitrates',
  simvastatin: 'simvastatin',
  atorvastatin: 'atorvastatin',
  rosuvastatin: 'rosuvastatin',
  lovastatin: 'simvastatin',
  omeprazole: 'omeprazole',
  esomeprazole: 'omeprazole',
  pantoprazole: 'pantoprazole',
  clopidogrel: 'clopidogrel',
  plavix: 'clopidogrel',
  potassium: 'potassium',
  spironolactone: 'spironolactone',
  enalapril: 'ace-inhibitor',
  lisinopril: 'ace-inhibitor',
  ramipril: 'ace-inhibitor',
  captopril: 'ace-inhibitor',
  'ace inhibitor': 'ace-inhibitor',
  losartan: 'arb',
  valsartan: 'arb',
  telmisartan: 'arb',
  amlodipine: 'amlodipine',
  nifedipine: 'amlodipine',
  verapamil: 'verapamil',
  diltiazem: 'diltiazem',
  alcohol: 'alcohol',
  ethanol: 'alcohol',
  doxycycline: 'doxycycline',
  tetracycline: 'tetracycline',
  iron: 'iron',
  ferrous: 'iron',
  calcium: 'calcium',
  antacid: 'antacid',
  magnesium: 'antacid',
  aluminium: 'antacid',
  aluminum: 'antacid',
  milk: 'dairy',
  yoghurt: 'dairy',
  yogurt: 'dairy',
  levothyroxine: 'levothyroxine',
  thyroxine: 'levothyroxine',
  eltroxin: 'levothyroxine',
  lithium: 'lithium',
  tramadol: 'tramadol',
  codeine: 'opioid',
  morphine: 'opioid',
  pethidine: 'opioid',
  fluoxetine: 'ssri',
  sertraline: 'ssri',
  paroxetine: 'ssri',
  citalopram: 'ssri',
  escitalopram: 'ssri',
  amitriptyline: 'tca',
  phenytoin: 'phenytoin',
  carbamazepine: 'carbamazepine',
  tegretol: 'carbamazepine',
  'oral contraceptive': 'hormonal-contraceptive',
  contraceptive: 'hormonal-contraceptive',
  ethinylestradiol: 'hormonal-contraceptive',
  microgynon: 'hormonal-contraceptive',
  gentamicin: 'aminoglycoside',
  amikacin: 'aminoglycoside',
  amiodarone: 'amiodarone',
  quinine: 'quinine',
  glibenclamide: 'sulfonylurea',
  glimepiride: 'sulfonylurea',
  gliclazide: 'sulfonylurea',
  allopurinol: 'allopurinol',
  azathioprine: 'azathioprine',
  linezolid: 'linezolid',
  tamoxifen: 'tamoxifen',
  cyclosporine: 'ciclosporin',
  ciclosporin: 'ciclosporin',
  theophyllin: 'theophylline',
}

export function normalizeDrugName(raw: string): string {
  const cleaned = raw
    .toLowerCase()
    .replace(/[^a-z0-9 +\-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (!cleaned) return ''
  if (ALIASES[cleaned]) return ALIASES[cleaned]
  // Prefer longer aliases first so "co-trimoxazole" wins over partials.
  const sorted = Object.entries(ALIASES).sort((a, b) => b[0].length - a[0].length)
  for (const [alias, canon] of sorted) {
    if (cleaned.includes(alias)) return canon
  }
  return cleaned
}

/** Pack entries use canonical keys; pairs are unordered. */
export const INTERACTION_PACK: PackInteraction[] = [
  // —— Anticoagulation / antiplatelet ——
  {
    a: 'warfarin',
    b: 'aspirin',
    severity: 'major',
    description: 'Increased bleeding risk from additive anticoagulant/antiplatelet effects.',
    recommendation: 'Avoid unless specialist-directed; monitor INR and bleeding signs.',
  },
  {
    a: 'warfarin',
    b: 'nsaid',
    severity: 'major',
    description: 'NSAIDs increase GI bleed risk and may potentiate warfarin.',
    recommendation: 'Prefer paracetamol; if NSAID needed, shortest course + gastroprotection and INR check.',
  },
  {
    a: 'warfarin',
    b: 'co-trimoxazole',
    severity: 'major',
    description: 'Co-trimoxazole can markedly raise INR / bleeding risk with warfarin.',
    recommendation: 'Choose alternative antibiotic if possible; otherwise increase INR monitoring.',
  },
  {
    a: 'warfarin',
    b: 'metronidazole',
    severity: 'major',
    description: 'Metronidazole inhibits warfarin metabolism → elevated INR.',
    recommendation: 'Avoid or monitor INR closely and adjust warfarin.',
  },
  {
    a: 'warfarin',
    b: 'fluconazole',
    severity: 'major',
    description: 'Azole antifungals potentiate warfarin anticoagulation.',
    recommendation: 'Monitor INR; consider warfarin dose reduction.',
  },
  {
    a: 'warfarin',
    b: 'amiodarone',
    severity: 'major',
    description: 'Amiodarone inhibits warfarin metabolism → sustained INR rise.',
    recommendation: 'Expect lower warfarin needs; frequent INR for weeks after starting/stopping.',
  },
  {
    a: 'warfarin',
    b: 'rifampicin',
    severity: 'major',
    description: 'Rifampicin induces warfarin metabolism → reduced anticoagulation.',
    recommendation: 'Expect higher warfarin requirements; frequent INR monitoring.',
  },
  {
    a: 'warfarin',
    b: 'phenytoin',
    severity: 'major',
    description: 'Complex bidirectional interaction affecting INR and phenytoin levels.',
    recommendation: 'Monitor INR and phenytoin levels closely when starting or stopping either.',
  },
  {
    a: 'clopidogrel',
    b: 'omeprazole',
    severity: 'moderate',
    description: 'Omeprazole may reduce clopidogrel activation via CYP2C19.',
    recommendation: 'Prefer pantoprazole or an H2RA if acid suppression is needed.',
  },
  {
    a: 'ibuprofen',
    b: 'aspirin',
    severity: 'moderate',
    description: 'Ibuprofen may attenuate aspirin’s antiplatelet effect if timed poorly.',
    recommendation: 'Take aspirin ≥30 min before ibuprofen, or use another analgesic.',
  },
  {
    a: 'nsaid',
    b: 'aspirin',
    severity: 'moderate',
    description: 'NSAID + aspirin increases bleeding risk and may interfere with antiplatelet effect.',
    recommendation: 'Prefer paracetamol for pain when on aspirin cardioprotection.',
  },
  {
    a: 'ibuprofen',
    b: 'warfarin',
    severity: 'major',
    description: 'Ibuprofen with warfarin increases GI bleed / INR risk.',
    recommendation: 'Prefer paracetamol; if NSAID needed use shortest course with monitoring.',
  },

  // —— Methotrexate / cytotoxics ——
  {
    a: 'methotrexate',
    b: 'nsaid',
    severity: 'major',
    description: 'NSAIDs may reduce methotrexate clearance and increase toxicity.',
    recommendation: 'Avoid NSAIDs with methotrexate unless under specialist protocols.',
  },
  {
    a: 'methotrexate',
    b: 'co-trimoxazole',
    severity: 'major',
    description: 'Additive antifolate effect → severe methotrexate toxicity risk.',
    recommendation: 'Often contraindicated; seek specialist advice before dispensing.',
  },
  {
    a: 'allopurinol',
    b: 'azathioprine',
    severity: 'major',
    description: 'Allopurinol blocks azathioprine metabolism → life-threatening myelosuppression.',
    recommendation: 'Do not co-dispense without specialist dose reduction protocol.',
  },

  // —— PDE5 / nitrates ——
  {
    a: 'sildenafil',
    b: 'nitrates',
    severity: 'major',
    description: 'Profound hypotension from PDE5 inhibitor + nitrate.',
    recommendation: 'Absolute contraindication — do not dispense together.',
  },

  // —— Statins / CYP3A4 ——
  {
    a: 'simvastatin',
    b: 'clarithromycin',
    severity: 'major',
    description: 'CYP3A4 inhibition raises simvastatin → myopathy/rhabdomyolysis risk.',
    recommendation: 'Hold simvastatin during clarithromycin or switch agents.',
  },
  {
    a: 'simvastatin',
    b: 'erythromycin',
    severity: 'major',
    description: 'CYP3A4 inhibition raises simvastatin exposure.',
    recommendation: 'Avoid combination; choose alternative antibiotic or statin.',
  },
  {
    a: 'simvastatin',
    b: 'ketoconazole',
    severity: 'major',
    description: 'Strong CYP3A4 inhibition with azoles increases myopathy risk.',
    recommendation: 'Avoid; select a non-interacting antifungal if possible.',
  },
  {
    a: 'simvastatin',
    b: 'itraconazole',
    severity: 'major',
    description: 'Strong CYP3A4 inhibition increases simvastatin levels.',
    recommendation: 'Avoid co-administration.',
  },
  {
    a: 'simvastatin',
    b: 'diltiazem',
    severity: 'moderate',
    description: 'Diltiazem can increase simvastatin exposure.',
    recommendation: 'Limit simvastatin dose; watch for muscle symptoms.',
  },
  {
    a: 'simvastatin',
    b: 'amlodipine',
    severity: 'moderate',
    description: 'Amlodipine may raise simvastatin levels modestly.',
    recommendation: 'Keep simvastatin ≤20 mg/day or switch statin per local protocol.',
  },
  {
    a: 'atorvastatin',
    b: 'clarithromycin',
    severity: 'moderate',
    description: 'Clarithromycin can increase atorvastatin exposure.',
    recommendation: 'Consider temporary hold or dose limit; counsel on myalgia.',
  },
  {
    a: 'lopinavir-ritonavir',
    b: 'simvastatin',
    severity: 'major',
    description: 'Protease inhibitors strongly increase simvastatin exposure.',
    recommendation: 'Do not co-administer simvastatin; use compatible lipid therapy.',
  },

  // —— Digoxin / theophylline ——
  {
    a: 'digoxin',
    b: 'clarithromycin',
    severity: 'major',
    description: 'Clarithromycin can increase digoxin levels (P-gp).',
    recommendation: 'Monitor digoxin toxicity; adjust dose.',
  },
  {
    a: 'digoxin',
    b: 'amiodarone',
    severity: 'major',
    description: 'Amiodarone raises digoxin concentration substantially.',
    recommendation: 'Reduce digoxin dose and monitor levels/symptoms.',
  },
  {
    a: 'digoxin',
    b: 'verapamil',
    severity: 'major',
    description: 'Verapamil increases digoxin levels and AV-block risk.',
    recommendation: 'Avoid or reduce digoxin; monitor closely.',
  },
  {
    a: 'digoxin',
    b: 'quinine',
    severity: 'major',
    description: 'Quinine can raise digoxin concentration.',
    recommendation: 'Monitor digoxin; adjust dose during quinine courses.',
  },
  {
    a: 'theophylline',
    b: 'ciprofloxacin',
    severity: 'major',
    description: 'Ciprofloxacin inhibits theophylline metabolism → toxicity.',
    recommendation: 'Avoid or reduce theophylline; monitor levels/symptoms.',
  },
  {
    a: 'theophylline',
    b: 'erythromycin',
    severity: 'major',
    description: 'Erythromycin raises theophylline levels.',
    recommendation: 'Avoid combination or monitor theophylline closely.',
  },

  // —— Chelation / absorption ——
  {
    a: 'ciprofloxacin',
    b: 'iron',
    severity: 'moderate',
    description: 'Polyvalent cations bind fluoroquinolones and cut absorption.',
    recommendation: 'Separate by ≥2–4 hours; prefer completing antibiotic first.',
  },
  {
    a: 'ciprofloxacin',
    b: 'antacid',
    severity: 'moderate',
    description: 'Antacids/minerals reduce ciprofloxacin absorption.',
    recommendation: 'Space doses; counsel patients not to take together.',
  },
  {
    a: 'ciprofloxacin',
    b: 'dairy',
    severity: 'moderate',
    description: 'Calcium in dairy can reduce fluoroquinolone absorption.',
    recommendation: 'Avoid milk/yoghurt near the antibiotic dose.',
  },
  {
    a: 'fluoroquinolone',
    b: 'iron',
    severity: 'moderate',
    description: 'Iron chelates fluoroquinolones → treatment failure risk.',
    recommendation: 'Separate administration by several hours.',
  },
  {
    a: 'doxycycline',
    b: 'iron',
    severity: 'moderate',
    description: 'Iron reduces tetracycline-class absorption.',
    recommendation: 'Separate doses; counsel on timing.',
  },
  {
    a: 'doxycycline',
    b: 'antacid',
    severity: 'moderate',
    description: 'Antacids reduce doxycycline absorption.',
    recommendation: 'Space administration; avoid concurrent dosing.',
  },
  {
    a: 'doxycycline',
    b: 'calcium',
    severity: 'moderate',
    description: 'Calcium binds doxycycline and lowers bioavailability.',
    recommendation: 'Separate calcium supplements from doxycycline.',
  },
  {
    a: 'tetracycline',
    b: 'dairy',
    severity: 'moderate',
    description: 'Dairy products reduce tetracycline absorption.',
    recommendation: 'Take tetracycline away from milk products.',
  },
  {
    a: 'levothyroxine',
    b: 'iron',
    severity: 'moderate',
    description: 'Iron reduces levothyroxine absorption.',
    recommendation: 'Separate by ≥4 hours; monitor TSH if chronic.',
  },
  {
    a: 'levothyroxine',
    b: 'calcium',
    severity: 'moderate',
    description: 'Calcium reduces levothyroxine absorption.',
    recommendation: 'Separate by ≥4 hours; take thyroxine on empty stomach.',
  },
  {
    a: 'dolutegravir',
    b: 'antacid',
    severity: 'moderate',
    description: 'Polyvalent cations reduce dolutegravir absorption.',
    recommendation: 'Dose DTG 2h before or 6h after antacids/minerals.',
  },
  {
    a: 'dolutegravir',
    b: 'iron',
    severity: 'moderate',
    description: 'Iron supplements can reduce dolutegravir exposure.',
    recommendation: 'Separate dosing per ART counselling guidance.',
  },
  {
    a: 'dolutegravir',
    b: 'metformin',
    severity: 'moderate',
    description: 'DTG increases metformin exposure.',
    recommendation: 'Consider metformin dose limit/monitoring for GI/lactic risk.',
  },

  // —— RAAS / electrolytes / renal ——
  {
    a: 'ace-inhibitor',
    b: 'potassium',
    severity: 'major',
    description: 'Additive hyperkalaemia risk.',
    recommendation: 'Avoid potassium supplements unless monitored; check electrolytes.',
  },
  {
    a: 'ace-inhibitor',
    b: 'spironolactone',
    severity: 'major',
    description: 'Dual RAAS blockade / potassium retention → hyperkalaemia.',
    recommendation: 'Use only with monitoring protocols; check K+ and renal function.',
  },
  {
    a: 'ace-inhibitor',
    b: 'nsaid',
    severity: 'moderate',
    description: 'NSAIDs may blunt ACEI effect and worsen renal function.',
    recommendation: 'Prefer short NSAID courses; monitor renal function in at-risk patients.',
  },
  {
    a: 'arb',
    b: 'potassium',
    severity: 'major',
    description: 'ARBs plus potassium increase hyperkalaemia risk.',
    recommendation: 'Avoid unmonitored potassium supplements.',
  },
  {
    a: 'arb',
    b: 'spironolactone',
    severity: 'major',
    description: 'Combined potassium retention → dangerous hyperkalaemia.',
    recommendation: 'Specialist regimens only with lab monitoring.',
  },
  {
    a: 'tenofovir',
    b: 'nsaid',
    severity: 'moderate',
    description: 'Additive renal toxicity risk with tenofovir + NSAIDs.',
    recommendation: 'Avoid prolonged NSAIDs; monitor renal function.',
  },
  {
    a: 'aminoglycoside',
    b: 'furosemide',
    severity: 'major',
    description: 'Additive ototoxicity/nephrotoxicity risk.',
    recommendation: 'Avoid concurrent use when possible; monitor levels/renal/hearing.',
  },

  // —— CNS / serotonin / opioids ——
  {
    a: 'ssri',
    b: 'tramadol',
    severity: 'major',
    description: 'Serotonin syndrome and seizure-risk potentiation.',
    recommendation: 'Prefer non-serotonergic analgesic; counsel urgently if co-used.',
  },
  {
    a: 'ssri',
    b: 'linezolid',
    severity: 'major',
    description: 'Linezolid + SSRI → serotonin syndrome risk.',
    recommendation: 'Avoid combination; seek alternative antibiotic/antidepressant plan.',
  },
  {
    a: 'ssri',
    b: 'tamoxifen',
    severity: 'moderate',
    description: 'Strong CYP2D6-inhibiting SSRIs may reduce tamoxifen activation.',
    recommendation: 'Prefer non-interacting SSRI (e.g. sertraline/citalopram per protocol).',
  },
  {
    a: 'lithium',
    b: 'nsaid',
    severity: 'major',
    description: 'NSAIDs reduce lithium clearance → toxicity.',
    recommendation: 'Avoid NSAIDs; if unavoidable, monitor lithium levels closely.',
  },
  {
    a: 'lithium',
    b: 'ace-inhibitor',
    severity: 'major',
    description: 'ACE inhibitors can raise lithium levels.',
    recommendation: 'Monitor lithium and renal function; adjust dose.',
  },
  {
    a: 'opioid',
    b: 'alcohol',
    severity: 'major',
    description: 'Additive CNS and respiratory depression.',
    recommendation: 'Strong counselling against alcohol; consider safer analgesic plan.',
  },
  {
    a: 'tramadol',
    b: 'opioid',
    severity: 'moderate',
    description: 'Additive opioid effects and seizure/serotonin risk with tramadol.',
    recommendation: 'Avoid stacking unless intentional multimodal plan with monitoring.',
  },

  // —— Diabetes / alcohol ——
  {
    a: 'metformin',
    b: 'alcohol',
    severity: 'moderate',
    description: 'Alcohol increases lactic acidosis and hypoglycaemia risk with metformin.',
    recommendation: 'Counsel against heavy alcohol; review in acute illness/dehydration.',
  },
  {
    a: 'sulfonylurea',
    b: 'alcohol',
    severity: 'moderate',
    description: 'Alcohol potentiates hypoglycaemia with sulfonylureas.',
    recommendation: 'Counsel on alcohol and hypo recognition/treatment.',
  },
  {
    a: 'metronidazole',
    b: 'alcohol',
    severity: 'moderate',
    description: 'Disulfiram-like reaction possible with alcohol.',
    recommendation: 'No alcohol during therapy and for 48h after the last dose.',
  },

  // —— TB / malaria / HIV extras ——
  {
    a: 'rifampicin',
    b: 'hormonal-contraceptive',
    severity: 'major',
    description: 'Rifampicin induces metabolism → contraceptive failure risk.',
    recommendation: 'Advise additional/alternative contraception during and after rifampicin.',
  },
  {
    a: 'carbamazepine',
    b: 'hormonal-contraceptive',
    severity: 'major',
    description: 'Enzyme induction reduces contraceptive efficacy.',
    recommendation: 'Recommend reliable non-interacting contraception.',
  },
  {
    a: 'efavirenz',
    b: 'hormonal-contraceptive',
    severity: 'moderate',
    description: 'Efavirenz may reduce some hormonal contraceptive effectiveness.',
    recommendation: 'Follow national ART/FP guidance; consider dual protection.',
  },
  {
    a: 'isoniazid',
    b: 'paracetamol',
    severity: 'moderate',
    description: 'Combined hepatotoxicity risk, especially with high paracetamol intake.',
    recommendation: 'Limit paracetamol dose; counsel on alcohol and liver warning signs.',
  },
  {
    a: 'isoniazid',
    b: 'carbamazepine',
    severity: 'major',
    description: 'INH can raise carbamazepine levels → toxicity.',
    recommendation: 'Monitor carbamazepine levels/toxicity; adjust dose.',
  },
  {
    a: 'artemether-lumefantrine',
    b: 'erythromycin',
    severity: 'moderate',
    description: 'QT prolongation risk with interacting macrolides / AL.',
    recommendation: 'Avoid QT-prolonging combinations; review cardiac risk factors.',
  },
  {
    a: 'artemether-lumefantrine',
    b: 'clarithromycin',
    severity: 'moderate',
    description: 'Additive QT risk with clarithromycin and AL.',
    recommendation: 'Prefer non-interacting antibiotic if feasible.',
  },
  {
    a: 'quinine',
    b: 'erythromycin',
    severity: 'moderate',
    description: 'Both can prolong QT; arrhythmia risk rises.',
    recommendation: 'Avoid combination in high-risk patients.',
  },
  {
    a: 'amlodipine',
    b: 'clarithromycin',
    severity: 'moderate',
    description: 'Clarithromycin can increase calcium-channel blocker exposure → hypotension.',
    recommendation: 'Monitor BP; consider alternative antibiotic in elderly/frail.',
  },
  {
    a: 'ciclosporin',
    b: 'clarithromycin',
    severity: 'major',
    description: 'Macrolides raise ciclosporin levels → nephrotoxicity.',
    recommendation: 'Avoid or monitor levels intensively with specialist oversight.',
  },
  {
    a: 'ciclosporin',
    b: 'nsaid',
    severity: 'major',
    description: 'NSAIDs plus ciclosporin increase renal injury risk.',
    recommendation: 'Avoid NSAIDs; use alternatives for pain.',
  },
]

function pairKey(a: string, b: string): string {
  return [a, b].sort().join('|')
}

const INDEX = new Map<string, PackInteraction>()
for (const row of INTERACTION_PACK) {
  INDEX.set(pairKey(row.a, row.b), row)
}

export type MatchedInteraction = PackInteraction & {
  drugs: string[]
  source: string
  knowledgeVersion: string
}

/** Evaluate all unordered pairs against the deterministic pack. */
export function matchPackInteractions(drugNames: string[]): MatchedInteraction[] {
  const canonical = drugNames.map(normalizeDrugName).filter(Boolean)
  const unique = [...new Set(canonical)]
  const hits: MatchedInteraction[] = []
  const seen = new Set<string>()

  for (let i = 0; i < unique.length; i++) {
    for (let j = i + 1; j < unique.length; j++) {
      const key = pairKey(unique[i]!, unique[j]!)
      if (seen.has(key)) continue
      const hit = INDEX.get(key)
      if (!hit) continue
      seen.add(key)
      hits.push({
        ...hit,
        drugs: [unique[i]!, unique[j]!],
        source: KNOWLEDGE_SOURCE,
        knowledgeVersion: KNOWLEDGE_VERSION,
      })
    }
  }

  const rank = { major: 0, moderate: 1, minor: 2 }
  return hits.sort((a, b) => rank[a.severity] - rank[b.severity])
}

export function packSize(): number {
  return INTERACTION_PACK.length
}
