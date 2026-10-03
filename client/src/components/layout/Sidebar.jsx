import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/useAuthStore.js';
import { useTranslation } from '../../config/i18n.js';
import './Sidebar.css';

const ALL_ROLES = ['admin', 'metrology_expert', 'reviewer', 'lab_technician', 'lab_admin', 'doca_officer', 'manufacturer', 'auditor'];

export default function Sidebar({ isMobileOpen, onCloseMobileMenu }) {
  const { user } = useAuthStore();
  const location = useLocation();
  const { t } = useTranslation();
  const role = user?.role || 'admin';

  const NAV_SECTIONS = [
    {
      title: 'CORE',
      items: [
        { to: '/dashboard', label: t('nav_dashboard'), roles: ALL_ROLES },
      ],
    },
    {
      title: 'METROLOGY TESTING',
      items: [
        { to: '/test-sessions', label: t('nav_test_sessions'), roles: ['admin', 'reviewer', 'lab_technician', 'lab_admin', 'doca_officer', 'manufacturer', 'auditor'] },
        { to: '/instrument-models', label: t('nav_instrument_models'), roles: ['admin', 'reviewer', 'lab_technician', 'lab_admin', 'doca_officer', 'manufacturer'] },
        { to: '/test-types', label: t('nav_test_procedures'), roles: ALL_ROLES },
      ],
    },
    {
      title: 'REGISTRY & GOVERNANCE',
      items: [
        { to: '/manufacturers', label: t('nav_manufacturers'), roles: ['admin', 'reviewer', 'lab_admin', 'doca_officer'] },
        { to: '/laboratories', label: t('nav_laboratories'), roles: ['admin', 'lab_admin', 'doca_officer'] },
        { to: '/verify', label: t('nav_public_verification'), roles: ALL_ROLES },
      ],
    },
    {
      title: 'COMPLIANCE & AUDIT',
      items: [
        { to: '/reports', label: t('nav_test_reports'), roles: ['admin', 'reviewer', 'lab_admin', 'doca_officer', 'auditor', 'manufacturer'] },
        { to: '/audit-log', label: t('nav_audit_trail'), roles: ['admin', 'reviewer', 'lab_admin', 'doca_officer', 'auditor'] },
        { to: '/export', label: t('nav_egov_export'), roles: ['admin', 'lab_admin', 'doca_officer', 'auditor'] },
        { to: '/rule-configs', label: t('nav_rule_configs'), roles: ['admin', 'metrology_expert', 'lab_admin', 'doca_officer', 'reviewer', 'auditor'] },
      ],
    },
    {
      title: 'ADMINISTRATION',
      items: [
        { to: '/users', label: t('nav_users'), roles: ['admin', 'lab_admin'] },
        { to: '/system-logs', label: t('nav_system_logs'), roles: ['admin', 'lab_admin', 'auditor'] },
      ],
    },
  ];

  return (
    <>
      {/* Mobile backdrop */}
      {isMobileOpen && (
        <div
          className="sidebar-backdrop"
          onClick={onCloseMobileMenu}
          aria-hidden="true"
        />
      )}

      <aside className={`sidebar ${isMobileOpen ? 'mobile-open' : ''}`}>
        <nav className="sidebar-nav" aria-label="Main navigation">
          {NAV_SECTIONS.map((section) => {
            const visibleSectionItems = section.items.filter(
              (item) => item.roles.includes(role) || role === 'admin'
            );
            if (visibleSectionItems.length === 0) return null;

            return (
              <div key={section.title} className="sidebar-section">
                <div className="sidebar-section-title">{section.title}</div>
                <div className="sidebar-section-items">
                  {visibleSectionItems.map((item) => {
                    const isActive = location.pathname.startsWith(item.to);
                    return (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        className={`sidebar-link ${isActive ? 'active' : ''}`}
                        onClick={onCloseMobileMenu}
                      >
                        <span className="sidebar-link-indicator" aria-hidden="true" />
                        <span className="sidebar-link-label">{item.label}</span>
                      </NavLink>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>
        <div className="sidebar-footer">
          <div className="sidebar-compliance-tag">OIML R-76/2006 · Legal Metrology</div>
          <div className="sidebar-version-tag">Production Build v2.4</div>
        </div>
      </aside>
    </>
  );
}