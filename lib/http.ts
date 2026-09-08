import { getChatGPTUser } from "../app/chatgpt-auth";
export function json(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store, private",
      "X-Content-Type-Options": "nosniff",
      Vary: "Cookie",
    },
  });
}
export async function identity() {
  const user = await getChatGPTUser();
  return user?.userId || null;
}
export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const expected = new URL(request.url).origin;
  return !!origin && origin === expected && request.headers.get("sec-fetch-site") !== "cross-site";
}
