import { describe, expect, test } from "bun:test"
import {
  generatePoints,
  PointBreakoutPipelineSolver,
  REQUIRED_CENTERLINE_CLEARANCE,
} from "../lib"

describe("PointBreakoutPipelineSolver", () => {
  test("runs prepare, route, and verify stages", () => {
    const solver = new PointBreakoutPipelineSolver({
      name: "pipeline smoke test",
      points: generatePoints(25, 815),
      seed: 815,
      maxAttempts: 7,
    })

    solver.solve()
    const output = solver.getOutput()

    expect(solver.solved).toBe(true)
    expect(solver.failed).toBe(false)
    expect(output.success).toBe(true)
    expect(output.routedCount).toBe(25)
    expect(output.verification.minClearance).toBeGreaterThanOrEqual(
      REQUIRED_CENTERLINE_CLEARANCE - 1e-7,
    )
    expect(Object.keys(solver.getAllOutputs())).toEqual([
      "preparePointSetSolver",
      "routePointSetSolver",
      "verifyPointBreakoutSolver",
    ])
    expect(solver.getStageStats().verifyPointBreakoutSolver?.completed).toBe(
      true,
    )
  })
})
