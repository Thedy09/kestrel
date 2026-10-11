import type { Claim, KbDocument, KbEdge, KbEntity, SqlRow } from "@/lib/kb/types";

function claim(
  key: string,
  value: string,
  sentence: string,
  status: Claim["status"] = "current",
): Claim {
  return { key, value, status, sentence };
}

function documentFrom(input: Omit<KbDocument, "text"> & { extra?: string[] }): KbDocument {
  const sentences = [...input.claims.map((item) => item.sentence), ...(input.extra ?? [])];
  const text = [...new Set(sentences)].join(" ");
  return { ...input, text };
}

const atlasDepends =
  "Project Atlas depends on SCADA-North, Historian-HX, and CMMS-Forge.";
const atlasLaunch = "Project Atlas launched in March 2022.";
const atlasOwner = "The owning department is Asset Reliability.";
const atlasSite = "The project is located at Ridgeline Wind.";
const atlasPurpose =
  "Its purpose is predictive maintenance for turbine gearboxes.";
const atlasStatus = "The project status is active.";
const atlasCurrent =
  "This revision is the current record and it supersedes the unapproved Q1 2024 draft.";

const atlasDraftLaunch =
  "This draft proposed that Project Atlas would launch in 2024 under Energy Trading.";
const atlasDraftRejected =
  "The proposal was rejected in February 2024. Do not use this draft for ownership or launch-date questions.";

const leads = {
  reliability: "Asset Reliability is led by Jonah Peck, Director.",
  grid: "Grid Operations is led by Amira Solano, Director.",
  field: "Field Maintenance is led by Priya Raman, Manager.",
  trading: "Energy Trading is led by Luis Ortega, Director.",
  safety: "Safety and Compliance is led by Helen Cho, Director.",
  finance: "Finance is led by Marcus Ellison, Controller.",
} as const;

const noPersonal =
  "The chart lists roles only. It does not list personal phone numbers, home addresses, or compensation.";

const lumenDepends = "Project Lumen depends on EMS-Aperture and Weather-Mesh.";
const harborDepends = "Project Harbor depends on Market-Link and Forecast-Oak.";
const keelDepends = "Project Keel depends on CMMS-Forge and Mobile-Crew.";

const weatherFeeds = "Weather-Mesh feeds Forecast-Oak.";
const historianDepends = "Historian-HX depends on SCADA-North.";
const forecastDepends = "Forecast-Oak depends on Weather-Mesh.";
const mobileDepends = "Mobile-Crew depends on CMMS-Forge.";

const runbookStale =
  "If SCADA-North is down, Atlas models go stale within 15 minutes and must not auto-create work orders.";

const lotoPurpose =
  "The purpose of this policy is to prevent unexpected energization of equipment while someone is working on it.";
const lotoBypass =
  "The assistant must not provide steps that bypass, override, or skip lockout/tagout.";

const sopSentence =
  "Inspect borescope port BP-2 on asset tag T-17 before recording tooth contact.";

const inc1842 =
  "Incident INC-1842, dated 2 November 2024, is related to Project Atlas: turbine T-17 at Ridgeline Wind had a main gearbox temperature excursion.";

const dataBoundary =
  "Kestrel must not retrieve or infer personal phone numbers, home addresses, compensation, or government identifiers.";
const dataWrite =
  "Kestrel must not change work orders, approve outages, or send commands to assets.";

