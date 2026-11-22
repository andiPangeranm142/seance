/**
 * Séance Wayback proxy — Cloudflare Worker (free tier, no secrets, no KV).
 *
 * Why it exists: the Wayback Machine's CDX API and raw snapshot responses do
 * not send `Access-Control-Allow-Origin`, so a browser app cannot call them
 * directly (verified 22 Nov 2026). This worker forwards GET requests to the
 * Wayback Machine and adds permissive CORS headers.
 *
 * Safety: allow-listed hosts only, GET only, 5 MB response cap, 20 s upstream
 * timeout, no credentials forwarded, no cookies passed through.
 */

const ALLOWED_HOSTS = new Set(["web.archive.org", "archive.org"]);
const MAX_BYTES = 5 * 1024 * 1024;
const UPSTREAM_TIMEOUT_MS = 20_000;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
};

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }
    if (request.method !== "GET") {
      return jsonError("Only GET is supported.", 405);
    }

    const target = new URL(request.url).searchParams.get("url");
    if (!target) {
      return jsonError("Missing ?url= parameter.", 400);
    }

    let upstream: URL;
    try {
      upstream = new URL(target);
    } catch {
      return jsonError("Invalid ?url= parameter.", 400);
    }
    if (upstream.protocol !== "https:" || !ALLOWED_HOSTS.has(upstream.hostname)) {
      return jsonError("Only https://web.archive.org and https://archive.org are allowed.", 403);
    }

    let response: Response;
    try {
      response = await fetch(upstream.toString(), {
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
        headers: { "User-Agent": "Seance-Kiroween/0.1 (+https://github.com/andiPangeranm142)" },
      });
    } catch {
      return jsonError("Upstream request failed or timed out.", 502);
    }

    const declaredLength = Number(response.headers.get("content-length"));
    if (Number.isFinite(declaredLength) && declaredLength > MAX_BYTES) {
      return jsonError("Upstream response exceeds the 5 MB cap.", 413);
    }

    const headers = new Headers(response.headers);
    headers.delete("set-cookie");
    headers.delete("content-encoding");
    for (const [key, value] of Object.entries(CORS_HEADERS)) {
      headers.set(key, value);
    }
    headers.set("X-Seance-Proxy", "1");
    headers.set("Cache-Control", "public, max-age=3600");

    // Enforce the cap on the actual body (for chunked responses without a
    // content-length header) by cutting the stream off at MAX_BYTES.
    const body = response.body;
    if (!body) {
      return new Response(null, { status: response.status, headers });
    }
    let seen = 0;
    const capped = body.pipeThrough(
      new TransformStream({
        transform(chunk, controller) {
          seen += chunk.byteLength;
          if (seen > MAX_BYTES) {
            controller.error(new Error("Response exceeds the 5 MB cap."));
            return;
          }
          controller.enqueue(chunk);
        },
      }),
    );

    return new Response(capped, { status: response.status, headers });
  },
};
