# NAWI Client Smoke Test

Use a seeded environment and the password `Password123!` for each account.

1. Open the client and log in as the technician account from `README.md` (`tech1@nawi.gov.in`). Expected: the technician dashboard loads and the language toggle can switch between English and Hindi without a reload.
2. Open Test Sessions and create a new session for an available instrument model. Expected: the session is created in Draft status.
3. Open the draft, choose the structured accuracy criterion, enter every required field, and save the observation. Expected: Save remains disabled until required fields are complete; after saving, the observation appears with Not evaluated until submission.
4. Add the repeatability criterion. Expected: two empty reading rows are shown, the “At least 2 readings are required” hint is visible, and a row cannot be removed below the minimum.
5. Add the A1 manual checklist, choose Pass or Fail, and enter reviewer notes/evidence. Expected: the checklist observation is saved without changing the client-side verdict.
6. Submit the session for evaluation. Expected: the server evaluates the session and the header shows PASS, FAIL, or Not evaluated from `overallResult`.
7. Reopen the session after evaluation. Expected: structured accuracy results show Load, Indicated, Error, MPE, Margin, and OK? from server `computedErrors`; repeatability/change and manual-checklist details are visible; advisory messages state they do not change the result.
8. Log in as the reviewer account from `README.md` (`reviewer1@nawi.gov.in`). Expected: the submitted session can be reviewed and approved.
9. Approve the evaluation, generate the test report, and publish it using the report workflow. Expected: report generation succeeds and integrity metadata is displayed.
10. Open the public Verify page and enter the published report identifier. Expected: the public verification page displays the published report and its integrity status.

