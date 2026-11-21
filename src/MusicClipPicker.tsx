import { useEffect, useRef, useState, type ChangeEvent, type CSSProperties } from 'react';
import { Music2, Pause, Play, Scissors, Upload, Volume2 } from 'lucide-react';
import './MusicClipPicker.css';

const CLIP_SECONDS = 30;

function isAudioSource(value: string) {
  try {
    const url = new URL(value.trim());
    if (!['http:', 'https:'].includes(url.protocol)) return false;
    // Music catalog links are web pages, not direct, playable audio files.
    return !/(^|\.)(youtube\.com|youtu\.be|spotify\.com|music\.apple\.com|instagram\.com|soundcloud\.com|deezer\.com|tidal\.com)$/i.test(url.hostname);
  } catch { return false; }
}
function timeLabel(seconds: number) {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

type Props = {
  label: string;
  value: string;
  start: number;
  onValue: (url: string) => void;
  onStart: (seconds: number) => void;
  onUpload: (file: File) => void;
  uploading: boolean;
};

export default function MusicClipPicker({ label, value, start, onValue, onStart, onUpload, uploading }: Props) {
  const audio = useRef<HTMLAudioElement>(null);
  const picker = useRef<HTMLInputElement>(null);
  const [duration, setDuration] = useState<number | null>(null);
  const [progress, setProgress] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [audioError, setAudioError] = useState('');
  const validLink = isAudioSource(value);
  const maxStart = duration === null ? 0 : Math.max(0, duration - CLIP_SECONDS);
  const selectedStart = Math.min(Math.max(0, Number(start) || 0), maxStart);

  useEffect(() => {
    setDuration(null);
    setPlaying(false);
    setProgress(0);
    setAudioError('');
    if (audio.current) audio.current.pause();
  }, [value]);

  useEffect(() => {
    const element = audio.current;
    if (!element || !Number.isFinite(element.duration)) return;
    if (element.currentTime !== selectedStart && !playing) {
      try { element.currentTime = selectedStart; } catch { /* Not seekable yet */ }
    }
  }, [selectedStart, duration, playing]);

  const chooseStart = (second: number) => {
    const s = Math.min(maxStart, Math.max(0, second));
    onStart(Math.round(s));
    setProgress(0);
    const element = audio.current;
    if (element) {
      element.pause();
      setPlaying(false);
      try { element.currentTime = s; } catch { /* Metadata not ready */ }
    }
  };
  const preview = async () => {
    const element = audio.current;
    if (!element || !validLink) return;
    if (playing) { element.pause(); setPlaying(false); return; }
    try {
      if (element.currentTime < selectedStart || element.currentTime >= selectedStart + CLIP_SECONDS - 0.05) {
        element.currentTime = selectedStart;
        setProgress(0);
      }
      await element.play();
      setPlaying(true);
      setAudioError('');
    } catch {
      setPlaying(false);
      setAudioError('No se pudo reproducir este enlace. Usa un archivo de audio directo (MP3/M4A/OGG) o súbelo desde tu equipo.');
    }
  };

  const waveform = Array.from({ length: 90 }, (_, i) => {
    const h = 15 + ((i * 41 + i * i * 11) % 66);
    const position = duration ? (i / 90) * duration : 0;
    const active = duration !== null && position >= selectedStart && position <= selectedStart + CLIP_SECONDS;
    return <span key={i} className={active ? 'clip-wave-active' : ''} style={{ height: `${h}%` }} />;
  });
  const selectStyle = {
    '--clip-left': `${duration ? selectedStart / duration * 100 : 0}%`,
    '--clip-width': `${duration ? Math.min(100, CLIP_SECONDS / duration * 100) : 100}%`
  } as CSSProperties;

  return <div className="music-clip-editor">
    <div className="asset-head"><strong>{label}</strong><span>Selecciona un fragmento de 30 segundos</span></div>
    <div className="asset-control">
      <div className="asset-input-icon"><Music2 size={18} /></div>
      <input aria-label={`Enlace de audio para ${label}`} type="url" value={value} placeholder="Pega un enlace directo a MP3, M4A u OGG" onChange={e => onValue(e.target.value)} />
      <input ref={picker} hidden type="file" accept="audio/*,.mp3,.m4a,.ogg,.wav" onChange={(e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]; if (file) onUpload(file); e.target.value = '';
      }} />
      <button type="button" className="outline-button" disabled={uploading} onClick={() => picker.current?.click()}><Upload size={16} /> {uploading ? 'Subiendo...' : 'Subir'}</button>
    </div>
    {!!value && !validLink && <p className="clip-warning">Este enlace no es un archivo de audio directo. Los enlaces de YouTube, Spotify y otras plataformas no se pueden recortar aquí. Utiliza un MP3/M4A/OGG propio o autorizado.</p>}
    {validLink && <>
      <audio ref={audio} src={value} preload="metadata" onLoadedMetadata={e => {
        const length = e.currentTarget.duration;
        if (Number.isFinite(length) && length > 0) {
          setDuration(length);
          const nextStart = Math.min(Number(start) || 0, Math.max(0, length - CLIP_SECONDS));
          if (nextStart !== start) onStart(Math.round(nextStart));
          try { e.currentTarget.currentTime = nextStart; } catch { /* Not seekable yet */ }
        } else setAudioError('Este audio no tiene duración disponible o no permite seleccionar un tramo.');
      }} onTimeUpdate={e => {
        const element = e.currentTarget;
        const elapsed = Math.max(0, element.currentTime - selectedStart);
        setProgress(Math.min(CLIP_SECONDS, elapsed));
        if (elapsed >= CLIP_SECONDS || (duration !== null && element.currentTime >= duration - 0.01)) {
          element.pause(); setPlaying(false);
        }
      }} onEnded={() => setPlaying(false)} onError={() => {
        setAudioError('El enlace no se puede cargar como audio. Comprueba que sea una URL pública y directa al archivo.');
        setPlaying(false);
      }}/>
      <div className="clip-workspace">
        <div className="clip-tool-title"><span><Scissors size={16} /> RECORTA TU CANCIÓN</span><span>{duration === null ? 'Cargando duración…' : timeLabel(duration)}</span></div>
        <div className="clip-waveform" style={selectStyle} aria-hidden="true">
          <div className="clip-wave-bars">{waveform}</div><div className="clip-selection"><span className="clip-grip">Ⅱ</span><span className="clip-grip">Ⅱ</span></div>
        </div>
        <input className="clip-range" type="range" min={0} max={Math.floor(maxStart)} step={1} value={Math.floor(selectedStart)} disabled={duration === null || maxStart < 1} onChange={e => chooseStart(Number(e.target.value))} aria-label={`Seleccionar el segundo inicial para ${label}`} />
        <div className="clip-timeline"><span>0:00</span><span>Desliza para elegir el fragmento</span><span>{timeLabel(duration ?? 0)}</span></div>
        <div className="clip-footer">
          <button type="button" className="clip-play" onClick={() => void preview()} disabled={duration === null || !validLink}><span>{playing ? <Pause size={17} fill="currentColor" /> : <Play size={17} fill="currentColor" />}</span>{playing ? 'Pausar' : 'Escuchar recorte'}</button>
          <div className="clip-segment"><span>Inicio <strong>{timeLabel(selectedStart)}</strong></span><span>Fin <strong>{timeLabel(Math.min(duration ?? 30, selectedStart + CLIP_SECONDS))}</strong></span><span><Volume2 size={15} /> {timeLabel(progress)} / 0:30</span></div>
        </div>
        {duration !== null && duration < CLIP_SECONDS && <p className="clip-warning">El audio dura menos de 30 segundos: se reproducirá completo.</p>}
        {audioError && <p className="clip-warning" role="alert">{audioError}</p>}
        <p className="clip-save-help">Elige el inicio y pulsa <strong>Guardar cambios</strong> arriba. La invitación reproducirá únicamente ese tramo de 30 segundos; no se modifica el archivo original.</p>
      </div>
    </>}
  </div>;
}
