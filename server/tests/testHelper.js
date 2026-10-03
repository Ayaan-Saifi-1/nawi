import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';

let mongoServer;

export async function setupTestDB() {
  try {
    // Try connecting to local MongoDB first if running
    await mongoose.connect('mongodb://127.0.0.1:27017/nawi_test_db', {
      serverSelectionTimeoutMS: 2000,
    });
    console.log('Connected to local MongoDB test database.');
  } catch (err) {
    // Fallback to MongoMemoryServer
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);
  }
}

export async function teardownTestDB() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
  if (mongoServer) {
    await mongoServer.stop();
  }
}

export async function clearTestDB() {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany();
  }
}
