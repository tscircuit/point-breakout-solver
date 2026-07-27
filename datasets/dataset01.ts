import { createRandomSample } from "./create-random-sample"
import type { PointBreakoutDataset } from "./dataset-types"

export const densityLadderDataset: PointBreakoutDataset = {
  id: "dataset01",
  name: "Baseline density ladder",
  description:
    "The first deterministic trial at each benchmark density from 10 through 100 points.",
  samples: [10, 25, 50, 75, 100].map((count) =>
    createRandomSample(count, 815 + count * 97),
  ),
}
