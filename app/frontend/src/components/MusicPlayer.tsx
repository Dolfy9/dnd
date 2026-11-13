import { useEffect, useRef, useState } from "react";
import { get } from "../api";

declare global { interface Window { YT?: any; onYouTubeIframeAPIReady?: () => void } }

const LS = "montelien-hudba";
type Preset = { id: string; name: string; video_id: string; list_id: string; note: string };

const load = () => { try { return JSON.parse(localStorage.getItem(LS) || "{}"); } catch { return {}; } };
const save = (s: any) => { try { localStorage.setItem(LS, JSON.stringify(s)); } catch {} };

export default function MusicPlayer() {
  const [open, setOpen] = useState(!!load().open);
  const [playing, setPlaying] = useState(false);
  const [vol, setVol] = useState<number>(load().vol ?? 60);
  const [presetId, setPresetId] = useState<string>(load().preset || "");
  const [presets, setPresets] = useState<Preset[]>([]);
  const [title, setTitle] = useState("Hudba z YouTube");
  const [sub, setSub] = useState("vyber preset a stiskni přehrát");
  const [thumb, setThumb] = useState("");
  const playerRef = useRef<any>(null);
  const ytReady = useRef(false);
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => { get<any>("/api/admin/music").then((d) => {
    setPresets(d.items || []);
    if (!presetId && d.items?.length) setPresetId(d.items[0].id);
  }); }, []); // eslint-disable-line

  const preset = () => presets.find((p) => p.id === presetId) || presets[0];

  const ensureYT = (cb: () => void) => {
    if (ytReady.current || window.YT?.Player) { ytReady.current = true; return cb(); }
    if (!window.onYouTubeIframeAPIReady) {
      window.onYouTubeIframeAPIReady = () => { ytReady.current = true; cb(); };
      const s = document.createElement("script");
      s.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(s);
    } else {
      const old = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => { old(); ytReady.current = true; cb(); };
    }
  };

  const playPreset = () => {
    const p = preset(); if (!p || !playerRef.current) return;
    try {
      if (p.list_id) playerRef.current.loadPlaylist({ list: p.list_id, listType: "playlist", index: 0 });
      else playerRef.current.loadVideoById(p.video_id);
      playerRef.current.setVolume(vol); playerRef.current.playVideo();
    } catch { try { playerRef.current.loadVideoById(p.video_id); } catch { /* noop */ } }
    setSub(p.name + (p.note ? ` · ${p.note}` : ""));
  };

  const start = () => ensureYT(() => {
    if (playerRef.current) return playPreset();
    playerRef.current = new window.YT.Player(hostRef.current, {
      width: 1, height: 1,
      playerVars: { autoplay: 0, controls: 0, disablekb: 1, fs: 0, iv_load_policy: 3, modestbranding: 1, playsinline: 1, rel: 0 },
      events: {
        onReady: (e: any) => { e.target.setVolume(vol); playPreset(); },
        onStateChange: (e: any) => {
          const YS = window.YT.PlayerState;
          if (e.data === YS.PLAYING) {
            setPlaying(true); save({ vol, preset: presetId, open });
            const d = playerRef.current.getVideoData?.();
            if (d?.title) { setTitle(d.title); setThumb(`https://i.ytimg.com/vi/${d.video_id}/mqdefault.jpg`); }
          } else if (e.data === YS.PAUSED || e.data === YS.ENDED) setPlaying(false);
        },
        onError: () => { setSub("skladbu nelze přehrát, zkouším další…"); playerRef.current?.nextVideo?.(); },
      },
    });
  });

  const toggle = () => {
    if (!playerRef.current) return start();
    const st = playerRef.current.getPlayerState?.();
    if (st === window.YT.PlayerState.PLAYING) playerRef.current.pauseVideo();
    else playerRef.current.playVideo();
  };
  const changeVol = (v: number) => { setVol(v); playerRef.current?.setVolume?.(v); save({ vol: v, preset: presetId, open }); };
  const choose = (id: string) => { setPresetId(id); save({ vol, preset: id, open }); if (playerRef.current) { const p = presets.find((x) => x.id === id); if (p) setPresetId(id); setTimeout(playPreset, 0); } };

  return (
    <>
      <div ref={hostRef} className="fixed w-px h-px -left-[9999px] -top-[9999px]" aria-hidden />
      <button onClick={() => { setOpen(!open); save({ vol, preset: presetId, open: !open }); }}
        className={"mus-fab" + (playing ? " mus-on" : "")} title="Hudba" aria-label="Hudba">
        ♪<span className="mus-eq"><i /><i /><i /></span>
      </button>
      {open && (
        <div className="mus-panel card font-ui fade-in">
          <div className="flex items-center gap-2 p-2.5 border-b border-[var(--line)]">
            {thumb ? <img src={thumb} className="w-9 h-9 rounded object-cover" alt="" /> : <div className="w-9 h-9 rounded bg-[var(--bg-3)]" />}
            <div className="flex-1 min-w-0">
              <div className="text-xs font-bold truncate">{title}</div>
              <div className="text-[11px] text-[var(--ink-3)] truncate">{sub}</div>
            </div>
            <button className="btn sm" onClick={() => { setOpen(false); save({ vol, preset: presetId, open: false }); }}>▾</button>
          </div>
          <div className="flex items-center gap-2 px-2.5 py-2">
            <button className="btn sm" onClick={() => playerRef.current?.previousVideo?.()} title="Předchozí">⏮</button>
            <button className="btn sm !text-base" onClick={toggle} title="Přehrát / pauza">{playing ? "⏸" : "▶"}</button>
            <button className="btn sm" onClick={() => playerRef.current?.nextVideo?.()} title="Další">⏭</button>
            <input type="range" min={0} max={100} value={vol} onChange={(e) => changeVol(Number(e.target.value))} className="flex-1" />
          </div>
          <div className="max-h-44 overflow-y-auto border-t border-[var(--line)]">
            {presets.map((p) => (
              <button key={p.id} onClick={() => choose(p.id)}
                className={"w-full text-left px-3 py-1.5 text-xs hover:bg-[var(--accent-soft)]" + (p.id === presetId ? " font-bold text-[var(--accent-2)]" : "")}>
                {p.name}{p.note ? <span className="text-[var(--ink-3)]"> · {p.note}</span> : null}
              </button>
            ))}
            {!presets.length && <div className="px-3 py-2 text-xs text-[var(--ink-3)]">Žádné presety.</div>}
          </div>
        </div>
      )}
    </>
  );
}
