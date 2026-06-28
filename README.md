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
├── .env.example               # Root environment variables template
├── deploy-gcp.sh              # Google Cloud Run deployment script
├── docker-compose.yml         # Container orchestration configuration
├── GCP_DEPLOYMENT.md          # Detailed GCP Cloud Run deployment manual
├── README.md                  # Project overview and setup instructions
│
├── backend/                   # FastAPI Python backend (v1.0.0)
│   ├── app/
│   │   ├── agents/
│   │   │   └── orchestrator.py# LangGraph multi-agent orchestration (intent routing, specialized prompts)
│   │   ├── api/routes/
│   │   │   ├── analysis.py    # Resume matching, ATS score, & Weekly Roadmap triggers
│   │   │   ├── auth.py        # Authentication endpoints (via Supabase Auth)
│   │   │   ├── mentor.py      # AI Mentor Server-Sent Events (SSE) streaming chat & history
│   │   │   ├── resume.py      # Ingest PDF, storage uploads, metadata save, Chroma indexing
│   │   │   └── settings.py    # Setting up user-level OpenAI, Anthropic, & Gemini keys
│   │   ├── chains/
│   │   │   ├── ats_chain.py   # LangChain ATS recruitment alignment chain
│   │   │   ├── roadmap_chain.py# LangChain Structured Study Roadmap compilation
│   │   │   └── skill_gap_chain.py# LangChain Resume Improvements & matched/missing skills chain
│   │   ├── core/
│   │   │   ├── config.py      # Pydantic Settings initialization
│   │   │   └── providers.py   # Dynamic LLM and Embedding resolvers
│   │   ├── db/
│   │   │   └── supabase_client.py# Supabase clients (standard and admin)
│   │   ├── embeddings/
│   │   │   ├── embed_resume.py# Slide-window text chunking & embedding
│   │   │   ├── vector_similarity.py# Cosine similarity calculations
│   │   │   └── vector_store.py# ChromaDB persistent collection and client
│   │   ├── models/
│   │   │   └── auth.py        # Auth Pydantic model schemas
│   │   ├── parsers/
│   │   │   └── pdf_parser.py  # LlamaIndex text reader & LLM structured data extraction
│   │   └── main.py            # API entry point & CORS configuration
│   ├── tests/                 # pytest test suites
│   │   ├── test_analysis.py   # Mocked analysis & roadmaps unit tests
│   │   ├── test_auth.py       # Auth flow schema verification
│   │   ├── test_mentor.py     # AI Mentor streaming tests
│   │   ├── test_resume.py     # PDF upload and storage deletion mocks
│   │   └── test_settings.py   # Secure key management tests
│   ├── Dockerfile             # Container configuration for backend
│   └── requirements.txt       # Python dependencies list
│
├── frontend/                  # Next.js 14 Web App (v0.1.0)
│   ├── app/                   # App Router pages & styles
│   │   ├── (auth)/
│   │   │   ├── login/page.tsx # SignIn page
│   │   │   └── register/page.tsx# SignUp page
│   │   ├── dashboard/page.tsx # main dashboard panel
│   │   ├── jobs/page.tsx      # Job matcher profile comparisons
│   │   ├── mentor/page.tsx    # Live SSE token streaming mentor chat & Speech typing
│   │   ├── resume/page.tsx    # Document pipeline, parser history browser
│   │   ├── roadmap/page.tsx   # Study plan progress checkpoint checklist
│   │   ├── settings/page.tsx  # User API keys configurations (OpenAI, Claude, Gemini)
│   │   ├── globals.css        # Premium vanilla CSS styling system
│   │   ├── layout.tsx         # Root layout context setup
│   │   └── page.tsx           # Home landing page with glows and glassmorphism
│   ├── components/
│   │   └── Providers.tsx      # Zustand & Supabase Auth React contexts
│   ├── lib/
│   │   ├── api.ts             # Axios client with JWT auth headers interceptor
│   │   └── supabase.ts        # Supabase JS client config
│   ├── store/
│   │   └── authStore.ts       # Zustand authentication state store
│   ├── middleware.ts          # Edge cookie-based route protection
│   ├── Dockerfile             # Container configuration for frontend
│   └── package.json           # npm node dependencies
│
├── mobile/                    # Flutter Mobile Client (v1.0.0+1)
│   ├── lib/
│   │   ├── screens/
│   │   │   ├── dashboard_screen.dart    # Overview dashboard panel
│   │   │   ├── job_compare_screen.dart  # Compare resumes with JD
│   │   │   ├── login_screen.dart        # Authentication page
│   │   │   ├── mentor_chat_screen.dart  # AI chat interface
│   │   │   ├── resume_upload_screen.dart# File upload interface
│   │   │   ├── roadmap_screen.dart      # Study roadmaps checklists
│   │   │   └── settings_screen.dart     # Custom developer api keys configuration
│   │   ├── services/
│   │   │   ├── api_service.dart         # Multi-client HTTP REST and SSE streams client
│   │   │   ├── auth_provider.dart       # User authentication notifier state
│   │   │   └── career_provider.dart     # Resumes & analysis notifier state
│   │   ├── widgets/
│   │   │   └── glass_container.dart     # Glassmorphic visual container widget
│   │   └── main.dart                    # Mobile app entry point
│   └── pubspec.yaml           # Flutter pub package dependencies
│
└── supabase/
    └── schema.sql             # SQL database table definitions & RLS rules
```

---

## Latest Version Matrix

| Component | Stack | Version | Path |
| :--- | :--- | :--- | :--- |
| **Overall Platform** | Orchestrated System | `v1.0.0` | Root |
| **Backend API** | FastAPI / Python | `v1.0.0` | [backend/](file:///e:/OneDrive/Desktop/AIC/ai-career-platform/backend) |
| **Web Portal** | Next.js 14 / TS | `v0.1.0` | [frontend/](file:///e:/OneDrive/Desktop/AIC/ai-career-platform/frontend) |
| **Mobile App** | Flutter / Dart | `v1.0.0+1` | [mobile/](file:///e:/OneDrive/Desktop/AIC/ai-career-platform/mobile) |
| **Database Schema** | Supabase SQL | `v1.0.0` | [supabase/schema.sql](file:///e:/OneDrive/Desktop/AIC/ai-career-platform/supabase/schema.sql) |

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
4. Copy the repository environment template into the backend folder and configure `.env` with your Supabase values and default OpenAI/Anthropic/Gemini keys:
   ```bash
   cp ../.env.example .env
   ```
   On Windows PowerShell:
   ```powershell
   Copy-Item ..\.env.example .env -Force
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
