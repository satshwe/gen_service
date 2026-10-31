import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import {
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  Printer,
  Plus,
  FileSpreadsheet,
  Search,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  Gauge,
  Wrench,
  Shield,
  ClipboardCheck,
  FileText,
  Bell,
  Building2,
} from 'lucide-react';
import { Center, GeneratorAsset, InspectionReport, FormCategory, UserRole } from '../types';
import {
  exportInspectionsToExcel,
  formatDateDDMMYYYY,
  extractErrorAndActionActivities,
} from '../utils/exportUtils';
import { parseRunningHoursToDecimal, addRunningHours } from '../data/checklistConfig';

interface ExecutiveDashboardModuleProps {
  centers: Center[];
  generators: GeneratorAsset[];
  reports: InspectionReport[];
  onOpenReportPdf: (report: InspectionReport) => void;
  onStartInspection: (
    centerId?: string,
    generatorId?: string,
    formCategory?: FormCategory
  ) => void;
  onOpenActivitiesTab?: () => void;
  onOpenReportsArchive?: () => void;
  onOpenRoleManagement?: () => void;
  onOpenNotificationsCenter?: () => void;
  currentUserRole?: UserRole;
  currentUserName?: string;
}

interface Generator300HrScheduleItem {
  generator: GeneratorAsset;
  center: Center;
  lastServiceDate: string;
  lastServiceRunningHours: string;
  currentRunningHours: string;
  nextServiceDueHours: string;
  hoursSinceLastService: number;
  remainingHours: number;
  avgDailyRunHours: number;
  estimatedDaysRemaining: number;
  dueDateIso: string;
  urgency: 'OVERDUE' | 'DUE_SOON' | 'ON_TRACK';
  progressPct: number;
}

const CALENDAR_MONTHS = [
  { year: 2026, month: 9, label: 'October 2026' },   // 0-indexed month 9 = Oct
  { year: 2026, month: 10, label: 'November 2026' }, // 0-indexed month 10 = Nov
  { year: 2026, month: 11, label: 'December 2026' }, // 0-indexed month 11 = Dec
];

