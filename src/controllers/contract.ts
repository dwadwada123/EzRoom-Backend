import { Request, Response } from 'express';
import { Contract } from '../models/contract';
import { payOS } from '../config/payos';

export async function createContract(req: Request, res: Response) {
  try {
    const { id, roomId, renterId, renterName, renterPhone, hostName, startDate, endDate, depositAmount, isProtected } = req.body;
    if (!id || !roomId || !renterId || !renterName || !renterPhone || !hostName || !startDate || !endDate || depositAmount === undefined) {
      return res.status(400).json({ success: false, error: 'Missing contract required parameters.' });
    }
    const contract = new Contract({
      _id: id, roomId, renterId, renterName, renterPhone, hostName, startDate, endDate, depositAmount,
      depositStatus: 'UNPAID', status: 'DRAFT', dateCreated: new Date().toLocaleDateString('vi-VN'), isProtected
    });
    await contract.save();
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

    contract.status = 'WAITING_DEPOSIT';
    contract.dateSigned = new Date().toLocaleDateString('vi-VN');
    await contract.save();

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

    // Generate unique 64-bit integer order code
    const orderCode = Date.now();

    const paymentData = {
      orderCode,
      amount: contract.depositAmount,
      description: `Coc phong ${contract.id.substring(0, 10)}`,
      cancelUrl: `https://ezroom.vn/payment/cancel`,
      returnUrl: `https://ezroom.vn/payment/success`
    };

    const paymentLinkRes = await payOS.createPaymentLink(paymentData);

    contract.orderCode = orderCode;
    await contract.save();

    return res.status(200).json({
      success: true,
      qrUrl: paymentLinkRes.checkoutUrl,
      depositAmount: contract.depositAmount
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
}
