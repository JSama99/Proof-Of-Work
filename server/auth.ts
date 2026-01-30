import crypto from "crypto";
import { Request, Response, NextFunction } from "express";

type TokenPayload = { sub: string; iat: number; exp: number; v: 1 };

function secret(): string {
  const s = process.env.POW_AUTH_SECRET;
  if (!s) throw new Error("Missing POW_AUTH_SECRET");
  return s;
}

function base64urlEncode(buffer: Buffer): string {
  return buffer.toString("base64url");
}

function base64urlDecode(str: string): Buffer {
  return Buffer.from(str, "base64url");
}

export function signToken(userId: string, ttlSeconds = 60 * 60 * 24 * 7): string {
  const now = Math.floor(Date.now() / 1000);
  const payload: TokenPayload = { sub: userId, iat: now, exp: now + ttlSeconds, v: 1 };

  const body = base64urlEncode(Buffer.from(JSON.stringify(payload), "utf8"));
  const sig = crypto.createHmac("sha256", secret()).update(body).digest();
  const sigB64 = base64urlEncode(sig);
  return `${body}.${sigB64}`;
}

export function verifyToken(token: string): { ok: true; userId: string } | { ok: false } {
  try {
    const [body, sigB64] = token.split(".");
    if (!body || !sigB64) return { ok: false };

    const expected = crypto.createHmac("sha256", secret()).update(body).digest();
    const got = base64urlDecode(sigB64);

    if (got.length !== expected.length) return { ok: false };
    if (!crypto.timingSafeEqual(Buffer.from(got), expected)) return { ok: false };

    const payload = JSON.parse(Buffer.from(base64urlDecode(body)).toString("utf8")) as TokenPayload;
    const now = Math.floor(Date.now() / 1000);

    if (payload.v !== 1) return { ok: false };
    if (typeof payload.sub !== "string") return { ok: false };
    if (payload.exp <= now) return { ok: false };

    return { ok: true, userId: payload.sub };
  } catch {
    return { ok: false };
  }
}

export function requireUser(req: Request, res: Response, next: NextFunction) {
  const auth = req.header("authorization") || "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (!m) return res.status(401).json({ error: "Missing Authorization: Bearer <token>" });

  const verified = verifyToken(m[1]);
  if (!verified.ok) return res.status(401).json({ error: "Invalid or expired token" });

  (req as any).userId = verified.userId;
  next();
}

export function getUserId(req: Request): string {
  return (req as any).userId as string;
}
