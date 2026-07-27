export const FIELD_SIZE = 10
export const GRID_STEP = 0.1
export const ROUTE_WIDTH = 0.1
export const ROUTE_MARGIN = 0.1
export const REQUIRED_CENTERLINE_CLEARANCE = ROUTE_WIDTH + ROUTE_MARGIN
export const REQUIRED_OBSTACLE_CLEARANCE = ROUTE_WIDTH / 2 + ROUTE_MARGIN

const GRID_MAX = Math.round(FIELD_SIZE / GRID_STEP)
const GRID_NODES = GRID_MAX + 1
const STATE_DIRECTIONS = 9
const EPSILON = 1e-7
const TERMINAL_PADDING = 0.24

export type Point = {
  id: number
  x: number
  y: number
}

export type Route = {
  pointId: number
  path: Point[]
}

export type RectObstacle = {
  id?: string
  center: {
    x: number
    y: number
  }
  width: number
  height: number
}

export type Verification = {
  intersections: number
  invalidAngles: number
  offBoundaryEndpoints: number
  obstacleCollisions: number
  minClearance: number
  minObstacleClearance: number
  valid: boolean
}

export type SolveResult = {
  routes: Route[]
  unrouted: number[]
  routedCount: number
  attempts: number
  elapsedMs: number
  verification: Verification
  success: boolean
}

type GridNode = {
  gx: number
  gy: number
}

type Segment = {
  id: number
  routeId: number
  a: Point
  b: Point
}

type IndexedRectObstacle = {
  index: number
  obstacle: RectObstacle
}

export type RectBounds = {
  minX: number
  maxX: number
  minY: number
  maxY: number
}

export type RouteAttemptResult = {
  routes: Route[]
  unrouted: number[]
}

const DIRECTIONS = [
  { dx: 1, dy: 0 },
  { dx: 1, dy: 1 },
  { dx: 0, dy: 1 },
  { dx: -1, dy: 1 },
  { dx: -1, dy: 0 },
  { dx: -1, dy: -1 },
  { dx: 0, dy: -1 },
  { dx: 1, dy: -1 },
] as const

function mulberry32(seed: number) {
  let value = seed >>> 0
  return () => {
    value += 0x6d2b79f5
    let next = value
    next = Math.imul(next ^ (next >>> 15), next | 1)
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61)
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296
  }
}

