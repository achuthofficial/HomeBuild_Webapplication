/**
 * Every English string the localised surfaces render.
 *
 * This is the SOURCE, not one translation among several. There are no
 * per-language files: the selected language is produced at runtime by
 * `src/i18n/translator.js`, which translates these strings on the device and
 * caches the result. Adding a string here is all that is needed to have it
 * translated into every supported language.
 *
 * `{placeholders}` are substituted AFTER translation, by `t(key, values)`.
 * A translation that loses a placeholder is rejected and falls back to
 * English — see `translateStrings`.
 */
export default {
  common: {
    cancel: 'Cancel',
    save: 'Save Changes',
    saving: 'Saving…',
    close: 'Close',
  },

  nav: {
    overview: 'Overview',
    projects: 'Projects',
    construction: 'Construction',
    finance: 'Finance',
    schedule: 'Schedule',
    contractors: 'Contractors',
    analytics: 'Analytics',
    support: 'Support',
    settings: 'Settings',
    primary: 'Primary',
    closeNavigation: 'Close navigation',
    openNavigation: 'Open navigation',
    tagline: 'Construction Management',
  },

  topbar: {
    searchDocuments: 'Search projects, documents, or alerts...',
    searchTasks: 'Search tasks, milestones, or people...',
    search: 'Search',
    searching: 'Searching…',
    noResults: 'Nothing matches “{term}”.',
    createProject: 'Create New Project',
    createProjectShort: 'Create new project',
    notificationsNone: 'Notifications — none open',
    openAlerts: '{count} open alerts',
    openAlert: '1 open alert',
    noOpenAlerts: 'No open alerts.',
    messages: 'Messages',
    messagingUnavailable:
      'Direct messaging is not built yet — reach a colleague from Support.',
    switchToLight: 'Switch to light mode',
    switchToDark: 'Switch to dark mode',
    profileSettings: 'Profile & Settings',
    logOut: 'Log Out',
  },

  search: {
    projects: 'Projects',
    milestones: 'Milestones',
    alerts: 'Alerts',
    contractors: 'Contractors',
    updates: 'Site Updates',
  },

  page: {
    dashboard: {
      title: 'Executive Dashboard',
      subtitle:
        'Welcome back, {name}. Here is your portfolio status for today.',
    },
    projects: {
      title: 'Project Portfolio',
      subtitle: 'Manage and track progress across {count} construction sites.',
      loading: 'Loading your portfolio…',
      home: 'Home',
      breadcrumb: 'Active Projects',
    },
    construction: {
      title: 'Daily Site Feed',
      subtitle: 'Real-time construction logs from site supervisors',
    },
    finance: {
      title: 'Financial Overview',
      subtitle: 'Budget, escrow and spend tracking.',
      subtitleNamed: 'Budget, escrow and spend for {project}.',
    },
    schedule: {
      title: 'Master Construction Schedule',
      breadcrumb: 'Schedule',
    },
    contractors: {
      eyebrow: 'Resources',
      title: 'Contractor Management',
      subtitle:
        'Directory of active verified partners and performance tracking.',
    },
    analytics: {
      title: 'AI Alert Management',
      subtitle: 'Real-time structural monitoring and anomaly detection system.',
    },
    support: {
      eyebrow: 'Help',
      title: 'Support',
      subtitle:
        'Three ways to reach us, and the account details worth including when you do.',
    },
  },

  settings: {
    editProfile: 'Edit Profile',
    logOut: 'Log Out',
    changePhoto: 'Change profile photo',
    activeProjects: 'Active Projects',
    teamsLed: 'Teams Led',

    accountSecurity: 'Account & Security',
    emailAddress: 'Email Address',
    verified: 'Verified',
    notVerified: 'Not verified',
    resendEmail: 'Resend email',
    sending: 'Sending…',
    alreadyDone: 'Already done?',
    verificationSent: 'Verification email sent. Check your inbox.',
    statusRefreshed: 'Status refreshed.',
    contactNumber: 'Contact Number',

    teamManagement: 'Team Management',
    inviteMember: 'Invite Member',
    noTeamMembers: 'No team members yet',
    noTeamMembersBody:
      "Invite a colleague and they'll appear here — nobody is added to your team without an invitation.",
    invitedAs: 'Invited as {role}',
    memberActions: 'Actions for {name}',
    recentActivity: 'Recent activity',
    noActivity: 'No recorded activity',
    noActivityBody: 'Changes this person makes will be listed here.',
    revokeInvitation: 'Revoke invitation',
    invitePendingNote:
      'Invited as {role}. They join once they create an account with this address.',
    inviteExpiredNote:
      'This invitation expired before {email} signed up. Revoke it and send a fresh one.',
    adminRoleNote:
      'Changing another member’s role or deactivating them needs an administrator role, which isn’t part of the permission model yet. Each person sets their own role from their profile.',
    invitationRecorded: 'Invitation recorded for {email}.',
    invitationRevoked: 'Invitation for {email} revoked.',

    status: {
      active: 'ACTIVE',
      pending: 'PENDING',
      expired: 'EXPIRED',
    },

    role: {
      project_manager: 'Project Manager',
      site_supervisor: 'Site Supervisor',
      customer: 'Customer',
    },

    invite: {
      title: 'Invite Member',
      description: 'Send a workspace invitation by email.',
      email: 'Email Address',
      role: 'Role',
      send: 'Send Invite',
      creating: 'Creating…',
      note: 'The invitation is recorded and expires in 7 days. Email delivery needs a mail provider that is not configured in this build, so share the link manually for now.',
    },

    systemPreferences: 'System Preferences',
    language: 'Language',
    languageChanged: 'Interface language set to {language}.',
    displayTheme: 'Display Theme',
    followingDevice: 'Following your device — currently {mode}',
    lockedTo: 'Locked to {mode}',
    modeDark: 'dark',
    modeLight: 'light',
    lightMode: 'Light Mode',
    darkMode: 'Dark Mode',
    systemMode: 'System',
    themeFollowsDevice: 'Theme now follows your device setting.',
    themeEnabled: '{mode} mode enabled.',
    themeNote:
      'The mockups are light-only, so the dark palette is an authored counterpart rather than a sampled one — it preserves the light palette’s relationships instead of its hex values.',

    profilePhotoUpdated: 'Profile photo updated.',
    profileUpdated: 'Profile updated.',
    passwordUpdated: 'Password updated.',
  },
}
