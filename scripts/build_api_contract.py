#!/usr/bin/env python3
"""
Builds docs/HomeBuild_API_Contract.pdf — the JSON shapes this app reads and
writes, and what each of the three PRD personas actually sees.

Regenerate after changing supabase/schema.sql or src/api/*:

    pip install reportlab
    python3 scripts/build_api_contract.py

The content below is transcribed from the schema's CHECK constraints and from
the mapper functions in src/api/, so it is a description of what the code does
rather than a design document that can drift away from it. When they disagree,
the code is right and this file is stale.

Note on currency: amounts render as "INR" rather than the rupee sign. The
ReportLab base-14 fonts use WinAnsi encoding, which has no rupee glyph — the
same constraint documented in src/lib/pdf.js.
"""

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    KeepTogether,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

INK = colors.HexColor("#0F172A")
INK2 = colors.HexColor("#505F76")
INK3 = colors.HexColor("#7A8597")
BRAND = colors.HexColor("#0058BE")
LINE = colors.HexColor("#E2E8F0")
CODE_BG = colors.HexColor("#F7F9FB")
WARN_BG = colors.HexColor("#FEF6E7")
WARN = colors.HexColor("#8A6100")

styles = getSampleStyleSheet()

S = {
    "title": ParagraphStyle(
        "t", parent=styles["Title"], fontName="Helvetica-Bold",
        fontSize=24, leading=29, textColor=INK, spaceAfter=4, alignment=TA_LEFT),
    "sub": ParagraphStyle(
        "s", parent=styles["Normal"], fontName="Helvetica",
        fontSize=11, leading=16, textColor=INK3, spaceAfter=18),
    "h1": ParagraphStyle(
        "h1", parent=styles["Heading1"], fontName="Helvetica-Bold",
        fontSize=15, leading=19, textColor=INK, spaceBefore=18, spaceAfter=7,
        keepWithNext=1),
    "h2": ParagraphStyle(
        "h2", parent=styles["Heading2"], fontName="Helvetica-Bold",
        fontSize=11.5, leading=15, textColor=BRAND, spaceBefore=13, spaceAfter=5,
        keepWithNext=1),
    "body": ParagraphStyle(
        "b", parent=styles["Normal"], fontName="Helvetica",
        fontSize=9.5, leading=14, textColor=INK2, spaceAfter=7),
    "note": ParagraphStyle(
        "n", parent=styles["Normal"], fontName="Helvetica-Oblique",
        fontSize=8.5, leading=12.5, textColor=INK3, spaceAfter=7),
    "code": ParagraphStyle(
        "c", parent=styles["Normal"], fontName="Courier",
        fontSize=7.4, leading=10.2, textColor=INK, spaceAfter=0),
    "cell": ParagraphStyle(
        "cell", parent=styles["Normal"], fontName="Helvetica",
        fontSize=8, leading=11, textColor=INK2),
    "cellb": ParagraphStyle(
        "cellb", parent=styles["Normal"], fontName="Helvetica-Bold",
        fontSize=8, leading=11, textColor=INK),
    "cellc": ParagraphStyle(
        "cellc", parent=styles["Normal"], fontName="Courier",
        fontSize=7.6, leading=11, textColor=INK),
}

story = []


def esc(text):
    return text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def h1(text):
    story.append(Paragraph(esc(text), S["h1"]))


def h2(text):
    story.append(Paragraph(esc(text), S["h2"]))


def p(text):
    story.append(Paragraph(text, S["body"]))


def note(text):
    story.append(Paragraph(text, S["note"]))


def code(block, keep=True):
    """
    A monospaced JSON block on a tinted panel.

    Leading spaces become non-breaking: Paragraph collapses ordinary leading
    whitespace, which flattens every nested object to the left margin and makes
    the JSON structure — the whole point of these blocks — unreadable.
    """
    def render(ln):
        stripped = ln.lstrip(" ")
        indent = "&nbsp;" * (len(ln) - len(stripped))
        return Paragraph(indent + esc(stripped) if stripped else "&nbsp;", S["code"])

    rows = [[render(ln)] for ln in block.strip("\n").split("\n")]
    t = Table(rows, colWidths=[165 * mm])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), CODE_BG),
        ("BOX", (0, 0), (-1, -1), 0.5, LINE),
        ("LEFTPADDING", (0, 0), (-1, -1), 7),
        ("RIGHTPADDING", (0, 0), (-1, -1), 7),
        ("TOPPADDING", (0, 0), (-1, -1), 0.6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0.6),
    ]))
    if not keep:
        story.append(t)
        return

    group = [t, Spacer(1, 9)]
    # keepWithNext on the heading style does not reliably bind to a
    # KeepTogether that follows it, which left headings stranded at the foot of
    # a page with their block overleaf. Pulling the heading (and any one-line
    # lead-in under it) into the same group is what actually holds them
    # together.
    while story and isinstance(story[-1], Paragraph) and story[-1].style.name in (
        "h1", "h2", "b",
    ):
        group.insert(0, story.pop())
        if group[0].style.name in ("h1", "h2"):
            break
    story.append(KeepTogether(group))


