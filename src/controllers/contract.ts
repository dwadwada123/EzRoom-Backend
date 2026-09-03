import { Request, Response } from 'express';
import { Contract } from '../models/contract';
import { Room } from '../models/room';
import { User } from '../models/user';
import { sendNotificationHelper } from './notification';
import { payOS } from '../config/payos';

function normalizePhone(p: string): string {
  if (!p) return '';
  let clean = p.trim().replace(/\s+/g, '');
  if (clean.startsWith('+84')) {
    clean = '0' + clean.substring(3);
  }
  return clean;
}

async function resolveContractRoomTitle(roomId: string, fallbackName?: string): Promise<string> {
  if (!roomId) return fallbackName || 'Phòng trọ';
  try {
    const room = await Room.findById(roomId);
    if (!room) return fallbackName || 'Phòng trọ';

    if (room.propertyId) {
      const { Property } = await import('../models/property');
      const prop = await Property.findById(room.propertyId);
      if (prop) {
        return `${room.title} - ${prop.name}`;
      }
    }
    return room.title;
  } catch (err) {
    return fallbackName || 'Phòng trọ';
  }
}

export async function createContract(req: Request, res: Response) {
  try {
    let { id, roomId, renterId, renterName, renterPhone, hostName, startDate, endDate, depositAmount, depositStatus, status, isProtected } = req.body;

    if (!hostName) {
      const authUser = (req as any).user;
      if (authUser && authUser.name) {
        hostName = authUser.name;
      } else {
        const room = await Room.findById(roomId);
        if (room && room.hostId) {
          const hostUser = await User.findById(room.hostId);
          hostName = hostUser ? hostUser.name : 'Chủ nhà';
        } else {
          hostName = 'Chủ nhà';
        }
      }
    }

    if (!id || !roomId || !renterName || !renterPhone || !startDate || !endDate || depositAmount === undefined) {
      return res.status(400).json({ success: false, error: 'Missing contract required parameters.' });
    }

    const normPhone = normalizePhone(renterPhone);
    const allUsers = await User.find({});
    const user = allUsers.find(u => normalizePhone(u.phone) === normPhone || u.phone.trim() === renterPhone.trim());

    if (user) {
      renterId = user._id.toString();
    } else if (!renterId) {
      renterId = 'user_' + normPhone;
    }

    const room = await Room.findById(roomId);
    const roomTitle = await resolveContractRoomTitle(roomId, room ? room.title : 'Phòng trọ');
    const roomAddress = room ? room.address : '';

    const numDeposit = Number(depositAmount) || 0;
    const initialDepositStatus = (numDeposit === 0 || depositStatus === 'FROZEN' || depositStatus === 'PAID') ? 'FROZEN' : (depositStatus || 'UNPAID');
    const initialStatus = status || 'WAITING_SIGN';

    const contract = new Contract({
      _id: id, roomId, roomName: roomTitle, address: roomAddress, renterId, renterName, renterPhone, hostName, startDate, endDate,
      depositAmount: numDeposit,
      depositStatus: initialDepositStatus,
      status: initialStatus,
      dateCreated: new Date().toLocaleDateString('vi-VN'),
      disburseDate: startDate,
      isProtected
    });
    await contract.save();

    if (initialStatus === 'ACTIVE' || initialDepositStatus === 'FROZEN') {
      await Room.findByIdAndUpdate(roomId, { status: 'RENTED' });
    }

    // Trigger Notification to Renter (Send ONLY 1 notification)
    const notifTitle = 'Hợp đồng thuê phòng mới';
    const notifMsg = `Chủ nhà ${hostName} đã gửi hợp đồng thuê "${roomTitle}". Vui lòng kiểm tra và ký xác nhận.`;

    if (user) {
      await sendNotificationHelper(user._id.toString(), notifTitle, notifMsg, 'CONTRACT', contract._id.toString());
    } else {
      await sendNotificationHelper(renterPhone.trim(), notifTitle, notifMsg, 'CONTRACT', contract._id.toString());
    }

    return res.status(201).json({ success: true, contract });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

export async function signContract(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const contract = await Contract.findById(id);
    if (!contract) {
      return res.status(404).json({ success: false, error: 'Contract not found.' });
    }

    // Prevent duplicate sign operations and duplicate host notifications
    if (contract.status === 'ACTIVE' || contract.status === 'WAITING_DEPOSIT') {
      return res.status(200).json({ success: true, contract });
    }

    const isZeroDeposit = Number(contract.depositAmount) === 0;
    contract.status = isZeroDeposit ? 'ACTIVE' : 'WAITING_DEPOSIT';
    if (isZeroDeposit) {
      contract.depositStatus = 'FROZEN';
      contract.isProtected = true;
    }
    contract.dateSigned = new Date().toLocaleDateString('vi-VN');
    await contract.save();

    if (contract.status === 'ACTIVE' || contract.depositStatus === 'FROZEN') {
      await Room.findByIdAndUpdate(contract.roomId, { status: 'RENTED' });
    }

    // Trigger Notification to Host
    const roomTitle = await resolveContractRoomTitle(contract.roomId, contract.roomName);
    const hostUserId = await getHostUserId(contract.roomId, contract.hostName);
    if (hostUserId) {
      await sendNotificationHelper(
        hostUserId,
        'Hợp đồng đã được ký',
        `Người thuê ${contract.renterName} đã ký xác nhận hợp đồng phòng "${roomTitle}".`,
        'CONTRACT',
        contract._id.toString()
      );
    }

    return res.status(200).json({ success: true, contract });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

export async function getPaymentQR(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const contract = await Contract.findById(id);
    if (!contract) {
      return res.status(404).json({ success: false, error: 'Contract not found.' });
    }

    const orderCode = Number(String(Date.now()).slice(-8)) + Math.floor(Math.random() * 100);

    let checkoutUrl = '';
    let qrCode = '';
    let accountNumber = '';
    let accountName = '';
    let bankName = 'MBBank (PayOS Escrow)';

    try {
      const paymentData = {
        orderCode,
        amount: contract.depositAmount,
        description: `Coc ${contract._id.toString().substring(0, 10)}`,
        cancelUrl: `https://ezroom.vn/payment/cancel`,
        returnUrl: `https://ezroom.vn/payment/success`
      };

      const paymentLinkRes: any = await payOS.paymentRequests.create(paymentData);
      checkoutUrl = paymentLinkRes?.checkoutUrl || '';
      qrCode = paymentLinkRes?.qrCode || '';
      accountNumber = paymentLinkRes?.accountNumber || '';
      accountName = paymentLinkRes?.accountName || '';
    } catch (e: any) {
      console.warn('[PAYOS] Warning creating payment link:', e?.message || e);
    }

    contract.orderCode = orderCode;
    await contract.save();

    return res.status(200).json({
      success: true,
      qrUrl: checkoutUrl,
      checkoutUrl,
      qrCode,
      accountNumber,
      accountName,
      bankName,
      depositAmount: contract.depositAmount
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

import { checkAndAutoDisburseContracts } from '../services/cronService';

async function getHostUserId(roomId: string, hostName?: string): Promise<string | null> {
  if (roomId) {
    const room = await Room.findById(roomId);
    if (room && room.hostId) return room.hostId;
  }
  if (hostName) {
    const hostUser = await User.findOne({ name: hostName, role: 'HOST' });
    if (hostUser) return hostUser._id.toString();
  }
  return null;
}

export async function confirmPayment(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const contract = await Contract.findById(id);
    if (!contract) {
      return res.status(404).json({ success: false, error: 'Contract not found.' });
    }

    if (contract.status === 'ACTIVE' || contract.depositStatus === 'FROZEN' || contract.depositStatus === 'DISBURSED') {
      return res.status(200).json({ success: true, contract, message: 'Hợp đồng đã được xác nhận thanh toán trước đó.' });
    }

    if (contract.orderCode) {
      try {
        const paymentInfo: any = await (payOS as any).paymentRequests.get(contract.orderCode);
        if (paymentInfo && paymentInfo.status !== 'PAID') {
          return res.status(400).json({
            success: false,
            error: 'Hệ thống PayOS chưa ghi nhận giao dịch chuyển khoản cho đơn hàng này. Vui lòng hoàn tất chuyển khoản và thử lại.'
          });
        }
      } catch (payosErr: any) {
        console.warn('[PAYOS VERIFY] Payment link query warning:', payosErr?.message || payosErr);
      }
    }

    contract.status = 'ACTIVE';
    contract.depositStatus = 'FROZEN';
    contract.isProtected = true;
    if (!contract.disburseDate) {
      contract.disburseDate = contract.startDate;
    }
    await contract.save();

    const room = await Room.findById(contract.roomId);
    if (room) {
      room.status = 'RENTED';
      await room.save();
    }

    const hostUserId = await getHostUserId(contract.roomId, contract.hostName);
    if (hostUserId) {
      const roomTitle = await resolveContractRoomTitle(contract.roomId, contract.roomName);
      await sendNotificationHelper(
        hostUserId,
        'Tiền cọc đã được thanh toán',
        `Người thuê ${contract.renterName} đã thanh toán tiền cọc ${(contract.depositAmount || 0).toLocaleString('vi-VN')}đ cho hợp đồng phòng "${roomTitle}".`,
        'CONTRACT',
        contract._id.toString()
      );
    }

    await checkAndAutoDisburseContracts();
    const updatedContract = await Contract.findById(id);

    return res.status(200).json({ success: true, contract: updatedContract || contract });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

export async function terminateContract(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { reason, cancelBy } = req.body;

    const contract = await Contract.findById(id);
    if (!contract) {
      return res.status(404).json({ success: false, error: 'Contract not found.' });
    }

    contract.status = 'TERMINATED';
    contract.cancelReason = reason || 'Chấm dứt hợp đồng sớm theo thỏa thuận';
    contract.cancelBy = cancelBy === 'HOST' ? 'HOST' : 'RENTER';

    if (cancelBy === 'HOST') {
      contract.depositStatus = 'REFUNDED';
    } else {
      contract.depositStatus = 'DISBURSED';
    }

    await contract.save();

    const room = await Room.findById(contract.roomId);
    if (room) {
      room.status = 'ACTIVE';
      await room.save();

      const isHostCancelling = cancelBy === 'HOST';
      const targetUserId = isHostCancelling ? contract.renterId : room.hostId;
      const senderRoleName = isHostCancelling ? 'Chủ nhà' : 'Người thuê';

      if (targetUserId) {
        await sendNotificationHelper(
          targetUserId,
          'Hợp đồng đã chấm dứt sớm',
          `${senderRoleName} đã yêu cầu chấm dứt hợp đồng phòng "${room.title}" với lý do: ${contract.cancelReason}`,
          'CONTRACT',
          contract._id.toString()
        );
      }
    }

    return res.status(200).json({ success: true, contract });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

export async function getContracts(req: Request, res: Response) {
  try {
    await checkAndAutoDisburseContracts();

    const userId = (req as any).user?.id || (req as any).user?._id;
    const user = await User.findById(userId);

    let query: any = {};
    if (user) {
      if (user.role === 'HOST') {
        const { Property } = await import('../models/property');
        const hostProperties = await Property.find({ hostId: user._id.toString() });
        const propertyIds = hostProperties.map(p => p._id.toString());
        const rooms = await Room.find({
          $or: [
            { propertyId: { $in: propertyIds } },
            { propertyId: null, hostId: user._id.toString() }
          ]
        });
        const roomIds = rooms.map(r => r._id);
        query = { roomId: { $in: roomIds } };
      } else {
        query = {
          $or: [
            { renterId: user._id },
            { renterPhone: user.phone }
          ]
        };
      }
    }

    const contracts = await Contract.find(query).sort({ createdAt: -1 });

    const mapped = await Promise.all(contracts.map(async (c) => {
      const obj = c.toObject();
      const resolvedTitle = await resolveContractRoomTitle(c.roomId, c.roomName);
      return {
        ...obj,
        id: obj._id,
        roomName: resolvedTitle
      };
    }));

    return res.status(200).json(mapped);
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

export async function getContractById(req: Request, res: Response) {
  try {
    await checkAndAutoDisburseContracts();

    const { id } = req.params;
    const contract = await Contract.findById(id);
    if (!contract) {
      return res.status(404).json({ success: false, error: 'Contract not found.' });
    }

    const obj = contract.toObject();
    const resolvedTitle = await resolveContractRoomTitle(contract.roomId, contract.roomName);
    return res.status(200).json({ ...obj, id: obj._id, roomName: resolvedTitle });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

export async function getHostTenants(req: Request, res: Response) {
  try {
    const { hostId } = req.params;
    const { Property } = await import('../models/property');
    const hostProperties = await Property.find({ hostId });
    const propertyIds = hostProperties.map(p => p._id.toString());
    const rooms = await Room.find({
      $or: [
        { propertyId: { $in: propertyIds } },
        { propertyId: null, hostId }
      ]
    });
    const roomIds = rooms.map(r => r._id.toString());

    const contracts = await Contract.find({ roomId: { $in: roomIds } });

    const tenants = await Promise.all(contracts.map(async (c) => {
      const resolvedTitle = await resolveContractRoomTitle(c.roomId, c.roomName);
      return {
        contractId: c._id,
        roomId: c.roomId,
        roomTitle: resolvedTitle,
        renterId: c.renterId,
        renterName: c.renterName,
        renterPhone: c.renterPhone,
        startDate: c.startDate,
        endDate: c.endDate,
        contractStatus: c.status,
        isCurrent: c.status === 'ACTIVE' || c.status === 'WAITING_DEPOSIT' || c.status === 'WAITING_SIGN'
      };
    }));

    return res.status(200).json({ success: true, tenants });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
}
