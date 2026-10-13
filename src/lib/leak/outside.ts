import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { Sky } from "@/lib/leak/model";

const placeSchema = z.object({
  lat: z.number().gte(-90).lte(90),
  lon: z.number().gte(-180).lte(180),
});

const mythSchema = z.object({
  skyLine: z.string().max(400),
  headlines: z.array(z.string().max(240)).max(4),
  shelter: z.string().max(400),
});

export type OutsideReport = {
  sky: Sky | null;
  skyError: string | null;
  headlines: string[];
  newsError: string | null;
};

export type MythResult =
  | { ok: true; text: string }
  | { ok: false; error: "unavailable" | "empty" | "failed" };

async function readText(url: string) {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(8000),
    headers: { Accept: "application/rss+xml, application/xml, text/xml, application/json, */*" },
  });
  if (!res.ok) throw new Error(String(res.status));
  return res.text();
}

function titlesFromRss(xml: string) {
  const out: string[] = [];
  const re = /<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(xml))) {
    const title = (match[1] ?? "")
      .replace(/<!\[CDATA\[|\]\]>/g, "")
      .replace(/<[^>]+>/g, "")
      .replace(/\s+/g, " ")
      .trim();
    if (!title) continue;
    if (/^(NHK|BBC|Google|ロイター|RSS|Yahoo)/i.test(title) && title.length < 18) continue;
    if (out.includes(title)) continue;
    out.push(title);
    if (out.length >= 4) break;
  }
  return out;
}

function symbolToCode(symbol: string) {
  const name = symbol.replace(/_(day|night|polartwilight)$/g, "");
  if (name.startsWith("clearsky")) return 0;
  if (name.startsWith("fair")) return 1;
  if (name.startsWith("partlycloudy")) return 2;
  if (name.startsWith("cloudy")) return 3;
  if (name.includes("fog")) return 45;
  if (name.includes("sleet")) return 85;
  if (name.includes("snow")) return 71;
  if (name.includes("thunder")) return 95;
  if (name.includes("heavyrain")) return 65;
  if (name.includes("rain") || name.includes("drizzle")) return 61;
  return 2;
}

async function skyFromOpenMeteo(lat: number, lon: number): Promise<Sky> {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    "&current=temperature_2m,weather_code,wind_speed_10m,surface_pressure&timezone=auto";
  const json = JSON.parse(await readText(url)) as {
    error?: boolean;
    current?: {
      temperature_2m?: number;
      weather_code?: number;
      wind_speed_10m?: number;
      surface_pressure?: number;
    };
  };
  if (json.error) throw new Error("limit");
  const current = json.current;
  if (
    !current ||
    typeof current.temperature_2m !== "number" ||
    typeof current.weather_code !== "number"
  ) {
    throw new Error("shape");
  }
  return {
    tempC: current.temperature_2m,
    code: current.weather_code,
    wind: current.wind_speed_10m ?? 0,
    pressure: current.surface_pressure ?? 1013,
  };
}

async function skyFromMet(lat: number, lon: number): Promise<Sky> {
  const url = `https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${lat}&lon=${lon}`;
  const res = await fetch(url, {
    signal: AbortSignal.timeout(8000),
    headers: { "User-Agent": "LEAK-AMBIENT/0.1 (observation terminal)" },
  });
  if (!res.ok) throw new Error(String(res.status));
  const json = (await res.json()) as {
    properties?: {
      timeseries?: {
        data?: {
          instant?: {
            details?: {
              air_temperature?: number;
              wind_speed?: number;
              air_pressure_at_sea_level?: number;
            };
          };
          next_1_hours?: { summary?: { symbol_code?: string } };
          next_6_hours?: { summary?: { symbol_code?: string } };
          next_12_hours?: { summary?: { symbol_code?: string } };
        };
      }[];
    };
  };
  const data = json.properties?.timeseries?.[0]?.data;
  const details = data?.instant?.details;
  if (!details || typeof details.air_temperature !== "number") throw new Error("shape");
  const symbol =
    data?.next_1_hours?.summary?.symbol_code ??
    data?.next_6_hours?.summary?.symbol_code ??
    data?.next_12_hours?.summary?.symbol_code ??
    "cloudy";
  return {
    tempC: details.air_temperature,
    code: symbolToCode(symbol),
    wind: (details.wind_speed ?? 0) * 3.6,
    pressure: details.air_pressure_at_sea_level ?? 1013,
  };
}

export const listenOutside = createServerFn({ method: "POST" })
  .validator((input: unknown) => placeSchema.parse(input))
  .handler(async ({ data }): Promise<OutsideReport> => {
    let sky: Sky | null = null;
    let skyError: string | null = null;
    let headlines: string[] = [];
    let newsError: string | null = null;
    try {
      sky = await skyFromOpenMeteo(data.lat, data.lon);
    } catch {
      try {
        sky = await skyFromMet(data.lat, data.lon);
      } catch {
        skyError = "大気の吸入に失敗した";
      }
    }
    const feeds = [
      "https://www.nhk.or.jp/rss/news/cat0.xml",
      "https://feeds.bbci.co.uk/news/world/rss.xml",
    ];
    for (const feed of feeds) {
      if (headlines.length >= 3) break;
      try {
        const more = titlesFromRss(await readText(feed));
        for (const line of more) {
          if (!headlines.includes(line)) headlines.push(line);
        }
      } catch {
        newsError = "見出しの受信に失敗した";
      }
    }
    if (headlines.length > 0) newsError = null;
    return { sky, skyError, headlines: headlines.slice(0, 4), newsError };
  });

const SYSTEM = `あなたはシェルター観測端末の文体変換器である。
現実の天気とニュース見出しを、ゲーム世界の物価・治安・天候の基底を決める日誌へ翻訳する。
日本語。3から5文。見出しにない事実を足さない。見出しの固有名詞は残す。
語彙は観測記録（動力炉、交易路、極夜、泡、層）を使ってよいが、説明口調や箇条書きは禁止。
出力は本文だけ。`;

export const mythologize = createServerFn({ method: "POST" })
  .validator((input: unknown) => mythSchema.parse(input))
  .handler(async ({ data }): Promise<MythResult> => {
    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) return { ok: false, error: "unavailable" };
    if (!data.skyLine && data.headlines.length === 0) return { ok: false, error: "empty" };
    const user = [
      `天気: ${data.skyLine || "欠測"}`,
      "見出し:",
      ...(data.headlines.length ? data.headlines.map((line) => `- ${line}`) : ["- なし"]),
      `シェルターの現状: ${data.shelter}`,
    ].join("\n");
    try {
      const res = await fetch("https://api.x.ai/v1/chat/completions", {
        method: "POST",
        signal: AbortSignal.timeout(20000),
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "grok-4.5",
          max_tokens: 280,
          temperature: 0.6,
          messages: [
            { role: "system", content: SYSTEM },
            { role: "user", content: user },
          ],
        }),
      });
      if (!res.ok) return { ok: false, error: "failed" };
      const body = (await res.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      const text = body.choices?.[0]?.message?.content?.trim() ?? "";
      if (!text) return { ok: false, error: "empty" };
      return { ok: true, text: text.slice(0, 700) };
    } catch {
      return { ok: false, error: "failed" };
    }
  });
