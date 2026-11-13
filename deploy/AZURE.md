# Running the backend on Azure App Service

The backend is one Docker image. GitHub Actions builds it on every merge to
`main` and publishes it to GitHub Container Registry
(`.github/workflows/container.yml`). Azure runs that image, always on, in an
Indian region. The database stays on Neon, so nothing has to be migrated.

Cost: an App Service **B1** plan (1 core, 1.75 GB) is paid from the Azure for
Students credit. Check the current price in the portal before you create it.

## 1. Get the student subscription

1. Go to **azure.microsoft.com/free/students** and click **Start free**.
2. Sign in with your college email (or verify through the GitHub Student
   Developer Pack). The student offer does not normally ask for a card.

## 2. Make the image readable by Azure

After the first merge with `container.yml`, the image appears under your GitHub
profile → **Packages** → `mining_report_platform`.
Open it → **Package settings** → **Change visibility** → **Public**.
(The repository is public already; the image only contains its code.)

## 3. Create the web app

In the Azure portal: **Create a resource → Web App**.

| Tab | Field | Value |
|---|---|---|
| Basics | Resource group | new: `dataforge` |
| | Name | e.g. `dataforge-api` (becomes `dataforge-api.azurewebsites.net`) |
| | Publish | **Container** |
| | Operating system | **Linux** |
| | Region | **Central India** (if the student subscription refuses it, South India or Southeast Asia) |
| | Pricing plan | new plan, **Basic B1** |
| Container | Image source | **Other container registries** |
| | Access type | **Public** |
| | Registry server URL | `https://ghcr.io` |
| | Image and tag | `juliesdutt-spec/mining_report_platform:latest` |

Click **Review + create → Create**.

## 4. Settings

Web app → **Settings → Environment variables → App settings**. Add the same
variables the Render service has, copying each value from the Render dashboard:

`DATABASE_URL`, `VECTOR_DATABASE_URL`, `GEMINI_API_KEY`, `GEMINI_MODEL`,
`AUTH_USERS`, `AUTH_SECRET`, `ALLOWED_ORIGINS`, `ALLOWED_ORIGIN_REGEX`,
`AI_TIMEOUT_SECONDS`

and one Azure-specific setting:

| Name | Value |
|---|---|
| `WEBSITES_PORT` | `8000` |

Use the **same** `AUTH_SECRET` as Render so existing sign-ins stay valid.
Then **Settings → Configuration → General settings**: **Always on = On**, and
**Monitoring → Health check**: path `/health`. Save; the app restarts.

## 5. Deploy automatically on every merge

Web app → **Deployment Center** → **Continuous deployment: On** → copy the
**Webhook URL**. In GitHub: repository **Settings → Secrets and variables →
Actions → New repository secret**, name `AZURE_CD_WEBHOOK`, value the URL.
From then on every merge to `main` builds the image and tells Azure to pull it.

## 6. Check it, then switch the frontend

Open `https://<your-app>.azurewebsites.net/health`. It should answer
`"status": "healthy"` with OCR `eng+hin+tel`. Then point the frontend at it:
in Vercel set `VITE_API_URL` to that URL and redeploy (and update
`DEPLOYED_API_URL` in `frontend/src/lib/settings.ts`). Keep Render running
until the site works on Azure, then suspend it.

## Known limit

App Service closes any single HTTP request after about 230 seconds. A
342-page report takes about 6 minutes, so its upload request will be cut
short. Processing continues on the server and the Documents page should recover
by polling until the report appears, but the lasting fix is to process
uploads in the background and return immediately.
