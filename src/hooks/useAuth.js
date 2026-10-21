import { useState, useCallback } from 'react';
import {
  registerUser,
  loginUser,
  login2fa,
  setup2fa,
  verify2fa,
  getMe,
  clearAccessToken,
  getAccessToken,
} from '../api';

/**
 * useAuth — encapsulates all authentication state and actions.
 * AuthPage consumes this hook so UI stays declarative.
 */
export function useAuth() {
  const [user, setUser] = useState(null);
  const [tempToken, setTempToken] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const clearError = () => setError('');

  const formatError = (err) => {
    if (err.status === 429) return 'Too many attempts, try again later.';
    return err.message || 'Something went wrong.';
  };

  const loadMe = useCallback(async () => {
    const me = await getMe();
    setUser(me);
    return me;
  }, []);

  const register = useCallback(async ({ email, password }) => {
    setLoading(true);
    setError('');
    try {
      await registerUser({ email, password });
      // Auto-login after registration
      const data = await loginUser({ email, password });
      if (data.requires_2fa && data.temp_token) {
        setTempToken(data.temp_token);
        return { requires_2fa: true };
      }
      if (data.access_token) {
        await loadMe();
        return { success: true };
      }
      throw new Error('Unexpected response after registration');
    } catch (err) {
      setError(formatError(err));
      return { error: true };
    } finally {
      setLoading(false);
    }
  }, [loadMe]);

  const login = useCallback(async ({ email, password }) => {
    setLoading(true);
    setError('');
    try {
      const data = await loginUser({ email, password });
      if (data.requires_2fa && data.temp_token) {
        setTempToken(data.temp_token);
        return { requires_2fa: true };
      }
      if (data.access_token) {
        await loadMe();
        return { success: true };
      }
      throw new Error('Unexpected response from login');
    } catch (err) {
      setError(formatError(err));
      return { error: true };
    } finally {
      setLoading(false);
    }
  }, [loadMe]);

  const submitTwoFactor = useCallback(async ({ code, useRecovery }) => {
    setLoading(true);
    setError('');
    try {
      const payload = useRecovery
        ? { temp_token: tempToken, recovery_code: code }
        : { temp_token: tempToken, code };
      await login2fa(payload);
      setTempToken(null);
      await loadMe();
      return { success: true };
    } catch (err) {
      setError(formatError(err));
      return { error: true };
    } finally {
      setLoading(false);
    }
  }, [tempToken, loadMe]);

  const enable2fa = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await setup2fa();
      return { data };
    } catch (err) {
      setError(formatError(err));
      return { error: true };
    } finally {
      setLoading(false);
    }
  }, []);

  const confirmVerify2fa = useCallback(async (code) => {
    setLoading(true);
    setError('');
    try {
      await verify2fa(code);
      await loadMe();
      return { success: true };
    } catch (err) {
      setError(formatError(err));
      return { error: true };
    } finally {
      setLoading(false);
    }
  }, [loadMe]);

  const logout = useCallback(() => {
    clearAccessToken();
    setUser(null);
    setTempToken(null);
    setError('');
  }, []);

  return {
    user,
    setUser,
    tempToken,
    loading,
    error,
    clearError,
    register,
    login,
    submitTwoFactor,
    enable2fa,
    confirmVerify2fa,
    logout,
    isAuthenticated: !!getAccessToken(),
  };
}
