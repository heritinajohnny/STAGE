import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "../../../../db";
import { appointments, consultations, doctors } from "../../../../db/schema";
import { requireAdmin } from "../../../../lib/access";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { response } = requireAdmin(request);
  if (response) return response;
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id < 1) {
    return NextResponse.json({ error: "Patient invalide." }, { status: 400 });
  }

  const [appointmentHistory, consultationHistory] = await Promise.all([
    db.select({
      id: appointments.id,
      appointmentDate: appointments.appointmentDate,
      status: appointments.status,
      reason: appointments.reason,
      doctorName: doctors.lastName,
      doctorFirstName: doctors.firstName,
      specialty: doctors.specialty,
    }).from(appointments)
      .innerJoin(doctors, eq(appointments.doctorId, doctors.id))
      .where(eq(appointments.patientId, id))
      .orderBy(desc(appointments.appointmentDate)),
    db.select({
      id: consultations.id,
      consultationDate: consultations.consultationDate,
      diagnosis: consultations.diagnosis,
      prescription: consultations.prescription,
      notes: consultations.notes,
      doctorName: doctors.lastName,
      doctorFirstName: doctors.firstName,
      specialty: doctors.specialty,
    }).from(consultations)
      .innerJoin(doctors, eq(consultations.doctorId, doctors.id))
      .where(eq(consultations.patientId, id))
      .orderBy(desc(consultations.consultationDate)),
  ]);
  return NextResponse.json({ appointments: appointmentHistory, consultations: consultationHistory });
}
