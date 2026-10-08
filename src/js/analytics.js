/* Outbound retailer-click tracking.

   One copy for the whole site. This used to be duplicated in three places
   (the bundled home page, /events/ and /about/), which is how /privacy/ ended
   up with no tracking at all.

   The only thing that differed between those copies was locFor(), so the page
   supplies its own answer via <body data-ga-location>. Home sets nothing and
   falls through the section chain exactly as before.

   The section ids (buy story signup favorites comesayhi direct signed
   retailers hello) are GA4 dimensions: `location` is derived from them, so
   renaming one silently breaks the "Direct vs retail" report. */
(function () {
  var HOSTS = [
    { re: /(^|\.)amazon\./i,             name: 'Amazon',                channel: 'retail' },
    { re: /(^|\.)barnesandnoble\./i,     name: 'Barnes & Noble',        channel: 'retail' },
    { re: /(^|\.)bookshop\.org/i,        name: 'Bookshop.org',          channel: 'retail' },
    { re: /(^|\.)walmart\./i,            name: 'Walmart',               channel: 'retail' },
    { re: /(^|\.)ingramspark\./i,        name: 'IngramSpark (direct)',  channel: 'direct' },
    { re: /(^|\.)saltwaterbookshop\./i,  name: 'Saltwater Bookshop',    channel: 'local'  },
    { re: /(^|\.)eagleharborbooks\./i,   name: 'Eagle Harbor Book Co.', channel: 'local'  }
  ];

  function retailerFor(h) {
    for (var i = 0; i < HOSTS.length; i++) { if (HOSTS[i].re.test(h)) return HOSTS[i]; }
    return null;
  }

  function locFor(a) {
    if (a.closest('#retailers')) return 'retailers';
    if (a.closest('nav')) return 'header';
    if (a.closest('#buy')) return 'hero';
    var page = document.body.getAttribute('data-ga-location');
    if (page) return page;
    var s = a.closest('section');
    return (s && s.id) ? s.id : 'other';
  }

  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
    if (!a || a.hasAttribute('data-ga-skip')) return;
    var host;
    try { host = new URL(a.href).hostname; } catch (_) { return; }
    var r = retailerFor(host);
    if (!r || typeof gtag !== 'function') return;
    gtag('event', 'retailer_click', {
      retailer: r.name,
      channel: r.channel,
      link_url: a.href,
      link_text: (a.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 100),
      location: locFor(a)
    });
  }, true);

  // Event links (/events/) - tracked separately so a venue page is never
  // mistaken for a sale click. Fires regardless of data-ga-skip.
  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest ? e.target.closest('a[data-event-title]') : null;
    if (!a || typeof gtag !== 'function') return;
    gtag('event', 'event_link_click', {
      event_title: a.getAttribute('data-event-title'),
      link_url: a.href,
      location: 'events'
    });
  }, true);

  // Social links (/about/)
  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest ? e.target.closest('a[data-network]') : null;
    if (!a || typeof gtag !== 'function') return;
    gtag('event', 'social_click', {
      network: a.getAttribute('data-network'),
      profile: a.getAttribute('data-profile'),
      link_url: a.href,
      location: 'about'
    });
  }, true);
})();
