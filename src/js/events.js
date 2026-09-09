/* /events/ - the upcoming/previous split, date formatting, and the
   request-a-reading form.

   The split runs in the browser, not at build time, because GitHub Pages only
   rebuilds on commit: a build-time split would keep advertising a reading the
   morning after it happened. Eleventy renders every event into #upcomingList
   so crawlers see them all; this moves the past ones down. */
(function () {
  'use strict';

  var FMT_DAY = { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' };
  var FMT_TIME = { hour: 'numeric', minute: '2-digit' };

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function when(li) {
    var raw = li.getAttribute('data-date');
    var text = li.getAttribute('data-datetext');
    if (text) return esc(text);
    var d = new Date(raw);
    if (isNaN(d)) return esc(raw);
    var day = d.toLocaleDateString('en-US', FMT_DAY);
    var hasTime = /T\d\d:\d\d/.test(raw);
    return hasTime ? day + ' · ' + d.toLocaleTimeString('en-US', FMT_TIME).toLowerCase() : day;
  }

  var upcomingList = document.getElementById('upcomingList');
  var previousList = document.getElementById('previousList');
  if (!upcomingList || !previousList) return;

  var items = [].slice.call(upcomingList.children);

  // An event stays "upcoming" through the end of its day, in the visitor's
  // local time. A date-only string parses as UTC, so it is read as local here
  // to avoid the day-early rollover the old hand-written list was prone to.
  var cutoff = new Date();
  cutoff.setHours(0, 0, 0, 0);

  function localDate(raw) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
    if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
    return new Date(raw);
  }

  var upcoming = [], previous = [];
  items.forEach(function (li) {
    var d = localDate(li.getAttribute('data-date'));
    (isNaN(d) || d >= cutoff ? upcoming : previous).push(li);
  });

  function byDate(dir) {
    return function (a, b) {
      var da = localDate(a.getAttribute('data-date'));
      var db = localDate(b.getAttribute('data-date'));
      var diff = dir === 'asc' ? da - db : db - da;
      if (diff !== 0) return diff;
      return (+a.getAttribute('data-order') || 0) - (+b.getAttribute('data-order') || 0);
    };
  }
  upcoming.sort(byDate('asc'));
  previous.sort(byDate('desc'));

  // Upcoming events stay as cards - they have to sell a visit. Past events
  // become one-line rows: proof it happened and a credit to the venue.
  function toRow(li) {
    var row = document.createElement('li');
    row.className = 'past-row';
    var venue = li.querySelector('.where') ? li.querySelector('.where').textContent : '';
    var link = li.querySelector('a[data-event-title]');
    var inner = '<span class="pwhen">' + when(li) + '</span><span class="pvenue">';
    if (link) {
      inner += '<a href="' + esc(link.getAttribute('href')) + '" target="_blank" rel="noopener"' +
        (link.hasAttribute('data-ga-skip') ? ' data-ga-skip' : '') +
        ' data-event-title="' + esc(link.getAttribute('data-event-title')) + '">' + esc(venue) + '</a>';
    } else {
      inner += esc(venue);
    }
    row.innerHTML = inner + '</span>';
    return row;
  }

  function fill(listEl, nodes, emptyText) {
    if (!nodes.length) {
      var li = document.createElement('li');
      li.innerHTML = '<p class="empty">' + emptyText + '</p>';
      listEl.appendChild(li);
      return;
    }
    nodes.forEach(function (n) { listEl.appendChild(n); });
  }

  upcoming.forEach(function (li) {
    var el = li.querySelector('[data-when]');
    if (el) el.textContent = when(li);
  });

  upcomingList.innerHTML = '';
  fill(upcomingList, upcoming,
    'nothing on the calendar right this minute. ' +
    '<a href="/#signup">get on the list</a> and you will hear about the next one first, or ' +
    '<a href="#request">invite us to hang out and do a reading</a>.');
  fill(previousList, previous.map(toRow),
    'our first reading is still ahead of us. check back soon.');

  // ---- request a reading -> FormSubmit (same inbox as the contact form) ----
  var form = document.getElementById('reqForm');
  var wrap = document.getElementById('reqFormWrap');
  var thanks = document.getElementById('reqThanks');
  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!form.reportValidity()) return;
      var v = function (n) { return (form.elements[n] && form.elements[n].value || '').trim(); };
      fetch('https://formsubmit.co/ajax/info@mymostmostest.com', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          name: v('name') || 'someone',
          email: v('email') || 'not provided',
          phone: v('phone') || 'not provided',
          organization: v('organization'),
          city: v('city'),
          timeframe: v('timeframe'),
          message: v('message'),
          _subject: 'reading request from mymostmostest.com',
          _template: 'box',
          _captcha: 'false'
        })
      }).catch(function () {});
      if (typeof gtag === 'function') gtag('event', 'reading_request', { location: 'events' });
      form.reset();
      wrap.hidden = true;
      thanks.hidden = false;
    });
  }
  var again = document.getElementById('reqAgain');
  if (again) {
    again.addEventListener('click', function () {
      thanks.hidden = true;
      wrap.hidden = false;
      var first = form.querySelector('input[name="name"]');
      if (first) first.focus();
    });
  }
})();
