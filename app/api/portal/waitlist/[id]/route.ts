import { and, eq, gt, or } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "../../../../db";
import { appointmentWaitlist, appointments, doctors, doctorUnavailability, doctorWorkingHours, notifications } from "../../../../db/schema";
import { requireActiveUser } from "../../../../lib/access";
import { isSlotAvailable, type AvailableDoctor } from "../../../../lib/scheduling";
import { sql } from "drizzle-orm";
import { offerWaitlistForFreedSlot } from "../../../../lib/waitlist";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, response } = await requireActiveUser(request);
  if (response) return response;
  if (!session) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id < 1) return NextResponse.json({ error: "Inscription invalide." }, { status: 400 });

  const result = await db.transaction(async (tx) => {
    const [entry] = await tx.select().from(appointmentWaitlist).where(and(
      eq(appointmentWaitlist.id, id),
      eq(appointmentWaitlist.requestedBy, session.id),
      eq(appointmentWaitlist.status, "PROPOSED"),
    )).limit(1);
    if (!entry?.offeredDoctorId || !entry.offeredAppointmentDate) {
      return { error: "Cette inscription ne contient plus de proposition active.", status: 409 };
    }
    const doctorId = entry.offeredDoctorId;
    const appointmentDate = entry.offeredAppointmentDate;
    await tx.execute(sql`SELECT id FROM doctors WHERE id = ${doctorId} FOR UPDATE`);
    await tx.execute(sql`SELECT id FROM patients WHERE id = ${entry.patientId} FOR UPDATE`);
    const [doctor] = await tx.select().from(doctors).where(eq(doctors.id, doctorId)).limit(1);
    if (!doctor || (entry.specialty && entry.specialty !== doctor.specialty)) {
      return { error: "Le médecin proposé n’est plus disponible pour cette demande.", status: 409 };
    }

    const [workingHours, unavailability, doctorAppointments, patientAppointments] = await Promise.all([
      tx.select().from(doctorWorkingHours).where(eq(doctorWorkingHours.doctorId, doctorId)),
      tx.select().from(doctorUnavailability).where(and(
        eq(doctorUnavailability.doctorId, doctorId),
        gt(doctorUnavailability.endAt, appointmentDate),
      )),
      tx.select({
        appointmentDate: appointments.appointmentDate,
        durationMinutes: appointments.durationMinutes,
        status: appointments.status,
      }).from(appointments).where(and(
        eq(appointments.doctorId, doctorId),
        gt(appointments.appointmentDate, new Date(appointmentDate.getTime() - 24 * 60 * 60 * 1000)),
        or(eq(appointments.status, "EN_ATTENTE"), eq(appointments.status, "CONFIRME"), eq(appointments.status, "PRISE_EN_CHARGE")),
      )),
      tx.select({
        appointmentDate: appointments.appointmentDate,
        durationMinutes: appointments.durationMinutes,
        status: appointments.status,
      }).from(appointments).where(and(
        eq(appointments.patientId, entry.patientId),
        gt(appointments.appointmentDate, new Date(appointmentDate.getTime() - 24 * 60 * 60 * 1000)),
        or(eq(appointments.status, "EN_ATTENTE"), eq(appointments.status, "CONFIRME"), eq(appointments.status, "PRISE_EN_CHARGE")),
      )),
    ]);
    const schedulableDoctor: AvailableDoctor = {
      ...doctor,
      workingHours,
      appointments: doctorAppointments,
      unavailability: unavailability.map(({ startAt, endAt }) => ({ startAt, endAt })),
    };
    if (!isSlotAvailable(schedulableDoctor, appointmentDate, patientAppointments)) {
      return { error: "Le créneau proposé vient d’être réservé. Votre demande reste dans la liste d’attente.", status: 409 };
    }

    const [appointment] = await tx.insert(appointments).values({
      patientId: entry.patientId,
      doctorId,
      appointmentDate,
      durationMinutes: doctor.consultationDurationMinutes,
      status: "EN_ATTENTE",
      requestedBy: session.id,
    }).returning({ id: appointments.id });
    await tx.update(appointmentWaitlist)
      .set({ status: "BOOKED" })
      .where(and(
        eq(appointmentWaitlist.id, id),
        eq(appointmentWaitlist.status, "PROPOSED"),
      ));
    await tx.insert(notifications).values({
      recipientRole: "admin",
      appointmentId: appointment.id,
      message: `Un patient a accepté une proposition de la liste d’attente avec Dr. ${doctor.firstName} ${doctor.lastName}.`,
    });
    await tx.insert(notifications).values({
      recipientRole: "user",
      recipientUserId: session.id,
      appointmentId: appointment.id,
      message: `Votre demande de rendez-vous avec Dr. ${doctor.firstName} ${doctor.lastName} a été transmise à la clinique pour confirmation.`,
    });
    return { appointmentId: appointment.id };
  });
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json(result, { status: 201 });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, response } = await requireActiveUser(request);
  if (response) return response;
  if (!session) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
  const id = Number((await params).id);
  const [entry] = await db.select({
    id: appointmentWaitlist.id,
    status: appointmentWaitlist.status,
    offeredDoctorId: appointmentWaitlist.offeredDoctorId,
    offeredAppointmentDate: appointmentWaitlist.offeredAppointmentDate,
  }).from(appointmentWaitlist).where(and(
    eq(appointmentWaitlist.id, id),
    eq(appointmentWaitlist.requestedBy, session.id),
    or(eq(appointmentWaitlist.status, "WAITING"), eq(appointmentWaitlist.status, "PROPOSED")),
  )).limit(1);
  if (!entry) return NextResponse.json({ error: "Inscription active introuvable." }, { status: 404 });
  await db.update(appointmentWaitlist)
    .set({ status: "CANCELLED" })
    .where(and(eq(appointmentWaitlist.id, id), eq(appointmentWaitlist.status, entry.status)));
  if (entry.offeredDoctorId && entry.offeredAppointmentDate) {
    await offerWaitlistForFreedSlot(entry.offeredDoctorId, entry.offeredAppointmentDate);
  }
  return NextResponse.json({ success: true });
}
