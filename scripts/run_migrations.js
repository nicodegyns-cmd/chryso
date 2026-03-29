const fs = require('fs')
const path = require('path')
const { getPool } = require('../services/db')

async function run() {
  const pool = getPool()
  const sqlDir = path.join(__dirname, '..', 'sql')
  const files = fs.readdirSync(sqlDir).filter(f => f.endsWith('.sql')).sort()

  try {
    for (const file of files) {
      const sqlPath = path.join(sqlDir, file)
      let sql = fs.readFileSync(sqlPath, 'utf8')

      // Remove backticks (MySQL identifier quoting) to avoid immediate syntax errors
      sql = sql.replace(/`/g, '')

      // Convert multi-line or non-standard RENAME COLUMN IF EXISTS into a safe DO-block.
      // We scan lines to find a RENAME COLUMN IF EXISTS and the preceding ALTER TABLE line.
      const lines = sql.split('\n')
      for (let idx = 0; idx < lines.length; idx++) {
        const renameMatch = lines[idx].match(/RENAME\s+COLUMN\s+IF\s+EXISTS\s+["`]?([A-Za-z0-9_]+)["`]?\s+TO\s+["`]?([A-Za-z0-9_]+)["`]?/i)
        if (renameMatch) {
          // search upward for ALTER TABLE <table>
          let j = idx - 1
          let table = null
          while (j >= 0) {
            const m = lines[j].match(/ALTER\s+TABLE\s+["`]?([A-Za-z0-9_]+)["`]??/i)
            if (m) { table = m[1]; break }
            j--
          }
          if (table) {
            const oldCol = renameMatch[1]
            const newCol = renameMatch[2]
            const doBlock = `DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='${table}' AND column_name='${oldCol}') THEN ALTER TABLE ${table} RENAME COLUMN ${oldCol} TO ${newCol}; END IF; END $$;`
            // replace from ALTER TABLE line (j) through rename line (idx) with the doBlock
            lines.splice(j, idx - j + 1, doBlock)
            idx = j // continue after replacement
          }
        }
      }
      sql = lines.join('\n')

      // Remove lines that are full-line comments starting with --
      sql = sql.split('\n').filter(line => !line.trim().startsWith('--')).join('\n')

      // Split statements on semicolon but ignore semicolons inside
      // single/double-quoted strings and dollar-quoted blocks ($$...$$).
      function splitSqlStatements(src) {
        const stmts = []
        let cur = ''
        let inSingle = false
        let inDouble = false
        let inDollar = false
        let i = 0
        while (i < src.length) {
          const ch = src[i]
          const next2 = src.slice(i, i + 2)
          if (!inSingle && !inDouble && next2 === '$$') {
            inDollar = !inDollar
            cur += '$$'
            i += 2
            continue
          }
          if (!inDollar && ch === "'") {
            inSingle = !inSingle
            cur += ch
            i++
            continue
          }
          if (!inDollar && ch === '"') {
            inDouble = !inDouble
            cur += ch
            i++
            continue
          }
          if (!inSingle && !inDouble && !inDollar && ch === ';') {
            const trimmed = cur.trim()
            if (trimmed) stmts.push(trimmed + ';')
            cur = ''
            i++
            continue
          }
          cur += ch
          i++
        }
        if (inDollar) {
          // Auto-close an unterminated $$ block to avoid split errors
          cur += '$$'
        }
        if (cur.trim()) {
          // if file ends without semicolon, preserve as-is (no trailing semicolon)
          stmts.push(cur.trim())
        }
        return stmts
      }

      const statements = splitSqlStatements(sql)

      console.log(`Running file: ${file} (${statements.length} statements)`)      

      // First try executing the whole file at once (handles DO $$ ... $$ blocks reliably).
      try {
        await pool.query(sql)
        console.log(`  File ${file} executed as single batch.`)
        continue
      } catch (batchErr) {
        console.warn(`  Batch execution failed for ${file}, falling back to per-statement execution:`, batchErr && batchErr.message ? batchErr.message : batchErr)
      }

      for (let i = 0; i < statements.length; i++) {
        const stmt = statements[i]
        const short = stmt.length > 200 ? stmt.slice(0, 200) + '...' : stmt
        console.log(`  Executing ${file} statement ${i + 1}/${statements.length}: ${short}`)
        try {
          await pool.query(stmt)
        } catch (e) {
          console.error(`Error in file ${file} statement ${i + 1}:`, e && e.message ? e.message : e)
          console.error('Full statement:\n', stmt)
          await pool.end()
          process.exit(1)
        }
      }
    }

    console.log('Migrations applied (all files).')
    await pool.end()
    process.exit(0)
  } catch (err) {
    console.error('Migration runner failed', err)
    try { await pool.end() } catch (_) {}
    process.exit(1)
  }
}

run()
