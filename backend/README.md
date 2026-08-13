# SpectraMind Backend

This folder contains the local-first, Azure-ready backend for the SpectraMind compliance platform. It moves authentication, organization data, compliance workflows, evidence files, audit history, and dashboard calculations out of browser `localStorage` and into a durable multi-tenant API backed by PostgreSQL.

This document records everything implemented in `backend/`, how the pieces work, how to run and verify them, what the frontend expects, and what remains before production deployment on AWS.

## Current status

The backend currently provides working local APIs for:

- User registration, login, and profile retrieval.
- Organizations, organization membership, and roles.
- Framework activation and framework-library imports.
- Controls and control implementation state.
- Generalized implementation workspace state for controls, tests, policies, risks, documents, and other framework items.
- Questionnaires, drafts, answers, and submission.
- Evidence uploads, downloads, versions, mappings, reviews, comments, restoration, and deletion.
- Tasks and risks.
- Employees, background checks, policies, acknowledgements, and training.
- Vendors, vendor assessments, audits, and audit findings.
- Tenant-aware dashboard metrics and immutable activity events.

The backend, Prisma schema, migrations, seed importer, TypeScript build, health test, and complete PostgreSQL smoke test have all run successfully locally.

## Technology choices

| Concern | Implementation |
|---|---|
| Runtime | Node.js 22 or newer |
| Language | TypeScript with strict compiler settings |
| HTTP server | Fastify 5 |
| Database | PostgreSQL 17 |
| ORM and migrations | Prisma 6 |
| Validation | Zod 4 |
| Local authentication | JWT with `@fastify/jwt` |
| Password hashing | bcrypt with cost factor 12 |
| API documentation | OpenAPI and Swagger UI |
| Security headers | `@fastify/helmet` |
| Cross-origin access | `@fastify/cors` with configured origins |
| Tests | Vitest plus a real PostgreSQL smoke script |
| Local files | Private filesystem paths under `LOCAL_FILE_ROOT` |
| Containers | Dockerfile and Docker Compose definition |
| Cloud abstraction | Interfaces for Azure Blob Storage, queues, and transactional email |

The implementation is a modular monolith. Each business domain has its own route module, while all modules use one PostgreSQL database. This keeps the initial product simple and transactional without preventing modules from becoming separate AWS services later.

## Folder structure

```text
backend/
├── src/
│   ├── app.ts                         Fastify application assembly
│   ├── server.ts                      Process entry point
│   ├── config.ts                      Validated environment configuration
│   ├── lib/prisma.ts                  Shared Prisma client
│   ├── plugins/auth.ts                JWT and organization membership guards
│   ├── ports/storage.ts               Future S3, SQS/EventBridge, and SES ports
│   ├── types/fastify.d.ts             Fastify/JWT TypeScript augmentation
│   └── modules/
│       ├── auth/routes.ts             Registration, login, and current user
│       ├── frameworks/routes.ts       Frameworks, controls, and dashboard
│       ├── workspace/routes.ts        Generic implementation workspace state
│       ├── questionnaires/routes.ts   Questionnaire drafts and answers
│       ├── evidence/routes.ts         Evidence lifecycle and local files
│       ├── workflows/
│       │   ├── library.ts             Framework-library JSON loader
│       │   └── routes.ts              Tasks and risks
│       ├── people/routes.ts           Employees, policies, and training
│       └── assurance/routes.ts        Vendors and audits
├── prisma/
│   ├── schema.prisma                  Complete relational data model
│   ├── seed.ts                        Framework and control importer
│   ├── tenant-rls.sql                 Planned PostgreSQL RLS policies
│   └── migrations/                    Versioned database migrations
├── scripts/smoke.mjs                  Full API/PostgreSQL lifecycle test
├── tests/health.test.ts               Fastify health endpoint unit test
├── Dockerfile                         Production-style image definition
├── docker-compose.yml                 Local PostgreSQL definition
├── package.json                       Scripts and dependencies
├── tsconfig.json                      Strict TypeScript configuration
└── .env.example                       Local configuration template
```

## Implementation history

### 1. Backend foundation

The first step created the independent `backend/` application without modifying the existing frontend state files.

Implemented:

