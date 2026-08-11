import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Button, Container, Heading, Input, Label, Switch, Text, toast } from "@medusajs/ui"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect, useRef, useState } from "react"

import { sdk } from "../../lib/client"

type AnnouncementBar = {
  text: string
  ends_at: string
  show_countdown: boolean
  link_label: string
  link_url: string
  show_link: boolean
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
  const [showCountdown, setShowCountdown] = useState(true)
  const [showLink, setShowLink] = useState(false)
  const [linkLabel, setLinkLabel] = useState("")
  const [linkUrl, setLinkUrl] = useState("")
  const hydrated = useRef(false)

  useEffect(() => {
    if (!store || hydrated.current) {
      return
    }
    hydrated.current = true
    const saved = store.metadata?.announcement_bar as Partial<AnnouncementBar> | undefined
    setText(typeof saved?.text === "string" ? saved.text : "")
    setEndsAt(toLocalDateTimeInput(typeof saved?.ends_at === "string" ? saved.ends_at : ""))
    setShowCountdown(saved?.show_countdown !== false)
    setShowLink(saved?.show_link === true)
    setLinkLabel(typeof saved?.link_label === "string" ? saved.link_label : "")
    setLinkUrl(typeof saved?.link_url === "string" ? saved.link_url : "")
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
    if (showLink && !linkUrl.trim()) {
      toast.error("Enter a link URL or turn off the link toggle")
      return
    }
    updateAnnouncementBar.mutate({
      text,
      ends_at: endsAt ? fromLocalDateTimeInput(endsAt) : "",
      show_countdown: showCountdown,
      link_label: linkLabel,
      link_url: linkUrl,
      show_link: showLink,
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
        <div className="flex items-center justify-between gap-x-2">
          <Label size="small">Show countdown</Label>
          <Switch size="small" checked={showCountdown} onCheckedChange={setShowCountdown} />
        </div>
        <Input
          type="datetime-local"
          value={endsAt}
          onChange={(e) => setEndsAt(e.target.value)}
        />
        <Text size="small" leading="compact" className="text-ui-fg-subtle">
          The countdown ends at this local date and time. Stored as a UTC ISO
          string. Toggle off to hide the countdown in the storefront.
        </Text>
      </div>

      <div className="flex flex-col gap-y-2">
        <div className="flex items-center justify-between gap-x-2">
          <Label size="small">Show link</Label>
          <Switch size="small" checked={showLink} onCheckedChange={setShowLink} />
        </div>
        <Text size="small" leading="compact" className="text-ui-fg-subtle">
          Display a link next to the bar text in the storefront.
        </Text>
      </div>

      {showLink && (
        <div className="flex flex-col gap-y-2">
          <Label size="small">Link label</Label>
          <Input
            value={linkLabel}
            onChange={(e) => setLinkLabel(e.target.value)}
            placeholder="e.g. Shop now"
          />
          <Text size="small" leading="compact" className="text-ui-fg-subtle">
            Text displayed for the link.
          </Text>
        </div>
      )}

      {showLink && (
        <div className="flex flex-col gap-y-2">
          <Label size="small">Link URL</Label>
          <Input
            type="url"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            placeholder="https://"
          />
          <Text size="small" leading="compact" className="text-ui-fg-subtle">
            Where the link points. Required when the link is shown.
          </Text>
        </div>
      )}

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
