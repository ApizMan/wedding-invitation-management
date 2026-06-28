// Copies frontend/ and public/ into lib/ so __dirname-relative paths in the
// compiled backend code (lib/src/backend/...) resolve the same way they do
// in local dev (dist/ sibling to frontend/ and public/ at the project root).
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const LIB = path.join(__dirname, 'lib');

for (const dir of ['frontend', 'public']) {
  fs.cpSync(path.join(ROOT, dir), path.join(LIB, dir), { recursive: true });
}
