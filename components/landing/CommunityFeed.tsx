import Link from "next/link";

interface ActivityPost {
  id: number;
  username: string;
  avatarColor: string;
  avatarLetter: string;
  action: string;
  collectionName: string;
  collectionSlug: string;
  collectionEmoji: string;
  timeAgo: string;
  card: {
    player: string;
    year: number;
    set: string;
    cardNumber: string;
    grade: string;
    gradeCompany: string;
    estimatedValue: number;
    sport: string;
    color1: string;
    color2: string;
    textAccent: string;
  };
  likes: number;
  comments: number;
  commentPreview?: string;
  commentUsername?: string;
}

const FEED: ActivityPost[] = [
  {
    id: 1,
    username: "JordanHunter23",
    avatarColor: "#CE1141",
    avatarLetter: "J",
    action: "added to",
    collectionName: "Chicago Bulls Collection",
    collectionSlug: "chicago-bulls",
    collectionEmoji: "🏀",
    timeAgo: "2h ago",
    card: {
      player: "Michael Jordan",
      year: 1986, set: "Fleer", cardNumber: "#57",
      grade: "PSA 7", gradeCompany: "PSA", estimatedValue: 2800,
      sport: "NBA", color1: "#CE1141", color2: "#1a1a1a", textAccent: "#CE1141",
    },
    likes: 24, comments: 8,
    commentPreview: "The OG! That '86 Fleer is the holy grail 🔥",
    commentUsername: "WaxLife_Pete",
  },
  {
    id: 2,
    username: "PackRipper_KC",
    avatarColor: "#E31837",
    avatarLetter: "P",
    action: "added to",
    collectionName: "Patrick Mahomes PC",
    collectionSlug: "mahomes-pc",
    collectionEmoji: "🏈",
    timeAgo: "5h ago",
    card: {
      player: "Patrick Mahomes",
      year: 2023, set: "Topps Chrome", cardNumber: "#1",
      grade: "PSA 10", gradeCompany: "PSA", estimatedValue: 285,
      sport: "NFL", color1: "#E31837", color2: "#FFB612", textAccent: "#FFB612",
    },
    likes: 12, comments: 3,
    commentPreview: "Another 10? You're on a roll 👑",
    commentUsername: "ChromeChaser",
  },
  {
    id: 3,
    username: "PokeInvestor",
    avatarColor: "#FF6B35",
    avatarLetter: "P",
    action: "added to",
    collectionName: "Vintage Pokémon Vault",
    collectionSlug: "vintage-pokemon-vault",
    collectionEmoji: "⚡",
    timeAgo: "Yesterday",
    card: {
      player: "Charizard — Holo",
      year: 1999, set: "Base Set", cardNumber: "#4/102",
      grade: "PSA 8", gradeCompany: "PSA", estimatedValue: 3200,
      sport: "Pokémon", color1: "#FF6B35", color2: "#C2410C", textAccent: "#FCD34D",
    },
    likes: 89, comments: 31,
    commentPreview: "Base set Zard never gets old. What's your asking?",
    commentUsername: "HoloHunter99",
  },
  {
    id: 4,
    username: "WaxLifer_Mike",
    avatarColor: "#092C5C",
    avatarLetter: "W",
    action: "added to",
    collectionName: "Baseball Rookies & Stars",
    collectionSlug: "baseball-rookies-stars",
    collectionEmoji: "⚾",
    timeAgo: "Yesterday",
    card: {
      player: "Wander Franco — Auto",
      year: 2021, set: "Bowman Chrome", cardNumber: "#BCP-25",
      grade: "PSA 10", gradeCompany: "PSA", estimatedValue: 890,
      sport: "MLB", color1: "#092C5C", color2: "#8FBCE6", textAccent: "#8FBCE6",
    },
    likes: 18, comments: 5,
    commentPreview: "Auto 10s on Bowman Chrome are so clean 💎",
    commentUsername: "SlabSurfer",
  },
  {
    id: 5,
    username: "KingJamesPC",
    avatarColor: "#552583",
    avatarLetter: "K",
    action: "added to",
    collectionName: "LeBron James — All Years",
    collectionSlug: "lebron-james-all-years",
    collectionEmoji: "👑",
    timeAgo: "2 days ago",
    card: {
      player: "LeBron James",
      year: 2003, set: "Topps", cardNumber: "#221",
      grade: "BGS 9", gradeCompany: "BGS", estimatedValue: 1250,
      sport: "NBA", color1: "#552583", color2: "#FDB927", textAccent: "#FDB927",
    },
    likes: 67, comments: 22,
    commentPreview: "2003 Topps in a 9 is no joke. Big cop 🙌",
    commentUsername: "RookieMania",
  },
  {
    id: 6,
    username: "MTGVault",
    avatarColor: "#4C1D95",
    avatarLetter: "M",
    action: "added to",
    collectionName: "Power Nine Collection",
    collectionSlug: "power-nine",
    collectionEmoji: "🃏",
    timeAgo: "3 days ago",
    card: {
      player: "Black Lotus",
      year: 1993, set: "Alpha Edition", cardNumber: "#232",
      grade: "BGS 7.5", gradeCompany: "BGS", estimatedValue: 12500,
      sport: "Magic", color1: "#1a0a3c", color2: "#6b21a8", textAccent: "#c084fc",
    },
    likes: 234, comments: 87,
    commentPreview: "Alpha Black Lotus is always a moment. Congrats!",
    commentUsername: "DualLandsDave",
  },
];

