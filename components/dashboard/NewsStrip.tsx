import Link from "next/link";

interface ArticleCard {
  id:          string;
  title:       string;
  slug:        string;
  excerpt:     string | null;
  category:    string | null;
  coverImage:  string | null;
  publishedAt: string | null;
}

export function NewsStrip({ articles }: { articles: ArticleCard[] }) {
  if (articles.length === 0) return null;

  return (
    <section className="mb-8">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-navy text-lg font-bold">Latest Articles</h2>
          <p className="text-slate-400 text-xs mt-0.5">News and guides from The Card Cloud</p>
        </div>
        <Link href="/articles" className="text-brand text-sm font-medium hover:underline">
          All articles →
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {articles.map(article => (
          <Link key={article.id} href={`/articles/${article.slug}`}
            className="bg-white rounded-2xl border border-slate-100 overflow-hidden hover:shadow-md transition-shadow group">
            {/* Cover */}
            {article.coverImage ? (
              <div className="h-40 overflow-hidden">
                <img src={article.coverImage} alt={article.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
              </div>
            ) : (
              <div className="h-32 bg-gradient-to-br from-navy to-brand flex items-center justify-center">
                <span className="text-white/20 text-5xl font-bold">
                  {article.title.slice(0, 1)}
                </span>
              </div>
            )}

            <div className="p-4">
              {article.category && (
                <span className="text-xs font-semibold text-brand bg-brand/10 px-2 py-0.5 rounded-full">
                  {article.category}
                </span>
              )}
              <h3 className="text-navy font-semibold text-sm mt-2 leading-snug line-clamp-2 group-hover:text-brand transition-colors">
                {article.title}
              </h3>
              {article.excerpt && (
                <p className="text-slate-400 text-xs mt-1 line-clamp-2">{article.excerpt}</p>
              )}
              <p className="text-slate-300 text-xs mt-2">
                {article.publishedAt ? new Date(article.publishedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : ""}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
