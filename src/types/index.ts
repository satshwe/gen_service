export interface Center {
  id: string; // e.g., "CTR-001"
  centerCode: string; // e.g., "CMLSPL"
  centerName: string; // e.g., "City Mall Shwe Pin Lone"
  address: string; // e.g., "City Mall Shwe Pin Lone, Pin Lone Road"
  township: string; // e.g., "North Dagon / Thingangyun"
  contactPerson: string; // e.g., "Ko Soe Nyein Oo"
  contactPhone: string; // e.g., "09-777148178"
  region: 'Yangon' | 'Mandalay' | 'Naypyitaw' | 'Upper Myanmar' | 'Lower Myanmar';
}

export type BreakerType = 'ACB' | 'MCCB';
export type BreakerPoles = '3P' | '4P';

export interface GeneratorAsset {
  id: string; // e.g., "GEN-001"
  centerId: string; // Links to Center.id
  centerCode: string; // e.g., "CMLSPL"
  generatorLabel: string; // e.g., "Genset #1 (Main)"
  kvaRating: string; // e.g., "500 KVA"
  gensetModel: string; // e.g., "PM500CS"
  gensetSerialNo: string; // e.g., "PM500CS22010246"
  engineModel: string; // e.g., "KTA-19G3A"
  engineSerialNo: string; // e.g., "41326807"
  alternatorModel: string; // e.g., "TAL-A47C J 6/4"
  alternatorSerialNo: string; // e.g., "772514002"
  controllerModel: string; // e.g., "DSE 7320 MK II"
  avrModel: string; // e.g., "R150"
  breakerType: BreakerType; // "ACB" | "MCCB"
  breakerPoles: BreakerPoles; // "3P" | "4P"
  breakerAmpRating: string; // e.g., "800"
  status: 'Active' | 'Standby' | 'Maintenance';
}

export interface OperatingParameters {
  runningHours: string; // e.g., "9115:29"
  engineSpeedRpm: number; // e.g., 1500
  engineOilPressureBar: number; // e.g., 5.69
  engineOilTempC: number; // e.g., 20
  batteryCapacity: string; // e.g., "12V/200Ah (2 nos)"
  frequencyHz: number; // e.g., 50
  voltageL1L2: number; // e.g., 398
  voltageL1L3: number; // e.g., 398
  voltageL2L3: number; // e.g., 399
  chargingVoltageV: number; // e.g., 26
  currentL1A: string; // e.g., "" or "0" or "210"
  currentL2A: string;
  currentL3A: string;
  activePowerKw: string;
  apparentPowerKva: string;
}

export interface BatterySlotHealth {
  soc: string; // e.g., "98%"
  soh: string; // e.g., "95%"
}

export interface ChecklistCustomInputs {
  // Item 9: Battery Purchase Date & Nos
  batteryDate1: string; // e.g., "24.4.26"
  batteryDate2: string; // e.g., "24.4.26"
  batteryNos: string; // e.g., "2"
  // Item 10: Battery Voltage & Ah & CCA
  batteryVolt: string; // e.g., "12"
  batteryAh: string; // e.g., "200"
  batteryCca: string; // e.g., "1156"
  // Item 11: Battery SOC (Charges) / SOH (Health) - 4 slots
  batterySlots: [BatterySlotHealth, BatterySlotHealth, BatterySlotHealth, BatterySlotHealth];
  // Item 19: Controller Battery V after running
  chargeAltrV: string; // e.g., "26.5"
  controllerBatteryV: string; // e.g., "26V"
  // Item 24: Before / After Photos
  insideBodyBeforePhoto?: string;
  insideBodyAfterPhoto?: string;
}

export interface ChecklistItemResult {
  itemNo: number; // 1 to 25
  selectedOption: string; // e.g., "Good", "Standard", "Normal", "Green", etc.
  remark: string;
}

export interface ReplacementPart {
  id: string;
  sr: number;
  partsNo: string;
  partsDescription: string;
  qty: string;
  remarks: string;
}

export type FormCategory =
  | 'REGULAR_INSPECTION'
  | 'REGULAR_SERVICING_300HR'
  | 'BREAKDOWN_REPORT';

export type BreakdownFaultCategory =
  | 'Fuel System'
  | 'Cooling / Overheat'
  | 'Lubrication / Low Oil Pressure'
  | 'Starting / Battery / Charger'
  | 'Controller / AMF / ATS'
  | 'Alternator / AVR / Breaker'
  | 'Mechanical / Belt / Hose Leak';

