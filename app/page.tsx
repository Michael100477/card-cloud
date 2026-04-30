import { TopNav } from "@/components/nav/TopNav";
import { Hero } from "@/components/landing/Hero";
import { CommunityPitch } from "@/components/landing/CommunityPitch";
import { CommunityFeed } from "@/components/landing/CommunityFeed";
import { ArticleStrip } from "@/components/landing/ArticleStrip";
import { FooterCTA, PageFooter } from "@/components/landing/FooterCTA";

export default function LandingPage() {
  return (
    <>
      <TopNav />
      <main className="flex-1">
        <Hero />
        <CommunityPitch />
        <CommunityFeed />
        <ArticleStrip />
        <FooterCTA />
      </main>
      <PageFooter />
    </>
  );
}
