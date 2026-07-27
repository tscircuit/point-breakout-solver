import {
  BasePipelineSolver,
  BaseSolver,
  definePipelineStep,
  type PipelineStep,
} from "@tscircuit/solver-utils"
import type { GraphicsObject } from "graphics-debug"
import {
  FIELD_SIZE,
  normalizePoint,
  type Point,
  pointRectDistance,
  REQUIRED_CENTERLINE_CLEARANCE,
  REQUIRED_OBSTACLE_CLEARANCE,
  type RectObstacle,
  ROUTE_MARGIN,
  ROUTE_WIDTH,
  type Route,
  runRouteAttempt,
  type SolveResult,
  type Verification,
  verifyRoutes,
} from "./router"

export interface PointBreakoutProblem {
  points: Point[]
  obstacles?: RectObstacle[]
  seed?: number
  maxAttempts?: number
  name?: string
}

export interface TerminalConflict {
  pointA: number
  pointB: number
  distance: number
}

export interface ObstacleConflict {
  pointId: number
  obstacleId: string
  distance: number
}

export interface PreparedPointSet {
  points: Point[]
  obstacles: RectObstacle[]
  terminalConflicts: TerminalConflict[]
  obstacleConflicts: ObstacleConflict[]
}

export interface RoutePointSetOutput {
  routes: Route[]
  unrouted: number[]
  routedCount: number
  attempts: number
  elapsedMs: number
  verification: Verification
}

export interface PointBreakoutOutput extends SolveResult {
  obstacles: RectObstacle[]
  terminalConflicts: TerminalConflict[]
  obstacleConflicts: ObstacleConflict[]
}

function pointDistance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

function visualizePointSet(
  points: Point[],
  routes: Route[] = [],
  status?: string,
  obstacles: RectObstacle[] = [],
): GraphicsObject {
  return {
    lines: [
      {
        points: [
          { x: 0, y: 0 },
          { x: FIELD_SIZE, y: 0 },
          { x: FIELD_SIZE, y: FIELD_SIZE },
          { x: 0, y: FIELD_SIZE },
          { x: 0, y: 0 },
        ],
        strokeColor: "#334155",
        strokeWidth: 0.08,
      },
      ...routes.map((route) => ({
        points: route.path.map(({ x, y }) => ({ x, y })),
        strokeColor: "#0f766e",
        strokeWidth: ROUTE_WIDTH,
        label: `Route ${route.pointId}`,
      })),
    ],
    points: points.map((point) => ({
      x: point.x,
      y: point.y,
      color: "#e11d48",
      label: `P${point.id}`,
    })),
    texts: status
      ? [
          {
            x: 0,
            y: FIELD_SIZE + 0.5,
            text: status,
            fontSize: 12,
            color: "#0f172a",
          },
        ]
      : [],
    rects: obstacles.map((obstacle, index) => ({
      center: obstacle.center,
      width: obstacle.width,
      height: obstacle.height,
      fill: "#f9731633",
      stroke: "#c2410c",
      label: obstacle.id ?? `Obstacle ${index + 1}`,
    })),
    circles: [],
  }
}

export class PreparePointSetSolver extends BaseSolver {
  private readonly normalizedPoints: Point[] = []
  private readonly terminalConflicts: TerminalConflict[] = []
  private readonly obstacleConflicts: ObstacleConflict[] = []
  private nextPointIndex = 0

  constructor(public readonly problem: PointBreakoutProblem) {
    super()
    this.MAX_ITERATIONS = problem.points.length + 1
  }

  override _step(): void {
    const inputPoint = this.problem.points[this.nextPointIndex]
    if (!inputPoint) {
      this.stats = {
        pointCount: this.normalizedPoints.length,
        obstacleCount: this.problem.obstacles?.length ?? 0,
        terminalConflicts: this.terminalConflicts.length,
        obstacleConflicts: this.obstacleConflicts.length,
        fieldSize: FIELD_SIZE,
        routeWidth: ROUTE_WIDTH,
        routeMargin: ROUTE_MARGIN,
      }
      this.solved = true
      return
    }

    const point = normalizePoint(inputPoint)
    for (const other of this.normalizedPoints) {
      const distance = pointDistance(point, other)
      if (distance < REQUIRED_CENTERLINE_CLEARANCE - 1e-7) {
        this.terminalConflicts.push({
          pointA: other.id,
          pointB: point.id,
          distance,
        })
      }
    }
    for (
      let obstacleIndex = 0;
      obstacleIndex < (this.problem.obstacles?.length ?? 0);
      obstacleIndex += 1
    ) {
      const obstacle = this.problem.obstacles![obstacleIndex]
      const distance = pointRectDistance(point, obstacle)
      if (distance < REQUIRED_OBSTACLE_CLEARANCE - 1e-7) {
        this.obstacleConflicts.push({
          pointId: point.id,
          obstacleId: obstacle.id ?? `obstacle-${obstacleIndex}`,
          distance,
        })
      }
    }
    this.normalizedPoints.push(point)
    this.nextPointIndex += 1
  }

