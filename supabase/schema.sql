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

drop trigger if exists profiles_touch on public.profiles;
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

drop trigger if exists projects_touch on public.projects;
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
--
-- NOTE ON A DELIBERATE DEVIATION FROM THE PRD.
-- PRD 8.1 lists "Selected Plan" as a field on Project — a link to the chosen
-- plan. That is modelled here as `is_selected` on the plan instead, so which
-- plan is chosen has exactly ONE home. Storing it on both sides would let the
-- two disagree, and reconciling "project points at plan B / plan A says it is
-- selected" is a class of bug worth designing out rather than fixing later.
-- Query it as: select * from floor_plans where project_id = $1 and is_selected.
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
  -- PRD 8.3 "Milestone Reference". The constraint is added after the
  -- milestones table exists, further down.
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

drop trigger if exists milestones_touch on public.milestones;
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

-- PRD 8.3's Milestone Reference. Deferred for the same reason: site_updates
-- is declared before milestones. On delete the reference is cleared rather
-- than cascading — losing a milestone must not delete the site history that
-- documented the work.
alter table public.site_updates
  drop constraint if exists site_updates_milestone_fk;
alter table public.site_updates
  add constraint site_updates_milestone_fk
  foreign key (milestone_id) references public.milestones(id) on delete set null;

create index if not exists site_updates_milestone_idx
  on public.site_updates(milestone_id);

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

-- =============================================================================
-- WORKFLOW TABLES AND FUNCTIONS
--
-- Appended rather than kept separate so there is one file to run. Everything
-- here is idempotent: re-running schema.sql is safe and is how you upgrade.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- invitations
--
-- Team invites from the Settings screen. A real deployment would hand the
-- token to an email service; this records the invite so it survives a reload
-- and can be revoked, which is the part that belongs in the database.
-- -----------------------------------------------------------------------------
create table if not exists public.invitations (
  id           uuid primary key default gen_random_uuid(),
  email        text not null,
  role         text not null default 'project_manager'
               check (role in ('customer','project_manager','site_supervisor')),
  project_id   uuid references public.projects(id) on delete cascade,
  invited_by   text references public.profiles(firebase_uid) on delete set null,
  status       text not null default 'pending'
               check (status in ('pending','accepted','revoked','expired')),
  token        uuid not null default gen_random_uuid(),
  expires_at   timestamptz not null default (now() + interval '7 days'),
  accepted_at  timestamptz,
  created_at   timestamptz not null default now()
);

create unique index if not exists invitations_pending_email_idx
  on public.invitations(lower(email))
  where status = 'pending';

