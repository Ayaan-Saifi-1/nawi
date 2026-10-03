# PS 26035 — OIML R-76 NAWI Type Evaluation & Metrological Verification System
## Comprehensive Implementation Documentation & API Specification

---

### Executive Summary & System Overview

This document serves as the authoritative technical reference for **PS 26035**, an enterprise-grade digital metrology evaluation and verification system built strictly according to **OIML R 76-1 (2006)**, **OIML R 76-2 (2007)**, and the **Indian Legal Metrology (Non-Automatic Weighing Instruments) Rules**.

The platform automates the end-to-end lifecycle of weighing instrument type evaluations:
1. **Applicant & Model Registration**: Registration of manufacturers and instrument models with metrological parameter validation ($e$, $n = \text{Max}/e$, capacity bounds).
2. **Laboratory Test Capture**: Environmental recording (temperature, humidity, inclination) and multi-procedure test observation capture (Annex A.1 through A.6 and Annex B).
3. **MPE Evaluation Engine**: Arbitrary-precision exact-decimal calculations for Maximum Permissible Error (MPE) bands ($\le 500e, \le 2000e, > 2000e$) with verification stage multipliers ($1.0\times$ initial, $2.0\times$ in-service).
4. **Rule Configuration Sandbox**: Versioned rule configs with expert review and historical regression analysis.
5. **Report & Certificate Generation**: Automated PDF (Puppeteer) and DOCX (`docx`) report rendering with SHA-256 content hashes, HMAC integrity tags, and external RSA PKI digital signatures.
6. **Public Verification Portal**: Public verification of official test certificates using Report Number or SHA-256 document hash.
7. **Cryptographic Audit Trail**: Tamper-evident hash-chained audit logging ($H_k = \text{SHA256}(H_{k-1} + \text{payload}_k)$) with schema-level immutability enforcement.
8. **Offline-First PWA Engine**: Progressive Web App with Dexie IndexedDB draft storage and background outbox sync.

---

## 1. System Architecture & Tech Stack

### Tech Stack Matrix
| Layer | Technologies Used | Key Responsibilities |
|---|---|---|
| **Frontend Framework** | React 18, React Router v6, Vite 6 | SPA UI rendering, responsive off-canvas drawer navigation, dynamic form grids. |
| **State & Data Fetching** | TanStack Query v5, Zustand, Dexie.js | API state caching, offline IndexedDB session/outbox management. |
| **Styling & Aesthetics** | Vanilla CSS (Custom Design System), Lucide Icons | Government visual design guidelines (GIGW), dark/light contrast, touch responsive tables. |
| **i18n Engine** | Custom Context i18n (`client/src/config/i18n.js`) | Instant switching between English and Hindi across UI components. |
| **Backend Runtime** | Node.js (ES Modules), Express.js | REST API, role-based authorization, request validation, error handling. |
| **Database & ODM** | MongoDB, Mongoose 8 | Schema modeling, indexes, transactional updates, multi-tenant queries. |
| **Document Generator** | Puppeteer (Chrome/Chromium), `docx` | PDF and DOCX certificate generation with QR code embedding. |
| **Crypto & Signatures** | Node.js `crypto`, Isolated RSA Signer | SHA-256 hashing, HMAC tagging, RSA-2048 PKI certificate signing. |

---

## 2. Metrological Calculations & Rule Engine

### Metrological Definitions
- **Verification Scale Interval ($e$)**: Value expressed in units of mass, used for classification and testing of an instrument.
- **Scale Division Count ($n$)**: Computed as $n = \frac{\text{Max}}{e}$.
- **Accuracy Classes**:
  - **Class I (Special)**: $n \ge 50,000$, $e \ge 1\text{ mg}$
  - **Class II (High)**: $100 \le n \le 100,000$, $e \ge 1\text{ mg}$
  - **Class III (Medium)**: $100 \le n \le 10,000$, $e \ge 0.1\text{ g}$
  - **Class IIII (Ordinary)**: $100 \le n \le 1,000$, $e \ge 5\text{ g}$

### Standard MPE Tolerance Bands (Class III Example)
| Load Range (in multiples of $e$) | Initial Verification MPE ($\pm e$) | In-Service / Subsequent MPE ($\pm e$) |
|---|---|---|
| $0 \le m \le 500e$ | $\pm 0.5e$ | $\pm 1.0e$ |
| $500e < m \le 2000e$ | $\pm 1.0e$ | $\pm 2.0e$ |
| $2000e < m \le 10000e$ | $\pm 1.5e$ | $\pm 3.0e$ |

### Error & Margin Formulas
$$\text{Indication Error } E = I - L - E_0$$
$$\text{Error Ratio } E/e = \frac{E}{e}$$
$$\text{Margin to MPE} = \text{MPE} - |E|$$
$$\text{Verdict} = \begin{cases} \text{PASS}, & \text{if } |E| \le \text{MPE} \\ \text{FAIL}, & \text{if } |E| > \text{MPE} \end{cases}$$

