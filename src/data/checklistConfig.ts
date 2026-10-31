import {
  ChecklistDefinition,
  ChecklistItemResult,
  ChecklistCustomInputs,
  OperatingParameters,
  ReadinessStatus,
  Servicing300HrDetails,
  ServicingTaskItem,
  ReplacementPart,
  BreakdownDetails,
} from '../types';
import { saveAppConfigToFirestore } from '../utils/indexedDbSync';

export const CHECKLIST_DEFINITIONS: ChecklistDefinition[] = [
  {
    itemNo: 1,
    description: 'Controller Condition ကောင်းမွန်မှု ရှိ/မရှိ',
    type: 'segmented',
    options: ['Good', 'Bad'],
    goodOptions: ['Good'],
    criticalOptions: ['Bad'],
  },
  {
    itemNo: 2,
    description: 'Engine Oil Level သည် Min နှင့် Max ကြားရှိ Standard တွင် ရှိ/မရှိ',
    type: 'segmented',
    options: ['Standard', 'Min', 'Max'],
    remarkHint: 'Engine Oil ဖြည့်ရသည့် Ltr ရေးရန်',
    goodOptions: ['Standard'],
    warningOptions: ['Min', 'Max'],
  },
  {
    itemNo: 3,
    description: 'Fuel Level သည် 80 % နှင့် အထက် ရှိ/မရှိ',
    type: 'segmented',
    options: ['Good Above 80%', 'Bad Low 80%'],
    goodOptions: ['Good Above 80%'],
    warningOptions: ['Bad Low 80%'],
  },
  {
    itemNo: 4,
    description: 'Fuel Water Separator တွင် သန့်ရှင်းမှု ရှိ/မရှိ',
    type: 'segmented',
    options: ['Normal', 'Water & Dust', 'Need Clean Tank'],
    goodOptions: ['Normal'],
    warningOptions: ['Water & Dust'],
    criticalOptions: ['Need Clean Tank'],
  },
  {
    itemNo: 5,
    description: 'Air Filter ကောင်းမွန်မှု ရှိ/မရှိ',
    type: 'segmented',
    options: ['Good', 'Replace'],
    goodOptions: ['Good'],
    warningOptions: ['Replace'],
  },
  {
    itemNo: 6,
    description: 'Radiator Cap ကောင်းမွန်မှု ရှိ မရှိ',
    type: 'segmented',
    options: ['Good', 'Replace'],
    goodOptions: ['Good'],
    warningOptions: ['Replace'],
  },
  {
    itemNo: 7,
    description: 'Radiator Fin ကောင်းမွန်မှု ရှိ မရှိ',
    type: 'segmented',
    options: ['Normal', 'Minor', 'Major'],
    goodOptions: ['Normal'],
    warningOptions: ['Minor'],
    criticalOptions: ['Major'],
  },
  {
    itemNo: 8,
    description: 'Coolant Color, Coolant Level and Test',
    type: 'segmented',
    options: ['Good', 'Replace'],
    remarkHint: 'Coolant ဖြည့်ရသည့် Ltr ရေးရန်',
    goodOptions: ['Good'],
    warningOptions: ['Replace'],
  },
  {
    itemNo: 9,
    description: 'Battery Purchase Date & Nos',
    type: 'custom_9',
  },
  {
    itemNo: 10,
    description: 'Battery Voltage & Ah',
    type: 'custom_10',
  },
  {
    itemNo: 11,
    description: 'Battery SOC (Charges) / SOH (Health)',
    type: 'custom_11',
  },
  {
    itemNo: 12,
    description: 'Battery ခေါင်းများ နှင့် ကြိုးတလျှောက် ကောင်းမွန် တင်းကြပ်နေခြင်း',
    type: 'segmented',
    options: ['Good', 'Good with Repaired', 'Bad'],
    goodOptions: ['Good'],
    warningOptions: ['Good with Repaired'],
    criticalOptions: ['Bad'],
  },
  {
    itemNo: 13,
    description: 'All Fan Belts & Fan Parts / Cover Condition',
    type: 'segmented',
    options: ['Good', 'Need Replace'],
    goodOptions: ['Good'],
    warningOptions: ['Need Replace'],
  },
  {
    itemNo: 14,
    description: 'All Pipe Connection & Condition (Oil/ Water/ Fuel/ Air)',
    type: 'segmented',
    options: ['Good', 'Need Repair'],
    goodOptions: ['Good'],
    warningOptions: ['Need Repair'],
  },
  {
    itemNo: 15,
    description: 'Dynamo (Charging Alternator) သန့်ရှင်း၊ ကောင်းမွန်ခြင်း ရှိ/မရှိ',
    type: 'segmented',
    options: ['Good', 'Need Clean'],
    goodOptions: ['Good'],
    warningOptions: ['Need Clean'],
  },
  {
    itemNo: 16,
    description: 'Main Alternator & Fly Wheel သန့်ရှင်းမှု ရှိ/မရှိ',
    type: 'segmented',
    options: ['Good', 'Need Clean'],
    goodOptions: ['Good'],
    warningOptions: ['Need Clean'],
  },
  {
    itemNo: 17,
    description: 'Exhaust Smoke Condition',
    type: 'segmented',
    options: ['Normal', 'Blue', 'Black', 'White'],
    goodOptions: ['Normal'],
    warningOptions: ['Black', 'White'],
    criticalOptions: ['Blue'],
  },
  {
    itemNo: 18,
    description: 'Genset Test Run After Service / Inspection',
    type: 'segmented',
    options: ['Normal', 'Bad'],
    goodOptions: ['Normal'],
    criticalOptions: ['Bad'],
  },
  {
    itemNo: 19,
    description: 'မီးစက်မောင်းနှင်ပြီးပါက Controller မှ Battery V ဖော်ပြရန်',
    type: 'custom_19',
  },
  {
    itemNo: 20,
    description: 'Walk-Around Inspection for LEAK (Oil/ Water/ Fuel/ Air)',
    type: 'segmented',
    options: ['Good (No Leakage)', 'Bad'],
    goodOptions: ['Good (No Leakage)'],
    criticalOptions: ['Bad'],
  },
  {
    itemNo: 21,
    description: 'မီးစက်မောင်းနှင်ပြီးပါက Engine Oil နှင့် Coolant Level စစ်ရန်',
    type: 'segmented',
    options: ['Standard lvl', 'Bad'],
    goodOptions: ['Standard lvl'],
    criticalOptions: ['Bad'],
  },
  {
    itemNo: 22,
    description: 'မီးစက် ဧရိယာအတွင်း Fire Extinguisher ရှိ/မရှိ',
    type: 'segmented',
    options: ['Yes', 'No'],
    goodOptions: ['Yes'],
    warningOptions: ['No'],
  },
  {
    itemNo: 23,
    description: 'Genset Spare Part ရှိ/မရှိ\nခါးပတ် - 1 no\nAll Filter ( Include Air Filters ) - 1 sets\nEngine Oil - 1 sets (Service 1 ကြိမ်စာ)',
    type: 'segmented',
    options: ['Standard', 'Not Have'],
    goodOptions: ['Standard'],
    warningOptions: ['Not Have'],
  },
  {
    itemNo: 24,
    description: 'Genset Inside Body သန့်ရှင်းမှု ရှိ/မရှိ',
    type: 'segmented_photo_24',
    options: ['Green', 'Amber', 'Red'],
    remarkHint: 'Clean မလုပ်ခင် အနေထားကို Tip လုပ်ပြီး Photo Record ယူရန်',
    goodOptions: ['Green'],
    warningOptions: ['Amber'],
    criticalOptions: ['Red'],
  },
  {
    itemNo: 25,
    description: 'Genset Outside Body နှင့် ဧရိယာအတွင်း သန့်ရှင်းမှု ရှိ/မရှိ',
    type: 'segmented',
    options: ['Green', 'Amber', 'Red'],
    goodOptions: ['Green'],
    warningOptions: ['Amber'],
    criticalOptions: ['Red'],
  },
  {
    itemNo: 26,
    description:
      'Overall Generator Readiness Status (မီးစက်၏ အသင့်ဖြစ်မှု အခြေအနေ — Ready / Action Required / Critical)',
    type: 'segmented',
    options: ['Ready', 'Action Required', 'Critical'],
    remarkHint: 'Readiness Status မှတ်ချက် (Ready / Action Required / Critical)',
    goodOptions: ['Ready'],
    warningOptions: ['Action Required'],
    criticalOptions: ['Critical'],
  },
];

