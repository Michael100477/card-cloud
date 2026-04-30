import Link from "next/link";

const placeholderArticles = [
  {
    id: 1,
    category: "Market Analysis",
    categoryColor: "bg-brand-muted text-brand",
    title: "The 5 Most Valuable Rookie Cards Right Now",
    deck: "Prices are shifting fast. Here's what our latest eBay comp data says about this year's hottest rookies.",
    author: "The Card Cloud",
    date: "Apr 28, 2026",
    readTime: "4 min read",
    accentBg: "bg-brand-muted",
  },
  {
    id: 2,
    category: "Grading Guide",
    categoryColor: "bg-success-muted text-success",
    title: "How to Prep Your Cards Before Submitting to PSA",
    deck: "Small mistakes cost you a grade. This checklist covers everything from storage to submission packaging.",
    author: "The Card Cloud",
    date: "Apr 22, 2026",
    readTime: "6 min read",
    accentBg: "bg-success-muted",
  },
  {
    id: 3,
    category: "Trading Tips",
    categoryColor: "bg-amber-muted text-amber",
    title: "Getting Fair Value in Every Trade",
    deck: "How to use live eBay comps to propose balanced trades — and what to do when a deal goes sideways.",
    author: "The Card Cloud",
    date: "Apr 15, 2026",
    readTime: "5 min read",
    accentBg: "bg-amber-muted",
  },
];

export function ArticleStrip() {
  return (
    <section className="bg-white py-16 sm:py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section header */}
        <div className="flex items-end justify-between mb-10">
          <div>
            <p className="text-brand text-sm font-semibold uppercase tracking-widest mb-1">
              Hobby Desk
            </p>
            <h2 className="text-navy text-2xl sm:text-3xl font-bold">
              Latest from the blog
            </h2>
          </div>
          <Link
            href="/articles"
            className="text-brand text-sm font-semibold hover:text-light-navy transition-colors hidden sm:block"
          >
            See all articles →
          </Link>
        </div>

        {/* Article cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {placeholderArticles.map((article) => (
            <Link
              key={article.id}
              href="/articles"
              className="group block border border-slate-100 rounded-2xl overflow-hidden hover:shadow-md transition-shadow"
            >
              {/* Cover placeholder */}
              <div className={`h-36 ${article.accentBg} flex items-center justify-center`}>
                <BookIcon className="w-10 h-10 text-slate-300" />
              </div>

              {/* Content */}
              <div className="p-5">
                <span className={`inline-block text-xs font-semibold px-2.5 py-1 rounded-full mb-3 ${article.categoryColor}`}>
                  {article.category}
                </span>
                <h3 className="text-navy font-bold text-base leading-snug mb-2 group-hover:text-brand transition-colors">
                  {article.title}
                </h3>
                <p className="text-slate-500 text-sm leading-relaxed line-clamp-2 mb-4">
                  {article.deck}
                </p>
                <div className="flex items-center gap-2 text-slate-400 text-xs">
                  <span>{article.date}</span>
                  <span>·</span>
                  <span>{article.readTime}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* Mobile "see all" link */}
        <div className="mt-8 text-center sm:hidden">
          <Link href="/articles" className="text-brand text-sm font-semibold hover:text-light-navy transition-colors">
            See all articles →
          </Link>
        </div>
      </div>
    </section>
  );
}

function BookIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  );
}
