import React from 'react';
import { useTranslation } from '../../config/i18n.js';

export default function StatusBadge({ status }) {
  const { t } = useTranslation();
  const s = (status || '').toLowerCase();
  const variant = s === 'integrity_tagged' ? 'info' : s === 'not evaluated' ? 'pending' : s;
  const label = s === 'integrity_tagged' ? 'Awaiting publication' : s === 'pass' ? t('status_pass') : s === 'fail' ? t('status_fail') : s === 'not evaluated' ? t('not_evaluated') : status;
  return <span className={`gov-badge gov-badge-${variant}`}>{label}</span>;
}
