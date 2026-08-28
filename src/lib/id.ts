import { ROOM_ID_ALPHABET, ROOM_ID_LENGTH } from '@/domain/constants';

function randomBytes(length: number): Uint8Array {
  const out = new Uint8Array(length);
  const cryptoRef = globalThis.crypto;
  if (cryptoRef?.getRandomValues) {
    cryptoRef.getRandomValues(out);
    return out;
  }
  for (let i = 0; i < length; i += 1) out[i] = Math.floor(Math.random() * 256);
  return out;
}

function fromAlphabet(alphabet: string, length: number): string {
  const bytes = randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += alphabet[(bytes[i] ?? 0) % alphabet.length];
  }
  return out;
}

export function buildRoomId(): string {
  return fromAlphabet(ROOM_ID_ALPHABET, ROOM_ID_LENGTH);
}

/** 방을 만든 사람만 고쳐 쓸 수 있게 하는 비밀값. 브라우저에만 남는다. */
export function buildOwnerKey(): string {
  return fromAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 32);
}

export function buildLocalId(): string {
  return fromAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 10);
}
