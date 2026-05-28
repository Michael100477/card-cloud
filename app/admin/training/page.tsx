import { db } from "@/lib/db";
import { TrainingClient } from "./TrainingClient";

export default async function TrainingPage() {
  const [pending, verified, total] = await Promise.all([
    db.trainingExample.findMany({
      where:   { verified: false },
      orderBy: { createdAt: "desc" },
      take:    50,
    }),
    db.trainingExample.count({ where: { verified: true } }),
    db.trainingExample.count(),
  ]);

  return <TrainingClient initialPending={pending} verifiedCount={verified} totalCount={total} />;
}
