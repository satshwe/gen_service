import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import {
  InspectionReport,
  AlertNotification,
  NotificationRuleConfig,
  Center,
} from '../types';
import { CHECKLIST_DEFINITIONS } from '../data/checklistConfig';
import { idbPut, STORES, sanitizeFirestoreId } from './indexedDbSync';

export async function dispatchNotificationAndEmail(
  notif: AlertNotification,
  ruleConfig: NotificationRuleConfig
): Promise<AlertNotification> {
  let emailSent = false;

  if (ruleConfig.emailEnabled && ruleConfig.recipientsCsv.trim()) {
    try {
      const response = await fetch('/api/notifications/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          triggerType: notif.triggerType,
          severity: notif.severity,
          title: notif.title,
          message: notif.message,
          recipientsCsv: ruleConfig.recipientsCsv,
          centerCode: notif.centerCode,
          reportNo: notif.reportNo,
        }),
      });
      if (response.ok) {
        emailSent = true;
      }
    } catch {
      // Offline — email will be flagged once online
    }
  }

  // Trigger Browser Web Notification if permission granted
  if (
    ruleConfig.inAppPushEnabled &&
    typeof window !== 'undefined' &&
    'Notification' in window &&
    Notification.permission === 'granted'
  ) {
    try {
      new Notification(notif.title, {
        body: notif.message,
      });
    } catch {
      // Ignore browser notification restrictions in iframe
    }
  }

  const finalNotif: AlertNotification = {
    ...notif,
    emailDispatched: emailSent,
  };

  await idbPut<AlertNotification>(STORES.NOTIFICATIONS, finalNotif);

  // Sync to Firestore whenever online (supports both UID+Password Login & Google Auth)
  const currentUser = auth.currentUser;
  if (navigator.onLine) {
    const docId = sanitizeFirestoreId(finalNotif.id);
    const notifPath = `notifications/${docId}`;
    const resolvedAuthorUid = String(
      currentUser?.uid || finalNotif.authorUid || 'USR_ADMIN_01'
    ).slice(0, 128);
    try {
      await setDoc(doc(db, 'notifications', docId), {
        id: docId,
        triggerType: finalNotif.triggerType,
        severity: finalNotif.severity,
        title: String(finalNotif.title || 'Alert').slice(0, 200),
        message: String(finalNotif.message || 'Alert Notification').slice(0, 1000),
        centerCode: String(finalNotif.centerCode || 'CMLSPL').slice(0, 32),
        generatorId: String(finalNotif.generatorId || 'GEN-001').slice(0, 64),
        reportNo: String(finalNotif.reportNo || '000001').slice(0, 32),
        recipientsSummary: String(
          finalNotif.recipientsSummary || 'satshwe36@gmail.com'
        ).slice(0, 500),
        emailDispatched: Boolean(finalNotif.emailDispatched),
        read: Boolean(finalNotif.read),
        authorUid: resolvedAuthorUid,
        createdAt: serverTimestamp(),
      });
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes('Missing or insufficient permissions')
      ) {
        handleFirestoreError(error, OperationType.WRITE, notifPath);
      }
    }
  }

  return finalNotif;
}

/**
 * Evaluates a saved InspectionReport against all active NotificationRuleConfig rules
 * and fires real-time push & email notifications when criteria are met.
 */
