import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import SystemStatusPage from '../pages/SystemStatus/SystemStatusPage';
import { healthApi } from '../api/health.api';

vi.mock('../api/health.api', () => ({
  healthApi: {
    getHealth: vi.fn(),
    ping: vi.fn(),
  },
}));

const mockHealthData = {
  success: true,
  service: 'azzurro-insights-server',
  version: '1.0.0',
  environment: 'test',
  timestamp: new Date().toISOString(),
  uptime_seconds: 60,
  system: { node_version: 'v24.0.0', memory_mb: 128, platform: 'darwin' },
  checks: {
    server:   { status: 'ok' },
    database: { status: 'degraded', note: 'SUPABASE_URL not configured — skipped' },
    ai_worker: { status: 'degraded', error: 'ECONNREFUSED' },
  },
  response_ms: 5,
};

function renderWithProviders(ui) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
    </MemoryRouter>
  );
}

describe('SystemStatusPage', () => {
  beforeEach(() => {
    vi.mocked(healthApi.getHealth).mockResolvedValue(mockHealthData);
  });

  it('renders page title', () => {
    renderWithProviders(<SystemStatusPage />);
    expect(screen.getByText('System Status')).toBeInTheDocument();
  });

  it('shows service checks after load', async () => {
    renderWithProviders(<SystemStatusPage />);
    await waitFor(() => {
      expect(screen.getByText('Express Server')).toBeInTheDocument();
      expect(screen.getByText('Supabase Database')).toBeInTheDocument();
      expect(screen.getByText('AI Worker (Python)')).toBeInTheDocument();
    });
  });

  it('shows server details', async () => {
    renderWithProviders(<SystemStatusPage />);
    await waitFor(() => {
      expect(screen.getByText('v24.0.0')).toBeInTheDocument();
    });
  });

  it('shows error state when backend unreachable', async () => {
    vi.mocked(healthApi.getHealth).mockRejectedValue(
      new Error('Cannot reach the server. Check your connection.')
    );
    renderWithProviders(<SystemStatusPage />);
    await waitFor(() => {
      expect(screen.getByText('Cannot reach the backend server')).toBeInTheDocument();
    });
  });
});

