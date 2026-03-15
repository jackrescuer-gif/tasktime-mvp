import api from './client';

export interface EstimateResult {
  hours: number;
  confidence: 'low' | 'medium' | 'high';
  reasoning: string;
  sessionId: string;
}

export interface TaskSuggestion {
  title: string;
  description: string;
  estimatedHours: number;
}

export interface DecomposeResult {
  suggestions: TaskSuggestion[];
  sessionId: string;
}

export function estimateIssue(issueId: string): Promise<EstimateResult> {
  return api.post<EstimateResult>(`/ai/estimate/${issueId}`).then((r) => r.data);
}

export function decomposeIssue(issueId: string): Promise<DecomposeResult> {
  return api.post<DecomposeResult>(`/ai/decompose/${issueId}`).then((r) => r.data);
}

export function applyDecompose(
  issueId: string,
  selectedIndexes: number[],
  suggestions: TaskSuggestion[],
): Promise<{ created: number }> {
  return api
    .post<{ created: number }>(`/ai/decompose/${issueId}/apply`, { selectedIndexes, suggestions })
    .then((r) => r.data);
}