export type BreakdownPostRepairStatus =
  | 'Restored to Auto Standby'
  | 'Temporary Running (Follow-up Parts Needed)'
  | 'Out of Service / Awaiting Major Overhaul';

export interface BreakdownDetails {
  breakdownDateTime: string; // e.g., "2026-10-18T14:20"
  arrivalDateTime: string; // e.g., "2026-10-18T15:05"
  rectifiedDateTime: string; // e.g., "2026-10-18T17:35"
  totalDowntimeHours: number; // e.g., 3.25
  faultCategory: BreakdownFaultCategory;
  alarmCodeOrTrip: string; // e.g., "DSE 7320 Alarm: Low Coolant Level / High Water Temp Trip"
  symptomsReported: string; // ဖြစ်ပေါ်သည့် လက္ခဏာများ
  rootCauseAnalysis: string; // ချို့ယွင်းရသည့် အဓိကအကြောင်းရင်း
  immediateRectification: string; // အရေးပေါ် ပြုပြင်ဆောင်ရွက်ချက်
  preventiveRecommendation: string; // နောက်နောင် မဖြစ်ပွားစေရန် အကြံပြုချက်
  postRepairStatus: BreakdownPostRepairStatus;
}

export type ServicingTaskStatus =
  | 'Completed / Replaced'
  | 'Cleaned / Adjusted'
  | 'Checked Good'
  | 'Action Required';

export interface ServicingTaskItem {
  id?: string;
  taskNo: number;
  description: string;
  titleEn?: string;
  titleMm?: string;
  status: ServicingTaskStatus;
  quantityOrValue: string; // e.g., "55 Ltr", "2 Nos", "Passed"
  partNumberUsed: string; // e.g., "LF-3349"
  remark: string;
}

export interface Servicing300HrDetails {
  lastServiceRunningHours: string; // e.g., "8815:00"
  lastServiceDate: string; // YYYY-MM-DD
  currentRunningHours: string; // e.g., "9115:29"
  hoursSinceLastService: number; // e.g., 300.5
  nextServiceDueHours: string; // e.g., "9415:29"
  serviceIntervalHours: number; // default 300
  oilGradeUsed: string; // e.g., "15W-40 API CI-4"
  oilLitersRefilled: string; // e.g., "50 Ltr"
  coolantLitersRefilled: string; // e.g., "10 Ltr"
  servicingTasks: ServicingTaskItem[];
}

export type ReadinessStatus = 'Ready' | 'Action Required' | 'Critical';

export type RectifiedByTeam = 'Generator Team' | 'Vendor';
export type ActivityActionStatus = 'Open' | 'In Progress' | 'Completed';

export interface ActivityResolutionDetails {
  activityStatus: ActivityActionStatus;
  status?: ActivityActionStatus;
  rectifiedBy: RectifiedByTeam;
  vendorOrTeamName?: string;
  completedDate?: string; // YYYY-MM-DD (အမှန်တကယ် ပြီးစီးသည့် ရက်စွဲ)
  resolutionDurationDays?: number; // Duration in days from inspectionDate to completedDate
  resolutionDurationHours?: number; // Duration in hours to complete
  rectificationNote?: string;
  updatedAt?: string;
}

export interface CenterRecipientPerson {
  id: string;
  name: string;
  roleTitle: string;
  email: string;
}

export interface CenterEmailRule {
  ruleId: string;
  centerCode?: string;
  centerCodePattern?: string;
  centerName: string;
  sectorName: string;
  region?: string;
  centerFacilityEmail: string;
  defaultRecipients: string;
  autoReceiptEmails: string;
  ruleDescription: string;
}

export type SyncState = 'synced' | 'pending_offline' | 'conflict';

export interface InspectionReport {
  id: string;
  reportNo: string; // e.g., "002048" (System Auto-Generated)
  formCategory?: FormCategory; // 'REGULAR_INSPECTION' | 'REGULAR_SERVICING_300HR' | 'BREAKDOWN_REPORT'
  servicing300Hr?: Servicing300HrDetails;
  breakdownDetails?: BreakdownDetails;
  activityResolution?: ActivityResolutionDetails;
  matchedEmailRuleId?: string;
  centerId: string;
  centerCode: string;
  centerName: string;
  address: string;
  contactPerson: string;
  contactPhone: string;
  generatorId: string;
  kvaRating: string;
  gensetModel: string;
  gensetSerialNo: string;
  engineModel: string;
  engineSerialNo: string;
  alternatorModel: string;
  alternatorSerialNo: string;
  controllerModel: string;
  avrModel: string;
  breakerType: BreakerType;
  breakerPoles: BreakerPoles;
  breakerAmpRating: string;

