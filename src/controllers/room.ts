import { Request, Response } from 'express';
import { Room } from '../models/room';
import { AuthenticatedRequest } from '../middlewares/auth';
import mongoose from 'mongoose';

export async function createRoom(req: AuthenticatedRequest, res: Response) {
  try {
    const hostId = req.user!.id;
    const {
      id, propertyId, title, price, electricityPrice, waterPrice,
      address, detailedAddress, description, structure, floorArea,
      mezzanineArea, capacity, detailedAreas, images, amenities,
      latitude, longitude, status
    } = req.body;

    if (!id) {
      const { User } = await import('../models/user');
      const hostUser = await User.findById(hostId);
      if (!hostUser || hostUser.ekycStatus !== 'VERIFIED') {
        return res.status(403).json({ success: false, error: 'Bạn cần hoàn thành xác thực danh tính (eKYC) trước khi đăng phòng.' });
      }
    }

    if (!title || price === undefined || !structure || floorArea === undefined) {
      return res.status(400).json({ success: false, error: 'Missing room required fields.' });
    }

    if (price < 0 || floorArea < 0 || (capacity && capacity < 0)) {
      return res.status(400).json({ success: false, error: 'Giá thuê, diện tích và sức chứa không được là số âm.' });
    }


    const finalAddress = address || 'Đà Nẵng';
    const finalDetailed = detailedAddress || address || 'Đà Nẵng';
    const finalLat = latitude !== undefined ? latitude : 16.0544;
    const finalLon = longitude !== undefined ? longitude : 108.2022;

    // Normalize images: filter out entries without url (e.g. from resId-only local images)
    const normalizedImages = Array.isArray(images)
      ? images
          .filter((img: any) => img && (img.url || img.url === ''))
          .map((img: any) => ({ url: img.url || '', category: img.category || 'Khác' }))
      : [];

    // Normalize amenities: objects with name + compensationAmount
    const normalizedAmenities = Array.isArray(amenities)
      ? amenities.map((a: any) => ({
          name: typeof a === 'string' ? a : (a.name || ''),
          compensationAmount: a.compensationAmount ?? 0
        })).filter((a: any) => a.name)
      : [];

    const updateData = {
      propertyId: propertyId || null,
      title,
      price: Number(price),
      electricityPrice: electricityPrice !== undefined ? Number(electricityPrice) : 3500,
      waterPrice: waterPrice !== undefined ? Number(waterPrice) : 15000,
      address: finalAddress,
      detailedAddress: finalDetailed,
      description: description || '',
      structure,
      floorArea: Number(floorArea),
      mezzanineArea: mezzanineArea ? Number(mezzanineArea) : 0,
      capacity: capacity ? Number(capacity) : 0,
      detailedAreas: detailedAreas || [],
      images: normalizedImages,
      amenities: normalizedAmenities,
      latitude: finalLat,
      longitude: finalLon,
      status: status || (id ? undefined : 'PENDING'),
      hostId
    };

    let room;
    
    if (id) {
      room = await Room.findByIdAndUpdate(
        id,
        updateData,
        { new: true, upsert: true, setDefaultsOnInsert: true }
      );
    } else {
      room = new Room(updateData);
      await room.save();
    }

    console.log(`[ROOM] ✅ Saved room "${title}" (${room._id}) for property ${propertyId || 'standalone'}`);

    const obj = room.toObject();
    return res.status(201).json({ success: true, room: { ...obj, id: obj._id } });
  } catch (error: any) {
    console.error(`[ROOM ERROR]`, error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
}

export async function getRooms(req: Request, res: Response) {
  try {
    // Public discovery: only active, non-hidden rooms
    const rooms = await Room.find({ status: 'ACTIVE', isUserHidden: false });
    
    // Fetch properties and users to map host information
    const { Property } = await import('../models/property');
    const { User } = await import('../models/user');
    
    const properties = await Property.find();
    const propMap = new Map(properties.map(p => [p._id.toString(), p.hostId]));
    
    const users = await User.find();
    const userMap = new Map();
    users.forEach(u => {
      if (u._id) userMap.set(u._id.toString(), u);
      if ((u as any).id) userMap.set((u as any).id.toString(), u);
      if (u.phone) userMap.set(u.phone.toString(), u);
    });

    const result = rooms.map(r => { 
      const obj = r.toObject(); 
      // Use room's hostId if present (standalone), otherwise fallback to property's hostId
      const hostId = obj.hostId || (obj.propertyId ? (propMap.get(obj.propertyId.toString()) || '') : '');
      const host = userMap.get(hostId.toString());
      
      return { 
        ...obj, 
        id: obj._id,
        hostId: hostId,
        hostName: host ? host.name : 'Chủ nhà',
        hostPhone: host ? host.phone : '',
        hostAvatarUrl: host?.avatarUrl || null
      }; 
    });
    
    return res.status(200).json(result);
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

// Host-only: returns all rooms for properties owned by the authenticated host
export async function getHostRooms(req: AuthenticatedRequest, res: Response) {
  try {
    const hostId = req.user!.id;
    // Get all rooms linked to properties owned by this host
    const { Property } = await import('../models/property');
    const { User } = await import('../models/user');
    const hostProperties = await Property.find({ hostId });
    const propertyIds = hostProperties.map(p => p._id.toString());

    // Also include standalone rooms directly owned by this host (propertyId is null AND hostId matches)
    const rooms = await Room.find({
      $and: [
        { status: { $ne: 'DELETED' } },
        {
          $or: [
            { propertyId: { $in: propertyIds } },
            { propertyId: null, hostId: hostId }
          ]
        }
      ]
    });

    const hostUser = await User.findById(hostId);

    const result = rooms.map(r => {
      const obj = r.toObject();
      return {
        ...obj,
        id: obj._id,
        hostId: hostId,
        hostName: hostUser ? hostUser.name : 'Chủ nhà',
        hostPhone: hostUser ? hostUser.phone : '',
        hostAvatarUrl: hostUser?.avatarUrl || null
      };
    });
    console.log(`[ROOM] Fetched ${result.length} rooms for host ${hostId}`);
    return res.status(200).json(result);
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

export async function reportRoom(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { reason, reporterName } = req.body;
    const room = await Room.findById(id);
    if (!room) {
      return res.status(404).json({ success: false, error: 'Room not found' });
    }

    if (!room.reports) {
      room.reports = [];
    }

    const name = reporterName || (req as any).user?.name || 'Người thuê';
    const alreadyReported = room.reports.some(r => r.reporterName === name);
    if (alreadyReported) {
      return res.status(400).json({ success: false, error: 'Bạn đã báo cáo phòng trọ này rồi. Báo cáo đang chờ Admin xử lý.' });
    }

    const dateStr = new Date().toLocaleDateString('vi-VN');
    room.reports.push({
      reason: reason || 'Nội dung vi phạm quy định',
      date: dateStr,
      reporterName: name
    });

    await room.save();
    console.log(`[ROOM REPORT] 🚨 Room "${room.title}" reported by ${name} for: ${reason}`);
    return res.status(200).json({ success: true, message: 'Báo cáo vi phạm đã được gửi thành công' });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

export async function submitRoomAppeal(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { appealText, images } = req.body;
    const room = await Room.findById(id);
    if (!room) {
      return res.status(404).json({ success: false, error: 'Room not found' });
    }

    if (room.removalInfo?.appealStatus === 'PENDING') {
      return res.status(400).json({ success: false, error: 'Bạn đã gửi kháng cáo cho phòng này rồi. Kháng cáo đang chờ Admin xử lý.' });
    }

    const currentDate = new Date().toLocaleDateString('vi-VN');
    const textToSave = appealText && appealText.trim() ? appealText.trim() : 'Chủ nhà gửi kháng cáo yêu cầu xem xét mở lại phòng trọ.';
    room.removalInfo = {
      reason: room.removalInfo?.reason || 'Vi phạm chính sách nền tảng',
      dateRemoved: room.removalInfo?.dateRemoved || currentDate,
      appealText: textToSave,
      appealImages: Array.isArray(images) ? images : [],
      appealStatus: 'PENDING',
      appealDate: currentDate
    } as any;

    await room.save();
    console.log(`[ROOM APPEAL] 📩 Host submitted appeal for room "${room.title}": ${appealText}`);
    return res.status(200).json({ success: true, message: 'Gửi kháng cáo lên Admin thành công' });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

export const toggleRoomVisibility = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const hostId = req.user?.id;
    const { id } = req.params;
    if (!hostId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const room = await Room.findById(id);
    if (!room) {
      res.status(404).json({ message: 'Room not found' });
      return;
    }

    // Since we don't have a direct hostId on Room in DB, verify via Property
    const { Property } = await import('../models/property');
    let isOwner = false;
    if (room.propertyId && room.propertyId !== 'standalone') {
      const prop = await Property.findOne({ _id: room.propertyId, hostId });
      if (prop) isOwner = true;
    } else {
      isOwner = room.hostId?.toString() === hostId;
    }

    if (!isOwner) {
      res.status(403).json({ message: 'Forbidden' });
      return;
    }

    room.isUserHidden = !room.isUserHidden;
    await room.save();

    console.log(`[ROOM] 👁️ Toggled visibility for room "${room.title}" to isUserHidden=${room.isUserHidden}`);
    res.status(200).json({ success: true, message: 'Visibility toggled successfully' });
  } catch (error) {
    console.error('Error toggling room visibility:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export async function deleteRoom(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const room = await Room.findById(id);
    if (!room) {
      return res.status(404).json({ success: false, error: 'Room not found' });
    }

    const hostId = req.user?.id;
    let isOwner = false;
    if (room.propertyId && room.propertyId !== 'standalone') {
      const { Property } = await import('../models/property');
      const prop = await Property.findOne({ _id: room.propertyId, hostId });
      if (prop) isOwner = true;
    } else {
      isOwner = room.hostId?.toString() === hostId;
    }

    if (!isOwner) {
      return res.status(403).json({ success: false, error: 'Forbidden: Not your room.' });
    }

    room.status = 'DELETED';
    await room.save();

    console.log(`[ROOM] 🗑️ Soft deleted room "${room.title}" (${room._id})`);
    return res.status(200).json({ success: true, message: 'Phòng đã được xóa thành công' });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