function distance(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

function snap(value: number) {
  return Math.round(value / GRID_STEP) * GRID_STEP
}

export function normalizePoint(point: Point): Point {
  return {
    ...point,
    x: Math.max(GRID_STEP, Math.min(FIELD_SIZE - GRID_STEP, snap(point.x))),
    y: Math.max(GRID_STEP, Math.min(FIELD_SIZE - GRID_STEP, snap(point.y))),
  }
}

export function getRectBounds(obstacle: RectObstacle): RectBounds {
  const halfWidth = Math.max(0, obstacle.width) / 2
  const halfHeight = Math.max(0, obstacle.height) / 2
  return {
    minX: obstacle.center.x - halfWidth,
    maxX: obstacle.center.x + halfWidth,
    minY: obstacle.center.y - halfHeight,
    maxY: obstacle.center.y + halfHeight,
  }
}

export function pointRectDistance(
  point: Pick<Point, "x" | "y">,
  obstacle: RectObstacle,
): number {
  const bounds = getRectBounds(obstacle)
  const dx = Math.max(bounds.minX - point.x, 0, point.x - bounds.maxX)
  const dy = Math.max(bounds.minY - point.y, 0, point.y - bounds.maxY)
  return Math.hypot(dx, dy)
}

export function canInsertPoint(
  points: Point[],
  candidate: Point,
  obstacles: RectObstacle[] = [],
) {
  if (
    candidate.x < GRID_STEP ||
    candidate.x > FIELD_SIZE - GRID_STEP ||
    candidate.y < GRID_STEP ||
    candidate.y > FIELD_SIZE - GRID_STEP
  ) {
    return false
  }

  return (
    points.every(
      (point) =>
        point.id === candidate.id ||
        distance(point, candidate) >= TERMINAL_PADDING - EPSILON,
    ) &&
    obstacles.every(
      (obstacle) =>
        pointRectDistance(candidate, obstacle) >=
        REQUIRED_OBSTACLE_CLEARANCE - EPSILON,
    )
  )
}

export function generatePoints(
  count: number,
  seed: number,
  options: { obstacles?: RectObstacle[] } = {},
): Point[] {
  const target = Math.max(1, Math.min(100, Math.round(count)))
  const random = mulberry32(seed)
  const points: Point[] = []
  const insetNodes = 4
  let attempts = 0

  while (points.length < target && attempts < target * 900) {
    attempts += 1
    const gx =
      insetNodes + Math.floor(random() * (GRID_MAX - insetNodes * 2 + 1))
    const gy =
      insetNodes + Math.floor(random() * (GRID_MAX - insetNodes * 2 + 1))
    const candidate = {
      id: points.length,
      x: gx * GRID_STEP,
      y: gy * GRID_STEP,
    }

    if (canInsertPoint(points, candidate, options.obstacles)) {
      points.push(candidate)
    }
  }

  if (points.length < target) {
    const candidates: Point[] = []
    for (let gy = insetNodes; gy <= GRID_MAX - insetNodes; gy += 1) {
      for (let gx = insetNodes; gx <= GRID_MAX - insetNodes; gx += 1) {
        candidates.push({ id: 0, x: gx * GRID_STEP, y: gy * GRID_STEP })
      }
    }

    for (let index = candidates.length - 1; index > 0; index -= 1) {
      const swapWith = Math.floor(random() * (index + 1))
      ;[candidates[index], candidates[swapWith]] = [
        candidates[swapWith],
        candidates[index],
      ]
    }

    for (const candidate of candidates) {
      candidate.id = points.length
      if (canInsertPoint(points, candidate, options.obstacles)) {
        points.push({ ...candidate })
      }
      if (points.length === target) break
    }
  }

  return points
}

function orientation(a: Point, b: Point, c: Point) {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)
}

function onSegment(a: Point, b: Point, p: Point) {
  return (
    p.x >= Math.min(a.x, b.x) - EPSILON &&
    p.x <= Math.max(a.x, b.x) + EPSILON &&
    p.y >= Math.min(a.y, b.y) - EPSILON &&
    p.y <= Math.max(a.y, b.y) + EPSILON
  )
}

function segmentsIntersect(a: Point, b: Point, c: Point, d: Point) {
  const o1 = orientation(a, b, c)
  const o2 = orientation(a, b, d)
  const o3 = orientation(c, d, a)
  const o4 = orientation(c, d, b)

  if (
    ((o1 > EPSILON && o2 < -EPSILON) || (o1 < -EPSILON && o2 > EPSILON)) &&
    ((o3 > EPSILON && o4 < -EPSILON) || (o3 < -EPSILON && o4 > EPSILON))
  ) {
    return true
  }

  if (Math.abs(o1) <= EPSILON && onSegment(a, b, c)) return true
  if (Math.abs(o2) <= EPSILON && onSegment(a, b, d)) return true
  if (Math.abs(o3) <= EPSILON && onSegment(c, d, a)) return true
  if (Math.abs(o4) <= EPSILON && onSegment(c, d, b)) return true
  return false
}

function pointSegmentDistance(point: Point, a: Point, b: Point) {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const lengthSquared = dx * dx + dy * dy
  if (lengthSquared <= EPSILON) return distance(point, a)
  const projection = Math.max(
    0,
    Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSquared),
  )
  return Math.hypot(
    point.x - (a.x + projection * dx),
    point.y - (a.y + projection * dy),
  )
}

