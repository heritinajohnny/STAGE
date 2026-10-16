import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "../../../../db";
import { appointments, doctors, notifications } from "../../../../db/schema";
import { getSessionFromRequest } from "../../../../lib/auth";
import { offerWaitlistForFreedSlot } from "../../../../lib/waitlist";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = getSessionFromRequest(request);
  if (!session || session.role !== "user") {
    return NextResponse.json({ error: "Accès réservé aux comptes utilisateurs." }, { status: 403 });
  }

  const { id: idParam } = await params;
  const id = Number(idParam);
  if (!Number.isInteger(id) || id < 1) {
    return NextResponse.json({ error: "Rendez-vous invalide." }, { status: 400 });
  }

  const result = await db.transaction(async (tx) => {
    const [appointment] = await tx
      .select({
        status: appointments.status,
        appointmentDate: appointments.appointmentDate,
        doctorId: appointments.doctorId,
        doctorFirstName: doctors.firstName,
        doctorLastName: doctors.lastName,
      })
      .from(appointments)
      .innerJoin(doctors, eq(appointments.doctorId, doctors.id))
      .where(and(
        eq(appointments.id, id),
        eq(appointments.requestedBy, session.id),
      ))
      .limit(1);

    if (!appointment) return { error: "Rendez-vous introuvable.", status: 404 as const };
    if (
      !["EN_ATTENTE", "CONFIRME"].includes(appointment.status) ||
      appointment.appointmentDate <= new Date()
    ) {
      return { error: "Ce rendez-vous ne peut plus être annulé.", status: 409 as const };
    }

    const [updated] = await tx
      .update(appointments)
      .set({ status: "ANNULE" })
      .where(and(
        eq(appointments.id, id),
        eq(appointments.requestedBy, session.id),
        eq(appointments.status, appointment.status),
      ))
      .returning({ id: appointments.id });
    if (!updated) {
      return { error: "Le rendez-vous a déjà été modifié. Actualisez la page.", status: 409 as const };
    }

    await tx.insert(notifications).values({
      recipientRole: "admin",
      appointmentId: id,
      message: `Un utilisateur a annulé son rendez-vous avec Dr. ${appointment.doctorFirstName} ${appointment.doctorLastName}.`,
    });
    return { id: updated.id };
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  const [appointment] = await db.select({
    doctorId: appointments.doctorId,
    appointmentDate: appointments.appointmentDate,
  }).from(appointments).where(eq(appointments.id, id)).limit(1);
  if (appointment) await offerWaitlistForFreedSlot(appointment.doctorId, appointment.appointmentDate);
  return NextResponse.json(result);
}
