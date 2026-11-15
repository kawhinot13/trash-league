import { connection } from "next/server";
import {
  OAUTH_COOKIE,
  SESSION_COOKIE,
  authConfigured,
  cookieFlags,
  sessionMaxAge,
  sessionToken,
  unsign,
  upsertGoogleAccount,
} from "@/lib/app/account";
import { logError } from "@/lib/app/safe";

const back = (origin: string, path: string, extra: string[] = []) =>
  new Response(null, {
    status: 302,
    headers: [["location", new URL(path, origin).toString()], ["cache-control", "no-store"], ["set-cookie", `${OAUTH_COOKIE}=; ${cookieFlags(0)}`], ...extra.map((c) => ["set-cookie", c] as [string, string])],
  });

/** Google sends the person back here: check the state, swap the code for their Google id, sign them in. */
export async function GET(req: Request) {
  await connection(); // per request: fresh state, cookies and settings, never prerendered
  const url = new URL(req.url);
  if (!authConfigured()) return new Response("Sign-in isn't set up.", { status: 404 });
  const raw = req.headers.get("cookie")?.match(new RegExp(`(?:^|;\\s*)${OAUTH_COOKIE}=([^;]+)`))?.[1];
  const flow = unsign<{ state: string; verifier: string; next: string }>("o", raw ? decodeURIComponent(raw) : null);
  const code = url.searchParams.get("code");
  if (!flow || !code || url.searchParams.get("state") !== flow.state) return back(url.origin, "/l?signin=failed");
  try {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.AUTH_GOOGLE_ID!,
        client_secret: process.env.AUTH_GOOGLE_SECRET!,
        code,
        code_verifier: flow.verifier,
        grant_type: "authorization_code",
        redirect_uri: new URL("/api/auth/google/callback", url.origin).toString(),
      }),
    });
    if (!res.ok) throw new Error(`token exchange ${res.status}`);
    const { id_token } = (await res.json()) as { id_token?: string };
    // Received straight from Google's token endpoint over TLS with our client secret, so the claims
    // can be read without re-checking the signature (OpenID Connect Core 3.1.3.7); issuer and
    // audience are still checked.
    const claims = JSON.parse(Buffer.from(String(id_token).split(".")[1] ?? "", "base64url").toString()) as {
      iss?: string;
      aud?: string;
      sub?: string;
      given_name?: string;
      name?: string;
    };
    if (!["https://accounts.google.com", "accounts.google.com"].includes(claims.iss ?? "") || claims.aud !== process.env.AUTH_GOOGLE_ID || !claims.sub)
      throw new Error("unexpected id token");
    const session = await upsertGoogleAccount(claims.sub, claims.given_name || claims.name || "");
    return back(url.origin, flow.next, [`${SESSION_COOKIE}=${sessionToken(session.id, session.v)}; ${cookieFlags(sessionMaxAge)}`]);
  } catch (e) {
    logError("google sign-in", e);
    return back(url.origin, "/l?signin=failed");
  }
}
