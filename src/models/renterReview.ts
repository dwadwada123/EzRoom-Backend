import mongoose, { Schema } from 'mongoose';

export interface IRenterReview {
  renterId: string;
  hostName: string;
  rating: number;
  tags: string[];
  comment: string;
  date: string;
  isDeleted?: boolean;
}

const RenterReviewSchema = new Schema<IRenterReview>({
  renterId: { type: String, required: true, index: true },
  hostName: { type: String, required: true },
  rating: { type: Number, required: true },
  tags: { type: [String], default: [] },
  comment: { type: String, default: '' },
  date: { type: String, default: '' },
  isDeleted: { type: Boolean, default: false }
});

export const RenterReview = mongoose.model<IRenterReview>('RenterReview', RenterReviewSchema);
