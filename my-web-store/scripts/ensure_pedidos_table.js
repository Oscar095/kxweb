// Run: node scripts/ensure_pedidos_table.js
const db = require('../server/db');

async function main() {
  await db.ensureSchema();
  console.log('OK: ensureSchema ejecutado (incluye dbo.pedidos).');
  process.exit(0);
}

main().catch((e) => {
  console.error('ERROR ejecutando ensureSchema:', e);
  process.exit(1);
});
