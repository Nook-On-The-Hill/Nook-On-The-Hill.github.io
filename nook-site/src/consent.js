/* Nook cookie consent v4 (18 Nov 2026): Google Consent Mode v2, with a notice-and-opt-out mode for Australia
   Who sees what:
   - Visitors whose browser timezone is Australia/*: a notice. Analytics and Marketing are ON by default and
     they can switch anything off with "Choose" (or "Turn all off"). Australia has no cookie-consent law.
   - Everyone else (Europe, UK, anywhere unknown): the v3 opt-in banner. Nothing is on until they agree.
   - Anyone who has already chosen (v3 or v4) keeps their choice for a year, whichever country.
   Google's tag always loads, but starts with ALL storage denied, then is updated to match the visitor's
   choice (so for notice-mode visitors, granted straight away). The Meta Pixel loads only when Marketing
   is allowed. Counts, with no personal data: nook_consent_shown, _accept, _decline, _custom, _ack.
   window.nookConsent() returns the effective choice ({analytics, marketing}) for the gift certificate and ad
   click ID code. In notice mode before any click it returns {analytics:true, marketing:true, implied:true}.
   v4 loads from GitHub (nook-site repo) instead of being pasted into Showit, and builds its own banner. */
(function () {
  var CONSENT_KEY  = 'nook_consent';
  var CONSENT_DATE = 'nook_consent_date';
  var EXPIRY_DAYS  = 365;
  var GA_IDS = ['AW-11103955582', 'G-DGMBTL7S96'];
  var LINKER = { domains: ['nookonthehill.lodgify.com', 'checkout.lodgify.com'] };
  var gaLoaded = false, metaLoaded = false;

  function isAustralia() {
    try { return /^Australia\//.test(Intl.DateTimeFormat().resolvedOptions().timeZone || ''); } catch (e) { return false; }
  }
  var NOTICE_MODE = isAustralia();
  var IMPLIED = { analytics: true, marketing: true, implied: true };

  function storedConsent() {
    try {
      var raw = localStorage.getItem(CONSENT_KEY);
      if (!raw) return null;
      var saved = JSON.parse(raw);
      var age = (Date.now() - new Date(localStorage.getItem(CONSENT_DATE)).getTime()) / 864e5;
      return age < EXPIRY_DAYS ? saved : null;
    } catch (e) { return null; }
  }
  function getConsent() { return storedConsent() || (NOTICE_MODE ? IMPLIED : null); }
  window.nookConsent = getConsent;

  function saveConsent(prefs) {
    try {
      localStorage.setItem(CONSENT_KEY, JSON.stringify(prefs));
      localStorage.setItem(CONSENT_DATE, new Date().toISOString());
    } catch (e) {}
  }

  function el(id) { return document.getElementById(id); }
  function hideBanner() { var b = el('nook-cookie-banner'); if (b) b.classList.remove('visible'); }
  function hideModal()  { var m = el('nook-cookie-modal');  if (m) m.classList.remove('visible'); }

  // Consent Mode v2: everything denied until the visitor says otherwise. Runs before Google's tag loads.
  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
  window.gtag('consent', 'default', {
    ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied',
    analytics_storage: 'denied', wait_for_update: 500
  });
  window.gtag('set', 'url_passthrough', true);      // keeps ad click info in the page address for this visit only, no cookie
  window.gtag('set', 'ads_data_redaction', true);   // while ad_storage is denied, Google strips ad click IDs from its pings

  function updateGoogleConsent(prefs) {
    var a = prefs && prefs.analytics ? 'granted' : 'denied';
    var m = prefs && prefs.marketing ? 'granted' : 'denied';
    window.gtag('consent', 'update', { analytics_storage: a, ad_storage: m, ad_user_data: m, ad_personalization: m });
  }

  function loadGA() {
    if (gaLoaded) return;
    gaLoaded = true;
    if (document.querySelector('script[src*="googletagmanager.com/gtag/js"]')) {
      // Google's tag is already loaded elsewhere (for example Showit's Google Analytics integration).
      // Don't load it twice: just add Google Ads and the Lodgify cross-domain setting, with no second page view.
      console.warn('Nook: Google tag already on the page elsewhere; adding Google Ads and cross-domain settings only.');
      window.gtag('config', GA_IDS[0], { linker: LINKER });
      window.gtag('config', GA_IDS[1], { linker: LINKER, send_page_view: false });
      window.__nookGaConfigured = true;
      return;
    }
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_IDS[0];
    document.head.appendChild(s);
    window.gtag('js', new Date());
    GA_IDS.forEach(function (id) { window.gtag('config', id, { linker: LINKER }); });
    window.__nookGaConfigured = true;          // lets the ad click ID code wait until Google's tag is set up
  }

  function countChoice(name) { try { window.gtag('event', name, { transport_type: 'beacon' }); } catch (e) {} }

  function loadMeta(marketing) {
    if (!marketing || metaLoaded) return;
    metaLoaded = true;
    if (window.fbq) {
      console.warn('Nook: Meta Pixel already on the page elsewhere, so the cookie banner did not load a second copy.');
      return;
    }
    !function (f, b, e, v, n, t, s) {
      if (f.fbq) return; n = f.fbq = function () { n.callMethod ?
      n.callMethod.apply(n, arguments) : n.queue.push(arguments) };
      if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = '2.0';
      n.queue = []; t = b.createElement(e); t.async = !0;
      t.src = v; s = b.getElementsByTagName(e)[0];
      s.parentNode.insertBefore(t, s);
    }(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
    window.fbq('init', '144319778505490');
    window.fbq('track', 'PageView');
  }

  function applyConsent(prefs) {
    updateGoogleConsent(prefs);
    loadMeta(!!prefs.marketing);
  }

  window.nookAcceptAll = function () {
    var prefs = { analytics: true, marketing: true };
    saveConsent(prefs); applyConsent(prefs); countChoice('nook_consent_accept'); hideBanner(); hideModal();
  };

  window.nookDecline = function () {
    var prefs = { analytics: false, marketing: false };
    saveConsent(prefs); applyConsent(prefs); countChoice('nook_consent_decline'); hideBanner(); hideModal();
  };

  // Notice mode only: "Got it" keeps the defaults and stops the notice showing again for a year.
  window.nookAcknowledge = function () {
    saveConsent(IMPLIED); countChoice('nook_consent_ack'); hideBanner();
  };

  window.nookShowModal = function () {
    var existing = getConsent();
    if (existing) {
      el('nook-pref-analytics').checked = !!existing.analytics;
      el('nook-pref-marketing').checked = !!existing.marketing;
    }
    el('nook-cookie-modal').classList.add('visible');
  };

  window.nookSavePreferences = function () {
    var prefs = { analytics: el('nook-pref-analytics').checked, marketing: el('nook-pref-marketing').checked };
    saveConsent(prefs); applyConsent(prefs); countChoice('nook_consent_custom'); hideBanner(); hideModal();
  };

  function build() {
    if (el('nook-cookie-banner')) return;
    var style = document.createElement('style');
    style.textContent = '__NOOK_CSS__';
    document.head.appendChild(style);
    var wrap = document.createElement('div');
    wrap.innerHTML = '__NOOK_HTML__';
    while (wrap.firstChild) document.body.appendChild(wrap.firstChild);
    var cls = NOTICE_MODE ? 'nook-notice' : 'nook-optin';
    el('nook-cookie-banner').classList.add(cls);
    el('nook-cookie-modal').classList.add(cls);
  }

  // Any link to #cookie-settings (for example in the privacy policy or footer) reopens the choices.
  document.addEventListener('click', function (ev) {
    var a = ev.target && ev.target.closest ? ev.target.closest('a[href$="#cookie-settings"]') : null;
    if (a) { ev.preventDefault(); window.nookShowModal(); }
  });

  function start() {
    build();
    var existing = getConsent();
    if (existing) applyConsent(existing);            // an earlier choice, or the Australian default, before the tag loads
    loadGA();                                         // Google's tag always loads, but only as consent allows
    if (!storedConsent()) { var b = el('nook-cookie-banner'); if (b) { b.classList.add('visible'); countChoice('nook_consent_shown'); } }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
