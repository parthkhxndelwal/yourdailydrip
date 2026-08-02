import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { PencilSquare, Plus, Trash } from "@medusajs/icons"
import { HttpTypes } from "@medusajs/types"
import {
  Button,
  Container,
  Drawer,
  Heading,
  Input,
  Label,
  Select,
  Text,
  Textarea,
  toast,
} from "@medusajs/ui"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"

import { sdk } from "../lib/client"

type Review = {
  name: string
  rating: number
  date: string
  title: string
  body: string
}

type ReviewDraft = Review

type MarketingFields = {
  benefits: string[]
  ingredients: string[]
  howToUse: string[]
  reviews: Review[]
}

const EMPTY_REVIEW: ReviewDraft = {
  name: "",
  rating: 5,
  date: "",
  title: "",
  body: "",
}

function toList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter((item) => item.length > 0)
  }
  if (typeof value === "string") {
    return value
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
  }
  return []
}

function toText(value: unknown): string {
  return toList(value).join("\n")
}

function toReviews(value: unknown): Review[] {
  if (!Array.isArray(value)) return []
  const reviews: Review[] = []
  for (const item of value) {
    if (typeof item !== "object" || item === null) continue
    const record = item as Record<string, unknown>
    reviews.push({
      name: typeof record.name === "string" ? record.name : "",
      rating: typeof record.rating === "number" ? record.rating : 5,
      date: typeof record.date === "string" ? record.date : "",
      title: typeof record.title === "string" ? record.title : "",
      body: typeof record.body === "string" ? record.body : "",
    })
  }
  return reviews
}

