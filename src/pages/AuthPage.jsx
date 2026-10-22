import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { getHealth } from '../api';
import ScanPage from './ScanPage';

/* ── tiny inline styles ─────────────────────────────────────────── */
const s = {
  page:    { maxWidth: 440, margin: '40px auto', padding: '0 16px', fontFamily: 'system-ui, sans-serif' },
  card:    { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '28px 32px' },
  title:   { margin: '0 0 4px', fontSize: 26, fontWeight: 700, color: '#1a202c' },
  sub:     { margin: '0 0 24px', fontSize: 13, color: '#718096' },
  label:   { display: 'block', fontSize: 13, fontWeight: 600, color: '#4a5568', marginBottom: 4 },
  input:   { width: '100%', boxSizing: 'border-box', padding: '9px 12px', border: '1px solid #cbd5e0',
             borderRadius: 6, fontSize: 14, outline: 'none' },
  btn:     { width: '100%', padding: '10px 0', background: '#38a169', color: '#fff', border: 'none',
             borderRadius: 6, fontSize: 15, fontWeight: 600, cursor: 'pointer', marginTop: 8 },
  btnSec:  { background: 'none', border: 'none', color: '#38a169', cursor: 'pointer',
             fontSize: 13, padding: 0, textDecoration: 'underline' },
  btnDng:  { width: '100%', padding: '9px 0', background: '#e53e3e', color: '#fff', border: 'none',
             borderRadius: 6, fontSize: 14, fontWeight: 600, cursor: 'pointer', marginTop: 8 },
  err:     { background: '#fff5f5', border: '1px solid #feb2b2', borderRadius: 6,
             padding: '10px 12px', color: '#c53030', fontSize: 13, marginBottom: 12 },
  ok:      { background: '#f0fff4', border: '1px solid #9ae6b4', borderRadius: 6,
             padding: '10px 12px', color: '#276749', fontSize: 13, marginBottom: 12 },
  hint:    { fontSize: 12, color: '#718096', marginTop: 16, textAlign: 'center' },
  field:   { marginBottom: 14 },
  row:     { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 },
  code:    { fontFamily: 'monospace', background: '#edf2f7', padding: '2px 6px', borderRadius: 4 },
  ul:      { paddingLeft: 20, margin: '8px 0' },
  warn:    { color: '#c05621', fontWeight: 600, fontSize: 13 },
  spinner: { display: 'inline-block', width: 14, height: 14, border: '2px solid #fff',
             borderTop: '2px solid transparent', borderRadius: '50%',
             animation: 'spin 0.7s linear infinite', marginRight: 6 },
  divider: { borderTop: '1px solid #e2e8f0', margin: '20px 0' },
  small:   { fontSize: 12, color: '#a0aec0' },
};

/* ── helpers ─────────────────────────────────────────────────────── */
function Spinner() {
  return (
    <span style={s.spinner} />
  );
}

function ErrorBox({ msg }) {
  if (!msg) return null;
  return <div style={s.err} role="alert">{msg}</div>;
}

function OkBox({ msg }) {
  if (!msg) return null;
  return <div style={s.ok}>{msg}</div>;
}

function Field({ label, children }) {
  return (
    <div style={s.field}>
      <label style={s.label}>{label}</label>
      {children}
    </div>
  );
}

