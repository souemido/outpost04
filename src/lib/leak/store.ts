import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  applyLedger,
  blackMarket,
  burnFuel,
  crackPattern,
  createWorld,
  descend,
  driftWorld,
  ingestSky,
  note,
  pray,
  recordMyth,
  setHeadlines,
  setPowerOverride,
  toggleShutter,
  type Ledger,
  type LogKind,
  type SensorNow,
  type Sky,
  type World,
} from "@/lib/leak/model";

type LeakActions = {
  awaken: (mode: "blank" | "exercise") => void;
  reset: () => void;
  drift: (sensor: SensorNow) => void;
  leak: (ledger: Ledger, sensor: SensorNow) => void;
  burn: (sensor: SensorNow) => void;
  toggleShutter: (sensor: SensorNow) => void;
  market: (sensor: SensorNow) => void;
  rest: (sensor: SensorNow) => void;
  goDown: (sensor: SensorNow) => void;
  crack: (sensor: SensorNow) => void;
  applySky: (snapshot: Sky, placeLabel: string, sensor: SensorNow) => void;
  applyNews: (lines: string[], sensor: SensorNow) => void;
  myth: (text: string, key: string, sensor: SensorNow) => void;
  say: (kind: LogKind, text: string, sensor: SensorNow) => void;
  power: (override: { level: number; charging: boolean } | null, sensor: SensorNow) => void;
  place: (label: string) => void;
  geo: (on: boolean) => void;
  mute: () => void;
};

type LeakStore = World & LeakActions;

function onlyWorld(state: LeakStore): World {
  return {
    version: state.version,
    awake: state.awake,
    epoch: state.epoch,
    strata: state.strata,
    meters: state.meters,
    ledger: state.ledger,
    days: state.days,
    sky: state.sky,
    placeLabel: state.placeLabel,
    useGeo: state.useGeo,
    override: state.override,
    shutter: state.shutter,
    blackout: state.blackout,
    undergroundOpen: state.undergroundOpen,
    descended: state.descended,
    night: state.night,
    anomaly: state.anomaly,
    grace: state.grace,
    muted: state.muted,
    headlines: state.headlines,
    logs: state.logs,
    seq: state.seq,
    prayedOn: state.prayedOn,
    coldBand: state.coldBand,
    lastMythKey: state.lastMythKey,
  };
}

export const useLeak = create<LeakStore>()(
  persist(
    (set) => ({
      ...createWorld("dormant", new Date()),
      awaken: (mode) =>
        set((state) => {
          const next = createWorld(mode, new Date());
          next.muted = state.muted;
          return next;
        }),
      reset: () =>
        set((state) => {
          const next = createWorld("dormant", new Date());
          next.muted = state.muted;
          return next;
        }),
      drift: (sensor) => set((state) => driftWorld(onlyWorld(state), sensor)),
      leak: (ledger, sensor) => set((state) => applyLedger(onlyWorld(state), ledger, sensor)),
      burn: (sensor) => set((state) => burnFuel(onlyWorld(state), sensor)),
      toggleShutter: (sensor) => set((state) => toggleShutter(onlyWorld(state), sensor)),
      market: (sensor) => set((state) => blackMarket(onlyWorld(state), sensor)),
      rest: (sensor) => set((state) => pray(onlyWorld(state), sensor)),
      goDown: (sensor) => set((state) => descend(onlyWorld(state), sensor)),
      crack: (sensor) => set((state) => crackPattern(onlyWorld(state), sensor)),
      applySky: (snapshot, placeLabel, sensor) =>
        set((state) => ingestSky(onlyWorld(state), snapshot, placeLabel, sensor)),
      applyNews: (lines, sensor) => set((state) => setHeadlines(onlyWorld(state), lines, sensor)),
      myth: (text, key, sensor) => set((state) => recordMyth(onlyWorld(state), text, key, sensor)),
      say: (kind, text, sensor) => set((state) => note(onlyWorld(state), kind, text, sensor)),
      power: (override, sensor) =>
        set((state) => setPowerOverride(onlyWorld(state), override, sensor)),
      place: (label) => set({ placeLabel: label }),
      geo: (on) => set({ useGeo: on }),
      mute: () => set((state) => ({ muted: !state.muted })),
    }),
    { name: "leak-ambient", version: 1, skipHydration: true, partialize: onlyWorld },
  ),
);
