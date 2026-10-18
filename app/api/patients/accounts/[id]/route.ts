import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "../../../../db";
import { patients, users } from "../../../../db/schema";
import { requireAdmin } from "../../../../lib/access";

function isValidBirthDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value &&
    date < new Date();
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { response } = requireAdmin(request);
  if (response) return response;

  const { id: rawId } = await params;
  const id = Number(rawId);
  const body = await request.json().catch(() => null) as {
    firstName?: unknown;
    lastName?: unknown;
    birthDate?: unknown;
    gender?: unknown;
    phone?: unknown;
    address?: unknown;
    email?: unknown;
    isActive?: unknown;
  } | null;
  if (!Number.isInteger(id) || id < 1 || !body) {
    return NextResponse.json({ error: "Compte patient invalide." }, { status: 400 });
  }

  if (typeof body.isActive === "boolean" && Object.keys(body).length === 1) {
    try {
      const [account] = await db
        .update(users)
        .set({ isActive: body.isActive })
        .where(and(eq(users.id, id), eq(users.role, "user")))
        .returning({ id: users.id, isActive: users.isActive });
      if (!account) return NextResponse.json({ error: "Compte patient introuvable." }, { status: 404 });
      return NextResponse.json(account);
    } catch (error) {
      console.error("Erreur lors de la modification du statut du compte patient:", error);
      return NextResponse.json({ error: "Impossible de modifier le statut du compte." }, { status: 500 });
    }
  }

  const firstName = typeof body.firstName === "string" ? body.firstName.trim() : "";
  const lastName = typeof body.lastName === "string" ? body.lastName.trim() : "";
  const birthDate = typeof body.birthDate === "string" ? body.birthDate : "";
  const gender = typeof body.gender === "string" ? body.gender : "";
  const phone = typeof body.phone === "string" ? body.phone.trim() : "";
  const address = typeof body.address === "string" ? body.address.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";

  if (
    firstName.length < 2 || firstName.length > 100 ||
    lastName.length < 2 || lastName.length > 100 ||
    firstName.length + lastName.length + 1 > 150 ||
    !isValidBirthDate(birthDate) ||
    !["M", "F", "AUTRE"].includes(gender) ||
    phone.length < 6 || phone.length > 20 ||
    address.length > 500 ||
    !/^\S+@\S+\.\S+$/.test(email) || email.length > 255
  ) {
    return NextResponse.json({ error: "Vérifiez toutes les informations du compte patient." }, { status: 400 });
  }

  try {
    const account = await db.transaction(async (tx) => {
      const [updated] = await tx
        .update(users)
        .set({
          firstName,
          lastName,
          name: `${firstName} ${lastName}`,
          birthDate,
          gender,
          phone,
          address,
          email,
        })
        .where(and(eq(users.id, id), eq(users.role, "user")))
        .returning({
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          name: users.name,
          birthDate: users.birthDate,
          gender: users.gender,
          phone: users.phone,
          address: users.address,
          email: users.email,
          isActive: users.isActive,
        });
      if (!updated) return null;
      await tx.update(patients)
        .set({ firstName, lastName, birthDate, gender, phone, address })
        .where(eq(patients.userId, id));
      return updated;
    });
    if (!account) return NextResponse.json({ error: "Compte patient introuvable." }, { status: 404 });
    return NextResponse.json(account);
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "23505") {
      return NextResponse.json({ error: "Cette adresse e-mail est déjà utilisée." }, { status: 409 });
    }
    console.error("Erreur lors de la modification du compte patient:", error);
    return NextResponse.json({ error: "Impossible de modifier le compte patient." }, { status: 500 });
  }
}
