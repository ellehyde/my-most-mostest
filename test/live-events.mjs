// Fire every tracked interaction against the LIVE pages and record what gtag receives.
import { JSDOM } from 'jsdom';
const BASE = 'https://mymostmostest.com';
const get = async (p) => (await fetch(BASE + p)).text();
const js  = async (p) => (await fetch(BASE + p)).text();

const analyticsJs = await js('/js/analytics.js');
const siteJs      = await js('/js/site.js');
const eventsJs    = await js('/js/events.js');

function mk(html, url) {
  const dom = new JSDOM(html, { runScripts: 'dangerously', url,
    beforeParse(w) { w.fetch = (...a) => { (w.__f ||= []).push(a); return Promise.resolve({ ok:true, json:()=>Promise.resolve({}) }); }; } });
  const w = dom.window; w.__calls = []; w.gtag = (...a) => w.__calls.push(a);
  return w;
}
const seen = new Map();
const note = (w) => w.__calls.filter(c=>c[0]==='event').forEach(c => { if(!seen.has(c[1])) seen.set(c[1], c[2]); });
const click = (w, el) => el && el.dispatchEvent(new w.MouseEvent('click',{bubbles:true,cancelable:true}));

// --- home: retailer_click, email_signup, contact_submit
{
  const w = mk(await get('/'), BASE + '/'); w.eval(analyticsJs); w.eval(siteJs);
  const d = w.document;
  click(w, d.querySelector('#retailers a.pill'));
  click(w, d.querySelector('#direct a.btn'));
  click(w, d.querySelector('#signed a.btn'));
  click(w, d.getElementById('navCta'));
  const su = d.querySelector('[data-form="signup"]');
  su.elements.email.value = 'test@example.com';
  su.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
  const cf = d.querySelector('[data-form="contact"]');
  cf.elements.name.value='t'; cf.elements.email.value='t@e.com'; cf.elements.message.value='hi';
  cf.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
  note(w);
  const locs = w.__calls.filter(c=>c[1]==='retailer_click').map(c=>`${c[2].channel}/${c[2].location}`);
  console.log('  retailer_click channel/location seen:', [...new Set(locs)].join(', '));
}
// --- events: event_link_click, reading_request
{
  const w = mk(await get('/events/'), BASE + '/events/'); w.eval(analyticsJs); w.eval(eventsJs);
  const d = w.document;
  const upLinks = d.querySelectorAll('#upcomingList a[data-event-title]');
  const prevLinks = d.querySelectorAll('#previousList a[data-event-title]');
  console.log(`  events page right now: ${d.querySelectorAll('#upcomingList > li.event').length} upcoming card(s), ${prevLinks.length} previous row(s)`);
  click(w, upLinks[0] || prevLinks[0]);
  const rf = d.getElementById('reqForm'); rf.reportValidity = () => true;
  ['name','email','organization','city'].forEach(n=>rf.elements[n].value='x');
  rf.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
  note(w);
}
// --- about: social_click
{
  const w = mk(await get('/about/'), BASE + '/about/'); w.eval(analyticsJs);
  click(w, w.document.querySelector('a[data-network]'));
  note(w);
}
console.log('\n  event name          parameters');
console.log('  ' + '-'.repeat(72));
for (const want of ['retailer_click','email_signup','contact_submit','event_link_click','reading_request','social_click']) {
  const p = seen.get(want);
  console.log(`  ${(p?'OK  ':'MISS') + ' ' + want.padEnd(18)} ${p ? JSON.stringify(p).slice(0,90) : '-- did not fire --'}`);
}
