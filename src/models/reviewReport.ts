import mongoose, { Schema, Document } from 'mongoose';

export interface IReviewReport extends Document {
  reviewId: string;
  reviewType: 'ROOM' | 'RENTER';
  reporterId?: string;
  reporterName?: string;
  reporterRole?: 'HOST' | 'RENTER';
  reason: string;
  proofImages: string[];
  status: 'PENDING' | 'RESOLVED' | 'DISMISSED';
  adminNote?: string;
  createdAt: Date;
}

const ReviewReportSchema: Schema = new Schema({
  reviewId: { type: String, required: true, index: true },
  reviewType: { type: String, enum: ['ROOM', 'RENTER'], default: 'ROOM' },
  reporterId: { type: String, default: '' },
  reporterName: { type: String, default: 'Người dùng' },
  reporterRole: { type: String, enum: ['HOST', 'RENTER'], default: 'RENTER' },
  reason: { type: String, required: true },
  proofImages: { type: [String], default: [] },
  status: { type: String, enum: ['PENDING', 'RESOLVED', 'DISMISSED'], default: 'PENDING' },
  adminNote: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
});

export const ReviewReport = mongoose.model<IReviewReport>('ReviewReport', ReviewReportSchema);