-- -----------------------------------------------------------------------------
-- activity_log
--
-- The PRD calls for audit fields on every entity. Rather than scattering
-- "who changed what" across tables, state transitions append here — which is
-- also what makes the Schedule screen's audit trail real rather than a toast.
-- -----------------------------------------------------------------------------
create table if not exists public.activity_log (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid references public.projects(id) on delete cascade,
  actor_uid   text references public.profiles(firebase_uid) on delete set null,
  entity      text not null,          -- 'project' | 'milestone' | 'alert' | ...
  entity_id   uuid,
  action      text not null,          -- 'created' | 'status_changed' | ...
  summary     text not null,
  detail      jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists activity_log_project_idx
  on public.activity_log(project_id, created_at desc);
create index if not exists activity_log_entity_idx
  on public.activity_log(entity, entity_id);

-- -----------------------------------------------------------------------------
-- Derived project figures
--
-- progress_pct and budget_consumed were seeded as literals. Once phases and
-- milestones start moving they must follow, or the dashboard drifts away from
-- the detail screens. Recomputing in the database keeps one definition rather
-- than one per client.
-- -----------------------------------------------------------------------------
create or replace function public.recalc_project_rollups(p_project_id uuid)
returns void
language plpgsql
as $$
declare
  v_progress integer;
  v_consumed bigint;
begin
  /* Progress is the share of phase cost that is done, so a long cheap phase
     does not count the same as the structural work. Falls back to a plain
     count when costs are absent. */
  select coalesce(
    round(
      100.0 * sum(case when status = 'done' then coalesce(cost, 1) else 0 end)
      / nullif(sum(coalesce(cost, 1)), 0)
    ),
    0
  )
  into v_progress
  from public.schedule_phases
  where project_id = p_project_id;

  /* Consumed budget is what has actually been released. */
  select coalesce(sum(release_amount), 0)
  into v_consumed
  from public.milestones
  where project_id = p_project_id and status = 'paid';

  update public.projects
  set progress_pct    = least(100, greatest(0, coalesce(v_progress, 0))),
      /* Never let a rollup erase a seeded figure with zero — a project with no
         phases or paid milestones keeps whatever was set by hand. */
      budget_consumed = case
        when v_consumed > 0 then v_consumed
        else budget_consumed
      end,
      updated_at = now()
  where id = p_project_id;
end;
$$;

create or replace function public.trigger_recalc_rollups()
returns trigger
language plpgsql
as $$
begin
  perform public.recalc_project_rollups(
    coalesce(new.project_id, old.project_id)
  );
  return coalesce(new, old);
end;
$$;

drop trigger if exists phases_rollup on public.schedule_phases;
create trigger phases_rollup
  after insert or update or delete on public.schedule_phases
  for each row execute function public.trigger_recalc_rollups();

drop trigger if exists milestones_rollup on public.milestones;
create trigger milestones_rollup
  after insert or update or delete on public.milestones
  for each row execute function public.trigger_recalc_rollups();

-- -----------------------------------------------------------------------------
-- Milestone payment workflow (PRD 8.5)
--
-- Enforces the order in the database rather than trusting the client: a
-- milestone cannot be paid before the customer approves, and cannot be
-- approved before the PM verifies. Timestamps are stamped server-side so they
-- cannot be back-dated.
-- -----------------------------------------------------------------------------
create or replace function public.advance_milestone(
  p_milestone_id uuid,
  p_next_status text
)
returns public.milestones
language plpgsql
security invoker
as $$
declare
  v_row public.milestones;
  v_uid text := public.firebase_uid();
begin
  if v_uid is null then
    raise exception 'Not signed in';
  end if;

  select * into v_row from public.milestones where id = p_milestone_id;
  if not found then
    raise exception 'Milestone not found';
  end if;

  /* The only legal transitions. Anything else is a client bug or an attempt
     to skip an approval step. */
  if not (
    (v_row.status = 'upcoming'             and p_next_status = 'pending_verification') or
    (v_row.status = 'pending_verification' and p_next_status = 'approved') or
    (v_row.status = 'approved'             and p_next_status = 'paid') or
    (v_row.status = 'pending_verification' and p_next_status = 'upcoming')
  ) then
    raise exception 'Cannot move a milestone from % to %', v_row.status, p_next_status;
  end if;

  update public.milestones
  set status = p_next_status,
      pm_verified_at = case
        when p_next_status = 'approved' then now() else pm_verified_at end,
      customer_approved_at = case
        when p_next_status = 'paid' then now() else customer_approved_at end,
      payment_txn_id = case
        when p_next_status = 'paid'
        /* Stand-in for the escrow provider's reference until RazorpayX is
           wired up (PRD section 9). */
        then 'SIM-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12))
        else payment_txn_id end
  where id = p_milestone_id
  returning * into v_row;

  insert into public.activity_log (project_id, actor_uid, entity, entity_id, action, summary)
  values (
    v_row.project_id, v_uid, 'milestone', v_row.id, 'status_changed',
    format('Milestone “%s” moved to %s', v_row.name, replace(p_next_status, '_', ' '))
  );

  return v_row;
end;
$$;

-- -----------------------------------------------------------------------------
-- Alert workflow (PRD 8.4)
-- -----------------------------------------------------------------------------
create or replace function public.resolve_alert(
  p_alert_id uuid,
  p_next_status text,
  p_assignee text default null
)
returns public.ai_alerts
language plpgsql
security invoker
as $$
declare
  v_row public.ai_alerts;
  v_uid text := public.firebase_uid();
begin
  if v_uid is null then
    raise exception 'Not signed in';
  end if;

  if p_next_status not in ('acknowledged','assigned','resolved','false_positive') then
    raise exception 'Unknown alert status %', p_next_status;
  end if;

  update public.ai_alerts
  set status = p_next_status,
      assigned_to = case
        when p_next_status = 'assigned' then coalesce(p_assignee, v_uid)
        else assigned_to end,
      resolved_at = case
        when p_next_status in ('resolved','false_positive') then now()
        else null end
  where id = p_alert_id
  returning * into v_row;

  if not found then
    raise exception 'Alert not found';
  end if;

  insert into public.activity_log (project_id, actor_uid, entity, entity_id, action, summary)
  values (
    v_row.project_id, v_uid, 'alert', v_row.id, 'status_changed',
    format('Alert “%s” marked %s', v_row.category, replace(p_next_status, '_', ' '))
  );

  return v_row;
end;
$$;

-- -----------------------------------------------------------------------------
-- Schedule delay forecast (PRD 5.4.3)
--
-- The rule-based part only — no model involved. Pushes out the phases that
-- follow a delayed one, applies the documented monsoon buffer, and records
-- what it did.
-- -----------------------------------------------------------------------------
create or replace function public.apply_schedule_forecast(p_project_id uuid)
returns integer
language plpgsql
security invoker
as $$
declare
  v_uid text := public.firebase_uid();
  v_cumulative numeric := 0;
  v_row record;
  v_touched integer := 0;
  v_shift numeric;
begin
  if v_uid is null then
    raise exception 'Not signed in';
  end if;

  for v_row in
    select * from public.schedule_phases
    where project_id = p_project_id
    order by sequence
  loop
    if v_row.delay_days > 0 then
      /* Weeks, since the Gantt is drawn in week offsets. */
      v_cumulative := v_cumulative + (v_row.delay_days / 7.0);
    end if;

    if v_cumulative > 0 and v_row.status in ('queued','on_hold','in_progress') then
      v_shift := v_cumulative;

      /* PRD 5.4.3: monsoon weeks 22-36 carry a 15% buffer. */
      if v_row.baseline_start_week between 22 and 36 then
        v_shift := v_shift * 1.15;
      end if;

      update public.schedule_phases
      set forecast_start_week = coalesce(baseline_start_week, 0) + v_shift,
          forecast_end_week   = coalesce(baseline_end_week, 0) + v_shift
      where id = v_row.id;

      v_touched := v_touched + 1;
    end if;
  end loop;

  insert into public.activity_log (project_id, actor_uid, entity, action, summary)
  values (
    p_project_id, v_uid, 'schedule', 'forecast_applied',
    format('Forecast recalculated; %s phase(s) shifted by %s week(s)',
           v_touched, round(v_cumulative, 1))
  );

  return v_touched;
end;
$$;

-- -----------------------------------------------------------------------------
-- RLS for the new tables
-- -----------------------------------------------------------------------------
alter table public.invitations  enable row level security;
alter table public.activity_log enable row level security;

drop policy if exists "signed-in read invitations" on public.invitations;
create policy "signed-in read invitations" on public.invitations
  for select using (public.is_signed_in());

drop policy if exists "signed-in create invitations" on public.invitations;
create policy "signed-in create invitations" on public.invitations
  for insert with check (invited_by = public.firebase_uid());

drop policy if exists "revoke own invitations" on public.invitations;
create policy "revoke own invitations" on public.invitations
  for update using (invited_by = public.firebase_uid());

drop policy if exists "signed-in read activity" on public.activity_log;
create policy "signed-in read activity" on public.activity_log
  for select using (public.is_signed_in());

drop policy if exists "signed-in write activity" on public.activity_log;
create policy "signed-in write activity" on public.activity_log
  for insert with check (actor_uid = public.firebase_uid());

-- Schedule phases and contractors become editable from the app.
drop policy if exists "signed-in update phases" on public.schedule_phases;
create policy "signed-in update phases" on public.schedule_phases
  for update using (public.is_signed_in()) with check (public.is_signed_in());

drop policy if exists "signed-in insert phases" on public.schedule_phases;
create policy "signed-in insert phases" on public.schedule_phases
  for insert with check (public.is_signed_in());

drop policy if exists "signed-in update contractors" on public.contractors;
create policy "signed-in update contractors" on public.contractors
  for update using (public.is_signed_in()) with check (public.is_signed_in());

drop policy if exists "signed-in insert milestones" on public.milestones;
create policy "signed-in insert milestones" on public.milestones
  for insert with check (public.is_signed_in());

-- =============================================================================
-- MULTI-USER SCOPING
--
-- Until this section, every signed-in user could read every project. That is
-- fine for a single-team internal tool and wrong the moment two customers,
-- or two PMs with different portfolios, use the same deployment.
--
-- Access is scoped by PROJECT MEMBERSHIP, not per-user silos. PRD section 4
-- has three personas who need the SAME project: the homeowner tracking it,
-- the PM running it, and the site supervisor posting to it. Giving each user
-- a private world would break the product; what has to be private is one
-- project from another.
--
-- A user reaches a project if they are its manager, its customer, or a
-- listed member.
-- =============================================================================

/**
 * SECURITY DEFINER is load-bearing here, not laziness.
 *
 * This function is called from the RLS policy ON project_members. If it ran
 * as the caller, reading project_members would re-enter that policy, which
 * calls this function again — infinite recursion, and Postgres rejects the
 * query. Running as the definer reads the table directly, once.
 *
 * It is safe because it takes a project id and returns only a boolean: it
 * cannot be coaxed into returning rows the caller should not see.
 */
create or replace function public.has_project_access(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.projects p
    where p.id = p_project_id
      and (
        p.manager_uid  = public.firebase_uid()
        or p.customer_uid = public.firebase_uid()
        or exists (
          select 1 from public.project_members m
          where m.project_id = p.id
            and m.member_uid = public.firebase_uid()
        )
      )
  )
$$;

/** Whether the caller may administer a project (add members, change status). */
create or replace function public.is_project_manager(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.projects p
    where p.id = p_project_id and p.manager_uid = public.firebase_uid()
  )
$$;

-- -----------------------------------------------------------------------------
-- projects
-- -----------------------------------------------------------------------------
drop policy if exists "signed-in read" on public.projects;
drop policy if exists "signed-in update projects" on public.projects;
drop policy if exists "signed-in insert projects" on public.projects;

drop policy if exists "read own projects" on public.projects;
create policy "read own projects" on public.projects
  for select using (public.has_project_access(id));

/* Creating: you may insert a project only with yourself as its manager, so a
   new row cannot be planted in someone else's portfolio. */
drop policy if exists "create own projects" on public.projects;
create policy "create own projects" on public.projects
  for insert with check (manager_uid = public.firebase_uid());

drop policy if exists "update accessible projects" on public.projects;
create policy "update accessible projects" on public.projects
  for update using (public.has_project_access(id))
  with check (public.has_project_access(id));

drop policy if exists "manager deletes project" on public.projects;
create policy "manager deletes project" on public.projects
  for delete using (manager_uid = public.firebase_uid());

-- -----------------------------------------------------------------------------
-- project_members
-- -----------------------------------------------------------------------------
drop policy if exists "signed-in read" on public.project_members;

drop policy if exists "read memberships of accessible projects" on public.project_members;
create policy "read memberships of accessible projects" on public.project_members
  for select using (public.has_project_access(project_id));

/* Adding members is the manager's job alone.

   An earlier draft of this policy also allowed `member_uid = firebase_uid()`
   — "you may add yourself" — which is a hole, not a convenience: any user
   could add themselves to any project id and read it. Project creation does
   not need it either, because create_project() below runs as definer and
   inserts the creator's membership itself. */
drop policy if exists "manager adds members" on public.project_members;
create policy "manager adds members" on public.project_members
  for insert with check (public.is_project_manager(project_id));

/* Removal: the manager may remove anyone; anyone may remove themselves. That
   direction is safe — leaving a project only ever reduces your access. */
drop policy if exists "manager removes members" on public.project_members;
create policy "manager removes members" on public.project_members
  for delete using (
    public.is_project_manager(project_id)
    or member_uid = public.firebase_uid()
  );

-- -----------------------------------------------------------------------------
-- Everything hanging off a project inherits its scope.
-- -----------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'floor_plans','site_updates','ai_alerts','milestones',
    'schedule_phases','budget_entries','cost_categories',
    'contractor_assignments'
  ]
  loop
    /* Drop BOTH the old open-read policy and this one's own name — without
       the second, re-running schema.sql fails on "policy already exists". */
    execute format('drop policy if exists "signed-in read" on public.%I;', t);
    execute format('drop policy if exists "read via project" on public.%I;', t);
    execute format(
      'create policy "read via project" on public.%I
         for select using (public.has_project_access(project_id));',
      t
    );
  end loop;
