import { Contract } from '../models/contract';

// Helper function to parse dd/MM/yyyy to Date object
export function parseDate(dateStr: string): Date {
  const [day, month, year] = dateStr.split('/').map(Number);
  return new Date(year, month - 1, day);
}

export async function processEscrowDisbursals() {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Find active contracts with frozen deposit
    const contracts = await Contract.find({
      depositStatus: 'FROZEN',
      status: 'ACTIVE'
    });

    let count = 0;
    for (const contract of contracts) {
      const startDate = parseDate(contract.startDate);
      if (today >= startDate) {
        contract.depositStatus = 'DISBURSED';
        contract.disburseDate = today.toLocaleDateString('vi-VN');
        await contract.save();
        count++;
      }
    }
    console.log(`[Escrow Job] Automatically disbursed ${count} contract deposit payouts.`);
    return count;
  } catch (error) {
    console.error('[Escrow Job Error]:', error);
    return 0;
  }
}
