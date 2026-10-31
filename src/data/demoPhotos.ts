// Photos for demo people, by display name. Only Carlos has one for now (from Cromiqa's own
// branding shoot); everyone else keeps illustrated initials. Add more here.
import carlos from '@/assets/avatars/carlos.jpg';

const PHOTOS: Record<string, string> = {
  'Carlos Ortega': carlos,
};

export const demoPhoto = (name: string): string | undefined => PHOTOS[name];
