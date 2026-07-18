import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const url = process.env.MONGODB_URI || 'mongodb://localhost:27017/vietnam_provinces';

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
  await mongoose.connect(url);
  isConnected = true;
  return mongoose.connection.db;
}

export async function closeDb() {
  if (isConnected) {
    await mongoose.disconnect();
    isConnected = false;
  }
}
