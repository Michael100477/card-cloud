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
      username:        true,
      displayName:     true,
      email:           true,
      profilePhoto:    true,
      isAdmin:         true,
      suspended:       true,
      suspendedReason: true,
    },
  });

  if (!user) redirect("/login");
  const isAdmin = user.isAdmin || user.email === process.env.ADMIN_EMAIL;

  // Suspended users see a notice instead of the dashboard
  if (user.suspended) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl border border-red-200 p-8 text-center">
          <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">🚫</span>
          </div>
          <h1 className="text-navy text-xl font-bold mb-2">Account Suspended</h1>
          <p className="text-slate-500 text-sm mb-3">
            Your account has been suspended and you cannot access the dashboard.
          </p>
          {user.suspendedReason && (
            <div className="bg-slate-50 rounded-xl p-3 mb-4 text-left">
              <p className="text-slate-400 text-xs font-semibold uppercase tracking-wide mb-1">Reason</p>
              <p className="text-slate-600 text-sm">{user.suspendedReason}</p>
            </div>
          )}
          <p className="text-slate-400 text-xs">
            If you believe this is a mistake, please contact us at{" "}
            <a href="mailto:support@thecardcloud.com" className="text-brand hover:underline">
              support@thecardcloud.com
            </a>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <DashboardNav
        username={user.username}
        displayName={user.displayName}
        email={user.email}
        profilePhoto={user.profilePhoto}
        isAdmin={isAdmin}
      />
      <main className="flex-1">{children}</main>
    </div>
  );
}
