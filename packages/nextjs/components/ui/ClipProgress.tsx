"use client";

import type { ReactNode } from "react";
import { LoadingBar } from "./LoadingBar";

/**
 * Phase-aware progress for the relay's `POST /admin/generate-clips` job.
 *
 * The clipper (clawd-clipper) streams plain stdout lines that the relay wraps
 * as `{phase:"log", line}` NDJSON. There are no percentages in those lines —
 * just `▸ <phase>…` headers and a few `i/N` counters (transcription chunks,
 * `clip i/N`, `[i/N]` pins). We can't get a true byte-percentage, so we
 * approximate: each known phase carries a hand-tuned weight (roughly its share
 * of a cold ~20–30 min run), and within a phase we interpolate off whatever
 * `i/N` counter the clipper happens to print. Progress is clamped monotonic so
 * a skipped/cached phase never makes the bar jump backwards.
 */
export type ClipPhase = {
  key: string;
  label: string;
  /** Matches the clipper's `▸ <phase>…` header line. */
  match: RegExp;
  /** Relative share of total runtime (arbitrary units; summed for the %). */
  weight: number;
};

// Order mirrors clawd-clipper's `src/index.ts` for a full `--vertical --publish`
// run. Weights are eyeballed from the per-phase timings (transcribe + cut are
// the long poles). Optional phases (judge/captions/copy/…) still run on a real
// episode; if one is skipped it just gets marked done when the next header lands.
export const CLIP_PHASES: ClipPhase[] = [
  { key: "resolving", label: "resolving episode", match: /▸\s*resolving/i, weight: 1 },
  { key: "download", label: "downloading video", match: /▸\s*downloading/i, weight: 3 },
  { key: "transcribe", label: "transcribing audio", match: /▸\s*transcrib/i, weight: 8 },
  { key: "candidates", label: "selecting clip candidates", match: /▸\s*selecting clip/i, weight: 4 },
  { key: "judge", label: "adversarial judge re-rank", match: /▸\s*adversarial judge/i, weight: 4 },
  { key: "speakers", label: "attributing speakers", match: /▸\s*attributing speak/i, weight: 2 },
  { key: "captions", label: "correcting captions", match: /▸\s*correcting caption/i, weight: 3 },
  { key: "copy", label: "drafting post copy", match: /▸\s*drafting post/i, weight: 3 },
  { key: "windows", label: "detecting 9:16 windows", match: /▸\s*detecting windows/i, weight: 5 },
  { key: "background", label: "rendering mobile background", match: /▸\s*rendering mobile/i, weight: 1 },
  { key: "cutting", label: "cutting clips", match: /▸\s*cutting clips/i, weight: 8 },
  { key: "publishing", label: "publishing to IPFS", match: /▸\s*publishing/i, weight: 3 },
];

const COUNTER = /(\d+)\s*\/\s*(\d+)/;

export type ClipProgressState = {
  /** Index into CLIP_PHASES; -1 before the first header. */
  phaseIdx: number;
  /** 0–1 progress within the current phase (from `i/N` counters). */
  sub: number;
  /** Last parsed `i/N` counter for the active phase, or null. */
  counter: { i: number; n: number } | null;
  /** Monotonic overall percent, 0–100. */
  overall: number;
  /** Latest meaningful log line (trimmed), for the detail readout. */
  line: string;
  done: boolean;
};

export const initialClipProgress: ClipProgressState = {
  phaseIdx: -1,
  sub: 0,
  counter: null,
  overall: 0,
  line: "",
  done: false,
};

const computeOverall = (phaseIdx: number, sub: number, phases: ClipPhase[]): number => {
  if (phaseIdx < 0) return 0;
  const total = phases.reduce((a, p) => a + p.weight, 0) || 1;
  let before = 0;
  for (let k = 0; k < phaseIdx && k < phases.length; k++) before += phases[k].weight;
  const cur = phases[phaseIdx]?.weight ?? 0;
  return ((before + sub * cur) / total) * 100;
};

/**
 * Fold a single raw clipper log line into the progress state. Pure — returns a
 * new state (or the same reference when the line carries no signal). `phases`
 * defaults to the full publish run; pass CUSTOM_CLIP_PHASES for `--clip-at`.
 */
