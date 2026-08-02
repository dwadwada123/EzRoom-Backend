import { Request, Response } from 'express';
import { User } from '../models/user';

// --- Favorites ---
export async function addFavorite(req: Request, res: Response) {
  try {
    const { userId, roomId } = req.body;
    if (!userId || !roomId) {
      return res.status(400).json({ success: false, error: 'User ID and Room ID are required' });
    }

    const user = await User.findById(userId);
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

    const user = await User.findById(userId);
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
    if (!userId || !account || !account.id) {
      return res.status(400).json({ success: false, error: 'User ID and account details are required' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const accounts = user.paymentAccounts || [];
    const index = accounts.findIndex((a: any) => a.id === account.id);
    if (index !== -1) {
      accounts[index] = account;
    } else {
      const isFirst = accounts.length === 0;
      accounts.push({ ...account, isDefault: isFirst || account.isDefault });
    }

    user.paymentAccounts = accounts;
    user.markModified('paymentAccounts');
    await user.save();

    return res.status(200).json({ success: true, paymentAccounts: user.paymentAccounts });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

export async function deletePaymentAccount(req: Request, res: Response) {
  try {
    const { userId, accountId } = req.body;
    if (!userId || !accountId) {
      return res.status(400).json({ success: false, error: 'User ID and Account ID are required' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const accounts = user.paymentAccounts || [];
    const index = accounts.findIndex((a: any) => a.id === accountId);
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

    return res.status(200).json({ success: true, paymentAccounts: user.paymentAccounts });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

export async function setDefaultPaymentAccount(req: Request, res: Response) {
  try {
    const { userId, accountId } = req.body;
    if (!userId || !accountId) {
      return res.status(400).json({ success: false, error: 'User ID and Account ID are required' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const accounts = user.paymentAccounts || [];
    accounts.forEach((a: any) => {
      a.isDefault = a.id === accountId;
    });

    user.paymentAccounts = accounts;
    user.markModified('paymentAccounts');
    await user.save();

    return res.status(200).json({ success: true, paymentAccounts: user.paymentAccounts });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
}
