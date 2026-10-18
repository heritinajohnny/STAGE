import { asc, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "../../../db";
import { patients, users } from "../../../db/schema";
import { requireAdmin } from "../../../lib/access";

export async function GET(request: Request) {
  const { response } = requireAdmin(request);
  if (response) return response;

  try {
    const accounts = await db
      .select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        name: users.name,
        birthDate: users.birthDate,
        gender: users.gender,
        phone: users.phone,
        address: sql<string>`COALESCE(NULLIF(${users.address}, ''), ${patients.address}, '')`,
        email: users.email,
        isActive: users.isActive,
        createdAt: users.createdAt,
        patientId: patients.id,
      })
      .from(users)
      .leftJoin(patients, eq(patients.userId, users.id))
      .where(eq(users.role, "user"))
      .orderBy(asc(users.lastName), asc(users.firstName));

    return NextResponse.json(accounts);
  } catch (error) {
    console.error("Erreur lors de la récupération des comptes patients:", error);
    return NextResponse.json({ error: "Impossible de charger les comptes patients." }, { status: 500 });
  }
}