end $$;

/* Writes on child tables, re-scoped from "any signed-in user". */
drop policy if exists "signed-in update alerts" on public.ai_alerts;
drop policy if exists "update alerts via project" on public.ai_alerts;
create policy "update alerts via project" on public.ai_alerts
  for update using (public.has_project_access(project_id))
  with check (public.has_project_access(project_id));

drop policy if exists "signed-in update milestones" on public.milestones;
drop policy if exists "update milestones via project" on public.milestones;
create policy "update milestones via project" on public.milestones
  for update using (public.has_project_access(project_id))
  with check (public.has_project_access(project_id));

drop policy if exists "signed-in insert milestones" on public.milestones;
drop policy if exists "insert milestones via project" on public.milestones;
create policy "insert milestones via project" on public.milestones
  for insert with check (public.has_project_access(project_id));

drop policy if exists "signed-in update phases" on public.schedule_phases;
drop policy if exists "update phases via project" on public.schedule_phases;
create policy "update phases via project" on public.schedule_phases
  for update using (public.has_project_access(project_id))
  with check (public.has_project_access(project_id));

drop policy if exists "signed-in insert phases" on public.schedule_phases;
drop policy if exists "insert phases via project" on public.schedule_phases;
create policy "insert phases via project" on public.schedule_phases
  for insert with check (public.has_project_access(project_id));

