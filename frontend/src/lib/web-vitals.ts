import { getCLS, getFCP, getFID, getLCP, getTTFB } from 'web-vitals';
import * as monitoringApi from '../api/monitoring.js';

export interface WebVitalsMetrics {
  fcp?: number;
  lcp?: number;
  cls?: number;
  fid?: number;
  ttfb?: number;
  url: string;
  timestamp: number;
}

export function initializeWebVitals() {
  // Get current page URL
  const pageUrl = window.location.pathname + window.location.search;

  // FCP - First Contentful Paint
  getFCP((metric) => {
    recordPageMetric({
      fcp: Math.round(metric.value),
      url: pageUrl,
      timestamp: Date.now(),
    });
  });

  // LCP - Largest Contentful Paint
  getLCP((metric) => {
    recordPageMetric({
      lcp: Math.round(metric.value),
      url: pageUrl,
      timestamp: Date.now(),
    });
  });

  // CLS - Cumulative Layout Shift
  getCLS((metric) => {
    recordPageMetric({
      cls: Math.round(metric.value * 1000) / 1000, // Keep 3 decimals for CLS
      url: pageUrl,
      timestamp: Date.now(),
    });
  });

  // FID - First Input Delay (optional, not critical)
  getFID((metric) => {
    recordPageMetric({
      fid: Math.round(metric.value),
      url: pageUrl,
      timestamp: Date.now(),
    });
  });

  // TTFB - Time to First Byte
  getTTFB((metric) => {
    recordPageMetric({
      ttfb: Math.round(metric.value),
      url: pageUrl,
      timestamp: Date.now(),
    });
  });
}

async function recordPageMetric(metrics: WebVitalsMetrics) {
  try {
    await monitoringApi.recordPageMetrics({
      url: metrics.url,
      metrics,
    });
  } catch (error) {
    // Silently fail if metrics endpoint is not available
    console.debug('Failed to record page metrics:', error);
  }
}
