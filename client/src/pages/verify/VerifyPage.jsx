import React, { useState, useEffect } from 'react';
import { useSearchParams, useParams, useNavigate, Link } from 'react-router-dom';
import {
  lookupPublicReportsByInstrumentDetails,
  lookupPublicReportsBySerialNumber,
  verifyReport,
} from '../../services/report.service.js';
import StatusBadge from '../../components/common/StatusBadge.jsx';
import { useTranslation } from '../../config/i18n.js';
import { ShieldCheck, Search, AlertCircle, CheckCircle2 } from 'lucide-react';
import './VerifyPage.css';

export default function VerifyPage() {
  const [searchParams] = useSearchParams();
  const [query, setQuery] = useState(
    searchParams.get('hash') || searchParams.get('id') || searchParams.get('q') || ''
  );
  const { reportNumberOrHash } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [networkError, setNetworkError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [lookupBySerial, setLookupBySerial] = useState(false);
  const [lookupByDetails, setLookupByDetails] = useState(false);
  const [testYear, setTestYear] = useState('');
  const [lookupReports, setLookupReports] = useState([]);
  const [lookupHasMore, setLookupHasMore] = useState(false);
  const [lookupError, setLookupError] = useState(null);
  const [lookupAttempted, setLookupAttempted] = useState(false);

  const handleVerify = async (qToUse) => {
    const target = qToUse || query;
    if (!target.trim()) return;
    setLoading(true);
    setError(null);
    setNetworkError(null);
    setResult(null);
    try {
      const res = await verifyReport(target.trim());
      setResult(res.data || res);
    } catch (err) {
      if (err.response?.status === 404) {
        setError('No published report matches this number or hash. If you have just received the report, it may not be published yet.');
      } else {
        setNetworkError(err.response?.data?.error?.message || 'Unable to contact the verification service. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSerialLookup = async () => {
    const serialNumber = query.trim();
    if (!serialNumber) return;
    setLoading(true);
    setError(null);
    setNetworkError(null);
    setResult(null);
    setLookupError(null);
    setLookupReports([]);
    setLookupHasMore(false);
    setLookupAttempted(true);
    try {
      const response = await lookupPublicReportsBySerialNumber(serialNumber);
      const data = response?.data || response;
      setLookupReports(data?.reports || []);
      setLookupHasMore(Boolean(data?.hasMore));
    } catch (err) {
      if (err.response?.status === 400) {
        setLookupError(t('verify_serial_invalid'));
      } else {
        setLookupError(err.response?.data?.error?.message || t('verify_lookup_failed'));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDetailsLookup = async () => {
    const searchTerm = query.trim();
    if (searchTerm.length < 2) {
      setLookupError(t('verify_details_invalid'));
      setLookupAttempted(false);
      return;
    }
    setLoading(true);
    setError(null);
    setNetworkError(null);
    setResult(null);
    setLookupError(null);
    setLookupReports([]);
    setLookupHasMore(false);
    setLookupAttempted(true);
    try {
      const response = await lookupPublicReportsByInstrumentDetails(searchTerm, testYear);
      const data = response?.data || response;
      setLookupReports(data?.reports || []);
      setLookupHasMore(Boolean(data?.hasMore));
    } catch (err) {
      setLookupError(err.response?.status === 400
        ? t('verify_details_invalid')
        : err.response?.data?.error?.message || t('verify_lookup_failed'));
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => (lookupByDetails
    ? handleDetailsLookup()
    : lookupBySerial ? handleSerialLookup() : handleVerify());

  const integrityFailed = !result?.isIntegrityVerified;
  const isCurrentPublished = result?.isPublished && !result?.isSuperseded;
  const resultColor = integrityFailed || result?.isRevoked || result?.isSuperseded
    ? 'var(--gov-red)'
    : isCurrentPublished ? 'var(--gov-green)' : 'var(--gov-orange)';

  useEffect(() => {
    const deepLinkQuery = reportNumberOrHash || query;
    if (deepLinkQuery) {
      setQuery(deepLinkQuery);
      handleVerify(deepLinkQuery);
    }
  }, [reportNumberOrHash]);

  return (
    <div style={{ maxWidth: 800 }}>
      <div className="page-header">
        <div>
          <h1><ShieldCheck size={22} style={{ marginRight: 8, verticalAlign: -3 }} />{t('verify_portal')}</h1>
          <p className="page-header-subtitle">{t('page_subtitle_verify')}</p>
        </div>
      </div>

      {/* Search box */}
      <div className="gov-card mb-24">
        <div className="gov-card-body">
          <div className="verify-search-modes" role="group" aria-label={t('verify_search_method')}>
            <button
              type="button"
              className={`gov-btn ${lookupBySerial ? 'gov-btn-outline' : 'gov-btn-primary'}`}
              aria-pressed={!lookupBySerial}
              onClick={() => {
                setLookupBySerial(false);
                setLookupByDetails(false);
                setQuery('');
                setTestYear('');
                setLookupReports([]);
                setLookupError(null);
                setLookupAttempted(false);
                setResult(null);
                setError(null);
                setNetworkError(null);
              }}
            >
              {t('verify_by_report_id')}
            </button>
            <button
              type="button"
              className={`gov-btn ${lookupBySerial ? 'gov-btn-primary' : 'gov-btn-outline'}`}
              aria-pressed={lookupBySerial}
              onClick={() => {
                setLookupBySerial(true);
                setLookupByDetails(false);
                setQuery('');
                setTestYear('');
                setResult(null);
                setError(null);
                setNetworkError(null);
                setLookupReports([]);
                setLookupAttempted(false);
              }}
            >
              {t('verify_by_serial')}
            </button>
            <button
              type="button"
              className={`gov-btn ${lookupByDetails ? 'gov-btn-primary' : 'gov-btn-outline'}`}
              aria-pressed={lookupByDetails}
              onClick={() => {
                setLookupBySerial(false);
                setLookupByDetails(true);
                setQuery('');
                setTestYear('');
                setResult(null);
                setError(null);
                setNetworkError(null);
                setLookupReports([]);
                setLookupError(null);
                setLookupAttempted(false);
              }}
            >
              {t('verify_by_details')}
            </button>
          </div>
          <div className="gov-form-group">
            <label className="gov-label" htmlFor="verify-query">
              {lookupByDetails ? t('verify_details_input') : lookupBySerial ? t('verify_serial_input') : t('verify_input')}
            </label>
            {(lookupBySerial || lookupByDetails) && (
              <p className="verify-search-help">
                {t(lookupByDetails ? 'verify_details_help' : 'verify_serial_help')}
              </p>
            )}
            <div className="verify-search-row">
              <input
                id="verify-query" className="gov-input"
                style={{ flex: 1 }}
                placeholder={lookupByDetails
                  ? t('verify_details_placeholder')
                  : lookupBySerial ? t('verify_serial_placeholder') : 'e.g. NAWI-2026-000001 or 7f8a9b...'}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
              <button
                className="gov-btn gov-btn-accent"
                onClick={handleSearch}
                disabled={loading || !query.trim() || (lookupByDetails && query.trim().length < 2)}
              >
                <Search size={16} /> {loading ? t('verifying') : lookupBySerial || lookupByDetails ? t('find_reports') : t('verify_button')}
              </button>
            </div>
            {lookupByDetails && (
              <div className="verify-year-filter">
                <label className="gov-label" htmlFor="verify-test-year">{t('verify_test_year')}</label>
                <input
                  id="verify-test-year"
                  className="gov-input"
                  type="number"
                  min="1900"
                  max="2100"
                  step="1"
                  inputMode="numeric"
                  value={testYear}
                  onChange={(event) => setTestYear(event.target.value)}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {lookupError && (
        <div className="gov-card mb-24 verify-message-error" role="alert">
          <div className="gov-card-body flex-gap-8">
            <AlertCircle size={20} />
            <p>{lookupError}</p>
          </div>
        </div>
      )}

      {lookupReports.length > 0 && (
        <section className="gov-card mb-24" aria-label={t('verify_lookup_results')}>
          <div className="gov-card-header verify-results-header">
            <div>
              <h3>{t('verify_lookup_results')}</h3>
              <p>{t('verify_lookup_results_help')}</p>
            </div>
            <span className="verify-result-count">{lookupReports.length}{lookupHasMore ? '+' : ''}</span>
          </div>
          <div className="gov-card-body verify-results-list">
            {lookupReports.map((report) => (
              <article className="verify-result-item" key={report.reportNumber}>
                <div className="verify-result-main">
                  <strong className="text-mono">{report.reportNumber}</strong>
                  <span>
                    {[report.manufacturerName, report.instrumentModelName].filter(Boolean).join(' · ')}
                    {` · Class ${report.accuracyClass} · ${report.overallResult}`}
                  </span>
                  <small>
                    {report.status === 'published' ? t('verify_published') : report.isSuperseded ? t('verify_superseded') : report.status}
                    {report.laboratoryName ? ` · ${report.laboratoryName}` : ''}
                    {(report.testDate || report.publishedAt)
                      ? ` · ${new Date(report.testDate || report.publishedAt).toLocaleDateString()}`
                      : ''}
                    {lookupBySerial && report.serialNumber ? ` · ${report.serialNumber}` : ''}
                  </small>
                </div>
                <Link className="gov-btn gov-btn-outline verify-result-action" to={`/verify/${encodeURIComponent(report.reportNumber)}`}>
                  {t('verify_button')}
                </Link>
              </article>
            ))}
            {lookupHasMore && <p className="verify-results-note">{t('verify_lookup_limit')}</p>}
          </div>
        </section>
      )}

      {lookupAttempted && lookupReports.length === 0 && !loading && !lookupError && (lookupBySerial || lookupByDetails) && (
        <div className="gov-card mb-24">
          <div className="gov-card-body text-muted">
            {t(lookupByDetails ? 'verify_no_details_matches' : 'verify_no_serial_matches')}
          </div>
        </div>
      )}

      {/* Error state */}
      {(error || networkError) && (
        <div className="gov-card mb-24" style={{ borderColor: networkError ? 'var(--gov-red)' : 'var(--gov-border)' }}>
          <div className="gov-card-body flex-gap-8" style={{ color: networkError ? 'var(--gov-red)' : 'var(--gov-text-body)' }}>
            <AlertCircle size={20} />
            <div>
              <strong>{networkError ? 'Verification service unavailable' : 'No published report found'}</strong>
              <p style={{ fontSize: 13, marginTop: 2 }}>{networkError || error}</p>
              <button type="button" className="gov-btn gov-btn-outline" style={{ marginTop: 8 }} onClick={() => navigate('/verify')}>Back to verification</button>
            </div>
          </div>
        </div>
      )}

      {/* Verification Result */}
      {result && (
        <div className="gov-card">
          <div className="gov-card-header" style={{ background: resultColor === 'var(--gov-red)' ? 'var(--gov-red-light)' : resultColor === 'var(--gov-green)' ? 'var(--gov-green-light)' : 'var(--gov-orange-light, #fff4e5)' }}>
            <div className="flex-gap-8">
              <CheckCircle2 size={20} color={resultColor} />
              <h3 style={{ color: resultColor }}>
                {result.isRevoked ? 'Report REVOKED' : result.isSuperseded ? 'Report SUPERSEDED' : integrityFailed ? 'Report integrity could not be verified' : isCurrentPublished ? 'Published report verified' : 'Report is not currently published'}
              </h3>
            </div>
            <StatusBadge status={result.overallVerdict || result.status} />
          </div>

          <div className="gov-card-body">
            {result.isRevoked && (
              <div className="gov-card mb-16" style={{ background: 'var(--gov-red-light)', border: '1px solid var(--gov-red)', color: 'var(--gov-red)', padding: 12 }}>
                <strong>{result.revocationReason || result.revocationNotice || 'WARNING: This report has been REVOKED'}</strong>
              </div>
            )}
            {result.isSuperseded && (
              <div className="gov-card mb-16" style={{ background: 'var(--gov-red-light)', border: '1px solid var(--gov-red)', color: 'var(--gov-red)', padding: 12 }}>
                This report has been superseded by {result.supersededByReportNumber ? <Link to={`/verify/${encodeURIComponent(result.supersededByReportNumber)}`}>{result.supersededByReportNumber}</Link> : 'a newer report'} and should not be used as the current certificate.
              </div>
            )}
            {!result.isRevoked && !result.isSuperseded && !result.isPublished && (
              <div className="gov-card mb-16" style={{ background: 'var(--gov-orange-light, #fff4e5)', padding: 12 }}>
                Integrity verification alone does not make a report official. Current status: <strong>{result.status}</strong>.
              </div>
            )}
            {result.isPublished && !result.isSuperseded && (
              <div className="gov-card mb-16" style={{ background: 'var(--gov-green-light)', padding: 12 }}>
                Published {result.publishedAt ? `on ${new Date(result.publishedAt).toLocaleString()}` : ''}.
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, fontSize: 14 }}>
              <div><span className="text-muted" style={{ fontSize: 12 }}>Report Number</span><br /><strong className="text-mono">{result.reportNumber || result._id}</strong></div>
              <div><span className="text-muted" style={{ fontSize: 12 }}>PDF integrity</span><br /><strong>{result.isIntegrityVerified ? 'Verified' : 'Could not verify stored PDF'}</strong></div>
              <div><span className="text-muted" style={{ fontSize: 12 }}>Published</span><br /><strong>{result.isPublished ? 'Yes' : 'No'}</strong></div>
              <div><span className="text-muted" style={{ fontSize: 12 }}>Digital signature</span><br /><strong>{result.isDigitalSignatureVerified ? 'Verified' : 'Not verified'}</strong></div>
              <div><span className="text-muted" style={{ fontSize: 12 }}>Signature type</span><br /><strong>{result.signatureType || '-'}</strong></div>
              <div><span className="text-muted" style={{ fontSize: 12 }}>Certificate fingerprint</span><br /><strong className="text-mono">{result.certificateFingerprint || '-'}</strong></div>
              <div><span className="text-muted" style={{ fontSize: 12 }}>Signer key ID</span><br /><strong className="text-mono">{result.signerKeyId || '-'}</strong></div>
              <div><span className="text-muted" style={{ fontSize: 12 }}>Overall result</span><br /><strong>{result.overallResult || result.overallVerdict || '-'}</strong></div>
              <div><span className="text-muted" style={{ fontSize: 12 }}>Accuracy Class</span><br /><strong>Class {result.accuracyClass || result.testSessionId?.accuracyClass || '—'}</strong></div>
              <div><span className="text-muted" style={{ fontSize: 12 }}>Serial Number</span><br /><strong className="text-mono">{result.serialNumber || result.testSessionId?.serialNumber || '—'}</strong></div>
              <div style={{ gridColumn: '1 / -1' }}>
                <span className="text-muted" style={{ fontSize: 12 }}>SHA-256 Document Hash</span><br />
                <code className="text-mono" style={{ fontSize: 12, wordBreak: 'break-all', background: 'var(--gov-bg-page)', padding: '6px 10px', borderRadius: 4, display: 'block', marginTop: 4 }}>
                  {result.contentHash || 'No stored PDF hash'}
                </code>
              </div>
              <p style={{ gridColumn: '1 / -1' }}>The stored HMAC is an integrity check and does not provide a PKI-based digital signature or independent legal signer verification.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
