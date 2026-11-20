import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { FilterProvider } from '../context/FilterContext';
import App from '../App';
import * as api from '../api';

// Mock Recharts ResponsiveContainer to avoid SVG size issues in test jsdom
vi.mock('recharts', async () => {
  const original = await vi.importActual('recharts');
  return {
    ...original,
    ResponsiveContainer: ({ children }) => <div className="recharts-mock">{children}</div>,
  };
});

// Mock all backend API calls with realistic test data
vi.mock('../api', () => ({
  propertiesApi: {
    getAll: vi.fn().mockResolvedValue({
      success: true,
      properties: [
        { id: '1', property_code: 'OLYMPIC-PADDINGTON', name: 'Olympic Hotel Paddington', location: 'Paddington, Sydney' },
        { id: '2', property_code: 'POTTS-POINT', name: 'Potts Point', location: 'Potts Point, Sydney' },
        { id: '3', property_code: 'CENTRAL-SYDNEY', name: 'Central Sydney', location: 'Surry Hills, Sydney' },
        { id: '4', property_code: 'DARLING-HARBOUR', name: 'Darling Harbour', location: 'Darling Harbour, Sydney' },
      ],
    }),
    getById: vi.fn().mockResolvedValue({
      success: true,
      property: {
        id: '1',
        property_code: 'OLYMPIC-PADDINGTON',
        name: 'Olympic Hotel Paddington',
        location: 'Paddington, Sydney',
        timezone: 'Australia/Sydney',
        averageRating: 8.6,
        weeklyChange: 0.2,
      },
    }),
  },
  analyticsApi: {
    getOverview: vi.fn().mockResolvedValue({
      success: true,
      overview: {
        currentWeeklyRating: 8.4,
        previousWeeklyRating: 8.2,
        ratingDiff: 0.2,
        totalReviewsCount: 220,
        sentimentBreakdown: {
          positive: 150,
          negative: 40,
          mixed: 20,
          neutral: 10,
          positivePct: 68.2,
          negativePct: 18.2,
          mixedPct: 9.1,
          neutralPct: 4.5,
        },
      },
    }),
    getProperties: vi.fn().mockResolvedValue({
      success: true,
      properties: [
        {
          id: '1',
          propertyCode: 'OLYMPIC-PADDINGTON',
          name: 'Olympic Hotel Paddington',
          averageRating: 8.7,
          weeklyChange: 0.3,
          reviewCount: 65,
          positivePercentage: 72,
          negativePercentage: 15,
          mixedPercentage: 13,
          topPositiveTopic: 'Location',
          topNegativeTopic: 'Noise',
        },
      ],
    }),
    getTrends: vi.fn().mockResolvedValue({
      success: true,
      trends: [
        { date: '2026-11-16', rating: 8.4, count: 10 },
        { date: '2026-11-17', rating: 8.6, count: 14 },
      ],
    }),
    getTopics: vi.fn().mockResolvedValue({
      success: true,
      topics: [
        { topicName: 'Cleanliness', negativeCount: 15, totalCount: 60 },
        { topicName: 'Noise', negativeCount: 12, totalCount: 45 },
      ],
    }),
    getSentiment: vi.fn().mockResolvedValue({
      success: true,
      sentiment: { positive: 150, negative: 40, mixed: 20, neutral: 10 },
    }),
  },
  reviewsApi: {
    getReviews: vi.fn().mockResolvedValue({
      success: true,
      total: 1,
      reviews: [
        {
          id: 'rev-1',
          propertyCode: 'OLYMPIC-PADDINGTON',
          propertyName: 'Olympic Hotel Paddington',
          rating: 9.0,
          reviewDate: '2026-11-17',
          positiveText: 'Fantastic staff and very clean room.',
          negativeText: '',
          overallSentiment: 'Positive',
          sentimentConfidence: 0.95,
          topics: [{ topic_name: 'Staff Behaviour', topic_sentiment: 'Positive' }],
        },
      ],
    }),
    getById: vi.fn().mockResolvedValue({ success: true, review: {} }),
    reanalyze: vi.fn().mockResolvedValue({ success: true, result: { overall_sentiment: 'Positive', sentiment_confidence: 0.9 } }),
    recordCorrection: vi.fn().mockResolvedValue({ success: true }),
    importCsv: vi.fn().mockResolvedValue({ success: true, summary: { insertedCount: 10, duplicateCount: 0 } }),
    importJson: vi.fn().mockResolvedValue({ success: true, summary: { insertedCount: 5, duplicateCount: 0 } }),
  },
  insightsApi: {
    getAll: vi.fn().mockResolvedValue({
      success: true,
      insights: [
        {
          id: 'ins-1',
          propertyCode: 'DARLING-HARBOUR',
          title: 'Elevator noise complaints on 3rd floor',
          summary: 'Multiple guests reported high noise levels during night hours.',
          severity: 'high',
          recommendedAction: 'Schedule maintenance audit on motor belts.',
          affectedReviewsCount: 6,
        },
      ],
    }),
    getEvidence: vi.fn().mockResolvedValue({
      success: true,
      evidence: [
        { id: 'ev-1', text: 'Room 304 was very loud because of the lift.', rating: 6.0 },
      ],
    }),
  },
  collectionApi: {
    getStatus: vi.fn().mockResolvedValue({
      success: true,
      status: {
        totalProcessed: 220,
        totalInserted: 214,
        totalDuplicates: 6,
        totalRejected: 0,
      },
      adapters: [
        { name: 'csv_upload', label: 'CSV Upload', enabled: true },
        { name: 'json_import', label: 'JSON Ingestion', enabled: true },
        { name: 'synthetic_generator', label: 'Synthetic Generator', enabled: true },
        { name: 'playwright', label: 'Playwright (Disabled)', enabled: false },
      ],
      playwrightAuthorized: false,
    }),
    getJobs: vi.fn().mockResolvedValue({
      success: true,
      jobs: [
        { name: 'daily_collection_all', cron: '0 2 * * *', active: true, lastRun: '2026-11-20T02:00:00Z', status: 'completed' },
      ],
    }),
    getQueue: vi.fn().mockResolvedValue({
      success: true,
      queue: { unanalyzedCount: 0, queueStatus: 'idle' },
    }),
    getLogs: vi.fn().mockResolvedValue({
      success: true,
      logs: [
        {
          id: 'log-1',
          started_at: '2026-11-20T10:00:00Z',
          source: 'csv_import',
          status: 'completed',
          fetched_count: 50,
          inserted_count: 50,
          duplicate_count: 0,
        },
      ],
    }),
    runJob: vi.fn().mockResolvedValue({ success: true }),
    toggleJob: vi.fn().mockResolvedValue({ success: true }),
    processQueue: vi.fn().mockResolvedValue({ success: true }),
    runCollection: vi.fn().mockResolvedValue({ success: true }),
  },
  importApi: {
    getAdapters: vi.fn().mockResolvedValue({ success: true, adapters: [] }),
    previewCsv: vi.fn().mockResolvedValue({ success: true, preview: [] }),
    generateSynthetic: vi.fn().mockResolvedValue({ success: true, summary: { insertedCount: 50 } }),
  },
  systemApi: {
    getHealth: vi.fn().mockResolvedValue({ success: true, status: 'ok' }),
  },
}));

