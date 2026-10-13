export type LogKind = "sys" | "npc" | "myth" | "ruin";

export type LogLine = {
  id: number;
  hm: string;
  kind: LogKind;
  text: string;
};

export type Motion = "still" | "walk" | "ride";
export type NightBand = "day" | "mild" | "deep";
export type AnomalyId = "nocturne" | "gold" | "fissure";
export type PowerSource = "link" | "hand" | "nominal";

export type Ledger = {
  sleepMinutes: number;
  steps: number;
  screenMin: number;
  unread: number;
  gacha: boolean;
  motion: Motion;
};

export type DaySample = {
  date: string;
  sleepMinutes: number;
  steps: number;
  screenMin: number;
};

export type Sky = {
  tempC: number;
  code: number;
  wind: number;
  pressure: number;
};

export type Stratum = {
  epoch: number;
  epitaph: string;
  at: string;
};

export type Meters = {
  warmth: number;
  fuel: number;
  rations: number;
  silence: number;
  tension: number;
  heat: number;
  route: number;
  stagnation: number;
  bubble: number;
};

export type World = {
  version: 1;
  awake: boolean;
  epoch: number;
  strata: Stratum[];
  meters: Meters;
  ledger: Ledger;
  days: DaySample[];
  sky: Sky | null;
  placeLabel: string;
  useGeo: boolean;
  override: { level: number; charging: boolean } | null;
  shutter: boolean;
  blackout: boolean;
  undergroundOpen: boolean;
  descended: boolean;
  night: NightBand;
  anomaly: AnomalyId | null;
  grace: number;
  muted: boolean;
  headlines: string[];
  logs: LogLine[];
  seq: number;
  prayedOn: string | null;
  coldBand: number;
  lastMythKey: string | null;
};

export type SensorNow = {
  now: Date;
  battery: { level: number; charging: boolean } | null;
};

export type Reactor = {
  power: number;
  charging: boolean;
  source: PowerSource;
};

export type Readout = Reactor & {
  powerStatus: string;
  noise: number;
  atmosStatus: string;
  thermStatus: string;
  routeStatus: string;
  heatStatus: string;
  tensionStatus: string;
  bubbleStatus: string;
  siltStatus: string;
  biomeName: string;
  biomeTag: string;
  anomalyLabel: string | null;
  petrified: boolean;
  baseline: string | null;
};

export const PLACES = [
  { id: "tokyo", name: "東京", lat: 35.6812, lon: 139.7671 },
  { id: "sapporo", name: "札幌", lat: 43.0618, lon: 141.3545 },
  { id: "osaka", name: "大阪", lat: 34.6937, lon: 135.5023 },
  { id: "fukuoka", name: "福岡", lat: 33.5902, lon: 130.4017 },
  { id: "naha", name: "那覇", lat: 26.2124, lon: 127.6809 },
] as const;

const ANOMALY_LABEL: Record<AnomalyId, string> = {
  nocturne: "夜行種",
  gold: "黄金泡",
  fissure: "地下解放",
};

export function clamp(n: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, n));
}

