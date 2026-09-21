import { mulberry32 } from "./seed";
import type { Guest, GuestSigns, Hands, SignalId } from "./types";

const NAMES: [string, string][] = [
  ["Ira", "Ira"],
  ["Nelo", "Nelo"],
  ["Sira", "Sira"],
  ["Tome", "Tome"],
  ["Luz", "Luz"],
  ["Brais", "Brais"],
  ["Ona", "Ona"],
  ["Ciro", "Ciro"],
  ["Vera", "Vera"],
  ["Iago", "Iago"],
  ["Nuria", "Nuria"],
  ["Roque", "Roque"],
];

const LINES: [string, string][] = [
  ["El agua me llegó a la boca.", "The water reached my mouth."],
  ["Vi la llama desde el banco.", "I saw the flame from the bank."],
  ["No sé nadar. Nunca supe.", "I cannot swim. I never could."],
  ["Mi hermano iba en el otro.", "My brother was on the other one."],
  ["Tengo frío en los dientes.", "I am cold in the teeth."],
  ["Dijiste que subiera.", "You said to come up."],
];

export const SIGNAL_COPY: Record<SignalId, { es: string; en: string }> = {
  noBreath: { es: "No echa vaho en el cristal.", en: "No fog on the glass." },
  water: { es: "El agua le obedece. No salpica.", en: "Water obeys them. It does not splash." },
  hands: { es: "Manos demasiado limpias, o percebes vivos.", en: "Hands too clean, or live barnacles." },
  seeksBeam: { es: "No se aparta del haz. Lo busca.", en: "Does not leave the beam. Seeks it." },
  silent: { es: "Sube en silencio. Sin pies.", en: "Climbs in silence. No feet." },
  echo: { es: "Responde con tu misma frase, un segundo tarde.", en: "Answers with your phrase, a second late." },
};

function handsOf(rng: () => number, visitor: boolean, today: SignalId[]): Hands {
  if (visitor && today.includes("hands")) return rng() < 0.5 ? "clean" : "barnacle";
  if (visitor) return rng() < 0.35 ? "clean" : "earth";
  return rng() < 0.7 ? "earth" : "barnacle";
}

export function makeSigns(visitor: boolean, today: SignalId[], rng: () => number): GuestSigns {
  const hit = (id: SignalId) => visitor && today.includes(id);
  return {
    breath: hit("noBreath") ? false : true,
    splash: hit("water") ? false : true,
    hands: handsOf(rng, visitor, today),
    seeks: hit("seeksBeam") ? true : rng() < 0.12,
    silent: hit("silent") ? true : false,
    echo: hit("echo") ? true : false,
  };
}

export function traitOf(signs: GuestSigns): SignalId {
  if (!signs.breath) return "noBreath";
  if (!signs.splash) return "water";
  if (signs.hands === "clean" || signs.hands === "barnacle") return "hands";
  if (signs.seeks) return "seeksBeam";
  if (signs.silent) return "silent";
  if (signs.echo) return "echo";
  return "hands";
}

export function makeGuest(id: string, visitor: boolean, today: SignalId[], rng: () => number): Guest {
  const name = NAMES[Math.floor(rng() * NAMES.length)];
  const line = LINES[Math.floor(rng() * LINES.length)];
  const signs = makeSigns(visitor, today, rng);
  return {
    id,
    nameEs: name[0],
    nameEn: name[1],
    lineEs: visitor ? "Dijiste que subiera." : line[0],
    lineEn: visitor ? "You said to come up." : line[1],
    kind: visitor ? "visitor" : "human",
    trait: traitOf(signs),
    signs,
    hunger: 1,
  };
}

export function guestCap(lastre: boolean) {
  return lastre ? 4 : 3;
}

export function matchesToday(g: Guest, today: SignalId[]) {
  let n = 0;
  if (today.includes("noBreath") && !g.signs.breath) n += 1;
  if (today.includes("water") && !g.signs.splash) n += 1;
  if (today.includes("hands") && (g.signs.hands === "clean" || g.signs.hands === "barnacle")) n += 1;
  if (today.includes("seeksBeam") && g.signs.seeks) n += 1;
  if (today.includes("silent") && g.signs.silent) n += 1;
  if (today.includes("echo") && g.signs.echo) n += 1;
  return n;
}

export function scriptFromSeed(seed: number, count: number, night: number): { kind: "wreck" | "human" | "visitor" | "prime"; side: "port" | "beam" | "star"; at: number }[] {
  const rng = mulberry32(seed >>> 0);
  const out: { kind: "wreck" | "human" | "visitor" | "prime"; side: "port" | "beam" | "star"; at: number }[] = [];
  const sides: Array<"port" | "beam" | "star"> = ["port", "beam", "star"];
  let t = 2;
  const hasPrime = night >= 8 && rng() < 0.28;
  for (let i = 0; i < count; i++) {
    const r = rng();
    const kind = hasPrime && i === count - 1 ? "prime" : r < 0.32 ? "wreck" : r < 0.62 ? "human" : "visitor";
    out.push({ kind, side: sides[Math.floor(rng() * 3)], at: t });
    t += 14 + rng() * 8;
  }
  return out;
}
