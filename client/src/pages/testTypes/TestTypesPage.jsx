import React from 'react';
import { useQuery } from '@tanstack/react-query';
import apiClient from '../../services/apiClient.js';
import { FlaskConical } from 'lucide-react';
import './TestTypesPage.css';

const PROCEDURES = [
  { code: 'T-A1-ADMIN', title: 'Administrative Examination', formula: 'Manual checklist', verification: 'Check required markings, inscriptions, documentation, and administrative requirements.', reference: 'A.1 · p. 85' },
  { code: 'T-A4-ACC', title: 'Accuracy', formula: 'Ec = E − E₀; E = I − L, or use the changeover-point correction below when applicable.', verification: 'At each test load, compare |Ec| with the applicable MPE for the instrument class, load band, and test stage.', reference: '3.5 · A.4.4.3 · pp. 30, 88' },
  { code: 'T-A4-DISC', title: 'Discrimination', formula: 'For digital indications, apply an additional load ΔL = 1.4d where applicable.', verification: 'The indication must increase by one scale interval under the prescribed additional load.', reference: '3.8 · A.4.8 · pp. 32, 91' },
  { code: 'T-A4-ECC', title: 'Eccentricity', formula: 'Ec = E − E₀; determine E as specified in A.4.4.3.', verification: 'At each eccentric load position, compare |Ec| with the applicable MPE for that load.', reference: '3.6.2 · A.4.7 · pp. 31, 90–91' },
  { code: 'T-A4-REP', title: 'Repeatability', formula: 'R = Imax − Imin.', verification: 'Compare the range R with the absolute MPE at the test load. Each individual weighing must also satisfy MPE.', reference: '3.6.1 · A.4.10 · pp. 30–31, 92' },
  { code: 'T-B-ELEC', title: 'Electronic Additional Tests', formula: 'Manual tests under Annex B; no single formula.', verification: 'Perform the applicable influence-factor and disturbance tests, and assess the instrument response against Annex B.', reference: 'Annex B · pp. 100–107' },
  { code: 'TT-ACC-03', title: 'Static Weighing Accuracy Performance Test', formula: 'Ec = E − E₀; determine E as specified in A.4.4.3.', verification: 'Compare corrected error at every test load with the applicable MPE.', reference: '3.5 · A.4.4.3 · pp. 30, 88' },
  { code: 'TT-ADMIN-01', title: 'Administrative & Marking Examination', formula: 'Checklist pass/fail.', verification: 'Record each applicable administrative and marking requirement as pass or fail.', reference: 'A.1 · p. 85' },
  { code: 'TT-CONST-02', title: 'Construction & Sealing Point Examination', formula: 'Checklist pass/fail.', verification: 'Inspect construction and sealing points against the applicable requirements.', reference: 'A.2 · p. 85' },
  { code: 'TT-ECC-04', title: 'Corner-Load Eccentricity Evaluation Test', formula: 'Ec = E − E₀; determine E as specified in A.4.4.3.', verification: 'At every corner/load position, compare |Ec| with the applicable MPE.', reference: '3.6.2 · A.4.7 · pp. 31, 90–91' },
  { code: 'TT-REP-05', title: 'Repeatability Consistency Test', formula: 'R = Imax − Imin.', verification: 'Compare R with the absolute MPE at the test load and check each individual weighing against MPE.', reference: '3.6.1 · A.4.10 · pp. 30–31, 92' },
];

const MPE_BANDS = [
  { accuracyClass: 'I', from: 0, to: 50000, factor: '±0.5e' },
  { accuracyClass: 'I', from: 50000, to: 200000, factor: '±1.0e', above: true },
  { accuracyClass: 'I', from: 200000, to: null, factor: '±1.5e', above: true },
  { accuracyClass: 'II', from: 0, to: 5000, factor: '±0.5e' },
  { accuracyClass: 'II', from: 5000, to: 20000, factor: '±1.0e', above: true },
  { accuracyClass: 'II', from: 20000, to: 100000, factor: '±1.5e', above: true },
  { accuracyClass: 'III', from: 0, to: 500, factor: '±0.5e' },
  { accuracyClass: 'III', from: 500, to: 2000, factor: '±1.0e', above: true },
  { accuracyClass: 'III', from: 2000, to: 10000, factor: '±1.5e', above: true },
  { accuracyClass: 'IIII', from: 0, to: 50, factor: '±0.5e' },
  { accuracyClass: 'IIII', from: 50, to: 200, factor: '±1.0e', above: true },
  { accuracyClass: 'IIII', from: 200, to: 1000, factor: '±1.5e', above: true },
];

