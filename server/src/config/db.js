import mongoose from 'mongoose';
import { env } from './env.js';

let connectionPromise;

mongoose.connection.on('disconnected', () => {
  connectionPromise = null;
});

export async function connectDB() {
  if (mongoose.connection.readyState === 1) return mongoose.connection;
  if (mongoose.connection.readyState === 2) return mongoose.connection.asPromise();
  if (!connectionPromise) {
    connectionPromise = mongoose.connect(env.MONGO_URI)
      .then((conn) => {
        console.log(`MongoDB Connected: ${conn.connection.host}`);
        return conn.connection;
      })
      .catch((error) => {
        connectionPromise = null;
        console.error(`MongoDB Connection Error: ${error.message}`);
        throw error;
      });
  }
  return connectionPromise;
}
