import type { PointBreakoutProblem } from "lib/point-breakout-pipeline-solver"

export interface PointBreakoutDatasetSample {
  id: string
  name: string
  description: string
  pointCount: number
  seed: number
  problem: PointBreakoutProblem
}

export interface PointBreakoutDataset {
  id: string
  name: string
  description: string
  samples: PointBreakoutDatasetSample[]
}
