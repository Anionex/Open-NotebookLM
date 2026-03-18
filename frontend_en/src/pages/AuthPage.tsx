import { FormEvent, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Loader2, Lock, Mail, ShieldCheck } from 'lucide-react';
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
      setLocalMessage(`We sent a verification email or code to ${pendingEmail}.`);
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
      setLocalError('Enter your email and password.');
      return;
    }
    if (!isEmailValid) {
      setLocalError('Enter a valid email address.');
      return;
    }
    await signInWithEmail(normalizedEmail, password);
  };

  const handleRegister = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    resetMessages();
    setEmailTouched(true);
    if (!normalizedEmail || !password || !confirmPassword) {
      setLocalError('Complete all registration fields.');
      return;
    }
    if (!isEmailValid) {
      setLocalError('Enter a valid email address.');
      return;
    }
    if (password !== confirmPassword) {
      setLocalError('Passwords do not match.');
      return;
    }
    if (password.length < 6) {
      setLocalError('Password must be at least 6 characters.');
      return;
    }

    const result = await signUpWithEmail(normalizedEmail, password);
    if (!result.needsVerification) {
      setLocalMessage('Account created and signed in.');
    }
  };

  const handleVerify = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    resetMessages();
    const emailToVerify = pendingEmail || normalizedEmail;
    if (!emailToVerify || !otpCode.trim()) {
      setLocalError('Enter the verification code.');
      return;
    }
    await verifyOtp(emailToVerify, otpCode);
  };

  const handleResend = async () => {
    resetMessages();
    const emailToVerify = pendingEmail || normalizedEmail;
    if (!emailToVerify) {
      setLocalError('Missing pending email.');
      return;
    }
    await resendOtp(emailToVerify);
    setLocalMessage(`Resent to ${emailToVerify}.`);
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
    <div className="relative min-h-screen overflow-hidden bg-transparent px-4 py-8 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-24 top-0 h-80 w-80 rounded-full bg-primary/14 blur-3xl" />
        <div className="absolute right-[-4rem] top-24 h-96 w-96 rounded-full bg-accent-blue/14 blur-3xl" />
        <div className="absolute bottom-[-5rem] left-1/3 h-80 w-80 rounded-full bg-accent-gold/12 blur-3xl" />
      </div>

      <div className="relative mx-auto flex min-h-[calc(100vh-4rem)] max-w-5xl items-center justify-center">
        <div className="grid w-full items-stretch gap-6 lg:grid-cols-[1.02fr_0.98fr]">
          <div className="glass hidden rounded-ios-2xl p-8 shadow-ios-xl lg:flex lg:flex-col lg:justify-between">
            <div>
              <p className="portal-kicker">Peking University Style</p>
              <h1 className="mt-4 max-w-md text-4xl leading-tight text-balance">
                OpenNotebookLM
              </h1>
              <p className="mt-4 max-w-md text-base leading-7 text-ios-gray-600">
                A PKU-inspired, iOS-polished shell for research notebooks. Visual language is unified while business logic and APIs stay intact.
              </p>
            </div>

            <div className="portal-card-soft mt-8 space-y-4 p-6">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-ios bg-primary/10 text-primary">
                  <ShieldCheck size={20} />
                </div>
                <div>
                  <div className="text-sm font-semibold text-ios-gray-900">Research-ready shell</div>
                  <div className="text-sm text-ios-gray-500">Unified top shell, cards, forms, and modal surfaces</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm text-ios-gray-600">
                <div className="rounded-ios bg-white/75 px-4 py-3">Email sign-in / register</div>
                <div className="rounded-ios bg-white/75 px-4 py-3">OTP verification</div>
              </div>
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="rounded-ios-2xl border border-white/80 bg-white/86 p-6 shadow-ios-xl backdrop-blur-ios sm:p-8"
          >
            <div className="mb-8 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-ios-xl bg-primary/10 ring-1 ring-primary/10">
                <img src="/logo_small.png" alt="OpenNotebookLM" className="h-10 w-auto object-contain" />
              </div>
              <p className="portal-kicker">Notebook Access</p>
              <h2 className="mt-3 text-3xl">OpenNotebookLM</h2>
              <p className="mt-2 text-sm text-ios-gray-500">
                {mode === 'register' ? 'Create account' : mode === 'verify' ? 'Verify email' : 'Sign in'}
              </p>
            </div>

            {mode !== 'verify' && (
              <div className="mb-6 grid grid-cols-2 gap-2 rounded-ios-xl bg-ios-gray-100/80 p-1.5">
                <button
                  type="button"
                  onClick={() => switchMode('login')}
                  className={`rounded-ios px-4 py-3 text-sm font-semibold transition ${
                    mode === 'login'
                      ? 'bg-white text-primary shadow-ios-sm'
                      : 'text-ios-gray-500 hover:text-ios-gray-700'
                  }`}
                >
                  Sign in
                </button>
                <button
                  type="button"
                  onClick={() => switchMode('register')}
                  className={`rounded-ios px-4 py-3 text-sm font-semibold transition ${
                    mode === 'register'
                      ? 'bg-white text-primary shadow-ios-sm'
                      : 'text-ios-gray-500 hover:text-ios-gray-700'
                  }`}
                >
                  Register
                </button>
              </div>
            )}

            {mode === 'login' && (
              <form onSubmit={handleLogin} className="space-y-4">
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-ios-gray-700">Email</span>
                  <div className="portal-input flex items-center gap-3">
                    <Mail size={18} className="text-ios-gray-400" />
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
                      className="w-full border-0 bg-transparent p-0 text-sm text-ios-gray-900 outline-none placeholder:text-ios-gray-400"
                    />
                  </div>
                </label>
                {showEmailError && <p className="text-sm text-error-600">Enter a valid email address.</p>}

                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-ios-gray-700">Password</span>
                  <div className="portal-input flex items-center gap-3">
                    <Lock size={18} className="text-ios-gray-400" />
                    <input
                      type="password"
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      className="w-full border-0 bg-transparent p-0 text-sm text-ios-gray-900 outline-none placeholder:text-ios-gray-400"
                    />
                  </div>
                </label>

                <button type="submit" disabled={loading} className="portal-button-primary w-full">
                  {loading ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
                  {loading ? 'Signing in...' : 'Sign in'}
                </button>
              </form>
            )}

            {mode === 'register' && (
              <form onSubmit={handleRegister} className="space-y-4">
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-ios-gray-700">Email</span>
                  <div className="portal-input flex items-center gap-3">
                    <Mail size={18} className="text-ios-gray-400" />
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
                      className="w-full border-0 bg-transparent p-0 text-sm text-ios-gray-900 outline-none placeholder:text-ios-gray-400"
                    />
                  </div>
                </label>
                {showEmailError && <p className="text-sm text-error-600">Enter a valid email address.</p>}

                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-ios-gray-700">Password</span>
                  <div className="portal-input flex items-center gap-3">
                    <Lock size={18} className="text-ios-gray-400" />
                    <input
                      type="password"
                      autoComplete="new-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="At least 6 characters"
                      className="w-full border-0 bg-transparent p-0 text-sm text-ios-gray-900 outline-none placeholder:text-ios-gray-400"
                    />
                  </div>
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-ios-gray-700">Confirm password</span>
                  <div className="portal-input flex items-center gap-3">
                    <Lock size={18} className="text-ios-gray-400" />
                    <input
                      type="password"
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Enter it again"
                      className="w-full border-0 bg-transparent p-0 text-sm text-ios-gray-900 outline-none placeholder:text-ios-gray-400"
                    />
                  </div>
                </label>

                <button type="submit" disabled={loading} className="portal-button-primary w-full">
                  {loading ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
                  {loading ? 'Creating account...' : 'Register'}
                </button>
              </form>
            )}

            {mode === 'verify' && (
              <form onSubmit={handleVerify} className="space-y-4">
                <div className="rounded-ios-xl border border-primary/12 bg-primary/6 px-4 py-3 text-sm text-primary">
                  Complete email verification to continue.
                </div>

                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-ios-gray-700">Verification code</span>
                  <div className="portal-input flex items-center gap-3">
                    <Mail size={18} className="text-ios-gray-400" />
                    <input
                      type="text"
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value)}
                      placeholder="Enter the code"
                      className="w-full border-0 bg-transparent p-0 text-sm text-ios-gray-900 outline-none placeholder:text-ios-gray-400"
                    />
                  </div>
                </label>

                <button type="submit" disabled={loading} className="portal-button-primary w-full">
                  {loading ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
                  {loading ? 'Verifying...' : 'Verify'}
                </button>

                <div className="grid grid-cols-2 gap-3">
                  <button type="button" onClick={() => void handleResend()} className="portal-button-secondary">
                    Resend
                  </button>
                  <button type="button" onClick={() => switchMode('login')} className="portal-button-secondary">
                    Back to sign in
                  </button>
                </div>
              </form>
            )}

            {displayError && (
              <div className="mt-4 rounded-ios-xl border border-error-500/15 bg-error-50 px-4 py-3 text-sm text-error-600">
                {displayError}
              </div>
            )}
            {localMessage && (
              <div className="mt-4 rounded-ios-xl border border-success-500/15 bg-success-50 px-4 py-3 text-sm text-success-600">
                {localMessage}
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
}
