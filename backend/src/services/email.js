const nodemailer = require('nodemailer');

const BASE_STYLE = `
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  max-width: 560px;
  margin: 0 auto;
  background: #0f172a;
  color: #e2e8f0;
  border-radius: 12px;
  padding: 32px 28px;
`;

const BTN_STYLE = `
  display: inline-block;
  padding: 12px 28px;
  background: #22c55e;
  color: #fff;
  text-decoration: none;
  border-radius: 8px;
  font-weight: 700;
  font-size: 15px;
`;

const MUTED = 'color:#94a3b8;font-size:13px;margin-top:16px;';

const createTransporter = () => {
  if (!process.env.EMAIL_USER || process.env.EMAIL_USER === 'your_email@gmail.com') {
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
    console.log(`\n📧 [DEV EMAIL] Para: ${to}\nAsunto: ${subject}\n${html}\n`);
    return;
  }
  await transporter.sendMail({ from: process.env.EMAIL_FROM, to, subject, html });
};

// ── Verificación de email ────────────────────────────────────────
const sendVerificationEmail = async (user, token) => {
  const url = `${process.env.FRONTEND_URL}/verify-email?token=${token}`;
  await sendEmail({
    to: user.email,
    subject: 'Verificá tu email — Pronósticos Mundial 2026',
    html: `
      <div style="${BASE_STYLE}">
        <h2 style="color:#22c55e;margin-top:0">¡Bienvenido, ${user.name}! 🏆</h2>
        <p>Gracias por unirte a <strong>Pronósticos Mundial 2026</strong>. Verificá tu email para empezar a jugar.</p>
        <div style="margin:24px 0">
          <a href="${url}" style="${BTN_STYLE}">Verificar email</a>
        </div>
        <p style="${MUTED}">Este enlace expira en 24 horas. Si no te registraste, podés ignorar este mensaje.</p>
      </div>
    `,
  });
};

// ── Recuperación de contraseña ───────────────────────────────────
const sendPasswordResetEmail = async (user, token) => {
  const url = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;
  await sendEmail({
    to: user.email,
    subject: 'Restablecé tu contraseña — Pronósticos Mundial 2026',
    html: `
      <div style="${BASE_STYLE}">
        <h2 style="color:#22c55e;margin-top:0">Restablecer contraseña 🔒</h2>
        <p>Recibimos una solicitud para restablecer la contraseña de tu cuenta <strong>${user.email}</strong>.</p>
        <div style="margin:24px 0">
          <a href="${url}" style="${BTN_STYLE}">Restablecer contraseña</a>
        </div>
        <p style="${MUTED}">Este enlace expira en 1 hora. Si no lo solicitaste, podés ignorar este mensaje.</p>
      </div>
    `,
  });
};

// ── Recordatorio de partido ──────────────────────────────────────
const TIMING_LABEL = { '24h': '24 horas', '6h': '6 horas', '4h': '4 horas', '1h': '1 hora' };

const sendMatchReminderEmail = async (user, match, timing) => {
  const home = match.homeTeam?.name || 'Por confirmar';
  const away = match.awayTeam?.name || 'Por confirmar';
  const homeFlag = match.homeTeam?.flag || '';
  const awayFlag = match.awayTeam?.flag || '';
  const dateStr = new Date(match.matchDate).toLocaleString('es-AR', {
    weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit',
    timeZone: 'America/Argentina/Buenos_Aires',
  });
  const label = TIMING_LABEL[timing] || timing;
  const url = `${process.env.FRONTEND_URL}/matches`;

  await sendEmail({
    to: user.email,
    subject: `⏰ En ${label}: ${homeFlag}${home} vs ${awayFlag}${away} — Pronósticos Mundial 2026`,
    html: `
      <div style="${BASE_STYLE}">
        <p style="color:#94a3b8;font-size:13px;margin:0 0 8px">Recordatorio de partido</p>
        <h2 style="color:#22c55e;margin:0 0 4px">⏰ Faltan ${label}</h2>
        <div style="margin:20px 0;padding:20px;background:#1e293b;border-radius:10px;text-align:center">
          <p style="font-size:22px;font-weight:700;margin:0">
            ${homeFlag} ${home} <span style="color:#94a3b8">vs</span> ${awayFlag} ${away}
          </p>
          <p style="color:#94a3b8;margin:8px 0 0;font-size:14px">${dateStr}</p>
          ${match.venue ? `<p style="color:#64748b;margin:4px 0 0;font-size:12px">📍 ${match.venue}</p>` : ''}
        </div>
        <p>¡Todavía estás a tiempo de cargar tu predicción antes de que arranque el partido!</p>
        <div style="margin:20px 0">
          <a href="${url}" style="${BTN_STYLE}">Ir a mis predicciones</a>
        </div>
        <p style="${MUTED}">Recibís este recordatorio porque lo activaste en tus preferencias de notificación. Podés cambiarlo en tu perfil.</p>
      </div>
    `,
  });
};

module.exports = { sendEmail, sendVerificationEmail, sendPasswordResetEmail, sendMatchReminderEmail };

