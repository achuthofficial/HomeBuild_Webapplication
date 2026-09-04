-- =============================================================================
-- HomeBuild — seed data
--
-- Dummy data mirroring the fixtures the UI used to compile in, so every screen
-- looks the same after the switch to live data. Figures follow the PRD's Indian
-- market framing: rupees, lakh/crore magnitudes, Indian cities and names.
--
-- Safe to re-run: everything is keyed on stable ids and upserted.
-- Run AFTER schema.sql.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- People
--
-- These are placeholder rows so team stacks and assignments have something to
-- point at. A real user's row is created on first sign-in by the app, keyed on
-- their actual Firebase UID — these seeded uids are deliberately prefixed
-- `seed-` so they can never collide with one.
-- -----------------------------------------------------------------------------
insert into public.profiles (firebase_uid, full_name, email, phone, job_title, role) values
  ('seed-manish',  'Manish Kumar',   'manish@homebuild.example',  '+91 64589 40458', 'Senior Project Manager', 'project_manager'),
  ('seed-rekha',   'Rekha Gupta',    'rekha@homebuild.example',   '+91 98450 11223', 'Lead Architect',         'project_manager'),
  ('seed-dhawan',  'Dhawan Singh',   'dhawan@homebuild.example',  '+91 99001 55447', 'Site Supervisor',        'site_supervisor'),
  ('seed-priya',   'Priya Raman',    'priya@homebuild.example',   '+91 90360 77812', 'Project Manager',        'project_manager'),
  ('seed-rajesh',  'Rajesh Sharma',  'rajesh@example.com',        '+91 98111 20304', 'Homeowner',              'customer'),
  ('seed-mohammed','Mohammed Ali',   'mohammed@homebuild.example','+91 97401 88213', 'Site Supervisor',        'site_supervisor')
on conflict (firebase_uid) do update
  set full_name = excluded.full_name,
      job_title = excluded.job_title,
      role      = excluded.role;

