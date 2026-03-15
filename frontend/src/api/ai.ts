import api from './client';

export interface EstimateResult {
  hours: number;
  confidence: 'low' | 'medium' | 'high';
  reasoning: string;
  sessionId: string;
}

export function estimateIssue(issueId: string): Promise<EstimateResult> {
  return api.post<EstimateResult>(`/ai/estimate/${issueId}`).then((r) => r.data);
}
