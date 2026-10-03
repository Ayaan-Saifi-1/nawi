import React from 'react';
import { useThemeStore } from '../../store/useThemeStore.js';
import './TopGovtBar.css';

export default function TopGovtBar() {
  const { language } = useThemeStore();

  return (
    <>
      <div className="tricolor-stripe" aria-hidden="true">
        <span className="tricolor-saffron" />
        <span className="tricolor-white" />
        <span className="tricolor-green" />
      </div>
      <div className="topbar">
        <div className="topbar-inner">
          <div className="topbar-left">
            <a href="#main-content" className="skip-link">Skip to main content</a>
            <span className="topbar-dept">
              {language === 'HI'
                ? 'भारत सरकार | उपभोक्ता मामले विभाग — विधिक मापविज्ञान प्रभाग'
                : 'Government of India | Dept. of Consumer Affairs — Legal Metrology Division'}
            </span>
          </div>
        </div>
      </div>
    </>
  );
}
