import { Html } from "@react-three/drei";
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import * as THREE from "three";
import { squelch, unlockLeakAudio } from "@/lib/leak/audio";
import { reactorOf, type SensorNow } from "@/lib/leak/model";
import { useLeak } from "@/lib/leak/store";

const CREW = [
  { x: -0.15, z: 0.15, body: "#ffb3c7", blush: "#ff8fab", cap: "", name: "もも" },
  { x: 0.62, z: 1.05, body: "#f3d7a1", blush: "#f0a0a8", cap: "#e85d4c", name: "たまご" },
  { x: 1.35, z: 0.05, body: "#fff6ee", blush: "#ffc2a8", cap: "", name: "しろ" },
  { x: 1.55, z: 0.95, body: "#9ee7c9", blush: "#ffb7c8", cap: "", name: "みんと" },
] as const;

const POKE = ["ぷに。", "やわらかいところだ。", "……もう一回。", "観測員、手をどけて。"];

type Slot = {
  x: number;
  z: number;
  vx: number;
  vz: number;
  squish: number;
  homeX: number;
  homeZ: number;
};

type Bubble = { crew: number; text: string; warn: boolean };

const WARN = /警告|危機|喪失|死亡|極夜|停電|石化|凍|全滅/;

function pokeLine(): Bubble {
  const world = useLeak.getState();
  const crew = Math.floor(Math.random() * CREW.length);
  if (world.meters.stagnation >= 80) return { crew, text: "石の中で、まだ柔らかい。", warn: true };
  if (world.blackout) return { crew, text: "暗い。つつく手が見えない。", warn: true };
  if (world.night === "deep") return { crew, text: "起きているのは、あなただけじゃない。", warn: true };
  if (world.meters.warmth < 28) return { crew, text: "さむい。燃料はある？", warn: true };
  if (world.meters.bubble >= 40) return { crew, text: "金の匂い。触るな、つく。", warn: false };
  return { crew, text: POKE[Math.floor(Math.random() * POKE.length)] ?? "ぷに。", warn: false };
}

function ContextGuard({ onLost }: { onLost: () => void }) {
  const gl = useThree((s) => s.gl);
  const lostRef = useRef(onLost);
  lostRef.current = onLost;
  useEffect(() => {
    const canvas = gl.domElement;
    const lost = (event: Event) => {
      event.preventDefault();
      lostRef.current();
    };
    canvas.addEventListener("webglcontextlost", lost);
    return () => canvas.removeEventListener("webglcontextlost", lost);
  }, [gl]);
  return null;
}

