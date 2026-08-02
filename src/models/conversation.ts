import mongoose, { Schema } from 'mongoose';

export interface IConversation {
  _id: string;
  renterId: string;
  hostId: string;
  lastMessageText: string;
  lastMessageTime: string;
}

const ConversationSchema = new Schema<IConversation>({
  _id: { type: String, required: true },
  renterId: { type: String, required: true, index: true },
  hostId: { type: String, required: true, index: true },
  lastMessageText: { type: String, default: '' },
  lastMessageTime: { type: String, default: '' }
});

export const Conversation = mongoose.model<IConversation>('Conversation', ConversationSchema);
