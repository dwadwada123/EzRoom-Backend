import { Request, Response } from 'express';
import { Conversation } from '../models/conversation';
import { Message } from '../models/message';
import { User } from '../models/user';
import { sendNotificationHelper } from './notification';

export async function getConversations(req: Request, res: Response) {
  try {
    const { userId } = req.query;
    if (!userId) {
      return res.status(400).json({ success: false, error: 'User ID is required' });
    }

    const conversations = await Conversation.find({
      $or: [
        { renterId: userId as string },
        { hostId: userId as string }
      ]
    } as any);

    const enrichedConversations = [];
    for (const conv of conversations) {
      const isRenter = conv.renterId === userId;
      const otherPartyId = isRenter ? conv.hostId : conv.renterId;
      const otherUser = await User.findById(otherPartyId);
      enrichedConversations.push({
        id: conv._id,
        otherPartyName: otherUser ? otherUser.name : (isRenter ? 'Chủ trọ' : 'Khách thuê'),
        otherPartyPhone: otherUser ? otherUser.phone : '',
        lastMessage: conv.lastMessageText || '',
        timestamp: conv.lastMessageTime || '',
        unreadCount: 0
      });
    }

    return res.status(200).json(enrichedConversations);
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

export async function getMessages(req: Request, res: Response) {
  try {
    const { conversationId } = req.params;
    const { userId } = req.query;
    if (!conversationId) {
      return res.status(400).json({ success: false, error: 'Conversation ID is required' });
    }

    const messages = await Message.find({ conversationId }).sort({ timestamp: 1 });
    const formattedMessages = messages.map(msg => ({
      id: msg._id,
      senderId: msg.senderId,
      text: msg.content,
      timestamp: parseInt(msg.timestamp) || Date.now(),
      isFromMe: msg.senderId === userId,
      imageUrl: msg.imageUrl,
      latitude: msg.latitude,
      longitude: msg.longitude
    }));

    return res.status(200).json(formattedMessages);
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

export async function sendMessage(req: Request, res: Response) {
  try {
    const { id, conversationId, senderId, content, timestamp, renterId, hostId, imageUrl, latitude, longitude } = req.body;
    if (!id || !conversationId || !senderId || (!content && !imageUrl && !latitude) || !timestamp) {
      return res.status(400).json({ success: false, error: 'Missing required message fields' });
    }

    // Check if conversation exists, if not create it
    let conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      if (!renterId || !hostId) {
        return res.status(400).json({ success: false, error: 'Conversation does not exist. renterId and hostId are required to create it.' });
      }
      conversation = new Conversation({
        _id: conversationId,
        renterId,
        hostId,
        lastMessageText: content || (imageUrl ? "Hình ảnh" : "Vị trí"),
        lastMessageTime: timestamp
      });
      await conversation.save();
    } else {
      conversation.lastMessageText = content || (imageUrl ? "Hình ảnh" : "Vị trí");
      conversation.lastMessageTime = timestamp;
      await conversation.save();
    }

    // Save message
    const message = new Message({
      _id: id,
      conversationId,
      senderId,
      content: content || '',
      timestamp,
      imageUrl,
      latitude,
      longitude
    });
    await message.save();

    // Trigger Notification to Recipient
    const recipientId = conversation.renterId === senderId ? conversation.hostId : conversation.renterId;
    const senderUser = await User.findById(senderId);
    const senderName = senderUser ? senderUser.name : 'Người dùng';
    const messageSnippet = content ? (content.length > 50 ? content.substring(0, 50) + '...' : content) : (imageUrl ? '[Hình ảnh]' : '[Vị trí]');

    await sendNotificationHelper(
      recipientId,
      'Tin nhắn mới',
      `${senderName}: ${messageSnippet}`,
      'CHAT',
      conversation._id.toString()
    );

    return res.status(201).json({ success: true, message });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
}


import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

export async function uploadImage(req: Request, res: Response) {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No image provided' });
    }

    const b64 = Buffer.from(req.file.buffer).toString('base64');
    const dataURI = "data:" + req.file.mimetype + ";base64," + b64;
    
    const result = await cloudinary.uploader.upload(dataURI, {
      folder: 'ezroom_chat'
    });

    return res.status(200).json({ success: true, url: result.secure_url });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
}
