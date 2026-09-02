import {
  Building2,
  CalendarClock,
  Sparkles,
  FileCheck2,
  Wallet,
} from 'lucide-react'
import { media, avatar } from './media'

/** Executive Dashboard — five KPI cards, left to right. */
export const dashboardKpis = [
  {
    id: 'active-projects',
    label: 'Active Projects',
    value: '12',
    sub: '+2 from last month',
    subTone: 'success',
    subIcon: 'trend',
    icon: Building2,
    iconTone: 'brand',
    valueTone: 'ink',
  },
  {
    id: 'delayed',
    label: 'Delayed',
    value: '2',
    sub: 'Requires attention',
    icon: CalendarClock,
    iconTone: 'violet',
    valueTone: 'violet',
  },
  {
    id: 'ai-quality-alerts',
    label: 'AI Quality Alerts',
    value: '5',
    sub: 'High precision detection',
    icon: Sparkles,
    iconTone: 'success',
    valueTone: 'success',
  },
  {
    id: 'pending-approvals',
    label: 'Pending Approvals',
    value: '8',
    sub: 'Ready for review',
    icon: FileCheck2,
    iconTone: 'warning',
    valueTone: 'warning',
  },
  {
    id: 'budget-health',
    label: 'Budget Health',
    value: '94%',
    progress: 94,
    icon: Wallet,
    iconTone: 'brand',
    valueTone: 'ink',
  },
]

/** Project Status Overview list. */
export const projectStatusRows = [
  {
    id: 'silver-oak',
    name: 'Silver Oak Residences',
    progress: 82,
    label: '82% Complete',
    tone: 'brand',
    team: [avatar(33), avatar(45), avatar(12)],
  },
  {
    id: 'skyline-hub',
    name: 'Skyline Corporate Hub',
    progress: 45,
    label: '45% Complete',
    tone: 'brand',
    team: [],
  },
  {
    id: 'harbor-view',
    name: 'Harbor View Apartments',
    progress: 32,
    label: 'Delayed (32%)',
    tone: 'violet',
    team: [],
  },
  {
    id: 'the-pines',
    name: 'The Pines Sub-Division',
    progress: 95,
    label: '95% Complete',
    tone: 'success',
    team: [],
  },
]

/** Site Updates rail. */
export const siteUpdates = [
  {
    id: 'upd-1',
    dot: 'brand',
    time: '10:45 AM',
    site: 'SKYLINE HUB',
    title: 'Concrete pouring for 4th floor complete.',
    photo: media.siteAerial,
    quote:
      'Everything within tolerance. Rain expected tomorrow, covering site now.',
    author: 'Foreman Dave',
  },
  {
    id: 'upd-2',
    dot: 'success',
    time: '08:12 AM',
    site: 'SILVER OAK',
    title: 'Electrical inspection passed.',
    body: 'Zone 3 interior wiring verified against code. Ready for drywall team.',
  },
  {
    id: 'upd-3',
    dot: 'neutral',
    time: 'YESTERDAY',
    site: 'GENERAL',
  },
]
