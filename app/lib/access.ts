import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { users } from "../db/schema";
import { getSessionFromRequest } from "./auth";

export function requireAdmin(request: Request) {
  const session = getSessionFromRequest(request);
  if (!session || session.role !== "admin") {
    return {
      session: null,
      response: NextResponse.json({ error: "Accès réservé à l’administration." }, { status: 403 }),
    };
  }
  return { session, response: null };
}

export async function requireActiveUser(request: Request) {
  const session = getSessionFromRequest(request);
  if (!session || session.role !== "user") {
    return {
      session: null,
      response: NextResponse.json({ error: "Accès réservé aux comptes utilisateurs." }, { status: 403 }),
    };
  }

  const [user] = await db
    .select({ isActive: users.isActive })
    .from(users)
    .where(eq(users.id, session.id))
    .limit(1);
  if (!user || !user.isActive) {
    return {
      session: null,
      response: NextResponse.json({ error: "Ce compte a été désactivé. Contactez l’administration." }, { status: 403 }),
    };
  }
  return { session, response: null };
}