const GRADE_COLORS: Record<string, string> = {
  PSA: "#185FA5", BGS: "#1a1a1a", CGC: "#d97706", SGC: "#059669",
};

export function CommunityFeed() {
  return (
    <section className="bg-slate-50 py-16 sm:py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Section header */}
        <div className="flex items-end justify-between mb-10">
          <div>
            <p className="text-brand text-sm font-semibold uppercase tracking-widest mb-1">
              Community
            </p>
            <h2 className="text-navy text-2xl sm:text-3xl font-bold">
              What collectors are adding
            </h2>
            <p className="text-slate-500 text-sm mt-1">
              Real collectors, real collections — see what's being tracked right now
            </p>
          </div>
          <Link
            href="/explore"
            className="text-brand text-sm font-semibold hover:text-light-navy transition-colors hidden sm:block shrink-0 ml-8"
          >
            Explore all collectors →
          </Link>
        </div>

        {/* Activity grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEED.map((post) => (
            <article
              key={post.id}
              className="bg-white rounded-2xl overflow-hidden border border-slate-100 hover:shadow-md transition-shadow flex flex-col"
            >
              {/* Post header — collector identity */}
              <div className="flex items-center gap-3 px-4 pt-4 pb-3">
                {/* Avatar */}
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0"
                  style={{ background: post.avatarColor }}
                >
                  {post.avatarLetter}
                </div>

                <div className="flex-1 min-w-0">
                  {/* Username + action */}
                  <p className="text-sm leading-snug">
                    <Link
                      href={`/u/${post.username.toLowerCase()}`}
                      className="font-bold text-navy hover:text-brand transition-colors"
                    >
                      @{post.username}
                    </Link>
                    <span className="text-slate-500 font-normal"> {post.action} </span>
                    <Link
                      href={`/u/${post.username.toLowerCase()}/${post.collectionSlug}`}
                      className="font-semibold text-brand hover:text-light-navy transition-colors"
                    >
                      {post.collectionEmoji} {post.collectionName}
                    </Link>
                  </p>
                  <p className="text-slate-400 text-xs mt-0.5">{post.timeAgo}</p>
                </div>
              </div>

              {/* Card image */}
              <Link href={`/u/${post.username.toLowerCase()}/${post.collectionSlug}`}>
                <div
                  className="relative mx-4 rounded-xl overflow-hidden"
                  style={{
                    background: `linear-gradient(145deg, ${post.card.color1}, ${post.card.color2})`,
                    aspectRatio: "2.5 / 3.5",
                  }}
                >
                  {/* Card inner border */}
                  <div className="absolute inset-2.5 border border-white/20 rounded-lg" />

                  {/* Ghosted card number */}
                  <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
                    <span
                      className="font-black select-none leading-none"
                      style={{
                        fontSize: "clamp(52px, 20cqi, 96px)",
                        color: "rgba(255,255,255,0.07)",
                        letterSpacing: "-0.04em",
                      }}
                    >
                      {post.card.cardNumber}
                    </span>
                  </div>

                  {/* Player & set label inside card */}
                  <div className="absolute bottom-8 left-0 right-0 px-3 text-center">
                    <p className="text-white/80 font-bold truncate"
                      style={{ fontSize: "clamp(9px, 3.5cqi, 14px)" }}>
                      {post.card.player.toUpperCase()}
                    </p>
                    <p className="font-semibold mt-0.5 truncate opacity-85"
                      style={{ color: post.card.textAccent, fontSize: "clamp(7px, 2.8cqi, 11px)" }}>
                      {post.card.year} {post.card.set}
                    </p>
                  </div>

                  {/* Bottom bar */}
                  <div className="absolute bottom-0 left-0 right-0 h-7"
                    style={{ background: "rgba(0,0,0,0.5)" }} />
                  <div className="absolute bottom-1.5 left-0 right-0 flex justify-center">
                    <span className="text-white/50 uppercase tracking-widest"
                      style={{ fontSize: "clamp(5px, 1.8cqi, 8px)" }}>
                      {post.card.sport}
                    </span>
                  </div>

                  {/* Grade badge */}
                  <div
                    className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded-full text-white font-bold shadow-sm"
                    style={{
                      background: GRADE_COLORS[post.card.gradeCompany] ?? "#64748b",
                      fontSize: "clamp(7px, 2.5cqi, 10px)",
                    }}
                  >
                    {post.card.grade}
                  </div>

                  {/* Value badge */}
                  <div className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-full font-semibold shadow-sm"
                    style={{
                      background: "rgba(0,0,0,0.5)",
                      color: post.card.textAccent,
                      fontSize: "clamp(7px, 2.5cqi, 10px)",
                    }}
                  >
                    ~${post.card.estimatedValue.toLocaleString()}
                  </div>
                </div>
              </Link>

              {/* Card metadata */}
              <div className="px-4 pt-3">
                <p className="text-navy font-bold text-sm">{post.card.player}</p>
                <p className="text-slate-400 text-xs mt-0.5">
                  {post.card.year} {post.card.set} · {post.card.cardNumber}
                </p>
              </div>

              {/* Comment preview */}
              {post.commentPreview && (
                <div className="mx-4 mt-3 bg-slate-50 rounded-xl px-3 py-2.5">
                  <p className="text-xs text-slate-600 leading-snug">
                    <span className="font-semibold text-navy">@{post.commentUsername} </span>
                    {post.commentPreview}
                  </p>
                </div>
              )}

              {/* Engagement row */}
              <div className="flex items-center justify-between px-4 py-3 mt-auto">
                <div className="flex items-center gap-4">
                  <button className="flex items-center gap-1.5 text-slate-400 hover:text-alert transition-colors group">
                    <HeartIcon className="w-4 h-4 group-hover:fill-alert" />
                    <span className="text-xs font-medium">{post.likes}</span>
                  </button>
                  <button className="flex items-center gap-1.5 text-slate-400 hover:text-brand transition-colors">
                    <CommentIcon className="w-4 h-4" />
                    <span className="text-xs font-medium">{post.comments}</span>
                  </button>
                </div>
                <Link
                  href={`/u/${post.username.toLowerCase()}/${post.collectionSlug}`}
                  className="text-brand text-xs font-semibold hover:text-light-navy transition-colors"
                >
                  View collection →
                </Link>
              </div>
            </article>
          ))}
        </div>

        {/* Bottom CTAs */}
        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/explore"
            className="text-brand font-semibold text-sm hover:text-light-navy transition-colors"
          >
            Explore all collectors →
          </Link>
          <span className="text-slate-300 hidden sm:block">·</span>
          <Link
            href="/signup"
            className="bg-navy text-white font-semibold text-sm px-5 py-2.5 rounded-xl hover:bg-light-navy transition-colors"
          >
            Start your own collection
          </Link>
        </div>
      </div>
    </section>
  );
}

function HeartIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}

function CommentIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}
