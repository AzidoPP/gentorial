import { ArrowLeft, ArrowRight, BookOpen, Check } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useState, type FormEvent } from 'react'

export type JourneyView = 'actions' | 'preferences' | 'generating' | 'complete'

export type TutorialPreferences = {
  depth: string
  narrative: string
  outcome: string
}

type HeroJourneyProps = {
  docsUrl: string
  view: JourneyView
  onBack: () => void
  onContinue: (preferences: TutorialPreferences) => void
  onExplore: () => void
}

const preferenceGroups = [
  {
    key: 'depth',
    label: 'Depth',
    options: ['Focused', 'Guided', 'Deep']
  },
  {
    key: 'narrative',
    label: 'Narrative',
    options: ['Direct', 'Conversational', 'Story-led']
  },
  {
    key: 'outcome',
    label: 'Outcome',
    options: ['Understand', 'Build', 'Review']
  }
] as const

const emptyPreferences: TutorialPreferences = {
  depth: '',
  narrative: '',
  outcome: ''
}

export function HeroJourney({
  docsUrl,
  view,
  onBack,
  onContinue,
  onExplore
}: HeroJourneyProps) {
  const reduceMotion = useReducedMotion()
  const [preferences, setPreferences] = useState<TutorialPreferences>(emptyPreferences)
  const complete = Object.values(preferences).every(Boolean)
  const duration = reduceMotion ? 0 : 0.56

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault()
    if (complete) onContinue(preferences)
  }

  return (
    <div id="hero-flow" className="flex w-full items-center justify-center">
      <AnimatePresence mode="wait" initial={false}>
        {view === 'actions' ? (
          <motion.div
            key="actions"
            className="flex min-h-40 flex-col items-center justify-center gap-3 sm:flex-row"
            initial={{ opacity: 0, y: 22, filter: 'blur(10px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: -12, filter: 'blur(8px)' }}
            transition={{ duration, ease: [0.16, 1, 0.3, 1] }}
          >
            <button
              className="group inline-flex h-14 min-w-44 items-center justify-center gap-3 bg-black px-7 text-sm font-medium text-white transition-transform duration-300 hover:-translate-y-0.5 focus-visible:outline-offset-4"
              type="button"
              onClick={onExplore}
            >
              Explore
              <ArrowRight
                className="size-4 transition-transform duration-300 group-hover:translate-x-1"
                strokeWidth={1.8}
                aria-hidden="true"
              />
            </button>
            <a
              className="group inline-flex h-14 min-w-44 items-center justify-center gap-3 border border-black/18 bg-white px-7 text-sm font-medium text-black transition-all duration-300 hover:-translate-y-0.5 hover:border-black/50 focus-visible:outline-offset-4"
              href={docsUrl}
              target="_blank"
              rel="noreferrer"
            >
              Docs
              <BookOpen
                className="size-4 transition-transform duration-300 group-hover:-rotate-3"
                strokeWidth={1.7}
                aria-hidden="true"
              />
            </a>
          </motion.div>
        ) : null}

        {view === 'preferences' ? (
          <motion.form
            key="preferences"
            className="w-full max-w-4xl border border-black/12 bg-white/92 p-4 text-left shadow-[0_24px_80px_rgb(0_0_0_/_0.06)] backdrop-blur-xl sm:p-6"
            onSubmit={handleSubmit}
            initial={{ opacity: 0, y: 26, scale: 0.985, filter: 'blur(10px)' }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: -16, scale: 0.99, filter: 'blur(8px)' }}
            transition={{ duration, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="mb-5 flex items-center justify-between">
              <button
                className="inline-flex items-center gap-2 text-xs font-medium text-black/55 transition-colors hover:text-black"
                type="button"
                onClick={onBack}
              >
                <ArrowLeft className="size-3.5" strokeWidth={1.8} aria-hidden="true" />
                Back
              </button>
              <span className="text-xs font-medium uppercase tracking-[0.16em] text-black/42">
                Preferences
              </span>
            </div>

            <div className="grid gap-5 md:grid-cols-3">
              {preferenceGroups.map((group, groupIndex) => (
                <motion.fieldset
                  key={group.key}
                  className="min-w-0"
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: reduceMotion ? 0 : 0.46,
                    delay: reduceMotion ? 0 : 0.08 + groupIndex * 0.07,
                    ease: [0.16, 1, 0.3, 1]
                  }}
                >
                  <legend className="mb-2 text-xs font-medium text-black/55">
                    {group.label}
                  </legend>
                  <div className="grid gap-2">
                    {group.options.map((option) => {
                      const selected = preferences[group.key] === option
                      return (
                        <button
                          key={option}
                          className={`${selected
                            ? 'border-black bg-black text-white'
                            : 'border-black/12 bg-white text-black hover:border-black/40'} flex h-11 items-center justify-between border px-3 text-left text-sm transition-colors`}
                          type="button"
                          aria-pressed={selected}
                          onClick={() => {
                            setPreferences((current) => ({
                              ...current,
                              [group.key]: option
                            }))
                          }}
                        >
                          {option}
                          <Check
                            className={`${selected ? 'opacity-100' : 'opacity-0'} size-3.5 transition-opacity`}
                            strokeWidth={2}
                            aria-hidden="true"
                          />
                        </button>
                      )
                    })}
                  </div>
                </motion.fieldset>
              ))}
            </div>

            <div className="mt-6 flex justify-end">
              <button
                className="inline-flex h-12 min-w-40 items-center justify-center gap-3 bg-black px-6 text-sm font-medium text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-20"
                type="submit"
                disabled={!complete}
              >
                Continue
                <ArrowRight className="size-4" strokeWidth={1.8} aria-hidden="true" />
              </button>
            </div>
          </motion.form>
        ) : null}

        {view === 'generating' ? (
          <motion.div
            key="generating"
            className="flex min-h-40 items-center justify-center gap-2"
            role="status"
            aria-label="Preparing tutorial"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.3 }}
          >
            {[0, 1, 2].map((index) => (
              <motion.span
                key={index}
                className="h-9 w-px bg-black"
                animate={reduceMotion
                  ? { scaleY: 1, opacity: 0.5 }
                  : { scaleY: [0.35, 1, 0.35], opacity: [0.2, 1, 0.2] }}
                transition={{
                  duration: 0.9,
                  delay: index * 0.12,
                  repeat: Infinity,
                  ease: 'easeInOut'
                }}
              />
            ))}
          </motion.div>
        ) : null}

        {view === 'complete' ? (
          <motion.div
            key="complete"
            className="h-16"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            aria-hidden="true"
          />
        ) : null}
      </AnimatePresence>
    </div>
  )
}
