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

// ── Compliance badge helper ───────────────────────────────────────────────────
function complianceBadge(label, value) {
  if (!value || value === "not_required") return "";
  const yes = value === "yes" || value === true;
  const colour = yes ? "#16a34a" : "#dc2626";
  const icon   = yes ? "✅" : "❌";
  return `<span style="display:inline-block;background:${yes ? "#f0fdf4" : "#fef2f2"};color:${colour};border:1px solid ${yes ? "#bbf7d0" : "#fecaca"};border-radius:999px;padding:3px 10px;font-size:12px;margin:2px 4px 2px 0;">${icon} ${label}</span>`;
}

// ── Broadcast vacancy to training providers ───────────────────────────────────
export async function sendVacancyBroadcast({ job, providers, sentByName, appUrl, customSubject, customMessage, customBody }) {
  const baseUrl = appUrl || process.env.APP_URL || "https://comfortable-mindfulness-production.up.railway.app";

  const payStr    = job.pay_rate
    ? `$${Number(job.pay_rate).toLocaleString()}${job.pay_rate_type === "annual" ? "/yr" : "/hr"}`
    : null;

  const location  = job.work_location || job.city
    ? [job.work_location || job.city, job.state].filter(Boolean).join(", ")
    : null;

  const compliance = [
    complianceBadge("Police Check",        job.police_check),
    complianceBadge("WWC",                 job.wwc),
    complianceBadge("Drug & Alcohol Test", job.drug_alcohol_test),
    complianceBadge("Car Required",        job.car_required),
    complianceBadge("Wage Subsidy",        job.wage_subsidy_required),
  ].filter(Boolean).join("");

  const referralUrl = `${baseUrl}/jobs/${job.id}`;
  const defaultSubject = `New Vacancy Alert: ${job.title}${location ? ` — ${location}` : ""}`;
  const subject     = (customSubject && customSubject.trim()) ? customSubject.trim() : defaultSubject;

  // Build a send task for each provider and fire them ALL in parallel
  const sendTasks = providers
    .filter((p) => p.email)
    .map(async (provider) => {
      const html = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,.08);">
        <tr>
          <td style="background:linear-gradient(135deg,#0f172a 0%,#1e293b 60%,#e88e2e 100%);padding:28px 32px;">
            <p style="margin:0;font-size:22px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">Work<span style="color:#e88e2e;">Vision</span></p>
            <p style="margin:6px 0 0;font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:2px;">New Vacancy Alert</p>
          </td>
        </tr>
        <tr>
          <td style="padding:28px 32px 0;">
            <p style="margin:0 0 6px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#94a3b8;">📋 Vacancy</p>
            <h1 style="margin:0 0 12px;font-size:24px;font-weight:800;color:#0f172a;line-height:1.25;">${job.title}</h1>
            <table cellpadding="0" cellspacing="0">
              ${job.employer_name ? `<tr><td style="padding:3px 0;font-size:13px;color:#475569;">🏢 &nbsp;<strong>${job.employer_name}</strong></td></tr>` : ""}
              ${location          ? `<tr><td style="padding:3px 0;font-size:13px;color:#475569;">📍 &nbsp;${location}</td></tr>` : ""}
              ${job.industry      ? `<tr><td style="padding:3px 0;font-size:13px;color:#475569;">🏷️ &nbsp;${job.industry}</td></tr>` : ""}
              ${payStr            ? `<tr><td style="padding:3px 0;font-size:18px;font-weight:800;color:#e88e2e;">${payStr}</td></tr>` : ""}
            </table>
          </td>
        </tr>
        ${compliance ? `
        <tr>
          <td style="padding:20px 32px 0;">
            <p style="margin:0 0 10px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#94a3b8;">✅ Requirements</p>
            <div>${compliance}</div>
          </td>
        </tr>` : ""}
        ${customMessage && customMessage.trim() ? `
        <tr>
          <td style="padding:20px 32px 0;">
            <div style="background:#fffbeb;border:1px solid #fef3c7;border-left:4px solid #f59e0b;border-radius:6px;padding:12px 16px;">
              <p style="margin:0 0 4px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#b45309;">💬 Note from Recruiter</p>
              <p style="margin:0;font-size:13px;color:#78350f;line-height:1.6;white-space:pre-wrap;">${customMessage.trim().replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>")}</p>
            </div>
          </td>
        </tr>` : ""}
        ${(customBody !== undefined ? customBody : job.description) ? `
        <tr>
          <td style="padding:20px 32px 0;">
            <p style="margin:0 0 8px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#94a3b8;">📝 About the Role</p>
            <p style="margin:0;font-size:13px;color:#334155;line-height:1.7;">${(customBody !== undefined ? customBody : (job.description || "")).replace(/\n/g, "<br>")}</p>
          </td>
        </tr>` : ""}
        <tr>
          <td style="padding:28px 32px 32px;">
            <table cellpadding="0" cellspacing="0" width="100%">
              <tr>
                <td style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:20px 24px;">
                  <p style="margin:0 0 6px;font-size:14px;font-weight:700;color:#0f172a;">Do you have a suitable candidate?</p>
                  <p style="margin:0 0 16px;font-size:13px;color:#64748b;">Dear ${provider.contact_name || provider.name}, please refer any job-ready candidates directly from the WorkVision portal.</p>
                  <a href="${referralUrl}" style="display:inline-block;background:#e88e2e;color:#ffffff;font-size:14px;font-weight:700;padding:12px 28px;border-radius:8px;text-decoration:none;">Refer a Candidate for this Role →</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:16px 32px;">
            <p style="margin:0;font-size:11px;color:#94a3b8;">Sent by <strong>${sentByName}</strong> via WorkVision ATS &bull; This is an automated vacancy broadcast.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

      const effectiveDesc = (customBody !== undefined ? customBody : (job.description || "")).trim();
      const text = `${subject}\n\n${job.employer_name ? `Employer: ${job.employer_name}\n` : ""}${location ? `Location: ${location}\n` : ""}${payStr ? `Pay: ${payStr}\n` : ""}${job.industry ? `Industry: ${job.industry}\n` : ""}${customMessage && customMessage.trim() ? `\nNote from Recruiter:\n${customMessage.trim()}\n` : ""}${effectiveDesc ? `\nAbout the Role:\n${effectiveDesc}\n` : ""}\nRefer a candidate here:\n${referralUrl}\n\nSent by ${sentByName} via WorkVision ATS`;

      try {
        await sendEmail({ to: provider.email, subject, html, text });
        return { provider_id: provider.id, name: provider.name, email: provider.email, status: "sent" };
      } catch (err) {
        return { provider_id: provider.id, name: provider.name, email: provider.email, status: "failed", error: err.message };
      }
    });

  // Run all sends in parallel
  const settled = await Promise.allSettled(sendTasks);
  return settled.map((r) => r.status === "fulfilled" ? r.value : { status: "failed", error: r.reason?.message });
}

