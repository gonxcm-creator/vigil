import { RELICS, type RelicId } from "./relics";
import type { VLang } from "./i18n";

export function runGlyphs(nights: number) {
  const n = Math.max(0, Math.min(12, nights));
  return Array.from({ length: n }, () => "●").join(" ") || "·";
}

export function relicLine(ids: RelicId[], lang: VLang) {
  if (!ids.length) return lang === "es" ? "sin reliquias" : "no relics";
  return ids.map((id) => (lang === "es" ? RELICS[id].nameEs : RELICS[id].nameEn)).join(" · ");
}
