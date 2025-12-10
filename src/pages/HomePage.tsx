import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  BarChart,
  Bell,
  Clock,
  Copy,
  Edit2,
  GitFork,
  LayoutDashboard,
  Loader2,
  LogOut,
  Menu,
  MoreVertical,
  Phone,
  Plus,
  Search,
  Settings,
  Trash2,
  Zap,
  X,
  type LucideIcon,
} from 'lucide-react';

import { getAvatarUrl, logout, type UserProfile } from '../services/auth';
import api from '../services/api';
import { isRealtimeConfigured, subscribeToWorkflowEvents, type WorkflowRealtimePayload } from '../services/realtime';
import type { WorkflowRecord } from '../types/workflow';
import { useTheme } from '../state/ThemeContext';

type WorkflowStatus = 'active' | 'draft' | 'error';
type FilterValue = WorkflowStatus | 'all';

type RichProfile = UserProfile & { photoURL?: string; picture?: string };

type NotificationItem = {
  id: string;
  user: string;
  action: string;
  workflow: string;
  timestamp: string;
  read: boolean;
  workflowId?: string;
};

interface Workflow extends WorkflowRecord {
  totalCalls?: number;
  avgDuration?: number;
  lastModified?: string;
}

interface HomePageProps {
  profile?: RichProfile | null;
}

type NavItem = {
  label: string;
  route: string;
  icon: LucideIcon;
  active?: boolean;
};

const navItems: NavItem[] = [
  { label: 'Dashboard', route: '/home', icon: LayoutDashboard, active: true },
  { label: 'Reports', route: '/reports', icon: BarChart },
  { label: 'Workflows', route: '/workflow', icon: GitFork },
  { label: 'Settings', route: '/settings', icon: Settings },
];

const STATUS_STYLES: Record<WorkflowStatus, { pillLight: string; pillDark: string; gradient: string }> = {
  active: {
    pillLight: 'border border-emerald-200 bg-emerald-50 text-emerald-700',
    pillDark: 'border border-emerald-400/30 bg-emerald-500/10 text-emerald-200',
    gradient: 'from-emerald-400 via-emerald-500 to-emerald-600',
  },
  draft: {
    pillLight: 'border border-amber-200 bg-amber-50 text-amber-700',
    pillDark: 'border border-amber-400/30 bg-amber-500/10 text-amber-200',
    gradient: 'from-amber-400 via-orange-500 to-orange-600',
  },
  error: {
    pillLight: 'border border-rose-200 bg-rose-50 text-rose-700',
    pillDark: 'border border-rose-400/30 bg-rose-500/10 text-rose-200',
    gradient: 'from-rose-400 via-rose-500 to-rose-600',
  },
};

function statusPill(status: WorkflowStatus, isDark: boolean): string {
  const style = STATUS_STYLES[status];
  return isDark ? style.pillDark : style.pillLight;
}

function statusGradient(status: WorkflowStatus): string {
  return STATUS_STYLES[status].gradient;
}

