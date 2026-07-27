import { generatePoints, type RectObstacle } from "lib/router"
import type { PointBreakoutDatasetSample } from "./dataset-types"

export function createRandomSample(
  pointCount: number,
  seed: number,
  options: {
    obstacles?: RectObstacle[]
    maxAttempts?: number
  } = {},
): PointBreakoutDatasetSample {
  const paddedCount = pointCount.toString().padStart(3, "0")
  const obstacles = options.obstacles ?? []
  return {
    id: `seed-${seed}-points-${paddedCount}`,
    name: `${pointCount} random points`,
    description: `A deterministic random ${pointCount}-point layout generated with seed ${seed}${obstacles.length > 0 ? ` around ${obstacles.length} rectangular obstacles` : ""}.`,
    pointCount,
    seed,
    problem: {
      name: `${pointCount} points · seed ${seed}`,
      points: generatePoints(pointCount, seed, { obstacles }),
      obstacles,
      seed,
      maxAttempts: options.maxAttempts ?? 8,
    },
  }
}
