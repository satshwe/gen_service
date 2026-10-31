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
} from 'lucide-react';

interface LoginPageProps {
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
  onLoginWithCredentials,
  onSignInWithGoogle,
}) => {
  // Security Hardening: Inputs must start strictly empty. No default credentials or pre-filled values.
  const [userUid, setUserUid] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberSession, setRememberSession] = useState(true);
  const [isVerifying, setIsVerifying] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userUid.trim() || !password.trim()) {
      setErrorMsg('User UID နှင့် Password နှစ်ခုလုံး ထည့်သွင်းပေးပါ။ (Please enter both User UID and Password.)');
      return;
    }
    setErrorMsg(null);
    setIsVerifying(true);
    try {
      const result = await onLoginWithCredentials(userUid.trim(), password.trim(), rememberSession);
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

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col justify-between p-4 sm:p-8">
      {/* Top Institutional Security Header */}
      <div className="max-w-xl w-full mx-auto flex items-center justify-between gap-3 pb-4 border-b border-slate-800 text-slate-300 text-xs">
        <div className="flex items-center gap-3">
          <img
            src="/assets/aistudio/cp_logo_cb60fbe9.jfif"
            alt="City Properties Logo"
            className="h-9 w-auto object-contain rounded bg-white p-0.5 shrink-0 shadow-xs"
          />
          <div>
            <span className="font-bold text-white tracking-tight text-sm">
              City Properties Co., Ltd
            </span>
            <div className="text-[11px] text-slate-400">
              Engineering & Facilities Reliability Division
            </div>
          </div>
        </div>
        <div className="hidden sm:flex items-center gap-1.5 font-mono text-[11px] text-emerald-400 bg-emerald-950/60 border border-emerald-800/80 px-2.5 py-1 rounded">
          <Database className="w-3.5 h-3.5 shrink-0" />
          <span>Firebase Protected</span>
        </div>
      </div>

      {/* Main Centered High-Security Login Card (No exposed credentials or helper lists) */}
      <div className="max-w-md w-full mx-auto my-8">
        <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden text-slate-900">
          {/* Card Header with Logo */}
          <div className="bg-slate-950 text-white p-6 sm:p-7 border-b border-slate-800 text-center relative">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-[11px] font-semibold mb-3">
              <Shield className="w-3.5 h-3.5" />
              <span>Authorized Personnel Portal</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
              Generator Service & Reliability
            </h1>
            <p className="text-xs text-slate-400 mt-1.5 font-myanmar">
              စနစ်အတွင်းသို့ ဝင်ရောက်ရန် ခွင့်ပြုချက်ရရှိထားသော User UID နှင့် Password ကို ထည့်သွင်းပါ။
            </p>
          </div>

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="p-6 sm:p-7 space-y-4">
            {errorMsg && (
              <div className="bg-red-50 border border-red-200 text-red-900 rounded-lg p-3.5 flex items-start gap-2.5 text-xs">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <div className="font-bold">Authentication Failed (ဝင်ရောက်ခွင့် မပြုပါ)</div>
                  <div className="font-myanmar leading-relaxed">{errorMsg}</div>
                </div>
              </div>
            )}

            {/* User UID Input */}
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
                  placeholder="Enter your User UID"
                  autoComplete="username"
                  className="w-full pl-3.5 pr-10 py-2.5 text-sm font-mono bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 text-slate-900 transition-colors"
                />
                <UserCheck className="w-4 h-4 text-slate-400 absolute right-3.5 top-3" />
              </div>
            </div>

            {/* Password Input (Masked by default) */}
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
                  placeholder="••••••••••••"
                  autoComplete="current-password"
                  className="w-full pl-3.5 pr-10 py-2.5 text-sm font-mono bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 text-slate-900 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-700 p-0.5"
                  title={showPassword ? 'Hide Password' : 'Show Password'}
                  aria-label={showPassword ? 'Hide Password' : 'Show Password'}
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Session Persistence */}
            <div className="flex items-center justify-between text-xs pt-1">
              <label className="inline-flex items-center gap-2 text-slate-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberSession}
                  onChange={(e) => setRememberSession(e.target.checked)}
                  className="rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                />
                <span>Remember on this device</span>
              </label>
              <span className="text-[11px] font-mono text-emerald-700 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Live Verification
              </span>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isVerifying}
              className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white font-semibold text-sm rounded-lg transition-colors flex items-center justify-center gap-2 shadow-sm mt-2"
            >
              <LogIn className="w-4 h-4" />
              {isVerifying ? (
                <span>Verifying Credentials...</span>
              ) : (
                <span className="font-myanmar">လုံခြုံစွာ ဝင်ရောက်မည် (Sign In)</span>
              )}
            </button>

            {/* Google OAuth Option */}
            <div className="relative flex py-2 items-center">
              <div className="flex-grow border-t border-slate-200" />
              <span className="flex-shrink mx-3 text-[11px] text-slate-400 uppercase font-semibold">
                Or Corporate Google Auth
              </span>
              <div className="flex-grow border-t border-slate-200" />
            </div>

            <button
              type="button"
              onClick={onSignInWithGoogle}
              className="w-full py-2.5 px-4 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 font-semibold text-xs rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              <Lock className="w-3.5 h-3.5 text-slate-500" />
              <span>Sign In with Google Account (Firebase OAuth)</span>
            </button>
          </form>

          {/* Security Notice Footer */}
          <div className="bg-slate-50 p-4 border-t border-slate-200 text-center text-[11px] text-slate-500 font-myanmar">
            အကောင့်အသစ် လိုအပ်ပါက သို့မဟုတ် Password မေ့လျော့ပါက သက်ဆိုင်ရာ <strong>System Administrator</strong> ထံ ဆက်သွယ်ပါ။
          </div>
        </div>
      </div>

      {/* Bottom Institutional Copyright */}
      <div className="max-w-xl w-full mx-auto pt-4 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
        <span>City Properties Co., Ltd · Generator Fleet Security</span>
        <span>Verified via Firebase Firestore Security Gate</span>
      </div>
    </div>
  );
};
