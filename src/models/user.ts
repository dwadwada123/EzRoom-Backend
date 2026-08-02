import mongoose, { Schema } from 'mongoose';

export interface IUser {
  _id: string;
  name: string;
  email: string;
  phone: string;
  password?: string;
  avatarUrl?: string | null;
  role: 'RENTER' | 'HOST';
  isEkycVerified: boolean;
  ekycStatus: 'NONE' | 'PENDING' | 'VERIFIED' | 'REJECTED';
  ekycRejectReason: string;
  creditScore: number;
  status: 'ACTIVE' | 'LOCKED';
  lockReason: string;
  violations: number;
  totalViolations: number;
  idCardNumber?: string;
  idCardFrontUrl?: string;
  idCardBackUrl?: string;
  selfieUrl?: string;
  dateSubmittedEkyc?: string;
  favoriteRoomIds?: string[];
  paymentAccounts?: any[];
}

const UserSchema = new Schema<IUser>({
  _id: { type: String, required: true },
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, index: true },
  phone: { type: String, required: true },
  password: { type: String, default: '' },
  avatarUrl: { type: String, default: null },
  role: { type: String, enum: ['RENTER', 'HOST'], required: true, index: true },
  isEkycVerified: { type: Boolean, default: false, index: true },
  ekycStatus: { type: String, enum: ['NONE', 'PENDING', 'VERIFIED', 'REJECTED'], default: 'NONE', index: true },
  ekycRejectReason: { type: String, default: '' },
  creditScore: { type: Number, default: 5.0 },
  status: { type: String, enum: ['ACTIVE', 'LOCKED'], default: 'ACTIVE', index: true },
  lockReason: { type: String, default: '' },
  violations: { type: Number, default: 0 },
  totalViolations: { type: Number, default: 0 },
  idCardNumber: { type: String, default: '', index: true },
  idCardFrontUrl: { type: String, default: '' },
  idCardBackUrl: { type: String, default: '' },
  selfieUrl: { type: String, default: '' },
  dateSubmittedEkyc: { type: String, default: '' },
  favoriteRoomIds: { type: [String], default: [] },
  paymentAccounts: { type: [Schema.Types.Mixed], default: [] }
});

export const User = mongoose.model<IUser>('User', UserSchema);
