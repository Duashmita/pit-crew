#!/usr/bin/env bash
# Notification hook. A mac banner naming the session that needs you; terminal bell elsewhere.
cat >/dev/null
name="$(basename "${CLAUDE_PROJECT_DIR:-$PWD}")"
osascript -e "display notification \"$name needs you\" with title \"Claude Code\" sound name \"Glass\"" \
  >/dev/null 2>&1 || printf '\a'
exit 0