function segmentDistance(a: Point, b: Point, c: Point, d: Point) {
  if (segmentsIntersect(a, b, c, d)) return 0
  return Math.min(
    pointSegmentDistance(a, c, d),
    pointSegmentDistance(b, c, d),
    pointSegmentDistance(c, a, b),
    pointSegmentDistance(d, a, b),
  )
}

export function segmentRectDistance(
  a: Point,
  b: Point,
  obstacle: RectObstacle,
): number {
  if (
    pointRectDistance(a, obstacle) <= EPSILON ||
    pointRectDistance(b, obstacle) <= EPSILON
  ) {
    return 0
  }

  const bounds = getRectBounds(obstacle)
  const topLeft = { id: -1, x: bounds.minX, y: bounds.maxY }
  const topRight = { id: -1, x: bounds.maxX, y: bounds.maxY }
  const bottomRight = { id: -1, x: bounds.maxX, y: bounds.minY }
  const bottomLeft = { id: -1, x: bounds.minX, y: bounds.minY }

  return Math.min(
    segmentDistance(a, b, topLeft, topRight),
    segmentDistance(a, b, topRight, bottomRight),
    segmentDistance(a, b, bottomRight, bottomLeft),
    segmentDistance(a, b, bottomLeft, topLeft),
  )
}

function bucketKey(x: number, y: number) {
  return `${x}:${y}`
}

class SegmentIndex {
  private readonly bucketSize = 0.5
  private readonly buckets = new Map<string, Segment[]>()
  private nextSegmentId = 0

  add(routeId: number, a: Point, b: Point) {
    const segment: Segment = {
      id: this.nextSegmentId,
      routeId,
      a,
      b,
    }
    this.nextSegmentId += 1

    const minX = Math.floor(Math.min(a.x, b.x) / this.bucketSize)
    const maxX = Math.floor(Math.max(a.x, b.x) / this.bucketSize)
    const minY = Math.floor(Math.min(a.y, b.y) / this.bucketSize)
    const maxY = Math.floor(Math.max(a.y, b.y) / this.bucketSize)

    for (let bx = minX; bx <= maxX; bx += 1) {
      for (let by = minY; by <= maxY; by += 1) {
        const key = bucketKey(bx, by)
        const bucket = this.buckets.get(key)
        if (bucket) bucket.push(segment)
        else this.buckets.set(key, [segment])
      }
    }
  }

  collides(a: Point, b: Point) {
    const padding = REQUIRED_CENTERLINE_CLEARANCE
    const minX = Math.floor((Math.min(a.x, b.x) - padding) / this.bucketSize)
    const maxX = Math.floor((Math.max(a.x, b.x) + padding) / this.bucketSize)
    const minY = Math.floor((Math.min(a.y, b.y) - padding) / this.bucketSize)
    const maxY = Math.floor((Math.max(a.y, b.y) + padding) / this.bucketSize)
    const seen = new Set<number>()

    for (let bx = minX; bx <= maxX; bx += 1) {
      for (let by = minY; by <= maxY; by += 1) {
        const bucket = this.buckets.get(bucketKey(bx, by))
        if (!bucket) continue
        for (const segment of bucket) {
          if (seen.has(segment.id)) continue
          seen.add(segment.id)
          if (
            segmentDistance(a, b, segment.a, segment.b) <
            REQUIRED_CENTERLINE_CLEARANCE - EPSILON
          ) {
            return true
          }
        }
      }
    }
    return false
  }
}

class TerminalIndex {
  private readonly bucketSize = 0.5
  private readonly buckets = new Map<string, Point[]>()

  constructor(points: Point[]) {
    for (const point of points) {
      const bx = Math.floor(point.x / this.bucketSize)
      const by = Math.floor(point.y / this.bucketSize)
      const key = bucketKey(bx, by)
      const bucket = this.buckets.get(key)
      if (bucket) bucket.push(point)
      else this.buckets.set(key, [point])
    }
  }

