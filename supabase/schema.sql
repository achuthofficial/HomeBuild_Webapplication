-- =============================================================================
-- HomeBuild — database schema
--
-- Models the five entities in PRD section 8 (Project, Floor Plan, Site Update,
-- AI Alert, Milestone), plus the supporting tables the UI needs that the PRD
-- treats as derived data: profiles, contractors, schedule phases, the budget
-- trend series and cost categories.
--
-- Authentication is Firebase, not Supabase Auth. Firebase ID tokens are
-- validated through Supabase's third-party auth integration, so the Firebase
-- UID arrives as `auth.jwt() ->> 'sub'`. Every policy below keys on that.
-- See STORAGE_SETUP.md for how the bridge is configured.
--
-- Run this in the Supabase SQL editor, then seed.sql.
-- =============================================================================

-- Helper: the calling user's Firebase UID, or null when unauthenticated.
create or replace function public.firebase_uid()
returns text
language sql
stable
as $$
  select nullif(auth.jwt() ->> 'sub', '')
$$;

-- Audit columns are maintained by this trigger rather than by the client, so
-- updated_at cannot be back-dated by a caller.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- =============================================================================
-- profiles
--
-- One row per signed-in user. Firebase owns identity (name, email, photo);
-- this table holds what Firebase has nowhere to put — role, phone, job title —
-- which is what makes those fields on the Settings screen editable at all.
-- =============================================================================
create table if not exists public.profiles (
  firebase_uid  text primary key,
  full_name     text,
  email         text,
  phone         text,
  job_title     text default 'Project Manager',
  -- Persona from PRD section 4.
  role          text not null default 'project_manager'
                check (role in ('customer', 'project_manager', 'site_supervisor')),
  avatar_url    text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

-- =============================================================================
-- projects  (PRD 8.1)
-- =============================================================================
create table if not exists public.projects (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,
  client_name         text,
  customer_uid        text references public.profiles(firebase_uid) on delete set null,
  manager_uid         text references public.profiles(firebase_uid) on delete set null,
  -- PRD status vocabulary. The UI's "at-risk"/"delayed" live on timeline_status
  -- below, because a delayed project is still `active` in PRD terms.
  status              text not null default 'active'
                      check (status in ('lead','in_design','active','paused','completed','cancelled')),
  city                text,
  plot_address        text,
  plot_lat            numeric(9,6),
  plot_lng            numeric(9,6),
  plot_length_ft      integer,
  plot_width_ft       integer,
  plot_facing         text check (plot_facing in ('North','South','East','West')),
  total_floors        text check (total_floors in ('G','G+1','G+2','G+3')),
  bhk_per_floor       integer check (bhk_per_floor between 1 and 4),
  -- Rupees, not lakhs: the UI formats to ₹/L/Cr and storing the base unit
  -- avoids rounding drift between screens.
  budget_total        bigint default 0,
  budget_consumed     bigint default 0,
  progress_pct        integer default 0 check (progress_pct between 0 and 100),
  -- Presentation status driving the chips on the portfolio cards.
  budget_status       text default 'on_budget'
                      check (budget_status in ('on_budget','review_required','over_budget')),
  timeline_status     text default 'on_track'
                      check (timeline_status in ('on_track','ahead','delayed','at_risk')),
  start_date          date,
  expected_completion date,
  actual_completion   date,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists projects_status_idx on public.projects(status);
create index if not exists projects_city_idx on public.projects(city);
create index if not exists projects_manager_idx on public.projects(manager_uid);

create trigger projects_touch before update on public.projects
  for each row execute function public.touch_updated_at();

-- Team avatars shown as stacks on the portfolio cards.
create table if not exists public.project_members (
  project_id  uuid not null references public.projects(id) on delete cascade,
  member_uid  text not null references public.profiles(firebase_uid) on delete cascade,
  role        text default 'member',
  primary key (project_id, member_uid)
);

-- =============================================================================
-- floor_plans  (PRD 8.2)
-- =============================================================================
create table if not exists public.floor_plans (
  id              uuid primary key default gen_random_uuid(),
  project_id      uuid not null references public.projects(id) on delete cascade,
  variant         text check (variant in ('A','B','C')),
  name            text not null,
  vastu_score     numeric(3,1) check (vastu_score between 0 and 10),
  efficiency_score numeric(3,1) check (efficiency_score between 0 and 10),
  total_sqft      integer,
  cost_per_sqft   integer,
  total_cost      bigint,
  highlights      text[],
  vastu_notes     text,
  room_layout     jsonb,
  ai_metadata     jsonb,
  is_selected     boolean not null default false,
  created_at      timestamptz not null default now()
);

create index if not exists floor_plans_project_idx on public.floor_plans(project_id);

-- =============================================================================
-- site_updates  (PRD 8.3)  — the Daily Site Feed
-- =============================================================================
create table if not exists public.site_updates (
  id               uuid primary key default gen_random_uuid(),
  project_id       uuid not null references public.projects(id) on delete cascade,
  supervisor_uid   text references public.profiles(firebase_uid) on delete set null,
  work_category    text not null,
  location_on_site text,
  notes            text,
  status           text not null default 'in_progress'
                   check (status in ('in_progress','done','blocked')),
  milestone_id     uuid,
  uploaded_at      timestamptz not null default now(),
  created_at       timestamptz not null default now()
);

create index if not exists site_updates_project_idx on public.site_updates(project_id);
create index if not exists site_updates_uploaded_idx on public.site_updates(uploaded_at desc);

-- Photos are rows rather than an array column so each one can carry its own
-- caption and uploader, and so a photo can be deleted without rewriting the
-- update. `storage_path` points into the site-photos bucket.
create table if not exists public.site_update_photos (
  id             uuid primary key default gen_random_uuid(),
  site_update_id uuid not null references public.site_updates(id) on delete cascade,
  storage_path   text not null,
  caption        text,
  uploaded_by    text references public.profiles(firebase_uid) on delete set null,
  created_at     timestamptz not null default now()
);

create index if not exists site_update_photos_update_idx
  on public.site_update_photos(site_update_id);

-- =============================================================================
-- ai_alerts  (PRD 8.4)
-- =============================================================================
create table if not exists public.ai_alerts (
  id                uuid primary key default gen_random_uuid(),
  project_id        uuid not null references public.projects(id) on delete cascade,
  source_update_id  uuid references public.site_updates(id) on delete set null,
  category          text not null,
  severity          text not null check (severity in ('Low','Medium','High','Critical')),
  confidence        numeric(4,3) check (confidence between 0 and 1),
  description       text,
  location_text     text,
  location_in_photo jsonb,
  status            text not null default 'new'
                    check (status in ('new','acknowledged','assigned','resolved','false_positive')),
  assigned_to       text references public.profiles(firebase_uid) on delete set null,
  detected_at       timestamptz not null default now(),
  resolved_at       timestamptz,
  resolution_photo  text,
  created_at        timestamptz not null default now()
);

create index if not exists ai_alerts_project_idx on public.ai_alerts(project_id);
create index if not exists ai_alerts_status_idx on public.ai_alerts(status);
create index if not exists ai_alerts_severity_idx on public.ai_alerts(severity);
create index if not exists ai_alerts_detected_idx on public.ai_alerts(detected_at desc);

-- =============================================================================
-- milestones  (PRD 8.5)  — drives the Finance payments table
-- =============================================================================
create table if not exists public.milestones (
  id                uuid primary key default gen_random_uuid(),
  project_id        uuid not null references public.projects(id) on delete cascade,
  sequence          integer not null,
  name              text not null,
  contractor_id     uuid,
  release_pct       numeric(5,2),
  release_amount    bigint,
  due_date          date,
  status            text not null default 'upcoming'
                    check (status in ('upcoming','pending_verification','approved','paid')),
  pm_verified_at    timestamptz,
  customer_approved_at timestamptz,
  payment_txn_id    text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists milestones_project_idx on public.milestones(project_id);
create unique index if not exists milestones_sequence_idx
  on public.milestones(project_id, sequence);

create trigger milestones_touch before update on public.milestones
  for each row execute function public.touch_updated_at();

-- =============================================================================
-- contractors
--
-- Not a PRD entity, but PRD goal 4 ("200+ active vetted contractors") makes
-- this a first-class directory rather than a lookup list.
-- =============================================================================
create table if not exists public.contractors (
  id             uuid primary key default gen_random_uuid(),
  code           text unique,
  name           text not null,
  initials       text,
  trade          text not null,
  rating         numeric(2,1) check (rating between 0 and 5),
  score          integer check (score between 0 and 100),
  -- 'internal' staff vs 'sub' contracted firms — the Contractors tabs.
  kind           text not null default 'sub' check (kind in ('internal','sub')),
  -- Sparkline series. An array rather than rows: it is always read whole,
  -- never queried by point.
  score_history  integer[],
  compliance_ok  boolean default true,
  created_at     timestamptz not null default now()
);

create table if not exists public.contractor_assignments (
  contractor_id uuid not null references public.contractors(id) on delete cascade,
  project_id    uuid not null references public.projects(id) on delete cascade,
  primary key (contractor_id, project_id)
);

-- Milestones reference contractors; added after both tables exist.
alter table public.milestones
  drop constraint if exists milestones_contractor_fk;
alter table public.milestones
  add constraint milestones_contractor_fk
  foreign key (contractor_id) references public.contractors(id) on delete set null;

-- =============================================================================
-- schedule_phases
--
-- The 60-week template in PRD 5.4.2, stored per project so a phase can carry
-- its own baseline / actual / forecast for the three overlaid Gantt timelines.
-- Weeks are offsets from project start, which is what keeps the chart fluid.
-- =============================================================================
create table if not exists public.schedule_phases (
  id                 uuid primary key default gen_random_uuid(),
  project_id         uuid not null references public.projects(id) on delete cascade,
  sequence           integer not null,
  name               text not null,
  -- Grouping for the collapsible Gantt rows.
  phase_group        text,
  baseline_start_week numeric(5,2),
  baseline_end_week   numeric(5,2),
  actual_start_week   numeric(5,2),
  actual_end_week     numeric(5,2),
  forecast_start_week numeric(5,2),
  forecast_end_week   numeric(5,2),
  cost               bigint,
  status             text default 'queued'
                     check (status in ('done','in_progress','critical','delayed','queued','on_hold')),
  delay_days         integer default 0,
  created_at         timestamptz not null default now()
);

create index if not exists schedule_phases_project_idx on public.schedule_phases(project_id);
create unique index if not exists schedule_phases_sequence_idx
  on public.schedule_phases(project_id, sequence);

-- =============================================================================
-- Finance supporting tables
-- =============================================================================

-- Monthly spend series behind the Budget Consumption Trend chart.
create table if not exists public.budget_entries (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects(id) on delete cascade,
  period      date not null,          -- first of the month
  amount      bigint not null default 0,
  created_at  timestamptz not null default now()
);

create unique index if not exists budget_entries_period_idx
  on public.budget_entries(project_id, period);

-- Category Breakdown donut.
create table if not exists public.cost_categories (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects(id) on delete cascade,
  label       text not null,
  pct         numeric(5,2) not null,
  tone        text default 'brand',
  sequence    integer default 0,
  created_at  timestamptz not null default now()
);

create index if not exists cost_categories_project_idx on public.cost_categories(project_id);

-- =============================================================================
-- Aggregates
--
-- The dashboard KPI cards are counts across the whole portfolio. Doing this in
-- SQL rather than fetching every project and counting client-side keeps the
-- dashboard to one small request regardless of portfolio size.
-- =============================================================================
create or replace function public.dashboard_kpis()
returns table (
  active_projects   bigint,
  delayed_projects  bigint,
  open_alerts       bigint,
  pending_approvals bigint,
  budget_health_pct integer
)
language sql
stable
security invoker
as $$
  select
    (select count(*) from public.projects
      where status = 'active')                                   as active_projects,
    (select count(*) from public.projects
      where status = 'active' and timeline_status = 'delayed')   as delayed_projects,
    (select count(*) from public.ai_alerts
      where status in ('new','acknowledged','assigned'))         as open_alerts,
    (select count(*) from public.milestones
      where status = 'pending_verification')                     as pending_approvals,
    -- Consumed against budget across active projects, expressed as headroom
    -- remaining. Guarded against a zero-budget portfolio.
    (select case
        when coalesce(sum(budget_total), 0) = 0 then 100
        else greatest(0, least(100, round(
          100 - (sum(budget_consumed)::numeric / nullif(sum(budget_total), 0) * 100)
        )::int))
      end
      from public.projects where status = 'active')              as budget_health_pct;
$$;

-- =============================================================================
-- Row Level Security
--
-- Every table is readable by any signed-in user: this is a single-tenant
-- internal tool where colleagues share a portfolio, and there is no
-- organisation table to scope against yet. Writes are deliberately narrower.
--
-- ⚠️ Before multi-tenant use, replace `is_signed_in()` reads with a join
-- against project membership. As written, any authenticated account can read
-- every project in the database.
-- =============================================================================
create or replace function public.is_signed_in()
returns boolean
language sql
stable
as $$
  select public.firebase_uid() is not null
$$;

alter table public.profiles              enable row level security;
alter table public.projects              enable row level security;
alter table public.project_members       enable row level security;
alter table public.floor_plans           enable row level security;
alter table public.site_updates          enable row level security;
alter table public.site_update_photos    enable row level security;
alter table public.ai_alerts             enable row level security;
alter table public.milestones            enable row level security;
alter table public.contractors           enable row level security;
alter table public.contractor_assignments enable row level security;
alter table public.schedule_phases       enable row level security;
alter table public.budget_entries        enable row level security;
alter table public.cost_categories       enable row level security;

-- Read: any signed-in user, on every table.
do $$
declare t text;
begin
  foreach t in array array[
    'projects','project_members','floor_plans','site_updates','site_update_photos',
    'ai_alerts','milestones','contractors','contractor_assignments',
    'schedule_phases','budget_entries','cost_categories'
  ]
  loop
    execute format(
      'drop policy if exists "signed-in read" on public.%I;
       create policy "signed-in read" on public.%I for select using (public.is_signed_in());',
      t, t
    );
  end loop;
end $$;

-- profiles: everyone signed in can read the directory (team lists need it),
-- but a user may only create or modify their own row.
drop policy if exists "signed-in read profiles" on public.profiles;
create policy "signed-in read profiles" on public.profiles
  for select using (public.is_signed_in());

drop policy if exists "insert own profile" on public.profiles;
create policy "insert own profile" on public.profiles
  for insert with check (firebase_uid = public.firebase_uid());

drop policy if exists "update own profile" on public.profiles;
create policy "update own profile" on public.profiles
  for update using (firebase_uid = public.firebase_uid())
  with check (firebase_uid = public.firebase_uid());

-- Site updates: any signed-in user may post one, but only as themselves, and
-- may only edit or delete their own.
drop policy if exists "insert own site update" on public.site_updates;
create policy "insert own site update" on public.site_updates
  for insert with check (supervisor_uid = public.firebase_uid());

drop policy if exists "modify own site update" on public.site_updates;
create policy "modify own site update" on public.site_updates
  for update using (supervisor_uid = public.firebase_uid());

drop policy if exists "delete own site update" on public.site_updates;
create policy "delete own site update" on public.site_updates
  for delete using (supervisor_uid = public.firebase_uid());

drop policy if exists "insert own photo" on public.site_update_photos;
create policy "insert own photo" on public.site_update_photos
  for insert with check (uploaded_by = public.firebase_uid());

drop policy if exists "delete own photo" on public.site_update_photos;
create policy "delete own photo" on public.site_update_photos
  for delete using (uploaded_by = public.firebase_uid());

-- Alerts: acknowledging and resolving is core PM workflow, so any signed-in
-- user may update them. Creation is left to the CV pipeline (service role).
drop policy if exists "signed-in update alerts" on public.ai_alerts;
create policy "signed-in update alerts" on public.ai_alerts
  for update using (public.is_signed_in()) with check (public.is_signed_in());

-- Milestones: PM sign-off happens in the app.
drop policy if exists "signed-in update milestones" on public.milestones;
create policy "signed-in update milestones" on public.milestones
  for update using (public.is_signed_in()) with check (public.is_signed_in());

-- Projects: creating a project from the topbar dialog.
drop policy if exists "signed-in insert projects" on public.projects;
create policy "signed-in insert projects" on public.projects
  for insert with check (public.is_signed_in());

drop policy if exists "signed-in update projects" on public.projects;
create policy "signed-in update projects" on public.projects
  for update using (public.is_signed_in()) with check (public.is_signed_in());
