// Database configuration
import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { logger } from '@/shared/utils/logger.js';
import { Pool } from 'pg';
import { relations } from '../infrastructure/database/relations.js';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});
const db = drizzle({ client: pool, relations });

export const verifyDatabaseConnection = async () => {
  try {
    await db.execute('SELECT 1');
    logger.info('Database connection verified successfully.');
  } catch (error) {
    logger.error('Failed to connect to the database.', { error });
    throw error;
  }
};

export { db, pool };
