# SpectraMind

SpectraMind is a multi-tenant compliance workspace for organizing security frameworks, implementations, controls, tests, policies, evidence, training, employees, risks, tasks, audits, vendors, and a customer-facing Trust Center. The repository contains a React single-page application, a Fastify API, a PostgreSQL database managed through Prisma, framework catalogue data for SOC 2, ISO 27001, and CMMC, and GitHub Actions automation for Microsoft Azure.

This document is the technical source of truth for the repository. It explains the runtime architecture, user and organization lifecycle, permissions, frontend modules, API surface, database schema, evidence storage, Azure deployment, local development, testing, and every maintained file group in the project.

> Status note: Azure production uses the backend API and PostgreSQL. Some frontend services still contain a browser-storage fallback for running the UI without an API when `VITE_API_URL` is blank. That fallback is useful for local prototyping but is not shared between browsers, devices, or Chrome profiles.

## Contents

1. [System architecture](#system-architecture)
2. [Technology stack](#technology-stack)
3. [Repository structure](#repository-structure)
4. [User, role, and organization lifecycle](#user-role-and-organization-lifecycle)
5. [Frontend application](#frontend-application)
6. [Backend application](#backend-application)
7. [API reference](#api-reference)
8. [PostgreSQL and Prisma data model](#postgresql-and-prisma-data-model)
9. [Framework catalogue and relationships](#framework-catalogue-and-relationships)
10. [Evidence lifecycle and file storage](#evidence-lifecycle-and-file-storage)
11. [Progress and score calculation](#progress-and-score-calculation)
12. [Azure architecture and deployment](#azure-architecture-and-deployment)
13. [Local development](#local-development)
14. [Testing and validation](#testing-and-validation)
15. [Security and operational considerations](#security-and-operational-considerations)
16. [Complete file catalogue](#complete-file-catalogue)

## System architecture

```text
Browser
  |
  | HTTPS
  v
Azure Static Web Apps
  React 19 + React Router + Vite + Tailwind
  |
  | JSON API, JWT Authorization, x-organization-id
  v
Azure Linux App Service
  Fastify 5 + Zod + Prisma
  |                         |
  | TLS                     | evidence bytes
  v                         v
Azure PostgreSQL       /home/data/files
Flexible Server        persistent App Service storage
```

The browser receives the compiled React application from Azure Static Web Apps. After authentication, the frontend stores the API session and sends the JWT in the `Authorization: Bearer <token>` header. Tenant-scoped requests also send `x-organization-id`. The backend does not trust the role embedded in the browser session: `requireTenant` looks up the current membership in PostgreSQL on every tenant request and derives the effective organization and role from that membership.

The API validates input with Zod, applies authorization rules, reads and writes data through Prisma, records important actions in `ActivityEvent`, and stores uploaded evidence metadata in PostgreSQL. Evidence routes currently write bytes directly to App Service persistent storage. `ports/storage.ts` defines the future `FileStorage` abstraction that should replace this direct filesystem implementation when Azure Blob Storage is introduced.

### Production and local-fallback modes

| Mode | `VITE_API_URL` | Accounts and workspace data | File/data sharing |
|---|---|---|---|
| Azure production | Backend App Service URL | PostgreSQL through API | Shared across authorized users |
| Local full stack | `http://localhost:4000` | Local PostgreSQL through API | Shared within the local database |
| Frontend-only prototype (`npm run dev` only) | Empty | Scoped browser storage | Limited to that browser profile and origin |

Production builds now stop at a configuration screen when `VITE_API_URL` is empty, preventing an Azure deployment from silently treating browser storage as its database. Changing Chrome profiles loses access only to frontend-only development data and remembered sessions; it does not lose PostgreSQL business data in API mode. Integrations remain intentionally browser-backed until their provider/OAuth implementation is completed.

## Technology stack

### Frontend

- React 19 and React DOM 19.
- React Router 7 for public, protected, onboarding, framework, and CMMC routes.
- Vite 8 for development and production builds.
- Tailwind CSS 3 plus application CSS for layout and visual styling.
- Lucide React for icons.
- Recharts for dashboard visualizations.
- `read-excel-file` for employee spreadsheet imports.
- JavaScript for the main application and TypeScript/TSX for reusable engine modules.

### Backend

- Node.js 22 or newer using ECMAScript modules.
- Fastify 5 for the HTTP server.
- `@fastify/jwt` for signed authentication tokens.
- `@fastify/cors` and Helmet for cross-origin and baseline HTTP security.
- Zod for environment, parameter, query, and body validation.
- Prisma 6 for PostgreSQL access and migrations.
- bcryptjs for password hashing.
- Swagger/OpenAPI and Swagger UI at `/api/docs`.
- Vitest for automated tests.

### Infrastructure

- GitHub Actions for CI/CD.
- Azure Static Web Apps for the React bundle.
- Azure Linux App Service Basic B1 for the API.
- Azure Database for PostgreSQL Flexible Server for relational state.
- TLS/HTTPS enforced between clients, services, and the database.

## Repository structure

```text
tsaro_labs-vanta/
├── .github/workflows/          Azure deployment workflow
├── backend/                    Fastify, Prisma, migrations, tests, storage
├── spectramind/                React application and framework libraries
├── AZURE_DEPLOYMENT.md         Short Azure operator checklist
├── README.md                   This complete technical guide
└── package-lock.json           Historical root dependency lock
```

The deployable projects are `spectramind/` and `backend/`; each has its own `package.json` and lock file. Commands should normally be run from the relevant subdirectory.

## User, role, and organization lifecycle

### Account registration

Registration accepts a name, normalized lowercase email, password, and requested UI role (`Admin`, `Manager`, or `User`). Passwords are hashed before storage. Requested roles map to database membership roles as follows:

| UI role | Database role | Intended access |
|---|---|---|
| Admin | `OWNER` for the organization creator, otherwise `ADMIN` | Workspace management |
| Manager | `COMPLIANCE_MANAGER` | Same main management level as Admin |
| User | `EMPLOYEE` | Operational access without destructive management |

A user who registers as `User` cannot create an organization. Admins and Managers may create one organization when their account has no membership. An account with an existing membership cannot create another organization.

### Authentication

Login normalizes email, compares the supplied password with the bcrypt hash, and rejects incorrect credentials. A normal session lasts eight hours; “Remember me” produces a 30-day token. Registration also produces a 30-day onboarding token. The frontend detects expired authorization, clears the stale session, and returns the user to login rather than continuing with invalid state.

### Forgot/reset password

`POST /auth/forgot-password` creates a single-use, hashed reset token and invalidates earlier unused tokens. In development the raw token may be returned for local testing. Production deliberately does not return it to the browser. A transactional email implementation must be connected to the `EmailSender` port before production reset emails are delivered.

### Organization creation and invitations

Only an Admin or Manager can create an organization. The creator receives `OWNER` or `COMPLIANCE_MANAGER` membership according to the requested role. Managers can create employee records manually or import them from the provided Excel template.

Invitations are internal database records, not browser mail redirects. Emails are trimmed and lowercased, so invitation matching is case-insensitive. When the invited person registers or logs in with the same email, `/invitations/me` displays the pending invitation. Accepting it creates an organization membership and connects the existing employee row to that membership.

At present, invitations are visible inside SpectraMind but no external email-delivery provider is configured. Gmail, Azure Communication Services Email, SendGrid, or another provider must be added if actual email messages are required.

### Employee removal and evidence retention

- Revoking a pending invitation marks it `REVOKED` and removes the provisional employee row.
- Removing a joined employee deletes their organization membership, immediately preventing tenant API access.
- The manager cannot remove their own employee profile through this flow.
- Evidence is attributed to a stable user UUID rather than cascading through the employee row. Removing an employee therefore preserves uploaded evidence, versions, mappings, history, and audit usefulness.
- Evidence deletion is a separate soft-delete operation and is restricted to management roles.

### Role switching

The employee edit form calls `PATCH /memberships/:id/role` when a joined employee’s system role changes. The backend updates the membership, synchronized employee access/job role, invitation role, and activity history. Users cannot change their own role. Authorization always uses the current database membership, so an old JWT cannot preserve elevated rights after a downgrade.

## Frontend application

### Bootstrap and context hierarchy

`src/main.jsx` mounts the React tree and global CSS. The application providers supply the user session, selected framework workspace, and shared compliance state. `src/App.jsx` defines all routes. `ProtectedRoute` blocks anonymous users, `OnboardingRequired` requires organization onboarding, and `ActiveFrameworkOutlet` prevents framework-dependent modules from opening before the organization selects a framework.

### Public routes

| Route | Page | Purpose |
|---|---|---|
| `/` | `Landing` | Marketing home page |
| `/about`, `/faq`, `/contact` | Informational pages | Company and contact content |
| `/pricing`, `/testimonials` | Marketing pages | Plans and social proof |
| `/solutions/soc2`, `/solutions/iso27001`, `/solutions/cmmc` | Solution pages | Framework-specific product information |
| `/login`, `/signup` | Authentication | Existing and new accounts |
| `/forgot-password`, `/reset-password` | Recovery | Password-reset workflow |

### Protected/onboarding routes

| Route | Purpose |
|---|---|
| `/onboarding/organization` | Create the single organization and initial employee invitations |
| `/join-organization` | Show and accept pending invitation for the signed-in email |
| `/profile`, `/profile-settings` | Display/update user-facing profile details |
| `/settings` | Workspace organization settings |
| `/frameworks` | Framework catalogue, cart, checkout, and selected frameworks |
| `/dashboard` | Combined organization score or selected-framework score |
| `/trust-center` | Public assurance profile and access-request management |

### Compliance routes

| Route | Purpose |
|---|---|
| `/questionnaire` | Framework questionnaire runs and answers |
| `/implementation` | Unified risks, controls, tests, policies, and populations workspace |
| `/policies` | Framework-filtered policy library and assignments |
| `/policies/:policyId/document` | Dedicated shared policy-document page |
| `/training`, `/training/:trainingId` | Training library, document, assignments, and completion |
| `/employees` | Employee table, role/access management, invitations, import, compliance status |
| `/evidence` | Evidence repository and lifecycle |
| `/vendors` | Vendor inventory and assessments |
| `/audits` | Audits, readiness findings, review, and resolution |
| `/tasks` | Framework tasks and work tracking |
| `/integrations`, `/comments`, `/assistant` | Supporting workspace modules |

### Framework selection and cart

Only Admins and Managers may add frameworks to the cart and check out. Cart items are not active frameworks until checkout succeeds through `/organization-frameworks/checkout`. The organization’s active framework list then drives sidebar availability, dashboard filters, training visibility, policy synchronization, tasks, risks, controls, and CMMC access. Users can work inside selected frameworks but cannot select additional frameworks.

### Dashboard

The dashboard offers an “All frameworks” combined view and one tab per selected framework. It uses persisted control implementation, evidence, questionnaire, task, policy, and related workspace state rather than arbitrary display percentages. With no completed work or uploaded evidence, scores begin at zero. Combined values aggregate the selected organization frameworks; individual tabs isolate that framework.

### Implementation and cross-module navigation

The implementation page loads framework libraries and displays risk scenarios, controls, tests, policies, and populations. Query parameters such as `framework`, `itemType`, and `itemId` open an exact record. `crossModuleNavigation.js` builds links so connected tests open the corresponding test in Implementation and policies/documents open the shared policy document. Closing a detail page returns to the originating context—Implementation stays in Implementation, while the Policies workspace returns to Policies.

### Policies

Predefined framework policies are synchronized from the framework library and visible by default. Custom policies start as drafts and are only visible to regular users after a Manager publishes them. Managers can edit metadata, assign employees, upload or delete documents, publish policies, and manage acknowledgements. The right-side implementation panel remains available for quick context, while selecting the mapped document opens the full dedicated document page backed by the same record.

### Training

Training is filtered to the organization’s selected frameworks. Managers/Admins can synchronize defaults, create custom training, edit courses, choose frameworks, due dates, and assignments. Users open the training document and select “Mark as completed.” Completion is stored per assignment and can be removed again; managers see employee completion totals and individual progress.

### Employees

The page supports manual creation, Excel import, editing, portal-access toggle, background-check completion, system-role switching for joined members, internal invitation creation/revocation, and employee removal. Duplicate email addresses are blocked case-insensitively. The spreadsheet template expects employee name, email, system role, employee type, access, dates, and tags; imported rows are previewed and validated before creation.

### Audits, tasks, risks, vendors, and Trust Center

- Audits show useful readiness findings, severity, ownership, status, reviewer comments, and resolution rather than disconnected mock statistics.
- Tasks synchronize applicable framework tasks and support owner, due-date, priority, and status changes.
- Risks synchronize catalogue risks and allow custom risks, likelihood, impact, treatment, ownership, and due dates.
- Vendors store inventory metadata and assessment history.
- Trust Center uses the same computed compliance data as the dashboard so readiness percentages remain synchronized. Managers configure organization profile fields and process access requests.

### Frontend API layer

`src/api/client.js` is the common transport. It reads `VITE_API_URL`, attaches JSON headers, JWT, and organization ID, parses error bodies, persists the API session, maps database roles to UI labels, and handles expired tokens. Files under `src/api/` are thin domain wrappers:

- `assurance.js`: audits and vendors.
- `cmmc.js`: CMMC SPRS data.
- `dashboard.js`: combined/framework dashboard.
- `evidence.js`: upload intents, byte upload, completion, versions, review, comments, download, and deletion.
- `organizations.js`: organization, invitations, role changes, membership removal.
- `people.js`: employees, policies, training, assignments, background checks.
- `questionnaires.js`: definitions, runs, answers, submission.
- `trust.js`: Trust Center profile and requests.
- `workflows.js`: tasks and risks.
- `workspace.js`: generic per-item workspace state.

## Backend application

### Server construction

`src/server.ts` builds and listens on `HOST`/`PORT`. `src/app.ts` creates Fastify, configures a 100 MiB octet-stream parser, Helmet, CORS, JWT, Swagger, routes, structured validation/error responses, health endpoints, and Prisma shutdown. `src/config.ts` is the single validated environment boundary.

### Authentication and tenant isolation

`registerAuth` adds JWT verification. Public authentication routes use `app.authenticate` where necessary. Tenant route modules install `requireTenant`, which:

1. verifies the JWT;
2. requires `x-organization-id`;
3. fetches `OrganizationMembership` by organization and user;
4. rejects missing membership;
5. stores trusted `organizationId`, `userId`, and `role` on `request.tenant`.

Queries then include the trusted organization ID. Management functions allow `OWNER`, `ADMIN`, and `COMPLIANCE_MANAGER`; selected assurance/evidence operations also recognize specialized manager roles present in the schema.

### Validation and concurrency

Zod rejects malformed emails, UUIDs, dates, enums, lengths, and oversized collections. Several mutable models carry a `version` integer. PATCH routes compare the supplied version and return `409 VERSION_CONFLICT` if another writer updated the record, preventing silent overwrites.

### Activity history

Important actions—organization creation, invitation acceptance/revocation, role updates, employee creation/removal, evidence review, policy acknowledgement, training completion, audit review/resolution, and similar workflow changes—create `ActivityEvent` rows with actor, entity, action, timestamp, and optional JSON metadata.

## API reference

All business routes are under `/api/v1`. Unless marked public, they require `Authorization: Bearer <JWT>`. Tenant routes additionally require `x-organization-id: <UUID>`.

### Platform and authentication

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | Process health; does not test PostgreSQL |
| GET | `/ready` | PostgreSQL readiness using `SELECT 1` |
| GET | `/api/docs` | Swagger UI |
| POST | `/api/v1/auth/register` | Create account and optional initial organization |
| POST | `/api/v1/auth/login` | Password login; supports remember-me duration |
| POST | `/api/v1/auth/forgot-password` | Create password reset token |
| POST | `/api/v1/auth/reset-password` | Consume token and replace password |
| GET | `/api/v1/auth/me` | Return authenticated user and organization membership |

### Organizations, membership, and invitations

| Method | Path | Purpose |
|---|---|---|
| POST | `/organizations` | Create the user’s only organization (Admin/Manager) |
| GET/PATCH | `/organizations/current` | Read/update tenant organization |
| GET | `/invitations/me` | Pending invitations matching current email |
| GET/POST | `/invitations` | Manager list/create internal invitations |
| POST | `/invitations/:token/accept` | Join invited organization |
| DELETE | `/invitations/:id` | Revoke pending invitation and remove provisional employee |
| PATCH | `/memberships/:id/role` | Change another member’s role |
| DELETE | `/memberships/:id` | Remove another membership |

### Frameworks, controls, dashboard, and workspace

| Method | Path | Purpose |
|---|---|---|
| GET | `/frameworks` | Global seeded framework catalogue |
| GET | `/organization-frameworks` | Active selections for tenant |
| POST | `/organization-frameworks` | Add one framework (manager) |
| POST | `/organization-frameworks/checkout` | Atomically activate cart frameworks |
| GET | `/controls?frameworkId=` | Controls and organization implementations |
| PATCH | `/controls/:controlId/implementation` | Update status, owner, due date, notes |
| GET | `/dashboard` | Combined or selected-framework metrics |
| GET | `/workspace` | Get generic stored module/item states |
| PUT | `/workspace/:itemId` | Upsert generic item state |

### Questionnaires

| Method | Path | Purpose |
|---|---|---|
| GET | `/questionnaires/:frameworkId` | Read framework definition and current run |
| POST | `/questionnaire-runs` | Start a run |
| PUT | `/questionnaire-runs/:runId/answers/:questionId` | Upsert answer |
| POST | `/questionnaire-runs/:runId/submit` | Submit and lock/score the run |

### Evidence

| Method | Path | Purpose |
|---|---|---|
| GET | `/evidence` | List non-deleted evidence with versions/mappings/comments |
| POST | `/evidence/upload-intents` | Create record/version and upload target |
| PUT | `/evidence/:evidenceId/versions/:versionId/content` | Upload raw bytes |
| POST | `/evidence/:evidenceId/versions/:versionId/complete` | Verify bytes and move to review |
| GET | `/evidence/:evidenceId/download` | Download active version |
| POST | `/evidence/:evidenceId/versions/upload-intent` | Create a replacement version |
| POST | `/evidence/:evidenceId/versions/:versionId/restore` | Restore earlier version |
| POST | `/evidence/:evidenceId/review` | Approve/reject with reason |
| POST | `/evidence/:evidenceId/comments` | Add history comment |
| DELETE | `/evidence/:evidenceId` | Management soft delete |

Deleted evidence remains in PostgreSQL for audit history but is excluded from lists, mappings, downloads, version operations, and dashboard totals.

### Employees, policies, and training

| Method | Path | Purpose |
|---|---|---|
| GET/POST | `/employees` | List/create people records |
| PATCH/DELETE | `/employees/:id` | Edit/remove employee and membership |
| POST | `/employees/:id/background-check` | Record completion |
| POST | `/policies/sync` | Upsert predefined framework policies |
| GET/POST | `/policies` | List/create policies |
| PATCH | `/policies/:id` | Update/publish/archive policy |
| PUT | `/policies/:id/assignments` | Replace employee assignments |
| POST | `/policy-assignments/:id/acknowledge` | User acknowledgement |
| DELETE | `/policy-assignments/:id/acknowledgement` | Manager clears acknowledgement |
| POST | `/training/sync` | Synchronize selected-framework defaults |
| GET/POST | `/training` | List/create courses |
| PATCH/DELETE | `/training/:id` | Edit/delete custom course |
| PUT | `/training/:id/assignments` | Replace assignments |
| POST | `/training-assignments/:id/complete` | Mark completed |
| DELETE | `/training-assignments/:id/completion` | Remove completion |

### Tasks and risks

| Method | Path | Purpose |
|---|---|---|
| GET | `/tasks` | List selected-framework tasks |
| POST | `/tasks/sync` | Upsert tasks from catalogue |
| PATCH | `/tasks/:taskId` | Update status/priority/owner/date |
| GET | `/risks` | List risks |
| POST | `/risks/sync` | Upsert framework risks |
| POST | `/risks` | Create custom risk |
| PATCH | `/risks/:riskId` | Update assessment/treatment |

### Assurance and CMMC

| Method | Path | Purpose |
|---|---|---|
| GET/POST | `/vendors` | List/create vendors |
| PATCH | `/vendors/:id` | Update vendor |
| POST | `/vendors/:id/assessments` | Create assessment |
| GET/POST | `/audits` | List/create audits |
| POST | `/audits/readiness/sync` | Synchronize calculated findings |
| PATCH | `/audits/:id` | Change audit status |
| POST | `/audits/:id/findings` | Add finding |
| POST | `/audit-findings/:id/review` | Reviewer confirmation/comments |
| POST | `/audit-findings/:id/resolve` | Manager resolution |
| GET | `/cmmc/sprs` | CMMC SPRS score and practice breakdown |

### Trust Center

| Method | Path | Purpose |
|---|---|---|
| GET/PUT | `/trust-center/profile` | Read/update organization assurance profile |
| GET/POST | `/trust-center/requests` | List/create access requests |
| PATCH | `/trust-center/requests/:id` | Approve, reject, or revoke request |

## PostgreSQL and Prisma data model

`backend/prisma/schema.prisma` defines all enums, relations, indexes, unique constraints, and cascade behavior.

### Identity and tenancy

| Model | Responsibility |
|---|---|
| `User` | Name, unique normalized email, password hash, requested role, memberships, resets |
| `PasswordResetToken` | Hashed single-use reset token, expiry, use timestamp |
| `Organization` | Tenant name, slug, contact details, logo/branding and all tenant relations |
| `OrganizationMembership` | One organization per user, trusted role, optional employee link |
| `OrganizationInvitation` | Case-normalized email, role, token, status, inviter, acceptance/revocation |
| `Employee` | Organization people record, membership link, role, employment metadata, access, tags |

`OrganizationMembership` is the authorization record. `Employee` is the compliance/HR presentation record. They are connected but serve different purposes.

### Enums and state machines

| Enum | Values/purpose |
|---|---|
| `MembershipRole` | Owner, administrator, compliance/security/HR manager, or employee authority |
| `InvitationStatus` | Pending, accepted, or revoked invitation lifecycle |
| `ImplementationStatus` | Not started, in progress, implemented, or not applicable |
| `QuestionnaireStatus` | Questionnaire run lifecycle |
| `EvidenceStatus` | Pending upload, processing/review, approved, rejected, or expired |
| `TaskStatus` | Task work lifecycle |
| `RiskLikelihood`, `RiskLevel`, `RiskTreatmentStatus` | Risk probability/severity and treatment workflow |
| `PolicyStatus` | Draft, active/published, or archived |
| `AssignmentStatus` | Assigned or completed training state |
| `VendorRisk`, `AssessmentStatus` | Vendor risk rating and assessment workflow |
| `AuditStatus`, `FindingStatus`, `FindingSeverity` | Audit/finding lifecycle and severity |
| `TrustRequestStatus` | Trust access-request workflow |

### Framework and implementation

| Model | Responsibility |
|---|---|
| `Framework` | Global seeded framework metadata |
| `OrganizationFramework` | Tenant’s active framework selections |
| `Control` | Global control definitions imported by seed |
| `ControlImplementation` | Tenant-specific control status, owner, dates, notes, version |
| `WorkspaceItemState` | Flexible JSON state for additional framework items/modules |
| `QuestionnaireRun` / `QuestionnaireAnswer` | Tenant questionnaire execution and answer values |

### Work and assurance

| Model | Responsibility |
|---|---|
| `Task` | Framework/custom work item, status, priority, owner, due date |
| `Risk` | Likelihood, impact, inherent/residual level, treatment and ownership |
| `Vendor` / `VendorAssessment` | Third-party register and assessment snapshots |
| `Audit` / `AuditFinding` | Audit lifecycle, readiness findings, review and resolution |
| `ActivityEvent` | Immutable-style tenant activity log metadata |

### People content

| Model | Responsibility |
|---|---|
| `Policy` | Synced/custom metadata, generated or uploaded document content, custom field values, version history, re-acknowledgement preference and publication status |
| `PolicyAssignment` | Employee assignment and acknowledgement |
| `TrainingCourse` | Synced/custom training document, frameworks and due date |
| `TrainingAssignment` | Employee assignment, status and completion identity/time |

### Evidence

| Model | Responsibility |
|---|---|
| `EvidenceRecord` | Logical evidence, framework/test/implementation context, status, owner, review, soft delete |
| `EvidenceVersion` | Filename, MIME type, size, object key, uploader, upload time |
| `EvidenceMapping` | Many-to-many bridge between evidence and controls |
| `EvidenceComment` | User-attributed evidence history comments |

### Trust Center

| Model | Responsibility |
|---|---|
| `TrustCenterProfile` | Organization assurance profile and visibility settings |
| `TrustAccessRequest` | Requester identity, message, status, reviewer and expiry |

### Migration history

Migrations are applied in timestamp order:

1. `20260712170000_initial`: identity, organizations, memberships, frameworks, controls, implementations, and activity foundation.
2. `20260712183000_questionnaires_evidence`: questionnaire and evidence base tables.
3. `20260712192656_vendors_audits`: vendors, assessments, audits, findings.
4. `20260712200000_tasks_risks`: task and risk workflows.
5. `20260712201221_workspace_state`: flexible workspace persistence.
6. `20260712201901_evidence_lifecycle`: evidence review/version/comment lifecycle.
7. `20260713010000_people_policies_training`: employees, policies, training, assignments.
8. `20260716130000_organization_invitations_roles`: invitation and role workflow.
9. `20260718120000_trust_center`: Trust Center profile and requests.
10. `20260720100000_password_resets`: password recovery tokens.
11. `20260721183000_evidence_context`: test and implementation identifiers on evidence.

Never edit an already-applied migration. Change `schema.prisma`, create a new migration locally, review its SQL, and commit both.

## Framework catalogue and relationships

`spectramind/src/core/framework-library/{soc2,iso27001,cmmc}` contains the canonical static definitions. Each framework directory has the same contract:

| File | Content |
|---|---|
| `framework.json` | ID, slug, name, version, description and framework metadata |
| `controls.json` | Control/practice definitions and domains |
| `tests.json` | Implementation tests linked to controls/policies |
| `policies.json` | Predefined policy documents and metadata |
| `risks.json` | Risk scenarios and framework associations |
| `tasks.json` | Recommended implementation work |
| `evidence.json` | Expected evidence definitions |
| `questionnaire.json` | Questions and response metadata |
| `mappings.json` | Cross-module IDs/relationships |
| `audit-rules.json` | Readiness/finding generation rules |
| `ai-guidance.json` | Guidance text for assistant-oriented experiences |

The frontend framework engine loads these catalogues for navigation and rich client presentation. During Azure build, `copy-framework-library.mjs` copies them into the backend artifact. During startup, Prisma migrations run and `seed.ts` upserts frameworks and controls so checkout and tenant APIs use the same IDs as the frontend.

Relationship services build links such as Policy → Test → Control → Evidence → Risk/Task. Navigation always uses stable catalogue IDs, which is why exact-item deep links work across Implementation, Policies, and CMMC pages.

## Evidence lifecycle and file storage

1. Frontend requests an upload intent with framework, title, filename, content type, size, tags, mappings, test ID, and implementation ID.
2. Backend creates `EvidenceRecord` and initial `EvidenceVersion`, returning a PUT URL.
3. Frontend uploads raw bytes as `application/octet-stream`.
4. Backend currently resolves the tenant/evidence object key beneath `LOCAL_FILE_ROOT`, creates its directories, and writes the bytes directly with the Node filesystem API.
5. Frontend calls completion; backend verifies the file and marks the evidence ready for review.
6. Managers approve or reject it, add comments, upload new versions, restore previous versions, or soft-delete it.

Production currently uses `LOCAL_FILE_ROOT=/home/data/files`. `/home` is persistent for a single App Service instance, but this is a demo-scale solution. Multi-instance or production-grade deployment should implement the existing storage interface using Azure Blob Storage, malware scanning, encryption/key policy, retention, and backup controls.

Employee removal does not delete evidence. Evidence deletion sets `deletedAt`; it does not erase the database history or bytes immediately. Deleted records are excluded from active lists and scores.

## Progress and score calculation

`DashboardScoreService`, progress-engine services, CMMC metric services, and backend dashboard routes calculate progress from persisted completion/evidence state. Scores are scoped by active framework and can be combined. Trust Center reads the same underlying state so it does not invent a separate readiness percentage.

Important rules:

- unstarted items and missing evidence contribute zero;
- evidence must be attached to the correct control/test context;
- each framework is calculated independently before combined aggregation;
- deleted evidence is excluded;
- CMMC SPRS uses its dedicated service and rule weighting rather than the generic percentage;
- UI colors are presentation only and do not alter score weight.

## Azure architecture and deployment

### Provisioned resources

| Resource | Name | Purpose |
|---|---|---|
| Resource group | `rg-spectramind-demo` | Resource boundary |
| Static Web App | `swa-spectramind-demo` | React frontend |
| Linux App Service | `app-spectramind-api-demo` | Fastify API |
| PostgreSQL Flexible Server | `psql-spectramind-demo` | Relational database |
| Database | `spectramind` | Application schema |

### CI/CD

`.github/workflows/azure-deploy.yml` runs for pushes to `codex/consolidate-project-structure` and manual dispatches. The frontend job checks out the repository and lets Azure Static Web Apps build `spectramind` into `dist`. The backend job uses Node 22, runs `npm ci`, Prisma generation, framework-library copy, TypeScript build, removes development dependencies, and deploys `backend/` through the App Service publish profile.

Required GitHub Actions secrets:

- `AZURE_STATIC_WEB_APPS_API_TOKEN`
- `AZURE_WEBAPP_PUBLISH_PROFILE`

Never commit these values.

### App Service variables

| Name | Production value/purpose |
|---|---|
| `NODE_ENV` | `production` |
| `HOST` | `0.0.0.0` |
| `PORT` | Injected by Azure |
| `TRUST_PROXY` | `true` |
| `DATABASE_URL` | PostgreSQL URL with URL-encoded password and TLS |
| `JWT_SECRET` | Random secret, at least 32 characters |
| `JWT_EXPIRES_IN` | Default signing duration; login overrides normal/remember sessions |
| `CORS_ORIGINS` | Exact Static Web App HTTPS origins, comma-separated |
| `FRAMEWORK_LIBRARY_PATH` | `/home/site/wwwroot/framework-library` |
| `LOCAL_FILE_ROOT` | `/home/data/files` |
| `SCM_DO_BUILD_DURING_DEPLOYMENT` | `false` |

Database URL shape:

```text
postgresql://spectraadmin:URL_ENCODED_PASSWORD@psql-spectramind-demo.postgres.database.azure.com:5432/spectramind?schema=public&sslmode=verify-full
```

Characters such as `@`, `:`, `/`, `?`, `#`, and `%` inside the password must be URL encoded. The hostname begins after the separating `@`; text that is part of the password must not be mistaken for the server suffix.

### Startup

App Service startup command:

```bash
npm run start:azure
```

This runs `prisma migrate deploy`, seeds the global framework catalogue, and starts `dist/src/server.js`. Configuration changes usually restart the App Service when applied; an explicit restart is recommended after database/CORS changes.

### Verification

```text
https://app-spectramind-api-demo.azurewebsites.net/health
https://app-spectramind-api-demo.azurewebsites.net/ready
https://app-spectramind-api-demo.azurewebsites.net/api/docs
```

`/health` proves the Node process is serving. `/ready` proves PostgreSQL credentials/network/TLS are working. `P1000` in Log Stream means invalid database credentials; CORS browser errors require checking the exact Static Web App origin and allowed methods.

## Local development

### Requirements

- Node.js 22+
- npm
- Docker Desktop (recommended for local PostgreSQL) or an existing PostgreSQL server
- Python only when regenerating framework libraries

### Start PostgreSQL

```bash
cd backend
docker compose up -d
```

### Configure and start backend

```bash
cd backend
cp .env.example .env
npm ci
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

API: `http://localhost:4000`; documentation: `http://localhost:4000/api/docs`.

### Configure and start frontend

```bash
cd spectramind
cp .env.example .env.local
```

Set:

```text
VITE_API_URL=http://localhost:4000
```

Then:

```bash
npm ci
npm run dev
```

Open `http://localhost:5173`.

### Useful commands

```bash
# backend
npm run build
npm run lint
npm test
npm run db:studio
npm run db:migrate

# frontend
npm run build
npm run lint
npm run preview
```

## Testing and validation

Backend tests cover `/health`, CORS preflight behavior, and CMMC SPRS calculations. `scripts/smoke.mjs` is a deployment smoke utility. Before pushing:

```bash
cd backend && npm run build && npm test
cd ../spectramind && npm run build
git diff --check
```

The frontend build currently warns that its main JavaScript chunk is large. This is not a build failure, but route-level lazy loading/code splitting should be a future performance improvement.

## Security and operational considerations

- Never commit `.env`, database passwords, JWT secrets, Azure tokens, or publish profiles.
- A public GitHub repository does not expose private Azure resources by itself; committed secrets would.
- Rotate a secret immediately if it is ever pasted into code, Git history, screenshots, or public logs.
- PostgreSQL firewall should allow only App Service outbound IPs and explicit administrator IPs.
- Keep database TLS and App Service HTTPS-only enabled.
- The frontend’s role is not authoritative; backend membership checks are authoritative.
- JWTs are stored client-side, so XSS prevention and dependency maintenance matter.
- Password-reset and invitation email delivery still require a production email provider.
- Local App Service evidence storage should become Azure Blob Storage before scaling.
- Database migrations run on API startup; use deployment slots/controlled migration practices for production growth.
- `tenant-rls.sql` is an optional defense-in-depth starting point. Application queries currently enforce tenancy; validate RLS thoroughly before enabling it.

## Complete file catalogue

This catalogue covers every tracked maintained path. Generated build directories (`dist`), local dependencies (`node_modules`), `.git`, runtime uploads, and untracked environment files are not application source and are intentionally not enumerated.

### Root and automation

| Path | Responsibility |
|---|---|
| `.github/workflows/azure-deploy.yml` | Builds/deploys frontend and backend on the configured branch |
| `.gitignore` | Excludes dependencies, generated output, secrets, and local artifacts |
| `.tmp_spreadsheet/build_employee_template.mjs` | Utility that generated the employee import workbook |
| `.tmp_spreadsheet/node_modules` | Tracked temporary dependency placeholder/artifact; should not contain application logic |
| `AZURE_DEPLOYMENT.md` | Concise Azure setup and troubleshooting checklist |
| `README.md` | Full system documentation |
| `package-lock.json` | Historical root npm resolution; deployable packages use their own locks |

### Backend configuration, scripts, and tests

| Path | Responsibility |
|---|---|
| `backend/.env.example` | Safe local/Azure environment variable template |
| `backend/.gitignore` | Backend-specific ignored files |
| `backend/Dockerfile` | Container build definition |
| `backend/docker-compose.yml` | Local PostgreSQL service |
| `backend/package.json`, `backend/package-lock.json` | Backend scripts and reproducible dependencies |
| `backend/README.md` | Backend-focused quick reference |
| `backend/tsconfig.json` | TypeScript compiler configuration |
| `backend/scripts/copy-framework-library.mjs` | Copies frontend catalogue into backend deployment artifact |
| `backend/scripts/smoke.mjs` | API smoke-check script |
| `backend/tests/health.test.ts` | Health/CORS behavior tests |
| `backend/tests/cmmcSPRSService.test.ts` | CMMC SPRS scoring unit tests |

### Backend runtime

| Path | Responsibility |
|---|---|
| `backend/src/server.ts` | Process entry point and listener |
| `backend/src/app.ts` | Fastify plugins, routes, health, errors, shutdown |
| `backend/src/config.ts` | Validates environment variables |
| `backend/src/lib/prisma.ts` | Shared Prisma client |
| `backend/src/plugins/auth.ts` | JWT and database-backed tenant membership checks |
| `backend/src/types/fastify.d.ts` | Fastify request/JWT/tenant type augmentation |
| `backend/src/ports/storage.ts` | Future file storage, job queue, and email sender interfaces; current evidence routes have not yet been refactored to use them |
| `backend/src/modules/auth/routes.ts` | Registration, login, recovery, current user |
| `backend/src/modules/organizations/routes.ts` | Organization, invitations, memberships, role switching/removal |
| `backend/src/modules/frameworks/routes.ts` | Framework checkout, controls, dashboard metrics |
| `backend/src/modules/questionnaires/routes.ts` | Questionnaire definitions/runs/answers/submission |
| `backend/src/modules/evidence/routes.ts` | Evidence upload, files, versions, review, comments, deletion |
| `backend/src/modules/workflows/library.ts` | Safe reading of framework JSON collections |
| `backend/src/modules/workflows/routes.ts` | Tasks and risks |
| `backend/src/modules/people/routes.ts` | Employees, policies, training and assignments |
| `backend/src/modules/assurance/routes.ts` | Vendors, audits, findings |
| `backend/src/modules/cmmc/routes.ts` | CMMC-specific API, currently SPRS |
| `backend/src/modules/workspace/routes.ts` | Flexible per-item workspace state |
| `backend/src/modules/trust/routes.ts` | Trust Center profile and access requests |
| `backend/src/services/cmmcEvidenceValidationService.ts` | Checks evidence completeness for CMMC practices |
| `backend/src/services/cmmcSPRSService.ts` | Calculates CMMC/NIST SPRS score |

### Prisma

| Path | Responsibility |
|---|---|
| `backend/prisma/schema.prisma` | Complete PostgreSQL schema and relations |
| `backend/prisma/seed.ts` | Upserts framework/control catalogue |
| `backend/prisma/tenant-rls.sql` | Optional PostgreSQL tenant RLS definitions |
| `backend/prisma/migrations/migration_lock.toml` | Prisma provider lock |
| `backend/prisma/migrations/20260712170000_initial/migration.sql` | Initial platform schema |
| `backend/prisma/migrations/20260712183000_questionnaires_evidence/migration.sql` | Questionnaire/evidence base |
| `backend/prisma/migrations/20260712192656_vendors_audits/migration.sql` | Vendors/audits |
| `backend/prisma/migrations/20260712200000_tasks_risks/migration.sql` | Tasks/risks |
| `backend/prisma/migrations/20260712201221_workspace_state/migration.sql` | Workspace JSON state |
| `backend/prisma/migrations/20260712201901_evidence_lifecycle/migration.sql` | Evidence lifecycle |
| `backend/prisma/migrations/20260713010000_people_policies_training/migration.sql` | People/policies/training |
| `backend/prisma/migrations/20260716130000_organization_invitations_roles/migration.sql` | Invitations/roles |
| `backend/prisma/migrations/20260718120000_trust_center/migration.sql` | Trust Center |
| `backend/prisma/migrations/20260720100000_password_resets/migration.sql` | Password resets |
| `backend/prisma/migrations/20260721183000_evidence_context/migration.sql` | Evidence test/implementation context |
| `backend/prisma/migrations/20260723090000_persist_policy_documents_and_branding/migration.sql` | Policy document JSON/custom fields/version history and organization logo |

### Frontend configuration and static assets

| Path | Responsibility |
|---|---|
| `spectramind/.env.example`, `.env.production` | Frontend API/client variable templates and production API URL |
| `spectramind/.gitignore` | Frontend exclusions |
| `spectramind/package.json`, `package-lock.json` | Frontend scripts/dependencies |
| `spectramind/README.md` | Vite/frontend quick reference |
| `spectramind/index.html` | SPA HTML shell |
| `spectramind/vite.config.js` | Vite React configuration |
| `spectramind/eslint.config.js` | ESLint rules |
| `spectramind/postcss.config.js`, `tailwind.config.js` | CSS processing/theme scanning |
| `spectramind/public/staticwebapp.config.json` | Azure SPA fallback, headers, MIME types |
| `spectramind/public/favicon.svg`, `icons.svg` | Browser/shared SVG assets |
| `spectramind/public/templates/employee-import-template.xlsx` | Employee upload template |
| `spectramind/public/templates/employee-import-template.xlsx.inspect.ndjson` | Workbook inspection metadata |
| `spectramind/src/assets/hero.png`, `react.svg`, `vite.svg` | Image assets; React/Vite SVGs are legacy starter assets |
| `spectramind/scripts/generate_cmmc_library.py` | Generates CMMC catalogue JSON |
| `spectramind/scripts/generate_iso27001_library.py` | Generates ISO catalogue JSON |

### Frontend entry, auth, framework, and layout

| Path | Responsibility |
|---|---|
| `src/main.jsx`, `App.jsx` | Mount providers and declare routes |
| `src/index.css`, `App.css` | Global/application styling |
| `src/auth/session.js` | Session normalization, scoped browser storage, role helpers |
| `src/auth/UserContext.jsx` | Current-user state/actions |
| `src/auth/ProtectedRoute.jsx` | Anonymous route protection |
| `src/auth/WorkspaceAccess.jsx` | Onboarding/management route guards |
| `src/framework/FrameworkWorkspaceContext.jsx` | Selected/active framework state |
| `src/framework/ActiveFrameworkOutlet.jsx` | Framework-dependent route gate |
| `src/framework/ActiveFrameworkRequired.jsx` | Empty/redirect UI when none selected |
| `src/components/layout/AppShell.jsx` | Authenticated workspace shell |
| `src/components/layout/Navbar.jsx` | Public navigation |
| `src/components/layout/Sidebar.jsx` | Role/framework-aware workspace navigation |
| `src/components/layout/Topbar.jsx` | Workspace title, cart, account menu |
| `src/components/Footer.jsx`, `Pricing.jsx`, `TrustedCompanies.jsx` | Shared marketing components |
| `src/components/landing/{ContactSection,DashboardPreview,Features,Frameworks,Hero,WhySpectraMind}.jsx` | Landing-page sections |
| `src/components/dashboard/ActivityFeed.jsx`, `ComplianceChart.jsx` | Dashboard visual components |
| `src/components/compliance/ComplianceModulePage.jsx` | Reusable compliance-module shell |

All `src/` paths in the remaining catalogue are relative to `spectramind/`.

### Frontend pages

| Files | Responsibility |
|---|---|
| `src/pages/Landing.jsx`, `About.jsx`, `FAQ.jsx`, `Contact.jsx`, `PricingPage.jsx`, `Testimonials.jsx` | Public marketing pages |
| `src/pages/SOC2Solution.jsx`, `ISO27001Solution.jsx`, `CMMCSolution.jsx` | Public framework solution pages |
| `src/pages/Login.jsx`, `Signup.jsx`, `ForgotPassword.jsx`, `ResetPassword.jsx` | Authentication and recovery |
| `src/pages/OrganizationSetup.jsx`, `JoinOrganization.jsx` | Organization creation/invitation onboarding |
| `src/pages/Profile.jsx`, `ProfileSettings.jsx`, `Settings.jsx` | User and workspace settings |
| `src/pages/Frameworks.jsx` | Catalogue/cart/checkout/selected frameworks |
| `src/pages/Dashboard.jsx` | Combined and framework score dashboard |
| `src/pages/Questionnaire.jsx` | Questionnaire workflow |
| `src/pages/Implementation.jsx` | Unified implementation workspace and item panels |
| `src/pages/ControlDetails.jsx`, `MandatoryDocumentUpload.jsx` | Control/document details and upload |
| `src/pages/Policies.jsx`, `PolicyDocument.jsx` | Policy workspace and shared document page |
| `src/pages/Training.jsx`, `TrainingDetails.jsx` | Course library, document, assignment/completion |
| `src/pages/Employees.jsx` | People/import/invitation/role/compliance management |
| `src/pages/Evidence.jsx` | Evidence repository page |
| `src/pages/Risks.jsx`, `Tasks.jsx` | Risk and task workflows |
| `src/pages/Audits.jsx`, `Vendors.jsx` | Assurance workflows |
| `src/pages/TrustCenter.jsx` | Trust profile and access requests |
| `src/pages/Integrations.jsx`, `Comments.jsx`, `Assistant.jsx` | Supporting modules |
| `src/pages/SOC2.jsx` | Legacy SOC 2-focused implementation view |

### Frontend domain services and data

| Path | Responsibility |
|---|---|
| `src/api/*.js` | Domain HTTP clients described in Frontend API layer |
| `src/audit/AuditReadinessEngine.js` | Derives readiness findings |
| `src/audit/AuditReviewService.js` | Audit review state/actions |
| `src/dashboard/DashboardScoreService.js` | Framework and combined scores |
| `src/compliance/ComplianceRelationshipService.js` | Cross-module relationships |
| `src/compliance/ComplianceStateContext.jsx` | Shared compliance state |
| `src/evidence/EvidenceService.js` | Evidence normalization/persistence facade |
| `src/evidence/EvidenceManagementSection.jsx` | Upload/manage evidence UI used in item panels |
| `src/policies/PolicyService.js` | Policy defaults/documents/status/acknowledgement helpers |
| `src/training/TrainingService.js` | Training library/assignments/completion helpers |
| `src/tasks/TaskService.js`, `src/data/taskEngine.js` | Task data and calculation helpers |
| `src/risks/RiskService.js` | Risk data helpers |
| `src/trust/TrustCenterService.js` | Trust profile/score helpers |
| `src/questionnaire/QuestionnaireEngine.js`, `src/data/questionnaireEngine.js` | Questionnaire interpretation/state |
| `src/navigation/crossModuleNavigation.js` | Exact-item URLs and return context |
| `src/data/frameworkLibraries.js` | Catalogue access/normalization |
| `src/data/organizationWorkspace.js` | Organization workspace storage facade |
| `src/data/localAccounts.js` | Browser-only account/invitation fallback |
| `src/data/controls.js`, `soc2Framework.js` | Legacy/source SOC 2 and control datasets |
| `src/data/mockData.js` | Legacy sample structures; production pages should not treat it as persisted truth |

### Reusable engines

| Directory/files | Responsibility |
|---|---|
| `src/core/adapters/{buildRelationshipGraph,useEvidenceStore,useFrameworkData,useOrganizationBranding,useOrganizationStore,useProgressData,useQuestionnaireData,useRelationshipGraph}.js` | Bridge app state/catalogues into engines |
| `src/core/engines/framework-engine/{frameworkEngine,frameworkRegistry,index}.js` | Register/load framework definitions |
| `src/evidence-engine/models/index.ts`, `services/{EvidenceEngineService,index}.ts`, `hooks/{useEvidenceEngine,index}.ts`, `components/{EvidenceDetails,EvidenceFilters,EvidenceMappingPanel,EvidencePreview,EvidenceRepository,EvidenceTimeline,EvidenceUpload,index}.tsx`, `index.ts` | Typed evidence repository engine and UI |
| `src/organization-engine/models/index.ts`, `services/{OrganizationEngineService,index}.ts`, `hooks/{useOrganizationEngine,index}.ts`, `components/{OrganizationDashboard,OrganizationFrameworkTable,index}.tsx`, `index.ts` | Typed organization framework engine |
| `src/progress-engine/services/{ProgressEngineService,index}.ts`, `hooks/{useProgressEngine,index}.ts`, `components/{ComplianceGauge,MissingEvidenceTable,PieCharts,ProgressCards,ReadinessMeter,RiskSummary,TrendGraph,index}.tsx`, `utils/{math,progressTypes}.ts`, `index.ts` | Progress formulas, types, hooks, and charts |
| `src/relationship-engine/models/index.ts`, `types/index.ts`, `services/{RelationshipEngineService,index}.ts`, `hooks/{useRelationshipEngine,index}.ts`, `components/{RelationshipDetails,RelationshipTable,RelationshipTree,RelationshipViewer,index}.tsx`, `utils/{catalog,graph,relationshipKeys,validation}.ts`, `index.ts` | Typed relationship graph construction, validation, and visualization |

### CMMC feature package

| Directory/files | Responsibility |
|---|---|
| `src/features/cmmc/routes.js`, `index.js` | CMMC route registry/public exports |
| `data/{cmmcDomains,cmmcModules,index}.js` | CMMC domains and module navigation definitions |
| `types/cmmcTypes.js` | Shared status/type constants |
| `utils/{cmmcRouting,index}.js` | CMMC URLs and route helpers |
| `hooks/{useCMMCActivityHistory,useCMMCModule,useCMMCSPRSCalculation,useCMMCWorkflowState,index}.js` | Page state and scoring hooks |
| `services/{cmmcActivityHistoryService,cmmcDashboardMetricsService,cmmcExecutiveReportExportService,cmmcPOAMExportService,cmmcPolicyWorkflowService,cmmcSPRSCalculationService,cmmcSSPExportService,index}.js` | CMMC metrics, history, policy workflow, and exports |
| `components/{CMMCAccordion,CMMCEmptyState,CMMCFilterBar,CMMCHeader,CMMCImplementationLayout,CMMCPageLayout,CMMCProgressBar,CMMCProgressRing,CMMCSectionCard,CMMCStatCard,CMMCStatusBadge,CMMCWorkspaceFilters,index}.{jsx,js}` | Shared CMMC visual system |
| `sections/{CMMCPlaceholderSection,index}.jsx` | Reusable not-yet-specialized module section |
| `pages/{CMMCAssessmentObjectivesPage,CMMCAuditReadinessPage,CMMCAuditorPage,CMMCControlsPage,CMMCDomainPage,CMMCDomainSummaryPage,CMMCEvidenceMappingPage,CMMCEvidencePage,CMMCExportCenterPage,CMMCGapWizardPage,CMMCModulePlaceholderPage,CMMCOrganizationPage,CMMCOverviewPage,CMMCPOAMPage,CMMCPoliciesPage,CMMCProgressTrackingPage,CMMCReadinessScorePage,CMMCReviewStatusPage,CMMCRiskTrackingPage,CMMCSPRSScorePage,CMMCSSPPage,CMMCScopePage,index}.{jsx,js}` | Complete CMMC workspace pages |

### Framework library files

The following eleven files exist independently under each of `src/core/framework-library/soc2/`, `iso27001/`, and `cmmc/`: `framework.json`, `controls.json`, `tests.json`, `policies.json`, `risks.json`, `tasks.json`, `evidence.json`, `questionnaire.json`, `mappings.json`, `audit-rules.json`, and `ai-guidance.json`. That is 33 explicitly tracked catalogue files. Their individual responsibilities are defined in [Framework catalogue and relationships](#framework-catalogue-and-relationships); each framework keeps separate IDs and content while following the same schema contract.

### Exact reusable-component manifest

The grouped descriptions above cover these files individually. They are written out here with their exact filenames so maintainers can reconcile this document directly against `git ls-files`:

- Landing components: `ContactSection.jsx`, `DashboardPreview.jsx`, `Features.jsx`, `Frameworks.jsx`, `Hero.jsx`, and `WhySpectraMind.jsx`.
- Core adapters: `buildRelationshipGraph.js`, `useEvidenceStore.js`, `useFrameworkData.js`, `useOrganizationBranding.js`, `useOrganizationStore.js`, `useProgressData.js`, `useQuestionnaireData.js`, and `useRelationshipGraph.js`.
- Framework engine: `frameworkEngine.js`, `frameworkRegistry.js`, and `index.js`.
- Evidence engine components: `EvidenceDetails.tsx`, `EvidenceFilters.tsx`, `EvidenceMappingPanel.tsx`, `EvidencePreview.tsx`, `EvidenceRepository.tsx`, `EvidenceTimeline.tsx`, `EvidenceUpload.tsx`, and `index.ts`.
- Evidence engine logic: `useEvidenceEngine.ts`, `EvidenceEngineService.ts`, the hook/service `index.ts` barrels, `models/index.ts`, and package `index.ts`.
- Organization engine: `OrganizationDashboard.tsx`, `OrganizationFrameworkTable.tsx`, `useOrganizationEngine.ts`, `OrganizationEngineService.ts`, component/hook/service/model barrel `index.ts` files, and package `index.ts`.
- Progress components: `ComplianceGauge.tsx`, `MissingEvidenceTable.tsx`, `PieCharts.tsx`, `ProgressCards.tsx`, `ReadinessMeter.tsx`, `RiskSummary.tsx`, `TrendGraph.tsx`, and `index.ts`.
- Progress logic: `useProgressEngine.ts`, `ProgressEngineService.ts`, hook/service barrel `index.ts` files, `math.ts`, `progressTypes.ts`, and package `index.ts`.
- Relationship components: `RelationshipDetails.tsx`, `RelationshipTable.tsx`, `RelationshipTree.tsx`, `RelationshipViewer.tsx`, and `index.ts`.
- Relationship logic: `useRelationshipEngine.ts`, `RelationshipEngineService.ts`, `catalog.ts`, `graph.ts`, `relationshipKeys.ts`, `validation.ts`, hook/service/model/type barrel `index.ts` files, and package `index.ts`.
- CMMC components: `CMMCAccordion.jsx`, `CMMCEmptyState.jsx`, `CMMCFilterBar.jsx`, `CMMCHeader.jsx`, `CMMCImplementationLayout.jsx`, `CMMCPageLayout.jsx`, `CMMCProgressBar.jsx`, `CMMCProgressRing.jsx`, `CMMCSectionCard.jsx`, `CMMCStatCard.jsx`, `CMMCStatusBadge.jsx`, `CMMCWorkspaceFilters.js`, and `index.js`.
- CMMC data/types/utils: `cmmcDomains.js`, `cmmcModules.js`, `cmmcTypes.js`, `cmmcRouting.js`, and their `index.js` barrels.
- CMMC hooks: `useCMMCActivityHistory.js`, `useCMMCModule.js`, `useCMMCSPRSCalculation.js`, `useCMMCWorkflowState.js`, and `index.js`.
- CMMC services: `cmmcActivityHistoryService.js`, `cmmcDashboardMetricsService.js`, `cmmcExecutiveReportExportService.js`, `cmmcPOAMExportService.js`, `cmmcPolicyWorkflowService.js`, `cmmcSPRSCalculationService.js`, `cmmcSSPExportService.js`, and `index.js`.
- CMMC sections: `CMMCPlaceholderSection.jsx` and `index.js`.
- CMMC pages: `CMMCAssessmentObjectivesPage.jsx`, `CMMCAuditReadinessPage.jsx`, `CMMCAuditorPage.jsx`, `CMMCControlsPage.jsx`, `CMMCDomainPage.jsx`, `CMMCDomainSummaryPage.jsx`, `CMMCEvidenceMappingPage.jsx`, `CMMCEvidencePage.jsx`, `CMMCExportCenterPage.jsx`, `CMMCGapWizardPage.jsx`, `CMMCModulePlaceholderPage.jsx`, `CMMCOrganizationPage.jsx`, `CMMCOverviewPage.jsx`, `CMMCPOAMPage.jsx`, `CMMCPoliciesPage.jsx`, `CMMCProgressTrackingPage.jsx`, `CMMCReadinessScorePage.jsx`, `CMMCReviewStatusPage.jsx`, `CMMCRiskTrackingPage.jsx`, `CMMCSPRSScorePage.jsx`, `CMMCSSPPage.jsx`, `CMMCScopePage.jsx`, and `index.js`.

---

When behavior and documentation disagree, verify the relevant API route, Prisma relation, and frontend service together. A feature is fully production-backed only when its page calls the API, the backend enforces tenant/role rules, the schema persists it, and Azure is configured with the necessary service and secret.
