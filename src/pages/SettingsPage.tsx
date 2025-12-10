import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { useTheme } from '../state/ThemeContext';

export default function SettingsPage() {
  const { theme } = useTheme();
  const navigate = useNavigate();
  const isDark = theme === 'dark';
  const shellBg = isDark ? 'bg-slate-950 text-white' : 'bg-slate-50 text-slate-900';
  const cardBase = isDark
    ? 'border-white/10 bg-slate-900/60'
    : 'border-slate-200 bg-white';

  return (
    <div className={`min-h-screen w-full ${shellBg}`}>
      <div className="flex w-full flex-col gap-8 px-6 py-10 lg:px-16">
        <div className="flex items-center">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition ${
              isDark ? 'border-white/20 text-white hover:bg-white/10' : 'border-slate-200 text-slate-700 hover:bg-slate-100'
            }`}
          >
            <ArrowLeft size={16} /> Back
          </button>
        </div>

        <header className="flex flex-col gap-2">
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-500">Control Center</p>
          <h1 className="text-3xl font-bold">Workspace Settings</h1>
          <p className={isDark ? 'text-gray-400' : 'text-slate-600'}>
            Keep your VoiceAI workspace in sync by updating preferences, notification policies, and account access.
          </p>
        </header>

        <section className={`rounded-3xl border p-6 shadow-sm backdrop-blur ${cardBase}`}>
          <div className="flex flex-col gap-6 md:flex-row">
            <div className="flex-1">
              <h2 className="text-xl font-semibold">Notification Preferences</h2>
              <p className={`mt-1 text-sm ${isDark ? 'text-gray-400' : 'text-slate-600'}`}>
                Decide when we should nudge you about workflow health, billing windows, and collaboration invites.
              </p>
            </div>
            <div className="flex flex-1 flex-col gap-4">
              <label className="flex items-center justify-between rounded-2xl border px-4 py-3 text-sm font-medium transition-colors hover:border-blue-400">
                Email digests for workflow alerts
                <input type="checkbox" defaultChecked className="h-5 w-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
              </label>
              <label className="flex items-center justify-between rounded-2xl border px-4 py-3 text-sm font-medium transition-colors hover:border-blue-400">
                Slack notifications for failures
                <input type="checkbox" defaultChecked={false} className="h-5 w-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
              </label>
              <label className="flex items-center justify-between rounded-2xl border px-4 py-3 text-sm font-medium transition-colors hover:border-blue-400">
                SMS summary each morning
                <input type="checkbox" defaultChecked className="h-5 w-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
              </label>
            </div>
          </div>
        </section>

        <section className={`rounded-3xl border p-6 shadow-sm backdrop-blur ${cardBase}`}>
          <div className="flex flex-col gap-6 md:flex-row">
            <div className="flex-1">
              <h2 className="text-xl font-semibold">Access Management</h2>
              <p className={`mt-1 text-sm ${isDark ? 'text-gray-400' : 'text-slate-600'}`}>
                Toggle provisioning for teammates and enforce organization-wide policies.
              </p>
            </div>
            <div className="flex flex-1 flex-col gap-4">
              <div className="rounded-2xl border p-4">
                <p className="text-sm font-semibold">Invite link</p>
                <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>Share with anyone inside your domain</p>
                <div className="mt-3 flex items-center gap-3">
                  <input
                    type="text"
                    readOnly
                    className={`flex-1 rounded-xl border px-3 py-2 text-sm ${isDark ? 'border-white/10 bg-white/5 text-white' : 'border-slate-200 bg-slate-50'}`}
                    value="https://voiceai.app/invite/acme"
                  />
                  <button type="button" className="rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 px-4 py-2 text-sm font-semibold text-white">
                    Copy
                  </button>
                </div>
              </div>
              <div className="rounded-2xl border p-4">
                <p className="text-sm font-semibold">Enforce MFA</p>
                <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>Require multi-factor sign-in across all members</p>
                <div className="mt-3 flex items-center gap-4">
                  <span className="text-sm font-medium">Status: Enabled</span>
                  <button type="button" className="rounded-lg border px-3 py-1 text-xs font-semibold hover:border-blue-400">
                    Disable
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className={`rounded-3xl border p-6 shadow-sm backdrop-blur ${cardBase}`}>
          <div className="flex flex-col gap-4">
            <div>
              <h2 className="text-xl font-semibold">Workspace Region</h2>
              <p className={`mt-1 text-sm ${isDark ? 'text-gray-400' : 'text-slate-600'}`}>
                Choose where we store conversation logs and voice models for regulatory compliance.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="rounded-2xl border p-4 text-sm font-medium">
                <input type="radio" name="region" defaultChecked className="mr-3" />
                US-East (N. Virginia)
                <p className={`mt-1 text-xs ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
                  Best latency for Americas
                </p>
              </label>
              <label className="rounded-2xl border p-4 text-sm font-medium">
                <input type="radio" name="region" className="mr-3" />
                EU-West (Frankfurt)
                <p className={`mt-1 text-xs ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
                  GDPR-ready storage
                </p>
              </label>
            </div>
            <div className="flex flex-wrap gap-3 pt-2">
              <button type="button" className="rounded-xl border px-4 py-2 text-sm font-semibold hover:border-blue-400">
                Cancel
              </button>
              <button type="button" className="rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 px-5 py-2 text-sm font-semibold text-white">
                Save changes
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
