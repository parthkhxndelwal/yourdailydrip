// In-code email templates for Daily Drip transactional notifications. Keys
// are constants referenced by the notification subscribers (order.placed,
// order.fulfillment_created, order.canceled) - do not rename them or change
// the data shapes without updating the subscribers that send them.
//
// Placeholders use `{{key}}` syntax and are interpolated from the
// notification `data` object by `renderTemplate` / `renderSubject`. String
// values are HTML-escaped before insertion; array values (e.g. `items`)
// render as order line-item rows via `itemsRows`; undefined/null values
// render as an empty string. The internal Medusa `order_id` is never
// included in customer-facing copy - only the public `display_id`.

import {
  BRAND,
  escapeHtml,
  itemsRows,
  renderLayout,
  type ItemRow,
} from "./layout"

export type EmailTemplateName =
  | "order_ack"
  | "preorder_ack"
  | "order_shipped"
  | "preorder_refund"
  | "order_canceled"

export type EmailTemplate = {
  subject: string
  html: string
}

const FONT_STACK = "Arial, Helvetica, sans-serif"

const paragraphStyle = `margin:0 0 16px;font-family:${FONT_STACK};font-size:15px;line-height:1.6;color:${BRAND.ink};`

// Items table ({{items}} -> <tbody> rows via itemsRows) followed by a total
// row ({{total}} is already formatted by the caller, e.g. "₹749").
function itemsTableBody(): string {
  return `
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 16px;border-top:1px solid ${BRAND.border};">
          <tbody>{{items}}</tbody>
        </table>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 4px;">
          <tr>
            <td style="padding:12px 0;font-family:${FONT_STACK};font-size:14px;color:${BRAND.ink};">Total</td>
            <td align="right" style="padding:12px 0;font-family:${FONT_STACK};font-size:14px;font-weight:700;color:${BRAND.ink};">{{total}}</td>
          </tr>
        </table>`
}

export const TEMPLATES: Record<EmailTemplateName, EmailTemplate> = {
  order_ack: {
    subject: "Order #{{display_id}} confirmed - Daily Drip",
    html: renderLayout({
      preheader: "Your order #{{display_id}} has been confirmed. Thank you for shopping with Daily Drip.",
      heading: "Order confirmed",
      body: `
        <p style="${paragraphStyle}">Thank you for your order. Your order <strong>#{{display_id}}</strong> has been confirmed and is being prepared.</p>${itemsTableBody()}`,
      cta: { label: "View your order", url: "{{order_url}}" },
    }),
  },
  preorder_ack: {
    subject: "Preorder #{{display_id}} confirmed - Daily Drip",
    html: renderLayout({
      preheader: "Your preorder #{{display_id}} has been confirmed. We will ship it by {{expected_ship_date}}.",
      heading: "Your preorder is locked in",
      body: `
        <p style="${paragraphStyle}">Thank you for your preorder. Your order <strong>#{{display_id}}</strong> has been confirmed.</p>
        <p style="${paragraphStyle}">We expect your items to ship by <strong>{{expected_ship_date}}</strong>. You will receive a tracking link as soon as your order is on its way.</p>${itemsTableBody()}`,
      cta: { label: "View your order", url: "{{order_url}}" },
    }),
  },
  order_shipped: {
    subject: "Your order #{{display_id}} has shipped - Daily Drip",
    html: renderLayout({
      preheader: "Your order #{{display_id}} is on its way.",
      heading: "Your order is on its way",
      body: `
        <p style="${paragraphStyle}">Your order <strong>#{{display_id}}</strong> has been shipped. Track it with the airway bill number below:</p>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 16px;">
          <tr>
            <td style="padding:16px;background-color:${BRAND.cream};border:1px solid ${BRAND.border};border-radius:8px;text-align:center;font-family:Consolas, Menlo, monospace;font-size:18px;font-weight:700;color:${BRAND.ink};">{{awb}}</td>
          </tr>
        </table>
        <p style="${paragraphStyle}">The courier will update the tracking status as your shipment moves. Please allow a day for the first scan to appear.</p>`,
      cta: { label: "Track your order", url: "{{track_url}}" },
    }),
  },
  preorder_refund: {
    subject: "Your preorder #{{display_id}} was refunded - Daily Drip",
    html: renderLayout({
      preheader: "Your preorder #{{display_id}} was refunded.",
      heading: "Refund issued",
      body: `
        <p style="${paragraphStyle}">Your preorder <strong>#{{display_id}}</strong> has been cancelled and a refund has been issued to your original payment method.</p>
        <p style="${paragraphStyle}">Please allow a few days for the refund to appear on your statement. The timeline depends on your bank or card issuer.</p>
        <p style="${paragraphStyle}">We are sorry for the inconvenience. If you would like to place a new order, we would be happy to help.</p>`,
    }),
  },
  order_canceled: {
    subject: "Your order #{{display_id}} was cancelled - Daily Drip",
    html: renderLayout({
      preheader: "Your order #{{display_id}} was cancelled.",
      heading: "Order cancelled",
      body: `
        <p style="${paragraphStyle}">Your order <strong>#{{display_id}}</strong> has been cancelled.</p>
        <p style="${paragraphStyle}">If your order was already paid for, a refund will be issued to your original payment method. Please allow a few days for it to appear on your statement.</p>
        <p style="${paragraphStyle}">If you have any questions, reply to this email and our team will get back to you.</p>`,
    }),
  },
}

function interpolate(template: string, data: Record<string, unknown>): string {
  return template.replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (match, key: string) => {
    const value = data[key]
    if (Array.isArray(value)) {
      return itemsRows(value as ItemRow[])
    }
    if (value === undefined || value === null) {
      return ""
    }
    return escapeHtml(String(value))
  })
}

export function renderSubject(template: EmailTemplate, data: Record<string, unknown>): string {
  return interpolate(template.subject, data)
}

export function renderTemplate(template: EmailTemplate, data: Record<string, unknown>): string {
  return interpolate(template.html, data)
}