function Sky({ sensorRef }: { sensorRef: RefObject<SensorNow> }) {
  const day = useMemo(() => new THREE.Color("#9ed4ff"), []);
  const night = useMemo(() => new THREE.Color("#323a68"), []);
  const storm = useMemo(() => new THREE.Color("#9aabbe"), []);
  const work = useMemo(() => new THREE.Color("#9ed4ff"), []);
  const groundDay = useMemo(() => new THREE.Color("#f4f1ea"), []);
  const groundCold = useMemo(() => new THREE.Color("#d5e4f4"), []);
  const groundNow = useMemo(() => new THREE.Color("#f4f1ea"), []);
  const hemi = useRef<THREE.HemisphereLight>(null);
  const sun = useRef<THREE.DirectionalLight>(null);
  const ground = useRef<THREE.MeshLambertMaterial>(null);
  const core = useRef<THREE.Mesh>(null);
  const coreMat = useRef<THREE.MeshLambertMaterial>(null);
  const ring = useRef<THREE.Mesh>(null);
  const look = useMemo(() => new THREE.Vector3(0.35, 0.25, 0.25), []);

  useFrame(({ scene, camera, clock }) => {
    const world = useLeak.getState();
    const rec = reactorOf(world, sensorRef.current);
    const t = clock.elapsedTime;
    const nightMix = world.night === "deep" ? 0.92 : world.night === "mild" ? 0.4 : 0;
    const stormMix = world.sky && world.sky.code >= 61 ? 0.55 : world.sky && world.sky.code >= 45 ? 0.25 : 0;
    work.copy(day).lerp(night, nightMix).lerp(storm, stormMix);
    if (world.blackout) work.lerp(night, 0.55);
    scene.background = work;
    const cold = Math.max(0, Math.min(1, (34 - world.meters.warmth) / 34));
    groundNow.copy(groundDay).lerp(groundCold, Math.max(cold, nightMix * 0.35));
    if (ground.current) ground.current.color.copy(groundNow);
    const dim = world.blackout ? 0.16 : 1;
    if (hemi.current) hemi.current.intensity = (0.72 - nightMix * 0.28) * dim;
    if (sun.current) sun.current.intensity = (1.05 - nightMix * 0.55) * dim;
    const power = rec.power / 100;
    if (core.current && coreMat.current) {
      const pulse = rec.charging ? 1 + Math.sin(t * 8) * 0.08 : 1;
      core.current.scale.setScalar((0.75 + power * 0.45) * pulse);
      coreMat.current.color.setHSL(0.08, 0.9, world.blackout ? 0.18 : 0.42 + power * 0.16);
      coreMat.current.emissive.setHSL(0.06, 0.95, world.blackout ? 0.05 : 0.2 + power * 0.35);
      coreMat.current.emissiveIntensity = world.blackout ? 0.2 : 0.7;
    }
    if (ring.current) {
      ring.current.rotation.x = Math.PI / 2;
      ring.current.rotation.z = t * (rec.charging ? 1.6 : 0.2);
      ring.current.visible = !world.blackout || rec.charging;
    }
    camera.position.x = 0.35 + Math.sin(t * 0.07) * 0.35;
    camera.position.y = 4.35 + Math.sin(t * 0.05) * 0.05;
    camera.lookAt(look);
  });

  return (
    <>
      <hemisphereLight ref={hemi} args={["#fff8ee", "#9eb4d8", 0.72]} />
      <directionalLight ref={sun} position={[5, 9, 6]} intensity={1.05} color="#fff4e4" />
      <mesh position={[0, -0.28, 0]} receiveShadow>
        <cylinderGeometry args={[6.4, 6.15, 0.56, 64]} />
        <meshLambertMaterial ref={ground} color="#f4f1ea" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0.2, 0.012, 0.15]}>
        <circleGeometry args={[3.1, 48]} />
        <meshBasicMaterial color="#fffaf3" transparent opacity={0.45} />
      </mesh>
      <group position={[-1.85, 0, -1.55]}>
        <mesh>
          <sphereGeometry args={[1.5, 32, 20, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshLambertMaterial color="#f0b429" />
        </mesh>
        <mesh position={[0.05, 0.42, 1.05]}>
          <cylinderGeometry args={[0.4, 0.44, 0.84, 16]} />
          <meshLambertMaterial color="#3a2c24" />
        </mesh>
        <mesh position={[0.02, 1.48, -0.08]}>
          <boxGeometry args={[0.62, 0.28, 0.42]} />
          <meshLambertMaterial color="#2f9e96" />
        </mesh>
      </group>
      <group position={[2.05, 0, -0.7]}>
        <mesh position={[0, 0.95, 0]}>
          <cylinderGeometry args={[0.34, 0.46, 1.9, 20]} />
          <meshLambertMaterial color="#eadccf" />
        </mesh>
        <mesh ref={core} position={[0, 2.05, 0]}>
          <sphereGeometry args={[0.26, 20, 16]} />
          <meshLambertMaterial ref={coreMat} color="#ff8a3d" emissive="#ff6a1a" emissiveIntensity={0.4} />
        </mesh>
        <mesh ref={ring} position={[0, 2.05, 0]}>
          <torusGeometry args={[0.48, 0.04, 10, 28]} />
          <meshLambertMaterial color="#ffe14a" />
        </mesh>
      </group>
    </>
  );
}

