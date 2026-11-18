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
