import { PrismaClient } from "@/app/generated/prisma/client";

// Prevent multiple Prisma instances in development (Next.js hot reload creates new modules)
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    accelerateUrl: process.env.DATABASE_URL!,
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
