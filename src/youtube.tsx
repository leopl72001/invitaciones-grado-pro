import type { CSSProperties } from 'react';

/** Detecta enlaces públicos de YouTube sin confundir dominios parecidos. */
export function youtubeVideoId(link: string): string | null {
  try {
    const url = new URL(link.trim());
    if (!['https:', 'http:'].includes(url.protocol)) return null;
    const host = url.hostname.toLowerCase();
    let id = '';
    if (host === 'youtu.be' || host === 'www.youtu.be') {
      id = url.pathname.split('/')[1] || '';
    } else if (['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com', 'www.youtube-nocookie.com', 'youtube-nocookie.com'].includes(host)) {
      const segments = url.pathname.split('/').filter(Boolean);
      if (url.pathname === '/watch') id = url.searchParams.get('v') || '';
      else if (['shorts', 'live', 'embed', 'v'].includes(segments[0] || '')) id = segments[1] || '';
    }
    return /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
  } catch { return null; }
}

export function isYouTubeAddress(link: string): boolean {
  try {
    const host = new URL(link.trim()).hostname.toLowerCase();
    return ['youtu.be', 'www.youtu.be', 'youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com', 'www.youtube-nocookie.com', 'youtube-nocookie.com'].includes(host);
  } catch { return false; }
}

/** El parámetro end es absoluto desde el inicio del video, NO relativo a start. */
export function youtubeClipUrl(id: string, clipStart: number, clipEnd?: number): string {
  const start = Math.max(0, Math.floor(Number(clipStart) || 0));
  const end = Math.min(start + 30, Math.max(start + 1, Math.floor(Number(clipEnd) || start + 30)));
  const params = new URLSearchParams({ start: String(start), end: String(end), playsinline: '1', rel: '0', controls: '1' });
  return `https://www.youtube-nocookie.com/embed/${id}?${params.toString()}`;
}

export function YouTubeClipEmbed({ id, start, end, title, style }: { id: string; start: number; end?: number; title: string; style?: CSSProperties }) {
  return <div className="youtube-video-frame" style={style}>
    <iframe
      key={`${id}-${Math.floor(start)}-${Math.floor(end ?? (start + 30))}`}
      title={title}
      src={youtubeClipUrl(id, start, end)}
      allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; web-share"
      referrerPolicy="strict-origin-when-cross-origin"
      allowFullScreen
      loading="lazy"
    />
  </div>;
}