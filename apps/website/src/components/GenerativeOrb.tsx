import {
  motion,
  useAnimationFrame,
  useMotionValue,
  useReducedMotion,
  useSpring
} from 'motion/react'
import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent
} from 'react'

type GenerativeOrbProps = {
  onActivate: () => void
  onShatterComplete: () => void
}

const liquidFilterId = 'gentorial-liquid-warp'

const orbShards = [
  { clipPath: 'polygon(50% 50%, 50% 0%, 75% 7%)', x: 22, y: -86, rotate: 18, delay: 0 },
  { clipPath: 'polygon(50% 50%, 75% 7%, 93% 25%)', x: 66, y: -64, rotate: 38, delay: 0.018 },
  { clipPath: 'polygon(50% 50%, 93% 25%, 100% 50%)', x: 92, y: -22, rotate: 52, delay: 0.032 },
  { clipPath: 'polygon(50% 50%, 100% 50%, 93% 75%)', x: 90, y: 28, rotate: 64, delay: 0.048 },
  { clipPath: 'polygon(50% 50%, 93% 75%, 75% 93%)', x: 62, y: 72, rotate: 42, delay: 0.026 },
  { clipPath: 'polygon(50% 50%, 75% 93%, 50% 100%)', x: 20, y: 92, rotate: 22, delay: 0.056 },
  { clipPath: 'polygon(50% 50%, 50% 100%, 25% 93%)', x: -22, y: 88, rotate: -18, delay: 0.014 },
  { clipPath: 'polygon(50% 50%, 25% 93%, 7% 75%)', x: -66, y: 70, rotate: -42, delay: 0.04 },
  { clipPath: 'polygon(50% 50%, 7% 75%, 0% 50%)', x: -92, y: 24, rotate: -58, delay: 0.022 },
  { clipPath: 'polygon(50% 50%, 0% 50%, 7% 25%)', x: -88, y: -28, rotate: -66, delay: 0.052 },
  { clipPath: 'polygon(50% 50%, 7% 25%, 25% 7%)', x: -62, y: -68, rotate: -38, delay: 0.01 },
  { clipPath: 'polygon(50% 50%, 25% 7%, 50% 0%)', x: -18, y: -92, rotate: -22, delay: 0.044 }
] as const