  blocksSegment(a: Point, b: Point, activePointId: number) {
    const padding = REQUIRED_CENTERLINE_CLEARANCE
    const minX = Math.floor((Math.min(a.x, b.x) - padding) / this.bucketSize)
    const maxX = Math.floor((Math.max(a.x, b.x) + padding) / this.bucketSize)
    const minY = Math.floor((Math.min(a.y, b.y) - padding) / this.bucketSize)
    const maxY = Math.floor((Math.max(a.y, b.y) + padding) / this.bucketSize)

    for (let bx = minX; bx <= maxX; bx += 1) {
      for (let by = minY; by <= maxY; by += 1) {
        const bucket = this.buckets.get(bucketKey(bx, by))
        if (!bucket) continue
        for (const point of bucket) {
          if (point.id === activePointId) continue
          if (
            pointSegmentDistance(point, a, b) <
            REQUIRED_CENTERLINE_CLEARANCE - EPSILON
          ) {
            return true
          }
        }
      }
    }
    return false
  }
}

class RectObstacleIndex {
  private readonly bucketSize = 0.5
  private readonly buckets = new Map<string, IndexedRectObstacle[]>()

  constructor(private readonly obstacles: RectObstacle[]) {
    for (let index = 0; index < obstacles.length; index += 1) {
      const obstacle = obstacles[index]
      const bounds = getRectBounds(obstacle)
      const minX = Math.floor(bounds.minX / this.bucketSize)
      const maxX = Math.floor(bounds.maxX / this.bucketSize)
      const minY = Math.floor(bounds.minY / this.bucketSize)
      const maxY = Math.floor(bounds.maxY / this.bucketSize)
      const indexedObstacle = { index, obstacle }

      for (let bx = minX; bx <= maxX; bx += 1) {
        for (let by = minY; by <= maxY; by += 1) {
          const key = bucketKey(bx, by)
          const bucket = this.buckets.get(key)
          if (bucket) bucket.push(indexedObstacle)
          else this.buckets.set(key, [indexedObstacle])
        }
      }
    }
  }

  blocksSegment(a: Point, b: Point) {
    if (this.obstacles.length === 0) return false

    const padding = REQUIRED_OBSTACLE_CLEARANCE
    const minX = Math.floor((Math.min(a.x, b.x) - padding) / this.bucketSize)
    const maxX = Math.floor((Math.max(a.x, b.x) + padding) / this.bucketSize)
    const minY = Math.floor((Math.min(a.y, b.y) - padding) / this.bucketSize)
    const maxY = Math.floor((Math.max(a.y, b.y) + padding) / this.bucketSize)
    const seen = new Set<number>()

    for (let bx = minX; bx <= maxX; bx += 1) {
      for (let by = minY; by <= maxY; by += 1) {
        const bucket = this.buckets.get(bucketKey(bx, by))
        if (!bucket) continue
        for (const { index, obstacle } of bucket) {
          if (seen.has(index)) continue
          seen.add(index)
          if (
            segmentRectDistance(a, b, obstacle) <
            REQUIRED_OBSTACLE_CLEARANCE - EPSILON
          ) {
            return true
          }
        }
      }
    }
    return false
  }
}

class MinHeap {
  private values: Array<{ priority: number; state: number }> = []

  get size() {
    return this.values.length
  }

  push(item: { priority: number; state: number }) {
    this.values.push(item)
    let index = this.values.length - 1
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2)
      if (this.values[parent].priority <= item.priority) break
      this.values[index] = this.values[parent]
      index = parent
    }
    this.values[index] = item
  }

  pop() {
    if (this.values.length === 0) return undefined
    const result = this.values[0]
    const tail = this.values.pop()
    if (!tail || this.values.length === 0) return result
    let index = 0
    while (true) {
      const left = index * 2 + 1
      const right = left + 1
      if (left >= this.values.length) break
      let child = left
      if (
        right < this.values.length &&
        this.values[right].priority < this.values[left].priority
      ) {
        child = right
      }
      if (this.values[child].priority >= tail.priority) break
      this.values[index] = this.values[child]
      index = child
    }
    this.values[index] = tail
    return result
  }
}

