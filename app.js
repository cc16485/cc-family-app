// 2026-11-07: the Booking App is no longer offered by Caring Companions. Any old copy of the page that still loads
// this file shows the same closed message as index.html.
(function () {
  var el = document.getElementById('app') || document.body
  el.innerHTML = '<div style="max-width:460px;margin:48px auto;padding:0 16px;text-align:center;font-family:Inter,Helvetica,Arial,sans-serif">' +
    '<h1 style="font-size:24px;color:#0D365F">The Booking App is no longer available</h1>' +
    '<p style="color:#55677a">Caring Companions no longer offers the Booking App. To ask about care or a visit, please call our office.</p>' +
    '<p><a href="tel:+14172348494" style="color:#1F7A8C;font-weight:700">Call (417) 234-8494</a></p></div>'
})()
