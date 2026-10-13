import { useEffect, useRef, useState } from "react";
import { blip, resumeLeakAudio, setDrone, unlockLeakAudio } from "@/lib/leak/audio";
import { derived, hint, PLACES, clockLabel, type SensorNow } from "@/lib/leak/model";
import { listenOutside } from "@/lib/leak/outside";
import { useLeak } from "@/lib/leak/store";
import { LeakSheet } from "@/components/leak/sheet";
import { useSensor } from "@/components/leak/sensors";
import { OutpostScene } from "@/components/outpost/scene";

export function OutpostStage({ onGauges }: { onGauges: () => void }) {
  const { sensor, batteryLive } = useSensor();
  const sensorRef = useRef(sensor);
  sensorRef.current = sensor;
  const world = useLeak();
  const view = derived(world, sensor);
  const [sheet, setSheet] = useState(false);
  const [busy, setBusy] = useState(false);
  const [lost, setLost] = useState(0);
  const [booting, setBooting] = useState(false);

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
  }, [world.muted, world.meters.warmth, world.meters.silence, world.blackout, world.night, world.meters.bubble]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const tag = (event.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      const api = useLeak.getState();
      const now = sensorRef.current;
      if (event.key === "1") {
        blip("act");
        api.burn(now);
      } else if (event.key === "2") {
        blip("act");
        api.toggleShutter(now);
      } else if (event.key === "3") {
        blip("act");
        api.market(now);
      } else if (event.key === "4") {
        blip("act");
        api.rest(now);
      } else if (event.key === "m" || event.key === "M") {
        api.mute();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!booting) return;
    const id = window.setTimeout(() => setBooting(false), 500);
    return () => window.clearTimeout(id);
  }, [booting, lost]);

  const act = (fn: (now: SensorNow) => void) => {
    unlockLeakAudio();
    blip("act");
    fn(sensorRef.current);
  };

  async function listen() {
    if (busy) return;
    unlockLeakAudio();
    blip("act");
    setBusy(true);
    const api = useLeak.getState();
    const place = PLACES.find((item) => item.name === api.placeLabel) ?? PLACES[0];
    let lat: number = place.lat;
    let lon: number = place.lon;
    let label = api.placeLabel;
    try {
      if (api.useGeo && navigator.geolocation) {
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
        }
      }
      const report = await listenOutside({ data: { lat, lon } });
      const now = sensorRef.current;
      if (report.sky) api.applySky(report.sky, label, now);
      if (report.headlines.length) api.applyNews(report.headlines, now);
      if (!report.sky && report.skyError) api.say("sys", report.skyError + "。", now);
    } catch {
      api.say("sys", "外界への回線が落ちた。", sensorRef.current);
    } finally {
      setBusy(false);
    }
  }

  const link = view.source === "link" ? "電池連動" : view.source === "hand" ? "電池は手入力" : "電池は公称";

  return (
    <div className="relative h-dvh overflow-hidden bg-ink text-bone">
      <div className="absolute inset-0" style={{ touchAction: "none" }}>
        {booting ? null : <OutpostScene key={lost} sensorRef={sensorRef} onLost={() => { setBooting(true); setLost((n) => n + 1); }} />}
      </div>

      <header className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-3 px-3 py-3 sm:px-4">
        <div className="pointer-events-auto min-w-0 rounded-md bg-ink/85 px-3 py-2">
          <p className="text-xs tracking-widest text-phosphor">OUTPOST #04</p>
          <h1 className="truncate text-sm text-bone">観測端末の向こう</h1>
        </div>
        <div className="pointer-events-auto rounded-md bg-ink/85 px-3 py-2 text-right">
          <p className="text-lg leading-none tabular-nums">{clockLabel(sensor.now)}</p>
          <p className="mt-1 text-xs text-ash">
            第{world.epoch}期 · {link}
            {world.blackout ? " · 停電" : ""}
            {view.petrified ? " · 石化" : ""}
          </p>
        </div>
      </header>

      <div className="absolute inset-x-0 bottom-0 z-20 px-3 pb-3 sm:px-4">
        <div className="rounded-md bg-ink/90 p-2">
        <p className="mb-2 px-1 text-sm leading-relaxed text-pretty text-bone">{hint(world, view)}</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <button type="button" className="key min-h-11 border border-line bg-ink px-2 text-sm" onClick={() => act((now) => world.burn(now))}>
            備蓄を焚く
          </button>
          <button type="button" className="key min-h-11 border border-line bg-ink px-2 text-sm" onClick={() => act((now) => world.toggleShutter(now))}>
            {world.shutter ? "シャッターを上げる" : "シャッターを下ろす"}
          </button>
          <button type="button" className="key min-h-11 border border-line bg-ink px-2 text-sm" onClick={() => act((now) => world.market(now))}>
            闇市を覗く
          </button>
          <button type="button" className="key min-h-11 border border-line bg-ink px-2 text-sm" onClick={() => act((now) => world.rest(now))}>
            祈る
          </button>
        </div>
        <div className="mt-2 grid grid-cols-3 gap-2">
          <button type="button" className="key min-h-11 border border-line bg-ink px-2 text-sm text-phosphor" onClick={() => { unlockLeakAudio(); blip("act"); setSheet(true); }}>
            生活を漏らす
          </button>
          <button type="button" className="key min-h-11 border border-line bg-ink px-2 text-sm" disabled={busy} onClick={() => void listen()}>
            {busy ? "聴取中" : "空を見る"}
          </button>
          <button type="button" className="key min-h-11 border border-line bg-ink px-2 text-sm" onClick={onGauges}>
            計器
          </button>
        </div>
        </div>
      </div>

      {sheet ? (
        <LeakSheet
          batteryLive={batteryLive}
          battery={sensor.battery}
          sensor={sensor}
          onClose={() => setSheet(false)}
        />
      ) : null}
    </div>
  );
}