def table(headers, rows, widths, mono_first=True):
    """`mono_first` styles column 0 as code — right for field names, wrong for
    prose, so the question-and-answer tables turn it off."""
    data = [[Paragraph(esc(h), S["cellb"]) for h in headers]]
    for r in rows:
        data.append([
            Paragraph(esc(c), S["cellc"] if (i == 0 and mono_first) else S["cell"])
            for i, c in enumerate(r)
        ])
    t = Table(data, colWidths=widths, repeatRows=1)
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), CODE_BG),
        ("LINEBELOW", (0, 0), (-1, 0), 0.7, LINE),
        ("LINEBELOW", (0, 1), (-1, -2), 0.3, LINE),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 4.5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4.5),
    ]))
    story.append(t)
    story.append(Spacer(1, 10))


def callout(text):
    t = Table([[Paragraph(text, S["cell"])]], colWidths=[165 * mm])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), WARN_BG),
        ("BOX", (0, 0), (-1, -1), 0.5, WARN),
        ("LEFTPADDING", (0, 0), (-1, -1), 9),
        ("RIGHTPADDING", (0, 0), (-1, -1), 9),
        ("TOPPADDING", (0, 0), (-1, -1), 7),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
    ]))
    story.append(t)
    story.append(Spacer(1, 10))


# ══════════════════════════════════════════════════════════ cover
story.append(Paragraph("HomeBuild — Data &amp; Response Contract", S["title"]))
story.append(Paragraph(
    "Every JSON shape the application reads and writes, the complete set of "
    "permitted values, and what each of the three PRD personas actually sees.",
    S["sub"]))

p("Two different shapes appear in this document and they are not "
  "interchangeable:")
table(
    ["Shape", "What it is", "Where it is defined"],
    [
        ["Row", "A record exactly as the database stores it. snake_case. This is "
                "what PostgREST returns and what an RLS policy is evaluated against.",
         "supabase/schema.sql"],
        ["Response", "The UI-shaped object a screen consumes. camelCase, with "
                     "database vocabulary already mapped to presentation "
                     "(timeline_status: 'on_track' becomes a green 'On Track' chip).",
         "src/api/*.js"],
    ],
    [22 * mm, 96 * mm, 47 * mm], mono_first=False)

p("The mapping between them lives in one place per domain — the "
  "<font face='Courier' size='8.5'>src/api/</font> module — rather than being "
  "repeated in every component that renders a chip. A screen never sees a raw row.")

callout(
    "<b>Read this section first.</b> The three roles in "
    "<font face='Courier' size='8'>profiles.role</font> are descriptive labels. "
    "They do <b>not</b> grant or restrict anything: the string "
    "'project_manager' appears in no Row Level Security policy anywhere in the "
    "schema. What a person can see is decided entirely by their <i>relationship "
    "to a project</i>. Section 6 sets this out in full, and it is the part most "
    "likely to be assumed wrong.")

# ══════════════════════════════════════════════════════════ 1
h1("1. The access model")

p("One function decides every read in the system:")
code("""
has_project_access(project_id) = you are the project's manager_uid
                              OR you are the project's customer_uid
                              OR you appear in project_members for it
""")

p("Everything that hangs off a project — site updates, alerts, milestones, "
  "schedule phases, budget lines, cost categories, expenses, floor plans, "
  "photos, activity — inherits that check verbatim. There is no per-role "
  "branch anywhere in it.")

p("A second function gates administration:")
code("""
is_project_manager(project_id) = you are the project's manager_uid
""")

p("That is what restricts adding and removing project members, and writing cost "
  "categories. Again it reads a <i>column on the project</i>, not the persona on "
  "your profile. A user whose "
  "<font face='Courier' size='8.5'>profiles.role</font> is 'customer' but who is "
  "set as a project's <font face='Courier' size='8.5'>manager_uid</font> has full "
  "manager rights over it.")

h2("What this means in practice")
table(
    ["Question", "Answer"],
    [
        ["Does changing profiles.role change what I can see?",
         "No. It changes labels in the UI and nothing else."],
        ["Can two personas see the same project?",
         "Yes, and they must — PRD section 4 has a homeowner, a PM and a "
         "supervisor all working the same build."],
        ["What is actually private?",
         "One project from another. Not one person from another."],
        ["Are profiles and contractors scoped?",
         "No, deliberately: both are shared directories. You cannot assign a PM "
         "or pick a contractor you cannot see."],
        ["Are invitations scoped?",
         "Yes, to the inviter — reading, not just revoking."],
    ],
    [62 * mm, 103 * mm], mono_first=False)

note("Consequence worth knowing before a real launch: any signed-in account can "
     "read the full profiles directory, including the email and phone of people "
     "they share no project with. This is the one open security decision, and "
     "supabase/README.md ranks three fixes for it.")

story.append(PageBreak())

# ══════════════════════════════════════════════════════════ 2
h1("2. Permitted values")

p("Every one of these is enforced by a CHECK constraint. A value outside the "
  "set is rejected by the database, not merely discouraged by the client.")