export const DEFAULT_CHECKLIST_DEFINITIONS: ChecklistDefinition[] = CHECKLIST_DEFINITIONS.map((d) => ({
  ...d,
  options: d.options ? [...d.options] : undefined,
  goodOptions: d.goodOptions ? [...d.goodOptions] : undefined,
  warningOptions: d.warningOptions ? [...d.warningOptions] : undefined,
  criticalOptions: d.criticalOptions ? [...d.criticalOptions] : undefined,
}));

const CUSTOM_CHECKLIST_STORAGE_KEY = 'cp_custom_checklist_defs_v1';
const CUSTOM_JOB_TYPES_STORAGE_KEY = 'cp_custom_job_types_v1';

export const DEFAULT_JOB_TYPE_PRESETS: string[] = [
  'Regular Inspection',
  '300-Hr Running Servicing',
  'Emergency Breakdown',
  'Major Servicing',
  'Radiator Major Cleaning',
  'Radiator Minor Cleaning',
  'Minor Servicing',
];

export function getActiveJobTypePresets(): string[] {
  if (typeof window === 'undefined') return [...DEFAULT_JOB_TYPE_PRESETS];
  try {
    const raw = window.localStorage.getItem(CUSTOM_JOB_TYPES_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch {
    // ignore storage errors
  }
  return [...DEFAULT_JOB_TYPE_PRESETS];
}

export function saveCustomJobTypePresets(presets: string[]): string[] {
  const cleaned = Array.from(new Set(presets.map((p) => p.trim()).filter(Boolean)));
  const finalPresets = cleaned.length > 0 ? cleaned : [...DEFAULT_JOB_TYPE_PRESETS];
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(CUSTOM_JOB_TYPES_STORAGE_KEY, JSON.stringify(finalPresets));
    } catch {
      // ignore
    }
  }
  saveAppConfigToFirestore('CFG_JOB_TYPE_PRESETS', 'JOB_TYPE_PRESETS', {
    presets: finalPresets,
  }).catch(() => {});
  return finalPresets;
}

