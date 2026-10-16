import { and, count, eq, gte, lt, or, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "../../db";
import {
  appointmentWaitlist,
  appointments,
  consultations,
  doctors,
  doctorUnavailability,
  doctorWorkingHours,
  patients,
} from "../../db/schema";
import { requireAdmin } from "../../lib/access";

function startOfWeek(date: Date) {
  const monday = new Date(date);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  return monday;
}

export async function GET(request: Request) {
  const { response } = requireAdmin(request);
  if (response) return response;
  try {
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const tomorrow = new Date(todayStart);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const monthStart = new Date(now.getFullYear(), now.getMonth() - 11, 1);
    const [totalPatients, totalDoctors, totalConsultations, waitingCount, todayCount, groupedStatuses, dailyRows, monthlyRows, specialtyRows, doctorsRows, workingHours, unavailableRows, weekAppointments] = await Promise.all([
      db.select({ count: count() }).from(patients),
      db.select({ count: count() }).from(doctors),
      db.select({ count: count() }).from(consultations),
      db.select({ count: count() }).from(appointmentWaitlist).where(eq(appointmentWaitlist.status, "WAITING")),
      db.select({ count: count() }).from(appointments).where(and(gte(appointments.appointmentDate, todayStart), lt(appointments.appointmentDate, tomorrow))),
      db.select({ status: appointments.status, count: count() }).from(appointments).groupBy(appointments.status),
      db.select({
        day: sql<string>`to_char(date_trunc('day', ${appointments.appointmentDate}), 'YYYY-MM-DD')`,
        total: count(),
      }).from(appointments)
        .where(gte(appointments.appointmentDate, new Date(todayStart.getTime() - 6 * 24 * 60 * 60 * 1000)))
        .groupBy(sql`date_trunc('day', ${appointments.appointmentDate})`),
      db.select({
        month: sql<string>`to_char(date_trunc('month', ${appointments.appointmentDate}), 'YYYY-MM')`,
        total: count(),
      }).from(appointments)
        .where(gte(appointments.appointmentDate, monthStart))
        .groupBy(sql`date_trunc('month', ${appointments.appointmentDate})`),
      db.select({
        specialty: doctors.specialty,
        total: count(),
      }).from(appointments)
        .innerJoin(doctors, eq(appointments.doctorId, doctors.id))
        .groupBy(doctors.specialty),
      db.select().from(doctors),
      db.select().from(doctorWorkingHours),
      db.select().from(doctorUnavailability),
      db.select({
        appointmentDate: appointments.appointmentDate,
        durationMinutes: appointments.durationMinutes,
        status: appointments.status,
        doctorId: appointments.doctorId,
      }).from(appointments).where(and(
        gte(appointments.appointmentDate, startOfWeek(now)),
        lt(appointments.appointmentDate, new Date(startOfWeek(now).getTime() + 7 * 24 * 60 * 60 * 1000)),
        or(eq(appointments.status, "EN_ATTENTE"), eq(appointments.status, "CONFIRME"), eq(appointments.status, "PRISE_EN_CHARGE")),
      )),
    ]);

    const statusCounts: Record<string, number> = {};
    for (const item of groupedStatuses) statusCounts[item.status] = item.count;
    const statusData = [
      { status: "En attente", count: statusCounts.EN_ATTENTE || 0 },
      { status: "Confirmés", count: statusCounts.CONFIRME || 0 },
      { status: "En consultation", count: statusCounts.PRISE_EN_CHARGE || 0 },
      { status: "Terminés", count: statusCounts.TERMINE || 0 },
      { status: "Annulés", count: statusCounts.ANNULE || 0 },
    ];

    const dailyCounts = new Map(dailyRows.map((row) => [row.day, row.total]));
    const activityData = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(todayStart);
      date.setDate(date.getDate() - (6 - index));
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
      return { day: date.toLocaleDateString("fr-FR", { weekday: "short" }), total: dailyCounts.get(key) || 0 };
    });

    const monday = startOfWeek(now);
    const nextMonday = new Date(monday.getTime() + 7 * 24 * 60 * 60 * 1000);
    let availableCapacityMinutes = 0;
    let bookedMinutes = 0;
    for (const doctor of doctorsRows) {
      const rules = workingHours.filter((rule) => rule.doctorId === doctor.id);
      for (let date = new Date(monday); date < nextMonday; date.setDate(date.getDate() + 1)) {
        const rule = rules.find((item) => item.dayOfWeek === date.getDay());
        if (!rule) continue;
        const start = new Date(date);
        const [startHour, startMinute] = rule.startTime.split(":").map(Number);
        start.setHours(startHour, startMinute, 0, 0);
        const end = new Date(date);
        const [endHour, endMinute] = rule.endTime.split(":").map(Number);
        end.setHours(endHour, endMinute, 0, 0);
        let minutes = (end.getTime() - start.getTime()) / 60_000;
        const periods = unavailableRows
          .filter((period) => period.doctorId === doctor.id && period.startAt < end && period.endAt > start)
          .sort((left, right) => left.startAt.getTime() - right.startAt.getTime());
        let blockedUntil = start.getTime();
        for (const period of periods) {
          const periodStart = Math.max(start.getTime(), period.startAt.getTime(), blockedUntil);
          const periodEnd = Math.min(end.getTime(), period.endAt.getTime());
          if (periodEnd > periodStart) minutes -= (periodEnd - periodStart) / 60_000;
          blockedUntil = Math.max(blockedUntil, period.endAt.getTime());
        }
        availableCapacityMinutes += Math.max(0, minutes) * doctor.maxPatientsPerSlot;
      }
      bookedMinutes += weekAppointments
        .filter((appointment) => appointment.doctorId === doctor.id)
        .reduce((total, appointment) => total + appointment.durationMinutes, 0);
    }
    const occupancyRate = availableCapacityMinutes
      ? Math.min(100, Math.round(bookedMinutes / availableCapacityMinutes * 100))
      : 0;
    const monthlyCounts = new Map(monthlyRows.map((row) => [row.month, row.total]));
    const monthlyData = Array.from({ length: 12 }, (_, index) => {
      const date = new Date(now.getFullYear(), now.getMonth() - 11 + index, 1);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      return { month: date.toLocaleDateString("fr-FR", { month: "short", year: "2-digit" }), total: monthlyCounts.get(key) || 0 };
    });

    return NextResponse.json({
      statsSummary: {
        totalPatients: totalPatients[0]?.count || 0,
        totalDoctors: totalDoctors[0]?.count || 0,
        todayAppointments: todayCount[0]?.count || 0,
        confirmedAppointments: statusCounts.CONFIRME || 0,
        pendingAppointments: statusCounts.EN_ATTENTE || 0,
        canceledAppointments: statusCounts.ANNULE || 0,
        totalConsultations: totalConsultations[0]?.count || 0,
        waitingPatients: waitingCount[0]?.count || 0,
        occupancyRate,
      },
      statusData,
      activityData,
      monthlyData,
      specialtyData: specialtyRows,
    });
  } catch (error) {
    console.error("Erreur récupération statistiques clinique:", error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération des données du tableau de bord" },
      { status: 500 },
    );
  }
}
