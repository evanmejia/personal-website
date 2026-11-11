/* Evan Mejia — personal site
   Vanilla JS: theme switch (persisted, system-aware), footer year, and a
   placeholder contact-form handler. */
(function () {
  "use strict";

  var root = document.documentElement;
  var toggle = document.getElementById("theme-toggle");
  var media = window.matchMedia("(prefers-color-scheme: dark)");

  function apply(theme) {
    root.dataset.theme = theme;
    if (toggle) {
      toggle.checked = theme === "dark";
    }
  }

  // Initial theme is set by an inline <head> script before first paint.
  apply(root.dataset.theme === "dark" ? "dark" : "light");

  if (toggle) {
    toggle.addEventListener("change", function () {
      var next = toggle.checked ? "dark" : "light";
      try {
        localStorage.setItem("theme", next);
      } catch (e) {
        /* private mode — theme just won't persist */
      }
      apply(next);
    });
  }

  // Follow system changes until the user makes an explicit choice.
  var onSystemChange = function (e) {
    var stored = null;
    try {
      stored = localStorage.getItem("theme");
    } catch (e2) {
      /* ignore */
    }
    if (!stored) {
      apply(e.matches ? "dark" : "light");
    }
  };
  if (media.addEventListener) {
    media.addEventListener("change", onSystemChange);
  } else if (media.addListener) {
    media.addListener(onSystemChange); // older Safari
  }

  var year = document.getElementById("year");
  if (year) {
    year.textContent = String(new Date().getFullYear());
  }

  // Status pill (index.html sidebar). Reads status.json, which
  // tools/update-status.mjs rewrites from cal.com bookings.
  // On any failure the hardcoded green pill in the markup stays.
  var statusEl = document.getElementById("status");
  if (statusEl) {
    fetch("status.json", { cache: "no-store" })
      .then(function (res) {
        if (!res.ok) {
          throw new Error("status.json fetch failed: " + res.status);
        }
        return res.json();
      })
      .then(function (status) {
        if (status.status && status.label) {
          statusEl.className = "status-pill status-pill--" + status.status;
          statusEl.textContent = status.label;
        }
      })
      .catch(function () {
        /* keep the fallback pill */
      });
  }
})();
