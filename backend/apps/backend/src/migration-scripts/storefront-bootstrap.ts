import { MedusaContainer } from "@medusajs/framework"
import {
  ContainerRegistrationKeys,
  MedusaError,
  ModuleRegistrationName,
  Modules,
  ProductStatus,
} from "@medusajs/framework/utils"
import {
  createApiKeysWorkflow,
  createInventoryLevelsWorkflow,
  createProductCategoriesWorkflow,
  createProductsWorkflow,
  createRegionsWorkflow,
  createSalesChannelsWorkflow,
  createShippingOptionsWorkflow,
  createStockLocationsWorkflow,
  createStoresWorkflow,
  linkSalesChannelsToApiKeyWorkflow,
  linkSalesChannelsToStockLocationWorkflow,
} from "@medusajs/medusa/core-flows"

// ---------------------------------------------------------------------------
// One-shot storefront bootstrap (replaces the old exec scripts).
//
// The old split ran as separate `medusa exec` commands:
//   - seed-products.ts       (7 storefront products + categories + India location)
//   - seed-shipping-india.ts (flat Standard 49 / Express 99 INR options)
// This migration script does the whole storefront setup inside a single
// `npx medusa db:migrate` run, tracked in the script_migrations table by its
// script name.
//
// Scope (production storefront):
//   - Starter infra: Default Sales Channel, publishable keys, Default Store.
//   - India region (inr, automatic_taxes, Razorpay) + India Warehouse stock
//     location carrying the FULL dev address. postal_code 110006 is required:
//     the iThink provider reads from_pincode from
//     context.from_location.address.postal_code when calculating rates.
//   - One product only: "Rooted Hair Growth Oil" (user decision — the other 6
//     storefront products are demo products and are NOT seeded).
//   - Shipping: Standard = Delhivery, Express = Blue Dart, BOTH as CALCULATED
//     iThink options (live rates) instead of the old flat 49/99. The
//     admin-only (enabled_in_store=false) iThink carrier options from dev are
//     reproduced so the admin can fulfill with any carrier.
//
// Idempotency contract (every section resolves-or-creates):
//   - Nothing is duplicated on re-run: sales channel / store / region /
//     location / fulfillment set / service zone / provider links / categories /
//     product (by handle) / shipping options (by name + service zone).
//   - Inventory levels are only set for variants created in this run.
//
// Image references: the storefront bundles its product images as local imports
// (src/assets/p-*.jpg). Medusa image URLs must be plain strings, so each image
// is stored as a deterministic static reference to the storefront's dev asset
// server, preserving the exact per-product image order from products.ts
// (thumbnail = first image). The deploy wave replaces these with hosted URLs.
//
// Prices: Medusa stores amounts as-is (INR 649 = 649). Never divide/multiply.
// ---------------------------------------------------------------------------

type Review = {
  name: string
  rating: number
  date: string
  title: string
  body: string
}

const IMAGE_BASE_URL = "http://localhost:5173/src/assets"

const imageUrl = (file: string): string => `${IMAGE_BASE_URL}/${file}`

const DEFAULT_SALES_CHANNEL_NAME = "Default Sales Channel"
const INDIA_REGION_CURRENCY = "inr"
const INDIA_LOCATION_NAME = "India Warehouse"
const INDIA_FULFILLMENT_SET_NAME = "India Warehouse shipping"
const INDIA_SERVICE_ZONE_NAME = "India"

// Full dev address for the India Warehouse. postal_code must be present: the
// iThink provider reads from_pincode from context.from_location.address.
const INDIA_WAREHOUSE_ADDRESS = {
  address_1: "GA73 The Zone Mall Aaman Adarsh Nagar ChandavarkarLane",
  city: "Mumbai",
  country_code: "IN",
  province: "maharashtra",
  postal_code: "400001",
}

