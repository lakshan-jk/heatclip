"use client";

import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Sparkles } from "@react-three/drei";
import { EffectComposer, Bloom, Vignette } from "@react-three/postprocessing";
import * as THREE from "three";

const NX = 30;
const NZ = 14;
const GAP = 0.44;
const BAR = 0.3;
const COUNT = NX * NZ;

function HeatBars() {
  const mesh = useRef<THREE.InstancedMesh>(null!);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const col = useMemo(() => new THREE.Color(), []);
  const cold = useMemo(() => new THREE.Color("#5b0f1e"), []);
  const warm = useMemo(() => new THREE.Color("#ff4d2e"), []);
  const hot = useMemo(() => new THREE.Color("#ffd27a"), []);

  useFrame((state) => {
    const m = mesh.current;
    if (!m) return;
    const t = state.clock.elapsedTime;
    // two roaming "most-replayed" hotspots
    const h1x = Math.sin(t * 0.5) * 4;
    const h1z = Math.cos(t * 0.4) * 2;
    const h2x = Math.cos(t * 0.33) * 3 - 2;
    const h2z = Math.sin(t * 0.28) * 2.2;

    let i = 0;
    for (let ix = 0; ix < NX; ix++) {
      for (let iz = 0; iz < NZ; iz++) {
        const x = (ix - NX / 2) * GAP;
        const z = (iz - NZ / 2) * GAP;
        const wave =
          Math.sin(x * 0.7 + t * 1.6) * 0.18 + Math.cos(z * 0.9 - t * 1.1) * 0.14;
        const d1 = (x - h1x) ** 2 + (z - h1z) ** 2;
        const d2 = (x - h2x) ** 2 + (z - h2z) ** 2;
        const spot = Math.exp(-d1 * 0.22) * 1.9 + Math.exp(-d2 * 0.3) * 1.2;
        const h = Math.max(0.08, 0.16 + Math.max(0, wave) + spot);

        dummy.position.set(x, h / 2, z);
        dummy.scale.set(BAR, h, BAR);
        dummy.updateMatrix();
        m.setMatrixAt(i, dummy.matrix);

        const tn = Math.min(1, h / 2.4);
        col.copy(cold).lerp(warm, Math.min(1, tn * 1.5));
        if (tn > 0.65) col.lerp(hot, (tn - 0.65) / 0.35);
        m.setColorAt(i, col);
        i++;
      }
    }
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    m.rotation.y = 0.35 + Math.sin(t * 0.12) * 0.28;
  });

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, COUNT]}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial
        toneMapped={false}
        emissive={"#ff3b1e"}
        emissiveIntensity={0.4}
        roughness={0.35}
        metalness={0.15}
      />
    </instancedMesh>
  );
}

export default function Hero3DScene() {
  return (
    <div className="relative aspect-[4/3] w-full overflow-hidden rounded-3xl border border-white/10 shadow-glow">
      <Canvas
        dpr={[1, 1.8]}
        gl={{ antialias: true, powerPreference: "high-performance" }}
        camera={{ position: [0, 4.2, 9], fov: 42 }}
      >
        <color attach="background" args={["#0a0a12"]} />
        <fog attach="fog" args={["#0a0a12", 9, 20]} />
        <ambientLight intensity={0.5} />
        <directionalLight position={[4, 8, 5]} intensity={1.1} color="#ffd9c0" />
        <pointLight position={[0, 3, 2]} intensity={30} color="#ff6a3d" distance={18} />
        <HeatBars />
        <Sparkles
          count={70}
          scale={[12, 5, 8]}
          size={2.5}
          speed={0.4}
          opacity={0.6}
          color="#ffb27a"
        />
        <EffectComposer>
          <Bloom
            intensity={1.25}
            luminanceThreshold={0.32}
            luminanceSmoothing={0.9}
            mipmapBlur
          />
          <Vignette eskil={false} offset={0.25} darkness={0.75} />
        </EffectComposer>
      </Canvas>
      <div className="pointer-events-none absolute left-4 top-4 flex items-center gap-2 rounded-full bg-black/40 px-3 py-1 text-[11px] font-semibold text-white/90 backdrop-blur">
        <span className="h-2 w-2 animate-pulse rounded-full bg-amber-400" />
        LIVE HEATMAP
      </div>
    </div>
  );
}
