// api/cal-event.ts
// Deploy this to your Vercel project at /api/cal-event.ts
// Set environment variable: CAL_API_KEY = cal_live_b53c132f64747bbb09f3569513b46a42

import type { VercelRequest, VercelResponse } from "@vercel/node"

const CAL_USERNAME   = "theinfostudio"
const CAL_EVENT_SLUG = "test"
const CAL_BASE       = "https://api.cal.com/v2"

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS — allow your Framer domain
  res.setHeader("Access-Control-Allow-Origin", "*") // tighten to your Framer URL in production
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS")
  res.setHeader("Access-Control-Allow-Headers", "Content-Type")
  if (req.method === "OPTIONS") return res.status(200).end()
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" })

  const apiKey = process.env.CAL_API_KEY
  if (!apiKey) return res.status(500).json({ error: "CAL_API_KEY not set" })

  const headers = {
    Authorization: `Bearer ${apiKey}`,
    "cal-api-version": "2024-06-14",
    "Content-Type": "application/json",
  }

  try {
    // ── Step 1: find the event type ID by listing event types ────────────────
    const listRes = await fetch(
      `${CAL_BASE}/event-types?username=${CAL_USERNAME}&eventSlug=${CAL_EVENT_SLUG}`,
      { headers }
    )
    const listJson = await listRes.json()

    // Log the raw response so you can see it in Vercel function logs
    console.log("LIST RESPONSE:", JSON.stringify(listJson, null, 2))

    // Cal.com v2 list returns { status: "success", data: { eventType: {...} } }
    // OR { status: "success", data: [...] } depending on query params
    let eventTypeId: number | null = null
    let eventType: any = null

    if (listJson?.data?.eventType) {
      // Single event type returned directly
      eventType = listJson.data.eventType
      eventTypeId = eventType.id
    } else if (Array.isArray(listJson?.data)) {
      // Array of event types
      const match = listJson.data.find(
        (e: any) => e.slug === CAL_EVENT_SLUG || e.username === CAL_USERNAME
      )
      eventType = match ?? listJson.data[0] ?? null
      eventTypeId = eventType?.id ?? null
    } else if (listJson?.data?.id) {
      eventType = listJson.data
      eventTypeId = listJson.data.id
    }

    // ── Step 2: if we got an ID, fetch the full event type (includes bookingFields) ──
    if (eventTypeId) {
      const detailRes = await fetch(
        `${CAL_BASE}/event-types/${eventTypeId}`,
        { headers }
      )
      const detailJson = await detailRes.json()
      console.log("DETAIL RESPONSE:", JSON.stringify(detailJson, null, 2))

      if (detailJson?.data) {
        eventType = detailJson.data.eventType ?? detailJson.data
      }
    }

    if (!eventType) {
      return res.status(404).json({
        error: "Event type not found",
        raw: listJson,
      })
    }

    // ── Step 3: extract and return only what the frontend needs ──────────────
    const SYSTEM_FIELDS = ["name", "email", "location", "notes", "guests", "title", "smsReminderNumber", "rescheduleReason"]

    const customFields = (eventType.bookingFields ?? [])
      .filter((f: any) => !SYSTEM_FIELDS.includes(f.name) && !SYSTEM_FIELDS.includes(f.slug))
      .map((f: any) => ({
        name:        f.slug  ?? f.name,
        label:       f.label ?? f.name,
        type:        f.type  ?? "text",
        required:    f.required ?? false,
        placeholder: f.placeholder ?? "",
        options:     f.options?.map((o: any) =>
          typeof o === "string" ? o : (o.label ?? o.value ?? o)
        ) ?? undefined,
      }))

    console.log("CUSTOM FIELDS FOUND:", JSON.stringify(customFields, null, 2))

    res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate")
    return res.status(200).json({
      status: "success",
      data: {
        id:           eventType.id,
        title:        eventType.title ?? "Book a meeting",
        description:  eventType.description ?? "",
        length:       eventType.lengthInMinutes ?? eventType.length ?? 30,
        customFields,
      },
    })
  } catch (err: any) {
    console.error("CAL PROXY ERROR:", err)
    return res.status(500).json({ error: err.message })
  }
}
