import { ContactShadows, RoundedBox, Sparkles } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'

type MotionProps = {
  reducedMotion: boolean
}

type SceneProps = MotionProps & {
  lite: boolean
}

const COLORS = {
  cream: '#fff7df',
  navy: '#102b4e',
  navyDeep: '#071a33',
  yellow: '#f4c64e',
  yellowLight: '#ffe18b',
} as const

function usePrefersReducedMotion() {
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const updatePreference = () => setReducedMotion(query.matches)

    updatePreference()
    query.addEventListener('change', updatePreference)
    return () => query.removeEventListener('change', updatePreference)
  }, [])

  return reducedMotion
}

function ResponsiveCamera() {
  const { camera, size } = useThree()

  useLayoutEffect(() => {
    if (!(camera instanceof THREE.PerspectiveCamera) || size.height === 0) return

    const compact = size.width < 720
    camera.fov = compact ? 43 : 36

    const aspect = size.width / size.height
    const fieldOfView = THREE.MathUtils.degToRad(camera.fov / 2)
    const fitHeight = 2.55 / Math.tan(fieldOfView)
    const fitWidth = 3.55 / (Math.tan(fieldOfView) * aspect)

    camera.position.set(0, compact ? 0.08 : 0, Math.max(fitHeight, fitWidth) + 0.85)
    camera.near = 0.1
    camera.far = 60
    camera.lookAt(0, 0, 0)
    camera.updateProjectionMatrix()
  }, [camera, size.height, size.width])

  return null
}