-- -----------------------------------------------------------------------------
-- Projects
--
-- Twelve, matching the "12 active construction sites" the portfolio claims.
-- Fixed uuids so the seed is idempotent and so schedule/finance rows below can
-- reference them without a lookup.
-- -----------------------------------------------------------------------------
insert into public.projects (
  id, name, client_name, customer_uid, manager_uid, status, city,
  plot_address, plot_length_ft, plot_width_ft, plot_facing, total_floors, bhk_per_floor,
  budget_total, budget_consumed, progress_pct, budget_status, timeline_status,
  start_date, expected_completion
) values
  ('11111111-1111-4111-8111-000000000001','Sky Villa 42','Global Ventures Inc.','seed-rajesh','seed-manish','active','Bengaluru',
   '42 Whitefield Main Rd, Bengaluru 560066', 60, 40, 'East','G+2', 3,
   12450000, 8466000, 65, 'on_budget','on_track','2026-01-15','2026-09-01'),

  ('11111111-1111-4111-8111-000000000002','Harbor Heights','Beacon Properties Ltd.',null,'seed-rekha','active','Mumbai',
   '7 Carter Rd, Bandra West, Mumbai 400050', 50, 30, 'West','G+3', 2,
   18600000, 7100000, 32, 'review_required','delayed','2026-02-01','2026-12-01'),

  ('11111111-1111-4111-8111-000000000003','The Nexus Hub','Urban Catalyst Partners',null,'seed-manish','active','Hyderabad',
   '19 Gachibowli Rd, Hyderabad 500032', 80, 50, 'North','G+2', 4,
   24200000, 20100000, 88, 'on_budget','ahead','2025-08-10','2026-07-01'),

  ('11111111-1111-4111-8111-000000000004','Oak Creek Estates','Residential Core LLC',null,'seed-dhawan','active','Pune',
   '3 Baner Rd, Pune 411045', 45, 30, 'South','G+1', 2,
   9800000, 1150000, 12, 'on_budget','at_risk','2026-06-01','2027-01-01'),

  ('11111111-1111-4111-8111-000000000005','Summit View','Aspen Ridge Dev.',null,'seed-rekha','active','Bengaluru',
   '11 Sarjapur Rd, Bengaluru 560035', 55, 35, 'East','G+2', 3,
   14100000, 6200000, 45, 'on_budget','on_track','2026-03-20','2026-11-01'),

  ('11111111-1111-4111-8111-000000000006','Silver Oak Residences','Meridian Housing',null,'seed-manish','active','Chennai',
   '24 OMR, Thoraipakkam, Chennai 600097', 60, 40, 'North','G+2', 3,
   16400000, 13100000, 82, 'on_budget','on_track','2025-11-05','2026-10-01'),

  ('11111111-1111-4111-8111-000000000007','Skyline Corporate Hub','Vertex Realty',null,'seed-priya','active','Bengaluru',
   '90 Hosur Rd, Bengaluru 560068', 70, 45, 'West','G+3', 4,
   21500000, 9300000, 45, 'on_budget','on_track','2026-02-14','2026-12-15'),

  ('11111111-1111-4111-8111-000000000008','Harbor View Apartments','Beacon Properties Ltd.',null,'seed-rekha','active','Mumbai',
   '5 Worli Sea Face, Mumbai 400018', 48, 32, 'West','G+3', 2,
   19900000, 8800000, 32, 'review_required','delayed','2026-01-20','2026-11-20'),

  ('11111111-1111-4111-8111-000000000009','The Pines Sub-Division','Everline Group',null,'seed-manish','active','Pune',
   '17 Wakad Rd, Pune 411057', 65, 42, 'North','G+1', 3,
   11200000, 10300000, 95, 'on_budget','ahead','2025-09-01','2026-08-01'),

  ('11111111-1111-4111-8111-000000000010','Riverview Residency','Kaveri Estates',null,'seed-priya','active','Hyderabad',
   '8 Kondapur Main Rd, Hyderabad 500084', 52, 34, 'East','G+2', 3,
   13800000, 5000000, 38, 'on_budget','on_track','2026-04-02','2027-02-01'),

  ('11111111-1111-4111-8111-000000000011','Grand Sky Plaza','Northwind Developers',null,'seed-dhawan','active','Chennai',
   '61 ECR, Chennai 600115', 75, 48, 'South','G+3', 4,
   26400000, 12900000, 49, 'on_budget','on_track','2026-01-08','2027-03-01'),

  ('11111111-1111-4111-8111-000000000012','Terminal 5 Expansion','Aster Infra',null,'seed-priya','completed','Bengaluru',
   '2 Devanahalli Rd, Bengaluru 562110', 90, 60, 'North','G+2', 4,
   30100000, 29500000, 100, 'on_budget','on_track','2025-02-01','2026-05-01')
on conflict (id) do update
  set budget_consumed = excluded.budget_consumed,
      progress_pct    = excluded.progress_pct,
      timeline_status = excluded.timeline_status,
      budget_status   = excluded.budget_status;

-- Team membership → the avatar stacks on portfolio cards.
insert into public.project_members (project_id, member_uid) values
  ('11111111-1111-4111-8111-000000000001','seed-manish'),
  ('11111111-1111-4111-8111-000000000001','seed-rekha'),
  ('11111111-1111-4111-8111-000000000001','seed-dhawan'),
  ('11111111-1111-4111-8111-000000000002','seed-rekha'),
  ('11111111-1111-4111-8111-000000000002','seed-mohammed'),
  ('11111111-1111-4111-8111-000000000003','seed-manish'),
  ('11111111-1111-4111-8111-000000000005','seed-rekha'),
  ('11111111-1111-4111-8111-000000000005','seed-priya'),
  ('11111111-1111-4111-8111-000000000006','seed-manish'),
  ('11111111-1111-4111-8111-000000000006','seed-priya')
on conflict do nothing;

