"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FIELD_SIZE,
  REQUIRED_CENTERLINE_CLEARANCE,
  ROUTE_MARGIN,
  ROUTE_WIDTH,
  canInsertPoint,
  generatePoints,
  normalizePoint,
  solveRoutes,
  type Point,
  type Route,
  type SolveResult,
} from "../lib/router";

const BENCHMARK_CASES = [10, 25, 50, 75, 100];
const BENCHMARK_TRIALS = 3;

type BenchmarkResult = {
  count: number;
  passes: number;
  trials: number;
  meanMs: number;
  worstMs: number;
  running?: boolean;
};

function formatSeed(seed: number) {
  return String(seed).padStart(4, "0");
}

function drawRoutingField(
  canvas: HTMLCanvasElement,
  points: Point[],
  routes: Route[],
  unrouted: number[],
) {
  const rect = canvas.getBoundingClientRect();
  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.round(rect.width * ratio));
  canvas.height = Math.max(1, Math.round(rect.height * ratio));
  const context = canvas.getContext("2d");
  if (!context) return;
  context.scale(ratio, ratio);

  const width = rect.width;
  const height = rect.height;
  const inset = Math.max(28, Math.min(width, height) * 0.055);
  const size = Math.min(width, height) - inset * 2;
  const left = (width - size) / 2;
  const top = (height - size) / 2;
  const unit = size / FIELD_SIZE;
  const toCanvas = (point: Point) => ({
    x: left + point.x * unit,
    y: top + (FIELD_SIZE - point.y) * unit,
  });

  context.clearRect(0, 0, width, height);
  context.fillStyle = "#11130f";
  context.fillRect(left, top, size, size);

  for (let tick = 0; tick <= FIELD_SIZE * 10; tick += 1) {
    const value = tick / 10;
    const major = tick % 10 === 0;
    const medium = tick % 5 === 0;
    const position = value * unit;
    context.beginPath();
    context.strokeStyle = major
      ? "rgba(239,238,230,.16)"
      : medium
        ? "rgba(239,238,230,.075)"
        : "rgba(239,238,230,.025)";
    context.lineWidth = major ? 1 : 0.5;
    context.moveTo(left + position, top);
    context.lineTo(left + position, top + size);
    context.moveTo(left, top + position);
    context.lineTo(left + size, top + position);
    context.stroke();
  }

  context.strokeStyle = "#f2cf32";
  context.lineWidth = 1.5;
  context.strokeRect(left, top, size, size);

  context.font = "10px var(--font-geist-mono), monospace";
  context.fillStyle = "rgba(239,238,230,.52)";
  context.textAlign = "center";
  for (let index = 0; index <= FIELD_SIZE; index += 1) {
    const position = index * unit;
    context.fillText(String(index), left + position, top + size + 18);
    context.fillText(
      String(FIELD_SIZE - index),
      left - 17,
      top + position + 3,
    );
  }

  for (const route of routes) {
    if (route.path.length < 2) continue;
    context.beginPath();
    route.path.forEach((point, index) => {
      const mapped = toCanvas(point);
      if (index === 0) context.moveTo(mapped.x, mapped.y);
      else context.lineTo(mapped.x, mapped.y);
    });
    context.lineJoin = "miter";
    context.lineCap = "butt";
    context.strokeStyle = "rgba(242,207,50,.13)";
    context.lineWidth = Math.max(3, REQUIRED_CENTERLINE_CLEARANCE * unit);
    context.stroke();
    context.strokeStyle = "#f2cf32";
    context.lineWidth = Math.max(1.5, ROUTE_WIDTH * unit);
    context.stroke();

    const exit = toCanvas(route.path[route.path.length - 1]);
    context.fillStyle = "#c8dc6a";
    context.fillRect(exit.x - 2, exit.y - 2, 4, 4);
  }

  const failed = new Set(unrouted);
  for (const point of points) {
    const mapped = toCanvas(point);
    const isFailed = failed.has(point.id);
    context.beginPath();
    context.arc(mapped.x, mapped.y, isFailed ? 5.5 : 4.5, 0, Math.PI * 2);
    context.fillStyle = isFailed ? "#ff665d" : "#efeee6";
    context.fill();
    context.lineWidth = 2;
    context.strokeStyle = isFailed ? "#ff665d" : "#10110f";
    context.stroke();
  }
}

