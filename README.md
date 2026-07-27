# point-breakout-solver

An octilinear breakout router for connecting points inside a rectangular region
to its boundary without route intersections.

[Open the interactive demo](https://octilinear-boundary-router-lab.seveibar.chatgpt.site)

The included reference configuration uses a `10 × 10` field, `0.10`-wide
routes, and a `0.10` edge-to-edge margin. Because the routes are `0.10` wide,
the solver enforces a minimum `0.20` centerline separation.

## What is included

- A reusable, dependency-free TypeScript routing engine in `lib/`
- An interactive visualization for adding, removing, randomizing, and routing
  up to 100 points
- Exact segment-pair verification for crossings and minimum clearance
- A reproducible 15-trial benchmark covering 10, 25, 50, 75, and 100 points
- A Cloudflare-compatible vinext demo application

## Algorithm

The solver snaps terminals to a `0.10` lattice and uses a clearance-aware A*
search with eight legal movement directions:

```text
0°, 45°, 90°, 135°, 180°, 225°, 270°, 315°
```

Previously accepted unit segments are stored in a spatial bucket index.
Candidate moves are checked against those segments using exact Euclidean
segment distance, rather than grid occupancy alone. Multiple terminal orderings
are attempted to recover from greedy dead ends. A separate verification pass
then checks every pair of output routes.

Some point sets are geometrically impossible—for example, terminals whose
starting separation is below the required route clearance. Those cases are
reported through `success: false` and `unrouted`.

## Library usage

```ts
import {
  generatePoints,
  solveRoutes,
  verifyRoutes,
} from "@tscircuit/point-breakout-solver"

const points = generatePoints(50, 815)
const result = solveRoutes(points, {
  seed: 815,
  maxAttempts: 8,
})

if (!result.success) {
  console.log("Unrouted terminal ids:", result.unrouted)
}

console.log(verifyRoutes(result.routes))
```

The primary exports are:

- `generatePoints(count, seed)`
- `solveRoutes(points, options)`
- `verifyRoutes(routes)`
- `canInsertPoint(points, candidate)`
- `normalizePoint(point)`
- Field, route-width, margin, and required-clearance constants

## Run locally

Requires Node.js `>=22.13.0`.

```bash
npm install
npm run dev
```

Then open `http://localhost:3000`.

## Benchmark

```bash
npm run benchmark
```

The benchmark generates three deterministic random layouts at each density and
fails with a non-zero exit code unless every terminal is routed to the boundary
with zero intersections and the required clearance.

The checked-in implementation passes all 15 seeded cases, including three
independent 100-point layouts.

## Validation

```bash
npm run lint
npm test
npm run benchmark
```

## License

MIT