---

## 3. Role-Based Access Control (RBAC) Matrix

| Role Key | Role Name | Primary Responsibilities & Permissions |
|---|---|---|
| `admin` | System Administrator | Full access: user provisioning, system configuration, audit review. |
| `doca_officer` | Controller / DoCA Officer | Government oversight, manufacturer management, final policy administration. |
| `metrology_expert` | Domain Metrology Expert | Technical review of rule drafts, historical regression sandbox execution, rule activation. |
| `reviewer` | Reviewing Officer | Session evaluation review, approval or rejection with notes, certificate sign-off trigger. |
| `lab_admin` | Laboratory Administrator | Facility management, technician oversight, test session tracking. |
| `lab_technician` | Lab Technician | Environmental capture, observation entry, attachment uploads, session submission. |
| `manufacturer` | Applicant / Manufacturer | Register instrument models, view published test reports for own models. |
| `auditor` | Independent Auditor | Read-only access to published reports, audit logs, integrity verification, and data exports. |

---

## 4. Complete REST API Endpoint Reference

### Auth & User Management (`/api/auth`, `/api/users`)
- `POST /api/auth/login`: Authenticate user credentials. Returns JWT bearer token containing `sub`, `role`, `labId`, `manufacturerRef`, `tokenVersion`.
- `POST /api/auth/register`: Provision a new user (Admin / Lab Admin only).
- `POST /api/auth/change-password`: Change user password, incrementing `tokenVersion` to invalidate active tokens.
- `GET /api/users`: List system users with pagination.
- `PATCH /api/users/:id`: Update user role or activation status.

### Manufacturers & Registries (`/api/manufacturers`, `/api/laboratories`)
- `POST /api/manufacturers`: Create a manufacturer record (`admin`, `doca_officer`).
- `GET /api/manufacturers`: List manufacturers. `manufacturer` role sees only their assigned company profile.
- `PATCH /api/manufacturers/:id`: Update manufacturer details (`admin`, `doca_officer`).
- `DELETE /api/manufacturers/:id`: Delete manufacturer record. Blocked if models reference it (`409 MANUFACTURER_IN_USE`).
- `GET /api/laboratories`: List accredited laboratories.
- `POST /api/laboratories`: Create laboratory facility (`admin`, `doca_officer`).

### Instrument Models (`/api/instrument-models`)
- `POST /api/instrument-models`: Create instrument model with $e$, Max, Min, Class validation.
- `GET /api/instrument-models`: List instrument models (filtered by tenant for manufacturers).
- `GET /api/instrument-models/:id`: Retrieve single model details.
- `PATCH /api/instrument-models/:id`: Update model fields. Modifying metrological specs is blocked if test history exists (`409 MODEL_IN_USE`).
- `DELETE /api/instrument-models/:id`: Delete model. Blocked if test sessions exist.
- `GET /api/instrument-models/:id/history`: View model evaluation history and latest report revisions.

### Test Sessions & Observations (`/api/test-sessions`)
- `POST /api/test-sessions`: Create new OIML R-76 test session with environmental conditions.
- `GET /api/test-sessions`: List test sessions (filtered by tenant).
- `GET /api/test-sessions/:id`: Get session details, observations, results, and attachments.
- `POST /api/test-sessions/:id/observations`: Record metrological observation ($L$, $I$, $E_0$ or manual checklist).
- `PATCH /api/test-sessions/:id/observations/:obsId`: Update recorded observation.
- `DELETE /api/test-sessions/:id/observations/:obsId`: Delete observation.
- `POST /api/test-sessions/:id/submit`: Submit session for evaluation. Calculates errors, MPE limits, anomaly Z-scores, and sets `submittedBy`/`submittedAt`.
- `POST /api/test-sessions/:id/approve`: Approve session (`reviewer`, `admin`). Blocked if actor submitted the session (`403 SEPARATION_OF_DUTIES`).
- `POST /api/test-sessions/:id/reject`: Return session to draft with mandatory reviewer notes. Blocked if actor submitted the session.
- `POST /api/test-sessions/sync/batch`: Replay offline outbox mutation batch idempotently using `clientSyncId`.

### Rule Configurations & Regression Sandbox (`/api/rule-configs`)
- `GET /api/rule-configs`: List versioned OIML rule configurations.
- `POST /api/rule-configs`: Create new draft rule configuration with custom tolerance bands (`admin`).
- `POST /api/rule-configs/:id/sandbox`: Execute historical regression comparison on saved observations. Returns outcome deltas and SHA-256 result hash.
- `POST /api/rule-configs/:id/activate`: Activate rule configuration with gazette source reference (`metrology_expert`).

