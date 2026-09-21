import { playCap, sfxFlare, sfxGear, sfxLost, sfxSave, sfxSweep, sfxWarn, setTension } from "./audio";
import { makeGuest, SIGNAL_COPY } from "./guests";
import type { Night } from "./night";
import { haptic } from "./safe";
import { hashStr, mulberry32 } from "./seed";
import type { BodyKind, Dist, Guest, NightLog, PlayKind, RelicId, Side, SignalId } from "./types";

export type RunMode = "idle" | "play";
export type { PlayKind };

export interface Hud {
  integrity: number;
  oil: number;
  judged: number;
  quota: number;
  flares: number;
  side: Side;
  dist: Dist;
  hint: string;
  reveal: string;
  result: null | "won" | "lost";
  heading: number;
  beat: number;
  canSkip: boolean;
  timeLeft: number;
  threat: boolean;
  wreckPlus: string;
}

export interface EngineOpts {
  reducedMotion: boolean;
  muted: boolean;
  kind?: PlayKind;
  oil: number;
  flares: number;
  integrity: number;
  wick: boolean;
  relics: RelicId[];
  villageLights: number;
  contrast: boolean;
  aimAssist: boolean;
  shake: boolean;
  lang: "es" | "en";
  today: SignalId[];
  tut1: string;
  tut2: string;
  tut2b: string;
  tut3: string;
  fpsCap?: boolean;
  onCaption?: (key: string) => void;
  onHud: (h: Hud) => void;
  onEnd: (result: "won" | "lost", hud: Hud, log: NightLog) => void;
  onAway?: () => void;
  onLine?: (es: string, en: string) => void;
  onBeast?: (id: string) => void;
}

interface Body {
  id: string;
  kind: BodyKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  lit: number;
  revealed: boolean;
  revealT: number;
  trait: SignalId;
  judged: boolean;
  side: Side;
  guest?: Guest;
  pop: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  text?: string;
  ember?: boolean;
}

function angDiff(a: number, b: number) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

function lerpAng(a: number, b: number, t: number) {
  return a + angDiff(b, a) * t;
}

function emptyLog(): NightLog {
  return {
    humansOpened: 0,
    humansBurned: 0,
    humansLeft: 0,
    visitorsOpened: 0,
    visitorsBurned: 0,
    visitorsLeft: 0,
    wrecks: 0,
    oilSpent: 0,
    cargoOil: 0,
    cargoTimber: 0,
    cargoIron: 0,
    guests: [],
    abandoned: false,
  };
}

