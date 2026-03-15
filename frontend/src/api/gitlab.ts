import api from './client';

export interface GitLabStatus {
  configured: boolean;
  gitlabUrl: string | null;
}

export interface GitLabConfig {
  projectId: string;
  gitlabUrl: string;
  gitlabToken: string;
  webhookToken: string;
}

export function getStatus(projectId: string): Promise<GitLabStatus> {
  return api.get<GitLabStatus>(`/integrations/gitlab/status/${projectId}`).then((r) => r.data);
}

export function configure(data: GitLabConfig): Promise<unknown> {
  return api.post('/integrations/gitlab/configure', data).then((r) => r.data);
}

export function deactivate(projectId: string): Promise<{ ok: boolean }> {
  return api.delete<{ ok: boolean }>(`/integrations/gitlab/deactivate/${projectId}`).then((r) => r.data);
}

export function listIntegrations(): Promise<unknown[]> {
  return api.get<unknown[]>('/integrations/gitlab/list').then((r) => r.data);
}
