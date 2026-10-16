/* Caring Companions family app (Step 1b of the booking plan approved 2026-10-15).
   Families sign in with a 6-digit code emailed to them (cc-family-app), then everything comes from the Hub's
   family-gateway, which only ever returns their own loved one. Nothing is charged here: visits go on the weekly
   AxisCare invoice. Plain JavaScript, no build step. */
(function () {
  'use strict'
  var C = window.CC_CONFIG || {}
  var DEMO = C.demo === true
  var app = document.getElementById('app')
  var sb = (!DEMO && window.supabase) ? window.supabase.createClient(C.familyUrl, C.familyAnon, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } }) : null

  var S = { view: 'loading', email: '', me: null, client: null, home: null, cgs: null, bookings: null, err: '', busy: false, bk: null, cg: null, sent: false, confirmCancel: null, done: null, notice: '' }

  // ── helpers ─────────────────────────────────────────────────────────────────────────────────────────────────────
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] }) }
  function t12(hhmm) { var p = String(hhmm || '').split(':'); var h = Number(p[0]), m = p[1] || '00'; if (isNaN(h)) return ''; return ((h + 11) % 12 + 1) + ':' + m + ' ' + (h < 12 ? 'AM' : 'PM') }
  function day(d, long) { var x = new Date(d + 'T12:00:00Z'); return x.toLocaleDateString('en-US', { timeZone: 'UTC', weekday: long === false ? 'short' : 'long', month: 'short', day: 'numeric' }) }
  function central() { var p = {}; new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date()).forEach(function (x) { p[x.type] = x.value }); return { date: p.year + '-' + p.month + '-' + p.day, min: (Number(p.hour) % 24) * 60 + Number(p.minute) } }
  function addDays(d, n) { var x = new Date(d + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10) }
  function toMin(s) { var p = s.split(':'); return Number(p[0]) * 60 + Number(p[1]) }
  function fromMin(n) { return String(Math.floor(n / 60)).padStart(2, '0') + ':' + String(n % 60).padStart(2, '0') }
  function hrs(n) { return (n % 1 ? n.toFixed(1) : String(n)) + ' hours' }
  function first(s) { return String(s || '').split(' ')[0] }
  var ICON = {
    back: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>',
    chev: '<svg class="chev" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>',
    check: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5L20 7"/></svg>',
    cal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4M12 13v5M9.5 15.5h5"/></svg>',
    people: '<svg viewBox="0 0 24 24" fill="none" stroke="#1F7A8C" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6"/><path d="M17 4.5c1.6.4 2.8 1.9 2.8 3.6S18.6 11.3 17 11.7M18.5 14.5c1.9.7 3 2.6 3 5.5"/></svg>',
    list: '<svg viewBox="0 0 24 24" fill="none" stroke="#1F7A8C" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 9h8M8 13h8M8 17h5"/></svg>',
    gear: '<svg viewBox="0 0 24 24" fill="none" stroke="#1F7A8C" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7"/></svg>',
    bigcheck: '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5L20 7"/></svg>'
  }
  function avatar(cg, big) {
    var cls = 'avatar' + (big ? ' big' : '')
    if (cg && cg.photo) return '<div class="' + cls + '"><img src="' + esc(cg.photo) + '" alt=""></div>'
    return '<div class="' + cls + '" aria-hidden="true">' + esc(((cg && (cg.first_name || cg.name)) || '?').charAt(0)) + '</div>'
  }
  function top(title, opts) {
    opts = opts || {}
    return '<div class="top' + (opts.tall ? ' tall' : '') + '"><div class="top-row">' +
      (opts.back ? '<button class="back" data-go="' + esc(opts.back) + '">' + ICON.back + esc(opts.backLabel || 'Back') + '</button>' : '<div class="brand">Caring Companions</div>') +
      (opts.step ? '<div class="step">' + esc(opts.step) + '</div>' : opts.help ? '<button class="icon-btn" data-go="account" aria-label="Help and account">?</button>' : '') +
      '</div>' + (opts.sub ? '<div class="sub">' + esc(opts.sub) + '</div>' : '') + '<h1>' + esc(title) + '</h1></div>'
  }
  function errBox() { return S.err ? '<div class="err" role="alert">' + esc(S.err) + '</div>' : '' }
  function phone() { return (S.home && S.home.office_phone) || '(417) 234-8494' }
  function telHref() { return 'tel:' + phone().replace(/[^0-9+]/g, '') }

  // ── talking to the Hub ──────────────────────────────────────────────────────────────────────────────────────────
  function call(action, extra) {
    var body = Object.assign({ action: action }, S.client ? { client: S.client } : {}, extra || {})
    if (DEMO) return Promise.resolve(window.CC_DEMO(body))
    return sb.auth.getSession().then(function (r) {
      var tok = r.data && r.data.session && r.data.session.access_token
      if (!tok) return { status: 401, data: { error: 'Please sign in again.' } }
      return fetch(C.gateway, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok }, body: JSON.stringify(body) })
        .then(function (res) { return res.json().catch(function () { return {} }).then(function (d) { return { status: res.status, data: d } }) })
    }).catch(function () { return { status: 0, data: { error: "We can't reach Caring Companions right now. Check your connection and try again." } } })
  }
  function load(view) {
    S.err = ''; S.busy = true; render()
    return call('home').then(function (r) {
      S.busy = false
      if (r.status === 401) { S.view = 'signin'; return render() }
      if (r.status !== 200) { S.err = r.data.error || 'Something went wrong.'; return render() }
      S.home = r.data; S.view = view || 'home'; render()
      if (!S.cgs) call('caregivers').then(function (x) { if (x.status === 200) { S.cgs = x.data.caregivers; if (S.view === 'home' || S.view === 'visits') render() } })
    })
  }
  function start() {
    try { var z = localStorage.getItem('cc_text_size'); if (z) document.documentElement.setAttribute('data-size', z) } catch (e) { /* private mode */ }
    if (DEMO) { S.view = 'signin'; return render() }
    sb.auth.getSession().then(function (r) { if (r.data && r.data.session) afterSignIn(); else { S.view = 'signin'; render() } })
  }
  function afterSignIn() {
    S.busy = true; render()
    call('me').then(function (r) {
      S.busy = false
      if (r.status === 401) { S.view = 'signin'; return render() }
      if (r.status !== 200) { S.view = 'signin'; S.err = r.data.error || 'Something went wrong.'; if (sb) sb.auth.signOut(); return render() }
      S.me = r.data
      if (r.data.clients.length === 1) { S.client = r.data.clients[0].id; load('home') } else { S.view = 'pick'; render() }
    })
  }

  // ── views ───────────────────────────────────────────────────────────────────────────────────────────────────────
  var V = {}
  V.loading = function () { return '<div class="loading">Loading…</div>' }
  V.signin = function () {
    return '<div class="body" style="padding-top:28px">' +
      '<img class="signin-logo" src="assets/cc-logo.png" alt="Caring Companions">' +
      '<h1>Sign in</h1>' +
      (S.sent
        ? '<p>We emailed a 6-digit code to <b>' + esc(S.email) + '</b>. Type it here.</p>' +
          '<label class="q" for="code">Your code</label><input id="code" class="code" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="000000">' + errBox() +
          '<button class="btn" data-act="verify"' + (S.busy ? ' disabled' : '') + '>Sign in</button>' +
          '<button class="btn quiet" data-act="resend">Send a new code</button><button class="btn quiet" data-act="other-email">Use a different email</button>'
        : '<p>Use the email address you gave Caring Companions. We\'ll email you a code. No password needed.</p>' +
          '<label class="q" for="email">Your email</label><input id="email" type="email" autocomplete="email" inputmode="email" value="' + esc(S.email) + '" placeholder="you@example.com">' + errBox() +
          '<button class="btn" data-act="send"' + (S.busy ? ' disabled' : '') + '>Email me a code</button>') +
      '<p class="muted small" style="margin-top:8px">Need help? Call us at (417) 234-8494, weekdays 8 AM to 6 PM.</p></div>'
  }
  V.pick = function () {
    return top('Whose care?', { sub: 'Hello, ' + first(S.me && S.me.name) }) + '<div class="body"><div class="list">' +
      S.me.clients.map(function (c) { return '<button class="row" data-pick="' + esc(c.id) + '"><span class="grow"><span class="t">' + esc(c.name) + '</span></span>' + ICON.chev + '</button>' }).join('') + '</div></div>'
  }
  V.home = function () {
    var h = S.home, nx = h.visits[0], name = h.client.name
    var waiting = h.waiting.filter(function (w) { return w.status !== 'practice' })
    return top('Visits for ' + name, { tall: true, help: true, sub: 'Hello, ' + first(S.me && S.me.name) }) +
      (nx ? '<button class="card next" data-go="visits">' + avatar(nx.caregiver ? { first_name: nx.caregiver.first_name, photo: cgPhoto(nx.caregiver.axiscare_id) } : null) +
            '<span style="display:flex;flex-direction:column;gap:2px;flex:1"><span class="label">Next visit</span><span class="t">' + esc(day(nx.date)) + '</span><span>' + esc(t12(nx.start)) + ' to ' + esc(t12(nx.end)) + (nx.caregiver ? ' with ' + esc(nx.caregiver.first_name) : '') + '</span>' +
            (nx.caregiver ? '' : '<span class="small muted">Caregiver to be confirmed</span>') + '</span>' + ICON.chev + '</button>'
          : '<div class="card next"><span style="flex:1"><span class="label">Next visit</span><br><span class="t">No visits in the next 3 weeks</span></span></div>') +
      '<div class="body">' + errBox() +
      (waiting.length ? '<div class="warn"><b>' + waiting.length + ' extra visit' + (waiting.length > 1 ? 's' : '') + ' booked.</b> We\'ll let you know who\'s coming.</div>' : '') +
      '<div class="tiles">' +
        (h.can_book ? '<button class="tile primary" data-act="book">' + ICON.cal + 'Book a visit</button>' : '') +
        '<button class="tile" data-go="caregivers">' + ICON.people + 'Her caregivers</button>' +
        '<button class="tile" data-go="visits">' + ICON.list + 'Upcoming visits</button>' +
        '<button class="tile" data-go="account">' + ICON.gear + 'Account</button>' +
      '</div>' +
      (h.can_book ? '' : '<div class="note">Your login can see visits. To book, ask the office to turn on booking for you.</div>') +
      '</div><div class="foot"><a class="btn outline" href="' + telHref() + '">Call the office</a><p class="center muted small">' + esc(phone()) + ' · a real person answers, weekdays 8 AM to 6 PM</p></div>'
  }
  function cgPhoto(id) { var c = (S.cgs || []).find(function (x) { return x.axiscare_id === String(id) }); return c ? c.photo : null }
  V.visits = function () {
    var h = S.home, mine = (S.bookings || []).filter(function (b) { return b.status !== 'cancelled' && b.date >= central().date })
    return top('Upcoming visits', { back: 'home', backLabel: 'Home' }) + '<div class="body">' + errBox() + (S.notice ? '<div class="note" role="status">' + esc(S.notice) + '</div>' : '') +
      '<div class="list">' + (h.visits.length ? h.visits.map(function (v) {
        return '<div class="row" style="cursor:default">' + avatar(v.caregiver ? { first_name: v.caregiver.first_name, photo: cgPhoto(v.caregiver.axiscare_id) } : null) +
          '<span class="grow"><span class="t">' + esc(day(v.date)) + '</span><span>' + esc(t12(v.start)) + ' to ' + esc(t12(v.end)) + '</span><span class="small muted">' + (v.caregiver ? 'with ' + esc(v.caregiver.first_name) : 'Caregiver to be confirmed') + '</span></span></div>'
      }).join('') : '<p class="muted">No visits in the next 3 weeks.</p>') + '</div>' +
      (mine.length ? '<h2 style="margin-top:8px">Visits you booked</h2><div class="list">' + mine.map(function (b) {
        var st = b.status === 'placed' ? '<span class="pill ok">' + esc(b.caregiver ? first(b.caregiver) + ' is coming' : 'Confirmed') + '</span>'
          : b.status === 'practice' ? '<span class="pill wait">Practice (not on the schedule)</span>' : '<span class="pill wait">Finding a caregiver</span>'
        var c = S.confirmCancel === b.id
        return '<div class="card"><div class="t" style="font-weight:700;color:var(--navy)">' + esc(day(b.date)) + ', ' + esc(t12(b.start)) + ' to ' + esc(t12(b.end)) + '</div><div class="small muted">' + esc((b.tasks || []).join(', ')) + '</div><div>' + st + '</div>' +
          (c ? '<div class="warn">Cancel this visit? It\'s free up to 24 hours before.</div><div class="tiles"><button class="btn" data-cancel-yes="' + esc(b.id) + '">Yes, cancel it</button><button class="btn outline" data-cancel-no="1">Keep it</button></div>'
             : (S.home.can_book ? '<button class="btn quiet" data-cancel="' + esc(b.id) + '">Cancel this visit</button>' : '')) + '</div>'
      }).join('') + '</div>' : '') +
      '<p class="muted small">Need to change a regular weekly visit? Call the office at ' + esc(phone()) + '.</p></div>'
  }
  V.caregivers = function () {
    var list = S.cgs || []
    return top('Her caregivers', { back: 'home', backLabel: 'Home' }) + '<div class="body">' +
      (list.length ? '<div class="list">' + list.map(function (c) {
        return '<button class="row" data-cg="' + esc(c.axiscare_id) + '">' + avatar(c) + '<span class="grow"><span class="t">' + esc(c.name) + '</span><span class="small muted">' + c.visits_together + ' visit' + (c.visits_together === 1 ? '' : 's') + ' together</span></span>' + ICON.chev + '</button>'
      }).join('') + '</div>' : '<p class="muted">Caregiver profiles show here once a caregiver has visited and shared their profile.</p>') + '</div>'
  }
  V.caregiver = function () {
    var c = S.cg
    return top(c.name, { back: 'caregivers', backLabel: 'Caregivers' }) + '<div class="body"><div class="center" style="display:flex;flex-direction:column;gap:8px">' + avatar(c, true) +
      '<div class="muted">' + c.visits_together + ' visit' + (c.visits_together === 1 ? '' : 's') + ' together' + (c.years ? ' · caregiving ' + esc(c.years) + ' years' : '') + '</div></div>' +
      (c.video ? '<video controls playsinline preload="metadata" src="' + esc(c.video) + '"></video>' : '') +
      (c.about ? '<div class="card"><h3>About ' + esc(c.first_name) + '</h3><p>' + esc(c.about) + '</p></div>' : '') +
      (c.why ? '<div class="card"><h3>Why ' + esc(c.first_name) + ' does this work</h3><p class="quote">' + esc(c.why) + '</p></div>' : '') +
      (c.experience ? '<div class="card"><h3>Experience</h3><p>' + esc(c.experience) + '</p></div>' : '') +
      '<div class="panel small">Every Caring Companions caregiver passes a background check and is trained by us.</div></div>' +
      (S.home.can_book ? '<div class="foot"><button class="btn" data-act="book-with" data-id="' + esc(c.axiscare_id) + '">Book a visit with ' + esc(c.first_name) + '</button></div>' : '')
  }
  V.account = function () {
    var z = document.documentElement.getAttribute('data-size') || '0'
    return top('Account', { back: 'home', backLabel: 'Home' }) + '<div class="body">' +
      '<div class="card"><span class="label">Signed in as</span><span>' + esc(S.me && S.me.name) + '</span></div>' +
      '<div class="card"><h3>Billing and invoices</h3><p>Every visit, regular or extra, goes on your weekly invoice from Caring Companions. Nothing is charged in this app.</p>' +
        (C.billingUrl ? '<a class="btn outline" href="' + esc(C.billingUrl) + '" target="_blank" rel="noopener">See invoices and set up autopay</a>' : '<p class="muted small">Questions about an invoice? Call the office.</p>') + '</div>' +
      '<div class="card"><h3>Text size</h3><div class="chips times" role="group" aria-label="Text size">' +
        ['Normal', 'Large', 'Largest'].map(function (l, i) { return '<button class="chip" data-size="' + i + '" aria-pressed="' + (String(i) === z) + '" style="font-size:' + (1 + i * .15) + 'em">' + l + '</button>' }).join('') + '</div></div>' +
      (S.me && S.me.clients.length > 1 ? '<button class="btn outline" data-go="pick">Switch to someone else\'s care</button>' : '') +
      '<a class="btn outline" href="' + telHref() + '">Call the office · ' + esc(phone()) + '</a>' +
      '<button class="btn quiet" data-act="signout">Sign out</button></div>'
  }

  // booking
  function weekdays() {
    var c = central(), out = [], d = c.date
    while (out.length < 10) {
      var w = new Date(d + 'T12:00:00Z').getUTCDay()
      if (w !== 0 && w !== 6 && (d !== c.date || c.min + 120 <= 16 * 60)) out.push(d)
      d = addDays(d, 1)
    }
    return out
  }
  function starts(date) {
    var c = central(), out = []
    for (var m = 8 * 60; m <= 16 * 60; m += 30) if (date !== c.date || m - c.min >= 120) out.push(fromMin(m))
    return out
  }
  function newBooking(cg) {
    var d = weekdays()[0] === central().date && weekdays().length > 1 ? weekdays()[1] : weekdays()[0]
    S.bk = { date: d, start: '09:00', hours: 3, who: cg ? 'regular' : 'regular', cg: cg || null, tasks: [], note: '' }
    fixTimes()
  }
  function fixTimes() {
    var st = starts(S.bk.date); if (st.indexOf(S.bk.start) < 0) S.bk.start = st[0]
    var max = (18 * 60 - toMin(S.bk.start)) / 60; if (S.bk.hours > max) S.bk.hours = max; if (S.bk.hours < 2) S.bk.hours = 2
  }
  function regular() { return (S.cgs || [])[0] || null }
  V.book1 = function () {
    var b = S.bk, max = (18 * 60 - toMin(b.start)) / 60, reg = b.cg ? (S.cgs || []).find(function (x) { return x.axiscare_id === b.cg }) : regular()
    var whoOpts = [['regular', reg ? reg.first_name : 'Her regular caregiver', reg ? (b.cg ? 'Asked first' : 'Her regular caregiver. Asked first.') : 'Asked first'], ['favorites', 'Someone she already knows', 'Any caregiver who has visited her'], ['any', 'Whoever is available', 'A caregiver matched to her']]
    return top('Book a visit for ' + S.home.client.name, { back: 'home', backLabel: 'Home', step: 'Step 1 of 3' }) + '<div class="body">' + errBox() +
      '<div class="note">Her regular weekly visits are already set. This is for an extra visit.</div>' +
      '<div><div class="q" style="margin-bottom:8px">Which day?</div><div class="chips days">' + weekdays().map(function (d) {
        return '<button class="chip" data-day="' + d + '" aria-pressed="' + (d === b.date) + '"><small>' + esc(day(d, false).split(',')[0]) + '</small><b>' + Number(d.slice(8)) + '</b></button>' }).join('') + '</div></div>' +
      '<div><div class="q" style="margin-bottom:8px">Start time</div><div class="chips times">' + starts(b.date).map(function (s) {
        return '<button class="chip" data-start="' + s + '" aria-pressed="' + (s === b.start) + '">' + esc(t12(s)) + '</button>' }).join('') + '</div></div>' +
      '<div class="stepper"><div><div class="q">How long?</div><div class="small muted">At least 2 hours, any length after</div></div><div class="ctl">' +
        '<button class="round" data-hours="-0.5" aria-label="Less time"' + (b.hours <= 2 ? ' disabled' : '') + '>−</button><div class="hours">' + hrs(b.hours) + '</div>' +
        '<button class="round fill" data-hours="0.5" aria-label="More time"' + (b.hours >= max ? ' disabled' : '') + '>+</button></div></div>' +
      '<div class="list"><div class="q">Who would you like?</div>' + whoOpts.map(function (o) {
        return '<button class="opt" role="radio" data-who="' + o[0] + '" aria-checked="' + (b.who === o[0]) + '"><span class="dot"></span><span><b style="color:var(--navy)">' + esc(o[1]) + '</b><br><span class="small muted">' + esc(o[2]) + '</span></span></button>' }).join('') + '</div>' +
      '</div><div class="foot"><p class="center"><b>' + esc(day(b.date)) + ' · ' + esc(t12(b.start)) + ' to ' + esc(t12(fromMin(toMin(b.start) + b.hours * 60))) + '</b></p><button class="btn" data-go="book2">Next</button></div>'
  }
  V.book2 = function () {
    var b = S.bk
    return top('What would help ' + S.home.client.name + '?', { back: 'book1', step: 'Step 2 of 3' }) + '<div class="body">' + errBox() +
      '<div class="small muted">Pick as many as you like</div><div class="tasks">' + S.home.tasks.map(function (t) {
        var on = b.tasks.indexOf(t) >= 0
        return '<button class="opt" data-task="' + esc(t) + '" aria-pressed="' + on + '"><span class="box">' + (on ? '<span style="color:#fff">' + ICON.check + '</span>' : '') + '</span>' + esc(t) + '</button>' }).join('') + '</div>' +
      '<div><label class="q" for="note">Anything the caregiver should know?</label><textarea id="note" maxlength="1000" placeholder="For example: Mom would love help making soup, and a short walk if it\'s nice out.">' + esc(b.note) + '</textarea></div>' +
      '</div><div class="foot"><button class="btn" data-act="to-book3"' + (b.tasks.length ? '' : ' disabled') + '>Next</button>' + (b.tasks.length ? '' : '<p class="center small muted">Pick at least one</p>') + '</div>'
  }
  V.book3 = function () {
    var b = S.bk, end = fromMin(toMin(b.start) + b.hours * 60), rate = S.home.rate
    var reg = b.cg ? (S.cgs || []).find(function (x) { return x.axiscare_id === b.cg }) : regular()
    var whoTxt = b.who === 'regular' ? (reg ? reg.first_name + ', asked first' : 'Her regular caregiver, asked first') : b.who === 'favorites' ? 'Someone she already knows' : 'Whoever is available'
    return top('Check and book', { back: 'book2', step: 'Step 3 of 3' }) + '<div class="body">' + errBox() +
      '<div class="card" style="gap:0;padding:4px 16px">' +
        '<div class="sum"><span class="muted">When</span><span class="v">' + esc(day(b.date)) + '<br>' + esc(t12(b.start)) + ' to ' + esc(t12(end)) + '</span></div>' +
        '<div class="sum"><span class="muted">Who</span><span class="v">' + esc(whoTxt) + '</span></div>' +
        '<div class="sum"><span class="muted">Help with</span><span class="v">' + esc(b.tasks.join(', ')) + '</span></div>' +
        (b.note ? '<div class="sum"><span class="muted">Note</span><span class="v">' + esc(b.note) + '</span></div>' : '') + '</div>' +
      '<div class="panel">' + (rate ? '<div style="display:flex;justify-content:space-between;align-items:baseline"><span>Estimated · ' + hrs(b.hours) + ' × $' + rate + '</span><span style="font-family:var(--serif);font-size:1.5em;font-weight:600;color:var(--navy)">$' + (Math.round(b.hours * rate * 100) / 100) + '</span></div>' : '') +
        '<p class="small muted">Nothing is charged today. The final amount, for the time the caregiver is actually there, shows on your weekly invoice with her other visits.</p></div>' +
      '<p class="small">Free to cancel up to 24 hours before.</p>' +
      '</div><div class="foot"><button class="btn" data-act="confirm"' + (S.busy ? ' disabled' : '') + '>' + (S.busy ? 'Booking…' : 'Book this visit') + '</button></div>'
  }
  V.done = function () {
    var d = S.done
    return '<div class="body center" style="padding-top:40px;display:flex;flex-direction:column;gap:14px"><div class="big-check">' + ICON.bigcheck + '</div>' +
      '<h1>' + (d.status === 'practice' ? 'Got it (practice)' : 'You\'re booked') + '</h1><p>' + esc(day(d.date)) + '<br><b>' + esc(t12(d.start)) + ' to ' + esc(t12(d.end)) + '</b></p>' +
      '<div class="card" style="text-align:left"><p>' + esc(d.message) + '</p></div></div>' +
      '<div class="foot"><button class="btn" data-act="home-reload">Back to home</button></div>'
  }

  // ── render + events ─────────────────────────────────────────────────────────────────────────────────────────────
  function render() {
    var v = V[S.view] || V.loading
    app.innerHTML = (DEMO ? '<div class="demo-bar">Preview with sample information. Nothing is booked.</div>' : '') + (S.busy && S.view === 'loading' ? V.loading() : v())
    window.scrollTo(0, 0)
  }
  function go(view) {
    S.err = ''; S.confirmCancel = null
    if (view === 'caregivers' || view === 'visits' || view === 'book1') {
      var need = []
      if (!S.cgs) need.push(call('caregivers').then(function (r) { S.cgs = r.status === 200 ? r.data.caregivers : [] }))
      if (view === 'visits') need.push(call('bookings').then(function (r) { S.bookings = r.status === 200 ? r.data.bookings : [] }))
      if (need.length) { S.view = 'loading'; render(); return Promise.all(need).then(function () { S.view = view; render() }) }
    }
    S.view = view; render()
  }
  app.addEventListener('click', function (e) {
    var el = e.target.closest('button, a'); if (!el) return
    var ds = el.dataset
    if (ds.go) return go(ds.go)
    if (ds.pick) { S.client = ds.pick; S.cgs = null; S.bookings = null; return load('home') }
    if (ds.cg) { S.cg = (S.cgs || []).find(function (x) { return x.axiscare_id === ds.cg }); return go('caregiver') }
    if (ds.day) { S.bk.date = ds.day; fixTimes(); return render() }
    if (ds.start) { S.bk.start = ds.start; fixTimes(); return render() }
    if (ds.hours) { S.bk.hours = Math.max(2, Math.min((18 * 60 - toMin(S.bk.start)) / 60, S.bk.hours + Number(ds.hours))); return render() }
    if (ds.who) { S.bk.who = ds.who; return render() }
    if (ds.task) { var i = S.bk.tasks.indexOf(ds.task); if (i >= 0) S.bk.tasks.splice(i, 1); else S.bk.tasks.push(ds.task); keepNote(); return render() }
    if (ds.size != null && el.classList.contains('chip')) { document.documentElement.setAttribute('data-size', ds.size); try { localStorage.setItem('cc_text_size', ds.size) } catch (x) { /* fine */ } return render() }
    if (ds.cancel) { S.confirmCancel = ds.cancel; return render() }
    if (ds.cancelNo) { S.confirmCancel = null; return render() }
    if (ds.cancelYes) return cancel(ds.cancelYes)
    var a = ds.act
    if (a === 'send' || a === 'resend') return sendCode()
    if (a === 'verify') return verify()
    if (a === 'other-email') { S.sent = false; S.err = ''; return render() }
    if (a === 'book') { newBooking(); return go('book1') }
    if (a === 'book-with') { newBooking(ds.id); return go('book1') }
    if (a === 'to-book3') { keepNote(); return go('book3') }
    if (a === 'confirm') return confirm()
    if (a === 'home-reload') { S.bookings = null; return load('home') }
    if (a === 'signout') { S.me = null; S.client = null; S.home = null; S.cgs = null; S.sent = false; if (sb) sb.auth.signOut(); S.view = 'signin'; return render() }
  })
  app.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter') return
    if (e.target.id === 'email') sendCode()
    if (e.target.id === 'code') verify()
  })
  function keepNote() { var n = document.getElementById('note'); if (n && S.bk) S.bk.note = n.value }

  function sendCode() {
    var inp = document.getElementById('email'); if (inp) S.email = inp.value.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(S.email)) { S.err = 'Please type your email address.'; return render() }
    S.err = ''; S.busy = true; render()
    if (DEMO) { S.busy = false; S.sent = true; return render() }
    sb.auth.signInWithOtp({ email: S.email, options: { shouldCreateUser: false } }).then(function (r) {
      S.busy = false
      if (r.error) S.err = /signup|not found|not allowed/i.test(r.error.message) ? 'That email isn\'t set up for the app yet. Please call the office and we\'ll turn it on.' : /rate|seconds|too many/i.test(r.error.message) ? 'Please wait a minute, then ask for a new code.' : 'We couldn\'t send the code. Please try again.'
      else S.sent = true
      render()
    })
  }
  function verify() {
    var code = (document.getElementById('code') || {}).value || ''
    code = code.replace(/\D/g, '')
    if (code.length !== 6) { S.err = 'The code is 6 numbers.'; return render() }
    S.err = ''; S.busy = true; render()
    if (DEMO) { S.busy = false; return afterSignIn() }
    sb.auth.verifyOtp({ email: S.email, token: code, type: 'email' }).then(function (r) {
      S.busy = false
      if (r.error) { S.err = 'That code didn\'t work. Check it, or ask for a new one.'; return render() }
      afterSignIn()
    })
  }
  function confirm() {
    var b = S.bk; S.busy = true; S.err = ''; render()
    call('book', { date: b.date, start: b.start, hours: b.hours, tasks: b.tasks, who: b.who, note: b.note, caregiver_axiscare_id: b.cg }).then(function (r) {
      S.busy = false
      if (r.status !== 200) { S.err = r.data.error || 'Something went wrong. Nothing was booked.'; return render() }
      S.done = { date: b.date, start: b.start, end: fromMin(toMin(b.start) + b.hours * 60), status: r.data.status, message: r.data.message }
      S.bookings = null; S.view = 'done'; render()
    })
  }
  function cancel(id) {
    S.busy = true; render()
    call('cancel', { booking_id: id }).then(function (r) {
      S.busy = false; S.confirmCancel = null
      if (r.status !== 200) { S.err = r.data.error || 'That didn\'t work. Please call the office.'; return render() }
      return Promise.all([call('bookings'), call('home')]).then(function (x) {
        S.bookings = x[0].status === 200 ? x[0].data.bookings : []; if (x[1].status === 200) S.home = x[1].data
        S.err = ''; S.view = 'visits'; S.notice = r.data.message || 'Cancelled.'; render(); S.notice = ''
      })
    })
  }
  start()
})()
