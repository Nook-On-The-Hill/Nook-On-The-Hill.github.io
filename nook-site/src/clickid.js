/* Nook ad click ID v1.1 (6 Nov 2026, v1.1 13 Nov 2026: needs Marketing as well as Analytics)
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
  function clickId() {
    var id = fromUrl();
    try {
      if (id) sessionStorage.setItem('nook_gclid', id);
      else id = sessionStorage.getItem('nook_gclid') || '';
    } catch (e) {}
    return valid(id) ? id : fromCookie();
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
  (function waitForTag() {
    if (send('page') || ++tries > 40) return;               // up to about 20 seconds
    setTimeout(waitForTag, 500);
  })();

  // Again when they head to Lodgify to book.
  function onPress(ev) {
    var a = ev.target && ev.target.closest ? ev.target.closest('a[href*="lodgify.com"]') : null;
    if (a) send('book_click');
  }
  document.addEventListener('pointerdown', onPress, true);
  document.addEventListener('click', onPress, true);
})();
