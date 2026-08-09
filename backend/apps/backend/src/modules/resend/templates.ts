// In-code email templates for preorder notifications. Keys are constants
// used by the preorder subscribers - do not rename them without updating
// the subscribers that reference them.
//
// Placeholders use `{{key}}` syntax and are interpolated from the
// notification `data` object by `renderTemplate` / `renderSubject`; array
// values (e.g. `items`) render as one `<li>` per entry so templates can
// wrap them in a `<ul>`.

export type PreorderTemplateName = "preorder_ack" | "preorder_shipped" | "preorder_refund"

export type EmailTemplate = {
  subject: string
  html: string
}

export const TEMPLATES: Record<PreorderTemplateName, EmailTemplate> = {
  preorder_ack: {
    subject: "Order #{{display_id}} confirmed - Daily Drip",
    html: `
      <h1>Thank you for your preorder</h1>
      <p>Your order <strong>#{{display_id}}</strong> has been confirmed.</p>
      <p>Order ID: {{order_id}}</p>
      <p>We expect your items to ship by <strong>{{expected_ship_date}}</strong>. You will receive a tracking link as soon as your order ships.</p>
      <h2>Your items</h2>
      <ul>{{items}}</ul>
      <p>Questions? Reply to this email and we are happy to help.</p>
    `,
  },
  preorder_shipped: {
    subject: "Your preorder has shipped - Daily Drip",
    html: `
      <h1>Your preorder has shipped</h1>
      <p>Your order <strong>#{{display_id}}</strong> is on its way.</p>
      <p>Order ID: {{order_id}}</p>
      <p>AWB number: <strong>{{awb}}</strong></p>
      <p><a href="{{track_url}}">Track your shipment</a></p>
      <p>Thanks for shopping with Daily Drip.</p>
    `,
  },
  preorder_refund: {
    subject: "Your preorder has been refunded - Daily Drip",
    html: `
      <h1>Your preorder was refunded</h1>
      <p>Your order <strong>#{{display_id}}</strong> has been cancelled and a refund was issued to your original payment method.</p>
      <p>Order ID: {{order_id}}</p>
      <p>Please allow a few days for the refund to appear on your statement.</p>
    `,
  },
}

function interpolate(template: string, data: Record<string, unknown>): string {
  return template.replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (match, key: string) => {
    const value = data[key]
    if (Array.isArray(value)) {
      return value
        .map((entry) => {
          const item = entry as Record<string, unknown>
          return `<li>${item.title ?? "Item"} x ${item.quantity ?? 1}</li>`
        })
        .join("")
    }
    if (value === undefined || value === null) {
      return ""
    }
    return String(value)
  })
}

export function renderSubject(template: EmailTemplate, data: Record<string, unknown>): string {
  return interpolate(template.subject, data)
}

export function renderTemplate(template: EmailTemplate, data: Record<string, unknown>): string {
  return interpolate(template.html, data)
}