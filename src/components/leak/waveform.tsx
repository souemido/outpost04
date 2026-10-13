import { useEffect, useRef } from "react";

type WaveProps = {
  power: number;
  noise: number;
  blackout: boolean;
  petrified: boolean;
  deep: boolean;
};

export function Waveform(props: WaveProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const propsRef = useRef(props);
  propsRef.current = props;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let frame = 0;
    let alive = true;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const draw = (time: number) => {
      if (!alive) return;
      const node = canvasRef.current;
      if (!node) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = node.clientWidth;
      const height = node.clientHeight;
      const bw = Math.max(1, Math.floor(width * dpr));
      const bh = Math.max(1, Math.floor(height * dpr));
      if (node.width !== bw || node.height !== bh) {
        node.width = bw;
        node.height = bh;
      }
      const style = getComputedStyle(node);
      const phosphor = style.color || "#e3a23a";
      const grid = style.borderColor || "#3c3428";
      const wash = style.backgroundColor || "#1a1713";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = wash;
      ctx.fillRect(0, 0, width, height);
      ctx.strokeStyle = grid;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, height / 2);
      ctx.lineTo(width, height / 2);
      ctx.stroke();
      const p = propsRef.current;
      const amp = (p.petrified ? 0.08 : 0.18 + (p.noise / 100) * 0.7) * (p.blackout ? 0.45 : 1);
      const freq = 0.02 + (p.power / 100) * 0.045 + (p.deep ? 0.01 : 0);
      const phase = reduced ? 0.6 : time * (p.petrified ? 0.00035 : 0.0022);
      ctx.beginPath();
      ctx.strokeStyle = phosphor;
      ctx.lineWidth = 1.5;
      for (let x = 0; x <= width; x += 2) {
        const a = Math.sin(x * freq + phase);
        const b = Math.sin(x * freq * 2.6 + phase * 1.6) * 0.35;
        const spike = p.blackout && Math.sin(x * 0.31 + phase * 2) > 0.96 ? 0.9 : 0;
        const y = height / 2 + (a + b) * height * 0.38 * amp - spike * height * 0.28;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => {
      alive = false;
      cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="h-16 w-full border border-line bg-panel text-phosphor"
    />
  );
}
