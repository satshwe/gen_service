/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore';
import {
  BarChart3,
  ClipboardCheck,
  FileSpreadsheet,
  Database,
  Plus,
  Printer,
  RotateCcw,
  RefreshCw,
  Bell,
  Shield,
  Wifi,
  WifiOff,
  AlertOctagon,
  X,
  LogOut,
  Menu,
  Wrench,
  Clock,
  ChevronRight,
} from 'lucide-react';
import {
  Center,
  GeneratorAsset,
  InspectionReport,
  UserProfile,
  UserRole,
  SyncQueueItem,
  SyncConflict,
  AlertNotification,
  NotificationRuleConfig,
  FormCategory,
  ActivityResolutionDetails,
} from './types';
import { INITIAL_CENTERS, INITIAL_GENERATORS, INITIAL_REPORTS } from './data/seedData';
import {
  auth,
  db,
  googleProvider,
  handleFirestoreError,
  OperationType,
} from './firebase';
import {
  STORES,
  idbGetAll,
  idbPut,
  idbPutMany,
  idbDelete,
  idbClear,
  saveReportToIndexedDBWithQueue,
  processSyncQueue,
  resolveSyncConflict,
  computeReportChecksum,
  sanitizeFirestoreId,
  DEFAULT_NOTIFICATION_CONFIGS,
  DEFAULT_USERS_DIRECTORY,
  saveAuthorizedUserToFirestore,
  deleteAuthorizedUserFromFirestore,
  syncAuthorizedUsersWithFirestore,
  verifyUserCredentialsWithFirebase,
  deleteReportFromFirestore,
  syncReportsWithFirestore,
  saveCenterToFirestore,
  deleteCenterFromFirestore,
  syncCentersWithFirestore,
  saveGeneratorToFirestore,
  deleteGeneratorFromFirestore,
  syncGeneratorsWithFirestore,
  saveNotificationConfigToFirestore,
  syncNotificationConfigsWithFirestore,
} from './utils/indexedDbSync';
import {
  evaluateReportTriggers,
  triggerScheduledMaintenanceReminders,
  dispatchNotificationAndEmail,
} from './utils/notificationEngine';
import { applyRemoteChecklistAppConfig } from './data/checklistConfig';
import { applyRemoteExportAppConfig } from './utils/exportUtils';
import { ExecutiveDashboardModule } from './components/ExecutiveDashboardModule';
import { InspectionFormModule } from './components/InspectionFormModule';
import { ReportsArchiveModule } from './components/ReportsArchiveModule';
import { MasterAssetModule } from './components/MasterAssetModule';
import { OfficialReportPrintView } from './components/OfficialReportPrintView';
import { OfflineSyncCenterModule } from './components/OfflineSyncCenterModule';
import { NotificationsCenterModule } from './components/NotificationsCenterModule';
import { RoleManagementModule } from './components/RoleManagementModule';
import { ActivitiesModule } from './components/ActivitiesModule';
import { LoginPage } from './components/LoginPage';

const AUTH_SESSION_STORAGE_KEY = 'cp_firebase_uid_session_v1';

type ActiveModule =
  | 'dashboard'
  | 'inspection_form'
  | 'activities'
  | 'reports_archive'
  | 'master_assets'
  | 'print_view'
  | 'offline_sync'
  | 'notifications'
  | 'role_management';

