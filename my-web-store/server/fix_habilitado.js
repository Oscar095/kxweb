// One-time fix: ensure habilitado column exists and set all products to habilitado = 1
// Run this once: node server/fix_habilitado.js
const db = require('./db');

(async () => {
  try {
    const pool = await db.getPool();
    console.log('Connected to database');
    
    // Ensure the column exists first
    await pool.request().query(`
      IF COL_LENGTH('dbo.products','habilitado') IS NULL
      BEGIN
        ALTER TABLE dbo.products ADD habilitado BIT NOT NULL CONSTRAINT DF_products_habilitado DEFAULT (1);
      END
    `);
    console.log('Column habilitado ensured');
    
    // Set all products to enabled
    const result = await db.query('UPDATE dbo.products SET habilitado = 1; SELECT @@ROWCOUNT AS affected;');
    const affected = result && result[0] && result[0].affected;
    console.log(`Done! ${affected} products set to habilitado = 1`);
    process.exit(0);
  } catch (e) {
    console.error('Error:', e.message);
    process.exit(1);
  }
})();
