#!/bin/bash
# Stop hook: when TypeScript changed in this turn, typecheck and lint once before Claude finishes.
# Silent when clean or when nothing changed; blocks the stop with the first errors otherwise.
# Skips re-checking the same unchanged diff, and never loops (stop_hook_active).
cd "${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null)}" || exit 0
input=$(cat)
[ "$(printf '%s' "$input" | jq -r '.stop_hook_active // false' 2>/dev/null)" = "true" ] && exit 0
[ -d node_modules ] || exit 0

changed=$( { git diff --name-only HEAD 2>/dev/null; git ls-files --others --exclude-standard 2>/dev/null; } \
  | grep -E '\.(ts|tsx)$' | grep -v '^next-env\.d\.ts$' | sort -u)
[ -z "$changed" ] && exit 0

state=".claude/.cache"; mkdir -p "$state"
sig=$( { git diff HEAD -- $changed; for f in $changed; do [ -f "$f" ] && cat "$f"; done; } | sha1sum | cut -c1-40)
[ "$(cat "$state/check-ts.ok" 2>/dev/null)" = "$sig" ] && exit 0

existing=$(for f in $changed; do [ -f "$f" ] && echo "$f"; done)
tsc_out=$(npx tsc --noEmit 2>&1); tsc_rc=$?
lint_out=$( [ -n "$existing" ] && npx eslint --quiet $existing 2>&1); lint_rc=$?

if [ $tsc_rc -eq 0 ] && [ $lint_rc -eq 0 ]; then
  echo "$sig" > "$state/check-ts.ok"
  exit 0
fi
report=$(printf '%s\n%s' "$tsc_out" "$lint_out" | grep -v '^\s*$' | head -40)
jq -n --arg r "Typecheck/lint failed on changed TypeScript. Fix before finishing:
$report" '{decision: "block", reason: $r}'
exit 0
