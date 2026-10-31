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
  Eye,
  EyeOff,
  KeyRound,
  Trash2,
  RefreshCw,
  Database,
} from 'lucide-react';
import { UserProfile, UserRole } from '../types';

interface RoleManagementModuleProps {
  currentUser: UserProfile;
  isFirebaseAuthenticated: boolean;
  usersDirectory: UserProfile[];
  onSignInWithGoogle: () => Promise<void>;
  onSignOut: () => Promise<void>;
  onSwitchActiveRole: (role: UserRole) => void;
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
  onSwitchActiveRole,
  onUpdateUserRole,
  onUpdateUserPassword,
  onAddDirectoryUser,
  onDeleteDirectoryUser,
}) => {
  const [newUid, setNewUid] = useState(() => `USR_ENG_0${usersDirectory.length + 1}`);
  const [newPassword, setNewPassword] = useState('CpGen@2026');
  const [showNewPassword, setShowNewPassword] = useState(true);
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newDept, setNewDept] = useState('Generator Service & Inspection Team');
  const [newRole, setNewRole] = useState<UserRole>('Field Engineer');
  const [isSavingUser, setIsSavingUser] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Per-row password visibility & inline editing
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});
  const [editingPasswordUid, setEditingPasswordUid] = useState<string | null>(null);
  const [draftPasswordValue, setDraftPasswordValue] = useState<string>('');

  const isAdmin = currentUser.role === 'Administrator';

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
        'Please fill User UID, Password (min 4 chars), Full Name, and Email Address.'
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
        department: newDept.trim() || 'Engineering',
        role: newRole,
        updatedAt: new Date().toISOString(),
      });
      setToastMsg(
        `Saved Authorized User "${cleanUid}" (Password: ${cleanPass}) to Firebase Firestore! You can now log in with this UID & Password on the Login Page.`
      );
      setNewName('');
      setNewEmail('');
      setNewUid(`USR_ENG_0${usersDirectory.length + 2}`);
      setTimeout(() => setToastMsg(null), 6000);
    } finally {
      setIsSavingUser(false);
    }
  };

  const toggleRowPasswordVisibility = (uid: string) => {
    setVisiblePasswords((prev) => ({ ...prev, [uid]: !prev[uid] }));
  };

  const handleSaveEditedPassword = async (uid: string) => {
    if (!isAdmin || draftPasswordValue.trim().length < 4) return;
    await onUpdateUserPassword(uid, draftPasswordValue.trim());
    setEditingPasswordUid(null);
    setDraftPasswordValue('');
    setToastMsg(`Updated password for ${uid} in Firebase Firestore.`);
    setTimeout(() => setToastMsg(null), 4000);
  };

  return (
    <div className="space-y-6">
      {/* Top Authentication & Active Role Banner */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mb-1">
            <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
              <Database className="w-3.5 h-3.5" />
              Firebase Firestore UID & Password Security
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-mono font-bold text-slate-800">UID: {currentUser.uid}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono">{currentUser.email}</span>
          </div>
          <h2 className="text-lg font-bold text-slate-900">
            User Role Management & Firebase Login Credentials (4-Tier RBAC)
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Interactive 4-Role Switcher for Testing & Admin Override */}
          <div className="inline-flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg">
            {ALL_ROLES.map((role) => (
              <button
                key={role}
                type="button"
                onClick={() => onSwitchActiveRole(role)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  currentUser.role === role
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {role}
              </button>
            ))}
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
            Sign Out to Login Page ({currentUser.uid})
          </button>
        </div>
      </div>

      {toastMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-950 px-4 py-3 rounded-lg text-xs font-medium flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{toastMsg}</span>
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

      {/* Add Authorized User Form (Saves User UID & Password to Firebase Firestore) */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4 pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-emerald-600" />
              Add Authorized User to Firebase (User UID & Password သတ်မှတ်ပြီး Firebase သို့ သိမ်းဆည်းရန်)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              When an Administrator adds a user here, their <strong>User UID</strong>,{' '}
              <strong>Password</strong>, and <strong>RBAC Role</strong> are stored directly in Firebase Firestore (<code className="font-mono text-slate-700">/users/&#123;uid&#125;</code>) for Login Page verification.
            </p>
          </div>
          {!isAdmin && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-amber-50 text-amber-800 border border-amber-200 text-xs font-semibold shrink-0">
              <Lock className="w-3.5 h-3.5" />
              Administrator Role Required
            </span>
          )}
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
                  disabled={!isAdmin}
                  onClick={() => setNewUid(generateNextUid(newRole))}
                  className="text-[11px] font-semibold text-emerald-700 hover:underline inline-flex items-center gap-1 disabled:opacity-50"
                >
                  <RefreshCw className="w-3 h-3" />
                  Auto-Generate UID
                </button>
              </div>
              <input
                type="text"
                required
                disabled={!isAdmin}
                value={newUid}
                onChange={(e) => setNewUid(e.target.value)}
                placeholder="e.g., USR_ENG_03 or ENG_AUNGKO"
                className="w-full px-3 py-2 text-xs font-mono font-bold border border-slate-300 rounded-lg bg-slate-50 focus:bg-white disabled:bg-slate-100"
              />
            </div>

            {/* 2. Password */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-slate-700">
                  2. Login Password (min 4 chars) <span className="text-red-600">*</span>
                </label>
                <button
                  type="button"
                  disabled={!isAdmin}
                  onClick={() =>
                    setNewPassword(
                      `Cp@${Math.floor(1000 + Math.random() * 9000)}`
                    )
                  }
                  className="text-[11px] font-semibold text-emerald-700 hover:underline inline-flex items-center gap-1 disabled:opacity-50"
                >
                  <KeyRound className="w-3 h-3" />
                  Generate Password
                </button>
              </div>
              <div className="relative">
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  required
                  minLength={4}
                  disabled={!isAdmin}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter login password"
                  className="w-full pl-3 pr-9 py-2 text-xs font-mono border border-slate-300 rounded-lg bg-slate-50 focus:bg-white disabled:bg-slate-100"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-700"
                >
                  {showNewPassword ? (
                    <EyeOff className="w-3.5 h-3.5" />
                  ) : (
                    <Eye className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>

            {/* 3. Assigned Role */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                3. Assigned RBAC Role <span className="text-red-600">*</span>
              </label>
              <select
                disabled={!isAdmin}
                value={newRole}
                onChange={(e) => {
                  const r = e.target.value as UserRole;
                  setNewRole(r);
                  if (newUid.startsWith('USR_')) {
                    setNewUid(generateNextUid(r));
                  }
                }}
                className="w-full px-3 py-2 text-xs font-semibold border border-slate-300 rounded-lg bg-white disabled:bg-slate-100"
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
                disabled={!isAdmin}
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g., U Aung Ko Oo"
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg disabled:bg-slate-100"
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
                disabled={!isAdmin}
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="aungko@cityproperties.com.mm"
                className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg disabled:bg-slate-100"
              />
            </div>

            {/* 6. Department */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                6. Department (ဌာန)
              </label>
              <input
                type="text"
                disabled={!isAdmin}
                value={newDept}
                onChange={(e) => setNewDept(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg disabled:bg-slate-100"
              />
            </div>
          </div>

          <div className="flex items-center justify-end pt-2">
            <button
              type="submit"
              disabled={!isAdmin || isSavingUser}
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

      {/* Authorized Users & Firebase Credentials Directory Table */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Database className="w-4 h-4 text-emerald-600" />
              Firebase Authorized Users & Login Credentials Directory ({usersDirectory.length} Users)
            </h3>
            <p className="text-xs text-slate-500">
              All User UIDs and Passwords listed below are stored in Firebase Firestore (<code className="font-mono text-slate-700">/users</code>) and can sign in on the Login Page.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
              <tr>
                <th className="px-4 py-3 text-left">User UID (Login ID)</th>
                <th className="px-4 py-3 text-left">Firebase Password</th>
                <th className="px-4 py-3 text-left">Full Name</th>
                <th className="px-4 py-3 text-left">Email Address</th>
                <th className="px-4 py-3 text-left">Department</th>
                <th className="px-4 py-3 text-left">Assigned RBAC Role</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {usersDirectory.map((u) => {
                const isPassVisible = Boolean(visiblePasswords[u.uid]);
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

                    <td className="px-4 py-3 font-mono">
                      {isEditingPass ? (
                        <div className="flex items-center gap-1.5">
                          <input
                            type="text"
                            value={draftPasswordValue}
                            onChange={(e) => setDraftPasswordValue(e.target.value)}
                            placeholder="New password"
                            className="w-28 px-2 py-1 text-xs font-mono border border-slate-300 rounded"
                          />
                          <button
                            type="button"
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
                          <span className="text-slate-800 font-semibold">
                            {isPassVisible
                              ? u.password || 'CityProp@2026'
                              : '••••••••••'}
                          </span>
                          <button
                            type="button"
                            onClick={() => toggleRowPasswordVisibility(u.uid)}
                            className="text-slate-400 hover:text-slate-700"
                            title={isPassVisible ? 'Hide Password' : 'Show Password'}
                          >
                            {isPassVisible ? (
                              <EyeOff className="w-3.5 h-3.5" />
                            ) : (
                              <Eye className="w-3.5 h-3.5" />
                            )}
                          </button>
                          {isAdmin && (
                            <button
                              type="button"
                              onClick={() => {
                                setEditingPasswordUid(u.uid);
                                setDraftPasswordValue(u.password || 'CityProp@2026');
                              }}
                              className="text-[11px] font-sans font-semibold text-emerald-700 hover:underline"
                            >
                              Edit PW
                            </button>
                          )}
                        </div>
                      )}
                    </td>

                    <td className="px-4 py-3 font-semibold text-slate-900">
                      {u.displayName}
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-700">{u.email}</td>
                    <td className="px-4 py-3 text-slate-600">{u.department}</td>
                    <td className="px-4 py-3">
                      <select
                        disabled={!isAdmin}
                        value={u.role}
                        onChange={async (e) => {
                          const updatedRole = e.target.value as UserRole;
                          await onUpdateUserRole(u.uid, updatedRole);
                          setToastMsg(
                            `Updated ${u.displayName} (${u.uid}) role to ${updatedRole} in Firebase.`
                          );
                          setTimeout(() => setToastMsg(null), 3500);
                        }}
                        className="px-2.5 py-1 text-xs font-semibold border border-slate-300 rounded bg-white disabled:bg-slate-50"
                      >
                        {ALL_ROLES.map((role) => (
                          <option key={role} value={role}>
                            {role}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {isAdmin && u.uid !== 'USR_ADMIN_01' ? (
                        <button
                          type="button"
                          onClick={async () => {
                            await onDeleteDirectoryUser(u.uid);
                            setToastMsg(
                              `Removed user ${u.uid} from Firebase Authorized Users.`
                            );
                            setTimeout(() => setToastMsg(null), 3500);
                          }}
                          className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-red-700 hover:bg-red-50 rounded"
                          title="Delete User from Firebase"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Delete
                        </button>
                      ) : (
                        <span className="text-[11px] text-slate-400">Protected</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4-Role Capabilities & Enforcement Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* 1. Administrator */}
        <div
          onClick={() => onSwitchActiveRole('Administrator')}
          className={`bg-white border rounded-lg p-5 cursor-pointer transition-all ${
            currentUser.role === 'Administrator'
              ? 'border-slate-900 ring-1 ring-slate-900'
              : 'border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
              <Shield className="w-4 h-4 text-slate-900" />
              Administrator
            </h3>
            {currentUser.role === 'Administrator' && (
              <span className="text-[11px] font-bold text-emerald-700">ACTIVE ROLE</span>
            )}
          </div>
          <p className="text-xs text-slate-500 mb-3">
            Full system governance across all 31+ Centers, 62+ Generators, inspections, alerts, and Firebase user accounts.
          </p>
          <ul className="space-y-1.5 text-xs text-slate-700">
            <li className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              Add Authorized Users (UID & Password) to Firebase
            </li>
            <li className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              Create, Edit & Delete Inspection & 300-Hr Reports
            </li>
            <li className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              Configure Alert Triggers & Email Recipient Lists
            </li>
            <li className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              Assign & Modify All 4 RBAC User Roles
            </li>
          </ul>
        </div>

        {/* 2. Chief Engineer */}
        <div
          onClick={() => onSwitchActiveRole('Chief Engineer')}
          className={`bg-white border rounded-lg p-5 cursor-pointer transition-all ${
            currentUser.role === 'Chief Engineer'
              ? 'border-slate-900 ring-1 ring-slate-900'
              : 'border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
              <Award className="w-4 h-4 text-amber-700" />
              Chief Engineer
            </h3>
            {currentUser.role === 'Chief Engineer' && (
              <span className="text-[11px] font-bold text-emerald-700">ACTIVE ROLE</span>
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
            <li className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              Configure Alert Rules & Resolve Sync Conflicts
            </li>
            <li className="flex items-center gap-1.5 text-slate-400">
              <Lock className="w-3.5 h-3.5 shrink-0" />
              Cannot Edit/Delete Saved Reports or Modify Roles
            </li>
          </ul>
        </div>

        {/* 3. Field Engineer */}
        <div
          onClick={() => onSwitchActiveRole('Field Engineer')}
          className={`bg-white border rounded-lg p-5 cursor-pointer transition-all ${
            currentUser.role === 'Field Engineer'
              ? 'border-slate-900 ring-1 ring-slate-900'
              : 'border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
              <Users className="w-4 h-4 text-slate-700" />
              Field Engineer
            </h3>
            {currentUser.role === 'Field Engineer' && (
              <span className="text-[11px] font-bold text-emerald-700">ACTIVE ROLE</span>
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
            <li className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              View Analytics, Maintenance Calendar & Print PDF
            </li>
            <li className="flex items-center gap-1.5 text-slate-400">
              <Lock className="w-3.5 h-3.5 shrink-0" />
              Cannot Edit or Delete Saved Reports (Admin Only)
            </li>
          </ul>
        </div>

        {/* 4. Viewer */}
        <div
          onClick={() => onSwitchActiveRole('Viewer')}
          className={`bg-white border rounded-lg p-5 cursor-pointer transition-all ${
            currentUser.role === 'Viewer'
              ? 'border-slate-900 ring-1 ring-slate-900'
              : 'border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
              <Lock className="w-4 h-4 text-slate-600" />
              Viewer (Read-Only)
            </h3>
            {currentUser.role === 'Viewer' && (
              <span className="text-[11px] font-bold text-emerald-700">ACTIVE ROLE</span>
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
            <li className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              Export Flat-Table Excel (.xlsx) & CSV Reports
            </li>
            <li className="flex items-center gap-1.5 text-slate-400">
              <Lock className="w-3.5 h-3.5 shrink-0" />
              Strictly Blocked from Creating or Editing Records
            </li>
          </ul>
        </div>
      </div>

      {/* Granular 4-Role Permission Matrix */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="p-4 border-b border-slate-200">
          <h3 className="text-sm font-bold text-slate-900">
            4-Tier Role Permission & Access Control Matrix
          </h3>
          <p className="text-xs text-slate-500">
            Overview of capabilities enforced across Administrator, Chief Engineer, Field Engineer, and Viewer roles.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
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
                <td className="px-4 py-2.5 font-medium">Provision Users (UID & Password in Firebase) & Modify RBAC Roles</td>
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