function CloudSculpture({ reducedMotion, lite }: SceneProps) {
  const sculpture = useRef<THREE.Group>(null)
  const pointer = useRef({ x: 0, y: 0 })

  useEffect(() => {
    if (reducedMotion) return
    const move = (event: PointerEvent) => {
      pointer.current.x = (event.clientX / window.innerWidth) * 2 - 1
      pointer.current.y = -(event.clientY / window.innerHeight) * 2 + 1
    }
    window.addEventListener('pointermove', move, { passive: true })
    return () => window.removeEventListener('pointermove', move)
  }, [reducedMotion])

  const cloudShape = useMemo(() => {
    const shape = new THREE.Shape()

    shape.moveTo(-2.2, -0.92)
    shape.bezierCurveTo(-2.7, -0.94, -3.02, -0.6, -2.95, -0.18)
    shape.bezierCurveTo(-3.12, 0.3, -2.78, 0.79, -2.28, 0.84)
    shape.bezierCurveTo(-2.05, 1.24, -1.38, 1.28, -1.08, 0.91)
    shape.bezierCurveTo(-0.82, 1.48, 0.04, 1.57, 0.42, 1.01)
    shape.bezierCurveTo(0.86, 1.4, 1.57, 1.29, 1.77, 0.78)
    shape.bezierCurveTo(2.35, 1.02, 2.91, 0.67, 2.85, 0.15)
    shape.bezierCurveTo(3.11, -0.32, 2.73, -0.87, 2.19, -0.89)
    shape.bezierCurveTo(1.78, -1.22, 1.05, -1.2, 0.68, -0.82)
    shape.bezierCurveTo(0.29, -1.27, -0.56, -1.31, -1.02, -0.86)
    shape.bezierCurveTo(-1.32, -1.2, -1.91, -1.21, -2.2, -0.92)
    shape.closePath()

    return shape
  }, [])

  const shellSettings = useMemo<THREE.ExtrudeGeometryOptions>(
    () => ({
      depth: 0.38,
      bevelEnabled: true,
      bevelSegments: lite ? 3 : 8,
      bevelSize: 0.13,
      bevelThickness: 0.13,
      curveSegments: lite ? 12 : 24,
      steps: 1,
    }),
    [lite],
  )

  const insetSettings = useMemo<THREE.ExtrudeGeometryOptions>(
    () => ({
      depth: 0.17,
      bevelEnabled: true,
      bevelSegments: lite ? 3 : 8,
      bevelSize: 0.09,
      bevelThickness: 0.09,
      curveSegments: lite ? 12 : 24,
      steps: 1,
    }),
    [lite],
  )

  useFrame((state, delta) => {
    const group = sculpture.current
    if (!group) return

    const elapsed = state.clock.getElapsedTime()
    const targetX = reducedMotion ? -0.055 : -0.055 + pointer.current.y * 0.11
    const targetY = reducedMotion ? -0.11 : -0.11 + pointer.current.x * 0.22
    const targetZ = reducedMotion ? -0.025 : -0.025 + pointer.current.x * 0.025
    const targetFloat = reducedMotion ? 0 : Math.sin(elapsed * 0.68) * 0.075

    group.rotation.x = THREE.MathUtils.damp(group.rotation.x, targetX, 4.2, delta)
    group.rotation.y = THREE.MathUtils.damp(group.rotation.y, targetY, 4.2, delta)
    group.rotation.z = THREE.MathUtils.damp(group.rotation.z, targetZ, 3.2, delta)
    group.position.y = THREE.MathUtils.damp(group.position.y, targetFloat, 3, delta)
  })

  return (
    <group ref={sculpture} rotation={[-0.055, -0.11, -0.025]}>
      <mesh castShadow receiveShadow position={[0, 0, -0.22]}>
        <extrudeGeometry args={[cloudShape, shellSettings]} />
        <meshPhysicalMaterial
          color={COLORS.cream}
          roughness={0.34}
          metalness={0.02}
          clearcoat={0.65}
          clearcoatRoughness={0.31}
          sheen={0.4}
          sheenColor={COLORS.yellowLight}
        />
      </mesh>

      <mesh castShadow position={[0.01, 0.015, 0.31]} scale={[0.82, 0.76, 1]}>
        <extrudeGeometry args={[cloudShape, insetSettings]} />
        <meshPhysicalMaterial
          color={COLORS.navy}
          roughness={0.31}
          metalness={0.05}
          clearcoat={0.52}
          clearcoatRoughness={0.28}
          sheen={0.3}
          sheenColor="#34577d"
        />
      </mesh>

      <RoundedBox
        args={[1.12, 1.38, 0.22]}
        castShadow
        position={[-1.26, 0.02, 0.67]}
        radius={0.39}
        rotation={[0, 0, -0.055]}
        smoothness={lite ? 4 : 8}
      >
        <meshPhysicalMaterial
          color={COLORS.navyDeep}
          roughness={0.28}
          clearcoat={0.72}
          clearcoatRoughness={0.24}
          sheen={0.45}
          sheenColor="#3b5f88"
        />
      </RoundedBox>

      <RoundedBox
        args={[1.03, 1.47, 0.25]}
        castShadow
        position={[-0.02, -0.015, 0.72]}
        radius={0.42}
        rotation={[0, 0, 0.02]}
        smoothness={lite ? 4 : 8}
      >
        <meshPhysicalMaterial
          color={COLORS.yellow}
          roughness={0.3}
          metalness={0.015}
          clearcoat={0.78}
          clearcoatRoughness={0.22}
          sheen={0.5}
          sheenColor={COLORS.yellowLight}
        />
      </RoundedBox>

      <RoundedBox
        args={[1.22, 1.38, 0.22]}
        castShadow
        position={[1.31, 0.04, 0.67]}
        radius={0.42}
        rotation={[0, 0, 0.065]}
        smoothness={lite ? 4 : 8}
      >
        <meshPhysicalMaterial
          color={COLORS.navyDeep}
          roughness={0.28}
          clearcoat={0.72}
          clearcoatRoughness={0.24}
          sheen={0.45}
          sheenColor="#3b5f88"
        />
      </RoundedBox>

      <mesh castShadow position={[1.63, 0.69, 0.8]} scale={[1.15, 0.72, 0.36]}>
        <sphereGeometry args={[0.24, lite ? 18 : 32, lite ? 12 : 20]} />
        <meshPhysicalMaterial
          color={COLORS.navyDeep}
          roughness={0.26}
          clearcoat={0.76}
          clearcoatRoughness={0.22}
        />
      </mesh>

      <mesh castShadow position={[-1.36, -0.02, 0.82]} scale={[0.54, 0.68, 0.22]}>
        <sphereGeometry args={[0.45, lite ? 18 : 32, lite ? 12 : 20]} />
        <meshPhysicalMaterial
          color="#294b70"
          roughness={0.24}
          clearcoat={0.82}
          clearcoatRoughness={0.19}
        />
      </mesh>
    </group>
  )
}

