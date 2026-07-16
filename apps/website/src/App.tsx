import { ArrowUpRight, SlidersHorizontal } from 'lucide-react'
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from 'motion/react'
import { useEffect, useLayoutEffect, useState } from 'react'
import { GenerativeOrb } from './components/GenerativeOrb.js'
import {
  HeroJourney,
  type TutorialByok,
  type JourneyView,
  type TutorialPreferences
} from './components/HeroJourney.js'
import { ReadTutorial } from './components/ReadTutorial.js'

type RevealStage =
  | 'idle'
  | 'hiding'
  | 'splitting'
  | 'typing'
  | 'navigation'
  | 'description'
  | 'ready'

const repositoryUrl = 'https://github.com/gentorial/gentorial'
const docsUrl = `${import.meta.env.BASE_URL}docs/`
const readUrl = '#/read'
const desktopLeftTarget = 'erate Y'
const desktopRightTarget = 'our Tut'
const mobileTopTarget = 'erate'
const mobileMiddleTarget = 'Your'
const mobileBottomTarget = 'Tut'
const typingSteps = desktopLeftTarget.length

const stageRank: Record<RevealStage, number> = {
  idle: 0,
  hiding: 1,
  splitting: 2,
  typing: 3,
  navigation: 4,
  description: 5,
  ready: 6
}

function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <span
      className={compact
        ? 'text-[1.375rem] font-bold tracking-[-0.025em]'
        : 'font-bold tracking-[-0.025em]'}
      aria-label="GenTorial"
    >
      <span className="text-gentorial-blue">Gen</span>
      <span className="text-gentorial-magenta -ml-[0.025em]">Torial</span>
    </span>
  )
}

function SiteNavigation({
  visible,
  preferencesConfigured,
  preferencesControlIntro,
  preferencesOpen,
  onExplore
}: {
  visible: boolean
  preferencesConfigured: boolean
  preferencesControlIntro: boolean
  preferencesOpen: boolean
  onExplore: () => void
}) {
  const [preferencesHovered, setPreferencesHovered] = useState(false)
  const preferencesControlExpanded = preferencesControlIntro || preferencesHovered

  useEffect(() => {
    if (preferencesOpen) setPreferencesHovered(false)
  }, [preferencesOpen])

  return (
    <AnimatePresence>
      {visible ? (
        <motion.header
          className="fixed inset-x-0 top-0 z-50 border-b border-black/10 bg-white/82 backdrop-blur-xl"
          initial={{ opacity: 0, y: -72 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -72 }}
          transition={{ type: 'spring', stiffness: 180, damping: 24, mass: 0.9 }}
        >
          <nav
            className="mx-auto flex h-16 max-w-[1440px] items-center justify-between px-5 sm:px-8 lg:px-12"
            aria-label="主导航"
          >
            <a className="inline-flex items-center" href="#/" aria-label="GenTorial 首页">
              <BrandMark compact />
            </a>
            <div className="flex items-center gap-4 text-sm sm:gap-6">
              <AnimatePresence mode="popLayout" initial={false}>
                {preferencesConfigured && !preferencesOpen ? (
                    <motion.button
                      key="preferences-control"
                      layoutId="tutorial-preferences"
                      className="inline-flex h-9 shrink-0 items-center justify-center overflow-hidden rounded-full border bg-white text-black/60 transition-colors hover:text-black"
                      type="button"
                      onClick={onExplore}
                      onMouseEnter={() => setPreferencesHovered(true)}
                      onMouseLeave={() => setPreferencesHovered(false)}
                      onFocus={() => setPreferencesHovered(true)}
                      onBlur={() => setPreferencesHovered(false)}
                      aria-label="Adjust tutorial preferences"
                      animate={{
                        width: preferencesControlExpanded ? 132 : 36,
                        borderColor: preferencesHovered
                          ? 'rgb(0 0 0 / 0.35)'
                          : preferencesControlExpanded
                            ? 'rgb(0 0 0 / 0.12)'
                            : 'rgb(0 0 0 / 0)'
                      }}
                      initial={false}
                      transition={{
                        width: { type: 'spring', stiffness: 190, damping: 24, mass: 0.82 },
                        borderColor: {
                          duration: 0.18,
                          delay: preferencesControlExpanded ? 0 : 0.34
                        }
                      }}
                    >
                      <motion.span layout="position" className="inline-flex shrink-0 items-center">
                        <SlidersHorizontal className="size-3.5" strokeWidth={1.7} aria-hidden="true" />
                      </motion.span>
                      <AnimatePresence initial={false}>
                        {preferencesControlExpanded ? (
                          <motion.span
                            key="preferences-label"
                            className="ml-2 whitespace-nowrap"
                            initial={{ width: 0 }}
                            animate={{ width: 'auto' }}
                            exit={{ width: 0, marginLeft: 0 }}
                            transition={{ duration: 0.2 }}
                          >
                            Preferences
                          </motion.span>
                        ) : null}
                      </AnimatePresence>
                    </motion.button>
                ) : null}
              </AnimatePresence>
              <a
                className="text-link-underline inline-flex items-center gap-1.5 text-black/55 transition-colors hover:text-black"
                href={repositoryUrl}
                target="_blank"
                rel="noreferrer"
              >
                GitHub
                <ArrowUpRight aria-hidden="true" className="size-3.5" strokeWidth={1.6} />
              </a>
            </div>
          </nav>
        </motion.header>
      ) : null}
    </AnimatePresence>
  )
}

