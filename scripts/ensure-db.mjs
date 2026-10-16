import nextEnv from "@next/env";
import bcrypt from "bcryptjs";
import pg from "pg";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL doit être défini avant le démarrage.");
}

const isProductionStart =
  process.env.NODE_ENV === "production" ||
  process.env.npm_lifecycle_event === "prestart";

if (
  isProductionStart &&
  (!process.env.ADMIN_EMAIL ||
    !process.env.ADMIN_PASSWORD ||
    !process.env.SESSION_SECRET)
) {
  throw new Error(
    "Définissez ADMIN_EMAIL, ADMIN_PASSWORD et SESSION_SECRET avant un démarrage en production.",
  );
}

const adminEmail = (process.env.ADMIN_EMAIL || "heritinajohnny@gmail.com")
  .trim()
  .toLowerCase();
const adminPassword = process.env.ADMIN_PASSWORD || "123456789";
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const client = await pool.connect();

const tables = [
  `CREATE TABLE IF NOT EXISTS doctors (
    id SERIAL PRIMARY KEY,
    first_name VARCHAR(100) NOT NULL DEFAULT '',
    last_name VARCHAR(100) NOT NULL DEFAULT '',
    specialty VARCHAR(100) NOT NULL DEFAULT '',
    phone VARCHAR(20),
    email VARCHAR(150),
    consultation_duration_minutes INTEGER NOT NULL DEFAULT 30,
    max_patients_per_slot INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS doctor_working_hours (
    id SERIAL PRIMARY KEY,
    doctor_id INTEGER NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
    day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    CONSTRAINT doctor_working_hours_doctor_day_unique UNIQUE (doctor_id, day_of_week),
    CONSTRAINT doctor_working_hours_time_order CHECK (end_time > start_time)
  )`,
  `CREATE TABLE IF NOT EXISTS doctor_unavailability (
    id SERIAL PRIMARY KEY,
    doctor_id INTEGER NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
    start_at TIMESTAMP NOT NULL,
    end_at TIMESTAMP NOT NULL,
    kind VARCHAR(20) NOT NULL DEFAULT 'ABSENCE',
    reason TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT doctor_unavailability_time_order CHECK (end_at > start_at)
  )`,
  `CREATE TABLE IF NOT EXISTS patients (
    id SERIAL PRIMARY KEY,
    first_name VARCHAR(100) NOT NULL DEFAULT '',
    last_name VARCHAR(100) NOT NULL DEFAULT '',
    birth_date VARCHAR(10) NOT NULL DEFAULT '',
    gender VARCHAR(10) NOT NULL DEFAULT '',
    phone VARCHAR(20),
    address TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS appointments (
    id SERIAL PRIMARY KEY,
    patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    doctor_id INTEGER NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
    appointment_date TIMESTAMP NOT NULL,
    duration_minutes INTEGER NOT NULL DEFAULT 30,
    status VARCHAR(20) NOT NULL DEFAULT 'EN_ATTENTE',
    reason TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS consultations (
    id SERIAL PRIMARY KEY,
    appointment_id INTEGER REFERENCES appointments(id) ON DELETE SET NULL,
    patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    doctor_id INTEGER NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
    diagnosis TEXT NOT NULL DEFAULT '',
    prescription TEXT,
    notes TEXT,
    consultation_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    first_name VARCHAR(100) NOT NULL DEFAULT '',
    last_name VARCHAR(100) NOT NULL DEFAULT '',
    birth_date VARCHAR(10) NOT NULL DEFAULT '',
    gender VARCHAR(10) NOT NULL DEFAULT '',
    phone VARCHAR(20) NOT NULL DEFAULT '',
    email VARCHAR(255) NOT NULL,
    password_hash TEXT NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'user',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    recipient_role VARCHAR(20) NOT NULL,
    recipient_user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    appointment_id INTEGER REFERENCES appointments(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    unique_key VARCHAR(150),
    read_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS appointment_waitlist (
    id SERIAL PRIMARY KEY,
    patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    doctor_id INTEGER REFERENCES doctors(id) ON DELETE CASCADE,
    specialty VARCHAR(100),
    requested_from TIMESTAMP NOT NULL,
    requested_to TIMESTAMP NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'WAITING',
    requested_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    offered_doctor_id INTEGER REFERENCES doctors(id) ON DELETE SET NULL,
    offered_appointment_date TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
];

const missingColumns = [
  "ALTER TABLE doctors ADD COLUMN IF NOT EXISTS first_name VARCHAR(100) NOT NULL DEFAULT ''",
  "ALTER TABLE doctors ADD COLUMN IF NOT EXISTS last_name VARCHAR(100) NOT NULL DEFAULT ''",
  "ALTER TABLE doctors ADD COLUMN IF NOT EXISTS specialty VARCHAR(100) NOT NULL DEFAULT ''",
  "ALTER TABLE doctors ADD COLUMN IF NOT EXISTS phone VARCHAR(20)",
  "ALTER TABLE doctors ADD COLUMN IF NOT EXISTS email VARCHAR(150)",
  "ALTER TABLE doctors ADD COLUMN IF NOT EXISTS consultation_duration_minutes INTEGER NOT NULL DEFAULT 30",
  "ALTER TABLE doctors ADD COLUMN IF NOT EXISTS max_patients_per_slot INTEGER NOT NULL DEFAULT 1",
  "ALTER TABLE appointments ADD COLUMN IF NOT EXISTS duration_minutes INTEGER NOT NULL DEFAULT 30",
  "ALTER TABLE doctors ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP",
  "ALTER TABLE patients ADD COLUMN IF NOT EXISTS first_name VARCHAR(100) NOT NULL DEFAULT ''",
  "ALTER TABLE patients ADD COLUMN IF NOT EXISTS last_name VARCHAR(100) NOT NULL DEFAULT ''",
  "ALTER TABLE patients ADD COLUMN IF NOT EXISTS birth_date VARCHAR(10) NOT NULL DEFAULT ''",
  "ALTER TABLE patients ADD COLUMN IF NOT EXISTS gender VARCHAR(10) NOT NULL DEFAULT ''",
  "ALTER TABLE patients ADD COLUMN IF NOT EXISTS phone VARCHAR(20)",
  "ALTER TABLE patients ADD COLUMN IF NOT EXISTS address TEXT",
  "ALTER TABLE patients ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP",
  "ALTER TABLE patients ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE SET NULL",
  "ALTER TABLE appointments ADD COLUMN IF NOT EXISTS patient_id INTEGER",
  "ALTER TABLE appointments ADD COLUMN IF NOT EXISTS doctor_id INTEGER",
  "ALTER TABLE appointments ADD COLUMN IF NOT EXISTS appointment_date TIMESTAMP",
  "ALTER TABLE appointments ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'EN_ATTENTE'",
  "ALTER TABLE appointments ADD COLUMN IF NOT EXISTS reason TEXT",
  "ALTER TABLE appointments ADD COLUMN IF NOT EXISTS requested_by INTEGER",
  "ALTER TABLE appointments ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP",
  `DO $$ BEGIN
     IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'appointments_requested_by_users_id_fk') THEN
       ALTER TABLE appointments ADD CONSTRAINT appointments_requested_by_users_id_fk
         FOREIGN KEY (requested_by) REFERENCES users(id) ON DELETE SET NULL;
     END IF;
   END $$`,
  "ALTER TABLE consultations ADD COLUMN IF NOT EXISTS appointment_id INTEGER",
  "ALTER TABLE consultations ADD COLUMN IF NOT EXISTS patient_id INTEGER",
  "ALTER TABLE consultations ADD COLUMN IF NOT EXISTS doctor_id INTEGER",
  "ALTER TABLE consultations ADD COLUMN IF NOT EXISTS diagnosis TEXT NOT NULL DEFAULT ''",
  "ALTER TABLE consultations ADD COLUMN IF NOT EXISTS prescription TEXT",
  "ALTER TABLE consultations ADD COLUMN IF NOT EXISTS notes TEXT",
  "ALTER TABLE consultations ADD COLUMN IF NOT EXISTS consultation_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP",
  "ALTER TABLE users ADD COLUMN IF NOT EXISTS name VARCHAR(150) NOT NULL DEFAULT ''",
  "ALTER TABLE users ADD COLUMN IF NOT EXISTS first_name VARCHAR(100) NOT NULL DEFAULT ''",
  "ALTER TABLE users ADD COLUMN IF NOT EXISTS last_name VARCHAR(100) NOT NULL DEFAULT ''",
  "ALTER TABLE users ADD COLUMN IF NOT EXISTS birth_date VARCHAR(10) NOT NULL DEFAULT ''",
  "ALTER TABLE users ADD COLUMN IF NOT EXISTS gender VARCHAR(10) NOT NULL DEFAULT ''",
  "ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(20) NOT NULL DEFAULT ''",
  "ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(255) NOT NULL DEFAULT ''",
  "ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT NOT NULL DEFAULT ''",
  "ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) NOT NULL DEFAULT 'user'",
  "ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP",
  "ALTER TABLE notifications ADD COLUMN IF NOT EXISTS recipient_role VARCHAR(20) NOT NULL DEFAULT 'user'",
  "ALTER TABLE notifications ADD COLUMN IF NOT EXISTS recipient_user_id INTEGER",
  "ALTER TABLE notifications ADD COLUMN IF NOT EXISTS appointment_id INTEGER",
  "ALTER TABLE notifications ADD COLUMN IF NOT EXISTS message TEXT NOT NULL DEFAULT ''",
  "ALTER TABLE notifications ADD COLUMN IF NOT EXISTS unique_key VARCHAR(150)",
  "ALTER TABLE appointment_waitlist ADD COLUMN IF NOT EXISTS offered_doctor_id INTEGER REFERENCES doctors(id) ON DELETE SET NULL",
  "ALTER TABLE notifications ADD COLUMN IF NOT EXISTS read_at TIMESTAMP",
  "ALTER TABLE notifications ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP",
  `DO $$ BEGIN
     IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'notifications_recipient_user_id_users_id_fk') THEN
       ALTER TABLE notifications ADD CONSTRAINT notifications_recipient_user_id_users_id_fk
         FOREIGN KEY (recipient_user_id) REFERENCES users(id) ON DELETE CASCADE;
     END IF;
     IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'notifications_appointment_id_appointments_id_fk') THEN
       ALTER TABLE notifications ADD CONSTRAINT notifications_appointment_id_appointments_id_fk
         FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE CASCADE;
     END IF;
   END $$`,
  "CREATE INDEX IF NOT EXISTS notifications_recipient_created_idx ON notifications (recipient_role, recipient_user_id, created_at DESC)",
  "CREATE UNIQUE INDEX IF NOT EXISTS notifications_unique_key_unique ON notifications (unique_key)",
  "CREATE INDEX IF NOT EXISTS appointments_doctor_date_status_idx ON appointments (doctor_id, appointment_date, status)",
  "CREATE INDEX IF NOT EXISTS appointments_patient_date_status_idx ON appointments (patient_id, appointment_date, status)",
  "CREATE INDEX IF NOT EXISTS appointment_waitlist_status_created_idx ON appointment_waitlist (status, created_at)",
  "CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique ON users (email)",
  "CREATE UNIQUE INDEX IF NOT EXISTS patients_user_id_unique ON patients (user_id)",
];

try {
  await client.query("BEGIN");
  for (const statement of tables) await client.query(statement);
  for (const statement of missingColumns) await client.query(statement);

  const passwordHash = await bcrypt.hash(adminPassword, 12);
  await client.query(
    `INSERT INTO users (name, email, password_hash, role)
     VALUES ('Administrateur', $1, $2, 'admin')
     ON CONFLICT (email) DO NOTHING`,
    [adminEmail, passwordHash],
  );
  await client.query("COMMIT");
  console.log("Base de données initialisée; tables et compte administrateur vérifiés.");
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  client.release();
  await pool.end();
}
