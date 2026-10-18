import { and, asc, eq, isNull, or } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "../../../db";
import { appointmentWaitlist, doctors, notifications, patients, users } from "../../../db/schema";
import { requireActiveUser } from "../../../lib/access";

export async function GET(request: Request) {
  const { session, response } = await requireActiveUser(request);
  if (response) return response;
  if (!session) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
  const rows = await db.select({
    id: appointmentWaitlist.id,
    doctorId: appointmentWaitlist.doctorId,
    specialty: appointmentWaitlist.specialty,
    requestedFrom: appointmentWaitlist.requestedFrom,
    requestedTo: appointmentWaitlist.requestedTo,
    status: appointmentWaitlist.status,
    offeredDoctorId: appointmentWaitlist.offeredDoctorId,
    offeredAppointmentDate: appointmentWaitlist.offeredAppointmentDate,
    createdAt: appointmentWaitlist.createdAt,
    doctorFirstName: doctors.firstName,
    doctorLastName: doctors.lastName,
  }).from(appointmentWaitlist)
    .leftJoin(doctors, eq(appointmentWaitlist.doctorId, doctors.id))
    .where(eq(appointmentWaitlist.requestedBy, session.id))
    .orderBy(asc(appointmentWaitlist.createdAt));
  const waitingRows = await db.select({
    doctorId: appointmentWaitlist.doctorId,
    specialty: appointmentWaitlist.specialty,
    createdAt: appointmentWaitlist.createdAt,
  }).from(appointmentWaitlist)
    .where(eq(appointmentWaitlist.status, "WAITING"));
  return NextResponse.json(rows.map((row) => ({
    ...row,
    position: row.status === "WAITING"
      ? waitingRows.filter((candidate) =>
          candidate.createdAt <= row.createdAt &&
          (
            candidate.doctorId === row.doctorId ||
            candidate.specialty === row.specialty ||
            candidate.doctorId === null ||
            row.doctorId === null
          )
        ).length
      : null,
  })));
}

export async function POST(request: Request) {
  const { session, response } = await requireActiveUser(request);
  if (response) return response;
  if (!session) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
  const body = (await request.json().catch(() => null)) as {
    doctorId?: unknown;
    specialty?: unknown;
    requestedFrom?: unknown;
    requestedTo?: unknown;
  } | null;
  const from = typeof body?.requestedFrom === "string" ? new Date(body.requestedFrom) : new Date(Number.NaN);
  const to = typeof body?.requestedTo === "string" ? new Date(body.requestedTo) : new Date(Number.NaN);
  const now = new Date();
  const requestedFrom = !Number.isNaN(from.getTime()) && from < now ? now : from;
  const doctorId = body?.doctorId ? Number(body.doctorId) : null;
  const specialty = typeof body?.specialty === "string" ? body.specialty.trim() : "";
  if (
    Number.isNaN(from.getTime()) ||
    Number.isNaN(to.getTime()) ||
    to <= now ||
    requestedFrom >= to ||
    to.getTime() - from.getTime() > 90 * 24 * 60 * 60 * 1000 ||
    (doctorId !== null && !Number.isInteger(doctorId))
  ) {
    return NextResponse.json({ error: "Choisissez une période future valide." }, { status: 400 });
  }
  const [user] = await db.select({
    firstName: users.firstName,
    lastName: users.lastName,
    birthDate: users.birthDate,
    gender: users.gender,
    phone: users.phone,
  }).from(users).where(eq(users.id, session.id)).limit(1);
  if (!user?.firstName || !user.lastName || !user.birthDate || !user.gender || user.phone.length < 6) {
    return NextResponse.json({ error: "Complétez d’abord votre profil." }, { status: 400 });
  }
  if (doctorId) {
    const [doctor] = await db.select({ id: doctors.id }).from(doctors).where(eq(doctors.id, doctorId)).limit(1);
    if (!doctor) return NextResponse.json({ error: "Médecin introuvable." }, { status: 404 });
  }
  const [existingPatient] = await db.select({ id: patients.id }).from(patients).where(and(
    eq(patients.firstName, user.firstName),
    eq(patients.lastName, user.lastName),
    eq(patients.birthDate, user.birthDate),
    eq(patients.phone, user.phone),
    or(eq(patients.userId, session.id), isNull(patients.userId)),
  )).limit(1);
  const patientId = existingPatient?.id ?? (await db.insert(patients).values({ ...user, userId: session.id }).returning({ id: patients.id }))[0].id;
  if (existingPatient) {
    await db.update(patients)
      .set({ userId: session.id })
      .where(and(eq(patients.id, patientId), isNull(patients.userId)));
  }
  const activeEntries = await db.select({
    doctorId: appointmentWaitlist.doctorId,
    specialty: appointmentWaitlist.specialty,
    requestedFrom: appointmentWaitlist.requestedFrom,
    requestedTo: appointmentWaitlist.requestedTo,
  }).from(appointmentWaitlist).where(and(
    eq(appointmentWaitlist.requestedBy, session.id),
    or(eq(appointmentWaitlist.status, "WAITING"), eq(appointmentWaitlist.status, "PROPOSED")),
  ));
  if (activeEntries.some((entry) =>
    entry.doctorId === doctorId &&
    entry.specialty === (doctorId ? null : specialty || null) &&
    entry.requestedFrom.getTime() === requestedFrom.getTime() &&
    entry.requestedTo.getTime() === to.getTime()
  )) {
    return NextResponse.json({ error: "Cette période est déjà inscrite sur votre liste d’attente." }, { status: 409 });
  }
  const [entry] = await db.insert(appointmentWaitlist).values({
    patientId,
    doctorId,
    specialty: doctorId ? null : specialty,
    requestedFrom,
    requestedTo: to,
    requestedBy: session.id,
  }).returning();
  await db.insert(notifications).values({
    recipientRole: "admin",
    message: `Un patient s’est inscrit sur la liste d’attente${specialty ? ` pour ${specialty}` : ""}.`,
  });
  return NextResponse.json(entry, { status: 201 });
}
