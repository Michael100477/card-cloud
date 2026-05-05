import { TopNav } from "@/components/nav/TopNav";
import { Hero } from "@/components/landing/Hero";
import { FeaturedCards } from "@/components/landing/FeaturedCards";
import { CommunityPitch } from "@/components/landing/CommunityPitch";
import { CommunityFeed } from "@/components/landing/CommunityFeed";
import { RecentlyAdded } from "@/components/landing/RecentlyAdded";
import { ArticleStrip } from "@/components/landing/ArticleStrip";
import { FooterCTA, PageFooter } from "@/components/landing/FooterCTA";

export default function LandingPage() {
  return (
    <>
      <TopNav />
      <main className="flex-1">
        <Hero />
        {/* Featured cards — only renders when admin has marked cards as featured */}
        <FeaturedCards />
        <CommunityPitch />
        <CommunityFeed />
        {/* Recently added — only renders when there are public cards in the system */}
        <RecentlyAdded />
        <ArticleStrip />
        <FooterCTA />
      </main>
      <PageFooter />
    </>
  );
}
