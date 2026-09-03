import mongoose, { Schema } from 'mongoose';

export interface INotification {
  userId: string;
  title: string;
  content: string;
  type: string;
  isRead: boolean;
  timestamp: string;
  targetId?: string;
}

const NotificationSchema = new Schema<INotification>({
  userId: { type: String, required: true, index: true },
  title: { type: String, required: true },
  content: { type: String, required: true },
  type: { type: String, required: true },
  isRead: { type: Boolean, default: false },
  timestamp: { type: String, required: true },
  targetId: { type: String, default: null }
});

export const Notification = mongoose.model<INotification>('Notification', NotificationSchema);
