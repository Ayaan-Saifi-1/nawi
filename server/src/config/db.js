import mongoose from 'mongoose';
import { env } from './env.js';

let connectionPromise;
let embeddedMongoServer = null;

mongoose.connection.on('disconnected', () => {
  connectionPromise = null;
});

export async function connectDB() {
  if (mongoose.connection.readyState === 1) return mongoose.connection;
  if (mongoose.connection.readyState === 2) return mongoose.connection.asPromise();

  if (!connectionPromise) {
    connectionPromise = (async () => {
      let mongoUri = env.MONGO_URI;

      if (!mongoUri || mongoUri === 'embedded' || mongoUri === 'memory') {
        console.log('[Database] No external MONGO_URI provided. Initializing embedded database engine...');
        const { MongoMemoryServer } = await import('mongodb-memory-server');
        embeddedMongoServer = await MongoMemoryServer.create({
          instance: {
            dbName: 'nawi_metrology',
          },
        });
        mongoUri = embeddedMongoServer.getUri();
        console.log(`[Database] Embedded MongoDB engine running at ${mongoUri}`);
      }

      const conn = await mongoose.connect(mongoUri, {
        serverSelectionTimeoutMS: 15000,
      });
      console.log(`[Database] MongoDB Connected: ${conn.connection.host}`);
      return conn.connection;
    })().catch((error) => {
      connectionPromise = null;
      console.error(`MongoDB Connection Error: ${error.message}`);
      throw error;
    });
  }
  return connectionPromise;
}
