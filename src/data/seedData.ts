import { Center, GeneratorAsset, InspectionReport, ChecklistItemResult } from '../types';
import {
  createDefaultChecklist,
  createDefaultCustomInputs,
  evaluateInspectionHealth,
  createDefault300HrServicingDetails,
  createStandard300HrPartsKit,
  createDefaultBreakdownDetails,
  createStandardBreakdownPartsKit,
} from './checklistConfig';
import {
  getSectorForCenter,
  getEngineerEmailByName,
  evaluateCenterReceiptEmailRule,
} from '../utils/exportUtils';

// Clean SVG signature data URLs for pre-populated inspection reports
export const SAMPLE_ENGINEER_SIGNATURE = `data:image/svg+xml;utf8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="260" height="80" viewBox="0 0 260 80">
    <path d="M28,55 C38,22 52,18 55,48 C58,65 72,24 84,36 C92,45 86,62 98,52 C112,40 128,15 135,44 C140,64 156,34 176,38 C194,42 212,28 232,32" fill="none" stroke="#1e3a8a" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M44,62 C88,54 148,50 218,46" fill="none" stroke="#1e3a8a" stroke-width="1.6" stroke-linecap="round"/>
  </svg>`
)}`;

export const SAMPLE_CUSTOMER_SIGNATURE = `data:image/svg+xml;utf8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="260" height="80" viewBox="0 0 260 80">
    <path d="M40,56 C32,26 58,14 68,36 C76,54 60,64 82,48 C102,34 114,42 126,48 C138,54 152,32 168,44 C180,53 196,38 216,24" fill="none" stroke="#0f172a" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="224" cy="22" r="2" fill="#0f172a"/>
  </svg>`
)}`;

