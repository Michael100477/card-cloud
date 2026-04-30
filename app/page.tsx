import { TopNav } from "@/components/nav/TopNav";
import { Hero } from "@/components/landing/Hero";
import { ArticleStrip } from "@/components/landing/ArticleStrip";
import { FooterCTA, PageFooter } from "@/components/landing/FooterCTA";

export default function LandingPage() {
  return (
    <>
      <TopNav />
      <main className="flex-1">
        <Hero />
        <ArticleStrip />
        <FooterCTA />
      </main>
      <PageFooter />
    </>
  );
}
