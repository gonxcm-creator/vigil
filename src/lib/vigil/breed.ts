export type FiendKind = "crawl" | "dash" | "wail" | "wing" | "prime";

export interface Breed {
  spd: number;
  hp: number;
  size: number;
  kind: FiendKind;
}

export const FIEND_KINDS: FiendKind[] = ["crawl", "dash", "wail", "wing", "prime"];

export const DEFAULT_BREED: Breed = { spd: 1, hp: 1, size: 1, kind: "crawl" };

export function slidersToBreed(spd: number, hp: number, size: number, kind: FiendKind): Breed {
  return {
    spd: 0.42 + (spd / 100) * 1.7,
    hp: 0.5 + (hp / 100) * 2.3,
    size: 0.62 + (size / 100) * 1.3,
    kind,
  };
}

export function kindLabel(kind: FiendKind, lang: "es" | "en") {
  const es: Record<FiendKind, string> = {
    crawl: "Rastrero",
    dash: "Raudo",
    wail: "Lamento",
    wing: "Alado",
    prime: "Primigenio",
  };
  const en: Record<FiendKind, string> = {
    crawl: "Crawler",
    dash: "Dasher",
    wail: "Wailer",
    wing: "Winged",
    prime: "Primordial",
  };
  return lang === "en" ? en[kind] : es[kind];
}

export function kindBlurb(kind: FiendKind, lang: "es" | "en") {
  const es: Record<FiendKind, string> = {
    crawl: "El común. Sube la roca. Quémalo.",
    dash: "Rápido. Poca carne. No le des tiempo.",
    wail: "Lento. Grita. El haz tiembla.",
    wing: "No toca el agua. Baja en diagonal.",
    prime: "El que espera al final. Mucha carne.",
  };
  const en: Record<FiendKind, string> = {
    crawl: "The common one. Climbs. Burn it.",
    dash: "Fast. Thin. Do not give it time.",
    wail: "Slow. It screams. The beam shivers.",
    wing: "It does not touch water. It dives.",
    prime: "The one that waits. Thick hide.",
  };
  return lang === "en" ? en[kind] : es[kind];
}
