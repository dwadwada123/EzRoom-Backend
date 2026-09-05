import mongoose from 'mongoose';
import dotenv from 'dotenv';
import dns from 'node:dns';

dotenv.config();

try {
  dns.setServers(['8.8.8.8', '8.8.4.4']);
} catch (e) {
  console.warn('Could not set custom DNS servers:', e);
}

const url = process.env.MONGODB_URI || 'mongodb://localhost:27017/vietnam_provinces';
const configuredDatabaseName = process.env.MONGODB_DB_NAME || (() => {
  try {
    return new URL(url).pathname.replace(/^\/+/, '') || 'vietnam_provinces';
  } catch {
    return 'vietnam_provinces';
  }
})();
const testDatabaseName = process.env.MONGODB_TEST_DB_NAME || `${configuredDatabaseName}_test`;

// Global transformation to map _id to id
mongoose.set('toJSON', {
  virtuals: true,
  transform: (doc, ret: any) => {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

let isConnected = false;

export async function connectDb() {
  if (isConnected) return mongoose.connection.db;

  await mongoose.connect(
    url,
    process.env.NODE_ENV === 'test' ? { dbName: testDatabaseName } : undefined
  );

  console.log('MongoDB host:', mongoose.connection.host);
  console.log('MongoDB database:', mongoose.connection.name);
  
  isConnected = true;
  return mongoose.connection.db;
}

export async function closeDb() {
  if (isConnected) {
    await mongoose.disconnect();
    isConnected = false;
  }
}
