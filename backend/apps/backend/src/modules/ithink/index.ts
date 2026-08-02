import { ModuleProvider, Modules } from "@medusajs/framework/utils"
import { IthinkFulfillmentService } from "./services/ithink-fulfillment"

export default ModuleProvider(Modules.FULFILLMENT, {
  services: [IthinkFulfillmentService],
})