  inspectionDate: string; // YYYY-MM-DD (displayed as DD-MM-YYYY on print)
  sectorName?: string; // e.g., "City Mall Sector", "Ocean Supercenter Sector", "Commercial & Industrial Sector"
  inspectorName: string; // e.g., "Wai Phyo Kyaw"
  inspectorEmail?: string; // Field Engineer email displayed at the end of the form, e.g., "waiphyokyaw@cityproperties.com.mm"
  recipientEmails?: string; // Receipt Mail (သက်ဆိုင်ရာ တာဝန်ရှိသူများ email list)
  customerName: string; // Checklist Customer Name e.g., "Ko Soe Nyein Oo"
  customerSignName: string; // Service Report Customer Sign Name e.g., "Paing Lin Htet"
  jobRequestType: string; // e.g., "Genset Monthly Routine Inspection" or "300-Hour Regular Servicing (PM Overhaul)"
  correctedActions: string;
  generalRemarks: string;
  errorsFound: string; // Errors (တွေ့ရှိချက်များ)

  parameters: OperatingParameters;
  checklist: Record<number, ChecklistItemResult>;
  customInputs: ChecklistCustomInputs;
  replacementParts: ReplacementPart[];

  engineerSignatureDataUrl: string;
  engineerSignDate: string;
  customerSignatureDataUrl: string;
  customerSignDate: string;
  customerComment: string;

  healthScore: number; // 0 - 100
  readinessStatus: ReadinessStatus;
  defectsList: string[]; // Computed list of action/defect items
  createdAt: string;

  // Offline Sync & Integrity Metadata
  syncVersion?: number;
  clientUpdatedAtMs?: number;
  syncState?: SyncState;
  checksum?: string;
}

export interface ChecklistDefinition {
  itemNo: number;
  description: string;
  options?: string[];
  type: 'segmented' | 'custom_9' | 'custom_10' | 'custom_11' | 'custom_19' | 'segmented_photo_24';
  remarkHint?: string;
  goodOptions?: string[];
  warningOptions?: string[];
  criticalOptions?: string[];
}

// ============================================================================
// RBAC & USER ROLE MANAGEMENT
// ============================================================================
export type UserRole =
  | 'Administrator'
  | 'Chief Engineer'
  | 'Field Engineer'
  | 'Viewer';

export interface UserProfile {
  uid: string;
  password?: string;
  email: string;
  displayName: string;
  role: UserRole;
  department: string;
  updatedAt?: string;
}

// ============================================================================
// INDEXEDDB OFFLINE SYNC QUEUE & CONFLICT RESOLUTION
// ============================================================================
export interface SyncQueueItem {
  id: string; // queue item id
  entityType: 'report' | 'center' | 'generator';
  operation: 'upsert' | 'delete';
  entityId: string;
  payload: InspectionReport | Center | GeneratorAsset;
  baseSyncVersion: number;
  clientUpdatedAtMs: number;
  checksum: string;
  status: 'pending' | 'syncing' | 'conflict' | 'failed';
  errorMessage?: string;
}

export interface SyncConflict {
  id: string;
  reportNo: string;
  centerCode: string;
  localReport: InspectionReport;
  serverReport: InspectionReport;
  detectedAt: string;
}

// ============================================================================
// REAL-TIME PUSH & EMAIL NOTIFICATIONS
// ============================================================================
export type AlertTriggerType =
  | 'CRITICAL_READINESS'
  | 'BAD_CHECKLIST_ITEM'
  | 'MAINTENANCE_REMINDER';

export interface AlertNotification {
  id: string;
  triggerType: AlertTriggerType;
  severity: 'Critical' | 'Warning' | 'Info';
  title: string;
  message: string;
  centerCode: string;
  generatorId: string;
  reportNo: string;
  recipientsSummary: string;
  emailDispatched: boolean;
  read: boolean;
  authorUid: string;
  createdAt: string;
}

export interface NotificationRuleConfig {
  id: string;
  triggerType: AlertTriggerType;
  name: string;
  description: string;
  enabled: boolean;
  inAppPushEnabled: boolean;
  emailEnabled: boolean;
  recipientsCsv: string; // comma-separated email addresses (Global default)
  centerRecipientsMap?: Record<string, string>; // centerCode -> comma-separated email addresses per Center
  centerPeopleMap?: Record<string, CenterRecipientPerson[]>; // centerCode -> structured people list
  reminderIntervalDays?: number;
  updatedBy: string;
  updatedAt: string;
}
