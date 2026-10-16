import { and, eq, gt, lte, isNotNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "../../db";
import { appointments, doctors, notifications } from "../../db/schema";

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Accès non autorisé." }, { status: 401 });
  }

  const now = new Date();
  const windows = [48, 24].map((hours) => ({
    hours,
    start: new Date(now.getTime() + (hours - 1) * 60 * 60 * 1000),
    end: new Date(now.getTime() + hours * 60 * 60 * 1000),
  }));
  let created = 0;
  for (const window of windows) {
    const upcoming = await db.select({
      id: appointments.id,
      requestedBy: appointments.requestedBy,
      appointmentDate: appointments.appointmentDate,
      doctorFirstName: doctors.firstName,
      doctorLastName: doctors.lastName,
    }).from(appointments)
      .innerJoin(doctors, eq(appointments.doctorId, doctors.id))
      .where(and(
        eq(appointments.status, "CONFIRME"),
        gt(appointments.appointmentDate, window.start),
        lte(appointments.appointmentDate, window.end),
        isNotNull(appointments.requestedBy),
      ));

    for (const appointment of upcoming) {
      if (!appointment.requestedBy) continue;
      const [inserted] = await db.insert(notifications).values({
        recipientRole: "user",
        recipientUserId: appointment.requestedBy,
        appointmentId: appointment.id,
        uniqueKey: `appointment-${appointment.id}-reminder-${window.hours}`,
        message: `Rappel : votre rendez-vous avec Dr. ${appointment.doctorFirstName} ${appointment.doctorLastName} est prévu le ${new Intl.DateTimeFormat("fr-FR", {
          dateStyle: "long",
          timeStyle: "short",
        }).format(appointment.appointmentDate)} (dans ${window.hours} heures).`,
      }).onConflictDoNothing({ target: notifications.uniqueKey }).returning({ id: notifications.id });
      if (inserted) created++;
    }
  }
  return NextResponse.json({ notificationsCreated: created });
}