function gridToPoint(node: GridNode, id = -1): Point {
  return {
    id,
    x: node.gx * GRID_STEP,
    y: node.gy * GRID_STEP,
  }
}

function decodeState(state: number) {
  const direction = state % STATE_DIRECTIONS
  const nodeIndex = Math.floor(state / STATE_DIRECTIONS)
  return {
    direction,
    gx: nodeIndex % GRID_NODES,
    gy: Math.floor(nodeIndex / GRID_NODES),
  }
}

function encodeState(gx: number, gy: number, direction: number) {
  return (gy * GRID_NODES + gx) * STATE_DIRECTIONS + direction
}

function boundaryDistanceGrid(gx: number, gy: number) {
  return Math.min(gx, gy, GRID_MAX - gx, GRID_MAX - gy)
}

function tieNoise(gx: number, gy: number, seed: number) {
  let value = Math.imul(gx + 37, 73856093)
  value ^= Math.imul(gy + 101, 19349663)
  value ^= Math.imul(seed + 17, 83492791)
  return ((value >>> 0) % 997) / 99700000
}

function findEscapePath(
  point: Point,
  segmentIndex: SegmentIndex,
  terminalIndex: TerminalIndex,
  obstacleIndex: RectObstacleIndex,
  seed: number,
) {
  const start = {
    gx: Math.round(point.x / GRID_STEP),
    gy: Math.round(point.y / GRID_STEP),
  }
  const stateCount = GRID_NODES * GRID_NODES * STATE_DIRECTIONS
  const scores = new Float64Array(stateCount)
  scores.fill(Number.POSITIVE_INFINITY)
  const parents = new Int32Array(stateCount)
  parents.fill(-1)
  const heap = new MinHeap()
  const startState = encodeState(start.gx, start.gy, 8)
  scores[startState] = 0
  heap.push({
    state: startState,
    priority: boundaryDistanceGrid(start.gx, start.gy) * GRID_STEP,
  })

  let goalState = -1
  let expansions = 0

  while (heap.size > 0 && expansions < stateCount * 2) {
    const current = heap.pop()
    if (!current) break
    const decoded = decodeState(current.state)
    const knownScore = scores[current.state]
    const expectedPriority =
      knownScore + boundaryDistanceGrid(decoded.gx, decoded.gy) * GRID_STEP
    if (current.priority > expectedPriority + 0.001) continue

    if (
      current.state !== startState &&
      (decoded.gx === 0 ||
        decoded.gy === 0 ||
        decoded.gx === GRID_MAX ||
        decoded.gy === GRID_MAX)
    ) {
      goalState = current.state
      break
    }

    expansions += 1
    const from = gridToPoint(decoded, point.id)

    for (let direction = 0; direction < DIRECTIONS.length; direction += 1) {
      const step = DIRECTIONS[direction]
      const gx = decoded.gx + step.dx
      const gy = decoded.gy + step.dy
      if (gx < 0 || gy < 0 || gx > GRID_MAX || gy > GRID_MAX) continue

      const to = gridToPoint({ gx, gy }, point.id)
      if (segmentIndex.collides(from, to)) continue
      if (terminalIndex.blocksSegment(from, to, point.id)) continue
      if (obstacleIndex.blocksSegment(from, to)) continue

      const nextState = encodeState(gx, gy, direction)
      const stepCost =
        GRID_STEP * (step.dx !== 0 && step.dy !== 0 ? Math.SQRT2 : 1)
      const turnCost =
        decoded.direction === 8 || decoded.direction === direction ? 0 : 0.035
      const nextScore = knownScore + stepCost + turnCost
      if (nextScore + EPSILON >= scores[nextState]) continue

      scores[nextState] = nextScore
      parents[nextState] = current.state
      heap.push({
        state: nextState,
        priority:
          nextScore +
          boundaryDistanceGrid(gx, gy) * GRID_STEP +
          tieNoise(gx, gy, seed),
      })
    }
  }

  if (goalState < 0) return null

  const path: Point[] = []
  let cursor = goalState
  while (cursor >= 0) {
    const decoded = decodeState(cursor)
    path.push(gridToPoint(decoded, point.id))
    if (cursor === startState) break
    cursor = parents[cursor]
  }
  path.reverse()
  path[0] = { ...point }
  return path
}

