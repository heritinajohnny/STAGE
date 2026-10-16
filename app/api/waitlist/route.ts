import { asc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "../../db";
import { appointmentWaitlist, doctors, patients } from "../../db/schema";
import { requireAdmin } from "../../lib/access";

export async function GET(request: Request) {
  const { response } = requireAdmin(request);
  if (response) return response;
  const entries = await db.select({
    id: appointmentWaitlist.id,
    patientId: appointmentWaitlist.patientId,
    firstName: patients.firstName,
    lastName: patients.lastName,
    phone: patients.phone,
    doctorId: appointmentWaitlist.doctorId,
    specialty: appointmentWaitlist.specialty,
    requestedFrom: appointmentWaitlist.requestedFrom,
    requestedTo: appointmentWaitlist.requestedTo,
    status: appointmentWaitlist.status,
    offeredAppointmentDate: appointmentWaitlist.offeredAppointmentDate,
    createdAt: appointmentWaitlist.createdAt,
    doctorFirstName: doctors.firstName,
    doctorLastName: doctors.lastName,
  }).from(appointmentWaitlist)
    .innerJoin(patients, eq(appointmentWaitlist.patientId, patients.id))
    .leftJoin(doctors, eq(appointmentWaitlist.doctorId, doctors.id))
    .orderBy(asc(appointmentWaitlist.createdAt));
  let waitingPosition = 0;
  return NextResponse.json(entries.map((entry) => ({
    ...entry,
    position: entry.status === "WAITING" ? ++waitingPosition : null,
  })));
}