function Flakes({
  count,
  color,
  spread,
  mode,
}: {
  count: number;
  color: string;
  spread: number;
  mode: "snow" | "star";
}) {
  const geo = useMemo(() => {
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i += 1) {
      positions[i * 3] = (Math.random() - 0.5) * spread;
      positions[i * 3 + 1] = mode === "star" ? 2 + Math.random() * 7 : Math.random() * 7;
      positions[i * 3 + 2] = (Math.random() - 0.5) * spread * 0.7;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    return geometry;
  }, [count, mode, spread]);
  const points = useRef<THREE.Points>(null);

  useEffect(() => () => geo.dispose(), [geo]);

  useFrame((_, raw) => {
    const dt = Math.min(0.05, raw);
    const world = useLeak.getState();
    const node = points.current;
    if (!node) return;
    const night = world.night === "deep" ? 1 : world.night === "mild" ? 0.35 : 0;
    const cold = Math.max(0, Math.min(1, (34 - world.meters.warmth) / 34));
    const storm = world.sky && world.sky.code >= 61 ? 1 : 0;
    if (mode === "star") {
      node.visible = night > 0.2 && !world.blackout;
      return;
    }
    const show = Math.max(cold, storm, world.night === "deep" ? 0.45 : 0) > 0.2;
    node.visible = show;
    if (!show) return;
    const attr = geo.attributes.position;
    const arr = attr.array as Float32Array;
    const fall = (0.8 + cold * 1.4 + storm) * dt;
    for (let i = 0; i < count; i += 1) {
      arr[i * 3 + 1] -= fall;
      if (arr[i * 3 + 1] < 0) arr[i * 3 + 1] = 7;
    }
    attr.needsUpdate = true;
  });

  return (
    <points ref={points} geometry={geo}>
      <pointsMaterial color={color} size={mode === "star" ? 0.06 : 0.07} sizeAttenuation transparent opacity={0.9} />
    </points>
  );
}

function Barrels() {
  const count = useLeak((s) => Math.max(0, Math.min(5, Math.round(s.meters.fuel / 18))));
  const colors = ["#3cbe86", "#2aa8c4", "#e15b66", "#f0a0c0", "#7d8cff"];
  return (
    <group position={[2.45, 0, 1.15]}>
      {colors.slice(0, count).map((color, index) => (
        <mesh key={color} position={[(index % 3) * 0.36 - 0.15, 0.22, Math.floor(index / 3) * 0.34]}>
          <cylinderGeometry args={[0.15, 0.16, 0.44, 12]} />
          <meshLambertMaterial color={color} />
        </mesh>
      ))}
    </group>
  );
}

