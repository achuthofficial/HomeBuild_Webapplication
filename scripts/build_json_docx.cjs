/**
 * Builds docs/HomeBuild_JSON_Structures.docx — the JSON shapes only.
 *
 * Regenerate after changing supabase/schema.sql or src/api/*:
 *
 *     npm install --no-save docx
 *     node scripts/build_json_docx.cjs
 *
 * `docx` is deliberately NOT a dependency of this app — it builds a document,
 * not the product — so install it transiently, or point NODE_PATH at a copy
 * installed elsewhere. The .cjs extension is required: package.json sets
 * "type": "module", so a .js file here would be parsed as ESM and `require`
 * would throw.
 *
 * Transcribed from the schema's CHECK constraints and the mapper functions in
 * src/api/, so it describes what the code does. Where the two disagree, the
 * code is right and this file is stale.
 *
 * The prose companion — access model, RPC rules, per-role permissions — is
 * docs/HomeBuild_API_Contract.pdf. This file is deliberately shapes only.
 */

const fs = require('node:fs')
const path = require('node:path')
const {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  BorderStyle,
} = require('docx')

/* ── building blocks ─────────────────────────────────────────────────────── */

const children = []

/** Section heading. */
function h(text, level = HeadingLevel.HEADING_1) {
  children.push(
    new Paragraph({
      text,
      heading: level,
      spacing: { before: level === HeadingLevel.HEADING_1 ? 320 : 240, after: 120 },
    }),
  )
}

/** A label above a block — the table or function the JSON belongs to. */
function label(text) {
  children.push(
    new Paragraph({
      spacing: { before: 200, after: 60 },
      children: [
        new TextRun({ text, font: 'Courier New', size: 19, bold: true, color: '0058BE' }),
      ],
    }),
  )
}

/**
 * A JSON block, one Paragraph per line.
 *
 * docx has no newline inside a paragraph, and leading spaces have to survive
 * — the indentation is what makes a nested shape readable. Each line is its
 * own paragraph with the spaces intact in the run.
 */
function json(block) {
  const lines = block.replace(/^\n+|\n+$/g, '').split('\n')
  lines.forEach((line, i) => {
    children.push(
      new Paragraph({
        spacing: { before: i === 0 ? 40 : 0, after: i === lines.length - 1 ? 140 : 0 },
        indent: { left: 180 },
        children: [
          new TextRun({ text: line || ' ', font: 'Courier New', size: 17 }),
        ],
      }),
    )
  })
}

/* ── content ─────────────────────────────────────────────────────────────── */

children.push(
  new Paragraph({
    text: 'HomeBuild — JSON Structures',
    heading: HeadingLevel.TITLE,
    spacing: { after: 80 },
  }),
  new Paragraph({
    spacing: { after: 260 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: 'D9D9D9', space: 8 } },
    children: [
      new TextRun({
        text: 'Row shapes, response shapes, RPC payloads and permitted values.',
        size: 20,
        color: '666666',
      }),
    ],
  }),
)

/* ---------------------------------------------------------------- enums --- */
h('1. Permitted values')

