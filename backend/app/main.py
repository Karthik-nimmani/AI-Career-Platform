import sys
import os
# Inject parent directory into path so app module can be found when run directly
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.api.routes import auth, resume, analysis, mentor, settings as settings_route

# Initialize the FastAPI app
app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Backend API for the AI Career Intelligence Platform",
    version="1.0.0"
)

# Parse allowed origins from settings
origins = [origin.strip() for origin in settings.ALLOWED_ORIGINS.split(",")]

# Configure CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(auth.router, prefix="/api")
app.include_router(resume.router, prefix="/api")
app.include_router(analysis.router, prefix="/api")
app.include_router(mentor.router, prefix="/api")
app.include_router(settings_route.router, prefix="/api")


@app.get("/health", tags=["health"])
async def health_check():
    """
    Health check endpoint to verify backend status.
    """
    return {
        "status": "healthy",
        "project": settings.PROJECT_NAME,
        "version": "1.0.0"
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
