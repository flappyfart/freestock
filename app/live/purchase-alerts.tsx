'use client';
import { useEffect, useRef, useState } from 'react';
import { Bell, BellRing, ArrowUpRight, Check, RefreshCw } from 'lucide-react';
import { formatUnits } from 'ethers';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '../../components/ui/dialog';
import type { PurchaseAlert } from '../../lib/live/purchase-alert-store';
import './purchase-alerts.css';

export const ALERTS_CHANGED = 'freestock:alerts-changed';
type Payload = {
  alerts: PurchaseAlert[];
  publicKey: string | null;
  subscribed: boolean;
  error?: string;
};
const when = (s: number) => new Date(s * 1000).toLocaleString();
async function deviceId(endpoint: string) {
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest('SHA-256', new TextEncoder().encode(endpoint)),
    ),
    (b) => b.toString(16).padStart(2, '0'),
  ).join('');
}
export function PurchaseAlerts({
  owner,
  onPlan,
  blocked,
}: {
  owner: string;
  onPlan: (alert?: PurchaseAlert) => void;
  blocked: boolean;
}) {
  const [open, setOpen] = useState(false),
    [data, setData] = useState<Payload | null>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState('');
  const [supported, setSupported] = useState(false),
    [permission, setPermission] = useState<NotificationPermission>('default');
  const current = useRef(owner),
    device = useRef(''),
    loading = useRef(false),
    alive = useRef(true);
  useEffect(() => {
    current.current = owner;
  }, [owner]);
  async function refresh(signal?: AbortSignal) {
    if (loading.current) return;
    loading.current = true;
    const captured = owner;
    try {
      const q = new URLSearchParams({ owner, device: device.current });
      const r = await fetch(`/api/live/alerts?${q}`, {
        cache: 'no-store',
        signal,
      });
      const value = (await r.json()) as Payload;
      if (!r.ok) throw Error(value.error ?? 'Alerts could not load.');
      if (!alive.current || current.current !== captured || signal?.aborted)
        return;
      setData(value);
      setError('');
    } catch (e) {
      if (alive.current && current.current === captured && !signal?.aborted)
        setError(e instanceof Error ? e.message : 'Alerts could not load.');
    } finally {
      loading.current = false;
    }
  }
  useEffect(() => {
    alive.current = true;
    const controller = new AbortController();
    const supports =
      window.isSecureContext &&
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window;
    // oxlint-disable-next-line react/react-compiler -- Restore this browser's notification capability and private inbox.
    setSupported(supports);
    if (supports) setPermission(Notification.permission);
    if (new URLSearchParams(window.location.search).get('alerts') === '1')
      setOpen(true);
    const boot = async () => {
      if (supports) {
        try {
          const registration =
            await navigator.serviceWorker.getRegistration('/');
          const subscription =
            await registration?.pushManager.getSubscription();
          if (subscription)
            device.current = await deviceId(subscription.endpoint);
        } catch {
          /* Inbox remains usable without browser push. */
        }
      }
      if (!controller.signal.aborted) await refresh(controller.signal);
    };
    void boot();
    const update = () => {
      if (!document.hidden) void refresh(controller.signal);
    };
    const timer = window.setInterval(update, 60000);
    window.addEventListener(ALERTS_CHANGED, update);
    window.addEventListener('focus', update);
    document.addEventListener('visibilitychange', update);
    return () => {
      alive.current = false;
      controller.abort();
      window.clearInterval(timer);
      window.removeEventListener(ALERTS_CHANGED, update);
      window.removeEventListener('focus', update);
      document.removeEventListener('visibilitychange', update);
    };
    // Parent remounts on wallet/session changes; inbox polling never changes the lending form.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [owner]);
  async function post(body: Record<string, unknown>) {
    const r = await fetch('/api/live/alerts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...body, owner }),
    });
    const value = (await r.json()) as { error?: string; device?: string };
    if (!r.ok) throw Error(value.error ?? 'Please try again.');
    return value;
  }
  async function browserAlerts() {
    if (!data || (!data.subscribed && !data.publicKey) || !supported || busy)
      return;
    setBusy(true);
    setNotice('');
    setError('');
    const captured = owner;
    try {
      if (data.subscribed) {
        await post({ action: 'unsubscribe', device: device.current });
        const registration = await navigator.serviceWorker.getRegistration('/');
        await (
          await registration?.pushManager.getSubscription()
        )?.unsubscribe();
        device.current = '';
        if (alive.current && current.current === captured)
          setNotice(
            'Browser notifications are off on this browser. Your saved inbox remains available.',
          );
      } else {
        // Permission is requested only from this explicit user gesture.
        const granted = await Notification.requestPermission();
        if (alive.current) setPermission(granted);
        if (granted !== 'granted')
          throw Error(
            'Notifications were not allowed. You can still use your Freestock inbox.',
          );
        await navigator.serviceWorker.register('/freestock-push.js', {
          scope: '/',
        });
        const registration = await navigator.serviceWorker.ready;
        let subscription = await registration.pushManager.getSubscription();
        if (!subscription) {
          const bytes = Uint8Array.from(
            atob(data.publicKey!.replace(/-/g, '+').replace(/_/g, '/')),
            (c) => c.charCodeAt(0),
          );
          subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: bytes,
          });
        }
        if (!alive.current || current.current !== captured) return;
        const result = await post({
          action: 'subscribe',
          subscription: subscription.toJSON(),
        });
        device.current = result.device!;
        setNotice(
          'Browser notifications enabled for this wallet. Turn on purchase-ready alerts in your saved plan.',
        );
      }
      await refresh();
    } catch (e) {
      if (alive.current && current.current === captured)
        setError(
          e instanceof Error
            ? e.message
            : 'This browser could not enable notifications.',
        );
    } finally {
      if (alive.current) setBusy(false);
    }
  }
  async function markRead(alert: PurchaseAlert, review = false) {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await post({ action: 'read', id: alert.id });
      if (!alive.current) return;
      setData((previous) =>
        previous
          ? {
              ...previous,
              alerts: previous.alerts.map((a) =>
                a.id === alert.id ? { ...a, readAt: Date.now() / 1000 } : a,
              ),
            }
          : previous,
      );
      if (review) {
        setOpen(false);
        onPlan(alert);
      }
    } catch (e) {
      if (alive.current)
        setError(e instanceof Error ? e.message : 'Try again.');
    } finally {
      if (alive.current) setBusy(false);
    }
  }
  const unread = data?.alerts.filter((a) => a.current && !a.readAt).length ?? 0;
  return (
    <div className="purchase-alerts-toolbar">
      <button
        type="button"
        className="purchase-alerts-trigger"
        onClick={() => {
          setOpen(true);
          void refresh();
        }}
        aria-label={`Alerts${unread ? `, ${unread} unread` : ''}`}
        aria-haspopup="dialog"
      >
        <Bell size={18} />
        <span>Alerts</span>
        {unread > 0 && <b>{unread}</b>}
        {error && (
          <span className="purchase-alerts-dot" aria-label="Refresh needed" />
        )}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="purchase-alerts-dialog">
          <div className="purchase-alerts-heading">
            <span>
              <BellRing size={20} /> YOUR NEXT MOVE
            </span>
            <DialogTitle>Purchase-ready alerts</DialogTitle>
            <DialogDescription>
              Your plan checks the rules. You decide what happens next.
            </DialogDescription>
          </div>
          <section
            className="purchase-alerts-browser"
            aria-label="Browser notifications"
          >
            <div>
              <h3>Also notify this browser</h3>
              <p>
                Opt in to receive a notification even when Freestock is closed.
                Enabling here links this browser to the connected wallet.
              </p>
            </div>
            <button
              type="button"
              className="dashboard-button"
              disabled={
                busy ||
                !supported ||
                (!data?.subscribed && !data?.publicKey) ||
                (permission === 'denied' && !data?.subscribed)
              }
              onClick={() => void browserAlerts()}
            >
              {busy
                ? 'Updating…'
                : data?.subscribed
                  ? 'Turn off on this browser'
                  : 'Enable browser alerts'}
            </button>
            <small>
              {!supported
                ? 'This browser does not support push here. On iPhone or iPad, add Freestock to your Home Screen and open it from there.'
                : permission === 'denied'
                  ? 'Notifications are blocked in browser settings. Allow them there to enable push.'
                  : !data?.publicKey
                    ? 'Browser notifications are temporarily unavailable. Your inbox still works.'
                    : 'Delivery depends on your browser and notification settings. Checks are scheduled and can be delayed.'}
            </small>
          </section>
          {notice && (
            <output className="purchase-alerts-notice">{notice}</output>
          )}
          {error && (
            <p role="alert" className="purchase-alerts-error">
              {error}
            </p>
          )}
          <div className="purchase-alerts-list-heading">
            <h3>Your inbox{unread > 0 ? ` · ${unread} unread` : ''}</h3>
            <button
              type="button"
              disabled={busy}
              onClick={() => void refresh()}
              aria-label="Refresh alerts"
            >
              <RefreshCw size={16} />
            </button>
          </div>
          {!data && !error && <output>Loading your alerts…</output>}
          {data?.alerts.length === 0 && (
            <div className="purchase-alerts-empty">
              <Bell size={30} />
              <h3>Know when your plan is ready.</h3>
              <p>
                In Agentic Lending, turn on purchase-ready alerts and save your
                plan. Enable background checks to build your inbox while you’re
                away.
              </p>
              <button
                className="dashboard-button"
                type="button"
                disabled={blocked}
                onClick={() => {
                  setOpen(false);
                  onPlan();
                }}
              >
                Set up my alerts <ArrowUpRight size={16} />
              </button>
            </div>
          )}
          <ul className="purchase-alerts-list">
            {data?.alerts.map((alert) => (
              <li key={alert.id} data-unread={alert.current && !alert.readAt}>
                <div className="purchase-alert-status">
                  <span>
                    {!alert.current
                      ? 'Earlier alert'
                      : alert.checkUnavailable
                        ? 'Latest check unavailable'
                        : 'Rules met at last check'}
                  </span>
                  {!alert.readAt && alert.current && <b>New</b>}
                </div>
                <h3>Your plan met its purchase rules</h3>
                <p>
                  {formatUnits(alert.assets, 6)} USDG toward{' '}
                  {alert.allocations.map((a) => a.symbol).join(' + ')} at the
                  last successful check.
                </p>
                <small>
                  Position {alert.account.slice(0, 6)}…{alert.account.slice(-4)}{' '}
                  ·{' '}
                  <time
                    dateTime={new Date(alert.confirmedAt * 1000).toISOString()}
                  >
                    {when(alert.confirmedAt)}
                  </time>
                </small>
                <p className="purchase-alerts-freshness">
                  {alert.current
                    ? 'A fresh check is required before reviewing a purchase.'
                    : 'The plan changed or its rules are no longer met. This alert is historical.'}
                </p>
                <div className="purchase-alerts-actions">
                  <button
                    className="dashboard-button"
                    type="button"
                    disabled={busy || blocked}
                    onClick={() => void markRead(alert, true)}
                  >
                    {alert.current ? 'Open plan & check' : 'Open plan'}{' '}
                    <ArrowUpRight size={15} />
                  </button>
                  {!alert.readAt && (
                    <button
                      className="purchase-alerts-read"
                      type="button"
                      disabled={busy}
                      onClick={() => void markRead(alert)}
                    >
                      <Check size={15} /> Mark read
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
          <p className="purchase-alerts-footer">
            Alerts do not place orders. Every purchase needs a fresh review and
            your wallet approval.
          </p>
        </DialogContent>
      </Dialog>
    </div>
  );
}
