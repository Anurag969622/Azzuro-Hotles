"""
Health router — Phase 2 health check endpoint.
No AI models loaded yet; they are initialised in Phase 4.
"""

import os
import platform
import sys
import time
from datetime import datetime, timezone

from fastapi import APIRouter

router = APIRouter(tags=["health"])

START_TIME = time.time()


def get_memory_mb() -> float:
    """Returns RSS memory in MB using psutil if available, else a fallback."""
    try:
        import psutil
        proc = psutil.Process(os.getpid())
        return round(proc.memory_info().rss / 1024 / 1024, 1)
    except ImportError:
        return -1.0


@router.get("/health", summary="Full health check")
async def health_check():
    """
    Returns service health, system metadata, and model availability status.
    DB and model checks are delegated to Phase 3/4 respectively.
    """
    uptime = round(time.time() - START_TIME, 1)
    models_loaded = os.getenv("MODELS_LOADED", "false").lower() == "true"

    return {
        "success": True,
        "service": "azzurro-insights-ai-worker",
        "version": "1.0.0",
        "phase": "2 — foundation",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "uptime_seconds": uptime,
        "system": {
            "python_version": sys.version.split()[0],
            "platform": platform.system(),
            "memory_mb": get_memory_mb(),
        },
        "checks": {
            "worker": {"status": "ok"},
            "models": {
                "status": "pending" if not models_loaded else "ok",
                "note": "AI models will be loaded in Phase 4" if not models_loaded else "Models loaded",
            },
        },
    }


@router.get("/health/ping", summary="Liveness probe")
async def ping():
    """Ultra-lightweight liveness probe."""
    return {"success": True, "pong": True, "ts": time.time()}
