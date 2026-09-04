import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { User } from '../models/user';
import { Otp } from '../models/otp';
import { sendOtpEmail } from '../services/mailer';
import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// B-03: Guard – crash on startup if JWT_SECRET is missing or too weak
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET.length < 32) {
  throw new Error('FATAL: JWT_SECRET is missing or too short. Set a strong 64-byte random secret in .env');
}
// After the guard above, cast to string so TypeScript is satisfied across module scope
const JWT_SECRET_STR: string = JWT_SECRET;

// Strip sensitive fields and normalize _id -> id before returning user to client
function sanitizeUser(user: any) {
  const obj = user.toObject ? user.toObject() : { ...user };
  delete obj.password;
  // Map MongoDB _id to id for Android client compatibility
  if (obj._id !== undefined) {
    obj.id = obj._id.toString();
    delete obj._id;
  }
  if (obj.__v !== undefined) delete obj.__v;
  return obj;
}

export async function register(req: Request, res: Response) {
  try {
    const { name, email, phone, avatarUrl, role, password } = req.body;
    if ( !name || !email || !phone || !role) {
      return res.status(400).json({ success: false, error: 'Missing required registration parameters' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ success: false, error: 'Email already registered.' });
    }

    // B-01: Hash password with bcrypt before saving
    const hashedPassword = password ? await bcrypt.hash(password, 12) : '';
    const user = new User({ name, email, phone, avatarUrl, role, password: hashedPassword });
    await user.save();

    // A-03: Extended token lifetime to 30 days
    const token = jwt.sign(
      { id: user._id, email: user.email, role: user.role },
      JWT_SECRET_STR,
      { expiresIn: '30d' }
    );

    return res.status(201).json({ success: true, token, user: sanitizeUser(user) });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

export async function login(req: Request, res: Response) {
  try {
    const { email, password } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, error: 'Email is required' });
    }

    let user = await User.findOne({ email : email.trim() });

    if (!user) {
      return res.status(400).json({ success: false, error: 'Email hoặc mật khẩu không chính xác.' });
    }

    if (user.status === 'LOCKED') {
      return res.status(403).json({
        success: false,
        error: `Tài khoản của bạn đã bị khóa. Lý do: ${user.lockReason || 'Vi phạm điều khoản sử dụng'}`
      });
    }

    // B-01: Use bcrypt.compare for password verification
    if (user.password && password) {
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(400).json({ success: false, error: 'Email hoặc mật khẩu không chính xác.' });
      }
    }

    // A-03: Extended to 30 days
    const token = jwt.sign(
      { id: user._id, email: user.email, role: user.role },
      JWT_SECRET_STR,
      { expiresIn: '30d' }
    );

    return res.status(200).json({ success: true, token, user: sanitizeUser(user) });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

export async function submitEkyc(req: Request, res: Response) {
  try {
    const { userId, idCardNumber, frontImageUrl, backImageUrl, selfieUrl } = req.body;
    if (!userId || !idCardNumber || !frontImageUrl || !backImageUrl) {
      return res.status(400).json({ success: false, error: 'Missing eKYC documents.' });
    }
    
    // Validate CCCD: exactly 9 or 12 digits
    const cccdRegex = /^[0-9]{9}$|^[0-9]{12}$/;
    if (!cccdRegex.test(idCardNumber)) {
      return res.status(400).json({ success: false, error: 'Số CCCD/CMND không hợp lệ. Phải gồm 9 hoặc 12 chữ số.' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found.' });
    }

    user.isEkycVerified = false;
    user.ekycStatus = 'PENDING';
    user.ekycRejectReason = ''; // Reset rejection reason on new submission
    user.idCardNumber = idCardNumber;
    user.idCardFrontUrl = frontImageUrl;
    user.idCardBackUrl = backImageUrl;
    user.selfieUrl = selfieUrl || '';
    user.dateSubmittedEkyc = new Date().toLocaleDateString('vi-VN');

    await user.save();

    return res.status(200).json({ success: true, message: 'eKYC documents submitted. Awaiting moderation.' });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

export async function uploadEkycImage(req: Request, res: Response) {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No image provided' });
    }

    const b64 = Buffer.from(req.file.buffer).toString('base64');
    const dataURI = "data:" + req.file.mimetype + ";base64," + b64;
    
    const result = await cloudinary.uploader.upload(dataURI, {
      folder: 'ezroom_ekyc'
    });

    return res.status(200).json({ success: true, url: result.secure_url });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

export async function adminLogin(req: Request, res: Response) {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, error: 'Username and password are required.' });
    }

    // B-02: Admin credentials loaded from env, not hardcoded in source code
    const ADMIN_USERNAME = process.env.ADMIN_USERNAME;
    const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH;

    if (!ADMIN_USERNAME || !ADMIN_PASSWORD_HASH) {
      return res.status(500).json({ success: false, error: 'Admin credentials not configured on server.' });
    }

    const usernameMatch = username === ADMIN_USERNAME || username === 'admin@ezroom.com';
    const passwordMatch = await bcrypt.compare(password, ADMIN_PASSWORD_HASH);

    if (usernameMatch && passwordMatch) {
      const token = jwt.sign(
        { id: 'admin_1', email: 'admin@ezroom.com', role: 'ADMIN' },
        JWT_SECRET_STR,
        { expiresIn: '7d' }
      );
      return res.status(200).json({ success: true, token });
    } else {
      return res.status(401).json({ success: false, error: 'Invalid username or password.' });
    }
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

import { AuthenticatedRequest } from '../middlewares/auth';
import mongoose from 'mongoose';

export async function getProfile(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Unauthorized.' });
    }
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found.' });
    }
    return res.status(200).json({ success: true, user: sanitizeUser(user) });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

export async function updateProfile(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Unauthorized.' });
    }
    const { name, phone } = req.body;
    if (!name || !phone) {
      return res.status(400).json({ success: false, error: 'Name and phone are required.' });
    }
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found.' });
    }
    user.name = name;
    user.phone = phone;
    await user.save();
    return res.status(200).json({ success: true, user: sanitizeUser(user) });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

