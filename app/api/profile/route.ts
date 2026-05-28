import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const {
    displayName, bio, location, profilePhoto,
    fullName, phone, addressLine1, addressLine2, city, state, zip, country,
  } = await req.json();

  const user = await db.user.update({
    where: { id: session.user.id },
    data: {
      displayName:  displayName  ?? null,
      bio:          bio          ?? null,
      location:     location     ?? null,
      profilePhoto: profilePhoto ?? null,
      fullName:     fullName     ?? null,
      phone:        phone        ?? null,
      addressLine1: addressLine1 ?? null,
      addressLine2: addressLine2 ?? null,
      city:         city         ?? null,
      state:        state        ?? null,
      zip:          zip          ?? null,
      country:      country      ?? null,
    },
    select: { id: true, displayName: true, username: true },
  });

  logger.info({ category: "user", action: "user.profile.updated", message: "User updated their profile", userId: session.user.id });
  return NextResponse.json({ ok: true, user });
}

export async function DELETE() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  logger.warn({ category: "user", action: "user.account.deleted", message: "User deleted their own account", userId: session.user.id });
  await db.user.delete({ where: { id: session.user.id } });
  return NextResponse.json({ ok: true });
}
