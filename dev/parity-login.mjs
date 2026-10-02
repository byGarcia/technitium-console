import { chromium } from 'playwright'
const b = await chromium.launch()

async function ours(p) {
  await p.goto('http://127.0.0.1:5380/', { waitUntil: 'networkidle' })
  const r = {}
  await p.getByRole('button', { name: 'Login' }).click()
  await p.waitForTimeout(400)
  r.noUser = (await p.locator('[role=alert]').innerText()).replace(/\s+/g, ' ').trim()
  await p.getByLabel('Username').fill('admin')
  await p.getByRole('button', { name: 'Login' }).click()
  await p.waitForTimeout(400)
  r.noPass = (await p.locator('[role=alert]').innerText()).replace(/\s+/g, ' ').trim()
  await p.getByLabel('Password').fill('wrong-password')
  await p.getByRole('button', { name: 'Login' }).click()
  await p.waitForTimeout(2000)
  r.wrong = (await p.locator('[role=alert]').innerText()).replace(/\s+/g, ' ').trim()
  return r
}

async function stock(p) {
  await p.goto('http://127.0.0.1:5381/', { waitUntil: 'networkidle' })
  const r = {}
  const alert = async () => (await p.locator('#divAlert, .alert').first().innerText()).replace(/\s+/g,' ').trim()
  await p.click('#btnLogin'); await p.waitForTimeout(400); r.noUser = await alert()
  await p.fill('#txtUser', 'admin'); await p.click('#btnLogin'); await p.waitForTimeout(400); r.noPass = await alert()
  await p.fill('#txtPass', 'wrong-password'); await p.click('#btnLogin'); await p.waitForTimeout(2000); r.wrong = await alert()
  return r
}

const p1 = await b.newPage(); const n = await ours(p1)
const p2 = await b.newPage(); const s = await stock(p2)

let ok = true
for (const k of ['noUser', 'noPass', 'wrong']) {
  const same = n[k] === s[k]
  if (!same) ok = false
  console.log(`${same ? 'SAME     ' : 'DIFFERENT'} ${k}`)
  console.log(`   ours:  ${n[k]}`)
  console.log(`   stock: ${s[k]}`)
}
console.log(ok ? '\n=> MESSAGE PARITY: OK' : '\n=> THERE ARE DIVERGENCES')
await b.close()