export function getActiveChecklistDefinitions(): ChecklistDefinition[] {
  if (typeof window !== 'undefined') {
    try {
      const raw = window.localStorage.getItem(CUSTOM_CHECKLIST_STORAGE_KEY);
      if (raw) {
        const parsed: ChecklistDefinition[] = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Ensure item 26 (Overall Readiness) is always present
          const has26 = parsed.some((d) => d.itemNo === 26);
          const item26Default = DEFAULT_CHECKLIST_DEFINITIONS.find((d) => d.itemNo === 26)!;
          const merged = has26 ? parsed : [...parsed, item26Default];
          CHECKLIST_DEFINITIONS.splice(0, CHECKLIST_DEFINITIONS.length, ...merged);
          return CHECKLIST_DEFINITIONS;
        }
      }
    } catch {
      // fallback to default
    }
  }
  return CHECKLIST_DEFINITIONS;
}

export function saveCustomChecklistDefinitions(defs: ChecklistDefinition[]): ChecklistDefinition[] {
  const has26 = defs.some((d) => d.itemNo === 26);
  const item26Default = DEFAULT_CHECKLIST_DEFINITIONS.find((d) => d.itemNo === 26)!;
  const normalized = (has26 ? [...defs] : [...defs, item26Default]).sort((a, b) => a.itemNo - b.itemNo);
  CHECKLIST_DEFINITIONS.splice(0, CHECKLIST_DEFINITIONS.length, ...normalized);
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(CUSTOM_CHECKLIST_STORAGE_KEY, JSON.stringify(normalized));
    } catch {
      // ignore storage errors
    }
  }
  saveAppConfigToFirestore('CFG_CHECKLIST_DEFINITIONS', 'CHECKLIST_DEFINITIONS', {
    definitions: normalized,
  }).catch(() => {});
  return CHECKLIST_DEFINITIONS;
}

