import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import mongoose from 'mongoose';
import { env } from './config/env.js';
import routes from './routes/index.js';
import { notFoundHandler, errorHandler } from './middleware/errorHandler.js';
import { AppError } from './utils/AppError.js';
import { connectDB } from './config/db.js';
import { processScheduledActivations } from './jobs/activationJob.js';
import { asyncHandler } from './utils/asyncHandler.js';
import { timingSafeEqual } from 'node:crypto';

const app = express();

app.set('trust proxy', 1);

app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'healthy', timestamp: new Date().toISOString() });
});

app.get('/ready', async (_req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ status: 'unhealthy', error: 'Database connection is not ready' });
    }
    await mongoose.connection.db.admin().ping();
    res.status(200).json({ status: 'ready', timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(503).json({ status: 'unhealthy', error: 'Database ping failed' });
  }
});

const allowedOrigins = (env.CLIENT_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map((o) => o.trim());

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "blob:"],
        connectSrc: ["'self'"],
        fontSrc: ["'self'", "https:", "data:"],
        objectSrc: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false,
  })
);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new AppError(403, 'CORS_NOT_ALLOWED', 'CORS origin not allowed'));
      }
    },
    credentials: true,
  })
);
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

const globalLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: process.env.NODE_ENV === 'test' ? 10000 : env.RATE_LIMIT_MAX,
  message: {
    success: false,
    error: {
      code: 'TOO_MANY_REQUESTS',
      message: 'Too many requests from this IP, please try again later.',
    },
  },
});

app.use(globalLimiter);

app.use(asyncHandler(async (req, _res, next) => {
  if (req.path === '/health' || req.path === '/ready') return next();
  await connectDB();
  next();
}));

app.get('/api/cron/activate-rules', asyncHandler(async (req, res) => {
  const secret = process.env.CRON_SECRET;
  const authorization = req.get('authorization') || '';
  const expected = secret ? `Bearer ${secret}` : '';
  const authorized = Boolean(secret) &&
    Buffer.byteLength(authorization) === Buffer.byteLength(expected) &&
    timingSafeEqual(Buffer.from(authorization), Buffer.from(expected));
  if (!authorized) {
    throw new AppError(secret ? 401 : 503, 'CRON_UNAUTHORIZED', 'Scheduled job authorization failed');
  }
  await processScheduledActivations();
  res.status(200).json({ success: true });
}));

// Mount API routes
app.use('/api', routes);

// 404 & Global Error Handling
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
