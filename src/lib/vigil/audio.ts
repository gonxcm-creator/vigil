type Ctx = AudioContext;

let ctx: Ctx | null = null;
let master: GainNode | null = null;
let sfx: GainNode | null = null;
let music: GainNode | null = null;
let drone: OscillatorNode | null = null;
let droneGain: GainNode | null = null;
let sea: AudioBufferSourceNode | null = null;
let seaGain: GainNode | null = null;
let seaFilter: BiquadFilterNode | null = null;
let muted = false;
let noiseBuf: AudioBuffer | null = null;
let sfxLevel = 0.72;
let musicLevel = 0.55;

function ac(): Ctx | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const C = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new C({ latencyHint: "interactive" });
    master = ctx.createGain();
    sfx = ctx.createGain();
    music = ctx.createGain();
    sfx.gain.value = sfxLevel;
    music.gain.value = musicLevel;
    sfx.connect(master);
    music.connect(master);
    master.connect(ctx.destination);
  }
  return ctx;
}

export function unlockAudio() {
  const c = ac();
  if (!c) return;
  if (c.state === "suspended") void c.resume();
}

export function setMuted(v: boolean) {
  muted = v;
  if (master && ctx) {
    master.gain.setTargetAtTime(v ? 0 : 1, ctx.currentTime, 0.03);
  }
  if (v) {
    stopDrone();
    stopSea();
    setTension(0);
  }
}

export function setSfxLevel(slider: number) {
  const x = Math.max(0, Math.min(1, slider));
  sfxLevel = x * x * 0.9;
  if (sfx && ctx) sfx.gain.setTargetAtTime(sfxLevel, ctx.currentTime, 0.04);
}

export function duck(ms = 280) {
  const c = ac();
  if (!c || !sfx || muted) return;
  const t = c.currentTime;
  sfx.gain.cancelScheduledValues(t);
  sfx.gain.setTargetAtTime(sfxLevel * 0.22, t, 0.02);
  sfx.gain.setTargetAtTime(sfxLevel, t + ms / 1000, 0.08);
}

export function resumeAudio() {
  const c = ac();
  if (c && c.state === "suspended") void c.resume();
}

function beep(freq: number, dur: number, type: OscillatorType, vol: number, pan = 0) {
  const c = ac();
  if (!c || !sfx || muted) return;
  const t = c.currentTime;
  const o = c.createOscillator();
  const g = c.createGain();
  const p = c.createStereoPanner();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  p.pan.setValueAtTime(Math.max(-1, Math.min(1, pan)), t);
  o.connect(g);
  g.connect(p);
  p.connect(sfx);
  o.start(t);
  o.stop(t + dur + 0.02);
  o.onended = () => {
    o.disconnect();
    g.disconnect();
    p.disconnect();
  };
}

export function sfxSave(combo: number, pan = 0) {
  const f = 520 + Math.min(combo, 12) * 28 + (Math.random() * 2 - 1) * 18;
  beep(f, 0.09, "sine", 0.11, pan);
  beep(f * 2.02, 0.05, "triangle", 0.04, pan);
  beep(180 + combo * 4, 0.07, "sine", 0.04, pan);
}

export function sfxLost(pan = 0) {
  beep(110 + Math.random() * 12, 0.22, "triangle", 0.14, pan);
  beep(72, 0.3, "sine", 0.08, pan);
}

export function sfxWarn(pan = 0) {
  beep(196 + Math.random() * 8, 0.07, "sine", 0.06, pan);
  beep(147, 0.12, "triangle", 0.04, pan);
}

export function sfxWin() {
  beep(392, 0.28, "sine", 0.1);
  setTimeout(() => beep(523, 0.32, "sine", 0.1), 90);
  setTimeout(() => beep(659, 0.45, "sine", 0.09), 180);
}

export function sfxFail() {
  beep(98, 0.4, "sawtooth", 0.05);
  beep(73, 0.55, "sine", 0.1);
}

export function sfxPick() {
  beep(330, 0.07, "sine", 0.09);
  setTimeout(() => beep(494, 0.14, "triangle", 0.08), 55);
}

export function sfxZap(pan = 0) {
  beep(880 + Math.random() * 40, 0.05, "square", 0.04, pan);
  beep(220, 0.12, "sine", 0.06, pan);
}

export function sfxDrowner(pan = 0) {
  beep(48 + Math.random() * 8, 0.22, "sawtooth", 0.035, pan);
  beep(92, 0.16, "triangle", 0.03, pan);
}

export function sfxFiend(pan = 0) {
  beep(64, 0.18, "sawtooth", 0.05, pan);
  beep(180, 0.08, "square", 0.03, pan);
}

export function sfxFlare() {
  duck(320);
  beep(520, 0.12, "triangle", 0.1);
  beep(140, 0.28, "sine", 0.08);
  setTimeout(() => beep(880, 0.06, "sine", 0.05), 40);
}

export function sfxBoot() {
  beep(98, 0.5, "sine", 0.08);
  setTimeout(() => beep(196, 0.4, "sine", 0.07), 180);
  setTimeout(() => beep(294, 0.55, "triangle", 0.05), 360);
}