- Node.js and TypeScript project configuration.
- Strict TypeScript compilation.
- Fastify server and structured request logging.
- Environment validation through Zod.
- PostgreSQL and Prisma configuration.
- Docker Compose PostgreSQL service.
- Multi-stage Dockerfile.
- Helmet security headers.
- Configurable CORS allowlist.
- JWT plugin registration.
- OpenAPI registration and Swagger UI.
- `/health` and `/ready` endpoints.
- Consistent Zod validation errors and safe server errors.
- Graceful Prisma disconnection when the server closes.

### 2. Local PostgreSQL environment

PostgreSQL 17 was installed locally through Homebrew because Docker was not available on the development machine.

Created locally:

- PostgreSQL service: `postgresql@17`.
- Database: `spectramind`.
- Database role: `spectramind`.
- Local development password matching `.env.example`.

The repository still includes Docker Compose so another developer can use Docker instead of Homebrew.

### 3. Authentication and tenancy

Implemented local authentication as a temporary adapter before Cognito:

- Registration with name, email, password, and organization name.
- Lowercase normalized email addresses.
- bcrypt password hashing with cost factor 12.
- Unique organization slug generation.
- Transactional user, organization, owner membership, and initial activity creation.
- Login with password verification.
- Signed short-lived JWT access tokens.
- `/me` endpoint returning the user and all organization memberships.
- Required `x-organization-id` tenant header on organization-scoped routes.
- Membership verification for every tenant route.
- Request context containing organization ID, user ID, and role.

Roles defined in the database:

- `OWNER`
- `ADMIN`
- `COMPLIANCE_MANAGER`
- `SECURITY_MANAGER`
- `HR_MANAGER`
- `AUDITOR`
- `EMPLOYEE`
- `READ_ONLY`

Manager-only actions validate the membership role on the server rather than trusting the frontend.

### 4. Framework and control library

The existing frontend framework JSON files became versioned database seed sources.

The importer reads:

- `spectramind/src/core/framework-library/soc2`
- `spectramind/src/core/framework-library/iso27001`
- `spectramind/src/core/framework-library/cmmc`

Imported successfully:

- 33 SOC 2 controls.
- 93 ISO 27001 controls.
- 110 CMMC Level 2 controls.

The importer normalizes different source shapes. SOC 2 and ISO use fields such as `title` and `category`; CMMC uses fields such as `controlRequirement` and `controlFamily`.

Framework functionality includes:

- Framework catalog retrieval.
- Organization framework activation.
- Organization framework listing.
- Control listing with organization implementation state.
- Control implementation updates.
- Owner, notes, target dates, and implementation statuses.
- Optimistic concurrency through a numeric version.
- Framework activation and control update activity events.

### 5. Generalized implementation workspace

The frontend Implementation area stores more than control status. It also stores tests, risks, policies, documents, timelines, owners, workflow fields, and framework-specific values.

`WorkspaceItemState` was added to preserve this complete shape without forcing every frontend-specific field into a fixed table.

It supports:

- Organization and framework isolation.
- Arbitrary framework item IDs.
- Optional item type.
- JSON state payload.
- Optimistic concurrency version.
- Created/updated actors and timestamps.
- An immutable activity event for every update.

The more structured `ControlImplementation` model remains available for control-specific reporting, while `WorkspaceItemState` maintains compatibility with the richer Implementation UI.

### 6. Questionnaires

Implemented:

- Loading a framework questionnaire definition from the source library.
- Finding the latest organization questionnaire run.
- Creating or reusing a draft questionnaire run.
- Storing one answer per question.
- Support for strings, booleans, arrays, tables, and other JSON-compatible answer values.
- Updating draft answers.
- Preventing edits to submitted questionnaires.
- Submitting a questionnaire with submitter and timestamp.
- Submission activity events.

Questionnaire answers are now authoritative in PostgreSQL. The frontend maintains a temporary local cache because its existing applicability calculation still reads the old workspace format.

### 7. Evidence lifecycle

Evidence uses database metadata and private local filesystem content. The API contract is designed so local storage can later be replaced by S3 presigned URLs.

Implemented upload sequence:

1. Validate framework, title, filename, MIME type, size, mappings, and tags.
2. Resolve control mappings from either database UUIDs or framework IDs such as `CC6.1`.
3. Create an evidence record and version in a transaction.
4. Return a short-lived-style upload intent.
5. Upload binary content directly to the content endpoint.
6. Verify the expected byte size.
7. Verify SHA-256 when a checksum was provided.
8. Mark the version uploaded and evidence pending review.
9. Record upload-requested and upload-completed activity events.

