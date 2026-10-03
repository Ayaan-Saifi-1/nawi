import { Document, Paragraph, Table, TableRow, TableCell, HeadingLevel, AlignmentType, WidthType, TextRun } from 'docx';
import { generateQrSvg } from './qrGenerator.js';

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char]);
}

function hasUnverifiedRule(observations) {
  return observations.some(obs => 
    obs.ruleConfigId && 
    obs.ruleConfigId.validationNote && 
    obs.ruleConfigId.validationNote.includes('UNVERIFIED')
  );
}

function formatVal(val) {
  if (val === null || val === undefined) return '-';
  if (typeof val === 'number') {
    return val > 0 ? `+${val.toFixed(4)}` : val.toFixed(4);
  }
  return val;
}

function formatMpe(val) {
  if (val === null || val === undefined) return '-';
  if (typeof val === 'number') {
    return `±${val.toFixed(4)}`;
  }
  return val;
}

function formatOutcome(outcome) {
  return (outcome || 'PENDING').toUpperCase();
}

function generateObservationHtml(obs, idx) {
  const oimlEdition = obs.ruleConfigId?.oimlEdition || 'Checklist';
  const sourceReference = obs.ruleConfigId?.sourceReference || 'Source not recorded';
  const ruleBasis = `<div style="margin-top: 5px; font-size: 11px; color: #64748b;">
    <strong>Rule basis:</strong> ${escapeHtml(oimlEdition)} — ${escapeHtml(sourceReference)}
    ${obs.ruleConfigId ? `| Class: ${escapeHtml(obs.ruleConfigId.accuracyClass)} | Effective: ${obs.ruleConfigId.effectiveDate ? new Date(obs.ruleConfigId.effectiveDate).toISOString().split('T')[0] : 'N/A'} | Rule ID: ${obs.ruleConfigId._id}` : ''}
    <br><strong>Reviewer Notes:</strong> ${escapeHtml(obs.reviewerNotes || 'None')}
  </div>`;

  if (obs.evaluationMethod !== 'structured') {
    // Legacy / Checklist fallback format
    return `
      <div style="margin-bottom: 20px; border: 1px solid #cbd5e1; padding: 10px; border-radius: 4px;">
        <h4 style="margin: 0 0 10px 0;">${idx + 1}. ${escapeHtml(obs.annexRef)} - ${escapeHtml(obs.evaluationMethod)}</h4>
        <table style="width:100%; border-collapse:collapse; font-size:12px;">
          <tr>
            <th style="border:1px solid #cbd5e1; padding:4px;">Reference load</th>
            <th style="border:1px solid #cbd5e1; padding:4px;">Indication</th>
            <th style="border:1px solid #cbd5e1; padding:4px;">Zero corr</th>
            <th style="border:1px solid #cbd5e1; padding:4px;">Error</th>
            <th style="border:1px solid #cbd5e1; padding:4px;">MPE</th>
            <th style="border:1px solid #cbd5e1; padding:4px;">Margin</th>
            <th style="border:1px solid #cbd5e1; padding:4px;">Result</th>
          </tr>
          <tr>
            <td style="border:1px solid #cbd5e1; padding:4px;">${obs.referenceLoad ?? '-'}</td>
            <td style="border:1px solid #cbd5e1; padding:4px;">${obs.indicatedValue ?? '-'}</td>
            <td style="border:1px solid #cbd5e1; padding:4px;">${obs.zeroCorrection ?? '-'}</td>
            <td style="border:1px solid #cbd5e1; padding:4px;">${formatVal(obs.computedError)}</td>
            <td style="border:1px solid #cbd5e1; padding:4px;">${formatMpe(obs.appliedMpe)}</td>
            <td style="border:1px solid #cbd5e1; padding:4px;">${formatVal(obs.marginToMpe)}</td>
            <td style="border:1px solid #cbd5e1; padding:4px; font-weight:bold; color: ${obs.outcome === 'pass' ? '#16a34a' : '#dc2626'}">${formatOutcome(obs.outcome)}</td>
          </tr>
        </table>
        ${ruleBasis}
      </div>
    `;
  }

  // Structured observations
  let tableHtml = '';
  
  if (['A4_accuracy', 'A4_eccentricity', 'B_electronic_additional'].includes(obs.annexRef)) {
    const readingsHtml = (obs.readings || []).map(r => `
      <tr>
        <td style="border:1px solid #cbd5e1; padding:4px;">${r.reference ?? '-'}</td>
        <td style="border:1px solid #cbd5e1; padding:4px;">${r.indicated ?? '-'}</td>
        <td style="border:1px solid #cbd5e1; padding:4px;">${formatVal(r.error)}</td>
        <td style="border:1px solid #cbd5e1; padding:4px;">${formatMpe(r.mpe)}</td>
        <td style="border:1px solid #cbd5e1; padding:4px;">${formatVal(r.margin)}</td>
        <td style="border:1px solid #cbd5e1; padding:4px; color: ${r.result === 'pass' ? '#16a34a' : '#dc2626'}">${formatOutcome(r.result)}</td>
      </tr>
    `).join('');

    tableHtml = `
      <table style="width:100%; border-collapse:collapse; font-size:12px;">
        <tr style="background-color: #f1f5f9;">
          <th style="border:1px solid #cbd5e1; padding:4px; text-align:left;">Load (kg)</th>
          <th style="border:1px solid #cbd5e1; padding:4px; text-align:left;">Indicated (kg)</th>
          <th style="border:1px solid #cbd5e1; padding:4px; text-align:left;">Error (kg)</th>
          <th style="border:1px solid #cbd5e1; padding:4px; text-align:left;">MPE (kg)</th>
          <th style="border:1px solid #cbd5e1; padding:4px; text-align:left;">Margin (kg)</th>
          <th style="border:1px solid #cbd5e1; padding:4px; text-align:left;">Result</th>
        </tr>
        ${readingsHtml}
        ${obs.worstMargin != null ? `<tr><td colspan="4" style="border:1px solid #cbd5e1; padding:4px; text-align:right;"><strong>Worst Margin:</strong></td><td colspan="2" style="border:1px solid #cbd5e1; padding:4px;"><strong>${formatVal(obs.worstMargin)}</strong></td></tr>` : ''}
      </table>
    `;
  } else if (obs.annexRef === 'A4_repeatability') {
    const readingsHtml = (obs.readings || []).map((r, i) => `
      <tr>
        <td style="border:1px solid #cbd5e1; padding:4px;">${i + 1}</td>
        <td style="border:1px solid #cbd5e1; padding:4px;">${r.reference ?? '-'}</td>
        <td style="border:1px solid #cbd5e1; padding:4px;">${r.indicated ?? '-'}</td>
      </tr>
    `).join('');
    
    tableHtml = `
      <table style="width:100%; border-collapse:collapse; font-size:12px;">
        <tr style="background-color: #f1f5f9;">
          <th style="border:1px solid #cbd5e1; padding:4px; text-align:left;">Reading #</th>
          <th style="border:1px solid #cbd5e1; padding:4px; text-align:left;">Load (kg)</th>
          <th style="border:1px solid #cbd5e1; padding:4px; text-align:left;">Indicated (kg)</th>
        </tr>
        ${readingsHtml}
        <tr>
          <td colspan="2" style="border:1px solid #cbd5e1; padding:4px; text-align:right;"><strong>Range:</strong></td>
          <td style="border:1px solid #cbd5e1; padding:4px;"><strong>${obs.range != null ? obs.range.toFixed(4) : '-'} kg (Allowed MPE: ${obs.readings && obs.readings.length > 0 ? formatMpe(obs.readings[0].mpe) : '-'})</strong></td>
        </tr>
      </table>
    `;
  } else if (obs.annexRef === 'A4_discrimination') {
    const r = obs.readings && obs.readings.length > 0 ? obs.readings[0] : {};
    tableHtml = `
      <table style="width:100%; border-collapse:collapse; font-size:12px;">
        <tr style="background-color: #f1f5f9;">
          <th style="border:1px solid #cbd5e1; padding:4px; text-align:left;">Load (kg)</th>
          <th style="border:1px solid #cbd5e1; padding:4px; text-align:left;">Extra Load (kg)</th>
          <th style="border:1px solid #cbd5e1; padding:4px; text-align:left;">Indication Before (kg)</th>
          <th style="border:1px solid #cbd5e1; padding:4px; text-align:left;">Indication After (kg)</th>
          <th style="border:1px solid #cbd5e1; padding:4px; text-align:left;">Change Req (kg)</th>
          <th style="border:1px solid #cbd5e1; padding:4px; text-align:left;">Result</th>
        </tr>
        <tr>
          <td style="border:1px solid #cbd5e1; padding:4px;">${r.reference ?? '-'}</td>
          <td style="border:1px solid #cbd5e1; padding:4px;">${r.extraLoad ?? '-'}</td>
          <td style="border:1px solid #cbd5e1; padding:4px;">${r.indicatedBefore ?? '-'}</td>
          <td style="border:1px solid #cbd5e1; padding:4px;">${r.indicatedAfter ?? '-'}</td>
          <td style="border:1px solid #cbd5e1; padding:4px;">${r.requiredChange ?? '-'}</td>
          <td style="border:1px solid #cbd5e1; padding:4px; color: ${r.result === 'pass' ? '#16a34a' : '#dc2626'}">${formatOutcome(r.result)}</td>
        </tr>
      </table>
    `;
  }

  return `
    <div style="margin-bottom: 20px; border: 1px solid #cbd5e1; padding: 10px; border-radius: 4px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
        <h4 style="margin: 0;">${idx + 1}. ${escapeHtml(obs.annexRef)}</h4>
        <strong style="color: ${obs.outcome === 'pass' ? '#16a34a' : '#dc2626'}">${formatOutcome(obs.outcome)}</strong>
      </div>
      ${tableHtml}
      ${ruleBasis}
    </div>
  `;
}

