import React, { lazy, Suspense, useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from './store/useAuthStore.js';
import { useThemeStore } from './store/useThemeStore.js';
import { useNotificationStore } from './store/useNotificationStore.js';

import Header from './components/layout/Header.jsx';
import Sidebar from './components/layout/Sidebar.jsx';
import Footer from './components/layout/Footer.jsx';
import InPageNotice from './components/common/InPageNotice.jsx';
import { login } from './services/auth.service.js';

const LoginPage = lazy(() => import('./pages/auth/LoginPage.jsx'));
const DashboardPage = lazy(() => import('./pages/dashboard/DashboardPage.jsx'));
const TestSessionsPage = lazy(() => import('./pages/testSessions/TestSessionsPage.jsx'));
const NewTestSessionPage = lazy(() => import('./pages/testSessions/NewTestSessionPage.jsx'));
const TestSessionDetailPage = lazy(() => import('./pages/testSessions/TestSessionDetailPage.jsx'));
const OfflineSessionPage = lazy(() => import('./pages/testSessions/OfflineSessionPage.jsx'));
const InstrumentModelsPage = lazy(() => import('./pages/instrumentModels/InstrumentModelsPage.jsx'));
const InstrumentModelDetailPage = lazy(() => import('./pages/instrumentModels/InstrumentModelDetailPage.jsx'));
const ManufacturersPage = lazy(() => import('./pages/manufacturers/ManufacturersPage.jsx'));
const LaboratoriesPage = lazy(() => import('./pages/laboratories/LaboratoriesPage.jsx'));
const TestTypesPage = lazy(() => import('./pages/testTypes/TestTypesPage.jsx'));
const RuleConfigsPage = lazy(() => import('./pages/ruleConfigs/RuleConfigsPage.jsx'));
const ReportsPage = lazy(() => import('./pages/reports/ReportsPage.jsx'));
const AuditLogPage = lazy(() => import('./pages/auditLog/AuditLogPage.jsx'));
const ExportPage = lazy(() => import('./pages/export/ExportPage.jsx'));
const VerifyPage = lazy(() => import('./pages/verify/VerifyPage.jsx'));
const SystemLogsPage = lazy(() => import('./pages/systemLogs/SystemLogsPage.jsx'));
const UsersPage = lazy(() => import('./pages/users/UsersPage.jsx'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function RoleGuard({ allowedRoles, children }) {
  const { user } = useAuthStore();
  const addToast = useNotificationStore((s) => s.addToast);
  useEffect(() => {
    if (user?.role && user.role !== 'admin' && allowedRoles && !allowedRoles.includes(user.role)) {
      addToast({ type: 'error', message: 'You do not have permission to access this page.' });
    }
  }, [user?.role, allowedRoles, addToast]);
  if (!user || !user.role) {
    const isManualLogout = typeof window !== 'undefined' && sessionStorage.getItem('nawi_manual_logout') === 'true';
    if (isManualLogout) {
      return <Navigate to="/login" replace />;
    }
    return <Navigate to="/dashboard" replace />;
  }
  if (user.role !== 'admin' && allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }
  return children;
}

function LoginRouteGuard({ children }) {
  const { isAuthenticated } = useAuthStore();
  const isManualLogout = typeof window !== 'undefined' && sessionStorage.getItem('nawi_manual_logout') === 'true';

  if (isAuthenticated || !isManualLogout) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

function ProtectedLayout({ isMobileOpen, setIsMobileOpen, isSidebarCollapsed }) {
  const { isAuthenticated } = useAuthStore();
  const isManualLogout = typeof window !== 'undefined' && sessionStorage.getItem('nawi_manual_logout') === 'true';

  if (!isAuthenticated && isManualLogout) {
    return <Navigate to="/login" replace />;
  }

  if (!isAuthenticated) {
    return (
      <div
        className="app-route-loading"
        role="status"
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0f172a',
          color: '#94a3b8',
          gap: 12,
        }}
      >
        <div
          style={{
            width: 36,
            height: 36,
            border: '3px solid #334155',
            borderTopColor: '#38bdf8',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
          }}
        />
        <p style={{ margin: 0, fontSize: 14 }}>Loading Dashboard...</p>
      </div>
    );
  }

  return (
    <div className={`app-layout${isSidebarCollapsed ? ' sidebar-collapsed' : ''}`}>
      <Sidebar
        isMobileOpen={isMobileOpen}
        onCloseMobileMenu={() => setIsMobileOpen(false)}
      />
      <main id="main-content" className="app-main">
        <InPageNotice />
        <Outlet />
      </main>
    </div>
  );
}

function VerifyLayout({ isMobileOpen, setIsMobileOpen, isSidebarCollapsed, children }) {
  const { isAuthenticated } = useAuthStore();

  if (isAuthenticated) {
    return (
      <div className={`app-layout${isSidebarCollapsed ? ' sidebar-collapsed' : ''}`}>
        <Sidebar
          isMobileOpen={isMobileOpen}
          onCloseMobileMenu={() => setIsMobileOpen(false)}
        />
        <main id="main-content" className="app-main">
          <InPageNotice />
          {children}
        </main>
      </div>
    );
  }

  return (
    <div className="app-layout" style={{ paddingTop: 'calc(var(--topbar-height) + var(--header-height))' }}>
      <main id="main-content" className="app-main" style={{ marginLeft: 0, padding: '20px 16px' }}>
        {children}
      </main>
    </div>
  );
}

function AutoLoginHandler({ children }) {
  const { isAuthenticated, setAuth } = useAuthStore();
  const [checking, setChecking] = useState(() => {
    if (useAuthStore.getState().isAuthenticated) return false;
    if (typeof window !== 'undefined' && sessionStorage.getItem('nawi_manual_logout') === 'true') {
      return false;
    }
    return true;
  });

  useEffect(() => {
    if (isAuthenticated) {
      setChecking(false);
      return;
    }

    if (typeof window !== 'undefined' && sessionStorage.getItem('nawi_manual_logout') === 'true') {
      setChecking(false);
      return;
    }

    let isMounted = true;
    login({ email: 'admin@nawi.gov.in', password: 'Password123!' })
      .then((res) => {
        if (isMounted && res?.data?.token && res?.data?.user) {
          setAuth({ token: res.data.token, user: res.data.user });
        }
      })
      .catch((err) => {
        console.warn('Default admin auto-login:', err?.message);
      })
      .finally(() => {
        if (isMounted) setChecking(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isAuthenticated, setAuth]);

  if (checking) {
    return (
      <div
        className="app-route-loading"
        role="status"
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0f172a',
          color: '#94a3b8',
          gap: 12,
        }}
      >
        <div
          style={{
            width: 36,
            height: 36,
            border: '3px solid #334155',
            borderTopColor: '#38bdf8',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
          }}
        />
        <p style={{ margin: 0, fontSize: 14 }}>Connecting as Administrator...</p>
      </div>
    );
  }

  return children;
}

export default function App() {
  const { fontSizeStep, highContrast } = useThemeStore();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  useEffect(() => {
    document.documentElement.setAttribute('data-font-size', String(fontSizeStep));
    if (highContrast) {
      document.documentElement.setAttribute('data-theme', 'high-contrast');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  }, [fontSizeStep, highContrast]);

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AutoLoginHandler>
          <Header
            isMobileOpen={isMobileOpen}
            onToggleMobileMenu={() => setIsMobileOpen((prev) => !prev)}
            isSidebarCollapsed={isSidebarCollapsed}
            onToggleSidebar={() => setIsSidebarCollapsed((prev) => !prev)}
          />
          <Suspense fallback={<div className="app-route-loading" role="status">Loading page…</div>}>
          <Routes>
          <Route
            path="/login"
            element={
              <LoginRouteGuard>
                <LoginPage />
              </LoginRouteGuard>
            }
          />
          <Route
            path="/verify"
            element={
              <VerifyLayout isMobileOpen={isMobileOpen} setIsMobileOpen={setIsMobileOpen} isSidebarCollapsed={isSidebarCollapsed}>
                <VerifyPage />
              </VerifyLayout>
            }
          />
          <Route
            path="/verify/:reportNumberOrHash"
            element={
              <VerifyLayout isMobileOpen={isMobileOpen} setIsMobileOpen={setIsMobileOpen} isSidebarCollapsed={isSidebarCollapsed}>
                <VerifyPage />
              </VerifyLayout>
            }
          />

          <Route
            element={
              <ProtectedLayout
                isMobileOpen={isMobileOpen}
                setIsMobileOpen={setIsMobileOpen}
                isSidebarCollapsed={isSidebarCollapsed}
              />
            }
          >
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/test-sessions" element={<TestSessionsPage />} />
            <Route
              path="/test-sessions/new"
              element={
                <RoleGuard allowedRoles={['admin', 'lab_technician', 'lab_admin']}>
                  <NewTestSessionPage />
                </RoleGuard>
              }
            />
            <Route
              path="/test-sessions/offline/:clientId"
              element={
                <RoleGuard allowedRoles={['admin', 'lab_technician', 'lab_admin']}>
                  <OfflineSessionPage />
                </RoleGuard>
              }
            />
            <Route path="/test-sessions/:id" element={<TestSessionDetailPage />} />
            <Route path="/instrument-models" element={<InstrumentModelsPage />} />
            <Route path="/instrument-models/:id" element={<InstrumentModelDetailPage />} />
            <Route
              path="/manufacturers"
              element={
                <RoleGuard allowedRoles={['admin', 'reviewer', 'lab_admin', 'doca_officer']}>
                  <ManufacturersPage />
                </RoleGuard>
              }
            />
            <Route
              path="/laboratories"
              element={
                <RoleGuard allowedRoles={['admin', 'lab_admin', 'doca_officer']}>
                  <LaboratoriesPage />
                </RoleGuard>
              }
            />
            <Route path="/test-types" element={<TestTypesPage />} />
            <Route
              path="/rule-configs"
              element={
                <RoleGuard
                  allowedRoles={[
                    'admin',
                    'metrology_expert',
                    'lab_admin',
                    'doca_officer',
                    'reviewer',
                    'auditor',
                  ]}
                >
                  <RuleConfigsPage />
                </RoleGuard>
              }
            />
            <Route
              path="/reports"
              element={
                <RoleGuard
                  allowedRoles={[
                    'admin',
                    'reviewer',
                    'lab_admin',
                    'doca_officer',
                    'manufacturer',
                    'auditor',
                  ]}
                >
                  <ReportsPage />
                </RoleGuard>
              }
            />
            <Route
              path="/audit-log"
              element={
                <RoleGuard allowedRoles={['admin', 'reviewer', 'lab_admin', 'doca_officer', 'auditor']}>
                  <AuditLogPage />
                </RoleGuard>
              }
            />
            <Route
              path="/export"
              element={
                <RoleGuard allowedRoles={['admin', 'lab_admin', 'doca_officer', 'auditor']}>
                  <ExportPage />
                </RoleGuard>
              }
            />
            <Route
              path="/users"
              element={
                <RoleGuard allowedRoles={['admin', 'lab_admin']}>
                  <UsersPage />
                </RoleGuard>
              }
            />
            <Route
              path="/system-logs"
              element={
                <RoleGuard allowedRoles={['admin', 'lab_admin', 'auditor']}>
                  <SystemLogsPage />
                </RoleGuard>
              }
            />
          </Route>

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
        </Suspense>

        <Footer />
        </AutoLoginHandler>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