export class VigilEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private night: Night;
  private opts: EngineOpts;
  private mode: RunMode = "idle";
  private raf = 0;
  private acc = 0;
  private last = 0;
  private w = 1;
  private h = 1;
  private dpr = 1;
  private cx = 0;
  private ly = 0;
  private hy = 0;
  private pointer = { x: 0, y: 0 };
  private focus = false;
  private keyFocus = false;
  private steer = 0;
  private beam = -Math.PI / 2;
  private bodies: Body[] = [];
  private parts: Particle[] = [];
  private oil = 60;
  private oil0 = 60;
  private integrity = 3;
  private flares = 1;
  private flareUsed = false;
  private judged = 0;
  private quota = 4;
  private time = 0;
  private clock = 0;
  private hitstop = 0;
  private trauma = 0;
  private pulse = 0;
  private flash = 0;
  private dawn = 0;
  private dim = 0;
  private ended = false;
  private stars: { x: number; y: number; a: number; p: number }[] = [];
  private rng: () => number;
  private vis: () => number;
  private lastHud = "";
  private running = false;
  private paused = false;
  private awayTold = false;
  private mx = 0;
  private village: { x: number; a: number }[] = [];
  private hint = "";
  private reveal = "";
  private wreckPlus = "";
  private wreckPlusT = 0;
  private kind: PlayKind = "watch";
  private beat = 0;
  private omega = 0;
  private ptrLive = false;
  private ptrAge = 0;
  private gearT = 0;
  private stopCapT = 0;
  private padLatch = { open: false, close: false, burn: false, flare: false };
  private scriptI = 0;
  private log: NightLog = emptyLog();
  private ghostUsed = false;
  private ambientT = 8;
  private frames = 0;
  private fpsT = 0;
  private fps = 60;
  private idN = 1;
  private emptyT = 0;
  private oilTold = false;

  constructor(canvas: HTMLCanvasElement, night: Night, opts: EngineOpts) {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) throw new Error("canvas");
    this.ctx = ctx;
    this.night = night;
    this.opts = opts;
    this.rng = mulberry32(hashStr(night.key + ":run"));
    this.vis = mulberry32(hashStr(night.key + ":vis"));
    this.resize();
    this.pointer = { x: this.cx, y: this.hy + 40 };
    this.beam = -Math.PI / 2;
    this.exposeProbe();
  }

  syncOpts(p: Partial<EngineOpts>) {
    Object.assign(this.opts, p);
  }

  get isLive() {
    return this.running && this.mode === "play" && !this.ended;
  }

  get isPaused() {
    return this.paused;
  }

  getFps() {
    return this.fps;
  }

  private held() {
    if (this.oil <= 0.05) return false;
    return this.focus || this.keyFocus;
  }

  resize() {
    const r = this.canvas.getBoundingClientRect();
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.w = Math.max(1, r.width);
    this.h = Math.max(1, r.height);
    this.canvas.width = Math.floor(this.w * this.dpr);
    this.canvas.height = Math.floor(this.h * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.cx = this.w / 2;
    this.hy = this.h * (this.h < 640 ? 0.16 : 0.3);
    this.ly = this.h * (this.h < 640 ? 0.58 : 0.56);
    this.mx = this.w * (0.14 + this.night.moon * 0.68);
    const rng = mulberry32(hashStr(this.night.key + ":stars"));
    this.stars = Array.from({ length: 140 }, () => ({
      x: rng() * this.w,
      y: rng() * this.hy * 0.96,
      a: 0.12 + rng() * 0.7,
      p: rng() * Math.PI * 2,
    }));
    this.village = Array.from({ length: 7 }, (_, i) => ({
      x: this.w * (0.07 + i * 0.13) + (rng() - 0.5) * 8,
      a: 0.45 + rng() * 0.5,
    }));
  }

  setPointer(x: number, y: number) {
    this.pointer.x = x;
    this.pointer.y = y;
    this.ptrLive = true;
    this.ptrAge = 0;
  }
  setFocus(v: boolean) {
    this.focus = v;
  }
  setSteer(v: number) {
    this.steer = Math.max(-1, Math.min(1, v));
  }
  setKeyFocus(v: boolean) {
    this.keyFocus = v;
  }
  setPaused(v: boolean) {
    this.paused = v;
  }

  cap(key: string) {
    this.opts.onCaption?.(key);
  }

  private exposeProbe() {
    if (typeof window === "undefined") return;
    const qa = import.meta.env.DEV || /\bqa=1\b/.test(window.location.search);
    if (!qa) return;
    (window as unknown as { __controlsTest?: unknown; __vigilEngine?: unknown }).__controlsTest = {
      getYaw: () => -this.beam,
      getSpeed: () => (this.mode === "play" && !this.ended ? 1 : 0),
      setSteer: (v: number) => this.setSteer(v),
      setKeys: (codes: string[]) => {
        const left = codes.includes("KeyA") || codes.includes("ArrowLeft");
        const right = codes.includes("KeyD") || codes.includes("ArrowRight");
        this.setSteer((right ? 1 : 0) - (left ? 1 : 0));
        this.setKeyFocus(codes.includes("Space") || codes.includes("ShiftLeft") || codes.includes("KeyW"));
      },
    };
    (window as unknown as { __vigilEngine?: unknown }).__vigilEngine = {
      clock: () => this.clock,
      judged: () => this.judged,
      quota: () => this.quota,
      oil: () => this.oil,
      ended: () => this.ended,
      mode: () => this.mode,
      beam: () => this.beam,
      bodies: () =>
        this.bodies
          .filter((b) => !b.judged)
          .map((b) => ({
            kind: b.kind,
            x: Math.round(b.x),
            y: Math.round(b.y),
            r: Math.round(b.r),
            side: b.side,
            revealed: b.revealed,
            w: Math.round(this.w),
            h: Math.round(this.h),
          })),
    };
  }

  start(mode: RunMode) {
    this.mode = mode;
    this.kind = this.opts.kind ?? "watch";
    this.oil = this.opts.oil;
    this.oil0 = this.opts.oil;
    this.integrity = this.opts.integrity;
    this.flares = this.opts.flares;
    this.flareUsed = false;
    this.judged = 0;
    this.quota = this.night.script.length;
    this.time = this.night.duration;
    this.clock = 0;
    this.scriptI = 0;
    this.bodies = [];
    this.parts = [];
    this.log = emptyLog();
    this.ended = false;
    this.paused = false;
    this.awayTold = false;
    this.omega = 0;
    this.ptrLive = false;
    this.beam = -Math.PI / 2;
    this.beat = 0;
    this.hint = this.kind === "tutorial" ? this.opts.tut1 : "";
    this.reveal = "";
    this.ghostUsed = false;
    this.emptyT = 0;
    this.oilTold = false;
    this.running = true;
    this.last = 0;
    this.acc = 0;
    this.emit();
    this.loop(0);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  catchUp(seconds: number) {
    if (!this.isLive) return;
    if (seconds > 8) {
      this.awayTold = true;
      this.opts.onAway?.();
      this.log.abandoned = true;
      for (const b of this.bodies) {
        if (b.judged) continue;
        if (b.kind === "visitor") this.applyJudge(b, "open");
        else this.applyJudge(b, "close");
      }
      this.finish(this.integrity > 0 ? "won" : "lost");
      return;
    }
    const step = 1 / 60;
    let t = Math.min(12, Math.max(0, seconds));
    this.focus = false;
    this.keyFocus = false;
    while (t >= step && !this.ended) {
      if (this.hitstop > 0) this.hitstop -= step;
      else this.sim(step);
      t -= step;
    }
  }

  openCone() {
    return this.judge("open");
  }
  closeCone() {
    if (!this.opts.muted && this.isLive) sfxSweep();
    this.cap("capSweep");
    return this.judge("close");
  }
  burnCone() {
    return this.judge("burn");
  }
  sweepBeam() {
    return this.closeCone();
  }

  flareAll() {
    if (!this.isLive || this.flareUsed || this.flares <= 0) return false;
    this.flareUsed = true;
    this.flares -= 1;
    this.flash = 1;
    this.trauma = Math.min(1, this.trauma + 0.55);
    for (const b of this.bodies) {
      if (b.judged) continue;
      const d = Math.hypot(b.x - this.cx, b.y - this.ly);
      if (d < 120) this.applyJudge(b, "burn");
    }
    if (!this.opts.muted) sfxFlare();
    haptic(40);
    this.cap("capFlare");
    return true;
  }

  private inCone(b: Body, half: number, len: number) {
    const dx = b.x - this.cx;
    const dy = b.y - this.ly;
    const d = Math.hypot(dx, dy);
    const a = Math.atan2(dy, dx);
    return Math.abs(angDiff(a, this.beam)) < half && d < len && d > 16;
  }

  private target(half: number, len: number) {
    let best: Body | null = null;
    let bd = 9e3;
    for (const b of this.bodies) {
      if (b.judged) continue;
      if (!this.inCone(b, half, len)) continue;
      const d = Math.hypot(b.x - this.cx, b.y - this.ly);
      if (d < bd) {
        bd = d;
        best = b;
      }
    }
    return best;
  }

  private judge(verb: "open" | "close" | "burn") {
    if (!this.isLive) return false;
    const { half, len } = this.beamShape(this.held());
    const b = this.target(half, len);
    if (!b) {
      this.opts.onLine?.("Nada en el haz.", "Nothing in the beam.");
      return false;
    }
    if (this.kind === "tutorial" && this.beat === 1 && !b.revealed) {
      this.hint = this.opts.tut2;
      return false;
    }
    this.applyJudge(b, verb);
    return true;
  }

  private applyJudge(b: Body, verb: "open" | "close" | "burn") {
    if (b.judged) return;
    b.judged = true;
    this.judged += 1;
    this.hitstop = 0.1;
    this.burst(b.x, b.y, verb === "burn" ? 18 : 10, verb === "burn");
    haptic(verb === "burn" ? 28 : 12);
    if (b.kind === "wreck") {
      if (verb === "close") {
        this.log.wrecks += 0;
      } else {
        const oil = 8 + Math.floor(this.rng() * 5);
        this.log.wrecks += 1;
        this.log.cargoOil += oil;
        this.log.cargoTimber += this.rng() < 0.45 ? 2 : 1;
        this.log.cargoIron += this.rng() < 0.3 ? 1 : 0;
        this.wreckPlus = `+${oil}`;
        this.wreckPlusT = 1.8;
        this.opts.onLine?.(this.opts.lang === "es" ? `+${oil} aceite` : `+${oil} oil`, this.opts.lang === "en" ? `+${oil} oil` : `+${oil} aceite`);
        if (!this.opts.muted) sfxSave(1);
        this.cap("capWreck");
      }
    } else if (b.kind === "prime") {
      if (verb === "open") {
        this.hurt(true);
        this.finish("lost");
        return;
      }
      if (verb === "burn") {
        this.oil = Math.max(0, this.oil - 16);
      }
    } else if (b.kind === "human") {
      if (verb === "open") {
        this.log.humansOpened += 1;
        if (b.guest) this.log.guests.push(b.guest);
        this.wreckPlus = this.opts.lang === "es" ? "Sube al faro" : "Comes up";
        this.wreckPlusT = 1.8;
        this.opts.onLine?.("Sube al faro", "Comes up");
        this.cap("capOpen");
        if (!this.opts.muted) sfxSave(1);
      } else if (verb === "burn") {
        this.log.humansBurned += 1;
        this.wreckPlus = this.opts.lang === "es" ? "Ceniza" : "Ash";
        this.wreckPlusT = 1.8;
        this.opts.onLine?.("Quemaste a quien pedía luz.", "You burned one who asked for light.");
        this.cap("capBurn");
        if (!this.opts.muted) sfxLost();
      } else {
        this.log.humansLeft += 1;
      }
    } else {
      if (verb === "open") {
        this.log.visitorsOpened += 1;
        if (b.guest) this.log.guests.push(b.guest);
        this.wreckPlus = this.opts.lang === "es" ? "Sube al faro" : "Comes up";
        this.wreckPlusT = 1.8;
        this.opts.onLine?.("Sube al faro", "Comes up");
        this.cap("capOpen");
      } else if (verb === "burn") {
        this.log.visitorsBurned += 1;
        this.wreckPlus = this.opts.lang === "es" ? "Ceniza" : "Ash";
        this.wreckPlusT = 1.8;
        this.opts.onLine?.("Ceniza", "Ash");
        this.cap("capBurn");
        if (!this.opts.muted) sfxWarn();
      } else {
        this.log.visitorsLeft += 1;
      }
    }
    if (this.kind === "tutorial") {
      if (this.beat === 0 && b.kind === "wreck") {
        this.beat = 1;
        this.hint = this.opts.tut2;
      } else if (this.beat === 1) {
        this.beat = 2;
        this.hint = this.opts.tut3;
      } else if (this.beat === 2) {
        this.beat = 3;
      }
    }
    this.maybeEnd();
  }

  private unlockBeast(id: string) {
    this.opts.onBeast?.(id);
  }

  private hurt(fatal: boolean) {
    if (!this.ghostUsed && this.opts.relics.includes("fantasma")) {
      this.ghostUsed = true;
      return;
    }
    this.integrity -= 1;
    this.trauma = Math.min(1, this.trauma + 0.6);
    if (this.integrity <= 0 || fatal) this.finish("lost");
  }

  private maybeEnd() {
    if (this.ended) return;
    if (this.integrity <= 0) {
      this.finish("lost");
      return;
    }
    if (this.judged >= this.quota && this.scriptI >= this.night.script.length) this.finish("won");
  }

  private finish(result: "won" | "lost") {
    if (this.ended) return;
    this.ended = true;
    setTension(0);
    this.log.oilSpent += Math.max(0, this.oil0 - this.oil);
    const hud = this.hud(false);
    hud.result = result;
    this.opts.onHud(hud);
    this.opts.onEnd(result, hud, this.log);
  }

  private loop = (t: number) => {
    if (!this.running) return;
    if (!this.last) this.last = t;
    let dt = (t - this.last) / 1000;
    this.last = t;
    if (dt > 0.1) dt = 0.1;
    if (this.opts.fpsCap) dt = Math.min(dt, 1 / 28);
    this.acc += dt;
    const step = 1 / 60;
    while (this.acc >= step) {
      if (this.paused) {
        this.pulse += step;
        this.acc -= step;
        continue;
      }
      if (this.hitstop > 0) this.hitstop -= step;
      else this.sim(step);
      this.acc -= step;
    }
    this.draw();
    this.frames += 1;
    this.fpsT += dt;
    if (this.fpsT >= 0.5) {
      this.fps = this.frames / this.fpsT;
      this.frames = 0;
      this.fpsT = 0;
    }
    this.raf = requestAnimationFrame(this.loop);
  };

  private sim(dt: number) {
    const playing = this.mode === "play" && !this.ended;
    const held = this.held();
    this.pulse += dt;
    this.trauma = Math.max(0, this.trauma - dt * 1.7);
    this.flash = Math.max(0, this.flash - dt * 3.2);
    this.wreckPlusT = Math.max(0, this.wreckPlusT - dt);
    this.readPad();
    this.stepBeam(dt, playing);

    if (playing) {
      this.time -= dt;
      this.clock += dt;
      const drain = (held ? 0.16 : 0.07) * this.night.oilMul * (this.opts.wick ? 0.7 : 1);
      this.oil = Math.max(0, this.oil - drain * dt);
      this.ambientT -= dt;
      if (this.ambientT <= 0) {
        this.ambientT = 8 + this.rng() * 8;
        if (!this.opts.muted) playCap(this.rng() < 0.5 ? "capGull" : "capWind", this.rng() * 1.4 - 0.7);
      }
      while (this.scriptI < this.night.script.length && this.clock >= this.night.script[this.scriptI].at) {
        this.spawnSpec(this.night.script[this.scriptI]);
        this.scriptI += 1;
      }
      const liveBodies = this.bodies.filter((b) => !b.judged).length;
      if (liveBodies === 0) this.emptyT += dt;
      else this.emptyT = 0;
      if (this.emptyT > 3 && this.scriptI < this.night.script.length) {
        this.spawnSpec(this.night.script[this.scriptI]);
        this.scriptI += 1;
        this.emptyT = 0;
      }
      if (this.oil <= 0.05) {
        this.focus = false;
        this.keyFocus = false;
        if (!this.oilTold) {
          this.oilTold = true;
          this.opts.onLine?.("Sin aceite. Cierra el haz.", "No oil. Close the beam.");
        }
        if (this.scriptI >= this.night.script.length) {
          for (const b of this.bodies) if (!b.judged) this.applyJudge(b, "close");
          this.finish(this.integrity > 0 ? "won" : "lost");
          return;
        }
      }
      if (this.time <= 0) {
        for (const b of this.bodies) if (!b.judged) this.applyJudge(b, "close");
        this.finish(this.integrity > 0 ? "won" : "lost");
        return;
      }
    } else if (this.mode === "idle" && this.bodies.length < 4) {
      if (this.rng() < 0.012) this.spawnIdle();
    }

    const { half, len } = this.beamShape(held);
    const need = this.opts.relics.includes("farero") ? 0.7 : 1.2;
    const glass = this.opts.relics.includes("vidrio");
    let threat = false;
    const keep: Body[] = [];
    for (const b of this.bodies) {
      b.pop = Math.max(0, b.pop - dt * 3);
      if (b.judged) continue;
      if (b.kind === "wreck") {
        b.x += b.vx * dt;
        b.y += b.vy * dt;
      } else {
        const dx = this.cx - b.x;
        const dy = this.ly - b.y;
        const L = Math.hypot(dx, dy) || 1;
        const spd = b.kind === "prime" ? 12 : 8;
        b.x += (dx / L) * spd * dt;
        b.y += (dy / L) * spd * dt;
      }
      const d = Math.hypot(b.x - this.cx, b.y - this.ly);
      const inB = this.inCone(b, half, len);
      if (inB && playing) {
        const rate = held ? dt * 0.55 : dt * 0.22;
        b.lit = Math.min(1, b.lit + rate);
        if (held) b.revealT += dt;
        if (glass && b.kind !== "wreck" && d < len * 0.7) b.revealT = Math.max(b.revealT, need);
        if (b.revealT >= need && !b.revealed) {
          b.revealed = true;
          this.reveal = this.revealLine(b);
          this.unlockBeast(b.kind);
          if (this.kind === "tutorial" && this.beat === 1) this.hint = this.opts.tut2b;
        }
        if (b.kind === "wreck" && b.lit >= 1) {
          this.applyJudge(b, "open");
          continue;
        }
      } else {
        b.lit = Math.max(0, b.lit - dt * 0.18);
      }
      if (playing && this.opts.aimAssist && held && inB) {
        const a = Math.atan2(b.y - this.ly, b.x - this.cx);
        this.omega += angDiff(a, this.beam) * 3 * dt;
      }
      if (d < 30 && b.kind !== "wreck") {
        if (this.oil <= 0.05) {
          this.applyJudge(b, b.kind === "visitor" ? "open" : "close");
          continue;
        }
        this.applyJudge(b, b.kind === "visitor" ? "open" : "close");
        if (b.kind === "prime") this.hurt(true);
        continue;
      }
      if (b.kind === "wreck" && (b.x < -40 || b.x > this.w + 40)) {
        this.applyJudge(b, "close");
        continue;
      }
      if (d < 90 && b.kind !== "wreck") threat = true;
      keep.push(b);
    }
    this.bodies = keep;
    setTension(threat ? 0.7 : this.held() ? 0.35 : 0.15);
    this.emit(threat);
  }

  private revealLine(b: Body) {
    const es = this.opts.lang === "es";
    if (b.kind === "wreck") return es ? "Pecio. No pide luz." : "Wreck. It does not ask for light.";
    const s = b.guest?.signs;
    if (s) {
      if (!s.breath) return es ? "No echa vaho." : "No fog on the glass.";
      if (s.hands === "barnacle") return es ? "Manos con percebes." : "Hands with barnacles.";
      if (s.hands === "clean") return es ? "Manos demasiado limpias." : "Hands too clean.";
      if (!s.splash) return es ? "El agua no le salpica." : "The water does not splash them.";
      if (s.breath) return es ? "Vaho en el cristal." : "Fog on the glass.";
    }
    if (b.trait === "noBreath") return es ? "No echa vaho." : "No fog on the glass.";
    if (b.trait === "hands") return es ? "Manos con percebes." : "Hands with barnacles.";
    if (b.trait === "water") return es ? "El agua no le salpica." : "The water does not splash them.";
    const copy = SIGNAL_COPY[b.trait];
    return es ? copy.es : copy.en;
  }

  private spawnSpec(s: { kind: BodyKind; side: Side; at: number; trait?: SignalId }) {
    const x = s.side === "port" ? this.w * 0.32 : s.side === "star" ? this.w * 0.68 : this.cx + (this.rng() - 0.5) * 24;
    const sea = this.hy + (this.ly - this.hy) * 0.42;
    const y = this.kind === "tutorial" && this.beat >= 1 && s.kind !== "wreck" ? this.ly - 56 : sea;
    const visitor = s.kind === "visitor";
    const guest =
      s.kind === "human" || s.kind === "visitor" ? makeGuest(`g${this.idN}`, visitor, this.opts.today, this.rng) : undefined;
    const minR = this.w < 500 ? 26 : 22;
    const b: Body = {
      id: `b${this.idN++}`,
      kind: s.kind,
      x,
      y,
      vx: s.kind === "wreck" ? (s.side === "port" ? 16 : s.side === "star" ? -16 : 0) : 0,
      vy: s.kind === "wreck" ? (this.rng() - 0.5) * 4 : 0,
      r: s.kind === "prime" ? minR + 6 : s.kind === "wreck" ? minR + 2 : minR,
      lit: 0,
      revealed: false,
      revealT: 0,
      trait: guest?.trait ?? s.trait ?? "noBreath",
      judged: false,
      side: s.side,
      guest,
      pop: 1,
    };
    this.bodies.push(b);
    this.cap("capDrowner");
  }

  private spawnIdle() {
    const fromLeft = this.rng() < 0.5;
    const minR = this.w < 500 ? 18 : 16;
    this.bodies.push({
      id: `i${this.idN++}`,
      kind: "wreck",
      x: fromLeft ? this.w * 0.12 : this.w * 0.88,
      y: this.hy + (this.ly - this.hy) * 0.5,
      vx: (fromLeft ? 1 : -1) * 22,
      vy: 0,
      r: minR,
      lit: 0,
      revealed: false,
      revealT: 0,
      trait: "noBreath",
      judged: false,
      side: fromLeft ? "port" : "star",
      pop: 1,
    });
  }

  private beamShape(held: boolean) {
    const beam0 = 0.22;
    const half = (held ? beam0 * 0.48 : beam0) * Math.PI;
    const len = Math.min(this.w, this.h) * (held ? 0.88 : 0.78) * (this.oil < 1 ? 0.55 : 1);
    const light = (held ? 2.1 : 1.1) * (this.oil < 1 ? 0.4 : 1);
    return { half, len, light };
  }

  private stepBeam(dt: number, playing: boolean) {
    const MIN = -Math.PI + 0.14;
    const MAX = -0.14;
    if (this.mode === "idle") {
      const target = -Math.PI / 2 + Math.sin(this.pulse * 0.32) * 0.95;
      this.beam = lerpAng(this.beam, target, 1 - Math.exp(-2.2 * dt));
      this.omega = 0;
      return;
    }
    this.ptrAge += dt;
    if (this.ptrAge > 0.32) this.ptrLive = false;
    this.stopCapT = Math.max(0, this.stopCapT - dt);
    const held = this.held();
    const accel = held ? 13 : 9.5;
    const friction = 4.6;
    const maxW = held ? 3.4 : 2.45;
    this.omega += this.steer * accel * dt;
    if (this.steer === 0 && this.ptrLive) {
      const aim = Math.atan2(this.pointer.y - this.ly, this.pointer.x - this.cx);
      this.omega += angDiff(Math.max(MIN, Math.min(MAX, aim)), this.beam) * 7.5 * dt;
    }
    this.omega *= Math.exp(-friction * dt);
    this.omega = Math.max(-maxW, Math.min(maxW, this.omega));
    this.beam += this.omega * dt;
    if (this.beam < MIN) {
      this.beam = MIN;
      if (this.omega < -0.45) {
        haptic(10);
        if (!this.opts.muted) sfxGear(-0.6);
        if (this.stopCapT <= 0) {
          this.cap("capStop");
          this.stopCapT = 1.6;
        }
      }
      this.omega = Math.abs(this.omega) * 0.22;
    } else if (this.beam > MAX) {
      this.beam = MAX;
      if (this.omega > 0.45) {
        haptic(10);
        if (!this.opts.muted) sfxGear(0.6);
        if (this.stopCapT <= 0) {
          this.cap("capStop");
          this.stopCapT = 1.6;
        }
      }
      this.omega = -Math.abs(this.omega) * 0.22;
    }
    if (Math.abs(this.omega) > 0.4 && !this.opts.muted && playing) {
      this.gearT -= dt;
      if (this.gearT <= 0) {
        sfxGear(Math.sign(this.omega) * 0.45);
        this.gearT = 0.12;
      }
    }
  }

  private readPad() {
    if (typeof navigator === "undefined" || !navigator.getGamepads) return;
    const pad = navigator.getGamepads()[0];
    if (!pad) return;
    const ax = pad.axes[0] ?? 0;
    if (Math.abs(ax) > 0.22) this.steer = ax > 0 ? 1 : -1;
    if (pad.buttons[0]?.pressed || pad.buttons[7]?.pressed) this.keyFocus = true;
    const open = !!pad.buttons[1]?.pressed;
    if (open && !this.padLatch.open) this.openCone();
    this.padLatch.open = open;
    const close = !!pad.buttons[2]?.pressed;
    if (close && !this.padLatch.close) this.closeCone();
    this.padLatch.close = close;
    const burn = !!pad.buttons[3]?.pressed;
    if (burn && !this.padLatch.burn) this.burnCone();
    this.padLatch.burn = burn;
  }

  private sideOf(): Side {
    if (this.beam < -Math.PI / 2 - 0.35) return "port";
    if (this.beam > -Math.PI / 2 + 0.35) return "star";
    return "beam";
  }

  private distOf(): Dist {
    const { half, len } = this.beamShape(this.held());
    const t = this.target(half, len);
    if (!t) return "far";
    const d = Math.hypot(t.x - this.cx, t.y - this.ly);
    if (d < 90) return "near";
    if (d < 180) return "mid";
    return "far";
  }

  private hud(threat: boolean): Hud {
    return {
      integrity: this.integrity,
      oil: this.oil,
      judged: this.judged,
      quota: this.quota,
      flares: this.flares,
      side: this.sideOf(),
      dist: this.distOf(),
      hint: this.hint,
      reveal: this.reveal,
      result: this.ended ? (this.integrity > 0 ? "won" : "lost") : null,
      heading: this.beam,
      beat: this.beat,
      canSkip: this.kind === "tutorial" && this.beat >= 2,
      timeLeft: Math.max(0, this.time),
      threat,
      wreckPlus: this.wreckPlusT > 0 ? this.wreckPlus : "",
    };
  }

  private emit(threat = false) {
    const h = this.hud(threat);
    const key = `${h.integrity}|${Math.floor(h.oil)}|${h.judged}|${h.hint}|${h.reveal}|${h.side}|${h.dist}|${h.beat}|${h.canSkip ? 1 : 0}|${h.wreckPlus}|${Math.ceil(h.timeLeft)}`;
    if (key === this.lastHud) return;
    this.lastHud = key;
    this.opts.onHud(h);
  }

  private burst(x: number, y: number, n: number, ember: boolean) {
    for (let i = 0; i < n; i++) {
      const a = this.vis() * Math.PI * 2;
      const v = 18 + this.vis() * 70;
      this.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.3 + this.vis() * 0.4, max: 0.7, size: 1.2 + this.vis() * 2.2, ember });
    }
  }

  private draw() {
    const { ctx, w, h, cx, ly, hy } = this;
    const shake = this.opts.reducedMotion || this.opts.shake === false ? 0 : this.trauma * this.trauma;
    const ox = shake ? Math.sin(this.pulse * 37) * 10 * shake : 0;
    const oy = shake ? Math.sin(this.pulse * 53) * 7 * shake : 0;
    ctx.fillStyle = "#07080B";
    ctx.fillRect(0, 0, w, h);
    ctx.save();
    ctx.translate(ox, oy);

    const sky = ctx.createLinearGradient(0, 0, 0, hy + 8);
    sky.addColorStop(0, "#06070b");
    sky.addColorStop(0.62, "#0c1016");
    sky.addColorStop(1, mixHex("#141820", "#4a4034", this.night.moon * 0.12 + this.dawn * 0.4));
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, hy + 12);

    if (!this.opts.reducedMotion) {
      for (const st of this.stars) {
        const tw = 0.65 + 0.35 * Math.sin(this.pulse * 1.4 + st.p);
        ctx.fillStyle = `rgba(232,224,208,${st.a * tw * (0.45 + this.night.moon * 0.5)})`;
        ctx.fillRect(st.x, st.y, 1.3, 1.3);
      }
    }

    ctx.beginPath();
    ctx.arc(this.mx, hy * 0.38, 16 + this.night.moon * 10, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(232,224,208,${0.14 + this.night.moon * 0.42})`;
    ctx.fill();

    for (let i = 0; i < 7; i++) {
      const v = this.village[i];
      if (!v) continue;
      const on = i < this.opts.villageLights;
      const tw = 0.6 + 0.4 * Math.sin(this.pulse * 2.1 + v.x);
      const x = v.x;
      const y = hy - 2;
      ctx.fillStyle = "#121416";
      ctx.fillRect(x - 11, y - 18, 22, 20);
      ctx.beginPath();
      ctx.moveTo(x - 13, y - 18);
      ctx.lineTo(x, y - 30);
      ctx.lineTo(x + 13, y - 18);
      ctx.closePath();
      ctx.fillStyle = "#1A1C1E";
      ctx.fill();
      ctx.fillStyle = on ? `rgba(243,230,196,${v.a * tw})` : "rgba(232,224,208,0.07)";
      ctx.fillRect(x - 5, y - 12, 10, 8);
    }

    const held = this.held();
    const { half, len } = this.beamShape(held);
    const swell = 0.85 + this.night.swell * 0.55;
    this.drawWave(hy + 8, 8 * swell, 0.011, 0.55, "#0a1018");
    this.drawBeam(half, len);
    this.drawWave(hy + 28, 11 * swell, 0.016, 0.72, "#0c141c", true);
    this.drawWave(hy + 58, 15 * swell, 0.02, 0.9, "#101820", true);
    this.drawWave((hy + ly) * 0.62, 17 * swell, 0.023, 1.05, "#141c26", true);

    const ordered = this.bodies.slice().sort((a, b) => a.y - b.y);
    if (this.night.rain && !this.opts.reducedMotion) this.drawRain();
    for (const b of ordered) this.drawBody(b);
    for (const p of this.parts) {
      p.life -= 0.016;
      p.x += p.vx * 0.016;
      p.y += p.vy * 0.016;
      ctx.fillStyle = p.ember ? `rgba(139,58,42,${p.life / p.max})` : `rgba(243,230,196,${p.life / p.max})`;
      ctx.fillRect(p.x, p.y, p.size, p.size);
    }
    this.parts = this.parts.filter((p) => p.life > 0);
    this.drawRock();
    this.drawTower();
    this.drawWave(ly + 22, 12 * swell, 0.026, 1.18, "#121a22", true);
    this.drawWave(ly + 56, 10 * swell, 0.03, 1.32, "#0e161e", true);

    if (this.night.fog > 0.2) {
      ctx.fillStyle = `rgba(12,14,16,${this.night.fog * 0.45})`;
      ctx.fillRect(0, 0, w, h);
    }
    if (this.flash > 0) {
      ctx.fillStyle = `rgba(243,230,196,${this.flash * 0.22})`;
      ctx.fillRect(0, 0, w, h);
    }
    ctx.restore();
  }

  private drawBody(b: Body) {
    const { ctx, hy, ly } = this;
    const depth = Math.max(0.35, Math.min(1, (b.y - hy) / Math.max(1, ly - hy)));
    const minPx = this.w < 500 ? 48 : 36;
    const base = Math.max(minPx / 2, b.r);
    const sc = Math.max(minPx / (base * 2), 0.9) * (0.85 + depth * 0.2) * (1 + b.pop * 0.25);
    const hidden = this.night.fog > 0.7 && b.lit < 0.08 && !b.revealed;
    const a = hidden ? 0.14 : 0.72 + b.lit * 0.28;
    const { half, len } = this.beamShape(this.held());
    const inB = this.inCone(b, half, len);
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.scale(sc, sc);
    ctx.beginPath();
    ctx.arc(0, 0, b.r + 8, 0, Math.PI * 2);
    ctx.strokeStyle = inB ? `rgba(243,230,196,${0.55 + Math.sin(this.pulse * 8) * 0.35})` : "rgba(232,224,208,0.7)";
    ctx.lineWidth = 2;
    ctx.stroke();
    if (b.kind === "wreck") {
      ctx.beginPath();
      ctx.moveTo(-18, 4);
      ctx.quadraticCurveTo(0, 16, 20, 4);
      ctx.lineTo(14, 0);
      ctx.quadraticCurveTo(0, 6, -14, 0);
      ctx.closePath();
      ctx.fillStyle = `rgba(232,224,208,${Math.max(0.7, a)})`;
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(2, 0);
      ctx.lineTo(2, -22);
      ctx.lineTo(16, -6);
      ctx.closePath();
      ctx.fillStyle = `rgba(243,230,196,${0.55 + b.lit * 0.4})`;
      ctx.fill();
    } else if (b.kind === "prime") {
      ctx.beginPath();
      ctx.arc(0, 0, b.r + 2, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(139,58,42,${0.75 + b.lit * 0.2})`;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(0, -b.r * 0.2, b.r * 0.45, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(243,230,196,${0.5 + Math.abs(Math.sin(this.pulse * 3)) * 0.5})`;
      ctx.fill();
    } else {
      const wound = b.kind === "visitor";
      ctx.beginPath();
      ctx.ellipse(0, 4, b.r * 0.95, b.r * 1.35, 0, 0, Math.PI * 2);
      ctx.fillStyle = wound ? `rgba(22,14,14,${0.88})` : `rgba(40,36,32,${0.9})`;
      ctx.fill();
      ctx.strokeStyle = "rgba(232,224,208,0.85)";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, -b.r * 0.85, b.r * 0.55, 0, Math.PI * 2);
      ctx.fillStyle = wound ? "rgba(28,18,18,0.95)" : "rgba(48,44,40,0.95)";
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(-2.6, -b.r * 0.9, 1.8, 0, Math.PI * 2);
      ctx.arc(2.6, -b.r * 0.9, 1.8, 0, Math.PI * 2);
      ctx.fillStyle = wound ? "rgba(139,58,42,0.95)" : "rgba(232,224,208,0.9)";
      ctx.fill();
      if (wound) {
        ctx.beginPath();
        ctx.moveTo(-6, 10);
        ctx.lineTo(6, 10);
        ctx.strokeStyle = "rgba(139,58,42,0.9)";
        ctx.stroke();
      }
    }
    if (b.revealed) {
      ctx.beginPath();
      ctx.arc(0, 0, b.r + 12, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(243,230,196,0.55)";
      ctx.lineWidth = 1.4;
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawBeam(half: number, len: number) {
    const { ctx, cx, ly, hy } = this;
    const live = this.oil < 1 ? 0.35 : 1;
    ctx.save();
    ctx.translate(cx, ly);
    ctx.rotate(this.beam);
    const g = ctx.createRadialGradient(0, 0, 6, 0, 0, len);
    const a0 = (this.held() ? 0.62 : 0.36) * live;
    g.addColorStop(0, `rgba(243,230,196,${a0})`);
    g.addColorStop(0.4, `rgba(243,230,196,${0.14 * live})`);
    g.addColorStop(1, "rgba(243,230,196,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, len, -half, half);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = `rgba(243,230,196,${(this.held() ? 0.4 : 0.2) * live})`;
    ctx.lineWidth = this.held() ? 2 : 1.2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(len * 0.94, 0);
    ctx.stroke();
    ctx.restore();
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, hy, this.w, this.h - hy);
    ctx.clip();
    ctx.translate(cx, hy + 10);
    ctx.scale(1, -0.38);
    ctx.rotate(this.beam);
    const rg = ctx.createRadialGradient(0, 0, 4, 0, 0, len * 0.7);
    rg.addColorStop(0, `rgba(243,230,196,${0.16 * live})`);
    rg.addColorStop(1, "rgba(243,230,196,0)");
    ctx.fillStyle = rg;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, len * 0.7, -half, half);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    if (!this.opts.reducedMotion) {
      for (let i = 0; i < 10; i++) {
        const d = 40 + ((this.pulse * 28 + i * 47) % (len * 0.5));
        const gx = cx + Math.cos(this.beam) * d;
        const gy = ly + Math.sin(this.beam) * d;
        if (gy < hy + 18 || gy > ly - 8) continue;
        ctx.fillStyle = `rgba(243,230,196,${0.08 + Math.abs(Math.sin(this.pulse * 3 + i)) * 0.1})`;
        ctx.fillRect(gx, gy, 2.2, 1.2);
      }
    }
  }

  private drawWave(base: number, amp: number, freq: number, speed: number, color: string, foam = false) {
    const { ctx, w, h } = this;
    const t = this.opts.reducedMotion ? 0 : this.pulse;
    ctx.beginPath();
    ctx.moveTo(0, h);
    for (let i = 0; i <= 48; i++) {
      const x = (i / 48) * w;
      const y = base + Math.sin(x * freq + t * speed) * amp + Math.sin(x * freq * 1.73 + t * speed * 0.61) * amp * 0.34;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.beginPath();
    for (let i = 0; i <= 48; i++) {
      const x = (i / 48) * w;
      const y = base + Math.sin(x * freq + t * speed) * amp + Math.sin(x * freq * 1.73 + t * speed * 0.61) * amp * 0.34;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = "rgba(232,224,208,0.16)";
    ctx.lineWidth = 1.15;
    ctx.stroke();
    if (foam && !this.opts.reducedMotion) {
      ctx.fillStyle = "rgba(232,224,208,0.22)";
      for (let i = 0; i < 18; i++) {
        const x = ((i * 0.071 + t * 0.04) % 1) * w;
        const y = base + Math.sin(x * freq + t * speed) * amp + Math.sin(x * freq * 1.73 + t * speed * 0.61) * amp * 0.34;
        ctx.globalAlpha = 0.35 + 0.35 * Math.abs(Math.sin(t * 2 + i));
        ctx.fillRect(x, y - 1, 3.2, 1.4);
      }
      ctx.globalAlpha = 1;
    }
  }

  private drawRain() {
    const { ctx, w, h } = this;
    ctx.strokeStyle = "rgba(232,224,208,0.1)";
    ctx.lineWidth = 1;
    for (let i = 0; i < 56; i++) {
      const seed = hashStr(this.night.key + ":r" + i) / 4294967296;
      const x = ((seed * w + this.pulse * (90 + seed * 80)) % (w + 40)) - 20;
      const y = ((seed * 1.7 * h + this.pulse * 180) % (h + 30)) - 10;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 2, y + 12);
      ctx.stroke();
    }
  }

  private drawRock() {
    const { ctx, cx, ly } = this;
    const rw = Math.min(64, this.w * 0.11);
    ctx.beginPath();
    ctx.moveTo(cx - rw, ly + 58);
    ctx.quadraticCurveTo(cx - rw * 0.55, ly + 26, cx, ly + 18);
    ctx.quadraticCurveTo(cx + rw * 0.55, ly + 26, cx + rw, ly + 58);
    ctx.closePath();
    ctx.fillStyle = "#1A1C1E";
    ctx.fill();
    ctx.strokeStyle = "rgba(232,224,208,0.1)";
    ctx.stroke();
  }

  private drawTower() {
    const { ctx, cx, ly } = this;
    ctx.beginPath();
    ctx.moveTo(cx - 18, ly + 84);
    ctx.lineTo(cx - 10, ly + 6);
    ctx.lineTo(cx + 10, ly + 6);
    ctx.lineTo(cx + 18, ly + 84);
    ctx.closePath();
    ctx.fillStyle = "#1A1C1E";
    ctx.fill();
    ctx.strokeStyle = "rgba(232,224,208,0.14)";
    ctx.stroke();
    for (let i = 0; i < 7; i++) {
      const wy = ly + 16 + i * 6.2;
      ctx.fillStyle = i < this.opts.villageLights ? "rgba(243,230,196,0.82)" : "rgba(232,224,208,0.08)";
      ctx.fillRect(cx - 3.4, wy, 6.8, 3.2);
    }
    ctx.fillStyle = "#161512";
    ctx.fillRect(cx - 14, ly - 2, 28, 8);
    ctx.save();
    ctx.translate(cx, ly - 12);
    ctx.rotate(this.beam);
    ctx.beginPath();
    ctx.arc(0, 0, 5.6, 0, Math.PI * 2);
    ctx.fillStyle = this.oil < 1 ? "#3a3834" : "#F3E6C4";
    ctx.fill();
    ctx.fillStyle = `rgba(243,230,196,${this.held() ? 0.55 : 0.28})`;
    ctx.fillRect(4, -1.8, 13, 3.6);
    ctx.restore();
  }
}

function mixHex(a: string, b: string, t: number) {
  const A = hexRgb(a);
  const B = hexRgb(b);
  const m = Math.max(0, Math.min(1, t));
  return `rgb(${Math.round(A[0] + (B[0] - A[0]) * m)},${Math.round(A[1] + (B[1] - A[1]) * m)},${Math.round(A[2] + (B[2] - A[2]) * m)})`;
}
function hexRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
