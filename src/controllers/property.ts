import { Request, Response } from 'express';
import { Property } from '../models/property';

export async function createProperty(req: Request, res: Response) {
  try {
    const { id, name, type, address, detailedAddress, description, commonAmenities, latitude, longitude, hostId } = req.body;
    if (!id || !name || !type || !address || !detailedAddress || latitude === undefined || longitude === undefined || !hostId) {
      return res.status(400).json({ success: false, error: 'Missing properties required fields.' });
    }
    const prop = new Property({ _id: id, name, type, address, detailedAddress, description, commonAmenities, latitude, longitude, hostId });
    await prop.save();
    return res.status(201).json({ success: true, property: prop });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

export async function getProperties(req: Request, res: Response) {
  try {
    const props = await Property.find({});
    return res.status(200).json(props);
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
}
