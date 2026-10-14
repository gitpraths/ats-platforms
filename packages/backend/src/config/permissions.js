// ── Permissions Catalog & Role Defaults ───────────────────────────────────────

export const SUPER_ADMIN_EMAILS = (process.env.SUPER_ADMIN_EMAILS || "kavil@workvision.com.au,dhaval@workvision.com.au")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

export const PERMISSIONS_CATALOG = [
  {
    module: "employers",
    name: "Employers",
    description: "Employer directory, company profiles, and account management",
    permissions: [
      { id: "employers:view",   label: "View Employers",   description: "Browse employer list and view company profiles" },
      { id: "employers:create", label: "Create Employers", description: "Add new employer companies and contacts" },
      { id: "employers:edit",   label: "Edit Employers",   description: "Update company details, contacts, and preferences" },
      { id: "employers:delete", label: "Delete Employers", description: "Deactivate or permanently remove employers" },
    ],
  },
  {
    module: "jobs",
    name: "Vacancies",
    description: "Job postings, requirements, compliance, and public listings",
    permissions: [
      { id: "jobs:view",    label: "View Vacancies",    description: "Browse vacancy listings and view job specifications" },
      { id: "jobs:create",  label: "Create Vacancies",  description: "Post new job vacancies and configure requirements" },
      { id: "jobs:edit",    label: "Edit Vacancies",    description: "Edit vacancy descriptions, pay rates, and locations" },
      { id: "jobs:publish", label: "Publish / Status",  description: "Change status between draft, open, closed, and archived" },
      { id: "jobs:delete",  label: "Delete Vacancies",  description: "Permanently delete or archive job vacancies" },
    ],
  },
  {
    module: "candidates",
    name: "Candidates & Talent",
    description: "Candidate database, resumes, skills, and talent matching",
    permissions: [
      { id: "candidates:view",   label: "View Candidates",   description: "Search and browse candidate profiles and resumes" },
      { id: "candidates:create", label: "Create Candidates", description: "Add new candidates manually or via import" },
      { id: "candidates:edit",   label: "Edit Candidates",   description: "Update candidate profiles, notes, and attachments" },
      { id: "candidates:delete", label: "Delete Candidates", description: "Remove candidate records from the database" },
    ],
  },
  {
    module: "placements",
    name: "Placements & Welfare",
    description: "Candidate placements, job matching, and ongoing welfare checks",
    permissions: [
      { id: "placements:view",    label: "View Placements",    description: "Browse candidate placements and placement status" },
      { id: "placements:create",  label: "Create Placements",  description: "Assign talent and confirm job placements" },
      { id: "placements:welfare", label: "Log Welfare Checks", description: "Record post-placement contact and welfare notes" },
      { id: "placements:confirm", label: "Confirm Agreements", description: "Confirm employer placement agreements" },
    ],
  },
  {
    module: "training",
    name: "Training Programs",
    description: "Accredited training, courses, cohorts, and candidate enrolments",
    permissions: [
      { id: "training:view",   label: "View Training",   description: "Browse courses, enrolments, and completion status" },
      { id: "training:enroll", label: "Enroll Talent",   description: "Enroll candidates into training courses" },
      { id: "training:manage", label: "Manage Courses",  description: "Create and configure courses, modules, and providers" },
    ],
  },
  {
    module: "reports",
    name: "Reports & Financials",
    description: "Analytics dashboards, placement metrics, and financial reporting",
    permissions: [
      { id: "reports:view",       label: "View Reports",       description: "Access general operational reports and dashboards" },
      { id: "reports:financials", label: "View Financials",    description: "View wage subsidies, invoices, and financial KPIs" },
      { id: "reports:export",     label: "Export Data (Excel)", description: "Export candidates, vacancies, and report data to CSV/Excel" },
    ],
  },
  {
    module: "admin",
    name: "System Administration",
    description: "User management, access control, and platform master lookups",
    permissions: [
      { id: "admin:users",       label: "Manage Users",        description: "Create, edit, and deactivate user accounts" },
      { id: "admin:permissions", label: "Manage Permissions",  description: "Assign and customize user permission tick boxes" },
      { id: "admin:master_data", label: "Manage Master Data",  description: "Configure industries, work types, and lookups" },
    ],
  },
];

// Flat list of all 24 permission IDs
export const ALL_PERMISSION_IDS = PERMISSIONS_CATALOG.flatMap((m) =>
  m.permissions.map((p) => p.id)
);

// Role-based default permission mappings
export const ROLE_DEFAULTS = {
  super_admin: [...ALL_PERMISSION_IDS],

  admin: [...ALL_PERMISSION_IDS],

  staff: [
    "employers:view",
    "employers:create",
    "jobs:view",
    "jobs:create",
    "jobs:edit",
    "candidates:view",
    "candidates:create",
    "candidates:edit",
    "placements:view",
    "placements:create",
    "placements:welfare",
    "training:view",
    "training:enroll",
    "reports:view",
  ],

  hr: [
    "candidates:view",
    "candidates:create",
    "candidates:edit",
    "placements:view",
    "placements:welfare",
    "training:view",
    "training:enroll",
    "employers:view",
    "reports:view",
  ],

  marketing: [
    "jobs:view",
    "employers:view",
    "reports:view",
    "reports:export",
  ],
};
