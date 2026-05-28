import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { OwnProfileClient } from "./OwnProfileClient";

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const user = await db.user.findUnique({
    where:  { id: session.user.id },
    select: {
      id: true, displayName: true, username: true, profilePhoto: true,
      bio: true, location: true, email: true,
      fullName: true, phone: true, addressLine1: true, addressLine2: true,
      city: true, state: true, zip: true, country: true,
      _count: { select: { followers: true, following: true, cards: true } },
    },
  });
  if (!user) redirect("/login");

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-navy text-2xl font-bold">My Profile</h1>
        {user.username && (
          <a href={`/u/${user.username}`} target="_blank" rel="noopener noreferrer"
            className="text-brand text-sm font-medium hover:underline">
            View public profile →
          </a>
        )}
      </div>

      <OwnProfileClient
        user={{
          id:           user.id,
          displayName:  user.displayName,
          username:     user.username,
          profilePhoto: user.profilePhoto,
          bio:          user.bio,
          location:     user.location,
          email:        user.email,
          fullName:     user.fullName,
          phone:        user.phone,
          addressLine1: user.addressLine1,
          addressLine2: user.addressLine2,
          city:         user.city,
          state:        user.state,
          zip:          user.zip,
          country:      user.country,
          cardCount:    user._count.cards,
          followerCount:  user._count.followers,
          followingCount: user._count.following,
        }}
      />
    </div>
  );
}
