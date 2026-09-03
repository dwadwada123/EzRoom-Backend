import mongoose, { Schema } from 'mongoose';

export interface IConversation {
  renterId: string;
  hostId: string;
  lastMessageText: string;
  lastMessageTime: string;
}

const ConversationSchema = new Schema<IConversation>({
  renterId: { type: String, required: true, index: true },
  hostId: { type: String, required: true, index: true },
  lastMessageText: { type: String, default: '' },
  lastMessageTime: { type: String, default: '' }
});

export const Conversation = mongoose.model<IConversation>('Conversation', ConversationSchema);
