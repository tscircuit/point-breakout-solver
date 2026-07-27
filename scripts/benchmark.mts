import {
  REQUIRED_CENTERLINE_CLEARANCE,
  generatePoints,
  solveRoutes,
} from "../lib/router.ts";

const CASES = [10, 25, 50, 75, 100];
const TRIALS = 3;
const BASE_SEED = 815;
let failed = false;

console.log(
  `BOUNDARY / ROUTER resilience benchmark — ${TRIALS} seeded trials per case`,
);
console.log(
  `Required centerline clearance: ${REQUIRED_CENTERLINE_CLEARANCE.toFixed(2)}`,
);

for (const count of CASES) {
  const times: number[] = [];
  let passes = 0;

  for (let trial = 0; trial < TRIALS; trial += 1) {
    const seed = BASE_SEED + count * 97 + trial * 104729;
    const points = generatePoints(count, seed);
    const result = solveRoutes(points, { seed, maxAttempts: 8 });
    times.push(result.elapsedMs);
    if (result.success) passes += 1;
  }

  const mean = times.reduce((sum, value) => sum + value, 0) / times.length;
  const worst = Math.max(...times);
  const status = passes === TRIALS ? "PASS" : "FAIL";
  if (status === "FAIL") failed = true;
  console.log(
    `${String(count).padStart(3)} points  ${status} ${passes}/${TRIALS}  mean ${mean.toFixed(1)}ms  worst ${worst.toFixed(1)}ms`,
  );
}

if (failed) {
  process.exitCode = 1;
}
