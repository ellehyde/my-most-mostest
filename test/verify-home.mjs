process.env.TZ='America/Los_Angeles';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';
const html = fs.readFileSync('/Users/bluemac/Desktop/Claude Projects/my-most-mostest-repo/_site/index.html','utf8');
let pass=0,fail=0;
const ok=(n,c,e)=>{c?(pass++,console.log('  PASS  '+n)):(fail++,console.log('  FAIL  '+n+(e?'  -> '+e:'')));};

const dom=new JSDOM(html,{runScripts:'dangerously',url:'https://mymostmostest.com/',
  beforeParse(w){ w.fetch=(...a)=>{ (w.__fetches ||= []).push(a); return Promise.resolve({ok:true,json:()=>Promise.resolve({})}); }; }});
const w=dom.window, d=w.document;
// site.js is deferred; jsdom with runScripts should execute it, but it is loaded
// from /js/site.js which jsdom will not fetch. Execute it manually.
const siteJs=fs.readFileSync('/Users/bluemac/Desktop/Claude Projects/my-most-mostest-repo/_site/js/site.js','utf8');
w.eval(siteJs);

console.log('\n--- structure ---');
const ids=[...d.querySelectorAll('section[id]')].map(s=>s.id);
ok('section order matches GA dimensions', ids.join(' ')==='buy story signup favorites comesayhi direct signed retailers hello', ids.join(' '));
ok('each section id appears once', new Set(ids).size===ids.length);
ok('nav has 6 links incl #navCta', d.querySelectorAll('#navMenu > a').length===6 && !!d.getElementById('navCta'));
ok('hamburger checkbox present', !!d.getElementById('navToggle') && !!d.getElementById('navBurger'));