export async function evaluateReportTriggers(
  report: InspectionReport,
  configs: NotificationRuleConfig[]
): Promise<AlertNotification[]> {
  const generated: AlertNotification[] = [];
  const authorUid = auth.currentUser?.uid || 'FIELD_ENGINEER_LOCAL';
  const formReceiptEmails = (report.recipientEmails || '').trim();
  const fieldEngineerEmail = (report.inspectorEmail || '').trim();
  const centerCodeKey = (report.centerCode || '').trim().toUpperCase();

  const mergeRecipients = (rule: NotificationRuleConfig) => {
    const centerSpecificCsv = rule.centerRecipientsMap?.[centerCodeKey] || '';
    const baseRuleCsv = centerSpecificCsv.trim() ? centerSpecificCsv : rule.recipientsCsv;
    const combined = [
      ...baseRuleCsv.split(',').map((e) => e.trim()),
      ...formReceiptEmails.split(',').map((e) => e.trim()),
    ].filter(Boolean);
    return Array.from(new Set(combined)).join(', ');
  };

  // 1. Check CRITICAL_READINESS trigger
  const criticalRule = configs.find((c) => c.triggerType === 'CRITICAL_READINESS');
  if (criticalRule && criticalRule.enabled && report.readinessStatus === 'Critical') {
    const id = `ALT_CRIT_${report.reportNo}_${Date.now().toString().slice(-5)}`;
    const mergedCsv = mergeRecipients(criticalRule);
    const notif: AlertNotification = {
      id,
      triggerType: 'CRITICAL_READINESS',
      severity: 'Critical',
      title: `CRITICAL READINESS: ${report.centerCode} (${report.kvaRating})`,
      message: `Report #${report.reportNo} (${report.sectorName || 'Generator Sector'}) at ${report.centerName} changed status to CRITICAL (Health Score: ${report.healthScore}%, Oil Pressure: ${report.parameters.engineOilPressureBar} Bar). Field Engineer: ${report.inspectorName} (${fieldEngineerEmail || 'N/A'}). Defects: ${
        report.defectsList.join(', ') || 'Immediate inspection required'
      }.`,
      centerCode: report.centerCode,
      generatorId: report.generatorId,
      reportNo: report.reportNo,
      recipientsSummary: mergedCsv,
      emailDispatched: false,
      read: false,
      authorUid,
      createdAt: new Date().toISOString(),
    };
    const dispatched = await dispatchNotificationAndEmail(notif, {
      ...criticalRule,
      recipientsCsv: mergedCsv,
    });
    generated.push(dispatched);
  }

  // 2. Check BAD_CHECKLIST_ITEM trigger
  const badItemRule = configs.find((c) => c.triggerType === 'BAD_CHECKLIST_ITEM');
  if (badItemRule && badItemRule.enabled) {
    const badItems: string[] = [];
    for (const def of CHECKLIST_DEFINITIONS) {
      if (def.itemNo > 25) continue;
      const val = report.checklist[def.itemNo]?.selectedOption;
      if (!val) continue;
      if (def.criticalOptions?.includes(val) || def.warningOptions?.includes(val)) {
        badItems.push(`Item #${def.itemNo} (${val})`);
      }
    }

    if (badItems.length > 0) {
      const id = `ALT_BAD_${report.reportNo}_${Date.now().toString().slice(-5)}`;
      const mergedCsv = mergeRecipients(badItemRule);
      const notif: AlertNotification = {
        id,
        triggerType: 'BAD_CHECKLIST_ITEM',
        severity: report.readinessStatus === 'Critical' ? 'Critical' : 'Warning',
        title: `Checklist Action Alert: ${report.centerCode} — ${badItems.length} Item(s) Flagged`,
        message: `Report #${report.reportNo} (${report.gensetModel} · ${report.sectorName || 'Sector'}) logged non-nominal checklist items: ${badItems.join(
          ', '
        )}. Field Engineer: ${report.inspectorName} (${fieldEngineerEmail || 'N/A'}).`,
        centerCode: report.centerCode,
        generatorId: report.generatorId,
        reportNo: report.reportNo,
        recipientsSummary: mergedCsv,
        emailDispatched: false,
        read: false,
        authorUid,
        createdAt: new Date().toISOString(),
      };
      const dispatched = await dispatchNotificationAndEmail(notif, {
        ...badItemRule,
        recipientsCsv: mergedCsv,
      });
      generated.push(dispatched);
    }
  }

  // 3. Dispatch Service Report Receipt Mail to Sector Responsible Persons when formReceiptEmails is provided
  if (formReceiptEmails && generated.length === 0) {
    const id = `ALT_RCPT_${report.reportNo}_${Date.now().toString().slice(-5)}`;
    const receiptRule: NotificationRuleConfig = {
      id: 'RULE_SECTOR_RECEIPT',
      triggerType: 'MAINTENANCE_REMINDER',
      name: 'Sector Service Report Receipt Mail',
      description: 'Automatic receipt email to Sector Responsible Persons',
      enabled: true,
      inAppPushEnabled: true,
      emailEnabled: true,
      recipientsCsv: formReceiptEmails,
      updatedBy: report.inspectorName,
      updatedAt: new Date().toISOString(),
    };
    const notif: AlertNotification = {
      id,
      triggerType: 'MAINTENANCE_REMINDER',
      severity: 'Info',
      title: `Service Report Receipt Sent: #${report.reportNo} — ${report.centerCode} (${report.sectorName || 'Sector'})`,
      message: `Official Service Report #${report.reportNo} (${report.jobRequestType}) completed by Field Engineer ${report.inspectorName} (${fieldEngineerEmail || 'N/A'}). Receipt mail dispatched to responsible persons: ${formReceiptEmails}.`,
      centerCode: report.centerCode,
      generatorId: report.generatorId,
      reportNo: report.reportNo,
      recipientsSummary: formReceiptEmails,
      emailDispatched: false,
      read: false,
      authorUid,
      createdAt: new Date().toISOString(),
    };
    const dispatched = await dispatchNotificationAndEmail(notif, receiptRule);
    generated.push(dispatched);
  }

  return generated;
}