/* ── main component ──────────────────────────────────────────────── */
export default function AuthPage() {
  // ── local UI state ─────────────────────────────────────────────
  const [isLogin, setIsLogin]         = useState(true);
  const [email, setEmail]             = useState('');
  const [password, setPassword]       = useState('');
  const [localError, setLocalError]   = useState('');
  const [localOk, setLocalOk]         = useState('');
  const [localLoading, setLocalLoading] = useState(false);
  const [health, setHealth]           = useState(null);

  // 2FA login step
  const [tempToken, setTempToken]     = useState(null);
  const [twoCode, setTwoCode]         = useState('');
  const [useRecovery, setUseRecovery] = useState(false);

  // 2FA setup step
  const [setupData, setSetupData]     = useState(null);
  const [qrUrl, setQrUrl]             = useState(null);
  const [verifyCode, setVerifyCode]   = useState('');
  const [setupOk, setSetupOk]         = useState(false);

  // current user
  const [me, setMe]                   = useState(null);

  useEffect(() => { getHealth().then(setHealth).catch(() => {}); }, []);

  /* util */
  const fmt = (err) =>
    err.status === 429 ? 'Too many attempts, try again later.' : err.message || 'Something went wrong.';

  const resetAll = () => {
    setLocalError(''); setLocalOk('');
    setMe(null); setTempToken(null);
    setTwoCode(''); setUseRecovery(false);
    setSetupData(null); setQrUrl(null); setVerifyCode(''); setSetupOk(false);
  };

  /* ── handlers ──────────────────────────────────────────────────── */

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError(''); setLocalOk(''); setLocalLoading(true);
    try {
      if (!isLogin) {
        /* Register then auto-login */
        await import('../api').then(({ registerUser }) => registerUser({ email, password }));
        setLocalOk('Account created! Logging you in…');
      }
      const { loginUser } = await import('../api');
      const data = await loginUser({ email, password });
      if (data.requires_2fa && data.temp_token) {
        setTempToken(data.temp_token);
        setLocalOk('');
      } else if (data.access_token) {
        const { getMe } = await import('../api');
        setMe(await getMe());
        setLocalOk('');
      } else {
        throw new Error('Unexpected response from server.');
      }
    } catch (err) {
      setLocalError(fmt(err));
      setLocalOk('');
    } finally {
      setLocalLoading(false);
    }
  };

  const handle2faLogin = async (e) => {
    e.preventDefault();
    setLocalError(''); setLocalLoading(true);
    try {
      const { login2fa, getMe } = await import('../api');
      const payload = useRecovery
        ? { temp_token: tempToken, recovery_code: twoCode }
        : { temp_token: tempToken, code: twoCode };
      await login2fa(payload);
      setTempToken(null); setTwoCode(''); setUseRecovery(false);
      setMe(await getMe());
    } catch (err) {
      setLocalError(fmt(err));
    } finally {
      setLocalLoading(false);
    }
  };

  const handleEnable2fa = async () => {
    setLocalError(''); setLocalLoading(true);
    try {
      const { setup2fa } = await import('../api');
      const data = await setup2fa();
      setSetupData(data);
      if (data.otpauth_uri) {
        setQrUrl(await QRCode.toDataURL(data.otpauth_uri, { width: 200 }));
      }
    } catch (err) {
      setLocalError(fmt(err));
    } finally {
      setLocalLoading(false);
    }
  };

  const handleVerify2fa = async (e) => {
    e.preventDefault();
    setLocalError(''); setLocalLoading(true);
    try {
      const { verify2fa, getMe } = await import('../api');
      await verify2fa(verifyCode);
      setSetupData(null); setQrUrl(null); setVerifyCode(''); setSetupOk(true);
      setMe(await getMe());
    } catch (err) {
      setLocalError(fmt(err));
    } finally {
      setLocalLoading(false);
    }
  };

  const handleLogout = () => {
    import('../api').then(({ clearAccessToken }) => clearAccessToken());
    resetAll();
    setEmail(''); setPassword('');
  };

  /* ── render: 2FA login step ────────────────────────────────────── */
  if (tempToken) {
    return (
      <div style={s.page}>
        <div style={s.card}>
          <h1 style={s.title}>SehatPlate</h1>
          <p style={s.sub}>Two-Factor Authentication</p>
          <ErrorBox msg={localError} />
          <form onSubmit={handle2faLogin}>
            <Field label={useRecovery ? 'Recovery code' : '6-digit TOTP code'}>
              <input
                style={s.input}
                type="text"
                autoComplete="one-time-code"
                inputMode={useRecovery ? 'text' : 'numeric'}
                pattern={useRecovery ? undefined : '[0-9]*'}
                maxLength={useRecovery ? 32 : 6}
                value={twoCode}
                onChange={(e) => setTwoCode(e.target.value)}
                required
                disabled={localLoading}
                autoFocus
              />
            </Field>
            <button style={s.btn} type="submit" disabled={localLoading}>
              {localLoading && <Spinner />}
              {localLoading ? 'Verifying…' : 'Verify'}
            </button>
          </form>
          <div style={s.hint}>
            <button style={s.btnSec} type="button" onClick={() => { setUseRecovery(v => !v); setTwoCode(''); }}>
              {useRecovery ? 'Use a TOTP code instead' : 'Use a recovery code instead'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ── render: logged-in view ────────────────────────────────────── */
  if (me) {
    return (
      <div style={{ fontFamily: 'system-ui, sans-serif' }}>
        {/* Top bar */}
        <div style={{ background: '#fff', borderBottom: '1px solid #e2e8f0', padding: '10px 20px',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span style={{ fontWeight: 700, fontSize: 18, color: '#1a202c' }}>SehatPlate</span>
            <span style={{ marginLeft: 12, fontSize: 13, color: '#718096' }}>{me.email}</span>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            {/* 2FA inline section */}
            {!me.totp_enabled && !setupData && !setupOk && (
              <button
                style={{ ...s.btn, background: '#3182ce', width: 'auto', marginTop: 0, padding: '7px 14px', fontSize: 13 }}
                onClick={handleEnable2fa}
                disabled={localLoading}
              >
                {localLoading && <Spinner />}
                Enable 2FA
              </button>
            )}
            {me.totp_enabled && (
              <span style={{ fontSize: 12, color: '#276749', fontWeight: 600 }}>✓ 2FA on</span>
            )}
            <button style={s.btnDng} onClick={handleLogout}>Logout</button>
          </div>
        </div>

        {/* 2FA setup banner */}
        {(setupOk || setupData || localError) && (
          <div style={{ maxWidth: 520, margin: '16px auto 0', padding: '0 16px' }}>
            {setupOk && <OkBox msg="✓ 2FA enabled! Your account is now protected." />}
            <ErrorBox msg={localError} />
            {setupData && (
              <div style={s.card}>
                <p style={s.warn}>Save these now. They are shown only once.</p>
                {qrUrl && (
                  <div style={{ textAlign: 'center', margin: '12px 0' }}>
                    <img src={qrUrl} alt="Scan with your authenticator app" style={{ border: '4px solid #e2e8f0', borderRadius: 8 }} />
                    <p style={s.small}>Scan with your authenticator app</p>
                  </div>
                )}
                <p style={{ fontSize: 13 }}>
                  <strong>Secret:</strong>{' '}
                  <span style={s.code}>{setupData.secret}</span>
                </p>
                <p style={{ ...s.warn, marginTop: 12 }}>Recovery codes (one-time use):</p>
                <ul style={s.ul}>
                  {(setupData.recovery_codes || []).map((c, i) => (
                    <li key={i}><code style={s.code}>{c}</code></li>
                  ))}
                </ul>
                <div style={s.divider} />
                <form onSubmit={handleVerify2fa}>
                  <Field label="Enter the 6-digit code from your app to confirm">
                    <input
                      style={s.input}
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={6}
                      value={verifyCode}
                      onChange={(e) => setVerifyCode(e.target.value)}
                      required
                      disabled={localLoading}
                      autoFocus
                    />
                  </Field>
                  <button style={s.btn} type="submit" disabled={localLoading}>
                    {localLoading && <Spinner />}
                    {localLoading ? 'Verifying…' : 'Verify & Enable 2FA'}
                  </button>
                </form>
              </div>
            )}
          </div>
        )}

        {/* Main scan UI */}
        <div style={{ marginTop: 16 }}>
          <ScanPage />
        </div>
      </div>
    );
  }

  /* ── render: login / register form ─────────────────────────────── */
  return (
    <div style={s.page}>
      <div style={s.card}>
        <h1 style={s.title}>SehatPlate</h1>
        <p style={s.sub}>
          AI food guide for Pakistani dishes &nbsp;·&nbsp; Health check:{' '}
          {health
            ? <span style={{ color: health.status === 'ok' ? '#38a169' : '#e53e3e' }}>{health.status}</span>
            : 'checking…'}
        </p>

        <form onSubmit={handleSubmit} noValidate>
          <h2 style={{ margin: '0 0 18px', fontSize: 20 }}>{isLogin ? 'Sign in' : 'Create account'}</h2>

          <ErrorBox msg={localError} />
          <OkBox msg={localOk} />

          <Field label="Email address">
            <input
              style={s.input}
              type="email"
              value={email}
              autoComplete="email"
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={localLoading}
              placeholder="you@example.com"
            />
          </Field>

          <Field label="Password">
            <input
              style={s.input}
              type="password"
              value={password}
              autoComplete={isLogin ? 'current-password' : 'new-password'}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              disabled={localLoading}
              placeholder={isLogin ? '••••••••' : 'At least 8 characters'}
            />
          </Field>

          <button style={s.btn} type="submit" disabled={localLoading}>
            {localLoading && <Spinner />}
            {localLoading ? 'Please wait…' : isLogin ? 'Sign in' : 'Create account'}
          </button>
        </form>

        <div style={{ ...s.hint, marginTop: 20 }}>
          {isLogin ? "Don't have an account?" : 'Already have an account?'}{' '}
          <button
            style={s.btnSec}
            type="button"
            onClick={() => { setIsLogin(v => !v); setLocalError(''); setLocalOk(''); }}
            disabled={localLoading}
          >
            {isLogin ? 'Register' : 'Sign in'}
          </button>
        </div>
      </div>
    </div>
  );
}
