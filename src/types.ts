export type SongVariant = 'default' | 'special_1' | 'special_2';
export type RSVPStatus = 'pending' | 'confirmed' | 'declined';

export interface EventSettings {
  id: string;
  owner_id?: string;
  graduate_name: string;
  degree: string;
  headline: string;
  intro: string;
  event_datetime: string;
  venue_name: string;
  venue_address: string;
  maps_url: string;
  dress_code: string;
  closing_message: string;
  gift_cash_text: string;
  gift_ideas_text: string;
  photo_urls: string[];
  music_default_url: string;
  music_special_1_url: string;
  music_special_2_url: string;
  music_default_start: number;
  music_special_1_start: number;
  music_special_2_start: number;
  rsvp_deadline: string;
}

export interface GuestGroup {
  id: string;
  event_id: string;
  name: string;
  default_seats: number;
  notes: string;
  created_at?: string;
}

export interface Guest {
  id: string;
  event_id: string;
  group_id: string | null;
  name: string;
  seats: number;
  phone: string;
  song_variant: SongVariant;
  share_token: string;
  status: RSVPStatus;
  attending_count: number;
  message: string;
  confirmed_at: string | null;
  created_at: string;
}

export interface DashboardData { settings: EventSettings; groups: GuestGroup[]; guests: Guest[] }
export interface PublicInvite { settings: EventSettings; guest: Guest; group_name?: string }

export const DEFAULT_EVENT_ID = '78f1c4a8-5ad9-41e8-8ca1-087a2a964e82';
export const DEFAULT_EVENT: EventSettings = {
  id: DEFAULT_EVENT_ID,
  graduate_name: 'Mi gran día',
  degree: 'Licenciatura en Matemáticas',
  headline: '¡Lo logramos!',
  intro: 'Después de tantos retos, ecuaciones, aprendizajes y sueños, ha llegado el momento de celebrar. Tu compañía hará esta noche aún más especial.',
  event_datetime: '2026-12-18T18:00:00-05:00',
  venue_name: 'Lugar por confirmar',
  venue_address: 'Pronto compartiremos la dirección',
  maps_url: '',
  dress_code: 'Elegante',
  closing_message: 'Las mejores fórmulas de la vida se escriben con quienes amamos.',
  gift_cash_text: 'Tu presencia es mi mejor regalo. Si deseas tener un detalle conmigo, tendremos un espacio para lluvia de sobres.',
  gift_ideas_text: 'También puedes sorprenderme con un detalle especial. El cariño y los buenos deseos siempre serán bienvenidos.',
  photo_urls: ['', '', ''],
  music_default_url: '', music_special_1_url: '', music_special_2_url: '',
  music_default_start: 0, music_special_1_start: 0, music_special_2_start: 0,
  rsvp_deadline: '2026-12-15'
};
