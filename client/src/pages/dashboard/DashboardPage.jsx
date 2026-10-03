import React, { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getDashboardStats } from '../../services/admin.service.js';
import { useAuthStore } from '../../store/useAuthStore.js';
import { useTranslation } from '../../config/i18n.js';
const ThreeDBarChart = lazy(() => import('./ThreeDBarChart.jsx'));
const ThreeDDonutChart = lazy(() => import('./ThreeDDonutChart.jsx'));
import {
  AlertTriangle, ArrowRight, CalendarDays, CheckCircle2, ChevronDown, CircleX, Clock3,
  FileCheck2, FileText, Play, RotateCcw, ShieldCheck, Users,
} from 'lucide-react';
import './DashboardPage.css';

function Deferred3DChart({ className = '', children }) {
  const slotRef = useRef(null);
  const [isNearViewport, setIsNearViewport] = useState(false);

  useEffect(() => {
    const slot = slotRef.current;
    if (!slot) return undefined;
    if (!('IntersectionObserver' in window)) {
      setIsNearViewport(true);
      return undefined;
    }

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setIsNearViewport(true);
        observer.disconnect();
      }
    }, { rootMargin: '240px 0px' });
    observer.observe(slot);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={slotRef} className={`dashboard-3d-chart-slot ${className}`}>
      {isNearViewport ? (
        <Suspense fallback={<div className="dashboard-3d-chart-placeholder" aria-hidden="true" />}>
          {children}
        </Suspense>
      ) : <div className="dashboard-3d-chart-placeholder" aria-hidden="true" />}
    </div>
  );
}

const STATUS_CONFIG = {
  draft: { label: 'Draft', color: '#64748B' },
  submitted: { label: 'Submitted', color: '#D97706' },
  under_review: { label: 'Under Review', color: '#475569' },
  passed: { label: 'Passed', color: '#15803D' },
  failed: { label: 'Failed', color: '#DC2626' },
  report_generated: { label: 'Report Generated', color: '#7C3AED' },
  published: { label: 'Published', color: '#059669' },
};

function prepareChartData(data) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  return data.map((item) => ({
    l: item.name,
    v: item.value,
    p: total ? Math.round((item.value / total) * 100) : 0,
    color: item.color,
    key: item.key,
  }));
}

function piePoint(cx, cy, rx, ry, angle) {
  return { x: cx + rx * Math.cos(angle), y: cy + ry * Math.sin(angle) };
}

function pieSlicePath(cx, cy, rx, ry, startAngle, endAngle) {
  const start = piePoint(cx, cy, rx, ry, startAngle);
  const end = piePoint(cx, cy, rx, ry, endAngle);
  const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
  return `M ${cx} ${cy} L ${start.x} ${start.y} A ${rx} ${ry} 0 ${largeArc} 1 ${end.x} ${end.y} Z`;
}

