import mongoose, { Schema } from 'mongoose';

export interface IAppointment {
  _id: string;
  roomId: string;
  roomName: string;
  renterId?: string;
  renterName: string;
  renterPhone: string;
  hostId?: string;
  hostName: string;
  date: string;
  time: string;
  note: string;
  status: 'PENDING' | 'APPROVED' | 'CANCELED' | 'RESCHEDULED';
}

const AppointmentSchema = new Schema<IAppointment>({
  _id: { type: String, required: true },
  roomId: { type: String, required: true },
  roomName: { type: String, required: true },
  renterId: { type: String, default: '' },
  renterName: { type: String, required: true },
  renterPhone: { type: String, required: true },
  hostId: { type: String, default: '' },
  hostName: { type: String, required: true },
  date: { type: String, required: true },
  time: { type: String, required: true },
  note: { type: String, default: '' },
  status: { type: String, enum: ['PENDING', 'APPROVED', 'CANCELED', 'RESCHEDULED'], default: 'PENDING' }
});

export const Appointment = mongoose.model<IAppointment>('Appointment', AppointmentSchema);
