import { and, eq, isNull, or } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "../../../db";
import { patients, users } from "../../../db/schema";
import { getSessionFromRequest } from "../../../lib/auth";

export async function POST(request: Request) {
  const session = getSessionFromRequest(request);
  if (!session || session.role !== "user") {
    return NextResponse.json({ error: "Accès réservé aux comptes utilisateurs." }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as
    | { firstName?: unknown; lastName?: unknown; birthDate?: unknown; gender?: unknown; phone?: unknown }
    | null;
  const firstName = typeof body?.firstName === "string" ? body.firstName.trim() : "";
  const lastName = typeof body?.lastName === "string" ? body.lastName.trim() : "";
  const birthDate = typeof body?.birthDate === "string" ? body.birthDate : "";
  const gender = typeof body?.gender === "string" ? body.gender : "";
  const phone = typeof body?.phone === "string" ? body.phone.trim() : "";

  if (
    firstName.length < 2 ||
    firstName.length > 100 ||
    lastName.length < 2 ||
    lastName.length > 100 ||
    !/^\d{4}-\d{2}-\d{2}$/.test(birthDate) ||
    Number.isNaN(Date.parse(`${birthDate}T00:00:00Z`)) ||
    new Date(`${birthDate}T00:00:00Z`) >= new Date() ||
    !["M", "F", "AUTRE"].includes(gender) ||
    phone.length < 6 ||
    phone.length > 20
  ) {
    return NextResponse.json({ error: "Vérifiez vos informations personnelles." }, { status: 400 });
  }

  const user = await db.transaction(async (tx) => {
    const [current] = await tx.select({
      firstName: users.firstName,
      lastName: users.lastName,
      birthDate: users.birthDate,
      phone: users.phone,
    }).from(users).where(eq(users.id, session.id)).limit(1);
    if (!current) return null;
    const [updated] = await tx
      .update(users)
      .set({ firstName, lastName, birthDate, gender, phone, name: `${firstName} ${lastName}` })
      .where(eq(users.id, session.id))
      .returning({ id: users.id });
    const currentPatient = await tx.update(patients)
      .set({ firstName, lastName, birthDate, gender, phone })
      .where(eq(patients.userId, session.id))
      .returning({ id: patients.id });
    if (!currentPatient.length) {
      const [legacyPatient] = await tx.select({ id: patients.id }).from(patients).where(and(
        eq(patients.firstName, current.firstName),
        eq(patients.lastName, current.lastName),
        eq(patients.birthDate, current.birthDate),
        eq(patients.phone, current.phone),
        or(isNull(patients.userId), eq(patients.userId, session.id)),
      )).limit(1);
      if (legacyPatient) {
        await tx.update(patients).set({
          userId: session.id,
          firstName,
          lastName,
          birthDate,
          gender,
          phone,
        }).where(eq(patients.id, legacyPatient.id));
      }
    }
    return updated;
  });
  if (!user) return NextResponse.json({ error: "Compte introuvable." }, { status: 404 });
  return NextResponse.json({ success: true });
}
