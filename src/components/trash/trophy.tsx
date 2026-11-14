"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, Lightformer } from "@react-three/drei";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

/** Lathe profile of a classic cup: base → stem → bowl. */
const profile = () => {
  const p: [number, number][] = [
    [0, -1.6],
    [0.95, -1.6],
    [0.95, -1.42],
    [0.78, -1.42],
    [0.78, -1.25],
    [0.62, -1.25],
    [0.62, -1.12],
    [0.22, -1.0],
    [0.16, -0.7],
    [0.16, -0.3],
    [0.3, -0.18],
    [0.55, -0.05],
    [0.8, 0.25],
    [0.95, 0.7],
    [1.02, 1.15],
    [1.05, 1.4],
    [0.98, 1.42],
    [0.92, 1.2],
    [0.85, 0.75],
    [0.68, 0.35],
    [0.4, 0.1],
    [0, 0.05],
  ];
  return p.map(([x, y]) => new THREE.Vector2(x, y));
};

function Cup() {
  const g = useRef<THREE.Group>(null);
  const pointer = useRef({ x: 0, y: 0 });
  const lathe = useMemo(() => new THREE.LatheGeometry(profile(), 96), []);
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
    const k = 1 - Math.exp(-dt * 3);
    const t = state.clock.elapsedTime;
    o.rotation.y += (pointer.current.x * 0.7 + t * 0.25 - o.rotation.y) * k;
    o.rotation.x += (-pointer.current.y * 0.25 - o.rotation.x) * k;
    o.position.y = Math.sin(t * 0.9) * 0.06;
  });
  const gold = (
    <meshPhysicalMaterial
      color="#e9c46a"
      metalness={1}
      roughness={0.16}
      clearcoat={0.6}
      clearcoatRoughness={0.1}
    />
  );
  return (
    <group ref={g} scale={1.05}>
      <mesh geometry={lathe}>{gold}</mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 1.08, 0.7, 0]} rotation={[0, 0, s * 0.15]}>
          <torusGeometry args={[0.38, 0.07, 24, 64, Math.PI * 1.15]} />
          {gold}
        </mesh>
      ))}
      <mesh position={[0, -1.36, 0]}>
        <cylinderGeometry args={[0.86, 0.86, 0.06, 64]} />
        <meshStandardMaterial color="#0f2a20" metalness={0.3} roughness={0.5} />
      </mesh>
    </group>
  );
}

export default function Trophy() {
  // Only render while the hero is on screen: saves battery and CPU everywhere else.
  const box = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting));
    io.observe(box.current!);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={box} className="h-full w-full">
      <Canvas
        frameloop={visible ? "always" : "never"}
        dpr={[1, 1.75]}
        camera={{ position: [0, 0.1, 5.4], fov: 38 }}
        gl={{ alpha: true, antialias: true }}
        aria-hidden
      >
        <ambientLight intensity={0.25} />
        <directionalLight position={[3, 5, 4]} intensity={2.2} />
        <Cup />
        <Environment resolution={256}>
          <Lightformer
            form="rect"
            intensity={4}
            position={[0, 5, 2]}
            scale={[10, 2, 1]}
          />
          <Lightformer
            form="rect"
            intensity={2}
            color="#ffe9b0"
            position={[-5, 0, 2]}
            scale={[2, 8, 1]}
          />
          <Lightformer
            form="rect"
            intensity={1.5}
            color="#fff4dc"
            position={[5, -1, 1]}
            scale={[2, 6, 1]}
          />
          <Lightformer
            form="ring"
            intensity={3}
            position={[2, 2, 4]}
            scale={1.5}
          />
        </Environment>
      </Canvas>
    </div>
  );
}