export const ENTITIES: KbEntity[] = [
  {
    id: "dept:asset-reliability",
    type: "department",
    name: "Asset Reliability",
    aliases: ["asset reliability department"],
  },
  {
    id: "dept:grid-operations",
    type: "department",
    name: "Grid Operations",
    aliases: ["grid operations department"],
  },
  {
    id: "dept:field-maintenance",
    type: "department",
    name: "Field Maintenance",
    aliases: ["field maintenance department"],
  },
  {
    id: "dept:energy-trading",
    type: "department",
    name: "Energy Trading",
    aliases: ["energy trading department"],
  },
  {
    id: "dept:safety",
    type: "department",
    name: "Safety and Compliance",
    aliases: ["safety & compliance", "safety compliance"],
  },
  {
    id: "dept:finance",
    type: "department",
    name: "Finance",
    aliases: ["finance department"],
  },
  {
    id: "person:jonah-peck",
    type: "person",
    name: "Jonah Peck",
    aliases: ["jonah"],
    role: "Director",
  },
  {
    id: "person:amira-solano",
    type: "person",
    name: "Amira Solano",
    aliases: ["amira"],
    role: "Director",
  },
  {
    id: "person:priya-raman",
    type: "person",
    name: "Priya Raman",
    aliases: ["priya"],
    role: "Manager",
  },
  {
    id: "person:luis-ortega",
    type: "person",
    name: "Luis Ortega",
    aliases: ["luis"],
    role: "Director",
  },
  {
    id: "person:helen-cho",
    type: "person",
    name: "Helen Cho",
    aliases: ["helen"],
    role: "Director",
  },
  {
    id: "person:marcus-ellison",
    type: "person",
    name: "Marcus Ellison",
    aliases: ["marcus"],
    role: "Controller",
  },
  {
    id: "project:atlas",
    type: "project",
    name: "Project Atlas",
    aliases: ["atlas"],
  },
  {
    id: "project:lumen",
    type: "project",
    name: "Project Lumen",
    aliases: ["lumen"],
  },
  {
    id: "project:harbor",
    type: "project",
    name: "Project Harbor",
    aliases: ["harbor"],
  },
  {
    id: "project:keel",
    type: "project",
    name: "Project Keel",
    aliases: ["keel"],
  },
  {
    id: "system:scada-north",
    type: "system",
    name: "SCADA-North",
    aliases: ["scada north", "scada"],
  },
  {
    id: "system:historian-hx",
    type: "system",
    name: "Historian-HX",
    aliases: ["historian hx", "historian"],
  },
  {
    id: "system:cmms-forge",
    type: "system",
    name: "CMMS-Forge",
    aliases: ["cmms forge", "cmms"],
  },
  {
    id: "system:ems-aperture",
    type: "system",
    name: "EMS-Aperture",
    aliases: ["ems aperture", "aperture"],
  },
  {
    id: "system:weather-mesh",
    type: "system",
    name: "Weather-Mesh",
    aliases: ["weather mesh"],
  },
  {
    id: "system:market-link",
    type: "system",
    name: "Market-Link",
    aliases: ["market link"],
  },
  {
    id: "system:forecast-oak",
    type: "system",
    name: "Forecast-Oak",
    aliases: ["forecast oak"],
  },
  {
    id: "system:mobile-crew",
    type: "system",
    name: "Mobile-Crew",
    aliases: ["mobile crew"],
  },
  {
    id: "site:ridgeline",
    type: "site",
    name: "Ridgeline Wind",
    aliases: ["ridgeline"],
  },
  {
    id: "site:sable",
    type: "site",
    name: "Sable Solar",
    aliases: ["sable"],
  },
  {
    id: "site:northbreak",
    type: "site",
    name: "Northbreak Storage",
    aliases: ["northbreak"],
  },
  {
    id: "incident:inc-1842",
    type: "incident",
    name: "INC-1842",
    aliases: ["incident 1842"],
  },
  {
    id: "incident:inc-1901",
    type: "incident",
    name: "INC-1901",
    aliases: ["incident 1901"],
  },
  {
    id: "incident:inc-1766",
    type: "incident",
    name: "INC-1766",
    aliases: ["incident 1766"],
  },
  {
    id: "asset:t-17",
    type: "asset",
    name: "T-17",
    aliases: ["turbine t-17", "asset tag t-17"],
  },
  {
    id: "asset:t-04",
    type: "asset",
    name: "T-04",
    aliases: ["turbine t-04"],
  },
  {
    id: "asset:b-3",
    type: "asset",
    name: "B-3",
    aliases: ["inverter b-3", "inverter block b-3"],
  },
  {
    id: "asset:nb-1",
    type: "asset",
    name: "NB-1",
    aliases: ["battery nb-1"],
  },
  {
    id: "policy:pol-safe-003",
    type: "policy",
    name: "POL-SAFE-003",
    aliases: ["lockout/tagout", "lockout tagout", "loto", "lockout policy"],
  },
  {
    id: "policy:sop-mnt-014",
    type: "policy",
    name: "SOP-MNT-014",
    aliases: ["gearbox inspection", "borescope port bp-2"],
  },
  {
    id: "policy:pol-data-011",
    type: "policy",
    name: "POL-DATA-011",
    aliases: ["data boundary", "assistant data boundary"],
  },
  {
    id: "policy:run-atlas-009",
    type: "policy",
    name: "RUN-ATLAS-009",
    aliases: ["atlas runbook"],
  },
];