function Crew({
  index,
  slots,
  held,
  bubble,
  onPress,
}: {
  index: number;
  slots: RefObject<Slot[]>;
  held: RefObject<number>;
  bubble: Bubble | null;
  onPress: (index: number) => void;
}) {
  const spec = CREW[index]!;
  const root = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const shadow = useRef<THREE.Mesh>(null);
  const mat = useRef<THREE.MeshLambertMaterial>(null);
  const base = useMemo(() => new THREE.Color(spec.body), [spec.body]);
  const coldTint = useMemo(() => new THREE.Color("#9eb4d8"), []);
  const stone = useMemo(() => new THREE.Color("#b7b3ae"), []);

  useFrame(({ clock }, raw) => {
    const dt = Math.min(0.05, raw);
    const group = root.current;
    const skin = body.current;
    const slot = slots.current?.[index];
    if (!group || !skin || !slot) return;
    const world = useLeak.getState();
    const t = clock.elapsedTime;
    const petrified = world.meters.stagnation >= 80;
    const cold = Math.max(0, Math.min(1, (34 - world.meters.warmth) / 34));
    const grabbing = held.current === index;
    if (!grabbing) {
      const tx = petrified ? slot.homeX : slot.homeX + Math.sin(t * 0.35 + index) * 0.1;
      const tz = petrified ? slot.homeZ : slot.homeZ + Math.cos(t * 0.28 + index) * 0.06;
      slot.vx += (tx - slot.x) * 8 * dt;
      slot.vz += (tz - slot.z) * 8 * dt;
      const decay = Math.exp(-5 * dt);
      slot.vx *= decay;
      slot.vz *= decay;
      slot.x += slot.vx * dt;
      slot.z += slot.vz * dt;
    }
    const hopPhase = Math.sin(t * 2.4 + index * 0.8);
    const lively = !grabbing && !petrified && !world.blackout && cold < 0.55 && world.meters.warmth > 36;
    const lift = lively ? Math.max(0, hopPhase) * 0.28 : 0;
    const shiver = cold > 0.4 && !grabbing ? Math.sin(t * 42 + index) * 0.025 * cold : 0;
    let target = grabbing ? 0.62 : 1;
    if (lively && hopPhase > 0 && hopPhase < 0.22) target = 0.78;
    if (petrified) target = 0.9;
    slot.squish += (target - slot.squish) * (1 - Math.exp(-8 * dt));
    const breathe = petrified ? 1 : 1 + Math.sin(t * 2 + index) * 0.035;
    const yScale = Math.max(0.35, slot.squish * breathe);
    const xz = 1 / Math.sqrt(yScale);
    skin.scale.set(xz, yScale, xz);
    group.position.set(slot.x + shiver, lift, slot.z);
    group.rotation.z = THREE.MathUtils.damp(group.rotation.z, 0, 4, dt);
    group.rotation.x = THREE.MathUtils.damp(group.rotation.x, 0, 4, dt);
    if (shadow.current) shadow.current.scale.set(xz, xz, 1);
    if (mat.current) {
      mat.current.color.copy(base);
      if (petrified) mat.current.color.lerp(stone, 0.72);
      else if (cold > 0) mat.current.color.lerp(coldTint, cold * 0.45);
    }
  });

  const talk = bubble?.crew === index;

  return (
    <group ref={root} position={[spec.x, 0, spec.z]}>
      <mesh ref={shadow} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <circleGeometry args={[0.42, 16]} />
        <meshBasicMaterial color="#1c1a24" transparent opacity={0.16} depthWrite={false} />
      </mesh>
      <group
        ref={body}
        onPointerDown={(event: ThreeEvent<PointerEvent>) => {
          event.stopPropagation();
          const slot = slots.current?.[index];
          if (slot) slot.squish = 0.4;
          held.current = index;
          onPress(index);
        }}
      >
        <mesh position={[0, 0.52, 0]}>
          <sphereGeometry args={[0.5, 28, 20]} />
          <meshLambertMaterial ref={mat} color={spec.body} />
        </mesh>
        <mesh position={[-0.16, 0.64, 0.38]}>
          <sphereGeometry args={[0.07, 12, 10]} />
          <meshBasicMaterial color="#2a2430" />
        </mesh>
        <mesh position={[0.16, 0.64, 0.38]}>
          <sphereGeometry args={[0.07, 12, 10]} />
          <meshBasicMaterial color="#2a2430" />
        </mesh>
        <mesh position={[-0.14, 0.68, 0.44]}>
          <sphereGeometry args={[0.028, 8, 8]} />
          <meshBasicMaterial color="#fffaf6" />
        </mesh>
        <mesh position={[0.18, 0.68, 0.44]}>
          <sphereGeometry args={[0.028, 8, 8]} />
          <meshBasicMaterial color="#fffaf6" />
        </mesh>
        <mesh position={[-0.24, 0.5, 0.34]} scale={[1.15, 0.45, 0.35]}>
          <sphereGeometry args={[0.09, 10, 8]} />
          <meshLambertMaterial color={spec.blush} />
        </mesh>
        <mesh position={[0.24, 0.5, 0.34]} scale={[1.15, 0.45, 0.35]}>
          <sphereGeometry args={[0.09, 10, 8]} />
          <meshLambertMaterial color={spec.blush} />
        </mesh>
        <mesh position={[0, 0.42, 0.46]} rotation={[0.2, 0, 0]}>
          <torusGeometry args={[0.07, 0.018, 6, 10, Math.PI]} />
          <meshBasicMaterial color="#5c3a42" />
        </mesh>
        {spec.cap ? (
          <mesh position={[0.02, 0.98, -0.02]}>
            <sphereGeometry args={[0.28, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshLambertMaterial color={spec.cap} />
          </mesh>
        ) : null}
      </group>
      {talk ? (
        <Html center position={[0, 1.35, 0]} zIndexRange={[8, 0]} style={{ pointerEvents: "none" }}>
          <p className={bubble.warn ? "speech speech-warn" : "speech"}>{bubble.text}</p>
        </Html>
      ) : null}
    </group>
  );
}

function Camp({
  sensorRef,
  onLost,
}: {
  sensorRef: RefObject<SensorNow>;
  onLost: () => void;
}) {
  const slots = useRef<Slot[]>(
    CREW.map((spec) => ({
      x: spec.x,
      z: spec.z,
      vx: 0,
      vz: 0,
      squish: 1,
      homeX: spec.x,
      homeZ: spec.z,
    })),
  );
  const held = useRef(-1);
  const plane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), []);
  const hit = useMemo(() => new THREE.Vector3(), []);
  const ndc = useMemo(() => new THREE.Vector2(), []);
  const [bubble, setBubble] = useState<Bubble | null>(null);
  const lastLog = useRef(0);
  const { camera, gl, raycaster } = useThree();

  useEffect(() => {
    const el = gl.domElement;
    const move = (event: PointerEvent) => {
      if (held.current < 0) return;
      const rect = el.getBoundingClientRect();
      ndc.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      ndc.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(ndc, camera);
      if (!raycaster.ray.intersectPlane(plane, hit)) return;
      const slot = slots.current[held.current];
      if (!slot) return;
      slot.x = THREE.MathUtils.clamp(hit.x, -3.1, 3.3);
      slot.z = THREE.MathUtils.clamp(hit.z, -1.3, 2.5);
      slot.vx = 0;
      slot.vz = 0;
    };
    const up = () => {
      if (held.current < 0) return;
      const slot = slots.current[held.current];
      if (slot) slot.squish = 0.7;
      held.current = -1;
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }, [camera, gl, hit, ndc, plane, raycaster]);

  useFrame(() => {
    const log = useLeak.getState().logs.at(-1);
    if (!log || log.id === lastLog.current) return;
    lastLog.current = log.id;
    const text = log.text.replace(/^\[[\d:]+\]\s*/, "").slice(0, 46);
    setBubble({ crew: log.id % CREW.length, text, warn: WARN.test(log.text) });
  });

  return (
    <>
      <ContextGuard onLost={onLost} />
      <Sky sensorRef={sensorRef} />
      <Flakes count={80} color="#fffaf6" spread={12} mode="star" />
      <Flakes count={140} color="#ffffff" spread={12} mode="snow" />
      <Barrels />
      {CREW.map((spec, index) => (
        <Crew
          key={spec.name}
          index={index}
          slots={slots}
          held={held}
          bubble={bubble}
          onPress={() => {
            unlockLeakAudio();
            squelch();
            const line = pokeLine();
            setBubble({ ...line, crew: index });
          }}
        />
      ))}
    </>
  );
}

export function OutpostScene({
  sensorRef,
  onLost,
}: {
  sensorRef: RefObject<SensorNow>;
  onLost: () => void;
}) {
  return (
    <Canvas
      dpr={[1, 1.5]}
      camera={{ position: [0.35, 4.35, 9.2], fov: 36, near: 0.1, far: 60 }}
      gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
      onPointerMissed={() => undefined}
    >
      <Camp sensorRef={sensorRef} onLost={onLost} />
    </Canvas>
  );
}
