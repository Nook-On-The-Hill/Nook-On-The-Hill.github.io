/* Nook On The Hill website scripts. Built from src/ by build.cjs: edit the files in src/, not this one. */
(function () {
  if (window.__nookSite) return;
  if (document.getElementById('nook-cookie-banner')) { console.warn('Nook: old cookie banner code is still pasted in Showit; remove it so only the loader line remains.'); return; }
  window.__nookSite = 5;

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
    style.textContent = ' #nook-cookie-banner { display: none; position: fixed; bottom: 0; left: 0; right: 0; z-index: 99999; background: #F3E4D0; border-top: 1px solid rgba(35,29,25,0.18); padding: 18px 32px; font-family: \'Roboto Slab\', serif; font-weight: 300; box-sizing: border-box; align-items: center; gap: 24px; flex-wrap: wrap; animation: nookSlideUp 0.4s ease; } #nook-cookie-banner.visible { display: flex; } @keyframes nookSlideUp { from { transform: translateY(100%); opacity: 0; } to   { transform: translateY(0);   opacity: 1; } } #nook-cookie-banner p { flex: 1; min-width: 240px; font-size: 12px; color: #38312B; line-height: 1.8; margin: 0; letter-spacing: 0.03em; } #nook-cookie-banner p a { color: #B26E3F; text-decoration: none; border-bottom: 1px solid rgba(178,110,63,0.35); } .nook-cookie-actions { display: flex; align-items: center; gap: 10px; flex-shrink: 0; flex-wrap: wrap; } .nook-cookie-manage { font-family: \'Roboto Slab\', serif; font-weight: 300; font-size: 10px; letter-spacing: 0.2em; text-transform: uppercase; color: #B26E3F; background: none; border: none; padding: 0; cursor: pointer; border-bottom: 1px solid rgba(178,110,63,0.3); white-space: nowrap; } .nook-cookie-decline { font-family: \'Roboto Slab\', serif; font-weight: 300; font-size: 10px; letter-spacing: 0.2em; text-transform: uppercase; color: #38312B; background: transparent; border: 1px solid rgba(35,29,25,0.35); border-radius: 6px; padding: 9px 18px; cursor: pointer; white-space: nowrap; transition: border-color 0.2s; } .nook-cookie-decline:hover { border-color: rgba(35,29,25,0.65); } .nook-cookie-accept { font-family: \'Roboto Slab\', serif; font-weight: 300; font-size: 10px; letter-spacing: 0.2em; text-transform: uppercase; color: #F3E4D0; background: #231D19; border: 1px solid #231D19; border-radius: 6px; padding: 9px 18px; cursor: pointer; white-space: nowrap; transition: opacity 0.2s; } .nook-cookie-accept:hover { opacity: 0.85; } #nook-cookie-modal { display: none; position: fixed; inset: 0; z-index: 100000; background: rgba(35,29,25,0.55); align-items: center; justify-content: center; padding: 20px; box-sizing: border-box; } #nook-cookie-modal.visible { display: flex; } .nook-modal-box { background: #F3E4D0; border-radius: 10px; max-width: 460px; width: 100%; padding: 32px; font-family: \'Roboto Slab\', serif; font-weight: 300; } .nook-modal-box h2 { font-size: 11px; letter-spacing: 0.3em; text-transform: uppercase; color: #38312B; margin: 0 0 16px; font-weight: 300; } .nook-modal-box p { font-size: 12px; color: #58514B; line-height: 1.8; margin: 0 0 24px; } .nook-pref-row { display: flex; justify-content: space-between; align-items: flex-start; padding: 16px 0; border-top: 1px solid rgba(35,29,25,0.1); gap: 16px; } .nook-pref-label { font-size: 11px; letter-spacing: 0.15em; text-transform: uppercase; color: #38312B; margin: 0 0 4px; } .nook-pref-desc { font-size: 11px; color: #58514B; line-height: 1.6; margin: 0; } .nook-toggle { position: relative; flex-shrink: 0; width: 40px; height: 22px; } .nook-toggle input { opacity: 0; width: 0; height: 0; position: absolute; } .nook-toggle-slider { position: absolute; inset: 0; background: rgba(35,29,25,0.2); border-radius: 22px; cursor: pointer; transition: background 0.25s; } .nook-toggle-slider:before { content: \'\'; position: absolute; width: 16px; height: 16px; left: 3px; top: 3px; background: #F3E4D0; border-radius: 50%; transition: transform 0.25s; } .nook-toggle input:checked + .nook-toggle-slider { background: #B26E3F; } .nook-toggle input:checked + .nook-toggle-slider:before { transform: translateX(18px); } .nook-toggle input:disabled + .nook-toggle-slider { opacity: 0.6; cursor: default; } .nook-modal-actions { display: flex; gap: 10px; justify-content: flex-end; margin-top: 24px; flex-wrap: wrap; } @media (max-width: 540px) { #nook-cookie-banner { padding: 16px 20px; } #nook-cookie-banner p { font-size: 11px; } .nook-cookie-actions { width: 100%; justify-content: flex-end; } .nook-modal-box { padding: 24px 20px; } } #nook-cookie-banner.nook-notice .nook-only-optin, #nook-cookie-modal.nook-notice .nook-only-optin { display: none !important; } #nook-cookie-banner.nook-optin .nook-only-notice, #nook-cookie-modal.nook-optin .nook-only-notice { display: none !important; } #nook-cookie-banner { padding-right: 56px; } .nook-cookie-close { position: absolute; top: 6px; right: 10px; width: 40px; height: 40px; font-size: 24px; line-height: 1; color: #38312B; background: none; border: none; cursor: pointer; opacity: 0.6; } .nook-cookie-close:hover { opacity: 1; } ';
    document.head.appendChild(style);
    var wrap = document.createElement('div');
    wrap.innerHTML = '<div id="nook-cookie-banner" role="dialog" aria-label="Cookie preferences"> <p> <span class="nook-only-optin">We want your online experience to be as cosy and inviting as our little house on the hill. We use cookies to make that happen. If that\'s okay with you, click \'Accept All\'. If not, please adjust your preferences.</span> <span class="nook-only-notice">We want your online experience to be as cosy and inviting as our little house on the hill. We use cookies to understand how guests find us and to measure our ads, and they\'re switched on by default here in Australia. If you\'d rather they weren\'t, tap \'Choose\'.</span> <a href="/privacy-policy">Privacy policy</a>. </p> <div class="nook-cookie-actions"> <button class="nook-cookie-manage nook-only-optin" onclick="nookShowModal()">Manage</button> <button class="nook-cookie-decline nook-only-optin" onclick="nookDecline()">Decline</button> <button class="nook-cookie-accept nook-only-optin" onclick="nookAcceptAll()">Accept All</button> <button class="nook-cookie-decline nook-only-notice" onclick="nookShowModal()">Choose</button> <button class="nook-cookie-accept nook-only-notice" onclick="nookAcknowledge()">Got it</button> </div> <button class="nook-cookie-close nook-only-notice" onclick="nookAcknowledge()" aria-label="Close">&times;</button> </div> <div id="nook-cookie-modal" role="dialog" aria-label="Manage cookie preferences"> <div class="nook-modal-box"> <h2>Cookie preferences</h2> <p> <span class="nook-only-optin">Choose which cookies you\'d like to allow. Strictly necessary cookies keep the site running and cannot be turned off.</span> <span class="nook-only-notice">Here in Australia these are on by default. Switch off anything you\'d rather we didn\'t use. Strictly necessary cookies keep the site running and cannot be turned off.</span> </p> <div class="nook-pref-row"> <div> <p class="nook-pref-label">Strictly necessary</p> <p class="nook-pref-desc">Required for the site to function. Always on.</p> </div> <label class="nook-toggle"> <input type="checkbox" checked disabled> <span class="nook-toggle-slider"></span> </label> </div> <div class="nook-pref-row"> <div> <p class="nook-pref-label">Analytics</p> <p class="nook-pref-desc">Google Analytics: helps us understand how guests find and use the site. If you decline, Google receives only anonymous, cookie-free counts.</p> </div> <label class="nook-toggle"> <input type="checkbox" id="nook-pref-analytics" checked> <span class="nook-toggle-slider"></span> </label> </div> <div class="nook-pref-row"> <div> <p class="nook-pref-label">Marketing</p> <p class="nook-pref-desc">Google Ads and Meta Pixel: let us measure our ads and show relevant ads to people who\'ve visited the site.</p> </div> <label class="nook-toggle"> <input type="checkbox" id="nook-pref-marketing" checked> <span class="nook-toggle-slider"></span> </label> </div> <div class="nook-modal-actions"> <button class="nook-cookie-decline nook-only-notice" onclick="nookDecline()">Turn all off</button> <button class="nook-cookie-decline" onclick="nookSavePreferences()">Save preferences</button> <button class="nook-cookie-accept nook-only-optin" onclick="nookAcceptAll()">Accept All</button> <button class="nook-cookie-accept nook-only-notice" onclick="nookAcceptAll()">Keep all on</button> </div> </div> </div> ';
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


/* Nook gift certificate source tracking v1.1 (28 Oct 2026)
   Notes how each visit arrived (Google ad, Meta ad, Instagram, Visit Grampians...). When someone clicks a
   gift certificate (any buy.stripe.com link) it adds that to the Stripe link as client_reference_id, so
   the Data Vault's Gift Vouchers tab can show what sold each voucher ("Bought via").
   No personal details. This visit's source lives in session storage only (gone when the tab closes); the
   "first found via" source is kept longer only if the visitor allowed analytics cookies.
   Also sends a "gift_click" event to Google Analytics, when the visitor has allowed it. */
(function () {
  function clean(v, n) {
    return String(v || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').substring(0, n || 30);
  }
  function host(u) { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return ''; } }
  function arrival() {
    var p = new URLSearchParams(location.search);
    if (p.get('utm_source')) return { s: p.get('utm_source'), m: p.get('utm_medium') || 'none', c: p.get('utm_campaign') || '' };
    if (p.get('gclid') || p.get('gbraid') || p.get('wbraid')) return { s: 'google', m: 'cpc', c: '' };
    var r = host(document.referrer);
    if (!r || /nookonthehill/.test(r) || /lodgify\.com$|stripe\.com$/.test(r)) return null;   // own pages: keep what we had
    if (/(^|\.)google\.|bing\.com$|duckduckgo\.com$|yahoo\.|ecosia\.org$/.test(r)) return { s: /(^|\.)google\./.test(r) ? 'google' : r, m: 'organic', c: '' };
    if (/facebook\.com$|instagram\.com$|fb\.me$/.test(r)) return { s: r, m: 'social', c: '' };
    return { s: r, m: 'referral', c: '' };
  }
  function analyticsAllowed() {
    try { var c = window.nookConsent && window.nookConsent(); return !!(c && c.analytics); } catch (e) { return false; }
  }

  var now = arrival(), visit = null, first = null;
  try {
    if (now) sessionStorage.setItem('nook_src', JSON.stringify(now));
    visit = JSON.parse(sessionStorage.getItem('nook_src') || 'null');
    if (!visit) { visit = { s: 'direct', m: 'none', c: '' }; sessionStorage.setItem('nook_src', JSON.stringify(visit)); }
  } catch (e) { visit = now || { s: 'direct', m: 'none', c: '' }; }
  function firstTouch() {
    if (!analyticsAllowed()) return visit;
    try {
      first = first || JSON.parse(localStorage.getItem('nook_first') || 'null');
      if (!first) { first = { s: visit.s, m: visit.m }; localStorage.setItem('nook_first', JSON.stringify(first)); }
      return first;
    } catch (e) { return visit; }
  }
  firstTouch();

  // nk1__<source>__<medium>__<campaign>__<first source>__<first medium>  (Stripe allows a-z 0-9 - _ , up to 200)
  function ref() {
    var f = firstTouch();
    return ['nk1', clean(visit.s), clean(visit.m), clean(visit.c, 60), clean(f.s), clean(f.m)].join('__');
  }
  function tag(a) {
    try {
      var u = new URL(a.href);
      if (!/(^|\.)buy\.stripe\.com$/.test(u.hostname)) return false;
      u.searchParams.set('client_reference_id', ref());
      a.href = u.toString();
      return true;
    } catch (e) { return false; }
  }
  function onPress(ev) {
    var a = ev.target && ev.target.closest ? ev.target.closest('a[href*="buy.stripe.com"]') : null;
    if (!a || !tag(a) || ev.type !== 'click') return;
    try {
      if (window.gtag && analyticsAllowed()) {
        window.gtag('event', 'gift_click', { link_url: a.href.split('?')[0], nook_source: visit.s + '/' + visit.m, nook_campaign: visit.c || '' });
      }
    } catch (e) {}
  }
  document.addEventListener('pointerdown', onPress, true);
  document.addEventListener('click', onPress, true);
})();


/* Nook ad click ID v1.4 (24 Nov 2026, code review: a Meta click is flagged as paid only when the landing link carries
   our Meta ads' utm_medium=paid_social (Facebook and Instagram add the same fbclid to organic links); the backup click
   message on the way to Lodgify now goes for Meta and gbraid/wbraid visitors too; the gbraid/wbraid click time no longer
   resets when the landing page is reopened; stored click IDs with a time in the future are ignored, and are deleted if
   the visitor turns marketing or analytics cookies off; Meta click IDs up to 500 characters.
   v1.3 (23 Nov 2026, outside review round 2: each click message now says where the ID was read
   (url, cookie, saved = this tab's session storage, stored = browser storage from an earlier visit) and when the ad
   was clicked; consenting visitors' click IDs are also kept in browser storage for up to 90 days, so a return visit
   after Safari has cleared Google's cookie (and the GA client ID) still links to the ad click; links to Lodgify
   carry the cookie choice as nook_c=a1m1 (analytics, marketing) to test whether it reaches the confirmation page.
   v1.2 and earlier: 6 Nov 2026, v1.1 13 Nov 2026: needs Marketing as well as Analytics;
   v1.2 22 Nov 2026: also tells the Nook Beacon (a tiny Apps Script web app that writes to the Data Vault)
   which ad click IDs this browser arrived with: gclid, gbraid, wbraid (Google), fbc and fbp (Meta), with the
   Google Analytics client ID. The Lodgify confirmation page sends the same client ID with the booking, so
   NookOS can join a booking to its ad click exactly instead of guessing by time. Same consent rule; no names,
   emails or phone numbers; gbraid, wbraid and the Meta click are kept in session storage only.)
   When a visitor arrives from a Google ad, Google adds a click ID (gclid) to the link. Lodgify's
   checkout can't carry it through to the booking, so this sends it to Google Analytics as a
   "nook_click_id" event: once on each page they view, and again when they click through to Lodgify.
   The Data Vault then matches it to the booking by time (only bookings already credited to Google
   Ads, and only when exactly one click ID is near the booking) and sends it to Google Ads, so the
   ads can learn which clicks became bookings.
   Only runs if the visitor allowed BOTH analytics and marketing cookies (uses window.nookConsent
   from the cookie consent code), because the click ID is used for advertising. The click ID is not personal information. It is kept in session storage only
   (gone when the tab closes), or read from Google's own _gcl_aw cookie, which Google sets only
   with consent.
   Paste below the gift certificate source tracking code, in the same place. */
(function () {
  var MAX_AGE_DAYS = 90;                                    // Google only accepts click IDs up to 90 days old
  function valid(id) { return /^[A-Za-z0-9_-]{10,200}$/.test(String(id || '')); }
  function validFb(id) { return /^[A-Za-z0-9_-]{10,500}$/.test(String(id || '')); }   // v1.4: newer fbclids run long
  function adsAllowed() {
    try { var c = window.nookConsent && window.nookConsent(); return !!(c && c.analytics && c.marketing); } catch (e) { return false; }
  }
  function fromUrl() {
    try { var id = new URLSearchParams(location.search).get('gclid'); return valid(id) ? id : ''; } catch (e) { return ''; }
  }
  function fromCookie() {
    // Google's conversion linker cookie: _gcl_aw=GCL.<seconds>.<gclid>
    var m = document.cookie.match(/(?:^|;\s*)_gcl_aw=GCL\.(\d+)\.([^;]+)/);
    if (!m || !valid(m[2])) return '';
    var ageDays = (Date.now() / 1000 - Number(m[1])) / 86400;
    return ageDays >= 0 && ageDays <= MAX_AGE_DAYS ? m[2] : '';
  }
  function clickId() { return clickInfo().id; }
  // v1.3: the gclid with where it came from and when the ad was clicked (Unix seconds).
  function clickInfo() {
    var id = fromUrl(), src = 'url', at = Math.floor(Date.now() / 1000);
    try {
      if (id) {
        if (sessionStorage.getItem('nook_gclid') === id) at = Number(sessionStorage.getItem('nook_gclid_at')) || at;   // same click, page reloaded
        else { sessionStorage.setItem('nook_gclid', id); sessionStorage.setItem('nook_gclid_at', String(at)); }
      }
      else { id = sessionStorage.getItem('nook_gclid') || ''; src = 'saved'; at = Number(sessionStorage.getItem('nook_gclid_at')) || 0; }
    } catch (e) {}
    if (valid(id)) return { id: id, src: src, at: at };
    var m = document.cookie.match(/(?:^|;\s*)_gcl_aw=GCL\.(\d+)\.([^;]+)/);
    if (fromCookie()) return { id: m[2], src: 'cookie', at: Number(m[1]) };
    return { id: '', src: '', at: 0 };
  }

  // v1.3: browser storage copy (consenting visitors only, 90 days). {g: {gclid, gbraid, wbraid, at}, m: {fbc}}
  var KEEP = 'nook_click';
  function kept() {
    try {
      var k = JSON.parse(localStorage.getItem(KEEP) || 'null');
      if (!k || !k.g && !k.m) return null;
      var old = function (t) { var age = Date.now() / 1000 - t; return !t || age > MAX_AGE_DAYS * 86400 || age < -600; };   // v1.4: not from the future either
      if (k.g && old(k.g.at)) k.g = null;
      if (k.m && old(Number((String(k.m.fbc).match(/^fb\.\d\.(\d{13})\./) || [])[1]) / 1000)) k.m = null;
      return k.g || k.m ? k : null;
    } catch (e) { return null; }
  }
  function keep(p) {
    try {
      var k = kept() || {};
      if ((p.gclid || p.gbraid || p.wbraid) && p.clickSrc !== 'stored') k.g = { gclid: p.gclid, gbraid: p.gbraid, wbraid: p.wbraid, at: p.clickAt };
      if (p.fbc && p.clickSrc !== 'stored') k.m = { fbc: p.fbc, pid: p.metaPaid ? fbclidOf(p.fbc) : (k.m && k.m.fbc === p.fbc ? k.m.pid || '' : '') };
      localStorage.setItem(KEEP, JSON.stringify(k));
    } catch (e) {}
  }
  // v1.4: the visitor turned marketing or analytics cookies off: forget the stored click IDs.
  function forgetIfWithdrawn() {
    try { var c = window.nookConsent && window.nookConsent(); if (c && (!c.marketing || !c.analytics)) localStorage.removeItem(KEEP); } catch (e) {}
  }

  // v1.2: the beacon.
  var BEACON = 'https://script.google.com/macros/s/AKfycbwzKneqmQGj6vO0p8qVPC8_wzbgkPPORdja6a8-LigkNpP4yIpcj3on9dCoqfOF1hTR_g/exec';
  function param(n) { try { var v = new URLSearchParams(location.search).get(n); return valid(v) ? v : ''; } catch (e) { return ''; } }
  function sess(k, v) { try { if (v) sessionStorage.setItem(k, v); else v = sessionStorage.getItem(k) || ''; } catch (e) {} return v || ''; }
  function cookie(n) { var m = document.cookie.match(new RegExp('(?:^|;\\s*)' + n + '=([^;]+)')); return m ? decodeURIComponent(m[1]) : ''; }
  function gaClientId() { var m = cookie('_ga').match(/^GA\d\.\d\.(\d+\.\d+)$/); return m ? m[1] : ''; }
  function fbclidOf(fbc) { var m = String(fbc || '').match(/^fb\.\d\.\d{10,13}\.([A-Za-z0-9_-]{10,500})$/); return m ? m[1] : ''; }
  function metaClick() {
    var c = cookie('_fbc'), f = '';
    try { f = new URLSearchParams(location.search).get('fbclid') || ''; } catch (e) {}
    if (!validFb(f)) f = '';
    if (f) {                                                    // v1.4: this visit's click wins over an older cookie
      try { var um = new URLSearchParams(location.search).get('utm_medium') || ''; if (um === 'paid_social') sess('nook_meta_paid', f); } catch (e) {}
      if (fbclidOf(c) === f) return c;
      var made = sess('nook_fbc');
      if (fbclidOf(made) !== f) made = sess('nook_fbc', 'fb.1.' + Date.now() + '.' + f);   // Meta's own format, made once
      return made;
    }
    if (fbclidOf(c)) return c;
    return sess('nook_fbc');
  }
  // v1.4: was this Meta click one of our ads? (utm_medium=paid_social on the landing link, this tab or remembered)
  function metaPaid(fbc) {
    var id = fbclidOf(fbc); if (!id) return false;
    if (sess('nook_meta_paid') === id) return true;
    var k = kept(); return !!(k && k.m && k.m.pid && k.m.pid === id);
  }
  var beaconSent = '', lastBeacon = 0;
  function sendBeacon(trigger) {
    if (/__NOOK/.test(BEACON) || !adsAllowed()) { forgetIfWithdrawn(); return false; }
    var cid = gaClientId();
    if (!cid) return false;                                   // Google's tag hasn't set its cookie yet
    var ci = clickInfo(), urlBraid = param('gbraid') || param('wbraid');
    var p = { kind: 'click', gaClientId: cid, gclid: ci.id, gbraid: valid(sess('nook_gbraid', param('gbraid'))) ? sess('nook_gbraid') : '',
              wbraid: valid(sess('nook_wbraid', param('wbraid'))) ? sess('nook_wbraid') : '', fbc: metaClick(), fbp: cookie('_fbp'), note: trigger,
              clickSrc: ci.src, clickAt: ci.at };
    if (!p.gclid && (p.gbraid || p.wbraid)) {                // v1.3: gbraid/wbraid: from the URL now, or saved this session
      if (urlBraid && urlBraid !== sess('nook_braid_id')) { p.clickSrc = 'url'; p.clickAt = Math.floor(Date.now() / 1000); sess('nook_braid_id', urlBraid); sess('nook_braid_at', String(p.clickAt)); }
      else { p.clickSrc = urlBraid ? 'url' : 'saved'; p.clickAt = Number(sess('nook_braid_at')) || 0; }   // v1.4: same braid reopened keeps its time
    }
    if (p.fbc) p.metaPaid = metaPaid(p.fbc);                   // v1.4
    if (!p.gclid && !p.gbraid && !p.wbraid && !p.fbc) {      // v1.3: nothing on this visit: an earlier ad click kept in browser storage?
      var k = kept();
      if (!k) return true;                                   // not from an ad: nothing to tell
      if (k.g) { p.gclid = k.g.gclid || ''; p.gbraid = k.g.gbraid || ''; p.wbraid = k.g.wbraid || ''; p.clickAt = k.g.at || 0; }
      if (k.m) { p.fbc = k.m.fbc; p.metaPaid = !!(k.m.pid && fbclidOf(k.m.fbc) === k.m.pid); }
      p.clickSrc = 'stored';
    } else keep(p);
    if (!p.clickAt) delete p.clickAt;
    var key = [p.gclid, p.gbraid, p.wbraid, p.fbc].join('|');
    if (trigger === 'page' && (key === beaconSent || sess('nook_beacon_key') === key)) return true;   // once per set of IDs
    if (trigger === 'book_click' && Date.now() - lastBeacon < 30000) return true;                       // one per click burst
    try {
      var s = JSON.stringify(p);
      if (navigator.sendBeacon) navigator.sendBeacon(BEACON, new Blob([s], { type: 'text/plain' }));
      beaconSent = key; sess('nook_beacon_key', key); if (trigger === 'book_click') lastBeacon = Date.now();
    } catch (e) {}
    return true;
  }

  var lastSent = 0;
  function send(trigger) {
    if (!window.__nookGaConfigured) return false;   // wait until the consent code has set up Google's tag
    if (!adsAllowed()) return false;               // check first: nothing is read, stored or sent without both choices
    var id = clickId();
    if (!id || !window.gtag) return false;
    if (trigger === 'book_click' && Date.now() - lastSent < 30000) return true;   // one per click burst
    try {
      window.gtag('event', 'nook_click_id', { nook_gclid: id, nook_trigger: trigger, transport_type: 'beacon' });
      lastSent = Date.now();
    } catch (e) {}
    return true;
  }

  // Once per page, as soon as Google's tag is loaded (the consent code loads it after the visitor agrees).
  var tries = 0;
  var gaDone = false, beaconDone = false;
  (function waitForTag() {
    if (!gaDone) gaDone = send('page');
    if (!beaconDone) beaconDone = sendBeacon('page');
    if ((gaDone && beaconDone) || ++tries > 40) return;     // up to about 20 seconds
    setTimeout(waitForTag, 500);
  })();

  // Again when they head to Lodgify to book.
  function onPress(ev) {
    var a = ev.target && ev.target.closest ? ev.target.closest('a[href*="lodgify.com"]') : null;
    if (!a) return;
    mark(a);
    send('book_click');                                       // Google Analytics event (gclid visitors only)
    sendBeacon('book_click');                                 // v1.4: the beacon backup for every ad visitor (its own 30 s guard)
  }
  // v1.3: the cookie choice on the link (no IDs, nothing personal), to test whether Lodgify carries it through.
  function mark(a) {
    try {
      var c = window.nookConsent && window.nookConsent(); if (!c) return;
      var u = new URL(a.href, location.href);
      u.searchParams.set('nook_c', 'a' + (c.analytics ? 1 : 0) + 'm' + (c.marketing ? 1 : 0));
      a.href = u.toString();
    } catch (e) {}
  }
  document.addEventListener('pointerdown', onPress, true);
  document.addEventListener('click', onPress, true);
})();

})();
