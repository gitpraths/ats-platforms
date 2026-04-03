import cron from "node-cron";
import { pool } from "../config/db.js";
import { sendWelfareCheckEmail } from "./email.js";
import logger from "../config/logger.js";

export async function runWelfareCheckJob() {
  logger.info("Welfare check cron: starting job");
  let sent = 0;
  let failed = 0;

  try {
    const today = new Date().toISOString().split("T")[0];

    const { rows: checks } = await pool.query(
      `SELECT wc.*,
              p.start_date, p.id AS placement_id,
              c.name AS candidate_name,
              j.title AS job_title,
              e.name AS employer_name, e.contact_name, e.contact_email
       FROM welfare_checks wc
       JOIN placements p  ON p.id = wc.placement_id
       JOIN candidates c  ON c.id = p.candidate_id
       JOIN jobs j        ON j.id = p.job_id
       LEFT JOIN employers e ON e.id = p.employer_id
       WHERE wc.due_date <= $1
         AND wc.completed_at IS NULL
         AND wc.email_sent_at IS NULL`,
      [today]
    );

    logger.info(`Welfare check cron: found ${checks.length} pending check(s)`);

    for (const check of checks) {
      if (!check.contact_email) {
        logger.warn(`Welfare check cron: skipping check ${check.id} — employer has no contact email`);
        failed++;
        continue;
      }

      try {
        await sendWelfareCheckEmail({
          welfareCheck: { check_type: check.check_type, due_date: check.due_date },
          placement: { start_date: check.start_date },
          employer: {
            contact_name: check.contact_name,
            contact_email: check.contact_email,
            name: check.employer_name,
          },
          candidate: { name: check.candidate_name },
          job: { title: check.job_title },
        });

        await pool.query(
          `UPDATE welfare_checks SET email_sent_at = NOW() WHERE id = $1`,
          [check.id]
        );
        sent++;
      } catch (err) {
        logger.error(`Welfare check cron: failed for check ${check.id} — ${err.message}`);
        failed++;
      }
    }
  } catch (err) {
    logger.error(`Welfare check cron: job failed — ${err.message}`);
  }

  logger.info(`Welfare check cron: done — sent=${sent} failed=${failed}`);
  return { sent, failed };
}

export function startWelfareCheckCron() {
  if (process.env.WELFARE_CRON_ENABLED === "false") {
    logger.info("Welfare check cron: disabled via WELFARE_CRON_ENABLED=false");
    return;
  }

  // Daily at 08:00 server time
  cron.schedule("0 8 * * *", () => {
    runWelfareCheckJob();
  });

  logger.info("Welfare check cron: scheduled at 08:00 daily");
}
