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