-- -----------------------------------------------------------------------------
-- Floor plans (PRD 8.2) — three variants for the flagship project
-- -----------------------------------------------------------------------------
insert into public.floor_plans (
  id, project_id, variant, name, vastu_score, efficiency_score,
  total_sqft, cost_per_sqft, total_cost, highlights, vastu_notes, is_selected
) values
  ('22222222-2222-4222-8222-000000000001','11111111-1111-4111-8111-000000000001','A','Symmetrical Classic',
   9.2, 8.4, 2400, 1850, 4440000,
   array['North-east pooja placement','Cross-ventilated living','Wide 6ft staircase'],
   'Kitchen in the south-east (Agni corner); master bedroom south-west; entrance faces east.', true),
  ('22222222-2222-4222-8222-000000000002','11111111-1111-4111-8111-000000000001','B','Open Plan',
   7.8, 9.1, 2520, 1790, 4510800,
   array['Open kitchen-living','Larger balconies','Fewer load-bearing walls'],
   'Open layout trades some Vastu alignment for usable area; north-east kept free.', false),
  ('22222222-2222-4222-8222-000000000003','11111111-1111-4111-8111-000000000001','C','Compact Efficient',
   8.6, 9.4, 2180, 1920, 4185600,
   array['Lowest total cost','Minimal circulation waste','Compact service core'],
   'Service core consolidated to the south; north-east light well retained.', false)
on conflict (id) do nothing;

-- -----------------------------------------------------------------------------
-- Contractors
-- -----------------------------------------------------------------------------
insert into public.contractors (id, code, name, initials, trade, rating, score, kind, score_history, compliance_ok) values
  ('33333333-3333-4333-8333-000000000001','CON-8842','Skyline Technologies','ST','ELECTRICAL',4.5,96,'sub',   '{62,68,65,74,79,77,86,92,96}', true),
  ('33333333-3333-4333-8333-000000000002','CON-2319','Apex Masonry Ltd.',   'AM','CIVIL',     4.0,82,'internal','{78,71,84,69,88,72,83,76,82}', true),
  ('33333333-3333-4333-8333-000000000003','CON-9021','Precision Piping Co.','PP','MECHANICAL',5.0,99,'sub',   '{70,74,73,80,84,88,91,95,99}', true),
  ('33333333-3333-4333-8333-000000000004','CON-1102','Vortex Zen Services', 'VZ','CLEANING',  3.0,64,'sub',   '{92,88,84,81,76,74,70,67,64}', false),
  ('33333333-3333-4333-8333-000000000005','CON-4457','SteelWorks Co.',      'SW','CIVIL',     4.5,90,'sub',   '{80,82,79,85,87,86,88,89,90}', true),
  ('33333333-3333-4333-8333-000000000006','CON-6610','Lumina Interiors',    'LI','PAINTING',  4.0,85,'internal','{72,75,77,79,81,80,83,84,85}', true)
on conflict (id) do update set score = excluded.score, rating = excluded.rating;

insert into public.contractor_assignments (contractor_id, project_id) values
  ('33333333-3333-4333-8333-000000000001','11111111-1111-4111-8111-000000000001'),
  ('33333333-3333-4333-8333-000000000001','11111111-1111-4111-8111-000000000003'),
  ('33333333-3333-4333-8333-000000000002','11111111-1111-4111-8111-000000000002'),
  ('33333333-3333-4333-8333-000000000003','11111111-1111-4111-8111-000000000001'),
  ('33333333-3333-4333-8333-000000000003','11111111-1111-4111-8111-000000000005'),
  ('33333333-3333-4333-8333-000000000004','11111111-1111-4111-8111-000000000001')
on conflict do nothing;

