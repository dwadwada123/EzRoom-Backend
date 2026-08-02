import { Request, Response } from 'express';
import Amenity from '../models/amenity';

export const getAmenities = async (req: Request, res: Response) => {
  try {
    const amenities = await Amenity.find({ isDeleted: { $ne: true } });
    res.json(amenities);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

export const createAmenity = async (req: Request, res: Response) => {
  try {
    const amenity = new Amenity(req.body);
    await amenity.save();
    res.status(201).json(amenity);
  } catch (err) {
    res.status(400).json({ error: 'Bad request' });
  }
};

export const updateAmenity = async (req: Request, res: Response) => {
  try {
    const amenity = await Amenity.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(amenity);
  } catch (err) {
    res.status(400).json({ error: 'Bad request' });
  }
};

export const deleteAmenity = async (req: Request, res: Response) => {
  try {
    await Amenity.findByIdAndUpdate(req.params.id, { isDeleted: true });
    res.json({ message: 'Deleted successfully' });
  } catch (err) {
    res.status(400).json({ error: 'Bad request' });
  }
};