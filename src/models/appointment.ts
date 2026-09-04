import mongoose, { Schema } from 'mongoose';

export interface IAppointment {
  roomId: Schema.Types.ObjectId;
  roomName: string;
  renterId: Schema.Types.ObjectId;
  renterName: string;
  renterPhone: string;
  hostId:  Schema.Types.ObjectId;
  hostName: string;
  date: string;
  time: string;
  note: string;
  status: 'PENDING' | 'APPROVED' | 'CANCELED' | 'RESCHEDULED';
}

const AppointmentSchema = new Schema<IAppointment>({
  roomId: {
    type: Schema.Types.ObjectId,
    ref: 'Room',
    required: true
  },
  roomName: { type: String, required: true },
  renterId: { 
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  renterName: { type: String, required: true },
  renterPhone: { type: String, required: true },
  hostId: {  
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true},
  hostName: { type: String, required: true },
  date: { type: String, required: true },
  time: { type: String, required: true },
  note: { type: String, default: '' },
  status: { type: String, enum: ['PENDING', 'APPROVED', 'CANCELED', 'RESCHEDULED'], default: 'PENDING' }
});

export const Appointment = mongoose.model<IAppointment>('Appointment', AppointmentSchema);