function formatLoadRange({ from, to, above }) {
  const fromText = from.toLocaleString('en-US');
  if (to == null) return `m > ${fromText}`;
  const toText = to.toLocaleString('en-US');
  return above ? `${fromText} < m ≤ ${toText}` : `0 ≤ m ≤ ${toText}`;
}

export default function TestTypesPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['test-types-list'],
    queryFn: () => apiClient.get('/test-types'),
    select: (response) => response?.data?.data || response?.data || [],
  });
  const configuredTypes = Array.isArray(data) ? data : [];
  const standardCodes = new Set(PROCEDURES.map((procedure) => procedure.code));
  const customProcedures = configuredTypes
    .filter((type) => !standardCodes.has(type.testTypeId || type.code))
    .map((type) => ({
      code: type.testTypeId || type.code || 'CUSTOM',
      title: type.testName || type.name || 'Configured procedure',
      formula: type.formulaRef || type.evaluationStrategy || 'See configured evaluation strategy.',
      verification: type.description || 'Follow the approved test procedure and configured evaluation criteria.',
      reference: type.oimlAnnexRef || type.oimlClause || 'Configured reference',
    }));
  const procedures = [...PROCEDURES, ...customProcedures];

  return (
    <div className="test-types-page">
      <div className="page-header test-types-header">
        <div>
          <h1><FlaskConical size={22} aria-hidden="true" />OIML R-76 Test Procedures</h1>
          <p className="page-header-subtitle">Standard metrological evaluation procedures &amp; influence factor tests</p>
        </div>
      </div>

      <section className="gov-card test-types-card" aria-labelledby="procedure-reference-title">
        <div className="test-types-section-heading">
          <h2 id="procedure-reference-title">Procedure formulas and verification</h2>
          <p>Evaluation criteria shown here follow OIML R 76-1:2006. Measurements are assessed against the applicable maximum permissible error (MPE).</p>
        </div>
        <div className="gov-card-body test-types-table-scroll">
          <table className="gov-table test-types-table">
            <thead>
              <tr>
                <th scope="col">Procedure</th>
                <th scope="col">Formula / Evaluation</th>
                <th scope="col">Verification</th>
                <th scope="col">OIML Reference</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={4} className="test-types-empty">Loading procedures…</td></tr>
              ) : procedures.map((procedure) => (
                <tr key={procedure.code}>
                  <td><span className="test-types-procedure-code">{procedure.code}</span><span className="test-types-procedure-title">{procedure.title}</span></td>
                  <td className="test-types-formula">{procedure.formula}</td>
                  <td>{procedure.verification}</td>
                  <td className="test-types-reference">{procedure.reference}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="gov-card test-types-card" aria-labelledby="mpe-table-title">
        <div className="test-types-section-heading">
          <h2 id="mpe-table-title">Initial verification MPE by accuracy class</h2>
          <p>Here, <i>m</i> is the load expressed in verification intervals, <i>m/e</i>. The permissible error is the listed factor multiplied by the applicable verification scale interval <i>e</i>.</p>
        </div>
        <div className="gov-card-body test-types-table-scroll">
          <table className="gov-table mpe-table">
            <thead><tr><th scope="col">Accuracy class</th><th scope="col">Load range (<i>m</i>, in verification intervals <i>e</i>)</th><th scope="col">Initial verification MPE</th></tr></thead>
            <tbody>
              {MPE_BANDS.map((band, index) => {
                const startsClass = index === 0 || MPE_BANDS[index - 1].accuracyClass !== band.accuracyClass;
                return (
                  <tr className={startsClass ? 'mpe-class-start' : ''} key={`${band.accuracyClass}-${band.from}`}>
                    <th scope="row">{startsClass ? `Class ${band.accuracyClass}` : ''}</th>
                    <td className="mpe-load-range">{formatLoadRange(band)}</td>
                    <td className="mpe-factor">{band.factor}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="mpe-stage-note">
          <strong>Service inspection:</strong> the permissible error limits are twice the initial verification MPE. <strong>Subsequent verification:</strong> use the initial verification MPE limits.
        </div>
      </section>

      <section className="test-types-info-grid" aria-label="OIML formula details and example">
        <article className="gov-card test-types-info-card">
          <div className="test-types-section-heading"><h2>Digital changeover-point correction</h2></div>
          <div className="test-types-info-body">
            <p>For digital indications where changeover-point testing is required, determine the indication before rounding and the corrected error as follows:</p>
            <div className="test-types-equation">P = I + e/2 − ΔL</div>
            <div className="test-types-equation">E = P − L = I + e/2 − ΔL − L</div>
            <div className="test-types-equation">Ec = E − E₀</div>
            <p className="test-types-definition">Here, <i>P</i> is the indication before rounding; <i>I</i> is the displayed indication; <i>e</i> is the verification scale interval; <i>ΔL</i> is the additional load at the changeover point; <i>L</i> is the applied load; and <i>E₀</i> is the error at or near zero.</p>
          </div>
        </article>

        <article className="gov-card test-types-info-card">
          <div className="test-types-section-heading"><h2>Class III example (<i>e</i> = 10 g)</h2></div>
          <div className="test-types-info-body">
            <ul className="test-types-example-list">
              <li>Load up to 5 kg (500e): initial MPE = ±5 g; service inspection limit = ±10 g.</li>
              <li>Load above 5 kg up to 20 kg (2,000e): initial MPE = ±10 g; service inspection limit = ±20 g.</li>
              <li>Load above 20 kg up to 100 kg (10,000e): initial MPE = ±15 g; service inspection limit = ±30 g.</li>
            </ul>
            <p className="test-types-caution"><strong>Use the verification interval <i>e</i>.</strong> It can differ from the actual display interval <i>d</i>. Select the applicable limit using the instrument’s declared accuracy class, verification interval, and test stage.</p>
          </div>
        </article>
      </section>

      <section className="gov-card test-types-card" aria-labelledby="definitions-title">
        <div className="test-types-section-heading"><h2 id="definitions-title">Terms and symbols</h2></div>
        <dl className="test-types-definitions">
          <div><dt>Ec</dt><dd>Corrected error</dd></div>
          <div><dt>I</dt><dd>Indicated value</dd></div>
          <div><dt>L</dt><dd>Conventional true value of the applied load</dd></div>
          <div><dt>E₀</dt><dd>Error at zero load</dd></div>
          <div><dt>R</dt><dd>Repeatability range</dd></div>
          <div><dt>Imax / Imin</dt><dd>Maximum and minimum indications</dd></div>
          <div><dt>d</dt><dd>Actual scale interval</dd></div>
          <div><dt>e</dt><dd>Verification scale interval used to select the MPE band</dd></div>
          <div><dt>m</dt><dd>Applied load expressed in verification intervals (<i>m/e</i>)</dd></div>
        </dl>
      </section>

      <section className="gov-card test-types-card" aria-labelledby="references-title">
        <div className="test-types-section-heading"><h2 id="references-title">OIML references and printed page numbers</h2></div>
        <div className="gov-card-body test-types-table-scroll">
          <table className="gov-table test-types-reference-table">
            <thead><tr><th scope="col">Test</th><th scope="col">Clause / Annex</th><th scope="col">Printed page</th></tr></thead>
            <tbody>
              <tr><td>Accuracy</td><td>3.5, A.4.4.3</td><td>30, 88</td></tr>
              <tr><td>Discrimination</td><td>3.8, A.4.8</td><td>32, 91</td></tr>
              <tr><td>Eccentricity</td><td>3.6.2, A.4.7</td><td>31, 90–91</td></tr>
              <tr><td>Repeatability</td><td>3.6.1, A.4.10</td><td>30–31, 92</td></tr>
              <tr><td>Electronic tests</td><td>Annex B</td><td>100–107</td></tr>
              <tr><td>Administrative examination</td><td>A.1</td><td>85</td></tr>
              <tr><td>Construction comparison</td><td>A.2</td><td>85</td></tr>
              <tr><td>Initial, subsequent, and service inspection limits</td><td>3.5.1, 8.4.1–8.4.2</td><td>29–30</td></tr>
            </tbody>
          </table>
        </div>
        <p className="test-types-source">Reference edition: OIML R 76-1:2006 (E), Non-automatic weighing instruments — Part 1: Metrological and technical requirements — Tests.</p>
      </section>
    </div>
  );
}