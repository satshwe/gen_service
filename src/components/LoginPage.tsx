import React, { useState } from 'react';
import {
  Shield,
  Lock,
  UserCheck,
  Eye,
  EyeOff,
  LogIn,
  AlertCircle,
  Database,
  CheckCircle2,
  KeyRound,
} from 'lucide-react';
import { UserProfile } from '../types';

interface LoginPageProps {
  usersDirectory: UserProfile[];
  onLoginWithCredentials: (
    uidInput: string,
    passwordInput: string,
    rememberSession: boolean
  ) => Promise<{
    success: boolean;
    errorMessage?: string;
    source?: 'FIREBASE_FIRESTORE' | 'LOCAL_CACHE';
  }>;
  onSignInWithGoogle: () => Promise<void>;
}

export const LoginPage: React.FC<LoginPageProps> = ({
  usersDirectory,
  onLoginWithCredentials,
  onSignInWithGoogle,
}) => {
  const [userUid, setUserUid] = useState('USR_ADMIN_01');
  const [password, setPassword] = useState('Admin@2026');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberSession, setRememberSession] = useState(true);
  const [isVerifying, setIsVerifying] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showDirectoryHelper, setShowDirectoryHelper] = useState(true);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsVerifying(true);
    try {
      const result = await onLoginWithCredentials(userUid, password, rememberSession);
      if (!result.success) {
        setErrorMsg(
          result.errorMessage ||
            'Invalid User UID or Password in Firebase. (User UID သို့မဟုတ် Password မှားယွင်းနေပါသည်။)'
        );
      }
    } finally {
      setIsVerifying(false);
    }
  };

  const handleQuickFill = (u: UserProfile) => {
    setUserUid(u.uid);
    setPassword(u.password || 'CityProp@2026');
    setErrorMsg(null);
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-900 flex flex-col justify-between p-4 sm:p-8">
      {/* Top Institutional Security Bar */}
      <div className="max-w-5xl w-full mx-auto flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-800 text-slate-300 text-xs">
        <div className="flex items-center gap-3">
          <img
            src="/assets/aistudio/cp_logo_cb60fbe9.jfif"
            alt="City Properties Logo"
            className="h-8 w-auto object-contain rounded bg-white p-0.5 shrink-0"
          />
          <div>
            <span className="font-bold text-white tracking-tight text-sm">
              City Properties Co., Ltd
            </span>
            <span className="text-slate-600 mx-2">|</span>
            <span className="text-slate-300">Engineering & Facilities Reliability Division</span>
          </div>
        </div>
        <div className="flex items-center gap-2 font-mono text-[11px] text-slate-400">
          <Database className="w-3.5 h-3.5 text-emerald-400" />
          <span>Firebase Firestore Security Auth Gate · Gen SOP-002</span>
        </div>
      </div>

      {/* Main Centered Login Card + Authorized Directory Reference */}
      <div className="max-w-5xl w-full mx-auto my-8 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Primary Login Form (7 cols) */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden">
          <div className="bg-slate-950 text-white p-6 border-b border-slate-800">
            <div className="flex items-center justify-between gap-4 mb-3">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-[11px] font-semibold">
                <Shield className="w-3.5 h-3.5" />
                Authorized Personnel Security Portal
              </div>
              <img
                src="/assets/aistudio/cp_logo_cb60fbe9.jfif"
                alt="City Properties Logo"
                className="h-8 w-auto object-contain rounded bg-white p-0.5 shrink-0"
              />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
              Generator Service & Analytics Login
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Sign in with your Firebase Authorized <strong>User UID</strong> and{' '}
              <strong>Password</strong> provisioned by the System Administrator.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            {errorMsg && (
              <div className="bg-red-50 border border-red-200 text-red-900 rounded-lg p-3.5 flex items-start gap-2.5 text-xs">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <div className="font-bold">Authentication Denied (ဝင်ရောက်ခွင့် မပြုပါ)</div>
                  <div>{errorMsg}</div>
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Authorized User UID (သို့မဟုတ် Email) <span className="text-red-600">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={userUid}
                  onChange={(e) => setUserUid(e.target.value)}
                  placeholder="e.g., USR_ADMIN_01 or USR_ENG_01"
                  autoComplete="username"
                  className="w-full pl-3.5 pr-10 py-2.5 text-sm font-mono bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 text-slate-900"
                />
                <UserCheck className="w-4 h-4 text-slate-400 absolute right-3.5 top-3" />
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Matches <code className="font-mono text-slate-700">/users/&#123;uid&#125;</code> in Firebase Firestore.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Password (လျှို့ဝှက်နံပါတ်) <span className="text-red-600">*</span>
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your Firebase password"
                  autoComplete="current-password"
                  className="w-full pl-3.5 pr-10 py-2.5 text-sm font-mono bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 text-slate-900"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-700 p-0.5"
                  title={showPassword ? 'Hide Password' : 'Show Password'}
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs">
              <label className="inline-flex items-center gap-2 text-slate-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberSession}
                  onChange={(e) => setRememberSession(e.target.checked)}
                  className="rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                />
                <span>Keep me signed in on this device</span>
              </label>
              <span className="text-[11px] font-mono text-emerald-700 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Firebase Live Verification
              </span>
            </div>

            <button
              type="submit"
              disabled={isVerifying}
              className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white font-semibold text-sm rounded-lg transition-colors flex items-center justify-center gap-2 shadow-sm"
            >
              <LogIn className="w-4 h-4" />
              {isVerifying
                ? 'Verifying UID & Password in Firebase...'
                : 'Sign In with User UID & Password (ဝင်ရောက်မည်)'}
            </button>

            <div className="relative flex py-1 items-center">
              <div className="flex-grow border-t border-slate-200" />
              <span className="flex-shrink mx-3 text-[11px] text-slate-400 uppercase font-semibold">
                Or Corporate Google Auth
              </span>
              <div className="flex-grow border-t border-slate-200" />
            </div>

            <button
              type="button"
              onClick={onSignInWithGoogle}
              className="w-full py-2 px-4 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 font-semibold text-xs rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              <Lock className="w-3.5 h-3.5 text-slate-500" />
              Sign In with Google Account (Firebase OAuth)
            </button>
          </form>
        </div>

        {/* Right Column: Live Firebase Authorized Users Reference Card (5 cols) */}
        <div className="lg:col-span-5 bg-slate-800/90 border border-slate-700 rounded-xl p-5 text-slate-200 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-700 pb-3">
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-emerald-400" />
                Firebase Authorized Accounts ({usersDirectory.length})
              </h2>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Synced from Firestore <code className="font-mono text-emerald-300">/users</code> collection. Click any account to auto-fill UID & Password.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowDirectoryHelper(!showDirectoryHelper)}
              className="text-[11px] font-semibold text-emerald-400 hover:underline shrink-0"
            >
              {showDirectoryHelper ? 'Hide List' : 'Show List'}
            </button>
          </div>

          {showDirectoryHelper && (
            <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
              {usersDirectory.map((u) => {
                const isSelected = userUid.trim().toUpperCase() === u.uid.toUpperCase();
                return (
                  <div
                    key={u.uid}
                    onClick={() => handleQuickFill(u)}
                    className={`p-3 rounded-lg border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-slate-900 border-emerald-400 ring-1 ring-emerald-400'
                        : 'bg-slate-900/60 border-slate-700/80 hover:border-slate-500'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="font-mono text-xs font-bold text-emerald-300">
                        {u.uid}
                      </span>
                      <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-slate-800 text-slate-200 border border-slate-600">
                        {u.role}
                      </span>
                    </div>
                    <div className="text-xs font-semibold text-white">
                      {u.displayName}
                    </div>
                    <div className="flex items-center justify-between gap-2 mt-1.5 text-[11px] text-slate-400 font-mono">
                      <span className="truncate">{u.email}</span>
                      <span className="text-amber-300 shrink-0">
                        PW: {u.password || 'CityProp@2026'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="bg-slate-900/80 border border-slate-700 rounded-lg p-3 text-[11px] text-slate-300 space-y-1">
            <div className="font-semibold text-white">
              Admin User Provisioning Workflow:
            </div>
            <p className="text-slate-400 leading-relaxed">
              1. Sign in as <strong>Administrator</strong> (<code className="font-mono text-emerald-300">USR_ADMIN_01</code> / <code className="font-mono text-amber-300">Admin@2026</code>).
              <br />
              2. Open <strong>Role: Administrator</strong> in the top utility bar.
              <br />
              3. Use <strong>Add Authorized User</strong> to register a new <strong>User UID</strong> and <strong>Password</strong> into Firebase Firestore.
            </p>
          </div>
        </div>
      </div>

      {/* Bottom Institutional Copyright */}
      <div className="max-w-5xl w-full mx-auto pt-4 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
        <span>City Properties Co., Ltd — 31 Centers / 62 Generators Fleet Security</span>
        <span>Protected by Firebase Firestore UID & Password Verification</span>
      </div>
    </div>
  );
};
