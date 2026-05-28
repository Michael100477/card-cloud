import Link from "next/link";
import { FollowButton } from "@/components/social/FollowButton";

interface FeaturedUser {
  id:           string;
  displayName:  string | null;
  username:     string | null;
  profilePhoto: string | null;
  bio:          string | null;
  cardCount:    number;
  collectionCount: number;
  followerCount:   number;
  isFollowing:     boolean;
  recentPhotos:    string[];
}

export function FeaturedCollectors({ collectors, currentUserId }: {
  collectors:    FeaturedUser[];
  currentUserId: string;
}) {
  if (collectors.length === 0) return null;

  return (
    <section className="mb-8">
      <div className="mb-4">
        <h2 className="text-navy text-lg font-bold">Featured Collectors</h2>
        <p className="text-slate-400 text-xs mt-0.5">Hand-picked collectors worth following</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {collectors.map(user => {
          const name   = user.displayName ?? user.username ?? "Collector";
          const isOwn  = user.id === currentUserId;

          return (
            <div key={user.id} className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
              {/* Card preview strip */}
              <div className="grid grid-cols-4 h-20">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className={`overflow-hidden ${user.recentPhotos[i] ? "" : "bg-slate-100"}`}>
                    {user.recentPhotos[i] && (
                      <img src={user.recentPhotos[i]} alt="" className="w-full h-full object-cover" />
                    )}
                  </div>
                ))}
              </div>

              {/* Featured badge */}
              <div className="px-4 pt-3 pb-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-full bg-brand/10 overflow-hidden flex items-center justify-center shrink-0">
                      {user.profilePhoto
                        ? <img src={user.profilePhoto} alt={name} className="w-full h-full object-cover" />
                        : <span className="text-brand font-bold text-sm">{name[0]?.toUpperCase()}</span>
                      }
                    </div>
                    <div>
                      <p className="text-navy text-sm font-semibold">{name}</p>
                      <span className="text-xs bg-amber/20 text-amber-dark font-semibold px-1.5 py-0.5 rounded-full">⭐ Featured</span>
                    </div>
                  </div>
                  {!isOwn && (
                    <FollowButton type="user" targetId={user.id}
                      initialFollowing={user.isFollowing} initialCount={user.followerCount} compact />
                  )}
                </div>

                {user.bio && (
                  <p className="text-slate-400 text-xs line-clamp-2 mb-2">{user.bio}</p>
                )}

                <div className="flex items-center gap-3 text-xs text-slate-400">
                  <span>{user.cardCount} cards</span>
                  <span>·</span>
                  <span>{user.collectionCount} collections</span>
                  <span>·</span>
                  <span>{user.followerCount} followers</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
