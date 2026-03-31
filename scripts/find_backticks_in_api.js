const fs = require('fs')
const path = require('path')

function walk(dir, cb) {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const e of entries) {
    const full = path.join(dir, e.name)
    if (e.isDirectory()) walk(full, cb)
    else cb(full)
  }
}

function report() {
  const root = path.join(__dirname, '..', 'pages', 'api')
  if (!fs.existsSync(root)) {
    console.error('pages/api not found')
    process.exit(1)
  }

  const results = []
  walk(root, file => {
    if (!file.endsWith('.js') && !file.endsWith('.jsx') && !file.endsWith('.ts') && !file.endsWith('.tsx')) return
    const content = fs.readFileSync(file, 'utf8')
    const lines = content.split(/\r?\n/)
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (line.includes('`')) {
        results.push({ file, line: i+1, text: line.trim() })
      }
    }
  })

  if (results.length === 0) {
    console.log('No backticks found in pages/api JavaScript/TypeScript files.')
    return
  }

  console.log(`Found ${results.length} backtick occurrences in pages/api:`)
  results.forEach(r => {
    console.log(`${r.file}:${r.line}: ${r.text}`)
  })
}

report()
