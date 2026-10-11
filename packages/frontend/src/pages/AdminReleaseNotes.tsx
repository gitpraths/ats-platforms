import React, { useState } from "react";
import {
  Calendar,
  Layers,
  Shield,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FileText,
  Printer,
  Code2,
  Lock,
  DollarSign,
  Briefcase,
  Users,
  Eye,
  Sliders,
  Sparkles,
} from "lucide-react";

interface ReleaseItem {
  version: string;
  date: string;
  badge: string;
  title: string;
  summary: string;
  highlights: string[];
  technicalDetails: {
    commits: string[];
    affectedComponents: string[];
    backendChanges?: string[];
  };
}

const releases: ReleaseItem[] = [
  {
    version: "1.5.0",
    date: "11 October 2026",
    badge: "Current Production",
    title: "Granular Permissions Engine & Award Wages Support",
    summary:
      "Full role-based access control with 26 modular permissions across 7 modules, real-time UI action hiding, interactive tooltips, and Australian Modern Award wages support.",
    highlights: [
      "26 distinct permissions categorized into Candidates, Vacancies, Employers, Placements, Trainings, Reports, and Admin.",
      "Manage Permissions modal with category grouping, individual toggles, and role presets (Recruiter, Account Manager, Compliance Officer).",
      "Dynamic Dashboard enforcement: '+ Add Candidate', '+ Add Employer', and '+ Add Vacancy' buttons automatically hide for staff without permissions.",
      "Super Admin deletion protection ensuring ownership accounts cannot be deleted or have critical permissions stripped.",
      "Modern Award flexible compensation support permitting alphanumeric pay rates (e.g. Children's Services Award Level 3, pay ranges).",
      "Interactive floating tooltips on user administration action buttons (Permissions, Edit, Password Reset, Delete).",
    ],
    technicalDetails: {
      commits: ["bf0e4a9", "d27c353", "a6acb30", "2ac4855", "48a30ce", "dc42262", "2ad4a80"],
      affectedComponents: [
        "ManagePermissionsModal.tsx",
        "AdminUsers.tsx",
        "Dashboard.tsx",
        "Jobs.tsx",
        "JobDetail.tsx",
        "CreateJobDialog.tsx",
        "Employers.tsx",
        "EmployerDetail.tsx",
        "Candidates.tsx",
        "CandidateDetail.tsx",
        "Placements.tsx",
        "PlacementDetail.tsx",
        "AdminTrainings.tsx",
      ],
      backendChanges: [
        "Database table: permissions catalog & user_permissions mapping",
        "Backend middleware: checkPermission(requiredKey) guard",
        "GET /api/permissions/catalog endpoint",
        "PUT /api/admin/users/:id/permissions endpoint",
        "Award rate vacancy alphanumeric schema support",
      ],
    },
  },
  {
    version: "1.4.0",
    date: "08 October 2026",
    badge: "Security & Credentials",
    title: "Admin Password Reset & User Profile Credentials",
    summary:
      "Administrative credentials management with dedicated modal, self-service profile password updates with confirmation validation, and user avatar pipeline.",
    highlights: [
      "Admin Reset Password modal allowing administrators to reset user credentials directly from User Management.",
      "User profile password change dialog with real-time match validation and minimum security requirements.",
      "Avatar image upload pipeline with authenticated media serving and real-time header synchronization.",
      "Configurable staff permissions for employer management.",
    ],
    technicalDetails: {
      commits: ["7f67937", "8458b5a"],
      affectedComponents: [
        "ResetPasswordModal.tsx",
        "ChangePasswordModal.tsx",
        "Profile.tsx",
        "AdminUsers.tsx",
        "AuthContext.tsx",
      ],
      backendChanges: [
        "POST /api/admin/users/:id/reset-password endpoint",
        "PUT /api/users/profile/password endpoint",
        "Static avatar upload and token-guarded serving route",
      ],
    },
  },
  {
    version: "1.3.0",
    date: "06 October 2026",
    badge: "Australian Compliance",
    title: "Employer Compliance Fields & Dropdown Data Hygiene",
    summary:
      "Australian business verification fields including ABN and postcode storage, with inactive employer filtering in vacancy and placement dropdowns.",
    highlights: [
      "Added Australian Business Number (ABN) validation and structured storage to employer registration.",
      "Added Australian postcode and street address fields to AddEmployerDialog.",
      "Filtered out deactivated or test employers from Job creation and Placement candidate matching selectors.",
      "Database schema relaxation for candidate intake (intention_to_work field).",
    ],
    technicalDetails: {
      commits: ["597c28d", "c5a5c48", "151c709", "54ae0fb"],
      affectedComponents: [
        "AddEmployerDialog.tsx",
        "Employers.tsx",
        "EmployerDetail.tsx",
        "CreateJobDialog.tsx",
        "PlacementDetail.tsx",
      ],
      backendChanges: [
        "Added abn, address, and postcode columns to employers table",
        "Query condition: status != 'inactive' for dropdown lookup endpoints",
      ],
    },
  },
  {
    version: "1.2.0",
    date: "04 October 2026",
    badge: "Production Setup",
    title: "WorkVision Production Branding & Startup Database Migration",
    summary:
      "Production domain configuration for crm.workvision.com.au, automated database startup initialization, and case-insensitive authentication.",
    highlights: [
      "Updated system branding, page titles, and headers to WorkVision Australia CRM.",
      "Automated database startup initialization and seed scripts on container boot.",
      "Case-insensitive email authentication resolving mobile device capitalizations.",
      "Cleaned development credentials from public login views.",
    ],
    technicalDetails: {
      commits: ["7728a66", "b86dd20", "28b2a21", "71dddc1", "b9bd2d3"],
      affectedComponents: ["Login.tsx", "App.tsx", "server.js", "database/schema-full.sql"],
      backendChanges: [
        "Auto-migration executor on startup",
        "SQL LOWER(email) authentication index lookups",
        "Vite workspace build pipeline adjustments",
      ],
    },
  },
  {
    version: "1.1.0",
    date: "01 - 02 October 2026",
    badge: "Provider Broadcast",
    title: "Multi-Vacancy Provider Broadcast & Communication Engine",
    summary:
      "Broadcast engine allowing recruiters to compile vacancy announcements, customize email drafts, and broadcast to provider networks with full audit logging.",
    highlights: [
      "Multi-vacancy selection checkbox support on the main Vacancies dashboard.",
      "Comprehensive draft email composer with dynamic subject lines, recruiter notes, and reset capability.",
      "Real-time provider search filtering and recipient count calculation.",
      "Broadcast activity logging integrated directly into Vacancy Status and Activity History.",
    ],
    technicalDetails: {
      commits: [
        "80fc093",
        "c0baffd",
        "f5fa2b8",
        "82f5f6e",
        "98ac580",
        "1792327",
        "8c85149",
        "007fc9c",
        "24f4c22",
        "ddab2d8",
      ],
      affectedComponents: [
        "BroadcastMultiModal.tsx",
        "BroadcastToProvidersModal.tsx",
        "Jobs.tsx",
        "JobDetail.tsx",
      ],
      backendChanges: [
        "POST /api/jobs/:id/broadcast-provider endpoint",
        "POST /api/jobs/broadcast-multi endpoint",
        "Broadcast email templating service",
      ],
    },
  },
  {
    version: "1.0.0",
    date: "10 August - 22 September 2026",
    badge: "Core Architecture",
    title: "Three-Tier Roles, Candidate Attribution & Session Continuity",
    summary:
      "Foundational role access levels, candidate sourcing attribution tracking, reporting exports, and session extension dialog.",
    highlights: [
      "Three primary role access levels: super_admin, admin, and staff.",
      "Candidate sourcing attribution ('Sourced By': Staff, Existing Employer, Lead Generator) across cards and CSV exports.",
      "Hiring board and administrative report route protections.",
      "Session expiring dialog with token extension persistence.",
    ],
    technicalDetails: {
      commits: ["ce4d90f", "ce16d2c", "811c443", "2558ccf", "49d8827", "14e83ca", "5801ad8"],
      affectedComponents: [
        "SessionExpiringDialog.tsx",
        "HiringBoard.tsx",
        "Reports.tsx",
        "Candidates.tsx",
        "Jobs.tsx",
        "App.tsx",
      ],
      backendChanges: [
        "Added sourced_by column to candidates and vacancies tables",
        "Role-checking route wrappers",
        "Session refresh token handler",
      ],
    },
  },
];

