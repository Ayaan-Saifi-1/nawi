import React, { useState } from 'react';
import { getExportData } from '../../services/admin.service.js';
import { Download, FileSpreadsheet, Calendar, RefreshCw } from 'lucide-react';
import { useNotificationStore } from '../../store/useNotificationStore.js';
import { useTranslation } from '../../config/i18n.js';

export default function ExportPage() {
  const addToast = useNotificationStore((s) => s.addToast);
  const { t } = useTranslation();
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(false);

  const handleExport = async (format) => {
    setLoading(true);
    try {
      const res = await getExportData({ startDate, endDate, format });
      const exportData = res?.data || res;
      let blob;
      let contentType;

      if (format === 'csv') {
        // Convert JSON array to real CSV
        const rows = Array.isArray(exportData) ? exportData : [];
        if (rows.length === 0) {
          addToast({ type: 'warn', message: 'No data to export for the selected range' });
          return;
        }
        const headers = Object.keys(rows[0]);
        const csvLines = [
          headers.join(','),
          ...rows.map((row) =>
            headers.map((h) => {
              const val = row[h] ?? '';
              // Escape values containing commas, quotes, or newlines
              const str = String(val);
              return str.includes(',') || str.includes('"') || str.includes('\n')
                ? `"${str.replace(/"/g, '""')}"`
                : str;
            }).join(',')
          ),
        ];
        blob = new Blob([csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' });
        contentType = 'csv';
      } else {
        blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        contentType = 'json';
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `nawi_export_${new Date().toISOString().slice(0,10)}.${contentType}`;
      a.click();
      URL.revokeObjectURL(url);
      addToast({ type: 'success', message: `Export file downloaded (${format.toUpperCase()})` });
    } catch {
      // Handled by apiClient
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 700 }}>
      <div className="page-header">
        <div>
          <h1><Download size={22} style={{ marginRight: 8, verticalAlign: -3 }} />{t('export_title')}</h1>
          <p className="page-header-subtitle">{t('page_subtitle_export')}</p>
        </div>
      </div>

      <div className="gov-card">
        <div className="gov-card-header">
          <h4>{t('export_parameters')}</h4>
        </div>
        <div className="gov-card-body">
          <div className="responsive-form-grid export-date-grid" style={{ marginBottom: 20 }}>
            <div className="gov-form-group">
              <label className="gov-label" htmlFor="export-start-date"><Calendar size={14} style={{ marginRight: 4, verticalAlign: -2 }} /> {t('start_date')}</label>
              <input id="export-start-date" className="gov-input" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="gov-form-group">
              <label className="gov-label" htmlFor="export-end-date"><Calendar size={14} style={{ marginRight: 4, verticalAlign: -2 }} /> {t('end_date')}</label>
              <input id="export-end-date" className="gov-input" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>

          <div className="flex-gap-8">
            <button className="gov-btn gov-btn-primary" onClick={() => handleExport('json')} disabled={loading}>
              <Download size={14} /> {loading ? 'Exporting...' : t('export_json')}
            </button>
            <button className="gov-btn gov-btn-outline" onClick={() => handleExport('csv')} disabled={loading}>
              <FileSpreadsheet size={14} /> {t('export_csv')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
