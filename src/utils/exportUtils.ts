import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import {
  Center,
  GeneratorAsset,
  InspectionReport,
  CenterRecipientPerson,
} from '../types';
import { CHECKLIST_DEFINITIONS } from '../data/checklistConfig';
import { saveAppConfigToFirestore } from './indexedDbSync';

export interface SectorInfo {
  sectorName: string;
  sectorLeadTitle: string;
  defaultRecipients: string;
}

export const DEFAULT_SECTOR_DIRECTORY: SectorInfo[] = [
  {
    sectorName: 'City Mall Sector',
    sectorLeadTitle: 'City Mall Sector Engineering & Mall Ops',
    defaultRecipients:
      'citymall.ops@cityproperties.com.mm, chief.engineer@cityproperties.com.mm, satshwe36@gmail.com',
  },
  {
    sectorName: 'Ocean Supercenter Sector',
    sectorLeadTitle: 'Ocean Supercenter Sector Facility Lead',
    defaultRecipients:
      'ocean.facility@cityproperties.com.mm, chief.engineer@cityproperties.com.mm, satshwe36@gmail.com',
  },
  {
    sectorName: 'Marketplace & Retail Sector',
    sectorLeadTitle: 'Marketplace & Retail Sector Manager',
    defaultRecipients:
      'marketplace.ops@cityproperties.com.mm, maintenance.lead@cityproperties.com.mm, satshwe36@gmail.com',
  },
  {
    sectorName: 'Logistics & Cold Storage Sector',
    sectorLeadTitle: 'DC & Cold Chain Engineering Head',
    defaultRecipients:
      'logistics.eng@cityproperties.com.mm, chief.engineer@cityproperties.com.mm, satshwe36@gmail.com',
  },
  {
    sectorName: 'Commercial & Corporate HQ Sector',
    sectorLeadTitle: 'Commercial Properties & HQ Facility Lead',
    defaultRecipients:
      'commercial.hq@cityproperties.com.mm, ops.control@cityproperties.com.mm, satshwe36@gmail.com',
  },
  {
    sectorName: 'External / Multi-Sector Service',
    sectorLeadTitle: 'External Sector Responsible Team',
    defaultRecipients:
      'sector.service@cityproperties.com.mm, chief.engineer@cityproperties.com.mm, satshwe36@gmail.com',
  },
];

export const SECTOR_DIRECTORY: SectorInfo[] = DEFAULT_SECTOR_DIRECTORY.map((s) => ({ ...s }));

const CUSTOM_SECTOR_DIR_STORAGE_KEY = 'cp_custom_sector_dir_v1';
const CENTER_SECTOR_OVERRIDE_STORAGE_KEY = 'cp_center_sector_override_v1';

export function getActiveSectorDirectory(): SectorInfo[] {
  if (typeof window !== 'undefined') {
    try {
      const raw = window.localStorage.getItem(CUSTOM_SECTOR_DIR_STORAGE_KEY);
      if (raw) {
        const parsed: SectorInfo[] = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          SECTOR_DIRECTORY.splice(0, SECTOR_DIRECTORY.length, ...parsed);
          return SECTOR_DIRECTORY;
        }
      }
    } catch {
      // fallback
    }
  }
  return SECTOR_DIRECTORY;
}

export function saveCustomSectorDirectory(sectors: SectorInfo[]): SectorInfo[] {
  const cleaned = sectors
    .map((s) => ({
      sectorName: (s.sectorName || '').trim(),
      sectorLeadTitle: (s.sectorLeadTitle || 'Sector Engineering Lead').trim(),
      defaultRecipients: (
        s.defaultRecipients || 'chief.engineer@cityproperties.com.mm, satshwe36@gmail.com'
      ).trim(),
    }))
    .filter((s) => s.sectorName.length > 0);
  const finalList = cleaned.length > 0 ? cleaned : DEFAULT_SECTOR_DIRECTORY.map((s) => ({ ...s }));
  SECTOR_DIRECTORY.splice(0, SECTOR_DIRECTORY.length, ...finalList);
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(CUSTOM_SECTOR_DIR_STORAGE_KEY, JSON.stringify(finalList));
    } catch {
      // ignore
    }
  }
  saveAppConfigToFirestore('CFG_SECTOR_DIRECTORY', 'SECTOR_DIRECTORY', {
    sectors: finalList,
  }).catch(() => {});
  return SECTOR_DIRECTORY;
}

export function resetSectorDirectoryToDefault(): SectorInfo[] {
  const restored = DEFAULT_SECTOR_DIRECTORY.map((s) => ({ ...s }));
  SECTOR_DIRECTORY.splice(0, SECTOR_DIRECTORY.length, ...restored);
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.removeItem(CUSTOM_SECTOR_DIR_STORAGE_KEY);
      window.localStorage.removeItem(CENTER_SECTOR_OVERRIDE_STORAGE_KEY);
    } catch {
      // ignore
    }
  }
  saveAppConfigToFirestore('CFG_SECTOR_DIRECTORY', 'SECTOR_DIRECTORY', {
    sectors: restored,
  }).catch(() => {});
  saveAppConfigToFirestore('CFG_CENTER_SECTOR_OVERRIDES', 'CENTER_SECTOR_OVERRIDES', {
    overrides: {},
  }).catch(() => {});
  return SECTOR_DIRECTORY;
}

