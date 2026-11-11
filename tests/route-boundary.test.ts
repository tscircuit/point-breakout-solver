import assert from "node:assert/strict"
import { test } from "node:test"
import { solveRoutes, verifyRoutes, type Route } from "../lib/router.ts"

// Node 24: node --experimental-transform-types --test tests/route-boundary.test.ts
// The repository also discovers *.test.ts with bun test; that runner is separate.
// Expectations below describe the finite 10 x 10 boundary, not infinite edge lines.
function routeTo(x: number, y: number, pointId = 0): Route {
  return {
    pointId,
    path: [
      { id: pointId, x: 5, y: 5 },
      { id: pointId, x, y: 5 },
      { id: pointId, x, y },
    ],
  }
}

const validEndpoints: Array<[string, number, number]> = [
  ["left edge", 0, 5],
  ["right edge", 10, 5],
  ["bottom edge", 5, 0],
  ["top edge", 5, 10],
  ["bottom-left corner", 0, 0],
  ["bottom-right corner", 10, 0],
  ["top-left corner", 0, 10],
  ["top-right corner", 10, 10],
]
for (const [name, x, y] of validEndpoints) {
  test(`accepts the finite boundary at the ${name}`, () => {
    assert.deepEqual(verifyRoutes([routeTo(x, y)]), {
      intersections: 0,
      invalidAngles: 0,
      offBoundaryEndpoints: 0,
      obstacleCollisions: 0,
      minClearance: 10,
      minObstacleClearance: 10,
      valid: true,
    })
  })
}

const extensions: Array<[string, number, number]> = [
  ["left below", 0, -1],
  ["left above", 0, 11],
  ["right below", 10, -1],
  ["right above", 10, 11],
  ["bottom left", -1, 0],
  ["bottom right", 11, 0],
  ["top left", -1, 10],
  ["top right", 11, 10],
]
for (const [name, x, y] of extensions) {
  test(`rejects the ${name} edge extension`, () => {
    assert.deepEqual(verifyRoutes([routeTo(x, y)]), {
      intersections: 0,
      invalidAngles: 0,
      offBoundaryEndpoints: 1,
      obstacleCollisions: 0,
      minClearance: 10,
      minObstacleClearance: 10,
      valid: false,
    })
  })
}

// Existing edge comparisons accept distances <= 1e-7. Use clear half/double
// distances near 10 so decimal subtraction rounding cannot decide the oracle.
const toleranceCases: Array<[string, number, number, boolean]> = [
  ["near left edge", -5e-8, 5, true],
  ["near right edge", 10 + 5e-8, 5, true],
  ["near bottom edge", 5, -5e-8, true],
  ["near top edge", 5, 10 + 5e-8, true],
  ["near lower x limit at a corner", -5e-8, 0, true],
  ["near upper x limit at a corner", 10 + 5e-8, 0, true],
  ["near lower y limit at a corner", 0, -5e-8, true],
  ["near upper y limit at a corner", 0, 10 + 5e-8, true],
  ["past left edge tolerance", -2e-7, 5, false],
  ["past right edge tolerance", 10 + 2e-7, 5, false],
  ["past bottom edge tolerance", 5, -2e-7, false],
  ["past top edge tolerance", 5, 10 + 2e-7, false],
  ["past lower x limit at a corner", -2e-7, 0, false],
  ["past upper x limit at a corner", 10 + 2e-7, 0, false],
  ["past lower y limit at a corner", 0, -2e-7, false],
  ["past upper y limit at a corner", 0, 10 + 2e-7, false],
]
for (const [name, x, y, valid] of toleranceCases) {
  test(name, () => {
    const result = verifyRoutes([routeTo(x, y)])
    assert.equal(result.offBoundaryEndpoints, valid ? 0 : 1)
    assert.equal(result.invalidAngles, 0)
    assert.equal(result.valid, valid)
  })
}

// At a corner the other coordinate lies exactly on an edge. These fixtures
// isolate the inclusive coordinate limits, without assuming (10 + e) - 10 === e.
const inclusiveLimits: Array<[string, number, number]> = [
  ["lower x", -1e-7, 0],
  ["upper x", 10 + 1e-7, 0],
  ["lower y", 0, -1e-7],
  ["upper y", 0, 10 + 1e-7],
]
for (const [name, x, y] of inclusiveLimits) {
  test(`includes the existing tolerance at the ${name} limit`, () => {
    const result = verifyRoutes([routeTo(x, y)])
    assert.equal(result.offBoundaryEndpoints, 0)
    assert.equal(result.valid, true)
  })
}

test("an interior endpoint remains off the boundary", () => {
  const result = verifyRoutes([routeTo(6, 5)])
  assert.equal(result.offBoundaryEndpoints, 1)
  assert.equal(result.valid, false)
})

test("an empty path still has a missing boundary endpoint", () => {
  const result = verifyRoutes([{ pointId: 0, path: [] }])
  assert.equal(result.offBoundaryEndpoints, 1)
  assert.equal(result.valid, false)
})

test("counts every invalid endpoint once", () => {
  const result = verifyRoutes([
    { pointId: 0, path: [] },
    { pointId: 1, path: [{ id: 1, x: 0, y: 11 }] },
    { pointId: 2, path: [{ id: 2, x: 11, y: 0 }] },
    { pointId: 3, path: [{ id: 3, x: 0, y: 5 }] },
  ])
  assert.equal(result.offBoundaryEndpoints, 3)
  assert.equal(result.valid, false)
})

test("endpoint validation does not add whole-path containment", () => {
  const result = verifyRoutes([
    {
      pointId: 0,
      path: [
        { id: 0, x: 5, y: 5 },
        { id: 0, x: 11, y: 5 },
        { id: 0, x: 11, y: 0 },
        { id: 0, x: 10, y: 0 },
      ],
    },
  ])
  assert.equal(result.offBoundaryEndpoints, 0)
  assert.equal(result.valid, true)
})

test("verification leaves the supplied routes unchanged", () => {
  const routes = [routeTo(0, 11), routeTo(10, 5, 1)]
  const before = structuredClone(routes)
  verifyRoutes(routes)
  assert.deepEqual(routes, before)
})

test("a valid boundary endpoint does not hide an illegal angle", () => {
  const result = verifyRoutes([
    {
      pointId: 0,
      path: [
        { id: 0, x: 2, y: 3 },
        { id: 0, x: 0, y: 0 },
      ],
    },
  ])
  assert.equal(result.offBoundaryEndpoints, 0)
  assert.equal(result.invalidAngles, 1)
  assert.equal(result.valid, false)
})

test("a valid boundary endpoint does not hide an obstacle collision", () => {
  const result = verifyRoutes(
    [
      {
        pointId: 0,
        path: [
          { id: 0, x: 5, y: 4 },
          { id: 0, x: 5, y: 0 },
        ],
      },
    ],
    [{ center: { x: 5, y: 2.5 }, width: 4, height: 1 }],
  )
  assert.equal(result.offBoundaryEndpoints, 0)
  assert.equal(result.obstacleCollisions, 1)
  assert.equal(result.minObstacleClearance, 0)
  assert.equal(result.valid, false)
})

test("functional routing still produces a legal boundary endpoint", () => {
  const result = solveRoutes([{ id: 0, x: 5, y: 5 }], { maxAttempts: 1 })
  assert.equal(result.success, true)
  assert.equal(result.routedCount, 1)
  assert.deepEqual(result.unrouted, [])
  assert.equal(result.verification.offBoundaryEndpoints, 0)
  assert.equal(result.verification.valid, true)
})
