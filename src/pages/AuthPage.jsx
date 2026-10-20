import React, { useEffect, useState } from 'react';
import { getHealth, registerUser, loginUser, getMe, clearAccessToken } from '../api';

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [health, setHealth] = useState(null);
  const [user, setUser] = useState(null);

  useEffect(() => {
    getHealth().then(setHealth);
  }, []);

  const resetForm = () => {
    setError('');
    setUser(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setUser(null);

    try {
      if (isLogin) {
        await loginUser({ email, password });
      } else {
        await registerUser({ email, password });
      }
      const me = await getMe();
      setUser(me);
    } catch (err) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    clearAccessToken();
    setUser(null);
    setEmail('');
    setPassword('');
  };

  const toggleMode = () => {
    setIsLogin((prev) => !prev);
    resetForm();
  };

  return (
    <div style={{ maxWidth: 400, margin: '0 auto', padding: 24 }}>
      <h1>SehatPlate</h1>
      <pre>{health ? JSON.stringify(health, null, 2) : 'Loading health...'}</pre>

      {user ? (
        <div>
          <h2>Welcome</h2>
          <pre>{JSON.stringify(user, null, 2)}</pre>
          <button onClick={handleLogout}>Logout</button>
        </div>
      ) : (
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
      )}
    </div>
  );
}
