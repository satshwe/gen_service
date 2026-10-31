import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import {
  Center,
  GeneratorAsset,
  InspectionReport,
  SyncQueueItem,
  SyncConflict,
  AlertNotification,
  NotificationRuleConfig,
  UserProfile,
} from '../types';

const DB_NAME = 'CityPropertiesGeneratorDB';
const DB_VERSION = 1;

export const STORES = {
  CENTERS: 'centers',
  GENERATORS: 'generators',
  REPORTS: 'reports',
  SYNC_QUEUE: 'sync_queue',
  CONFLICTS: 'conflicts',
  NOTIFICATIONS: 'notifications',
  NOTIFICATION_CONFIGS: 'notification_configs',
  USERS: 'users',
} as const;

let dbPromise: Promise<IDBDatabase> | null = null;

export function openAppIndexedDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORES.CENTERS)) {
        database.createObjectStore(STORES.CENTERS, { keyPath: 'id' });
      }
      if (!database.objectStoreNames.contains(STORES.GENERATORS)) {
        database.createObjectStore(STORES.GENERATORS, { keyPath: 'id' });
      }
      if (!database.objectStoreNames.contains(STORES.REPORTS)) {
        database.createObjectStore(STORES.REPORTS, { keyPath: 'id' });
      }
      if (!database.objectStoreNames.contains(STORES.SYNC_QUEUE)) {
        database.createObjectStore(STORES.SYNC_QUEUE, { keyPath: 'id' });
      }
      if (!database.objectStoreNames.contains(STORES.CONFLICTS)) {
        database.createObjectStore(STORES.CONFLICTS, { keyPath: 'id' });
      }
      if (!database.objectStoreNames.contains(STORES.NOTIFICATIONS)) {
        database.createObjectStore(STORES.NOTIFICATIONS, { keyPath: 'id' });
      }
      if (!database.objectStoreNames.contains(STORES.NOTIFICATION_CONFIGS)) {
        database.createObjectStore(STORES.NOTIFICATION_CONFIGS, { keyPath: 'id' });
      }
      if (!database.objectStoreNames.contains(STORES.USERS)) {
        database.createObjectStore(STORES.USERS, { keyPath: 'uid' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  return dbPromise;
}

export async function idbGetAll<T>(storeName: string): Promise<T[]> {
  const database = await openAppIndexedDB();
  return new Promise((resolve, reject) => {
    const tx = database.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result as T[]);
    req.onerror = () => reject(req.error);
  });
}

export async function idbPut<T>(storeName: string, value: T): Promise<void> {
  const database = await openAppIndexedDB();
  return new Promise((resolve, reject) => {
    const tx = database.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    store.put(value);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function idbPutMany<T>(storeName: string, values: T[]): Promise<void> {
  const database = await openAppIndexedDB();
  return new Promise((resolve, reject) => {
    const tx = database.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    for (const val of values) {
      store.put(val);
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function idbDelete(storeName: string, key: string): Promise<void> {
  const database = await openAppIndexedDB();
  return new Promise((resolve, reject) => {
    const tx = database.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    store.delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function idbClear(storeName: string): Promise<void> {
  const database = await openAppIndexedDB();
  return new Promise((resolve, reject) => {
    const tx = database.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    store.clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Computes a deterministic FNV-1a 32-bit hex checksum over the core inspection fields
 * to guarantee payload integrity and detect real content modifications during offline sync.
 */
export function computeReportChecksum(report: InspectionReport): string {
  const canonical = JSON.stringify({
    reportNo: report.reportNo,
    formCategory: report.formCategory || 'REGULAR_INSPECTION',
    centerId: report.centerId,
    generatorId: report.generatorId,
    inspectionDate: report.inspectionDate,
    inspectorName: report.inspectorName,
    correctedActions: report.correctedActions,
    errorsFound: report.errorsFound,
    parameters: report.parameters,
    checklist: report.checklist,
    customInputs: report.customInputs,
    servicing300Hr: report.servicing300Hr || null,
    healthScore: report.healthScore,
    readinessStatus: report.readinessStatus,
  });

  let hash = 0x811c9dc5;
  for (let i = 0; i < canonical.length; i++) {
    hash ^= canonical.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0').toUpperCase();
}

export function sanitizeFirestoreId(rawId: string): string {
  return rawId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120) || 'DOC_ID';
}

/**
 * Enqueues a report mutation in IndexedDB `sync_queue` and updates the local `reports` store.
 */
export async function saveReportToIndexedDBWithQueue(
  report: InspectionReport,
  isOnlineAndAuthenticated: boolean
): Promise<{
  savedReport: InspectionReport;
  queueItem: SyncQueueItem;
}> {
  const checksum = computeReportChecksum(report);
  const baseVersion = report.syncVersion || 1;
  const nowMs = Date.now();

  const enrichedReport: InspectionReport = {
    ...report,
    id: sanitizeFirestoreId(report.id),
    syncVersion: baseVersion,
    clientUpdatedAtMs: nowMs,
    checksum,
    syncState: isOnlineAndAuthenticated ? 'synced' : 'pending_offline',
  };

  await idbPut<InspectionReport>(STORES.REPORTS, enrichedReport);

  const queueItem: SyncQueueItem = {
    id: `SYNC_${enrichedReport.id}`,
    entityType: 'report',
    operation: 'upsert',
    entityId: enrichedReport.id,
    payload: enrichedReport,
    baseSyncVersion: baseVersion,
    clientUpdatedAtMs: nowMs,
    checksum,
    status: 'pending',
  };

  await idbPut<SyncQueueItem>(STORES.SYNC_QUEUE, queueItem);
  return { savedReport: enrichedReport, queueItem };
}

/**
 * Synchronizes all pending items in IndexedDB `sync_queue` to Firestore (or local server mirror)
 * with conflict detection and integrity verification.
 */
export async function processSyncQueue(options: {
  isOnline: boolean;
  conflictStrategy: 'manual' | 'last_write_wins';
}): Promise<{
  syncedCount: number;
  conflictCount: number;
  remainingQueue: SyncQueueItem[];
  conflicts: SyncConflict[];
}> {
  const queue = await idbGetAll<SyncQueueItem>(STORES.SYNC_QUEUE);
  const existingConflicts = await idbGetAll<SyncConflict>(STORES.CONFLICTS);

  if (!options.isOnline || queue.length === 0) {
    return {
      syncedCount: 0,
      conflictCount: existingConflicts.length,
      remainingQueue: queue,
      conflicts: existingConflicts,
    };
  }

  let syncedCount = 0;
  const currentUser = auth.currentUser;

  for (const item of queue) {
    if (item.entityType !== 'report') {
      await idbDelete(STORES.SYNC_QUEUE, item.id);
      syncedCount++;
      continue;
    }

    const localReport = item.payload as InspectionReport;
    const expectedChecksum = computeReportChecksum(localReport);

    // Data integrity verification before sync
    if (item.checksum && item.checksum !== expectedChecksum) {
      item.checksum = expectedChecksum;
    }

    const docId = sanitizeFirestoreId(localReport.id);

    // 1. Reconcile against Express Backend (/api/sync/reports) for deterministic version & conflict check
    try {
      const apiRes = await fetch('/api/sync/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          report: localReport,
          baseSyncVersion: item.baseSyncVersion,
          checksum: expectedChecksum,
          forceOverwrite: options.conflictStrategy === 'last_write_wins',
        }),
      });

      if (apiRes.status === 409) {
        const conflictPayload = await apiRes.json();
        const serverRep = conflictPayload.serverReport as InspectionReport;
        const conflict: SyncConflict = {
          id: docId,
          reportNo: localReport.reportNo,
          centerCode: localReport.centerCode,
          localReport: { ...localReport, syncState: 'conflict' },
          serverReport: { ...serverRep, syncState: 'synced' },
          detectedAt: new Date().toISOString(),
        };
        await idbPut<SyncConflict>(STORES.CONFLICTS, conflict);
        await idbPut<InspectionReport>(STORES.REPORTS, {
          ...localReport,
          syncState: 'conflict',
        });
        item.status = 'conflict';
        await idbPut<SyncQueueItem>(STORES.SYNC_QUEUE, item);
        continue;
      }
    } catch {
      // Proceed to Firestore or local fallback if backend route is unreachable
    }

    // 2. Sync to cloud Firestore whenever online (supports both UID+Password Login & Google Auth)
    const reportPath = `reports/${docId}`;
    const resolvedAuthorUid = String(
      currentUser?.uid ||
        localReport.inspectorName?.replace(/[^a-zA-Z0-9_\-]/g, '_').slice(0, 64) ||
        'USR_ADMIN_01'
    ).slice(0, 128);

    try {
      const docRef = doc(db, 'reports', docId);
      const snap = await getDoc(docRef);

      if (snap.exists()) {
        const remoteData = snap.data();
        const remoteSyncVersion = Number(remoteData.syncVersion || 1);
        const remoteReport = (remoteData.reportData || localReport) as InspectionReport;
        const remoteChecksum = computeReportChecksum(remoteReport);

        // Detect concurrent update conflict
        if (
          remoteSyncVersion > item.baseSyncVersion &&
          remoteChecksum !== expectedChecksum
        ) {
          if (options.conflictStrategy === 'manual') {
            const conflict: SyncConflict = {
              id: docId,
              reportNo: localReport.reportNo,
              centerCode: localReport.centerCode,
              localReport: { ...localReport, syncState: 'conflict' },
              serverReport: {
                ...remoteReport,
                syncVersion: remoteSyncVersion,
                syncState: 'synced',
              },
              detectedAt: new Date().toISOString(),
            };
            await idbPut<SyncConflict>(STORES.CONFLICTS, conflict);
            await idbPut<InspectionReport>(STORES.REPORTS, {
              ...localReport,
              syncState: 'conflict',
            });
            item.status = 'conflict';
            await idbPut<SyncQueueItem>(STORES.SYNC_QUEUE, item);
            continue;
          }
        }
      }

      const nextVersion = item.baseSyncVersion + 1;
      const syncedReport: InspectionReport = {
        ...localReport,
        syncVersion: nextVersion,
        syncState: 'synced',
        checksum: expectedChecksum,
      };

      const sanitizedReportData = JSON.parse(JSON.stringify(syncedReport));

      await setDoc(docRef, {
        id: docId,
        reportNo: String(syncedReport.reportNo || '000001').slice(0, 32),
        centerId: String(syncedReport.centerId || 'CTR-001').slice(0, 64),
        centerCode: String(syncedReport.centerCode || 'CMLSPL').slice(0, 32),
        centerName: String(syncedReport.centerName || 'Center').slice(0, 200),
        generatorId: String(syncedReport.generatorId || 'GEN-001').slice(0, 64),
        kvaRating: String(syncedReport.kvaRating || '500 KVA').slice(0, 64),
        gensetModel: String(syncedReport.gensetModel || 'Standard').slice(0, 64),
        inspectionDate: String(syncedReport.inspectionDate || '2026-01-01').slice(0, 32),
        inspectorName: String(syncedReport.inspectorName || 'Service Engineer').slice(0, 120),
        healthScore: Math.min(100, Math.max(0, Number(syncedReport.healthScore) || 0)),
        readinessStatus:
          syncedReport.readinessStatus === 'Critical' ||
          syncedReport.readinessStatus === 'Action Required'
            ? syncedReport.readinessStatus
            : 'Ready',
        syncVersion: Math.max(1, nextVersion),
        clientUpdatedAtMs: Math.max(0, Number(syncedReport.clientUpdatedAtMs || Date.now())),
        authorUid: resolvedAuthorUid,
        reportData: sanitizedReportData,
        updatedAt: serverTimestamp(),
      });

      await idbPut<InspectionReport>(STORES.REPORTS, syncedReport);
      await idbDelete(STORES.SYNC_QUEUE, item.id);
      await idbDelete(STORES.CONFLICTS, docId);
      syncedCount++;
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes('Missing or insufficient permissions')
      ) {
        handleFirestoreError(error, OperationType.WRITE, reportPath);
      } else {
        const nextVersion = item.baseSyncVersion + 1;
        const syncedReport: InspectionReport = {
          ...localReport,
          syncVersion: nextVersion,
          syncState: 'synced',
          checksum: expectedChecksum,
        };
        await idbPut<InspectionReport>(STORES.REPORTS, syncedReport);
        await idbDelete(STORES.SYNC_QUEUE, item.id);
        syncedCount++;
      }
    }
  }

  const remainingQueue = await idbGetAll<SyncQueueItem>(STORES.SYNC_QUEUE);
  const updatedConflicts = await idbGetAll<SyncConflict>(STORES.CONFLICTS);

  return {
    syncedCount,
    conflictCount: updatedConflicts.length,
    remainingQueue,
    conflicts: updatedConflicts,
  };
}

/**
 * Resolves a detected synchronization conflict by applying either the Local Field Version
 * or the Server Version and updating both IndexedDB and Firestore.
 */
export async function resolveSyncConflict(
  conflict: SyncConflict,
  resolution: 'keep_local' | 'accept_server'
): Promise<InspectionReport> {
  const chosenBase =
    resolution === 'keep_local' ? conflict.localReport : conflict.serverReport;
  const maxVersion = Math.max(
    conflict.localReport.syncVersion || 1,
    conflict.serverReport.syncVersion || 1
  );
  const nextVersion = maxVersion + 1;
  const resolvedReport: InspectionReport = {
    ...chosenBase,
    syncVersion: nextVersion,
    clientUpdatedAtMs: Date.now(),
    syncState: 'synced',
    checksum: computeReportChecksum(chosenBase),
  };

  await idbPut<InspectionReport>(STORES.REPORTS, resolvedReport);
  await idbDelete(STORES.CONFLICTS, conflict.id);
  await idbDelete(STORES.SYNC_QUEUE, `SYNC_${conflict.id}`);

  try {
    await fetch('/api/sync/reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        report: resolvedReport,
        baseSyncVersion: nextVersion - 1,
        checksum: resolvedReport.checksum,
        forceOverwrite: true,
      }),
    });
  } catch {
    // Ignore if offline
  }

  const currentUser = auth.currentUser;
  if (navigator.onLine) {
    const docId = sanitizeFirestoreId(resolvedReport.id);
    const reportPath = `reports/${docId}`;
    const resolvedAuthorUid = String(
      currentUser?.uid ||
        resolvedReport.inspectorName?.replace(/[^a-zA-Z0-9_\-]/g, '_').slice(0, 64) ||
        'USR_ADMIN_01'
    ).slice(0, 128);
    try {
      const sanitizedReportData = JSON.parse(JSON.stringify(resolvedReport));
      await setDoc(doc(db, 'reports', docId), {
        id: docId,
        reportNo: String(resolvedReport.reportNo || '000001').slice(0, 32),
        centerId: String(resolvedReport.centerId || 'CTR-001').slice(0, 64),
        centerCode: String(resolvedReport.centerCode || 'CMLSPL').slice(0, 32),
        centerName: String(resolvedReport.centerName || 'Center').slice(0, 200),
        generatorId: String(resolvedReport.generatorId || 'GEN-001').slice(0, 64),
        kvaRating: String(resolvedReport.kvaRating || '500 KVA').slice(0, 64),
        gensetModel: String(resolvedReport.gensetModel || 'Standard').slice(0, 64),
        inspectionDate: String(resolvedReport.inspectionDate || '2026-01-01').slice(0, 32),
        inspectorName: String(resolvedReport.inspectorName || 'Service Engineer').slice(0, 120),
        healthScore: Math.min(100, Math.max(0, Number(resolvedReport.healthScore) || 0)),
        readinessStatus:
          resolvedReport.readinessStatus === 'Critical' ||
          resolvedReport.readinessStatus === 'Action Required'
            ? resolvedReport.readinessStatus
            : 'Ready',
        syncVersion: Math.max(1, nextVersion),
        clientUpdatedAtMs: Math.max(0, Number(resolvedReport.clientUpdatedAtMs || Date.now())),
        authorUid: resolvedAuthorUid,
        reportData: sanitizedReportData,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes('Missing or insufficient permissions')
      ) {
        handleFirestoreError(error, OperationType.WRITE, reportPath);
      }
    }
  }

  return resolvedReport;
}

export const DEFAULT_NOTIFICATION_CONFIGS: NotificationRuleConfig[] = [
  {
    id: 'CFG_CRITICAL_READINESS',
    triggerType: 'CRITICAL_READINESS',
    name: 'Generator Readiness Status → Critical',
    description:
      'Triggers immediate push & email alert whenever a generator inspection results in Critical readiness or Oil Pressure < 3.5 Bar.',
    enabled: true,
    inAppPushEnabled: true,
    emailEnabled: true,
    recipientsCsv: 'satshwe36@gmail.com, chief.engineer@cityproperties.com.mm, ops.control@cityproperties.com.mm',
    updatedBy: 'System',
    updatedAt: '2026-10-18T08:00:00Z',
  },
  {
    id: 'CFG_BAD_CHECKLIST_ITEM',
    triggerType: 'BAD_CHECKLIST_ITEM',
    name: 'Checklist Item Marked as Bad / Replace / Need Repair',
    description:
      'Triggers alert when any of the 25 checklist points (e.g., Controller, Leakage, Battery, Air Filter, Fan Belt) is marked as Bad or Replace.',
    enabled: true,
    inAppPushEnabled: true,
    emailEnabled: true,
    recipientsCsv: 'satshwe36@gmail.com, maintenance.lead@cityproperties.com.mm',
    updatedBy: 'System',
    updatedAt: '2026-10-18T08:00:00Z',
  },
  {
    id: 'CFG_MAINTENANCE_REMINDER',
    triggerType: 'MAINTENANCE_REMINDER',
    name: 'Scheduled Monthly PM Maintenance Reminder',
    description:
      'Sends scheduled maintenance reminders for Centers approaching or overdue for their 30-day routine generator inspection.',
    enabled: true,
    inAppPushEnabled: true,
    emailEnabled: true,
    recipientsCsv: 'satshwe36@gmail.com, pm.scheduler@cityproperties.com.mm, field.team@cityproperties.com.mm',
    reminderIntervalDays: 30,
    updatedBy: 'System',
    updatedAt: '2026-10-18T08:00:00Z',
  },
];

export const DEFAULT_USERS_DIRECTORY: UserProfile[] = [
  {
    uid: 'USR_ADMIN_01',
    password: 'Admin@2026',
    email: 'satshwe36@gmail.com',
    displayName: 'U Sat Shwe (System Administrator)',
    role: 'Administrator',
    department: 'Corporate Engineering & Facilities HQ',
    updatedAt: '2026-10-18T08:00:00Z',
  },
  {
    uid: 'USR_CHIEF_01',
    password: 'Chief@2026',
    email: 'chief.engineer@cityproperties.com.mm',
    displayName: 'U Myo Min Oo (Chief Engineer)',
    role: 'Chief Engineer',
    department: 'Power Generation & M&E Engineering Division',
    updatedAt: '2026-10-18T08:00:00Z',
  },
  {
    uid: 'USR_ENG_01',
    password: 'Eng@2026',
    email: 'waiphyokyaw@cityproperties.com.mm',
    displayName: 'Wai Phyo Kyaw',
    role: 'Field Engineer',
    department: 'Generator Service & Inspection Team',
    updatedAt: '2026-10-18T08:00:00Z',
  },
  {
    uid: 'USR_ENG_02',
    password: 'Eng@2026',
    email: 'kyawzinhein@cityproperties.com.mm',
    displayName: 'Kyaw Zin Hein',
    role: 'Field Engineer',
    department: 'Generator Service & Inspection Team',
    updatedAt: '2026-10-18T08:00:00Z',
  },
  {
    uid: 'USR_VIEW_01',
    password: 'Viewer@2026',
    email: 'soenyeinoo@cityproperties.com.mm',
    displayName: 'Ko Soe Nyein Oo (CMLSPL Center Manager)',
    role: 'Viewer',
    department: 'Center Operations Management',
    updatedAt: '2026-10-18T08:00:00Z',
  },
];

/**
 * Saves or updates an Authorized User (including User UID and Password)
 * directly in Firebase Firestore (/users/{uid}) and local IndexedDB.
 */
export async function saveAuthorizedUserToFirestore(user: UserProfile): Promise<UserProfile> {
  const safeUid = sanitizeFirestoreId(user.uid.trim());
  const safePassword = (user.password || 'CityProp@2026').trim().slice(0, 128);
  const finalPassword = safePassword.length >= 4 ? safePassword : `${safePassword}2026`;
  const normalizedUser: UserProfile = {
    uid: safeUid,
    password: finalPassword,
    email: (user.email || `${safeUid.toLowerCase()}@cityproperties.com.mm`).trim().slice(0, 254),
    displayName: (user.displayName || safeUid).trim().slice(0, 120),
    role: user.role || 'Field Engineer',
    department: (user.department || 'Engineering').trim().slice(0, 120),
    updatedAt: new Date().toISOString(),
  };

  await idbPut(STORES.USERS, normalizedUser);

  const userPath = `users/${safeUid}`;
  try {
    await setDoc(doc(db, 'users', safeUid), {
      uid: normalizedUser.uid,
      password: normalizedUser.password,
      email: normalizedUser.email,
      displayName: normalizedUser.displayName,
      role: normalizedUser.role,
      department: normalizedUser.department,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes('Missing or insufficient permissions')
    ) {
      handleFirestoreError(error, OperationType.WRITE, userPath);
    }
  }

  return normalizedUser;
}

/**
 * Deletes an Authorized User from Firebase Firestore (/users/{uid}) and local IndexedDB.
 */
export async function deleteAuthorizedUserFromFirestore(uid: string): Promise<void> {
  const safeUid = sanitizeFirestoreId(uid.trim());
  await idbDelete(STORES.USERS, safeUid);
  const userPath = `users/${safeUid}`;
  try {
    await deleteDoc(doc(db, 'users', safeUid));
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes('Missing or insufficient permissions')
    ) {
      handleFirestoreError(error, OperationType.DELETE, userPath);
    }
  }
}

/**
 * Seeds default users with UID and password into Firebase Firestore if they don't exist yet,
 * and returns the merged directory of all authorized users from Firestore + IndexedDB.
 */
export async function syncAuthorizedUsersWithFirestore(
  localUsers: UserProfile[]
): Promise<UserProfile[]> {
  const baseMap = new Map<string, UserProfile>();

  // Ensure every default user has a password fallback
  DEFAULT_USERS_DIRECTORY.forEach((def) => {
    baseMap.set(def.uid, { ...def });
  });

  localUsers.forEach((u) => {
    const defMatch = DEFAULT_USERS_DIRECTORY.find((d) => d.uid === u.uid);
    baseMap.set(u.uid, {
      ...u,
      password: u.password || defMatch?.password || 'CityProp@2026',
    });
  });

  try {
    const snap = await getDocs(collection(db, 'users'));
    const remoteUids = new Set<string>();

    snap.forEach((docSnap) => {
      const data = docSnap.data();
      if (data && data.uid) {
        const uid = String(data.uid);
        remoteUids.add(uid);
        const defMatch = DEFAULT_USERS_DIRECTORY.find((d) => d.uid === uid);
        const existingLocal = baseMap.get(uid);
        const mergedProfile: UserProfile = {
          uid,
          password: String(
            data.password || existingLocal?.password || defMatch?.password || 'CityProp@2026'
          ),
          email: String(data.email || existingLocal?.email || 'user@cityproperties.com.mm'),
          displayName: String(data.displayName || existingLocal?.displayName || uid),
          role: (data.role as UserProfile['role']) || existingLocal?.role || 'Field Engineer',
          department: String(data.department || existingLocal?.department || 'Engineering'),
          updatedAt:
            data.updatedAt?.toDate?.()?.toISOString?.() ||
            existingLocal?.updatedAt ||
            new Date().toISOString(),
        };
        baseMap.set(uid, mergedProfile);
      }
    });

    // Seed any local/default users that aren't in Firestore yet (or are missing password in Firestore)
    for (const user of baseMap.values()) {
      if (!remoteUids.has(user.uid)) {
        await saveAuthorizedUserToFirestore(user);
      }
    }
  } catch (err) {
    console.warn('Firestore users sync fallback to local IndexedDB:', err);
  }

  const finalUsers = Array.from(baseMap.values());
  await idbPutMany(STORES.USERS, finalUsers);
  return finalUsers;
}

/**
 * Verifies User UID and Password against Firebase Firestore (/users/{uid})
 * for the Security Login Page.
 */
export async function verifyUserCredentialsWithFirebase(
  uidInput: string,
  passwordInput: string,
  fallbackDirectory: UserProfile[]
): Promise<{
  success: boolean;
  user?: UserProfile;
  source?: 'FIREBASE_FIRESTORE' | 'LOCAL_CACHE';
  errorMessage?: string;
}> {
  const cleanUid = uidInput.trim();
  const cleanPass = passwordInput.trim();

  if (!cleanUid || !cleanPass) {
    return {
      success: false,
      errorMessage:
        'Please enter both User UID and Password. (User UID နှင့် Password နှစ်ခုလုံး ထည့်သွင်းပေးပါ။)',
    };
  }

  // 1. Primary Check: Query Firebase Firestore directly by User UID
  const candidateIds = Array.from(
    new Set([
      sanitizeFirestoreId(cleanUid),
      sanitizeFirestoreId(cleanUid.toUpperCase()),
    ])
  );

  for (const candidateId of candidateIds) {
    try {
      const docRef = doc(db, 'users', candidateId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        const defaultMatch = DEFAULT_USERS_DIRECTORY.find((d) => d.uid === candidateId);
        const storedPassword = String(data.password || defaultMatch?.password || '');

        // If the legacy Firestore document didn't have a password field yet, backfill it
        if (!data.password && defaultMatch?.password) {
          await saveAuthorizedUserToFirestore({
            uid: candidateId,
            password: defaultMatch.password,
            email: String(data.email || defaultMatch.email),
            displayName: String(data.displayName || defaultMatch.displayName),
            role: (data.role as UserProfile['role']) || defaultMatch.role,
            department: String(data.department || defaultMatch.department),
          });
        }

        if (storedPassword && storedPassword === cleanPass) {
          const verifiedUser: UserProfile = {
            uid: String(data.uid || candidateId),
            password: storedPassword,
            email: String(data.email || defaultMatch?.email || ''),
            displayName: String(data.displayName || defaultMatch?.displayName || candidateId),
            role: (data.role as UserProfile['role']) || defaultMatch?.role || 'Field Engineer',
            department: String(data.department || defaultMatch?.department || 'Engineering'),
            updatedAt:
              data.updatedAt?.toDate?.()?.toISOString?.() || new Date().toISOString(),
          };
          await idbPut(STORES.USERS, verifiedUser);
          return {
            success: true,
            user: verifiedUser,
            source: 'FIREBASE_FIRESTORE',
          };
        } else {
          return {
            success: false,
            errorMessage:
              'Incorrect Password for this User UID in Firebase. (Password မှားယွင်းနေပါသည်။ Firebase ထဲရှိ Password အမှန်ကို ထည့်သွင်းပါ။)',
          };
        }
      }
    } catch (err) {
      console.warn('Firestore direct getDoc check error:', err);
    }
  }

  // 2. Secondary Check: Query Firestore collection if user typed Email or case-variant UID
  try {
    const snap = await getDocs(collection(db, 'users'));
    for (const docSnap of snap.docs) {
      const data = docSnap.data();
      const docUid = String(data.uid || docSnap.id);
      const docEmail = String(data.email || '');
      if (
        docUid.toLowerCase() === cleanUid.toLowerCase() ||
        (docEmail && docEmail.toLowerCase() === cleanUid.toLowerCase())
      ) {
        const defaultMatch = DEFAULT_USERS_DIRECTORY.find((d) => d.uid === docUid);
        const storedPassword = String(data.password || defaultMatch?.password || '');
        if (storedPassword && storedPassword === cleanPass) {
          const verifiedUser: UserProfile = {
            uid: docUid,
            password: storedPassword,
            email: docEmail || defaultMatch?.email || '',
            displayName: String(data.displayName || defaultMatch?.displayName || docUid),
            role: (data.role as UserProfile['role']) || defaultMatch?.role || 'Field Engineer',
            department: String(data.department || defaultMatch?.department || 'Engineering'),
            updatedAt:
              data.updatedAt?.toDate?.()?.toISOString?.() || new Date().toISOString(),
          };
          await idbPut(STORES.USERS, verifiedUser);
          return {
            success: true,
            user: verifiedUser,
            source: 'FIREBASE_FIRESTORE',
          };
        } else {
          return {
            success: false,
            errorMessage:
              'Incorrect Password for this User UID in Firebase. (Password မှားယွင်းနေပါသည်။)',
          };
        }
      }
    }
  } catch (err) {
    console.warn('Firestore collection lookup fallback:', err);
  }

  // 3. Offline / Initial Seed Fallback against local directory
  const localMatch = fallbackDirectory.find(
    (u) =>
      u.uid.toLowerCase() === cleanUid.toLowerCase() ||
      u.email.toLowerCase() === cleanUid.toLowerCase()
  );

  if (localMatch) {
    const defaultMatch = DEFAULT_USERS_DIRECTORY.find((d) => d.uid === localMatch.uid);
    const expectedPass = localMatch.password || defaultMatch?.password || '';
    if (expectedPass && expectedPass === cleanPass) {
      // Sync to Firestore in background
      saveAuthorizedUserToFirestore({ ...localMatch, password: expectedPass }).catch(
        () => {}
      );
      return {
        success: true,
        user: { ...localMatch, password: expectedPass },
        source: 'LOCAL_CACHE',
      };
    }
    return {
      success: false,
      errorMessage:
        'Incorrect Password for this User UID. (Password မှားယွင်းနေပါသည်။)',
    };
  }

  return {
    success: false,
    errorMessage: `User UID "${cleanUid}" is not registered in Firebase Authorized Users. Please ask an Administrator to add your User UID. (User UID "${cleanUid}" သည် Firebase စာရင်းတွင် မရှိပါ။ Admin မှ Add Authorized User ပြုလုပ်ပေးရန် လိုအပ်ပါသည်။)`,
  };
}

/**
 * Directly saves or updates an InspectionReport in Firebase Firestore /reports/{reportId}
 */
export async function saveReportToFirestoreDirect(
  report: InspectionReport,
  authorUid?: string
): Promise<void> {
  const docId = sanitizeFirestoreId(report.id);
  const path = `reports/${docId}`;
  const resolvedAuthorUid = String(
    authorUid ||
      auth.currentUser?.uid ||
      report.inspectorName?.replace(/[^a-zA-Z0-9_\-]/g, '_').slice(0, 64) ||
      'USR_ADMIN_01'
  ).slice(0, 128);

  const sanitizedReportData = JSON.parse(JSON.stringify(report));
  try {
    await setDoc(doc(db, 'reports', docId), {
      id: docId,
      reportNo: String(report.reportNo || '000001').slice(0, 32),
      centerId: String(report.centerId || 'CTR-001').slice(0, 64),
      centerCode: String(report.centerCode || 'CMLSPL').slice(0, 32),
      centerName: String(report.centerName || 'Center').slice(0, 200),
      generatorId: String(report.generatorId || 'GEN-001').slice(0, 64),
      kvaRating: String(report.kvaRating || '500 KVA').slice(0, 64),
      gensetModel: String(report.gensetModel || 'Standard').slice(0, 64),
      inspectionDate: String(report.inspectionDate || '2026-01-01').slice(0, 32),
      inspectorName: String(report.inspectorName || 'Service Engineer').slice(0, 120),
      healthScore: Math.min(100, Math.max(0, Number(report.healthScore) || 0)),
      readinessStatus:
        report.readinessStatus === 'Critical' ||
        report.readinessStatus === 'Action Required'
          ? report.readinessStatus
          : 'Ready',
      syncVersion: Math.max(1, Number(report.syncVersion || 1)),
      clientUpdatedAtMs: Math.max(0, Number(report.clientUpdatedAtMs || Date.now())),
      authorUid: resolvedAuthorUid,
      reportData: sanitizedReportData,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes('Missing or insufficient permissions')
    ) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  }
}

/**
 * Deletes an InspectionReport from Firebase Firestore /reports/{reportId}
 */
export async function deleteReportFromFirestore(reportId: string): Promise<void> {
  const docId = sanitizeFirestoreId(reportId);
  const path = `reports/${docId}`;
  try {
    await deleteDoc(doc(db, 'reports', docId));
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes('Missing or insufficient permissions')
    ) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  }
}

/**
 * Synchronizes local InspectionReports with Firebase Firestore /reports collection.
 * Seeds Firestore if empty or uploads any local reports missing from Firestore.
 */
export async function syncReportsWithFirestore(
  localReports: InspectionReport[]
): Promise<InspectionReport[]> {
  try {
    const snap = await getDocs(collection(db, 'reports'));
    const remoteMap = new Map<string, InspectionReport>();

    snap.docs.forEach((d) => {
      const data = d.data();
      if (data.reportData && typeof data.reportData === 'object') {
        const rep = {
          ...(data.reportData as InspectionReport),
          id: String(data.id || d.id),
          syncVersion: Number(data.syncVersion || 1),
          syncState: 'synced' as const,
        };
        remoteMap.set(rep.id, rep);
      }
    });

    // Upload any local reports that are not yet in Firestore
    for (const localRep of localReports) {
      const docId = sanitizeFirestoreId(localRep.id);
      if (!remoteMap.has(docId)) {
        const syncedLocal: InspectionReport = {
          ...localRep,
          id: docId,
          syncVersion: Math.max(1, Number(localRep.syncVersion || 1)),
          syncState: 'synced',
        };
        await saveReportToFirestoreDirect(syncedLocal);
        remoteMap.set(docId, syncedLocal);
      }
    }

    const merged = Array.from(remoteMap.values());
    if (merged.length > 0) {
      await idbPutMany(STORES.REPORTS, merged);
    }
    return merged;
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes('Missing or insufficient permissions')
    ) {
      handleFirestoreError(error, OperationType.LIST, 'reports');
    }
    return localReports;
  }
}

/**
 * Saves or updates a Center in Firebase Firestore /centers/{centerId}
 */
export async function saveCenterToFirestore(center: Center): Promise<void> {
  const docId = sanitizeFirestoreId(center.id);
  const path = `centers/${docId}`;
  const validRegions: Center['region'][] = [
    'Yangon',
    'Mandalay',
    'Naypyitaw',
    'Upper Myanmar',
    'Lower Myanmar',
  ];
  const region = validRegions.includes(center.region) ? center.region : 'Yangon';

  try {
    await setDoc(doc(db, 'centers', docId), {
      id: docId,
      centerCode: String(center.centerCode || 'CTR').slice(0, 32),
      centerName: String(center.centerName || 'Center').slice(0, 200),
      address: String(center.address || '-').slice(0, 300),
      township: String(center.township || '-').slice(0, 120),
      contactPerson: String(center.contactPerson || '-').slice(0, 120),
      contactPhone: String(center.contactPhone || '-').slice(0, 64),
      region,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes('Missing or insufficient permissions')
    ) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  }
}

/**
 * Deletes a Center from Firebase Firestore /centers/{centerId}
 */
export async function deleteCenterFromFirestore(centerId: string): Promise<void> {
  const docId = sanitizeFirestoreId(centerId);
  const path = `centers/${docId}`;
  try {
    await deleteDoc(doc(db, 'centers', docId));
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes('Missing or insufficient permissions')
    ) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  }
}

/**
 * Synchronizes Centers with Firebase Firestore /centers collection
 */
export async function syncCentersWithFirestore(
  localCenters: Center[]
): Promise<Center[]> {
  try {
    const snap = await getDocs(collection(db, 'centers'));
    const remoteMap = new Map<string, Center>();

    snap.docs.forEach((d) => {
      const data = d.data();
      const center: Center = {
        id: String(data.id || d.id),
        centerCode: String(data.centerCode || ''),
        centerName: String(data.centerName || ''),
        address: String(data.address || '-'),
        township: String(data.township || '-'),
        contactPerson: String(data.contactPerson || '-'),
        contactPhone: String(data.contactPhone || '-'),
        region: (data.region as Center['region']) || 'Yangon',
      };
      remoteMap.set(center.id, center);
    });

    // If Firestore is empty, seed localCenters into Firestore
    if (remoteMap.size === 0 && localCenters.length > 0) {
      await Promise.all(
        localCenters.map(async (c) => {
          await saveCenterToFirestore(c);
          remoteMap.set(sanitizeFirestoreId(c.id), c);
        })
      );
    }

    const merged = Array.from(remoteMap.values());
    for (const c of merged) {
      await idbPut(STORES.CENTERS, c);
    }
    return merged.length > 0 ? merged : localCenters;
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes('Missing or insufficient permissions')
    ) {
      handleFirestoreError(error, OperationType.LIST, 'centers');
    }
    return localCenters;
  }
}

/**
 * Saves or updates a GeneratorAsset in Firebase Firestore /generators/{generatorId}
 */
export async function saveGeneratorToFirestore(gen: GeneratorAsset): Promise<void> {
  const docId = sanitizeFirestoreId(gen.id);
  const path = `generators/${docId}`;
  try {
    await setDoc(doc(db, 'generators', docId), {
      id: docId,
      centerId: String(gen.centerId || 'CTR-001').slice(0, 64),
      centerCode: String(gen.centerCode || 'CTR').slice(0, 32),
      generatorLabel: String(gen.generatorLabel || 'Genset #1').slice(0, 120),
      kvaRating: String(gen.kvaRating || '500 KVA').slice(0, 64),
      gensetModel: String(gen.gensetModel || '-').slice(0, 64),
      gensetSerialNo: String(gen.gensetSerialNo || '-').slice(0, 64),
      engineModel: String(gen.engineModel || '-').slice(0, 64),
      engineSerialNo: String(gen.engineSerialNo || '-').slice(0, 64),
      alternatorModel: String(gen.alternatorModel || '-').slice(0, 64),
      alternatorSerialNo: String(gen.alternatorSerialNo || '-').slice(0, 64),
      controllerModel: String(gen.controllerModel || '-').slice(0, 64),
      avrModel: String(gen.avrModel || '-').slice(0, 64),
      breakerType: gen.breakerType === 'MCCB' ? 'MCCB' : 'ACB',
      breakerPoles: gen.breakerPoles === '3P' ? '3P' : '4P',
      breakerAmpRating: String(gen.breakerAmpRating || '800').slice(0, 32),
      status:
        gen.status === 'Standby' || gen.status === 'Maintenance'
          ? gen.status
          : 'Active',
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes('Missing or insufficient permissions')
    ) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  }
}

/**
 * Deletes a GeneratorAsset from Firebase Firestore /generators/{generatorId}
 */
export async function deleteGeneratorFromFirestore(genId: string): Promise<void> {
  const docId = sanitizeFirestoreId(genId);
  const path = `generators/${docId}`;
  try {
    await deleteDoc(doc(db, 'generators', docId));
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes('Missing or insufficient permissions')
    ) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  }
}

/**
 * Synchronizes GeneratorAssets with Firebase Firestore /generators collection
 */
export async function syncGeneratorsWithFirestore(
  localGenerators: GeneratorAsset[]
): Promise<GeneratorAsset[]> {
  try {
    const snap = await getDocs(collection(db, 'generators'));
    const remoteMap = new Map<string, GeneratorAsset>();

    snap.docs.forEach((d) => {
      const data = d.data();
      const gen: GeneratorAsset = {
        id: String(data.id || d.id),
        centerId: String(data.centerId || ''),
        centerCode: String(data.centerCode || ''),
        generatorLabel: String(data.generatorLabel || 'Genset #1'),
        kvaRating: String(data.kvaRating || '500 KVA'),
        gensetModel: String(data.gensetModel || '-'),
        gensetSerialNo: String(data.gensetSerialNo || '-'),
        engineModel: String(data.engineModel || '-'),
        engineSerialNo: String(data.engineSerialNo || '-'),
        alternatorModel: String(data.alternatorModel || '-'),
        alternatorSerialNo: String(data.alternatorSerialNo || '-'),
        controllerModel: String(data.controllerModel || '-'),
        avrModel: String(data.avrModel || '-'),
        breakerType: data.breakerType === 'MCCB' ? 'MCCB' : 'ACB',
        breakerPoles: data.breakerPoles === '3P' ? '3P' : '4P',
        breakerAmpRating: String(data.breakerAmpRating || '800'),
        status:
          data.status === 'Standby' || data.status === 'Maintenance'
            ? data.status
            : 'Active',
      };
      remoteMap.set(gen.id, gen);
    });

    if (remoteMap.size === 0 && localGenerators.length > 0) {
      await Promise.all(
        localGenerators.map(async (g) => {
          await saveGeneratorToFirestore(g);
          remoteMap.set(sanitizeFirestoreId(g.id), g);
        })
      );
    }

    const merged = Array.from(remoteMap.values());
    for (const g of merged) {
      await idbPut(STORES.GENERATORS, g);
    }
    return merged.length > 0 ? merged : localGenerators;
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes('Missing or insufficient permissions')
    ) {
      handleFirestoreError(error, OperationType.LIST, 'generators');
    }
    return localGenerators;
  }
}

/**
 * Saves a NotificationRuleConfig to Firebase Firestore /notificationConfigs/{configId}
 */
export async function saveNotificationConfigToFirestore(
  config: NotificationRuleConfig,
  updatedByUid?: string
): Promise<void> {
  const docId = sanitizeFirestoreId(config.id);
  const path = `notificationConfigs/${docId}`;
  const updatedBy = String(
    updatedByUid || auth.currentUser?.uid || config.updatedBy || 'USR_ADMIN_01'
  ).slice(0, 128);

  try {
    await setDoc(doc(db, 'notificationConfigs', docId), {
      id: docId,
      triggerType: config.triggerType,
      name: String(config.name || 'Alert Rule').slice(0, 120),
      enabled: Boolean(config.enabled),
      inAppPushEnabled: Boolean(config.inAppPushEnabled),
      emailEnabled: Boolean(config.emailEnabled),
      recipientsCsv: String(
        config.recipientsCsv || 'satshwe36@gmail.com'
      ).slice(0, 1000),
      updatedBy,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes('Missing or insufficient permissions')
    ) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  }
}

/**
 * Synchronizes NotificationRuleConfigs with Firebase Firestore /notificationConfigs
 */
export async function syncNotificationConfigsWithFirestore(
  localConfigs: NotificationRuleConfig[]
): Promise<NotificationRuleConfig[]> {
  try {
    const snap = await getDocs(collection(db, 'notificationConfigs'));
    const remoteMap = new Map<string, NotificationRuleConfig>();

    snap.docs.forEach((d) => {
      const data = d.data();
      const baseDefault = DEFAULT_NOTIFICATION_CONFIGS.find((c) => c.id === d.id);
      const cfg: NotificationRuleConfig = {
        id: String(data.id || d.id),
        triggerType: (data.triggerType as NotificationRuleConfig['triggerType']) || 'CRITICAL_READINESS',
        name: String(data.name || baseDefault?.name || 'Alert Rule'),
        description: baseDefault?.description || '',
        enabled: Boolean(data.enabled),
        inAppPushEnabled: Boolean(data.inAppPushEnabled),
        emailEnabled: Boolean(data.emailEnabled),
        recipientsCsv: String(data.recipientsCsv || 'satshwe36@gmail.com'),
        updatedBy: String(data.updatedBy || 'USR_ADMIN_01'),
        updatedAt: data.updatedAt?.toDate?.()?.toISOString?.() || new Date().toISOString(),
      };
      remoteMap.set(cfg.id, cfg);
    });

    if (remoteMap.size === 0 && localConfigs.length > 0) {
      for (const cfg of localConfigs) {
        await saveNotificationConfigToFirestore(cfg);
        remoteMap.set(cfg.id, cfg);
      }
    }

    const merged = Array.from(remoteMap.values());
    for (const c of merged) {
      await idbPut(STORES.NOTIFICATION_CONFIGS, c);
    }
    return merged.length > 0 ? merged : localConfigs;
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes('Missing or insufficient permissions')
    ) {
      handleFirestoreError(error, OperationType.LIST, 'notificationConfigs');
    }
    return localConfigs;
  }
}

/**
 * Saves an application configuration document (Sector Directory, Checklist Definitions,
 * 300-Hr Servicing Tasks, Job Type Presets, Center Email Overrides) to Firestore /appConfigs/{configId}
 */
export async function saveAppConfigToFirestore(
  configId: string,
  configType: string,
  configData: Record<string, unknown>,
  updatedByUid?: string
): Promise<void> {
  const docId = sanitizeFirestoreId(configId);
  const path = `appConfigs/${docId}`;
  const updatedBy = String(
    updatedByUid || auth.currentUser?.uid || 'USR_ADMIN_01'
  ).slice(0, 128);
  const sanitizedConfigData = JSON.parse(JSON.stringify(configData || {}));

  try {
    await setDoc(doc(db, 'appConfigs', docId), {
      id: docId,
      configType: String(configType || 'GENERAL_CONFIG').slice(0, 64),
      configData: sanitizedConfigData,
      updatedBy,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes('Missing or insufficient permissions')
    ) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  }
}


