# Open Questions & Metrology Assumptions

| # | Question / Topic | Current Implementation | Blueprint Ref | Target Role | Status |
|---|---|---|---|---|---|
| 1 | MPE Band Selection per Observation | Band chosen from test `referenceLoad` in multiples of e (`referenceLoad <= uptoMultipleOfE * e`). Confirm boundary inclusive semantics. | §9.2, §9.3, R-01 | Metrology Advisor | Pending Sign-off |
| 2 | Mandatory Test Types per Class/Category | Session evaluation requires all selected annexes to pass. Need formal mapping of mandatory annexes per instrument class (I, II, III, IIII). | §9.3 | Metrology Advisor | Pending Sign-off |
| 3 | Numeric Criteria for Annexes A4–A6 & Annex B | Non-A4 accuracy tests use `manual_checklist` with reviewer notes until numeric criteria (e.g. eccentricity position load limits, temperature coefficient limits, ESD voltage levels) are defined in `RuleConfig.testCriteria`. | FR-03, FR-05, FR-06 | Metrology Advisor | Pending Sign-off |
| 4 | Change-point Error Correction Formula | Rounding error formula ($E = I + \frac{1}{2}e - \Delta L - L$) to be enabled as a configurable flag in `RuleConfig`. | §9.2 | Metrology Advisor | Pending Sign-off |
| 5 | TSA Timestamping Service | Trusted Time-Stamp Authority (RFC 3161) integration planned for Phase 5; currently using server system clock with trusted signing key. | FR-10, §11.2 | Metrology Advisor | Pending Sign-off |
