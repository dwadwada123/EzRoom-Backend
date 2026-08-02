import { Request, Response } from 'express';
import { Invoice } from '../models/invoice';
import { Contract } from '../models/contract';
import { Room } from '../models/room';
import { Message } from '../models/message';
import { Conversation } from '../models/conversation';
import { sendNotificationHelper } from './notification';
import { payOS } from '../config/payos';

export async function createInvoice(req: Request, res: Response) {
  try {
    const { id, roomId, roomName, period, roomPrice, oldElectricity, newElectricity, oldWater, newWater, otherCosts } = req.body;
    if (!id || !roomId || !roomName || !period || roomPrice === undefined || oldElectricity === undefined || newElectricity === undefined || oldWater === undefined || newWater === undefined) {
      return res.status(400).json({ success: false, error: 'Missing invoice parameters.' });
    }

    const invoice = new Invoice({
      _id: id, roomId, roomName, period, roomPrice, oldElectricity, newElectricity, oldWater, newWater, otherCosts,
      status: 'UNPAID', type: 'RENT', dateCreated: new Date().toLocaleDateString('vi-VN')
    });
    await invoice.save();
    console.log(`[INVOICE] 🧾 Created invoice ${id} for room "${roomName}" (${roomId})`);

    // Trigger Notification to Renter of this Room
    const activeContract = await Contract.findOne({
      roomId,
      status: { $in: ['ACTIVE', 'WAITING_DEPOSIT', 'WAITING_SIGN'] }
    }).sort({ dateCreated: -1 });

    if (activeContract && activeContract.renterId) {
      console.log(`[INVOICE NOTIF] 🔔 Sending invoice notification to renter ${activeContract.renterId}`);
      await sendNotificationHelper(
        activeContract.renterId,
        'Hóa đơn thanh toán mới',
        `Hóa đơn phòng "${roomName}" cho kỳ ${period} đã được tạo. Vui lòng thanh toán sớm.`,
        'INVOICE',
        invoice._id
      );
    } else {
      console.log(`[INVOICE NOTIF WARNING] Could not find active contract or renterId for room ${roomId}`);
    }

    return res.status(201).json({ success: true, invoice });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

export async function getInvoiceById(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const invoice = await Invoice.findById(id);
    if (!invoice) {
      return res.status(404).json({ success: false, error: 'Invoice not found.' });
    }
    const room = await Room.findById(invoice.roomId);
    const contract = await Contract.findOne({ roomId: invoice.roomId, status: { $in: ['ACTIVE', 'WAITING_DEPOSIT', 'WAITING_SIGN'] } });
    
    const obj = invoice.toObject();
    const elecPrice = room?.electricityPrice || 3500;
    const waterPrice = room?.waterPrice || 15000;
    const elecDiff = Math.max(0, invoice.newElectricity - invoice.oldElectricity);
    const waterDiff = Math.max(0, invoice.newWater - invoice.oldWater);
    const extraCostsTotal = (invoice.otherCosts || []).reduce((sum, item) => sum + item.amount, 0);
    const calculatedTotal = invoice.roomPrice + (elecDiff * elecPrice) + (waterDiff * waterPrice) + extraCostsTotal;

    const enrichedInvoice = {
      ...obj,
      id: obj._id,
      renterName: contract?.renterName || 'Không rõ',
      renterPhone: contract?.renterPhone || 'Không rõ',
      totalAmount: calculatedTotal,
      electricityPrice: elecPrice,
      waterPrice: waterPrice
    };

    return res.status(200).json(enrichedInvoice);
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

export async function getInvoicePaymentQR(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const invoice = await Invoice.findById(id);
    if (!invoice) {
      return res.status(404).json({ success: false, error: 'Invoice not found.' });
    }

    const room = await Room.findById(invoice.roomId);
    const electricityRate = room?.electricityPrice || 3500;
    const waterRate = room?.waterPrice || 15000;

    const elecDiff = Math.max(0, invoice.newElectricity - invoice.oldElectricity);
    const waterDiff = Math.max(0, invoice.newWater - invoice.oldWater);
    const extraCostsTotal = (invoice.otherCosts || []).reduce((sum, item) => sum + item.amount, 0);

    const totalAmount = invoice.roomPrice + (elecDiff * electricityRate) + (waterDiff * waterRate) + extraCostsTotal;

    const orderCode = Number(String(Date.now()).slice(-8)) + Math.floor(Math.random() * 100);

    let checkoutUrl = '';
    let qrCode = '';
    let accountNumber = '';
    let accountName = '';
    let bankName = 'MBBank (PayOS Escrow)';

    try {
      const paymentData = {
        orderCode,
        amount: totalAmount,
        description: `HD ${invoice._id.substring(0, 10)}`,
        cancelUrl: `https://ezroom.vn/payment/cancel`,
        returnUrl: `https://ezroom.vn/payment/success`
      };

      const paymentLinkRes: any = await payOS.paymentRequests.create(paymentData);
      checkoutUrl = paymentLinkRes?.checkoutUrl || '';
      qrCode = paymentLinkRes?.qrCode || '';
      accountNumber = paymentLinkRes?.accountNumber || '';
      accountName = paymentLinkRes?.accountName || '';
    } catch (e: any) {
      console.warn('[PAYOS INVOICE] Warning creating payment link:', e?.message || e);
    }

    invoice.orderCode = orderCode;
    await invoice.save();

    return res.status(200).json({
      success: true,
      qrUrl: checkoutUrl,
      checkoutUrl,
      qrCode,
      accountNumber,
      accountName,
      bankName,
      totalAmount
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

export async function payInvoice(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { paymentMethod } = req.body;
    if (!paymentMethod) {
      return res.status(400).json({ success: false, error: 'Payment method is required.' });
    }

    const invoice = await Invoice.findById(id);
    if (!invoice) {
      return res.status(404).json({ success: false, error: 'Invoice not found.' });
    }

    if (invoice.status === 'PAID') {
      return res.status(200).json({ success: true, invoice });
    }

    if (invoice.orderCode) {
      try {
        const paymentInfo: any = await (payOS as any).paymentRequests.get(invoice.orderCode);
        if (paymentInfo && paymentInfo.status !== 'PAID') {
          return res.status(400).json({
            success: false,
            error: 'Hệ thống PayOS chưa ghi nhận giao dịch chuyển khoản cho đơn hàng này. Vui lòng hoàn tất chuyển khoản và thử lại.'
          });
        }
      } catch (payosErr: any) {
        console.warn('[PAYOS VERIFY INVOICE] Warning querying payment link:', payosErr?.message || payosErr);
      }
    }

    // Dynamic rates from Room model (with fallbacks)
    const room = await Room.findById(invoice.roomId);
    const electricityRate = room?.electricityPrice || 3500;
    const waterRate = room?.waterPrice || 15000;

    // Calculation total amount
    const elecDiff = Math.max(0, invoice.newElectricity - invoice.oldElectricity);
    const waterDiff = Math.max(0, invoice.newWater - invoice.oldWater);
    const extraCostsTotal = (invoice.otherCosts || []).reduce((sum, item) => sum + item.amount, 0);

    const totalAmount = invoice.roomPrice + (elecDiff * electricityRate) + (waterDiff * waterRate) + extraCostsTotal;

    // Commission: 5% of static roomPrice
    const commission = Math.round(invoice.roomPrice * 0.05);
    const finalRevenue = totalAmount - commission;

    invoice.status = 'PAID';
    invoice.paymentMethod = paymentMethod || 'VietQR (PayOS Escrow)';
    invoice.commission = commission;
    invoice.finalRevenue = finalRevenue;

    await invoice.save();

    // Trigger Notification to Host
    if (room && room.hostId) {
      await sendNotificationHelper(
        room.hostId,
        'Hóa đơn đã được thanh toán',
        `Hóa đơn phòng "${invoice.roomName}" (${invoice.period}) đã được thanh toán qua ${paymentMethod}. Số tiền thực nhận: ${(finalRevenue || 0).toLocaleString('vi-VN')}đ (Đã khấu trừ 5% phí hoa hồng sàn).`,
        'INVOICE',
        invoice._id
      );
    }

    return res.status(200).json({ success: true, invoice, totalAmount });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

export async function getInvoices(req: Request, res: Response) {
  try {
    const user = (req as any).user;
    let filter: any = {};

    if (user) {
      if (user.role === 'HOST') {
        const { Property } = await import('../models/property');
        const hostProperties = await Property.find({ hostId: user.id });
        const propertyIds = hostProperties.map(p => p._id);
        const rooms = await Room.find({
          $or: [
            { propertyId: { $in: propertyIds } },
            { propertyId: null, hostId: user.id }
          ]
        });
        const roomIds = rooms.map(r => r._id);
        filter = { roomId: { $in: roomIds } };
      } else if (user.role === 'RENTER') {
        const contracts = await Contract.find({
          $or: [
            { renterId: user.id },
            { renterPhone: user.phone }
          ]
        });
        const roomIds = contracts.map(c => c.roomId);
        filter = { roomId: { $in: roomIds } };
      }
    }

    const invoices = await Invoice.find(filter).sort({ dateCreated: -1 });
    const rooms = await Room.find();
    const roomMap = new Map(rooms.map(r => [r._id, r]));

    const activeContracts = await Contract.find({ status: { $in: ['ACTIVE', 'WAITING_DEPOSIT', 'WAITING_SIGN'] } });
    const contractMap = new Map(activeContracts.map(c => [c.roomId, c]));

    const mapped = invoices.map(inv => {
      const room = roomMap.get(inv.roomId);
      const contract = contractMap.get(inv.roomId);
      const obj = inv.toObject();

      const elecPrice = room?.electricityPrice || 3500;
      const waterPrice = room?.waterPrice || 15000;
      const elecDiff = Math.max(0, inv.newElectricity - inv.oldElectricity);
      const waterDiff = Math.max(0, inv.newWater - inv.oldWater);
      const extraCostsTotal = (inv.otherCosts || []).reduce((sum, item) => sum + item.amount, 0);

      const calculatedTotal = inv.roomPrice + (elecDiff * elecPrice) + (waterDiff * waterPrice) + extraCostsTotal;

      return {
        ...obj,
        id: obj._id,
        renterName: contract?.renterName || 'Nguyễn Văn A',
        renterPhone: contract?.renterPhone || '0901234567',
        totalAmount: calculatedTotal,
        electricityPrice: elecPrice,
        waterPrice: waterPrice
      };
    });

    return res.status(200).json(mapped);
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

export async function remindInvoice(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const invoice = await Invoice.findById(id);
    if (!invoice) {
      return res.status(404).json({ success: false, error: 'Invoice not found' });
    }

    const room = await Room.findById(invoice.roomId);
    const contract = await Contract.findOne({
      roomId: invoice.roomId,
      status: { $in: ['ACTIVE', 'WAITING_DEPOSIT', 'WAITING_SIGN'] }
    }).sort({ dateCreated: -1 });

    const renterId = contract?.renterId;
    const hostId = room?.hostId || (req as any).user?.id;

    if (!renterId) {
      return res.status(400).json({ success: false, error: 'Không tìm thấy thông tin người thuê phòng này' });
    }

    const elecPrice = room?.electricityPrice || 3500;
    const waterPrice = room?.waterPrice || 15000;
    const elecDiff = Math.max(0, invoice.newElectricity - invoice.oldElectricity);
    const waterDiff = Math.max(0, invoice.newWater - invoice.oldWater);
    const extraCostsTotal = (invoice.otherCosts || []).reduce((sum, item) => sum + item.amount, 0);
    const totalAmount = invoice.roomPrice + (elecDiff * elecPrice) + (waterDiff * waterPrice) + extraCostsTotal;

    const notifMsg = `Chủ nhà nhắc bạn thanh toán hóa đơn phòng "${invoice.roomName}" (${invoice.period}) với tổng số tiền ${totalAmount.toLocaleString('vi-VN')}đ. Vui lòng thanh toán sớm qua cổng PayOS.`;

    // 1. Send Notification
    await sendNotificationHelper(renterId, 'Nhắc thanh toán hóa đơn', notifMsg, 'INVOICE', invoice._id);

    // 2. Send Chat Message
    let conv = await Conversation.findOne({
      $or: [
        { renterId, hostId },
        { renterId: hostId, hostId: renterId }
      ]
    });
    if (!conv) {
      conv = new Conversation({
        _id: `${renterId}_${hostId}`,
        renterId,
        hostId,
        lastMessageText: notifMsg,
        lastMessageTime: new Date().toISOString()
      });
      await conv.save();
    } else {
      conv.lastMessageText = notifMsg;
      conv.lastMessageTime = new Date().toISOString();
      await conv.save();
    }

    const msg = new Message({
      _id: Date.now().toString() + Math.random().toString(36).substring(2, 6),
      conversationId: conv._id,
      senderId: hostId,
      content: `[NHẮC THANH TOÁN HÓA ĐƠN KỲ ${invoice.period}]\n• Phòng: ${invoice.roomName}\n• Tổng tiền: ${totalAmount.toLocaleString('vi-VN')}đ\n• Nội dung: ${notifMsg}`,
      timestamp: Date.now().toString()
    });
    await msg.save();

    return res.status(200).json({ success: true, message: `Đã gửi tin nhắn nhắc thanh toán tới ${contract?.renterName || 'người thuê'}!` });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

export async function sendInvoiceReceipt(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const invoice = await Invoice.findById(id);
    if (!invoice) {
      return res.status(404).json({ success: false, error: 'Invoice not found' });
    }

    const room = await Room.findById(invoice.roomId);
    const contract = await Contract.findOne({
      roomId: invoice.roomId,
      status: { $in: ['ACTIVE', 'WAITING_DEPOSIT', 'WAITING_SIGN'] }
    }).sort({ dateCreated: -1 });

    const renterId = contract?.renterId;
    const hostId = room?.hostId || (req as any).user?.id;

    if (!renterId) {
      return res.status(400).json({ success: false, error: 'Không tìm thấy thông tin người thuê phòng này' });
    }

    const elecPrice = room?.electricityPrice || 3500;
    const waterPrice = room?.waterPrice || 15000;
    const elecDiff = Math.max(0, invoice.newElectricity - invoice.oldElectricity);
    const waterDiff = Math.max(0, invoice.newWater - invoice.oldWater);
    const extraCostsTotal = (invoice.otherCosts || []).reduce((sum, item) => sum + item.amount, 0);
    const totalAmount = invoice.roomPrice + (elecDiff * elecPrice) + (waterDiff * waterPrice) + extraCostsTotal;

    const notifMsg = `Chủ nhà đã gửi biên lai xác nhận thanh toán hóa đơn phòng "${invoice.roomName}" (${invoice.period}). Số tiền: ${totalAmount.toLocaleString('vi-VN')}đ. Cảm ơn bạn!`;

    // 1. Send Notification
    await sendNotificationHelper(renterId, 'Biên lai thanh toán hóa đơn', notifMsg, 'INVOICE', invoice._id);

    // 2. Send Chat Message
    let conv = await Conversation.findOne({
      $or: [
        { renterId, hostId },
        { renterId: hostId, hostId: renterId }
      ]
    });
    if (!conv) {
      conv = new Conversation({
        _id: `${renterId}_${hostId}`,
        renterId,
        hostId,
        lastMessageText: notifMsg,
        lastMessageTime: new Date().toISOString()
      });
      await conv.save();
    } else {
      conv.lastMessageText = notifMsg;
      conv.lastMessageTime = new Date().toISOString();
      await conv.save();
    }

    const msg = new Message({
      _id: Date.now().toString() + Math.random().toString(36).substring(2, 6),
      conversationId: conv._id,
      senderId: hostId,
      content: `[BIÊN LAI ĐÃ THANH TOÁN - KỲ ${invoice.period}]\n• Phòng: ${invoice.roomName}\n• Tổng tiền đã thanh toán: ${totalAmount.toLocaleString('vi-VN')}đ\n• Hình thức: ${invoice.paymentMethod || 'PayOS (VietQR)'}\n• Trạng thái: ĐÃ XÁC NHẬN`,
      timestamp: Date.now().toString()
    });
    await msg.save();

    return res.status(200).json({ success: true, message: `Đã gửi biên lai hóa đơn qua tin nhắn tới ${contract?.renterName || 'người thuê'}!` });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