function renderApp(initialRoute = '/') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <MemoryRouter initialEntries={[initialRoute]}>
      <QueryClientProvider client={queryClient}>
        <FilterProvider>
          <App />
        </FilterProvider>
      </QueryClientProvider>
    </MemoryRouter>
  );
}

describe('Azzurro Insights Phase 7 Dashboard Navigation & Pages', () => {
  it('renders Sidebar with all 7 navigation items', async () => {
    renderApp('/overview');

    expect(screen.getByText('AZZURRO')).toBeInTheDocument();
    expect(screen.getByText('INSIGHTS')).toBeInTheDocument();

    // Check all 7 navigation menu labels
    expect(screen.getByText('Overview')).toBeInTheDocument();
    expect(screen.getByText('Properties')).toBeInTheDocument();
    expect(screen.getByText('Reviews')).toBeInTheDocument();
    expect(screen.getByText('AI Insights')).toBeInTheDocument();
    expect(screen.getByText('Collection Monitor')).toBeInTheDocument();
    expect(screen.getByText('Data Import')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  it('renders TopNav with property selector and Sydney timezone', async () => {
    renderApp('/overview');

    expect(screen.getByText('All 4 Azzurro Properties')).toBeInTheDocument();
    expect(screen.getByText(/Current Week/i)).toBeInTheDocument();
  });

  it('renders Overview page with executive metrics and charts', async () => {
    renderApp('/overview');

    await waitFor(() => {
      expect(screen.getByText('Executive Intelligence Overview')).toBeInTheDocument();
      expect(screen.getByText('Weekly Rating')).toBeInTheDocument();
      expect(screen.getByText('Total Reviews')).toBeInTheDocument();
      expect(screen.getByText('Positive Guest Ratio')).toBeInTheDocument();
      expect(screen.getByText('Property Performance Matrix')).toBeInTheDocument();
    });
  });

  it('renders Properties page with portfolio matrix', async () => {
    renderApp('/properties');

    await waitFor(() => {
      expect(screen.getByText('Azzurro Properties Portfolio')).toBeInTheDocument();
      expect(screen.getByText('Multi-Property Benchmark Summary')).toBeInTheDocument();
    });
  });

  it('renders Reviews Explorer page with filters and review cards', async () => {
    renderApp('/reviews');

    await waitFor(() => {
      expect(screen.getByText('Booking.com Reviews Explorer')).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/Search positive or negative guest comments/i)).toBeInTheDocument();
      expect(screen.getByText('Operational Topic')).toBeInTheDocument();
    });
  });

  it('renders AI Insights page with operational diagnostics', async () => {
    renderApp('/insights');

    await waitFor(() => {
      expect(screen.getByText(/AI Operational Diagnostics & Insights/i)).toBeInTheDocument();
    });
  });

  it('renders Collection Monitor page with adapter status', async () => {
    renderApp('/collection');

    await waitFor(() => {
      expect(screen.getByText('Data Collection & Ingestion Engine')).toBeInTheDocument();
      expect(screen.getByText('CSV Import Adapter')).toBeInTheDocument();
      expect(screen.getByText('Playwright Adapter')).toBeInTheDocument();
    });
  });

  it('renders Data Import page with drag and drop zone', async () => {
    renderApp('/import');

    await waitFor(() => {
      expect(screen.getByText('Review Ingestion & File Importer')).toBeInTheDocument();
      expect(screen.getByText(/Click to upload or drag & drop review file/i)).toBeInTheDocument();
    });
  });

  it('renders Settings page with system parameters', async () => {
    renderApp('/settings');

    await waitFor(() => {
      expect(screen.getByText('System & Property Settings')).toBeInTheDocument();
      expect(screen.getByText('Managed Hotels Registry')).toBeInTheDocument();
      expect(screen.getByText('Australia/Sydney (AEST/AEDT)')).toBeInTheDocument();
      expect(screen.getByText('azzurro-hybrid-nlp-v1')).toBeInTheDocument();
    });
  });
});

