import { and, asc, eq, gt, lt, or } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "../../db";
import { appointments, doctors, doctorUnavailability, doctorWorkingHours } from "../../db/schema";
import { getSessionFromRequest } from "../../lib/auth";
import { getAvailableSlots, type AvailableDoctor } from "../../lib/scheduling";

function parseDateBound(value: string | null, endOfDay: boolean) {
  if (!value) return new Date(Number.NaN);
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!dateOnly) return new Date(value);

  const [, year, month, day] = dateOnly;
  const parsed = new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    endOfDay ? 23 : 0,
    endOfDay ? 59 : 0,
    endOfDay ? 59 : 0,
    endOfDay ? 999 : 0,
  );
  if (
    parsed.getFullYear() !== Number(year) ||
    parsed.getMonth() !== Number(month) - 1 ||
    parsed.getDate() !== Number(day)
  ) {
    return new Date(Number.NaN);
  }
  return parsed;
}

export async function GET(request: Request) {
  const session = getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });

  const url = new URL(request.url);
  const fromValue = url.searchParams.get("from");
  const toValue = url.searchParams.get("to");
  const from = parseDateBound(fromValue, false);
  const to = parseDateBound(toValue, true);
  const specialty = url.searchParams.get("specialty")?.trim();
  const doctorIdParam = url.searchParams.get("doctorId");
  const doctorId = doctorIdParam ? Number(doctorIdParam) : null;
  const dateOnlyRange = Boolean(fromValue && toValue && /^\d{4}-\d{2}-\d{2}$/.test(fromValue) && /^\d{4}-\d{2}-\d{2}$/.test(toValue));
  const requestedDays = dateOnlyRange
    ? (Date.parse(`${toValue}T00:00:00Z`) - Date.parse(`${fromValue}T00:00:00Z`)) / 86_400_000 + 1
    : (to.getTime() - from.getTime()) / 86_400_000;
  if (
    Number.isNaN(from.getTime()) ||
    Number.isNaN(to.getTime()) ||
    from >= to ||
    requestedDays > 31 ||
    (doctorId !== null && (!Number.isInteger(doctorId) || doctorId < 1))
  ) {
    return NextResponse.json({ error: "Choisissez une période valide de 31 jours maximum." }, { status: 400 });
  }

  const doctorRows = await db
    .select()
    .from(doctors)
    .where(and(
      specialty ? eq(doctors.specialty, specialty) : undefined,
      doctorId !== null ? eq(doctors.id, doctorId) : undefined,
    ))
    .orderBy(asc(doctors.lastName), asc(doctors.firstName));
  const scheduleRows = await db.select().from(doctorWorkingHours);
  const appointmentRows = await db
    .select({
      doctorId: appointments.doctorId,
      appointmentDate: appointments.appointmentDate,
      durationMinutes: appointments.durationMinutes,
      status: appointments.status,
    })
    .from(appointments)
    .where(and(
      lt(appointments.appointmentDate, to),
      gt(appointments.appointmentDate, new Date(from.getTime() - 24 * 60 * 60 * 1000)),
      or(
        eq(appointments.status, "EN_ATTENTE"),
        eq(appointments.status, "CONFIRME"),
        eq(appointments.status, "PRISE_EN_CHARGE"),
      ),
    ));
  const unavailableRows = await db
    .select()
    .from(doctorUnavailability)
    .where(and(lt(doctorUnavailability.startAt, to), gt(doctorUnavailability.endAt, from)));

  const availableDoctors: AvailableDoctor[] = doctorRows.map((doctor) => ({
    id: doctor.id,
    firstName: doctor.firstName,
    lastName: doctor.lastName,
    specialty: doctor.specialty,
    consultationDurationMinutes: doctor.consultationDurationMinutes,
    maxPatientsPerSlot: doctor.maxPatientsPerSlot,
    workingHours: scheduleRows.filter((rule) => rule.doctorId === doctor.id),
    appointments: appointmentRows
      .filter((appointment) => appointment.doctorId === doctor.id)
      .map((appointment) => ({
        appointmentDate: appointment.appointmentDate,
        durationMinutes: appointment.durationMinutes,
        status: appointment.status,
      })),
    unavailability: unavailableRows
      .filter((period) => period.doctorId === doctor.id)
      .map((period) => ({ startAt: period.startAt, endAt: period.endAt })),
  }));

  return NextResponse.json(getAvailableSlots(availableDoctors, from, to));
}
