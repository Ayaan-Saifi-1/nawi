const fs = require('fs');
let content = fs.readFileSync('src/services/reportGenerator.service.js', 'utf8');

const replacement = `const LABELS = {
  en: {
    reportTitle: 'Metrology Test Report',
    deptTitle: 'GOVERNMENT OF INDIA',
    deptSubtitle: 'Department of Consumer Affairs',
    reportHeader: 'Legal Metrology Division — NAWI Type Evaluation Test Report',
    reportNum: 'Report Number:',
    genOn: 'Generated On:',
    verifyMsg: 'Verify online',
    sec1: '1. Instrument & Manufacturer Specifications',
    mfgName: 'Manufacturer Name:',
    model: 'Model:',
    accClass: 'Accuracy Class:',
    maxCap: 'Max Capacity:',
    minCap: 'Min Capacity:',
    e: 'Verification Scale Interval (e):',
    n: 'Number of Scale Intervals (n):',
    sec2: '2. Laboratory & Environmental Test Conditions',
    lab: 'Laboratory:',
    verifStage: 'Verification Stage:',
    subsequent: 'Subsequent Inspection (In-Service, 2× MPE)',
    initial: 'Initial Verification (Standard MPE)',
    testDate: 'Test Date:',
    temp: 'Temperature:',
    humidity: 'Humidity:',
    inclination: 'Inclination:',
    sec3Prefix: '3. Test Observations: ',
    thNum: '#',
    thMethod: 'Method',
    thRefLoad: 'Reference load (kg)',
    thIndication: 'Indication (kg)',
    thZero: 'Zero correction (kg)',
    thError: 'Error (kg)',
    thMpe: 'MPE (kg)',
    thMargin: 'Margin (kg)',
    thEdition: 'Rule edition',
    thOutcome: 'Outcome',
    thNotes: 'Evidence / notes',
    sec4: '4. Photographic Evidence & Supporting Attachments',
    thFile: 'File Name',
    thCategory: 'Category',
    thDate: 'Upload Date',
    noAtt: 'No uploaded photographic or document attachments associated with this session.',
    sec5: '5. Reviewing Officer Remarks',
    verdict: 'OVERALL EVALUATION VERDICT:',
    footer1: 'SHA-256 digests and detached-signature metadata are recorded in the report repository.',
    footer2: 'HMAC is an internal integrity tag. Check the public verification portal for the PKI signature state and certificate fingerprint.'
  },
  hi: {
    reportTitle: "मेट्रोलॉजी परीक्षण रिपोर्ट",
    deptTitle: "भारत सरकार",
    deptSubtitle: "उपभोक्ता मामले विभाग",
    reportHeader: "विधिक मापविज्ञान प्रभाग — NAWI प्रकार मूल्यांकन परीक्षण रिपोर्ट",
    reportNum: "रिपोर्ट संख्या:",
    genOn: "उत्पन्न किया गया:",
    verifyMsg: "ऑनलाइन सत्यापित करें",
    sec1: "1. उपकरण और निर्माता निर्दिष्टीकरण",
    mfgName: "निर्माता:",
    model: "मॉडल:",
    accClass: "सटीकता वर्ग:",
    maxCap: "अधिकतम क्षमता:",
    minCap: "न्यूनतम क्षमता:",
    e: "सत्यापन स्केल अंतराल (e):",
    n: "स्केल अंतराल की संख्या (n):",
    sec2: "2. प्रयोगशाला और पर्यावरणीय परीक्षण शर्तें",
    lab: "प्रयोगशाला:",
    verifStage: "सत्यापन चरण:",
    subsequent: "बाद का निरीक्षण (सेवा में, 2× MPE)",
    initial: "प्रारंभिक सत्यापन (मानक MPE)",
    testDate: "परीक्षण तिथि:",
    temp: "तापमान:",
    humidity: "नमी:",
    inclination: "झुकाव:",
    sec3Prefix: "3. परीक्षण अवलोकन: ",
    thNum: "#",
    thMethod: "प्रक्रिया",
    thRefLoad: "संदर्भ भार (kg)",
    thIndication: "संकेत (kg)",
    thZero: "शून्य सुधार (kg)",
    thError: "त्रुटि (kg)",
    thMpe: "MPE (kg)",
    thMargin: "मार्जिन (kg)",
    thEdition: "नियम संस्करण",
    thOutcome: "परिणाम",
    thNotes: "साक्ष्य / नोट्स",
    sec4: "4. फोटोग्राफिक साक्ष्य और सहायक अनुलग्नक",
    thFile: "फ़ाइल का नाम",
    thCategory: "श्रेणी",
    thDate: "अपलोड तिथि",
    noAtt: "इस सत्र से जुड़े कोई फोटोग्राफिक या दस्तावेज़ अनुलग्नक नहीं हैं।",
    sec5: "5. समीक्षा अधिकारी की टिप्पणियां",
    verdict: "समग्र मूल्यांकन निर्णय:",
    footer1: "SHA-256 डाइजेस्ट और डिटैच्ड-सिग्नेचर मेटाडेटा रिपोर्ट रिपॉजिटरी में दर्ज किए गए हैं।",
    footer2: "HMAC एक आंतरिक अखंडता टैग है। PKI हस्ताक्षर स्थिति और प्रमाणपत्र फिंगरप्रिंट के लिए सार्वजनिक सत्यापन पोर्टल की जांच करें।"
  }
};

function generateHtmlTemplate({ reportNumber, session, model, manufacturer, observations, attachments, generatedAt, remarks, language = 'en' }) {
  const lbl = LABELS[language] || LABELS.en;
  const verificationUrl = process.env.PUBLIC_APP_URL
    ? \`\${process.env.PUBLIC_APP_URL.replace(/\\/$/, '')}/verify?q=\${encodeURIComponent(reportNumber)}\`
    : \`https://nawi.gov.in/verify?q=\${encodeURIComponent(reportNumber)}\`;
  const qrSvg = generateQrSvg(verificationUrl, 110);

  const annexes = {};
  for (const obs of observations) {
    if (!annexes[obs.annexRef]) annexes[obs.annexRef] = [];
    annexes[obs.annexRef].push(obs);
  }

  const obsSections = Object.keys(annexes).map((annex) => {
    const rows = annexes[annex].map((obs, idx) => \`
      <tr>
        <td>\${idx + 1}</td>
        <td>\${escapeHtml(obs.evaluationMethod)}</td>
        <td>\${obs.referenceLoad ?? '-'}</td>
        <td>\${obs.indicatedValue ?? '-'}</td>
        <td>\${obs.zeroCorrection ?? '-'}</td>
        <td>\${obs.computedError !== undefined && obs.computedError !== null ? (obs.computedError > 0 ? \\\`+\\\${obs.computedError.toFixed(4)}\\\` : obs.computedError.toFixed(4)) : '-'}</td>
        <td>\${obs.appliedMpe !== undefined && obs.appliedMpe !== null ? \\\`±\\\${obs.appliedMpe.toFixed(4)}\\\` : '-'}</td>
        <td>\${obs.marginToMpe !== undefined && obs.marginToMpe !== null ? (obs.marginToMpe >= 0 ? \\\`+\\\${obs.marginToMpe.toFixed(4)}\\\` : obs.marginToMpe.toFixed(4)) : '-'}</td>
        <td>\${escapeHtml(obs.ruleConfigId?.oimlEdition || 'Checklist')}</td>
        <td><strong style="color: \${obs.outcome === 'pass' ? '#16a34a' : '#dc2626'}">\${(obs.outcome || '').toUpperCase()}</strong></td>
        <td>\${escapeHtml(obs.reviewerNotes || '')}</td>
      </tr>
    \`).join('');

    return \`
      <div class="section">
        <div class="section-title">\${lbl.sec3Prefix} \${escapeHtml(annex)}</div>
        <table>
          <thead>
            <tr>
              <th>\${lbl.thNum}</th>
              <th>\${lbl.thMethod}</th>
              <th>\${lbl.thRefLoad}</th>
              <th>\${lbl.thIndication}</th>
              <th>\${lbl.thZero}</th>
              <th>\${lbl.thError}</th>
              <th>\${lbl.thMpe}</th>
              <th>\${lbl.thMargin}</th>
              <th>\${lbl.thEdition}</th>
              <th>\${lbl.thOutcome}</th>
              <th>\${lbl.thNotes}</th>
            </tr>
          </thead>
          <tbody>
            \${rows}
          </tbody>
        </table>
      </div>
    \`;
  }).join('');
  
  let thumbnailsHtml = '';
  if (attachments && attachments.length > 0) {
    const fs = require('fs');
    const path = require('path');
    thumbnailsHtml = attachments.map(att => {
      if (att.fileType && att.fileType.startsWith('image/') && att.path) {
        const p = path.resolve(process.cwd(), att.path);
        if (fs.existsSync(p)) {
          const b64 = fs.readFileSync(p).toString('base64');
          return \`
            <div class="thumbnail-card">
              <img class="thumbnail-img" src="data:\${att.fileType};base64,\${b64}" />
              <div style="margin-top: 4px;">\${escapeHtml(att.originalFilename)}</div>
              <div style="font-family: monospace; font-size: 8px;">\${escapeHtml(att.fileHash?.substring(0, 16))}...</div>
            </div>
          \`;
        }
      }
      return '';
    }).join('');
  }

  return \`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
        <title>\${lbl.reportTitle} - \${escapeHtml(reportNumber)}</title>
      <style>
        body { font-family: 'Helvetica Neue', Arial, sans-serif; padding: 40px; color: #1e293b; line-height: 1.5; }
        .header { display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #0f172a; padding-bottom: 20px; margin-bottom: 30px; }
        .header-title h1 { margin: 0; font-size: 20px; color: #0f172a; text-transform: uppercase; }
        .header-title h2 { margin: 4px 0; font-size: 14px; color: #475569; font-weight: normal; }
        .header-title h3 { margin: 4px 0; font-size: 14px; color: #0f172a; font-family: monospace; }
        .qr-box { text-align: center; font-size: 10px; color: #64748b; }
        .section { margin-bottom: 25px; page-break-inside: avoid; }
        .section-title { font-size: 15px; font-weight: bold; color: #0f172a; border-bottom: 1px solid #cbd5e1; padding-bottom: 5px; margin-bottom: 12px; }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .field { font-size: 13px; }
        .field strong { color: #334155; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 12px; }
        th, td { border: 1px solid #cbd5e1; padding: 7px 9px; text-align: left; }
        th { background-color: #f1f5f9; color: #0f172a; font-weight: bold; }
        .result-box { margin-top: 20px; padding: 12px; border-radius: 6px; text-align: center; font-size: 16px; font-weight: bold; }
        .pass { background-color: #dcfce7; color: #166534; border: 1px solid #86efac; }
        .fail { background-color: #fee2e2; color: #991b1b; border: 1px solid #fca5a5; }
        .footer { margin-top: 30px; padding-top: 15px; border-top: 1px solid #cbd5e1; font-size: 11px; color: #64748b; text-align: center; }
        .thumbnails { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 10px; }
        .thumbnail-card { width: 150px; border: 1px solid #cbd5e1; border-radius: 4px; padding: 4px; text-align: center; font-size: 10px; }
        .thumbnail-img { width: 100%; height: auto; max-height: 100px; object-fit: contain; }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="header-title">
          <h1>\${lbl.deptTitle}</h1>
          <h2>\${lbl.deptSubtitle}</h2>
          <h2>\${lbl.reportHeader}</h2>
          <h3>\${lbl.reportNum} \${escapeHtml(reportNumber)}</h3>
        </div>
        <div class="qr-box">
          \${qrSvg}
          <div style="margin-top:4px;"><a href="\${escapeHtml(verificationUrl)}" style="color:#2563eb;text-decoration:none;">\${lbl.verifyMsg}</a></div>
        </div>
      </div>

      <div class="section">
        <div class="section-title">\${lbl.sec1}</div>
        <div class="grid">
          <div class="field"><strong>\${lbl.mfgName}</strong> \${escapeHtml(manufacturer.name)}</div>
          <div class="field"><strong>\${lbl.model}</strong> \${escapeHtml(model.modelName)}</div>
          <div class="field"><strong>\${lbl.accClass}</strong> Class \${escapeHtml(model.accuracyClass)}</div>
          <div class="field"><strong>\${lbl.maxCap}</strong> \${model.maxCapacity} kg</div>
          <div class="field"><strong>\${lbl.minCap}</strong> \${model.minCapacity} kg</div>
          <div class="field"><strong>\${lbl.e}</strong> \${model.e} kg</div>
          <div class="field"><strong>\${lbl.n}</strong> \${model.n}</div>
        </div>
      </div>

      <div class="section">
        <div class="section-title">\${lbl.sec2}</div>
        <div class="grid">
          <div class="field"><strong>\${lbl.lab}</strong> \${escapeHtml(session.laboratoryName || session.labId)} (\${escapeHtml(session.labId)})</div>
          <div class="field"><strong>\${lbl.verifStage}</strong> \${session.verificationStage === 'subsequent' ? lbl.subsequent : lbl.initial}</div>
          <div class="field"><strong>\${lbl.testDate}</strong> \${new Date(session.testDate).toISOString().split('T')[0]}</div>
          <div class="field"><strong>\${lbl.temp}</strong> \${session.environmentalConditions?.temperatureC ?? 'Not recorded'} °C</div>
          <div class="field"><strong>\${lbl.humidity}</strong> \${session.environmentalConditions?.humidityPercent ?? 'Not recorded'} %</div>
          <div class="field"><strong>\${lbl.inclination}</strong> \${session.environmentalConditions?.inclinationDeg ?? 'Not recorded'} °</div>
        </div>
      </div>

      \${obsSections}

      <div class="section">
        <div class="section-title">\${lbl.sec4}</div>
        \${
          attachments && attachments.length > 0
            ? \`
          <table>
            <thead>
              <tr>
                <th>\${lbl.thNum}</th>
                <th>\${lbl.thFile}</th>
                <th>\${lbl.thCategory}</th>
                <th>\${lbl.thDate}</th>
              </tr>
            </thead>
            <tbody>
              \${attachments
                .map(
                  (att, idx) => \`
                <tr>
                  <td>\${idx + 1}</td>
                  <td>\${escapeHtml(att.originalFilename || att.filename || 'Attachment')}</td>
                  <td>\${escapeHtml(att.fileType || 'Document')}</td>
                  <td>\${new Date(att.createdAt || Date.now()).toISOString().split('T')[0]}</td>
                </tr>
              \`
                )
                .join('')}
            </tbody>
          </table>
          \${thumbnailsHtml ? \`<div class="thumbnails">\${thumbnailsHtml}</div>\` : ''}
        \`
            : \`<p style="font-size: 12px; color: #64748b; font-style: italic;">\${lbl.noAtt}</p>\`
        }
      </div>

      \${
        remarks
          ? \`
      <div class="section">
        <div class="section-title">\${lbl.sec5}</div>
        <p style="font-size: 13px; color: #334155; white-space: pre-wrap;">\${escapeHtml(remarks)}</p>
      </div>
      \`
          : ''
      }

      <div class="result-box \${session.overallResult === 'pass' ? 'pass' : 'fail'}">
        \${lbl.verdict} \${session.overallResult ? session.overallResult.toUpperCase() : 'PENDING'}
      </div>

      <div class="footer">
        <p>\${lbl.footer1}</p>
        <p>\${lbl.footer2}</p>
      </div>
    </body>
    </html>
  \`;
}`;

const startIndex = content.indexOf('function generateHtmlTemplate');
const endIndex = content.indexOf('async function renderPdf');

if (startIndex > -1 && endIndex > -1) {
  content = content.substring(0, startIndex) + replacement + '\n\n' + content.substring(endIndex);
  fs.writeFileSync('src/services/reportGenerator.service.js', content, 'utf8');
}