  computeProgress(): number {
    return this.problem.points.length === 0
      ? 1
      : this.nextPointIndex / this.problem.points.length
  }

  override getConstructorParams(): [PointBreakoutProblem] {
    return [this.problem]
  }

  override getOutput(): PreparedPointSet {
    return {
      points: [...this.normalizedPoints],
      obstacles: [...(this.problem.obstacles ?? [])],
      terminalConflicts: [...this.terminalConflicts],
      obstacleConflicts: [...this.obstacleConflicts],
    }
  }

  override visualize(): GraphicsObject {
    return visualizePointSet(
      this.normalizedPoints,
      [],
      `Prepare · ${this.normalizedPoints.length}/${this.problem.points.length} points`,
      this.problem.obstacles ?? [],
    )
  }
}

export interface RoutePointSetParams {
  prepared: PreparedPointSet
  seed: number
  maxAttempts: number
}

export class RoutePointSetSolver extends BaseSolver {
  private readonly startedAt = performance.now()
  private bestRoutes: Route[] = []
  private bestUnrouted: number[]
  private bestVerification: Verification
  private attempts = 0

  constructor(public readonly params: RoutePointSetParams) {
    super()
    this.bestUnrouted = params.prepared.points.map((point) => point.id)
    this.bestVerification = verifyRoutes([], params.prepared.obstacles)
    this.MAX_ITERATIONS = params.maxAttempts + 1
  }

  override _step(): void {
    if (this.attempts >= this.params.maxAttempts) {
      this.solved = true
      return
    }

    const candidate = runRouteAttempt(
      this.params.prepared.points,
      this.attempts,
      this.params.seed,
      this.params.prepared.obstacles,
    )
    const verification = verifyRoutes(
      candidate.routes,
      this.params.prepared.obstacles,
    )
    this.attempts += 1

    if (
      candidate.routes.length > this.bestRoutes.length ||
      (candidate.routes.length === this.bestRoutes.length &&
        verification.minClearance > this.bestVerification.minClearance)
    ) {
      this.bestRoutes = candidate.routes
      this.bestUnrouted = candidate.unrouted
      this.bestVerification = verification
    }

    this.stats = {
      attempts: this.attempts,
      routed: this.bestRoutes.length,
      unrouted: this.bestUnrouted.length,
      intersections: this.bestVerification.intersections,
      obstacleCollisions: this.bestVerification.obstacleCollisions,
      minClearance: this.bestVerification.minClearance,
      minObstacleClearance: this.bestVerification.minObstacleClearance,
    }

    if (
      (candidate.unrouted.length === 0 && verification.valid) ||
      this.attempts >= this.params.maxAttempts
    ) {
      if (candidate.unrouted.length === 0 && verification.valid) {
        this.bestRoutes = candidate.routes
        this.bestUnrouted = candidate.unrouted
        this.bestVerification = verification
      }
      this.solved = true
    }
  }

  computeProgress(): number {
    return this.attempts / this.params.maxAttempts
  }

  override getConstructorParams(): [RoutePointSetParams] {
    return [this.params]
  }

  override getOutput(): RoutePointSetOutput {
    return {
      routes: this.bestRoutes,
      unrouted: this.bestUnrouted,
      routedCount: this.bestRoutes.length,
      attempts: this.attempts,
      elapsedMs: performance.now() - this.startedAt,
      verification: this.bestVerification,
    }
  }

  override visualize(): GraphicsObject {
    return visualizePointSet(
      this.params.prepared.points,
      this.bestRoutes,
      `Route · attempt ${this.attempts}/${this.params.maxAttempts} · ${this.bestRoutes.length}/${this.params.prepared.points.length} routed`,
      this.params.prepared.obstacles,
    )
  }
}

export interface VerifyPointBreakoutParams {
  prepared: PreparedPointSet
  routed: RoutePointSetOutput
}

export class VerifyPointBreakoutSolver extends BaseSolver {
  private output: PointBreakoutOutput | null = null

  constructor(public readonly params: VerifyPointBreakoutParams) {
    super()
    this.MAX_ITERATIONS = 2
  }