Evidence functionality includes:

- Evidence listing by framework and status.
- Private authenticated downloads.
- Files stored under generated paths rather than original filenames.
- Maximum file size of 100 MiB.
- Multiple versions per evidence record.
- Replacement upload intents.
- Current-version selection.
- Version restoration.
- Control mappings.
- Approval and rejection with reason, reviewer, and timestamp.
- Evidence comments.
- Soft deletion.
- Upload, review, and lifecycle activity events.

Local object-key format:

```text
organizations/{organizationId}/evidence/{evidenceId}/versions/{versionId}
```

### 8. Tasks

Implemented:

- Framework task-template loading from `tasks.json`.
- Organization task synchronization without duplicating templates.
- Open, in-progress, and completed statuses.
- Owner user and owner display name.
- Priority, category, due date, related item, and item type.
- Optimistic concurrency.
- Completion actor and timestamp.
- Task update and completion activity events.

The SOC 2 smoke test synchronized 34 task templates.

### 9. Risks

Implemented:

- Framework risk synchronization from `risks.json`.
- Custom risk creation.
- Name, description, domain, and related controls.
- Owner user and owner name.
- Low, medium, and high likelihood and impact.
- Low, medium, high, and critical calculated level.
- Open, in-progress, mitigated, and accepted treatment states.
- Review dates.
- Optimistic concurrency.
- Risk update and mitigation activity events.

The SOC 2 smoke test synchronized 33 framework risks.

### 10. Employees and background checks

Implemented:

- Employee listing.
- Employee creation, editing, and deletion.
- Organization-unique employee email.
- Job role and employment type.
- Application access flag.
- Start and end dates.
- Tags.
- Background-check completion timestamp.
- Optimistic concurrency.
- Employee creation and background-check activity events.

Employee deletion cascades to policy and training assignments through database foreign keys.

### 11. Policies and acknowledgements

Implemented:

- Framework policy synchronization from `policies.json`.
- Custom policy creation.
- Draft, active, and archived statuses.
- Policy name, description, owner, version label, effective date, and review date.
- Employee policy assignments.
- Assignment replacement through one endpoint.
- Policy acknowledgement and acknowledgement reset.
- Acknowledgement actor and timestamp.
- Optimistic policy concurrency.
- Policy acknowledgement activity events.

The SOC 2 smoke test synchronized 20 framework policies.

Arbitrary custom policy-table fields and policy document binaries are not yet modeled in this backend. Those remain frontend compatibility fields until a dedicated schema and evidence/document policy are selected.

### 12. Training

Implemented:

- Default organization training-course synchronization.
- Custom course creation, editing, and deletion.
- Course descriptions, related frameworks, and due dates.
- Employee assignment replacement.
- Assigned and completed states.
- Completion actor and timestamp.
- Completion reset for managers.
- Training completion activity events.

The current default backend library contains six courses used in the smoke workflow.

### 13. Vendors and assessments

Implemented:

- Vendor listing, creation, and update.
- Organization-unique vendor name.
- Category, website, owner, active flag, and next review date.
- Low, medium, high, and critical vendor risk.
- Optimistic concurrency.
- Vendor assessments with draft, in-review, and completed states.
- Assessment score, summary, arbitrary JSON responses, assessor, and completion timestamp.
- Vendor creation activity events.

### 14. Audits and findings

Implemented:

- Audit listing and creation.
- Planned, in-progress, completed, and cancelled statuses.
- Framework, audit type, auditor, dates, and optimistic version.
- Manual audit findings.
- Low, medium, high, and critical severity.
- Open, reviewed, and resolved finding states.
- Reviewer, review comments, review timestamp, resolver, and resolution timestamp.
- Automated readiness-audit synchronization from frontend-calculated findings.
- Upsert by stable external finding ID to prevent duplicates.
- Finding review and resolution activity events.

### 15. Dashboard and activity

The dashboard endpoint aggregates tenant data from PostgreSQL.

It returns:

- Total controls.
- Implemented controls.
- Framework progress percentage.
- Implementation counts grouped by status.
- Evidence total.
- Policy total and published total.
- Open risks and high/critical open risks.
- Open tasks.
- Open audit findings.
- Employee total.
- Training assigned and completed totals.
- Training completion percentage.
- Twenty most recent activity events.

### 16. AWS adapter ports