export default function AdminReleaseNotes() {
  const [activeTab, setActiveTab] = useState<"releases" | "implementation">("releases");
  const [expandedReleases, setExpandedReleases] = useState<Record<string, boolean>>({
    "1.5.0": true,
  });

  const toggleExpand = (version: string) => {
    setExpandedReleases((prev) => ({
      ...prev,
      [version]: !prev[version],
    }));
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 border-b border-slate-200 gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider bg-slate-900 text-white rounded">
              Confidential Admin Documentation
            </span>
            <span className="text-xs text-slate-500 font-medium">WorkVision Australia ATS</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">
            System Releases & Implementation Report
          </h1>
          <p className="text-sm text-slate-600 mt-0.5">
            Date-wise platform release logs, technical architecture, and verification records.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition shadow-sm"
          >
            <Printer size={15} /> Print / Save View
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 mt-6 border-b border-slate-200">
        <button
          onClick={() => setActiveTab("releases")}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition ${
            activeTab === "releases"
              ? "border-[#e88e2e] text-slate-900"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Calendar size={16} /> Date-Wise Release History ({releases.length})
        </button>

        <button
          onClick={() => setActiveTab("implementation")}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition ${
            activeTab === "implementation"
              ? "border-[#e88e2e] text-slate-900"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <FileText size={16} /> WorkVision Implementation & Technical Report
        </button>
      </div>

      {/* Content Area */}
      <div className="mt-6">
        {activeTab === "releases" ? (
          /* TAB 1: DATE-WISE RELEASES */
          <div className="space-y-6">
            <div className="bg-amber-50/60 border border-amber-200/80 rounded-xl p-4 flex items-start gap-3">
              <Sparkles size={18} className="text-[#e88e2e] mt-0.5 flex-shrink-0" />
              <div className="text-sm text-slate-700">
                <span className="font-semibold text-slate-900">Administrator Release Log:</span>{" "}
                All releases below are ordered chronologically by deployment date. Click on{" "}
                <span className="font-semibold">Technical Details & Commits</span> under any release
                to review affected components, commit hashes, and backend changes.
              </div>
            </div>

            <div className="space-y-4">
              {releases.map((rel) => {
                const isExpanded = !!expandedReleases[rel.version];
                return (
                  <div
                    key={rel.version}
                    className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm transition hover:border-slate-300"
                  >
                    {/* Header */}
                    <div className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-50/50 border-b border-slate-100">
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="px-2.5 py-1 text-xs font-bold font-mono bg-slate-900 text-white rounded">
                          v{rel.version}
                        </span>
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 bg-white px-2.5 py-1 rounded border border-slate-200">
                          <Calendar size={13} className="text-slate-400" />
                          {rel.date}
                        </div>
                        <span className="px-2.5 py-1 text-xs font-semibold bg-orange-100 text-orange-800 rounded">
                          {rel.badge}
                        </span>
                      </div>

                      <button
                        onClick={() => toggleExpand(rel.version)}
                        className="flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 self-start md:self-auto px-2.5 py-1 rounded hover:bg-slate-100 transition"
                      >
                        {isExpanded ? (
                          <>
                            <ChevronUp size={14} /> Hide Technical Details
                          </>
                        ) : (
                          <>
                            <ChevronDown size={14} /> Show Technical Details & Commits
                          </>
                        )}
                      </button>
                    </div>

                    {/* Body */}
                    <div className="p-5">
                      <h3 className="text-lg font-bold text-slate-900 mb-1.5">{rel.title}</h3>
                      <p className="text-sm text-slate-600 mb-4">{rel.summary}</p>

                      <div className="space-y-2 mb-4">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                          Key Enhancements & Functional Changes
                        </h4>
                        <ul className="space-y-1.5 text-sm text-slate-700">
                          {rel.highlights.map((item, idx) => (
                            <li key={idx} className="flex items-start gap-2">
                              <CheckCircle2
                                size={15}
                                className="text-emerald-600 mt-0.5 flex-shrink-0"
                              />
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Technical Details (Expandable) */}
                      {isExpanded && (
                        <div className="mt-4 pt-4 border-t border-slate-100 bg-slate-50/80 -mx-5 -mb-5 p-5">
                          <div className="flex items-center gap-2 mb-3">
                            <Code2 size={16} className="text-slate-700" />
                            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                              Technical Implementation Details
                            </h4>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                            {/* Commits */}
                            <div className="bg-white p-3 rounded-lg border border-slate-200">
                              <span className="font-semibold text-slate-800 block mb-1.5">
                                Git Commits:
                              </span>
                              <div className="flex flex-wrap gap-1.5">
                                {rel.technicalDetails.commits.map((hash) => (
                                  <span
                                    key={hash}
                                    className="font-mono bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200"
                                  >
                                    {hash}
                                  </span>
                                ))}
                              </div>
                            </div>

                            {/* Backend Changes if any */}
                            {rel.technicalDetails.backendChanges && (
                              <div className="bg-white p-3 rounded-lg border border-slate-200">
                                <span className="font-semibold text-slate-800 block mb-1.5">
                                  Backend & Database:
                                </span>
                                <ul className="space-y-1 text-slate-600">
                                  {rel.technicalDetails.backendChanges.map((b, bIdx) => (
                                    <li key={bIdx} className="flex items-center gap-1.5">
                                      <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                                      {b}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {/* Affected Components */}
                            <div className="bg-white p-3 rounded-lg border border-slate-200 md:col-span-2">
                              <span className="font-semibold text-slate-800 block mb-1.5">
                                Affected Components ({rel.technicalDetails.affectedComponents.length}):
                              </span>
                              <div className="flex flex-wrap gap-1.5 font-mono text-[11px] text-slate-600">
                                {rel.technicalDetails.affectedComponents.map((comp) => (
                                  <span
                                    key={comp}
                                    className="bg-slate-100 px-2 py-0.5 rounded border border-slate-200"
                                  >
                                    {comp}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* TAB 2: TECHNICAL IMPLEMENTATION REPORT */
          <div className="space-y-8 bg-white border border-slate-200 rounded-xl p-6 md:p-8 shadow-sm">
            {/* Header / Meta */}
            <div className="pb-6 border-b border-slate-200">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-orange-600 bg-orange-50 px-2.5 py-1 rounded border border-orange-200">
                    Official Implementation Report
                  </span>
                  <h2 className="text-2xl font-bold text-slate-900 mt-2">
                    WorkVision ATS Capability Implementation Report
                  </h2>
                  <p className="text-sm text-slate-600 mt-1">
                    System Architecture, Granular Permissions Engine, Award Wages & Cross-Cutting
                    Testing Rationale
                  </p>
                </div>
                <div className="text-right text-xs text-slate-500">
                  <p>
                    <span className="font-semibold text-slate-700">Platform:</span> WorkVision
                    Australia
                  </p>
                  <p>
                    <span className="font-semibold text-slate-700">Scope:</span> Award Wages & RBAC
                    Permissions
                  </p>
                  <p>
                    <span className="font-semibold text-slate-700">Status:</span> Production Verified
                  </p>
                </div>
              </div>
            </div>

            {/* Section 1: Executive Summary */}
            <div>
              <h3 className="text-lg font-bold text-slate-900 mb-2 flex items-center gap-2">
                <FileText size={18} className="text-[#e88e2e]" /> 1. Executive Summary & Scope
              </h3>
              <p className="text-sm text-slate-700 leading-relaxed">
                This report confirms the implementation, unit testing, regression testing, and
                verification of two foundational platform capabilities:
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                <div className="bg-slate-50 border border-slate-200 p-4 rounded-lg">
                  <h4 className="text-sm font-bold text-slate-900 mb-1 flex items-center gap-1.5">
                    <Briefcase size={16} className="text-slate-700" /> Modern Award Wages & Pay Rates
                  </h4>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Full integration of Fair Work Australian Modern Awards, support for
                    alphanumeric pay rates and ranges, automated validation checks, and seamless
                    syncing across vacancy cards and edit dialogs.
                  </p>
                </div>

                <div className="bg-slate-50 border border-slate-200 p-4 rounded-lg">
                  <h4 className="text-sm font-bold text-slate-900 mb-1 flex items-center gap-1.5">
                    <Shield size={16} className="text-slate-700" /> Granular Permissions Engine
                  </h4>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Enterprise role-based access control engine providing 26 distinct permissions
                    across 7 modules, three account tiers, role presets, and UI-level button
                    enforcement across all platform screens.
                  </p>
                </div>
              </div>
            </div>

            {/* Section 2: Award Wages Architecture */}
            <div>
              <h3 className="text-lg font-bold text-slate-900 mb-2 flex items-center gap-2">
                <Briefcase size={18} className="text-[#e88e2e]" /> 2. Award Wages & Flexible Pay Rates
              </h3>
              <div className="space-y-3 text-sm text-slate-700">
                <p>
                  The recruitment platform requires compliance with Australian Fair Work Modern
                  Awards. The implementation supports four pay type models:
                </p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                  <div className="p-3 bg-slate-50 rounded border border-slate-200">
                    <span className="font-bold text-slate-900 block">Hourly Rate</span>
                    <span className="text-slate-600">AUD amount per hour with minimum wage guard</span>
                  </div>
                  <div className="p-3 bg-slate-50 rounded border border-slate-200">
                    <span className="font-bold text-slate-900 block">Annual Salary</span>
                    <span className="text-slate-600">Full-time compensation brackets</span>
                  </div>
                  <div className="p-3 bg-slate-50 rounded border border-slate-200">
                    <span className="font-bold text-slate-900 block">Daily Rate</span>
                    <span className="text-slate-600">Contractor day rate structures</span>
                  </div>
                  <div className="p-3 bg-slate-50 rounded border border-slate-200">
                    <span className="font-bold text-slate-900 block">Modern Award</span>
                    <span className="text-slate-600">Named Fair Work Award tier and classification</span>
                  </div>
                </div>
                <ul className="space-y-1.5 text-xs text-slate-600 mt-2 list-disc pl-5">
                  <li>
                    <strong>Alphanumeric Schema:</strong> Vacancy creation and editing accept
                    textual descriptions (e.g. "Children's Services Award Level 3", "AUD 32 - AUD 38 / hr")
                    without strict integer conversion failures.
                  </li>
                  <li>
                    <strong>Audit Trail:</strong> Any compensation adjustments are logged in vacancy
                    activity logs with the modifying recruiter's attribution.
                  </li>
                </ul>
              </div>
            </div>

            {/* Section 3: Granular Permissions Catalog */}
            <div>
              <h3 className="text-lg font-bold text-slate-900 mb-2 flex items-center gap-2">
                <Shield size={18} className="text-[#e88e2e]" /> 3. Granular Permissions Catalog (26 Keys)
              </h3>
              <p className="text-sm text-slate-700 mb-3">
                Permissions are organized across seven functional modules with strict backend
                enforcement:
              </p>

              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-100 text-slate-700 uppercase font-semibold">
                    <tr>
                      <th className="px-4 py-2.5">Module</th>
                      <th className="px-4 py-2.5">Permission Keys</th>
                      <th className="px-4 py-2.5">Description</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    <tr>
                      <td className="px-4 py-2.5 font-bold text-slate-900">Candidates</td>
                      <td className="px-4 py-2.5 font-mono text-orange-700">
                        view, create, edit, delete, export
                      </td>
                      <td className="px-4 py-2.5 text-slate-600">
                        Candidate registry intake, talent editing, profile removal, and CSV export.
                      </td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2.5 font-bold text-slate-900">Vacancies / Jobs</td>
                      <td className="px-4 py-2.5 font-mono text-orange-700">
                        view, create, edit, delete, manage_stages
                      </td>
                      <td className="px-4 py-2.5 text-slate-600">
                        Job requisition posting, compensation editing, pipeline progression.
                      </td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2.5 font-bold text-slate-900">Employers</td>
                      <td className="px-4 py-2.5 font-mono text-orange-700">
                        view, create, edit, delete
                      </td>
                      <td className="px-4 py-2.5 text-slate-600">
                        Client organization creation, ABN updates, contact management.
                      </td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2.5 font-bold text-slate-900">Placements</td>
                      <td className="px-4 py-2.5 font-mono text-orange-700">
                        view, create, edit, approve
                      </td>
                      <td className="px-4 py-2.5 text-slate-600">
                        Candidate placement workflows and executive placement sign-off.
                      </td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2.5 font-bold text-slate-900">Training Programs</td>
                      <td className="px-4 py-2.5 font-mono text-orange-700">
                        view, create, edit, delete
                      </td>
                      <td className="px-4 py-2.5 text-slate-600">
                        Course catalog management and participant cohort assignment.
                      </td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2.5 font-bold text-slate-900">Reports & Analytics</td>
                      <td className="px-4 py-2.5 font-mono text-orange-700">view, export</td>
                      <td className="px-4 py-2.5 text-slate-600">
                        Vacancy, candidate, and placement metrics with export capabilities.
                      </td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2.5 font-bold text-slate-900">System Admin</td>
                      <td className="px-4 py-2.5 font-mono text-orange-700">
                        users, settings, logs
                      </td>
                      <td className="px-4 py-2.5 text-slate-600">
                        User creation, password resets, permission assignments, audit history.
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Section 4: Account Tier Safeguards */}
            <div>
              <h3 className="text-lg font-bold text-slate-900 mb-2 flex items-center gap-2">
                <Lock size={18} className="text-[#e88e2e]" /> 4. Account Tier Safeguards
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200">
                  <span className="font-bold text-slate-900 block mb-1">Super Admin Tier</span>
                  <p className="text-slate-600 leading-relaxed">
                    Unrestricted platform control. Protected against deletion, permission stripping,
                    or status deactivation at both API and frontend levels (Kavil Desai, Dhaval Desai).
                  </p>
                </div>

                <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200">
                  <span className="font-bold text-slate-900 block mb-1">Admin Tier</span>
                  <p className="text-slate-600 leading-relaxed">
                    Full operational control across candidates, vacancies, placements, and reports.
                    Cannot modify or delete Super Admin records.
                  </p>
                </div>

                <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200">
                  <span className="font-bold text-slate-900 block mb-1">Staff Tier (Granular)</span>
                  <p className="text-slate-600 leading-relaxed">
                    Access strictly defined by assigned permissions. Includes one-click presets for
                    Recruiter, Account Manager, and Compliance Officer.
                  </p>
                </div>
              </div>
            </div>

            {/* Section 5: Cross-Cutting Impact & Unit Testing Rationale */}
            <div>
              <h3 className="text-lg font-bold text-slate-900 mb-2 flex items-center gap-2">
                <Layers size={18} className="text-[#e88e2e]" /> 5. Cross-Cutting Impact & Testing Rationale
              </h3>
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-xs text-slate-700 space-y-2.5">
                <p className="font-semibold text-slate-900 text-sm">
                  Why Cross-Cutting Permissions Required Comprehensive Testing:
                </p>
                <p className="leading-relaxed">
                  Unlike isolated features that exist on a single screen, permissions are a
                  fundamental <strong>cross-cutting concern</strong> that affects every primary page
                  and interaction within the ATS platform:
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-slate-600 font-mono text-[11px] bg-white p-3 rounded border border-slate-200">
                  <div>
                    • Dashboard: Quick-Add action buttons
                    <br />
                    • Vacancies: Job creation dialog, pipeline stages
                    <br />
                    • Employers: Registration, editing, deactivation
                  </div>
                  <div>
                    • Candidates: Profile intake, talent progression
                    <br />
                    • Placements: Approval actions, detail updates
                    <br />
                    • Admin Users: Tooltips, permission modal, presets
                  </div>
                </div>
                <p className="leading-relaxed text-slate-600">
                  Because changing permission models touches all entry points across the
                  application, extensive unit testing and regression passes were essential prior to
                  production release to guarantee that no unintended user lockouts occur and that
                  action buttons accurately reflect each user's assigned scope.
                </p>
              </div>
            </div>

            {/* Section 6: Quality Assurance & UAT Matrix */}
            <div>
              <h3 className="text-lg font-bold text-slate-900 mb-2 flex items-center gap-2">
                <CheckCircle2 size={18} className="text-[#e88e2e]" /> 6. Quality Assurance & Verification Matrix
              </h3>
              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-100 text-slate-700 uppercase font-semibold">
                    <tr>
                      <th className="px-4 py-2.5">Test Case</th>
                      <th className="px-4 py-2.5">Verification Steps</th>
                      <th className="px-4 py-2.5">Expected Result</th>
                      <th className="px-4 py-2.5 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    <tr>
                      <td className="px-4 py-2.5 font-bold text-slate-900">Award Rate Creation</td>
                      <td className="px-4 py-2.5 text-slate-600">
                        Create vacancy with pay rate "Storage Services Award Level 2"
                      </td>
                      <td className="px-4 py-2.5 text-slate-600">
                        Saved without error; displayed cleanly across cards
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <span className="px-2 py-0.5 rounded font-bold bg-emerald-100 text-emerald-800">
                          PASS
                        </span>
                      </td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2.5 font-bold text-slate-900">Award Rate Editing</td>
                      <td className="px-4 py-2.5 text-slate-600">
                        Edit vacancy with award rate; modify location and save
                      </td>
                      <td className="px-4 py-2.5 text-slate-600">
                        Award text and pay type preserved without corruption
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <span className="px-2 py-0.5 rounded font-bold bg-emerald-100 text-emerald-800">
                          PASS
                        </span>
                      </td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2.5 font-bold text-slate-900">Permissions Modal</td>
                      <td className="px-4 py-2.5 text-slate-600">
                        In Admin &gt; Users, click Shield icon for any staff member
                      </td>
                      <td className="px-4 py-2.5 text-slate-600">
                        Modal opens showing all 7 categories and 26 tick boxes
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <span className="px-2 py-0.5 rounded font-bold bg-emerald-100 text-emerald-800">
                          PASS
                        </span>
                      </td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2.5 font-bold text-slate-900">Role Presets</td>
                      <td className="px-4 py-2.5 text-slate-600">
                        Click "HR", "Staff", or "Marketing" preset buttons in modal
                      </td>
                      <td className="px-4 py-2.5 text-slate-600">
                        Checkboxes instantly toggle to role defaults
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <span className="px-2 py-0.5 rounded font-bold bg-emerald-100 text-emerald-800">
                          PASS
                        </span>
                      </td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2.5 font-bold text-slate-900">Dashboard Enforcement</td>
                      <td className="px-4 py-2.5 text-slate-600">
                        Remove "Create Employers" from staff user and refresh Dashboard
                      </td>
                      <td className="px-4 py-2.5 text-slate-600">
                        The blue "+ Add Employer" button disappears completely
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <span className="px-2 py-0.5 rounded font-bold bg-emerald-100 text-emerald-800">
                          PASS
                        </span>
                      </td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2.5 font-bold text-slate-900">Super Admin Guard</td>
                      <td className="px-4 py-2.5 text-slate-600">
                        Inspect rows for Kavil Desai and Dhaval Desai in User table
                      </td>
                      <td className="px-4 py-2.5 text-slate-600">
                        Trash icon is locked; account cannot be deleted
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <span className="px-2 py-0.5 rounded font-bold bg-emerald-100 text-emerald-800">
                          PASS
                        </span>
                      </td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2.5 font-bold text-slate-900">Action Tooltips</td>
                      <td className="px-4 py-2.5 text-slate-600">
                        Hover cursor over Shield, Pencil, Key, and Trash buttons
                      </td>
                      <td className="px-4 py-2.5 text-slate-600">
                        Dark floating tooltips appear immediately
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <span className="px-2 py-0.5 rounded font-bold bg-emerald-100 text-emerald-800">
                          PASS
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
