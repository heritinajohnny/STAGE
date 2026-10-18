import { and, desc, eq, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "../../db";
import { notifications } from "../../db/schema";
import { getSessionFromRequest } from "../../lib/auth";
import { requireActiveUser } from "../../lib/access";

export async function GET(request: Request) {
  const session = getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
  if (session.role === "user") {
    const { response } = await requireActiveUser(request);
    if (response) return response;
  }

  const recipient = session.role === "admin"
    ? and(eq(notifications.recipientRole, "admin"), isNull(notifications.recipientUserId))
    : and(eq(notifications.recipientRole, "user"), eq(notifications.recipientUserId, session.id));

  const items = await db
    .select({
      id: notifications.id,
      message: notifications.message,
      appointmentId: notifications.appointmentId,
      readAt: notifications.readAt,
      createdAt: notifications.createdAt,
      href: notifications.appointmentId,
    })
    .from(notifications)
    .where(recipient)
    .orderBy(desc(notifications.createdAt))
    .limit(30);

  return NextResponse.json(items.map(({ href, ...item }) => ({
    ...item,
    href: href
      ? session.role === "admin"
        ? `/appointments?appointment=${href}`
        : `/portal?appointment=${href}#mes-rendez-vous`
      : session.role === "admin"
        ? "/appointments"
        : "/portal#notifications",
  })));
}

export async function POST(request: Request) {
  const session = getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
  if (session.role === "user") {
    const { response } = await requireActiveUser(request);
    if (response) return response;
  }

  const recipient = session.role === "admin"
    ? and(eq(notifications.recipientRole, "admin"), isNull(notifications.recipientUserId))
    : and(eq(notifications.recipientRole, "user"), eq(notifications.recipientUserId, session.id));

  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(recipient, isNull(notifications.readAt)));

  return NextResponse.json({ ok: true });
}
