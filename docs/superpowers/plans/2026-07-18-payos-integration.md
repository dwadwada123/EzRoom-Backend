# PayOS VietQR Real Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate the real `@payos/node` SDK library to generate actual VietQR payment links and secure webhook checksum signature verification.

**Architecture:** Initialize PayOS Client SDK, update contract controller to call `payOS.createPaymentLink()`, and update webhook controller to verify signature using `payOS.verifyPaymentWebhookData()`.

**Tech Stack:** Node.js, TypeScript, Express, @payos/node, Mongoose, Jest, Supertest.

## Global Constraints

- Never commit real private keys to git (always reference env variables).
- Webhook signature verification is mandatory to prevent checksum spoofing.
- The orderCode sent to PayOS must be a unique 64-bit integer (e.g. using timestamps).

---

### Task 1: Environment Setup & SDK Installation

**Files:**
- Modify: `.env`
- Modify: `.env.example`
- Modify: `package.json`

**Interfaces:**
- Consumes: None
- Produces: Installed `@payos/node` package

- [ ] **Step 1: Install @payos/node package**

Run:
```powershell
npm.cmd install @payos/node
```

- [ ] **Step 2: Update environment variables**

Update `.env` with the user's provided keys:
```env
PAYOS_CLIENT_ID=5a5cab03-45f7-4bc0-8d6e-19ac087a9537
PAYOS_API_KEY=d7ff9c54-d06d-480a-94c9-a529bb56d5e3
PAYOS_CHECKSUM_KEY=314538275d47a36480cf0a2d7916cf7391e2f494644b33da60af84d87de70762
```

And update `.env.example` to track structure:
```env
PAYOS_CLIENT_ID=your_payos_client_id
PAYOS_API_KEY=your_payos_api_key
PAYOS_CHECKSUM_KEY=your_payos_checksum_key
```

- [ ] **Step 3: Commit environment setup**

```powershell
git add package.json package-lock.json .env.example
git commit -m "chore: add @payos/node dependency and env variables"
```

---

### Task 2: PayOS SDK Client Configuration

**Files:**
- Create: `src/config/payos.ts`

**Interfaces:**
- Consumes: Environment variables
- Produces: Exported `payOS` client instance

- [ ] **Step 1: Write PayOS configuration file**

Create `src/config/payos.ts`:
```typescript
import PayOS from '@payos/node';
import dotenv from 'dotenv';

dotenv.config();

const client_id = process.env.PAYOS_CLIENT_ID || '';
const api_key = process.env.PAYOS_API_KEY || '';
const checksum_key = process.env.PAYOS_CHECKSUM_KEY || '';

export const payOS = new PayOS(client_id, api_key, checksum_key);
```

- [ ] **Step 2: Compile to ensure no type errors**

Run:
```powershell
npm.cmd run build
```
Expected: Compiles cleanly.

- [ ] **Step 3: Commit configuration**

```powershell
git add src/config/payos.ts
git commit -m "feat: add payOS client configuration"
```

---

### Task 3: Real PayOS Payment Link Creation

**Files:**
- Modify: `src/models/contract.ts` (Add orderCode schema field)
- Modify: `src/controllers/contract.ts` (Call payOS SDK to create checkoutUrl)
- Test: `tests/contract.test.ts` (Update mock payload expectations)

**Interfaces:**
- Consumes: `payOS` client instance, `Contract` model
- Produces: `POST /api/contracts/:id/payment` returns `{"success": true, "qrUrl": "https://checkout.payos.vn/..."}`

- [ ] **Step 1: Update Contract Model Schema**

Modify `src/models/contract.ts` to add a new `orderCode` number field to identify transactions:
```typescript
// Add inside IContract interface
orderCode?: number | null;

// Add inside ContractSchema definition
orderCode: { type: Number, default: null }
```

- [ ] **Step 2: Implement createPaymentLink in Contract Controller**

Update `getPaymentQR` in `src/controllers/contract.ts`:
```typescript
import { payOS } from '../config/payos';

export async function getPaymentQR(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const contract = await Contract.findById(id);
    if (!contract) {
      return res.status(404).json({ success: false, error: 'Contract not found.' });
    }

    // Generate unique order code (timestamp or serial int)
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
```

- [ ] **Step 3: Update Contract test mock**

Modify `tests/contract.test.ts` to mock `payOS.createPaymentLink` so that tests can run offline.
```typescript
import { payOS } from '../src/config/payos';

jest.spyOn(payOS, 'createPaymentLink').mockImplementation(async (data: any) => {
  return {
    checkoutUrl: `https://checkout.payos.vn/web/${data.orderCode}`,
    paymentLinkId: 'mock_pay_link_id',
    status: 'PENDING',
    qrCode: 'mock_qr_code'
  } as any;
});
```

- [ ] **Step 4: Run contract tests**

Run:
```powershell
npm.cmd test tests/contract.test.ts
```
Expected: PASS

- [ ] **Step 5: Commit contract controller modifications**

```powershell
git add src/models/contract.ts src/controllers/contract.ts tests/contract.test.ts
git commit -m "feat: integrate payOS payment link creation in contract endpoint"
```

---

### Task 4: Real PayOS Webhook Checksum Verification

**Files:**
- Modify: `src/controllers/webhook.ts`

**Interfaces:**
- Consumes: `payOS` client instance
- Produces: `POST /api/payment-webhook` verifies PayOS signature and transitions escrow deposit state to FROZEN.

- [ ] **Step 1: Implement verifyPaymentWebhookData in Webhook Controller**

Update `paymentWebhook` in `src/controllers/webhook.ts`:
```typescript
import { Request, Response } from 'express';
import { Contract } from '../models/contract';
import { payOS } from '../config/payos';

export async function paymentWebhook(req: Request, res: Response) {
  try {
    const webhookBody = req.body;

    // 1. Verify webhook signature and extract raw verified data
    const verifiedData = payOS.verifyPaymentWebhookData(webhookBody);

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
```

- [ ] **Step 2: Update mock in tests/contract.test.ts to test webhook verification**

Update the webhook test in `tests/contract.test.ts` to mock `payOS.verifyPaymentWebhookData` as well.
```typescript
jest.spyOn(payOS, 'verifyPaymentWebhookData').mockImplementation((body: any) => {
  return {
    orderCode: body.data.orderCode,
    amount: body.data.amount,
    desc: 'success'
  } as any;
});
```

And update the webhook request payload in `tests/contract.test.ts`:
```typescript
  it('should handle webhook to freeze deposit (Escrow)', async () => {
    // Webhook is public (no Auth header needed)
    const res = await request(app)
      .post('/api/payment-webhook')
      .send({
        success: true,
        data: {
          orderCode: 123456, // will be matched via mock or save
          amount: mockContract.depositAmount,
          desc: 'success'
        }
      })
      .expect(200);
```

- [ ] **Step 3: Run all tests**

Run:
```powershell
npm.cmd test
```
Expected: All 14 tests PASS.

- [ ] **Step 4: Commit webhook changes**

```powershell
git add src/controllers/webhook.ts tests/contract.test.ts
git commit -m "feat: secure payment webhook with payOS checksum signature verification"
```
