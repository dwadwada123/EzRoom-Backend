import mongoose, { Schema } from 'mongoose';

export interface IMessage {
  conversationId: string;
  senderId: string;
  content: string;
  timestamp: string;
  imageUrl?: string;
  latitude?: number;
  longitude?: number;
}

const MessageSchema = new Schema<IMessage>({
  conversationId: { type: String, required: true, index: true },
  senderId: { type: String, required: true },
  content: { type: String, required: true },
  timestamp: { type: String, required: true },
  imageUrl: { type: String, default: null },
  latitude: { type: Number, default: null },
  longitude: { type: Number, default: null }
});

export const Message = mongoose.model<IMessage>('Message', MessageSchema);
