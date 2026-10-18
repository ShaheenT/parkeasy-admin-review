import { Given, Then, When } from '@cucumber/cucumber'
import { expect } from '@playwright/test'
import type { AppWorld } from '../support/hooks'

const login = async (w: AppWorld, email: string, pw: string) => {
  await w.page.getByTestId('email').fill(email)
  await w.page.getByTestId('password').fill(pw)
  await w.page.getByTestId('login-submit').click()
}
const row = (w: AppWorld, text: string) => w.page.getByTestId('row').filter({ hasText: text })

Given('I am on the login page', async function (this: AppWorld) { await this.page.goto('/') })
Given('I am signed in as an admin', async function (this: AppWorld) {
  await this.page.goto('/'); await login(this, 'admin@parkeasy.co.za', 'admin123')
  await expect(this.page.getByTestId('dashboard')).toBeVisible()
})
When('I sign in as {string} with password {string}', async function (this: AppWorld, e: string, p: string) { await login(this, e, p) })
When('I log out', async function (this: AppWorld) { await this.page.getByTestId('logout').click() })
When('I open {string} from the sidebar', async function (this: AppWorld, name: string) {
  await this.page.getByRole('link', { name, exact: true }).click()
  await expect(this.page.getByTestId('page-title')).toHaveText(name)
})
When('I filter by {string}', async function (this: AppWorld, s: string) { await this.page.getByTestId(`filter-${s}`).click() })
When('I click {string} on the row containing {string}', async function (this: AppWorld, action: string, text: string) {
  await row(this, text).getByRole('button', { name: action }).click()
})

Then('I should see the {string} page', async function (this: AppWorld, title: string) { await expect(this.page.getByTestId('page-title')).toHaveText(title) })
Then('I should see the login page', async function (this: AppWorld) { await expect(this.page.getByTestId('login-submit')).toBeVisible() })
Then('I should see the error {string}', async function (this: AppWorld, msg: string) { await expect(this.page.getByTestId('login-error')).toHaveText(msg) })
Then('the row containing {string} should show status {string}', async function (this: AppWorld, text: string, s: string) {
  await expect(row(this, text).locator('.chip').last()).toHaveText(s)
})
Then('every visible row should have status {string}', async function (this: AppWorld, s: string) {
  const chips = this.page.getByTestId('row').locator('.chip')
  const n = await chips.count(); expect(n).toBeGreaterThan(0)
  for (let i = 0; i < n; i++) await expect(chips.nth(i)).toHaveText(s)
})
