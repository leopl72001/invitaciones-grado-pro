import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import { DEFAULT_EVENT, type DashboardData, type EventSettings, type Guest, type GuestGroup, type PublicInvite, type RSVPStatus } from './types';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
export const hasCloud = Boolean(url && key);
export const supabase: SupabaseClient | null = hasCloud ? createClient(url!, key!, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
}) : null;

const STORAGE_KEY = 'grado-pro-demo-v1';
let localFallback = false;
export function setLocalFallback(enabled: boolean) { localFallback = enabled; }
export function isLocalMode() { return !supabase || localFallback; }
const copy = <T,>(obj: T): T => JSON.parse(JSON.stringify(obj)) as T;
export const makeId = () => crypto.randomUUID();
export const makeToken = () => `${crypto.randomUUID().replaceAll('-', '')}${crypto.randomUUID().replaceAll('-', '')}`;

function initialDemo(): DashboardData {
  const group1 = { id: makeId(), event_id: DEFAULT_EVENT.id, name: 'Familia', default_seats: 3, notes: '' };
  const group2 = { id: makeId(), event_id: DEFAULT_EVENT.id, name: 'Amigos', default_seats: 2, notes: '' };
  return {
    settings: copy(DEFAULT_EVENT), groups: [group1, group2], guests: [
      { id: makeId(), event_id: DEFAULT_EVENT.id, group_id: group1.id, name: 'Familia de ejemplo', seats: 3, phone: '', song_variant: 'default', share_token: makeToken(), status: 'pending', attending_count: 0, message: '', confirmed_at: null, created_at: new Date().toISOString() },
      { id: makeId(), event_id: DEFAULT_EVENT.id, group_id: group2.id, name: 'Invitado especial', seats: 2, phone: '', song_variant: 'special_1', share_token: makeToken(), status: 'pending', attending_count: 0, message: '', confirmed_at: null, created_at: new Date().toISOString() }
    ]
  };
}

function readDemo(): DashboardData {
  try { const v = localStorage.getItem(STORAGE_KEY); if (v) return JSON.parse(v) as DashboardData; } catch { /* modo privado */ }
  const value = initialDemo();
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(value)); } catch { /* sin almacenamiento */ }
  return value;
}
function writeDemo(data: DashboardData) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  window.dispatchEvent(new Event('invitations-data-changed'));
}

function guard(error: { message: string } | null) { if (error) throw new Error(error.message); }

export async function ensureAnonymousSession(): Promise<User | null> {
  if(!supabase) return null;
  const existing = await currentUser();
  if(existing) return existing;
  const {data,error} = await supabase.auth.signInAnonymously();
  guard(error);
  if(!data.user) throw new Error('No se pudo iniciar el acceso automático.');
  return data.user;
}

export async function currentUser(): Promise<User | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getUser();
  if (error) return null;
  return data.user;
}
export async function signIn(email: string, password: string) {
  if (!supabase) return;
  const { error } = await supabase.auth.signInWithPassword({ email, password }); guard(error);
}
export async function signUp(email: string, password: string) {
  if (!supabase) return;
  const { error } = await supabase.auth.signUp({ email, password }); guard(error);
}
export async function signOut() { if (supabase) { const { error } = await supabase.auth.signOut(); guard(error); } }