h2("Identity and lifecycle")
table(
    ["Field", "Permitted values"],
    [
        ["profiles.role", "customer | project_manager | site_supervisor"],
        ["project_members.role", "free text; 'creator', 'manager', 'customer', "
                                 "'member' are what the app writes"],
        ["projects.status", "lead | in_design | active | paused | completed | cancelled"],
        ["projects.timeline_status", "on_track | ahead | delayed | at_risk"],
        ["projects.budget_status", "on_budget | review_required | over_budget"],
        ["projects.plot_facing", "North | South | East | West"],
        ["projects.total_floors", "G | G+1 | G+2 | G+3"],
        ["projects.bhk_per_floor", "integer 1-4"],
        ["projects.progress_pct", "integer 0-100 (derived by trigger; a manual "
                                  "override is possible)"],
        ["invitations.status", "pending | accepted | revoked | expired"],
    ],
    [46 * mm, 119 * mm])

h2("Workflow states")
table(
    ["Field", "Permitted values"],
    [
        ["milestones.status", "upcoming | pending_verification | approved | paid"],
        ["ai_alerts.severity", "Low | Medium | High | Critical  (capitalised, "
                               "unlike every other enum)"],
        ["ai_alerts.status", "new | acknowledged | assigned | resolved | false_positive"],
        ["ai_alerts.confidence", "numeric 0-1, stored as a fraction and rendered "
                                 "as a percentage"],
        ["site_updates.status", "in_progress | done | blocked"],
        ["schedule_phases.status", "done | in_progress | critical | delayed | "
                                   "queued | on_hold"],
    ],
    [46 * mm, 119 * mm])

h2("Directory and design")
table(
    ["Field", "Permitted values"],
    [
        ["contractors.kind", "internal | sub"],
        ["contractors.rating", "numeric 0-5, one decimal"],
        ["contractors.score", "integer 0-100"],
        ["floor_plans.variant", "A | B | C"],
        ["floor_plans.vastu_score", "numeric 0-10"],
        ["floor_plans.efficiency_score", "numeric 0-10"],
    ],
    [46 * mm, 119 * mm])

h2("Activity log vocabulary")
p("Written by the SQL workflow functions, so this list is exhaustive:")
table(
    ["entity", "action"],
    [
        ["project", "created | status_changed | progress_updated"],
        ["milestone", "status_changed | second_approved"],
        ["alert", "status_changed"],
        ["floor_plan", "selected"],
        ["schedule", "forecast_applied"],
        ["account", "claimed_demo"],
    ],
    [40 * mm, 125 * mm], mono_first=False)

callout(
    "<b>Money is stored in rupees, not lakhs.</b> PRD 8.1 says lakhs; the base "
    "unit is stored instead so the same figure cannot drift between screens that "
    "render it at different magnitudes. Every *_amount, budget_* and cost column "
    "is a whole-rupee integer. Formatting to L / Cr happens at the edge.")

story.append(PageBreak())

# ══════════════════════════════════════════════════════════ 3
h1("3. Row shapes — what the database stores")

h2("profiles")
p("One row per signed-in user, keyed on the Firebase UID. Firebase owns "
  "identity; this table holds what Firebase has nowhere to put.")
code("""
{
  "firebase_uid": "T2mQ...z9",        // text PK, from Firebase Auth
  "full_name":    "Manish Kumar",
  "email":        "manish@example.com",
  "phone":        "+91 98450 11223",   // null until set
  "job_title":    "Senior Project Manager",
  "role":         "project_manager",   // descriptive only, see section 1
  "avatar_url":   "https://.../avatars/T2mQ.../avatar.jpg?v=1757",
  "created_at":   "2026-02-11T09:04:22.114Z",
  "updated_at":   "2026-09-01T17:20:03.882Z"
}
""")

h2("projects — PRD 8.1")
code("""
{
  "id":                  "11111111-1111-4111-8111-000000000001",
  "name":                "Sky Villa 42",
  "client_name":         "Global Ventures Inc.",   // display label
  "customer_uid":        "T2mQ...z9",   // FK profiles; null if not linked
  "manager_uid":         "K9xd...a1",   // FK profiles; grants manager rights
  "status":              "active",
  "city":                "Bengaluru",
  "plot_address":        "42 Whitefield Main Rd, Bengaluru 560066",
  "plot_lat":            12.976750,     // numeric(9,6), null until surveyed
  "plot_lng":            77.575210,
  "plot_length_ft":      60,
  "plot_width_ft":       40,
  "plot_facing":         "East",
  "total_floors":        "G+2",
  "bhk_per_floor":       3,
  "budget_total":        12450000,      // rupees
  "budget_consumed":     8466000,       // recalculated by trigger from expenses
  "progress_pct":        65,            // recalculated by trigger from phases
  "budget_status":       "on_budget",
  "timeline_status":     "on_track",
  "start_date":          "2026-01-15",
  "expected_completion": "2026-09-01",
  "actual_completion":   null,          // stamped on handover
  "created_at":          "2026-01-04T06:12:00.000Z",
  "updated_at":          "2026-09-05T11:41:38.201Z"
}
""")
note("PRD 8.1 lists 'Selected Plan' as a field here. It is modelled as "
     "floor_plans.is_selected instead, so which plan is chosen has exactly one "
     "home and the two sides cannot disagree.")

