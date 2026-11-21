import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ChangeEvent, type ReactNode, type CSSProperties } from 'react';
import {
  ArrowDown, ArrowLeft, ArrowRight, BadgeCheck, CalendarDays, Check, CheckCircle2, CircleHelp,
  ClipboardCheck, Clock3, Copy, Download, Edit3, ExternalLink, GraduationCap, Heart,
  LayoutDashboard, Link2, LogOut, Mail, MapPin, Menu, MessageCircle, Minus, MoreHorizontal, Music2,
  Pause, Pencil, Play, Plus, Search, Send, Settings2, ShieldCheck, Sparkles, Trash2, Users, Volume2,
  WandSparkles, X, XCircle
} from 'lucide-react';
import {
  currentUser, getPublicInvitation, hasCloud, invitationUrl, loadDashboard, makeId, makeToken,
  removeGroup, removeGuest, saveGroup, saveGuest, saveSettings, ensureAnonymousSession, setLocalFallback, submitRSVP, supabase, uploadAsset, whatsappUrl
} from './data';
import { DEFAULT_EVENT, type DashboardData, type EventSettings, type Guest, type GuestGroup, type PublicInvite, type RSVPStatus } from './types';
import { isYouTubeAddress } from './youtube';

const iconSize = 18;
// La música se decide por el grupo, no por una excepción por invitado.
function groupMusicLabel(assignedToGroup:boolean) {
  return assignedToGroup ? 'Canción del grupo' : 'Canción sin grupo';
}
const statusText: Record<RSVPStatus,string> = { pending: 'Sin responder', confirmed: 'Confirmado', declined: 'No asistirá' };
const statusClass: Record<RSVPStatus,string> = { pending: 'pending', confirmed: 'success', declined: 'declined' };

