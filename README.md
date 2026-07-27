# point-breakout-solver

A `@tscircuit/solver-utils` pipeline for routing points in a `10 × 10` region
to its boundary with 0°, 45°, and 90° segments.

[Browse the interactive datasets](https://point-breakout-solver.vercel.app)

Routes are `0.10` wide and maintain a `0.10` edge-to-edge margin. The solver
therefore enforces `0.20` minimum centerline clearance.

## Pipeline

`PointBreakoutPipelineSolver` extends `BasePipelineSolver` and exposes three
debuggable stages:

1. `PreparePointSetSolver` snaps input points to the routing grid and identifies
   impossible terminal-spacing conflicts.
2. `RoutePointSetSolver` runs deterministic clearance-aware A* attempts over
   eight legal directions.
3. `VerifyPointBreakoutSolver` checks every route pair, angle, boundary
   endpoint, and clearance before accepting the result.

```ts
import {
  PointBreakoutPipelineSolver,
  generatePoints,
} from "@tscircuit/point-breakout-solver"

const solver = new PointBreakoutPipelineSolver({
  points: generatePoints(50, 815),
  seed: 815,
  maxAttempts: 8,
})

solver.solve()
const result = solver.getOutput()
```

The original functional API remains available through `solveRoutes`,
`verifyRoutes`, and `generatePoints`.

## Dataset browser

The Cosmos page in `pages/point-breakout-solver.page.tsx` uses
`GenericSolverDebugger` and exposes URL-addressable `dataset` and `sample`
parameters. The checked-in catalog contains 15 deterministic random layouts:
three seeds each at 10, 25, 50, 75, and 100 points.

```bash
bun install
bun start
```

## Validate

```bash
bun run typecheck
bun test
bun run benchmark
bun run build:site
```

The benchmark fails unless all 15 layouts route every point with legal angles,
zero intersections, boundary endpoints, and at least `0.20` centerline
clearance.

## License

MIT
