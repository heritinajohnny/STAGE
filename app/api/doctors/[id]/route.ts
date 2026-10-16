import { NextResponse } from "next/server";
import { db } from "../../../db/index";
import { doctors } from "../../../db/schema";
import { eq } from "drizzle-orm";
import { requireAdmin } from "../../../lib/access";

// PUT : Modifier un médecin
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { response } = requireAdmin(request);
  if (response) return response;
  try {
    const { id: idParam } = await params;
    const id = parseInt(idParam);
    const body = await request.json();

    const updated = await db
      .update(doctors)
      .set({
        firstName: body.firstName,
        lastName: body.lastName,
        specialty: body.specialty,
        phone: body.phone || null,
        email: body.email || null,
        ...(Number.isInteger(body.consultationDurationMinutes) && {
          consultationDurationMinutes: body.consultationDurationMinutes,
        }),
        ...(Number.isInteger(body.maxPatientsPerSlot) && {
          maxPatientsPerSlot: body.maxPatientsPerSlot,
        }),
      })
      .where(eq(doctors.id, id))
      .returning();

    return NextResponse.json(updated[0]);
  } catch (error) {
    console.error("Erreur mise à jour médecin :", error);
    return NextResponse.json(
      { error: "Erreur de mise à jour du médecin" },
      { status: 500 },
    );
  }
}

// DELETE : Supprimer un médecin
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { response } = requireAdmin(request);
  if (response) return response;
  try {
    const { id: idParam } = await params;
    const id = parseInt(idParam);

    await db.delete(doctors).where(eq(doctors.id, id));
    return NextResponse.json({ message: "Médecin supprimé" });
  } catch (error) {
    console.error("Erreur suppression médecin :", error);
    return NextResponse.json(
      { error: "Erreur de suppression du médecin" },
      { status: 500 },
    );
  }
}
