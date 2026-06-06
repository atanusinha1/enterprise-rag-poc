# Enterprise RAG POC Assistant

This repository contains a complete Proof of Concept (POC) for an Enterprise RAG (Retrieval-Augmented Generation) Assistant. It features an **ASP.NET Core Web API** backend powered by **Semantic Kernel**, utilizing **Azure OpenAI** for completions/embeddings, and a **PostgreSQL** database with **pgvector** for vector storage. The user interface is a premium dashboard built using **React** with vanilla CSS design.

---

## Workspace Structure
```text
enterprise-rag-poc/
├── azure_setup_guide.md       # Step-by-step Azure provisioning & pgvector configuration
├── README.md                  # This run and configuration guide
├── backend/                   # ASP.NET Core API Project
│   ├── Database/              # DB schema initialization
│   ├── Services/              # PDF Parsing & Semantic Kernel QA logic
│   ├── Controllers/           # Upload and Chat endpoints
│   ├── appsettings.json       # App configuration parameters
│   └── EnterpriseRagPoc.csproj# .NET project configuration
└── frontend/                  # React Vite Client
    ├── src/                   # React source code & components
    ├── index.html             # HTML entry point loading Google fonts
    ├── package.json           # Node project configuration
    └── tsconfig.json          # TypeScript configurations
```

---

## Prerequisites

To run this POC on your Windows machine, ensure you have:
1. **.NET 8.0 SDK** (Installed automatically with Visual Studio 2022).
2. **Visual Studio 2022** (with *ASP.NET and web development* workload selected).
3. **Node.js** (v18.0 or higher) for the React frontend.
4. **PostgreSQL 15+** with the `pgvector` extension installed.
   - *Option A*: Create an **Azure Database for PostgreSQL Flexible Server** (refer to `azure_setup_guide.md`).
   - *Option B*: Spin up a local container via Docker Desktop (fastest):
     ```bash
     docker run --name enterprise-pgvector -e POSTGRES_PASSWORD=EnterpriseRagPass123! -e POSTGRES_DB=ragdb -p 5432:5432 -d pgvector/pgvector:pg16
     ```

---

## Setup & Configuration

### 1. Update Backend Credentials
Open `backend/appsettings.json` and customize the connection details:
- Update `ConnectionStrings:PostgresConnection` with your connection string.
- Provide your Azure OpenAI `Endpoint` and `ApiKey` under the `AzureOpenAI` section.
- Verify your Azure OpenAI deployment names match `EmbeddingDeploymentName` (`text-embedding-3-small`) and `ChatDeploymentName` (`gpt-4o`).

```json
  "ConnectionStrings": {
    "PostgresConnection": "Host=localhost;Database=ragdb;Username=postgres;Password=EnterpriseRagPass123!;Port=5432;SSL Mode=Prefer;"
  },
  "AzureOpenAI": {
    "Endpoint": "https://YOUR_RESOURCE_NAME.openai.azure.com/",
    "ApiKey": "YOUR_AZURE_API_KEY",
    "EmbeddingDeploymentName": "text-embedding-3-small",
    "ChatDeploymentName": "gpt-4o"
  }
```

---

## Running the POC

### Step 1: Start the Backend (Visual Studio)
1. Launch **Visual Studio 2022** on Windows.
2. Select **Open a project or solution** and choose the `backend/EnterpriseRagPoc.csproj` file (or open the parent folder in VS).
3. Press **F5** or click the **Start (EnterpriseRagPoc)** play button at the top to build and run the API.
4. Visual Studio will launch your default browser showing the **Swagger UI** page (usually at `https://localhost:7116/swagger/index.html` or `http://localhost:5084/swagger/index.html`).
5. **Note**: On startup, the backend automatically runs `DbInitializer.cs` which attempts to run `CREATE EXTENSION IF NOT EXISTS vector;` and builds the `rag_documents` table schema with its HNSW index.

### Step 2: Start the Frontend (Command Line)
1. Open PowerShell or Command Prompt in the `frontend/` directory.
2. Install npm dependencies:
   ```bash
   npm install
   ```
3. Start the Vite React client in development mode:
   ```bash
   npm run dev
   ```
4. Open your browser and navigate to the printed URL (typically `http://localhost:5173`).

---

## Connecting the Frontend to the Backend

Vite runs on port `5173` and the C# API runs on a port configured by Visual Studio (e.g. `http://localhost:5084` or `https://localhost:7116`).
1. In the React interface header, click the **Settings** input (marked with a gear icon).
2. Type or paste your backend URL (e.g., `http://localhost:5084` or `https://localhost:7116`).
3. Click the **Refresh** button next to it.
4. The connection status indicator light will turn **Green** when a successful connection is established. The API URL persists in your local browser storage.

---

## Testing Ingestion and RAG

1. Go to the **Data Ingestion** tab.
2. Drag and drop any text-heavy PDF file (e.g., a documentation sheet or report) into the dashed box.
3. Observe the progress bar: the file is read, split into overlapping passages, converted into vector representations, and saved in PostgreSQL.
4. In the **Document Store Library** panel, verify that your file appears showing its total pages and generated chunk/vector count.
5. Go to the **RAG Assistant** tab:
   - Select **Enterprise Chat Assistant**: Type a question (e.g., "What is the policy on X?") and press enter. The model will cite facts and provide clickable buttons corresponding to the exact document paragraphs retrieved.
   - Select **Semantic Search Only**: Type a search phrase to view raw chunks returned from pgvector alongside their cosine similarity score (e.g., `Similarity: 86.42%`).

   ---

   ## Pipeline Integration