h2("project_members — the access list")
code("""
{
  "project_id": "11111111-1111-4111-8111-000000000001",
  "member_uid": "T2mQ...z9",
  "role":       "creator"     // creator | manager | customer | member
}
""")

h2("milestones — PRD 8.5")
code("""
{
  "id":                    "44444444-4444-4444-8444-000000000001",
  "project_id":            "11111111-...-000000000001",
  "sequence":              1,              // unique per project
  "name":                  "Foundation Complete",
  "contractor_id":         "33333333-...-000000000005",   // nullable
  "release_pct":           18.00,          // derived from amount vs budget
  "release_amount":        2241000,        // rupees
  "due_date":              "2026-10-12",
  "status":                "pending_verification",
  "verification_criteria": "Sub-structure cast, PM site inspection passed",
  "pm_verified_at":        null,
  "pm_verified_by":        null,           // FK profiles - who verified
  "customer_approved_at":  null,
  "customer_approved_by":  null,
  "second_approval_at":    null,           // required above INR 5,00,000
  "second_approver_uid":   null,           // must differ from pm_verified_by
  "paid_at":               null,
  "payment_txn_id":        null,           // "SIM-A1B2C3D4E5F6" once paid
  "cost_category_id":      "aaaa...-0001", // which category it is charged to
  "created_at":            "2026-01-04T06:12:01.000Z",
  "updated_at":            "2026-01-04T06:12:01.000Z"
}
""")

story.append(PageBreak())

h2("ai_alerts — PRD 8.4")
code("""
{
  "id":                "77777777-7777-4777-8777-000000000001",
  "project_id":        "11111111-...-000000000011",
  "source_update_id":  "66666666-...-000000000001",  // nullable
  "category":          "Rebar spacing mismatch",
  "severity":          "Critical",
  "confidence":        0.920,        // 0-1; null for a human-logged alert
  "description":       "Detected bar spacing of 210mm against a specified 150mm.",
  "location_text":     "Vertical columns, Level 4 East",
  "location_in_photo": null,         // jsonb bounding box, CV model output
  "status":            "new",
  "assigned_to":       null,         // FK profiles
  "detected_at":       "2026-10-24T03:43:00.000Z",
  "resolved_at":       null,
  "resolution_photo":  null,
  "created_at":        "2026-10-24T03:43:00.000Z"
}
""")
note("confidence is deliberately null when a person logs a defect by hand. "
     "Putting 1.0 there would make a judgement look like a measurement.")

h2("site_updates + site_update_photos — PRD 8.3")
code("""
{
  "id":               "66666666-6666-4666-8666-000000000001",
  "project_id":       "11111111-...-000000000001",
  "supervisor_uid":   "S4pl...m2",
  "work_category":    "Slab Casting",
  "location_on_site": "East Wing, Level 4",
  "notes":            "Concrete pour underway. Slump tests returned 105mm.",
  "status":           "in_progress",
  "milestone_id":     null,          // optional PRD 8.3 reference
  "workers_present":  24,            // optional, PRD 5.2.5
  "materials_used":   "40 bags OPC, 2 t steel",
  "client_token":     null,          // idempotency key for offline retry
  "uploaded_at":      "2026-10-24T03:45:00.000Z",
  "created_at":       "2026-10-24T03:45:00.000Z"
}

// one row per photo, so each carries its own uploader and caption
{
  "id":             "88888888-...-0001",
  "site_update_id": "66666666-...-000000000001",
  "storage_path":   "<site_update_id>/<uploader_uid>/k2m9x-a7f3.jpg",
  "caption":        null,
  "uploaded_by":    "S4pl...m2",
  "created_at":     "2026-10-24T03:46:11.000Z"
}
""")

h2("schedule_phases — PRD 5.4.2")
code("""
{
  "id":                  "55555555-...-000000000003",
  "project_id":          "11111111-...-000000000001",
  "sequence":            3,
  "name":                "Rebar Reinforcement",
  "phase_group":         "1. Foundations",
  "baseline_start_week": 2.40,   // weeks from the PROJECT's start_date
  "baseline_end_week":   3.40,
  "actual_start_week":   2.50,   // null until started
  "actual_end_week":     3.40,
  "forecast_start_week": 3.40,   // written by apply_schedule_forecast()
  "forecast_end_week":   4.25,
  "cost":                620000,
  "status":              "delayed",
  "delay_days":          4,
  "delay_cause":         "Material delay",   // PRD 5.4.4
  "delay_cost_impact":   85000,
  "delay_recoverable":   true,               // null = not yet judged
  "created_at":          "2026-01-04T06:12:02.000Z"
}
""")

