import test from 'node:test'
import assert from 'node:assert/strict'
import {
  samplePlan,
  termCapacity,
  capacity,
  moveLesson,
  coverage,
  validatePlan,
  resourceUrl,
  driveFileId,
  addDays,
  validDate,
  monday,
} from '../src/model.ts'

test('sample plan round-trips through a validated backup', () => {
  const plan = samplePlan()
  assert.deepEqual(validatePlan(JSON.parse(JSON.stringify(plan))), plan)
})
test('capacity uses the subject timetable, weekdays, exclusions and inclusive term boundaries', () => {
  const calendar = samplePlan().calendar
  assert.equal(termCapacity('Science', calendar), 20)
  assert.equal(termCapacity('Mathematics', calendar), 34)
  assert.equal(termCapacity('Language Arts', calendar), 68)
  assert.equal(capacity('2026-11-11', 'Science', calendar), 0)
  assert.equal(capacity('2026-11-03', 'Science', calendar), 0)
  assert.equal(capacity('2026-11-07', 'Mathematics', calendar), 0)
  assert.equal(capacity('2026-12-21', 'Mathematics', calendar), 0)
  assert.equal(
    termCapacity('Science', {
      ...calendar,
      start: '2026-11-02',
      end: '2026-11-02',
    }),
    1,
  )
})
test('moving a shared card changes one record and preserves all outcome connections', () => {
  const plan = samplePlan()
  const next = moveLesson(plan, 'investigate', '2026-11-06')
  assert.equal(next.lessons.length, plan.lessons.length)
  assert.equal(
    next.lessons.find((l) => l.id === 'investigate').date,
    '2026-11-06',
  )
  assert.deepEqual(
    next.lessons.find((l) => l.id === 'investigate').outcomeIds,
    ['changes', 'properties'],
  )
  assert.equal(
    plan.lessons.find((l) => l.id === 'investigate').date,
    '2026-11-02',
  )
  assert.equal(
    moveLesson(next, 'investigate', '').lessons.find(
      (l) => l.id === 'investigate',
    ).date,
    '',
  )
  assert.throws(
    () => moveLesson(plan, 'investigate', '2026-11-11'),
    /teaching day/,
  )
  assert.throws(
    () => moveLesson(plan, 'investigate', '2026-11-07'),
    /teaching day/,
  )
  assert.throws(
    () => moveLesson(plan, 'investigate', '2027-01-04'),
    /teaching day/,
  )
})
test('coverage tracks learning stages from linked cards without implying completion', () => {
  const plan = samplePlan()
  assert.deepEqual(coverage('changes', plan.lessons), ['Planned'])
  plan.lessons[0].status = 'Taught'
  assert.deepEqual(coverage('changes', plan.lessons), ['Planned', 'Taught'])
  assert.deepEqual(coverage('properties', plan.lessons), ['Planned', 'Taught'])
  assert.deepEqual(coverage('sources', plan.lessons), [])
})
test('backup validation rejects dangling outcomes, duplicate identities, unsafe links and invalid calendars', () => {
  for (const mutate of [
    (p) => p.lessons[0].outcomeIds.push('missing'),
    (p) => p.lessons[0].outcomeIds.push('changes'),
    (p) => p.lessons.push({ ...p.lessons[0] }),
    (p) => (p.calendar.end = '2026-02-30'),
    (p) => (p.calendar.end = '2030-12-31'),
    (p) => (p.calendar.timetable.Science[0] = -1),
    (p) => (p.lessons[0].periods = 0),
    (p) =>
      p.lessons[0].resources.push({
        id: 'r',
        title: 'Unsafe',
        url: 'javascript:alert(1)',
        kind: 'Link',
        selection: '',
      }),
  ]) {
    const p = samplePlan()
    mutate(p)
    assert.throws(() => validatePlan(p))
  }
})
test('calendar changes preserve cards for teacher-led rescheduling', () => {
  const plan = samplePlan()
  plan.calendar.exclusions.push({ date: '2026-11-02', label: 'PD day' })
  assert.equal(validatePlan(plan).lessons[0].date, '2026-11-02')
  assert.equal(capacity('2026-11-02', 'Science', plan.calendar), 0)
})
test('resource references preserve original URLs and reject executable schemes', () => {
  const url =
    'https://docs.google.com/presentation/d/abc_123/edit#slide=id.example'
  assert.equal(resourceUrl({ url }), url)
  assert.equal(driveFileId(url), 'abc_123')
  assert.equal(
    driveFileId('https://drive.google.com/open?id=file123'),
    'file123',
  )
  assert.equal(driveFileId('https://example.com/d/not-drive'), undefined)
  assert.equal(resourceUrl({ url: 'data:text/html,hello' }), null)
})
test('date arithmetic is stable across month, year and daylight-saving boundaries', () => {
  assert.equal(addDays('2026-12-31', 1), '2027-01-01')
  assert.equal(addDays('2026-11-01', 1), '2026-11-02')
  assert.equal(monday('2026-11-08'), '2026-11-02')
  assert.equal(validDate('2026-02-30'), false)
})

test('removing an outcome detaches references without deleting shared cards', async () => {
  const { removeCurriculum } = await import('../src/model.ts')
  const plan = removeCurriculum(samplePlan(), {
    kind: 'outcome',
    id: 'changes',
  })
  assert.equal(plan.lessons.length, 6)
  assert.deepEqual(plan.lessons[0].outcomeIds, ['properties'])
  assert.equal(plan.outcomes.length, 5)
  assert.doesNotThrow(() => validatePlan(plan))
})
test('removing a unit keeps planning cards and unrelated curriculum', async () => {
  const { removeCurriculum } = await import('../src/model.ts')
  const plan = removeCurriculum(samplePlan(), { kind: 'unit', id: 'matter' })
  assert.equal(plan.lessons.length, 6)
  assert.deepEqual(plan.lessons[0].outcomeIds, [])
  assert.equal(plan.outcomes.length, 2)
  assert.equal(plan.units.length, 2)
  assert.doesNotThrow(() => validatePlan(plan))
})
