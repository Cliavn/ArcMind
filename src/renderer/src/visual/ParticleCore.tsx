import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import type { CoreMode, VisualSignal } from '../../../shared'
import { resolveVisualPerformanceProfile } from './performance'

interface ParticleCoreProps {
  mode: CoreMode
  signal: VisualSignal
  sidebarOpen?: boolean
}

const FALLBACK_SIGNAL: VisualSignal = {
  audio: {
    level: 0,
    low: 0,
    mid: 0,
    high: 0,
    rhythm: 0
  },
  tokenPulse: 0,
  errorPulse: 0,
  thinkingLevel: 0,
  speakingLevel: 0
}

const MODE_COLORS: Record<CoreMode, THREE.Color> = {
  idle: new THREE.Color('#7fd8ff'),
  listening: new THREE.Color('#00f5d4'),
  transcribing: new THREE.Color('#8bd3ff'),
  thinking: new THREE.Color('#f4d28a'),
  speaking: new THREE.Color('#a6ffcb'),
  muted: new THREE.Color('#6f7f89'),
  error: new THREE.Color('#ff5367')
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

export function ParticleCore({ mode, signal, sidebarOpen = false }: ParticleCoreProps): JSX.Element {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const modeRef = useRef(mode)
  const signalRef = useRef(signal)
  const sidebarOpenRef = useRef(sidebarOpen)
  const lastTokenPulseRef = useRef(signal.tokenPulse)
  const lastErrorPulseRef = useRef(signal.errorPulse)
  const tokenBurstRef = useRef(0)
  const errorBurstRef = useRef(0)

  useEffect(() => {
    modeRef.current = mode
  }, [mode])

  useEffect(() => {
    sidebarOpenRef.current = sidebarOpen
  }, [sidebarOpen])

  useEffect(() => {
    if (signal.tokenPulse > lastTokenPulseRef.current) {
      tokenBurstRef.current = Math.min(1.8, tokenBurstRef.current + 0.82)
    }
    if (signal.errorPulse > lastErrorPulseRef.current) {
      errorBurstRef.current = Math.min(1.6, errorBurstRef.current + 1)
    }
    lastTokenPulseRef.current = signal.tokenPulse
    lastErrorPulseRef.current = signal.errorPulse
    signalRef.current = signal
  }, [signal])

  useEffect(() => {
    const host = hostRef.current
    if (!host) {
      return
    }

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance'
    })
    const profile = resolveVisualPerformanceProfile(window.devicePixelRatio, navigator.hardwareConcurrency ?? 0)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, profile.maxPixelRatio))
    renderer.setSize(host.clientWidth, host.clientHeight)
    renderer.outputColorSpace = THREE.SRGBColorSpace
    host.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(48, host.clientWidth / host.clientHeight, 0.1, 100)
    camera.position.set(0, 0, 9.6)

    const group = new THREE.Group()
    group.scale.setScalar(1.18)
    scene.add(group)

    const particleCount = profile.particleCount
    const positions = new Float32Array(particleCount * 3)
    const base = new Float32Array(particleCount * 3)
    const colorValues = new Float32Array(particleCount * 3)
    const color = new THREE.Color()

    for (let i = 0; i < particleCount; i += 1) {
      const lane = i % 7
      const angle = i * 0.031 + lane * 0.42
      const radius = 1.45 + lane * 0.23 + Math.sin(i * 0.017) * 0.08
      const orbitTilt = Math.sin(i * 0.011) * 0.46
      const x = Math.cos(angle) * radius
      const y = Math.sin(angle) * radius * (0.54 + lane * 0.035)
      const z = orbitTilt + Math.cos(angle * 1.7) * 0.28

      base[i * 3] = x
      base[i * 3 + 1] = y
      base[i * 3 + 2] = z
      positions[i * 3] = x
      positions[i * 3 + 1] = y
      positions[i * 3 + 2] = z

      color.setHSL(0.52 + lane * 0.015, 0.86, 0.52 + (i % 5) * 0.035)
      colorValues[i * 3] = color.r
      colorValues[i * 3 + 1] = color.g
      colorValues[i * 3 + 2] = color.b
    }

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.setAttribute('color', new THREE.BufferAttribute(colorValues, 3))

    const material = new THREE.PointsMaterial({
      size: 0.026,
      sizeAttenuation: true,
      vertexColors: true,
      transparent: true,
      opacity: 0.92,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    })

    const particles = new THREE.Points(geometry, material)
    group.add(particles)

    const ringGeometry = new THREE.TorusGeometry(2.25, 0.012, 16, 180)
    const ringMaterial = new THREE.MeshBasicMaterial({
      color: '#7fd8ff',
      transparent: true,
      opacity: 0.45,
      blending: THREE.AdditiveBlending
    })
    const rings = Array.from({ length: profile.ringCount }, (_, index) => {
      const ring = new THREE.Mesh(ringGeometry, ringMaterial.clone())
      ring.rotation.x = Math.PI / 2 + index * 0.42
      ring.rotation.y = index * 0.64
      ring.scale.setScalar(1 + index * 0.22)
      group.add(ring)
      return ring
    })

    const coreGeometry = new THREE.IcosahedronGeometry(0.42, 3)
    const coreMaterial = new THREE.MeshBasicMaterial({
      color: '#e8fbff',
      wireframe: true,
      transparent: true,
      opacity: 0.42,
      blending: THREE.AdditiveBlending
    })
    const core = new THREE.Mesh(coreGeometry, coreMaterial)
    group.add(core)

    const haloGeometry = new THREE.SphereGeometry(0.62, 32, 16)
    const haloMaterial = new THREE.MeshBasicMaterial({
      color: '#7fd8ff',
      transparent: true,
      opacity: 0.1,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    })
    const coreHalo = new THREE.Mesh(haloGeometry, haloMaterial)
    group.add(coreHalo)

    const clock = new THREE.Clock()
    let animationFrame = 0
    let idleTimer = 0
    let visible = document.visibilityState === 'visible'
    let sidebarInfluence = sidebarOpenRef.current ? 1 : 0
    const interaction = {
      dragging: false,
      pointerId: -1,
      lastX: 0,
      lastY: 0,
      rotationX: 0,
      rotationY: 0,
      targetRotationX: 0,
      targetRotationY: 0,
      zoom: 9.6,
      targetZoom: 9.6
    }

    const resize = (): void => {
      const width = host.clientWidth
      const height = host.clientHeight
      camera.aspect = width / height
      camera.updateProjectionMatrix()
      renderer.setSize(width, height)
    }

    const handlePointerDown = (event: PointerEvent): void => {
      if (event.button !== 0) {
        return
      }
      interaction.dragging = true
      interaction.pointerId = event.pointerId
      interaction.lastX = event.clientX
      interaction.lastY = event.clientY
      host.classList.add('is-dragging')
      host.setPointerCapture(event.pointerId)
    }

    const handlePointerMove = (event: PointerEvent): void => {
      if (!interaction.dragging || event.pointerId !== interaction.pointerId) {
        return
      }
      const deltaX = event.clientX - interaction.lastX
      const deltaY = event.clientY - interaction.lastY
      interaction.lastX = event.clientX
      interaction.lastY = event.clientY
      interaction.targetRotationY += deltaX * 0.006
      interaction.targetRotationX = clamp(interaction.targetRotationX + deltaY * 0.004, -0.62, 0.62)
    }

    const stopDragging = (event?: PointerEvent): void => {
      if (event && interaction.pointerId !== event.pointerId) {
        return
      }
      if (interaction.dragging && interaction.pointerId >= 0 && host.hasPointerCapture(interaction.pointerId)) {
        host.releasePointerCapture(interaction.pointerId)
      }
      interaction.dragging = false
      interaction.pointerId = -1
      host.classList.remove('is-dragging')
    }

    const handleLostPointerCapture = (): void => {
      stopDragging()
    }

    const handleWheel = (event: WheelEvent): void => {
      event.preventDefault()
      interaction.targetZoom = clamp(interaction.targetZoom + event.deltaY * 0.006, 7.2, 13.2)
    }

    const scheduleNextFrame = (): void => {
      if (visible) {
        animationFrame = requestAnimationFrame(animate)
        return
      }

      idleTimer = window.setTimeout(animate, profile.idleFrameMs)
    }

    const animate = (): void => {
      const elapsed = clock.getElapsedTime()
      const currentMode = modeRef.current
      const currentSignal = signalRef.current ?? FALLBACK_SIGNAL
      const audio = currentSignal.audio
      tokenBurstRef.current *= 0.9
      errorBurstRef.current *= 0.88
      const tokenBurst = tokenBurstRef.current
      const errorBurst = errorBurstRef.current
      sidebarInfluence += ((sidebarOpenRef.current ? 1 : 0) - sidebarInfluence) * 0.08
      interaction.rotationX += (interaction.targetRotationX - interaction.rotationX) * 0.12
      interaction.rotationY += (interaction.targetRotationY - interaction.rotationY) * 0.12
      interaction.zoom += (interaction.targetZoom - interaction.zoom) * 0.12
      const syntheticBreath = (Math.sin(elapsed * 1.28) + 1) * 0.5
      const startupEnergy = Math.max(0, 1 - elapsed / 2.8)
      const breath = Math.max(audio.level, syntheticBreath * 0.18)
      const audioDrive = audio.low * 0.5 + audio.mid * 0.28 + audio.high * 0.22
      const thinkingPull = currentSignal.thinkingLevel * (0.08 + Math.sin(elapsed * 1.8) * 0.018)
      const orbitAcceleration = audio.mid * 0.11 + audio.rhythm * 0.18 + currentSignal.thinkingLevel * 0.09 + tokenBurst * 0.05
      const modeColor = MODE_COLORS[currentMode]
      const modeEnergy =
        currentMode === 'listening'
          ? 1.24
          : currentMode === 'transcribing'
            ? 1.1
          : currentMode === 'thinking'
            ? 1.14
            : currentMode === 'speaking'
              ? 1.32
              : currentMode === 'error'
                ? 1.08
                : currentMode === 'muted'
                  ? 0.76
                  : 1
      const energy = modeEnergy + tokenBurst * 0.34 + errorBurst * 0.18 + startupEnergy * 0.18

      for (let i = 0; i < particleCount; i += 1) {
        const ix = i * 3
        const lane = i % 7
        const tokenRipple = Math.sin(elapsed * 8.2 + i * 0.047) * tokenBurst * (0.045 + lane * 0.004)
        const speakingRipple = Math.sin(elapsed * (2.1 + audio.high * 3.2) + i * 0.021) * currentSignal.speakingLevel * (0.025 + audio.high * 0.07)
        const pulse = (1 - thinkingPull) + breath * (0.1 + lane * 0.018) * energy + tokenRipple + audio.low * 0.06
        const wave =
          Math.sin(elapsed * (0.75 + lane * 0.04 + audio.high * 0.42) + i * 0.019) * (0.04 + breath * 0.18 + audio.rhythm * 0.1) + speakingRipple
        const twist = elapsed * (0.12 + lane * 0.01 + orbitAcceleration)
        const cos = Math.cos(twist)
        const sin = Math.sin(twist)
        const x = base[ix] * pulse
        const y = base[ix + 1] * pulse

        positions[ix] = x * cos - y * sin
        positions[ix + 1] = x * sin + y * cos + wave
        positions[ix + 2] = base[ix + 2] * (1 + breath * 0.38 + audio.high * 0.12) + Math.cos(elapsed + i * 0.013) * (breath + audioDrive) * 0.2

        const targetRed = Math.min(1, modeColor.r + errorBurst * 0.55 + startupEnergy * 0.12)
        const targetGreen = Math.min(1, modeColor.g + tokenBurst * 0.18 + audio.mid * 0.08)
        const targetBlue = Math.min(1, modeColor.b + tokenBurst * 0.16 + audio.high * 0.08)
        colorValues[ix] += (targetRed - colorValues[ix]) * 0.014
        colorValues[ix + 1] += (targetGreen - colorValues[ix + 1]) * 0.014
        colorValues[ix + 2] += (targetBlue - colorValues[ix + 2]) * 0.014
      }

      geometry.attributes.position.needsUpdate = true
      geometry.attributes.color.needsUpdate = true

      group.position.x = sidebarInfluence * 0.74
      group.scale.setScalar(1.18 + sidebarInfluence * 0.04)
      group.rotation.y = elapsed * (0.075 + orbitAcceleration) + interaction.rotationY + sidebarInfluence * 0.42
      group.rotation.x = Math.sin(elapsed * 0.22) * 0.08 + interaction.rotationX - sidebarInfluence * 0.08
      camera.position.x = sidebarInfluence * 0.62
      camera.position.z = interaction.zoom
      camera.lookAt(sidebarInfluence * 0.28, 0, 0)
      core.rotation.x = elapsed * 0.44
      core.rotation.y = elapsed * 0.38
      core.scale.setScalar(1 + breath * 0.42 + audio.low * 0.22 + tokenBurst * 0.08 + startupEnergy * 0.18)
      coreMaterial.opacity = 0.34 + breath * 0.24 + tokenBurst * 0.14 + errorBurst * 0.18
      coreMaterial.color.lerp(errorBurst > 0.12 ? MODE_COLORS.error : modeColor, 0.045)
      coreHalo.scale.setScalar(1 + audio.low * 0.5 + audio.rhythm * 0.28 + tokenBurst * 0.18 + startupEnergy * 0.34)
      haloMaterial.color.lerp(errorBurst > 0.12 ? MODE_COLORS.error : modeColor, 0.04)
      haloMaterial.opacity = profile.advancedGlow ? 0.07 + breath * 0.14 + audioDrive * 0.16 + tokenBurst * 0.08 : 0.05 + breath * 0.08

      rings.forEach((ring, index) => {
        const waveform = Math.sin(elapsed * (2.8 + audio.mid * 3) + index * 1.8) * (audio.rhythm * 0.06 + currentSignal.speakingLevel * audio.high * 0.05)
        ring.rotation.z = elapsed * (0.16 + index * 0.055 + audio.mid * 0.08)
        ring.scale.setScalar(1 + index * 0.22 + breath * (0.08 + index * 0.025) + waveform + tokenBurst * 0.045)
        const ringMat = ring.material as THREE.MeshBasicMaterial
        ringMat.color.lerp(errorBurst > 0.12 ? MODE_COLORS.error : modeColor, 0.025)
        ringMat.opacity = profile.advancedGlow ? 0.22 + breath * 0.38 + tokenBurst * 0.1 : 0.18 + breath * 0.16
      })

      material.size = 0.022 + breath * 0.026 + audio.low * 0.008 + tokenBurst * 0.006 + startupEnergy * 0.004
      material.opacity = currentMode === 'error' ? 0.82 + errorBurst * 0.12 : profile.advancedGlow ? 0.9 : 0.76
      renderer.render(scene, camera)
      scheduleNextFrame()
    }

    const handleVisibilityChange = (): void => {
      visible = document.visibilityState === 'visible'
      if (visible) {
        window.clearTimeout(idleTimer)
      }
    }

    window.addEventListener('resize', resize)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    host.addEventListener('pointerdown', handlePointerDown)
    host.addEventListener('pointermove', handlePointerMove)
    host.addEventListener('pointerup', stopDragging)
    host.addEventListener('pointercancel', stopDragging)
    host.addEventListener('lostpointercapture', handleLostPointerCapture)
    host.addEventListener('wheel', handleWheel, { passive: false })
    resize()
    animate()

    return () => {
      cancelAnimationFrame(animationFrame)
      window.clearTimeout(idleTimer)
      window.removeEventListener('resize', resize)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      host.removeEventListener('pointerdown', handlePointerDown)
      host.removeEventListener('pointermove', handlePointerMove)
      host.removeEventListener('pointerup', stopDragging)
      host.removeEventListener('pointercancel', stopDragging)
      host.removeEventListener('lostpointercapture', handleLostPointerCapture)
      host.removeEventListener('wheel', handleWheel)
      geometry.dispose()
      material.dispose()
      ringGeometry.dispose()
      rings.forEach((ring) => {
        ;(ring.material as THREE.Material).dispose()
      })
      coreGeometry.dispose()
      coreMaterial.dispose()
      haloGeometry.dispose()
      haloMaterial.dispose()
      renderer.dispose()
      renderer.domElement.remove()
    }
  }, [])

  return <div ref={hostRef} className="particle-core" aria-label="弦核 3D 视觉" />
}
