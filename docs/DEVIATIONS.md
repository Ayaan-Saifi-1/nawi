# Approved Technical Deviations

> Approved by Team Lead for SIH 26035 Implementation

1. **Programming Language**: JavaScript (Node.js ES Modules / React JS), NOT TypeScript.
2. **Database Engine**: MongoDB via Mongoose ORM, NOT PostgreSQL.
3. **Application Architecture**: Express Modular Monolith (packaged as distinct service modules: `complianceEngine`, `ruleResolver`, `reportGenerator`, `auditLogger`), NOT distributed microservices.
4. **Storage & Keys**: Local disk storage (`uploads/`) for attachments & generated reports; Software-key signer abstraction interface (Ed25519 / RSA-PSS) ready for HSM integration.
5. **Offline Client**: Installable PWA (Service Worker + IndexedDB + Outbox Sync), approved deviation from Electron desktop client.
