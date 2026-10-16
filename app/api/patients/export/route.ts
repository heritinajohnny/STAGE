import { and, gte, lt, type SQL } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "../../../db";
import { patients } from "../../../db/schema";
import { requireAdmin } from "../../../lib/access";

function parseDate(value: string | null) {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value
    ? undefined
    : date;
}

function csvCell(value: string | number) {
  let safeValue = String(value);
  if (/^[\s\u0000-\u001f]*[=+\-@]/.test(safeValue)) safeValue = `'${safeValue}`;
  return `"${safeValue.replaceAll('"', '""')}"`;
}

export async function GET(request: Request) {
  const { response } = requireAdmin(request);
  if (response) return response;

  const url = new URL(request.url);
  const fromValue = url.searchParams.get("from");
  const toValue = url.searchParams.get("to");
  const from = parseDate(fromValue);
  const to = parseDate(toValue);
  if (from === undefined || to === undefined || (from && to && from > to)) {
    return NextResponse.json({ error: "Choisissez une période d’inscription valide." }, { status: 400 });
  }

  const filters: SQL[] = [];
  if (from) filters.push(gte(patients.createdAt, from));
  if (to) {
    const dayAfterTo = new Date(to);
    dayAfterTo.setUTCDate(dayAfterTo.getUTCDate() + 1);
    filters.push(lt(patients.createdAt, dayAfterTo));
  }

  try {
    const rows = await db
      .select()
      .from(patients)
      .where(filters.length ? and(...filters) : undefined)
      .orderBy(patients.lastName, patients.firstName);
    const header = ["ID", "Nom", "Prénom", "Date de naissance", "Sexe", "Téléphone", "Adresse", "Date d’inscription"];
    const lines = [
      header.map(csvCell).join(";"),
      ...rows.map((patient) => [
        patient.id,
        patient.lastName,
        patient.firstName,
        patient.birthDate,
        patient.gender,
        patient.phone || "",
        patient.address || "",
        patient.createdAt.toISOString().slice(0, 10),
      ].map(csvCell).join(";")),
    ];
    const filename = `patients${fromValue || toValue ? `-${fromValue || "debut"}-${toValue || "fin"}` : ""}.csv`;
    return new Response(`\uFEFF${lines.join("\r\n")}`, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Erreur lors de l’export des patients:", error);
    return NextResponse.json({ error: "Impossible de télécharger la liste des patients." }, { status: 500 });
  }
}
