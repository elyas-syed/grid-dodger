#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
echo "Grid Dodger"
echo "  1) npm test"
echo "  2) npm run serve          # UI + /decider proxy → http://127.0.0.1:8080/game/"
echo "  3) npm run decider        # strands-decider on :8000 (needs .venv)"
echo "  4) UI Mode=decider, source=http, Decider URL=/decider"
exec npm run serve
