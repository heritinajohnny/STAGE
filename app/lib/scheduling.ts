export interface WorkingHourRule {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

export interface ScheduledAppointment {
  appointmentDate: Date;
  durationMinutes: number;
  status: string;
}

export interface UnavailablePeriod {
  startAt: Date;
  endAt: Date;
}

export interface AvailableDoctor {
  id: number;
  firstName: string;
  lastName: string;
  specialty: string;
  consultationDurationMinutes: number;
  maxPatientsPerSlot: number;
  workingHours: WorkingHourRule[];
  appointments: ScheduledAppointment[];
  unavailability: UnavailablePeriod[];
}

function timeParts(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return { hours, minutes };
}

export function getAvailableSlots(
  doctors: AvailableDoctor[],
  from: Date,
  to: Date,
): Array<{ doctorId: number; doctorName: string; specialty: string; appointmentDate: string; durationMinutes: number }> {
  const result: Array<{ doctorId: number; doctorName: string; specialty: string; appointmentDate: string; durationMinutes: number }> = [];
  const now = Date.now();

  for (const doctor of doctors) {
    for (let day = new Date(from); day <= to; day.setDate(day.getDate() + 1)) {
      const rules = doctor.workingHours.filter((rule) => rule.dayOfWeek === day.getDay());
      for (const rule of rules) {
        const { hours: startHour, minutes: startMinute } = timeParts(rule.startTime);
        const { hours: endHour, minutes: endMinute } = timeParts(rule.endTime);
        const shiftStart = new Date(day);
        shiftStart.setHours(startHour, startMinute, 0, 0);
        const shiftEnd = new Date(day);
        shiftEnd.setHours(endHour, endMinute, 0, 0);

        for (
          let slotStart = new Date(shiftStart);
          slotStart.getTime() + doctor.consultationDurationMinutes * 60_000 <= shiftEnd.getTime();
          slotStart = new Date(slotStart.getTime() + doctor.consultationDurationMinutes * 60_000)
        ) {
          const slotEnd = new Date(slotStart.getTime() + doctor.consultationDurationMinutes * 60_000);
          if (slotStart.getTime() <= now || slotStart < from || slotStart > to) continue;
          if (doctor.unavailability.some((period) => period.startAt < slotEnd && period.endAt > slotStart)) continue;

          const concurrentAppointments = doctor.appointments.filter((appointment) => {
            if (!["EN_ATTENTE", "CONFIRME", "PRISE_EN_CHARGE"].includes(appointment.status)) return false;
            const appointmentEnd = new Date(
              appointment.appointmentDate.getTime() + appointment.durationMinutes * 60_000,
            );
            return appointment.appointmentDate < slotEnd && appointmentEnd > slotStart;
          }).length;
          if (concurrentAppointments >= doctor.maxPatientsPerSlot) continue;

          result.push({
            doctorId: doctor.id,
            doctorName: `Dr. ${doctor.firstName} ${doctor.lastName}`,
            specialty: doctor.specialty,
            appointmentDate: slotStart.toISOString(),
            durationMinutes: doctor.consultationDurationMinutes,
          });
        }
      }
    }
  }

  return result.sort((left, right) => left.appointmentDate.localeCompare(right.appointmentDate));
}

export function isSlotAvailable(
  doctor: AvailableDoctor,
  appointmentDate: Date,
  patientAppointments: ScheduledAppointment[],
) {
  const duration = doctor.consultationDurationMinutes;
  const endAt = new Date(appointmentDate.getTime() + duration * 60_000);
  if (appointmentDate <= new Date()) return false;

  const workingRule = doctor.workingHours.find((rule) => rule.dayOfWeek === appointmentDate.getDay());
  if (!workingRule) return false;
  const { hours: startHour, minutes: startMinute } = timeParts(workingRule.startTime);
  const { hours: endHour, minutes: endMinute } = timeParts(workingRule.endTime);
  const shiftStart = new Date(appointmentDate);
  shiftStart.setHours(startHour, startMinute, 0, 0);
  const shiftEnd = new Date(appointmentDate);
  shiftEnd.setHours(endHour, endMinute, 0, 0);
  const startOffset = appointmentDate.getTime() - shiftStart.getTime();
  if (startOffset < 0 || startOffset % (duration * 60_000) !== 0 || endAt > shiftEnd) return false;

  if (doctor.unavailability.some((period) => period.startAt < endAt && period.endAt > appointmentDate)) {
    return false;
  }
  const overlappingDoctorAppointments = doctor.appointments.filter((appointment) => {
    if (!["EN_ATTENTE", "CONFIRME", "PRISE_EN_CHARGE"].includes(appointment.status)) return false;
    const existingEnd = new Date(
      appointment.appointmentDate.getTime() + appointment.durationMinutes * 60_000,
    );
    return appointment.appointmentDate < endAt && existingEnd > appointmentDate;
  }).length;
  const overlappingPatientAppointments = patientAppointments.some((appointment) => {
    if (!["EN_ATTENTE", "CONFIRME", "PRISE_EN_CHARGE"].includes(appointment.status)) return false;
    const existingEnd = new Date(
      appointment.appointmentDate.getTime() + appointment.durationMinutes * 60_000,
    );
    return appointment.appointmentDate < endAt && existingEnd > appointmentDate;
  });
  return overlappingDoctorAppointments < doctor.maxPatientsPerSlot && !overlappingPatientAppointments;
}
