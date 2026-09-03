import mongoose, { Schema } from 'mongoose';

export interface IProperty {
  name: string;
  type: 'SINGLE' | 'COMPLEX';
  address: string;
  detailedAddress: string;
  description?: string;
  commonAmenities: string[];
  latitude: number;
  longitude: number;
  isHidden: boolean;
  hostId: string;
  rating: number;
  reviewCount: number;
}

const PropertySchema = new Schema<IProperty>({
  name: { type: String, required: true },
  type: { type: String, enum: ['SINGLE', 'COMPLEX'], required: true },
  address: { type: String, required: true },
  detailedAddress: { type: String, required: true },
  description: { type: String },
  commonAmenities: [{ type: String }],
  latitude: { type: Number, required: true },
  longitude: { type: Number, required: true },
  isHidden: { type: Boolean, default: false },
  hostId: { type: String, required: true },
  rating: { type: Number, default: 0 },
  reviewCount: { type: Number, default: 0 }
});

export const Property = mongoose.model<IProperty>('Property', PropertySchema);
