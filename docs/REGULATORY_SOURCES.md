# Regulatory source register

## Scope

The SIH blueprint identifies the Legal Metrology Act, 2009, the Legal Metrology (General) Rules, 2011, and OIML R-76 as the system's regulatory context. The Department of Consumer Affairs source page supplied by the project team is the official starting point for the Indian Act and rules. It lists the original General Rules, corrigendum, and subsequent amendments.

This register records source discovery. It does not certify that the rule data currently loaded in the application is a complete or legally current transcription. Before activating production rules, reconcile the applicable non-automatic weighing instrument provisions, corrigenda, and amendments against the Gazette texts and the governing OIML edition, then have the result reviewed by a metrology expert.

## Sources

| Source | Use in this project | Review state |
|---|---|---|
| [Department of Consumer Affairs — Legal Metrology Act and rules](https://consumeraffairs.gov.in/pages/legal-metrology-act) | Official index to the Act, Legal Metrology (General) Rules, 2011, corrigendum, and amendments. The page was checked on 2026-09-28. | Index located; individual amendments not yet consolidated into an approved rule set |
| [Legal Metrology (General) Rules, 2011](https://consumeraffairs.gov.in/public/upload/files/6_0_1732709495.pdf) | Base rules linked from the official Department page. | Requires clause-by-clause review for the applicable NAWI provisions |
| [Legal Metrology (General) Amendment Rules, 2026](https://consumeraffairs.gov.in/public/upload/files/LM_General_Rule_Amendment_2026_1768192719.pdf) | Officially indexed 2026 amendment; review together with the base rules and other amendments. | Not yet incorporated into the application's rule configuration |
| [Legal Metrology overview](https://consumeraffairs.gov.in/pages/legal-metrology-overview) | Department overview of the role and scope of the General Rules. | Context only; the Gazette text controls rule transcription |

## Rule configuration controls

- Store a precise source reference for every activated rule, including instrument class, clause or schedule, Gazette notification/amendment, and effective date.
- Keep source discovery separate from expert approval. A link to an official document is not itself evidence that the application has interpreted or implemented its clauses correctly.
- Run the rule sandbox and review any changed historical outcomes before activation.
- Retain the reviewed source reference and test evidence with the rule version so historical evaluations remain reproducible.
