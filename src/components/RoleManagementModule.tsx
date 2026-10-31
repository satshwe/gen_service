import React, { useState } from 'react';
import {
  Shield,
  Award,
  LogIn,
  LogOut,
  UserPlus,
  CheckCircle2,
  Lock,
  Users,
  Trash2,
  RefreshCw,
  Database,
  KeyRound,
  AlertTriangle,
} from 'lucide-react';
import { UserProfile, UserRole } from '../types';

interface RoleManagementModuleProps {
  currentUser: UserProfile;
  isFirebaseAuthenticated: boolean;
  usersDirectory: UserProfile[];
  onSignInWithGoogle: () => Promise<void>;
  onSignOut: () => Promise<void>;
  onSwitchActiveRole?: (role: UserRole) => void;
  onUpdateUserRole: (uid: string, newRole: UserRole) => Promise<void>;
  onUpdateUserPassword: (uid: string, newPassword: string) => Promise<void>;
  onAddDirectoryUser: (newUser: UserProfile) => Promise<void>;
  onDeleteDirectoryUser: (uid: string) => Promise<void>;
}

const ALL_ROLES: UserRole[] = [
  'Administrator',
  'Chief Engineer',
  'Field Engineer',
  'Viewer',
];

export const RoleManagementModule: React.FC<RoleManagementModuleProps> = ({
  currentUser,
  isFirebaseAuthenticated,
  usersDirectory,
  onSignInWithGoogle,
  onSignOut,
  onUpdateUserRole,
  onUpdateUserPassword,
  onAddDirectoryUser,
  onDeleteDirectoryUser,
}) => {
  const isAdmin = currentUser.role === 'Administrator';

  // Add User Form State - Passwords start strictly empty
  const [newUid, setNewUid] = useState(() => `USR_ENG_0${usersDirectory.length + 1}`);
  const [newPassword, setNewPassword] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newDept, setNewDept] = useState('Generator Service & Inspection Team');
  const [newRole, setNewRole] = useState<UserRole>('Field Engineer');
  const [isSavingUser, setIsSavingUser] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Secure Password Reset for Admin
  const [editingPasswordUid, setEditingPasswordUid] = useState<string | null>(null);
  const [draftPasswordValue, setDraftPasswordValue] = useState<string>('');
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  const generateNextUid = (role: UserRole) => {
    const prefix =
      role === 'Administrator'
        ? 'USR_ADMIN_'
        : role === 'Chief Engineer'
        ? 'USR_CHIEF_'
        : role === 'Field Engineer'
        ? 'USR_ENG_'
        : 'USR_VIEW_';
    const nextNum = String(usersDirectory.length + 1).padStart(2, '0');
    return `${prefix}${nextNum}`;
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    const cleanUid = newUid
      .trim()
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .slice(0, 64);
    const cleanPass = newPassword.trim();

    if (!cleanUid || cleanPass.length < 4 || !newName.trim() || !newEmail.trim()) {
      setToastMsg(
        'User UID, Password (အနည်းဆုံး ၄ လုံး), Full Name နှင့် Email အားလုံး ပြည့်စုံစွာ ဖြည့်သွင်းပေးပါ။'
      );
      return;
    }

    setIsSavingUser(true);
    try {
      await onAddDirectoryUser({
        uid: cleanUid,
        password: cleanPass,
        email: newEmail.trim(),
        displayName: newName.trim(),
        department: newDept.trim() || 'Engineering & Facilities',
        role: newRole,
        updatedAt: new Date().toISOString(),
      });
      setToastMsg(
        `User ${cleanUid} (${newRole}) ကို Firebase Firestore သို့ လုံခြုံစွာ သိမ်းဆည်းပြီးပါပြီ။`
      );
      setNewUid(generateNextUid('Field Engineer'));
      setNewPassword('');
      setNewName('');
      setNewEmail('');
      setTimeout(() => setToastMsg(null), 4000);
    } catch {
      setToastMsg('Failed to save user to Firebase.');
    } finally {
      setIsSavingUser(false);
    }
  };

  const handleSaveEditedPassword = async (uid: string) => {
    if (!isAdmin) return;
    const trimmed = draftPasswordValue.trim();
    if (trimmed.length < 4) {
      setToastMsg('Password must be at least 4 characters long.');
      return;
    }
    setIsUpdatingPassword(true);
    try {
      await onUpdateUserPassword(uid, trimmed);
      setEditingPasswordUid(null);
      setDraftPasswordValue('');
      setToastMsg(`User ${uid} ၏ Password အား Firebase Firestore တွင် အောင်မြင်စွာ ပြင်ဆင်ပြီးပါပြီ။`);
      setTimeout(() => setToastMsg(null), 4000);
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Authentication & Active Role Banner */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mb-1">
            <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
              <Database className="w-3.5 h-3.5" />
              Firebase Firestore Security Gate
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-mono font-bold text-slate-800">UID: {currentUser.uid}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono">{currentUser.email}</span>
          </div>
          <h2 className="text-lg font-bold text-slate-900">
            User Role Management & Security Credentials (4-Tier RBAC)
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Active Role Indicator Badge (Strictly display-only, no role hijacking) */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-semibold shadow-xs">
            <Shield className="w-3.5 h-3.5 text-emerald-400" />
            <span>Active Role: {currentUser.role}</span>
          </div>

          {!isFirebaseAuthenticated && (
            <button
              type="button"
              onClick={onSignInWithGoogle}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <LogIn className="w-3.5 h-3.5" />
              Link Google OAuth
            </button>
          )}

          <button
            type="button"
            onClick={onSignOut}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign Out ({currentUser.uid})
          </button>
        </div>
      </div>

      {toastMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-950 px-4 py-3 rounded-lg text-xs font-medium flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-myanmar">{toastMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setToastMsg(null)}
            className="text-emerald-700 hover:text-emerald-950 font-semibold shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Non-Admin Security Notice */}
      {!isAdmin && (
        <div className="bg-amber-50 border border-amber-200 text-amber-950 p-5 rounded-lg text-xs space-y-2">
          <div className="flex items-center gap-2 font-bold text-sm text-amber-900">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>လုံခြုံရေးဆိုင်ရာ ကန့်သတ်ချက် (Administrator Security Notice)</span>
          </div>
          <p className="font-myanmar leading-relaxed text-amber-800">
            အခြား Authorized User များ၏ အချက်အလက်များ၊ UID နှင့် Password များကို စီမံခန့်ခွဲခွင့်အား <strong>Administrator</strong> သာ လုပ်ဆောင်ခွင့်ရှိပါသည်။
            လုံခြုံရေးအရ အခြား User များ၏ အကောင့်နှင့် လျှို့ဝှက်နံပါတ်များကို ကာကွယ်ထားပါသည်။
          </p>
          <div className="pt-2 border-t border-amber-200/70 flex flex-wrap items-center gap-4 text-[11px] text-amber-900 font-mono">
            <span>Your Signed-In UID: <strong>{currentUser.uid}</strong></span>
            <span>Assigned Role: <strong>{currentUser.role}</strong></span>
            <span>Department: <strong>{currentUser.department}</strong></span>
          </div>
        </div>
      )}

      {/* Admin-Only: Add Authorized User Form */}
      {isAdmin && (
        <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4 pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-emerald-600" />
                Add Authorized User to Firebase (User UID & Password သတ်မှတ်ပြီး သိမ်းဆည်းရန်)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5 font-myanmar">
                အကောင့်အသစ်အား ဤနေရာမှ ဖြည့်သွင်းပါက <strong>User UID</strong> နှင့် <strong>Password</strong> ကို Firebase Firestore (<code className="font-mono text-slate-700">/users/&#123;uid&#125;</code>) ထဲသို့ တိုက်ရိုက်သိမ်းဆည်းပေးမည်ဖြစ်ပြီး Login Page တွင် ချက်ချင်း ဝင်ရောက်နိုင်မည် ဖြစ်ပါသည်။
              </p>
            </div>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-semibold shrink-0">
              <Shield className="w-3.5 h-3.5" />
              Administrator Authorized
            </span>
          </div>

          <form onSubmit={handleCreateUser} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* 1. User UID */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-700">
                    1. User UID (Login ID) <span className="text-red-600">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setNewUid(generateNextUid(newRole))}
                    className="text-[11px] font-semibold text-emerald-700 hover:underline inline-flex items-center gap-1"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Auto-Generate
                  </button>
                </div>
                <input
                  type="text"
                  required
                  value={newUid}
                  onChange={(e) => setNewUid(e.target.value.toUpperCase())}
                  placeholder="e.g., USR_ENG_03"
                  className="w-full px-3 py-2 text-xs font-mono font-bold uppercase border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900"
                />
              </div>

              {/* 2. Password (Empty by default for security) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  2. Password (လျှို့ဝှက်နံပါတ်) <span className="text-red-600">*</span>
                </label>
                <div className="relative">
                  <input
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter secure password"
                    className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900"
                  />
                </div>
              </div>

              {/* 3. RBAC Role */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  3. Assign RBAC Role <span className="text-red-600">*</span>
                </label>
                <select
                  value={newRole}
                  onChange={(e) => {
                    const r = e.target.value as UserRole;
                    setNewRole(r);
                    setNewUid(generateNextUid(r));
                  }}
                  className="w-full px-3 py-2 text-xs font-semibold border border-slate-300 rounded-lg bg-white"
                >
                  {ALL_ROLES.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
              </div>

              {/* 4. Full Name */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  4. Full Name (အမည်) <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g., U Aung Ko Oo"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                />
              </div>

              {/* 5. Email Address */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  5. Email Address <span className="text-red-600">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="aungko@cityproperties.com.mm"
                  className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg"
                />
              </div>

              {/* 6. Department */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  6. Department (ဌာန)
                </label>
                <input
                  type="text"
                  value={newDept}
                  onChange={(e) => setNewDept(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                />
              </div>
            </div>

            <div className="flex items-center justify-end pt-2">
              <button
                type="submit"
                disabled={isSavingUser}
                className="inline-flex items-center gap-2 py-2.5 px-5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 rounded-lg transition-colors shadow-xs"
              >
                <UserPlus className="w-4 h-4" />
                {isSavingUser
                  ? 'Saving to Firebase Firestore...'
                  : 'Add Authorized User to Firebase'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Admin-Only: Authorized Users Directory Table (Masked Passwords) */}
      {isAdmin && (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-xs">
          <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 bg-slate-50">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Database className="w-4 h-4 text-emerald-600" />
                Authorized Users Directory ({usersDirectory.length} Accounts in Firebase)
              </h3>
              <p className="text-xs text-slate-500 font-myanmar mt-0.5">
                Firebase Firestore တွင် စာရင်းသွင်းထားသော အကောင့်များဖြစ်ပြီး လုံခြုံရေးအရ Password များကို Mask ပြုလုပ်ထားပါသည်။ လိုအပ်ပါက Reset PW ခလုတ်ဖြင့် အသစ်ပြောင်းလဲနိုင်ပါသည်။
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-100 border-b border-slate-200 text-slate-700 font-semibold">
                <tr>
                  <th className="px-4 py-3 text-left">User UID</th>
                  <th className="px-4 py-3 text-left">Full Name</th>
                  <th className="px-4 py-3 text-left">Email Address</th>
                  <th className="px-4 py-3 text-left">Department</th>
                  <th className="px-4 py-3 text-left">Assigned Role</th>
                  <th className="px-4 py-3 text-left">Password Security</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {usersDirectory.map((u) => {
                  const isEditingPass = editingPasswordUid === u.uid;
                  return (
                    <tr key={u.uid} className="hover:bg-slate-50/80">
                      <td className="px-4 py-3 font-mono font-bold text-slate-900">
                        <div className="flex items-center gap-1.5">
                          <span>{u.uid}</span>
                          <span className="px-1.5 py-0.5 text-[10px] font-sans font-semibold rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Firebase
                          </span>
                        </div>
                      </td>

                      <td className="px-4 py-3 font-semibold text-slate-900">
                        {u.displayName}
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-700">{u.email}</td>
                      <td className="px-4 py-3 text-slate-600">{u.department}</td>
                      <td className="px-4 py-3">
                        <select
                          value={u.role}
                          onChange={async (e) => {
                            const updatedRole = e.target.value as UserRole;
                            await onUpdateUserRole(u.uid, updatedRole);
                            setToastMsg(
                              `Updated ${u.displayName} (${u.uid}) role to ${updatedRole} in Firebase.`
                            );
                            setTimeout(() => setToastMsg(null), 3500);
                          }}
                          className="px-2.5 py-1 text-xs font-semibold border border-slate-300 rounded bg-white"
                        >
                          {ALL_ROLES.map((role) => (
                            <option key={role} value={role}>
                              {role}
                            </option>
                          ))}
                        </select>
                      </td>

                      <td className="px-4 py-3 font-mono">
                        {isEditingPass ? (
                          <div className="flex items-center gap-1.5">
                            <input
                              type="password"
                              value={draftPasswordValue}
                              onChange={(e) => setDraftPasswordValue(e.target.value)}
                              placeholder="New password"
                              autoFocus
                              className="w-32 px-2 py-1 text-xs font-mono border border-slate-300 rounded focus:ring-1 focus:ring-slate-900"
                            />
                            <button
                              type="button"
                              disabled={isUpdatingPassword}
                              onClick={() => handleSaveEditedPassword(u.uid)}
                              className="px-2 py-1 text-[11px] font-semibold bg-slate-900 text-white rounded hover:bg-slate-800"
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingPasswordUid(null);
                                setDraftPasswordValue('');
                              }}
                              className="px-1.5 py-1 text-[11px] text-slate-500 hover:text-slate-800"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-slate-400 font-bold tracking-widest select-none">
                              ••••••••
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingPasswordUid(u.uid);
                                setDraftPasswordValue('');
                              }}
                              className="text-[11px] font-semibold text-emerald-700 hover:underline inline-flex items-center gap-1"
                              title="Reset Password for this User"
                            >
                              <KeyRound className="w-3 h-3" />
                              Reset PW
                            </button>
                          </div>
                        )}
                      </td>

                      <td className="px-4 py-3 text-right">
                        {u.uid !== 'USR_ADMIN_01' ? (
                          <button
                            type="button"
                            onClick={async () => {
                              if (confirm(`User ${u.uid} (${u.displayName}) အား Firebase စာရင်းမှ ဖျက်ပစ်ရန် သေချာပါသလား?`)) {
                                await onDeleteDirectoryUser(u.uid);
                                setToastMsg(
                                  `Removed user ${u.uid} from Firebase Authorized Users.`
                                );
                                setTimeout(() => setToastMsg(null), 3500);
                              }
                            }}
                            className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-red-700 hover:bg-red-50 rounded"
                            title="Delete User from Firebase"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Delete
                          </button>
                        ) : (
                          <span className="text-[11px] text-slate-400 font-medium">Primary Admin</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4-Role Capabilities & Security Matrix (Informational only, non-clickable) */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* 1. Administrator */}
        <div
          className={`bg-white border rounded-lg p-5 transition-all ${
            currentUser.role === 'Administrator'
              ? 'border-slate-900 ring-2 ring-slate-900 bg-slate-50/40'
              : 'border-slate-200'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
              <Shield className="w-4 h-4 text-slate-900" />
              Administrator
            </h3>
            {currentUser.role === 'Administrator' && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-900 text-white">
                YOUR ROLE
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mb-3">
            Full system governance across all 31+ Centers, 62+ Generators, inspections, alerts, and Firebase user accounts.
          </p>
          <ul className="space-y-1.5 text-xs text-slate-700">
            <li className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              Add Authorized Users & Manage Passwords in Firebase
            </li>
            <li className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              Create, Edit & Delete Inspection & 300-Hr Reports
            </li>
            <li className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              Configure Alert Triggers & Email Recipient Lists
            </li>
          </ul>
        </div>

        {/* 2. Chief Engineer */}
        <div
          className={`bg-white border rounded-lg p-5 transition-all ${
            currentUser.role === 'Chief Engineer'
              ? 'border-slate-900 ring-2 ring-slate-900 bg-slate-50/40'
              : 'border-slate-200'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
              <Award className="w-4 h-4 text-amber-700" />
              Chief Engineer
            </h3>
            {currentUser.role === 'Chief Engineer' && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-900 text-white">
                YOUR ROLE
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mb-3">
            Senior engineering oversight for fleet maintenance, 300-Hr servicing schedules, asset registry, and alert rules.
          </p>
          <ul className="space-y-1.5 text-xs text-slate-700">
            <li className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              Manage Master Centers & 62+ Generator Assets
            </li>
            <li className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              Create New Service Reports & Complete Activities
            </li>
            <li className="flex items-center gap-1.5 text-slate-400">
              <Lock className="w-3.5 h-3.5 shrink-0" />
              Cannot Modify User Accounts or Passwords
            </li>
          </ul>
        </div>

        {/* 3. Field Engineer */}
        <div
          className={`bg-white border rounded-lg p-5 transition-all ${
            currentUser.role === 'Field Engineer'
              ? 'border-slate-900 ring-2 ring-slate-900 bg-slate-50/40'
              : 'border-slate-200'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
              <Users className="w-4 h-4 text-slate-700" />
              Field Engineer
            </h3>
            {currentUser.role === 'Field Engineer' && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-900 text-white">
                YOUR ROLE
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mb-3">
            Operational access for site engineers performing routine inspections and 300-Hr servicing online or offline.
          </p>
          <ul className="space-y-1.5 text-xs text-slate-700">
            <li className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              Perform Regular Inspections, 300-Hr & Breakdown Forms
            </li>
            <li className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              Store Reports Offline in IndexedDB & Sync Queue
            </li>
            <li className="flex items-center gap-1.5 text-slate-400">
              <Lock className="w-3.5 h-3.5 shrink-0" />
              Cannot Edit or Delete Saved Reports (Admin Only)
            </li>
          </ul>
        </div>

        {/* 4. Viewer */}
        <div
          className={`bg-white border rounded-lg p-5 transition-all ${
            currentUser.role === 'Viewer'
              ? 'border-slate-900 ring-2 ring-slate-900 bg-slate-50/40'
              : 'border-slate-200'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
              <Lock className="w-4 h-4 text-slate-600" />
              Viewer (Read-Only)
            </h3>
            {currentUser.role === 'Viewer' && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-900 text-white">
                YOUR ROLE
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mb-3">
            Read-only audit and executive visibility for Center Managers and external auditors.
          </p>
          <ul className="space-y-1.5 text-xs text-slate-700">
            <li className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              View Executive Analytics & 300-Hr Calendar
            </li>
            <li className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              View & Print Official 2-Page Service PDFs
            </li>
            <li className="flex items-center gap-1.5 text-slate-400">
              <Lock className="w-3.5 h-3.5 shrink-0" />
              Strictly Blocked from Creating or Editing Records
            </li>
          </ul>
        </div>
      </div>

      {/* 4-Role Permission Matrix Table */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-xs">
        <div className="p-4 border-b border-slate-200 bg-slate-50">
          <h3 className="text-sm font-bold text-slate-900">
            4-Tier Role Permission & Access Control Matrix
          </h3>
          <p className="text-xs text-slate-500">
            Overview of security privileges enforced across Administrator, Chief Engineer, Field Engineer, and Viewer roles.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-100 border-b border-slate-200 text-slate-700 font-semibold">
              <tr>
                <th className="px-4 py-2.5 text-left">System Module / Capability</th>
                <th className="px-4 py-2.5 text-center">Administrator</th>
                <th className="px-4 py-2.5 text-center">Chief Engineer</th>
                <th className="px-4 py-2.5 text-center">Field Engineer</th>
                <th className="px-4 py-2.5 text-center">Viewer</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-slate-700">
              <tr>
                <td className="px-4 py-2.5 font-medium">View Executive Dashboard, 300-Hr Calendar & Export Excel/PDF</td>
                <td className="px-4 py-2.5 text-center font-semibold text-emerald-700">Allowed</td>
                <td className="px-4 py-2.5 text-center font-semibold text-emerald-700">Allowed</td>
                <td className="px-4 py-2.5 text-center font-semibold text-emerald-700">Allowed</td>
                <td className="px-4 py-2.5 text-center font-semibold text-emerald-700">Allowed</td>
              </tr>
              <tr>
                <td className="px-4 py-2.5 font-medium">Create New Regular Inspection, 300-Hr Servicing & Breakdown Forms</td>
                <td className="px-4 py-2.5 text-center font-semibold text-emerald-700">Allowed</td>
                <td className="px-4 py-2.5 text-center font-semibold text-emerald-700">Allowed</td>
                <td className="px-4 py-2.5 text-center font-semibold text-emerald-700">Allowed</td>
                <td className="px-4 py-2.5 text-center text-slate-400">Read-Only</td>
              </tr>
              <tr>
                <td className="px-4 py-2.5 font-medium">Offline IndexedDB Queue Sync & Conflict Resolution</td>
                <td className="px-4 py-2.5 text-center font-semibold text-emerald-700">Allowed</td>
                <td className="px-4 py-2.5 text-center font-semibold text-emerald-700">Allowed</td>
                <td className="px-4 py-2.5 text-center font-semibold text-emerald-700">Allowed</td>
                <td className="px-4 py-2.5 text-center text-slate-400">Blocked</td>
              </tr>
              <tr>
                <td className="px-4 py-2.5 font-medium">Add, Edit, Delete & Bulk Import Master Centers & Generators</td>
                <td className="px-4 py-2.5 text-center font-semibold text-emerald-700">Allowed</td>
                <td className="px-4 py-2.5 text-center font-semibold text-emerald-700">Allowed</td>
                <td className="px-4 py-2.5 text-center text-slate-400">Blocked</td>
                <td className="px-4 py-2.5 text-center text-slate-400">Blocked</td>
              </tr>
              <tr>
                <td className="px-4 py-2.5 font-medium">Edit or Delete Saved Reports (Report Archive & Print View)</td>
                <td className="px-4 py-2.5 text-center font-semibold text-emerald-700">Allowed</td>
                <td className="px-4 py-2.5 text-center text-slate-400">Admin Only</td>
                <td className="px-4 py-2.5 text-center text-slate-400">Admin Only</td>
                <td className="px-4 py-2.5 text-center text-slate-400">Admin Only</td>
              </tr>
              <tr>
                <td className="px-4 py-2.5 font-medium">Provision Users (UID & Password in Firebase) & Manage Passwords</td>
                <td className="px-4 py-2.5 text-center font-semibold text-emerald-700">Allowed</td>
                <td className="px-4 py-2.5 text-center text-slate-400">Admin Only</td>
                <td className="px-4 py-2.5 text-center text-slate-400">Admin Only</td>
                <td className="px-4 py-2.5 text-center text-slate-400">Admin Only</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
