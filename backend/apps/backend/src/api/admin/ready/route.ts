import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

// Readiness probe: verifies the database is reachable and fails fast (<=~3s)
// when it is not. This complements the built-in `/health` endpoint, which is a
// liveness probe only and does not touch the database.
//
// Why a bounded probe is required: the shared knex pool is created with
// `propagateCreateError: false`, so when the database goes down, a pool acquire
// stays pending until knex's default acquire timeout (~60s) instead of failing
// fast. `databaseDriverOptions.pool.acquireTimeoutMillis` is not forwarded by
// Medusa's pg-connection-loader, so there is no config-level way to bound the
// acquire. Racing the probe against a timeout keeps this route deterministic.
const READINESS_TIMEOUT_MS = 3000

// Readiness probes must be reachable without an admin JWT (uptime/container
// health checks and the failure-QA scenario). Opt out of the default admin
// authentication applied to /admin/* routes.
export const AUTHENTICATE = false

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const pgConnection = req.scope.resolve(
    ContainerRegistrationKeys.PG_CONNECTION
  )

  const probe = pgConnection
    .raw("SELECT 1")
    .then(() => "ok")
    .catch((error: Error) => `db-error: ${error?.message ?? error}`)

  const result = await Promise.race([
    probe,
    new Promise<string>((resolve) =>
      setTimeout(() => resolve("timeout"), READINESS_TIMEOUT_MS)
    ),
  ])

  if (result === "ok") {
    res.status(200).json({ status: "ok" })
    return
  }

  res.status(503).json({ status: "error", message: result })
}
