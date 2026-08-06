const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.TEST_URL
    },
  },
});

async function main() {
  try {
    console.log(`Attempting to connect to: ${process.env.TEST_URL.split('@')[1]}`);
    await prisma.$connect();
    console.log('SUCCESS: Successfully connected to the database!');
  } catch (e) {
    console.error('ERROR: Connection failed:');
    console.error(e.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
