import { NextResponse } from 'next/server';
import { openApiSpec } from '@/lib/openapi/spec';

/**
 * GET /api/docs
 *
 * Returns the OpenAPI specification in JSON format
 */
export async function GET(request: Request) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  // Avoid exposing the spec cross-origin in production.
  // In development, allow same-origin usage by reflecting the Origin header.
  const origin = request.headers.get('origin');
  if (origin && process.env.NODE_ENV !== 'production') {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Vary'] = 'Origin';
  }

  return NextResponse.json(openApiSpec, { headers });
}
