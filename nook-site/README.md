# Nook website scripts

The cookie notice and tracking code for nookonthehill.com.au. Showit holds one line that loads `dist/nook-site.js` from here via jsDelivr:

    <script src="https://cdn.jsdelivr.net/gh/Nook-On-The-Hill/Nook-On-The-Hill.github.io@main/nook-site/dist/nook-site.js" async></script>

- `src/consent.js`: cookie notice and Google Consent Mode. Australian visitors (browser timezone Australia/*) get a notice with tracking on and a way to opt out; everyone else gets the opt-in banner.
- `src/gift.js`: gift certificate source tracking. `src/clickid.js`: ad click ID to GA4.
- `src/events.js`: website events for visitors who allow analytics: Book clicks (nook_book_click), dates searched (nook_date_search), enquiries (nook_enquiry), newsletter sign-ups (nook_signup), gallery, video link and key sections read (nook_engage). Nothing personal.
- `src/banner.css`, `src/banner.html`: the banner's look and wording.
- Edit `src/`, run `node build.cjs`, run `npm test`. On push to main, a GitHub Action tests the code and refreshes jsDelivr's cache (live within minutes).
- Roll back by reverting the commit. Public on purpose (jsDelivr needs that); nothing secret belongs here.
