import { db } from "@/lib/db";
import { FeaturedCardsClient } from "./FeaturedCardsClient";

export default async function AdminCardsPage() {
  const featured = await db.card.findMany({
    where:   { isFeatured: true },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true, player: true, year: true, manufacturer: true, set: true,
      grade: true, gradeCompany: true, photos: true, isPublic: true, isFeatured: true,
      owner: { select: { displayName: true, username: true, email: true } },
    },
  });

  return <FeaturedCardsClient initialFeatured={featured} />;
}
