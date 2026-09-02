import { TriangleAlert, Zap, ShieldCheck, Timer } from 'lucide-react'

/** AI Alert Management — four KPI cards. */
export const alertKpis = [
  {
    id: 'active-critical',
    label: 'Active Critical',
    value: '12',
    sub: '+2 since yesterday',
    subTone: 'ink-3',
    subIcon: 'trend',
    icon: TriangleAlert,
    iconTone: 'danger',
  },
  {
    id: 'medium-risks',
    label: 'Medium Risks',
    value: '34',
    sub: 'Stable monitoring',
    icon: Zap,
    iconTone: 'warning',
  },
  {
    id: 'ai-confidence',
    label: 'AI Confidence',
    value: '94.8%',
    sub: '↑ Improved by 2%',
    subTone: 'success',
    icon: ShieldCheck,
    iconTone: 'success',
  },
  {
    id: 'avg-resolution',
    label: 'Avg Resolution',
    value: '2.4h',
    sub: 'Target: < 4h',
    icon: Timer,
    iconTone: 'brand',
  },
]

/**
 * The four alerts shown in the mockup, followed by deterministic filler so the
 * "Showing 1-10 of 128 alerts" pager has real pages behind it.
 */
const seedAlerts = [
  {
    id: 'alr-0001',
    type: 'Rebar spacing mismatch',
    location: 'Vertical columns, Level 4 East',
    severity: 'Critical',
    confidence: 92,
    project: 'Grand Sky Plaza',
    detected: '2 mins ago',
    resolved: false,
  },
  {
    id: 'alr-0002',
    type: 'Concrete Slump Anomaly',
    location: 'Batch #204, Foundation Slab',
    severity: 'Medium',
    confidence: 88,
    project: 'Riverview Residency',
    detected: '14 mins ago',
    resolved: false,
  },
  {
    id: 'alr-0003',
    type: 'Piling Depth Shortage',
    location: 'P-102, South Retaining Wall',
    severity: 'Critical',
    confidence: 99,
    project: 'Project Alpha',
    detected: '1 hour ago',
    resolved: false,
  },
  {
    id: 'alr-0004',
    type: 'Thermal Signature Warning',
    location: 'Generator Room B, High Temp',
    severity: 'Low',
    confidence: 76,
    project: 'Terminal 5 Expansion',
    detected: '3 hours ago',
    resolved: false,
  },
]

const fillerTypes = [
  ['Scaffolding Gap Detected', 'Bay 7, West Elevation'],
  ['PPE Compliance Breach', 'Zone 3, Material Yard'],
  ['Formwork Deflection', 'Beam B-12, Level 2'],
  ['Curing Duration Shortfall', 'Slab S-04, East Wing'],
  ['Site Cleanliness Alert', 'Access Corridor, Gate 2'],
  ['Crane Load Threshold', 'Tower Crane TC-1'],
  ['Shuttering Misalignment', 'Column C-31, Level 3'],
  ['Water Ingress Detected', 'Basement B-1, North Face'],
]
const fillerProjects = [
  'Sky Villa 42',
  'Harbor Heights',
  'The Nexus Hub',
  'Oak Creek Estates',
  'Summit View',
]
const fillerSeverity = ['Critical', 'Medium', 'Low', 'Medium', 'Low']

const filler = Array.from({ length: 124 }, (_, i) => {
  const [type, location] = fillerTypes[i % fillerTypes.length]
  return {
    id: `alr-${String(i + 5).padStart(4, '0')}`,
    type,
    location,
    severity: fillerSeverity[i % fillerSeverity.length],
    confidence: 68 + ((i * 7) % 31),
    project: fillerProjects[i % fillerProjects.length],
    detected: `${((i % 22) + 2)} hours ago`,
    resolved: i % 3 === 0,
  }
})

export const alerts = [...seedAlerts, ...filler]

export const severityFilters = ['All Levels', 'Critical', 'Medium', 'Low']
export const statusFilters = ['Active Only', 'Resolved', 'All Statuses']
export const ALERTS_PER_PAGE = 10