h2("expenses — the spend ledger")
code("""
{
  "id":           "eeee...-0001",
  "project_id":   "11111111-...-000000000001",
  "category_id":  "aaaa...-0001",   // FK cost_categories, nullable
  "milestone_id": null,             // NON-NULL means this IS an escrow release
  "amount":       2850000,
  "incurred_on":  "2026-06-12",
  "vendor":       "Sharma Constructions",
  "note":         "RMC and steel, ground floor slab",
  "created_by":   "K9xd...a1",
  "created_at":   "2026-06-12T10:02:00.000Z"
}
""")
callout(
    "<b>milestone_id is the load-bearing field here.</b> A row with one is an "
    "escrow release, posted by the payment workflow running as definer. The RLS "
    "policy forbids a member from inserting, updating or deleting such a row — "
    "escrow lines cannot be written or edited from a client, which is what makes "
    "the ledger audit-ready. A unique index on it stops a release being billed twice.")

story.append(PageBreak())

h2("Remaining tables, in brief")
table(
    ["Table", "Shape"],
    [
        ["floor_plans",
         "{ id, project_id, variant 'A'|'B'|'C', name, vastu_score 0-10, "
         "efficiency_score 0-10, total_sqft, cost_per_sqft, total_cost, "
         "highlights[], vastu_notes, room_layout{floors[],vastuFindings[]}, "
         "validation{checks[],passed}, is_selected, budget_tier, "
         "architectural_style, vastu_required, extra_spaces[], parking_spots }"],
        ["contractors",
         "{ id, code 'CON-8842', name, initials, trade, rating 0-5, score 0-100, "
         "kind, score_history int[], compliance_ok }"],
        ["contractor_assignments", "{ contractor_id, project_id }"],
        ["cost_categories",
         "{ id, project_id, label, pct, tone, sequence, budgeted }"],
        ["budget_entries",
         "{ id, project_id, period '2026-08-01', amount } - legacy monthly "
         "series, now only a fallback for demo projects"],
        ["invitations",
         "{ id, email, role, project_id, invited_by, status, token, expires_at, "
         "accepted_at, created_at }"],
        ["activity_log",
         "{ id, project_id, actor_uid, entity, entity_id, action, summary, "
         "detail jsonb, created_at }"],
    ],
    [34 * mm, 131 * mm], mono_first=False)

# ══════════════════════════════════════════════════════════ 4
h1("4. Response shapes — what a screen receives")

p("These are the objects returned by <font face='Courier' size='8.5'>src/api/</font>. "
  "Note the deliberate difference from the rows above: statuses arrive as "
  "<font face='Courier' size='8.5'>{ label, tone }</font> pairs ready to render, "
  "and the raw key is kept alongside so logic can still branch on it.")

h2("listProjects() / getProject(id)")
code("""
[{
  "id":             "11111111-...-000000000001",
  "name":           "Sky Villa 42",
  "client":         "Global Ventures Inc.",   // "-" when unset
  "city":           "Bengaluru",
  "manager":        "Manish Kumar",           // "Unassigned" when null
  "managerUid":     "K9xd...a1",
  "status":         "active",                 // raw lifecycle key
  "progress":       65,
  "budgetTotal":    12450000,
  "budgetConsumed": 8466000,
  "budgetStatus":   { "label": "On Budget", "tone": "success" },
  "timeline":       { "label": "On Track",  "tone": "success" },
  "timelineKey":    "on_track",
  "estimate":       "2026-09-01",
  "startDate":      "2026-01-15",
  "team":           ["https://.../a.jpg", "https://.../b.jpg"],  // max 3
  "teamNames":      ["Manish Kumar", "Rekha Gupta", "Dhawan Singh"],
  "extraTeam":      0                         // the "+N" counter
}]
""")

note("tone is one of: success | warning | danger | violet | info | orange | "
     "brand | neutral | none. 'none' renders a label with no status dot, which "
     "is the mockup's treatment of 'Delayed'.")

h2("getDashboardKpis()")
code("""
{
  "activeProjects":   12,
  "delayed":          2,
  "openAlerts":       124,
  "pendingApprovals": 2,
  "budgetHealth":     43     // percent of budget REMAINING, 0-100
}
""")

h2("listMilestones(projectId)")
code("""
[{
  "id":                  "44444444-...-000000000001",
  "milestone":           "Foundation Complete",
  "contractor":          "SteelWorks Co.",     // "Unassigned" when null
  "dueDate":             "2026-10-12",
  "amount":              2241000,
  "status":              { "label": "Pending Verification", "tone": "warning" },
  "statusKey":           "pending_verification",
  "releasePct":          18,
  "criteria":            "Sub-structure cast, PM site inspection passed",
  "txnId":               null,
  "pmVerifiedAt":        null,
  "customerApprovedAt":  null,
  "paidAt":              null,
  "needsSecondApproval": true,   // amount > 500000
  "secondApprovedAt":    null,
  "simulated":           false   // true when txnId starts "SIM-"
}]
""")

story.append(PageBreak())

