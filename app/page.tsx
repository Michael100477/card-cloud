import { TopNav } from "@/components/nav/TopNav";
import { Hero } from "@/components/landing/Hero";
import { FeaturedCards } from "@/components/landing/FeaturedCards";
import { CommunityPitch } from "@/components/landing/CommunityPitch";
import { CommunityFeed } from "@/components/landing/CommunityFeed";
import { RecentlyAdded } from "@/components/landing/RecentlyAdded";
import { ArticleStrip } from "@/components/landing/ArticleStrip";
import { SocialFeedStrip } from "@/components/landing/SocialFeedStrip";
import { PricingStrip } from "@/components/landing/PricingStrip";
import { SportsCategoryStrip } from "@/components/landing/SportsCategoryStrip";
import { FooterCTA } from "@/components/landing/FooterCTA";
import { SiteFooter } from "@/components/landing/SiteFooter";
import { NewsStrip } from "@/components/dashboard/NewsStrip";
import { db } from "@/lib/db";
import { getLinksMap, seedLinks } from "@/lib/links";
import { getPageLayout } from "@/lib/layout";

export default async function LandingPage() {
  const [rows, linksMap, layout] = await Promise.all([
    db.siteSetting.findMany(),
    seedLinks().then(() => getLinksMap()),
    getPageLayout("landing"),
  ]);

  const cms: Record<string, string> = {};
  for (const r of rows) cms[r.key] = r.value;

  // Only fetch article data if the news_strip widget is enabled on this page
  const newsWidget = layout.find(w => w.widgetKey === "news_strip" && w.enabled);
  const articles = newsWidget
    ? await db.article.findMany({
        where: { status: "published" }, orderBy: { publishedAt: "desc" }, take: 3,
        select: { id: true, title: true, slug: true, excerpt: true, category: true, coverImage: true, publishedAt: true },
      }).then(rows => rows.map(a => ({ ...a, publishedAt: a.publishedAt?.toISOString() ?? null })))
    : [];

  // Real community stats for CommunityPitch if enabled
  const pitchWidget = layout.find(w => w.widgetKey === "landing_community_pitch" && w.enabled);
  const liveStats = pitchWidget ? await (async () => {
    const [collectors, cardsTracked, publicCollections, statesRaw, countriesRaw] = await Promise.all([
      db.user.count(),
      db.card.count(),
      db.collection.count({ where: { isPublic: true } }),
      db.user.findMany({ where: { state:   { not: null } }, select: { state:   true }, distinct: ["state"]   }),
      db.user.findMany({ where: { country: { not: null } }, select: { country: true }, distinct: ["country"] }),
    ]);
    return { collectors, cardsTracked, publicCollections, statesRepresented: statesRaw.length, countriesRepresented: countriesRaw.length };
  })() : null;

  // Featured cards for the FeaturedCards widget if enabled on landing
  const featuredCardsWidget = layout.find(w => w.widgetKey === "featured_cards" && w.enabled);
  const featuredCards = featuredCardsWidget
    ? await db.card.findMany({
        where: { isFeatured: true, isPublic: true }, orderBy: { updatedAt: "desc" }, take: 10,
        select: { id: true, player: true, year: true, set: true, sport: true, grade: true, gradeCompany: true, photos: true, owner: { select: { displayName: true, username: true } } },
      })
    : [];

  // Build a map from widget key to renderable content
  const widgetMap: Record<string, React.ReactNode> = {
    landing_hero:               <Hero cms={cms} links={linksMap} />,
    landing_sports_categories:  <SportsCategoryStrip />,
    landing_community_pitch:    <CommunityPitch cms={cms} links={linksMap} liveStats={liveStats} />,
    landing_pricing:            <PricingStrip />,
    landing_community_feed:   <CommunityFeed />,
    landing_recently_added:   <RecentlyAdded />,
    landing_social_feed:      <SocialFeedStrip />,
    landing_article_strip:    <ArticleStrip />,
    landing_footer_cta:       <FooterCTA links={linksMap} />,
    featured_cards:           featuredCards.length > 0 ? <FeaturedCards /> : null,
    news_strip:               articles.length > 0 ? <NewsStrip articles={articles} /> : null,
    featured_collectors:      null, // designed for logged-in pages, skip on landing for now
  };

  const enabledWidgets = layout.filter(w => w.enabled);

  return (
    <>
      <TopNav links={linksMap} />
      <main className="flex-1">
        {enabledWidgets.map(w => {
          const node = widgetMap[w.widgetKey];
          if (!node) return null;
          return <div key={w.widgetKey}>{node}</div>;
        })}
      </main>
      <SiteFooter />
    </>
  );
}
