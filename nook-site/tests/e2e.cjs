// End-to-end test of dist/nook-site.js in real Chromium with Google/Meta stubbed. Run: node tests/e2e.cjs
const { chromium } = require('playwright'); const fs = require('fs'), path = require('path');
const bundle = fs.readFileSync(path.join(__dirname, '..', 'dist', 'nook-site.js'), 'utf8').replace('__NOOK_BEACON_ID__', 'TESTBEACON');
const PAGE = extra => `<!doctype html><html><body>${extra || ''}<a id="gift" href="https://buy.stripe.com/abc" onclick="return false">Gift</a><a id="cs" href="/privacy-policy#cookie-settings">Cookie settings</a><a id="book" href="https://nookonthehill.lodgify.com/x" onclick="return false">Book</a><script src="https://cdn.jsdelivr.net/gh/x/nook-site.js"></script></body></html>`;
const results = []; const test = (n, ok, info) => { results.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + n + (ok ? '' : '  ' + (info || ''))); };

async function visit(browser, tz, { url = 'http://nook.test/', storage, html, after, cookies } = {}) {
  const ctx = await browser.newContext({ timezoneId: tz }); const page = await ctx.newPage(); const hits = [], beacons = [];
  if (cookies) await page.addInitScript(c => { c.forEach(x => { document.cookie = x + '; path=/'; }); }, cookies);
  await page.route('**/*', r => {
    const u = r.request().url(); hits.push(u);
    if (/script\.google\.com/.test(u)) { beacons.push(r.request().postData() || ''); return r.fulfill({ contentType: 'text/plain', body: 'ok' }); }
    if (u.startsWith('http://nook.test/')) return r.fulfill({ contentType: 'text/html', body: PAGE(html) });
    if (/jsdelivr/.test(u)) return r.fulfill({ contentType: 'application/javascript', body: bundle });
    return r.fulfill({ contentType: 'application/javascript', body: '' });
  });
  if (storage) await page.addInitScript(s => { for (const k in s) localStorage.setItem(k, s[k]); }, storage);
  await page.goto(url); await page.waitForTimeout(300);
  if (after) await after(page);
  const state = async () => ({
    banner: await page.evaluate(() => !!document.querySelector('#nook-cookie-banner.visible')),
    mode: await page.evaluate(() => (document.getElementById('nook-cookie-banner') || {}).className || ''),
    dl: await page.evaluate(() => Array.from(window.dataLayer || []).map(a => Array.from(a).map(x => (x && typeof x === 'object' && !(x instanceof Date)) ? JSON.stringify(x) : String(x)).join(' '))),
    meta: hits.some(u => /fbevents/.test(u)), gtag: hits.some(u => /googletagmanager/.test(u)), consent: await page.evaluate(() => window.nookConsent && JSON.stringify(window.nookConsent())), page, ctx, hits, beacons
  });
  return state();
}
const upd = s => s.dl.filter(l => /^consent update/.test(l)).pop() || '';
const vis = (page, sel) => page.evaluate(sel => { const e = document.querySelector(sel); return !!e && getComputedStyle(e).display !== 'none'; }, sel);