json(`
{
  "profiles.role":              ["customer", "project_manager", "site_supervisor"],

  "projects.status":            ["lead", "in_design", "active",
                                 "paused", "completed", "cancelled"],
  "projects.timeline_status":   ["on_track", "ahead", "delayed", "at_risk"],
  "projects.budget_status":     ["on_budget", "review_required", "over_budget"],
  "projects.plot_facing":       ["North", "South", "East", "West"],
  "projects.total_floors":      ["G", "G+1", "G+2", "G+3"],
  "projects.bhk_per_floor":     { "type": "integer", "min": 1,  "max": 4 },
  "projects.progress_pct":      { "type": "integer", "min": 0,  "max": 100 },

  "project_members.role":       ["creator", "manager", "customer", "member"],

  "milestones.status":          ["upcoming", "pending_verification",
                                 "approved", "paid"],

  "ai_alerts.severity":         ["Low", "Medium", "High", "Critical"],
  "ai_alerts.status":           ["new", "acknowledged", "assigned",
                                 "resolved", "false_positive"],
  "ai_alerts.confidence":       { "type": "numeric", "min": 0, "max": 1 },

  "site_updates.status":        ["in_progress", "done", "blocked"],

  "schedule_phases.status":     ["done", "in_progress", "critical",
                                 "delayed", "queued", "on_hold"],

  "contractors.kind":           ["internal", "sub"],
  "contractors.rating":         { "type": "numeric", "min": 0, "max": 5 },
  "contractors.score":          { "type": "integer", "min": 0, "max": 100 },

  "floor_plans.variant":        ["A", "B", "C"],
  "floor_plans.vastu_score":    { "type": "numeric", "min": 0, "max": 10 },
  "floor_plans.efficiency_score": { "type": "numeric", "min": 0, "max": 10 },

  "invitations.status":         ["pending", "accepted", "revoked", "expired"],

  "activity_log.entity->action": {
    "project":    ["created", "status_changed", "progress_updated"],
    "milestone":  ["status_changed", "second_approved"],
    "alert":      ["status_changed"],
    "floor_plan": ["selected"],
    "schedule":   ["forecast_applied"],
    "account":    ["claimed_demo"]
  },

  "ui.tone": ["success", "warning", "danger", "violet",
              "info", "orange", "brand", "neutral", "none"],

  "_money": "every *_amount / budget_* / cost column is whole rupees, integer"
}
`)

/* ----------------------------------------------------------------- rows --- */
h('2. Row shapes (database)')

label('profiles')
json(`
{
  "firebase_uid": "T2mQ...z9",
  "full_name":    "Manish Kumar",
  "email":        "manish@example.com",
  "phone":        "+91 98450 11223",
  "job_title":    "Senior Project Manager",
  "role":         "project_manager",
  "avatar_url":   "https://.../avatars/T2mQ...z9/avatar.jpg?v=1757",
  "created_at":   "2026-02-11T09:04:22.114Z",
  "updated_at":   "2026-09-01T17:20:03.882Z"
}
`)

label('projects')
json(`
{
  "id":                  "11111111-1111-4111-8111-000000000001",
  "name":                "Sky Villa 42",
  "client_name":         "Global Ventures Inc.",
  "customer_uid":        "T2mQ...z9",
  "manager_uid":         "K9xd...a1",
  "status":              "active",
  "city":                "Bengaluru",
  "plot_address":        "42 Whitefield Main Rd, Bengaluru 560066",
  "plot_lat":            12.976750,
  "plot_lng":            77.575210,
  "plot_length_ft":      60,
  "plot_width_ft":       40,
  "plot_facing":         "East",
  "total_floors":        "G+2",
  "bhk_per_floor":       3,
  "budget_total":        12450000,
  "budget_consumed":     8466000,
  "progress_pct":        65,
  "budget_status":       "on_budget",
  "timeline_status":     "on_track",
  "start_date":          "2026-01-15",
  "expected_completion": "2026-09-01",
  "actual_completion":   null,
  "created_at":          "2026-01-04T06:12:00.000Z",
  "updated_at":          "2026-09-05T11:41:38.201Z"
}
`)

label('project_members')
json(`
{
  "project_id": "11111111-1111-4111-8111-000000000001",
  "member_uid": "T2mQ...z9",
  "role":       "creator"
}
`)

label('milestones')
json(`
{
  "id":                    "44444444-4444-4444-8444-000000000001",
  "project_id":            "11111111-1111-4111-8111-000000000001",
  "sequence":              1,
  "name":                  "Foundation Complete",
  "contractor_id":         "33333333-3333-4333-8333-000000000005",
  "release_pct":           18.00,
  "release_amount":        2241000,
  "due_date":              "2026-10-12",
  "status":                "pending_verification",
  "verification_criteria": "Sub-structure cast, PM site inspection passed",
  "pm_verified_at":        null,
  "pm_verified_by":        null,
  "customer_approved_at":  null,
  "customer_approved_by":  null,
  "second_approval_at":    null,
  "second_approver_uid":   null,
  "paid_at":               null,
  "payment_txn_id":        null,
  "cost_category_id":      "aaaaaaaa-0000-4000-8000-000000000001",
  "created_at":            "2026-01-04T06:12:01.000Z",
  "updated_at":            "2026-01-04T06:12:01.000Z"
}
`)