-- -----------------------------------------------------------------------------
-- Milestones — the Finance payments table, for Sky Villa 42
-- -----------------------------------------------------------------------------
insert into public.milestones (
  id, project_id, sequence, name, contractor_id, release_pct, release_amount, due_date, status
) values
  ('44444444-4444-4444-8444-000000000001','11111111-1111-4111-8111-000000000001',1,
   'Foundation Inspection Approval','33333333-3333-4333-8333-000000000005', 3.61,  450000,'2026-10-12','pending_verification'),
  ('44444444-4444-4444-8444-000000000002','11111111-1111-4111-8111-000000000001',2,
   'Ground Floor Slab Cast','33333333-3333-4333-8333-000000000002',        22.00, 2739000,'2026-10-28','upcoming'),
  ('44444444-4444-4444-8444-000000000003','11111111-1111-4111-8111-000000000001',3,
   'Structural Framing Complete','33333333-3333-4333-8333-000000000001',   15.00, 1867500,'2026-11-15','upcoming'),
  ('44444444-4444-4444-8444-000000000004','11111111-1111-4111-8111-000000000001',4,
   'Brick & Plaster Complete','33333333-3333-4333-8333-000000000002',      12.00, 1494000,'2026-12-06','approved'),
  -- A second project with a pending approval, so the dashboard KPI is not
  -- trivially 1.
  ('44444444-4444-4444-8444-000000000005','11111111-1111-4111-8111-000000000003',1,
   'Roof Slab Sign-off','33333333-3333-4333-8333-000000000005',            10.00, 2420000,'2026-10-20','pending_verification')
on conflict (id) do update set status = excluded.status;

-- -----------------------------------------------------------------------------
-- Schedule phases — PRD 5.4.2's 60-week template, positioned as week offsets
-- within the 12-column window the Gantt renders.
-- -----------------------------------------------------------------------------
insert into public.schedule_phases (
  id, project_id, sequence, name, phase_group,
  baseline_start_week, baseline_end_week, actual_start_week, actual_end_week,
  forecast_start_week, forecast_end_week, cost, status, delay_days
) values
  ('55555555-5555-4555-8555-000000000001','11111111-1111-4111-8111-000000000001',1,
   'Excavation Site A','1. Foundations',      0,    2.70, 0.15, 1.60, null, null,  250000,'done',0),
  ('55555555-5555-4555-8555-000000000002','11111111-1111-4111-8111-000000000001',2,
   'Concrete Pouring','1. Foundations',       1.50, 2.50, 1.55, 2.40, null, null,  850000,'critical',0),
  ('55555555-5555-4555-8555-000000000003','11111111-1111-4111-8111-000000000001',3,
   'Rebar Reinforcement','1. Foundations',    2.40, 3.40, 2.50, 3.40, 3.40, 4.25,  620000,'delayed',4),
  ('55555555-5555-4555-8555-000000000004','11111111-1111-4111-8111-000000000001',4,
   'Column Casting L1-L3','2. Structural Framing', 2.80, 4.60, 2.90, 4.60, null, null, 1400000,'in_progress',0),
  ('55555555-5555-4555-8555-000000000005','11111111-1111-4111-8111-000000000001',5,
   'Slab Casting Level 4','2. Structural Framing', 4.60, 6.20, null, null, null, null, 1400000,'queued',0),
  ('55555555-5555-4555-8555-000000000006','11111111-1111-4111-8111-000000000001',6,
   'HVAC Ducting - Level 2','3. MEP Installation', 5.40, 7.00, null, null, null, null, 1400000,'on_hold',0),
  ('55555555-5555-4555-8555-000000000007','11111111-1111-4111-8111-000000000001',7,
   'Electrical Conduit Runs','3. MEP Installation', 7.00, 9.10, null, null, null, null, 900000,'queued',0),
  ('55555555-5555-4555-8555-000000000008','11111111-1111-4111-8111-000000000001',8,
   'Internal Plastering','4. Interior Finishing',  9.10, 11.00, null, null, null, null, 500000,'queued',0),
  ('55555555-5555-4555-8555-000000000009','11111111-1111-4111-8111-000000000001',9,
   'Flooring & Tiling','4. Interior Finishing',   11.00, 12.00, null, null, null, null, 600000,'queued',0)
