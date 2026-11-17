import type { ServiceCategory, ServiceTopic } from '@/domain/types';
import maintenance from '@/assets/services/maintenance.jpg';
import brakes from '@/assets/services/brakes.jpg';
import drivetrain from '@/assets/services/drivetrain.jpg';
import wheels from '@/assets/services/wheels.jpg';
import suspension from '@/assets/services/suspension.jpg';
import diagnosis from '@/assets/services/diagnosis.jpg';

export const SERVICE_PHOTOS: Record<ServiceTopic, string> = { maintenance, brakes, drivetrain, wheels, suspension, diagnosis };

/** Requests made before services had a topic: the closest photo for their category. */
const BY_CATEGORY: Record<ServiceCategory, string> = { maintenance, repair: drivetrain, inspection: suspension, diagnosis };

/** The photo that names a request's service (its topic, else its category). */
export const servicePhoto = (r: { topic?: ServiceTopic; category: ServiceCategory }) => (r.topic ? SERVICE_PHOTOS[r.topic] : BY_CATEGORY[r.category]);
