import { strict as assert } from 'node:assert'
import { existsSync, readFileSync, readdirSync } from 'node:fs'

assert(existsSync('dist/index.html'), 'dist/index.html não foi criado')
assert.match(readFileSync('dist/index.html', 'utf8'), /<div id="root"><\/div>/)
const assets = readdirSync('dist/assets')
assert(assets.some((file) => file.endsWith('.js')), 'bundle JavaScript ausente')
assert(assets.some((file) => file.endsWith('.css')), 'bundle CSS ausente')
const source = readFileSync('src/main.jsx', 'utf8')
assert.match(source, /field\('sex', 'Sexo', 'select', \{ required: true, default: 'desconhecido'/)
assert.match(source, /vaccines:\s*\{[\s\S]*?fields:\s*\[field\('customer_id', 'Tutor', 'select', \{ required: true, lookup: lookup\('\/customers'/, 'vacinas devem selecionar o tutor antes do pet')
console.log('UI check OK')
