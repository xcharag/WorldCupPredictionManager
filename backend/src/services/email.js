const nodemailer = require('nodemailer');

const createTransporter = () => {
  if (!process.env.EMAIL_USER || process.env.EMAIL_USER === 'your_email@gmail.com') {
    // Dev fallback: log to console
    return null;
  }

  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: Number(process.env.EMAIL_PORT),
    secure: process.env.EMAIL_SECURE === 'true',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
};

const sendEmail = async ({ to, subject, html }) => {
  const transporter = createTransporter();

  if (!transporter) {
    console.log(`\n📧 [DEV EMAIL] To: ${to}\nSubject: ${subject}\n${html}\n`);
    return;
  }

  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to,
    subject,
    html,
  });
};

const sendVerificationEmail = async (user, token) => {
  const url = `${process.env.FRONTEND_URL}/verify-email?token=${token}`;
  await sendEmail({
    to: user.email,
    subject: 'Verify your email — World Cup 2026 Predictions',
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Welcome, ${user.name}! 🏆</h2>
        <p>Thanks for joining World Cup 2026 Predictions! Please verify your email to get started.</p>
        <a href="${url}" style="display:inline-block;padding:12px 24px;background:#22c55e;color:white;text-decoration:none;border-radius:8px;font-weight:bold;">
          Verify Email
        </a>
        <p style="color:#999;margin-top:16px;">This link expires in 24 hours. If you didn't register, please ignore this email.</p>
      </div>
    `,
  });
};

const sendPasswordResetEmail = async (user, token) => {
  const url = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;
  await sendEmail({
    to: user.email,
    subject: 'Reset your password — World Cup 2026 Predictions',
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Password Reset 🔒</h2>
        <p>You requested a password reset. Click the button below to set a new password.</p>
        <a href="${url}" style="display:inline-block;padding:12px 24px;background:#22c55e;color:white;text-decoration:none;border-radius:8px;font-weight:bold;">
          Reset Password
        </a>
        <p style="color:#999;margin-top:16px;">This link expires in 1 hour. If you didn't request this, please ignore this email.</p>
      </div>
    `,
  });
};

module.exports = { sendEmail, sendVerificationEmail, sendPasswordResetEmail };