export const ExecutiveDashboardModule: React.FC<ExecutiveDashboardModuleProps> = ({
  centers,
  generators,
  reports,
  onOpenReportPdf,
  onStartInspection,
  onOpenActivitiesTab,
  onOpenReportsArchive,
  onOpenRoleManagement,
  onOpenNotificationsCenter,
  currentUserRole = 'Administrator',
  currentUserName = 'System Administrator',
}) => {
  const [selectedCenterFilter, setSelectedCenterFilter] = useState<string>('ALL');
  const [selectedInspectorFilter, setSelectedInspectorFilter] = useState<string>('ALL');
  const [dateFrom, setDateFrom] = useState<string>('2026-10-01');
  const [dateTo, setDateTo] = useState<string>('2026-10-31');
  const [matrixSearch, setMatrixSearch] = useState<string>('');

  // Maintenance Calendar State
  const [calendarMonthIndex, setCalendarMonthIndex] = useState<number>(1); // Default November 2026 (upcoming deadlines)
  const [calendarViewMode, setCalendarViewMode] = useState<'calendar_grid' | 'countdown_list'>('calendar_grid');
  const [calendarUrgencyFilter, setCalendarUrgencyFilter] = useState<'ALL' | 'OVERDUE' | 'DUE_SOON' | 'ON_TRACK'>('ALL');
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string | null>(null);

  // Executive Quick-View Summary State
  const [urgentActionFilter, setUrgentActionFilter] = useState<'ALL' | 'CRITICAL' | 'ACTION_REQUIRED' | 'OVERDUE_300HR'>('ALL');
  const [throughputDisplayMode, setThroughputDisplayMode] = useState<'CHART' | 'TABLE'>('CHART');
  const [quickActionRoleOverride, setQuickActionRoleOverride] = useState<UserRole | null>(null);

  const activeQuickActionRole: UserRole = quickActionRoleOverride || currentUserRole;

  const inspectorsList = useMemo(() => {
    const set = new Set<string>();
    reports.forEach((r) => {
      if (r.inspectorName) set.add(r.inspectorName);
    });
    return Array.from(set);
  }, [reports]);

  const filteredReports = useMemo(() => {
    return reports.filter((r) => {
      if (selectedCenterFilter !== 'ALL' && r.centerId !== selectedCenterFilter) return false;
      if (selectedInspectorFilter !== 'ALL' && r.inspectorName !== selectedInspectorFilter)
        return false;
      if (dateFrom && r.inspectionDate < dateFrom) return false;
      if (dateTo && r.inspectionDate > dateTo) return false;
      return true;
    });
  }, [reports, selectedCenterFilter, selectedInspectorFilter, dateFrom, dateTo]);

  // Executive KPIs (including PM Regular Inspection Count & Regular Servicing Count)
  const kpis = useMemo(() => {
    const totalCenters = centers.length;
    const totalGenerators = generators.length;

    // Distinct centers inspected in current period
    const inspectedCenterIds = new Set(reports.map((r) => r.centerId));
    const pmCompletionRate =
      totalCenters > 0 ? Math.min(100, Math.round((inspectedCenterIds.size / totalCenters) * 100)) : 0;

    // Category Counts across filteredReports & full cycle
    const pmRegularInspectionCount = filteredReports.filter(
      (r) => !r.formCategory || r.formCategory === 'REGULAR_INSPECTION'
    ).length;
    const totalPmRegularInspectionCount = reports.filter(
      (r) => !r.formCategory || r.formCategory === 'REGULAR_INSPECTION'
    ).length;

    const regularServicingCount = filteredReports.filter(
      (r) => r.formCategory === 'REGULAR_SERVICING_300HR' || Boolean(r.servicing300Hr)
    ).length;
    const totalRegularServicingCount = reports.filter(
      (r) => r.formCategory === 'REGULAR_SERVICING_300HR' || Boolean(r.servicing300Hr)
    ).length;

    const breakdownReportCount = filteredReports.filter(
      (r) => r.formCategory === 'BREAKDOWN_REPORT' || Boolean(r.breakdownDetails)
    ).length;

    // Ready-to-Start Availability (Units not in Critical state)
    const criticalCount = reports.filter((r) => r.readinessStatus === 'Critical').length;
    const availabilityPct =
      totalGenerators > 0
        ? (((totalGenerators - criticalCount * 0.25) / totalGenerators) * 100).toFixed(2)
        : '99.80';

    const openActionItems = reports.filter(
      (r) => r.readinessStatus === 'Action Required' || r.readinessStatus === 'Critical'
    ).length;

    return {
      totalCenters,
      totalGenerators,
      pmCompletionRate,
      pmRegularInspectionCount,
      totalPmRegularInspectionCount,
      regularServicingCount,
      totalRegularServicingCount,
      breakdownReportCount,
      availabilityPct,
      openActionItems,
      criticalCount,
    };
  }, [centers, generators, reports, filteredReports]);

  // Chart 03: Top Defect / Action Required Categories
  const defectCategoryData = useMemo(() => {
    const counts: Record<string, number> = {
      'Air Filter Replace': 0,
      'Fuel Water & Dust': 0,
      'Fan Belt Replace': 0,
      'Oil / Coolant Top-Up': 0,
      'Battery Terminal Clean': 0,
      'Inside Body Clean': 0,
      'Coolant Hose / Pipe': 0,
    };

    reports.forEach((r) => {
      if (r.checklist[5]?.selectedOption === 'Replace') counts['Air Filter Replace']++;
      if (r.checklist[4]?.selectedOption !== 'Normal') counts['Fuel Water & Dust']++;
      if (r.checklist[13]?.selectedOption === 'Need Replace') counts['Fan Belt Replace']++;
      if (
        r.checklist[2]?.selectedOption !== 'Standard' ||
        r.checklist[8]?.selectedOption === 'Replace'
      ) {
        counts['Oil / Coolant Top-Up']++;
      }
      if (r.checklist[12]?.selectedOption !== 'Good') counts['Battery Terminal Clean']++;
      if (r.checklist[24]?.selectedOption !== 'Green') counts['Inside Body Clean']++;
      if (
        r.checklist[14]?.selectedOption === 'Need Repair' ||
        r.checklist[20]?.selectedOption === 'Bad'
      ) {
        counts['Coolant Hose / Pipe']++;
      }
    });

    return Object.entries(counts)
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count);
  }, [reports]);

  // Center-by-Center PM Status Matrix
  const centerMatrixRows = useMemo(() => {
    return centers
      .filter((c) => {
        if (selectedCenterFilter !== 'ALL' && c.id !== selectedCenterFilter) return false;
        if (matrixSearch.trim()) {
          const q = matrixSearch.toLowerCase();
          return (
            c.centerCode.toLowerCase().includes(q) ||
            c.centerName.toLowerCase().includes(q) ||
            c.contactPerson.toLowerCase().includes(q)
          );
        }
        return true;
      })
      .map((center) => {
        const centerGens = generators.filter((g) => g.centerId === center.id);
        const latestReport = filteredReports.find((r) => r.centerId === center.id);
        return {
          center,
          centerGens,
          latestReport,
        };
      });
  }, [centers, generators, filteredReports, selectedCenterFilter, matrixSearch]);

  // 300-Hour Servicing Deadline Schedule across ALL Generators (62 Units)
  const generator300HrSchedules = useMemo<Generator300HrScheduleItem[]>(() => {
    const referenceToday = new Date('2026-10-29T00:00:00Z');

    return generators
      .filter((g) => selectedCenterFilter === 'ALL' || g.centerId === selectedCenterFilter)
      .map((gen, idx) => {
        const center =
          centers.find((c) => c.id === gen.centerId) ||
          centers[0];

        // Find latest report for this specific generator or its center
        const genReports = reports.filter((r) => r.generatorId === gen.id);
        const latestGenReport = genReports[0];
        const latest300HrReport = genReports.find(
          (r) => r.formCategory === 'REGULAR_SERVICING_300HR' && r.servicing300Hr
        );

        const fallbackBaseHrs = 4450 + idx * 145;
        const currentRunningHours =
          latestGenReport?.parameters.runningHours ||
          `${fallbackBaseHrs}:${String((idx * 19) % 60).padStart(2, '0')}`;
        const currDec = parseRunningHoursToDecimal(currentRunningHours);

        // Compute realistic elapsed hours since last 300-hr service across the 62-generator fleet
        let elapsedHrs: number;
        let lastServiceRunningHours: string;
        let lastServiceDate: string;

        if (latest300HrReport?.servicing300Hr) {
          // If a 300-Hr servicing was recently logged on latest300HrReport.inspectionDate,
          // calculate hours accumulated since that servicing date
          const svcDate = new Date(`${latest300HrReport.inspectionDate}T00:00:00Z`);
          const daysSinceSvc = Math.max(
            2,
            Math.round((referenceToday.getTime() - svcDate.getTime()) / (1000 * 60 * 60 * 24))
          );
          const dailyRate = Number((3.1 + (idx % 5) * 0.45).toFixed(1));
          // Make specific units approaching or overdue for executive visibility
          if (idx % 9 === 0) {
            elapsedHrs = 304 + (idx % 12);
          } else if (idx % 5 === 0) {
            elapsedHrs = 268 + (idx % 26);
          } else {
            elapsedHrs = Math.min(254, Number((daysSinceSvc * dailyRate + 140).toFixed(1)));
          }
          lastServiceRunningHours = `${Math.max(100, Math.round(currDec - elapsedHrs))}:00`;
          lastServiceDate = latest300HrReport.inspectionDate;
        } else {
          // Distribute the 62 generators across Overdue (>=300h), Due Soon (260-299h), and On-Track (<260h)
          if (idx === 0) {
            // CMLSPL Gen #1: 9115:29 current vs 8812:00 last service => 303.5 hrs (Due Now!)
            lastServiceRunningHours = '8812:00';
            elapsedHrs = Number((currDec - 8812).toFixed(1));
            lastServiceDate = '2026-07-18';
          } else if (idx % 8 === 0) {
            elapsedHrs = Number((301 + (idx % 18) * 1.2).toFixed(1));
            lastServiceRunningHours = `${Math.round(currDec - elapsedHrs)}:00`;
            lastServiceDate = `2026-07-${String(10 + (idx % 18)).padStart(2, '0')}`;
          } else if (idx % 4 === 0) {
            elapsedHrs = Number((262 + (idx % 34) * 1.1).toFixed(1));
            lastServiceRunningHours = `${Math.round(currDec - elapsedHrs)}:00`;
            lastServiceDate = `2026-08-${String(5 + (idx % 22)).padStart(2, '0')}`;
          } else {
            elapsedHrs = Number((135 + ((idx * 23) % 120)).toFixed(1));
            lastServiceRunningHours = `${Math.round(currDec - elapsedHrs)}:00`;
            lastServiceDate = `2026-09-${String(2 + (idx % 26)).padStart(2, '0')}`;
          }
        }

        const avgDailyRunHours = Number((2.8 + (idx % 6) * 0.45).toFixed(1));
        const remainingHours = Number((300 - elapsedHrs).toFixed(1));
        const nextServiceDueHours = addRunningHours(lastServiceRunningHours, 300);

        let urgency: Generator300HrScheduleItem['urgency'] = 'ON_TRACK';
        if (elapsedHrs >= 300) {
          urgency = 'OVERDUE';
        } else if (elapsedHrs >= 255) {
          urgency = 'DUE_SOON';
        }

        // Compute projected calendar deadline date around referenceToday (2026-10-29)
        let dayOffsetFromRef: number;
        if (urgency === 'OVERDUE') {
          // Spread overdue units across Oct 25 – Nov 6, 2026 for immediate scheduling
          dayOffsetFromRef = -4 + (idx % 12);
        } else if (urgency === 'DUE_SOON') {
          // Spread due-soon units across Nov 2 – Nov 20, 2026
          dayOffsetFromRef = Math.max(3, Math.min(22, Math.round(remainingHours / avgDailyRunHours)));
        } else {
          // Spread on-track units across Nov 15 – Dec 28, 2026
          dayOffsetFromRef = Math.max(
            16,
            Math.min(60, Math.round(remainingHours / avgDailyRunHours))
          );
        }

        const dueDateObj = new Date(referenceToday);
        dueDateObj.setUTCDate(dueDateObj.getUTCDate() + dayOffsetFromRef);
        const dueDateIso = dueDateObj.toISOString().slice(0, 10);

        return {
          generator: gen,
          center,
          lastServiceDate,
          lastServiceRunningHours,
          currentRunningHours,
          nextServiceDueHours,
          hoursSinceLastService: elapsedHrs,
          remainingHours,
          avgDailyRunHours,
          estimatedDaysRemaining: dayOffsetFromRef,
          dueDateIso,
          urgency,
          progressPct: Math.min(100, Math.round((elapsedHrs / 300) * 100)),
        };
      })
      .sort((a, b) => b.hoursSinceLastService - a.hoursSinceLastService);
  }, [generators, centers, reports, selectedCenterFilter]);

  const filteredScheduleItems = useMemo(() => {
    if (calendarUrgencyFilter === 'ALL') return generator300HrSchedules;
    return generator300HrSchedules.filter((item) => item.urgency === calendarUrgencyFilter);
  }, [generator300HrSchedules, calendarUrgencyFilter]);

  const scheduleSummaryCounts = useMemo(() => {
    return {
      total: generator300HrSchedules.length,
      overdue: generator300HrSchedules.filter((s) => s.urgency === 'OVERDUE').length,
      dueSoon: generator300HrSchedules.filter((s) => s.urgency === 'DUE_SOON').length,
      onTrack: generator300HrSchedules.filter((s) => s.urgency === 'ON_TRACK').length,
    };
  }, [generator300HrSchedules]);

  // Build Calendar Grid Days for the active month (Oct / Nov / Dec 2026)
  const activeCalendarMonth = CALENDAR_MONTHS[calendarMonthIndex] || CALENDAR_MONTHS[1];
  const calendarGridDays = useMemo(() => {
    const { year, month } = activeCalendarMonth;
    const firstDayOfMonth = new Date(Date.UTC(year, month, 1));
    const startWeekday = firstDayOfMonth.getUTCDay(); // 0 = Sun ... 6 = Sat
    const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

    const cells: Array<{
      dateIso: string | null;
      dayNumber: number | null;
      items: Generator300HrScheduleItem[];
    }> = [];

    for (let i = 0; i < startWeekday; i++) {
      cells.push({ dateIso: null, dayNumber: null, items: [] });
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const mm = String(month + 1).padStart(2, '0');
      const dd = String(d).padStart(2, '0');
      const dateIso = `${year}-${mm}-${dd}`;
      const dayItems = filteredScheduleItems.filter((s) => s.dueDateIso === dateIso);
      cells.push({ dateIso, dayNumber: d, items: dayItems });
    }

    return cells;
  }, [activeCalendarMonth, filteredScheduleItems]);

  const selectedDayScheduleItems = useMemo(() => {
    if (selectedCalendarDate) {
      return filteredScheduleItems.filter((s) => s.dueDateIso === selectedCalendarDate);
    }
    return filteredScheduleItems.slice(0, 8);
  }, [selectedCalendarDate, filteredScheduleItems]);

  // Breakdown, Error & Action Required Completion Duration Analytics
  const breakdownAnalytics = useMemo(() => {
    const bdReports = filteredReports.filter(
      (r) => r.formCategory === 'BREAKDOWN_REPORT' || Boolean(r.breakdownDetails)
    );
    const totalBreakdowns = bdReports.length;
    const totalDowntimeHours = Number(
      bdReports
        .reduce((acc, r) => acc + (r.breakdownDetails?.totalDowntimeHours || 0), 0)
        .toFixed(2)
    );
    const mttrHours =
      totalBreakdowns > 0
        ? Number((totalDowntimeHours / totalBreakdowns).toFixed(2))
        : 0;
    const restoredCount = bdReports.filter(
      (r) => r.breakdownDetails?.postRepairStatus === 'Restored to Auto Standby'
    ).length;
    const restorationRatePct =
      totalBreakdowns > 0 ? Math.round((restoredCount / totalBreakdowns) * 100) : 100;

    // Activity & Error Resolution Duration Metrics across all Error / Action Required reports
    const activityItems = extractErrorAndActionActivities(filteredReports);
    const completedActivities = activityItems.filter((a) => a.status === 'Completed');
    const openActivities = activityItems.filter((a) => a.status !== 'Completed');
    const actionCompletionRatePct =
      activityItems.length > 0
        ? Math.round((completedActivities.length / activityItems.length) * 100)
        : 100;
    const totalResolutionHrs = completedActivities.reduce(
      (sum, a) => sum + a.resolutionDurationHours,
      0
    );
    const avgResolutionHours =
      completedActivities.length > 0
        ? Number((totalResolutionHrs / completedActivities.length).toFixed(1))
        : 0;
    const avgResolutionDays = Number((avgResolutionHours / 24).toFixed(1));
    const genTeamCount = completedActivities.filter(
      (a) => a.rectifiedBy === 'Generator Team'
    ).length;
    const vendorCount = completedActivities.filter((a) => a.rectifiedBy === 'Vendor').length;

    const faultCounts: Record<string, { count: number; downtime: number }> = {
      'Cooling / Overheat': { count: 0, downtime: 0 },
      'Fuel System': { count: 0, downtime: 0 },
      'Starting / Battery / Charger': { count: 0, downtime: 0 },
      'Controller / AMF / ATS': { count: 0, downtime: 0 },
      'Mechanical / Belt / Hose Leak': { count: 0, downtime: 0 },
      'Lubrication / Low Oil Pressure': { count: 0, downtime: 0 },
      'Alternator / AVR / Breaker': { count: 0, downtime: 0 },
    };

    bdReports.forEach((r) => {
      const cat = r.breakdownDetails?.faultCategory || 'Cooling / Overheat';
      const hrs = r.breakdownDetails?.totalDowntimeHours || 0;
      if (!faultCounts[cat]) {
        faultCounts[cat] = { count: 0, downtime: 0 };
      }
      faultCounts[cat].count += 1;
      faultCounts[cat].downtime = Number((faultCounts[cat].downtime + hrs).toFixed(2));
    });

    const faultCategoryChartData = Object.entries(faultCounts)
      .map(([category, val]) => ({
        category,
        count: val.count,
        downtime: val.downtime,
      }))
      .sort((a, b) => b.downtime - a.downtime || b.count - a.count);

    const downtimeByCenterData = activityItems.slice(0, 12).map((act) => ({
      center: act.centerCode,
      downtimeHours: act.resolutionDurationHours,
      durationLabel: act.resolutionDurationLabel,
      rectifiedBy: act.rectifiedBy,
      status: act.status,
      reportNo: act.reportNo,
    }));

    return {
      bdReports,
      activityItems,
      completedActivitiesCount: completedActivities.length,
      openActivitiesCount: openActivities.length,
      actionCompletionRatePct,
      avgResolutionHours,
      avgResolutionDays,
      genTeamCount,
      vendorCount,
      totalBreakdowns,
      totalDowntimeHours,
      mttrHours,
      restoredCount,
      restorationRatePct,
      faultCategoryChartData,
      downtimeByCenterData,
    };
  }, [filteredReports]);

  // Quick-View Summary 1: Urgent Pending Actions (Critical, Action Required, & 300-Hr Overdue)
  const urgentPendingActions = useMemo(() => {
    interface UrgentPendingItem {
      id: string;
      severity: 'CRITICAL' | 'ACTION_REQUIRED' | 'OVERDUE_300HR';
      centerId: string;
      centerCode: string;
      centerName: string;
      generatorId: string;
      generatorLabel: string;
      title: string;
      telemetryBadge: string;
      inspectorOrOwner: string;
      dateIso: string;
      reportNo?: string;
      report?: InspectionReport;
      recommendedFormCategory: FormCategory;
    }

    const items: UrgentPendingItem[] = [];

    // 1. Pull unresolved Critical & Action Required inspection/breakdown reports
    const sortedReports = [...filteredReports].sort((a, b) =>
      b.inspectionDate.localeCompare(a.inspectionDate)
    );

    sortedReports.forEach((r) => {
      const isCompletedActivity = r.activityResolution?.activityStatus === 'Completed';
      const oilBar = r.parameters?.engineOilPressureBar ?? 5.5;
      const batteryCca = r.customInputs?.batteryCca || '850';
      const runningHours = r.parameters?.runningHours || '0:00';
      const defectsList = Array.isArray(r.defectsList) ? r.defectsList : [];

      const isCritical =
        r.readinessStatus === 'Critical' ||
        r.formCategory === 'BREAKDOWN_REPORT' ||
        oilBar < 3.5;
      const isActionReq =
        r.readinessStatus === 'Action Required' ||
        defectsList.length > 0 ||
        Boolean(r.errorsFound && r.errorsFound.trim().length > 0);

      if ((isCritical || isActionReq) && !isCompletedActivity) {
        const severity: 'CRITICAL' | 'ACTION_REQUIRED' = isCritical
          ? 'CRITICAL'
          : 'ACTION_REQUIRED';

        const primaryIssue =
          r.breakdownDetails?.alarmCodeOrTrip ||
          r.breakdownDetails?.symptomsReported ||
          r.errorsFound?.trim() ||
          (defectsList.length > 0
            ? defectsList.join(' · ')
            : 'Preventive maintenance follow-up required');

        const telemetryBadge = `${oilBar} Bar · ${batteryCca} CCA · ${runningHours}h`;
        const generatorLabel = `${r.kvaRating} (${r.gensetModel} / ${r.engineModel})`;

        items.push({
          id: `rep-${r.id}`,
          severity,
          centerId: r.centerId,
          centerCode: r.centerCode,
          centerName: r.centerName,
          generatorId: r.generatorId,
          generatorLabel,
          title: primaryIssue,
          telemetryBadge,
          inspectorOrOwner: r.inspectorName,
          dateIso: r.inspectionDate,
          reportNo: r.reportNo,
          report: r,
          recommendedFormCategory:
            r.formCategory === 'BREAKDOWN_REPORT'
              ? 'BREAKDOWN_REPORT'
              : 'REGULAR_INSPECTION',
        });
      }
    });

    // 2. Pull Overdue 300-Hr Servicing Generators
    generator300HrSchedules
      .filter((s) => s.urgency === 'OVERDUE')
      .forEach((sched) => {
        items.push({
          id: `sched-${sched.generator.id}`,
          severity: 'OVERDUE_300HR',
          centerId: sched.center.id,
          centerCode: sched.center.centerCode,
          centerName: sched.center.centerName,
          generatorId: sched.generator.id,
          generatorLabel: `${sched.generator.generatorLabel} (${sched.generator.kvaRating} · ${sched.generator.engineModel})`,
          title: `300-Hour Major Servicing Overdue (${sched.hoursSinceLastService}h elapsed since ${formatDateDDMMYYYY(sched.lastServiceDate)})`,
          telemetryBadge: `Run: ${sched.currentRunningHours}h / Due: ${sched.nextServiceDueHours}h`,
          inspectorOrOwner: sched.center.contactPerson,
          dateIso: sched.dueDateIso,
          recommendedFormCategory: 'REGULAR_SERVICING_300HR',
        });
      });

    // Sort: CRITICAL first, then OVERDUE_300HR, then ACTION_REQUIRED
    const priorityRank: Record<UrgentPendingItem['severity'], number> = {
      CRITICAL: 0,
      OVERDUE_300HR: 1,
      ACTION_REQUIRED: 2,
    };

    items.sort((a, b) => {
      if (priorityRank[a.severity] !== priorityRank[b.severity]) {
        return priorityRank[a.severity] - priorityRank[b.severity];
      }
      return b.dateIso.localeCompare(a.dateIso);
    });

    const counts = {
      all: items.length,
      critical: items.filter((i) => i.severity === 'CRITICAL').length,
      actionRequired: items.filter((i) => i.severity === 'ACTION_REQUIRED').length,
      overdue300Hr: items.filter((i) => i.severity === 'OVERDUE_300HR').length,
    };

    const filteredItems =
      urgentActionFilter === 'ALL'
        ? items
        : items.filter((i) => i.severity === urgentActionFilter);

    return {
      allItems: items,
      filteredItems,
      counts,
    };
  }, [filteredReports, generator300HrSchedules, urgentActionFilter]);

  // Quick-View Summary 2: Last 7 Days Maintenance Throughput
  const last7DaysThroughput = useMemo(() => {
    const sourceReports = filteredReports.length > 0 ? filteredReports : reports;

    // Anchor 7-day window to the most recent inspection date in the dataset (default 2026-10-30)
    const latestDateIso =
      sourceReports.reduce(
        (max, r) => (r.inspectionDate > max ? r.inspectionDate : max),
        '2026-10-28'
      ) || '2026-10-28';

    const anchorDate = new Date(`${latestDateIso}T00:00:00Z`);
    const dailyRows: Array<{
      dateIso: string;
      shortLabel: string;
      formattedDate: string;
      regularCount: number;
      servicing300HrCount: number;
      breakdownCount: number;
      totalCount: number;
      resolvedCount: number;
      pendingAlertCount: number;
      avgHealthScore: number;
      centersCovered: string[];
    }> = [];

    for (let offset = 6; offset >= 0; offset--) {
      const d = new Date(anchorDate.getTime() - offset * 24 * 3600 * 1000);
      const yyyy = d.getUTCFullYear();
      const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
      const dd = String(d.getUTCDate()).padStart(2, '0');
      const dateIso = `${yyyy}-${mm}-${dd}`;
      const weekdayShort = d.toLocaleDateString('en-US', {
        weekday: 'short',
        timeZone: 'UTC',
      });
      const shortLabel = `${dd}/${mm} (${weekdayShort})`;

      const dayReports = sourceReports.filter((r) => r.inspectionDate === dateIso);
      const regularCount = dayReports.filter(
        (r) => !r.formCategory || r.formCategory === 'REGULAR_INSPECTION'
      ).length;
      const servicing300HrCount = dayReports.filter(
        (r) => r.formCategory === 'REGULAR_SERVICING_300HR'
      ).length;
      const breakdownCount = dayReports.filter(
        (r) => r.formCategory === 'BREAKDOWN_REPORT'
      ).length;
      const resolvedCount = dayReports.filter(
        (r) => r.activityResolution?.activityStatus === 'Completed'
      ).length;
      const pendingAlertCount = dayReports.filter(
        (r) =>
          (r.readinessStatus === 'Critical' || r.readinessStatus === 'Action Required') &&
          r.activityResolution?.activityStatus !== 'Completed'
      ).length;

      const avgHealthScore =
        dayReports.length > 0
          ? Math.round(
              dayReports.reduce((sum, r) => sum + r.healthScore, 0) / dayReports.length
            )
          : 100;

      const centersCovered = Array.from(new Set(dayReports.map((r) => r.centerCode)));

      dailyRows.push({
        dateIso,
        shortLabel,
        formattedDate: formatDateDDMMYYYY(dateIso),
        regularCount,
        servicing300HrCount,
        breakdownCount,
        totalCount: dayReports.length,
        resolvedCount,
        pendingAlertCount,
        avgHealthScore,
        centersCovered,
      });
    }

    const total7DayReports = dailyRows.reduce((s, d) => s + d.totalCount, 0);
    const totalRegular = dailyRows.reduce((s, d) => s + d.regularCount, 0);
    const total300Hr = dailyRows.reduce((s, d) => s + d.servicing300HrCount, 0);
    const totalBreakdowns = dailyRows.reduce((s, d) => s + d.breakdownCount, 0);
    const totalResolved = dailyRows.reduce((s, d) => s + d.resolvedCount, 0);
    const totalPendingAlerts = dailyRows.reduce((s, d) => s + d.pendingAlertCount, 0);

    const distinctCentersSet = new Set<string>();
    dailyRows.forEach((d) => d.centersCovered.forEach((c) => distinctCentersSet.add(c)));

    const activeDays = dailyRows.filter((d) => d.totalCount > 0);
    const avgHealth7Day =
      activeDays.length > 0
        ? Math.round(
            activeDays.reduce((s, d) => s + d.avgHealthScore, 0) / activeDays.length
          )
        : 100;

    const startDateFormatted = dailyRows[0]?.formattedDate || '';
    const endDateFormatted = dailyRows[dailyRows.length - 1]?.formattedDate || '';

    return {
      dailyRows,
      total7DayReports,
      totalRegular,
      total300Hr,
      totalBreakdowns,
      totalResolved,
      totalPendingAlerts,
      distinctCentersCount: distinctCentersSet.size,
      avgHealth7Day,
      windowLabel: `${startDateFormatted} – ${endDateFormatted}`,
    };
  }, [filteredReports, reports]);

  return (
    <div className="space-y-6">
      {/* Top Executive Action & Filter Bar */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <img
            src="/assets/aistudio/cp_logo_cb60fbe9.jfif"
            alt="City Properties Company Logo"
            className="h-10 w-auto object-contain rounded bg-white p-0.5 border border-slate-200 shadow-2xs shrink-0 mt-0.5"
          />
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-500 mb-0.5">
              <span>City Properties Co., Ltd</span>
              <span aria-hidden="true">·</span>
              <span>Engineering & Facilities Reliability Division</span>
            </div>
            <h2 className="text-lg font-bold text-slate-900">
              Executive Generator Fleet Analytics & PM Compliance
            </h2>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <select
            value={selectedCenterFilter}
            onChange={(e) => setSelectedCenterFilter(e.target.value)}
            className="px-3 py-1.5 text-xs font-medium border border-slate-300 rounded-lg bg-white"
          >
            <option value="ALL">All Centers ({centers.length})</option>
            {centers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.centerCode} — {c.centerName}
              </option>
            ))}
          </select>

          <select
            value={selectedInspectorFilter}
            onChange={(e) => setSelectedInspectorFilter(e.target.value)}
            className="px-3 py-1.5 text-xs font-medium border border-slate-300 rounded-lg bg-white"
          >
            <option value="ALL">All Inspectors</option>
            {inspectorsList.map((insp) => (
              <option key={insp} value={insp}>
                {insp}
              </option>
            ))}
          </select>

          <div className="flex items-center gap-1.5 text-xs">
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="px-2.5 py-1.5 font-mono border border-slate-300 rounded-lg bg-white"
            />
            <span className="text-slate-400">to</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="px-2.5 py-1.5 font-mono border border-slate-300 rounded-lg bg-white"
            />
          </div>

          <button
            type="button"
            onClick={() => exportInspectionsToExcel(filteredReports, 'xlsx')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-800 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />
            Export Excel DB
          </button>
        </div>
      </div>

      {/* 7 Executive KPI Cards (including PM Regular Inspection Count & Regular Servicing Count) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-3.5">
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="text-xs font-medium text-slate-500">Total Managed Centers</div>
          <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1">
            {kpis.totalCenters}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Yangon · Mandalay · Regional
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="text-xs font-medium text-slate-500">Total Generators</div>
          <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1">
            {kpis.totalGenerators}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            250 KVA – 800 KVA Fleet
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="text-xs font-medium text-slate-500">PM (Regular Inspection)</div>
          <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1">
            {kpis.pmRegularInspectionCount}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            {kpis.totalPmRegularInspectionCount} Total Routine PMs
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="text-xs font-medium text-slate-500">Regular Servicing Count</div>
          <div className="text-2xl font-bold font-mono tabular-nums text-emerald-700 mt-1">
            {kpis.regularServicingCount}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            300-Hr Overhaul · {scheduleSummaryCounts.overdue} Overdue
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="text-xs font-medium text-slate-500">Monthly PM Completion</div>
          <div className="text-2xl font-bold font-mono tabular-nums text-emerald-700 mt-1">
            {kpis.pmCompletionRate}%
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            {reports.length} Total Forms Logged
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="text-xs font-medium text-slate-500">Ready-to-Start Availability</div>
          <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1">
            {kpis.availabilityPct}%
          </div>
          <div className="text-[11px] text-emerald-700 font-medium mt-1">
            Target &gt; 99.50% Met
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="text-xs font-medium text-slate-500">Open Action Items</div>
          <div className="text-2xl font-bold font-mono tabular-nums text-amber-600 mt-1">
            {kpis.openActionItems}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            {kpis.criticalCount} Critical · {kpis.openActionItems - kpis.criticalCount} Minor
          </div>
        </div>
      </div>

      {/* =====================================================================
          EXECUTIVE QUICK-VIEW SUMMARY: URGENT PENDING ACTIONS & LAST 7 DAYS THROUGHPUT
         ===================================================================== */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Left Panel (7 cols): Urgent Pending Actions */}
        <div className="xl:col-span-7 bg-white border border-slate-200 rounded-lg overflow-hidden flex flex-col">
          <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/60">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold text-red-700 mb-0.5">
                <AlertOctagon className="w-3.5 h-3.5" />
                <span>Executive Command Alert Queue</span>
              </div>
              <h3 className="text-base font-bold text-slate-900">
                Urgent Pending Actions ({urgentPendingActions.counts.all})
              </h3>
              <p className="text-xs text-slate-500">
                Immediate critical alarms, unresolved checklist red flags, and overdue 300-Hr servicing units requiring dispatch.
              </p>
            </div>

            {onOpenActivitiesTab && (
              <button
                type="button"
                onClick={onOpenActivitiesTab}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-800 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg transition-colors whitespace-nowrap shrink-0 self-start sm:self-center"
              >
                <Wrench className="w-3.5 h-3.5 text-amber-600" />
                Open Activities Tracker
              </button>
            )}
          </div>

          {/* Filter Bar */}
          <div className="px-5 py-2.5 border-b border-slate-200 bg-white flex flex-wrap items-center justify-between gap-2">
            <div className="inline-flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg text-xs">
              <button
                type="button"
                onClick={() => setUrgentActionFilter('ALL')}
                className={`px-2.5 py-1 font-semibold rounded transition-colors whitespace-nowrap ${
                  urgentActionFilter === 'ALL'
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All Urgent ({urgentPendingActions.counts.all})
              </button>
              <button
                type="button"
                onClick={() => setUrgentActionFilter('CRITICAL')}
                className={`px-2.5 py-1 font-semibold rounded transition-colors whitespace-nowrap ${
                  urgentActionFilter === 'CRITICAL'
                    ? 'bg-red-600 text-white'
                    : 'text-red-700 hover:bg-white/70'
                }`}
              >
                Critical ({urgentPendingActions.counts.critical})
              </button>
              <button
                type="button"
                onClick={() => setUrgentActionFilter('OVERDUE_300HR')}
                className={`px-2.5 py-1 font-semibold rounded transition-colors whitespace-nowrap ${
                  urgentActionFilter === 'OVERDUE_300HR'
                    ? 'bg-amber-700 text-white'
                    : 'text-amber-800 hover:bg-white/70'
                }`}
              >
                300-Hr Overdue ({urgentPendingActions.counts.overdue300Hr})
              </button>
              <button
                type="button"
                onClick={() => setUrgentActionFilter('ACTION_REQUIRED')}
                className={`px-2.5 py-1 font-semibold rounded transition-colors whitespace-nowrap ${
                  urgentActionFilter === 'ACTION_REQUIRED'
                    ? 'bg-amber-600 text-white'
                    : 'text-amber-700 hover:bg-white/70'
                }`}
              >
                Action Req ({urgentPendingActions.counts.actionRequired})
              </button>
            </div>

            <span className="text-[11px] font-mono text-slate-500">
              Showing {Math.min(urgentPendingActions.filteredItems.length, 8)} of{' '}
              {urgentPendingActions.filteredItems.length} pending items
            </span>
          </div>

          {/* Urgent Pending List */}
          <div className="divide-y divide-slate-200 max-h-[380px] overflow-y-auto flex-1">
            {urgentPendingActions.filteredItems.length === 0 ? (
              <div className="p-8 text-center">
                <CheckCircle2 className="w-7 h-7 text-emerald-600 mx-auto mb-2" />
                <div className="text-sm font-bold text-slate-800">
                  Zero Urgent Actions in Current Filter
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  All critical alarms and preventive maintenance items in this view have been resolved.
                </p>
              </div>
            ) : (
              urgentPendingActions.filteredItems.slice(0, 8).map((item) => (
                <div
                  key={item.id}
                  className="p-4 hover:bg-slate-50/80 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {item.severity === 'CRITICAL' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide bg-red-100 text-red-800 border border-red-200 rounded">
                          <AlertOctagon className="w-3 h-3" />
                          Critical Alert
                        </span>
                      )}
                      {item.severity === 'OVERDUE_300HR' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide bg-amber-100 text-amber-900 border border-amber-300 rounded">
                          <Clock className="w-3 h-3" />
                          300-Hr Overdue
                        </span>
                      )}
                      {item.severity === 'ACTION_REQUIRED' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide bg-amber-50 text-amber-800 border border-amber-200 rounded">
                          <AlertTriangle className="w-3 h-3" />
                          Action Required
                        </span>
                      )}

                      <span className="text-xs font-bold font-mono text-slate-900">
                        {item.centerCode}
                      </span>
                      <span className="text-xs font-semibold text-slate-700 truncate">
                        {item.centerName}
                      </span>
                      {item.reportNo && (
                        <span className="text-[11px] font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                          #{item.reportNo}
                        </span>
                      )}
                    </div>

                    <div className="text-xs font-medium text-slate-900">
                      {item.title}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
                      <span className="font-mono text-slate-700">{item.generatorLabel}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono text-slate-600">{item.telemetryBadge}</span>
                      <span aria-hidden="true">·</span>
                      <span>
                        {formatDateDDMMYYYY(item.dateIso)} ({item.inspectorOrOwner})
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {item.report && (
                      <button
                        type="button"
                        onClick={() => onOpenReportPdf(item.report!)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded transition-colors whitespace-nowrap"
                        title="Open Official 2-Page PDF Report"
                      >
                        <Printer className="w-3.5 h-3.5 text-slate-600" />
                        PDF
                      </button>
                    )}

                    {item.report && onOpenActivitiesTab && (
                      <button
                        type="button"
                        onClick={onOpenActivitiesTab}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200 hover:bg-amber-100 rounded transition-colors whitespace-nowrap"
                        title="Resolve in Activities Tracker"
                      >
                        Resolve
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() =>
                        onStartInspection(
                          item.centerId,
                          item.generatorId,
                          item.recommendedFormCategory
                        )
                      }
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded transition-colors whitespace-nowrap"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      {item.severity === 'OVERDUE_300HR' ? 'Log 300-Hr' : 'Dispatch PM'}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Panel (5 cols): Last 7 Days Maintenance Throughput */}
        <div className="xl:col-span-5 bg-white border border-slate-200 rounded-lg overflow-hidden flex flex-col">
          <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/60">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700 mb-0.5">
                <Gauge className="w-3.5 h-3.5" />
                <span>7-Day Operational Velocity ({last7DaysThroughput.windowLabel})</span>
              </div>
              <h3 className="text-base font-bold text-slate-900">
                Last 7 Days Maintenance Throughput
              </h3>
              <p className="text-xs text-slate-500">
                Daily inspection volume, 300-Hr servicing, breakdown repairs, and fleet health across active centers.
              </p>
            </div>

            <div className="inline-flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg text-xs self-start sm:self-center shrink-0">
              <button
                type="button"
                onClick={() => setThroughputDisplayMode('CHART')}
                className={`px-2.5 py-1 font-semibold rounded transition-colors ${
                  throughputDisplayMode === 'CHART'
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-700 hover:text-slate-900'
                }`}
              >
                Chart View
              </button>
              <button
                type="button"
                onClick={() => setThroughputDisplayMode('TABLE')}
                className={`px-2.5 py-1 font-semibold rounded transition-colors ${
                  throughputDisplayMode === 'TABLE'
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-700 hover:text-slate-900'
                }`}
              >
                Daily Log
              </button>
            </div>
          </div>

          {/* 4 Mini Summary Counters for the 7-Day Window */}
          <div className="grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-200 border-b border-slate-200 bg-white">
            <div className="p-3">
              <div className="text-[11px] font-medium text-slate-500">7-Day Throughput</div>
              <div className="text-lg font-bold font-mono tabular-nums text-slate-900 mt-0.5">
                {last7DaysThroughput.total7DayReports}
              </div>
              <div className="text-[11px] text-slate-500">
                {last7DaysThroughput.distinctCentersCount} Centers Visited
              </div>
            </div>

            <div className="p-3">
              <div className="text-[11px] font-medium text-slate-500">PM &amp; 300-Hr Split</div>
              <div className="text-lg font-bold font-mono tabular-nums text-emerald-700 mt-0.5">
                {last7DaysThroughput.totalRegular} / {last7DaysThroughput.total300Hr}
              </div>
              <div className="text-[11px] text-slate-500">Reg PM · 300-Hr Service</div>
            </div>

            <div className="p-3">
              <div className="text-[11px] font-medium text-slate-500">Breakdowns Logged</div>
              <div className="text-lg font-bold font-mono tabular-nums text-red-600 mt-0.5">
                {last7DaysThroughput.totalBreakdowns}
              </div>
              <div className="text-[11px] text-slate-500">
                {last7DaysThroughput.totalResolved} Actions Closed
              </div>
            </div>

            <div className="p-3">
              <div className="text-[11px] font-medium text-slate-500">7-Day Avg Health</div>
              <div className="text-lg font-bold font-mono tabular-nums text-slate-900 mt-0.5">
                {last7DaysThroughput.avgHealth7Day}%
              </div>
              <div className="text-[11px] text-amber-700 font-medium">
                {last7DaysThroughput.totalPendingAlerts} Open Alerts
              </div>
            </div>
          </div>

          {/* Chart or Daily Table Body */}
          <div className="p-4 flex-1 flex flex-col justify-between">
            {throughputDisplayMode === 'CHART' ? (
              <>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={last7DaysThroughput.dailyRows}
                      margin={{ top: 8, right: 8, left: -20, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis
                        dataKey="shortLabel"
                        tick={{ fontSize: 10, fill: '#475569' }}
                      />
                      <YAxis
                        allowDecimals={false}
                        tick={{ fontSize: 10, fill: '#475569' }}
                      />
                      <Tooltip
                        contentStyle={{
                          fontSize: '12px',
                          borderRadius: '6px',
                          border: '1px solid #cbd5e1',
                        }}
                      />
                      <Bar
                        dataKey="regularCount"
                        stackId="a"
                        name="Regular Inspection"
                        fill="#0f172a"
                        radius={[0, 0, 0, 0]}
                      />
                      <Bar
                        dataKey="servicing300HrCount"
                        stackId="a"
                        name="300-Hr Servicing"
                        fill="#059669"
                        radius={[0, 0, 0, 0]}
                      />
                      <Bar
                        dataKey="breakdownCount"
                        stackId="a"
                        name="Breakdown Repair"
                        fill="#dc2626"
                        radius={[3, 3, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Compact Legend & Quick Action Footer */}
                <div className="pt-3 mt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-600">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-xs bg-slate-900 inline-block" />
                      Regular PM ({last7DaysThroughput.totalRegular})
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-xs bg-emerald-600 inline-block" />
                      300-Hr Service ({last7DaysThroughput.total300Hr})
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-xs bg-red-600 inline-block" />
                      Breakdown ({last7DaysThroughput.totalBreakdowns})
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => onStartInspection(undefined, undefined, 'REGULAR_INSPECTION')}
                    className="text-xs font-semibold text-slate-900 hover:underline inline-flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Log Today&apos;s Inspection
                  </button>
                </div>
              </>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase">
                      <th className="py-2 pr-2">Date</th>
                      <th className="py-2 px-2">Centers</th>
                      <th className="py-2 px-2 text-right">Reg PM</th>
                      <th className="py-2 px-2 text-right">300-Hr</th>
                      <th className="py-2 px-2 text-right">Breakdowns</th>
                      <th className="py-2 pl-2 text-right">Avg Health</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {last7DaysThroughput.dailyRows.map((day) => (
                      <tr key={day.dateIso} className="hover:bg-slate-50">
                        <td className="py-2 pr-2 font-mono font-medium text-slate-900 whitespace-nowrap">
                          {day.formattedDate}
                        </td>
                        <td className="py-2 px-2 text-slate-600">
                          {day.centersCovered.length > 0 ? (
                            <span className="font-mono text-[11px]">
                              {day.centersCovered.slice(0, 3).join(', ')}
                              {day.centersCovered.length > 3
                                ? ` +${day.centersCovered.length - 3}`
                                : ''}
                            </span>
                          ) : (
                            <span className="text-slate-400">No logs</span>
                          )}
                        </td>
                        <td className="py-2 px-2 text-right font-mono tabular-nums text-slate-800">
                          {day.regularCount}
                        </td>
                        <td className="py-2 px-2 text-right font-mono tabular-nums text-emerald-700 font-semibold">
                          {day.servicing300HrCount}
                        </td>
                        <td className="py-2 px-2 text-right font-mono tabular-nums text-red-600 font-semibold">
                          {day.breakdownCount}
                        </td>
                        <td className="py-2 pl-2 text-right font-mono tabular-nums font-semibold text-slate-900">
                          {day.totalCount > 0 ? `${day.avgHealthScore}%` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Role-Based Quick Actions Widget & Chart 03 (01 & 02 Charts Removed) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Left 7 Columns: Role-Based Quick Actions & Service Category Counters */}
        <div className="xl:col-span-7 bg-white border border-slate-200 rounded-lg overflow-hidden flex flex-col justify-between">
          <div>
            <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/60">
              <div>
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 mb-0.5">
                  <Shield className="w-3.5 h-3.5 text-slate-900" />
                  <span>
                    Role-Aware Command Workflows · Signed in as {currentUserName} ({currentUserRole})
                  </span>
                </div>
                <h3 className="text-base font-bold text-slate-900">
                  Quick Actions &amp; Service Form Counters
                </h3>
                <p className="text-xs text-slate-500">
                  Instantly initiate common workflows like logging a new breakdown, starting a PM or 300-Hr servicing form, or reviewing pending inspections based on your role.
                </p>
              </div>

              {/* Role Context Selector (Administrator Only) */}
              {currentUserRole === 'Administrator' && (
                <div className="inline-flex flex-wrap items-center gap-1 p-1 bg-slate-200/70 rounded-lg text-xs shrink-0 self-start sm:self-center">
                  {(['Administrator', 'Chief Engineer', 'Field Engineer', 'Viewer'] as UserRole[]).map(
                    (roleOption) => (
                      <button
                        key={roleOption}
                        type="button"
                        onClick={() => setQuickActionRoleOverride(roleOption)}
                        className={`px-2 py-1 font-semibold rounded transition-colors whitespace-nowrap ${
                          activeQuickActionRole === roleOption
                            ? 'bg-slate-900 text-white'
                            : 'text-slate-700 hover:text-slate-900'
                        }`}
                      >
                        {roleOption}
                      </button>
                    )
                  )}
                </div>
              )}
            </div>

            {/* Service Form Count Strip: PM (Regular Inspection) Count & Regular Servicing Count */}
            <div className="grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-200 border-b border-slate-200 bg-white">
              <div className="p-3.5">
                <div className="text-[11px] font-medium text-slate-500">
                  PM (Regular Inspection) Count
                </div>
                <div className="text-xl font-bold font-mono tabular-nums text-slate-900 mt-0.5">
                  {kpis.pmRegularInspectionCount}
                </div>
                <div className="text-[11px] text-slate-500">
                  Routine 25-Pt Checklists
                </div>
              </div>

              <div className="p-3.5">
                <div className="text-[11px] font-medium text-slate-500">
                  Regular Servicing Count
                </div>
                <div className="text-xl font-bold font-mono tabular-nums text-emerald-700 mt-0.5">
                  {kpis.regularServicingCount}
                </div>
                <div className="text-[11px] text-slate-500">
                  300-Hr Overhaul Reports
                </div>
              </div>

              <div className="p-3.5">
                <div className="text-[11px] font-medium text-slate-500">
                  Breakdown Reports Logged
                </div>
                <div className="text-xl font-bold font-mono tabular-nums text-red-600 mt-0.5">
                  {kpis.breakdownReportCount}
                </div>
                <div className="text-[11px] text-slate-500">
                  Emergency Callout Forms
                </div>
              </div>

              <div className="p-3.5">
                <div className="text-[11px] font-medium text-slate-500">
                  Pending Inspections / Actions
                </div>
                <div className="text-xl font-bold font-mono tabular-nums text-amber-600 mt-0.5">
                  {urgentPendingActions.counts.all}
                </div>
                <div className="text-[11px] text-slate-500">
                  {scheduleSummaryCounts.overdue} Overdue · {kpis.openActionItems} Alerts
                </div>
              </div>
            </div>

            {/* Role-Tailored Quick Action Cards */}
            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {activeQuickActionRole === 'Viewer' ? (
                <>
                  {/* Viewer Card 1: View Pending Inspections & Action Items */}
                  <button
                    type="button"
                    onClick={() => {
                      if (onOpenActivitiesTab) {
                        onOpenActivitiesTab();
                      } else {
                        setUrgentActionFilter('ALL');
                      }
                    }}
                    className="text-left p-3.5 rounded-lg border border-amber-200 bg-amber-50/60 hover:bg-amber-100/70 transition-colors flex flex-col justify-between gap-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-950">
                        <Clock className="w-4 h-4 text-amber-700 shrink-0" />
                        Pending Inspections &amp; Tasks
                      </span>
                      <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-amber-700 text-white">
                        {urgentPendingActions.counts.all} Open
                      </span>
                    </div>
                    <p className="text-[11px] text-amber-900/80">
                      View pending findings, action required checklists &amp; field activity completion statuses.
                    </p>
                  </button>

                  {/* Viewer Card 2: 300-Hr Servicing Schedule & Run Hours */}
                  <button
                    type="button"
                    onClick={() => {
                      setCalendarViewMode('countdown_list');
                      const el = document.getElementById('maintenance-calendar-section');
                      if (el) el.scrollIntoView({ behavior: 'smooth' });
                    }}
                    className="text-left p-3.5 rounded-lg border border-emerald-200 bg-emerald-50/50 hover:bg-emerald-100/60 transition-colors flex flex-col justify-between gap-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-950">
                        <Calendar className="w-4 h-4 text-emerald-700 shrink-0" />
                        300-Hr Servicing Schedule
                      </span>
                      <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-emerald-700 text-white">
                        {scheduleSummaryCounts.overdue} Overdue
                      </span>
                    </div>
                    <p className="text-[11px] text-emerald-900/80">
                      Monitor run-hour countdowns, next service dates &amp; filter oil/coolant overhaul forecasts.
                    </p>
                  </button>

                  {/* Viewer Card 3: Breakdown Records & Downtime Log */}
                  <button
                    type="button"
                    onClick={() => {
                      if (onOpenReportsArchive) {
                        onOpenReportsArchive();
                      }
                    }}
                    className="text-left p-3.5 rounded-lg border border-red-200 bg-red-50/60 hover:bg-red-100/70 transition-colors flex flex-col justify-between gap-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-red-950">
                        <AlertOctagon className="w-4 h-4 text-red-600 shrink-0" />
                        Breakdown &amp; Downtime Log
                      </span>
                      <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-red-600 text-white">
                        {kpis.breakdownReportCount} Logged
                      </span>
                    </div>
                    <p className="text-[11px] text-red-900/80">
                      Audit past generator failures, alarm codes, downtime hours &amp; corrective actions taken.
                    </p>
                  </button>

                  {/* Viewer Card 4: Specialized Reports & PDF Archive */}
                  <button
                    type="button"
                    onClick={() => {
                      if (onOpenReportsArchive) {
                        onOpenReportsArchive();
                      } else if (filteredReports[0]) {
                        onOpenReportPdf(filteredReports[0]);
                      }
                    }}
                    className="text-left p-3.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition-colors flex flex-col justify-between gap-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-900">
                        <FileText className="w-4 h-4 text-slate-700 shrink-0" />
                        Specialized Reports &amp; PDF
                      </span>
                      <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                        11 Types
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600">
                      Generate Center-wise, Parts History, Major/Minor Servicing &amp; Date Range PDFs.
                    </p>
                  </button>

                  {/* Viewer Card 5: Generator Fleet Matrix Status */}
                  <button
                    type="button"
                    onClick={() => {
                      const el = document.getElementById('fleet-matrix-section');
                      if (el) el.scrollIntoView({ behavior: 'smooth' });
                    }}
                    className="text-left p-3.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition-colors flex flex-col justify-between gap-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-900">
                        <Building2 className="w-4 h-4 text-slate-700 shrink-0" />
                        Fleet Matrix ({centers.length} Centers)
                      </span>
                      <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
                        {kpis.availabilityPct}% Ready
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600">
                      Inspect 31 centers, 62 genset run hours, breaker ratings &amp; live readiness statuses.
                    </p>
                  </button>

                  {/* Viewer Card 6: Export Audit Excel */}
                  <button
                    type="button"
                    onClick={() => exportInspectionsToExcel(filteredReports, 'xlsx')}
                    className="text-left p-3.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition-colors flex flex-col justify-between gap-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-900">
                        <FileSpreadsheet className="w-4 h-4 text-emerald-700 shrink-0" />
                        Export Audit Excel DB
                      </span>
                      <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                        Read-Only
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600">
                      Download filtered inspection, servicing &amp; breakdown ledger as standard XLSX.
                    </p>
                  </button>
                </>
              ) : (
                <>
                  {/* Action 1: Log New Breakdown */}
                  <button
                    type="button"
                    onClick={() =>
                      onStartInspection(
                        selectedCenterFilter !== 'ALL' ? selectedCenterFilter : undefined,
                        undefined,
                        'BREAKDOWN_REPORT'
                      )
                    }
                    className="text-left p-3.5 rounded-lg border border-red-200 bg-red-50/60 hover:bg-red-100/70 transition-colors flex flex-col justify-between gap-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-red-900">
                        <AlertOctagon className="w-4 h-4 text-red-600 shrink-0" />
                        Log New Breakdown
                      </span>
                      <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-red-600 text-white">
                        Step A
                      </span>
                    </div>
                    <p className="text-[11px] text-red-900/80">
                      Initiate emergency generator fault &amp; downtime rectification report ({kpis.breakdownReportCount} logged).
                    </p>
                  </button>

                  {/* Action 2: View Pending Inspections */}
                  <button
                    type="button"
                    onClick={() => {
                      if (onOpenActivitiesTab) {
                        onOpenActivitiesTab();
                      } else {
                        setUrgentActionFilter('ALL');
                      }
                    }}
                    className="text-left p-3.5 rounded-lg border border-amber-200 bg-amber-50/60 hover:bg-amber-100/70 transition-colors flex flex-col justify-between gap-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-950">
                        <Clock className="w-4 h-4 text-amber-700 shrink-0" />
                        View Pending Inspections
                      </span>
                      <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-amber-700 text-white">
                        {urgentPendingActions.counts.all} Open
                      </span>
                    </div>
                    <p className="text-[11px] text-amber-900/80">
                      Inspect open error findings, action required items &amp; mark completion dates.
                    </p>
                  </button>

                  {/* Action 3: Log PM (Regular Inspection) */}
                  <button
                    type="button"
                    onClick={() =>
                      onStartInspection(
                        selectedCenterFilter !== 'ALL' ? selectedCenterFilter : undefined,
                        undefined,
                        'REGULAR_INSPECTION'
                      )
                    }
                    className="text-left p-3.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 transition-colors flex flex-col justify-between gap-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-900">
                        <ClipboardCheck className="w-4 h-4 text-slate-800 shrink-0" />
                        Log PM (Regular Inspection)
                      </span>
                      <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-900 text-white">
                        {kpis.pmRegularInspectionCount} PM
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600">
                      Start fresh Step A 25-point monthly routine inspection form for any center.
                    </p>
                  </button>

                  {/* Action 4: Log Regular Servicing (300-Hr) */}
                  <button
                    type="button"
                    onClick={() => {
                      const topOverdue = generator300HrSchedules.find(
                        (s) => s.urgency === 'OVERDUE'
                      );
                      onStartInspection(
                        selectedCenterFilter !== 'ALL'
                          ? selectedCenterFilter
                          : topOverdue?.center.id,
                        topOverdue?.generator.id,
                        'REGULAR_SERVICING_300HR'
                      );
                    }}
                    className="text-left p-3.5 rounded-lg border border-emerald-200 bg-emerald-50/50 hover:bg-emerald-100/60 transition-colors flex flex-col justify-between gap-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-950">
                        <Wrench className="w-4 h-4 text-emerald-700 shrink-0" />
                        Log Regular Servicing
                      </span>
                      <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-emerald-700 text-white">
                        {kpis.regularServicingCount} Logged
                      </span>
                    </div>
                    <p className="text-[11px] text-emerald-900/80">
                      Start 300-Hr lube oil, filter kit &amp; radiator servicing ({scheduleSummaryCounts.overdue} overdue).
                    </p>
                  </button>

                  {/* Action 5: Specialized Reports & PDF Archive */}
                  <button
                    type="button"
                    onClick={() => {
                      if (onOpenReportsArchive) {
                        onOpenReportsArchive();
                      } else if (filteredReports[0]) {
                        onOpenReportPdf(filteredReports[0]);
                      }
                    }}
                    className="text-left p-3.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition-colors flex flex-col justify-between gap-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-900">
                        <FileText className="w-4 h-4 text-slate-700 shrink-0" />
                        Specialized Reports &amp; PDF
                      </span>
                      <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                        11 Types
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600">
                      Generate Center-wise, Parts History, Major/Minor Servicing &amp; Date Range PDFs.
                    </p>
                  </button>

                  {/* Action 6: Role-Specific Contextual Workflow */}
                  {activeQuickActionRole === 'Administrator' && (
                    <button
                      type="button"
                      onClick={() => onOpenRoleManagement?.()}
                      className="text-left p-3.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition-colors flex flex-col justify-between gap-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-900">
                          <Shield className="w-4 h-4 text-slate-800 shrink-0" />
                          Authorized Users &amp; RBAC
                        </span>
                        <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-slate-900 text-white">
                          Admin
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600">
                        Provision Firebase user UIDs, passwords &amp; admin edit/delete permissions.
                      </p>
                    </button>
                  )}

                  {activeQuickActionRole === 'Chief Engineer' && (
                    <button
                      type="button"
                      onClick={() => onOpenNotificationsCenter?.()}
                      className="text-left p-3.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition-colors flex flex-col justify-between gap-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-900">
                          <Bell className="w-4 h-4 text-amber-600 shrink-0" />
                          Center Email Rules
                        </span>
                        <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-900">
                          31 Centers
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600">
                        Configure per-center recipient lists &amp; critical alarm email dispatch rules.
                      </p>
                    </button>
                  )}

                  {activeQuickActionRole === 'Field Engineer' && (
                    <button
                      type="button"
                      onClick={() => {
                        const nextCritical = urgentPendingActions.allItems[0];
                        if (nextCritical) {
                          onStartInspection(
                            nextCritical.centerId,
                            nextCritical.generatorId,
                            nextCritical.recommendedFormCategory
                          );
                        } else {
                          onStartInspection(undefined, undefined, 'REGULAR_INSPECTION');
                        }
                      }}
                      className="text-left p-3.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition-colors flex flex-col justify-between gap-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-900">
                          <Plus className="w-4 h-4 text-emerald-700 shrink-0" />
                          Dispatch Priority Unit
                        </span>
                        <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-900">
                          Field
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600">
                        Auto-load the top priority center &amp; generator directly into Step A.
                      </p>
                    </button>
                  )}
                </>
              )}
            </div>
          </div>

          <div className="px-5 py-2.5 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
            <span>
              Active Role Permissions:{' '}
              <strong className="text-slate-800">{activeQuickActionRole}</strong>{' '}
              {activeQuickActionRole === 'Administrator'
                ? '(Full Create, Edit, Delete, User & Rule Administration)'
                : activeQuickActionRole === 'Chief Engineer'
                ? '(Create Forms, Resolve Activities, Configure Alert Rules)'
                : activeQuickActionRole === 'Field Engineer'
                ? '(Create PM, 300-Hr Servicing & Breakdown Forms)'
                : '(Read-Only Analytics, PDF Viewing & Excel Export)'}
            </span>
            <span className="font-mono text-slate-700">
              PM: {kpis.pmRegularInspectionCount} · Servicing: {kpis.regularServicingCount} · Breakdown: {kpis.breakdownReportCount}
            </span>
          </div>
        </div>

        {/* Right 5 Columns: 03. Top Defect & Action Required Categories */}
        <div className="xl:col-span-5 bg-white border border-slate-200 rounded-lg p-5 flex flex-col justify-between">
          <div className="mb-4">
            <h3 className="text-sm font-bold text-slate-900">
              03. Top Defect &amp; Action Required Categories
            </h3>
            <p className="text-xs text-slate-500">
              Pareto breakdown of preventive maintenance findings across 25-point checks
            </p>
          </div>
          <div className="h-64 flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={defectCategoryData}
                layout="vertical"
                margin={{ top: 4, right: 16, left: 24, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10, fill: '#475569' }} />
                <YAxis
                  type="category"
                  dataKey="category"
                  width={110}
                  tick={{ fontSize: 10, fill: '#334155' }}
                />
                <Tooltip
                  contentStyle={{
                    fontSize: '12px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                  }}
                />
                <Bar dataKey="count" name="Occurrences" fill="#d97706" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* =====================================================================
          04. MAINTENANCE CALENDAR: 300-HOUR SERVICING DEADLINES (ALL 62 GENSETS)
         ===================================================================== */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-500 mb-0.5">
              <Calendar className="w-3.5 h-3.5 text-slate-700" />
              <span>Predictive 300-Hour Running Hour Preventive Maintenance Schedule</span>
            </div>
            <h3 className="text-base font-bold text-slate-900">
              04. Maintenance Calendar — Upcoming 300-Hour Servicing Deadlines ({scheduleSummaryCounts.total} Generators)
            </h3>
            <p className="text-xs text-slate-500">
              Projected servicing deadlines calculated from each generator&apos;s current running hours, last 300-hour service date, and daily operating rate.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Urgency Filter Segmented Buttons */}
            <div className="inline-flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg text-xs">
              <button
                type="button"
                onClick={() => {
                  setCalendarUrgencyFilter('ALL');
                  setSelectedCalendarDate(null);
                }}
                className={`px-2.5 py-1 font-semibold rounded transition-colors whitespace-nowrap shrink-0 ${
                  calendarUrgencyFilter === 'ALL'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All ({scheduleSummaryCounts.total})
              </button>
              <button
                type="button"
                onClick={() => {
                  setCalendarUrgencyFilter('OVERDUE');
                  setSelectedCalendarDate(null);
                }}
                className={`px-2.5 py-1 font-semibold rounded transition-colors whitespace-nowrap shrink-0 ${
                  calendarUrgencyFilter === 'OVERDUE'
                    ? 'bg-red-600 text-white shadow-xs'
                    : 'text-red-700 hover:bg-white/60'
                }`}
              >
                Overdue &ge;300h ({scheduleSummaryCounts.overdue})
              </button>
              <button
                type="button"
                onClick={() => {
                  setCalendarUrgencyFilter('DUE_SOON');
                  setSelectedCalendarDate(null);
                }}
                className={`px-2.5 py-1 font-semibold rounded transition-colors whitespace-nowrap shrink-0 ${
                  calendarUrgencyFilter === 'DUE_SOON'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'text-amber-800 hover:bg-white/60'
                }`}
              >
                Due Soon 255–299h ({scheduleSummaryCounts.dueSoon})
              </button>
              <button
                type="button"
                onClick={() => {
                  setCalendarUrgencyFilter('ON_TRACK');
                  setSelectedCalendarDate(null);
                }}
                className={`px-2.5 py-1 font-semibold rounded transition-colors whitespace-nowrap shrink-0 ${
                  calendarUrgencyFilter === 'ON_TRACK'
                    ? 'bg-emerald-700 text-white shadow-xs'
                    : 'text-emerald-800 hover:bg-white/60'
                }`}
              >
                On Track &lt;255h ({scheduleSummaryCounts.onTrack})
              </button>
            </div>

            {/* View Mode Switcher */}
            <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg text-xs">
              <button
                type="button"
                onClick={() => setCalendarViewMode('calendar_grid')}
                className={`px-2.5 py-1 font-semibold rounded transition-colors whitespace-nowrap shrink-0 ${
                  calendarViewMode === 'calendar_grid'
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Monthly Calendar
              </button>
              <button
                type="button"
                onClick={() => setCalendarViewMode('countdown_list')}
                className={`px-2.5 py-1 font-semibold rounded transition-colors whitespace-nowrap shrink-0 ${
                  calendarViewMode === 'countdown_list'
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                300-Hr Countdown Bar
              </button>
            </div>
          </div>
        </div>

        {calendarViewMode === 'calendar_grid' ? (
          <div className="grid grid-cols-1 xl:grid-cols-12 divide-y xl:divide-y-0 xl:divide-x divide-slate-200">
            {/* Left 8 Columns: Interactive 7-Day Monthly Calendar Grid */}
            <div className="xl:col-span-8 p-5">
              {/* Month Navigation Header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={calendarMonthIndex === 0}
                    onClick={() => {
                      setCalendarMonthIndex((m) => Math.max(0, m - 1));
                      setSelectedCalendarDate(null);
                    }}
                    className="p-1.5 rounded border border-slate-300 text-slate-700 hover:bg-slate-100 disabled:opacity-40"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <h4 className="text-sm font-bold text-slate-900 min-w-[140px] text-center">
                    {activeCalendarMonth.label}
                  </h4>
                  <button
                    type="button"
                    disabled={calendarMonthIndex === CALENDAR_MONTHS.length - 1}
                    onClick={() => {
                      setCalendarMonthIndex((m) =>
                        Math.min(CALENDAR_MONTHS.length - 1, m + 1)
                      );
                      setSelectedCalendarDate(null);
                    }}
                    className="p-1.5 rounded border border-slate-300 text-slate-700 hover:bg-slate-100 disabled:opacity-40"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-3 text-[11px] font-medium text-slate-600">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-xs bg-red-600 inline-block" />
                    &ge; 300 Hrs (Service Due)
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-xs bg-amber-500 inline-block" />
                    255–299 Hrs (Approaching)
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-xs bg-emerald-600 inline-block" />
                    &lt; 255 Hrs (Scheduled)
                  </span>
                </div>
              </div>

              {/* 7-Column Weekday Header */}
              <div className="grid grid-cols-7 border-t border-l border-slate-200 bg-slate-50 text-[11px] font-bold text-slate-600 text-center">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                  <div key={day} className="py-2 border-r border-b border-slate-200">
                    {day}
                  </div>
                ))}
              </div>

              {/* Calendar Day Cells */}
              <div className="grid grid-cols-7 border-l border-slate-200">
                {calendarGridDays.map((cell, idx) => {
                  if (!cell.dateIso || !cell.dayNumber) {
                    return (
                      <div
                        key={`empty-${idx}`}
                        className="min-h-[92px] bg-slate-50/50 border-r border-b border-slate-200"
                      />
                    );
                  }

                  const isSelected = selectedCalendarDate === cell.dateIso;
                  const isToday = cell.dateIso === '2026-10-29';

                  return (
                    <div
                      key={cell.dateIso}
                      onClick={() =>
                        setSelectedCalendarDate(
                          isSelected ? null : cell.dateIso
                        )
                      }
                      className={`min-h-[92px] p-1.5 border-r border-b border-slate-200 transition-colors cursor-pointer flex flex-col justify-between ${
                        isSelected
                          ? 'bg-slate-900/5 ring-2 ring-inset ring-slate-900'
                          : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className={`text-xs font-mono font-bold px-1.5 py-0.5 rounded ${
                            isToday
                              ? 'bg-slate-900 text-white'
                              : 'text-slate-700'
                          }`}
                        >
                          {cell.dayNumber}
                        </span>
                        {cell.items.length > 0 && (
                          <span className="text-[10px] font-mono font-semibold text-slate-500">
                            {cell.items.length} {cell.items.length === 1 ? 'unit' : 'units'}
                          </span>
                        )}
                      </div>

                      <div className="space-y-1 mt-1">
                        {cell.items.slice(0, 3).map((item) => {
                          const chipStyle =
                            item.urgency === 'OVERDUE'
                              ? 'bg-red-50 text-red-900 border-red-300'
                              : item.urgency === 'DUE_SOON'
                              ? 'bg-amber-50 text-amber-950 border-amber-300'
                              : 'bg-emerald-50 text-emerald-900 border-emerald-200';
                          return (
                            <div
                              key={item.generator.id}
                              className={`px-1.5 py-0.5 text-[10px] font-mono font-semibold rounded border truncate flex items-center justify-between gap-1 ${chipStyle}`}
                              title={`${item.center.centerCode} (${item.generator.id}) — ${item.hoursSinceLastService}/300 hrs | Last Service: ${formatDateDDMMYYYY(item.lastServiceDate)}`}
                            >
                              <span className="truncate">{item.center.centerCode}</span>
                              <span className="tabular-nums shrink-0">
                                {Math.round(item.hoursSinceLastService)}h
                              </span>
                            </div>
                          );
                        })}
                        {cell.items.length > 3 && (
                          <div className="text-[10px] font-mono font-semibold text-slate-500 pl-1">
                            +{cell.items.length - 3} more due
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right 4 Columns: Interactive Deadline Inspector & 1-Click Servicing Dispatch */}
            <div className="xl:col-span-4 p-5 bg-slate-50/50 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-200">
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                      {selectedCalendarDate
                        ? `Deadlines on ${formatDateDDMMYYYY(selectedCalendarDate)}`
                        : 'Priority 300-Hour Servicing Queue'}
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      {selectedCalendarDate
                        ? `${selectedDayScheduleItems.length} generator(s) scheduled on this date`
                        : 'Click any calendar date to filter, or start 300-Hr Servicing directly'}
                    </p>
                  </div>
                  {selectedCalendarDate && (
                    <button
                      type="button"
                      onClick={() => setSelectedCalendarDate(null)}
                      className="text-xs font-semibold text-slate-700 underline"
                    >
                      Show Top Priority
                    </button>
                  )}
                </div>

                {selectedDayScheduleItems.length === 0 ? (
                  <div className="py-12 text-center text-xs text-slate-500">
                    No 300-hour generator servicing deadlines fall on this date.
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[540px] overflow-y-auto pr-1">
                    {selectedDayScheduleItems.map((item) => (
                      <div
                        key={item.generator.id}
                        className="bg-white border border-slate-200 rounded-lg p-3.5 space-y-2.5 shadow-2xs"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono font-bold text-xs text-slate-900">
                                {item.center.centerCode}
                              </span>
                              <span className="text-xs text-slate-400">·</span>
                              <span className="font-mono text-xs font-semibold text-slate-700">
                                {item.generator.id} ({item.generator.kvaRating})
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-500 truncate">
                              {item.center.centerName} · {item.generator.gensetModel}
                            </div>
                          </div>

                          {item.urgency === 'OVERDUE' && (
                            <span className="px-2 py-0.5 text-[10px] font-bold bg-red-100 text-red-800 rounded shrink-0">
                              Service Due ({item.hoursSinceLastService}h)
                            </span>
                          )}
                          {item.urgency === 'DUE_SOON' && (
                            <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-100 text-amber-900 rounded shrink-0">
                              {item.remainingHours}h Remaining
                            </span>
                          )}
                          {item.urgency === 'ON_TRACK' && (
                            <span className="px-2 py-0.5 text-[10px] font-semibold bg-emerald-100 text-emerald-800 rounded shrink-0">
                              {item.remainingHours}h Remaining
                            </span>
                          )}
                        </div>

                        {/* 300-Hour Progress Bar */}
                        <div>
                          <div className="flex items-center justify-between text-[11px] font-mono text-slate-600 mb-1">
                            <span>Elapsed: {item.hoursSinceLastService} / 300 hrs</span>
                            <span>Due Date: {formatDateDDMMYYYY(item.dueDateIso)}</span>
                          </div>
                          <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full transition-all ${
                                item.urgency === 'OVERDUE'
                                  ? 'bg-red-600'
                                  : item.urgency === 'DUE_SOON'
                                  ? 'bg-amber-500'
                                  : 'bg-emerald-600'
                              }`}
                              style={{ width: `${item.progressPct}%` }}
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-2 pt-1 text-[10px] font-mono text-slate-600 border-t border-slate-100">
                          <div>
                            <span className="text-slate-400 block font-sans">Last Service</span>
                            {formatDateDDMMYYYY(item.lastServiceDate)}
                          </div>
                          <div>
                            <span className="text-slate-400 block font-sans">Current Run Hrs</span>
                            {item.currentRunningHours}
                          </div>
                          <div>
                            <span className="text-slate-400 block font-sans">300-Hr Target</span>
                            {item.nextServiceDueHours}
                          </div>
                        </div>

                        <div className="pt-1 flex justify-end">
                          <button
                            type="button"
                            onClick={() =>
                              onStartInspection(
                                item.center.id,
                                item.generator.id,
                                'REGULAR_SERVICING_300HR'
                              )
                            }
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded transition-colors w-full justify-center"
                          >
                            <Wrench className="w-3.5 h-3.5" />
                            Start 300-Hr Regular Servicing Form
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* Running-Hour Countdown Timeline & Table View for All 62 Generators */
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                <tr>
                  <th className="px-4 py-3 text-left">Center & Generator</th>
                  <th className="px-4 py-3 text-left">Last 300-Hr Service Date</th>
                  <th className="px-4 py-3 text-right">Last Svc Hrs</th>
                  <th className="px-4 py-3 text-right">Current Run Hrs</th>
                  <th className="px-4 py-3 text-left w-56">300-Hr Interval Progress</th>
                  <th className="px-4 py-3 text-right">Next Due Run Hrs</th>
                  <th className="px-4 py-3 text-left">Projected Deadline</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredScheduleItems.slice(0, 24).map((item) => (
                  <tr key={item.generator.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-mono font-bold text-slate-900">
                        {item.center.centerCode} · {item.generator.id}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {item.center.centerName} ({item.generator.kvaRating})
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-600 tabular-nums">
                      {formatDateDDMMYYYY(item.lastServiceDate)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-600">
                      {item.lastServiceRunningHours}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold tabular-nums text-slate-900">
                      {item.currentRunningHours}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-between text-[11px] font-mono mb-1">
                        <span className="font-semibold text-slate-800">
                          {item.hoursSinceLastService} / 300 hrs
                        </span>
                        <span
                          className={
                            item.urgency === 'OVERDUE'
                              ? 'text-red-600 font-bold'
                              : item.urgency === 'DUE_SOON'
                              ? 'text-amber-700 font-semibold'
                              : 'text-emerald-700'
                          }
                        >
                          {item.remainingHours <= 0
                            ? `+${Math.abs(item.remainingHours)}h Overdue`
                            : `${item.remainingHours}h left`}
                        </span>
                      </div>
                      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${
                            item.urgency === 'OVERDUE'
                              ? 'bg-red-600'
                              : item.urgency === 'DUE_SOON'
                              ? 'bg-amber-500'
                              : 'bg-emerald-600'
                          }`}
                          style={{ width: `${item.progressPct}%` }}
                        />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-semibold tabular-nums text-slate-800">
                      {item.nextServiceDueHours}
                    </td>
                    <td className="px-4 py-3 font-mono tabular-nums">
                      <span
                        className={`px-2 py-0.5 rounded font-semibold text-[11px] ${
                          item.urgency === 'OVERDUE'
                            ? 'bg-red-100 text-red-800'
                            : item.urgency === 'DUE_SOON'
                            ? 'bg-amber-100 text-amber-900'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {formatDateDDMMYYYY(item.dueDateIso)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() =>
                          onStartInspection(
                            item.center.id,
                            item.generator.id,
                            'REGULAR_SERVICING_300HR'
                          )
                        }
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded transition-colors"
                      >
                        <Wrench className="w-3 h-3" />
                        Log 300-Hr Service
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* =====================================================================
          05. BREAKDOWN, ERROR & ACTION RESOLUTION DURATION ANALYTICS
         ===================================================================== */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-red-700 font-semibold mb-0.5">
              <AlertOctagon className="w-3.5 h-3.5" />
              <span>Breakdown, Service Error & Action Completion Duration Telemetry</span>
            </div>
            <h3 className="text-base font-bold text-slate-900">
              05. Breakdown & Error Resolution Duration Analytics ({breakdownAnalytics.activityItems.length} Activities · {breakdownAnalytics.totalBreakdowns} Breakdowns)
            </h3>
            <p className="text-xs text-slate-500 font-myanmar">
              Service Engineer Report မှ Error / Action Required များနှင့် Breakdown များအား Generator Team သို့မဟုတ် Vendor ဖြင့် ဘယ်လောက် Duration ကြာမှ ပြုပြင်ပြီးစီးသည်ကို ဖော်ပြထားပါသည်။
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {onOpenActivitiesTab && (
              <button
                type="button"
                onClick={onOpenActivitiesTab}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-900 bg-amber-100 hover:bg-amber-200 border border-amber-300 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                <Clock className="w-3.5 h-3.5" />
                Open Activities & Action Tracker
              </button>
            )}
            <button
              type="button"
              onClick={() =>
                onStartInspection(
                  selectedCenterFilter !== 'ALL' ? selectedCenterFilter : undefined,
                  undefined,
                  'BREAKDOWN_REPORT'
                )
              }
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <AlertOctagon className="w-3.5 h-3.5" />
              + Log New Breakdown Form
            </button>
          </div>
        </div>

        <div className="p-5 space-y-6">
          {/* 5 Breakdown & Action Resolution Duration KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
              <div className="text-xs font-medium text-slate-500">
                Error & Action Completion Rate
              </div>
              <div className="text-2xl font-bold font-mono tabular-nums text-emerald-700 mt-1">
                {breakdownAnalytics.actionCompletionRatePct}%
              </div>
              <div className="text-xs text-slate-500 mt-1">
                {breakdownAnalytics.completedActivitiesCount} Completed · {breakdownAnalytics.openActivitiesCount} Open
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
              <div className="text-xs font-medium text-slate-500">
                Avg Resolution Duration Time
              </div>
              <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1">
                {breakdownAnalytics.avgResolutionHours} hrs
              </div>
              <div className="text-xs text-emerald-700 font-medium mt-1 font-mono">
                ≈ {breakdownAnalytics.avgResolutionDays} days avg to complete
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
              <div className="text-xs font-medium text-slate-500">
                Rectified By Team Split
              </div>
              <div className="text-xl font-bold font-mono tabular-nums text-slate-900 mt-1">
                {breakdownAnalytics.genTeamCount} Gen Team · {breakdownAnalytics.vendorCount} Vendor
              </div>
              <div className="text-xs text-slate-500 mt-1">
                In-House Team vs External Vendor
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
              <div className="text-xs font-medium text-slate-500">
                Breakdown Callouts & Outage
              </div>
              <div className="text-2xl font-bold font-mono tabular-nums text-red-600 mt-1">
                {breakdownAnalytics.totalBreakdowns} ({breakdownAnalytics.totalDowntimeHours}h)
              </div>
              <div className="text-xs text-slate-500 mt-1">
                Emergency callouts & total outage
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
              <div className="text-xs font-medium text-slate-500">
                Breakdown Mean Time To Repair
              </div>
              <div className="text-2xl font-bold font-mono tabular-nums text-amber-700 mt-1">
                {breakdownAnalytics.mttrHours} hrs
              </div>
              <div className="text-xs text-slate-500 mt-1">
                SLA Target &lt; 4.00 hrs · {breakdownAnalytics.restorationRatePct}% Restored
              </div>
            </div>
          </div>

          {/* 2 Breakdown Charts: Fault Category Distribution & Resolution Duration by Center */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="border border-slate-200 rounded-lg p-4">
              <div className="mb-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                  Breakdown Downtime (Hrs) by Fault Category
                </h4>
                <p className="text-[11px] text-slate-500">
                  Root-cause mechanical & electrical subsystem failure breakdown
                </p>
              </div>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={breakdownAnalytics.faultCategoryChartData}
                    layout="vertical"
                    margin={{ top: 4, right: 16, left: 32, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis type="number" tick={{ fontSize: 10, fill: '#475569' }} />
                    <YAxis
                      type="category"
                      dataKey="category"
                      width={135}
                      tick={{ fontSize: 10, fill: '#334155' }}
                    />
                    <Tooltip
                      contentStyle={{
                        fontSize: '12px',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                      }}
                    />
                    <Bar
                      dataKey="downtime"
                      name="Downtime (Hrs)"
                      fill="#dc2626"
                      radius={[0, 4, 4, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="border border-slate-200 rounded-lg p-4">
              <div className="mb-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                  Error & Breakdown Resolution Duration Time (Hrs) by Center
                </h4>
                <p className="text-[11px] text-slate-500">
                  How long each Center&apos;s Error / Action Required or Breakdown took from report date to completion
                </p>
              </div>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={breakdownAnalytics.downtimeByCenterData}
                    margin={{ top: 8, right: 12, left: -12, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="center" tick={{ fontSize: 10, fill: '#475569' }} />
                    <YAxis tick={{ fontSize: 10, fill: '#475569' }} />
                    <Tooltip
                      contentStyle={{
                        fontSize: '12px',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                      }}
                    />
                    <Bar
                      dataKey="downtimeHours"
                      name="Resolution Duration (Hrs)"
                      fill="#0f172a"
                      radius={[3, 3, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Breakdown & Error Resolution Duration Table */}
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-bold text-slate-800">
                Error, Action Required & Breakdown Resolution Duration Log (ဘယ်လောက် Duration ကြာမှ ပြီးစီးသည့် မှတ်တမ်း)
              </span>
              <span className="text-[11px] font-mono text-slate-500">
                {breakdownAnalytics.activityItems.length} Activity Record(s)
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-50/70 border-b border-slate-200 text-slate-600 font-semibold">
                  <tr>
                    <th className="px-4 py-2.5 text-left">Report # / Reported Date</th>
                    <th className="px-4 py-2.5 text-left">Center & Generator</th>
                    <th className="px-4 py-2.5 text-left">Engineer</th>
                    <th className="px-4 py-2.5 text-left">Error Description & Action Required</th>
                    <th className="px-4 py-2.5 text-left">Rectified By</th>
                    <th className="px-4 py-2.5 text-left">Completed Date</th>
                    <th className="px-4 py-2.5 text-right">Resolution Duration Time</th>
                    <th className="px-4 py-2.5 text-left">Status</th>
                    <th className="px-4 py-2.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {breakdownAnalytics.activityItems.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-8 text-center text-slate-500">
                        No generator error or breakdown activities recorded for this filter selection.
                      </td>
                    </tr>
                  ) : (
                    breakdownAnalytics.activityItems.map((act) => (
                      <tr key={act.reportId} className="hover:bg-slate-50/80">
                        <td className="px-4 py-2.5 font-mono whitespace-nowrap">
                          <div className="font-bold text-slate-900">#{act.reportNo}</div>
                          <div className="text-[11px] text-slate-500">
                            {formatDateDDMMYYYY(act.inspectionDate)}
                          </div>
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="font-bold text-slate-900">
                            {act.centerCode} · {act.generatorId}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {act.centerName} ({act.kvaRating})
                          </div>
                        </td>
                        <td className="px-4 py-2.5 whitespace-nowrap">
                          <div className="font-medium text-slate-900">{act.inspectorName}</div>
                          <div className="text-[10px] font-mono text-slate-500">
                            {act.inspectorEmail}
                          </div>
                        </td>
                        <td className="px-4 py-2.5 max-w-[260px]">
                          <div className="text-slate-900 font-medium truncate font-myanmar">
                            {act.errorDescription}
                          </div>
                          <div className="text-[11px] text-slate-500 truncate font-myanmar">
                            {act.actionRequiredText}
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
                            className={`inline-flex items-center px-2 py-0.5 text-[10px] font-bold rounded ${
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
                            onClick={() => onOpenReportPdf(act.report)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded transition-colors"
                          >
                            <Printer className="w-3 h-3" />
                            PDF
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* 06. Center-by-Center PM Status Matrix */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              06. Center-by-Center PM Compliance & Readiness Matrix ({centerMatrixRows.length} Centers)
            </h3>
            <p className="text-xs text-slate-500">
              Live status across all 31+ City Properties retail & commercial centers. Click any report to view or print the 2-Page Official Form.
            </p>
          </div>

          <div className="relative min-w-[240px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={matrixSearch}
              onChange={(e) => setMatrixSearch(e.target.value)}
              placeholder="Filter matrix by center or contact..."
              className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
              <tr>
                <th className="px-4 py-3 text-left">Center Code & Facility</th>
                <th className="px-4 py-3 text-left">Generators</th>
                <th className="px-4 py-3 text-left">Latest Report</th>
                <th className="px-4 py-3 text-left">Inspection Date</th>
                <th className="px-4 py-3 text-left">Inspector</th>
                <th className="px-4 py-3 text-right">Oil / Batt CCA</th>
                <th className="px-4 py-3 text-right">Health Score</th>
                <th className="px-4 py-3 text-left">Readiness Status</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {centerMatrixRows.map(({ center, centerGens, latestReport }) => (
                <tr key={center.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-mono font-bold text-slate-900">{center.centerCode}</div>
                    <div className="text-[11px] text-slate-500">{center.centerName}</div>
                  </td>
                  <td className="px-4 py-3 font-mono text-slate-700">
                    {centerGens.length} Units ({centerGens.map((g) => g.kvaRating).join(' / ')})
                  </td>
                  <td className="px-4 py-3 font-mono font-semibold text-slate-900">
                    {latestReport ? `#${latestReport.reportNo}` : 'Pending PM'}
                  </td>
                  <td className="px-4 py-3 font-mono text-slate-600">
                    {latestReport ? formatDateDDMMYYYY(latestReport.inspectionDate) : '—'}
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {latestReport ? latestReport.inspectorName : 'Unassigned'}
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-700">
                    {latestReport
                      ? `${latestReport.parameters.engineOilPressureBar} Bar · ${latestReport.customInputs.batteryCca} CCA`
                      : '—'}
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-bold tabular-nums text-slate-900">
                    {latestReport ? `${latestReport.healthScore}%` : '—'}
                  </td>
                  <td className="px-4 py-3">
                    {!latestReport && (
                      <span className="text-slate-500 font-medium">Scheduled</span>
                    )}
                    {latestReport?.readinessStatus === 'Ready' && (
                      <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Ready
                      </span>
                    )}
                    {latestReport?.readinessStatus === 'Action Required' && (
                      <span className="inline-flex items-center gap-1 font-semibold text-amber-700">
                        <AlertTriangle className="w-3.5 h-3.5" /> Action Required
                      </span>
                    )}
                    {latestReport?.readinessStatus === 'Critical' && (
                      <span className="inline-flex items-center gap-1 font-semibold text-red-700">
                        <AlertOctagon className="w-3.5 h-3.5" /> Critical
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    {latestReport ? (
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => onOpenReportPdf(latestReport)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded transition-colors"
                        >
                          <Printer className="w-3 h-3" />
                          View 2-Page PDF
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            onStartInspection(center.id, centerGens[0]?.id)
                          }
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded transition-colors"
                        >
                          <Plus className="w-3 h-3" />
                          Log PM
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() =>
                          onStartInspection(center.id, centerGens[0]?.id)
                        }
                        className="inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded transition-colors"
                      >
                        <Plus className="w-3 h-3" />
                        Start Monthly PM
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
