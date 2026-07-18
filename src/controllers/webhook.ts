import { Request, Response } from 'express';
import { Contract } from '../models/contract';

export async function paymentWebhook(req: Request, res: Response) {
  try {
    const { contractId, amount, status } = req.body;
    if (!contractId || amount === undefined || !status) {
      return res.status(400).json({ success: false, error: 'Missing webhook data' });
    }

    if (status !== 'SUCCESS') {
      return res.status(200).json({ success: true, message: 'Non-success payment status ignored.' });
    }

    const contract = await Contract.findById(contractId);
    if (!contract) {
      return res.status(404).json({ success: false, error: 'Contract not found.' });
    }

    if (amount < contract.depositAmount) {
      return res.status(400).json({ success: false, error: 'Insufficient deposit amount paid.' });
    }

    // Freeze the deposit in escrow and activate contract
    contract.depositStatus = 'FROZEN';
    contract.status = 'ACTIVE';
    await contract.save();

    return res.status(200).json({ success: true, message: 'Deposit frozen successfully in Escrow.', contract });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
}
