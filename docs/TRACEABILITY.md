# Traceability Matrix (FR-01 to FR-15)

| Requirement ID | Description | Implementing Files (Server & Client) | Test Files | Status |
|---|---|---|---|---|
| **FR-01** | User Authentication & Role-Based Access Control | `server/src/controllers/auth.controller.js`, `server/src/middleware/authenticate.js`, `server/src/middleware/authorize.js`, `client/src/store/useAuthStore.js` | `server/tests/auth.test.js` | **Done** |
| **FR-02** | Environmental & Metrological Condition Capture | `server/src/models/TestSession.js`, `server/src/controllers/testSession.controller.js`, `client/src/pages/testSessions/NewTestSessionPage.jsx` | `server/tests/e2e.test.js` | **Done** |
| **FR-03** | OIML R-76 Test Annex Selection & Execution | `server/src/models/Observation.js`, `server/src/services/complianceEngine.service.js`, `client/src/pages/testSessions/TestSessionDetailPage.jsx` | `server/tests/complianceEngine.test.js` | **Done** |
| **FR-04** | Dynamic Config-Driven Form & Rule Resolution | `server/src/models/RuleConfig.js`, `server/src/services/ruleResolver.service.js`, `server/src/controllers/ruleConfig.controller.js` | `server/tests/ruleResolver.test.js` | **Done** |
| **FR-05** | Fixed-Point MPE Error Calculation & Margin Determination | `server/src/services/complianceEngine.service.js` | `server/tests/complianceEngine.test.js` | **Done** |
| **FR-06** | Multi-Annex Session Compliance Determination | `server/src/services/complianceEngine.service.js`, `server/src/controllers/testSession.controller.js` | `server/tests/complianceEngine.test.js` | **Done** |
| **FR-07** | Reviewer Approval & Rejection Loop Workflow | `server/src/controllers/testSession.controller.js`, `client/src/pages/testSessions/TestSessionDetailPage.jsx` | `server/tests/e2e.test.js` | **Done** |
| **FR-08** | Automated PDF & DOCX Test Report Generation | `server/src/services/reportGenerator.service.js`, `server/src/controllers/report.controller.js`, `client/src/pages/reports/ReportsPage.jsx` | `server/tests/e2e.test.js` | **Done** |
| **FR-09** | Photo & Document Evidence Attachments | `server/src/models/Attachment.js`, `server/src/controllers/attachment.controller.js`, `client/src/pages/testSessions/TestSessionDetailPage.jsx` | `server/tests/e2e.test.js` | **Done** |
| **FR-10** | Integrity Verification, Vector QR Code & Digital Signing | `server/src/utils/qrGenerator.js`, `server/src/utils/hash.js`, `server/src/controllers/report.controller.js` | `server/tests/e2e.test.js` | **Done** |
| **FR-11** | Public Verification Portal & Report Lookup | `server/src/controllers/verify.controller.js`, `client/src/pages/verify/VerifyPage.jsx` | `server/tests/e2e.test.js` | **Done** |
| **FR-12** | Multi-Tenant Data Isolation (Laboratory & Manufacturer) | `server/src/utils/tenantAccess.js`, `server/src/controllers/testSession.controller.js`, `server/src/controllers/report.controller.js` | `server/tests/auth.test.js` | **Done** |
| **FR-13** | Append-Only Cryptographic Audit Logging | `server/src/models/AuditLog.js`, `server/src/services/auditLogger.service.js`, `server/src/controllers/auditLog.controller.js`, `client/src/pages/auditLog/AuditLogPage.jsx` | `server/tests/e2e.test.js` | **Done** |
| **FR-14** | National Dashboard & Analytics | `server/src/controllers/dashboard.controller.js`, `client/src/pages/dashboard/DashboardPage.jsx` | `server/tests/e2e.test.js` | **Done** |
| **FR-15** | Versioned Rule Authoring, Review & Activation | `server/src/controllers/ruleConfig.controller.js`, `client/src/pages/ruleConfigs/RuleConfigsPage.jsx` | `server/tests/ruleResolver.test.js` | **Done** |
