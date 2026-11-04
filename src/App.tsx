import { useRef, useState } from 'react'
import type { DragEvent } from 'react'
import {
  SUBJECTS,
  STATUSES,
  STORAGE_KEY,
  samplePlan,
  validatePlan,
  uid,
  formatDate,
  addDays,
  monday,
  datesBetween,
  isTeachingDay,
  termCapacity,
  capacity,
  usedPeriods,
  coverage,
  moveLesson,
  resourceUrl,
} from './model'
import type { Lesson, Plan, Subject, CurriculumTarget } from './model'
import {
  CalendarEditor,
  CurriculumEditor,
  LessonEditor,
  Modal,
} from './components'
import './App.css'

type View = 'tabletop' | 'week' | 'term' | 'teach'
const subjectClass = (subject: Subject) =>
  subject === 'Science'
    ? 'science'
    : subject === 'Mathematics'
      ? 'math'
      : 'language'
function loadPlan() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return {
      plan: raw ? validatePlan(JSON.parse(raw)) : samplePlan(),
      error: '',
      saved: !!raw,
    }
  } catch {
    return {
      plan: samplePlan(),
      error:
        'Your saved plan could not be read. It has not been overwritten. Download the saved data before choosing to start with the sample.',
      saved: false,
    }
  }
}
function download(name: string, content: string) {
  const url = URL.createObjectURL(
    new Blob([content], { type: 'application/json' }),
  )
  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function App() {
  const [initial] = useState(loadPlan)
  const [plan, setPlan] = useState(initial.plan)
  const [storageError, setStorageError] = useState(initial.error)
  const [saved, setSaved] = useState(initial.saved)
  const [view, setView] = useState<View>('tabletop')
  const [subject, setSubject] = useState<Subject | 'All subjects'>(
    'All subjects',
  )
  const [unitId, setUnitId] = useState(plan.units[0]?.id ?? '')
  const [openOutcome, setOpenOutcome] = useState(plan.outcomes[0]?.id ?? '')
  const [search, setSearch] = useState('')
  const [date, setDate] = useState(plan.calendar.start)
  const [editing, setEditing] = useState<Lesson | null>(null)
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [curriculumOpen, setCurriculumOpen] = useState(false)
  const [curriculumTarget, setCurriculumTarget] = useState<
    CurriculumTarget | undefined
  >()
  const [addToUnit, setAddToUnit] = useState<string | undefined>()
  const [helpOpen, setHelpOpen] = useState(false)
  const [message, setMessage] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const commit = (next: Plan, overwrite = false) => {
    setPlan(next)
    if (initial.error && storageError && !overwrite) {
      setSaved(false)
      return
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      setSaved(true)
      setStorageError('')
    } catch {
      setSaved(false)
      setStorageError(
        'This browser could not save your plan. Export a backup to keep your changes before leaving.',
      )
    }
  }
  const selectUnit = (id: string) => {
    setUnitId(id)
    setOpenOutcome(plan.outcomes.find((o) => o.unitId === id)?.id ?? '')
  }
  const units = plan.units.filter(
    (u) => subject === 'All subjects' || u.subject === subject,
  )
  const unit = units.find((u) => u.id === unitId) ?? units[0]
  const outcomes = plan.outcomes.filter((o) => o.unitId === unit?.id)
  const matches = (l: Lesson) =>
    (subject === 'All subjects' || l.subject === subject) &&
    (!search.trim() ||
      `${l.title} ${l.notes} ${l.outcomeIds.map((id) => plan.outcomes.find((o) => o.id === id)?.title).join(' ')}`
        .toLowerCase()
        .includes(search.toLowerCase().trim()))
  const filtered = plan.lessons.filter(matches)
  const unscheduled = filtered.filter((l) => !l.date)
  const invalidDates = plan.lessons.filter(
    (l) => l.date && !isTeachingDay(l.date, plan.calendar),
  )
  const covered = plan.outcomes.filter((o) =>
    plan.lessons.some((l) => l.outcomeIds.includes(o.id)),
  ).length
  const activeSubjects = subject === 'All subjects' ? [...SUBJECTS] : [subject]
  const totalCapacity = activeSubjects.reduce(
    (sum, s) => sum + termCapacity(s, plan.calendar),
    0,
  )
  const termUsed = plan.lessons
    .filter(
      (l) =>
        activeSubjects.includes(l.subject) &&
        l.date >= plan.calendar.start &&
        l.date <= plan.calendar.end,
    )
    .reduce((sum, l) => sum + l.periods, 0)
  const days = datesBetween(plan.calendar.start, plan.calendar.end).filter(
    (d) => isTeachingDay(d, plan.calendar),
  )
  const weekStart = monday(date)
  const weekDays = Array.from({ length: 5 }, (_, i) => addDays(weekStart, i))
  const changeDate = (n: number) => setDate(addDays(date, n))
  const newLesson = (outcomeId?: string, targetDate = '') =>
    setEditing({
      id: uid(),
      title: '',
      subject: outcomeId
        ? (plan.units.find(
            (u) =>
              u.id === plan.outcomes.find((o) => o.id === outcomeId)?.unitId,
          )?.subject ?? 'Science')
        : subject === 'All subjects'
          ? 'Science'
          : subject,
      outcomeIds: outcomeId ? [outcomeId] : [],
      notes: '',
      assessment: '',
      periods: 1,
      status: 'Planned',
      date: targetDate,
      resources: [],
    })
  const move = (id: string, targetDate: string) => {
    try {
      commit(moveLesson(plan, id, targetDate))
      const lesson = plan.lessons.find((l) => l.id === id)
      setMessage(
        `${lesson?.title ?? 'Card'} ${targetDate ? `scheduled for ${formatDate(targetDate)}` : 'returned to unscheduled'}.`,
      )
    } catch (e) {
      setMessage((e as Error).message)
    }
  }
  const drop = (e: DragEvent, targetDate: string) => {
    e.preventDefault()
    const id = e.dataTransfer.getData('text/plain')
    if (plan.lessons.some((l) => l.id === id)) move(id, targetDate)
  }
  const card = (lesson: Lesson, compact = false) => (
    <article
      key={lesson.id}
      className={`lesson-card ${subjectClass(lesson.subject)} ${compact ? 'compact' : ''}`}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', lesson.id)
        e.dataTransfer.effectAllowed = 'move'
      }}
    >
      <div className="card-top">
        <span className="subject-label">
          <i />
          {lesson.subject}
        </span>
        <span className="drag-handle" aria-hidden="true">
          ⠿
        </span>
      </div>
      <button className="card-open" onClick={() => setEditing(lesson)}>
        <h3>{lesson.title}</h3>
      </button>
      {!compact && (
        <p className="card-description">
          {lesson.notes || 'Open this card to make it your own.'}
        </p>
      )}
      <div className="card-meta">
        <span>{lesson.periods * plan.calendar.periodMinutes} min</span>
        <span>
          {lesson.outcomeIds.length} outcome
          {lesson.outcomeIds.length === 1 ? '' : 's'}
        </span>
        {!!lesson.resources.length && <span>↗ {lesson.resources.length}</span>}
      </div>
      <div className="card-bottom">
        <span className={`stage stage-${lesson.status.toLowerCase()}`}>
          {lesson.status}
        </span>
        <button className="text-button" onClick={() => setEditing(lesson)}>
          {lesson.date ? formatDate(lesson.date) : '＋ Schedule'}
        </button>
      </div>
    </article>
  )
  const dayLoad = (d: string) => {
    const cap = activeSubjects.reduce(
      (sum, s) => sum + capacity(d, s, plan.calendar),
      0,
    )
    const used = activeSubjects.reduce(
      (sum, s) => sum + usedPeriods(plan.lessons, s, d),
      0,
    )
    const over = activeSubjects.filter(
      (s) => usedPeriods(plan.lessons, s, d) > capacity(d, s, plan.calendar),
    )
    return (
      <div className={`day-load ${over.length ? 'over' : ''}`}>
        <span>
          {used} / {cap} periods
        </span>
        {over.length > 0 && <span title={over.join(', ')}>Over capacity</span>}
      </div>
    )
  }
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault()
            setView('tabletop')
          }}
        >
          <span className="brand-mark">
            <i />
            <i />
            <i />
            <i />
          </span>
          <span>
            four square<small>BY ALBERTA ALIGNED</small>
          </span>
        </a>
        <div className="workspace-label">
          <span className="avatar">FS</span>
          <div>
            My planning space<small>Teacher workspace</small>
          </div>
        </div>
        <p className="nav-caption">MAKE SPACE FOR LEARNING</p>
        <nav aria-label="Main navigation">
          {(
            [
              ['tabletop', '▦', 'Curriculum tabletop'],
              ['week', '▤', 'Weekly planner'],
              ['term', '◫', 'Term overview'],
              ['teach', '▷', 'Teaching mode'],
            ] as const
          ).map(([id, icon, label]) => (
            <button
              key={id}
              className={view === id ? 'nav-item active' : 'nav-item'}
              onClick={() => setView(id)}
            >
              <span aria-hidden="true">{icon}</span>
              {label}
              {id === 'teach' && <i className="live-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-divider" />
        <p className="nav-caption">YOUR CURRICULUM</p>
        <button
          className={`subject-nav ${subject === 'All subjects' ? 'selected' : ''}`}
          onClick={() => setSubject('All subjects')}
        >
          <span className="all-dot">◌</span>All subjects
          <span>{plan.units.length}</span>
        </button>
        {SUBJECTS.map((s) => (
          <button
            key={s}
            className={`subject-nav ${subjectClass(s)} ${subject === s ? 'selected' : ''}`}
            onClick={() => setSubject(s)}
          >
            <i />
            {s}
            <span>{plan.units.filter((u) => u.subject === s).length}</span>
          </button>
        ))}
        <button
          className="add-curriculum text-button"
          onClick={() => {
            setAddToUnit(undefined)
            setCurriculumTarget(undefined)
            setCurriculumOpen(true)
          }}
        >
          ＋ Add unit or outcome
        </button>
        <div className="sidebar-bottom">
          <div className="quiet-note">
            <span>Less to hold in your head.</span>
            <p>More room for the teaching.</p>
            <div className="tiny-squares">■ ■ ■ ■</div>
          </div>
          <button className="nav-item" onClick={() => setHelpOpen(true)}>
            <span aria-hidden="true">?</span>About this prototype
          </button>
          <span className="local-status">
            <i className={saved ? '' : 'unsaved'} />
            {saved ? 'Saved in this browser' : 'Not saved · export to keep'}
          </span>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            My workspace <span>/</span>{' '}
            <strong>
              {view === 'tabletop'
                ? 'Curriculum tabletop'
                : view === 'week'
                  ? 'Weekly planner'
                  : view === 'term'
                    ? 'Term overview'
                    : 'Teaching mode'}
            </strong>
          </div>
          <div className="top-actions">
            <button
              className="text-button"
              onClick={() =>
                download(
                  'four-square-backup.json',
                  JSON.stringify(plan, null, 2),
                )
              }
            >
              ↓ Export plan
            </button>
            <button
              className="text-button"
              onClick={() => fileRef.current?.click()}
            >
              ↑ Import
            </button>
            <span className="teacher-avatar" aria-label="Your workspace">
              FS
            </span>
          </div>
        </header>
        <input
          ref={fileRef}
          className="visually-hidden"
          type="file"
          accept=".json,application/json"
          aria-label="Import plan backup"
          onChange={async (e) => {
            const file = e.target.files?.[0]
            if (!file) return
            try {
              if (file.size > 2_000_000)
                throw new Error('Please choose a backup smaller than 2 MB.')
              const imported = validatePlan(JSON.parse(await file.text()))
              if (
                !confirm(
                  'Replace this browser’s current plan with the imported backup? Export your current plan first if you want to keep it.',
                )
              )
                return
              commit(imported, true)
              setDate(imported.calendar.start)
              setUnitId(imported.units[0]?.id ?? '')
              setOpenOutcome(imported.outcomes[0]?.id ?? '')
              setMessage('Your backup has been imported.')
            } catch (error) {
              setMessage((error as Error).message)
            } finally {
              e.target.value = ''
            }
          }}
        />
        {storageError && (
          <div className="recovery-banner" role="alert">
            <p>{storageError}</p>
            {initial.error && (
              <div className="action-group">
                <button
                  className="secondary"
                  onClick={() => {
                    try {
                      download(
                        'four-square-recovery.json',
                        localStorage.getItem(STORAGE_KEY) ?? '',
                      )
                    } catch {
                      setMessage(
                        'The browser is blocking access to saved data.',
                      )
                    }
                  }}
                >
                  Download saved data
                </button>
                <button
                  className="secondary"
                  onClick={() => {
                    if (
                      confirm(
                        'Replace the unreadable saved data with the plan currently on screen?',
                      )
                    ) {
                      commit({ ...plan }, true)
                    }
                  }}
                >
                  Use current plan
                </button>
              </div>
            )}
          </div>
        )}
        <main>
          <div className="page-heading">
            <div>
              <p className="eyebrow">
                A LITTLE STRUCTURE. A LOT OF POSSIBILITY.
              </p>
              <h1>
                {view === 'tabletop'
                  ? 'Your curriculum, connected.'
                  : view === 'week'
                    ? 'A week with room to learn.'
                    : view === 'term'
                      ? 'See the bigger picture.'
                      : 'Ready for the moments that matter.'}
              </h1>
              <p>
                {view === 'tabletop'
                  ? 'Spread out your ideas. Find the connections. Make a plan that feels like yours.'
                  : view === 'week'
                    ? 'Bring your planning cards into the week. Move them when life happens.'
                    : view === 'term'
                      ? 'Let your calendar make the time visible. You decide how to use it.'
                      : 'Just the plan, the materials, and the learning in front of you.'}
              </p>
            </div>
            <button className="primary new-card" onClick={() => newLesson()}>
              ＋ New planning card
            </button>
          </div>
          <div className="sample-banner">
            <span className="sample-icon" aria-hidden="true">
              ✦
            </span>
            <p>
              <strong>A starting point, not a prescribed plan.</strong> Grade
              3–inspired sample cards · illustrative outcomes, not verified
              Alberta curriculum.
            </p>
            <button className="text-button" onClick={() => setHelpOpen(true)}>
              Make it yours ↗
            </button>
          </div>
          <section className="summary-grid" aria-label="Planning summary">
            <div>
              <span className="stat-icon sage">▦</span>
              <div>
                <strong>{plan.outcomes.length}</strong>
                <span>curriculum outcomes</span>
              </div>
              <small>{plan.units.length} connected units</small>
            </div>
            <div>
              <span className="stat-icon lavender">▧</span>
              <div>
                <strong>{plan.lessons.length}</strong>
                <span>planning cards</span>
              </div>
              <small>
                {plan.lessons.filter((l) => !l.date).length} waiting for a date
              </small>
            </div>
            <div>
              <span className="stat-icon peach">◷</span>
              <div>
                <strong>{totalCapacity}</strong>
                <span>available term periods</span>
              </div>
              <small>
                {termUsed} scheduled ·{' '}
                {subject === 'All subjects' ? 'all subjects' : subject}
              </small>
            </div>
            <div>
              <span className="stat-icon blue">✓</span>
              <div>
                <strong>
                  {covered}
                  <em>/{plan.outcomes.length}</em>
                </strong>
                <span>outcomes with a plan</span>
              </div>
              <small>Connections, not completion</small>
            </div>
          </section>
          {invalidDates.length > 0 && (
            <div className="notice">
              <strong>
                {invalidDates.length} card{invalidDates.length === 1 ? '' : 's'}{' '}
                need rescheduling.
              </strong>{' '}
              The calendar changed; these cards are on non-teaching days or
              outside the term.{' '}
              {invalidDates.map((l) => (
                <button
                  className="text-button"
                  key={l.id}
                  onClick={() => setEditing(l)}
                >
                  {l.title} ↗
                </button>
              ))}
            </div>
          )}
          <div className="workspace-toolbar">
            <div className="view-tabs" aria-label="Planning view">
              {(['tabletop', 'week', 'term', 'teach'] as View[]).map((v) => (
                <button
                  key={v}
                  className={view === v ? 'selected' : ''}
                  onClick={() => setView(v)}
                >
                  {v === 'tabletop'
                    ? 'Tabletop'
                    : v === 'week'
                      ? 'Week'
                      : v === 'term'
                        ? 'Term'
                        : 'Teach'}
                </button>
              ))}
            </div>
            <div className="toolbar-right">
              <label className="subject-filter">
                <span className="visually-hidden">Filter by subject</span>
                <select
                  value={subject}
                  onChange={(e) =>
                    setSubject(e.target.value as Subject | 'All subjects')
                  }
                >
                  {['All subjects', ...SUBJECTS].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </label>
              <label className="search-box">
                <span aria-hidden="true">⌕</span>
                <input
                  type="search"
                  placeholder="Find a planning card…"
                  aria-label="Find a planning card"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </label>
              <button
                className="secondary calendar-button"
                onClick={() => setCalendarOpen(true)}
              >
                ◷ Calendar & timetable
              </button>
            </div>
          </div>
          {view === 'tabletop' && (
            <section className="tabletop-area">
              <div className="section-title">
                <div>
                  <h2>The curriculum tabletop</h2>
                  <p>
                    Open a unit. Unfold an outcome. Discover the plan inside.
                  </p>
                </div>
                <span className="subtle-label">
                  {subject === 'All subjects' ? 'All subjects' : subject}
                </span>
              </div>
              <div className="unit-row">
                {units.map((u) => (
                  <button
                    key={u.id}
                    className={`unit-stack ${subjectClass(u.subject)} ${unit?.id === u.id ? 'selected' : ''}`}
                    onClick={() => selectUnit(u.id)}
                  >
                    <span className="unit-top">
                      <span className="subject-label">
                        <i />
                        {u.subject}
                      </span>
                      <span aria-hidden="true">
                        {unit?.id === u.id ? '↘' : '↗'}
                      </span>
                    </span>
                    <strong>{u.title}</strong>
                    <span className="unit-count">
                      {plan.outcomes.filter((o) => o.unitId === u.id).length}{' '}
                      outcomes <span>UNIT</span>
                    </span>
                  </button>
                ))}
                <button
                  className="add-unit"
                  onClick={() => {
                    setAddToUnit(undefined)
                    setCurriculumTarget(undefined)
                    setCurriculumOpen(true)
                  }}
                >
                  <span>＋</span>Add a unit
                </button>
              </div>
              {unit && (
                <div className={`outcomes-area ${subjectClass(unit.subject)}`}>
                  <div className="section-title">
                    <div className="stack-heading">
                      <span className="stack-symbol" aria-hidden="true">
                        ▱
                      </span>
                      <div>
                        <h2>{unit.title}</h2>
                        <p>
                          {outcomes.length} outcome
                          {outcomes.length === 1 ? '' : 's'} · click a card to
                          open its planning stack
                        </p>
                      </div>
                    </div>
                    <div className="action-group">
                      <button
                        className="text-button"
                        onClick={() => {
                          setCurriculumTarget({ kind: 'unit', id: unit.id })
                          setCurriculumOpen(true)
                        }}
                      >
                        Edit unit
                      </button>
                      <button
                        className="text-button"
                        onClick={() => {
                          setAddToUnit(unit.id)
                          setCurriculumTarget(undefined)
                          setCurriculumOpen(true)
                        }}
                      >
                        ＋ Add outcome
                      </button>
                    </div>
                  </div>
                  <div className="outcome-grid">
                    {outcomes.map((o) => {
                      const linked = plan.lessons.filter((l) =>
                        l.outcomeIds.includes(o.id),
                      )
                      const stages = coverage(o.id, plan.lessons)
                      return (
                        <button
                          className={`outcome-card ${openOutcome === o.id ? 'expanded' : ''}`}
                          key={o.id}
                          onClick={() =>
                            setOpenOutcome(openOutcome === o.id ? '' : o.id)
                          }
                          aria-expanded={openOutcome === o.id}
                        >
                          <div className="card-top">
                            <span className="eyebrow">CURRICULUM OUTCOME</span>
                            <span aria-hidden="true">
                              {openOutcome === o.id ? '−' : '＋'}
                            </span>
                          </div>
                          <h3>{o.title}</h3>
                          <p>{o.description}</p>
                          <div className="outcome-foot">
                            <span>
                              {linked.length} planning card
                              {linked.length === 1 ? '' : 's'}
                            </span>
                            <span
                              className="coverage-dots"
                              aria-label={
                                stages.length
                                  ? stages.join(', ')
                                  : 'No coverage yet'
                              }
                            >
                              {STATUSES.map((s) => (
                                <i
                                  key={s}
                                  title={s}
                                  className={
                                    stages.includes(s)
                                      ? `filled stage-${s.toLowerCase()}`
                                      : ''
                                  }
                                />
                              ))}
                            </span>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                  {outcomes.some((o) => o.id === openOutcome) && (
                    <div className="planning-stack">
                      <div className="section-title">
                        <div>
                          <p className="eyebrow">INSIDE THIS OUTCOME</p>
                          <h3>
                            {outcomes.find((o) => o.id === openOutcome)?.title}
                          </h3>
                        </div>
                        <div className="action-group">
                          <button
                            className="text-button"
                            onClick={() => {
                              setCurriculumTarget({
                                kind: 'outcome',
                                id: openOutcome,
                              })
                              setCurriculumOpen(true)
                            }}
                          >
                            Edit outcome
                          </button>
                          <button
                            className="secondary"
                            onClick={() => newLesson(openOutcome)}
                          >
                            ＋ Planning card
                          </button>
                        </div>
                      </div>
                      <div className="lesson-grid">
                        {filtered
                          .filter((l) => l.outcomeIds.includes(openOutcome))
                          .map((l) => card(l))}
                        {!filtered.some((l) =>
                          l.outcomeIds.includes(openOutcome),
                        ) && (
                          <div className="empty-state">
                            <span>▧</span>
                            <h3>Room for your next idea.</h3>
                            <p>
                              {search
                                ? 'No cards match your search in this outcome.'
                                : 'Add a planning card, or connect an existing one from its editor.'}
                            </p>
                          </div>
                        )}
                      </div>
                      <p className="connection-note">
                        ↳ A card can live in several outcome stacks. Edit it
                        once; every connection stays up to date.
                      </p>
                    </div>
                  )}
                </div>
              )}
              <div className="coverage-legend">
                <span>Learning stages</span>
                {STATUSES.map((s) => (
                  <span key={s}>
                    <i className={`stage-${s.toLowerCase()}`} />
                    {s}
                  </span>
                ))}
              </div>
              <div className="section-title library-title">
                <div>
                  <h2>All planning cards</h2>
                  <p>Your cards stay connected, wherever you plan.</p>
                </div>
                <span className="subtle-label">{filtered.length} cards</span>
              </div>
              <div className="lesson-grid library-grid">
                {filtered.map((l) => card(l, true))}
                {!filtered.length && (
                  <p className="empty-state">
                    No matching cards. Clear your search or create your first
                    planning card.
                  </p>
                )}
              </div>
            </section>
          )}
          {view === 'week' && (
            <section>
              <div className="section-title week-heading">
                <div>
                  <p className="eyebrow">YOUR WEEK AT A GLANCE</p>
                  <h2>
                    {formatDate(weekStart)} –{' '}
                    {formatDate(addDays(weekStart, 4), {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </h2>
                </div>
                <div className="action-group">
                  <button
                    className="icon-button"
                    aria-label="Previous week"
                    onClick={() => changeDate(-7)}
                  >
                    ←
                  </button>
                  <button
                    className="secondary"
                    onClick={() => setDate(plan.calendar.start)}
                  >
                    Term start
                  </button>
                  <button
                    className="icon-button"
                    aria-label="Next week"
                    onClick={() => changeDate(7)}
                  >
                    →
                  </button>
                </div>
              </div>
              <p className="field-help">
                Drag cards between days, or open a card to set its date using
                the keyboard. Over-capacity warnings respect each subject’s
                timetable.
              </p>
              <div className="week-board">
                {weekDays.map((d) => (
                  <section
                    key={d}
                    className={`day-column ${!isTeachingDay(d, plan.calendar) ? 'closed-day' : ''}`}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => drop(e, d)}
                    aria-label={formatDate(d, {
                      weekday: 'long',
                      month: 'long',
                      day: 'numeric',
                    })}
                  >
                    <div className="day-heading">
                      <span>{formatDate(d, { weekday: 'short' })}</span>
                      <strong>{formatDate(d, { day: 'numeric' })}</strong>
                    </div>
                    {dayLoad(d)}
                    {!isTeachingDay(d, plan.calendar) && (
                      <p className="day-away">
                        {plan.calendar.exclusions.find((e) => e.date === d)
                          ?.label ?? 'Outside this term'}
                      </p>
                    )}
                    {filtered
                      .filter((l) => l.date === d)
                      .map((l) => card(l, true))}
                    {isTeachingDay(d, plan.calendar) && (
                      <button
                        className="add-day-card"
                        onClick={() => newLesson(undefined, d)}
                      >
                        ＋ Add a card
                      </button>
                    )}
                  </section>
                ))}
              </div>
              <div
                className="unscheduled-tray"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => drop(e, '')}
              >
                <div className="section-title">
                  <div>
                    <h2>
                      Ideas without a date{' '}
                      <span className="count-badge">{unscheduled.length}</span>
                    </h2>
                    <p>
                      Keep a little space for possibility. Drag a card into the
                      week when you're ready.
                    </p>
                  </div>
                </div>
                <div className="lesson-grid">
                  {unscheduled.map((l) => card(l, true))}
                  {!unscheduled.length && (
                    <p className="field-help">
                      All matching cards have a date. Drop a card here to
                      unschedule it.
                    </p>
                  )}
                </div>
              </div>
            </section>
          )}
          {view === 'term' && (
            <section className="term-view">
              <div className="section-title">
                <div>
                  <p className="eyebrow">TEACHER-LED PACING</p>
                  <h2>
                    {formatDate(plan.calendar.start)} –{' '}
                    {formatDate(plan.calendar.end, {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </h2>
                  <p>
                    {days.length} teaching days · {plan.calendar.periodMinutes}{' '}
                    minutes per period ·{' '}
                    {
                      plan.calendar.exclusions.filter(
                        (e) =>
                          e.date >= plan.calendar.start &&
                          e.date <= plan.calendar.end,
                      ).length
                    }{' '}
                    days away entered
                  </p>
                </div>
                <button
                  className="secondary"
                  onClick={() => setCalendarOpen(true)}
                >
                  Edit calendar
                </button>
              </div>
              <div className="capacity-grid">
                {activeSubjects.map((s) => {
                  const cap = termCapacity(s, plan.calendar)
                  const used = plan.lessons
                    .filter(
                      (l) =>
                        l.subject === s &&
                        l.date >= plan.calendar.start &&
                        l.date <= plan.calendar.end,
                    )
                    .reduce((sum, l) => sum + l.periods, 0)
                  return (
                    <div className={`capacity-card ${subjectClass(s)}`} key={s}>
                      <span className="subject-label">
                        <i />
                        {s}
                      </span>
                      <h3>
                        {used}
                        <span> / {cap} periods scheduled</span>
                      </h3>
                      <progress
                        value={Math.min(used, cap)}
                        max={cap || 1}
                        aria-label={`${s} scheduled capacity`}
                      />
                      <p>
                        {used > cap
                          ? `${used - cap} periods over term capacity`
                          : `${cap - used} periods still open`}{' '}
                        · {cap * plan.calendar.periodMinutes} available minutes
                      </p>
                    </div>
                  )
                })}
              </div>
              <div className="term-weeks">
                {datesBetween(monday(plan.calendar.start), plan.calendar.end)
                  .filter((_, i) => i % 7 === 0)
                  .map((start, i) => {
                    const end = addDays(start, 4)
                    const lessons = filtered.filter(
                      (l) => l.date >= start && l.date <= end,
                    )
                    const cap = datesBetween(start, end).reduce(
                      (n, d) =>
                        n +
                        activeSubjects.reduce(
                          (v, s) => v + capacity(d, s, plan.calendar),
                          0,
                        ),
                      0,
                    )
                    const used = lessons.reduce((sum, l) => sum + l.periods, 0)
                    return (
                      <div key={start} className="term-week">
                        <button
                          className="term-week-label"
                          onClick={() => {
                            setDate(start)
                            setView('week')
                          }}
                        >
                          <span className="eyebrow">WEEK {i + 1}</span>
                          <strong>
                            {formatDate(start)} – {formatDate(end)}
                          </strong>
                          <span>
                            {used} / {cap} periods · open week ↗
                          </span>
                        </button>
                        <div className="term-week-cards">
                          {lessons.map((l) => (
                            <button
                              className={`term-chip ${subjectClass(l.subject)}`}
                              key={l.id}
                              onClick={() => setEditing(l)}
                            >
                              <i />
                              <span>{l.title}</span>
                              <small>{formatDate(l.date)}</small>
                            </button>
                          ))}
                          {!lessons.length && (
                            <span className="field-help">
                              An open stretch of possibility.
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })}
              </div>
              <p className="field-help">
                Capacity counts teaching weekdays minus your entered exclusions.
                Scheduled cards are preserved when the calendar changes; review
                any flagged dates and weekly subject warnings.
              </p>
            </section>
          )}
          {view === 'teach' && (
            <section className="teaching-view">
              <div className="section-title">
                <div>
                  <p className="eyebrow">ONE DAY. EVERYTHING CONNECTED.</p>
                  <h2>
                    {formatDate(date, {
                      weekday: 'long',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </h2>
                </div>
                <div className="action-group">
                  <button
                    className="icon-button"
                    aria-label="Previous day"
                    onClick={() => changeDate(-1)}
                  >
                    ←
                  </button>
                  <label className="visually-hidden" htmlFor="teaching-date">
                    Teaching date
                  </label>
                  <input
                    id="teaching-date"
                    type="date"
                    value={date}
                    onChange={(e) => e.target.value && setDate(e.target.value)}
                  />
                  <button
                    className="icon-button"
                    aria-label="Next day"
                    onClick={() => changeDate(1)}
                  >
                    →
                  </button>
                </div>
              </div>
              {dayLoad(date)}
              <div className="teaching-list">
                {filtered
                  .filter((l) => l.date === date)
                  .map((l, i) => (
                    <article
                      key={l.id}
                      className={`teaching-card ${subjectClass(l.subject)}`}
                    >
                      <div className="teaching-number">
                        {String(i + 1).padStart(2, '0')}
                      </div>
                      <div className="teaching-content">
                        <div className="section-title">
                          <span className="subject-label">
                            <i />
                            {l.subject} ·{' '}
                            {l.periods * plan.calendar.periodMinutes} min
                          </span>
                          <label className="status-picker">
                            <span className="visually-hidden">
                              Learning stage for {l.title}
                            </span>
                            <select
                              value={l.status}
                              onChange={(e) =>
                                commit({
                                  ...plan,
                                  lessons: plan.lessons.map((x) =>
                                    x.id === l.id
                                      ? {
                                          ...x,
                                          status: e.target
                                            .value as Lesson['status'],
                                        }
                                      : x,
                                  ),
                                })
                              }
                            >
                              {STATUSES.map((s) => (
                                <option key={s}>{s}</option>
                              ))}
                            </select>
                          </label>
                        </div>
                        <h2>{l.title}</h2>
                        <p className="lesson-notes">
                          {l.notes || 'No lesson notes yet.'}
                        </p>
                        {!!l.outcomeIds.length && (
                          <div className="linked-outcomes">
                            {l.outcomeIds.map((id) => (
                              <span key={id}>
                                {plan.outcomes.find((o) => o.id === id)?.title}
                              </span>
                            ))}
                          </div>
                        )}
                        {l.assessment && (
                          <div className="look-for">
                            <strong>↳ Look for</strong>
                            <p>{l.assessment}</p>
                          </div>
                        )}
                        <div className="resource-links">
                          {l.resources.map((r) => (
                            <a
                              key={r.id}
                              href={resourceUrl(r) ?? undefined}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <span className="resource-kind">{r.kind}</span>
                              <span>
                                <strong>{r.title}</strong>
                                <small>
                                  {r.selection || 'Original resource'} · opens
                                  original link
                                </small>
                              </span>
                              <span aria-hidden="true">↗</span>
                            </a>
                          ))}
                          {!l.resources.length && (
                            <span className="field-help">
                              No resources attached. Add your existing file
                              links in this card.
                            </span>
                          )}
                        </div>
                        <button
                          className="text-button"
                          onClick={() => setEditing(l)}
                        >
                          Open planning card ↗
                        </button>
                      </div>
                    </article>
                  ))}
                {!filtered.some((l) => l.date === date) && (
                  <div className="empty-state teach-empty">
                    <span>☀</span>
                    <h2>A little breathing room.</h2>
                    <p>
                      {isTeachingDay(date, plan.calendar)
                        ? 'No matching lessons scheduled for this day.'
                        : (plan.calendar.exclusions.find((e) => e.date === date)
                            ?.label ??
                          'This is not a teaching day in your calendar.')}
                    </p>
                    <button
                      className="secondary"
                      onClick={() => setView('week')}
                    >
                      Plan this week ↗
                    </button>
                  </div>
                )}
              </div>
              <p className="field-help">
                Page and slide selections are reminders. Resource links open the
                original file; no documents are fetched, combined, or checked
                for access by Four Square.
              </p>
            </section>
          )}
          <footer className="workspace-footer">
            <span>Enter it once. Find it where you need it.</span>
            <span>
              Curriculum <i /> Time <i /> Resources <i /> Assessment
            </span>
          </footer>
        </main>
      </div>
      {message && (
        <div className="toast" role="status">
          <span>{message}</span>
          <button
            className="icon-button"
            aria-label="Dismiss message"
            onClick={() => setMessage('')}
          >
            ×
          </button>
        </div>
      )}
      {editing && (
        <LessonEditor
          key={editing.id}
          lesson={editing}
          plan={plan}
          onClose={() => setEditing(null)}
          onSave={(lesson) => {
            commit({
              ...plan,
              lessons: plan.lessons.some((l) => l.id === lesson.id)
                ? plan.lessons.map((l) => (l.id === lesson.id ? lesson : l))
                : [...plan.lessons, lesson],
            })
            setEditing(null)
            setMessage(
              'Planning card saved. Every connected view is up to date.',
            )
          }}
          onDelete={() => {
            commit({
              ...plan,
              lessons: plan.lessons.filter((l) => l.id !== editing.id),
            })
            setEditing(null)
            setMessage('Planning card deleted from all views.')
          }}
        />
      )}
      {calendarOpen && (
        <CalendarEditor
          plan={plan}
          onClose={() => setCalendarOpen(false)}
          onSave={(calendar) => {
            commit({ ...plan, calendar })
            setDate(calendar.start)
            setCalendarOpen(false)
            setMessage('Calendar saved. Your cards stayed in place.')
          }}
        />
      )}
      {curriculumOpen && (
        <CurriculumEditor
          plan={plan}
          unitId={addToUnit}
          target={curriculumTarget}
          onClose={() => setCurriculumOpen(false)}
          onSave={(next) => {
            commit(next)
            setCurriculumOpen(false)
            setMessage(
              'Curriculum updated. Your planning cards stayed connected.',
            )
          }}
        />
      )}
      {helpOpen && (
        <Modal
          title="A planner that thinks in connections."
          onClose={() => setHelpOpen(false)}
        >
          <div className="help-content">
            <p>
              Four Square brings curriculum, time, resources, and assessment
              into one visual planning space. Your professional judgment stays
              at the centre.
            </p>
            <h3>Start with what you know</h3>
            <ol>
              <li>
                Add your own units and verified outcome wording. The initial
                cards are illustrative Grade 3–inspired examples.
              </li>
              <li>
                Open an outcome to see its planning cards. Connect one card to
                several outcomes without copying it.
              </li>
              <li>
                Set your term, days away, and subject timetable. Move cards into
                the week by dragging, or set dates in the card editor.
              </li>
              <li>
                Use Teaching Mode to see lesson notes, assessment prompts, and
                your resource links for a chosen day.
              </li>
            </ol>
            <h3>Your files stay yours</h3>
            <p>
              Links point to files where you already keep them. Page and slide
              notes are saved with the card. There is no Google sign-in, file
              extraction, link-access checking, AI, or print-pack generation in
              this prototype.
            </p>
            <h3>Your plan stays in this browser</h3>
            <p>
              There is no account, server database, or cross-device sync. Export
              backups regularly. Import replaces the current plan after
              confirmation. Avoid entering student information. Browser storage
              can be cleared by browser settings.
            </p>
            <button className="primary" onClick={() => setHelpOpen(false)}>
              Back to my tabletop
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}

export default App