function compressPath(path: Point[]) {
  if (path.length <= 2) return path
  const compressed = [path[0]]
  let previousDirection = {
    x: Math.sign(path[1].x - path[0].x),
    y: Math.sign(path[1].y - path[0].y),
  }

  for (let index = 1; index < path.length - 1; index += 1) {
    const nextDirection = {
      x: Math.sign(path[index + 1].x - path[index].x),
      y: Math.sign(path[index + 1].y - path[index].y),
    }
    if (
      nextDirection.x !== previousDirection.x ||
      nextDirection.y !== previousDirection.y
    ) {
      compressed.push(path[index])
      previousDirection = nextDirection
    }
  }
  compressed.push(path[path.length - 1])
  return compressed
}

function distanceToBoundary(point: Point) {
  return Math.min(point.x, point.y, FIELD_SIZE - point.x, FIELD_SIZE - point.y)
}

function orderedPoints(points: Point[], attempt: number, seed: number) {
  const ordered = [...points]
  const random = mulberry32(seed + attempt * 7919)

  if (attempt === 0) {
    ordered.sort(
      (a, b) =>
        distanceToBoundary(b) - distanceToBoundary(a) ||
        Math.atan2(a.y - 5, a.x - 5) - Math.atan2(b.y - 5, b.x - 5),
    )
  } else if (attempt === 1) {
    ordered.sort(
      (a, b) =>
        distanceToBoundary(a) - distanceToBoundary(b) ||
        Math.atan2(a.y - 5, a.x - 5) - Math.atan2(b.y - 5, b.x - 5),
    )
  } else if (attempt === 2) {
    ordered.sort(
      (a, b) =>
        distanceToBoundary(b) - distanceToBoundary(a) ||
        a.x + a.y - (b.x + b.y),
    )
  } else {
    for (let index = ordered.length - 1; index > 0; index -= 1) {
      const swapWith = Math.floor(random() * (index + 1))
      ;[ordered[index], ordered[swapWith]] = [ordered[swapWith], ordered[index]]
    }
  }
  return ordered
}

export function runRouteAttempt(
  points: Point[],
  attempt: number,
  seed: number,
  obstacles: RectObstacle[] = [],
): RouteAttemptResult {
  const terminalIndex = new TerminalIndex(points)
  const segmentIndex = new SegmentIndex()
  const obstacleIndex = new RectObstacleIndex(obstacles)
  const routes: Route[] = []
  const unrouted: number[] = []
  const ordered = orderedPoints(points, attempt, seed)

  for (const point of ordered) {
    const path = findEscapePath(
      point,
      segmentIndex,
      terminalIndex,
      obstacleIndex,
      seed + point.id * 131 + attempt * 977,
    )
    if (!path) {
      unrouted.push(point.id)
      continue
    }

    for (let index = 0; index < path.length - 1; index += 1) {
      segmentIndex.add(point.id, path[index], path[index + 1])
    }
    routes.push({ pointId: point.id, path: compressPath(path) })
  }

  routes.sort((a, b) => a.pointId - b.pointId)
  return { routes, unrouted }
}