h2("listAlerts({ severity, status, page })")
code("""
{
  "alerts": [{
    "id":         "77777777-...-000000000001",
    "type":       "Rebar spacing mismatch",   // the category column
    "location":   "Vertical columns, Level 4 East",
    "severity":   "Critical",
    "confidence": 92,          // 0-1 in the row, PERCENT here
    "project":    "Grand Sky Plaza",
    "detected":   "2026-10-24T03:43:00.000Z",
    "resolved":   false,
    "status":     "new"
  }],
  "total":      124,
  "totalPages": 13            // ALERTS_PER_PAGE = 10
}
""")

h2("listFeedEntries({ projectId, category })")
code("""
[{
  "id":             "66666666-...-000000000001",
  "projectId":      "11111111-...-000000000001",
  "projectName":    "Sky Villa 42",
  "chip":           { "label": "SLAB CASTING", "tone": "success" },
  "title":          "East Wing, Level 4",
  "category":       "Slab Casting",
  "date":           "2026-10-24T03:45:00.000Z",
  "time":           "09:15 AM",
  "status":         { "label": "In Progress", "tone": "success" },
  "note":           "Concrete pour underway. Slump tests returned 105mm.",
  "workersPresent": 24,
  "materialsUsed":  "40 bags OPC, 2 t steel",
  "team":           ["https://.../supervisor.jpg"],
  "supervisor":     "Dhawan Singh",
  "photos": [{
    "id":      "88888888-...-0001",
    "path":    "<update_id>/<uid>/k2m9x-a7f3.jpg",
    "caption": null,
    "url":     "https://...signed...&token=eyJ..."   // 1 hour TTL
  }],
  "uploadSlots": 2
}]
""")
note("Photo URLs are signed in ONE batch per request, not one call per photo. "
     "The site-photos bucket is private; the URL expires after an hour.")

h2("getSchedule(projectId)")
code("""
{
  "groups": [{
    "id":          "1-foundations",
    "name":        "1. Foundations",
    "defaultOpen": true,
    "baseline":    { "start": 0, "end": 3.4 },
    "tasks": [{
      "id":       "55555555-...-000000000003",
      "name":     "Rebar Reinforcement",
      "badge":    { "label": "DELAYED", "tone": "danger" },
      "bar":      { "start": 2.5, "end": 3.4, "tone": "danger" },
      "forecast": { "start": 3.4, "end": 4.25 },   // null when not forecast
      "flag":     "+4 Days",                       // null when on time
      "cost":     620000,
      "status":   "delayed",
      "delayDays": 4,
      "delayCause": "Material delay",
      "delayCostImpact": 85000,
      "delayRecoverable": true
    }]
  }],
  "months":         [{ "label": "JANUARY 2026", "weeks": ["W1","W2","W3"] }],
  "today":          { "offset": 2.45, "label": "TODAY: OCT 18" },  // or null
  "totalDelayDays": 4,
  "phaseCount":     9
}
""")
note("Week offsets are measured from the PROJECT's start_date, not from a "
     "calendar week. today is null when the project has no start date or when "
     "today falls outside the twelve-week window, so no marker is drawn on a guess.")

story.append(PageBreak())

h2("getCostCategories(projectId)")
code("""
{
  "uncategorised": 0,        // spend naming no category, reported not dropped
  "categories": [{
    "id":       "aaaa...-0001",
    "label":    "Civil & Structural",
    "value":    48,          // planned percentage - drives the donut
    "tone":     "brand",
    "budgeted": 5976000,
    "spent":    4090000,
    "usedPct":  68,          // UNCAPPED: an overrun reads above 100
    "over":     false
  }]
}
""")

h2("listTeamMembers(ownerUid) — Settings")
p("Derived from invitations this user sent, not from the profiles directory. "
  "Returns <font face='Courier' size='8.5'>[]</font> until they invite someone.")
code("""
[{
  "inviteId": "cccc...-0001",
  "id":       "T2mQ...z9",   // null until they sign up; gates the activity query
  "name":     "Rekha Gupta", // the email address when not yet signed up
  "email":    "rekha@example.com",
  "role":     "Lead Architect",   // job_title, else the invited persona label
  "status":   "ACTIVE",           // ACTIVE | PENDING | EXPIRED
  "joined":   true,
  "avatar":   "https://.../avatar.jpg",
  "initials": "RG"
}]
""")

h2("globalSearch(query) — topbar")
code("""
{
  "term": "harbor",
  "groups": [{
    "key":      "projects",
    "labelKey": "search.projects",     // translated at render
    "items": [{
      "id":     "11111111-...-000000000002",
      "title":  "Harbor Heights",
      "detail": "Beacon Properties Ltd. - Mumbai",
      "to":     "/projects"
    }]
  }],
  "total": 1
}
""")
note("Five tables are queried in parallel. RLS does the access control, so a "
     "search can only ever surface what the caller could already open.")

h2("listActivity({ projectId, actorUid })")
code("""
[{
  "id":          "dddd...-0001",
  "entity":      "milestone",
  "action":      "status_changed",
  "summary":     "Milestone \\u201cFoundation Complete\\u201d moved to approved",
  "at":          "2026-09-05T11:41:38.201Z",
  "actor":       "Manish Kumar",     // "System" when actor_uid is null
  "actorAvatar": "https://.../avatar.jpg",
  "project":     "Sky Villa 42"
}]
""")

