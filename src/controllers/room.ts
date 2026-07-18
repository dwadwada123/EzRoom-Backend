import { Request, Response } from 'express';
import { Room } from '../models/room';

export async function createRoom(req: Request, res: Response) {
  try {
    const { id, propertyId, title, price, electricityPrice, waterPrice, address, detailedAddress, description, structure, floorArea, mezzanineArea, detailedAreas, images, amenities, latitude, longitude } = req.body;
    if (!id || !title || price === undefined || !address || !detailedAddress || !structure || floorArea === undefined || latitude === undefined || longitude === undefined) {
      return res.status(400).json({ success: false, error: 'Missing room required fields.' });
    }
    const room = new Room({
      _id: id, propertyId, title, price, electricityPrice, waterPrice, address, detailedAddress, description, structure, floorArea, mezzanineArea, detailedAreas, images, amenities, latitude, longitude
    });
    await room.save();
    return res.status(201).json({ success: true, room });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

export async function getRooms(req: Request, res: Response) {
  try {
    // Only show active and non-user-hidden rooms for discovery API
    const rooms = await Room.find({ status: 'ACTIVE', isUserHidden: false });
    return res.status(200).json(rooms);
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
}