export function resetChecklistDefinitionsToDefault(): ChecklistDefinition[] {
  const restored = DEFAULT_CHECKLIST_DEFINITIONS.map((d) => ({
    ...d,
    options: d.options ? [...d.options] : undefined,
    goodOptions: d.goodOptions ? [...d.goodOptions] : undefined,
    warningOptions: d.warningOptions ? [...d.warningOptions] : undefined,
    criticalOptions: d.criticalOptions ? [...d.criticalOptions] : undefined,
  }));
  CHECKLIST_DEFINITIONS.splice(0, CHECKLIST_DEFINITIONS.length, ...restored);
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.removeItem(CUSTOM_CHECKLIST_STORAGE_KEY);
    } catch {
      // ignore
    }
  }
  saveAppConfigToFirestore('CFG_CHECKLIST_DEFINITIONS', 'CHECKLIST_DEFINITIONS', {
    definitions: restored,
  }).catch(() => {});
  return CHECKLIST_DEFINITIONS;
}

// Initialize in-memory CHECKLIST_DEFINITIONS from storage if available
getActiveChecklistDefinitions();

export function createDefaultChecklist(): Record<number, ChecklistItemResult> {
  const activeDefs = getActiveChecklistDefinitions();
  const result: Record<number, ChecklistItemResult> = {};
  for (const def of activeDefs) {
    result[def.itemNo] = {
      itemNo: def.itemNo,
      selectedOption: def.options ? def.options[0] : 'Completed',
      remark: '',
    };
  }
  return result;
}

export function createDefaultCustomInputs(): ChecklistCustomInputs {
  return {
    batteryDate1: '24.4.26',
    batteryDate2: '24.4.26',
    batteryNos: '2',
    batteryVolt: '12',
    batteryAh: '200',
    batteryCca: '1156',
    batterySlots: [
      { soc: '98%', soh: '96%' },
      { soc: '98%', soh: '95%' },
      { soc: '', soh: '' },
      { soc: '', soh: '' },
    ],
    chargeAltrV: '26.5',
    controllerBatteryV: '26V',
    insideBodyBeforePhoto: '',
    insideBodyAfterPhoto: '',
  };
}

export function evaluateInspectionHealth(
  checklist: Record<number, ChecklistItemResult>,
  customInputs: ChecklistCustomInputs,
  parameters: OperatingParameters
): {
  healthScore: number;
  readinessStatus: ReadinessStatus;
  defectsList: string[];
} {
  let totalPoints = 0;
  let earnedPoints = 0;
  const defectsList: string[] = [];
  let hasCritical = false;

  for (const def of CHECKLIST_DEFINITIONS) {
    if (def.itemNo === 26) continue; // Item 26 is the Overall Readiness Status selector
    const item = checklist[def.itemNo];
    if (!item) continue;

    if (def.options && def.options.length > 0) {
      totalPoints += 4;
      const val = item.selectedOption;
      if (def.goodOptions?.includes(val)) {
        earnedPoints += 4;
      } else if (def.warningOptions?.includes(val)) {
        earnedPoints += 2;
        defectsList.push(`#${def.itemNo} ${getShortDefectName(def.itemNo, val)}`);
      } else if (def.criticalOptions?.includes(val)) {
        earnedPoints += 0;
        hasCritical = true;
        defectsList.push(`#${def.itemNo} ${getShortDefectName(def.itemNo, val)} (Critical)`);
      } else {
        earnedPoints += 4;
      }
    } else {
      // Custom input items (9, 10, 11, 19)
      totalPoints += 4;
      if (def.itemNo === 10) {
        const cca = parseFloat(customInputs.batteryCca || '0');
        if (cca > 0 && cca < 650) {
          earnedPoints += 2;
          defectsList.push('#10 Low Battery CCA (<650)');
        } else {
          earnedPoints += 4;
        }
      } else {
        earnedPoints += 4;
      }
    }
  }

  // Operating parameter checks
  if (parameters.engineOilPressureBar > 0 && parameters.engineOilPressureBar < 3.5) {
    hasCritical = true;
    defectsList.push(`Low Oil Pressure (${parameters.engineOilPressureBar} Bar)`);
    earnedPoints = Math.max(0, earnedPoints - 8);
  }
  const voltages = [parameters.voltageL1L2, parameters.voltageL1L3, parameters.voltageL2L3];
  if (voltages.some((v) => v > 0 && (v < 380 || v > 415))) {
    defectsList.push('Voltage Out of Range (380V-415V)');
    earnedPoints = Math.max(0, earnedPoints - 4);
  }
  if (parameters.frequencyHz > 0 && (parameters.frequencyHz < 49 || parameters.frequencyHz > 51)) {
    defectsList.push(`Frequency Deviation (${parameters.frequencyHz} Hz)`);
    earnedPoints = Math.max(0, earnedPoints - 4);
  }

  const healthScore = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 100;

  let readinessStatus: ReadinessStatus = 'Ready';
  if (hasCritical || healthScore < 75) {
    readinessStatus = 'Critical';
  } else if (defectsList.length > 0 || healthScore < 95) {
    readinessStatus = 'Action Required';
  }

  // Check Item 26 (Overall Readiness Status scroll tab at bottom of Step C)
  const item26Selection = checklist[26]?.selectedOption;
  if (item26Selection === 'Critical') {
    readinessStatus = 'Critical';
  } else if (item26Selection === 'Action Required' && readinessStatus === 'Ready') {
    readinessStatus = 'Action Required';
  }

  return {
    healthScore,
    readinessStatus,
    defectsList,
  };
}

