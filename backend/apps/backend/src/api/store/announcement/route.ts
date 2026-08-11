import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import type { IStoreModuleService } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"

type AnnouncementBarConfig = {
  text: string
  ends_at: string | null
  show_countdown: boolean
  link: { label: string; url: string } | null
}

// The admin dashboard writes the top-bar config into the store entity's
// metadata under `announcement_bar`. The storefront renders `text` plus a
// countdown to `ends_at` and an optional link. Legacy configs only carry
// `{ text, ends_at }` - missing booleans fall back to their defaults
// (show_countdown true, show_link false). Defensive shape validation
// only - this is a read.
function parseAnnouncementBar(
  metadata: Record<string, unknown> | null | undefined
): AnnouncementBarConfig | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null
  }
  const raw = metadata.announcement_bar
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return null
  }
  const bar = raw as Record<string, unknown>
  const text = bar.text
  if (typeof text !== "string" || text.trim().length === 0) {
    return null
  }
  const endsAt = bar.ends_at
  if (endsAt !== null && endsAt !== "") {
    if (typeof endsAt !== "string" || Number.isNaN(new Date(endsAt).getTime())) {
      return null
    }
  }
  const showCountdown = bar.show_countdown
  const linkLabel = bar.link_label
  const linkUrl = bar.link_url
  const showLink = bar.show_link === true
  const link =
    showLink &&
    typeof linkLabel === "string" &&
    linkLabel.trim().length > 0 &&
    typeof linkUrl === "string" &&
    linkUrl.trim().length > 0
      ? { label: linkLabel, url: linkUrl }
      : null
  return {
    text,
    ends_at: endsAt ? endsAt : null,
    show_countdown: typeof showCountdown === "boolean" ? showCountdown : true,
    link,
  }
}

// Public store route: announcement-bar config from the store entity's
// metadata. No auth, no workflow - it is a read of config, and any store
// module failure answers 502 so the storefront renders no bar.
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  let stores: Array<{ metadata?: Record<string, unknown> | null }>
  try {
    const storeModuleService = req.scope.resolve(Modules.STORE) as IStoreModuleService
    stores = await storeModuleService.listStores({}, {
      take: 1,
      select: ["id", "metadata"],
    })
  } catch {
    res.status(502).json({ error: "announcement_unavailable" })
    return
  }

  const config = parseAnnouncementBar(stores[0]?.metadata)
  res.status(200).json({
    text: config ? config.text : null,
    ends_at: config ? config.ends_at : null,
    show_countdown: config ? config.show_countdown : true,
    link: config ? config.link : null,
  })
}
