import React, { useState, useMemo, useEffect } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  Plus,
  Trash2,
  Save,
  Printer,
  Download,
  Mail,
  Building2,
  Camera,
  RotateCcw,
  Sliders,
  ClipboardCheck,
  FileText,
  Wrench,
  Clock,
  Gauge,
  Edit3,
  Settings,
  ShieldCheck,
  X,
  Check,
} from 'lucide-react';
import {
  Center,
  GeneratorAsset,
  InspectionReport,
  OperatingParameters,
  ChecklistItemResult,
  ChecklistCustomInputs,
  ReplacementPart,
  FormCategory,
  Servicing300HrDetails,
  ServicingTaskStatus,
  BreakdownDetails,
  BreakdownFaultCategory,
  BreakdownPostRepairStatus,
  ReadinessStatus,
  CenterEmailRule,
  UserRole,
  ChecklistDefinition,
} from '../types';
import {
  CHECKLIST_DEFINITIONS,
  getActiveChecklistDefinitions,
  saveCustomChecklistDefinitions,
  resetChecklistDefinitionsToDefault,
  saveCustomServicingTasksTemplate,
  resetServicingTasksTemplateToDefault,
  createDefaultChecklist,
  createDefaultCustomInputs,
  evaluateInspectionHealth,
  createDefault300HrServicingDetails,
  createStandard300HrPartsKit,
  createDefaultBreakdownDetails,
  createStandardBreakdownPartsKit,
  parseRunningHoursToDecimal,
  addRunningHours,
} from '../data/checklistConfig';
import { SAMPLE_ENGINEER_SIGNATURE, SAMPLE_CUSTOMER_SIGNATURE } from '../data/seedData';
import {
  SECTOR_DIRECTORY,
  SectorInfo,
  getActiveSectorDirectory,
  saveCustomSectorDirectory,
  resetSectorDirectoryToDefault,
  saveCenterSectorOverride,
  FIELD_ENGINEER_DIRECTORY,
  getSectorForCenter,
  getEngineerEmailByName,
  downloadReportAsPdfFile,
  evaluateCenterReceiptEmailRule,
  fetchBackendCenterReceiptEmailRule,
} from '../utils/exportUtils';
import { SignaturePad } from './SignaturePad';

interface InspectionFormModuleProps {
  centers: Center[];
  generators: GeneratorAsset[];
  initialReport?: InspectionReport | null;
  initialFormCategory?: FormCategory;
  formSessionKey?: number;
  nextReportNo: string;
  onSaveReport: (report: InspectionReport, openPrintAfterSave: boolean) => void;
  onCancelEdit?: () => void;
  currentUserRole?: UserRole;
}

