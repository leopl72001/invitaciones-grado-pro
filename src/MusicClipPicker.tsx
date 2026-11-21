import { useEffect, useRef, useState, type ChangeEvent, type CSSProperties, type PointerEvent as ReactPointerEvent, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { Music2, Pause, Play, Scissors, Upload, Volume2 } from 'lucide-react';
import './MusicClipPicker.css';
import { isYouTubeAddress, youtubeVideoId, YouTubeClipEmbed } from './youtube';

const MAX_CLIP_SECONDS = 30;
const timeLabel = (seconds: number) => {
  const s = Math.max(0, Math.floor(Number(seconds) || 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function isAudioSource(value: string) {
  try {
    const url = new URL(value.trim());
    if (!['http:', 'https:'].includes(url.protocol)) return false;
    return !/(^|\.)(youtube\.com|youtu\.be|spotify\.com|music\.apple\.com|instagram\.com|soundcloud\.com|deezer\.com|tidal\.com)$/i.test(url.hostname);
  } catch { return false; }
}

function TimeFields({ title, seconds, onChange }: { title: string; seconds: number; onChange: (seconds: number) => void }) {
  return <fieldset className="clip-time-fields">
    <legend>{title}</legend>
    <label>Minutos<input aria-label={`${title}: minutos`} type="number" min="0" max="999" step="1" value={Math.floor(seconds / 60)} onChange={e => onChange(Math.max(0, Number(e.target.value) || 0) * 60 + (seconds % 60))} /></label>
    <span className="clip-time-colon">:</span>
    <label>Segundos<input aria-label={`${title}: segundos`} type="number" min="0" max="59" step="1" value={seconds % 60} onChange={e => onChange(Math.floor(seconds / 60) * 60 + clamp(Number(e.target.value) || 0, 0, 59))}/></label>
  </fieldset>;
}

function SelectionTimeline({ start, end, maximum, onStart, onEnd, onRange, label }: {
  start: number; end: number; maximum: number;
  onStart: (n: number) => void; onEnd: (n: number) => void;
  onRange: (start: number, end: number) => void; label: string;
}) {
  const max = Math.max(1, Math.floor(maximum));
  const rail = useRef<HTMLDivElement>(null);
  const dragging = useRef<null | { pointer: number; mode: 'start' | 'end' | 'selection'; origin: number; start: number; end: number }>(null);
  const toSecond = (x: number) => {
    const rect = rail.current?.getBoundingClientRect();
    if (!rect || rect.width < 1) return start;
    return clamp(Math.round((x - rect.left) / rect.width * max), 0, max);
  };
  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!event.isPrimary || (event.pointerType === 'mouse' && event.button !== 0)) return;
    const rect = rail.current?.getBoundingClientRect();
    if (!rect) return;
    const position = toSecond(event.clientX);
    const xStart = rect.left + start / max * rect.width;
    const xEnd = rect.left + end / max * rect.width;
    const explicit = (event.target as HTMLElement).closest<HTMLElement>('[data-clip-edge]')?.dataset.clipEdge;
    let mode: 'start' | 'end' | 'selection';
    if (explicit === 'start' || explicit === 'end') mode = explicit;
    else if (Math.abs(event.clientX - xStart) <= 23 || Math.abs(event.clientX - xEnd) <= 23) {
      mode = Math.abs(event.clientX - xStart) <= Math.abs(event.clientX - xEnd) ? 'start' : 'end';
    } else if (position > start && position < end) mode = 'selection';
    else mode = Math.abs(position - start) <= Math.abs(position - end) ? 'start' : 'end';
    dragging.current = { pointer: event.pointerId, mode, origin: position, start, end };
    event.currentTarget.setPointerCapture(event.pointerId);
    if (mode === 'start') onStart(position);
    if (mode === 'end') onEnd(position);
    event.preventDefault();
  };
  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragging.current;
    if (!drag || drag.pointer !== event.pointerId) return;
    const position = toSecond(event.clientX);
    if (drag.mode === 'start') onStart(position);
    else if (drag.mode === 'end') onEnd(position);
    else {
      const duration = drag.end - drag.start;
      const nextStart = clamp(drag.start + position - drag.origin, 0, Math.max(0, max - duration));
      onRange(nextStart, nextStart + duration);
    }
  };
  const onPointerEnd = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (dragging.current?.pointer === event.pointerId) dragging.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  const onHandleKeyDown = (edge: 'start' | 'end', event: ReactKeyboardEvent<HTMLButtonElement>) => {
    const value = edge === 'start' ? start : end;
    let next: number;
    if (event.key === 'ArrowRight' || event.key === 'ArrowUp') next = value + 1;
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') next = value - 1;
    else if (event.key === 'PageUp') next = value + 5;
    else if (event.key === 'PageDown') next = value - 5;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = max;
    else return;
    event.preventDefault();
    if (edge === 'start') onStart(clamp(next, 0, max));
    else onEnd(clamp(next, 0, max));
  };
  const trackStyle = {
    '--clip-left': `${start / max * 100}%`,
    '--clip-width': `${Math.max(0, end - start) / max * 100}%`,
    '--clip-end': `${end / max * 100}%`,
  } as CSSProperties;
  return <div className="clip-range-editor">
    <div className="clip-range-labels"><span>INICIO <strong>{timeLabel(start)}</strong></span><span>FIN <strong>{timeLabel(end)}</strong></span></div>
    <div className="clip-dual-range" style={trackStyle}>
      <div ref={rail} className="clip-dual-hitarea" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerEnd} onPointerCancel={onPointerEnd}>
        <div className="clip-dual-track"/>
        <div className="clip-dual-selected"/>
        <button type="button" className="clip-drag-handle clip-drag-handle-start" data-clip-edge="start" role="slider"
          tabIndex={0} aria-label={`Arrastrar inicio de ${label}`} aria-valuemin={0} aria-valuemax={max} aria-valuenow={start} aria-valuetext={timeLabel(start)}
          onKeyDown={e => onHandleKeyDown('start', e)}><span className="clip-handle-bars" /></button>
        <button type="button" className="clip-drag-handle clip-drag-handle-end" data-clip-edge="end" role="slider"
          tabIndex={0} aria-label={`Arrastrar fin de ${label}`} aria-valuemin={0} aria-valuemax={max} aria-valuenow={end} aria-valuetext={timeLabel(end)}
          onKeyDown={e => onHandleKeyDown('end', e)}><span className="clip-handle-bars" /></button>
      </div>
    </div>
    <div className="clip-timeline"><span>0:00</span><span>Arrastra los extremos dorados o toda la franja para moverla</span><span>{timeLabel(max)}</span></div>
    <div className="clip-independent-sliders">
      <label>Arrastrar inicio <strong>{timeLabel(start)}</strong>
        <input type="range" aria-label={`Seleccionar inicio de ${label}`} min={0} max={max} step={1} value={start} onChange={e => onStart(Number(e.currentTarget.value))}/>
      </label>
      <label>Arrastrar final <strong>{timeLabel(end)}</strong>
        <input type="range" aria-label={`Seleccionar final de ${label}`} min={0} max={max} step={1} value={end} onChange={e => onEnd(Number(e.currentTarget.value))}/>
      </label>
    </div>
  </div>;
}

