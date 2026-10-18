import { After, AfterAll, Before, BeforeAll, setDefaultTimeout, setWorldConstructor, World } from '@cucumber/cucumber'
import { chromium, type Browser, type BrowserContext, type Page } from '@playwright/test'

setDefaultTimeout(30_000)
let browser: Browser
export const BASE_URL = process.env.BASE_URL ?? 'http://127.0.0.1:5173'

export class AppWorld extends World {
  context!: BrowserContext
  page!: Page
}
setWorldConstructor(AppWorld)

BeforeAll(async () => { browser = await chromium.launch() })
Before(async function (this: AppWorld) {
  this.context = await browser.newContext({ baseURL: BASE_URL })
  this.page = await this.context.newPage()
})
After(async function (this: AppWorld) { await this.context.close() })
AfterAll(async () => { await browser.close() })
