import React, { useState, useMemo } from 'react';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  Filter,
  UserCheck,
  CheckCircle2,
  Clock,
  AlertTriangle,
  AlertOctagon,
  Wrench,
  ClipboardCheck,
  Building2,
  Search,
  User,
  ArrowRight,
  X,
  FileText,
  Mail,
  Bell,
  Trash2,
  Check,
  CalendarDays,
  ListFilter,
} from 'lucide-react';
import {
  Center,
  GeneratorAsset,
  DutyAssignment,
  DutyTaskType,
  DutyPriority,
  DutyStatus,
  UserProfile,
  UserRole,
  FormCategory,
} from '../types';

interface DutyCalendarModuleProps {
  assignments: DutyAssignment[];
  centers: Center[];
  generators: GeneratorAsset[];
  usersDirectory: UserProfile[];
  currentUser: UserProfile;
  onSaveAssignment: (assignment: DutyAssignment) => Promise<void>;
  onDeleteAssignment: (id: string) => Promise<void>;
  onStartInspection: (
    centerId?: string,
    generatorId?: string,
    formCategory?: FormCategory,
    assignmentId?: string
  ) => void;
  onViewReportPdfByNo?: (reportNo: string) => void;
}

export const DutyCalendarModule: React.FC<DutyCalendarModuleProps> = ({
  assignments,
  centers,
  generators,
  usersDirectory,
  currentUser,
  onSaveAssignment,
  onDeleteAssignment,
  onStartInspection,
  onViewReportPdfByNo,
}) => {
  const isChiefOrAdmin =
    currentUser.role === 'Chief Engineer' || currentUser.role === 'Administrator';
  const isFieldEngineer = currentUser.role === 'Field Engineer';

  // Navigation: Year & Month (Default to current view around October / November 2026)
  const [currentYear, setCurrentYear] = useState<number>(2026);
  const [currentMonth, setCurrentMonth] = useState<number>(10); // 0-indexed: 10 = November 2026

  // View mode
  const [viewMode, setViewMode] = useState<'month' | 'agenda'>('month');

  // Filters
  const [engineerFilter, setEngineerFilter] = useState<string>(
    isFieldEngineer ? currentUser.uid : 'ALL'
  );
  const [centerFilter, setCenterFilter] = useState<string>('ALL');
  const [taskTypeFilter, setTaskTypeFilter] = useState<'ALL' | DutyTaskType>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | DutyStatus>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Selected Date Modal / Drawer for Day details
  const [selectedDayDate, setSelectedDayDate] = useState<string | null>(null);

  // New / Edit Assignment Modal State
  const [isAssignModalOpen, setIsAssignModalOpen] = useState<boolean>(false);
  const [editingAssignment, setEditingAssignment] = useState<DutyAssignment | null>(null);

  // Form fields inside modal
  const [modalTaskType, setModalTaskType] = useState<DutyTaskType>('REGULAR_INSPECTION');
  const [modalCenterId, setModalCenterId] = useState<string>(centers[0]?.id || 'CTR-001');
  const [modalGenId, setModalGenId] = useState<string>(
    generators.find((g) => g.centerId === (centers[0]?.id || 'CTR-001'))?.id || 'GEN-001'
  );
  const [modalEngineerUid, setModalEngineerUid] = useState<string>('USR_ENG_01');
  const [modalDate, setModalDate] = useState<string>('2026-11-05');
  const [modalPriority, setModalPriority] = useState<DutyPriority>('Routine');
  const [modalNotes, setModalNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Available engineers from directory
  const availableEngineers = useMemo(() => {
    return usersDirectory.filter(
      (u) => u.role === 'Field Engineer' || u.role === 'Chief Engineer'
    );
  }, [usersDirectory]);

  // Generators for selected modal center
  const modalGenerators = useMemo(() => {
    return generators.filter((g) => g.centerId === modalCenterId);
  }, [generators, modalCenterId]);

  // Filtered assignments
  const filteredAssignments = useMemo(() => {
    return assignments.filter((a) => {
      if (engineerFilter !== 'ALL' && a.assignedEngineerUid !== engineerFilter) return false;
      if (centerFilter !== 'ALL' && a.centerId !== centerFilter) return false;
      if (taskTypeFilter !== 'ALL' && a.taskType !== taskTypeFilter) return false;
      if (statusFilter !== 'ALL' && a.status !== statusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesText =
          a.centerCode.toLowerCase().includes(q) ||
          a.centerName.toLowerCase().includes(q) ||
          a.assignedEngineerName.toLowerCase().includes(q) ||
          a.generatorLabel.toLowerCase().includes(q) ||
          (a.notes && a.notes.toLowerCase().includes(q));
        if (!matchesText) return false;
      }
      return true;
    });
  }, [assignments, engineerFilter, centerFilter, taskTypeFilter, statusFilter, searchQuery]);

  // Engineer Workload Distribution Stats
  const engineerWorkloadStats = useMemo(() => {
    const stats: Record<
      string,
      {
        uid: string;
        name: string;
        email: string;
        total: number;
        scheduled: number;
        completed: number;
        overdue: number;
      }
    > = {};

    availableEngineers.forEach((eng) => {
      stats[eng.uid] = {
        uid: eng.uid,
        name: eng.displayName,
        email: eng.email,
        total: 0,
        scheduled: 0,
        completed: 0,
        overdue: 0,
      };
    });

    const todayStr = '2026-10-31';

    assignments.forEach((a) => {
      if (!stats[a.assignedEngineerUid]) {
        stats[a.assignedEngineerUid] = {
          uid: a.assignedEngineerUid,
          name: a.assignedEngineerName,
          email: a.assignedEngineerEmail,
          total: 0,
          scheduled: 0,
          completed: 0,
          overdue: 0,
        };
      }
      const item = stats[a.assignedEngineerUid];
      item.total += 1;
      if (a.status === 'COMPLETED') {
        item.completed += 1;
      } else {
        item.scheduled += 1;
        if (a.scheduledDate < todayStr || a.priority === 'Overdue') {
          item.overdue += 1;
        }
      }
    });

    return Object.values(stats);
  }, [availableEngineers, assignments]);

  // Calendar Math: Days in currentMonth
  const calendarDays = useMemo(() => {
    const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay(); // 0 = Sun
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

    // Fill days array
    const days: Array<{
      dateStr: string;
      dayNum: number;
      isCurrentMonth: boolean;
      assignments: DutyAssignment[];
    }> = [];

    // Previous month padding
    const prevMonthDays = new Date(currentYear, currentMonth, 0).getDate();
    for (let i = firstDayOfMonth - 1; i >= 0; i--) {
      const dayNum = prevMonthDays - i;
      const m = currentMonth === 0 ? 12 : currentMonth;
      const y = currentMonth === 0 ? currentYear - 1 : currentYear;
      const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
      days.push({
        dateStr,
        dayNum,
        isCurrentMonth: false,
        assignments: filteredAssignments.filter((a) => a.scheduledDate === dateStr),
      });
    }

    // Current month days
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(
        day
      ).padStart(2, '0')}`;
      days.push({
        dateStr,
        dayNum: day,
        isCurrentMonth: true,
        assignments: filteredAssignments.filter((a) => a.scheduledDate === dateStr),
      });
    }

    // Next month padding to reach multiple of 7
    const remaining = (7 - (days.length % 7)) % 7;
    for (let i = 1; i <= remaining; i++) {
      const m = currentMonth === 11 ? 1 : currentMonth + 2;
      const y = currentMonth === 11 ? currentYear + 1 : currentYear;
      const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      days.push({
        dateStr,
        dayNum: i,
        isCurrentMonth: false,
        assignments: filteredAssignments.filter((a) => a.scheduledDate === dateStr),
      });
    }

    return days;
  }, [currentYear, currentMonth, filteredAssignments]);

  const monthNames = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  const openNewAssignModal = (initialDate?: string) => {
    const chosenCenter = centers[0] || null;
    const chosenGen = generators.find((g) => g.centerId === chosenCenter?.id) || null;

    setEditingAssignment(null);
    setModalTaskType('REGULAR_INSPECTION');
    setModalCenterId(chosenCenter?.id || 'CTR-001');
    setModalGenId(chosenGen?.id || 'GEN-001');
    setModalEngineerUid(availableEngineers[0]?.uid || 'USR_ENG_01');
    setModalDate(
      initialDate ||
        `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-05`
    );
    setModalPriority('Routine');
    setModalNotes('');
    setIsAssignModalOpen(true);
  };

  const openEditAssignModal = (assignment: DutyAssignment) => {
    setEditingAssignment(assignment);
    setModalTaskType(assignment.taskType);
    setModalCenterId(assignment.centerId);
    setModalGenId(assignment.generatorId);
    setModalEngineerUid(assignment.assignedEngineerUid);
    setModalDate(assignment.scheduledDate);
    setModalPriority(assignment.priority);
    setModalNotes(assignment.notes || '');
    setIsAssignModalOpen(true);
  };

  const handleModalSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalCenterId || !modalGenId || !modalEngineerUid || !modalDate) return;

    setIsSubmitting(true);
    try {
      const centerObj = centers.find((c) => c.id === modalCenterId);
      const genObj = generators.find((g) => g.id === modalGenId);
      const engObj = usersDirectory.find((u) => u.uid === modalEngineerUid);

      const assignmentPayload: DutyAssignment = {
        id: editingAssignment?.id || `DUTY-${modalDate.replace(/-/g, '').slice(0, 6)}-${String(Math.floor(Math.random() * 900) + 100)}`,
        taskType: modalTaskType,
        centerId: modalCenterId,
        centerCode: centerObj?.centerCode || 'CTR',
        centerName: centerObj?.centerName || 'Center',
        generatorId: modalGenId,
        generatorLabel: genObj?.generatorLabel || 'Genset #1',
        assignedEngineerUid: modalEngineerUid,
        assignedEngineerName: engObj?.displayName || 'Assigned Engineer',
        assignedEngineerEmail: engObj?.email || '',
        assignedByUid: currentUser.uid,
        assignedByName: `${currentUser.displayName || currentUser.uid} (${currentUser.role})`,
        scheduledDate: modalDate,
        priority: modalPriority,
        notes: modalNotes.trim(),
        status: editingAssignment?.status || 'SCHEDULED',
        completedReportId: editingAssignment?.completedReportId,
        completedReportNo: editingAssignment?.completedReportNo,
        completedAt: editingAssignment?.completedAt,
        createdAt: editingAssignment?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await onSaveAssignment(assignmentPayload);
      setIsAssignModalOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Day Drawer assignments
  const selectedDayAssignments = useMemo(() => {
    if (!selectedDayDate) return [];
    return filteredAssignments.filter((a) => a.scheduledDate === selectedDayDate);
  }, [selectedDayDate, filteredAssignments]);

  return (
    <div className="space-y-6">
      {/* =====================================================================
          1. HEADER & ACTION TOOLBAR
         ===================================================================== */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-lg bg-slate-900 text-white flex items-center justify-center shrink-0 shadow-2xs mt-0.5">
            <CalendarIcon className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-500 mb-0.5">
              <span>City Properties Generator Service Roster</span>
              <span aria-hidden="true">·</span>
              <span className="font-semibold text-slate-700">Gen SOP-002 Scheduling Engine</span>
              <span aria-hidden="true">·</span>
              <span className="text-emerald-700 font-medium">Auto-Completion Active</span>
            </div>
            <h2 className="text-lg font-bold text-slate-900">
              Engineer Duty &amp; Inspection Schedule Calendar
            </h2>
            <p className="text-xs text-slate-500 font-myanmar">
              Chief Engineer မှ Field Engineer များအား ပုံမှန်စစ်ဆေးခြင်း (Regular Inspection) နှင့် 300-Hr Servicing တာဝန်များ Assign ချမှတ်ခြင်းနှင့် Calendar တွင် အားလုံးစောင့်ကြည့်နိုင်သည့် စနစ်
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* View Mode Toggle */}
          <div className="inline-flex items-center p-1 bg-slate-100 rounded-lg text-xs font-semibold">
            <button
              type="button"
              onClick={() => setViewMode('month')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors ${
                viewMode === 'month'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <CalendarDays className="w-3.5 h-3.5" />
              <span>Month Grid</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('agenda')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors ${
                viewMode === 'agenda'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ListFilter className="w-3.5 h-3.5" />
              <span>Roster List ({filteredAssignments.length})</span>
            </button>
          </div>

          {/* Chief Engineer / Admin Assign Duty Button */}
          {isChiefOrAdmin && (
            <button
              type="button"
              onClick={() => openNewAssignModal()}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap shadow-2xs"
            >
              <Plus className="w-4 h-4 text-emerald-400" />
              <span>+ Assign Service Duty</span>
            </button>
          )}

          {/* Field Engineer Quick Filter Button */}
          {isFieldEngineer && (
            <button
              type="button"
              onClick={() =>
                setEngineerFilter((prev) => (prev === currentUser.uid ? 'ALL' : currentUser.uid))
              }
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg border transition-colors ${
                engineerFilter === currentUser.uid
                  ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
              }`}
            >
              <UserCheck className="w-4 h-4 text-emerald-600" />
              <span>{engineerFilter === currentUser.uid ? 'Showing: My Duties' : 'Show My Duties Only'}</span>
            </button>
          )}
        </div>
      </div>

      {/* =====================================================================
          2. ENGINEER WORKLOAD DISTRIBUTION STRIP
         ===================================================================== */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-slate-700" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
              Service Engineer Workload &amp; Assignment Balance
            </h3>
          </div>
          <span className="text-[11px] text-slate-500">
            Total {assignments.length} assigned tasks across 31 centers
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {engineerWorkloadStats.map((eng) => (
            <div
              key={eng.uid}
              onClick={() =>
                setEngineerFilter((prev) => (prev === eng.uid ? 'ALL' : eng.uid))
              }
              className={`p-3 rounded-lg border text-xs transition-all cursor-pointer ${
                engineerFilter === eng.uid
                  ? 'border-slate-900 bg-slate-50/80 shadow-2xs ring-1 ring-slate-900'
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50'
              }`}
            >
              <div className="flex items-center justify-between gap-1 mb-1">
                <span className="font-bold text-slate-900 truncate">{eng.name}</span>
                <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-slate-100 text-slate-700">
                  {eng.total} Duties
                </span>
              </div>
              <div className="text-[11px] text-slate-500 truncate mb-2">{eng.email}</div>
              <div className="flex items-center justify-between text-[11px] font-mono">
                <span className="text-amber-700 font-semibold">{eng.scheduled} Scheduled</span>
                <span className="text-emerald-700 font-semibold">{eng.completed} Completed</span>
                {eng.overdue > 0 && (
                  <span className="text-red-600 font-semibold">{eng.overdue} Overdue</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* =====================================================================
          3. INTERACTIVE FILTER TOOLBAR
         ===================================================================== */}
      <div className="bg-white border border-slate-200 rounded-lg p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[280px]">
          {/* Search Query */}
          <div className="relative min-w-[180px] max-w-xs flex-1">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search center, engineer, generator..."
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md focus:bg-white focus:outline-hidden focus:border-slate-900"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Engineer Selector */}
          <select
            value={engineerFilter}
            onChange={(e) => setEngineerFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-md font-medium text-slate-700 focus:outline-hidden focus:border-slate-900"
          >
            <option value="ALL">All Engineers ({availableEngineers.length})</option>
            {availableEngineers.map((e) => (
              <option key={e.uid} value={e.uid}>
                {e.displayName}
              </option>
            ))}
          </select>

          {/* Center Selector */}
          <select
            value={centerFilter}
            onChange={(e) => setCenterFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-md font-medium text-slate-700 focus:outline-hidden focus:border-slate-900 max-w-[200px]"
          >
            <option value="ALL">All Centers ({centers.length})</option>
            {centers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.centerCode} — {c.centerName}
              </option>
            ))}
          </select>

          {/* Task Type Filter */}
          <select
            value={taskTypeFilter}
            onChange={(e) => setTaskTypeFilter(e.target.value as 'ALL' | DutyTaskType)}
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-md font-medium text-slate-700 focus:outline-hidden focus:border-slate-900"
          >
            <option value="ALL">All Task Types</option>
            <option value="REGULAR_INSPECTION">Form 1: Regular Inspection</option>
            <option value="REGULAR_SERVICING_300HR">Form 2: 300-Hr Servicing</option>
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'ALL' | DutyStatus)}
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-md font-medium text-slate-700 focus:outline-hidden focus:border-slate-900"
          >
            <option value="ALL">All Statuses</option>
            <option value="SCHEDULED">Scheduled</option>
            <option value="COMPLETED">Completed</option>
          </select>
        </div>

        {/* Reset Filter Button */}
        {(engineerFilter !== 'ALL' ||
          centerFilter !== 'ALL' ||
          taskTypeFilter !== 'ALL' ||
          statusFilter !== 'ALL' ||
          searchQuery) && (
          <button
            type="button"
            onClick={() => {
              setEngineerFilter('ALL');
              setCenterFilter('ALL');
              setTaskTypeFilter('ALL');
              setStatusFilter('ALL');
              setSearchQuery('');
            }}
            className="text-xs text-slate-500 hover:text-slate-900 underline font-medium"
          >
            Reset Filters
          </button>
        )}
      </div>

      {/* =====================================================================
          4. MAIN VIEW: MONTH CALENDAR GRID
         ===================================================================== */}
      {viewMode === 'month' && (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-2xs">
          {/* Calendar Month Header Controls */}
          <div className="p-4 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h3 className="text-base font-bold text-slate-900">
                {monthNames[currentMonth]} {currentYear}
              </h3>
              <div className="hidden sm:flex items-center gap-2 text-xs text-slate-500">
                <span>·</span>
                <span>{filteredAssignments.length} Assignments in View</span>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handlePrevMonth}
                className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors"
                title="Previous Month"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setCurrentYear(2026);
                  setCurrentMonth(10); // November 2026
                }}
                className="px-2.5 py-1 text-xs font-semibold text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors"
              >
                Today (Oct/Nov 2026)
              </button>
              <button
                type="button"
                onClick={handleNextMonth}
                className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors"
                title="Next Month"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Weekday Names Header */}
          <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50/75 text-center text-xs font-semibold text-slate-600 py-2">
            <div>Sun</div>
            <div>Mon</div>
            <div>Tue</div>
            <div>Wed</div>
            <div>Thu</div>
            <div>Fri</div>
            <div>Sat</div>
          </div>

          {/* 7-Column Day Grid */}
          <div className="grid grid-cols-7 divide-x divide-y divide-slate-200 bg-slate-200/60">
            {calendarDays.map((cell, idx) => {
              const isToday = cell.dateStr === '2026-10-31';
              const hasAssignments = cell.assignments.length > 0;

              return (
                <div
                  key={`${cell.dateStr}-${idx}`}
                  onClick={() => {
                    if (isChiefOrAdmin && cell.assignments.length === 0) {
                      openNewAssignModal(cell.dateStr);
                    } else if (hasAssignments) {
                      setSelectedDayDate(cell.dateStr);
                    }
                  }}
                  className={`min-h-[110px] p-1.5 sm:p-2 bg-white transition-colors flex flex-col justify-between ${
                    !cell.isCurrentMonth ? 'bg-slate-50/60 text-slate-400' : ''
                  } ${isToday ? 'ring-2 ring-emerald-500 ring-inset bg-emerald-50/20' : ''} ${
                    hasAssignments ? 'hover:bg-slate-50/80 cursor-pointer' : isChiefOrAdmin ? 'hover:bg-slate-50/60 cursor-pointer' : ''
                  }`}
                >
                  {/* Top Bar of Day Cell: Day Number & Quick Add */}
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className={`text-xs font-mono font-bold ${
                        isToday
                          ? 'w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[11px]'
                          : cell.isCurrentMonth
                          ? 'text-slate-800'
                          : 'text-slate-400'
                      }`}
                    >
                      {cell.dayNum}
                    </span>

                    {isChiefOrAdmin && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          openNewAssignModal(cell.dateStr);
                        }}
                        className="opacity-0 group-hover:opacity-100 hover:opacity-100 text-slate-400 hover:text-slate-900 p-0.5 rounded transition-opacity"
                        title={`Assign Duty for ${cell.dateStr}`}
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    )}
                  </div>

                  {/* Duty Items on This Day */}
                  <div className="space-y-1 flex-1 overflow-hidden">
                    {cell.assignments.slice(0, 3).map((item) => {
                      const is300Hr = item.taskType === 'REGULAR_SERVICING_300HR';
                      const isDone = item.status === 'COMPLETED';

                      return (
                        <div
                          key={item.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedDayDate(cell.dateStr);
                          }}
                          className={`p-1 rounded text-[10px] font-medium leading-tight truncate border flex items-center justify-between gap-1 transition-all ${
                            isDone
                              ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                              : is300Hr
                              ? 'bg-purple-50 text-purple-900 border-purple-200'
                              : 'bg-blue-50 text-blue-900 border-blue-200'
                          }`}
                          title={`${item.taskType === 'REGULAR_SERVICING_300HR' ? '300-Hr Servicing' : 'Regular Inspection'} at ${item.centerCode} assigned to ${item.assignedEngineerName}`}
                        >
                          <span className="truncate">
                            <strong className="font-bold">{item.centerCode}</strong> · {item.assignedEngineerName.split(' ')[0]}
                          </span>
                          {isDone ? (
                            <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                          ) : is300Hr ? (
                            <Wrench className="w-3 h-3 text-purple-600 shrink-0" />
                          ) : (
                            <ClipboardCheck className="w-3 h-3 text-blue-600 shrink-0" />
                          )}
                        </div>
                      );
                    })}

                    {cell.assignments.length > 3 && (
                      <div className="text-[10px] font-mono font-semibold text-slate-500 pl-1">
                        +{cell.assignments.length - 3} more duties...
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* =====================================================================
          5. ALTERNATIVE VIEW: AGENDA ROSTER LIST
         ===================================================================== */}
      {viewMode === 'agenda' && (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-2xs">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">
              Scheduled Duties Roster ({filteredAssignments.length} Assignments)
            </h3>
            <span className="text-xs text-slate-500">Sorted by Scheduled Date</span>
          </div>

          <div className="divide-y divide-slate-200">
            {filteredAssignments.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                No duty assignments match the active filters.
              </div>
            ) : (
              filteredAssignments.map((duty) => {
                const is300Hr = duty.taskType === 'REGULAR_SERVICING_300HR';
                const isDone = duty.status === 'COMPLETED';
                const isAssignedToCurrent = duty.assignedEngineerUid === currentUser.uid;

                return (
                  <div
                    key={duty.id}
                    className="p-4 hover:bg-slate-50/80 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                          isDone
                            ? 'bg-emerald-100 text-emerald-800'
                            : is300Hr
                            ? 'bg-purple-100 text-purple-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {isDone ? (
                          <CheckCircle2 className="w-5 h-5" />
                        ) : is300Hr ? (
                          <Wrench className="w-5 h-5" />
                        ) : (
                          <ClipboardCheck className="w-5 h-5" />
                        )}
                      </div>

                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 text-sm">
                            {duty.centerCode} — {duty.centerName}
                          </span>
                          <span
                            className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                              isDone
                                ? 'bg-emerald-100 text-emerald-800'
                                : is300Hr
                                ? 'bg-purple-100 text-purple-800'
                                : 'bg-blue-100 text-blue-800'
                            }`}
                          >
                            {is300Hr ? '300-Hr Servicing' : 'Regular Inspection'}
                          </span>
                          <span
                            className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                              duty.priority === 'Overdue'
                                ? 'bg-red-100 text-red-800'
                                : duty.priority === 'High'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {duty.priority}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 text-slate-500 text-[11px]">
                          <span>{duty.generatorLabel}</span>
                          <span aria-hidden="true">·</span>
                          <span>Scheduled: <strong className="font-mono text-slate-800">{duty.scheduledDate}</strong></span>
                          <span aria-hidden="true">·</span>
                          <span>Assigned Engineer: <strong className="text-slate-800">{duty.assignedEngineerName}</strong></span>
                        </div>

                        {duty.notes && (
                          <p className="text-[11px] text-slate-600 mt-1 italic">
                            &ldquo;{duty.notes}&rdquo;
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Actions on this duty */}
                    <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                      {isDone && duty.completedReportNo && (
                        <button
                          type="button"
                          onClick={() => onViewReportPdfByNo?.(duty.completedReportNo!)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-md transition-colors"
                        >
                          <FileText className="w-3.5 h-3.5 text-emerald-700" />
                          <span>Report #{duty.completedReportNo}</span>
                        </button>
                      )}

                      {!isDone && (isAssignedToCurrent || isChiefOrAdmin) && (
                        <button
                          type="button"
                          onClick={() =>
                            onStartInspection(
                              duty.centerId,
                              duty.generatorId,
                              duty.taskType,
                              duty.id
                            )
                          }
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-md transition-colors shadow-2xs"
                        >
                          <span>Start Form</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {isChiefOrAdmin && (
                        <>
                          <button
                            type="button"
                            onClick={() => openEditAssignModal(duty)}
                            className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors"
                            title="Edit Assignment"
                          >
                            <CalendarIcon className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (confirm(`Cancel duty assignment for ${duty.centerCode}?`)) {
                                onDeleteAssignment(duty.id);
                              }
                            }}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                            title="Delete Assignment"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* =====================================================================
          6. MODAL: CREATE / EDIT DUTY ASSIGNMENT
         ===================================================================== */}
      {isAssignModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl border border-slate-200 max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center">
                  <CalendarIcon className="w-4 h-4 text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {editingAssignment ? 'Edit Duty Assignment' : 'Assign Engineer Service Duty'}
                  </h3>
                  <p className="text-xs text-slate-500 font-myanmar">
                    Chief Engineer တာဝန်ခွဲဝေမှုနှင့် ဇယားဆွဲခြင်း
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAssignModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleModalSave} className="space-y-4 text-xs">
              {/* Task Type Choice */}
              <div>
                <label className="block font-bold text-slate-700 mb-1.5">
                  Task Type (ဖောင်နှင့် စစ်ဆေးမှုအမျိုးအစား) *
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setModalTaskType('REGULAR_INSPECTION')}
                    className={`p-3 rounded-lg border text-left flex items-center gap-2 transition-all ${
                      modalTaskType === 'REGULAR_INSPECTION'
                        ? 'border-blue-600 bg-blue-50/70 text-blue-950 font-bold'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <ClipboardCheck className="w-4 h-4 text-blue-600 shrink-0" />
                    <div>
                      <div>Form 1: Regular Inspection</div>
                      <div className="text-[10px] font-normal text-slate-500">Monthly 25-Pt Routine</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setModalTaskType('REGULAR_SERVICING_300HR')}
                    className={`p-3 rounded-lg border text-left flex items-center gap-2 transition-all ${
                      modalTaskType === 'REGULAR_SERVICING_300HR'
                        ? 'border-purple-600 bg-purple-50/70 text-purple-950 font-bold'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <Wrench className="w-4 h-4 text-purple-600 shrink-0" />
                    <div>
                      <div>Form 2: 300-Hr Servicing</div>
                      <div className="text-[10px] font-normal text-slate-500">Filter &amp; Oil Overhaul</div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Center & Generator Selectors */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Center (စင်တာ) *
                  </label>
                  <select
                    value={modalCenterId}
                    onChange={(e) => {
                      const cid = e.target.value;
                      setModalCenterId(cid);
                      const matchingGen = generators.find((g) => g.centerId === cid);
                      if (matchingGen) setModalGenId(matchingGen.id);
                    }}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-800 focus:outline-hidden focus:border-slate-900"
                  >
                    {centers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.centerCode} — {c.centerName}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Generator (ဂျင်နရေတာ) *
                  </label>
                  <select
                    value={modalGenId}
                    onChange={(e) => setModalGenId(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-800 focus:outline-hidden focus:border-slate-900"
                  >
                    {modalGenerators.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.generatorLabel} ({g.kvaRating})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Assigned Engineer & Scheduled Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Assigned Service Engineer (တာဝန်ပေးအပ်မည့် အင်ဂျင်နီယာ) *
                  </label>
                  <select
                    value={modalEngineerUid}
                    onChange={(e) => setModalEngineerUid(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-800 focus:outline-hidden focus:border-slate-900"
                  >
                    {availableEngineers.map((e) => (
                      <option key={e.uid} value={e.uid}>
                        {e.displayName} ({e.role})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Scheduled Date (သတ်မှတ်ရက်စွဲ) *
                  </label>
                  <input
                    type="date"
                    value={modalDate}
                    onChange={(e) => setModalDate(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg font-mono font-medium text-slate-800 focus:outline-hidden focus:border-slate-900"
                    required
                  />
                </div>
              </div>

              {/* Priority Choice */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Priority (ဦးစားပေးအဆင့်)</label>
                <div className="flex items-center gap-2">
                  {(['Routine', 'High', 'Overdue'] as DutyPriority[]).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setModalPriority(p)}
                      className={`px-3 py-1.5 rounded-lg font-semibold border transition-colors ${
                        modalPriority === p
                          ? p === 'Overdue'
                            ? 'bg-red-600 text-white border-red-600'
                            : p === 'High'
                            ? 'bg-amber-600 text-white border-amber-600'
                            : 'bg-slate-900 text-white border-slate-900'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              {/* Specific Instructions / Notes */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Notes &amp; Instructions (အထူးညွှန်ကြားချက် / မှတ်ချက်)
                </label>
                <textarea
                  value={modalNotes}
                  onChange={(e) => setModalNotes(e.target.value)}
                  placeholder="e.g. Bring coolant top-up drum, check battery terminal corrosion noted in previous report..."
                  rows={2}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:bg-white focus:outline-hidden focus:border-slate-900"
                />
              </div>

              {/* Notification Banner preview */}
              <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-lg flex items-center gap-2.5 text-emerald-900">
                <Bell className="w-4 h-4 text-emerald-700 shrink-0" />
                <span className="text-[11px]">
                  Saving this duty will automatically notify the assigned engineer via in-app alerts and log an email dispatch event.
                </span>
              </div>

              {/* Modal Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAssignModalOpen(false)}
                  className="px-4 py-2 font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors flex items-center gap-1.5 shadow-2xs disabled:opacity-50"
                >
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span>{editingAssignment ? 'Update Assignment' : 'Assign & Notify Engineer'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================================
          7. MODAL: DAY ASSIGNMENTS DRAWER (When clicking on a date)
         ===================================================================== */}
      {selectedDayDate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl border border-slate-200 max-w-xl w-full p-6 space-y-4 shadow-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Duty Schedule for {selectedDayDate}
                </h3>
                <p className="text-xs text-slate-500">
                  {selectedDayAssignments.length} service assignment{selectedDayAssignments.length === 1 ? '' : 's'} on this date
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDayDate(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1 text-xs">
              {selectedDayAssignments.map((a) => {
                const is300Hr = a.taskType === 'REGULAR_SERVICING_300HR';
                const isDone = a.status === 'COMPLETED';
                const isAssignedToMe = a.assignedEngineerUid === currentUser.uid;

                return (
                  <div
                    key={a.id}
                    className={`p-3.5 rounded-lg border space-y-2 ${
                      isDone
                        ? 'bg-emerald-50/50 border-emerald-200'
                        : is300Hr
                        ? 'bg-purple-50/50 border-purple-200'
                        : 'bg-blue-50/50 border-blue-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 text-sm">
                          {a.centerCode} — {a.centerName}
                        </span>
                        <span
                          className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                            isDone
                              ? 'bg-emerald-100 text-emerald-800'
                              : is300Hr
                              ? 'bg-purple-100 text-purple-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}
                        >
                          {is300Hr ? '300-Hr Servicing' : 'Regular Inspection'}
                        </span>
                      </div>
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                          isDone ? 'bg-emerald-600 text-white' : 'bg-amber-600 text-white'
                        }`}
                      >
                        {a.status}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600">
                      <div>
                        Generator: <strong>{a.generatorLabel}</strong>
                      </div>
                      <div>
                        Assigned To: <strong>{a.assignedEngineerName}</strong>
                      </div>
                      <div>
                        Scheduled By: <strong>{a.assignedByName}</strong>
                      </div>
                      <div>
                        Priority: <strong className="text-slate-900">{a.priority}</strong>
                      </div>
                    </div>

                    {a.notes && (
                      <p className="text-[11px] text-slate-700 italic bg-white/70 p-2 rounded border border-slate-200/50">
                        &ldquo;{a.notes}&rdquo;
                      </p>
                    )}

                    <div className="pt-2 flex items-center justify-between border-t border-slate-200/60">
                      {isDone && a.completedReportNo ? (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedDayDate(null);
                            onViewReportPdfByNo?.(a.completedReportNo!);
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1 font-semibold text-emerald-800 bg-emerald-100 hover:bg-emerald-200 rounded transition-colors text-xs"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span>View Official Report #{a.completedReportNo}</span>
                        </button>
                      ) : (
                        <div className="text-[11px] text-slate-500">
                          Status: Pending Field Report Submission
                        </div>
                      )}

                      {!isDone && (isAssignedToMe || isChiefOrAdmin) && (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedDayDate(null);
                            onStartInspection(
                              a.centerId,
                              a.generatorId,
                              a.taskType,
                              a.id
                            );
                          }}
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors text-xs shadow-2xs"
                        >
                          <span>Start Inspection Now</span>
                          <ArrowRight className="w-3.5 h-3.5 text-emerald-400" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
              {isChiefOrAdmin && (
                <button
                  type="button"
                  onClick={() => {
                    const d = selectedDayDate;
                    setSelectedDayDate(null);
                    openNewAssignModal(d);
                  }}
                  className="inline-flex items-center gap-1 px-3 py-1.5 font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors text-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Assign Another Duty for {selectedDayDate}</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setSelectedDayDate(null)}
                className="px-4 py-1.5 font-semibold text-slate-600 hover:text-slate-900 text-xs ml-auto"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
