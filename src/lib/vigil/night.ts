import { mulberry32 } from "./seed";
import { scriptFromSeed } from "./guests";
import type { MapNode } from "./world";
import type { Diff, PlayKind, SpawnSpec } from "./types";

export interface Night {
  key: string;
  nameEs: string;
  nameEn: string;
  fog: number;
  rain: boolean;
  swell: number;
  moon: number;
  duration: number;
  script: SpawnSpec[];
  oilMul: number;
}

export function countFor(diff: Diff, nightIndex: number, lastre: boolean) {
  if (diff === "easy") return 3;
  if (diff === "hard") return Math.min(7, 5 + Math.floor(nightIndex / 4));
  const n = Math.min(6, 4 + Math.floor((nightIndex - 1) / 3));
  return lastre ? Math.max(3, n - 1) : n;
}

function stamp(script: SpawnSpec[]) {
  const n = Math.max(1, script.length);
  const gap = Math.min(20, 80 / Math.max(1, n - 1));
  return script.map((s, i) => ({ ...s, at: 2 + i * gap }));
}

export function makeVigil(opts: {
  node: MapNode;
  nightIndex: number;
  seed: number;
  kind: PlayKind;
  diff: Diff;
  lastre: boolean;
  practice?: SpawnSpec[];
}): Night {
  const { node, nightIndex, seed, kind, diff, lastre, practice } = opts;
  const rng = mulberry32(seed >>> 0);
  const n = kind === "tutorial" ? 3 : kind === "practice" ? (practice?.length ?? 5) : countFor(diff, nightIndex, lastre);
  const raw: SpawnSpec[] =
    kind === "tutorial"
      ? [
          { kind: "wreck", side: "star", at: 2 },
          { kind: "visitor", side: "beam", at: 14 },
          { kind: "wreck", side: "port", at: 28 },
        ]
      : kind === "practice" && practice
        ? practice
        : nightIndex === 1
          ? [
              { kind: "wreck", side: "beam", at: 2 },
              { kind: "human", side: "port", at: 22 },
              { kind: "visitor", side: "beam", at: 42 },
              { kind: "wreck", side: "star", at: 62 },
            ]
          : scriptFromSeed(seed, n, nightIndex);
  const script = kind === "tutorial" || kind === "practice" ? raw : stamp(raw);
  const duration = kind === "tutorial" ? 90 : Math.min(480, 220 + script.length * 30);
  return {
    key: `${kind}:${node.id}:${nightIndex}:${seed}`,
    nameEs: node.nameEs,
    nameEn: node.nameEn,
    fog: node.fog,
    rain: node.rain,
    swell: node.swell,
    moon: 0.2 + rng() * 0.7,
    duration,
    script,
    oilMul: (diff === "hard" ? 1.3 : 1) * (kind === "tutorial" ? 0.55 : 1),
  };
}
