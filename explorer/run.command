#!/bin/zsh
# Double-click launcher for the Tank ⇄ cloud explorer.
cd "$(dirname "$0")/.." || exit 1
exec python3 explorer/server.py --open
