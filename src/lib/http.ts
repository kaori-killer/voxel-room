import { NextResponse } from 'next/server';
import type { ApiErrorResType } from '@/api/types';

export function jsonError(message: string, status: number): NextResponse<ApiErrorResType> {
  return NextResponse.json({ error: message }, { status });
}

export function jsonOk<T>(payload: T, status = 200): NextResponse<T> {
  return NextResponse.json(payload, { status });
}

export async function readJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}
