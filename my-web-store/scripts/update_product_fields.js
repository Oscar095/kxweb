const db = require('../server/db');

async function main() {
  const argv = process.argv.slice(2);
  const id = Number(argv[0] || 11);
  const cantidad = Number(argv[1] || 1000);
  const img = argv[2] || '/images/sample.jpg';
  if (!Number.isFinite(id)) return console.error('ID inválido');
  try {
    await db.ensureSchema();
    const imagesJson = JSON.stringify([img]);
    const sql = `UPDATE dbo.products SET cantidad = @cantidad, images = @images, image2 = @image2, image3 = @image3, image4 = @image4 WHERE id = @id; SELECT @@ROWCOUNT as affected;`;
    const params = { id, cantidad, images: imagesJson, image2: '', image3: '', image4: '' };
    const r = await db.query(sql, params);
    const affected = r[0] && r[0].affected ? Number(r[0].affected) : 0;
    console.log('updated rows:', affected);
    process.exit(0);
  } catch (e) {
    console.error('error', e);
    process.exit(2);
  }
}

main();
