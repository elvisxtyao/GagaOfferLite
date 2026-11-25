import { readFileSync } from 'node:fs'
import { defineConfig } from '@playwright/test'

const baseURL = process.env.LIVE_URL ?? 'https://gagaofferlite.app.space'
if (!/^https:\/\//.test(baseURL)) throw new Error('LIVE_URL must be the final HTTPS deployment URL.')
const configAppId = readFileSync(new URL('../wrangler.toml', import.meta.url), 'utf8')
  .match(/^DEEPSPACE_APP_ID\s*=\s*"(app_[A-Z0-9]+)"/m)?.[1]
const appId = process.env.LIVE_APP_ID ?? configAppId
if (!appId || !/^app_[A-Z0-9]+$/.test(appId)) throw new Error('Set LIVE_APP_ID or use a registered checkout.')
process.env.LIVE_APP_ID = appId

export default defineConfig({
  testDir: '.',
  testMatch: 'lite-live.spec.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 180_000,
  expect: { timeout: 20_000 },
  reporter: 'list',
  use: {
    baseURL,
    browserName: 'chromium',
    channel: process.env.LIVE_BROWSER_CHANNEL ?? 'chrome',
    headless: true,
    trace: 'off',
    video: 'off',
    screenshot: 'off',
  },
  // This suite runs against the deployed app. It never starts a local server.
})
