"""
Phase 2 health check tests for the AI Worker.
"""

import pytest
from httpx import AsyncClient, ASGITransport

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from main import app


@pytest.mark.asyncio
async def test_health_ping():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/health/ping")
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["pong"] is True
    assert isinstance(data["ts"], float)


@pytest.mark.asyncio
async def test_health_full():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["service"] == "azzurro-insights-ai-worker"
    assert "checks" in data
    assert data["checks"]["worker"]["status"] == "ok"
    assert "system" in data
    assert "python_version" in data["system"]


@pytest.mark.asyncio
async def test_root():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/")
    assert response.status_code == 200
    assert response.json()["service"] == "azzurro-insights-ai-worker"

