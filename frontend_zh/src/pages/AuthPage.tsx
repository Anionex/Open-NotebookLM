import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, CheckCircle2, Loader2, Lock, Mail, Send, ShieldCheck, Sparkles } from 'lucide-react';

import { useAuthStore } from '../stores/authStore';

type AuthMode = 'login' | 'register';
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** 重发冷却秒数 */
const RESEND_COOLDOWN = 60;

const inputWrapClass =
  'flex items-center gap-3 rounded-[20px] border border-white/70 bg-white/80 px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] transition focus-within:border-sky-300 focus-within:ring-4 focus-within:ring-sky-100';

const inputClass =
  'w-full border-0 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400';

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
  // 验证码发送冷却倒计时
  const [cooldown, setCooldown] = useState(0);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // OTP 发送成功后同步邮箱并启动冷却
  useEffect(() => {
    if (needsOtpVerification && pendingEmail) {
      setEmail(pendingEmail);
      setLocalMessage(`验证码已发送到 ${pendingEmail}，请查收。`);
      startCooldown();
    }
  }, [needsOtpVerification, pendingEmail]);

  // 组件卸载时清理定时器
  useEffect(() => () => { if (cooldownRef.current) clearInterval(cooldownRef.current); }, []);

  const startCooldown = () => {
    setCooldown(RESEND_COOLDOWN);
    if (cooldownRef.current) clearInterval(cooldownRef.current);
    cooldownRef.current = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) { clearInterval(cooldownRef.current!); return 0; }
        return prev - 1;
      });
    }, 1000);
  };

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
    if (!normalizedEmail || !password) { setLocalError('请输入邮箱和密码。'); return; }
    if (!isEmailValid) { setLocalError('请输入正确的邮箱地址。'); return; }
    await signInWithEmail(normalizedEmail, password);
  };

  /** 第一步：填完邮箱密码后发送验证码 */
  const handleSendCode = async () => {
    resetMessages();
    setEmailTouched(true);
    if (!normalizedEmail || !password || !confirmPassword) { setLocalError('请完整填写邮箱和密码。'); return; }
    if (!isEmailValid) { setLocalError('请输入正确的邮箱地址。'); return; }
    if (password !== confirmPassword) { setLocalError('两次输入的密码不一致。'); return; }
    if (password.length < 6) { setLocalError('密码长度至少为 6 位。'); return; }
    await signUpWithEmail(normalizedEmail, password);
    // needsOtpVerification 变 true 后 useEffect 会处理提示和冷却
  };

  /** 第二步：提交验证码完成注册 */
  const handleRegister = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    resetMessages();
    if (!needsOtpVerification) {
      // 表单提交但还没发验证码 → 触发发送
      void handleSendCode();
      return;
    }
    if (!otpCode.trim()) { setLocalError('请输入验证码。'); return; }
    await verifyOtp(pendingEmail || normalizedEmail, otpCode);
  };

  const handleResend = async () => {
    if (cooldown > 0) return;
    resetMessages();
    const target = pendingEmail || normalizedEmail;
    if (!target) { setLocalError('缺少待验证邮箱。'); return; }
    await resendOtp(target);
    setLocalMessage(`已重新发送到 ${target}。`);
    startCooldown();
  };

  const switchMode = (next: AuthMode) => {
    resetMessages();
    if (needsOtpVerification) { clearPendingVerification(); setOtpCode(''); }
    setCooldown(0);
    if (cooldownRef.current) clearInterval(cooldownRef.current);
    setMode(next);
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(166,215,255,0.58),transparent_26%),radial-gradient(circle_at_top_right,rgba(255,225,205,0.46),transparent_24%),linear-gradient(180deg,#eef4fb_0%,#f5f4f7_44%,#f7f3ed_100%)] px-4 py-6 md:px-6">
      <div className="mx-auto grid min-h-[calc(100vh-3rem)] max-w-[1380px] items-center gap-6 lg:grid-cols-[1.1fr_520px]">

        {/* 左侧品牌面板 */}
        <motion.section
          initial={{ opacity: 0, x: -18 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.35 }}
          className="hidden rounded-[34px] border border-white/60 bg-white/52 p-8 shadow-[0_24px_60px_rgba(22,38,66,0.10)] backdrop-blur-2xl lg:block"
        >
          <div className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/72 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            <Sparkles size={14} />
            ThinkFlow
          </div>
          <h1 className="mt-6 text-6xl font-semibold tracking-[-0.06em] text-slate-900">开启你的知识之旅</h1>
          <p className="mt-5 max-w-xl text-[15px] leading-8 text-slate-600">
            在这里管理你的文档、生成洞见、创建多样化产出。
          </p>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <div className="rounded-[26px] border border-white/70 bg-white/72 p-5">
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">探索</div>
              <div className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-slate-900">智能问答</div>
              <p className="mt-2 text-sm leading-6 text-slate-500">基于来源的深度 RAG 对话，精准引用原文</p>
            </div>
            <div className="rounded-[26px] border border-white/70 bg-white/72 p-5">
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">整理</div>
              <div className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-slate-900">知识梳理</div>
              <p className="mt-2 text-sm leading-6 text-slate-500">沉淀对话、整理文档、构建专属知识底稿</p>
            </div>
            <div className="rounded-[26px] border border-white/70 bg-white/72 p-5">
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">产出</div>
              <div className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-slate-900">多样产出</div>
              <p className="mt-2 text-sm leading-6 text-slate-500">一键生成 PPT、播客、导图、测验和报告</p>
            </div>
          </div>

          <div className="mt-8 rounded-[28px] border border-sky-100/70 bg-[linear-gradient(135deg,rgba(230,241,255,0.82),rgba(255,250,245,0.78))] p-6">
            <div className="flex items-start gap-3">
              <div className="rounded-2xl bg-sky-100 p-2 text-sky-700">
                <ShieldCheck size={18} />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-slate-900">AI 全链路知识工作台</h2>
                <p className="mt-2 text-sm leading-7 text-slate-600">
                  从来源导入、智能问答到多样产出，ThinkFlow 覆盖知识工作的完整闭环。
                </p>
              </div>
            </div>
          </div>
        </motion.section>

        {/* 右侧表单面板 */}
        <motion.section
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="rounded-[34px] border border-white/60 bg-white/64 p-6 shadow-[0_24px_60px_rgba(22,38,66,0.10)] backdrop-blur-2xl md:p-8"
        >
          <div className="mb-7">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/72 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              <Mail size={14} />
              ThinkFlow
            </div>
            <div className="mt-5 flex items-center gap-3">
              <img src="/logo_small.png" alt="ThinkFlow" className="h-12 w-auto object-contain" />
              <div>
                <h1 className="text-3xl font-semibold tracking-[-0.04em] text-slate-900">
                  {mode === 'register' ? '创建你的账号' : '欢迎回来'}
                </h1>
                <p className="mt-1 text-sm text-slate-500">
                  {mode === 'register'
                    ? '注册后即可进入统一的 ThinkFlow 工作台。'
                    : '登录后继续你的文档与产出工作流。'}
                </p>
              </div>
            </div>
          </div>

          {/* Tab bar — 始终可见 */}
          <div className="mb-6 inline-flex rounded-full border border-white/70 bg-white/72 p-1">
            <button
              type="button"
              onClick={() => switchMode('login')}
              className={`rounded-full px-5 py-2.5 text-sm font-medium transition ${
                mode === 'login'
                  ? 'bg-[linear-gradient(135deg,#17467a_0%,#3f84cc_100%)] text-white shadow-[0_14px_28px_rgba(45,98,164,0.22)]'
                  : 'text-slate-500'
              }`}
            >
              登录
            </button>
            <button
              type="button"
              onClick={() => switchMode('register')}
              className={`rounded-full px-5 py-2.5 text-sm font-medium transition ${
                mode === 'register'
                  ? 'bg-[linear-gradient(135deg,#17467a_0%,#3f84cc_100%)] text-white shadow-[0_14px_28px_rgba(45,98,164,0.22)]'
                  : 'text-slate-500'
              }`}
            >
              注册
            </button>
          </div>

          {/* ── 登录表单 ── */}
          {mode === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4">
              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">邮箱</span>
                <div className={inputWrapClass}>
                  <Mail size={18} className="text-slate-400" />
                  <input
                    type="email" autoComplete="email" value={email} inputMode="email" required
                    onChange={(e) => { setEmail(e.target.value); if (localError) setLocalError(''); }}
                    onBlur={() => setEmailTouched(true)}
                    placeholder="name@example.com"
                    className={inputClass}
                  />
                </div>
              </label>
              {showEmailError && <p className="text-sm text-rose-600">请输入正确的邮箱地址。</p>}

              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">密码</span>
                <div className={inputWrapClass}>
                  <Lock size={18} className="text-slate-400" />
                  <input type="password" autoComplete="current-password" value={password}
                    onChange={(e) => setPassword(e.target.value)} placeholder="请输入密码" className={inputClass} />
                </div>
              </label>

              <button type="submit" disabled={loading}
                className="inline-flex w-full items-center justify-center gap-2 rounded-[20px] bg-[linear-gradient(135deg,#17467a_0%,#3f84cc_100%)] px-5 py-3.5 text-sm font-medium text-white shadow-[0_16px_32px_rgba(45,98,164,0.24)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60">
                {loading ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
                {loading ? '登录中...' : '登录'}
              </button>
            </form>
          )}

          {/* ── 注册表单（验证码输入框始终在表单内） ── */}
          {mode === 'register' && (
            <form onSubmit={handleRegister} className="space-y-4">
              {/* 邮箱 — OTP 后只读 */}
              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">邮箱</span>
                <div className={inputWrapClass}>
                  <Mail size={18} className="text-slate-400" />
                  <input
                    type="email" autoComplete="email" value={email} inputMode="email" required
                    disabled={needsOtpVerification}
                    onChange={(e) => { setEmail(e.target.value); if (localError) setLocalError(''); }}
                    onBlur={() => setEmailTouched(true)}
                    placeholder="name@example.com"
                    className={`${inputClass} ${needsOtpVerification ? 'opacity-50' : ''}`}
                  />
                </div>
              </label>
              {showEmailError && <p className="text-sm text-rose-600">请输入正确的邮箱地址。</p>}

              {/* 密码和确认密码 — OTP 阶段隐藏 */}
              {!needsOtpVerification && (
                <>
                  <label className="block">
                    <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">密码</span>
                    <div className={inputWrapClass}>
                      <Lock size={18} className="text-slate-400" />
                      <input type="password" autoComplete="new-password" value={password}
                        onChange={(e) => setPassword(e.target.value)} placeholder="至少 6 位" className={inputClass} />
                    </div>
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">确认密码</span>
                    <div className={inputWrapClass}>
                      <Lock size={18} className="text-slate-400" />
                      <input type="password" autoComplete="new-password" value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)} placeholder="再次输入密码" className={inputClass} />
                    </div>
                  </label>
                </>
              )}

              {/* 验证码区域 — 始终渲染，发送前禁用 */}
              <div className="space-y-2">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">验证码</span>
                <div className="flex items-center gap-2">
                  <div className={`${inputWrapClass} flex-1`}>
                    <ShieldCheck size={18} className="shrink-0 text-slate-400" />
                    <input
                      type="text"
                      value={otpCode}
                      disabled={!needsOtpVerification}
                      onChange={(e) => setOtpCode(e.target.value)}
                      placeholder={needsOtpVerification ? '输入邮件中的验证码' : '先填写上方信息再发送'}
                      className={`${inputClass} ${!needsOtpVerification ? 'opacity-40' : ''}`}
                    />
                  </div>
                  {/* 发送验证码按钮 */}
                  <button
                    type="button"
                    disabled={loading || cooldown > 0 || needsOtpVerification}
                    onClick={() => void handleSendCode()}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-[18px] border border-sky-200 bg-sky-50 px-4 py-3 text-sm font-medium text-sky-700 transition hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {loading && !needsOtpVerification
                      ? <Loader2 size={15} className="animate-spin" />
                      : <Send size={15} />}
                    {cooldown > 0 ? `${cooldown}s` : needsOtpVerification ? '已发送' : '发送'}
                  </button>
                </div>
                {/* 已发送后显示重发链接 */}
                {needsOtpVerification && (
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center justify-between"
                  >
                    <span className="text-xs text-sky-600">验证码已发送，请查收邮件。</span>
                    <button
                      type="button"
                      disabled={cooldown > 0}
                      onClick={() => void handleResend()}
                      className="text-xs text-slate-400 underline-offset-2 transition hover:text-slate-600 hover:underline disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {cooldown > 0 ? `${cooldown}s 后重发` : '没收到？重新发送'}
                    </button>
                  </motion.div>
                )}
              </div>

              <button type="submit" disabled={loading || (!needsOtpVerification && false)}
                className="inline-flex w-full items-center justify-center gap-2 rounded-[20px] bg-[linear-gradient(135deg,#17467a_0%,#3f84cc_100%)] px-5 py-3.5 text-sm font-medium text-white shadow-[0_16px_32px_rgba(45,98,164,0.24)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60">
                {loading
                  ? <Loader2 size={16} className="animate-spin" />
                  : needsOtpVerification ? <CheckCircle2 size={16} /> : <ArrowRight size={16} />}
                {loading
                  ? (needsOtpVerification ? '验证中...' : '发送中...')
                  : (needsOtpVerification ? '完成验证' : '注册')}
              </button>
            </form>
          )}

          {/* 消息区 */}
          {localMessage && (
            <div className="mt-4 rounded-[22px] border border-emerald-100/70 bg-emerald-50/90 px-4 py-3 text-sm text-emerald-700">
              {localMessage}
            </div>
          )}
          {displayError && (
            <div className="mt-4 rounded-[22px] border border-rose-100/70 bg-rose-50/90 px-4 py-3 text-sm text-rose-700">
              {displayError}
            </div>
          )}

          <div className="mt-6 text-center">
            <button type="button" onClick={continueAsGuest}
              className="text-sm font-medium text-slate-500 underline-offset-4 transition hover:text-slate-700 hover:underline">
              以访客身份继续
            </button>
          </div>
        </motion.section>
      </div>
    </div>
  );
}
