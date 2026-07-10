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

const connectionString = process.env.DATABASE_URL || process.argv[2];
const sqlFile = process.env.DATABASE_URL ? process.argv[2] : process.argv[3];

if (!connectionString || !sqlFile) {
  console.log("Usage: node run_sql.js <connectionString> <sqlFilePath>");
  console.log("Or set DATABASE_URL and run: node run_sql.js <sqlFilePath>");
  process.exit(1);
}

async function execute() {
  console.log('=== APLICANDO MIGRACIÓN ===');
  await run(connectionString, sqlFile);
}

execute();
