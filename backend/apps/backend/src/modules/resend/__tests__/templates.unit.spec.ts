import {
  BRAND,
  escapeHtml,
  formatInr,
  itemsRows,
  renderLayout,
} from "../layout"
import {
  TEMPLATES,
  renderSubject,
  renderTemplate,
} from "../templates"

describe("resend email templates", () => {
  describe("renderSubject", () => {
    it("interpolates display_id into the order_ack subject", () => {
      expect(renderSubject(TEMPLATES.order_ack, { display_id: 1001 })).toBe(
        "Order #1001 confirmed - Daily Drip"
      )
    })

    it("interpolates display_id into the preorder_ack subject", () => {
      expect(renderSubject(TEMPLATES.preorder_ack, { display_id: 1002 })).toBe(
        "Preorder #1002 confirmed - Daily Drip"
      )
    })

    it("interpolates display_id into the order_shipped subject", () => {
      expect(renderSubject(TEMPLATES.order_shipped, { display_id: 1003 })).toBe(
        "Your order #1003 has shipped - Daily Drip"
      )
    })

    it("interpolates display_id into the preorder_refund subject", () => {
      expect(renderSubject(TEMPLATES.preorder_refund, { display_id: 1004 })).toBe(
        "Your preorder #1004 was refunded - Daily Drip"
      )
    })

    it("interpolates display_id into the order_canceled subject", () => {
      expect(renderSubject(TEMPLATES.order_canceled, { display_id: 1005 })).toBe(
        "Your order #1005 was cancelled - Daily Drip"
      )
    })
  })

  describe("renderTemplate", () => {
    it("escapes HTML in string values", () => {
      const html = renderTemplate(TEMPLATES.order_ack, {
        display_id: 1001,
        items: [
          { title: "<script>alert('x')</script> & more", quantity: 1 },
        ],
        total: "₹749",
        order_url: "https://yourdailydrip.com/order-confirmation?order=demo",
      })

      expect(html).not.toContain("<script>")
      expect(html).toContain("&lt;script&gt;")
      expect(html).toContain("&amp;")
      expect(html).toContain("&lt;script&gt;alert(&#39;x&#39;)&lt;/script&gt; &amp; more")
    })

    it("renders undefined keys as an empty string", () => {
      const html = renderTemplate(TEMPLATES.order_shipped, {
        display_id: 1001,
        awb: undefined,
        track_url: undefined,
      })

      expect(html).not.toContain("{{awb}}")
      expect(html).not.toContain("{{track_url}}")
    })

    it("renders every template without throwing with representative data", () => {
      const data = {
        display_id: 1001,
        expected_ship_date: "2026-09-01",
        items: [
          { title: "Rooted Hair Growth Oil", quantity: 1, unit_price: "₹749" },
          { title: "Daily Drip Serum", quantity: 2, unit_price: "₹499" },
        ],
        total: "₹1,747",
        awb: "IT00000001",
        order_url: "https://yourdailydrip.com/order-confirmation?order=demo",
        track_url: "https://yourdailydrip.com/track-order?awb=IT00000001",
      }

      for (const template of Object.values(TEMPLATES)) {
        expect(() => renderTemplate(template, data)).not.toThrow()
        expect(() => renderSubject(template, data)).not.toThrow()
      }
    })
  })

  describe("itemsRows", () => {
    it("renders a row with thumbnail, title, qty, and unit price", () => {
      const rows = itemsRows([
        {
          title: "Rooted Hair Growth Oil",
          quantity: 2,
          thumbnail: "https://cdn.yourdailydrip.com/rooted.jpg",
          unit_price: "₹749",
        },
      ])

      expect(rows).toContain("<tr>")
      expect(rows).toContain('<img src="https://cdn.yourdailydrip.com/rooted.jpg"')
      expect(rows).toContain('alt="Rooted Hair Growth Oil"')
      expect(rows).toContain('width="48"')
      expect(rows).toContain('height="48"')
      expect(rows).toContain("Rooted Hair Growth Oil")
      expect(rows).toContain("Qty 2")
      expect(rows).toContain("₹749")
    })

    it("omits the thumbnail and price when not provided", () => {
      const rows = itemsRows([{ title: "Daily Drip Serum", quantity: 1 }])

      expect(rows).not.toContain("<img")
      expect(rows).toContain("Daily Drip Serum")
      expect(rows).toContain("Qty 1")
    })

    it("escapes the title inside the row", () => {
      const rows = itemsRows([{ title: "A & B <C>", quantity: 1 }])

      expect(rows).toContain("A &amp; B &lt;C&gt;")
      expect(rows).not.toContain("A & B <C>")
    })
  })

  describe("formatInr", () => {
    it("formats integer prices without decimals", () => {
      expect(formatInr(749)).toBe("₹749")
    })

    it("formats fractional prices with up to two decimals", () => {
      expect(formatInr(153.4)).toBe("₹153.4")
    })
  })

  describe("escapeHtml", () => {
    it("escapes all five special characters", () => {
      expect(escapeHtml(`& < > " '`)).toBe("&amp; &lt; &gt; &quot; &#39;")
    })
  })

  describe("renderLayout", () => {
    it("includes the preheader, CTA href, and footer", () => {
      const html = renderLayout({
        preheader: "Your order #1001 has been confirmed.",
        heading: "Order confirmed",
        body: "<p>Thank you for your order.</p>",
        cta: { label: "View your order", url: "https://yourdailydrip.com/order-confirmation?order=demo" },
      })

      expect(html).toContain("Your order #1001 has been confirmed.")
      expect(html).toContain('href="https://yourdailydrip.com/order-confirmation?order=demo"')
      expect(html).toContain("View your order")
      expect(html).toContain("Daily Drip · yourdailydrip.com")
      expect(html).toContain("Questions? Reply to this email")
    })

    it("omits the CTA when not provided", () => {
      const html = renderLayout({
        preheader: "Your order was refunded.",
        heading: "Refund issued",
        body: "<p>Your refund is on its way.</p>",
      })

      expect(html).not.toContain("href=")
      expect(html).toContain("Refund issued")
    })

    it("uses the brand palette", () => {
      const html = renderLayout({
        preheader: "Preheader",
        heading: "Heading",
        body: "<p>Body</p>",
        cta: { label: "View your order", url: "https://yourdailydrip.com/order-confirmation?order=demo" },
      })

      expect(html).toContain(BRAND.cream)
      expect(html).toContain(BRAND.forest)
      expect(html).toContain(BRAND.amber)
      expect(html).toContain(BRAND.green)
    })
  })
})