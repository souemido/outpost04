import { useEffect, useRef, useState, type ReactNode } from "react";
import { blip, resumeLeakAudio, setDrone, unlockLeakAudio } from "@/lib/leak/audio";
import {
  circuitMyth,
  clockLabel,
  derived,
  hint,
  mythKey,
  PLACES,
  sleepMinutesFromTime,
  timeFromMinutes,
  type Ledger,
  type LogLine,
  type Motion,
  type SensorNow,
} from "@/lib/leak/model";
import { listenOutside, mythologize } from "@/lib/leak/outside";
import { useLeak } from "@/lib/leak/store";
import { Waveform } from "@/components/leak/waveform";
import { LeakSheet } from "@/components/leak/sheet";
import { useSensor } from "@/components/leak/sensors";
import { PuniCursor } from "@/components/outpost/cursor";
import { OutpostStage } from "@/components/outpost/stage";


function useReady() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let live = true;
    const unsub = useLeak.persist.onFinishHydration(() => {
      if (live) setReady(true);
    });
    void Promise.resolve(useLeak.persist.rehydrate()).finally(() => {
      if (live) setReady(true);
    });
    return () => {
      live = false;
      unsub();
    };
  }, []);
  return ready;
}

function useTyped(text: string, on: boolean) {
  const [count, setCount] = useState(on ? 0 : text.length);
  useEffect(() => {
    if (!on) {
      setCount(text.length);
      return;
    }
    let i = 0;
    let frame = 0;
    let last = 0;
    setCount(0);
    const step = (t: number) => {
      if (t - last > 16) {
        last = t;
        i = Math.min(text.length, i + 1);
        setCount(i);
      }
      if (i < text.length) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [text, on]);
  return text.slice(0, count);
}

function Gauge({
  label,
  value,
  status,
  alarm,
}: {
  label: string;
  value: number;
  status: string;
  alarm?: boolean;
}) {
  const width = `${Math.max(0, Math.min(100, value))}%`;
  return (
    <div className="flex min-w-0 flex-col gap-1 border border-line bg-panel px-2 py-2">
      <div className="flex items-baseline justify-between gap-2 text-xs text-ash">
        <span className="truncate">{label}</span>
        <span className={alarm ? "text-alarm" : "text-phosphor"}>{status}</span>
      </div>
      <p className="text-lg leading-none tabular-nums text-bone">{Math.round(value)}</p>
      <div className="h-1 bg-ink">
        <div className={alarm ? "h-full bg-alarm" : "h-full bg-phosphor"} style={{ width }} />
      </div>
    </div>
  );
}

function Micro({ label, value, alarm }: { label: string; value: number; alarm?: boolean }) {
  const width = `${Math.max(0, Math.min(100, value))}%`;
  return (
    <div className="min-w-0">
      <div className="flex items-baseline justify-between gap-1 text-xs">
        <span className="truncate text-ash">{label}</span>
        <span className={alarm ? "tabular-nums text-alarm" : "tabular-nums text-bone"}>
          {Math.round(value)}
        </span>
      </div>
      <div className="mt-1 h-1 bg-ink">
        <div className={alarm ? "h-full bg-alarm" : "h-full bg-phosphor"} style={{ width }} />
      </div>
    </div>
  );
}

function LogLineView({ line, typed }: { line: LogLine; typed: boolean }) {
  const text = useTyped(line.text, typed);
  const tone =
    line.kind === "npc"
      ? "font-serif text-bone italic"
      : line.kind === "ruin"
        ? "text-alarm"
        : line.kind === "myth"
          ? "text-phosphor"
          : "text-ash";
  return (
    <p className="text-sm leading-relaxed text-pretty">
      <span className="mr-2 tabular-nums text-phosphor">{line.hm}</span>
      <span className={tone}>{text}</span>
    </p>
  );
}

function Boot({
  ready,
  onStart,
}: {
  ready: boolean;
  onStart: (mode: "blank" | "exercise") => void;
}) {
  return (
    <section className="flex flex-1 flex-col justify-center gap-6 px-4 py-8 sm:px-8">
      <div className="enter">
        <p className="text-xs tracking-widest text-phosphor">OBSERVATION TERMINAL 07</p>
        <h1 className="mt-2 text-3xl leading-tight text-balance text-bone">LEAK / AMBIENT</h1>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-pretty text-ash">
          あなたの生活が、この端末の向こうの世界を歪ませる。あなたは神ではない。シェルターの片隅で、そのしわ寄せを受ける観測員だ。
        </p>
      </div>
      <div className="enter-late max-w-xl space-y-3 text-sm leading-relaxed text-pretty text-ash">
        <p>
          つつくと住人は凹む。引きずると、少しだけついてくる。時計は本物だ。深夜、空の電池、同じ生活の繰り返しは、基地の空と足に出る。
        </p>
        <p>平穏は世界を安定させ、退屈にする。安定は、やがて石になる。死んでも層になるだけだ。</p>
      </div>
      <div className="enter-late grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          className="key min-h-11 border border-phosphor bg-phosphor px-4 text-sm text-ink disabled:opacity-40"
          disabled={!ready}
          onClick={() => onStart("exercise")}
        >
          演習ログを装填する
        </button>
        <button
          type="button"
          className="key min-h-11 border border-line px-4 text-sm text-bone disabled:opacity-40"
          disabled={!ready}
          onClick={() => onStart("blank")}
        >
          白紙から始める
        </button>
      </div>
      {!ready ? <p className="text-xs text-ash">端末を同期している。</p> : null}
    </section>
  );
}

function Frame({
  children,
  blackout,
  petrified,
}: {
  children: ReactNode;
  blackout?: boolean;
  petrified?: boolean;
}) {
  return (
    <div className="flex h-dvh flex-col bg-ink text-bone">
      <div
        className="bezel mx-auto flex h-full w-full max-w-3xl flex-col bg-chassis"
        data-blackout={blackout ? "true" : "false"}
        data-silt={petrified ? "true" : "false"}
      >
        {children}
      </div>
    </div>
  );
}

export function LeakHome() {
  const ready = useReady();
  const awake = useLeak((s) => s.awake);
  const awaken = useLeak((s) => s.awaken);
  const [gauges, setGauges] = useState(false);
  let body: ReactNode;
  if (!ready || !awake) {
    body = (
      <Frame>
        <Boot
          ready={ready}
          onStart={(mode) => {
            unlockLeakAudio();
            blip("act");
            awaken(mode);
          }}
        />
      </Frame>
    );
  } else if (gauges) {
    body = <Console onBack={() => setGauges(false)} />;
  } else {
    body = <OutpostStage onGauges={() => setGauges(true)} />;
  }
  return (
    <>
      <PuniCursor />
      {body}
    </>
  );
}

function Console({ onBack }: { onBack: () => void }) {
  const world = useLeak();
  const { sensor, batteryLive } = useSensor();
  const sensorRef = useRef(sensor);
  sensorRef.current = sensor;
  const view = derived(world, sensor);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<"listen" | "myth" | null>(null);
  const [reduced, setReduced] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);
  const lastId = world.logs[world.logs.length - 1]?.id ?? 0;

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduced(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    let frame = 0;
    let acc = 0;
    let prev = performance.now();
    const loop = (t: number) => {
      const dt = Math.min(0.1, (t - prev) / 1000);
      prev = t;
      acc += dt;
      if (acc >= 8) {
        acc = 0;
        useLeak.getState().drift(sensorRef.current);
      }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    const onVis = () => {
      if (document.visibilityState !== "visible") return;
      resumeLeakAudio();
      useLeak.getState().drift(sensorRef.current);
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  useEffect(() => {
    setDrone({
      muted: world.muted,
      warmth: world.meters.warmth,
      silence: world.meters.silence,
      blackout: world.blackout,
      deep: world.night === "deep",
      bubble: world.meters.bubble,
    });
  }, [
    world.muted,
    world.meters.warmth,
    world.meters.silence,
    world.blackout,
    world.night,
    world.meters.bubble,
  ]);

  useEffect(() => {
    const node = logRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [lastId, open]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const tag = (event.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      const s = sensorRef.current;
      const api = useLeak.getState();
      if (event.key === "1") {
        blip("act");
        api.burn(s);
      } else if (event.key === "2") {
        blip("act");
        api.toggleShutter(s);
      } else if (event.key === "3") {
        blip("act");
        api.market(s);
      } else if (event.key === "4") {
        blip("act");
        api.rest(s);
      } else if (event.key === "m" || event.key === "M") {
        api.mute();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const act = (fn: (sensor: SensorNow) => void, warn = false) => {
    unlockLeakAudio();
    blip(warn ? "warn" : "act");
    fn(sensorRef.current);
  };

  const place = PLACES.find((item) => item.name === world.placeLabel) ?? PLACES[0];

  async function listen() {
    if (busy) return;
    unlockLeakAudio();
    blip("act");
    setBusy("listen");
    const api = useLeak.getState();
    let lat: number = place.lat;
    let lon: number = place.lon;
    let label = world.placeLabel;
    try {
      if (world.useGeo && navigator.geolocation) {
        const pos = await new Promise<GeolocationPosition | null>((resolve) => {
          navigator.geolocation.getCurrentPosition(
            (p) => resolve(p),
            () => resolve(null),
            { timeout: 5000, maximumAge: 120000 },
          );
        });
        if (pos) {
          lat = pos.coords.latitude;
          lon = pos.coords.longitude;
          label = "現在地";
        } else {
          api.say("sys", "位置は取れなかった。選んである観測点で大気を吸う。", sensorRef.current);
        }
      }
      const report = await listenOutside({ data: { lat, lon } });
      const nowSensor = sensorRef.current;
      if (report.sky) api.applySky(report.sky, label, nowSensor);
      if (report.skyError) api.say("sys", report.skyError + "。", nowSensor);
      if (report.headlines.length) api.applyNews(report.headlines, nowSensor);
      if (report.newsError) api.say("sys", report.newsError + "。", nowSensor);
    } catch {
      api.say("sys", "外界への回線が落ちた。", sensorRef.current);
    } finally {
      setBusy(null);
    }
  }

  async function myth() {
    if (busy) return;
    const current = useLeak.getState();
    const key = mythKey(current.sky, current.headlines);
    if (!current.sky && current.headlines.length === 0) {
      blip("warn");
      current.say("sys", "変換する大気も見出しもない。先に外界を聴取してくれ。", sensorRef.current);
      return;
    }
    if (current.lastMythKey === key) {
      blip("warn");
      current.say("sys", "同じ通信は、すでに壁に書かれている。", sensorRef.current);
      return;
    }
    unlockLeakAudio();
    blip("act");
    setBusy("myth");
    const skyLine = current.sky
      ? `${current.placeLabel} ${Math.round(current.sky.tempC)}℃ code ${current.sky.code} 風 ${Math.round(current.sky.wind)} 気圧 ${Math.round(current.sky.pressure)}`
      : "";
    const shelter = `室温${Math.round(current.meters.warmth)} 燃料${Math.round(current.meters.fuel)} エポック${current.epoch}`;
    try {
      const result = await mythologize({
        data: { skyLine, headlines: current.headlines, shelter },
      });
      const fresh = sensorRef.current;
      if (result.ok) {
        useLeak.getState().myth(result.text, key, fresh);
      } else {
        const fallback = circuitMyth(useLeak.getState().sky, useLeak.getState().headlines);
        useLeak.getState().myth(fallback, key, fresh);
      }
    } catch {
      const fallback = circuitMyth(useLeak.getState().sky, useLeak.getState().headlines);
      useLeak.getState().myth(fallback, key, sensorRef.current);
    } finally {
      setBusy(null);
    }
  }

  const link =
    view.source === "link" ? "BATT LINK" : view.source === "hand" ? "BATT HAND" : "BATT NOMINAL";

  return (
    <Frame blackout={world.blackout} petrified={view.petrified}>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <header className="flex items-start justify-between gap-3 border-b border-line px-3 py-3 sm:px-4">
          <div className="min-w-0">
            <p className="text-xs tracking-widest text-phosphor">LEAK / AMBIENT</p>
            <h1 className="truncate text-sm text-bone">観測端末 07 — 自業自得圏</h1>
          </div>
          <div className="text-right">
            <button type="button" className="key mb-1 min-h-11 px-3 text-sm text-phosphor" onClick={onBack}>
              基地へ戻る
            </button>
            <p className="text-lg leading-none tabular-nums text-bone">{clockLabel(sensor.now)}</p>
            <p className="mt-1 text-xs text-ash">
              EPOCH {String(world.epoch).padStart(2, "0")}
              {world.strata.length ? ` · 地層 ${world.strata.length}` : ""}
              {world.grace > 0 ? ` · 猶予 ${world.grace}` : ""}
            </p>
          </div>
        </header>

        <div className="flex items-center justify-between gap-2 px-3 py-2 text-xs text-ash sm:px-4">
          <p className="truncate">
            {link}
            {world.sky ? ` · ${view.biomeTag}` : ""}
            {view.anomalyLabel ? ` · ${view.anomalyLabel}` : ""}
          </p>
          <button
            type="button"
            className="key min-h-11 shrink-0 px-3 text-phosphor"
            aria-pressed={world.muted}
            onClick={() => {
              unlockLeakAudio();
              world.mute();
            }}
          >
            {world.muted ? "音 切" : "音 入"}
          </button>
        </div>

        <div className="gauges grid grid-cols-2 gap-2 px-3 sm:grid-cols-4 sm:px-4">
          <Gauge
            label="REACTOR"
            value={view.power}
            status={view.powerStatus}
            alarm={view.powerStatus === "CRITICAL" || view.powerStatus === "LOW"}
          />
          <Gauge
            label="THERM"
            value={world.meters.warmth}
            status={view.thermStatus}
            alarm={view.thermStatus === "BLIZZARD" || view.thermStatus === "COLD"}
          />
          <Gauge label="ATMOS" value={view.noise} status={view.atmosStatus} />
          <Gauge
            label="ROUTE"
            value={world.meters.route}
            status={view.routeStatus}
            alarm={view.routeStatus === "BROKEN"}
          />
        </div>

        <div className="px-3 py-2 sm:px-4">
          <Waveform
            power={view.power}
            noise={view.noise}
            blackout={world.blackout}
            petrified={view.petrified}
            deep={world.night === "deep"}
          />
        </div>

        <div className="grid grid-cols-4 gap-2 px-3 sm:px-4">
          <Micro label="過熱" value={world.meters.heat} />
          <Micro label="緊迫" value={world.meters.tension} alarm={view.tensionStatus === "PANIC"} />
          <Micro label="泡" value={world.meters.bubble} alarm={view.bubbleStatus === "MANIA"} />
          <Micro label="澱" value={world.meters.stagnation} alarm={view.petrified} />
        </div>

        <p className="px-3 py-2 text-xs leading-relaxed text-pretty text-ash sm:px-4">
          燃料 {Math.round(world.meters.fuel)} · 食料 {Math.round(world.meters.rations)}
          {world.sky ? ` · 外気 ${Math.round(world.sky.tempC)}℃ ${view.biomeName}` : " · 大気未吸入"}
          {view.baseline ? ` · ${view.baseline}` : ""}
        </p>
        <p className="px-3 pb-2 text-sm leading-relaxed text-pretty text-bone sm:px-4">{hint(world, view)}</p>

        <div
          ref={logRef}
          aria-live="polite"
          aria-label="観測ログ"
          className="mx-3 mb-3 min-h-64 space-y-2 border border-line bg-ink px-3 py-3 sm:mx-4"
        >
          {world.logs.map((line) => (
            <LogLineView key={line.id} line={line} typed={!reduced && line.id === lastId} />
          ))}
        </div>

        {world.strata.length > 0 ? (
          <details className="mx-3 mb-3 border border-line px-3 py-2 text-sm sm:mx-4">
            <summary className="min-h-11 cursor-pointer py-2 text-ash">
              旧時代の地層 {world.strata.length}
            </summary>
            <ul className="space-y-2 pb-2">
              {world.strata.map((layer) => (
                <li key={`${layer.epoch}-${layer.at}`} className="text-pretty text-ash">
                  <span className="text-phosphor">
                    {layer.at} / 第{layer.epoch}期
                  </span>
                  <span className="mt-1 block font-serif text-bone italic">{layer.epitaph}</span>
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </div>

      <div className="shrink-0 border-t border-line px-3 py-3 sm:px-4">
        {view.petrified ? (
          <button
            type="button"
            className="key mb-2 min-h-11 w-full border border-alarm text-sm text-alarm"
            onClick={() => act((s) => world.crack(s), true)}
          >
            型を崩す
          </button>
        ) : null}
        <div className="grid grid-cols-2 gap-2">
          <Key label="備蓄を焚く" hintKey="1" onClick={() => act((s) => world.burn(s))} />
          <Key
            label={world.shutter ? "シャッターを上げる" : "シャッターを下ろす"}
            hintKey="2"
            onClick={() => act((s) => world.toggleShutter(s))}
          />
          <Key label="闇市を覗く" hintKey="3" onClick={() => act((s) => world.market(s))} />
          <Key label="祈る（休眠）" hintKey="4" onClick={() => act((s) => world.rest(s))} />
          <Key
            label="地下へ降りる"
            onClick={() => act((s) => world.goDown(s), !world.undergroundOpen)}
          />
          <Key label={busy === "listen" ? "聴取中" : "外界を聴取"} disabled={busy !== null} onClick={() => void listen()} />
          <Key
            label={busy === "myth" ? "変換中" : "神話へ変換"}
            disabled={busy !== null}
            onClick={() => void myth()}
          />
          <Key
            label="生活を漏らす"
            onClick={() => {
              unlockLeakAudio();
              blip("act");
              setOpen(true);
            }}
          />
        </div>
        <p className="mt-2 hidden text-xs text-ash md:block">1 焚く · 2 扉 · 3 市 · 4 祈る · M 音</p>
      </div>

      {open ? (
        <LeakSheet
          batteryLive={batteryLive}
          battery={sensor.battery}
          sensor={sensor}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </Frame>
  );
}

function Key({
  label,
  onClick,
  disabled,
  hintKey,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  hintKey?: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="key min-h-11 border border-line bg-panel px-2 text-sm text-bone disabled:opacity-40"
    >
      {hintKey ? <span className="mr-1 text-phosphor">{hintKey}</span> : null}
      {label}
    </button>
  );
}