# ══════════════════════════════════════════════════════════ 5
h1("5. RPC contracts")

p("These are the writes that must not be bypassed by a client bug, so they live "
  "in SQL. Called via "
  "<font face='Courier' size='8.5'>supabase.rpc(name, args)</font>.")

table(
    ["Function", "Argument / returns and rules"],
    [
        ["create_project",
         "p_project jsonb (all values as strings; empty string means null). "
         "Returns the projects row. Runs as definer so a project can be assigned "
         "to a different PM without the creator losing access; always records the "
         "creator as a member, and applies the three PRD templates in the same "
         "transaction (6 categories, 6 milestones, 11 phases)."],
        ["advance_milestone",
         "(p_milestone_id, p_next_status). Returns the milestone row. Legal moves "
         "ONLY: upcoming to pending_verification, pending_verification to "
         "approved, approved to paid, pending_verification back to upcoming. "
         "Refuses 'paid' above INR 5,00,000 until second_approval_at is set. "
         "Stamps timestamps and mints the payment reference server-side."],
        ["second_approve_milestone",
         "(p_milestone_id). Returns the milestone row. Refuses a milestone that "
         "is not 'approved', one below the threshold, and the person who verified "
         "it - dual approval one account can satisfy twice is a log entry, not a "
         "control."],
        ["resolve_alert",
         "(p_alert_id, p_next_status, p_assignee). Returns the alert row. "
         "p_next_status must be acknowledged | assigned | resolved | "
         "false_positive. Writes its own audit entry."],
        ["apply_schedule_forecast",
         "(p_project_id). Returns integer - how many phases shifted. Applies all "
         "three PRD 5.4.3 rules: cumulative delay pushed forward, a 15% monsoon "
         "buffer for baseline weeks 22-36, and rework days per OPEN high-severity "
         "alert (High adds 3, Critical adds 7)."],
        ["select_floor_plan",
         "(p_plan_id). Returns the floor_plans row. Exclusive - clears the other "
         "plans on the project in the same call, and moves a lead/in_design "
         "project to active."],
        ["dashboard_kpis",
         "() Returns a single-row table. Respects RLS, so the counts are of what "
         "the caller can see."],
        ["claim_demo_projects",
         "() Returns integer. Adds the caller to every seeded project, because a "
         "correctly empty first sign-in is indistinguishable from a broken one."],
    ],
    [40 * mm, 125 * mm])

story.append(PageBreak())

# ══════════════════════════════════════════════════════════ 6
h1("6. The three roles — what each actually sees")

callout(
    "The single most important thing on this page: these differences come from "
    "<b>which projects a person is attached to</b>, not from their "
    "<font face='Courier' size='8'>profiles.role</font>. Two accounts with the "
    "same role see completely different data; one account can hold different "
    "relationships to two different projects.")

h2("How each persona is normally attached")
table(
    ["Persona", "Typical attachment", "What follows from it"],
    [
        ["customer",
         "projects.customer_uid on their own build",
         "Reads that project and everything under it. Cannot add or remove "
         "members. Cannot write cost categories. Can record an expense, raise an "
         "alert and post a site update, because those policies ask only for "
         "project access."],
        ["project_manager",
         "projects.manager_uid, usually on several projects",
         "Everything a customer can do on those projects, plus managing the "
         "member list and cost categories, plus deleting the project."],
        ["site_supervisor",
         "a project_members row",
         "Reads the project and posts site updates and photos as themselves. No "
         "member management. Identical read scope to the customer."],
    ],
    [28 * mm, 47 * mm, 90 * mm], mono_first=False)

note("Read that table as the intended arrangement, not as an enforced one. "
     "Nothing stops a 'customer' being set as manager_uid, and if that happens "
     "they get manager rights.")

h2("Write permissions, exactly as the policies read")
table(
    ["Operation", "Requirement"],
    [
        ["select, on any project-owned table", "has_project_access(project_id)"],
        ["insert project", "manager_uid = you (or go through create_project)"],
        ["update project", "has_project_access(id)"],
        ["delete project", "manager_uid = you"],
        ["add / remove project member", "is_project_manager(project_id); anyone "
                                        "may remove themselves"],
        ["write cost categories", "is_project_manager(project_id)"],
        ["insert expense", "has_project_access AND created_by = you AND "
                           "milestone_id IS NULL"],
        ["update / delete expense", "created_by = you AND milestone_id IS NULL"],
        ["insert site update", "has_project_access AND supervisor_uid = you"],
        ["insert site photo", "uploaded_by = you AND access to the update's project"],
        ["insert / update alert", "has_project_access(project_id)"],
        ["insert / update milestone", "has_project_access(project_id)"],
        ["update own profile", "firebase_uid = you"],
        ["read invitations", "invited_by = you"],
    ],
    [58 * mm, 107 * mm], mono_first=False)