function SiteFooter() {
  return (
    <footer className="border-t border-black/10 bg-white px-5 sm:px-8 lg:px-12">
      <div className="mx-auto grid max-w-[1440px] gap-8 py-10 sm:grid-cols-2 sm:items-end sm:py-12">
        <div className="space-y-2">
          <a className="inline-flex items-center" href="#/" aria-label="GenTorial 首页">
            <BrandMark compact />
          </a>
          <p className="text-sm font-light text-black/52">
            Author-defined, learner-shaped tutorials.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-black/40 sm:justify-end">
          <span>© 2026 Gentorial contributors.</span>
          <span aria-hidden="true">·</span>
          <a
            className="text-link-underline transition-colors hover:text-black"
            href="https://github.com/gentorial/gentorial/blob/main/LICENSE"
            target="_blank"
            rel="noreferrer"
          >
            MIT License
          </a>
        </div>
      </div>
    </footer>
  )
}

function TypeCaret({ side = 'right' }: { side?: 'left' | 'right' }) {
  return (
    <motion.span
      className={`${side === 'left' ? 'mr-[0.07em]' : 'ml-[0.07em]'} inline-block h-[0.72em] w-[0.055em] bg-black/65 align-baseline`}
      initial={{ opacity: 0 }}
      animate={{ opacity: [0, 1, 1, 0] }}
      transition={{ duration: 0.82, repeat: Infinity, times: [0, 0.12, 0.62, 1] }}
    />
  )
}

function VanishingInitialT({ visible }: { visible: boolean }) {
  return (
    <AnimatePresence initial={false}>
      {visible ? (
        <motion.span
          key="initial-t"
          className="inline-block origin-center"
          exit={{
            opacity: 0,
            y: '-0.18em',
            scale: 0.18,
            filter: 'blur(7px)'
          }}
          transition={{ duration: 0.26, ease: [0.4, 0, 1, 1] }}
        >
          T
        </motion.span>
      ) : null}
    </AnimatePresence>
  )
}

