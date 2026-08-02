import mongoose, { Schema, Document } from 'mongoose';

export interface IAmenity extends Document {
  name: string;
  type: 'ROOM' | 'PROPERTY';
  isDeleted: boolean;
}

const AmenitySchema: Schema = new Schema({
  name: { type: String, required: true },
  type: { type: String, enum: ['ROOM', 'PROPERTY'], required: true },
  isDeleted: { type: Boolean, default: false }
});

export default mongoose.model<IAmenity>('Amenity', AmenitySchema);