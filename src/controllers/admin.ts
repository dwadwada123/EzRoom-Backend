import { Request, Response } from 'express';
import { Contract } from '../models/contract';
import { User } from '../models/user';
import { Room } from '../models/room';
import { processEscrowDisbursals } from '../tasks/escrow';

export async function getAdminContracts(req: Request, res: Response) {
  try {
    const contracts = await Contract.find({});
    return res.status(200).json(contracts);
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

export async function getAdminDisputes(req: Request, res: Response) {
  try {
    const disputes = await Contract.find({ status: 'DISPUTED' });
    return res.status(200).json(disputes);
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

export async function resolveDispute(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { status, resolutionNote } = req.body; // APPROVED (renter win) or REJECTED (host win)
    if (!status || !resolutionNote) {
      return res.status(400).json({ success: false, error: 'Missing status or resolution note.' });
    }

    const contract = await Contract.findById(id);
    if (!contract) {
      return res.status(404).json({ success: false, error: 'Contract not found.' });
    }

    if (status === 'APPROVED') {
      // Approve renter claim -> refund Renter
      contract.depositStatus = 'REFUNDED';
      contract.status = 'TERMINATED';
      contract.refundInfo = {
        bankName: contract.refundInfo?.bankName || 'Demo Bank',
        accountNumber: contract.refundInfo?.accountNumber || '123456',
        accountOwner: contract.refundInfo?.accountOwner || contract.renterName,
        status: 'COMPLETED'
      };
    } else if (status === 'REJECTED') {
      // Reject renter claim -> disburse to Host
      contract.depositStatus = 'DISBURSED';
      contract.status = 'ACTIVE';
      contract.disburseDate = new Date().toLocaleDateString('vi-VN');
    } else {
      return res.status(400).json({ success: false, error: 'Invalid resolution status. Must be APPROVED or REJECTED.' });
    }

    await contract.save();
    return res.status(200).json({ success: true, message: 'Dispute resolved.', contract });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

export async function getPendingEkyc(req: Request, res: Response) {
  try {
    // Users that have submitted eKYC but isEkycVerified is false
    const pendingUsers = await User.find({ isEkycVerified: false });
    return res.status(200).json(pendingUsers);
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

export async function moderateEkyc(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { action, note } = req.body; // APPROVE or REJECT
    if (!action) {
      return res.status(400).json({ success: false, error: 'Action is required.' });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found.' });
    }

    if (action === 'APPROVE') {
      user.isEkycVerified = true;
    } else if (action === 'REJECT') {
      user.isEkycVerified = false;
    } else {
      return res.status(400).json({ success: false, error: 'Invalid action. Must be APPROVE or REJECT.' });
    }

    await user.save();
    return res.status(200).json({ success: true, message: `eKYC successfully moderated to ${action}.`, user });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

export async function getRoomsModeration(req: Request, res: Response) {
  try {
    // Rooms in PENDING status
    const rooms = await Room.find({ status: 'PENDING' });
    return res.status(200).json(rooms);
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

export async function moderateRoom(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { action, reason } = req.body; // APPROVE, REJECT, LOCK, HIDE
    if (!action) {
      return res.status(400).json({ success: false, error: 'Action is required.' });
    }

    const room = await Room.findById(id);
    if (!room) {
      return res.status(404).json({ success: false, error: 'Room not found.' });
    }

    if (action === 'APPROVE') {
      room.status = 'ACTIVE';
    } else if (action === 'REJECT' || action === 'LOCK') {
      room.status = 'REMOVED';
      room.removalInfo = {
        reason: reason || 'Moderator action',
        dateRemoved: new Date().toLocaleDateString('vi-VN')
      };
    } else if (action === 'HIDE') {
      room.status = 'HIDDEN';
    } else {
      return res.status(400).json({ success: false, error: 'Invalid moderation action.' });
    }

    await room.save();
    return res.status(200).json({ success: true, message: 'Room successfully moderated.', room });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

export async function triggerEscrowTask(req: Request, res: Response) {
  const processed = await processEscrowDisbursals();
  return res.status(200).json({ success: true, processed });
}
