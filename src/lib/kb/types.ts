export type EntityType =
  | "department"
  | "person"
  | "project"
  | "system"
  | "site"
  | "incident"
  | "asset"
  | "policy";

export type DocumentType =
  | "project_brief"
  | "policy"
  | "incident_report"
  | "runbook"
  | "org_chart"
  | "sop"
  | "system_note"
  | "data_dictionary";

export type RecordStatus = "current" | "superseded";

export interface Claim {
  key: string;
  value: string;
  status: RecordStatus;
  sentence: string;
}

export interface KbEntity {
  id: string;
  type: EntityType;
  name: string;
  aliases: string[];
  role?: string;
}

export interface KbDocument {
  id: string;
  title: string;
  documentType: DocumentType;
  year: number;
  site?: string;
  department?: string;
  status: RecordStatus;
  text: string;
  claims: Claim[];
}

export type Relation =
  | "OWNS"
  | "LEADS"
  | "DEPENDS_ON"
  | "LOCATED_AT"
  | "RELATED_TO"
  | "AFFECTS"
  | "FEEDS"
  | "GOVERNS";

export interface KbEdge {
  id: string;
  from: string;
  rel: Relation;
  to: string;
  sourceDocId: string;
  status: RecordStatus;
  sentence: string;
  claimKey: string;
  claimValue: string;
}

export type SqlValue = string | number | null;

export interface SqlRow {
  [column: string]: SqlValue;
}