label('ai_alerts')
json(`
{
  "id":                "77777777-7777-4777-8777-000000000001",
  "project_id":        "11111111-1111-4111-8111-000000000011",
  "source_update_id":  "66666666-6666-4666-8666-000000000001",
  "category":          "Rebar spacing mismatch",
  "severity":          "Critical",
  "confidence":        0.920,
  "description":       "Bar spacing of 210mm against a specified 150mm.",
  "location_text":     "Vertical columns, Level 4 East",
  "location_in_photo": null,
  "status":            "new",
  "assigned_to":       null,
  "detected_at":       "2026-10-24T03:43:00.000Z",
  "resolved_at":       null,
  "resolution_photo":  null,
  "created_at":        "2026-10-24T03:43:00.000Z"
}
`)

label('site_updates')
json(`
{
  "id":               "66666666-6666-4666-8666-000000000001",
  "project_id":       "11111111-1111-4111-8111-000000000001",
  "supervisor_uid":   "S4pl...m2",
  "work_category":    "Slab Casting",
  "location_on_site": "East Wing, Level 4",
  "notes":            "Concrete pour underway. Slump tests returned 105mm.",
  "status":           "in_progress",
  "milestone_id":     null,
  "workers_present":  24,
  "materials_used":   "40 bags OPC, 2 t steel",
  "client_token":     null,
  "uploaded_at":      "2026-10-24T03:45:00.000Z",
  "created_at":       "2026-10-24T03:45:00.000Z"
}
`)

label('site_update_photos')
json(`
{
  "id":             "88888888-8888-4888-8888-000000000001",
  "site_update_id": "66666666-6666-4666-8666-000000000001",
  "storage_path":   "<site_update_id>/<uploader_uid>/k2m9x-a7f3.jpg",
  "caption":        null,
  "uploaded_by":    "S4pl...m2",
  "created_at":     "2026-10-24T03:46:11.000Z"
}
`)

label('schedule_phases')
json(`
{
  "id":                  "55555555-5555-4555-8555-000000000003",
  "project_id":          "11111111-1111-4111-8111-000000000001",
  "sequence":            3,
  "name":                "Rebar Reinforcement",
  "phase_group":         "1. Foundations",
  "baseline_start_week": 2.40,
  "baseline_end_week":   3.40,
  "actual_start_week":   2.50,
  "actual_end_week":     3.40,
  "forecast_start_week": 3.40,
  "forecast_end_week":   4.25,
  "cost":                620000,
  "status":              "delayed",
  "delay_days":          4,
  "delay_cause":         "Material delay",
  "delay_cost_impact":   85000,
  "delay_recoverable":   true,
  "created_at":          "2026-01-04T06:12:02.000Z"
}
`)

label('expenses')
json(`
{
  "id":           "eeeeeeee-0000-4000-8000-000000000001",
  "project_id":   "11111111-1111-4111-8111-000000000001",
  "category_id":  "aaaaaaaa-0000-4000-8000-000000000001",
  "milestone_id": null,
  "amount":       2850000,
  "incurred_on":  "2026-06-12",
  "vendor":       "Sharma Constructions",
  "note":         "RMC and steel, ground floor slab",
  "created_by":   "K9xd...a1",
  "created_at":   "2026-06-12T10:02:00.000Z"
}
`)

label('cost_categories')
json(`
{
  "id":         "aaaaaaaa-0000-4000-8000-000000000001",
  "project_id": "11111111-1111-4111-8111-000000000001",
  "label":      "Civil & Structural",
  "pct":        48.00,
  "tone":       "brand",
  "sequence":   1,
  "budgeted":   5976000,
  "created_at": "2026-01-04T06:12:03.000Z"
}
`)

