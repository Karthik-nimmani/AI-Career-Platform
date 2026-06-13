# AI Career Intelligence Platform

A premium, end-to-end web & mobile platform designed to parse resumes, evaluate ATS scores, isolate skill gaps, compile structured study plans, and provide interactive coaching with a LangGraph-orchestrated multi-agent system.

The platform is built with a **Next.js 14 Web Portal**, a **FastAPI Backend**, a **Flutter Mobile App**, and utilizes a **Supabase** backend for authentication, database, and storage.

---

## Key Features

1. **Resume Ingestion Pipeline & Parser:** 
   - Parse raw PDF documents using LlamaIndex.
   - Use structured LLM outputs to compile detailed resume profiles (Skills, Work History, Education).
   - Dynamic multi-profile selector to swap between uploaded resumes seamlessly.
   - Original filename preservation inside both Supabase Storage and JSONB metadata.
2. **Job Matcher (ATS Engine):** 
   - Paste job descriptions to calculate alignment score, match percentage, and semantic similarity.
   - Vector-level semantic indexing in ChromaDB.
   - Sidebar history browser to view, select, and delete past match comparisons.
3. **Weekly Study Roadmaps:** 
   - Generates 4-12 week timeline study plans to bridge identified skill gaps.
   - Visual progress checkpoints persisted in local browser storage (Next.js) or SharedPreferences (Flutter).
4. **Agentic AI Career Mentor:** 
   - LangGraph-orchestrated multi-agent system that routes user inquiries dynamically (Resume Analyst, Interview Coach, Skill Advisor, Career Architect).
   - Real-time Server-Sent Events (SSE) token-by-token streaming.
   - **Voice Typing Input:** Native speech recognition inside the chat bar.
5. **Decentralized API Keys:** 
   - Secure settings page allowing users to provide their own OpenAI, Anthropic, or Gemini API keys to bypass platform limits.
   - Self-healing dynamically-routed vector collections based on the selected LLM provider (1536d OpenAI vs 768d Google).

---

## Project Structure

```
ai-career-platform/
<<<<<<< HEAD
├── supabase/
│   └── schema.sql             # SQL database table definitions & RLS
├── backend/                   # FastAPI backend apps
=======
├── backend/                   # FastAPI Python backend
>>>>>>> ff59b4a (Update README.md with comprehensive multi-client setup instructions)
│   ├── app/
│   │   ├── agents/            # LangGraph multi-agent systems
│   │   ├── api/routes/        # Auth, Resume, Analysis, Mentor, Settings routes
│   │   ├── chains/            # LangChain LCEL chains (ATS, Roadmap, Gaps)
│   │   ├── core/              # Dynamic LLM/Embedding provider resolvers
│   │   ├── db/                # Supabase client configurations
│   │   ├── embeddings/        # ChromaDB persistent collection indexing
│   │   ├── models/            # Pydantic schemas
│   │   ├── parsers/           # LlamaIndex PDF parsing structures
│   │   └── main.py            # API entry point
│   ├── tests/                 # pytest test suites (25 unit tests)
│   └── requirements.txt       # Python dependencies list
│
├── frontend/                  # Next.js 14 Web App
│   ├── app/                   # App Router pages (auth, dashboard, resume, jobs, roadmap, mentor, settings)
│   ├── components/            # Shared UI components
│   ├── lib/                   # API client (Axios) and Supabase client
│   ├── store/                 # Zustand authentication store
│   ├── middleware.ts          # Edge cookie-based route protection
│   └── package.json           # npm node dependencies
│
├── mobile/                    # Flutter Mobile Client
│   ├── lib/
│   │   ├── screens/           # Dashboard, Login, Resume Upload, Job Compare, Roadmap, Mentor, Settings screens
│   │   ├── services/          # API, Auth, and Career State providers
│   │   └── widgets/           # Glassmorphic custom containers and loaders
│   └── pubspec.yaml           # Flutter pub package dependencies
│
└── supabase/
    └── schema.sql             # SQL database table definitions & RLS rules
```

---

## Setup & Run Instructions

### 1. Database Configuration (Supabase)
1. Register a free account at [Supabase](https://supabase.com/).
2. Create a new project named `AI Career Platform`.
3. In the left panel, click **SQL Editor** -> **New Query**.
4. Paste and execute the contents of [supabase/schema.sql](file:///e:/OneDrive/Desktop/AIC/ai-career-platform/supabase/schema.sql) to set up tables, RLS permissions, and triggers.
5. Create a **public** storage bucket named `resumes` in Supabase Storage.
6. In Supabase Project Settings -> API, copy your `Project URL`, `anon public API key`, and `service_role secret key`.

---

### 2. Backend Installation & Run
1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Create and activate a Python virtual environment:
   ```bash
   python -m venv venv
   # On Windows (PowerShell):
   .\venv\Scripts\Activate.ps1
   # On macOS/Linux:
   source venv/bin/activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Copy environment template and configure `.env` with your Supabase values and default OpenAI/Anthropic/Gemini keys:
   ```bash
   cp .env.example .env
   ```
5. Start the local API server:
   ```bash
   python app/main.py
   ```
   The backend will be available at `http://localhost:8000`. Test `/health` in browser.
6. Run the automated test suite:
   ```bash
   pytest
   ```

---

### 3. Frontend Installation & Run
1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install npm packages:
   ```bash
   npm install
   ```
3. Copy environment template and configure `.env.local` with your Supabase credentials:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   NEXT_PUBLIC_API_URL=http://localhost:8000
   ```
4. Start the development server:
   ```bash
   npm run dev
   ```
   Open `http://localhost:3000` in your browser.

---

### 4. Flutter Mobile Client Run
1. Ensure you have the [Flutter SDK installed](https://docs.flutter.dev/get-started/install).
2. Navigate to the mobile directory:
   ```bash
   cd mobile
   ```
3. Fetch packages:
   ```bash
   flutter pub get
   ```
4. Configure API endpoint variables in `mobile/lib/services/api_service.dart` to match your local backend IP (e.g. `http://10.0.2.2:8000` for Android emulator or `http://localhost:8000` for iOS simulator).
5. Start the application on your emulator or connected device:
   ```bash
   flutter run
   ```

---

## Verification & Testing
- **Backend Tests:** Run `pytest` inside the `/backend` folder. The platform contains **25 automated tests** verifying signup, login, resume uploading, deletion flows, model-provider resolution, settings updates, and study roadmaps.
- **Frontend Build Validation:** Succeeded with zero TypeScript or packaging compilation issues (`npm run build`).
