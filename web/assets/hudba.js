// Hudba – plovoucí přehrávač, který přežije navigaci (data-md-state).
(function () {
  "use strict";
  var ROOT_ID = "hudba-player";
  if (document.getElementById(ROOT_ID)) return;

  var LS = "montelien-hudba";
  var state = { vol: 60, preset: "taverna", playing: false, open: false, index: 0 };
  try { Object.assign(state, JSON.parse(localStorage.getItem(LS) || "{}")); } catch (e) {}
  function save() { try { localStorage.setItem(LS, JSON.stringify({ vol: state.vol, preset: state.preset, playing: state.playing, open: state.open })); } catch (e) {} }

  function base() {
    var s = document.querySelector('script[src*="assets/hudba.js"]');
    return s ? s.src.replace(/assets\/hudba\.js.*$/, "") : "/";
  }
  function esc(t) {
    return String(t == null ? "" : t).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  var root = document.createElement("div");
  root.id = ROOT_ID;
  root.setAttribute("data-md-state", "");
  root.innerHTML =
    '<button id="hudba-fab" class="hudba-fab" type="button" aria-label="Hudba" title="Hudba">' +
      '<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M12 3v10.6A4 4 0 1 0 14 17V7h4V3h-6zM6 19a2 2 0 1 1 0-4 2 2 0 0 1 0 4z"/></svg>' +
      '<span class="hudba-eq"><i></i><i></i><i></i></span>' +
    "</button>" +
    '<div id="hudba-panel" class="hudba-panel" hidden>' +
      '<div class="hudba-head">' +
        '<img id="hudba-thumb" class="hudba-thumb" alt="" hidden>' +
        '<div class="hudba-meta"><div id="hudba-title" class="hudba-title">Hudba z YouTube</div>' +
        '<div id="hudba-sub" class="hudba-sub">vyber preset a stiskni přehrát</div></div>' +
        '<button id="hudba-close" class="hudba-icn" type="button" aria-label="Sbalit" title="Sbalit">' +
          '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M7.4 8.6 12 13.2l4.6-4.6L18 10l-6 6-6-6z"/></svg>' +
        "</button>" +
      "</div>" +
      '<div class="hudba-controls">' +
        '<button id="hudba-prev" class="hudba-icn" type="button" aria-label="Předchozí" title="Předchozí skladba">' +
          '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M6 6h2v12H6zm3.5 6 8.5 6V6z"/></svg></button>' +
        '<button id="hudba-play" class="hudba-playbtn" type="button" aria-label="Přehrát" title="Přehrát / pauza">' +
          '<svg id="hudba-play-icn" viewBox="0 0 24 24" width="26" height="26" fill="currentColor"><path d="M8 5v14l11-7z"/></svg></button>' +
        '<button id="hudba-next" class="hudba-icn" type="button" aria-label="Další" title="Další skladba">' +
          '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M16 6h2v12h-2zM6 18l8.5-6L6 6z"/></svg></button>' +
        '<div class="hudba-vol">' +
          '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3a4.5 4.5 0 0 0-2.5-4v8a4.5 4.5 0 0 0 2.5-4z"/></svg>' +
          '<input id="hudba-vol" type="range" min="0" max="100" step="1">' +
        "</div>" +
      "</div>" +
      '<div id="hudba-presets" class="hudba-presets"></div>' +
    "</div>" +
    '<div id="hudba-yt" class="hudba-yt" aria-hidden="true"></div>';
  document.body.appendChild(root);

  var fab = document.getElementById("hudba-fab"),
      panel = document.getElementById("hudba-panel"),
      titleEl = document.getElementById("hudba-title"),
      subEl = document.getElementById("hudba-sub"),
      thumbEl = document.getElementById("hudba-thumb"),
      playIcn = document.getElementById("hudba-play-icn"),
      volEl = document.getElementById("hudba-vol"),
      presetsEl = document.getElementById("hudba-presets");

  var ICON_PLAY = "M8 5v14l11-7z", ICON_PAUSE = "M6 5h4v14H6zm8 0h4v14h-4z";
  function setPlayingUI(playing) {
    playIcn.innerHTML = "<path d='" + (playing ? ICON_PAUSE : ICON_PLAY) + "'/>";
    fab.classList.toggle("hudba-on", playing);
  }
  function setOpen(open) {
    state.open = open;
    panel.hidden = !open;
    fab.classList.toggle("hudba-open", open);
    save();
  }
  volEl.value = state.vol;

  // --- YouTube IFrame API (lazy) ---
  var player = null, ytReady = false, ytLoading = false, presets = null;
  function loadYT(cb) {
    if (ytReady) return cb();
    if (!ytLoading) {
      ytLoading = true;
      window.onYouTubeIframeAPIReady = function () { ytReady = true; cb(); };
      var s = document.createElement("script");
      s.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(s);
    }
  }
  function preset() {
    return (presets || []).find(function (p) { return p.id === state.preset; }) || (presets || [])[0];
  }
  function startPlayback() {
    var p = preset();
    if (!p) return;
    if (!player) {
      player = new YT.Player("hudba-yt", {
        width: 1, height: 1,
        playerVars: { autoplay: 0, controls: 0, disablekb: 1, fs: 0, iv_load_policy: 3, modestbranding: 1, playsinline: 1, rel: 0 },
        events: {
          onReady: function (e) { e.target.setVolume(state.vol); playPreset(); },
          onStateChange: onState,
          onError: function () { subEl.textContent = "skladbu nelze přehrát, zkouším další…"; if (player && player.nextVideo) player.nextVideo(); }
        }
      });
    } else {
      playPreset();
    }
  }
  function playPreset() {
    var p = preset();
    if (!p) return;
    try {
      if (p.list) player.loadPlaylist({ list: p.list, listType: "playlist", index: 0, suggestedQuality: "small" });
      else player.loadVideoById(p.videoId);
      player.setVolume(state.vol);
      player.playVideo();
    } catch (e) {
      try { player.loadVideoById(p.videoId); } catch (e2) {}
    }
    subEl.textContent = p.nazev;
  }
  function onState(e) {
    var YS = YT.PlayerState;
    if (e.data === YS.PLAYING) {
      state.playing = true; setPlayingUI(true); save();
      var d = player.getVideoData ? player.getVideoData() : null;
      if (d && d.title) { titleEl.textContent = d.title; thumbEl.src = "https://i.ytimg.com/vi/" + d.video_id + "/mqdefault.jpg"; thumbEl.hidden = false; }
    } else if (e.data === YS.PAUSED) {
      state.playing = false; setPlayingUI(false); save();
    } else if (e.data === YS.ENDED) {
      var list = player.getPlaylist ? player.getPlaylist() : null;
      if (!list || !list.length) { state.playing = false; setPlayingUI(false); save(); }
    }
  }
  function togglePlay() {
    if (!player) { startPlayback(); return; }
    try {
      var st = player.getPlayerState();
      if (st === YT.PlayerState.PLAYING) player.pauseVideo(); else player.playVideo();
    } catch (e) {}
  }

  // --- UI events ---
  fab.addEventListener("click", function () {
    if (!panel.hidden) { setOpen(false); return; }
    setOpen(true);
    if (!presets) {
      fetch(base() + "assets/hudba_presety.json").then(function (r) { return r.json(); }).then(function (d) {
        presets = d;
        renderPresets();
      }).catch(function () { presets = []; });
    }
  });
  document.getElementById("hudba-close").addEventListener("click", function () { setOpen(false); });
  document.getElementById("hudba-play").addEventListener("click", function () { loadYT(function () { startPlayback(); if (player) togglePlay(); }); });
  document.getElementById("hudba-next").addEventListener("click", function () { if (player && player.nextVideo) player.nextVideo(); });
  document.getElementById("hudba-prev").addEventListener("click", function () { if (player && player.previousVideo) player.previousVideo(); });
  volEl.addEventListener("input", function () {
    state.vol = +volEl.value; save();
    if (player && player.setVolume) player.setVolume(state.vol);
  });

  function renderPresets() {
    presetsEl.innerHTML = "";
    (presets || []).forEach(function (p) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "hudba-chip" + (p.id === state.preset ? " aktivni" : "");
      b.textContent = p.nazev;
      b.title = p.popis || p.nazev;
      b.addEventListener("click", function () {
        state.preset = p.id; save();
        presetsEl.querySelectorAll(".hudba-chip").forEach(function (c) { c.classList.toggle("aktivni", c === b); });
        subEl.textContent = p.nazev;
        if (player) { playPreset(); }
      });
      presetsEl.appendChild(b);
    });
  }

  // Obnova stavu po plném načtení stránky (při instant navigaci player trvá dál).
  if (state.open) setOpen(true);
  if (state.playing) {
    fab.classList.add("hudba-resume");
    subEl.textContent = "klikni na ▶ pro pokračování hudby";
    setOpen(true);
  }
})();