label('budget_entries')
json(`
{
  "id":         "bbbbbbbb-0000-4000-8000-000000000001",
  "project_id": "11111111-1111-4111-8111-000000000001",
  "period":     "2026-08-01",
  "amount":     5720000,
  "created_at": "2026-01-04T06:12:04.000Z"
}
`)

label('contractors')
json(`
{
  "id":            "33333333-3333-4333-8333-000000000001",
  "code":          "CON-8842",
  "name":          "Skyline Technologies",
  "initials":      "ST",
  "trade":         "ELECTRICAL",
  "rating":        4.5,
  "score":         96,
  "kind":          "sub",
  "score_history": [62, 68, 65, 74, 79, 77, 86, 92, 96],
  "compliance_ok": true,
  "created_at":    "2026-01-02T00:00:00.000Z"
}
`)

label('contractor_assignments')
json(`
{
  "contractor_id": "33333333-3333-4333-8333-000000000001",
  "project_id":    "11111111-1111-4111-8111-000000000001"
}
`)

label('floor_plans')
json(`
{
  "id":                  "22222222-2222-4222-8222-000000000001",
  "project_id":          "11111111-1111-4111-8111-000000000001",
  "variant":             "A",
  "name":                "Symmetrical Classic",
  "vastu_score":         9.2,
  "efficiency_score":    8.4,
  "total_sqft":          2400,
  "cost_per_sqft":       1850,
  "total_cost":          4440000,
  "highlights":          ["North-east pooja placement",
                          "Cross-ventilated living",
                          "Wide 6ft staircase"],
  "vastu_notes":         "Kitchen in the south-east; master bedroom south-west.",
  "room_layout": {
    "floors": [{
      "name": "Ground Floor",
      "rooms": [
        { "name": "Kitchen", "x": 38.0, "y": 26.0, "width": 12.0, "height": 10.0 }
      ]
    }],
    "vastuFindings": [{
      "room":      "Kitchen",
      "zone":      "SE",
      "zoneName":  "South-East (Agni)",
      "compliant": true,
      "expected":  "South-East (Agni)",
      "note":      "Agni (fire) corner",
      "weight":    3
    }]
  },
  "validation": {
    "checks": [
      { "id": "boundary", "label": "Every room fits inside the plot",
        "passed": true,  "detail": null },
      { "id": "overlap",  "label": "No two rooms overlap",
        "passed": true,  "detail": null },
      { "id": "far",      "label": "Built-up area is 60-80% of plot x floors",
        "passed": true,  "detail": "64% (1536 of 2400 sq ft)" },
      { "id": "cost",     "label": "Rate is within the Mid band",
        "passed": true,  "detail": "1850/sq ft against 1800-2100" },
      { "id": "vastu",    "label": "Vastu score is at least 7/10",
        "passed": true,  "detail": "9.2/10" }
    ],
    "passed":      true,
    "builtUpArea": 1536,
    "far":         0.64
  },
  "is_selected":         true,
  "parking_spots":       2,
  "architectural_style": "Contemporary",
  "budget_tier":         "Mid",
  "vastu_required":      true,
  "extra_spaces":        ["Study", "Balcony"],
  "created_at":          "2026-01-05T08:00:00.000Z"
}
`)

label('invitations')
json(`
{
  "id":          "cccccccc-0000-4000-8000-000000000001",
  "email":       "rekha@example.com",
  "role":        "project_manager",
  "project_id":  null,
  "invited_by":  "K9xd...a1",
  "status":      "pending",
  "token":       "9f1c0b2e-5a44-4d3f-9c21-77b0e2a1d004",
  "expires_at":  "2026-09-13T11:00:00.000Z",
  "accepted_at": null,
  "created_at":  "2026-09-06T11:00:00.000Z"
}
`)

