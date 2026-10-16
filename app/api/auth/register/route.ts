import { hash } from "bcryptjs";
import { NextResponse } from "next/server";
import { db } from "../../../db";
import { users } from "../../../db/schema";
import { createSessionToken, SESSION_COOKIE } from "../../../lib/auth";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | {
        firstName?: unknown;
        lastName?: unknown;
        birthDate?: unknown;
        gender?: unknown;
        phone?: unknown;
        email?: unknown;
        password?: unknown;
      }
    | null;
  const firstName = typeof body?.firstName === "string" ? body.firstName.trim() : "";
  const lastName = typeof body?.lastName === "string" ? body.lastName.trim() : "";
  const birthDate = typeof body?.birthDate === "string" ? body.birthDate : "";
  const gender = typeof body?.gender === "string" ? body.gender : "";
  const phone = typeof body?.phone === "string" ? body.phone.trim() : "";
  const name = `${firstName} ${lastName}`.trim();
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  if (
    firstName.length < 2 ||
    firstName.length > 100 ||
    lastName.length < 2 ||
    lastName.length > 100 ||
    name.length > 150 ||
    !/^\d{4}-\d{2}-\d{2}$/.test(birthDate) ||
    Number.isNaN(Date.parse(`${birthDate}T00:00:00Z`)) ||
    new Date(`${birthDate}T00:00:00Z`) >= new Date() ||
    !["M", "F", "AUTRE"].includes(gender) ||
    phone.length < 6 ||
    phone.length > 20 ||
    !/^\S+@\S+\.\S+$/.test(email)
  ) {
    return NextResponse.json({ error: "Vérifiez vos informations personnelles et votre adresse e-mail." }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "Le mot de passe doit contenir au moins 8 caractères." }, { status: 400 });
  }

  try {
    const [user] = await db
      .insert(users)
      .values({
        name,
        firstName,
        lastName,
        birthDate,
        gender,
        phone,
        email,
        passwordHash: await hash(password, 12),
        role: "user",
      })
      .returning({ id: users.id, name: users.name, email: users.email, role: users.role });
    const token = createSessionToken({ ...user, role: "user" });
    const response = NextResponse.json({ user, destination: "/portal" }, { status: 201 });
    response.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });
    return response;
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "23505"
    ) {
      return NextResponse.json({ error: "Cette adresse e-mail est déjà utilisée." }, { status: 409 });
    }
    throw error;
  }
}