`src/ports/storage.ts` defines the boundaries for services that will be replaced during AWS integration:

- `FileStorage`: local filesystem to Amazon S3.
- `JobQueue`: local/in-process implementation to Amazon SQS or EventBridge.
- `EmailSender`: local mail implementation to Amazon SES.

The current evidence HTTP contract already resembles a presigned S3 workflow, minimizing frontend changes during the AWS migration.

## Database model

### Enumerations

- `MembershipRole`
- `ImplementationStatus`
- `QuestionnaireStatus`
- `EvidenceStatus`
- `TaskStatus`
- `RiskLikelihood`
- `RiskLevel`
- `RiskTreatmentStatus`
- `PolicyStatus`
- `AssignmentStatus`
- `VendorRisk`
- `AssessmentStatus`
- `AuditStatus`
- `FindingStatus`
- `FindingSeverity`

### Tables

- `User`
- `Organization`
- `OrganizationMembership`
- `Framework`
- `OrganizationFramework`
- `Control`
- `ControlImplementation`
- `WorkspaceItemState`
- `QuestionnaireRun`
- `QuestionnaireAnswer`
- `EvidenceRecord`
- `EvidenceVersion`
- `EvidenceMapping`
- `EvidenceComment`
- `Task`
- `Risk`
- `Employee`
- `Policy`
- `PolicyAssignment`
- `TrainingCourse`
- `TrainingAssignment`
- `Vendor`
- `VendorAssessment`
- `Audit`
- `AuditFinding`
- `ActivityEvent`

All tenant-owned top-level records contain an `organizationId`. Mutable compliance records generally include created/updated actors, timestamps, and a numeric version where concurrent editing matters.

## Migration history

| Migration | Purpose |
|---|---|
| `20260712170000_initial` | Users, organizations, memberships, frameworks, controls, implementations, and activity events |
| `20260712183000_questionnaires_evidence` | Questionnaire runs/answers and initial evidence records/versions/mappings |
| `20260712200000_tasks_risks` | Task and risk workflows |
| `20260713010000_people_policies_training` | Employees, policies, acknowledgements, courses, and training assignments |
| `20260712192656_vendors_audits` | Vendors, assessments, audits, and findings |
| `20260712201221_workspace_state` | Generalized implementation workspace state |
| `20260712201901_evidence_lifecycle` | Evidence reviews, comments, and soft deletion |

Migration folder timestamps reflect the order files were created during development; Prisma uses its migration table and folder sequence when applying them. All listed migrations were applied successfully to the local PostgreSQL database.

## API conventions

Base path:

```text
/api/v1
```

Authenticated calls use:

```http
Authorization: Bearer <JWT>
x-organization-id: <organization UUID>
```

The organization header is never trusted alone. The server verifies that the JWT user has a membership in that organization before attaching tenant context.

JSON mutations are validated through Zod. Invalid requests return a `400` response with `VALIDATION_ERROR`. Concurrent updates return `409 VERSION_CONFLICT` with the current record where supported.

## Endpoint reference

### Health and documentation

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/health` | Process health without database dependency |
| GET | `/ready` | Database readiness check |
| GET | `/api/docs` | Swagger UI |

### Authentication

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/v1/auth/register` | Create user, organization, and owner membership |
| POST | `/api/v1/auth/login` | Verify credentials and issue JWT |
| GET | `/api/v1/auth/me` | Return current profile and memberships |

### Frameworks, controls, and dashboard

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/v1/frameworks` | List framework catalog |
| GET | `/api/v1/organization-frameworks` | List activated organization frameworks |
| POST | `/api/v1/organization-frameworks` | Activate a framework |
| GET | `/api/v1/controls` | List framework controls and implementation state |
| PATCH | `/api/v1/controls/:controlId/implementation` | Update structured control implementation |
| GET | `/api/v1/dashboard` | Return tenant dashboard aggregates |

### Generalized workspace

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/v1/workspace?frameworkId=...` | Return item-state map for a framework |
| PUT | `/api/v1/workspace/:itemId` | Upsert arbitrary implementation item state |

