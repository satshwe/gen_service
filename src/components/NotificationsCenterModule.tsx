import React, { useState, useEffect, useMemo } from 'react';
import {
  Bell,
  Mail,
  AlertOctagon,
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Send,
  Save,
  Check,
  Building2,
  UserPlus,
  Trash2,
  RotateCcw,
  Search,
  Users,
} from 'lucide-react';
import {
  AlertNotification,
  NotificationRuleConfig,
  UserRole,
  Center,
  CenterRecipientPerson,
} from '../types';
import { INITIAL_CENTERS } from '../data/seedData';
import {
  evaluateCenterReceiptEmailRule,
  getDefaultCenterPeopleList,
  saveCenterEmailOverride,
  resetCenterEmailOverride,
  FIELD_ENGINEER_DIRECTORY,
} from '../utils/exportUtils';

interface NotificationsCenterModuleProps {
  notifications: AlertNotification[];
  configs: NotificationRuleConfig[];
  centers?: Center[];
  currentUserRole: UserRole;
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
  onSaveConfig: (updatedConfig: NotificationRuleConfig) => Promise<void>;
  onTriggerScheduledReminders: () => Promise<void>;
  onTriggerTestCriticalAlert: () => Promise<void>;
}

interface ServerEmailLog {
  id: string;
  triggerType: string;
  severity: string;
  subject: string;
  body: string;
  recipients: string[];
  centerCode: string;
  reportNo: string;
  sentAt: string;
  status: string;
}

const QUICK_PERSONNEL_OPTIONS = [
  { label: 'Chief Engineer (U Kyaw Swar)', role: 'Chief Engineer', email: 'chief.engineer@cityproperties.com.mm' },
  { label: 'Maintenance Lead', role: 'Maintenance Lead', email: 'maintenance.lead@cityproperties.com.mm' },
  { label: 'City Mall Sector Ops', role: 'City Mall Sector Lead', email: 'citymall.ops@cityproperties.com.mm' },
  { label: 'Ocean Sector Facility', role: 'Ocean Supercenter Sector Lead', email: 'ocean.facility@cityproperties.com.mm' },
  { label: 'Marketplace Sector', role: 'Marketplace Sector Manager', email: 'marketplace.ops@cityproperties.com.mm' },
  { label: 'Logistics / Cold Chain', role: 'DC & Cold Chain Head', email: 'logistics.eng@cityproperties.com.mm' },
  { label: 'Field Eng (Wai Phyo Kyaw)', role: 'Field Service Engineer', email: 'waiphyokyaw@cityproperties.com.mm' },
  { label: 'Field Eng (Kyaw Zin Hein)', role: 'Field Service Engineer', email: 'kyawzinhein@cityproperties.com.mm' },
  { label: 'Field Eng (Aung Ko Oo)', role: 'Field Service Engineer', email: 'aungkooo@cityproperties.com.mm' },
  { label: 'Admin (U Sat Shwe)', role: 'System Administrator', email: 'satshwe36@gmail.com' },
];

