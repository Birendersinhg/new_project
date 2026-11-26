// Live support chat between users and the admin, on a fresh in-memory database.
process.env.NODE_ENV = 'test';
process.env.DB_FILE = ':memory:';
process.env.ADMIN_EMAIL = 'admin@test.com';
process.env.ADMIN_PASSWORD = 'secret99';

const { server } = await import('../src/index.ts');
await new Promise<void>((r) => server.listen(0, r));
const port = (server.address() as { port: number }).port;

let fails = 0;
const check = (name: string, ok: boolean, extra = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`); if (!ok) fails++; };
async function api(method: string, path: string, body?: unknown, token?: string) {
  const res = await fetch(`http://localhost:${port}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, data: await res.json() as any };
}
async function register(name: string, mobile: string) {
  await api('POST', '/api/auth/otp', { name, mobile });
  const ticket = (await api('POST', '/api/auth/verify', { mobile, otp: '123456' })).data.ticket;
  return (await api('POST', '/api/auth/register', { ticket, password: 'pass1234' })).data.token as string;
}

const adm = (await api('POST', '/api/admin/login', { email: 'admin@test.com', password: 'secret99' })).data.token;
const ravi = await register('Ravi', '9876543210');
const asha = await register('Asha', '9123456780');

let r = await api('GET', '/api/settings');
check('WhatsApp support number defaults to 9928821585', r.data.whatsapp === '9928821585');
r = await api('PUT', '/api/admin/settings', { whatsapp: '9000000001' }, adm);
check('admin changes the WhatsApp number', r.status === 200 && (await api('GET', '/api/settings')).data.whatsapp === '9000000001');
await api('PUT', '/api/admin/settings', { whatsapp: '9928821585' }, adm);

// ---------- user side ----------
check('chat needs login', (await api('GET', '/api/support/messages')).status === 401);
check('chat starts empty', (await api('GET', '/api/support/messages', undefined, ravi)).data.length === 0);
check('empty message rejected', (await api('POST', '/api/support/messages', { text: '   ' }, ravi)).status === 400);
check('too long message rejected', (await api('POST', '/api/support/messages', { text: 'x'.repeat(1001) }, ravi)).status === 400);
r = await api('POST', '/api/support/messages', { text: 'Hello, my withdrawal is pending' }, ravi);
check('user sends a message', r.status === 200 && r.data.sender === 'user' && r.data.text === 'Hello, my withdrawal is pending');
await api('POST', '/api/support/messages', { text: 'Please check' }, ravi);
await api('POST', '/api/support/messages', { text: 'Hi from Asha' }, asha);

// ---------- admin side ----------
check('admin chat list needs admin', (await api('GET', '/api/admin/support/chats', undefined, ravi)).status === 401);
r = await api('GET', '/api/admin/support/chats', undefined, adm);
const ravisChat = r.data.find((c: any) => c.mobile === '9876543210');
check('admin sees every chat with unread counts', r.data.length === 2 && ravisChat.unread === 2 && ravisChat.last === 'Please check' && ravisChat.lastBy === 'user', JSON.stringify(r.data));
check('most recent chat is first', r.data[0].mobile === '9123456780');
check('pending count for the menu badge', (await api('GET', '/api/admin/support/unread', undefined, adm)).data.chats === 2);
r = await api('GET', `/api/admin/support/chats/${ravisChat.id}`, undefined, adm);
check('admin opens a chat and reads all messages in order', r.data.length === 2 && r.data[0].text === 'Hello, my withdrawal is pending');
check('opening a chat clears its unread count', (await api('GET', '/api/admin/support/chats', undefined, adm)).data.find((c: any) => c.id === ravisChat.id).unread === 0);
check('other chats stay pending', (await api('GET', '/api/admin/support/unread', undefined, adm)).data.chats === 1);

r = await api('POST', `/api/admin/support/chats/${ravisChat.id}`, { text: 'We are checking it now.' }, adm);
check('admin replies', r.status === 200 && r.data.sender === 'admin');
check('admin cannot send an empty reply', (await api('POST', `/api/admin/support/chats/${ravisChat.id}`, { text: '' }, adm)).status === 400);
check('reply to a missing user rejected', (await api('POST', '/api/admin/support/chats/9999', { text: 'hi' }, adm)).status === 404);

// ---------- the user sees the reply; chats stay private ----------
r = await api('GET', '/api/support/messages', undefined, ravi);
check('user sees the admin reply in the conversation', r.data.length === 3 && r.data[2].sender === 'admin' && r.data[2].text === 'We are checking it now.');
check("a user never sees another user's chat", (await api('GET', '/api/support/messages', undefined, asha)).data.length === 1);

// ---------- spam guard ----------
let blocked = 0;
for (let i = 0; i < 25; i++) if ((await api('POST', '/api/support/messages', { text: `spam ${i}` }, asha)).status === 429) blocked++;
check('sending too many messages in a few minutes is slowed down', blocked >= 5, `blocked ${blocked}`);

// ---------- dashboard: users registered / logged in per day ----------
const d = new Date();
const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
r = await api('GET', '/api/admin/stats', undefined, adm);
check("stats count today's registrations and logins", r.data.registeredToday === 2 && r.data.loggedInToday === 2, JSON.stringify(r.data));
await api('POST', '/api/auth/login', { mobile: '9876543210', password: 'pass1234' });
r = await api('GET', `/api/admin/users-daily?date=${today}`, undefined, adm);
check('daily list: both users registered today', r.status === 200 && r.data.registered.length === 2 && r.data.registered[0].mobile === '9123456780');
const ravisLogins = r.data.loggedIn.find((u: any) => u.mobile === '9876543210');
check('daily list: a user who logged in twice is listed once with the count', r.data.loggedIn.length === 2 && ravisLogins.logins === 2, JSON.stringify(r.data.loggedIn));
r = await api('GET', '/api/admin/users-daily?date=2020-01-01', undefined, adm);
check('an earlier day with nobody is empty', r.data.registered.length === 0 && r.data.loggedIn.length === 0);
check('daily list needs admin', (await api('GET', `/api/admin/users-daily?date=${today}`)).status === 401);
check('bad date rejected', (await api('GET', '/api/admin/users-daily?date=nope', undefined, adm)).status === 400);

console.log(fails ? `\n${fails} FAILED` : '\nALL CHECKS PASSED');
process.exit(fails ? 1 : 0);
