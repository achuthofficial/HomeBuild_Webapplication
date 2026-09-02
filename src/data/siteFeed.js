import { TriangleAlert, ClipboardList } from 'lucide-react'
import { media, avatar } from './media'

/** Daily Site Feed entries — Phase 2: Structural Integrity. */
export const feedEntries = [
  {
    id: 'feed-slab-casting',
    chip: { label: 'SLAB CASTING', tone: 'success' },
    title: 'East Wing Level 4 Foundation',
    date: '2026-10-24',
    time: '09:15 AM',
    status: { label: 'In Progress', tone: 'success' },
    team: [avatar(33), avatar(45), avatar(12)],
    note: 'Concrete pour for the East Wing Level 4 slab is underway. Slump tests returned 105mm, within specification. Rebar inspection completed at 07:00. Pumping rate maintained at 45m³/hour.',
    photos: [media.slabPour, media.crane, media.concreteCone, media.rebar],
    uploadSlots: 0,
  },
  {
    id: 'feed-mep-installation',
    chip: { label: 'MEP INSTALLATION', tone: 'neutral' },
    title: 'HVAC Ducting - Level 2',
    date: '2026-10-23',
    time: '02:30 PM',
    status: { label: 'On Hold', tone: 'neutral' },
    team: [],
    note: 'Installation of main ducts suspended due to clash with newly revised structural beam dimensions. Waiting for updated CAD files from the engineering team to resolve the 150mm overlap.',
    photos: [media.ducting, media.blueprintTablet],
    uploadSlots: 2,
  },
]

/** AI Insights rail — "Detected Potential Issues". */
export const aiInsights = [
  {
    id: 'insight-mep-clash',
    icon: TriangleAlert,
    title: 'MEP Clash Detected',
    body: 'Structural Beam 4B conflicts with HVAC ducting on Level 2.',
    action: 'View in BIM',
  },
  {
    id: 'insight-schedule-risk',
    icon: ClipboardList,
    title: 'Schedule Risk',
    body: 'Concrete curing time may be affected by forecasted rain tomorrow.',
    action: 'Adjust Schedule',
  },
]

/** Activity Breakdown legend, in mockup order. */
export const activityBreakdown = [
  { label: 'Casting', value: 45, tone: 'success' },
  { label: 'Structural Steel', value: 28, tone: 'brand' },
  { label: 'Electrical', value: 17, tone: 'violet' },
  { label: 'Others', value: 10, tone: 'neutral' },
]

export const feedFilters = [
  'All Activity',
  'Slab Casting',
  'MEP Installation',
  'Structural Steel',
  'Electrical',
]
