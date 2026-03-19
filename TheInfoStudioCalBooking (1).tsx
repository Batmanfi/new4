import { useState, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"

// ─── BRAND ────────────────────────────────────────────────────────────────────
const ACCENT       = "#1A1AE6"
const ACCENT_HOVER = "#3333FF"
const CARD_BG      = "#FFFFFF"
const BORDER       = "#E2E2D8"
const TEXT         = "#0a0a0a"
const MUTED        = "#666655"
const INPUT_BG     = "#F4F4EE"

// ─── CAL.COM EMBED ────────────────────────────────────────────────────────────
// API key lives on the server — see /api/cal-event.ts
const CAL_USERNAME   = "theinfostudio"
const CAL_EVENT_SLUG = "test"
const CAL_EMBED_URL  = `https://cal.com/${CAL_USERNAME}/${CAL_EVENT_SLUG}`

// ─── Replace with your actual Vercel project URL ──────────────────────────────
const PROXY_URL = "https://new4-sandy.vercel.app/api/cal-event"

// ─── TYPES ────────────────────────────────────────────────────────────────────
type StepType = "textarea" | "text" | "select" | "contact" | "calendar"

interface CalField {
  name: string        // slug / internal key, used to pass back to Cal
  label: string       // human-readable question label
  type: string
  required: boolean
  placeholder?: string
  options?: string[]
}

interface Step {
  id: string
  title: string
  subtitle: string
  type: StepType
  placeholder?: string
  options?: string[]
  required: boolean
}

// ─── COMPONENT ────────────────────────────────────────────────────────────────
export default function TheInfoStudioCalBooking() {
  const [stepIndex, setStepIndex] = useState(0)
  const [answers, setAnswers]     = useState<Record<string, string>>({ name: "", email: "" })
  const [submitted, setSubmitted] = useState(false)
  const [steps, setSteps]         = useState<Step[]>([])
  const [loading, setLoading]     = useState(true)
  const listenerRef               = useRef<((e: MessageEvent) => void) | null>(null)

  // ── Fetch from Vercel proxy ────────────────────────────────────────────────
  useEffect(() => {
    const fetchEvent = async () => {
      try {
        const res = await fetch(PROXY_URL)
        if (!res.ok) throw new Error(`Proxy ${res.status}`)
        const json = await res.json()

        // Our proxy returns: { status: "success", data: { title, description, length, customFields[] } }
        const data = json?.data
        if (!data) throw new Error("No data in proxy response")

        const fields: CalField[] = data.customFields ?? []
        setSteps(buildSteps(fields, data.description ?? "", data.length ?? 30))
      } catch (err: any) {
        console.warn("Falling back to default steps:", err.message)
        setSteps(buildSteps([], "", 30))
      } finally {
        setLoading(false)
      }
    }
    fetchEvent()
  }, [])

  // ── Build step list ────────────────────────────────────────────────────────
  function buildSteps(fields: CalField[], description: string, length: number): Step[] {
    const custom: Step[] = fields.map(f => ({
      id:          f.name,                    // slug used as answer key
      title:       f.label,                   // exact label from Cal.com
      subtitle:    f.required ? "Required." : "Optional.",
      type:        (f.type === "textarea"
                     ? "textarea"
                     : f.options?.length ? "select" : "text") as StepType,
      placeholder: f.placeholder || "Type your answer…",
      options:     f.options,
      required:    f.required,
    }))

    // Fallback if no custom fields configured on the event
    if (custom.length === 0) {
      custom.push({
        id:       "prepInfo",
        title:    "Please share anything that will help prepare for our meeting.",
        subtitle: "Optional.",
        type:     "textarea",
        required: false,
      })
    }

    return [
      ...custom,
      {
        id:       "contact",
        title:    "Last step — how do we reach you?",
        subtitle: "We'll use this to confirm your booking.",
        type:     "contact",
        required: true,
      },
      {
        id:       "calendar",
        title:    "Pick a time.",
        subtitle: description || `${length}-minute meeting.`,
        type:     "calendar",
        required: true,
      },
    ]
  }

  // ── Derived state ─────────────────────────────────────────────────────────
  const current    = steps[stepIndex]
  const totalSteps = steps.length
  const progress   = totalSteps ? ((stepIndex + 1) / totalSteps) * 100 : 0
  const isCalendar = current?.type === "calendar"

  const setAnswer = (id: string, value: string) =>
    setAnswers(prev => ({ ...prev, [id]: value }))
  const next = () => setStepIndex(i => Math.min(i + 1, steps.length - 1))
  const prev = () => setStepIndex(i => Math.max(i - 1, 0))

  // ── Build Cal.com embed URL with prefilled name/email ─────────────────────
  const buildCalUrl = () => {
    const params: Record<string, string> = {
      name:  answers.name  || "",
      email: answers.email || "",
    }
    // Pass extra answers as metadata so Cal.com can see them
    Object.entries(answers).forEach(([k, v]) => {
      if (!["name", "email"].includes(k) && v) {
        params[`metadata[${k}]`] = v
      }
    })
    return `${CAL_EMBED_URL}?${new URLSearchParams(params).toString()}&embed=true`
  }

  // ── Cal.com booking confirmation via postMessage ───────────────────────────
  const onCalendarMount = () => {
    const handler = (e: MessageEvent) => {
      if (
        e.data?.type === "CAL:bookingSuccessfulV2" ||
        e.data?.type === "CAL:eventScheduled" ||
        e.data?.event === "cal:booking-successful"
      ) setSubmitted(true)
    }
    listenerRef.current = handler
    window.addEventListener("message", handler)
  }
  const onCalendarUnmount = () => {
    if (listenerRef.current) {
      window.removeEventListener("message", listenerRef.current)
      listenerRef.current = null
    }
  }

  // ─── Styles ───────────────────────────────────────────────────────────────
  const slideVariants = {
    enter:  { opacity: 0, x: 24 },
    center: { opacity: 1, x: 0  },
    exit:   { opacity: 0, x: -24 },
  }
  const inputCSS = (err?: boolean): React.CSSProperties => ({
    width: "100%", padding: "13px 16px", fontSize: "15px",
    fontFamily: "sans-serif", background: INPUT_BG, color: TEXT,
    border: `1.5px solid ${err ? "#dc2626" : BORDER}`,
    borderRadius: "6px", outline: "none",
    transition: "border-color 0.15s", boxSizing: "border-box",
  })
  const labelCSS: React.CSSProperties = {
    display: "block", fontSize: "11px", fontFamily: "monospace",
    textTransform: "uppercase", letterSpacing: "0.08em",
    color: MUTED, marginBottom: "6px",
  }
  const ctaCSS = (on: boolean): React.CSSProperties => ({
    width: "100%", padding: "14px", marginTop: "12px",
    fontSize: "15px", fontFamily: "sans-serif", fontWeight: "600",
    background: on ? ACCENT : BORDER, color: on ? "#fff" : MUTED,
    border: "none", borderRadius: "6px",
    cursor: on ? "pointer" : "not-allowed", transition: "background 0.15s",
  })

  // ─── Skeleton ─────────────────────────────────────────────────────────────
  if (loading) return (
    <div style={{ maxWidth: "600px", margin: "0 auto", padding: "20px", fontFamily: "sans-serif" }}>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>
      <div style={{ background: CARD_BG, borderRadius: "8px", border: `1px solid ${BORDER}`,
        boxShadow: "0 4px 24px rgba(0,0,0,0.07)", padding: "40px 32px" }}>
        <div style={{ height: "3px", background: BORDER, borderRadius: "2px", marginBottom: "32px" }} />
        {[80, 50, 100, 40].map((w, i) => (
          <div key={i} style={{ height: i === 2 ? "80px" : "16px", width: `${w}%`,
            background: INPUT_BG, borderRadius: "4px", marginBottom: "16px",
            animation: `pulse 1.4s ease-in-out ${i * 0.1}s infinite` }} />
        ))}
      </div>
    </div>
  )

  // ─── Calendar step ────────────────────────────────────────────────────────
  const CalendarStep = () => {
    const refCb = (el: HTMLIFrameElement | null) => {
      if (el) onCalendarMount(); else onCalendarUnmount()
    }
    return <iframe ref={refCb} src={buildCalUrl()} width="100%" height="700px"
      frameBorder="0" title="Schedule your meeting"
      style={{ borderRadius: "6px", border: "none", display: "block" }} />
  }

  // ─── Step content ─────────────────────────────────────────────────────────
  const renderContent = () => {
    if (!current) return null

    if (current.type === "textarea" || current.type === "text") {
      const val = answers[current.id] ?? ""
      const canNext = !current.required || !!val.trim()
      return (
        <div>
          {current.type === "textarea"
            ? <textarea value={val} rows={4}
                placeholder={current.placeholder ?? "Type your answer…"}
                onChange={e => setAnswer(current.id, e.target.value)}
                style={{ ...inputCSS(), resize: "none" }}
                onFocus={e => (e.currentTarget.style.borderColor = ACCENT)}
                onBlur={e  => (e.currentTarget.style.borderColor = BORDER)} />
            : <input type="text" value={val}
                placeholder={current.placeholder ?? "Type your answer…"}
                onChange={e => setAnswer(current.id, e.target.value)} style={inputCSS()}
                onFocus={e => (e.currentTarget.style.borderColor = ACCENT)}
                onBlur={e  => (e.currentTarget.style.borderColor = BORDER)} />
          }
          <button onClick={next} disabled={!canNext} style={ctaCSS(canNext)}
            onMouseEnter={e => { if (canNext) e.currentTarget.style.background = ACCENT_HOVER }}
            onMouseLeave={e => { if (canNext) e.currentTarget.style.background = ACCENT }}>
            Next →
          </button>
        </div>
      )
    }

    if (current.type === "select" && current.options) {
      const val = answers[current.id] ?? ""
      const canNext = !current.required || !!val
      return (
        <div>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {current.options.map(opt => (
              <button key={opt} onClick={() => setAnswer(current.id, opt)} style={{
                padding: "12px 16px", textAlign: "left",
                background: val === opt ? `${ACCENT}10` : INPUT_BG,
                border: `1.5px solid ${val === opt ? ACCENT : BORDER}`,
                borderRadius: "6px", cursor: "pointer", fontSize: "15px", color: TEXT,
                transition: "all 0.15s",
              }}>
                <span style={{
                  display: "inline-block", width: "14px", height: "14px", borderRadius: "50%",
                  border: `1.5px solid ${val === opt ? ACCENT : MUTED}`,
                  background: val === opt ? ACCENT : "transparent",
                  marginRight: "10px", verticalAlign: "middle", transition: "all 0.15s",
                }} />{opt}
              </button>
            ))}
          </div>
          <button onClick={next} disabled={!canNext} style={ctaCSS(canNext)}
            onMouseEnter={e => { if (canNext) e.currentTarget.style.background = ACCENT_HOVER }}
            onMouseLeave={e => { if (canNext) e.currentTarget.style.background = ACCENT }}>
            Next →
          </button>
        </div>
      )
    }

    if (current.type === "contact") {
      const emailOk   = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(answers.email)
      const canSubmit = !!answers.name.trim() && emailOk
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
          <div>
            <label style={labelCSS}>Name</label>
            <input type="text" value={answers.name} placeholder="Full name"
              onChange={e => setAnswer("name", e.target.value)} style={inputCSS()}
              onFocus={e => (e.currentTarget.style.borderColor = ACCENT)}
              onBlur={e  => (e.currentTarget.style.borderColor = BORDER)} />
          </div>
          <div>
            <label style={labelCSS}>Email</label>
            <input type="email" value={answers.email} placeholder="you@company.com"
              onChange={e => setAnswer("email", e.target.value)}
              style={inputCSS(!!answers.email && !emailOk)}
              onFocus={e => { if (!answers.email || emailOk) e.currentTarget.style.borderColor = ACCENT }}
              onBlur={e  => { if (!answers.email || emailOk) e.currentTarget.style.borderColor = BORDER }} />
            {answers.email && !emailOk && (
              <p style={{ fontSize: "11px", color: "#dc2626", marginTop: "4px" }}>
                Enter a valid email address
              </p>
            )}
          </div>
          <button onClick={next} disabled={!canSubmit} style={ctaCSS(canSubmit)}
            onMouseEnter={e => { if (canSubmit) e.currentTarget.style.background = ACCENT_HOVER }}
            onMouseLeave={e => { if (canSubmit) e.currentTarget.style.background = ACCENT }}>
            Pick a time →
          </button>
        </div>
      )
    }

    if (current.type === "calendar") return <CalendarStep />
    return null
  }

  // ─── Success screen ───────────────────────────────────────────────────────
  if (submitted) return (
    <div style={{ maxWidth: "600px", margin: "0 auto", padding: "20px", fontFamily: "sans-serif" }}>
      <div style={{ background: CARD_BG, borderRadius: "8px", border: `1px solid ${BORDER}`,
        boxShadow: "0 4px 24px rgba(0,0,0,0.07)", padding: "60px 40px", textAlign: "center" }}>
        <div style={{ width: "56px", height: "56px", borderRadius: "50%",
          background: `${ACCENT}12`, border: `1px solid ${ACCENT}35`,
          display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 24px" }}>
          <span style={{ fontSize: "24px", color: ACCENT }}>✓</span>
        </div>
        <h3 style={{ fontSize: "24px", fontWeight: "700", color: TEXT,
          fontFamily: "'Faculty Glyphic', Georgia, serif", marginBottom: "12px" }}>
          You're booked.
        </h3>
        <p style={{ fontSize: "15px", color: MUTED, maxWidth: "340px", margin: "0 auto" }}>
          Confirmation heading to{" "}
          <span style={{ color: TEXT, fontWeight: "600" }}>{answers.email}</span>.{" "}Talk soon.
        </p>
      </div>
    </div>
  )

  // ─── Main render ──────────────────────────────────────────────────────────
  return (
    <div style={{ width: "100%", maxWidth: isCalendar ? "900px" : "600px",
      margin: "0 auto", padding: "20px", fontFamily: "sans-serif",
      boxSizing: "border-box", transition: "max-width 0.4s ease" }}>
      <div style={{ background: CARD_BG, borderRadius: "8px",
        border: `1px solid ${BORDER}`, overflow: "hidden",
        boxShadow: "0 4px 24px rgba(0,0,0,0.07)" }}>

        {/* Progress bar */}
        <div style={{ height: "3px", background: BORDER }}>
          <motion.div style={{ height: "100%", background: ACCENT }}
            initial={{ width: 0 }} animate={{ width: `${progress}%` }}
            transition={{ duration: 0.35 }} />
        </div>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center",
          justifyContent: "space-between", padding: "20px 24px 0" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            {stepIndex > 0 && (
              <button onClick={prev} style={{ padding: "6px", background: "transparent",
                border: "none", borderRadius: "4px", cursor: "pointer",
                display: "flex", alignItems: "center", transition: "background 0.15s" }}
                onMouseEnter={e => (e.currentTarget.style.background = INPUT_BG)}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                <span style={{ fontSize: "15px", color: MUTED }}>←</span>
              </button>
            )}
            <span style={{ fontSize: "11px", fontFamily: "monospace",
              color: MUTED, letterSpacing: "0.06em" }}>
              {`${stepIndex + 1} of ${totalSteps}`}
            </span>
          </div>
          <span style={{ fontSize: "13px", fontWeight: "700", color: ACCENT,
            fontFamily: "'Faculty Glyphic', Georgia, serif", letterSpacing: "-0.02em" }}>
            TheInfoStudio
          </span>
        </div>

        {/* Step content */}
        <div style={{ padding: isCalendar ? "16px 24px 0" : "24px" }}>
          <AnimatePresence mode="wait">
            <motion.div key={stepIndex} variants={slideVariants}
              initial="enter" animate="center" exit="exit" transition={{ duration: 0.2 }}>
              <h3 style={{ fontSize: "20px", fontWeight: "700", color: TEXT,
                fontFamily: "'Faculty Glyphic', Georgia, serif",
                marginBottom: "5px", lineHeight: "1.35" }}>
                {current?.title}
              </h3>
              {!isCalendar && (
                <p style={{ fontSize: "14px", color: MUTED, marginBottom: "24px" }}>
                  {current?.subtitle}
                </p>
              )}
              {renderContent()}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}
