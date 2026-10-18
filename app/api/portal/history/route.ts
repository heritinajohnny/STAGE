import { desc, eq, or } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "../../../db";
import { appointments, consultations, doctors, patients } from "../../../db/schema";
import { requireActiveUser } from "../../../lib/access";

export async function GET(request: Request) {
  const { session, response } = await requireActiveUser(request);
  if (response) return response;
  if (!session) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
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
    .leftJoin(appointments, eq(consultations.appointmentId, appointments.id))
    .where(or(
      eq(patients.userId, session.id),
      eq(appointments.requestedBy, session.id),
    ))
    .orderBy(desc(consultations.consultationDate));
  return NextResponse.json(history);
}
