/* Nook ad click ID v1.3 (23 Nov 2026, outside review round 2: each click message now says where the ID was read
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
      var old = function (t) { return !t || Date.now() / 1000 - t > MAX_AGE_DAYS * 86400; };
      if (k.g && old(k.g.at)) k.g = null;
      if (k.m && old(Number((String(k.m.fbc).match(/^fb\.\d\.(\d{13})\./) || [])[1]) / 1000)) k.m = null;
      return k.g || k.m ? k : null;
    } catch (e) { return null; }
  }
  function keep(p) {
    try {
      var k = kept() || {};
      if ((p.gclid || p.gbraid || p.wbraid) && p.clickSrc !== 'stored') k.g = { gclid: p.gclid, gbraid: p.gbraid, wbraid: p.wbraid, at: p.clickAt };
      if (p.fbc) k.m = { fbc: p.fbc };
      localStorage.setItem(KEEP, JSON.stringify(k));
    } catch (e) {}
  }

  // v1.2: the beacon.
  var BEACON = 'https://script.google.com/macros/s/AKfycbwzKneqmQGj6vO0p8qVPC8_wzbgkPPORdja6a8-LigkNpP4yIpcj3on9dCoqfOF1hTR_g/exec';
  function param(n) { try { var v = new URLSearchParams(location.search).get(n); return valid(v) ? v : ''; } catch (e) { return ''; } }
  function sess(k, v) { try { if (v) sessionStorage.setItem(k, v); else v = sessionStorage.getItem(k) || ''; } catch (e) {} return v || ''; }
  function cookie(n) { var m = document.cookie.match(new RegExp('(?:^|;\\s*)' + n + '=([^;]+)')); return m ? decodeURIComponent(m[1]) : ''; }
  function gaClientId() { var m = cookie('_ga').match(/^GA\d\.\d\.(\d+\.\d+)$/); return m ? m[1] : ''; }
  function metaClick() {
    var c = cookie('_fbc');
    if (/^fb\.\d\.\d{10,13}\.[A-Za-z0-9_-]{10,250}$/.test(c)) return c;
    var f = param('fbclid'), kept = sess('nook_fbc');
    if (f && kept.slice(-(f.length + 1)) !== '.' + f) kept = sess('nook_fbc', 'fb.1.' + Date.now() + '.' + f);   // Meta's own format, made once
    return kept;
  }
  var beaconSent = '', lastBeacon = 0;
  function sendBeacon(trigger) {
    if (/__NOOK/.test(BEACON) || !adsAllowed()) return false;
    var cid = gaClientId();
    if (!cid) return false;                                   // Google's tag hasn't set its cookie yet
    var ci = clickInfo(), urlBraid = param('gbraid') || param('wbraid');
    var p = { kind: 'click', gaClientId: cid, gclid: ci.id, gbraid: valid(sess('nook_gbraid', param('gbraid'))) ? sess('nook_gbraid') : '',
              wbraid: valid(sess('nook_wbraid', param('wbraid'))) ? sess('nook_wbraid') : '', fbc: metaClick(), fbp: cookie('_fbp'), note: trigger,
              clickSrc: ci.src, clickAt: ci.at };
    if (!p.gclid && (p.gbraid || p.wbraid)) {                // v1.3: gbraid/wbraid: from the URL now, or saved this session
      if (urlBraid) { p.clickSrc = 'url'; p.clickAt = Math.floor(Date.now() / 1000); sess('nook_braid_at', String(p.clickAt)); }
      else { p.clickSrc = 'saved'; p.clickAt = Number(sess('nook_braid_at')) || 0; }
    }
    if (!p.gclid && !p.gbraid && !p.wbraid && !p.fbc) {      // v1.3: nothing on this visit: an earlier ad click kept in browser storage?
      var k = kept();
      if (!k) return true;                                   // not from an ad: nothing to tell
      if (k.g) { p.gclid = k.g.gclid || ''; p.gbraid = k.g.gbraid || ''; p.wbraid = k.g.wbraid || ''; p.clickAt = k.g.at || 0; }
      if (k.m) p.fbc = k.m.fbc;
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
    if (a) mark(a);
    if (a && send('book_click')) sendBeacon('book_click');
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
