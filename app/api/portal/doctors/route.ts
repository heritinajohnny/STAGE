import { asc } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "../../../db";
import { doctors } from "../../../db/schema";
import { requireActiveUser } from "../../../lib/access";

export async function GET(request: Request) {
  const { response } = await requireActiveUser(request);
  if (response) return response;

  const data = await db
    .select({
      id: doctors.id,
      firstName: doctors.firstName,
      lastName: doctors.lastName,
      specialty: doctors.specialty,
    })
    .from(doctors)
    .orderBy(asc(doctors.lastName));
  return NextResponse.json(data);
}
