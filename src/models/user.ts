import mongoose, { Schema } from 'mongoose';

export interface IUser {
  _id: string;
  name: string;
  email: string;
  phone: string;
  avatarUrl?: string | null;
  role: 'RENTER' | 'HOST';
  isEkycVerified: boolean;
  creditScore: number;
}

const UserSchema = new Schema<IUser>({
  _id: { type: String, required: true },
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  phone: { type: String, required: true },
  avatarUrl: { type: String, default: null },
  role: { type: String, enum: ['RENTER', 'HOST'], required: true },
  isEkycVerified: { type: Boolean, default: false },
  creditScore: { type: Number, default: 0.0 }
});

export const User = mongoose.model<IUser>('User', UserSchema);
