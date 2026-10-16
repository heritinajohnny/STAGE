import { createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "psfa_session";
const SESSION_DURATION = 60 * 60 * 24 * 7;
const SESSION_SECRET =
  process.env.SESSION_SECRET ||
  (process.env.NODE_ENV === "production" ? "" : "local-development-session-secret");

export interface SessionUser {
  id: number;
  name: string;
  email: string;
  role: "admin" | "user";
  expiresAt: number;
}

export function createSessionToken(user: Omit<SessionUser, "expiresAt">) {
  if (!SESSION_SECRET) throw new Error("SESSION_SECRET doit être configuré.");
  const payload: SessionUser = {
    ...user,
    expiresAt: Math.floor(Date.now() / 1000) + SESSION_DURATION,
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", SESSION_SECRET)
    .update(encoded)
    .digest("base64url");
  return `${encoded}.${signature}`;
}

export function verifySessionToken(token: string | undefined): SessionUser | null {
  if (!token || !SESSION_SECRET) return null;
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) return null;

  const expected = createHmac("sha256", SESSION_SECRET)
    .update(encoded)
    .digest();
  let actual: Buffer;
  try {
    actual = Buffer.from(signature, "base64url");
  } catch {
    return null;
  }
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    return null;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8"),
    ) as SessionUser;
    if (
      !Number.isInteger(payload.id) ||
      !["admin", "user"].includes(payload.role) ||
      typeof payload.name !== "string" ||
      typeof payload.email !== "string" ||
      payload.expiresAt <= Math.floor(Date.now() / 1000)
    ) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export function getSessionFromRequest(request: Request) {
  const cookies = request.headers.get("cookie") || "";
  const token = cookies
    .split(";")
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith(`${SESSION_COOKIE}=`))
    ?.slice(SESSION_COOKIE.length + 1);
  return verifySessionToken(token ? decodeURIComponent(token) : undefined);
}