const ProductMarketingFieldsWidget = ({
  data: product,
}: {
  data: HttpTypes.AdminProduct
}) => {
  const queryClient = useQueryClient()
  const metadata = product.metadata ?? {}

  const [open, setOpen] = useState(false)
  const [benefits, setBenefits] = useState(() => toText(metadata.benefits))
  const [ingredients, setIngredients] = useState(() => toText(metadata.ingredients))
  const [howToUse, setHowToUse] = useState(() => toText(metadata.howToUse))
  const [reviews, setReviews] = useState<ReviewDraft[]>(() =>
    toReviews(metadata.reviews)
  )

  const openDrawer = () => {
    setBenefits(toText(metadata.benefits))
    setIngredients(toText(metadata.ingredients))
    setHowToUse(toText(metadata.howToUse))
    setReviews(toReviews(metadata.reviews))
    setOpen(true)
  }

  const updateMarketingFields = useMutation({
    mutationFn: async (fields: MarketingFields) => {
      return sdk.admin.product.update(product.id, {
        metadata: {
          ...metadata,
          benefits: fields.benefits,
          ingredients: fields.ingredients,
          howToUse: fields.howToUse,
          reviews: fields.reviews,
        },
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products", "detail", product.id] })
      queryClient.invalidateQueries({ queryKey: ["products", "list"] })
      toast.success("Storefront marketing fields updated")
      setOpen(false)
    },
    onError: (error) => {
      toast.error(error.message || "Failed to update marketing fields")
    },
  })

  const handleSubmit = () => {
    const fields: MarketingFields = {
      benefits: toList(benefits),
      ingredients: toList(ingredients),
      howToUse: toList(howToUse),
      reviews: reviews
        .filter((review) => review.name || review.title || review.body)
        .map((review) => ({ ...review })),
    }
    updateMarketingFields.mutate(fields)
  }

  const updateReview = (index: number, patch: Partial<ReviewDraft>) => {
    setReviews((current) =>
      current.map((review, i) => (i === index ? { ...review, ...patch } : review))
    )
  }

  const addReview = () => {
    setReviews((current) => [...current, { ...EMPTY_REVIEW }])
  }

  const removeReview = (index: number) => {
    setReviews((current) => current.filter((_, i) => i !== index))
  }

  const benefitCount = toList(benefits).length
  const ingredientCount = toList(ingredients).length
  const howToUseCount = toList(howToUse).length

  return (
    <Container className="flex flex-col gap-y-4 px-6 py-4">
      <div className="flex items-center justify-between">
        <Heading level="h2">Storefront marketing fields</Heading>
        <Button size="small" variant="secondary" onClick={openDrawer}>
          <PencilSquare />
          Edit
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-2">
        <div className="flex flex-col gap-y-1">
          <Text size="small" leading="compact" weight="plus">
            Key benefits
          </Text>
          <Text size="small" leading="compact" className="text-ui-fg-subtle">
            {benefitCount === 0 ? "None" : `${benefitCount} item${benefitCount === 1 ? "" : "s"}`}
          </Text>
        </div>
        <div className="flex flex-col gap-y-1">
          <Text size="small" leading="compact" weight="plus">
            Ingredients & contents
          </Text>
          <Text size="small" leading="compact" className="text-ui-fg-subtle">
            {ingredientCount === 0 ? "None" : `${ingredientCount} item${ingredientCount === 1 ? "" : "s"}`}
          </Text>
        </div>
        <div className="flex flex-col gap-y-1">
          <Text size="small" leading="compact" weight="plus">
            How to use
          </Text>
          <Text size="small" leading="compact" className="text-ui-fg-subtle">
            {howToUseCount === 0 ? "None" : `${howToUseCount} step${howToUseCount === 1 ? "" : "s"}`}
          </Text>
        </div>
        <div className="flex flex-col gap-y-1">
          <Text size="small" leading="compact" weight="plus">
            Reviews
          </Text>
          <Text size="small" leading="compact" className="text-ui-fg-subtle">
            {reviews.length === 0 ? "None" : `${reviews.length} review${reviews.length === 1 ? "" : "s"}`}
          </Text>
        </div>
      </div>

      <Drawer open={open} onOpenChange={setOpen}>
        <Drawer.Content>
          <Drawer.Header>
            <Drawer.Title>Storefront marketing fields</Drawer.Title>
            <Drawer.Description>
              Controls the Key benefits, Ingredients &amp; contents, How to use, and Reviews
              sections on the storefront product page. Values are stored in product metadata.
            </Drawer.Description>
          </Drawer.Header>
          <Drawer.Body className="flex flex-1 flex-col gap-y-6 overflow-y-auto">
            <div className="flex flex-col gap-y-2">
              <Label size="small">Key benefits</Label>
              <Textarea
                value={benefits}
                onChange={(e) => setBenefits(e.target.value)}
                rows={5}
                placeholder={"One benefit per line\nExample:\nCleanses without stripping natural oils"}
              />
              <Text size="small" leading="compact" className="text-ui-fg-subtle">
                One benefit per line.
              </Text>
            </div>

            <div className="flex flex-col gap-y-2">
              <Label size="small">Ingredients &amp; contents</Label>
              <Textarea
                value={ingredients}
                onChange={(e) => setIngredients(e.target.value)}
                rows={5}
                placeholder={"One ingredient per line\nExample:\nSodium Cocoyl Isethionate"}
              />
              <Text size="small" leading="compact" className="text-ui-fg-subtle">
                One ingredient per line.
              </Text>
            </div>

            <div className="flex flex-col gap-y-2">
              <Label size="small">How to use</Label>
              <Textarea
                value={howToUse}
                onChange={(e) => setHowToUse(e.target.value)}
                rows={5}
                placeholder={"One step per line\nExample:\nWet hair thoroughly."}
              />
              <Text size="small" leading="compact" className="text-ui-fg-subtle">
                One step per line.
              </Text>
            </div>

            <div className="flex flex-col gap-y-2">
              <div className="flex items-center justify-between">
                <Label size="small">Reviews</Label>
                <Button size="small" variant="secondary" onClick={addReview}>
                  <Plus />
                  Add review
                </Button>
              </div>

              {reviews.length === 0 ? (
                <Text size="small" leading="compact" className="text-ui-fg-subtle">
                  No reviews yet. Add one to display customer reviews on the product page.
                </Text>
              ) : (
                <div className="flex flex-col gap-y-3">
                  {reviews.map((review, index) => (
                    <div
                      key={index}
                      className="flex flex-col gap-y-2 rounded-lg border border-ui-border-base bg-ui-bg-subtle p-3"
                    >
                      <div className="grid grid-cols-2 gap-x-2 gap-y-2">
                        <div className="flex flex-col gap-y-1">
                          <Label size="xsmall">Name</Label>
                          <Input
                            value={review.name}
                            onChange={(e) => updateReview(index, { name: e.target.value })}
                            placeholder="e.g. Ananya R."
                          />
                        </div>
                        <div className="flex flex-col gap-y-1">
                          <Label size="xsmall">Rating</Label>
                          <Select
                            value={String(review.rating)}
                            onValueChange={(value) =>
                              updateReview(index, { rating: Number(value) })
                            }
                          >
                            <Select.Trigger size="small">
                              <Select.Value />
                            </Select.Trigger>
                            <Select.Content>
                              {[1, 2, 3, 4, 5].map((rating) => (
                                <Select.Item key={rating} value={String(rating)}>
                                  {rating} {rating === 1 ? "star" : "stars"}
                                </Select.Item>
                              ))}
                            </Select.Content>
                          </Select>
                        </div>
                        <div className="flex flex-col gap-y-1">
                          <Label size="xsmall">Date</Label>
                          <Input
                            value={review.date}
                            onChange={(e) => updateReview(index, { date: e.target.value })}
                            placeholder="e.g. 12 June 2026"
                          />
                        </div>
                        <div className="flex flex-col gap-y-1">
                          <Label size="xsmall">Title</Label>
                          <Input
                            value={review.title}
                            onChange={(e) => updateReview(index, { title: e.target.value })}
                            placeholder="e.g. Worth every rupee"
                          />
                        </div>
                      </div>
                      <div className="flex flex-col gap-y-1">
                        <Label size="xsmall">Body</Label>
                        <Textarea
                          value={review.body}
                          onChange={(e) => updateReview(index, { body: e.target.value })}
                          rows={3}
                          placeholder="Review text shown on the product page"
                        />
                      </div>
                      <Button
                        size="small"
                        variant="danger"
                        className="self-end"
                        onClick={() => removeReview(index)}
                      >
                        <Trash />
                        Remove
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Drawer.Body>
          <Drawer.Footer>
            <div className="flex items-center justify-end gap-x-2">
              <Drawer.Close asChild>
                <Button size="small" variant="secondary" disabled={updateMarketingFields.isPending}>
                  Cancel
                </Button>
              </Drawer.Close>
              <Button
                size="small"
                isLoading={updateMarketingFields.isPending}
                onClick={handleSubmit}
              >
                Save
              </Button>
            </div>
          </Drawer.Footer>
        </Drawer.Content>
      </Drawer>
    </Container>
  )
}

export const config = defineWidgetConfig({
  zone: "product.details.after",
})

export default ProductMarketingFieldsWidget
