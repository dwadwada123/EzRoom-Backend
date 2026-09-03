import mongoose, { Schema } from 'mongoose';

export interface IRoom {
  propertyId?: string | null;
  title: string;
  price: number;
  electricityPrice: number;
  waterPrice: number;
  address: string;
  detailedAddress: string;
  description?: string;
  structure: 'SINGLE' | 'COMPLEX';
  floorArea: number;
  mezzanineArea: number;
  capacity?: number;
  detailedAreas: Array<{ id: string; roomName: string; areaValue: number }>;
  images: Array<{ url: string; category: string }>;
  amenities: Array<{ name: string; compensationAmount: number }>;
  status: 'ACTIVE' | 'RENTED' | 'PENDING' | 'HIDDEN' | 'REMOVED' | 'DELETED';
  latitude: number;
  longitude: number;
  isUserHidden: boolean;
  hostId: string;
  removalInfo?: { reason: string; dateRemoved: string; appealText?: string; appealImages?: string[]; appealStatus?: 'PENDING' | 'APPROVED' | 'REJECTED'; appealDate?: string } | null;
  reports?: Array<{ reason: string; date: string; reporterName: string }>;
  rating: number;
  reviewCount: number;
}

const RoomSchema = new Schema<IRoom>({
  propertyId: { type: String, default: null },
  title: { type: String, required: true },
  price: { type: Number, required: true, min: 0 },
  electricityPrice: { type: Number, default: 3500, min: 0 },
  waterPrice: { type: Number, default: 15000, min: 0 },
  address: { type: String, required: true },
  detailedAddress: { type: String, required: true },
  description: { type: String },
  structure: { type: String, enum: ['SINGLE', 'COMPLEX'], required: true },
  floorArea: { type: Number, required: true, min: 0 },
  mezzanineArea: { type: Number, default: 0.0, min: 0 },
  capacity: { type: Number, default: 0, min: 0 },
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
  status: { type: String, enum: ['ACTIVE', 'RENTED', 'PENDING', 'HIDDEN', 'REMOVED', 'DELETED'], default: 'PENDING', index: true },
  latitude: { type: Number, required: true, index: true },
  longitude: { type: Number, required: true, index: true },
  isUserHidden: { type: Boolean, default: false },
  hostId: { type: String, default: '' },
  removalInfo: {
    reason: { type: String },
    dateRemoved: { type: String },
    appealText: { type: String },
    appealImages: { type: [String], default: [] },
    appealStatus: { type: String, enum: ['PENDING', 'APPROVED', 'REJECTED'], default: undefined },
    appealDate: { type: String }
  },
  reports: [
    {
      reason: { type: String },
      date: { type: String },
      reporterName: { type: String }
    }
  ],
  rating: { type: Number, default: 0 },
  reviewCount: { type: Number, default: 0 }
});

export const Room = mongoose.model<IRoom>('Room', RoomSchema);
