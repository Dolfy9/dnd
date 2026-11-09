(function () {
  "use strict";
  var form = document.getElementById("znalosti-search");
  if (!form) return;
  form.addEventListener("submit", function (event) {
    event.preventDefault();
    var query = form.querySelector("input").value.trim();
    if (!query) return;
    var input = window.innerWidth <= 600
      ? document.querySelector("#nav-mobile-search input") || document.querySelector(".md-search__input")
      : document.querySelector(".md-search__input") || document.querySelector("#nav-mobile-search input");
    if (!input) {
      location.href = "/search/?q=" + encodeURIComponent(query);
      return;
    }
    input.value = query;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.focus();
    var searchForm = input.closest("form");
    if (searchForm && searchForm.requestSubmit) searchForm.requestSubmit();
    else location.href = "/search/?q=" + encodeURIComponent(query);
  });
  form.querySelector("input").addEventListener("keydown", function (event) {
    if (event.key === "Enter") {
      event.preventDefault();
      form.requestSubmit();
    }
  });
})();
