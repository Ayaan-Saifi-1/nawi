# NAWI Digital Metrology System

> **Smart India Hackathon (SIH) — Problem Statement 26035**  
> An automated, paperless verification and test report generation system for Non-Automatic Weighing Instruments (NAWI) based on the international **OIML R-76:2006** standard.

---

## What is this project?

In legal metrology laboratories (like the National Physical Laboratory and Regional Reference Standard Labs) and commercial weighing scale factories across India, verifying weighing scales is still largely done on paper logbooks and manual calculation sheets. 

Field technicians test scales across multiple weights, manually check whether the scale falls within the **Maximum Permissible Error (MPE)** limits, hand-write error curves, and pass the papers up the chain to reviewing officers.

This creates three big problems:
1. **Human calculation error**: Rounding numbers on a calculator can pass a bad machine or fail a compliant one.
2. **Paper certificates can be faked**: Anyone can forge a paper verification stamp or alter values after the fact.
3. **No field connectivity**: Technicians often test balances in wholesale mandis, warehouses, or remote factory floors where there is zero internet access.

We built this platform to digitize the entire lifecycle — from raw physical observations on the bench to tamper-evident digital certificates with QR-based instant verification.

---

## Core Engineering Decisions

Here are the key things we focused on while building the platform:

### 1. Deterministic BigInt Math (No floating-point rounding bugs)
Standard JavaScript numbers use IEEE 754 floating-point (`0.1 + 0.2 === 0.30000000000000004`). In legal metrology, even microgram rounding discrepancies can cause legal disputes.  
We built our calculation engine entirely on **scaled fixed-point BigInt integer math** (scaling by $10,000$). Every error formula ($E_c = I - L - E_0$), turning-point evaluation, and MPE bracket ($0.5e, 1.0e, 1.5e$) runs deterministically with zero floating-point drift.

### 2. Separation of Duties (Makers cannot be Checkers)
To prevent regulatory fraud, no single user can create and activate a metrology rule.
- Platform Administrators can draft standard rules.
- Only a verified **Metrology Expert** can inspect, validate, and activate rules.
- The system programmatically blocks creators from self-approving their own submissions.

### 3. Offline-First PWA for Field Officers
Field inspectors cannot count on a strong 5G connection when inspecting scales in village markets or remote factories. The frontend is a Progressive Web App (PWA) backed by **Dexie.js (IndexedDB)**. Officers can log in, take instrument readings offline, store raw observations locally, and sync them back to the server the moment their phone or laptop reconnects.

### 4. Cryptographic Report Integrity
Every generated PDF and Word test report has:
- A cryptographic **SHA-256 content digest**.
- An **HMAC-SHA256 integrity tag** signed by the server's private secret.
- An embedded dynamic **QR code** linking directly to the public verification endpoint (`/verify?q=REPORT_NUMBER`) so inspectors in the field can scan a paper printout and verify its authenticity against the database in seconds.

---

## Tech Stack

- **Frontend**: React 18, Vite 6, Tailwind/CSS, Zustand (state management), TanStack Query, Dexie.js (offline storage), Lucide icons.
- **Backend**: Node.js 20 LTS, Express 4 (ES Modules), Mongoose 8.
- **Report Generation**: Puppeteer (Headless Chromium) for pixel-perfect PDF rendering + `docx` engine for Microsoft Word exports.
- **Security**: JWT authentication, Role-Based Access Control (7 distinct roles), Helmet headers, Rate limiting, CORS origin filters.
- **Database**: MongoDB 7+ (with an integrated embedded database fallback so the app can run completely standalone without any external database setup).

---

## Project Structure

```text
nawi/
├── client/                     # React PWA frontend
│   ├── public/                 # Favicons, Indian emblem asset, PWA manifest
│   ├── src/
│   │   ├── components/         # Reusable UI components & 3D charts
│   │   ├── pages/              # App views (Dashboard, Tests, Rules, Verify, etc.)
│   │   ├── services/           # Axios API client & offline sync handlers
│   │   └── store/              # Zustand auth, log, and UI state stores
│   └── vite.config.js          # Vite build & workbox PWA configuration
├── server/                     # Express REST API backend
│   ├── src/
│   │   ├── controllers/        # Request handlers (Sessions, Rules, Reports)
│   │   ├── middleware/         # Auth, RBAC guards, rate limiter, error handler
│   │   ├── models/             # Mongoose schemas (Sessions, Rules, Observations)
│   │   ├── routes/             # REST route endpoints
│   │   ├── seed/               # Database seed scripts for users and OIML rules
│   │   ├── services/           # Scaled compliance engine & Puppeteer PDF generator
│   │   ├── utils/              # BigInt math helpers & QR code builder
│   │   └── server.js           # Express entrypoint
├── render.yaml                 # 1-Click Render Blueprint configuration
└── package.json                # Root build & start scripts
```

