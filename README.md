# NAWI Digital Metrology Test Report Generation System (SIH PS 26035)

Digital Metrology Test Report Generation System for Non-Automatic Weighing Instruments (NAWI) in accordance with the International Organization of Legal Metrology (OIML R-76:2006 standard).

---

## Table of Contents

- [Overview](#overview)
- [Architecture and Tech Stack](#architecture-and-tech-stack)
- [Key Features](#key-features)
- [Approved Technical Deviations](#approved-technical-deviations)
- [First-Run Setup and Quickstart](#first-run-setup-and-quickstart)
- [Database Seeding and Pre-loaded Accounts](#database-seeding-and-pre-loaded-accounts)
- [Project Directory Structure](#project-directory-structure)
- [Available Scripts](#available-scripts)
- [Verification and Testing](#verification-and-testing)
- [System Limitations](#system-limitations)

---

## Overview

This platform automates metrological verification, error calculation, and test report generation for Non-Automatic Weighing Instruments (NAWI) under the OIML R-76:2006 international recommendation.

The platform provides a compliant, secure digital workflow replacing physical logbooks and paper-based verification forms used in legal metrology testing laboratories and manufacturer test benches.

---

## Architecture and Tech Stack

- **Backend Runtime**: Node.js 20 LTS, Express 4 (ES Modules)
- **Frontend Framework**: React 18, Vite 6, TanStack Query, Zustand, React Router 6
- **Database**: MongoDB 7+, Mongoose 8 ORM
- **Precision Calculations**: Deterministic fixed-point BigInt scaled-integer math (scaled by factor of 10,000)
- **Document Generation**: Puppeteer Headless Chromium for PDF rendering and docx engine for Word reports
- **Security and Authentication**: JSON Web Tokens (JWT), Role-Based Access Control (RBAC), Helmet, Express Rate Limiting
- **Deployment and Process Management**: Docker Compose, PM2, Nginx reverse proxy

---

## Key Features

1. **Deterministic Metrological Compliance Engine**
   - Evaluates Maximum Permissible Error (MPE) thresholds (0.5e, 1.0e, 1.5e) across accuracy classes I, II, III, and IIII.
   - Prevents floating-point inaccuracies by implementing deterministic scaled BigInt integer operations for rounding and error assessment.

2. **Rule Governance and Separation of Duties**
   - Metrological rules are authored in draft mode by administrators.
   - Independent verification and activation must be performed by a designated Metrology Expert.
   - Creators are programmatically restricted from self-activating rules.

3. **Multi-Tenant Scoping and Access Control**
   - Strict organization and role scoping for Laboratories, Manufacturers, Metrology Experts, and Reviewing Officers.
   - Fine-grained endpoint authorization guards prevent cross-tenant record tampering.

4. **Cryptographic Report Integrity**
   - Generated verification reports embed a SHA-256 payload digest and cryptographic HMAC signatures.
   - Detached public key signature verification supports external PKI HSM/KMS adapters.

5. **Offline Progressive Web App (PWA)**
   - Allows field technicians to execute test sessions during site visits without continuous internet access.
   - Queues offline observations locally and synchronizes automatically upon reconnecting.

---

## Approved Technical Deviations

In alignment with architectural directives:

1. **Database Backend**: MongoDB with Mongoose schema validation is utilized in place of relational SQL engines to accommodate dynamic schema requirements across distinct instrument classes.
2. **Language Runtime**: Implemented in Modern JavaScript (ES Modules) with strict linting, Zod schema validation, and Jest unit/integration test coverage.

---

## First-Run Setup and Quickstart

### Prerequisites

- Node.js 20.0.0 or higher
- npm 9.0.0 or higher
- MongoDB instance running at `mongodb://127.0.0.1:27017` (or MongoDB via Docker)

### 1. Configure Server Environment

Navigate to the `server` directory and create the `.env` configuration file:

```bash
cd server
cp .env.example .env
```

Ensure `.env` contains valid parameters:

```env
PORT=5000
NODE_ENV=development
MONGO_URI=mongodb://127.0.0.1:27017/nawi
JWT_SECRET=super_secret_nawi_digital_metrology_system_jwt_token_key_64_chars_long
JWT_EXPIRES_IN=8h
BCRYPT_SALT_ROUNDS=10
CLIENT_ORIGIN=http://localhost:5173
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=500
REPORT_INTEGRITY_SECRET=change_me_to_a_random_64_char_secret_for_hmac_sha256_integrity
PUBLIC_APP_URL=http://localhost:5173
ENABLE_DEMO=false
```

### 2. Install Dependencies

Install packages for both server and client:

```bash
# Install backend dependencies
cd server
npm install

# Install frontend dependencies
cd ../client
npm install
```

### 3. Seed Database

Execute the database migration and seeding pipeline from the `server` folder:

```bash
cd server
npm run seed
```

This populates default user roles, OIML R-76 rule definitions, instrument models, and demonstration laboratories.

### 4. Run Development Servers

Run backend and frontend concurrently in separate terminal windows:

Terminal 1 (Backend):
```bash
cd server
npm run dev
```

Terminal 2 (Frontend):
```bash
cd client
npm run dev
```

The frontend application will be accessible at `http://localhost:5173` and the API at `http://localhost:5000/api`.

---

## Database Seeding and Pre-loaded Accounts

All seeded demonstration accounts are initialized with the password: `Password123!`

| Role | Email | Scope and Organization |
| :--- | :--- | :--- |
| System Administrator | admin@nawi.gov.in | Global Platform Administration |
| Metrology Expert | metrology@nawi.gov.in | Rule Governance and Standards Validation |
| Laboratory Admin | labadmin@npl.res.in | National Physical Laboratory (LAB-DELHI-01) |
| Lab Technician | tech@npl.res.in | NPL Delhi Laboratory Bench |
| Reviewing Officer | reviewer@doca.gov.in | Department of Consumer Affairs (DoCA) |
| Legal Metrology Officer | officer@doca.gov.in | DoCA Regulatory Division |
| Manufacturer Representative | rep@averyindia.com | Avery India Ltd |
| Metrology Auditor | auditor@nawi.gov.in | Independent Compliance and Audit Review |

---

## Project Directory Structure

```text
nawi/
├── client/                      # React SPA Frontend (Vite)
│   ├── public/                  # Manifest and Static Assets
│   ├── src/
│   │   ├── components/          # Shared Components and UI Elements
│   │   ├── config/              # Constants and OIML R-76 Specifications
│   │   ├── pages/               # Application Views (Dashboard, Tests, Rules)
│   │   ├── services/            # Axios API Client and Services
│   │   ├── store/               # Zustand Global State Stores
│   │   ├── App.jsx              # Main App Routing
│   │   └── main.jsx             # React DOM Entrypoint
│   └── vite.config.js           # Vite Server and PWA Configuration
├── server/                      # Express REST API Backend
│   ├── src/
│   │   ├── config/              # Database and Environment Settings
│   │   ├── controllers/         # Request Handlers
│   │   ├── middleware/          # Authentication, Scoping, and Error Handlers
│   │   ├── models/              # Mongoose Data Schemas
│   │   ├── routes/              # Express API Routes
│   │   ├── scripts/             # Database Maintenance Scripts
│   │   ├── seed/                # Unified Seeding Pipeline
│   │   ├── services/            # Compliance Engine, Audit Logger, PDF Builder
│   │   ├── utils/               # Scaled Integer Arithmetic and Helpers
│   │   └── server.js            # HTTP Server Entrypoint
│   └── package.json             # Backend Dependencies
├── docs/                        # Specifications and Traceability Documentation
│   ├── DEVIATIONS.md            # Documented Architecture Decisions
│   ├── GAP_INPUT.md             # Gap Analysis Matrix
│   ├── OPEN_QUESTIONS.md        # Technical Query Log
│   └── TRACEABILITY.md          # Requirements Traceability Matrix
├── signer/                      # RSA Digital Signature Adapter Service
├── docker-compose.yml           # Multi-Container Compose Configuration
└── README.md                    # Project Documentation
```

---

## Available Scripts

### Backend (`server/`)

- `npm run dev`: Start backend in watch mode with automatic reload.
- `npm start`: Launch production backend process.
- `npm run seed`: Run unified database seed pipeline.
- `npm run seed:users`: Populate initial user accounts.
- `npm run seed:rules`: Populate standard OIML R-76 compliance rules.
- `npm run migrate:manufacturer-ref`: Migrate manufacturer references.
- `npm run migrate:report-revisions`: Migrate report revision indexes.
- `npm test`: Run automated test suites via Jest.

### Frontend (`client/`)

- `npm run dev`: Launch Vite local development server.
- `npm run build`: Compile static production distribution to `client/dist`.
- `npm run preview`: Serve local production build preview.
- `npm test`: Run unit tests via Vitest.
- `npm run test:e2e`: Execute end-to-end testing with Playwright.

---

## Verification and Testing

Execute the automated test suite to validate metrology math precision, rule lifecycle, and authorization scoping:

```bash
cd server
npm test
```

The test suite evaluates:
- Fixed-point BigInt accuracy for MPE error margin limits.
- Enforced separation of duties during rule activation.
- Role-based route guards and tenancy boundaries.
- PDF generation engine and HMAC integrity calculation.

---

## System Limitations

1. **Storage Backend**: Default storage for test evidence and PDF reports is mounted on the server filesystem (`server/uploads/`). Production deployments can be mapped to S3/Cloud Storage object storage.
2. **Instrument Coverage**: Primary configurations target Non-Automatic Weighing Instruments (OIML R-76). Automatic weighing instruments (such as OIML R-51 or R-107) require separate rule schemas.
3. **Integrity Mode**: Development mode utilizes internal HMAC-SHA256 signatures. High-assurance legal verification requires connecting to an accredited X.509 PKI certificate service.
