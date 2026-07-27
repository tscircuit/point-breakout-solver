import type { RectObstacle } from "lib/router"
import { createRandomSample } from "./create-random-sample"
import type { PointBreakoutDataset } from "./dataset-types"

const obstacles: RectObstacle[] = [
  {
    id: "center-bar",
    center: { x: 5, y: 5 },
    width: 1.2,
    height: 2.4,
  },
  {
    id: "northwest-block",
    center: { x: 2.7, y: 7.4 },
    width: 1.3,
    height: 1,
  },
  {
    id: "southeast-block",
    center: { x: 7.4, y: 2.6 },
    width: 1.4,
    height: 1.1,
  },
]

export const rectObstacleDataset: PointBreakoutDataset = {
  id: "dataset03",
  name: "Rectangular obstacles",
  description:
    "Random density samples routed around three axis-aligned keep-out rectangles.",
  samples: [
    { count: 10, seed: 56930 },
    { count: 25, seed: 59825 },
    { count: 50, seed: 64650 },
    { count: 75, seed: 69475 },
    { count: 100, seed: 10517 },
  ].map(({ count, seed }) =>
    createRandomSample(count, seed, {
      obstacles,
      maxAttempts: 12,
    }),
  ),
}
