"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, Lightformer, MeshDistortMaterial } from "@react-three/drei";
import { useEffect, useRef } from "react";
import * as THREE from "three";

/** Window-wide pointer, normalised to -1..1, so the object follows the cursor
 *  anywhere on the page, not just over the canvas. Touch works too. */
function usePointer() {
  const p = useRef({ x: 0, y: 0 });
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      p.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      p.current.y = -((e.clientY / window.innerHeight) * 2 - 1);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, []);
  return p;
}

function Pebble() {
  const mesh = useRef<THREE.Mesh>(null);
  const pointer = usePointer();

  useFrame((state, delta) => {
    const m = mesh.current;
    if (!m) return;
    const { x, y } = pointer.current;
    const t = state.clock.elapsedTime;
    // Ease toward the pointer: frame-rate independent damping.
    const k = 1 - Math.exp(-delta * 3);
    m.position.x += (x * 0.6 - m.position.x) * k;
    m.position.y += (y * 0.4 + Math.sin(t * 0.8) * 0.08 - m.position.y) * k;
    m.rotation.y += (x * 0.8 + t * 0.15 - m.rotation.y) * k;
    m.rotation.x += (-y * 0.6 - m.rotation.x) * k;
  });

  return (
    <mesh ref={mesh} scale={1.05}>
      <icosahedronGeometry args={[1, 32]} />
      <MeshDistortMaterial
        color="#e2401c"
        roughness={0.12}
        metalness={0.1}
        clearcoat={1}
        clearcoatRoughness={0.08}
        distort={0.32}
        speed={1.4}
      />
    </mesh>
  );
}

export default function HeroObject() {
  return (
    <Canvas
      dpr={[1, 1.75]}
      camera={{ position: [0, 0, 4.2], fov: 40 }}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      aria-hidden
    >
      <ambientLight intensity={0.35} />
      <directionalLight position={[3, 4, 5]} intensity={1.6} />
      <Pebble />
      {/* Studio reflections built locally: no HDRI download. */}
      <Environment resolution={256}>
        <Lightformer form="rect" intensity={3} position={[0, 4, 2]} scale={[8, 2, 1]} />
        <Lightformer form="rect" intensity={1.5} position={[-5, 0, 1]} scale={[2, 6, 1]} />
        <Lightformer form="ring" intensity={2} color="#fff3e6" position={[4, 1, 3]} scale={2} />
      </Environment>
    </Canvas>
  );
}