label('activity_log')
json(`
{
  "id":         "dddddddd-0000-4000-8000-000000000001",
  "project_id": "11111111-1111-4111-8111-000000000001",
  "actor_uid":  "K9xd...a1",
  "entity":     "milestone",
  "entity_id":  "44444444-4444-4444-8444-000000000001",
  "action":     "status_changed",
  "summary":    "Milestone \\u201cFoundation Complete\\u201d moved to approved",
  "detail":     null,
  "created_at": "2026-09-05T11:41:38.201Z"
}
`)

/* ------------------------------------------------------------ responses --- */
h('3. Response shapes (src/api)')

label('listProjects() / getProject(id)')
json(`
[{
  "id":             "11111111-1111-4111-8111-000000000001",
  "name":           "Sky Villa 42",
  "client":         "Global Ventures Inc.",
  "city":           "Bengaluru",
  "manager":        "Manish Kumar",
  "managerUid":     "K9xd...a1",
  "status":         "active",
  "progress":       65,
  "budgetTotal":    12450000,
  "budgetConsumed": 8466000,
  "budgetStatus":   { "label": "On Budget", "tone": "success" },
  "timeline":       { "label": "On Track",  "tone": "success" },
  "timelineKey":    "on_track",
  "estimate":       "2026-09-01",
  "startDate":      "2026-01-15",
  "team":           ["https://.../a.jpg", "https://.../b.jpg"],
  "teamNames":      ["Manish Kumar", "Rekha Gupta", "Dhawan Singh"],
  "extraTeam":      0
}]
`)

label('listProjectFilters()')
json(`
{
  "status":  ["All Projects", "On Track", "Delayed", "At Risk", "Ahead"],
  "city":    ["All Locations", "Bengaluru", "Chennai", "Hyderabad", "Mumbai"],
  "manager": ["All Managers", "Manish Kumar", "Priya Raman", "Rekha Gupta"]
}
`)

label('listProjectMembers(projectId)')
json(`
[{
  "uid":         "T2mQ...z9",
  "projectRole": "creator",
  "name":        "Manish Kumar",
  "email":       "manish@example.com",
  "persona":     "project_manager",
  "avatar":      "https://.../avatar.jpg",
  "initials":    "MK"
}]
`)

label('getDashboardKpis()')
json(`
{
  "activeProjects":   12,
  "delayed":          2,
  "openAlerts":       124,
  "pendingApprovals": 2,
  "budgetHealth":     43
}
`)

label('getStatusOverview(limit)')
json(`
[{
  "id":       "11111111-1111-4111-8111-000000000009",
  "name":     "The Pines Sub-Division",
  "progress": 95,
  "label":    "95% Complete",
  "tone":     "success",
  "team":     ["https://.../a.jpg"]
}]
`)

label('getRecentUpdates(limit)')
json(`
[{
  "id":        "66666666-6666-4666-8666-000000000001",
  "dot":       "brand",
  "time":      "2026-10-24T03:45:00.000Z",
  "site":      "SKY VILLA 42",
  "title":     "Slab Casting — East Wing, Level 4",
  "body":      "Concrete pour underway. Slump tests returned 105mm.",
  "author":    "Dhawan Singh",
  "photoPath": "<site_update_id>/<uploader_uid>/k2m9x-a7f3.jpg"
}]
`)

label('getFinanceSummary(projectId)')
json(`
{
  "projectName": "Sky Villa 42",
  "total":       12450000,
  "consumed":    8466000,
  "remaining":   3984000,
  "consumedPct": 68
}
`)

label('getBudgetTrend(projectId, months)')
json(`
[
  { "month": "JAN", "value": 1180000 },
  { "month": "FEB", "value": 1420000 },
  { "month": "MAR", "value": 1390000 }
]
`)

label('getCostCategories(projectId)')
json(`
{
  "uncategorised": 0,
  "categories": [{
    "id":       "aaaaaaaa-0000-4000-8000-000000000001",
    "label":    "Civil & Structural",
    "value":    48,
    "tone":     "brand",
    "budgeted": 5976000,
    "spent":    4090000,
    "usedPct":  68,
    "over":     false
  }]
}
`)

