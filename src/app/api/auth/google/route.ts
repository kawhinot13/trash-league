import { connection } from "next/server";
import { createHash } from "node:crypto";
import { OAUTH_COOKIE, authConfigured, cookieFlags, randomToken, safeNext, sign } from "@/lib/app/account";

/** Start "Sign in with Google": a one-time state and PKCE verifier in a short-lived signed cookie. */
export async function GET(req: Request) {
  await connection(); // per request: fresh state, cookies and settings, never prerendered
  if (!authConfigured()) return new Response("Sign-in isn't set up.", { status: 404 });
  const url = new URL(req.url);
  const state = randomToken();
  const verifier = randomToken();
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const google = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  google.search = new URLSearchParams({
    client_id: process.env.AUTH_GOOGLE_ID!,
    redirect_uri: new URL("/api/auth/google/callback", url.origin).toString(),
    response_type: "code",
    // email: only to recognize the site admin at sign-in (never stored).
    scope: "openid profile email",
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
    prompt: "select_account",
  }).toString();
  const cookie = sign("o", { state, verifier, next: safeNext(url.searchParams.get("next")) }, 600);
  return new Response(null, {
    status: 302,
    headers: { location: google.toString(), "set-cookie": `${OAUTH_COOKIE}=${cookie}; ${cookieFlags(600)}`, "cache-control": "no-store" },
  });
}
