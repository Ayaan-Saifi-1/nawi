import React from 'react';
import { useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/useAuthStore.js';
import './Footer.css';

export default function Footer() {
  const { pathname } = useLocation();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  if (pathname === '/login') return null;
  const hasSidebar = isAuthenticated;

  return (
    <footer className={`gov-footer ${hasSidebar ? '' : 'gov-footer-full'}`}>
      <p>
        <span>© {new Date().getFullYear()}</span>
        <span>ASCENSION</span>
        <span>All rights reserved.</span>
      </p>
    </footer>
  );
}