const RAW_CENTERS: Array<{
  code: string;
  name: string;
  address: string;
  township: string;
  contact: string;
  phone: string;
  region: Center['region'];
}> = [
  {
    code: 'CMLSPL',
    name: 'City Mall Shwe Pin Lone',
    address: 'City Mall Shwe Pin Lone, Pin Lone Road',
    township: 'North Dagon Township',
    contact: 'Ko Soe Nyein Oo',
    phone: '09-777148178',
    region: 'Yangon',
  },
  {
    code: 'CMSTJ',
    name: 'City Mall St. John',
    address: 'No. 68, Corner of Pyay Road & Min Ye Kyaw Swar Street',
    township: 'Lanmadaw Township',
    contact: 'U Kyaw Zin Latt',
    phone: '09-421088412',
    region: 'Yangon',
  },
  {
    code: 'OSCPZD',
    name: 'Ocean Supercenter Pazundaung',
    address: 'No. 62, Upper Pazundaung Road',
    township: 'Mingalar Taung Nyunt Township',
    contact: 'Ko Aung Myo Thu',
    phone: '09-795412098',
    region: 'Yangon',
  },
  {
    code: 'OSC9ML',
    name: 'Ocean North Point (9 Mile)',
    address: 'Pyay Road, 9 Mile, Mayangone',
    township: 'Mayangone Township',
    contact: 'U Zaw Min Oo',
    phone: '09-254119830',
    region: 'Yangon',
  },
  {
    code: 'OSCSGD',
    name: 'Ocean Supercenter Shwegondine',
    address: 'Corner of Shwegondine Road & Dhammazedi Road',
    township: 'Bahan Township',
    contact: 'Ko Htet Naing Win',
    phone: '09-974512304',
    region: 'Yangon',
  },
  {
    code: 'OSCTMW',
    name: 'Ocean Supercenter Tamwe',
    address: 'Corner of Banyardala Road & Kyaikkasan Road',
    township: 'Tamwe Township',
    contact: 'Ko Thura Aung',
    phone: '09-440128751',
    region: 'Yangon',
  },
  {
    code: 'OSCHLG',
    name: 'City Mart Hledan Center',
    address: 'No. 30, Corner of Pyay Road & Hledan Road',
    township: 'Kamayut Township',
    contact: 'Ko Min Khant Kyaw',
    phone: '09-782310945',
    region: 'Yangon',
  },
  {
    code: 'MKPGVY',
    name: 'Marketplace by City Mart Golden Valley',
    address: 'No. 79, Dhammazedi Road, Golden Valley',
    township: 'Bahan Township',
    contact: 'U Ye Yint Htun',
    phone: '09-5109284',
    region: 'Yangon',
  },
  {
    code: 'MKP65M',
    name: 'Marketplace 6.5 Mile Pyay Road',
    address: 'No. 112, Pyay Road, 6.5 Mile',
    township: 'Hlaing Township',
    contact: 'Ko Nay Lin Htet',
    phone: '09-798841203',
    region: 'Yangon',
  },
  {
    code: 'CMT47S',
    name: 'City Mart 47th Street',
    address: 'No. 145, Anawrahta Road, Corner of 47th Street',
    township: 'Botahtaung Township',
    contact: 'Ko Zayar Phyo',
    phone: '09-420098123',
    region: 'Yangon',
  },
  {
    code: 'CMTMyn',
    name: 'City Mart Myaynigone Plaza',
    address: 'Corner of Pyay Road & Bagaya Road, Sanchaung',
    township: 'Sanchaung Township',
    contact: 'U Myo Thant',
    phone: '09-250192834',
    region: 'Yangon',
  },
  {
    code: 'CMTWZY',
    name: 'City Mart Waizayantar HQ Complex',
    address: 'No. 73-76, Waizayantar Road, Thingangyun',
    township: 'Thingangyun Township',
    contact: 'Ko Paing Lin Htet',
    phone: '09-777148200',
    region: 'Yangon',
  },
  {
    code: 'CMTTGI',
    name: 'City Mart ThaKeta Capital',
    address: 'Myanma Gone Yi Street, Thaketa',
    township: 'Thaketa Township',
    contact: 'Ko Hein Htet Aung',
    phone: '09-965120394',
    region: 'Yangon',
  },
  {
    code: 'CMTINN',
    name: 'City Mart Insein FMI City',
    address: 'Padauk Pin Road, FMI City, Hlaing Tharyar',
    township: 'Hlaing Tharyar Township',
    contact: 'U Thet Naing',
    phone: '09-450019283',
    region: 'Yangon',
  },
  {
    code: 'CMTSOK',
    name: 'City Mart South Okkalapa',
    address: 'Thanthumar Road, Ward 10, South Okkalapa',
    township: 'South Okkalapa Township',
    contact: 'Ko Yan Naing Soe',
    phone: '09-784512039',
    region: 'Yangon',
  },
  {
    code: 'CMTNOK',
    name: 'City Mart North Okkalapa Thudhamma',
    address: 'Thudhamma Road, Ward G, North Okkalapa',
    township: 'North Okkalapa Township',
    contact: 'Ko Kyaw Swar Win',
    phone: '09-254091823',
    region: 'Yangon',
  },
  {
    code: 'CMtykn',
    name: 'City Mart Yankin Center',
    address: 'Saya San Road, Yankin Township',
    township: 'Yankin Township',
    contact: 'Ko Sithu Maung',
    phone: '09-791123490',
    region: 'Yangon',
  },
  {
    code: 'CMT8ML',
    name: 'City Mart 8 Mile Junction',
    address: 'Corner of Pyay Road & Kyaik Waing Pagoda Road',
    township: 'Mayangone Township',
    contact: 'U Nyi Nyi Lwin',
    phone: '09-421190238',
    region: 'Yangon',
  },
  {
    code: 'CMTCHN',
    name: 'City Mart Chinatown Point',
    address: 'Corner of Maha Bandoola Road & 19th Street',
    township: 'Latha Township',
    contact: 'Ko Phyo Wai Yan',
    phone: '09-978120391',
    region: 'Yangon',
  },
  {
    code: 'CMTAHL',
    name: 'City Mart Ahlone Strand',
    address: 'Lower Kyeemyindaing Road, Ahlone',
    township: 'Ahlone Township',
    contact: 'Ko Kaung Myat',
    phone: '09-771290481',
    region: 'Yangon',
  },
  {
    code: 'CMTSPT',
    name: 'City Mart Star City Thanlyin',
    address: 'Kyaik Khauk Pagoda Road, Star City Zone A',
    township: 'Thanlyin Township',
    contact: 'U Win Htut',
    phone: '09-448901234',
    region: 'Yangon',
  },
  {
    code: 'OSCMD73',
    name: 'Ocean Supercenter Mandalay 73rd St',
    address: '73rd Street, Between 36th & 37th Street, Maha Aung Myay',
    township: 'Mandalay',
    contact: 'U Sai Aung Kham',
    phone: '09-2019284',
    region: 'Mandalay',
  },
  {
    code: 'OSCMDMM',
    name: 'Ocean Mingalar Mandalay',
    address: '73rd Street, Corner of Thazin Street, Chanmyathazi',
    township: 'Mandalay',
    contact: 'Ko Tun Tun Naing',
    phone: '09-792340192',
    region: 'Mandalay',
  },
  {
    code: 'CMTMD19',
    name: 'City Mart Mandalay 19th Street',
    address: '19th Street, Between 80th & 81st Street, Aungmyaythazan',
    township: 'Mandalay',
    contact: 'Ko Myo Min Htet',
    phone: '09-402518920',
    region: 'Mandalay',
  },
  {
    code: 'CMTMD62',
    name: 'City Mart Mandalay 62nd Street',
    address: '62nd Street, Near Manawhari Street, Chanmyathazi',
    township: 'Mandalay',
    contact: 'Ko Aung Ko Latt',
    phone: '09-962019384',
    region: 'Mandalay',
  },
  {
    code: 'OSCNPT1',
    name: 'Ocean Supercenter Naypyitaw Ottarathiri',
    address: 'Yazahtani Road, Ottarathiri Township',
    township: 'Naypyitaw',
    contact: 'U Tin Maung Win',
    phone: '09-420718923',
    region: 'Naypyitaw',
  },
  {
    code: 'OSCNPT2',
    name: 'Ocean Supercenter Naypyitaw Junction',
    address: 'Yazahtani Road, Dekkhinathiri Township',
    township: 'Naypyitaw',
    contact: 'Ko Zin Bo Bo',
    phone: '09-789012345',
    region: 'Naypyitaw',
  },
  {
    code: 'OSCTGI',
    name: 'Ocean Supercenter Taunggyi',
    address: 'Bogyoke Aung San Road, Myoma Ward, Taunggyi',
    township: 'Taunggyi',
    contact: 'U Khun Aung Myint',
    phone: '09-5210984',
    region: 'Upper Myanmar',
  },
  {
    code: 'OSCMGY',
    name: 'Ocean Supercenter Monywa',
    address: 'Bogyoke Road, Dawna Chan Ward, Monywa',
    township: 'Monywa',
    contact: 'Ko Lin Htet Kyaw',
    phone: '09-794501239',
    region: 'Upper Myanmar',
  },
  {
    code: 'OSCMLM',
    name: 'Ocean Supercenter Mawlamyine',
    address: 'Strand Road, Bo Gyoke Aung San Street Corner',
    township: 'Mawlamyine',
    contact: 'Ko Min Aung Mon',
    phone: '09-425019283',
    region: 'Lower Myanmar',
  },
  {
    code: 'OSCBGO',
    name: 'Ocean Supercenter Bago',
    address: 'Yangon-Mandalay Highway Road, Shin Saw Pu Ward',
    township: 'Bago',
    contact: 'Ko Soe Moe Aung',
    phone: '09-778901238',
    region: 'Lower Myanmar',
  },
];

