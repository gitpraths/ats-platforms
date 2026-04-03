import nodemailer from "nodemailer";
import logger from "../config/logger.js";

let transporter;

async function getTransporter() {
  if (transporter) return transporter;

  if (!process.env.SMTP_HOST) {
    // Development fallback: Ethereal fake SMTP
    const testAccount = await nodemailer.createTestAccount();
    transporter = nodemailer.createTransport({
      host: "smtp.ethereal.email",
      port: 587,
      secure: false,
      auth: { user: testAccount.user, pass: testAccount.pass },
    });
    logger.info(`Email: using Ethereal test account — ${testAccount.user}`);
  } else {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === "true",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  return transporter;
}

export async function testEmailConnection() {
  const t = await getTransporter();
  return t.verify();
}

export async function sendEmail({ to, subject, html, text }) {
  try {
    const t = await getTransporter();
    const info = await t.sendMail({
      from: process.env.EMAIL_FROM || "ATS Platform <noreply@myats.dev>",
      to,
      subject,
      html,
      text,
    });
    logger.info(`Email sent: to=${to} subject="${subject}" messageId=${info.messageId}`);

    // Log Ethereal preview URL in dev
    const previewUrl = nodemailer.getTestMessageUrl(info);
    if (previewUrl) logger.info(`Email preview: ${previewUrl}`);
  } catch (err) {
    logger.error(`Email send failed: to=${to} subject="${subject}" error=${err.message}`);
    // Non-blocking — do not rethrow
  }
}

export async function sendPlacementConfirmation({ placement, employer, candidate, job }) {
  const subject = `Employment Confirmation – ${candidate.name} at ${job.title}`;
  const html = `
    <p>Dear ${employer.contact_name || employer.name},</p>
    <p>We are pleased to confirm the employment of <strong>${candidate.name}</strong> for the role of
    <strong>${job.title}</strong>, commencing on <strong>${placement.start_date}</strong>.</p>
    <p>Could you please confirm receipt of this email and that the candidate has started employment?
    You can reply to this email or contact us directly.</p>
    <p>Thank you,<br/>The Recruitment Team</p>
  `;
  const text = `Dear ${employer.contact_name || employer.name},\n\nWe confirm employment of ${candidate.name} for ${job.title} starting ${placement.start_date}.\n\nPlease confirm receipt.\n\nThank you,\nThe Recruitment Team`;

  await sendEmail({ to: employer.contact_email, subject, html, text });
}

const CHECK_LABELS = {
  day_1:   "Day 1",
  week_1:  "Week 1",
  month_1: "1 Month",
  month_3: "3 Month",
  month_6: "6 Month",
};

export async function sendWelfareCheckEmail({ welfareCheck, placement, employer, candidate, job }) {
  const label = CHECK_LABELS[welfareCheck.check_type] || welfareCheck.check_type;
  const subject = `${label} Check-in – ${candidate.name}`;
  const html = `
    <p>Dear ${employer.contact_name || employer.name},</p>
    <p>This is a <strong>${label}</strong> welfare check for <strong>${candidate.name}</strong>
    who commenced the role of <strong>${job.title}</strong> on <strong>${placement.start_date}</strong>.</p>
    <p>Could you please confirm that ${candidate.name} is still employed and settling in well?
    Please reply to this email with any updates or concerns.</p>
    <p>Due date: <strong>${welfareCheck.due_date}</strong></p>
    <p>Thank you,<br/>The Recruitment Team</p>
  `;
  const text = `Dear ${employer.contact_name || employer.name},\n\nThis is a ${label} welfare check for ${candidate.name} (${job.title}, started ${placement.start_date}).\n\nPlease confirm they are still employed.\n\nThank you,\nThe Recruitment Team`;

  await sendEmail({ to: employer.contact_email, subject, html, text });
}
