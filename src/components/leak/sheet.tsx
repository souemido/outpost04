import { useEffect, useState } from "react";
import { blip, unlockLeakAudio } from "@/lib/leak/audio";
import { PLACES, sleepMinutesFromTime, timeFromMinutes, type Ledger, type Motion, type SensorNow } from "@/lib/leak/model";
import { useLeak } from "@/lib/leak/store";
import type { BatterySnap } from "@/components/leak/sensors";

export function LeakSheet({
  onClose,
  batteryLive,
  battery,
  sensor,
}: {
  onClose: () => void;
  batteryLive: boolean;
  battery: BatterySnap | null;
  sensor: SensorNow;
}) {
  const ledger = useLeak((s) => s.ledger);
  const placeLabel = useLeak((s) => s.placeLabel);
  const useGeo = useLeak((s) => s.useGeo);
  const override = useLeak((s) => s.override);
  const [sleep, setSleep] = useState(timeFromMinutes(ledger.sleepMinutes));
  const [steps, setSteps] = useState(String(ledger.steps));
  const [screen, setScreen] = useState(String(ledger.screenMin));
  const [unread, setUnread] = useState(String(ledger.unread));
  const [gacha, setGacha] = useState(ledger.gacha);
  const [motion, setMotion] = useState<Motion>(ledger.motion);
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    if (!armed) return;
    const id = window.setTimeout(() => setArmed(false), 4000);
    return () => window.clearTimeout(id);
  }, [armed]);

  function commit() {
    const next: Ledger = {
      sleepMinutes: sleepMinutesFromTime(sleep),
      steps: Number(steps),
      screenMin: Number(screen),
      unread: Number(unread),
      gacha,
      motion,
    };
    unlockLeakAudio();
    blip("act");
    useLeak.getState().leak(next, sensor);
    onClose();
  }

  return (
    <div className="absolute inset-0 z-30 overflow-y-auto bg-ink px-3 py-3 sm:px-4">
      <div className="sticky top-0 flex items-center justify-between bg-ink pb-3">
        <h2 className="text-sm text-phosphor">生活の漏出</h2>
        <button type="button" className="key min-h-11 px-3 text-sm text-bone" onClick={onClose}>
          閉じる
        </button>
      </div>
      <form
        className="space-y-4 pb-8"
        onSubmit={(event) => {
          event.preventDefault();
          commit();
        }}
      >
        <label className="block text-sm text-ash">
          昨夜の就寝
          <input
            className="field mt-1"
            type="time"
            value={sleep}
            onChange={(event) => setSleep(event.target.value)}
          />
        </label>
        <label className="block text-sm text-ash">
          今日の歩数
          <input
            className="field mt-1 tabular-nums"
            inputMode="numeric"
            value={steps}
            onChange={(event) => setSteps(event.target.value)}
          />
        </label>
        <label className="block text-sm text-ash">
          画面の滞在（YouTube / SNS / ゲーム、分）
          <input
            className="field mt-1 tabular-nums"
            inputMode="numeric"
            value={screen}
            onChange={(event) => setScreen(event.target.value)}
          />
        </label>
        <label className="block text-sm text-ash">
          未読の通知
          <input
            className="field mt-1 tabular-nums"
            inputMode="numeric"
            value={unread}
            onChange={(event) => setUnread(event.target.value)}
          />
        </label>
        <label className="flex min-h-11 items-center gap-3 text-sm text-bone">
          <input
            type="checkbox"
            checked={gacha}
            onChange={(event) => setGacha(event.target.checked)}
          />
          課金かガチャの通知を受け取った
        </label>
        <label className="block text-sm text-ash">
          移動
          <select
            className="field mt-1"
            value={motion}
            onChange={(event) => setMotion(event.target.value as Motion)}
          >
            <option value="still">静止</option>
            <option value="walk">歩行</option>
            <option value="ride">車両</option>
          </select>
        </label>
        <button type="submit" className="key min-h-11 w-full border border-phosphor text-sm text-phosphor">
          この生活を世界へ漏らす
        </button>

        <fieldset className="space-y-3 border border-line p-3">
          <legend className="px-1 text-xs text-phosphor">動力炉</legend>
          <p className="text-sm leading-relaxed text-pretty text-ash">
            {batteryLive && battery
              ? `端末の実読取 ${Math.round(battery.level * 100)}%${battery.charging ? "、充電中" : ""}。`
              : "このブラウザはバッテリーを渡さない。手で漏らすか、公称値 72% で動く。"}
          </p>
          <label className="flex min-h-11 items-center gap-3 text-sm text-bone">
            <input
              type="checkbox"
              checked={override != null}
              onChange={(event) => {
                const api = useLeak.getState();
                if (!event.target.checked) {
                  api.power(null, sensor);
                  return;
                }
                api.power(
                  {
                    level: battery ? Math.round(battery.level * 100) : 40,
                    charging: battery?.charging ?? false,
                  },
                  sensor,
                );
              }}
            />
            読取を手で漏らす
          </label>
          {override ? (
            <div className="space-y-2">
              <label className="block text-sm text-ash">
                残量 {override.level}%
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={override.level}
                  onChange={(event) =>
                    useLeak.getState().power(
                      { level: Number(event.target.value), charging: override.charging },
                      sensor,
                    )
                  }
                />
              </label>
              <label className="flex min-h-11 items-center gap-3 text-sm text-bone">
                <input
                  type="checkbox"
                  checked={override.charging}
                  onChange={(event) =>
                    useLeak.getState().power(
                      { level: override.level, charging: event.target.checked },
                      sensor,
                    )
                  }
                />
                充電中
              </label>
            </div>
          ) : null}
        </fieldset>

        <fieldset className="space-y-3 border border-line p-3">
          <legend className="px-1 text-xs text-phosphor">外界</legend>
          <label className="block text-sm text-ash">
            観測点
            <select
              className="field mt-1"
              value={PLACES.some((item) => item.name === placeLabel) ? placeLabel : "東京"}
              onChange={(event) => useLeak.getState().place(event.target.value)}
            >
              {PLACES.map((item) => (
                <option key={item.id} value={item.name}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex min-h-11 items-center gap-3 text-sm text-bone">
            <input
              type="checkbox"
              checked={useGeo}
              onChange={(event) => useLeak.getState().geo(event.target.checked)}
            />
            聴取時に現在地を使う
          </label>
        </fieldset>

        <details className="border border-line px-3 py-2 text-sm leading-relaxed text-pretty text-ash">
          <summary className="min-h-11 cursor-pointer py-2 text-bone">この端末の規程</summary>
          <ul className="list-disc space-y-2 pb-3 pl-4">
            <li>現地時刻が2時から5時、または就寝がその時間帯だと、極夜プロトコルが室温を落とす。夜行種が寄ることがある。</li>
            <li>動力が5%未満かつ非充電で全電源が落ち、地下の錠が外れる。12%以上か充電で明かりは戻る。</li>
            <li>ガチャや決済の通知は黄金の泡を立て、闇市の値を狂わせる。</li>
            <li>直近の眠りと歩数から平均を作る。15分の夜更かし、2割の歩数差がバタフライになる。</li>
            <li>同じ生活で祈ると澱み、80で石化して燃料の効きが半減する。40分のずれで型は割れる。</li>
            <li>室温が尽きるか、食料と燃料が同時に尽きると、その期は地層になる。ゲームオーバーではない。</li>
            <li>天気と見出しは外から吸う。神話化は押したとき一度だけ変換し、同じ通信は繰り返さない。</li>
          </ul>
        </details>

        <button
          type="button"
          className="key min-h-11 w-full border border-line text-sm text-ash"
          onClick={() => {
            if (!armed) {
              setArmed(true);
              return;
            }
            useLeak.getState().reset();
          }}
        >
          {armed ? "本当に観測を破棄する" : "観測を破棄して最初へ"}
        </button>
      </form>
    </div>
  );
}
