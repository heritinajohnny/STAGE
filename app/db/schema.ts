import {
  pgTable,
  serial,
  varchar,
  text,
  timestamp,
  integer,
  uniqueIndex,
  time,
} from "drizzle-orm/pg-core";

export const users = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 150 }).notNull(),
    firstName: varchar("first_name", { length: 100 }).notNull().default(""),
    lastName: varchar("last_name", { length: 100 }).notNull().default(""),
    birthDate: varchar("birth_date", { length: 10 }).notNull().default(""),
    gender: varchar("gender", { length: 10 }).notNull().default(""),
    phone: varchar("phone", { length: 20 }).notNull().default(""),
    email: varchar("email", { length: 255 }).notNull(),
    passwordHash: text("password_hash").notNull(),
    role: varchar("role", { length: 20 }).default("user").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [uniqueIndex("users_email_unique").on(table.email)],
);

// 1. Table des Médecins
export const doctors = pgTable("doctors", {
  id: serial("id").primaryKey(),
  firstName: varchar("first_name", { length: 100 }).notNull(),
  lastName: varchar("last_name", { length: 100 }).notNull(),
  specialty: varchar("specialty", { length: 100 }).notNull(),
  phone: varchar("phone", { length: 20 }),
  email: varchar("email", { length: 150 }),
  consultationDurationMinutes: integer("consultation_duration_minutes").default(30).notNull(),
  maxPatientsPerSlot: integer("max_patients_per_slot").default(1).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const doctorWorkingHours = pgTable(
  "doctor_working_hours",
  {
    id: serial("id").primaryKey(),
    doctorId: integer("doctor_id").notNull().references(() => doctors.id, { onDelete: "cascade" }),
    dayOfWeek: integer("day_of_week").notNull(),
    startTime: time("start_time").notNull(),
    endTime: time("end_time").notNull(),
  },
  (table) => [uniqueIndex("doctor_working_hours_doctor_day_unique").on(table.doctorId, table.dayOfWeek)],
);

export const doctorUnavailability = pgTable("doctor_unavailability", {
  id: serial("id").primaryKey(),
  doctorId: integer("doctor_id").notNull().references(() => doctors.id, { onDelete: "cascade" }),
  startAt: timestamp("start_at").notNull(),
  endAt: timestamp("end_at").notNull(),
  kind: varchar("kind", { length: 20 }).notNull().default("ABSENCE"),
  reason: text("reason"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 2. Table des Patients
export const patients = pgTable(
  "patients",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
    firstName: varchar("first_name", { length: 100 }).notNull(),
    lastName: varchar("last_name", { length: 100 }).notNull(),
    birthDate: varchar("birth_date", { length: 10 }).notNull(),
    gender: varchar("gender", { length: 10 }).notNull(),
    phone: varchar("phone", { length: 20 }),
    address: text("address"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [uniqueIndex("patients_user_id_unique").on(table.userId)],
);

// 3. Table des Rendez-vous (Gère le statut pour le Dashboard)
export const appointments = pgTable("appointments", {
  id: serial("id").primaryKey(),
  patientId: integer("patient_id")
    .notNull()
    .references(() => patients.id, { onDelete: "cascade" }),
  doctorId: integer("doctor_id")
    .notNull()
    .references(() => doctors.id, { onDelete: "cascade" }),
  appointmentDate: timestamp("appointment_date").notNull(),
  durationMinutes: integer("duration_minutes").default(30).notNull(),
  status: varchar("status", { length: 20 }).default("EN_ATTENTE").notNull(), // 'EN_ATTENTE', 'PRISE_EN_CHARGE', 'TERMINE', 'ANNULE'
  reason: text("reason"),
  requestedBy: integer("requested_by").references(() => users.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  recipientRole: varchar("recipient_role", { length: 20 }).notNull(),
  recipientUserId: integer("recipient_user_id").references(() => users.id, {
    onDelete: "cascade",
  }),
  appointmentId: integer("appointment_id").references(() => appointments.id, {
    onDelete: "cascade",
  }),
  message: text("message").notNull(),
  uniqueKey: varchar("unique_key", { length: 150 }),
  readAt: timestamp("read_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [uniqueIndex("notifications_unique_key_unique").on(table.uniqueKey)]);

export const appointmentWaitlist = pgTable("appointment_waitlist", {
  id: serial("id").primaryKey(),
  patientId: integer("patient_id").notNull().references(() => patients.id, { onDelete: "cascade" }),
  doctorId: integer("doctor_id").references(() => doctors.id, { onDelete: "cascade" }),
  specialty: varchar("specialty", { length: 100 }),
  requestedFrom: timestamp("requested_from").notNull(),
  requestedTo: timestamp("requested_to").notNull(),
  status: varchar("status", { length: 20 }).notNull().default("WAITING"),
  requestedBy: integer("requested_by").references(() => users.id, { onDelete: "set null" }),
  offeredDoctorId: integer("offered_doctor_id").references(() => doctors.id, { onDelete: "set null" }),
  offeredAppointmentDate: timestamp("offered_appointment_date"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 4. Table des Consultations (Pour les rapports PDF)
export const consultations = pgTable("consultations", {
  id: serial("id").primaryKey(),
  appointmentId: integer("appointment_id").references(() => appointments.id, {
    onDelete: "set null",
  }),
  patientId: integer("patient_id")
    .notNull()
    .references(() => patients.id, { onDelete: "cascade" }),
  doctorId: integer("doctor_id")
    .notNull()
    .references(() => doctors.id, { onDelete: "cascade" }),
  diagnosis: text("diagnosis").notNull(),
  prescription: text("prescription"),
  notes: text("notes"),
  consultationDate: timestamp("consultation_date").defaultNow().notNull(),
});