export const INITIAL_CENTERS: Center[] = RAW_CENTERS.map((c, idx) => ({
  id: `CTR-${String(idx + 1).padStart(3, '0')}`,
  centerCode: c.code,
  centerName: c.name,
  address: c.address,
  township: c.township,
  contactPerson: c.contact,
  contactPhone: c.phone,
  region: c.region,
}));

const GENSET_PRESETS = [
  {
    kva: '500 KVA',
    gensetModel: 'PM500CS',
    engineModel: 'KTA-19G3A',
    alternatorModel: 'TAL-A47C J 6/4',
    controllerModel: 'DSE 7320 MK II',
    avrModel: 'R150',
    breakerType: 'MCCB' as const,
    breakerPoles: '3P' as const,
    amp: '800',
  },
  {
    kva: '650 KVA',
    gensetModel: 'PM650CS',
    engineModel: 'KTAA19-G6A',
    alternatorModel: 'HCI 544F1',
    controllerModel: 'DSE 7320 MK II',
    avrModel: 'AS440',
    breakerType: 'ACB' as const,
    breakerPoles: '4P' as const,
    amp: '1000',
  },
  {
    kva: '400 KVA',
    gensetModel: 'C400D5',
    engineModel: 'NTAA855-G7A',
    alternatorModel: 'HCI 444F1',
    controllerModel: 'DSE 7320 MK II',
    avrModel: 'SX460',
    breakerType: 'MCCB' as const,
    breakerPoles: '3P' as const,
    amp: '630',
  },
  {
    kva: '800 KVA',
    gensetModel: 'C800D5',
    engineModel: 'QSK23-G3',
    alternatorModel: 'LSA 49.3 M6',
    controllerModel: 'DSE 8610 MK II',
    avrModel: 'R450',
    breakerType: 'ACB' as const,
    breakerPoles: '4P' as const,
    amp: '1250',
  },
  {
    kva: '250 KVA',
    gensetModel: 'PM250CS',
    engineModel: '6CTA8.3-G2',
    alternatorModel: 'TAL-A46D',
    controllerModel: 'DSE 6120 MK III',
    avrModel: 'R120',
    breakerType: 'MCCB' as const,
    breakerPoles: '3P' as const,
    amp: '400',
  },
];

export const INITIAL_GENERATORS: GeneratorAsset[] = [];

