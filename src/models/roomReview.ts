import mongoose, { Schema, Document } from 'mongoose';

export interface IRoomReview extends Document {
  roomId: string;
  reviewerId: string;
  rating: number;
  comment: string;
  isReported?: boolean;
  reportReason?: string;
  isDeleted?: boolean;
  createdAt: Date;
}

const RoomReviewSchema: Schema = new Schema({
  roomId: { type: String, required: true },
  reviewerId: { type: String, required: true },
  rating: { type: Number, required: true, min: 1, max: 5 },
  comment: { type: String, default: '' },
  isReported: { type: Boolean, default: false },
  reportReason: { type: String, default: '' },
  isDeleted: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

export const RoomReview = mongoose.model<IRoomReview>('RoomReview', RoomReviewSchema);
