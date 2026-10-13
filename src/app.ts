// Express app configuration (no listen)
import express from 'express';
import { corsMiddleware } from './shared/middleware/auth.middleware.js';
import { errorHandler } from './shared/middleware/error.middleware.js';
// Register OpenAPI routes BEFORE importing swagger routes
import './applications/application.openapi.js';
import './favorites/favorites.openapi.js';
import './ratings/rating.openapi.js';
import './members/member.openapi.js';
import './images/images.openapi.js';
import './users/user.openapi.js';

import authRoutes from './shared/auth/auth.routes.js';
import applicationRoutes from './applications/application.routes.js';
import favoritesRoutes from '@/favorites/favorites.routes.js';
import ratingsRoutes from '@/ratings/rating.routes.js';
import memberRoutes from './members/member.routes.js';
import swaggerRoutes from './shared/routes/swagger.routes.js';
import imagesRoutes from './images/images.routes.js';
import userRoutes from './users/user.routes.js';
const app = express();
const isProduction = process.env.NODE_ENV === 'production';

// Middleware
app.use(express.json());
app.use(corsMiddleware); // Apply CORS middleware

app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/applications', applicationRoutes);
app.use('/api/favorites', favoritesRoutes);
app.use('/api', ratingsRoutes);
app.use('/api/members', memberRoutes);
app.use('/api/images', imagesRoutes);
app.use('/api/users', userRoutes);

// API Documentation (mounted last)
if (!isProduction) {
  app.use('/api-docs', swaggerRoutes);
}

// Error handling (must be after all routes)
app.use(errorHandler);

export default app;
