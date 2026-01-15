require('dotenv').config();
const db = require('./db');
(async()=>{
  console.log('ENV SERVER=', process.env.SERVER ? 'present' : 'missing');
  try{
    const pool = await db.getPool();
    console.log('pool ok');
    const res = await pool.request().query('SELECT 1 as one');
    console.log('query result', res.recordset);
    process.exit(0);
  }catch(e){
    console.error('error connecting', e && (e.message||e));
    process.exit(1);
  }
})();