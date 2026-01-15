require('dotenv').config();
const db = require('./db');
(async()=>{
  try{
    await db.getPool();
    const rows = await db.query('SELECT id,nombre_imagen,url_blob,createdAt FROM dbo.banco_imagenes ORDER BY id');
    console.log('banco_imagenes rows:', JSON.stringify(rows, null, 2));
    const lib = await db.query('SELECT id,nombre,url,createdAt FROM dbo.library ORDER BY id');
    console.log('library rows:', JSON.stringify(lib, null, 2));
    process.exit(0);
  }catch(e){
    console.error('error', e && (e.message||e));
    process.exit(1);
  }
})();