on conflict (id) do update set status = excluded.status, delay_days = excluded.delay_days;

-- -----------------------------------------------------------------------------
-- Finance — monthly spend, summing to the ₹84.66L consumed on Sky Villa 42
-- -----------------------------------------------------------------------------
insert into public.budget_entries (project_id, period, amount) values
  ('11111111-1111-4111-8111-000000000001','2026-01-01',1180000),
  ('11111111-1111-4111-8111-000000000001','2026-02-01',1420000),
  ('11111111-1111-4111-8111-000000000001','2026-03-01',1390000),
  ('11111111-1111-4111-8111-000000000001','2026-04-01',2650000),
  ('11111111-1111-4111-8111-000000000001','2026-05-01',2610000),
  ('11111111-1111-4111-8111-000000000001','2026-06-01',4180000),
  ('11111111-1111-4111-8111-000000000001','2026-07-01',3960000),
  ('11111111-1111-4111-8111-000000000001','2026-08-01',5720000)
on conflict (project_id, period) do update set amount = excluded.amount;

-- Category breakdown.
--
-- The seed used to invent its own three categories (Construction Materials /
-- Labor / Permits), which are not the PRD's. Every project now gets the 5.3.2
-- template from apply_project_templates, so the demo data and a real project
-- show the same six lines. The function fills only what a project is missing,
-- so the milestones and phases seeded above are left exactly as they are.
delete from public.cost_categories
where label in ('Construction Materials','Labor & Subcontracting','Permits & Legal');

do $$
declare p record;
begin
  for p in select id from public.projects loop
    perform public.apply_project_templates(p.id);
  end loop;
end $$;

-- A little spending, so the category bars and the trend have something real to
-- draw on the demo project rather than sitting at zero.
insert into public.expenses (project_id, category_id, amount, incurred_on, vendor, note)
select '11111111-1111-4111-8111-000000000001', c.id, e.amount, e.on_date, e.vendor, e.note
from (values
  ('Civil & Structural',      2850000, date '2026-06-12', 'Sharma Constructions',  'RMC and steel, ground floor slab'),
  ('Civil & Structural',      1240000, date '2026-07-08', 'Sharma Constructions',  'Blockwork, levels 1-2'),
  ('Electrical Works',         410000, date '2026-07-22', 'Sri Lakshmi Electricals','Conduit runs and DB'),
  ('Plumbing & Sanitation',    295000, date '2026-08-04', 'Kaveri Plumbing',       'CPVC lines and fixtures'),
  ('Architect & Consultants',  180000, date '2026-08-19', 'Rekha Gupta Associates','Structural review, stage 3')
) as e(label, amount, on_date, vendor, note)
join public.cost_categories c
  on c.project_id = '11111111-1111-4111-8111-000000000001' and c.label = e.label
where not exists (
  -- Only fill on a fresh database.
  select 1 from public.expenses
  where project_id = '11111111-1111-4111-8111-000000000001'
);

-- -----------------------------------------------------------------------------
-- Site updates + AI alerts
-- -----------------------------------------------------------------------------
insert into public.site_updates (
  id, project_id, supervisor_uid, work_category, location_on_site, notes, status, uploaded_at
) values
  ('66666666-6666-4666-8666-000000000001','11111111-1111-4111-8111-000000000001','seed-dhawan',
   'Slab Casting','East Wing, Level 4',
   'Concrete pour for the East Wing Level 4 slab is underway. Slump tests returned 105mm, within specification. Rebar inspection completed at 07:00. Pumping rate maintained at 45m³/hour.',
   'in_progress','2026-10-24 09:15:00+05:30'),
  ('66666666-6666-4666-8666-000000000002','11111111-1111-4111-8111-000000000001','seed-mohammed',
   'MEP Installation','Level 2, Central Corridor',
   'Installation of main ducts suspended due to clash with newly revised structural beam dimensions. Waiting for updated CAD files from the engineering team to resolve the 150mm overlap.',
   'blocked','2026-10-23 14:30:00+05:30'),
  ('66666666-6666-4666-8666-000000000003','11111111-1111-4111-8111-000000000006','seed-dhawan',
   'Electrical','Zone 3, Interior',
   'Zone 3 interior wiring verified against code. Ready for drywall team.',
   'done','2026-10-24 08:12:00+05:30')