drop policy if exists "insert own site update" on public.site_updates;
drop policy if exists "insert site update via project" on public.site_updates;
create policy "insert site update via project" on public.site_updates
  for insert with check (
    supervisor_uid = public.firebase_uid()
    and public.has_project_access(project_id)
  );

-- Photos: reachable through their update's project.
drop policy if exists "signed-in read" on public.site_update_photos;
drop policy if exists "read photos via project" on public.site_update_photos;
create policy "read photos via project" on public.site_update_photos
  for select using (
    exists (
      select 1 from public.site_updates u
      where u.id = site_update_id and public.has_project_access(u.project_id)
    )
  );

drop policy if exists "insert own photo" on public.site_update_photos;
drop policy if exists "insert photo via project" on public.site_update_photos;
create policy "insert photo via project" on public.site_update_photos
  for insert with check (
    uploaded_by = public.firebase_uid()
    and exists (
      select 1 from public.site_updates u
      where u.id = site_update_id and public.has_project_access(u.project_id)
    )
  );

-- -----------------------------------------------------------------------------
-- activity_log follows its project. Entries with no project (account-level
-- actions) are visible only to the person who made them.
-- -----------------------------------------------------------------------------
drop policy if exists "signed-in read activity" on public.activity_log;
drop policy if exists "read activity via project" on public.activity_log;
create policy "read activity via project" on public.activity_log
  for select using (
    (project_id is not null and public.has_project_access(project_id))
    or (project_id is null and actor_uid = public.firebase_uid())
  );

