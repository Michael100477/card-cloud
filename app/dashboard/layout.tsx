import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { DashboardNav } from "@/components/dashboard/DashboardNav";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  // Fetch the full user record so the nav has username / displayName / photo
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
      username:    true,
      displayName: true,
      email:       true,
      profilePhoto: true,
    },
  });

  if (!user) redirect("/login");

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <DashboardNav
        username={user.username}
        displayName={user.displayName}
        email={user.email}
        profilePhoto={user.profilePhoto}
      />
      <main className="flex-1">{children}</main>
    </div>
  );
}
