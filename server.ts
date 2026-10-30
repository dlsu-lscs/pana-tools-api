import app from './src/app.js';
import { logger } from '@/shared/utils/logger.js';
import { verifyDatabaseConnection } from '@/shared/config/database.js';

const port = process.env.PORT || 8000;

await verifyDatabaseConnection();

app.listen(port, () => {
  logger.info(`Server is running on port ${port}`);
});

