import { pool } from "../config/db.js";
import { getValidXeroAccessToken } from "./xero-auth.js";

const XERO_API = "https://api.xero.com/api.xro/2.0";

export class XeroApiError extends Error {
  constructor(status, message, body) {
    super(message);
    this.name = "XeroApiError";
    this.status = status;
    this.body = body;
  }
}

async function xeroFetch(path, init = {}, attempt = 1) {
  const { accessToken, tenantId } = await getValidXeroAccessToken();
  const res = await fetch(`${XERO_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Xero-tenant-id": tenantId,
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });

  if (res.status === 429 && attempt === 1) {
    await new Promise((r) => setTimeout(r, 1000));
    return xeroFetch(path, init, 2);
  }

  const text = await res.text();
  const body = text ? safeJson(text) : null;
  if (!res.ok) throw new XeroApiError(res.status, body?.Detail || body?.Title || `xero_${res.status}`, body);
  return body;
}

function safeJson(s) { try { return JSON.parse(s); } catch { return { raw: s }; } }

function escapeQuoted(name) {
  return name.replace(/"/g, '\\"');
}

export async function searchContactsByName(name) {
  const where = `Name=="${escapeQuoted(name)}"`;
  const path = `/Contacts?where=${encodeURIComponent(where)}`;
  const json = await xeroFetch(path);
  return (json?.Contacts || []).map((c) => ({
    contact_id: c.ContactID,
    name: c.Name,
    email: c.EmailAddress || null,
  }));
}

export async function searchContactsLike(searchText) {
  // Free-text search used by the admin "link provider to Xero contact" UI.
  const path = `/Contacts?searchTerm=${encodeURIComponent(searchText)}`;
  const json = await xeroFetch(path);
  return (json?.Contacts || []).map((c) => ({
    contact_id: c.ContactID,
    name: c.Name,
    email: c.EmailAddress || null,
  }));
}

export async function createContact({ name, email }) {
  const json = await xeroFetch("/Contacts", {
    method: "POST",
    body: JSON.stringify({
      Contacts: [{ Name: name, EmailAddress: email || undefined }],
    }),
  });
  const c = json?.Contacts?.[0];
  return { contact_id: c.ContactID, name: c.Name, email: c.EmailAddress || null };
}

function buildInvoiceDescription({ trainingName, candidateName, startDate, endDate }) {
  const dates = [startDate, endDate].filter(Boolean).join(" to ");
  return [trainingName, candidateName, dates].filter(Boolean).join(" — ");
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}
function plusDaysIso(days) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export async function createDraftInvoice({
  contactId, description, quantity, unitPrice, currencyCode = "AUD",
}) {
  const accountCode = process.env.XERO_REVENUE_ACCOUNT_CODE || "200";
  const json = await xeroFetch("/Invoices", {
    method: "POST",
    body: JSON.stringify({
      Type: "ACCREC",
      Contact: { ContactID: contactId },
      Date: todayIso(),
      DueDate: plusDaysIso(30),
      LineAmountTypes: "Exclusive",
      Status: "DRAFT",
      CurrencyCode: currencyCode,
      LineItems: [{
        Description: description,
        Quantity: quantity,
        UnitAmount: unitPrice,
        AccountCode: accountCode,
      }],
    }),
  });
  const inv = json?.Invoices?.[0];
  return {
    xero_invoice_id:     inv.InvoiceID,
    xero_invoice_number: inv.InvoiceNumber || null,
    total_amount:        inv.Total ?? null,
    currency_code:       inv.CurrencyCode || currencyCode,
    raw:                 inv,
  };
}

export async function recordInvoice({
  candidate_training_id, xero_invoice_id, xero_invoice_number, xero_contact_id,
  status = "DRAFT", total_amount, currency_code, xero_response, created_by,
}) {
  const { rows } = await pool.query(
    `INSERT INTO xero_invoices (candidate_training_id, xero_invoice_id, xero_invoice_number, xero_contact_id, status, total_amount, currency_code, xero_response, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [candidate_training_id, xero_invoice_id, xero_invoice_number, xero_contact_id, status, total_amount, currency_code, xero_response, created_by]
  );
  return rows[0];
}

export async function listInvoicesForEnrolment(candidateTrainingId) {
  const { rows } = await pool.query(
    `SELECT * FROM xero_invoices WHERE candidate_training_id = $1 ORDER BY created_at DESC`,
    [candidateTrainingId]
  );
  return rows;
}

export { buildInvoiceDescription };
