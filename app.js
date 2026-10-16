/* Caring Companions family app (Step 1b of the booking plan approved 2026-10-15; flexible booking approved 2026-10-16).
   Families sign in with a 6-digit code emailed to them (cc-family-app), then everything comes from the Hub's
   family-gateway, which only ever returns their own loved one. Nothing is charged here: visits go on the weekly
   AxisCare invoice. Plain JavaScript, no build step. */
(function () {
  'use strict'
  var C = window.CC_CONFIG || {}
  var DEMO = C.demo === true
  // Families see invoices, the complete schedule and visit notes in AxisCare (her note 2026-10-16); this app links there.
  var AXIS = C.axiscareUrl || 'https://16485.axiscare.com/'
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
  function money(n) { var r = Math.round(n * 100) / 100; return r % 1 ? r.toFixed(2) : String(r) }
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
        : '<p>Use the email address Caring Companions has on file for you or your loved one. We\'ll email you a code. No password needed.</p>' +
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
      (waiting.length ? '<div class="warn"><b>' + waiting.length + ' extra visit' + (waiting.length > 1 ? 's' : '') + ' booked.</b> You\'ll see who\'s coming here once a caregiver confirms.</div>' : '') +
      '<div class="tiles">' +
        (h.can_book ? '<button class="tile primary" data-act="book">' + ICON.cal + 'Book a visit</button>' : '') +
        '<button class="tile" data-go="caregivers">' + ICON.people + 'Caregivers</button>' +
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
        if (!b.start && b.status !== 'practice') st += '<div class="small muted" style="margin-top:4px">The exact time shows here once a caregiver confirms.</div>'
        var c = S.confirmCancel === b.id
        var tm = b.start ? esc(t12(b.start)) + ' to ' + esc(t12(b.end)) : 'Anytime ' + esc(t12(b.window_start)) + ' to ' + esc(t12(b.window_end)) + ', ' + esc(hrs(b.hours))
        return '<div class="card"><div class="t" style="font-weight:700;color:var(--navy)">' + esc(day(b.date)) + ', ' + tm + '</div><div class="small muted">' + esc((b.tasks || []).join(', ')) + '</div><div>' + st + '</div>' +
          (c ? '<div class="warn">Cancel this visit? It\'s free up to 24 hours before.</div><div class="tiles"><button class="btn" data-cancel-yes="' + esc(b.id) + '">Yes, cancel it</button><button class="btn outline" data-cancel-no="1">Keep it</button></div>'
             : (S.home.can_book ? '<button class="btn quiet" data-cancel="' + esc(b.id) + '">Cancel this visit</button>' : '')) + '</div>'
      }).join('') + '</div>' : '') +
      '<p class="muted small">The complete schedule and each visit\'s notes are in <a href="' + esc(AXIS) + '" target="_blank" rel="noopener">AxisCare</a>. Need to change a regular weekly visit? Call the office at ' + esc(phone()) + '.</p></div>'
  }
  V.caregivers = function () {
    var list = S.cgs || []
    return top(S.home.client.name + '\'s caregivers', { back: 'home', backLabel: 'Home' }) + '<div class="body">' +
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
      '<div class="card"><h3>Invoices, the full schedule and visit notes</h3><p>These are in AxisCare, our scheduling system. Every visit, regular or extra, goes on your weekly invoice there. Nothing is charged in this app.</p>' +
        '<a class="btn outline" href="' + esc(AXIS) + '" target="_blank" rel="noopener">Open AxisCare</a><p class="muted small">New to AxisCare? Use the "Activate your AxisCare account" link in your welcome email. Questions about an invoice? Call the office.</p></div>' +
      '<div class="card"><h3>Text size</h3><div class="chips times" role="group" aria-label="Text size">' +
        ['Normal', 'Large', 'Largest'].map(function (l, i) { return '<button class="chip" data-size="' + i + '" aria-pressed="' + (String(i) === z) + '" style="font-size:' + (1 + i * .15) + 'em">' + l + '</button>' }).join('') + '</div></div>' +
      (S.me && S.me.clients.length > 1 ? '<button class="btn outline" data-go="pick">Switch to someone else\'s care</button>' : '') +
      '<a class="btn outline" href="' + telHref() + '">Call the office · ' + esc(phone()) + '</a>' +
      '<button class="btn quiet" data-act="signout">Sign out</button></div>'
  }

  // booking (her design approved 2026-10-16): a date on a month calendar, a set time or a flexible window, what would
  // help, and who they'd like (one or more of the client's caregivers, or whoever is available). Days and hours come from the Hub.
  function HRS() { return (S.home && S.home.hours) || { days: [1, 2, 3, 4, 5], open: '08:00', close: '18:00', min_hours: 2, notice_hours: 2, max_days: 60 } }
  var MONL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  var DAYL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  function dow(d) { return new Date(d + 'T12:00:00Z').getUTCDay() }
  function earliest(d) { var h = HRS(), c = central(), m = toMin(h.open); if (d === c.date) { var n = c.min + h.notice_hours * 60; m = Math.max(m, Math.ceil(n / 30) * 30) } return m }
  function bookable(d) {
    var h = HRS(), c = central()
    if (d < c.date || d > addDays(c.date, h.max_days) || h.days.indexOf(dow(d)) < 0) return false
    return earliest(d) + h.min_hours * 60 <= toMin(h.close)
  }
  function firstBookable() { var d = central().date; for (var i = 0; i <= HRS().max_days; i++) { if (bookable(d)) return d; d = addDays(d, 1) } return null }
  function times(from, to) { var out = []; for (var m = from; m <= to; m += 30) out.push(fromMin(m)); return out }
  function bkHours(b) { return b.mode === 'set' ? (toMin(b.end) - toMin(b.start)) / 60 : b.len }
  function newBooking(cg) {
    var d = firstBookable()
    S.bk = { date: d, month: (d || central().date).slice(0, 7), mode: 'set', start: '09:00', end: '12:00', wFrom: '09:00', wTo: '15:00', len: 3, picks: cg ? [String(cg)] : [], any: !cg, tasks: [], note: '' }
    if (d) fixTimes()
  }
  // keep every time inside the day's hours, the 2-hour minimum and the notice
  function fixTimes() {
    var b = S.bk, h = HRS(), lo = earliest(b.date), hi = toMin(h.close), min = h.min_hours * 60
    function clamp(v, a, z) { return Math.max(a, Math.min(z, v)) }
    var s = clamp(toMin(b.start), lo, hi - min), e = clamp(toMin(b.end), s + min, hi)
    b.start = fromMin(s); b.end = fromMin(e)
    var f = clamp(toMin(b.wFrom), lo, hi - min), t = clamp(toMin(b.wTo), f + min, hi)
    b.wFrom = fromMin(f); b.wTo = fromMin(t)
    b.len = Math.max(h.min_hours, Math.min((t - f) / 60, b.len))
  }
  function sel(id, from, to, val, label) {
    return '<label class="tsel"><span class="small muted">' + esc(label) + '</span><select id="' + id + '" data-time="' + id + '">' + times(from, to).map(function (t) {
      return '<option value="' + t + '"' + (t === val ? ' selected' : '') + '>' + esc(t12(t)) + '</option>' }).join('') + '</select></label>'
  }
  function whenLine(b) {
    return b.mode === 'set' ? t12(b.start) + ' to ' + t12(b.end) : 'Anytime between ' + t12(b.wFrom) + ' and ' + t12(b.wTo) + ', ' + hrs(b.len)
  }
  function daysWords() { var d = HRS().days; return d.length === 7 ? 'Any day of the week' : d.join() === '1,2,3,4,5' ? 'Monday to Friday' : d.map(function (n) { return DAYL[n] }).join(', ') }
  var STEPS = 5
  V.book1 = function () {
    var b = S.bk, y = Number(b.month.slice(0, 4)), mo = Number(b.month.slice(5, 7)) - 1, c = central(), h = HRS()
    var firstDow = new Date(Date.UTC(y, mo, 1, 12)).getUTCDay(), n = new Date(Date.UTC(y, mo + 1, 0, 12)).getUTCDate()
    var canPrev = b.month > c.date.slice(0, 7), canNext = b.month < addDays(c.date, h.max_days).slice(0, 7)
    var cells = ''
    for (var i = 0; i < firstDow; i++) cells += '<span></span>'
    for (var dd = 1; dd <= n; dd++) {
      var d = b.month + '-' + String(dd).padStart(2, '0'), ok = bookable(d), on = d === b.date
      cells += '<button class="cal-d' + (on ? ' on' : '') + '" data-date="' + d + '"' + (ok ? '' : ' disabled') + ' aria-label="' + DAYL[dow(d)] + ', ' + MONL[mo] + ' ' + dd + (ok ? '' : ', not available') + '" aria-pressed="' + on + '">' + dd + '</button>'
    }
    return top('When should we come?', { back: 'home', backLabel: 'Home', step: 'Step 1 of ' + STEPS }) + '<div class="body">' + errBox() +
      '<div class="note">' + esc(S.home.client.name) + '\'s regular weekly visits are already set. This is for an extra visit.</div>' +
      (firstBookable() ? '' : '<div class="warn">No days are open to book right now. Please call the office at ' + esc(phone()) + '.</div>') +
      '<div class="cal"><div class="cal-top"><button class="cal-nav" data-month="-1" aria-label="Previous month"' + (canPrev ? '' : ' disabled') + '>‹</button><b>' + MONL[mo] + ' ' + y + '</b>' +
        '<button class="cal-nav" data-month="1" aria-label="Next month"' + (canNext ? '' : ' disabled') + '>›</button></div>' +
        '<div class="cal-g">' + DAYL.map(function (x) { return '<small aria-hidden="true">' + x.charAt(0) + '</small>' }).join('') + cells + '</div></div>' +
      '<p class="small muted">' + esc(daysWords()) + ', ' + esc(t12(h.open)) + ' to ' + esc(t12(h.close)) + '. Book at least ' + esc(hrs(h.notice_hours)) + ' ahead, up to ' + h.max_days + ' days out.</p>' +
      '</div><div class="foot">' + (b.date ? '<p class="center"><b>' + esc(day(b.date)) + '</b></p>' : '') + '<button class="btn" data-go="book2"' + (b.date ? '' : ' disabled') + '>Next</button></div>'
  }
  V.book2 = function () {
    var b = S.bk, h = HRS(), lo = earliest(b.date), hi = toMin(h.close), min = h.min_hours * 60, set = b.mode === 'set', maxLen = (toMin(b.wTo) - toMin(b.wFrom)) / 60
    var body = set
      ? '<div class="trow">' + sel('start', lo, hi - min, b.start, 'From') + sel('end', toMin(b.start) + min, hi, b.end, 'To') + '</div>' +
        '<p class="center"><b>' + esc(hrs(bkHours(b))) + '</b></p>' +
        '<p class="small muted">Anywhere from ' + esc(t12(h.open)) + ' to ' + esc(t12(h.close)) + ', ' + esc(hrs(h.min_hours)) + ' or more, by the half hour.</p>'
      : '<div class="q">Anytime between</div><div class="trow">' + sel('wFrom', lo, hi - min, b.wFrom, 'Earliest') + sel('wTo', toMin(b.wFrom) + min, hi, b.wTo, 'Latest') + '</div>' +
        '<div class="stepper"><div><div class="q">How long?</div><div class="small muted">At least ' + esc(hrs(h.min_hours)) + '</div></div><div class="ctl">' +
          '<button class="round" data-len="-0.5" aria-label="Less time"' + (b.len <= h.min_hours ? ' disabled' : '') + '>−</button><div class="hours">' + hrs(b.len) + '</div>' +
          '<button class="round fill" data-len="0.5" aria-label="More time"' + (b.len >= maxLen ? ' disabled' : '') + '>+</button></div></div>' +
        '<div class="note">The caregiver picks the exact start inside your window, so more caregivers can say yes. The exact time shows here once a caregiver confirms.</div>'
    return top('What time works?', { back: 'book1', step: 'Step 2 of ' + STEPS }) + '<div class="body">' + errBox() +
      '<p class="muted">' + esc(day(b.date)) + '</p>' +
      '<div class="seg" role="group" aria-label="Time choice"><button data-mode="set" aria-pressed="' + set + '">A set time</button><button data-mode="flex" aria-pressed="' + !set + '">I\'m flexible</button></div>' + body +
      '</div><div class="foot"><p class="center"><b>' + esc(whenLine(b)) + '</b></p><button class="btn" data-go="book3">Next</button></div>'
  }
  V.book3 = function () {
    var b = S.bk
    return top('What would help ' + S.home.client.name + '?', { back: 'book2', step: 'Step 3 of ' + STEPS }) + '<div class="body">' + errBox() +
      '<div class="small muted">Pick as many as you like</div><div class="tasks">' + S.home.tasks.map(function (t) {
        var on = b.tasks.indexOf(t) >= 0
        return '<button class="opt" data-task="' + esc(t) + '" aria-pressed="' + on + '"><span class="box">' + (on ? '<span style="color:#fff">' + ICON.check + '</span>' : '') + '</span>' + esc(t) + '</button>' }).join('') + '</div>' +
      '<div><label class="q" for="note">Anything the caregiver should know?</label><textarea id="note" maxlength="1000" placeholder="For example: Mom would love help making soup, and a short walk if it\'s nice out.">' + esc(b.note) + '</textarea></div>' +
      '</div><div class="foot"><button class="btn" data-act="to-book4"' + (b.tasks.length ? '' : ' disabled') + '>Next</button>' + (b.tasks.length ? '' : '<p class="center small muted">Pick at least one</p>') + '</div>'
  }
  V.book4 = function () {
    var b = S.bk, list = S.cgs || []
    return top('Who would you like to come?', { back: 'book3', step: 'Step 4 of ' + STEPS }) + '<div class="body">' + errBox() +
      (list.length ? '<p class="small muted">Pick one or more. We ask them first, and the first one who says yes is yours.</p>' : '') +
      '<div class="list">' + list.map(function (c) {
        var on = b.picks.indexOf(c.axiscare_id) >= 0
        return '<button class="opt" data-pickcg="' + esc(c.axiscare_id) + '" aria-pressed="' + on + '">' + avatar(c) + '<span style="flex:1"><b style="color:var(--navy)">' + esc(c.name) + '</b><br><span class="small muted">' + c.visits_together + ' visit' + (c.visits_together === 1 ? '' : 's') + ' together</span></span><span class="box">' + (on ? '<span style="color:#fff">' + ICON.check + '</span>' : '') + '</span></button>'
      }).join('') +
        '<button class="opt" data-pickcg="any" aria-pressed="' + b.any + '"><div class="avatar" aria-hidden="true">?</div><span style="flex:1"><b style="color:var(--navy)">Whoever is available</b><br><span class="small muted">The quickest way to get a yes</span></span><span class="box">' + (b.any ? '<span style="color:#fff">' + ICON.check + '</span>' : '') + '</span></button></div>' +
      '<p class="small muted">If none of your picks can make it, we offer the visit to other caregivers on our team so it still happens.</p>' +
      '</div><div class="foot"><button class="btn" data-go="book5"' + (b.picks.length || b.any ? '' : ' disabled') + '>Review</button></div>'
  }
  function pickNames(b) {
    var n = b.picks.map(function (id) { var c = (S.cgs || []).find(function (x) { return x.axiscare_id === id }); return c ? c.first_name : null }).filter(Boolean)
    return n.length < 3 ? n.join(' and ') : n.slice(0, -1).join(', ') + ' and ' + n[n.length - 1]
  }
  V.book5 = function () {
    var b = S.bk, h = bkHours(b), base = S.home.rate
    var extra = base && S.home.short_extra && h < (S.home.short_under_hours || 4) ? S.home.short_extra : 0, rate = base ? base + extra : null
    var whoTxt = b.picks.length ? 'Asking ' + pickNames(b) + ' first, then others on our team if needed' : 'Whoever is available'
    return top('Check and book', { back: 'book4', step: 'Step 5 of ' + STEPS }) + '<div class="body">' + errBox() +
      '<div class="card" style="gap:0;padding:4px 16px">' +
        '<div class="sum"><span class="muted">When</span><span class="v">' + esc(day(b.date)) + '<br>' + esc(whenLine(b)) + '</span></div>' +
        '<div class="sum"><span class="muted">Who</span><span class="v">' + esc(whoTxt) + '</span></div>' +
        '<div class="sum"><span class="muted">Help with</span><span class="v">' + esc(b.tasks.join(', ')) + '</span></div>' +
        (b.note ? '<div class="sum"><span class="muted">Note</span><span class="v">' + esc(b.note) + '</span></div>' : '') + '</div>' +
      '<div class="panel">' + (rate ? '<div style="display:flex;justify-content:space-between;align-items:baseline"><span>Estimated · ' + hrs(h) + ' × $' + money(rate) + '</span><span style="font-family:var(--serif);font-size:1.5em;font-weight:600;color:var(--navy)">$' + money(h * rate) + '</span></div>' +
          (extra ? '<p class="small muted">Visits under ' + (S.home.short_under_hours || 4) + ' hours are $' + money(extra) + ' more an hour, to cover drive time between visits.</p>' : '') : '') +
        '<p class="small muted">Nothing is charged today. The final amount, for the time the caregiver is actually there, shows on your weekly invoice with the other visits.</p></div>' +
      '<p class="small">Free to cancel up to 24 hours before.</p>' +
      '</div><div class="foot"><button class="btn" data-act="confirm"' + (S.busy ? ' disabled' : '') + '>' + (S.busy ? 'Booking…' : 'Book this visit') + '</button></div>'
  }
  V.done = function () {
    var d = S.done
    return '<div class="body center" style="padding-top:40px;display:flex;flex-direction:column;gap:14px"><div class="big-check">' + ICON.bigcheck + '</div>' +
      '<h1>' + (d.status === 'practice' ? 'Got it (practice)' : 'You\'re booked') + '</h1><p>' + esc(day(d.date)) + '<br><b>' + esc(d.when) + '</b></p>' +
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
    if (view === 'caregivers' || view === 'visits' || view === 'book1' || view === 'book4') {
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
    if (ds.date) { S.bk.date = ds.date; fixTimes(); return render() }
    if (ds.month) { var mm = new Date(S.bk.month + '-15T12:00:00Z'); mm.setUTCMonth(mm.getUTCMonth() + Number(ds.month)); S.bk.month = mm.toISOString().slice(0, 7); return render() }
    if (ds.mode) { S.bk.mode = ds.mode; return render() }
    if (ds.len) { var mx = (toMin(S.bk.wTo) - toMin(S.bk.wFrom)) / 60; S.bk.len = Math.max(HRS().min_hours, Math.min(mx, S.bk.len + Number(ds.len))); return render() }
    if (ds.pickcg) {
      var b = S.bk
      if (ds.pickcg === 'any') { b.any = !b.any; if (b.any) b.picks = [] }
      else { var k = b.picks.indexOf(ds.pickcg); if (k >= 0) b.picks.splice(k, 1); else if (b.picks.length < 5) { b.picks.push(ds.pickcg); b.any = false } }
      return render()
    }
    if (ds.task) { var i = S.bk.tasks.indexOf(ds.task); if (i >= 0) S.bk.tasks.splice(i, 1); else S.bk.tasks.push(ds.task); keepNote(); return render() }
    if (ds.size != null && el.classList.contains('chip')) { document.documentElement.setAttribute('data-size', ds.size); try { localStorage.setItem('cc_text_size', ds.size) } catch (x) { /* fine */ } return render() }
    if (ds.cancel) { S.confirmCancel = ds.cancel; return render() }
    if (ds.cancelNo) { S.confirmCancel = null; return render() }
    if (ds.cancelYes) return cancel(ds.cancelYes)
    var a = ds.act
    if (a === 'send' || a === 'resend') return sendCode()
    if (a === 'verify') return verify()
    if (a === 'other-email') { S.sent = false; S.err = ''; return render() }
    if (a === 'book') { newBooking(); return go('book1') }   // newBooking leaves date empty when nothing is bookable; book1 says so
    if (a === 'book-with') { newBooking(ds.id); return go('book1') }
    if (a === 'to-book4') { keepNote(); return go('book4') }
    if (a === 'confirm') return confirm()
    if (a === 'home-reload') { S.bookings = null; return load('home') }
    if (a === 'signout') { S.me = null; S.client = null; S.home = null; S.cgs = null; S.sent = false; if (sb) sb.auth.signOut(); S.view = 'signin'; return render() }
  })
  app.addEventListener('change', function (e) {
    var k = e.target.dataset && e.target.dataset.time
    if (!k || !S.bk) return
    S.bk[k] = e.target.value; fixTimes(); render()
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
    /* Her rule 2026-10-16: first check the email is on file for a current client (the Hub answers, and turns their app on);
       only then is a code emailed. Not on file: say so plainly, send nothing. */
    fetch(C.gateway, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'start', email: S.email }) })
      .then(function (res) { return res.json().catch(function () { return {} }) })
      .then(function (d) {
        if (!d || d.ok !== true) { S.busy = false; S.err = (d && d.error) || 'We couldn\'t check that just now. Please try again.'; return render() }
        return sb.auth.signInWithOtp({ email: S.email, options: { shouldCreateUser: false } }).then(function (r) {
          S.busy = false
          if (r.error) S.err = /rate|seconds|too many/i.test(r.error.message) ? 'Please wait a minute, then ask for a new code.' : 'We couldn\'t send the code. Please try again, or call us at (417) 234-8494.'
          else S.sent = true
          render()
        })
      })
      .catch(function () { S.busy = false; S.err = "We can't reach Caring Companions right now. Check your connection and try again."; render() })
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
    var when = b.mode === 'set' ? { kind: 'set', start: b.start, end: b.end } : { kind: 'flex', window_start: b.wFrom, window_end: b.wTo, hours: b.len }
    call('book', Object.assign({ date: b.date, tasks: b.tasks, note: b.note, who: b.picks.length ? 'preferred' : 'any', preferred: b.picks }, when)).then(function (r) {
      S.busy = false
      if (r.status !== 200) { S.err = r.data.error || 'Something went wrong. Nothing was booked.'; return render() }
      S.done = { date: b.date, when: whenLine(b), status: r.data.status, message: r.data.message }
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
