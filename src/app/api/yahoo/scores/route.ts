/** Daily-game standings aren't kept for Yahoo leagues yet (the games still play). */
export function GET() {
  return Response.json({ enabled: false });
}
