import { strict as assert } from 'node:assert'
import { existsSync, readFileSync, readdirSync } from 'node:fs'

assert(existsSync('dist/index.html'), 'dist/index.html não foi criado')
assert.match(readFileSync('dist/index.html', 'utf8'), /<div id="root"><\/div>/)
const assets = readdirSync('dist/assets')
assert(assets.some((file) => file.endsWith('.js')), 'bundle JavaScript ausente')
assert(assets.some((file) => file.endsWith('.css')), 'bundle CSS ausente')
console.log('UI check OK')
