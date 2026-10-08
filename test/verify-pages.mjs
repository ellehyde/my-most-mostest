/* Verification for the three standalone pages: /events/, /about/, /privacy/.
   Run against _site/ after a build. See test/verify-home.mjs for the home page. */
process.env.TZ = 'America/Los_Angeles';
import fs from 'node:fs';
import path from 'node:path';
import { JSDOM } from 'jsdom';

const SITE = path.resolve('_site');
const read = (p) => fs.readFileSync(path.join(SITE, p), 'utf8');
let pass = 0, fail = 0;
const ok = (n, c, e) => { c ? (pass++, console.log('  PASS  ' + n)) : (fail++, console.log('  FAIL  ' + n + (e ? '  -> ' + e : ''))); };

function load(file, url, { runJs = false, now = null } = {}) {
  const dom = new JSDOM(read(file), {
    runScripts: runJs ? 'dangerously' : undefined,
    url,
    beforeParse(w) {
      w.fetch = (...a) => { (w.__fetches ||= []).push(a); return Promise.resolve({ ok: true, json: () => Promise.resolve({}) }); };
      if (now) {
        const R = w.Date, T = new R(now).getTime();
        class F extends R { constructor(...a) { return a.length ? super(...a) : super(T); } static now() { return T; } }
        w.Date = F;
      }
    },
  });
  return dom.window;
}

// ---------------------------------------------------------------- /events/
console.log('\n--- /events/ ---');
{
  const w = load('events/index.html', 'https://mymostmostest.com/events/', {
    runJs: true, now: '2026-09-08T10:00:00-07:00',
  });
  const d = w.document;
  w.eval(fs.readFileSync(path.join(SITE, 'js/events.js'), 'utf8'));

  const up = [...d.querySelectorAll('#upcomingList > li')];
  const prev = [...d.querySelectorAll('#previousList > li')];
  ok('one upcoming event', up.length === 1, 'got ' + up.length);
  ok('three previous events', prev.length === 3, 'got ' + prev.length);
  ok('upcoming renders as a card', up[0] && up[0].className === 'event');
  ok('previous render as compact rows', prev.every((li) => li.className === 'past-row'));
  ok('date reads "Saturday, September 19, 2026 · 11:00 am"',
     up[0] && up[0].querySelector('.when').textContent.trim() === 'Saturday, September 19, 2026 · 11:00 am',
     up[0] && up[0].querySelector('.when').textContent.trim());
  ok('past rows use dateText override',
     prev[0].querySelector('.pwhen').textContent.trim() === 'August 2026',
     prev[0].querySelector('.pwhen').textContent.trim());
  const venues = prev.map((li) => li.querySelector('.pvenue').textContent.trim());
  ok('same-day order preserved via `order`',
     venues[0].startsWith('Eagle Harbor') && venues[1].startsWith('Saltwater') && venues[2].startsWith('Kingston Public'),
     venues.join(' | '));
  ok('past rows still link the venue', prev.every((li) => !!li.querySelector('.pvenue a')));

  const cta = up[0].querySelector('a.cta');
  ok('cta carries data-ga-skip (venue link, not a sale)', cta.hasAttribute('data-ga-skip'));
  ok('cta carries data-event-title', cta.getAttribute('data-event-title') === 'storytime reading & signing');
  ok('cta href is the B&N store page', cta.getAttribute('href') === 'https://stores.barnesandnoble.com/store/2281');

  // analytics: event_link_click fires, retailer_click does not
  const calls = []; w.gtag = (...a) => calls.push(a);
  w.eval(fs.readFileSync(path.join(SITE, 'js/analytics.js'), 'utf8'));
  cta.dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true }));
  const names = calls.filter((c) => c[0] === 'event').map((c) => c[1]);
  ok('fires event_link_click', names.includes('event_link_click'), JSON.stringify(names));
  ok('does NOT fire retailer_click', !names.includes('retailer_click'), JSON.stringify(names));
  // control: a real retailer link must still fire, proving the listener is live
  calls.length = 0;
  d.getElementById('navCta').dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true }));
  ok('control: nav Amazon CTA still fires retailer_click',
     calls.some((c) => c[1] === 'retailer_click'), JSON.stringify(calls.map((c) => c[1])));

  // request-a-reading form
  const form = d.getElementById('reqForm');
  form.reportValidity = () => true;
  ['name', 'email', 'organization', 'city'].forEach((n) => { form.elements[n].value = 'x'; });
  calls.length = 0; w.__fetches = [];
  form.dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
  const rf = (w.__fetches || [])[0];
  ok('request POSTs to FormSubmit', !!rf && String(rf[0]).includes('formsubmit.co'));
  ok('request _subject exact', rf && JSON.parse(rf[1].body)._subject === 'reading request from mymostmostest.com',
     rf ? JSON.parse(rf[1].body)._subject : '');
  ok('fires reading_request', calls.some((c) => c[1] === 'reading_request' && c[2].location === 'events'));
  ok('swaps to thanks', d.getElementById('reqThanks').hidden === false && d.getElementById('reqFormWrap').hidden === true);

  ok('gaLocation=events on body', d.body.getAttribute('data-ga-location') === 'events');
  ok('heading reads "previous"', d.getElementById('previous').textContent.trim() === 'previous');
  ok('robots index, follow', d.querySelector('meta[name=robots]').content === 'index, follow');
  ok('canonical /events/', d.querySelector('link[rel=canonical]').href === 'https://mymostmostest.com/events/');
}