export function sfxCraft() {
  beep(246, 0.08, "triangle", 0.07);
  setTimeout(() => beep(370, 0.1, "sine", 0.06), 70);
}

export function sfxGull(pan = 0) {
  beep(880 + Math.random() * 120, 0.08, "triangle", 0.03, pan);
  setTimeout(() => beep(720 + Math.random() * 80, 0.12, "sine", 0.025, pan), 70);
}

export function sfxRadio() {
  beep(240 + Math.random() * 40, 0.18, "square", 0.02);
  beep(90, 0.22, "sawtooth", 0.018);
}

export function sfxDoor() {
  beep(110, 0.28, "triangle", 0.06);
  setTimeout(() => beep(70, 0.22, "sine", 0.04), 90);
}

export function sfxHeart() {
  beep(52, 0.07, "sine", 0.05);
  setTimeout(() => beep(44, 0.09, "sine", 0.04), 110);
}

export function sfxWind() {
  beep(180, 0.4, "sawtooth", 0.018);
}

export function sfxPrime() {
  beep(36, 0.55, "sine", 0.08);
  beep(72, 0.4, "triangle", 0.05);
}

export function sfxGear(pan = 0) {
  beep(90 + Math.random() * 40, 0.05, "square", 0.018, pan);
  beep(48 + Math.random() * 10, 0.07, "sawtooth", 0.012, pan);
}

export function sfxSweep() {
  beep(160, 0.12, "triangle", 0.05);
  beep(70, 0.22, "sine", 0.04);
}

export function playCap(key: string, pan = 0) {
  if (key === "capGull") sfxGull(pan);
  else if (key === "capWind") sfxWind();
  else if (key === "capRadio") sfxRadio();
  else if (key === "capHeart") sfxHeart();
  else if (key === "capPrime") sfxPrime();
  else if (key === "capDrowner") sfxDrowner(pan);
  else if (key === "capFlare") sfxFlare();
  else if (key === "capDoor") sfxDoor();
  else if (key === "capSweep") sfxSweep();
  else if (key === "capHeat") sfxWarn();
  else if (key === "capStop") sfxGear();
}

let tension = 0;
let heartTimer: ReturnType<typeof setInterval> | null = null;
let onHeart: (() => void) | null = null;

export function setHeartCap(fn: (() => void) | null) {
  onHeart = fn;
}

export function setTension(v: number) {
  tension = Math.max(0, Math.min(1, v));
  if (muted || tension < 0.35) {
    if (heartTimer) {
      clearInterval(heartTimer);
      heartTimer = null;
    }
    return;
  }
  if (heartTimer) return;
  heartTimer = setInterval(() => {
    if (muted || tension < 0.35) return;
    sfxHeart();
    onHeart?.();
  }, Math.max(420, 820 - tension * 280));
}

function noiseBuffer(c: Ctx) {
  if (noiseBuf) return noiseBuf;
  const len = c.sampleRate * 2;
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) {
    const white = Math.random() * 2 - 1;
    last = (last + 0.02 * white) / 1.02;
    d[i] = last * 3.4;
  }
  noiseBuf = buf;
  return buf;
}

export function startSea() {
  const c = ac();
  if (!c || !music || muted || sea) return;
  sea = c.createBufferSource();
  sea.buffer = noiseBuffer(c);
  sea.loop = true;
  seaGain = c.createGain();
  seaFilter = c.createBiquadFilter();
  seaFilter.type = "lowpass";
  seaFilter.frequency.value = 420;
  seaGain.gain.value = 0.0001;
  sea.connect(seaFilter);
  seaFilter.connect(seaGain);
  seaGain.connect(music);
  sea.start();
  seaGain.gain.setTargetAtTime(0.08, c.currentTime, 0.5);
}

export function stopSea() {
  const c = ac();
  if (!c || !sea || !seaGain) return;
  seaGain.gain.setTargetAtTime(0.0001, c.currentTime, 0.25);
  const src = sea;
  const g = seaGain;
  const f = seaFilter;
  sea = null;
  seaGain = null;
  seaFilter = null;
  setTimeout(() => {
    try {
      src.stop();
      src.disconnect();
      g.disconnect();
      f?.disconnect();
    } catch {
      /* already stopped */
    }
  }, 500);
}

export function startDrone() {
  const c = ac();
  if (!c || !music || muted || drone) return;
  drone = c.createOscillator();
  droneGain = c.createGain();
  drone.type = "sine";
  drone.frequency.value = 48;
  droneGain.gain.value = 0.0001;
  drone.connect(droneGain);
  droneGain.connect(music);
  drone.start();
  droneGain.gain.setTargetAtTime(0.045, c.currentTime, 0.4);
  startSea();
}

export function stopDrone() {
  const c = ac();
  if (!c || !drone || !droneGain) return;
  droneGain.gain.setTargetAtTime(0.0001, c.currentTime, 0.2);
  const d = drone;
  const g = droneGain;
  drone = null;
  droneGain = null;
  setTimeout(() => {
    try {
      d.stop();
      d.disconnect();
      g.disconnect();
    } catch {
      /* already stopped */
    }
  }, 400);
  stopSea();
}