export default function Home() {
  const [pointCount, setPointCount] = useState(42);
  const [seed, setSeed] = useState(815);
  const [points, setPoints] = useState<Point[]>(() =>
    generatePoints(42, 815),
  );
  const [result, setResult] = useState<SolveResult | null>(null);
  const [status, setStatus] = useState("Ready to route");
  const [benchmark, setBenchmark] = useState<BenchmarkResult[]>([]);
  const [benchmarking, setBenchmarking] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const solve = useCallback((nextPoints: Point[], nextSeed: number) => {
    setStatus("Routing…");
    const next = solveRoutes(nextPoints, {
      seed: nextSeed,
      maxAttempts: 7,
    });
    setResult(next);
    setStatus(
      next.success
        ? `Verified in ${next.attempts} ${next.attempts === 1 ? "pass" : "passes"}`
        : `${next.unrouted.length} point${next.unrouted.length === 1 ? "" : "s"} blocked`,
    );
    return next;
  }, []);

  useEffect(() => {
    solve(points, seed);
    // Initial routing should only run once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const render = () =>
      drawRoutingField(
        canvas,
        points,
        result?.routes ?? [],
        result?.unrouted ?? [],
      );
    render();
    const observer = new ResizeObserver(render);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [points, result]);

  const randomize = () => {
    const nextSeed = seed + 1;
    const nextPoints = generatePoints(pointCount, nextSeed);
    setSeed(nextSeed);
    setPoints(nextPoints);
    solve(nextPoints, nextSeed);
  };

  const updatePointCount = (count: number) => {
    setPointCount(count);
    const nextPoints = generatePoints(count, seed);
    setPoints(nextPoints);
    solve(nextPoints, seed);
  };

  const handleCanvasClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (benchmarking) return;
    const canvas = event.currentTarget;
    const rect = canvas.getBoundingClientRect();
    const inset = Math.max(28, Math.min(rect.width, rect.height) * 0.055);
    const size = Math.min(rect.width, rect.height) - inset * 2;
    const left = (rect.width - size) / 2;
    const top = (rect.height - size) / 2;
    const rawX = ((event.clientX - rect.left - left) / size) * FIELD_SIZE;
    const rawY =
      FIELD_SIZE -
      ((event.clientY - rect.top - top) / size) * FIELD_SIZE;
    if (rawX < 0 || rawX > FIELD_SIZE || rawY < 0 || rawY > FIELD_SIZE) return;

    const nearest = points.find(
      (point) => Math.hypot(point.x - rawX, point.y - rawY) < 0.18,
    );
    if (nearest) {
      const nextPoints = points
        .filter((point) => point.id !== nearest.id)
        .map((point, index) => ({ ...point, id: index }));
      setPoints(nextPoints);
      setPointCount(nextPoints.length);
      solve(nextPoints, seed);
      return;
    }

    if (points.length >= 100) {
      setStatus("Point limit reached");
      return;
    }
    const candidate = normalizePoint({
      id: points.length,
      x: rawX,
      y: rawY,
    });
    if (!canInsertPoint(points, candidate)) {
      setStatus("Point needs 0.24 clearance");
      return;
    }
    const nextPoints = [...points, candidate];
    setPoints(nextPoints);
    setPointCount(nextPoints.length);
    solve(nextPoints, seed);
  };

  const runBenchmark = async () => {
    if (benchmarking) return;
    setBenchmarking(true);
    setBenchmark([]);
    setStatus("Running 15 seeded trials…");

    const completed: BenchmarkResult[] = [];
    for (const count of BENCHMARK_CASES) {
      setBenchmark([
        ...completed,
        {
          count,
          passes: 0,
          trials: BENCHMARK_TRIALS,
          meanMs: 0,
          worstMs: 0,
          running: true,
        },
      ]);
      await new Promise((resolve) => window.setTimeout(resolve, 24));

      const times: number[] = [];
      let passes = 0;
      for (let trial = 0; trial < BENCHMARK_TRIALS; trial += 1) {
        const trialSeed = seed + count * 97 + trial * 104729;
        const trialPoints = generatePoints(count, trialSeed);
        const trialResult = solveRoutes(trialPoints, {
          seed: trialSeed,
          maxAttempts: 8,
        });
        times.push(trialResult.elapsedMs);
        if (trialResult.success) passes += 1;
        await new Promise((resolve) => window.setTimeout(resolve, 8));
      }

      completed.push({
        count,
        passes,
        trials: BENCHMARK_TRIALS,
        meanMs: times.reduce((sum, value) => sum + value, 0) / times.length,
        worstMs: Math.max(...times),
      });
      setBenchmark([...completed]);
    }

    const allPass = completed.every((item) => item.passes === item.trials);
    setStatus(allPass ? "Benchmark verified 15/15" : "Benchmark found a hard case");
    setBenchmarking(false);
  };

  const metrics = useMemo(() => {
    const minClearance = result?.verification.minClearance ?? FIELD_SIZE;
    return [
      {
        label: "ROUTED",
        value: `${result?.routedCount ?? 0}/${points.length}`,
        detail: result?.success ? "complete" : "best effort",
      },
      {
        label: "INTERSECTIONS",
        value: String(result?.verification.intersections ?? 0),
        detail: "exact segment test",
      },
      {
        label: "MIN CLEARANCE",
        value: `${Math.min(minClearance, 9.99).toFixed(2)}`,
        detail: `required ${REQUIRED_CENTERLINE_CLEARANCE.toFixed(2)}`,
      },
      {
        label: "SOLVE TIME",
        value: `${(result?.elapsedMs ?? 0).toFixed(0)}ms`,
        detail: `${result?.attempts ?? 0} search passes`,
      },
    ];
  }, [points.length, result]);

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#routing-field" aria-label="Boundary Router">
          <span className="brand-mark" aria-hidden="true">
            BR
          </span>
          <span>
            <strong>BOUNDARY / ROUTER</strong>
            <small>OCTILINEAR ESCAPE LAB</small>
          </span>
        </a>
        <div className="rule-set" aria-label="Routing constraints">
          <span>10×10 FIELD</span>
          <span>0° · 45° · 90°</span>
          <span>W 0.10</span>
          <span>GAP 0.10</span>
        </div>
        <div
          className={`solver-status ${result?.success ? "is-good" : ""}`}
          aria-live="polite"
        >
          <i aria-hidden="true" />
          {status}
        </div>
      </header>

      <section className="intro">
        <div>
          <p className="eyebrow">CONSTRAINED GEOMETRY / LIVE SOLVER</p>
          <h1>Find every point a clean way out.</h1>
        </div>
        <p>
          A clearance-aware octilinear maze router sends each point to the
          boundary, then independently verifies every segment pair. Click the
          field to add a point; click a point to remove it.
        </p>
      </section>

      <section className="workspace">
        <div className="field-panel" id="routing-field">
          <div className="panel-heading">
            <span>ROUTING FIELD / 10.00 × 10.00</span>
            <span>{points.length} TERMINALS</span>
          </div>
          <div className="canvas-wrap">
            <canvas
              ref={canvasRef}
              onClick={handleCanvasClick}
              aria-label={`10 by 10 routing field with ${points.length} points and ${result?.routedCount ?? 0} non-intersecting routes`}
            />
            <div className="clearance-key">
              <span>
                <i className="route-swatch" /> ROUTE {ROUTE_WIDTH.toFixed(2)}
              </span>
              <span>
                <i className="clearance-swatch" /> MARGIN{" "}
                {ROUTE_MARGIN.toFixed(2)}
              </span>
            </div>
          </div>
          <div className="field-footer">
            <span>CLICK EMPTY SPACE TO INSERT</span>
            <span>CLICK POINT TO REMOVE</span>
            <span>SNAP 0.10</span>
          </div>
        </div>

        <aside className="control-rail" aria-label="Routing controls">
          <div className="rail-heading">
            <span>RUN CONTROL</span>
            <span>SEED {formatSeed(seed)}</span>
          </div>

          <div className="control-block">
            <label htmlFor="point-count">
              <span>POINT COUNT</span>
              <strong>{pointCount}</strong>
            </label>
            <input
              id="point-count"
              type="range"
              min="10"
              max="100"
              step="1"
              value={pointCount}
              disabled={benchmarking}
              onChange={(event) => updatePointCount(Number(event.target.value))}
            />
            <div className="range-labels" aria-hidden="true">
              <span>10</span>
              <span>100</span>
            </div>
          </div>

          <div className="seed-row">
            <label htmlFor="seed-input">RANDOM SEED</label>
            <input
              id="seed-input"
              type="number"
              min="1"
              max="999999"
              value={seed}
              disabled={benchmarking}
              onChange={(event) =>
                setSeed(Math.max(1, Number(event.target.value) || 1))
              }
            />
          </div>

          <div className="button-stack">
            <button type="button" onClick={randomize} disabled={benchmarking}>
              <span>RANDOMIZE POINTS</span>
              <kbd>R</kbd>
            </button>
            <button
              className="primary-action"
              type="button"
              onClick={() => solve(points, seed)}
              disabled={benchmarking}
            >
              <span>ROUTE ALL</span>
              <span aria-hidden="true">↗</span>
            </button>
          </div>

          <div className="metrics">
            {metrics.map((metric) => (
              <div className="metric" key={metric.label}>
                <span>{metric.label}</span>
                <strong>{metric.value}</strong>
                <small>{metric.detail}</small>
              </div>
            ))}
          </div>

          <div className="constraint-checks">
            <p>VERIFICATION</p>
            <span className={result?.success ? "pass" : ""}>
              <i>{result?.success ? "✓" : "—"}</i> no route intersections
            </span>
            <span className={result?.verification.valid ? "pass" : ""}>
              <i>{result?.verification.valid ? "✓" : "—"}</i> 0.20 centerline
              separation
            </span>
            <span className={result?.success ? "pass" : ""}>
              <i>{result?.success ? "✓" : "—"}</i> boundary termination
            </span>
          </div>
        </aside>
      </section>

      <section className="benchmark-panel" aria-labelledby="benchmark-title">
        <div className="benchmark-copy">
          <p className="eyebrow">RESILIENCE SUITE / SEEDED RANDOM INSERTION</p>
          <h2 id="benchmark-title">15 trials. Five densities. Exact checks.</h2>
          <p>
            Three fresh point sets at 10, 25, 50, 75, and 100 terminals. Every
            pass must route all points, reach the boundary, preserve the 0.10
            margin, and report zero crossings.
          </p>
          <button
            className="benchmark-action"
            type="button"
            onClick={runBenchmark}
            disabled={benchmarking}
          >
            <span>{benchmarking ? "BENCHMARKING…" : "RUN 15-TRIAL BENCHMARK"}</span>
            <span aria-hidden="true">▶</span>
          </button>
        </div>

        <div className="benchmark-results" aria-live="polite">
          {BENCHMARK_CASES.map((count) => {
            const item = benchmark.find((entry) => entry.count === count);
            const passed = item && item.passes === item.trials;
            return (
              <article
                key={count}
                className={`${item?.running ? "is-running" : ""} ${passed ? "has-passed" : ""}`}
              >
                <div>
                  <span>CASE</span>
                  <strong>{count}</strong>
                  <small>POINTS</small>
                </div>
                <div className="case-meter">
                  <i
                    style={{
                      width: item
                        ? `${Math.max(8, (item.passes / item.trials) * 100)}%`
                        : "0%",
                    }}
                  />
                </div>
                <footer>
                  <span>
                    {item?.running
                      ? "RUNNING"
                      : item
                        ? `${item.passes}/${item.trials} PASS`
                        : "QUEUED"}
                  </span>
                  <span>{item ? `${item.meanMs.toFixed(0)}ms avg` : "—"}</span>
                </footer>
              </article>
            );
          })}
        </div>
      </section>

      <footer className="page-footer">
        <span>BOUNDARY / ROUTER — DEMONSTRATION BUILD</span>
        <span>GRID SEARCH + SEGMENT-PAIR VERIFICATION</span>
      </footer>
    </main>
  );
}
