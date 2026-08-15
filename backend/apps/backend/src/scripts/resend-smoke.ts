import fs from "node:fs"
import path from "node:path"
import type { MedusaContainer } from "@medusajs/framework"
import { Modules } from "@medusajs/framework/utils"
import { formatInr } from "../modules/resend/layout"

// Sends one real order_ack email through the Resend provider to prove the
// notification module + templates + DNS setup end-to-end. Run with:
//   RESEND_SMOKE_TO=you@example.com npx medusa exec resend-smoke
// The recipient can also be set as RESEND_SMOKE_TO in the env file (a second
// line alongside the other RESEND_* vars) - it is read from there when the
// process env does not carry it.

function readSmokeRecipient(): string | undefined {
  const fromEnv = process.env.RESEND_SMOKE_TO
  if (fromEnv) {
    return fromEnv
  }

  // Fall back to the env file (apps/backend/.env in dev, backend/.env in
  // prod) in case RESEND_SMOKE_TO was added there instead of the shell.
  const candidates = [
    path.resolve(process.cwd(), ".env"),
    path.resolve(process.cwd(), "..", ".env"),
  ]
  for (const envPath of candidates) {
    try {
      const content = fs.readFileSync(envPath, "utf8")
      const match = content.match(/^RESEND_SMOKE_TO=(.*)$/m)
      if (match && match[1]) {
        return match[1].trim()
      }
    } catch {
      // env file missing - try the next candidate
    }
  }
  return undefined
}

export default async function resendSmoke({
  container,
}: {
  container: MedusaContainer
}): Promise<void> {
  const recipient = readSmokeRecipient()

  if (!recipient) {
    console.error(
      "RESEND_SMOKE_TO is not set. Set it in the shell or add a line like\n" +
        "  RESEND_SMOKE_TO=you@example.com\n" +
        "to the env file, then run:\n" +
        "  npx medusa exec resend-smoke"
    )
    return
  }

  const storefrontBaseUrl = process.env.STOREFRONT_BASE_URL ?? "http://localhost:5173"

  try {
    const notificationModule = container.resolve(Modules.NOTIFICATION)

    const notification = await notificationModule.createNotifications({
      to: recipient,
      channel: "email",
      template: "order_ack",
      data: {
        display_id: 1001,
        items: [
          {
            title: "Rooted Hair Growth Oil",
            quantity: 1,
            thumbnail: "https://cdn.yourdailydrip.com/rooted.jpg",
            unit_price: formatInr(749),
          },
          {
            title: "Daily Drip Vitamin C Serum",
            quantity: 2,
            thumbnail: "https://cdn.yourdailydrip.com/serum.jpg",
            unit_price: formatInr(499),
          },
        ],
        total: formatInr(1747),
        order_url: `${storefrontBaseUrl}/order-confirmation?order=demo`,
      },
      trigger_type: "resend-smoke",
      resource_id: "demo",
    })

    console.log(
      `SMOKE PASS: order_ack email sent to ${recipient} (notification id ${notification.id}).\n` +
        "Remember: RESEND_FROM_EMAIL must be a verified sender (e.g. hello@yourdailydrip.com)."
    )
  } catch (error) {
    console.error("SMOKE FAIL: could not send the test email", error)
    throw error
  }
}