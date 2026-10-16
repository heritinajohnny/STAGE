import { NextResponse } from "next/server";
import { db } from "../../db/index";
import { patients } from "../../db/schema";
import { requireAdmin } from "../../lib/access";

// GET : Récupérer tous les patients
export async function GET(request: Request) {
  const { response } = requireAdmin(request);
  if (response) return response;
  try {
    const data = await db.select().from(patients);
    return NextResponse.json(data);
  } catch (error) {
    console.error("Erreur lors de la récupération des patients:", error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération des patients" },
      { status: 500 },
    );
  }
}

// POST : Enregistrer un nouveau patient
export async function POST(request: Request) {
  const { response } = requireAdmin(request);
  if (response) return response;
  try {
    const body = (await request.json().catch(() => null)) as {
      firstName?: unknown;
      lastName?: unknown;
      birthDate?: unknown;
      gender?: unknown;
      phone?: unknown;
      address?: unknown;
    } | null;
    const firstName = typeof body?.firstName === "string" ? body.firstName.trim() : "";
    const lastName = typeof body?.lastName === "string" ? body.lastName.trim() : "";
    const birthDate = typeof body?.birthDate === "string" ? body.birthDate : "";
    const gender = typeof body?.gender === "string" ? body.gender : "";
    if (
      firstName.length < 2 ||
      lastName.length < 2 ||
      !/^\d{4}-\d{2}-\d{2}$/.test(birthDate) ||
      Number.isNaN(Date.parse(`${birthDate}T00:00:00Z`)) ||
      !["M", "F", "AUTRE"].includes(gender)
    ) {
      return NextResponse.json({ error: "Vérifiez les informations du patient." }, { status: 400 });
    }
    const newPatient = await db
      .insert(patients)
      .values({
        firstName,
        lastName,
        birthDate,
        gender,
        phone: typeof body?.phone === "string" ? body.phone.trim() || null : null,
        address: typeof body?.address === "string" ? body.address.trim() || null : null,
      })
      .returning();

    return NextResponse.json(newPatient[0], { status: 201 });
  } catch (error) {
    console.error("Erreur lors de la création du patient:", error);
    return NextResponse.json(
      { error: "Erreur lors de la création du patient" },
      { status: 500 },
    );
  }
}
