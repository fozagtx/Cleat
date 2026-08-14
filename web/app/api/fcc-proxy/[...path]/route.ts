import { TEE_URL } from "@/lib/server/cleat";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

type RouteContext = {
  params: Promise<{ path: string[] }>;
};

const ACTION_ID_PATTERN = /^(?:0x)?[0-9a-fA-F]{64}$/;

function isAllowedRoute(path: string[]) {
  if (path.length === 1) {
    return path[0] === "info" || path[0] === "instruction";
  }

  return (
    path.length === 3 &&
    path[0] === "action" &&
    path[1] === "result" &&
    ACTION_ID_PATTERN.test(path[2])
  );
}

async function forward(request: Request, context: RouteContext) {
  const { path } = await context.params;

  if (!isAllowedRoute(path)) {
    return new Response("Not found", { status: 404 });
  }
  if (!TEE_URL) {
    return new Response("TEE not configured", { status: 503 });
  }

  const target = `${TEE_URL.replace(/\/$/, "")}/${path.join("/")}`;
  const headers = new Headers();
  const contentType = request.headers.get("content-type");
  if (contentType) {
    headers.set("content-type", contentType);
  }

  try {
    const upstream = await fetch(target, {
      method: request.method,
      headers,
      body: request.method === "POST" ? await request.arrayBuffer() : undefined,
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
    });

    const responseHeaders = new Headers();
    const upstreamContentType = upstream.headers.get("content-type");
    if (upstreamContentType) {
      responseHeaders.set("content-type", upstreamContentType);
    }
    responseHeaders.set("cache-control", "no-store");

    return new Response(upstream.body, {
      status: upstream.status,
      headers: responseHeaders,
    });
  } catch {
    return new Response("TEE proxy unavailable", { status: 502 });
  }
}

export const GET = forward;
export const POST = forward;