/**
 * Generates scheduled maintenance reminder notifications for Centers due for monthly PM.
 */
export async function triggerScheduledMaintenanceReminders(
  centers: Center[],
  reports: InspectionReport[],
  configs: NotificationRuleConfig[]
): Promise<AlertNotification[]> {
  const reminderRule = configs.find((c) => c.triggerType === 'MAINTENANCE_REMINDER');
  if (!reminderRule || !reminderRule.enabled) return [];

  const inspectedCenters = new Set(reports.map((r) => r.centerId));
  const dueCenters = centers.filter((c) => !inspectedCenters.has(c.id));
  const targetCenters = dueCenters.length > 0 ? dueCenters.slice(0, 4) : centers.slice(0, 2);

  const authorUid = auth.currentUser?.uid || 'PM_SCHEDULER_ENGINE';
  const generated: AlertNotification[] = [];

  for (const center of targetCenters) {
    const codeKey = center.centerCode.trim().toUpperCase();
    const centerSpecificCsv = reminderRule.centerRecipientsMap?.[codeKey] || '';
    const effectiveCsv = centerSpecificCsv.trim()
      ? centerSpecificCsv
      : reminderRule.recipientsCsv;

    const id = `ALT_PM_${center.centerCode}_${Date.now().toString().slice(-4)}`;
    const notif: AlertNotification = {
      id,
      triggerType: 'MAINTENANCE_REMINDER',
      severity: 'Info',
      title: `Scheduled Monthly PM Due: ${center.centerCode} (${center.centerName})`,
      message: `Routine 30-day Generator Service & 25-Point Checklist (Gen SOP-002) is due for ${center.centerName}. Contact: ${center.contactPerson} (${center.contactPhone}).`,
      centerCode: center.centerCode,
      generatorId: 'ALL_UNITS',
      reportNo: 'PM-SCHEDULE',
      recipientsSummary: effectiveCsv,
      emailDispatched: false,
      read: false,
      authorUid,
      createdAt: new Date().toISOString(),
    };
    const dispatched = await dispatchNotificationAndEmail(notif, {
      ...reminderRule,
      recipientsCsv: effectiveCsv,
    });
    generated.push(dispatched);
  }

  return generated;
}
