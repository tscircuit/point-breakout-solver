import { pointBreakoutDatasets } from "../datasets"
import { PointBreakoutPipelineSolver } from "../lib"

const rows: Array<Record<string, string | number | boolean>> = []
let failedSamples = 0

for (const dataset of pointBreakoutDatasets) {
  for (const sample of dataset.samples) {
    const solver = new PointBreakoutPipelineSolver(sample.problem)
    const startedAt = performance.now()
    solver.solve()
    const elapsedMs = performance.now() - startedAt
    const output = solver.getOutput()

    if (!output.success) failedSamples += 1
    rows.push({
      dataset: dataset.id,
      sample: sample.id,
      points: sample.pointCount,
      seed: sample.seed,
      obstacles: sample.problem.obstacles?.length ?? 0,
      attempts: output.attempts,
      routed: output.routedCount,
      intersections: output.verification.intersections,
      obstacleCollisions: output.verification.obstacleCollisions,
      minClearance: Number(output.verification.minClearance.toFixed(3)),
      minObstacleClearance: Number(
        output.verification.minObstacleClearance.toFixed(3),
      ),
      milliseconds: Number(elapsedMs.toFixed(2)),
      success: output.success,
    })
  }
}

console.table(rows)

if (failedSamples > 0) {
  console.error(`${failedSamples} benchmark sample(s) failed`)
  process.exitCode = 1
} else {
  console.log(`All ${rows.length} benchmark samples passed`)
}
