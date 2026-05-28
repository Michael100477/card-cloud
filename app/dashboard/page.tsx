import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { CollectionsGrid } from "@/components/collections/CollectionsGrid";
import { PortfolioStats } from "@/components/dashboard/PortfolioStats";
import { WelcomeHeader } from "@/components/dashboard/WelcomeHeader";
import { WatchlistHighlights } from "@/components/dashboard/WatchlistHighlights";
import { FollowingFeed } from "@/components/dashboard/FollowingFeed";
import { ConsignmentStatus } from "@/components/dashboard/ConsignmentStatus";
import { FeaturedCardsStrip } from "@/components/dashboard/FeaturedCardsStrip";
import { NewsStrip } from "@/components/dashboard/NewsStrip";
import { FeaturedCollectors } from "@/components/explore/FeaturedCollectors";
import { MyFeedSection } from "@/components/dashboard/MyFeedSection";
import { getPageLayout, isWidgetEnabled } from "@/lib/layout";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const uid = session.user.id;

  const layout = await getPageLayout("dashboard");
  const show = (key: string) => isWidgetEnabled(layout, key);

  const followingIds = show("following_feed")
    ? (await db.userFollow.findMany({ where: { followerId: uid }, select: { followingId: true } })).map(f => f.followingId)
    : [];

  const [
    rawCollections, cardCount, user,
    watchedCards, watchTotal, followingCards,
    activeOrders, featuredCards, articles, featuredUsers,
    myFeedPosts,
  ] = await Promise.all([
    db.collection.findMany({
      where: { ownerId: uid }, orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { cards: true } },
        cards: { orderBy: { addedAt: "desc" }, take: 12, include: { card: { select: { photos: true, player: true, estimatedValue: true } } } },
      },
    }),
    db.card.count({ where: { ownerId: uid } }),
    db.user.findUnique({ where: { id: uid }, select: { createdAt: true, displayName: true, username: true } }),
    show("watchlist_highlights") ? db.cardWatch.findMany({
      where: { userId: uid }, orderBy: { createdAt: "desc" }, take: 4,
      include: { card: { select: { id: true, player: true, year: true, set: true, sport: true, grade: true, gradeCompany: true, photos: true, estimatedValue: true } } },
    }) : Promise.resolve([]),
    show("watchlist_highlights") ? db.cardWatch.count({ where: { userId: uid } }) : Promise.resolve(0),
    show("following_feed") && followingIds.length > 0 ? db.card.findMany({
      where: { ownerId: { in: followingIds }, isPublic: true }, orderBy: { createdAt: "desc" }, take: 6,
      select: { id: true, player: true, year: true, set: true, sport: true, grade: true, gradeCompany: true, photos: true, owner: { select: { displayName: true, username: true, profilePhoto: true } } },
    }) : Promise.resolve([]),
    show("consignment_status") ? db.consignmentOrder.findMany({
      where: { userId: uid, status: { in: ["pending","received","in_progress"] } }, orderBy: { submittedAt: "desc" },
      include: { items: { select: { player: true, status: true, listing: { select: { url: true } } } } },
    }) : Promise.resolve([]),
    show("featured_cards") ? db.card.findMany({
      where: { isFeatured: true, isPublic: true }, orderBy: { updatedAt: "desc" }, take: 10,
      select: { id: true, player: true, year: true, set: true, sport: true, grade: true, gradeCompany: true, photos: true, owner: { select: { displayName: true, username: true } } },
    }) : Promise.resolve([]),
    show("news_strip") ? db.article.findMany({
      where: { status: "published" }, orderBy: { publishedAt: "desc" }, take: 3,
      select: { id: true, title: true, slug: true, excerpt: true, category: true, coverImage: true, publishedAt: true },
    }) : Promise.resolve([]),
    show("featured_collectors") ? db.user.findMany({
      where: { isFeatured: true, isPublic: true }, take: 6,
      select: {
        id: true, displayName: true, username: true, profilePhoto: true, bio: true,
        _count: { select: { cards: true, collections: true, followers: true } },
        followers: { where: { followerId: uid }, select: { followerId: true } },
        cards: { where: { isPublic: true }, orderBy: { createdAt: "desc" }, take: 4, select: { photos: true } },
      },
    }) : Promise.resolve([]),
    // My Activity — own shared cards
    show("my_feed") ? db.feedPost.findMany({
      where: { userId: uid },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { card: { select: { id: true, player: true, year: true, manufacturer: true, set: true, sport: true, grade: true, gradeCompany: true, photos: true } } },
    }) : Promise.resolve([]),
  ]);

  const collections = rawCollections.map(col => ({
    ...col,
    cards: col.cards.map(cc => ({ ...cc, card: { ...cc.card, estimatedValue: cc.card.estimatedValue ? Number(cc.card.estimatedValue) : null } })),
  }));

  const watchCards = watchedCards.map(w => ({
    id: w.card.id, player: w.card.player, year: w.card.year, set: w.card.set,
    sport: w.card.sport, grade: w.card.grade, gradeCompany: w.card.gradeCompany,
    photos: w.card.photos,
    estimatedValue: w.card.estimatedValue ? Number(w.card.estimatedValue) : null,
    priceAtWatch: w.priceAtWatch ? Number(w.priceAtWatch) : null,
  }));

  const consignOrders = activeOrders.map(o => ({
    id: o.id, status: o.status, receiptCode: o.receiptCode,
    submittedAt: o.submittedAt.toISOString(),
    items: o.items.map(i => ({ player: i.player, status: i.status, listing: i.listing ? { url: i.listing.url } : null })),
  }));

  const articleCards = articles.map(a => ({ ...a, publishedAt: a.publishedAt?.toISOString() ?? null }));

  const featuredCollectors = featuredUsers.map(u => ({
    id: u.id, displayName: u.displayName, username: u.username,
    profilePhoto: u.profilePhoto, bio: u.bio,
    cardCount: u._count.cards, collectionCount: u._count.collections,
    followerCount: u._count.followers,
    isFollowing: u.followers.length > 0,
    recentPhotos: u.cards.flatMap(c => c.photos).slice(0, 4),
  }));

  const feedPosts = myFeedPosts.map(p => ({
    id: p.id, caption: p.caption, createdAt: p.createdAt.toISOString(), card: p.card,
  }));

  const widgetMap: Record<string, React.ReactNode> = {
    welcome_header:       show("welcome_header") ? <WelcomeHeader displayName={user?.displayName ?? null} username={user?.username ?? null} cardCount={cardCount} /> : null,
    portfolio_stats:      show("portfolio_stats") ? <PortfolioStats collectionCount={collections.length} cardCount={cardCount} accountCreatedAt={user?.createdAt.toISOString() ?? new Date().toISOString()} /> : null,
    my_collections:       show("my_collections") ? (
      <>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-navy text-xl font-bold">My Collections</h2>
          <Link href="/dashboard/my-collections" className="text-brand text-sm font-medium hover:underline">
            Manage collections →
          </Link>
        </div>
        <CollectionsGrid collections={collections} />
      </>
    ) : null,
    my_feed:              show("my_feed") ? <MyFeedSection posts={feedPosts} /> : null,
    watchlist_highlights: show("watchlist_highlights") ? <WatchlistHighlights cards={watchCards} total={watchTotal} /> : null,
    following_feed:       show("following_feed") ? <FollowingFeed cards={followingCards} followingCount={followingIds.length} /> : null,
    consignment_status:   show("consignment_status") ? <ConsignmentStatus orders={consignOrders} /> : null,
    featured_cards:       show("featured_cards") ? <FeaturedCardsStrip cards={featuredCards} /> : null,
    news_strip:           show("news_strip") ? <NewsStrip articles={articleCards} /> : null,
    featured_collectors:  show("featured_collectors") ? <FeaturedCollectors collectors={featuredCollectors} currentUserId={uid} /> : null,
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {layout.map(w => {
        const node = widgetMap[w.widgetKey];
        if (!node) return null;
        return <div key={w.widgetKey}>{node}</div>;
      })}
    </div>
  );
}
