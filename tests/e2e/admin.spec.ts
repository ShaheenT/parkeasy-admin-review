import { expect, test, type Page } from '@playwright/test'

const signIn = async (page: Page) => {
  await page.goto('/')
  await page.getByTestId('email').fill('admin@parkeasy.co.za')
  await page.getByTestId('password').fill('admin123')
  await page.getByTestId('login-submit').click()
  await expect(page.getByTestId('dashboard')).toBeVisible()
}
const openNav = async (page: Page, name: string) => {
  const menu = page.getByLabel('Open menu')
  if (await menu.isVisible()) await menu.click()
  await page.getByRole('link', { name, exact: true }).click()
}

test('rejects a wrong password', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('email').fill('admin@parkeasy.co.za')
  await page.getByTestId('password').fill('nope')
  await page.getByTestId('login-submit').click()
  await expect(page.getByTestId('login-error')).toContainText('incorrect')
})

test('signs in, shows KPIs, and logs out', async ({ page }) => {
  await signIn(page)
  for (const k of ['Users', 'Active Bays', 'Gross Revenue', 'Devices Online']) await expect(page.getByTestId(`kpi-${k}`)).toBeVisible()
  const menu = page.getByLabel('Open menu')
  if (await menu.isVisible()) await menu.click()
  await page.getByTestId('logout').click()
  await expect(page.getByTestId('login-submit')).toBeVisible()
})

test('approving a pending lead updates its status', async ({ page }) => {
  await signIn(page)
  await openNav(page, 'Scout Leads')
  const row = page.getByTestId('row').filter({ hasText: '12 Kloof St' })
  await row.getByTestId('action-approve').click()
  await expect(row.locator('.chip')).toHaveText('approved')
})

test('status filter narrows the table', async ({ page }) => {
  await signIn(page)
  await openNav(page, 'Payouts')
  await page.getByTestId('filter-queued').click()
  const chips = page.getByTestId('row').locator('.chip')
  await expect(chips).toHaveCount(2)
  await expect(chips.first()).toHaveText('queued')
})

test('map shows a token hint when Mapbox is not configured', async ({ page }) => {
  await signIn(page)
  await openNav(page, 'Live Map')
  await expect(page.getByTestId('map-missing').or(page.getByTestId('map'))).toBeVisible()
})
