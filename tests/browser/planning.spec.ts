import { test, expect } from '@playwright/test'

test('one shared card stays connected across outcomes, week, teaching and reload', async ({
  page,
}) => {
  await page.goto('/')
  await expect(
    page.getByRole('heading', { name: 'Your curriculum, connected.' }),
  ).toBeVisible()
  await page
    .getByRole('button', { name: 'What happens when materials change?' })
    .first()
    .click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Lesson title').fill('Materials detectives')
  await dialog.getByLabel('Teaching date').fill('2026-11-06')
  await dialog.getByRole('button', { name: 'Add resource link' }).click()
  await dialog.getByLabel('Resource name').fill('My matter workbook')
  await dialog
    .getByLabel('Original file link')
    .fill('https://drive.google.com/file/d/example-resource/view')
  await dialog.getByLabel('Pages or slides').fill('Pages 14–16')
  await dialog.getByRole('button', { name: 'Save planning card' }).click()
  await expect(page.getByText('Saved in this browser')).toBeVisible()
  await page
    .getByRole('button', { name: /Properties of materials.*Compare and sort/ })
    .click()
  await expect(
    page
      .locator('.planning-stack')
      .getByRole('heading', { name: 'Materials detectives' }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Weekly planner' }).click()
  await expect(
    page
      .getByRole('region', { name: /Friday, November 6/ })
      .getByRole('heading', { name: 'Materials detectives' }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Teaching mode', exact: true }).click()
  await page.getByLabel('Teaching date', { exact: true }).fill('2026-11-06')
  await expect(
    page.getByRole('heading', { name: 'Materials detectives' }),
  ).toBeVisible()
  const resource = page.getByRole('link', { name: /My matter workbook/ })
  await expect(resource).toHaveAttribute(
    'href',
    'https://drive.google.com/file/d/example-resource/view',
  )
  await expect(resource).toContainText('Pages 14–16')
  await page
    .getByLabel('Learning stage for Materials detectives')
    .selectOption('Taught')
  await page.reload()
  await page
    .getByRole('button', { name: 'Materials detectives' })
    .first()
    .click()
  await expect(
    page.getByRole('dialog').getByLabel('Learning stage'),
  ).toHaveValue('Taught')
  await expect(
    page.getByRole('dialog').getByLabel('Teaching date'),
  ).toHaveValue('2026-11-06')
})

test('drag scheduling, capacity warnings and calendar exceptions work together', async ({
  page,
}) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Weekly planner' }).click()
  const tuesday = page.getByRole('region', { name: /Tuesday, November 3/ })
  await page.locator('.unscheduled-tray .lesson-card').dragTo(tuesday, {
    sourcePosition: { x: 15, y: 15 },
    targetPosition: { x: 30, y: 320 },
  })
  await expect(
    tuesday.getByRole('heading', { name: 'The melting ice investigation' }),
  ).toBeVisible()
  await expect(tuesday.getByText('Over capacity')).toBeVisible()
  await page.getByRole('button', { name: 'Calendar & timetable' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Day away', { exact: true }).fill('2026-11-03')
  await dialog.getByLabel('Reason').fill('School PD day')
  await dialog.getByRole('button', { name: 'Add day away' }).click()
  await dialog.getByRole('button', { name: 'Save calendar' }).click()
  await expect(page.getByText('2 cards need rescheduling.')).toBeVisible()
  await expect(tuesday.getByText('School PD day')).toBeVisible()
  await expect(
    tuesday.getByRole('heading', { name: 'The melting ice investigation' }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Term overview' }).click()
  await expect(
    page.locator('.capacity-card').filter({ hasText: 'Mathematics' }),
  ).toContainText('/ 33 periods scheduled')
})

test('create curriculum and cards with keyboard controls, filter, and delete', async ({
  page,
}) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Add unit or outcome' }).click()
  let dialog = page.getByRole('dialog')
  await dialog.getByLabel('Unit name').fill('Our new unit')
  await dialog.getByRole('button', { name: 'Add unit', exact: true }).click()
  await page.getByRole('button', { name: /Our new unit/ }).click()
  await page
    .getByRole('button', { name: '＋ Add outcome', exact: true })
    .click()
  dialog = page.getByRole('dialog')
  await dialog.getByLabel('Outcome title').fill('Describe an observation')
  await dialog
    .getByLabel('Outcome wording')
    .fill('Use evidence to explain an observation.')
  await dialog.getByRole('button', { name: 'Add outcome', exact: true }).click()
  await page
    .getByRole('button', { name: /Describe an observation.*Use evidence/ })
    .click()
  await page
    .locator('.planning-stack')
    .getByRole('button', { name: 'Planning card' })
    .click()
  dialog = page.getByRole('dialog')
  await dialog.getByLabel('Lesson title').fill('Observe our classroom')
  await dialog.getByRole('button', { name: 'Save planning card' }).click()
  await page.getByLabel('Find a planning card').fill('Observe our classroom')
  await expect(page.locator('.library-grid .lesson-card')).toHaveCount(1)
  await page
    .locator('.library-grid')
    .getByRole('button', { name: 'Observe our classroom' })
    .click()
  page.once('dialog', (d) => d.accept())
  await page.getByRole('button', { name: 'Delete card' }).click()
  await expect(page.locator('.library-grid .lesson-card')).toHaveCount(0)
})

test('invalid backups and unreadable storage do not destroy the current plan', async ({
  page,
}) => {
  await page.goto('/')
  await page.getByLabel('Import plan backup').setInputFiles({
    name: 'bad.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"version":1}'),
  })
  await expect(page.getByRole('status')).toContainText(
    'not a valid Four Square backup',
  )
  await expect(page.locator('.library-grid .lesson-card')).toHaveCount(6)
  await page.evaluate(() =>
    localStorage.setItem('four-square.plan.v1', '{broken'),
  )
  await page.reload()
  await expect(page.getByRole('alert')).toContainText(
    'has not been overwritten',
  )
  await page.getByRole('button', { name: 'New planning card' }).click()
  await page.getByLabel('Lesson title').fill('Recovery draft')
  await page.getByRole('button', { name: 'Save planning card' }).click()
  expect(
    await page.evaluate(() => localStorage.getItem('four-square.plan.v1')),
  ).toBe('{broken')
  page.once('dialog', (d) => d.accept())
  await page.getByRole('button', { name: 'Use current plan' }).click()
  await expect(page.getByText('Saved in this browser')).toBeVisible()
  expect(
    JSON.parse(
      (await page.evaluate(() =>
        localStorage.getItem('four-square.plan.v1'),
      )) ?? '{}',
    ).lessons,
  ).toHaveLength(7)
})

test('mobile layout keeps navigation and editing usable without page overflow', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true)
  await page.getByRole('button', { name: 'New planning card' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByLabel('Lesson title').fill('A mobile plan')
  await page.getByRole('button', { name: 'Save planning card' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.getByRole('button', { name: 'Weekly planner' }).click()
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true)
})

test('editing and removing curriculum keeps shared lesson records intact', async ({
  page,
}) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Edit outcome', exact: true }).click()
  let dialog = page.getByRole('dialog')
  await dialog.getByLabel('Outcome title').fill('Investigate material changes')
  await dialog
    .getByRole('button', { name: 'Save outcome', exact: true })
    .click()
  await expect(
    page
      .locator('.planning-stack')
      .getByRole('heading', { name: 'Investigate material changes' }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Edit unit', exact: true }).click()
  dialog = page.getByRole('dialog')
  page.once('dialog', (d) => d.accept())
  await dialog.getByRole('button', { name: 'Delete unit', exact: true }).click()
  await expect(page.locator('.library-grid .lesson-card')).toHaveCount(6)
  await page
    .locator('.library-grid')
    .getByRole('button', { name: 'What happens when materials change?' })
    .click()
  await expect(
    page.getByRole('dialog').getByRole('checkbox', { checked: true }),
  ).toHaveCount(0)
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
})

test('exported backup restores a plan after explicit import confirmation', async ({
  page,
}) => {
  await page.goto('/')
  const downloadEvent = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export plan' }).click()
  const download = await downloadEvent
  const backup = await download.path()
  expect(backup).toBeTruthy()
  await page.getByRole('button', { name: 'New planning card' }).click()
  await page.getByLabel('Lesson title').fill('A temporary extra card')
  await page.getByRole('button', { name: 'Save planning card' }).click()
  await expect(page.locator('.library-grid .lesson-card')).toHaveCount(7)
  page.once('dialog', (d) => d.accept())
  await page.getByLabel('Import plan backup').setInputFiles(backup!)
  await expect(page.getByRole('status')).toContainText(
    'Your backup has been imported',
  )
  await expect(page.locator('.library-grid .lesson-card')).toHaveCount(6)
  await page.reload()
  await expect(page.locator('.library-grid .lesson-card')).toHaveCount(6)
})