  override _step(): void {
    const verification = verifyRoutes(
      this.params.routed.routes,
      this.params.prepared.obstacles,
    )
    const success =
      this.params.prepared.terminalConflicts.length === 0 &&
      this.params.prepared.obstacleConflicts.length === 0 &&
      this.params.routed.unrouted.length === 0 &&
      this.params.routed.routes.length === this.params.prepared.points.length &&
      verification.valid

    this.output = {
      ...this.params.routed,
      verification,
      success,
      obstacles: this.params.prepared.obstacles,
      terminalConflicts: this.params.prepared.terminalConflicts,
      obstacleConflicts: this.params.prepared.obstacleConflicts,
    }
    this.stats = {
      success,
      intersections: verification.intersections,
      invalidAngles: verification.invalidAngles,
      offBoundaryEndpoints: verification.offBoundaryEndpoints,
      obstacleCollisions: verification.obstacleCollisions,
      minClearance: verification.minClearance,
      minObstacleClearance: verification.minObstacleClearance,
      terminalConflicts: this.params.prepared.terminalConflicts.length,
      obstacleConflicts: this.params.prepared.obstacleConflicts.length,
    }
    this.solved = true
  }

  override getConstructorParams(): [VerifyPointBreakoutParams] {
    return [this.params]
  }

  override getOutput(): PointBreakoutOutput {
    if (!this.output) {
      throw new Error("VerifyPointBreakoutSolver has not run")
    }
    return this.output
  }

  override visualize(): GraphicsObject {
    return visualizePointSet(
      this.params.prepared.points,
      this.params.routed.routes,
      this.output
        ? `Verify · ${this.output.success ? "valid" : "invalid"} · clearance ${this.output.verification.minClearance.toFixed(3)}`
        : "Verify · waiting",
      this.params.prepared.obstacles,
    )
  }
}

export class PointBreakoutPipelineSolver extends BasePipelineSolver<PointBreakoutProblem> {
  pipelineDef: PipelineStep<BaseSolver>[] = [
    definePipelineStep<
      PreparePointSetSolver,
      PointBreakoutProblem,
      PointBreakoutPipelineSolver
    >("preparePointSetSolver", PreparePointSetSolver, (pipeline) => [
      pipeline.inputProblem,
    ]),
    definePipelineStep<
      RoutePointSetSolver,
      RoutePointSetParams,
      PointBreakoutPipelineSolver
    >("routePointSetSolver", RoutePointSetSolver, (pipeline) => [
      {
        prepared: pipeline.getStageOutput<PreparedPointSet>(
          "preparePointSetSolver",
        )!,
        seed: pipeline.inputProblem.seed ?? 815,
        maxAttempts: Math.max(1, pipeline.inputProblem.maxAttempts ?? 7),
      },
    ]),
    definePipelineStep<
      VerifyPointBreakoutSolver,
      VerifyPointBreakoutParams,
      PointBreakoutPipelineSolver
    >("verifyPointBreakoutSolver", VerifyPointBreakoutSolver, (pipeline) => [
      {
        prepared: pipeline.getStageOutput<PreparedPointSet>(
          "preparePointSetSolver",
        )!,
        routed: pipeline.getStageOutput<RoutePointSetOutput>(
          "routePointSetSolver",
        )!,
      },
    ]),
  ]

  override getConstructorParams(): [PointBreakoutProblem] {
    return [this.inputProblem]
  }

  override getOutput(): PointBreakoutOutput {
    const output = this.getStageOutput<PointBreakoutOutput>(
      "verifyPointBreakoutSolver",
    )
    if (!output) {
      throw new Error("PointBreakoutPipelineSolver has not completed")
    }
    return output
  }

  override initialVisualize(): GraphicsObject {
    return visualizePointSet(
      this.inputProblem.points,
      [],
      this.inputProblem.name ?? "Point breakout problem",
      this.inputProblem.obstacles ?? [],
    )
  }

  override finalVisualize(): GraphicsObject | null {
    const output = this.getStageOutput<PointBreakoutOutput>(
      "verifyPointBreakoutSolver",
    )
    if (!output) return null
    return visualizePointSet(
      this.getStageOutput<PreparedPointSet>("preparePointSetSolver")?.points ??
        this.inputProblem.points,
      output.routes,
      `${output.success ? "Solved" : "Unsolved"} · ${output.routedCount}/${this.inputProblem.points.length} routes`,
      output.obstacles,
    )
  }
}

export function solvePointBreakout(
  problem: PointBreakoutProblem,
): PointBreakoutOutput {
  const solver = new PointBreakoutPipelineSolver(problem)
  solver.solve()
  return solver.getOutput()
}