// ---------------------------------------------------------------- /about/
console.log('\n--- /about/ ---');
{
  const w = load('about/index.html', 'https://mymostmostest.com/about/');
  const d = w.document;
  ok('two person cards', d.querySelectorAll('.person').length === 2);
  const ig = d.querySelector('a[data-network]');
  ok('instagram link tagged for social_click',
     ig && ig.getAttribute('data-network') === 'instagram' && ig.getAttribute('data-profile') === 'mymostmostest');
  ok('gaLocation=about on body', d.body.getAttribute('data-ga-location') === 'about');
  const ld = JSON.parse(d.querySelector('script[type="application/ld+json"]').textContent);
  ok('JSON-LD AboutPage', ld['@type'] === 'AboutPage');
  ok('two Person entries', ld.about.length === 2 && ld.about.every((p) => p['@type'] === 'Person'));
  ok('author + illustrator named',
     ld.about[0].name === 'Brie Hollingsworth Krebs' && ld.about[1].name === 'Elle Harting');
  ok('portraits degrade gracefully (onerror)',
     [...d.querySelectorAll('.portrait img')].every((i) => i.getAttribute('onerror') === 'this.remove()'));
  ok('joint photo hides its figure if missing',
     /closest\('figure'\)/.test(d.querySelector('.about-photo img').getAttribute('onerror')));
  ok('robots index, follow', d.querySelector('meta[name=robots]').content === 'index, follow');
}

// --------------------------------------------------------------- /privacy/
console.log('\n--- /privacy/ (the drift fixes) ---');
{
  const html = read('privacy/index.html');
  const w = load('privacy/index.html', 'https://mymostmostest.com/privacy/');
  const d = w.document;
  ok('HAS the gtag snippet (live page has none)', html.includes('googletagmanager.com/gtag/js'));
  ok('HAS fonts (live page has none)', html.includes('fredoka-latin.woff2') && html.includes('nunito-latin.woff2'));
  ok('robots noindex, follow', d.querySelector('meta[name=robots]').content === 'noindex, follow');
  ok('canonical /privacy/', d.querySelector('link[rel=canonical]').href === 'https://mymostmostest.com/privacy/');
  ok('no site nav (standalone legal doc)', !d.querySelector('nav'));
  ok('no site footer (standalone legal doc)', !d.querySelector('.site-footer'));
  ok('keeps its own back-link and legal footer',
     !!d.querySelector('.home') && !!d.querySelector('footer.legal'));
  ok('policy body intact (7 sections)', d.querySelectorAll('.legal-wrap h2').length === 7,
     String(d.querySelectorAll('.legal-wrap h2').length));
}

// ------------------------------------------------------------ site-wide
console.log('\n--- site-wide ---');
{
  const pages = ['index.html', 'events/index.html', 'about/index.html', 'privacy/index.html'];
  for (const p of pages) {
    const h = read(p);
    ok(`${p}: exactly one gtag loader`, (h.match(/googletagmanager\.com\/gtag\/js/g) || []).length === 1);
    ok(`${p}: exactly one gtag config`, (h.match(/gtag\('config'/g) || []).length === 1);
  }
  // Light palette only, decided 2026-09-09: the home page never had dark mode,
  // so dark subpages meant a cream-to-dark jump mid-journey on a dark phone.
  const css = read('css/site.css');
  ok('no dark palette anywhere', !css.includes('#1A1D28') && !css.includes('#242838'));
  ok('no prefers-color-scheme media query', !css.includes('@media (prefers-color-scheme'));
  ok('no data-theme dark override', !/\[data-theme="dark"\]\s*\{/.test(css));
  for (const f of ['googlea86823cf66158b58.html', 'robots.txt', 'favicon.svg', 'og-cover.jpg', 'cover.jpg', 'CNAME'])
    ok(`static passthrough: ${f}`, fs.existsSync(path.join(SITE, f)));
  ok('4.3 MB event original NOT deployed', !fs.existsSync(path.join(SITE, 'assets/events/originals')));
}

console.log('\n' + (fail ? 'FAILED' : 'ALL PASS') + ` - ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