type Props = {
  label: string;
  value: string;
  start: number;
  end: number;
  onValue: (url: string) => void;
  onRange: (start: number, end: number) => void;
  onUpload: (file: File) => void;
  uploading: boolean;
};

export default function MusicClipPicker({ label, value, start, end, onValue, onRange, onUpload, uploading }: Props) {
  const audio = useRef<HTMLAudioElement>(null);
  const picker = useRef<HTMLInputElement>(null);
  const [duration, setDuration] = useState<number | null>(null);
  const [progress, setProgress] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [audioError, setAudioError] = useState('');
  const youtubeId = youtubeVideoId(value);
  const youtubeLink = isYouTubeAddress(value);
  const validLink = !youtubeLink && isAudioSource(value);
  const maxStart = duration === null ? Infinity : Math.max(0, Math.floor(duration) - 1);
  const selectedStart = clamp(Math.floor(Number(start) || 0), 0, maxStart);
  const requestedEnd = Number(end);
  const selectedEnd = Math.min(duration ?? Infinity, selectedStart + MAX_CLIP_SECONDS, Math.max(selectedStart + 1, Number.isFinite(requestedEnd) && requestedEnd > selectedStart ? Math.floor(requestedEnd) : selectedStart + MAX_CLIP_SECONDS));
  const clipLength = Math.max(0, selectedEnd - selectedStart);
  const timelineMax = duration !== null ? Math.max(1, Math.floor(duration)) : Math.max(300, Math.ceil(Math.max(selectedEnd + 30, 1) / 60) * 60);

  useEffect(() => {
    setDuration(null); setPlaying(false); setProgress(0); setAudioError('');
    if (audio.current) audio.current.pause();
  }, [value]);
  useEffect(() => {
    const element = audio.current;
    if (!element || !Number.isFinite(element.duration)) return;
    if (!playing) {
      try { element.currentTime = selectedStart; } catch { /* Aún sin datos para buscar */ }
    }
  }, [selectedStart, selectedEnd, duration, playing]);

  const resetPreview = () => { audio.current?.pause(); setPlaying(false); setProgress(0); };
  const changeStart = (second: number) => {
    const wanted = clamp(Math.round(second), 0, maxStart);
    const length = Math.max(1, Math.min(MAX_CLIP_SECONDS, clipLength || MAX_CLIP_SECONDS));
    if (wanted >= selectedEnd || selectedEnd - wanted > MAX_CLIP_SECONDS) {
      onRange(wanted, Math.min(duration ?? Infinity, wanted + length));
    } else onRange(wanted, selectedEnd);
    resetPreview();
  };
  const changeEnd = (second: number) => {
    const wanted = clamp(Math.round(second), 1, duration ?? Infinity);
    const length = Math.max(1, Math.min(MAX_CLIP_SECONDS, clipLength || MAX_CLIP_SECONDS));
    if (wanted <= selectedStart || wanted - selectedStart > MAX_CLIP_SECONDS) {
      onRange(Math.max(0, wanted - length), wanted);
    } else onRange(selectedStart, wanted);
    resetPreview();
  };
  const changeRange = (nextStart: number, nextEnd: number) => { onRange(nextStart, nextEnd); resetPreview(); };
  const preview = async () => {
    const element = audio.current;
    if (!element || !validLink) return;
    if (playing) { element.pause(); setPlaying(false); return; }
    try {
      if (element.currentTime < selectedStart || element.currentTime >= selectedEnd - 0.05) { element.currentTime = selectedStart; setProgress(0); }
      await element.play(); setPlaying(true); setAudioError('');
    } catch { setPlaying(false); setAudioError('No se pudo reproducir este enlace. Usa un MP3/M4A/OGG directo o un archivo autorizado.'); }
  };
  const range = <>
    <div className="clip-time-editor">
      <TimeFields title="Inicio" seconds={selectedStart} onChange={changeStart}/>
      <TimeFields title="Fin" seconds={selectedEnd} onChange={changeEnd}/>
      <div className="clip-duration-pill">Duración seleccionada <strong>{timeLabel(clipLength)} / 0:30</strong></div>
    </div>
    <SelectionTimeline label={label} start={selectedStart} end={selectedEnd} maximum={timelineMax} onStart={changeStart} onEnd={changeEnd} onRange={changeRange}/>
  </>;

  const waveform = Array.from({ length: 90 }, (_, i) => {
    const h = 15 + ((i * 41 + i * i * 11) % 66);
    const position = duration ? (i / 90) * duration : 0;
    const active = duration !== null && position >= selectedStart && position <= selectedEnd;
    return <span key={i} className={active ? 'clip-wave-active' : ''} style={{ height: `${h}%` }} />;
  });
  const selectStyle = {
    '--clip-left': `${duration ? selectedStart / duration * 100 : 0}%`,
    '--clip-width': `${duration ? Math.max(0, selectedEnd - selectedStart) / duration * 100 : 100}%`
  } as CSSProperties;

  return <div className="music-clip-editor">
    <div className="asset-head"><strong>{label}</strong><span>Elige el inicio y el final · máximo 30 segundos</span></div>
    <div className="asset-control">
      <div className="asset-input-icon"><Music2 size={18}/></div>
      <input aria-label={`Enlace de audio para ${label}`} type="url" value={value} placeholder="Pega un enlace de YouTube o MP3 / M4A / OGG" onChange={e => onValue(e.target.value)}/>
      <input ref={picker} hidden type="file" accept="audio/*,.mp3,.m4a,.ogg,.wav" onChange={(e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]; if (file) onUpload(file); e.target.value = '';
      }}/>
      <button type="button" className="outline-button" disabled={uploading} onClick={() => picker.current?.click()}><Upload size={16}/>{uploading ? 'Subiendo...' : 'Subir'}</button>
    </div>
    {!!value && !validLink && !youtubeId && <p className="clip-warning">{youtubeLink ? 'Este enlace de YouTube no contiene un video válido. Copia el enlace de un video específico (no una playlist).' : 'Este enlace no es audio reproducible. Usa YouTube o un enlace directo a MP3, M4A u OGG.'}</p>}
    {youtubeId && <div className="clip-workspace clip-youtube-workspace">
      <div className="clip-tool-title"><span><Scissors size={16}/> EDITA TU FRAGMENTO DE YOUTUBE</span><span>Máximo 0:30</span></div>
      <p className="youtube-clip-intro">Elige dónde comienza y termina la canción con los dos marcadores dorados o escribiendo los minutos y segundos. Puedes seleccionar un fragmento más corto de 30 segundos.</p>
      {range}
      <YouTubeClipEmbed id={youtubeId} start={selectedStart} end={selectedEnd} title={`Escuchar fragmento de ${label}`}/>
      <p className="clip-save-help">Pulsa <strong>Play dentro del video</strong> para escuchar desde {timeLabel(selectedStart)} hasta {timeLabel(selectedEnd)}. Guarda los cambios para aplicar este mismo fragmento a las invitaciones. Algunos videos no permiten inserción.</p>
    </div>}
    {validLink && <>
      <audio ref={audio} src={value} preload="metadata" onLoadedMetadata={e => {
        const length = e.currentTarget.duration;
        if (Number.isFinite(length) && length >= 1) {
          setDuration(length);
          const nextStart = clamp(selectedStart, 0, Math.max(0, Math.floor(length) - 1));
          if (nextStart !== start || end > length) onRange(nextStart, Math.min(Math.floor(length), Math.max(nextStart + 1, end)));
          try { e.currentTarget.currentTime = nextStart; } catch { /* aún sin disponibilidad */ }
        } else setAudioError('El audio no tiene una duración suficiente para seleccionar el fragmento.');
      }} onTimeUpdate={e => {
        const element = e.currentTarget;
        const elapsed = Math.max(0, element.currentTime - selectedStart);
        setProgress(Math.min(clipLength, elapsed));
        if (element.currentTime >= selectedEnd - 0.05 || (duration !== null && element.currentTime >= duration - 0.01)) {
          element.pause(); setPlaying(false);
        }
      }} onEnded={() => setPlaying(false)} onError={() => {
        setAudioError('No se pudo cargar ese enlace como audio. Comprueba que sea público y directo al archivo.');
        setPlaying(false);
      }}/>
      <div className="clip-workspace">
        <div className="clip-tool-title"><span><Scissors size={16}/> RECORTA TU CANCIÓN</span><span>{duration === null ? 'Cargando duración…' : `Audio completo: ${timeLabel(duration)}`}</span></div>
        <div className="clip-waveform" style={selectStyle} aria-hidden="true"><div className="clip-wave-bars">{waveform}</div><div className="clip-selection"><span className="clip-grip">Ⅱ</span><span className="clip-grip">Ⅱ</span></div></div>
        {range}
        <div className="clip-footer">
          <button type="button" className="clip-play" onClick={() => void preview()} disabled={duration === null}><span>{playing ? <Pause size={17} fill="currentColor"/> : <Play size={17} fill="currentColor"/>}</span>{playing ? 'Pausar' : 'Escuchar recorte'}</button>
          <div className="clip-segment"><span>Inicio <strong>{timeLabel(selectedStart)}</strong></span><span>Fin <strong>{timeLabel(selectedEnd)}</strong></span><span><Volume2 size={15}/>{timeLabel(progress)} / {timeLabel(clipLength)}</span></div>
        </div>
        {audioError && <p className="clip-warning" role="alert">{audioError}</p>}
        <p className="clip-save-help">Cuando termines de elegir inicio y fin, pulsa <strong>Guardar cambios</strong>. El archivo original no se modifica.</p>
      </div>
    </>}
  </div>;
}