// ── Multi-Vacancy Broadcast to training providers ─────────────────────────────
export async function sendMultiVacancyBroadcast({ jobs, providers, sentByName, appUrl, customSubject, customMessage, customIntro }) {
  const baseUrl = appUrl || process.env.APP_URL || "https://comfortable-mindfulness-production.up.railway.app";
  const defaultSubject = `Multiple New Vacancies Alert (${jobs.length} Roles Available) — WorkVision`;
  const subject = (customSubject && customSubject.trim()) ? customSubject.trim() : defaultSubject;

  // Render HTML card for each vacancy in the digest
  const jobsHtml = jobs.map((job, idx) => {
    const payStr = job.pay_rate
      ? `$${Number(job.pay_rate).toLocaleString()}${job.pay_rate_type === "annual" ? "/yr" : "/hr"}`
      : null;
    const location = job.work_location || job.city
      ? [job.work_location || job.city, job.state].filter(Boolean).join(", ")
      : null;
    const compliance = [
      complianceBadge("Police Check",        job.police_check),
      complianceBadge("WWC",                 job.wwc),
      complianceBadge("Drug & Alcohol Test", job.drug_alcohol_test),
      complianceBadge("Car Required",        job.car_required),
      complianceBadge("Wage Subsidy",        job.wage_subsidy_required),
    ].filter(Boolean).join("");
    const referralUrl = `${baseUrl}/jobs/${job.id}`;

    return `
      <tr>
        <td style="padding:16px 0;border-bottom:${idx === jobs.length - 1 ? "none" : "1px solid #e2e8f0"};">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td>
                <span style="display:inline-block;background:#0f172a;color:#ffffff;font-size:10px;font-weight:700;padding:2px 8px;border-radius:4px;text-transform:uppercase;margin-bottom:6px;">Role ${idx + 1}</span>
                <h3 style="margin:4px 0 6px;font-size:18px;font-weight:700;color:#0f172a;">${job.title}</h3>
                <div style="font-size:13px;color:#475569;margin-bottom:8px;line-height:1.5;">
                  ${job.employer_name ? `🏢 <strong>${job.employer_name}</strong> &nbsp;&bull;&nbsp; ` : ""}
                  ${location ? `📍 ${location} &nbsp;&bull;&nbsp; ` : ""}
                  ${payStr ? `<strong style="color:#e88e2e;">💰 ${payStr}</strong>` : ""}
                </div>
                ${compliance ? `<div style="margin-bottom:8px;">${compliance}</div>` : ""}
                ${job.description ? `<p style="margin:4px 0 10px;font-size:12px;color:#64748b;line-height:1.5;">${job.description.slice(0, 200).replace(/\n/g, " ")}${job.description.length > 200 ? "..." : ""}</p>` : ""}
                <a href="${referralUrl}" style="display:inline-block;background:#e88e2e;color:#ffffff;font-size:12px;font-weight:700;padding:7px 16px;border-radius:6px;text-decoration:none;">
                  View & Refer Candidates &rarr;
                </a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    `;
  }).join("");

  const sendTasks = providers
    .filter((p) => p.email)
    .map(async (provider) => {
      const html = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,.08);">
        <tr>
          <td style="background:linear-gradient(135deg,#0f172a 0%,#1e293b 60%,#e88e2e 100%);padding:28px 32px;">
            <p style="margin:0;font-size:22px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">Work<span style="color:#e88e2e;">Vision</span></p>
            <p style="margin:6px 0 0;font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:2px;">Multiple Vacancies Broadcast &bull; ${jobs.length} Active Roles</p>
          </td>
        </tr>
        <tr>
          <td style="padding:24px 32px 12px;">
            <p style="margin:0 0 10px;font-size:14px;color:#334155;line-height:1.6;">
              Dear ${provider.contact_name || provider.name},<br/>
              ${customIntro && customIntro.trim() ? customIntro.trim() : "Please see our latest open vacancies below. We welcome referrals for any job-ready candidates."}
            </p>
          </td>
        </tr>
        ${customMessage && customMessage.trim() ? `
        <tr>
          <td style="padding:0 32px 16px;">
            <div style="background:#fffbeb;border:1px solid #fef3c7;border-left:4px solid #f59e0b;border-radius:6px;padding:12px 16px;">
              <p style="margin:0 0 4px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#b45309;">💬 Note from Recruiter</p>
              <p style="margin:0;font-size:13px;color:#78350f;line-height:1.6;white-space:pre-wrap;">${customMessage.trim().replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>")}</p>
            </div>
          </td>
        </tr>` : ""}
        <tr>
          <td style="padding:0 32px 24px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              ${jobsHtml}
            </table>
          </td>
        </tr>
        <tr>
          <td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:16px 32px;">
            <p style="margin:0;font-size:11px;color:#94a3b8;">Sent by <strong>${sentByName}</strong> via WorkVision ATS &bull; This is an automated multiple vacancy broadcast.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

      const text = `${subject}\n\nDear ${provider.contact_name || provider.name},\n${customIntro || "We have multiple open vacancies:"}\n\n${jobs.map((j, i) => `${i + 1}. ${j.title} (${j.work_location || j.city || "Location TBA"}) - ${baseUrl}/jobs/${j.id}`).join("\n")}\n\nSent by ${sentByName} via WorkVision ATS`;

      try {
        await sendEmail({ to: provider.email, subject, html, text });
        return { provider_id: provider.id, name: provider.name, email: provider.email, status: "sent" };
      } catch (err) {
        return { provider_id: provider.id, name: provider.name, email: provider.email, status: "failed", error: err.message };
      }
    });

  const settled = await Promise.allSettled(sendTasks);
  return settled.map((r) => r.status === "fulfilled" ? r.value : { status: "failed", error: r.reason?.message });
}

