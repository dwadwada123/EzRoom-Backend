import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { User } from '../models/user';

async function findUserByIdOrPhone(userId: string) {
  const cleanId = String(userId || '').trim();
  const conditions: any[] = [{ phone: cleanId }];
  if (mongoose.Types.ObjectId.isValid(cleanId)) {
    conditions.push({ _id: cleanId });
  }
  return User.findOne({ $or: conditions });
}

// --- Favorites ---
export async function addFavorite(req: Request, res: Response) {
  try {
    const { userId, roomId } = req.body;
    if (!userId || !roomId) {
      return res.status(400).json({ success: false, error: 'User ID and Room ID are required' });
    }

    const user = await findUserByIdOrPhone(userId);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const favorites = user.favoriteRoomIds || [];
    if (!favorites.includes(roomId)) {
      favorites.push(roomId);
      user.favoriteRoomIds = favorites;
      await user.save();
    }

    return res.status(200).json({ success: true, favoriteRoomIds: user.favoriteRoomIds });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

export async function removeFavorite(req: Request, res: Response) {
  try {
    const { userId, roomId } = req.body;
    if (!userId || !roomId) {
      return res.status(400).json({ success: false, error: 'User ID and Room ID are required' });
    }

    const user = await findUserByIdOrPhone(userId);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const favorites = user.favoriteRoomIds || [];
    const index = favorites.indexOf(roomId);
    if (index !== -1) {
      favorites.splice(index, 1);
      user.favoriteRoomIds = favorites;
      await user.save();
    }

    return res.status(200).json({ success: true, favoriteRoomIds: user.favoriteRoomIds });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

// --- Payment Accounts ---
export async function savePaymentAccount(req: Request, res: Response) {
  try {
    const { userId, account } = req.body; // account contains id, bank, accountNumber, accountOwner, isDefault
    if (!userId || !account) {
      return res.status(400).json({ success: false, error: 'User ID and account details are required' });
    }

    const user = await findUserByIdOrPhone(userId);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const accountId = (account.id && String(account.id).trim().length > 0)
      ? String(account.id)
      : new mongoose.Types.ObjectId().toString();

    const normalizedAccount = {
      ...account,
      id: accountId
    };

    const accounts = Array.isArray(user.paymentAccounts) ? [...user.paymentAccounts] : [];
    const index = accounts.findIndex((a: any) => a.id === accountId);
    if (index !== -1) {
      accounts[index] = { ...accounts[index], ...normalizedAccount };
    } else {
      const isFirst = accounts.length === 0;
      accounts.push({
        ...normalizedAccount,
        isDefault: isFirst || Boolean(normalizedAccount.isDefault)
      });
    }

    user.paymentAccounts = accounts;
    user.markModified('paymentAccounts');
    await user.save();

    console.log(`[PAYMENT ACCOUNT] 💳 Saved payment account ${accountId} for user ${user.name} (${user.phone})`);
    return res.status(200).json({ success: true, paymentAccounts: user.paymentAccounts });
  } catch (error: any) {
    console.error('Error saving payment account:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

export async function deletePaymentAccount(req: Request, res: Response) {
  try {
    const { userId, accountId } = req.body;
    if (!userId || !accountId) {
      return res.status(400).json({ success: false, error: 'User ID and Account ID are required' });
    }

    const user = await findUserByIdOrPhone(userId);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const accounts = Array.isArray(user.paymentAccounts) ? [...user.paymentAccounts] : [];
    const index = accounts.findIndex((a: any) => a.id === String(accountId));
    if (index !== -1) {
      const wasDefault = accounts[index].isDefault;
      accounts.splice(index, 1);
      if (wasDefault && accounts.length > 0) {
        accounts[0].isDefault = true;
      }
      user.paymentAccounts = accounts;
      user.markModified('paymentAccounts');
      await user.save();
    }

    console.log(`[PAYMENT ACCOUNT] 🗑️ Deleted payment account ${accountId} for user ${user.name}`);
    return res.status(200).json({ success: true, paymentAccounts: user.paymentAccounts });
  } catch (error: any) {
    console.error('Error deleting payment account:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

export async function setDefaultPaymentAccount(req: Request, res: Response) {
  try {
    const { userId, accountId } = req.body;
    if (!userId || !accountId) {
      return res.status(400).json({ success: false, error: 'User ID and Account ID are required' });
    }

    const user = await findUserByIdOrPhone(userId);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const accounts = Array.isArray(user.paymentAccounts) ? [...user.paymentAccounts] : [];
    accounts.forEach((a: any) => {
      a.isDefault = a.id === String(accountId);
    });

    user.paymentAccounts = accounts;
    user.markModified('paymentAccounts');
    await user.save();

    console.log(`[PAYMENT ACCOUNT] ⭐ Set default payment account ${accountId} for user ${user.name}`);
    return res.status(200).json({ success: true, paymentAccounts: user.paymentAccounts });
  } catch (error: any) {
    console.error('Error setting default payment account:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
