'use client'

import { Canvas, useFrame } from '@react-three/fiber'
import { motion, useMotionValue, useSpring } from 'framer-motion'
import { Component, type ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'

/**
 * Interactive Three.js "motion screen" — a large glassy display running a custom
 * domain-warped iridescent shader. The field flows on its own and ripples toward
 * the cursor; the whole screen parallax-tilts. Falls back to an animated CSS
 * gradient when WebGL is unavailable or the canvas errors, so it never blanks.
 */

const VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    // Fullscreen quad in NDC — independent of camera.
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`

const FRAG = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform float uTime;
  uniform vec2  uMouse;   // -1..1, smoothed
  uniform float uAspect;

  float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
  float noise(vec2 p){
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i + vec2(0,0)), hash(i + vec2(1,0)), u.x),
               mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), u.x), u.y);
  }
  float fbm(vec2 p){
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.02; a *= 0.5; }
    return v;
  }
  // Cosine palette (Inigo Quilez) — tuned for a teal→violet→amber iridescence.
  vec3 palette(float t){
    vec3 a = vec3(0.52, 0.48, 0.54);
    vec3 b = vec3(0.46, 0.42, 0.48);
    vec3 c = vec3(1.0, 1.0, 1.0);
    vec3 d = vec3(0.00, 0.20, 0.52);
    return a + b * cos(6.28318 * (c * t + d));
  }

  void main(){
    vec2 uv = vUv;
    vec2 p = uv - 0.5;
    p.x *= uAspect;

    float t = uTime * 0.06;

    // Two-level domain warp for organic flow.
    vec2 q = vec2(fbm(p * 2.1 + t), fbm(p * 2.1 + vec2(3.1, 1.7) - t));
    vec2 r = vec2(fbm(p * 2.1 + 3.0 * q + vec2(1.7, 9.2) + t * 1.3),
                  fbm(p * 2.1 + 3.0 * q + vec2(8.3, 2.8) - t * 1.1));
    float f = fbm(p * 2.1 + 3.0 * r);

    // Cursor ripple.
    vec2 mp = uMouse * 0.5;
    mp.x *= uAspect;
    float md = length(p - mp);
    f += 0.13 * sin(md * 16.0 - uTime * 1.7) * smoothstep(0.65, 0.0, md);

    // Serious, muted dark grade — a living void, not a rainbow. Near-black base
    // drifting into a deep cool slate, with a faint cool glow under the cursor.
    vec3 base = vec3(0.020, 0.026, 0.036);
    vec3 hi = vec3(0.072, 0.104, 0.140);
    float shade = smoothstep(0.10, 0.92, f + length(q) * 0.22);
    vec3 col = mix(base, hi, shade);
    col += 0.04 * smoothstep(0.40, 0.0, md) * vec3(0.32, 0.52, 0.74);

    // Edge falloff toward black so it reads as a screen, not a panel.
    float vig = smoothstep(1.06, 0.30, length((uv - 0.5) * vec2(1.0, 1.12)));
    col *= mix(0.45, 1.0, vig);

    gl_FragColor = vec4(col, 1.0);
  }
`

function Field() {
  const ref = useRef<THREE.ShaderMaterial>(null)
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uMouse: { value: new THREE.Vector2(0, 0) },
      uAspect: { value: 1.6 },
    }),
    [],
  )
  useFrame((state, delta) => {
    const u = uniforms
    u.uTime.value = state.clock.elapsedTime
    const k = Math.min(1, delta * 3)
    u.uMouse.value.x += (state.pointer.x - u.uMouse.value.x) * k
    u.uMouse.value.y += (state.pointer.y - u.uMouse.value.y) * k
    u.uAspect.value = state.viewport.aspect || 1.6
  })
  return (
    <mesh>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial ref={ref} uniforms={uniforms} vertexShader={VERT} fragmentShader={FRAG} />
    </mesh>
  )
}

class CanvasBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}

function FallbackGradient() {
  return (
    <div
      aria-hidden
      className="absolute inset-0"
      style={{
        background:
          'radial-gradient(120% 100% at 50% 38%, #11161e 0%, #0a0d12 45%, #06080b 100%)',
      }}
    />
  )
}

/** Just the living shader surface (WebGL with CSS fallback), no frame/tilt.
 *  Reused by the interactive screen as the device's "display". */
export function ShaderCanvas() {
  const [ready, setReady] = useState(false)
  const [webgl, setWebgl] = useState(true)
  useEffect(() => {
    try {
      const c = document.createElement('canvas')
      setWebgl(!!(c.getContext('webgl2') || c.getContext('webgl')))
    } catch {
      setWebgl(false)
    }
    setReady(true)
  }, [])
  if (ready && webgl) {
    return (
      <CanvasBoundary fallback={<FallbackGradient />}>
        <Canvas
          className="absolute inset-0"
          dpr={[1, 2]}
          gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
          camera={{ position: [0, 0, 1] }}
        >
          <Field />
        </Canvas>
      </CanvasBoundary>
    )
  }
  return <FallbackGradient />
}

export function MotionScreen() {
  const [ready, setReady] = useState(false)
  const [webgl, setWebgl] = useState(true)

  useEffect(() => {
    try {
      const c = document.createElement('canvas')
      setWebgl(!!(c.getContext('webgl2') || c.getContext('webgl')))
    } catch {
      setWebgl(false)
    }
    setReady(true)
  }, [])

  // Parallax tilt toward the cursor.
  const rx = useMotionValue(0)
  const ry = useMotionValue(0)
  const srx = useSpring(rx, { stiffness: 55, damping: 18, mass: 0.6 })
  const sry = useSpring(ry, { stiffness: 55, damping: 18, mass: 0.6 })

  const onMove = (e: React.MouseEvent) => {
    const r = e.currentTarget.getBoundingClientRect()
    ry.set(((e.clientX - (r.left + r.width / 2)) / r.width) * 9)
    rx.set((-(e.clientY - (r.top + r.height / 2)) / r.height) * 9)
  }
  const reset = () => {
    rx.set(0)
    ry.set(0)
  }

  return (
    <div onMouseMove={onMove} onMouseLeave={reset} style={{ perspective: 1400 }} className="w-full">
      <motion.div
        style={{ rotateX: srx, rotateY: sry, transformStyle: 'preserve-3d' }}
        className="relative aspect-[16/10] w-full overflow-hidden rounded-[22px] ring-1 ring-white/20 shadow-[0_60px_120px_-50px_rgba(20,16,30,0.65),inset_0_1px_0_rgba(255,255,255,0.18)]"
      >
        {ready && webgl ? (
          <CanvasBoundary fallback={<FallbackGradient />}>
            <Canvas
              className="absolute inset-0"
              dpr={[1, 2]}
              gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
              camera={{ position: [0, 0, 1] }}
            >
              <Field />
            </Canvas>
          </CanvasBoundary>
        ) : (
          <FallbackGradient />
        )}

        {/* glassy overlays */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-[22px]"
          style={{
            background:
              'linear-gradient(180deg, rgba(255,255,255,0.16), rgba(255,255,255,0) 22%), radial-gradient(120% 90% at 50% 0%, transparent 60%, rgba(0,0,0,0.28) 100%)',
          }}
        />
        {/* fine scanline grain for the "screen" read */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.06] mix-blend-overlay"
          style={{
            backgroundImage:
              'repeating-linear-gradient(to bottom, #fff 0, #fff 1px, transparent 1px, transparent 3px)',
          }}
        />
      </motion.div>
    </div>
  )
}
