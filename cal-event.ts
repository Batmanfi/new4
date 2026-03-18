// api/cal-event.ts  (Vercel Serverless Function)
// ─────────────────────────────────────────────
// Place this file at:  /api/cal-event.ts
// Add to Vercel env:   CAL_API_KEY = cal_live_b53c132f64747bbb09f3569513b46a42
//
// Your component calls GET /api/cal-event — this function
// runs server-side, keeps the key private, and returns the event data.

import type { VercelRequest, VercelResponse } from "@vercel/node"

const CAL_USERNAME   = "theinfostudio"
const CAL_EVENT_SLUG = "test"

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow GET
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" })
  }

  const apiKey = process.env.CAL_API_KEY
  if (!apiKey) {
    return res.status(500).json({ error: "CAL_API_KEY env variable not set" })
  }

  try {
    const calRes = await fetch(
      `https://api.cal.com/v2/event-types?username=${CAL_USERNAME}&eventSlug=${CAL_EVENT_SLUG}`,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "cal-api-version": "2024-06-14",
        },
      }
    )

    if (!calRes.ok) {
      const text = await calRes.text()
      return res.status(calRes.status).json({ error: text })
    }

    const data = await calRes.json()

    // Cache for 60 seconds — event fields rarely change
    res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate")
    return res.status(200).json(data)
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
}
