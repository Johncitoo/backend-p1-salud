const { Client } = require('pg');
const fs = require('fs');

async function run(connectionString, sqlPath) {
  const client = new Client({
    connectionString,
    ssl: connectionString.includes('railway') ? { rejectUnauthorized: false } : false
  });
  
  try {
    console.log(`Conectando a: ${connectionString.split('@')[1] || 'Local'}`);
    await client.connect();
    const sql = fs.readFileSync(sqlPath, 'utf8');
    await client.query('BEGIN;');
    await client.query(sql);
    await client.query('COMMIT;');
    console.log(`Migración exitosa en ${connectionString.split('@')[1] || 'Local'}`);
  } catch (err) {
    console.error(`Error ejecutando migración:`);
    console.error(err);
    try { await client.query('ROLLBACK;'); } catch(e) {}
  } finally {
    await client.end();
  }
}

const prodString = 'postgresql://postgres:pgoJHeyVwYiHnjTAjaDANlgZlKOhhTPA@reseau.proxy.rlwy.net:23242/railway';
const localString = 'postgres://admin:admin123@127.0.0.1:5433/salud_db';
const sqlFile = '../BD/migraciones/2026-07-05_add_paciente_sensores.sql';

async function executeAll() {
  console.log('=== APLICANDO A PRODUCCIÓN ===');
  await run(prodString, sqlFile);
  
  console.log('\n=== APLICANDO A LOCAL (DOCKER) ===');
  await run(localString, sqlFile);
}

executeAll();