INITIAL_CENTERS.forEach((center, cIdx) => {
  // Generator 1 (Main)
  if (cIdx === 0) {
    // Exact CMLSPL Unit #1 from the scanned paper form
    INITIAL_GENERATORS.push({
      id: 'GEN-001',
      centerId: center.id,
      centerCode: center.centerCode,
      generatorLabel: 'Genset #1 (Main - 500 KVA)',
      kvaRating: '500 KVA',
      gensetModel: 'PM500CS',
      gensetSerialNo: 'PM500CS22010246',
      engineModel: 'KTA-19G3A',
      engineSerialNo: '41326807',
      alternatorModel: 'TAL-A47C J 6/4',
      alternatorSerialNo: '772514002',
      controllerModel: 'DSE 7320 MK II',
      avrModel: 'R150',
      breakerType: 'MCCB',
      breakerPoles: '3P',
      breakerAmpRating: '800',
      status: 'Active',
    });
    // CMLSPL Unit #2 (Standby)
    INITIAL_GENERATORS.push({
      id: 'GEN-002',
      centerId: center.id,
      centerCode: center.centerCode,
      generatorLabel: 'Genset #2 (Sync Standby - 500 KVA)',
      kvaRating: '500 KVA',
      gensetModel: 'PM500CS',
      gensetSerialNo: 'PM500CS22010247',
      engineModel: 'KTA-19G3A',
      engineSerialNo: '41326819',
      alternatorModel: 'TAL-A47C J 6/4',
      alternatorSerialNo: '772514009',
      controllerModel: 'DSE 7320 MK II',
      avrModel: 'R150',
      breakerType: 'MCCB',
      breakerPoles: '3P',
      breakerAmpRating: '800',
      status: 'Active',
    });
  } else {
    const p1 = GENSET_PRESETS[cIdx % GENSET_PRESETS.length];
    const p2 = GENSET_PRESETS[(cIdx + 1) % GENSET_PRESETS.length];
    const gen1Idx = cIdx * 2 + 1;
    const gen2Idx = cIdx * 2 + 2;

    INITIAL_GENERATORS.push({
      id: `GEN-${String(gen1Idx).padStart(3, '0')}`,
      centerId: center.id,
      centerCode: center.centerCode,
      generatorLabel: `Genset #1 (Main - ${p1.kva})`,
      kvaRating: p1.kva,
      gensetModel: p1.gensetModel,
      gensetSerialNo: `${p1.gensetModel}2201${String(246 + gen1Idx).padStart(4, '0')}`,
      engineModel: p1.engineModel,
      engineSerialNo: `${41326800 + gen1Idx * 17}`,
      alternatorModel: p1.alternatorModel,
      alternatorSerialNo: `${772514000 + gen1Idx * 13}`,
      controllerModel: p1.controllerModel,
      avrModel: p1.avrModel,
      breakerType: p1.breakerType,
      breakerPoles: p1.breakerPoles,
      breakerAmpRating: p1.amp,
      status: 'Active',
    });

    INITIAL_GENERATORS.push({
      id: `GEN-${String(gen2Idx).padStart(3, '0')}`,
      centerId: center.id,
      centerCode: center.centerCode,
      generatorLabel: `Genset #2 (Backup - ${p2.kva})`,
      kvaRating: p2.kva,
      gensetModel: p2.gensetModel,
      gensetSerialNo: `${p2.gensetModel}2201${String(246 + gen2Idx).padStart(4, '0')}`,
      engineModel: p2.engineModel,
      engineSerialNo: `${41326800 + gen2Idx * 19}`,
      alternatorModel: p2.alternatorModel,
      alternatorSerialNo: `${772514000 + gen2Idx * 15}`,
      controllerModel: p2.controllerModel,
      avrModel: p2.avrModel,
      breakerType: p2.breakerType,
      breakerPoles: p2.breakerPoles,
      breakerAmpRating: p2.amp,
      status: gen2Idx % 14 === 0 ? 'Maintenance' : 'Standby',
    });
  }
});