export const DOCUMENTS: KbDocument[] = [
  documentFrom({
    id: "DOC-ATLAS-BRIEF",
    title: "Project Atlas Brief, Rev C",
    documentType: "project_brief",
    year: 2022,
    site: "Ridgeline Wind",
    department: "Asset Reliability",
    status: "current",
    extra: [atlasCurrent],
    claims: [
      claim("project:atlas|launch", "March 2022", atlasLaunch),
      claim("project:atlas|launch_year", "2022", atlasLaunch),
      claim("project:atlas|owned_by", "Asset Reliability", atlasOwner),
      claim("project:atlas|site", "Ridgeline Wind", atlasSite),
      claim(
        "project:atlas|purpose",
        "predictive maintenance for turbine gearboxes",
        atlasPurpose,
      ),
      claim("project:atlas|depends_on", "SCADA-North", atlasDepends),
      claim("project:atlas|depends_on", "Historian-HX", atlasDepends),
      claim("project:atlas|depends_on", "CMMS-Forge", atlasDepends),
      claim("project:atlas|status", "active", atlasStatus),
    ],
  }),
  documentFrom({
    id: "DOC-ATLAS-DRAFT",
    title: "Project Atlas Draft Proposal (superseded)",
    documentType: "project_brief",
    year: 2024,
    site: "Ridgeline Wind",
    department: "Energy Trading",
    status: "superseded",
    extra: [
      "Unapproved draft, retained for audit only.",
      atlasDraftRejected,
      "Status: superseded.",
    ],
    claims: [
      claim("project:atlas|launch_year", "2024", atlasDraftLaunch, "superseded"),
      claim("project:atlas|owned_by", "Energy Trading", atlasDraftLaunch, "superseded"),
    ],
  }),
  documentFrom({
    id: "DOC-ORG",
    title: "Helios Grid Organization Chart",
    documentType: "org_chart",
    year: 2025,
    status: "current",
    extra: ["Helios Grid organization chart, revised 2025.", noPersonal],
    claims: [
      claim("dept:asset-reliability|led_by", "Jonah Peck", leads.reliability),
      claim("dept:grid-operations|led_by", "Amira Solano", leads.grid),
      claim("dept:field-maintenance|led_by", "Priya Raman", leads.field),
      claim("dept:energy-trading|led_by", "Luis Ortega", leads.trading),
      claim("dept:safety|led_by", "Helen Cho", leads.safety),
      claim("dept:finance|led_by", "Marcus Ellison", leads.finance),
    ],
  }),
  documentFrom({
    id: "DOC-LUMEN",
    title: "Project Lumen Brief",
    documentType: "project_brief",
    year: 2023,
    site: "Sable Solar",
    department: "Grid Operations",
    status: "current",
    extra: [
      "Project Lumen launched in June 2023.",
      "Lumen dispatches inverters and records curtailment.",
      "Project Lumen does not depend on SCADA-North.",
    ],
    claims: [
      claim(
        "project:lumen|launch",
        "June 2023",
        "Project Lumen launched in June 2023.",
      ),
      claim("project:lumen|owned_by", "Grid Operations", "The owning department is Grid Operations."),
      claim("project:lumen|site", "Sable Solar", "The project is located at Sable Solar."),
      claim("project:lumen|depends_on", "EMS-Aperture", lumenDepends),
      claim("project:lumen|depends_on", "Weather-Mesh", lumenDepends),
      claim("project:lumen|status", "active", "The project status is active."),
    ],
  }),
  documentFrom({
    id: "DOC-HARBOR",
    title: "Project Harbor Brief",
    documentType: "project_brief",
    year: 2024,
    department: "Energy Trading",
    status: "current",
    extra: [
      "Project Harbor launched in January 2024.",
      "Harbor submits the day-ahead bids for Helios Grid.",
    ],
    claims: [
      claim(
        "project:harbor|launch",
        "January 2024",
        "Project Harbor launched in January 2024.",
      ),
      claim(
        "project:harbor|owned_by",
        "Energy Trading",
        "The owning department is Energy Trading.",
      ),
      claim("project:harbor|depends_on", "Market-Link", harborDepends),
      claim("project:harbor|depends_on", "Forecast-Oak", harborDepends),
      claim("project:harbor|status", "active", "The project status is active."),
    ],
  }),
  documentFrom({
    id: "DOC-KEEL",
    title: "Project Keel Brief",
    documentType: "project_brief",
    year: 2023,
    department: "Field Maintenance",
    status: "current",
    extra: ["Project Keel launched in September 2023.", "Keel routes technicians to open work orders."],
    claims: [
      claim(
        "project:keel|launch",
        "September 2023",
        "Project Keel launched in September 2023.",
      ),
      claim(
        "project:keel|owned_by",
        "Field Maintenance",
        "The owning department is Field Maintenance.",
      ),
      claim("project:keel|depends_on", "CMMS-Forge", keelDepends),
      claim("project:keel|depends_on", "Mobile-Crew", keelDepends),
      claim("project:keel|status", "active", "The project status is active."),
    ],
  }),
  documentFrom({
    id: "DOC-RUN-ATLAS",
    title: "Runbook RUN-ATLAS-009",
    documentType: "runbook",
    year: 2025,
    site: "Ridgeline Wind",
    department: "Asset Reliability",
    status: "current",
    extra: [
      "Runbook RUN-ATLAS-009.",
      "Project Atlas depends on SCADA-North for live readings.",
      "Historian-HX depends on SCADA-North, so a SCADA-North outage also stops fresh history for Project Atlas.",
      "CMMS-Forge can still hold existing work orders.",
    ],
    claims: [
      claim("project:atlas|depends_on", "SCADA-North", "Project Atlas depends on SCADA-North for live readings."),
      claim("policy:run-atlas-009|recommendation", runbookStale, runbookStale),
    ],
  }),
  documentFrom({
    id: "DOC-SCADA",
    title: "SCADA-North System Note",
    documentType: "system_note",
    year: 2023,
    site: "Ridgeline Wind",
    status: "current",
    extra: ["Criticality is tier 1."],
    claims: [
      claim(
        "system:scada-north|covers",
        "Ridgeline Wind and Northbreak Storage",
        "SCADA-North is the tier-1 supervisory system for Ridgeline Wind and Northbreak Storage.",
      ),
      claim("system:historian-hx|depends_on", "SCADA-North", historianDepends),
      claim("project:atlas|depends_on", "SCADA-North", "Project Atlas depends on SCADA-North."),
    ],
  }),
  documentFrom({
    id: "DOC-SYSTEMS",
    title: "Grid Data Plane Note",
    documentType: "system_note",
    year: 2024,
    status: "current",
    extra: [
      "System note, grid data plane.",
      "EMS-Aperture is the energy management system at Sable Solar.",
      "Market-Link is the ISO bid interface used by Project Harbor.",
    ],
    claims: [
      claim("system:historian-hx|depends_on", "SCADA-North", historianDepends),
      claim("system:forecast-oak|depends_on", "Weather-Mesh", forecastDepends),
      claim("system:forecast-oak|fed_by", "Weather-Mesh", weatherFeeds),
      claim("system:weather-mesh|feeds", "Forecast-Oak", weatherFeeds),
      claim("system:mobile-crew|depends_on", "CMMS-Forge", mobileDepends),
    ],
  }),
  documentFrom({
    id: "DOC-LOTO",
    title: "POL-SAFE-003 Lockout/Tagout",
    documentType: "policy",
    year: 2023,
    department: "Safety and Compliance",
    status: "current",
    extra: [
      "Policy POL-SAFE-003, Lockout/Tagout.",
      "It applies to all rotating equipment, including turbine T-17.",
      "The lockout stays in place until the authorized person who applied it removes it.",
    ],
    claims: [
      claim("policy:pol-safe-003|purpose", "prevent unexpected energization of equipment while someone is working on it", lotoPurpose),
      claim("policy:pol-safe-003|boundary", lotoBypass, lotoBypass),
    ],
  }),
  documentFrom({
    id: "DOC-SOP-GEAR",
    title: "SOP-MNT-014 Gearbox Inspection",
    documentType: "sop",
    year: 2024,
    site: "Ridgeline Wind",
    department: "Field Maintenance",
    status: "current",
    extra: [
      "SOP-MNT-014, Gearbox inspection.",
      "Turbine T-17 at Ridgeline Wind is the reference asset for the monthly borescope.",
      'This procedure mentions asset tag T-17 and the exact phrase "borescope port BP-2".',
    ],
    claims: [
      claim("asset:t-17|procedure", "SOP-MNT-014", sopSentence),
      claim("policy:sop-mnt-014|identifier", "BP-2", sopSentence),
    ],
  }),
  documentFrom({
    id: "DOC-INC-1842",
    title: "Incident INC-1842",
    documentType: "incident_report",
    year: 2024,
    site: "Ridgeline Wind",
    department: "Asset Reliability",
    status: "current",
    extra: [
      "The cause was a clogged cooler.",
      "The outage lasted 14 hours and lost 186 MWh.",
      "Work order WO-3391 was closed after the cooler was cleaned.",
    ],
    claims: [
      claim("project:atlas|related_incident", "INC-1842", inc1842),
      claim("incident:inc-1842|asset", "T-17", inc1842),
      claim("incident:inc-1842|site", "Ridgeline Wind", inc1842),
    ],
  }),
  documentFrom({
    id: "DOC-INC-1901",
    title: "Incident INC-1901",
    documentType: "incident_report",
    year: 2025,
    site: "Sable Solar",
    department: "Grid Operations",
    status: "current",
    extra: ["Work order WO-3510 remains open at high priority."],
    claims: [
      claim(
        "project:lumen|related_incident",
        "INC-1901",
        "Incident INC-1901, dated 18 April 2025, is related to Project Lumen: inverter block B-3 at Sable Solar tripped on DC overvoltage.",
      ),
      claim(
        "incident:inc-1901|lost_mwh",
        "92",
        "The outage lasted 6.5 hours and lost 92 MWh.",
      ),
    ],
  }),
  documentFrom({
    id: "DOC-INC-1766",
    title: "Incident INC-1766",
    documentType: "incident_report",
    year: 2024,
    site: "Northbreak Storage",
    status: "current",
    extra: ["This incident is not related to Project Atlas."],
    claims: [
      claim(
        "incident:inc-1766|site",
        "Northbreak Storage",
        "Incident INC-1766, dated 9 February 2024. Battery NB-1 at Northbreak Storage reported a string imbalance.",
      ),
      claim("incident:inc-1766|lost_mwh", "15", "Lost energy was 15 MWh."),
    ],
  }),
  documentFrom({
    id: "DOC-DATA",
    title: "POL-DATA-011 Assistant Data Boundary",
    documentType: "policy",
    year: 2025,
    department: "Safety and Compliance",
    status: "current",
    extra: [
      "Policy POL-DATA-011, Assistant data boundary.",
      "Kestrel may read operational documents, org-chart roles, project dependencies, incident reports, and aggregated metrics.",
    ],
    claims: [
      claim("policy:pol-data-011|personal", dataBoundary, dataBoundary),
      claim("policy:pol-data-011|write", dataWrite, dataWrite),
    ],
  }),
  documentFrom({
    id: "DOC-SCHEMA",
    title: "Operational Table Dictionary",
    documentType: "data_dictionary",
    year: 2025,
    status: "current",
    extra: [],
    claims: [
      claim(
        "sql|tables",
        "assets, work_orders, outages, generation, budgets",
        "Data dictionary for the read-only SQL tool. Tables: assets, work_orders, outages, generation, budgets. generation stores quarterly megawatt-hours by site and year. outages stores mwh_lost by site. work_orders uses priority high, medium, or low and status open or closed. The SQL tool rejects any statement that is not a single SELECT.",
      ),
    ],
  }),
];