h2("The same milestone, seen through the workflow")
p("The payment chain spans all three applications. This app implements the "
  "manager's half and <i>shows</i> the rest as status rather than as a button:")
code("""
upcoming
  -> pending_verification   PM submits            (this app)
  -> approved               PM verifies           (this app)
     [+ second approval if release_amount > 500000, by a DIFFERENT person]
  -> paid                   CUSTOMER approves     (customer app - NOT here)
""")
p("MILESTONE_ACTIONS in "
  "<font face='Courier' size='8.5'>src/api/finance.js</font> deliberately omits "
  "<font face='Courier' size='8.5'>approved -&gt; paid</font>. The database still "
  "enforces the whole chain, so a manager cannot reach it from here even by "
  "accident.")

story.append(PageBreak())

h2("Worked example — one project, three viewers")
p("Project <font face='Courier' size='8.5'>Sky Villa 42</font>, with "
  "customer_uid = Rajesh, manager_uid = Manish, and Dhawan in project_members.")

code("""
// Manish (manager_uid) - GET /projects
[ { "name": "Sky Villa 42", ... }, { "name": "The Nexus Hub", ... },
  { "name": "Silver Oak Residences", ... } ]        // all he manages

// Rajesh (customer_uid) - GET /projects
[ { "name": "Sky Villa 42", ... } ]                 // only his own build

// Dhawan (project_members) - GET /projects
[ { "name": "Sky Villa 42", ... }, { "name": "Oak Creek Estates", ... } ]

// Priya, no relationship to any of them - GET /projects
[ ]                                                 // not an error; empty
""")

callout(
    "An empty array is the correct answer for someone with no project "
    "relationship, and it is indistinguishable from a broken app. That is why "
    "the Projects screen offers 'Join the demo projects' "
    "(<font face='Courier' size='8'>claim_demo_projects()</font>) rather than "
    "leaving a new account staring at nothing.")

# ══════════════════════════════════════════════════════════ 7
h1("7. Error shapes")

p("PostgREST errors are translated once, in "
  "<font face='Courier' size='8.5'>src/api/client.js</font>, so every screen "
  "handles them the same way. The client throws an Error carrying a message "
  "written for a person:")
table(
    ["Code", "Rendered message"],
    [
        ["42P01", "The database tables are missing. Run supabase/schema.sql, "
                  "then seed.sql."],
        ["42501", "You do not have permission to read this. Check that Firebase "
                  "is registered as a third-party auth provider in Supabase."],
        ["23505", "Context-dependent: 'That person is already on this project.' "
                  "or 'There is already a pending invitation for that address.'"],
        ["network", "Could not reach the database. Check your connection."],
        ["other", "Passed through with its code appended, so a bug report has "
                  "something to go on."],
    ],
    [24 * mm, 141 * mm], mono_first=False)

p("RPC functions raise plain exceptions, which surface as the message text — "
  "for example <i>'Cannot move a milestone from upcoming to paid'</i> or "
  "<i>'The second approval must come from someone other than the verifier'</i>.")

h2("Not implemented, and honest about it")
table(
    ["Area", "State"],
    [
        ["AI floor plan generation",
         "The engine, validators and Vastu scoring are real and deterministic. "
         "The model call is a documented seam in src/lib/planGenerator.js, not a "
         "stub that pretends."],
        ["Computer-vision quality checks",
         "No model. Alerts come from the seed or from a person logging one."],
        ["Escrow payments and KYC",
         "No provider connected. payment_txn_id is prefixed 'SIM-' and every "
         "receipt says so on its face."],
        ["Email delivery of invitations",
         "The invite is recorded, expires and can be revoked. Nothing is sent."],
        ["Push notifications, direct messaging",
         "Absent. The topbar message icon says so."],
    ],
    [42 * mm, 123 * mm], mono_first=False)

story.append(Spacer(1, 14))
note("Generated by scripts/build_api_contract.py from supabase/schema.sql and "
     "src/api/. Regenerate after changing either; where this document and the "
     "code disagree, the code is right.")


def footer(canvas, doc):
    canvas.saveState()
    canvas.setFont("Helvetica", 7.5)
    canvas.setFillColor(INK3)
    canvas.drawString(22 * mm, 12 * mm, "HomeBuild - Data & Response Contract")
    canvas.drawRightString(188 * mm, 12 * mm, f"Page {doc.page}")
    canvas.setStrokeColor(LINE)
    canvas.setLineWidth(0.4)
    canvas.line(22 * mm, 16 * mm, 188 * mm, 16 * mm)
    canvas.restoreState()


if __name__ == "__main__":
    import os
    os.makedirs("docs", exist_ok=True)
    out = "docs/HomeBuild_API_Contract.pdf"
    SimpleDocTemplate(
        out, pagesize=A4,
        leftMargin=22 * mm, rightMargin=22 * mm,
        topMargin=20 * mm, bottomMargin=22 * mm,
        title="HomeBuild - Data & Response Contract",
        author="HomeBuild",
    ).build(story, onFirstPage=footer, onLaterPages=footer)
    print("wrote", out)
