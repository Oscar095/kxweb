const sql = require('mssql');
require('dotenv').config();

const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.SERVER,
  database: process.env.DB_NAME,
  options: {
    encrypt: true,
    enableArithAbort: true
  }
};

sql.connect(config).then(() => {
    console.log('Connected successfully!');
    process.exit(0);
}).catch(err => {
    console.error('Connection failed with error MESSAGE:', err.message);
    console.error('Connection failed with error CODE:', err.code);
    process.exit(1);
});
