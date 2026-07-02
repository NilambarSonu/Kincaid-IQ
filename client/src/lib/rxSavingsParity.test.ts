import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

import { RX_PROVISION_PMPY } from "./pdfReports";

// ─────────────────────────────────────────────────────────────────────────────
// Cross-language parity test for the Rx Defense PMPY exposure model.
//
// The client mirror (RX_PROVISION_PMPY in ./pdfReports.ts) duplicates the backend
// _PROVISION_EXPOSURE_PMPY map (backend/routers/rx_defense.py) that drives every
// modeled savings/exposure figure (member_count × PMPY × risk_fraction). If one
// side changes without the other, the on-screen Savings Report and PDF would
// silently show different numbers than the server — which is exactly the drift
// that once left inflated savings on screen after the backend was recalibrated.
//
// This test reads the backend map directly via a Python subprocess and asserts
// the two tables are IDENTICAL (same IDs, same PMPY values).
// ─────────────────────────────────────────────────────────────────────────────

const RX_DEFENSE_PY = resolve(import.meta.dirname, "../../../backend/routers/rx_defense.py");

function findPython(): string | null {
  for (const cmd of ["python3", "python"]) {
    const probe = spawnSync(cmd, ["--version"], { encoding: "utf8" });
    if (probe.status === 0 || probe.stdout || probe.stderr) {
      if (!probe.error) return cmd;
    }
  }
  return null;
}

test("frontend RX_PROVISION_PMPY matches backend _PROVISION_EXPOSURE_PMPY", () => {
  const py = findPython();
  if (!py) {
    // Python unavailable in this environment — skip rather than false-fail.
    return;
  }

  const script = [
    "import importlib.util, json, os",
    `spec = importlib.util.spec_from_file_location('rxd', ${JSON.stringify(RX_DEFENSE_PY)})`,
    "mod = importlib.util.module_from_spec(spec)",
    "spec.loader.exec_module(mod)",
    "print(json.dumps({str(k): v['pmpy'] for k, v in mod._PROVISION_EXPOSURE_PMPY.items()}))",
  ].join("\n");

  const res = spawnSync(py, ["-c", script], { encoding: "utf8" });
  assert.equal(res.status, 0, `python failed: ${res.stderr}`);

  const backend = JSON.parse(res.stdout.trim()) as Record<string, number>;
  const frontend: Record<string, number> = {};
  for (const [k, v] of Object.entries(RX_PROVISION_PMPY)) frontend[String(k)] = v;

  assert.deepEqual(
    frontend,
    backend,
    "Rx PMPY tables drifted — update RX_PROVISION_PMPY (pdfReports.ts) and " +
      "_PROVISION_EXPOSURE_PMPY (rx_defense.py) together so savings stay consistent.",
  );
});
