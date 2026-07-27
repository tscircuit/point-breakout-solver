import { generatePoints } from "lib/router"
import type { PointBreakoutDatasetSample } from "./dataset-types"

export function createRandomSample(
  pointCount: number,
  seed: number,
): PointBreakoutDatasetSample {
  const paddedCount = pointCount.toString().padStart(3, "0")
  return {
    id: `seed-${seed}-points-${paddedCount}`,
    name: `${pointCount} random points`,
    description: `A deterministic random ${pointCount}-point layout generated with seed ${seed}.`,
    pointCount,
    seed,
    problem: {
      name: `${pointCount} points · seed ${seed}`,
      points: generatePoints(pointCount, seed),
      seed,
      maxAttempts: 8,
    },
  }
}
