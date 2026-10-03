import React, { lazy, Suspense, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { useAuthStore } from '../../store/useAuthStore.js';
import { useThemeStore } from '../../store/useThemeStore.js';
import { login } from '../../services/auth.service.js';
import InPageNotice from '../../components/common/InPageNotice.jsx';
import { useTranslation } from '../../config/i18n.js';
import { Eye, EyeOff } from 'lucide-react';
import './LoginPage.css';

const BalanceModel = lazy(() => import('./BalanceModel.jsx'));
const demoAdminDefaults = import.meta.env.DEV || import.meta.env.VITE_ENABLE_DEMO_LOGIN === 'true';


export default function LoginPage() {
  const [email, setEmail] = useState(() => demoAdminDefaults ? 'admin@nawi.gov.in' : '');
  const [password, setPassword] = useState(() => demoAdminDefaults ? 'Password123!' : '');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loginError, setLoginError] = useState('');
  const setAuth = useAuthStore((s) => s.setAuth);
  const { language } = useThemeStore();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [showBalanceModel, setShowBalanceModel] = useState(false);

  useEffect(() => {
    const showModel = () => setShowBalanceModel(true);
    let idleHandle;
    let timeoutHandle;

    if ('requestIdleCallback' in window) {
      idleHandle = window.requestIdleCallback(showModel, { timeout: 1800 });
    } else {
      timeoutHandle = window.setTimeout(showModel, 900);
    }

    return () => {
      if (idleHandle !== undefined) window.cancelIdleCallback(idleHandle);
      if (timeoutHandle !== undefined) window.clearTimeout(timeoutHandle);
    };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoginError('');
    setLoading(true);
    try {
      const res = await login({ email, password });
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('nawi_manual_logout');
      }
      setAuth({ token: res.data.token, user: res.data.user });
      // Toasts disabled as requested
      navigate('/dashboard');
    } catch (error) {
      const status = error.response?.status;
      const serverMessage = error.response?.data?.error?.message;
      if (!error.response) {
        setLoginError('Unable to reach the sign-in service. Check that the server is running, then try again.');
      } else if (status === 401) {
        setLoginError('Email or password is incorrect. Please check your details and try again.');
      } else if (status >= 500) {
        setLoginError('The sign-in service is unavailable right now. Please try again later.');
      } else {
        setLoginError(serverMessage || `Sign-in was rejected (HTTP ${status}). Please check your details or contact your administrator.`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = async (demoEmail, demoPassword) => {
    setEmail(demoEmail);
    setPassword(demoPassword);
    setLoading(true);
    setLoginError('');
    try {
      const res = await login({ email: demoEmail, password: demoPassword });
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('nawi_manual_logout');
      }
      setAuth({ token: res.data.token, user: res.data.user });
      navigate('/dashboard');
    } catch (error) {
      const status = error.response?.status;
      const serverMessage = error.response?.data?.error?.message;
      if (!error.response) {
        setLoginError('Unable to reach the sign-in service. Check that the server is running, then try again.');
      } else if (status === 401) {
        setLoginError('Email or password is incorrect. Please check your details and try again.');
      } else if (status >= 500) {
        setLoginError('The sign-in service is unavailable right now. Please try again later.');
      } else {
        setLoginError(serverMessage || `Sign-in was rejected (HTTP ${status}).`);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-visual" aria-hidden="true">
        <div className="login-visual-glow" />
        {showBalanceModel && <Suspense fallback={null}><BalanceModel /></Suspense>}
      </div>
      <div className="login-card">
        <InPageNotice />
        <div className="login-brand">
          <img src="/ascension-card-logo.png" alt="Ascension" className="login-emblem" onError={(e) => { e.target.style.display = 'none'; }} />
          <h1>{language === 'HI' ? 'NAWI डिजिटल मापविज्ञान प्रणाली' : 'NAWI Digital Metrology System'}</h1>
          <p className="login-dept">
            {language === 'HI' ? 'टीम एसेंशन' : 'Team Ascension'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          {loginError && <div className="login-error" role="alert" aria-live="polite">{loginError}</div>}
          <div className="gov-form-group">
            <label className="gov-label" htmlFor="email">{t('login_email')}</label>
            <input
              id="email"
              data-testid="login-email"
              type="email"
              className="gov-input"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setLoginError(''); }}
              placeholder="admin@nawi.gov.in"
              required
              autoFocus
            />
          </div>

          <div className="gov-form-group">
            <label className="gov-label" htmlFor="password">{t('login_password')}</label>
            <div className="login-pw-wrap">
              <input
                id="password"
                data-testid="login-password"
                type={showPw ? 'text' : 'password'}
                className="gov-input"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setLoginError(''); }}
                placeholder="••••••••"
                required
              />
              <button type="button" aria-label={showPw ? 'Hide password' : 'Show password'} className="login-pw-toggle" onClick={() => setShowPw(!showPw)} tabIndex={-1}>
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button type="submit" data-testid="login-submit" className="gov-btn gov-btn-primary login-submit" disabled={loading}>
            {loading ? t('login_authenticating') : t('login_sign_in')}
          </button>
        </form>

        <div className="login-demo-creds">
          <p style={{ marginBottom: 8 }}><strong>{t('login_demo')}</strong></p>
          <div className="login-role-grid">
            <button type="button" className="gov-btn gov-btn-outline" style={{ fontSize: 11, padding: '4px 8px' }} onClick={() => handleQuickLogin('admin@nawi.gov.in', 'Password123!')}>
              Admin
            </button>
            <button type="button" className="gov-btn gov-btn-outline" style={{ fontSize: 11, padding: '4px 8px' }} onClick={() => handleQuickLogin('tech@npl.res.in', 'Password123!')}>
              Lab Tech
            </button>
            <button type="button" className="gov-btn gov-btn-outline" style={{ fontSize: 11, padding: '4px 8px' }} onClick={() => handleQuickLogin('reviewer@doca.gov.in', 'Password123!')}>
              Reviewer
            </button>
            <button type="button" className="gov-btn gov-btn-outline" style={{ fontSize: 11, padding: '4px 8px' }} onClick={() => handleQuickLogin('labadmin@npl.res.in', 'Password123!')}>
              Lab Admin
            </button>
            <button type="button" className="gov-btn gov-btn-outline" style={{ fontSize: 11, padding: '4px 8px' }} onClick={() => handleQuickLogin('officer@doca.gov.in', 'Password123!')}>
              DoCA Officer
            </button>
            <button type="button" className="gov-btn gov-btn-outline" style={{ fontSize: 11, padding: '4px 8px' }} onClick={() => handleQuickLogin('rep@averyindia.com', 'Password123!')}>
              Manufacturer
            </button>
            <button type="button" className="gov-btn gov-btn-outline" style={{ fontSize: 11, padding: '4px 8px' }} onClick={() => handleQuickLogin('auditor@nawi.gov.in', 'Password123!')}>
              Auditor
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