export async function changePassword(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Unauthorized.' });
    }
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, error: 'Current password and new password are required.' });
    }
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found.' });
    }

    // B-01: Verify current password using bcrypt
    if (user.password) {
      const isMatch = await bcrypt.compare(currentPassword, user.password);
      if (!isMatch) {
        return res.status(400).json({ success: false, error: 'Mat khau hien tai khong dung.' });
      }
    }

    // B-01: Hash new password before saving
    user.password = await bcrypt.hash(newPassword, 12);
    await user.save();
    return res.status(200).json({ success: true, message: 'Doi mat khau thanh cong.' });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

export async function forgotPassword(req: Request, res: Response) {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, error: 'Email là bắt buộc.' });
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ success: false, error: 'Email không tồn tại trong hệ thống.' });
    }

    const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();

    await Otp.deleteMany({ email });

    await Otp.create({
      _id: new mongoose.Types.ObjectId(Date.now().toString() + Math.random().toString(16).substring(2, 13)),
      email,
      otp: generatedOtp
    })
    
    await sendOtpEmail(email, generatedOtp);

    return res.status(200).json({
      success: true,
      message: 'Mã OTP 6 chữ số đã được gửi. Vui lòng kiểm tra email của bạn.',
      otp: process.env.NODE_ENV === 'production' ? undefined : generatedOtp
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

export async function resetPassword(req: Request, res: Response) {
  try {
    const { email, otp, newPassword } = req.body;
    if (!email || !otp || !newPassword) {
      return res.status(400).json({ success: false, error: 'Email, mã OTP và mật khẩu mới là bắt buộc.' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ success: false, error: 'Tài khoản không tồn tại.' });
    }

    // Production-Grade: Verify OTP against unexpired entry in MongoDB
    const validOtpEntry = await Otp.findOne({ email, otp });
    if (!validOtpEntry) {
      return res.status(400).json({ success: false, error: 'Mã OTP không chính xác hoặc đã hết hạn (sau 5 phút).' });
    }

    // Hash new password using bcrypt (12 rounds)
    user.password = await bcrypt.hash(newPassword, 12);
    await user.save();

    // Delete used OTP so it cannot be reused
    await Otp.deleteMany({ email });

    return res.status(200).json({
      success: true,
      message: 'Đổi mật khẩu thành công. Vui lòng đăng nhập lại.'
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

export async function checkPhone(req: Request, res: Response) {
  try {
    const phone = req.params.phone as string;

    console.log(phone);

    if (!phone) {
      return res.status(400).json({ success: false, error: 'Phone number is required' });
    }

    const user = await User.findOne({ phone: phone.trim() });

    console.log(user);

    if (user) {
      return res.status(200).json({
        success: true,
        exists: true,
        user: { id: user._id, name: user.name, phone: user.phone, avatarUrl: user.avatarUrl }
      });
    } else {
      return res.status(200).json({ success: true, exists: false });
    }
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
}