console.log('\n--- analytics ---');
ok('exactly one gtag loader', (html.match(/googletagmanager\.com\/gtag\/js/g)||[]).length===1);
ok('exactly one gtag config', (html.match(/gtag\('config'/g)||[]).length===1);
ok('measurement id G-Q11KK8BV23', html.includes('G-Q11KK8BV23'));
ok('one click listener (HOSTS table)', (html.match(/ingramspark/g)||[]).length>=1);
const calls=[]; w.gtag=(...a)=>calls.push(a);
const fire=(el)=>{ el.dispatchEvent(new w.MouseEvent('click',{bubbles:true,cancelable:true})); };
const expect=[['#navCta','Amazon','retail','header'],
              ['#buy a.btn--primary','Amazon','retail','hero'],
              ['#direct a.btn--paper','IngramSpark (direct)','direct','direct'],
              ['#signed a.btn','Saltwater Bookshop','local','signed'],
              ['#retailers a.pill','Amazon','retail','retailers']];
for(const [sel,retailer,channel,loc] of expect){
  calls.length=0; const el=d.querySelector(sel);
  if(!el){ ok(`click ${sel}`,false,'element not found'); continue; }
  fire(el);
  const ev=calls.find(c=>c[1]==='retailer_click');
  ok(`${sel} -> ${retailer}/${channel}/${loc}`,
     !!ev && ev[2].retailer===retailer && ev[2].channel===channel && ev[2].location===loc,
     ev?JSON.stringify({r:ev[2].retailer,c:ev[2].channel,l:ev[2].location}):'no event');
}
// all 7 hosts reachable in the table
for(const h of ['amazon','barnesandnoble','bookshop.org','walmart','ingramspark','saltwaterbookshop','eagleharborbooks'])
  ok(`host table has ${h}`, fs.readFileSync('/Users/bluemac/Desktop/Claude Projects/my-most-mostest-repo/_site/index.html','utf8').includes(h));

console.log('\n--- forms ---');
const contact=d.querySelector('[data-form="contact"]');
d.getElementById('contactName').value='Test'; d.getElementById('contactEmail').value='t@e.com'; d.getElementById('contactMessage').value='hi';
calls.length=0; w.__fetches=[];
contact.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
const cf=(w.__fetches||[]).find(f=>String(f[0]).includes('formsubmit.co'));
ok('contact POSTs to FormSubmit', !!cf, JSON.stringify((w.__fetches||[]).map(f=>String(f[0]))));
ok('contact _subject exact', cf && JSON.parse(cf[1].body)._subject==='new hello from mymostmostest.com', cf?JSON.parse(cf[1].body)._subject:'');
ok('contact fires contact_submit', calls.some(c=>c[1]==='contact_submit' && c[2].location==='hello'));
ok('contact swaps to thanks', d.getElementById('contactThanks').hidden===false && d.getElementById('contactFormWrap').hidden===true);
d.getElementById('contactAgain').dispatchEvent(new w.MouseEvent('click',{bubbles:true,cancelable:true}));
ok('"send another" restores form', d.getElementById('contactThanks').hidden===true && d.getElementById('contactFormWrap').hidden===false);

const signup=d.querySelector('[data-form="signup"]');
calls.length=0; w.__fetches=[];
d.getElementById('signupEmail').value='';
signup.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
ok('empty signup email: no POST, no event', (w.__fetches||[]).length===0 && calls.length===0);
d.getElementById('signupEmail').value='a@b.com';
signup.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
const urls=(w.__fetches||[]).map(f=>String(f[0]));
ok('signup hits MailerLite first', urls[0] && urls[0].includes('assets.mailerlite.com/jsonp/2529575/forms/193815162362267647/subscribe'), urls.join(' | '));
ok('signup hits FormSubmit second', urls[1] && urls[1].includes('formsubmit.co'));
const ml=(w.__fetches||[])[0];
ok('MailerLite uses no-cors', ml && ml[1].mode==='no-cors');
const sf=(w.__fetches||[])[1];
ok('signup _subject exact', sf && JSON.parse(sf[1].body)._subject==='new mailing-list signup');
ok('signup fires email_signup', calls.some(c=>c[1]==='email_signup' && c[2].location==='signup'));

console.log('\n--- seo ---');
ok('title', d.title==="My Most Mostest - A Children's Book by Brie Hollingsworth Krebs", d.title);
ok('canonical is production root', d.querySelector('link[rel=canonical]').href==='https://mymostmostest.com/');
ok('robots index, follow', d.querySelector('meta[name=robots]').content==='index, follow');
ok('og:type=book + book:author', d.querySelector('meta[property="og:type"]').content==='book' && !!d.querySelector('meta[property="book:author"]'));
ok('og:image is og-cover.jpg', d.querySelector('meta[property="og:image"]').content==='https://mymostmostest.com/og-cover.jpg');
const ld=JSON.parse(d.querySelector('script[type="application/ld+json"]').textContent);
ok('JSON-LD Book', ld['@type']==='Book');
ok('paperback ISBN + 4 offers', ld.workExample[0].isbn==='9798295863783' && ld.workExample[0].offers.length===4);
ok('hardcover ISBN + 1 offer', ld.workExample[1].isbn==='9798295863806' && ld.workExample[1].offers.length===1);
ok('author + illustrator', ld.author.name==='Brie Hollingsworth Krebs' && ld.illustrator.name==='Elle Harting');
ok('audience 2-7', ld.audience.suggestedMinAge===2 && ld.audience.suggestedMaxAge===7);

console.log('\n--- copy guards (carried over) ---');
const text=d.body.textContent;
ok('no "special edition" claim', !/special edition/i.test(text));
ok('scarcity stated once', (text.match(/limited/gi)||[]).length===1);
ok('no em-dashes in body copy', !text.includes('—'));
ok('no heart emojis', !/\u{1F49B}/u.test(html));

console.log('\n--- weight ---');
ok('index.html under 100 KB', Buffer.byteLength(html)<100*1024, (Buffer.byteLength(html)/1024).toFixed(1)+' KB');

console.log('\n'+(fail?'FAILED':'ALL PASS')+` - ${pass} passed, ${fail} failed\n`);
process.exit(fail?1:0);
