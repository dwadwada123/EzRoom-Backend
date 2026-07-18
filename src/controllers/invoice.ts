import { Request, Response } from 'express';
import { Invoice } from '../models/invoice';

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
    return res.status(201).json({ success: true, invoice });
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

    // Constants defaults
    const electricityRate = 3500;
    const waterRate = 15000;

    // Calculation total amount
    const elecDiff = invoice.newElectricity - invoice.oldElectricity;
    const waterDiff = invoice.newWater - invoice.oldWater;
    const extraCostsTotal = (invoice.otherCosts || []).reduce((sum, item) => sum + item.amount, 0);

    const totalAmount = invoice.roomPrice + (elecDiff * electricityRate) + (waterDiff * waterRate) + extraCostsTotal;

    // Commission: 5% of static roomPrice
    const commission = invoice.roomPrice * 0.05;
    const finalRevenue = totalAmount - commission;

    invoice.status = 'PAID';
    invoice.paymentMethod = paymentMethod;
    invoice.commission = commission;
    invoice.finalRevenue = finalRevenue;

    await invoice.save();

    return res.status(200).json({ success: true, invoice, totalAmount });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
}
