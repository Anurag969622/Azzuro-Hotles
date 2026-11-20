"""
Azzurro Insights — Python AI Worker
FastAPI application entrypoint.

Phase 2: Health check only. AI models loaded in Phase 4.
"""

import os
import platform
import sys
import time
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers import health, analysis

load_dotenv()

START_TIME = time.time()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler — startup and shutdown hooks."""
    print(f"🤖 Azzurro AI Worker starting on port {os.getenv('PORT', 8001)}")
    print(f"   Python {sys.version.split()[0]} · Phase 2 (health only)")
    yield
    print("🛑 AI Worker shutting down")


app = FastAPI(
    title="Azzurro Insights AI Worker",
    description="Local NLP inference service for hotel review analysis",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# ── CORS ──────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3001"],  # Express server only
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type", "X-Service-Secret"],
)

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(health.router)
app.include_router(analysis.router)


# ── Root ──────────────────────────────────────────────────────────────────────
@app.get("/", tags=["root"])
async def root():
    return {
        "service": "azzurro-insights-ai-worker",
        "version": "1.0.0",
        "docs": "/docs",
        "health": "/health",
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host=os.getenv("HOST", "0.0.0.0"),
        port=int(os.getenv("PORT", 8001)),
        reload=True,
        log_level="info",
    )