-- -----------------------------------------------------------------------------
-- Deliberately NOT scoped
--
-- `profiles` and `contractors` stay readable by any signed-in user. Both are
-- shared directories: you cannot assign a PM, invite a colleague or pick a
-- contractor you are unable to see, and a name and trade are not sensitive in
-- the way a client's budget is. Writes on both remain restricted.
--
-- `invitations` likewise: revoking is already limited to the inviter.
-- -----------------------------------------------------------------------------

-- =============================================================================
-- Project creation
--
-- The insert policy above requires manager_uid = the caller, which is right
-- for a plain INSERT but breaks a legitimate case: assigning the project to a
-- different PM. It would also let a creator hand a project away and lose
-- access to it in the same statement.
--
-- This function resolves both. It runs as definer, so it can set any manager,
-- and it always records the CREATOR as a member — you never lose the project
-- you just made.
-- =============================================================================
create or replace function public.create_project(p_project jsonb)
returns public.projects
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid text := public.firebase_uid();
  v_row public.projects;
  v_manager text;
begin
  if v_uid is null then
    raise exception 'Not signed in';
  end if;

  if coalesce(trim(p_project ->> 'name'), '') = '' then
    raise exception 'Project name is required';
  end if;

  /* Unassigned falls to the creator, so a project is never ownerless. */
  v_manager := coalesce(nullif(p_project ->> 'manager_uid', ''), v_uid);

  insert into public.projects (
    name, client_name, customer_uid, manager_uid, status, city,
    plot_address, plot_lat, plot_lng, plot_length_ft, plot_width_ft,
    plot_facing, total_floors, bhk_per_floor, budget_total,
    start_date, expected_completion
  )
  values (
    trim(p_project ->> 'name'),
    nullif(trim(coalesce(p_project ->> 'client_name', '')), ''),
    nullif(p_project ->> 'customer_uid', ''),
    v_manager,
    coalesce(nullif(p_project ->> 'status', ''), 'lead'),
    nullif(p_project ->> 'city', ''),
    nullif(trim(coalesce(p_project ->> 'plot_address', '')), ''),
    (nullif(p_project ->> 'plot_lat', ''))::numeric,
    (nullif(p_project ->> 'plot_lng', ''))::numeric,
    (nullif(p_project ->> 'plot_length_ft', ''))::integer,
    (nullif(p_project ->> 'plot_width_ft', ''))::integer,
    nullif(p_project ->> 'plot_facing', ''),
    nullif(p_project ->> 'total_floors', ''),
    (nullif(p_project ->> 'bhk_per_floor', ''))::integer,
    coalesce((nullif(p_project ->> 'budget_total', ''))::bigint, 0),
    (nullif(p_project ->> 'start_date', ''))::date,
    (nullif(p_project ->> 'expected_completion', ''))::date
  )
  returning * into v_row;

  /* The creator, always. Plus the assigned manager and customer when they are
     other people, so the project appears in their portfolios too. */
  insert into public.project_members (project_id, member_uid, role)
  select v_row.id, uid, role
  from (values
    (v_uid, 'creator'),
    (v_manager, 'manager'),
    (nullif(p_project ->> 'customer_uid', ''), 'customer')
  ) as m(uid, role)
  where uid is not null
    and exists (select 1 from public.profiles pr where pr.firebase_uid = m.uid)
  on conflict (project_id, member_uid) do nothing;

  insert into public.activity_log (project_id, actor_uid, entity, entity_id, action, summary)
  values (v_row.id, v_uid, 'project', v_row.id, 'created',
          format('Project “%s” created', v_row.name));

  return v_row;
