export const MAX_RETRIES = 3;

export type QuestionType =
  | "factual_lookup"
  | "semantic"
  | "exact_lookup"
  | "multi_hop"
  | "structured_data"
  | "calculation"
  | "comparison";

export type ToolName =
  | "vector_search"
  | "keyword_search"
  | "graph_search"
  | "sql_query"
  | "metadata_search"
  | "calculator"
  | "hybrid_search";

export type Boundary = "none" | "personal_data" | "control_action" | "write_action";

export type SqlKind =
  | "work_orders_open_high"
  | "project_work_orders"
  | "outage_loss"
  | "generation"
  | "budgets"
  | "generic";

export interface Hypothesis {
  attribute: "launch_year" | "owned_by";
  value: string;
  text: string;
}

export interface Filters {
  documentType?: string;
  year?: number;
  site?: string;
  department?: string;
  status?: "current" | "superseded";
}

export interface Classification {
  questionType: QuestionType;
  requiresPlanning: boolean;
  recommendedTools: ToolName[];
  confidence: number;
  rationale: string;
  entities: string[];
  facets: string[];
  ambiguous: boolean;
  boundary: Boundary;
  hypotheses: Hypothesis[];
  filters: Filters;
  resolvedQuestion: string;
}

export interface PlanStep {
  id: number;
  text: string;
}

export interface Claim {
  key: string;
  value: string;
  status: "current" | "superseded";
  sentence: string;
}

export interface Evidence {
  id: string;
  tool: ToolName;
  title: string;
  text: string;
  score: number;
  documentId?: string;
  documentType?: string;
  year?: number;
  status?: "current" | "superseded";
  site?: string;
  claims: Claim[];
  locator: string;
  sqlKind?: SqlKind;
  rows?: Record<string, string | number | null>[];
  expression?: string;
  summary?: string;
}

export type RecommendedAction =
  | "stop"
  | "search_graph"
  | "widen_vector"
  | "keyword_search"
  | "metadata_filter"
  | "sql_query"
  | "rewrite";

export interface Evaluation {
  sufficient: boolean;
  missingInformation: string[];
  contradictions: string[];
  recommendedAction: RecommendedAction;
  coverage: number;
  rationale: string;
  uncoveredIntents: string[];
}

export interface VerificationCheck {
  name: string;
  passed: boolean;
  detail: string;
}

export interface Verification {
  approved: boolean;
  unsupportedClaims: string[];
  requiredRevision: string;
  checks: VerificationCheck[];
}

export interface Citation {
  n: number;
  evidenceId: string;
  title: string;
  locator: string;
  excerpt: string;
}

export interface ToolCall {
  tool: ToolName;
  input: Record<string, unknown>;
  resultCount: number;
  summary: string;
  attempt: number;
}

export interface Memory {
  topic: string | null;
  entities: string[];
  filters: Filters;
  lastQuestion: string | null;
  turns: number;
}

export const EMPTY_MEMORY: Memory = {
  topic: null,
  entities: [],
  filters: {},
  lastQuestion: null,
  turns: 0,
};

export type TraceStage =
  | "classify"
  | "plan"
  | "select_tools"
  | "retrieve"
  | "evaluate"
  | "retry"
  | "rewrite"
  | "generate"
  | "verify"
  | "revise"
  | "respond"
  | "boundary";

export interface TraceEvent {
  stage: TraceStage;
  title: string;
  detail: string;
  payload?: unknown;
}

export type SentenceKind = "fact" | "gap" | "recommendation" | "interpretation" | "correction";

export interface Sentence {
  text: string;
  kind: SentenceKind;
  evidenceIds: string[];
  supportTokens: string[];
  facetId?: string;
}

export interface Draft {
  sentences: Sentence[];
  answer: string;
  citations: Citation[];
  gaps: string[];
  recommendations: string[];
}

export interface AgentState {
  question: string;
  plan: string[];
  selected_tools: string[];
  retrieved_context: Evidence[];
  evidence_sufficient: boolean;
  retry_count: number;
  answer: string;
  classification: Classification | null;
  evaluation: Evaluation | null;
  verification: Verification | null;
  citations: Citation[];
  tool_calls: ToolCall[];
  rewrites: string[];
  gaps: string[];
  recommendations: string[];
  trace: TraceEvent[];
}

export interface AgentResponse {
  state: AgentState;
  memory: Memory;
  answer: string;
  trace: TraceEvent[];
}
