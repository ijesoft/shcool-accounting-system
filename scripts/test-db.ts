import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://postgres:postgres@127.0.0.1:5432/school_accounting?schema=public',
    },
  },
});

async function main() {
  try {
    await prisma.$connect();
    console.log('Successfully connected to the database');
    const result = await prisma.$queryRaw`SELECT 1 as connected`;
    console.log('Query result:', result);
  } catch (error) {
    console.error('Failed to connect to the database:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
