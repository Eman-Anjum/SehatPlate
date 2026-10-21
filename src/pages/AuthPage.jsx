import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import {
  getHealth,
  registerUser,
  loginUser,
  login2fa,
  setup2fa,
  verify2fa,
  getMe,
  clearAccessToken,
} from '../api';

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [health, setHealth] = useState(null);
  const [user, setUser] = useState(null);
  const [tempToken, setTempToken] = useState(null);
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [useRecovery, setUseRecovery] = useState(false);
  const [setupData, setSetupData] = useState(null);
  const [qrDataUrl, setQrDataUrl] = useState(null);
  const [verifyCode, setVerifyCode] = useState('');

  useEffect(() => {
    getHealth().then(setHealth);
  }, []);

  const resetForm = () => {
    setError('');
    setUser(null);
    setTempToken(null);
    setTwoFactorCode('');
    setUseRecovery(false);
    setSetupData(null);
    setQrDataUrl(null);
    setVerifyCode('');
  };

  const loadMe = async () => {
    const me = await getMe();
    setUser(me);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setUser(null);
    setTempToken(null);

    try {
      let data;
      if (isLogin) {
        data = await loginUser({ email, password });
      } else {
        await registerUser({ email, password });
        data = await loginUser({ email, password });
      }

      if (data.requires_2fa && data.temp_token) {
        setTempToken(data.temp_token);
      } else if (data.access_token) {
        await loadMe();
      } else {
        throw new Error('Unexpected response from login');
      }
    } catch (err) {
      setError(err.status === 429 ? 'Too many attempts, try again later' : err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const handle2faSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const payload = useRecovery
        ? { temp_token: tempToken, recovery_code: twoFactorCode }
        : { temp_token: tempToken, code: twoFactorCode };
      await login2fa(payload);
      setTempToken(null);
      setTwoFactorCode('');
      await loadMe();
    } catch (err) {
      setError(err.status === 429 ? 'Too many attempts, try again later' : err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const handleEnable2fa = async () => {
    setLoading(true);
    setError('');
    setSetupData(null);
    setQrDataUrl(null);

    try {
      const data = await setup2fa();
      setSetupData(data);
      if (data.otpauth_uri) {
        const dataUrl = await QRCode.toDataURL(data.otpauth_uri);
        setQrDataUrl(dataUrl);
      }
    } catch (err) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify2fa = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await verify2fa(verifyCode);
      setSetupData(null);
      setQrDataUrl(null);
      setVerifyCode('');
      await loadMe();
    } catch (err) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    clearAccessToken();
    resetForm();
    setEmail('');
    setPassword('');
  };

  const toggleMode = () => {
    setIsLogin((prev) => !prev);
    resetForm();
  };

  if (user) {
    return (
      <div style={{ maxWidth: 400, margin: '0 auto', padding: 24 }}>
        <h1>SehatPlate</h1>
        <pre>{health ? JSON.stringify(health, null, 2) : 'Loading health...'}</pre>
        <h2>Welcome</h2>
        <pre>{JSON.stringify(user, null, 2)}</pre>
        {user.totp_enabled ? (
          <p>2FA is enabled</p>
        ) : (
          <div>
            <button onClick={handleEnable2fa} disabled={loading}>
              {loading ? 'Loading...' : 'Enable 2FA'}
            </button>
            {setupData && (
              <div style={{ marginTop: 16 }}>
                {qrDataUrl && <img src={qrDataUrl} alt="2FA QR code" style={{ maxWidth: '100%' }} />}
                <p><strong>Secret:</strong> {setupData.secret}</p>
                <p style={{ color: 'red' }}>Save these now. They are shown only once.</p>
                <ul>
                  {setupData.recovery_codes.map((code, idx) => (
                    <li key={idx}><code>{code}</code></li>
                  ))}
                </ul>
                <form onSubmit={handleVerify2fa}>
                  <label>
                    6-digit code
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={6}
                      value={verifyCode}
                      onChange={(e) => setVerifyCode(e.target.value)}
                      required
                      disabled={loading}
                    />
                  </label>
                  <button type="submit" disabled={loading}>
                    {loading ? 'Verifying...' : 'Verify'}
                  </button>
                </form>
              </div>
            )}
          </div>
        )}
        {error && <p style={{ color: 'red' }}>{error}</p>}
        <button onClick={handleLogout}>Logout</button>
      </div>
    );
  }

  if (tempToken) {
    return (
      <div style={{ maxWidth: 400, margin: '0 auto', padding: 24 }}>
        <h1>SehatPlate</h1>
        <h2>Two-Factor Authentication</h2>
        {error && <p style={{ color: 'red' }}>{error}</p>}
        <form onSubmit={handle2faSubmit}>
          <label>
            {useRecovery ? 'Recovery code' : '6-digit code'}
            <input
              type="text"
              inputMode={useRecovery ? 'text' : 'numeric'}
              pattern={useRecovery ? undefined : '[0-9]*'}
              maxLength={useRecovery ? undefined : 6}
              value={twoFactorCode}
              onChange={(e) => setTwoFactorCode(e.target.value)}
              required
              disabled={loading}
            />
          </label>
          <button type="submit" disabled={loading}>
            {loading ? 'Verifying...' : 'Verify'}
          </button>
        </form>
        <p>
          <button type="button" onClick={() => setUseRecovery((prev) => !prev)} disabled={loading}>
            {useRecovery ? 'Use a TOTP code instead' : 'Use a recovery code instead'}
          </button>
        </p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 400, margin: '0 auto', padding: 24 }}>
      <h1>SehatPlate</h1>
      <pre>{health ? JSON.stringify(health, null, 2) : 'Loading health...'}</pre>
      <form onSubmit={handleSubmit}>
        <h2>{isLogin ? 'Login' : 'Register'}</h2>
        {error && <p style={{ color: 'red' }}>{error}</p>}
        <div>
          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
            />
          </label>
        </div>
        <div>
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              disabled={loading}
            />
          </label>
        </div>
        <button type="submit" disabled={loading}>
          {loading ? 'Loading...' : isLogin ? 'Login' : 'Register'}
        </button>
        <p>
          {isLogin ? "Don't have an account?" : 'Already have an account?'}{' '}
          <button type="button" onClick={toggleMode} disabled={loading}>
            {isLogin ? 'Register' : 'Login'}
          </button>
        </p>
      </form>
    </div>
  );
}
