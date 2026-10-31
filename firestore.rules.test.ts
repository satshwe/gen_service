/**
 * Security Rules Verification Suite for City Properties Generator System
 * Verifies that all 12 "Dirty Dozen" adversarial payloads are rejected with PERMISSION_DENIED.
 */

export interface DirtyDozenTestCase {
  id: number;
  name: string;
  collectionPath: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  auth: {
    uid: string;
    email: string;
    email_verified: boolean;
  } | null;
  payload?: Record<string, unknown>;
  expectedResult: 'PERMISSION_DENIED';
}

export const DIRTY_DOZEN_TESTS: DirtyDozenTestCase[] = [
  {
    id: 1,
    name: 'Self-Privilege Escalation on User Creation',
    collectionPath: '/users/eng_user_1',
    operation: 'create',
    auth: { uid: 'eng_user_1', email: 'engineer@cityproperties.com.mm', email_verified: true },
    payload: {
      uid: 'eng_user_1',
      email: 'engineer@cityproperties.com.mm',
      displayName: 'Malicious Engineer',
      role: 'Administrator',
      department: 'Engineering',
      updatedAt: 'SERVER_TIMESTAMP',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 2,
    name: 'Role Tampering on User Update',
    collectionPath: '/users/eng_user_1',
    operation: 'update',
    auth: { uid: 'eng_user_1', email: 'engineer@cityproperties.com.mm', email_verified: true },
    payload: {
      role: 'Administrator',
      updatedAt: 'SERVER_TIMESTAMP',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 3,
    name: 'PII Lateral Read Across User Profiles',
    collectionPath: '/users/other_user_99',
    operation: 'get',
    auth: { uid: 'eng_user_1', email: 'engineer@cityproperties.com.mm', email_verified: true },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 4,
    name: 'Shadow / Ghost Field Injection on Report Creation',
    collectionPath: '/reports/REP_002050',
    operation: 'create',
    auth: { uid: 'eng_user_1', email: 'engineer@cityproperties.com.mm', email_verified: true },
    payload: {
      id: 'REP_002050',
      reportNo: '002050',
      isVerifiedByHQ: true, // Ghost field
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 5,
    name: 'Identity Spoofing on Report Creation',
    collectionPath: '/reports/REP_002051',
    operation: 'create',
    auth: { uid: 'eng_user_1', email: 'engineer@cityproperties.com.mm', email_verified: true },
    payload: {
      id: 'REP_002051',
      authorUid: 'different_user_uid',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 6,
    name: 'Viewer Role Attempting Report Write',
    collectionPath: '/reports/REP_002052',
    operation: 'create',
    auth: { uid: 'viewer_user_1', email: 'viewer@cityproperties.com.mm', email_verified: true },
    payload: {
      id: 'REP_002052',
      authorUid: 'viewer_user_1',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 7,
    name: 'Path ID Poisoning with Illegal Characters',
    collectionPath: '/reports/INVALID$ID#WITH!SPACES',
    operation: 'create',
    auth: { uid: 'eng_user_1', email: 'engineer@cityproperties.com.mm', email_verified: true },
    payload: {
      id: 'INVALID$ID#WITH!SPACES',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 8,
    name: 'Denial-of-Wallet Oversized String in Notification',
    collectionPath: '/notifications/NOTIF_999',
    operation: 'create',
    auth: { uid: 'eng_user_1', email: 'engineer@cityproperties.com.mm', email_verified: true },
    payload: {
      id: 'NOTIF_999',
      message: 'A'.repeat(2500),
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 9,
    name: 'Unverified Email Admin Spoofing',
    collectionPath: '/notificationConfigs/CFG_CRITICAL',
    operation: 'update',
    auth: { uid: 'spoof_admin', email: 'satshwe36@gmail.com', email_verified: false },
    payload: {
      enabled: false,
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 10,
    name: 'Client Timestamp Forgery',
    collectionPath: '/reports/REP_002055',
    operation: 'create',
    auth: { uid: 'eng_user_1', email: 'engineer@cityproperties.com.mm', email_verified: true },
    payload: {
      id: 'REP_002055',
      updatedAt: '2099-01-01T00:00:00Z',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 11,
    name: 'Unauthorized Notification Config Update by Field Engineer',
    collectionPath: '/notificationConfigs/CFG_CRITICAL',
    operation: 'update',
    auth: { uid: 'eng_user_1', email: 'engineer@cityproperties.com.mm', email_verified: true },
    payload: {
      recipientsCsv: 'attacker@evil.com',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 12,
    name: 'Value Poisoning on Notification Read Toggle',
    collectionPath: '/notifications/NOTIF_001',
    operation: 'update',
    auth: { uid: 'eng_user_1', email: 'engineer@cityproperties.com.mm', email_verified: true },
    payload: {
      read: 'yes_string_instead_of_boolean',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
];
