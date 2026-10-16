# 🚀 ATS Platform — Hosting & Deployment Plan

**Prepared for:** Client  
**Prepared by:** Development Team  
**Date:** October 2026  
**Platform:** Railway (Hosting) + Cloudflare (Domain & DNS) + GitHub (Code)


---

## ✅ What We Are Using & Why

| Service | Purpose | Cost |
| :--- | :--- | :---: |
| **Railway** | Host the ATS application (frontend + backend + database) | Paid plan ~\$5–20/mo |
| **Cloudflare** | Domain registration & DNS management | Free DNS (domain ~\$10–15/yr) |
| **GitHub** | Store the code and auto-deploy to Railway on every update | Free |
| **Railway SSL** | HTTPS / SSL certificate for your domain | **Free (auto)** |
| **Railway PostgreSQL** | Production database | Included in Railway |

---

## 📋 Step-by-Step Deployment Plan

---

### STEP 1 — Register Domain on Cloudflare

> **Who does this:** Client  
> **Time required:** 10 minutes

1. Go to **[cloudflare.com](https://cloudflare.com)** and create a free account.
2. Click **"Register a Domain"** in the Cloudflare dashboard.
3. Search for your preferred domain name (e.g., `youratsplatform.com`).
4. Purchase the domain (~\$10–15/year — no hidden fees, Cloudflare charges at cost).
5. Cloudflare becomes both your **registrar** and **DNS manager** automatically.

> [!TIP]
> If you already own a domain (e.g., via GoDaddy or Namecheap), you can transfer it to Cloudflare for free, or simply point its nameservers to Cloudflare's nameservers.

---

### STEP 2 — Create GitHub Account & Repository

> **Who does this:** Client (or Developer sets up on client's behalf)  
> **Time required:** 5 minutes

1. Go to **[github.com](https://github.com)** and create a free account.
2. Create a new **private repository** named `my-ats-platform`.
3. Share repository access with the developer (invite via GitHub username or email).
4. Developer will push the full ATS platform code to this repository.

> [!NOTE]
> GitHub is free for private repositories. Your code will be securely stored and version-controlled. Every code update can be automatically deployed to Railway.

---

### STEP 3 — Create Railway Account & Project

> **Who does this:** Developer  
> **Time required:** 10 minutes

1. Go to **[railway.app](https://railway.app)** and sign up using the GitHub account.
2. Click **"New Project"** → **"Deploy from GitHub repo"**.
3. Select the `my-ats-platform` repository.
4. Railway will auto-detect the project structure and set up:
   - ✅ **Backend** (Node.js / Express API)
   - ✅ **Frontend** (React / Vite static build)
   - ✅ **PostgreSQL** database (provisioned automatically)

---

### STEP 4 — Configure Environment Variables on Railway

> **Who does this:** Developer  
> **Time required:** 15 minutes

The following environment variables must be set in the Railway dashboard under **"Variables"**:

```
DATABASE_URL          → Auto-filled by Railway PostgreSQL
JWT_SECRET            → Secure random 64-character string
ANTHROPIC_API_KEY     → Claude AI API key
AZURE_CLIENT_ID       → Microsoft OAuth App ID
AZURE_CLIENT_SECRET   → Microsoft OAuth Secret
AZURE_TENANT_ID       → common
MS_REDIRECT_URI       → https://yourdomain.com/api/ms-auth/callback
TOKEN_ENCRYPTION_KEY  → 64-character hex string
VITE_API_URL          → https://yourdomain.com/api
```

> [!IMPORTANT]
> These are sensitive credentials. Never share them publicly or commit them to GitHub. Railway stores them securely.

---

### STEP 5 — Connect Custom Domain & SSL

> **Who does this:** Developer + Client (DNS access needed)  
> **Time required:** 15 minutes setup + up to 24 hours DNS propagation

#### 5a — Add Domain in Railway
1. In Railway dashboard → select your service → **Settings** → **Networking** → **Custom Domain**.
2. Add your domain (e.g., `ats.yourdomain.com` or `app.yourdomain.com`).
3. Railway will show a **CNAME record value** to copy.

#### 5b — Add DNS Record in Cloudflare
1. Log into **Cloudflare dashboard** → select your domain.
2. Go to **DNS** → **Add Record**:

| Type | Name | Target | Proxy |
| :--- | :--- | :--- | :--- |
| `CNAME` | `ats` (or `app` or `@`) | `xxxx.up.railway.app` | ✅ Proxied |

3. Save the record.

#### 5c — SSL Certificate (Automatic)
- Railway automatically detects the DNS record and issues a **free Let's Encrypt SSL certificate** within minutes.
- Your site will be accessible at `https://ats.yourdomain.com` with a green padlock 🔒.
- SSL auto-renews every 90 days — **no manual action ever needed**.

---

### STEP 6 — Import Real Client Data

> **Who does this:** Developer  
> **Time required:** 30–60 minutes

Once the app is live, the developer will:

1. Run the database cleanup script (remove all sample/test data).
2. Import real data in this order:
   - ✅ Training Providers (AMES, WISE, Jobfind etc.)
   - ✅ Employers (companies)
   - ✅ Vacancies / Job listings
   - ✅ Candidates (~2,873 records from Excel)
   - ✅ Placements (active placed candidates)
3. Create the client's real admin login credentials.
4. Verify all data is correct in the ATS UI.

---

### STEP 7 — Go Live & Handover

> **Who does this:** Developer + Client  
> **Time required:** 30 minutes

1. Client verifies data looks correct in the live system.
2. Developer provides:
   - ✅ Admin login credentials
   - ✅ URL of the live platform
   - ✅ Short walkthrough of key features
3. Platform is **live and handed over** ✅.

---

## 🔄 How Future Updates Work (Auto-Deployment)

Once everything is set up, deploying updates is simple:

```
Developer makes code changes
         ↓
Pushes to GitHub repository
         ↓
Railway automatically detects the push
         ↓
Rebuilds and redeploys the app (takes ~2-3 minutes)
         ↓
Live site is updated ✅ (zero downtime)
```

> [!NOTE]
> No manual server management is needed. Railway handles all rebuilds and restarts automatically on every code push to the `main` branch.

---

## 💰 Estimated Monthly Costs

| Service | Plan | Estimated Cost |
| :--- | :--- | :---: |
| **Railway** | Hobby / Pro plan | ~\$5–20/month |
| **Cloudflare Domain** | Annual registration | ~\$1/month (billed yearly) |
| **GitHub** | Free private repo | \$0 |
| **SSL Certificate** | Auto via Railway | \$0 |
| **Total Estimated** | | **~\$6–21/month** |

---

## 📞 Summary — What Client Needs to Do

| Action | Who | Status |
| :--- | :--- | :---: |
| Register domain on Cloudflare | Client | 🔲 Pending |
| Create GitHub account | Client | 🔲 Pending |
| Share GitHub access with developer | Client | 🔲 Pending |
| Confirm preferred domain/subdomain name | Client | 🔲 Pending |
| Provide Railway billing approval | Client | 🔲 Pending |

> [!IMPORTANT]
> The developer will handle all technical setup once the above actions are completed by the client.

---

*For any questions, please contact the development team.*