// Build initial inspection reports with #1 being the exact Report No 002048 from the scanned sheets
function generateInitialReports(): InspectionReport[] {
  const reports: InspectionReport[] = [];

  // 1. Exact Report 002048 for CMLSPL (GEN-001) on 2026-10-18
  const cmlCenter = INITIAL_CENTERS[0];
  const cmlGen = INITIAL_GENERATORS[0];
  const cmlChecklist = createDefaultChecklist();
  const cmlCustomInputs = createDefaultCustomInputs();
  const cmlParams = {
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
  };
  const cmlEval = evaluateInspectionHealth(cmlChecklist, cmlCustomInputs, cmlParams);

  reports.push({
    id: 'REP-002048',
    reportNo: '002048',
    formCategory: 'REGULAR_INSPECTION',
    centerId: cmlCenter.id,
    centerCode: cmlCenter.centerCode,
    centerName: cmlCenter.centerName,
    address: cmlCenter.address,
    contactPerson: cmlCenter.contactPerson,
    contactPhone: cmlCenter.contactPhone,
    generatorId: cmlGen.id,
    kvaRating: cmlGen.kvaRating,
    gensetModel: cmlGen.gensetModel,
    gensetSerialNo: cmlGen.gensetSerialNo,
    engineModel: cmlGen.engineModel,
    engineSerialNo: cmlGen.engineSerialNo,
    alternatorModel: cmlGen.alternatorModel,
    alternatorSerialNo: cmlGen.alternatorSerialNo,
    controllerModel: cmlGen.controllerModel,
    avrModel: cmlGen.avrModel,
    breakerType: cmlGen.breakerType,
    breakerPoles: cmlGen.breakerPoles,
    breakerAmpRating: cmlGen.breakerAmpRating,
    inspectionDate: '2026-10-18',
    sectorName: getSectorForCenter(cmlCenter.centerCode).sectorName,
    inspectorName: 'Wai Phyo Kyaw',
    inspectorEmail: 'waiphyokyaw@cityproperties.com.mm',
    recipientEmails: getSectorForCenter(cmlCenter.centerCode).defaultRecipients,
    customerName: 'Ko Soe Nyein Oo',
    customerSignName: 'Paing Lin Htet',
    jobRequestType: 'Genset Monthly Routine Inspection',
    correctedActions:
      'Check engine oil level, coolant level, Battery cables condition, air filter, fan belt & radiator fin condition. And then, measured battery CCA & clean air filter. After inspection, genset free load test run is normal condition.',
    generalRemarks: 'All 25 inspection points verified nominal. Free load test run completed satisfactorily.',
    errorsFound: '',
    parameters: cmlParams,
    checklist: cmlChecklist,
    customInputs: cmlCustomInputs,
    replacementParts: [],
    engineerSignatureDataUrl: SAMPLE_ENGINEER_SIGNATURE,
    engineerSignDate: '2026-10-18',
    customerSignatureDataUrl: SAMPLE_CUSTOMER_SIGNATURE,
    customerSignDate: '2026-10-18',
    customerComment: 'Monthly PM inspection completed on schedule. Generator in good readiness state.',
    healthScore: cmlEval.healthScore,
    readinessStatus: cmlEval.readinessStatus,
    defectsList: cmlEval.defectsList,
    createdAt: '2026-10-18T10:30:00Z',
  });

  const engineers = [
    'Wai Phyo Kyaw',
    'Kyaw Zin Hein',
    'Aung Ko Oo',
    'Thura Zaw',
    'Min Thu Aung',
  ];

  // Generate 31 additional historical records across all centers covering all specialized report types
  for (let i = 1; i < 32; i++) {
    const center = INITIAL_CENTERS[i % INITIAL_CENTERS.length];
    const gen = INITIAL_GENERATORS.find((g) => g.centerId === center.id) || INITIAL_GENERATORS[i];
    const checklist: Record<number, ChecklistItemResult> = createDefaultChecklist();
    const customInputs = createDefaultCustomInputs();
    const isBreakdown = i === 5 || i === 10 || i === 16 || i === 22 || i === 27;
    const is300HrServicing = !isBreakdown && (i === 1 || i % 4 === 0);
    const isRadiatorMajorCleaning = !isBreakdown && !is300HrServicing && (i === 6 || i === 18 || i === 29);
    const isRadiatorMinorCleaning = !isBreakdown && !is300HrServicing && !isRadiatorMajorCleaning && (i === 2 || i === 13 || i === 23);
    const isMinorServicing =
      !isBreakdown &&
      !is300HrServicing &&
      !isRadiatorMajorCleaning &&
      !isRadiatorMinorCleaning &&
      (i === 3 || i === 7 || i === 11 || i === 14 || i === 19 || i === 25);

    const ccaVal = 720 + ((i * 47) % 450);
    customInputs.batteryCca = String(ccaVal);
    customInputs.batteryDate1 = '12.1.26';
    customInputs.batteryDate2 = '12.1.26';

    let jobRequestLabel = 'Genset Monthly Routine Inspection';
    let correctedText =
      'Check engine oil level, coolant level, battery cable terminals, air filter & fan belt tension. Conducted 15-minute test run and verified charging alternator output.';
    let errorsText = '';
    const replacementParts = isBreakdown
      ? createStandardBreakdownPartsKit()
      : is300HrServicing
      ? createStandard300HrPartsKit()
      : [];

    if (isBreakdown) {
      jobRequestLabel = 'Emergency Breakdown Callout & Repair Report';
      correctedText =
        'Emergency Breakdown Rectification: Replaced lower radiator silicone hose and heavy-duty T-bolt clamps, flushed and refilled 12 Ltr premix coolant, bled air from cooling jacket, cleared DSE 7320 alarm, and verified 30-min load test run.';
    } else if (is300HrServicing) {
      jobRequestLabel = 'Major Servicing — 300-Hour Regular Servicing (Generator Running Hour PM)';
      correctedText =
        'Performed 300-Hour Major Servicing: Drained old engine oil and refilled 50 Ltr 15W-40 CI-4 oil, replaced lube oil filters, fuel filters, fuel water separator, and air filter element. Verified coolant concentration and conducted 30-min load test run.';
    } else if (isRadiatorMajorCleaning) {
      jobRequestLabel = 'Radiator Major Cleaning & Cooling System Chemical Flushing';
      correctedText =
        'Performed Radiator Major Cleaning: Drained cooling system, performed chemical descaling and core flushing, high-pressure washed external radiator core fins, replaced radiator pressure cap & upper/lower silicone hoses, and refilled 35 Ltr Fleetguard DCA4 Premix Coolant.';
      checklist[6] = { itemNo: 6, selectedOption: 'Clean', remark: 'Radiator core chemically flushed & descaled' };
      checklist[8] = { itemNo: 8, selectedOption: 'Replace', remark: 'Refilled 35 Ltr Premix Coolant after major radiator flush' };
      replacementParts.push(
        {
          id: `PRT-RADMAJ-${i}-1`,
          sr: 1,
          partsNo: 'CC-2825',
          partsDescription: 'Fleetguard Compleat Premix Coolant (Major Radiator Flush)',
          qty: '35 Ltr',
          remarks: 'Radiator Major Cleaning',
        },
        {
          id: `PRT-RADMAJ-${i}-2`,
          sr: 2,
          partsNo: 'RC-0900',
          partsDescription: 'Radiator Pressure Cap (13 PSI) & Chemical Descaler Kit',
          qty: '1 Set',
          remarks: 'Replaced during Major Radiator Cleaning',
        }
      );
    } else if (isRadiatorMinorCleaning) {
      jobRequestLabel = 'Radiator Minor Cleaning & Fin Air-Blowing Maintenance';
      correctedText =
        'Performed Radiator Minor Cleaning: Blew out dust and debris from radiator cooling fins with compressed air, washed external grille louver, checked fan belt tension, and topped up 3.0 Ltr Premix Coolant.';
      checklist[6] = { itemNo: 6, selectedOption: 'Clean', remark: 'Radiator fins cleaned via compressed air' };
      replacementParts.push({
        id: `PRT-RADMIN-${i}-1`,
        sr: 1,
        partsNo: 'CC-2825-TOP',
        partsDescription: 'Fleetguard Premix Coolant Top-Up (Radiator Minor Service)',
        qty: '3 Ltr',
        remarks: 'Radiator Minor Cleaning top-up',
      });
    } else if (isMinorServicing) {
      jobRequestLabel = 'Minor Servicing & Preventive Adjustment Work Order';
      correctedText =
        'Performed Minor Servicing: Topped up engine lube oil, drained water/sediment from fuel water separator, adjusted fan belt tension, cleaned battery terminals, and replaced primary air filter / fan belt as needed.';
    }

    // Introduce realistic maintenance action items on specific units for executive analytics
    if (i === 3 || i === 11 || i === 19) {
      checklist[5] = { itemNo: 5, selectedOption: 'Replace', remark: 'Primary air filter element dusty; scheduled replacement' };
      errorsText = 'Air filter differential indicator triggered; element replacement required.';
      replacementParts.push({
        id: `PRT-${i}-1`,
        sr: replacementParts.length + 1,
        partsNo: 'AF-25270',
        partsDescription: 'Fleetguard Primary Air Filter Element',
        qty: '1 No',
        remarks: 'Replaced during Minor Servicing',
      });
    }
    if (i === 5 || i === 14) {
      checklist[4] = { itemNo: 4, selectedOption: 'Water & Dust', remark: 'Drained 150ml water/sediment from separator bowl' };
      checklist[13] = { itemNo: 13, selectedOption: 'Need Replace', remark: 'Micro-cracks observed on fan belt rib' };
      errorsText = 'Fuel water separator contained sediment; fan belt wear observed.';
      if (!isBreakdown) {
        replacementParts.push({
          id: `PRT-${i}-BELT`,
          sr: replacementParts.length + 1,
          partsNo: 'FB-3012985',
          partsDescription: 'Cummins Heavy-Duty Ribbed Fan Belt',
          qty: '1 No',
          remarks: 'Replaced during Minor Servicing',
        });
      }
    }
    if (i === 8 || i === 22) {
      checklist[2] = { itemNo: 2, selectedOption: 'Min', remark: 'Topped up 3.5 Ltr 15W-40 Engine Oil' };
      checklist[8] = { itemNo: 8, selectedOption: 'Replace', remark: 'Topped up 2.0 Ltr Premix Coolant' };
      errorsText = 'Engine oil at Min mark prior to top-up; coolant inhibitor concentration low.';
    }
    if (i === 16) {
      // One critical unit requiring immediate attention
      checklist[20] = { itemNo: 20, selectedOption: 'Bad', remark: 'Coolant hose clamp seepage near lower radiator pipe' };
      checklist[14] = { itemNo: 14, selectedOption: 'Need Repair', remark: 'Lower radiator silicone hose clamp replacement required' };
      errorsText = 'Active coolant seepage at lower radiator hose connection. Immediate clamp & hose repair scheduled.';
      correctedText = 'Isolated jacket water heater, tightened clamp temporarily, and raised urgent corrective work order.';
    }
    if (i === 7 || i === 25) {
      checklist[12] = { itemNo: 12, selectedOption: 'Good with Repaired', remark: 'Cleaned terminal sulfation and applied petroleum jelly' };
      checklist[24] = { itemNo: 24, selectedOption: 'Amber', remark: 'Acoustic foam dust wiped down during service' };
      replacementParts.push({
        id: `PRT-${i}-BATT`,
        sr: replacementParts.length + 1,
        partsNo: 'BT-TERM-02',
        partsDescription: 'Heavy-Duty Brass Battery Terminal Clamp & Anti-Corrosion Kit',
        qty: '2 Sets',
        remarks: 'Replaced corroded terminal clamps',
      });
    }

    const oilBar = i === 16 ? 3.35 : Number((4.6 + ((i * 13) % 14) * 0.1).toFixed(2));
    const baseHrs = 4200 + i * 215;
    const runHrs = `${baseHrs}:${String((i * 17) % 60).padStart(2, '0')}`;
    const lastSvcHrs = `${baseHrs - 302}:00`;
    const v1 = 396 + (i % 8);

    const params = {
      runningHours: runHrs,
      engineSpeedRpm: 1500,
      engineOilPressureBar: oilBar,
      engineOilTempC: 24 + (i % 12),
      batteryCapacity: '12V/200Ah (2 nos)',
      frequencyHz: Number((49.9 + (i % 3) * 0.1).toFixed(1)),
      voltageL1L2: v1,
      voltageL1L3: v1 + 1,
      voltageL2L3: v1,
      chargingVoltageV: Number((26.1 + (i % 5) * 0.1).toFixed(1)),
      currentL1A: is300HrServicing || isRadiatorMajorCleaning ? String(180 + i * 3) : '0',
      currentL2A: is300HrServicing || isRadiatorMajorCleaning ? String(178 + i * 3) : '0',
      currentL3A: is300HrServicing || isRadiatorMajorCleaning ? String(182 + i * 3) : '0',
      activePowerKw: is300HrServicing || isRadiatorMajorCleaning ? String(115 + i * 2) : '0',
      apparentPowerKva: is300HrServicing || isRadiatorMajorCleaning ? String(142 + i * 2) : '0',
    };

    const evalRes = evaluateInspectionHealth(checklist, customInputs, params);
    const day = String(Math.max(1, 29 - (i % 28))).padStart(2, '0');
    const dateStr = `2026-10-${day}`;
    const repNo = String(2048 - i).padStart(6, '0');

    let customBreakdown = isBreakdown ? createDefaultBreakdownDetails(dateStr) : undefined;
    if (customBreakdown) {
      if (i === 5) {
        customBreakdown = {
          ...customBreakdown,
          faultCategory: 'Fuel System',
          totalDowntimeHours: 2.5,
          alarmCodeOrTrip: 'DSE 7320 Alarm: Low Fuel Pressure / Under Speed Trip (1320 RPM)',
          symptomsReported: 'Engine RPM fluctuated under load transfer and tripped on Under-Speed.',
          rootCauseAnalysis: 'Primary fuel water separator clogged with tank sediment and water contamination.',
          immediateRectification: 'Drained fuel day tank sump, replaced FS-19732 fuel water separator & FF-5052 fuel filter, primed system, and load tested.',
          postRepairStatus: 'Restored to Auto Standby',
        };
      } else if (i === 10) {
        customBreakdown = {
          ...customBreakdown,
          faultCategory: 'Starting / Battery / Charger',
          totalDowntimeHours: 1.75,
          alarmCodeOrTrip: 'DSE 7320 Alarm: Charge Alternator Failure / Low Battery Voltage (21.4V)',
          symptomsReported: 'Static battery charger fuse blown and starting voltage dropped during cranking.',
          rootCauseAnalysis: 'Grid surge blew 10A static charger input fuse and loosened B+ terminal.',
          immediateRectification: 'Replaced static charger protection fuse, tightened B+ terminal, verified 26.8V float charge.',
          postRepairStatus: 'Restored to Auto Standby',
        };
      } else if (i === 22) {
        customBreakdown = {
          ...customBreakdown,
          faultCategory: 'Controller / AMF / ATS',
          totalDowntimeHours: 2.25,
          alarmCodeOrTrip: 'ATS Transfer Interlock Delay / Auxiliary Relay Coil Fault',
          symptomsReported: 'Generator started on mains failure but ATS motorized breaker did not close automatically.',
          rootCauseAnalysis: 'ATS 24V DC close-coil auxiliary control relay contact oxidized.',
          immediateRectification: 'Replaced 24V DC 11-pin control relay in ATS panel and tested simulated mains failure transfer.',
          postRepairStatus: 'Restored to Auto Standby',
        };
      } else if (i === 27) {
        customBreakdown = {
          ...customBreakdown,
          faultCategory: 'Mechanical / Belt / Hose Leak',
          totalDowntimeHours: 3.8,
          alarmCodeOrTrip: 'High Jacket Water Temperature Pre-Alarm (94°C) — Fan Belt Slip',
          symptomsReported: 'Abnormal squealing noise from front pulley assembly and rising coolant temp.',
          rootCauseAnalysis: 'Idler tensioner bearing wear caused fan drive belt slippage under load.',
          immediateRectification: 'Replaced idler tensioner pulley assembly and installed new Cummins multi-rib fan belt.',
          postRepairStatus: 'Temporary Running (Follow-up Parts Needed)',
        };
      }
    }

    // Build activityResolution for any report with errors, defects, or breakdown
    const hasDefectsOrErrors =
      isBreakdown ||
      Boolean(errorsText) ||
      evalRes.defectsList.length > 0 ||
      evalRes.readinessStatus !== 'Ready';

    const completedDayNum = Math.min(30, parseInt(day, 10) + (i % 3) + 1);
    const completedDateStr = `2026-10-${String(completedDayNum).padStart(2, '0')}`;
    const durationDays = Math.max(1, completedDayNum - parseInt(day, 10));
    const durationHrs = isBreakdown
      ? customBreakdown?.totalDowntimeHours || 3.25
      : durationDays * 24;

    const isCompletedSeed =
      isBreakdown
        ? customBreakdown?.postRepairStatus === 'Restored to Auto Standby'
        : i === 3 || i === 5 || i === 7 || i === 8 || i === 11 || i === 14;

    const emailRule = evaluateCenterReceiptEmailRule(
      center.centerCode,
      center.centerName,
      center.region
    );

    reports.push({
      id: `REP-${repNo}`,
      reportNo: repNo,
      formCategory: isBreakdown
        ? 'BREAKDOWN_REPORT'
        : is300HrServicing
        ? 'REGULAR_SERVICING_300HR'
        : 'REGULAR_INSPECTION',
      servicing300Hr: is300HrServicing
        ? createDefault300HrServicingDetails(runHrs, lastSvcHrs, '2026-06-15')
        : undefined,
      breakdownDetails: customBreakdown,
      activityResolution: hasDefectsOrErrors
        ? {
            activityStatus: isCompletedSeed ? 'Completed' : 'Open',
            rectifiedBy: i % 3 === 0 ? 'Vendor' : 'Generator Team',
            vendorOrTeamName:
              i % 3 === 0
                ? 'Cummins Myanmar Authorized Service Vendor'
                : 'City Properties Generator Engineering Team',
            completedDate: isCompletedSeed
              ? isBreakdown
                ? dateStr
                : completedDateStr
              : undefined,
            resolutionDurationDays: isCompletedSeed
              ? isBreakdown
                ? Number((durationHrs / 24).toFixed(2))
                : durationDays
              : undefined,
            resolutionDurationHours: isCompletedSeed ? durationHrs : undefined,
            rectificationNote: isCompletedSeed
              ? isBreakdown
                ? customBreakdown?.immediateRectification || correctedText
                : `Rectified and verified by ${
                    i % 3 === 0 ? 'Vendor Technician' : 'Generator Team'
                  } on ${completedDateStr}.`
              : 'Scheduled for rectification & part replacement.',
            updatedAt: `${completedDateStr}T16:30:00Z`,
          }
        : undefined,
      matchedEmailRuleId: emailRule.ruleId,
      centerId: center.id,
      centerCode: center.centerCode,
      centerName: center.centerName,
      address: center.address,
      contactPerson: center.contactPerson,
      contactPhone: center.contactPhone,
      generatorId: gen.id,
      kvaRating: gen.kvaRating,
      gensetModel: gen.gensetModel,
      gensetSerialNo: gen.gensetSerialNo,
      engineModel: gen.engineModel,
      engineSerialNo: gen.engineSerialNo,
      alternatorModel: gen.alternatorModel,
      alternatorSerialNo: gen.alternatorSerialNo,
      controllerModel: gen.controllerModel,
      avrModel: gen.avrModel,
      breakerType: gen.breakerType,
      breakerPoles: gen.breakerPoles,
      breakerAmpRating: gen.breakerAmpRating,
      inspectionDate: dateStr,
      sectorName: emailRule.sectorName,
      inspectorName: engineers[i % engineers.length],
      inspectorEmail: getEngineerEmailByName(engineers[i % engineers.length]),
      recipientEmails: emailRule.autoReceiptEmails,
      customerName: center.contactPerson,
      customerSignName: center.contactPerson,
      jobRequestType: jobRequestLabel,
      correctedActions: correctedText,
      generalRemarks: isBreakdown
        ? 'Emergency breakdown rectified and generator restored to Auto Standby mode.'
        : is300HrServicing
        ? `300-Hour Major Servicing completed at ${runHrs} hrs. Next 300-Hr service due at ${baseHrs + 300}:${String((i * 17) % 60).padStart(2, '0')} hrs.`
        : isRadiatorMajorCleaning
        ? 'Radiator Major Cleaning and chemical coolant flush completed.'
        : isRadiatorMinorCleaning
        ? 'Radiator Minor Cleaning (external fin compressed-air cleaning & coolant top-up) completed.'
        : isMinorServicing
        ? 'Minor Servicing & preventive adjustment completed.'
        : errorsText
        ? 'Follow-up corrective action logged.'
        : 'Generator operating within standard parameters.',
      errorsFound: errorsText,
      parameters: params,
      checklist,
      customInputs,
      replacementParts,
      engineerSignatureDataUrl: SAMPLE_ENGINEER_SIGNATURE,
      engineerSignDate: dateStr,
      customerSignatureDataUrl: SAMPLE_CUSTOMER_SIGNATURE,
      customerSignDate: dateStr,
      customerComment: is300HrServicing
        ? '300-Hour overhaul servicing and filter replacement completed satisfactorily.'
        : isRadiatorMajorCleaning
        ? 'Radiator major flushing and coolant replacement verified.'
        : errorsText
        ? 'Noted action items for parts replacement.'
        : 'Satisfied with monthly service inspection.',
      healthScore: evalRes.healthScore,
      readinessStatus: evalRes.readinessStatus,
      defectsList: evalRes.defectsList,
      createdAt: `${dateStr}T09:15:00Z`,
    });
  }

  return reports;
}

export const INITIAL_REPORTS: InspectionReport[] = generateInitialReports();
