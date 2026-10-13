import { useEffect, useMemo, useState } from "react";
import type { SensorNow } from "@/lib/leak/model";

export type BatterySnap = { level: number; charging: boolean };

export function useSensor() {
  const [now, setNow] = useState(() => new Date());
  const [battery, setBattery] = useState<BatterySnap | null>(null);
  const [batteryLive, setBatteryLive] = useState(false);

  useEffect(() => {
    let frame = 0;
    let last = 0;
    const loop = (t: number) => {
      if (t - last > 1000) {
        last = t;
        setNow(new Date());
      }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    const nav = navigator as Navigator & {
      getBattery?: () => Promise<{
        level: number;
        charging: boolean;
        addEventListener: (type: string, fn: () => void) => void;
        removeEventListener: (type: string, fn: () => void) => void;
      }>;
    };
    if (!nav.getBattery) return;
    let dead = false;
    let bat: Awaited<ReturnType<NonNullable<typeof nav.getBattery>>> | null = null;
    const pull = () => {
      if (!bat || dead) return;
      setBattery({ level: bat.level, charging: bat.charging });
    };
    void nav.getBattery().then((node) => {
      if (dead) return;
      bat = node;
      setBatteryLive(true);
      pull();
      node.addEventListener("levelchange", pull);
      node.addEventListener("chargingchange", pull);
    });
    return () => {
      dead = true;
      if (!bat) return;
      bat.removeEventListener("levelchange", pull);
      bat.removeEventListener("chargingchange", pull);
    };
  }, []);

  const sensor = useMemo<SensorNow>(() => ({ now, battery }), [now, battery]);
  return { sensor, batteryLive };
}