export default function App() {
  const reduceMotion = useReducedMotion()
  const [stage, setStage] = useState<RevealStage>('idle')
  const [typingStep, setTypingStep] = useState(0)
  const [journeyView, setJourneyView] = useState<JourneyView | 'orb'>('orb')
  const [preferencesConfigured, setPreferencesConfigured] = useState(false)
  const [preferencesControlIntro, setPreferencesControlIntro] = useState(false)
  const [tutorialPreferences, setTutorialPreferences] = useState<TutorialPreferences>({
    depth: '',
    narrative: '',
    outcome: ''
  })
  const [tutorialByok, setTutorialByok] = useState<TutorialByok>({
    provider: 'openai',
    apiKey: '',
    model: 'gpt-5.6-terra',
    baseUrl: 'https://api.openai.com/v1'
  })
  const [readPreferencesOpen, setReadPreferencesOpen] = useState(false)
  const [readPreferencesView, setReadPreferencesView] = useState<'preferences' | 'byok'>('preferences')
  const [page, setPage] = useState<'home' | 'read'>(() => (
    window.location.hash === '#/read' ? 'read' : 'home'
  ))

  const initialTVisible = stage === 'idle'
  const titleSeparated = stageRank[stage] >= stageRank.splitting
  const typingActive = stage === 'typing'
  const navigationVisible = stageRank[stage] >= stageRank.navigation
  const descriptionVisible = stageRank[stage] >= stageRank.description
  const desktopLeftInsert = desktopLeftTarget.slice(0, typingStep)
  const desktopRightInsert = desktopRightTarget.slice(
    Math.max(desktopRightTarget.length - typingStep, 0)
  )
  const desktopRightBlack = desktopRightInsert.slice(0, -1)
  const desktopRightColored = desktopRightInsert.length > 0 ? 't' : ''
  const mobileTopInsert = mobileTopTarget.slice(0, Math.min(typingStep, mobileTopTarget.length))
  const mobileMiddleInsert = mobileMiddleTarget.slice(
    0,
    Math.min(Math.max(typingStep - 2, 0), mobileMiddleTarget.length)
  )
  const mobileBottomCount = Math.min(typingStep, mobileBottomTarget.length)
  const mobileBottomInsert = mobileBottomTarget.slice(
    mobileBottomTarget.length - mobileBottomCount
  )
  const mobileBottomBlack = mobileBottomInsert.slice(0, -1)
  const mobileBottomColored = mobileBottomInsert.length > 0 ? 't' : ''

  useEffect(() => {
    if (stage !== 'hiding') return
    const timeout = window.setTimeout(
      () => setStage('splitting'),
      reduceMotion ? 0 : 320
    )
    return () => window.clearTimeout(timeout)
  }, [reduceMotion, stage])

  useEffect(() => {
    if (stage !== 'splitting') return
    const timeout = window.setTimeout(
      () => setStage('typing'),
      reduceMotion ? 0 : 680
    )
    return () => window.clearTimeout(timeout)
  }, [reduceMotion, stage])

  useEffect(() => {
    if (stage !== 'typing') return

    if (reduceMotion) {
      setTypingStep(typingSteps)
      setStage('navigation')
      return
    }

    let nextStep = 0
    let timeout = 0

    const typeFromBothSides = (): void => {
      nextStep += 1
      setTypingStep(nextStep)

      if (nextStep < typingSteps) {
        timeout = window.setTimeout(typeFromBothSides, 92)
      } else {
        timeout = window.setTimeout(() => setStage('navigation'), 280)
      }
    }

    timeout = window.setTimeout(typeFromBothSides, 120)
    return () => window.clearTimeout(timeout)
  }, [reduceMotion, stage])

  useEffect(() => {
    if (stage !== 'navigation') return
    const timeout = window.setTimeout(
      () => setStage('description'),
      reduceMotion ? 0 : 620
    )
    return () => window.clearTimeout(timeout)
  }, [reduceMotion, stage])

  useEffect(() => {
    if (stage !== 'description') return
    const timeout = window.setTimeout(
      () => setStage('ready'),
      reduceMotion ? 0 : 980
    )
    return () => window.clearTimeout(timeout)
  }, [reduceMotion, stage])

  useEffect(() => {
    if (!preferencesControlIntro) return
    const timeout = window.setTimeout(
      () => setPreferencesControlIntro(false),
      reduceMotion ? 0 : 1150
    )
    return () => window.clearTimeout(timeout)
  }, [preferencesControlIntro, reduceMotion])

  useEffect(() => {
    const handleHashChange = (): void => {
      const nextPage = window.location.hash === '#/read' ? 'read' : 'home'
      setPage(nextPage)
      if (nextPage === 'home') setReadPreferencesOpen(false)
    }

    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  useLayoutEffect(() => {
    if (!readPreferencesOpen) return

    const previousOverflow = document.body.style.overflow
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') handleReadPreferencesClose()
    }

    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [readPreferencesOpen])

  function handleOrbActivate(): void {
    if (stage === 'idle') {
      setTypingStep(0)
      setStage('hiding')
    }
  }

  function handleExplore(): void {
    setPreferencesControlIntro(false)
    if (page === 'read') {
      setReadPreferencesView('preferences')
      setReadPreferencesOpen(true)
      return
    }
    setJourneyView('preferences')
  }

  function handleContinue(_preferences: TutorialPreferences): void {
    setTypingStep(typingSteps)
    setJourneyView('byok')
  }

  function handleOnboardingComplete(): void {
    setPreferencesConfigured(true)
    setPreferencesControlIntro(true)
    setJourneyView('complete')
  }

  function handleReadPreferencesClose(): void {
    setReadPreferencesOpen(false)
    if (preferencesConfigured) setPreferencesControlIntro(true)
  }

  function handleReadPreferencesContinue(_preferences: TutorialPreferences): void {
    setReadPreferencesView('byok')
  }

  function handleReadOnboardingComplete(): void {
    setPreferencesConfigured(true)
    setReadPreferencesOpen(false)
    setPreferencesControlIntro(true)
  }

  return (
    <main className="min-h-svh bg-white text-black">
      <LayoutGroup>
        <SiteNavigation
          visible={page === 'read' || navigationVisible}
          preferencesConfigured={preferencesConfigured}
          preferencesControlIntro={preferencesControlIntro}
          preferencesOpen={page === 'read'
            ? readPreferencesOpen
            : journeyView === 'preferences' || journeyView === 'byok'}
          onExplore={handleExplore}
        />
        {page === 'read' ? (
          <ReadTutorial />
        ) : (
          <section
            id="top"
            className={`${journeyView === 'preferences' || journeyView === 'byok'
              ? 'hero-grid flex min-h-svh items-start justify-center overflow-visible px-5 pb-12 pt-24 sm:pt-28'
              : `hero-grid hero-stage-centered${titleSeparated ? ' hero-stage-short-safe' : ''} flex min-h-svh items-center justify-center overflow-hidden px-5 py-10`}`}
          >
          <motion.div
            layout="position"
            className="flex w-full max-w-6xl flex-col items-center justify-center text-center"
            transition={{ layout: { type: 'spring', stiffness: 105, damping: 22, mass: 0.92 } }}
          >
            <motion.div
              layout
              className={titleSeparated
                ? 'relative z-10 flex min-h-[13rem] flex-col items-center justify-center sm:min-h-[clamp(8rem,15vw,11rem)]'
                : 'relative z-10 flex min-h-[8rem] flex-col items-center justify-center sm:min-h-[clamp(8rem,15vw,11rem)]'}
              transition={{ layout: { type: 'spring', stiffness: 110, damping: 20 } }}
            >
              <h1 className="sr-only">
                {titleSeparated ? 'Generate Your Tutorial' : 'GenTorial'}
              </h1>
              <motion.div
                layout
                className="flex items-baseline font-sans font-bold tracking-[-0.025em]"
                transition={{ type: 'spring', stiffness: 105, damping: 20, mass: 0.9 }}
                aria-hidden="true"
              >
                <motion.span
                  layout
                  className={`${titleSeparated
                    ? 'text-[clamp(1.85rem,6.3vw,5.4rem)] leading-[0.84]'
                    : 'text-[clamp(3.4rem,10vw,8.5rem)] leading-[0.82]'} relative hidden whitespace-nowrap tracking-[-0.05em] sm:inline-grid`}
                  transition={{ layout: { type: 'spring', stiffness: 105, damping: 20, mass: 0.9 } }}
                >
                  <span
                    className="invisible col-start-1 row-start-1 whitespace-nowrap"
                    aria-hidden="true"
                  >
                    {titleSeparated ? 'Generate Your Tutorial' : 'GenTorial'}
                  </span>
                  <span className="col-start-1 row-start-1 flex items-baseline justify-between">
                    <motion.span
                      layout
                      className="inline-flex items-baseline whitespace-pre"
                      transition={{ layout: { type: 'spring', stiffness: 125, damping: 22 } }}
                    >
                      <span className="text-gentorial-blue">Gen</span>
                      <span className="text-black">{desktopLeftInsert}</span>
                      {typingActive ? <TypeCaret /> : null}
                    </motion.span>
                    <motion.span
                      layout
                      className="inline-flex items-baseline whitespace-pre"
                      transition={{ layout: { type: 'spring', stiffness: 125, damping: 22 } }}
                    >
                      {typingActive ? <TypeCaret side="left" /> : null}
                      <span className="text-black">{desktopRightBlack}</span>
                      <span className={titleSeparated
                        ? 'text-gentorial-magenta'
                        : 'text-gentorial-magenta -ml-[0.025em]'}>
                        <VanishingInitialT visible={initialTVisible} />
                        {desktopRightColored}orial
                      </span>
                    </motion.span>
                  </span>
                </motion.span>

                <motion.span
                  layout
                  className={titleSeparated
                    ? 'grid w-[min(90vw,7em)] grid-rows-3 text-[clamp(3.25rem,16vw,4.7rem)] leading-[0.82] tracking-[-0.05em] sm:hidden'
                    : 'inline-flex items-baseline whitespace-nowrap text-[clamp(3.4rem,10vw,8.5rem)] leading-[0.82] tracking-[-0.05em] sm:hidden'}
                  transition={{ layout: { type: 'spring', stiffness: 105, damping: 20, mass: 0.9 } }}
                >
                  <motion.span
                    layout
                    className={titleSeparated
                      ? 'row-start-1 inline-flex min-h-[0.82em] items-baseline justify-self-start whitespace-nowrap'
                      : 'inline-flex items-baseline whitespace-nowrap'}
                  >
                    <span className="text-gentorial-blue">Gen</span>
                    <span className="text-black">{mobileTopInsert}</span>
                    {typingActive ? <TypeCaret /> : null}
                  </motion.span>

                  {titleSeparated ? (
                    <motion.span
                      layout
                      className="row-start-2 inline-flex min-h-[0.82em] items-baseline justify-self-center whitespace-nowrap text-black"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: reduceMotion ? 0 : 0.35 }}
                    >
                      {mobileMiddleInsert || '\u00a0'}
                    </motion.span>
                  ) : null}

                  <motion.span
                    layout
                    className={titleSeparated
                      ? 'row-start-3 inline-flex min-h-[0.82em] items-baseline justify-self-end whitespace-nowrap'
                      : 'inline-flex items-baseline whitespace-nowrap'}
                  >
                    {typingActive ? <TypeCaret side="left" /> : null}
                    <span className="text-black">{mobileBottomBlack}</span>
                    <span className={titleSeparated
                      ? 'text-gentorial-magenta'
                      : 'text-gentorial-magenta -ml-[0.025em]'}>
                      <VanishingInitialT visible={initialTVisible} />
                      {mobileBottomColored}orial
                    </span>
                  </motion.span>
                </motion.span>
              </motion.div>
              <AnimatePresence>
                {descriptionVisible ? (
                  <motion.p
                    className="mt-5 max-w-2xl text-[clamp(0.95rem,1.55vw,1.2rem)] font-light tracking-[-0.025em] text-black/52"
                    initial={{ opacity: 0, y: 16, filter: 'blur(8px)' }}
                    animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                    exit={{ opacity: 0, y: 8 }}
                    transition={{ duration: reduceMotion ? 0 : 0.7, ease: [0.16, 1, 0.3, 1] }}
                  >
                    An open framework for{' '}
                    <span className="concept-accent concept-accent-blue">
                      author-defined
                    </span>
                    ,{' '}
                    <span className="concept-accent concept-accent-magenta">
                      learner-shaped
                    </span>{' '}
                    tutorials.
                  </motion.p>
                ) : null}
              </AnimatePresence>
            </motion.div>
            <motion.div
              layout
              className={`${journeyView === 'preferences' || journeyView === 'byok'
                ? 'mt-7 w-full'
                : 'mt-8 min-h-40 w-full sm:mt-10'} flex items-center justify-center`}
              transition={{ layout: { type: 'spring', stiffness: 105, damping: 20 } }}
            >
              <AnimatePresence mode="wait" initial={false}>
                {journeyView === 'orb' ? (
                  <motion.div
                    key="orb"
                    initial={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: reduceMotion ? 0 : 0.16 }}
                  >
                    <GenerativeOrb
                      onActivate={handleOrbActivate}
                      onShatterComplete={() => setJourneyView('actions')}
                    />
                  </motion.div>
                ) : (
                  <motion.div
                    key="journey"
                    className="w-full"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: reduceMotion ? 0 : 0.24 }}
                  >
                    <HeroJourney
                      docsUrl={docsUrl}
                      readUrl={readUrl}
                      view={journeyView}
                      byok={tutorialByok}
                      preferences={tutorialPreferences}
                      onBack={() => setJourneyView(journeyView === 'byok' ? 'preferences' : 'actions')}
                      onByokChange={setTutorialByok}
                      onContinue={handleContinue}
                      onExplore={handleExplore}
                      onPreferencesChange={setTutorialPreferences}
                      onSkipByok={handleOnboardingComplete}
                      onSubmitByok={handleOnboardingComplete}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </motion.div>
          </section>
        )}
        <AnimatePresence>
          {page === 'read' && readPreferencesOpen ? (
            <div
              className="dialog-scroll fixed inset-0 z-[60] overflow-y-auto px-5 pb-10 pt-24 sm:px-8 sm:pt-28"
              role="dialog"
              aria-modal="true"
              aria-label="Tutorial preferences"
            >
              <motion.div
                className="fixed inset-0 -z-10 bg-white/76 backdrop-blur-md"
                aria-hidden="true"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: reduceMotion ? 0 : 0.28 }}
                onMouseDown={handleReadPreferencesClose}
              />
              <motion.div
                className="relative mx-auto flex min-h-[calc(100svh-8.5rem)] max-w-6xl items-start justify-center sm:min-h-[calc(100svh-9.5rem)] sm:items-center"
                initial={{ y: reduceMotion ? 0 : 10 }}
                animate={{ y: 0 }}
                exit={{ y: reduceMotion ? 0 : 8 }}
                transition={{ duration: reduceMotion ? 0 : 0.34, ease: [0.16, 1, 0.3, 1] }}
              >
                <HeroJourney
                  docsUrl={docsUrl}
                  readUrl={readUrl}
                  view={readPreferencesView}
                  byok={tutorialByok}
                  preferences={tutorialPreferences}
                  onBack={() => {
                    if (readPreferencesView === 'byok') setReadPreferencesView('preferences')
                    else handleReadPreferencesClose()
                  }}
                  onByokChange={setTutorialByok}
                  onContinue={handleReadPreferencesContinue}
                  onExplore={handleExplore}
                  onPreferencesChange={setTutorialPreferences}
                  onSkipByok={handleReadOnboardingComplete}
                  onSubmitByok={handleReadOnboardingComplete}
                />
              </motion.div>
            </div>
          ) : null}
        </AnimatePresence>
      </LayoutGroup>
      {page === 'read' || journeyView !== 'orb' ? <SiteFooter /> : null}
    </main>
  )
}