// Rooted Hair Growth Oil — transcribed 1:1 from storefront/src/lib/products.ts
// (read-only source of truth; nothing invented or omitted).
const ROOTED_PRODUCT = {
  slug: "rooted-hair-growth-oil",
  name: "Rooted Hair Growth Oil",
  category: "hair-care",
  tagline: "Rosemary + bhringraj blend",
  price: 649,
  mrp: 899,
  size: "100 ml",
  stock: 38,
  imageFiles: ["p-hairoil.jpg", "p-scalp.jpg", "p-hairmask.jpg"],
  shortDescription:
    "A non-greasy pre-wash oil with rosemary and bhringraj that supports thicker, fuller-looking hair.",
  description:
    "Cold-pressed sesame and grapeseed oils carry rosemary, bhringraj and amla extracts to the scalp, where they support circulation and reduce breakage at the root. Unlike traditional heavy oils, Rooted washes out with a single shampoo and leaves no residue.",
  benefits: [
    "Reduces hair fall from breakage in 8 weeks",
    "Nourishes a dry, flaky scalp",
    "Adds softness and shine to lengths",
    "Washes out easily, no heavy residue",
  ],
  ingredients: [
    "Rosemary Essential Oil",
    "Bhringraj & Amla Extract",
    "Cold-Pressed Sesame Oil",
    "Grapeseed & Jojoba Oil",
  ],
  howToUse: [
    "Section dry hair and apply oil along the scalp.",
    "Massage for 5 minutes with fingertips.",
    "Leave for 1–2 hours, then shampoo. Use twice a week.",
  ],
  suitableFor: "All hair types, especially thinning or dry hair",
  rating: 4.7,
  reviews: [
    {
      name: "Ananya R.",
      rating: 5,
      date: "12 June 2026",
      title: "Worth every rupee",
      body: "Three months in and my hairline has visible baby hair. The smell is herbal, not overpowering.",
    },
    {
      name: "Meera K.",
      rating: 4,
      date: "28 May 2026",
      title: "Gentle and effective",
      body: "Rinses out with one wash, which no other oil has managed for me.",
    },
    {
      name: "Rahul S.",
      rating: 5,
      date: "9 May 2026",
      title: "Repurchasing already",
      body: "Light texture, clean scent and my routine finally feels consistent. Delivery was quick too.",
    },
  ],
}

// Calculated iThink shipping options. Standard/Express are storefront-facing;
// the carrier options are admin-only (enabled_in_store=false) reproductions of
// the dev iThink options for manual fulfillment with a chosen carrier.
const SHIPPING_OPTIONS: Array<{
  name: string
  label: string
  description: string
  code: string
  enabledInStore: boolean
  carrierId: string
  carrierName: string
}> = [
  {
    name: "Standard Shipping",
    label: "Standard",
    description: "Ship in 2-3 days.",
    code: "standard",
    enabledInStore: true,
    carrierId: "delhivery",
    carrierName: "Delhivery",
  },
  {
    name: "Express Shipping",
    label: "Express",
    description: "Ship in 24 hours.",
    code: "express",
    enabledInStore: true,
    carrierId: "bluedart",
    carrierName: "Blue Dart",
  },
  {
    name: "iThink (Delhivery)",
    label: "Standard",
    description: "Ship in 2-3 days.",
    code: "standard",
    enabledInStore: false,
    carrierId: "delhivery",
    carrierName: "Delhivery",
  },
  {
    name: "iThink (Xpressbees)",
    label: "Standard",
    description: "Ship in 2-3 days.",
    code: "standard",
    enabledInStore: false,
    carrierId: "xpressbees",
    carrierName: "Xpressbees",
  },
  {
    name: "iThink (Blue Dart)",
    label: "Standard",
    description: "Ship in 2-3 days.",
    code: "standard",
    enabledInStore: false,
    carrierId: "bluedart",
    carrierName: "Blue Dart",
  },
  {
    name: "iThink (Ecom Express)",
    label: "Standard",
    description: "Ship in 2-3 days.",
    code: "standard",
    enabledInStore: false,
    carrierId: "ecom",
    carrierName: "Ecom Express",
  },
]

