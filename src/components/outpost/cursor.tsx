import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type Body = {
  x: number;
  y: number;
  vx: number;
  vy: number;
};

function spring(body: Body, tx: number, ty: number, dt: number, stiff: number, damp: number) {
  body.vx += (tx - body.x) * stiff * dt;
  body.vy += (ty - body.y) * stiff * dt;
  const decay = Math.exp(-damp * dt);
  body.vx *= decay;
  body.vy *= decay;
  body.x += body.vx * dt;
  body.y += body.vy * dt;
}

export function PuniCursor() {
  const main = useRef<HTMLDivElement>(null);
  const face = useRef<HTMLDivElement>(null);
  const ghost = useRef<HTMLDivElement>(null);
  const [host, setHost] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setHost(document.body);
  }, []);

  useEffect(() => {
    if (!host) return;
    const root = document.documentElement;
    const fine = window.matchMedia("(pointer: fine)").matches;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let seen = false;
    let down = false;
    let tx = -100;
    let ty = -100;
    const lead: Body = { x: tx, y: ty, vx: 0, vy: 0 };
    const tail: Body = { x: tx, y: ty, vx: 0, vy: 0 };
    let frame = 0;
    let prev = performance.now();

    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - prev) / 1000);
      prev = now;
      if (seen) {
        if (reduce) {
          lead.x = tx;
          lead.y = ty;
          lead.vx = 0;
          lead.vy = 0;
          tail.x = tx;
          tail.y = ty;
        } else {
          spring(lead, tx, ty, dt, down ? 420 : 260, down ? 18 : 12);
          spring(tail, lead.x, lead.y, dt, 90, 10);
        }
        const speed = Math.hypot(lead.vx, lead.vy);
        const stretch = reduce ? 1 : 1 + Math.min(0.7, speed / 1100);
        const angle = Math.atan2(lead.vy, lead.vx);
        const squash = down ? 0.62 : 1;
        const sx = stretch * (down ? 1.28 : 1);
        const sy = (1 / stretch) * squash;
        if (main.current) {
          main.current.style.opacity = "1";
          main.current.style.transform = `translate3d(${lead.x}px, ${lead.y}px, 0) rotate(${angle}rad) scale(${sx}, ${sy})`;
        }
        if (face.current) {
          const tilt = down ? 0.6 : 1;
          face.current.style.transform = `rotate(${-angle}rad) scale(${(1 / sx) * tilt}, ${(1 / sy) * (down ? 0.7 : 1)})`;
        }
        if (ghost.current) {
          ghost.current.style.opacity = reduce ? "0" : String(Math.min(0.45, speed / 1800));
          ghost.current.style.transform = `translate3d(${tail.x}px, ${tail.y}px, 0) rotate(${angle}rad) scale(${sx * 0.8}, ${sy * 0.8})`;
        }
      }
      frame = requestAnimationFrame(loop);
    };

    const place = (event: PointerEvent) => {
      tx = event.clientX;
      ty = event.clientY;
      if (!seen) {
        seen = true;
        lead.x = tx;
        lead.y = ty;
        tail.x = tx;
        tail.y = ty;
        if (fine) root.classList.add("puni-on");
      }
    };
    const onDown = (event: PointerEvent) => {
      down = true;
      place(event);
    };
    const onUp = () => {
      down = false;
    };

    window.addEventListener("pointermove", place, { passive: true });
    window.addEventListener("pointerdown", onDown, { passive: true });
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    frame = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(frame);
      root.classList.remove("puni-on");
      window.removeEventListener("pointermove", place);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [host]);

  if (!host) return null;
  return createPortal(
    <>
      <div ref={ghost} className="puni puni-ghost" />
      <div ref={main} className="puni">
        <div ref={face} className="puni-face">
          <i />
          <i />
        </div>
      </div>
    </>,
    host,
  );
}
