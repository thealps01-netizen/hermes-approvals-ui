/**
 * Launcher for the measured render gate — resolves the Electron binary instead of pasting a path.
 *
 *   node shot.mjs preview.html preview.png
 *   PA_CONTRAST_CANARY=1 node shot.mjs preview.html canary.png
 *
 * Why it exists: the gate used to be started with the machine's own
 * `"$LOCALAPPDATA/hermes/hermes-agent/apps/desktop/node_modules/electron/dist/electron.exe"`, which
 * exists on exactly one machine. The binary is looked up through HERMES_ELECTRON first, then the
 * core checkout's own Electron (see `env.mjs`).
 *
 * The page and output arguments stay RELATIVE: `shot.cjs` loads them inside Electron, and an MSYS
 * absolute path like /c/Users/... arrives there as C:\c\Users\... and `loadFile` dies with
 * ERR_FILE_NOT_FOUND.
 */
import { spawnSync } from 'node:child_process'
import { electronBinary } from './env.mjs'

const [page, out] = process.argv.slice(2)
if (!page || !out) {
  console.error('usage: node shot.mjs <page.html> <out.png>   (relative paths)')
  process.exit(2)
}

const binary = electronBinary()
if (!binary) {
  console.error('no Electron binary found — set HERMES_ELECTRON to the electron executable, '
    + 'or point HERMES_AGENT_DIR at a core checkout with apps/desktop/node_modules installed')
  process.exit(2)
}

const done = spawnSync(binary, ['shot.cjs', page, out], { stdio: 'inherit', env: process.env })
process.exit(done.status === null ? 1 : done.status)
