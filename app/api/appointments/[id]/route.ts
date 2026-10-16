import { NextResponse } from "next/server";
import { db } from "../../../db/index";
import { appointments, doctors, doctorUnavailability, doctorWorkingHours, notifications, patients } from "../../../db/schema";
import { and, eq, gt, lt, or, sql } from "drizzle-orm";
import { requireAdmin } from "../../../lib/access";
import { isSlotAvailable, type AvailableDoctor } from "../../../lib/scheduling";
import { offerWaitlistForFreedSlot } from "../../../lib/waitlist";

// PUT : Mettre à jour le statut du RDV (ex: 'PRISE_EN_CHARGE', 'TERMINE')
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { response } = requireAdmin(request);
  if (response) return response;
  try {
    const { id: idParam } = await params;
    const id = parseInt(idParam);
    const body = await request.json();
    const allowedStatuses = ["EN_ATTENTE", "CONFIRME", "PRISE_EN_CHARGE", "TERMINE", "ANNULE"];
    if (
      !Number.isInteger(id) ||
      (body.status && !allowedStatuses.includes(body.status))
    ) {
      return NextResponse.json({ error: "Statut ou rendez-vous invalide." }, { status: 400 });
    }

    const updated = await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT id FROM appointments WHERE id = ${id} FOR UPDATE`);
      const [current] = await tx
        .select({
          requestedBy: appointments.requestedBy,
          patientId: appointments.patientId,
          doctorId: appointments.doctorId,
          id: appointments.id,
          status: appointments.status,
          durationMinutes: appointments.durationMinutes,
          patientName: sql<string>`concat(${patients.firstName}, ' ', ${patients.lastName})`,
          doctorName: sql<string>`concat(${doctors.firstName}, ' ', ${doctors.lastName})`,
          appointmentDate: appointments.appointmentDate,
        })
        .from(appointments)
        .innerJoin(patients, eq(appointments.patientId, patients.id))
        .innerJoin(doctors, eq(appointments.doctorId, doctors.id))
        .where(eq(appointments.id, id))
        .limit(1);
      if (!current) return null;
      const nextStatuses: Record<string, string[]> = {
        EN_ATTENTE: ["CONFIRME", "PRISE_EN_CHARGE", "ANNULE"],
        CONFIRME: ["PRISE_EN_CHARGE", "ANNULE"],
        PRISE_EN_CHARGE: ["TERMINE"],
        TERMINE: [],
        ANNULE: [],
      };
      if (
        body.status &&
        body.status !== current.status &&
        !nextStatuses[current.status]?.includes(body.status)
      ) {
        return { error: "Cette transition de statut n’est pas autorisée.", status: 409 as const };
      }
      if (
        body.appointmentDate &&
        !["EN_ATTENTE", "CONFIRME"].includes(current.status)
      ) {
        return { error: "Seuls les rendez-vous en attente ou confirmés peuvent être déplacés.", status: 409 as const };
      }
      const requestedDate = body.appointmentDate ? new Date(body.appointmentDate) : current.appointmentDate;
      if (body.appointmentDate && Number.isNaN(requestedDate.getTime())) {
        return { error: "Date de rendez-vous invalide.", status: 400 as const };
      }
      if (body.status === "CONFIRME" || body.status === "PRISE_EN_CHARGE" || body.appointmentDate) {
        await tx.execute(sql`SELECT id FROM doctors WHERE id = ${current.doctorId} FOR UPDATE`);
        await tx.execute(sql`SELECT id FROM patients WHERE id = ${current.patientId} FOR UPDATE`);
        const [doctor] = await tx.select().from(doctors).where(eq(doctors.id, current.doctorId)).limit(1);
        const [workingHours, unavailability, doctorAppointments, patientAppointments] = await Promise.all([
          tx.select().from(doctorWorkingHours).where(eq(doctorWorkingHours.doctorId, current.doctorId)),
          tx.select().from(doctorUnavailability).where(and(
            eq(doctorUnavailability.doctorId, current.doctorId),
            gt(doctorUnavailability.endAt, requestedDate),
            lt(doctorUnavailability.startAt, new Date(requestedDate.getTime() + current.durationMinutes * 60_000)),
          )),
          tx.select({
            appointmentDate: appointments.appointmentDate,
            durationMinutes: appointments.durationMinutes,
            status: appointments.status,
          }).from(appointments).where(and(
            eq(appointments.doctorId, current.doctorId),
            sql`${appointments.id} <> ${id}`,
            gt(appointments.appointmentDate, new Date(requestedDate.getTime() - 24 * 60 * 60 * 1000)),
            or(eq(appointments.status, "EN_ATTENTE"), eq(appointments.status, "CONFIRME"), eq(appointments.status, "PRISE_EN_CHARGE")),
          )),
          tx.select({
            appointmentDate: appointments.appointmentDate,
            durationMinutes: appointments.durationMinutes,
            status: appointments.status,
          }).from(appointments).where(and(
            eq(appointments.patientId, current.patientId),
            sql`${appointments.id} <> ${id}`,
            gt(appointments.appointmentDate, new Date(requestedDate.getTime() - 24 * 60 * 60 * 1000)),
            or(eq(appointments.status, "EN_ATTENTE"), eq(appointments.status, "CONFIRME"), eq(appointments.status, "PRISE_EN_CHARGE")),
          )),
        ]);
        if (!doctor) return { error: "Médecin introuvable.", status: 404 as const };
        const schedulableDoctor: AvailableDoctor = {
          ...doctor,
          workingHours,
          appointments: doctorAppointments,
          unavailability: unavailability.map(({ startAt, endAt }) => ({ startAt, endAt })),
        };
        if (!isSlotAvailable(schedulableDoctor, requestedDate, patientAppointments)) {
          return { error: "Ce créneau n’est plus disponible ou ne respecte pas les horaires du médecin." };
        }
      }

      const [appointment] = await tx
        .update(appointments)
        .set({
          ...(body.status && { status: body.status }),
          ...(typeof body.reason === "string" && { reason: body.reason }),
          ...(body.appointmentDate && { appointmentDate: new Date(body.appointmentDate) }),
        })
        .where(eq(appointments.id, id))
        .returning();

      const isNewDecision =
        (body.status === "ANNULE" && current.status !== "ANNULE") ||
        (body.status === "CONFIRME" && current.status !== "CONFIRME");
      const isRescheduled = Boolean(body.appointmentDate) &&
        requestedDate.getTime() !== current.appointmentDate.getTime();
      if ((isNewDecision || isRescheduled) && current.requestedBy) {
        const formattedDate = new Intl.DateTimeFormat("fr-FR", {
          dateStyle: "long",
          timeStyle: "short",
        }).format(requestedDate);
        const decisionMessage = isRescheduled
          ? `Votre rendez-vous avec ${current.doctorName} a été déplacé au ${formattedDate}.`
          : body.status === "ANNULE"
            ? `Votre rendez-vous avec ${current.doctorName} du ${formattedDate} a été annulé.`
            : `Votre rendez-vous avec ${current.doctorName} du ${formattedDate} a été confirmé.`;
        await tx.insert(notifications).values({
          recipientRole: "user",
          recipientUserId: current.requestedBy,
          appointmentId: id,
          message: decisionMessage,
        });
      }
      return {
        appointment,
        cancellationIsNew: body.status === "ANNULE" && current.status !== "ANNULE",
      };
    });

    if (updated && "error" in updated) {
      return NextResponse.json({ error: updated.error }, { status: updated.status });
    }
    if (!updated) return NextResponse.json({ error: "Rendez-vous introuvable." }, { status: 404 });
    if (updated.cancellationIsNew) {
      await offerWaitlistForFreedSlot(updated.appointment.doctorId, updated.appointment.appointmentDate);
    }
    return NextResponse.json(updated.appointment);
  } catch (error) {
    console.error('Erreur changement de statut/rendez-vous :', error);
    return NextResponse.json(
      { error: 'Erreur lors de la mise à jour du rendez-vous' },
      { status: 500 }
    );
  }
}