### Questionnaires

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/v1/questionnaires/:frameworkId` | Return definition and latest run |
| POST | `/api/v1/questionnaire-runs` | Create or return a draft run |
| PUT | `/api/v1/questionnaire-runs/:runId/answers/:questionId` | Upsert an answer |
| POST | `/api/v1/questionnaire-runs/:runId/submit` | Submit the questionnaire |

### Evidence

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/v1/evidence` | List evidence by framework/status |
| POST | `/api/v1/evidence/upload-intents` | Create evidence and initial upload intent |
| PUT | `/api/v1/evidence/:evidenceId/versions/:versionId/content` | Upload binary content locally |
| POST | `/api/v1/evidence/:evidenceId/versions/:versionId/complete` | Verify and complete upload |
| GET | `/api/v1/evidence/:evidenceId/download` | Authorized binary download |
| POST | `/api/v1/evidence/:evidenceId/review` | Approve or reject evidence |
| POST | `/api/v1/evidence/:evidenceId/comments` | Add a comment |
| POST | `/api/v1/evidence/:evidenceId/versions/upload-intent` | Create replacement version intent |
| POST | `/api/v1/evidence/:evidenceId/versions/:versionId/restore` | Restore a prior version |
| DELETE | `/api/v1/evidence/:evidenceId` | Soft-delete evidence |

### Tasks and risks

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/v1/tasks` | List organization tasks |
| POST | `/api/v1/tasks/sync` | Synchronize framework task templates |
| PATCH | `/api/v1/tasks/:taskId` | Update assignment or status |
| GET | `/api/v1/risks` | List risk register |
| POST | `/api/v1/risks/sync` | Synchronize framework risks |
| POST | `/api/v1/risks` | Create custom risk |
| PATCH | `/api/v1/risks/:riskId` | Update or mitigate risk |

### Employees, policies, and training

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/v1/employees` | List employees |
| POST | `/api/v1/employees` | Create employee |
| PATCH | `/api/v1/employees/:id` | Update employee |
| DELETE | `/api/v1/employees/:id` | Delete employee |
| POST | `/api/v1/employees/:id/background-check` | Complete background check |
| POST | `/api/v1/policies/sync` | Synchronize framework policies |
| GET | `/api/v1/policies` | List policies and assignments |
| POST | `/api/v1/policies` | Create custom policy |
| PATCH | `/api/v1/policies/:id` | Update policy lifecycle fields |
| PUT | `/api/v1/policies/:id/assignments` | Replace employee assignments |
| POST | `/api/v1/policy-assignments/:id/acknowledge` | Acknowledge assigned policy |
| DELETE | `/api/v1/policy-assignments/:id/acknowledgement` | Reset acknowledgement |
| POST | `/api/v1/training/sync` | Synchronize default courses |
| GET | `/api/v1/training` | List courses and assignments |
| POST | `/api/v1/training` | Create custom course |
| PATCH | `/api/v1/training/:id` | Update course |
| DELETE | `/api/v1/training/:id` | Delete custom course |
| PUT | `/api/v1/training/:id/assignments` | Replace employee assignments |
| POST | `/api/v1/training-assignments/:id/complete` | Complete course assignment |
| DELETE | `/api/v1/training-assignments/:id/completion` | Reset completion |

### Vendors and audits

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/v1/vendors` | List vendors and latest assessment |
| POST | `/api/v1/vendors` | Create vendor |
| PATCH | `/api/v1/vendors/:id` | Update vendor |
| POST | `/api/v1/vendors/:id/assessments` | Create vendor assessment |
| GET | `/api/v1/audits` | List audits and findings |
| POST | `/api/v1/audits/readiness/sync` | Persist generated readiness findings |
| POST | `/api/v1/audits` | Create audit |
| PATCH | `/api/v1/audits/:id` | Update audit status |
| POST | `/api/v1/audits/:id/findings` | Create manual finding |
| POST | `/api/v1/audit-findings/:id/review` | Review finding |
| POST | `/api/v1/audit-findings/:id/resolve` | Resolve finding |

## Environment variables

Copy `.env.example` to `.env`.

| Variable | Meaning |
|---|---|
| `NODE_ENV` | `development`, `test`, or `production` |
| `PORT` | API port, normally `4000` |
| `HOST` | Bind host; local `.env` uses `127.0.0.1` |
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Minimum 32-character local JWT secret |
| `JWT_EXPIRES_IN` | JWT lifetime, currently `15m` |
| `CORS_ORIGINS` | Comma-separated allowed frontend origins |
| `FRAMEWORK_LIBRARY_PATH` | Relative/absolute path to framework JSON library |
| `LOCAL_FILE_ROOT` | Root directory for local evidence files |

Never commit the real `.env`. The checked-in `.env.example` contains development-only placeholders.

## Running locally

### Option A: Docker PostgreSQL

```bash
cd backend
cp .env.example .env
docker compose up -d
npm install
npm run db:generate
npx prisma migrate deploy
npm run db:seed
npm run dev
```

### Option B: Homebrew PostgreSQL

```bash
brew install postgresql@17
brew services start postgresql@17
/opt/homebrew/opt/postgresql@17/bin/createuser --createdb spectramind
/opt/homebrew/opt/postgresql@17/bin/createdb --owner=spectramind spectramind
```

Set the role password and configure `DATABASE_URL`, then run:

```bash
cd backend
npm install
npm run db:generate
npx prisma migrate deploy
npm run db:seed
npm run dev
```

Local URLs:

- API: `http://127.0.0.1:4000`
- Health: `http://127.0.0.1:4000/health`
- Readiness: `http://127.0.0.1:4000/ready`
- Swagger: `http://127.0.0.1:4000/api/docs`

