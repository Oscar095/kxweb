/*
  Script de migración básico de MongoDB -> SQL Server para metadatos.
  NO migra imágenes binarias automáticamente. Images que ya sean URLs serán copiadas.
  Ejecutar: node server/migrate-mongo-to-mssql.js
*/

require('dotenv').config();
const mongoose = require('mongoose');
const db = require('./db');
const Product = require('./models/Product');

async function run() {
  try {
    console.log('Conectando a SQL...');
    await db.getPool();
    await db.ensureSchema();

    console.log('Conectando a Mongo...');
    await mongoose.connect(process.env.MONGODB_URI, {});

    const docs = await Product.find().lean().exec();
    console.log('Productos en Mongo:', docs.length);

    for (const d of docs) {
      const images = Array.isArray(d.images) ? d.images.map(it => it.url || it).filter(Boolean) : [];
      // Also check image field and imageData (skip binary imageData)
      if (d.image && typeof d.image === 'string') images.unshift(d.image);

      const obj = {
        codigo: (d.codigo || d.Codigo || '') + '',
        name: d.name || d.Nombre || '',
        price: Number(d.price ?? d.Precio) || null,
        precio_unitario: Number(d.precio_unitario ?? d['Precio Unitario']) || null,
        cantidad: Number(d.cantidad ?? d.Cantidad) || null,
        category: d.category || d.Categoria || null,
        linea: d.linea || d.Linea || null,
        description: d.description || d.Descripcion || null,
        images: JSON.stringify(images)
      };

      // Insert into SQL
      const res = await db.query(`INSERT INTO dbo.products (codigo,name,price,precio_unitario,cantidad,category,linea,description,images) 
        OUTPUT INSERTED.id
        VALUES (@codigo,@name,@price,@precio_unitario,@cantidad,@category,@linea,@description,@images);`, obj);
      console.log('Inserted product id:', res[0] && res[0].id);
    }

    console.log('Migración completa');
    process.exit(0);
  } catch (e) {
    console.error('Error migrando:', e);
    process.exit(1);
  }
}

run();