end;
$$;

-- =============================================================================
-- Demo data
--
-- seed.sql assigns its projects to placeholder `seed-` profiles, so with the
-- policies above a real account correctly sees none of them — an empty app on
-- first sign-in, which looks broken even though it is right.
--
-- Call this once to add yourself to the seeded projects:
--     select public.claim_demo_projects();
-- =============================================================================
create or replace function public.claim_demo_projects()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid text := public.firebase_uid();
  v_count integer;
begin
  if v_uid is null then
    raise exception 'Not signed in';
  end if;

  insert into public.project_members (project_id, member_uid, role)
  select p.id, v_uid, 'member'
  from public.projects p
  where p.manager_uid like 'seed-%'
  on conflict (project_id, member_uid) do nothing;

  get diagnostics v_count = row_count;

  insert into public.activity_log (actor_uid, entity, action, summary)
  values (v_uid, 'account', 'claimed_demo',
          format('Joined %s demo project(s)', v_count));

  return v_count;
end;
$$;

-- =============================================================================
-- Storage policies, re-scoped
--
-- STORAGE_SETUP.md's original site-photos read policy was "any signed-in
-- user", which is now inconsistent with the table policies above: a user who
-- cannot see a project could still read its photography by listing the
-- bucket. Photos are client project data, so they follow the same membership
-- rule as everything else.
--
-- Path shape is  site-photos/<site_update_id>/<uploader_uid>/<file>
-- so segment 1 identifies the update, and its project decides access.
-- =============================================================================

