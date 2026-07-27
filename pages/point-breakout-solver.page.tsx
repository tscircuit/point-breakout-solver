import { GenericSolverDebugger } from "@tscircuit/solver-utils/react"
import { pointBreakoutDatasets } from "datasets"
import { PointBreakoutPipelineSolver } from "lib/point-breakout-pipeline-solver"
import {
  FIELD_SIZE,
  REQUIRED_CENTERLINE_CLEARANCE,
  ROUTE_MARGIN,
  ROUTE_WIDTH,
} from "lib/router"
import { type CSSProperties, useEffect, useState } from "react"

const buttonStyle: CSSProperties = {
  border: "1px solid #cbd5e1",
  borderRadius: 8,
  background: "#ffffff",
  color: "#0f172a",
  cursor: "pointer",
  font: "inherit",
  padding: "8px 12px",
}

export default function PointBreakoutSolverPage() {
  const [selectedDatasetIndex, setSelectedDatasetIndex] = useState(0)
  const [selectedSampleIndex, setSelectedSampleIndex] = useState(0)
  const selectedDataset = pointBreakoutDatasets[selectedDatasetIndex]!
  const selectedSample = selectedDataset.samples[selectedSampleIndex]!

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const datasetIndex = pointBreakoutDatasets.findIndex(
      (dataset) => dataset.id === params.get("dataset"),
    )
    const resolvedDatasetIndex = datasetIndex >= 0 ? datasetIndex : 0
    const sampleIndex = pointBreakoutDatasets[
      resolvedDatasetIndex
    ]!.samples.findIndex((sample) => sample.id === params.get("sample"))

    setSelectedDatasetIndex(resolvedDatasetIndex)
    setSelectedSampleIndex(sampleIndex >= 0 ? sampleIndex : 0)
  }, [])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    params.set("dataset", selectedDataset.id)
    params.set("sample", selectedSample.id)
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}?${params.toString()}`,
    )
    document.title = `${selectedSample.name} · Point Breakout Solver`
  }, [selectedDataset.id, selectedSample.id, selectedSample.name])

  const selectDataset = (index: number) => {
    if (index < 0 || index >= pointBreakoutDatasets.length) return
    setSelectedDatasetIndex(index)
    setSelectedSampleIndex(0)
  }

  const selectSample = (index: number) => {
    if (index < 0 || index >= selectedDataset.samples.length) return
    setSelectedSampleIndex(index)
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f8fafc",
        color: "#0f172a",
        fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
      }}
    >
      <header
        style={{
          borderBottom: "1px solid #e2e8f0",
          background: "#ffffff",
          display: "grid",
          gap: 12,
          padding: 16,
        }}
      >
        <div
          style={{
            alignItems: "center",
            display: "flex",
            flexWrap: "wrap",
            gap: 12,
            justifyContent: "space-between",
          }}
        >
          <div>
            <strong>
              Point Breakout Solver · {selectedDataset.id} ·{" "}
              {selectedDataset.name}
            </strong>
            <div style={{ color: "#475569", fontSize: 13, marginTop: 4 }}>
              {selectedSample.name} · seed {selectedSample.seed} · {FIELD_SIZE}×
              {FIELD_SIZE} boundary
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              onClick={() => selectSample(selectedSampleIndex - 1)}
              disabled={selectedSampleIndex === 0}
              style={{
                ...buttonStyle,
                cursor: selectedSampleIndex === 0 ? "not-allowed" : "pointer",
                opacity: selectedSampleIndex === 0 ? 0.45 : 1,
              }}
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => selectSample(selectedSampleIndex + 1)}
              disabled={
                selectedSampleIndex === selectedDataset.samples.length - 1
              }
              style={{
                ...buttonStyle,
                cursor:
                  selectedSampleIndex === selectedDataset.samples.length - 1
                    ? "not-allowed"
                    : "pointer",
                opacity:
                  selectedSampleIndex === selectedDataset.samples.length - 1
                    ? 0.45
                    : 1,
              }}
            >
              Next
            </button>
          </div>
        </div>

        <div
          aria-label="Point breakout datasets"
          role="tablist"
          style={{ display: "flex", flexWrap: "wrap", gap: 8 }}
        >
          {pointBreakoutDatasets.map((dataset, index) => {
            const isSelected = selectedDatasetIndex === index
            return (
              <button
                aria-selected={isSelected}
                key={dataset.id}
                onClick={() => selectDataset(index)}
                role="tab"
                style={{
                  ...buttonStyle,
                  background: isSelected ? "#0f172a" : "#ffffff",
                  color: isSelected ? "#ffffff" : "#0f172a",
                }}
                type="button"
              >
                {dataset.id} · {dataset.name}
              </button>
            )
          })}
        </div>

        <div style={{ color: "#475569", fontSize: 13 }}>
          {selectedDataset.description}
        </div>

        <div
          aria-label={`${selectedDataset.id} samples`}
          role="tablist"
          style={{ display: "flex", flexWrap: "wrap", gap: 8 }}
        >
          {selectedDataset.samples.map((sample, index) => {
            const isSelected = selectedSampleIndex === index
            return (
              <button
                aria-selected={isSelected}
                key={sample.id}
                onClick={() => selectSample(index)}
                role="tab"
                style={{
                  ...buttonStyle,
                  background: isSelected ? "#0f172a" : "#ffffff",
                  color: isSelected ? "#ffffff" : "#0f172a",
                }}
                type="button"
              >
                {sample.pointCount} points · seed {sample.seed}
              </button>
            )
          })}
        </div>

        <div style={{ color: "#475569", fontSize: 13 }}>
          {selectedSample.description} Routes are {ROUTE_WIDTH.toFixed(1)} wide
          with a {ROUTE_MARGIN.toFixed(1)} margin, so the debugger verifies{" "}
          {REQUIRED_CENTERLINE_CLEARANCE.toFixed(1)} centerline clearance.
        </div>
      </header>

      <GenericSolverDebugger
        key={`${selectedDataset.id}:${selectedSample.id}`}
        createSolver={() =>
          new PointBreakoutPipelineSolver(selectedSample.problem)
        }
        animationSpeed={80}
      />
    </div>
  )
}