function FloatingForms({ reducedMotion }: MotionProps) {
  const forms = useRef<THREE.Group>(null)

  useFrame((state, delta) => {
    if (!forms.current || reducedMotion) return

    const elapsed = state.clock.getElapsedTime()
    forms.current.rotation.z = THREE.MathUtils.damp(
      forms.current.rotation.z,
      Math.sin(elapsed * 0.24) * 0.035,
      2,
      delta,
    )
    forms.current.position.y = THREE.MathUtils.damp(
      forms.current.position.y,
      Math.cos(elapsed * 0.43) * 0.055,
      2,
      delta,
    )
  })

  return (
    <group ref={forms}>
      <mesh position={[-3.16, 1.28, -0.65]} rotation={[0.35, 0.26, -0.32]}>
        <torusGeometry args={[0.43, 0.14, 18, 52]} />
        <meshPhysicalMaterial
          color={COLORS.yellow}
          roughness={0.26}
          clearcoat={0.75}
          clearcoatRoughness={0.2}
        />
      </mesh>

      <mesh position={[3.18, 1.35, -0.48]} rotation={[0.44, -0.25, 0.18]} scale={[1, 1, 0.42]}>
        <sphereGeometry args={[0.48, 32, 24]} />
        <meshPhysicalMaterial
          color={COLORS.navy}
          roughness={0.28}
          clearcoat={0.68}
          clearcoatRoughness={0.24}
        />
      </mesh>

      <mesh position={[3.26, -1.18, -0.73]} rotation={[0.18, 0.34, -0.26]}>
        <torusGeometry args={[0.37, 0.12, 18, 48]} />
        <meshPhysicalMaterial
          color={COLORS.cream}
          roughness={0.3}
          clearcoat={0.6}
          clearcoatRoughness={0.28}
        />
      </mesh>

      <RoundedBox
        args={[0.88, 0.3, 0.22]}
        position={[-3.2, -1.26, -0.35]}
        radius={0.14}
        rotation={[0.15, -0.3, 0.42]}
        smoothness={6}
      >
        <meshPhysicalMaterial
          color={COLORS.navy}
          roughness={0.27}
          clearcoat={0.66}
          clearcoatRoughness={0.24}
        />
      </RoundedBox>

      <mesh position={[2.57, 2.03, -1.05]} scale={[1.2, 1, 0.42]}>
        <sphereGeometry args={[0.14, 24, 16]} />
        <meshStandardMaterial color={COLORS.yellowLight} roughness={0.35} />
      </mesh>
      <mesh position={[-2.42, 2.05, -1.2]} scale={[1.2, 1, 0.42]}>
        <sphereGeometry args={[0.1, 20, 14]} />
        <meshStandardMaterial color={COLORS.cream} roughness={0.35} />
      </mesh>
    </group>
  )
}

function Scene({ reducedMotion, lite }: SceneProps) {
  return (
    <>
      <ResponsiveCamera />

      <ambientLight intensity={0.72} />
      <hemisphereLight args={['#fff2ce', '#06172f', 1.15]} />
      <directionalLight
        castShadow={!lite}
        color="#fff7e5"
        intensity={3.1}
        position={[4.5, 5.5, 6]}
        shadow-bias={-0.0002}
        shadow-mapSize-height={512}
        shadow-mapSize-width={512}
      />
      <pointLight color={COLORS.yellow} intensity={8} position={[-4, -1.4, 3.4]} distance={10} />
      <pointLight color="#7195c6" intensity={7} position={[4.2, 1.4, 2.6]} distance={10} />

      {!lite && <FloatingForms reducedMotion={reducedMotion} />}
      <CloudSculpture reducedMotion={reducedMotion} lite={lite} />

      {!reducedMotion && !lite && (
        <Sparkles
          color={COLORS.yellowLight}
          count={34}
          opacity={0.38}
          scale={[7.5, 4.7, 3.2]}
          size={1.45}
          speed={0.22}
        />
      )}

      {!lite && (
        <ContactShadows
          blur={2.7}
          color={COLORS.navyDeep}
          far={4.2}
          frames={1}
          opacity={0.24}
          position={[0, -1.72, -0.25]}
          resolution={128}
          scale={8.5}
        />
      )}
    </>
  )
}

