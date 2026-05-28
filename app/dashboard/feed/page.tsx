import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { FeedCard } from "./FeedCard";
import { NewPostButton } from "@/components/dashboard/NewPostButton";

export default async function FeedPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const uid = session.user.id;

  const followingIds = (await db.userFollow.findMany({
    where: { followerId: uid }, select: { followingId: true },
  })).map(f => f.followingId);

  const rawPosts = await db.feedPost.findMany({
    where: {
      AND: [
        {
          OR: [
            { userId: uid },
            ...(followingIds.length > 0 ? [{ userId: { in: followingIds } }] : []),
          ],
        },
        // show standalone posts (no card) or card posts where the card is public
        {
          OR: [
            { cardId: null },
            { card: { isPublic: true } },
          ],
        },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 30,
    include: {
      user: { select: { id: true, displayName: true, username: true, profilePhoto: true } },
      // comments on the feed post itself (used for standalone posts)
      _count:   { select: { comments: true } },
      comments: {
        orderBy: { createdAt: "asc" },
        take: 5,
        include: { author: { select: { id: true, displayName: true, username: true, profilePhoto: true } } },
      },
      card: {
        select: {
          id: true, player: true, year: true, manufacturer: true, set: true,
          subset: true, sport: true, grade: true, gradeCompany: true,
          serialNumber: true, tags: true, photos: true, estimatedValue: true,
          _count:   { select: { comments: true, watchers: true } },
          watchers: { where: { userId: uid }, select: { userId: true } },
          comments: {
            orderBy: { createdAt: "asc" },
            take: 5,
            include: { author: { select: { id: true, displayName: true, username: true, profilePhoto: true } } },
          },
        },
      },
    },
  });

  const formatComment = (c: { id: string; body: string; createdAt: Date; author: { id: string; displayName: string | null; username: string | null; profilePhoto: string | null } }) => ({
    id:        c.id,
    body:      c.body,
    createdAt: c.createdAt.toISOString(),
    author: {
      id:           c.author.id,
      name:         c.author.displayName ?? c.author.username ?? "Collector",
      profilePhoto: c.author.profilePhoto,
    },
  });

  const posts = rawPosts
    // drop card posts where the card was deleted (cardId set but card null due to SetNull)
    .filter(p => p.cardId === null || p.card !== null)
    .map(p => ({
      id:               p.id,
      caption:          p.caption,
      createdAt:        p.createdAt.toISOString(),
      photos:           p.photos,
      postComments:     p.comments.map(formatComment),
      postCommentCount: p._count.comments,
      user:             p.user,
      card: p.card ? {
        id:             p.card.id,
        player:         p.card.player,
        year:           p.card.year,
        manufacturer:   p.card.manufacturer,
        set:            p.card.set,
        subset:         p.card.subset,
        sport:          p.card.sport,
        grade:          p.card.grade,
        gradeCompany:   p.card.gradeCompany,
        serialNumber:   p.card.serialNumber,
        tags:           p.card.tags,
        photos:         p.card.photos,
        estimatedValue: p.card.estimatedValue ? Number(p.card.estimatedValue) : null,
        isWatching:     p.card.watchers.length > 0,
        commentCount:   p.card._count.comments,
        watcherCount:   p.card._count.watchers,
        comments:       p.card.comments.map(formatComment),
      } : null,
    }));

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between max-w-5xl mx-auto">
        <div>
          <h1 className="text-navy text-2xl font-bold">Your Feed</h1>
          <p className="text-slate-400 text-sm mt-0.5">Cards and posts from collectors you follow</p>
        </div>
        <NewPostButton />
      </div>

      {posts.length === 0 ? (
        <div className="max-w-lg mx-auto bg-white rounded-2xl border border-slate-100 p-12 text-center">
          <p className="text-navy font-semibold mb-2">Nothing in your feed yet</p>
          <p className="text-slate-400 text-sm">
            Follow collectors, share a card, or create a new post to get started.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-5xl mx-auto">
          {posts.map(post => (
            <FeedCard key={post.id} post={post} currentUserId={uid} />
          ))}
        </div>
      )}
    </div>
  );
}