function getShortDefectName(itemNo: number, selectedOption: string): string {
  const map: Record<number, string> = {
    1: 'Controller Fault',
    2: `Engine Oil Level (${selectedOption})`,
    3: 'Fuel Level Below 80%',
    4: `Fuel Water Separator (${selectedOption})`,
    5: 'Air Filter Replace',
    6: 'Radiator Cap Replace',
    7: `Radiator Fin (${selectedOption})`,
    8: 'Coolant Replace',
    12: `Battery Cable/Terminal (${selectedOption})`,
    13: 'Fan Belt Replace',
    14: 'Pipe Connection Repair',
    15: 'Dynamo Need Clean',
    16: 'Main Alternator Need Clean',
    17: `Exhaust Smoke (${selectedOption})`,
    18: 'Test Run Abnormal',
    20: 'Fluid/Air Leakage Detected',
    21: 'Post-Run Oil/Coolant Level Low',
    22: 'Fire Extinguisher Missing',
    23: 'Spare Parts Incomplete',
    24: `Inside Body Cleanliness (${selectedOption})`,
    25: `Outside Body Cleanliness (${selectedOption})`,
    26: `Overall Readiness (${selectedOption})`,
  };
  return map[itemNo] || `Item #${itemNo}: ${selectedOption}`;
}

export function parseRunningHoursToDecimal(hrsStr: string): number {
  if (!hrsStr) return 0;
  const cleaned = hrsStr.trim();
  if (cleaned.includes(':')) {
    const [hPart, mPart] = cleaned.split(':');
    const h = parseFloat(hPart) || 0;
    const m = parseFloat(mPart) || 0;
    return Math.round((h + m / 60) * 10) / 10;
  }
  return parseFloat(cleaned) || 0;
}

export function addRunningHours(hrsStr: string, addHrs: number): string {
  if (!hrsStr) return `${addHrs}:00`;
  const cleaned = hrsStr.trim();
  if (cleaned.includes(':')) {
    const [hPart, mPart] = cleaned.split(':');
    const h = (parseInt(hPart, 10) || 0) + addHrs;
    const m = mPart ? mPart.padStart(2, '0') : '00';
    return `${h}:${m}`;
  }
  const num = (parseFloat(cleaned) || 0) + addHrs;
  return `${Math.round(num)}:00`;
}

