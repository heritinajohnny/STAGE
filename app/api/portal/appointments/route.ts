import { and, asc, eq, gt, isNull, lt, or, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "../../../db";
import { appointments, doctors, doctorUnavailability, doctorWorkingHours, notifications, patients, users } from "../../../db/schema";
import { requireActiveUser } from "../../../lib/access";
import { isSlotAvailable, type AvailableDoctor } from "../../../lib/scheduling";

const activeStatuses = ["EN_ATTENTE", "CONFIRME", "PRISE_EN_CHARGE"] as const;

export async function GET(request: Request) {
  const { session, response } = await requireActiveUser(request);
  if (response) return response;
  if (!session) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });

  const items = await db
    .select({
      id: appointments.id,
      appointmentDate: appointments.appointmentDate,
      status: appointments.status,
      reason: appointments.reason,
      doctorName: doctors.lastName,
      doctorFirstName: doctors.firstName,
    })
    .from(appointments)
    .innerJoin(doctors, eq(appointments.doctorId, doctors.id))
    .where(eq(appointments.requestedBy, session.id))
    .orderBy(asc(appointments.appointmentDate));
  return NextResponse.json(items);
}

export async function POST(request: Request) {
  const { session, response } = await requireActiveUser(request);
  if (response) return response;
  if (!session) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });

  const body = await request.json().catch(() => null) as {
    appointmentDate?: unknown;
    doctorId?: unknown;
    patientFirstName?: unknown;
    patientLastName?: unknown;
    patientFullName?: unknown;
    patientBirthDate?: unknown;
    reason?: unknown;
  } | null;
  const doctorId = Number(body?.doctorId);
  const appointmentDate = typeof body?.appointmentDate === "string"
    ? new Date(body.appointmentDate)
    : new Date(Number.NaN);
  const patientFirstName = typeof body?.patientFirstName === "string" ? body.patientFirstName.trim() : "";
  const patientLastName = typeof body?.patientLastName === "string" ? body.patientLastName.trim() : "";
  const patientFullName = typeof body?.patientFullName === "string" ? body.patientFullName.trim().replace(/\s+/g, " ") : "";
  const patientBirthDate = typeof body?.patientBirthDate === "string" ? body.patientBirthDate : "";
  const reason = typeof body?.reason === "string" ? body.reason.trim() : "";
  const parsedBirthDate = /^\d{4}-\d{2}-\d{2}$/.test(patientBirthDate)
    ? new Date(`${patientBirthDate}T00:00:00.000Z`)
    : null;

  if (
    typeof body?.appointmentDate !== "string" ||
    !Number.isInteger(doctorId) ||
    doctorId < 1 ||
    Number.isNaN(appointmentDate.getTime()) ||
    appointmentDate <= new Date() ||
    patientFirstName.length < 2 ||
    patientFirstName.length > 100 ||
    patientLastName.length < 2 ||
    patientLastName.length > 100 ||
    patientFullName.length < 5 ||
    patientFullName.length > 201 ||
    patientFullName.toLocaleLowerCase("fr") !== `${patientFirstName} ${patientLastName}`.replace(/\s+/g, " ").toLocaleLowerCase("fr") ||
    !parsedBirthDate ||
    Number.isNaN(parsedBirthDate.getTime()) ||
    parsedBirthDate.toISOString().slice(0, 10) !== patientBirthDate ||
    reason.length > 1000
  ) {
    return NextResponse.json({ error: "Vérifiez le créneau, l’identité du patient et le motif." }, { status: 400 });
  }

  const result = await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT id FROM doctors WHERE id = ${doctorId} FOR UPDATE`);
    const [doctor] = await tx.select().from(doctors).where(eq(doctors.id, doctorId)).limit(1);
    if (!doctor) return { error: "Médecin introuvable.", status: 404 };

    const [user] = await tx
      .select({
        firstName: users.firstName,
        lastName: users.lastName,
        birthDate: users.birthDate,
        gender: users.gender,
        phone: users.phone,
        address: users.address,
      })
      .from(users)
      .where(eq(users.id, session.id))
      .limit(1);
    if (!user) return { error: "Compte utilisateur introuvable.", status: 404 };

    const isAccountPatient =
      `${user.firstName} ${user.lastName}`.trim().replace(/\s+/g, " ").toLocaleLowerCase("fr") === patientFullName.toLocaleLowerCase("fr") &&
      user.birthDate === patientBirthDate;
    let patientId: number;
    let patientName: string;

    if (isAccountPatient) {
      if (user.firstName.length < 2 || user.lastName.length < 2 || !user.gender || user.phone.length < 6) {
        return { error: "Complétez votre profil avant de réserver pour vous-même.", status: 400 };
      }
      const [existingPatient] = await tx
        .select({ id: patients.id })
        .from(patients)
        .where(and(
          eq(patients.firstName, user.firstName),
          eq(patients.lastName, user.lastName),
          eq(patients.birthDate, user.birthDate),
          or(eq(patients.userId, session.id), isNull(patients.userId)),
        ))
        .limit(1);
      patientId = existingPatient?.id ?? (await tx
        .insert(patients)
        .values({ ...user, userId: session.id })
        .returning({ id: patients.id }))[0].id;
      if (existingPatient) {
        await tx.update(patients)
          .set({ userId: session.id })
          .where(and(eq(patients.id, patientId), isNull(patients.userId)));
      }
      patientName = `${user.firstName} ${user.lastName}`;
    } else {
      const matchingPatients = await tx
        .select({ id: patients.id, firstName: patients.firstName, lastName: patients.lastName })
        .from(patients)
        .where(and(
          sql`lower(trim(${patients.firstName} || ' ' || ${patients.lastName})) = lower(trim(${patientFullName}))`,
          eq(patients.birthDate, patientBirthDate),
        ))
        .limit(2);
      if (matchingPatients.length > 1) {
        return { error: "Plusieurs dossiers correspondent. Veuillez contacter l’accueil pour éviter une erreur.", status: 409 };
      }
      if (matchingPatients.length === 1) {
        patientId = matchingPatients[0].id;
        patientName = `${matchingPatients[0].firstName} ${matchingPatients[0].lastName}`;
      } else {
        const [newPatient] = await tx
          .insert(patients)
          .values({
            firstName: patientFirstName,
            lastName: patientLastName,
            birthDate: patientBirthDate,
            gender: "AUTRE",
            phone: null,
            address: null,
          })
          .returning({ id: patients.id });
        patientId = newPatient.id;
        patientName = patientFullName;
      }
    }

    await tx.execute(sql`SELECT id FROM patients WHERE id = ${patientId} FOR UPDATE`);
    const durationMinutes = doctor.consultationDurationMinutes;
    const [workingHours, unavailability, doctorAppointments, patientAppointments] = await Promise.all([
      tx.select().from(doctorWorkingHours).where(eq(doctorWorkingHours.doctorId, doctorId)),
      tx.select().from(doctorUnavailability).where(and(
        eq(doctorUnavailability.doctorId, doctorId),
        gt(doctorUnavailability.endAt, appointmentDate),
        lt(doctorUnavailability.startAt, new Date(appointmentDate.getTime() + durationMinutes * 60_000)),
      )),
      tx.select({
        appointmentDate: appointments.appointmentDate,
        durationMinutes: appointments.durationMinutes,
        status: appointments.status,
      }).from(appointments).where(and(
        eq(appointments.doctorId, doctorId),
        gt(appointments.appointmentDate, new Date(appointmentDate.getTime() - 24 * 60 * 60 * 1000)),
        or(...activeStatuses.map((status) => eq(appointments.status, status))),
      )),
      tx.select({
        appointmentDate: appointments.appointmentDate,
        durationMinutes: appointments.durationMinutes,
        status: appointments.status,
      }).from(appointments).where(and(
        eq(appointments.patientId, patientId),
        gt(appointments.appointmentDate, new Date(appointmentDate.getTime() - 24 * 60 * 60 * 1000)),
        or(...activeStatuses.map((status) => eq(appointments.status, status))),
      )),
    ]);
    const schedulableDoctor: AvailableDoctor = {
      ...doctor,
      workingHours,
      appointments: doctorAppointments,
      unavailability: unavailability.map(({ startAt, endAt }) => ({ startAt, endAt })),
    };
    if (!isSlotAvailable(schedulableDoctor, appointmentDate, patientAppointments)) {
      return { error: "Ce créneau vient d’être réservé ou n’est plus disponible. Recommencez la recherche.", status: 409 };
    }

    const [appointment] = await tx
      .insert(appointments)
      .values({
        patientId,
        doctorId: doctor.id,
        appointmentDate,
        durationMinutes,
        status: "EN_ATTENTE",
        reason: reason || null,
        requestedBy: session.id,
      })
      .returning({ id: appointments.id });

    await tx.insert(notifications).values({
      recipientRole: "admin",
      message: `${patientName} demande un rendez-vous avec Dr. ${doctor.firstName} ${doctor.lastName}.`,
      appointmentId: appointment.id,
    });
    await tx.insert(notifications).values({
      recipientRole: "user",
      recipientUserId: session.id,
      appointmentId: appointment.id,
      message: `La demande de rendez-vous pour ${patientName} avec Dr. ${doctor.firstName} ${doctor.lastName} a bien été reçue et attend la confirmation de la clinique.`,
    });

    return { appointment };
  });

  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json(result.appointment, { status: 201 });
}
