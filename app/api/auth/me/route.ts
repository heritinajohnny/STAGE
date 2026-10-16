import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "../../../db";
import { users } from "../../../db/schema";
import { getSessionFromRequest } from "../../../lib/auth";

export async function GET(request: Request) {
  const session = getSessionFromRequest(request);
  if (!session) return NextResponse.json({ user: null }, { status: 401 });
  const [user] = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      firstName: users.firstName,
      lastName: users.lastName,
      birthDate: users.birthDate,
      gender: users.gender,
      phone: users.phone,
    })
    .from(users)
    .where(eq(users.id, session.id))
    .limit(1);
  if (!user) return NextResponse.json({ user: null }, { status: 401 });
  return NextResponse.json({ user });
}
