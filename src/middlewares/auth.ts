import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { User } from '../models/user';

const JWT_SECRET = process.env.JWT_SECRET || 'ezroom_secret_key_123';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: 'RENTER' | 'HOST' | 'ADMIN';
  };
}

export async function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'Authorization header missing or malformed.' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { id: string; email: string; role: 'RENTER' | 'HOST' | 'ADMIN' };
    req.user = decoded;

    if (decoded.role !== 'ADMIN') {
      const dbUser = await User.findById(decoded.id).select('status lockReason').lean();
      if (dbUser && dbUser.status === 'LOCKED') {
        return res.status(403).json({
          success: false,
          error: `Tài khoản của bạn đã bị khóa. Lý do: ${dbUser.lockReason || 'Vi phạm điều khoản sử dụng'}`
        });
      }
    }

    return next();
  } catch (error) {
    return res.status(401).json({ success: false, error: 'Invalid or expired token.' });
  }
}

export function roleMiddleware(allowedRoles: Array<'RENTER' | 'HOST' | 'ADMIN'>) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Unauthorized.' });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ success: false, error: 'Forbidden: Insufficient privileges.' });
    }
    return next();
  };
}