export const DEFAULT_SERVICING_TASKS_TEMPLATE: ServicingTaskItem[] = [
  {
    taskNo: 1,
    description: 'Drain Old Engine Oil & Refill Fresh Engine Oil (15W-40 CI-4) အင်ဂျင်ဝိုင်အဟောင်းဖောက်ချပြီး အသစ်လဲလှယ်ခြင်း',
    status: 'Completed / Replaced',
    quantityOrValue: '50 Ltr',
    partNumberUsed: '15W-40 CI-4 (18L x 3)',
    remark: 'Sump drained hot, refilled to Max mark',
  },
  {
    taskNo: 2,
    description: 'Replace Lube Oil Filter Element(s) အင်ဂျင်ဝိုင်ဖစ်တာ အသစ်လဲလှယ်ခြင်း',
    status: 'Completed / Replaced',
    quantityOrValue: '2 Nos',
    partNumberUsed: 'LF-3349 / LF-9009',
    remark: 'O-ring lubricated and torqued',
  },
  {
    taskNo: 3,
    description: 'Replace Primary & Secondary Fuel Filters ဒီဇယ်ဖစ်တာ အသစ်လဲလှယ်ခြင်း',
    status: 'Completed / Replaced',
    quantityOrValue: '2 Nos',
    partNumberUsed: 'FF-5052 / FS-1280',
    remark: 'Primed fuel system and bled air',
  },
  {
    taskNo: 4,
    description: 'Drain & Replace Fuel Water Separator Filter Element ရေစစ်ဖစ်တာ သန့်ရှင်း/အသစ်လဲလှယ်ခြင်း',
    status: 'Completed / Replaced',
    quantityOrValue: '1 No',
    partNumberUsed: 'FS-1000',
    remark: 'Bowl cleaned and sensor checked',
  },
  {
    taskNo: 5,
    description: 'Inspect / Replace Air Filter Element (Outer & Inner) လေစစ်ဖစ်တာ စစ်ဆေး/အသစ်လဲလှယ်ခြင်း',
    status: 'Cleaned / Adjusted',
    quantityOrValue: '1 Set',
    partNumberUsed: 'AF-25276',
    remark: 'Blown clean & housing wiped',
  },
  {
    taskNo: 6,
    description: 'Replace Bypass / Coolant Filter & Check DCA4 Additive Level ရေတိုင်ကီဖစ်တာနှင့် Coolant စစ်ဆေးလဲလှယ်ခြင်း',
    status: 'Completed / Replaced',
    quantityOrValue: '1 No / 5 Ltr',
    partNumberUsed: 'WF-2071',
    remark: 'Coolant concentration verified',
  },
  {
    taskNo: 7,
    description: 'Inspect & Adjust Fan Belt & Alternator Charging Belt Tension ပန်ကာကြိုးနှင့် ဒိုင်နမိုကြိုး တင်းအားချိန်ညှိခြင်း',
    status: 'Cleaned / Adjusted',
    quantityOrValue: '10 mm Deflection',
    partNumberUsed: '-',
    remark: 'Tension within OEM spec',
  },
  {
    taskNo: 8,
    description: 'Clean Crankcase Breather Tube & Valve Cover Mesh အင်ဂျင် လေထွက်ပိုက် သန့်ရှင်းရေးလုပ်ခြင်း',
    status: 'Cleaned / Adjusted',
    quantityOrValue: '1 Lot',
    partNumberUsed: '-',
    remark: 'Clear of sludge buildup',
  },
  {
    taskNo: 9,
    description: 'Battery Electrolyte Specific Gravity, CCA Test & Terminal Greasing ဘက်ထရီ CCA တိုင်းတာခြင်းနှင့် ခေါင်းဆီလိမ်းခြင်း',
    status: 'Checked Good',
    quantityOrValue: '24V / 1150 CCA',
    partNumberUsed: '-',
    remark: 'Terminals tightened and greased',
  },
  {
    taskNo: 10,
    description: '300-Hour Post-Service Full Test Run & Oil/Fuel Pressure Leak Verification ဆားဗစ်ပြီးနောက် စမ်းသပ်မောင်းနှင်စစ်ဆေးခြင်း',
    status: 'Checked Good',
    quantityOrValue: '5.6 Bar / 50 Hz',
    partNumberUsed: '-',
    remark: 'Zero oil or fuel leaks around new filters',
  },
];

const CUSTOM_SERVICING_TASKS_STORAGE_KEY = 'cp_custom_300hr_tasks_v1';

export function getActiveServicingTasksTemplate(): ServicingTaskItem[] {
  if (typeof window !== 'undefined') {
    try {
      const raw = window.localStorage.getItem(CUSTOM_SERVICING_TASKS_STORAGE_KEY);
      if (raw) {
        const parsed: ServicingTaskItem[] = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((t, idx) => ({ ...t, taskNo: idx + 1 }));
        }
      }
    } catch {
      // fallback to default
    }
  }
  return DEFAULT_SERVICING_TASKS_TEMPLATE.map((t) => ({ ...t }));
}

