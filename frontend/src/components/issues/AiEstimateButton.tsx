import { useState } from 'react';
import { Button, Spin, Alert, Space, Tag, Typography } from 'antd';
import { ThunderboltOutlined } from '@ant-design/icons';
import { estimateIssue, type EstimateResult } from '../../api/ai';

interface Props {
  issueId: string;
  currentEstimate?: number | null;
  onEstimated?: (hours: number) => void;
}

const CONFIDENCE_COLORS = { low: 'orange', medium: 'blue', high: 'green' } as const;

export default function AiEstimateButton({ issueId, currentEstimate, onEstimated }: Props) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<EstimateResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleEstimate = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await estimateIssue(issueId);
      setResult(res);
      onEstimated?.(res.hours);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'AI estimate failed';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ marginTop: 4 }}>
      {currentEstimate != null && !result && (
        <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 6 }}>
          Current estimate: <strong>{Number(currentEstimate).toFixed(1)}h</strong>
        </Typography.Text>
      )}

      <Button
        size="small"
        icon={loading ? <Spin size="small" /> : <ThunderboltOutlined />}
        onClick={handleEstimate}
        disabled={loading}
        style={{ width: '100%' }}
      >
        {loading ? 'Estimating...' : 'AI Estimate'}
      </Button>

      {error && (
        <Alert
          type="error"
          message={error}
          style={{ marginTop: 8, fontSize: 12 }}
          showIcon
        />
      )}

      {result && (
        <div style={{ marginTop: 8, padding: '8px 10px', background: 'var(--bg2, #f5f5f5)', borderRadius: 6 }}>
          <Space size={6} style={{ marginBottom: 4 }}>
            <strong style={{ fontSize: 15 }}>{result.hours}h</strong>
            <Tag color={CONFIDENCE_COLORS[result.confidence]} style={{ margin: 0 }}>
              {result.confidence}
            </Tag>
          </Space>
          <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block', lineHeight: 1.4 }}>
            {result.reasoning}
          </Typography.Text>
        </div>
      )}
    </div>
  );
}