export default function PuffWorld() {
  const reducedMotion = usePrefersReducedMotion()
  const root = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(() => !document.hidden)
  const [softwareRenderer, setSoftwareRenderer] = useState(false)
  const client = navigator as Navigator & { connection?: { saveData?: boolean }; deviceMemory?: number }
  const constrainedHardware = (client.deviceMemory !== undefined && client.deviceMemory <= 4)
    || (navigator.hardwareConcurrency !== undefined && navigator.hardwareConcurrency <= 4)
  const [liteGpu, setLiteGpu] = useState(() => document.documentElement.classList.contains('gpu-lite') || constrainedHardware)
  const staticMode = reducedMotion
    || window.matchMedia('(pointer: coarse)').matches
    || Boolean(client.connection?.saveData)
  const lite = staticMode || constrainedHardware || liteGpu

  useEffect(() => {
    if (!constrainedHardware || document.documentElement.classList.contains('gpu-lite')) return
    document.documentElement.classList.add('gpu-lite')
  }, [constrainedHardware])

  useEffect(() => {
    const node = root.current
    if (!node) return
    const updateVisibility = () => setActive(!document.hidden)
    const observer = new IntersectionObserver(([entry]) => setActive(entry.isIntersecting && !document.hidden), { rootMargin: '160px' })
    observer.observe(node)
    document.addEventListener('visibilitychange', updateVisibility)
    return () => {
      observer.disconnect()
      document.removeEventListener('visibilitychange', updateVisibility)
    }
  }, [])

  if (softwareRenderer) {
    return <div className="world-fallback"><img src="/assets/puff-logo.webp" alt="" decoding="async" /></div>
  }

  return (
    <div
      ref={root}
      aria-hidden="true"
      style={{
        height: '100%',
        minHeight: 'clamp(25rem, 64vw, 52rem)',
        pointerEvents: 'none',
        position: 'relative',
        width: '100%',
      }}
    >
      <Canvas
        camera={{ far: 60, fov: 36, near: 0.1, position: [0, 0, 9] }}
        dpr={lite ? 0.72 : [1, 1.2]}
        frameloop={active && !reducedMotion ? 'always' : 'demand'}
        gl={{
          alpha: true,
          antialias: !lite,
          powerPreference: 'high-performance',
          stencil: false,
        }}
        resize={{ scroll: false, debounce: { scroll: 0, resize: 120 } }}
        onCreated={({ gl }) => {
          gl.setClearColor(0x000000, 0)
          gl.outputColorSpace = THREE.SRGBColorSpace
          gl.toneMapping = THREE.ACESFilmicToneMapping
          gl.toneMappingExposure = 1.08
          const context = gl.getContext()
          const debugInfo = context.getExtension('WEBGL_debug_renderer_info')
          const renderer = String(debugInfo ? context.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : context.getParameter(context.RENDERER))
          if (/swiftshader|llvmpipe|microsoft basic render/i.test(renderer)) {
            setSoftwareRenderer(true)
          } else if (/intel.*(?:hd graphics|uhd graphics|iris)/i.test(renderer)) {
            document.documentElement.classList.add('gpu-lite')
            setLiteGpu(true)
          }
        }}
        shadows={lite ? false : 'basic'}
        style={{ background: 'transparent' }}
      >
        <Scene reducedMotion={reducedMotion || !active} lite={lite} />
      </Canvas>
    </div>
  )
}
