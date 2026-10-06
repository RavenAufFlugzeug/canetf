import "server-only";

import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

// scrypt cost settings. They're stored inside each hash, so they can be raised later
// without breaking existing passwords.
const N = 2 ** 15;
const R = 8;
const P = 1;
const KEY_LENGTH = 64;
const MAX_MEMORY = 64 * 1024 * 1024; // N=2^15, r=8 needs 32 MB, Node's default limit

function derive(password: string, salt: Buffer, n: number, r: number, p: number) {
  return new Promise<Buffer>((resolve, reject) =>
    scrypt(password, salt, KEY_LENGTH, { N: n, r, p, maxmem: MAX_MEMORY }, (err, key) =>
      err ? reject(err) : resolve(key),
    ),
  );
}

// Format: scrypt$N$r$p$<salt base64>$<hash base64>
export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const hash = await derive(password, salt, N, R, P);
  return ["scrypt", N, R, P, salt.toString("base64"), hash.toString("base64")].join("$");
}

export async function verifyPassword(password: string, stored: string) {
  const [scheme, n, r, p, salt, hash] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !hash) {
    return false;
  }
  const expected = Buffer.from(hash, "base64");
  const actual = await derive(password, Buffer.from(salt, "base64"), Number(n), Number(r), Number(p));
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

// Used when the username doesn't exist, so a failed login takes the same time either way
// and response timing doesn't reveal which usernames exist.
export async function fakeVerify(password: string) {
  await derive(password, Buffer.alloc(16), N, R, P);
  return false;
}