---

## Deploying to Render (Free Web Service)

We configured this repository to deploy on Render's **Free Web Service** tier using **Render Blueprint** with zero external database accounts required.

### 1-Click Blueprint Deploy:
1. Open your [Render Dashboard](https://dashboard.render.com/).
2. Click **New +** -> **Blueprint**.
3. Select this repository: `Ayaan-Saifi-1/nawi`.
4. Render will read `render.yaml` automatically.
5. Click **Apply**.

Render will install dependencies, build the frontend SPA into `client/dist`, start the unified backend on port 10000, launch the embedded database, and auto-seed initial accounts.

### Pointing a Custom Domain (e.g. `nawi.matrikaregmi.com.np`):
1. In your Render service, go to **Settings** -> **Custom Domains**.
2. Click **Add Custom Domain** and enter: `nawi.matrikaregmi.com.np`.
3. In your DNS provider, create an **A record**:
   - **Type**: `A`
   - **Name / Host**: `nawi`
   - **Points to / Value**: `216.24.57.1` *(Render's Anycast IP)*
   *(Or create a `CNAME` with Host `nawi` pointing to your `.onrender.com` URL).*
4. Render will automatically issue a free Let's Encrypt SSL certificate once DNS resolves.

---

## Local Development Setup

If you want to run and test everything locally on your machine:

### Prerequisites
- Node.js 20 or higher
- npm 9 or higher
- MongoDB running locally at `mongodb://127.0.0.1:27017` *(optional — if you don't have MongoDB running, the backend will auto-boot an embedded database)*

### 1. Clone and Install
```bash
git clone https://github.com/Ayaan-Saifi-1/nawi.git
cd nawi

# Install all dependencies (server + client)
npm run install:all
```

### 2. Configure Environment
Create a `.env` file in the `server` directory (or copy from `.env.example`):
```env
PORT=5000
NODE_ENV=development
MONGO_URI=mongodb://127.0.0.1:27017/nawi
JWT_SECRET=super_secret_jwt_key_at_least_32_characters_long!
CLIENT_ORIGIN=http://localhost:5173
PUBLIC_APP_URL=http://localhost:5173
```

### 3. Seed Database
Populate standard test accounts, OIML R-76 rules, instrument models, and demonstration laboratories:
```bash
npm run seed
```

### 4. Run Both Servers
Start the backend and frontend in separate terminals:

```bash
# Terminal 1 - Backend API (runs on http://localhost:5000)
npm run dev

# Terminal 2 - Frontend Client (runs on http://localhost:5173)
cd client
npm run dev
```

---

## Pre-loaded Demonstration Accounts

When the database is seeded, the following demo users are ready for testing (all accounts share the same password):

> **Default Password for all accounts**: `Password123!`

| Role | Email | What they can do |
| :--- | :--- | :--- |
| **System Administrator** | `admin@nawi.gov.in` | Global settings, manage users, draft compliance rules |
| **Metrology Expert** | `metrology@nawi.gov.in` | Review, validate, and activate draft compliance rules |
| **Lab Technician** | `tech@npl.res.in` | Run test sessions, record weight observations, upload evidence |
| **Reviewing Officer** | `reviewer@doca.gov.in` | Inspect completed test sessions, approve/reject, generate final PDF reports |
| **Legal Metrology Officer** | `officer@doca.gov.in` | Regulatory oversight and legal audits across lab records |
| **Manufacturer Representative** | `rep@averyindia.com` | Submit weighing instrument specifications and review test outcomes |
| **Metrology Auditor** | `auditor@nawi.gov.in` | View tamper-evident audit logs and trace report hashes |

---

## Running the Automated Tests

To run the unit and integration test suite:

```bash
cd server
npm test
```

The test suite covers:
- **BigInt Error Calculations**: Testing accuracy limits against known standard weights across Classes I, II, III, and IIII.
- **Rule Governance**: Verifying that rule authors cannot self-activate draft rules.
- **Security & Authorization**: Testing role-based route guards and cross-tenant access barriers.
- **HMAC Digest Verification**: Validating that reports fail integrity checks if a single byte is tampered with.

---

## License & Credits

Built for the **Smart India Hackathon (SIH)** under Problem Statement **26035** (Digital Metrology Test Report Generation System).  
Standards implementation based on **OIML R-76:2006** (Non-automatic weighing instruments).