export const NotificationsCenterModule: React.FC<NotificationsCenterModuleProps> = ({
  notifications,
  configs,
  centers = INITIAL_CENTERS,
  currentUserRole,
  onMarkAsRead,
  onMarkAllAsRead,
  onSaveConfig,
  onTriggerScheduledReminders,
  onTriggerTestCriticalAlert,
}) => {
  const [activeTab, setActiveTab] = useState<'feed' | 'rules' | 'email_logs'>('feed');
  const [filterType, setFilterType] = useState<string>('ALL');
  const [editableConfigs, setEditableConfigs] = useState<NotificationRuleConfig[]>(configs);
  const [emailLogs, setEmailLogs] = useState<ServerEmailLog[]>([]);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);
  const [browserPushPermission, setBrowserPushPermission] = useState<string>(
    typeof window !== 'undefined' && 'Notification' in window
      ? Notification.permission
      : 'unsupported'
  );

  // =========================================================================
  // CENTER NAME-BASED RECIPIENT LIST CONFIGURATION STATE
  // =========================================================================
  const [selectedCenterCode, setSelectedCenterCode] = useState<string>(
    centers[0]?.centerCode || 'CMLSPL'
  );
  const [centerSearchQuery, setCenterSearchQuery] = useState<string>('');
  const [centerPeopleList, setCenterPeopleList] = useState<CenterRecipientPerson[]>([]);
  const [centerEmailsCsv, setCenterEmailsCsv] = useState<string>('');
  const [newPersonName, setNewPersonName] = useState<string>('');
  const [newPersonRole, setNewPersonRole] = useState<string>('Center Facility / Duty Engineer');
  const [newPersonEmail, setNewPersonEmail] = useState<string>('');
  const [centerDirectoryVersion, setCenterDirectoryVersion] = useState<number>(0);

  // Per-Trigger Rule Card Center Scope Selector ('GLOBAL' or a centerCode)
  const [ruleCenterScopeMap, setRuleCenterScopeMap] = useState<Record<string, string>>({});

  const isAdmin =
    currentUserRole === 'Administrator' || currentUserRole === 'Chief Engineer';
  const canTrigger = isAdmin || currentUserRole === 'Field Engineer';

  useEffect(() => {
    setEditableConfigs(configs);
  }, [configs]);

  const selectedCenterObj = useMemo(
    () =>
      centers.find((c) => c.centerCode === selectedCenterCode) ||
      centers[0],
    [centers, selectedCenterCode]
  );

  // Load selected Center's people & email list whenever selectedCenterCode changes
  useEffect(() => {
    if (!selectedCenterObj) return;
    const rule = evaluateCenterReceiptEmailRule(
      selectedCenterObj.centerCode,
      selectedCenterObj.centerName,
      selectedCenterObj.region
    );
    const people = getDefaultCenterPeopleList(
      selectedCenterObj.centerCode,
      selectedCenterObj.centerName,
      selectedCenterObj.contactPerson,
      selectedCenterObj.region
    );
    setCenterPeopleList(people);
    setCenterEmailsCsv(rule.autoReceiptEmails);
  }, [selectedCenterObj, centerDirectoryVersion]);

  const fetchServerEmailLogs = async () => {
    try {
      const res = await fetch('/api/notifications/email-logs');
      if (res.ok) {
        const data = await res.json();
        setEmailLogs(data.logs || []);
      }
    } catch {
      // Ignore if offline
    }
  };

  useEffect(() => {
    fetchServerEmailLogs();
  }, [notifications]);

  const handleRequestBrowserPush = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    try {
      const perm = await Notification.requestPermission();
      setBrowserPushPermission(perm);
      setFeedbackMsg(`Browser Push Notification permission status: ${perm.toUpperCase()}`);
      setTimeout(() => setFeedbackMsg(null), 3500);
    } catch {
      setFeedbackMsg('Browser notifications are restricted inside this preview frame.');
      setTimeout(() => setFeedbackMsg(null), 3500);
    }
  };

  // Add a new person (Name + Role + Email) to the selected Center's recipient list
  const handleAddPersonToCenter = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin || !selectedCenterObj) return;
    const trimmedEmail = newPersonEmail.trim();
    if (!trimmedEmail || !trimmedEmail.includes('@')) {
      setFeedbackMsg('Please enter a valid email address (e.g., manager@cityproperties.com.mm).');
      setTimeout(() => setFeedbackMsg(null), 3500);
      return;
    }
    const trimmedName =
      newPersonName.trim() || trimmedEmail.split('@')[0];
    const trimmedRole =
      newPersonRole.trim() || `Center Responsible Person (${selectedCenterObj.centerCode})`;

    const newPerson: CenterRecipientPerson = {
      id: `PER_${selectedCenterObj.centerCode}_${Date.now().toString(36).toUpperCase()}`,
      name: trimmedName,
      roleTitle: trimmedRole,
      email: trimmedEmail,
    };

    const updatedPeople = [...centerPeopleList, newPerson];
    const mergedEmails = Array.from(
      new Set([
        ...centerEmailsCsv
          .split(',')
          .map((em) => em.trim())
          .filter(Boolean),
        trimmedEmail,
      ])
    ).join(', ');

    setCenterPeopleList(updatedPeople);
    setCenterEmailsCsv(mergedEmails);
    setNewPersonName('');
    setNewPersonEmail('');
  };

  const handleRemovePersonFromCenter = (personId: string, personEmail: string) => {
    if (!isAdmin) return;
    const updatedPeople = centerPeopleList.filter((p) => p.id !== personId);
    const updatedEmails = centerEmailsCsv
      .split(',')
      .map((e) => e.trim())
      .filter((e) => e && e.toLowerCase() !== personEmail.toLowerCase())
      .join(', ');
    setCenterPeopleList(updatedPeople);
    setCenterEmailsCsv(updatedEmails);
  };

  const handleToggleQuickPersonForCenter = (item: {
    label: string;
    role: string;
    email: string;
  }) => {
    if (!isAdmin || !selectedCenterObj) return;
    const currentEmails = centerEmailsCsv
      .split(',')
      .map((e) => e.trim())
      .filter(Boolean);
    const exists = currentEmails.some(
      (e) => e.toLowerCase() === item.email.toLowerCase()
    );

    if (exists) {
      const nextEmails = currentEmails
        .filter((e) => e.toLowerCase() !== item.email.toLowerCase())
        .join(', ');
      const nextPeople = centerPeopleList.filter(
        (p) => p.email.toLowerCase() !== item.email.toLowerCase()
      );
      setCenterEmailsCsv(nextEmails);
      setCenterPeopleList(nextPeople);
    } else {
      const nextEmails = [...currentEmails, item.email].join(', ');
      const nextPeople: CenterRecipientPerson[] = [
        ...centerPeopleList,
        {
          id: `PER_${selectedCenterObj.centerCode}_${Date.now().toString(36)}`,
          name: item.label,
          roleTitle: item.role,
          email: item.email,
        },
      ];
      setCenterEmailsCsv(nextEmails);
      setCenterPeopleList(nextPeople);
    }
  };

  const handleSaveCenterRecipientList = async () => {
    if (!isAdmin || !selectedCenterObj) return;
    const code = selectedCenterObj.centerCode;
    await saveCenterEmailOverride(
      code,
      selectedCenterObj.centerName,
      selectedCenterObj.region,
      centerEmailsCsv,
      centerPeopleList
    );

    // Also update all editable trigger configs' centerRecipientsMap for this centerCode
    const updatedConfigs = editableConfigs.map((cfg) => ({
      ...cfg,
      centerRecipientsMap: {
        ...(cfg.centerRecipientsMap || {}),
        [code]: centerEmailsCsv,
      },
      centerPeopleMap: {
        ...(cfg.centerPeopleMap || {}),
        [code]: centerPeopleList,
      },
      updatedAt: new Date().toISOString(),
    }));
    setEditableConfigs(updatedConfigs);
    for (const cfg of updatedConfigs) {
      await onSaveConfig(cfg);
    }

    setCenterDirectoryVersion((v) => v + 1);
    setFeedbackMsg(
      `Saved Center Email Recipient List for ${selectedCenterObj.centerCode} — ${selectedCenterObj.centerName} (${centerPeopleList.length} recipients).`
    );
    setTimeout(() => setFeedbackMsg(null), 4000);
  };

  const handleResetCenterRecipientList = async () => {
    if (!isAdmin || !selectedCenterObj) return;
    const rule = resetCenterEmailOverride(
      selectedCenterObj.centerCode,
      selectedCenterObj.centerName,
      selectedCenterObj.region
    );
    const defaultPeople = getDefaultCenterPeopleList(
      selectedCenterObj.centerCode,
      selectedCenterObj.centerName,
      selectedCenterObj.contactPerson,
      selectedCenterObj.region
    );
    setCenterPeopleList(defaultPeople);
    setCenterEmailsCsv(rule.autoReceiptEmails);
    setCenterDirectoryVersion((v) => v + 1);
    setFeedbackMsg(
      `Reset ${selectedCenterObj.centerCode} (${selectedCenterObj.centerName}) to default Sector & Center rule recipients.`
    );
    setTimeout(() => setFeedbackMsg(null), 3500);
  };

  const handleUpdateConfigField = (
    id: string,
    field: keyof NotificationRuleConfig,
    value: any
  ) => {
    setEditableConfigs((prev) =>
      prev.map((c) => (c.id === id ? { ...c, [field]: value } : c))
    );
  };

  const handleUpdateRuleScopedRecipients = (
    cfg: NotificationRuleConfig,
    scopeCenterCode: string,
    nextCsv: string
  ) => {
    if (scopeCenterCode === 'GLOBAL') {
      handleUpdateConfigField(cfg.id, 'recipientsCsv', nextCsv);
    } else {
      handleUpdateConfigField(cfg.id, 'centerRecipientsMap', {
        ...(cfg.centerRecipientsMap || {}),
        [scopeCenterCode]: nextCsv,
      });
    }
  };

  const handleSaveRuleClick = async (cfg: NotificationRuleConfig) => {
    const scopeCenterCode = ruleCenterScopeMap[cfg.id] || 'GLOBAL';
    await onSaveConfig({
      ...cfg,
      updatedAt: new Date().toISOString(),
    });
    if (scopeCenterCode !== 'GLOBAL' && cfg.centerRecipientsMap?.[scopeCenterCode]) {
      const matchedCenter = centers.find((c) => c.centerCode === scopeCenterCode);
      if (matchedCenter) {
        await saveCenterEmailOverride(
          matchedCenter.centerCode,
          matchedCenter.centerName,
          matchedCenter.region,
          cfg.centerRecipientsMap[scopeCenterCode]
        );
        setCenterDirectoryVersion((v) => v + 1);
      }
    }
    setFeedbackMsg(
      scopeCenterCode === 'GLOBAL'
        ? `Saved global recipient & trigger configuration for "${cfg.name}".`
        : `Saved Center-specific recipient rule (${scopeCenterCode}) for "${cfg.name}".`
    );
    setTimeout(() => setFeedbackMsg(null), 3500);
  };

  const filteredCentersOverview = useMemo(() => {
    return centers.filter((c) => {
      if (!centerSearchQuery.trim()) return true;
      const q = centerSearchQuery.toLowerCase();
      return (
        c.centerCode.toLowerCase().includes(q) ||
        c.centerName.toLowerCase().includes(q) ||
        c.contactPerson.toLowerCase().includes(q) ||
        c.region.toLowerCase().includes(q)
      );
    });
  }, [centers, centerSearchQuery, centerDirectoryVersion]);

  const filteredNotifications = notifications.filter((n) => {
    if (filterType !== 'ALL' && n.triggerType !== filterType) return false;
    return true;
  });

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="space-y-6">
      {/* Header & Quick Trigger Bar */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
            <span>Real-Time In-App Push & Email Dispatch</span>
            <span aria-hidden="true">·</span>
            <span>{unreadCount} Unread Alerts</span>
          </div>
          <h2 className="text-lg font-bold text-slate-900">
            Generator Alert Triggers, Push Notifications & Center Email Recipient Rules
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {browserPushPermission !== 'granted' && browserPushPermission !== 'unsupported' && (
            <button
              type="button"
              onClick={handleRequestBrowserPush}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <Bell className="w-3.5 h-3.5" />
              Enable Browser Push
            </button>
          )}

          <button
            type="button"
            disabled={!canTrigger}
            onClick={async () => {
              await onTriggerScheduledReminders();
              await fetchServerEmailLogs();
              setFeedbackMsg('Scheduled Monthly PM Reminders dispatched to configured recipients.');
              setTimeout(() => setFeedbackMsg(null), 4000);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-800 bg-white border border-slate-300 hover:bg-slate-50 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            <CalendarClock className="w-3.5 h-3.5" />
            Run Scheduled PM Reminder Check
          </button>

          <button
            type="button"
            disabled={!canTrigger}
            onClick={async () => {
              await onTriggerTestCriticalAlert();
              await fetchServerEmailLogs();
              setFeedbackMsg('Critical Readiness Alert & Email dispatched to recipient list.');
              setTimeout(() => setFeedbackMsg(null), 4000);
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            <Send className="w-3.5 h-3.5" />
            Test Critical Alert & Email
          </button>
        </div>
      </div>

      {feedbackMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-950 px-4 py-2.5 rounded-lg text-xs font-medium flex items-center justify-between">
          <span>{feedbackMsg}</span>
          <button
            type="button"
            onClick={() => setFeedbackMsg(null)}
            className="text-emerald-700 hover:text-emerald-950 font-semibold"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Segmented Navigation */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="inline-flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg">
          <button
            type="button"
            onClick={() => setActiveTab('feed')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'feed'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Live Push Alert Feed ({notifications.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('rules')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'rules'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Trigger & Recipient Configuration ({centers.length} Centers · {configs.length} Rules)
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('email_logs');
              fetchServerEmailLogs();
            }}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'email_logs'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Dispatched Email Delivery Logs ({emailLogs.length})
          </button>
        </div>

        {activeTab === 'feed' && (
          <div className="flex items-center gap-3">
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-3 py-1.5 text-xs font-medium border border-slate-300 rounded-lg bg-white"
            >
              <option value="ALL">All Alert Triggers</option>
              <option value="CRITICAL_READINESS">Critical Readiness</option>
              <option value="BAD_CHECKLIST_ITEM">Checklist Item Marked Bad</option>
              <option value="MAINTENANCE_REMINDER">Scheduled Maintenance Reminders</option>
            </select>

            {unreadCount > 0 && (
              <button
                type="button"
                onClick={onMarkAllAsRead}
                className="text-xs font-semibold text-slate-700 hover:text-slate-900 underline"
              >
                Mark all {unreadCount} read
              </button>
            )}
          </div>
        )}
      </div>

      {/* TAB 1: LIVE PUSH ALERT FEED */}
      {activeTab === 'feed' && (
        <div className="bg-white border border-slate-200 rounded-lg divide-y divide-slate-200">
          {filteredNotifications.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">
              No notifications match your current filter. Save an inspection with a Bad item or Critical status, or click "Test Critical Alert & Email" above.
            </div>
          ) : (
            filteredNotifications.map((n) => (
              <div
                key={n.id}
                className={`p-4 flex flex-col sm:flex-row sm:items-start justify-between gap-4 transition-colors ${
                  n.read ? 'bg-white' : 'bg-slate-50/90'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 shrink-0">
                    {n.severity === 'Critical' && (
                      <AlertOctagon className="w-5 h-5 text-red-600" />
                    )}
                    {n.severity === 'Warning' && (
                      <AlertTriangle className="w-5 h-5 text-amber-600" />
                    )}
                    {n.severity === 'Info' && (
                      <CalendarClock className="w-5 h-5 text-slate-700" />
                    )}
                  </div>
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-bold text-slate-900">{n.title}</span>
                      {!n.read && (
                        <span className="text-[11px] font-bold text-amber-700">
                          · UNREAD
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-700 leading-relaxed">{n.message}</p>
                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500 pt-1">
                      <span className="font-mono">{n.centerCode}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono">Report #{n.reportNo}</span>
                      <span aria-hidden="true">·</span>
                      <span className="inline-flex items-center gap-1">
                        <Mail className="w-3 h-3" />
                        Recipients: {n.recipientsSummary}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono">
                        {new Date(n.createdAt).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {n.emailDispatched && (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Email Sent
                    </span>
                  )}
                  {!n.read && (
                    <button
                      type="button"
                      onClick={() => onMarkAsRead(n.id)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded transition-colors"
                    >
                      <Check className="w-3 h-3" />
                      Mark Read
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* TAB 2: TRIGGER & RECIPIENT LIST CONFIGURATION (WITH CENTER-BY-CENTER RECIPIENT MANAGER) */}
      {activeTab === 'rules' && (
        <div className="space-y-6">
          {!isAdmin && (
            <div className="bg-amber-50 border border-amber-200 text-amber-900 px-4 py-3 rounded-lg text-xs">
              Note: Viewing in <strong>{currentUserRole}</strong> mode. Only users with{' '}
              <strong>Administrator</strong> or <strong>Chief Engineer</strong> role can modify alert triggers and Center email recipient lists.
            </div>
          )}

          {/* =================================================================
              SECTION 1: CENTER NAME-BASED EMAIL RECIPIENT LIST MANAGER
              (Center Name အလိုက် Email ပို့ရမည့် လူစာရင်း ထည့်သွင်း/သတ်မှတ်ရန်)
             ================================================================= */}
          <div className="bg-white border-2 border-slate-900 rounded-lg overflow-hidden">
            <div className="p-4 sm:p-5 bg-slate-900 text-white flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300 mb-0.5">
                  <Building2 className="w-4 h-4 text-emerald-400" />
                  <span>Center-by-Center Email Recipient Directory ({centers.length} Centers)</span>
                </div>
                <h3 className="text-base font-bold text-white">
                  Center Name-Based Email Recipient List Configuration (Center Name အလိုက် Email ပို့ရမည့် လူစာရင်း သတ်မှတ်ရန်)
                </h3>
                <p className="text-xs text-slate-300 font-myanmar mt-0.5">
                  သက်ဆိုင်ရာ Center Name တစ်ခုချင်းစီအလိုက် Report နှင့် Alert Email ပေးပို့ရမည့် တာဝန်ရှိသူများ (အမည်၊ ရာထူးနှင့် Email) စာရင်းကို စိတ်ကြိုက် ထည့်သွင်းသတ်မှတ်နိုင်ပါသည်။
                </p>
              </div>

              {/* Center Name Selector Dropdown */}
              <div className="lg:w-[380px] shrink-0">
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  Select Center Name to Configure (Center ရွေးချယ်ရန်):
                </label>
                <select
                  value={selectedCenterCode}
                  onChange={(e) => setSelectedCenterCode(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-bold border border-slate-700 rounded-lg bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                >
                  {centers.map((c) => (
                    <option key={c.id} value={c.centerCode}>
                      {c.centerCode} — {c.centerName} ({c.region})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {selectedCenterObj && (
              <div className="p-5 space-y-5">
                {/* Selected Center Info Bar */}
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div className="space-y-0.5">
                    <div className="font-bold text-slate-900 flex flex-wrap items-center gap-2">
                      <span className="font-mono px-2 py-0.5 bg-slate-900 text-white rounded">
                        {selectedCenterObj.centerCode}
                      </span>
                      <span>{selectedCenterObj.centerName}</span>
                      <span className="text-slate-400">·</span>
                      <span className="text-slate-600">{selectedCenterObj.region}</span>
                    </div>
                    <div className="text-slate-500">
                      Facility Contact: <strong className="text-slate-800">{selectedCenterObj.contactPerson}</strong> ({selectedCenterObj.contactPhone}) · Address: {selectedCenterObj.address}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="px-2.5 py-1 font-mono font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded">
                      {centerPeopleList.length} Configured Person(s)
                    </span>
                  </div>
                </div>

                {/* Add New Recipient Person Form (အမည် + ရာထူး + Email ထည့်ရန်) */}
                <form
                  onSubmit={handleAddPersonToCenter}
                  className="bg-emerald-50/60 border border-emerald-200 rounded-lg p-4 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <UserPlus className="w-4 h-4 text-emerald-700" />
                      Add Recipient Person for {selectedCenterObj.centerCode} — {selectedCenterObj.centerName} (Email ပို့ရမည့်သူ အသစ်ထည့်ရန်)
                    </h4>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                    <div className="sm:col-span-3">
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Person Name (အမည်)
                      </label>
                      <input
                        type="text"
                        disabled={!isAdmin}
                        value={newPersonName}
                        onChange={(e) => setNewPersonName(e.target.value)}
                        placeholder="e.g., U Soe Nyein Oo"
                        className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white disabled:bg-slate-50"
                      />
                    </div>

                    <div className="sm:col-span-4">
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Position / Department (ရာထူး / ဌာန)
                      </label>
                      <input
                        type="text"
                        disabled={!isAdmin}
                        value={newPersonRole}
                        onChange={(e) => setNewPersonRole(e.target.value)}
                        placeholder="e.g., Center Manager / Duty Engineer"
                        className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white disabled:bg-slate-50"
                      />
                    </div>

                    <div className="sm:col-span-3">
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Email Address (Email လိပ်စာ)
                      </label>
                      <input
                        type="email"
                        disabled={!isAdmin}
                        value={newPersonEmail}
                        onChange={(e) => setNewPersonEmail(e.target.value)}
                        placeholder="manager@cityproperties.com.mm"
                        className="w-full px-3 py-1.5 text-xs font-mono border border-slate-300 rounded-lg bg-white disabled:bg-slate-50"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <button
                        type="submit"
                        disabled={!isAdmin}
                        className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap"
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                        + Add Person
                      </button>
                    </div>
                  </div>
                </form>

                {/* Configured Recipient People Table for Selected Center */}
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-slate-700" />
                      Configured Recipient People List for {selectedCenterObj.centerCode} ({centerPeopleList.length} People)
                    </span>
                    <span className="text-[11px] text-slate-500 font-myanmar">
                      Form နှင့် Alert များတွင် အလိုအလျောက် ပေါ်မည့် လူစာရင်း
                    </span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-slate-50/70 border-b border-slate-200 text-slate-600 font-semibold">
                        <tr>
                          <th className="px-3 py-2 text-left w-12">Sr</th>
                          <th className="px-3 py-2 text-left">Recipient Name (အမည်)</th>
                          <th className="px-3 py-2 text-left">Role / Responsibility (ရာထူး/တာဝန်)</th>
                          <th className="px-3 py-2 text-left">Email Address</th>
                          <th className="px-3 py-2 text-right w-20">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {centerPeopleList.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                              No recipients configured for this Center yet. Add a person above or click a Quick-Toggle button below.
                            </td>
                          </tr>
                        ) : (
                          centerPeopleList.map((person, idx) => (
                            <tr key={person.id} className="hover:bg-slate-50/80">
                              <td className="px-3 py-2 font-mono text-slate-500">{idx + 1}</td>
                              <td className="px-3 py-2 font-semibold text-slate-900">
                                {person.name}
                              </td>
                              <td className="px-3 py-2 text-slate-600">{person.roleTitle}</td>
                              <td className="px-3 py-2 font-mono font-medium text-emerald-800">
                                {person.email}
                              </td>
                              <td className="px-3 py-2 text-right">
                                <button
                                  type="button"
                                  disabled={!isAdmin}
                                  onClick={() =>
                                    handleRemovePersonFromCenter(person.id, person.email)
                                  }
                                  className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-red-600 hover:bg-red-50 rounded disabled:opacity-40"
                                  title="Remove person from Center recipient list"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  Remove
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Comma-Separated Email Input & Save / Reset Controls for Selected Center */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-end">
                  <div className="lg:col-span-8">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      {selectedCenterObj.centerCode} — {selectedCenterObj.centerName} Combined Recipient Emails (Comma-separated):
                    </label>
                    <input
                      type="text"
                      disabled={!isAdmin}
                      value={centerEmailsCsv}
                      onChange={(e) => setCenterEmailsCsv(e.target.value)}
                      placeholder="e.g., cmlspl.facility@cityproperties.com.mm, citymall.ops@cityproperties.com.mm"
                      className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg bg-white disabled:bg-slate-50"
                    />
                  </div>

                  <div className="lg:col-span-4 flex flex-wrap items-center justify-end gap-2">
                    <button
                      type="button"
                      disabled={!isAdmin}
                      onClick={handleResetCenterRecipientList}
                      className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Reset Default
                    </button>
                    <button
                      type="button"
                      disabled={!isAdmin}
                      onClick={handleSaveCenterRecipientList}
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap"
                    >
                      <Save className="w-3.5 h-3.5" />
                      Save {selectedCenterObj.centerCode} Recipient List
                    </button>
                  </div>
                </div>

                {/* Quick-Toggle Personnel & Field Engineers for Selected Center */}
                <div className="pt-2 border-t border-slate-100 space-y-1.5">
                  <div className="text-[11px] font-semibold text-slate-500">
                    Quick-Toggle Sector Responsible Persons & Field Engineers for {selectedCenterObj.centerCode}:
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {QUICK_PERSONNEL_OPTIONS.map((item) => {
                      const currentList = centerEmailsCsv
                        .split(',')
                        .map((e) => e.trim())
                        .filter(Boolean);
                      const isIncluded = currentList.some(
                        (e) => e.toLowerCase() === item.email.toLowerCase()
                      );
                      return (
                        <button
                          key={item.email}
                          type="button"
                          disabled={!isAdmin}
                          onClick={() => handleToggleQuickPersonForCenter(item)}
                          className={`inline-flex items-center gap-1 px-2 py-1 text-[11px] font-mono rounded border transition-colors disabled:opacity-50 ${
                            isIncluded
                              ? 'bg-slate-900 text-white border-slate-900 font-semibold'
                              : 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100'
                          }`}
                        >
                          <span>{isIncluded ? '✓' : '+'}</span>
                          <span className="font-sans font-medium">{item.label}:</span>
                          <span>{item.email}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* All 31+ Centers Recipient Summary & Quick-Select Matrix */}
                <div className="pt-4 border-t border-slate-200 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                        All Centers Email Recipient Routing Matrix ({filteredCentersOverview.length} Centers)
                      </h4>
                      <p className="text-[11px] text-slate-500 font-myanmar">
                        Center တစ်ခုချင်းစီ၏ သတ်မှတ်ထားသော Email လူစာရင်းများကို ကြည့်ရှုပြီး "Configure List" နှိပ်၍ ပြင်ဆင်နိုင်ပါသည်။
                      </p>
                    </div>
                    <div className="relative sm:w-64">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={centerSearchQuery}
                        onChange={(e) => setCenterSearchQuery(e.target.value)}
                        placeholder="Search center code or name..."
                        className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
                      />
                    </div>
                  </div>

                  <div className="border border-slate-200 rounded-lg overflow-hidden max-h-64 overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold sticky top-0">
                        <tr>
                          <th className="px-3 py-2 text-left">Center Name & Code</th>
                          <th className="px-3 py-2 text-left">Sector & Region</th>
                          <th className="px-3 py-2 text-left">Center Contact</th>
                          <th className="px-3 py-2 text-left">Configured Recipient Emails</th>
                          <th className="px-3 py-2 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {filteredCentersOverview.map((c) => {
                          const rule = evaluateCenterReceiptEmailRule(
                            c.centerCode,
                            c.centerName,
                            c.region
                          );
                          const isSelected = c.centerCode === selectedCenterCode;
                          return (
                            <tr
                              key={c.id}
                              className={
                                isSelected ? 'bg-emerald-50/70' : 'hover:bg-slate-50/80'
                              }
                            >
                              <td className="px-3 py-2">
                                <div className="font-mono font-bold text-slate-900 flex items-center gap-1.5">
                                  <span>{c.centerCode}</span>
                                  {rule.isCustomConfigured && (
                                    <span className="px-1.5 py-0.5 text-[9px] font-sans font-bold bg-emerald-700 text-white rounded">
                                      CUSTOM
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] text-slate-600">{c.centerName}</div>
                              </td>
                              <td className="px-3 py-2">
                                <div className="font-medium text-slate-800">{rule.sectorName}</div>
                                <div className="text-[11px] text-slate-500">{c.region}</div>
                              </td>
                              <td className="px-3 py-2">
                                <div className="font-medium text-slate-800">{c.contactPerson}</div>
                                <div className="text-[10px] font-mono text-slate-500">
                                  {c.contactPhone}
                                </div>
                              </td>
                              <td className="px-3 py-2 font-mono text-[11px] text-slate-700 max-w-md">
                                {rule.autoReceiptEmails}
                              </td>
                              <td className="px-3 py-2 text-right whitespace-nowrap">
                                <button
                                  type="button"
                                  onClick={() => setSelectedCenterCode(c.centerCode)}
                                  className={`px-2.5 py-1 text-[11px] font-semibold rounded transition-colors ${
                                    isSelected
                                      ? 'bg-slate-900 text-white'
                                      : 'bg-slate-100 text-slate-800 hover:bg-slate-200'
                                  }`}
                                >
                                  {isSelected ? 'Editing Now' : 'Configure List'}
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* =================================================================
              SECTION 2: ALERT TRIGGER RULES WITH PER-CENTER RECIPIENT SCOPE
             ================================================================= */}
          {editableConfigs.map((cfg) => {
            const scopeCenterCode = ruleCenterScopeMap[cfg.id] || 'GLOBAL';
            const selectedScopeCenter = centers.find(
              (c) => c.centerCode === scopeCenterCode
            );
            const activeEmailsCsv =
              scopeCenterCode === 'GLOBAL'
                ? cfg.recipientsCsv
                : cfg.centerRecipientsMap?.[scopeCenterCode] ??
                  evaluateCenterReceiptEmailRule(
                    scopeCenterCode,
                    selectedScopeCenter?.centerName,
                    selectedScopeCenter?.region
                  ).autoReceiptEmails;

            return (
              <div
                key={cfg.id}
                className="bg-white border border-slate-200 rounded-lg p-5 space-y-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-slate-900">{cfg.name}</h3>
                      <span className="text-xs font-mono text-slate-500">
                        ({cfg.triggerType})
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">{cfg.description}</p>
                  </div>

                  <div className="flex items-center gap-4 text-xs">
                    <label className="inline-flex items-center gap-1.5 font-medium text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        disabled={!isAdmin}
                        checked={cfg.enabled}
                        onChange={(e) =>
                          handleUpdateConfigField(cfg.id, 'enabled', e.target.checked)
                        }
                        className="rounded border-slate-300"
                      />
                      Trigger Active
                    </label>

                    <label className="inline-flex items-center gap-1.5 font-medium text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        disabled={!isAdmin}
                        checked={cfg.inAppPushEnabled}
                        onChange={(e) =>
                          handleUpdateConfigField(
                            cfg.id,
                            'inAppPushEnabled',
                            e.target.checked
                          )
                        }
                        className="rounded border-slate-300"
                      />
                      In-App Push
                    </label>

                    <label className="inline-flex items-center gap-1.5 font-medium text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        disabled={!isAdmin}
                        checked={cfg.emailEnabled}
                        onChange={(e) =>
                          handleUpdateConfigField(cfg.id, 'emailEnabled', e.target.checked)
                        }
                        className="rounded border-slate-300"
                      />
                      Email Dispatch
                    </label>
                  </div>
                </div>

                {/* Per-Trigger Center Scope Selector + Email Recipient Input */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-end">
                  <div className="lg:col-span-4">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Select Center Name Scope (Center အလိုက် ရွေးရန်):
                    </label>
                    <select
                      value={scopeCenterCode}
                      onChange={(e) =>
                        setRuleCenterScopeMap((prev) => ({
                          ...prev,
                          [cfg.id]: e.target.value,
                        }))
                      }
                      className="w-full px-3 py-2 text-xs font-semibold border border-slate-300 rounded-lg bg-slate-50 text-slate-900"
                    >
                      <option value="GLOBAL">
                        All Centers (Global Default Recipient Rule)
                      </option>
                      {centers.map((c) => (
                        <option key={c.id} value={c.centerCode}>
                          {c.centerCode} — {c.centerName}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="lg:col-span-5">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      {scopeCenterCode === 'GLOBAL'
                        ? 'Configured Global Email Recipient List (Comma-separated emails)'
                        : `Configured Recipient List for ${scopeCenterCode} — ${selectedScopeCenter?.centerName}`}
                    </label>
                    <input
                      type="text"
                      disabled={!isAdmin}
                      value={activeEmailsCsv}
                      onChange={(e) =>
                        handleUpdateRuleScopedRecipients(
                          cfg,
                          scopeCenterCode,
                          e.target.value
                        )
                      }
                      placeholder="e.g., satshwe36@gmail.com, chief.engineer@cityproperties.com.mm"
                      className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg bg-white disabled:bg-slate-50"
                    />
                  </div>

                  <div className="lg:col-span-3 flex justify-end">
                    <button
                      type="button"
                      disabled={!isAdmin}
                      onClick={() => handleSaveRuleClick(cfg)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 rounded-lg transition-colors"
                    >
                      <Save className="w-3.5 h-3.5" />
                      {scopeCenterCode === 'GLOBAL'
                        ? 'Save Recipient Rule'
                        : `Save ${scopeCenterCode} Rule`}
                    </button>
                  </div>
                </div>

                {/* Quick-Toggle Sector Responsible Persons & Field Engineer Emails */}
                <div className="pt-2 border-t border-slate-100 space-y-1.5">
                  <div className="text-[11px] font-semibold text-slate-500">
                    Quick-Add / Toggle Sector Responsible Persons & Field Engineer Emails (
                    {scopeCenterCode === 'GLOBAL' ? 'Global Default' : scopeCenterCode}):
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {QUICK_PERSONNEL_OPTIONS.map((item) => {
                      const currentList = activeEmailsCsv
                        .split(',')
                        .map((e) => e.trim())
                        .filter(Boolean);
                      const isIncluded = currentList.some(
                        (e) => e.toLowerCase() === item.email.toLowerCase()
                      );
                      return (
                        <button
                          key={item.email}
                          type="button"
                          disabled={!isAdmin}
                          onClick={() => {
                            const nextList = isIncluded
                              ? currentList.filter(
                                  (e) => e.toLowerCase() !== item.email.toLowerCase()
                                )
                              : [...currentList, item.email];
                            handleUpdateRuleScopedRecipients(
                              cfg,
                              scopeCenterCode,
                              nextList.join(', ')
                            );
                          }}
                          className={`inline-flex items-center gap-1 px-2 py-1 text-[11px] font-mono rounded border transition-colors disabled:opacity-50 ${
                            isIncluded
                              ? 'bg-slate-900 text-white border-slate-900 font-semibold'
                              : 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100'
                          }`}
                        >
                          <span>{isIncluded ? '✓' : '+'}</span>
                          <span className="font-sans font-medium">{item.label}:</span>
                          <span>{item.email}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* TAB 3: SERVER EMAIL DELIVERY LOGS */}
      {activeTab === 'email_logs' && (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Server Email Dispatch Receipts (/api/notifications/email-logs)
              </h3>
              <p className="text-xs text-slate-500">
                Audit trail of automated alert emails dispatched to recipient lists.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                <tr>
                  <th className="px-4 py-2.5 text-left">Receipt ID</th>
                  <th className="px-4 py-2.5 text-left">Timestamp</th>
                  <th className="px-4 py-2.5 text-left">Trigger Type</th>
                  <th className="px-4 py-2.5 text-left">Subject & Message</th>
                  <th className="px-4 py-2.5 text-left">Recipients</th>
                  <th className="px-4 py-2.5 text-left">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {emailLogs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                      No email dispatches recorded in this server session yet. Click "Test Critical Alert & Email" above to dispatch one now.
                    </td>
                  </tr>
                ) : (
                  emailLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/80">
                      <td className="px-4 py-2.5 font-mono font-bold text-slate-900">{log.id}</td>
                      <td className="px-4 py-2.5 font-mono text-slate-600 whitespace-nowrap">
                        {new Date(log.sentAt).toLocaleTimeString()}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-slate-700">{log.triggerType}</td>
                      <td className="px-4 py-2.5">
                        <div className="font-semibold text-slate-900">{log.subject}</div>
                        <div className="text-[11px] text-slate-500 truncate max-w-md">
                          {log.body}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 font-mono text-[11px] text-slate-700">
                        {log.recipients.join(', ')}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                          <CheckCircle2 className="w-3.5 h-3.5" /> {log.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

