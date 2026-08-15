// Shared HTML email layout and helpers for the Daily Drip Resend
// notification provider. Every template in templates.ts renders through
// renderLayout so all transactional emails share the same branded chrome:
// cream background, white card, deep-green hero band, amber accent rule.
//
// Brand colors mirror storefront/src/styles.css (forest #0B1710, cream
// #FAF7F0, amber #E8A33D). Layout is table-based with inline styles only -
// email clients (Gmail, Outlook, Apple Mail) drop <style> blocks and divs.

export const BRAND = {
  forest: "#0B1710",
  green: "#1B5E3A",
  amber: "#E8A33D",
  cream: "#FAF7F0",
  ink: "#0B1710",
  muted: "#5C6B63",
  card: "#FFFFFF",
  border: "#E7E1D5",
}

export type ItemRow = {
  title: string
  quantity: number
  thumbnail?: string
  unit_price?: string
}

const FONT_STACK =
  "Arial, Helvetica, sans-serif"

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

export function formatInr(value: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value)
}

// Readable date for customer-facing copy, e.g. "15 Aug 2026".
export function formatDate(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date)
}

// Inner HTML for a <tbody> of order line-item rows. unit_price is already
// formatted by the caller (e.g. "₹749") - never format inside.
export function itemsRows(items: ItemRow[]): string {
  return items
    .map((item) => {
      const thumbnail = item.thumbnail
        ? `<img src="${escapeHtml(item.thumbnail)}" alt="${escapeHtml(item.title)}" width="48" height="48" style="display:block;width:48px;height:48px;border-radius:8px;object-fit:cover;border:1px solid ${BRAND.border};" />`
        : ""
      const price = item.unit_price
        ? `<td align="right" style="padding:12px 0 12px 16px;font-family:${FONT_STACK};font-size:14px;color:${BRAND.ink};white-space:nowrap;">${escapeHtml(item.unit_price)}</td>`
        : ""
      return `
        <tr>
          <td style="padding:12px 0;border-bottom:1px solid ${BRAND.border};vertical-align:middle;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
              <tr>
                <td width="48" style="padding-right:12px;vertical-align:middle;">${thumbnail}</td>
                <td style="vertical-align:middle;font-family:${FONT_STACK};font-size:14px;color:${BRAND.ink};">
                  <span style="font-weight:600;">${escapeHtml(item.title)}</span><br />
                  <span style="font-size:12px;color:${BRAND.muted};">Qty ${item.quantity}</span>
                </td>
                ${price}
              </tr>
            </table>
          </td>
        </tr>
      `
    })
    .join("")
}

export function renderLayout(opts: {
  preheader: string
  heading: string
  body: string
  cta?: { label: string; url: string }
}): string {
  const { preheader, heading, body, cta } = opts

  const ctaHtml = cta
    ? `
          <tr>
            <td align="center" style="padding:24px 0 0;">
              <a href="${escapeHtml(cta.url)}" style="display:inline-block;background-color:${BRAND.green};color:#FFFFFF;text-decoration:none;font-family:${FONT_STACK};font-size:15px;font-weight:600;padding:12px 28px;border-radius:8px;">${escapeHtml(cta.label)}</a>
            </td>
          </tr>`
    : ""

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>Daily Drip</title>
  <style>
    @media only screen and (max-width: 620px) {
      .email-container { width: 100% !important; }
      .email-padding { padding: 24px 20px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:${BRAND.cream};">
  <div style="display:none;max-height:0;overflow:hidden;">${escapeHtml(preheader)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${BRAND.cream};">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" class="email-container" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;background-color:${BRAND.card};border-radius:12px;overflow:hidden;">
          <tr>
            <td align="center" style="padding:28px 32px 20px;background-color:${BRAND.card};border-bottom:2px solid ${BRAND.amber};">
              <span style="font-family:${FONT_STACK};font-size:20px;font-weight:700;letter-spacing:6px;color:${BRAND.forest};">DAILY DRIP</span>
            </td>
          </tr>
          <tr>
            <td style="background-color:${BRAND.forest};padding:32px 32px;">
              <h1 style="margin:0;font-family:${FONT_STACK};font-size:24px;font-weight:700;color:#FFFFFF;line-height:1.3;">${escapeHtml(heading)}</h1>
            </td>
          </tr>
          <tr>
            <td class="email-padding" style="padding:32px;background-color:${BRAND.card};">
              ${body}
              ${ctaHtml}
            </td>
          </tr>
          <tr>
            <td style="padding:24px 32px;background-color:${BRAND.cream};border-top:1px solid ${BRAND.border};">
              <span style="font-family:${FONT_STACK};font-size:12px;color:${BRAND.muted};line-height:1.6;">
                Daily Drip · yourdailydrip.com<br />
                Questions? Reply to this email
              </span>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}