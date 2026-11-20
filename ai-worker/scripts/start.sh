#!/usr/bin/env bash
# ai-worker/scripts/start.sh
set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(dirname "$SCRIPT_DIR")"
cd "$ROOT"
source venv/bin/activate
python main.py

