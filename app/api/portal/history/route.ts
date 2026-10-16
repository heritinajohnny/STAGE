import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "../../../db";
import { consultations, doctors, patients } from "../../../db/schema";
import { getSessionFromRequest } from "../../../lib/auth";

export async function GET(request: Request) {
  const session = getSessionFromRequest(request);
  if (!session || session.role !== "user") {
    return NextResponse.json({ error: "Accès réservé aux comptes utilisateurs." }, { status: 403 });
  }
  const history = await db.select({
    id: consultations.id,
    consultationDate: consultations.consultationDate,
    diagnosis: consultations.diagnosis,
    prescription: consultations.prescription,
    notes: consultations.notes,
    doctorFirstName: doctors.firstName,
    doctorLastName: doctors.lastName,
    specialty: doctors.specialty,
  }).from(consultations)
    .innerJoin(patients, eq(consultations.patientId, patients.id))
    .innerJoin(doctors, eq(consultations.doctorId, doctors.id))
    .where(eq(patients.userId, session.id));
  return NextResponse.json(history);
}
