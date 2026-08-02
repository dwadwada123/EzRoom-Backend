import { PayOS } from '@payos/node';
import dotenv from 'dotenv';

dotenv.config();

const client_id = process.env.PAYOS_CLIENT_ID || '';
const api_key = process.env.PAYOS_API_KEY || '';
const checksum_key = process.env.PAYOS_CHECKSUM_KEY || '';

export const payOS = new PayOS({
  clientId: client_id,
  apiKey: api_key,
  checksumKey: checksum_key
});

const payout_client_id = process.env.PAYOS_PAYOUT_CLIENT_ID || client_id;
const payout_api_key = process.env.PAYOS_PAYOUT_API_KEY || api_key;
const payout_checksum_key = process.env.PAYOS_PAYOUT_CHECKSUM_KEY || checksum_key;

export const payOSPayout = new PayOS({
  clientId: payout_client_id,
  apiKey: payout_api_key,
  checksumKey: payout_checksum_key
});
