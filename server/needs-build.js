// Used by 2-open-app.bat after an update. Exit code: 0 = up to date, 1 = rebuild dist/, 2 = run npm install first (then rebuild).
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const mtime = (p) => (fs.existsSync(p) ? fs.statSync(p).mtimeMs : 0)

function newest(p) {
  if (!fs.existsSync(p)) return 0
  const st = fs.statSync(p)
  if (!st.isDirectory()) return st.mtimeMs
  return Math.max(st.mtimeMs, ...fs.readdirSync(p).map((f) => newest(path.join(p, f))))
}

const lock = mtime(path.join(ROOT, 'package-lock.json'))
const installed = mtime(path.join(ROOT, 'node_modules', '.package-lock.json'))
if (lock > installed) process.exit(2)

const built = mtime(path.join(ROOT, 'dist', 'index.html'))
const sources = Math.max(newest(path.join(ROOT, 'src')), ...['index.html', 'vite.config.js', 'package.json'].map((f) => mtime(path.join(ROOT, f))))
process.exit(sources > built ? 1 : 0)
