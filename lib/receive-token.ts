import { createHmac, timingSafeEqual } from "crypto";

const SECRET = process.env.RECEIVE_TOKEN_SECRET ?? "card-cloud-receive-default-secret";

export function generateReceiveToken(orderId: string): string {
  return createHmac("sha256", SECRET).update(orderId).digest("hex").slice(0, 24);
}

export function verifyReceiveToken(orderId: string, token: string): boolean {
  if (!token) return false;
  const expected = generateReceiveToken(orderId);
  try {
    return timingSafeEqual(Buffer.from(token), Buffer.from(expected));
  } catch {
    return false;
  }
}