export async function loadDashboard(): Promise<DashboardData> {
  if (!supabase || isLocalMode()) return copy(readDemo());
  const user = await currentUser(); if (!user) throw new Error('No se pudo establecer el acceso automático a Supabase. Activa Anonymous Sign-Ins.');
  const fetched = await supabase.from('events').select('*').eq('owner_id', user.id).order('created_at').limit(1);
  guard(fetched.error);
  let settings = fetched.data?.[0] as EventSettings | undefined;
  if (!settings) {
    const { id: _demoId, ...base } = DEFAULT_EVENT;
    void _demoId;
    const inserted = await supabase.from('events').insert({ ...base, owner_id: user.id }).select('*').single();
    guard(inserted.error); settings = inserted.data as EventSettings;
  }
  const [groups, guests] = await Promise.all([
    supabase.from('guest_groups').select('*').eq('event_id', settings.id).order('name'),
    supabase.from('guests').select('*').eq('event_id', settings.id).order('created_at', { ascending: false })
  ]);
  guard(groups.error); guard(guests.error);
  return { settings, groups: (groups.data ?? []) as GuestGroup[], guests: (guests.data ?? []) as Guest[] };
}
export async function saveSettings(settings: EventSettings): Promise<void> {
  if (!supabase || isLocalMode()) { writeDemo({ ...readDemo(), settings }); return; }
  const { id: _id, owner_id: _owner, ...patch } = settings;
  void _id; void _owner;
  const { error } = await supabase.from('events').update(patch).eq('id', settings.id); guard(error);
}
export async function saveGroup(group: GuestGroup) {
  if (!supabase || isLocalMode()) { const d = readDemo(); d.groups = [group, ...d.groups.filter(g => g.id !== group.id)]; writeDemo(d); return; }
  const { error } = await supabase.from('guest_groups').upsert(group); guard(error);
}
export async function removeGroup(id: string) {
  if (!supabase || isLocalMode()) { const d = readDemo(); d.groups = d.groups.filter(g => g.id !== id); d.guests = d.guests.map(g => g.group_id === id ? { ...g, group_id: null } : g); writeDemo(d); return; }
  const { error } = await supabase.from('guest_groups').delete().eq('id', id); guard(error);
}
export async function saveGuest(guest: Guest) {
  if (guest.song_variant !== 'default') {
    if (!supabase || isLocalMode()) {
      const taken = readDemo().guests.find(g => g.song_variant === guest.song_variant && g.id !== guest.id);
      if (taken) throw new Error(`Esa canción especial ya está asignada a ${taken.name}. Solo puede usarse en una invitación.`);
    } else {
      const { data, error } = await supabase.from('guests').select('id,name').eq('event_id', guest.event_id).eq('song_variant', guest.song_variant).neq('id', guest.id).limit(1);
      guard(error);
      if (data?.length) throw new Error(`Esa canción especial ya está asignada a ${data[0].name}. Solo puede usarse en una invitación.`);
    }
  }
  if (!supabase || isLocalMode()) { const d = readDemo(); d.guests = [guest, ...d.guests.filter(g => g.id !== guest.id)]; writeDemo(d); return; }
  const { error } = await supabase.from('guests').upsert(guest); guard(error);
}
export async function removeGuest(id: string) {
  if (!supabase || isLocalMode()) { const d = readDemo(); d.guests = d.guests.filter(g => g.id !== id); writeDemo(d); return; }
  const { error } = await supabase.from('guests').delete().eq('id', id); guard(error);
}
export async function getPublicInvitation(token: string): Promise<PublicInvite | null> {
  // Conserva las previsualizaciones locales sin impedir abrir enlaces reales en la nube.
  const demo = readDemo();
  const localGuest = demo.guests.find(g => g.share_token === token);
  if (localGuest && isLocalMode()) return { settings: demo.settings, guest: localGuest, group_name: demo.groups.find(g => g.id === localGuest.group_id)?.name };
  if (!supabase) return null;
  const { data, error } = await supabase.rpc('lookup_public_invitation', { p_token: token }); guard(error);
  if (data) return data as PublicInvite;
  return localGuest ? { settings: demo.settings, guest: localGuest, group_name: demo.groups.find(g => g.id === localGuest.group_id)?.name } : null;
}
export async function submitRSVP(token: string, status: Exclude<RSVPStatus, 'pending'>, attending_count: number, message: string) {
  const cachedGuest = readDemo().guests.find(g => g.share_token === token);
  if (!supabase || (isLocalMode() && cachedGuest)) {
    const d = readDemo(); const guest = d.guests.find(g => g.share_token === token);
    if (!guest) throw new Error('No encontramos tu invitación.');
    if (status === 'confirmed' && (attending_count < 1 || attending_count > guest.seats)) throw new Error('Cantidad de asistentes no permitida.');
    guest.status = status; guest.attending_count = status === 'declined' ? 0 : attending_count;
    guest.message = message.slice(0, 500); guest.confirmed_at = new Date().toISOString(); writeDemo(d); return;
  }
  const { data, error } = await supabase.rpc('answer_invitation', { p_token: token, p_status: status, p_count: attending_count, p_message: message }); guard(error);
  if (!data?.success) throw new Error(data?.error || 'No fue posible guardar la respuesta.');
}
export async function uploadAsset(file: File, section: string, userId: string): Promise<string> {
  if (!supabase || isLocalMode()) throw new Error('La subida de MP3 requiere activar Anonymous Sign-Ins en Supabase para guardar los archivos en la nube. Mientras tanto puedes colocar una URL pública de MP3.');
  const ext = file.name.split('.').pop()?.toLowerCase() || 'bin';
  const allowed = ['jpg','jpeg','png','webp','gif','mp3','m4a','ogg','wav'];
  if (!allowed.includes(ext)) throw new Error('Formato no permitido. Utiliza JPG, PNG, WEBP, MP3, M4A, OGG o WAV.');
  if (file.size > 15 * 1024 * 1024) throw new Error('El archivo no debe superar los 15 MB.');
  const path = `${userId}/${section}/${makeId()}.${ext}`;
  const { error } = await supabase.storage.from('invitation-assets').upload(path, file, { cacheControl: '3600', upsert: false });
  guard(error);
  return supabase.storage.from('invitation-assets').getPublicUrl(path).data.publicUrl;
}

export function invitationUrl(token: string) {
  return `${window.location.href.split('#')[0]}#/i/${token}`;
}
export function whatsappUrl(guest: Guest, settings: EventSettings) {
  const invite = invitationUrl(guest.share_token);
  const msg = `✨ ${guest.name}, estás invitado/a a celebrar mi graduación en ${settings.degree}. 🎓\n\nTu invitación personalizada (${guest.seats} ${guest.seats === 1 ? 'cupo' : 'cupos'}):\n${invite}\n\n¡Será una noche muy especial!`;
  const phone = guest.phone.replace(/[^\d]/g, '');
  return `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
}