export function getCenterSectorOverrides(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(CENTER_SECTOR_OVERRIDE_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveCenterSectorOverride(centerCodeRaw: string, sectorNameRaw: string): void {
  if (typeof window === 'undefined') return;
  const code = (centerCodeRaw || '').trim().toUpperCase();
  const sectorName = (sectorNameRaw || '').trim();
  if (!code) return;
  try {
    const map = getCenterSectorOverrides();
    if (sectorName) {
      map[code] = sectorName;
    } else {
      delete map[code];
    }
    window.localStorage.setItem(CENTER_SECTOR_OVERRIDE_STORAGE_KEY, JSON.stringify(map));
    saveAppConfigToFirestore('CFG_CENTER_SECTOR_OVERRIDES', 'CENTER_SECTOR_OVERRIDES', {
      overrides: map,
    }).catch(() => {});
  } catch {
    // ignore
  }
}

// Initialize in-memory SECTOR_DIRECTORY on module load
getActiveSectorDirectory();

export const FIELD_ENGINEER_DIRECTORY: { name: string; email: string; phone: string }[] = [
  {
    name: 'Wai Phyo Kyaw',
    email: 'waiphyokyaw@cityproperties.com.mm',
    phone: '09-777148101',
  },
  {
    name: 'Kyaw Zin Hein',
    email: 'kyawzinhein@cityproperties.com.mm',
    phone: '09-777148102',
  },
  {
    name: 'Aung Ko Oo',
    email: 'aungkooo@cityproperties.com.mm',
    phone: '09-777148103',
  },
  {
    name: 'Thura Zaw',
    email: 'thurazaw@cityproperties.com.mm',
    phone: '09-777148104',
  },
  {
    name: 'Min Thu Aung',
    email: 'minthuaung@cityproperties.com.mm',
    phone: '09-777148105',
  },
  {
    name: 'U Kyaw Swar (Chief Engineer)',
    email: 'chief.engineer@cityproperties.com.mm',
    phone: '09-777148100',
  },
];

export function getSectorForCenter(centerCode: string): SectorInfo {
  const activeDir = getActiveSectorDirectory();
  const code = (centerCode || '').trim().toUpperCase();
  const overrides = getCenterSectorOverrides();
  if (code && overrides[code]) {
    const matched = activeDir.find((s) => s.sectorName === overrides[code]);
    if (matched) return matched;
    return {
      sectorName: overrides[code],
      sectorLeadTitle: `${overrides[code]} Responsible Lead`,
      defaultRecipients:
        activeDir[0]?.defaultRecipients ||
        'chief.engineer@cityproperties.com.mm, satshwe36@gmail.com',
    };
  }

  if (code.startsWith('CML') || code.startsWith('CMS')) {
    return activeDir[0] || DEFAULT_SECTOR_DIRECTORY[0];
  }
  if (code.startsWith('OSC')) {
    return activeDir[1] || activeDir[0] || DEFAULT_SECTOR_DIRECTORY[1];
  }
  if (code.startsWith('MP') || code.startsWith('MKP') || code.startsWith('MKT')) {
    return activeDir[2] || activeDir[0] || DEFAULT_SECTOR_DIRECTORY[2];
  }
  if (code.startsWith('WH') || code.startsWith('DC')) {
    return activeDir[3] || activeDir[0] || DEFAULT_SECTOR_DIRECTORY[3];
  }
  return activeDir[4] || activeDir[0] || DEFAULT_SECTOR_DIRECTORY[4];
}

const CENTER_EMAIL_OVERRIDES_STORAGE_KEY = 'cp_center_email_overrides_v1';
const CENTER_PEOPLE_DIR_STORAGE_KEY = 'cp_center_people_dir_v1';

export function getSavedCenterEmailOverrides(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(CENTER_EMAIL_OVERRIDES_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function getSavedCenterPeopleDirectory(): Record<string, CenterRecipientPerson[]> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(CENTER_PEOPLE_DIR_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function getDefaultCenterPeopleList(
  centerCodeRaw: string,
  centerNameRaw?: string,
  contactPerson?: string,
  regionRaw?: string
): CenterRecipientPerson[] {
  const code = (centerCodeRaw || 'CMLSPL').trim().toUpperCase();
  const savedDir = getSavedCenterPeopleDirectory();
  if (savedDir[code] && savedDir[code].length > 0) {
    return savedDir[code];
  }

  const rule = evaluateCenterReceiptEmailRule(code, centerNameRaw, regionRaw, true);
  const emails = rule.autoReceiptEmails
    .split(',')
    .map((e) => e.trim())
    .filter(Boolean);

  return emails.map((email, idx) => {
    let name = contactPerson || `${code} Facility Lead`;
    let roleTitle = 'Center Facility / Duty Engineer';

    if (idx === 0) {
      name = contactPerson || `${code} Center Duty Engineer`;
      roleTitle = `Center Facility Lead (${code})`;
    } else if (email.includes('citymall.ops')) {
      name = 'U Myo Min (City Mall Ops)';
      roleTitle = 'City Mall Sector Engineering Lead';
    } else if (email.includes('ocean.facility')) {
      name = 'U Zaw Lwin (Ocean Sector)';
      roleTitle = 'Ocean Supercenter Sector Lead';
    } else if (email.includes('marketplace.ops')) {
      name = 'Daw Su Mon (Marketplace)';
      roleTitle = 'Marketplace Sector Facility Manager';
    } else if (email.includes('logistics.eng')) {
      name = 'U Hla Myint (Logistics/DC)';
      roleTitle = 'Logistics & Cold Chain Head';
    } else if (email.includes('commercial.hq')) {
      name = 'U Thein Tun (Commercial HQ)';
      roleTitle = 'Commercial Properties Lead';
    } else if (email.includes('regional.eng') || email.includes('zone.eng')) {
      name = 'Regional Zone Engineering Lead';
      roleTitle = `${rule.region || 'Regional'} Zone Supervisor`;
    } else if (email.includes('chief.engineer')) {
      name = 'U Kyaw Swar';
      roleTitle = 'Chief Engineer';
    } else if (email.includes('satshwe36')) {
      name = 'U Sat Shwe';
      roleTitle = 'System Administrator';
    }

    return {
      id: `PER_${code}_${idx + 1}`,
      name,
      roleTitle,
      email,
    };
  });
}

export async function saveCenterEmailOverride(
  centerCodeRaw: string,
  centerNameRaw: string,
  regionRaw: string,
  emailsCsv: string,
  peopleList?: CenterRecipientPerson[]
): Promise<EvaluatedCenterEmailRule> {
  const code = (centerCodeRaw || 'CMLSPL').trim().toUpperCase();
  const cleanedCsv = Array.from(
    new Set(
      emailsCsv
        .split(',')
        .map((e) => e.trim())
        .filter(Boolean)
    )
  ).join(', ');

  if (typeof window !== 'undefined') {
    const overrides = getSavedCenterEmailOverrides();
    if (cleanedCsv) {
      overrides[code] = cleanedCsv;
    } else {
      delete overrides[code];
    }
    window.localStorage.setItem(CENTER_EMAIL_OVERRIDES_STORAGE_KEY, JSON.stringify(overrides));

    const dir = getSavedCenterPeopleDirectory();
    if (peopleList) {
      dir[code] = peopleList;
      window.localStorage.setItem(CENTER_PEOPLE_DIR_STORAGE_KEY, JSON.stringify(dir));
    }

    saveAppConfigToFirestore('CFG_CENTER_EMAIL_OVERRIDES', 'CENTER_EMAIL_OVERRIDES', {
      emailOverrides: overrides,
      peopleDirectory: dir,
    }).catch(() => {});
  }

  try {
    const res = await fetch('/api/rules/evaluate-center-emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        centerCode: code,
        centerName: centerNameRaw,
        region: regionRaw,
        customEmails: cleanedCsv,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.autoReceiptEmails) {
        return {
          ...data,
          centerFacilityEmail:
            data.centerFacilityEmail ||
            `${code.toLowerCase().replace(/[^a-z0-9]/g, '')}.facility@cityproperties.com.mm`,
          defaultRecipients: cleanedCsv || data.autoReceiptEmails,
          autoReceiptEmails: cleanedCsv || data.autoReceiptEmails,
        };
      }
    }
  } catch {
    // Offline fallback
  }

  return evaluateCenterReceiptEmailRule(code, centerNameRaw, regionRaw);
}

export function resetCenterEmailOverride(
  centerCodeRaw: string,
  centerNameRaw?: string,
  regionRaw?: string
): EvaluatedCenterEmailRule {
  const code = (centerCodeRaw || 'CMLSPL').trim().toUpperCase();
  if (typeof window !== 'undefined') {
    const overrides = getSavedCenterEmailOverrides();
    delete overrides[code];
    window.localStorage.setItem(CENTER_EMAIL_OVERRIDES_STORAGE_KEY, JSON.stringify(overrides));

    const dir = getSavedCenterPeopleDirectory();
    delete dir[code];
    window.localStorage.setItem(CENTER_PEOPLE_DIR_STORAGE_KEY, JSON.stringify(dir));

    saveAppConfigToFirestore('CFG_CENTER_EMAIL_OVERRIDES', 'CENTER_EMAIL_OVERRIDES', {
      emailOverrides: overrides,
      peopleDirectory: dir,
    }).catch(() => {});
  }
  return evaluateCenterReceiptEmailRule(code, centerNameRaw, regionRaw, true);
}

export function applyRemoteExportAppConfig(
  configType: string,
  configData: Record<string, unknown>
): void {
  if (typeof window === 'undefined' || !configData) return;
  try {
    if (
      configType === 'SECTOR_DIRECTORY' &&
      Array.isArray(configData.sectors) &&
      configData.sectors.length > 0
    ) {
      const sectors = configData.sectors as SectorInfo[];
      SECTOR_DIRECTORY.splice(0, SECTOR_DIRECTORY.length, ...sectors);
      window.localStorage.setItem(CUSTOM_SECTOR_DIR_STORAGE_KEY, JSON.stringify(sectors));
    } else if (
      configType === 'CENTER_SECTOR_OVERRIDES' &&
      configData.overrides &&
      typeof configData.overrides === 'object'
    ) {
      window.localStorage.setItem(
        CENTER_SECTOR_OVERRIDE_STORAGE_KEY,
        JSON.stringify(configData.overrides)
      );
    } else if (configType === 'CENTER_EMAIL_OVERRIDES') {
      if (configData.emailOverrides && typeof configData.emailOverrides === 'object') {
        window.localStorage.setItem(
          CENTER_EMAIL_OVERRIDES_STORAGE_KEY,
          JSON.stringify(configData.emailOverrides)
        );
      }
      if (configData.peopleDirectory && typeof configData.peopleDirectory === 'object') {
        window.localStorage.setItem(
          CENTER_PEOPLE_DIR_STORAGE_KEY,
          JSON.stringify(configData.peopleDirectory)
        );
      }
    }
  } catch {
    // ignore storage errors
  }
}

export interface EvaluatedCenterEmailRule {
  ruleId: string;
  centerCode: string;
  centerName: string;
  sectorName: string;
  region: string;
  centerFacilityEmail: string;
  defaultRecipients: string;
  autoReceiptEmails: string;
  isCustomConfigured?: boolean;
  ruleDescription: string;
}

export function evaluateCenterReceiptEmailRule(
  centerCodeRaw: string,
  centerNameRaw?: string,
  regionRaw?: string,
  ignoreCustomOverride = false
): EvaluatedCenterEmailRule {
  const code = (centerCodeRaw || 'CMLSPL').trim().toUpperCase();
  const name = (centerNameRaw || code).trim();
  const region = (regionRaw || 'Yangon').trim();
  const slug = code.toLowerCase().replace(/[^a-z0-9]/g, '');

  const centerFacilityEmail = `${slug}.facility@cityproperties.com.mm`;

  const resolvedSector = getSectorForCenter(code);
  let sectorName = resolvedSector.sectorName || 'Commercial & Corporate HQ Sector';
  let sectorEmail =
    resolvedSector.defaultRecipients
      ?.split(',')
      .map((e) => e.trim())
      .find(Boolean) || 'commercial.hq@cityproperties.com.mm';
  let rulePrefix = 'RULE_SECTOR_HQ';

  if (code.startsWith('CML') || code.startsWith('CMS') || name.toLowerCase().includes('city mall')) {
    rulePrefix = 'RULE_CITYMALL';
  } else if (code.startsWith('OSC') || name.toLowerCase().includes('ocean')) {
    rulePrefix = 'RULE_OCEAN';
  } else if (code.startsWith('MKP') || code.startsWith('MKT') || name.toLowerCase().includes('marketplace')) {
    rulePrefix = 'RULE_MARKETPLACE';
  } else if (code.startsWith('CMT') || name.toLowerCase().includes('city mart')) {
    rulePrefix = 'RULE_CITYMART';
  } else if (code.startsWith('WH') || code.startsWith('DC') || name.toLowerCase().includes('logistics')) {
    rulePrefix = 'RULE_LOGISTICS';
  }

  let regionalEmail = 'yangon.zone.eng@cityproperties.com.mm';
  if (
    region.toLowerCase().includes('mandalay') ||
    code.includes('MD') ||
    name.toLowerCase().includes('mandalay')
  ) {
    regionalEmail = 'mandalay.regional.eng@cityproperties.com.mm';
  } else if (
    region.toLowerCase().includes('naypyitaw') ||
    code.includes('NPT') ||
    name.toLowerCase().includes('naypyitaw')
  ) {
    regionalEmail = 'npt.regional.eng@cityproperties.com.mm';
  } else if (
    region.toLowerCase().includes('upper') ||
    region.toLowerCase().includes('lower')
  ) {
    regionalEmail = 'regional.ops.eng@cityproperties.com.mm';
  }

  const savedOverrides = ignoreCustomOverride ? {} : getSavedCenterEmailOverrides();
  const customCsv = savedOverrides[code];

  const autoReceiptEmails = customCsv
    ? customCsv
    : Array.from(
        new Set([
          centerFacilityEmail,
          sectorEmail,
          regionalEmail,
          'chief.engineer@cityproperties.com.mm',
          'satshwe36@gmail.com',
        ])
      ).join(', ');

  const ruleId = customCsv ? `${rulePrefix}_${code}_CUSTOM` : `${rulePrefix}_${code}`;
  return {
    ruleId,
    centerCode: code,
    centerName: name,
    sectorName,
    region,
    centerFacilityEmail,
    defaultRecipients: autoReceiptEmails,
    autoReceiptEmails,
    isCustomConfigured: Boolean(customCsv),
    ruleDescription: customCsv
      ? `Custom Center Recipient Rule [${ruleId}]: Configured specifically for ${name} (${code}).`
      : `Backend Rule [${ruleId}]: Routes ${name} (${code}) to Center Facility (${centerFacilityEmail}), ${sectorName} (${sectorEmail}), Regional Lead (${regionalEmail}) & Chief Engineer.`,
  };
}

export async function fetchBackendCenterReceiptEmailRule(
  centerCode: string,
  centerName: string,
  region?: string
): Promise<EvaluatedCenterEmailRule> {
  const localRule = evaluateCenterReceiptEmailRule(centerCode, centerName, region);
  if (localRule.isCustomConfigured) {
    return localRule;
  }
  try {
    const params = new URLSearchParams({
      centerCode,
      centerName,
      region: region || 'Yangon',
    });
    const res = await fetch(`/api/rules/center-recipients?${params.toString()}`);
    if (res.ok) {
      const data = await res.json();
      if (data && data.autoReceiptEmails) {
        return {
          ...localRule,
          ...data,
          defaultRecipients: data.autoReceiptEmails,
          centerFacilityEmail: localRule.centerFacilityEmail,
        };
      }
    }
  } catch {
    // Fallback to deterministic rule engine if offline
  }
  return localRule;
}

export function computeResolutionDuration(
  inspectionDateIso: string,
  completedDateIso?: string,
  breakdownDowntimeHours?: number
): { days: number; hours: number; label: string } {
  if (typeof breakdownDowntimeHours === 'number' && breakdownDowntimeHours > 0 && (!completedDateIso || completedDateIso === inspectionDateIso)) {
    const d = Number((breakdownDowntimeHours / 24).toFixed(2));
    return {
      days: d,
      hours: breakdownDowntimeHours,
      label: `${breakdownDowntimeHours} hrs (Same Day)`,
    };
  }
  if (!completedDateIso) {
    return { days: 0, hours: 0, label: 'Pending / Open' };
  }
  const startMs = new Date(`${inspectionDateIso}T09:00:00Z`).getTime();
  const endMs = new Date(`${completedDateIso}T17:00:00Z`).getTime();
  if (isNaN(startMs) || isNaN(endMs) || endMs < startMs) {
    return { days: 0.5, hours: 8, label: '8.0 hrs (Same Day)' };
  }
  const diffHours = Math.max(2, Math.round((endMs - startMs) / (1000 * 60 * 60)));
  const diffDays = Math.max(0, Math.round((endMs - startMs) / (1000 * 60 * 60 * 24)));
  if (diffDays <= 0 || completedDateIso === inspectionDateIso) {
    const hrs = breakdownDowntimeHours && breakdownDowntimeHours > 0 ? breakdownDowntimeHours : 6.5;
    return { days: 0.3, hours: hrs, label: `${hrs} hrs (Same Day)` };
  }
  return {
    days: diffDays,
    hours: diffDays * 24,
    label: `${diffDays} ${diffDays === 1 ? 'Day' : 'Days'} (${diffDays * 24} hrs)`,
  };
}

export function getEngineerEmailByName(inspectorName: string): string {
  const normalized = (inspectorName || '').trim().toLowerCase();
  const matched = FIELD_ENGINEER_DIRECTORY.find(
    (eng) =>
      eng.name.toLowerCase() === normalized ||
      normalized.includes(eng.name.toLowerCase())
  );
  if (matched) return matched.email;
  const slug = normalized.replace(/[^a-z0-9]/g, '');
  return slug ? `${slug}@cityproperties.com.mm` : 'field.engineer@cityproperties.com.mm';
}

export function formatDateDDMMYYYY(isoDate: string): string {
  if (!isoDate) return '';
  const parts = isoDate.split('-');
  if (parts.length === 3) {
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }
  return isoDate;
}

export function formatDateDotDDMMYYYY(isoDate: string): string {
  if (!isoDate) return '';
  const parts = isoDate.split('-');
  if (parts.length === 3) {
    return `${parts[2]}.${parts[1]}.${parts[0]}`;
  }
  return isoDate;
}

export function exportInspectionsToExcel(reports: InspectionReport[], format: 'xlsx' | 'csv' = 'xlsx') {
  const flatRows = reports.map((r) => {
    const is300Hr = r.formCategory === 'REGULAR_SERVICING_300HR';
    const isBreakdown = r.formCategory === 'BREAKDOWN_REPORT';
    const sectorInfo = getSectorForCenter(r.centerCode);
    const row: Record<string, string | number> = {
      'Report No': r.reportNo,
      'Form Category': is300Hr
        ? '300-Hr Regular Servicing'
        : isBreakdown
        ? 'Breakdown Report'
        : 'Regular Inspection',
      'Inspection Date': formatDateDDMMYYYY(r.inspectionDate),
      'Sector': r.sectorName || sectorInfo.sectorName,
      'Center Code': r.centerCode,
      'Center Name': r.centerName,
      'Generator ID': r.generatorId,
      'KVA Rating': r.kvaRating,
      'Genset Model': r.gensetModel,
      'Genset Serial No': r.gensetSerialNo,
      'Engine Model': r.engineModel,
      'Engine Serial No': r.engineSerialNo,
      'Alternator Model': r.alternatorModel,
      'Alternator Serial No': r.alternatorSerialNo,
      'Controller Model': r.controllerModel,
      'AVR Model': r.avrModel,
      'Breaker Type': r.breakerType,
      'Breaker Poles': r.breakerPoles,
      'Breaker Rating (Amp)': r.breakerAmpRating,
      'Inspector Name': r.inspectorName,
      'Field Engineer Email': r.inspectorEmail || getEngineerEmailByName(r.inspectorName),
      'Receipt Mail (Responsible Persons)': r.recipientEmails || sectorInfo.defaultRecipients,
      'Customer Contact': r.customerName,
      'Customer Signatory': r.customerSignName,
      'Job Request Type': r.jobRequestType,
      'Health Score (%)': r.healthScore,
      'Readiness Status': r.readinessStatus,
      'Running Hours': r.parameters.runningHours,
      'Last 300-Hr Service Run Hrs': r.servicing300Hr?.lastServiceRunningHours || '—',
      'Hours Since Last Service': r.servicing300Hr?.hoursSinceLastService ?? '—',
      'Next 300-Hr Service Due Hrs': r.servicing300Hr?.nextServiceDueHours || '—',
      'Oil Refilled (Ltr)': r.servicing300Hr?.oilLitersRefilled || '—',
      'Coolant Refilled (Ltr)': r.servicing300Hr?.coolantLitersRefilled || '—',
      'Breakdown Fault Category': r.breakdownDetails?.faultCategory || '—',
      'Breakdown Downtime (Hrs)': r.breakdownDetails?.totalDowntimeHours ?? '—',
      'Breakdown Alarm / Trip': r.breakdownDetails?.alarmCodeOrTrip || '—',
      'Breakdown Root Cause': r.breakdownDetails?.rootCauseAnalysis || '—',
      'Post-Repair Status': r.breakdownDetails?.postRepairStatus || '—',
      'Engine Speed (RPM)': r.parameters.engineSpeedRpm,
      'Oil Pressure (Bar)': r.parameters.engineOilPressureBar,
      'Oil Temp (°C)': r.parameters.engineOilTempC,
      'Battery Capacity': r.parameters.batteryCapacity,
      'Frequency (Hz)': r.parameters.frequencyHz,
      'Voltage L1-L2 (V)': r.parameters.voltageL1L2,
      'Voltage L1-L3 (V)': r.parameters.voltageL1L3,
      'Voltage L2-L3 (V)': r.parameters.voltageL2L3,
      'Charging Voltage (V)': r.parameters.chargingVoltageV,
      'Load L1 (A)': r.parameters.currentL1A || '0',
      'Load L2 (A)': r.parameters.currentL2A || '0',
      'Load L3 (A)': r.parameters.currentL3A || '0',
      'Active Power (KW)': r.parameters.activePowerKw || '0',
      'Apparent Power (KVA)': r.parameters.apparentPowerKva || '0',
      'Battery Date 1': r.customInputs.batteryDate1,
      'Battery Date 2': r.customInputs.batteryDate2,
      'Battery Nos': r.customInputs.batteryNos,
      'Battery Volt (V)': r.customInputs.batteryVolt,
      'Battery Ah': r.customInputs.batteryAh,
      'Battery CCA': Number(r.customInputs.batteryCca || 0),
      'Charge Alternator V': r.customInputs.chargeAltrV,
      'Controller Battery V': r.customInputs.controllerBatteryV,
    };

    for (const def of CHECKLIST_DEFINITIONS) {
      const item = r.checklist[def.itemNo];
      if (def.itemNo === 9) {
        row[`Q09 Battery Dates`] = `${r.customInputs.batteryDate1} / ${r.customInputs.batteryDate2} (${r.customInputs.batteryNos} Nos)`;
      } else if (def.itemNo === 10) {
        row[`Q10 Battery V/Ah/CCA`] = `${r.customInputs.batteryVolt}V / ${r.customInputs.batteryAh}Ah / ${r.customInputs.batteryCca}CCA`;
      } else if (def.itemNo === 11) {
        row[`Q11 Battery SOC/SOH`] = r.customInputs.batterySlots
          .filter((s) => s.soc || s.soh)
          .map((s, idx) => `B${idx + 1}:${s.soc}/${s.soh}`)
          .join('; ');
      } else if (def.itemNo === 19) {
        row[`Q19 Post-Run Charge/Batt V`] = `Chg:${r.customInputs.chargeAltrV}V / Batt:${r.customInputs.controllerBatteryV}`;
      } else {
        row[`Q${String(def.itemNo).padStart(2, '0')} Status`] = item?.selectedOption || '';
      }
      if (item?.remark) {
        row[`Q${String(def.itemNo).padStart(2, '0')} Remark`] = item.remark;
      }
    }

    row['Corrected Actions'] = r.correctedActions;
    row['Errors Found'] = r.errorsFound;
    row['General Remarks'] = r.generalRemarks;
    row['Customer Comment'] = r.customerComment;
    row['Defects Summary'] = r.defectsList.join('; ');

    return row;
  });

  const worksheet = XLSX.utils.json_to_sheet(flatRows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Inspections_Flat_DB');

  const dateStamp = new Date().toISOString().slice(0, 10);
  if (format === 'csv') {
    XLSX.writeFile(workbook, `CityProperties_Generator_Inspections_${dateStamp}.csv`, { bookType: 'csv' });
  } else {
    XLSX.writeFile(workbook, `CityProperties_Generator_Inspections_${dateStamp}.xlsx`, { bookType: 'xlsx' });
  }
}

export function downloadReportAsPdfFile(report: InspectionReport): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = 210;
  const margin = 10;
  const contentW = pageW - margin * 2;

  const sectorInfo = getSectorForCenter(report.centerCode);
  const sectorLabel = report.sectorName || sectorInfo.sectorName;
  const engineerEmail = report.inspectorEmail || getEngineerEmailByName(report.inspectorName);
  const receiptMail = report.recipientEmails || sectorInfo.defaultRecipients;

  const formTitle =
    report.formCategory === 'REGULAR_SERVICING_300HR'
      ? '300-HOUR REGULAR SERVICING & PM REPORT FORM'
      : report.formCategory === 'BREAKDOWN_REPORT'
      ? 'GENERATOR BREAKDOWN & EMERGENCY REPAIR REPORT FORM'
      : 'JOB REQUEST AND SERVICE REPORT FORM';

  // ==================== PAGE 1 ====================
  let y = 10;

  // Header Box
  doc.setFillColor(15, 23, 42);
  doc.rect(margin, y, 42, 13, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('CITY PROPERTIES', margin + 21, y + 6, { align: 'center' });
  doc.setFontSize(7);
  doc.text('GENERATOR ENGINEERING', margin + 21, y + 10.5, { align: 'center' });

  doc.setTextColor(15, 23, 42);
  doc.setFontSize(11);
  doc.text('City Properties Co., Ltd', margin + 46, y + 5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(`Sector: ${sectorLabel}  |  Gen SOP-002 / Version 02`, margin + 46, y + 9.5);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(formTitle, margin + 46, y + 13.5);

  // Report No & Readiness Badge on top right
  doc.setDrawColor(15, 23, 42);
  doc.rect(pageW - margin - 45, y, 45, 13);
  doc.setFontSize(8);
  doc.text(`Report No: #${report.reportNo}`, pageW - margin - 43, y + 4.5);
  doc.text(`Date: ${formatDateDDMMYYYY(report.inspectionDate)}`, pageW - margin - 43, y + 8.5);
  doc.text(`Status: ${report.readinessStatus} (${report.healthScore}%)`, pageW - margin - 43, y + 12);

  y += 16;

  // Nameplate & Center Grid
  doc.setFontSize(7.5);
  const drawRow = (
    l1: string,
    v1: string,
    l2: string,
    v2: string,
    rowH = 5.5
  ) => {
    doc.setDrawColor(100, 116, 139);
    doc.rect(margin, y, contentW, rowH);
    doc.line(margin + 32, y, margin + 32, y + rowH);
    doc.line(margin + 95, y, margin + 95, y + rowH);
    doc.line(margin + 128, y, margin + 128, y + rowH);

    doc.setFont('helvetica', 'bold');
    doc.text(l1, margin + 1.5, y + 3.8);
    doc.setFont('helvetica', 'normal');
    doc.text(String(v1 || '-').slice(0, 35), margin + 33.5, y + 3.8);

    doc.setFont('helvetica', 'bold');
    doc.text(l2, margin + 96.5, y + 3.8);
    doc.setFont('helvetica', 'normal');
    doc.text(String(v2 || '-').slice(0, 35), margin + 129.5, y + 3.8);
    y += rowH;
  };

  drawRow('Center / Code:', `${report.centerCode} - ${report.centerName}`, 'Sector:', sectorLabel);
  drawRow('Address:', report.address, 'Gen Capacity:', report.kvaRating);
  drawRow('Contact Person:', `${report.contactPerson} (${report.contactPhone})`, 'Genset Model / S/N:', `${report.gensetModel} / ${report.gensetSerialNo}`);
  drawRow('Engine Model / S/N:', `${report.engineModel} / ${report.engineSerialNo}`, 'Alternator / S/N:', `${report.alternatorModel} / ${report.alternatorSerialNo}`);
  drawRow('Controller / AVR:', `${report.controllerModel} / ${report.avrModel}`, 'Breaker Rating:', `${report.breakerType} (${report.breakerPoles}) ${report.breakerAmpRating}A`);

  y += 2;

  // Job Request Type & Corrected Actions
  doc.setDrawColor(100, 116, 139);
  doc.rect(margin, y, contentW, 6);
  doc.setFont('helvetica', 'bold');
  doc.text('Job Request Type:', margin + 1.5, y + 4.2);
  doc.setFont('helvetica', 'normal');
  doc.text(report.jobRequestType || '-', margin + 34, y + 4.2);
  y += 6;

  doc.rect(margin, y, contentW, 15);
  doc.setFont('helvetica', 'bold');
  doc.text('Corrected Actions / Service Performed:', margin + 1.5, y + 4);
  doc.setFont('helvetica', 'normal');
  const splitActions = doc.splitTextToSize(report.correctedActions || '-', contentW - 4);
  doc.text(splitActions.slice(0, 3), margin + 1.5, y + 8);
  y += 17;

  // Optional 300-Hr Servicing or Breakdown Summary Block
  if (report.formCategory === 'REGULAR_SERVICING_300HR' && report.servicing300Hr) {
    const s = report.servicing300Hr;
    doc.setFillColor(254, 243, 199);
    doc.rect(margin, y, contentW, 13, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.text(
      `300-Hour Regular Servicing Summary  |  Last Service: ${s.lastServiceRunningHours} hrs (${formatDateDDMMYYYY(s.lastServiceDate)})  |  Elapsed: ${s.hoursSinceLastService} hrs  |  Next Due: ${s.nextServiceDueHours} hrs`,
      margin + 2,
      y + 4.5
    );
    doc.setFont('helvetica', 'normal');
    doc.text(
      `Oil Grade: ${s.oilGradeUsed}  |  Lube Oil Refilled: ${s.oilLitersRefilled}  |  Coolant Refilled: ${s.coolantLitersRefilled}  |  Tasks Completed: ${s.servicingTasks.length}/10`,
      margin + 2,
      y + 9.5
    );
    y += 15;
  } else if (report.formCategory === 'BREAKDOWN_REPORT' && report.breakdownDetails) {
    const b = report.breakdownDetails;
    doc.setFillColor(254, 226, 226);
    doc.rect(margin, y, contentW, 16, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.text(
      `Breakdown Emergency Log  |  Fault: ${b.faultCategory}  |  Downtime: ${b.totalDowntimeHours} hrs  |  Status: ${b.postRepairStatus}`,
      margin + 2,
      y + 4.5
    );
    doc.setFont('helvetica', 'normal');
    doc.text(`Alarm/Trip: ${b.alarmCodeOrTrip}`, margin + 2, y + 9);
    doc.text(`Root Cause: ${String(b.rootCauseAnalysis || '').slice(0, 105)}`, margin + 2, y + 13.5);
    y += 18;
  }

  // Operating Parameters Table
  doc.setFillColor(241, 245, 249);
  doc.rect(margin, y, contentW, 5.5, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.text('OPERATING PARAMETERS (TEST RUN TELEMETRY)', margin + 2, y + 3.8);
  y += 5.5;

  const p = report.parameters;
  drawRow('Running Hours:', `${p.runningHours} Hrs`, 'Frequency:', `${p.frequencyHz} Hz`);
  drawRow('Engine Speed:', `${p.engineSpeedRpm} RPM`, 'Voltage L1-L2 / L1-L3:', `${p.voltageL1L2} V / ${p.voltageL1L3} V`);
  drawRow('Oil Pressure:', `${p.engineOilPressureBar} Bar`, 'Voltage L2-L3 / Chg V:', `${p.voltageL2L3} V / ${p.chargingVoltageV} V`);
  drawRow('Engine Oil Temp:', `${p.engineOilTempC} °C`, 'Load Current (L1/L2/L3):', `${p.currentL1A || '0'} / ${p.currentL2A || '0'} / ${p.currentL3A || '0'} A`);
  drawRow('Battery Capacity:', p.batteryCapacity, 'Power (KW / KVA):', `${p.activePowerKw || '0'} KW / ${p.apparentPowerKva || '0'} KVA`);

  y += 2;

  // Replacement Parts Table
  doc.setFillColor(241, 245, 249);
  doc.rect(margin, y, contentW, 5.5, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.text('REPLACEMENT PARTS USED', margin + 2, y + 3.8);
  y += 5.5;

  doc.rect(margin, y, contentW, 5);
  doc.text('Sr', margin + 2, y + 3.5);
  doc.text('Part No.', margin + 12, y + 3.5);
  doc.text('Parts Description', margin + 45, y + 3.5);
  doc.text('Qty', margin + 125, y + 3.5);
  doc.text('Remarks', margin + 145, y + 3.5);
  y += 5;

  const partsToShow = report.replacementParts.slice(0, 5);
  if (partsToShow.length === 0) {
    doc.rect(margin, y, contentW, 5);
    doc.setFont('helvetica', 'normal');
    doc.text('No replacement parts consumed during this inspection.', margin + 12, y + 3.5);
    y += 5;
  } else {
    partsToShow.forEach((pt, idx) => {
      doc.rect(margin, y, contentW, 5);
      doc.setFont('helvetica', 'normal');
      doc.text(String(idx + 1), margin + 2, y + 3.5);
      doc.text(String(pt.partsNo || '-'), margin + 12, y + 3.5);
      doc.text(String(pt.partsDescription || '-').slice(0, 42), margin + 45, y + 3.5);
      doc.text(String(pt.qty || '-'), margin + 125, y + 3.5);
      doc.text(String(pt.remarks || '-').slice(0, 24), margin + 145, y + 3.5);
      y += 5;
    });
  }

  y += 3;

  // Customer Comment & General Remarks
  doc.rect(margin, y, contentW, 11);
  doc.setFont('helvetica', 'bold');
  doc.text('General Remarks:', margin + 1.5, y + 4);
  doc.setFont('helvetica', 'normal');
  doc.text(String(report.generalRemarks || '-').slice(0, 95), margin + 30, y + 4);
  doc.setFont('helvetica', 'bold');
  doc.text('Customer Comment:', margin + 1.5, y + 8.8);
  doc.setFont('helvetica', 'normal');
  doc.text(String(report.customerComment || '-').slice(0, 95), margin + 33, y + 8.8);
  y += 13;

  // Sign-Off Box with Field Engineer Email & Receipt Mail (Responsible Persons)
  const signBoxH = 32;
  doc.rect(margin, y, contentW / 2 - 1, signBoxH);
  doc.rect(margin + contentW / 2 + 1, y, contentW / 2 - 1, signBoxH);

  // Left: Service Engineer + Field Engineer Email
  doc.setFont('helvetica', 'bold');
  doc.text('SERVICE ENGINEER SIGN-OFF', margin + 2, y + 4.5);
  if (report.engineerSignatureDataUrl && report.engineerSignatureDataUrl.startsWith('data:image')) {
    try {
      doc.addImage(report.engineerSignatureDataUrl, 'PNG', margin + 4, y + 6, 40, 11);
    } catch {
      // ignore signature image error
    }
  }
  doc.setFont('helvetica', 'normal');
  doc.text(`Name: ${report.inspectorName}`, margin + 2, y + 20.5);
  doc.setFont('helvetica', 'bold');
  doc.text(`Field Engineer Email: ${engineerEmail}`, margin + 2, y + 25);
  doc.setFont('helvetica', 'normal');
  doc.text(`Sign Date: ${formatDateDDMMYYYY(report.engineerSignDate)}`, margin + 2, y + 29.5);

  // Right: Customer / Facility Representative
  const rightX = margin + contentW / 2 + 3;
  doc.setFont('helvetica', 'bold');
  doc.text('CUSTOMER / FACILITY ACKNOWLEDGEMENT', rightX, y + 4.5);
  if (report.customerSignatureDataUrl && report.customerSignatureDataUrl.startsWith('data:image')) {
    try {
      doc.addImage(report.customerSignatureDataUrl, 'PNG', rightX + 2, y + 6, 40, 11);
    } catch {
      // ignore
    }
  }
  doc.setFont('helvetica', 'normal');
  doc.text(`Signatory Name: ${report.customerSignName}`, rightX, y + 20.5);
  doc.text(`Center Contact: ${report.customerName} (${report.contactPhone})`, rightX, y + 25);
  doc.text(`Sign Date: ${formatDateDDMMYYYY(report.customerSignDate)}`, rightX, y + 29.5);

  y += signBoxH + 2;

  // Bottom Receipt Mail Bar (သက်ဆိုင်ရာ တာဝန်ရှိသူများ Email)
  doc.setFillColor(248, 250, 252);
  doc.rect(margin, y, contentW, 10, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.text(`Receipt Mail (Responsible Persons - ${sectorLabel}):`, margin + 2, y + 4);
  doc.setFont('helvetica', 'normal');
  doc.text(String(receiptMail || '-').slice(0, 115), margin + 2, y + 8.2);

  // ==================== PAGE 2: 25-POINT CHECKLIST ====================
  doc.addPage();
  let y2 = 10;

  doc.setFillColor(15, 23, 42);
  doc.rect(margin, y2, contentW, 10, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(
    `PAGE 2: 25-POINT GENERATOR SERVICE / INSPECTION CHECKLIST (Gen SOP-002)  —  Report #${report.reportNo}`,
    margin + 3,
    y2 + 6.5
  );
  y2 += 12;

  doc.setTextColor(15, 23, 42);
  doc.setFontSize(7.5);
  drawRow('Center / Sector:', `${report.centerCode} (${sectorLabel})`, 'Inspector / Email:', `${report.inspectorName} (${engineerEmail})`);

  // Checklist Table Header
  y2 = y2 + 5.5;
  doc.setFillColor(226, 232, 240);
  doc.rect(margin, y2, contentW, 6, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.text('No.', margin + 2, y2 + 4);
  doc.text('Inspection Point Description', margin + 12, y2 + 4);
  doc.text('Selected Result / Telemetry', margin + 98, y2 + 4);
  doc.text('Remarks', margin + 148, y2 + 4);
  y2 += 6;

  CHECKLIST_DEFINITIONS.forEach((def) => {
    const item = report.checklist[def.itemNo];
    const rowH = 6.8;
    doc.setDrawColor(148, 163, 184);
    doc.rect(margin, y2, contentW, rowH);
    doc.line(margin + 10, y2, margin + 10, y2 + rowH);
    doc.line(margin + 96, y2, margin + 96, y2 + rowH);
    doc.line(margin + 146, y2, margin + 146, y2 + rowH);

    doc.setFont('helvetica', 'bold');
    doc.text(String(def.itemNo).padStart(2, '0'), margin + 2, y2 + 4.5);
    doc.setFont('helvetica', 'normal');
    doc.text(def.description.slice(0, 50), margin + 12, y2 + 4.5);

    let resultVal = item?.selectedOption || '-';
    if (def.itemNo === 9) {
      resultVal = `D1:${report.customInputs.batteryDate1} D2:${report.customInputs.batteryDate2} (${report.customInputs.batteryNos} Nos)`;
    } else if (def.itemNo === 10) {
      resultVal = `${report.customInputs.batteryVolt}V / ${report.customInputs.batteryAh}Ah / ${report.customInputs.batteryCca} CCA`;
    } else if (def.itemNo === 11) {
      resultVal = report.customInputs.batterySlots
        .filter((s) => s.soc || s.soh)
        .map((s, idx) => `B${idx + 1}:${s.soc}/${s.soh}`)
        .join(' ');
    } else if (def.itemNo === 19) {
      resultVal = `Chg:${report.customInputs.chargeAltrV}V / Batt:${report.customInputs.controllerBatteryV}`;
    }

    doc.setFont('helvetica', 'bold');
    doc.text(String(resultVal).slice(0, 30), margin + 98, y2 + 4.5);
    doc.setFont('helvetica', 'normal');
    doc.text(String(item?.remark || '').slice(0, 26), margin + 148, y2 + 4.5);
    y2 += rowH;
  });

  y2 += 3;
  doc.rect(margin, y2, contentW, 12);
  doc.setFont('helvetica', 'bold');
  doc.text('Errors Found / Technical Defects:', margin + 2, y2 + 4.5);
  doc.setFont('helvetica', 'normal');
  doc.text(
    String(report.errorsFound || 'No critical errors found during inspection.').slice(0, 110),
    margin + 2,
    y2 + 9.5
  );
  y2 += 14;

  // Footer on Page 2
  doc.rect(margin, y2, contentW, 12);
  doc.setFont('helvetica', 'bold');
  doc.text(
    `Field Engineer: ${report.inspectorName}  |  Email: ${engineerEmail}`,
    margin + 2,
    y2 + 4.5
  );
  doc.setFont('helvetica', 'normal');
  doc.text(
    `Receipt Mail CC (Responsible Persons): ${receiptMail}`,
    margin + 2,
    y2 + 9.5
  );

  doc.save(`CityProperties_Report_${report.reportNo}_${report.centerCode}.pdf`);
}


export function exportMasterAssetsToExcel(centers: Center[], generators: GeneratorAsset[], format: 'xlsx' | 'csv' = 'xlsx') {
  const centerRows = centers.map((c) => ({
    'Center ID': c.id,
    'Center Code': c.centerCode,
    'Center Name': c.centerName,
    Address: c.address,
    Township: c.township,
    Region: c.region,
    'Contact Person': c.contactPerson,
    'Contact Phone': c.contactPhone,
    'Linked Generators': generators.filter((g) => g.centerId === c.id).length,
  }));

  const generatorRows = generators.map((g) => {
    const center = centers.find((c) => c.id === g.centerId);
    return {
      'Generator ID': g.id,
      'Center ID': g.centerId,
      'Center Code': g.centerCode,
      'Center Name': center?.centerName || '',
      'Generator Label': g.generatorLabel,
      'KVA Rating': g.kvaRating,
      'Genset Model': g.gensetModel,
      'Genset Serial No': g.gensetSerialNo,
      'Engine Model': g.engineModel,
      'Engine Serial No': g.engineSerialNo,
      'Alternator Model': g.alternatorModel,
      'Alternator Serial No': g.alternatorSerialNo,
      'Controller Model': g.controllerModel,
      'AVR Model': g.avrModel,
      'Breaker Type': g.breakerType,
      'Breaker Poles': g.breakerPoles,
      'Breaker Amp Rating': g.breakerAmpRating,
      Status: g.status,
    };
  });

  const workbook = XLSX.utils.book_new();
  const wsCenters = XLSX.utils.json_to_sheet(centerRows);
  const wsGenerators = XLSX.utils.json_to_sheet(generatorRows);
  XLSX.utils.book_append_sheet(workbook, wsCenters, 'Centers_Master');
  XLSX.utils.book_append_sheet(workbook, wsGenerators, 'Generators_Master');

  const dateStamp = new Date().toISOString().slice(0, 10);
  if (format === 'csv') {
    XLSX.writeFile(workbook, `CityProperties_Generators_Master_${dateStamp}.csv`, { bookType: 'csv' });
  } else {
    XLSX.writeFile(workbook, `CityProperties_Master_Assets_${dateStamp}.xlsx`, { bookType: 'xlsx' });
  }
}

export async function parseImportedAssetsFile(
  file: File,
  existingCenters: Center[],
  existingGenerators: GeneratorAsset[]
): Promise<{
  centers: Center[];
  generators: GeneratorAsset[];
  importedCentersCount: number;
  importedGeneratorsCount: number;
}> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });

  const updatedCenters = [...existingCenters];
  const updatedGenerators = [...existingGenerators];
  let importedCentersCount = 0;
  let importedGeneratorsCount = 0;

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet);

    for (const row of rows) {
      // Check if row represents a Generator
      if (row['Genset Model'] || row['Generator ID'] || row['KVA Rating']) {
        const genId = String(row['Generator ID'] || `GEN-${String(updatedGenerators.length + 1).padStart(3, '0')}`).trim();
        const centerCode = String(row['Center Code'] || 'CMLSPL').trim();
        const matchedCenter =
          updatedCenters.find((c) => c.centerCode.toUpperCase() === centerCode.toUpperCase()) || updatedCenters[0];

        const newGen: GeneratorAsset = {
          id: genId,
          centerId: String(row['Center ID'] || matchedCenter.id),
          centerCode: matchedCenter.centerCode,
          generatorLabel: String(row['Generator Label'] || `Genset (${row['KVA Rating'] || '500 KVA'})`),
          kvaRating: String(row['KVA Rating'] || '500 KVA'),
          gensetModel: String(row['Genset Model'] || 'PM500CS'),
          gensetSerialNo: String(row['Genset Serial No'] || ''),
          engineModel: String(row['Engine Model'] || 'KTA-19G3A'),
          engineSerialNo: String(row['Engine Serial No'] || ''),
          alternatorModel: String(row['Alternator Model'] || 'TAL-A47C J 6/4'),
          alternatorSerialNo: String(row['Alternator Serial No'] || ''),
          controllerModel: String(row['Controller Model'] || 'DSE 7320 MK II'),
          avrModel: String(row['AVR Model'] || 'R150'),
          breakerType: row['Breaker Type'] === 'ACB' ? 'ACB' : 'MCCB',
          breakerPoles: row['Breaker Poles'] === '4P' ? '4P' : '3P',
          breakerAmpRating: String(row['Breaker Amp Rating'] || '800'),
          status:
            row['Status'] === 'Standby'
              ? 'Standby'
              : row['Status'] === 'Maintenance'
              ? 'Maintenance'
              : 'Active',
        };

        const existingIdx = updatedGenerators.findIndex((g) => g.id === newGen.id);
        if (existingIdx >= 0) {
          updatedGenerators[existingIdx] = newGen;
        } else {
          updatedGenerators.push(newGen);
        }
        importedGeneratorsCount++;
      } else if (row['Center Code'] || row['Center Name']) {
        const centerCode = String(row['Center Code'] || `CTR${updatedCenters.length + 1}`).trim();
        const centerId = String(row['Center ID'] || `CTR-${String(updatedCenters.length + 1).padStart(3, '0')}`).trim();
        const newCenter: Center = {
          id: centerId,
          centerCode,
          centerName: String(row['Center Name'] || centerCode),
          address: String(row['Address'] || ''),
          township: String(row['Township'] || 'Yangon'),
          contactPerson: String(row['Contact Person'] || ''),
          contactPhone: String(row['Contact Phone'] || ''),
          region: (row['Region'] as Center['region']) || 'Yangon',
        };

        const existingIdx = updatedCenters.findIndex(
          (c) => c.id === newCenter.id || c.centerCode.toUpperCase() === newCenter.centerCode.toUpperCase()
        );
        if (existingIdx >= 0) {
          updatedCenters[existingIdx] = newCenter;
        } else {
          updatedCenters.push(newCenter);
        }
        importedCentersCount++;
      }
    }
  }

  return {
    centers: updatedCenters,
    generators: updatedGenerators,
    importedCentersCount,
    importedGeneratorsCount,
  };
}

// ============================================================================
// 12 SPECIALIZED REPORT CLASSIFIERS, PART CHANGE HISTORY & CUSTOM EXPORTERS
// ============================================================================
export type SpecializedReportType =
  | 'ALL'
  | 'INSPECTION_REPORT'
  | 'SERVICING_REPORT'
  | 'BREAKDOWN_REPORT'
  | 'BREAKDOWN_COMPLETION_ANALYTICS'
  | 'ANALYTICS_REPORT'
  | 'DETAIL_REPORT'
  | 'CENTER_WISE_REPORT'
  | 'CENTER_PARTS_HISTORY'
  | 'MAJOR_SERVICING'
  | 'MINOR_SERVICING'
  | 'RADIATOR_MAJOR_CLEANING'
  | 'RADIATOR_MINOR_CLEANING'
  | 'DATE_RANGE_REPORT';

export interface SpecializedReportDef {
  id: SpecializedReportType;
  label: string;
  labelMm: string;
  description: string;
}

export const SPECIALIZED_REPORT_DEFINITIONS: SpecializedReportDef[] = [
  {
    id: 'ALL',
    label: 'All Reports',
    labelMm: 'အစီရင်ခံစာ အားလုံး',
    description: 'Complete master log of all generator inspection, servicing, and breakdown reports.',
  },
  {
    id: 'INSPECTION_REPORT',
    label: 'Inspection Report',
    labelMm: 'ပုံမှန်စစ်ဆေးခြင်း အစီရင်ခံစာ',
    description: 'Monthly routine generator inspection & 25-point checklist reports (Gen SOP-002).',
  },
  {
    id: 'SERVICING_REPORT',
    label: 'Servicing Report (300-Hr)',
    labelMm: 'နာရီ ၃၀၀ ဆားဗစ် အစီရင်ခံစာ',
    description: '300-Hour generator running-hour preventive maintenance & lube oil/filter overhaul reports.',
  },
  {
    id: 'BREAKDOWN_REPORT',
    label: 'Breakdown Report',
    labelMm: 'စက်ချို့ယွင်းမှု အရေးပေါ် အစီရင်ခံစာ',
    description: 'Emergency callout, fault alarm, root cause analysis, downtime & rectification reports.',
  },
  {
    id: 'BREAKDOWN_COMPLETION_ANALYTICS',
    label: 'Breakdown & Completion Rate Analytic',
    labelMm: 'Breakdown နှင့် ပြုပြင်ပြီးစီးမှုနှုန်း Analytic',
    description: 'Breakdown & Action Required completion rate (%), Generator Team vs Vendor rectification, and resolution duration analytics.',
  },
  {
    id: 'ANALYTICS_REPORT',
    label: 'Analytics Report',
    labelMm: 'စက်အုပ်စု သုံးသပ်ချက် အစီရင်ခံစာ',
    description: 'Center-by-center health score, readiness availability, 300-hr compliance & breakdown MTTR analytics.',
  },
  {
    id: 'DETAIL_REPORT',
    label: 'Detail Report (25-Point Telemetry)',
    labelMm: 'အသေးစိတ် နည်းပညာ အစီရင်ခံစာ',
    description: 'Full operating parameters (RPM, Oil Bar, Temp, L1/L2/L3 V & A, CCA) & all 25 checklist points.',
  },
  {
    id: 'CENTER_WISE_REPORT',
    label: 'Center-by-Center Report',
    labelMm: 'Center တစ်ခုချင်းအလိုက် အစီရင်ခံစာ',
    description: 'Dedicated facility dossier grouped by each Center with generator units, service history & status.',
  },
  {
    id: 'CENTER_PARTS_HISTORY',
    label: 'Center Part Change History',
    labelMm: 'Center အလိုက် Part လဲလှယ်ခဲ့သည့် မှတ်တမ်း',
    description: 'Complete chronological ledger of all replacement parts consumed per Center & Generator.',
  },
  {
    id: 'MAJOR_SERVICING',
    label: 'Major Servicing Report',
    labelMm: 'Major Servicing အစီရင်ခံစာ',
    description: 'Major 300-hour overhaul, full engine oil & filter kit replacement, and load bank test reports.',
  },
  {
    id: 'MINOR_SERVICING',
    label: 'Minor Servicing Report',
    labelMm: 'Minor Servicing အစီရင်ခံစာ',
    description: 'Minor preventive servicing: lube oil/coolant top-up, belt tensioning, terminal & filter replacements.',
  },
  {
    id: 'RADIATOR_MAJOR_CLEANING',
    label: 'Radiator Major Cleaning',
    labelMm: 'Radiator Major Cleaning အစီရင်ခံစာ',
    description: 'Radiator core chemical flushing, descaling, silicone hose overhaul & full coolant replacement.',
  },
  {
    id: 'RADIATOR_MINOR_CLEANING',
    label: 'Radiator Minor Cleaning',
    labelMm: 'Radiator Minor Cleaning အစီရင်ခံစာ',
    description: 'Radiator external fin compressed-air blowing, louver washing & premix coolant top-up.',
  },
  {
    id: 'DATE_RANGE_REPORT',
    label: 'Date Range Report',
    labelMm: 'သတ်မှတ်ရက်အပိုင်းအခြားအလိုက် အစီရင်ခံစာ',
    description: 'Custom start-to-end date range audit report across selected centers and service categories.',
  },
];

export interface ActivityItemRecord {
  reportId: string;
  reportNo: string;
  inspectionDate: string;
  centerId: string;
  centerCode: string;
  centerName: string;
  sectorName: string;
  generatorId: string;
  kvaRating: string;
  gensetModel: string;
  inspectorName: string;
  inspectorEmail: string;
  formCategory: string;
  serviceSubCategory: string;
  errorDescription: string;
  actionRequiredSummary: string;
  actionRequiredText: string;
  actionRemark: string;
  readinessStatus: InspectionReport['readinessStatus'];
  activityStatus: 'Open' | 'In Progress' | 'Completed';
  status: 'Open' | 'In Progress' | 'Completed';
  rectifiedBy: 'Generator Team' | 'Vendor';
  vendorOrTeamName: string;
  completedDate: string;
  resolutionDurationDays: number;
  resolutionDurationHours: number;
  resolutionDurationLabel: string;
  rectificationNote: string;
  isBreakdown: boolean;
  report: InspectionReport;
}

export function extractErrorAndActionActivities(
  reports: InspectionReport[]
): ActivityItemRecord[] {
  const items: ActivityItemRecord[] = [];

  reports.forEach((r, idx) => {
    const isBreakdown =
      r.formCategory === 'BREAKDOWN_REPORT' || Boolean(r.breakdownDetails);
    const hasErrors = Boolean(r.errorsFound && r.errorsFound.trim().length > 0);
    const hasDefects = Boolean(r.defectsList && r.defectsList.length > 0);
    const isActionOrCritical =
      r.readinessStatus === 'Action Required' || r.readinessStatus === 'Critical';
    const hasActivityResolution = Boolean(r.activityResolution);

    if (
      !isBreakdown &&
      !hasErrors &&
      !hasDefects &&
      !isActionOrCritical &&
      !hasActivityResolution
    ) {
      return;
    }

    const errorDescription =
      r.errorsFound?.trim() ||
      r.breakdownDetails?.alarmCodeOrTrip ||
      r.defectsList.join('; ') ||
      'Preventive action item identified during inspection';

    const actionRequiredSummary =
      r.defectsList.length > 0
        ? r.defectsList.join(' · ')
        : r.breakdownDetails?.immediateRectification ||
          r.correctedActions ||
          'Follow-up rectification required';

    // Determine resolution state from r.activityResolution or sensible defaults
    let activityStatus: 'Open' | 'In Progress' | 'Completed' =
      r.activityResolution?.activityStatus ||
      r.activityResolution?.status ||
      (isBreakdown &&
      r.breakdownDetails?.postRepairStatus === 'Restored to Auto Standby'
        ? 'Completed'
        : r.readinessStatus === 'Ready'
        ? 'Completed'
        : 'Open');

    const rectifiedBy: 'Generator Team' | 'Vendor' =
      r.activityResolution?.rectifiedBy ||
      (idx % 3 === 0 ? 'Vendor' : 'Generator Team');

    const completedDate =
      r.activityResolution?.completedDate ||
      (activityStatus === 'Completed' ? r.inspectionDate : '');

    const dur = computeResolutionDuration(
      r.inspectionDate,
      completedDate || undefined,
      r.breakdownDetails?.totalDowntimeHours
    );

    const resolutionDurationHours =
      r.activityResolution?.resolutionDurationHours ?? dur.hours;
    const resolutionDurationDays =
      r.activityResolution?.resolutionDurationDays ?? dur.days;

    const resolutionDurationLabel =
      activityStatus === 'Completed'
        ? resolutionDurationDays >= 1
          ? `${resolutionDurationDays} ${resolutionDurationDays === 1 ? 'Day' : 'Days'} (${resolutionDurationHours} hrs)`
          : `${resolutionDurationHours} hrs (Same Day)`
        : 'Open / Pending';

    const rectificationNote =
      r.activityResolution?.rectificationNote ||
      (activityStatus === 'Completed'
        ? r.breakdownDetails?.immediateRectification || r.correctedActions
        : 'Awaiting rectification sign-off');

    items.push({
      reportId: r.id,
      reportNo: r.reportNo,
      inspectionDate: r.inspectionDate,
      centerId: r.centerId,
      centerCode: r.centerCode,
      centerName: r.centerName,
      sectorName: r.sectorName || getSectorForCenter(r.centerCode).sectorName,
      generatorId: r.generatorId,
      kvaRating: r.kvaRating,
      gensetModel: r.gensetModel,
      inspectorName: r.inspectorName,
      inspectorEmail: r.inspectorEmail || getEngineerEmailByName(r.inspectorName),
      formCategory: r.formCategory || 'REGULAR_INSPECTION',
      serviceSubCategory: classifyServiceSubCategory(r),
      errorDescription,
      actionRequiredSummary,
      actionRequiredText: actionRequiredSummary,
      actionRemark: rectificationNote,
      readinessStatus: r.readinessStatus,
      activityStatus,
      status: activityStatus,
      rectifiedBy,
      vendorOrTeamName:
        r.activityResolution?.vendorOrTeamName ||
        (rectifiedBy === 'Vendor'
          ? 'Cummins / Authorized Service Vendor'
          : 'City Properties Generator Engineering Team'),
      completedDate,
      resolutionDurationDays,
      resolutionDurationHours,
      resolutionDurationLabel,
      rectificationNote,
      isBreakdown,
      report: r,
    });
  });

  return items;
}

export function classifyServiceSubCategory(r: InspectionReport): string {
  const job = (r.jobRequestType || '').toLowerCase();
  const act = (r.correctedActions || '').toLowerCase();
  const rem = (r.generalRemarks || '').toLowerCase();

  if (r.formCategory === 'BREAKDOWN_REPORT' || r.breakdownDetails) {
    return 'Breakdown Emergency Repair';
  }
  if (
    job.includes('radiator major') ||
    act.includes('radiator major') ||
    act.includes('chemical descaling')
  ) {
    return 'Radiator Major Cleaning';
  }
  if (
    job.includes('radiator minor') ||
    act.includes('radiator minor') ||
    act.includes('compressed air')
  ) {
    return 'Radiator Minor Cleaning';
  }
  if (
    r.formCategory === 'REGULAR_SERVICING_300HR' ||
    job.includes('major servicing') ||
    job.includes('300-hour') ||
    job.includes('300-hr')
  ) {
    return 'Major Servicing (300-Hr PM)';
  }
  if (
    job.includes('minor servicing') ||
    act.includes('minor servicing') ||
    rem.includes('minor servicing') ||
    (r.replacementParts.length > 0 && r.formCategory === 'REGULAR_INSPECTION')
  ) {
    return 'Minor Servicing';
  }
  return 'Regular Inspection';
}

export function matchesSpecializedReportType(
  r: InspectionReport,
  type: SpecializedReportType
): boolean {
  const subCat = classifyServiceSubCategory(r);
  switch (type) {
    case 'ALL':
    case 'ANALYTICS_REPORT':
    case 'DETAIL_REPORT':
    case 'CENTER_WISE_REPORT':
    case 'DATE_RANGE_REPORT':
      return true;
    case 'BREAKDOWN_COMPLETION_ANALYTICS':
      return (
        r.formCategory === 'BREAKDOWN_REPORT' ||
        Boolean(r.breakdownDetails) ||
        Boolean(r.errorsFound && r.errorsFound.trim()) ||
        (r.defectsList && r.defectsList.length > 0) ||
        r.readinessStatus !== 'Ready' ||
        Boolean(r.activityResolution)
      );
    case 'INSPECTION_REPORT':
      return (r.formCategory || 'REGULAR_INSPECTION') === 'REGULAR_INSPECTION';
    case 'SERVICING_REPORT':
      return r.formCategory === 'REGULAR_SERVICING_300HR';
    case 'BREAKDOWN_REPORT':
      return r.formCategory === 'BREAKDOWN_REPORT' || Boolean(r.breakdownDetails);
    case 'CENTER_PARTS_HISTORY':
      return r.replacementParts && r.replacementParts.length > 0;
    case 'MAJOR_SERVICING':
      return subCat === 'Major Servicing (300-Hr PM)';
    case 'MINOR_SERVICING':
      return subCat === 'Minor Servicing';
    case 'RADIATOR_MAJOR_CLEANING':
      return subCat === 'Radiator Major Cleaning';
    case 'RADIATOR_MINOR_CLEANING':
      return subCat === 'Radiator Minor Cleaning';
    default:
      return true;
  }
}

export interface PartChangeHistoryRecord {
  id: string;
  reportNo: string;
  inspectionDate: string;
  centerId: string;
  centerCode: string;
  centerName: string;
  sectorName: string;
  generatorId: string;
  gensetModel: string;
  kvaRating: string;
  runningHours: string;
  serviceCategory: string;
  inspectorName: string;
  inspectorEmail: string;
  partsNo: string;
  partsDescription: string;
  qty: string;
  remarks: string;
}

export function extractPartChangeHistory(
  reports: InspectionReport[]
): PartChangeHistoryRecord[] {
  const records: PartChangeHistoryRecord[] = [];
  reports.forEach((r) => {
    const sector = r.sectorName || getSectorForCenter(r.centerCode).sectorName;
    const email = r.inspectorEmail || getEngineerEmailByName(r.inspectorName);
    const serviceCategory = classifyServiceSubCategory(r);
    (r.replacementParts || []).forEach((pt, idx) => {
      if (!pt.partsNo && !pt.partsDescription) return;
      records.push({
        id: `${r.id}-PT-${idx + 1}`,
        reportNo: r.reportNo,
        inspectionDate: r.inspectionDate,
        centerId: r.centerId,
        centerCode: r.centerCode,
        centerName: r.centerName,
        sectorName: sector,
        generatorId: r.generatorId,
        gensetModel: r.gensetModel,
        kvaRating: r.kvaRating,
        runningHours: r.parameters.runningHours,
        serviceCategory,
        inspectorName: r.inspectorName,
        inspectorEmail: email,
        partsNo: pt.partsNo,
        partsDescription: pt.partsDescription,
        qty: pt.qty,
        remarks: pt.remarks,
      });
    });
  });
  return records;
}

export function exportSpecializedReportToExcel(
  reportType: SpecializedReportType,
  reports: InspectionReport[],
  centers: Center[],
  generators: GeneratorAsset[],
  format: 'xlsx' | 'csv' = 'xlsx'
) {
  if (reportType === 'BREAKDOWN_COMPLETION_ANALYTICS') {
    const activities = extractErrorAndActionActivities(reports);
    const rows = activities.map((act, idx) => ({
      'Sr No': idx + 1,
      'Report Date': formatDateDDMMYYYY(act.inspectionDate),
      'Report No': `#${act.reportNo}`,
      'Center Code': act.centerCode,
      'Center Name': act.centerName,
      'Generator ID': `${act.generatorId} (${act.kvaRating})`,
      'Engineer Name': act.inspectorName,
      'Engineer Email': act.inspectorEmail,
      'Category': act.serviceSubCategory,
      'Error / Fault Description': act.errorDescription,
      'Action Required': act.actionRequiredSummary,
      'Activity Status': act.activityStatus,
      'Rectified By (Team / Vendor)': act.rectifiedBy,
      'Completed Date': act.completedDate ? formatDateDDMMYYYY(act.completedDate) : 'Pending',
      'Resolution Duration (Hrs)': act.activityStatus === 'Completed' ? act.resolutionDurationHours : '—',
      'Resolution Duration (Days)': act.activityStatus === 'Completed' ? act.resolutionDurationDays : '—',
      'Duration Summary': act.resolutionDurationLabel,
      'Rectification Remark': act.rectificationNote,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Breakdown_Completion_Analytics');
    const stamp = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(
      wb,
      `CityProperties_Breakdown_And_Completion_Analytics_${stamp}.${format}`,
      { bookType: format }
    );
    return;
  }

  if (reportType === 'CENTER_PARTS_HISTORY') {
    const partRecords = extractPartChangeHistory(reports);
    const rows = partRecords.map((p, idx) => ({
      'Sr No': idx + 1,
      'Date': formatDateDDMMYYYY(p.inspectionDate),
      'Report No': `#${p.reportNo}`,
      'Center Code': p.centerCode,
      'Center Name': p.centerName,
      'Sector': p.sectorName,
      'Generator ID': p.generatorId,
      'Model / KVA': `${p.gensetModel} (${p.kvaRating})`,
      'Running Hours': p.runningHours,
      'Service Category': p.serviceCategory,
      'Part Number': p.partsNo,
      'Part Description': p.partsDescription,
      'Quantity': p.qty,
      'Remarks': p.remarks,
      'Field Engineer': p.inspectorName,
      'Engineer Email': p.inspectorEmail,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Center_Parts_History');
    const stamp = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(
      wb,
      `CityProperties_Center_Part_Change_History_${stamp}.${format}`,
      { bookType: format }
    );
    return;
  }

  if (reportType === 'ANALYTICS_REPORT' || reportType === 'CENTER_WISE_REPORT') {
    const rows = centers.map((c) => {
      const cGens = generators.filter((g) => g.centerId === c.id);
      const cReps = reports.filter((r) => r.centerId === c.id);
      const latest = cReps[0];
      const partCount = cReps.reduce((acc, r) => acc + (r.replacementParts?.length || 0), 0);
      const bdCount = cReps.filter(
        (r) => r.formCategory === 'BREAKDOWN_REPORT' || r.breakdownDetails
      ).length;
      const svcCount = cReps.filter(
        (r) => r.formCategory === 'REGULAR_SERVICING_300HR'
      ).length;
      return {
        'Center Code': c.centerCode,
        'Center Name': c.centerName,
        'Sector': getSectorForCenter(c.centerCode).sectorName,
        'Region / Township': `${c.region} / ${c.township}`,
        'Contact Person': `${c.contactPerson} (${c.contactPhone})`,
        'Generators Count': cGens.length,
        'Generator Ratings': cGens.map((g) => `${g.id}:${g.kvaRating}`).join(' | '),
        'Total Reports Logged': cReps.length,
        '300-Hr Servicing Count': svcCount,
        'Breakdown Count': bdCount,
        'Total Parts Replaced': partCount,
        'Latest Report No': latest ? `#${latest.reportNo}` : '—',
        'Latest Date': latest ? formatDateDDMMYYYY(latest.inspectionDate) : '—',
        'Latest Running Hours': latest?.parameters.runningHours || '—',
        'Latest Health Score (%)': latest?.healthScore ?? '—',
        'Latest Readiness Status': latest?.readinessStatus || 'Scheduled',
      };
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, reportType);
    const stamp = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `CityProperties_${reportType}_${stamp}.${format}`, {
      bookType: format,
    });
    return;
  }

  // Default: export matching reports with full sub-category and telemetry columns
  exportInspectionsToExcel(reports, format);
}

export function downloadSpecializedSummaryPdf(
  reportType: SpecializedReportType,
  reports: InspectionReport[],
  centers: Center[],
  generators: GeneratorAsset[],
  dateFrom: string,
  dateTo: string,
  centerFilterLabel: string
): void {
  const def =
    SPECIALIZED_REPORT_DEFINITIONS.find((d) => d.id === reportType) ||
    SPECIALIZED_REPORT_DEFINITIONS[0];

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageW = 297;
  const margin = 10;
  const contentW = pageW - margin * 2;
  let y = 10;

  // Header Banner
  doc.setFillColor(15, 23, 42);
  doc.rect(margin, y, contentW, 14, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(
    `CITY PROPERTIES CO., LTD  —  ${def.label.toUpperCase()}`,
    margin + 4,
    y + 6
  );
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(
    `Center Filter: ${centerFilterLabel}   |   Date Range: ${formatDateDDMMYYYY(dateFrom) || 'All'} to ${formatDateDDMMYYYY(dateTo) || 'All'}   |   Total Records: ${reports.length}`,
    margin + 4,
    y + 11.5
  );
  y += 17;

  doc.setTextColor(15, 23, 42);

  if (reportType === 'BREAKDOWN_COMPLETION_ANALYTICS') {
    const activities = extractErrorAndActionActivities(reports);
    const completed = activities.filter((a) => a.activityStatus === 'Completed');
    const completionPct =
      activities.length > 0
        ? Math.round((completed.length / activities.length) * 100)
        : 100;
    const avgHrs =
      completed.length > 0
        ? Number(
            (
              completed.reduce((s, a) => s + a.resolutionDurationHours, 0) /
              completed.length
            ).toFixed(1)
          )
        : 0;

    doc.setFillColor(241, 245, 249);
    doc.rect(margin, y, contentW, 8, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text(
      `Total Error/Action/Breakdown Activities: ${activities.length}   |   Completed: ${completed.length} (${completionPct}% Completion Rate)   |   Open/Pending: ${activities.length - completed.length}   |   Avg Resolution Time: ${avgHrs} hrs`,
      margin + 3,
      y + 5.2
    );
    y += 10;

    doc.setFillColor(226, 232, 240);
    doc.rect(margin, y, contentW, 6.5, 'FD');
    doc.setFontSize(7.5);
    doc.text('Report Date', margin + 2, y + 4.3);
    doc.text('Report #', margin + 22, y + 4.3);
    doc.text('Center', margin + 40, y + 4.3);
    doc.text('Engineer Name', margin + 62, y + 4.3);
    doc.text('Error / Action Description', margin + 98, y + 4.3);
    doc.text('Rectified By', margin + 178, y + 4.3);
    doc.text('Completed Date', margin + 210, y + 4.3);
    doc.text('Duration Time', margin + 235, y + 4.3);
    doc.text('Status', margin + 264, y + 4.3);
    y += 6.5;

    doc.setFont('helvetica', 'normal');
    activities.slice(0, 24).forEach((act) => {
      if (y > 190) {
        doc.addPage();
        y = 12;
      }
      doc.setDrawColor(148, 163, 184);
      doc.rect(margin, y, contentW, 6);
      doc.text(formatDateDDMMYYYY(act.inspectionDate), margin + 2, y + 4);
      doc.setFont('helvetica', 'bold');
      doc.text(`#${act.reportNo}`, margin + 22, y + 4);
      doc.setFont('helvetica', 'normal');
      doc.text(act.centerCode, margin + 40, y + 4);
      doc.text(act.inspectorName.slice(0, 18), margin + 62, y + 4);
      doc.text(String(act.errorDescription || '-').slice(0, 44), margin + 98, y + 4);
      doc.text(act.rectifiedBy, margin + 178, y + 4);
      doc.text(
        act.completedDate ? formatDateDDMMYYYY(act.completedDate) : 'Pending',
        margin + 210,
        y + 4
      );
      doc.text(act.resolutionDurationLabel.slice(0, 16), margin + 235, y + 4);
      doc.setFont('helvetica', 'bold');
      doc.text(act.activityStatus, margin + 264, y + 4);
      doc.setFont('helvetica', 'normal');
      y += 6;
    });
  } else if (reportType === 'CENTER_PARTS_HISTORY') {
    const partRecords = extractPartChangeHistory(reports);
    doc.setFillColor(226, 232, 240);
    doc.rect(margin, y, contentW, 6.5, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.text('Date', margin + 2, y + 4.3);
    doc.text('Report #', margin + 22, y + 4.3);
    doc.text('Center', margin + 40, y + 4.3);
    doc.text('Gen / KVA', margin + 62, y + 4.3);
    doc.text('Run Hrs', margin + 96, y + 4.3);
    doc.text('Part No.', margin + 116, y + 4.3);
    doc.text('Part Description', margin + 146, y + 4.3);
    doc.text('Qty', margin + 216, y + 4.3);
    doc.text('Service Type / Engineer', margin + 232, y + 4.3);
    y += 6.5;

    doc.setFont('helvetica', 'normal');
    partRecords.slice(0, 26).forEach((p) => {
      if (y > 190) {
        doc.addPage();
        y = 12;
      }
      doc.setDrawColor(148, 163, 184);
      doc.rect(margin, y, contentW, 6);
      doc.text(formatDateDDMMYYYY(p.inspectionDate), margin + 2, y + 4);
      doc.text(`#${p.reportNo}`, margin + 22, y + 4);
      doc.text(p.centerCode, margin + 40, y + 4);
      doc.text(`${p.generatorId} (${p.kvaRating})`, margin + 62, y + 4);
      doc.text(p.runningHours, margin + 96, y + 4);
      doc.setFont('helvetica', 'bold');
      doc.text(String(p.partsNo || '-').slice(0, 15), margin + 116, y + 4);
      doc.setFont('helvetica', 'normal');
      doc.text(String(p.partsDescription || '-').slice(0, 38), margin + 146, y + 4);
      doc.text(String(p.qty || '-'), margin + 216, y + 4);
      doc.text(
        `${p.serviceCategory.slice(0, 16)} · ${p.inspectorName}`,
        margin + 232,
        y + 4
      );
      y += 6;
    });
  } else {
    // Summary table for Reports
    doc.setFillColor(226, 232, 240);
    doc.rect(margin, y, contentW, 6.5, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.text('Report #', margin + 2, y + 4.3);
    doc.text('Date', margin + 20, y + 4.3);
    doc.text('Center & Sector', margin + 40, y + 4.3);
    doc.text('Generator / Model', margin + 88, y + 4.3);
    doc.text('Service Category', margin + 132, y + 4.3);
    doc.text('Run Hrs', margin + 178, y + 4.3);
    doc.text('Oil / CCA', margin + 198, y + 4.3);
    doc.text('Status', margin + 225, y + 4.3);
    doc.text('Field Engineer (Email)', margin + 246, y + 4.3);
    y += 6.5;

    doc.setFont('helvetica', 'normal');
    reports.slice(0, 26).forEach((r) => {
      if (y > 190) {
        doc.addPage();
        y = 12;
      }
      const subCat = classifyServiceSubCategory(r);
      const sec = r.sectorName || getSectorForCenter(r.centerCode).sectorName;
      doc.setDrawColor(148, 163, 184);
      doc.rect(margin, y, contentW, 6);
      doc.setFont('helvetica', 'bold');
      doc.text(`#${r.reportNo}`, margin + 2, y + 4);
      doc.setFont('helvetica', 'normal');
      doc.text(formatDateDDMMYYYY(r.inspectionDate), margin + 20, y + 4);
      doc.text(`${r.centerCode} (${sec.slice(0, 16)})`, margin + 40, y + 4);
      doc.text(`${r.generatorId} · ${r.gensetModel} (${r.kvaRating})`, margin + 88, y + 4);
      doc.text(subCat.slice(0, 26), margin + 132, y + 4);
      doc.text(r.parameters.runningHours, margin + 178, y + 4);
      doc.text(
        `${r.parameters.engineOilPressureBar}B / ${r.customInputs.batteryCca}`,
        margin + 198,
        y + 4
      );
      doc.text(`${r.readinessStatus} (${r.healthScore}%)`, margin + 225, y + 4);
      doc.text(r.inspectorName.slice(0, 20), margin + 246, y + 4);
      y += 6;
    });
  }

  const stamp = new Date().toISOString().slice(0, 10);
  doc.save(`CityProperties_${reportType}_${stamp}.pdf`);
}

