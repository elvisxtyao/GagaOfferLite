import { spawnSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { loadAllTestAccounts } from 'deepspace/testing'

const label = 'gagaofferlite-acceptance'
const existing = loadAllTestAccounts().filter(account => account.label === label)
for (let index = existing.length; index < 2; index++) {
  const email = `gagaofferlite-${randomBytes(6).toString('hex')}@deepspace.test`
  const password = randomBytes(30).toString('base64url')
  const result = spawnSync(process.execPath, [
    'node_modules/deepspace/dist/cli.js', 'test', 'accounts', 'create',
    '--email', email, '--name', `Lite Tester ${index + 1}`, '--label', label,
    '--password-stdin', '--json',
  ], { input: `${password}\n`, encoding: 'utf8' })
  if (result.status !== 0) {
    console.error('Test account setup failed; use the official DeepSpace CLI to inspect account availability.')
    process.exit(1)
  }
  console.log(`Created test account ${index + 1}; credentials remain in the DeepSpace local credential store.`)
}
console.log(`Usable acceptance accounts: ${loadAllTestAccounts().filter(account => account.label === label).length}`)
