import { NextResponse } from 'next/server';
import { db } from '../../../db/index';
import { patients } from '../../../db/schema';
import { eq } from 'drizzle-orm';
import { requireAdmin } from '../../../lib/access';

// PUT ou PATCH : Modifier un patient
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> } // 1. Déclarer params comme une Promise
) {
  const { response } = requireAdmin(request);
  if (response) return response;
  try {
    const resolvedParams = await params; // 2. Résoudre la Promise avec await
    const id = parseInt(resolvedParams.id);
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
      !Number.isInteger(id) ||
      firstName.length < 2 ||
      lastName.length < 2 ||
      !/^\d{4}-\d{2}-\d{2}$/.test(birthDate) ||
      Number.isNaN(Date.parse(`${birthDate}T00:00:00Z`)) ||
      !["M", "F", "AUTRE"].includes(gender)
    ) {
      return NextResponse.json({ error: "Vérifiez les informations du patient." }, { status: 400 });
    }

    const updated = await db
      .update(patients)
      .set({
        firstName,
        lastName,
        birthDate,
        gender,
        phone: typeof body?.phone === "string" ? body.phone.trim() || null : null,
        address: typeof body?.address === "string" ? body.address.trim() || null : null,
      })
      .where(eq(patients.id, id))
      .returning();

    return NextResponse.json(updated[0]);
  } catch (error) {
    console.error('Erreur lors de la modification :', error);
    return NextResponse.json(
      { error: 'Erreur lors de la modification' },
      { status: 500 }
    );
  }
}

// DELETE : Supprimer un patient
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { response } = requireAdmin(request);
  if (response) return response;
  try {
    const resolvedParams = await params;
    const id = parseInt(resolvedParams.id);

    await db.delete(patients).where(eq(patients.id, id));
    return NextResponse.json({ message: 'Patient supprimé avec succès' });
  } catch (error) {
    console.error("Erreur lors de la suppression du patient:", error);
    return NextResponse.json(
      { error: 'Erreur lors de la suppression' },
      { status: 500 }
    );
  }
}