const sql = require('mssql');
const path = require('path');
const dotenv = require('dotenv');

// Cargar variables desde la raíz del proyecto (independiente del cwd)
dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') });
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.SERVER,
  database: process.env.DB_NAME,
  options: {
    encrypt: true,
    enableArithAbort: true
  },
  pool: { max: 10, min: 0, idleTimeoutMillis: 30000 }
};

let poolPromise = null;

async function getPool() {
  if (!poolPromise) {
    poolPromise = sql.connect(config);
  }
  return poolPromise;
}

async function query(queryText, inputs = {}) {
  const pool = await getPool();
  const req = pool.request();
  for (const [name, val] of Object.entries(inputs)) {
    req.input(name, val);
  }
  const res = await req.query(queryText);
  return res.recordset || [];
}

async function ensureSchema() {
  const pool = await getPool();
  // Create products table
  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[products]') AND type in (N'U'))
    BEGIN
      CREATE TABLE dbo.products (
        id INT IDENTITY(1,1) PRIMARY KEY,
        codigo_siesa NVARCHAR(255) NULL,
        name NVARCHAR(MAX) NULL,
        price_unit FLOAT NULL,
        category INT NULL,
        description NVARCHAR(MAX) NULL,
        images NVARCHAR(MAX) NULL,
        image2 NVARCHAR(MAX) NOT NULL DEFAULT (''),
        image3 NVARCHAR(MAX) NOT NULL DEFAULT (''),
        image4 NVARCHAR(MAX) NOT NULL DEFAULT (''),
        createdAt DATETIME2 DEFAULT SYSUTCDATETIME()
      );
    END
  `);

  // Ensure image2/3/4 columns exist if table pre-existed without them
  await pool.request().query(`
    IF COL_LENGTH('dbo.products','image2') IS NULL
    BEGIN
      ALTER TABLE dbo.products ADD image2 NVARCHAR(MAX) NOT NULL CONSTRAINT DF_products_image2 DEFAULT ('');
    END
  `);
  await pool.request().query(`
    IF COL_LENGTH('dbo.products','image3') IS NULL
    BEGIN
      ALTER TABLE dbo.products ADD image3 NVARCHAR(MAX) NOT NULL CONSTRAINT DF_products_image3 DEFAULT ('');
    END
  `);
  await pool.request().query(`
    IF COL_LENGTH('dbo.products','image4') IS NULL
    BEGIN
      ALTER TABLE dbo.products ADD image4 NVARCHAR(MAX) NOT NULL CONSTRAINT DF_products_image4 DEFAULT ('');
    END
  `);

  // categories
  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[categories]') AND type in (N'U'))
    BEGIN
      CREATE TABLE dbo.categories (
        id INT IDENTITY(1,1) PRIMARY KEY,
        nombre NVARCHAR(255) NULL
      );
    END
  `);

  // biblioteca
  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[library]') AND type in (N'U'))
    BEGIN
      CREATE TABLE dbo.library (
        id INT IDENTITY(1,1) PRIMARY KEY,
        nombre NVARCHAR(255) NULL,
        url NVARCHAR(MAX) NULL,
        createdAt DATETIME2 DEFAULT SYSUTCDATETIME()
      );
    END
  `);

  // banco_imagenes (tabla solicitada)
  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[banco_imagenes]') AND type in (N'U'))
    BEGIN
      CREATE TABLE dbo.banco_imagenes (
        id INT IDENTITY(1,1) PRIMARY KEY,
        nombre_imagen NVARCHAR(255) NULL,
        url_blob NVARCHAR(MAX) NULL,
        createdAt DATETIME2 DEFAULT SYSUTCDATETIME()
      );
    END
  `);

  // contacts
  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[contacts]') AND type in (N'U'))
    BEGIN
      CREATE TABLE dbo.contacts (
        id INT IDENTITY(1,1) PRIMARY KEY,
        name NVARCHAR(255),
        email NVARCHAR(255),
        phone NVARCHAR(100),
        message NVARCHAR(MAX),
        attachments NVARCHAR(MAX),
        createdAt DATETIME2 DEFAULT SYSUTCDATETIME()
      );
    END
  `);

  // cantidad (escalones)
  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[cantidad]') AND type in (N'U'))
    BEGIN
      CREATE TABLE dbo.cantidad (
        id INT IDENTITY(1,1) PRIMARY KEY,
        cantidad INT
      );
    END
  `);

  // pedidos (checkout)
  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[pedidos]') AND type in (N'U'))
    BEGIN
      CREATE TABLE dbo.pedidos (
        id INT IDENTITY(1,1) PRIMARY KEY,
        nit_id NVARCHAR(60) NOT NULL,
        name NVARCHAR(255) NOT NULL,
        email NVARCHAR(255) NOT NULL,
        phone NVARCHAR(100) NOT NULL,
        address NVARCHAR(255) NOT NULL,
        city NVARCHAR(120) NOT NULL,
        notes NVARCHAR(MAX) NULL,
        payment_method NVARCHAR(50) NULL,
        createdAt DATETIME2 DEFAULT SYSUTCDATETIME()
      );
    END
  `);
}

module.exports = { query, getPool, ensureSchema, sql };