export function verifyRoutes(
  routes: Route[],
  obstacles: RectObstacle[] = [],
): Verification {
  let intersections = 0
  let invalidAngles = 0
  let offBoundaryEndpoints = 0
  let obstacleCollisions = 0
  let minClearance = Number.POSITIVE_INFINITY
  let minObstacleClearance = Number.POSITIVE_INFINITY

  for (let routeIndex = 0; routeIndex < routes.length; routeIndex += 1) {
    const route = routes[routeIndex]
    const endpoint = route.path.at(-1)
    if (
      !endpoint ||
      (Math.abs(endpoint.x) > EPSILON &&
        Math.abs(endpoint.y) > EPSILON &&
        Math.abs(endpoint.x - FIELD_SIZE) > EPSILON &&
        Math.abs(endpoint.y - FIELD_SIZE) > EPSILON)
    ) {
      offBoundaryEndpoints += 1
    }

    for (let index = 0; index < route.path.length - 1; index += 1) {
      const start = route.path[index]
      const end = route.path[index + 1]
      const dx = Math.abs(end.x - start.x)
      const dy = Math.abs(end.y - start.y)
      const hasLegalAngle =
        dx <= EPSILON || dy <= EPSILON || Math.abs(dx - dy) <= EPSILON
      if (!hasLegalAngle) invalidAngles += 1

      for (const obstacle of obstacles) {
        const clearance = segmentRectDistance(start, end, obstacle)
        minObstacleClearance = Math.min(minObstacleClearance, clearance)
        if (clearance < REQUIRED_OBSTACLE_CLEARANCE - EPSILON) {
          obstacleCollisions += 1
        }
      }
    }

    for (
      let otherIndex = routeIndex + 1;
      otherIndex < routes.length;
      otherIndex += 1
    ) {
      const other = routes[otherIndex]
      for (let a = 0; a < route.path.length - 1; a += 1) {
        for (let b = 0; b < other.path.length - 1; b += 1) {
          const clearance = segmentDistance(
            route.path[a],
            route.path[a + 1],
            other.path[b],
            other.path[b + 1],
          )
          minClearance = Math.min(minClearance, clearance)
          if (clearance <= EPSILON) intersections += 1
        }
      }
    }
  }

  const normalizedClearance = Number.isFinite(minClearance)
    ? minClearance
    : FIELD_SIZE
  const normalizedObstacleClearance = Number.isFinite(minObstacleClearance)
    ? minObstacleClearance
    : FIELD_SIZE
  return {
    intersections,
    invalidAngles,
    offBoundaryEndpoints,
    obstacleCollisions,
    minClearance: normalizedClearance,
    minObstacleClearance: normalizedObstacleClearance,
    valid:
      intersections === 0 &&
      invalidAngles === 0 &&
      offBoundaryEndpoints === 0 &&
      obstacleCollisions === 0 &&
      normalizedClearance >= REQUIRED_CENTERLINE_CLEARANCE - EPSILON &&
      normalizedObstacleClearance >= REQUIRED_OBSTACLE_CLEARANCE - EPSILON,
  }
}

export function solveRoutes(
  input: Point[],
  options: {
    seed?: number
    maxAttempts?: number
    obstacles?: RectObstacle[]
  } = {},
): SolveResult {
  const startedAt = performance.now()
  const points = input.map(normalizePoint)
  const obstacles = options.obstacles ?? []
  const seed = options.seed ?? 815
  const maxAttempts = Math.max(1, options.maxAttempts ?? 7)
  let best = {
    routes: [] as Route[],
    unrouted: points.map((point) => point.id),
  }
  let bestVerification = verifyRoutes([], obstacles)
  let attempts = 0

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    attempts = attempt + 1
    const candidate = runRouteAttempt(points, attempt, seed, obstacles)
    const verification = verifyRoutes(candidate.routes, obstacles)
    if (
      candidate.routes.length > best.routes.length ||
      (candidate.routes.length === best.routes.length &&
        verification.minClearance > bestVerification.minClearance)
    ) {
      best = candidate
      bestVerification = verification
    }

    if (candidate.unrouted.length === 0 && verification.valid) {
      best = candidate
      bestVerification = verification
      break
    }
  }

  const success =
    best.unrouted.length === 0 &&
    best.routes.length === points.length &&
    bestVerification.valid

  return {
    routes: best.routes,
    unrouted: best.unrouted,
    routedCount: best.routes.length,
    attempts,
    elapsedMs: performance.now() - startedAt,
    verification: bestVerification,
    success,
  }
}