export const advanceClipProgress = (
  state: ClipProgressState,
  raw: string | undefined,
  phases: ClipPhase[] = CLIP_PHASES,
): ClipProgressState => {
  const line = (raw ?? "").replace(/\s+$/, "");
  if (!line.trim()) return state;

  // `▸ <phase>…` header → advance to that phase (forward-only).
  const idx = phases.findIndex(p => p.match.test(line));
  if (idx >= 0) {
    const phaseIdx = Math.max(state.phaseIdx, idx);
    return {
      ...state,
      phaseIdx,
      sub: 0,
      counter: null,
      overall: Math.max(state.overall, computeOverall(phaseIdx, 0, phases)),
      line: line.trim(),
    };
  }

  // `i/N` counter inside a phase (chunk 3/5, clip 7/12, [3/12]…).
  const m = COUNTER.exec(line);
  if (m && state.phaseIdx >= 0) {
    const i = Number(m[1]);
    const n = Number(m[2]);
    if (n > 0 && i >= 0 && i <= n) {
      const sub = Math.min(1, i / n);
      return {
        ...state,
        sub: Math.max(state.sub, sub),
        counter: { i, n },
        overall: Math.max(state.overall, computeOverall(state.phaseIdx, sub, phases)),
        line: line.trim(),
      };
    }
  }

  // Plain detail line — keep it as the readout, leave progress untouched.
  return { ...state, line: line.trim() };
};

/** Mark the job finished (relay emitted `{phase:"done"}`). */
export const finishClipProgress = (state: ClipProgressState, phases: ClipPhase[] = CLIP_PHASES): ClipProgressState => ({
  ...state,
  phaseIdx: phases.length,
  sub: 1,
  counter: null,
  overall: 100,
  done: true,
});

const MUTED = "var(--slop-text-muted)";
const LIME = "var(--slop-lime, #bcff5b)";
const MAGENTA = "var(--slop-magenta, #ff3ec9)";

export const ClipProgress = ({
  state,
  phases = CLIP_PHASES,
  note,
}: {
  state: ClipProgressState;
  phases?: ClipPhase[];
  /** Optional extra line under the overall bar (e.g. an ETA / elapsed readout). */
  note?: ReactNode;
}) => {
  const pct = Math.round(state.overall);
  const activePhase = state.phaseIdx >= 0 ? phases[state.phaseIdx] : undefined;
  const caption = (
    <span className="slop-mono text-[11px]">
      {pct}%{state.done ? " · done" : activePhase ? ` · ${activePhase.label}` : " · starting…"}
    </span>
  );

  return (
    <div
      className="px-3 py-3 flex flex-col gap-2 w-full"
      style={{ border: "1px dashed rgba(255, 62, 201, 0.35)", background: "rgba(0,0,0,0.25)" }}
    >
      {/* overall, phase-weighted */}
      <LoadingBar cells={28} progress={pct} caption={caption} />

      {note ? (
        <span className="slop-mono text-[11px]" style={{ color: state.done ? LIME : MAGENTA }}>
          {note}
        </span>
      ) : null}

      {/* per-phase checklist */}
      <div className="flex flex-col gap-1 mt-1">
        {phases.map((p, i) => {
          const status = state.done || i < state.phaseIdx ? "done" : i === state.phaseIdx ? "active" : "pending";
          const marker = status === "done" ? "✓" : status === "active" ? "▸" : "·";
          const color = status === "done" ? LIME : status === "active" ? MAGENTA : MUTED;
          return (
            <div key={p.key} className="flex items-center gap-2 slop-mono text-[11px]">
              <span style={{ color, width: "1ch", textAlign: "center", flexShrink: 0 }}>{marker}</span>
              <span style={{ color: status === "pending" ? MUTED : "var(--slop-text)" }}>{p.label}</span>
              {status === "active" && !state.done ? (
                state.counter ? (
                  <LoadingBar
                    cells={10}
                    progress={state.sub * 100}
                    caption={
                      <span className="slop-mono text-[10px]" style={{ color: MUTED }}>
                        {state.counter.i}/{state.counter.n}
                      </span>
                    }
                    style={{ fontSize: 11 }}
                  />
                ) : (
                  // No counter for this phase (LLM/API wait) — keep it alive
                  // with an indeterminate shimmer so it doesn't read as stuck.
                  <LoadingBar cells={10} stepMs={110} caption={<span />} style={{ fontSize: 11 }} />
                )
              ) : null}
            </div>
          );
        })}
      </div>

      {/* latest raw clipper line */}
      {state.line ? (
        <span className="slop-mono text-[10px] break-all mt-1" style={{ color: MUTED }}>
          {state.line}
        </span>
      ) : null}
    </div>
  );
};

export default ClipProgress;
