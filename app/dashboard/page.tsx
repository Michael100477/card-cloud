import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Temp nav */}
      <nav className="bg-navy px-6 py-4 flex items-center justify-between">
        <Link href="/" className="text-white font-bold">☁ The Card Cloud</Link>
        <Link
          href="/api/auth/signout"
          className="text-white/70 hover:text-white text-sm transition-colors"
        >
          Sign out
        </Link>
      </nav>

      <main className="max-w-4xl mx-auto px-4 py-16 text-center">
        <div className="text-5xl mb-6">🎉</div>
        <h1 className="text-navy text-3xl font-bold mb-3">
          Welcome, {session.user.name ?? session.user.email}!
        </h1>
        <p className="text-slate-500 text-lg mb-10">
          Your account is set up and your 30-day free trial has started.
          The dashboard is coming soon — check back shortly.
        </p>
        <Link
          href="/"
          className="bg-amber text-amber-dark font-semibold px-6 py-3 rounded-xl hover:brightness-105 transition-all"
        >
          Back to home
        </Link>
      </main>
    </div>
  );
}
