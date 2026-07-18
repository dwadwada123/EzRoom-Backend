import { Request, Response } from 'express';
import { Contract } from '../models/contract';
import { payOS } from '../config/payos';

export async function paymentWebhook(req: Request, res: Response) {
  try {
    const webhookBody = req.body;

    // 1. Verify webhook signature and extract raw verified data
    const verifiedData = await payOS.webhooks.verify(webhookBody);

    if (verifiedData.desc !== 'success') {
      return res.status(200).json({ success: true, message: 'Non-success transaction ignored.' });
    }

    const orderCode = verifiedData.orderCode;

    // 2. Find contract matching the orderCode
    const contract = await Contract.findOne({ orderCode });
    if (!contract) {
      return res.status(404).json({ success: false, error: 'Contract matching orderCode not found.' });
    }

    // 3. Freeze deposit in escrow and activate contract
    contract.depositStatus = 'FROZEN';
    contract.status = 'ACTIVE';
    await contract.save();

    return res.status(200).json({ success: true, message: 'Deposit frozen in Escrow.', contract });
  } catch (error: any) {
    console.error('Webhook error:', error.message);
    return res.status(400).json({ success: false, error: 'Webhook signature verification failed.' });
  }
}
