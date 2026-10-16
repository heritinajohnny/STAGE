import { NextResponse } from "next/server";
import { getSessionFromRequest } from "./auth";

export function requireAdmin(request: Request) {
  const session = getSessionFromRequest(request);
  if (!session || session.role !== "admin") {
    return {
      session: null,
      response: NextResponse.json({ error: "Accès réservé à l’administration." }, { status: 403 }),
    };
  }
  return { session, response: null };
}
