import { Request, Response } from 'express';
import { Notification } from '../models/notification';
import { User } from '../models/user';

function normalizePhone(p: string): string {
  if (!p) return '';
  let clean = p.trim().replace(/\s+/g, '');
  if (clean.startsWith('+84')) {
    clean = '0' + clean.substring(3);
  }
  return clean;
}

export async function getNotifications(req: Request, res: Response) {
  try {
    const userId = (req.query.userId as string) || (req as any).user?.id || (req as any).user?._id;
    if (!userId) {
      return res.status(400).json({ success: false, error: 'User ID is required' });
    }

    const user = await User.findById(userId);
    let searchUserIds: string[] = [userId];
    if (user) {
      searchUserIds.push(user._id.toString());
      if (user.phone) {
        const rawPhone = user.phone.trim();
        const normPhone = normalizePhone(rawPhone);
        searchUserIds.push(rawPhone);
        searchUserIds.push(normPhone);
      }
    }

    const notifications = await Notification.find({ userId: { $in: searchUserIds } }).sort({ timestamp: -1 });
    const formatted = notifications.map(notif => ({
      id: notif._id,
      title: notif.title,
      content: notif.content,
      time: notif.timestamp,
      isRead: notif.isRead,
      type: notif.type,
      targetId: notif.targetId || null
    }));
    return res.status(200).json(formatted);
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

export async function createNotification(req: Request, res: Response) {
  try {
    const { id, userId, title, content, type, isRead, timestamp } = req.body;
    if (!id || !userId || !title || !content || !type || !timestamp) {
      return res.status(400).json({ success: false, error: 'Missing required notification fields' });
    }

    const notification = new Notification({
      _id: id,
      userId,
      title,
      content,
      type,
      isRead: isRead || false,
      timestamp
    });
    await notification.save();

    return res.status(201).json({ success: true, notification });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

export async function markAsRead(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const notification = await Notification.findByIdAndUpdate(id, { isRead: true }, { new: true });
    if (!notification) {
      return res.status(404).json({ success: false, error: 'Notification not found' });
    }

    return res.status(200).json({ success: true, notification });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

export async function markAllAsRead(req: Request, res: Response) {
  try {
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ success: false, error: 'User ID is required' });
    }

    await Notification.updateMany({ userId }, { isRead: true });
    return res.status(200).json({ success: true, message: 'All notifications marked as read' });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

export async function sendNotificationHelper(userId: string, title: string, content: string, type: string, targetId?: string) {
  try {
    if (!userId) return;

    if (type === 'CHAT' && targetId) {
      const existingNotif = await Notification.findOne({ userId, type: 'CHAT', targetId });
      if (existingNotif) {
        existingNotif.content = content;
        existingNotif.timestamp = new Date().toISOString();
        existingNotif.isRead = false;
        await existingNotif.save();
        console.log(`[NOTIFICATION] 🔔 Updated aggregated CHAT notification for user ${userId}`);
        return existingNotif;
      }
    }

    const notif = new Notification({
      _id: Date.now().toString() + Math.random().toString(36).substring(2, 7),
      userId,
      title,
      content,
      type,
      isRead: false,
      timestamp: new Date().toISOString(),
      targetId: targetId || null
    });
    await notif.save();
    console.log(`[NOTIFICATION] 🔔 Sent '${title}' to user ${userId}`);
    return notif;
  } catch (error) {
    console.error(`[NOTIFICATION] Failed to send notification to ${userId}:`, error);
  }
}

