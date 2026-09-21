import { BookOpen, Compass, Droplet, Feather, Flame, Heart, LogOut, Package, Pause, Play, Settings, Ship, Skull, Sword, Users, Volume2, VolumeX, Waves, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { VigilEngine, type EngineOpts, type Hud } from "@/lib/vigil/engine";
import { vt, type VLang } from "@/lib/vigil/i18n";
import { makeVigil } from "@/lib/vigil/night";
import { draftRelics, RELICS, type RelicId } from "@/lib/vigil/relics";
import { relicLine } from "@/lib/vigil/share";
import {
  resumeAudio,
  setMuted as setAudioMuted,
  setSfxLevel,
  sfxBoot,
  sfxCraft,
  sfxDoor,
  sfxFail,
  sfxPick,
  sfxWin,
  startDrone,
  stopDrone,
  unlockAudio,
} from "@/lib/vigil/audio";
import { BESTIARY, LORE } from "@/lib/vigil/lore";
import { SIGNAL_COPY, guestCap } from "@/lib/vigil/guests";
import { civilDate, dailySeedNum, fmtRemain, packSea, tideWindow, todayClimate, todaySignals, unpackSea, type TidePhase } from "@/lib/vigil/calendar";
import { endingBody, endingTitle } from "@/lib/vigil/endings";
import { askPersist } from "@/lib/vigil/safe";
import { hasMark, missingCraft, useVigil, type Diff } from "@/lib/vigil/store";
import { NODES, nodeById, type MapNode, type NodeId } from "@/lib/vigil/world";
import type { BodyKind, ClimateId, Guest, NightLog, PlayKind, Side, SpawnSpec } from "@/lib/vigil/types";
import { toast } from "sonner";

type Phase = "boot" | "warn" | "keep" | "chart" | "hold" | "play" | "dawn" | "altar" | "dead" | "journal" | "settings" | "sea" | "credits" | "ending" | "guests";

interface Run {
  seed: number;
  node: NodeId;
  kind: PlayKind;
  daily: boolean;
  started: number;
}

const idleHud = (): Hud => ({
  integrity: 3,
  oil: 60,
  judged: 0,
  quota: 4,
  flares: 1,
  side: "beam",
  dist: "far",
  hint: "",
  reveal: "",
  result: null,
  heading: -Math.PI / 2,
  beat: 0,
  canSkip: false,
  timeLeft: 180,
  threat: false,
  wreckPlus: "",
});

export function VigilApp() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<VigilEngine | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const hiddenAt = useRef(0);
  const runRef = useRef<Run | null>(null);
  const save = useVigil();
  const lang = save.lang;
  const [phase, setPhase] = useState<Phase>("boot");
  const [run, setRun] = useState<Run | null>(null);
  const [hud, setHud] = useState<Hud>(idleHud);
  const [mounted, setMounted] = useState(false);
  const [tide, setTide] = useState({
    open: false,
    until: 0,
    hour: 12,
    phase: "arriving" as TidePhase,
    claimed: false,
    date: "",
    untilLabel: "18:00",
    missed: false,
  });
  const [tideRemain, setTideRemain] = useState("");
  const [paused, setPaused] = useState(false);
  const [caption, setCaption] = useState("");
  const [canvasOk, setCanvasOk] = useState(true);
  const [settingsFrom, setSettingsFrom] = useState<Phase>("boot");
  const [log, setLog] = useState<NightLog | null>(null);
  const [offers, setOffers] = useState<RelicId[]>([]);
  const [afterDawn, setAfterDawn] = useState<"keep" | "dead" | "ending" | "altar">("keep");
  const [leaveAsk, setLeaveAsk] = useState(false);
  const aimHeld = useRef({ left: false, right: false, focus: false });
  const signals = todaySignals(save.nightIndex);
  const dailyClimate = todayClimate();
  runRef.current = run;

  useEffect(() => {
    setMounted(true);
    askPersist();
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mq.matches && !useVigil.getState().tutorialDone) save.setMotion(true);
    const st = useVigil.getState();
    document.documentElement.lang = st.lang;
    if (!st.lang) st.setLang(navigator.language.startsWith("en") ? "en" : "es");
    setSfxLevel(st.sfxVol / 100);
    if (st.oil === 0 && st.nightsPlayed === 0) st.grantKit();
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.classList.toggle("vigil-big", save.bigType);
    document.documentElement.classList.toggle("vigil-contrast", save.contrast);
  }, [lang, save.bigType, save.contrast]);

  useEffect(() => {
    setAudioMuted(save.muted);
    setSfxLevel(save.sfxVol / 100);
    engineRef.current?.syncOpts({ muted: save.muted, reducedMotion: save.reducedMotion, shake: save.shake });
  }, [save.muted, save.reducedMotion, save.sfxVol, save.shake]);

  useEffect(() => {
    const tick = () => {
      const t = tideWindow(Date.now(), useVigil.getState().dailyClaimedDate);
      setTide(t);
      const label = t.phase === "arriving" ? vt(useVigil.getState().lang, "tideAt18") : vt(useVigil.getState().lang, "tideAt8");
      setTideRemain(fmtRemain(t.until, label));
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [save.dailyClaimedDate, lang]);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible") {
        resumeAudio();
        if (hiddenAt.current > 0) {
          const dt = (Date.now() - hiddenAt.current) / 1000;
          hiddenAt.current = 0;
          engineRef.current?.catchUp(dt);
        }
      } else if (engineRef.current?.isLive) hiddenAt.current = Date.now();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  const bootIdle = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    engineRef.current?.stop();
    try {
      const night = makeVigil({ node: nodeById("calm"), nightIndex: 1, seed: 1, kind: "watch", diff: "norm", lastre: false });
      const eng = new VigilEngine(canvas, night, baseOpts("watch"));
      engineRef.current = eng;
      eng.start("idle");
      setCanvasOk(true);
    } catch {
      setCanvasOk(false);
    }
  }, [lang, save.reducedMotion, save.villageLights]);

  function baseOpts(kind: PlayKind, extras: Partial<EngineOpts> = {}): EngineOpts {
    const st = useVigil.getState();
    return {
      reducedMotion: st.reducedMotion,
      muted: extras.muted ?? st.muted,
      kind,
      oil: st.oil,
      flares: st.flares,
      integrity: st.integrity,
      wick: st.wicks > 0,
      relics: st.relics,
      villageLights: st.villageLights,
      contrast: st.contrast,
      aimAssist: st.aimAssist || st.difficulty === "easy",
      shake: st.shake,
      lang: st.lang,
      today: todaySignals(st.nightIndex),
      tut1: vt(st.lang, "tut1"),
      tut2: vt(st.lang, "tut2"),
      tut2b: vt(st.lang, "tut2b"),
      tut3: vt(st.lang, "tut3"),
      fpsCap: st.fpsCap,
      onCaption: (k: string) => {
        if (!useVigil.getState().captions) return;
        const text = vt(st.lang, k as Parameters<typeof vt>[1]);
        setCaption(text);
        window.setTimeout(() => setCaption((c) => (c === text ? "" : c)), 1800);
      },
      onHud: (h: Hud) => setHud({ ...h }),
      onBeast: (id: string) => useVigil.getState().unlockBeast(id),
      onLine: (es: string, en: string) => {
        if (!es && !en) return;
        toast.message(st.lang === "es" ? es : en);
      },
      onEnd: (result, h, nightLog) => onNightEnd(result, h, nightLog),
      onAway: () => toast.message(vt(st.lang, "looked")),
      ...extras,
    };
  }

  useEffect(() => {
    bootIdle();
    const onResize = () => engineRef.current?.resize();
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      engineRef.current?.stop();
    };
  }, [bootIdle]);

  function hushThenIdle() {
    stopDrone();
    bootIdle();
    if (!useVigil.getState().muted) startDrone();
  }

  function pointer(e: React.PointerEvent) {
    const root = rootRef.current;
    if (!root) return;
    engineRef.current?.setPointer(e.clientX - root.getBoundingClientRect().left, e.clientY - root.getBoundingClientRect().top);
  }

  function isChrome(t: EventTarget | null) {
    return t instanceof HTMLElement && Boolean(t.closest("button, a, input, select, textarea, [data-chrome]"));
  }

  function playNight(next: Run, practice?: SpawnSpec[]) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const st = useVigil.getState();
    if (next.kind === "watch" && st.wicks > 0) useVigil.setState({ wicks: st.wicks - 1 });
    const node = nodeById(next.node);
    const night = makeVigil({
      node,
      nightIndex: st.nightIndex,
      seed: next.seed,
      kind: next.kind,
      diff: st.difficulty,
      lastre: st.relics.includes("lastre"),
      practice,
    });
    engineRef.current?.stop();
    startDrone();
    const eng = new VigilEngine(canvas, night, baseOpts(next.kind, { muted: st.muted }));
    engineRef.current = eng;
    eng.start("play");
    setHud(idleHud());
    setPhase("play");
    setPaused(false);
    setLog(null);
    const last = st.relics[st.relics.length - 1];
    if (last && next.kind === "watch") {
      const r = RELICS[last];
      toast.message(st.lang === "es" ? r.hintEs : r.hintEn);
    }
  }

  function onNightEnd(result: "won" | "lost", _h: Hud, nightLog: NightLog) {
    setPaused(false);
    setLog(nightLog);
    const cur = runRef.current;
    const store = useVigil.getState();
    if (cur?.kind === "tutorial") {
      store.finishTutorial(3);
      store.grantKit();
      toast.message(vt(store.lang, "yours"));
      if (nightLog.visitorsOpened > 0) toast.message(vt(store.lang, "tut2dawn"));
      sfxWin();
      setPhase("keep");
      hushThenIdle();
      return;
    }
    if (cur?.kind === "practice") {
      if (result === "lost") sfxFail();
      else sfxWin();
      setPhase("keep");
      hushThenIdle();
      return;
    }
    if (result === "lost") {
      sfxFail();
      setPhase("dead");
      hushThenIdle();
      return;
    }
    const completed = store.nightIndex;
    const cap = guestCap(store.relics.includes("lastre"));
    let guests = [...store.guests];
    const killedTonight = store.pendingKill;
    if (killedTonight) {
      const i = guests.findIndex((g) => g.kind === "human");
      if (i >= 0) guests = guests.filter((_, j) => j !== i);
    }
    guests = [...guests, ...nightLog.guests].slice(0, cap);
    const humansNet = nightLog.humansOpened - nightLog.humansBurned - nightLog.humansLeft;
    const daily = Boolean(cur?.daily);
    sfxWin();
    const ending = store.applyDawn({
      oilSpent: nightLog.oilSpent,
      cargo: { oil: nightLog.cargoOil, timber: nightLog.cargoTimber, iron: nightLog.cargoIron },
      guests,
      humansBurned: nightLog.humansBurned,
      visitorsAdmitted: nightLog.visitorsOpened,
      humansNet,
      daily,
    });
    const date = civilDate();
    store.addJournal({
      id: `${date}-${completed}`,
      date,
      night: completed,
      titleEs: `Noche ${completed}`,
      titleEn: `Night ${completed}`,
      bodyEs: `Salvados ${nightLog.humansOpened}. Quemados ${nightLog.humansBurned}. Visitantes ${nightLog.visitorsOpened}. Aceite ${nightLog.cargoOil}.${killedTonight ? " Uno de los nuestros no amaneció." : ""}`,
      bodyEn: `Saved ${nightLog.humansOpened}. Burned ${nightLog.humansBurned}. Visitors ${nightLog.visitorsOpened}. Oil ${nightLog.cargoOil}.${killedTonight ? " One of ours did not see dawn." : ""}`,
    });
    let next: "keep" | "dead" | "ending" | "altar" = "keep";
    if (ending) next = "ending";
    if (guests.filter((g) => g.kind === "human").length === 0 && completed > 1) {
      next = useVigil.getState().emptyDawnStreak >= 3 ? "ending" : "dead";
    } else if ([3, 6, 9].includes(completed) && store.relics.length < 3) {
      setOffers(draftRelics(store.relics, cur?.seed ?? 1));
      next = "altar";
    }
    setAfterDawn(next);
    setPhase("dawn");
    hushThenIdle();
  }

  function skipTutorial() {
    if (!hud.canSkip && phase === "play") return;
    engineRef.current?.stop();
    const st = useVigil.getState();
    st.finishTutorial(3);
    st.grantKit();
    toast.message(vt(lang, "yours"));
    setPhase("keep");
    hushThenIdle();
  }

  function enterKeep() {
    unlockAudio();
    sfxBoot();
    sfxDoor();
    startDrone();
    if (!useVigil.getState().warnSeen) {
      setPhase("warn");
      return;
    }
    if (!useVigil.getState().tutorialDone) {
      beginTutorial();
      return;
    }
    setPhase("keep");
  }

  function beginTutorial() {
    const next: Run = { seed: 1, node: "calm", kind: "tutorial", daily: false, started: Date.now() };
    setRun(next);
    runRef.current = next;
    playNight(next);
  }

  function beginLight(nodeId: NodeId, daily: boolean) {
    const st = useVigil.getState();
    if (st.oil < 1) {
      toast.message(vt(lang, "noOil"));
      return;
    }
    if (st.ending) {
      setPhase("ending");
      return;
    }
    if (!st.tutorialDone) {
      beginTutorial();
      return;
    }
    const next: Run = { seed: daily ? dailySeedNum() : ((Math.random() * 0xffffffff) >>> 0), node: nodeId, kind: "watch", daily, started: Date.now() };
    setRun(next);
    runRef.current = next;
    playNight(next);
  }

  function applyAim() {
    const h = aimHeld.current;
    engineRef.current?.setSteer((h.right ? 1 : 0) - (h.left ? 1 : 0));
    engineRef.current?.setKeyFocus(h.focus);
  }

  useEffect(() => {
    const held = aimHeld.current;
    const down = (e: KeyboardEvent) => {
      unlockAudio();
      if (e.code === "ArrowLeft" || e.code === "KeyA") held.left = true;
      else if (e.code === "ArrowRight" || e.code === "KeyD") held.right = true;
      else if (e.code === "Space" || e.code === "ShiftLeft" || e.code === "ShiftRight") {
        e.preventDefault();
        held.focus = true;
      } else if (e.code === "KeyC" && phase === "play" && !e.repeat) engineRef.current?.openCone();
      else if (e.code === "KeyR" && phase === "play" && !e.repeat) engineRef.current?.closeCone();
      else if ((e.code === "KeyX" || e.code === "KeyQ") && phase === "play" && !e.repeat) engineRef.current?.burnCone();
      else if (e.code === "KeyF" && phase === "play") engineRef.current?.flareAll();
      else if ((e.code === "Escape" || e.code === "KeyP") && phase === "play") {
        e.preventDefault();
        const nextPause = !engineRef.current?.isPaused;
        engineRef.current?.setPaused(nextPause);
        setPaused(nextPause);
      } else if ((e.code === "Enter" || e.code === "KeyE") && phase === "boot") enterKeep();
      applyAim();
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === "ArrowLeft" || e.code === "KeyA") held.left = false;
      else if (e.code === "ArrowRight" || e.code === "KeyD") held.right = false;
      else if (e.code === "Space" || e.code === "ShiftLeft" || e.code === "ShiftRight") held.focus = false;
      applyAim();
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [phase, lang]);

  const canLight = save.oil >= 1 && !save.ending;
  const lightWhy = save.ending ? vt(lang, "ending") : save.oil < 1 ? vt(lang, "noOil") : "";
  const nightName = run ? (lang === "es" ? nodeById(run.node).nameEs : nodeById(run.node).nameEn) : "";

  return (
    <div
      ref={rootRef}
      className="relative h-dvh min-h-dvh overflow-hidden bg-background text-foreground"
      onPointerMove={pointer}
      onPointerDown={(e) => {
        if (isChrome(e.target)) return;
        pointer(e);
        engineRef.current?.setFocus(true);
      }}
      onPointerUp={() => engineRef.current?.setFocus(false)}
      onPointerCancel={() => engineRef.current?.setFocus(false)}
      onPointerLeave={() => engineRef.current?.setFocus(false)}
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full touch-none"
        role="application"
        tabIndex={0}
        aria-label={vt(lang, "hint")}
        aria-describedby="vigil-keys"
      />
      {!canvasOk ? (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-background px-6 text-center">
          <p className="max-w-sm text-sm text-muted-foreground">{vt(lang, "canvasFail")}</p>
          <Button onClick={() => { setCanvasOk(true); bootIdle(); }}>{vt(lang, "retryPage")}</Button>
        </div>
      ) : null}

      <p id="vigil-keys" className="sr-only">{vt(lang, "keys")}</p>
      <div className="sr-only" aria-live="assertive" aria-atomic="true">
        {phase === "dead" ? vt(lang, "liveLost") : phase === "dawn" ? vt(lang, "liveWin") : hud.hint}
      </div>

      <header className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between p-4 pt-[max(1rem,env(safe-area-inset-top))] sm:p-6">
        <div>
          {phase === "boot" ? (
            <p className="sr-only">Vigil</p>
          ) : (
            <>
              <p className="font-display text-2xl leading-none tracking-tight">Vigil</p>
              {phase === "play" ? (
                <p className="mt-1 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  {run?.kind === "tutorial" ? vt(lang, "learn") : `${vt(lang, "nightOf")} ${save.nightIndex}`}
                  {" · "}
                  {nightName}
                </p>
              ) : (
                <p className="mt-1 text-xs uppercase tracking-[0.22em] text-muted-foreground lantern-breathe">{vt(lang, "kicker")}</p>
              )}
            </>
          )}
        </div>
        <div className="pointer-events-auto flex items-center gap-1" data-chrome>
          <LangSwitch lang={lang} onChange={save.setLang} />
          <button type="button" className="flex size-11 items-center justify-center rounded-md text-muted-foreground" onClick={() => save.setMuted(!save.muted)} aria-label={vt(lang, "mute")} aria-pressed={save.muted}>
            {save.muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
          </button>
          {phase === "play" ? (
            <button
              type="button"
              className="flex size-11 items-center justify-center rounded-md text-muted-foreground"
              onClick={() => {
                const nextPause = !engineRef.current?.isPaused;
                engineRef.current?.setPaused(nextPause);
                setPaused(nextPause);
              }}
              aria-label={vt(lang, "pause")}
            >
              <Pause className="size-4" />
            </button>
          ) : (
            <button
              type="button"
              className="flex size-11 items-center justify-center rounded-md text-muted-foreground"
              onClick={() => {
                setSettingsFrom(phase === "boot" || phase === "warn" ? "boot" : "keep");
                setPhase("settings");
              }}
              aria-label={vt(lang, "settings")}
            >
              <Settings className="size-4" />
            </button>
          )}
        </div>
      </header>

      {phase === "play" ? (
        <PlayHud
          lang={lang}
          hud={hud}
          flares={hud.flares}
          onFlare={() => engineRef.current?.flareAll()}
          onOpen={() => engineRef.current?.openCone()}
          onClose={() => engineRef.current?.closeCone()}
          onBurn={() => engineRef.current?.burnCone()}
          onSkip={skipTutorial}
        />
      ) : null}

      {phase === "play" && !paused ? (
        <TouchPad
          lang={lang}
          onAim={(k, v) => {
            aimHeld.current[k] = v;
            applyAim();
          }}
          onOpen={() => engineRef.current?.openCone()}
          onClose={() => engineRef.current?.closeCone()}
          onBurn={() => engineRef.current?.burnCone()}
        />
      ) : null}

      {phase === "boot" ? <BootScreen lang={lang} mounted={mounted} onEnter={enterKeep} /> : null}
      {phase === "warn" ? (
        <WarnSheet
          lang={lang}
          onGo={() => {
            useVigil.getState().setFlag("warnSeen", true);
            sfxDoor();
            if (!useVigil.getState().tutorialDone) beginTutorial();
            else setPhase("keep");
          }}
        />
      ) : null}

      {phase === "keep" ? (
        <KeepDock
          lang={lang}
          canLight={canLight}
          lightWhy={lightWhy}
          tidePhase={tide.phase}
          tideRemain={tideRemain}
          tideMissed={tide.missed}
          climateName={lang === "es" ? nodeById(save.climate).nameEs : nodeById(save.climate).nameEn}
          onLight={() => beginLight(save.climate, tide.phase === "open" && save.climate === dailyClimate)}
          onChart={() => setPhase("chart")}
          onHold={() => setPhase("hold")}
          onJournal={() => setPhase("journal")}
          onGuests={() => setPhase("guests")}
          onSea={() => setPhase("sea")}
        />
      ) : null}

      {phase === "chart" ? (
        <ChartSheet
          lang={lang}
          first={save.nightsPlayed === 0}
          oil={save.oil}
          tidePhase={tide.phase}
          dailyClimate={dailyClimate}
          onBack={() => setPhase("keep")}
          onPick={(n) => {
            const cost = save.nightsPlayed === 0 || n.id === "today" ? 0 : n.cost;
            if (cost > 0 && save.oil < cost) {
              toast.message(lang === "es" ? `Te faltan ${cost - save.oil} aceite` : `You need ${cost - save.oil} oil`);
              return;
            }
            if (cost > 0 && !useVigil.getState().spend({ oil: cost })) {
              toast.message(vt(lang, "noOil"));
              return;
            }
            if (n.id !== "today") useVigil.getState().setClimate(n.id as ClimateId);
            else useVigil.getState().setClimate(dailyClimate);
            beginLight(n.id === "today" ? dailyClimate : n.id, n.id === "today" && tide.phase === "open");
          }}
        />
      ) : null}

      {phase === "hold" ? <HoldSheet lang={lang} onBack={() => setPhase("keep")} /> : null}
      {phase === "journal" ? <JournalSheet lang={lang} onBack={() => setPhase("keep")} /> : null}
      {phase === "guests" ? <GuestSheet lang={lang} signals={signals} onBack={() => setPhase("keep")} /> : null}
      {phase === "settings" ? (
        <SettingsSheet
          lang={lang}
          onBack={() => setPhase(settingsFrom === "play" ? "play" : save.tutorialDone ? "keep" : "boot")}
          onCredits={() => setPhase("credits")}
          onPractice={() => setPhase("sea")}
        />
      ) : null}
      {phase === "sea" ? (
        <SeaSheet
          lang={lang}
          onBack={() => setPhase("keep")}
          onPlay={(script, seed) => {
            const next: Run = { seed, node: save.climate, kind: "practice", daily: false, started: Date.now() };
            setRun(next);
            runRef.current = next;
            playNight(next, script);
          }}
        />
      ) : null}
      {phase === "credits" ? <CreditsSheet lang={lang} onBack={() => setPhase("settings")} /> : null}

      {phase === "play" && paused ? (
        <PauseSheet
          lang={lang}
          hud={hud}
          onResume={() => {
            engineRef.current?.setPaused(false);
            setPaused(false);
          }}
          onKeep={() => setLeaveAsk(true)}
          onSettings={() => {
            setSettingsFrom("play");
            setPhase("settings");
          }}
        />
      ) : null}

      {leaveAsk ? (
        <div className="absolute inset-0 z-50 flex items-end justify-center bg-background/80 p-4 backdrop-blur-sm sm:items-center">
          <div data-chrome className="w-full max-w-sm rounded-xl bg-card p-5">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{vt(lang, "awayTitle")}</p>
            <p className="mt-3 text-sm text-muted-foreground">{vt(lang, "abandonWarn")}</p>
            <div className="mt-5 flex flex-col gap-2">
              <Button onClick={() => setLeaveAsk(false)}>{vt(lang, "stay")}</Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setLeaveAsk(false);
                  setPaused(false);
                  engineRef.current?.catchUp(30);
                }}
              >
                {vt(lang, "leave")}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {phase === "dawn" && log ? (
        <DawnSheet
          lang={lang}
          log={log}
          signals={signals}
          onDone={() => {
            if (afterDawn === "altar") setPhase("altar");
            else if (afterDawn === "dead") setPhase("dead");
            else if (afterDawn === "ending") setPhase("ending");
            else setPhase("keep");
          }}
        />
      ) : null}

      {phase === "altar" ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex justify-center p-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:p-6">
          <div data-chrome className="pointer-events-auto w-full max-w-lg rounded-xl bg-card p-4 shadow-[var(--shadow-border)] rise sm:p-6">
            <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">{vt(lang, "choose")}</p>
            <div className="mt-5 grid gap-2 sm:grid-cols-3">
              {offers.map((id, i) => {
                const r = RELICS[id];
                return (
                  <button
                    key={`${id}-${i}`}
                    type="button"
                    onClick={() => {
                      useVigil.getState().addRelic(id);
                      sfxPick();
                      toast.message(lang === "es" ? r.hintEs : r.hintEn);
                      setPhase("keep");
                    }}
                    className="rounded-sm bg-secondary px-3 py-3 text-left"
                  >
                    <p className="font-display text-xl leading-none">{lang === "es" ? r.nameEs : r.nameEn}</p>
                    <p className="mt-2 text-xs text-muted-foreground">{lang === "es" ? r.descEs : r.descEn}</p>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}

      {phase === "dead" ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex justify-center p-4 pb-[max(2rem,env(safe-area-inset-bottom))]">
          <div data-chrome className="pointer-events-auto w-full max-w-md rounded-xl bg-card p-5">
            <p className="font-display text-3xl leading-none">{vt(lang, "dead")}</p>
            <Button className="mt-6 w-full" onClick={() => setPhase("keep")}>{vt(lang, "retry")}</Button>
          </div>
        </div>
      ) : null}

      {phase === "ending" && save.ending ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex justify-center p-4 pb-[max(2rem,env(safe-area-inset-bottom))]">
          <div data-chrome className="pointer-events-auto w-full max-w-md rounded-xl bg-card p-5">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{vt(lang, "ending")}</p>
            <h1 className="mt-2 font-display text-3xl leading-none">{endingTitle(save.ending, lang)}</h1>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{endingBody(save.ending, lang)}</p>
            <Button
              className="mt-6 w-full"
              onClick={() => {
                useVigil.getState().grantKit();
                useVigil.setState({
                  nightIndex: 1,
                  guests: [],
                  relics: [],
                  villageLights: 0,
                  ending: null,
                  emptyDawnStreak: 0,
                  humansBurned: 0,
                  visitorsAdmitted: 0,
                  nightsPlayed: 0,
                });
                setPhase("keep");
              }}
            >
              {vt(lang, "again")}
            </Button>
          </div>
        </div>
      ) : null}

      {save.captions && caption ? (
        <p className="pointer-events-none absolute bottom-28 left-0 right-0 z-40 text-center text-xs uppercase tracking-[0.16em] text-muted-foreground" aria-live="polite">
          {caption}
        </p>
      ) : null}
    </div>
  );
}

function BootScreen({ lang, mounted, onEnter }: { lang: VLang; mounted: boolean; onEnter: () => void }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-30 flex flex-col justify-end sm:flex-row sm:items-end sm:justify-start boot-veil">
      <div className="pointer-events-auto w-full max-w-lg px-6 pb-[max(2.5rem,env(safe-area-inset-bottom))] sm:mb-20 sm:ml-10 sm:max-w-sm sm:pb-8">
        <p className="stagger-item text-xs uppercase tracking-[0.32em] text-muted-foreground">{vt(lang, "village")}</p>
        <h1 className="stagger-item mt-3 font-display text-6xl leading-[0.9] tracking-tight sm:text-7xl">Vigil</h1>
        <p className="stagger-item mt-4 max-w-md text-sm leading-relaxed text-muted-foreground sm:text-base">{vt(lang, "contract")}</p>
        <p className="stagger-item mt-3 text-sm text-muted-foreground">{vt(lang, "tideLine")}</p>
        {mounted ? <p className="stagger-item mt-3 text-xs uppercase tracking-[0.16em] text-muted-foreground">{seasonLine(lang)}</p> : null}
        <div className="stagger-item mt-6">
          <Button size="lg" onClick={onEnter}>{vt(lang, "enter")}</Button>
        </div>
      </div>
    </div>
  );
}

function KeepDock({
  lang,
  canLight,
  lightWhy,
  tidePhase,
  tideRemain,
  tideMissed,
  climateName,
  onLight,
  onChart,
  onHold,
  onJournal,
  onGuests,
  onSea,
}: {
  lang: VLang;
  canLight: boolean;
  lightWhy: string;
  tidePhase: TidePhase;
  tideRemain: string;
  tideMissed: boolean;
  climateName: string;
  onLight: () => void;
  onChart: () => void;
  onHold: () => void;
  onJournal: () => void;
  onGuests: () => void;
  onSea: () => void;
}) {
  const save = useVigil();
  const tideCopy =
    tidePhase === "open" ? vt(lang, "tideOpen") : tidePhase === "claimed" ? vt(lang, "tideClaimed") : vt(lang, "tideArriving");
  const sub =
    tidePhase === "open"
      ? `${climateName} · ${vt(lang, "pecioLine")}`
      : tidePhase === "claimed"
        ? vt(lang, "tideClaimed")
        : tideMissed
          ? vt(lang, "tideClosed")
          : vt(lang, "tidePractice");
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 keep-veil">
      <div className="mx-auto flex w-full max-w-lg justify-center p-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:p-6">
        <div data-chrome className="pointer-events-auto w-full rounded-xl bg-card/95 p-4 shadow-[var(--shadow-border)] rise sm:p-6">
          <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
            {vt(lang, "nightOf")} {save.nightIndex} / 12 · {tideCopy} {tideRemain}
          </p>
          <p className="mt-2 font-display text-3xl leading-none tracking-tight">{climateName}</p>
          <p className="mt-2 text-xs uppercase tracking-[0.14em] text-muted-foreground">{sub}</p>
          <p className="mt-3 text-sm text-muted-foreground">
            {vt(lang, "lights")} {save.villageLights}/7 · {vt(lang, "oil")} {save.oil}
          </p>
          <div className="mt-5">
            <Button size="lg" className="w-full" onClick={onLight} disabled={!canLight} title={lightWhy}>
              <Flame className="size-4" />
              {canLight ? `${vt(lang, "light")} · ${climateName}` : lightWhy || vt(lang, "noOil")}
            </Button>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Button variant="secondary" onClick={onChart}><Compass className="size-4" />{vt(lang, "chart")}</Button>
            <Button variant="secondary" onClick={onHold}><Package className="size-4" />{vt(lang, "hold")}</Button>
          </div>
          <div className="mt-2 grid grid-cols-3 gap-2">
            <Button variant="ghost" onClick={onJournal}><BookOpen className="size-4" />{vt(lang, "journal")}</Button>
            <Button variant="ghost" onClick={onGuests}><Users className="size-4" />{vt(lang, "guests")}</Button>
            <Button variant="ghost" onClick={onSea}><Waves className="size-4" />{vt(lang, "sea")}</Button>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            {vt(lang, "oil")} {save.oil} · {vt(lang, "timber")} {save.timber} · {vt(lang, "iron")} {save.iron} · {vt(lang, "flares")} {save.flares}
          </p>
        </div>
      </div>
    </div>
  );
}

function ChartSheet({
  lang,
  first,
  oil,
  tidePhase,
  dailyClimate,
  onBack,
  onPick,
}: {
  lang: VLang;
  first: boolean;
  oil: number;
  tidePhase: TidePhase;
  dailyClimate: ClimateId;
  onBack: () => void;
  onPick: (n: MapNode) => void;
}) {
  const today = nodeById("today");
  const rest = NODES.filter((n) => n.id !== dailyClimate && n.id !== "today");
  const nodes: MapNode[] = [today, ...rest];
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex justify-center p-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
      <div data-chrome className="chart-paper pointer-events-auto w-full max-w-lg rounded-xl p-4 sm:p-6">
        <div className="flex items-center justify-between">
          <p className="text-xs uppercase tracking-[0.2em] text-ink-muted">{vt(lang, "chart")}</p>
          <button type="button" className="h-11 px-2 text-sm text-ink-muted" onClick={onBack}>{vt(lang, "back")}</button>
        </div>
        <p className="mt-2 text-sm text-ink-muted">{first ? vt(lang, "firstFree") : vt(lang, "roomChartHint")}</p>
        <div className="mt-4 grid gap-2">
          {nodes.map((n) => {
            const hot = n.id === "today";
            const cost = first || hot ? 0 : n.cost;
            const locked = cost > 0 && oil < cost;
            const miss = locked ? (lang === "es" ? `faltan ${cost - oil} aceite` : `need ${cost - oil} oil`) : "";
            return (
              <button
                key={n.id}
                type="button"
                disabled={locked || (hot && tidePhase !== "open")}
                onClick={() => onPick(n)}
                className={`rounded-sm px-3 py-3 text-left ${hot ? "bg-ink text-paper node-pulse" : "bg-ink/5 text-ink"}`}
              >
                <p className="font-display text-xl leading-none">
                  {lang === "es" ? n.nameEs : n.nameEn}
                  {hot ? <span className="ml-2 font-sans text-xs uppercase tracking-[0.14em]">{vt(lang, "todayMark")}</span> : null}
                </p>
                <p className="mt-1 text-xs opacity-80">{lang === "es" ? n.blurbEs : n.blurbEn}</p>
                <p className="mt-1 text-xs opacity-70">{miss || (cost ? `${cost} ${vt(lang, "oil").toLowerCase()}` : hot ? (tidePhase === "open" ? vt(lang, "tideOpen") : vt(lang, "tideArriving")) : "")}</p>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function HoldSheet({ lang, onBack }: { lang: VLang; onBack: () => void }) {
  const save = useVigil();
  function craft(fn: () => boolean, miss: string) {
    if (fn()) {
      sfxCraft();
      toast.success(vt(lang, "crafted"));
    } else toast.message(miss || vt(lang, "need"));
  }
  const missF = missingCraft(save, { iron: 3, oil: 2 }, lang);
  const missW = missingCraft(save, { timber: 6, oil: 4 }, lang);
  const missR = missingCraft(save, { timber: 5 }, lang);
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex justify-center p-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
      <div data-chrome className="chart-paper pointer-events-auto w-full max-w-md rounded-xl p-4 sm:p-6">
        <div className="flex items-center justify-between">
          <p className="text-xs uppercase tracking-[0.2em] text-ink-muted">{vt(lang, "hold")}</p>
          <button type="button" className="h-11 px-2 text-sm text-ink-muted" onClick={onBack}>{vt(lang, "back")}</button>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          <StatInk label={vt(lang, "oil")} value={String(save.oil)} />
          <StatInk label={vt(lang, "timber")} value={String(save.timber)} />
          <StatInk label={vt(lang, "iron")} value={String(save.iron)} />
        </div>
        <div className="mt-4 space-y-2">
          <CraftRow title={vt(lang, "craftFlare")} cost={missF || vt(lang, "craftFlareCost")} hint={vt(lang, "craftFlareHint")} onClick={() => craft(() => save.craftFlare(), missF)} />
          <CraftRow title={vt(lang, "craftWick")} cost={missW || vt(lang, "craftWickCost")} hint={vt(lang, "craftWickHint")} onClick={() => craft(() => save.craftWick(), missW)} />
          <CraftRow title={vt(lang, "craftRepair")} cost={missR || vt(lang, "craftRepairCost")} hint={vt(lang, "craftRepairHint")} onClick={() => craft(() => save.craftRepair(), missR)} />
        </div>
      </div>
    </div>
  );
}

function CraftRow({ title, cost, hint, onClick }: { title: string; cost: string; hint: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex w-full items-start justify-between rounded-sm bg-ink/5 px-3 py-3 text-left">
      <span>
        <span className="block font-display text-lg leading-none text-ink">{title}</span>
        <span className="mt-1 block text-xs text-ink-muted">{hint}</span>
      </span>
      <span className="text-xs uppercase tracking-[0.1em] text-ink-muted">{cost}</span>
    </button>
  );
}

function PlayHud({
  lang,
  hud,
  flares,
  onFlare,
  onOpen,
  onClose,
  onBurn,
  onSkip,
}: {
  lang: VLang;
  hud: Hud;
  flares: number;
  onFlare: () => void;
  onOpen: () => void;
  onClose: () => void;
  onBurn: () => void;
  onSkip: () => void;
}) {
  const pips = Math.max(3, hud.integrity);
  return (
    <div className="pointer-events-none absolute inset-x-0 top-20 z-10 px-4 sm:px-6">
      {hud.hint ? <p className="mb-2 text-center text-sm text-foreground rise">{hud.hint}</p> : null}
      {hud.reveal ? <p className="mb-2 text-center text-sm text-primary">{hud.reveal}</p> : null}
      <div className="mx-auto flex max-w-lg items-center justify-center gap-1.5">
        {Array.from({ length: pips }, (_, i) => (
          <Heart key={i} className={`size-4 ${i < hud.integrity ? "fill-primary text-primary" : "text-destructive"}`} />
        ))}
      </div>
      <div className="mx-auto mt-3 max-w-lg space-y-2">
        <Meter icon={<Droplet className="size-3.5 text-warn" />} value={Math.min(100, hud.oil)} label={vt(lang, "oil")} hot={hud.oil < 12} />
      </div>
      <div className="mx-auto mt-3 flex max-w-lg justify-center gap-6 text-center">
        <IconStat icon={<Ship className="size-3.5" />} label={vt(lang, "judged")} value={`${hud.judged}/${hud.quota}`} />
        <IconStat icon={<Compass className="size-3.5" />} label={vt(lang, hud.side)} value={vt(lang, hud.dist)} />
        <IconStat icon={<Flame className="size-3.5" />} label={vt(lang, "flares")} value={String(flares)} />
      </div>
      {hud.wreckPlus ? <p className="mt-2 text-center font-mono text-sm text-primary">{hud.wreckPlus}</p> : null}
      <div className="pointer-events-auto mx-auto mt-4 hidden max-w-lg justify-center gap-2 sm:flex" data-chrome>
        <Button variant="secondary" size="sm" onClick={onOpen}>{vt(lang, "open")}</Button>
        <Button variant="secondary" size="sm" onClick={onClose}>{vt(lang, "close")}</Button>
        <Button variant="secondary" size="sm" onClick={onBurn}><X className="size-4" />{vt(lang, "burn")}</Button>
        <Button variant="secondary" size="sm" onClick={onFlare} disabled={flares <= 0}>{vt(lang, "flare")}</Button>
        {hud.canSkip ? <Button variant="ghost" size="sm" onClick={onSkip}>{vt(lang, "skip")}</Button> : null}
      </div>
      {hud.canSkip ? (
        <div className="pointer-events-auto mt-2 flex justify-center sm:hidden" data-chrome>
          <Button variant="ghost" size="sm" onClick={onSkip}>{vt(lang, "skip")}</Button>
        </div>
      ) : null}
    </div>
  );
}

function Meter({ icon, value, label, hot }: { icon: React.ReactNode; value: number; label: string; hot?: boolean }) {
  return (
    <div className="flex items-center gap-2" aria-label={`${label} ${Math.round(value)}`}>
      {icon}
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary">
        <div className={`h-full ${hot ? "bg-destructive" : "bg-primary"}`} style={{ width: `${Math.max(2, Math.min(100, value))}%` }} />
      </div>
    </div>
  );
}

function IconStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="min-w-16">
      <p className="flex items-center justify-center gap-1 text-xs uppercase tracking-[0.14em] text-muted-foreground">{icon}{label}</p>
      <p className="mt-1 font-mono text-sm tabular-nums">{value}</p>
    </div>
  );
}

function StatInk({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-[0.16em] text-ink-muted">{label}</p>
      <p className="mt-1 font-mono text-sm tabular-nums text-ink">{value}</p>
    </div>
  );
}

function LangSwitch({ lang, onChange }: { lang: VLang; onChange: (l: VLang) => void }) {
  return (
    <div className="flex rounded-md bg-secondary p-1 text-xs" role="group" aria-label={vt(lang, "lang")}>
      {(["es", "en"] as VLang[]).map((l) => (
        <button key={l} type="button" onClick={() => onChange(l)} aria-pressed={lang === l} aria-label={l === "es" ? "Español" : "English"} className={`h-8 min-w-10 rounded-sm px-2 ${lang === l ? "bg-card text-foreground" : "text-muted-foreground"}`}>
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

function TouchPad({
  lang,
  onAim,
  onOpen,
  onClose,
  onBurn,
}: {
  lang: VLang;
  onAim: (k: "left" | "right" | "focus", v: boolean) => void;
  onOpen: () => void;
  onClose: () => void;
  onBurn: () => void;
}) {
  function hold(k: "left" | "right" | "focus") {
    return {
      onPointerDown: (e: { preventDefault: () => void }) => {
        e.preventDefault();
        onAim(k, true);
      },
      onPointerUp: () => onAim(k, false),
      onPointerCancel: () => onAim(k, false),
      onPointerLeave: () => onAim(k, false),
    };
  }
  return (
    <div className="pointer-events-auto absolute inset-x-0 bottom-0 z-20 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:hidden" data-chrome>
      <div className="mb-2 grid grid-cols-3 gap-2">
        <Button variant="secondary" className="h-12" onClick={onOpen}>{vt(lang, "open")}</Button>
        <Button variant="secondary" className="h-12" onClick={onClose}>{vt(lang, "close")}</Button>
        <Button variant="secondary" className="h-12" onClick={onBurn}>{vt(lang, "burn")}</Button>
      </div>
      <div className="flex gap-2">
        <button type="button" className="h-16 flex-1 rounded-md bg-card/85 text-xs uppercase tracking-[0.14em]" aria-label={vt(lang, "aimLeft")} {...hold("left")}>{vt(lang, "aimLeft")}</button>
        <button type="button" className="h-16 flex-1 rounded-md bg-primary text-xs uppercase tracking-[0.14em] text-primary-foreground" aria-label={vt(lang, "focus")} {...hold("focus")}>{vt(lang, "focus")}</button>
        <button type="button" className="h-16 flex-1 rounded-md bg-card/85 text-xs uppercase tracking-[0.14em]" aria-label={vt(lang, "aimRight")} {...hold("right")}>{vt(lang, "aimRight")}</button>
      </div>
    </div>
  );
}

function WarnSheet({ lang, onGo }: { lang: VLang; onGo: () => void }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-40 flex items-end justify-center p-4 pb-[max(2rem,env(safe-area-inset-bottom))] sm:items-center">
      <div data-chrome className="pointer-events-auto w-full max-w-md rounded-xl bg-card p-5 shadow-[var(--shadow-border)] rise sm:p-6">
        <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">{vt(lang, "warnTitle")}</p>
        <p className="mt-2 text-xs uppercase tracking-[0.16em] text-muted-foreground">{vt(lang, "ageMark")}</p>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{vt(lang, "warnBody")}</p>
        <Button size="lg" className="mt-6 w-full" onClick={onGo}>{vt(lang, "warnGo")}</Button>
      </div>
    </div>
  );
}

function JournalSheet({ lang, onBack }: { lang: VLang; onBack: () => void }) {
  const save = useVigil();
  const [tab, setTab] = useState<"pages" | "bestiary" | "marks">("pages");
  const fileRef = useRef<HTMLInputElement>(null);
  const [markText, setMarkText] = useState("");
  return (
    <div className="pointer-events-none absolute inset-0 z-30 flex items-end justify-center p-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
      <div data-chrome className="chart-paper pointer-events-auto flex max-h-[min(82dvh,40rem)] w-full max-w-md flex-col overflow-hidden rounded-xl p-4 sm:p-6">
        <div className="flex shrink-0 items-center justify-between">
          <p className="text-xs uppercase tracking-[0.2em] text-ink-muted">{vt(lang, "journal")}</p>
          <button type="button" className="h-11 px-2 text-sm text-ink-muted" onClick={onBack}>{vt(lang, "back")}</button>
        </div>
        <div className="mt-3 grid shrink-0 grid-cols-3 gap-1 rounded-md bg-ink/5 p-1" role="tablist">
          {(["pages", "bestiary", "marks"] as const).map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={`h-10 rounded-sm text-xs uppercase tracking-[0.12em] ${tab === t ? "bg-ink text-paper" : "text-ink-muted"}`}
            >
              {t === "pages" ? vt(lang, "pages") : t === "bestiary" ? vt(lang, "bestiary") : vt(lang, "marks")}
            </button>
          ))}
        </div>
        <div className="mt-4 min-h-0 flex-1 overflow-y-auto pr-1" role="tabpanel">
          {tab === "pages" ? (
            <div className="space-y-4">
              {LORE.map((p) => (
                <article key={p.id}>
                  <h2 className="font-display text-xl leading-none text-ink">{lang === "es" ? p.titleEs : p.titleEn}</h2>
                  <p className="mt-2 text-sm leading-relaxed text-ink-muted">{lang === "es" ? p.bodyEs : p.bodyEn}</p>
                </article>
              ))}
              {save.journal.length ? save.journal.map((p) => (
                <article key={p.id}>
                  <h2 className="font-display text-lg leading-none text-ink">{lang === "es" ? p.titleEs : p.titleEn}</h2>
                  <p className="mt-1 text-xs text-ink-muted">{p.date}{p.blank ? ` · ${vt(lang, "blankDay")}` : ""}</p>
                  <p className="mt-2 text-sm leading-relaxed text-ink-muted">{p.blank ? vt(lang, "blankDay") : lang === "es" ? p.bodyEs : p.bodyEn}</p>
                </article>
              )) : <p className="text-sm text-ink-muted">{vt(lang, "emptyJournal")}</p>}
            </div>
          ) : null}
          {tab === "bestiary" ? (
            <div className="space-y-4">
              {BESTIARY.map((b) => {
                const open = hasMark(save.bestiary, b.id);
                return (
                  <article key={b.id} className="rounded-sm bg-ink/5 px-3 py-3">
                    <h2 className="font-display text-xl leading-none text-ink">{lang === "es" ? b.titleEs : b.titleEn}</h2>
                    <p className="mt-2 text-sm text-ink-muted">{open ? (lang === "es" ? b.bodyEs : b.bodyEn) : vt(lang, "emptyBeast")}</p>
                  </article>
                );
              })}
            </div>
          ) : null}
          {tab === "marks" ? (
            <div className="flex flex-col gap-2">
              <p className="text-sm text-ink-muted">{vt(lang, "relics")}: {relicLine(save.relics, lang)}</p>
              <p className="text-xs text-ink-muted">{vt(lang, "marksPaste")}</p>
              <textarea
                className="min-h-32 rounded-md bg-ink/5 p-3 font-mono text-xs text-ink"
                value={markText}
                onChange={(e) => setMarkText(e.target.value)}
                aria-label={vt(lang, "marks")}
              />
              <Button
                variant="secondary"
                onClick={async () => {
                  const snap = markSnap(save);
                  const text = JSON.stringify(snap, null, 2);
                  setMarkText(text);
                  try {
                    await navigator.clipboard.writeText(text);
                    toast.success(vt(lang, "shared"));
                  } catch {
                    exportMark(save, lang);
                  }
                }}
              >
                {vt(lang, "exportSave")}
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  try {
                    const raw = JSON.parse(markText) as unknown;
                    if (useVigil.getState().importSnap(raw)) toast.success(vt(lang, "imported"));
                    else toast.message(vt(lang, "need"));
                  } catch {
                    fileRef.current?.click();
                  }
                }}
              >
                {vt(lang, "importSave")}
              </Button>
              <input ref={fileRef} type="file" accept="application/json" className="hidden" onChange={(e) => importMark(e, lang)} />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function GuestSheet({ lang, signals, onBack }: { lang: VLang; signals: ReturnType<typeof todaySignals>; onBack: () => void }) {
  const save = useVigil();
  const [sel, setSel] = useState<string | null>(save.guests[0]?.id ?? null);
  const g = save.guests.find((x) => x.id === sel);
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex justify-center p-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
      <div data-chrome className="pointer-events-auto w-full max-w-md rounded-xl bg-card p-4 sm:p-6">
        <div className="flex items-center justify-between">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{vt(lang, "guests")}</p>
          <button type="button" className="h-11 px-2 text-sm text-muted-foreground" onClick={onBack}>{vt(lang, "back")}</button>
        </div>
        <p className="mt-2 text-xs uppercase tracking-[0.14em] text-muted-foreground">{vt(lang, "signals")}</p>
        <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
          {signals.map((id) => (
            <li key={id}>{lang === "es" ? SIGNAL_COPY[id].es : SIGNAL_COPY[id].en}</li>
          ))}
        </ul>
        {save.guests.length === 0 ? <p className="mt-4 text-sm text-muted-foreground">{vt(lang, "emptyGuests")}</p> : (
          <div className="mt-4 space-y-2">
            {save.guests.map((x) => (
              <button key={x.id} type="button" onClick={() => setSel(x.id)} className={`w-full rounded-sm px-3 py-2 text-left ${sel === x.id ? "bg-secondary" : "bg-secondary/40"}`}>
                <p className="font-display text-lg leading-none">{lang === "es" ? x.nameEs : x.nameEn}</p>
                <p className="mt-1 text-xs text-muted-foreground">{lang === "es" ? x.lineEs : x.lineEn}</p>
              </button>
            ))}
          </div>
        )}
        {g ? <Inspect lang={lang} g={g} /> : null}
      </div>
    </div>
  );
}

function Inspect({ lang, g }: { lang: VLang; g: Guest }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-4">
      <Button variant="secondary" className="w-full" onClick={() => setOpen((v) => !v)}>{vt(lang, "inspect")}</Button>
      {open ? (
        <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
          <li>{vt(lang, "glass")}: {g.signs.breath ? vt(lang, "fogYes") : vt(lang, "fogNo")}</li>
          <li>{vt(lang, "hands")}: {g.signs.hands === "clean" ? vt(lang, "handsClean") : g.signs.hands === "barnacle" ? vt(lang, "handsBarn") : vt(lang, "handsEarth")}</li>
          <li>{vt(lang, "step")}: {g.signs.silent ? vt(lang, "stepNo") : vt(lang, "stepYes")}</li>
        </ul>
      ) : null}
    </div>
  );
}

function DawnSheet({ lang, log, signals, onDone }: { lang: VLang; log: NightLog; signals: ReturnType<typeof todaySignals>; onDone: () => void }) {
  const save = useVigil();
  function settle() {
    const st = useVigil.getState();
    let guests = [...st.guests];
    let kill = false;
    const kept: Guest[] = [];
    for (const g of guests) {
      if (g.hunger > 0) {
        if (g.kind === "visitor") kill = true;
        toast.message(vt(lang, "starved"));
        continue;
      }
      kept.push(g);
    }
    if (kill) {
      const i = kept.findIndex((g) => g.kind === "human");
      if (i >= 0) {
        kept.splice(i, 1);
        toast.message(vt(lang, "guestKilled"));
        st.addJournal({
          id: `kill-${civilDate()}`,
          date: civilDate(),
          night: st.nightIndex,
          titleEs: vt(lang, "guestKilled"),
          titleEn: "One of ours did not see dawn.",
          bodyEs: vt(lang, "guestKilled"),
          bodyEn: "One of ours did not see dawn.",
        });
      }
    }
    st.setGuests(kept);
    onDone();
  }
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex justify-center p-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
      <div data-chrome className="pointer-events-auto max-h-[min(82dvh,40rem)] w-full max-w-md overflow-y-auto rounded-xl bg-card p-4 sm:p-6">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{vt(lang, "dawn")}</p>
        <p className="mt-2 font-display text-3xl leading-none">{vt(lang, "dawnSum")}</p>
        <p className="mt-3 text-sm text-muted-foreground">
          {vt(lang, "savedHumans")} {log.humansOpened} · {vt(lang, "letIn")} {log.visitorsOpened} · {vt(lang, "burned")} {log.humansBurned + log.visitorsBurned} · {vt(lang, "leftSea")} {log.humansLeft + log.visitorsLeft}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {vt(lang, "wreck")} +{log.cargoOil} {vt(lang, "oil").toLowerCase()} · +{log.cargoTimber} {vt(lang, "timber").toLowerCase()} · +{log.cargoIron} {vt(lang, "iron").toLowerCase()}
        </p>
        <p className="mt-2 text-xs uppercase tracking-[0.14em] text-muted-foreground">{vt(lang, "signals")}</p>
        <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
          {signals.map((id) => <li key={id}>{lang === "es" ? SIGNAL_COPY[id].es : SIGNAL_COPY[id].en}</li>)}
        </ul>
        <div className="mt-4 space-y-2">
          {save.guests.map((g) => (
            <GuestActions key={g.id} lang={lang} g={g} />
          ))}
          {save.guests.length === 0 ? <p className="text-sm text-muted-foreground">{save.nightIndex <= 2 ? vt(lang, "firstNightSafe") : vt(lang, "emptyGuests")}</p> : null}
        </div>
        <Button className="mt-5 w-full" onClick={settle}>{vt(lang, "back")}</Button>
      </div>
    </div>
  );
}

function GuestActions({ lang, g }: { lang: VLang; g: Guest }) {
  const save = useVigil();
  function feed() {
    const st = useVigil.getState();
    if (st.spend({ oil: 2 }) || st.spend({ timber: 1 })) {
      st.setGuests(st.guests.map((x) => (x.id === g.id ? { ...x, hunger: 0 } : x)));
      sfxCraft();
      toast.message(vt(lang, "fed"));
    } else toast.message(vt(lang, "need"));
  }
  function kick() {
    useVigil.getState().setGuests(useVigil.getState().guests.filter((x) => x.id !== g.id));
  }
  function burn() {
    const st = useVigil.getState();
    if (st.spend({ flares: 1 }) || st.spend({ oil: 8 })) {
      st.setGuests(st.guests.filter((x) => x.id !== g.id));
      if (g.kind === "human") useVigil.setState({ humansBurned: st.humansBurned + 1 });
    } else toast.message(vt(lang, "need"));
  }
  return (
    <div className="rounded-sm bg-secondary px-3 py-3">
      <p className="font-display text-lg leading-none">{lang === "es" ? g.nameEs : g.nameEn}</p>
      <p className="mt-1 text-xs text-muted-foreground">{lang === "es" ? g.lineEs : g.lineEn}</p>
      <p className="mt-1 text-xs text-muted-foreground">{vt(lang, "hunger")} {g.hunger}</p>
      <Inspect lang={lang} g={g} />
      <div className="mt-2 grid grid-cols-3 gap-1">
        <Button size="sm" variant="secondary" onClick={feed}>{vt(lang, "feed")}</Button>
        <Button size="sm" variant="secondary" onClick={kick}>{vt(lang, "kick")}</Button>
        <Button size="sm" variant="ghost" onClick={burn}>{vt(lang, "burnYard")}</Button>
      </div>
    </div>
  );
}

function SettingsSheet({ lang, onBack, onCredits, onPractice }: { lang: VLang; onBack: () => void; onCredits: () => void; onPractice: () => void }) {
  const save = useVigil();
  const fileRef = useRef<HTMLInputElement>(null);
  const DIFF: { id: Diff; Icon: typeof Feather }[] = [
    { id: "easy", Icon: Feather },
    { id: "norm", Icon: Sword },
    { id: "hard", Icon: Skull },
  ];
  return (
    <div className="pointer-events-none absolute inset-0 z-40 flex items-end justify-center p-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:items-center">
      <div data-chrome className="pointer-events-auto max-h-[min(82dvh,40rem)] w-full max-w-md overflow-y-auto rounded-xl bg-card p-4 shadow-[var(--shadow-border)] rise sm:p-6">
        <div className="flex items-center justify-between">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{vt(lang, "settings")}</p>
          <button type="button" className="h-11 px-2 text-sm text-muted-foreground" onClick={onBack}>{vt(lang, "back")}</button>
        </div>
        <div className="mt-4 space-y-4">
          <FlagRow label={vt(lang, "motion")} on={save.reducedMotion} onChange={save.setMotion} />
          <FlagRow label={vt(lang, "captions")} on={save.captions} onChange={(v) => save.setFlag("captions", v)} />
          <FlagRow label={vt(lang, "contrast")} on={save.contrast} onChange={(v) => save.setFlag("contrast", v)} />
          <FlagRow label={vt(lang, "bigType")} on={save.bigType} onChange={(v) => save.setFlag("bigType", v)} />
          <FlagRow label={vt(lang, "aimAssist")} on={save.aimAssist} onChange={(v) => save.setFlag("aimAssist", v)} />
          <FlagRow label={vt(lang, "shake")} on={save.shake} onChange={save.setShake} />
          <FlagRow label={vt(lang, "fpsCap")} on={save.fpsCap} onChange={(v) => save.setFlag("fpsCap", v)} />
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{vt(lang, "vol")}</p>
            <input className="vigil-range mt-2" type="range" min={0} max={100} value={save.sfxVol} aria-label={vt(lang, "vol")} onChange={(e) => save.setVol(Number(e.target.value))} />
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{vt(lang, "difficulty")}</p>
            <div className="mt-2 grid grid-cols-3 gap-1 rounded-md bg-secondary p-1">
              {DIFF.map(({ id, Icon }) => (
                <button key={id} type="button" onClick={() => save.setDiff(id)} className={`flex h-11 items-center justify-center gap-1 rounded-sm text-xs uppercase tracking-[0.12em] ${save.difficulty === id ? "bg-card text-foreground" : "text-muted-foreground"}`}>
                  <Icon className="size-3.5" />
                  {vt(lang, id)}
                </button>
              ))}
            </div>
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">{vt(lang, "keys")}</p>
          <div className="flex flex-col gap-2">
            <Button variant="secondary" onClick={() => exportMark(save, lang)}>{vt(lang, "exportSave")}</Button>
            <Button variant="secondary" onClick={() => fileRef.current?.click()}>{vt(lang, "importSave")}</Button>
            <input ref={fileRef} type="file" accept="application/json" className="hidden" onChange={(e) => importMark(e, lang)} />
            <Button variant="secondary" onClick={onPractice}>{vt(lang, "practice")}</Button>
            <Button variant="ghost" onClick={onCredits}>{vt(lang, "credits")}</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function FlagRow({ label, on, onChange }: { label: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex h-11 items-center justify-between gap-3">
      <span className="text-sm">{label}</span>
      <Switch checked={on} onCheckedChange={onChange} aria-label={label} />
    </label>
  );
}

function SeaSheet({ lang, onBack, onPlay }: { lang: VLang; onBack: () => void; onPlay: (s: SpawnSpec[], seed: number) => void }) {
  const [code, setCode] = useState("");
  const [slots, setSlots] = useState<{ kind: BodyKind; side: Side }[]>([
    { kind: "wreck", side: "star" },
    { kind: "human", side: "port" },
    { kind: "visitor", side: "beam" },
    { kind: "wreck", side: "port" },
    { kind: "visitor", side: "star" },
  ]);
  const kinds: BodyKind[] = ["wreck", "human", "visitor", "prime"];
  const sides: Side[] = ["port", "beam", "star"];
  return (
    <div className="pointer-events-none absolute inset-0 z-30 flex items-end justify-center p-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
      <div data-chrome className="pointer-events-auto max-h-[min(82dvh,40rem)] w-full max-w-md overflow-y-auto rounded-xl bg-card p-4 sm:p-6">
        <div className="flex items-center justify-between">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{vt(lang, "sea")}</p>
          <button type="button" className="h-11 px-2 text-sm text-muted-foreground" onClick={onBack}>{vt(lang, "back")}</button>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">{vt(lang, "practiceHint")}</p>
        <div className="mt-4 space-y-2">
          {slots.map((s, i) => (
            <div key={i} className="flex gap-2">
              <select className="h-11 flex-1 rounded-md bg-secondary px-2 text-sm" value={s.kind} onChange={(e) => setSlots((all) => all.map((x, j) => (j === i ? { ...x, kind: e.target.value as BodyKind } : x)))} aria-label={`${vt(lang, "wreck")} ${i + 1}`}>
                {kinds.map((k) => <option key={k} value={k}>{vt(lang, k)}</option>)}
              </select>
              <select className="h-11 flex-1 rounded-md bg-secondary px-2 text-sm" value={s.side} onChange={(e) => setSlots((all) => all.map((x, j) => (j === i ? { ...x, side: e.target.value as Side } : x)))} aria-label={vt(lang, "side")}>
                {sides.map((k) => <option key={k} value={k}>{vt(lang, k)}</option>)}
              </select>
            </div>
          ))}
        </div>
        <Button className="mt-4 w-full" onClick={() => onPlay(slots.map((s, i) => ({ ...s, at: 2 + i * 14 })), (Math.random() * 0xffffffff) >>> 0)}>
          {vt(lang, "goPractice")}
        </Button>
        <p className="mt-4 text-xs uppercase tracking-[0.14em] text-muted-foreground">{vt(lang, "pasteSeed")}</p>
        <div className="mt-2 flex gap-2">
          <input className="h-11 flex-1 rounded-md bg-secondary px-3 font-mono text-xs uppercase" value={code} onChange={(e) => setCode(e.target.value)} aria-label={vt(lang, "pasteSeed")} />
          <Button
            variant="secondary"
            onClick={() => {
              const packed = unpackSea(code);
              if (!packed) return;
              const script = (packed.slots.length ? packed.slots : slots).map((s, i) => ({
                kind: (s.kind as BodyKind) || "wreck",
                side: (s.side as Side) || "beam",
                at: 2 + i * 14,
              }));
              onPlay(script, packed.seed);
            }}
          >
            {vt(lang, "playSeed")}
          </Button>
        </div>
        <Button
          variant="ghost"
          className="mt-2 w-full"
          onClick={async () => {
            const seed = dailySeedNum() ^ Date.now();
            const c = packSea(slots, seed);
            setCode(c);
            try {
              await navigator.clipboard.writeText(c);
              toast.success(vt(lang, "seedFull"));
            } catch {
              toast.message(c);
            }
          }}
        >
          {vt(lang, "openCala")}
        </Button>
      </div>
    </div>
  );
}

function PauseSheet({ lang, hud, onResume, onKeep, onSettings }: { lang: VLang; hud: Hud; onResume: () => void; onKeep: () => void; onSettings: () => void }) {
  return (
    <div className="absolute inset-0 z-40 flex items-end justify-center bg-background/80 p-4 pb-[max(2rem,env(safe-area-inset-bottom))] backdrop-blur-sm sm:items-center" role="dialog" aria-modal="true" aria-label={vt(lang, "pause")}>
      <div data-chrome className="w-full max-w-sm rounded-xl bg-card p-5 shadow-[var(--shadow-border)] rise">
        <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">{vt(lang, "pause")}</p>
        <p className="mt-3 text-xs text-muted-foreground">{vt(lang, "keys")}</p>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <IconStat icon={<Heart className="size-3.5" />} label={vt(lang, "integrity")} value={String(hud.integrity)} />
          <IconStat icon={<Droplet className="size-3.5" />} label={vt(lang, "oil")} value={String(Math.round(hud.oil))} />
          <IconStat icon={<Ship className="size-3.5" />} label={vt(lang, "judged")} value={`${hud.judged}/${hud.quota}`} />
        </div>
        <div className="mt-5 flex flex-col gap-2">
          <Button size="lg" onClick={onResume}><Play className="size-4" />{vt(lang, "resume")}</Button>
          <Button variant="secondary" onClick={onSettings}><Settings className="size-4" />{vt(lang, "settings")}</Button>
          <Button variant="ghost" onClick={onKeep}><LogOut className="size-4" />{vt(lang, "resumeKeep")}</Button>
        </div>
      </div>
    </div>
  );
}

function CreditsSheet({ lang, onBack }: { lang: VLang; onBack: () => void }) {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-40 flex justify-center p-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
      <div data-chrome className="pointer-events-auto w-full max-w-md rounded-xl bg-card p-5">
        <div className="flex items-center justify-between">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{vt(lang, "credits")}</p>
          <button type="button" className="h-11 px-2 text-sm text-muted-foreground" onClick={onBack}>{vt(lang, "back")}</button>
        </div>
        <p className="mt-4 font-display text-3xl leading-none">Vigil</p>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{vt(lang, "creditBody")}</p>
      </div>
    </div>
  );
}

function seasonLine(lang: VLang) {
  const m = new Date().getMonth();
  if (m === 11 || m < 2) return vt(lang, "winter");
  if (m < 5) return vt(lang, "spring");
  if (m < 8) return vt(lang, "summer");
  return vt(lang, "autumn");
}

function markSnap(save: ReturnType<typeof useVigil.getState>) {
  return {
    v: 8,
    lang: save.lang,
    nightIndex: save.nightIndex,
    oil: save.oil,
    timber: save.timber,
    iron: save.iron,
    flares: save.flares,
    wicks: save.wicks,
    repairs: save.repairs,
    integrity: save.integrity,
    guests: save.guests,
    relics: save.relics,
    journal: save.journal,
    bestiary: save.bestiary,
    villageLights: save.villageLights,
    tutorialDone: save.tutorialDone,
    difficulty: save.difficulty,
    dailyClaimedDate: save.dailyClaimedDate,
    dailyTides: save.dailyTides,
    humansBurned: save.humansBurned,
    visitorsAdmitted: save.visitorsAdmitted,
    emptyDawnStreak: save.emptyDawnStreak,
    pendingKill: save.pendingKill,
    climate: save.climate,
  };
}

function exportMark(save: ReturnType<typeof useVigil.getState>, lang: VLang) {
  const snap = markSnap(save);
  const blob = new Blob([JSON.stringify(snap, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "vigil.json";
  a.click();
  URL.revokeObjectURL(a.href);
  toast.success(vt(lang, "shared"));
}

async function importMark(e: React.ChangeEvent<HTMLInputElement>, lang: VLang) {
  const f = e.target.files?.[0];
  if (!f) return;
  try {
    const raw = JSON.parse(await f.text()) as unknown;
    if (useVigil.getState().importSnap(raw)) toast.success(vt(lang, "imported"));
    else toast.message(vt(lang, "need"));
  } catch {
    toast.message(vt(lang, "need"));
  }
  e.target.value = "";
}
