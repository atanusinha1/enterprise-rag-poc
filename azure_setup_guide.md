# Azure Services and Database Setup Guide

This guide provides step-by-step instructions for setting up the necessary cloud infrastructure on Microsoft Azure (or a local developer alternative) for your Enterprise RAG POC.

---

## 1. Setup Azure OpenAI Service

Azure OpenAI provides the AI models for text embedding generation and conversational response completion.

### Step 1.1: Create Azure OpenAI Resource
1. Sign in to the [Azure Portal](https://portal.azure.com/).
2. In the search bar at the top, type **Azure OpenAI** and select it from the list.
3. Click **+ Create**.
4. Select your **Subscription** and **Resource Group** (create a new one if needed, e.g., `rg-rag-poc`).
5. Choose a region that supports the models you need (e.g., **East US**, **Sweden Central**, or **West US 3**).
6. Enter a unique resource name (e.g., `openai-rag-poc-enterprise`).
7. Select the **Standard S0** pricing tier.
8. Click **Next** through the options and then click **Create**. Wait for deployment to complete.

### Step 1.2: Deploy Models in Azure OpenAI Studio
1. Navigate to your newly created Azure OpenAI resource in the portal.
2. Under the **Overview** page, click the **Go to Azure OpenAI Studio** button (or go to [oai.azure.com](https://oai.azure.com/)).
3. In Azure OpenAI Studio, click on **Deployments** under the Shared Resources section in the left sidebar.
4. Click **+ Create new deployment**.
5. Set up the **Embedding Model**:
   - **Model**: Select `text-embedding-3-small` (or `text-embedding-ada-002` if preferred).
   - **Model version**: Choose the default/latest version.
   - **Deployment name**: Enter `text-embedding-3-small` (remember this name for `appsettings.json`).
   - Click **Create**.
6. Click **+ Create new deployment** again.
7. Set up the **Chat Completion Model**:
   - **Model**: Select `gpt-4o` (or `gpt-35-turbo` / `gpt-4`).
   - **Model version**: Choose the default/latest version.
   - **Deployment name**: Enter `gpt-4o` (remember this name for `appsettings.json`).
   - Click **Create**.

### Step 1.3: Retrieve Keys and Endpoint
1. Go back to your Azure OpenAI resource in the Azure Portal.
2. In the left menu, under **Resource Management**, click **Keys and Endpoint**.
3. Copy **KEY 1** and the **Endpoint** URL. Save these; you will insert them into the backend `appsettings.json` file.

---

## 2. Setup PostgreSQL with `pgvector`

You have two choices for PostgreSQL: **Azure Database for PostgreSQL Flexible Server** (cloud-hosted) or **Docker** (local-hosted). 

### Option A: Azure Database for PostgreSQL (Flexible Server)

#### Step A.1: Create the Server
1. In the [Azure Portal](https://portal.azure.com/), search for **Azure Database for PostgreSQL Flexible Server** and click **+ Create**.
2. Select your **Subscription** and the same **Resource Group** (`rg-rag-poc`).
3. Enter a server name (e.g., `pg-rag-poc-enterprise`).
4. Select a region (preferably the same region as your OpenAI resource).
5. For **Workload type**, choose **Development** (lowest cost).
6. Set **Compute + storage**: Select the smallest available instance (e.g., `Standard_B1ms` burstable CPU, 32GB storage) to minimize costs.
7. Under **Administrator account**:
   - Set **Authentication method** to **PostgreSQL authentication only**.
   - Admin username: `ragadmin`
   - Admin password: Choose a strong password and save it.
8. Click **Next: Networking**.

#### Step A.2: Configure Firewall Rules
1. In the **Networking** tab:
   - Choose **Public access (allowed IP addresses)**.
   - Check the box **Allow public access from any Azure service within Azure to this server** (needed if you eventually deploy the backend to Azure App Service).
   - Click **+ Add current client IP address** to allow your home or office computer to connect to the database.
2. Click **Review + create**, and click **Create**. Wait a few minutes for deployment.

#### Step A.3: Enable the `pgvector` Extension
Azure PostgreSQL Flexible Server restricts extension installations by default. You must explicitly allow `vector`.
1. Go to your PostgreSQL Flexible Server resource in the Azure Portal.
2. In the left menu, under **Settings**, click **Server parameters**.
3. In the search bar on the server parameters page, type **azure.extensions**.
4. Click the dropdown or edit field next to `azure.extensions` and check the checkbox for **VECTOR** (you can also select other extensions like `uuid-ossp` if needed).
5. Click **Save** at the top. The server will apply these configuration updates (this takes about 1–2 minutes).

---

### Option B: Local PostgreSQL Setup via Docker (Recommended for Local POC)
If you want to run pgvector locally instead of provisioning Azure services:
1. Ensure [Docker Desktop](https://www.docker.com/products/docker-desktop/) is installed and running on your Windows machine.
2. Open PowerShell or Command Prompt and run:
   ```bash
   docker run --name enterprise-pgvector -e POSTGRES_PASSWORD=EnterpriseRagPass123! -e POSTGRES_DB=ragdb -p 5432:5432 -d pgvector/pgvector:pg16
   ```
3. This creates a Postgres 16 server pre-packaged with the `pgvector` extension ready to use, listening on `localhost:5432`.

---

## 3. Retrieve Connection String

Your C# application connects to PostgreSQL using standard ADO.NET connection strings.

### Azure PostgreSQL Connection String Template:
```text
Host=pg-rag-poc-enterprise.postgres.database.azure.com;Database=ragdb;Username=ragadmin;Password=YourPasswordHere;Port=5432;SSL Mode=Require;Trust Server Certificate=true;
```
*Note: Make sure to replace host, username, database name, and password with your actual values.*

### Local Docker Connection String:
```text
Host=localhost;Database=ragdb;Username=postgres;Password=EnterpriseRagPass123!;Port=5432;SSL Mode=Prefer;
```
