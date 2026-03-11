import { create } from 'zustand';
import type { Issue, IssueStatus, IssueType, IssuePriority } from '../types';
import * as issuesApi from '../api/issues';

interface IssuesFilters {
  status: IssueStatus[];
  type: IssueType[];
  priority: IssuePriority[];
  assigneeId?: string;
  search?: string;
}

interface IssuesState {
  issues: Issue[];
  loading: boolean;
  filters: IssuesFilters;
  setFilters: (filters: Partial<IssuesFilters>) => void;
  fetchIssues: (projectId: string) => Promise<void>;
}

export const useIssuesStore = create<IssuesState>((set, get) => ({
  issues: [],
  loading: false,
  filters: {
    status: [],
    type: [],
    priority: [],
  },

  setFilters: (partial) => {
    set((state) => ({
      filters: {
        ...state.filters,
        ...partial,
      },
    }));
  },

  fetchIssues: async (projectId: string) => {
    set({ loading: true });
    try {
      const { filters } = get();
      const issues = await issuesApi.listIssues(projectId, {
        status: filters.status,
        type: filters.type,
        priority: filters.priority,
        assigneeId: filters.assigneeId,
        search: filters.search,
      });
      set({ issues, loading: false });
    } catch {
      set({ loading: false });
    }
  },
}));