export function GenerativeOrb({ onActivate, onShatterComplete }: GenerativeOrbProps) {
  const reducedMotion = useReducedMotion()
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  const [shattering, setShattering] = useState(false)
  const [pulseToken, setPulseToken] = useState(0)
  const active = (hovered || focused) && !shattering
  const activeRef = useRef(active)
  const completionRef = useRef(onShatterComplete)
  const speedRef = useRef(16)

  const pointerX = useMotionValue(0)
  const pointerY = useMotionValue(0)
  const followX = useSpring(pointerX, { stiffness: 140, damping: 22, mass: 0.65 })
  const followY = useSpring(pointerY, { stiffness: 140, damping: 22, mass: 0.65 })
  const primaryRotation = useMotionValue(18)
  const secondaryRotation = useMotionValue(-12)

  useEffect(() => {
    activeRef.current = active
  }, [active])

  useEffect(() => {
    completionRef.current = onShatterComplete
  }, [onShatterComplete])

  useEffect(() => {
    if (!shattering) return
    const timeout = window.setTimeout(
      () => completionRef.current(),
      reducedMotion ? 0 : 940
    )
    return () => window.clearTimeout(timeout)
  }, [reducedMotion, shattering])

  useAnimationFrame((_, frameDelta) => {
    if (reducedMotion) return

    const delta = Math.min(frameDelta / 1000, 0.05)
    const targetSpeed = activeRef.current ? 72 : 16
    const easing = 1 - Math.exp(-delta * 4.8)

    speedRef.current += (targetSpeed - speedRef.current) * easing
    primaryRotation.set(primaryRotation.get() + speedRef.current * delta)
    secondaryRotation.set(secondaryRotation.get() - speedRef.current * 0.68 * delta)
  })

  function resetPointer(): void {
    pointerX.set(0)
    pointerY.set(0)
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLButtonElement>): void {
    if (reducedMotion || event.pointerType === 'touch') return

    const rect = event.currentTarget.getBoundingClientRect()
    const normalizedX = (event.clientX - rect.left) / rect.width - 0.5
    const normalizedY = (event.clientY - rect.top) / rect.height - 0.5

    pointerX.set(normalizedX * 12)
    pointerY.set(normalizedY * 10)
  }

  function handleClick(): void {
    if (shattering) return
    setPulseToken((token) => token + 1)
    setHovered(false)
    resetPointer()
    setShattering(true)
    onActivate()
  }

  const interactionTransition = {
    duration: reducedMotion ? 0 : 0.76,
    ease: [0.22, 1, 0.36, 1] as const
  }

  return (
    <div className="orb-float-shell relative">
      <motion.button
        className="orb-button relative grid size-[min(58vw,13.5rem)] place-items-center rounded-full sm:size-[15.5rem] lg:size-[18rem]"
        type="button"
        aria-label="展开生成式界面"
        aria-controls="hero-flow"
        data-active={active ? 'true' : 'false'}
        disabled={shattering}
        animate={{ scale: shattering ? 0.985 : active ? 1.035 : 1 }}
        whileTap={{ scale: reducedMotion ? 1 : 0.97 }}
        transition={reducedMotion
          ? { duration: 0 }
          : { type: 'spring', stiffness: 190, damping: 21, mass: 0.7 }}
        onClick={handleClick}
        onFocus={(event) => {
          setFocused(event.currentTarget.matches(':focus-visible'))
        }}
        onBlur={() => setFocused(false)}
        onPointerEnter={(event) => {
          if (event.pointerType !== 'touch') setHovered(true)
        }}
        onPointerLeave={() => {
          setHovered(false)
          resetPointer()
        }}
        onPointerMove={handlePointerMove}
      >
        <motion.span
          className="orb-pointer-follow absolute inset-0"
          style={{ x: followX, y: followY }}
          aria-hidden="true"
        >
          <motion.span
            className="orb-aura-stack absolute inset-0"
            animate={{
              opacity: shattering ? 0 : 1,
              scale: shattering ? 1.28 : 1
            }}
            transition={{ duration: reducedMotion ? 0 : 0.52, ease: [0.22, 1, 0.36, 1] }}
          >
            <motion.span
              className="orb-aura-rotation absolute inset-0"
              style={{ rotate: secondaryRotation }}
            >
              <span className="orb-aura-base absolute rounded-full" />
              <motion.span
                className="orb-aura-boost absolute rounded-full"
                initial={false}
                animate={{
                  opacity: active ? 0.48 : 0,
                  scale: active ? 1 : 0.88
                }}
                transition={interactionTransition}
              />
            </motion.span>
          </motion.span>

          <motion.span
            className="orb-surface absolute overflow-hidden rounded-full"
            initial={false}
            animate={{
              opacity: shattering ? 0 : active ? 1 : 0.76,
              scale: shattering ? 0.96 : 1
            }}
            transition={shattering
              ? { duration: reducedMotion ? 0 : 0.08 }
              : interactionTransition}
          >
            <motion.span
              className="orb-liquid-primary absolute rounded-full"
              style={{ rotate: primaryRotation }}
            />
            <motion.span
              className="orb-liquid-secondary absolute rounded-full"
              style={{ rotate: secondaryRotation }}
            />
            <span className="orb-sheen absolute rounded-full" />
          </motion.span>

          <span className="orb-shatter-layer absolute" aria-hidden="true">
            {orbShards.map((shard, index) => (
              <motion.span
                key={shard.clipPath}
                className="orb-shard absolute inset-0 rounded-full"
                style={{ clipPath: shard.clipPath }}
                initial={false}
                animate={shattering
                  ? {
                      opacity: [0, 1, 1, 0],
                      x: [0, 0, shard.x * 0.16, shard.x],
                      y: [0, 0, shard.y * 0.16, shard.y],
                      rotate: [0, 0, shard.rotate * 0.12, shard.rotate],
                      scale: [1, 1, 0.97, 0.82]
                    }
                  : { opacity: 0, x: 0, y: 0, rotate: 0, scale: 1 }}
                transition={shattering
                  ? {
                      duration: reducedMotion ? 0 : 0.86,
                      delay: reducedMotion ? 0 : shard.delay,
                      times: [0, 0.04, 0.22, 1],
                      ease: [0.2, 0.72, 0.22, 1]
                    }
                  : { duration: 0 }}
              >
                <span
                  className="orb-shard-glint absolute"
                  style={{ opacity: 0.24 + (index % 3) * 0.08 }}
                />
              </motion.span>
            ))}
            <motion.span
              className="orb-shatter-flash absolute rounded-full"
              initial={false}
              animate={shattering
                ? {
                    opacity: [0, 0.9, 0.42, 0],
                    scale: [0.18, 0.18, 0.82, 1.65]
                  }
                : { opacity: 0, scale: 0.18 }}
              transition={shattering
                ? {
                    duration: reducedMotion ? 0 : 0.52,
                    times: [0, 0.05, 0.46, 1],
                    ease: [0.16, 1, 0.3, 1]
                  }
                : { duration: 0 }}
            />
          </span>

          {pulseToken > 0 ? (
            <span
              key={pulseToken}
              className="orb-click-wave absolute rounded-full"
            />
          ) : null}
        </motion.span>
      </motion.button>

      <svg
        className="orb-filter-defs"
        width="0"
        height="0"
        aria-hidden="true"
        focusable="false"
      >
        <defs>
          <filter
            id={liquidFilterId}
            x="-35%"
            y="-35%"
            width="170%"
            height="170%"
            colorInterpolationFilters="sRGB"
          >
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.014 0.021"
              numOctaves="3"
              seed="19"
              result="noise"
            >
              {!reducedMotion ? (
                <animate
                  attributeName="baseFrequency"
                  dur="9s"
                  values="0.014 0.021;0.023 0.011;0.014 0.021"
                  repeatCount="indefinite"
                />
              ) : null}
            </feTurbulence>
            <feDisplacementMap
              in="SourceGraphic"
              in2="noise"
              scale="58"
              xChannelSelector="R"
              yChannelSelector="B"
            />
          </filter>
        </defs>
      </svg>
    </div>
  )
}