export function saveCustomServicingTasksTemplate(tasks: ServicingTaskItem[]): ServicingTaskItem[] {
  const reindexed = tasks.map((t, idx) => ({ ...t, taskNo: idx + 1 }));
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(CUSTOM_SERVICING_TASKS_STORAGE_KEY, JSON.stringify(reindexed));
    } catch {
      // ignore
    }
  }
  saveAppConfigToFirestore('CFG_SERVICING_300HR_TASKS', 'SERVICING_300HR_TASKS', {
    tasks: reindexed,
  }).catch(() => {});
  return reindexed;
}

export function resetServicingTasksTemplateToDefault(): ServicingTaskItem[] {
  const restored = DEFAULT_SERVICING_TASKS_TEMPLATE.map((t) => ({ ...t }));
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.removeItem(CUSTOM_SERVICING_TASKS_STORAGE_KEY);
    } catch {
      // ignore
    }
  }
  saveAppConfigToFirestore('CFG_SERVICING_300HR_TASKS', 'SERVICING_300HR_TASKS', {
    tasks: restored,
  }).catch(() => {});
  return restored;
}

export function applyRemoteChecklistAppConfig(
  configType: string,
  configData: Record<string, unknown>
): void {
  if (typeof window === 'undefined' || !configData) return;
  try {
    if (
      configType === 'CHECKLIST_DEFINITIONS' &&
      Array.isArray(configData.definitions) &&
      configData.definitions.length > 0
    ) {
      const defs = configData.definitions as ChecklistDefinition[];
      const has26 = defs.some((d) => d.itemNo === 26);
      const item26Default = DEFAULT_CHECKLIST_DEFINITIONS.find((d) => d.itemNo === 26)!;
      const normalized = (has26 ? [...defs] : [...defs, item26Default]).sort(
        (a, b) => a.itemNo - b.itemNo
      );
      CHECKLIST_DEFINITIONS.splice(0, CHECKLIST_DEFINITIONS.length, ...normalized);
      window.localStorage.setItem(CUSTOM_CHECKLIST_STORAGE_KEY, JSON.stringify(normalized));
    } else if (
      configType === 'SERVICING_300HR_TASKS' &&
      Array.isArray(configData.tasks) &&
      configData.tasks.length > 0
    ) {
      window.localStorage.setItem(
        CUSTOM_SERVICING_TASKS_STORAGE_KEY,
        JSON.stringify(configData.tasks)
      );
    } else if (
      configType === 'JOB_TYPE_PRESETS' &&
      Array.isArray(configData.presets) &&
      configData.presets.length > 0
    ) {
      window.localStorage.setItem(
        CUSTOM_JOB_TYPES_STORAGE_KEY,
        JSON.stringify(configData.presets)
      );
    }
  } catch {
    // ignore storage errors
  }
}

export function createDefaultServicingTasks(): ServicingTaskItem[] {
  return getActiveServicingTasksTemplate();
}

export function createDefault300HrServicingDetails(
  currentRunningHours: string = '9115:29',
  lastServiceRunningHours: string = '8814:00',
  lastServiceDate: string = '2026-06-15'
): Servicing300HrDetails {
  const currentDec = parseRunningHoursToDecimal(currentRunningHours);
  const lastDec = parseRunningHoursToDecimal(lastServiceRunningHours);
  const elapsed = Math.max(0, Math.round((currentDec - lastDec) * 10) / 10);

  return {
    lastServiceRunningHours,
    lastServiceDate,
    currentRunningHours,
    hoursSinceLastService: elapsed,
    nextServiceDueHours: addRunningHours(currentRunningHours, 300),
    serviceIntervalHours: 300,
    oilGradeUsed: '15W-40 API CI-4 Heavy Duty Diesel Oil',
    oilLitersRefilled: '50 Ltr',
    coolantLitersRefilled: '5 Ltr Premix',
    servicingTasks: createDefaultServicingTasks(),
  };
}

