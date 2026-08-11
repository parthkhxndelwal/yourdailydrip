import type { MedusaContainer } from "@medusajs/framework"
import ithinkTrackingPoll from "../jobs/ithink-tracking"

// Manual trigger for the 30-minute reconciliation poll. `medusa exec` passes
// { container, args } as a single argument, so destructure it. Exercises the
// exact code path the cron schedule runs: provider resolution -> client -> poll.
export default async function triggerIthinkTrackingPoll({
  container,
}: {
  container: MedusaContainer
}) {
  await ithinkTrackingPoll(container)
  console.log("[trigger] ithink-tracking-poll finished")
}
