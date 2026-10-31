import React, { useState, useMemo } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  Clock,
  Wrench,
  Search,
  Printer,
  Download,
  FileSpreadsheet,
  Calendar,
  Building2,
  UserCheck,
  RotateCcw,
} from 'lucide-react';
import {
  Center,
  GeneratorAsset,
  InspectionReport,
  RectifiedByTeam,
  ActivityActionStatus,
  UserRole,
} from '../types';
import {
  extractErrorAndActionActivities,
  ActivityItemRecord,
  formatDateDDMMYYYY,
  computeResolutionDuration,
  exportSpecializedReportToExcel,
  downloadSpecializedSummaryPdf,
} from '../utils/exportUtils';

interface ActivitiesModuleProps {
  reports: InspectionReport[];
  centers: Center[];
  generators: GeneratorAsset[];
  currentUserRole: UserRole;
  onUpdateReportActivity: (
    reportId: string,
    updates: {
      activityStatus: ActivityActionStatus;
      rectifiedBy: RectifiedByTeam;
      completedDate: string;
      rectificationNote: string;
    }
  ) => void;
  onOpenReportPdf: (report: InspectionReport) => void;
}

export const ActivitiesModule: React.FC<ActivitiesModuleProps> = ({
  reports,
  centers,
  generators,
  currentUserRole,
  onUpdateReportActivity,
  onOpenReportPdf,
}) => {
  const canEdit =
    currentUserRole === 'Administrator' ||
    currentUserRole === 'Chief Engineer' ||
    currentUserRole === 'Field Engineer';

  const [statusFilter, setStatusFilter] = useState<'ALL' | 'OPEN' | 'COMPLETED'>('ALL');
  const [teamFilter, setTeamFilter] = useState<'ALL' | RectifiedByTeam>('ALL');
  const [centerFilter, setCenterFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Per-row local draft state for Team ('Generator Team' | 'Vendor'), Completed Date, and Note
  const [rowDrafts, setRowDrafts] = useState<
    Record<
      string,
      {
        rectifiedBy: RectifiedByTeam;
        completedDate: string;
        rectificationNote: string;
      }
    >
  >({});

  const allActivities = useMemo(
    () => extractErrorAndActionActivities(reports),
    [reports]
  );

  const filteredActivities = useMemo(() => {
    return allActivities.filter((act) => {
      if (statusFilter === 'OPEN' && act.activityStatus === 'Completed') return false;
      if (statusFilter === 'COMPLETED' && act.activityStatus !== 'Completed') return false;
      if (teamFilter !== 'ALL' && act.rectifiedBy !== teamFilter) return false;
      if (centerFilter !== 'ALL' && act.centerId !== centerFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const match =
          act.reportNo.toLowerCase().includes(q) ||
          act.centerCode.toLowerCase().includes(q) ||
          act.centerName.toLowerCase().includes(q) ||
          act.inspectorName.toLowerCase().includes(q) ||
          act.errorDescription.toLowerCase().includes(q) ||
          act.actionRequiredSummary.toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [allActivities, statusFilter, teamFilter, centerFilter, searchQuery]);

  // Summary KPIs
  const summaryStats = useMemo(() => {
    const total = allActivities.length;
    const completedList = allActivities.filter((a) => a.activityStatus === 'Completed');
    const openList = allActivities.filter((a) => a.activityStatus !== 'Completed');
    const completionRate =
      total > 0 ? Math.round((completedList.length / total) * 100) : 100;

    const genTeamCount = completedList.filter(
      (a) => a.rectifiedBy === 'Generator Team'
    ).length;
    const vendorCount = completedList.filter((a) => a.rectifiedBy === 'Vendor').length;

    const totalHours = completedList.reduce(
      (acc, a) => acc + (a.resolutionDurationHours || 0),
      0
    );
    const avgHours =
      completedList.length > 0
        ? Number((totalHours / completedList.length).toFixed(1))
        : 0;
    const avgDays = Number((avgHours / 24).toFixed(1));

    return {
      total,
      completedCount: completedList.length,
      openCount: openList.length,
      completionRate,
      genTeamCount,
      vendorCount,
      avgHours,
      avgDays,
    };
  }, [allActivities]);

  const getDraftForActivity = (act: ActivityItemRecord) => {
    const existing = rowDrafts[act.reportId];
    if (existing) return existing;
    const defaultDate =
      act.completedDate || new Date().toISOString().slice(0, 10);
    return {
      rectifiedBy: act.rectifiedBy || 'Generator Team',
      completedDate: defaultDate,
      rectificationNote: act.rectificationNote || '',
    };
  };

  const updateRowDraft = (
    reportId: string,
    act: ActivityItemRecord,
    patch: Partial<{
      rectifiedBy: RectifiedByTeam;
      completedDate: string;
      rectificationNote: string;
    }>
  ) => {
    const base = getDraftForActivity(act);
    setRowDrafts((prev) => ({
      ...prev,
      [reportId]: {
        ...base,
        ...patch,
      },
    }));
  };

  const handleMarkComplete = (act: ActivityItemRecord) => {
    if (!canEdit) return;
    const draft = getDraftForActivity(act);
    const finalDate =
      draft.completedDate || new Date().toISOString().slice(0, 10);
    const dur = computeResolutionDuration(act.inspectionDate, finalDate);
    onUpdateReportActivity(act.reportId, {
      activityStatus: 'Completed',
      rectifiedBy: draft.rectifiedBy,
      completedDate: finalDate,
      rectificationNote:
        draft.rectificationNote ||
        `Rectified & completed by ${draft.rectifiedBy} on ${formatDateDDMMYYYY(
          finalDate
        )}.`,
    });
    setToastMessage(
      `Activity for Report #${act.reportNo} (${act.centerCode}) marked Completed by ${
        draft.rectifiedBy
      } on ${formatDateDDMMYYYY(finalDate)} — Duration: ${dur.label}.`
    );
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleReopenActivity = (act: ActivityItemRecord) => {
    if (!canEdit) return;
    const draft = getDraftForActivity(act);
    onUpdateReportActivity(act.reportId, {
      activityStatus: 'Open',
      rectifiedBy: draft.rectifiedBy,
      completedDate: '',
      rectificationNote: draft.rectificationNote,
    });
    setToastMessage(
      `Activity for Report #${act.reportNo} (${act.centerCode}) reopened as Action Required.`
    );
    setTimeout(() => setToastMessage(null), 3500);
  };

  return (
    <div className="space-y-6">
      {/* =====================================================================
          HEADER & EXPORT TOOLBAR
         ===================================================================== */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-0.5">
            <span>Gen SOP-002 Corrective Action & Error Rectification Tracker</span>
            <span aria-hidden="true">·</span>
            <span className="font-semibold text-slate-700">
              Service Engineer Findings & Action Required Log
            </span>
          </div>
          <h2 className="text-lg font-bold text-slate-900">
            Generator Service Activities — Error Findings, Action Required & Completion Tracker
          </h2>
          <p className="text-xs text-slate-500 font-myanmar mt-0.5">
            Service Engineer Report များမှ တွေ့ရှိချက် (Errors Found) နှင့် Action Required များကို Generator Team သို့မဟုတ် Vendor ဖြင့် အမှန်တကယ် ပြီးစီးသည့်ရက်စွဲ (Completed Date) ထည့်သွင်း၍ Complete သတ်မှတ်နိုင်ပါသည်။
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() =>
              downloadSpecializedSummaryPdf(
                'BREAKDOWN_COMPLETION_ANALYTICS',
                reports,
                centers,
                generators,
                '',
                '',
                centerFilter === 'ALL' ? 'All Centers' : centerFilter
              )
            }
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-300 hover:bg-emerald-100 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            Download Activities PDF (.pdf)
          </button>

          <button
            type="button"
            onClick={() =>
              exportSpecializedReportToExcel(
                'BREAKDOWN_COMPLETION_ANALYTICS',
                reports,
                centers,
                generators,
                'xlsx'
              )
            }
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-800 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />
            Export Excel (.xlsx)
          </button>
        </div>
      </div>

      {toastMessage && (
        <div className="bg-emerald-50 border border-emerald-300 text-emerald-950 px-4 py-3 rounded-lg text-xs font-medium flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
            <span>{toastMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="text-emerald-800 hover:text-emerald-950 font-semibold ml-4"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* =====================================================================
          4 KPI SUMMARY CARDS FOR ACTIVITIES & RESOLUTION DURATION
         ===================================================================== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="text-xs font-medium text-slate-500">
            Total Error & Action Required Items
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1">
            {summaryStats.total}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {summaryStats.openCount} Open Action Required · {summaryStats.completedCount} Completed
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="text-xs font-medium text-slate-500">
            Action & Breakdown Completion Rate
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-emerald-700 mt-1">
            {summaryStats.completionRate}%
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {summaryStats.completedCount} of {summaryStats.total} findings rectified & verified
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="text-xs font-medium text-slate-500">
            Average Resolution Duration Time
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1">
            {summaryStats.avgHours} hrs
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Avg {summaryStats.avgDays} Days from report date to actual completion
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="text-xs font-medium text-slate-500">
            Rectified By (Generator Team vs Vendor)
          </div>
          <div className="text-xl font-bold font-mono tabular-nums text-slate-900 mt-1">
            {summaryStats.genTeamCount} Team · {summaryStats.vendorCount} Vendor
          </div>
          <div className="text-xs text-slate-500 mt-1">
            In-house Generator Team vs External Vendor execution
          </div>
        </div>
      </div>

      {/* =====================================================================
          FILTER & SEARCH BAR
         ===================================================================== */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* Status Segmented Control */}
          <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg text-xs">
            <button
              type="button"
              onClick={() => setStatusFilter('ALL')}
              className={`px-3 py-1.5 font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                statusFilter === 'ALL'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All Activities ({summaryStats.total})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('OPEN')}
              className={`px-3 py-1.5 font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                statusFilter === 'OPEN'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'text-amber-800 hover:bg-white/60'
              }`}
            >
              Open / Action Required ({summaryStats.openCount})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('COMPLETED')}
              className={`px-3 py-1.5 font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                statusFilter === 'COMPLETED'
                  ? 'bg-emerald-700 text-white shadow-xs'
                  : 'text-emerald-800 hover:bg-white/60'
              }`}
            >
              Completed ({summaryStats.completedCount})
            </button>
          </div>

          {/* Rectified By Team Filter */}
          <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg text-xs">
            <button
              type="button"
              onClick={() => setTeamFilter('ALL')}
              className={`px-2.5 py-1.5 font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                teamFilter === 'ALL'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All Teams
            </button>
            <button
              type="button"
              onClick={() => setTeamFilter('Generator Team')}
              className={`px-2.5 py-1.5 font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                teamFilter === 'Generator Team'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Generator Team
            </button>
            <button
              type="button"
              onClick={() => setTeamFilter('Vendor')}
              className={`px-2.5 py-1.5 font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                teamFilter === 'Vendor'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Vendor
            </button>
          </div>

          {/* Center Filter */}
          <select
            value={centerFilter}
            onChange={(e) => setCenterFilter(e.target.value)}
            className="px-3 py-1.5 text-xs font-semibold border border-slate-300 rounded-lg bg-white"
          >
            <option value="ALL">All Centers ({centers.length})</option>
            {centers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.centerCode} — {c.centerName}
              </option>
            ))}
          </select>
        </div>

        <div className="relative min-w-[260px]">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search center, engineer, error description..."
            className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
          />
        </div>
      </div>

      {/* =====================================================================
          ACTIVITIES TABLE & MOBILE CARDS: DATE, CENTER, ENGINEER, ERROR, STATUS & ACTION
         ===================================================================== */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        {/* Desktop Table View (>= 768px) */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
              <tr>
                <th className="px-4 py-3 text-left">Date & Report #</th>
                <th className="px-4 py-3 text-left">Center Name & Generator</th>
                <th className="px-4 py-3 text-left">Engineer Name</th>
                <th className="px-4 py-3 text-left">
                  Error Description & Action Required (တွေ့ရှိချက်များ)
                </th>
                <th className="px-4 py-3 text-left">Status & Duration</th>
                <th className="px-4 py-3 text-left min-w-[340px]">
                  Action Tab (Generator Team / Vendor · Actual Completed Date · Complete)
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredActivities.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                    No error findings or action required items match the current filter.
                  </td>
                </tr>
              ) : (
                filteredActivities.map((act) => {
                  const draft = getDraftForActivity(act);
                  const parentReport = reports.find((r) => r.id === act.reportId);
                  const previewDuration = computeResolutionDuration(
                    act.inspectionDate,
                    draft.completedDate || undefined,
                    parentReport?.breakdownDetails?.totalDowntimeHours
                  );

                  return (
                    <tr
                      key={act.reportId}
                      className={`transition-colors ${
                        act.activityStatus === 'Completed'
                          ? 'bg-emerald-50/20 hover:bg-emerald-50/40'
                          : 'hover:bg-slate-50/80'
                      }`}
                    >
                      {/* 1. Date & Report # */}
                      <td className="px-4 py-3.5 align-top whitespace-nowrap">
                        <div className="font-mono font-bold text-slate-900">
                          {formatDateDDMMYYYY(act.inspectionDate)}
                        </div>
                        <div className="text-[11px] font-mono text-slate-500 mt-0.5">
                          Report #{act.reportNo}
                        </div>
                        <span
                          className={`inline-block mt-1 px-1.5 py-0.5 text-[10px] font-semibold rounded ${
                            act.isBreakdown
                              ? 'bg-red-100 text-red-800'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {act.serviceSubCategory}
                        </span>
                      </td>

                      {/* 2. Center Name */}
                      <td className="px-4 py-3.5 align-top">
                        <div className="font-bold text-slate-900">
                          {act.centerCode} — {act.centerName}
                        </div>
                        <div className="text-[11px] font-mono text-slate-600 mt-0.5">
                          {act.generatorId} ({act.kvaRating} · {act.gensetModel})
                        </div>
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          {act.sectorName}
                        </div>
                      </td>

                      {/* 3. Engineer Name */}
                      <td className="px-4 py-3.5 align-top whitespace-nowrap">
                        <div className="font-semibold text-slate-900">
                          {act.inspectorName}
                        </div>
                        <div className="text-[11px] font-mono text-slate-500">
                          {act.inspectorEmail}
                        </div>
                      </td>

                      {/* 4. Error Description & Action Required */}
                      <td className="px-4 py-3.5 align-top max-w-[330px]">
                        <div className="font-semibold text-slate-900 font-myanmar leading-snug">
                          {act.errorDescription}
                        </div>
                        <div className="text-[11px] text-slate-600 mt-1 font-myanmar">
                          <span className="font-semibold text-slate-700">Action Required: </span>
                          {act.actionRequiredSummary}
                        </div>
                        {act.rectificationNote && act.activityStatus === 'Completed' && (
                          <div className="text-[11px] text-emerald-800 bg-emerald-50 border border-emerald-200 rounded px-2 py-1 mt-1.5 font-myanmar">
                            <strong>Rectification Note:</strong> {act.rectificationNote}
                          </div>
                        )}
                      </td>

                      {/* 5. Status & Duration */}
                      <td className="px-4 py-3.5 align-top whitespace-nowrap">
                        {act.activityStatus === 'Completed' ? (
                          <div className="space-y-1">
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold bg-emerald-100 text-emerald-800 rounded">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Complete
                            </span>
                            <div className="text-[11px] font-mono text-slate-700">
                              By: <strong>{act.rectifiedBy}</strong>
                            </div>
                            <div className="text-[11px] font-mono text-slate-600">
                              Done: {formatDateDDMMYYYY(act.completedDate)}
                            </div>
                            <div className="inline-flex items-center gap-1 text-[11px] font-mono font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
                              <Clock className="w-3 h-3" />
                              {act.resolutionDurationLabel}
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-1">
                            {act.readinessStatus === 'Critical' ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold bg-red-100 text-red-800 rounded">
                                <AlertOctagon className="w-3.5 h-3.5" />
                                Critical · Action Required
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold bg-amber-100 text-amber-900 rounded">
                                <AlertTriangle className="w-3.5 h-3.5" />
                                Action Required (Open)
                              </span>
                            )}
                            <div className="text-[11px] text-slate-500">
                              Est. Duration if completed on{' '}
                              {formatDateDDMMYYYY(draft.completedDate)}:
                            </div>
                            <div className="text-[11px] font-mono font-semibold text-slate-800">
                              {previewDuration.label}
                            </div>
                          </div>
                        )}
                      </td>

                      {/* 6. Action Tab */}
                      <td className="px-4 py-3.5 align-top">
                        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2.5">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                                Rectified By (Team / Vendor)
                              </label>
                              <select
                                disabled={!canEdit}
                                value={draft.rectifiedBy}
                                onChange={(e) =>
                                  updateRowDraft(act.reportId, act, {
                                    rectifiedBy: e.target.value as RectifiedByTeam,
                                  })
                                }
                                className="w-full px-2.5 py-1.5 text-xs font-semibold border border-slate-300 rounded bg-white text-slate-900"
                              >
                                <option value="Generator Team">Generator Team</option>
                                <option value="Vendor">Vendor (External)</option>
                              </select>
                            </div>

                            <div>
                              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                                Actual Completed Date
                              </label>
                              <input
                                type="date"
                                disabled={!canEdit}
                                value={draft.completedDate}
                                min={act.inspectionDate}
                                onChange={(e) =>
                                  updateRowDraft(act.reportId, act, {
                                    completedDate: e.target.value,
                                  })
                                }
                                className="w-full px-2.5 py-1.5 text-xs font-mono font-semibold border border-slate-300 rounded bg-white text-slate-900"
                              />
                            </div>
                          </div>

                          <div>
                            <input
                              type="text"
                              disabled={!canEdit}
                              value={draft.rectificationNote}
                              onChange={(e) =>
                                updateRowDraft(act.reportId, act, {
                                    rectificationNote: e.target.value,
                                })
                              }
                              placeholder="Enter rectification remark (ပြုပြင်ပြီးစီးမှု မှတ်ချက်)..."
                              className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded bg-white text-slate-800 font-myanmar"
                            />
                          </div>

                          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                            <div className="flex items-center gap-1.5">
                              {act.activityStatus !== 'Completed' ? (
                                <button
                                  type="button"
                                  disabled={!canEdit}
                                  onClick={() => handleMarkComplete(act)}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded transition-colors disabled:opacity-50"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  Mark Complete
                                </button>
                              ) : (
                                <>
                                  <button
                                    type="button"
                                    disabled={!canEdit}
                                    onClick={() => handleMarkComplete(act)}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-emerald-900 bg-emerald-100 hover:bg-emerald-200 rounded transition-colors disabled:opacity-50"
                                  >
                                    <CheckCircle2 className="w-3 h-3" />
                                    Update Completed Info
                                  </button>
                                  <button
                                    type="button"
                                    disabled={!canEdit}
                                    onClick={() => handleReopenActivity(act)}
                                    className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded transition-colors"
                                    title="Reopen as Action Required"
                                  >
                                    <RotateCcw className="w-3 h-3" />
                                    Reopen
                                  </button>
                                </>
                              )}
                            </div>

                            {parentReport && (
                              <button
                                type="button"
                                onClick={() => onOpenReportPdf(parentReport)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-slate-800 bg-white border border-slate-300 hover:bg-slate-100 rounded transition-colors"
                              >
                                <Printer className="w-3 h-3" />
                                Report PDF
                              </button>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Cards View (< 768px) */}
        <div className="block md:hidden divide-y divide-slate-200">
          {filteredActivities.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">
              No error findings or action required items match the current filter.
            </div>
          ) : (
            filteredActivities.map((act) => {
              const draft = getDraftForActivity(act);
              const parentReport = reports.find((r) => r.id === act.reportId);
              const previewDuration = computeResolutionDuration(
                act.inspectionDate,
                draft.completedDate || undefined,
                parentReport?.breakdownDetails?.totalDowntimeHours
              );

              return (
                <div
                  key={act.reportId}
                  className={`p-4 space-y-3 ${
                    act.activityStatus === 'Completed' ? 'bg-emerald-50/20' : 'bg-white'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-sm text-slate-900">
                          #{act.reportNo}
                        </span>
                        <span className="text-xs text-slate-500 font-mono">
                          {formatDateDDMMYYYY(act.inspectionDate)}
                        </span>
                      </div>
                      <div className="text-xs font-bold text-slate-900 mt-0.5">
                        {act.centerCode} — {act.centerName}
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono">
                        {act.generatorId} ({act.kvaRating}) · {act.sectorName}
                      </div>
                    </div>

                    <div className="shrink-0">
                      {act.activityStatus === 'Completed' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold bg-emerald-100 text-emerald-800 rounded">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Complete
                        </span>
                      ) : act.readinessStatus === 'Critical' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold bg-red-100 text-red-800 rounded">
                          <AlertOctagon className="w-3.5 h-3.5" /> Critical
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold bg-amber-100 text-amber-900 rounded">
                          <AlertTriangle className="w-3.5 h-3.5" /> Action Req
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Error Description & Action Required */}
                  <div className="bg-slate-50 rounded-lg p-3 text-xs space-y-1.5 border border-slate-200">
                    <div className="font-bold text-slate-900 font-myanmar">
                      {act.errorDescription}
                    </div>
                    <div className="text-slate-600 font-myanmar text-[11px]">
                      <span className="font-semibold text-slate-700">Action: </span>
                      {act.actionRequiredSummary}
                    </div>
                    {act.rectificationNote && act.activityStatus === 'Completed' && (
                      <div className="text-emerald-800 bg-emerald-50 border border-emerald-200 rounded p-1.5 font-myanmar text-[11px]">
                        <strong>Note:</strong> {act.rectificationNote}
                      </div>
                    )}
                    <div className="flex items-center justify-between pt-1 border-t border-slate-200 text-[11px] text-slate-500">
                      <span>Eng: <strong>{act.inspectorName}</strong></span>
                      <span className="font-mono text-emerald-800 font-semibold">
                        {act.activityStatus === 'Completed'
                          ? act.resolutionDurationLabel
                          : `Est: ${previewDuration.label}`}
                      </span>
                    </div>
                  </div>

                  {/* Mobile Action Resolution Box */}
                  <div className="bg-white border border-slate-200 rounded-lg p-3 space-y-2.5">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] font-bold uppercase text-slate-600 mb-1">
                          Team / Vendor
                        </label>
                        <select
                          disabled={!canEdit}
                          value={draft.rectifiedBy}
                          onChange={(e) =>
                            updateRowDraft(act.reportId, act, {
                              rectifiedBy: e.target.value as RectifiedByTeam,
                            })
                          }
                          className="w-full px-2.5 py-2 text-xs font-semibold border border-slate-300 rounded-lg bg-white min-h-[40px]"
                        >
                          <option value="Generator Team">Gen Team</option>
                          <option value="Vendor">Vendor</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold uppercase text-slate-600 mb-1">
                          Completed Date
                        </label>
                        <input
                          type="date"
                          disabled={!canEdit}
                          value={draft.completedDate}
                          min={act.inspectionDate}
                          onChange={(e) =>
                            updateRowDraft(act.reportId, act, {
                              completedDate: e.target.value,
                            })
                          }
                          className="w-full px-2.5 py-2 text-xs font-mono font-semibold border border-slate-300 rounded-lg bg-white min-h-[40px]"
                        />
                      </div>
                    </div>

                    <input
                      type="text"
                      disabled={!canEdit}
                      value={draft.rectificationNote}
                      onChange={(e) =>
                        updateRowDraft(act.reportId, act, {
                          rectificationNote: e.target.value,
                        })
                      }
                      placeholder="Rectification note (ပြုပြင်ပြီးစီးမှု မှတ်ချက်)..."
                      className="w-full px-2.5 py-2 text-xs border border-slate-300 rounded-lg bg-white font-myanmar min-h-[40px]"
                    />

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                      {act.activityStatus !== 'Completed' ? (
                        <button
                          type="button"
                          disabled={!canEdit}
                          onClick={() => handleMarkComplete(act)}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg min-h-[40px]"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          Mark Complete
                        </button>
                      ) : (
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            disabled={!canEdit}
                            onClick={() => handleMarkComplete(act)}
                            className="inline-flex items-center gap-1 px-3 py-2 text-xs font-semibold text-emerald-900 bg-emerald-100 rounded-lg min-h-[40px]"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Update
                          </button>
                          <button
                            type="button"
                            disabled={!canEdit}
                            onClick={() => handleReopenActivity(act)}
                            className="inline-flex items-center gap-1 px-2.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg min-h-[40px]"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            Reopen
                          </button>
                        </div>
                      )}

                      {parentReport && (
                        <button
                          type="button"
                          onClick={() => onOpenReportPdf(parentReport)}
                          className="inline-flex items-center gap-1 px-3 py-2 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg min-h-[40px]"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          PDF
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