function StatusPieChart({ data, emptyMessage, sessionUnit, chartLabel }) {
  const [hoveredKey, setHoveredKey] = useState(null);
  const [selectedKey, setSelectedKey] = useState(null);

  if (!data.length) {
    return (
      <div className="status-chart-empty">
        {emptyMessage}
      </div>
    );
  }

  const chartData = prepareChartData(data);
  const total = chartData.reduce((sum, item) => sum + item.v, 0);
  const cx = 140;
  const cy = 135;
  const rx = 112;
  const ry = 112;
  const activeKey = hoveredKey || selectedKey;
  const activeItem = chartData.find((item) => item.key === activeKey);
  let startAngle = -Math.PI / 2;
  const slices = chartData.map((item) => {
    const endAngle = startAngle + (item.v / total) * Math.PI * 2;
    const middleAngle = (startAngle + endAngle) / 2;
    const slice = {
      ...item,
      path: pieSlicePath(cx, cy, rx, ry, startAngle, endAngle),
      offset: { x: 5 * Math.cos(middleAngle), y: 5 * Math.sin(middleAngle) },
    };
    startAngle = endAngle;
    return slice;
  });

  return (
    <div className="status-pie-plot" aria-label={chartLabel}>
      <svg
        className="status-pie-svg"
        viewBox="0 0 280 270"
        role="img"
        aria-label={`${chartLabel}: ${total} ${sessionUnit}`}
      >
        {slices.map((slice) => (
          <path
            key={`${slice.key}-top`}
            d={slice.path}
            fill={slice.color}
            stroke={activeKey === slice.key ? '#0F172A' : '#fff'}
            strokeWidth={activeKey === slice.key ? '3' : '1.5'}
            strokeLinejoin="round"
            className={`status-pie-slice${activeKey && activeKey !== slice.key ? ' is-muted' : ''}${activeKey === slice.key ? ' is-active' : ''}`}
            transform={activeKey === slice.key ? `translate(${slice.offset.x} ${slice.offset.y})` : undefined}
            role="button"
            tabIndex={0}
            aria-label={`${slice.l}: ${slice.v} ${sessionUnit}, ${slice.p}%`}
            aria-pressed={selectedKey === slice.key}
            onPointerEnter={() => setHoveredKey(slice.key)}
            onPointerLeave={() => setHoveredKey(null)}
            onFocus={() => setHoveredKey(slice.key)}
            onBlur={() => setHoveredKey(null)}
            onClick={() => setSelectedKey((current) => current === slice.key ? null : slice.key)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                setSelectedKey((current) => current === slice.key ? null : slice.key);
              }
            }}
          />
        ))}
      </svg>

      <div className="status-pie-details">
        <div className="status-pie-total">
          {activeItem ? (
            <>
              <i
                className="status-pie-active-swatch"
                style={{ backgroundColor: activeItem.color }}
                aria-hidden="true"
              />
              <span className="status-pie-active-name">{activeItem.l}</span>
              <strong>{activeItem.v}</strong>
              <span>({activeItem.p}%)</span>
            </>
          ) : (
            <>
              <span>Total</span>
              <strong>{total}</strong>
              <span>{sessionUnit}</span>
            </>
          )}
        </div>

        <ul className="status-pie-legend" aria-label={`${chartLabel} legend`}>
          {chartData.map((item) => (
            <li
              key={item.key}
              className={`${activeKey && activeKey !== item.key ? 'is-muted' : ''}${activeKey === item.key ? ' is-active' : ''}`}
              style={{ '--status-color': item.color }}
            >
              <button
                type="button"
                className="status-pie-legend-button"
                aria-pressed={selectedKey === item.key}
                onPointerEnter={() => setHoveredKey(item.key)}
                onPointerLeave={() => setHoveredKey(null)}
                onFocus={() => setHoveredKey(item.key)}
                onBlur={() => setHoveredKey(null)}
                onClick={() => setSelectedKey((current) => current === item.key ? null : item.key)}
              >
                <i style={{ backgroundColor: item.color }} aria-hidden="true" />
                <span className="status-pie-legend-name">{item.l}</span>
                <strong>{item.v}</strong>
                <small>{item.p}%</small>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function shadeHex(hex, factor = 0.62) {
  const value = String(hex).replace('#', '');
  if (value.length !== 6) return hex;
  const channels = [0, 2, 4].map((offset) => Math.round(parseInt(value.slice(offset, offset + 2), 16) * factor));
  return `#${channels.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
}

function StatusDonutChart({ data, total, emptyMessage }) {
  const [activeKey, setActiveKey] = useState(null);
  const radius = 57;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  const segments = data.map((item) => {
    const length = total ? (item.value / total) * circumference : 0;
    const segment = {
      ...item,
      length,
      offset,
      midAngle: ((offset + (length / 2)) / circumference) * Math.PI * 2 - Math.PI / 2,
    };
    offset += length;
    return segment;
  });
  const active = segments.find((item) => item.key === activeKey);

  if (!data.length || !total) return <div className="evaluation-empty">{emptyMessage}</div>;

  return (
    <div className="evaluation-donut-wrap">
      <div className="evaluation-donut-graphic">
        <svg viewBox="0 0 150 150" role="img" aria-label={`Open evaluation status: ${total} evaluations`}>
          <circle cx="75" cy="75" r={radius} fill="none" stroke="#26334D" strokeWidth="24" />
          {Array.from({ length: 8 }, (_, layer) => (
            <g key={`donut-depth-${layer}`} className="evaluation-donut-depth" aria-hidden="true">
              {segments.map((segment) => (
                <circle
                  key={`${segment.key}-depth-${layer}`}
                  cx="75"
                  cy="75"
                  r={radius}
                  fill="none"
                  stroke={shadeHex(segment.color, 0.5)}
                  strokeWidth="24"
                  strokeDasharray={`${segment.length} ${circumference - segment.length}`}
                  strokeDashoffset={-segment.offset}
                  transform={`translate(0 ${8 - layer}) rotate(-90 75 75)`}
                />
              ))}
            </g>
          ))}
          {segments.map((segment) => (
            <circle
              key={segment.key}
              cx="75"
              cy="75"
              r={radius}
              fill="none"
              stroke={segment.color}
              strokeWidth={activeKey === segment.key ? 27 : 24}
              strokeDasharray={`${segment.length} ${circumference - segment.length}`}
              strokeDashoffset={-segment.offset}
              transform={activeKey === segment.key
                ? `translate(${Math.cos(segment.midAngle) * 5} ${Math.sin(segment.midAngle) * 5}) rotate(-90 75 75)`
                : 'rotate(-90 75 75)'}
              className="evaluation-donut-segment"
              tabIndex={0}
              role="button"
              aria-label={`${segment.label}: ${segment.value}`}
              onMouseEnter={() => setActiveKey(segment.key)}
              onMouseLeave={() => setActiveKey(null)}
              onFocus={() => setActiveKey(segment.key)}
              onBlur={() => setActiveKey(null)}
              onClick={() => setActiveKey((current) => current === segment.key ? null : segment.key)}
            />
          ))}
        </svg>
        <div className="evaluation-donut-center">
          <strong>{active?.value ?? total}</strong>
          <span>{active?.label ?? 'Open'}</span>
        </div>
      </div>
      <div className="evaluation-donut-legend">
        {segments.map((segment) => (
          <button key={segment.key} type="button" onClick={() => setActiveKey((current) => current === segment.key ? null : segment.key)}>
            <i style={{ backgroundColor: segment.color }} aria-hidden="true" />
            <span>{segment.label}</span>
            <strong>{segment.value}</strong>
          </button>
        ))}
      </div>
    </div>
  );
}

function AnimatedMetric({ value, isLoading, className = '' }) {
  const numericValue = Number(value) || 0;
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    if (isLoading) return undefined;
    const duration = 680;
    const startedAt = performance.now();
    let frame;
    const tick = (now) => {
      const progress = Math.min(1, (now - startedAt) / duration);
      const eased = 1 - ((1 - progress) ** 3);
      setDisplayValue(Math.round(numericValue * eased));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [numericValue, isLoading]);

  return <strong className={className}>{isLoading ? '—' : displayValue}</strong>;
}

function EvaluationDashboard({ stats, isLoading, t }) {
  const [dateRange, setDateRange] = useState('Jan - Sep 2026');
  const [labFilter, setLabFilter] = useState('All Labs');
  const [classFilter, setClassFilter] = useState('All Classes');
  const breakdown = stats?.statusBreakdown || {};
  const openEvaluations = (breakdown.draft || 0) + (breakdown.submitted || 0) + (breakdown.under_review || 0);
  const awaitingReview = breakdown.under_review || 0;
  const reportsIssued = stats?.totalReports || 0;
  const instrumentModels = stats?.totalInstruments || 0;
  const passed = stats?.passedCount || breakdown.passed || 0;
  const failed = stats?.failedCount || breakdown.failed || 0;
  const pending = Math.max(0, openEvaluations - awaitingReview);
  const monthlyData = stats?.monthlyTrend || [];
  const completion = openEvaluations ? Math.max(18, Math.min(94, Math.round(((passed + failed + awaitingReview) / openEvaluations) * 100))) : 0;
  const statusData = [
    { key: 'draft', label: 'Draft', value: breakdown.draft || 0, color: '#3B82F6' },
    { key: 'submitted', label: 'In Progress', value: breakdown.submitted || 0, color: '#22D3EE' },
    { key: 'under_review', label: 'Awaiting Review', value: awaitingReview, color: '#F59E0B' },
    { key: 'failed', label: 'Revision Requested', value: breakdown.failed || 0, color: '#A78BFA' },
  ].filter((item) => item.value > 0);

  const testPlan = [
    { label: 'Instrument Details', status: 'complete' },
    { label: 'Lab & Environmental Conditions', status: 'complete' },
    { label: 'Test Readings', status: passed ? 'complete' : 'pending', value: `${Math.min(18, passed + 8)} / 18` },
    { label: 'Reference Weights', status: failed ? 'complete' : 'pending', value: failed ? 'Valid' : 'Pending' },
    { label: 'Supporting Files', status: 'pending', value: '3 files' },
  ];

  return (
    <div className="evaluation-dashboard">
      <div className="evaluation-dashboard-header">
        <div>
          <h1>Evaluation Dashboard</h1>
          <p>Capture test data, check compliance and manage OIML R-76 reports.</p>
        </div>
        <div className="evaluation-toolbar">
          <label><CalendarDays size={15} /><select value={dateRange} onChange={(event) => setDateRange(event.target.value)}><option>Jan - Sep 2026</option><option>Apr - Sep 2026</option><option>Last 30 days</option></select><ChevronDown size={14} /></label>
          <label><select value={labFilter} onChange={(event) => setLabFilter(event.target.value)}><option>All Labs</option><option>NPL New Delhi</option><option>RRSL Bengaluru</option></select><ChevronDown size={14} /></label>
          <label><select value={classFilter} onChange={(event) => setClassFilter(event.target.value)}><option>All Classes</option><option>Class I</option><option>Class II</option><option>Class III</option></select><ChevronDown size={14} /></label>
          <Link className="evaluation-action-primary" to="/test-sessions/new"><Play size={15} />Start Evaluation</Link>
          <Link className="evaluation-action-secondary" to="/reports">Open Report Library <ArrowRight size={15} /></Link>
        </div>
      </div>

      <div className="evaluation-kpis">
        <div><span>Open Evaluations</span><AnimatedMetric value={openEvaluations} isLoading={isLoading} /></div>
        <div><span>Awaiting Review</span><AnimatedMetric value={awaitingReview} isLoading={isLoading} className="is-amber" /></div>
        <div><span>Reports Issued (2026)</span><AnimatedMetric value={reportsIssued} isLoading={isLoading} className="is-green" /></div>
        <div><span>Instrument Models</span><AnimatedMetric value={instrumentModels} isLoading={isLoading} /></div>
      </div>

      <div className="evaluation-dashboard-main-grid">
        <section className="evaluation-panel evaluation-plan-panel">
          <div className="evaluation-panel-heading"><div><h2>Instrument-Aware Test Plan</h2><p>Tests are selected based on the instrument profile and OIML R-76 requirements.</p></div><span className="evaluation-badge">EV-031</span></div>
          <div className="evaluation-slide-viewport"><div className="evaluation-slide-track"><div className="evaluation-slide">
          <div className="evaluation-plan-intro">
            <div className="evaluation-instrument-visual"><img src="/ps-300-platform-scale.png" alt="PS-300 platform scale" /><span>PS-300</span></div>
            <div className="evaluation-plan-summary"><h3>PS-300 Platform Scale</h3><div className="evaluation-tags"><span>Class III</span><span>Max 300 kg</span><span>e = d = 50 g</span><span>n = 6 000</span><span>Electronic</span></div><strong className="evaluation-progress-label"><i aria-hidden="true" />Evaluation in progress</strong><div className="evaluation-progress"><span><i style={{ width: `${completion}%`, '--progress-value': `${completion}%` }} /></span><b>{completion}%</b></div><ul>{testPlan.map((item) => <li key={item.label} className={`is-${item.status}`}><span>{item.status === 'complete' ? <CheckCircle2 size={16} /> : <Clock3 size={16} />}</span><label>{item.label}</label><strong>{item.value || (item.status === 'complete' ? 'Complete' : 'Pending')}</strong></li>)}</ul></div>
          </div>
          <div className="evaluation-test-list"><h3>Applicable tests <span>(resolved from instrument profile)</span></h3><div className="evaluation-test-columns"><ul><li className="is-failed">Weighing test <strong>Failed</strong></li><li className="is-done">Eccentricity <strong>Done</strong></li><li className="is-done">Repeatability <strong>Done</strong></li><li className="is-done">Discrimination <strong>Done</strong></li><li className="is-progress">Tare <strong>In progress</strong></li><li>Tilting <strong>Required (Class III)</strong></li></ul><ul><li>Power supply variation <strong>Pending</strong></li><li>Creep &amp; zero return <strong>Pending</strong></li><li>Span stability <strong>Pending</strong></li><li>Disturbances (EMC) <strong>Pending</strong></li><li>Damp heat <strong>Pending</strong></li><li>Endurance <strong>Not applicable</strong></li></ul></div></div>
          </div></div></div>
        </section>

        <section className="evaluation-panel evaluation-status-panel"><div className="evaluation-panel-heading"><div><h2>Open Evaluation Status</h2></div></div><Deferred3DChart className="dashboard-3d-chart-slot--donut"><ThreeDDonutChart data={statusData} total={openEvaluations} emptyMessage="No open evaluations" /></Deferred3DChart></section>
        <section className="evaluation-panel evaluation-alerts-panel"><div className="evaluation-panel-heading"><div><h2>Alerts</h2></div><span>{4} active alerts</span></div><ul className="evaluation-alert-list"><li className="is-warning"><AlertTriangle size={17} /><p><b>Weight W-117 (M1, 20 kg):</b><br />calibration certificate expires in 12 days.</p></li><li className="is-danger"><CircleX size={17} /><p><b>Weight W-052:</b> certificate expired — blocked from use.</p></li><li className="is-danger"><CircleX size={17} /><p><b>EV-031 cannot be approved:</b> 1 applicable test failed.</p></li><li className="is-success"><CheckCircle2 size={17} /><p><b>Reference weights verified:</b><br />all required calibration records are current.</p></li></ul></section>
        <section className="evaluation-panel evaluation-report-chart-panel"><div className="evaluation-panel-heading"><div><h2>Reports Issued by Month</h2><p>Hover over a column to view the month and report count.</p></div></div><Deferred3DChart className="dashboard-3d-chart-slot--report-bar"><ThreeDBarChart data={monthlyData} unit="reports issued" emptyMessage="No report trend data" /></Deferred3DChart></section>
      </div>

      <div className="evaluation-grid evaluation-grid-bottom">
        <section className="evaluation-panel evaluation-table-panel"><div className="evaluation-panel-heading"><div><h2>Review Queue</h2><p>Evaluations awaiting officer review.</p></div><Users size={21} /></div><table><thead><tr><th>Evaluation ID</th><th>Model</th><th>Lab</th><th>Assigned to</th><th>Waiting</th><th>Action</th></tr></thead><tbody><tr><td><b>EV-027</b></td><td>PS-300</td><td>Pune Lab</td><td>A. Iyer</td><td className="is-danger">1 day</td><td><Link to="/test-sessions">Review</Link></td></tr><tr><td><b>EV-026</b></td><td>PL-500</td><td>Bengaluru Lab</td><td>A. Iyer</td><td className="is-danger">3 days</td><td><Link to="/test-sessions">Review</Link></td></tr></tbody></table></section>
        <section className="evaluation-panel evaluation-table-panel"><div className="evaluation-panel-heading"><div><h2>Recent Reports</h2><p>Latest issued reports and exported files.</p></div><Link to="/reports">View all <ArrowRight size={14} /></Link></div><table><thead><tr><th>Report ID</th><th>Model</th><th>Result</th><th>Status</th><th>Rule set</th><th>Files</th></tr></thead><tbody><tr><td><b>RPT-038</b></td><td>PS-300</td><td className="is-green">● Pass</td><td>Issued</td><td>R 76-1:2006</td><td>PDF · DOCX</td></tr><tr><td><b>RPT-037</b></td><td>PL-500</td><td className="is-red">● Fail</td><td>Issued</td><td>R 76-1:2006</td><td>PDF · DOCX</td></tr><tr><td><b>RPT-036</b></td><td>AX-200</td><td className="is-green">● Pass</td><td>Locked</td><td>R 76-1:2006</td><td>PDF · DOCX</td></tr></tbody></table></section>
        <section className="evaluation-panel evaluation-replay-panel"><div className="evaluation-panel-heading"><div><h2>Rule-Versioned Report Replay</h2><p>Recreates the report from the original data under the recorded rule version.</p></div><RotateCcw size={21} /></div><div className="evaluation-replay-form"><label>Report<select><option>RPT-038</option><option>RPT-037</option></select></label><label>Rule set recorded<select><option>OIML R 76-1:2006 (rules v1.0)</option></select></label><button type="button"><Play size={15} />Replay report</button></div></section>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuthStore();
  const { t } = useTranslation();
  const role = user?.role;

  const { data: stats, isLoading, isError } = useQuery({
    queryKey: ['dashboard-stats', role],
    queryFn: getDashboardStats,
    select: (res) => res?.data || res,
    staleTime: 30_000,
  });

  const statusData = stats?.statusBreakdown
    ? Object.entries(stats.statusBreakdown)
        .map(([key, value]) => ({
          key,
          name: t(`status_${key}`, STATUS_CONFIG[key]?.label || key.replace(/_/g, ' ')),
          value: Number(value) || 0,
          color: STATUS_CONFIG[key]?.color || '#3F464F',
        }))
        .filter((item) => item.value > 0)
    : [];

  const monthlyData = stats?.monthlyTrend || [];

  if (isError) {
    return (
      <div className="gov-card">
        <div className="gov-card-body">Unable to load dashboard data. Please try again.</div>
      </div>
    );
  }

  // Role 1: MANUFACTURER REPRESENTATIVE DASHBOARD
  if (role === 'manufacturer') {
    return (
      <div className="dashboard-page">
        <div className="quick-actions-top-grid">
          <Link to="/test-sessions" className="quick-action-card">
            <span className="quick-action-title">{t('nav_test_sessions')}</span>
            <span className="quick-action-desc">Track and review submitted metrology verification sessions</span>
          </Link>
          <Link to="/instrument-models" className="quick-action-card">
            <span className="quick-action-title">{t('nav_instrument_models')}</span>
            <span className="quick-action-desc">View registered weighing instruments and metrological specs</span>
          </Link>
          <Link to="/reports" className="quick-action-card">
            <span className="quick-action-title">{t('nav_test_reports')}</span>
            <span className="quick-action-desc">Download signed and certified test certificates</span>
          </Link>
        </div>

        <div className="metric-grid">
          <div className="metric-card metric-card-accent-blue">
            <div className="metric-card-label">{t('instruments_registered')}</div>
            <div className="metric-card-value">{isLoading ? '...' : (stats?.totalInstruments ?? '—')}</div>
            <div className="metric-card-hint">Non-automatic weighing instruments</div>
          </div>
          <div className="metric-card metric-card-accent-amber">
            <div className="metric-card-label">{t('total_sessions')}</div>
            <div className="metric-card-value">{isLoading ? '...' : (stats?.totalSessions ?? '—')}</div>
            <div className="metric-card-hint">Total verification workflows</div>
          </div>
          <div className="metric-card metric-card-accent-green">
            <div className="metric-card-label">{t('reports_generated')}</div>
            <div className="metric-card-value">{isLoading ? '...' : (stats?.totalReports ?? '—')}</div>
            <div className="metric-card-hint">Certified compliance reports</div>
          </div>
        </div>

        <div className="dashboard-charts">
          <div className="gov-card chart-card three-d-chart-card">
            <div className="gov-card-header">
              <h4>{t('monthly_test_sessions')}</h4>
            </div>
            <div className="gov-card-body" style={{ minHeight: 300 }}>
              <Deferred3DChart className="dashboard-3d-chart-slot--bar"><ThreeDBarChart data={monthlyData} unit={t('session_count_unit')} emptyMessage={t('no_active_session_data')} /></Deferred3DChart>
            </div>
          </div>

          <div className="gov-card chart-card">
            <div className="gov-card-header">
              <h4>{t('session_status_breakdown')}</h4>
            </div>
            <div className="gov-card-body status-chart-body">
              <StatusPieChart
                data={statusData}
                emptyMessage={t('no_active_session_data')}
                sessionUnit={t('session_count_unit')}
                chartLabel={t('session_status_breakdown')}
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Role 2: LAB TECHNICIAN DASHBOARD
  if (role === 'lab_technician') {
    return (
      <div className="dashboard-page">
        <div className="quick-actions-top-grid">
          <Link to="/test-sessions/new" className="quick-action-card">
            <span className="quick-action-title">Launch guided testing for non-automatic weighing instrument</span>
            <span className="quick-action-desc">Initiate a new OIML R-76 verification workflow</span>
          </Link>
          <Link to="/test-sessions" className="quick-action-card">
            <span className="quick-action-title">{t('nav_test_sessions')}</span>
            <span className="quick-action-desc">Resume testing and enter procedure observations</span>
          </Link>
          <Link to="/instrument-models" className="quick-action-card">
            <span className="quick-action-title">{t('nav_instrument_models')}</span>
            <span className="quick-action-desc">Inspect instrument models, capacity (Max), and verification scale interval (e)</span>
          </Link>
        </div>

        <div className="metric-grid">
          <div className="metric-card metric-card-accent-blue">
            <div className="metric-card-label">{t('total_sessions')}</div>
            <div className="metric-card-value">{isLoading ? '...' : (stats?.totalSessions ?? '—')}</div>
            <div className="metric-card-hint">Total test sessions conducted</div>
          </div>
          <div className="metric-card metric-card-accent-amber">
            <div className="metric-card-label">Pending Observations</div>
            <div className="metric-card-value">{isLoading ? '...' : (stats?.statusBreakdown?.draft ?? '—')}</div>
            <div className="metric-card-hint">Sessions requiring observation entry</div>
          </div>
          <div className="metric-card metric-card-accent-green">
            <div className="metric-card-label">Under Review</div>
            <div className="metric-card-value">{isLoading ? '...' : (stats?.statusBreakdown?.under_review ?? '—')}</div>
            <div className="metric-card-hint">Awaiting officer verification</div>
          </div>
        </div>
      </div>
    );
  }

  return <EvaluationDashboard stats={stats} isLoading={isLoading} t={t} />;
}
