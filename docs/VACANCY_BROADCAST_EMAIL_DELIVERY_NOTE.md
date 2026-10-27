# Vacancy Broadcast Email Delivery & Railway SMTP Note

**Date:** 27 October 2026  
**Application:** WorkVision Australia CRM (ATS)  
**Production URL:** https://crm.workvision.com.au  
**Backend API:** https://my-atsbackend-production.up.railway.app  
**Sender Account:** `connect@workvision.com.au`  
**Official Mail Provider:** Zoho Mail Australia (`smtppro.zoho.com.au` / `smtp.zoho.com.au`)

---

## 1. Issue Summary
When staff attempted to broadcast vacancies to training providers and custom individual emails (such as `judesai@gmail.com`), the modal displayed a spinning indicator on "Broadcasting..." and emails were not delivered to recipients.

---

## 2. Root Cause Analysis & Technical Findings

1. **SMTP Credentials Validated Outside Railway:**
   - Zoho SMTP server hosts (`smtppro.zoho.com.au` and `smtp.zoho.com.au`) on both Port 465 (SSL) and Port 587 (STARTTLS) were tested with Node.js and verified to authenticate and deliver successfully.

2. **Code Optimizations Applied:**
   - **Eliminated Stale Connection Pools:** Switched transporter to `pool: false` to guarantee fresh TCP handshakes for each email burst, avoiding silent half-open socket stalls.
   - **Explicit Timeouts:** Configured `connectionTimeout: 8000ms`, `greetingTimeout: 8000ms`, and `socketTimeout: 12000ms`.
   - **Automated Port Fallback:** Added automatic fallback from port 465 (direct SSL) to port 587 (STARTTLS) if port 465 fails.
   - **Frontend UI Guard:** Added `try...finally { setLoading(false); }` inside `BroadcastMultiModal.tsx` and `BroadcastToProvidersModal.tsx` so the UI never remains permanently frozen.

3. **Railway Platform Firewall (The Core Block):**
   - Live end-to-end testing against the production backend `/api/jobs/test-email` confirmed `Connection timeout`.
   - **Official Railway Platform Policy:** Railway strictly blocks outbound traffic on traditional SMTP ports (`25`, `465`, and `587`) on Free, Trial, and Hobby tiers to prevent platform spam abuse.
   - Outbound packets on ports 465 and 587 are dropped at the container network boundary, causing all standard SMTP connections to time out.

---

## 3. Options for Restoring Delivery

### Option A: Upgrade Railway to the Pro Plan ($20 USD / month)
- **Mechanism:** Railway automatically unblocks outbound SMTP ports 465 and 587 for accounts on the Pro plan.
- **Effort:** Zero DNS changes and zero third-party platform configuration.
- **Result:** Existing Zoho SMTP credentials (`connect@workvision.com.au`) work immediately upon upgrading.

### Option B: Use an HTTPS Email API over Port 443 (Free)
- **Mechanism:** Cloud containers never block standard HTTPS traffic (Port 443). Using an HTTP/REST API allows emails to send in under 200ms without socket timeouts.
- **Recommended Provider:**
  - **Resend (resend.com):** 3,000 free emails/month ($0 forever). Requires adding 2 DKIM TXT records in Cloudflare DNS for `workvision.com.au`.
  - **Zoho ZeptoMail / CPaaS:** Pay-as-you-go credits ($3.50 AUD for 10,000 emails). Requires completing CNAME bounce verification.

---

## 4. Current Status
- Both Cloudflare DNS and Zoho CPaaS have been restored to their clean, original state.
- Backend and frontend code has been hardened with timeouts, fallback logic, and non-blocking error handling.
- Pending decision on whether to proceed with **Railway Pro ($20/mo)** or **Resend HTTPS API ($0/mo)**.
