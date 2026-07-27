import { createRandomSample } from "./create-random-sample"
import type { PointBreakoutDataset } from "./dataset-types"

export const resilienceMatrixDataset: PointBreakoutDataset = {
  id: "dataset02",
  name: "Additional resilience trials",
  description:
    "Two independent follow-up trials at every density, including two additional 100-point layouts.",
  samples: [1, 2].flatMap((trial) =>
    [10, 25, 50, 75, 100].map((count) =>
      createRandomSample(count, 815 + count * 97 + trial * 104729),
    ),
  ),
}
