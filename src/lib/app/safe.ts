/**
 * Error text that is safe to log or store: connection strings and secret values are redacted.
 * Raw errors never reach visitors; pages and APIs show their own plain messages instead.
 */
const SECRET_ENV = ["DATABASE_URL", "POSTGRES_URL", "CRON_SECRET", "JOBS_SECRET", "RATE_LIMIT_SALT", "KV_REST_API_TOKEN", "UPSTASH_REDIS_REST_TOKEN"];

export function redact(text: string): string {
  let out = text.replace(/\b(postgres(?:ql)?|redis|rediss|https?):\/\/[^\s"'@]*@[^\s"']*/gi, "$1://[redacted]");
  for (const k of SECRET_ENV) {
    const v = process.env[k];
    if (v && v.length >= 6) out = out.split(v).join("[redacted]");
  }
  return out;
}

export function safeMessage(e: unknown): string {
  const msg = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
  return redact(msg).slice(0, 400);
}

/** console.error without secrets or stack traces full of connection details. */
export function logError(where: string, e: unknown) {
  console.error(`[rafterlore] ${where}: ${safeMessage(e)}`);
}
