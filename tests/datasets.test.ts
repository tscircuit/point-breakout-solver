import { describe, expect, test } from "bun:test"
import { pointBreakoutDatasets } from "../datasets"
import {
  PointBreakoutPipelineSolver,
  REQUIRED_CENTERLINE_CLEARANCE,
  REQUIRED_OBSTACLE_CLEARANCE,
} from "../lib"

describe("point breakout datasets", () => {
  test("contains 20 unique deterministic samples from 10 to 100 points", () => {
    const samples = pointBreakoutDatasets.flatMap((dataset) => dataset.samples)

    expect(samples).toHaveLength(20)
    expect(new Set(samples.map((sample) => sample.id)).size).toBe(20)
    expect(Math.min(...samples.map((sample) => sample.pointCount))).toBe(10)
    expect(Math.max(...samples.map((sample) => sample.pointCount))).toBe(100)
  })

  test("solves every benchmark sample with all geometry invariants", () => {
    for (const dataset of pointBreakoutDatasets) {
      for (const sample of dataset.samples) {
        const solver = new PointBreakoutPipelineSolver(sample.problem)
        solver.solve()
        const output = solver.getOutput()

        expect(output.success, sample.id).toBe(true)
        expect(output.routedCount, sample.id).toBe(sample.pointCount)
        expect(output.unrouted, sample.id).toEqual([])
        expect(output.terminalConflicts, sample.id).toEqual([])
        expect(output.obstacleConflicts, sample.id).toEqual([])
        expect(output.verification.intersections, sample.id).toBe(0)
        expect(output.verification.obstacleCollisions, sample.id).toBe(0)
        expect(output.verification.invalidAngles, sample.id).toBe(0)
        expect(output.verification.offBoundaryEndpoints, sample.id).toBe(0)
        expect(
          output.verification.minClearance,
          sample.id,
        ).toBeGreaterThanOrEqual(REQUIRED_CENTERLINE_CLEARANCE - 1e-7)
        if ((sample.problem.obstacles?.length ?? 0) > 0) {
          expect(
            output.verification.minObstacleClearance,
            sample.id,
          ).toBeGreaterThanOrEqual(REQUIRED_OBSTACLE_CLEARANCE - 1e-7)
        }
      }
    }
  })
})
