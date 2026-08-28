import { cookies } from 'next/headers';

export const ADMIN_COOKIE = 'voxel_admin';

/** 상수 시간 비교. 짧은 문자열이라도 길이만 흘리지 않게 한다. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function verifyPasscode(input: string): boolean {
  const expected = process.env.ADMIN_PASSCODE;
  if (!expected) return false;
  return safeEqual(input, expected);
}

export async function isAdminRequest(): Promise<boolean> {
  const expected = process.env.ADMIN_PASSCODE;
  if (!expected) return false;
  const store = await cookies();
  const token = store.get(ADMIN_COOKIE)?.value;
  return typeof token === 'string' && safeEqual(token, expected);
}

export function isAdminConfigured(): boolean {
  return Boolean(process.env.ADMIN_PASSCODE);
}