export const EDGES: KbEdge[] = [
  edge("e-owns-atlas", "dept:asset-reliability", "OWNS", "project:atlas", "DOC-ATLAS-BRIEF", "project:atlas|owned_by", "Asset Reliability", atlasOwner),
  edge("e-owns-lumen", "dept:grid-operations", "OWNS", "project:lumen", "DOC-LUMEN", "project:lumen|owned_by", "Grid Operations", "The owning department is Grid Operations."),
  edge("e-owns-harbor", "dept:energy-trading", "OWNS", "project:harbor", "DOC-HARBOR", "project:harbor|owned_by", "Energy Trading", "The owning department is Energy Trading."),
  edge("e-owns-keel", "dept:field-maintenance", "OWNS", "project:keel", "DOC-KEEL", "project:keel|owned_by", "Field Maintenance", "The owning department is Field Maintenance."),
  edge("e-leads-ar", "person:jonah-peck", "LEADS", "dept:asset-reliability", "DOC-ORG", "dept:asset-reliability|led_by", "Jonah Peck", leads.reliability),
  edge("e-leads-go", "person:amira-solano", "LEADS", "dept:grid-operations", "DOC-ORG", "dept:grid-operations|led_by", "Amira Solano", leads.grid),
  edge("e-leads-fm", "person:priya-raman", "LEADS", "dept:field-maintenance", "DOC-ORG", "dept:field-maintenance|led_by", "Priya Raman", leads.field),
  edge("e-leads-et", "person:luis-ortega", "LEADS", "dept:energy-trading", "DOC-ORG", "dept:energy-trading|led_by", "Luis Ortega", leads.trading),
  edge("e-leads-safe", "person:helen-cho", "LEADS", "dept:safety", "DOC-ORG", "dept:safety|led_by", "Helen Cho", leads.safety),
  edge("e-leads-fin", "person:marcus-ellison", "LEADS", "dept:finance", "DOC-ORG", "dept:finance|led_by", "Marcus Ellison", leads.finance),
  edge("e-atlas-scada", "project:atlas", "DEPENDS_ON", "system:scada-north", "DOC-ATLAS-BRIEF", "project:atlas|depends_on", "SCADA-North", atlasDepends),
  edge("e-atlas-hx", "project:atlas", "DEPENDS_ON", "system:historian-hx", "DOC-ATLAS-BRIEF", "project:atlas|depends_on", "Historian-HX", atlasDepends),
  edge("e-atlas-cmms", "project:atlas", "DEPENDS_ON", "system:cmms-forge", "DOC-ATLAS-BRIEF", "project:atlas|depends_on", "CMMS-Forge", atlasDepends),
  edge("e-lumen-ems", "project:lumen", "DEPENDS_ON", "system:ems-aperture", "DOC-LUMEN", "project:lumen|depends_on", "EMS-Aperture", lumenDepends),
  edge("e-lumen-wx", "project:lumen", "DEPENDS_ON", "system:weather-mesh", "DOC-LUMEN", "project:lumen|depends_on", "Weather-Mesh", lumenDepends),
  edge("e-harbor-mkt", "project:harbor", "DEPENDS_ON", "system:market-link", "DOC-HARBOR", "project:harbor|depends_on", "Market-Link", harborDepends),
  edge("e-harbor-fc", "project:harbor", "DEPENDS_ON", "system:forecast-oak", "DOC-HARBOR", "project:harbor|depends_on", "Forecast-Oak", harborDepends),
  edge("e-keel-cmms", "project:keel", "DEPENDS_ON", "system:cmms-forge", "DOC-KEEL", "project:keel|depends_on", "CMMS-Forge", keelDepends),
  edge("e-keel-mobile", "project:keel", "DEPENDS_ON", "system:mobile-crew", "DOC-KEEL", "project:keel|depends_on", "Mobile-Crew", keelDepends),
  edge("e-hx-scada", "system:historian-hx", "DEPENDS_ON", "system:scada-north", "DOC-SYSTEMS", "system:historian-hx|depends_on", "SCADA-North", historianDepends),
  edge("e-fc-wx", "system:forecast-oak", "DEPENDS_ON", "system:weather-mesh", "DOC-SYSTEMS", "system:forecast-oak|depends_on", "Weather-Mesh", forecastDepends),
  edge("e-wx-feeds-fc", "system:weather-mesh", "FEEDS", "system:forecast-oak", "DOC-SYSTEMS", "system:forecast-oak|fed_by", "Weather-Mesh", weatherFeeds),
  edge("e-mobile-cmms", "system:mobile-crew", "DEPENDS_ON", "system:cmms-forge", "DOC-SYSTEMS", "system:mobile-crew|depends_on", "CMMS-Forge", mobileDepends),
  edge("e-atlas-site", "project:atlas", "LOCATED_AT", "site:ridgeline", "DOC-ATLAS-BRIEF", "project:atlas|site", "Ridgeline Wind", atlasSite),
  edge("e-lumen-site", "project:lumen", "LOCATED_AT", "site:sable", "DOC-LUMEN", "project:lumen|site", "Sable Solar", "The project is located at Sable Solar."),
  edge("e-inc1842-atlas", "incident:inc-1842", "RELATED_TO", "project:atlas", "DOC-INC-1842", "project:atlas|related_incident", "INC-1842", inc1842),
  edge("e-inc1842-asset", "incident:inc-1842", "AFFECTS", "asset:t-17", "DOC-INC-1842", "incident:inc-1842|asset", "T-17", inc1842),
  edge("e-inc1901-lumen", "incident:inc-1901", "RELATED_TO", "project:lumen", "DOC-INC-1901", "project:lumen|related_incident", "INC-1901", "Incident INC-1901, dated 18 April 2025, is related to Project Lumen: inverter block B-3 at Sable Solar tripped on DC overvoltage."),
  edge("e-loto-governs", "policy:pol-safe-003", "GOVERNS", "asset:t-17", "DOC-LOTO", "policy:pol-safe-003|purpose", "prevent unexpected energization of equipment while someone is working on it", lotoPurpose),
];

