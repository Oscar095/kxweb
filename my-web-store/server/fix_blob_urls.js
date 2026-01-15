/*
  Script to fix stored blob URLs that contain '%2F' instead of '/'.
  It updates dbo.banco_imagenes.url_blob and dbo.library.url replacing '%2F' -> '/'.
  Run: node server/fix_blob_urls.js
*/

require('dotenv').config();
const db = require('./db');

async function fixTable(table, col) {
  console.log('Checking', table, col);
  const rows = await db.query(`SELECT id, ${col} as url FROM dbo.${table}`);
  let updated = 0;
  for (const r of rows) {
    const url = r.url || '';
    if (url.includes('%2F')) {
      const newUrl = url.replace(/%2F/g, '/');
      await db.query(`UPDATE dbo.${table} SET ${col} = @url WHERE id = @id`, { url: newUrl, id: r.id });
      console.log(`Updated ${table} id=${r.id}: ${url} -> ${newUrl}`);
      updated++;
    }
  }
  console.log(`Done ${table}: updated ${updated} rows.`);
}

(async () => {
  try {
    await db.getPool();
    await fixTable('banco_imagenes', 'url_blob');
    await fixTable('library', 'url');
    console.log('All done');
    process.exit(0);
  } catch (e) {
    console.error('Error fixing urls', e && (e.message || e));
    process.exit(1);
  }
})();