The React frontend enables API mode with:

```env
VITE_API_URL=http://127.0.0.1:4000
```

## Package scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Run API with TSX watch mode |
| `npm run build` | Compile TypeScript into `dist` |
| `npm start` | Run compiled server |
| `npm run lint` | Strict TypeScript validation without output |
| `npm test` | Run Vitest tests |
| `npm run db:generate` | Generate Prisma Client |
| `npm run db:migrate` | Create/apply a development migration |
| `npm run db:seed` | Import frameworks and controls |
| `npm run db:studio` | Open Prisma Studio |

For an existing environment or CI/CD, prefer `npx prisma migrate deploy` rather than `prisma migrate dev`.

## Testing and verification

### Unit health test

`tests/health.test.ts` builds the Fastify application with Prisma mocked and confirms that `/health` returns a successful status.

### Full PostgreSQL smoke test

Start the API, then run:

```bash
node scripts/smoke.mjs
```

The smoke script verifies the real database and API lifecycle:

1. Register user and organization.
2. Activate SOC 2.
3. Load all 33 SOC 2 controls.
4. Create and submit questionnaire answers.
5. Upload binary evidence.
6. Complete and verify evidence upload.
7. Save generalized workspace state.
8. Approve evidence.
9. Add evidence comment.
10. Restore an evidence version.
11. Synchronize and complete a task.
12. Synchronize and mitigate a risk.
13. Create employee and complete background check.
14. Synchronize, publish, assign, and acknowledge a policy.
15. Synchronize, assign, and complete training.
16. Create vendor and complete vendor assessment.
17. Create audit and finding.
18. Review and resolve finding.
19. Register a second tenant.
20. Confirm the second tenant is denied access to the first tenant's evidence.
21. Soft-delete evidence.

Successful verification performed during implementation:

```text
Backend strict TypeScript: passed
Backend production build: passed
Vitest health test: passed
Prisma schema generation: passed
All migrations: applied
Framework seed: passed
Full PostgreSQL smoke test: passed
Cross-tenant denial test: passed
Frontend production build: passed
```

## Security model

### Implemented now

- Passwords are hashed and never returned.
- JWTs are signed with an environment secret.
- Tenant routes require a JWT and organization header.
- Membership is verified before tenant context is attached.
- Tenant-owned queries include the verified organization ID.
- Manager actions check roles on the server.
- Request payloads are validated.
- Security headers and CORS are configured.
- Evidence downloads require authorization.
- Evidence filenames do not control filesystem paths.
- Evidence upload size and optional SHA-256 are verified.
- Cross-tenant denial is exercised by the smoke test.
- Important compliance changes create activity events.

### RLS status

`prisma/tenant-rls.sql` defines PostgreSQL row-level security policies for tenant top-level tables, including workspace state. These policies are **not automatically activated in the current local API**.

Reason: safe pooled PostgreSQL RLS requires setting `app.current_tenant` inside the same transaction/connection as every tenant query. Enabling or forcing the policies before adding a request-scoped transaction strategy would either block valid API calls or create unsafe connection-pool context leakage.

Before production, choose the final RDS/RDS Proxy connection strategy, introduce transaction-bound tenant context, apply/force the RLS policies with a non-owner runtime role, and run isolation tests against that role.

### Not production-ready yet

