import { execFile as execFileCallback, spawn } from 'node:child_process'
import { mkdir, stat } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

const execFile = promisify(execFileCallback)
const root = path.dirname(fileURLToPath(import.meta.url))
const cacheRoot = path.join(root, '.cache')
const sourceRoot = path.join(cacheRoot, 'deepseek-harness')
const remote = 'https://github.com/deepseek-ai/deepseek-harness.git'

async function exists(target) {
  try { await stat(target); return true } catch { return false }
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: root, stdio: 'inherit' })
    child.on('exit', code => code === 0 ? resolve() : reject(new Error(`${command} exited with ${code}`)))
    child.on('error', reject)
  })
}

await mkdir(cacheRoot, { recursive: true })
if (!await exists(path.join(sourceRoot, '.git'))) {
  await run('git', ['clone', '--depth', '1', '--branch', 'master', '--single-branch', remote, sourceRoot])
} else {
  const { stdout } = await execFile('git', ['-C', sourceRoot, 'remote', 'get-url', 'origin'])
  if (stdout.trim() !== remote) throw new Error(`Refusing to update unexpected origin: ${stdout.trim()}`)
  await run('git', ['-C', sourceRoot, 'fetch', '--depth', '1', 'origin', 'master'])
  await run('git', ['-C', sourceRoot, 'switch', '--detach', 'FETCH_HEAD'])
}

await run(process.execPath, [path.join(root, 'build.mjs'), '--source', sourceRoot])
await run(process.execPath, [path.join(root, 'build.mjs'), '--source', sourceRoot, '--check'])
const { stdout: revision } = await execFile('git', ['-C', sourceRoot, 'rev-parse', 'HEAD'])
console.log(`SYNC OK master @ ${revision.trim()}`)
