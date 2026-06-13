# AI Career Intelligence Platform

A premium, end-to-end web + Android platform designed to optimize resumes, evaluate ATS scores, pinpoint skill gaps, build structured study plans, and provide interactive coaching with a LangGraph-orchestrated multi-agent system.

---

## Project Structure

```
ai-career-platform/
├── supabase/
│   └── schema.sql             # SQL database table definitions & RLS
├── backend/                   # FastAPI backend app
│   ├── app/
│   │   ├── api/
│   │   │   └── routes/
│   │   │       └── auth.py    # Authentication routes
│   │   ├── core/
│   │   │   └── config.py      # Pydantic environment configurations
│   │   ├── db/
│   │   │   └── supabase_client.py # Client instances (anon & admin)
│   │   ├── models/
│   │   │   └── auth.py        # Pydantic auth schemas
│   │   └── main.py            # API entry point
│   ├── tests/
│   │   └── test_auth.py       # pytest unit test cases
│   ├── .env                   # Local configuration
│   └── requirements.txt       # Python dependencies
├── frontend/                  # Next.js 14 frontend (Tailwind + shadcn-ready)
│   ├── app/
│   │   ├── (auth)/
│   │   │   ├── login/         # Sign-in page (glassmorphism)
│   │   │   └── register/      # Registration page
│   │   ├── dashboard/         # Protected dashboard hub
│   │   ├── resume/            # Phase 2 placeholder page
│   │   ├── jobs/              # Phase 3 placeholder page
│   │   ├── roadmap/           # Phase 4 placeholder page
│   │   └── mentor/            # Phase 5 placeholder page
│   ├── components/
│   │   └── Providers.tsx      # Zustand + React Query global providers
│   ├── lib/
│   │   ├── api.ts             # Axios HTTP client with JWT interceptor
│   │   └── supabase.ts        # Browser Supabase client instance
│   ├── store/
│   │   └── authStore.ts       # Zustand authentication state store
│   ├── middleware.ts          # Edge cookie-based route protection
│   ├── tailwind.config.js     # Premium theme & animation tokens
│   ├── globals.css            # Styles baseline & glass effects
│   ├── .env.local             # Local environment configurations
│   └── package.json           # Frontend packages
└── .env.example               # Environmental variable templates
```

---

## Phase 1 Setup & Run Instructions

### 1. Database Configuration (Supabase)
1. Register a free account at [Supabase](https://supabase.com/).
2. Create a new project named `AI Career Platform`.
3. In the left panel, click **SQL Editor** -> **New Query**.
4. Paste and execute the contents of [supabase/schema.sql](file:///e:/OneDrive/Desktop/AIC/ai-career-platform/supabase/schema.sql) to set up tables, RLS permissions, and triggers.
5. In Supabase Project Settings -> API, copy your `Project URL`, `anon public API key`, and `service_role secret key`.

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
4. Configure `.env` with your Supabase values.
5. Start the local server:
   ```bash
   python app/main.py
   # Or using uvicorn directly:
   uvicorn app.main:app --reload
   ```
   The backend will be available at `http://localhost:8000`. Test `/health` in browser.

6. Run automated test cases:
   ```bash
   pytest tests/test_auth.py
   ```

### 3. Frontend Installation & Run
1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install npm packages:
   ```bash
   npm install
   ```
3. Configure `.env.local` with your Supabase credentials:
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

## Authentication Flow Details
1. **Sign Up / Sign In:** Handled directly via the frontend using `@supabase/supabase-js`. 
2. **Session Persistence:** Authenticated sessions are persisted in browser storage and synchronized via a local cookie (`sb-session`) to allow immediate server-side Next.js route protection.
3. **API Integrity:** The Axios client interceptor extracts the active JWT access token from Zustand and appends it to all backend headers. The FastAPI `/auth/me` route calls the Supabase API with this token to guarantee security.
