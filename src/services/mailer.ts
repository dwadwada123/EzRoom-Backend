import nodemailer from 'nodemailer';

// Configure SMTP transport from environment variables or fallback to dev console log
const smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com';
const smtpPort = Number(process.env.SMTP_PORT) || 587;
const smtpUser = process.env.SMTP_USER;
const smtpPass = process.env.SMTP_PASS;

let transporter: nodemailer.Transporter | null = null;

if (smtpUser && smtpPass) {
  transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: {
      user: smtpUser,
      pass: smtpPass
    }
  });
}

export async function sendOtpEmail(to: string, otp: string) {
  const subject = '[EzRoom] Mã xác nhận đặt lại mật khẩu';

  const html = `
    <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
      <h2 style="color: #0066cc;">EzRoom - Khôi Phục Mật Khẩu</h2>
      <p>Bạn đã yêu cầu đặt lại mật khẩu cho tài khoản <strong>${to}</strong>.</p>
      <p>Mã OTP xác minh của bạn là:</p>
      <div style="font-size: 28px; font-weight: bold; letter-spacing: 4px; color: #0066cc; background: #eef6ff; padding: 12px 24px; display: inline-block; border-radius: 8px; margin: 10px 0;">
        ${otp}
      </div>
      <p>Mã này có hiệu lực trong <strong>5 phút</strong>. Vui lòng không chia sẻ mã này cho bất kỳ ai.</p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
      <p style="font-size: 12px; color: #888;">Nếu bạn không yêu cầu hành động này, vui lòng bỏ qua email này.</p>
    </div>
  `;

  if (transporter) {
    try {
      await transporter.sendMail({
        from: `"EzRoom Support" <${smtpUser}>`,
        to: String(to),
        subject,
        html
      });
      console.log(`[EMAIL] Sent OTP email to ${to}`);
    } catch (err) {
      console.error(`[EMAIL ERROR] Failed to send email via SMTP:`, err);
    }
  } else {
    console.log(`\n=================================================`);
    console.log(`[OTP MAILER] Target Email: ${to}`);
    console.log(`[OTP MAILER] Production OTP Code: ${otp}`);
    console.log(`[OTP MAILER] (Set SMTP_USER & SMTP_PASS in .env to send real emails via Gmail/SendGrid)`);
    console.log(`=================================================\n`);
  }
}
