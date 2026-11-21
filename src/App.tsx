import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ChangeEvent, type ReactNode, type CSSProperties } from 'react';
import {
  ArrowDown, ArrowLeft, ArrowRight, BadgeCheck, CalendarDays, Check, CheckCircle2, ChevronDown, CircleHelp,
  ClipboardCheck, Clock3, Copy, Download, Edit3, ExternalLink, Gift, GraduationCap, Heart,
  LayoutDashboard, Link2, LogOut, Mail, MapPin, Menu, MessageCircle, Minus, MoreHorizontal, Music2,
  Pause, Pencil, Play, Plus, Search, Send, Settings2, ShieldCheck, Sparkles, Trash2, Users, Volume2,
  WandSparkles, X, XCircle
} from 'lucide-react';
import {
  currentUser, getPublicInvitation, hasCloud, invitationUrl, loadDashboard, makeId, makeToken,
  removeGroup, removeGuest, saveGroup, saveGuest, saveSettings, signIn, signOut, signUp, submitRSVP, supabase, uploadAsset, whatsappUrl
} from './data';
import { DEFAULT_EVENT, type DashboardData, type EventSettings, type Guest, type GuestGroup, type PublicInvite, type RSVPStatus, type SongVariant } from './types';
import MusicClipPicker from './MusicClipPicker';
import { youtubeVideoId, YouTubeClipEmbed } from './youtube';

const iconSize = 18;
const songs: Record<SongVariant,string> = { default: 'Canción principal', special_1: 'Canción especial 1', special_2: 'Canción especial 2' };
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
  const invitationMatch = hash.match(/^#\/i\/([0-9a-f]{64})$/i);
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
    {safeHref(src) ? <img alt={`Recuerdo de graduación ${index+1}`} src={safeHref(src)} loading="lazy"/> : <div className="polaroid-placeholder"><GraduationCap size={index===1?65:50} strokeWidth={1.1}/><span>Mi gran logro</span></div>}
    <span className="polaroid-caption">{['Un sueño','Un logro','Un nuevo comienzo'][index]}</span>
  </div>;
}
function Confetti({active}:{active:boolean}) {
  if (!active) return null;
  return <div className="confetti" aria-hidden="true">{Array.from({length:65},(_,i)=><i key={i} style={{'--x':`${(i*37)%100}vw`,'--delay':`${(i*7)%17/10}s`,'--duration':`${3+(i%7)/4}s`,'--angle':`${i*31}deg`,'--tone':i%3===0?'#dfbc76':i%3===1?'#fff5df':'#9db3d8'} as CSSProperties}/>)}</div>;
}

function MusicPlayer({variant,settings}:{variant:SongVariant;settings:EventSettings}) {
  const audio = useRef<HTMLAudioElement | null>(null);
  const [playing,setPlaying] = useState(false);
  const [seconds,setSeconds] = useState(0);
  const src = safeHref(variant==='special_1' ? settings.music_special_1_url : variant==='special_2' ? settings.music_special_2_url : settings.music_default_url);
  const start = Math.max(0, Number(variant==='special_1' ? settings.music_special_1_start : variant==='special_2' ? settings.music_special_2_start : settings.music_default_start) || 0);
  useEffect(()=>{setPlaying(false);setSeconds(0);if(audio.current){audio.current.pause();try{audio.current.currentTime=start;}catch{/* waiting for metadata */}}},[src,start]);
  const toggle = async () => {
    if (!audio.current || !src) return;
    if (playing) {audio.current.pause();setPlaying(false);return;}
    try {
      if (audio.current.currentTime < start || audio.current.currentTime >= start+29.95 || seconds>=30) {
        audio.current.currentTime=start;setSeconds(0);
      }
      await audio.current.play();setPlaying(true);
    } catch {setPlaying(false);}
  };
  const youtubeId = youtubeVideoId(src);
  if (youtubeId) return <div className="youtube-invitation-music">
    <div className="music-player"><div className="music-disc"><Music2 size={20}/></div><div className="music-info"><strong>{songs[variant]}</strong><span>Video de YouTube desde {Math.floor(start/60)}:{String(Math.floor(start%60)).padStart(2,'0')} · 30 segundos</span></div></div>
    <YouTubeClipEmbed id={youtubeId} start={start} title={`Canción de graduación: ${songs[variant]}`} />
    <p>Toca Play en el video para escuchar tu canción. YouTube requiere mostrar su reproductor y puede incluir anuncios.</p>
  </div>;
  return <div className="music-player">
    <div className="music-disc"><Music2 size={20}/></div>
    <div className="music-info"><strong>{songs[variant]}</strong><span>{src ? `Fragmento desde ${Math.floor(start/60)}:${String(Math.floor(start%60)).padStart(2,'0')} · 30 s` : 'La canción se agregará pronto'}</span><div className="audio-progress"><span style={{width:`${Math.min(100,seconds/30*100)}%`}} /></div></div>
    <button type="button" className="music-button" aria-label={playing?'Pausar música':'Reproducir música'} disabled={!src} onClick={toggle}>{playing?<Pause size={18} fill="currentColor"/>:<Play size={18} fill="currentColor"/>}</button>
    <audio ref={audio} src={src || undefined} preload="metadata" onLoadedMetadata={e=>{try{e.currentTarget.currentTime=start;}catch{/* no seek yet */}}} onTimeUpdate={e=>{const t=e.currentTarget.currentTime;const elapsed=Math.max(0,t-start);setSeconds(Math.min(30,elapsed));if(elapsed>=30){e.currentTarget.pause();setPlaying(false);}}} onEnded={()=>setPlaying(false)}/>
  </div>;
}

