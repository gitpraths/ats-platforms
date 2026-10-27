import nodemailer from "nodemailer";
import logger from "../config/logger.js";

let transporter;

async function getTransporter() {
  if (transporter) return transporter;

  const host = process.env.SMTP_HOST || "smtppro.zoho.com.au";
  const port = Number(process.env.SMTP_PORT) || 465;
  const user = process.env.SMTP_USER || "connect@workvision.com.au";
  const pass = process.env.SMTP_PASS || "Email@WVA24";

  // Port 465 requires secure: true (direct SSL). Port 587 requires secure: false (STARTTLS).
  let secure = port === 465;
  if (port === 465) {
    secure = true;
  } else if (port === 587) {
    secure = false;
  } else if (process.env.SMTP_SECURE !== undefined && process.env.SMTP_SECURE !== "") {
    secure = process.env.SMTP_SECURE === "true" || process.env.SMTP_SECURE === true;
  }

  transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
    pool: true,
    maxConnections: 3,
    maxMessages: 100,
  });

  logger.info(`[Email] Transporter active: ${user}@${host}:${port} (secure: ${secure})`);
  return transporter;
}

export async function testEmailConnection() {
  const t = await getTransporter();
  return t.verify();
}

export async function sendEmail({ to, subject, html, text }) {
  const t = await getTransporter();
  const defaultFrom = process.env.SMTP_USER
    ? `WorkVision Australia <${process.env.SMTP_USER}>`
    : "WorkVision Australia <connect@workvision.com.au>";
  const from = process.env.EMAIL_FROM || defaultFrom;

  try {
    const info = await t.sendMail({
      from,
      to,
      subject,
      html,
      text,
    });
    logger.info(`Email sent: to=${to} subject="${subject}" messageId=${info.messageId}`);

    // Log Ethereal preview URL in dev
    const previewUrl = nodemailer.getTestMessageUrl(info);
    if (previewUrl) logger.info(`Email preview: ${previewUrl}`);
    return info;
  } catch (err) {
    logger.error(`Email send failed: to=${to} subject="${subject}" error=${err.message}`);
    throw err;
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

// ── Helper to format candidate requirements checklist ────────────────────────
function getComplianceList(job) {
  const items = [];
  if (job.police_check && job.police_check !== "not_required") items.push("National Police Check Required");
  if (job.wwc && job.wwc !== "not_required") items.push("Working with Children Check (WWC)");
  if (job.drug_alcohol_test && job.drug_alcohol_test !== "not_required") items.push("Drug & Alcohol Screening");
  if (job.car_required && job.car_required !== "not_required") items.push("Own Reliable Vehicle / Driver's Licence");
  if (job.wage_subsidy_required && job.wage_subsidy_required !== "not_required") items.push("Wage Subsidy Eligible Preferred");
  return items;
}

function formatBroadcastPayRate(rate, rateType) {
  if (rateType === "award_wage") {
    if (!rate || String(rate).trim().toLowerCase() === "award wage") return "Award Wage";
    return String(rate).toLowerCase().includes("award") ? String(rate) : `Award Wage (${rate})`;
  }
  if (!rate) return null;
  const num = Number(rate);
  const suffix = rateType === "annual" ? "/yr" : "/hr";
  return isNaN(num) ? `${rate} ${suffix}` : `$${num.toLocaleString()}${suffix}`;
}

// ── Broadcast single vacancy to training providers ───────────────────────────
export async function sendVacancyBroadcast({ job, providers, sentByName, appUrl, customSubject, customMessage, customBody }) {
  const baseUrl = appUrl || process.env.APP_URL || "https://crm.workvision.com.au";

  const payStr = formatBroadcastPayRate(job.pay_rate, job.pay_rate_type);
  const location = job.work_location || job.city
    ? [job.work_location || job.city, job.state].filter(Boolean).join(", ")
    : null;
  const complianceList = getComplianceList(job);

  const defaultSubject = `New Vacancy Alert: ${job.title}${location ? ` (${location})` : ""} — WorkVision Australia`;
  const subject = (customSubject && customSubject.trim()) ? customSubject.trim() : defaultSubject;

  const validRecipients = (providers || []).filter((p) => p && p.email && p.email.includes("@"));
  const results = [];

  for (const provider of validRecipients) {
    const html = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:36px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.04);border:1px solid #e2e8f0;">
        
        <!-- Clean White Header with Official Crisp Retina Logo -->
        <tr>
          <td style="background:#ffffff;padding:24px 32px;border-bottom:2px solid #f1f5f9;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td valign="middle">
                  <img src="https://crm.workvision.com.au/WV-Logo-v2@2x.png" alt="WorkVision Australia" width="180" style="display:block;max-width:180px;height:auto;border:0;" />
                </td>
                <td align="right" valign="middle">
                  <span style="display:inline-block;background:#f8fafc;color:#0f172a;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;padding:6px 14px;border-radius:20px;border:1px solid #e2e8f0;">
                    Vacancy Alert
                  </span>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        
        <!-- Recipient Greeting -->
        <tr>
          <td style="padding:28px 32px 14px;">
            <p style="margin:0 0 10px;font-size:15px;font-weight:600;color:#0f172a;">
              Dear ${provider.contact_name || provider.name || "Partner"},
            </p>
            <p style="margin:0;font-size:14px;color:#475569;line-height:1.6;">
              We are pleased to share a new open vacancy currently available across our employer network. Please review the role details below. If you have suitable, job-ready candidates registered with your service, please reply directly to this email or contact us.
            </p>
          </td>
        </tr>

        <!-- Recruiter Note (if provided) -->
        ${customMessage && customMessage.trim() ? `
        <tr>
          <td style="padding:0 32px 16px;">
            <div style="background:#fffbeb;border:1px solid #fef3c7;border-left:4px solid #f59e0b;border-radius:8px;padding:14px 18px;">
              <p style="margin:0 0 4px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#92400e;">Note from Recruiter</p>
              <p style="margin:0;font-size:13px;color:#78350f;line-height:1.6;white-space:pre-wrap;">${customMessage.trim().replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>")}</p>
            </div>
          </td>
        </tr>` : ""}

        <!-- Role Overview Card -->
        <tr>
          <td style="padding:10px 32px 20px;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border-radius:10px;border:1px solid #e2e8f0;padding:22px 24px;">
              <tr>
                <td>
                  <h2 style="margin:0 0 14px;font-size:20px;font-weight:700;color:#0f172a;">${job.title}</h2>
                  
                  <table width="100%" cellpadding="0" cellspacing="0" style="font-size:13px;line-height:1.9;color:#334155;">
                    ${job.employer_name ? `<tr><td width="140" style="color:#64748b;font-weight:600;padding:3px 0;">Employer / Client:</td><td style="font-weight:700;color:#0f172a;padding:3px 0;">${job.employer_name}</td></tr>` : ""}
                    ${location ? `<tr><td style="color:#64748b;font-weight:600;padding:3px 0;">Location:</td><td style="color:#0f172a;padding:3px 0;">${location}</td></tr>` : ""}
                    ${job.industry ? `<tr><td style="color:#64748b;font-weight:600;padding:3px 0;">Industry:</td><td style="color:#0f172a;padding:3px 0;">${job.industry}</td></tr>` : ""}
                    ${job.vacancy_type ? `<tr><td style="color:#64748b;font-weight:600;padding:3px 0;">Work Type:</td><td style="color:#0f172a;padding:3px 0;">${job.vacancy_type.replace(/_/g, " ").toUpperCase()}</td></tr>` : ""}
                    ${job.positions_count ? `<tr><td style="color:#64748b;font-weight:600;padding:3px 0;">Positions Available:</td><td style="color:#0f172a;padding:3px 0;">${job.positions_count}</td></tr>` : ""}
                    ${payStr ? `<tr><td style="color:#64748b;font-weight:600;padding:3px 0;">Pay Rate:</td><td style="color:#c2410c;font-weight:700;font-size:14px;padding:3px 0;">${payStr}</td></tr>` : ""}
                  </table>

                  ${complianceList.length > 0 ? `
                  <div style="margin-top:16px;padding-top:14px;border-top:1px solid #e2e8f0;">
                    <p style="margin:0 0 8px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:#64748b;">Candidate Requirements:</p>
                    <div>
                      ${complianceList.map((item) => `<span style="display:inline-block;background:#f0fdf4;color:#166534;border:1px solid #bbf7d0;border-radius:6px;padding:4px 10px;font-size:11px;font-weight:600;margin:2px 6px 4px 0;">${item}</span>`).join("")}
                    </div>
                  </div>` : ""}

                  ${(customBody !== undefined ? customBody : job.description) ? `
                  <div style="margin-top:16px;padding-top:14px;border-top:1px solid #e2e8f0;">
                    <p style="margin:0 0 6px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:#64748b;">Role Description & Responsibilities:</p>
                    <p style="margin:0;font-size:13px;color:#334155;line-height:1.7;">${(customBody !== undefined ? customBody : (job.description || "")).replace(/\n/g, "<br>")}</p>
                  </div>` : ""}
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- How to Refer Candidates Note -->
        <tr>
          <td style="padding:0 32px 28px;">
            <div style="background:#fffbeb;border:1px solid #fef3c7;border-left:4px solid #f59e0b;border-radius:8px;padding:14px 18px;">
              <p style="margin:0 0 4px;font-size:12px;font-weight:700;color:#92400e;text-transform:uppercase;">How to Refer Candidates</p>
              <p style="margin:0;font-size:13px;color:#78350f;line-height:1.5;">
                To submit candidate profiles for this vacancy, please reply directly to this email with candidate resume(s) and details, or contact our recruitment team.
              </p>
            </div>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:18px 32px;text-align:center;">
            <p style="margin:0 0 4px;font-size:12px;color:#64748b;">
              Sent by <strong>${sentByName}</strong> via <strong>WorkVision Australia ATS</strong> &bull; Vacancy Broadcast
            </p>
            <p style="margin:0;font-size:11px;color:#94a3b8;">
              WorkVision Australia &bull; connect@workvision.com.au &bull; crm.workvision.com.au
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

      const effectiveDesc = (customBody !== undefined ? customBody : (job.description || "")).trim();
      const text = `${subject}\n\nDear ${provider.contact_name || provider.name || "Partner"},\n\nWe have a new open vacancy:\nRole: ${job.title}\n${job.employer_name ? `Employer: ${job.employer_name}\n` : ""}${location ? `Location: ${location}\n` : ""}${payStr ? `Pay: ${payStr}\n` : ""}${complianceList.length ? `Requirements:\n${complianceList.map((c) => `- ${c}`).join("\n")}\n` : ""}${effectiveDesc ? `\nAbout the Role:\n${effectiveDesc}\n` : ""}\nTo submit candidates, reply directly to this email.\n\nSent by ${sentByName} via WorkVision Australia ATS`;

      try {
      await sendEmail({ to: provider.email.trim(), subject, html, text });
      logger.info(`[VacancyBroadcast] Sent to ${provider.email} for "${job.title}"`);
      results.push({ provider_id: provider.id, name: provider.name, email: provider.email, status: "sent" });
    } catch (err) {
      logger.error(`[VacancyBroadcast] Failed to send to ${provider.email}: ${err.message}`);
      results.push({ provider_id: provider.id, name: provider.name, email: provider.email, status: "failed", error: err.message });
    }

    if (validRecipients.length > 1) {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }

  return results;
}

// ── Multi-Vacancy Broadcast to training providers ─────────────────────────────
export async function sendMultiVacancyBroadcast({ jobs, providers, sentByName, appUrl, customSubject, customMessage, customIntro }) {
  const isSingle = jobs.length === 1;
  const defaultSubject = isSingle
    ? `New Vacancy Alert: ${jobs[0].title} — WorkVision Australia`
    : `Multiple New Vacancies Alert (${jobs.length} Roles Available) — WorkVision Australia`;
  const subject = (customSubject && customSubject.trim()) ? customSubject.trim() : defaultSubject;

  // Render cards for each vacancy
  const jobsHtml = jobs.map((job, idx) => {
    const payStr = formatBroadcastPayRate(job.pay_rate, job.pay_rate_type);
    const location = job.work_location || job.city
      ? [job.work_location || job.city, job.state].filter(Boolean).join(", ")
      : null;
    const complianceList = getComplianceList(job);

    return `
      <tr>
        <td style="padding:0 32px ${idx === jobs.length - 1 ? "20px" : "14px"};">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border-radius:10px;border:1px solid #e2e8f0;padding:20px 24px;">
            <tr>
              <td>
                <span style="display:inline-block;background:#0f172a;color:#ffffff;font-size:10px;font-weight:700;padding:2px 8px;border-radius:4px;text-transform:uppercase;margin-bottom:6px;">Role ${idx + 1} of ${jobs.length}</span>
                <h3 style="margin:4px 0 12px;font-size:19px;font-weight:700;color:#0f172a;">${job.title}</h3>
                
                <table width="100%" cellpadding="0" cellspacing="0" style="font-size:13px;line-height:1.9;color:#334155;">
                  ${job.employer_name ? `<tr><td width="140" style="color:#64748b;font-weight:600;padding:3px 0;">Employer / Client:</td><td style="font-weight:700;color:#0f172a;padding:3px 0;">${job.employer_name}</td></tr>` : ""}
                  ${location ? `<tr><td style="color:#64748b;font-weight:600;padding:3px 0;">Location:</td><td style="color:#0f172a;padding:3px 0;">${location}</td></tr>` : ""}
                  ${job.industry ? `<tr><td style="color:#64748b;font-weight:600;padding:3px 0;">Industry:</td><td style="color:#0f172a;padding:3px 0;">${job.industry}</td></tr>` : ""}
                  ${job.vacancy_type ? `<tr><td style="color:#64748b;font-weight:600;padding:3px 0;">Work Type:</td><td style="color:#0f172a;padding:3px 0;">${job.vacancy_type.replace(/_/g, " ").toUpperCase()}</td></tr>` : ""}
                  ${job.positions_count ? `<tr><td style="color:#64748b;font-weight:600;padding:3px 0;">Positions Available:</td><td style="color:#0f172a;padding:3px 0;">${job.positions_count}</td></tr>` : ""}
                  ${payStr ? `<tr><td style="color:#64748b;font-weight:600;padding:3px 0;">Pay Rate:</td><td style="color:#c2410c;font-weight:700;font-size:14px;padding:3px 0;">${payStr}</td></tr>` : ""}
                </table>

                ${complianceList.length > 0 ? `
                <div style="margin-top:14px;padding-top:12px;border-top:1px solid #e2e8f0;">
                  <p style="margin:0 0 8px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:#64748b;">Candidate Requirements:</p>
                  <div>
                    ${complianceList.map((item) => `<span style="display:inline-block;background:#f0fdf4;color:#166534;border:1px solid #bbf7d0;border-radius:6px;padding:4px 10px;font-size:11px;font-weight:600;margin:2px 6px 4px 0;">${item}</span>`).join("")}
                  </div>
                </div>` : ""}

                ${job.description ? `
                <div style="margin-top:14px;padding-top:12px;border-top:1px solid #e2e8f0;">
                  <p style="margin:0;font-size:12px;color:#64748b;line-height:1.6;">${job.description.slice(0, 240).replace(/\n/g, " ")}${job.description.length > 240 ? "..." : ""}</p>
                </div>` : ""}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    `;
  }).join("");

  const validRecipients = (providers || []).filter((p) => p && p.email && p.email.includes("@"));
  const results = [];

  for (const provider of validRecipients) {
    const defaultIntro = isSingle
        ? "We are pleased to share 1 new open vacancy currently available across our employer network. Please review the role details below. If you have suitable, job-ready candidates registered with your service, please reply directly to this email or contact us."
        : `We are pleased to share ${jobs.length} new open vacancies currently available across our employer network. Please review the roles below. If you have suitable, job-ready candidates registered with your service, please reply directly to this email or contact us.`;

      const introText = customIntro && customIntro.trim() ? customIntro.trim() : defaultIntro;

      const html = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:36px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.04);border:1px solid #e2e8f0;">
        
        <!-- Clean White Header with Official Crisp Retina Logo -->
        <tr>
          <td style="background:#ffffff;padding:24px 32px;border-bottom:2px solid #f1f5f9;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td valign="middle">
                  <img src="https://crm.workvision.com.au/WV-Logo-v2@2x.png" alt="WorkVision Australia" width="180" style="display:block;max-width:180px;height:auto;border:0;" />
                </td>
                <td align="right" valign="middle">
                  <span style="display:inline-block;background:#f8fafc;color:#0f172a;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;padding:6px 14px;border-radius:20px;border:1px solid #e2e8f0;">
                    ${isSingle ? "Vacancy Alert" : `Multiple Vacancies (${jobs.length} Roles)`}
                  </span>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        
        <!-- Recipient Greeting & Intro -->
        <tr>
          <td style="padding:28px 32px 14px;">
            <p style="margin:0 0 10px;font-size:15px;font-weight:600;color:#0f172a;">
              Dear ${provider.contact_name || provider.name || "Partner"},
            </p>
            <p style="margin:0;font-size:14px;color:#475569;line-height:1.6;">
              ${introText}
            </p>
          </td>
        </tr>

        <!-- Recruiter Custom Note (if provided) -->
        ${customMessage && customMessage.trim() ? `
        <tr>
          <td style="padding:0 32px 16px;">
            <div style="background:#fffbeb;border:1px solid #fef3c7;border-left:4px solid #f59e0b;border-radius:8px;padding:14px 18px;">
              <p style="margin:0 0 4px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#92400e;">Note from Recruiter</p>
              <p style="margin:0;font-size:13px;color:#78350f;line-height:1.6;white-space:pre-wrap;">${customMessage.trim().replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>")}</p>
            </div>
          </td>
        </tr>` : ""}

        <!-- List of Vacancies Cards -->
        <tr>
          <td>
            <table width="100%" cellpadding="0" cellspacing="0">
              ${jobsHtml}
            </table>
          </td>
        </tr>

        <!-- How to Refer Candidates Note -->
        <tr>
          <td style="padding:0 32px 28px;">
            <div style="background:#fffbeb;border:1px solid #fef3c7;border-left:4px solid #f59e0b;border-radius:8px;padding:14px 18px;">
              <p style="margin:0 0 4px;font-size:12px;font-weight:700;color:#92400e;text-transform:uppercase;">How to Refer Candidates</p>
              <p style="margin:0;font-size:13px;color:#78350f;line-height:1.5;">
                To submit candidate profiles for any of the roles above, please reply directly to this email with candidate resume(s) and role reference, or contact our recruitment team.
              </p>
            </div>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:18px 32px;text-align:center;">
            <p style="margin:0 0 4px;font-size:12px;color:#64748b;">
              Sent by <strong>${sentByName}</strong> via <strong>WorkVision Australia ATS</strong> &bull; Vacancy Broadcast
            </p>
            <p style="margin:0;font-size:11px;color:#94a3b8;">
              WorkVision Australia &bull; connect@workvision.com.au &bull; crm.workvision.com.au
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

      const text = `${subject}\n\nDear ${provider.contact_name || provider.name || "Partner"},\n\n${introText}\n\n${jobs.map((j, i) => `${i + 1}. ${j.title} (${j.work_location || j.city || "Location TBA"}) - Pay: ${formatBroadcastPayRate(j.pay_rate, j.pay_rate_type) || "TBA"}`).join("\n")}\n\nTo submit candidate profiles, reply directly to this email.\n\nSent by ${sentByName} via WorkVision Australia ATS`;

      try {
      await sendEmail({ to: provider.email.trim(), subject, html, text });
      logger.info(`[MultiVacancyBroadcast] Sent to ${provider.email} (${jobs.length} roles)`);
      results.push({ provider_id: provider.id, name: provider.name, email: provider.email, status: "sent" });
    } catch (err) {
      logger.error(`[MultiVacancyBroadcast] Failed to send to ${provider.email}: ${err.message}`);
      results.push({ provider_id: provider.id, name: provider.name, email: provider.email, status: "failed", error: err.message });
    }

    if (validRecipients.length > 1) {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }

  return results;
}