on conflict (id) do nothing;

-- Four detailed alerts, then bulk filler so the pager has real pages behind it.
insert into public.ai_alerts (
  id, project_id, source_update_id, category, severity, confidence,
  description, location_text, status, detected_at
) values
  ('77777777-7777-4777-8777-000000000001','11111111-1111-4111-8111-000000000011','66666666-6666-4666-8666-000000000001',
   'Rebar spacing mismatch','Critical',0.920,
   'Detected bar spacing of 210mm against a specified 150mm across the column cage.',
   'Vertical columns, Level 4 East','new','2026-10-24 09:13:00+05:30'),
  ('77777777-7777-4777-8777-000000000002','11111111-1111-4111-8111-000000000010',null,
   'Concrete Slump Anomaly','Medium',0.880,
   'Slump cone reading outside the expected band for the mix design on record.',
   'Batch #204, Foundation Slab','new','2026-10-24 09:01:00+05:30'),
  ('77777777-7777-4777-8777-000000000003','11111111-1111-4111-8111-000000000004',null,
   'Piling Depth Shortage','Critical',0.990,
   'Pile P-102 appears 0.8m short of the specified termination depth.',
   'P-102, South Retaining Wall','new','2026-10-24 08:15:00+05:30'),
  ('77777777-7777-4777-8777-000000000004','11111111-1111-4111-8111-000000000012',null,
   'Thermal Signature Warning','Low',0.760,
   'Elevated surface temperature detected near the generator enclosure.',
   'Generator Room B, High Temp','acknowledged','2026-10-24 06:20:00+05:30')
on conflict (id) do nothing;

-- Deterministic filler so "Showing 1-10 of N" has pages. Generated rather than
-- written out: 124 rows of literals would bury the four real ones above.
insert into public.ai_alerts (project_id, category, severity, confidence, description, location_text, status, detected_at)
select
  p.id,
  (array['Scaffolding Gap Detected','PPE Compliance Breach','Formwork Deflection',
         'Curing Duration Shortfall','Site Cleanliness Alert','Crane Load Threshold',
         'Shuttering Misalignment','Water Ingress Detected'])[1 + (n % 8)],
  -- All four PRD 8.4 levels, so filtering by High returns something.
  (array['Critical','High','Medium','Low','Medium'])[1 + (n % 5)],
  round((0.70 + (n % 30) * 0.01)::numeric, 3),
  'Automatically detected during routine photo analysis of the uploaded site update.',
  (array['Bay 7, West Elevation','Zone 3, Material Yard','Beam B-12, Level 2',
         'Slab S-04, East Wing','Access Corridor, Gate 2','Tower Crane TC-1',
         'Column C-31, Level 3','Basement B-1, North Face'])[1 + (n % 8)],
  case when n % 7 = 0 then 'resolved' else 'new' end,
  now() - (n || ' hours')::interval
from generate_series(1, 124) as n
cross join lateral (
  select id from public.projects order by md5(n::text || id::text) limit 1
) as p
where not exists (
  -- Only fill on a fresh database; re-running should not double the count.
  select 1 from public.ai_alerts where description like 'Automatically detected%'
);

commit;

-- Sanity check — expect 12 projects, 6 contractors, 128 alerts.
select
  (select count(*) from public.projects)     as projects,
  (select count(*) from public.contractors)  as contractors,
  (select count(*) from public.ai_alerts)    as alerts,
  (select count(*) from public.milestones)   as milestones,
  (select count(*) from public.schedule_phases) as phases,
  (select count(*) from public.expenses)     as expenses;
