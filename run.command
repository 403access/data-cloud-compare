#!/bin/zsh
# Double-click launcher for the Tank ⇄ cloud explorer.
cd "$(dirname "$0")" || exit 1
exec bun run start --open
