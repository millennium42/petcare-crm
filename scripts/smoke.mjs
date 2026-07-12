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

const health = await fetch(`${base}/health`);
assert(health.ok, `health failed: ${health.status}`);

const adminCookie = await login('admin@petcare.local');
const admin = await request('/dashboard', adminCookie);
assert(admin.response.ok && Number.isInteger(admin.body.pets), 'admin dashboard missing metrics');

const clientCookie = await login('cliente@petcare.local');
const portal = await request('/portal', clientCookie);
assert(portal.response.ok && portal.body.customer, 'customer portal aggregate missing');
assert(portal.body.pets?.length > 0, 'customer portal has no pets');
const customerId = portal.body.customer.id;
const ownPetIds = new Set(portal.body.pets.map((pet) => pet.id));
assert(portal.body.pets.every((pet) => pet.customer_id === customerId), 'portal leaked a pet from another customer');
for (const key of ['services', 'appointments', 'payments', 'reminders']) {
  assert((portal.body[key] || []).every((item) => item.customer_id === customerId), `portal leaked ${key} from another customer`);
}
for (const key of ['vaccines', 'medical_notes']) {
  assert((portal.body[key] || []).every((item) => ownPetIds.has(item.pet_id)), `portal leaked ${key} from another pet`);
}

const forbidden = await request('/users', clientCookie, {
  method: 'POST',
  body: JSON.stringify({ name: 'Blocked', email: 'blocked@example.test', password: 'Demo123!', role: 'equipe' }),
});
assert(forbidden.response.status === 403, `client user creation returned ${forbidden.response.status}`);

const forged = await request('/users', 'petcare_session=invalid-token');
assert(forged.response.status === 401, `invalid session returned ${forged.response.status}`);

console.log('Smoke passed: health, dashboard, customer isolation, role protection and invalid-session rejection.');
