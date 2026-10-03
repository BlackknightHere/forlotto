// Local server: stores all data in data/db.json and serves the built app from dist/
import express from 'express'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { exec } from 'node:child_process'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DATA_DIR = path.join(ROOT, 'data')
const BACKUP_DIR = path.join(DATA_DIR, 'backups')
const DB_FILE = path.join(DATA_DIR, 'db.json')
const DIST_DIR = path.join(ROOT, 'dist')
const PORT = Number(process.env.LOTTO_PORT) || 5178
const KEEP_BACKUPS = 60
const BACKUP_EVERY_HOURS = 3

fs.mkdirSync(BACKUP_DIR, { recursive: true })

const emptyData = () => ({ events: [], entries: [], settings: {} })

function load() {
  if (!fs.existsSync(DB_FILE)) return { version: 0, data: emptyData() }
  try {
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'))
  } catch (err) {
    const broken = DB_FILE + '.broken-' + Date.now()
    fs.copyFileSync(DB_FILE, broken)
    console.error(`อ่านไฟล์ข้อมูลไม่ได้ สำรองไฟล์เดิมไว้ที่ ${broken}`, err)
    return { version: 0, data: emptyData() }
  }
}

const pad2 = (n) => String(n).padStart(2, '0')

// One backup per BACKUP_EVERY_HOURS window, named by local (Thai) time, e.g. db-2026-10-03_12.json
function backupSlot() {
  if (!fs.existsSync(DB_FILE)) return
  const d = new Date()
  const slot = Math.floor(d.getHours() / BACKUP_EVERY_HOURS) * BACKUP_EVERY_HOURS
  const name = `db-${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}_${pad2(slot)}.json`
  const target = path.join(BACKUP_DIR, name)
  if (fs.existsSync(target)) return
  fs.copyFileSync(DB_FILE, target)
  const old = fs.readdirSync(BACKUP_DIR).filter((f) => f.startsWith('db-')).sort()
  for (const f of old.slice(0, Math.max(0, old.length - KEEP_BACKUPS))) {
    fs.rmSync(path.join(BACKUP_DIR, f))
  }
}

function save(state) {
  backupSlot()
  const tmp = DB_FILE + '.tmp'
  fs.writeFileSync(tmp, JSON.stringify(state))
  try {
    fs.renameSync(tmp, DB_FILE)
  } catch {
    fs.writeFileSync(DB_FILE, JSON.stringify(state))
    fs.rmSync(tmp, { force: true })
  }
}

let state = load()

const app = express()
app.use(express.json({ limit: '100mb' }))

app.get('/api/db', (_req, res) => res.json(state))

app.put('/api/db', (req, res) => {
  const { version, data } = req.body ?? {}
  if (!data || typeof data !== 'object') return res.status(400).json({ error: 'invalid data' })
  if (version !== state.version) return res.status(409).json(state)
  const next = { version: state.version + 1, data }
  try {
    save(next)
  } catch (err) {
    console.error('บันทึกข้อมูลไม่สำเร็จ', err)
    return res.status(500).json({ error: String(err) })
  }
  state = next
  res.json({ version: state.version })
})

if (fs.existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR))
  app.get('*', (_req, res) => res.sendFile(path.join(DIST_DIR, 'index.html')))
}

const url = `http://localhost:${PORT}`
const openBrowser = () => {
  const cmd = process.platform === 'win32' ? `start "" "${url}"` : process.platform === 'darwin' ? `open ${url}` : `xdg-open ${url}`
  exec(cmd)
}

const server = app.listen(PORT, '127.0.0.1', () => {
  console.log(`\n  หวยลุงแมว พร้อมใช้งานที่ ${url}`)
  console.log(`  ข้อมูลเก็บอยู่ที่ ${DB_FILE}`)
  console.log('  (ปิดหน้าต่างนี้ = ปิดโปรแกรม)\n')
  if (process.argv.includes('--open')) openBrowser()
})

server.on('error', (err) => {
  if (err.code !== 'EADDRINUSE') throw err
  // Already running (e.g. 2-open-app.bat double-clicked twice): just show the existing app.
  console.log(`\n  โปรแกรมเปิดอยู่แล้ว กำลังเปิดหน้าเดิมให้ที่ ${url}`)
  console.log('  หน้าต่างนี้จะปิดเองใน 5 วินาที\n')
  if (process.argv.includes('--open')) openBrowser()
  setTimeout(() => process.exit(0), 5000)
})
