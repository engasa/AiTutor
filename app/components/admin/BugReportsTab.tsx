import { useMemo, useState } from 'react';
import { Button } from '~/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog';
import api from '~/lib/api';
import type { AdminBugReportRow, BugReportStatus } from '~/lib/types';

type SortKey = 'status' | 'description' | 'reporter' | 'role' | 'createdAt' | 'context' | 'page';
type SortDirection = 'asc' | 'desc';
type ViewerType = 'description' | 'console' | 'network' | 'screenshot' | null;

type ConsoleLogEntry = {
  level?: string;
  message?: string;
  timestamp?: string;
  stack?: string;
};

type NetworkLogEntry = {
  method?: string;
  url?: string;
  status?: number | null;
  durationMs?: number;
  timestamp?: string;
  requestHeaders?: Record<string, string> | null;
  responseHeaders?: Record<string, string> | null;
  requestBody?: unknown;
  responseBody?: unknown;
};

const STATUS_OPTIONS: BugReportStatus[] = ['unhandled', 'in progress', 'resolved'];
const CONSOLE_LEVELS = ['all', 'log', 'warn', 'error'] as const;
const NETWORK_TABS = ['meta', 'request', 'response', 'headers'] as const;

function safeJsonParse<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function getReporterLabel(report: AdminBugReportRow) {
  if (report.isAnonymous) return 'Anonymous';
  const name = report.reporterName ?? report.userName ?? report.user?.name ?? null;
  const email = report.reporterEmail ?? report.userEmail ?? report.user?.email ?? null;
  if (name && email) return `${name} (${email})`;
  return name ?? email ?? report.userId;
}

function getReporterRole(report: AdminBugReportRow) {
  return report.reporterRole ?? report.role ?? report.user?.role ?? null;
}

function getContextLabel(report: AdminBugReportRow) {
  const parts = [report.courseTitle, report.moduleTitle, report.lessonTitle, report.activityTitle].filter(
    Boolean,
  ) as string[];

  if (parts.length > 0) return parts.join(' / ');

  const ids = [
    report.courseOfferingId ? `Course #${report.courseOfferingId}` : null,
    report.moduleId ? `Module #${report.moduleId}` : null,
    report.lessonId ? `Lesson #${report.lessonId}` : null,
    report.activityId ? `Activity #${report.activityId}` : null,
  ].filter(Boolean);

  return ids.length > 0 ? ids.join(' / ') : '-';
}

function getPathLabel(pageUrl: string | null | undefined) {
  if (!pageUrl) return '-';
  try {
    const url = new URL(pageUrl);
    return url.pathname + url.search;
  } catch {
    return pageUrl;
  }
}

function getStatusClasses(status: BugReportStatus) {
  if (status === 'resolved') return 'bg-green-500/10 text-green-700 dark:text-green-400';
  if (status === 'in progress') return 'bg-amber-500/10 text-amber-700 dark:text-amber-400';
  return 'bg-red-500/10 text-red-700 dark:text-red-400';
}

function sortReports(rows: AdminBugReportRow[], key: SortKey, direction: SortDirection) {
  const dir = direction === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    const av =
      key === 'status'
        ? a.status
        : key === 'description'
          ? a.description
          : key === 'reporter'
            ? getReporterLabel(a)
            : key === 'role'
              ? getReporterRole(a) ?? ''
              : key === 'context'
                ? getContextLabel(a)
                : key === 'page'
                  ? getPathLabel(a.pageUrl)
                  : a.createdAt;
    const bv =
      key === 'status'
        ? b.status
        : key === 'description'
          ? b.description
          : key === 'reporter'
            ? getReporterLabel(b)
            : key === 'role'
              ? getReporterRole(b) ?? ''
              : key === 'context'
                ? getContextLabel(b)
                : key === 'page'
                  ? getPathLabel(b.pageUrl)
                  : b.createdAt;

    if (key === 'createdAt') {
      const at = new Date(av).getTime();
      const bt = new Date(bv).getTime();
      if (at === bt) return 0;
      return at > bt ? dir : -dir;
    }

    return String(av).localeCompare(String(bv)) * dir;
  });
}

function SortHeader({
  title,
  sortKey,
  activeSortKey,
  direction,
  onToggle,
}: {
  title: string;
  sortKey: SortKey;
  activeSortKey: SortKey;
  direction: SortDirection;
  onToggle: (key: SortKey) => void;
}) {
  const isActive = sortKey === activeSortKey;
  return (
    <button
      type="button"
      className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
      onClick={() => onToggle(sortKey)}
    >
      <span>{title}</span>
      <span aria-hidden="true">{isActive ? (direction === 'asc' ? '▲' : '▼') : '↕'}</span>
    </button>
  );
}