(async () => {
  const browser = await chromium.launch();
  // 1. Australia, first visit
  let s = await visit(browser, 'Australia/Melbourne');
  test('AU first visit: notice shown with Got it/Choose, not Accept All', s.banner && /nook-notice/.test(s.mode) && await vis(s.page, '.nook-cookie-accept.nook-only-notice') && !await vis(s.page, '.nook-cookie-accept.nook-only-optin'));
  test('AU first visit: Google granted straight away, Meta pixel and gtag load', /granted/.test(upd(s)) && !/denied/.test(upd(s)) && s.meta && s.gtag, upd(s));
  test('AU first visit: nookConsent says implied yes', /"implied":true/.test(s.consent) && /"marketing":true/.test(s.consent), s.consent);
  test('AU first visit: shown event counted', s.dl.some(l => /nook_consent_shown/.test(l)));
  // 2. Got it, then reload
  await s.page.click('.nook-cookie-accept.nook-only-notice'); await s.page.waitForTimeout(100);
  test('AU Got it: hides notice, counts nook_consent_ack', !await vis(s.page, '#nook-cookie-banner.visible') && (await s.page.evaluate(() => Array.from(window.dataLayer).map(a => Array.from(a).join(' ')))).some(l => /nook_consent_ack/.test(l)));
  const kept = await s.page.evaluate(() => ({ k: localStorage.getItem('nook_consent'), d: localStorage.getItem('nook_consent_date') })); await s.ctx.close();
  s = await visit(browser, 'Australia/Melbourne', { storage: { nook_consent: kept.k, nook_consent_date: kept.d } });
  test('AU returning after Got it: no notice, tracking still on', !s.banner && /granted/.test(upd(s)) && s.meta);
  await s.ctx.close();
  // 2b. The X closes the Australian notice like Got it, and Europe has no X
  s = await visit(browser, 'Australia/Melbourne');
  test('AU: X is visible and closes the notice like Got it (tracking stays on, stored, not shown again)', await vis(s.page, '.nook-cookie-close') && (await s.page.click('.nook-cookie-close'), await s.page.waitForTimeout(100), !await vis(s.page, '#nook-cookie-banner.visible')) && /"implied":true/.test(await s.page.evaluate(() => localStorage.getItem('nook_consent'))) && (await s.page.evaluate(() => Array.from(window.dataLayer).map(a => Array.from(a).join(' ')))).some(l => /nook_consent_ack/.test(l)));
  await s.ctx.close();
  s = await visit(browser, 'Europe/London');
  test('Europe: no X, banner stays until they choose', !await vis(s.page, '.nook-cookie-close') && s.banner);
  await s.ctx.close();
  // 3. Australia, Choose then Turn all off
  s = await visit(browser, 'Australia/Sydney', { after: async p => { await p.click('.nook-cookie-decline.nook-only-notice'); await p.waitForTimeout(100); } });
  test('AU Choose opens modal with notice wording and Turn all off', await vis(s.page, '#nook-cookie-modal.visible') && await vis(s.page, '#nook-cookie-modal .nook-modal-actions .nook-only-notice') && !await vis(s.page, '#nook-cookie-modal .nook-modal-actions .nook-cookie-accept.nook-only-optin'));
  await s.page.click('#nook-cookie-modal .nook-modal-actions .nook-cookie-decline.nook-only-notice'); await s.page.waitForTimeout(100);
  const dl = (await s.page.evaluate(() => Array.from(window.dataLayer).map(a => Array.from(a).map(x => typeof x === 'object' ? JSON.stringify(x) : x).join(' '))));
  test('AU Turn all off: Google updated to denied, banner and modal closed, choice stored', /denied/.test(dl.filter(l => /^consent update/.test(l)).pop()) && !await vis(s.page, '#nook-cookie-modal.visible') && /"analytics":false/.test(await s.page.evaluate(() => localStorage.getItem('nook_consent'))));
  const off = await s.page.evaluate(() => ({ k: localStorage.getItem('nook_consent'), d: localStorage.getItem('nook_consent_date') })); await s.ctx.close();
  s = await visit(browser, 'Australia/Perth', { storage: { nook_consent: off.k, nook_consent_date: off.d } });
  test('AU returning after opt-out: stays off, no Meta pixel, no notice', !s.banner && /denied/.test(upd(s)) && !/granted/.test(upd(s)) && !s.meta && /"analytics":false/.test(s.consent));
  await s.ctx.close();
  // 4. Europe and unknown regions keep opt-in
  for (const tz of ['Europe/London', 'Europe/Berlin', 'America/New_York', 'UTC']) {
    s = await visit(browser, tz);
    test(tz + ': opt-in banner, nothing on until they agree', s.banner && /nook-optin/.test(s.mode) && await vis(s.page, '.nook-cookie-accept.nook-only-optin') && !await vis(s.page, '.nook-cookie-accept.nook-only-notice') && !/granted/.test(upd(s)) && !s.meta && s.consent === 'null', upd(s) + ' ' + s.consent);
    if (tz === 'Europe/London') {
      await s.page.click('.nook-cookie-accept.nook-only-optin'); await s.page.waitForTimeout(300);
      const l2 = await s.page.evaluate(() => Array.from(window.dataLayer).map(a => Array.from(a).map(x => typeof x === 'object' ? JSON.stringify(x) : x).join(' ')));
      test('Europe Accept All: Google granted and Meta pixel loads', /granted/.test(l2.filter(l => /^consent update/.test(l)).pop()) && s.hits.some(u => /fbevents/.test(u)) || (await s.page.evaluate(() => !!window.fbq)));
    }
    await s.ctx.close();
  }
  // 4b. Cookie settings link reopens the choices after the notice is gone
  s = await visit(browser, 'Australia/Melbourne', { after: async p => { await p.click('.nook-cookie-accept.nook-only-notice'); await p.click('#cs'); await p.waitForTimeout(100); } });
  test('A #cookie-settings link reopens the modal after the notice is dismissed', await vis(s.page, '#nook-cookie-modal.visible') && !s.hits.some(u => /#cookie-settings/.test(u)));
  await s.ctx.close();
  // 5. Earlier v3 choices are respected in Australia
  s = await visit(browser, 'Australia/Melbourne', { storage: { nook_consent: '{"analytics":true,"marketing":false}', nook_consent_date: new Date().toISOString() } });
  test('AU visitor who earlier chose analytics only: respected (no Meta, Google ad storage denied)', !s.banner && /analytics_storage":"granted"/.test(upd(s)) && /ad_storage":"denied"/.test(upd(s)) && !s.meta, upd(s));
  await s.ctx.close();
  // 6. Expired choice (over a year) shows the notice again
  s = await visit(browser, 'Australia/Melbourne', { storage: { nook_consent: '{"analytics":false,"marketing":false}', nook_consent_date: new Date(Date.now() - 400 * 864e5).toISOString() } });
  test('Choice older than a year expires: notice shows and defaults apply again', s.banner && /granted/.test(upd(s)));
  await s.ctx.close();
  // 7. Old banner still pasted: bundle stands down
  s = await visit(browser, 'Australia/Melbourne', { html: '<div id="nook-cookie-banner"></div>' });
  test('Old v3 markup present: bundle does nothing (no double banner, no tags)', !s.gtag && !s.meta && s.dl.length === 0, JSON.stringify(s.dl));
  await s.ctx.close();
  // 8. Gift link tagging and click ID event in Australia
  s = await visit(browser, 'Australia/Melbourne', { url: 'http://nook.test/?gclid=Cj0KCQiAabcdefghijk&utm_source=x' });
  await s.page.waitForFunction(() => Array.from(window.dataLayer || []).some(a => a[1] === 'nook_click_id'), null, { timeout: 5000 });
  await s.page.click('#gift'); const href = await s.page.getAttribute('#gift', 'href'); await s.page.click('#book'); await s.page.waitForTimeout(100);
  const dl3 = await s.page.evaluate(() => Array.from(window.dataLayer).map(a => Array.from(a).map(x => typeof x === 'object' ? JSON.stringify(x) : x).join(' ')));
  test('Gift link gets client_reference_id', /client_reference_id=nk1__/.test(href), href);
  test('Ad click ID sent to GA4 in Australia by default (page view)', dl3.some(l => /nook_click_id/.test(l) && /Cj0KCQiAabcdefghijk/.test(l) && /page/.test(l)), JSON.stringify(dl3));
  const ci = dl3.findIndex(l => /nook_click_id/.test(l)), cf = dl3.findIndex(l => /^config G-/.test(l));
  test('Click ID event is sent only after Google tag is configured', ci > cf && cf > -1, ci + ' ' + cf);
  test('Gift click event sent (analytics on)', dl3.some(l => /gift_click/.test(l)));
  await s.ctx.close();
  // 9. Europe, declined: click ID NOT sent
  s = await visit(browser, 'Europe/Paris', { url: 'http://nook.test/?gclid=Cj0KCQiAabcdefghijk', after: async p => { await p.click('.nook-cookie-decline.nook-only-optin'); await p.waitForTimeout(300); } });
  const dl4 = await s.page.evaluate(() => Array.from(window.dataLayer).map(a => Array.from(a).map(x => typeof x === 'object' ? JSON.stringify(x) : x).join(' ')));
  test('Europe declined: no click ID event, no gift event', !dl4.some(l => /nook_click_id|gift_click/.test(l)));
  await s.ctx.close();
  // 9b. v1.2 beacon: Australia (notice, tracking on) with a GA cookie and Google and Meta click IDs
  s = await visit(browser, 'Australia/Melbourne', { url: 'http://nook.test/?gclid=Cj0KCQiAabcdefghijk&fbclid=IwAR0abcdefghijklmn&gbraid=GBRAIDabcdefghij', cookies: ['_ga=GA1.1.387258230.1795229525', '_fbp=fb.1.1795229525123.555666777'] });
  await s.page.waitForTimeout(700);
  let bc = s.beacons.map(b => { try { return JSON.parse(b); } catch (e) { return {}; } });
  test('Beacon: sent once on the page with GA client ID, gclid, gbraid, Meta click (fb.1. format) and fbp', bc.length === 1 && bc[0].kind === 'click' && bc[0].gaClientId === '387258230.1795229525' && bc[0].gclid === 'Cj0KCQiAabcdefghijk' && bc[0].gbraid === 'GBRAIDabcdefghij' && /^fb\.1\.\d+\.IwAR0abcdefghijklmn$/.test(bc[0].fbc) && /^fb\.1\./.test(bc[0].fbp), JSON.stringify(s.beacons));
  await s.page.click('#book'); await s.page.waitForTimeout(200);
  test('Beacon: sent again when they click through to Lodgify', s.beacons.length === 2, JSON.stringify(s.beacons));
  await s.ctx.close();
  s = await visit(browser, 'Australia/Melbourne', { url: 'http://nook.test/?utm_source=x', cookies: ['_ga=GA1.1.387258230.1795229525'] });
  await s.page.waitForTimeout(500);
  test('Beacon: nothing sent for a visitor who did not come from an ad', s.beacons.length === 0, JSON.stringify(s.beacons));
  await s.ctx.close();
  s = await visit(browser, 'Europe/Paris', { url: 'http://nook.test/?gclid=Cj0KCQiAabcdefghijk', cookies: ['_ga=GA1.1.387258230.1795229525'], after: async p => { await p.click('.nook-cookie-decline.nook-only-optin'); await p.waitForTimeout(400); } });
  test('Beacon: Europe declined, nothing sent', s.beacons.length === 0, JSON.stringify(s.beacons));
  await s.ctx.close();
  // 10. Phone width: banner fits
  const ctx = await browser.newContext({ timezoneId: 'Australia/Melbourne', viewport: { width: 375, height: 700 } }); const pg = await ctx.newPage();
  await pg.route('**/*', r => { const u = r.request().url(); r.fulfill(u.startsWith('http://nook.test/') ? { contentType: 'text/html', body: PAGE() } : /jsdelivr/.test(u) ? { contentType: 'application/javascript', body: bundle } : { contentType: 'application/javascript', body: '' }); });
  await pg.goto('http://nook.test/'); await pg.waitForTimeout(600);
  test('Phone width: no horizontal scroll', await pg.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  await pg.screenshot({ path: process.env.NOOK_SHOT || '/tmp/nook-phone.png' }); await ctx.close();
  await browser.close();
  const bad = results.filter(x => !x).length; console.log(bad ? bad + ' FAILED' : 'All ' + results.length + ' passed'); process.exit(bad ? 1 : 0);
})();
