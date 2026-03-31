const fs = require('fs');
const path = require('path');

function walk(dir, filelist=[]) {
  const files = fs.readdirSync(dir);
  files.forEach(f => {
    const fp = path.join(dir, f);
    const stat = fs.statSync(fp);
    if (stat.isDirectory()) walk(fp, filelist);
    else if (fp.endsWith('.js')) filelist.push(fp);
  });
  return filelist;
}

function processStringLiteral(literal, isTemplate) {
  const inner = literal.slice(1, -1);
  const sqlKeywords = /\b(SELECT|INSERT|UPDATE|DELETE|VALUES|SET|WHERE|FROM|JOIN)\b/i;
  if (!sqlKeywords.test(inner)) return literal;

  // remove MySQL identifier backticks (escaped and raw)
  let replaced = inner.replace(/\\`/g, '');
  replaced = replaced.replace(/`/g, '');

  // convert ? placeholders to $1..$n sequentially
  let idx = 0;
  replaced = replaced.replace(/\?/g, () => {
    idx += 1;
    return '$' + idx;
  });

  if (isTemplate) return '`' + replaced + '`';
  return "'" + replaced + "'";
}

function convertFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let original = content;
  // match single-quoted strings
  content = content.replace(/'([^'\\]|\\.)*'/g, (m) => processStringLiteral(m, false));
  // match template literals
  content = content.replace(/`([^`\\]|\\.)*`/g, (m) => processStringLiteral(m, true));

  if (content !== original) {
    // backup
    fs.writeFileSync(filePath + '.bak', original, 'utf8');
    fs.writeFileSync(filePath, content, 'utf8');
    return true;
  }
  return false;
}

function main() {
  const base = path.join(process.cwd(), 'pages', 'api');
  if (!fs.existsSync(base)) {
    console.error('pages/api not found in cwd:', process.cwd());
    process.exitCode = 2;
    return;
  }
  const files = walk(base);
  const modified = [];
  files.forEach(f => {
    try {
      const changed = convertFile(f);
      if (changed) modified.push(f);
    } catch (err) {
      console.error('ERROR processing', f, err && err.stack ? err.stack : err);
    }
  });
  console.log('Conversion complete. Files modified:', modified.length);
  modified.forEach(f => console.log(' -', f));
}

main();
