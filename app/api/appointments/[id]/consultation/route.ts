import { eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "../../../../db";
import { appointments, consultations, notifications } from "../../../../db/schema";
import { requireAdmin } from "../../../../lib/access";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { response } = requireAdmin(request);
  if (response) return response;

  const id = Number((await params).id);
  const body = await request.json().catch(() => null) as {
    diagnosis?: unknown;
    prescription?: unknown;
    notes?: unknown;
  } | null;
  const diagnosis = typeof body?.diagnosis === "string" ? body.diagnosis.trim() : "";
  const prescription = typeof body?.prescription === "string" ? body.prescription.trim() : "";
  const notes = typeof body?.notes === "string" ? body.notes.trim() : "";

  if (
    !Number.isInteger(id) || id < 1 ||
    diagnosis.length < 1 || diagnosis.length > 4000 ||
    prescription.length > 4000 || notes.length > 4000
  ) {
    return NextResponse.json({ error: "Vérifiez le diagnostic, le traitement et les notes." }, { status: 400 });
  }

  try {
    const result = await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT id FROM appointments WHERE id = ${id} FOR UPDATE`);
      const [appointment] = await tx.select({
        id: appointments.id,
        patientId: appointments.patientId,
        doctorId: appointments.doctorId,
        requestedBy: appointments.requestedBy,
        status: appointments.status,
      }).from(appointments).where(eq(appointments.id, id)).limit(1);
      if (!appointment) return { error: "Rendez-vous introuvable.", status: 404 as const };

      const [existing] = await tx.select()
        .from(consultations)
        .where(eq(consultations.appointmentId, id))
        .limit(1);

      if (existing) {
        if (appointment.status !== "TERMINE") {
          await tx.update(appointments)
            .set({ status: "TERMINE" })
            .where(eq(appointments.id, id));
        }
        return { consultation: existing, alreadyRecorded: true };
      }
      if (appointment.status !== "PRISE_EN_CHARGE") {
        return {
          error: appointment.status === "TERMINE"
            ? "Ce rendez-vous est terminé mais n’a pas d’historique de consultation associé."
            : "Démarrez le rendez-vous avant d’enregistrer la consultation.",
          status: 409 as const,
        };
      }

      const consultationDate = new Date();
      const [consultation] = await tx.insert(consultations).values({
        appointmentId: appointment.id,
        patientId: appointment.patientId,
        doctorId: appointment.doctorId,
        diagnosis,
        prescription: prescription || null,
        notes: notes || null,
        consultationDate,
      }).returning();
      await tx.update(appointments)
        .set({ status: "TERMINE" })
        .where(eq(appointments.id, appointment.id));

      if (appointment.requestedBy) {
        await tx.insert(notifications).values({
          recipientRole: "user",
          recipientUserId: appointment.requestedBy,
          appointmentId: appointment.id,
          message: "Votre consultation est terminée. Son compte rendu est disponible dans votre historique.",
        });
      }

      return { consultation, alreadyRecorded: false };
    });

    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json(result, { status: result.alreadyRecorded ? 200 : 201 });
  } catch (error) {
    console.error("Erreur lors de l’enregistrement de la consultation:", error);
    return NextResponse.json({ error: "Impossible d’enregistrer la consultation." }, { status: 500 });
  }
}
