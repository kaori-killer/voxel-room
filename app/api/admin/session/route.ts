import { z } from 'zod';
import { ADMIN_COOKIE, isAdminConfigured, verifyPasscode } from '@/lib/adminSession';
import { jsonError, jsonOk, readJsonBody } from '@/lib/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bodySchema = z.object({ passcode: z.string().min(1).max(200) });

export async function POST(request: Request) {
  if (!isAdminConfigured()) return jsonError('관리자 비밀번호가 설정되지 않았습니다', 503);

  const parsed = bodySchema.safeParse(await readJsonBody(request));
  if (!parsed.success) return jsonError('요청 형식이 올바르지 않습니다', 400);
  if (!verifyPasscode(parsed.data.passcode)) return jsonError('비밀번호가 맞지 않습니다', 401);

  const response = jsonOk({ ok: true });
  response.cookies.set(ADMIN_COOKIE, parsed.data.passcode, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 12,
  });
  return response;
}

export async function DELETE() {
  const response = jsonOk({ ok: true });
  response.cookies.delete(ADMIN_COOKIE);
  return response;
}
