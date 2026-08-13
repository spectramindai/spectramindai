# Azure deployment configuration

This repository is configured for:

- Resource group: `rg-spectramind-demo`
- Static Web App: `swa-spectramind-demo`
- Linux App Service: `app-spectramind-api-demo`
- PostgreSQL Flexible Server database: `spectramind`

## 1. GitHub repository secrets

Add these under **GitHub repository → Settings → Secrets and variables → Actions**:

- `AZURE_STATIC_WEB_APPS_API_TOKEN`: deployment token from `swa-spectramind-demo`.
- `AZURE_WEBAPP_PUBLISH_PROFILE`: publish-profile XML downloaded from `app-spectramind-api-demo`.

The workflow `.github/workflows/azure-deploy.yml` deploys pushes to `codex/consolidate-project-structure`. Change the branch in that file when production should deploy from another branch.

## 2. App Service application settings

Configure these in **app-spectramind-api-demo → Settings → Environment variables**:

| Name | Value |
|---|---|
| `NODE_ENV` | `production` |
| `HOST` | `0.0.0.0` |
| `TRUST_PROXY` | `true` |
| `DATABASE_URL` | Azure PostgreSQL URL shown below |
| `JWT_SECRET` | A generated secret of at least 32 characters |
| `JWT_EXPIRES_IN` | `8h` |
| `CORS_ORIGINS` | The exact HTTPS default/custom hostname of `swa-spectramind-demo` |
| `FRAMEWORK_LIBRARY_PATH` | `/home/site/wwwroot/framework-library` |
| `LOCAL_FILE_ROOT` | `/home/data/files` |
| `SCM_DO_BUILD_DURING_DEPLOYMENT` | `false` |

Use the actual Flexible Server host, administrator, and URL-encoded password:

```text
postgresql://DB_ADMIN:URL_ENCODED_PASSWORD@POSTGRES_SERVER.postgres.database.azure.com:5432/spectramind?schema=public&sslmode=verify-full
```

Do not put `DATABASE_URL`, `JWT_SECRET`, publish profiles, database passwords, or deployment tokens in Git.

Set the App Service startup command to:

```text
npm run start:azure
```

Set the health-check path to:

```text
/ready
```

`start:azure` applies committed Prisma migrations and only then starts the API. The server listens on Azure's injected `PORT` value.

## 3. Static Web App

The frontend production build uses:

```text
https://app-spectramind-api-demo.azurewebsites.net
```

as `VITE_API_URL`. `staticwebapp.config.json` provides React Router fallback behavior and security headers. After the first deployment, copy the exact Static Web App hostname into the backend `CORS_ORIGINS` setting. Multiple allowed origins are comma-separated.

## 4. Database network and TLS

- Keep **Require secure transport** enabled.
- Keep the firewall limited to the App Service outbound IP addresses plus explicit administrator IPs.
- Use `sslmode=verify-full` in `DATABASE_URL`.
- Restart App Service after changing database or CORS settings.

## 5. Evidence file persistence

`LOCAL_FILE_ROOT=/home/data/files` uses App Service's persistent `/home` storage. This is adequate for a single-instance demo. Before scaling beyond one instance, replace it with Azure Blob Storage using the existing `FileStorage` port in `backend/src/ports/storage.ts`.

## 6. Verify deployment

```text
https://app-spectramind-api-demo.azurewebsites.net/health
https://app-spectramind-api-demo.azurewebsites.net/ready
https://app-spectramind-api-demo.azurewebsites.net/api/docs
```

Expected responses:

- `/health`: HTTP 200 with `status: ok`
- `/ready`: HTTP 200 with `status: ready`

## 7. Password-reset email

The reset-token API is complete, but production deliberately never returns reset tokens to the browser. Configure a transactional email provider before relying on **Forgot password** in Azure. Azure Communication Services Email, SendGrid, or another provider can implement the existing `EmailSender` port in `backend/src/ports/storage.ts`. Development mode returns the token directly only for local testing.