export default async function storefront_bootstrap({
  container,
}: {
  container: MedusaContainer
}) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const link = container.resolve(ContainerRegistrationKeys.LINK)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const fulfillmentModuleService = container.resolve(
    ModuleRegistrationName.FULFILLMENT
  )
  const productModuleService = container.resolve(ModuleRegistrationName.PRODUCT)
  const salesChannelModuleService = container.resolve(
    ModuleRegistrationName.SALES_CHANNEL
  )
  const stockLocationModuleService = container.resolve(
    ModuleRegistrationName.STOCK_LOCATION
  )
  const storeModuleService = container.resolve(ModuleRegistrationName.STORE)
  const apiKeyModuleService = container.resolve(ModuleRegistrationName.API_KEY)

  // -------------------------------------------------------------------------
  // 1. Sales channel (resolve-or-create).
  // -------------------------------------------------------------------------
  const salesChannels = await salesChannelModuleService.listSalesChannels(
    {},
    { take: 10 }
  )
  let defaultSalesChannel =
    salesChannels.find((sc) => sc.name === DEFAULT_SALES_CHANNEL_NAME) ??
    salesChannels[0]
  if (!defaultSalesChannel) {
    const { result: createdChannels } = await createSalesChannelsWorkflow(
      container
    ).run({
      input: {
        salesChannelsData: [
          {
            name: DEFAULT_SALES_CHANNEL_NAME,
            description: "Created by Medusa",
          },
        ],
      },
    })
    defaultSalesChannel = createdChannels[0]
    logger.info(`Sales channel created: ${defaultSalesChannel.name}`)
  } else {
    logger.info(`Sales channel exists: ${defaultSalesChannel.name}`)
  }

  // -------------------------------------------------------------------------
  // 2. Publishable API keys (resolve-or-create) + link to the channel.
  //    CreateApiKeyDTO has no `token` field — the production key gets a freshly
  //    generated token, so the storefront .env must be updated at deploy.
  // -------------------------------------------------------------------------
  for (const keyTitle of [
    "Default Publishable API Key",
    "Storefront Publishable Key",
  ]) {
    const existingKeys = await apiKeyModuleService.listApiKeys(
      { title: keyTitle },
      { select: ["id", "title"] }
    )
    if (existingKeys.length > 0) {
      logger.info(`API key exists: ${keyTitle}`)
      continue
    }
    const { result: createdKeys } = await createApiKeysWorkflow(container).run({
      input: {
        api_keys: [
          {
            title: keyTitle,
            type: "publishable",
            created_by: "",
          },
        ],
      },
    })
    await linkSalesChannelsToApiKeyWorkflow(container).run({
      input: {
        id: createdKeys[0].id,
        add: [defaultSalesChannel.id],
      },
    })
    logger.info(`API key created and linked: ${keyTitle}`)
  }

  // -------------------------------------------------------------------------
  // 3. Default Store (resolve-or-create). Dev currencies: eur (default), usd,
  //    inr — inr added so Indian checkout prices display correctly.
  // -------------------------------------------------------------------------
  const stores = await storeModuleService.listStores({}, { take: 10 })
  let store = stores.find((s) => s.name === "Default Store") ?? stores[0]
  if (!store) {
    const { result: createdStores } = await createStoresWorkflow(container).run({
      input: {
        stores: [
          {
            name: "Default Store",
            supported_currencies: [
              { currency_code: "eur", is_default: true },
              { currency_code: "usd", is_default: false },
              { currency_code: "inr", is_default: false },
            ],
            default_sales_channel_id: defaultSalesChannel.id,
          },
        ],
      },
    })
    store = createdStores[0]
    logger.info(`Store created: ${store.name}`)
  } else {
    logger.info(`Store exists: ${store.name}`)
  }

  // -------------------------------------------------------------------------
  // 4. India region (resolve-or-create). automatic_taxes matches dev.
  // -------------------------------------------------------------------------
  const { data: existingRegions } = await query.graph({
    entity: "region",
    fields: ["id", "name", "currency_code"],
    filters: { currency_code: INDIA_REGION_CURRENCY },
  })
  let indiaRegion:
    | { id: string; name: string; currency_code: string }
    | undefined = existingRegions[0]
  if (!indiaRegion) {
    const { result: createdRegions } = await createRegionsWorkflow(
      container
    ).run({
      input: {
        regions: [
          {
            name: "India",
            currency_code: INDIA_REGION_CURRENCY,
            countries: ["in"],
            payment_providers: ["pp_razorpay_razorpay"],
            automatic_taxes: true,
          },
        ],
      },
    })
    indiaRegion = createdRegions[0]
    logger.info(`Region created: ${indiaRegion.name}`)
  } else {
    logger.info(`Region exists: ${indiaRegion.name}`)
  }

  // -------------------------------------------------------------------------
  // 5. India Warehouse stock location (resolve-or-create) with the FULL dev
  //    address, then link it to the sales channel.
  // -------------------------------------------------------------------------
  const existingLocations = await stockLocationModuleService.listStockLocations(
    {},
    { take: 20 }
  )
  let indiaLocation = existingLocations.find(
    (l) => l.name === INDIA_LOCATION_NAME
  )
  if (!indiaLocation) {
    const { result: createdLocations } = await createStockLocationsWorkflow(
      container
    ).run({
      input: {
        locations: [
          {
            name: INDIA_LOCATION_NAME,
            address: INDIA_WAREHOUSE_ADDRESS,
          },
        ],
      },
    })
    indiaLocation = createdLocations[0]
    logger.info(`Stock location created: ${INDIA_LOCATION_NAME}`)
  } else {
    logger.info(`Stock location exists: ${INDIA_LOCATION_NAME}`)
  }

  await linkSalesChannelsToStockLocationWorkflow(container).run({
    input: {
      id: indiaLocation.id,
      add: [defaultSalesChannel.id],
    },
  })

  // -------------------------------------------------------------------------
  // 6. Fulfillment set "India Warehouse shipping" + service zone "India"
  //    (resolve-or-create), linked to the India Warehouse.
  // -------------------------------------------------------------------------
  const { data: serviceZones } = await query.graph({
    entity: "service_zone",
    fields: ["id", "name", "fulfillment_set.id"],
    filters: { name: INDIA_SERVICE_ZONE_NAME },
  })
  let serviceZoneId: string
  let fulfillmentSetId: string
  if (serviceZones.length > 0) {
    serviceZoneId = serviceZones[0].id
    fulfillmentSetId = serviceZones[0].fulfillment_set.id
    logger.info(`Service zone exists: ${INDIA_SERVICE_ZONE_NAME}`)
  } else {
    const fulfillmentSet = await fulfillmentModuleService.createFulfillmentSets(
      {
        name: INDIA_FULFILLMENT_SET_NAME,
        type: "shipping",
        service_zones: [
          {
            name: INDIA_SERVICE_ZONE_NAME,
            geo_zones: [{ country_code: "in", type: "country" }],
          },
        ],
      }
    )
    fulfillmentSetId = fulfillmentSet.id
    serviceZoneId = fulfillmentSet.service_zones[0].id
    logger.info(`Fulfillment set created: ${fulfillmentSet.name}`)
  }

  const { data: locationLinks } = await query.graph({
    entity: "stock_location",
    fields: ["fulfillment_sets.id"],
    filters: { id: indiaLocation.id },
  })
  const linkedSetIds = new Set(
    (locationLinks[0]?.fulfillment_sets ?? [])
      .filter((s): s is NonNullable<typeof s> => !!s)
      .map((s) => s.id)
  )
  if (!linkedSetIds.has(fulfillmentSetId)) {
    await link.create({
      [Modules.STOCK_LOCATION]: { stock_location_id: indiaLocation.id },
      [Modules.FULFILLMENT]: { fulfillment_set_id: fulfillmentSetId },
    })
    logger.info(`Fulfillment set linked to ${INDIA_LOCATION_NAME}`)
  }

  // -------------------------------------------------------------------------
  // 7. Provider links to the India Warehouse: manual_manual (built-in) and
  //    ithink_ithink (calculated options require it) — both exist in dev.
  // -------------------------------------------------------------------------
  const { data: providerLinks } = await query.graph({
    entity: "stock_location",
    fields: ["fulfillment_providers.id"],
    filters: { id: indiaLocation.id },
  })
  const linkedProviderIds = new Set(
    (providerLinks[0]?.fulfillment_providers ?? [])
      .filter((p): p is NonNullable<typeof p> => !!p)
      .map((p) => p.id)
  )
  for (const providerId of ["manual_manual", "ithink_ithink"]) {
    if (linkedProviderIds.has(providerId)) {
      logger.info(`Provider already linked: ${providerId}`)
      continue
    }
    await link.create({
      [Modules.STOCK_LOCATION]: { stock_location_id: indiaLocation.id },
      [Modules.FULFILLMENT]: { fulfillment_provider_id: providerId },
    })
    logger.info(`Provider linked: ${providerId}`)
  }

  // -------------------------------------------------------------------------
  // 8. Default shipping profile.
  // -------------------------------------------------------------------------
  const { data: shippingProfiles } = await query.graph({
    entity: "shipping_profile",
    fields: ["id", "name"],
  })
  const shippingProfile =
    shippingProfiles.find((p) => p.name === "Default Profile") ??
    shippingProfiles[0]
  if (!shippingProfile) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      "No shipping profile found."
    )
  }
  logger.info(`Shipping profile: ${shippingProfile.name}`)

  // -------------------------------------------------------------------------
  // 9. Calculated iThink shipping options (skip any that already exist).
  //    Standard/Express are enabled in store; the iThink carrier options are
  //    admin-only reproductions from dev. `type` is required by
  //    CreateShippingOptionDTO — a full type object creates a new type row, so
  //    the Standard Shipping option creates the "standard" type and the rest
  //    reuse it by id (in dev all iThink options share one Standard type).
  // -------------------------------------------------------------------------
  const { data: existingOptions } = await query.graph({
    entity: "shipping_option",
    fields: ["id", "name"],
    filters: { service_zone_id: serviceZoneId },
  })
  const existingOptionNames = new Set(existingOptions.map((o) => o.name))

  const { data: existingTypes } = await query.graph({
    entity: "shipping_option_type",
    fields: ["id", "code"],
    filters: { code: ["standard", "express"] },
  })
  const typeIdByCode = new Map(existingTypes.map((t) => [t.code, t.id]))

  for (const option of SHIPPING_OPTIONS) {
    if (existingOptionNames.has(option.name)) {
      logger.info(`Shipping option exists: ${option.name}`)
      continue
    }

    const existingTypeId = typeIdByCode.get(option.code)
    const { result: createdOptions } = await createShippingOptionsWorkflow(
      container
    ).run({
      input: [
        {
          name: option.name,
          price_type: "calculated",
          provider_id: "ithink_ithink",
          service_zone_id: serviceZoneId,
          shipping_profile_id: shippingProfile.id,
          ...(existingTypeId
            ? { type_id: existingTypeId }
            : {
                type: {
                  label: option.label,
                  description: option.description,
                  code: option.code,
                },
              }),
          data: {
            id: option.carrierId,
            name: option.carrierName,
            logistic_name: option.carrierId,
          },
          rules: [
            {
              attribute: "enabled_in_store",
              value: String(option.enabledInStore),
              operator: "eq",
            },
            {
              attribute: "is_return",
              value: "false",
              operator: "eq",
            },
          ],
        },
      ],
    })
    const createdOption = createdOptions[0]
    if (!existingTypeId && createdOption.shipping_option_type_id) {
      typeIdByCode.set(option.code, createdOption.shipping_option_type_id)
    }
    logger.info(
      `Shipping option created: ${option.name} (${createdOption.id}), calculated via ${option.carrierName}`
    )
  }

  // -------------------------------------------------------------------------
  // 10. Categories skin-care + hair-care (resolve-or-create).
  // -------------------------------------------------------------------------
  const CATEGORIES: Array<{ handle: string; name: string }> = [
    { handle: "skin-care", name: "Skin Care" },
    { handle: "hair-care", name: "Hair Care" },
  ]
  const existingCategories = await productModuleService.listProductCategories(
    { handle: CATEGORIES.map((c) => c.handle) },
    { select: ["id", "handle"] }
  )
  const categoryIdByHandle = new Map(
    existingCategories.map((c) => [c.handle, c.id])
  )
  const categoriesToCreate = CATEGORIES.filter(
    (c) => !categoryIdByHandle.has(c.handle)
  )
  if (categoriesToCreate.length) {
    const { result: createdCategories } =
      await createProductCategoriesWorkflow(container).run({
        input: {
          product_categories: categoriesToCreate.map((c) => ({
            name: c.name,
            handle: c.handle,
            is_active: true,
          })),
        },
      })
    createdCategories.forEach((c) => categoryIdByHandle.set(c.handle, c.id))
    logger.info(
      `Categories created: ${createdCategories.map((c) => c.handle).join(", ")}`
    )
  }

  // -------------------------------------------------------------------------
  // 11. Rooted Hair Growth Oil (resolve-or-create by handle).
  // -------------------------------------------------------------------------
  const existingProducts = await productModuleService.listProducts(
    { handle: ROOTED_PRODUCT.slug },
    { select: ["id", "handle"] }
  )
  let createdProductIds: string[] = []
  if (existingProducts.length > 0) {
    logger.info(`Product exists: ${ROOTED_PRODUCT.slug}`)
  } else {
    const { result } = await createProductsWorkflow(container).run({
      input: {
        products: [
          {
            title: ROOTED_PRODUCT.name,
            subtitle: ROOTED_PRODUCT.shortDescription,
            description: ROOTED_PRODUCT.description,
            handle: ROOTED_PRODUCT.slug,
            status: ProductStatus.PUBLISHED,
            thumbnail: imageUrl(ROOTED_PRODUCT.imageFiles[0]),
            images: ROOTED_PRODUCT.imageFiles.map((file) => ({
              url: imageUrl(file),
            })),
            category_ids: [
              categoryIdByHandle.get(ROOTED_PRODUCT.category) as string,
            ],
            options: [
              {
                title: "Size",
                values: [ROOTED_PRODUCT.size],
                is_exclusive: true,
              },
            ],
            variants: [
              {
                title: ROOTED_PRODUCT.size,
                sku: ROOTED_PRODUCT.slug,
                manage_inventory: true,
                options: {
                  Size: ROOTED_PRODUCT.size,
                },
                prices: [
                  {
                    amount: ROOTED_PRODUCT.price,
                    currency_code: INDIA_REGION_CURRENCY,
                  },
                ],
              },
            ],
            metadata: {
              tagline: ROOTED_PRODUCT.tagline,
              size: ROOTED_PRODUCT.size,
              benefits: ROOTED_PRODUCT.benefits,
              ingredients: ROOTED_PRODUCT.ingredients,
              howToUse: ROOTED_PRODUCT.howToUse,
              suitableFor: ROOTED_PRODUCT.suitableFor,
              rating: ROOTED_PRODUCT.rating,
              reviews: ROOTED_PRODUCT.reviews,
              mrp: ROOTED_PRODUCT.mrp,
            },
            sales_channels: [{ id: defaultSalesChannel.id }],
            shipping_profile_id: shippingProfile.id,
          },
        ],
      },
    })
    createdProductIds = result.map((p) => p.id)
    logger.info(`Product created: ${ROOTED_PRODUCT.slug}`)
  }

  // -------------------------------------------------------------------------
  // 12. Inventory level (38) for the variant created in this run only.
  // -------------------------------------------------------------------------
  if (createdProductIds.length) {
    const variants = await productModuleService.listProductVariants(
      { product_id: createdProductIds },
      { select: ["id", "sku"] }
    )
    const { data: variantItemLinks } = await query.graph({
      entity: "product_variant_inventory_item",
      fields: ["variant_id", "inventory_item_id"],
      filters: { variant_id: variants.map((v) => v.id) },
    })
    const inventoryItemIdByVariant = new Map(
      variantItemLinks.map((link) => [link.variant_id, link.inventory_item_id])
    )
    const inventoryLevels: Array<{
      location_id: string
      stocked_quantity: number
      inventory_item_id: string
    }> = []
    for (const variant of variants) {
      const inventoryItemId = inventoryItemIdByVariant.get(variant.id)
      if (inventoryItemId) {
        inventoryLevels.push({
          location_id: indiaLocation.id,
          stocked_quantity: ROOTED_PRODUCT.stock,
          inventory_item_id: inventoryItemId,
        })
      }
    }
    if (inventoryLevels.length) {
      await createInventoryLevelsWorkflow(container).run({
        input: { inventory_levels: inventoryLevels },
      })
      logger.info(
        `Inventory level set for ${ROOTED_PRODUCT.slug}: ${ROOTED_PRODUCT.stock}`
      )
    }
  }

  logger.info("Storefront bootstrap complete.")
}