export function createStandard300HrPartsKit(): ReplacementPart[] {
  return [
    {
      id: `part-300hr-1-${Date.now()}`,
      sr: 1,
      partsNo: '15W-40 CI-4',
      partsDescription: 'Heavy Duty Diesel Engine Oil (18L Pail)',
      qty: '3 Pails (50 Ltr)',
      remarks: '300-Hr Standard Oil Change',
    },
    {
      id: `part-300hr-2-${Date.now()}`,
      sr: 2,
      partsNo: 'LF-3349 / LF-9009',
      partsDescription: 'Full-Flow Lube Oil Spin-On Filter',
      qty: '2 Nos',
      remarks: 'Replaced during 300-Hr Service',
    },
    {
      id: `part-300hr-3-${Date.now()}`,
      sr: 3,
      partsNo: 'FF-5052',
      partsDescription: 'Primary Fuel Filter Element',
      qty: '1 No',
      remarks: 'Replaced during 300-Hr Service',
    },
    {
      id: `part-300hr-4-${Date.now()}`,
      sr: 4,
      partsNo: 'FS-1000',
      partsDescription: 'Fuel Water Separator Spin-On Filter',
      qty: '1 No',
      remarks: 'Replaced during 300-Hr Service',
    },
    {
      id: `part-300hr-5-${Date.now()}`,
      sr: 5,
      partsNo: 'WF-2071',
      partsDescription: 'Coolant Water Filter Element',
      qty: '1 No',
      remarks: 'Replaced during 300-Hr Service',
    },
  ];
}

export function createDefaultBreakdownDetails(dateStr: string = '2026-10-18'): BreakdownDetails {
  return {
    breakdownDateTime: `${dateStr}T14:15`,
    arrivalDateTime: `${dateStr}T15:00`,
    rectifiedDateTime: `${dateStr}T17:30`,
    totalDowntimeHours: 3.25,
    faultCategory: 'Cooling / Overheat',
    alarmCodeOrTrip: 'DSE 7320 MK II Alarm: High Engine Temperature / Low Coolant Level Trip',
    symptomsReported:
      'မီးပျက်ချိန် မီးစက် အလိုအလျောက်မောင်းနှင်စဉ် (၁၅) မိနစ်ခန့်အကြာ၌ High Engine Temp Alarm ပေါ်ပြီး အရေးပေါ် ရပ်တန့်သွားခြင်း (Generator tripped on High Water Temp during utility outage; coolant seepage observed under lower radiator hose).',
    rootCauseAnalysis:
      'Lower radiator silicone hose clamp fatigued under thermal vibration, causing gradual coolant loss and triggering the DSE 7320 low-coolant / high-temperature shutdown protection.',
    immediateRectification:
      'Replaced lower radiator reinforced silicone hose and heavy-duty stainless T-bolt clamps, flushed and refilled 12 Ltr premix coolant, bled air from cooling jacket, cleared controller fault log, and verified 30-minute load test run.',
    preventiveRecommendation:
      'Inspect all silicone hose joints and T-bolt clamp torque at every monthly routine inspection and pressure-test radiator cap at 300-Hr servicing.',
    postRepairStatus: 'Restored to Auto Standby',
  };
}

export function createStandardBreakdownPartsKit(): ReplacementPart[] {
  return [
    {
      id: `part-bd-1-${Date.now()}`,
      sr: 1,
      partsNo: 'RH-KTA19-LWR',
      partsDescription: 'Heavy-Duty Lower Radiator Silicone Hose (Cummins KTA-19)',
      qty: '1 No',
      remarks: 'Emergency Breakdown Replacement',
    },
    {
      id: `part-bd-2-${Date.now()}`,
      sr: 2,
      partsNo: 'TB-CLAMP-76',
      partsDescription: 'Stainless Steel Heavy-Duty T-Bolt Hose Clamp',
      qty: '2 Nos',
      remarks: 'Replaced fatigued clamp',
    },
    {
      id: `part-bd-3-${Date.now()}`,
      sr: 3,
      partsNo: 'COOL-DCA4-50',
      partsDescription: ' Heavy-Duty Premix Ethylene Glycol Coolant',
      qty: '12 Ltr',
      remarks: 'Refilled & bled cooling system',
    },
  ];
}


