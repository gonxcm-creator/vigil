import { todayClimate } from "./calendar";
import type { ClimateId } from "./types";

export type NodeId = ClimateId | "today";

export interface MapNode {
  id: NodeId;
  x: number;
  y: number;
  nameEs: string;
  nameEn: string;
  blurbEs: string;
  blurbEn: string;
  fog: number;
  rain: boolean;
  swell: number;
  cost: number;
}

export const NODES: MapNode[] = [
  {
    id: "calm",
    x: 0.28,
    y: 0.62,
    nameEs: "Calma",
    nameEn: "Calm",
    blurbEs: "Mar bajo. Se ve el vaho.",
    blurbEn: "Low sea. You can see the fog.",
    fog: 0.08,
    rain: false,
    swell: 0.55,
    cost: 0,
  },
  {
    id: "fog",
    x: 0.52,
    y: 0.36,
    nameEs: "Niebla",
    nameEn: "Fog",
    blurbEs: "Un metro. Solo oyes. El haz recorta.",
    blurbEn: "One meter. You only hear. The beam cuts.",
    fog: 0.78,
    rain: false,
    swell: 0.4,
    cost: 4,
  },
  {
    id: "storm",
    x: 0.76,
    y: 0.58,
    nameEs: "Tormenta",
    nameEn: "Storm",
    blurbEs: "Lluvia. El pecio llega más rápido.",
    blurbEn: "Rain. The wreck comes faster.",
    fog: 0.22,
    rain: true,
    swell: 1.35,
    cost: 4,
  },
];

export function nodeById(id: NodeId) {
  if (id === "today") {
    const c = todayClimate();
    const n = NODES.find((x) => x.id === c) ?? NODES[0];
    return {
      ...n,
      id: "today" as const,
      nameEs: n.nameEs,
      nameEn: n.nameEn,
      blurbEs: "Lo que el mar trae hoy. Mañana ya no está.",
      blurbEn: "What the sea brings today. Tomorrow it is gone.",
      cost: 0,
    };
  }
  return NODES.find((n) => n.id === id) ?? NODES[0];
}

export function weatherOf(node: MapNode, lang: "es" | "en") {
  if (node.fog > 0.5) return lang === "es" ? "Niebla" : "Fog";
  if (node.rain) return lang === "es" ? "Tormenta" : "Storm";
  return lang === "es" ? "Calma" : "Calm";
}