function Invitation({data,onRefresh}:{data:PublicInvite;onRefresh:()=>Promise<void>}) {
  const { settings, guest } = data;
  const [opened,setOpened] = useState(false);
  const [confetti,setConfetti] = useState(false);
  const [status,setStatus] = useState<'confirmed'|'declined'>(guest.status==='declined'?'declined':'confirmed');
  const [attendees,setAttendees] = useState(guest.attending_count || 1);
  const [message,setMessage] = useState(guest.message || '');
  const [saving,setSaving] = useState(false);
  const [saved,setSaved] = useState(false);
  const [error,setError] = useState('');
  const [giftOpen,setGiftOpen] = useState<'cash'|'ideas'|null>(null);
  useEffect(() => {
    if(!opened) return;
    const obs = new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting)e.target.classList.add('revealed');}),{threshold:.12});
    document.querySelectorAll('.reveal').forEach(el=>obs.observe(el));
    return ()=>obs.disconnect();
  },[opened]);
  const start = () => {setOpened(true);setConfetti(true);window.setTimeout(()=>setConfetti(false),6500);};
  const save = async (e:FormEvent) => {
    e.preventDefault();setError('');setSaving(true);
    try {await submitRSVP(guest.share_token,status,status==='confirmed'?attendees:0,message);setSaved(true);await onRefresh();setConfetti(true);window.setTimeout(()=>setConfetti(false),6500);}
    catch(err){setError((err as Error).message);}
    finally{setSaving(false);}
  };
  return <div className={`invitation ${opened?'invitation-opened':''}`}>
    <Confetti active={confetti}/>
    {!opened ? <div className="envelope-screen">
      <div className="math-stars" aria-hidden="true"><span>∑</span><span>∞</span><span>π</span><span>√</span><span>∫</span><span>α</span><span>≡</span></div>
      <div className="envelope-intro fade-in-down"><div className="tiny-line"/><p>HAY MOMENTOS QUE MERECEN CELEBRARSE</p><h1>Una invitación <em>especial</em> para ti</h1></div>
      <div className="envelope" onClick={start} role="button" tabIndex={0} onKeyDown={e=>e.key==='Enter'&&start()} aria-label="Abrir invitación personalizada">
        <div className="envelope-back"/><div className="envelope-letter"><GraduationCap size={40}/><span>Con mucho cariño</span><strong>{guest.name}</strong><i>✧</i></div><div className="envelope-flap"/><div className="envelope-front"/><div className="wax-seal">ℳ</div>
      </div>
      <button type="button" className="primary gold-btn envelope-cta" onClick={start}>Abrir mi invitación <Sparkles size={17}/></button>
      <div className="envelope-footer">18 · 12 · 2026 <span>✦</span> 6:00 P. M.</div>
    </div> : <>
      <header className="invite-nav"><span className="invite-brand"><GraduationCap size={19}/> <span>Mi graduación</span></span><div><span className="invite-nav-tag">18 DIC 2026</span><button type="button" className="nav-music" onClick={()=>document.getElementById('musica')?.scrollIntoView({behavior:'smooth'})} title="Ir a la música"><Music2 size={17}/></button></div></header>
      <main>
        <section className="invite-hero">
          <div className="hero-shine"/><div className="math-stars math-stars-open" aria-hidden="true"><span>∑</span><span>∞</span><span>π</span><span>√</span><span>∫</span><span>α</span><span>≡</span></div>
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
          <div className="polaroid-row">{[0,1,2].map(i=><GraduatesPhoto key={i} src={settings.photo_urls[i] || ''} index={i}/>)}</div>
          <div id="musica"><MusicPlayer variant={guest.song_variant} settings={settings}/></div>
        </section>
        <section className="count-section reveal"><GoldStar/><div className="section-eyebrow">CADA SEGUNDO NOS ACERCA</div><h2>Falta poquito para <em>celebrar</em></h2><Countdown date={settings.event_datetime}/><p>El tiempo corre y la emoción crece. ¡Nos vemos muy pronto!</p></section>
        <section className="detail-section reveal" id="detalles"><div className="section-eyebrow">GUARDA ESTA FECHA</div><h2>Fecha, hora <em>y lugar</em></h2><div className="detail-cards">
          <div className="detail-card"><div className="detail-icon"><CalendarDays size={25}/></div><span className="small-label">EL GRAN DÍA</span><h3>Viernes 18 de diciembre</h3><p>2026 · 6:00 de la tarde</p><div className="detail-deco">✦ ✦ ✦</div></div>
          <div className="detail-card"><div className="detail-icon"><MapPin size={26}/></div><span className="small-label">NOS ENCONTRAREMOS EN</span><h3>{settings.venue_name}</h3><p>{settings.venue_address}</p>{safeHref(settings.maps_url) ? <a href={safeHref(settings.maps_url)} target="_blank" rel="noreferrer" className="detail-link">Ver ubicación <ExternalLink size={16}/></a> : <span className="detail-link muted-link">Dirección pendiente</span>}</div>
        </div><div className="dresscode"><span>✧</span><div><strong>Código de vestuario</strong><p>{settings.dress_code}</p></div><span>✧</span></div></section>
        <section className="invitee-section reveal"><div className="section-eyebrow">UN LUGAR RESERVADO PARA TI</div><div className="quota-number">{String(guest.seats).padStart(2,'0')}</div><h2>{guest.seats===1?'Cupo reservado':'Cupos reservados'}</h2><p>{data.group_name ? `Grupo: ${data.group_name}. ` : ''}Preparamos {guest.seats===1?'un espacio especial':'estos espacios especiales'} para que compartamos esta celebración.</p></section>
        <section className="gifts-section reveal"><Gift size={31} strokeWidth={1.3}/><div className="section-eyebrow">UN DETALLE CON MUCHO CARIÑO</div><h2>Tu presencia es <em>mi mejor regalo</em></h2><p className="section-lead">Si deseas tener un detalle adicional, estas son algunas ideas.</p><div className="gift-cards">
          <button type="button" className={`gift-card ${giftOpen==='cash'?'gift-expanded':''}`} onClick={()=>setGiftOpen(giftOpen==='cash'?null:'cash')}><div className="gift-symbol">✉</div><strong>Lluvia de sobres</strong><span>Un detalle de corazón</span><ChevronDown size={18}/>{giftOpen==='cash'&&<p>{settings.gift_cash_text}</p>}</button>
          <button type="button" className={`gift-card ${giftOpen==='ideas'?'gift-expanded':''}`} onClick={()=>setGiftOpen(giftOpen==='ideas'?null:'ideas')}><div className="gift-symbol">✧</div><strong>Regalo especial</strong><span>Un recuerdo para siempre</span><ChevronDown size={18}/>{giftOpen==='ideas'&&<p>{settings.gift_ideas_text}</p>}</button>
        </div></section>
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

function AuthScreen({onSuccess}:{onSuccess:()=>void}) {
  const [email,setEmail]=useState('');const [password,setPassword]=useState('');const [signup,setSignup]=useState(false);
  const [busy,setBusy]=useState(false);const [notice,setNotice]=useState('');
  const submit=async(e:FormEvent)=>{e.preventDefault();setNotice('');setBusy(true);try{if(signup){await signUp(email,password);setNotice('Cuenta creada. Si Supabase solicita confirmar el correo, revisa tu bandeja antes de entrar.');}else{await signIn(email,password);onSuccess();}}catch(err){setNotice((err as Error).message);}finally{setBusy(false);}};
  return <div className="auth-screen"><div className="auth-content"><div className="auth-graphic"><GraduationCap size={40} strokeWidth={1.2}/><h1>Invitaciones <i>con alma.</i></h1><p>Una celebración merece una experiencia inolvidable.</p><div className="auth-formula">∑ sueños + ∞ esfuerzo = un gran logro</div></div><form className="auth-card" onSubmit={submit}><div className="auth-icon"><ShieldCheck size={25}/></div><h2>{signup?'Crea tu cuenta':'Bienvenido al panel'}</h2><p>{signup?'Guarda tus invitados con seguridad.':'Accede a tus invitados y confirmaciones.'}</p><label>Correo electrónico<input required type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="tucorreo@ejemplo.com"/></label><label>Contraseña<input required minLength={6} type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Mínimo 6 caracteres"/></label>{notice&&<div className="notice">{notice}</div>}<button className="primary" type="submit" disabled={busy}>{busy?'Procesando...':signup?'Crear cuenta':'Entrar al panel'} <ArrowRight size={17}/></button><button className="text-button" type="button" onClick={()=>{setSignup(!signup);setNotice('');}}>{signup?'¿Ya tienes una cuenta? Inicia sesión':'¿Primera vez? Crea tu cuenta'}</button></form></div></div>;
}

type TabKey = 'overview' | 'guests' | 'groups' | 'responses' | 'settings';
function Admin() {
  const [userId,setUserId] = useState<string|null>(null);
  const [authLoading,setAuthLoading] = useState(hasCloud);
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
  useEffect(()=>{
    if(!supabase){setAuthLoading(false);return;}
    void currentUser().then(u=>setUserId(u?.id||null)).finally(()=>setAuthLoading(false));
    const {data:sub}=supabase.auth.onAuthStateChange((_event,session)=>setUserId(session?.user.id||null));
    return ()=>sub.subscription.unsubscribe();
  },[]);
  useEffect(()=>{
    if(!hasCloud || !userId || (tab !== 'responses' && tab !== 'overview')) return;
    const timer=window.setInterval(()=>{
      void loadDashboard().then(latest=>setData(latest)).catch(()=>{});
    },12000);
    return ()=>window.clearInterval(timer);
  },[userId,tab]);
  const refresh = useCallback(async()=>{
    try{const loaded=await loadDashboard();setData(loaded);setSettingsDraft(loaded.settings);}
    catch(err){setNotice((err as Error).message);}
  },[]);
  useEffect(()=>{if(!hasCloud||userId){setBusy(true);void refresh().finally(()=>setBusy(false));}},[userId,refresh]);
  const tell=(msg:string)=>{setNotice(msg);window.setTimeout(()=>setNotice(''),4500);};
  async function mutate(action:()=>Promise<void>,ok:string){setBusy(true);try{await action();await refresh();tell(ok);}catch(e){tell(`Error: ${(e as Error).message}`);}finally{setBusy(false);}}
  const editGuest=(g?:Guest)=>{if(!data)return;setGuestEditing(g||{id:makeId(),event_id:data.settings.id,group_id:null,name:'',seats:1,phone:'',song_variant:'default',share_token:makeToken(),status:'pending',attending_count:0,message:'',confirmed_at:null,created_at:new Date().toISOString()});setShowGuestDialog(true);};
  const editGroup=(g?:GuestGroup)=>{if(!data)return;setGroupEditing(g||{id:makeId(),event_id:data.settings.id,name:'',default_seats:1,notes:''});setShowGroupDialog(true);};
  async function copyLink(guest:Guest){try{await copyText(invitationUrl(guest.share_token));tell('¡Enlace copiado! Listo para compartir.');}catch{tell('No se pudo copiar. Usa el botón de WhatsApp.');}}
  const filtered = (data?.guests || []).filter(g=>(filterGroup==='all'||g.group_id===filterGroup)&&[g.name,g.phone,data?.groups.find(gr=>gr.id===g.group_id)?.name||''].join(' ').toLowerCase().includes(search.toLowerCase()));
  const confirmed=data?.guests.filter(g=>g.status==='confirmed')||[];
  const declined=data?.guests.filter(g=>g.status==='declined')||[];
  const totalSeats=data?.guests.reduce((n,g)=>n+g.seats,0)||0;
  const confirmedSeats=confirmed.reduce((n,g)=>n+g.attending_count,0);
  const menu: {key:TabKey;label:string;icon:typeof LayoutDashboard}[]=[
    {key:'overview',label:'Inicio',icon:LayoutDashboard},{key:'guests',label:'Invitaciones',icon:Mail},{key:'groups',label:'Grupos',icon:Users},{key:'responses',label:'Confirmaciones',icon:ClipboardCheck},{key:'settings',label:'Personalización',icon:Settings2}
  ];
  if(authLoading)return <div className="full-load admin-loading"><div className="spinner"/>Conectando panel...</div>;
  if(hasCloud&&!userId)return <AuthScreen onSuccess={()=>void currentUser().then(u=>setUserId(u?.id||null))}/>;
  return <div className="dashboard-shell">
    <aside className={`sidebar ${mobileMenu?'mobile-visible':''}`}><div className="sidebar-brand"><div className="logo-square"><GraduationCap size={23}/></div><div><strong>GRADO<span>PRO</span></strong><small>STUDIO DE INVITACIONES</small></div></div><p className="side-section-label">MI ESPACIO</p><nav className="sidebar-nav">{menu.map(item=><button key={item.key} onClick={()=>{setTab(item.key);setMobileMenu(false);}} className={tab===item.key?'nav-active':''}><item.icon size={19}/>{item.label}{item.key==='responses'&&confirmed.length>0&&<span className="nav-counter">{confirmed.length}</span>}</button>)}</nav><div className="sidebar-spacer"/><div className="side-help"><Sparkles size={19}/><strong>Tu noche, a tu manera.</strong><p>Crea recuerdos, comparte emociones y celebra sin límites.</p></div><div className="side-footer">{hasCloud?<><ShieldCheck size={16}/> Nube conectada <button onClick={()=>void signOut()} title="Salir"><LogOut size={16}/></button></>:<><CircleHelp size={16}/> Modo demostración</>}</div></aside>
    {mobileMenu&&<div className="mobile-overlay" onClick={()=>setMobileMenu(false)}/>}
    <div className="main-panel"><header className="admin-topbar"><div className="topbar-left"><button className="mobile-nav-btn" onClick={()=>setMobileMenu(true)} aria-label="Abrir menú"><Menu size={22}/></button><span className="topbar-breadcrumb">GRADOPRO</span><span className="slash">/</span><span>{menu.find(item=>item.key===tab)?.label}</span></div><div className="topbar-right"><span className={`connection-dot ${hasCloud?'connected':''}`}/><span className="connection-label">{hasCloud?'Sincronizado':'Solo este dispositivo'}</span><div className="profile-circle">{initials(data?.settings.graduate_name||'Graduación')}</div></div></header>
    <div className="admin-content">
      {notice&&<div className="toast-message"><Sparkles size={16}/>{notice}<button onClick={()=>setNotice('')}><X size={15}/></button></div>}
      {!hasCloud&&<div className="demo-banner"><div><ShieldCheck size={18}/><span><strong>Modo demostración:</strong> los cambios se guardan en este navegador. Para que los enlaces funcionen en otros celulares y las confirmaciones lleguen al panel, conecta Supabase y publica la web.</span></div><a href="https://supabase.com" target="_blank" rel="noreferrer">Conectar nube <ArrowRight size={14}/></a></div>}
      {!data ? <div className="empty-state"><span className="spinner"/> {busy?'Cargando tus invitaciones...':'No pudimos cargar los datos. Revisa la configuración de Supabase.'}<button onClick={()=>void refresh()}>Reintentar</button></div> : <>
      {tab==='overview'&&<>
        <section className="dashboard-greeting"><div><div className="admin-eyebrow"><Sparkles size={16}/> TU EVENTO MÁS ESPECIAL</div><h1>¡Hagamos de esta noche <em>algo inolvidable!</em></h1><p>Organiza tus invitados, personaliza cada detalle y vive la emoción de las confirmaciones.</p><div className="greeting-actions"><button className="primary" onClick={()=>editGuest()}><Plus size={17}/> Crear invitación</button><button className="outline-button" onClick={()=>setTab('settings')}><WandSparkles size={17}/> Personalizar evento</button></div></div><div className="greeting-art" aria-hidden="true"><span>π</span><GraduationCap size={100} strokeWidth={.75}/><span>∞</span></div></section>
        <div className="metrics-grid"><Metric label="Invitaciones" value={data.guests.length} icon={Mail} suffix="registradas"/><Metric label="Cupos asignados" value={totalSeats} icon={Users} suffix="en total"/><Metric label="Confirmados" value={confirmedSeats} icon={CheckCircle2} suffix="asistentes"/><Metric label="Pendientes" value={data.guests.filter(g=>g.status==='pending').length} icon={Clock3} suffix="por responder"/></div>
        <div className="overview-layout"><div className="admin-card"><div className="card-header"><div><h3>Catálogo de invitaciones</h3><p>Tu colección personalizada, lista para enviar.</p></div><button className="subtle-button" onClick={()=>setTab('guests')}>Ver todas <ArrowRight size={16}/></button></div>{data.guests.length?<div className="catalog-grid">{data.guests.slice(0,4).map(g=><CatalogCard key={g.id} guest={g} group={data.groups.find(gr=>gr.id===g.group_id)} settings={data.settings} onCopy={()=>void copyLink(g)}/>)}</div>:<EmptyCatalog onAdd={()=>editGuest()}/>}</div><div className="admin-card side-overview"><div className="card-header"><div><h3>El gran día</h3><p>Cuenta regresiva en vivo</p></div><CalendarDays size={20}/></div><div className="side-date"><span>18</span><div>DICIEMBRE <strong>2026</strong><small>6:00 P. M. · COLOMBIA</small></div></div><Countdown date={data.settings.event_datetime}/><div className="next-steps"><h4>Últimas respuestas</h4>{[...data.guests].filter(g=>g.status!=='pending').slice(0,3).map(g=><div key={g.id}><span className="tiny-avatar">{initials(g.name)}</span><span>{g.name}</span><b className={`tiny-status ${statusClass[g.status]}`}>{g.status==='confirmed'?'Confirmó':'No asistirá'}</b></div>)}{!data.guests.some(g=>g.status!=='pending')&&<p className="soft-note">Las confirmaciones aparecerán aquí.</p>}</div></div></div>
      </>}
      {tab==='guests'&&<><AdminHeading eyebrow="PERSONALIZA Y COMPARTE" title="Mis invitaciones" detail="Cada invitado recibe una experiencia única, con su nombre, cupos y música." action={<button className="primary" onClick={()=>editGuest()}><Plus size={18}/> Nueva invitación</button>}/><div className="admin-card guest-table-card"><div className="table-filters"><div className="search-field"><Search size={18}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar invitado o teléfono..."/></div><select value={filterGroup} onChange={e=>setFilterGroup(e.target.value)}><option value="all">Todos los grupos</option>{data.groups.map(g=><option key={g.id} value={g.id}>{g.name}</option>)}</select><span className="results-count">{filtered.length} invitaciones</span></div><div className="table-wrap"><table className="admin-table"><thead><tr><th>INVITADO</th><th>GRUPO</th><th>CUPOS</th><th>MÚSICA</th><th>RESPUESTA</th><th>ACCIONES</th></tr></thead><tbody>{filtered.map(g=><tr key={g.id}><td><div className="guest-cell"><span className="avatar-small">{initials(g.name)}</span><div><strong>{g.name}</strong><small>{g.phone || 'Sin número de WhatsApp'}</small></div></div></td><td>{data.groups.find(gr=>gr.id===g.group_id)?.name||<span className="muted">Sin grupo</span>}</td><td><span className="quota-pill"><Users size={13}/>{g.seats}</span></td><td><span className="song-chip"><Music2 size={13}/>{songs[g.song_variant]}</span></td><td><span className={`status-pill ${statusClass[g.status]}`}>{statusText[g.status]}</span></td><td><div className="actions-row"><button title="Copiar enlace" onClick={()=>void copyLink(g)}><Copy size={16}/></button><a href={whatsappUrl(g,data.settings)} title="Enviar por WhatsApp" target="_blank" rel="noreferrer"><MessageCircle size={16}/></a><a href={`#/i/${g.share_token}`} title="Ver invitación" target="_blank" rel="noreferrer"><ExternalLink size={16}/></a><button title="Editar" onClick={()=>editGuest(g)}><Pencil size={16}/></button><button title="Eliminar" className="delete-icon" onClick={()=>{if(confirm(`¿Eliminar definitivamente la invitación de ${g.name}?`))void mutate(()=>removeGuest(g.id),'Invitación eliminada.');}}><Trash2 size={16}/></button></div></td></tr>)}</tbody></table>{filtered.length===0&&<div className="table-empty">No hay invitaciones con estos filtros. <button onClick={()=>editGuest()}>Crear una</button></div>}</div></div></>}
      {tab==='groups'&&<><AdminHeading eyebrow="ORGANIZA A TU GENTE" title="Grupos de invitados" detail="Crea grupos como familia, amigos, docentes o compañeros. Después asigna cada invitación." action={<button className="primary" onClick={()=>editGroup()}><Plus size={18}/> Nuevo grupo</button>}/><div className="groups-grid">{data.groups.map(g=><div key={g.id} className="admin-card group-card"><div className="group-card-top"><div className="group-icon"><Users size={24}/></div><div className="actions-row"><button onClick={()=>editGroup(g)} title="Editar grupo"><Edit3 size={16}/></button><button className="delete-icon" onClick={()=>{if(confirm(`¿Eliminar el grupo ${g.name}? Las invitaciones no se borrarán.`))void mutate(()=>removeGroup(g.id),'Grupo eliminado.');}} title="Eliminar grupo"><Trash2 size={16}/></button></div></div><h3>{g.name}</h3><p>{g.notes||'Grupo de invitados especiales'}</p><div className="group-card-footer"><span>{data.guests.filter(guest=>guest.group_id===g.id).length} invitaciones</span><span>{g.default_seats} cupos sugeridos</span></div></div>)}<button className="add-group-card" onClick={()=>editGroup()}><Plus size={30}/><strong>Agregar grupo</strong><span>Organiza mejor tu celebración</span></button></div></>}
      {tab==='responses'&&<><AdminHeading eyebrow="LA EMOCIÓN DE CADA RESPUESTA" title="Confirmaciones" detail="Consulta respuestas actualizadas automáticamente, los cupos utilizados y los mensajes." action={<button className="outline-button" onClick={()=>exportCSV(data)}><Download size={17}/> Exportar CSV</button>}/><div className="metrics-grid metrics-short"><Metric label="Confirmaron" value={confirmed.length} icon={BadgeCheck} suffix="invitaciones"/><Metric label="Personas que asistirán" value={confirmedSeats} icon={Users} suffix="asistentes"/><Metric label="No asistirán" value={declined.length} icon={XCircle} suffix="respuestas"/><Metric label="Faltan por responder" value={data.guests.length-confirmed.length-declined.length} icon={Clock3} suffix="invitaciones"/></div><div className="admin-card responses-card"><div className="card-header"><h3>Listado de respuestas</h3><span>{data.guests.length} invitaciones enviables</span></div><div className="table-wrap"><table className="admin-table"><thead><tr><th>INVITADO</th><th>ESTADO</th><th>ASISTENTES</th><th>MENSAJE</th><th>FECHA</th></tr></thead><tbody>{data.guests.map(g=><tr key={g.id}><td><strong>{g.name}</strong></td><td><span className={`status-pill ${statusClass[g.status]}`}>{statusText[g.status]}</span></td><td>{g.status==='confirmed'?`${g.attending_count} / ${g.seats}`:'—'}</td><td className="message-preview">{g.message||'—'}</td><td>{g.confirmed_at?new Intl.DateTimeFormat('es-CO',{dateStyle:'short',timeStyle:'short',timeZone:'America/Bogota'}).format(new Date(g.confirmed_at)):'—'}</td></tr>)}</tbody></table></div></div></>}
      {tab==='settings'&&settingsDraft&&<><AdminHeading eyebrow="DISEÑA UNA EXPERIENCIA ÚNICA" title="Personaliza tu evento" detail="Estos detalles se reflejarán automáticamente en todas las invitaciones." action={<button className="primary" disabled={savingSettings} onClick={()=>void mutateSettings()}><Check size={18}/>{savingSettings?'Guardando...':'Guardar cambios'}</button>}/><div className="settings-layout"><div className="settings-main"><div className="admin-card settings-card"><div className="card-header"><div><h3><GraduationCap size={20}/> Datos de la graduación</h3><p>La información principal que verán tus invitados.</p></div></div><div className="form-grid"><Field label="Nombre del graduando" value={settingsDraft.graduate_name} onChange={v=>updateSettings('graduate_name',v)}/><Field label="Título o carrera" value={settingsDraft.degree} onChange={v=>updateSettings('degree',v)}/><Field label="Frase de portada" value={settingsDraft.headline} onChange={v=>updateSettings('headline',v)}/><Field label="Fecha y hora (Colombia)" type="datetime-local" value={dateForInput(settingsDraft.event_datetime)} onChange={v=>updateSettings('event_datetime',`${v}:00-05:00`)}/><Field label="Nombre del lugar" value={settingsDraft.venue_name} onChange={v=>updateSettings('venue_name',v)}/><Field label="Dirección completa" value={settingsDraft.venue_address} onChange={v=>updateSettings('venue_address',v)}/><Field label="Enlace de Google Maps" value={settingsDraft.maps_url} onChange={v=>updateSettings('maps_url',v)} placeholder="https://maps.google.com/..."/><Field label="Código de vestuario" value={settingsDraft.dress_code} onChange={v=>updateSettings('dress_code',v)}/><Field label="Fecha límite de confirmación" type="date" value={settingsDraft.rsvp_deadline} onChange={v=>updateSettings('rsvp_deadline',v)}/></div><label className="block-label">Mensaje de bienvenida<textarea value={settingsDraft.intro} rows={3} onChange={e=>updateSettings('intro',e.target.value)}/></label><label className="block-label">Mensaje final<textarea value={settingsDraft.closing_message} rows={2} onChange={e=>updateSettings('closing_message',e.target.value)}/></label></div>
        <div className="admin-card settings-card"><div className="card-header"><div><h3><Music2 size={20}/> Canciones de 30 segundos</h3><p>Una canción general y dos canciones para invitados elegidos.</p></div></div><div className="asset-stack">{([{key:'music_default_url',startKey:'music_default_start',label:'Canción principal',section:'music-main'},{key:'music_special_1_url',startKey:'music_special_1_start',label:'Canción especial 1',section:'music-special-1'},{key:'music_special_2_url',startKey:'music_special_2_start',label:'Canción especial 2',section:'music-special-2'}] as const).map(item=><MusicClipPicker key={item.key} label={item.label} value={settingsDraft[item.key]} start={settingsDraft[item.startKey] ?? 0} onValue={v=>{updateSettings(item.key,v);updateSettings(item.startKey,0);}} onStart={n=>updateSettings(item.startKey,n)} onUpload={f=>handleUpload(f,item.section,v=>{updateSettings(item.key,v);updateSettings(item.startKey,0);})} uploading={uploading===item.section}/>)}</div><p className="form-help"><Volume2 size={16}/> Para YouTube, se muestra el reproductor de video y el invitado debe pulsar Play. Para MP3, se usa el reproductor musical. Cada fragmento dura 30 segundos.</p></div>
        <div className="admin-card settings-card"><div className="card-header"><div><h3><Gift size={20}/> Ideas de regalos</h3><p>Puedes mostrar las dos opciones a todos los invitados.</p></div></div><label className="block-label">Opción 1 · Lluvia de sobres<textarea value={settingsDraft.gift_cash_text} rows={3} onChange={e=>updateSettings('gift_cash_text',e.target.value)}/></label><label className="block-label">Opción 2 · Regalo especial<textarea value={settingsDraft.gift_ideas_text} rows={3} onChange={e=>updateSettings('gift_ideas_text',e.target.value)}/></label></div>
        <div className="admin-card settings-card"><div className="card-header"><div><h3><Sparkles size={20}/> Galería de recuerdos</h3><p>Agrega hasta tres fotografías del graduando.</p></div></div><div className="asset-stack">{[0,1,2].map(i=><AssetField key={i} label={`Fotografía ${i+1}`} type="image" value={settingsDraft.photo_urls[i]||''} onValue={v=>updateSettings('photo_urls',[...settingsDraft.photo_urls.slice(0,i),v,...settingsDraft.photo_urls.slice(i+1)])} onUpload={f=>handleUpload(f,`photo-${i}`,v=>updateSettings('photo_urls',[...settingsDraft.photo_urls.slice(0,i),v,...settingsDraft.photo_urls.slice(i+1)]))} uploading={uploading===`photo-${i}`}/>)}</div></div>
      </div><div className="settings-side"><div className="admin-card live-preview-card"><div className="section-eyebrow">VISTA PREVIA</div><div className="preview-mini"><GraduationCap size={36}/><p className="script">El gran día</p><h3>{settingsDraft.graduate_name||'Mi graduación'}</h3><span>{settingsDraft.degree}</span><div>✦ 18 · 12 · 2026 ✦</div></div><p>Así se verá la portada de las invitaciones.</p><button className="outline-button" onClick={()=>{if(data.guests.length)window.open(invitationUrl(data.guests[0].share_token),'_blank');else tell('Primero crea una invitación para abrir su vista previa.');}}>Abrir invitación de prueba <ExternalLink size={16}/></button></div><div className="admin-card tips-card"><ShieldCheck size={22}/><h4>Tu información está protegida</h4><p>{hasCloud?'Los nombres y teléfonos se guardan en Supabase y solo son visibles desde el panel autenticado.':'Estás usando el modo local; conecta la nube antes de compartir enlaces.'}</p></div></div></div></>}
      </>}
    </div></div>
    {showGuestDialog&&guestEditing&&data&&<GuestDialog initial={guestEditing} groups={data.groups} onClose={()=>setShowGuestDialog(false)} onSave={async g=>{await mutate(()=>saveGuest(g),'Invitación guardada correctamente.');setShowGuestDialog(false);}}/>}
    {showGroupDialog&&groupEditing&&<GroupDialog initial={groupEditing} onClose={()=>setShowGroupDialog(false)} onSave={async g=>{await mutate(()=>saveGroup(g),'Grupo guardado correctamente.');setShowGroupDialog(false);}}/>}
  </div>;
  function updateSettings<K extends keyof EventSettings>(key:K,value:EventSettings[K]) {setSettingsDraft(prev=>prev?{...prev,[key]:value}:prev);}
  async function mutateSettings(){if(!settingsDraft)return;setSavingSettings(true);try{await saveSettings(settingsDraft);await refresh();tell('¡Evento actualizado! Los cambios ya se reflejan en las invitaciones.');}catch(e){tell(`Error: ${(e as Error).message}`);}finally{setSavingSettings(false);}}
  async function handleUpload(file:File,section:string,done:(url:string)=>void){setUploading(section);try{if(!userId)throw new Error('Conecta Supabase para subir fotos y canciones.');const result=await uploadAsset(file,section,userId);done(result);tell('Archivo subido. Ahora pulsa Guardar cambios para publicarlo.');}catch(e){tell((e as Error).message);}finally{setUploading('');}}
}

function Metric({label,value,icon:Icon,suffix}:{label:string;value:number;icon:typeof Mail;suffix:string}) {return <div className="metric-card"><div className="metric-top"><span>{label}</span><div><Icon size={19}/></div></div><strong>{value}</strong><small>{suffix}</small></div>;}
function AdminHeading({eyebrow,title,detail,action}:{eyebrow:string;title:string;detail:string;action:ReactNode}) {return <div className="admin-heading"><div><div className="admin-eyebrow">{eyebrow}</div><h1>{title}</h1><p>{detail}</p></div>{action}</div>;}
function EmptyCatalog({onAdd}:{onAdd:()=>void}) {return <div className="empty-catalog"><Mail size={29}/><h4>Todo empieza con una invitación</h4><p>Registra a tu primer invitado y comparte un momento único.</p><button className="primary" onClick={onAdd}><Plus size={16}/> Nueva invitación</button></div>;}
function CatalogCard({guest,group,settings,onCopy}:{guest:Guest;group?:GuestGroup;settings:EventSettings;onCopy:()=>void}) {return <div className="catalog-card"><div className="catalog-cover"><div className="cover-stars">✦ ✧ ✦</div><GraduationCap size={30} strokeWidth={1}/><span className="script">Una noche especial</span><strong>{guest.name}</strong><small>18 · DICIEMBRE · 2026</small></div><div className="catalog-body"><div className="catalog-meta"><span>{group?.name||'Sin grupo'} · {guest.seats} {guest.seats===1?'cupo':'cupos'}</span><span className={`catalog-status ${statusClass[guest.status]}`}>{statusText[guest.status]}</span></div><div className="catalog-actions"><button onClick={onCopy}><Copy size={15}/> Copiar enlace</button><a href={whatsappUrl(guest,settings)} target="_blank" rel="noreferrer" title="Enviar por WhatsApp"><MessageCircle size={17}/></a><a href={`#/i/${guest.share_token}`} target="_blank" rel="noreferrer" title="Ver invitación"><ExternalLink size={16}/></a></div></div></div>;}

function GuestDialog({initial,groups,onSave,onClose}:{initial:Guest;groups:GuestGroup[];onSave:(guest:Guest)=>Promise<void>;onClose:()=>void}) {
  const [guest,setGuest]=useState(initial);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const save=async(e:FormEvent)=>{e.preventDefault();if(!guest.name.trim()){setError('Escribe el nombre del invitado.');return;}setBusy(true);setError('');try{await onSave({...guest,name:guest.name.trim(),seats:Math.max(1,Math.min(50,guest.seats)),attending_count:Math.min(guest.attending_count,guest.seats)});}catch(err){setError((err as Error).message);}finally{setBusy(false);}};
  return <div className="modal-shade" onMouseDown={e=>{if(e.currentTarget===e.target)onClose();}}><form className="modal" onSubmit={save}><div className="modal-head"><div><div className="admin-eyebrow">INVITACIÓN PERSONALIZADA</div><h2>{initial.name?'Editar invitación':'Nueva invitación'}</h2></div><button type="button" onClick={onClose} aria-label="Cerrar"><X size={20}/></button></div><p className="modal-lead">Cada persona recibirá un enlace exclusivo con su nombre y cupos asignados.</p><div className="modal-form"><label>Nombre de la persona o familia <span>*</span><input required maxLength={100} autoFocus value={guest.name} onChange={e=>setGuest({...guest,name:e.target.value})} placeholder="Ej. Familia Rodríguez"/></label><div className="form-grid"><label>Grupo<select value={guest.group_id||''} onChange={e=>{const id=e.target.value;const gr=groups.find(g=>g.id===id);setGuest({...guest,group_id:id||null,seats:gr?gr.default_seats:guest.seats});}}><option value="">Sin grupo</option>{groups.map(g=><option key={g.id} value={g.id}>{g.name}</option>)}</select></label><label>Cupos asignados<input type="number" min={1} max={50} required value={guest.seats} onChange={e=>setGuest({...guest,seats:Number(e.target.value)})}/></label></div><label>WhatsApp <span>(Opcional)</span><input type="tel" value={guest.phone} onChange={e=>setGuest({...guest,phone:e.target.value})} placeholder="Ej. 573001234567"/><small>Incluye indicativo de país para enviar directamente.</small></label><label>Canción de esta invitación<select value={guest.song_variant} onChange={e=>setGuest({...guest,song_variant:e.target.value as SongVariant})}><option value="default">Principal · Para la mayoría de invitados</option><option value="special_1">Especial 1 · Invitado seleccionado</option><option value="special_2">Especial 2 · Invitado seleccionado</option></select></label><div className="modal-notice"><Music2 size={18}/>Puedes seleccionar exactamente dos invitaciones con música especial; las demás usarán la canción principal.</div></div>{error&&<p className="form-error">{error}</p>}<div className="modal-foot"><button type="button" className="outline-button" onClick={onClose}>Cancelar</button><button type="submit" className="primary" disabled={busy}>{busy?'Guardando...':'Guardar invitación'} <Check size={17}/></button></div></form></div>;
}
function GroupDialog({initial,onSave,onClose}:{initial:GuestGroup;onSave:(g:GuestGroup)=>Promise<void>;onClose:()=>void}) {
  const [group,setGroup]=useState(initial),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const save=async(e:FormEvent)=>{e.preventDefault();setBusy(true);try{await onSave({...group,name:group.name.trim()});}catch(err){setError((err as Error).message);}finally{setBusy(false);}};
  return <div className="modal-shade" onMouseDown={e=>{if(e.currentTarget===e.target)onClose();}}><form className="modal modal-small" onSubmit={save}><div className="modal-head"><h2>{initial.name?'Editar grupo':'Nuevo grupo'}</h2><button type="button" onClick={onClose}><X size={20}/></button></div><div className="modal-form"><label>Nombre del grupo<input required maxLength={80} autoFocus placeholder="Familia, Amigos, Compañeros..." value={group.name} onChange={e=>setGroup({...group,name:e.target.value})}/></label><label>Cupos sugeridos por invitación<input required type="number" min={1} max={50} value={group.default_seats} onChange={e=>setGroup({...group,default_seats:Number(e.target.value)})}/></label><label>Descripción <span>(Opcional)</span><textarea rows={3} value={group.notes} onChange={e=>setGroup({...group,notes:e.target.value})}/></label></div>{error&&<p className="form-error">{error}</p>}<div className="modal-foot"><button type="button" className="outline-button" onClick={onClose}>Cancelar</button><button className="primary" disabled={busy} type="submit">Guardar grupo <Check size={17}/></button></div></form></div>;
}
function Field({label,value,onChange,type='text',placeholder}:{label:string;value:string;onChange:(value:string)=>void;type?:string;placeholder?:string}) {return <label>{label}<input value={value} type={type} placeholder={placeholder} onChange={e=>onChange(e.target.value)}/></label>;}
function AssetField({label,type,value,onValue,onUpload,uploading}:{label:string;type:'audio'|'image';value:string;onValue:(s:string)=>void;onUpload:(f:File)=>void;uploading:boolean}) {
  const inputRef=useRef<HTMLInputElement|null>(null);
  return <div className="asset-field"><div className="asset-head"><strong>{label}</strong><span>{type==='audio'?'MP3 / M4A / OGG · máx. 15 MB':'JPG / PNG / WEBP · máx. 15 MB'}</span></div><div className="asset-control"><div className="asset-input-icon">{type==='audio'?<Music2 size={18}/>:<Sparkles size={18}/>}</div><input aria-label={`URL de ${label}`} placeholder="Pega el enlace del archivo o súbelo" value={value} onChange={e=>onValue(e.target.value)}/><input ref={inputRef} type="file" accept={type==='audio'?'audio/*':'image/*'} hidden onChange={(e:ChangeEvent<HTMLInputElement>)=>{const file=e.target.files?.[0];if(file)onUpload(file);e.target.value='';}}/><button type="button" className="outline-button" disabled={uploading} onClick={()=>inputRef.current?.click()}>{uploading?'Subiendo...':'Subir'}</button></div>{value&&<div className="asset-preview">{type==='audio'?<audio controls src={safeHref(value)||undefined} preload="none"/>:safeHref(value)?<img alt={`Vista previa ${label}`} src={safeHref(value)}/>:null}</div>}</div>;
}
function exportCSV(data:DashboardData) {
  const rows=[['Invitado','Grupo','Telefono','Cupos','Cancion','Estado','Asistentes','Mensaje','Fecha de respuesta','URL'],...data.guests.map(g=>[g.name,data.groups.find(gr=>gr.id===g.group_id)?.name||'',g.phone,String(g.seats),songs[g.song_variant],statusText[g.status],String(g.attending_count),g.message,g.confirmed_at||'',invitationUrl(g.share_token)])];
  const csv='\ufeff'+rows.map(row=>row.map(v=>{const sanitized=/^[=+@\-\t\r]/.test(v)?`'${v}`:v;return `"${sanitized.replaceAll('"','""')}"`;}).join(';')).join('\r\n');
  const blob=new Blob([csv],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),anchor=document.createElement('a');anchor.href=url;anchor.download='confirmaciones-grado.csv';anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1500);
}