label('listExpenses(projectId, limit)')
json(`
[{
  "id":       "eeeeeeee-0000-4000-8000-000000000001",
  "amount":   2850000,
  "date":     "2026-06-12",
  "vendor":   "Sharma Constructions",
  "note":     "RMC and steel, ground floor slab",
  "category": "Civil & Structural",
  "isEscrow": false
}]
`)

label('listMilestones(projectId)')
json(`
[{
  "id":                  "44444444-4444-4444-8444-000000000001",
  "milestone":           "Foundation Complete",
  "contractor":          "SteelWorks Co.",
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
  "needsSecondApproval": true,
  "secondApprovedAt":    null,
  "simulated":           false
}]
`)

label('listAlerts({ severity, status, page })')
json(`
{
  "alerts": [{
    "id":         "77777777-7777-4777-8777-000000000001",
    "type":       "Rebar spacing mismatch",
    "location":   "Vertical columns, Level 4 East",
    "severity":   "Critical",
    "confidence": 92,
    "project":    "Grand Sky Plaza",
    "detected":   "2026-10-24T03:43:00.000Z",
    "resolved":   false,
    "status":     "new"
  }],
  "total":      124,
  "totalPages": 13
}
`)

label('getAlertKpis()')
json(`
{
  "activeCritical": 18,
  "mediumRisks":    31,
  "aiConfidence":   "84.2%"
}
`)

label('listOpenFindings(projectId, limit)')
json(`
[{
  "id":       "77777777-7777-4777-8777-000000000001",
  "title":    "Rebar spacing mismatch",
  "severity": "Critical",
  "body":     "Bar spacing of 210mm against a specified 150mm.",
  "location": "Vertical columns, Level 4 East"
}]
`)

label('listFeedEntries({ projectId, category })')
json(`
[{
  "id":             "66666666-6666-4666-8666-000000000001",
  "projectId":      "11111111-1111-4111-8111-000000000001",
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
    "id":      "88888888-8888-4888-8888-000000000001",
    "path":    "<site_update_id>/<uploader_uid>/k2m9x-a7f3.jpg",
    "caption": null,
    "url":     "https://...signed...&token=eyJ..."
  }],
  "uploadSlots": 2
}]
`)

label('getActivityBreakdown(projectId)')
json(`
[
  { "label": "Slab Casting",     "value": 45, "tone": "success" },
  { "label": "MEP Installation", "value": 28, "tone": "brand" },
  { "label": "Electrical",       "value": 17, "tone": "violet" },
  { "label": "Others",           "value": 10, "tone": "neutral" }
]
`)

label('getSchedule(projectId)')
json(`
{
  "groups": [{
    "id":          "1-foundations",
    "name":        "1. Foundations",
    "defaultOpen": true,
    "baseline":    { "start": 0, "end": 3.4 },
    "tasks": [{
      "id":                "55555555-5555-4555-8555-000000000003",
      "name":              "Rebar Reinforcement",
      "badge":             { "label": "DELAYED", "tone": "danger" },
      "bar":               { "start": 2.5, "end": 3.4, "tone": "danger" },
      "forecast":          { "start": 3.4, "end": 4.25 },
      "flag":              "+4 Days",
      "cost":              620000,
      "status":            "delayed",
      "delayDays":         4,
      "delayCause":        "Material delay",
      "delayCostImpact":   85000,
      "delayRecoverable":  true
    }]
  }],
  "months":         [{ "label": "JANUARY 2026", "weeks": ["W1", "W2", "W3"] }],
  "today":          { "offset": 2.45, "label": "TODAY: OCT 18" },
  "totalDelayDays": 4,
  "phaseCount":     9
}
`)

