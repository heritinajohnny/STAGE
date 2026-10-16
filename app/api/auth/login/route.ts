import { compare } from "bcryptjs";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "../../../db";
import { users } from "../../../db/schema";
import { createSessionToken, SESSION_COOKIE } from "../../../lib/auth";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | { email?: unknown; password?: unknown }
    | null;
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  if (!email || !password) {
    return NextResponse.json({ error: "Identifiants invalides." }, { status: 400 });
  }

  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!user || !(await compare(password, user.passwordHash))) {
    return NextResponse.json({ error: "E-mail ou mot de passe incorrect." }, { status: 401 });
  }

  const token = createSessionToken({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role === "admin" ? "admin" : "user",
  });
  const response = NextResponse.json({
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
    destination: user.role === "admin" ? "/" : "/portal",
  });
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return response;
}
