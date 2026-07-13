const base = process.argv[2] || 'http://localhost:8080/api';

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

async function login(email) {
  const response = await fetch(`${base}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password: 'Demo123!' }),
  });
  assert(response.ok, `login failed for ${email}: ${response.status}`);
  const cookie = response.headers.getSetCookie?.()[0] || response.headers.get('set-cookie');
  assert(cookie, `login returned no cookie for ${email}`);
  return cookie.split(';', 1)[0];
}

async function request(path, cookie, options = {}) {
  const response = await fetch(`${base}${path}`, {
    ...options,
    headers: { 'content-type': 'application/json', cookie, ...options.headers },
  });
  const body = await response.json();
  return { response, body };
}

async function ensureResource(path, cookie, predicate, payload) {
  const current = await request(path, cookie);
  assert(current.response.ok, `GET ${path} failed: ${current.response.status}`);
  const existing = current.body.items?.find(predicate);
  if (existing) return existing;
  const created = await request(path, cookie, { method: 'POST', body: JSON.stringify(payload) });
  assert(created.response.status === 201, `POST ${path} failed: ${created.response.status} ${JSON.stringify(created.body)}`);
  return created.body;
}

async function expectStatus(path, cookie, status, payload) {
  const result = await request(path, cookie, { method: 'POST', body: JSON.stringify(payload) });
  assert(result.response.status === status, `POST ${path} returned ${result.response.status}, expected ${status}: ${JSON.stringify(result.body)}`);
}

const health = await fetch(`${base}/health`);
assert(health.ok, `health failed: ${health.status}`);

const adminCookie = await login('admin@petcare.local');
const admin = await request('/dashboard', adminCookie);
assert(admin.response.ok && Number.isInteger(admin.body.pets), 'admin dashboard missing metrics');
const seededMedicalNotes = await request('/medical-notes', adminCookie);
assert(seededMedicalNotes.response.ok, `medical notes failed: ${seededMedicalNotes.response.status}`);
assert(seededMedicalNotes.body.items?.find((note) => note.id === 1)?.author_name === 'Bruno da Equipe', 'medical note returned the wrong clinical author');

const clientCookie = await login('cliente@petcare.local');
const portal = await request('/portal', clientCookie);
assert(portal.response.ok && portal.body.customer, 'customer portal aggregate missing');
assert(portal.body.pets?.length > 0, 'customer portal has no pets');
assert(portal.body.medical_notes?.find((note) => note.id === 1)?.author_name === 'Bruno da Equipe', 'portal returned the wrong clinical author');
const customerId = portal.body.customer.id;
const ownPetIds = new Set(portal.body.pets.map((pet) => pet.id));
assert(portal.body.pets.every((pet) => pet.customer_id === customerId), 'portal leaked a pet from another customer');
for (const key of ['services', 'appointments', 'payments', 'reminders']) {
  assert((portal.body[key] || []).every((item) => item.customer_id === customerId), `portal leaked ${key} from another customer`);
}
for (const key of ['vaccines', 'medical_notes']) {
  assert((portal.body[key] || []).every((item) => ownPetIds.has(item.pet_id)), `portal leaked ${key} from another pet`);
}

const staffCookie = await login('equipe@petcare.local');
const staffPets = await request('/pets', staffCookie);
assert(staffPets.response.ok, `staff pets failed: ${staffPets.response.status}`);
const ownPet = staffPets.body.items.find((pet) => ownPetIds.has(pet.id));
const otherPet = staffPets.body.items.find((pet) => pet.customer_id !== customerId);
assert(ownPet && otherPet, 'seed must provide own and foreign pets');

const appointment = await ensureResource('/appointments', staffCookie, (item) => item.notes === 'smoke: positive relationships', {
  customer_id: customerId,
  pet_id: ownPet.id,
  service_type: 'consulta',
  scheduled_at: '2030-01-15T09:30',
  status: 'agendado',
  notes: 'smoke: positive relationships',
});
assert(appointment.customer_id === customerId && appointment.pet_id === ownPet.id, 'positive appointment has inconsistent ownership');

const medicalNote = await ensureResource('/medical-notes', staffCookie, (item) => item.observation === 'smoke: positive clinical relationship', {
  pet_id: ownPet.id,
  appointment_id: appointment.id,
  observation: 'smoke: positive clinical relationship',
});
assert(medicalNote.pet_id === ownPet.id && medicalNote.appointment_id === appointment.id, 'positive medical note has inconsistent relationships');

const payment = await ensureResource('/payments', staffCookie, (item) => item.description === 'smoke: positive payment relationship', {
  customer_id: customerId,
  appointment_id: appointment.id,
  description: 'smoke: positive payment relationship',
  amount_cents: 12345,
  method: 'pix',
  status: 'pendente',
  due_date: '2030-01-20',
});
assert(payment.customer_id === customerId && payment.appointment_id === appointment.id, 'positive payment has inconsistent relationships');

const reminder = await ensureResource('/reminders', staffCookie, (item) => item.message === 'smoke: positive reminder relationship', {
  customer_id: customerId,
  pet_id: ownPet.id,
  kind: 'retorno',
  message: 'smoke: positive reminder relationship',
  due_at: '2030-01-16T10:00',
  status: 'pendente',
});
assert(reminder.customer_id === customerId && reminder.pet_id === ownPet.id, 'positive reminder has inconsistent relationships');

await expectStatus('/appointments', staffCookie, 404, {
  customer_id: customerId,
  pet_id: otherPet.id,
  service_type: 'consulta',
  scheduled_at: '2030-01-17T11:00',
  status: 'agendado',
  notes: 'smoke: invalid pet owner',
});
await expectStatus('/medical-notes', staffCookie, 404, {
  pet_id: otherPet.id,
  appointment_id: appointment.id,
  observation: 'smoke: invalid appointment pet',
});
await expectStatus('/payments', staffCookie, 404, {
  customer_id: otherPet.customer_id,
  appointment_id: appointment.id,
  description: 'smoke: invalid appointment customer',
  amount_cents: 100,
  method: 'pix',
  status: 'pendente',
});
await expectStatus('/reminders', staffCookie, 404, {
  customer_id: customerId,
  pet_id: otherPet.id,
  kind: 'retorno',
  message: 'smoke: invalid pet customer',
  due_at: '2030-01-18T12:00',
  status: 'pendente',
});

const clientCollections = {};
for (const path of ['/pets', '/vaccines', '/services', '/appointments', '/medical-notes', '/payments', '/reminders']) {
  const result = await request(path, clientCookie);
  assert(result.response.ok, `client GET ${path} failed: ${result.response.status}`);
  clientCollections[path] = result.body.items || [];
}
assert(clientCollections['/pets'].every((item) => item.customer_id === customerId), 'pet listing leaked another customer');
for (const path of ['/services', '/appointments', '/payments', '/reminders']) {
  assert(clientCollections[path].every((item) => item.customer_id === customerId), `${path} listing leaked another customer`);
}
for (const path of ['/vaccines', '/medical-notes']) {
  assert(clientCollections[path].every((item) => ownPetIds.has(item.pet_id)), `${path} listing leaked another pet`);
}
assert(clientCollections['/appointments'].some((item) => item.id === appointment.id), 'positive appointment missing from client listing');
assert(clientCollections['/medical-notes'].some((item) => item.id === medicalNote.id && item.author_name === 'Bruno da Equipe'), 'positive medical note or author missing from client listing');
assert(clientCollections['/payments'].some((item) => item.id === payment.id), 'positive payment missing from client listing');
assert(clientCollections['/reminders'].some((item) => item.id === reminder.id), 'positive reminder missing from client listing');

for (const path of ['/customers', '/users']) {
  const forbiddenList = await request(path, clientCookie);
  assert(forbiddenList.response.status === 403, `client GET ${path} returned ${forbiddenList.response.status}`);
}

const forbidden = await request('/users', clientCookie, {
  method: 'POST',
  body: JSON.stringify({ name: 'Blocked', email: 'blocked@example.test', password: 'Demo123!', role: 'equipe' }),
});
assert(forbidden.response.status === 403, `client user creation returned ${forbidden.response.status}`);

const forged = await request('/users', 'petcare_session=invalid-token');
assert(forged.response.status === 401, `invalid session returned ${forged.response.status}`);

console.log('Smoke passed: health, positive creation, invalid relationships, direct-list isolation, clinical author, RBAC and invalid session.');
