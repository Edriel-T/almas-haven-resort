/**
 * Google tag (Analytics / Ads / Google tag)
 * ------------------------------------------------
 * WHY Google says "tag wasn't detected":
 *   The site had no gtag.js until this file was added. Google only finds the tag
 *   after you paste your real ID below, deploy, and re-test the LIVE domain.
 *
 * Setup:
 * 1. Google Analytics → Admin → Data streams → your web stream → copy Measurement ID
 *    (looks like G-XXXXXXXXXX). Or use a Google tag ID GT-XXXXXXXX.
 * 2. Paste it in MEASUREMENT_ID below (keep the quotes).
 * 3. Commit/deploy, open https://almashaven.edrielcabansi.com/ hard-refresh.
 * 4. In Google: Test again (or Tag Assistant). Allow a few minutes.
 *
 * This ID appears in public HTML (normal). Not a secret password.
 * Never put Firebase API keys or service accounts here.
 */
(function () {
  // Alma's Haven GA4 Measurement ID
  var MEASUREMENT_ID = "G-X11CX1VS59";

  var cfg = window.ALMA_GOOGLE_TAG || {};
  var fromConfig =
    (window.ALMA_CONFIG &&
      (window.ALMA_CONFIG.googleAnalyticsId || window.ALMA_CONFIG.googleTagId)) ||
    "";
  var id = String(
    MEASUREMENT_ID || cfg.measurementId || cfg.id || fromConfig || ""
  ).trim();

  if (!id) return;
  try {
    if (/admin\.html$/i.test(location.pathname || "")) return;
  } catch (e) {
    /* ignore */
  }

  if (!/^(G|GT|AW|DC)-[A-Z0-9]+$/i.test(id)) {
    console.warn(
      "[AlmaGoogleTag] Invalid tag id (expected G-… / GT-… / AW-…):",
      id
    );
    return;
  }

  if (window.__almaGtagInstalled === id) return;
  window.__almaGtagInstalled = id;

  window.dataLayer = window.dataLayer || [];
  function gtag() {
    window.dataLayer.push(arguments);
  }
  window.gtag = window.gtag || gtag;

  gtag("js", new Date());
  gtag("config", id, {
    anonymize_ip: true,
    send_page_view: true,
  });

  var extra = String(cfg.adsId || cfg.googleAdsId || "").trim();
  if (extra && /^(AW|G|GT)-[A-Z0-9]+$/i.test(extra) && extra !== id) {
    gtag("config", extra);
  }

  var s = document.createElement("script");
  s.async = true;
  s.src =
    "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(id);
  var first = document.getElementsByTagName("script")[0];
  if (first && first.parentNode) first.parentNode.insertBefore(s, first);
  else (document.head || document.documentElement).appendChild(s);
})();
