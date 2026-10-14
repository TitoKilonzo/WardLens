export type Role = 'resident' | 'officer' | 'admin' | 'oversight';
export type ProjectStatus = 'proposed' | 'under_review' | 'approved' | 'rejected' | 'funded' | 'in_progress' | 'under_verification' | 'completed' | 'paused';
export interface User { id: number; name: string; email: string; role: Role; ward_id: number | null; ward_name?: string | null; created_at?: string; }
export interface Ward { id: number; name: string; slug: string; county: string; population: number; description: string; project_count?: number; approved_budget?: number; spent_amount?: number; }
export interface Project {
  id: number; title: string; slug: string; description: string; category: string; status: ProjectStatus; ward_id: number; ward_name: string; ward_slug?: string;
  proposer_name?: string; estimated_cost: number; approved_budget: number; spent_amount: number; progress: number; location: string; image_url: string; created_at: string; updated_at: string; decision_note?: string; vote_count: number; has_voted?: boolean;
}
export interface Milestone { id: number; project_id: number; title: string; description: string; status: 'planned'|'in_progress'|'completed'|'delayed'; due_date?: string | null; evidence_url?: string; updated_by_name?: string; created_at: string; }
export interface BudgetRecord { id: number; project_id: number; kind: 'allocation'|'expenditure'|'adjustment'; amount: number; description: string; reference: string; evidence_url: string; recorder_name?: string; project_title?: string; project_slug?: string; project_status?: ProjectStatus; ward_name?: string; ward_slug?: string; created_at: string; }
export interface Feedback { id: number; project_id: number; user_id: number; message: string; status: 'open'|'in_review'|'resolved'; response: string; author_name?: string; project_title?: string; project_slug?: string; ward_name?: string; created_at: string; updated_at: string; }