function DescriptionViewer({ report }: { report: AdminBugReportRow }) {
  return (
    <div className="space-y-3 text-sm">
      <p className="text-muted-foreground">Reported by {getReporterLabel(report)}</p>
      <div className="max-h-[55vh] overflow-auto rounded-xl border border-border/70 bg-background/60 p-4 whitespace-pre-wrap">
        {report.description}
      </div>
    </div>
  );
}

function ConsoleViewer({ report }: { report: AdminBugReportRow }) {
  const entries = safeJsonParse<ConsoleLogEntry[]>(report.consoleLogs, []);
  const [levelFilter, setLevelFilter] = useState<(typeof CONSOLE_LEVELS)[number]>('all');
  const [expandedStacks, setExpandedStacks] = useState<Record<number, boolean>>({});

  const filtered = entries.filter((entry) => {
    if (levelFilter === 'all') return true;
    return (entry.level ?? 'log').toLowerCase() === levelFilter;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {CONSOLE_LEVELS.map((level) => (
          <button
            key={level}
            type="button"
            onClick={() => setLevelFilter(level)}
            className={`rounded-md border px-2 py-1 text-xs ${
              levelFilter === level
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border bg-background text-muted-foreground'
            }`}
          >
            {level}
          </button>
        ))}
      </div>
      <div className="max-h-[55vh] space-y-3 overflow-auto">
        {filtered.length === 0 ? (
          <div className="rounded-xl border border-border/70 bg-background/60 p-4 text-sm text-muted-foreground">
            No console logs captured.
          </div>
        ) : (
          filtered.map((entry, index) => {
            const hasStack = typeof entry.stack === 'string' && entry.stack.length > 0;
            const expanded = expandedStacks[index] ?? false;
            return (
              <div
                key={`${entry.timestamp ?? 'ts'}-${index}`}
                className="rounded-xl border border-border/70 bg-background/60 p-3 text-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium uppercase text-xs text-muted-foreground">
                    {entry.level ?? 'log'}
                  </span>
                  <span className="text-xs text-muted-foreground">{entry.timestamp ?? '-'}</span>
                </div>
                <p className="mt-2 whitespace-pre-wrap break-words text-foreground">
                  {entry.message ?? ''}
                </p>
                {hasStack ? (
                  <div className="mt-3 space-y-2">
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedStacks((current) => ({
                          ...current,
                          [index]: !expanded,
                        }))
                      }
                      className="text-xs text-primary underline underline-offset-2"
                    >
                      {expanded ? 'Hide stack trace' : 'Show stack trace'}
                    </button>
                    {expanded ? (
                      <pre className="overflow-auto rounded-md border border-border bg-black/5 p-3 text-xs whitespace-pre-wrap break-words">
                        {entry.stack}
                      </pre>
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function NetworkViewer({ report }: { report: AdminBugReportRow }) {
  const entries = safeJsonParse<NetworkLogEntry[]>(report.networkLogs, []);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [tab, setTab] = useState<(typeof NETWORK_TABS)[number]>('meta');

  const entry = entries[selectedIndex] ?? null;
  const requestBody = entry?.requestBody;
  const responseBody = entry?.responseBody;
  const requestHeaders = entry?.requestHeaders;
  const responseHeaders = entry?.responseHeaders;

  return (
    <div className="space-y-4">
      {entries.length > 0 ? (
        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Request
          </label>
          <select
            className="input-field text-sm"
            value={selectedIndex}
            onChange={(event) => {
              setSelectedIndex(Number(event.target.value) || 0);
              setTab('meta');
            }}
          >
            {entries.map((item, index) => (
              <option key={`${item.method ?? 'GET'}-${index}`} value={index}>
                {(item.method ?? 'GET').toUpperCase()} {item.url ?? 'Unknown URL'}
              </option>
            ))}
          </select>
          <div className="flex flex-wrap items-center gap-2">
            {NETWORK_TABS.map((itemTab) => (
              <button
                key={itemTab}
                type="button"
                onClick={() => setTab(itemTab)}
                className={`rounded-md border px-2 py-1 text-xs ${
                  tab === itemTab
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border bg-background text-muted-foreground'
                }`}
              >
                {itemTab}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="max-h-[55vh] overflow-auto rounded-xl border border-border/70 bg-background/60 p-4 text-sm">
        {!entry ? (
          <span className="text-muted-foreground">No network logs captured.</span>
        ) : tab === 'meta' ? (
          <div className="space-y-2">
            <div>
              <span className="font-medium">Method:</span> {(entry.method ?? 'GET').toUpperCase()}
            </div>
            <div>
              <span className="font-medium">URL:</span> {entry.url ?? '-'}
            </div>
            <div>
              <span className="font-medium">Status:</span> {entry.status ?? '-'}
            </div>
            <div>
              <span className="font-medium">Duration:</span> {entry.durationMs ?? '-'}ms
            </div>
            <div>
              <span className="font-medium">Timestamp:</span> {entry.timestamp ?? '-'}
            </div>
          </div>
        ) : tab === 'request' ? (
          <pre className="whitespace-pre-wrap break-words text-xs">
            {typeof requestBody === 'string' ? requestBody : JSON.stringify(requestBody ?? {}, null, 2)}
          </pre>
        ) : tab === 'response' ? (
          <pre className="whitespace-pre-wrap break-words text-xs">
            {typeof responseBody === 'string'
              ? responseBody
              : JSON.stringify(responseBody ?? {}, null, 2)}
          </pre>
        ) : (
          <div className="space-y-4 text-xs">
            <div>
              <p className="mb-2 text-sm font-medium">Request headers</p>
              <pre className="whitespace-pre-wrap break-words">
                {JSON.stringify(requestHeaders ?? {}, null, 2)}
              </pre>
            </div>
            <div>
              <p className="mb-2 text-sm font-medium">Response headers</p>
              <pre className="whitespace-pre-wrap break-words">
                {JSON.stringify(responseHeaders ?? {}, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ScreenshotViewer({ report }: { report: AdminBugReportRow }) {
  if (!report.screenshot) {
    return <p className="text-sm text-muted-foreground">No screenshot captured.</p>;
  }

  return (
    <div className="space-y-3">
      <div className="max-h-[55vh] overflow-auto rounded-xl border border-border/70 bg-background/60 p-2">
        <img src={report.screenshot} alt="Bug report screenshot" className="w-full rounded-md border" />
      </div>
      <a
        href={report.screenshot}
        target="_blank"
        rel="noreferrer"
        className="inline-flex text-sm text-primary underline underline-offset-2"
      >
        Open in new tab
      </a>
    </div>
  );
}

export default function BugReportsTab({ initialReports }: { initialReports: AdminBugReportRow[] }) {
  const [reports, setReports] = useState<AdminBugReportRow[]>(initialReports);
  const [sortKey, setSortKey] = useState<SortKey>('createdAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [updatingReportId, setUpdatingReportId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [viewerType, setViewerType] = useState<ViewerType>(null);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);

  const sortedReports = useMemo(
    () => sortReports(reports, sortKey, sortDirection),
    [reports, sortDirection, sortKey],
  );

  const selectedReport =
    selectedReportId === null ? null : reports.find((report) => report.id === selectedReportId) ?? null;

  const toggleSort = (nextSortKey: SortKey) => {
    if (sortKey === nextSortKey) {
      setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortKey(nextSortKey);
    setSortDirection(nextSortKey === 'createdAt' ? 'desc' : 'asc');
  };

  const openViewer = (type: Exclude<ViewerType, null>, reportId: string) => {
    setSelectedReportId(reportId);
    setViewerType(type);
  };

  const closeViewer = () => {
    setViewerType(null);
    setSelectedReportId(null);
  };

  const onStatusChange = async (reportId: string, status: BugReportStatus) => {
    setError(null);
    setUpdatingReportId(reportId);
    try {
      const updated = await api.updateAdminBugReportStatus(reportId, { status });
      setReports((current) =>
        current.map((report) => (report.id === reportId ? { ...report, ...updated } : report)),
      );
    } catch {
      setError('Could not update bug report status. Please try again.');
    } finally {
      setUpdatingReportId(null);
    }
  };

  return (
    <div className="card-editorial p-6 sm:p-8 space-y-6 animate-fade-up delay-150">
      <div className="space-y-2">
        <h2 className="font-display text-xl font-bold text-foreground">Bug Reports</h2>
        <p className="text-sm text-muted-foreground max-w-3xl">
          Review incoming reports from students and professors, inspect captured diagnostics, and
          move each report through triage status.
        </p>
      </div>

      {error ? (
        <div className="rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-2xl border border-border/70 bg-card/80">
        <table className="w-full min-w-[1080px] border-collapse">
          <thead className="border-b border-border/70 bg-muted/30">
            <tr>
              <th className="px-3 py-3 text-left">
                <SortHeader
                  title="Status"
                  sortKey="status"
                  activeSortKey={sortKey}
                  direction={sortDirection}
                  onToggle={toggleSort}
                />
              </th>
              <th className="px-3 py-3 text-left">
                <SortHeader
                  title="Description"
                  sortKey="description"
                  activeSortKey={sortKey}
                  direction={sortDirection}
                  onToggle={toggleSort}
                />
              </th>
              <th className="px-3 py-3 text-left">
                <SortHeader
                  title="Reporter"
                  sortKey="reporter"
                  activeSortKey={sortKey}
                  direction={sortDirection}
                  onToggle={toggleSort}
                />
              </th>
              <th className="px-3 py-3 text-left">
                <SortHeader
                  title="Role"
                  sortKey="role"
                  activeSortKey={sortKey}
                  direction={sortDirection}
                  onToggle={toggleSort}
                />
              </th>
              <th className="px-3 py-3 text-left">
                <SortHeader
                  title="Date"
                  sortKey="createdAt"
                  activeSortKey={sortKey}
                  direction={sortDirection}
                  onToggle={toggleSort}
                />
              </th>
              <th className="px-3 py-3 text-left">
                <SortHeader
                  title="Context"
                  sortKey="context"
                  activeSortKey={sortKey}
                  direction={sortDirection}
                  onToggle={toggleSort}
                />
              </th>
              <th className="px-3 py-3 text-left">
                <SortHeader
                  title="Page"
                  sortKey="page"
                  activeSortKey={sortKey}
                  direction={sortDirection}
                  onToggle={toggleSort}
                />
              </th>
              <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Attachments
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedReports.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-sm text-muted-foreground">
                  No bug reports yet.
                </td>
              </tr>
            ) : (
              sortedReports.map((report) => (
                <tr key={report.id} className="border-b border-border/50 align-top last:border-b-0">
                  <td className="px-3 py-3">
                    <div className="space-y-2">
                      <span
                        className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${getStatusClasses(report.status)}`}
                      >
                        {report.status}
                      </span>
                      <select
                        aria-label={`Update status for report ${report.id}`}
                        className="input-field h-8 text-xs"
                        value={report.status}
                        onChange={(event) =>
                          onStatusChange(report.id, event.target.value as BugReportStatus)
                        }
                        disabled={updatingReportId === report.id}
                      >
                        {STATUS_OPTIONS.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </div>
                  </td>
                  <td className="max-w-[320px] px-3 py-3 text-sm">
                    <button
                      type="button"
                      className="truncate text-left text-foreground hover:text-primary"
                      title={report.description}
                      onClick={() => openViewer('description', report.id)}
                    >
                      {report.description}
                    </button>
                  </td>
                  <td className="max-w-[220px] px-3 py-3 text-sm text-foreground">
                    {report.isAnonymous ? (
                      <span className="italic text-muted-foreground">Anonymous</span>
                    ) : (
                      getReporterLabel(report)
                    )}
                  </td>
                  <td className="px-3 py-3 text-sm text-muted-foreground">
                    {getReporterRole(report) ?? '-'}
                  </td>
                  <td className="px-3 py-3 text-sm text-muted-foreground">
                    {formatDateTime(report.createdAt)}
                  </td>
                  <td className="max-w-[260px] px-3 py-3 text-sm text-muted-foreground">
                    <span title={getContextLabel(report)}>{getContextLabel(report)}</span>
                  </td>
                  <td className="max-w-[220px] px-3 py-3 text-sm text-muted-foreground">
                    <span title={report.pageUrl ?? ''}>{getPathLabel(report.pageUrl)}</span>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => openViewer('console', report.id)}
                        disabled={!report.consoleLogs}
                      >
                        Console
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => openViewer('network', report.id)}
                        disabled={!report.networkLogs}
                      >
                        Network
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => openViewer('screenshot', report.id)}
                        disabled={!report.screenshot}
                      >
                        Screenshot
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={viewerType !== null} onOpenChange={(open) => (!open ? closeViewer() : undefined)}>
        <DialogContent className="max-w-4xl p-6">
          <DialogHeader>
            <DialogTitle>
              {viewerType === 'description'
                ? 'Report Description'
                : viewerType === 'console'
                  ? 'Console Logs'
                  : viewerType === 'network'
                    ? 'Network Logs'
                    : 'Screenshot'}
            </DialogTitle>
            <DialogDescription>
              {selectedReport
                ? `${getReporterLabel(selectedReport)} • ${formatDateTime(selectedReport.createdAt)}`
                : ''}
            </DialogDescription>
          </DialogHeader>
          {selectedReport ? (
            viewerType === 'description' ? (
              <DescriptionViewer report={selectedReport} />
            ) : viewerType === 'console' ? (
              <ConsoleViewer report={selectedReport} />
            ) : viewerType === 'network' ? (
              <NetworkViewer report={selectedReport} />
            ) : (
              <ScreenshotViewer report={selectedReport} />
            )
          ) : (
            <p className="text-sm text-muted-foreground">Report details unavailable.</p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
