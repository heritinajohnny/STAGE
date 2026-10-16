import { NextResponse } from "next/server";
import { and, eq, gt, or, sql } from "drizzle-orm";
import { db } from "../../db";
import { appointments, doctors, doctorUnavailability, doctorWorkingHours, notifications, patients } from "../../db/schema";
import { requireAdmin } from "../../lib/access";
import { isSlotAvailable, type AvailableDoctor } from "../../lib/scheduling";

// GET : Liste des rendez-vous avec jointure (Noms du patient et du médecin)
export async function GET(request: Request) {
  const { response } = requireAdmin(request);
  if (response) return response;
  try {
    const data = await db
      .select({
        id: appointments.id,
        doctorId: appointments.doctorId,
        requestedBy: appointments.requestedBy,
        appointmentDate: appointments.appointmentDate,
        status: appointments.status,
        reason: appointments.reason,
        patientName: sql<string>`concat(${patients.firstName}, ' ', ${patients.lastName})`,
        doctorName: sql<string>`concat(${doctors.firstName}, ' ', ${doctors.lastName})`,
      })
      .from(appointments)
      .innerJoin(patients, eq(appointments.patientId, patients.id))
      .innerJoin(doctors, eq(appointments.doctorId, doctors.id));

    return NextResponse.json(data);
  } catch (error) {
    console.error("Erreur récupération rendez-vous:", error);
    return NextResponse.json(
      { error: "Erreur récupération rendez-vous" },
      { status: 500 },
    );
  }
}

// POST : Créer un rendez-vous
export async function POST(request: Request) {
  const { response } = requireAdmin(request);
  if (response) return response;
  try {
    const body = await request.json();
    const patientId = Number(body.patientId);
    const doctorId = Number(body.doctorId);
    const appointmentDate = typeof body.appointmentDate === "string"
      ? new Date(body.appointmentDate)
      : new Date(Number.NaN);
    if (
      !Number.isInteger(patientId) ||
      !Number.isInteger(doctorId) ||
      Number.isNaN(appointmentDate.getTime()) ||
      appointmentDate <= new Date()
    ) {
      return NextResponse.json({ error: "Vérifiez le patient, le médecin et le créneau demandé." }, { status: 400 });
    }

    const created = await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT id FROM doctors WHERE id = ${doctorId} FOR UPDATE`);
      await tx.execute(sql`SELECT id FROM patients WHERE id = ${patientId} FOR UPDATE`);
      const [doctor] = await tx.select().from(doctors).where(eq(doctors.id, doctorId)).limit(1);
      const [patient] = await tx.select({ id: patients.id, userId: patients.userId }).from(patients).where(eq(patients.id, patientId)).limit(1);
      if (!doctor || !patient) return { error: "Patient ou médecin introuvable." as const };

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
          eq(appointments.patientId, patientId),
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
        return { error: "Ce créneau n’est plus disponible ou ne respecte pas les horaires du médecin." as const };
      }
      const [appointment] = await tx.insert(appointments).values({
        patientId,
        doctorId,
        appointmentDate,
        durationMinutes: doctor.consultationDurationMinutes,
        reason: typeof body.reason === "string" ? body.reason.trim().slice(0, 1000) || null : null,
        status: "CONFIRME",
        requestedBy: patient.userId,
      }).returning();
      if (patient.userId) {
        await tx.insert(notifications).values({
          recipientRole: "user",
          recipientUserId: patient.userId,
          appointmentId: appointment.id,
          message: `Votre rendez-vous avec Dr. ${doctor.firstName} ${doctor.lastName} est confirmé pour le ${new Intl.DateTimeFormat("fr-FR", {
            dateStyle: "long",
            timeStyle: "short",
          }).format(appointmentDate)}.`,
        });
      }
      return { appointment };
    });

    if ("error" in created) return NextResponse.json({ error: created.error }, { status: 409 });
    return NextResponse.json(created.appointment, { status: 201 });
  } catch (error) {
    console.error("Erreur lors de la création du rendez-vous:", error);
    return NextResponse.json(
      { error: "Erreur lors de la réservation" },
      { status: 500 },
    );
  }
}
