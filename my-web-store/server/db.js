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
    poolPromise = sql.connect(config).catch(err => {
      poolPromise = null; // Reset so the next request retries
      throw err;
    });
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
        subtotal DECIMAL(18,2) NULL,
        iva DECIMAL(18,2) NULL,
        total_value DECIMAL(18,2) NULL,
        createdAt DATETIME2 DEFAULT SYSUTCDATETIME()
      );
    END
  `);

  // banners (home)
  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[banners]') AND type in (N'U'))
    BEGIN
      CREATE TABLE dbo.banners (
        id INT IDENTITY(1,1) PRIMARY KEY,
        nombre NVARCHAR(255) NULL,
        url NVARCHAR(MAX) NOT NULL,
        activo BIT NOT NULL DEFAULT (0),
        orden INT NULL,
        createdAt DATETIME2 DEFAULT SYSUTCDATETIME()
      );
    END
  `);

  // Ensure orden column exists if table pre-existed
  await pool.request().query(`
    IF COL_LENGTH('dbo.banners','orden') IS NULL
    BEGIN
      ALTER TABLE dbo.banners ADD orden INT NULL;
    END
  `);

  // Ensure row_empaque column exists on products (FK to dbo.tipos_empaques)
  await pool.request().query(`
    IF COL_LENGTH('dbo.products','row_empaque') IS NULL
    BEGIN
      ALTER TABLE dbo.products ADD row_empaque INT NULL;
    END
  `);

  // Ensure habilitado column exists on products (toggle visibility on storefront)
  await pool.request().query(`
    IF COL_LENGTH('dbo.products','habilitado') IS NULL
    BEGIN
      ALTER TABLE dbo.products ADD habilitado BIT NOT NULL CONSTRAINT DF_products_habilitado DEFAULT (1);
    END
  `);

  // Ensure es_personalizado column exists on products
  await pool.request().query(`
    IF COL_LENGTH('dbo.products','es_personalizado') IS NULL
    BEGIN
      ALTER TABLE dbo.products ADD es_personalizado BIT NOT NULL CONSTRAINT DF_products_es_personalizado DEFAULT (0);
    END
  `);

  // Ensure precio_personalizado_2000 column exists on products
  await pool.request().query(`
    IF COL_LENGTH('dbo.products','precio_personalizado_2000') IS NULL
    BEGIN
      ALTER TABLE dbo.products ADD precio_personalizado_2000 FLOAT NULL;
    END
    IF COL_LENGTH('dbo.products','precio_personalizado_4000') IS NULL
    BEGIN
      ALTER TABLE dbo.products ADD precio_personalizado_4000 FLOAT NULL;
    END
    IF COL_LENGTH('dbo.products','precio_personalizado_8000') IS NULL
    BEGIN
      ALTER TABLE dbo.products ADD precio_personalizado_8000 FLOAT NULL;
    END
    IF COL_LENGTH('dbo.products','precio_personalizado_20000') IS NULL
    BEGIN
      ALTER TABLE dbo.products ADD precio_personalizado_20000 FLOAT NULL;
    END
  `);

  // logos (header/footer)
  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[logos]') AND type in (N'U'))
    BEGIN
      CREATE TABLE dbo.logos (
        id INT IDENTITY(1,1) PRIMARY KEY,
        nombre NVARCHAR(255) NULL,
        url NVARCHAR(MAX) NOT NULL,
        principal BIT NOT NULL DEFAULT (0),
        createdAt DATETIME2 DEFAULT SYSUTCDATETIME()
      );
    END
  `);

  await pool.request().query(`
    IF COL_LENGTH('dbo.logos','principal') IS NULL
    BEGIN
      ALTER TABLE dbo.logos ADD principal BIT NOT NULL CONSTRAINT DF_logos_principal DEFAULT (0);
    END
  `);

  // Ensure pedidos has payment_status, id_wompi, updatedAt columns
  await pool.request().query(`
    IF COL_LENGTH('dbo.pedidos','payment_status') IS NULL
    BEGIN
      ALTER TABLE dbo.pedidos ADD payment_status NVARCHAR(50) NULL;
    END
  `);
  await pool.request().query(`
    IF COL_LENGTH('dbo.pedidos','id_wompi') IS NULL
    BEGIN
      ALTER TABLE dbo.pedidos ADD id_wompi NVARCHAR(255) NULL;
    END
  `);
  await pool.request().query(`
    IF COL_LENGTH('dbo.pedidos','updatedAt') IS NULL
    BEGIN
      ALTER TABLE dbo.pedidos ADD updatedAt DATETIME2 NULL;
    END
  `);

  // Nuevas columnas para datos del tercero
  await pool.request().query(`
    IF COL_LENGTH('dbo.pedidos','tipo_documento') IS NULL
    BEGIN
      ALTER TABLE dbo.pedidos ADD tipo_documento NVARCHAR(10) NULL;
    END
  `);
  await pool.request().query(`
    IF COL_LENGTH('dbo.pedidos','digito_verificacion') IS NULL
    BEGIN
      ALTER TABLE dbo.pedidos ADD digito_verificacion NVARCHAR(5) NULL;
    END
  `);
  await pool.request().query(`
    IF COL_LENGTH('dbo.pedidos','nombres') IS NULL
    BEGIN
      ALTER TABLE dbo.pedidos ADD nombres NVARCHAR(255) NULL;
    END
  `);
  await pool.request().query(`
    IF COL_LENGTH('dbo.pedidos','apellidos') IS NULL
    BEGIN
      ALTER TABLE dbo.pedidos ADD apellidos NVARCHAR(255) NULL;
    END
  `);
  await pool.request().query(`
    IF COL_LENGTH('dbo.pedidos','nombre_completo') IS NULL
    BEGIN
      ALTER TABLE dbo.pedidos ADD nombre_completo NVARCHAR(255) NULL;
    END
  `);
  await pool.request().query(`
    IF COL_LENGTH('dbo.pedidos','telefono_fijo') IS NULL
    BEGIN
      ALTER TABLE dbo.pedidos ADD telefono_fijo NVARCHAR(100) NULL;
    END
  `);
  await pool.request().query(`
    IF COL_LENGTH('dbo.pedidos','departamento') IS NULL
    BEGIN
      ALTER TABLE dbo.pedidos ADD departamento NVARCHAR(120) NULL;
    END
  `);
  await pool.request().query(`
    IF COL_LENGTH('dbo.pedidos','pais') IS NULL
    BEGIN
      ALTER TABLE dbo.pedidos ADD pais NVARCHAR(10) NULL CONSTRAINT DF_pedidos_pais DEFAULT 'CO';
    END
  `);
  await pool.request().query(`
    IF COL_LENGTH('dbo.pedidos','tipo_persona') IS NULL
    BEGIN
      ALTER TABLE dbo.pedidos ADD tipo_persona NVARCHAR(5) NULL CONSTRAINT DF_pedidos_tipo_persona DEFAULT 'N';
    END
  `);
  await pool.request().query(`
    IF COL_LENGTH('dbo.pedidos','regimen') IS NULL
    BEGIN
      ALTER TABLE dbo.pedidos ADD regimen NVARCHAR(50) NULL;
    END
  `);
  await pool.request().query(`
    IF COL_LENGTH('dbo.pedidos','fecha_nacimiento') IS NULL
    BEGIN
      ALTER TABLE dbo.pedidos ADD fecha_nacimiento DATE NULL;
    END
  `);

  // Ensure pedidos has flete column
  await pool.request().query(`
    IF COL_LENGTH('dbo.pedidos','flete') IS NULL
    BEGIN
      ALTER TABLE dbo.pedidos ADD flete DECIMAL(18,2) NULL CONSTRAINT DF_pedidos_flete DEFAULT 0;
    END
  `);

  // pedido_items (line items for each order)
  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[pedido_items]') AND type in (N'U'))
    BEGIN
      CREATE TABLE dbo.pedido_items (
        id INT IDENTITY(1,1) PRIMARY KEY,
        pedido_id INT NOT NULL,
        product_id INT NULL,
        product_name NVARCHAR(255) NULL,
        product_sku NVARCHAR(255) NULL,
        price_unit DECIMAL(18,2) NULL,
        quantity INT NOT NULL DEFAULT (1),
        subtotal DECIMAL(18,2) NULL
      );
    END
  `);

  // page_views (analytics tracking)
  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[page_views]') AND type in (N'U'))
    BEGIN
      CREATE TABLE dbo.page_views (
        id INT IDENTITY(1,1) PRIMARY KEY,
        page NVARCHAR(500) NULL,
        product_id INT NULL,
        session_id NVARCHAR(100) NULL,
        ip NVARCHAR(50) NULL,
        country NVARCHAR(100) NULL,
        city NVARCHAR(100) NULL,
        region NVARCHAR(100) NULL,
        user_agent NVARCHAR(500) NULL,
        referrer NVARCHAR(500) NULL,
        createdAt DATETIME2 DEFAULT SYSUTCDATETIME()
      );
    END
  `);
}

module.exports = { query, getPool, ensureSchema, sql };