### Reports & Certificates (`/api/reports`)
- `POST /api/reports/:sessionId/generate`: Render PDF/DOCX report with SHA-256 hashes, HMAC tags, and optional officer remarks.
- `GET /api/reports`: List generated test reports (manufacturers see `published` reports only).
- `GET /api/reports/:id`: Get report metadata.
- `GET /api/reports/:id/download/:format`: Download PDF or DOCX file. Validates stored file hash against database signature before serving.
- `POST /api/reports/:id/publish`: Publish report (`overallResult === 'pass'` required; failed reports block publication).
- `POST /api/reports/:id/archive`: Archive report version.
- `POST /api/reports/:id/revoke`: Revoke report certificate with mandatory revocation reason.

### Public Verification Portal (`/api/verify`)
- `GET /api/verify/:query`: Public endpoint to verify a certificate by Report Number or SHA-256 PDF hash. Returns verification badge, PDF integrity status, and revocation/supersession banners.

### Attachments (`/api/attachments`)
- `POST /api/test-sessions/:id/attachments`: Upload calibration photo or document. Computes SHA-256 hash, validates magic bytes, and cleans up temporary files on failure.
- `GET /api/test-sessions/:id/attachments`: List attachments for a session.
- `GET /api/attachments/:attachmentId/download`: Download attached file.

### Audit Log & Integrity (`/api/audit-log`)
- `GET /api/audit-log`: List audit trail entries.
- `GET /api/audit-log/integrity`: Verify cryptographic hash chain ($H_k = \text{SHA256}(H_{k-1} + \text{payload}_k)$).

### Data Export (`/api/export`)
- `GET /api/export/legal-metrology`: Download instant JSON export of published reports.
- `POST /api/export/jobs`: Create async export job (JSON or CSV). Neutralizes CSV formula injection characters (`=`, `+`, `-`, `@`).
- `GET /api/export/jobs/:jobId`: Check job status.
- `GET /api/export/jobs/:jobId/download`: Download generated export payload.

---

## 5. Security & Cryptographic Integrity

1. **Tamper-Evident Audit Hash Chain**:
   - Every state-changing action writes an immutable record to `AuditLog`.
   - Payload hash: $H_k = \text{SHA256}(H_{k-1} \parallel \text{JSON.stringify}(\text{entry}_k))$.
   - Database level: unique index on `prevHash` with 5-attempt retry loop on concurrent writes, plus Mongoose `pre` hooks throwing errors on any `update` or `delete` attempt.
2. **Separation of Duties**:
   - Prevents same-user approval: `submittedBy` is logged on session submit. Approval and rejection endpoints throw `403 SEPARATION_OF_DUTIES` if the reviewer is the submitter.
3. **Attachment Validation**:
   - Verifies binary magic bytes (JPEG `FF D8 FF`, PNG `89 50 4E 47`, PDF `%PDF`, DOCX `PK..`, WebP `RIFF...WEBP`).
   - Automatically unlinks temporary files on any validation or permission failure.
4. **CSV Formula Injection Prevention**:
   - Any cell value starting with `=`, `+`, `-`, `@`, `\t`, or `\r` is escaped with a leading single quote `'`.

---

## 6. Test Suite & Verification Results

The automated test suite in `server/tests` consists of **9 test suites** running 28 comprehensive unit and integration tests:

| Test Suite | Coverage | Status |
|---|---|:---:|
| `auth.test.js` | JWT login, registration validation, 401 unauthenticated access checks. | **PASS** |
| `complianceEngine.test.js` | MPE band bounds, exact-decimal calculations, $n$-class limits, manual checklist evaluation. | **PASS** |
| `digitalSignature.test.js` | External PKI RSA signature service adapter & certificate fingerprint validation. | **PASS** |
| `e2e.test.js` | Full Lifecycle: Session creation $\rightarrow$ Observations $\rightarrow$ Attachments $\rightarrow$ Submission $\rightarrow$ PDF/DOCX Report Generation $\rightarrow$ Public Verification $\rightarrow$ Audit Trail $\rightarrow$ Revocation. | **PASS** |
| `p10.test.js` | Model history, regex input escaping, pagination safety caps, export job downloads. | **PASS** |
| `p11.test.js` | Offline batch outbox sync replay and `clientSyncId` idempotency. | **PASS** |
| `p12.test.js` | Upload magic byte validation, account lockout, change-password token invalidation, role-endpoint matrix checks. | **PASS** |
| `ruleResolver.test.js` | Effective date-based rule resolution and version selection. | **PASS** |
| `ruleSandbox.test.js` | Expert regression sandbox execution, outcome delta calculation, result hashing. | **PASS** |

---
*Documentation generated automatically for PS 26035 Repository.*
