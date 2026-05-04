"use server";

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

function slugify(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 60);
}

async function requireAuth() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  return session.user.id;
}

export async function createCollectionAction(formData: FormData) {
  const userId = await requireAuth();

  const name      = (formData.get("name")        as string).trim();
  const description = (formData.get("description") as string | null)?.trim() || null;
  const isPublic  = formData.get("isPublic") === "true";

  if (!name) return { error: "Collection name is required." };
  if (name.length > 80) return { error: "Name must be 80 characters or less." };

  // Generate a unique slug for this user
  const base = slugify(name);
  let slug = base;
  let attempt = 0;
  while (true) {
    const existing = await db.collection.findUnique({
      where: { ownerId_slug: { ownerId: userId, slug } },
    });
    if (!existing) break;
    attempt++;
    slug = `${base}-${attempt}`;
  }

  const collection = await db.collection.create({
    data: { ownerId: userId, name, description, slug, isPublic },
  });

  revalidatePath("/dashboard");
  redirect(`/dashboard/collections/${collection.id}`);
}

export async function updateCollectionAction(formData: FormData) {
  const userId = await requireAuth();

  const id          = formData.get("id") as string;
  const name        = (formData.get("name") as string).trim();
  const description = (formData.get("description") as string | null)?.trim() || null;
  const isPublic    = formData.get("isPublic") === "true";

  const collection = await db.collection.findUnique({ where: { id } });
  if (!collection || collection.ownerId !== userId) return { error: "Not found." };

  await db.collection.update({
    where: { id },
    data:  { name, description, isPublic },
  });

  revalidatePath(`/dashboard/collections/${id}`);
  revalidatePath("/dashboard");
  return { success: true };
}

export async function deleteCollectionAction(id: string) {
  const userId = await requireAuth();

  const collection = await db.collection.findUnique({ where: { id } });
  if (!collection || collection.ownerId !== userId) return { error: "Not found." };

  await db.collection.delete({ where: { id } });
  revalidatePath("/dashboard");
  redirect("/dashboard");
}