- Local JWT auth has no refresh-token rotation.
- Email verification, password reset, MFA, and account lockout are not implemented.
- Route-level rate limiting is not implemented.
- Local evidence content is not malware scanned.
- Checksums are generated for initial frontend uploads, but replacement-version checksum generation is not yet included.
- Filesystem storage is for local development only.
- RLS is defined but not active.
- The automated test suite is not yet comprehensive enough for production.

## Activity events

The append-only `ActivityEvent` table records significant state changes such as:

- Organization creation.
- Framework activation.
- Control implementation update.
- Workspace item update.
- Questionnaire submission.
- Evidence upload request/completion, approval, and rejection.
- Task update/completion.
- Risk update/mitigation.
- Employee creation and background-check completion.
- Policy acknowledgement.
- Training completion.
- Vendor creation.
- Audit finding review and resolution.

Every event carries organization context, actor where available, entity type, entity ID, metadata, and creation timestamp.

## AWS migration map

| Current implementation | AWS target |
|---|---|
| Local JWT/password adapter | Amazon Cognito User Pool |
| Local PostgreSQL 17 | Amazon RDS or Aurora PostgreSQL |
| Local filesystem evidence | Private versioned Amazon S3 bucket |
| Local upload URL | S3 presigned upload URL |
| Local authenticated download | S3 presigned download URL |
| Future `JobQueue` implementation | Amazon SQS and/or EventBridge |
| Future `EmailSender` implementation | Amazon SES |
| Local API process | ECS Fargate behind an ALB |
| `.env` secrets | AWS Secrets Manager |
| Default encryption | AWS KMS keys for RDS, S3, queues, and secrets |
| Console logs | CloudWatch Logs and metrics |
| Local frontend | S3 and CloudFront |
| Local routing | Route 53 and ACM |
| Basic HTTP protection | AWS WAF and rate limits |

Evidence malware scanning should use an S3 quarantine bucket, an object-created event, SQS/EventBridge, and a scanner Lambda. Only clean objects should become downloadable.

## Known remaining work

### Required before production AWS release

1. Replace local identity with Cognito, MFA, verification, and password recovery.
2. Add request-scoped database transactions and activate/force RLS with a non-owner runtime role.
3. Replace local evidence storage with S3.
4. Add quarantine and malware scanning.
5. Add checksum support to replacement versions.
6. Add API rate limiting and abuse controls.
7. Add organization invitations and member/role management endpoints.
8. Expand API integration tests and cross-tenant tests.
9. Add role-permission matrix tests.
10. Add browser end-to-end tests.
11. Add concurrent update and transaction rollback tests.
12. Add backup/restore verification.
13. Add CloudWatch dashboards, alarms, and operational runbooks.
14. Add CDK infrastructure and CI/CD.

### Product modules not yet implemented in this backend

- External SaaS integration credential storage and collectors.
- Scheduled evidence collection jobs.
- Notification inbox and email reminders.
- General comments outside evidence/audit workflows.
- Generated PDF/XLSX/SSP/POA&M report jobs.
- Trust Center publication workflow.
- Organization branding/settings persistence.
- AI assistant service and tenant-filtered retrieval.
- Billing/subscription management.

These modules are not required to begin AWS infrastructure work, but they are required if their corresponding frontend features must be fully functional in the production launch.

## Operational cautions

- Do not expose PostgreSQL publicly.
- Do not deploy with the development JWT secret.
- Do not use the local evidence directory in a multi-instance deployment.
- Do not enable the supplied RLS script without adding transaction-bound tenant context first.
- Do not run `prisma migrate dev` in production.
- Do not trust `organizationId` values from request bodies; use verified request tenant context.
- Do not log JWTs, passwords, evidence contents, or integration credentials.
- Do not remove `organizationId` filters from tenant-owned queries even after RLS is enabled; defense in depth is intentional.

## Definition of the current backend milestone

The local backend milestone is considered complete because:

- Core compliance domains have database models and APIs.
- The primary frontend workflows have API contracts.
- Framework libraries seed deterministically.
- Evidence uses a future-S3-compatible flow.
- Tenant membership is checked for scoped requests.
- Optimistic concurrency protects major collaborative records.
- Activity history exists for important changes.
- All migrations apply successfully.
- The entire happy-path workflow and a cross-tenant denial case pass against PostgreSQL.

The next milestone is production hardening and AWS infrastructure, not a redesign of the backend domain model.
