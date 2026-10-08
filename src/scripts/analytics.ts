type Consent = 'granted' | 'denied';
declare global {
  interface Window { dataLayer: unknown[]; gtag?: (...args: unknown[]) => void; }
}
const id = document.querySelector<HTMLElement>('#analytics-config')?.dataset.measurementId || '';
const banner = document.querySelector<HTMLElement>('#consent-banner');
const key = 'okurinochizu.analytics.v1';
let consent: Consent | null = null;
let initialized = false;
try {
  const saved = localStorage.getItem(key);
  if (saved === 'granted' || saved === 'denied') consent = saved;
} catch { /* Storage unavailable: remain untracked until an explicit choice. */ }
function stopAnalytics() {
  (window as unknown as Record<string, unknown>)['ga-disable-' + id] = true;
  window.gtag?.('consent', 'update', { analytics_storage: 'denied', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' });
  document.cookie.split(';').forEach(cookie => {
    const name = cookie.split('=')[0]?.trim();
    if (name && /^_ga(?:_|$)/.test(name)) {
      const suffix = '; Max-Age=0; path=/; SameSite=Lax; Secure';
      document.cookie = name + '=' + suffix;
      document.cookie = name + '=' + suffix + '; domain=' + location.hostname;
      document.cookie = name + '=' + suffix + '; domain=.' + location.hostname;
    }
  });
}
function startAnalytics() {
  if (!/^G-[A-Z0-9]+$/.test(id)) return;
  (window as unknown as Record<string, unknown>)['ga-disable-' + id] = false;
  if (initialized) {
    window.gtag?.('consent', 'update', { analytics_storage: 'granted' });
    return;
  }
  initialized = true;
  window.dataLayer = window.dataLayer || [];
  window.gtag = function () { window.dataLayer.push(arguments); };
  window.gtag('consent', 'default', { analytics_storage: 'granted', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' });
  window.gtag('js', new Date());
  window.gtag('config', id, { allow_google_signals: false, allow_ad_personalization_signals: false, send_page_view: true, page_location: location.origin + location.pathname });
  const script = document.createElement('script');
  script.async = true;
  script.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(id);
  document.head.appendChild(script);
}
function apply(next: Consent) {
  consent = next;
  try { localStorage.setItem(key, next); } catch { /* Current-page choice still applies. */ }
  if (banner) banner.hidden = true;
  if (next === 'granted') startAnalytics(); else stopAnalytics();
}
if (consent === 'granted') startAnalytics();
else if (!consent && banner) banner.hidden = false;
document.querySelectorAll<HTMLButtonElement>('[data-consent]').forEach(button => button.addEventListener('click', () => apply(button.dataset.consent as Consent)));
document.querySelectorAll<HTMLButtonElement>('[data-consent-settings]').forEach(button => button.addEventListener('click', () => {
  if (banner) { banner.hidden = false; banner.querySelector<HTMLButtonElement>('button')?.focus(); }
}));
document.addEventListener('click', event => {
  const target = event.target;
  if (!(target instanceof Element)) return;
  const anchor = target.closest<HTMLAnchorElement>('a[data-provider-link]');
  if (!anchor || consent !== 'granted') return;
  const destination = new URL(anchor.href);
  if (!['so-gi.com', 'www.so-gi.com'].includes(destination.hostname)) return;
  window.gtag?.('event', 'provider_referral_click', {
    provider: 'tsubasa', destination_url: destination.origin + destination.pathname,
    content_slug: anchor.dataset.contentSlug || location.pathname,
    region: anchor.dataset.region || 'all',
    intent: anchor.dataset.intent || 'general', placement: anchor.dataset.placement || 'inline',
    transport_type: 'beacon',
  });
});
window.addEventListener('storage', event => {
  if (event.key === key && (event.newValue === 'granted' || event.newValue === 'denied')) {
    consent = event.newValue;
    if (consent === 'granted') startAnalytics(); else stopAnalytics();
  }
});
export {};
