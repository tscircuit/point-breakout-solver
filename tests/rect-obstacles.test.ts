import { describe, expect, test } from "bun:test"
import {
  generatePoints,
  PointBreakoutPipelineSolver,
  pointRectDistance,
  REQUIRED_OBSTACLE_CLEARANCE,
  type RectObstacle,
  solveRoutes,
  verifyRoutes,
} from "../lib"

const obstacle: RectObstacle = {
  id: "keepout",
  center: { x: 5, y: 2.5 },
  width: 4,
  height: 1,
}

describe("rectangular obstacles", () => {
  test("computes exact point-to-rectangle distance", () => {
    expect(pointRectDistance({ x: 5, y: 2.5 }, obstacle)).toBe(0)
    expect(pointRectDistance({ x: 5, y: 4 }, obstacle)).toBe(1)
    expect(pointRectDistance({ x: 2, y: 1 }, obstacle)).toBeCloseTo(Math.SQRT2)
  })

  test("rejects a route that crosses an obstacle", () => {
    const verification = verifyRoutes(
      [
        {
          pointId: 0,
          path: [
            { id: 0, x: 5, y: 4 },
            { id: 0, x: 5, y: 0 },
          ],
        },
      ],
      [obstacle],
    )

    expect(verification.valid).toBe(false)
    expect(verification.obstacleCollisions).toBe(1)
    expect(verification.minObstacleClearance).toBe(0)
  })

  test("routes around an obstacle with route-width-aware clearance", () => {
    const solver = new PointBreakoutPipelineSolver({
      points: [{ id: 0, x: 5, y: 4 }],
      obstacles: [obstacle],
      seed: 815,
    })

    solver.solve()
    const output = solver.getOutput()

    expect(output.success).toBe(true)
    expect(output.obstacleConflicts).toEqual([])
    expect(output.verification.obstacleCollisions).toBe(0)
    expect(output.verification.minObstacleClearance).toBeGreaterThanOrEqual(
      REQUIRED_OBSTACLE_CLEARANCE - 1e-7,
    )
  })

  test("supports obstacles through the functional solveRoutes API", () => {
    const output = solveRoutes([{ id: 0, x: 5, y: 4 }], {
      obstacles: [obstacle],
      seed: 815,
    })

    expect(output.success).toBe(true)
    expect(output.verification.obstacleCollisions).toBe(0)
  })

  test("reports terminals placed inside obstacle keep-outs", () => {
    const solver = new PointBreakoutPipelineSolver({
      points: [{ id: 0, x: 5, y: 2.5 }],
      obstacles: [obstacle],
    })

    solver.solve()
    const output = solver.getOutput()

    expect(output.success).toBe(false)
    expect(output.obstacleConflicts).toEqual([
      { pointId: 0, obstacleId: "keepout", distance: 0 },
    ])
  })

  test("random point generation excludes obstacle keep-outs", () => {
    const points = generatePoints(100, 1234, { obstacles: [obstacle] })

    expect(points).toHaveLength(100)
    for (const point of points) {
      expect(pointRectDistance(point, obstacle)).toBeGreaterThanOrEqual(
        REQUIRED_OBSTACLE_CLEARANCE - 1e-7,
      )
    }
  })
})
