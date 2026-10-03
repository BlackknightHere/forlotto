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
const KEEP_BACKUPS = 30

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

function backupToday() {
  if (!fs.existsSync(DB_FILE)) return
  const day = new Date().toISOString().slice(0, 10)
  const target = path.join(BACKUP_DIR, `db-${day}.json`)
  if (fs.existsSync(target)) return
  fs.copyFileSync(DB_FILE, target)
  const old = fs.readdirSync(BACKUP_DIR).filter((f) => f.startsWith('db-')).sort()
  for (const f of old.slice(0, Math.max(0, old.length - KEEP_BACKUPS))) {
    fs.rmSync(path.join(BACKUP_DIR, f))
  }
}

function save(state) {
  backupToday()
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
  state = { version: state.version + 1, data }
  try {
    save(state)
  } catch (err) {
    console.error('บันทึกข้อมูลไม่สำเร็จ', err)
    return res.status(500).json({ error: String(err) })
  }
  res.json({ version: state.version })
})

if (fs.existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR))
  app.get('*', (_req, res) => res.sendFile(path.join(DIST_DIR, 'index.html')))
}

app.listen(PORT, '127.0.0.1', () => {
  const url = `http://localhost:${PORT}`
  console.log(`\n  หวยลุงแมว พร้อมใช้งานที่ ${url}`)
  console.log(`  ข้อมูลเก็บอยู่ที่ ${DB_FILE}`)
  console.log('  (ปิดหน้าต่างนี้ = ปิดโปรแกรม)\n')
  if (process.argv.includes('--open')) {
    const cmd = process.platform === 'win32' ? `start "" "${url}"` : process.platform === 'darwin' ? `open ${url}` : `xdg-open ${url}`
    exec(cmd)
  }
})
