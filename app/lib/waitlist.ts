import { and, eq, gte, isNull, lte, or } from "drizzle-orm";
import { db } from "../db";
import { appointmentWaitlist, doctors, notifications } from "../db/schema";

export async function offerWaitlistForFreedSlot(doctorId: number, appointmentDate: Date) {
  await db.transaction(async (tx) => {
    const [doctor] = await tx
      .select({ specialty: doctors.specialty, firstName: doctors.firstName, lastName: doctors.lastName })
      .from(doctors)
      .where(eq(doctors.id, doctorId))
      .limit(1);
    if (!doctor) return;

    const candidates = await tx
      .select()
      .from(appointmentWaitlist)
      .where(and(
        eq(appointmentWaitlist.status, "WAITING"),
        lte(appointmentWaitlist.requestedFrom, appointmentDate),
        gte(appointmentWaitlist.requestedTo, appointmentDate),
        or(eq(appointmentWaitlist.doctorId, doctorId), isNull(appointmentWaitlist.doctorId)),
      ))
      .orderBy(appointmentWaitlist.createdAt);

    for (const candidate of candidates) {
      if (!candidate.requestedBy || (candidate.specialty && candidate.specialty !== doctor.specialty)) continue;
      const [updated] = await tx
        .update(appointmentWaitlist)
        .set({ status: "PROPOSED", offeredDoctorId: doctorId, offeredAppointmentDate: appointmentDate })
        .where(and(
          eq(appointmentWaitlist.id, candidate.id),
          eq(appointmentWaitlist.status, "WAITING"),
        ))
        .returning({ id: appointmentWaitlist.id });
      if (!updated) continue;
      await tx.insert(notifications).values({
        recipientRole: "user",
        recipientUserId: candidate.requestedBy,
        message: `Un créneau s’est libéré avec Dr. ${doctor.firstName} ${doctor.lastName} le ${new Intl.DateTimeFormat("fr-FR", {
          dateStyle: "long",
          timeStyle: "short",
        }).format(appointmentDate)}. Consultez votre espace pour répondre à la proposition.`,
      });
      break;
    }
  });
}