export const InspectionFormModule: React.FC<InspectionFormModuleProps> = ({
  centers,
  generators,
  initialReport,
  initialFormCategory,
  formSessionKey = 0,
  nextReportNo,
  onSaveReport,
  onCancelEdit,
  currentUserRole = 'Administrator',
}) => {
  const isAdmin = currentUserRole === 'Administrator';
  const [formCategory, setFormCategory] = useState<FormCategory>(
    initialReport?.formCategory || initialFormCategory || 'REGULAR_INSPECTION'
  );
  const [activeTab, setActiveTab] = useState<
    'stepA' | 'step300Hr' | 'stepBreakdown' | 'stepB' | 'stepC' | 'stepD'
  >('stepA');

  // Default to CMLSPL (first center & generator)
  const defaultCenter = centers[0];
  const defaultGen = generators.find((g) => g.centerId === defaultCenter?.id) || generators[0];

  const [selectedCenterId, setSelectedCenterId] = useState<string>(
    initialReport?.centerId || defaultCenter?.id || ''
  );
  const [selectedGeneratorId, setSelectedGeneratorId] = useState<string>(
    initialReport?.generatorId || defaultGen?.id || ''
  );

  // Step A & Backend Rule-Based Email Distribution Fields
  const defaultEmailRule = evaluateCenterReceiptEmailRule(
    defaultCenter?.centerCode || 'CMLSPL',
    defaultCenter?.centerName || 'City Mall Shwe Pin Lone'
  );
  const [matchedEmailRule, setMatchedEmailRule] = useState<CenterEmailRule>(defaultEmailRule);
  const [reportNo, setReportNo] = useState<string>(initialReport?.reportNo || nextReportNo);
  const [inspectionDate, setInspectionDate] = useState<string>(
    initialReport?.inspectionDate || '2026-10-18'
  );
  const [sectorName, setSectorName] = useState<string>(
    initialReport?.sectorName || defaultEmailRule.sectorName
  );
  const [sectorDirectoryList, setSectorDirectoryList] = useState<SectorInfo[]>(() =>
    getActiveSectorDirectory().map((s) => ({ ...s }))
  );
  const [showSectorManager, setShowSectorManager] = useState<boolean>(false);
  const [editingSectorIdx, setEditingSectorIdx] = useState<number | null>(null);
  const [editingSectorDraft, setEditingSectorDraft] = useState<SectorInfo>({
    sectorName: '',
    sectorLeadTitle: '',
    defaultRecipients: '',
  });
  const [newSectorDraft, setNewSectorDraft] = useState<SectorInfo>({
    sectorName: '',
    sectorLeadTitle: '',
    defaultRecipients: 'chief.engineer@cityproperties.com.mm, satshwe36@gmail.com',
  });

  // Admin Form Customization State (Checklist Definitions, 300-Hr Tasks & Custom Job Presets)
  const [checklistDefsState, setChecklistDefsState] = useState<ChecklistDefinition[]>(() =>
    getActiveChecklistDefinitions().map((d) => ({ ...d }))
  );
  const [isAdminFormEditMode, setIsAdminFormEditMode] = useState<boolean>(false);
  const [editingChecklistItemNo, setEditingChecklistItemNo] = useState<number | null>(null);
  const [editingChecklistDraft, setEditingChecklistDraft] = useState<{
    description: string;
    optionsCsv: string;
    warningCsv: string;
    criticalCsv: string;
    remarkHint: string;
  }>({
    description: '',
    optionsCsv: '',
    warningCsv: '',
    criticalCsv: '',
    remarkHint: '',
  });
  const [showAddChecklistModal, setShowAddChecklistModal] = useState<boolean>(false);
  const [newChecklistItemDraft, setNewChecklistItemDraft] = useState<{
    description: string;
    optionsPreset: 'GOOD_BAD' | 'GREEN_AMBER_RED' | 'READY_ACTION_CRITICAL' | 'CUSTOM';
    customOptionsCsv: string;
    remarkHint: string;
  }>({
    description: '',
    optionsPreset: 'GOOD_BAD',
    customOptionsCsv: 'Good, Action Required, Critical',
    remarkHint: 'စစ်ဆေးတွေ့ရှိချက် မှတ်ချက်ရေးရန်',
  });

  // Admin 300-Hr Servicing Task Adder State
  const [showAdd300HrTaskRow, setShowAdd300HrTaskRow] = useState<boolean>(false);
  const [new300HrTaskDraft, setNew300HrTaskDraft] = useState<{
    description: string;
    status: ServicingTaskStatus;
    quantityOrValue: string;
    partNumberUsed: string;
    remark: string;
  }>({
    description: '',
    status: 'Completed / Replaced',
    quantityOrValue: '1 Lot',
    partNumberUsed: '-',
    remark: '',
  });

  // Custom Job Request Type Presets (Admin Extensible)
  const [jobTypePresets, setJobTypePresets] = useState<
    { label: string; job: string; action: string }[]
  >(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = window.localStorage.getItem('cp_custom_job_presets_v1');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch {
        // ignore
      }
    }
    return [
      {
        label: 'Regular Monthly Inspection',
        job: 'Genset Monthly Routine Inspection',
        action:
          'Check engine oil level, coolant level, Battery cables condition, air filter, fan belt & radiator fin condition. And then, measured battery CCA & clean air filter. After inspection, genset free load test run is normal condition.',
      },
      {
        label: 'Major Servicing (300-Hr PM)',
        job: 'Major Servicing — 300-Hour Regular Servicing (Generator Running Hour PM)',
        action:
          'Performed 300-Hour Major Servicing: Drained old engine oil and refilled 50 Ltr 15W-40 CI-4 oil, replaced lube oil filters, fuel filters, fuel water separator, and air filter element. Verified coolant concentration and conducted 30-min load test run.',
      },
      {
        label: 'Minor Servicing',
        job: 'Minor Servicing & Preventive Adjustment Work Order',
        action:
          'Performed Minor Servicing: Topped up engine lube oil, drained water/sediment from fuel water separator, adjusted fan belt tension, cleaned battery terminals, and replaced primary air filter / fan belt as needed.',
      },
      {
        label: 'Radiator Major Cleaning',
        job: 'Radiator Major Cleaning & Cooling System Chemical Flushing',
        action:
          'Performed Radiator Major Cleaning: Drained cooling system, performed chemical descaling and core flushing, high-pressure washed external radiator core fins, replaced radiator pressure cap & upper/lower silicone hoses, and refilled 35 Ltr Fleetguard DCA4 Premix Coolant.',
      },
      {
        label: 'Radiator Minor Cleaning',
        job: 'Radiator Minor Cleaning & Fin Air-Blowing Maintenance',
        action:
          'Performed Radiator Minor Cleaning: Blew out dust and debris from radiator cooling fins with compressed air, washed external grille louver, checked fan belt tension, and topped up 3.0 Ltr Premix Coolant.',
      },
      {
        label: 'Emergency Breakdown Repair',
        job: 'Emergency Breakdown Callout & Repair Report',
        action:
          'Emergency Breakdown Rectification: Replaced lower radiator silicone hose and heavy-duty T-bolt clamps, flushed and refilled 12 Ltr premix coolant, bled air from cooling jacket, cleared DSE 7320 alarm, and verified 30-min load test run.',
      },
    ];
  });
  const [showAddJobPresetForm, setShowAddJobPresetForm] = useState<boolean>(false);
  const [newJobPresetDraft, setNewJobPresetDraft] = useState({
    label: '',
    job: '',
    action: '',
  });

  const [inspectorName, setInspectorName] = useState<string>(
    initialReport?.inspectorName || 'Wai Phyo Kyaw'
  );
  const [inspectorEmail, setInspectorEmail] = useState<string>(
    initialReport?.inspectorEmail ||
      getEngineerEmailByName(initialReport?.inspectorName || 'Wai Phyo Kyaw')
  );
  const [recipientEmails, setRecipientEmails] = useState<string>(
    initialReport?.recipientEmails || defaultEmailRule.defaultRecipients
  );
  const [readinessOverride, setReadinessOverride] = useState<ReadinessStatus | 'AUTO'>('AUTO');
  const [checklistScrollFilter, setChecklistScrollFilter] = useState<
    'ALL' | 'Ready' | 'Action Required' | 'Critical'
  >('ALL');
  const [customerName, setCustomerName] = useState<string>(
    initialReport?.customerName || defaultCenter?.contactPerson || 'Ko Soe Nyein Oo'
  );
  const [customerSignName, setCustomerSignName] = useState<string>(
    initialReport?.customerSignName || 'Paing Lin Htet'
  );
  const [jobRequestType, setJobRequestType] = useState<string>(
    initialReport?.jobRequestType ||
      (formCategory === 'REGULAR_SERVICING_300HR'
        ? '300-Hour Regular Servicing (Generator Running Hour PM)'
        : formCategory === 'BREAKDOWN_REPORT'
        ? 'Emergency Breakdown Callout & Repair Report'
        : 'Genset Monthly Routine Inspection')
  );
  const [correctedActions, setCorrectedActions] = useState<string>(
    initialReport?.correctedActions ||
      'Check engine oil level, coolant level, Battery cables condition, air filter, fan belt & radiator fin condition. And then, measured battery CCA & clean air filter. After inspection, genset free load test run is normal condition.'
  );
  const [generalRemarks, setGeneralRemarks] = useState<string>(
    initialReport?.generalRemarks || ''
  );
  const [errorsFound, setErrorsFound] = useState<string>(initialReport?.errorsFound || '');

  // Step B: Operating Parameters
  const [parameters, setParameters] = useState<OperatingParameters>(
    initialReport?.parameters || {
      runningHours: '9115:29',
      engineSpeedRpm: 1500,
      engineOilPressureBar: 5.69,
      engineOilTempC: 20,
      batteryCapacity: '12V/200Ah (2 nos)',
      frequencyHz: 50,
      voltageL1L2: 398,
      voltageL1L3: 398,
      voltageL2L3: 399,
      chargingVoltageV: 26,
      currentL1A: '',
      currentL2A: '',
      currentL3A: '',
      activePowerKw: '',
      apparentPowerKva: '',
    }
  );

  // 300-Hour Servicing Details State
  const [servicing300Hr, setServicing300Hr] = useState<Servicing300HrDetails>(
    () =>
      initialReport?.servicing300Hr ||
      createDefault300HrServicingDetails(
        initialReport?.parameters?.runningHours || '9115:29',
        '8812:00',
        '2026-06-15'
      )
  );

  // Breakdown Report Details State
  const [breakdownDetails, setBreakdownDetails] = useState<BreakdownDetails>(
    () =>
      initialReport?.breakdownDetails ||
      createDefaultBreakdownDetails(initialReport?.inspectionDate || '2026-10-18')
  );

  // Step C: 25-Point Checklist & Custom Sub-Inputs
  const [checklist, setChecklist] = useState<Record<number, ChecklistItemResult>>(
    initialReport?.checklist || createDefaultChecklist()
  );
  const [customInputs, setCustomInputs] = useState<ChecklistCustomInputs>(
    initialReport?.customInputs || createDefaultCustomInputs()
  );

  // Step D: Replacement Parts & Signatures
  const [replacementParts, setReplacementParts] = useState<ReplacementPart[]>(
    initialReport?.replacementParts || []
  );
  const [engineerSignatureDataUrl, setEngineerSignatureDataUrl] = useState<string>(
    initialReport?.engineerSignatureDataUrl || SAMPLE_ENGINEER_SIGNATURE
  );
  const [engineerSignDate, setEngineerSignDate] = useState<string>(
    initialReport?.engineerSignDate || '2026-10-18'
  );
  const [customerSignatureDataUrl, setCustomerSignatureDataUrl] = useState<string>(
    initialReport?.customerSignatureDataUrl || SAMPLE_CUSTOMER_SIGNATURE
  );
  const [customerSignDate, setCustomerSignDate] = useState<string>(
    initialReport?.customerSignDate || '2026-10-18'
  );
  const [customerComment, setCustomerComment] = useState<string>(
    initialReport?.customerComment || 'Monthly PM inspection completed satisfactorily.'
  );
  const [saveToast, setSaveToast] = useState<string | null>(null);

  // Sync if initialReport or initialFormCategory prop changes
  useEffect(() => {
    if (initialReport) {
      const cat = initialReport.formCategory || initialFormCategory || 'REGULAR_INSPECTION';
      setFormCategory(cat);
      setSelectedCenterId(initialReport.centerId);
      setSelectedGeneratorId(initialReport.generatorId);
      setReportNo(initialReport.reportNo);
      setInspectionDate(initialReport.inspectionDate);
      const ruleInfo = evaluateCenterReceiptEmailRule(
        initialReport.centerCode,
        initialReport.centerName
      );
      setMatchedEmailRule(ruleInfo);
      setSectorName(initialReport.sectorName || ruleInfo.sectorName);
      setInspectorName(initialReport.inspectorName);
      setInspectorEmail(
        initialReport.inspectorEmail || getEngineerEmailByName(initialReport.inspectorName)
      );
      setRecipientEmails(initialReport.recipientEmails || ruleInfo.defaultRecipients);
      setCustomerName(initialReport.customerName);
      setCustomerSignName(initialReport.customerSignName);
      setJobRequestType(initialReport.jobRequestType);
      setCorrectedActions(initialReport.correctedActions);
      setGeneralRemarks(initialReport.generalRemarks);
      setErrorsFound(initialReport.errorsFound);
      setParameters(initialReport.parameters);
      setServicing300Hr(
        initialReport.servicing300Hr ||
          createDefault300HrServicingDetails(
            initialReport.parameters.runningHours,
            '8812:00',
            '2026-06-15'
          )
      );
      setBreakdownDetails(
        initialReport.breakdownDetails ||
          createDefaultBreakdownDetails(initialReport.inspectionDate)
      );
      setChecklist(initialReport.checklist);
      setCustomInputs(initialReport.customInputs);
      setReplacementParts(initialReport.replacementParts);
      setEngineerSignatureDataUrl(initialReport.engineerSignatureDataUrl);
      setEngineerSignDate(initialReport.engineerSignDate);
      setCustomerSignatureDataUrl(initialReport.customerSignatureDataUrl);
      setCustomerSignDate(initialReport.customerSignDate);
      setCustomerComment(initialReport.customerComment);
      setReadinessOverride('AUTO');
      setActiveTab('stepA');
    } else {
      setReportNo(nextReportNo);
      handleSwitchFormCategory(initialFormCategory || 'REGULAR_INSPECTION', true);
    }
  }, [initialReport, initialFormCategory, formSessionKey, nextReportNo]);

  // System Auto-Generate Report Serial No. from Backend on new form creation
  const handleAutoRefreshSerialNo = async () => {
    try {
      const res = await fetch(`/api/reports/next-serial?clientMax=${encodeURIComponent(nextReportNo)}`);
      if (res.ok) {
        const data = await res.json();
        if (data?.nextReportNo) {
          const parsedBackend = parseInt(data.nextReportNo, 10);
          const parsedClient = parseInt(nextReportNo, 10);
          const bestSerial =
            !isNaN(parsedBackend) && !isNaN(parsedClient)
              ? String(Math.max(parsedBackend, parsedClient)).padStart(6, '0')
              : data.nextReportNo;
          setReportNo(bestSerial);
          return;
        }
      }
    } catch {
      // Fallback to local sequential nextReportNo when offline
    }
    setReportNo(nextReportNo);
  };

  useEffect(() => {
    if (!initialReport) {
      handleAutoRefreshSerialNo();
    }
  }, [initialReport, nextReportNo]);

  // Switch between Form 1 (Regular Inspection), Form 2 (Regular Servicing 300-Hr), and Form 3 (Breakdown Form)
  // If the current form has not been saved yet (!initialReport), switching forms resets to a fresh form starting at Step A.
  const handleSwitchFormCategory = (nextCategory: FormCategory, silentReset = false) => {
    setFormCategory(nextCategory);
    setActiveTab('stepA');
    setChecklistScrollFilter('ALL');

    if (!initialReport) {
      const freshChecklist = createDefaultChecklist();
      setCustomInputs(createDefaultCustomInputs());
      setParameters({
        runningHours: '9115:29',
        engineSpeedRpm: 1500,
        engineOilPressureBar: 5.69,
        engineOilTempC: 20,
        batteryCapacity: '12V/200Ah (2 nos)',
        frequencyHz: 50,
        voltageL1L2: 398,
        voltageL1L3: 398,
        voltageL2L3: 399,
        chargingVoltageV: 26,
        currentL1A: '',
        currentL2A: '',
        currentL3A: '',
        activePowerKw: '',
        apparentPowerKva: '',
      });
      setServicing300Hr(
        createDefault300HrServicingDetails('9115:29', '8812:00', '2026-06-15')
      );
      setBreakdownDetails(createDefaultBreakdownDetails(inspectionDate));
      setGeneralRemarks('');
      setReadinessOverride('AUTO');

      if (nextCategory === 'REGULAR_SERVICING_300HR') {
        setJobRequestType('300-Hour Regular Servicing (Generator Running Hour PM)');
        setCorrectedActions(
          'Performed 300-Hour Regular Servicing based on generator running hours: Drained engine lube oil & refilled 50 Ltr 15W-40 CI-4 oil, replaced lube oil filters, fuel filters, fuel water separator & air filter element. Verified coolant concentration and conducted 30-min load test run.'
        );
        setErrorsFound('');
        setReplacementParts(createStandard300HrPartsKit());
        setChecklist({
          ...freshChecklist,
          2: {
            itemNo: 2,
            selectedOption: 'Standard',
            remark: 'Refilled 50 Ltr 15W-40 Engine Oil (300-Hr Service)',
          },
          5: {
            itemNo: 5,
            selectedOption: 'Replace',
            remark: 'Replaced Primary Air Filter Element (300-Hr Service)',
          },
          26: {
            itemNo: 26,
            selectedOption: 'Ready',
            remark: '300-Hr Servicing Completed — Ready for Standby',
          },
        });
        setCustomerComment('300-Hour Regular Servicing completed satisfactorily.');
      } else if (nextCategory === 'BREAKDOWN_REPORT') {
        setJobRequestType('Emergency Breakdown Callout & Repair Report');
        setCorrectedActions(
          'Emergency Breakdown Rectification: Replaced lower radiator silicone hose and heavy-duty T-bolt clamps, flushed and refilled 12 Ltr premix coolant, bled air from cooling jacket, cleared DSE 7320 alarm, and verified 30-min load test run.'
        );
        setErrorsFound(
          'High Engine Temperature / Low Coolant Level trip due to lower radiator silicone hose clamp fatigue and seepage.'
        );
        setReplacementParts(createStandardBreakdownPartsKit());
        setChecklist({
          ...freshChecklist,
          26: {
            itemNo: 26,
            selectedOption: 'Ready',
            remark: 'Breakdown Rectified & Tested — Generator Ready',
          },
        });
        setCustomerComment('Emergency breakdown rectified and load-tested satisfactorily.');
      } else {
        setJobRequestType('Genset Monthly Routine Inspection');
        setCorrectedActions(
          'Check engine oil level, coolant level, Battery cables condition, air filter, fan belt & radiator fin condition. And then, measured battery CCA & clean air filter. After inspection, genset free load test run is normal condition.'
        );
        setErrorsFound('');
        setReplacementParts([]);
        setChecklist(freshChecklist);
        setCustomerComment('Monthly PM inspection completed satisfactorily.');
      }

      if (!silentReset) {
        const label =
          nextCategory === 'REGULAR_SERVICING_300HR'
            ? 'Form 2: 300-Hr Regular Servicing Form'
            : nextCategory === 'BREAKDOWN_REPORT'
            ? 'Form 3: Breakdown & Emergency Repair Form'
            : 'Form 1: Regular Inspection Form';
        setSaveToast(
          `Switched to ${label} — Reset unsaved entries and started fresh at Step A.`
        );
        setTimeout(() => setSaveToast(null), 3000);
      }
      return;
    }

    // When editing an existing saved report (Admin only)
    if (nextCategory === 'REGULAR_SERVICING_300HR') {
      setJobRequestType('300-Hour Regular Servicing (Generator Running Hour PM)');
    } else if (nextCategory === 'BREAKDOWN_REPORT') {
      setJobRequestType('Emergency Breakdown Callout & Repair Report');
    } else {
      setJobRequestType('Genset Monthly Routine Inspection');
    }
  };

  // Recalculate 300-Hr interval metrics whenever currentRunningHours or lastServiceRunningHours changes
  const updateRunningHoursAndInterval = (
    newCurrentHrs: string,
    newLastSvcHrs: string = servicing300Hr.lastServiceRunningHours
  ) => {
    const currDec = parseRunningHoursToDecimal(newCurrentHrs);
    const lastDec = parseRunningHoursToDecimal(newLastSvcHrs);
    const elapsed = Math.max(0, Number((currDec - lastDec).toFixed(1)));
    const nextDue = addRunningHours(newCurrentHrs, 300);

    setParameters((prev) => ({ ...prev, runningHours: newCurrentHrs }));
    setServicing300Hr((prev) => ({
      ...prev,
      currentRunningHours: newCurrentHrs,
      lastServiceRunningHours: newLastSvcHrs,
      hoursSinceLastService: elapsed,
      nextServiceDueHours: nextDue,
    }));
  };

  const handleUpdateServicingTask = (
    taskNo: number,
    field: 'status' | 'quantityOrValue' | 'partNumberUsed' | 'remark' | 'description',
    value: string
  ) => {
    setServicing300Hr((prev) => {
      const nextTasks = prev.servicingTasks.map((t) =>
        t.taskNo === taskNo ? { ...t, [field]: value } : t
      );
      if (field === 'description' && isAdmin) {
        saveCustomServicingTasksTemplate(nextTasks);
      }
      return {
        ...prev,
        servicingTasks: nextTasks,
      };
    });
  };

  const handleAdminAddServicingTask = () => {
    if (!isAdmin || !new300HrTaskDraft.description.trim()) return;
    setServicing300Hr((prev) => {
      const nextTaskNo = prev.servicingTasks.length + 1;
      const updated = [
        ...prev.servicingTasks,
        {
          taskNo: nextTaskNo,
          description: new300HrTaskDraft.description.trim(),
          status: new300HrTaskDraft.status,
          quantityOrValue: new300HrTaskDraft.quantityOrValue.trim() || '1 Lot',
          partNumberUsed: new300HrTaskDraft.partNumberUsed.trim() || '-',
          remark: new300HrTaskDraft.remark.trim(),
        },
      ];
      saveCustomServicingTasksTemplate(updated);
      return {
        ...prev,
        servicingTasks: updated,
      };
    });
    setNew300HrTaskDraft({
      description: '',
      status: 'Completed / Replaced',
      quantityOrValue: '1 Lot',
      partNumberUsed: '-',
      remark: '',
    });
    setShowAdd300HrTaskRow(false);
    setSaveToast('Added new 300-Hr Servicing Task to form and saved template.');
    setTimeout(() => setSaveToast(null), 3000);
  };

  const handleAdminDeleteServicingTask = (taskNo: number) => {
    if (!isAdmin) return;
    setServicing300Hr((prev) => {
      const reindexed = prev.servicingTasks
        .filter((t) => t.taskNo !== taskNo)
        .map((t, idx) => ({ ...t, taskNo: idx + 1 }));
      saveCustomServicingTasksTemplate(reindexed);
      return {
        ...prev,
        servicingTasks: reindexed,
      };
    });
    setSaveToast(`Removed Servicing Task #${taskNo} from form template.`);
    setTimeout(() => setSaveToast(null), 3000);
  };

  const handleAdminResetServicingTasks = () => {
    if (!isAdmin) return;
    const restored = resetServicingTasksTemplateToDefault();
    setServicing300Hr((prev) => ({
      ...prev,
      servicingTasks: restored,
    }));
    setSaveToast('Restored default 10-Point 300-Hour Servicing tasks.');
    setTimeout(() => setSaveToast(null), 3000);
  };

  const handleLoad300HrPartsKit = () => {
    setReplacementParts(createStandard300HrPartsKit());
    setSaveToast('Loaded Standard 300-Hour Servicing Filter & Lube Oil Kit (5 items).');
    setTimeout(() => setSaveToast(null), 3000);
  };

  const handleLoadBreakdownPartsKit = () => {
    setReplacementParts(createStandardBreakdownPartsKit());
    setSaveToast('Loaded Emergency Breakdown Repair Parts Kit (3 items).');
    setTimeout(() => setSaveToast(null), 3000);
  };

  const handleBreakdownTimeChange = (
    field: 'breakdownDateTime' | 'arrivalDateTime' | 'rectifiedDateTime',
    val: string
  ) => {
    setBreakdownDetails((prev) => {
      const updated = { ...prev, [field]: val };
      const startMs = new Date(updated.breakdownDateTime).getTime();
      const endMs = new Date(updated.rectifiedDateTime).getTime();
      if (!isNaN(startMs) && !isNaN(endMs) && endMs >= startMs) {
        updated.totalDowntimeHours = Number(((endMs - startMs) / (1000 * 60 * 60)).toFixed(2));
      }
      return updated;
    });
  };

  const currentCenter = useMemo(
    () => centers.find((c) => c.id === selectedCenterId) || centers[0],
    [centers, selectedCenterId]
  );

  const centerGenerators = useMemo(
    () => generators.filter((g) => g.centerId === currentCenter?.id),
    [generators, currentCenter]
  );

  const currentGenerator = useMemo(
    () =>
      centerGenerators.find((g) => g.id === selectedGeneratorId) ||
      centerGenerators[0] ||
      generators[0],
    [centerGenerators, selectedGeneratorId, generators]
  );

  const handleCenterChange = async (newCenterId: string) => {
    setSelectedCenterId(newCenterId);
    const matchedCenter = centers.find((c) => c.id === newCenterId);
    const linkedGens = generators.filter((g) => g.centerId === newCenterId);
    if (linkedGens.length > 0) {
      setSelectedGeneratorId(linkedGens[0].id);
    }
    if (matchedCenter) {
      // Immediate synchronous evaluation + Backend Rule Engine verification
      const localRule = evaluateCenterReceiptEmailRule(
        matchedCenter.centerCode,
        matchedCenter.centerName
      );
      setMatchedEmailRule(localRule);
      setSectorName(localRule.sectorName);
      setRecipientEmails(localRule.defaultRecipients);
      setCustomerName(matchedCenter.contactPerson);
      if (!initialReport) {
        setCustomerSignName(matchedCenter.contactPerson);
      }

      const backendRule = await fetchBackendCenterReceiptEmailRule(
        matchedCenter.centerCode,
        matchedCenter.centerName
      );
      setMatchedEmailRule(backendRule);
      setSectorName(backendRule.sectorName);
      setRecipientEmails(backendRule.defaultRecipients);
    }
  };

  const handleInspectorNameChange = (newName: string) => {
    setInspectorName(newName);
    setInspectorEmail(getEngineerEmailByName(newName));
  };

  const handleSectorChange = (newSectorName: string) => {
    setSectorName(newSectorName);
    const matchedSector = sectorDirectoryList.find((s) => s.sectorName === newSectorName);
    if (matchedSector) {
      setRecipientEmails(matchedSector.defaultRecipients);
    }
    if (currentCenter?.centerCode) {
      saveCenterSectorOverride(currentCenter.centerCode, newSectorName);
    }
  };

  const handleSaveEditedSector = (idx: number) => {
    if (!editingSectorDraft.sectorName.trim()) return;
    const oldSectorName = sectorDirectoryList[idx]?.sectorName;
    const updatedList = sectorDirectoryList.map((s, i) =>
      i === idx
        ? {
            sectorName: editingSectorDraft.sectorName.trim(),
            sectorLeadTitle:
              editingSectorDraft.sectorLeadTitle.trim() || 'Sector Engineering Lead',
            defaultRecipients:
              editingSectorDraft.defaultRecipients.trim() ||
              'chief.engineer@cityproperties.com.mm, satshwe36@gmail.com',
          }
        : s
    );
    const synced = saveCustomSectorDirectory(updatedList).map((s) => ({ ...s }));
    setSectorDirectoryList(synced);
    if (sectorName === oldSectorName) {
      setSectorName(editingSectorDraft.sectorName.trim());
      if (currentCenter?.centerCode) {
        saveCenterSectorOverride(currentCenter.centerCode, editingSectorDraft.sectorName.trim());
      }
    }
    setEditingSectorIdx(null);
    setSaveToast(`Updated Sector Name "${editingSectorDraft.sectorName.trim()}" successfully.`);
    setTimeout(() => setSaveToast(null), 3000);
  };

  const handleAddNewSector = () => {
    const trimmedName = newSectorDraft.sectorName.trim();
    if (!trimmedName) return;
    const newEntry: SectorInfo = {
      sectorName: trimmedName,
      sectorLeadTitle:
        newSectorDraft.sectorLeadTitle.trim() || `${trimmedName} Engineering Lead`,
      defaultRecipients:
        newSectorDraft.defaultRecipients.trim() ||
        'chief.engineer@cityproperties.com.mm, satshwe36@gmail.com',
    };
    const updatedList = [...sectorDirectoryList.filter((s) => s.sectorName !== trimmedName), newEntry];
    const synced = saveCustomSectorDirectory(updatedList).map((s) => ({ ...s }));
    setSectorDirectoryList(synced);
    setSectorName(trimmedName);
    if (currentCenter?.centerCode) {
      saveCenterSectorOverride(currentCenter.centerCode, trimmedName);
    }
    setNewSectorDraft({
      sectorName: '',
      sectorLeadTitle: '',
      defaultRecipients: 'chief.engineer@cityproperties.com.mm, satshwe36@gmail.com',
    });
    setSaveToast(`Added new Sector "${trimmedName}" and assigned to ${currentCenter?.centerCode}.`);
    setTimeout(() => setSaveToast(null), 3000);
  };

  const handleDeleteSectorFromList = (targetSectorName: string) => {
    if (sectorDirectoryList.length <= 1) return;
    const updatedList = sectorDirectoryList.filter((s) => s.sectorName !== targetSectorName);
    const synced = saveCustomSectorDirectory(updatedList).map((s) => ({ ...s }));
    setSectorDirectoryList(synced);
    if (sectorName === targetSectorName && synced[0]) {
      setSectorName(synced[0].sectorName);
    }
    setSaveToast(`Removed Sector "${targetSectorName}" from Sector Directory.`);
    setTimeout(() => setSaveToast(null), 3000);
  };

  const handleResetSectorDirectory = () => {
    const restored = resetSectorDirectoryToDefault().map((s) => ({ ...s }));
    setSectorDirectoryList(restored);
    const defaultSec = getSectorForCenter(currentCenter?.centerCode || 'CMLSPL');
    setSectorName(defaultSec.sectorName);
    setSaveToast('Restored default Sector Directory.');
    setTimeout(() => setSaveToast(null), 3000);
  };

  // Admin Checklist Item Customization Handlers
  const handleStartEditChecklistItem = (def: ChecklistDefinition) => {
    if (!isAdmin) return;
    setEditingChecklistItemNo(def.itemNo);
    setEditingChecklistDraft({
      description: def.description,
      optionsCsv: (def.options || []).join(', '),
      warningCsv: (def.warningOptions || []).join(', '),
      criticalCsv: (def.criticalOptions || []).join(', '),
      remarkHint: def.remarkHint || '',
    });
  };

  const handleSaveEditedChecklistItem = (itemNo: number) => {
    if (!isAdmin || !editingChecklistDraft.description.trim()) return;
    const parsedOptions = editingChecklistDraft.optionsCsv
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean);
    const parsedWarn = editingChecklistDraft.warningCsv
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean);
    const parsedCrit = editingChecklistDraft.criticalCsv
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean);

    const updatedDefs = checklistDefsState.map((d) => {
      if (d.itemNo !== itemNo) return d;
      const nextOptions = parsedOptions.length > 0 ? parsedOptions : d.options;
      const nextGood =
        nextOptions?.filter((o) => !parsedWarn.includes(o) && !parsedCrit.includes(o)) ||
        d.goodOptions;
      return {
        ...d,
        description: editingChecklistDraft.description.trim(),
        options: nextOptions,
        goodOptions: nextGood,
        warningOptions: parsedWarn,
        criticalOptions: parsedCrit,
        remarkHint: editingChecklistDraft.remarkHint.trim() || undefined,
      };
    });

    const synced = saveCustomChecklistDefinitions(updatedDefs).map((d) => ({ ...d }));
    setChecklistDefsState(synced);
    setEditingChecklistItemNo(null);
    setSaveToast(`Checklist Item #${itemNo} updated and saved to Form Template.`);
    setTimeout(() => setSaveToast(null), 3000);
  };

  const handleAdminAddChecklistItem = () => {
    if (!isAdmin || !newChecklistItemDraft.description.trim()) return;
    // Find next item number (skip 26 so 26 remains Readiness Status, new items start at 27+)
    const maxNo = checklistDefsState.reduce(
      (max, d) => (d.itemNo === 26 ? max : Math.max(max, d.itemNo)),
      25
    );
    const nextItemNo = maxNo >= 26 ? maxNo + 1 : 27;

    let options: string[] = ['Good', 'Bad'];
    let goodOptions: string[] = ['Good'];
    let warningOptions: string[] = [];
    let criticalOptions: string[] = ['Bad'];

    if (newChecklistItemDraft.optionsPreset === 'GREEN_AMBER_RED') {
      options = ['Green', 'Amber', 'Red'];
      goodOptions = ['Green'];
      warningOptions = ['Amber'];
      criticalOptions = ['Red'];
    } else if (newChecklistItemDraft.optionsPreset === 'READY_ACTION_CRITICAL') {
      options = ['Checked Good', 'Action Required', 'Critical'];
      goodOptions = ['Checked Good'];
      warningOptions = ['Action Required'];
      criticalOptions = ['Critical'];
    } else if (newChecklistItemDraft.optionsPreset === 'CUSTOM') {
      const customOpts = newChecklistItemDraft.customOptionsCsv
        .split(',')
        .map((o) => o.trim())
        .filter(Boolean);
      options = customOpts.length >= 2 ? customOpts : ['Good', 'Action Required', 'Critical'];
      goodOptions = [options[0]];
      warningOptions = options.length > 2 ? [options[1]] : [];
      criticalOptions = [options[options.length - 1]];
    }

    const newDef: ChecklistDefinition = {
      itemNo: nextItemNo,
      description: newChecklistItemDraft.description.trim(),
      type: 'segmented',
      options,
      goodOptions,
      warningOptions,
      criticalOptions,
      remarkHint: newChecklistItemDraft.remarkHint.trim() || 'Remark (မှတ်ချက်)',
    };

    const updatedDefs = [...checklistDefsState, newDef];
    const synced = saveCustomChecklistDefinitions(updatedDefs).map((d) => ({ ...d }));
    setChecklistDefsState(synced);
    setChecklist((prev) => ({
      ...prev,
      [nextItemNo]: {
        itemNo: nextItemNo,
        selectedOption: options[0],
        remark: '',
      },
    }));
    setNewChecklistItemDraft({
      description: '',
      optionsPreset: 'GOOD_BAD',
      customOptionsCsv: 'Good, Action Required, Critical',
      remarkHint: 'စစ်ဆေးတွေ့ရှိချက် မှတ်ချက်ရေးရန်',
    });
    setShowAddChecklistModal(false);
    setSaveToast(`Added new Checklist Item #${nextItemNo} to Form Template.`);
    setTimeout(() => setSaveToast(null), 3500);
  };

  const handleAdminDeleteChecklistItem = (itemNo: number) => {
    if (!isAdmin || itemNo === 26) return;
    const updatedDefs = checklistDefsState.filter((d) => d.itemNo !== itemNo);
    const synced = saveCustomChecklistDefinitions(updatedDefs).map((d) => ({ ...d }));
    setChecklistDefsState(synced);
    setSaveToast(`Removed Checklist Item #${itemNo} from Form Template.`);
    setTimeout(() => setSaveToast(null), 3000);
  };

  const handleAdminResetChecklistDefs = () => {
    if (!isAdmin) return;
    const restored = resetChecklistDefinitionsToDefault().map((d) => ({ ...d }));
    setChecklistDefsState(restored);
    setChecklist(createDefaultChecklist());
    setSaveToast('Restored default 25-Point + Item #26 Checklist Template.');
    setTimeout(() => setSaveToast(null), 3000);
  };

  const handleAdminAddJobPreset = () => {
    if (!isAdmin || !newJobPresetDraft.label.trim() || !newJobPresetDraft.job.trim()) return;
    const nextPresets = [
      ...jobTypePresets,
      {
        label: newJobPresetDraft.label.trim(),
        job: newJobPresetDraft.job.trim(),
        action:
          newJobPresetDraft.action.trim() ||
          `Performed ${newJobPresetDraft.job.trim()} and verified normal generator operating parameters.`,
      },
    ];
    setJobTypePresets(nextPresets);
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem('cp_custom_job_presets_v1', JSON.stringify(nextPresets));
      } catch {
        // ignore
      }
    }
    setJobRequestType(newJobPresetDraft.job.trim());
    if (newJobPresetDraft.action.trim()) {
      setCorrectedActions(newJobPresetDraft.action.trim());
    }
    setNewJobPresetDraft({ label: '', job: '', action: '' });
    setShowAddJobPresetForm(false);
    setSaveToast(`Added new Job Request Type preset "${newJobPresetDraft.label.trim()}".`);
    setTimeout(() => setSaveToast(null), 3000);
  };

  const handleAdminDeleteJobPreset = (labelToRemove: string) => {
    if (!isAdmin || jobTypePresets.length <= 1) return;
    const nextPresets = jobTypePresets.filter((p) => p.label !== labelToRemove);
    setJobTypePresets(nextPresets);
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem('cp_custom_job_presets_v1', JSON.stringify(nextPresets));
      } catch {
        // ignore
      }
    }
  };

  const handleToggleRecipientEmail = (emailToToggle: string) => {
    const currentList = recipientEmails
      .split(',')
      .map((e) => e.trim())
      .filter(Boolean);
    const exists = currentList.some((e) => e.toLowerCase() === emailToToggle.toLowerCase());
    if (exists) {
      setRecipientEmails(
        currentList.filter((e) => e.toLowerCase() !== emailToToggle.toLowerCase()).join(', ')
      );
    } else {
      setRecipientEmails([...currentList, emailToToggle].join(', '));
    }
  };

  const handleDownloadPdfNow = () => {
    const payload = buildReportPayload();
    downloadReportAsPdfFile(payload);
    setSaveToast(
      `Downloaded CityProperties_Report_${payload.reportNo}_${payload.centerCode}.pdf directly to your device.`
    );
    setTimeout(() => setSaveToast(null), 3500);
  };

  // Real-time health score and readiness calculation
  const evaluation = useMemo(
    () => evaluateInspectionHealth(checklist, customInputs, parameters),
    [checklist, customInputs, parameters, checklistDefsState]
  );

  const effectiveReadinessStatus: ReadinessStatus =
    readinessOverride === 'AUTO' ? evaluation.readinessStatus : readinessOverride;

  // Checklist item counts by Ready / Action Required / Critical for the scroll tab (All technical items excluding #26)
  const checklistStatusCounts = useMemo(() => {
    let readyCount = 0;
    let actionCount = 0;
    let criticalCount = 0;
    const technicalItems = checklistDefsState.filter((d) => d.itemNo !== 26);
    technicalItems.forEach((def) => {
      const sel = checklist[def.itemNo]?.selectedOption || '';
      if (def.criticalOptions?.includes(sel)) {
        criticalCount++;
      } else if (def.warningOptions?.includes(sel)) {
        actionCount++;
      } else {
        readyCount++;
      }
    });
    return {
      total: technicalItems.length,
      readyCount,
      actionCount,
      criticalCount,
    };
  }, [checklist, checklistDefsState]);

  // Threshold checks for Step B
  const isOilPressureLow =
    parameters.engineOilPressureBar > 0 && parameters.engineOilPressureBar < 3.5;
  const isFreqOut =
    parameters.frequencyHz > 0 && (parameters.frequencyHz < 49 || parameters.frequencyHz > 51);
  const isV12Out =
    parameters.voltageL1L2 > 0 && (parameters.voltageL1L2 < 380 || parameters.voltageL1L2 > 415);
  const isV13Out =
    parameters.voltageL1L3 > 0 && (parameters.voltageL1L3 < 380 || parameters.voltageL1L3 > 415);
  const isV23Out =
    parameters.voltageL2L3 > 0 && (parameters.voltageL2L3 < 380 || parameters.voltageL2L3 > 415);

  const handleChecklistOptionChange = (itemNo: number, option: string) => {
    setChecklist((prev) => ({
      ...prev,
      [itemNo]: {
        ...(prev[itemNo] || { itemNo, remark: '' }),
        selectedOption: option,
      },
    }));
  };

  const handleChecklistRemarkChange = (itemNo: number, remark: string) => {
    setChecklist((prev) => ({
      ...prev,
      [itemNo]: {
        ...(prev[itemNo] || { itemNo, selectedOption: '' }),
        remark,
      },
    }));
  };

  const handlePhotoUpload = (
    field: 'insideBodyBeforePhoto' | 'insideBodyAfterPhoto',
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setCustomInputs((prev) => ({
        ...prev,
        [field]: String(reader.result || ''),
      }));
    };
    reader.readAsDataURL(file);
  };

  const handleAddReplacementPart = () => {
    setReplacementParts((prev) => [
      ...prev,
      {
        id: `PART-${Date.now()}`,
        sr: prev.length + 1,
        partsNo: '',
        partsDescription: '',
        qty: '1 No',
        remarks: '',
      },
    ]);
  };

  const handleUpdateReplacementPart = (
    id: string,
    field: keyof ReplacementPart,
    value: string | number
  ) => {
    setReplacementParts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, [field]: value } : p))
    );
  };

  const handleRemoveReplacementPart = (id: string) => {
    setReplacementParts((prev) =>
      prev.filter((p) => p.id !== id).map((p, idx) => ({ ...p, sr: idx + 1 }))
    );
  };

  const handleResetAllGood = () => {
    setChecklist(createDefaultChecklist());
    setSaveToast('All 25 checklist items set to standard nominal values.');
    setTimeout(() => setSaveToast(null), 3000);
  };

  const buildReportPayload = (): InspectionReport => {
    return {
      id: initialReport?.id || `REP-${reportNo}-${Date.now().toString().slice(-4)}`,
      reportNo: reportNo.trim() || nextReportNo,
      formCategory,
      servicing300Hr:
        formCategory === 'REGULAR_SERVICING_300HR'
          ? {
              ...servicing300Hr,
              currentRunningHours: parameters.runningHours,
            }
          : undefined,
      breakdownDetails:
        formCategory === 'BREAKDOWN_REPORT' ? breakdownDetails : undefined,
      centerId: currentCenter.id,
      centerCode: currentCenter.centerCode,
      centerName: currentCenter.centerName,
      address: currentCenter.address,
      contactPerson: currentCenter.contactPerson,
      contactPhone: currentCenter.contactPhone,
      generatorId: currentGenerator.id,
      kvaRating: currentGenerator.kvaRating,
      gensetModel: currentGenerator.gensetModel,
      gensetSerialNo: currentGenerator.gensetSerialNo,
      engineModel: currentGenerator.engineModel,
      engineSerialNo: currentGenerator.engineSerialNo,
      alternatorModel: currentGenerator.alternatorModel,
      alternatorSerialNo: currentGenerator.alternatorSerialNo,
      controllerModel: currentGenerator.controllerModel,
      avrModel: currentGenerator.avrModel,
      breakerType: currentGenerator.breakerType,
      breakerPoles: currentGenerator.breakerPoles,
      breakerAmpRating: currentGenerator.breakerAmpRating,
      inspectionDate,
      sectorName,
      inspectorName,
      inspectorEmail,
      recipientEmails,
      customerName,
      customerSignName,
      jobRequestType,
      correctedActions,
      generalRemarks,
      errorsFound,
      parameters,
      checklist: {
        ...checklist,
        26: {
          itemNo: 26,
          selectedOption: effectiveReadinessStatus,
          remark:
            checklist[26]?.remark ||
            `Overall Readiness: ${effectiveReadinessStatus}`,
        },
      },
      customInputs,
      replacementParts,
      engineerSignatureDataUrl,
      engineerSignDate,
      customerSignatureDataUrl,
      customerSignDate,
      customerComment,
      healthScore: evaluation.healthScore,
      readinessStatus: effectiveReadinessStatus,
      defectsList: evaluation.defectsList,
      matchedEmailRuleId: matchedEmailRule.ruleId,
      activityResolution: initialReport?.activityResolution,
      createdAt: initialReport?.createdAt || new Date().toISOString(),
    };
  };

  const handleSubmit = (openPrintAfterSave: boolean) => {
    const payload = buildReportPayload();
    onSaveReport(payload, openPrintAfterSave);
    if (!openPrintAfterSave) {
      setSaveToast(
        `${
          formCategory === 'REGULAR_SERVICING_300HR'
            ? '300-Hr Regular Servicing'
            : formCategory === 'BREAKDOWN_REPORT'
            ? 'Breakdown & Emergency Repair'
            : 'Regular Inspection'
        } Report #${payload.reportNo} saved to database.`
      );
      setTimeout(() => setSaveToast(null), 3500);
    }
  };

  return (
    <div className="space-y-6">
      {/* =====================================================================
          TWO-FORM SELECTOR: REGULAR INSPECTION vs 300-HOUR REGULAR SERVICING
         ===================================================================== */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 sm:p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-start gap-3">
            <img
              src="/assets/aistudio/cp_logo_cb60fbe9.jfif"
              alt="City Properties Logo"
              className="h-10 w-auto object-contain rounded border border-slate-200 bg-white p-0.5 shrink-0 mt-0.5"
            />
            <div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mb-1">
                <span>Gen SOP-002 / Version 02</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono font-bold text-slate-700">Report #{reportNo}</span>
                <span aria-hidden="true">·</span>
                <span>
                  {currentCenter?.centerCode} — {currentGenerator?.kvaRating}
                </span>
              </div>
              <h2 className="text-lg font-bold text-slate-900">
                {formCategory === 'REGULAR_SERVICING_300HR'
                  ? 'Form 2: Regular Servicing Form (300-Hour Generator Running Hour PM)'
                  : formCategory === 'BREAKDOWN_REPORT'
                  ? 'Form 3: Breakdown & Emergency Repair Form (Root Cause & Downtime Log)'
                  : 'Form 1: Regular Inspection Form (Monthly Routine & 25-Point Checklist)'}
              </h2>
            </div>
          </div>

          {/* Live Health & Readiness Telemetry */}
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-3 pr-4 border-r border-slate-200">
              {formCategory === 'REGULAR_SERVICING_300HR' && (
                <div className="pr-3 border-r border-slate-200">
                  <div className="text-[11px] font-medium text-slate-500">
                    Hrs Since Last Service
                  </div>
                  <div
                    className={`text-xl font-bold font-mono tabular-nums ${
                      servicing300Hr.hoursSinceLastService >= 300
                        ? 'text-red-600'
                        : servicing300Hr.hoursSinceLastService >= 270
                        ? 'text-amber-600'
                        : 'text-emerald-700'
                    }`}
                  >
                    {servicing300Hr.hoursSinceLastService} / 300 hr
                  </div>
                </div>
              )}
              {formCategory === 'BREAKDOWN_REPORT' && (
                <div className="pr-3 border-r border-slate-200">
                  <div className="text-[11px] font-medium text-slate-500">
                    Total Downtime
                  </div>
                  <div className="text-xl font-bold font-mono tabular-nums text-red-600">
                    {breakdownDetails.totalDowntimeHours} hrs
                  </div>
                </div>
              )}
              <div>
                <div className="text-[11px] font-medium text-slate-500">Checklist Health Score</div>
                <div className="text-xl font-bold font-mono tabular-nums text-slate-900">
                  {evaluation.healthScore}%
                </div>
              </div>
              <div>
                <div className="text-[11px] font-medium text-slate-500">Readiness Status</div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  {effectiveReadinessStatus === 'Ready' && (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
                      <CheckCircle2 className="w-4 h-4" /> Ready
                    </span>
                  )}
                  {effectiveReadinessStatus === 'Action Required' && (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700">
                      <AlertTriangle className="w-4 h-4" /> Action Required ({evaluation.defectsList.length})
                    </span>
                  )}
                  {effectiveReadinessStatus === 'Critical' && (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-700">
                      <AlertOctagon className="w-4 h-4" /> Critical Alert
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {onCancelEdit && (
                <button
                  type="button"
                  onClick={onCancelEdit}
                  className="px-3 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0"
                >
                  Cancel
                </button>
              )}
              <button
                type="button"
                onClick={handleDownloadPdfNow}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-300 hover:bg-emerald-100 rounded-lg transition-colors whitespace-nowrap shrink-0"
                title="Download standalone 2-Page .pdf file directly"
              >
                <Download className="w-3.5 h-3.5" />
                Download PDF (.pdf)
              </button>
              <button
                type="button"
                onClick={() => handleSubmit(false)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-800 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                <Save className="w-3.5 h-3.5" />
                Save Report
              </button>
              <button
                type="button"
                onClick={() => handleSubmit(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                <Printer className="w-3.5 h-3.5" />
                Save & Print 2-Page View
              </button>
            </div>
          </div>
        </div>

        {/* Dedicated 3-Form Type Switcher Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-3 border-t border-slate-200">
          <button
            type="button"
            onClick={() => handleSwitchFormCategory('REGULAR_INSPECTION')}
            className={`text-left p-3.5 rounded-lg border transition-all flex items-start justify-between gap-3 ${
              formCategory === 'REGULAR_INSPECTION'
                ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                : 'bg-slate-50/70 text-slate-800 border-slate-200 hover:bg-slate-100'
            }`}
          >
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <ClipboardCheck className="w-4 h-4 shrink-0" />
                <span className="text-xs font-bold uppercase tracking-wider">
                  Form 1 · Regular Inspection
                </span>
              </div>
              <p
                className={`text-xs ${
                  formCategory === 'REGULAR_INSPECTION' ? 'text-slate-300' : 'text-slate-500'
                }`}
              >
                Monthly Routine Inspection, Test Run Operating Parameters & 25-Point Checklist (Gen SOP-002).
              </p>
            </div>
            <span
              className={`text-[11px] font-mono font-semibold px-2 py-0.5 rounded shrink-0 ${
                formCategory === 'REGULAR_INSPECTION'
                  ? 'bg-white text-slate-900'
                  : 'bg-slate-200 text-slate-700'
              }`}
            >
              Routine Check
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleSwitchFormCategory('REGULAR_SERVICING_300HR')}
            className={`text-left p-3.5 rounded-lg border transition-all flex items-start justify-between gap-3 ${
              formCategory === 'REGULAR_SERVICING_300HR'
                ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                : 'bg-slate-50/70 text-slate-800 border-slate-200 hover:bg-slate-100'
            }`}
          >
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Gauge className="w-4 h-4 shrink-0" />
                <span className="text-xs font-bold uppercase tracking-wider">
                  Form 2 · 300-Hr Regular Servicing
                </span>
              </div>
              <p
                className={`text-xs ${
                  formCategory === 'REGULAR_SERVICING_300HR' ? 'text-slate-300' : 'text-slate-500'
                }`}
              >
                300-Hr Running Hour Interval Tracker, Engine Lube Oil & Filter Overhaul (10 Tasks) & Parts Kit.
              </p>
            </div>
            <span
              className={`text-[11px] font-mono font-semibold px-2 py-0.5 rounded shrink-0 ${
                formCategory === 'REGULAR_SERVICING_300HR'
                  ? 'bg-amber-400 text-slate-950'
                  : 'bg-slate-200 text-slate-700'
              }`}
            >
              300-Hr PM
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleSwitchFormCategory('BREAKDOWN_REPORT')}
            className={`text-left p-3.5 rounded-lg border transition-all flex items-start justify-between gap-3 ${
              formCategory === 'BREAKDOWN_REPORT'
                ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                : 'bg-slate-50/70 text-slate-800 border-slate-200 hover:bg-slate-100'
            }`}
          >
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <AlertOctagon className="w-4 h-4 shrink-0 text-red-500" />
                <span className="text-xs font-bold uppercase tracking-wider">
                  Form 3 · Breakdown Report
                </span>
              </div>
              <p
                className={`text-xs ${
                  formCategory === 'BREAKDOWN_REPORT' ? 'text-slate-300' : 'text-slate-500'
                }`}
              >
                Emergency Callout, Fault & Alarm Code Log, Root Cause Analysis, Downtime Hours & Rectification.
              </p>
            </div>
            <span
              className={`text-[11px] font-mono font-semibold px-2 py-0.5 rounded shrink-0 ${
                formCategory === 'BREAKDOWN_REPORT'
                  ? 'bg-red-500 text-white'
                  : 'bg-red-100 text-red-800'
              }`}
            >
              Emergency
            </span>
          </button>
        </div>

        {/* Service Engineer Active Form Scope & Required Steps Guide */}
        <div className="pt-3 border-t border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-slate-50/80 -mx-4 sm:-mx-5 -mb-4 sm:-mb-5 px-4 sm:px-5 py-3 rounded-b-lg">
          <div className="space-y-0.5">
            <div className="text-xs font-bold text-slate-900 flex flex-wrap items-center gap-2">
              <span className="px-2 py-0.5 text-[10px] font-mono uppercase bg-slate-900 text-white rounded">
                Service Engineer Workflow
              </span>
              <span>
                {formCategory === 'REGULAR_SERVICING_300HR'
                  ? 'Selected: Form 2 — 300-Hour Regular Servicing (Starts at Step A → 300-Hr Oil/Filter Log → Step B → Step C [Items 1–26] → Step D)'
                  : formCategory === 'BREAKDOWN_REPORT'
                  ? 'Selected: Form 3 — Breakdown & Emergency Repair (Starts at Step A → Breakdown Root Cause & Downtime → Step B → Step C [Items 1–26] → Step D)'
                  : 'Selected: Form 1 — Monthly Regular Inspection (Starts at Step A → Step B Operating Telemetry → Step C [Items 1–26] → Step D Sign-Off)'}
              </span>
            </div>
            <p className="text-[11px] text-slate-600 font-myanmar">
              Service Engineer အနေဖြင့် မိမိဆောင်ရွက်ရမည့် Form အမျိုးအစားကို တစ်ခုချင်းစီ ရွေးချယ်ဖြည့်သွင်းနိုင်ပြီး၊ Save မလုပ်ရသေးမီ အခြား Form တစ်ခုသို့ ပြောင်းနှိပ်ပါက ၎င်း Form အသစ်၏ Step A မှ အစအဆုံး ပြန်လည်စတင်ပေးပါသည်။
            </p>
          </div>
          <div className="text-[11px] font-mono font-semibold text-slate-700 shrink-0">
            Current Step: <strong className="text-slate-950 uppercase">{activeTab}</strong>
          </div>
        </div>
      </div>

      {saveToast && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 px-4 py-2.5 rounded-lg text-xs font-medium flex items-center justify-between">
          <span>{saveToast}</span>
          <button
            type="button"
            onClick={() => setSaveToast(null)}
            className="text-emerald-700 hover:text-emerald-950 font-semibold"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Multi-Step Interactive Segmented Navigation */}
      <div className="bg-slate-200/70 p-1 rounded-lg flex overflow-x-auto scrollbar-none gap-1">
        <button
          type="button"
          onClick={() => setActiveTab('stepA')}
          className={`flex items-center justify-center gap-2 px-3 py-2.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
            activeTab === 'stepA'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Step A: Header & Nameplate</span>
        </button>

        {formCategory === 'REGULAR_SERVICING_300HR' && (
          <button
            type="button"
            onClick={() => setActiveTab('step300Hr')}
            className={`flex items-center justify-center gap-2 px-3 py-2.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'step300Hr'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>300-Hr Servicing & Oil/Filter Log</span>
          </button>
        )}

        {formCategory === 'BREAKDOWN_REPORT' && (
          <button
            type="button"
            onClick={() => setActiveTab('stepBreakdown')}
            className={`flex items-center justify-center gap-2 px-3 py-2.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'stepBreakdown'
                ? 'bg-white text-red-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <AlertOctagon className="w-3.5 h-3.5 text-red-600" />
            <span>Breakdown Root Cause & Downtime</span>
          </button>
        )}

        <button
          type="button"
          onClick={() => setActiveTab('stepB')}
          className={`flex items-center justify-center gap-2 px-3 py-2.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
            activeTab === 'stepB'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Sliders className="w-3.5 h-3.5" />
          <span>Step B: Operating Parameters</span>
          {(isOilPressureLow || isFreqOut || isV12Out || isV13Out || isV23Out) && (
            <AlertOctagon className="w-3.5 h-3.5 text-red-600" />
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('stepC')}
          className={`flex items-center justify-center gap-2 px-3 py-2.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
            activeTab === 'stepC'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <ClipboardCheck className="w-3.5 h-3.5" />
          <span>Step C: 25-Point Checklist</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('stepD')}
          className={`flex items-center justify-center gap-2 px-3 py-2.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
            activeTab === 'stepD'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Wrench className="w-3.5 h-3.5" />
          <span>Step D: Parts & Digital Sign-Off</span>
        </button>
      </div>

      {/* =====================================================================
          STEP A: AUTO-FILLED HEADER & JOB DETAILS
         ===================================================================== */}
      {activeTab === 'stepA' && (
        <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-4 border-b border-slate-200">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                01. Center Selection & Auto-Populated Generator Nameplate
              </h3>
              <p className="text-xs text-slate-500">
                Selecting a Center filters its linked Generators and auto-fills all technical specifications.
              </p>
            </div>
            <span className="text-xs font-mono text-slate-500">
              {centers.length} Centers · {generators.length} Generators Indexed
            </span>
          </div>

          {/* Primary Selectors */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Select Center Name ({centers.length} Centers)
              </label>
              <select
                value={currentCenter?.id || ''}
                onChange={(e) => handleCenterChange(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white font-medium"
              >
                {centers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.centerCode} — {c.centerName}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Select Linked Generator ({centerGenerators.length} Units)
              </label>
              <select
                value={currentGenerator?.id || ''}
                onChange={(e) => setSelectedGeneratorId(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white font-medium"
              >
                {centerGenerators.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.id}: {g.generatorLabel} ({g.gensetModel})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-slate-700">
                  Report Serial No. {isAdmin ? '(Admin Editable)' : '(System Auto-Generated)'}
                </label>
                <button
                  type="button"
                  onClick={handleAutoRefreshSerialNo}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 hover:text-emerald-900"
                  title="Generate next sequential Report Serial No. from Backend"
                >
                  <RotateCcw className="w-3 h-3" />
                  Auto-Generate
                </button>
              </div>
              <div className="relative">
                <input
                  type="text"
                  value={reportNo}
                  readOnly={!initialReport && !isAdmin}
                  onChange={(e) => setReportNo(e.target.value)}
                  className={`w-full px-3 py-2 pr-28 text-sm font-mono font-bold border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 ${
                    !initialReport && !isAdmin ? 'bg-slate-50' : 'bg-white'
                  } text-slate-900 tabular-nums`}
                />
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 px-2 py-0.5 text-[10px] font-mono font-bold bg-emerald-100 text-emerald-800 rounded">
                  {isAdmin ? 'ADMIN EDIT' : 'AUTO SERIAL'}
                </span>
              </div>
            </div>
          </div>

          {/* Backend Rule-Based Auto Receipt Email Routing Banner (Step A) */}
          <div className="bg-emerald-50/70 border border-emerald-200 rounded-lg p-3.5 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <Mail className="w-4 h-4 text-emerald-800 shrink-0" />
                <span className="text-xs font-bold text-slate-900">
                  Backend Rule-Based Auto Receipt Email ({currentCenter?.centerCode} — {currentCenter?.centerName})
                </span>
                <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-emerald-800 text-white rounded">
                  {matchedEmailRule.ruleId}
                </span>
              </div>
              <p className="text-[11px] text-slate-600 font-myanmar">
                Center Name ရွေးချယ်လိုက်သည်နှင့် Backend Rule Engine မှ သက်ဆိုင်ရာ Center Facility Email (<strong>{matchedEmailRule.centerFacilityEmail}</strong>) နှင့် Sector တာဝန်ရှိသူများ၏ Receipt Email များကို အလိုအလျောက် ခွဲခြားထည့်သွင်းပေးထားပါသည်။
              </p>
            </div>
            <div className="lg:w-[440px] shrink-0">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-emerald-900 mb-1">
                Auto-Populated Receipt Mail (Editable):
              </label>
              <input
                type="text"
                value={recipientEmails}
                onChange={(e) => setRecipientEmails(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs font-mono border border-emerald-300 rounded bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>
          </div>

          {/* Auto-Filled Technical Nameplate Readout Table */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
            <div className="text-xs font-semibold text-slate-700 mb-3 flex items-center justify-between">
              <span>Auto-Populated Nameplate & Facility Specifications</span>
              <span className="font-mono text-slate-500">Asset ID: {currentGenerator?.id}</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
              <div className="bg-white p-2.5 rounded border border-slate-200/80">
                <div className="text-slate-500 text-[11px]">Genset Model / KVA</div>
                <div className="font-mono font-bold text-slate-900 mt-0.5">
                  {currentGenerator?.gensetModel} ({currentGenerator?.kvaRating})
                </div>
              </div>
              <div className="bg-white p-2.5 rounded border border-slate-200/80">
                <div className="text-slate-500 text-[11px]">Genset Serial No.</div>
                <div className="font-mono font-semibold text-slate-900 mt-0.5 truncate">
                  {currentGenerator?.gensetSerialNo}
                </div>
              </div>
              <div className="bg-white p-2.5 rounded border border-slate-200/80">
                <div className="text-slate-500 text-[11px]">Engine Model / Serial</div>
                <div className="font-mono font-semibold text-slate-900 mt-0.5 truncate">
                  {currentGenerator?.engineModel} · {currentGenerator?.engineSerialNo}
                </div>
              </div>
              <div className="bg-white p-2.5 rounded border border-slate-200/80">
                <div className="text-slate-500 text-[11px]">Alternator Model / S/N</div>
                <div className="font-mono font-semibold text-slate-900 mt-0.5 truncate">
                  {currentGenerator?.alternatorModel} · {currentGenerator?.alternatorSerialNo}
                </div>
              </div>
              <div className="bg-white p-2.5 rounded border border-slate-200/80">
                <div className="text-slate-500 text-[11px]">Controller & AVR</div>
                <div className="font-mono font-semibold text-slate-900 mt-0.5 truncate">
                  {currentGenerator?.controllerModel} / {currentGenerator?.avrModel}
                </div>
              </div>
              <div className="bg-white p-2.5 rounded border border-slate-200/80">
                <div className="text-slate-500 text-[11px]">Breaker Spec</div>
                <div className="font-mono font-semibold text-slate-900 mt-0.5">
                  {currentGenerator?.breakerType} · {currentGenerator?.breakerPoles} · {currentGenerator?.breakerAmpRating}A
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3 pt-3 border-t border-slate-200 text-xs">
              <div>
                <span className="text-slate-500">Center Contact: </span>
                <strong className="text-slate-900">{currentCenter?.contactPerson}</strong>
              </div>
              <div>
                <span className="text-slate-500">Phone: </span>
                <strong className="font-mono text-slate-900">{currentCenter?.contactPhone}</strong>
              </div>
              <div>
                <span className="text-slate-500">Address: </span>
                <strong className="text-slate-900">{currentCenter?.address}</strong>
              </div>
            </div>
          </div>

          {/* Inspection Metadata, Sector & Field Engineer Inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Service / Inspection Date
              </label>
              <input
                type="date"
                value={inspectionDate}
                onChange={(e) => {
                  setInspectionDate(e.target.value);
                  setEngineerSignDate(e.target.value);
                  setCustomerSignDate(e.target.value);
                }}
                className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-700">
                  Service Sector Name (ပြင်ဆင်နိုင်သည် / Editable)
                </label>
                <button
                  type="button"
                  onClick={() => setShowSectorManager((prev) => !prev)}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-700 hover:text-slate-950 underline"
                >
                  <Edit3 className="w-3 h-3" />
                  {showSectorManager ? 'Hide Sector Manager' : 'Edit / Manage Sectors'}
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <select
                  value={
                    sectorDirectoryList.some((s) => s.sectorName === sectorName)
                      ? sectorName
                      : '__CUSTOM__'
                  }
                  onChange={(e) => {
                    if (e.target.value !== '__CUSTOM__') {
                      handleSectorChange(e.target.value);
                    }
                  }}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white font-medium"
                >
                  {sectorDirectoryList.map((sec) => (
                    <option key={sec.sectorName} value={sec.sectorName}>
                      {sec.sectorName}
                    </option>
                  ))}
                  {!sectorDirectoryList.some((s) => s.sectorName === sectorName) && (
                    <option value="__CUSTOM__">Custom: {sectorName}</option>
                  )}
                </select>
                <input
                  type="text"
                  value={sectorName}
                  onChange={(e) => {
                    setSectorName(e.target.value);
                    if (currentCenter?.centerCode) {
                      saveCenterSectorOverride(currentCenter.centerCode, e.target.value);
                    }
                  }}
                  placeholder="Sector Name ရိုက်ထည့်/ပြင်ဆင်ရန်..."
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white font-medium font-myanmar"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Inspector / Field Engineer Name
              </label>
              <input
                type="text"
                list="field-engineers-list"
                value={inspectorName}
                onChange={(e) => handleInspectorNameChange(e.target.value)}
                placeholder="e.g., Wai Phyo Kyaw"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
              <datalist id="field-engineers-list">
                {FIELD_ENGINEER_DIRECTORY.map((eng) => (
                  <option key={eng.email} value={eng.name} />
                ))}
              </datalist>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Field Engineer Email (Auto-linked at Form End)
              </label>
              <input
                type="email"
                value={inspectorEmail}
                onChange={(e) => setInspectorEmail(e.target.value)}
                placeholder="waiphyokyaw@cityproperties.com.mm"
                className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 bg-slate-50"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Checklist Customer Name
              </label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="e.g., Ko Soe Nyein Oo"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Report Sign-Off Customer Name
              </label>
              <input
                type="text"
                value={customerSignName}
                onChange={(e) => setCustomerSignName(e.target.value)}
                placeholder="e.g., Paing Lin Htet"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>
          </div>

          {/* Expandable Sector Name & Directory Manager Panel */}
          {showSectorManager && (
            <div className="bg-slate-50 border border-slate-300 rounded-lg p-4 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
                <div>
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    <Building2 className="w-4 h-4 text-slate-800" />
                    Sector Name Directory & Center Sector Assignment (Sector Name များ ပြင်ဆင်/ထပ်တိုးရန်)
                  </h4>
                  <p className="text-[11px] text-slate-600 font-myanmar mt-0.5">
                    ရှိပြီးသား Sector Name များကို ပြင်ဆင်နိုင်သလို Sector အသစ်များလည်း ထပ်တိုးနိုင်ပါသည်။ ပြင်ဆင်လိုက်သော Sector Name သည် လက်ရှိ Center ({currentCenter?.centerCode}) နှင့် Report များတွင် အလိုအလျောက် သက်ရောက်ပါမည်။
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={handleResetSectorDirectory}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-100"
                    >
                      <RotateCcw className="w-3 h-3" />
                      Reset Default Sectors
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowSectorManager(false)}
                    className="p-1 text-slate-500 hover:text-slate-900"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Existing Sector List with Inline Rename / Edit */}
              <div className="space-y-2">
                {sectorDirectoryList.map((sec, idx) => {
                  const isEditingThis = editingSectorIdx === idx;
                  return (
                    <div
                      key={`${sec.sectorName}-${idx}`}
                      className="bg-white border border-slate-200 rounded-lg p-3 flex flex-col lg:flex-row lg:items-center justify-between gap-3"
                    >
                      {isEditingThis ? (
                        <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-2">
                          <div>
                            <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                              Sector Name
                            </label>
                            <input
                              type="text"
                              value={editingSectorDraft.sectorName}
                              onChange={(e) =>
                                setEditingSectorDraft({
                                  ...editingSectorDraft,
                                  sectorName: e.target.value,
                                })
                              }
                              className="w-full px-2.5 py-1.5 text-xs font-semibold border border-slate-300 rounded font-myanmar"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                              Sector Lead Title
                            </label>
                            <input
                              type="text"
                              value={editingSectorDraft.sectorLeadTitle}
                              onChange={(e) =>
                                setEditingSectorDraft({
                                  ...editingSectorDraft,
                                  sectorLeadTitle: e.target.value,
                                })
                              }
                              className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                              Default Receipt Emails (CSV)
                            </label>
                            <input
                              type="text"
                              value={editingSectorDraft.defaultRecipients}
                              onChange={(e) =>
                                setEditingSectorDraft({
                                  ...editingSectorDraft,
                                  defaultRecipients: e.target.value,
                                })
                              }
                              className="w-full px-2.5 py-1.5 text-xs font-mono border border-slate-300 rounded"
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-900 font-myanmar">
                              {sec.sectorName}
                            </span>
                            {sectorName === sec.sectorName && (
                              <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-emerald-100 text-emerald-800 rounded">
                                Selected for {currentCenter?.centerCode}
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            Lead: {sec.sectorLeadTitle} · Default CC:{' '}
                            <span className="font-mono">{sec.defaultRecipients}</span>
                          </div>
                        </div>
                      )}

                      <div className="flex items-center gap-1.5 shrink-0">
                        {isEditingThis ? (
                          <>
                            <button
                              type="button"
                              onClick={() => handleSaveEditedSector(idx)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold bg-emerald-700 text-white rounded hover:bg-emerald-800"
                            >
                              <Check className="w-3.5 h-3.5" />
                              Save Sector
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingSectorIdx(null)}
                              className="px-2.5 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 rounded hover:bg-slate-200"
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => handleSectorChange(sec.sectorName)}
                              className="px-2.5 py-1 text-[11px] font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded"
                            >
                              Select
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingSectorIdx(idx);
                                setEditingSectorDraft({ ...sec });
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-slate-800 bg-white border border-slate-300 hover:bg-slate-50 rounded"
                            >
                              <Edit3 className="w-3 h-3" />
                              Edit Name
                            </button>
                            {isAdmin && sectorDirectoryList.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleDeleteSectorFromList(sec.sectorName)}
                                className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                                title="Delete Sector"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Add New Sector Name Row */}
              <div className="bg-white border border-slate-300 rounded-lg p-3 space-y-2">
                <div className="text-xs font-bold text-slate-800">
                  + Add New Sector Name (Sector အသစ်ထပ်တိုးရန်)
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-2 items-end">
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">
                      New Sector Name
                    </label>
                    <input
                      type="text"
                      value={newSectorDraft.sectorName}
                      onChange={(e) =>
                        setNewSectorDraft({ ...newSectorDraft, sectorName: e.target.value })
                      }
                      placeholder="e.g., Upper Myanmar Retail Sector"
                      className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded font-myanmar"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">
                      Sector Lead Title
                    </label>
                    <input
                      type="text"
                      value={newSectorDraft.sectorLeadTitle}
                      onChange={(e) =>
                        setNewSectorDraft({ ...newSectorDraft, sectorLeadTitle: e.target.value })
                      }
                      placeholder="e.g., Regional Sector Lead"
                      className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">
                      Default Receipt Emails
                    </label>
                    <input
                      type="text"
                      value={newSectorDraft.defaultRecipients}
                      onChange={(e) =>
                        setNewSectorDraft({
                          ...newSectorDraft,
                          defaultRecipients: e.target.value,
                        })
                      }
                      placeholder="chief.engineer@cityproperties.com.mm"
                      className="w-full px-2.5 py-1.5 text-xs font-mono border border-slate-300 rounded"
                    />
                  </div>
                  <div>
                    <button
                      type="button"
                      onClick={handleAddNewSector}
                      className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-slate-900 text-white rounded hover:bg-slate-800"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add & Use Sector
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                <label className="block text-xs font-semibold text-slate-700">
                  Customer Job Request Type / Service Sub-Category
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-slate-500">
                    Quick-select service type for specialized reporting:
                  </span>
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => setShowAddJobPresetForm((prev) => !prev)}
                      className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded border border-slate-300"
                    >
                      <Plus className="w-3 h-3" />
                      {showAddJobPresetForm ? 'Close' : 'Add Job Type (အသစ်ထည့်ရန်)'}
                    </button>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {jobTypePresets.map((preset) => (
                  <div key={preset.label} className="inline-flex items-center">
                    <button
                      type="button"
                      onClick={() => {
                        setJobRequestType(preset.job);
                        setCorrectedActions(preset.action);
                      }}
                      className={`px-2.5 py-1 text-[11px] font-semibold rounded border transition-colors ${
                        jobRequestType === preset.job
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100'
                      }`}
                    >
                      {preset.label}
                    </button>
                    {isAdmin && isAdminFormEditMode && jobTypePresets.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleAdminDeleteJobPreset(preset.label)}
                        className="ml-0.5 p-1 text-red-600 hover:bg-red-50 rounded"
                        title="Remove preset"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {isAdmin && showAddJobPresetForm && (
                <div className="bg-slate-50 border border-slate-300 rounded-lg p-3 mb-2 space-y-2">
                  <div className="text-xs font-bold text-slate-900">
                    Admin: Add Custom Job Request Type Preset
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    <input
                      type="text"
                      value={newJobPresetDraft.label}
                      onChange={(e) =>
                        setNewJobPresetDraft({ ...newJobPresetDraft, label: e.target.value })
                      }
                      placeholder="Button Label (e.g., ATS Annual Testing)"
                      className="px-2.5 py-1.5 text-xs border border-slate-300 rounded bg-white"
                    />
                    <input
                      type="text"
                      value={newJobPresetDraft.job}
                      onChange={(e) =>
                        setNewJobPresetDraft({ ...newJobPresetDraft, job: e.target.value })
                      }
                      placeholder="Full Job Request Title"
                      className="px-2.5 py-1.5 text-xs border border-slate-300 rounded bg-white"
                    />
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        value={newJobPresetDraft.action}
                        onChange={(e) =>
                          setNewJobPresetDraft({ ...newJobPresetDraft, action: e.target.value })
                        }
                        placeholder="Default Corrected Actions Narrative"
                        className="flex-1 px-2.5 py-1.5 text-xs border border-slate-300 rounded bg-white"
                      />
                      <button
                        type="button"
                        onClick={handleAdminAddJobPreset}
                        className="px-3 py-1.5 text-xs font-semibold bg-slate-900 text-white rounded hover:bg-slate-800 shrink-0"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <input
                type="text"
                value={jobRequestType}
                onChange={(e) => setJobRequestType(e.target.value)}
                placeholder="e.g., Genset Monthly Routine Inspection"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Corrected Actions (Service Report Form Narrative)
              </label>
              <textarea
                rows={3}
                value={correctedActions}
                onChange={(e) => setCorrectedActions(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 font-myanmar"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  General Remarks (Page 1 Remarks)
                </label>
                <textarea
                  rows={2}
                  value={generalRemarks}
                  onChange={(e) => setGeneralRemarks(e.target.value)}
                  placeholder="Optional remarks for Page 1 Service Report"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 font-myanmar"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1 font-myanmar">
                  Errors (တွေ့ရှိချက်များ) — Page 2 Checklist Footer
                </label>
                <textarea
                  rows={2}
                  value={errorsFound}
                  onChange={(e) => setErrorsFound(e.target.value)}
                  placeholder="Record any defects or abnormalities (တွေ့ရှိချက်များ ရေးသွင်းရန်)"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 font-myanmar"
                />
              </div>
            </div>
          </div>

          {/* If Form 2 (300-Hr Servicing) is active, show Running Hour Interval Summary right in Step A */}
          {formCategory === 'REGULAR_SERVICING_300HR' && (
            <div className="bg-amber-50/60 border border-amber-300 rounded-lg p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-800" />
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                    300-Hour Generator Running Hour Interval Tracker
                  </h4>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('step300Hr')}
                  className="text-xs font-semibold text-slate-900 underline hover:text-slate-700"
                >
                  Open Full 10-Point 300-Hr Servicing Overhaul Table →
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
                <div className="bg-white p-2.5 rounded border border-amber-200">
                  <label className="block text-[11px] font-medium text-slate-500 mb-1">
                    Last 300-Hr Service Run Hrs
                  </label>
                  <input
                    type="text"
                    value={servicing300Hr.lastServiceRunningHours}
                    onChange={(e) =>
                      updateRunningHoursAndInterval(parameters.runningHours, e.target.value)
                    }
                    className="w-full px-2 py-1 font-mono font-bold text-slate-900 border border-slate-300 rounded"
                  />
                </div>

                <div className="bg-white p-2.5 rounded border border-amber-200">
                  <label className="block text-[11px] font-medium text-slate-500 mb-1">
                    Current Generator Run Hrs
                  </label>
                  <input
                    type="text"
                    value={parameters.runningHours}
                    onChange={(e) =>
                      updateRunningHoursAndInterval(
                        e.target.value,
                        servicing300Hr.lastServiceRunningHours
                      )
                    }
                    className="w-full px-2 py-1 font-mono font-bold text-slate-900 border border-slate-300 rounded"
                  />
                </div>

                <div className="bg-white p-2.5 rounded border border-amber-200">
                  <div className="text-[11px] font-medium text-slate-500">
                    Elapsed Hours Since Last Service
                  </div>
                  <div
                    className={`font-mono text-base font-bold mt-1 tabular-nums ${
                      servicing300Hr.hoursSinceLastService >= 300
                        ? 'text-red-600'
                        : servicing300Hr.hoursSinceLastService >= 270
                        ? 'text-amber-700'
                        : 'text-emerald-700'
                    }`}
                  >
                    {servicing300Hr.hoursSinceLastService} hrs
                    <span className="text-[11px] font-normal text-slate-500 ml-1">
                      / 300 hr interval
                    </span>
                  </div>
                </div>

                <div className="bg-white p-2.5 rounded border border-amber-200">
                  <div className="text-[11px] font-medium text-slate-500">
                    Next 300-Hr Service Due At
                  </div>
                  <div className="font-mono text-base font-bold text-slate-900 mt-1 tabular-nums">
                    {servicing300Hr.nextServiceDueHours} hrs
                  </div>
                </div>

                <div className="bg-white p-2.5 rounded border border-amber-200">
                  <div className="text-[11px] font-medium text-slate-500">
                    Engine Oil & Coolant Refilled
                  </div>
                  <div className="font-mono font-bold text-slate-900 mt-1">
                    {servicing300Hr.oilLitersRefilled} Oil · {servicing300Hr.coolantLitersRefilled} Coolant
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* If Form 3 (Breakdown Report) is active, show Breakdown Summary Card right in Step A */}
          {formCategory === 'BREAKDOWN_REPORT' && (
            <div className="bg-red-50/60 border border-red-200 rounded-lg p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <AlertOctagon className="w-4 h-4 text-red-700" />
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                    Emergency Breakdown Incident & Downtime Summary
                  </h4>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('stepBreakdown')}
                  className="text-xs font-semibold text-red-800 underline hover:text-red-950"
                >
                  Open Full Breakdown Root Cause & Rectification Log →
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                <div className="bg-white p-2.5 rounded border border-red-200">
                  <div className="text-[11px] font-medium text-slate-500">Fault System Category</div>
                  <div className="font-bold text-slate-900 mt-1">{breakdownDetails.faultCategory}</div>
                </div>
                <div className="bg-white p-2.5 rounded border border-red-200">
                  <div className="text-[11px] font-medium text-slate-500">Controller Alarm / Trip</div>
                  <div className="font-mono font-semibold text-red-700 mt-1 truncate">
                    {breakdownDetails.alarmCodeOrTrip}
                  </div>
                </div>
                <div className="bg-white p-2.5 rounded border border-red-200">
                  <div className="text-[11px] font-medium text-slate-500">Total Downtime Duration</div>
                  <div className="font-mono text-base font-bold text-red-700 mt-0.5 tabular-nums">
                    {breakdownDetails.totalDowntimeHours} hrs
                  </div>
                </div>
                <div className="bg-white p-2.5 rounded border border-red-200">
                  <div className="text-[11px] font-medium text-slate-500">Post-Repair Status</div>
                  <div className="font-bold text-emerald-700 mt-1">
                    {breakdownDetails.postRepairStatus}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={() =>
                setActiveTab(
                  formCategory === 'REGULAR_SERVICING_300HR'
                    ? 'step300Hr'
                    : formCategory === 'BREAKDOWN_REPORT'
                    ? 'stepBreakdown'
                    : 'stepB'
                )
              }
              className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors"
            >
              {formCategory === 'REGULAR_SERVICING_300HR'
                ? 'Continue to 300-Hr Servicing & Oil/Filter Log →'
                : formCategory === 'BREAKDOWN_REPORT'
                ? 'Continue to Breakdown Root Cause & Downtime Log →'
                : 'Continue to Step B: Operating Parameters →'}
            </button>
          </div>
        </div>
      )}

      {/* =====================================================================
          STEP 300-HR: 300-HOUR GENERATOR RUNNING HOUR SERVICING & OVERHAUL LOG
         ===================================================================== */}
      {activeTab === 'step300Hr' && (
        <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-200">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                300-Hour Generator Running Hour Servicing & Overhaul Log
              </h3>
              <p className="text-xs text-slate-500 font-myanmar">
                မီးစက် မောင်းနှင်ချိန် နာရီ (300 Hours) ပြည့်တိုင်း ဆောင်ရွက်ရမည့် Engine Oil, Oil Filter, Fuel Filter, Water Separator နှင့် Air Filter လဲလှယ်ခြင်း မှတ်တမ်း
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleLoad300HrPartsKit}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-900 bg-amber-100 hover:bg-amber-200 border border-amber-300 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                <Wrench className="w-3.5 h-3.5" />
                Load 300-Hr Filter & Oil Kit to Parts Table
              </button>
            </div>
          </div>

          {/* 300-Hour Running Hour Interval Parameters Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-lg border border-slate-200">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Last 300-Hr Servicing Running Hours
              </label>
              <input
                type="text"
                value={servicing300Hr.lastServiceRunningHours}
                onChange={(e) =>
                  updateRunningHoursAndInterval(parameters.runningHours, e.target.value)
                }
                placeholder="e.g., 8812:00"
                className="w-full px-3 py-2 text-sm font-mono font-bold border border-slate-300 rounded-lg bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Last 300-Hr Servicing Date
              </label>
              <input
                type="date"
                value={servicing300Hr.lastServiceDate}
                onChange={(e) =>
                  setServicing300Hr({ ...servicing300Hr, lastServiceDate: e.target.value })
                }
                className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Current Generator Running Hours
              </label>
              <input
                type="text"
                value={parameters.runningHours}
                onChange={(e) =>
                  updateRunningHoursAndInterval(
                    e.target.value,
                    servicing300Hr.lastServiceRunningHours
                  )
                }
                placeholder="e.g., 9115:29"
                className="w-full px-3 py-2 text-sm font-mono font-bold border border-slate-300 rounded-lg bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Next Scheduled 300-Hr Service Due (Run Hrs)
              </label>
              <input
                type="text"
                value={servicing300Hr.nextServiceDueHours}
                onChange={(e) =>
                  setServicing300Hr({ ...servicing300Hr, nextServiceDueHours: e.target.value })
                }
                className="w-full px-3 py-2 text-sm font-mono font-bold border border-slate-300 rounded-lg bg-white text-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Engine Lube Oil Grade Specification
              </label>
              <input
                type="text"
                value={servicing300Hr.oilGradeUsed}
                onChange={(e) =>
                  setServicing300Hr({ ...servicing300Hr, oilGradeUsed: e.target.value })
                }
                placeholder="15W-40 CI-4 Heavy Duty Diesel Oil"
                className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Engine Oil Refilled Quantity (Ltr)
              </label>
              <input
                type="text"
                value={servicing300Hr.oilLitersRefilled}
                onChange={(e) =>
                  setServicing300Hr({ ...servicing300Hr, oilLitersRefilled: e.target.value })
                }
                placeholder="e.g., 50 Ltr"
                className="w-full px-3 py-2 text-xs font-mono font-semibold border border-slate-300 rounded-lg bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Radiator Coolant Refilled / Flushed (Ltr)
              </label>
              <input
                type="text"
                value={servicing300Hr.coolantLitersRefilled}
                onChange={(e) =>
                  setServicing300Hr({
                    ...servicing300Hr,
                    coolantLitersRefilled: e.target.value,
                  })
                }
                placeholder="e.g., 5 Ltr"
                className="w-full px-3 py-2 text-xs font-mono font-semibold border border-slate-300 rounded-lg bg-white"
              />
            </div>

            <div className="flex flex-col justify-center bg-white p-3 rounded-lg border border-slate-200">
              <div className="text-[11px] font-semibold text-slate-500">
                Running Hour Interval Status
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className="font-mono text-base font-bold text-slate-900 tabular-nums">
                  {servicing300Hr.hoursSinceLastService} / 300 hrs
                </span>
                {servicing300Hr.hoursSinceLastService >= 300 ? (
                  <span className="px-2 py-0.5 text-[11px] font-bold bg-red-100 text-red-800 rounded">
                    300-Hr Service Due
                  </span>
                ) : servicing300Hr.hoursSinceLastService >= 270 ? (
                  <span className="px-2 py-0.5 text-[11px] font-bold bg-amber-100 text-amber-800 rounded">
                    Near 300-Hr Limit
                  </span>
                ) : (
                  <span className="px-2 py-0.5 text-[11px] font-bold bg-emerald-100 text-emerald-800 rounded">
                    Within 300-Hr Cycle
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* 300-Hour Servicing Overhaul Tasks Table (Admin Editable & Extensible) */}
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <div className="bg-slate-900 text-white px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs font-semibold">
              <span>
                {servicing300Hr.servicingTasks.length}-Point 300-Hour Preventive Maintenance & Overhaul Tasks
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-slate-300">Interval: Every 300 Running Hours</span>
                {isAdmin && (
                  <>
                    <button
                      type="button"
                      onClick={() => setIsAdminFormEditMode((prev) => !prev)}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-semibold transition-colors ${
                        isAdminFormEditMode
                          ? 'bg-amber-400 text-slate-950'
                          : 'bg-slate-800 text-slate-200 hover:bg-slate-700 border border-slate-700'
                      }`}
                    >
                      <Edit3 className="w-3 h-3" />
                      {isAdminFormEditMode ? 'Done Editing Tasks' : 'Edit Tasks (ပြင်ရန်)'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowAdd300HrTaskRow((prev) => !prev)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-semibold bg-emerald-600 text-white hover:bg-emerald-500"
                    >
                      <Plus className="w-3 h-3" />
                      Add Servicing Task (+ အသစ်ထပ်တိုးရန်)
                    </button>
                    <button
                      type="button"
                      onClick={handleAdminResetServicingTasks}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium bg-slate-800 text-slate-300 hover:text-white border border-slate-700"
                      title="Restore original 10 tasks"
                    >
                      <RotateCcw className="w-3 h-3" />
                      Reset
                    </button>
                  </>
                )}
              </div>
            </div>

            {isAdmin && showAdd300HrTaskRow && (
              <div className="bg-emerald-50/80 border-b border-emerald-200 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900">
                    Admin: Add New 300-Hr Servicing Task (#{servicing300Hr.servicingTasks.length + 1})
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowAdd300HrTaskRow(false)}
                    className="text-xs text-slate-500 hover:text-slate-900"
                  >
                    Cancel
                  </button>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-2 items-end">
                  <div className="lg:col-span-5">
                    <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">
                      Servicing Task Description (English / Burmese)
                    </label>
                    <input
                      type="text"
                      value={new300HrTaskDraft.description}
                      onChange={(e) =>
                        setNew300HrTaskDraft({ ...new300HrTaskDraft, description: e.target.value })
                      }
                      placeholder="e.g., Inspect Turbocharger Boost Pipe & Clamp Torque တာဘိုပိုက်စစ်ဆေးခြင်း"
                      className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded bg-white font-myanmar"
                    />
                  </div>
                  <div className="lg:col-span-2">
                    <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">
                      Default Qty / Value
                    </label>
                    <input
                      type="text"
                      value={new300HrTaskDraft.quantityOrValue}
                      onChange={(e) =>
                        setNew300HrTaskDraft({
                          ...new300HrTaskDraft,
                          quantityOrValue: e.target.value,
                        })
                      }
                      placeholder="1 Lot"
                      className="w-full px-2.5 py-1.5 text-xs font-mono border border-slate-300 rounded bg-white"
                    />
                  </div>
                  <div className="lg:col-span-2">
                    <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">
                      Part No.
                    </label>
                    <input
                      type="text"
                      value={new300HrTaskDraft.partNumberUsed}
                      onChange={(e) =>
                        setNew300HrTaskDraft({
                          ...new300HrTaskDraft,
                          partNumberUsed: e.target.value,
                        })
                      }
                      placeholder="-"
                      className="w-full px-2.5 py-1.5 text-xs font-mono border border-slate-300 rounded bg-white"
                    />
                  </div>
                  <div className="lg:col-span-3 flex gap-1.5">
                    <input
                      type="text"
                      value={new300HrTaskDraft.remark}
                      onChange={(e) =>
                        setNew300HrTaskDraft({ ...new300HrTaskDraft, remark: e.target.value })
                      }
                      placeholder="Remark"
                      className="flex-1 px-2.5 py-1.5 text-xs border border-slate-300 rounded bg-white font-myanmar"
                    />
                    <button
                      type="button"
                      onClick={handleAdminAddServicingTask}
                      className="px-3 py-1.5 text-xs font-semibold bg-slate-900 text-white rounded hover:bg-slate-800 shrink-0"
                    >
                      Save Task
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="divide-y divide-slate-200">
              {servicing300Hr.servicingTasks.map((task) => {
                const statusOptions: ServicingTaskStatus[] = [
                  'Completed / Replaced',
                  'Cleaned / Adjusted',
                  'Checked Good',
                  'Action Required',
                ];

                return (
                  <div
                    key={task.taskNo}
                    className="p-4 hover:bg-slate-50/70 transition-colors grid grid-cols-1 lg:grid-cols-12 gap-3 items-start"
                  >
                    <div className="lg:col-span-4 flex items-start gap-2.5">
                      <span className="w-6 h-6 rounded bg-slate-100 text-slate-800 font-mono text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                        {task.taskNo}
                      </span>
                      {isAdmin && isAdminFormEditMode ? (
                        <div className="flex-1 flex items-start gap-1.5">
                          <input
                            type="text"
                            value={task.description}
                            onChange={(e) =>
                              handleUpdateServicingTask(
                                task.taskNo,
                                'description',
                                e.target.value
                              )
                            }
                            className="w-full px-2.5 py-1 text-xs font-medium border border-amber-400 rounded bg-amber-50/40 text-slate-900 font-myanmar"
                          />
                          {servicing300Hr.servicingTasks.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleAdminDeleteServicingTask(task.taskNo)}
                              className="p-1 text-red-600 hover:bg-red-50 rounded shrink-0"
                              title="Delete servicing task"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      ) : (
                        <div className="text-xs font-medium text-slate-900 font-myanmar">
                          {task.description}
                        </div>
                      )}
                    </div>

                    <div className="lg:col-span-4">
                      <div className="inline-flex flex-wrap gap-1 p-1 bg-slate-100 rounded-lg">
                        {statusOptions.map((st) => {
                          const isSelected = task.status === st;
                          let activeStyle = 'bg-slate-900 text-white';
                          if (isSelected && st === 'Completed / Replaced') {
                            activeStyle = 'bg-emerald-700 text-white';
                          } else if (isSelected && st === 'Cleaned / Adjusted') {
                            activeStyle = 'bg-slate-800 text-white';
                          } else if (isSelected && st === 'Checked Good') {
                            activeStyle = 'bg-emerald-600 text-white';
                          } else if (isSelected && st === 'Action Required') {
                            activeStyle = 'bg-red-600 text-white';
                          }

                          return (
                            <button
                              key={st}
                              type="button"
                              onClick={() =>
                                handleUpdateServicingTask(task.taskNo, 'status', st)
                              }
                              className={`px-2.5 py-1 text-[11px] font-semibold rounded transition-colors whitespace-nowrap shrink-0 ${
                                isSelected
                                  ? activeStyle
                                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                              }`}
                            >
                              {st}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="lg:col-span-4 grid grid-cols-3 gap-2">
                      <div>
                        <input
                          type="text"
                          value={task.quantityOrValue}
                          onChange={(e) =>
                            handleUpdateServicingTask(
                              task.taskNo,
                              'quantityOrValue',
                              e.target.value
                            )
                          }
                          placeholder="Qty / Value"
                          className="w-full px-2 py-1.5 text-xs font-mono border border-slate-300 rounded bg-white"
                        />
                      </div>
                      <div>
                        <input
                          type="text"
                          value={task.partNumberUsed}
                          onChange={(e) =>
                            handleUpdateServicingTask(
                              task.taskNo,
                              'partNumberUsed',
                              e.target.value
                            )
                          }
                          placeholder="Part No."
                          className="w-full px-2 py-1.5 text-xs font-mono border border-slate-300 rounded bg-white"
                        />
                      </div>
                      <div>
                        <input
                          type="text"
                          value={task.remark}
                          onChange={(e) =>
                            handleUpdateServicingTask(task.taskNo, 'remark', e.target.value)
                          }
                          placeholder="Remark"
                          className="w-full px-2 py-1.5 text-xs border border-slate-300 rounded bg-white font-myanmar"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={() => setActiveTab('stepA')}
              className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
            >
              ← Back to Step A: Header
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('stepB')}
              className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors"
            >
              Continue to Step B: Operating Parameters →
            </button>
          </div>
        </div>
      )}

      {/* =====================================================================
          STEP BREAKDOWN: EMERGENCY BREAKDOWN ROOT CAUSE & DOWNTIME LOG
         ===================================================================== */}
      {activeTab === 'stepBreakdown' && (
        <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-200">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <AlertOctagon className="w-5 h-5 text-red-600" />
                Breakdown & Emergency Repair Log (Root Cause Analysis & Downtime)
              </h3>
              <p className="text-xs text-slate-500 font-myanmar mt-0.5">
                မီးစက် အရေးပေါ်ချို့ယွင်းမှု ဖြစ်ပွားချိန်၊ ပြင်ဆင်ပြီးစီးချိန်၊ ချို့ယွင်းရသည့် အကြောင်းရင်း (Root Cause) နှင့် အရေးပေါ်ပြုပြင်ဆောင်ရွက်ချက် မှတ်တမ်း
              </p>
            </div>
            <button
              type="button"
              onClick={handleLoadBreakdownPartsKit}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-900 bg-red-100 hover:bg-red-200 border border-red-300 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <Wrench className="w-3.5 h-3.5" />
              Load Emergency Repair Parts Kit
            </button>
          </div>

          {/* Incident Timestamps & Downtime Calculator */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 bg-red-50/40 p-4 rounded-lg border border-red-200">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 font-myanmar">
                Breakdown Occurred At (စက်ချို့ယွင်းချိန်)
              </label>
              <input
                type="datetime-local"
                value={breakdownDetails.breakdownDateTime}
                onChange={(e) => handleBreakdownTimeChange('breakdownDateTime', e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 font-myanmar">
                Engineer Arrival At (အင်ဂျင်နီယာ ရောက်ရှိချိန်)
              </label>
              <input
                type="datetime-local"
                value={breakdownDetails.arrivalDateTime}
                onChange={(e) => handleBreakdownTimeChange('arrivalDateTime', e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 font-myanmar">
                Rectified & Restored At (ပြင်ဆင်ပြီးစီးချိန်)
              </label>
              <input
                type="datetime-local"
                value={breakdownDetails.rectifiedDateTime}
                onChange={(e) => handleBreakdownTimeChange('rectifiedDateTime', e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 font-myanmar">
                Total Downtime Hours (စက်ရပ်တန့်ချိန် စုစုပေါင်း)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step="0.25"
                  value={breakdownDetails.totalDowntimeHours}
                  onChange={(e) =>
                    setBreakdownDetails({
                      ...breakdownDetails,
                      totalDowntimeHours: parseFloat(e.target.value) || 0,
                    })
                  }
                  className="w-full px-3 py-2 text-sm font-mono font-bold text-red-700 border border-slate-300 rounded-lg bg-white tabular-nums"
                />
                <span className="text-xs font-mono font-semibold text-slate-600 shrink-0">Hrs</span>
              </div>
            </div>
          </div>

          {/* Fault Category, Alarm Code & Post-Repair Status */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 font-myanmar">
                Fault System Category (ချို့ယွင်းသည့် အပိုင်း)
              </label>
              <select
                value={breakdownDetails.faultCategory}
                onChange={(e) =>
                  setBreakdownDetails({
                    ...breakdownDetails,
                    faultCategory: e.target.value as BreakdownFaultCategory,
                  })
                }
                className="w-full px-3 py-2 text-xs font-semibold border border-slate-300 rounded-lg bg-white"
              >
                <option value="Cooling / Overheat">Cooling / Overheat (ရေတိုင်ကီနှင့် အပူချိန်လွန်ကဲမှု)</option>
                <option value="Fuel System">Fuel System (ဒီဇယ်ပို့စနစ်နှင့် ဖစ်တာ)</option>
                <option value="Lubrication / Low Oil Pressure">Lubrication / Low Oil Pressure (အင်ဂျင်ဝိုင်ဖိအားကျဆင်းမှု)</option>
                <option value="Starting / Battery / Charger">Starting / Battery / Charger (ဘက်ထရီနှင့် စတาร์ทစနစ်)</option>
                <option value="Controller / AMF / ATS">Controller / AMF / ATS (ကွန်ထရိုလာနှင့် ATS စနစ်)</option>
                <option value="Alternator / AVR / Breaker">Alternator / AVR / Breaker (မိန်းဒိုင်နမို၊ AVR နှင့် ဘရိတ်ကာ)</option>
                <option value="Mechanical / Belt / Hose Leak">Mechanical / Belt / Hose Leak (ပန်ကာကြိုးနှင့် ပိုက်ယိုစိမ့်မှု)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Controller Alarm / Shutdown Trip Code
              </label>
              <input
                type="text"
                value={breakdownDetails.alarmCodeOrTrip}
                onChange={(e) =>
                  setBreakdownDetails({
                    ...breakdownDetails,
                    alarmCodeOrTrip: e.target.value,
                  })
                }
                placeholder="e.g., DSE 7320 High Water Temp Shutdown"
                className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 font-myanmar">
                Post-Repair Generator Status (ပြုပြင်ပြီးနောက် အခြေအနေ)
              </label>
              <select
                value={breakdownDetails.postRepairStatus}
                onChange={(e) =>
                  setBreakdownDetails({
                    ...breakdownDetails,
                    postRepairStatus: e.target.value as BreakdownPostRepairStatus,
                  })
                }
                className="w-full px-3 py-2 text-xs font-semibold border border-slate-300 rounded-lg bg-white"
              >
                <option value="Restored to Auto Standby">Restored to Auto Standby (ပုံမှန် အသင့်အနေအထား ပြန်လည်ရောက်ရှိ)</option>
                <option value="Temporary Running (Follow-up Parts Needed)">Temporary Running — Follow-up Parts Needed (ယာယီမောင်းနှင်နိုင် / အပိုပစ္စည်းထပ်လဲရန်လို)</option>
                <option value="Out of Service / Awaiting Major Overhaul">Out of Service — Awaiting Major Overhaul (အကြီးစားပြင်ဆင်ရန် စက်ရပ်ထား)</option>
              </select>
            </div>
          </div>

          {/* Detailed Bilingual Breakdown Narratives */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 font-myanmar">
                1. Failure Symptoms Reported (ဖြစ်ပေါ်သည့် ချို့ယွင်းမှု လက္ခဏာများ)
              </label>
              <textarea
                rows={3}
                value={breakdownDetails.symptomsReported}
                onChange={(e) =>
                  setBreakdownDetails({
                    ...breakdownDetails,
                    symptomsReported: e.target.value,
                  })
                }
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg font-myanmar"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 font-myanmar">
                2. Root Cause Analysis (ချို့ယွင်းရသည့် အဓိကအကြောင်းရင်း စစ်ဆေးတွေ့ရှိချက်)
              </label>
              <textarea
                rows={3}
                value={breakdownDetails.rootCauseAnalysis}
                onChange={(e) =>
                  setBreakdownDetails({
                    ...breakdownDetails,
                    rootCauseAnalysis: e.target.value,
                  })
                }
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg font-myanmar"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 font-myanmar">
                3. Immediate Rectification & Repair Action (အရေးပေါ် ပြုပြင်ဆောင်ရွက်ချက်)
              </label>
              <textarea
                rows={3}
                value={breakdownDetails.immediateRectification}
                onChange={(e) => {
                  setBreakdownDetails({
                    ...breakdownDetails,
                    immediateRectification: e.target.value,
                  });
                  setCorrectedActions(e.target.value);
                }}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg font-myanmar"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 font-myanmar">
                4. Preventive Recommendation (နောက်နောင် ထပ်မံမဖြစ်ပွားစေရန် အကြံပြုချက်)
              </label>
              <textarea
                rows={3}
                value={breakdownDetails.preventiveRecommendation}
                onChange={(e) =>
                  setBreakdownDetails({
                    ...breakdownDetails,
                    preventiveRecommendation: e.target.value,
                  })
                }
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg font-myanmar"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={() => setActiveTab('stepA')}
              className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
            >
              ← Back to Step A: Header
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('stepB')}
              className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors"
            >
              Continue to Step B: Post-Repair Test Run Parameters →
            </button>
          </div>
        </div>
      )}

      {/* =====================================================================
          STEP B: OPERATING PARAMETERS LOG (TEST RUN RECORD)
         ===================================================================== */}
      {activeTab === 'stepB' && (
        <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-4 border-b border-slate-200">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                02. Operating Parameters Log (Test Run Record)
              </h3>
              <p className="text-xs text-slate-500">
                Real-time threshold validation: Oil Pressure &ge; 3.5 Bar · Voltage 380V–415V · Frequency 49–51 Hz
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Column 1: Engine & Battery */}
            <div className="space-y-4 bg-slate-50/70 p-4 rounded-lg border border-slate-200">
              <h4 className="text-xs font-bold text-slate-800 border-b border-slate-200 pb-2">
                Engine Mechanical & DC System
              </h4>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Running Hours (e.g., 9115:29)
                </label>
                <input
                  type="text"
                  value={parameters.runningHours}
                  onChange={(e) =>
                    updateRunningHoursAndInterval(
                      e.target.value,
                      servicing300Hr.lastServiceRunningHours
                    )
                  }
                  className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Engine Speed (RPM)
                </label>
                <input
                  type="number"
                  value={parameters.engineSpeedRpm}
                  onChange={(e) =>
                    setParameters({
                      ...parameters,
                      engineSpeedRpm: parseFloat(e.target.value) || 0,
                    })
                  }
                  className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg bg-white"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-slate-700">
                    Engine Oil Pressure (Bar)
                  </label>
                  <span className="text-[11px] font-mono text-slate-500">Min: 3.5 Bar</span>
                </div>
                <input
                  type="number"
                  step="0.01"
                  value={parameters.engineOilPressureBar}
                  onChange={(e) =>
                    setParameters({
                      ...parameters,
                      engineOilPressureBar: parseFloat(e.target.value) || 0,
                    })
                  }
                  className={`w-full px-3 py-2 text-sm font-mono border rounded-lg ${
                    isOilPressureLow
                      ? 'border-red-600 bg-red-50 text-red-900 font-bold'
                      : 'border-slate-300 bg-white'
                  }`}
                />
                {isOilPressureLow && (
                  <p className="text-xs font-semibold text-red-600 mt-1 flex items-center gap-1">
                    <AlertOctagon className="w-3.5 h-3.5" /> Low Oil Pressure Alert (&lt; 3.5 Bar)
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Engine Oil Temp (°C)
                </label>
                <input
                  type="number"
                  value={parameters.engineOilTempC}
                  onChange={(e) =>
                    setParameters({
                      ...parameters,
                      engineOilTempC: parseFloat(e.target.value) || 0,
                    })
                  }
                  className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Battery Capacity
                </label>
                <input
                  type="text"
                  value={parameters.batteryCapacity}
                  onChange={(e) =>
                    setParameters({ ...parameters, batteryCapacity: e.target.value })
                  }
                  className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg bg-white"
                />
              </div>
            </div>

            {/* Column 2: AC Voltage & Frequency */}
            <div className="space-y-4 bg-slate-50/70 p-4 rounded-lg border border-slate-200">
              <h4 className="text-xs font-bold text-slate-800 border-b border-slate-200 pb-2">
                Alternator Voltage & Frequency
              </h4>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-slate-700">Frequency (Hz)</label>
                  <span className="text-[11px] font-mono text-slate-500">49–51 Hz</span>
                </div>
                <input
                  type="number"
                  step="0.1"
                  value={parameters.frequencyHz}
                  onChange={(e) =>
                    setParameters({
                      ...parameters,
                      frequencyHz: parseFloat(e.target.value) || 0,
                    })
                  }
                  className={`w-full px-3 py-2 text-sm font-mono border rounded-lg ${
                    isFreqOut
                      ? 'border-red-600 bg-red-50 text-red-900 font-bold'
                      : 'border-slate-300 bg-white'
                  }`}
                />
                {isFreqOut && (
                  <p className="text-xs font-semibold text-red-600 mt-1">
                    Frequency outside 49–51 Hz nominal band
                  </p>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-slate-700">
                    Generator Voltage L1-L2 (V)
                  </label>
                  <span className="text-[11px] font-mono text-slate-500">380–415V</span>
                </div>
                <input
                  type="number"
                  value={parameters.voltageL1L2}
                  onChange={(e) =>
                    setParameters({
                      ...parameters,
                      voltageL1L2: parseFloat(e.target.value) || 0,
                    })
                  }
                  className={`w-full px-3 py-2 text-sm font-mono border rounded-lg ${
                    isV12Out
                      ? 'border-red-600 bg-red-50 text-red-900 font-bold'
                      : 'border-slate-300 bg-white'
                  }`}
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-slate-700">
                    Generator Voltage L1-L3 (V)
                  </label>
                  <span className="text-[11px] font-mono text-slate-500">380–415V</span>
                </div>
                <input
                  type="number"
                  value={parameters.voltageL1L3}
                  onChange={(e) =>
                    setParameters({
                      ...parameters,
                      voltageL1L3: parseFloat(e.target.value) || 0,
                    })
                  }
                  className={`w-full px-3 py-2 text-sm font-mono border rounded-lg ${
                    isV13Out
                      ? 'border-red-600 bg-red-50 text-red-900 font-bold'
                      : 'border-slate-300 bg-white'
                  }`}
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-slate-700">
                    Generator Voltage L2-L3 (V)
                  </label>
                  <span className="text-[11px] font-mono text-slate-500">380–415V</span>
                </div>
                <input
                  type="number"
                  value={parameters.voltageL2L3}
                  onChange={(e) =>
                    setParameters({
                      ...parameters,
                      voltageL2L3: parseFloat(e.target.value) || 0,
                    })
                  }
                  className={`w-full px-3 py-2 text-sm font-mono border rounded-lg ${
                    isV23Out
                      ? 'border-red-600 bg-red-50 text-red-900 font-bold'
                      : 'border-slate-300 bg-white'
                  }`}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Charging Voltage (V)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={parameters.chargingVoltageV}
                  onChange={(e) =>
                    setParameters({
                      ...parameters,
                      chargingVoltageV: parseFloat(e.target.value) || 0,
                    })
                  }
                  className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg bg-white"
                />
              </div>
            </div>

            {/* Column 3: Load Current & Power */}
            <div className="space-y-4 bg-slate-50/70 p-4 rounded-lg border border-slate-200">
              <h4 className="text-xs font-bold text-slate-800 border-b border-slate-200 pb-2">
                Load Current & Power Output (Optional on Free Load)
              </h4>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Load Current L1 (A)
                </label>
                <input
                  type="text"
                  placeholder="Leave blank if No-Load test"
                  value={parameters.currentL1A}
                  onChange={(e) => setParameters({ ...parameters, currentL1A: e.target.value })}
                  className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Load Current L2 (A)
                </label>
                <input
                  type="text"
                  placeholder="Leave blank if No-Load test"
                  value={parameters.currentL2A}
                  onChange={(e) => setParameters({ ...parameters, currentL2A: e.target.value })}
                  className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Load Current L3 (A)
                </label>
                <input
                  type="text"
                  placeholder="Leave blank if No-Load test"
                  value={parameters.currentL3A}
                  onChange={(e) => setParameters({ ...parameters, currentL3A: e.target.value })}
                  className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Active Power (KW)
                </label>
                <input
                  type="text"
                  placeholder="e.g., 0 or 240 KW"
                  value={parameters.activePowerKw}
                  onChange={(e) =>
                    setParameters({ ...parameters, activePowerKw: e.target.value })
                  }
                  className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Apparent Power (KVA)
                </label>
                <input
                  type="text"
                  placeholder="e.g., 0 or 300 KVA"
                  value={parameters.apparentPowerKva}
                  onChange={(e) =>
                    setParameters({ ...parameters, apparentPowerKva: e.target.value })
                  }
                  className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg bg-white"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={() => setActiveTab('stepA')}
              className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
            >
              ← Back to Step A
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('stepC')}
              className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors"
            >
              Continue to Step C: 25-Point Checklist →
            </button>
          </div>
        </div>
      )}

      {/* =====================================================================
          STEP C: 25-POINT + CUSTOM GENERATOR SERVICE / INSPECTION CHECKLIST
         ===================================================================== */}
      {activeTab === 'stepC' && (
        <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-200">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                03. {checklistStatusCounts.total}-Point Generator Service / Inspection Checklist (Gen SOP-002)
              </h3>
              <p className="text-xs text-slate-500 font-myanmar">
                Bilingual Burmese + English inspection items with Ready, Action Required & Critical scroll filter.
                {isAdmin && ' (Admin Right ဖြင့် အချက်အလက်များ ပြင်ဆင်/ထပ်တိုးနိုင်သည်)'}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg overflow-x-auto max-w-full">
                {(
                  [
                    { id: 'ALL', label: `All (${checklistStatusCounts.total})` },
                    { id: 'Ready', label: `Ready (${checklistStatusCounts.readyCount})` },
                    {
                      id: 'Action Required',
                      label: `Action Required (${checklistStatusCounts.actionCount})`,
                    },
                    {
                      id: 'Critical',
                      label: `Critical (${checklistStatusCounts.criticalCount})`,
                    },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setChecklistScrollFilter(tab.id)}
                    className={`px-2.5 py-1 text-xs font-semibold rounded transition-colors whitespace-nowrap shrink-0 ${
                      checklistScrollFilter === tab.id
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {isAdmin && (
                <>
                  <button
                    type="button"
                    onClick={() => setShowAddChecklistModal((prev) => !prev)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    + Add Form Item (အသစ်ထပ်တိုးရန်)
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsAdminFormEditMode((prev) => !prev)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors whitespace-nowrap shrink-0 ${
                      isAdminFormEditMode
                        ? 'bg-amber-400 text-slate-950 border-amber-400'
                        : 'bg-white text-slate-800 border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    {isAdminFormEditMode ? 'Done Editing Form' : 'Edit Form Items (ဖောင်ပြင်ရန်)'}
                  </button>
                  <button
                    type="button"
                    onClick={handleAdminResetChecklistDefs}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0"
                    title="Reset Checklist Template to Default 25 Points"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Reset Template
                  </button>
                </>
              )}

              <button
                type="button"
                onClick={handleResetAllGood}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Mark All Nominal / Good
              </button>
            </div>
          </div>

          {/* Admin Add New Checklist Item Card */}
          {isAdmin && showAddChecklistModal && (
            <div className="bg-slate-50 border-2 border-slate-900 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Admin Right · Add New Checklist Item to Form (ဖောင်ထဲသို့ စစ်ဆေးရန်အချက်အသစ် ထပ်တိုးခြင်း)
                  </h4>
                  <p className="text-[11px] text-slate-600 font-myanmar">
                    ထပ်တိုးလိုက်သော အချက်အသစ်သည် ဖောင်၏ Step C နှင့် Official PDF Report တို့တွင် အလိုအလျောက် သိမ်းဆည်းပါဝင်သွားပါမည်။
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddChecklistModal(false)}
                  className="p-1 text-slate-500 hover:text-slate-900"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                <div className="md:col-span-5">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Checklist Item Description (Burmese / English)
                  </label>
                  <input
                    type="text"
                    value={newChecklistItemDraft.description}
                    onChange={(e) =>
                      setNewChecklistItemDraft({
                        ...newChecklistItemDraft,
                        description: e.target.value,
                      })
                    }
                    placeholder="e.g., ATS Panel Auto/Manual Changeover & Timer စစ်ဆေးခြင်း"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white font-myanmar"
                  />
                </div>

                <div className="md:col-span-3">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Action Options Type
                  </label>
                  <select
                    value={newChecklistItemDraft.optionsPreset}
                    onChange={(e) =>
                      setNewChecklistItemDraft({
                        ...newChecklistItemDraft,
                        optionsPreset: e.target.value as
                          | 'GOOD_BAD'
                          | 'GREEN_AMBER_RED'
                          | 'READY_ACTION_CRITICAL'
                          | 'CUSTOM',
                      })
                    }
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white font-medium"
                  >
                    <option value="GOOD_BAD">Good / Bad</option>
                    <option value="READY_ACTION_CRITICAL">
                      Checked Good / Action Required / Critical
                    </option>
                    <option value="GREEN_AMBER_RED">Green / Amber / Red</option>
                    <option value="CUSTOM">Custom Options (Comma-separated)</option>
                  </select>
                </div>

                {newChecklistItemDraft.optionsPreset === 'CUSTOM' ? (
                  <div className="md:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Custom Options (CSV)
                    </label>
                    <input
                      type="text"
                      value={newChecklistItemDraft.customOptionsCsv}
                      onChange={(e) =>
                        setNewChecklistItemDraft({
                          ...newChecklistItemDraft,
                          customOptionsCsv: e.target.value,
                        })
                      }
                      placeholder="Normal, Adjust, Replace"
                      className="w-full px-2.5 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                    />
                  </div>
                ) : (
                  <div className="md:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Remark Placeholder
                    </label>
                    <input
                      type="text"
                      value={newChecklistItemDraft.remarkHint}
                      onChange={(e) =>
                        setNewChecklistItemDraft({
                          ...newChecklistItemDraft,
                          remarkHint: e.target.value,
                        })
                      }
                      placeholder="မှတ်ချက်ရေးရန်"
                      className="w-full px-2.5 py-2 text-xs border border-slate-300 rounded-lg bg-white font-myanmar"
                    />
                  </div>
                )}

                <div className="md:col-span-2">
                  <button
                    type="button"
                    onClick={handleAdminAddChecklistItem}
                    className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold bg-emerald-700 text-white rounded-lg hover:bg-emerald-800"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add to Form
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="divide-y divide-slate-200 border border-slate-200 rounded-lg overflow-hidden max-h-[680px] overflow-y-auto">
            {checklistDefsState
              .filter((def) => {
                if (def.itemNo === 26) return false;
                if (checklistScrollFilter === 'ALL') return true;
                const sel = checklist[def.itemNo]?.selectedOption || '';
                const isCrit = def.criticalOptions?.includes(sel);
                const isWarn = def.warningOptions?.includes(sel);
                if (checklistScrollFilter === 'Critical') return Boolean(isCrit);
                if (checklistScrollFilter === 'Action Required') return Boolean(isWarn);
                return !isCrit && !isWarn;
              })
              .map((def) => {
                const item = checklist[def.itemNo];
                const selected = item?.selectedOption || '';
                const remark = item?.remark || '';
                const isEditingItem = isAdmin && editingChecklistItemNo === def.itemNo;

                return (
                  <div
                    key={def.itemNo}
                    className="p-4 hover:bg-slate-50/70 transition-colors grid grid-cols-1 lg:grid-cols-12 gap-4 items-start"
                  >
                    {/* Item Number & Bilingual Description (With Admin Inline Edit) */}
                    <div className="lg:col-span-5 flex items-start gap-3">
                      <span className="w-7 h-7 rounded bg-slate-100 text-slate-800 font-mono text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                        {def.itemNo}
                      </span>
                      {isEditingItem ? (
                        <div className="flex-1 space-y-2 bg-amber-50/60 border border-amber-300 rounded-lg p-2.5">
                          <div>
                            <label className="block text-[10px] font-bold text-slate-700 mb-0.5">
                              Edit Item #{def.itemNo} Description
                            </label>
                            <textarea
                              rows={2}
                              value={editingChecklistDraft.description}
                              onChange={(e) =>
                                setEditingChecklistDraft({
                                  ...editingChecklistDraft,
                                  description: e.target.value,
                                })
                              }
                              className="w-full px-2 py-1 text-xs border border-slate-300 rounded bg-white font-myanmar"
                            />
                          </div>
                          {def.options && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              <div>
                                <label className="block text-[10px] font-bold text-slate-700 mb-0.5">
                                  Options (Comma-separated)
                                </label>
                                <input
                                  type="text"
                                  value={editingChecklistDraft.optionsCsv}
                                  onChange={(e) =>
                                    setEditingChecklistDraft({
                                      ...editingChecklistDraft,
                                      optionsCsv: e.target.value,
                                    })
                                  }
                                  className="w-full px-2 py-1 text-xs font-mono border border-slate-300 rounded bg-white"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] font-bold text-slate-700 mb-0.5">
                                  Remark Hint
                                </label>
                                <input
                                  type="text"
                                  value={editingChecklistDraft.remarkHint}
                                  onChange={(e) =>
                                    setEditingChecklistDraft({
                                      ...editingChecklistDraft,
                                      remarkHint: e.target.value,
                                    })
                                  }
                                  className="w-full px-2 py-1 text-xs border border-slate-300 rounded bg-white font-myanmar"
                                />
                              </div>
                            </div>
                          )}
                          <div className="flex items-center gap-1.5 pt-1">
                            <button
                              type="button"
                              onClick={() => handleSaveEditedChecklistItem(def.itemNo)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold bg-emerald-700 text-white rounded hover:bg-emerald-800"
                            >
                              <Check className="w-3 h-3" />
                              Save Item
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingChecklistItemNo(null)}
                              className="px-2.5 py-1 text-xs font-medium text-slate-600 bg-white border border-slate-300 rounded hover:bg-slate-100"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex-1 flex items-start justify-between gap-2">
                          <div className="text-sm font-medium text-slate-900 font-myanmar whitespace-pre-line">
                            {def.description}
                          </div>
                          {isAdmin && (isAdminFormEditMode || def.itemNo > 26) && (
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => handleStartEditChecklistItem(def)}
                                className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded border border-slate-300"
                                title="Edit Checklist Item"
                              >
                                <Edit3 className="w-3 h-3" />
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => handleAdminDeleteChecklistItem(def.itemNo)}
                                className="p-1 text-red-600 hover:bg-red-50 rounded"
                                title="Delete Checklist Item"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                  {/* Interactive Action Control */}
                  <div className="lg:col-span-4">
                    {(def.type === 'segmented' || def.type === 'segmented_photo_24') &&
                      def.options && (
                        <div className="space-y-2">
                          <div className="inline-flex flex-wrap gap-1.5 p-1 bg-slate-100 rounded-lg">
                            {def.options.map((opt) => {
                              const isSelected = selected === opt;
                              const isGood = def.goodOptions?.includes(opt);
                              const isWarn = def.warningOptions?.includes(opt);
                              const isCrit = def.criticalOptions?.includes(opt);

                              let activeClass = 'bg-slate-900 text-white shadow-xs';
                              if (isSelected && isGood) {
                                activeClass = 'bg-emerald-700 text-white shadow-xs';
                              } else if (isSelected && isWarn) {
                                activeClass = 'bg-amber-600 text-white shadow-xs';
                              } else if (isSelected && isCrit) {
                                activeClass = 'bg-red-600 text-white shadow-xs';
                              }

                              return (
                                <button
                                  key={opt}
                                  type="button"
                                  onClick={() => handleChecklistOptionChange(def.itemNo, opt)}
                                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                                    isSelected
                                      ? activeClass
                                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                                  }`}
                                >
                                  {opt}
                                </button>
                              );
                            })}
                          </div>

                          {/* Item 24 Before / After Photo Upload */}
                          {def.type === 'segmented_photo_24' && (
                            <div className="grid grid-cols-2 gap-2 pt-1">
                              <label className="flex flex-col items-center justify-center p-2 border border-dashed border-slate-300 rounded bg-slate-50 hover:bg-slate-100 cursor-pointer text-center">
                                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-700">
                                  <Camera className="w-3.5 h-3.5" /> Before Photo
                                </span>
                                <input
                                  type="file"
                                  accept="image/*"
                                  onChange={(e) => handlePhotoUpload('insideBodyBeforePhoto', e)}
                                  className="hidden"
                                />
                                {customInputs.insideBodyBeforePhoto && (
                                  <img
                                    src={customInputs.insideBodyBeforePhoto}
                                    alt="Before cleaning"
                                    className="h-12 w-auto object-cover rounded mt-1"
                                  />
                                )}
                              </label>

                              <label className="flex flex-col items-center justify-center p-2 border border-dashed border-slate-300 rounded bg-slate-50 hover:bg-slate-100 cursor-pointer text-center">
                                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-700">
                                  <Camera className="w-3.5 h-3.5" /> After Photo
                                </span>
                                <input
                                  type="file"
                                  accept="image/*"
                                  onChange={(e) => handlePhotoUpload('insideBodyAfterPhoto', e)}
                                  className="hidden"
                                />
                                {customInputs.insideBodyAfterPhoto && (
                                  <img
                                    src={customInputs.insideBodyAfterPhoto}
                                    alt="After cleaning"
                                    className="h-12 w-auto object-cover rounded mt-1"
                                  />
                                )}
                              </label>
                            </div>
                          )}
                        </div>
                      )}

                    {/* Custom Item 9: Battery Purchase Date & Nos */}
                    {def.type === 'custom_9' && (
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                            Date 1
                          </label>
                          <input
                            type="text"
                            value={customInputs.batteryDate1}
                            onChange={(e) =>
                              setCustomInputs({ ...customInputs, batteryDate1: e.target.value })
                            }
                            placeholder="24.4.26"
                            className="w-full px-2 py-1 text-xs font-mono border border-slate-300 rounded"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                            Date 2
                          </label>
                          <input
                            type="text"
                            value={customInputs.batteryDate2}
                            onChange={(e) =>
                              setCustomInputs({ ...customInputs, batteryDate2: e.target.value })
                            }
                            placeholder="24.4.26"
                            className="w-full px-2 py-1 text-xs font-mono border border-slate-300 rounded"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                            Nos
                          </label>
                          <input
                            type="text"
                            value={customInputs.batteryNos}
                            onChange={(e) =>
                              setCustomInputs({ ...customInputs, batteryNos: e.target.value })
                            }
                            placeholder="2"
                            className="w-full px-2 py-1 text-xs font-mono border border-slate-300 rounded"
                          />
                        </div>
                      </div>
                    )}

                    {/* Custom Item 10: Battery Voltage & Ah & CCA */}
                    {def.type === 'custom_10' && (
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                            Volt (V)
                          </label>
                          <input
                            type="text"
                            value={customInputs.batteryVolt}
                            onChange={(e) =>
                              setCustomInputs({ ...customInputs, batteryVolt: e.target.value })
                            }
                            placeholder="12"
                            className="w-full px-2 py-1 text-xs font-mono border border-slate-300 rounded"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                            Capacity (Ah)
                          </label>
                          <input
                            type="text"
                            value={customInputs.batteryAh}
                            onChange={(e) =>
                              setCustomInputs({ ...customInputs, batteryAh: e.target.value })
                            }
                            placeholder="200"
                            className="w-full px-2 py-1 text-xs font-mono border border-slate-300 rounded"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                            Measured CCA
                          </label>
                          <input
                            type="text"
                            value={customInputs.batteryCca}
                            onChange={(e) =>
                              setCustomInputs({ ...customInputs, batteryCca: e.target.value })
                            }
                            placeholder="1156"
                            className="w-full px-2 py-1 text-xs font-mono border border-slate-300 rounded"
                          />
                        </div>
                      </div>
                    )}

                    {/* Custom Item 11: 4 Battery Slots SOC & SOH */}
                    {def.type === 'custom_11' && (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {customInputs.batterySlots.map((slot, sIdx) => (
                          <div
                            key={sIdx}
                            className="bg-slate-50 p-1.5 rounded border border-slate-200 space-y-1"
                          >
                            <div className="text-[10px] font-bold text-slate-600">
                              Batt #{sIdx + 1}
                            </div>
                            <input
                              type="text"
                              placeholder="SOC %"
                              value={slot.soc}
                              onChange={(e) => {
                                const updated = [...customInputs.batterySlots] as ChecklistCustomInputs['batterySlots'];
                                updated[sIdx] = { ...updated[sIdx], soc: e.target.value };
                                setCustomInputs({ ...customInputs, batterySlots: updated });
                              }}
                              className="w-full px-1.5 py-0.5 text-[11px] font-mono border border-slate-300 rounded bg-white"
                            />
                            <input
                              type="text"
                              placeholder="SOH %"
                              value={slot.soh}
                              onChange={(e) => {
                                const updated = [...customInputs.batterySlots] as ChecklistCustomInputs['batterySlots'];
                                updated[sIdx] = { ...updated[sIdx], soh: e.target.value };
                                setCustomInputs({ ...customInputs, batterySlots: updated });
                              }}
                              className="w-full px-1.5 py-0.5 text-[11px] font-mono border border-slate-300 rounded bg-white"
                            />
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Custom Item 19: Post-Run Controller Charge Altr V & Battery V */}
                    {def.type === 'custom_19' && (
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                            Charge Altr V
                          </label>
                          <input
                            type="text"
                            value={customInputs.chargeAltrV}
                            onChange={(e) =>
                              setCustomInputs({ ...customInputs, chargeAltrV: e.target.value })
                            }
                            placeholder="26.5"
                            className="w-full px-2 py-1 text-xs font-mono border border-slate-300 rounded"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                            Battery V
                          </label>
                          <input
                            type="text"
                            value={customInputs.controllerBatteryV}
                            onChange={(e) =>
                              setCustomInputs({
                                ...customInputs,
                                controllerBatteryV: e.target.value,
                              })
                            }
                            placeholder="26V"
                            className="w-full px-2 py-1 text-xs font-mono border border-slate-300 rounded"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Remark Column */}
                  <div className="lg:col-span-3">
                    <input
                      type="text"
                      value={remark}
                      onChange={(e) => handleChecklistRemarkChange(def.itemNo, e.target.value)}
                      placeholder={def.remarkHint || 'Remark (မှတ်ချက်)'}
                      className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900 font-myanmar bg-white"
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* =================================================================
              ITEM 26 AT THE BOTTOM OF STEP C:
              READY / ACTION REQUIRED / CRITICAL HORIZONTAL SCROLL TAB
             ================================================================= */}
          <div className="p-4 sm:p-5 bg-slate-50 border-2 border-slate-900 rounded-lg space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
              {/* Item 26 Number & Bilingual Description */}
              <div className="lg:col-span-5 flex items-start gap-3">
                <span className="w-7 h-7 rounded bg-slate-900 text-white font-mono text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                  26
                </span>
                <div>
                  <div className="text-sm font-bold text-slate-900 font-myanmar">
                    Overall Generator Readiness Status (မီးစက်၏ အသင့်ဖြစ်မှု အခြေအနေ — Ready / Action Required / Critical)
                  </div>
                  <p className="text-xs text-slate-500 font-myanmar mt-0.5">
                    Step C ၏ အမှတ်စဉ် (၂၆) အနေဖြင့် Ready, Action Required သို့မဟုတ် Critical Scroll Tab ကို ရွေးချယ်သတ်မှတ်ပါ။
                  </p>
                </div>
              </div>

              {/* Item 26 Horizontal Scroll Tab Selector: Ready | Action Required | Critical */}
              <div className="lg:col-span-4">
                <div className="flex items-center gap-2 overflow-x-auto pb-1">
                  <button
                    type="button"
                    onClick={() => {
                      setReadinessOverride('Ready');
                      handleChecklistOptionChange(26, 'Ready');
                      setChecklistScrollFilter('ALL');
                    }}
                    className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-lg border transition-all whitespace-nowrap shrink-0 ${
                      effectiveReadinessStatus === 'Ready'
                        ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs'
                        : 'bg-white text-emerald-800 border-emerald-300 hover:bg-emerald-50'
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Ready ({checklistStatusCounts.readyCount}/25)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setReadinessOverride('Action Required');
                      handleChecklistOptionChange(26, 'Action Required');
                      setChecklistScrollFilter('ALL');
                    }}
                    className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-lg border transition-all whitespace-nowrap shrink-0 ${
                      effectiveReadinessStatus === 'Action Required'
                        ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                        : 'bg-white text-amber-900 border-amber-300 hover:bg-amber-50'
                    }`}
                  >
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Action Required ({checklistStatusCounts.actionCount})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setReadinessOverride('Critical');
                      handleChecklistOptionChange(26, 'Critical');
                      setChecklistScrollFilter('ALL');
                    }}
                    className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-lg border transition-all whitespace-nowrap shrink-0 ${
                      effectiveReadinessStatus === 'Critical'
                        ? 'bg-red-600 text-white border-red-600 shadow-xs'
                        : 'bg-white text-red-800 border-red-300 hover:bg-red-50'
                    }`}
                  >
                    <AlertOctagon className="w-3.5 h-3.5" />
                    <span>Critical ({checklistStatusCounts.criticalCount})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setReadinessOverride('AUTO');
                      handleChecklistOptionChange(26, evaluation.readinessStatus);
                      setChecklistScrollFilter('ALL');
                    }}
                    className={`inline-flex items-center gap-1 px-2.5 py-2 text-[11px] font-semibold rounded-lg border transition-colors whitespace-nowrap shrink-0 ${
                      readinessOverride === 'AUTO'
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    Auto ({evaluation.readinessStatus})
                  </button>
                </div>
              </div>

              {/* Item 26 Remark Input */}
              <div className="lg:col-span-3">
                <input
                  type="text"
                  value={checklist[26]?.remark || ''}
                  onChange={(e) => handleChecklistRemarkChange(26, e.target.value)}
                  placeholder="Item 26 Overall Status Remark (မှတ်ချက်)"
                  className="w-full px-2.5 py-2 text-xs border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900 font-myanmar bg-white"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={() => setActiveTab('stepB')}
              className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
            >
              ← Back to Step B
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('stepD')}
              className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors"
            >
              Continue to Step D: Replacement Parts & Sign-Off →
            </button>
          </div>
        </div>
      )}

      {/* =====================================================================
          STEP D: REPLACEMENT PARTS TABLE & DIGITAL SIGN-OFF
         ===================================================================== */}
      {activeTab === 'stepD' && (
        <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-6">
          {/* Dynamic Replacement Parts Table */}
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  04. Replacement Parts & Consumables Log
                </h3>
                <p className="text-xs text-slate-500">
                  Record any filters, belts, hoses, or lubricants replaced during this service.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleLoad300HrPartsKit}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-900 bg-amber-100 hover:bg-amber-200 border border-amber-300 rounded-lg transition-colors whitespace-nowrap shrink-0"
                >
                  <Wrench className="w-3.5 h-3.5" />
                  Load Standard 300-Hr Filter & Oil Kit
                </button>
                <button
                  type="button"
                  onClick={handleAddReplacementPart}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Part Row
                </button>
              </div>
            </div>

            {replacementParts.length === 0 ? (
              <div className="border border-dashed border-slate-300 rounded-lg p-6 text-center bg-slate-50/50">
                <p className="text-xs text-slate-600 mb-2">
                  No replacement parts logged for this inspection (routine check only).
                </p>
                <button
                  type="button"
                  onClick={handleAddReplacementPart}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-800 bg-white border border-slate-300 hover:bg-slate-50 rounded-md transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add First Replacement Part
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                    <tr>
                      <th className="px-3 py-2 text-left w-12">Sr</th>
                      <th className="px-3 py-2 text-left w-44">Parts No:</th>
                      <th className="px-3 py-2 text-left">Parts Descriptions</th>
                      <th className="px-3 py-2 text-left w-28">Qty</th>
                      <th className="px-3 py-2 text-left w-48">Remarks</th>
                      <th className="px-3 py-2 text-center w-12">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {replacementParts.map((part, idx) => (
                      <tr key={part.id}>
                        <td className="px-3 py-2 font-mono font-semibold text-slate-700">
                          {idx + 1}
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="text"
                            value={part.partsNo}
                            onChange={(e) =>
                              handleUpdateReplacementPart(part.id, 'partsNo', e.target.value)
                            }
                            placeholder="e.g., LF-3349"
                            className="w-full px-2 py-1 font-mono border border-slate-300 rounded"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="text"
                            value={part.partsDescription}
                            onChange={(e) =>
                              handleUpdateReplacementPart(
                                part.id,
                                'partsDescription',
                                e.target.value
                              )
                            }
                            placeholder="e.g., Fleetguard Lube Oil Filter"
                            className="w-full px-2 py-1 border border-slate-300 rounded"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="text"
                            value={part.qty}
                            onChange={(e) =>
                              handleUpdateReplacementPart(part.id, 'qty', e.target.value)
                            }
                            placeholder="1 No"
                            className="w-full px-2 py-1 font-mono border border-slate-300 rounded"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="text"
                            value={part.remarks}
                            onChange={(e) =>
                              handleUpdateReplacementPart(part.id, 'remarks', e.target.value)
                            }
                            placeholder="Remarks"
                            className="w-full px-2 py-1 border border-slate-300 rounded"
                          />
                        </td>
                        <td className="px-3 py-2 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveReplacementPart(part.id)}
                            className="p-1 text-slate-400 hover:text-red-600 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Interactive Digital Signatures, Field Engineer Email & Sector Receipt Mail */}
          <div className="pt-4 border-t border-slate-200 space-y-5">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                05. Official Digital Signatures, Field Engineer Email & Sector Receipt Mail
              </h3>
              <p className="text-xs text-slate-500 mt-0.5 font-myanmar">
                Form ၏အဆုံးတွင် Field Engineer Email ဖော်ပြထားပြီး သက်ဆိုင်ရာ Sector တာဝန်ရှိသူများထံ Receipt Mail ပေးပို့ရန် Email များ ထည့်သွင်းနိုင်ပါသည်။
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <SignaturePad
                  label="Service Engineer Signature"
                  signerName={inspectorName}
                  onSignerNameChange={handleInspectorNameChange}
                  signDate={engineerSignDate}
                  onSignDateChange={setEngineerSignDate}
                  signatureDataUrl={engineerSignatureDataUrl}
                  onSignatureChange={setEngineerSignatureDataUrl}
                  placeholderName="Wai Phyo Kyaw"
                />
                {/* Field Engineer Email Box right below Service Engineer Sign-Off */}
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5 text-slate-700" />
                      Field Engineer Email (Form နောက်တွင် ပေါ်မည့် အင်ဂျင်နီယာ Email)
                    </label>
                    <span className="text-[11px] font-mono text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                      Shown on Official Form & PDF
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <select
                      value={
                        FIELD_ENGINEER_DIRECTORY.some((e) => e.email === inspectorEmail)
                          ? inspectorEmail
                          : 'CUSTOM'
                      }
                      onChange={(e) => {
                        if (e.target.value !== 'CUSTOM') {
                          const found = FIELD_ENGINEER_DIRECTORY.find(
                            (eng) => eng.email === e.target.value
                          );
                          if (found) {
                            setInspectorName(found.name);
                            setInspectorEmail(found.email);
                          }
                        }
                      }}
                      className="px-2.5 py-1.5 text-xs border border-slate-300 rounded-md bg-white font-medium focus:outline-none focus:ring-2 focus:ring-slate-900"
                    >
                      {FIELD_ENGINEER_DIRECTORY.map((eng) => (
                        <option key={eng.email} value={eng.email}>
                          {eng.name} ({eng.email})
                        </option>
                      ))}
                      <option value="CUSTOM">Custom Field Engineer Email...</option>
                    </select>
                    <input
                      type="email"
                      value={inspectorEmail}
                      onChange={(e) => setInspectorEmail(e.target.value)}
                      placeholder="waiphyokyaw@cityproperties.com.mm"
                      className="px-2.5 py-1.5 text-xs font-mono border border-slate-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <SignaturePad
                  label="Customer Representative Signature"
                  signerName={customerSignName}
                  onSignerNameChange={setCustomerSignName}
                  signDate={customerSignDate}
                  onSignDateChange={setCustomerSignDate}
                  signatureDataUrl={customerSignatureDataUrl}
                  onSignatureChange={setCustomerSignatureDataUrl}
                  placeholderName="Paing Lin Htet"
                />
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 space-y-2">
                  <label className="block text-xs font-bold text-slate-800">
                    Customer Comment / Facility Acknowledgement
                  </label>
                  <input
                    type="text"
                    value={customerComment}
                    onChange={(e) => setCustomerComment(e.target.value)}
                    placeholder="Enter customer feedback or acknowledgment comment..."
                    className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 font-myanmar"
                  />
                </div>
              </div>
            </div>

            {/* Sector & Receipt Mail (သက်ဆိုင်ရာ တာဝန်ရှိသူများ Email) Configuration at Form End */}
            <div className="bg-slate-50 border border-slate-300 rounded-lg p-4 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-2 border-b border-slate-200">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5 uppercase tracking-wider">
                      <Building2 className="w-4 h-4 text-slate-800" />
                      Backend Rule-Based Center & Sector Receipt Mail (သက်ဆိုင်ရာ တာဝန်ရှိသူများ Email)
                    </h4>
                    <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-emerald-800 text-white rounded">
                      {matchedEmailRule.ruleId}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 font-myanmar mt-0.5">
                    {matchedEmailRule.ruleDescription} — Center Facility Email: <strong className="font-mono">{matchedEmailRule.centerFacilityEmail}</strong>
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-semibold text-slate-600">Sector:</span>
                  <select
                    value={sectorName}
                    onChange={(e) => handleSectorChange(e.target.value)}
                    className="px-2.5 py-1 text-xs font-semibold border border-slate-300 rounded-md bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
                  >
                    {SECTOR_DIRECTORY.map((sec) => (
                      <option key={sec.sectorName} value={sec.sectorName}>
                        {sec.sectorName}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Receipt Mail — Responsible Persons Emails (Comma-separated emails / သက်ဆိုင်ရာ တာဝန်ရှိသူများ Email များ)
                </label>
                <input
                  type="text"
                  value={recipientEmails}
                  onChange={(e) => setRecipientEmails(e.target.value)}
                  placeholder="citymall.ops@cityproperties.com.mm, chief.engineer@cityproperties.com.mm, satshwe36@gmail.com"
                  className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>

              {/* Quick-Add Responsible Person Email Chips */}
              <div className="space-y-1.5">
                <div className="text-[11px] font-semibold text-slate-500">
                  Quick-Toggle Responsible Person Emails (Click to add/remove from Receipt Mail):
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { label: 'Chief Engineer', email: 'chief.engineer@cityproperties.com.mm' },
                    { label: 'Maintenance Lead', email: 'maintenance.lead@cityproperties.com.mm' },
                    { label: 'City Mall Sector Ops', email: 'citymall.ops@cityproperties.com.mm' },
                    { label: 'Ocean Sector Facility', email: 'ocean.facility@cityproperties.com.mm' },
                    { label: 'Marketplace Sector Ops', email: 'marketplace.ops@cityproperties.com.mm' },
                    { label: 'Logistics / Cold Chain', email: 'logistics.eng@cityproperties.com.mm' },
                    { label: 'Commercial HQ Ops', email: 'commercial.hq@cityproperties.com.mm' },
                    { label: 'System Admin (Sat Shwe)', email: 'satshwe36@gmail.com' },
                  ].map((item) => {
                    const isSelected = recipientEmails
                      .toLowerCase()
                      .includes(item.email.toLowerCase());
                    return (
                      <button
                        key={item.email}
                        type="button"
                        onClick={() => handleToggleRecipientEmail(item.email)}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-mono rounded-md border transition-colors ${
                          isSelected
                            ? 'bg-slate-900 text-white border-slate-900 font-semibold'
                            : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                        }`}
                      >
                        <span>{isSelected ? '✓' : '+'}</span>
                        <span className="font-sans font-medium">{item.label}:</span>
                        <span>{item.email}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setActiveTab('stepC')}
              className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
            >
              ← Back to 25-Point Checklist
            </button>

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={handleDownloadPdfNow}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-300 hover:bg-emerald-100 rounded-lg transition-colors"
              >
                <Download className="w-4 h-4" />
                Download PDF File (.pdf)
              </button>
              <button
                type="button"
                onClick={() => handleSubmit(false)}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-slate-800 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors"
              >
                <Save className="w-4 h-4" />
                Save Report & Send Receipt Mail
              </button>
              <button
                type="button"
                onClick={() => handleSubmit(true)}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors"
              >
                <Printer className="w-4 h-4" />
                Save & Open Official 2-Page View
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Sticky Action & Telemetry Bar (Anchored above Mobile Bottom Nav) */}
      <div className="md:hidden fixed bottom-14 left-0 right-0 z-30 bg-slate-900/95 backdrop-blur-md text-white border-t border-slate-800 px-3 py-2 flex items-center justify-between gap-2 shadow-2xl">
        <div className="flex items-center gap-2.5">
          <div className="flex flex-col">
            <span className="text-[10px] text-slate-400 leading-none">Health</span>
            <span className="text-xs font-bold font-mono text-white tabular-nums mt-0.5">
              {evaluation.healthScore}%
            </span>
          </div>
          <div className="h-6 w-px bg-slate-800"></div>
          <div>
            {effectiveReadinessStatus === 'Ready' && (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400">
                <CheckCircle2 className="w-3.5 h-3.5" /> Ready
              </span>
            )}
            {effectiveReadinessStatus === 'Action Required' && (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-400">
                <AlertTriangle className="w-3.5 h-3.5" /> Action Req
              </span>
            )}
            {effectiveReadinessStatus === 'Critical' && (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-400">
                <AlertOctagon className="w-3.5 h-3.5" /> Critical
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleDownloadPdfNow}
            className="p-2 text-emerald-400 hover:text-emerald-300 bg-slate-800 hover:bg-slate-700 rounded-lg min-h-[40px] min-w-[40px] flex items-center justify-center border border-slate-700"
            title="Download PDF (.pdf)"
          >
            <Download className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => handleSubmit(false)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-950 bg-white hover:bg-slate-100 rounded-lg min-h-[40px]"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Save Report</span>
          </button>
        </div>
      </div>
    </div>
  );
};
