const fs = require('fs');
let content = fs.readFileSync('src/services/reportGenerator.service.js', 'utf8');

const replacement = `async function renderDocx({ reportNumber, session, model, manufacturer, observations, attachments, docxPath, remarks, language = 'en' }) {
  try {
    const lbl = LABELS[language] || LABELS.en;
    
    const tableHeaderRow = new TableRow({
      children: [
        new TableCell({ children: [new Paragraph({ text: lbl.thNum, bold: true })] }),
        new TableCell({ children: [new Paragraph({ text: 'Annex Ref', bold: true })] }),
        new TableCell({ children: [new Paragraph({ text: lbl.thMethod, bold: true })] }),
        new TableCell({ children: [new Paragraph({ text: lbl.thRefLoad, bold: true })] }),
        new TableCell({ children: [new Paragraph({ text: lbl.thIndication, bold: true })] }),
        new TableCell({ children: [new Paragraph({ text: lbl.thZero, bold: true })] }),
        new TableCell({ children: [new Paragraph({ text: lbl.thError, bold: true })] }),
        new TableCell({ children: [new Paragraph({ text: lbl.thMpe, bold: true })] }),
        new TableCell({ children: [new Paragraph({ text: lbl.thMargin, bold: true })] }),
        new TableCell({ children: [new Paragraph({ text: lbl.thEdition, bold: true })] }),
        new TableCell({ children: [new Paragraph({ text: lbl.thOutcome, bold: true })] }),
        new TableCell({ children: [new Paragraph({ text: lbl.thNotes, bold: true })] }),
      ],
    });

    const tableObsRows = (observations || []).map(
      (obs, idx) =>
        new TableRow({
          children: [
            new TableCell({ children: [new Paragraph({ text: String(idx + 1) })] }),
            new TableCell({ children: [new Paragraph({ text: obs.annexRef || '-' })] }),
            new TableCell({ children: [new Paragraph({ text: obs.evaluationMethod || '-' })] }),
            new TableCell({ children: [new Paragraph({ text: String(obs.referenceLoad ?? '-') })] }),
            new TableCell({ children: [new Paragraph({ text: String(obs.indicatedValue ?? '-') })] }),
            new TableCell({ children: [new Paragraph({ text: String(obs.zeroCorrection ?? '-') })] }),
            new TableCell({ children: [new Paragraph({ text: obs.computedError !== undefined && obs.computedError !== null ? obs.computedError.toFixed(4) : '-' })] }),
            new TableCell({ children: [new Paragraph({ text: obs.appliedMpe !== undefined && obs.appliedMpe !== null ? obs.appliedMpe.toFixed(4) : '-' })] }),
            new TableCell({ children: [new Paragraph({ text: obs.marginToMpe !== undefined && obs.marginToMpe !== null ? obs.marginToMpe.toFixed(4) : '-' })] }),
            new TableCell({ children: [new Paragraph({ text: obs.ruleConfigId ? \`\${obs.ruleConfigId.oimlEdition} — \${obs.ruleConfigId.sourceReference || 'Source not recorded'}\` : 'Checklist' })] }),
            new TableCell({ children: [new Paragraph({ text: (obs.outcome || '').toUpperCase(), bold: true })] }),
            new TableCell({ children: [new Paragraph({ text: obs.reviewerNotes || '' })] }),
          ],
        })
    );

    const obsTable = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [tableHeaderRow, ...tableObsRows],
    });

    const remarksParagraphs = remarks ? [
      new Paragraph({ text: '' }),
      new Paragraph({ text: lbl.sec5, heading: HeadingLevel.HEADING_3 }),
      new Paragraph({ text: remarks }),
    ] : [];

    const doc = new Document({
      sections: [
        {
          children: [
            new Paragraph({
              text: lbl.deptTitle + ' - ' + lbl.deptSubtitle,
              heading: HeadingLevel.HEADING_1,
              alignment: AlignmentType.CENTER,
            }),
            new Paragraph({
              text: lbl.reportHeader,
              heading: HeadingLevel.HEADING_2,
              alignment: AlignmentType.CENTER,
            }),
            new Paragraph({
              text: \`\${lbl.reportNum} \${reportNumber}\`,
              alignment: AlignmentType.CENTER,
            }),
            new Paragraph({ text: '' }),
            new Paragraph({ text: lbl.sec1, heading: HeadingLevel.HEADING_3 }),
            new Paragraph({ text: \`\${lbl.mfgName} \${manufacturer.name}\` }),
            new Paragraph({ text: \`\${lbl.model} \${model.modelName} | \${lbl.accClass} Class \${model.accuracyClass}\` }),
            new Paragraph({ text: \`\${lbl.maxCap} \${model.maxCapacity} kg | \${lbl.e} \${model.e} kg | \${lbl.n} \${model.n}\` }),
            new Paragraph({ text: '' }),
            new Paragraph({ text: lbl.sec2, heading: HeadingLevel.HEADING_3 }),
            new Paragraph({ text: \`\${lbl.lab} \${session.laboratoryName || session.labId} (\${session.labId})\` }),
            new Paragraph({ text: \`\${lbl.verifStage} \${session.verificationStage === 'subsequent' ? lbl.subsequent : lbl.initial}\` }),
            new Paragraph({ text: \`\${lbl.testDate} \${new Date(session.testDate).toISOString().split('T')[0]}\` }),
            new Paragraph({ text: \`\${lbl.temp} \${session.environmentalConditions?.temperatureC ?? 'Not recorded'} °C | \${lbl.humidity} \${session.environmentalConditions?.humidityPercent ?? 'Not recorded'} %\` }),
            new Paragraph({ text: '' }),
            new Paragraph({ text: lbl.sec3Prefix + 'OIML R-76', heading: HeadingLevel.HEADING_3 }),
            obsTable,
            ...remarksParagraphs,
            new Paragraph({ text: '' }),
            new Paragraph({
              text: \`\${lbl.verdict} \${(session.overallResult || 'PENDING').toUpperCase()}\`,
              heading: HeadingLevel.HEADING_2,
              alignment: AlignmentType.CENTER,
            }),
            new Paragraph({ text: '' }),
            new Paragraph({
              text: lbl.footer1,
              alignment: AlignmentType.CENTER,
            }),
            new Paragraph({
              text: lbl.footer2,
              alignment: AlignmentType.CENTER,
            }),
          ],
        },
      ],
    });

    const buffer = await Packer.toBuffer(doc);
    fs.writeFileSync(docxPath, buffer);
  } catch (err) {
    console.error('DOCX generation error:', err);
    throw new AppError(500, 'DOCX_RENDER_FAILED', 'DOCX document rendering failed: ' + err.message);
  }
}`;

const startIndex = content.indexOf('async function renderDocx');
const endIndex = content.indexOf('export async function generateReport');

if (startIndex > -1 && endIndex > -1) {
  content = content.substring(0, startIndex) + replacement + '\n\n' + content.substring(endIndex);
  fs.writeFileSync('src/services/reportGenerator.service.js', content, 'utf8');
} else {
  console.log('Could not find boundaries');
}
