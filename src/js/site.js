/* Forms and the macaroni rain.

   The two forms behave exactly as the old React component did: fire-and-forget
   POSTs, the success state shown regardless of whether the request succeeded,
   and the GA event fired immediately before the swap. The endpoints and the
   three _subject strings are copied character-for-character - Elle's inbox
   rules key on them. */
(function () {
  'use strict';

  var FORMSUBMIT = 'https://formsubmit.co/ajax/info@mymostmostest.com';
  var MAILERLITE = 'https://assets.mailerlite.com/jsonp/2529575/forms/193815162362267647/subscribe';
  var SUBJECT = {
    contact: 'new hello from mymostmostest.com',
    signup: 'new mailing-list signup'
  };

  function postJson(body) {
    return fetch(FORMSUBMIT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body)
    }).catch(function () {});
  }

  function show(el) { if (el) el.hidden = false; }
  function hide(el) { if (el) el.hidden = true; }

  // ---- contact ("say hello") -------------------------------------------
  var contact = document.querySelector('[data-form="contact"]');
  if (contact) {
    var contactWrap = document.getElementById('contactFormWrap');
    var contactThanks = document.getElementById('contactThanks');
    contact.addEventListener('submit', function (e) {
      e.preventDefault();
      var name = contact.elements.name.value;
      var email = contact.elements.email.value;
      var message = contact.elements.message.value;
      postJson({
        name: name || 'a reader',
        email: email || 'not provided',
        message: message || '',
        _subject: SUBJECT.contact,
        _template: 'box',
        _captcha: 'false'
      });
      if (typeof gtag === 'function') gtag('event', 'contact_submit', { location: 'hello' });
      contact.reset();
      hide(contactWrap);
      show(contactThanks);
    });
    var again = document.getElementById('contactAgain');
    if (again) {
      again.addEventListener('click', function (e) {
        e.preventDefault();
        hide(contactThanks);
        show(contactWrap);
        var first = contact.querySelector('input');
        if (first) first.focus();
      });
    }
  }

  // ---- newsletter signup -------------------------------------------------
  var signup = document.querySelector('[data-form="signup"]');
  if (signup) {
    var signupWrap = document.getElementById('signupFormWrap');
    var signupThanks = document.getElementById('signupThanks');
    signup.addEventListener('submit', function (e) {
      e.preventDefault();
      var email = signup.elements.email.value;
      if (!email) return; // empty email: no POST, no event - as before

      // MailerLite first (fire-and-forget, opaque response), then the
      // FormSubmit copy that lands in info@ as a notification + safety net.
      try {
        var fd = new FormData();
        fd.append('fields[email]', email);
        fd.append('ml-submit', '1');
        fd.append('anticsrf', 'true');
        fetch(MAILERLITE, { method: 'POST', body: fd, mode: 'no-cors' }).catch(function () {});
      } catch (_) {}

      postJson({
        email: email,
        _subject: SUBJECT.signup,
        _template: 'box',
        _captcha: 'false'
      });

      if (typeof gtag === 'function') gtag('event', 'email_signup', { location: 'signup' });
      signup.reset();
      hide(signupWrap);
      show(signupThanks);
    });
  }

  // ---- macaroni rain -----------------------------------------------------
  // Ported verbatim from the old component: same three LCG formulas, same
  // geometry, so the drops fall in the same places at the same speeds.
  function makeRain(el, count, spd) {
    // Prefix-aware so the /preview/ build uses its own copies.
    var base = (document.querySelector('link[rel=stylesheet]') || {}).href || '';
    var pre = base.indexOf('/preview/') !== -1 ? '/preview' : '';
    var imgs = [pre + '/assets/home/mac-1.png', pre + '/assets/home/mac-2.png'];
    var frag = document.createDocumentFragment();
    for (var i = 0; i < count; i++) {
      var s1 = ((i * 9301 + 49297) % 233280) / 233280;
      var s2 = ((i * 4021 + 7) % 233280) / 233280;
      var s3 = ((i * 7919 + 31) % 233280) / 233280;
      var dur = (5 + s3 * 6) / spd;
      var img = document.createElement('img');
      img.src = imgs[i % 2];
      img.alt = '';
      img.setAttribute('aria-hidden', 'true');
      img.style.left = (((i * 137.5) % 100) + (s2 * 12 - 6)) + '%';
      img.style.width = (24 + s3 * 30) + 'px';
      img.style.setProperty('--drift', (s1 * 90 - 45) + 'px');
      img.style.setProperty('--sway', ((s1 > 0.5 ? 1 : -1) * (16 + s3 * 34)) + 'px');
      img.style.setProperty('--rot', (s2 * 220 - 110) + 'deg');
      img.style.animation = 'macFall ' + dur + 's ease-in ' + (-(s1 * dur)) + 's infinite';
      frag.appendChild(img);
    }
    el.appendChild(frag);
  }

  var DENSITY = 10;   // the editor default the live page shipped with
  var SPEED = 0.7;
  if (!window.matchMedia || !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    var hero = document.querySelector('[data-rain="hero"]');
    var foot = document.querySelector('[data-rain="footer"]');
    if (hero) makeRain(hero, DENSITY, SPEED);
    if (foot) makeRain(foot, Math.max(4, Math.round(DENSITY * 0.55)), SPEED);
  }
})();
