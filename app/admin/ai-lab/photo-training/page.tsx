import { db } from "@/lib/db";
import { PhotoTrainingClient } from "./PhotoTrainingClient";

export default async function PhotoTrainingPage() {
  const samples = await db.photoTrainingSample.findMany({
    orderBy: { createdAt: "desc" },
    take:    100,
    select:  { id: true, beforeThumb: true, afterThumb: true, cx: true, cy: true, category: true, description: true, sourcePath: true, createdAt: true },
  });

  return (
    <PhotoTrainingClient
      initialSamples={samples.map(s => ({ ...s, createdAt: s.createdAt.toISOString() }))}
    />
  );
}
