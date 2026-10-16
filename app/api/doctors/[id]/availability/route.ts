import { and, asc, eq, gt, lt, or, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "../../../../db";
import { appointments, doctorUnavailability, doctorWorkingHours, doctors } from "../../../../db/schema";
import { requireAdmin } from "../../../../lib/access";

const validTime = (value: unknown): value is string =>
  typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);

const activeAppointmentStatuses = or(
  eq(appointments.status, "EN_ATTENTE"),
  eq(appointments.status, "CONFIRME"),
  eq(appointments.status, "PRISE_EN_CHARGE"),
);

function shiftBounds(date: Date, startTime: string, endTime: string) {
  const [startHour, startMinute] = startTime.split(":").map(Number);
  const [endHour, endMinute] = endTime.split(":").map(Number);
  const start = new Date(date);
  start.setHours(startHour, startMinute, 0, 0);
  const end = new Date(date);
  end.setHours(endHour, endMinute, 0, 0);
  return { start, end };
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { response } = requireAdmin(request);
  if (response) return response;
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id < 1) return NextResponse.json({ error: "Médecin invalide." }, { status: 400 });

  const [doctor] = await db.select().from(doctors).where(eq(doctors.id, id)).limit(1);
  if (!doctor) return NextResponse.json({ error: "Médecin introuvable." }, { status: 404 });
  const [workingHours, unavailability] = await Promise.all([
    db.select().from(doctorWorkingHours).where(eq(doctorWorkingHours.doctorId, id)).orderBy(asc(doctorWorkingHours.dayOfWeek)),
    db.select().from(doctorUnavailability).where(eq(doctorUnavailability.doctorId, id)).orderBy(asc(doctorUnavailability.startAt)),
  ]);
  return NextResponse.json({ doctor, workingHours, unavailability });
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { response } = requireAdmin(request);
  if (response) return response;
  const id = Number((await params).id);
  const body = (await request.json().catch(() => null)) as {
    consultationDurationMinutes?: unknown;
    maxPatientsPerSlot?: unknown;
    workingHours?: unknown;
  } | null;
  const rows = Array.isArray(body?.workingHours)
    ? body.workingHours as Array<{ dayOfWeek?: unknown; startTime?: unknown; endTime?: unknown }>
    : null;
  if (
    !Number.isInteger(id) ||
    !Number.isInteger(body?.consultationDurationMinutes) ||
    Number(body?.consultationDurationMinutes) < 5 ||
    Number(body?.consultationDurationMinutes) > 240 ||
    !Number.isInteger(body?.maxPatientsPerSlot) ||
    Number(body?.maxPatientsPerSlot) < 1 ||
    Number(body?.maxPatientsPerSlot) > 20 ||
    !rows ||
    rows.some((row) =>
      !Number.isInteger(row.dayOfWeek) ||
      Number(row.dayOfWeek) < 0 ||
      Number(row.dayOfWeek) > 6 ||
      !validTime(row.startTime) ||
      !validTime(row.endTime) ||
      String(row.startTime) >= String(row.endTime)
    ) ||
    new Set(rows.map((row) => row.dayOfWeek)).size !== rows.length
  ) {
    return NextResponse.json({ error: "Vérifiez les horaires, la durée et la capacité par créneau." }, { status: 400 });
  }

  const normalizedRows = rows.map((row) => ({
    dayOfWeek: Number(row.dayOfWeek),
    startTime: String(row.startTime),
    endTime: String(row.endTime),
  }));
  const result = await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT id FROM doctors WHERE id = ${id} FOR UPDATE`);
    const [doctor] = await tx.select({ id: doctors.id }).from(doctors).where(eq(doctors.id, id)).limit(1);
    if (!doctor) return { error: "Médecin introuvable.", status: 404 as const };

    const [bookings, periods] = await Promise.all([
      tx.select({
        id: appointments.id,
        appointmentDate: appointments.appointmentDate,
        durationMinutes: appointments.durationMinutes,
      }).from(appointments).where(and(
        eq(appointments.doctorId, id),
        gt(appointments.appointmentDate, new Date()),
        activeAppointmentStatuses,
      )),
      tx.select().from(doctorUnavailability).where(eq(doctorUnavailability.doctorId, id)),
    ]);
    const capacity = Number(body?.maxPatientsPerSlot);
    for (const booking of bookings) {
      const rule = normalizedRows.find((item) => item.dayOfWeek === booking.appointmentDate.getDay());
      if (!rule) return { error: "Les nouveaux horaires excluraient un rendez-vous déjà enregistré. Déplacez-le avant de modifier le planning.", status: 409 as const };
      const { start, end } = shiftBounds(booking.appointmentDate, rule.startTime, rule.endTime);
      const bookingEnd = new Date(booking.appointmentDate.getTime() + booking.durationMinutes * 60_000);
      if (
        booking.appointmentDate < start ||
        bookingEnd > end ||
        periods.some((period) => period.startAt < bookingEnd && period.endAt > booking.appointmentDate)
      ) {
        return { error: "Les nouveaux horaires chevauchent un rendez-vous ou une absence déjà enregistrée.", status: 409 as const };
      }
      const concurrent = bookings.filter((other) => {
        if (other.id === booking.id) return false;
        const otherEnd = new Date(other.appointmentDate.getTime() + other.durationMinutes * 60_000);
        return other.appointmentDate < bookingEnd && otherEnd > booking.appointmentDate;
      }).length;
      if (concurrent >= capacity) {
        return { error: "La capacité choisie est inférieure au nombre de rendez-vous déjà programmés sur un créneau.", status: 409 as const };
      }
    }

    await tx.update(doctors).set({
      consultationDurationMinutes: Number(body?.consultationDurationMinutes),
      maxPatientsPerSlot: capacity,
    }).where(eq(doctors.id, id));
    await tx.delete(doctorWorkingHours).where(eq(doctorWorkingHours.doctorId, id));
    if (normalizedRows.length) {
      await tx.insert(doctorWorkingHours).values(normalizedRows.map((row) => ({
        doctorId: id,
        dayOfWeek: row.dayOfWeek,
        startTime: `${row.startTime}:00`,
        endTime: `${row.endTime}:00`,
      })));
    }
    return { success: true as const };
  });
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ success: true });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { response } = requireAdmin(request);
  if (response) return response;
  const id = Number((await params).id);
  const body = (await request.json().catch(() => null)) as {
    startAt?: unknown;
    endAt?: unknown;
    kind?: unknown;
    reason?: unknown;
  } | null;
  const startAt = typeof body?.startAt === "string" ? new Date(body.startAt) : new Date(Number.NaN);
  const endAt = typeof body?.endAt === "string" ? new Date(body.endAt) : new Date(Number.NaN);
  if (
    !Number.isInteger(id) ||
    Number.isNaN(startAt.getTime()) ||
    Number.isNaN(endAt.getTime()) ||
    startAt >= endAt ||
    !["ABSENCE", "BLOCKED"].includes(String(body?.kind))
  ) {
    return NextResponse.json({ error: "Période d’absence ou de blocage invalide." }, { status: 400 });
  }
  const result = await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT id FROM doctors WHERE id = ${id} FOR UPDATE`);
    const [doctor] = await tx.select({ id: doctors.id }).from(doctors).where(eq(doctors.id, id)).limit(1);
    if (!doctor) return { error: "Médecin introuvable.", status: 404 as const };
    const bookings = await tx.select({
      appointmentDate: appointments.appointmentDate,
      durationMinutes: appointments.durationMinutes,
    }).from(appointments).where(and(
      eq(appointments.doctorId, id),
      lt(appointments.appointmentDate, endAt),
      gt(appointments.appointmentDate, new Date(startAt.getTime() - 4 * 60 * 60 * 1000)),
      activeAppointmentStatuses,
    ));
    if (bookings.some((booking) =>
      booking.appointmentDate.getTime() + booking.durationMinutes * 60_000 > startAt.getTime()
    )) {
      return { error: "Cette période chevauche un rendez-vous déjà enregistré. Déplacez-le avant d’ajouter l’absence ou le blocage.", status: 409 as const };
    }
    const [period] = await tx.insert(doctorUnavailability).values({
      doctorId: id,
      startAt,
      endAt,
      kind: String(body?.kind),
      reason: typeof body?.reason === "string" ? body.reason.trim().slice(0, 500) || null : null,
    }).returning();
    return { period };
  });
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json(result.period, { status: 201 });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { response } = requireAdmin(request);
  if (response) return response;
  const id = Number((await params).id);
  const body = (await request.json().catch(() => null)) as { periodId?: unknown } | null;
  const periodId = Number(body?.periodId);
  if (!Number.isInteger(id) || !Number.isInteger(periodId)) {
    return NextResponse.json({ error: "Période invalide." }, { status: 400 });
  }
  const deleted = await db.delete(doctorUnavailability).where(and(
    eq(doctorUnavailability.id, periodId),
    eq(doctorUnavailability.doctorId, id),
  )).returning({ id: doctorUnavailability.id });
  if (!deleted.length) return NextResponse.json({ error: "Période introuvable." }, { status: 404 });
  return NextResponse.json({ success: true });
}
