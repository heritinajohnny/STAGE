import { NextResponse } from "next/server";
import { db } from "../../../db";
import { doctors } from "../../../db/schema";
import { getSessionFromRequest } from "../../../lib/auth";

interface AssistantResult {
  specialty: string | null;
  dateFrom: string | null;
  dateTo: string | null;
  periodOfDay: "MORNING" | "AFTERNOON" | "ANY";
}

function isValidDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function normalizeSpecialty(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleLowerCase("fr");
}

function specialtyKey(value: string) {
  const normalized = normalizeSpecialty(value);
  if (["pediatre", "pediatrie"].includes(normalized)) return "pediatrie";
  if (["cardiologue", "cardiologie"].includes(normalized)) return "cardiologie";
  if (["dermatologue", "dermatologie"].includes(normalized)) return "dermatologie";
  if (["gynecologue", "gynecologie"].includes(normalized)) return "gynecologie";
  if (["ophtalmologue", "ophtalmologie"].includes(normalized)) return "ophtalmologie";
  if (["dentiste", "odontologie", "dentaire"].includes(normalized)) return "dentaire";
  if (["medecin generaliste", "medecine generale", "generaliste"].includes(normalized)) return "medecine generale";
  return normalized;
}

export async function POST(request: Request) {
  const session = getSessionFromRequest(request);
  if (!session || session.role !== "user") {
    return NextResponse.json({ error: "Accès réservé aux comptes utilisateurs." }, { status: 403 });
  }

  const body = await request.json().catch(() => null) as { prompt?: unknown; today?: unknown } | null;
  const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
  const today = typeof body?.today === "string" && isValidDate(body.today) ? body.today : "";
  if (prompt.length < 3 || prompt.length > 240 || !today) {
    return NextResponse.json({ error: "Saisissez une demande courte et une date valide." }, { status: 400 });
  }
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "L’assistant n’est pas configuré. Utilisez les filtres manuels." }, { status: 503 });
  }

  try {
    const specialtyRows = await db.select({ specialty: doctors.specialty }).from(doctors);
    const specialties = [...new Set(specialtyRows.map(({ specialty }) => specialty.trim()).filter(Boolean))].slice(0, 50);
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0,
        max_tokens: 100,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: "Extrais les filtres de recherche. JSON seulement: specialty, dateFrom, dateTo, periodOfDay. Dates ISO YYYY-MM-DD selon aujourd'hui. Pour mardi, prends le prochain mardi. Une date donne dateFrom=dateTo. specialty: valeur exacte de la liste, en comprenant les synonymes (pédiatre=pédiatrie); sinon null si aucune. periodOfDay: MORNING pour matin, AFTERNOON pour après-midi/soir, ANY sinon. Pour période inconnue, dates null. Maximum 31 jours. Aucun conseil médical.",
          },
          {
            role: "user",
            content: `Aujourd'hui: ${today}. Spécialités: ${JSON.stringify(specialties)}. Demande: ${prompt}`,
          },
        ],
      }),
      signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok) {
      console.error("Échec de l’assistant OpenAI, statut:", response.status);
      return NextResponse.json({ error: "L’assistant est temporairement indisponible. Utilisez les filtres manuels." }, { status: 502 });
    }
    const payload = await response.json() as {
      choices?: Array<{ message?: { content?: string | null } }>;
    };
    const content = payload.choices?.[0]?.message?.content;
    if (!content) {
      console.error("Réponse vide de l’assistant OpenAI.");
      return NextResponse.json({ error: "La demande n’a pas pu être interprétée. Utilisez les filtres manuels." }, { status: 502 });
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      console.error("Format JSON invalide dans la réponse de l’assistant OpenAI.");
      return NextResponse.json({ error: "La demande n’a pas pu être interprétée. Utilisez les filtres manuels." }, { status: 502 });
    }

    if (
      !parsed ||
      typeof parsed !== "object" ||
      Array.isArray(parsed) ||
      !("specialty" in parsed) ||
      !("dateFrom" in parsed) ||
      !("dateTo" in parsed) ||
      !("periodOfDay" in parsed)
    ) {
      console.error("Structure JSON invalide dans la réponse de l’assistant OpenAI.");
      return NextResponse.json({ error: "La demande n’a pas pu être interprétée. Utilisez les filtres manuels." }, { status: 502 });
    }
    const result = parsed as AssistantResult;
    if (
      (result.specialty !== null && typeof result.specialty !== "string") ||
      (result.dateFrom !== null && typeof result.dateFrom !== "string") ||
      (result.dateTo !== null && typeof result.dateTo !== "string") ||
      !["MORNING", "AFTERNOON", "ANY"].includes(result.periodOfDay)
    ) {
      console.error("Types de champs invalides dans la réponse de l’assistant OpenAI.");
      return NextResponse.json({ error: "La demande n’a pas pu être interprétée. Utilisez les filtres manuels." }, { status: 502 });
    }

    const specialty = typeof result.specialty === "string" ? result.specialty.trim() : null;
    const dateFrom = typeof result.dateFrom === "string" && isValidDate(result.dateFrom) ? result.dateFrom : null;
    const dateTo = typeof result.dateTo === "string" && isValidDate(result.dateTo) ? result.dateTo : null;
    if (
      (result.dateFrom !== null && !dateFrom) ||
      (result.dateTo !== null && !dateTo) ||
      (dateFrom && dateTo && (dateFrom > dateTo ||
        (Date.parse(`${dateTo}T00:00:00Z`) - Date.parse(`${dateFrom}T00:00:00Z`)) / 86_400_000 > 30))
    ) {
      return NextResponse.json({ error: "La période demandée est invalide ou dépasse 31 jours. Précisez les dates." }, { status: 422 });
    }

    const matchingSpecialty = specialty
      ? specialties.find((item) => specialtyKey(item) === specialtyKey(specialty))
      : null;
    if (specialty && !matchingSpecialty) {
      return NextResponse.json({ error: `La spécialité « ${specialty.slice(0, 80)} » n’est pas proposée. Choisissez une spécialité dans les filtres.` }, { status: 422 });
    }

    return NextResponse.json({
      specialty: matchingSpecialty || null,
      dateFrom,
      dateTo,
      periodOfDay: result.periodOfDay,
    });
  } catch (error) {
    console.error("Erreur lors de l’interprétation de la demande de rendez-vous:", error);
    return NextResponse.json({ error: "Impossible d’interpréter la demande. Utilisez les filtres manuels." }, { status: 502 });
  }
}
