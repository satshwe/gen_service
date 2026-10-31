import React, { useState, useMemo } from 'react';
import {
  FileSpreadsheet,
  Download,
  Printer,
  Search,
  Edit3,
  Trash2,
  Plus,
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  Gauge,
  Calendar,
  Wrench,
  Building2,
  FileText,
  Layers,
} from 'lucide-react';
import {
  Center,
  GeneratorAsset,
  InspectionReport,
  ReadinessStatus,
  UserRole,
  FormCategory,
} from '../types';
import {
  formatDateDDMMYYYY,
  downloadReportAsPdfFile,
  getSectorForCenter,
  getEngineerEmailByName,
  SpecializedReportType,
  SPECIALIZED_REPORT_DEFINITIONS,
  classifyServiceSubCategory,
  matchesSpecializedReportType,
  extractPartChangeHistory,
  extractErrorAndActionActivities,
  exportSpecializedReportToExcel,
  downloadSpecializedSummaryPdf,
} from '../utils/exportUtils';
import { INITIAL_GENERATORS } from '../data/seedData';
import { CHECKLIST_DEFINITIONS } from '../data/checklistConfig';

interface ReportsArchiveModuleProps {
  reports: InspectionReport[];
  centers: Center[];
  generators?: GeneratorAsset[];
  onViewReportPdf: (report: InspectionReport) => void;
  onEditReport: (report: InspectionReport) => void;
  onDeleteReport: (id: string) => void;
  onCreateNewReport: (formCategory?: FormCategory) => void;
  currentUserRole?: UserRole;
}

