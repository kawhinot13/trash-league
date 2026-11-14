"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, Lightformer } from "@react-three/drei";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { onReady } from "./polish";

/** Lathe profile of a classic cup: foot → stem → knop → bowl with a rolled lip. */
const profile = () =>
  (
    [
      [0, -1.12], [0.6, -1.12], [0.6, -1.0], [0.42, -0.98], [0.2, -0.86], [0.13, -0.62], [0.13, -0.42], [0.24, -0.34],
      [0.24, -0.26], [0.16, -0.2], [0.34, -0.06], [0.6, 0.1], [0.84, 0.42], [0.98, 0.88], [1.04, 1.26], [1.1, 1.34],
      [1.06, 1.4], [0.97, 1.32], [0.9, 0.9], [0.78, 0.48], [0.56, 0.18], [0.3, 0.04], [0, 0.0],
    ] as [number, number][]
  ).map(([x, y]) => new THREE.Vector2(x, y));

const easeOutBack = (t: number) => 1 + 2.2 * Math.pow(t - 1, 3) + 1.2 * Math.pow(t - 1, 2);
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

function Cup({ start }: { start: number | null }) {
  const g = useRef<THREE.Group>(null);
  const glow = useRef<THREE.PointLight>(null);
  const pointer = useRef({ x: 0, y: 0 });
  const lathe = useMemo(() => new THREE.LatheGeometry(profile(), 96), []);
  const reduce = useMemo(() => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches, []);
  useEffect(() => {
    const on = (e: PointerEvent) => {
      pointer.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.current.y = -((e.clientY / window.innerHeight) * 2 - 1);
    };
    window.addEventListener("pointermove", on, { passive: true });
    return () => window.removeEventListener("pointermove", on);
  }, []);
  useFrame((state, dt) => {
    const o = g.current;
    if (!o) return;
    const t = state.clock.elapsedTime;
    // Entrance: rise, spin into place and settle once the preloader clears.
    const p = reduce ? 1 : start === null ? 0 : Math.min(1, (t - start) / 1.8);
    const s = 1.02 * (reduce ? 1 : easeOutBack(p));
    o.scale.setScalar(Math.max(0.0001, s));
    const intro = (1 - easeOutCubic(p)) * Math.PI * 2.2;
    const k = 1 - Math.exp(-dt * 3);
    const targetY = pointer.current.x * 0.6 + Math.sin(t * 0.35) * 0.25;
    o.rotation.y += (targetY + intro - o.rotation.y) * (p < 1 ? 1 : k);
    o.rotation.x += (-pointer.current.y * 0.18 - o.rotation.x) * k;
    o.position.y = (1 - easeOutCubic(p)) * -1.4 + Math.sin(t * 0.9) * 0.05;
    if (glow.current) glow.current.intensity = 6 * easeOutCubic(p) + Math.sin(t * 1.6) * 0.6;
  });
  const gold = (
    <meshStandardMaterial color="#e2b552" metalness={1} roughness={0.16} side={THREE.DoubleSide} envMapIntensity={1.7} />
  );
  return (
    <group ref={g}>
      <mesh geometry={lathe}>{gold}</mesh>
      {/* handles */}
      {[-1, 1].map((sgn) => (
        <mesh key={sgn} position={[sgn * 1.02, 0.78, 0]} rotation={[0, 0, sgn * 0.2]}>
          <torusGeometry args={[0.34, 0.065, 20, 64, Math.PI * 1.2]} />
          {gold}
        </mesh>
      ))}
      {/* plinth: black lacquer with a gold band and engraved plates */}
      <mesh position={[0, -1.36, 0]}>
        <boxGeometry args={[1.5, 0.46, 1.5]} />
        <meshStandardMaterial color="#060807" metalness={0} roughness={0.55} envMapIntensity={0.15} />
      </mesh>
      <mesh position={[0, -1.36, 0]}>
        <boxGeometry args={[1.53, 0.07, 1.53]} />
        {gold}
      </mesh>
      {[0, 1, 2].map((i) => (
        <mesh key={i} position={[-0.42 + i * 0.42, -1.48, 0.76]}>
          <boxGeometry args={[0.3, 0.1, 0.01]} />
          <meshStandardMaterial color="#c9a24a" metalness={1} roughness={0.35} />
        </mesh>
      ))}
      <mesh position={[0, -1.64, 0]}>
        <boxGeometry args={[1.7, 0.1, 1.7]} />
        <meshStandardMaterial color="#040504" metalness={0} roughness={0.6} envMapIntensity={0.15} />
      </mesh>
      <pointLight ref={glow} position={[0, 0.9, 1.2]} color="#ffcf7a" intensity={0} distance={3.2} decay={2} />
    </group>
  );
}

export default function Trophy() {
  // Only render while the hero is on screen: saves battery and CPU everywhere else.
  const box = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [start, setStart] = useState<number | null>(null);
  const clock = useRef<{ elapsedTime: number } | null>(null);
  useEffect(() => {
    // Build the WebGL scene once the browser is idle so it never blocks the first interaction.
    const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number };
    const idle = w.requestIdleCallback ? w.requestIdleCallback(() => setMounted(true), { timeout: 900 }) : window.setTimeout(() => setMounted(true), 200);
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting));
    io.observe(box.current!);
    const off = onReady(() => setStart(clock.current ? clock.current.elapsedTime + 0.25 : 0.25));
    return () => {
      io.disconnect();
      off();
      if (w.cancelIdleCallback) w.cancelIdleCallback(idle);
      else clearTimeout(idle);
    };
  }, []);
  return (
    <div ref={box} className="h-full w-full">
      {mounted ? (
      <Canvas
        frameloop={visible ? "always" : "never"}
        dpr={[1, 1.5]}
        camera={{ position: [0, 0.05, 5.6], fov: 38 }}
        gl={{ alpha: true, antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.15 }}
        onCreated={(s) => (clock.current = s.clock)}
        aria-hidden
      >
        <ambientLight intensity={0.3} />
        <directionalLight position={[3, 5, 4]} intensity={2.4} color="#fff3d6" />
        <directionalLight position={[-4, 2, -3]} intensity={1.0} color="#ffe2b0" />
        <Cup start={start} />
        <Environment resolution={256}>
          <Lightformer form="rect" intensity={5} position={[0, 5, 2]} scale={[10, 2, 1]} />
          <Lightformer form="rect" intensity={2.5} color="#ffe9b0" position={[-5, 0.5, 2]} scale={[2, 8, 1]} />
          <Lightformer form="rect" intensity={1.8} color="#fff4dc" position={[5, -0.5, 1.5]} scale={[2, 6, 1]} />
          <Lightformer form="ring" intensity={3} position={[2, 2, 4]} scale={1.4} />
          {/* lightbox: soft warm panels all around so the polished bowl reflects gold, not empty space */}
          <Lightformer form="rect" intensity={1.6} color="#ffdca0" position={[0, 0, 7]} scale={[12, 8, 1]} />
          <Lightformer form="rect" intensity={1.1} color="#f4c76a" position={[-6, 0, -2]} rotation-y={Math.PI / 2} scale={[10, 6, 1]} />
          <Lightformer form="rect" intensity={1.1} color="#f4c76a" position={[6, 0, -2]} rotation-y={-Math.PI / 2} scale={[10, 6, 1]} />
          <Lightformer form="rect" intensity={0.8} color="#ffe7b8" position={[0, 0, -6]} scale={[12, 8, 1]} />
        </Environment>
      </Canvas>
      ) : null}
    </div>
  );
}
