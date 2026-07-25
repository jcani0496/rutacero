import { toNextJsHandler } from "better-auth/next-js";

import { getAuth } from "@/lib/auth/server";
import { isBetterAuthEnabled } from "@/lib/auth/provider";

async function guard(method: "GET" | "POST", request: Request) {
  if (!isBetterAuthEnabled()) {
    return Response.json(
      {
        error: "better-auth is not enabled",
        hint: "Set AUTH_PROVIDER=better-auth and DATABASE_URL to use this route",
      },
      { status: 503 },
    );
  }

  const { GET, POST } = toNextJsHandler(getAuth());
  return method === "GET" ? GET(request) : POST(request);
}

export async function GET(request: Request) {
  return guard("GET", request);
}

export async function POST(request: Request) {
  return guard("POST", request);
}
