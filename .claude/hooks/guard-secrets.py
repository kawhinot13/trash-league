#!/usr/bin/env python3
"""PreToolUse guard: keep secret files and secret values out of the conversation.

Blocks reading or writing .env files (except .env.example), private keys and similar, and shell
commands that print secret environment variables. Everything else passes untouched."""
import json, re, sys

try:
    data = json.load(sys.stdin)
except Exception:
    sys.exit(0)  # never break a tool call because of a hook parsing problem

tool = data.get("tool_name", "")
inp = data.get("tool_input") or {}

SECRET_FILE = re.compile(r"(^|[/\s'\"=])(\.env(?!\.example\b)(\.[\w.-]+)?|[\w.-]*\.(pem|key|p12|pfx)|id_(rsa|ed25519|ecdsa)|\.npmrc|\.netrc|credentials\.json)(?=$|[\s'\";|&)])")
# Shell commands: only unmistakable secret files. A bare ".key" shows up in code all the time
# (brand.key("x")), so key files are only blocked for the file tools above.
SECRET_FILE_SH = re.compile(r"(^|[/\s'\"=])(\.env(?!\.example\b)(\.[\w.-]+)?|[\w-]+\.(pem|p12|pfx)|id_(rsa|ed25519|ecdsa)|\.npmrc|\.netrc|credentials\.json)(?=$|[\s'\";|&)])")
SECRET_VAR = r"(DATABASE_URL|POSTGRES_URL|CRON_SECRET|JOBS_SECRET|RATE_LIMIT_SALT|KV_REST_API_TOKEN|UPSTASH_REDIS_REST_TOKEN|TWENTY_FIRST_API_KEY|[A-Z0-9_]*_(API_KEY|SECRET|TOKEN|PASSWORD))"
PRINT_VAR = re.compile(r"(printenv\s+" + SECRET_VAR + r"\b|(echo|printf)[^|;&]*\$\{?" + SECRET_VAR + r"\b|\benv\b\s*(\||$)(?!.*sed)|\bset\b\s*\|)")

def deny(reason):
    print(json.dumps({"hookSpecificOutput": {"hookEventName": "PreToolUse", "permissionDecision": "deny",
                                             "permissionDecisionReason": reason}}))
    sys.exit(0)

if tool in ("Read", "Edit", "Write", "NotebookEdit", "Grep", "Glob"):
    for key in ("file_path", "path", "notebook_path", "pattern"):
        v = inp.get(key)
        if isinstance(v, str) and SECRET_FILE.search(" " + v):
            deny(f"Blocked by the secret-file guard: {v} may hold credentials. Use .env.example or ask the owner.")
elif tool == "Bash":
    cmd = inp.get("command") or ""
    if SECRET_FILE_SH.search(" " + cmd) and not re.search(r"\.env\.example|\.gitignore", cmd):
        deny("Blocked by the secret-file guard: this command touches a file that may hold credentials.")
    if PRINT_VAR.search(cmd):
        deny("Blocked by the secret-file guard: this command would print a secret environment variable. Check it is set with `[ -n \"$VAR\" ]` instead.")
sys.exit(0)