export default function App() {
  const [centers, setCenters] = useState<Center[]>(INITIAL_CENTERS);
  const [generators, setGenerators] = useState<GeneratorAsset[]>(INITIAL_GENERATORS);
  const [reports, setReports] = useState<InspectionReport[]>(INITIAL_REPORTS);

  // Offline Sync & Conflict State
  const [browserOnline, setBrowserOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [simulatedOffline, setSimulatedOffline] = useState<boolean>(false);
  const [syncQueue, setSyncQueue] = useState<SyncQueueItem[]>([]);
  const [conflicts, setConflicts] = useState<SyncConflict[]>([]);
  const [conflictStrategy, setConflictStrategy] = useState<'manual' | 'last_write_wins'>('manual');
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(new Date().toISOString());

  // Real-Time Push & Email Notifications State
  const [notifications, setNotifications] = useState<AlertNotification[]>([]);
  const [notificationConfigs, setNotificationConfigs] = useState<NotificationRuleConfig[]>(
    DEFAULT_NOTIFICATION_CONFIGS
  );
  const [livePushToast, setLivePushToast] = useState<AlertNotification | null>(null);

  // RBAC & User Authentication State (Protected by LoginPage Gate)
  const [isSessionAuthenticated, setIsSessionAuthenticated] = useState<boolean>(() => {
    try {
      const saved =
        sessionStorage.getItem(AUTH_SESSION_STORAGE_KEY) ||
        localStorage.getItem(AUTH_SESSION_STORAGE_KEY);
      return Boolean(saved);
    } catch {
      return false;
    }
  });
  const [currentUser, setCurrentUser] = useState<UserProfile>(() => {
    try {
      const saved =
        sessionStorage.getItem(AUTH_SESSION_STORAGE_KEY) ||
        localStorage.getItem(AUTH_SESSION_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as UserProfile;
        if (parsed && parsed.uid && parsed.role) return parsed;
      }
    } catch {
      // Fallback
    }
    return DEFAULT_USERS_DIRECTORY[0];
  });
  const [isFirebaseAuthenticated, setIsFirebaseAuthenticated] = useState<boolean>(false);
  const [usersDirectory, setUsersDirectory] = useState<UserProfile[]>(DEFAULT_USERS_DIRECTORY);

  // Navigation State
  const [activeModule, setActiveModule] = useState<ActiveModule>('dashboard');
  const [selectedReportForPrint, setSelectedReportForPrint] = useState<InspectionReport | null>(
    () => INITIAL_REPORTS[0]
  );
  const [editingReport, setEditingReport] = useState<InspectionReport | null>(null);
  const [activeFormCategory, setActiveFormCategory] = useState<FormCategory>('REGULAR_INSPECTION');
  const [formSessionKey, setFormSessionKey] = useState<number>(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const [mobileFormsSheetOpen, setMobileFormsSheetOpen] = useState<boolean>(false);

  const effectiveOnline = browserOnline && !simulatedOffline;
  const isAdmin = currentUser.role === 'Administrator';
  const isAdminOrChief =
    isAdmin || currentUser.role === 'Chief Engineer';
  const canCreateOrEdit =
    isAdminOrChief || currentUser.role === 'Field Engineer';

  // 1. Initialize IndexedDB and hydrate all stores on boot
  useEffect(() => {
    let mounted = true;
    async function initIndexedDbData() {
      try {
        const [
          storedCenters,
          storedGenerators,
          storedReports,
          storedQueue,
          storedConflicts,
          storedNotifs,
          storedConfigs,
          storedUsers,
        ] = await Promise.all([
          idbGetAll<Center>(STORES.CENTERS),
          idbGetAll<GeneratorAsset>(STORES.GENERATORS),
          idbGetAll<InspectionReport>(STORES.REPORTS),
          idbGetAll<SyncQueueItem>(STORES.SYNC_QUEUE),
          idbGetAll<SyncConflict>(STORES.CONFLICTS),
          idbGetAll<AlertNotification>(STORES.NOTIFICATIONS),
          idbGetAll<NotificationRuleConfig>(STORES.NOTIFICATION_CONFIGS),
          idbGetAll<UserProfile>(STORES.USERS),
        ]);

        if (!mounted) return;

        const initialLocalCenters =
          storedCenters.length > 0 ? storedCenters : INITIAL_CENTERS;
        if (storedCenters.length > 0) {
          setCenters(storedCenters);
        } else {
          await idbPutMany(STORES.CENTERS, INITIAL_CENTERS);
        }

        const initialLocalGenerators =
          storedGenerators.length > 0 ? storedGenerators : INITIAL_GENERATORS;
        if (storedGenerators.length > 0) {
          setGenerators(storedGenerators);
        } else {
          await idbPutMany(STORES.GENERATORS, INITIAL_GENERATORS);
        }

        let initialLocalReports: InspectionReport[] = [];
        if (storedReports.length > 0) {
          const upgraded = storedReports.map((sr) => {
            const matchedSeed = INITIAL_REPORTS.find((ir) => ir.id === sr.id);
            if (matchedSeed) {
              return {
                ...sr,
                formCategory:
                  matchedSeed.formCategory === 'BREAKDOWN_REPORT'
                    ? 'BREAKDOWN_REPORT'
                    : sr.formCategory || matchedSeed.formCategory || 'REGULAR_INSPECTION',
                servicing300Hr: sr.servicing300Hr || matchedSeed.servicing300Hr,
                breakdownDetails: sr.breakdownDetails || matchedSeed.breakdownDetails,
                jobRequestType: sr.jobRequestType || matchedSeed.jobRequestType,
                activityResolution: sr.activityResolution || matchedSeed.activityResolution,
                matchedEmailRuleId: sr.matchedEmailRuleId || matchedSeed.matchedEmailRuleId,
                recipientEmails: sr.recipientEmails || matchedSeed.recipientEmails,
                replacementParts:
                  sr.replacementParts.length > 0
                    ? sr.replacementParts
                    : matchedSeed.replacementParts,
              };
            }
            if (!sr.formCategory) {
              return { ...sr, formCategory: 'REGULAR_INSPECTION' as const };
            }
            return sr;
          });
          await idbPutMany(STORES.REPORTS, upgraded);
          const sorted = [...upgraded].sort((a, b) =>
            b.reportNo.localeCompare(a.reportNo)
          );
          initialLocalReports = sorted;
          setReports(sorted);
        } else {
          const seededWithChecksums = INITIAL_REPORTS.map((r) => ({
            ...r,
            syncVersion: 1,
            syncState: 'synced' as const,
            checksum: computeReportChecksum(r),
          }));
          await idbPutMany(STORES.REPORTS, seededWithChecksums);
          initialLocalReports = seededWithChecksums;
          setReports(seededWithChecksums);
        }

        setSyncQueue(storedQueue);
        setConflicts(storedConflicts);

        if (storedNotifs.length > 0) {
          setNotifications(
            [...storedNotifs].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
          );
        } else {
          const initialAlert: AlertNotification = {
            id: 'ALT_INIT_001',
            triggerType: 'CRITICAL_READINESS',
            severity: 'Critical',
            title: 'Critical Readiness Alert: CMSTJ (Oil Pressure 3.35 Bar & Coolant Leak)',
            message:
              'Generator inspection logged lower radiator coolant seepage and oil pressure below 3.5 Bar threshold. Immediate corrective action scheduled.',
            centerCode: 'CMSTJ',
            generatorId: 'GEN-003',
            reportNo: '002032',
            recipientsSummary: 'satshwe36@gmail.com, chief.engineer@cityproperties.com.mm',
            emailDispatched: true,
            read: false,
            authorUid: 'SYSTEM_MONITOR',
            createdAt: new Date().toISOString(),
          };
          await idbPut(STORES.NOTIFICATIONS, initialAlert);
          setNotifications([initialAlert]);
        }

        const initialLocalConfigs =
          storedConfigs.length > 0 ? storedConfigs : DEFAULT_NOTIFICATION_CONFIGS;
        if (storedConfigs.length > 0) {
          setNotificationConfigs(storedConfigs);
        } else {
          await idbPutMany(STORES.NOTIFICATION_CONFIGS, DEFAULT_NOTIFICATION_CONFIGS);
        }

        const initialLocalUsers =
          storedUsers.length > 0 ? storedUsers : DEFAULT_USERS_DIRECTORY;

        // Synchronize all collections with Firebase Firestore when online
        if (navigator.onLine) {
          const [
            syncedFirebaseUsers,
            syncedFirebaseReports,
            syncedFirebaseCenters,
            syncedFirebaseGenerators,
            syncedFirebaseConfigs,
          ] = await Promise.all([
            syncAuthorizedUsersWithFirestore(initialLocalUsers),
            syncReportsWithFirestore(initialLocalReports),
            syncCentersWithFirestore(initialLocalCenters),
            syncGeneratorsWithFirestore(initialLocalGenerators),
            syncNotificationConfigsWithFirestore(initialLocalConfigs),
          ]);

          if (mounted) {
            setUsersDirectory(syncedFirebaseUsers);
            if (syncedFirebaseReports.length > 0) {
              setReports(
                [...syncedFirebaseReports].sort((a, b) =>
                  b.reportNo.localeCompare(a.reportNo)
                )
              );
            }
            if (syncedFirebaseCenters.length > 0) {
              setCenters(syncedFirebaseCenters);
            }
            if (syncedFirebaseGenerators.length > 0) {
              setGenerators(syncedFirebaseGenerators);
            }
            if (syncedFirebaseConfigs.length > 0) {
              setNotificationConfigs(syncedFirebaseConfigs);
            }
          }
        } else if (mounted) {
          setUsersDirectory(initialLocalUsers);
        }
      } catch (err) {
        console.error('IndexedDB hydration error:', err);
      }
    }

    initIndexedDbData();
    return () => {
      mounted = false;
    };
  }, []);

  // 2. Real-time Firestore listener for Authorized Users (/users collection)
  useEffect(() => {
    if (!effectiveOnline) return;
    const usersPath = 'users';
    const unsubscribe = onSnapshot(
      collection(db, usersPath),
      async (snapshot) => {
        if (snapshot.empty) return;
        const remoteUsers: UserProfile[] = [];
        snapshot.forEach((docSnap) => {
          const d = docSnap.data();
          if (d && d.uid) {
            const defMatch = DEFAULT_USERS_DIRECTORY.find((u) => u.uid === d.uid);
            remoteUsers.push({
              uid: String(d.uid),
              password: String(d.password || defMatch?.password || 'CityProp@2026'),
              email: String(d.email || defMatch?.email || ''),
              displayName: String(d.displayName || defMatch?.displayName || d.uid),
              role: (d.role as UserRole) || defMatch?.role || 'Field Engineer',
              department: String(d.department || defMatch?.department || 'Engineering'),
              updatedAt:
                d.updatedAt?.toDate?.()?.toISOString?.() || new Date().toISOString(),
            });
          }
        });
        if (remoteUsers.length > 0) {
          await idbPutMany(STORES.USERS, remoteUsers);
          setUsersDirectory(remoteUsers);
        }
      },
      (error) => {
        console.warn('Firestore users listener notice:', error);
      }
    );
    return () => unsubscribe();
  }, [effectiveOnline]);

  // 2B. Firebase Google Authentication & Profile Sync Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser && fbUser.email) {
        setIsFirebaseAuthenticated(true);
        const userDocPath = `users/${fbUser.uid}`;
        const defaultRole: UserRole =
          fbUser.email === 'satshwe36@gmail.com' ? 'Administrator' : 'Field Engineer';

        try {
          const snap = await getDoc(doc(db, 'users', fbUser.uid));
          if (snap.exists()) {
            const data = snap.data();
            const profile: UserProfile = {
              uid: fbUser.uid,
              password: String(data.password || 'Admin@2026'),
              email: String(data.email || fbUser.email),
              displayName: String(data.displayName || fbUser.displayName || 'Authorized User'),
              role: (data.role as UserRole) || defaultRole,
              department: String(data.department || 'Corporate Engineering'),
            };
            setCurrentUser(profile);
            setIsSessionAuthenticated(true);
            sessionStorage.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify(profile));
            await idbPut(STORES.USERS, profile);
          } else {
            const newProfile: UserProfile = {
              uid: fbUser.uid,
              password: 'Admin@2026',
              email: fbUser.email,
              displayName: fbUser.displayName || fbUser.email.split('@')[0],
              role: defaultRole,
              department: 'Corporate Engineering & Maintenance',
            };
            await saveAuthorizedUserToFirestore(newProfile);
            setCurrentUser(newProfile);
            setIsSessionAuthenticated(true);
            sessionStorage.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify(newProfile));
          }
        } catch (error) {
          if (
            error instanceof Error &&
            error.message.includes('Missing or insufficient permissions')
          ) {
            handleFirestoreError(error, OperationType.GET, userDocPath);
          }
        }
      } else {
        setIsFirebaseAuthenticated(false);
      }
    });

    return () => unsubscribe();
  }, []);

  // 3. Real-time Firestore listeners for ALL collections (/reports, /centers, /generators, /notifications, /notificationConfigs, /appConfigs)
  useEffect(() => {
    if (!effectiveOnline) return;

    // 3A. Reports listener (/reports) — Form 1, Form 2, Form 3, Activities & PDF Archive
    const reportsPath = 'reports';
    const unsubReports = onSnapshot(
      collection(db, reportsPath),
      async (snapshot) => {
        if (snapshot.empty) return;
        const remoteReports: InspectionReport[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          if (data && data.reportData && typeof data.reportData === 'object') {
            const rep: InspectionReport = {
              ...(data.reportData as InspectionReport),
              id: String(data.id || docSnap.id),
              syncVersion: Number(data.syncVersion || 1),
              syncState: 'synced',
            };
            remoteReports.push(rep);
          }
        });
        if (remoteReports.length > 0) {
          await idbPutMany(STORES.REPORTS, remoteReports);
          const sorted = [...remoteReports].sort((a, b) =>
            b.reportNo.localeCompare(a.reportNo)
          );
          setReports(sorted);
        }
      },
      (error) => {
        console.warn('Firestore reports listener notice:', error);
      }
    );

    // 3B. Master Centers listener (/centers)
    const centersPath = 'centers';
    const unsubCenters = onSnapshot(
      collection(db, centersPath),
      async (snapshot) => {
        if (snapshot.empty) return;
        const remoteCenters: Center[] = [];
        snapshot.forEach((docSnap) => {
          const d = docSnap.data();
          if (d && d.id) {
            remoteCenters.push({
              id: String(d.id),
              centerCode: String(d.centerCode || ''),
              centerName: String(d.centerName || ''),
              address: String(d.address || '-'),
              township: String(d.township || '-'),
              contactPerson: String(d.contactPerson || '-'),
              contactPhone: String(d.contactPhone || '-'),
              region: (d.region as Center['region']) || 'Yangon',
            });
          }
        });
        if (remoteCenters.length > 0) {
          await idbPutMany(STORES.CENTERS, remoteCenters);
          setCenters(remoteCenters);
        }
      },
      (error) => {
        console.warn('Firestore centers listener notice:', error);
      }
    );

    // 3C. Master Generators listener (/generators)
    const generatorsPath = 'generators';
    const unsubGenerators = onSnapshot(
      collection(db, generatorsPath),
      async (snapshot) => {
        if (snapshot.empty) return;
        const remoteGenerators: GeneratorAsset[] = [];
        snapshot.forEach((docSnap) => {
          const d = docSnap.data();
          if (d && d.id) {
            remoteGenerators.push({
              id: String(d.id),
              centerId: String(d.centerId || ''),
              centerCode: String(d.centerCode || ''),
              generatorLabel: String(d.generatorLabel || 'Genset #1'),
              kvaRating: String(d.kvaRating || '500 KVA'),
              gensetModel: String(d.gensetModel || '-'),
              gensetSerialNo: String(d.gensetSerialNo || '-'),
              engineModel: String(d.engineModel || '-'),
              engineSerialNo: String(d.engineSerialNo || '-'),
              alternatorModel: String(d.alternatorModel || '-'),
              alternatorSerialNo: String(d.alternatorSerialNo || '-'),
              controllerModel: String(d.controllerModel || '-'),
              avrModel: String(d.avrModel || '-'),
              breakerType: d.breakerType === 'MCCB' ? 'MCCB' : 'ACB',
              breakerPoles: d.breakerPoles === '3P' ? '3P' : '4P',
              breakerAmpRating: String(d.breakerAmpRating || '800'),
              status:
                d.status === 'Standby' || d.status === 'Maintenance'
                  ? d.status
                  : 'Active',
            });
          }
        });
        if (remoteGenerators.length > 0) {
          await idbPutMany(STORES.GENERATORS, remoteGenerators);
          setGenerators(remoteGenerators);
        }
      },
      (error) => {
        console.warn('Firestore generators listener notice:', error);
      }
    );

    // 3D. Notifications listener (/notifications)
    const notifPath = 'notifications';
    const unsubNotifs = onSnapshot(
      collection(db, notifPath),
      async (snapshot) => {
        const remoteNotifs: AlertNotification[] = [];
        snapshot.forEach((docSnap) => {
          const d = docSnap.data();
          remoteNotifs.push({
            id: d.id,
            triggerType: d.triggerType,
            severity: d.severity,
            title: d.title,
            message: d.message,
            centerCode: d.centerCode,
            generatorId: d.generatorId,
            reportNo: d.reportNo,
            recipientsSummary: d.recipientsSummary,
            emailDispatched: Boolean(d.emailDispatched),
            read: Boolean(d.read),
            authorUid: d.authorUid,
            createdAt:
              d.createdAt?.toDate?.()?.toISOString?.() || new Date().toISOString(),
          });
        });
        if (remoteNotifs.length > 0) {
          const allLocal = await idbGetAll<AlertNotification>(STORES.NOTIFICATIONS);
          const mergedMap = new Map<string, AlertNotification>();
          allLocal.forEach((n) => mergedMap.set(n.id, n));
          remoteNotifs.forEach((n) => mergedMap.set(n.id, n));
          const merged = Array.from(mergedMap.values()).sort((a, b) =>
            b.createdAt.localeCompare(a.createdAt)
          );
          setNotifications(merged);
        }
      },
      (error) => {
        console.warn('Firestore notifications listener notice:', error);
      }
    );

    // 3E. Notification Rule Configs listener (/notificationConfigs)
    const cfgPath = 'notificationConfigs';
    const unsubConfigs = onSnapshot(
      collection(db, cfgPath),
      async (snapshot) => {
        if (snapshot.empty) return;
        const remoteCfgs: NotificationRuleConfig[] = [];
        snapshot.forEach((docSnap) => {
          const d = docSnap.data();
          const baseDefault = DEFAULT_NOTIFICATION_CONFIGS.find((c) => c.id === docSnap.id);
          remoteCfgs.push({
            id: String(d.id || docSnap.id),
            triggerType:
              (d.triggerType as NotificationRuleConfig['triggerType']) || 'CRITICAL_READINESS',
            name: String(d.name || baseDefault?.name || 'Alert Rule'),
            description: baseDefault?.description || '',
            enabled: Boolean(d.enabled),
            inAppPushEnabled: Boolean(d.inAppPushEnabled),
            emailEnabled: Boolean(d.emailEnabled),
            recipientsCsv: String(d.recipientsCsv || 'satshwe36@gmail.com'),
            updatedBy: String(d.updatedBy || 'USR_ADMIN_01'),
            updatedAt:
              d.updatedAt?.toDate?.()?.toISOString?.() || new Date().toISOString(),
          });
        });
        if (remoteCfgs.length > 0) {
          await idbPutMany(STORES.NOTIFICATION_CONFIGS, remoteCfgs);
          setNotificationConfigs(remoteCfgs);
        }
      },
      (error) => {
        console.warn('Firestore notificationConfigs listener notice:', error);
      }
    );

    // 3F. App Configs listener (/appConfigs) — Sector Names, Admin Form Customizations, Email Rules
    const appCfgPath = 'appConfigs';
    const unsubAppConfigs = onSnapshot(
      collection(db, appCfgPath),
      (snapshot) => {
        if (snapshot.empty) return;
        snapshot.forEach((docSnap) => {
          const d = docSnap.data();
          if (d && d.configType && d.configData && typeof d.configData === 'object') {
            applyRemoteChecklistAppConfig(
              String(d.configType),
              d.configData as Record<string, unknown>
            );
            applyRemoteExportAppConfig(
              String(d.configType),
              d.configData as Record<string, unknown>
            );
          }
        });
      },
      (error) => {
        console.warn('Firestore appConfigs listener notice:', error);
      }
    );

    return () => {
      unsubReports();
      unsubCenters();
      unsubGenerators();
      unsubNotifs();
      unsubConfigs();
      unsubAppConfigs();
    };
  }, [effectiveOnline]);

  // 4. Synchronize IndexedDB Queue with Server & Firestore
  const handleSyncQueue = useCallback(async () => {
    if (!effectiveOnline) return;
    setIsSyncing(true);
    try {
      const result = await processSyncQueue({
        isOnline: effectiveOnline,
        conflictStrategy,
      });
      setSyncQueue(result.remainingQueue);
      setConflicts(result.conflicts);
      const updatedReports = await idbGetAll<InspectionReport>(STORES.REPORTS);
      setReports(
        [...updatedReports].sort((a, b) => b.reportNo.localeCompare(a.reportNo))
      );
      setLastSyncedAt(new Date().toISOString());
    } finally {
      setIsSyncing(false);
    }
  }, [effectiveOnline, conflictStrategy]);

  // Listen to browser online/offline events & auto-sync when connectivity returns
  useEffect(() => {
    const onOnline = () => {
      setBrowserOnline(true);
    };
    const onOffline = () => {
      setBrowserOnline(false);
    };
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  useEffect(() => {
    if (effectiveOnline && syncQueue.length > 0) {
      handleSyncQueue();
    }
  }, [effectiveOnline, syncQueue.length, handleSyncQueue]);

  // Compute next sequential 6-digit Report No
  const nextReportNo = useMemo(() => {
    let maxNum = 2048;
    reports.forEach((r) => {
      const parsed = parseInt(r.reportNo, 10);
      if (!isNaN(parsed) && parsed > maxNum) {
        maxNum = parsed;
      }
    });
    return String(maxNum + 1).padStart(6, '0');
  }, [reports]);

  // Save Inspection Report (Offline-First via IndexedDB + Sync Queue + Real-Time Alert Evaluation)
  const handleSaveReport = async (
    report: InspectionReport,
    openPrintAfterSave: boolean
  ) => {
    if (!canCreateOrEdit) return;

    const { savedReport } = await saveReportToIndexedDBWithQueue(
      report,
      effectiveOnline
    );

    setReports((prev) => {
      const idx = prev.findIndex((r) => r.id === savedReport.id);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = savedReport;
        return updated;
      }
      return [savedReport, ...prev];
    });

    const updatedQueue = await idbGetAll<SyncQueueItem>(STORES.SYNC_QUEUE);
    setSyncQueue(updatedQueue);

    // Evaluate Critical / Bad Checklist Item notification triggers
    const firedAlerts = await evaluateReportTriggers(savedReport, notificationConfigs);
    if (firedAlerts.length > 0) {
      setNotifications((prev) => [...firedAlerts, ...prev]);
      setLivePushToast(firedAlerts[0]);
    }

    // If currently online, flush the queue immediately to server & Firestore
    if (effectiveOnline) {
      await handleSyncQueue();
    }

    setEditingReport(null);
    if (openPrintAfterSave) {
      setSelectedReportForPrint(savedReport);
      setActiveModule('print_view');
    }
  };

  const handleDeleteReport = async (id: string) => {
    if (!isAdmin) return;
    await idbDelete(STORES.REPORTS, id);
    await idbDelete(STORES.SYNC_QUEUE, `SYNC_${id}`);
    setReports((prev) => prev.filter((r) => r.id !== id));
    setSyncQueue((prev) => prev.filter((q) => q.entityId !== id));
    if (effectiveOnline) {
      await deleteReportFromFirestore(id);
    }
  };

  const handleUpdateReportActivity = async (
    reportId: string,
    resolution: ActivityResolutionDetails
  ) => {
    if (!canCreateOrEdit) return;
    const target = reports.find((r) => r.id === reportId);
    if (!target) return;

    const updatedReport: InspectionReport = {
      ...target,
      activityResolution: resolution,
      readinessStatus:
        resolution.status === 'Completed' ? 'Ready' : 'Action Required',
    };

    const { savedReport } = await saveReportToIndexedDBWithQueue(
      updatedReport,
      effectiveOnline
    );

    setReports((prev) =>
      prev.map((r) => (r.id === savedReport.id ? savedReport : r))
    );

    if (effectiveOnline) {
      await handleSyncQueue();
    }
  };

  const handleOpenReportPdf = (report: InspectionReport) => {
    setSelectedReportForPrint(report);
    setActiveModule('print_view');
  };

  const handleEditReport = (report: InspectionReport) => {
    if (!isAdmin) return;
    setEditingReport(report);
    setActiveFormCategory(report.formCategory || 'REGULAR_INSPECTION');
    setFormSessionKey((prev) => prev + 1);
    setActiveModule('inspection_form');
  };

  const handleStartNewInspection = (
    centerId?: string,
    generatorId?: string,
    formCategory: FormCategory = 'REGULAR_INSPECTION'
  ) => {
    if (!canCreateOrEdit) {
      setActiveModule('role_management');
      return;
    }
    setActiveFormCategory(formCategory);
    setFormSessionKey((prev) => prev + 1);
    if (centerId) {
      const center = centers.find((c) => c.id === centerId) || centers[0];
      const gen =
        generators.find((g) => g.id === generatorId) ||
        generators.find((g) => g.centerId === center.id) ||
        generators[0];
      const baseTemplate = INITIAL_REPORTS[0];
      setEditingReport({
        ...baseTemplate,
        id: `REP_${nextReportNo}`,
        reportNo: nextReportNo,
        formCategory,
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
        customerName: center.contactPerson,
        customerSignName: center.contactPerson,
        inspectionDate: new Date().toISOString().slice(0, 10),
        syncVersion: 1,
      });
    } else {
      setEditingReport(null);
    }
    setActiveModule('inspection_form');
  };

  // Conflict Simulation & Resolution Handlers
  const handleSimulateServerConflict = async (targetReport: InspectionReport) => {
    try {
      await fetch('/api/sync/simulate-conflict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ report: targetReport }),
      });
    } catch {
      // Ignore if offline
    }

    // Modify local report in IndexedDB and enqueue so sync detects the version divergence
    const localModified: InspectionReport = {
      ...targetReport,
      generalRemarks: 'Updated on field tablet in offline mode (IndexedDB local edit).',
      parameters: {
        ...targetReport.parameters,
        engineOilPressureBar: 5.45,
      },
    };
    await saveReportToIndexedDBWithQueue(localModified, false);
    const updatedQueue = await idbGetAll<SyncQueueItem>(STORES.SYNC_QUEUE);
    setSyncQueue(updatedQueue);

    if (effectiveOnline) {
      await handleSyncQueue();
    }
  };

  const handleResolveConflict = async (
    conflict: SyncConflict,
    resolution: 'keep_local' | 'accept_server'
  ) => {
    await resolveSyncConflict(conflict, resolution);
    const [updatedReports, updatedQueue, updatedConflicts] = await Promise.all([
      idbGetAll<InspectionReport>(STORES.REPORTS),
      idbGetAll<SyncQueueItem>(STORES.SYNC_QUEUE),
      idbGetAll<SyncConflict>(STORES.CONFLICTS),
    ]);
    setReports([...updatedReports].sort((a, b) => b.reportNo.localeCompare(a.reportNo)));
    setSyncQueue(updatedQueue);
    setConflicts(updatedConflicts);
  };

  // Notification Handlers
  const handleMarkNotificationRead = async (id: string) => {
    const target = notifications.find((n) => n.id === id);
    if (!target) return;
    const updated: AlertNotification = { ...target, read: true };
    await idbPut(STORES.NOTIFICATIONS, updated);
    setNotifications((prev) => prev.map((n) => (n.id === id ? updated : n)));

    if (effectiveOnline) {
      const docId = sanitizeFirestoreId(id);
      try {
        await updateDoc(doc(db, 'notifications', docId), { read: true });
      } catch {
        // Ignore if not yet synced to Firestore
      }
    }
  };

  const handleMarkAllNotificationsRead = async () => {
    const updatedList = notifications.map((n) => ({ ...n, read: true }));
    await idbPutMany(STORES.NOTIFICATIONS, updatedList);
    setNotifications(updatedList);
    if (effectiveOnline) {
      await Promise.all(
        updatedList.map(async (n) => {
          const docId = sanitizeFirestoreId(n.id);
          try {
            await updateDoc(doc(db, 'notifications', docId), { read: true });
          } catch {
            // Ignore
          }
        })
      );
    }
  };

  const handleSaveNotificationConfig = async (cfg: NotificationRuleConfig) => {
    if (!isAdminOrChief) return;
    await idbPut(STORES.NOTIFICATION_CONFIGS, cfg);
    setNotificationConfigs((prev) => prev.map((c) => (c.id === cfg.id ? cfg : c)));

    if (effectiveOnline) {
      await saveNotificationConfigToFirestore(
        cfg,
        auth.currentUser?.uid || currentUser.uid
      );
    }
  };

  const handleTriggerScheduledReminders = async () => {
    const generated = await triggerScheduledMaintenanceReminders(
      centers,
      reports,
      notificationConfigs
    );
    if (generated.length > 0) {
      setNotifications((prev) => [...generated, ...prev]);
      setLivePushToast(generated[0]);
    }
  };

  const handleTriggerTestCriticalAlert = async () => {
    const criticalRule =
      notificationConfigs.find((c) => c.triggerType === 'CRITICAL_READINESS') ||
      DEFAULT_NOTIFICATION_CONFIGS[0];
    const testNotif: AlertNotification = {
      id: `ALT_TEST_${Date.now().toString().slice(-6)}`,
      triggerType: 'CRITICAL_READINESS',
      severity: 'Critical',
      title: 'CRITICAL ALERT: CMLSPL (500 KVA PM500CS) — Low Oil Pressure / Emergency Check',
      message:
        'Automated trigger test: Generator Readiness Status changed to CRITICAL at City Mall Shwe Pin Lone (CMLSPL). Immediate dispatch notification sent to engineering recipients.',
      centerCode: 'CMLSPL',
      generatorId: 'GEN-001',
      reportNo: '002048',
      recipientsSummary: criticalRule.recipientsCsv,
      emailDispatched: true,
      read: false,
      authorUid: auth.currentUser?.uid || currentUser.uid,
      createdAt: new Date().toISOString(),
    };
    const dispatched = await dispatchNotificationAndEmail(testNotif, criticalRule);
    setNotifications((prev) => [dispatched, ...prev]);
    setLivePushToast(dispatched);
  };

  // Master Assets Handlers (IndexedDB + Real-Time Firebase Firestore Sync)
  const handleSaveCenter = async (center: Center) => {
    if (!isAdminOrChief) return;
    await idbPut(STORES.CENTERS, center);
    setCenters((prev) => {
      const idx = prev.findIndex((c) => c.id === center.id);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = center;
        return updated;
      }
      return [...prev, center];
    });
    if (effectiveOnline) {
      await saveCenterToFirestore(center);
    }
  };

  const handleDeleteCenter = async (id: string) => {
    if (!isAdminOrChief) return;
    await idbDelete(STORES.CENTERS, id);
    setCenters((prev) => prev.filter((c) => c.id !== id));
    if (effectiveOnline) {
      await deleteCenterFromFirestore(id);
    }
  };

  const handleSaveGenerator = async (generator: GeneratorAsset) => {
    if (!isAdminOrChief) return;
    await idbPut(STORES.GENERATORS, generator);
    setGenerators((prev) => {
      const idx = prev.findIndex((g) => g.id === generator.id);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = generator;
        return updated;
      }
      return [...prev, generator];
    });
    if (effectiveOnline) {
      await saveGeneratorToFirestore(generator);
    }
  };

  const handleDeleteGenerator = async (id: string) => {
    if (!isAdminOrChief) return;
    await idbDelete(STORES.GENERATORS, id);
    setGenerators((prev) => prev.filter((g) => g.id !== id));
    if (effectiveOnline) {
      await deleteGeneratorFromFirestore(id);
    }
  };

  const handleBulkUpdateAssets = async (
    newCenters: Center[],
    newGenerators: GeneratorAsset[]
  ) => {
    if (!isAdminOrChief) return;
    await idbPutMany(STORES.CENTERS, newCenters);
    await idbPutMany(STORES.GENERATORS, newGenerators);
    setCenters(newCenters);
    setGenerators(newGenerators);
    if (effectiveOnline) {
      await Promise.all([
        ...newCenters.map((c) => saveCenterToFirestore(c)),
        ...newGenerators.map((g) => saveGeneratorToFirestore(g)),
      ]);
    }
  };

  // Role Management & Auth Handlers
  const handleLoginWithCredentials = async (
    uidInput: string,
    passwordInput: string,
    rememberSession: boolean
  ) => {
    const verification = await verifyUserCredentialsWithFirebase(
      uidInput,
      passwordInput,
      usersDirectory
    );
    if (verification.success && verification.user) {
      setCurrentUser(verification.user);
      setIsSessionAuthenticated(true);
      sessionStorage.setItem(
        AUTH_SESSION_STORAGE_KEY,
        JSON.stringify(verification.user)
      );
      if (rememberSession) {
        localStorage.setItem(
          AUTH_SESSION_STORAGE_KEY,
          JSON.stringify(verification.user)
        );
      } else {
        localStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
      }
      setUsersDirectory((prev) => {
        const exists = prev.some((u) => u.uid === verification.user!.uid);
        return exists
          ? prev.map((u) =>
              u.uid === verification.user!.uid ? verification.user! : u
            )
          : [...prev, verification.user!];
      });
    }
    return verification;
  };

  const handleSignInWithGoogle = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      console.error('Google Sign-In error:', err);
    }
  };

  const handleSignOut = async () => {
    try {
      sessionStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
      localStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
      setIsSessionAuthenticated(false);
      if (isFirebaseAuthenticated) {
        await firebaseSignOut(auth);
        setIsFirebaseAuthenticated(false);
      }
    } catch (err) {
      console.error('Sign-Out error:', err);
    }
  };

  const handleSwitchActiveRole = (role: UserRole) => {
    if (currentUser.role !== 'Administrator') return;
    setCurrentUser((prev) => {
      const updated = { ...prev, role };
      sessionStorage.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  };

  const handleUpdateUserRole = async (uid: string, newRole: UserRole) => {
    if (currentUser.role !== 'Administrator') return;
    const target = usersDirectory.find((u) => u.uid === uid);
    if (!target) return;
    const updatedUser: UserProfile = {
      ...target,
      role: newRole,
      updatedAt: new Date().toISOString(),
    };
    const saved = await saveAuthorizedUserToFirestore(updatedUser);
    setUsersDirectory((prev) => prev.map((u) => (u.uid === uid ? saved : u)));
    if (currentUser.uid === uid) {
      setCurrentUser(saved);
    }
  };

  const handleUpdateUserPassword = async (uid: string, newPassword: string) => {
    if (currentUser.role !== 'Administrator') return;
    const target = usersDirectory.find((u) => u.uid === uid);
    if (!target) return;
    const updatedUser: UserProfile = {
      ...target,
      password: newPassword,
      updatedAt: new Date().toISOString(),
    };
    const saved = await saveAuthorizedUserToFirestore(updatedUser);
    setUsersDirectory((prev) => prev.map((u) => (u.uid === uid ? saved : u)));
    if (currentUser.uid === uid) {
      setCurrentUser(saved);
    }
  };

  const handleAddDirectoryUser = async (newUser: UserProfile) => {
    if (currentUser.role !== 'Administrator') return;
    const saved = await saveAuthorizedUserToFirestore(newUser);
    setUsersDirectory((prev) => {
      const idx = prev.findIndex((u) => u.uid === saved.uid);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = saved;
        return next;
      }
      return [...prev, saved];
    });
  };

  const handleDeleteDirectoryUser = async (uid: string) => {
    if (currentUser.role !== 'Administrator' || uid === 'USR_ADMIN_01') return;
    await deleteAuthorizedUserFromFirestore(uid);
    setUsersDirectory((prev) => prev.filter((u) => u.uid !== uid));
  };

  const handleResetDemoData = async () => {
    await Promise.all([
      idbClear(STORES.CENTERS),
      idbClear(STORES.GENERATORS),
      idbClear(STORES.REPORTS),
      idbClear(STORES.SYNC_QUEUE),
      idbClear(STORES.CONFLICTS),
    ]);
    await idbPutMany(STORES.CENTERS, INITIAL_CENTERS);
    await idbPutMany(STORES.GENERATORS, INITIAL_GENERATORS);
    await idbPutMany(STORES.REPORTS, INITIAL_REPORTS);
    setCenters(INITIAL_CENTERS);
    setGenerators(INITIAL_GENERATORS);
    setReports(INITIAL_REPORTS);
    setSyncQueue([]);
    setConflicts([]);
  };

  const unreadAlertsCount = notifications.filter((n) => !n.read).length;

  // Security Login Page Gate (Requires Firebase User UID & Password match before entering)
  if (!isSessionAuthenticated) {
    return (
      <LoginPage
        onLoginWithCredentials={handleLoginWithCredentials}
        onSignInWithGoogle={handleSignInWithGoogle}
      />
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      {/* =====================================================================
          TOP NAVIGATION BAR (Responsive across Desktop, Tablet & Mobile)
         ===================================================================== */}
      <header className="no-print sticky top-0 z-40 bg-slate-900 text-white border-b border-slate-800 px-3 sm:px-8 py-2.5 sm:py-3">
        <div className="max-w-[1440px] mx-auto flex items-center justify-between gap-x-4 sm:gap-x-6">
          {/* Zone 1: Brand Wordmark with Official Logo */}
          <button
            type="button"
            onClick={() => setActiveModule('dashboard')}
            className="text-sm sm:text-base font-bold tracking-tight text-white whitespace-nowrap shrink-0 text-left flex items-center gap-2.5"
            title="City Properties Co., Ltd — Dashboard"
          >
            <img
              src="/assets/aistudio/cp_logo_cb60fbe9.jfif"
              alt="City Properties Logo"
              className="h-8 sm:h-9 w-auto object-contain rounded bg-white p-0.5 shadow-xs shrink-0"
            />
            <span className="hidden sm:inline font-bold">City Properties Co., Ltd</span>
          </button>

          {/* Desktop Navigation Links (hidden on mobile, replaced by bottom bar) */}
          <nav className="hidden md:flex items-center gap-4 lg:gap-6 text-xs font-medium text-slate-300 overflow-x-auto">
            <button
              type="button"
              onClick={() => setActiveModule('dashboard')}
              className={`py-1 transition-colors whitespace-nowrap shrink-0 ${
                activeModule === 'dashboard'
                  ? 'text-white font-semibold underline underline-offset-8 decoration-2'
                  : 'hover:text-white'
              }`}
            >
              Analytics
            </button>

            {/* Inspection & Servicing Forms — Hidden for Viewer role */}
            {currentUser.role !== 'Viewer' && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setEditingReport(null);
                    setActiveFormCategory('REGULAR_INSPECTION');
                    setFormSessionKey((prev) => prev + 1);
                    setActiveModule('inspection_form');
                  }}
                  className={`py-1 transition-colors whitespace-nowrap shrink-0 ${
                    activeModule === 'inspection_form' &&
                    activeFormCategory === 'REGULAR_INSPECTION'
                      ? 'text-white font-semibold underline underline-offset-8 decoration-2'
                      : 'hover:text-white'
                  }`}
                >
                  Regular Inspection
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setEditingReport(null);
                    setActiveFormCategory('REGULAR_SERVICING_300HR');
                    setFormSessionKey((prev) => prev + 1);
                    setActiveModule('inspection_form');
                  }}
                  className={`py-1 transition-colors whitespace-nowrap shrink-0 ${
                    activeModule === 'inspection_form' &&
                    activeFormCategory === 'REGULAR_SERVICING_300HR'
                      ? 'text-white font-semibold underline underline-offset-8 decoration-2'
                      : 'hover:text-white'
                  }`}
                >
                  300-Hr Servicing
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setEditingReport(null);
                    setActiveFormCategory('BREAKDOWN_REPORT');
                    setFormSessionKey((prev) => prev + 1);
                    setActiveModule('inspection_form');
                  }}
                  className={`py-1 transition-colors whitespace-nowrap shrink-0 ${
                    activeModule === 'inspection_form' &&
                    activeFormCategory === 'BREAKDOWN_REPORT'
                      ? 'text-white font-semibold underline underline-offset-8 decoration-2'
                      : 'hover:text-white'
                  }`}
                >
                  Breakdown Form
                </button>
              </>
            )}

            <button
              type="button"
              onClick={() => setActiveModule('activities')}
              className={`py-1 transition-colors whitespace-nowrap shrink-0 ${
                activeModule === 'activities'
                  ? 'text-white font-semibold underline underline-offset-8 decoration-2'
                  : 'hover:text-white'
              }`}
            >
              Activities
            </button>

            <button
              type="button"
              onClick={() => setActiveModule('reports_archive')}
              className={`py-1 transition-colors whitespace-nowrap shrink-0 ${
                activeModule === 'reports_archive' || activeModule === 'print_view'
                  ? 'text-white font-semibold underline underline-offset-8 decoration-2'
                  : 'hover:text-white'
              }`}
            >
              Reports & PDF
            </button>
          </nav>

          {/* Zone 3: Primary Action & Sign Out / Mobile Menu Button */}
          <div className="flex items-center gap-2 shrink-0">
            {currentUser.role !== 'Viewer' && (
              <>
                <button
                  type="button"
                  onClick={() => setMobileFormsSheetOpen(true)}
                  className="inline-flex md:hidden items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-900 bg-white hover:bg-slate-100 rounded-lg transition-colors whitespace-nowrap"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>New</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleStartNewInspection()}
                  className="hidden md:inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-900 bg-white hover:bg-slate-100 rounded-lg transition-colors whitespace-nowrap shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  New Inspection
                </button>
              </>
            )}
            <button
              type="button"
              onClick={handleSignOut}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-red-600 hover:text-white border border-slate-700 rounded-lg transition-colors whitespace-nowrap shrink-0"
              title={`Signed in as ${currentUser.uid} (${currentUser.role}) — Click to Sign Out`}
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="font-mono">{currentUser.uid}</span>
              <span>Sign Out</span>
            </button>
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors md:hidden relative"
              title="Open Navigation Menu"
              aria-label="Open Navigation Menu"
            >
              <Menu className="w-5 h-5" />
              {unreadAlertsCount > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-500"></span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Secondary Workspace Utility Bar (Admin Only — All tabs in attached photo strictly restricted to Admin) */}
      {isAdmin && (
        <div className="no-print bg-white border-b border-slate-200 px-3 sm:px-8 py-2 overflow-x-auto scrollbar-none">
          <div className="max-w-[1440px] mx-auto flex items-center justify-between gap-3 text-xs min-w-max md:min-w-0">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveModule('master_assets')}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg font-medium transition-colors whitespace-nowrap shrink-0 min-h-[36px] ${
                  activeModule === 'master_assets'
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <Database className="w-3.5 h-3.5" />
                Master Assets ({centers.length} Centers / {generators.length} Gensets)
              </button>

              <button
                type="button"
                onClick={() => {
                  setSelectedReportForPrint(reports[0] || INITIAL_REPORTS[0]);
                  setActiveModule('print_view');
                }}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg font-medium transition-colors whitespace-nowrap shrink-0 min-h-[36px] ${
                  activeModule === 'print_view'
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <Printer className="w-3.5 h-3.5" />
                Official 2-Page PDF (#002048)
              </button>

              <button
                type="button"
                onClick={() => setActiveModule('offline_sync')}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg font-medium transition-colors whitespace-nowrap shrink-0 min-h-[36px] ${
                  activeModule === 'offline_sync'
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                IndexedDB Sync ({syncQueue.length} Queued · {conflicts.length} Conflicts)
              </button>

              <button
                type="button"
                onClick={() => setActiveModule('notifications')}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg font-medium transition-colors whitespace-nowrap shrink-0 min-h-[36px] ${
                  activeModule === 'notifications'
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <Bell className="w-3.5 h-3.5" />
                Push & Email Alerts ({unreadAlertsCount} Unread)
              </button>

              <button
                type="button"
                onClick={() => setActiveModule('role_management')}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg font-medium transition-colors whitespace-nowrap shrink-0 min-h-[36px] ${
                  activeModule === 'role_management'
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <Shield className="w-3.5 h-3.5" />
                Role: {currentUser.role}
              </button>
            </div>

            {/* Right Quick Connectivity & Role Status */}
            <div className="flex items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setSimulatedOffline(!simulatedOffline)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg font-semibold transition-colors whitespace-nowrap shrink-0 min-h-[36px] ${
                  effectiveOnline
                    ? 'text-emerald-800 bg-emerald-50 hover:bg-emerald-100'
                    : 'text-amber-900 bg-amber-100 hover:bg-amber-200'
                }`}
                title="Click to toggle Online / Offline Field Mode"
              >
                {effectiveOnline ? (
                  <>
                    <Wifi className="w-3.5 h-3.5" /> Online (Synced)
                  </>
                ) : (
                  <>
                    <WifiOff className="w-3.5 h-3.5" /> Offline Mode (IndexedDB)
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Live Real-Time In-App Push Toast Notification */}
      {livePushToast && (
        <div className="no-print max-w-[1440px] w-full mx-auto px-4 sm:px-8 pt-4">
          <div className="bg-slate-900 text-white rounded-lg p-4 flex items-start justify-between gap-4 shadow-md">
            <div className="flex items-start gap-3">
              <AlertOctagon className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <div className="text-xs space-y-1">
                <div className="font-bold text-sm">{livePushToast.title}</div>
                <p className="text-slate-300">{livePushToast.message}</p>
                <div className="text-[11px] font-mono text-slate-400">
                  Dispatched to: {livePushToast.recipientsSummary}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setLivePushToast(null);
                  setActiveModule('notifications');
                }}
                className="px-2.5 py-1 text-xs font-semibold bg-white text-slate-900 rounded hover:bg-slate-100"
              >
                View Alert Center
              </button>
              <button
                type="button"
                onClick={() => setLivePushToast(null)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          MAIN WORKSPACE VIEWPORT
         ===================================================================== */}
      <main className="flex-1 max-w-[1440px] w-full mx-auto px-3 sm:px-8 py-4 sm:py-6 pb-28 md:pb-8">
        {activeModule === 'dashboard' && (
          <ExecutiveDashboardModule
            centers={centers}
            generators={generators}
            reports={reports}
            onOpenReportPdf={handleOpenReportPdf}
            onStartInspection={handleStartNewInspection}
            onOpenActivitiesTab={() => setActiveModule('activities')}
            onOpenReportsArchive={() => setActiveModule('reports_archive')}
            onOpenRoleManagement={() => setActiveModule('role_management')}
            onOpenNotificationsCenter={() => setActiveModule('notifications')}
            currentUserRole={currentUser.role}
            currentUserName={currentUser.displayName}
          />
        )}

        {activeModule === 'inspection_form' && (
          currentUser.role === 'Viewer' ? (
            <div className="max-w-2xl mx-auto my-12 bg-white rounded-xl border border-slate-200 p-8 text-center space-y-4 shadow-sm">
              <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-700 mx-auto flex items-center justify-center">
                <Shield className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Access Restricted (Viewer Account)</h3>
              <p className="text-sm text-slate-600 font-myanmar">
                Viewer အကောင့်များအတွက် Regular Inspection, 300-Hr Servicing နှင့် Breakdown forms များကို ကြည့်ရှုခွင့်/ရေးသွင်းခွင့် ပိတ်ထားပါသည်။ Field Engineer သို့မဟုတ် Administrator အကောင့်ဖြင့်သာ ဖောင်များ ရေးသွင်းနိုင်ပါသည်။
              </p>
              <p className="text-xs text-slate-500">
                Forms are restricted to Field Engineers, Chief Engineers, and System Administrators. Viewers have read-only access to Analytics, Activity Status, and Official Reports.
              </p>
              <div className="pt-2 flex justify-center gap-3">
                <button
                  type="button"
                  onClick={() => setActiveModule('dashboard')}
                  className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors"
                >
                  Return to Dashboard
                </button>
                <button
                  type="button"
                  onClick={() => setActiveModule('reports_archive')}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                >
                  View Reports &amp; PDF
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <InspectionFormModule
                centers={centers}
                generators={generators}
                initialReport={editingReport}
                initialFormCategory={activeFormCategory}
                formSessionKey={formSessionKey}
                nextReportNo={nextReportNo}
                onSaveReport={handleSaveReport}
                onCancelEdit={() => setActiveModule('reports_archive')}
                currentUserRole={currentUser.role}
              />
            </div>
          )
        )}

        {activeModule === 'activities' && (
          <ActivitiesModule
            reports={reports}
            centers={centers}
            generators={generators}
            onUpdateReportActivity={handleUpdateReportActivity}
            onOpenReportPdf={handleOpenReportPdf}
            currentUserRole={currentUser.role}
          />
        )}

        {activeModule === 'reports_archive' && (
          <ReportsArchiveModule
            reports={reports}
            centers={centers}
            generators={generators}
            onViewReportPdf={handleOpenReportPdf}
            onEditReport={handleEditReport}
            onDeleteReport={handleDeleteReport}
            onCreateNewReport={(cat) =>
              handleStartNewInspection(undefined, undefined, cat || 'REGULAR_INSPECTION')
            }
            currentUserRole={currentUser.role}
          />
        )}

        {activeModule === 'master_assets' && (
          <MasterAssetModule
            centers={centers}
            generators={generators}
            onSaveCenter={handleSaveCenter}
            onDeleteCenter={handleDeleteCenter}
            onSaveGenerator={handleSaveGenerator}
            onDeleteGenerator={handleDeleteGenerator}
            onBulkUpdateAssets={handleBulkUpdateAssets}
            onStartInspectionForAsset={(centerId, generatorId) =>
              handleStartNewInspection(centerId, generatorId)
            }
            currentUserRole={currentUser.role}
          />
        )}

        {activeModule === 'print_view' && selectedReportForPrint && (
          <OfficialReportPrintView
            report={selectedReportForPrint}
            onBack={() => setActiveModule('reports_archive')}
            onEdit={isAdmin ? (rep) => handleEditReport(rep) : undefined}
          />
        )}

        {activeModule === 'offline_sync' && (
          <OfflineSyncCenterModule
            isOnline={effectiveOnline}
            simulatedOffline={simulatedOffline}
            onToggleSimulatedOffline={setSimulatedOffline}
            reports={reports}
            syncQueue={syncQueue}
            conflicts={conflicts}
            isSyncing={isSyncing}
            lastSyncedAt={lastSyncedAt}
            conflictStrategy={conflictStrategy}
            onChangeConflictStrategy={setConflictStrategy}
            onTriggerManualSync={handleSyncQueue}
            onSimulateServerConflict={handleSimulateServerConflict}
            onResolveConflict={handleResolveConflict}
            currentUserRole={currentUser.role}
          />
        )}

        {activeModule === 'notifications' && (
          <NotificationsCenterModule
            notifications={notifications}
            configs={notificationConfigs}
            centers={centers}
            currentUserRole={currentUser.role}
            onMarkAsRead={handleMarkNotificationRead}
            onMarkAllAsRead={handleMarkAllNotificationsRead}
            onSaveConfig={handleSaveNotificationConfig}
            onTriggerScheduledReminders={handleTriggerScheduledReminders}
            onTriggerTestCriticalAlert={handleTriggerTestCriticalAlert}
          />
        )}

        {activeModule === 'role_management' && (
          <RoleManagementModule
            currentUser={currentUser}
            isFirebaseAuthenticated={isFirebaseAuthenticated}
            usersDirectory={usersDirectory}
            onSignInWithGoogle={handleSignInWithGoogle}
            onSignOut={handleSignOut}
            onSwitchActiveRole={handleSwitchActiveRole}
            onUpdateUserRole={handleUpdateUserRole}
            onUpdateUserPassword={handleUpdateUserPassword}
            onAddDirectoryUser={handleAddDirectoryUser}
            onDeleteDirectoryUser={handleDeleteDirectoryUser}
          />
        )}
      </main>

      {/* Quiet Institutional Footer */}
      <footer className="no-print bg-white border-t border-slate-200 px-4 sm:px-8 py-4 mt-8 pb-20 md:pb-4">
        <div className="max-w-[1440px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div className="flex items-center gap-3">
            <img
              src="/assets/aistudio/cp_logo_cb60fbe9.jfif"
              alt="City Properties Logo"
              className="h-7 w-auto object-contain rounded border border-slate-200 bg-white p-0.5 shrink-0"
            />
            <div>
              <span className="font-semibold text-slate-800">City Properties Co., Ltd</span>
              <span className="mx-1.5">·</span>
              <span>Generator Service, Inspection & Analytics System</span>
              <span className="hidden md:inline mx-1.5">·</span>
              <span className="hidden md:inline">No. 73-76, Waizayantar Road, Thingangyun Township, Yangon</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span>Gen SOP-002 / Version 02</span>
            <button
              type="button"
              onClick={handleResetDemoData}
              className="inline-flex items-center gap-1 text-slate-600 hover:text-slate-900 font-medium"
              title="Reset IndexedDB database to initial 31 Centers / 62 Generators seed state"
            >
              <RotateCcw className="w-3 h-3" />
              Reset Seed Data
            </button>
          </div>
        </div>
      </footer>

      {/* =====================================================================
          MOBILE BOTTOM NAVIGATION DOCK (Viewport < 768px)
         ===================================================================== */}
      <nav
        aria-label="Mobile Navigation"
        className="no-print fixed bottom-0 left-0 right-0 z-40 bg-slate-900 border-t border-slate-800 flex md:hidden items-center justify-around py-1.5 px-1 text-white shadow-2xl"
      >
        <button
          type="button"
          onClick={() => setActiveModule('dashboard')}
          className={`flex flex-col items-center justify-center gap-1 py-1 px-2.5 rounded-lg text-[10px] font-semibold transition-colors min-w-[56px] min-h-[44px] ${
            activeModule === 'dashboard'
              ? 'text-white bg-slate-800'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <BarChart3 className="w-4 h-4 shrink-0" />
          <span>Analytics</span>
        </button>

        {currentUser.role !== 'Viewer' && (
          <button
            type="button"
            onClick={() => setMobileFormsSheetOpen(true)}
            className={`flex flex-col items-center justify-center gap-1 py-1 px-2.5 rounded-lg text-[10px] font-semibold transition-colors min-w-[56px] min-h-[44px] ${
              activeModule === 'inspection_form'
                ? 'text-white bg-slate-800'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <ClipboardCheck className="w-4 h-4 shrink-0" />
            <span>Forms</span>
          </button>
        )}

        <button
          type="button"
          onClick={() => setActiveModule('activities')}
          className={`flex flex-col items-center justify-center gap-1 py-1 px-2.5 rounded-lg text-[10px] font-semibold transition-colors min-w-[56px] min-h-[44px] ${
            activeModule === 'activities'
              ? 'text-white bg-slate-800'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Clock className="w-4 h-4 shrink-0" />
          <span>Activities</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveModule('reports_archive')}
          className={`flex flex-col items-center justify-center gap-1 py-1 px-2.5 rounded-lg text-[10px] font-semibold transition-colors min-w-[56px] min-h-[44px] ${
            activeModule === 'reports_archive' || activeModule === 'print_view'
              ? 'text-white bg-slate-800'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4 shrink-0" />
          <span>Reports</span>
        </button>

        <button
          type="button"
          onClick={() => setMobileMenuOpen(true)}
          className="flex flex-col items-center justify-center gap-1 py-1 px-2.5 rounded-lg text-[10px] font-semibold text-slate-400 hover:text-slate-200 transition-colors min-w-[56px] min-h-[44px] relative"
        >
          <Menu className="w-4 h-4 shrink-0" />
          <span>More</span>
          {(unreadAlertsCount > 0 || conflicts.length > 0) && (
            <span className="absolute top-1.5 right-3.5 w-2 h-2 rounded-full bg-red-500"></span>
          )}
        </button>
      </nav>

      {/* =====================================================================
          MOBILE FORMS SELECTOR SHEET MODAL
         ===================================================================== */}
      {mobileFormsSheetOpen && (
        <div className="no-print fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl max-w-lg w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">Select Generator Form</h3>
                <p className="text-xs text-slate-500 font-myanmar">ဖြည့်သွင်းမည့် ဖောင်အမျိုးအစား ရွေးချယ်ပါ</p>
              </div>
              <button
                type="button"
                onClick={() => setMobileFormsSheetOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 min-h-[44px] min-w-[44px] flex items-center justify-center"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2.5">
              <button
                type="button"
                onClick={() => {
                  setEditingReport(null);
                  setActiveFormCategory('REGULAR_INSPECTION');
                  setFormSessionKey((prev) => prev + 1);
                  setActiveModule('inspection_form');
                  setMobileFormsSheetOpen(false);
                }}
                className="w-full text-left p-3.5 rounded-xl border border-slate-200 hover:border-slate-900 bg-slate-50 hover:bg-slate-100 transition-all flex items-start gap-3 min-h-[56px]"
              >
                <div className="w-9 h-9 rounded-lg bg-slate-900 text-white flex items-center justify-center shrink-0 mt-0.5">
                  <ClipboardCheck className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900 uppercase">Form 1: Regular Inspection</span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-200 text-slate-700">Routine</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Monthly routine check, operating parameters & 25-point inspection checklist.
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setEditingReport(null);
                  setActiveFormCategory('REGULAR_SERVICING_300HR');
                  setFormSessionKey((prev) => prev + 1);
                  setActiveModule('inspection_form');
                  setMobileFormsSheetOpen(false);
                }}
                className="w-full text-left p-3.5 rounded-xl border border-slate-200 hover:border-slate-900 bg-slate-50 hover:bg-slate-100 transition-all flex items-start gap-3 min-h-[56px]"
              >
                <div className="w-9 h-9 rounded-lg bg-amber-600 text-white flex items-center justify-center shrink-0 mt-0.5">
                  <Wrench className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900 uppercase">Form 2: 300-Hr Servicing</span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-amber-100 text-amber-900">300-Hr PM</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Filter replacement, engine oil drain, coolant refill & 10-point servicing overhaul.
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setEditingReport(null);
                  setActiveFormCategory('BREAKDOWN_REPORT');
                  setFormSessionKey((prev) => prev + 1);
                  setActiveModule('inspection_form');
                  setMobileFormsSheetOpen(false);
                }}
                className="w-full text-left p-3.5 rounded-xl border border-red-200 hover:border-red-600 bg-red-50/50 hover:bg-red-50 transition-all flex items-start gap-3 min-h-[56px]"
              >
                <div className="w-9 h-9 rounded-lg bg-red-600 text-white flex items-center justify-center shrink-0 mt-0.5">
                  <AlertOctagon className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-red-950 uppercase">Form 3: Breakdown Report</span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-red-100 text-red-800">Emergency</span>
                  </div>
                  <p className="text-xs text-red-800/80 mt-0.5">
                    Emergency callout, alarm code, root cause analysis, downtime hours & rectification.
                  </p>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          MOBILE "MORE & TOOLS" SLIDE-OVER DRAWER
         ===================================================================== */}
      {mobileMenuOpen && (
        <div className="no-print fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs">
          <div className="bg-slate-900 text-white w-full max-w-sm h-full flex flex-col shadow-2xl">
            {/* Drawer Header */}
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <img
                  src="/assets/aistudio/cp_logo_cb60fbe9.jfif"
                  alt="City Properties Logo"
                  className="h-8 w-auto object-contain rounded bg-white p-0.5 shrink-0"
                />
                <div>
                  <div className="text-xs font-mono text-emerald-400">{currentUser.role} Mode</div>
                  <div className="text-sm font-bold text-white">{currentUser.displayName || currentUser.uid}</div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 min-h-[44px] min-w-[44px] flex items-center justify-center"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Online / Offline Status Toggle on Mobile (Admin only) */}
            {isAdmin && (
              <div className="p-4 border-b border-slate-800 bg-slate-950/50">
                <button
                  type="button"
                  onClick={() => setSimulatedOffline(!simulatedOffline)}
                  className={`w-full flex items-center justify-between p-3 rounded-lg text-xs font-semibold transition-colors min-h-[44px] ${
                    effectiveOnline
                      ? 'bg-emerald-950/60 border border-emerald-700/50 text-emerald-300'
                      : 'bg-amber-950/60 border border-amber-700/50 text-amber-300'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {effectiveOnline ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
                    <span>{effectiveOnline ? 'Online (Real-Time Cloud Synced)' : 'Offline Mode (Local Storage)'}</span>
                  </div>
                  <span className="text-[10px] font-mono uppercase underline">Toggle</span>
                </button>
              </div>
            )}

            {/* Navigation & Tools List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-1.5 text-xs font-medium">
              <div className="text-[10px] uppercase tracking-wider font-bold text-slate-500 px-3 py-1">
                Navigation
              </div>

              <button
                type="button"
                onClick={() => {
                  setActiveModule('dashboard');
                  setMobileMenuOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3 py-3 rounded-lg transition-colors min-h-[44px] ${
                  activeModule === 'dashboard'
                    ? 'bg-white text-slate-900 font-bold'
                    : 'text-slate-200 hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <BarChart3 className="w-4 h-4 shrink-0" />
                  <span>Executive Analytics</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveModule('activities');
                  setMobileMenuOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3 py-3 rounded-lg transition-colors min-h-[44px] ${
                  activeModule === 'activities'
                    ? 'bg-white text-slate-900 font-bold'
                    : 'text-slate-200 hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Clock className="w-4 h-4 shrink-0" />
                  <span>Activities &amp; Action Items</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveModule('reports_archive');
                  setMobileMenuOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3 py-3 rounded-lg transition-colors min-h-[44px] ${
                  activeModule === 'reports_archive' || activeModule === 'print_view'
                    ? 'bg-white text-slate-900 font-bold'
                    : 'text-slate-200 hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <FileSpreadsheet className="w-4 h-4 shrink-0" />
                  <span>Reports &amp; PDF Archive</span>
                </div>
              </button>

              {/* Administrative tools from attached photo restricted strictly to Administrator */}
              {isAdmin && (
                <>
                  <div className="text-[10px] uppercase tracking-wider font-bold text-amber-500/80 px-3 py-1 pt-3">
                    Admin Tools (System Utility Bar)
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setActiveModule('master_assets');
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-3 rounded-lg transition-colors min-h-[44px] ${
                      activeModule === 'master_assets'
                        ? 'bg-white text-slate-900 font-bold'
                        : 'text-slate-200 hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Database className="w-4 h-4 shrink-0" />
                      <span>Master Assets Directory</span>
                    </div>
                    <span className="text-[10px] font-mono text-slate-400">{centers.length} Centers</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setActiveModule('notifications');
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-3 rounded-lg transition-colors min-h-[44px] ${
                      activeModule === 'notifications'
                        ? 'bg-white text-slate-900 font-bold'
                        : 'text-slate-200 hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Bell className="w-4 h-4 shrink-0" />
                      <span>Push & Email Alerts</span>
                    </div>
                    {unreadAlertsCount > 0 && (
                      <span className="px-1.5 py-0.5 text-[10px] font-mono font-bold bg-red-600 text-white rounded-full">
                        {unreadAlertsCount}
                      </span>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setActiveModule('offline_sync');
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-3 rounded-lg transition-colors min-h-[44px] ${
                      activeModule === 'offline_sync'
                        ? 'bg-white text-slate-900 font-bold'
                        : 'text-slate-200 hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <RefreshCw className={`w-4 h-4 shrink-0 ${isSyncing ? 'animate-spin' : ''}`} />
                      <span>Cloud & IndexedDB Sync</span>
                    </div>
                    {syncQueue.length > 0 && (
                      <span className="px-1.5 py-0.5 text-[10px] font-mono font-bold bg-amber-500 text-slate-950 rounded">
                        {syncQueue.length} queued
                      </span>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedReportForPrint(reports[0] || INITIAL_REPORTS[0]);
                      setActiveModule('print_view');
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-3 rounded-lg transition-colors min-h-[44px] ${
                      activeModule === 'print_view'
                        ? 'bg-white text-slate-900 font-bold'
                        : 'text-slate-200 hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Printer className="w-4 h-4 shrink-0" />
                      <span>Official 2-Page Print View</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-500" />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setActiveModule('role_management');
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-3 rounded-lg transition-colors min-h-[44px] ${
                      activeModule === 'role_management'
                        ? 'bg-white text-slate-900 font-bold'
                        : 'text-slate-200 hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Shield className="w-4 h-4 shrink-0" />
                      <span>User & Role Management</span>
                    </div>
                    <span className="text-[10px] font-mono text-emerald-400">{currentUser.role}</span>
                  </button>
                </>
              )}
            </div>

            {/* Drawer Footer Actions */}
            <div className="p-4 border-t border-slate-800 space-y-2">
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  handleSignOut();
                }}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors min-h-[44px]"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out ({currentUser.uid})</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
