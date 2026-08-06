const { Client } = require('pg');

async function testConnection() {
  const connectionString = process.env.TEST_URL;
  console.log('Testing PG connection to:', connectionString.replace(/:[^:@]+@/, ':***@'));
  
  const client = new Client({
    connectionString,
    connectionTimeoutMillis: 5000,
  });

  try {
    await client.connect();
    console.log('✅ Connection successful!');
    const res = await client.query('SELECT NOW()');
    console.log('Query result:', res.rows[0]);
  } catch (err) {
    console.error('❌ Connection failed:');
    console.error(err.message);
  } finally {
    await client.end();
  }
}

testConnection();