export const ReportsArchiveModule: React.FC<ReportsArchiveModuleProps> = ({
  reports,
  centers,
  generators = INITIAL_GENERATORS,
  onViewReportPdf,
  onEditReport,
  onDeleteReport,
  onCreateNewReport,
  currentUserRole = 'Administrator',
}) => {
  const isAdmin = currentUserRole === 'Administrator';
  const canCreateNew =
    isAdmin ||
    currentUserRole === 'Chief Engineer' ||
    currentUserRole === 'Field Engineer';

  // Specialized Report Mode (12+ report types requested by user)
  const [specializedReportType, setSpecializedReportType] =
    useState<SpecializedReportType>('ALL');
  const [centerFilter, setCenterFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | ReadinessStatus>('ALL');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');

  // Base date/center/status/search filtered reports
  const baseFilteredReports = useMemo(() => {
    return reports.filter((r) => {
      if (centerFilter !== 'ALL' && r.centerId !== centerFilter) return false;
      if (statusFilter !== 'ALL' && r.readinessStatus !== statusFilter) return false;
      if (dateFrom && r.inspectionDate < dateFrom) return false;
      if (dateTo && r.inspectionDate > dateTo) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const partMatch = (r.replacementParts || []).some(
          (p) =>
            p.partsNo.toLowerCase().includes(q) ||
            p.partsDescription.toLowerCase().includes(q)
        );
        const match =
          r.reportNo.toLowerCase().includes(q) ||
          r.centerCode.toLowerCase().includes(q) ||
          r.centerName.toLowerCase().includes(q) ||
          r.inspectorName.toLowerCase().includes(q) ||
          r.gensetModel.toLowerCase().includes(q) ||
          r.gensetSerialNo.toLowerCase().includes(q) ||
          (r.jobRequestType || '').toLowerCase().includes(q) ||
          partMatch;
        if (!match) return false;
      }
      return true;
    });
  }, [reports, centerFilter, statusFilter, dateFrom, dateTo, searchQuery]);

  // Apply Specialized Report Type filter
  const filteredReports = useMemo(() => {
    return baseFilteredReports.filter((r) =>
      matchesSpecializedReportType(r, specializedReportType)
    );
  }, [baseFilteredReports, specializedReportType]);

  // Count per specialized report type for badge counters
  const reportTypeCounts = useMemo(() => {
    const map: Record<SpecializedReportType, number> = {
      ALL: baseFilteredReports.length,
      INSPECTION_REPORT: 0,
      SERVICING_REPORT: 0,
      BREAKDOWN_REPORT: 0,
      BREAKDOWN_COMPLETION_ANALYTICS: extractErrorAndActionActivities(baseFilteredReports).length,
      ANALYTICS_REPORT: centers.filter(
        (c) => centerFilter === 'ALL' || c.id === centerFilter
      ).length,
      DETAIL_REPORT: baseFilteredReports.length,
      CENTER_WISE_REPORT: centers.filter(
        (c) => centerFilter === 'ALL' || c.id === centerFilter
      ).length,
      CENTER_PARTS_HISTORY: extractPartChangeHistory(baseFilteredReports).length,
      MAJOR_SERVICING: 0,
      MINOR_SERVICING: 0,
      RADIATOR_MAJOR_CLEANING: 0,
      RADIATOR_MINOR_CLEANING: 0,
      DATE_RANGE_REPORT: baseFilteredReports.length,
    };

    baseFilteredReports.forEach((r) => {
      if (matchesSpecializedReportType(r, 'INSPECTION_REPORT')) map.INSPECTION_REPORT++;
      if (matchesSpecializedReportType(r, 'SERVICING_REPORT')) map.SERVICING_REPORT++;
      if (matchesSpecializedReportType(r, 'BREAKDOWN_REPORT')) map.BREAKDOWN_REPORT++;
      if (matchesSpecializedReportType(r, 'MAJOR_SERVICING')) map.MAJOR_SERVICING++;
      if (matchesSpecializedReportType(r, 'MINOR_SERVICING')) map.MINOR_SERVICING++;
      if (matchesSpecializedReportType(r, 'RADIATOR_MAJOR_CLEANING'))
        map.RADIATOR_MAJOR_CLEANING++;
      if (matchesSpecializedReportType(r, 'RADIATOR_MINOR_CLEANING'))
        map.RADIATOR_MINOR_CLEANING++;
    });

    return map;
  }, [baseFilteredReports, centers, centerFilter]);

  // Extracted Part Change History records for Center Part Change History view
  const partHistoryRecords = useMemo(
    () => extractPartChangeHistory(filteredReports),
    [filteredReports]
  );

  // Extracted Error / Action & Breakdown Completion Analytics records
  const activityRecords = useMemo(
    () => extractErrorAndActionActivities(baseFilteredReports),
    [baseFilteredReports]
  );

  // Center-wise grouped analytics & dossiers
  const centerDossiers = useMemo(() => {
    return centers
      .filter((c) => centerFilter === 'ALL' || c.id === centerFilter)
      .map((center) => {
        const cGens = generators.filter((g) => g.centerId === center.id);
        const cReports = baseFilteredReports.filter((r) => r.centerId === center.id);
        const cParts = extractPartChangeHistory(cReports);
        const avgHealth =
          cReports.length > 0
            ? Math.round(
                cReports.reduce((sum, r) => sum + r.healthScore, 0) / cReports.length
              )
            : 100;
        const breakdowns = cReports.filter(
          (r) => r.formCategory === 'BREAKDOWN_REPORT' || r.breakdownDetails
        );
        const totalDowntime = Number(
          breakdowns
            .reduce((sum, r) => sum + (r.breakdownDetails?.totalDowntimeHours || 0), 0)
            .toFixed(2)
        );
        const majorServicings = cReports.filter((r) =>
          matchesSpecializedReportType(r, 'MAJOR_SERVICING')
        );
        const minorServicings = cReports.filter((r) =>
          matchesSpecializedReportType(r, 'MINOR_SERVICING')
        );
        const radMajor = cReports.filter((r) =>
          matchesSpecializedReportType(r, 'RADIATOR_MAJOR_CLEANING')
        );
        const radMinor = cReports.filter((r) =>
          matchesSpecializedReportType(r, 'RADIATOR_MINOR_CLEANING')
        );

        return {
          center,
          sectorName: getSectorForCenter(center.centerCode).sectorName,
          cGens,
          cReports,
          cParts,
          avgHealth,
          breakdownsCount: breakdowns.length,
          totalDowntime,
          majorServicingsCount: majorServicings.length,
          minorServicingsCount: minorServicings.length,
          radMajorCount: radMajor.length,
          radMinorCount: radMinor.length,
          latestReport: cReports[0],
        };
      });
  }, [centers, generators, baseFilteredReports, centerFilter]);

  const activeReportDef =
    SPECIALIZED_REPORT_DEFINITIONS.find((d) => d.id === specializedReportType) ||
    SPECIALIZED_REPORT_DEFINITIONS[0];

  const selectedCenterObj = centers.find((c) => c.id === centerFilter);
  const centerFilterLabel = selectedCenterObj
    ? `${selectedCenterObj.centerCode} — ${selectedCenterObj.centerName}`
    : `All Centers (${centers.length})`;

  return (
    <div className="space-y-6">
      {/* =====================================================================
          HEADER & MULTI-FORMAT EXPORT TOOLBAR (.XLSX, .CSV, .PDF)
         ===================================================================== */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <img
            src="/assets/aistudio/cp_logo_cb60fbe9.jfif"
            alt="City Properties Company Logo"
            className="h-10 w-auto object-contain rounded bg-white p-0.5 border border-slate-200 shadow-2xs shrink-0 mt-0.5"
          />
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-500 mb-0.5">
              <span>Gen SOP-002 Reporting Engine</span>
              <span>·</span>
              <span className="font-semibold text-slate-700">
                {activeReportDef.label} ({activeReportDef.labelMm})
              </span>
            </div>
            <h2 className="text-lg font-bold text-slate-900">
              Comprehensive Generator Reports, Center Part History & Analytics Suite
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {activeReportDef.description}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() =>
              downloadSpecializedSummaryPdf(
                specializedReportType,
                filteredReports,
                centers.filter((c) => centerFilter === 'ALL' || c.id === centerFilter),
                generators,
                dateFrom,
                dateTo,
                centerFilterLabel
              )
            }
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-300 hover:bg-emerald-100 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            <Download className="w-4 h-4" />
            Download Report PDF (.pdf)
          </button>

          <button
            type="button"
            onClick={() =>
              exportSpecializedReportToExcel(
                specializedReportType,
                filteredReports,
                centers.filter((c) => centerFilter === 'ALL' || c.id === centerFilter),
                generators,
                'xlsx'
              )
            }
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-800 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
            Export Excel (.xlsx)
          </button>

          <button
            type="button"
            onClick={() =>
              exportSpecializedReportToExcel(
                specializedReportType,
                filteredReports,
                centers.filter((c) => centerFilter === 'ALL' || c.id === centerFilter),
                generators,
                'csv'
              )
            }
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            CSV (.csv)
          </button>

          {canCreateNew && (
            <>
              <button
                type="button"
                onClick={() => onCreateNewReport('REGULAR_INSPECTION')}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-900 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                + Inspection
              </button>
              <button
                type="button"
                onClick={() => onCreateNewReport('REGULAR_SERVICING_300HR')}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                <Gauge className="w-3.5 h-3.5" />
                + 300-Hr Servicing
              </button>
              <button
                type="button"
                onClick={() => onCreateNewReport('BREAKDOWN_REPORT')}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                <AlertOctagon className="w-3.5 h-3.5" />
                + Breakdown
              </button>
            </>
          )}
        </div>
      </div>

      {/* =====================================================================
          12 SPECIALIZED REPORT TYPE SELECTOR GRID + FILTERS (CENTER & DATE RANGE)
         ===================================================================== */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-4">
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-slate-900" />
              Select Specialized Report Type (အစီရင်ခံစာ အမျိုးအစား ရွေးချယ်ရန် — 13 Views)
            </span>
            <span className="text-[11px] font-mono text-slate-500">
              Active View: {activeReportDef.label}
            </span>
          </div>

          {/* Mobile Selector Dropdown for Report Views */}
          <div className="block sm:hidden mb-2.5">
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
              Select Report Category (အစီရင်ခံစာ အမျိုးအစား)
            </label>
            <select
              value={specializedReportType}
              onChange={(e) => setSpecializedReportType(e.target.value as SpecializedReportType)}
              className="w-full px-3 py-2 text-xs font-semibold border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
            >
              {SPECIALIZED_REPORT_DEFINITIONS.map((def) => (
                <option key={def.id} value={def.id}>
                  {def.label} ({reportTypeCounts[def.id] ?? 0}) — {def.labelMm}
                </option>
              ))}
            </select>
          </div>

          <div className="hidden sm:grid sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
            {SPECIALIZED_REPORT_DEFINITIONS.map((def) => {
              const isSelected = specializedReportType === def.id;
              const countVal = reportTypeCounts[def.id] ?? 0;
              return (
                <button
                  key={def.id}
                  type="button"
                  onClick={() => setSpecializedReportType(def.id)}
                  className={`text-left p-2.5 rounded-lg border transition-all flex flex-col justify-between gap-1 ${
                    isSelected
                      ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                      : 'bg-slate-50/70 text-slate-800 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-start justify-between gap-1.5">
                    <span className="text-xs font-bold leading-tight">{def.label}</span>
                    <span
                      className={`px-1.5 py-0.5 text-[10px] font-mono font-bold rounded shrink-0 ${
                        isSelected
                          ? 'bg-white/20 text-white'
                          : 'bg-slate-200/80 text-slate-700'
                      }`}
                    >
                      {countVal}
                    </span>
                  </div>
                  <span
                    className={`text-[10px] font-myanmar truncate ${
                      isSelected ? 'text-slate-300' : 'text-slate-500'
                    }`}
                  >
                    {def.labelMm}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Center Filter, Date Range Filter, Readiness Filter & Search */}
        <div className="pt-3 border-t border-slate-200 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-12 gap-3 items-end">
          {/* Center Individual Selector */}
          <div className="xl:col-span-3">
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
              Center Filter (Center တစ်ခုချင်းအလိုက် ရွေးရန်)
            </label>
            <select
              value={centerFilter}
              onChange={(e) => setCenterFilter(e.target.value)}
              className="w-full px-3 py-1.5 text-xs font-semibold border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
            >
              <option value="ALL">All Centers ({centers.length} Centers)</option>
              {centers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.centerCode} — {c.centerName}
                </option>
              ))}
            </select>
          </div>

          {/* Date Range Filter (From - To + Presets) */}
          <div className="xl:col-span-4">
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] font-semibold text-slate-600 flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                Date Range Report Filter (From – To)
              </label>
              {(dateFrom || dateTo) && (
                <button
                  type="button"
                  onClick={() => {
                    setDateFrom('');
                    setDateTo('');
                  }}
                  className="text-[10px] font-semibold text-red-600 hover:underline"
                >
                  Clear Dates
                </button>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs font-mono border border-slate-300 rounded-lg bg-white"
              />
              <span className="text-xs text-slate-400">to</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs font-mono border border-slate-300 rounded-lg bg-white"
              />
            </div>
          </div>

          {/* Readiness Status Filter */}
          <div className="xl:col-span-2">
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
              Readiness Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value as 'ALL' | ReadinessStatus)
              }
              className="w-full px-3 py-1.5 text-xs font-medium border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
            >
              <option value="ALL">All Statuses</option>
              <option value="Ready">Ready</option>
              <option value="Action Required">Action Required</option>
              <option value="Critical">Critical</option>
            </select>
          </div>

          {/* Search Input */}
          <div className="xl:col-span-3">
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
              Search Report #, Part #, Engineer, Model
            </label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search report #, center, part #..."
                className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>
          </div>
        </div>
      </div>

      {/* =====================================================================
          VIEW 1: CENTER-BY-CENTER PART CHANGE HISTORY RECORD (CENTER_PARTS_HISTORY)
         ===================================================================== */}
      {specializedReportType === 'CENTER_PARTS_HISTORY' && (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <Wrench className="w-4 h-4 text-slate-800" />
                Center-by-Center Part Change History Ledger ({partHistoryRecords.length} Parts Replaced)
              </h3>
              <p className="text-xs text-slate-500 font-myanmar">
                Center တစ်ခုချင်းအလိုက် လဲလှယ်ခဲ့သည့် Generator အပိုပစ္စည်းများ (Part No, Description, Qty, Running Hours, Date & Engineer) မှတ်တမ်း
              </p>
            </div>
            <span className="text-xs font-mono font-semibold text-slate-700 bg-white border border-slate-200 px-2.5 py-1 rounded">
              Filter: {centerFilterLabel}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                <tr>
                  <th className="px-4 py-3 text-left">Sr</th>
                  <th className="px-4 py-3 text-left">Change Date</th>
                  <th className="px-4 py-3 text-left">Report #</th>
                  <th className="px-4 py-3 text-left">Center & Sector</th>
                  <th className="px-4 py-3 text-left">Generator & Model</th>
                  <th className="px-4 py-3 text-right">Running Hrs</th>
                  <th className="px-4 py-3 text-left">Service Category</th>
                  <th className="px-4 py-3 text-left">Part No.</th>
                  <th className="px-4 py-3 text-left">Part Description</th>
                  <th className="px-4 py-3 text-left">Qty</th>
                  <th className="px-4 py-3 text-left">Remarks</th>
                  <th className="px-4 py-3 text-left">Field Engineer</th>
                  <th className="px-4 py-3 text-right">Report PDF</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {partHistoryRecords.length === 0 ? (
                  <tr>
                    <td colSpan={13} className="px-6 py-12 text-center text-slate-500">
                      No replacement parts recorded for the selected Center / Date Range criteria.
                    </td>
                  </tr>
                ) : (
                  partHistoryRecords.map((pt, idx) => {
                    const parentReport = reports.find((r) => r.reportNo === pt.reportNo);
                    return (
                      <tr key={pt.id} className="hover:bg-slate-50/80">
                        <td className="px-4 py-2.5 font-mono text-slate-500">{idx + 1}</td>
                        <td className="px-4 py-2.5 font-mono text-slate-700 whitespace-nowrap">
                          {formatDateDDMMYYYY(pt.inspectionDate)}
                        </td>
                        <td className="px-4 py-2.5 font-mono font-bold text-slate-900">
                          #{pt.reportNo}
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="font-bold text-slate-900">{pt.centerCode}</div>
                          <div className="text-[11px] text-slate-500 truncate max-w-[160px]">
                            {pt.centerName}
                          </div>
                        </td>
                        <td className="px-4 py-2.5 font-mono">
                          <div className="font-semibold text-slate-800">{pt.generatorId}</div>
                          <div className="text-[11px] text-slate-500">
                            {pt.gensetModel} · {pt.kvaRating}
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono font-semibold text-slate-900 tabular-nums">
                          {pt.runningHours}
                        </td>
                        <td className="px-4 py-2.5">
                          <span className="px-2 py-0.5 text-[10px] font-semibold bg-slate-100 text-slate-800 rounded whitespace-nowrap">
                            {pt.serviceCategory}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 font-mono font-bold text-slate-900 whitespace-nowrap">
                          {pt.partsNo}
                        </td>
                        <td className="px-4 py-2.5 font-medium text-slate-900">
                          {pt.partsDescription}
                        </td>
                        <td className="px-4 py-2.5 font-mono font-semibold text-emerald-800 whitespace-nowrap">
                          {pt.qty}
                        </td>
                        <td className="px-4 py-2.5 text-slate-600">{pt.remarks || '—'}</td>
                        <td className="px-4 py-2.5 whitespace-nowrap">
                          <div className="font-medium text-slate-800">{pt.inspectorName}</div>
                          <div className="text-[10px] font-mono text-slate-500">
                            {pt.inspectorEmail}
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-right whitespace-nowrap">
                          {parentReport && (
                            <div className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => downloadReportAsPdfFile(parentReport)}
                                className="px-2 py-1 text-[11px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-300 rounded hover:bg-emerald-100"
                              >
                                .PDF
                              </button>
                              <button
                                type="button"
                                onClick={() => onViewReportPdf(parentReport)}
                                className="px-2 py-1 text-[11px] font-semibold text-white bg-slate-900 rounded hover:bg-slate-800"
                              >
                                View
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =====================================================================
          VIEW 2: ANALYTICS REPORT & CENTER-BY-CENTER INDIVIDUAL DOSSIER
         ===================================================================== */}
      {(specializedReportType === 'ANALYTICS_REPORT' ||
        specializedReportType === 'CENTER_WISE_REPORT') && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  <Building2 className="w-4 h-4 text-slate-800" />
                  {specializedReportType === 'ANALYTICS_REPORT'
                    ? `Executive Analytics Summary Report (${centerDossiers.length} Centers)`
                    : `Center-by-Center Individual Service & Asset Report (${centerDossiers.length} Centers)`}
                </h3>
                <p className="text-xs text-slate-500">
                  Click any Center row or filter by a single Center above to inspect its full service & part replacement dossier.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                  <tr>
                    <th className="px-4 py-3 text-left">Center & Sector</th>
                    <th className="px-4 py-3 text-left">Generators</th>
                    <th className="px-4 py-3 text-right">Total Reports</th>
                    <th className="px-4 py-3 text-right">Major 300-Hr</th>
                    <th className="px-4 py-3 text-right">Minor Svc</th>
                    <th className="px-4 py-3 text-right">Radiator Clean</th>
                    <th className="px-4 py-3 text-right">Breakdowns (Downtime)</th>
                    <th className="px-4 py-3 text-right">Parts Replaced</th>
                    <th className="px-4 py-3 text-right">Avg Health</th>
                    <th className="px-4 py-3 text-left">Latest Status</th>
                    <th className="px-4 py-3 text-right">Inspect Center</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {centerDossiers.map((d) => (
                    <tr key={d.center.id} className="hover:bg-slate-50/80">
                      <td className="px-4 py-3">
                        <div className="font-mono font-bold text-slate-900">
                          {d.center.centerCode} — {d.center.centerName}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {d.sectorName} · Contact: {d.center.contactPerson} ({d.center.contactPhone})
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-700">
                        {d.cGens.map((g) => `${g.id} (${g.kvaRating})`).join(', ')}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-slate-900">
                        {d.cReports.length}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-amber-800 font-semibold">
                        {d.majorServicingsCount}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-slate-700">
                        {d.minorServicingsCount}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-slate-700">
                        {d.radMajorCount + d.radMinorCount} ({d.radMajorCount} Maj / {d.radMinorCount} Min)
                      </td>
                      <td className="px-4 py-3 text-right font-mono">
                        <span
                          className={
                            d.breakdownsCount > 0
                              ? 'text-red-600 font-bold'
                              : 'text-slate-500'
                          }
                        >
                          {d.breakdownsCount} ({d.totalDowntime}h)
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-emerald-800">
                        {d.cParts.length} items
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-slate-900">
                        {d.avgHealth}%
                      </td>
                      <td className="px-4 py-3">
                        {d.latestReport ? (
                          <span
                            className={`font-semibold ${
                              d.latestReport.readinessStatus === 'Ready'
                                ? 'text-emerald-700'
                                : d.latestReport.readinessStatus === 'Critical'
                                ? 'text-red-700'
                                : 'text-amber-700'
                            }`}
                          >
                            {d.latestReport.readinessStatus} (#{d.latestReport.reportNo})
                          </span>
                        ) : (
                          <span className="text-slate-400">No Report</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() =>
                              setCenterFilter(
                                centerFilter === d.center.id ? 'ALL' : d.center.id
                              )
                            }
                            className="px-2.5 py-1 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded"
                          >
                            {centerFilter === d.center.id ? 'Show All Centers' : 'Focus Center'}
                          </button>
                          {d.latestReport && (
                            <button
                              type="button"
                              onClick={() => downloadReportAsPdfFile(d.latestReport!)}
                              className="px-2 py-1 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-300 rounded"
                            >
                              .PDF
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          VIEW 3: DETAIL TECHNICAL REPORT (25-POINT CHECKLIST & TELEMETRY MATRIX)
         ===================================================================== */}
      {specializedReportType === 'DETAIL_REPORT' && (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-slate-800" />
                Detail Technical Report — Operating Telemetry & 25-Point Checklist Matrix ({filteredReports.length} Reports)
              </h3>
              <p className="text-xs text-slate-500">
                Complete electrical, mechanical, battery SOC/SOH, and 25-point inspection breakdown for every report.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                <tr>
                  <th className="px-3 py-2.5 text-left">Report # / Date</th>
                  <th className="px-3 py-2.5 text-left">Center / Genset</th>
                  <th className="px-3 py-2.5 text-left">Service Category</th>
                  <th className="px-3 py-2.5 text-right">Run Hrs / RPM</th>
                  <th className="px-3 py-2.5 text-right">Oil Bar / Temp</th>
                  <th className="px-3 py-2.5 text-right">Hz / 3-Phase V</th>
                  <th className="px-3 py-2.5 text-right">Load A (L1/L2/L3)</th>
                  <th className="px-3 py-2.5 text-right">Batt V / Ah / CCA</th>
                  <th className="px-3 py-2.5 text-left">25-Point Exceptions / Remarks</th>
                  <th className="px-3 py-2.5 text-left">Parts Used</th>
                  <th className="px-3 py-2.5 text-right">Download</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredReports.map((r) => {
                  const nonNominalPoints = CHECKLIST_DEFINITIONS.filter((def) => {
                    const sel = r.checklist[def.itemNo]?.selectedOption;
                    return (
                      sel &&
                      (def.warningOptions?.includes(sel) ||
                        def.criticalOptions?.includes(sel))
                    );
                  });

                  return (
                    <tr key={r.id} className="hover:bg-slate-50/80">
                      <td className="px-3 py-2.5 font-mono whitespace-nowrap">
                        <div className="font-bold text-slate-900">#{r.reportNo}</div>
                        <div className="text-[11px] text-slate-500">
                          {formatDateDDMMYYYY(r.inspectionDate)}
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="font-bold text-slate-900">
                          {r.centerCode} · {r.generatorId}
                        </div>
                        <div className="text-[11px] font-mono text-slate-500">
                          {r.gensetModel} ({r.kvaRating}) · Eng: {r.engineModel}
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="px-2 py-0.5 text-[10px] font-semibold bg-slate-100 text-slate-800 rounded">
                          {classifyServiceSubCategory(r)}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono tabular-nums">
                        <div className="font-semibold text-slate-900">
                          {r.parameters.runningHours}h
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {r.parameters.engineSpeedRpm} RPM
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono tabular-nums">
                        <div
                          className={`font-semibold ${
                            r.parameters.engineOilPressureBar < 3.5
                              ? 'text-red-600'
                              : 'text-slate-900'
                          }`}
                        >
                          {r.parameters.engineOilPressureBar} Bar
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {r.parameters.engineOilTempC} °C
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono tabular-nums">
                        <div className="text-slate-900">{r.parameters.frequencyHz} Hz</div>
                        <div className="text-[11px] text-slate-500">
                          {r.parameters.voltageL1L2}/{r.parameters.voltageL1L3}/
                          {r.parameters.voltageL2L3}V
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono tabular-nums">
                        <div className="text-slate-900">
                          {r.parameters.currentL1A || '0'}/{r.parameters.currentL2A || '0'}/
                          {r.parameters.currentL3A || '0'}A
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {r.parameters.activePowerKw || '0'} KW
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono tabular-nums">
                        <div className="font-semibold text-slate-900">
                          {r.customInputs.batteryCca} CCA
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {r.customInputs.batteryVolt}V / {r.customInputs.batteryAh}Ah
                        </div>
                      </td>
                      <td className="px-3 py-2.5 max-w-[240px]">
                        {nonNominalPoints.length === 0 ? (
                          <span className="text-emerald-700 font-medium">
                            All 25 Checklist Points Nominal
                          </span>
                        ) : (
                          <div className="space-y-0.5">
                            {nonNominalPoints.map((pt) => (
                              <div
                                key={pt.itemNo}
                                className="text-[11px] text-amber-800 font-medium truncate"
                              >
                                Q{pt.itemNo}: {r.checklist[pt.itemNo]?.selectedOption} (
                                {r.checklist[pt.itemNo]?.remark || pt.description})
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-[11px] text-slate-700">
                        {r.replacementParts.length === 0
                          ? 'None'
                          : `${r.replacementParts.length} Part(s): ${r.replacementParts
                              .map((p) => p.partsNo)
                              .join(', ')}`}
                      </td>
                      <td className="px-3 py-2.5 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => downloadReportAsPdfFile(r)}
                          className="px-2.5 py-1 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-300 rounded hover:bg-emerald-100"
                        >
                          .PDF
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =====================================================================
          VIEW 4: BREAKDOWN & COMPLETION RATE ANALYTIC REPORT (BREAKDOWN_COMPLETION_ANALYTICS)
         ===================================================================== */}
      {specializedReportType === 'BREAKDOWN_COMPLETION_ANALYTICS' && (
        <div className="space-y-4">
          {/* KPI Summary Cards */}
          {(() => {
            const totalActs = activityRecords.length;
            const completedActs = activityRecords.filter((a) => a.status === 'Completed');
            const openActs = activityRecords.filter((a) => a.status !== 'Completed');
            const completionRatePct =
              totalActs > 0 ? Math.round((completedActs.length / totalActs) * 100) : 100;
            const totalHrs = completedActs.reduce(
              (sum, a) => sum + a.resolutionDurationHours,
              0
            );
            const avgHrs =
              completedActs.length > 0
                ? Number((totalHrs / completedActs.length).toFixed(1))
                : 0;
            const avgDays = Number((avgHrs / 24).toFixed(1));
            const genTeamCount = completedActs.filter(
              (a) => a.rectifiedBy === 'Generator Team'
            ).length;
            const vendorCount = completedActs.filter((a) => a.rectifiedBy === 'Vendor').length;

            return (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white border border-slate-200 rounded-lg p-4">
                  <div className="text-xs font-medium text-slate-500">
                    Total Breakdown & Error Activities
                  </div>
                  <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1">
                    {totalActs}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    {completedActs.length} Completed · {openActs.length} Open
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-lg p-4">
                  <div className="text-xs font-medium text-slate-500">
                    Action & Breakdown Completion Rate
                  </div>
                  <div className="text-2xl font-bold font-mono tabular-nums text-emerald-700 mt-1">
                    {completionRatePct}%
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    Verified with Actual Completed Date
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-lg p-4">
                  <div className="text-xs font-medium text-slate-500">
                    Average Resolution Duration Time
                  </div>
                  <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1">
                    {avgHrs} hrs
                  </div>
                  <div className="text-xs text-emerald-700 font-mono font-medium mt-1">
                    ≈ {avgDays} days avg from report to complete
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-lg p-4">
                  <div className="text-xs font-medium text-slate-500">
                    Rectified By (Generator Team vs Vendor)
                  </div>
                  <div className="text-xl font-bold font-mono tabular-nums text-slate-900 mt-1">
                    {genTeamCount} Gen Team · {vendorCount} Vendor
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    Completed repair responsibility split
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Incident Resolution Duration & Completion Table */}
          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Breakdown & Error Completion Rate Analytic Report ({activityRecords.length} Records)
                </h3>
                <p className="text-xs text-slate-500 font-myanmar">
                  Error တွေ့ရှိချက်များနှင့် Breakdown များအား Generator Team သို့မဟုတ် Vendor ဖြင့် ပြုပြင်ပြီးစီးမှု၊ Completed Date နှင့် ကြာမြင့်ချိန် (Duration Time) အစီရင်ခံစာ
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                  <tr>
                    <th className="px-4 py-3 text-left">Report # / Date</th>
                    <th className="px-4 py-3 text-left">Center Name & Sector</th>
                    <th className="px-4 py-3 text-left">Engineer Name</th>
                    <th className="px-4 py-3 text-left">Error Description & Action Required</th>
                    <th className="px-4 py-3 text-left">Rectified By</th>
                    <th className="px-4 py-3 text-left">Completed Date</th>
                    <th className="px-4 py-3 text-right">Resolution Duration</th>
                    <th className="px-4 py-3 text-left">Status</th>
                    <th className="px-4 py-3 text-right">Download</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {activityRecords.map((act) => (
                    <tr key={act.reportId} className="hover:bg-slate-50/80">
                      <td className="px-4 py-2.5 font-mono whitespace-nowrap">
                        <div className="font-bold text-slate-900">#{act.reportNo}</div>
                        <div className="text-[11px] text-slate-500">
                          {formatDateDDMMYYYY(act.inspectionDate)}
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="font-bold text-slate-900">
                          {act.centerCode} — {act.centerName}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {act.sectorName} · {act.generatorId} ({act.kvaRating})
                        </div>
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <div className="font-semibold text-slate-900">{act.inspectorName}</div>
                        <div className="text-[10px] font-mono text-slate-500">
                          {act.inspectorEmail}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 max-w-[300px]">
                        <div className="font-medium text-slate-900 font-myanmar">
                          {act.errorDescription}
                        </div>
                        <div className="text-[11px] text-slate-500 font-myanmar mt-0.5">
                          {act.actionRemark || act.actionRequiredText}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 text-[10px] font-bold rounded ${
                            act.rectifiedBy === 'Vendor'
                              ? 'bg-amber-100 text-amber-900'
                              : 'bg-slate-900 text-white'
                          }`}
                        >
                          {act.rectifiedBy}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 font-mono whitespace-nowrap text-slate-800">
                        {act.completedDate ? formatDateDDMMYYYY(act.completedDate) : 'Pending'}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono font-bold text-slate-900 tabular-nums whitespace-nowrap">
                        {act.resolutionDurationLabel}
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 text-[10px] font-bold rounded ${
                            act.status === 'Completed'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-900'
                          }`}
                        >
                          {act.status === 'Completed' ? 'Complete' : act.status}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => downloadReportAsPdfFile(act.report)}
                          className="px-2.5 py-1 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-300 rounded hover:bg-emerald-100"
                        >
                          .PDF
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          STANDARD & SPECIALIZED SERVICE REPORTS TABLE (ALL OTHER MODES)
         ===================================================================== */}
      {specializedReportType !== 'CENTER_PARTS_HISTORY' &&
        specializedReportType !== 'DETAIL_REPORT' &&
        specializedReportType !== 'BREAKDOWN_COMPLETION_ANALYTICS' && (
          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  {activeReportDef.label} — {filteredReports.length} Matching Report(s)
                </h3>
                <p className="text-xs text-slate-500 font-myanmar">
                  {activeReportDef.labelMm} · Filter: {centerFilterLabel}
                </p>
              </div>
            </div>

            {/* Desktop Table View (Viewport >= 768px) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                  <tr>
                    <th className="px-4 py-3 text-left">Report No / Category</th>
                    <th className="px-4 py-3 text-left">Date</th>
                    <th className="px-4 py-3 text-left">Center & Sector</th>
                    <th className="px-4 py-3 text-left">Generator / Model</th>
                    <th className="px-4 py-3 text-left">Service Work & Parts</th>
                    <th className="px-4 py-3 text-right">Run Hrs / Telemetry</th>
                    <th className="px-4 py-3 text-right">Health Score</th>
                    <th className="px-4 py-3 text-left">Readiness Status</th>
                    <th className="px-4 py-3 text-left">Service Engineer</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredReports.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="px-6 py-12 text-center text-slate-500">
                        No inspection or servicing reports match your current filter criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredReports.map((r) => {
                      const subCat = classifyServiceSubCategory(r);
                      return (
                        <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="px-4 py-3 font-mono font-bold text-slate-900 tabular-nums">
                            <div>#{r.reportNo}</div>
                            <div className="mt-0.5">
                              {subCat === 'Breakdown Emergency Repair' ? (
                                <span className="text-[10px] font-sans font-semibold text-red-800 bg-red-100 px-1.5 py-0.5 rounded">
                                  Breakdown Report
                                </span>
                              ) : subCat === 'Major Servicing (300-Hr PM)' ? (
                                <span className="text-[10px] font-sans font-semibold text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded">
                                  Major Servicing (300-Hr)
                                </span>
                              ) : subCat === 'Radiator Major Cleaning' ? (
                                <span className="text-[10px] font-sans font-semibold text-blue-800 bg-blue-100 px-1.5 py-0.5 rounded">
                                  Radiator Major Cleaning
                                </span>
                              ) : subCat === 'Radiator Minor Cleaning' ? (
                                <span className="text-[10px] font-sans font-semibold text-sky-800 bg-sky-100 px-1.5 py-0.5 rounded">
                                  Radiator Minor Cleaning
                                </span>
                              ) : subCat === 'Minor Servicing' ? (
                                <span className="text-[10px] font-sans font-semibold text-emerald-800 bg-emerald-100 px-1.5 py-0.5 rounded">
                                  Minor Servicing
                                </span>
                              ) : (
                                <span className="text-[10px] font-sans font-medium text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                                  Regular Inspection
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 font-mono text-slate-600 tabular-nums whitespace-nowrap">
                            {formatDateDDMMYYYY(r.inspectionDate)}
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-bold text-slate-900">{r.centerCode}</div>
                            <div className="text-[11px] text-slate-500 truncate max-w-[175px]">
                              {r.centerName}
                            </div>
                            <div className="text-[10px] font-medium text-slate-600 mt-0.5">
                              {r.sectorName || getSectorForCenter(r.centerCode).sectorName}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-mono font-semibold text-slate-800">
                              {r.generatorId} · {r.gensetModel} ({r.kvaRating})
                            </div>
                            <div className="text-[11px] font-mono text-slate-500">
                              S/N: {r.gensetSerialNo}
                            </div>
                          </td>
                          <td className="px-4 py-3 max-w-[240px]">
                            <div className="font-medium text-slate-900 truncate">
                              {r.jobRequestType}
                            </div>
                            <div className="text-[11px] text-slate-500 truncate">
                              {r.correctedActions}
                            </div>
                            {r.replacementParts.length > 0 && (
                              <div className="text-[10px] font-mono font-semibold text-emerald-800 mt-0.5">
                                Parts Changed ({r.replacementParts.length}):{' '}
                                {r.replacementParts.map((p) => p.partsNo).join(', ')}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-800 whitespace-nowrap">
                            <div className="font-semibold">{r.parameters.runningHours} hrs</div>
                            <div className="text-[10px] text-slate-500">
                              {r.parameters.engineOilPressureBar.toFixed(2)} Bar ·{' '}
                              {r.customInputs.batteryCca} CCA
                            </div>
                            {r.formCategory === 'BREAKDOWN_REPORT' && r.breakdownDetails && (
                              <div className="text-[10px] text-red-700 font-semibold">
                                Downtime: {r.breakdownDetails.totalDowntimeHours}h
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-bold tabular-nums text-slate-900">
                            {r.healthScore}%
                          </td>
                          <td className="px-4 py-3">
                            {r.readinessStatus === 'Ready' && (
                              <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                                <CheckCircle2 className="w-3.5 h-3.5" /> Ready
                              </span>
                            )}
                            {r.readinessStatus === 'Action Required' && (
                              <div>
                                <span className="inline-flex items-center gap-1 font-semibold text-amber-700">
                                  <AlertTriangle className="w-3.5 h-3.5" /> Action Required
                                </span>
                                {r.defectsList.length > 0 && (
                                  <div className="text-[10px] text-slate-500 truncate max-w-[160px]">
                                    {r.defectsList.join(', ')}
                                  </div>
                                )}
                              </div>
                            )}
                            {r.readinessStatus === 'Critical' && (
                              <div>
                                <span className="inline-flex items-center gap-1 font-semibold text-red-700">
                                  <AlertOctagon className="w-3.5 h-3.5" /> Critical
                                </span>
                                {r.defectsList.length > 0 && (
                                  <div className="text-[10px] text-red-600 truncate max-w-[160px]">
                                    {r.defectsList.join(', ')}
                                  </div>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-slate-700 font-medium whitespace-nowrap">
                            <div>{r.inspectorName}</div>
                            <div className="text-[10px] font-mono text-slate-500">
                              {r.inspectorEmail || getEngineerEmailByName(r.inspectorName)}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right whitespace-nowrap">
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => downloadReportAsPdfFile(r)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-300 hover:bg-emerald-100 rounded transition-colors"
                                title="Download Official 2-Page .pdf File directly"
                              >
                                <Download className="w-3 h-3" />
                                .PDF
                              </button>
                              <button
                                type="button"
                                onClick={() => onViewReportPdf(r)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded transition-colors"
                                title="Open Official 2-Page Print View"
                              >
                                <Printer className="w-3 h-3" />
                                View
                              </button>
                              {isAdmin && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => onEditReport(r)}
                                    className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors"
                                    title="Edit Report (Administrator Only)"
                                  >
                                    <Edit3 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => onDeleteReport(r.id)}
                                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                    title="Delete Report (Administrator Only)"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View (Viewport < 768px) */}
            <div className="block md:hidden divide-y divide-slate-200">
              {filteredReports.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500">
                  No inspection or servicing reports match your current filter criteria.
                </div>
              ) : (
                filteredReports.map((r) => {
                  const subCat = classifyServiceSubCategory(r);
                  return (
                    <div key={r.id} className="p-4 space-y-3 bg-white hover:bg-slate-50/60 transition-colors">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-sm text-slate-900">
                              #{r.reportNo}
                            </span>
                            <span className="text-xs text-slate-500 font-mono">
                              {formatDateDDMMYYYY(r.inspectionDate)}
                            </span>
                          </div>
                          <div className="text-xs font-bold text-slate-900 mt-0.5">
                            {r.centerCode} — {r.centerName}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {r.sectorName || getSectorForCenter(r.centerCode).sectorName}
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <div className="text-sm font-bold font-mono text-slate-900">
                            {r.healthScore}%
                          </div>
                          <div className="mt-0.5">
                            {r.readinessStatus === 'Ready' && (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
                                <CheckCircle2 className="w-3.5 h-3.5" /> Ready
                              </span>
                            )}
                            {r.readinessStatus === 'Action Required' && (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700">
                                <AlertTriangle className="w-3.5 h-3.5" /> Action Req
                              </span>
                            )}
                            {r.readinessStatus === 'Critical' && (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-700">
                                <AlertOctagon className="w-3.5 h-3.5" /> Critical
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Tag & Subcategory */}
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="px-2 py-0.5 text-[10px] font-semibold rounded bg-slate-100 text-slate-800">
                          {subCat}
                        </span>
                        {r.replacementParts.length > 0 && (
                          <span className="px-2 py-0.5 text-[10px] font-mono font-semibold rounded bg-emerald-100 text-emerald-800">
                            {r.replacementParts.length} Parts Changed
                          </span>
                        )}
                        {r.formCategory === 'BREAKDOWN_REPORT' && r.breakdownDetails && (
                          <span className="px-2 py-0.5 text-[10px] font-mono font-semibold rounded bg-red-100 text-red-800">
                            {r.breakdownDetails.totalDowntimeHours}h Downtime
                          </span>
                        )}
                      </div>

                      <div className="bg-slate-50 rounded-lg p-2.5 text-xs space-y-1">
                        <div className="flex items-center justify-between text-[11px] text-slate-600">
                          <span className="font-semibold text-slate-800">
                            {r.generatorId} · {r.gensetModel} ({r.kvaRating})
                          </span>
                          <span className="font-mono font-medium">{r.parameters.runningHours}h</span>
                        </div>
                        <div className="text-[11px] text-slate-700">
                          <strong>Work:</strong> {r.jobRequestType || 'Routine Maintenance'}
                        </div>
                        {r.correctedActions && (
                          <div className="text-[11px] text-slate-500 font-myanmar">
                            {r.correctedActions}
                          </div>
                        )}
                        <div className="text-[11px] text-slate-500 flex items-center justify-between pt-1 border-t border-slate-200">
                          <span>Engineer: <strong>{r.inspectorName}</strong></span>
                          <span className="font-mono">{r.parameters.engineOilPressureBar.toFixed(2)} Bar</span>
                        </div>
                      </div>

                      {/* Mobile Card Action Buttons */}
                      <div className="flex items-center justify-between pt-1">
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => downloadReportAsPdfFile(r)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-300 rounded-lg min-h-[38px]"
                          >
                            <Download className="w-3.5 h-3.5" />
                            PDF
                          </button>
                          <button
                            type="button"
                            onClick={() => onViewReportPdf(r)}
                            className="inline-flex items-center gap-1 px-3.5 py-1.5 text-xs font-semibold text-white bg-slate-900 rounded-lg min-h-[38px]"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            View
                          </button>
                        </div>
                        {isAdmin && (
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => onEditReport(r)}
                              className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg min-h-[38px] min-w-[38px] flex items-center justify-center border border-slate-200"
                              title="Edit Report"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onDeleteReport(r.id)}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg min-h-[38px] min-w-[38px] flex items-center justify-center border border-slate-200"
                              title="Delete Report"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
    </div>
  );
};
