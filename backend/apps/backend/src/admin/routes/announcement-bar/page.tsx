import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Button, Container, Heading, Input, Label, Text, toast } from "@medusajs/ui"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect, useRef, useState } from "react"

import { sdk } from "../../lib/client"

type AnnouncementBar = {
  text: string
  ends_at: string
}

function pad(value: number): string {
  return String(value).padStart(2, "0")
}

function toLocalDateTimeInput(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) {
    return ""
  }
  return [
    date.getFullYear(),
    "-",
    pad(date.getMonth() + 1),
    "-",
    pad(date.getDate()),
    "T",
    pad(date.getHours()),
    ":",
    pad(date.getMinutes()),
  ].join("")
}

function fromLocalDateTimeInput(value: string): string {
  return new Date(value).toISOString()
}

const AnnouncementBarPage = () => {
  const queryClient = useQueryClient()

  // Dashboard's useStore caches ["store", "detail"] as { store }; a distinct
  // key is required here or the wrapped shape breaks store.id lookups.
  const { data: store, isLoading } = useQuery({
    queryKey: ["announcement-bar", "store"],
    queryFn: async () => {
      const response = await sdk.admin.store.list()
      return response.stores?.[0] ?? null
    },
  })

  const [text, setText] = useState("")
  const [endsAt, setEndsAt] = useState("")
  const hydrated = useRef(false)

  useEffect(() => {
    if (!store || hydrated.current) {
      return
    }
    hydrated.current = true
    const saved = store.metadata?.announcement_bar as Partial<AnnouncementBar> | undefined
    setText(typeof saved?.text === "string" ? saved.text : "")
    setEndsAt(toLocalDateTimeInput(typeof saved?.ends_at === "string" ? saved.ends_at : ""))
  }, [store])

  const updateAnnouncementBar = useMutation({
    mutationFn: async (payload: AnnouncementBar) => {
      const response = await sdk.admin.store.list()
      const activeStore = response.stores?.[0]
      if (!activeStore?.id) {
        throw new Error("No active store found")
      }
      return sdk.admin.store.update(activeStore.id, {
        metadata: {
          ...(activeStore.metadata ?? {}),
          announcement_bar: payload,
        },
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["announcement-bar", "store"] })
      queryClient.invalidateQueries({ queryKey: ["store", "detail"] })
      toast.success("Announcement bar updated")
    },
    onError: (error) => {
      toast.error(error.message || "Failed to update the announcement bar")
    },
  })

  const handleSave = () => {
    updateAnnouncementBar.mutate({
      text,
      ends_at: endsAt ? fromLocalDateTimeInput(endsAt) : "",
    })
  }

  return (
    <Container className="flex flex-col gap-y-4 px-6 py-4">
      <Heading level="h2">Announcement bar</Heading>

      <div className="flex flex-col gap-y-2">
        <Label size="small">Bar text</Label>
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="e.g. Free shipping on orders above ₹499"
        />
        <Text size="small" leading="compact" className="text-ui-fg-subtle">
          Text displayed in the storefront top bar.
        </Text>
      </div>

      <div className="flex flex-col gap-y-2">
        <Label size="small">Countdown end</Label>
        <Input
          type="datetime-local"
          value={endsAt}
          onChange={(e) => setEndsAt(e.target.value)}
        />
        <Text size="small" leading="compact" className="text-ui-fg-subtle">
          The countdown ends at this local date and time. Stored as a UTC ISO
          string.
        </Text>
      </div>

      <div className="flex items-center justify-end gap-x-2">
        <Button
          size="small"
          isLoading={updateAnnouncementBar.isPending}
          disabled={isLoading}
          onClick={handleSave}
        >
          Save
        </Button>
      </div>
    </Container>
  )
}

export const config = defineRouteConfig({
  label: "Announcement Bar",
})

export default AnnouncementBarPage
