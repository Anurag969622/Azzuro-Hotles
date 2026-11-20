#!/usr/bin/env bash
# ai-worker/scripts/setup.sh
# Sets up the Python virtual environment and installs Phase 2 dependencies.
# Run once: bash scripts/setup.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(dirname "$SCRIPT_DIR")"

echo "🐍 Setting up Azzurro AI Worker virtual environment..."
cd "$ROOT"

# Create venv if it doesn't exist
if [ ! -d "venv" ]; then
  python3 -m venv venv
  echo "✅ Virtual environment created at ai-worker/venv/"
else
  echo "ℹ️  Virtual environment already exists"
fi

# Activate and install
source venv/bin/activate
pip install --upgrade pip --quiet
pip install -r requirements.txt --quiet
echo "✅ Phase 2 dependencies installed"

# Copy .env if not present
if [ ! -f ".env" ]; then
  cp .env.example .env
  echo "✅ .env created from .env.example — update AI_SERVICE_SECRET before production"
fi

echo ""
echo "🚀 To start the AI worker:"
echo "   source ai-worker/venv/bin/activate && python ai-worker/main.py"
echo ""
echo "⚠️  AI models (Phase 4 dependencies) are NOT installed yet."
echo "   Run: pip install -r ai-worker/requirements.ai.txt  (when ready for Phase 4)"

