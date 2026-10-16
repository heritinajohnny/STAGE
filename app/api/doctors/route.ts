import { NextResponse } from "next/server";
import { db } from "../../db/index";
import { doctors } from "../../db/schema";
import { requireAdmin } from "../../lib/access";

// GET : Liste des médecins
export async function GET(request: Request) {
  const { response } = requireAdmin(request);
  if (response) return response;
  try {
    const data = await db.select().from(doctors);
    return NextResponse.json(data);
  } catch (error) {
    console.error("Erreur lors de la récupération des médecins:", error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération des médecins" },
      { status: 500 },
    );
  }
}

// POST : Ajouter un médecin
export async function POST(request: Request) {
  const { response } = requireAdmin(request);
  if (response) return response;
  try {
    const body = await request.json();
    const newDoctor = await db
      .insert(doctors)
      .values({
        firstName: body.firstName,
        lastName: body.lastName,
        specialty: body.specialty,
        phone: body.phone || null,
        email: body.email || null,
        consultationDurationMinutes: Number(body.consultationDurationMinutes) || 30,
        maxPatientsPerSlot: Number(body.maxPatientsPerSlot) || 1,
      })
      .returning();

    return NextResponse.json(newDoctor[0], { status: 201 });
  } catch (error) {
    console.error("Erreur lors de la création du médecin:", error);
    return NextResponse.json(
      { error: "Erreur lors de la création du médecin" },
      { status: 500 },
    );
  }
}
