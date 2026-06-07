# Azure CI/CD Setup Guide

This guide details the step-by-step instructions to deploy your ASP.NET Core Backend to **Azure App Service** and your React Frontend to **Azure Static Web Apps** automatically using **GitHub Actions**.

---

## 1. Setup Azure App Service (Backend)

The C# API will run on a hosted Linux Web App.

### Step 1.1: Create the Web App in Azure
1. Sign in to the [Azure Portal](https://portal.azure.com/).
2. Click **Create a resource** and search for **Web App**. Click **Create**.
3. Select your Subscription and Resource Group (e.g., `rg-rag-poc`).
4. Enter a unique name for your API (e.g., `atanu-rag-api`). This will be your `AZURE_BACKEND_APP_NAME`.
5. Under **Publish**, select **Code**.
6. Under **Runtime stack**, select **.NET 8 (LTS)**.
7. Under **Operating System**, select **Linux**.
8. Select your region (matching your database and OpenAI resources).
9. Under **Pricing plan**, select the **Basic B1** plan (or Free tier F1 if available, though Basic is recommended for startup performance).
10. Click **Review + Create**, then click **Create**.

### Step 1.2: Download the Publish Profile
1. Once the Web App is deployed, navigate to its page in the portal.
2. In the top toolbar of the **Overview** tab, click **Get publish profile**.
3. A `.PublishSettings` file (XML format) will download to your machine. **Do not share this file**; it contains credentials to deploy to your server.

---

## 2. Setup Azure Static Web Apps (Frontend)

Azure Static Web Apps (SWA) is the cheapest and most performant hosting option for React SPAs.

### Step 2.1: Create the Static Web App
1. In the [Azure Portal](https://portal.azure.com/), search for **Static Web Apps** and click **Create**.
2. Select your Subscription and Resource Group.
3. Enter a name (e.g., `atanu-rag-ui`).
4. Under **Plan type**, select **Free** (includes free SSL, global CDN, and DDoS protection).
5. Under **Deployment details**, select **Other** (we will use GitHub Actions manually via a token).
6. Click **Review + Create**, then click **Create**.

### Step 2.2: Copy the Deployment Token
1. Go to your newly created Static Web App resource in the portal.
2. Under the **Overview** page, locate and click **Manage deployment token**.
3. Copy the token string. This will be your `AZURE_STATIC_WEB_APPS_API_TOKEN`.

---

## 3. Configure GitHub Secrets

You need to securely provide the deployment credentials to GitHub Actions.

1. Go to your repository page on **GitHub**.
2. Navigate to **Settings** > **Secrets and variables** > **Actions**.
3. Click **New repository secret**.
4. Add the following secrets:

| Secret Name | Value |
| :--- | :--- |
| `AZURE_BACKEND_APP_NAME` | The exact name of your App Service (e.g., `atanu-rag-api`). |
| `AZURE_BACKEND_PUBLISH_PROFILE` | Open the downloaded `.PublishSettings` file in a text editor, copy all of the XML code, and paste it here. |
| `AZURE_STATIC_WEB_APPS_API_TOKEN` | Paste the Static Web App deployment token you copied in Step 2.2. |

---

## 4. Configure Backend Environment Settings in Azure

Instead of committing database passwords and OpenAI keys into your codebase and pushing them to GitHub, you configure them as Environment Variables on Azure.

1. Go to your **Azure App Service** page in the Azure Portal.
2. In the left menu under **Settings**, click **Configuration** (or **Environment variables** in newer portal layouts).
3. Under **Application settings**, click **+ New application setting** to add the following values:

| Key Name | Example Value / Notes |
| :--- | :--- |
| `ConnectionStrings__PostgresConnection` | `Host=atanu-postgresql...;Database=postgres;Username=ragadmin;Password=...` |
| `AzureOpenAI__Endpoint` | `https://atanu-rag-model.openai.azure.com/` |
| `AzureOpenAI__ApiKey` | *Your actual production Azure OpenAI API Key* |
| `AzureOpenAI__EmbeddingDeploymentName` | `text-embedding-3-small` |
| `AzureOpenAI__ChatDeploymentName` | `gpt-4o` |

> [!NOTE]
> ASP.NET Core automatically maps environment variables using double underscores (`__`) to nested appsettings sections (e.g. `AzureOpenAI__ApiKey` overrides `AzureOpenAI:ApiKey` in `appsettings.json`).

4. Click **Save** at the top, and click **Continue** to restart the server and apply settings.

---

## 5. Triggering Deployments

The CI/CD pipeline triggers automatically:
* Pushing changes to files in `/backend` will trigger the **Backend Deploy** job.
* Pushing changes to files in `/frontend` will trigger the **Frontend Deploy** job.

You can inspect the running pipelines, build outputs, and logs by clicking the **Actions** tab on your GitHub repository.
