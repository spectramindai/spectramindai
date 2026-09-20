# CMMC combined verification — 12 September 2026

Result: all CMMC application checks in this verification scope pass. Requirements, SPRS, dashboard, policy, and audit-readiness views now share the same evidence-validated control state.

## Environment and scope

Verified local source after removing the seven requested CMMC modules. Used an isolated PostgreSQL database, all 13 committed migrations, seeded framework data, the real Fastify application, and the React frontend connected to that API. Synthetic test accounts and evidence were used. No Azure production environment or existing customer database was tested or modified.

## Verified results

| Area | Result and evidence |
|---|---|
| Build and static checks | Frontend ESLint and production build; backend TypeScript check and production build passed. |
| Automated tests | 33 tests across six test files passed. |
| Catalogue | 110 unique controls, 14 domains; domain totals sum to 110. |
| Browser navigation | Overview, Scope, Requirements, Gap Wizard, Uploaded Evidence, POA&M, SSP, Policies, Calendar, SPRS, assessment record, domain summary, and auditor pages rendered. Audit-readiness correctly redirects to the shared audits page with the CMMC filter. No console errors captured during this navigation. |
| Removed modules | No removed tabs in the CMMC navigation. Their dedicated implementations remain deleted. |
| Scope and documents | Scope answers and SSP/POA&M fields persisted and were read back through the API. |
| Evidence and completion | Missing uploads and unapproved evidence blocked completion. Upload bytes, objective mappings, approval, completion, and authenticated download passed. |
| Scoring | Initial score -203. Approved evidence covering all six objectives of AC.L2-3.1.1 enabled completion and increased score to -198. Deleting the evidence returned score to -203 and completed count to zero. |
| Calendar | Saved a record linked to a real control and evidence. Stale version save rejected. |
| Policies | 110 policy-view rows derived from control/evidence data. Shared owner and in-progress status propagated in tests. CMMC's generic policies.json is empty; its dedicated policy view uses workspace data instead. |
| Tenant isolation | Other tenant denied access to the first tenant's evidence; its workspace returned an independent 110-control default state. |
| PDF primitive | Shared SSP/POA&M PDF generator produced an application/pdf payload. Full populated export rendering and downloads were not verified. |

## Fixes applied during verification

1. Shared domain filter now derives from the full domain catalogue, restoring Configuration Management and Identification and Authentication.
2. Added Not Applicable to the shared status filter.
3. SPRS page shows explicit loading and error states instead of displaying zero totals before a successful response.
4. SPRS refresh now ignores older overlapping responses and refreshes on session changes; absent sessions clear metrics.
5. Added connected catalogue/policy tests and a reusable isolated-database smoke script at backend/scripts/cmmc-smoke.ts. It requires CMMC_VERIFY_ISOLATED=true and must only be run with a disposable database.
6. Evidence replacement, rejection, restore, and deletion now immediately downgrade affected completed controls, update implementations, preserve the invalidation reason, and write an activity event.
7. Requirements, policies, audit readiness, and dashboard metrics now consume the same effective evidence-validated control state as SPRS.
8. Workspace writes use optimistic versions, reject stale saves, protect server-owned state fields, and refresh across active sessions.
9. CMMC audit readiness now uses control readiness and avoids loading CMMC metrics for unrelated frameworks.
10. Dashboard chart containers now provide stable dimensions; the browser verification produced no console warnings or errors.

## Resolved findings

The prior evidence-lifecycle disagreement is resolved. The regression sequence now proves that replacement upload intent, rejection, version restore, and deletion all revoke completion until the current evidence is uploaded, mapped to every assessment objective, approved, and the control is completed again. After deletion, SPRS returns -203, dashboard returns zero implemented controls and 0% readiness, and workspace-backed views return the affected control as In Progress with `evidenceIncomplete: true`.

The audit metric disagreement is also resolved. The CMMC audit page labels and displays the same control-readiness percentage used by SPRS. A new browser session showed 0% on both pages for a fresh 110-control workspace.

## Verification limits

This was a focused functional verification, not a guarantee that every edge case is covered. Full multi-browser concurrent editing, long-running session changes, every assessment edit, every document export, production infrastructure, and load/security testing remain outside the verified result. The production build still reports a non-blocking large JavaScript bundle warning.

The combined CMMC application workflow is ready for release testing. Production deployment still requires the infrastructure controls documented in the root and backend READMEs, including durable object storage and malware scanning for evidence, production identity controls, rate limiting, secrets management, monitoring, backups, and verified database isolation.
