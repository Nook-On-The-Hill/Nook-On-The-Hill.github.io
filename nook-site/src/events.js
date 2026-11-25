/* Nook website events v1.0 (25 Nov 2026)
   Small Google Analytics events that show what visitors do on the way to booking. Sent only when the visitor
   has allowed analytics cookies. Nothing personal: no names, emails, phone numbers or message text, only which
   button, which kind of enquiry, which section and the dates searched (month, nights, guests, how far ahead).
   - nook_book_click   any Book button: to the book page (nook_stage book_page) or to Lodgify (checkout).
                       Google Analytics stopped counting clicks to Lodgify once the two sites were linked.
   - nook_date_search  the Search button on the book page, with the dates chosen in Lodgify's search bar.
   - nook_enquiry      contact form sent (form), Instagram or Facebook link, email or phone link.
   - nook_signup       newsletter form sent (MailerLite).
   - nook_engage       first use of the gallery slideshow, the YouTube video link, and the key sections read
                       (seen for 2 seconds): what's included, reviews, awards, press, the end of the page. */
(function () {
  var DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  var SECTIONS = { 'what-s-included': 'whats_included', 'testimonial': 'reviews', 'testimonial-1': 'reviews',
                   'awards-and-accreditations': 'awards', 'recommendations': 'press', 'footer-10': 'page_end' };
  var sent = {};

  function allowed() {
    try { var c = window.nookConsent && window.nookConsent(); return !!(c && c.analytics) && typeof window.gtag === 'function'; }
    catch (e) { return false; }
  }
  function send(name, params, once) {
    if (!allowed()) return false;
    if (once) { if (sent[once]) return false; sent[once] = 1; }
    params = params || {};
    params.transport_type = 'beacon';
    try { window.gtag('event', name, params); } catch (e) { return false; }
    return true;
  }
  function clean(v, n) { return String(v || '').replace(/\s+/g, ' ').trim().substring(0, n || 40); }
  function label(a) { return clean(a.innerText || a.getAttribute('aria-label') || a.getAttribute('title') || '', 40) || '(image)'; }
  function url(a) { try { return new URL(a.getAttribute('href'), location.href); } catch (e) { return null; } }

  // Dates from a Lodgify link: ?arrival=YYYY-MM-DD&departure=YYYY-MM-DD&adults=n
  function stay(u) {
    var a = u.searchParams.get('arrival'), d = u.searchParams.get('departure');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(a || '') || !/^\d{4}-\d{2}-\d{2}$/.test(d || '')) return null;
    var A = new Date(a + 'T12:00:00'), D = new Date(d + 'T12:00:00'), today = new Date(); today.setHours(12, 0, 0, 0);
    var nights = Math.round((D - A) / 864e5), ahead = Math.round((A - today) / 864e5);
    if (!(nights > 0 && nights < 60)) return null;
    return { nook_stay_month: a.substring(0, 7), nook_nights: nights, nook_adults: Number(u.searchParams.get('adults')) || 0,
             nook_arrival_day: DAYS[A.getDay()],
             nook_lead: ahead < 0 ? 'past' : ahead <= 7 ? '0-7' : ahead <= 30 ? '8-30' : ahead <= 90 ? '31-90' : '91+' };
  }

  function onClick(ev) {
    var t = ev.target;
    if (!t || !t.closest) return;
    var a = t.closest('a');
    var g = !a && t.closest('.cycle-slide, [class*="sib-gallery"], [class*="sig-gallery"]');
    if (g) return send('nook_engage', { nook_what: 'gallery' }, 'gallery');
    if (!a) return;
    var u = url(a), href = a.getAttribute('href') || '';
    if (/^mailto:/i.test(href)) return send('nook_enquiry', { nook_method: 'email' });
    if (/^tel:/i.test(href)) return send('nook_enquiry', { nook_method: 'phone' });
    if (!u) return;
    var host = u.hostname.replace(/^www\./, '');
    if (/(^|\.)lodgify\.com$/.test(host)) {
      send('nook_book_click', { nook_stage: 'checkout', nook_button: label(a) });
      var s = stay(u);
      if (s) { s.nook_where = 'book_page'; s.nook_result = 'searched'; send('nook_date_search', s); }
      return;
    }
    if (/nookonthehill\.com\.au$/.test(host) && /^\/book\/?$/.test(u.pathname) && !/^\/book\/?$/.test(location.pathname)) {
      return send('nook_book_click', { nook_stage: 'book_page', nook_button: label(a) });
    }
    if (/(^|\.)instagram\.com$/.test(host)) return send('nook_enquiry', { nook_method: 'instagram' });
    if (/(^|\.)facebook\.com$|(^|\.)fb\.me$/.test(host)) return send('nook_enquiry', { nook_method: 'facebook' });
    if (/(^|\.)youtube\.com$|(^|\.)youtu\.be$/.test(host)) return send('nook_engage', { nook_what: 'video' }, 'video');
    // Showit's contact form: a "Submit" link next to the form boxes, sent only once an email address is filled in.
    if (/^\s*submit\s*$/i.test(a.innerText || '') && formHasEmail()) return send('nook_enquiry', { nook_method: 'form' }, 'form');
  }
  function formHasEmail() {
    var boxes = document.querySelectorAll('textarea, input[type="text"], input[type="email"]');
    for (var i = 0; i < boxes.length; i++) {
      var b = boxes[i];
      if (b.closest && b.closest('.ml-block-form, #nook-cookie-modal')) continue;
      if (/e-?mail/i.test(b.placeholder || b.name || '') && /\S+@\S+\.\S+/.test(b.value || '')) return true;
    }
    return false;
  }
  function onSubmit(ev) {
    var f = ev.target;
    if (!f || !f.matches || !f.matches('form.ml-block-form, form[action*="mailerlite"]')) return;
    var e = f.querySelector('input[type="email"], input[name*="email"]');
    if (e && /\S+@\S+\.\S+/.test(e.value || '')) send('nook_signup', {}, 'signup');
  }

  // Sections read: half the section, or half the screen for tall sections, in view for 2 seconds, once per page.
  function watchSections() {
    if (!('IntersectionObserver' in window)) return;
    var timers = {};
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        var id = en.target.id, name = SECTIONS[id];
        var need = Math.min(en.boundingClientRect.height, window.innerHeight || 800) * 0.5;
        if (en.isIntersecting && en.intersectionRect.height >= need) {
          if (!timers[id]) timers[id] = setTimeout(function () { send('nook_engage', { nook_what: 'section', nook_section: name }, 's_' + name); io.unobserve(en.target); }, 2000);
        } else if (timers[id]) { clearTimeout(timers[id]); timers[id] = null; }
      });
    }, { threshold: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.75, 1] });
    Object.keys(SECTIONS).forEach(function (id) { var el = document.getElementById(id); if (el) io.observe(el); });
  }

  document.addEventListener('click', onClick, true);
  document.addEventListener('submit', onSubmit, true);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', watchSections); else watchSections();
  window.__nookEvents = 1;
})();
