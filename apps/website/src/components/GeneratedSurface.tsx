import { motion, useReducedMotion } from 'motion/react'

export function GeneratedSurface() {
  const reduceMotion = useReducedMotion()
  const duration = reduceMotion ? 0 : 0.72

  const panelMotion = {
    initial: { opacity: 0, y: reduceMotion ? 0 : 34, scale: reduceMotion ? 1 : 0.985 },
    animate: { opacity: 1, y: 0, scale: 1 }
  }

  return (
    <motion.section
      id="generated-ui"
      className="min-h-svh scroll-mt-0 border-t border-black/10 bg-white px-5 py-16 sm:px-8 sm:py-24 lg:px-12"
      aria-label="生成式界面区域"
      initial={{ opacity: 0, clipPath: 'inset(0 0 100% 0)' }}
      animate={{ opacity: 1, clipPath: 'inset(0 0 0% 0)' }}
      exit={{ opacity: 0, clipPath: 'inset(0 0 100% 0)' }}
      transition={{ duration, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="mx-auto grid max-w-[1440px] gap-4 lg:grid-cols-12">
        <motion.div
          className="min-h-48 border border-black/15 lg:col-span-8 lg:min-h-72"
          {...panelMotion}
          transition={{ duration, delay: reduceMotion ? 0 : 0.08, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="h-12 border-b border-black/10" />
          <div className="space-y-4 p-6 sm:p-8">
            <div className="h-3 w-2/5 bg-black" />
            <div className="h-px w-full bg-black/15" />
            <div className="h-2 w-4/5 bg-black/12" />
            <div className="h-2 w-3/5 bg-black/12" />
          </div>
        </motion.div>
        <motion.div
          className="min-h-48 border border-black/15 lg:col-span-4 lg:min-h-72"
          {...panelMotion}
          transition={{ duration, delay: reduceMotion ? 0 : 0.18, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="grid h-full grid-cols-2 gap-px bg-black/10">
            <div className="bg-white" />
            <div className="bg-white" />
            <div className="bg-white" />
            <div className="bg-black" />
          </div>
        </motion.div>
        <motion.div
          className="min-h-64 border border-black/15 lg:col-span-4"
          {...panelMotion}
          transition={{ duration, delay: reduceMotion ? 0 : 0.28, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="flex h-full flex-col justify-between p-6 sm:p-8">
            <div className="size-10 rounded-full border border-black/20" />
            <div className="space-y-3">
              <div className="h-2 w-full bg-black/12" />
              <div className="h-2 w-2/3 bg-black/12" />
            </div>
          </div>
        </motion.div>
        <motion.div
          className="min-h-64 border border-black/15 lg:col-span-8"
          {...panelMotion}
          transition={{ duration, delay: reduceMotion ? 0 : 0.38, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="grid h-full place-items-center p-8">
            <div className="relative size-28 rounded-full border border-black/20 sm:size-36">
              <div className="absolute inset-5 rounded-full border border-black/15" />
              <div className="absolute inset-1/2 size-px bg-black" />
            </div>
          </div>
        </motion.div>
      </div>
    </motion.section>
  )
}
