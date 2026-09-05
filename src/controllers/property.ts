import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { Property } from '../models/property';
import { AuthenticatedRequest } from '../middlewares/auth';

export async function createProperty(req: AuthenticatedRequest, res: Response) {
  try {
    const hostId = req.user!.id;
    
    const { name, type, address, detailedAddress, description, commonAmenities, latitude, longitude } = req.body;

    if (!name || !type || !address || !detailedAddress) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const finalAddress = address !== undefined ? address : 'Đà Nẵng';
    const finalDetailed = detailedAddress !== undefined ? detailedAddress : 'Số 1 Nguyễn Văn Linh';
    const finalLat = latitude !== undefined ? latitude : 16.0544;
    const finalLon = longitude !== undefined ? longitude : 108.2022;

    let normalizedAmenities: string[] = [];

    if (Array.isArray(commonAmenities)) {
      normalizedAmenities = commonAmenities.map((item: any) => {
        if (typeof item === 'string') return item;
        if (typeof item === 'object' && item !== null && item.name) return String(item.name);
        return String(item);
      });
    }

    const updateData = {
      name,
      type,
      address: finalAddress,
      detailedAddress: finalDetailed,
      description: description || '',
      commonAmenities: normalizedAmenities,
      latitude: finalLat,
      longitude: finalLon,
      hostId
    };

    // Use findByIdAndUpdate with upsert to handle both Create and Edit seamlessly
    const prop = new Property(updateData);

    await prop.save();

    console.log(`[PROPERTY] ✅ Saved property "${name}" (${prop._id.toString()}) for host ${hostId.toString()}`);

    const responseObj = prop.toObject();
    res.status(201).json({ ...responseObj, id: responseObj._id });
  } catch (error: any) {
    console.error('Error creating/updating property:', error);
    if (error.name === 'ValidationError') {
      const fieldErrors = Object.keys(error.errors).map(key => ({
        field: key,
        message: error.errors[key].message
      }));
      console.error('❌ Validation errors:', fieldErrors);
      res.status(400).json({ message: 'Property validation failed', errors: fieldErrors });
    }
    res.status(500).json({ message: 'Server error' });
  }
}

// Public API for Renters: get all active properties
export async function getProperties(req: Request, res: Response) {
  try {
    const props = await Property.find({ isHidden: false, isDeleted: { $ne: true } });
    const formatted = props.map(p => {
      const obj = p.toObject();
      return { ...obj, id: obj._id };
    });
    res.status(200).json(formatted);
  } catch (error) {
    console.error('Error fetching public properties:', error);
    res.status(500).json({ message: 'Server error' });
  }
}

// Host API: get only properties for this host
export const getHostProperties = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const hostId = req.user?.id;

    if (!hostId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const properties = await Property.find({ hostId, isDeleted: { $ne: true } });
    console.log(`[PROPERTY] Fetched ${properties.length} properties for host ${hostId}`);

    const mappedProperties = properties.map(p => ({
      ...p.toObject(),
      id: p._id,
    }));

    res.status(200).json(mappedProperties);
  } catch (error) {
    console.error('Error fetching host properties:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export async function updateProperty(req: AuthenticatedRequest, res: Response) {
  try {
    const hostId = req.user?.id;
    const id = String(req.params.id || '');

    if (!hostId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid property ID' });
    }

    const property = await Property.findOne({ _id: id, hostId, isDeleted: { $ne: true } });
    if (!property) {
      return res.status(404).json({ message: 'Property not found or unauthorized' });
    }

    const { name, type, address, detailedAddress, description, commonAmenities, latitude, longitude } = req.body;

    if (name) property.name = name;
    if (type) property.type = type;
    if (address) property.address = address;
    if (detailedAddress) property.detailedAddress = detailedAddress;
    if (description !== undefined) property.description = description;
    if (latitude !== undefined) property.latitude = Number(latitude);
    if (longitude !== undefined) property.longitude = Number(longitude);

    if (Array.isArray(commonAmenities)) {
      property.commonAmenities = commonAmenities.map((item: any) => {
        if (typeof item === 'string') return item;
        if (typeof item === 'object' && item !== null && item.name) return String(item.name);
        return String(item);
      });
    }

    await property.save();

    console.log(`[PROPERTY] ✏️ Updated property "${property.name}" (${property._id}) for host ${hostId}`);
    const responseObj = property.toObject();
    return res.status(200).json({ ...responseObj, id: responseObj._id });
  } catch (error: any) {
    console.error('Error updating property:', error);
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
}

export const togglePropertyVisibility = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const hostId = req.user?.id;
    const id = String(req.params.id || '');
    if (!hostId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ message: 'Invalid property ID' });
      return;
    }

    const property = await Property.findOne({ _id: id, hostId, isDeleted: { $ne: true } });
    if (!property) {
      res.status(404).json({ message: 'Property not found or unauthorized' });
      return;
    }

    property.isHidden = !property.isHidden;
    await property.save();

    console.log(`[PROPERTY] 👁️ Toggled visibility for property "${property.name}" to isHidden=${property.isHidden}`);
    res.status(200).json({ success: true, message: 'Visibility toggled successfully' });
  } catch (error) {
    console.error('Error toggling property visibility:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export async function deleteProperty(req: AuthenticatedRequest, res: Response) {
  try {
    const hostId = req.user?.id;
    const id = String(req.params.id || '');

    if (!hostId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: 'Invalid property ID' });
    }

    const property = await Property.findOne({ _id: id, hostId });
    if (!property || property.isDeleted) {
      return res.status(404).json({ success: false, error: 'Property not found or unauthorized' });
    }

    property.isDeleted = true;
    await property.save();

    // Cascade soft delete all rooms belonging to this property
    const { Room } = await import('../models/room');
    const updateResult = await Room.updateMany(
      { propertyId: id, status: { $ne: 'DELETED' } },
      { $set: { status: 'DELETED' } }
    );

    console.log(`[PROPERTY] 🗑️ Soft deleted property "${property.name}" (${property._id}) and ${updateResult.modifiedCount} rooms`);
    return res.status(200).json({ success: true, message: 'Dãy trọ và các phòng thuộc dãy đã được xóa thành công' });
  } catch (error: any) {
    console.error('Error deleting property:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
