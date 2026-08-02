import mongoose, { Schema } from 'mongoose';

export interface IInvoice {
  _id: string;
  roomId: string;
  roomName: string;
  period: string; // MM/yyyy
  roomPrice: number;
  oldElectricity: number;
  newElectricity: number;
  oldWater: number;
  newWater: number;
  otherCosts: Array<{ reason: string; amount: number }>;
  status: 'UNPAID' | 'PAID';
  type: string;
  dateCreated: string;
  paymentMethod?: string | null;
  commission: number; // Platform fee: roomPrice * 0.05
  finalRevenue: number; // Host revenue: totalAmount - commission
  orderCode?: number;
}

const InvoiceSchema = new Schema<IInvoice>({
  _id: { type: String, required: true },
  roomId: { type: String, required: true },
  roomName: { type: String, required: true },
  period: { type: String, required: true },
  roomPrice: { type: Number, required: true },
  oldElectricity: { type: Number, required: true },
  newElectricity: { type: Number, required: true },
  oldWater: { type: Number, required: true },
  newWater: { type: Number, required: true },
  otherCosts: [
    {
      reason: { type: String, required: true },
      amount: { type: Number, required: true }
    }
  ],
  status: { type: String, enum: ['UNPAID', 'PAID'], default: 'UNPAID' },
  type: { type: String, default: 'RENT' },
  dateCreated: { type: String, required: true },
  paymentMethod: { type: String, default: null },
  commission: { type: Number, default: 0 },
  finalRevenue: { type: Number, default: 0 },
  orderCode: { type: Number }
});

export const Invoice = mongoose.model<IInvoice>('Invoice', InvoiceSchema);