function edge(
  id: string,
  from: string,
  rel: KbEdge["rel"],
  to: string,
  sourceDocId: string,
  claimKey: string,
  claimValue: string,
  sentence: string,
  status: KbEdge["status"] = "current",
): KbEdge {
  return { id, from, rel, to, sourceDocId, status, sentence, claimKey, claimValue };
}

export const TABLES: Record<string, SqlRow[]> = {
  assets: [
    { id: "T-17", name: "T-17", site: "Ridgeline Wind", type: "turbine", status: "in_service", commissioned_year: 2019, capacity_mw: 3.2 },
    { id: "T-04", name: "T-04", site: "Ridgeline Wind", type: "turbine", status: "in_service", commissioned_year: 2019, capacity_mw: 3.2 },
    { id: "B-3", name: "B-3", site: "Sable Solar", type: "inverter_block", status: "degraded", commissioned_year: 2021, capacity_mw: 4.5 },
    { id: "NB-1", name: "NB-1", site: "Northbreak Storage", type: "battery", status: "in_service", commissioned_year: 2023, capacity_mw: 20 },
  ],
  work_orders: [
    { id: "WO-3391", asset: "T-17", site: "Ridgeline Wind", priority: "high", status: "closed", project: "Atlas" },
    { id: "WO-3402", asset: "T-17", site: "Ridgeline Wind", priority: "medium", status: "open", project: "Atlas" },
    { id: "WO-3510", asset: "B-3", site: "Sable Solar", priority: "high", status: "open", project: "Lumen" },
    { id: "WO-3518", asset: "T-04", site: "Ridgeline Wind", priority: "high", status: "open", project: "Keel" },
    { id: "WO-3601", asset: "NB-1", site: "Northbreak Storage", priority: "low", status: "open", project: "none" },
  ],
  outages: [
    { id: "INC-1842", asset: "T-17", site: "Ridgeline Wind", year: 2024, cause: "clogged gearbox cooler", mwh_lost: 186 },
    { id: "OUT-201", asset: "T-04", site: "Ridgeline Wind", year: 2025, cause: "pitch fault", mwh_lost: 240 },
    { id: "OUT-202", asset: "T-17", site: "Ridgeline Wind", year: 2025, cause: "yaw misalignment", mwh_lost: 64 },
    { id: "INC-1901", asset: "B-3", site: "Sable Solar", year: 2025, cause: "DC overvoltage", mwh_lost: 92 },
    { id: "INC-1766", asset: "NB-1", site: "Northbreak Storage", year: 2024, cause: "string imbalance", mwh_lost: 15 },
  ],
  generation: [
    { site: "Ridgeline Wind", year: 2025, quarter: "Q1", mwh: 62000 },
    { site: "Ridgeline Wind", year: 2025, quarter: "Q2", mwh: 68000 },
    { site: "Ridgeline Wind", year: 2025, quarter: "Q3", mwh: 59000 },
    { site: "Ridgeline Wind", year: 2025, quarter: "Q4", mwh: 59600 },
    { site: "Sable Solar", year: 2025, quarter: "Q1", mwh: 24000 },
    { site: "Sable Solar", year: 2025, quarter: "Q2", mwh: 36000 },
    { site: "Sable Solar", year: 2025, quarter: "Q3", mwh: 32000 },
    { site: "Sable Solar", year: 2025, quarter: "Q4", mwh: 20400 },
    { site: "Ridgeline Wind", year: 2024, quarter: "Q1", mwh: 54000 },
    { site: "Ridgeline Wind", year: 2024, quarter: "Q2", mwh: 61000 },
    { site: "Ridgeline Wind", year: 2024, quarter: "Q3", mwh: 58000 },
    { site: "Ridgeline Wind", year: 2024, quarter: "Q4", mwh: 57000 },
    { site: "Sable Solar", year: 2024, quarter: "Q1", mwh: 22000 },
    { site: "Sable Solar", year: 2024, quarter: "Q2", mwh: 31000 },
    { site: "Sable Solar", year: 2024, quarter: "Q3", mwh: 30000 },
    { site: "Sable Solar", year: 2024, quarter: "Q4", mwh: 25000 },
  ],
  budgets: [
    { department: "Asset Reliability", year: 2025, amount_usd: 4200000 },
    { department: "Grid Operations", year: 2025, amount_usd: 3100000 },
    { department: "Field Maintenance", year: 2025, amount_usd: 2750000 },
    { department: "Energy Trading", year: 2025, amount_usd: 1800000 },
    { department: "Safety and Compliance", year: 2025, amount_usd: 960000 },
    { department: "Finance", year: 2025, amount_usd: 740000 },
  ],
};

export function assertCorpusGrounded(): string[] {
  const problems: string[] = [];
  for (const doc of DOCUMENTS) {
    for (const item of doc.claims) {
      if (!doc.text.includes(item.sentence)) {
        problems.push(`${doc.id} missing claim sentence for ${item.key}`);
      }
    }
  }
  for (const item of EDGES) {
    const doc = DOCUMENTS.find((candidate) => candidate.id === item.sourceDocId);
    if (!doc) problems.push(`Edge ${item.id} missing document`);
    else if (!doc.text.includes(item.sentence)) problems.push(`Edge ${item.id} sentence not in ${doc.id}`);
  }
  return problems;
}
