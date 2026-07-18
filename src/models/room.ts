import mongoose, { Schema } from 'mongoose';

export interface IRoom {
  _id: string;
  propertyId?: string | null;
  title: string;
  price: number;
  electricityPrice: number;
  waterPrice: number;
  address: string;
  detailedAddress: string;
  description?: string;
  structure: 'SINGLE' | 'WHOLE' | 'APARTMENT';
  floorArea: number;
  mezzanineArea: number;
  detailedAreas: Array<{ id: string; roomName: string; areaValue: number }>;
  images: Array<{ url: string; category: string }>;
  amenities: Array<{ name: string; compensationAmount: number }>;
  status: 'ACTIVE' | 'RENTED' | 'PENDING' | 'HIDDEN' | 'REMOVED';
  latitude: number;
  longitude: number;
  isUserHidden: boolean;
  removalInfo?: { reason: string; dateRemoved: string } | null;
}

const RoomSchema = new Schema<IRoom>({
  _id: { type: String, required: true },
  propertyId: { type: String, default: null },
  title: { type: String, required: true },
  price: { type: Number, required: true },
  electricityPrice: { type: Number, default: 3500 },
  waterPrice: { type: Number, default: 15000 },
  address: { type: String, required: true },
  detailedAddress: { type: String, required: true },
  description: { type: String },
  structure: { type: String, enum: ['SINGLE', 'WHOLE', 'APARTMENT'], required: true },
  floorArea: { type: Number, required: true },
  mezzanineArea: { type: Number, default: 0.0 },
  detailedAreas: [
    {
      id: { type: String, required: true },
      roomName: { type: String, required: true },
      areaValue: { type: Number, required: true }
    }
  ],
  images: [
    {
      url: { type: String, required: true },
      category: { type: String, required: true }
    }
  ],
  amenities: [
    {
      name: { type: String, required: true },
      compensationAmount: { type: Number, required: true }
    }
  ],
  status: { type: String, enum: ['ACTIVE', 'RENTED', 'PENDING', 'HIDDEN', 'REMOVED'], default: 'ACTIVE' },
  latitude: { type: Number, required: true },
  longitude: { type: Number, required: true },
  isUserHidden: { type: Boolean, default: false },
  removalInfo: {
    reason: { type: String, default: '' },
    dateRemoved: { type: String, default: '' }
  }
});

export const Room = mongoose.model<IRoom>('Room', RoomSchema);
