# Resend Email Setup Guide (Vacancy Broadcast Fix)

**Application:** WorkVision Australia CRM
**Domain:** `workvision.com.au` (mail hosted on Zoho Mail Australia)
**Sender:** `connect@workvision.com.au`

---

## 1. Why this is needed

Railway blocks outbound SMTP (ports 25, 465, 587) on Free, Trial and Hobby plans. Broadcast emails therefore fail with:

> Could not deliver broadcast: Connection timeout. Please check SMTP configuration.

Resend sends email over HTTPS (port 443), which Railway does not block. Existing Zoho mail (sending and receiving mailboxes) is not affected.

## 2. Is Zoho safe?

Yes. Current DNS shows incoming mail for `workvision.com.au` is handled by Zoho Australia:

- `mx.zoho.com.au` (priority 10)
- `mx2.zoho.com.au` (priority 20)
- `mx3.zoho.com.au` (priority 50)

Resend uses its own names (`resend._domainkey` and a `send` subdomain), so it does not overlap with Zoho records. Replies to broadcast emails still arrive in the Zoho inbox for `connect@workvision.com.au`.

---

## 3. Step-by-step setup

### Part 1: Create the Resend account
1. Go to **resend.com** and click **Sign up**.
2. Sign up with a company email address, for example `connect@workvision.com.au`.
3. Confirm your email from the message Resend sends.

### Part 2: Add the domain in Resend
1. In the Resend dashboard, click **Domains**.
2. Click **Add Domain**.
3. Enter `workvision.com.au`.
4. Choose region **Sydney (ap-southeast-2)** if listed, otherwise keep the default.
5. Click **Add**. A table of DNS records is shown. Keep this page open.

### Part 3: Add the records in Cloudflare
1. Log in to **dash.cloudflare.com**.
2. Select `workvision.com.au`, then **DNS**, then **Records**.
3. For each row in the Resend table, click **Add record** and copy the values exactly:

| Resend column | Cloudflare field |
|---|---|
| Type (TXT or MX) | Type |
| Name | Name |
| Content / Value | Content (Mail server for MX) |
| Priority (MX only) | Priority |

4. Leave TTL as **Auto**.
5. Set **Proxy status** to **DNS only** (grey cloud) on every record.
6. Click **Save** after each record.

### Part 4: Do not touch
- Do not delete or edit any existing record, especially the Zoho MX records.
- Only add new records.
- Do not add anything to the root MX.
- If a root SPF record already exists, do not add a second one. Only one SPF record is allowed per name; contact the developer to merge them.

### Part 5: Verify in Resend
1. Back in Resend, click **Verify DNS Records**.
2. Wait a few minutes (up to an hour) and refresh until the status shows **Verified**.
3. If still pending after an hour, send screenshots of the Resend table and the Cloudflare DNS list.

### Part 6: Create the API key
1. In Resend, open **API Keys** and click **Create API Key**.
2. Name: `WorkVision CRM`. Permission: **Sending access**. Domain: `workvision.com.au`.
3. Click **Add** and copy the key immediately (starts with `re_`, shown only once).

### Part 7: Add variables in Railway
1. Open the Railway project, select the **backend** service, then **Variables**.
2. Add `RESEND_API_KEY` with the key.
3. Add `EMAIL_FROM` with `WorkVision Australia <connect@workvision.com.au>`.
4. Wait for Railway to redeploy.

### Part 8: Notify the developer
Message: "Resend verified and variables added". The developer then applies the code change, deploys and runs a test broadcast.

---

## 4. Planned code change (after approval)

All in `packages/backend/src/services/email.js`:

1. `sendEmail()` uses the Resend API (`https://api.resend.com/emails`) when `RESEND_API_KEY` is set. Callers (vacancy broadcasts, placement confirmations, welfare checks) need no change.
2. Zoho SMTP remains as a fallback when the key is not set.
3. Reply-To is set to `connect@workvision.com.au`.
4. Delay between recipients raised to about 600ms (Resend allows 2 requests per second), with one retry on rate-limit errors.
5. Error messages show the real reason (for example domain not verified, invalid API key).

## 5. Testing checklist

1. Send a test email to one address and check inbox and spam folder.
2. Broadcast one vacancy to one or two providers.
3. Broadcast to all recipients.

## 6. Limits to know

Resend free plan: 3,000 emails per month and 100 emails per day. A broadcast to 20 providers uses 20 of the daily 100. The paid plan (about 20 USD/month) removes the daily cap.
