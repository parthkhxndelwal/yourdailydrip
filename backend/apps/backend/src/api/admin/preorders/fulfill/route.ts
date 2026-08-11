import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { fulfillDuePreordersWorkflow } from "../../../../workflows/fulfill-due-preorders"

// Thin trigger for the shared fulfill-due-preorders workflow. Admin auth is
// enforced globally on /admin. The workflow catches per-order failures, so a
// 200 response carries the full { fulfilled, skipped, failed } summary; only
// an unexpected workflow-level crash lands here as a readable 500.
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  try {
    const { result } = await fulfillDuePreordersWorkflow(req.scope).run({})

    return res.status(200).json({
      fulfilled: result.fulfilled,
      skipped: result.skipped,
      failed: result.failed,
    })
  } catch (error) {
    return res.status(500).json({
      message: `Pre-order fulfillment failed: ${error instanceof Error ? error.message : String(error)}`,
    })
  }
}