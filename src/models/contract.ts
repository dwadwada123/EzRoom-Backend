import mongoose, { Schema } from 'mongoose';

export interface IContract {
  _id: string;
  roomId: string;
  renterId: string;
  renterName: string;
  renterPhone: string;
  hostName: string;
  startDate: string; // dd/MM/yyyy
  endDate: string; // dd/MM/yyyy
  depositAmount: number;
  depositStatus: 'UNPAID' | 'FROZEN' | 'DISBURSED' | 'REFUNDED';
  status: 'DRAFT' | 'WAITING_SIGN' | 'WAITING_DEPOSIT' | 'ACTIVE' | 'CANCELLED' | 'TERMINATED' | 'DISPUTED';
  dateCreated: string;
  dateSigned?: string | null;
  cancelReason?: string | null;
  cancelBy?: 'HOST' | 'RENTER' | null;
  refundInfo?: {
    bankName: string;
    accountNumber: string;
    accountOwner: string;
    status: 'PENDING' | 'COMPLETED';
  } | null;
  disburseDate?: string | null;
  isProtected: boolean;
  orderCode?: number | null;
}

const ContractSchema = new Schema<IContract>({
  _id: { type: String, required: true },
  roomId: { type: String, required: true },
  renterId: { type: String, required: true },
  renterName: { type: String, required: true },
  renterPhone: { type: String, required: true },
  hostName: { type: String, required: true },
  startDate: { type: String, required: true },
  endDate: { type: String, required: true },
  depositAmount: { type: Number, required: true },
  depositStatus: { type: String, enum: ['UNPAID', 'FROZEN', 'DISBURSED', 'REFUNDED'], default: 'UNPAID' },
  status: { type: String, enum: ['DRAFT', 'WAITING_SIGN', 'WAITING_DEPOSIT', 'ACTIVE', 'CANCELLED', 'TERMINATED', 'DISPUTED'], default: 'DRAFT' },
  dateCreated: { type: String, required: true },
  dateSigned: { type: String, default: null },
  cancelReason: { type: String, default: null },
  cancelBy: { type: String, enum: ['HOST', 'RENTER'], default: null },
  refundInfo: {
    bankName: { type: String, default: '' },
    accountNumber: { type: String, default: '' },
    accountOwner: { type: String, default: '' },
    status: { type: String, enum: ['PENDING', 'COMPLETED'], default: 'PENDING' }
  },
  disburseDate: { type: String, default: null },
  isProtected: { type: Boolean, default: false },
  orderCode: { type: Number, default: null }
});

export const Contract = mongoose.model<IContract>('Contract', ContractSchema);