function localDate(dateStr: string) {
  const d = new Date(dateStr);
  return Number.isNaN(d.getTime()) ? new Date('2026-12-18T18:00:00-05:00') : d;
}
function colombiaDateTime(dateStr: string) {
  return new Intl.DateTimeFormat('es-CO', { timeZone:'America/Bogota', day:'numeric', month:'long', year:'numeric', hour:'numeric', minute:'2-digit', hour12:true }).format(localDate(dateStr));
}
function dateForInput(iso: string) {
  return new Intl.DateTimeFormat('sv-SE', { timeZone:'America/Bogota', year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', hour12:false }).format(localDate(iso)).replace(' ','T').slice(0,16);
}
function getCountdown(eventDate: string) {
  const diff = Math.max(0, localDate(eventDate).getTime() - Date.now());
  return { days: Math.floor(diff / 864e5), hours: Math.floor(diff / 36e5) % 24, minutes: Math.floor(diff / 6e4) % 60, seconds: Math.floor(diff / 1e3) % 60, done: diff <= 0 };
}
function safeHref(url?: string) {
  if (!url) return '';
  try { const p = new URL(url); return p.protocol === 'https:' || p.protocol === 'http:' ? p.href : ''; } catch { return ''; }
}
async function copyText(text: string) {
  if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(text);
  else window.prompt('Copia este enlace:', text);
}
function initials(name: string) { return name.trim().split(/\s+/).slice(0,2).map(p=>p[0]?.toUpperCase()).join('') || 'IG'; }

function RouteApp() {
  const [hash,setHash] = useState(window.location.hash);
  useEffect(() => { const onChange = () => setHash(window.location.hash); window.addEventListener('hashchange',onChange); return () => window.removeEventListener('hashchange',onChange); },[]);
  const invitationMatch = hash.match(/^#\/(?:invitacion|i)\/([0-9a-f]{64})$/i);
  return invitationMatch ? <PublicPage token={invitationMatch[1]} /> : <Admin />;
}
export default function App() { return <RouteApp />; }

function PublicPage({token}:{token:string}) {
  const [invite,setInvite] = useState<PublicInvite|null>(null);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState('');
  const reload = useCallback(async () => {
    try { setInvite(await getPublicInvitation(token)); setError(''); }
    catch(e){ setError((e as Error).message); }
    finally { setLoading(false); }
  },[token]);
  useEffect(() => { setLoading(true);void reload(); },[reload]);
  if (loading) return <div className="full-load"><GraduationCap size={42} /><p>Preparando una noche especial...</p><span className="spinner" /></div>;
  if (!invite) return <div className="error-screen"><GraduationCap size={50}/><h1>Esta invitación no está disponible</h1><p>{error || 'Revisa que hayas abierto el enlace completo.'}</p><a href="#/">Volver al inicio</a></div>;
  return <Invitation data={invite} onRefresh={reload} />;
}

function GoldStar({style}:{style?:CSSProperties}) { return <span className="gold-star" style={style}>✦</span>; }

function Countdown({date}:{date:string}) {
  const [count,setCount] = useState(() => getCountdown(date));
  useEffect(() => { setCount(getCountdown(date)); const id = window.setInterval(() => setCount(getCountdown(date)),1000); return () => clearInterval(id); },[date]);
  const parts = [[count.days,'Días'],[count.hours,'Horas'],[count.minutes,'Minutos'],[count.seconds,'Segundos']] as const;
  return <div className="countdown-grid" aria-label="Cuenta regresiva en tiempo real">
    {parts.map(([n,title])=><div className="count-card" key={title}><strong className="count-number">{String(n).padStart(2,'0')}</strong><span>{title}</span></div>)}
    {count.done && <div className="count-done">¡El gran día llegó! 🎓</div>}
  </div>;
}

function GraduatesPhoto({src,index}:{src:string;index:number}) {
  return <div className={`polaroid polaroid-${index + 1}`}>
    {safeHref(src) ? <img key={src} alt={`Recuerdo de graduación ${index+1}`} src={safeHref(src)} loading="lazy"/> : <div className="polaroid-placeholder"><GraduationCap size={index===1?65:50} strokeWidth={1.1}/><span>Mi gran logro</span></div>}
    <span className="polaroid-caption">{['Un sueño','Un logro','Un nuevo comienzo'][index]}</span>
  </div>;
}

function FloatingLights() {
  return <div className="cinematic-lights" aria-hidden="true">{Array.from({length:24},(_,i)=><i key={i} style={{
    '--cx':`${(i*29+13)%100}%`,
    '--cy':`${(i*17+11)%100}%`,
    '--cd':`${-(i*7%14)}s`,
    '--cs':`${2+(i%3)}px`,
    '--ct':`${7+(i%8)}s`
  } as CSSProperties}/>)}</div>;
}

function PhotoStory({photos,active}:{photos:string[];active:number}) {
  if (!photos.length) return null;
  const photo=photos[active % photos.length];
  return <section className="photo-story-section reveal">
    <FloatingLights/>
    <div className="story-frame">
      <div className="story-photo">
        <img key={photo} src={photo} alt={`Fotografía del recuerdo ${active % photos.length + 1}`} loading="lazy"/>
        <span className="story-stamp">✦ 18 · 12 · 2026</span>
      </div>
      <div className="story-caption"><span className="section-eyebrow">LOS RECUERDOS QUE NOS TRAJERON HASTA AQUÍ</span>
        <h2>Una historia escrita <em>con esfuerzo y corazón</em></h2>
        <p>Hay momentos que parecen pequeños, hasta que miramos atrás y descubrimos todo lo que significaron.</p>
        <div className="story-pagination" aria-hidden="true">{photos.map((_,i)=><span key={i} className={i===active%photos.length?'active':''}/>)}</div>
      </div>
    </div>
  </section>;
}
function Confetti({active}:{active:boolean}) {
  if (!active) return null;
  const palette=['#f9d58a','#fff3cf','#d9ab62','#e0ecff','#8cbada','#f1d4b4','#e6c78c'];
  return <div className="confetti confetti-party" aria-hidden="true">{Array.from({length:125},(_,i)=><i key={i} style={{
    '--x':`${(i*53+7)%100}vw`,
    '--delay':`${(i*17)%49/28}s`,
    '--duration':`${3.25+(i%11)*0.29}s`,
    '--tone':palette[i%palette.length],
    '--drift':`${(i%2===0?1:-1)*(28+(i*19)%175)}px`,
    '--twist':`${(i*137)%1080}deg`,
    '--size':`${5+(i%5)*2}px`
  } as CSSProperties}/>)}</div>;
}



type IntroPhase = 'idle' | 'unsealing' | 'opening' | 'revealing' | 'zooming' | 'done';

function CinematicIntro({
  guest,settings,phase,onOpen,unsupportedMusic
}:{
  guest:Guest;
  settings:EventSettings;
  phase:IntroPhase;
  onOpen:()=>void;
  unsupportedMusic:boolean;
}) {
  const animating = phase!=='idle';
  const mathGlyphs=['∑','π','√','∞','∫','Δ','θ','φ','α','∂','∇','≈','x²','Ω','β','λ'];
  const phaseText:Record<IntroPhase,string> = {
    idle:'Toca el sobre para descubrir tu invitación',
    unsealing:'El sello se rompe…',
    opening:'El sobre se está abriendo…',
    revealing:'Tu carta está saliendo…',
    zooming:'Descubre esta noche especial…',
    done:'¡Bienvenido!'
  };
  return <div className={`ci-screen ci-${phase}`}>
    <div className="ci-spotlights" aria-hidden="true"/>
    <div className="ci-ambient-particles" aria-hidden="true">
      {Array.from({length:20},(_,i)=><i key={i} style={{
        '--ci-x':`${(i*41+7)%100}%`,
        '--ci-y':`${(i*29+5)%100}%`,
        '--ci-delay':`${-(i%8)}s`
      } as CSSProperties}/>)}
    </div>
    <div className="ci-heading">
      <span className="ci-eyebrow">HAY MOMENTOS QUE MERECEN CELEBRARSE</span>
      <h1>Hay algo <em>especial</em> para ti</h1>
      <p>Una historia de sueños, esfuerzo y nuevas oportunidades.</p>
    </div>
    <div className="ci-stage">
      <div className="ci-stage-ring" aria-hidden="true"/>
      <div className="ci-stage-halo" aria-hidden="true"/>
      <div className="ci-opening-glow" aria-hidden="true"/>
      <div className="ci-starburst ci-math-burst" aria-hidden="true">
        {Array.from({length:56},(_,i)=><span key={i} style={{
          '--burst-angle':`${(i*137.507)%360}deg`,
          '--burst-distance':`${150+(i%8)*31}px`,
          '--burst-delay':`${(i%10)*0.047}s`,
          '--burst-size':`${17+(i%5)*5}px`
        } as CSSProperties}>{mathGlyphs[i%mathGlyphs.length]}</span>)}
      </div>
      <button type="button" className="ci-envelope-trigger" onClick={onOpen} disabled={animating} aria-label="Abrir el sobre y descubrir la invitación">
        <span className="ci-envelope">
          <span className="ci-envelope-back"/>
          <span className="ci-card">
            <span className="ci-card-border">
              <GraduationCap size={32} strokeWidth={1.4}/>
              <span className="ci-card-script">Mi gran día</span>
              <span className="ci-card-graduate">{settings.graduate_name}</span>
              <span className="ci-card-degree">{settings.degree}</span>
              <span className="ci-card-divider">✦ ✧ ✦</span>
              <span className="ci-card-invited">Invitación especial para</span>
              <strong className="ci-card-guest">{guest.name}</strong>
              <small>18 DICIEMBRE 2026 · 6:00 P. M.</small>
            </span>
          </span>
          <span className="ci-envelope-flap"/>
          <span className="ci-envelope-pocket"/>
        </span>
        {/* El sello es hermano del sobre, no hijo: ninguna solapa puede taparlo. */}
        <span className="ci-envelope-seal ci-front-seal" aria-hidden="true">ℳ</span>
      </button>
      <span className="ci-stage-shadow" aria-hidden="true"/>
    </div>
    <div className="ci-actions">
      <button type="button" className="ci-open-button" onClick={onOpen} disabled={animating}>
        {animating ? 'Descubriendo tu invitación...' : 'Abrir mi invitación'}
        <Sparkles size={18}/>
      </button>
      <p className="ci-phase-caption" aria-live="polite">{phaseText[phase]}</p>
      <div className="ci-date">18 · 12 · 2026 <span>✦</span> 6:00 P. M.</div>
      {unsupportedMusic && <p className="ci-audio-warning" role="status">Para escuchar la música de fondo, configura un archivo MP3 en Personalización.</p>}
    </div>
    <div className="ci-warp" aria-hidden="true">
      <div className="ci-warp-core"/>
      <div className="ci-warp-lines">
        {Array.from({length:56},(_,i)=><i key={i} style={{
          '--warp-angle':`${(i*137.507)%360}deg`,
          '--warp-delay':`${(i%12)*0.052}s`,
          '--warp-length':`${45+(i%8)*21}px`,
          '--warp-width':`${1+(i%3)}px`
        } as CSSProperties}/>)}
      </div>
      <div className="ci-warp-rings"><i/><i/><i/><i/></div>
    </div>
    <div className="ci-transition-glow" aria-hidden="true"/>
  </div>;
}

function Invitation({data,onRefresh}:{data:PublicInvite;onRefresh:()=>Promise<void>}) {
  const { settings, guest } = data;
  const [opened,setOpened] = useState(false);
  const [introPhase,setIntroPhase] = useState<IntroPhase>('idle');
  const introTimersRef = useRef<number[]>([]);
  const [confetti,setConfetti] = useState(false);
  const [status,setStatus] = useState<'confirmed'|'declined'>(guest.status==='declined'?'declined':'confirmed');
  const [attendees,setAttendees] = useState(guest.attending_count || 1);
  const [message,setMessage] = useState(guest.message || '');
  const [saving,setSaving] = useState(false);
  const [saved,setSaved] = useState(false);
  const [error,setError] = useState('');
  const [photoIndex,setPhotoIndex] = useState(0);
  const [autoTour,setAutoTour] = useState(true);
  const tourStepRef=useRef(0);
  const usablePhotos = settings.photo_urls.filter(src=>Boolean(safeHref(src))).slice(0,12).map(src=>safeHref(src));
  // La reproducción empieza con el gesto del usuario al abrir el sobre.
  // YouTube no ofrece audio invisible de fondo: para esa experiencia usamos
  // archivos de audio reproducibles directamente (MP3, M4A, OGG, WAV).
  // El RPC público ya devuelve group_name. Esto funciona para invitaciones actuales y futuras,
  // sin actualizar song_variant (que Supabase restringe a una única invitación especial).
  const assignedToGroup = Boolean(data.group_name?.trim());
  const requestedMusic = assignedToGroup ? settings.music_special_1_url : settings.music_default_url;
  const selectedMusic = safeHref(requestedMusic);
  const musicUrl = selectedMusic && !isYouTubeAddress(selectedMusic) ? selectedMusic : '';
  const musicAudioRef = useRef<HTMLAudioElement | null>(null);
  const [musicStatus,setMusicStatus] = useState<'idle'|'playing'|'paused'|'blocked'>('idle');
  const musicEnd = 30;
  const activateAudio = () => {
    const player = musicAudioRef.current;
    if (!player || !musicUrl) return;
    // play() sucede directamente dentro del clic del sobre; no lo diferimos
    // con setTimeout/useEffect porque perdería el permiso de interacción.
    try { if (player.readyState > 0) player.currentTime = 0; } catch { /* audio todavía cargando */ }
    void player.play().then(() => setMusicStatus('playing')).catch(() => setMusicStatus('blocked'));
  };
  const toggleAudio = () => {
    const player = musicAudioRef.current;
    if (!player) return;
    if (!player.paused) { player.pause(); setMusicStatus('paused'); }
    else {
      if (player.currentTime >= musicEnd - 0.1) player.currentTime = 0;
      void player.play().then(() => setMusicStatus('playing')).catch(() => setMusicStatus('blocked'));
    }
  };
  useEffect(() => {
    // Detiene la canción anterior al cambiar el enlace/invitado.
    const audio = musicAudioRef.current;
    setMusicStatus('idle');
    return () => { audio?.pause(); };
  }, [musicUrl]);

  useEffect(() => {
    if(!opened) return;
    const obs = new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting)e.target.classList.add('revealed');}),{threshold:.12});
    document.querySelectorAll('.reveal').forEach(el=>obs.observe(el));
    return ()=>obs.disconnect();
  },[opened]);
  useEffect(()=>{
    if(!opened || usablePhotos.length<2 || window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
    const timer=window.setInterval(()=>setPhotoIndex(i=>(i+1)%usablePhotos.length),4800);
    return ()=>window.clearInterval(timer);
  },[opened,usablePhotos.length]);
  useEffect(()=>{
    if(!opened || !autoTour || window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
    let timer:number;
    let stopped=false;
    const chapters=['.invite-hero','.photo-section','.count-section','.photo-story-section','.detail-section','.invitee-section','.rsvp-section'];
    const pause=()=>setAutoTour(false);
    window.addEventListener('wheel',pause,{passive:true});
    window.addEventListener('touchstart',pause,{passive:true});
    window.addEventListener('keydown',pause);
    const next=()=>{
      if(stopped)return;
      if(document.visibilityState==='hidden'){timer=window.setTimeout(next,4000);return;}
      let target:Element|null=null;
      while(tourStepRef.current<chapters.length-1 && !target){
        tourStepRef.current++;
        target=document.querySelector(chapters[tourStepRef.current]);
      }
      if(target){target.scrollIntoView({behavior:'smooth',block:'start'});timer=window.setTimeout(next,11000);}
    };
    timer=window.setTimeout(next,tourStepRef.current===0?12500:9000);
    return ()=>{stopped=true;window.clearTimeout(timer);window.removeEventListener('wheel',pause);window.removeEventListener('touchstart',pause);window.removeEventListener('keydown',pause);};
  },[opened,autoTour]);
  // La música comienza con el gesto de abrir el sobre; no esperamos las animaciones.
  // Los temporizadores se limpian al salir de la invitación.
  useEffect(()=>()=>{introTimersRef.current.forEach(id=>window.clearTimeout(id));},[]);
  const start = () => {
    if(opened || introPhase!=='idle') return;
    activateAudio();
    const finish = () => {
      setIntroPhase('done');
      setOpened(true);
      setConfetti(true);
      introTimersRef.current.push(window.setTimeout(()=>setConfetti(false),6500));
    };
    if(window.matchMedia('(prefers-reduced-motion: reduce)').matches){
      finish();
      return;
    }
    // La tapa tiene una fase propia; no se oculta detrás del bolsillo.
    setIntroPhase('unsealing');
    introTimersRef.current.push(window.setTimeout(()=>setIntroPhase('opening'),650));
    introTimersRef.current.push(window.setTimeout(()=>setIntroPhase('revealing'),2300));
    introTimersRef.current.push(window.setTimeout(()=>setIntroPhase('zooming'),4100));
    introTimersRef.current.push(window.setTimeout(finish,5750));
  };
  const save = async (e:FormEvent) => {
    e.preventDefault();setError('');setSaving(true);
    try {await submitRSVP(guest.share_token,status,status==='confirmed'?attendees:0,message);setSaved(true);await onRefresh();setConfetti(true);window.setTimeout(()=>setConfetti(false),6500);}
    catch(err){setError((err as Error).message);}
    finally{setSaving(false);}
  };
  return <div className={`invitation ${opened?'invitation-opened':''}`}>
    {!!musicUrl && <audio
      ref={musicAudioRef}
      src={musicUrl}
      preload="auto"
      loop
      onTimeUpdate={e => {
        // Repite los primeros 30 segundos sin detener la reproducción.
        // El atributo loop también cubre canciones que duran menos de 30 segundos.
        if (e.currentTarget.currentTime >= musicEnd) e.currentTarget.currentTime = 0;
      }}
      onError={() => setMusicStatus('blocked')}
    />}
    <Confetti active={confetti}/>

    {!opened ? <CinematicIntro guest={guest} settings={settings} phase={introPhase} onOpen={start} unsupportedMusic={Boolean(selectedMusic && !musicUrl)}/> : <>
      <header className="invite-nav"><span className="invite-brand"><GraduationCap size={19}/> <span>Mi graduación</span></span><div><span className="invite-nav-tag">18 DIC 2026</span><button type="button" className="nav-cinema" onClick={()=>setAutoTour(v=>!v)} aria-label={autoTour?'Pausar recorrido automático':'Reanudar recorrido automático'} title={autoTour?'Pausar recorrido automático':'Reanudar recorrido automático'}>{autoTour?<Pause size={15}/>:<Play size={15}/>} <span>{autoTour?'Pausar recorrido':'Continuar recorrido'}</span></button>{!!musicUrl && <button type="button" className="nav-music" onClick={toggleAudio} title={musicStatus === 'playing' ? 'Pausar canción' : 'Activar canción'} aria-label={musicStatus === 'playing' ? 'Pausar canción' : 'Activar canción'}>{musicStatus === 'playing' ? <Volume2 size={17}/> : <Music2 size={17}/>}</button>}</div></header>
      <main>
        <section className="invite-hero">
          <div className="hero-shine"/><div className="math-stars math-stars-open" aria-hidden="true"><span>∑</span><span>∞</span><span>π</span><span>√</span><span>∫</span><span>α</span><span>≡</span></div>
          <FloatingLights/>
          <div className="hero-math-universe" aria-hidden="true">
            <div className="hero-math-ring hero-math-ring-a"/>
            <div className="hero-math-ring hero-math-ring-b"/>
            <div className="hero-math-glow"/>
            {['∑','π','∞','√','Δ','∫','θ','φ','α','∂','x²','≈'].map((glyph,i)=><span key={i} style={{
              '--orbit-x':`${8+(i*37)%83}%`,
              '--orbit-y':`${8+(i*29)%80}%`,
              '--orbit-delay':`${-(i*3.1)%17}s`,
              '--orbit-time':`${8+(i%5)*2}s`
            } as CSSProperties}>{glyph}</span>)}
          </div>
          <div className="invite-hero-content"><div className="hero-topline"><span/> UNA NOCHE PARA RECORDAR <span/></div>
            <div className="line-illustration"><GraduationCap size={47} strokeWidth={1.1}/><span>✧</span></div>
            <p className="script hero-script">El gran día</p><h1>{settings.graduate_name}</h1><div className="hero-degree"><span>✦</span> {settings.degree} <span>✦</span></div>
            <p className="hero-invite-to">TENGO EL HONOR DE INVITARTE A TI</p><h2>{guest.name}</h2><p className="hero-welcome">{settings.intro}</p>
            <div className="hero-date"><span>VIERNES</span><strong>18</strong><span>DICIEMBRE<br/>2026</span></div>
            <a className="hero-scroll" href="#detalles">DESCUBRE TU INVITACIÓN <ArrowDown size={16}/></a>
          </div>
        </section>
        <section className="photo-section reveal"><div className="section-eyebrow">CADA SUEÑO TIENE SU HISTORIA</div><h2>La fórmula de <em>un sueño cumplido</em></h2>
          <p className="section-lead">Entre desafíos, números y nuevas oportunidades, cada paso valió la pena. Hoy celebramos todo lo aprendido y lo que está por venir.</p>
          <div className="polaroid-row">{[0,1,2].map(i=><GraduatesPhoto key={i} src={usablePhotos.length>=3 ? usablePhotos[(photoIndex+i)%usablePhotos.length] : (usablePhotos[i]||'')} index={i}/>)}</div>
          {usablePhotos.length>3&&<p className="photo-count-hint"><Sparkles size={14}/> {usablePhotos.length} fotografías formando parte de esta historia</p>}
        </section>
        <section className="count-section reveal"><GoldStar/><div className="section-eyebrow">CADA SEGUNDO NOS ACERCA</div><h2>Falta poquito para <em>celebrar</em></h2><Countdown date={settings.event_datetime}/><p>El tiempo corre y la emoción crece. ¡Nos vemos muy pronto!</p></section>
        <PhotoStory photos={usablePhotos} active={usablePhotos.length>=3?photoIndex+1:Math.min(1,Math.max(0,usablePhotos.length-1))}/>
        <section className="detail-section reveal" id="detalles"><div className="section-eyebrow">GUARDA ESTA FECHA</div><h2>Fecha, hora <em>y lugar</em></h2><div className="detail-cards">
          <div className="detail-card"><div className="detail-icon"><CalendarDays size={25}/></div><span className="small-label">EL GRAN DÍA</span><h3>Viernes 18 de diciembre</h3><p>2026 · 6:00 de la tarde</p><div className="detail-deco">✦ ✦ ✦</div></div>
          <div className="detail-card"><div className="detail-icon"><MapPin size={26}/></div><span className="small-label">NOS ENCONTRAREMOS EN</span><h3>{settings.venue_name}</h3><p>{settings.venue_address}</p>{safeHref(settings.maps_url) ? <a href={safeHref(settings.maps_url)} target="_blank" rel="noreferrer" className="detail-link">Ver ubicación <ExternalLink size={16}/></a> : <span className="detail-link muted-link">Dirección pendiente</span>}</div>
        </div></section>
        <section className="invitee-section reveal"><div className="section-eyebrow">UN LUGAR RESERVADO PARA TI</div><div className="quota-number">{String(guest.seats).padStart(2,'0')}</div><h2>{guest.seats===1?'Cupo reservado':'Cupos reservados'}</h2><p>{data.group_name ? `Grupo: ${data.group_name}. ` : ''}Preparamos {guest.seats===1?'un espacio especial':'estos espacios especiales'} para que compartamos esta celebración.</p></section>
        <section className="rsvp-section reveal" id="confirmacion"><div className="rsvp-ornament">✦</div><span className="section-eyebrow">TU RESPUESTA SIGNIFICA MUCHO</span><h2>¿Nos acompañas en <em>esta noche especial?</em></h2><p>Confirma tu asistencia {settings.rsvp_deadline ? `antes del ${new Intl.DateTimeFormat('es-CO',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(`${settings.rsvp_deadline}T12:00:00Z`))}` : 'lo antes posible'}.</p>
          {saved ? <div className="rsvp-confirmed"><CheckCircle2 size={43}/><h3>¡Respuesta guardada!</h3><p>{status==='confirmed'? `¡Qué alegría! Te esperamos con ${attendees} ${attendees===1?'asistente':'asistentes'}.`:'Gracias por avisarnos, te enviaremos nuestros mejores deseos.'}</p><button type="button" onClick={()=>setSaved(false)}>Modificar mi respuesta</button></div> : <form className="rsvp-form" onSubmit={save}>
            {guest.status!=='pending'&&<div className="previous-status">Tu respuesta anterior: <b>{statusText[guest.status]}</b>. Puedes actualizarla.</div>}
            <div className="choice-row"><button type="button" className={`choice-btn ${status==='confirmed'?'selected':''}`} onClick={()=>setStatus('confirmed')}><Heart size={19}/> ¡Sí, asistiré!</button><button type="button" className={`choice-btn ${status==='declined'?'selected':''}`} onClick={()=>setStatus('declined')}><XCircle size={18}/> No podré asistir</button></div>
            {status==='confirmed'&&<div className="attendee-field"><label>¿Cuántas personas asistirán?</label><div className="stepper"><button type="button" onClick={()=>setAttendees(Math.max(1,attendees-1))} disabled={attendees<=1}><Minus size={17}/></button><strong>{attendees}</strong><button type="button" onClick={()=>setAttendees(Math.min(guest.seats,attendees+1))} disabled={attendees>=guest.seats}><Plus size={17}/></button></div><small>Máximo {guest.seats} {guest.seats===1?'persona':'personas'} según tu invitación.</small></div>}
            <label className="message-field">¿Quieres dejar un mensaje? <span>(Opcional)</span><textarea maxLength={500} rows={3} placeholder="Unas palabras para este día tan especial..." value={message} onChange={e=>setMessage(e.target.value)}/></label>
            {error&&<div className="form-error">{error}</div>}
            <button type="submit" className="primary gold-btn submit-btn" disabled={saving}>{saving?'Guardando...':'Confirmar mi respuesta'} <Send size={17}/></button>
          </form>}
        </section>
        <footer className="invitation-footer"><GraduationCap size={30} strokeWidth={1}/><p className="script">Gracias por ser parte de mi historia</p><span>{settings.closing_message}</span><div className="footer-equation">∞ posibilidades · 1 gran sueño</div></footer>
      </main>
    </>}
  </div>;
}

type TabKey = 'overview' | 'guests' | 'groups' | 'responses' | 'settings';
function Admin() {
  const [userId,setUserId] = useState<string|null>(null);
  const [authLoading,setAuthLoading] = useState(hasCloud);
  const [localMode,setLocalMode] = useState(!hasCloud);
  const [authProblem,setAuthProblem] = useState('');
  const [retryCloud,setRetryCloud] = useState(0);
  const [data,setData] = useState<DashboardData|null>(null);
  const [tab,setTab] = useState<TabKey>('overview');
  const [busy,setBusy] = useState(false);
  const [notice,setNotice] = useState('');
  const [search,setSearch] = useState('');
  const [filterGroup,setFilterGroup] = useState('all');
  const [guestEditing,setGuestEditing] = useState<Guest|null>(null);
  const [groupEditing,setGroupEditing] = useState<GuestGroup|null>(null);
  const [showGuestDialog,setShowGuestDialog] = useState(false);
  const [showGroupDialog,setShowGroupDialog] = useState(false);
  const [mobileMenu,setMobileMenu] = useState(false);
  const [settingsDraft,setSettingsDraft] = useState<EventSettings|null>(null);
  const [savingSettings,setSavingSettings] = useState(false);
  const [uploading,setUploading] = useState('');
  const bulkPhotosRef=useRef<HTMLInputElement|null>(null);
  useEffect(()=>{
    if(!supabase){setAuthLoading(false);return;}
    let active=true;
    const {data:sub}=supabase.auth.onAuthStateChange((_event,session)=>{if(active)setUserId(session?.user.id||null);});
    void ensureAnonymousSession()
      .then(user=>{
        if(!active)return;
        setLocalFallback(false);
        setLocalMode(false);
        setUserId(user?.id||null);
        setAuthProblem('');
      })
      .catch(err=>{
        if(!active)return;
        // Supabase sigue pendiente: el panel continúa en modo local sin bloquear al usuario.
        setLocalFallback(true);
        setLocalMode(true);
        setAuthProblem((err as Error).message);
        setUserId(null);
      })
      .finally(()=>{if(active)setAuthLoading(false);});
    return ()=>{active=false;sub.subscription.unsubscribe();};
  },[retryCloud]);
  useEffect(()=>{
    if(localMode || !userId || (tab !== 'responses' && tab !== 'overview')) return;
    const timer=window.setInterval(()=>{
      void loadDashboard().then(latest=>setData(latest)).catch(()=>{});
    },12000);
    return ()=>window.clearInterval(timer);
  },[userId,tab,localMode]);
  const refresh = useCallback(async()=>{
    try{const loaded=await loadDashboard();setData(loaded);setSettingsDraft(loaded.settings);}
    catch(err){setNotice((err as Error).message);}
  },[]);
  useEffect(()=>{if(localMode||userId){setBusy(true);void refresh().finally(()=>setBusy(false));}},[localMode,userId,refresh]);
  const tell=(msg:string)=>{setNotice(msg);window.setTimeout(()=>setNotice(''),4500);};
  async function mutate(action:()=>Promise<void>,ok:string){setBusy(true);try{await action();await refresh();tell(ok);}catch(e){tell(`Error: ${(e as Error).message}`);}finally{setBusy(false);}}
  const editGuest=(g?:Guest)=>{if(!data)return;setGuestEditing(g||{id:makeId(),event_id:data.settings.id,group_id:null,name:'',seats:1,phone:'',song_variant:'default',share_token:makeToken(),status:'pending',attending_count:0,message:'',confirmed_at:null,created_at:new Date().toISOString()});setShowGuestDialog(true);};
  const editGroup=(g?:GuestGroup)=>{if(!data)return;setGroupEditing(g||{id:makeId(),event_id:data.settings.id,name:'',default_seats:1,notes:''});setShowGroupDialog(true);};
  async function copyLink(guest:Guest){if(localMode){tell('Primero activa Anonymous Sign-Ins en Supabase. Los enlaces locales no funcionan en otros dispositivos.');return;}try{await copyText(invitationUrl(guest.share_token));tell('¡Enlace copiado! Listo para compartir.');}catch{tell('No se pudo copiar. Usa el botón de WhatsApp.');}}
  const filtered = (data?.guests || []).filter(g=>(filterGroup==='all'||g.group_id===filterGroup)&&[g.name,g.phone,data?.groups.find(gr=>gr.id===g.group_id)?.name||''].join(' ').toLowerCase().includes(search.toLowerCase()));
  const confirmed=data?.guests.filter(g=>g.status==='confirmed')||[];
  const declined=data?.guests.filter(g=>g.status==='declined')||[];
  const totalSeats=data?.guests.reduce((n,g)=>n+g.seats,0)||0;
  const confirmedSeats=confirmed.reduce((n,g)=>n+g.attending_count,0);
  const menu: {key:TabKey;label:string;icon:typeof LayoutDashboard}[]=[
    {key:'overview',label:'Inicio',icon:LayoutDashboard},{key:'guests',label:'Invitaciones',icon:Mail},{key:'groups',label:'Grupos',icon:Users},{key:'responses',label:'Confirmaciones',icon:ClipboardCheck},{key:'settings',label:'Personalización',icon:Settings2}
  ];
  if(authLoading)return <div className="full-load admin-loading"><div className="spinner"/>Conectando panel...</div>;
  return <div className="dashboard-shell">
    <aside className={`sidebar ${mobileMenu?'mobile-visible':''}`}><div className="sidebar-brand"><div className="logo-square"><GraduationCap size={23}/></div><div><strong>GRADO<span>PRO</span></strong><small>STUDIO DE INVITACIONES</small></div></div><p className="side-section-label">MI ESPACIO</p><nav className="sidebar-nav">{menu.map(item=><button key={item.key} onClick={()=>{setTab(item.key);setMobileMenu(false);}} className={tab===item.key?'nav-active':''}><item.icon size={19}/>{item.label}{item.key==='responses'&&confirmed.length>0&&<span className="nav-counter">{confirmed.length}</span>}</button>)}</nav><div className="sidebar-spacer"/><div className="side-help"><Sparkles size={19}/><strong>Tu noche, a tu manera.</strong><p>Crea recuerdos, comparte emociones y celebra sin límites.</p></div><div className="side-footer">{!localMode?<><ShieldCheck size={16}/> Nube conectada · sin contraseña</>:<><CircleHelp size={16}/> Modo local · sin login</>}</div></aside>
    {mobileMenu&&<div className="mobile-overlay" onClick={()=>setMobileMenu(false)}/>}
    <div className="main-panel"><header className="admin-topbar"><div className="topbar-left"><button className="mobile-nav-btn" onClick={()=>setMobileMenu(true)} aria-label="Abrir menú"><Menu size={22}/></button><span className="topbar-breadcrumb">GRADOPRO</span><span className="slash">/</span><span>{menu.find(item=>item.key===tab)?.label}</span></div><div className="topbar-right"><span className={`connection-dot ${!localMode?'connected':''}`}/><span className="connection-label">{localMode?'Solo este dispositivo':'Sincronizado'}</span><div className="profile-circle">{initials(data?.settings.graduate_name||'Graduación')}</div></div></header>
    <div className="admin-content">
      {notice&&<div className="toast-message"><Sparkles size={16}/>{notice}<button onClick={()=>setNotice('')}><X size={15}/></button></div>}
      {!localMode ? <div className="demo-banner"><div><ShieldCheck size={18}/><span><strong>Nube conectada.</strong> Los datos se guardan en Supabase, sin inicio de sesión manual. Conserva los datos de este navegador para seguir editándolos.</span></div></div> :
      <div className="demo-banner"><div><CircleHelp size={18}/><span><strong>Modo local, sin login:</strong> puedes diseñar tu invitación y registrar invitados aquí. No compartas aún los enlaces: las confirmaciones y los MP3 no se guardan en la nube hasta activar Anonymous Sign-Ins en Supabase. {authProblem && <small>Detalle: {authProblem}</small>}</span></div><a href="https://supabase.com/dashboard" target="_blank" rel="noreferrer">Activar nube <ArrowRight size={14}/></a></div>}
      {!data ? <div className="empty-state"><span className="spinner"/> {busy?'Cargando tus invitaciones...':'No pudimos cargar los datos. Revisa la configuración de Supabase.'}<button onClick={()=>void refresh()}>Reintentar</button></div> : <>
      {tab==='overview'&&<>
        <section className="dashboard-greeting"><div><div className="admin-eyebrow"><Sparkles size={16}/> TU EVENTO MÁS ESPECIAL</div><h1>¡Hagamos de esta noche <em>algo inolvidable!</em></h1><p>Organiza tus invitados, personaliza cada detalle y vive la emoción de las confirmaciones.</p><div className="greeting-actions"><button className="primary" onClick={()=>editGuest()}><Plus size={17}/> Crear invitación</button><button className="outline-button" onClick={()=>setTab('settings')}><WandSparkles size={17}/> Personalizar evento</button></div></div><div className="greeting-art" aria-hidden="true"><span>π</span><GraduationCap size={100} strokeWidth={.75}/><span>∞</span></div></section>
        <div className="metrics-grid"><Metric label="Invitaciones" value={data.guests.length} icon={Mail} suffix="registradas"/><Metric label="Cupos asignados" value={totalSeats} icon={Users} suffix="en total"/><Metric label="Confirmados" value={confirmedSeats} icon={CheckCircle2} suffix="asistentes"/><Metric label="Pendientes" value={data.guests.filter(g=>g.status==='pending').length} icon={Clock3} suffix="por responder"/></div>
        <div className="overview-layout"><div className="admin-card"><div className="card-header"><div><h3>Catálogo de invitaciones</h3><p>Tu colección personalizada, lista para enviar.</p></div><button className="subtle-button" onClick={()=>setTab('guests')}>Ver todas <ArrowRight size={16}/></button></div>{data.guests.length?<div className="catalog-grid">{data.guests.slice(0,4).map(g=><CatalogCard key={g.id} guest={g} group={data.groups.find(gr=>gr.id===g.group_id)} settings={data.settings} shareEnabled={!localMode} onCopy={()=>void copyLink(g)}/>)}</div>:<EmptyCatalog onAdd={()=>editGuest()}/>}</div><div className="admin-card side-overview"><div className="card-header"><div><h3>El gran día</h3><p>Cuenta regresiva en vivo</p></div><CalendarDays size={20}/></div><div className="side-date"><span>18</span><div>DICIEMBRE <strong>2026</strong><small>6:00 P. M. · COLOMBIA</small></div></div><Countdown date={data.settings.event_datetime}/><div className="next-steps"><h4>Últimas respuestas</h4>{[...data.guests].filter(g=>g.status!=='pending').slice(0,3).map(g=><div key={g.id}><span className="tiny-avatar">{initials(g.name)}</span><span>{g.name}</span><b className={`tiny-status ${statusClass[g.status]}`}>{g.status==='confirmed'?'Confirmó':'No asistirá'}</b></div>)}{!data.guests.some(g=>g.status!=='pending')&&<p className="soft-note">Las confirmaciones aparecerán aquí.</p>}</div></div></div>
      </>}
      {tab==='guests'&&<><AdminHeading eyebrow="PERSONALIZA Y COMPARTE" title="Mis invitaciones" detail="Cada invitado recibe su nombre, sus cupos y la canción correspondiente al grupo." action={<button className="primary" onClick={()=>editGuest()}><Plus size={18}/> Nueva invitación</button>}/><div className="admin-card guest-table-card"><div className="table-filters"><div className="search-field"><Search size={18}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar invitado o teléfono..."/></div><select value={filterGroup} onChange={e=>setFilterGroup(e.target.value)}><option value="all">Todos los grupos</option>{data.groups.map(g=><option key={g.id} value={g.id}>{g.name}</option>)}</select><span className="results-count">{filtered.length} invitaciones</span></div><div className="table-wrap"><table className="admin-table"><thead><tr><th>INVITADO</th><th>GRUPO</th><th>CUPOS</th><th>MÚSICA</th><th>RESPUESTA</th><th>ACCIONES</th></tr></thead><tbody>{filtered.map(g=><tr key={g.id}><td><div className="guest-cell"><span className="avatar-small">{initials(g.name)}</span><div><strong>{g.name}</strong><small>{g.phone || 'Sin número de WhatsApp'}</small></div></div></td><td>{data.groups.find(gr=>gr.id===g.group_id)?.name||<span className="muted">Sin grupo</span>}</td><td><span className="quota-pill"><Users size={13}/>{g.seats}</span></td><td><span className="song-chip"><Music2 size={13}/>{groupMusicLabel(Boolean(g.group_id))}</span></td><td><span className={`status-pill ${statusClass[g.status]}`}>{statusText[g.status]}</span></td><td><div className="actions-row"><button title={localMode?'Activa Supabase antes de compartir':'Copiar enlace'} disabled={localMode} onClick={()=>void copyLink(g)}><Copy size={16}/></button>{localMode?<button disabled title="Activa Supabase antes de compartir"><MessageCircle size={16}/></button>:<a href={whatsappUrl(g,data.settings)} title="Enviar por WhatsApp" target="_blank" rel="noreferrer"><MessageCircle size={16}/></a>}<a href={`#/invitacion/${g.share_token}`} title="Ver invitación" target="_blank" rel="noreferrer"><ExternalLink size={16}/></a><button title="Editar" onClick={()=>editGuest(g)}><Pencil size={16}/></button><button title="Eliminar" className="delete-icon" onClick={()=>{if(confirm(`¿Eliminar definitivamente la invitación de ${g.name}?`))void mutate(()=>removeGuest(g.id),'Invitación eliminada.');}}><Trash2 size={16}/></button></div></td></tr>)}</tbody></table>{filtered.length===0&&<div className="table-empty">No hay invitaciones con estos filtros. <button onClick={()=>editGuest()}>Crear una</button></div>}</div></div></>}
      {tab==='groups'&&<><AdminHeading eyebrow="ORGANIZA A TU GENTE" title="Grupos de invitados" detail="La música se asigna automáticamente: una canción para «Sin asignar grupo» y otra para «amigos» y los demás grupos creados." action={<button className="primary" onClick={()=>editGroup()}><Plus size={18}/> Nuevo grupo</button>}/><div className="groups-grid"><div className="admin-card group-card"><div className="group-card-top"><div className="group-icon"><Music2 size={24}/></div><span className="song-chip"><Music2 size={13}/> Canción 1</span></div><h3>Sin asignar grupo</h3><p>Quienes no pertenezcan a ningún grupo escucharán la canción principal.</p><div className="group-card-footer"><span>{data.guests.filter(guest=>!guest.group_id).length} invitaciones</span><button type="button" className="group-music-action" onClick={()=>setTab('settings')}>Configurar canción</button></div></div>{data.groups.map(g=><div key={g.id} className="admin-card group-card"><div className="group-card-top"><div className="group-icon"><Users size={24}/></div><div className="actions-row"><button onClick={()=>editGroup(g)} title="Editar grupo"><Edit3 size={16}/></button><button className="delete-icon" onClick={()=>{if(confirm(`¿Eliminar el grupo ${g.name}? Las invitaciones no se borrarán.`))void mutate(()=>removeGroup(g.id),'Grupo eliminado.');}} title="Eliminar grupo"><Trash2 size={16}/></button></div></div><h3>{g.name}</h3><p>{g.notes||'Grupo de invitados especiales'}</p><div className="group-card-song"><Music2 size={14}/> Canción 2 · grupos asignados</div><div className="group-card-footer"><span>{data.guests.filter(guest=>guest.group_id===g.id).length} invitaciones</span><button type="button" className="group-music-action" onClick={()=>setTab('settings')}>Configurar canción</button></div></div>)}<button className="add-group-card" onClick={()=>editGroup()}><Plus size={30}/><strong>Agregar grupo</strong><span>Organiza mejor tu celebración</span></button></div></>}
      {tab==='responses'&&<><AdminHeading eyebrow="LA EMOCIÓN DE CADA RESPUESTA" title="Confirmaciones" detail="Consulta respuestas actualizadas automáticamente, los cupos utilizados y los mensajes." action={<button className="outline-button" onClick={()=>exportCSV(data)}><Download size={17}/> Exportar CSV</button>}/><div className="metrics-grid metrics-short"><Metric label="Confirmaron" value={confirmed.length} icon={BadgeCheck} suffix="invitaciones"/><Metric label="Personas que asistirán" value={confirmedSeats} icon={Users} suffix="asistentes"/><Metric label="No asistirán" value={declined.length} icon={XCircle} suffix="respuestas"/><Metric label="Faltan por responder" value={data.guests.length-confirmed.length-declined.length} icon={Clock3} suffix="invitaciones"/></div><div className="admin-card responses-card"><div className="card-header"><h3>Listado de respuestas</h3><span>{data.guests.length} invitaciones enviables</span></div><div className="table-wrap"><table className="admin-table"><thead><tr><th>INVITADO</th><th>ESTADO</th><th>ASISTENTES</th><th>MENSAJE</th><th>FECHA</th></tr></thead><tbody>{data.guests.map(g=><tr key={g.id}><td><strong>{g.name}</strong></td><td><span className={`status-pill ${statusClass[g.status]}`}>{statusText[g.status]}</span></td><td>{g.status==='confirmed'?`${g.attending_count} / ${g.seats}`:'—'}</td><td className="message-preview">{g.message||'—'}</td><td>{g.confirmed_at?new Intl.DateTimeFormat('es-CO',{dateStyle:'short',timeStyle:'short',timeZone:'America/Bogota'}).format(new Date(g.confirmed_at)):'—'}</td></tr>)}</tbody></table></div></div></>}
      {tab==='settings'&&settingsDraft&&<><AdminHeading eyebrow="DISEÑA UNA EXPERIENCIA ÚNICA" title="Personaliza tu evento" detail="Estos detalles se reflejarán automáticamente en todas las invitaciones." action={<button className="primary" disabled={savingSettings} onClick={()=>void mutateSettings()}><Check size={18}/>{savingSettings?'Guardando...':'Guardar cambios'}</button>}/><div className="settings-layout"><div className="settings-main"><div className="admin-card settings-card"><div className="card-header"><div><h3><GraduationCap size={20}/> Datos de la graduación</h3><p>La información principal que verán tus invitados.</p></div></div><div className="form-grid"><Field label="Nombre del graduando" value={settingsDraft.graduate_name} onChange={v=>updateSettings('graduate_name',v)}/><Field label="Título o carrera" value={settingsDraft.degree} onChange={v=>updateSettings('degree',v)}/><Field label="Frase de portada" value={settingsDraft.headline} onChange={v=>updateSettings('headline',v)}/><Field label="Fecha y hora (Colombia)" type="datetime-local" value={dateForInput(settingsDraft.event_datetime)} onChange={v=>updateSettings('event_datetime',`${v}:00-05:00`)}/><Field label="Nombre del lugar" value={settingsDraft.venue_name} onChange={v=>updateSettings('venue_name',v)}/><Field label="Dirección completa" value={settingsDraft.venue_address} onChange={v=>updateSettings('venue_address',v)}/><Field label="Enlace de Google Maps" value={settingsDraft.maps_url} onChange={v=>updateSettings('maps_url',v)} placeholder="https://maps.google.com/..."/><Field label="Fecha límite de confirmación" type="date" value={settingsDraft.rsvp_deadline} onChange={v=>updateSettings('rsvp_deadline',v)}/></div><label className="block-label">Mensaje de bienvenida<textarea value={settingsDraft.intro} rows={3} onChange={e=>updateSettings('intro',e.target.value)}/></label><label className="block-label">Mensaje final<textarea value={settingsDraft.closing_message} rows={2} onChange={e=>updateSettings('closing_message',e.target.value)}/></label></div>
        <div className="admin-card settings-card"><div className="card-header"><div><h3><Music2 size={20}/> Música por grupo</h3><p>Configura dos canciones: la primera para invitados sin grupo y la segunda para «amigos» o cualquier grupo creado. Se asignan automáticamente al abrir el sobre.</p></div></div><div className="asset-stack">{([{key:'music_default_url',startKey:'music_default_start',endKey:'music_default_end',label:'Canción 1 · Sin asignar grupo',section:'music-main'},{key:'music_special_1_url',startKey:'music_special_1_start',endKey:'music_special_1_end',label:'Canción 2 · Grupo amigos y grupos asignados',section:'music-special-1'}] as const).map(item=><MusicLinkField key={item.key} label={item.label} value={settingsDraft[item.key]} onValue={v=>setSettingsDraft(prev=>prev?{...prev,[item.key]:v,[item.startKey]:0,[item.endKey]:30}:prev)} onUpload={f=>handleUpload(f,item.section,v=>setSettingsDraft(prev=>prev?{...prev,[item.key]:v,[item.startKey]:0,[item.endKey]:30}:prev))} uploading={uploading===item.section}/>)}</div><p className="form-help"><Volume2 size={16}/> Al abrir el sobre se repetirá el fragmento de 30 segundos de forma continua, hasta que pauses la música o cierres la invitación. Usa un enlace directo a MP3, M4A, OGG o WAV. Los enlaces de YouTube no permiten música invisible sin el video; reemplázalos para activar este modo.</p></div>
        <div className="admin-card settings-card"><div className="card-header"><div><h3><Sparkles size={20}/> Galería cinematográfica</h3><p>Agrega hasta 12 fotos para distribuirlas por toda la invitación, con efectos de movimiento.</p></div></div>
          <div className="gallery-tools">
            <span className="gallery-total">{settingsDraft.photo_urls.filter(Boolean).length} / 12 fotografías</span>
            <input ref={bulkPhotosRef} hidden type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple onChange={e=>{void uploadManyPhotos(e.target.files);e.target.value='';}}/>
            <button className="outline-button" disabled={Boolean(uploading)||settingsDraft.photo_urls.filter(Boolean).length>=12} onClick={()=>bulkPhotosRef.current?.click()} type="button"><Plus size={16}/>{uploading==='photos-batch'?'Subiendo fotos...':'Subir varias fotos'}</button>
            <button className="outline-button" type="button" disabled={settingsDraft.photo_urls.length>=12} onClick={()=>setSettingsDraft(prev=>prev?{...prev,photo_urls:[...prev.photo_urls,'']}:prev)}><Plus size={16}/> Añadir espacio</button>
          </div>
          <p className="gallery-help">Puedes seleccionar varias imágenes de tu computador o pegar un enlace directo en cada campo. Pulsa Guardar cambios al terminar.</p>
          <div className="gallery-photo-editor">{settingsDraft.photo_urls.map((url,i)=><div className="gallery-photo-item" key={i}>
              <AssetField label={`Fotografía ${i+1}`} type="image" value={url} onValue={v=>changePhoto(i,v)} onUpload={f=>handleUpload(f,`photo-${i}`,v=>changePhoto(i,v))} uploading={uploading===`photo-${i}`}/>
              <div className="gallery-photo-actions">
                <button type="button" disabled={i===0} onClick={()=>movePhoto(i,-1)}>↑ Subir posición</button>
                <button type="button" disabled={i===settingsDraft.photo_urls.length-1} onClick={()=>movePhoto(i,1)}>↓ Bajar posición</button>
                <button type="button" onClick={()=>removePhoto(i)}><Trash2 size={14}/> Quitar foto</button>
              </div>
            </div>)}</div>
          </div>
      </div><div className="settings-side"><div className="admin-card live-preview-card"><div className="section-eyebrow">VISTA PREVIA</div><div className="preview-mini"><GraduationCap size={36}/><p className="script">El gran día</p><h3>{settingsDraft.graduate_name||'Mi graduación'}</h3><span>{settingsDraft.degree}</span><div>✦ 18 · 12 · 2026 ✦</div></div><p>Así se verá la portada de las invitaciones.</p><button className="outline-button" onClick={()=>{if(data.guests.length)window.open(invitationUrl(data.guests[0].share_token),'_blank');else tell('Primero crea una invitación para abrir su vista previa.');}}>Abrir invitación de prueba <ExternalLink size={16}/></button></div><div className="admin-card tips-card"><ShieldCheck size={22}/><h4>Tu información está protegida</h4><p>{!localMode?'Los nombres y teléfonos se guardan en Supabase y están separados de otros usuarios mediante permisos de sesión.':'Estás usando el modo local: tus datos solo están en este navegador. No envíes invitaciones todavía.'}</p></div></div></div></>}
      </>}
    </div></div>
    {showGuestDialog&&guestEditing&&data&&<GuestDialog initial={guestEditing} groups={data.groups} onClose={()=>setShowGuestDialog(false)} onSave={async g=>{await mutate(()=>saveGuest(g),'Invitación guardada correctamente.');setShowGuestDialog(false);}}/>}
    {showGroupDialog&&groupEditing&&<GroupDialog initial={groupEditing} onClose={()=>setShowGroupDialog(false)} onSave={async g=>{await mutate(()=>saveGroup(g),'Grupo guardado correctamente.');setShowGroupDialog(false);}}/>}
  </div>;
  function updateSettings<K extends keyof EventSettings>(key:K,value:EventSettings[K]) {setSettingsDraft(prev=>prev?{...prev,[key]:value}:prev);}
  function changePhoto(index:number,url:string){
    setSettingsDraft(prev=>{if(!prev)return prev;const list=[...prev.photo_urls];list[index]=url;return {...prev,photo_urls:list.slice(0,12)};});
  }
  function removePhoto(index:number){
    setSettingsDraft(prev=>prev?{...prev,photo_urls:prev.photo_urls.filter((_,i)=>i!==index)}:prev);
  }
  function movePhoto(index:number,offset:number){
    setSettingsDraft(prev=>{
      if(!prev)return prev;
      const list=[...prev.photo_urls];const to=index+offset;
      if(to<0||to>=list.length)return prev;
      [list[index],list[to]]=[list[to],list[index]];
      return {...prev,photo_urls:list};
    });
  }
  async function uploadManyPhotos(files:FileList|null){
    if(!files?.length)return;
    if(localMode||!userId){tell('Para subir fotos desde el panel debes activar Anonymous Sign-Ins en Supabase. Mientras tanto puedes pegar enlaces directos a las fotografías.');return;}
    const remaining=12-(settingsDraft?.photo_urls.filter(Boolean).length||0);
    if(remaining<=0){tell('La galería admite un máximo de 12 fotografías.');return;}
    setUploading('photos-batch');
    const urls:string[]=[];
    try{
      for(const file of Array.from(files).slice(0,remaining)){
        try {urls.push(await uploadAsset(file,'photos',userId));}
        catch(err){tell(`No se pudo subir ${file.name}: ${(err as Error).message}`);}
      }
      if(urls.length){
        setSettingsDraft(prev=>prev?{...prev,photo_urls:[...prev.photo_urls.filter(Boolean),...urls].slice(0,12)}:prev);
        tell(`${urls.length} fotos subidas. Pulsa Guardar cambios para publicarlas.`);
      }
    }finally{setUploading('');}
  }
  async function mutateSettings(){if(!settingsDraft)return;setSavingSettings(true);try{await saveSettings(settingsDraft);await refresh();tell([settingsDraft.music_default_url,settingsDraft.music_special_1_url,settingsDraft.music_special_2_url].some(isYouTubeAddress) ? 'Cambios guardados. Atención: reemplaza los enlaces de YouTube por MP3 directos para que la música suene al abrir el sobre.' : '¡Evento actualizado! Los cambios ya se reflejan en las invitaciones.');}catch(e){tell(`Error: ${(e as Error).message}`);}finally{setSavingSettings(false);}}
  async function handleUpload(file:File,section:string,done:(url:string)=>void){setUploading(section);try{if(localMode||!userId)throw new Error('Para subir fotos o canciones desde el panel necesitas habilitar Anonymous Sign-Ins en Supabase. Mientras tanto puedes usar enlaces públicos directos.');const result=await uploadAsset(file,section,userId);done(result);tell('Archivo subido. Ahora pulsa Guardar cambios para publicarlo.');}catch(e){tell((e as Error).message);}finally{setUploading('');}}
}

function Metric({label,value,icon:Icon,suffix}:{label:string;value:number;icon:typeof Mail;suffix:string}) {return <div className="metric-card"><div className="metric-top"><span>{label}</span><div><Icon size={19}/></div></div><strong>{value}</strong><small>{suffix}</small></div>;}
function AdminHeading({eyebrow,title,detail,action}:{eyebrow:string;title:string;detail:string;action:ReactNode}) {return <div className="admin-heading"><div><div className="admin-eyebrow">{eyebrow}</div><h1>{title}</h1><p>{detail}</p></div>{action}</div>;}
function EmptyCatalog({onAdd}:{onAdd:()=>void}) {return <div className="empty-catalog"><Mail size={29}/><h4>Todo empieza con una invitación</h4><p>Registra a tu primer invitado y comparte un momento único.</p><button className="primary" onClick={onAdd}><Plus size={16}/> Nueva invitación</button></div>;}
function CatalogCard({guest,group,settings,onCopy,shareEnabled}:{guest:Guest;group?:GuestGroup;settings:EventSettings;onCopy:()=>void;shareEnabled:boolean}) {return <div className="catalog-card"><div className="catalog-cover"><div className="cover-stars">✦ ✧ ✦</div><GraduationCap size={30} strokeWidth={1}/><span className="script">Una noche especial</span><strong>{guest.name}</strong><small>18 · DICIEMBRE · 2026</small></div><div className="catalog-body"><div className="catalog-meta"><span>{group?.name||'Sin grupo'} · {guest.seats} {guest.seats===1?'cupo':'cupos'}</span><span className={`catalog-status ${statusClass[guest.status]}`}>{statusText[guest.status]}</span></div><div className="catalog-actions"><button onClick={onCopy} disabled={!shareEnabled} title={shareEnabled?'Copiar enlace':'Activa Supabase antes de enviar invitaciones'}><Copy size={15}/> Copiar enlace</button>{shareEnabled?<a href={whatsappUrl(guest,settings)} target="_blank" rel="noreferrer" title="Enviar por WhatsApp"><MessageCircle size={17}/></a>:<button disabled title="Activa Supabase antes de compartir"><MessageCircle size={17}/></button>}<a href={`#/invitacion/${guest.share_token}`} target="_blank" rel="noreferrer" title="Ver invitación"><ExternalLink size={16}/></a></div></div></div>;}

function GuestDialog({initial,groups,onSave,onClose}:{initial:Guest;groups:GuestGroup[];onSave:(guest:Guest)=>Promise<void>;onClose:()=>void}) {
  const [guest,setGuest]=useState(initial);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const save=async(e:FormEvent)=>{e.preventDefault();if(!guest.name.trim()){setError('Escribe el nombre del invitado.');return;}setBusy(true);setError('');try{await onSave({...guest,name:guest.name.trim(),seats:Math.max(1,Math.min(50,guest.seats)),attending_count:Math.min(guest.attending_count,guest.seats)});}catch(err){setError((err as Error).message);}finally{setBusy(false);}};
  return <div className="modal-shade" onMouseDown={e=>{if(e.currentTarget===e.target)onClose();}}><form className="modal" onSubmit={save}><div className="modal-head"><div><div className="admin-eyebrow">INVITACIÓN PERSONALIZADA</div><h2>{initial.name?'Editar invitación':'Nueva invitación'}</h2></div><button type="button" onClick={onClose} aria-label="Cerrar"><X size={20}/></button></div><p className="modal-lead">Cada persona recibirá un enlace exclusivo con su nombre y cupos asignados.</p><div className="modal-form"><label>Nombre de la persona o familia <span>*</span><input required maxLength={100} autoFocus value={guest.name} onChange={e=>setGuest({...guest,name:e.target.value})} placeholder="Ej. Familia Rodríguez"/></label><div className="form-grid"><label>Grupo<select value={guest.group_id||''} onChange={e=>{const id=e.target.value;const gr=groups.find(g=>g.id===id);setGuest({...guest,group_id:id||null,seats:gr?gr.default_seats:guest.seats});}}><option value="">Sin grupo</option>{groups.map(g=><option key={g.id} value={g.id}>{g.name}</option>)}</select></label><label>Cupos asignados<input type="number" min={1} max={50} required value={guest.seats} onChange={e=>setGuest({...guest,seats:Number(e.target.value)})}/></label></div><label>WhatsApp <span>(Opcional)</span><input type="tel" value={guest.phone} onChange={e=>setGuest({...guest,phone:e.target.value})} placeholder="Ej. 573001234567"/><small>Incluye indicativo de país para enviar directamente.</small></label><div className="modal-notice"><Music2 size={18}/><span>Esta invitación usará <strong>{guest.group_id?'Canción 2 · Grupo asignado':'Canción 1 · Sin asignar grupo'}</strong>. Puedes cambiarla modificando el grupo. Configura los dos audios en Personalización.</span></div></div>{error&&<p className="form-error">{error}</p>}<div className="modal-foot"><button type="button" className="outline-button" onClick={onClose}>Cancelar</button><button type="submit" className="primary" disabled={busy}>{busy?'Guardando...':'Guardar invitación'} <Check size={17}/></button></div></form></div>;
}
function GroupDialog({initial,onSave,onClose}:{initial:GuestGroup;onSave:(g:GuestGroup)=>Promise<void>;onClose:()=>void}) {
  const [group,setGroup]=useState(initial),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const save=async(e:FormEvent)=>{e.preventDefault();setBusy(true);try{await onSave({...group,name:group.name.trim()});}catch(err){setError((err as Error).message);}finally{setBusy(false);}};
  return <div className="modal-shade" onMouseDown={e=>{if(e.currentTarget===e.target)onClose();}}><form className="modal modal-small" onSubmit={save}><div className="modal-head"><h2>{initial.name?'Editar grupo':'Nuevo grupo'}</h2><button type="button" onClick={onClose}><X size={20}/></button></div><div className="modal-form"><label>Nombre del grupo<input required maxLength={80} autoFocus placeholder="Familia, Amigos, Compañeros..." value={group.name} onChange={e=>setGroup({...group,name:e.target.value})}/></label><label>Cupos sugeridos por invitación<input required type="number" min={1} max={50} value={group.default_seats} onChange={e=>setGroup({...group,default_seats:Number(e.target.value)})}/></label><label>Descripción <span>(Opcional)</span><textarea rows={3} value={group.notes} onChange={e=>setGroup({...group,notes:e.target.value})}/></label></div>{error&&<p className="form-error">{error}</p>}<div className="modal-foot"><button type="button" className="outline-button" onClick={onClose}>Cancelar</button><button className="primary" disabled={busy} type="submit">Guardar grupo <Check size={17}/></button></div></form></div>;
}
function Field({label,value,onChange,type='text',placeholder}:{label:string;value:string;onChange:(value:string)=>void;type?:string;placeholder?:string}) {return <label>{label}<input value={value} type={type} placeholder={placeholder} onChange={e=>onChange(e.target.value)}/></label>;}
function MusicLinkField({label,value,onValue,onUpload,uploading}:{label:string;value:string;onValue:(url:string)=>void;onUpload:(file:File)=>void;uploading:boolean}) {
  const fileRef=useRef<HTMLInputElement|null>(null);
  const testAudioRef=useRef<HTMLAudioElement|null>(null);
  const [testState,setTestState]=useState<'idle'|'loading'|'playing'|'error'>('idle');
  const [testMessage,setTestMessage]=useState('');
  const yt=isYouTubeAddress(value);
  useEffect(()=>{
    setTestState('idle');setTestMessage('');
    return ()=>{
      const audio=testAudioRef.current;
      if(audio){audio.pause();audio.removeAttribute('src');audio.load();testAudioRef.current=null;}
    };
  },[value]);
  const stopTest=()=>{
    testAudioRef.current?.pause();
    setTestState('idle');
    setTestMessage('Prueba detenida.');
  };
  const testMusic=()=>{
    if(yt) {setTestState('error');setTestMessage('Este enlace de YouTube no es un archivo MP3. Sustitúyelo por una URL directa a un audio que tengas permitido utilizar.');return;}
    const link=safeHref(value);
    if(!link) {setTestState('error');setTestMessage('Pega un enlace HTTPS válido a un archivo de audio.');return;}
    if(testAudioRef.current){testAudioRef.current.pause();testAudioRef.current.removeAttribute('src');testAudioRef.current.load();}
    const audio=new Audio(link);
    testAudioRef.current=audio;
    audio.preload='auto';
    audio.volume=1;
    setTestState('loading');
    setTestMessage('Comprobando el archivo de audio...');
    audio.onplaying=()=>{
      if(testAudioRef.current!==audio)return;
      setTestState('playing');setTestMessage('La canción está reproduciéndose. Si no la escuchas, comprueba el volumen del navegador y del dispositivo.');
    };
    audio.onerror=()=>{
      if(testAudioRef.current!==audio)return;
      setTestState('error');
      setTestMessage('El navegador no pudo cargar este enlace como audio. Verifica que abra directamente un MP3/M4A/OGG válido y público, no una página web.');
    };
    audio.ontimeupdate=()=>{
      if(testAudioRef.current===audio && audio.currentTime>=5){
        audio.pause();setTestState('idle');setTestMessage('Prueba completada: el navegador pudo reproducir los primeros 5 segundos.');
      }
    };
    void audio.play().catch((err: unknown)=>{
      if(testAudioRef.current!==audio)return;
      const name=err instanceof Error ? err.name : '';
      setTestState('error');
      setTestMessage(name==='NotAllowedError'?'El navegador bloqueó la reproducción. Pulsa Probar audio nuevamente y revisa los permisos de sonido.':'El archivo no se puede reproducir en este navegador. Revisa el enlace o prueba con otro MP3.');
    });
  };
  return <div className="asset-field">
    <div className="asset-head"><strong>{label}</strong><span>Enlace directo a MP3 / M4A / OGG / WAV</span></div>
    <div className="asset-control"><div className="asset-input-icon"><Music2 size={18}/></div>
      <input type="url" aria-label={`Enlace para ${label}`} placeholder="https://ejemplo.com/mi-cancion.mp3" value={value} onChange={e=>onValue(e.target.value)}/>
      <input ref={fileRef} type="file" hidden accept="audio/*,.mp3,.m4a,.ogg,.wav" onChange={(e:ChangeEvent<HTMLInputElement>)=>{const file=e.target.files?.[0];if(file)onUpload(file);e.target.value='';}}/>
      <button type="button" className="outline-button" disabled={uploading} onClick={()=>fileRef.current?.click()}>{uploading?'Subiendo...':'Subir MP3'}</button>
    </div>
    {value && <p className={`music-url-hint ${yt ? 'music-url-hint-warning' : ''}`}>{yt ? '⚠️ Enlace incompatible: YouTube no puede sonar como música invisible de fondo. Este enlace NO producirá sonido al abrir el sobre. Necesitas un MP3/M4A/OGG directo.' : safeHref(value) ? 'Antes de guardar, usa Probar audio: te confirmará si el navegador realmente puede escuchar esta dirección.' : 'Pega una dirección HTTPS válida.'}</p>}
    <div style={{display:'flex',gap:12,alignItems:'center',flexWrap:'wrap',marginTop:10}}>
      <button type="button" className="outline-button" disabled={!value||yt} onClick={testState==='playing'?stopTest:testMusic}>{testState==='playing'?'Detener prueba':'Probar audio (5 s)'}</button>
      {value&&<span role="status" aria-live="polite" style={{fontSize:12,color:testState==='error'?'#bd643c':'#66758d',flex:'1 1 240px'}}>{yt?'Para usar esta canción sin video necesitas el archivo de audio.':testMessage||'Comprueba que la canción suene antes de enviarla.'}</span>}
    </div>
  </div>;
}
function AssetField({label,type,value,onValue,onUpload,uploading}:{label:string;type:'audio'|'image';value:string;onValue:(s:string)=>void;onUpload:(f:File)=>void;uploading:boolean}) {
  const inputRef=useRef<HTMLInputElement|null>(null);
  return <div className="asset-field"><div className="asset-head"><strong>{label}</strong><span>{type==='audio'?'MP3 / M4A / OGG · máx. 15 MB':'JPG / PNG / WEBP · máx. 15 MB'}</span></div><div className="asset-control"><div className="asset-input-icon">{type==='audio'?<Music2 size={18}/>:<Sparkles size={18}/>}</div><input aria-label={`URL de ${label}`} placeholder="Pega el enlace del archivo o súbelo" value={value} onChange={e=>onValue(e.target.value)}/><input ref={inputRef} type="file" accept={type==='audio'?'audio/*':'image/*'} hidden onChange={(e:ChangeEvent<HTMLInputElement>)=>{const file=e.target.files?.[0];if(file)onUpload(file);e.target.value='';}}/><button type="button" className="outline-button" disabled={uploading} onClick={()=>inputRef.current?.click()}>{uploading?'Subiendo...':'Subir'}</button></div>{value&&<div className="asset-preview">{type==='audio'?<audio controls src={safeHref(value)||undefined} preload="none"/>:safeHref(value)?<img alt={`Vista previa ${label}`} src={safeHref(value)}/>:null}</div>}</div>;
}
function exportCSV(data:DashboardData) {
  const rows=[['Invitado','Grupo','Telefono','Cupos','Cancion','Estado','Asistentes','Mensaje','Fecha de respuesta','URL'],...data.guests.map(g=>[g.name,data.groups.find(gr=>gr.id===g.group_id)?.name||'',g.phone,String(g.seats),groupMusicLabel(Boolean(g.group_id)),statusText[g.status],String(g.attending_count),g.message,g.confirmed_at||'',invitationUrl(g.share_token)])];
  const csv='\ufeff'+rows.map(row=>row.map(v=>{const sanitized=/^[=+@\-\t\r]/.test(v)?`'${v}`:v;return `"${sanitized.replaceAll('"','""')}"`;}).join(';')).join('\r\n');
  const blob=new Blob([csv],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),anchor=document.createElement('a');anchor.href=url;anchor.download='confirmaciones-grado.csv';anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1500);
}