import mongoose, { Schema } from 'mongoose';

export interface IOtp {
  email: string;
  otp: string;
  createdAt: Date;
}

const OtpSchema = new Schema<IOtp>({
  email: { type: String, required: true, index: true },
  otp: { type: String, required: true },
  createdAt: { type: Date, default: Date.now, expires: 300 } // TTL 300s (5 minutes) - MongoDB automatically deletes after 5 minutes
});

export const Otp = mongoose.model<IOtp>('Otp', OtpSchema);
