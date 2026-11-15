import { test, expect } from '@playwright/test'

test('Google profile sign-in and sign-out preserve local plans without storing tokens', async ({
  page,
}) => {
  test.skip(
    !process.env.VITE_GOOGLE_CLIENT_ID,
    'Requires a configured public client ID',
  )
  await page.route('https://accounts.google.com/gsi/client', (route) =>
    route.fulfill({
      contentType: 'application/javascript',
      body: `window.google = { accounts: { oauth2: { initTokenClient: (options) => ({
      requestAccessToken: () => options.callback({ access_token: 'test-access-token', expires_in: 3600 })
    }) } } };`,
    }),
  )
  await page.route(
    'https://openidconnect.googleapis.com/v1/userinfo',
    (route) =>
      route.fulfill({
        json: {
          sub: 'teacher-123',
          name: 'Example Teacher',
          email: 'teacher@example.com',
        },
      }),
  )
  await page.goto('/')
  await page.getByRole('button', { name: 'New planning card' }).click()
  await page.getByLabel('Lesson title').fill('Keep my local lesson')
  await page.getByRole('button', { name: 'Save planning card' }).click()
  const plan = await page.evaluate(() =>
    localStorage.getItem('four-square.plan.v1'),
  )
  await page.getByRole('button', { name: 'Sign in with Google' }).click()
  await expect(
    page.getByText('teacher@example.com', { exact: true }),
  ).toBeVisible()
  expect(
    await page.evaluate(() =>
      JSON.stringify({ ...localStorage, ...sessionStorage }),
    ),
  ).not.toContain('test-access-token')
  await page.getByRole('button', { name: 'Sign out', exact: true }).click()
  await expect(
    page.getByRole('button', { name: 'Sign in with Google' }),
  ).toBeVisible()
  expect(
    await page.evaluate(() => localStorage.getItem('four-square.plan.v1')),
  ).toBe(plan)
})

test('Google popup errors allow retry', async ({ page }) => {
  test.skip(
    !process.env.VITE_GOOGLE_CLIENT_ID,
    'Requires a configured public client ID',
  )
  await page.route('https://accounts.google.com/gsi/client', (route) =>
    route.fulfill({
      contentType: 'application/javascript',
      body: `window.google = { accounts: { oauth2: { initTokenClient: (options) => ({
      requestAccessToken: () => options.error_callback({ type: 'popup_closed' })
    }) } } };`,
    }),
  )
  await page.goto('/')
  await page.getByRole('button', { name: 'Sign in with Google' }).click()
  await expect(page.getByRole('alert')).toContainText('closed or blocked')
  await expect(
    page.getByRole('button', { name: 'Sign in with Google' }),
  ).toBeEnabled()
})
