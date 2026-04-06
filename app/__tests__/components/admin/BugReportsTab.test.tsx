import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import BugReportsTab from '~/components/admin/BugReportsTab';
import type { AdminBugReportRow } from '~/lib/types';

const { mockUpdateAdminBugReportStatus } = vi.hoisted(() => ({
  mockUpdateAdminBugReportStatus: vi.fn(),
}));

vi.mock('~/lib/api', () => ({
  default: {
    updateAdminBugReportStatus: mockUpdateAdminBugReportStatus,
  },
}));

const baseReport: AdminBugReportRow = {
  id: 'bug-1',
  description: 'Student cannot submit answer on activity page',
  status: 'unhandled',
  consoleLogs: JSON.stringify([
    { level: 'error', message: 'Boom', timestamp: '2026-03-10T08:00:00.000Z', stack: 'line1\nline2' },
  ]),
  networkLogs: JSON.stringify([
    {
      method: 'POST',
      url: 'http://localhost:4000/api/submit',
      status: 500,
      durationMs: 215,
      timestamp: '2026-03-10T08:00:02.000Z',
      requestHeaders: { 'content-type': 'application/json' },
      responseHeaders: { 'x-request-id': 'abc' },
      requestBody: { answer: 2 },
      responseBody: { error: 'Internal error' },
    },
  ]),
  screenshot: 'data:image/png;base64,ZmFrZQ==',
  pageUrl: 'http://localhost:5173/student/list/42?step=1',
  userAgent: 'Mozilla/5.0',
  isAnonymous: false,
  userId: 'u1',
  reporterName: 'Ada Lovelace',
  reporterEmail: 'ada@example.com',
  reporterRole: 'STUDENT',
  user: {
    id: 'u1',
    name: 'Ada Lovelace',
    email: 'ada@example.com',
    role: 'STUDENT',
  },
  createdAt: '2026-03-10T08:01:00.000Z',
  updatedAt: '2026-03-10T08:01:00.000Z',
  courseOfferingId: 1,
  moduleId: 2,
  lessonId: 3,
  activityId: 4,
  courseTitle: 'Math 101',
  moduleTitle: 'Week 1',
  lessonTitle: 'Linear Equations',
  activityTitle: 'Solve for x',
};

const anonymousReport: AdminBugReportRow = {
  ...baseReport,
  id: 'bug-2',
  description: 'Anonymous report example',
  isAnonymous: true,
  reporterName: 'Anonymous',
  reporterEmail: null,
  reporterRole: 'PROFESSOR',
  user: {
    id: 'u2',
    name: null,
    email: null,
    role: 'PROFESSOR',
  },
};

describe('BugReportsTab', () => {
  beforeEach(() => {
    mockUpdateAdminBugReportStatus.mockReset();
  });

  it('renders bug report rows and anonymous reporter label', () => {
    render(<BugReportsTab initialReports={[baseReport, anonymousReport]} />);

    expect(screen.getByText('Bug Reports')).toBeInTheDocument();
    expect(screen.getByText(baseReport.description)).toBeInTheDocument();
    expect(screen.getByText(anonymousReport.description)).toBeInTheDocument();
    expect(screen.getByText('Anonymous')).toBeInTheDocument();
    expect(screen.getAllByText('Math 101 / Week 1 / Linear Equations / Solve for x')).toHaveLength(2);
    expect(screen.getAllByText('/student/list/42?step=1')).toHaveLength(2);
  });

  it('updates status after a successful API response', async () => {
    mockUpdateAdminBugReportStatus.mockResolvedValue({
      ...baseReport,
      status: 'resolved',
    });

    render(<BugReportsTab initialReports={[baseReport]} />);

    const select = screen.getByLabelText(`Update status for report ${baseReport.id}`);
    fireEvent.change(select, { target: { value: 'resolved' } });

    await waitFor(() => {
      expect(mockUpdateAdminBugReportStatus).toHaveBeenCalledWith(baseReport.id, {
        status: 'resolved',
      });
    });

    expect((select as HTMLSelectElement).value).toBe('resolved');
  });

  it('opens description, console, network, and screenshot viewers', async () => {
    render(<BugReportsTab initialReports={[baseReport]} />);

    fireEvent.click(screen.getByText(baseReport.description));
    expect(await screen.findByText('Report Description')).toBeInTheDocument();
    expect(screen.getByText(/Reported by/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));

    fireEvent.click(screen.getByRole('button', { name: 'Console' }));
    expect(await screen.findByText('Console Logs')).toBeInTheDocument();
    expect(screen.getByText('Show stack trace')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));

    fireEvent.click(screen.getByRole('button', { name: 'Network' }));
    expect(await screen.findByText('Network Logs')).toBeInTheDocument();
    expect(screen.getByText('Request')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));

    fireEvent.click(screen.getByRole('button', { name: 'Screenshot' }));
    expect(await screen.findByRole('link', { name: 'Open in new tab' })).toBeInTheDocument();
  });
});
