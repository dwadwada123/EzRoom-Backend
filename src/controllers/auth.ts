import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { User } from '../models/user';

const JWT_SECRET = process.env.JWT_SECRET || 'ezroom_secret_key_123';

export async function register(req: Request, res: Response) {
  try {
    const { id, name, email, phone, avatarUrl, role } = req.body;
    if (!id || !name || !email || !phone || !role) {
      return res.status(400).json({ success: false, error: 'Missing required registration parameters' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ success: false, error: 'Email already registered.' });
    }

    const user = new User({ _id: id, name, email, phone, avatarUrl, role });
    await user.save();
    return res.status(201).json({ success: true, user });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

export async function login(req: Request, res: Response) {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, error: 'Email is required' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    // Generate real JWT token
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.status(200).json({ success: true, token, user });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

export async function submitEkyc(req: Request, res: Response) {
  try {
    const { userId, idCardNumber, frontImageUrl, backImageUrl } = req.body;
    if (!userId || !idCardNumber || !frontImageUrl || !backImageUrl) {
      return res.status(400).json({ success: false, error: 'Missing eKYC documents.' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found.' });
    }

    // Update isEkycVerified status to false initially (pending admin review)
    user.isEkycVerified = false;
    await user.save();

    return res.status(200).json({ success: true, message: 'eKYC documents submitted. Awaiting moderation.' });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
}