label('getScheduleSidebar(projectId)')
json(`
{
  "health": {
    "value":         65,
    "caption":       "Behind baseline on at least one phase",
    "onTrack":       false,
    "nextMilestone": "Foundation Complete",
    "daysRemaining": 36,
    "overdue":       false,
    "phasesDone":    1,
    "phaseCount":    9
  },
  "workforce": {
    "trades":   [{ "label": "Slab Casting", "value": 24 }],
    "total":    24,
    "reported": true
  }
}
`)

label('getDelayAnalysis(projectId)')
json(`
{
  "phases": [{
    "id":          "55555555-5555-4555-8555-000000000003",
    "name":        "Rebar Reinforcement",
    "status":      "delayed",
    "days":        4,
    "weeks":       0.6,
    "cause":       "Material delay",
    "costImpact":  85000,
    "recoverable": true
  }],
  "totalWeeks":       0.6,
  "totalCost":        85000,
  "recoverableWeeks": 0.6
}
`)

label('listContractors({ tab, trade, minRating })')
json(`
[{
  "id":             "33333333-3333-4333-8333-000000000001",
  "code":           "CON-8842",
  "name":           "Skyline Technologies",
  "initials":       "ST",
  "trade":          "ELECTRICAL",
  "rating":         4.5,
  "score":          96,
  "scoreTone":      "success",
  "kind":           "sub",
  "history":        [62, 68, 65, 74, 79, 77, 86, 92, 96],
  "historyTone":    "success",
  "activeProjects": ["SV", "TN"],
  "extraProjects":  0,
  "complianceOk":   true
}]
`)

label('getContractorKpis()')
json(`
{
  "activeWorkforce": 6,
  "avgPerformance":  "86.0%",
  "complianceRate":  "83%"
}
`)

label('listTeamMembers(ownerUid)')
json(`
[{
  "inviteId": "cccccccc-0000-4000-8000-000000000001",
  "id":       "T2mQ...z9",
  "name":     "Rekha Gupta",
  "email":    "rekha@example.com",
  "role":     "Lead Architect",
  "status":   "ACTIVE",
  "joined":   true,
  "avatar":   "https://.../avatar.jpg",
  "initials": "RG"
}]
`)

label('getProfileStats(uid)')
json(`
{
  "activeProjects": 12,
  "teamsLed":       4
}
`)

label('globalSearch(query)')
json(`
{
  "term": "harbor",
  "groups": [{
    "key":      "projects",
    "labelKey": "search.projects",
    "items": [{
      "id":     "11111111-1111-4111-8111-000000000002",
      "title":  "Harbor Heights",
      "detail": "Beacon Properties Ltd. · Mumbai",
      "to":     "/projects"
    }]
  }],
  "total": 1
}
`)

label('listActivity({ projectId, actorUid, limit })')
json(`
[{
  "id":          "dddddddd-0000-4000-8000-000000000001",
  "entity":      "milestone",
  "action":      "status_changed",
  "summary":     "Milestone \\u201cFoundation Complete\\u201d moved to approved",
  "at":          "2026-09-05T11:41:38.201Z",
  "actor":       "Manish Kumar",
  "actorAvatar": "https://.../avatar.jpg",
  "project":     "Sky Villa 42"
}]
`)

/* ------------------------------------------------------------------ rpc --- */
h('4. RPC payloads')

label('create_project  — request')
json(`
{
  "p_project": {
    "name":                "Sharma Residence",
    "client_name":         "Rajesh Sharma",
    "customer_uid":        "T2mQ...z9",
    "manager_uid":         "K9xd...a1",
    "status":              "lead",
    "city":                "Bengaluru",
    "plot_address":        "Survey 88, Sarjapur Rd",
    "plot_lat":            "12.976750",
    "plot_lng":            "77.575210",
    "plot_length_ft":      "60",
    "plot_width_ft":       "40",
    "plot_facing":         "East",
    "total_floors":        "G+1",
    "bhk_per_floor":       "2",
    "budget_total":        "5000000",
    "start_date":          "2026-01-01",
    "expected_completion": "2027-01-01"
  }
}
`)
label('create_project  — response (a projects row)')
json(`
{ "id": "...", "name": "Sharma Residence", "status": "lead", "...": "..." }
`)

