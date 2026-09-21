import type { RelicId } from "./types";

export type { RelicId };

export interface Relic {
  id: RelicId;
  nameEs: string;
  nameEn: string;
  descEs: string;
  descEn: string;
  hintEs: string;
  hintEn: string;
}

export const RELICS: Record<RelicId, Relic> = {
  farero: {
    id: "farero",
    nameEs: "Farero",
    nameEn: "Keeper",
    descEs: "El foco revela el detalle en 0.7 s.",
    descEn: "Focus reveals the detail in 0.7 s.",
    hintEs: "El foco muerde antes.",
    hintEn: "Focus bites sooner.",
  },
  lastre: {
    id: "lastre",
    nameEs: "Lastre",
    nameEn: "Ballast",
    descEs: "Cabe un huésped más. Llegan menos a la vez.",
    descEn: "One more guest fits. Fewer arrive at once.",
    hintEs: "La cala aguanta a uno más.",
    hintEn: "The cove holds one more.",
  },
  fantasma: {
    id: "fantasma",
    nameEs: "Fantasma",
    nameEn: "Ghost",
    descEs: "El primer error de cada noche no mata.",
    descEn: "The first error each night does not kill.",
    hintEs: "El primer fallo no rompe la roca.",
    hintEn: "The first fault does not break the rock.",
  },
  vidrio: {
    id: "vidrio",
    nameEs: "Vidrio",
    nameEn: "Glass",
    descEs: "Ves el vaho a media distancia sin enfocar.",
    descEn: "You see the fog at mid range without focusing.",
    hintEs: "El vaho se ve sin apretar.",
    hintEn: "The fog shows without squeezing.",
  },
  aceitera: {
    id: "aceitera",
    nameEs: "Aceitera",
    nameEn: "Oilcan",
    descEs: "+20 aceite al alba, una vez.",
    descEn: "+20 oil at dawn, once.",
    hintEs: "La aceitera deja veinte.",
    hintEn: "The can leaves twenty.",
  },
};

export const RELIC_IDS = Object.keys(RELICS) as RelicId[];

export function draftRelics(held: RelicId[], seed: number): RelicId[] {
  let s = seed >>> 0;
  const rand = () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
  const bag = RELIC_IDS.filter((id) => !held.includes(id));
  for (let i = bag.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const t = bag[i];
    bag[i] = bag[j];
    bag[j] = t;
  }
  const out = bag.slice(0, 3);
  while (out.length < 3) {
    const id = RELIC_IDS[out.length % RELIC_IDS.length];
    if (!out.includes(id)) out.push(id);
    else break;
  }
  return out;
}
