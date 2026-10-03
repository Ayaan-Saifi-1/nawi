# NAWI Digital Metrology System — Step-by-Step Demo Walkthrough

This script provides a click-by-click walkthrough for demonstrating the NAWI Digital Metrology Test Report Generation System (OIML R-76 standard).

---

## Demo Prerequisites
- **Client Application**: Runs on `http://localhost:5173` (or port 80 via Docker)
- **Server API**: Runs on `http://localhost:5000`
- **Database**: MongoDB seeded with initial rules and default accounts.

### Default Credentials
| Role | Email | Password | Scope / Laboratory |
|---|---|---|---|
| **System Admin** | `admin@nawi.gov.in` | `Password123!` | System-wide admin |
| **Metrology Expert** | `metrology@nawi.gov.in` | `Password123!` | Rule validation & activation |
| **Lab Technician** | `tech@npl.res.in` | `Password123!` | NPL Delhi (Data entry & outbox) |
| **Reviewer Officer** | `reviewer@doca.gov.in` | `Password123!` | NPL Delhi (Review & Approval) |
| **Lab Admin** | `labadmin@npl.res.in` | `Password123!` | NPL Delhi (Lab administration) |
| **Manufacturer Rep** | `rep@averyindia.com` | `Password123!` | Avery India Ltd (Read-only model scope) |
| **DoCA Controller** | `officer@doca.gov.in` | `Password123!` | Ministry / Legal Metrology Officer |
| **Auditor** | `auditor@nawi.gov.in` | `Password123!` | Append-only audit log review |

---

## Step-by-Step Walkthrough

### Scenario 1: Metrology Rule Governance & Activation (Dual Control)
1. **Login as System Admin**:
   - Navigate to `http://localhost:5173/login`.
   - Enter `admin@nawi.gov.in` / `Password123!`. Click **Sign In**.
   - Click **Rule Configurations** in the top navigation bar.
   - Click **+ Author New Rule Config**. Select `Accuracy Class II`, `Edition R76-1:2006`, add MPE band (`upto 5000e`, factor `0.5`). Click **Save Draft**.
2. **Login as Metrology Expert (Dual Control)**:
   - Logout and login as `metrology@nawi.gov.in` / `Password123!`.
   - Open **Rule Configurations**. Locate the draft rule.
   - Click **Activate Rule**. Provide source reference (e.g. the applicable OIML R-76 edition — UNVERIFIED, PENDING EXPERT) and validation note.
   - Click **Confirm Activation**. Status changes to **Active**.

---

### Scenario 2: Test Session Entry & Compliance Evaluation
1. **Login as Lab Technician**:
   - Logout and login as `tech@npl.res.in` / `Password123!`.
   - Click **Test Sessions** -> **+ New Test Session**.
   - Select Instrument Model `E1205-1500`, enter Serial Number `SN-DEMO-2026-01`, select Annexes `A3_initial_examination`, `A4_accuracy`, `A4_repeatability`.
   - Enter environmental conditions (Temp: `23°C`, Humidity: `55%`, Inclination: `0°`). Click **Create Test Session**.
2. **Add Observations & Attach Evidence**:
   - On the session detail page, click **Add Observation**.
   - Select `A4_accuracy`, evaluation method `mpe_band`, enter Reference Load `100 kg`, Indicated Value `100.2 kg`. Click **Save**.
   - Notice computed error `+0.2 kg`, applied MPE `±0.25 kg`, margin `+0.05 kg`, outcome **PASS**.
   - Scroll to **Attachments**, click **Upload File**, select a photo evidence file (`scale_photo.png`). Notice real-time magic byte signature validation.
3. **Submit Session**:
   - Click **Submit for Review**. Session status transitions to `under_review`.

---

### Scenario 3: Reviewer Inspection, Advisory Flags & Approval
1. **Login as Reviewer**:
   - Logout and login as `reviewer@doca.gov.in` / `Password123!`.
   - Open **Test Sessions** -> select `SN-DEMO-2026-01`.
   - If an advisory anomaly flag (Z-score > 3.5) is flagged, check the **Acknowledge Anomaly** checkbox. Notice overall compliance outcome remains unchanged.
   - Click **Approve Session**. Status transitions to `passed`.

---

### Scenario 4: Automated PDF/DOCX Report Generation & Digital Signing
1. **Generate Report**:
   - Click **Generate Report**. Select **PDF Format**.
   - System compiles OIML R-76 test report, embeds SHA-256 HMAC digital signature signature vector, and attaches dynamic QR verification code.
   - Click **Download PDF Report**.

---

### Scenario 5: Public Verification Portal & Anti-Tampering Test
1. **Verify Official Report**:
   - Open a browser tab to `http://localhost:5173/verify`.
   - Enter the Report Number `NAWI-2026-000001` (or scan QR code URL).
   - Verification status displays **VALID REPORT** with green checkmark, showing intact cryptographic hash.
2. **Demonstrate Tamper Detection Failure**:
   - In the verification portal, enter a modified or invalid cryptographic hash: `51b466801978d8e28e7d352bad821f16164f6149213023fb3c88b95ae217b46x`.
   - Verification status displays **INVALID / TAMPERED REPORT** with red security warning alert.

---

### Scenario 6: Revocation & Append-Only Cryptographic Audit Log
1. **Revoke Report**:
   - Login as `reviewer@doca.gov.in`. Open Reports tab -> click **Revoke Report**. Enter reason `Recalibration required due to physical damage`.
   - Report status transitions to `revoked`.
   - Re-verifying the report number on `/verify` displays **REPORT REVOKED**.
2. **Inspect Audit Log**:
   - Login as `auditor@nawi.gov.in` / `Password123!`.
   - Click **Audit Trail**. View append-only hash-chained logs tracking session creation, observation updates, evaluations, approvals, report generation, and revocation.
