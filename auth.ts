import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Google from "next-auth/providers/google";
import Apple from "next-auth/providers/apple";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(db),
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    // Apple Sign-In — requires Apple Developer account ($99/yr)
    // Leave credentials blank to disable; the button won't appear until set.
    ...(process.env.APPLE_ID && process.env.APPLE_SECRET
      ? [
          Apple({
            clientId: process.env.APPLE_ID,
            clientSecret: process.env.APPLE_SECRET,
          }),
        ]
      : []),
    Credentials({
      credentials: {
        email: { type: "email" },
        password: { type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await db.user.findUnique({
          where: { email: credentials.email as string },
        });

        if (!user?.passwordHash) return null;

        const valid = await bcrypt.compare(
          credentials.password as string,
          user.passwordHash
        );

        if (!valid) return null;

        return { id: user.id, email: user.email, name: user.displayName };
      },
    }),
  ],
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
    newUser: "/dashboard",
    error: "/login",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) token.id = user.id;
      return token;
    },
    async session({ session, token }) {
      if (token?.id) session.user.id = token.id as string;
      return session;
    },
  },
  events: {
    // Runs once when a brand-new user is created via OAuth.
    // Sets a generated username and starts their 30-day trial.
    async createUser({ user }) {
      if (!user.email) return;
      try {
        const base = user.email
          .split("@")[0]
          .replace(/[^a-zA-Z0-9]/g, "")
          .toLowerCase()
          .slice(0, 15);
        const suffix = Math.floor(Math.random() * 90_000) + 10_000;
        const username = `${base}${suffix}`;

        await db.user.update({
          where: { id: user.id },
          data: {
            username,
            planTier: "TRIAL",
            trialEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          },
        });
      } catch (err) {
        console.error("[auth createUser event]", err);
      }
    },
  },
});