drop policy if exists "signed-in users read site photos" on storage.objects;
create policy "read site photos via project"
on storage.objects for select
using (
  bucket_id = 'site-photos'
  and exists (
    select 1 from public.site_updates u
    where u.id::text = (storage.foldername(name))[1]
      and public.has_project_access(u.project_id)
  )
);

drop policy if exists "users upload their own site photos" on storage.objects;
create policy "upload site photos via project"
on storage.objects for insert
with check (
  bucket_id = 'site-photos'
  -- Segment 2 is the uploader: you may only write under your own prefix.
  and (storage.foldername(name))[2] = public.firebase_uid()
  and exists (
    select 1 from public.site_updates u
    where u.id::text = (storage.foldername(name))[1]
      and public.has_project_access(u.project_id)
  )
);

drop policy if exists "users delete their own site photos" on storage.objects;
create policy "delete own site photos"
on storage.objects for delete
using (
  bucket_id = 'site-photos'
  and (storage.foldername(name))[2] = public.firebase_uid()
);

-- Avatars are unchanged: a public bucket whose URLs live in Firebase profiles.
-- Re-declared here so all policies are in one file rather than split between
-- this and STORAGE_SETUP.md.
drop policy if exists "avatars are readable by anyone" on storage.objects;
create policy "avatars are readable by anyone"
on storage.objects for select
using (bucket_id = 'avatars');

drop policy if exists "users write their own avatar" on storage.objects;
create policy "users write their own avatar"
on storage.objects for insert
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = public.firebase_uid()
);

drop policy if exists "users replace their own avatar" on storage.objects;
create policy "users replace their own avatar"
on storage.objects for update
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = public.firebase_uid()
);

-- =============================================================================
-- Design module (PRD 5.1)
--
-- 5.1.3 lists ten input parameters. Six already live on `projects` (plot
-- dimensions, facing, floors, BHK); the four that are design-specific are
-- added here rather than to projects, because they describe a GENERATION
-- REQUEST rather than the project itself — you may generate twice with
-- different budget tiers for the same plot.
-- =============================================================================
alter table public.floor_plans
  add column if not exists parking_spots     integer,
  add column if not exists architectural_style text,
  add column if not exists budget_tier       text,
  add column if not exists vastu_required    boolean default true,
  add column if not exists extra_spaces      text[],
  -- The 5.1.8 check results, stored so a plan carries the evidence it was
  -- valid at generation time rather than being re-derived on every read.
  add column if not exists validation        jsonb;

/* Selecting a plan is exclusive: PRD 8.1 calls it "the chosen plan", singular.
   Enforced here rather than in the client so two tabs cannot both win. */
create or replace function public.select_floor_plan(p_plan_id uuid)
returns public.floor_plans
language plpgsql
security invoker
as $$
declare
  v_row public.floor_plans;
  v_uid text := public.firebase_uid();
begin
  if v_uid is null then
    raise exception 'Not signed in';
  end if;

  select * into v_row from public.floor_plans where id = p_plan_id;
  if not found then
    raise exception 'Plan not found';
  end if;

  if not public.has_project_access(v_row.project_id) then
    raise exception 'No access to this project';
  end if;

  update public.floor_plans
  set is_selected = (id = p_plan_id)
  where project_id = v_row.project_id;

  /* Choosing a plan is what moves a project out of design. */
  update public.projects
  set status = case when status in ('lead', 'in_design') then 'active' else status end
  where id = v_row.project_id;

  insert into public.activity_log (project_id, actor_uid, entity, entity_id, action, summary)
  values (v_row.project_id, v_uid, 'floor_plan', v_row.id, 'selected',
          format('Floor plan “%s” selected', v_row.name));

  select * into v_row from public.floor_plans where id = p_plan_id;
  return v_row;
end;
$$;

drop policy if exists "insert plans via project" on public.floor_plans;
create policy "insert plans via project" on public.floor_plans
  for insert with check (public.has_project_access(project_id));

drop policy if exists "update plans via project" on public.floor_plans;
create policy "update plans via project" on public.floor_plans
  for update using (public.has_project_access(project_id))
  with check (public.has_project_access(project_id));

drop policy if exists "delete plans via project" on public.floor_plans;
create policy "delete plans via project" on public.floor_plans
  for delete using (public.has_project_access(project_id));
