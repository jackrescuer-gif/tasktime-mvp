import api from './client';
import type {
  Issue,
  IssueType,
  IssuePriority,
  IssueStatus,
  AiAssigneeType,
  AiExecutionStatus,
} from '../types';

export interface IssueFilters {
  status?: IssueStatus[];
  type?: IssueType[];
  priority?: IssuePriority[];
  assigneeId?: string;
  sprintId?: string;
  from?: string;
  to?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface PaginatedIssues {
  items: Issue[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

function buildIssueParams(filters?: IssueFilters) {
  return {
    ...(filters?.status && { status: filters.status.join(',') }),
    ...(filters?.type && { type: filters.type.join(',') }),
    ...(filters?.priority && { priority: filters.priority.join(',') }),
    ...(filters?.assigneeId && { assigneeId: filters.assigneeId }),
    ...(filters?.sprintId && { sprintId: filters.sprintId }),
    ...(filters?.from && { from: filters.from }),
    ...(filters?.to && { to: filters.to }),
    ...(filters?.search && { search: filters.search }),
    ...(filters?.page && { page: filters.page }),
    ...(filters?.limit && { limit: filters.limit }),
  };
}

// Returns just the items array (backward-compatible)
export async function listIssues(projectId: string, filters?: IssueFilters): Promise<Issue[]> {
  const { data } = await api.get<PaginatedIssues>(`/projects/${projectId}/issues`, {
    params: buildIssueParams(filters),
  });
  return data.items;
}

// Returns full paginated result
export async function listIssuesPaginated(projectId: string, filters?: IssueFilters): Promise<PaginatedIssues> {
  const { data } = await api.get<PaginatedIssues>(`/projects/${projectId}/issues`, {
    params: buildIssueParams(filters),
  });
  return data;
}

export async function getIssue(id: string): Promise<Issue> {
  const { data } = await api.get<Issue>(`/issues/${id}`);
  return data;
}

export interface CreateIssueBody {
  title: string;
  description?: string;
  type?: IssueType;
  priority?: IssuePriority;
  parentId?: string;
  assigneeId?: string;
}

export async function createIssue(projectId: string, body: CreateIssueBody): Promise<Issue> {
  const { data } = await api.post<Issue>(`/projects/${projectId}/issues`, body);
  return data;
}

export async function updateIssue(id: string, body: Partial<CreateIssueBody>): Promise<Issue> {
  const { data } = await api.patch<Issue>(`/issues/${id}`, body);
  return data;
}

export async function updateStatus(id: string, status: IssueStatus): Promise<Issue> {
  const { data } = await api.patch<Issue>(`/issues/${id}/status`, { status });
  return data;
}

export async function deleteIssue(id: string): Promise<void> {
  await api.delete(`/issues/${id}`);
}

export async function bulkUpdateIssues(
  projectId: string,
  body: { issueIds: string[]; status?: IssueStatus; assigneeId?: string | null },
): Promise<{ updatedCount: number }> {
  const { data } = await api.post<{ updatedCount: number }>(`/projects/${projectId}/issues/bulk`, body);
  return data;
}

export async function updateAiFlags(
  id: string,
  body: { aiEligible?: boolean; aiAssigneeType?: AiAssigneeType },
): Promise<Issue> {
  const { data } = await api.patch<Issue>(`/issues/${id}/ai-flags`, body);
  return data;
}

export async function updateAiStatus(
  id: string,
  aiExecutionStatus: AiExecutionStatus,
): Promise<Issue> {
  const { data } = await api.patch<Issue>(`/issues/${id}/ai-status`, { aiExecutionStatus });
  return data;
}

export async function listMvpLivecodeActiveIssues(params?: {
  onlyAiEligible?: boolean;
  assigneeType?: AiAssigneeType | 'ALL';
}): Promise<Issue[]> {
  const { data } = await api.get<Issue[]>('/mvp-livecode/issues/active', {
    params: {
      ...(params?.onlyAiEligible !== undefined && { onlyAiEligible: params.onlyAiEligible }),
      ...(params?.assigneeType && { assigneeType: params.assigneeType }),
    },
  });
  return data;
}
