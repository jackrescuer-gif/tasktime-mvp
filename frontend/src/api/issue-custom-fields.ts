import api from './client';
import type { CustomFieldType, CustomFieldOption } from './custom-fields';

export interface IssueCustomFieldValue {
  customFieldId: string;
  name: string;
  description: string | null;
  fieldType: CustomFieldType;
  options: CustomFieldOption[] | null;
  isRequired: boolean;
  showOnKanban: boolean;
  orderIndex: number;
  currentValue: unknown;
  updatedAt: string | null;
}

export interface IssueCustomFieldsResponse {
  fields: IssueCustomFieldValue[];
}

export const issueCustomFieldsApi = {
  getFields: (issueId: string) =>
    api.get<IssueCustomFieldsResponse>(`/issues/${issueId}/custom-fields`).then(r => r.data),

  updateFields: (issueId: string, values: { customFieldId: string; value: unknown }[]) =>
    api.put<IssueCustomFieldsResponse>(`/issues/${issueId}/custom-fields`, { values }).then(r => r.data),
};
