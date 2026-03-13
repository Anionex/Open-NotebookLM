import { FormEvent, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Loader2, Lock, Mail } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';

type AuthMode = 'login' | 'register' | 'verify';
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function AuthPage() {
  const {
    loading,
    error,
    pendingEmail,
    needsOtpVerification,
    signInWithEmail,
    signUpWithEmail,
    verifyOtp,
    resendOtp,
    continueAsGuest,
    clearError,
    clearPendingVerification,
  } = useAuthStore();

  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [emailTouched, setEmailTouched] = useState(false);
  const [localMessage, setLocalMessage] = useState('');
  const [localError, setLocalError] = useState('');

  useEffect(() => {
    if (needsOtpVerification && pendingEmail) {
      setMode('verify');
      setEmail(pendingEmail);
      setLocalMessage(`我们已向 ${pendingEmail} 发送验证邮件或验证码。`);
    }
  }, [needsOtpVerification, pendingEmail]);

  const normalizedEmail = useMemo(() => email.trim(), [email]);
  const isEmailValid = normalizedEmail.length > 0 && EMAIL_REGEX.test(normalizedEmail);
  const showEmailError = emailTouched && normalizedEmail.length > 0 && !isEmailValid;
  const displayError = localError || error || '';

  const resetMessages = () => {
    clearError();
    setLocalError('');
    setLocalMessage('');
  };

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    resetMessages();
    setEmailTouched(true);
    if (!normalizedEmail || !password) {
      setLocalError('请输入邮箱和密码。');
      return;
    }
    if (!isEmailValid) {
      setLocalError('请输入正确的邮箱地址。');
      return;
    }
    await signInWithEmail(normalizedEmail, password);
  };

  const handleRegister = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    resetMessages();
    setEmailTouched(true);
    if (!normalizedEmail || !password || !confirmPassword) {
      setLocalError('请完整填写注册信息。');
      return;
    }
    if (!isEmailValid) {
      setLocalError('请输入正确的邮箱地址。');
      return;
    }
    if (password !== confirmPassword) {
      setLocalError('两次输入的密码不一致。');
      return;
    }
    if (password.length < 6) {
      setLocalError('密码长度至少为 6 位。');
      return;
    }

    const result = await signUpWithEmail(normalizedEmail, password);
    if (!result.needsVerification) {
      setLocalMessage('注册成功，已自动登录。');
    }
  };

  const handleVerify = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    resetMessages();
    const emailToVerify = pendingEmail || normalizedEmail;
    if (!emailToVerify || !otpCode.trim()) {
      setLocalError('请输入验证码。');
      return;
    }
    await verifyOtp(emailToVerify, otpCode);
  };

  const handleResend = async () => {
    resetMessages();
    const emailToVerify = pendingEmail || normalizedEmail;
    if (!emailToVerify) {
      setLocalError('缺少待验证邮箱。');
      return;
    }
    await resendOtp(emailToVerify);
    setLocalMessage(`已重新发送到 ${emailToVerify}。`);
  };

  const switchMode = (nextMode: Exclude<AuthMode, 'verify'>) => {
    resetMessages();
    if (mode === 'verify') {
      clearPendingVerification();
      setOtpCode('');
    }
    setMode(nextMode);
  };

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#eef4ff_0%,#f7f9fc_48%,#eef2f7_100%)] px-4 py-10">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-md items-center">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="w-full rounded-[28px] border border-slate-200/80 bg-white p-8 shadow-[0_24px_80px_rgba(15,23,42,0.10)]"
        >
          <div className="mb-8 text-center">
            <img src="/logo_small.png" alt="OpenNotebookLM" className="mx-auto mb-4 h-12 w-auto object-contain" />
            <h1 className="text-3xl font-semibold text-slate-900">OpenNotebookLM</h1>
            <p className="mt-2 text-sm text-slate-500">
              {mode === 'register' ? '注册账号' : mode === 'verify' ? '验证邮箱' : '登录'}
            </p>
          </div>

          {mode !== 'verify' && (
            <div className="mb-6 flex rounded-2xl bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => switchMode('login')}
                className={`flex-1 rounded-[14px] px-4 py-2.5 text-sm font-medium transition ${
                  mode === 'login' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
                }`}
              >
                登录
              </button>
              <button
                type="button"
                onClick={() => switchMode('register')}
                className={`flex-1 rounded-[14px] px-4 py-2.5 text-sm font-medium transition ${
                  mode === 'register' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
                }`}
              >
                注册
              </button>
            </div>
          )}

          {mode === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">邮箱</span>
                <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
                  <Mail size={18} className="text-slate-400" />
                  <input
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (localError) setLocalError('');
                    }}
                    onBlur={() => setEmailTouched(true)}
                    placeholder="name@example.com"
                    inputMode="email"
                    required
                    className="w-full border-0 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
                  />
                </div>
              </label>
              {showEmailError && <p className="text-sm text-rose-600">请输入正确的邮箱地址。</p>}

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">密码</span>
                <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
                  <Lock size={18} className="text-slate-400" />
                  <input
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="请输入密码"
                    className="w-full border-0 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
                  />
                </div>
              </label>

              <button
                type="submit"
                disabled={loading}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
                {loading ? '登录中...' : '登录'}
              </button>
            </form>
          )}

          {mode === 'register' && (
            <form onSubmit={handleRegister} className="space-y-4">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">邮箱</span>
                <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
                  <Mail size={18} className="text-slate-400" />
                  <input
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (localError) setLocalError('');
                    }}
                    onBlur={() => setEmailTouched(true)}
                    placeholder="name@example.com"
                    inputMode="email"
                    required
                    className="w-full border-0 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
                  />
                </div>
              </label>
              {showEmailError && <p className="text-sm text-rose-600">请输入正确的邮箱地址。</p>}

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">密码</span>
                <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
                  <Lock size={18} className="text-slate-400" />
                  <input
                    type="password"
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="至少 6 位"
                    className="w-full border-0 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
                  />
                </div>
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">确认密码</span>
                <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
                  <Lock size={18} className="text-slate-400" />
                  <input
                    type="password"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="再次输入密码"
                    className="w-full border-0 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
                  />
                </div>
              </label>

              <button
                type="submit"
                disabled={loading}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
                {loading ? '注册中...' : '注册'}
              </button>
            </form>
          )}

          {mode === 'verify' && (
            <form onSubmit={handleVerify} className="space-y-4">
              <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-700">
                请完成邮箱验证后继续。
              </div>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">验证码</span>
                <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
                  <Mail size={18} className="text-slate-400" />
                  <input
                    type="text"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value)}
                    placeholder="输入验证码"
                    className="w-full border-0 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
                  />
                </div>
              </label>

              <button
                type="submit"
                disabled={loading}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
                {loading ? '验证中...' : '完成验证'}
              </button>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => void handleResend()}
                  className="flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  重新发送
                </button>
                <button
                  type="button"
                  onClick={() => switchMode('login')}
                  className="flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  返回登录
                </button>
              </div>
            </form>
          )}

          {localMessage && (
            <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {localMessage}
            </div>
          )}

          {displayError && (
            <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {displayError}
            </div>
          )}

          {mode !== 'verify' && (
            <div className="mt-6 text-center">
              <button
                type="button"
                onClick={continueAsGuest}
                className="text-sm text-slate-500 hover:text-slate-700 underline"
              >
                以访客身份继续
              </button>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
