export const SUBJECTS = ['Science', 'Mathematics', 'Language Arts'] as const
export type Subject = (typeof SUBJECTS)[number]
export const STATUSES = ['Planned', 'Taught', 'Practised', 'Assessed'] as const
export type Status = (typeof STATUSES)[number]
export interface Unit {
  id: string
  title: string
  subject: Subject
}
export interface Outcome {
  id: string
  unitId: string
  title: string
  description: string
}
export interface Resource {
  id: string
  title: string
  url: string
  kind: 'PDF' | 'Slides' | 'Link'
  selection: string
}
export interface Lesson {
  id: string
  title: string
  subject: Subject
  outcomeIds: string[]
  notes: string
  assessment: string
  periods: number
  status: Status
  date: string
  resources: Resource[]
}
export interface Calendar {
  start: string
  end: string
  periodMinutes: number
  exclusions: { date: string; label: string }[]
  timetable: Record<Subject, number[]>
}
export interface Plan {
  version: 1
  units: Unit[]
  outcomes: Outcome[]
  lessons: Lesson[]
  calendar: Calendar
}
export const STORAGE_KEY = 'four-square.plan.v1'
export const uid = () => crypto.randomUUID()
export function parseDate(date: string) {
  return new Date(`${date}T12:00:00Z`)
}
export function isoDate(date: Date) {
  return date.toISOString().slice(0, 10)
}
export function addDays(date: string, count: number) {
  const d = parseDate(date)
  d.setUTCDate(d.getUTCDate() + count)
  return isoDate(d)
}
export function validDate(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(parseDate(value).getTime()) &&
    isoDate(parseDate(value)) === value
  )
}
export function datesBetween(start: string, end: string) {
  const dates: string[] = []
  for (let d = start; d <= end; d = addDays(d, 1)) dates.push(d)
  return dates
}
export function monday(date: string) {
  return addDays(date, -((parseDate(date).getUTCDay() + 6) % 7))
}
export function isTeachingDay(date: string, calendar: Calendar) {
  const day = parseDate(date).getUTCDay()
  return (
    date >= calendar.start &&
    date <= calendar.end &&
    day > 0 &&
    day < 6 &&
    !calendar.exclusions.some((e) => e.date === date)
  )
}
export function capacity(date: string, subject: Subject, calendar: Calendar) {
  return isTeachingDay(date, calendar)
    ? calendar.timetable[subject][parseDate(date).getUTCDay() - 1]
    : 0
}
export function termCapacity(subject: Subject, calendar: Calendar) {
  return datesBetween(calendar.start, calendar.end).reduce(
    (sum, date) => sum + capacity(date, subject, calendar),
    0,
  )
}
export function usedPeriods(
  lessons: Lesson[],
  subject: Subject,
  date?: string,
) {
  return lessons
    .filter((l) => l.subject === subject && (date ? l.date === date : !!l.date))
    .reduce((sum, l) => sum + l.periods, 0)
}
export function resourceUrl(resource: Resource) {
  try {
    const url = new URL(resource.url)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
    return url.href
  } catch {
    return null
  }
}
export function driveFileId(url: string) {
  try {
    const u = new URL(url)
    if (!['drive.google.com', 'docs.google.com'].includes(u.hostname))
      return undefined
    return (
      u.pathname.match(/\/d\/([\w-]+)/)?.[1] ??
      u.searchParams.get('id') ??
      undefined
    )
  } catch {
    return undefined
  }
}
export function coverage(outcomeId: string, lessons: Lesson[]) {
  const linked = lessons.filter((l) => l.outcomeIds.includes(outcomeId))
  return STATUSES.filter((s) => linked.some((l) => l.status === s))
}
export function moveLesson(plan: Plan, id: string, date: string): Plan {
  if (date && (!validDate(date) || !isTeachingDay(date, plan.calendar)))
    throw new Error(
      'Choose a teaching day within this term, or leave the card unscheduled.',
    )
  return {
    ...plan,
    lessons: plan.lessons.map((l) => (l.id === id ? { ...l, date } : l)),
  }
}
export function validatePlan(input: unknown): Plan {
  const fail = () => {
    throw new Error(
      'This file is not a valid Four Square backup. Your current plan has not been changed.',
    )
  }
  if (!input || typeof input !== 'object') return fail()
  const p = input as Plan
  if (
    p.version !== 1 ||
    !Array.isArray(p.units) ||
    !Array.isArray(p.outcomes) ||
    !Array.isArray(p.lessons) ||
    !p.calendar
  )
    return fail()
  const c = p.calendar
  if (
    !validDate(c.start) ||
    !validDate(c.end) ||
    c.end < c.start ||
    datesSpan(c.start, c.end) > 730 ||
    !Number.isInteger(c.periodMinutes) ||
    c.periodMinutes < 1 ||
    c.periodMinutes > 180 ||
    !Array.isArray(c.exclusions) ||
    !c.timetable
  )
    return fail()
  if (
    !SUBJECTS.every(
      (s) =>
        Array.isArray(c.timetable[s]) &&
        c.timetable[s].length === 5 &&
        c.timetable[s].every((n) => Number.isInteger(n) && n >= 0 && n <= 12),
    )
  )
    return fail()
  if (
    !c.exclusions.every(
      (e) => e && validDate(e.date) && typeof e.label === 'string',
    )
  )
    return fail()
  const ids = new Set<string>()
  const idValid = (id: string) => {
    if (typeof id !== 'string' || !id || ids.has(id)) return false
    ids.add(id)
    return true
  }
  if (
    !p.units.every(
      (u) =>
        u &&
        idValid(u.id) &&
        typeof u.title === 'string' &&
        !!u.title.trim() &&
        SUBJECTS.includes(u.subject),
    )
  )
    return fail()
  if (
    !p.outcomes.every(
      (o) =>
        o &&
        idValid(o.id) &&
        p.units.some((u) => u.id === o.unitId) &&
        typeof o.title === 'string' &&
        !!o.title.trim() &&
        typeof o.description === 'string',
    )
  )
    return fail()
  if (
    !p.lessons.every(
      (l) =>
        l &&
        idValid(l.id) &&
        typeof l.title === 'string' &&
        !!l.title.trim() &&
        SUBJECTS.includes(l.subject) &&
        Array.isArray(l.outcomeIds) &&
        new Set(l.outcomeIds).size === l.outcomeIds.length &&
        l.outcomeIds.every((id) => p.outcomes.some((o) => o.id === id)) &&
        typeof l.notes === 'string' &&
        typeof l.assessment === 'string' &&
        Number.isInteger(l.periods) &&
        l.periods >= 1 &&
        l.periods <= 12 &&
        STATUSES.includes(l.status) &&
        (l.date === '' || validDate(l.date)) &&
        Array.isArray(l.resources) &&
        l.resources.every(
          (r) =>
            r &&
            idValid(r.id) &&
            typeof r.title === 'string' &&
            !!r.title.trim() &&
            typeof r.selection === 'string' &&
            ['PDF', 'Slides', 'Link'].includes(r.kind) &&
            typeof r.url === 'string' &&
            !!resourceUrl(r),
        ),
    )
  )
    return fail()
  return p
}
export function datesSpan(start: string, end: string) {
  return Math.round(
    (parseDate(end).getTime() - parseDate(start).getTime()) / 86400000,
  )
}
export function formatDate(
  date: string,
  options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' },
) {
  return new Intl.DateTimeFormat('en-CA', {
    ...options,
    timeZone: 'UTC',
  }).format(parseDate(date))
}
export function samplePlan(): Plan {
  return {
    version: 1,
    units: [
      { id: 'matter', title: 'Exploring matter', subject: 'Science' },
      {
        id: 'numbers',
        title: 'Making sense of numbers',
        subject: 'Mathematics',
      },
      { id: 'stories', title: 'Stories & sentences', subject: 'Language Arts' },
    ],
    outcomes: [
      {
        id: 'changes',
        unitId: 'matter',
        title: 'Reversible & permanent changes',
        description:
          'Explore how materials change and describe whether a change can be reversed.',
      },
      {
        id: 'properties',
        unitId: 'matter',
        title: 'Properties of materials',
        description:
          'Compare and sort materials using their observable properties.',
      },
      {
        id: 'states',
        unitId: 'matter',
        title: 'Solids, liquids & gases',
        description:
          'Investigate states of matter through observations and familiar examples.',
      },
      {
        id: 'sources',
        unitId: 'matter',
        title: 'Materials & their sources',
        description: 'Connect processed materials with their natural sources.',
      },
      {
        id: 'place',
        unitId: 'numbers',
        title: 'Place-value reasoning',
        description: 'Represent, compare, and order numbers using place value.',
      },
      {
        id: 'sentence',
        unitId: 'stories',
        title: 'Building clear sentences',
        description: 'Create sentences that communicate complete ideas.',
      },
    ],
    lessons: [
      {
        id: 'investigate',
        title: 'What happens when materials change?',
        subject: 'Science',
        outcomeIds: ['changes', 'properties'],
        notes:
          'Invite predictions. Compare a folded sheet of paper with a torn sheet. Sort examples into changes we can and cannot reverse.',
        assessment:
          'Can students explain their sorting using evidence from the material?',
        periods: 1,
        status: 'Planned',
        date: '2026-11-02',
        resources: [],
      },
      {
        id: 'ice',
        title: 'The melting ice investigation',
        subject: 'Science',
        outcomeIds: ['changes', 'states'],
        notes:
          'Observe ice as it melts. Draw and describe the changes, then discuss how we could make it solid again.',
        assessment: 'Look for explanations that connect melting and freezing.',
        periods: 1,
        status: 'Planned',
        date: '',
        resources: [],
      },
      {
        id: 'sort',
        title: 'A material sorting challenge',
        subject: 'Science',
        outcomeIds: ['properties'],
        notes:
          'Small groups sort a collection of safe classroom materials. Compare the rules each group used.',
        assessment:
          'Ask each group to justify one material choice using observable properties.',
        periods: 1,
        status: 'Planned',
        date: '2026-11-04',
        resources: [],
      },
      {
        id: 'compare',
        title: 'Build it. Compare it. Explain it.',
        subject: 'Mathematics',
        outcomeIds: ['place'],
        notes:
          'Use base-ten blocks to represent two numbers. Compare them and explain which place helped you decide.',
        assessment:
          'Listen for reasoning about digit value rather than the number of digits alone.',
        periods: 1,
        status: 'Planned',
        date: '2026-11-02',
        resources: [],
      },
      {
        id: 'numberline',
        title: 'Our classroom number line',
        subject: 'Mathematics',
        outcomeIds: ['place'],
        notes:
          'Place number cards on a shared number line and explain their relative positions.',
        assessment: 'Use a quick exit question to check place-value reasoning.',
        periods: 1,
        status: 'Planned',
        date: '2026-11-03',
        resources: [],
      },
      {
        id: 'sentences',
        title: 'A sentence worth sharing',
        subject: 'Language Arts',
        outcomeIds: ['sentence'],
        notes:
          'Build a sentence from a classroom photograph. Revise it with a partner to make the meaning clearer.',
        assessment:
          'Notice whether each sentence communicates a complete idea.',
        periods: 1,
        status: 'Planned',
        date: '2026-11-05',
        resources: [],
      },
    ],
    calendar: {
      start: '2026-11-02',
      end: '2026-12-18',
      periodMinutes: 40,
      exclusions: [{ date: '2026-11-11', label: 'Remembrance Day (sample)' }],
      timetable: {
        Science: [1, 0, 1, 0, 1],
        Mathematics: [1, 1, 1, 1, 1],
        'Language Arts': [2, 2, 2, 2, 2],
      },
    },
  }
}

export type CurriculumTarget = { kind: 'unit' | 'outcome'; id: string }
export function removeCurriculum(plan: Plan, target: CurriculumTarget): Plan {
  const removed = new Set(
    plan.outcomes
      .filter((o) =>
        target.kind === 'unit' ? o.unitId === target.id : o.id === target.id,
      )
      .map((o) => o.id),
  )
  return {
    ...plan,
    units:
      target.kind === 'unit'
        ? plan.units.filter((u) => u.id !== target.id)
        : plan.units,
    outcomes: plan.outcomes.filter((o) => !removed.has(o.id)),
    lessons: plan.lessons.map((l) => ({
      ...l,
      outcomeIds: l.outcomeIds.filter((id) => !removed.has(id)),
    })),
  }
}
