import { useState } from 'react';
import { Button, Checkbox, List, Spin, Alert, Space, Tag, Typography, message } from 'antd';
import { ApartmentOutlined } from '@ant-design/icons';
import { decomposeIssue, applyDecompose, type TaskSuggestion } from '../../api/ai';
import type { IssueType } from '../../types';

interface Props {
  issueId: string;
  issueType: IssueType;
  onCreated?: () => void;
}

export default function AiDecomposePanel({ issueId, issueType, onCreated }: Props) {
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [suggestions, setSuggestions] = useState<TaskSuggestion[] | null>(null);
  const [selected, setSelected] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);

  if (issueType !== 'EPIC' && issueType !== 'STORY') return null;

  const childType = issueType === 'EPIC' ? 'STORY' : 'TASK';

  const handleDecompose = async () => {
    setLoading(true);
    setError(null);
    setSuggestions(null);
    setSelected([]);
    try {
      const res = await decomposeIssue(issueId);
      setSuggestions(res.suggestions);
      setSelected(res.suggestions.map((_, i) => i)); // select all by default
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Decomposition failed');
    } finally {
      setLoading(false);
    }
  };

  const handleApply = async () => {
    if (!suggestions || selected.length === 0) return;
    setApplying(true);
    try {
      const res = await applyDecompose(issueId, selected, suggestions);
      message.success(`Created ${res.created} ${childType} issue${res.created !== 1 ? 's' : ''}`);
      setSuggestions(null);
      setSelected([]);
      onCreated?.();
    } catch (e: unknown) {
      message.error(e instanceof Error ? e.message : 'Failed to create issues');
    } finally {
      setApplying(false);
    }
  };

  return (
    <div>
      <Button
        size="small"
        icon={loading ? <Spin size="small" /> : <ApartmentOutlined />}
        onClick={handleDecompose}
        disabled={loading || applying}
        style={{ width: '100%', marginBottom: suggestions ? 10 : 0 }}
      >
        {loading ? 'Decomposing...' : `Decompose into ${childType}s`}
      </Button>

      {error && (
        <Alert type="error" message={error} style={{ marginTop: 8, fontSize: 12 }} showIcon />
      )}

      {suggestions && (
        <div>
          <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 6 }}>
            Select items to create ({selected.length}/{suggestions.length}):
          </Typography.Text>
          <List
            size="small"
            dataSource={suggestions}
            renderItem={(s, i) => (
              <List.Item style={{ paddingInline: 0, paddingBlock: 4 }}>
                <Checkbox
                  checked={selected.includes(i)}
                  onChange={(e) =>
                    setSelected(
                      e.target.checked ? [...selected, i] : selected.filter((x) => x !== i),
                    )
                  }
                  style={{ alignItems: 'flex-start' }}
                >
                  <div>
                    <Space size={4}>
                      <span style={{ fontSize: 13, fontWeight: 500 }}>{s.title}</span>
                      <Tag style={{ margin: 0, fontSize: 11 }}>{s.estimatedHours}h</Tag>
                    </Space>
                    {s.description && (
                      <Typography.Text
                        type="secondary"
                        style={{ fontSize: 11, display: 'block', lineHeight: 1.4 }}
                      >
                        {s.description}
                      </Typography.Text>
                    )}
                  </div>
                </Checkbox>
              </List.Item>
            )}
          />
          <Space style={{ marginTop: 8 }}>
            <Button
              type="primary"
              size="small"
              loading={applying}
              disabled={selected.length === 0}
              onClick={handleApply}
            >
              Create selected ({selected.length})
            </Button>
            <Button size="small" onClick={() => setSuggestions(null)}>
              Cancel
            </Button>
          </Space>
        </div>
      )}
    </div>
  );
}
