#!/usr/bin/env bash
# Stop hook. On main, claude can't finish a turn while `make smoke` fails.
# Skipped on lane branches (engine, web, eval) and before a smoke target exists.
# Force it anywhere with SMOKE_ALWAYS=1.

input="$(cat)"
case "$input" in
  *'"stop_hook_active":true'* | *'"stop_hook_active": true'*) exit 0 ;;
esac

cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0
branch="$(git rev-parse --abbrev-ref HEAD 2>/dev/null)"
[ "$branch" = "main" ] || [ -n "${SMOKE_ALWAYS:-}" ] || exit 0
grep -qE '^smoke:' Makefile 2>/dev/null || exit 0

# macOS has no `timeout`; perl's alarm gives the same 90 s cap.
if out="$(perl -e 'alarm shift; exec @ARGV' 90 make -s smoke 2>&1)"; then
  exit 0
fi

{
  echo "make smoke is failing (or ran past 90 s) on main. fix it before you stop:"
  printf '%s\n' "$out" | tail -n 40
} >&2
exit 2
