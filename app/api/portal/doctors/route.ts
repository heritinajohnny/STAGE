import { asc } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "../../../db";
import { doctors } from "../../../db/schema";
import { getSessionFromRequest } from "../../../lib/auth";

export async function GET(request: Request) {
  const session = getSessionFromRequest(request);
  if (!session || session.role !== "user") {
    return NextResponse.json({ error: "Accès réservé aux comptes utilisateurs." }, { status: 403 });
  }

  const data = await db
    .select({
      id: doctors.id,
      firstName: doctors.firstName,
      lastName: doctors.lastName,
      specialty: doctors.specialty,
    })
    .from(doctors)
    .orderBy(asc(doctors.lastName));
  return NextResponse.json(data);
}