label('advance_milestone  — request / response')
json(`
{ "p_milestone_id": "44444444-...-000000000001",
  "p_next_status":  "approved" }

// -> the updated milestones row
`)

label('second_approve_milestone  — request / response')
json(`
{ "p_milestone_id": "44444444-...-000000000001" }

// -> the updated milestones row
`)

label('resolve_alert  — request / response')
json(`
{ "p_alert_id":    "77777777-...-000000000001",
  "p_next_status": "acknowledged",
  "p_assignee":    null }

// -> the updated ai_alerts row
`)

label('apply_schedule_forecast  — request / response')
json(`
{ "p_project_id": "11111111-...-000000000001" }

// -> 7        (integer: how many phases shifted)
`)

label('select_floor_plan  — request / response')
json(`
{ "p_plan_id": "22222222-...-000000000001" }

// -> the updated floor_plans row
`)

label('claim_demo_projects  — request / response')
json(`
{}

// -> 12       (integer: projects joined)
`)

label('dashboard_kpis  — response')
json(`
[{
  "active_projects":   12,
  "delayed_projects":  2,
  "open_alerts":       124,
  "pending_approvals": 2,
  "budget_health_pct": 43
}]
`)

/* ---------------------------------------------------------------- roles --- */
h('5. The same call, by role')

label('GET /projects  — Manish (projects.manager_uid)')
json(`
[
  { "id": "1111...0001", "name": "Sky Villa 42",           "...": "..." },
  { "id": "1111...0003", "name": "The Nexus Hub",          "...": "..." },
  { "id": "1111...0006", "name": "Silver Oak Residences",  "...": "..." }
]
`)

label('GET /projects  — Rajesh (projects.customer_uid)')
json(`
[
  { "id": "1111...0001", "name": "Sky Villa 42", "...": "..." }
]
`)

label('GET /projects  — Dhawan (project_members row)')
json(`
[
  { "id": "1111...0001", "name": "Sky Villa 42",       "...": "..." },
  { "id": "1111...0004", "name": "Oak Creek Estates",  "...": "..." }
]
`)

label('GET /projects  — Priya (no relationship to any project)')
json(`
[]
`)

label('Access rule that produces the four results above')
json(`
{
  "has_project_access": ["projects.manager_uid  == you",
                         "projects.customer_uid == you",
                         "project_members.member_uid == you"],
  "is_project_manager": ["projects.manager_uid  == you"],
  "_note": "profiles.role appears in no policy; it grants nothing"
}
`)

/* ---------------------------------------------------------------- error --- */
h('6. Error shape')

json(`
{
  "42P01":   "The database tables are missing. Run supabase/schema.sql, then seed.sql.",
  "42501":   "You do not have permission to read this. Check that Firebase is
              registered as a third-party auth provider in Supabase.",
  "23505":   "That person is already on this project."  /* or */
             "There is already a pending invitation for that address.",
  "network": "Could not reach the database. Check your connection.",
  "_other":  "<message> (<code>)"
}
`)

/* ── write ───────────────────────────────────────────────────────────────── */

const doc = new Document({
  creator: 'HomeBuild',
  title: 'HomeBuild — JSON Structures',
  styles: {
    default: {
      document: { run: { font: 'Calibri', size: 21 } },
      heading1: {
        run: { font: 'Calibri', size: 28, bold: true, color: '0F172A' },
        paragraph: { spacing: { before: 340, after: 140 } },
      },
      title: {
        run: { font: 'Calibri', size: 44, bold: true, color: '0F172A' },
      },
    },
  },
  sections: [
    {
      properties: {
        page: { margin: { top: 1000, bottom: 1000, left: 1000, right: 1000 } },
      },
      children,
    },
  ],
})

const out = path.join('docs', 'HomeBuild_JSON_Structures.docx')
fs.mkdirSync('docs', { recursive: true })
Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync(out, buf)
  console.log('wrote', out, `(${children.length} paragraphs)`)
})
