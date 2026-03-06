#!/usr/bin/env bash
set -euo pipefail

SESSION="baden"
DIR="$(cd "$(dirname "$0")" && pwd)"

# Kill existing session if any
tmux kill-session -t "$SESSION" 2>/dev/null || true

tmux new-session -d -s "$SESSION" -c "$DIR"

# Left pane: server
tmux send-keys -t "$SESSION" "cd $DIR && npm run dev:server" Enter

# Right pane: client
tmux split-window -h -t "$SESSION" -c "$DIR"
tmux send-keys -t "$SESSION" "cd $DIR && npm run dev:client" Enter

tmux attach -t "$SESSION"
