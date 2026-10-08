type Consent = 'granted' | 'denied';
declare global {
  interface Window { dataLayer: unknown[]; gtag?: (...args: unknown[]) => void; }
}
const id = document.querySelector<HTMLElement>('#analytics-config')?.dataset.measurementId || '';
const key = 'okurinochizu.analytics.v1';
let consent: Consent = 'granted';
let initialized = false;
let tagLoaded = false;
try {
  const saved = localStorage.getItem(key);
  if (saved === 'granted' || saved === 'denied') consent = saved;
} catch { /* The page setting still works when persistent storage is unavailable. */ }
function refreshSettings() {
  const status = document.querySelector<HTMLElement>('#analytics-status');
  if (status) status.textContent = consent === 'granted' ? 'このブラウザーのアクセス解析は有効です。' : 'このブラウザーのアクセス解析は停止しています。';
  document.querySelectorAll<HTMLButtonElement>('[data-consent]').forEach(button => {
    button.disabled = button.dataset.consent === consent;
  });
}
function stopAnalytics() {
  (window as unknown as Record<string, unknown>)['ga-disable-' + id] = true;
  window.gtag?.('consent', 'update', { analytics_storage: 'denied', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' });
  document.querySelector('script[data-analytics-tag]')?.remove();
  document.cookie.split(';').forEach(cookie => {
    const name = cookie.split('=')[0]?.trim();
    if (name && /^_ga(?:_|$)/.test(name)) {
      const suffix = '; Max-Age=0; path=/; SameSite=Lax' + (location.protocol === 'https:' ? '; Secure' : '');
      document.cookie = name + '=' + suffix;
      document.cookie = name + '=' + suffix + '; domain=' + location.hostname;
      document.cookie = name + '=' + suffix + '; domain=.' + location.hostname;
    }
  });
}
function loadGoogleTag() {
  if (tagLoaded || document.querySelector('script[data-analytics-tag]')) return;
  const script = document.createElement('script');
  script.async = true;
  script.dataset.analyticsTag = '';
  script.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(id);
  script.addEventListener('load', () => { tagLoaded = true; });
  document.head.appendChild(script);
}
function withoutParameters(value: string) {
  try { const url = new URL(value); return url.origin + url.pathname; } catch { return ''; }
}
function startAnalytics() {
  if (!/^G-[A-Z0-9]+$/.test(id)) return;
  (window as unknown as Record<string, unknown>)['ga-disable-' + id] = false;
  if (initialized) {
    window.gtag?.('consent', 'update', { analytics_storage: 'granted' });
    loadGoogleTag();
    return;
  }
  initialized = true;
  window.dataLayer = window.dataLayer || [];
  window.gtag = function () { window.dataLayer.push(arguments); };
  window.gtag('consent', 'default', { analytics_storage: 'granted', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' });
  window.gtag('js', new Date());
  window.gtag('config', id, { allow_google_signals: false, allow_ad_personalization_signals: false, send_page_view: true, page_location: location.origin + location.pathname, page_referrer: withoutParameters(document.referrer) });
  loadGoogleTag();
}
function apply(next: Consent) {
  consent = next;
  try { localStorage.setItem(key, next); } catch { /* Current-page choice still applies. */ }
  if (next === 'granted') startAnalytics(); else stopAnalytics();
  refreshSettings();
}
if (consent === 'granted') startAnalytics();
else stopAnalytics();
refreshSettings();
document.querySelectorAll<HTMLButtonElement>('[data-consent]').forEach(button => button.addEventListener('click', () => apply(button.dataset.consent as Consent)));
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
  if (event.key === key || event.key === null) {
    try { consent = localStorage.getItem(key) === 'denied' ? 'denied' : 'granted'; }
    catch { consent = event.newValue === 'denied' ? 'denied' : 'granted'; }
    if (consent === 'granted') startAnalytics(); else stopAnalytics();
    refreshSettings();
  }
});
export {};