export function generateHtmlTemplate({ reportNumber, session, model, manufacturer, observations, attachments, generatedAt, remarks }) {
  const verificationUrl = process.env.PUBLIC_APP_URL
    ? `${process.env.PUBLIC_APP_URL.replace(/\/$/, '')}/verify?q=${encodeURIComponent(reportNumber)}`
    : `https://nawi.gov.in/verify?q=${encodeURIComponent(reportNumber)}`;
  
  const qrSvg = generateQrSvg(verificationUrl, 110);
  
  const obsBlocks = (observations || []).map((obs, idx) => generateObservationHtml(obs, idx)).join('');

  const unverifiedBanner = hasUnverifiedRule(observations || [])
    ? '<div style="background-color: #fef08a; color: #854d0e; padding: 15px; border: 2px solid #eab308; font-weight: bold; text-align: center; margin-bottom: 20px; font-size: 16px;">RULES NOT YET EXPERT-VERIFIED - DEMONSTRATION ONLY</div>'
    : '';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
        <title>Metrology Test Report - ${escapeHtml(reportNumber)}</title>
      <style>
        body { font-family: 'Helvetica Neue', Arial, sans-serif; padding: 40px; color: #1e293b; line-height: 1.5; }
        .header { display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #0f172a; padding-bottom: 20px; margin-bottom: 30px; }
        .header-title h1 { margin: 0; font-size: 20px; color: #0f172a; text-transform: uppercase; }
        .header-title h2 { margin: 4px 0; font-size: 14px; color: #475569; font-weight: normal; }
        .header-title h3 { margin: 4px 0; font-size: 14px; color: #0f172a; font-family: monospace; }
        .qr-box { text-align: center; font-size: 10px; color: #64748b; }
        .section { margin-bottom: 25px; }
        .section-title { font-size: 15px; font-weight: bold; color: #0f172a; border-bottom: 1px solid #cbd5e1; padding-bottom: 5px; margin-bottom: 12px; }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .field { font-size: 13px; }
        .field strong { color: #334155; }
        .result-box { margin-top: 20px; padding: 12px; border-radius: 6px; text-align: center; font-size: 16px; font-weight: bold; }
        .pass { background-color: #dcfce7; color: #166534; border: 1px solid #86efac; }
        .fail { background-color: #fee2e2; color: #991b1b; border: 1px solid #fca5a5; }
        .footer { margin-top: 30px; padding-top: 15px; border-top: 1px solid #cbd5e1; font-size: 11px; color: #64748b; text-align: center; }
      </style>
    </head>
    <body>
      ${unverifiedBanner}
      <div class="header">
        <div class="header-title">
          <h1>Department of Consumer Affairs — Test Report</h1>
          <h2>Legal Metrology Division — NAWI Type Evaluation</h2>
          <h3>Report Number: ${escapeHtml(reportNumber)}</h3>
        </div>
        <div class="qr-box">
          ${qrSvg}
          <div style="margin-top:4px;"><a href="${escapeHtml(verificationUrl)}" style="color:#2563eb;text-decoration:none;">Verify online</a></div>
        </div>
      </div>

      <div class="section">
        <div class="section-title">1. Instrument & Manufacturer Specifications</div>
        <div class="grid">
          <div class="field"><strong>Manufacturer Name:</strong> ${escapeHtml(manufacturer.name)}</div>
          <div class="field"><strong>Model Name:</strong> ${escapeHtml(model.modelName)}</div>
          <div class="field"><strong>Accuracy Class:</strong> Class ${escapeHtml(model.accuracyClass)}</div>
          <div class="field"><strong>Max Capacity:</strong> ${model.maxCapacity} kg</div>
          <div class="field"><strong>Verification Scale Interval (e):</strong> ${model.e} kg</div>
          <div class="field"><strong>Scale Intervals (n):</strong> ${model.n}</div>
        </div>
      </div>

      <div class="section">
        <div class="section-title">2. Laboratory & Environmental Test Conditions</div>
        <div class="grid">
          <div class="field"><strong>Laboratory:</strong> ${escapeHtml(session.laboratoryName || session.labId)} (${escapeHtml(session.labId)})</div>
          <div class="field"><strong>Verification Stage:</strong> ${session.verificationStage === 'subsequent' ? 'Subsequent Inspection (In-Service, 2× MPE)' : 'Initial Verification (Standard MPE)'}</div>
          <div class="field"><strong>Test Date:</strong> ${new Date(session.testDate).toISOString().split('T')[0]}</div>
          <div class="field"><strong>Temperature:</strong> ${session.environmentalConditions?.temperatureC ?? 'Not recorded'} °C</div>
          <div class="field"><strong>Humidity:</strong> ${session.environmentalConditions?.humidityPercent ?? 'Not recorded'} %</div>
          <div class="field"><strong>Inclination:</strong> ${session.environmentalConditions?.inclinationDeg ?? 'Not recorded'} °</div>
        </div>
      </div>

      <div class="section">
        <div class="section-title">3. OIML R-76 Test Observations & Compliance Determination</div>
        ${obsBlocks}
      </div>

      <div class="section">
        <div class="section-title">4. Photographic Evidence & Supporting Attachments</div>
        ${
          attachments && attachments.length > 0
            ? `
          <table style="width:100%; border-collapse:collapse; font-size:12px;">
            <tr style="background-color: #f1f5f9;">
              <th style="border:1px solid #cbd5e1; padding:4px; text-align:left;">#</th>
              <th style="border:1px solid #cbd5e1; padding:4px; text-align:left;">File Name</th>
              <th style="border:1px solid #cbd5e1; padding:4px; text-align:left;">Category</th>
              <th style="border:1px solid #cbd5e1; padding:4px; text-align:left;">Upload Date</th>
            </tr>
            ${attachments
              .map(
                (att, idx) => `
              <tr>
                <td style="border:1px solid #cbd5e1; padding:4px;">${idx + 1}</td>
                <td style="border:1px solid #cbd5e1; padding:4px;">${escapeHtml(att.originalFilename || att.filename || 'Attachment')}</td>
                <td style="border:1px solid #cbd5e1; padding:4px;">${escapeHtml(att.fileType || 'Document')}</td>
                <td style="border:1px solid #cbd5e1; padding:4px;">${new Date(att.createdAt || Date.now()).toISOString().split('T')[0]}</td>
              </tr>
            `
              )
              .join('')}
          </table>
        `
            : `<p style="font-size: 12px; color: #64748b; font-style: italic;">No uploaded photographic or document attachments associated with this session.</p>`
        }
      </div>

      ${
        remarks
          ? `
      <div class="section">
        <div class="section-title">5. Reviewing Officer Remarks</div>
        <p style="font-size: 13px; color: #334155; white-space: pre-wrap;">${escapeHtml(remarks)}</p>
      </div>
      `
          : ''
      }

      <div class="result-box ${session.overallResult === 'pass' ? 'pass' : 'fail'}">
        OVERALL EVALUATION VERDICT: ${session.overallResult ? session.overallResult.toUpperCase() : 'PENDING'}
      </div>

      <div class="footer">
        <p>SHA-256 digests and detached-signature metadata are recorded in the report repository.</p>
        <p>HMAC is an internal integrity tag. Check the public verification portal for the PKI signature state and certificate fingerprint. Applicable rule editions are listed per calculated observation.</p>
      </div>
    </body>
    </html>
  `;
}

function makeDocxCell(text, isHeader = false) {
  return new TableCell({ children: [new Paragraph({ text: String(text), bold: isHeader })] });
}

function buildObservationDocxParagraphs(obs, idx) {
  const elements = [];
  elements.push(new Paragraph({ text: `${idx + 1}. ${obs.annexRef}`, heading: HeadingLevel.HEADING_4 }));

  if (obs.evaluationMethod !== 'structured') {
    const headerRow = new TableRow({
      children: [
        makeDocxCell('Ref Load', true),
        makeDocxCell('Indication', true),
        makeDocxCell('Zero corr', true),
        makeDocxCell('Error', true),
        makeDocxCell('MPE', true),
        makeDocxCell('Margin', true),
        makeDocxCell('Result', true),
      ]
    });
    const row = new TableRow({
      children: [
        makeDocxCell(obs.referenceLoad ?? '-'),
        makeDocxCell(obs.indicatedValue ?? '-'),
        makeDocxCell(obs.zeroCorrection ?? '-'),
        makeDocxCell(formatVal(obs.computedError)),
        makeDocxCell(formatMpe(obs.appliedMpe)),
        makeDocxCell(formatVal(obs.marginToMpe)),
        makeDocxCell(formatOutcome(obs.outcome)),
      ]
    });
    elements.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [headerRow, row] }));
  } else if (['A4_accuracy', 'A4_eccentricity', 'B_electronic_additional'].includes(obs.annexRef)) {
    const headerRow = new TableRow({
      children: [
        makeDocxCell('Load (kg)', true),
        makeDocxCell('Indicated (kg)', true),
        makeDocxCell('Error (kg)', true),
        makeDocxCell('MPE (kg)', true),
        makeDocxCell('Margin (kg)', true),
        makeDocxCell('Result', true),
      ]
    });
    const rows = [headerRow];
    for (const r of (obs.readings || [])) {
      rows.push(new TableRow({
        children: [
          makeDocxCell(r.reference ?? '-'),
          makeDocxCell(r.indicated ?? '-'),
          makeDocxCell(formatVal(r.error)),
          makeDocxCell(formatMpe(r.mpe)),
          makeDocxCell(formatVal(r.margin)),
          makeDocxCell(formatOutcome(r.result)),
        ]
      }));
    }
    if (obs.worstMargin != null) {
      rows.push(new TableRow({
        children: [
          new TableCell({ children: [new Paragraph({ text: 'Worst Margin:', alignment: AlignmentType.RIGHT, bold: true })], columnSpan: 4 }),
          new TableCell({ children: [new Paragraph({ text: formatVal(obs.worstMargin), bold: true })], columnSpan: 2 })
        ]
      }));
    }
    elements.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows }));
  } else if (obs.annexRef === 'A4_repeatability') {
    const headerRow = new TableRow({
      children: [
        makeDocxCell('Reading #', true),
        makeDocxCell('Load (kg)', true),
        makeDocxCell('Indicated (kg)', true),
      ]
    });
    const rows = [headerRow];
    (obs.readings || []).forEach((r, i) => {
      rows.push(new TableRow({
        children: [
          makeDocxCell(i + 1),
          makeDocxCell(r.reference ?? '-'),
          makeDocxCell(r.indicated ?? '-'),
        ]
      }));
    });
    rows.push(new TableRow({
      children: [
        new TableCell({ children: [new Paragraph({ text: 'Range:', alignment: AlignmentType.RIGHT, bold: true })], columnSpan: 2 }),
        new TableCell({ children: [new Paragraph({ text: `${obs.range != null ? obs.range.toFixed(4) : '-'} kg (MPE: ${obs.readings && obs.readings.length > 0 ? formatMpe(obs.readings[0].mpe) : '-'}) `, bold: true })] })
      ]
    }));
    elements.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows }));
  } else if (obs.annexRef === 'A4_discrimination') {
    const headerRow = new TableRow({
      children: [
        makeDocxCell('Load (kg)', true),
        makeDocxCell('Extra Load (kg)', true),
        makeDocxCell('Ind Before (kg)', true),
        makeDocxCell('Ind After (kg)', true),
        makeDocxCell('Req Change (kg)', true),
        makeDocxCell('Result', true),
      ]
    });
    const r = obs.readings && obs.readings.length > 0 ? obs.readings[0] : {};
    const row = new TableRow({
      children: [
        makeDocxCell(r.reference ?? '-'),
        makeDocxCell(r.extraLoad ?? '-'),
        makeDocxCell(r.indicatedBefore ?? '-'),
        makeDocxCell(r.indicatedAfter ?? '-'),
        makeDocxCell(r.requiredChange ?? '-'),
        makeDocxCell(formatOutcome(r.result)),
      ]
    });
    elements.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [headerRow, row] }));
  }

  const oimlEdition = obs.ruleConfigId?.oimlEdition || 'Checklist';
  const sourceReference = obs.ruleConfigId?.sourceReference || 'Source not recorded';
  const ruleIdText = obs.ruleConfigId ? ` | Class: ${obs.ruleConfigId.accuracyClass} | Effective: ${obs.ruleConfigId.effectiveDate ? new Date(obs.ruleConfigId.effectiveDate).toISOString().split('T')[0] : 'N/A'} | Rule ID: ${obs.ruleConfigId._id}` : '';
  
  elements.push(new Paragraph({ text: '' }));
  elements.push(new Paragraph({
    children: [
      new TextRun({ text: 'Rule basis: ', bold: true }),
      new TextRun({ text: `${oimlEdition} — ${sourceReference}${ruleIdText}` })
    ]
  }));
  elements.push(new Paragraph({
    children: [
      new TextRun({ text: 'Reviewer Notes: ', bold: true }),
      new TextRun({ text: obs.reviewerNotes || 'None' })
    ]
  }));
  elements.push(new Paragraph({ text: '' }));

  return elements;
}

export function buildDocxDocument({ reportNumber, session, model, manufacturer, observations, attachments, remarks }) {
  const children = [];
  
  if (hasUnverifiedRule(observations || [])) {
    children.push(new Paragraph({
      text: 'RULES NOT YET EXPERT-VERIFIED - DEMONSTRATION ONLY',
      heading: HeadingLevel.HEADING_2,
      alignment: AlignmentType.CENTER,
    }));
    children.push(new Paragraph({ text: '' }));
  }

  children.push(
    new Paragraph({
      text: 'GOVERNMENT OF INDIA - DEPARTMENT OF CONSUMER AFFAIRS',
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.CENTER,
    }),
    new Paragraph({
      text: 'Legal Metrology Division — NAWI Type Evaluation Test Report',
      heading: HeadingLevel.HEADING_2,
      alignment: AlignmentType.CENTER,
    }),
    new Paragraph({
      text: `Report Number: ${reportNumber}`,
      alignment: AlignmentType.CENTER,
    }),
    new Paragraph({ text: '' }),
    new Paragraph({ text: '1. Instrument & Manufacturer Specifications', heading: HeadingLevel.HEADING_3 }),
    new Paragraph({ text: `Manufacturer: ${manufacturer.name}` }),
    new Paragraph({ text: `Model: ${model.modelName} | Class: Class ${model.accuracyClass}` }),
    new Paragraph({ text: `Max Capacity: ${model.maxCapacity} kg | e: ${model.e} kg | n: ${model.n}` }),
    new Paragraph({ text: '' }),
    new Paragraph({ text: '2. Laboratory & Environmental Test Conditions', heading: HeadingLevel.HEADING_3 }),
    new Paragraph({ text: `Laboratory: ${session.laboratoryName || session.labId} (${session.labId})` }),
    new Paragraph({ text: `Verification Stage: ${session.verificationStage === 'subsequent' ? 'Subsequent Inspection (In-Service, 2× MPE)' : 'Initial Verification (Standard MPE)'}` }),
    new Paragraph({ text: `Test Date: ${new Date(session.testDate).toISOString().split('T')[0]}` }),
    new Paragraph({ text: `Temperature: ${session.environmentalConditions?.temperatureC ?? 'Not recorded'} °C | Humidity: ${session.environmentalConditions?.humidityPercent ?? 'Not recorded'} %` }),
    new Paragraph({ text: '' }),
    new Paragraph({ text: '3. OIML R-76 Test Observations & Compliance Determination', heading: HeadingLevel.HEADING_3 }),
    new Paragraph({ text: '' })
  );

  (observations || []).forEach((obs, idx) => {
    children.push(...buildObservationDocxParagraphs(obs, idx));
  });

  if (remarks) {
    children.push(
      new Paragraph({ text: '4. Reviewing Officer Remarks', heading: HeadingLevel.HEADING_3 }),
      new Paragraph({ text: remarks }),
      new Paragraph({ text: '' })
    );
  }

  children.push(
    new Paragraph({
      text: `OVERALL EVALUATION VERDICT: ${(session.overallResult || 'PENDING').toUpperCase()}`,
      heading: HeadingLevel.HEADING_2,
      alignment: AlignmentType.CENTER,
    }),
    new Paragraph({ text: '' }),
    new Paragraph({
      text: 'SHA-256 digests and detached-signature metadata are recorded in the report repository. HMAC is an internal integrity tag; check the public verification portal for the PKI signature state and certificate fingerprint.',
      alignment: AlignmentType.CENTER,
    }),
    new Paragraph({
      text: 'NAWI Digital Metrology System — applicable rule edition is recorded with each calculated observation',
      alignment: AlignmentType.CENTER,
    })
  );

  return new Document({ sections: [{ children }] });
}