export function dateKey(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function clockLabel(d: Date) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

export function hm(d: Date) {
  return clockLabel(d).slice(0, 5);
}

export function sleepMinutesFromTime(value: string) {
  const [h, m] = value.split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return 23 * 60 + 30;
  return (((h * 60 + m) % 1440) + 1440) % 1440;
}

export function timeFromMinutes(mins: number) {
  const rounded = Math.round(((mins % 1440) + 1440) % 1440) % 1440;
  const h = Math.floor(rounded / 60);
  const m = rounded % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function sleepPhase(mins: number) {
  let p = mins - 18 * 60;
  if (p < 0) p += 24 * 60;
  return p;
}

export function phaseToClock(phase: number) {
  const m = phase + 18 * 60;
  return ((m % 1440) + 1440) % 1440;
}

export function circularMeanPhase(phases: number[]) {
  if (phases.length === 0) return sleepPhase(23 * 60 + 30);
  let x = 0;
  let y = 0;
  for (const p of phases) {
    const a = (p / 1440) * Math.PI * 2;
    x += Math.cos(a);
    y += Math.sin(a);
  }
  let tau = Math.atan2(y / phases.length, x / phases.length);
  if (tau < 0) tau += Math.PI * 2;
  return (tau / (Math.PI * 2)) * 1440;
}

export function phaseDelta(a: number, b: number) {
  let d = a - b;
  if (d > 720) d -= 1440;
  if (d < -720) d += 1440;
  return d;
}

export function nightBand(now: Date, sleepMinutes: number): NightBand {
  const h = now.getHours();
  const liveDeep = h >= 2 && h < 5;
  const sleptDeep = sleepMinutes >= 120 && sleepMinutes < 300;
  if (liveDeep || sleptDeep) return "deep";
  const liveMild = h < 2;
  const sleptMild = sleepMinutes < 120;
  if (liveMild || sleptMild) return "mild";
  return "day";
}

export function biomeOf(code: number | null) {
  if (code == null) return { name: "未測定の大気", tag: "NO SKY" };
  if (code === 0) return { name: "乾いた高気圧", tag: "CLEAR" };
  if (code <= 3) return { name: "薄い雲の平原", tag: "CLOUD" };
  if (code <= 48) return { name: "澱みの霧", tag: "FOG" };
  if (code <= 67) return { name: "湿った低地", tag: "RAIN" };
  if (code <= 77) return { name: "雪の皮膜", tag: "SNOW" };
  if (code <= 82) return { name: "叩きつける雨域", tag: "SHOWER" };
  if (code <= 86) return { name: "氷の交通", tag: "SLEET" };
  return { name: "帯電した荒野", tag: "STORM" };
}

export function circuitMyth(sky: Sky | null, headlines: string[]) {
  const biome = biomeOf(sky?.code ?? null);
  const headline = headlines[0]?.replace(/\s+/g, " ").trim();
  const lead = headline ? `通信片「${headline.slice(0, 72)}」` : "通信は途切れた";
  const pressure = sky ? Math.round(sky.pressure) : null;
  const temp = sky == null ? null : Math.round(sky.tempC);
  const market =
    pressure == null
      ? "相場は沈黙している"
      : pressure >= 1016
        ? "物価は重く沈み、怒りの取引が減る"
        : pressure <= 1008
          ? "物価が浮き、治安の膜が薄くなる"
          : "相場はほぼ水平だ";
  const air =
    temp == null
      ? "気温は欠測"
      : temp <= 3
        ? `外気 ${temp}℃。バイオームは${biome.name}で、極夜の予兆を帯びる`
        : temp >= 30
          ? `外気 ${temp}℃。天候の熱と文明の熱が同じ管を通る`
          : `外気 ${temp}℃。バイオームは${biome.name}`;
  return `${air}。${lead}は、ここでは事件ではなく基底条件だ。${market}。観測員にできるのは、壁の内側の温度を自分の生活で払うことだけだ。〔規則回路。LLMは未接続か、応答しなかった〕`;
}

export function mythKey(sky: Sky | null, headlines: string[]) {
  const s = sky ? `${sky.code}:${Math.round(sky.tempC)}:${Math.round(sky.pressure)}` : "nosky";
  return `${s}|${headlines.join(" / ")}`;
}

function emptyMeters(partial: Partial<Meters>): Meters {
  return {
    warmth: 64,
    fuel: 70,
    rations: 68,
    silence: 58,
    tension: 10,
    heat: 18,
    route: 62,
    stagnation: 6,
    bubble: 4,
    ...partial,
  };
}

function baseLedger(): Ledger {
  return {
    sleepMinutes: 23 * 60 + 20,
    steps: 3500,
    screenMin: 25,
    unread: 1,
    gacha: false,
    motion: "walk",
  };
}

export function createWorld(mode: "dormant" | "blank" | "exercise", now: Date): World {
  const world: World = {
    version: 1,
    awake: mode !== "dormant",
    epoch: 1,
    strata: [],
    meters: emptyMeters({}),
    ledger: baseLedger(),
    days: [],
    sky: null,
    placeLabel: "東京",
    useGeo: false,
    override: null,
    shutter: false,
    blackout: false,
    undergroundOpen: false,
    descended: false,
    night: "day",
    anomaly: null,
    grace: 0,
    muted: false,
    headlines: [],
    logs: [],
    seq: 0,
    prayedOn: null,
    coldBand: 0,
    lastMythKey: null,
  };
  if (mode === "dormant") return world;
  if (mode === "blank") {
    push(world, now, "sys", "端末が目を開けた。あなたの平均は、まだ世界に記憶されていない。");
    push(
      world,
      now,
      "npc",
      "隣室の住人: 『……新しい壁の匂いがする。今夜は静かにしてくれ。』",
    );
    world.night = nightBand(now, world.ledger.sleepMinutes);
    return world;
  }
  world.meters = emptyMeters({
    warmth: 58,
    fuel: 64,
    rations: 60,
    silence: 62,
    tension: 18,
    heat: 22,
    route: 70,
    stagnation: 66,
    bubble: 6,
  });
  world.ledger = {
    sleepMinutes: 23 * 60 + 40,
    steps: 6100,
    screenMin: 42,
    unread: 2,
    gacha: false,
    motion: "walk",
  };
  for (let ago = 6; ago >= 1; ago -= 1) {
    const d = new Date(now);
    d.setDate(d.getDate() - ago);
    world.days.push({
      date: dateKey(d),
      sleepMinutes: 23 * 60 + 40 + (ago % 2),
      steps: 6080 + ago * 12,
      screenMin: 40 + (ago % 3),
    });
  }
  world.night = nightBand(now, world.ledger.sleepMinutes);
  push(world, now, "sys", "演習用の六日分を流し込んだ。眠りも歩数も、ほとんど同じ時刻だ。");
  push(
    world,
    now,
    "sys",
    "澱みが床下で固まり始めている。このまま祈れば石になる。時刻をずらして漏らせば、羽が生える。",
  );
  return world;
}

function push(d: World, now: Date, kind: LogKind, text: string) {
  d.seq += 1;
  d.logs.push({ id: d.seq, hm: hm(now), kind, text });
  if (d.logs.length > 80) d.logs.splice(0, d.logs.length - 80);
}

function draftOf(world: World) {
  return structuredClone(world);
}

export function reactorOf(world: World, sensor: SensorNow): Reactor {
  if (world.override) {
    return {
      power: clamp(Math.round(world.override.level)),
      charging: world.override.charging,
      source: "hand",
    };
  }
  if (sensor.battery) {
    return {
      power: clamp(Math.round(sensor.battery.level * 100)),
      charging: sensor.battery.charging,
      source: "link",
    };
  }
  return { power: 72, charging: false, source: "nominal" };
}

function outdoorBias(sky: Sky | null) {
  if (!sky) return 0;
  return clamp((sky.tempC - 15) * 0.7, -26, 10);
}

export function warmthTarget(world: World, reactor: Reactor, sky: Sky | null) {
  let target = 66 + outdoorBias(sky);
  if (world.night === "deep") target = 16 + outdoorBias(sky) * 0.45;
  else if (world.night === "mild") target = 40 + outdoorBias(sky) * 0.5;
  if (world.shutter) target += 8;
  if (reactor.power < 5 && !reactor.charging) target -= 18;
  if (sky && sky.wind >= 45) target -= 4;
  return clamp(target, 4, 96);
}

function spendGrace(d: World) {
  if (d.grace > 0) d.grace -= 1;
}

function maybeCollapse(d: World, now: Date) {
  if (d.grace > 0) {
    if (d.meters.warmth < 42) d.meters.warmth = 42;
    return;
  }
  const cold = d.meters.warmth <= 1;
  const empty = d.meters.fuel <= 0 && d.meters.rations <= 0;
  if (!cold && !empty) return;
  const epitaph =
    cold
      ? `第${d.epoch}期は熱を失い、床になった。`
      : `第${d.epoch}期は食料と燃料を同時に失い、皿だけが残った。`;
  d.strata.push({ epoch: d.epoch, epitaph, at: dateKey(now) });
  if (d.strata.length > 8) d.strata.shift();
  push(d, now, "ruin", `${epitaph} 終わりではない。あなたは次の層の住人だ。`);
  d.epoch += 1;
  d.meters.warmth = 56;
  d.meters.fuel = Math.max(28, Math.round(d.meters.fuel * 0.3));
  d.meters.rations = Math.max(28, Math.round(d.meters.rations * 0.3));
  d.meters.bubble = Math.round(d.meters.bubble * 0.4);
  d.meters.stagnation = Math.round(d.meters.stagnation * 0.6);
  d.blackout = false;
  d.undergroundOpen = false;
  d.descended = false;
  d.anomaly = null;
  d.grace = 2;
  d.coldBand = 0;
  push(
    d,
    now,
    "sys",
    `エポック ${d.epoch}。新しいコンクリートの匂い。猶予は二度の行動だけ。生活が同じなら、冷気は下から戻る。`,
  );
  push(d, now, "npc", "隣室の住人: 『……上の階が、急に遠くなったな。』");
}

function syncPower(d: World, sensor: SensorNow, now: Date) {
  const rec = reactorOf(d, sensor);
  const critical = rec.power < 5 && !rec.charging;
  if (critical && !d.blackout) {
    d.blackout = true;
    d.undergroundOpen = true;
    d.descended = false;
    d.anomaly = "fissure";
    push(d, now, "sys", "動力炉が臨界を割った。全電源が落ち、地下区画の錠が熱で歪んで外れた。");
    push(d, now, "npc", "隣室の住人: 『真っ暗だ。壁に手をつけろ。名前を呼ぶな。』");
  } else if (!critical && d.blackout && (rec.charging || rec.power >= 12)) {
    d.blackout = false;
    if (d.anomaly === "fissure") d.anomaly = null;
    push(d, now, "sys", "電力が戻った。明かりは復旧する。地下の扉は、まだ開いている。");
  }
  return rec;
}

function syncNight(d: World, now: Date) {
  const band = nightBand(now, d.ledger.sleepMinutes);
  if (band === d.night) return;
  const prev = d.night;
  d.night = band;
  if (band === "deep" && prev !== "deep") {
    push(d, now, "sys", "外界からの熱源供給が細る。極夜プロトコルが自動発動した。");
    if (!d.anomaly) d.anomaly = "nocturne";
    push(
      d,
      now,
      "npc",
      "隣室の住人: 『吹雪の音じゃない。通気口の向こうで、何かが息をしている。』",
    );
  } else if (prev === "deep" && band !== "deep") {
    push(d, now, "sys", "極夜プロトコルを解除した。残渣の冷気は、すぐには抜けない。");
    if (d.anomaly === "nocturne") d.anomaly = null;
  }
}

function baseline(days: DaySample[]) {
  if (days.length < 3) return null;
  const phase = circularMeanPhase(days.map((day) => sleepPhase(day.sleepMinutes)));
  const steps = days.reduce((sum, day) => sum + day.steps, 0) / days.length;
  const screen = days.reduce((sum, day) => sum + day.screenMin, 0) / days.length;
  return { sleepMinutes: phaseToClock(phase), steps, screen, phase };
}

function butterflyOf(days: DaySample[], ledger: Ledger) {
  const base = baseline(days);
  if (!base) return null;
  const sleepDelta = phaseDelta(sleepPhase(ledger.sleepMinutes), base.phase);
  const stepRatio = base.steps > 0 ? ledger.steps / base.steps : 1;
  const fired = Math.abs(sleepDelta) >= 15 || stepRatio < 0.8 || stepRatio > 1.2;
  const mag = Math.max(Math.abs(sleepDelta) / 15, Math.abs(stepRatio - 1) / 0.2);
  let why = "平均の内側";
  if (sleepDelta >= 15) why = "夜更かし";
  else if (sleepDelta <= -15) why = "早すぎる眠り";
  else if (stepRatio > 1.2) why = "過剰な移動";
  else if (stepRatio < 0.8) why = "足の止まり";
  return { sleepDelta, stepRatio, fired, mag, why };
}

export function sanitizeLedger(ledger: Ledger): Ledger {
  const motion: Motion =
    ledger.motion === "still" || ledger.motion === "ride" || ledger.motion === "walk"
      ? ledger.motion
      : "walk";
  return {
    sleepMinutes: ((Math.round(ledger.sleepMinutes) % 1440) + 1440) % 1440,
    steps: Math.max(0, Math.min(40000, Math.round(ledger.steps) || 0)),
    screenMin: Math.max(0, Math.min(600, Math.round(ledger.screenMin) || 0)),
    unread: Math.max(0, Math.min(99, Math.round(ledger.unread) || 0)),
    gacha: Boolean(ledger.gacha),
    motion,
  };
}

function routeOf(ledger: Ledger, sky: Sky | null) {
  let route = 48;
  if (ledger.motion === "walk") route = 40 + ledger.steps / 180;
  else if (ledger.motion === "still") route = 18 + ledger.steps / 420;
  else route = 16 + Math.min(18, ledger.steps / 700);
  if (sky && sky.wind >= 40) route -= 8;
  return clamp(route);
}

function silenceTarget(world: World, ledger: Ledger) {
  return clamp(
    58 +
      (world.shutter ? 28 : 0) +
      (world.blackout ? 14 : 0) -
      ledger.screenMin * 0.12 -
      (ledger.gacha ? 8 : 0),
  );
}

export function applyLedger(world: World, ledgerIn: Ledger, sensor: SensorNow): World {
  if (!world.awake) return world;
  const d = draftOf(world);
  const ledger = sanitizeLedger(ledgerIn);
  const prev = d.ledger;
  spendGrace(d);
  d.ledger = ledger;
  syncNight(d, sensor.now);
  const rec = syncPower(d, sensor, sensor.now);
  const target = warmthTarget(d, rec, d.sky);
  d.meters.warmth = clamp(d.meters.warmth + (target - d.meters.warmth) * 0.5);
  if (d.night === "deep" && d.blackout) d.meters.warmth = clamp(d.meters.warmth - 18);

  const prevHeat = d.meters.heat;
  d.meters.heat = clamp(ledger.screenMin * 0.5);
  const prevTension = d.meters.tension;
  d.meters.tension = clamp(ledger.unread * 9 + (d.meters.heat >= 70 ? 8 : 0));
  d.meters.route = routeOf(ledger, d.sky);
  d.meters.silence = clamp(d.meters.silence + (silenceTarget(d, ledger) - d.meters.silence) * 0.7);
  d.meters.rations = clamp(d.meters.rations - 2);

  if (ledger.gacha && !prev.gacha) {
    d.meters.bubble = clamp(Math.max(62, d.meters.bubble + 36));
    if (d.anomaly !== "fissure") d.anomaly = "gold";
    push(d, sensor.now, "sys", "街に黄金の泡が立った。決済の通知が、相場を狂乱に変える。");
  } else if (ledger.gacha) {
    d.meters.bubble = clamp(d.meters.bubble + 6);
  } else {
    d.meters.bubble = clamp(d.meters.bubble - 8);
    if (d.anomaly === "gold" && d.meters.bubble < 30) d.anomaly = null;
  }

  const fly = butterflyOf(d.days, ledger);
  if (fly?.fired) {
    const kick = Math.min(fly.mag, 3);
    if (fly.sleepDelta > 0) d.meters.warmth = clamp(d.meters.warmth - 6 * kick);
    else if (fly.sleepDelta < 0) d.meters.warmth = clamp(d.meters.warmth + 3);
    d.meters.route = clamp(d.meters.route + (fly.stepRatio - 1) * 24);
    push(
      d,
      sensor.now,
      "sys",
      `バタフライ: ${fly.why}が ${kick.toFixed(1)} 倍に読まれた。室温と交易路が過敏に振れる。`,
    );
    if (fly.sleepDelta >= 15 && d.night === "deep" && d.anomaly == null) d.anomaly = "nocturne";
  }

  if (prev.motion !== ledger.motion) {
    if (ledger.motion === "ride") {
      push(d, sensor.now, "sys", "車両移動を地殻の揺れとして翻訳した。交易路は安全ではない。");
    } else if (ledger.motion === "walk") {
      push(d, sensor.now, "sys", "歩行が気流を起こし、交易路を押し広げている。");
    } else {
      push(d, sensor.now, "sys", "長い静止。気流が止まり、道が細る。");
    }
  }
  if (prevHeat < 70 && d.meters.heat >= 70) {
    push(d, sensor.now, "sys", "文明が過熱している。同じ顔が、街の壁に何枚も貼られている。");
  }
  if (prevTension < 54 && d.meters.tension >= 54) {
    push(d, sensor.now, "sys", "未読が扉の外で、名前のように積もっている。");
  }

  push(
    d,
    sensor.now,
    "sys",
    `因果を更新。室温の落としどころ ${Math.round(target)}。過熱 ${Math.round(d.meters.heat)}。交易 ${Math.round(d.meters.route)}。泡 ${Math.round(d.meters.bubble)}。`,
  );
  noteCold(d, sensor.now);
  maybeCollapse(d, sensor.now);
  return d;
}

function noteCold(d: World, now: Date) {
  const band = d.meters.warmth <= 10 ? 3 : d.meters.warmth <= 25 ? 2 : d.meters.warmth <= 45 ? 1 : 0;
  if (band > d.coldBand) {
    const line =
      band === 1
        ? "室温が下がり始めている。毛布では足りない時間だ。"
        : band === 2
          ? "壁が霜をかいている。燃料を焚くか、生活の熱を戻せ。"
          : "体温が設備より高い。このままでは、この層は床になる。";
    push(d, now, "sys", line);
  }
  d.coldBand = band;
}

export function driftWorld(world: World, sensor: SensorNow): World {
  if (!world.awake) return world;
  const d = draftOf(world);
  syncNight(d, sensor.now);
  const rec = syncPower(d, sensor, sensor.now);
  const target = warmthTarget(d, rec, d.sky);
  d.meters.warmth = clamp(d.meters.warmth + (target - d.meters.warmth) * 0.06);
  if (d.blackout && !rec.charging) d.meters.warmth = clamp(d.meters.warmth - 0.45);
  else if (d.night === "deep") d.meters.warmth = clamp(d.meters.warmth - 0.25);
  noteCold(d, sensor.now);
  maybeCollapse(d, sensor.now);
  return d;
}

const BURN_NPC = [
  "おい、また発電機が唸りを上げているぞ……今夜は越せるのか？",
  "その燃料、先週の私の分まで燃やす気か。",
  "熱はありがたい。音は許せない。",
];

export function burnFuel(world: World, sensor: SensorNow, rng = Math.random): World {
  if (!world.awake) return world;
  const d = draftOf(world);
  spendGrace(d);
  if (d.meters.fuel < 8) {
    push(d, sensor.now, "sys", "焚く燃料が残っていない。");
    return d;
  }
  const petrified = d.meters.stagnation >= 80;
  const gain = petrified ? 8 : 18;
  d.meters.fuel = clamp(d.meters.fuel - 14);
  d.meters.warmth = clamp(d.meters.warmth + gain);
  d.meters.silence = clamp(d.meters.silence - 14);
  push(d, sensor.now, "sys", `備蓄を焚いた。室温 +${gain}。静寂は削れた。`);
  if (petrified) push(d, sensor.now, "sys", "石化の壁が、熱を半分で返す。");
  const npc = BURN_NPC[d.seq % BURN_NPC.length] ?? BURN_NPC[0];
  push(d, sensor.now, "npc", `隣室の住人: 『${npc}』`);
  if (d.night === "deep" && rng() < 0.5) {
    d.meters.fuel = clamp(d.meters.fuel + 10);
    if (!d.anomaly) d.anomaly = "nocturne";
    push(d, sensor.now, "sys", "夜行種が炎に寄り、冷たい鱗を三枚残して消えた。燃料として使える。");
  }
  noteCold(d, sensor.now);
  maybeCollapse(d, sensor.now);
  return d;
}

export function toggleShutter(world: World, sensor: SensorNow): World {
  if (!world.awake) return world;
  const d = draftOf(world);
  d.shutter = !d.shutter;
  d.meters.silence = clamp(d.meters.silence + (d.shutter ? 22 : -18));
  if (d.shutter) {
    d.meters.warmth = clamp(d.meters.warmth + 4);
    push(d, sensor.now, "sys", "防音シャッターを下ろした。外の声が遠くなる。熱は少し、中に残る。");
    push(d, sensor.now, "npc", "隣室の住人: 『……それで、私の声も消えるのか。』");
  } else {
    push(d, sensor.now, "sys", "シャッターを上げた。街の熱と雑音が、細い筋になって戻る。");
  }
  return d;
}

export function blackMarket(world: World, sensor: SensorNow, rng = Math.random): World {
  if (!world.awake) return world;
  const d = draftOf(world);
  spendGrace(d);
  if (d.meters.rations < 6) {
    push(d, sensor.now, "sys", "闇市に出す食料が残っていない。");
    return d;
  }
  d.meters.rations = clamp(d.meters.rations - 6);
  const wild = d.meters.bubble >= 40 || d.ledger.gacha;
  const roll = rng();
  if (wild) {
    if (roll < 0.4) {
      d.meters.fuel = clamp(d.meters.fuel + 22);
      push(d, sensor.now, "sys", "泡が弾ける。見知らぬ貨幣が、燃料に変わっていた。");
    } else if (roll < 0.72) {
      d.meters.rations = clamp(d.meters.rations - 10);
      push(d, sensor.now, "sys", "相場は詐欺だった。袋の底が抜け、食料がさらに減る。");
    } else {
      d.meters.tension = clamp(d.meters.tension - 14);
      push(d, sensor.now, "sys", "商人は噂だけを売った。未読の圧が、少し軽い。");
    }
  } else if (roll < 0.5) {
    d.meters.fuel = clamp(d.meters.fuel + 10);
    push(d, sensor.now, "sys", "埃の奥に、まだ燃える罐があった。");
  } else if (roll < 0.82) {
    push(d, sensor.now, "sys", "何もなかった。闇市は今日、視線だけを返した。");
  } else {
    d.meters.route = clamp(d.meters.route + 12);
    push(d, sensor.now, "sys", "抜け道の話を買った。交易路が、わずかに太い。");
  }
  maybeCollapse(d, sensor.now);
  return d;
}

export function pray(world: World, sensor: SensorNow): World {
  if (!world.awake) return world;
  const d = draftOf(world);
  const today = dateKey(sensor.now);
  if (d.prayedOn === today) {
    push(d, sensor.now, "sys", "その日付の眠りは、すでに壁へ刻んである。同じ祈りは吸われる。");
    if (d.meters.stagnation < 80) d.meters.warmth = clamp(d.meters.warmth + 2);
    return d;
  }
  spendGrace(d);
  d.prayedOn = today;
  d.days.push({
    date: today,
    sleepMinutes: d.ledger.sleepMinutes,
    steps: d.ledger.steps,
    screenMin: d.ledger.screenMin,
  });
  if (d.days.length > 14) d.days.splice(0, d.days.length - 14);
  const recent = d.days.slice(-7);
  if (recent.length < 3) {
    push(d, sensor.now, "sys", "標本が足りない。世界はまだ、あなたの平均を覚えていない。");
  } else {
    const phase = circularMeanPhase(recent.map((day) => sleepPhase(day.sleepMinutes)));
    const sleepVar = Math.sqrt(
      recent.reduce((sum, day) => sum + phaseDelta(sleepPhase(day.sleepMinutes), phase) ** 2, 0) /
        recent.length,
    );
    const stepMean = recent.reduce((sum, day) => sum + day.steps, 0) / recent.length;
    const stepVar = Math.sqrt(
      recent.reduce((sum, day) => sum + (day.steps - stepMean) ** 2, 0) / recent.length,
    );
    const cv = stepMean > 0 ? stepVar / stepMean : 1;
    if (sleepVar < 18 && cv < 0.08) {
      d.meters.stagnation = clamp(d.meters.stagnation + 16);
      push(
        d,
        sensor.now,
        "sys",
        `就寝の散らばりは ${Math.round(sleepVar)} 分、歩数の揺れは ${Math.round(cv * 100)}%。型が閉じ、澱みが進んだ。`,
      );
    } else {
      d.meters.stagnation = clamp(d.meters.stagnation - 12);
      push(
        d,
        sensor.now,
        "sys",
        `散らばり ${Math.round(sleepVar)} 分。型にひびが入り、澱みが退いた。`,
      );
    }
  }
  if (d.meters.stagnation >= 80) {
    push(d, sensor.now, "sys", "停滞の病。世界が石化し、同じ手順を半分しか受け取らない。");
  }
  d.meters.rations = clamp(d.meters.rations - 4);
  d.meters.fuel = clamp(d.meters.fuel - 2);
  if (d.night === "deep") {
    d.meters.warmth = clamp(d.meters.warmth - 4);
    push(d, sensor.now, "sys", "祈りは吹雪に剥がれた。夜行種だけが、終わりを聞いている。");
  } else {
    d.meters.warmth = clamp(d.meters.warmth + 8);
    push(d, sensor.now, "sys", "休眠。室温が、人の熱でわずかに戻る。");
    if (d.anomaly === "nocturne") d.anomaly = null;
  }
  push(d, sensor.now, "npc", "隣室の住人: 『眠れ。ただし、同じ夢は見るな。石になる。』");
  noteCold(d, sensor.now);
  maybeCollapse(d, sensor.now);
  return d;
}

export function descend(world: World, sensor: SensorNow, rng = Math.random): World {
  if (!world.awake) return world;
  const d = draftOf(world);
  if (!d.undergroundOpen) {
    push(d, sensor.now, "sys", "地下の錠は、まだ熱を持っていない。動力が死んだときだけ、外れる。");
    return d;
  }
  if (d.descended) {
    push(d, sensor.now, "sys", "その区画は一度降りた。再び沈んでいる。");
    return d;
  }
  spendGrace(d);
  d.descended = true;
  if (rng() < 0.62) {
    d.meters.rations = clamp(d.meters.rations + 16);
    d.meters.fuel = clamp(d.meters.fuel + 12);
    push(d, sensor.now, "sys", "旧時代の保存食と、ラベルの剥げた燃料。前の自分か、前の世か。");
  } else {
    d.meters.tension = clamp(d.meters.tension + 18);
    d.meters.warmth = clamp(d.meters.warmth - 8);
    push(d, sensor.now, "sys", "暗闇で名前を呼ばれた。返事はしていない。それが正解だ。");
  }
  if (d.anomaly === "fissure") d.anomaly = null;
  maybeCollapse(d, sensor.now);
  return d;
}

export function crackPattern(world: World, sensor: SensorNow): World {
  if (!world.awake) return world;
  const d = draftOf(world);
  if (d.meters.stagnation < 80) {
    push(d, sensor.now, "sys", "まだ型は閉じていない。崩すものがない。");
    return d;
  }
  const base = baseline(d.days);
  if (!base) {
    push(d, sensor.now, "sys", "標本が足りない。祈って平均を作ってから、それを裏切ってくれ。");
    return d;
  }
  const sleepDelta = phaseDelta(sleepPhase(d.ledger.sleepMinutes), base.phase);
  const stepRatio = base.steps > 0 ? d.ledger.steps / base.steps : 1;
  const broke =
    Math.abs(sleepDelta) >= 40 ||
    stepRatio <= 0.7 ||
    stepRatio >= 1.35 ||
    (d.ledger.screenMin <= 8 && base.screen >= 30);
  if (!broke) {
    push(
      d,
      sensor.now,
      "sys",
      "まだ型の内側だ。就寝を40分ずらすか、歩数を3割変えるか、画面をほとんど消してから、もう一度。",
    );
    return d;
  }
  spendGrace(d);
  d.meters.stagnation = 26;
  d.meters.warmth = clamp(d.meters.warmth + 12);
  d.meters.fuel = clamp(d.meters.fuel + 8);
  push(d, sensor.now, "sys", "ひび。日常のズレが断層になり、石化が音を立てて剥がれた。");
  push(d, sensor.now, "npc", "隣室の住人: 『今の音は、久しぶりに新しいな。』");
  return d;
}

export function ingestSky(world: World, sky: Sky, placeLabel: string, sensor: SensorNow): World {
  if (!world.awake) return world;
  const d = draftOf(world);
  d.sky = sky;
  d.placeLabel = placeLabel;
  const biome = biomeOf(sky.code);
  d.meters.warmth = clamp(d.meters.warmth + (sky.tempC - 15) * 0.25);
  d.meters.route = routeOf(d.ledger, sky);
  push(
    d,
    sensor.now,
    "sys",
    `大気を吸入（${placeLabel}）。${biome.name} / ${Math.round(sky.tempC)}℃ / 風 ${Math.round(sky.wind)} / 気圧 ${Math.round(sky.pressure)}。`,
  );
  maybeCollapse(d, sensor.now);
  return d;
}

export function setHeadlines(world: World, headlines: string[], sensor: SensorNow): World {
  const d = draftOf(world);
  d.headlines = headlines.slice(0, 4);
  for (const line of d.headlines) {
    push(d, sensor.now, "myth", `見出し: ${line}`);
  }
  return d;
}

export function note(world: World, kind: LogKind, text: string, sensor: SensorNow): World {
  const d = draftOf(world);
  push(d, sensor.now, kind, text);
  return d;
}

export function recordMyth(world: World, text: string, key: string, sensor: SensorNow): World {
  const d = draftOf(world);
  d.lastMythKey = key;
  push(d, sensor.now, "myth", text);
  return d;
}

export function setPowerOverride(
  world: World,
  override: { level: number; charging: boolean } | null,
  sensor: SensorNow,
): World {
  if (!world.awake) return world;
  const d = draftOf(world);
  d.override = override
    ? { level: clamp(Math.round(override.level)), charging: override.charging }
    : null;
  syncPower(d, sensor, sensor.now);
  noteCold(d, sensor.now);
  maybeCollapse(d, sensor.now);
  return d;
}

export function derived(world: World, sensor: SensorNow): Readout {
  const rec = reactorOf(world, sensor);
  const noise = clamp(100 - world.meters.silence);
  const petrified = world.meters.stagnation >= 80;
  const powerStatus =
    rec.source === "nominal"
      ? "UNLINKED"
      : rec.power < 5 && !rec.charging
        ? "CRITICAL"
        : rec.power < 16 && !rec.charging
          ? "LOW"
          : rec.charging
            ? "CHARGE"
            : "NOMINAL";
  const thermStatus =
    world.night === "deep" && world.meters.warmth < 42
      ? "BLIZZARD"
      : world.meters.warmth <= 20
        ? "COLD"
        : world.meters.warmth >= 82
          ? "HEAT"
          : world.night === "mild"
            ? "CHILL"
            : "STABLE";
  const atmosStatus = world.shutter
    ? "SHUTTER"
    : noise >= 62
      ? "HIGH NOISE"
      : noise <= 28
        ? "QUIET"
        : "ROOM";
  const routeStatus = world.meters.route >= 68 ? "OPEN" : world.meters.route >= 40 ? "UNEASY" : "BROKEN";
  const heatStatus = world.meters.heat >= 70 ? "MEME" : world.meters.heat >= 40 ? "FEVER" : "COOL";
  const tensionStatus =
    world.meters.tension >= 70 ? "PANIC" : world.meters.tension >= 40 ? "WIRED" : "CALM";
  const bubbleStatus = world.meters.bubble >= 60 ? "MANIA" : world.meters.bubble >= 30 ? "FIZZ" : "FLAT";
  const siltStatus = petrified ? "PETRIFIED" : world.meters.stagnation >= 50 ? "SILT" : "FLOW";
  const biome = biomeOf(world.sky?.code ?? null);
  const base = baseline(world.days);
  return {
    ...rec,
    powerStatus,
    noise,
    atmosStatus,
    thermStatus,
    routeStatus,
    heatStatus,
    tensionStatus,
    bubbleStatus,
    siltStatus,
    biomeName: biome.name,
    biomeTag: biome.tag,
    anomalyLabel: world.anomaly ? ANOMALY_LABEL[world.anomaly] : null,
    petrified,
    baseline: base
      ? `平均就寝 ${timeFromMinutes(base.sleepMinutes)} / 平均歩数 ${Math.round(base.steps)}`
      : null,
  };
}

export function hint(world: World, view: Readout) {
  if (!world.awake) return "";
  if (world.grace > 0) return "新しい層の猶予中。同じ生活を続けると、冷気は下から戻る。";
  if (view.petrified) return "停滞の病。就寝を40分ずらすか、歩数を3割変えるか、画面をほとんど消して、型を崩せ。";
  if (world.blackout) return "電源断。暗闇だが、地下の錠は外れている。";
  if (world.night === "deep") return "極夜。燃料は室温を戻すが、夜行種が炎に寄ることがある。";
  if (world.meters.bubble >= 40) return "黄金の泡。闇市の値は、信用できない。";
  if (world.days.length < 3) return "祈って眠りを刻むと、世界があなたの平均を覚える。";
  return "平穏は世界を安定させる。安定は、やがて石になる。";
}
