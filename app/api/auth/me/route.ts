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
      address: users.address,
      isActive: users.isActive,
    })
    .from(users)
    .where(eq(users.id, session.id))
    .limit(1);
  if (!user || !user.isActive) {
    const response = NextResponse.json({ user: null }, { status: 401 });
    response.cookies.delete("psfa_session");
    return response;
  }
  return NextResponse.json({ user: {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    firstName: user.firstName,
    lastName: user.lastName,
    birthDate: user.birthDate,
    gender: user.gender,
    phone: user.phone,
    address: user.address,
  } });
}