export default function HomePage({ profile }: HomePageProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterValue>('all');
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [workflowsLoading, setWorkflowsLoading] = useState(false);
  const [workflowsError, setWorkflowsError] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [isMaintenanceMode, setIsMaintenanceMode] = useState(false);
  const bellRef = useRef<HTMLDivElement | null>(null);

  const filteredWorkflows = useMemo(() => {
    return workflows.filter((workflow) => {
      const matchesSearch = workflow.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesFilter = activeFilter === 'all' || workflow.status === activeFilter;
      return matchesSearch && matchesFilter;
    });
  }, [activeFilter, searchQuery, workflows]);

  const avatarUrl = profile?.avatarUrl || profile?.photoURL || profile?.picture || getAvatarUrl(profile);
  const displayName = profile?.name || profile?.email || 'Operator';
  const displayEmail = profile?.email || 'Logged in';
  const initials = displayName
    .split(' ')
    .map((part) => part.charAt(0).toUpperCase())
    .slice(0, 2)
    .join('') || 'OP';

  const handleEditWorkflow = (workflow: Workflow) => {
    if (!workflow?.id) return;
    navigate(`/builder/${workflow.id}`);
  };

  const sidebarBase = isDark
    ? 'bg-slate-950 text-white border-white/10'
    : 'bg-white text-slate-900 border-slate-200';

  const unreadCount = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    if (!notificationsOpen) return;
    const handler = (event: MouseEvent) => {
      if (!bellRef.current) return;
      if (!bellRef.current.contains(event.target as Node)) {
        setNotificationsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [notificationsOpen]);

  const handleMarkNotification = (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  };

  const handleMarkAll = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const normalizeWorkflow = useCallback((record: WorkflowRecord): Workflow => {
    const coerceStatus = (value?: string): WorkflowStatus => {
      const normalized = (value ?? 'draft').toLowerCase();
      if (normalized === 'active') return 'active';
      if (normalized === 'draft' || normalized === 'paused') return 'draft';
      return 'error';
    };
    const lastUpdated = record.updated_at ? timeAgo(record.updated_at) : 'Just now';
    const metrics: any = (record as any).metrics || {};
    return {
      ...record,
      status: coerceStatus(record.status),
      totalCalls: (record as any).total_calls ?? metrics.totalCalls ?? 0,
      avgDuration: (record as any).avg_duration ?? metrics.avgDuration ?? 0,
      lastModified: lastUpdated,
    };
  }, []);

  const loadWorkflows = useCallback(async () => {
    const token = getAuthToken();
    if (!token) {
      setWorkflowsError('Missing auth token. Please sign in again.');
      return;
    }
    setWorkflowsLoading(true);
    setWorkflowsError(null);
    try {
      const { data: response, headers } = await api.workflows.listWithMeta(token);
      const systemStatus = headers.get('x-system-status');
      setIsMaintenanceMode((systemStatus ?? '').toLowerCase() === 'degraded');
      const items: unknown[] = Array.isArray(response)
        ? response
        : Array.isArray((response as any)?.data)
          ? (response as any).data
          : Array.isArray((response as any)?.items)
            ? (response as any).items
            : [];
      setWorkflows(items.map((item) => normalizeWorkflow(item as WorkflowRecord)));
    } catch (error: any) {
      setIsMaintenanceMode(false);
      setWorkflowsError(error?.message || 'Unable to load workflows');
    } finally {
      setWorkflowsLoading(false);
    }
  }, [normalizeWorkflow]);

  useEffect(() => {
    void loadWorkflows();
  }, [isRealtimeConfigured, loadWorkflows]);

  useEffect(() => {
    if (!isRealtimeConfigured) {
      return () => {};
    }
    const unsubscribe = subscribeToWorkflowEvents((payload) => {
      const notification = buildNotificationFromPayload(payload);
      if (notification) {
        setNotifications((prev) => [notification, ...prev].slice(0, 25));
      }
      if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
        void loadWorkflows();
      }
    });
    return () => {
      unsubscribe();
    };
  }, [loadWorkflows]);

  const handleCreateNew = useCallback(() => {
    navigate('/workflow');
  }, [navigate]);

  return (
    <div
      className={`min-h-screen w-full overflow-x-hidden ${
        isDark ? 'bg-gradient-to-br from-slate-950 via-blue-950 to-slate-950' : 'bg-gradient-to-br from-slate-50 via-white to-slate-50'
      }`}
    >
      {isDark && (
        <div className="pointer-events-none fixed inset-0 overflow-hidden">
          <div className="absolute left-1/4 top-0 h-96 w-96 rounded-full bg-blue-500/20 blur-3xl opacity-20 animate-pulse" />
          <div className="absolute bottom-0 right-1/4 h-96 w-96 rounded-full bg-purple-500/20 blur-3xl opacity-20 animate-pulse delay-1000" />
        </div>
      )}

      <div className="relative flex min-h-screen w-full overflow-hidden">
        {mobileSidebarOpen && (
          <div
            className="fixed inset-0 z-30 bg-slate-900/60 backdrop-blur-sm md:hidden"
            onClick={() => setMobileSidebarOpen(false)}
            aria-hidden="true"
          />
        )}
        <aside
          className={`${
            sidebarOpen ? 'md:w-64' : 'md:w-20'
          } ${mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'} ${sidebarBase} fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r px-4 py-6 transition-all duration-300 backdrop-blur-lg md:static md:translate-x-0 md:shadow-none`}
        >
          <div className="flex items-center justify-between gap-3 px-2">
            <div className={`flex items-center gap-3 ${!sidebarOpen ? 'w-full justify-center' : ''}`}>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-blue-400 to-purple-600 font-bold text-white">
                VA
              </div>
              {sidebarOpen && <span className="text-lg font-bold">VoiceAI</span>}
            </div>
            <button
              type="button"
              className={`rounded-lg p-2 transition-colors ${isDark ? 'text-white hover:bg-white/10' : 'text-slate-700 hover:bg-slate-100'} md:inline-flex`}
              onClick={() => (window.innerWidth < 768 ? setMobileSidebarOpen(false) : setSidebarOpen((prev) => !prev))}
              aria-label="Toggle sidebar"
            >
              {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>

          <nav className="mt-6 flex-1 space-y-2">
            {navItems.map((item) => (
              <Link
                key={item.label}
                to={item.route}
                onClick={(event) => {
                  event.preventDefault();
                  navigate(item.route);
                }}
                className={`flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-colors ${
                  item.active
                    ? isDark
                      ? 'border border-blue-500/40 bg-blue-500/10 text-blue-200'
                      : 'border border-blue-200 bg-blue-100 text-blue-700'
                    : isDark
                      ? 'text-gray-400 hover:bg-white/10'
                      : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <item.icon size={20} />
                {sidebarOpen && <span>{item.label}</span>}
              </Link>
            ))}
          </nav>

          <div className={`mt-auto border-t pt-4 ${isDark ? 'border-white/10' : 'border-slate-200'}`}>
            <div
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors ${
                isDark ? 'hover:bg-white/10' : 'hover:bg-slate-100'
              }`}
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-blue-400 to-purple-600 text-xs font-semibold text-white">
                {avatarUrl ? (
                  <img src={avatarUrl} alt={displayName} className="h-9 w-9 rounded-full object-cover" />
                ) : (
                  initials
                )}
              </div>
              {sidebarOpen && (
                <div className="min-w-0 text-sm">
                  <p className="truncate font-semibold">{displayName}</p>
                  <p className="truncate text-xs text-slate-500 dark:text-gray-400">{displayEmail}</p>
                </div>
              )}
            </div>
          </div>
        </aside>

        <div className="flex flex-1 flex-col overflow-hidden md:ml-0">
          <header
            className={`${
              isDark
                ? 'border-b border-white/10 bg-slate-900/40'
                : 'border-b border-slate-200 bg-white/90'
            } backdrop-blur-xl px-6 py-5`}
          >
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex w-full items-center gap-3">
                <button
                  type="button"
                  className={`rounded-lg p-2 md:hidden ${isDark ? 'text-white hover:bg-white/10' : 'text-slate-700 hover:bg-slate-100'}`}
                  onClick={() => setMobileSidebarOpen(true)}
                  aria-label="Open navigation"
                >
                  <Menu size={20} />
                </button>
                <div className="relative flex-1">
                  <Search className={`pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 ${isDark ? 'text-gray-400' : 'text-slate-400'}`} />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Search workflows..."
                    className={`w-full rounded-xl border px-11 py-2.5 font-medium outline-none transition focus:ring-1 ${
                      isDark
                        ? 'border-white/20 bg-white/10 text-white placeholder-gray-400 focus:border-blue-400 focus:ring-blue-400/40'
                        : 'border-slate-200 bg-white text-slate-900 placeholder-slate-500 focus:border-blue-400 focus:ring-blue-400/40'
                    }`}
                  />
                </div>
              </div>

              <div className="flex w-full items-center justify-end gap-3 md:w-auto md:ml-auto">
                <button
                  type="button"
                  onClick={handleCreateNew}
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 px-4 py-2.5 text-sm font-semibold text-white shadow transition hover:from-blue-600 hover:to-purple-700"
                >
                  <Plus size={18} />
                  New
                </button>

                <div className="relative" ref={bellRef}>
                  <button
                    type="button"
                    className={`relative rounded-xl p-2.5 ${isDark ? 'text-gray-300 hover:bg-white/10' : 'text-slate-500 hover:bg-slate-100'}`}
                    aria-label="Notifications"
                    onClick={() => setNotificationsOpen((prev) => !prev)}
                  >
                    <Bell size={20} />
                    {unreadCount > 0 && <span className="absolute right-2 top-2 inline-flex h-2 w-2 rounded-full bg-red-500" />}
                  </button>
                  {notificationsOpen && (
                    <div
                      className={`absolute right-0 z-50 mt-3 w-72 rounded-2xl border p-3 text-sm shadow-xl ${
                        isDark ? 'border-white/10 bg-slate-900/90 backdrop-blur' : 'border-slate-200 bg-white'
                      }`}
                    >
                      <div className="mb-3 flex items-center justify-between text-xs font-semibold uppercase tracking-wide">
                        <span>Notifications</span>
                        {unreadCount > 0 && (
                          <button
                            type="button"
                            onClick={handleMarkAll}
                            className="text-blue-500 hover:text-blue-400"
                          >
                            Mark all
                          </button>
                        )}
                      </div>
                      <div className="max-h-72 space-y-2 overflow-y-auto">
                        {notifications.length === 0 && (
                          <p className="text-center text-xs opacity-60">All caught up</p>
                        )}
                        {notifications.map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => handleMarkNotification(item.id)}
                            className={`w-full rounded-2xl border px-3 py-2 text-left transition ${
                              item.read
                                ? isDark
                                  ? 'border-white/5 bg-white/5 text-slate-200'
                                  : 'border-slate-100 bg-slate-50 text-slate-600'
                                : isDark
                                  ? 'border-blue-500/30 bg-blue-500/15 text-white'
                                  : 'border-blue-200 bg-blue-50 text-slate-900'
                            }`}
                          >
                            <p className="text-sm font-semibold">
                              {item.user} <span className="font-normal">{item.action}</span> {item.workflow}
                            </p>
                            <p className="text-xs opacity-70">{item.timestamp}</p>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setUserMenuOpen((prev) => !prev)}
                    className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-400 to-purple-600 text-sm font-semibold text-white shadow transition hover:shadow-blue-500/40"
                  >
                    {avatarUrl ? (
                      <img src={avatarUrl} alt={displayName} className="h-10 w-10 rounded-xl object-cover" />
                    ) : (
                      initials
                    )}
                  </button>
                  {userMenuOpen && (
                    <div
                      className={`absolute right-0 mt-3 w-48 rounded-xl border shadow-xl ${isDark ? 'border-white/20 bg-slate-900' : 'border-slate-200 bg-white'}`}
                    >
                      <button
                        type="button"
                        className={`flex w-full items-center gap-2 px-4 py-2 text-sm font-medium ${
                          isDark ? 'text-gray-200 hover:bg-white/10' : 'text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <Settings size={16} /> Profile Settings
                      </button>
                      <button
                        type="button"
                        className={`flex w-full items-center gap-2 px-4 py-2 text-sm font-medium ${
                          isDark ? 'text-gray-200 hover:bg-white/10' : 'text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <Bell size={16} /> Notifications
                      </button>
                      <div className={isDark ? 'h-px bg-white/10' : 'h-px bg-slate-200'} />
                      <button
                        type="button"
                        className={`flex w-full items-center gap-2 px-4 py-2 text-sm font-medium ${
                          isDark ? 'text-red-400 hover:bg-red-500/10' : 'text-red-600 hover:bg-red-50'
                        }`}
                        onClick={() => logout('/')}
                      >
                        <LogOut size={16} /> Sign Out
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </header>

          <main className="flex-1 overflow-auto px-4 py-6 sm:px-6 lg:px-8">
            <div className="mb-8 flex items-center justify-between">
              <div>
                <h1 className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>Voice Agents</h1>
                <p className={isDark ? 'text-gray-400' : 'text-slate-600'}>Manage and monitor your AI voice workflows</p>
              </div>
            </div>

            {workflowsError && (
              <div className={`mb-6 rounded-2xl border px-4 py-3 text-sm font-semibold ${
                isDark ? 'border-rose-500/40 bg-rose-500/10 text-rose-100' : 'border-rose-200 bg-rose-50 text-rose-700'
              }`}
              >
                {workflowsError}
              </div>
            )}

            {isMaintenanceMode && (
              <div
                className={`mb-6 rounded-2xl border px-4 py-3 text-sm font-semibold ${
                  isDark ? 'border-amber-400/40 bg-amber-500/10 text-amber-100' : 'border-amber-200 bg-amber-50 text-amber-800'
                }`}
              >
                Hệ thống đang bảo trì, danh sách có thể không đầy đủ.
              </div>
            )}

            <div className="mb-8 flex gap-3 overflow-x-auto pb-2">
              {([
                { label: 'All Workflows', value: 'all' },
                { label: 'Active', value: 'active' },
                { label: 'Draft', value: 'draft' },
                { label: 'Error', value: 'error' },
              ] as Array<{ label: string; value: FilterValue }>).map((filter) => (
                <button
                  key={filter.value}
                  type="button"
                  onClick={() => setActiveFilter(filter.value)}
                  className={`whitespace-nowrap rounded-lg border px-4 py-2.5 text-sm font-medium transition ${
                    activeFilter === filter.value
                      ? isDark
                        ? 'border-blue-400/60 bg-blue-500/20 text-blue-200'
                        : 'border-blue-200 bg-blue-100 text-blue-700'
                      : isDark
                        ? 'border-white/10 bg-white/5 text-gray-400 hover:bg-white/10'
                        : 'border-slate-200 bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>

            {workflowsLoading && (
              <div className="mb-6 flex items-center gap-3 text-sm text-slate-500 dark:text-slate-300">
                <Loader2 className="h-4 w-4 animate-spin" />
                Syncing latest workflows...
              </div>
            )}

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {filteredWorkflows.map((workflow) => (
                <article
                  key={workflow.id}
                  className={`group rounded-2xl border p-6 transition-all duration-300 ${
                    isDark
                      ? 'border-white/10 bg-slate-900/30 backdrop-blur-xl hover:border-white/20 hover:shadow-2xl hover:shadow-blue-500/10'
                      : 'border-slate-200 bg-white/90 backdrop-blur-xl hover:border-blue-300 hover:shadow-lg hover:shadow-blue-500/10'
                  }`}
                >
                  <div className="mb-4 flex items-start justify-between">
                    <div>
                      <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>{workflow.name}</h3>
                      <div className={`mt-2 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${statusPill(workflow.status, isDark)}`}>
                        <span className={`h-2 w-2 rounded-full bg-gradient-to-r ${statusGradient(workflow.status)}`} />
                        {workflow.status.charAt(0).toUpperCase() + workflow.status.slice(1)}
                      </div>
                    </div>
                    <button
                      type="button"
                      className={`rounded-lg p-2 opacity-0 transition group-hover:opacity-100 ${isDark ? 'text-gray-400 hover:bg-white/10' : 'text-slate-500 hover:bg-slate-100'}`}
                      aria-label="More actions"
                    >
                      <MoreVertical size={18} />
                    </button>
                  </div>

                  <div className={`mb-6 space-y-3 border-t pt-4 ${isDark ? 'border-white/10' : 'border-slate-200'}`}>
                    <div className="flex items-center justify-between text-sm">
                      <span className={`${isDark ? 'text-gray-400' : 'text-slate-600'} flex items-center gap-2`}>
                        <Phone size={16} /> Total Calls
                      </span>
                      <span className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                        {(((workflow.totalCalls ?? 0) / 1000) || 0).toFixed(1)}k
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className={`${isDark ? 'text-gray-400' : 'text-slate-600'} flex items-center gap-2`}>
                        <Clock size={16} /> Avg Duration
                      </span>
                      <span className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                        {(workflow.avgDuration ?? 0).toFixed(1)}m
                      </span>
                    </div>
                  </div>

                  <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-slate-500'}`}>
                    Last modified: {workflow.lastModified || timeAgo(workflow.updated_at || new Date().toISOString())}
                  </p>

                  <div className={`mt-4 flex gap-2 border-t pt-4 text-sm font-medium opacity-0 transition group-hover:opacity-100 ${isDark ? 'border-white/10' : 'border-slate-200'}`}>
                    <button
                      type="button"
                      onClick={() => handleEditWorkflow(workflow)}
                      className={`${
                        isDark ? 'bg-blue-500/20 text-blue-200 hover:bg-blue-500/30' : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                      } flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2`}
                    >
                      <Edit2 size={16} /> Edit
                    </button>
                    <button
                      type="button"
                      className={`${
                        isDark ? 'bg-purple-500/20 text-purple-200 hover:bg-purple-500/30' : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                      } flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2`}
                    >
                      <Copy size={16} /> Duplicate
                    </button>
                    <button
                      type="button"
                      className={`${
                        isDark ? 'bg-red-500/20 text-red-300 hover:bg-red-500/30' : 'bg-red-100 text-red-700 hover:bg-red-200'
                      } flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2`}
                    >
                      <Trash2 size={16} /> Delete
                    </button>
                  </div>
                </article>
              ))}
            </div>

            {!workflowsLoading && filteredWorkflows.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <Zap size={48} className={isDark ? 'text-gray-600' : 'text-slate-300'} />
                <h3 className={`mt-4 text-xl font-semibold ${isDark ? 'text-gray-300' : 'text-slate-600'}`}>No workflows found</h3>
                <p className={isDark ? 'text-gray-500' : 'text-slate-500'}>Try adjusting your filters or create a new workflow</p>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}

function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem('auth_token');
}

function timeAgo(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Just now';
  const diff = Date.now() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}

function buildNotificationFromPayload(payload: WorkflowRealtimePayload): NotificationItem | null {
  if (!payload) return null;
  const next = (payload.new as Record<string, any> | null) ?? null;
  const prev = (payload.old as Record<string, any> | null) ?? null;
  const workflowId = (next?.id ?? prev?.id)?.toString();
  const workflowName = sanitizeWorkflowName((next?.name ?? prev?.name) as string | undefined);
  const actorCandidate =
    (next?.updated_by_name ?? next?.updated_by ?? next?.last_modified_by ?? next?.user_name ?? next?.user_id ?? null) ||
    (prev?.updated_by_name ?? prev?.updated_by ?? prev?.last_modified_by ?? prev?.user_name ?? prev?.user_id ?? null);
  const action = describeWorkflowEvent(payload.eventType);
  const timestampSource =
    payload.commit_timestamp || next?.updated_at || next?.created_at || prev?.updated_at || prev?.created_at || new Date().toISOString();

  return {
    id: `${payload.eventType}-${workflowId ?? 'unknown'}-${payload.commit_timestamp ?? Date.now()}`,
    user: formatActor(actorCandidate),
    action,
    workflow: workflowName,
    timestamp: timeAgo(String(timestampSource)),
    read: false,
    workflowId,
  };
}

function formatActor(value?: string | null): string {
  if (!value) return 'Someone';
  const trimmed = value.trim();
  if (!trimmed) return 'Someone';
  if (trimmed.includes('@')) {
    const [namePart] = trimmed.split('@');
    if (namePart) return namePart;
  }
  return trimmed.length > 28 ? `${trimmed.slice(0, 27)}…` : trimmed;
}

function describeWorkflowEvent(type?: string): string {
  switch ((type || '').toUpperCase()) {
    case 'INSERT':
      return 'created';
    case 'UPDATE':
      return 'updated';
    case 'DELETE':
      return 'deleted';
    default:
      return 'changed';
  }
}

function sanitizeWorkflowName(value?: string | null): string {
  if (!value) return 'workflow';
  const trimmed = value.trim();
  return trimmed || 'Workflow';
}
