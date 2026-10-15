'use strict';
const http = require('http'), fs = require('fs'), path = require('path'), crypto = require('crypto'), nodemailer = require('nodemailer');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { promisify } = require('util');
const { DatabaseSync } = require('node:sqlite');
const { encryptFile, encryptFileSync, decryptBuffer } = require('./media-storage');
const scrypt = promisify(crypto.scrypt);
const PORT = process.env.PORT || 3000, HOST = process.env.HOST || '127.0.0.1', PUB = path.join(__dirname, 'public'), SESSION = 30 * 864e5;

fs.mkdirSync(path.join(__dirname, 'data'), { recursive: true });
const db = new DatabaseSync(path.join(__dirname, 'data', 'aven.db'));
db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY, email TEXT UNIQUE NOT NULL, username TEXT UNIQUE NOT NULL, display_name TEXT NOT NULL, password TEXT NOT NULL, avatar TEXT, theme TEXT NOT NULL DEFAULT 'dark', created_at INTEGER NOT NULL, public_id TEXT, developer_mode INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS user_badges(user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, badge_file TEXT NOT NULL, assigned_by TEXT NOT NULL, assigned_at INTEGER NOT NULL, PRIMARY KEY(user_id,badge_file));
CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS account_devices(device_hash TEXT NOT NULL, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, last_used INTEGER NOT NULL, PRIMARY KEY(device_hash,user_id));
CREATE TABLE IF NOT EXISTS friendships(id INTEGER PRIMARY KEY, requester INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, addressee INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, status TEXT NOT NULL DEFAULT 'pending', created_at INTEGER NOT NULL, UNIQUE(requester, addressee));
CREATE TABLE IF NOT EXISTS dm_requests(id INTEGER PRIMARY KEY, sender INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, recipient INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, body TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','accepted','declined')), created_at INTEGER NOT NULL, UNIQUE(sender,recipient));
CREATE TABLE IF NOT EXISTS messages(id INTEGER PRIMARY KEY, sender INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, receiver INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, body TEXT NOT NULL, created_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS idx_messages ON messages(sender, receiver, id);
CREATE TABLE IF NOT EXISTS dm_hides(user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, other_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, hidden_at INTEGER NOT NULL, PRIMARY KEY(user_id,other_id));
CREATE TABLE IF NOT EXISTS user_personalizations(user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, target_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, note TEXT NOT NULL DEFAULT '', nickname TEXT NOT NULL DEFAULT '', updated_at INTEGER NOT NULL, PRIMARY KEY(user_id,target_id));
CREATE TABLE IF NOT EXISTS notifications(id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, type TEXT NOT NULL, actor_id INTEGER REFERENCES users(id) ON DELETE SET NULL, entity_id INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL, read_at INTEGER, UNIQUE(user_id,type,entity_id));`);
const get = (s, ...p) => db.prepare(s).get(...p), all = (s, ...p) => db.prepare(s).all(...p), run = (s, ...p) => db.prepare(s).run(...p);
db.exec('DROP TABLE IF EXISTS spotify_oauth_states; DROP TABLE IF EXISTS spotify_connections;');
// Profil düzenleme çağrıları aynı bildirim satırını günceller; eski yinelenen kayıtları da başlangıçta birleştir.
run(`DELETE FROM notifications WHERE type='profile-update' AND id NOT IN (
  SELECT MAX(id) FROM notifications WHERE type='profile-update' GROUP BY user_id,actor_id
)`);
run("UPDATE notifications SET entity_id=actor_id WHERE type='profile-update' AND actor_id IS NOT NULL");
run(`INSERT OR IGNORE INTO notifications(user_id,type,actor_id,entity_id,created_at)
  SELECT addressee,'friend-request',requester,id,created_at FROM friendships WHERE status='pending';
INSERT OR IGNORE INTO notifications(user_id,type,actor_id,entity_id,created_at)
  SELECT recipient,'dm-request',sender,id,created_at FROM dm_requests WHERE status='pending';`);
const userColumns = all('PRAGMA table_info(users)').map(c => c.name);
if (!userColumns.includes('email_verified')) db.exec('ALTER TABLE users ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 1');
if (!userColumns.includes('language')) db.exec("ALTER TABLE users ADD COLUMN language TEXT NOT NULL DEFAULT 'tr'");
if (!userColumns.includes('public_id')) db.exec('ALTER TABLE users ADD COLUMN public_id TEXT');
if (!userColumns.includes('developer_mode')) db.exec('ALTER TABLE users ADD COLUMN developer_mode INTEGER NOT NULL DEFAULT 0');
const makePublicUserId = () => {
  for (;;) {
    const id = Array.from({ length: 8 }, () => crypto.randomInt(0, 10)).join('') + String.fromCharCode(65 + crypto.randomInt(0, 26));
    if (!get('SELECT 1 FROM users WHERE public_id=?', id)) return id;
  }
};
for (const row of all(`SELECT id FROM users WHERE public_id IS NULL OR public_id NOT GLOB '[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][A-Z]'`)) {
  run('UPDATE users SET public_id=? WHERE id=?', makePublicUserId(), row.id);
}
db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_public_id ON users(public_id)');
db.exec(`CREATE TABLE IF NOT EXISTS email_verifications(
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  last_sent_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
); CREATE INDEX IF NOT EXISTS idx_email_verifications_user ON email_verifications(user_id);`);
run('DELETE FROM sessions WHERE expires < ?', Date.now());
const cols = all('PRAGMA table_info(messages)').map(c => c.name);
if (!cols.includes('kind')) db.exec("ALTER TABLE messages ADD COLUMN kind TEXT NOT NULL DEFAULT 'text'; ALTER TABLE messages ADD COLUMN file TEXT; ALTER TABLE messages ADD COLUMN edited INTEGER NOT NULL DEFAULT 0;");
if (!all('PRAGMA table_info(messages)').some(c => c.name === 'file_ready')) db.exec('ALTER TABLE messages ADD COLUMN file_ready INTEGER NOT NULL DEFAULT 1');
const messageCols = all('PRAGMA table_info(messages)').map(c => c.name);
if (!messageCols.includes('file_iv')) db.exec('ALTER TABLE messages ADD COLUMN file_iv TEXT');
if (!messageCols.includes('file_size')) db.exec('ALTER TABLE messages ADD COLUMN file_size INTEGER');
if (!messageCols.includes('file_type')) db.exec('ALTER TABLE messages ADD COLUMN file_type TEXT');
if (!messageCols.includes('storage_iv')) db.exec('ALTER TABLE messages ADD COLUMN storage_iv TEXT');
if (!messageCols.includes('storage_tag')) db.exec('ALTER TABLE messages ADD COLUMN storage_tag TEXT');
db.exec('CREATE INDEX IF NOT EXISTS idx_messages_file ON messages(file) WHERE file IS NOT NULL');
db.exec('CREATE TABLE IF NOT EXISTS blocks(blocker INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, blocked INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, created_at INTEGER NOT NULL, PRIMARY KEY(blocker, blocked));');
db.exec(`CREATE TABLE IF NOT EXISTS servers(id INTEGER PRIMARY KEY, name TEXT NOT NULL, owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, created_at INTEGER NOT NULL, icon TEXT, banner TEXT);
CREATE TABLE IF NOT EXISTS server_members(server_id INTEGER NOT NULL REFERENCES servers(id) ON DELETE CASCADE, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, joined_at INTEGER NOT NULL, PRIMARY KEY(server_id,user_id));
CREATE TABLE IF NOT EXISTS server_bans(server_id INTEGER NOT NULL REFERENCES servers(id) ON DELETE CASCADE, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, reason TEXT NOT NULL, moderator_id INTEGER REFERENCES users(id) ON DELETE SET NULL, created_at INTEGER NOT NULL, PRIMARY KEY(server_id,user_id));
CREATE TABLE IF NOT EXISTS server_tags(server_id INTEGER PRIMARY KEY REFERENCES servers(id) ON DELETE CASCADE, tag TEXT NOT NULL, badge TEXT NOT NULL DEFAULT 'crest', enabled INTEGER NOT NULL DEFAULT 0, updated_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS user_server_tags(user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, server_id INTEGER NOT NULL, FOREIGN KEY(server_id,user_id) REFERENCES server_members(server_id,user_id) ON DELETE CASCADE);
CREATE TABLE IF NOT EXISTS server_roles(id INTEGER PRIMARY KEY, server_id INTEGER NOT NULL REFERENCES servers(id) ON DELETE CASCADE, name TEXT NOT NULL, color TEXT NOT NULL DEFAULT '#8b93a7', position INTEGER NOT NULL DEFAULT 0, permissions INTEGER NOT NULL DEFAULT 0, is_everyone INTEGER NOT NULL DEFAULT 0, display_separately INTEGER NOT NULL DEFAULT 0, self_assignable INTEGER NOT NULL DEFAULT 0, UNIQUE(server_id,name));
CREATE TABLE IF NOT EXISTS member_roles(server_id INTEGER NOT NULL, user_id INTEGER NOT NULL, role_id INTEGER NOT NULL REFERENCES server_roles(id) ON DELETE CASCADE, PRIMARY KEY(server_id,user_id,role_id), FOREIGN KEY(server_id,user_id) REFERENCES server_members(server_id,user_id) ON DELETE CASCADE);
CREATE TABLE IF NOT EXISTS server_channels(id INTEGER PRIMARY KEY, server_id INTEGER NOT NULL REFERENCES servers(id) ON DELETE CASCADE, name TEXT NOT NULL, type TEXT NOT NULL CHECK(type IN ('text','voice')), topic TEXT NOT NULL DEFAULT '', position INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS channel_overwrites(id INTEGER PRIMARY KEY, channel_id INTEGER NOT NULL REFERENCES server_channels(id) ON DELETE CASCADE, target_type TEXT NOT NULL CHECK(target_type IN ('role','member')), target_id INTEGER NOT NULL, allow_bits INTEGER NOT NULL DEFAULT 0, deny_bits INTEGER NOT NULL DEFAULT 0, UNIQUE(channel_id,target_type,target_id));
CREATE TABLE IF NOT EXISTS server_invites(code TEXT PRIMARY KEY, server_id INTEGER NOT NULL REFERENCES servers(id) ON DELETE CASCADE, creator_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, created_at INTEGER NOT NULL, expires_at INTEGER, max_uses INTEGER, uses INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS server_write_allowlist(server_id INTEGER PRIMARY KEY REFERENCES servers(id) ON DELETE CASCADE, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE);
CREATE TABLE IF NOT EXISTS server_messages(id INTEGER PRIMARY KEY, channel_id INTEGER NOT NULL REFERENCES server_channels(id) ON DELETE CASCADE, sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, body TEXT NOT NULL, created_at INTEGER NOT NULL, edited INTEGER NOT NULL DEFAULT 0);
CREATE INDEX IF NOT EXISTS idx_server_messages ON server_messages(channel_id,id);
CREATE INDEX IF NOT EXISTS idx_server_members_user ON server_members(user_id);`);
const serverCols = all('PRAGMA table_info(servers)').map(c => c.name);
if (!serverCols.includes('icon')) db.exec('ALTER TABLE servers ADD COLUMN icon TEXT');
if (!serverCols.includes('banner')) db.exec('ALTER TABLE servers ADD COLUMN banner TEXT');
if (!serverCols.includes('verified')) db.exec('ALTER TABLE servers ADD COLUMN verified INTEGER NOT NULL DEFAULT 0');
if (!serverCols.includes('public_id')) db.exec('ALTER TABLE servers ADD COLUMN public_id TEXT');
const makePublicServerId = () => {
  for (;;) {
    const id = Array.from({ length: 8 }, () => crypto.randomInt(0, 10)).join('') + String.fromCharCode(65 + crypto.randomInt(0, 26));
    if (!get('SELECT 1 FROM servers WHERE public_id=?', id)) return id;
  }
};
const seenServerPublicIds = new Set();
for (const row of all('SELECT id,public_id FROM servers ORDER BY id')) {
  const valid = /^[0-9]{8}[A-Z]$/.test(String(row.public_id || '')) && !seenServerPublicIds.has(row.public_id);
  const publicId = valid ? row.public_id : makePublicServerId();
  if (!valid) run('UPDATE servers SET public_id=? WHERE id=?', publicId, row.id);
  seenServerPublicIds.add(publicId);
}
db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_servers_public_id ON servers(public_id)');
const roleCols = all('PRAGMA table_info(server_roles)').map(c => c.name);
if (!roleCols.includes('display_separately')) db.exec('ALTER TABLE server_roles ADD COLUMN display_separately INTEGER NOT NULL DEFAULT 0');
if (!roleCols.includes('self_assignable')) db.exec('ALTER TABLE server_roles ADD COLUMN self_assignable INTEGER NOT NULL DEFAULT 0');
db.exec('DROP TABLE IF EXISTS server_delete_verifications');
const serverMessageCols = all('PRAGMA table_info(server_messages)').map(c => c.name);
if (!serverMessageCols.includes('kind')) db.exec("ALTER TABLE server_messages ADD COLUMN kind TEXT NOT NULL DEFAULT 'text'; ALTER TABLE server_messages ADD COLUMN file TEXT;");
if (!serverMessageCols.includes('storage_iv')) db.exec('ALTER TABLE server_messages ADD COLUMN storage_iv TEXT');
if (!serverMessageCols.includes('storage_tag')) db.exec('ALTER TABLE server_messages ADD COLUMN storage_tag TEXT');
db.exec(`CREATE TABLE IF NOT EXISTS admin_sessions(token_hash TEXT PRIMARY KEY, expires INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS announcements(
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  source_locale TEXT NOT NULL CHECK(source_locale IN ('tr','en','de')),
  translations TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS announcement_views(
  announcement_id INTEGER NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  viewed_at INTEGER NOT NULL,
  PRIMARY KEY(announcement_id,user_id)
);
CREATE INDEX IF NOT EXISTS idx_announcement_views_user ON announcement_views(user_id,announcement_id);
CREATE TABLE IF NOT EXISTS support_tickets(
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','answered','closed')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_support_tickets_user ON support_tickets(user_id,updated_at DESC);
CREATE TABLE IF NOT EXISTS support_messages(
  id INTEGER PRIMARY KEY,
  ticket_id INTEGER NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  author_type TEXT NOT NULL CHECK(author_type IN ('user','admin')),
  author_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  body TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_support_messages_ticket ON support_messages(ticket_id,id);`);
// --- Şema geçişi: eski sürümlerde oluşturulmuş support_tickets CHECK kısıtını düzelt ---
{
  const ticketSql = get("SELECT sql FROM sqlite_master WHERE type='table' AND name='support_tickets'")?.sql || '';
  if (ticketSql && !ticketSql.includes("'closed'")) {
    console.log('support_tickets tablosu yeni şemaya taşınıyor...');
    db.exec('PRAGMA foreign_keys=OFF');
    db.exec('BEGIN');
    try {
      db.exec(`DROP TABLE IF EXISTS support_tickets_new;
CREATE TABLE support_tickets_new(
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','answered','closed')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
INSERT INTO support_tickets_new(id,user_id,subject,status,created_at,updated_at)
  SELECT id,user_id,subject,CASE WHEN status IN ('open','answered','closed') THEN status ELSE 'open' END,created_at,updated_at FROM support_tickets;
DROP TABLE support_tickets;
ALTER TABLE support_tickets_new RENAME TO support_tickets;
CREATE INDEX IF NOT EXISTS idx_support_tickets_user ON support_tickets(user_id,updated_at DESC);`);
      db.exec('COMMIT');
    } catch (er) { db.exec('ROLLBACK'); throw er; }
    finally { db.exec('PRAGMA foreign_keys=ON'); }
  }
}
if (!all('PRAGMA table_info(support_tickets)').some(c => c.name === 'kind')) db.exec("ALTER TABLE support_tickets ADD COLUMN kind TEXT NOT NULL DEFAULT 'user'");
if (!all('PRAGMA table_info(support_tickets)').some(c => c.name === 'closed_at')) db.exec('ALTER TABLE support_tickets ADD COLUMN closed_at INTEGER');
run('DELETE FROM admin_sessions WHERE expires < ?', Date.now());
if (!all('PRAGMA table_info(users)').some(c => c.name === 'bio')) db.exec("ALTER TABLE users ADD COLUMN bio TEXT NOT NULL DEFAULT ''; ALTER TABLE users ADD COLUMN banner TEXT;");
run("UPDATE users SET display_name = username WHERE instr(display_name, '@') > 0");
if (!all('PRAGMA table_info(users)').some(c => c.name === 'is_bot')) db.exec('ALTER TABLE users ADD COLUMN is_bot INTEGER NOT NULL DEFAULT 0');
if (!all('PRAGMA table_info(users)').some(c => c.name === 'presence')) db.exec("ALTER TABLE users ADD COLUMN presence TEXT NOT NULL DEFAULT 'online'");
if (!all('PRAGMA table_info(users)').some(c => c.name === 'message_policy')) db.exec("ALTER TABLE users ADD COLUMN message_policy TEXT NOT NULL DEFAULT 'friends'");
run("UPDATE users SET username = username || '_' || id WHERE username = 'aven' AND is_bot = 0");
if (!get('SELECT 1 FROM users WHERE is_bot=1')) run("INSERT INTO users(email,username,display_name,password,created_at,is_bot,public_id) VALUES('bot@aven.invalid','aven','Aven','!',?,1,?)", Date.now(), makePublicUserId());
const BOT = get('SELECT id FROM users WHERE is_bot=1').id;
run('UPDATE users SET avatar=?, bio=? WHERE id=?', '/image/bot.png', 'Aven uygulamasının resmi hesabı.', BOT);
// Keep announcement history available from the inbox, including announcements published before this feature.
run(`INSERT OR IGNORE INTO notifications(user_id,type,actor_id,entity_id,created_at,read_at)
  SELECT u.id,'announcement',NULL,a.id,a.created_at,v.viewed_at
  FROM users u CROSS JOIN announcements a
  LEFT JOIN announcement_views v ON v.announcement_id=a.id AND v.user_id=u.id
  WHERE u.is_bot=0`);
const RESERVED = ['aven', 'admin', 'resmi', 'destek', 'support', 'official'];
const BUILD = Date.now().toString(36);
const UP = path.join(__dirname, 'data', 'uploads'), MAXF = 25 * 1024 * 1024;
const dmUploads = new Set(), dmUploadRequests = new Map();
const sniffOk = (file, type) => {
  let b; try { const fd = fs.openSync(file, 'r'); b = Buffer.alloc(16); fs.readSync(fd, b, 0, 16, 0); fs.closeSync(fd); } catch { return false; }
  const at = (o, str) => b.slice(o, o + str.length).toString('latin1') === str;
  switch (type) {
    case 'image/png': return b[0] === 0x89 && at(1, 'PNG');
    case 'image/jpeg': return b[0] === 0xFF && b[1] === 0xD8;
    case 'image/gif': return at(0, 'GIF8');
    case 'image/webp': return at(0, 'RIFF') && at(8, 'WEBP');
    case 'video/mp4': return at(4, 'ftyp');
    case 'video/webm': return b[0] === 0x1A && b[1] === 0x45 && b[2] === 0xDF && b[3] === 0xA3;
    default: return false;
  }
};

fs.mkdirSync(UP, { recursive: true });
const MIME = { png: 'image/png', jpg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', mp4: 'video/mp4', webm: 'video/webm' };
const EXT = Object.fromEntries(Object.entries(MIME).map(([k, v]) => [v, k]));
const storedMediaPath = name => path.join(UP, `${name}.aenc`);
const purgeDmAttachmentFiles = fileId => {
  if (!/^[a-f0-9]{32}$/.test(String(fileId || ''))) return;
  for (const name of fs.readdirSync(UP)) {
    if (!name.startsWith(`${fileId}.`)) continue;
    const suffix = name.slice(fileId.length + 1);
    if (suffix === 'enc' || suffix === 'aenc' || Object.values(EXT).includes(suffix) || suffix.endsWith('.part')) fs.rmSync(path.join(UP, name), { force: true });
  }
};
// New files are encrypted at rest. Older plaintext uploads are migrated without changing their message IDs.
for (const row of all("SELECT id,file FROM messages WHERE kind IN ('image','video') AND file IS NOT NULL")) {
  const fileId = String(row.file), isId = /^[a-f0-9]{32}$/.test(fileId);
  const metadata = get('SELECT file_size,file_ready,file_iv,file_type,storage_iv,storage_tag FROM messages WHERE id=?', row.id);
  const unavailable = () => run("UPDATE messages SET kind='unavailable',file=NULL,file_ready=1,file_iv=NULL,file_size=NULL,file_type=NULL,storage_iv=NULL,storage_tag=NULL WHERE id=?", row.id);
  if (!isId) {
    if (fileId.includes('.') && !get('SELECT 1 FROM server_messages WHERE file=?', fileId)) fs.rmSync(path.join(UP, path.basename(fileId)), { force: true });
    unavailable();
    continue;
  }
  const stored = storedMediaPath(fileId), legacy = path.join(UP, `${fileId}.enc`);
  if (!!metadata.storage_iv !== !!metadata.storage_tag) throw new Error(`DM medya şifreleme kaydı eksik (mesaj ${row.id}); veri tabanı yedeğini kontrol edin.`);
  if (metadata.storage_iv && metadata.storage_tag) {
    try {
      const encrypted = fs.readFileSync(stored);
      decryptBuffer(encrypted, metadata.storage_iv, metadata.storage_tag, metadata.file_size);
      const ext = EXT[metadata.file_type]; if (ext) fs.rmSync(path.join(UP, `${fileId}.${ext}`), { force: true });
      if (!metadata.file_ready) run('UPDATE messages SET file_ready=1 WHERE id=?', row.id);
      continue;
    } catch (error) {
      const ext = EXT[metadata.file_type], plain = ext ? path.join(UP, `${fileId}.${ext}`) : null;
      if (plain && fs.existsSync(plain)) {
        const temp = `${stored}.${crypto.randomBytes(5).toString('hex')}.part`;
        try {
          const repaired = encryptFileSync(plain, temp);
          fs.rmSync(stored, { force: true }); fs.renameSync(temp, stored);
          run('UPDATE messages SET storage_iv=?,storage_tag=?,file_ready=1 WHERE id=?', repaired.iv, repaired.tag, row.id);
          fs.rmSync(plain, { force: true }); continue;
        } catch (repairError) { fs.rmSync(temp, { force: true }); throw repairError; }
      }
      if (error.code === 'ENOENT' && !metadata.file_ready) { unavailable(); continue; }
      throw new Error(`DM medya şifreleme anahtarı/dosyası doğrulanamadı (mesaj ${row.id}); key dosyasını koruyun. ${error.message}`);
    }
  }
  // Older end-to-end encrypted uploads remain encrypted and keep their existing client keys.
  if (metadata.file_iv) {
    try { if (fs.statSync(legacy).size === metadata.file_size) continue; } catch {}
    if (!metadata.file_ready && Number.isSafeInteger(metadata.file_size) && metadata.file_size >= 17 && metadata.file_size <= MAXF + 16) continue;
    unavailable(); continue;
  }
  const ext = EXT[metadata.file_type];
  if (ext && Number.isSafeInteger(metadata.file_size) && metadata.file_size > 0) {
    const plain = path.join(UP, `${fileId}.${ext}`), temp = `${stored}.${crypto.randomBytes(5).toString('hex')}.part`;
    try {
      if (fs.statSync(plain).size !== metadata.file_size) throw new Error('DM ek boyutu eşleşmiyor.');
      const encrypted = encryptFileSync(plain, temp);
      fs.rmSync(stored, { force: true }); fs.renameSync(temp, stored);
      run('UPDATE messages SET storage_iv=?,storage_tag=?,file_ready=1 WHERE id=?', encrypted.iv, encrypted.tag, row.id);
      fs.rmSync(plain, { force: true });
      continue;
    } catch (error) {
      fs.rmSync(temp, { force: true });
      if (fs.existsSync(plain)) throw new Error(`DM medya şifreleme geçişi başarısız (mesaj ${row.id}); özgün dosya korundu. ${error.message}`);
    }
  }
  unavailable();
}
// Existing server-channel photos are encrypted on the first start after this update.
for (const row of all('SELECT id,file,storage_iv,storage_tag FROM server_messages WHERE file IS NOT NULL')) {
  const name = String(row.file);
  if (!/^[a-f0-9]{32}\.(png|jpg|gif|webp)$/.test(name)) continue;
  const stored = storedMediaPath(name);
  const plain = path.join(UP, name), temp = `${stored}.${crypto.randomBytes(5).toString('hex')}.part`;
  if (!!row.storage_iv !== !!row.storage_tag) throw new Error(`Sunucu görseli şifreleme kaydı eksik (mesaj ${row.id}); veri tabanı yedeğini kontrol edin.`);
  if (row.storage_iv && row.storage_tag) {
    try {
      decryptBuffer(fs.readFileSync(stored), row.storage_iv, row.storage_tag);
      fs.rmSync(plain, { force: true });
      continue;
    } catch (error) {
      if (!fs.existsSync(plain)) throw new Error(`Sunucu görseli şifreleme anahtarı/dosyası doğrulanamadı (mesaj ${row.id}); key dosyasını koruyun. ${error.message}`);
    }
  }
  if (!fs.existsSync(plain)) continue;
  try {
    const encrypted = encryptFileSync(plain, temp);
    fs.rmSync(stored, { force: true }); fs.renameSync(temp, stored);
    run('UPDATE server_messages SET storage_iv=?,storage_tag=? WHERE id=?', encrypted.iv, encrypted.tag, row.id);
    fs.rmSync(plain, { force: true });
  } catch (error) { fs.rmSync(temp, { force: true }); if (fs.existsSync(plain)) throw new Error(`Sunucu görseli şifreleme geçişi başarısız (mesaj ${row.id}); özgün dosya korundu. ${error.message}`); }
}
for (const entry of fs.readdirSync(UP)) if (entry.endsWith('.part')) fs.rmSync(path.join(UP, entry), { force: true });
const BANNED_FILE = path.join(__dirname, 'data', 'banned.json');
if (!fs.existsSync(BANNED_FILE)) fs.writeFileSync(BANNED_FILE, '[]\n');
let bannedStamp = '', bannedEmails = new Set();
const readBannedEmails = () => {
  try {
    const stat = fs.statSync(BANNED_FILE), stamp = `${stat.mtimeMs}:${stat.size}`;
    if (stamp === bannedStamp) return false;
    const raw = JSON.parse(fs.readFileSync(BANNED_FILE, 'utf8'));
    const list = Array.isArray(raw) ? raw : Array.isArray(raw?.emails) ? raw.emails : [];
    const next = new Set(list.map(value => String(value).trim().toLowerCase()).filter(value => EMAIL.test(value)));
    const changed = [...next].some(email => !bannedEmails.has(email)) || [...bannedEmails].some(email => !next.has(email));
    bannedEmails = next; bannedStamp = stamp; return changed;
  } catch (er) { console.error('banned.json okunamadı:', er.message); return false; }
};
const isBannedEmail = email => { readBannedEmails(); return bannedEmails.has(String(email || '').trim().toLowerCase()); };
const throwIfBanned = email => { if (isBannedEmail(email)) { const er = new E(403, 'Bu hesabın kullanımı kapatıldı.'); er.banned = true; throw er; } };
const ROZETLER = path.join(PUB, 'rozetler');
fs.mkdirSync(ROZETLER, { recursive: true });
const badgeLabel = file => path.basename(file, path.extname(file)).replace(/[_-]+/g, ' ').replace(/\b\p{L}/gu, c => c.toLocaleUpperCase('tr-TR'));
const scanBadges = () => fs.readdirSync(ROZETLER, { withFileTypes: true })
  .filter(entry => entry.isFile() && /\.png$/i.test(entry.name) && entry.name.length <= 120)
  .map(entry => ({ file: entry.name, name: badgeLabel(entry.name), image: `/rozetler/${encodeURIComponent(entry.name)}` }))
  .sort((a, b) => a.name.localeCompare(b.name, 'tr'));
let badgeCatalogCache = null;
const badgeCatalog = () => badgeCatalogCache || (badgeCatalogCache = new Map(scanBadges().map(badge => [badge.file, badge])));
const userBadgesCache = new Map();
const userBadges = userId => {
  const cached = userBadgesCache.get(Number(userId));
  if (cached) return cached.map(badge => ({ ...badge }));
  const catalog = badgeCatalog();
  const files = all('SELECT badge_file AS file FROM user_badges WHERE user_id=? ORDER BY assigned_at,badge_file', userId).map(({ file }) => file);
  if (Number(userId) === BOT && catalog.has('Aven Official.png') && !files.includes('Aven Official.png')) files.push('Aven Official.png');
  const badges = files.map(file => catalog.get(file) || { file, name: badgeLabel(file), image: `/rozetler/${encodeURIComponent(file)}` });
  userBadgesCache.set(Number(userId), badges);
  return badges.map(badge => ({ ...badge }));
};
class E extends Error { constructor(c, m) { super(m); this.c = c; } }
const bad = m => new E(400, m);
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/, UNAME = /^[a-z0-9_.]{3,20}$/, THEMES = ['dark', 'night', 'light'];
const activeServerTag = userId => get(`SELECT t.server_id AS serverId,s.name AS serverName,t.tag,t.badge FROM user_server_tags u
  JOIN server_tags t ON t.server_id=u.server_id JOIN servers s ON s.id=t.server_id
  WHERE u.user_id=? AND t.enabled=1`, userId) || null;
const pub = u => ({ id: u.id, publicId: u.public_id || (u.id ? get('SELECT public_id FROM users WHERE id=?', u.id)?.public_id : null), username: u.username, displayName: u.display_name, avatar: u.avatar, bot: !!u.is_bot, badges: u.id ? userBadges(u.id) : [], guildTag: u.id ? activeServerTag(u.id) : null });
const PRESENCES = ['online', 'idle', 'dnd', 'invisible'];
const self = u => ({ ...pub(u), developerMode: !!u.developer_mode, theme: u.theme, language: ['tr', 'en', 'de'].includes(u.language) ? u.language : 'tr', bio: u.bio, banner: u.banner, presence: u.presence || 'online', messagePolicy: u.message_policy || 'friends', createdAt: u.created_at });
const cName = n => { n = String(n ?? '').trim(); if (!n || n.length > 32) throw bad('Görünen ad 1-32 karakter olmalı.'); if (n.includes('@')) throw bad('Görünen ad mail adresi olamaz.'); return n; };
const cUser = n => { n = String(n ?? '').trim().toLowerCase(); if (RESERVED.includes(n)) throw bad('Bu kullanıcı adı ayrılmış.'); if (!UNAME.test(n)) throw bad('Kullanıcı adı 3-20 karakter olmalı; yalnızca harf, rakam, _ ve . kullanılabilir.'); return n; };
const cRegistrationName = n => { const value = cName(n); if (value.length > 8) throw bad('Kayıt sırasında görünen ad en fazla 8 karakter olmalı.'); return value; };
const cRegistrationUser = n => { const value = cUser(n); if (value.length > 7) throw bad('Kayıt sırasında kullanıcı adı en fazla 7 karakter olmalı.'); return value; };
const cPass = p => { if (typeof p !== 'string' || p.length < 8 || p.length > 128) throw bad('Şifre en az 8 karakter olmalı.'); return p; };
const hash = async p => { const s = crypto.randomBytes(16); return s.toString('hex') + ':' + (await scrypt(p, s, 64)).toString('hex'); };
const verify = async (p, h) => { const [s, k] = h.split(':'); return crypto.timingSafeEqual(await scrypt(p, Buffer.from(s, 'hex'), 64), Buffer.from(k, 'hex')); };
const SITE_URL = String(process.env.SITE_URL || process.env.BASE_URL || 'https://chataven.com.tr').replace(/\/+$/, '');
const MAIL_USER = String(process.env.MAIL_USER || '').trim();
const MAIL_PASSWORD = String(process.env.MAIL_PASSWORD || '').trim();
const MAIL_FROM_NAME = String(process.env.MAIL_FROM_NAME || 'Aven').trim() || 'Aven';
const MAIL_FROM_EMAIL = String(process.env.MAIL_FROM_EMAIL || MAIL_USER).trim() || MAIL_USER;
const mailer = MAIL_USER && MAIL_PASSWORD ? nodemailer.createTransport({
  host: process.env.MAIL_HOST || 'smtp.gmail.com',
  port: Number(process.env.MAIL_PORT || 465),
  secure: String(process.env.MAIL_SECURE || 'true') === 'true',
  auth: { user: MAIL_USER, pass: MAIL_PASSWORD }
}) : null;
const ADMIN_USERNAME = String(process.env.ADMIN_USERNAME || '').trim();
const ADMIN_PASSWORD = String(process.env.ADMIN_PASSWORD || '');
const ADMIN_SESSION_MS = 12 * 60 * 60 * 1000;
const adminToken = req => (req.headers.cookie || '').match(/(?:^|; )aven_admin=([a-f0-9]{64})/)?.[1];
const adminTokenHash = value => crypto.createHash('sha256').update(value).digest('hex');
const adminFrom = req => {
  const raw = adminToken(req);
  if (!raw) return null;
  const tokenHash = adminTokenHash(raw), session = get('SELECT expires FROM admin_sessions WHERE token_hash=?', tokenHash);
  if (!session || session.expires < Date.now()) {
    if (session) run('DELETE FROM admin_sessions WHERE token_hash=?', tokenHash);
    return null;
  }
  return { username: ADMIN_USERNAME };
};
const secureStringEqual = (left, right) => crypto.timingSafeEqual(
  crypto.createHash('sha256').update(String(left)).digest(),
  crypto.createHash('sha256').update(String(right)).digest()
);
const maskEmail = email => { const [name, domain] = email.split('@'); return `${(name[0] || '')}${'*'.repeat(Math.max(2, Math.min(5, name.length - 1)))}@${domain}`; };
const escapeHtml = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const codeHash = code => crypto.createHash('sha256').update(code).digest('hex');
const sendVerificationEmail = async (email, displayName, code) => {
  if (!mailer) throw new E(503, 'Mail doğrulama sistemi henüz yapılandırılmamış. Sunucuya Gmail uygulama şifresini ekleyin.');
  const safeName = escapeHtml(displayName || 'Aven kullanıcısı');
  const text = `Merhaba ${displayName || ''},\n\nAven hesabını doğrulamak için kodun: ${code}\n\nBu kod 10 dakika boyunca geçerlidir. Bu işlemi sen başlatmadıysan bu e-postayı dikkate alma.`;
  const html = `<!doctype html><html lang="tr"><body style="margin:0;background:#0d0f15;font-family:Arial,sans-serif;color:#eef1fa"><div style="max-width:560px;margin:32px auto;padding:34px 28px;background:linear-gradient(145deg,#151b2a,#0f121b);border:1px solid #293249;border-radius:22px;box-sizing:border-box"><div style="font-size:28px;font-weight:800;letter-spacing:-1px;color:#fff">Aven<span style="color:#8198ff">.</span></div><p style="margin:30px 0 8px;color:#9da8be;font-size:12px;text-transform:uppercase;letter-spacing:1.5px">Hesap doğrulama</p><h1 style="margin:0;font-size:25px;line-height:1.2">E-posta adresini doğrula</h1><p style="margin:18px 0;color:#b9c1d2;line-height:1.6">Merhaba ${safeName}, Aven hesabını tamamlamak için aşağıdaki doğrulama kodunu kullan.</p><div style="margin:26px 0;padding:22px;text-align:center;border:1px solid #586cae66;border-radius:16px;background:#1b2540"><strong style="font-size:36px;letter-spacing:10px;color:#fff">${code}</strong></div><p style="margin:0;color:#8994ab;font-size:12px;line-height:1.6">Bu kod 10 dakika boyunca geçerlidir. Bu işlemi sen başlatmadıysan bu e-postayı dikkate alma.</p><div style="margin-top:30px;padding-top:18px;border-top:1px solid #ffffff12;color:#69748b;font-size:11px">Bu otomatik bir bilgilendirme mesajıdır. Lütfen yanıtlamayın.</div></div></body></html>`;
  await mailer.sendMail({ from: `"${MAIL_FROM_NAME}" <${MAIL_FROM_EMAIL}>`, to: email, subject: 'Aven e-posta doğrulama kodun', text, html });
};
const sendFriendRequestEmail = async (recipient, requester) => {
  if (!mailer || !recipient?.email) return;
  const safeRecipient = escapeHtml(recipient.display_name || 'Aven kullanıcısı');
  const safeRequester = escapeHtml(requester.display_name || requester.username || 'Bir Aven üyesi');
  const safeUsername = escapeHtml(requester.username || '');
  const text = `Merhaba ${recipient.display_name || ''},\n\n${requester.display_name || requester.username} (@${requester.username}) sana Aven'de arkadaşlık isteği gönderdi.\n\nAven hesabına giriş yaparak isteği gelen kutundan kabul edebilir veya reddedebilirsin.\n\n${SITE_URL}\n\nBu e-postayı beklemiyorsan işlem yapmana gerek yok.`;
  const html = `<!doctype html><html lang="tr"><body style="margin:0;background:#0d0f15;font-family:Arial,sans-serif;color:#eef1fa"><div style="max-width:600px;margin:32px auto;padding:34px 30px;background:linear-gradient(145deg,#171d2b,#10131c);border:1px solid #293249;border-radius:22px;box-sizing:border-box"><div style="display:flex;align-items:center;gap:10px"><img src="${SITE_URL}/logo.png" width="38" height="38" alt="Aven" style="object-fit:contain"><strong style="font-size:25px;color:#fff;letter-spacing:-.7px">Aven</strong></div><p style="margin:32px 0 8px;color:#9da8be;font-size:12px;text-transform:uppercase;letter-spacing:1.5px">Yeni arkadaşlık isteği</p><h1 style="margin:0;font-size:27px;line-height:1.25;color:#fff">Merhaba ${safeRecipient}</h1><p style="margin:18px 0;color:#c0c7d6;font-size:15px;line-height:1.7"><b style="color:#fff">${safeRequester}</b> <span style="color:#9da8be">@${safeUsername}</span> Aven'de seninle arkadaş olmak istiyor.</p><div style="margin:24px 0;padding:20px;border:1px solid #586cae55;border-radius:16px;background:#1a2236"><p style="margin:0;color:#dce3f5;line-height:1.65">Arkadaşlık isteğini Aven'e giriş yaptıktan sonra gelen kutunda bulabilir, kabul ederek sohbetlerinize başlayabilir ya da isteği yanıtsız bırakabilirsin.</p></div><a href="${SITE_URL}" style="display:inline-block;padding:13px 20px;border-radius:11px;background:#657cf4;color:#fff;text-decoration:none;font-weight:700">Aven'i aç</a><p style="margin:24px 0 0;color:#8490a7;font-size:12px;line-height:1.6">Bu isteği beklemiyorsan bu e-postayı dikkate almayabilirsin. Hesap güvenliğin için şifreni veya doğrulama kodlarını kimseyle paylaşma.</p><div style="margin-top:28px;padding-top:18px;border-top:1px solid #ffffff12;color:#69748b;font-size:11px">Aven · Arkadaşlarınla konuşmak ve paylaşmak için.</div></div></body></html>`;
  await mailer.sendMail({ from: `"${MAIL_FROM_NAME}" <${MAIL_FROM_EMAIL}>`, to: recipient.email, subject: `${requester.display_name || requester.username} sana Aven'de arkadaşlık isteği gönderdi`, text, html });
};
const sendBanEmail = async (email, displayName) => {
  if (!mailer) return;
  const safeName = escapeHtml(displayName || 'Aven kullanıcısı');
  const text = `Merhaba ${displayName || ''},\n\nAven hesabına erişim, topluluk kuralları nedeniyle kapatılmıştır. Bir hata olduğunu düşünüyorsan ${SITE_URL}/itiraz adresinden destek talebi oluşturabilirsin.`;
  const html = `<!doctype html><html lang="tr"><body style="margin:0;background:#0d0f15;font-family:Arial,sans-serif;color:#eef1fa"><div style="max-width:560px;margin:32px auto;padding:34px 28px;background:linear-gradient(145deg,#21151d,#0f121b);border:1px solid #633449;border-radius:22px"><div style="font-size:28px;font-weight:800;color:#fff">Aven<span style="color:#ef6f8d">.</span></div><h1 style="margin:30px 0 12px;font-size:24px">Hesabın kapatıldı</h1><p style="color:#c8b8c0;line-height:1.7">Merhaba ${safeName}, Aven hesabına erişim topluluk kuralları nedeniyle kapatılmıştır.</p><div style="margin:22px 0;padding:16px;border:1px solid #ef6f8d55;border-radius:12px;background:#4b1f3033;color:#f5b6c5">Bu hesapla giriş yapılamaz ve uygulamadaki oturumların sonlandırılmıştır.</div><p style="color:#8994ab;font-size:12px;line-height:1.6">Bir hata olduğunu düşünüyorsan <a href="${SITE_URL}/itiraz" style="color:#f5b6c5">${SITE_URL}/itiraz</a> adresinden destek talebi oluşturabilirsin.</p></div></body></html>`;
  await mailer.sendMail({ from: `"${MAIL_FROM_NAME}" <${MAIL_FROM_EMAIL}>`, to: email, subject: 'Aven hesabın kapatıldı', text, html });
};
const SUPPORT_REPLY_EMAIL = String(process.env.SUPPORT_REPLY_EMAIL || 'true').toLowerCase() !== 'false';
const TICKET_UNANSWERED_MS = 24 * 60 * 60 * 1000, TICKET_CLOSED_MS = 60 * 60 * 1000;
const trDate = ms => new Date(Number(ms)).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul', day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
// Talep ile ilgili tüm bilgilendirme e-postaları (yanıt, kapanma, otomatik silinme) tek şablondan gönderilir.
const sendTicketMail = async ({ to, name, subject, ticketId, title, intro, blocks, note }) => {
  if (!mailer || !SUPPORT_REPLY_EMAIL) return;
  const cleanSubject = String(subject).replace(/[\r\n]+/g, ' ').slice(0, 100), who = name || 'Aven kullanıcısı';
  const text = `Merhaba ${who},\n\n${intro}\n\nTalep: #${ticketId} — ${cleanSubject}\n\n${blocks.map(b => `[${b.label}]\n${b.text}`).join('\n\n')}\n\n${note}\n\n— Aven Destek`;
  const blockHtml = blocks.map(b => `<div style="margin:0 0 12px"><div style="margin:0 0 6px;color:${b.reply ? '#a9b8ff' : '#8f9bb5'};font-size:11px;font-weight:700;letter-spacing:.4px">${escapeHtml(b.label)}</div><div style="padding:14px 16px;border:1px solid ${b.reply ? '#4a5aa8' : '#3a4568'};border-radius:12px;background:${b.reply ? '#1c2447' : '#1a2133'};color:#e6eaf7;line-height:1.7;font-size:14px">${escapeHtml(b.text).replace(/\n/g, '<br>')}</div></div>`).join('');
  const html = `<!doctype html><html lang="tr"><body style="margin:0;background:#0d0f15;font-family:Arial,sans-serif;color:#eef1fa"><div style="max-width:580px;margin:32px auto;padding:34px 28px;background:linear-gradient(145deg,#151b2a,#0f121b);border:1px solid #2d3652;border-radius:22px"><div style="font-size:28px;font-weight:800;color:#fff">Aven<span style="color:#8ea2ff">.</span></div><h1 style="margin:28px 0 8px;font-size:22px">${escapeHtml(title)}</h1><p style="margin:0 0 6px;color:#9aa6c0;font-size:13px;line-height:1.7">Merhaba ${escapeHtml(who)}, ${escapeHtml(intro)}</p><p style="margin:0 0 18px;color:#7f8aa1;font-size:12px">Talep #${Number(ticketId)} · <b style="color:#dfe5f7">${escapeHtml(cleanSubject)}</b></p>${blockHtml}<div style="margin:18px 0 0;padding:12px 14px;border-radius:10px;background:#ffffff08;color:#8f9bb5;font-size:12px;line-height:1.7">${escapeHtml(note)}</div><p style="margin:18px 0 0;color:#68738c;font-size:11px">Bu e-postayı yanıtlamana gerek yok.</p></div></body></html>`;
  await mailer.sendMail({ from: `"${MAIL_FROM_NAME}" <${MAIL_FROM_EMAIL}>`, to, subject: `Aven Destek: ${cleanSubject}`, text, html });
};
const ticketThreadBlocks = (ticketId, displayName) => all('SELECT author_type AS authorType,body,created_at AS createdAt FROM support_messages WHERE ticket_id=? ORDER BY id', ticketId)
  .map(m => ({ label: `${m.authorType === 'admin' ? 'Aven Destek' : 'Sen'} · ${trDate(m.createdAt)}`, text: m.body, reply: m.authorType === 'admin' }));
const mailTicketReplied = (t) => sendTicketMail({ to: t.email, name: t.displayName, subject: t.subject, ticketId: t.id, title: 'Destek talebine yanıt',
  intro: `"${String(t.subject).slice(0, 100)}" konulu destek talebin yanıtlandı. Talebin ve aldığın yanıt aşağıda.`, blocks: ticketThreadBlocks(t.id),
  note: `Talebin ${trDate(t.createdAt)} tarihinde oluşturuldu. Talep kapatıldığında 1 saat içinde, yanıtsız kalırsa 24 saat sonunda sistemden otomatik olarak silinir.` });
const mailTicketClosed = (t) => sendTicketMail({ to: t.email, name: t.displayName, subject: t.subject, ticketId: t.id, title: 'Destek talebin kapatıldı',
  intro: `"${String(t.subject).slice(0, 100)}" konulu destek talebin kapatıldı ve 1 saat içinde sistemden silinecek. Silinmeden önce talebin tam kaydı aşağıda.`, blocks: ticketThreadBlocks(t.id),
  note: `Talep ${trDate(Date.now())} tarihinde kapatıldı. Kapatılan talepler en geç 1 saat içinde silinir ve silindikten sonra bu kayda erişilemez. Gerekirse ${SITE_URL}${t.kind === 'appeal' ? '/itiraz' : '/destek'} adresinden yeni bir talep oluşturabilirsin.` });
const mailTicketExpired = (t, blocks) => sendTicketMail({ to: t.email, name: t.displayName, subject: t.subject, ticketId: t.id, title: 'Destek talebin silindi',
  intro: `"${String(t.subject).slice(0, 100)}" konulu destek talebin 24 saat içinde yanıtlanmadığı için otomatik olarak silindi. Gönderdiğin içerik aşağıda, gerekirse yeniden kullanabilirsin.`, blocks,
  note: `Talep ${trDate(t.createdAt)} tarihinde oluşturulmuştu. 24 saat boyunca yanıt verilmeyen talepler sistemden otomatik olarak silinir. Hâlâ yardıma ihtiyacın varsa ${SITE_URL}${t.kind === 'appeal' ? '/itiraz' : '/destek'} adresinden yeni bir talep oluşturabilirsin.` });
const verificationRate = new Map();
const issueVerification = async (user, force = false) => {
  const now = Date.now(), previous = get('SELECT last_sent_at FROM email_verifications WHERE user_id=?', user.id);
  if (!force && previous && now - previous.last_sent_at < 60000) throw new E(429, `Yeni kodu ${Math.ceil((60000 - (now - previous.last_sent_at)) / 1000)} saniye sonra isteyebilirsin.`);
  const code = crypto.randomInt(100000, 1000000).toString();
  run('DELETE FROM email_verifications WHERE user_id=?', user.id);
  run('INSERT INTO email_verifications(user_id,email,code_hash,expires_at,attempts,last_sent_at,created_at) VALUES(?,?,?,?,?,?,?)', user.id, user.email, codeHash(code), now + 10 * 60 * 1000, 0, now, now);
  try { await sendVerificationEmail(user.email, user.display_name, code); }
  catch (er) { run('DELETE FROM email_verifications WHERE user_id=?', user.id); throw er; }
  return { email: user.email, maskedEmail: maskEmail(user.email), expiresAt: now + 10 * 60 * 1000 };
};

const hits = new Map();
const isLoopback = ip => ip === '::1' || ip === '127.0.0.1' || ip === '::ffff:127.0.0.1';
const clientIp = req => {
  const remote = req.socket.remoteAddress || '';
  if (isLoopback(remote)) { const fwd = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim(); if (fwd) return fwd; }
  return remote;
};
const limit = req => { const ip = clientIp(req), n = Date.now(), h = (hits.get(ip) || []).filter(t => n - t < 6e4); h.push(n); hits.set(ip, h); if (h.length > 15) throw new E(429, 'Çok fazla deneme. Biraz bekleyin.'); };
setInterval(() => { const n = Date.now(); for (const [ip, h] of hits) { if (!h.some(t => n - t < 6e4)) hits.delete(ip); } }, 60000).unref();
const secureAttr = res => ['https', 'on'].includes(String(res.req?.headers['x-forwarded-proto'] || '').split(',')[0].trim().toLowerCase()) ? '; Secure' : '';
const deviceToken = req => (req.headers.cookie || '').match(/(?:^|; )aven_device=([a-f0-9]{64})/)?.[1];
const deviceHash = value => crypto.createHash('sha256').update(value).digest('hex');
const rememberDevice = (req, uid) => {
  const key = deviceToken(req) || crypto.randomBytes(32).toString('hex'), hash = deviceHash(key), now = Date.now();
  run('INSERT INTO account_devices(device_hash,user_id,last_used) VALUES(?,?,?) ON CONFLICT(device_hash,user_id) DO UPDATE SET last_used=excluded.last_used', hash, uid, now);
  run('DELETE FROM account_devices WHERE device_hash=? AND user_id NOT IN (SELECT user_id FROM account_devices WHERE device_hash=? ORDER BY last_used DESC LIMIT 2)', hash, hash);
  return key;
};
const setDeviceCookie = (res, key) => res.setHeader('Set-Cookie', `aven_device=${key}; HttpOnly; SameSite=Strict; Path=/; Max-Age=31536000${secureAttr(res)}`);
const startSession = (res, uid, deviceKey) => {
  const t = crypto.randomBytes(32).toString('hex');
  run('INSERT INTO sessions VALUES(?,?,?)', t, uid, Date.now() + SESSION);
  const cookies = [`sid=${t}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION / 1000}${secureAttr(res)}`];
  if (deviceKey) cookies.push(`aven_device=${deviceKey}; HttpOnly; SameSite=Strict; Path=/; Max-Age=31536000${secureAttr(res)}`);
  res.setHeader('Set-Cookie', cookies);
};
const token = req => (req.headers.cookie || '').match(/(?:^|; )sid=([a-f0-9]{64})/)?.[1];
const userFrom = req => { const t = token(req); const u = t && get('SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=? AND s.expires>?', t, Date.now()); return u && (isBannedEmail(u.email) ? { ...u, __banned: true } : u); };

const clients = new Map();
const push = (id, ev, d) => { for (const r of clients.get(id) || []) r.write(`event: ${ev}\ndata: ${JSON.stringify(d)}\n\n`); };
setInterval(() => clients.forEach(s => s.forEach(r => r.write('event: ping\ndata: 1\n\n'))), 25000).unref();
const dmCalls = new Map(), dmCallUsers = new Map();
const finishDmCall = (call, reason, actorId = null) => {
  if (!call || !dmCalls.has(call.id)) return;
  if (call.state === 'active') {
    const durationMs = Math.max(0, Date.now() - (call.acceptedAt || call.createdAt));
    addMessage(call.callerId, call.recipientId, JSON.stringify({ type: 'ended', durationMs }), 'call-event');
  }
  dmCalls.delete(call.id);
  for (const id of [call.callerId, call.recipientId]) dmCallUsers.delete(id);
  const event = reason === 'rejected' ? 'dm-call-rejected' : 'dm-call-ended';
  const payload = { callId: call.id, reason, by: actorId };
  for (const id of [call.callerId, call.recipientId]) if (id !== actorId) push(id, event, payload);
};
setInterval(() => {
  const now = Date.now();
  for (const call of dmCalls.values()) {
    if (call.state === 'ringing' && now - call.createdAt > 45000) finishDmCall(call, 'missed');
    else if (call.state === 'active' && [...call.lastSeen.values()].some(lastSeen => now - lastSeen > 45000)) finishDmCall(call, 'connection-lost');
  }
}, 15000).unref();
const voiceRooms = new Map(), watchTogetherSessions = new Map();
const voiceRoom = channelId => {
  if (!voiceRooms.has(channelId)) voiceRooms.set(channelId, new Map());
  return voiceRooms.get(channelId);
};
const voiceParticipant = (userId, state = {}) => {
  const u = get('SELECT id,username,display_name,avatar FROM users WHERE id=?', userId);
  return u && { id: u.id, username: u.username, displayName: u.display_name, avatar: u.avatar, guildTag: activeServerTag(u.id), speaking: !!state.speaking, streaming: !!state.streaming, streamId: state.streamingStreamId || null };
};
const broadcastVoice = (room, event, value) => room.forEach((_, id) => push(id, event, value));
const removeVoiceParticipant = (channelId, userId) => {
  const room = voiceRooms.get(channelId), participant = room?.get(userId);
  if (!participant) return;
  room.delete(userId);
  broadcastVoice(room, 'voice-leave', { channelId, userId });
  const watch = watchTogetherSessions.get(channelId);
  if (watch?.hostId === userId) {
    const now = Date.now();
    const position = Number(watch.position || 0) + (watch.state === 'playing' ? Math.max(0, now - Number(watch.updatedAt || now)) / 1000 : 0);
    const nextEntry = room.entries().next().value;
    const nextHost = nextEntry ? voiceParticipant(nextEntry[0], nextEntry[1]) : null;
    const updated = { ...watch, position, updatedAt: now,
      hostId: nextHost?.id ?? null,
      hostName: nextHost?.displayName ?? 'Yeni katılımcı bekleniyor',
      ...(nextHost ? {} : { state: 'paused' }) };
    watchTogetherSessions.set(channelId, updated);
    if (room.size) broadcastVoice(room, 'watch-together', { ...updated, action: 'host-change', actorId: userId });
  }
  if (!room.size) voiceRooms.delete(channelId);
};
const closeVoiceRoom = channelId => {
  const room = voiceRooms.get(channelId);
  if (room) {
    room.forEach((_, userId) => push(userId, 'voice-leave', { channelId, userId, closed: true }));
    voiceRooms.delete(channelId);
  }
  watchTogetherSessions.delete(channelId);
};
setInterval(() => {
  const staleBefore = Date.now() - 45000;
  voiceRooms.forEach((room, channelId) => room.forEach((p, userId) => {
    if (p.lastSeen < staleBefore) removeVoiceParticipant(channelId, userId);
  }));
}, 15000).unref();
readBannedEmails();
bannedEmails.forEach(email => run('DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE lower(email)=?)', email));
let announcedBans = new Set(bannedEmails);
const enforceBans = async () => {
  readBannedEmails();
  const newlyBanned = [...bannedEmails].filter(email => !announcedBans.has(email));
  announcedBans = new Set(bannedEmails);
  if (!newlyBanned.length) return;
  for (const email of newlyBanned) {
    const users = all('SELECT id,email,display_name FROM users WHERE lower(email)=?', email);
    for (const user of users) {
      run('DELETE FROM sessions WHERE user_id=?', user.id);
      run('DELETE FROM email_verifications WHERE user_id=?', user.id);
      voiceRooms.forEach((room, channelId) => { if (room.has(user.id)) removeVoiceParticipant(channelId, user.id); });
      push(user.id, 'account-banned', { message: 'Hesabın kapatıldı.' });
      const streams = clients.get(user.id);
      streams?.forEach(stream => stream.end());
      clients.delete(user.id);
      sendBanEmail(user.email, user.display_name).catch(er => console.error('Ban bilgilendirme maili gönderilemedi:', er.message));
    }
  }
};
setInterval(() => enforceBans().catch(er => console.error('Ban denetimi başarısız:', er.message)), 10000).unref();

const rel = (a, b) => get('SELECT * FROM friendships WHERE (requester=? AND addressee=?) OR (requester=? AND addressee=?)', a, b, b, a);
const areFriends = (a, b) => rel(a, b)?.status === 'accepted';
const friendIds = id => all('SELECT CASE WHEN requester=? THEN addressee ELSE requester END AS id FROM friendships WHERE requester=? OR addressee=?', id, id, id).map(r => r.id);
const notify = (userId, type, actorId, entityId = 0) => {
  run(`INSERT INTO notifications(user_id,type,actor_id,entity_id,created_at) VALUES(?,?,?,?,?)
    ON CONFLICT(user_id,type,entity_id) DO UPDATE SET actor_id=excluded.actor_id,created_at=excluded.created_at,read_at=NULL`, userId, type, actorId, entityId, Date.now());
  push(userId, 'notifications', {});
};
const personalFor = (userId, targetId) => get('SELECT note,nickname FROM user_personalizations WHERE user_id=? AND target_id=?', userId, targetId) || { note: '', nickname: '' };
const listFor = id => {
  const out = { friends: [], incoming: [], outgoing: [], conversations: [], messageRequests: [] };
  for (const r of all(`SELECT f.id fid, f.requester, f.status, u.* FROM friendships f JOIN users u ON u.id = CASE WHEN f.requester=? THEN f.addressee ELSE f.requester END WHERE f.requester=? OR f.addressee=?`, id, id, id)) {
    if (get('SELECT 1 FROM dm_hides WHERE user_id=? AND other_id=?', id, r.id)) continue;
    const o = { ...pub(r), ...personalFor(id, r.id), fid: r.fid };
    if (r.status === 'accepted') {
      const l = get('SELECT sender, body, kind, created_at FROM messages WHERE (sender=? AND receiver=?) OR (sender=? AND receiver=?) ORDER BY id DESC LIMIT 1', id, r.id, r.id, id);
      o.online = !!r.is_bot || (clients.has(r.id) && r.presence !== 'invisible'); o.presence = o.online ? (r.presence || 'online') : 'offline'; o.last = l ? { sender: l.sender, body: l.body, kind: l.kind, createdAt: l.created_at } : null; out.friends.push(o);
    } else (r.requester === id ? out.outgoing : out.incoming).push(o);
  }
  for (const row of all(`SELECT DISTINCT CASE WHEN sender=? THEN receiver ELSE sender END AS contact_id
    FROM messages WHERE sender=? OR receiver=?`, id, id, id)) {
    const contact = get('SELECT * FROM users WHERE id=?', row.contact_id);
    if (!contact || areFriends(id, contact.id) || get('SELECT 1 FROM dm_hides WHERE user_id=? AND other_id=?', id, contact.id)) continue;
    const last = get('SELECT sender,body,kind,created_at FROM messages WHERE (sender=? AND receiver=?) OR (sender=? AND receiver=?) ORDER BY id DESC LIMIT 1', id, contact.id, contact.id, id);
    out.conversations.push({ ...pub(contact), ...personalFor(id, contact.id), isFriend: false, blocked: isBlocked(id, contact.id), canMessage: canDm(id, contact.id), online: !!contact.is_bot || (clients.has(contact.id) && contact.presence !== 'invisible'), presence: clients.has(contact.id) ? contact.presence : 'offline', last: last ? { sender: last.sender, body: last.body, kind: last.kind, createdAt: last.created_at } : null });
  }
  out.messageRequests = all(`SELECT r.id AS request_id,r.body,r.created_at,u.* FROM dm_requests r JOIN users u ON u.id=r.sender
    WHERE r.recipient=? AND r.status='pending' ORDER BY r.created_at DESC`, id).map(r => ({ id: r.request_id, body: r.body, createdAt: r.created_at, sender: pub(r) }));
  return out;
};

const routes = [], R = (m, p, f, open, raw) => routes.push([m, new RegExp('^' + p + '$'), f, open, raw]);
const presenceLabel = value => ({ online: 'Çevrimiçi', idle: 'Boşta', dnd: 'Rahatsız Etmeyin', invisible: 'Görünmez' })[value] || 'Çevrimdışı';
const ticketById = id => get(`SELECT t.id,t.user_id AS userId,t.subject,t.status,t.kind,t.closed_at AS closedAt,t.created_at AS createdAt,t.updated_at AS updatedAt,
  u.email,u.username,u.display_name AS displayName
  FROM support_tickets t JOIN users u ON u.id=t.user_id WHERE t.id=? AND u.is_bot=0`, id);
const ticketMessages = id => all(`SELECT id,author_type AS authorType,body,created_at AS createdAt
  FROM support_messages WHERE ticket_id=? ORDER BY id`, id);

R('POST', '/api/admin/login', ({ req, res, body }) => {
  limit(req);
  if (!ADMIN_USERNAME || !ADMIN_PASSWORD) throw new E(503, 'Yönetici girişi sunucuda yapılandırılmamış.');
  const username = String(body.username || '').trim(), password = String(body.password || '');
  if (!secureStringEqual(username, ADMIN_USERNAME) || !secureStringEqual(password, ADMIN_PASSWORD)) throw new E(401, 'Kullanıcı adı veya şifre hatalı.');
  const raw = crypto.randomBytes(32).toString('hex'), expires = Date.now() + ADMIN_SESSION_MS;
  run('INSERT INTO admin_sessions(token_hash,expires) VALUES(?,?)', adminTokenHash(raw), expires);
  res.setHeader('Set-Cookie', `aven_admin=${raw}; HttpOnly; SameSite=Strict; Path=/api/admin; Max-Age=${ADMIN_SESSION_MS / 1000}${secureAttr(res)}`);
  return { username: ADMIN_USERNAME };
}, true);
R('GET', '/api/admin/session', ({ admin }) => ({ username: admin.username }), true);
R('POST', '/api/admin/logout', ({ req, res }) => {
  const raw = adminToken(req);
  if (raw) run('DELETE FROM admin_sessions WHERE token_hash=?', adminTokenHash(raw));
  res.setHeader('Set-Cookie', `aven_admin=; HttpOnly; SameSite=Strict; Path=/api/admin; Max-Age=0${secureAttr(res)}`);
  return { ok: true };
}, true);
R('GET', '/api/admin/overview', () => {
  const users = Number(get('SELECT COUNT(*) AS c FROM users WHERE is_bot=0').c);
  const activeUsers = all('SELECT id,username,display_name AS displayName,presence FROM users WHERE is_bot=0 ORDER BY display_name').filter(u => clients.has(u.id) && u.presence !== 'invisible');
  const recentTickets = all(`SELECT t.id,t.subject,t.status,t.kind,t.updated_at AS updatedAt,u.email,u.display_name AS displayName,
    (SELECT body FROM support_messages m WHERE m.ticket_id=t.id ORDER BY m.id DESC LIMIT 1) AS lastMessage
    FROM support_tickets t JOIN users u ON u.id=t.user_id WHERE t.status!='closed' AND u.is_bot=0 ORDER BY t.updated_at DESC LIMIT 5`);
  return { users, onlineUsers: activeUsers.length, servers: Number(get('SELECT COUNT(*) AS c FROM servers').c),
    openTickets: Number(get("SELECT COUNT(*) AS c FROM support_tickets WHERE status!='closed'").c),
    activeUsers: activeUsers.slice(0, 6).map(u => ({ ...u, presenceLabel: presenceLabel(u.presence) })), recentTickets };
}, true);
const ANNOUNCEMENT_LOCALES = ['tr', 'en', 'de'];
const ANNOUNCEMENT_LOCALE_LABELS = { tr: 'Türkçe', en: 'English', de: 'Deutsch' };
const announcementUrl = value => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (raw.length > 500) throw bad('Yönlendirme bağlantısı en fazla 500 karakter olabilir.');
  let parsed;
  try { parsed = new URL(raw); } catch { throw bad('Yönlendirme bağlantısı geçerli bir adres olmalı.'); }
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) throw bad('Yalnızca kullanıcı adı ve şifre içermeyen HTTP veya HTTPS bağlantıları kullanılabilir.');
  return parsed.href;
};
const splitAnnouncementText = value => {
  const paragraphs = String(value).split(/(\n+)/u), chunks = [];
  for (const paragraph of paragraphs) {
    if (!paragraph || /^\n+$/u.test(paragraph)) { chunks.push(paragraph); continue; }
    let rest = paragraph;
    while (rest.length > 450) {
      let cut = rest.lastIndexOf(' ', 450);
      if (cut < 200) cut = 450;
      chunks.push(rest.slice(0, cut).trim());
      rest = rest.slice(cut).trimStart();
    }
    chunks.push(rest);
  }
  return chunks;
};
const translateAnnouncement = async (value, from, to) => {
  if (!value) return '';
  const translated = [];
  for (const chunk of splitAnnouncementText(value)) {
    if (!chunk || /^\n+$/u.test(chunk)) { translated.push(chunk); continue; }
    const query = new URLSearchParams({ q: chunk, langpair: `${from}|${to}` });
    let response;
    try { response = await fetch(`https://api.mymemory.translated.net/get?${query}`, { signal: AbortSignal.timeout(12000) }); }
    catch { throw new E(502, `${ANNOUNCEMENT_LOCALE_LABELS[to]} çevirisine şu anda ulaşılamıyor. Duyuru yayımlanmadı; biraz sonra yeniden dene.`); }
    if (!response.ok) throw new E(502, `${ANNOUNCEMENT_LOCALE_LABELS[to]} çeviri hizmeti yanıt vermedi. Duyuru yayımlanmadı.`);
    let result;
    try { result = await response.json(); } catch { throw new E(502, 'Çeviri hizmetinden geçerli yanıt alınamadı. Duyuru yayımlanmadı.'); }
    const text = String(result?.responseData?.translatedText || '').trim();
    if (Number(result?.responseStatus) !== 200 || !text || /quota exceeded|no query specified/iu.test(text)) throw new E(502, `${ANNOUNCEMENT_LOCALE_LABELS[to]} çevirisi tamamlanamadı. Duyuru yayımlanmadı.`);
    translated.push(text);
  }
  return translated.join(' ').replace(/\s+([,.;!?])/gu, '$1').replace(/\s*\n\s*/gu, '\n').trim();
};
const mapAnnouncementTranslations = async (tasks, concurrency = 4) => {
  const results = new Array(tasks.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(concurrency, tasks.length) }, async () => {
    while (true) {
      const index = next++;
      if (index >= tasks.length) return;
      const task = tasks[index];
      results[index] = await translateAnnouncement(task.value, 'tr', task.locale);
    }
  });
  await Promise.all(workers);
  return results;
};
const announcementView = row => ({ id: row.id, title: row.title, body: row.body, sourceLocale: row.source_locale,
  translations: JSON.parse(row.translations), createdBy: row.created_by, createdAt: row.created_at });
const defaultAnnouncementLinkLabel = { tr: 'Daha fazla bilgi', en: 'Learn more', de: 'Mehr erfahren' };
R('GET', '/api/admin/announcements', () => all('SELECT * FROM announcements ORDER BY created_at DESC,id DESC').map(announcementView), true);
R('POST', '/api/admin/announcements', async ({ body, admin }) => {
  const publishPassword = String(process.env.duyurupasworld || '');
  if (!publishPassword) throw new E(503, 'Duyuru gönderme şifresi sunucuda ayarlanmamış.');
  if (!secureStringEqual(body.password || '', publishPassword)) throw new E(401, 'Duyuru gönderme şifresi hatalı.');
  const sourceLocale = 'tr';
  const title = String(body.title || '').trim(), text = String(body.body || '').trim();
  if (!title || title.length > 100) throw bad('Başlık 1-100 karakter olmalı.');
  if (!text || text.length > 1800) throw bad('Duyuru metni 1-1800 karakter olmalı.');
  const sourceLinks = [1, 2].flatMap(index => {
    const url = announcementUrl(body[`link${index}Url`]);
    if (!url) return [];
    const label = String(body[`link${index}Label`] || '').trim().slice(0, 60) || defaultAnnouncementLinkLabel[sourceLocale];
    return [{ label, url }];
  });
  const translations = { [sourceLocale]: { title, body: text, links: sourceLinks } };
  const targets = ANNOUNCEMENT_LOCALES.filter(item => item !== sourceLocale);
  const translationTasks = targets.flatMap(locale => [
    { locale, value: title }, { locale, value: text },
    ...sourceLinks.map(link => ({ locale, value: link.label }))
  ]);
  const translatedValues = await mapAnnouncementTranslations(translationTasks);
  let taskIndex = 0;
  for (const locale of targets) {
    const translatedTitle = translatedValues[taskIndex++];
    const translatedBody = translatedValues[taskIndex++];
    const translatedLabels = sourceLinks.map(() => translatedValues[taskIndex++]);
    translations[locale] = { title: translatedTitle, body: translatedBody,
      links: sourceLinks.map((link, index) => ({ label: translatedLabels[index], url: link.url })) };
  }
  const createdAt = Date.now();
  const id = Number(run('INSERT INTO announcements(title,body,source_locale,translations,created_by,created_at) VALUES(?,?,?,?,?,?)',
    title, text, sourceLocale, JSON.stringify(translations), admin.username, createdAt).lastInsertRowid);
  all('SELECT id FROM users WHERE is_bot=0').forEach(({ id: userId }) => {
    notify(userId, 'announcement', null, id);
    push(userId, 'announcement', { id });
  });
  return announcementView(get('SELECT * FROM announcements WHERE id=?', id));
}, true);
R('GET', '/api/announcements/unread', ({ user }) => {
  const locale = ANNOUNCEMENT_LOCALES.includes(user.language) ? user.language : 'tr';
  return all(`SELECT a.* FROM announcements a
    LEFT JOIN announcement_views v ON v.announcement_id=a.id AND v.user_id=?
    WHERE v.announcement_id IS NULL ORDER BY a.created_at,a.id LIMIT 50`, user.id)
    .map(row => {
      const translations = JSON.parse(row.translations), content = translations[locale] || translations[row.source_locale] || translations.tr;
      return { id: row.id, locale, title: content.title, body: content.body, links: content.links || [], createdAt: row.created_at };
    });
});
R('POST', '/api/announcements/(\\d+)/view', ({ user, params: [id] }) => {
  const announcementId = Number(id);
  if (!get('SELECT 1 FROM announcements WHERE id=?', announcementId)) throw new E(404, 'Duyuru bulunamadı.');
  const viewed = run('INSERT OR IGNORE INTO announcement_views(announcement_id,user_id,viewed_at) VALUES(?,?,?)', announcementId, user.id, Date.now()).changes > 0;
  const notification = get("SELECT id FROM notifications WHERE user_id=? AND type='announcement' AND entity_id=?", user.id, announcementId);
  if (notification) {
    const changed = run('UPDATE notifications SET read_at=COALESCE(read_at,?) WHERE id=? AND read_at IS NULL', Date.now(), notification.id).changes > 0;
    if (changed) push(user.id, 'notifications', {});
  }
  return { ok: true, viewed };
});
// ---- Uyarı sistemi: en fazla 3 uyarı, af yok (geri alma / silme rotası bilerek yok) ----
db.exec('CREATE TABLE IF NOT EXISTS user_warnings(id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, number INTEGER NOT NULL, category TEXT NOT NULL, details TEXT NOT NULL DEFAULT \'\', created_at INTEGER NOT NULL, UNIQUE(user_id,number));');
const MAX_WARN = 3, WARN_STEPS = ['Gayet iyi', 'Kısıtlı', 'Çok kısıtlı', 'Risk altında', 'Askıya alındı'];
const WARN_TAIL = ['', 'Bu senin ilk resmi uyarın. Tekrarı hâlinde hesabın daha da kısıtlanır.', 'Bu ikinci ve ağır bir uyarı. Yalnızca bir uyarı hakkın kaldı; bir sonraki ihlal hesabını doğrudan riske atar.', 'Bu SON uyarın. Uyarı hakkın tükendi; bir sonraki ihlalde ek uyarı verilmeden hesabın kalıcı olarak kapatılır.'];
const warnCount = id => get('SELECT COUNT(*) c FROM user_warnings WHERE user_id=?', id).c;
const standingOf = id => { const warnings = all('SELECT number,category,details,created_at AS createdAt FROM user_warnings WHERE user_id=? ORDER BY number', id); return { max: MAX_WARN, count: warnings.length, steps: WARN_STEPS, warnings }; };
const sendWarningEmail = async (user, w) => {
  if (!mailer) return;
  const who = user.display_name || 'Aven kullanıcısı', reason = w.details ? `${w.category} — ${w.details}` : w.category;
  const text = `Merhaba ${who},\n\nAven topluluk kurallarını ihlal ettiğin tespit edildi ve hesabına ${w.number}/${MAX_WARN}. RESMİ UYARI işlendi.\n\nUyarı sebebi: ${reason}\n\n${WARN_TAIL[w.number]}\n\nUyarılar geri alınmaz, affedilmez ve itiraz edilerek silinmez. Kurallara uymaya devam etmeni bekliyoruz.\n\n— Aven Güvenlik`;
  const html = `<!doctype html><html lang="tr"><body style="margin:0;background:#0d0f12;font-family:Arial,sans-serif;color:#eceef1"><div style="max-width:560px;margin:32px auto;padding:34px 28px;background:#16181c;border:1px solid #5a2a2f;border-top:4px solid #e5484d;border-radius:18px"><div style="font-size:26px;font-weight:800;color:#fff">Aven<span style="color:#e5484d">.</span></div><p style="margin:26px 0 6px;color:#e5848a;font-size:11px;font-weight:700;letter-spacing:1.6px">RESMİ UYARI · ${w.number}/${MAX_WARN}</p><h1 style="margin:0 0 14px;font-size:23px">Topluluk kurallarını ihlal ettin</h1><p style="margin:0 0 16px;color:#c5c9d0;line-height:1.7;font-size:14px">Merhaba ${escapeHtml(who)}, hesabında kural ihlali tespit edildi ve <b style="color:#fff">${w.number}. uyarı</b> işlendi.</p><div style="padding:14px 16px;border:1px solid #4a2a2e;border-radius:12px;background:#1e1517;color:#f1d6d8;font-size:14px;line-height:1.6"><b style="display:block;margin-bottom:4px;color:#e5848a;font-size:11px;letter-spacing:.8px">UYARI SEBEBİ</b>${escapeHtml(reason)}</div><p style="margin:18px 0 0;color:#e8b4b7;font-weight:700;font-size:14px;line-height:1.7">${escapeHtml(WARN_TAIL[w.number])}</p><p style="margin:14px 0 0;color:#8d929b;font-size:12px;line-height:1.7">Uyarılar geri alınmaz, affedilmez ve itirazla silinmez. Hesap durumunu Aven içinde Ayarlar → Hesap Detayı bölümünden görebilirsin.</p></div></body></html>`;
  await mailer.sendMail({ from: `"${MAIL_FROM_NAME}" <${MAIL_FROM_EMAIL}>`, to: user.email, subject: `Aven resmi uyarı (${w.number}/${MAX_WARN}): hesabın uyarıldı`, text, html });
};
R('POST', '/api/admin/users/(\\d+)/warn', ({ params: [id], body }) => {
  const u = get('SELECT id,email,display_name,is_bot FROM users WHERE id=?', +id);
  if (!u || u.is_bot) throw new E(404, 'Kullanıcı bulunamadı.');
  const category = String(body.category || '').trim().slice(0, 80), details = String(body.details || '').trim().slice(0, 300);
  if (category.length < 3) throw bad('Uyarı sebebi seçmelisin.');
  const count = warnCount(u.id);
  if (count >= MAX_WARN) throw bad('Bu kullanıcı 3/3 uyarıya ulaştı; daha fazla uyarı verilemez.');
  const number = count + 1, now = Date.now(), w = { number, max: MAX_WARN, category, details, createdAt: now };
  run('INSERT INTO user_warnings(user_id,number,category,details,created_at) VALUES(?,?,?,?,?)', u.id, number, category, details, now);
  run("INSERT OR IGNORE INTO friendships(requester,addressee,status,created_at) VALUES(?,?,'accepted',?)", BOT, u.id, now);
  addMessage(BOT, u.id, `Hesabına ${number}. uyarı verildi: ${category}`, 'warning', JSON.stringify(w));
  push(u.id, 'standing', standingOf(u.id));
  sendWarningEmail(u, w).catch(er => console.error('Uyarı maili gönderilemedi:', er.message));
  return { ok: true, count: number };
}, true);
R('GET', '/api/admin/badges', () => ({ badges: scanBadges() }), true);
R('GET', '/api/admin/users/(\\d+)/badges', ({ params: [id] }) => {
  const target = get('SELECT id,username,display_name AS displayName FROM users WHERE id=? AND is_bot=0', Number(id));
  if (!target) throw new E(404, 'Kullanıcı bulunamadı.');
  const assigned = new Set(userBadges(target.id).map(badge => badge.file));
  return { user: target, badges: scanBadges().map(badge => ({ ...badge, assigned: assigned.has(badge.file) })) };
}, true);
R('PATCH', '/api/admin/users/(\\d+)/badges', ({ params: [id], body, admin }) => {
  const target = get('SELECT id FROM users WHERE id=? AND is_bot=0', Number(id));
  if (!target) throw new E(404, 'Kullanıcı bulunamadı.');
  if (typeof body.assigned !== 'boolean') throw bad('Rozet işlemi geçersiz.');
  const file = String(body.file || ''), badge = scanBadges().find(item => item.file === file);
  if (!badge) throw new E(404, 'Bu PNG rozeti public/rozetler klasöründe bulunamadı.');
  const changed = body.assigned
    ? run('INSERT OR IGNORE INTO user_badges(user_id,badge_file,assigned_by,assigned_at) VALUES(?,?,?,?)', target.id, badge.file, admin.username, Date.now()).changes > 0
    : run('DELETE FROM user_badges WHERE user_id=? AND badge_file=?', target.id, badge.file).changes > 0;
  if (changed) {
    userBadgesCache.delete(Number(target.id));
    const action = body.assigned ? 'granted' : 'removed';
    const bodyText = body.assigned
      ? `${badge.name} rozeti yönetici tarafından hesabına verildi.`
      : `${badge.name} rozeti yönetici tarafından hesabından kaldırıldı.`;
    addMessage(BOT, target.id, bodyText, 'badge', JSON.stringify({ action, ...badge }));
    const update = { badgesChanged: true, userId: target.id };
    push(target.id, 'friends', update);
    push(target.id, 'profile', update);
    const relatedUsers = new Set(friendIds(target.id));
    all('SELECT DISTINCT CASE WHEN sender=? THEN receiver ELSE sender END AS id FROM messages WHERE sender=? OR receiver=?', target.id, target.id, target.id)
      .forEach(({ id: relatedId }) => relatedUsers.add(relatedId));
    relatedUsers.delete(target.id);
    relatedUsers.forEach(friendId => { push(friendId, 'friends', update); push(friendId, 'profile', update); });
  }
  return { ok: true, assigned: !!get('SELECT 1 FROM user_badges WHERE user_id=? AND badge_file=?', target.id, badge.file), badges: userBadges(target.id) };
}, true);
R('GET', '/api/me/standing', ({ user }) => standingOf(user.id));
R('GET', '/api/admin/users', ({ url }) => {
  const q = String(url.searchParams.get('q') || '').trim().slice(0, 120);
  const like = '%' + q.replace(/[\\%_]/g, '\\$&') + '%';
  const rows = q
    ? all(`SELECT id,email,username,display_name AS displayName,presence,created_at AS createdAt FROM users WHERE is_bot=0 AND (lower(email) LIKE lower(?) ESCAPE '\\' OR lower(username) LIKE lower(?) ESCAPE '\\' OR lower(display_name) LIKE lower(?) ESCAPE '\\') ORDER BY id DESC LIMIT 1000`, like, like, like)
    : all('SELECT id,email,username,display_name AS displayName,presence,created_at AS createdAt FROM users WHERE is_bot=0 ORDER BY id DESC LIMIT 1000');
  return { total: rows.length, users: rows.map(u => ({ ...u, warnCount: warnCount(u.id), banned: isBannedEmail(u.email), online: clients.has(u.id) && u.presence !== 'invisible', presenceLabel: presenceLabel(u.presence) })) };
}, true);
const writeBannedEmails = list => {
  const unique = [...new Set(list.map(v => String(v).trim().toLowerCase()).filter(v => EMAIL.test(v)))].sort();
  let raw = []; try { raw = JSON.parse(fs.readFileSync(BANNED_FILE, 'utf8')); } catch {}
  const out = JSON.stringify(Array.isArray(raw) || !raw || typeof raw !== 'object' ? unique : { ...raw, emails: unique }, null, 2) + '\n', tmp = BANNED_FILE + '.tmp';
  try { fs.writeFileSync(tmp, out); fs.renameSync(tmp, BANNED_FILE); }
  catch { fs.writeFileSync(BANNED_FILE, out); fs.rmSync(tmp, { force: true }); }
};
const setBan = async (id, banned) => {
  const u = get('SELECT id,email,is_bot FROM users WHERE id=?', id);
  if (!u || u.is_bot) throw new E(404, 'Kullanıcı bulunamadı.');
  readBannedEmails();
  const email = u.email.trim().toLowerCase(), list = new Set(bannedEmails);
  if (banned) list.add(email); else list.delete(email);
  writeBannedEmails([...list]);
  await enforceBans();
  return { ok: true, banned: isBannedEmail(u.email) };
};
R('POST', '/api/admin/users/(\\d+)/ban', ({ params: [id] }) => setBan(+id, true), true);
R('POST', '/api/admin/users/(\\d+)/unban', ({ params: [id] }) => setBan(+id, false), true);
R('GET', '/api/admin/servers', () => {
  const servers = all(`SELECT s.id,s.name,s.verified,s.created_at AS createdAt,o.display_name AS ownerDisplayName,
    (SELECT COUNT(*) FROM server_members sm WHERE sm.server_id=s.id) AS memberCount,
    (SELECT COUNT(*) FROM server_channels c WHERE c.server_id=s.id) AS channelCount
    FROM servers s JOIN users o ON o.id=s.owner_id ORDER BY s.created_at DESC`);
  return { servers: servers.map(s => ({ ...s, verified: !!s.verified, onlineCount: all('SELECT user_id FROM server_members WHERE server_id=?', s.id).filter(m => {
    const u = get('SELECT presence FROM users WHERE id=?', m.user_id); return u && clients.has(m.user_id) && u.presence !== 'invisible';
  }).length })) };
}, true);
R('POST', '/api/admin/servers/(\\d+)/verified', ({ params: [id], body }) => {
  const password = String(process.env.duyurupasworld || '');
  if (!password) throw new E(503, 'Doğrulama şifresi sunucuda ayarlanmamış.');
  if (!secureStringEqual(body.password || '', password)) throw new E(401, 'Doğrulama şifresi hatalı.');
  if (typeof body.verified !== 'boolean') throw bad('Sunucu doğrulama işlemi geçersiz.');
  const server = get('SELECT id FROM servers WHERE id=?', Number(id));
  if (!server) throw new E(404, 'Sunucu bulunamadı.');
  run('UPDATE servers SET verified=? WHERE id=?', body.verified ? 1 : 0, server.id);
  const updated = serverSummary(get('SELECT * FROM servers WHERE id=?', server.id));
  pushServer(server.id, 'server', { serverId: server.id, verifiedChanged: true });
  return { ok: true, server: updated };
}, true);
R('GET', '/api/admin/support/tickets', ({ url }) => {
  const where = url.searchParams.get('status') === 'all' ? '' : "WHERE t.status!='closed'";
  const tickets = all(`SELECT t.id,t.subject,t.status,t.kind,t.created_at AS createdAt,t.updated_at AS updatedAt,u.email,u.username,u.display_name AS displayName,
    (SELECT COUNT(*) FROM support_messages m WHERE m.ticket_id=t.id) AS messageCount,
    (SELECT body FROM support_messages m WHERE m.ticket_id=t.id ORDER BY m.id DESC LIMIT 1) AS lastMessage
    FROM support_tickets t JOIN users u ON u.id=t.user_id ${where} ${where ? 'AND' : 'WHERE'} u.is_bot=0 ORDER BY t.updated_at DESC LIMIT 250`);
  return { tickets };
}, true);
R('GET', '/api/admin/support/tickets/(\\d+)', ({ params: [id] }) => {
  const ticket = ticketById(+id); if (!ticket) throw new E(404, 'Destek talebi bulunamadı.');
  return { ticket, messages: ticketMessages(+id) };
}, true);
R('POST', '/api/admin/support/tickets/(\\d+)/messages', ({ params: [id], body }) => {
  const ticket = ticketById(+id); if (!ticket) throw new E(404, 'Destek talebi bulunamadı.');
  const message = String(body.message || '').trim(); if (message.length < 1 || message.length > 4000) throw bad('Yanıt 1-4000 karakter olmalı.');
  const now = Date.now(); db.exec('BEGIN IMMEDIATE');
  try { run("INSERT INTO support_messages(ticket_id,author_type,body,created_at) VALUES(?,'admin',?,?)", +id, message, now); run("UPDATE support_tickets SET status='answered',updated_at=? WHERE id=?", now, +id); db.exec('COMMIT'); }
  catch (er) { db.exec('ROLLBACK'); throw er; }
  mailTicketReplied(ticket).catch(er => console.error('Destek yanıt maili gönderilemedi:', er.message));
  return { ok: true, emailed: !!mailer && SUPPORT_REPLY_EMAIL };
}, true);
R('PATCH', '/api/admin/support/tickets/(\\d+)', ({ params: [id], body }) => {
  const ticket = ticketById(+id); if (!ticket) throw new E(404, 'Destek talebi bulunamadı.');
  const status = String(body.status || ''); if (!['open','answered','closed'].includes(status)) throw bad('Geçersiz talep durumu.');
  const now = Date.now(), justClosed = status === 'closed' && ticket.status !== 'closed';
  run('UPDATE support_tickets SET status=?,updated_at=?,closed_at=? WHERE id=?', status, now, status === 'closed' ? (justClosed ? now : ticket.closedAt || now) : null, +id);
  if (justClosed) mailTicketClosed(ticket).catch(er => console.error('Talep kapanış maili gönderilemedi:', er.message));
  return { ok: true, status, emailed: justClosed && !!mailer && SUPPORT_REPLY_EMAIL };
}, true);
// Otomatik temizlik: 24 saat yanıtsız kalan talepler ve kapatılalı 1 saat geçen talepler silinir (mesajlar da birlikte silinir).
const cleanupTickets = () => {
  try {
    const now = Date.now();
    const expired = all("SELECT id FROM support_tickets WHERE status='open' AND created_at<? AND NOT EXISTS (SELECT 1 FROM support_messages m WHERE m.ticket_id=support_tickets.id AND m.author_type='admin')", now - TICKET_UNANSWERED_MS);
    for (const { id } of expired) {
      const t = ticketById(id), blocks = ticketThreadBlocks(id);
      run('DELETE FROM support_tickets WHERE id=?', id);
      if (t) mailTicketExpired(t, blocks).catch(er => console.error('Talep silinme maili gönderilemedi:', er.message));
    }
    const closed = run("DELETE FROM support_tickets WHERE status='closed' AND COALESCE(closed_at,updated_at)<?", now - TICKET_CLOSED_MS);
    if (expired.length || closed.changes) console.log(`Destek temizliği: ${expired.length} yanıtsız, ${closed.changes} kapalı talep silindi.`);
  } catch (er) { console.error('Destek temizliği başarısız:', er.message); }
};
setInterval(cleanupTickets, 2 * 60 * 1000).unref();
setTimeout(cleanupTickets, 4000).unref();
R('GET', '/api/support/tickets', ({ user }) => ({ tickets: all(`SELECT t.id,t.subject,t.status,t.created_at AS createdAt,t.updated_at AS updatedAt,
  (SELECT COUNT(*) FROM support_messages m WHERE m.ticket_id=t.id) AS messageCount
  FROM support_tickets t WHERE t.user_id=? ORDER BY t.updated_at DESC`, user.id) }));
R('POST', '/api/support/tickets', ({ user, body }) => {
  const subject = String(body.subject || '').replace(/\s+/g, ' ').trim(), message = String(body.message || '').trim();
  if (subject.length < 4 || subject.length > 100) throw bad('Konu 4-100 karakter olmalı.');
  if (message.length < 5 || message.length > 4000) throw bad('Mesaj 5-4000 karakter olmalı.');
  if (Number(get('SELECT COUNT(*) AS c FROM support_tickets WHERE user_id=? AND created_at>?', user.id, Date.now() - 3600000).c) >= 5) throw new E(429, 'Son bir saatte çok fazla talep oluşturdun. Lütfen biraz sonra tekrar dene.');
  const now = Date.now(); let id; db.exec('BEGIN IMMEDIATE');
  try { id = Number(run("INSERT INTO support_tickets(user_id,subject,status,created_at,updated_at) VALUES(?,?,'open',?,?)", user.id, subject, now, now).lastInsertRowid); run("INSERT INTO support_messages(ticket_id,author_type,author_user_id,body,created_at) VALUES(?,'user',?,?,?)", id, user.id, message, now); db.exec('COMMIT'); }
  catch (er) { db.exec('ROLLBACK'); throw er; }
  return { id, status: 'open' };
});
R('GET', '/api/support/tickets/(\\d+)', ({ user, params: [id] }) => {
  const ticket = get('SELECT id,subject,status,created_at AS createdAt,updated_at AS updatedAt,closed_at AS closedAt FROM support_tickets WHERE id=? AND user_id=?', +id, user.id);
  if (!ticket) throw new E(404, 'Destek talebi bulunamadı.');
  return { ticket, messages: ticketMessages(+id) };
});
// Kapatılmış (banlı) hesap sahipleri için herkese açık itiraz formu: oturum gerekmez, yalnızca banlı e-posta kabul edilir.
R('POST', '/api/support/appeal', ({ req, body }) => {
  limit(req);
  const email = String(body.email || '').trim().toLowerCase();
  const subject = String(body.subject || '').replace(/\s+/g, ' ').trim(), message = String(body.message || '').trim();
  if (!EMAIL.test(email) || email.length > 120) throw bad('Geçerli bir e-posta adresi girin.');
  if (subject.length < 4 || subject.length > 100) throw bad('Konu 4-100 karakter olmalı.');
  if (message.length < 10 || message.length > 4000) throw bad('Mesaj 10-4000 karakter olmalı.');
  const target = isBannedEmail(email) ? get('SELECT id FROM users WHERE lower(email)=? AND is_bot=0', email) : null;
  if (!target) throw new E(404, 'Bu e-posta adresiyle ilişkili kapatılmış bir hesap bulunamadı.');
  if (get("SELECT 1 FROM support_tickets WHERE user_id=? AND kind='appeal' AND status!='closed'", target.id)) throw new E(409, 'Yanıt bekleyen bir itirazın zaten var. Ekibin incelemesini bekle.');
  if (Number(get("SELECT COUNT(*) AS c FROM support_tickets WHERE user_id=? AND kind='appeal' AND created_at>?", target.id, Date.now() - 86400000).c) >= 3) throw new E(429, 'Bugün için itiraz hakkını doldurdun. Lütfen yarın tekrar dene.');
  const now = Date.now(); db.exec('BEGIN IMMEDIATE');
  try { const id = Number(run("INSERT INTO support_tickets(user_id,subject,status,kind,created_at,updated_at) VALUES(?,?,'open','appeal',?,?)", target.id, subject, now, now).lastInsertRowid); run("INSERT INTO support_messages(ticket_id,author_type,author_user_id,body,created_at) VALUES(?,'user',?,?,?)", id, target.id, message, now); db.exec('COMMIT'); }
  catch (er) { db.exec('ROLLBACK'); throw er; }
  return { ok: true };
}, true);
setInterval(() => { const cutoff = Date.now() - 24 * 60 * 60 * 1000; all('SELECT id FROM users WHERE email_verified=0 AND created_at<?', cutoff).forEach(({ id }) => run('DELETE FROM users WHERE id=?', id)); }, 60 * 60 * 1000).unref();

R('POST', '/api/register', async ({ req, body }) => {
  limit(req);
  const email = String(body.email ?? '').trim().toLowerCase();
  if (!EMAIL.test(email) || email.length > 120) throw bad('Geçerli bir mail adresi girin.');
  throwIfBanned(email);
  const username = cRegistrationUser(body.username), dn = cRegistrationName(body.displayName), pw = cPass(body.password);
  const existing = get('SELECT * FROM users WHERE email=?', email);
  if (existing) {
    if (!existing.email_verified) throw new E(409, 'Bu mail için doğrulama bekliyor. Kayıt ekranından yeni kod isteyebilirsin.');
    throw new E(409, 'Bu mail adresi zaten kayıtlı.');
  }
  if (get('SELECT 1 FROM users WHERE username=?', username)) throw new E(409, 'Bu kullanıcı adı alınmış.');
  const id = Number(run('INSERT INTO users(email,username,display_name,password,email_verified,created_at,public_id) VALUES(?,?,?,?,0,?,?)', email, username, dn, await hash(pw), Date.now(), makePublicUserId()).lastInsertRowid);
  try {
    const verification = await issueVerification(get('SELECT * FROM users WHERE id=?', id));
    return { verificationRequired: true, ...verification };
  } catch (er) {
    run('DELETE FROM users WHERE id=?', id);
    throw er;
  }
}, true);

R('POST', '/api/register/verify', async ({ req, res, body }) => {
  limit(req);
  const email = String(body.email ?? '').trim().toLowerCase(), code = String(body.code ?? '').trim();
  if (!EMAIL.test(email) || !/^\d{6}$/.test(code)) throw bad('6 haneli doğrulama kodunu girin.');
  const user = get('SELECT * FROM users WHERE email=? AND email_verified=0', email), pending = user && get('SELECT * FROM email_verifications WHERE user_id=?', user.id);
  if (!user || !pending) throw new E(404, 'Doğrulama isteği bulunamadı. Yeniden kayıt olmayı deneyin.');
  if (pending.expires_at < Date.now()) { run('DELETE FROM email_verifications WHERE user_id=?', user.id); throw new E(410, 'Kodun süresi dolmuş. Yeni kod iste.'); }
  if (pending.attempts >= 5) throw new E(429, 'Çok fazla hatalı deneme. Yeni kod iste.');
  if (!crypto.timingSafeEqual(Buffer.from(pending.code_hash, 'hex'), Buffer.from(codeHash(code), 'hex'))) {
    run('UPDATE email_verifications SET attempts=attempts+1 WHERE id=?', pending.id);
    throw new E(400, `Kod hatalı. Kalan deneme: ${Math.max(0, 4 - pending.attempts)}.`);
  }
  run('UPDATE users SET email_verified=1 WHERE id=?', user.id);
  run('DELETE FROM email_verifications WHERE user_id=?', user.id);
  welcome(user.id); startSession(res, user.id, rememberDevice(req, user.id));
  return self(get('SELECT * FROM users WHERE id=?', user.id));
}, true);

R('POST', '/api/register/resend', async ({ req, body }) => {
  limit(req);
  const email = String(body.email ?? '').trim().toLowerCase();
  if (!EMAIL.test(email)) throw bad('Geçerli bir mail adresi girin.');
  const user = get('SELECT * FROM users WHERE email=? AND email_verified=0', email);
  if (!user) throw new E(404, 'Doğrulanmamış kayıt bulunamadı.');
  return { verificationRequired: true, ...(await issueVerification(user)) };
}, true);

R('POST', '/api/login', async ({ req, res, body }) => {
  limit(req);
  const l = String(body.login ?? '').trim().toLowerCase();
  throwIfBanned(l);
  const u = get('SELECT * FROM users WHERE email=? OR username=?', l, l);
  if (u && isBannedEmail(u.email)) { const er = new E(403, 'Bu hesabın kullanımı kapatıldı.'); er.banned = true; throw er; }
  if (!u || u.is_bot || !(await verify(String(body.password ?? ''), u.password))) throw new E(401, 'Kullanıcı adı/mail veya şifre hatalı.');
  if (!u.email_verified) throw new E(403, 'Önce e-posta adresini doğrulaman gerekiyor. Kayıt ekranından kod isteyebilirsin.');
  startSession(res, u.id, rememberDevice(req, u.id));
  return self(u);
}, true);

R('GET', '/api/accounts', ({ req }) => {
  const key = deviceToken(req);
  if (!key) return [];
  return all(`SELECT u.id,u.username,u.display_name AS displayName,u.email,u.avatar FROM account_devices d JOIN users u ON u.id=d.user_id WHERE d.device_hash=? AND u.is_bot=0 ORDER BY d.last_used DESC LIMIT 2`, deviceHash(key)).filter(account => !isBannedEmail(account.email));
}, true);

R('POST', '/api/accounts/switch', ({ req, res, body }) => {
  const key = deviceToken(req), uid = Number(body.userId);
  if (!key || !Number.isSafeInteger(uid) || uid < 1) throw new E(403, 'Bu hesap bu bilgisayarda kayıtlı değil.');
  const hash = deviceHash(key), account = get('SELECT u.* FROM account_devices d JOIN users u ON u.id=d.user_id WHERE d.device_hash=? AND d.user_id=? AND u.is_bot=0', hash, uid);
  if (!account) throw new E(403, 'Bu hesap bu bilgisayarda kayıtlı değil.');
  throwIfBanned(account.email);
  run('UPDATE account_devices SET last_used=? WHERE device_hash=? AND user_id=?', Date.now(), hash, uid);
  const current = token(req);
  if (current) run('DELETE FROM sessions WHERE token=?', current);
  startSession(res, uid, key);
  return self(account);
}, true);

R('DELETE', '/api/accounts/(\\d+)', ({ req, params: [uid] }) => {
  const key = deviceToken(req);
  if (!key) throw new E(404, 'Kayıtlı hesap bulunamadı.');
  const result = run('DELETE FROM account_devices WHERE device_hash=? AND user_id=?', deviceHash(key), uid);
  if (!result.changes) throw new E(404, 'Kayıtlı hesap bulunamadı.');
  return { ok: true };
}, true);

R('POST', '/api/logout', ({ req, res }) => {
  run('DELETE FROM sessions WHERE token=?', token(req));
  res.setHeader('Set-Cookie', `sid=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${secureAttr(res)}`);
  return { ok: true };
});

R('GET', '/api/me', ({ req, res, user }) => {
  const oldKey = deviceToken(req), key = rememberDevice(req, user.id);
  if (!oldKey) setDeviceCookie(res, key);
  return self(user);
});

R('PUT', '/api/me', ({ user, body }) => {
  const u = { dn: user.display_name, un: user.username, av: user.avatar, th: user.theme, language: ['tr', 'en', 'de'].includes(user.language) ? user.language : 'tr', bio: user.bio, bn: user.banner, presence: user.presence || 'online', messagePolicy: user.message_policy || 'friends', developerMode: !!user.developer_mode };
  if ('displayName' in body) u.dn = cName(body.displayName);
  if ('username' in body) {
    u.un = cUser(body.username);
    if (u.un !== user.username && get('SELECT 1 FROM users WHERE username=?', u.un)) throw new E(409, 'Bu kullanıcı adı alınmış.');
  }
  if ('avatar' in body) {
    const a = body.avatar;
    if (a !== null && !(typeof a === 'string' && a.length < 200000 && /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(a))) throw bad('Geçersiz profil resmi.');
    u.av = a;
  }
  if ('bio' in body) { const b = String(body.bio ?? '').trim(); if (b.length > 160) throw bad('Hakkında en fazla 160 karakter olabilir.'); u.bio = b; }
  if ('banner' in body) {
    const a = body.banner;
    if (a !== null && !(typeof a === 'string' && a.length < 300000 && /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(a))) throw bad('Geçersiz banner.');
    u.bn = a;
  }
  if ('theme' in body) { if (!THEMES.includes(body.theme)) throw bad('Geçersiz tema.'); u.th = body.theme; }
  if ('language' in body) { if (!['tr', 'en', 'de'].includes(body.language)) throw bad('Geçersiz dil.'); u.language = body.language; }
  if ('presence' in body) { if (!PRESENCES.includes(body.presence)) throw bad('Geçersiz durum.'); u.presence = body.presence; }
  if ('messagePolicy' in body) {
    if (!['friends', 'everyone', 'nobody'].includes(body.messagePolicy)) throw bad('Geçersiz mesajlaşma tercihi.');
    u.messagePolicy = body.messagePolicy;
  }
  if ('developerMode' in body) { if (typeof body.developerMode !== 'boolean') throw bad('Geliştirici modu değeri geçersiz.'); u.developerMode = body.developerMode; }
  run('UPDATE users SET display_name=?, username=?, avatar=?, theme=?, language=?, bio=?, banner=?, presence=?, message_policy=?, developer_mode=? WHERE id=?', u.dn, u.un, u.av, u.th, u.language, u.bio, u.bn, u.presence, u.messagePolicy, u.developerMode ? 1 : 0, user.id);
  if (u.messagePolicy !== 'everyone') {
    run("UPDATE dm_requests SET status='declined',body='' WHERE recipient=? AND status='pending'", user.id);
    push(user.id, 'dm-requests', {});
  }
  const visibleProfileChanged = u.dn !== user.display_name || u.un !== user.username || u.av !== user.avatar || u.bn !== user.banner;
  friendIds(user.id).forEach(i => {
    push(i, 'friends', {});
    push(i, 'profile', {});
    if (visibleProfileChanged && areFriends(user.id, i)) notify(i, 'profile-update', user.id, user.id);
  });
  return self(get('SELECT * FROM users WHERE id=?', user.id));
});

R('PUT', '/api/password', async ({ req, user, body }) => {
  if (!(await verify(String(body.current ?? ''), user.password))) throw new E(403, 'Mevcut şifre hatalı.');
  run('UPDATE users SET password=? WHERE id=?', await hash(cPass(body.next)), user.id);
  run('DELETE FROM sessions WHERE user_id=? AND token!=?', user.id, token(req));
  return { ok: true };
});

R('GET', '/api/users/search', ({ user, url }) => {
  const q = (url.searchParams.get('q') || '').trim().replace(/^@/, '').toLowerCase().slice(0, 20);
  if (!q) return [];
  return all('SELECT * FROM users WHERE id!=? AND is_bot=0 AND username>=? AND username<? AND id NOT IN (SELECT blocked FROM blocks WHERE blocker=?) AND id NOT IN (SELECT blocker FROM blocks WHERE blocked=?) ORDER BY username LIMIT 8', user.id, q, `${q}\uffff`, user.id, user.id).map(u => {
    const r = rel(user.id, u.id);
    return { ...pub(u), rel: !r ? null : r.status === 'accepted' ? 'friend' : r.requester === user.id ? 'sent' : 'received' };
  });
});

const isBlocked = (a, b) => !!get('SELECT 1 FROM blocks WHERE (blocker=? AND blocked=?) OR (blocker=? AND blocked=?)', a, b, b, a);
const hasAcceptedDmRequest = (a, b) => !!get("SELECT 1 FROM dm_requests WHERE status='accepted' AND ((sender=? AND recipient=?) OR (sender=? AND recipient=?))", a, b, b, a);
const hasDmHistory = (a, b) => !!get('SELECT 1 FROM messages WHERE (sender=? AND receiver=?) OR (sender=? AND receiver=?) LIMIT 1', a, b, b, a);
const canReadDm = (a, b) => a !== b && (areFriends(a, b) || hasAcceptedDmRequest(a, b) || hasDmHistory(a, b));
const canDm = (a, b) => {
  if (a === b || isBlocked(a, b)) return false;
  const policy = get('SELECT message_policy FROM users WHERE id=?', b)?.message_policy || 'friends';
  return policy !== 'nobody' && (areFriends(a, b) || hasAcceptedDmRequest(a, b));
};
R('GET', '/api/blocks', ({ user }) => all('SELECT u.* FROM blocks b JOIN users u ON u.id=b.blocked WHERE b.blocker=? ORDER BY b.created_at DESC', user.id).map(pub));
R('POST', '/api/blocks', ({ user, body }) => {
  const t = get('SELECT * FROM users WHERE id=?', +body.userId);
  if (!t || t.id === user.id) throw bad('Geçersiz kullanıcı.');
  if (t.is_bot) throw bad('Resmi hesap engellenemez.');
  run('INSERT OR IGNORE INTO blocks VALUES(?,?,?)', user.id, t.id, Date.now());
  run('DELETE FROM friendships WHERE (requester=? AND addressee=?) OR (requester=? AND addressee=?)', user.id, t.id, t.id, user.id);
  run('DELETE FROM dm_requests WHERE (sender=? AND recipient=?) OR (sender=? AND recipient=?)', user.id, t.id, t.id, user.id);
  push(user.id, 'friends', {}); push(user.id, 'blocks', {}); push(t.id, 'friends', {});
  return { ok: true };
});

const SP = Object.freeze({ VIEW: 1, SEND: 2, MANAGE_CHANNELS: 4, MANAGE_ROLES: 8, MANAGE_MESSAGES: 16, CONNECT: 32, SPEAK: 64, MANAGE_SERVER: 128, INVITE: 256, UPLOAD_FILES: 512, ADMIN: 1024 });
const SP_ALL = Object.values(SP).reduce((a, b) => a | b, 0), SP_DEFAULT = SP.VIEW | SP.SEND | SP.CONNECT | SP.SPEAK | SP.INVITE;
run(`INSERT INTO server_roles(server_id,name,color,position,permissions,is_everyone)
  SELECT s.id,'@everyone','#8992a8',0,?,1 FROM servers s
  WHERE NOT EXISTS (SELECT 1 FROM server_roles r WHERE r.server_id=s.id AND r.is_everyone=1)`, SP_DEFAULT);
const serverOf = (serverId, userId) => {
  const s = get('SELECT * FROM servers WHERE id=?', serverId);
  if (!s || !get('SELECT 1 FROM server_members WHERE server_id=? AND user_id=?', serverId, userId)) throw new E(404, 'Sunucu bulunamadı.');
  return s;
};
const serverRoles = (serverId, userId) => all(`SELECT r.* FROM server_roles r LEFT JOIN member_roles mr ON mr.role_id=r.id AND mr.server_id=r.server_id AND mr.user_id=? WHERE r.server_id=? AND (r.is_everyone=1 OR mr.role_id IS NOT NULL)`, userId, serverId);
const hasServerAdmin = (serverId, userId) => serverRoles(serverId, userId).some(r => r.permissions & SP.ADMIN);
const serverPerms = (serverId, userId, channelId) => {
  const s = serverOf(serverId, userId);
  const writeAllowlist = get('SELECT user_id FROM server_write_allowlist WHERE server_id=?', serverId);
  const applyWriteAllowlist = bits => !writeAllowlist ? bits : writeAllowlist.user_id === userId ? bits | SP.SEND : bits & ~SP.SEND;
  if (s.owner_id === userId) return applyWriteAllowlist(SP_ALL);
  const roles = serverRoles(serverId, userId), everyone = roles.find(r => r.is_everyone), roleIds = roles.map(r => r.id);
  let bits = roles.reduce((v, r) => v | r.permissions, 0);
  if (roles.some(r => r.permissions & SP.ADMIN)) return applyWriteAllowlist(SP_ALL);
  if (!channelId) return applyWriteAllowlist(bits);
  const channel = get('SELECT id FROM server_channels WHERE id=? AND server_id=?', channelId, serverId);
  if (!channel) throw new E(404, 'Kanal bulunamadı.');
  const overrides = all('SELECT * FROM channel_overwrites WHERE channel_id=?', channelId);
  const apply = rows => {
    const deny = rows.reduce((v, r) => v | r.deny_bits, 0), allow = rows.reduce((v, r) => v | r.allow_bits, 0);
    bits = (bits & ~deny) | allow;
  };
  if (everyone) apply(overrides.filter(o => o.target_type === 'role' && o.target_id === everyone.id));
  apply(overrides.filter(o => o.target_type === 'role' && roleIds.includes(o.target_id) && o.target_id !== everyone?.id));
  apply(overrides.filter(o => o.target_type === 'member' && o.target_id === userId));
  return applyWriteAllowlist(bits);
};
const requirePerm = (serverId, userId, perm, channelId) => {
  if (!(serverPerms(serverId, userId, channelId) & perm)) throw new E(403, 'Bu işlem için sunucu iznin yok.');
};
const serverSummary = s => {
  const tag = get('SELECT tag,badge,enabled FROM server_tags WHERE server_id=?', s.id);
  return { id: s.id, publicId: s.public_id, name: s.name, ownerId: s.owner_id, createdAt: s.created_at, icon: s.icon || null, banner: s.banner || null, verified: !!s.verified,
    serverTag: { tag: tag?.tag || '', badge: tag?.badge || 'crest', enabled: !!tag?.enabled } };
};
const SERVER_TAG_BADGES = new Set(['crest','leaf','swords','heart','flame','drop','skull','bolt','spark','mushroom','bee','gem','trophy','sprout','butterfly','flower','shield','gamepad','🌙','🍃','⚔️','💗','🔥','💧','💀','⚡','✨','🍄','🐝','💎','🏆','🌿','🦋','🌸','🛡️','🎮']);
const serverImage = value => {
  if (value === null) return null;
  if (typeof value !== 'string' || value.length > 350000 || !/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(value)) throw bad('Sunucu görseli geçersiz veya çok büyük.');
  return value;
};
const channelName = n => {
  n = String(n ?? '').trim().toLowerCase().replace(/\s+/g, '-');
  if (!/^[\p{L}\p{N}_-]{1,40}$/u.test(n)) throw bad('Kanal adı 1-40 karakter olmalı.');
  return n;
};
const validBits = v => {
  const n = Number(v);
  if (!Number.isSafeInteger(n) || n < 0 || (n & ~SP_ALL) !== 0) throw bad('Geçersiz izin değeri.');
  return n;
};
const topRole = (serverId, userId) => serverRoles(serverId, userId).reduce((p, r) => r.self_assignable ? p : Math.max(p, r.position), 0);
const canManageRole = (server, actorId, role) => !!role && !role.is_everyone && (server.owner_id === actorId || hasServerAdmin(server.id, actorId) || role.position < topRole(server.id, actorId));
const requireServerBanManager = (server, userId) => {
  if (server.owner_id !== userId && !hasServerAdmin(server.id, userId)) throw new E(403, 'Sunucu üyelerini yönetme yetkin yok.');
};
const roleHasChannelAllows = roleId => !!get("SELECT 1 FROM channel_overwrites WHERE target_type='role' AND target_id=? AND allow_bits!=0 LIMIT 1", roleId);
const toServerMessage = m => ({ id: m.id, channelId: m.channel_id, body: m.body, kind: m.kind || 'text', file: m.file || null, edited: !!m.edited, createdAt: m.created_at, author: pub(get('SELECT * FROM users WHERE id=?', m.sender_id)) });
const pushServer = (serverId, event, value) => all('SELECT user_id FROM server_members WHERE server_id=?', serverId).forEach(({ user_id }) => push(user_id, event, value));
const notifyGuildTagUpdate = (serverIds, affectedUserIds = []) => {
  const members = new Set(affectedUserIds);
  for (const serverId of serverIds) all('SELECT user_id FROM server_members WHERE server_id=?', serverId).forEach(row => members.add(row.user_id));
  const recipients = new Set(members);
  for (const userId of members) friendIds(userId).forEach(friendId => recipients.add(friendId));
  for (const userId of recipients) push(userId, 'friends', { guildTagChanged: true });
  for (const serverId of serverIds) pushServer(serverId, 'server', { serverId, tagUpdated: true });
};
R('GET', '/api/servers', ({ user }) => all('SELECT s.* FROM servers s JOIN server_members m ON m.server_id=s.id WHERE m.user_id=? ORDER BY s.id', user.id).map(serverSummary));
R('GET', '/api/server-search', ({ user, url }) => {
  const query = String(url.searchParams.get('q') || '').trim().slice(0, 80).toLocaleLowerCase('tr');
  if (!query) return [];
  const rows = all(`SELECT s.id AS serverId,s.name AS serverName,c.id AS channelId,c.name AS channelName,c.type AS channelType
    FROM servers s JOIN server_members sm ON sm.server_id=s.id LEFT JOIN server_channels c ON c.server_id=s.id
    WHERE sm.user_id=?`, user.id);
  const results = [], addedServers = new Set();
  const rank = value => value === query ? 0 : value.startsWith(query) ? 1 : 2;
  for (const row of rows) {
    const serverName = String(row.serverName || ''), serverKey = serverName.toLocaleLowerCase('tr');
    if (!addedServers.has(row.serverId) && serverKey.includes(query)) {
      addedServers.add(row.serverId);
      results.push({ kind: 'server', serverId: row.serverId, serverName, rank: rank(serverKey) });
    }
    if (row.channelId && String(row.channelName || '').toLocaleLowerCase('tr').includes(query) && (serverPerms(row.serverId, user.id, row.channelId) & SP.VIEW)) {
      const channelKey = String(row.channelName).toLocaleLowerCase('tr');
      results.push({ kind: 'channel', serverId: row.serverId, serverName, channelId: row.channelId, channelName: row.channelName, channelType: row.channelType, rank: rank(channelKey) });
    }
  }
  results.sort((a, b) => a.rank - b.rank || a.serverName.localeCompare(b.serverName, 'tr') || (a.channelName || '').localeCompare(b.channelName || '', 'tr'));
  return results.slice(0, 30).map(({ rank: _rank, ...result }) => result);
});
R('GET', '/api/server-tags/(\\d+)/preview', ({ user, params: [id] }) => {
  const server = get(`SELECT s.id,s.name,s.icon,s.banner,s.owner_id,s.created_at,t.tag,t.badge
    FROM servers s JOIN server_tags t ON t.server_id=s.id
    WHERE s.id=? AND t.enabled=1 AND t.tag!=''`, Number(id));
  if (!server) throw new E(404, 'Sunucu etiketi bulunamadı.');
  const owner = get('SELECT display_name FROM users WHERE id=?', server.owner_id);
  const members = all('SELECT sm.user_id,u.presence FROM server_members sm JOIN users u ON u.id=sm.user_id WHERE sm.server_id=?', server.id);
  return {
    id: server.id, name: server.name, icon: server.icon || null, banner: server.banner || null,
    owner: owner?.display_name || 'Aven üyesi', createdAt: server.created_at,
    serverTag: { tag: server.tag, badge: server.badge || 'crest' },
    memberCount: members.length,
    onlineCount: members.filter(member => clients.has(member.user_id) && member.presence !== 'invisible').length,
    isMember: !!get('SELECT 1 FROM server_members WHERE server_id=? AND user_id=?', server.id, user.id)
  };
});
R('POST', '/api/servers', ({ user, body }) => {
  const name = cName(body.name);
  const now = Date.now();
  const id = Number(run('INSERT INTO servers(name,owner_id,created_at,public_id) VALUES(?,?,?,?)', name, user.id, now, makePublicServerId()).lastInsertRowid);
  run('INSERT INTO server_members(server_id,user_id,joined_at) VALUES(?,?,?)', id, user.id, now);
  const everyoneId = Number(run('INSERT INTO server_roles(server_id,name,color,position,permissions,is_everyone) VALUES(?,?,?,?,?,1)', id, '@everyone', '#8992a8', 0, SP_DEFAULT).lastInsertRowid);
  run('INSERT INTO server_channels(server_id,name,type,position) VALUES(?,?,?,?)', id, 'genel', 'text', 0);
  run('INSERT INTO server_channels(server_id,name,type,position) VALUES(?,?,?,?)', id, 'sesli', 'voice', 1);
  return { ...serverSummary(get('SELECT * FROM servers WHERE id=?', id)), everyoneRoleId: everyoneId };
});
R('GET', '/api/servers/(\\d+)', ({ user, params: [id] }) => {
  const s = serverOf(+id, user.id), roles = all('SELECT * FROM server_roles WHERE server_id=? ORDER BY position DESC,id', s.id)
    .map(r => ({ id: r.id, name: r.name, color: r.color, position: r.position, permissions: r.permissions, everyone: !!r.is_everyone, displaySeparately: !!r.display_separately, selfAssignable: !!r.self_assignable, selfAssignableEligible: !r.permissions && !roleHasChannelAllows(r.id), selfAssignableChannelSafe: !roleHasChannelAllows(r.id) }));
  const channels = all('SELECT * FROM server_channels WHERE server_id=? ORDER BY position,id', s.id)
    .filter(c => serverPerms(s.id, user.id, c.id) & SP.VIEW)
    .map(c => ({ id: c.id, name: c.name, type: c.type, topic: c.topic, permissions: serverPerms(s.id, user.id, c.id),
      overwrites: all('SELECT target_type AS targetType,target_id AS targetId,allow_bits AS allow,deny_bits AS deny FROM channel_overwrites WHERE channel_id=?', c.id),
      participants: c.type === 'voice' ? [...(voiceRooms.get(c.id)?.entries() || [])].map(([userId, state]) => voiceParticipant(userId, state)).filter(Boolean) : [] }));
  const members = all(`SELECT u.id,u.username,u.display_name,u.avatar,u.presence,sm.joined_at
    FROM server_members sm JOIN users u ON u.id=sm.user_id
    WHERE sm.server_id=? ORDER BY u.display_name`, s.id)
    .map(m => ({ ...pub({ ...m, is_bot: 0 }), joinedAt: m.joined_at, online: clients.has(m.id) && m.presence !== 'invisible', presence: clients.has(m.id) ? m.presence : 'offline',
      roleIds: all(`SELECT id AS role_id FROM server_roles WHERE server_id=? AND is_everyone=1
        UNION SELECT role_id FROM member_roles WHERE server_id=? AND user_id=?`, s.id, s.id, m.id).map(r => r.role_id) }));
  return { ...serverSummary(s), me: { permissions: serverPerms(s.id, user.id), owner: s.owner_id === user.id }, roles, channels, members };
});
R('PATCH', '/api/servers/(\\d+)', ({ user, body, params: [id] }) => {
  const s = serverOf(+id, user.id);
  if (s.owner_id !== user.id) throw new E(403, 'Sunucu ayarlarını yalnızca sunucu sahibi değiştirebilir.');
  const fields = [], values = [];
  if ('name' in body) { fields.push('name=?'); values.push(cName(body.name)); }
  if ('icon' in body) { fields.push('icon=?'); values.push(serverImage(body.icon)); }
  if ('banner' in body) { fields.push('banner=?'); values.push(serverImage(body.banner)); }
  if (!fields.length) throw bad('Kaydedilecek sunucu ayarı bulunamadı.');
  run(`UPDATE servers SET ${fields.join(',')} WHERE id=?`, ...values, s.id); pushServer(s.id, 'server', { serverId: s.id });
  return serverSummary(get('SELECT * FROM servers WHERE id=?', s.id));
});
R('GET', '/api/servers/(\\d+)/bans', ({ user, params: [id] }) => {
  const s = serverOf(+id, user.id);
  requireServerBanManager(s, user.id);
  return all(`SELECT u.id,u.public_id,u.username,u.display_name,u.avatar,b.reason,b.created_at,m.display_name AS moderator_name
    FROM server_bans b JOIN users u ON u.id=b.user_id LEFT JOIN users m ON m.id=b.moderator_id
    WHERE b.server_id=? ORDER BY b.created_at DESC`, s.id).map(row => ({
      id: row.id, publicId: row.public_id, username: row.username, displayName: row.display_name, avatar: row.avatar || null,
      reason: row.reason, createdAt: row.created_at, moderator: row.moderator_name || 'Sunucu yönetimi'
    }));
});
R('POST', '/api/servers/(\\d+)/bans', ({ user, body, params: [id] }) => {
  const s = serverOf(+id, user.id);
  requireServerBanManager(s, user.id);
  const targetId = Number(body.userId), target = Number.isSafeInteger(targetId) && get(`SELECT u.* FROM users u JOIN server_members sm ON sm.user_id=u.id
    WHERE sm.server_id=? AND u.id=? AND u.is_bot=0`, s.id, targetId);
  if (!target) throw new E(404, 'Sunucu üyesi bulunamadı.');
  if (target.id === user.id) throw new E(403, 'Kendini sunucudan yasaklayamazsın.');
  if (target.id === s.owner_id) throw new E(403, 'Sunucu sahibi yasaklanamaz.');
  if (s.owner_id !== user.id && topRole(s.id, target.id) >= topRole(s.id, user.id)) throw new E(403, 'Yalnızca senden daha düşük roldeki üyeleri yasaklayabilirsin.');
  const reason = String(body.reason ?? '').trim();
  if (reason.length < 3 || reason.length > 500) throw bad('Yasaklama nedeni 3-500 karakter olmalı.');

  db.exec('BEGIN IMMEDIATE');
  try {
    run(`INSERT INTO server_bans(server_id,user_id,reason,moderator_id,created_at) VALUES(?,?,?,?,?)
      ON CONFLICT(server_id,user_id) DO UPDATE SET reason=excluded.reason,moderator_id=excluded.moderator_id,created_at=excluded.created_at`, s.id, target.id, reason, user.id, Date.now());
    run('DELETE FROM server_members WHERE server_id=? AND user_id=?', s.id, target.id);
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }

  all('SELECT id FROM server_channels WHERE server_id=? AND type=?', s.id, 'voice').forEach(channel => removeVoiceParticipant(channel.id, target.id));
  const messageBody = `Sunucu: ${s.name}\n${target.display_name} (@${target.username} · ID ${target.public_id}) bu sunucudan yasaklandı.\nSebep: ${reason}`;
  const botId = get('SELECT id FROM users WHERE is_bot=1 ORDER BY id LIMIT 1')?.id;
  const audience = all('SELECT user_id FROM server_members WHERE server_id=?', s.id);
  const textChannels = all(`SELECT id FROM server_channels WHERE server_id=? AND type='text'
    ORDER BY CASE WHEN name='genel' THEN 0 ELSE 1 END,position,id`, s.id);
  const announcementChannel = textChannels.find(channel => audience.every(member => serverPerms(s.id, member.user_id, channel.id) & SP.VIEW)) || textChannels[0];
  if (botId && announcementChannel) {
    const notice = toServerMessage(get(`SELECT * FROM server_messages WHERE id=?`, Number(run(`INSERT INTO server_messages(channel_id,sender_id,body,created_at,kind)
      VALUES(?,?,?,?, 'system')`, announcementChannel.id, botId, messageBody, Date.now()).lastInsertRowid)));
    audience.filter(member => serverPerms(s.id, member.user_id, announcementChannel.id) & SP.VIEW)
      .forEach(member => push(member.user_id, 'server-message', notice));
  }
  notifyGuildTagUpdate([s.id], [target.id]);
  pushServer(s.id, 'server', { serverId: s.id, membersChanged: true, bansChanged: true });
  push(target.id, 'server', { serverId: s.id, banned: true, reason });
  return { ok: true };
});
R('DELETE', '/api/servers/(\\d+)/bans/(\\d+)', ({ user, params: [id, memberId] }) => {
  const s = serverOf(+id, user.id);
  requireServerBanManager(s, user.id);
  const targetId = Number(memberId);
  if (!get('SELECT 1 FROM server_bans WHERE server_id=? AND user_id=?', s.id, targetId)) throw new E(404, 'Yasaklı üye bulunamadı.');
  run('DELETE FROM server_bans WHERE server_id=? AND user_id=?', s.id, targetId);
  pushServer(s.id, 'server', { serverId: s.id, bansChanged: true });
  return { ok: true };
});
R('PATCH', '/api/servers/(\\d+)/tag', ({ user, body, params: [id] }) => {
  const s = serverOf(+id, user.id);
  if (s.owner_id !== user.id) throw new E(403, 'Sunucu etiketini yalnızca sunucu sahibi düzenleyebilir.');
  const tag = String(body.tag ?? '').trim().toUpperCase(), badge = String(body.badge ?? 'crest'), enabled = body.enabled === true;
  if (tag.length > 4 || (enabled && !/^[A-Z0-9]{1,4}$/.test(tag))) throw bad('Sunucu etiketi etkinse 1-4 harf veya rakam içermeli.');
  if (!SERVER_TAG_BADGES.has(badge)) throw bad('Sunucu rozeti geçersiz.');
  run(`INSERT INTO server_tags(server_id,tag,badge,enabled,updated_at) VALUES(?,?,?,?,?)
    ON CONFLICT(server_id) DO UPDATE SET tag=excluded.tag,badge=excluded.badge,enabled=excluded.enabled,updated_at=excluded.updated_at`,
    s.id, tag, badge, enabled ? 1 : 0, Date.now());
  notifyGuildTagUpdate([s.id]);
  return serverSummary(get('SELECT * FROM servers WHERE id=?', s.id));
});
R('DELETE', '/api/servers/(\\d+)', ({ user, params: [id] }) => {
  const s = serverOf(+id, user.id);
  if (s.owner_id !== user.id) throw new E(403, 'Sunucuyu yalnızca sahibi silebilir.');
  all('SELECT id FROM server_channels WHERE server_id=? AND type=?', s.id, 'voice').forEach(c => closeVoiceRoom(c.id));
  pushServer(s.id, 'server', { serverId: s.id, deleted: true }); run('DELETE FROM servers WHERE id=?', s.id); return { ok: true };
});
R('POST', '/api/servers/(\\d+)/leave', ({ user, params: [id] }) => {
  const s = serverOf(+id, user.id);
  if (s.owner_id === user.id) throw new E(400, 'Sunucu sahibi sunucudan ayrılamaz. Önce sunucuyu devret veya sil.');
  all('SELECT id FROM server_channels WHERE server_id=? AND type=?', s.id, 'voice').forEach(channel => removeVoiceParticipant(channel.id, user.id));
  run('DELETE FROM server_members WHERE server_id=? AND user_id=?', s.id, user.id);
  pushServer(s.id, 'server', { serverId: s.id });
  push(user.id, 'server', { serverId: s.id, left: true });
  return { ok: true };
});
R('POST', '/api/servers/(\\d+)/invites', ({ user, params: [id] }) => {
  const s = serverOf(+id, user.id); requirePerm(s.id, user.id, SP.INVITE);
  const code = crypto.randomBytes(9).toString('base64url'), now = Date.now();
  run('INSERT INTO server_invites(code,server_id,creator_id,created_at,expires_at,max_uses) VALUES(?,?,?,?,?,?)', code, s.id, user.id, now, now + 7 * 864e5, 0);
  return { code, expiresAt: now + 7 * 864e5, url: `${(process.env.PUBLIC_URL || 'https://chataven.com.tr').replace(/\/+$/, '')}/${code}` };
});
R('POST', '/api/invites/([A-Za-z0-9_-]+)/join', ({ user, params: [code] }) => {
  const invite = get('SELECT * FROM server_invites WHERE code=?', code);
  if (!invite || (invite.expires_at && invite.expires_at < Date.now()) || (invite.max_uses && invite.uses >= invite.max_uses)) throw new E(404, 'Davet bağlantısı geçersiz veya süresi dolmuş.');
  const ban = get('SELECT reason FROM server_bans WHERE server_id=? AND user_id=?', invite.server_id, user.id);
  if (ban) throw new E(403, `Bu sunucuya katılman engellendi. Yasaklama nedeni: ${ban.reason}`);
  if (get('SELECT 1 FROM server_members WHERE server_id=? AND user_id=?', invite.server_id, user.id)) throw bad('Bu sunucunun zaten üyesisin.');
  run('INSERT INTO server_members(server_id,user_id,joined_at) VALUES(?,?,?)', invite.server_id, user.id, Date.now());
  run('UPDATE server_invites SET uses=uses+1 WHERE code=?', code);
  pushServer(invite.server_id, 'server', { serverId: invite.server_id });
  return serverSummary(get('SELECT * FROM servers WHERE id=?', invite.server_id));
});
R('GET', '/api/invites/([A-Za-z0-9_-]+)', ({ user, params: [code] }) => {
  const invite = get('SELECT * FROM server_invites WHERE code=?', code);
  if (!invite || (invite.expires_at && invite.expires_at < Date.now()) || (invite.max_uses && invite.uses >= invite.max_uses)) throw new E(404, 'Davet bağlantısı geçersiz veya süresi dolmuş.');
  const server = get('SELECT * FROM servers WHERE id=?', invite.server_id);
  const owner = get('SELECT display_name FROM users WHERE id=?', server.owner_id);
  const serverTag = get('SELECT tag,badge FROM server_tags WHERE server_id=? AND enabled=1', server.id);
  const members = all('SELECT sm.user_id,u.presence FROM server_members sm JOIN users u ON u.id=sm.user_id WHERE sm.server_id=?', server.id);
  return {
    code, serverId: server.id, name: server.name, icon: server.icon || null, banner: server.banner || null, verified: !!server.verified, owner: owner.display_name, serverTag: serverTag || null, memberCount: members.length,
    onlineCount: members.filter(member => clients.has(member.user_id) && member.presence !== 'invisible').length,
    createdAt: server.created_at,
    expiresAt: invite.expires_at,
    isMember: !!get('SELECT 1 FROM server_members WHERE server_id=? AND user_id=?', server.id, user.id)
  };
});
R('POST', '/api/servers/(\\d+)/channels', ({ user, body, params: [id] }) => {
  const s = serverOf(+id, user.id); requirePerm(s.id, user.id, SP.MANAGE_CHANNELS);
  const type = body.type;
  if (type !== 'text' && type !== 'voice') throw bad('Kanal türü metin veya ses olmalı.');
  const name = channelName(body.name), topic = String(body.topic ?? '').trim().slice(0, 120);
  const position = get('SELECT COALESCE(MAX(position),-1)+1 AS p FROM server_channels WHERE server_id=?', s.id).p;
  const channelId = Number(run('INSERT INTO server_channels(server_id,name,type,topic,position) VALUES(?,?,?,?,?)', s.id, name, type, topic, position).lastInsertRowid);
  pushServer(s.id, 'server', { serverId: s.id }); return { id: channelId, name, type, topic, permissions: serverPerms(s.id, user.id, channelId) };
});
R('PATCH', '/api/servers/(\\d+)/channels/(\\d+)', ({ user, body, params: [id, channelId] }) => {
  const s = serverOf(+id, user.id); requirePerm(s.id, user.id, SP.MANAGE_CHANNELS);
  const c = get('SELECT * FROM server_channels WHERE id=? AND server_id=?', channelId, s.id);
  if (!c) throw new E(404, 'Kanal bulunamadı.');
  const name = channelName(body.name), topic = String(body.topic ?? '').trim().slice(0, 120);
  run('UPDATE server_channels SET name=?,topic=? WHERE id=?', name, topic, c.id); pushServer(s.id, 'server', { serverId: s.id });
  return { id: c.id, name, topic, type: c.type };
});
R('DELETE', '/api/servers/(\\d+)/channels/(\\d+)', ({ user, params: [id, channelId] }) => {
  const s = serverOf(+id, user.id); requirePerm(s.id, user.id, SP.MANAGE_CHANNELS);
  const c = get('SELECT * FROM server_channels WHERE id=? AND server_id=?', channelId, s.id);
  if (!c) throw new E(404, 'Kanal bulunamadı.');
  if (c.type === 'voice') closeVoiceRoom(c.id);
  run('DELETE FROM server_channels WHERE id=?', c.id); pushServer(s.id, 'server', { serverId: s.id }); return { ok: true };
});
R('PUT', '/api/servers/(\\d+)/channels/(\\d+)/overwrites', ({ user, body, params: [id, channelId] }) => {
  const s = serverOf(+id, user.id); requirePerm(s.id, user.id, SP.MANAGE_CHANNELS);
  const c = get('SELECT * FROM server_channels WHERE id=? AND server_id=?', channelId, s.id);
  if (!c) throw new E(404, 'Kanal bulunamadı.');
  const targetType = body.targetType, targetId = Number(body.targetId);
  if (!['role', 'member'].includes(targetType) || !Number.isSafeInteger(targetId)) throw bad('Geçersiz izin hedefi.');
  const target = targetType === 'role'
    ? get('SELECT id FROM server_roles WHERE id=? AND server_id=?', targetId, s.id)
    : get('SELECT user_id AS id FROM server_members WHERE user_id=? AND server_id=?', targetId, s.id);
  if (!target) throw bad('Rol veya üye bu sunucuda bulunamadı.');
  const allow = validBits(body.allow), deny = validBits(body.deny);
  if (targetType === 'role' && allow && get('SELECT 1 FROM server_roles WHERE id=? AND server_id=? AND self_assignable=1', targetId, s.id)) throw bad('Kendisi seçebilen rollere kanal izni eklenemez.');
  run(`INSERT INTO channel_overwrites(channel_id,target_type,target_id,allow_bits,deny_bits) VALUES(?,?,?,?,?)
    ON CONFLICT(channel_id,target_type,target_id) DO UPDATE SET allow_bits=excluded.allow_bits,deny_bits=excluded.deny_bits`, c.id, targetType, targetId, allow, deny);
  pushServer(s.id, 'server', { serverId: s.id }); return { ok: true };
});
R('DELETE', '/api/servers/(\\d+)/channels/(\\d+)/overwrites/(role|member)/(\\d+)', ({ user, params: [id, channelId, type, targetId] }) => {
  const s = serverOf(+id, user.id); requirePerm(s.id, user.id, SP.MANAGE_CHANNELS);
  run('DELETE FROM channel_overwrites WHERE channel_id=? AND target_type=? AND target_id=? AND channel_id IN (SELECT id FROM server_channels WHERE server_id=?)', channelId, type, targetId, s.id);
  pushServer(s.id, 'server', { serverId: s.id }); return { ok: true };
});
R('POST', '/api/servers/(\\d+)/roles', ({ user, body, params: [id] }) => {
  const s = serverOf(+id, user.id); requirePerm(s.id, user.id, SP.MANAGE_ROLES);
  const name = cName(body.name);
  if (name.length > 24) throw bad('Rol adı en fazla 24 karakter olabilir.');
  const color = /^#[0-9a-f]{6}$/i.test(body.color) ? body.color : '#8992a8';
  let permissions = validBits(body.permissions ?? 0);
  if ((permissions & SP.ADMIN) && s.owner_id !== user.id) throw new E(403, 'Yönetici iznini yalnızca sunucu sahibi verebilir.');
  if (s.owner_id !== user.id) permissions &= ~SP.MANAGE_SERVER;
  const selfAssignable = body.selfAssignable === true;
  if (selfAssignable && permissions !== 0) throw bad('Kendisi seçebilen roller sunucu izni taşıyamaz.');
  const position = Math.max(s.owner_id === user.id ? 1 : 0, topRole(s.id, user.id) - 1);
  const displaySeparately = body.displaySeparately === true;
  const roleId = Number(run('INSERT INTO server_roles(server_id,name,color,position,permissions,display_separately,self_assignable) VALUES(?,?,?,?,?,?,?)', s.id, name, color, position, permissions, displaySeparately ? 1 : 0, selfAssignable ? 1 : 0).lastInsertRowid);
  pushServer(s.id, 'server', { serverId: s.id }); return { id: roleId, name, color, position, permissions, displaySeparately, selfAssignable, selfAssignableEligible: permissions === 0, selfAssignableChannelSafe: true };
});
R('PATCH', '/api/servers/(\\d+)/roles/(\\d+)', ({ user, body, params: [id, roleId] }) => {
  const s = serverOf(+id, user.id); requirePerm(s.id, user.id, SP.MANAGE_ROLES);
  const role = get('SELECT * FROM server_roles WHERE id=? AND server_id=?', roleId, s.id);
  if (!role || (!role.is_everyone && !canManageRole(s, user.id, role))) throw new E(403, 'Bu rolü düzenleyecek yetkin yok.');
  if (role.is_everyone && s.owner_id !== user.id) throw new E(403, 'Herkes rolünü yalnızca sunucu sahibi düzenleyebilir.');
  const name = role.is_everyone ? role.name : cName(body.name);
  if (name.length > 24) throw bad('Rol adı en fazla 24 karakter olabilir.');
  const color = /^#[0-9a-f]{6}$/i.test(body.color) ? body.color : role.color;
  let permissions = validBits(body.permissions);
  if ((permissions & SP.ADMIN) && (role.is_everyone || s.owner_id !== user.id)) throw new E(403, 'Yönetici izni yalnızca özel rollere sunucu sahibi tarafından verilebilir.');
  if (s.owner_id !== user.id) permissions &= ~SP.MANAGE_SERVER;
  const displaySeparately = body.displaySeparately === undefined ? !!role.display_separately : body.displaySeparately === true;
  const selfAssignable = body.selfAssignable === undefined ? !!role.self_assignable : body.selfAssignable === true;
  if (selfAssignable && (permissions !== 0 || roleHasChannelAllows(role.id))) throw bad('Kendisi seçebilen roller sunucu veya kanal izni taşıyamaz.');
  if (role.self_assignable && !selfAssignable && get('SELECT 1 FROM member_roles WHERE server_id=? AND role_id=? LIMIT 1', s.id, role.id)) throw bad('Kendin seçebilen rolü kapatmadan önce üyelerden kaldırın.');
  run('UPDATE server_roles SET name=?,color=?,permissions=?,display_separately=?,self_assignable=? WHERE id=?', name, color, permissions, displaySeparately ? 1 : 0, selfAssignable ? 1 : 0, role.id);
  pushServer(s.id, 'server', { serverId: s.id }); return { id: role.id, name, color, position: role.position, permissions, displaySeparately, selfAssignable, selfAssignableEligible: permissions === 0 && !roleHasChannelAllows(role.id), selfAssignableChannelSafe: !roleHasChannelAllows(role.id) };
});
R('DELETE', '/api/servers/(\\d+)/roles/(\\d+)', ({ user, params: [id, roleId] }) => {
  const s = serverOf(+id, user.id); requirePerm(s.id, user.id, SP.MANAGE_ROLES);
  const role = get('SELECT * FROM server_roles WHERE id=? AND server_id=?', roleId, s.id);
  if (!canManageRole(s, user.id, role)) throw new E(403, 'Bu rolü silemezsin.');
  run('DELETE FROM server_roles WHERE id=?', role.id); pushServer(s.id, 'server', { serverId: s.id }); return { ok: true };
});
R('PUT', '/api/servers/(\\d+)/members/(\\d+)/roles/(\\d+)', ({ user, params: [id, memberId, roleId] }) => {
  const s = serverOf(+id, user.id), targetId = Number(memberId);
  const role = get('SELECT * FROM server_roles WHERE id=? AND server_id=?', roleId, s.id);
  if (!role || role.is_everyone) throw new E(404, 'Rol bulunamadı.');
  if (targetId === user.id) {
    if (s.owner_id !== user.id && (!role.self_assignable || role.permissions !== 0 || roleHasChannelAllows(role.id))) throw new E(403, 'Bu rol kendin tarafından seçilemiyor.');
  } else {
    requirePerm(s.id, user.id, SP.MANAGE_ROLES);
    if (targetId === s.owner_id) throw new E(403, 'Sunucu sahibinin rolünü değiştiremezsin.');
    if (!get('SELECT 1 FROM server_members WHERE server_id=? AND user_id=?', s.id, targetId)) throw new E(404, 'Üye bulunamadı.');
    if (!canManageRole(s, user.id, role) || (s.owner_id !== user.id && !hasServerAdmin(s.id, user.id) && topRole(s.id, targetId) >= topRole(s.id, user.id))) throw new E(403, 'Bu üyeye rol verme yetkin yok.');
  }
  run('INSERT OR IGNORE INTO member_roles(server_id,user_id,role_id) VALUES(?,?,?)', s.id, targetId, role.id);
  pushServer(s.id, 'server', { serverId: s.id }); return { ok: true };
});
R('DELETE', '/api/servers/(\\d+)/members/(\\d+)/roles/(\\d+)', ({ user, params: [id, memberId, roleId] }) => {
  const s = serverOf(+id, user.id), targetId = Number(memberId);
  const role = get('SELECT * FROM server_roles WHERE id=? AND server_id=?', roleId, s.id);
  if (!role || role.is_everyone) throw new E(404, 'Rol bulunamadı.');
  if (targetId === user.id) {
    if (s.owner_id !== user.id && (!role.self_assignable || role.permissions !== 0 || roleHasChannelAllows(role.id))) throw new E(403, 'Bu rolü kendin kaldıramazsın.');
  } else {
    requirePerm(s.id, user.id, SP.MANAGE_ROLES);
    if (targetId === s.owner_id || !get('SELECT 1 FROM server_members WHERE server_id=? AND user_id=?', s.id, targetId) || !canManageRole(s, user.id, role) || (s.owner_id !== user.id && !hasServerAdmin(s.id, user.id) && topRole(s.id, targetId) >= topRole(s.id, user.id))) throw new E(403, 'Bu üyeden rol alma yetkin yok.');
  }
  run('DELETE FROM member_roles WHERE server_id=? AND user_id=? AND role_id=?', s.id, targetId, role.id);
  pushServer(s.id, 'server', { serverId: s.id }); return { ok: true };
});
R('GET', '/api/server-channels/(\\d+)/messages', ({ user, url, params: [channelId] }) => {
  const c = get('SELECT * FROM server_channels WHERE id=?', channelId);
  if (!c) throw new E(404, 'Kanal bulunamadı.');
  requirePerm(c.server_id, user.id, SP.VIEW, c.id);
  const before = +url.searchParams.get('before') || Number.MAX_SAFE_INTEGER;
  return all('SELECT * FROM (SELECT * FROM server_messages WHERE channel_id=? AND id<? ORDER BY id DESC LIMIT 100) ORDER BY id', c.id, before).map(toServerMessage);
});
R('POST', '/api/server-channels/(\\d+)/messages', ({ user, body, params: [channelId] }) => {
  const c = get('SELECT * FROM server_channels WHERE id=?', channelId);
  if (!c || c.type !== 'text') throw new E(404, 'Metin kanalı bulunamadı.');
  requirePerm(c.server_id, user.id, SP.VIEW, c.id); requirePerm(c.server_id, user.id, SP.SEND, c.id);
  const text = String(body.body ?? '').trim();
  if (!text || text.length > 2000) throw bad('Mesaj 1-2000 karakter olmalı.');
  const message = toServerMessage(get('SELECT * FROM server_messages WHERE id=?', Number(run('INSERT INTO server_messages(channel_id,sender_id,body,created_at) VALUES(?,?,?,?)', c.id, user.id, text, Date.now()).lastInsertRowid)));
  pushServer(c.server_id, 'server-message', message); return message;
});
R('POST', '/api/server-channels/(\\d+)/file', async ({ req, user, params: [channelId] }) => {
  const c = get('SELECT * FROM server_channels WHERE id=?', channelId);
  if (!c || c.type !== 'text') throw new E(404, 'Metin kanalı bulunamadı.');
  requirePerm(c.server_id, user.id, SP.VIEW, c.id);
  requirePerm(c.server_id, user.id, SP.SEND, c.id);
  requirePerm(c.server_id, user.id, SP.UPLOAD_FILES, c.id);
  const type = (req.headers['content-type'] || '').split(';')[0], ext = EXT[type];
  if (!['image/png', 'image/jpeg', 'image/gif', 'image/webp'].includes(type)) throw bad('Yalnızca PNG, JPG, GIF veya WEBP fotoğraf yüklenebilir.');
  if (+req.headers['content-length'] > MAXF) throw new E(413, 'Dosya 25 MB sınırını aşıyor.');
  const name = crypto.randomBytes(16).toString('hex') + '.' + ext;
  const plain = path.join(UP, name), temp = `${plain}.${crypto.randomBytes(5).toString('hex')}.part`;
  const encryptedPath = storedMediaPath(name), encryptedTemp = `${encryptedPath}.${crypto.randomBytes(5).toString('hex')}.part`;
  const out = fs.createWriteStream(temp, { flags: 'wx' });
  let n = 0, saved = false;
  try {
    await new Promise((ok, no) => {
      req.on('data', d => { if ((n += d.length) > MAXF) { no(new E(413, 'Dosya 25 MB sınırını aşıyor.')); req.destroy(); } });
      req.on('error', no); out.on('error', no); out.on('finish', ok); req.pipe(out);
    });
    if (!sniffOk(temp, type)) throw bad('Dosya içeriği belirtilen türle uyuşmuyor.');
    const encrypted = await encryptFile(temp, encryptedTemp);
    fs.rmSync(encryptedPath, { force: true }); fs.renameSync(encryptedTemp, encryptedPath); saved = true;
    fs.rmSync(temp, { force: true });
    const id = Number(run('INSERT INTO server_messages(channel_id,sender_id,body,created_at,kind,file,storage_iv,storage_tag) VALUES(?,?,?,?,?,?,?,?)', c.id, user.id, '', Date.now(), 'image', name, encrypted.iv, encrypted.tag).lastInsertRowid);
    const message = toServerMessage(get('SELECT * FROM server_messages WHERE id=?', id));
    pushServer(c.server_id, 'server-message', message); return message;
  } catch (error) {
    out.destroy(); fs.rmSync(temp, { force: true }); fs.rmSync(encryptedTemp, { force: true });
    if (saved && !get('SELECT 1 FROM server_messages WHERE file=?', name)) fs.rmSync(encryptedPath, { force: true });
    throw error;
  }
}, false, true);
R('DELETE', '/api/server-messages/(\\d+)', ({ user, params: [messageId] }) => {
  const m = get('SELECT sm.*,c.server_id FROM server_messages sm JOIN server_channels c ON c.id=sm.channel_id WHERE sm.id=?', messageId);
  if (!m) throw new E(404, 'Mesaj bulunamadı.');
  serverOf(m.server_id, user.id);
  requirePerm(m.server_id, user.id, SP.VIEW, m.channel_id);
  if (m.sender_id !== user.id) requirePerm(m.server_id, user.id, SP.MANAGE_MESSAGES, m.channel_id);
  run('DELETE FROM server_messages WHERE id=?', m.id);
  if (m.file) { fs.rmSync(path.join(UP, path.basename(m.file)), { force: true }); fs.rmSync(storedMediaPath(path.basename(m.file)), { force: true }); }
  pushServer(m.server_id, 'server-message-delete', { id: m.id, channelId: m.channel_id }); return { ok: true };
});
const rtcList = value => String(value || '').split(',').map(item => item.trim()).filter(Boolean);
const TURN_URLS = rtcList(process.env.TURN_URLS || process.env.TURN_URL);
const TURN_SECRET = String(process.env.TURN_SECRET || '');
const TURN_STATIC = !!(process.env.TURN_USERNAME && process.env.TURN_CREDENTIAL);
if (!TURN_URLS.length || (!TURN_SECRET && !TURN_STATIC)) console.warn('UYARI: TURN sunucusu ayarlı değil. Farklı ağlardaki (NAT / mobil) kullanıcılar arasında ses aktarılamayabilir. .env içine TURN_URLS ve TURN_SECRET (veya TURN_USERNAME + TURN_CREDENTIAL) ekleyin.');

// SDP içinde bu kullanıcı ses GÖNDERİYOR mu? (oturum seviyesi yönü ve reddedilmiş m-line'ları da hesaba katar)
const sdpSendsAudio = sdp => {
  const parts = sdp.split(/^m=/m);
  const sessionDir = parts[0].match(/^a=(inactive|recvonly|sendonly|sendrecv)\s*$/m)?.[1] || 'sendrecv';
  return parts.slice(1).some(section => {
    if (!section.startsWith('audio ') || /^audio 0 /.test(section)) return false;
    const dir = section.match(/^a=(inactive|recvonly|sendonly|sendrecv)\s*$/m)?.[1] || sessionDir;
    return dir === 'sendonly' || dir === 'sendrecv';
  });
};
// Sesli kanal ve DM araması için ortak sinyal doğrulama. Boş aday ("aday listesi bitti") hata değil, yok sayılır.
const cleanRtcSignal = body => {
  const d = body.description, cnd = body.candidate;
  if (d && cnd) throw bad('Geçersiz sinyal.');
  if (d) {
    if (!['offer', 'answer'].includes(d.type) || typeof d.sdp !== 'string' || !d.sdp || d.sdp.length > 100000) throw bad('Geçersiz bağlantı açıklaması.');
    return { description: { type: d.type, sdp: d.sdp } };
  }
  if (!cnd || typeof cnd.candidate !== 'string' || !cnd.candidate) return null;
  if (cnd.candidate.length > 4096 ||
    (cnd.sdpMid != null && (typeof cnd.sdpMid !== 'string' || cnd.sdpMid.length > 256)) ||
    (cnd.sdpMLineIndex != null && (!Number.isSafeInteger(cnd.sdpMLineIndex) || cnd.sdpMLineIndex < 0)) ||
    (cnd.usernameFragment != null && (typeof cnd.usernameFragment !== 'string' || cnd.usernameFragment.length > 256))) throw bad('Geçersiz ağ adayı.');
  return { candidate: { candidate: cnd.candidate, sdpMid: cnd.sdpMid ?? null, sdpMLineIndex: cnd.sdpMLineIndex ?? null, usernameFragment: cnd.usernameFragment ?? null } };
};

R('GET', '/api/rtc-config', ({ user }) => {
  const iceServers = rtcList(process.env.STUN_SERVERS || 'stun:stun.l.google.com:19302,stun:stun.cloudflare.com:3478,stun:stun1.l.google.com:19302').map(urls => ({ urls }));
  if (TURN_URLS.length) {
    if (TURN_SECRET) { // coturn "use-auth-secret": 6 saat geçerli, kullanıcıya özel geçici kimlik bilgisi
      const username = `${Math.floor(Date.now() / 1000) + 6 * 3600}:${user.id}`;
      iceServers.push({ urls: TURN_URLS, username, credential: crypto.createHmac('sha1', TURN_SECRET).update(username).digest('base64') });
    } else if (TURN_STATIC) iceServers.push({ urls: TURN_URLS, username: process.env.TURN_USERNAME, credential: process.env.TURN_CREDENTIAL });
  }
  return { iceServers };
});
R('GET', '/api/server-channels/(\\d+)/voice-members', ({ user, params: [channelId] }) => {
  const c = get('SELECT * FROM server_channels WHERE id=?', channelId);
  if (!c || c.type !== 'voice') throw new E(404, 'Ses kanalı bulunamadı.');
  requirePerm(c.server_id, user.id, SP.VIEW, c.id);
  return [...(voiceRooms.get(c.id)?.entries() || [])].map(([userId, state]) => voiceParticipant(userId, state)).filter(Boolean);
});
const normalizeWatchTogetherLink = raw => {
  let url;
  try { url = new URL(String(raw ?? '').trim()); } catch { throw bad('Geçerli bir YouTube veya herkese açık Instagram bağlantısı gir.'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.port) throw bad('Bağlantı biçimi desteklenmiyor.');
  const host = url.hostname.toLowerCase();
  if (['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtu.be'].includes(host)) {
    let videoId = host === 'youtu.be' ? url.pathname.split('/').filter(Boolean)[0] : url.searchParams.get('v');
    if (!videoId) videoId = url.pathname.match(/^\/(?:embed|shorts|live)\/([\w-]{11})(?:\/|$)/)?.[1];
    if (!/^[\w-]{11}$/.test(videoId || '')) throw bad('YouTube video bağlantısı tanınamadı.');
    return { platform: 'youtube', videoId, url: `https://www.youtube.com/watch?v=${videoId}` };
  }
  if (['instagram.com', 'www.instagram.com', 'm.instagram.com'].includes(host)) {
    const match = url.pathname.match(/^\/(p|reel|reels|tv)\/([A-Za-z0-9_-]{5,128})\/?$/);
    if (!match) throw bad('Instagram için herkese açık bir gönderi veya Reels bağlantısı gir.');
    const kind = match[1] === 'reels' ? 'reel' : match[1];
    return { platform: 'instagram', videoId: match[2], url: `https://www.instagram.com/${kind}/${match[2]}/` };
  }
  throw bad('Yalnızca YouTube videoları ve herkese açık Instagram gönderileri destekleniyor.');
};
R('POST', '/api/server-channels/(\\d+)/voice-join', ({ user, params: [channelId] }) => {
  const c = get('SELECT * FROM server_channels WHERE id=?', channelId);
  if (!c || c.type !== 'voice') throw new E(404, 'Ses kanalı bulunamadı.');
  requirePerm(c.server_id, user.id, SP.VIEW, c.id); requirePerm(c.server_id, user.id, SP.CONNECT, c.id);
    // Kullanıcı başka bir ses kanalında kaldıysa oradan çıkar; eski bağlantılar sesi karıştırmasın
  voiceRooms.forEach((other, otherId) => { if (otherId !== c.id && other.has(user.id)) removeVoiceParticipant(otherId, user.id); });
  const room = voiceRoom(c.id);
    // Yeniden katılımda (sayfa yenileme / kopma) diğerlerindeki eski RTCPeerConnection temizlensin
  if (room.has(user.id)) room.forEach((_, id) => { if (id !== user.id) push(id, 'voice-leave', { channelId: c.id, userId: user.id, rejoin: true }); });
  const state = { lastSeen: Date.now(), speaking: false, streaming: false, streamingStreamId: null }, participant = voiceParticipant(user.id, state);
  room.set(user.id, state);
  const peers = [...room.entries()].filter(([id]) => id !== user.id).map(([id, peerState]) => voiceParticipant(id, peerState)).filter(Boolean);
  peers.forEach(peer => push(peer.id, 'voice-join', { channelId: c.id, participant }));
  let watchTogether = watchTogetherSessions.get(c.id) || null;
  if (watchTogether && (!watchTogether.hostId || !room.has(watchTogether.hostId))) {
    const now = Date.now();
    const position = Number(watchTogether.position || 0) + (watchTogether.state === 'playing' ? Math.max(0, now - Number(watchTogether.updatedAt || now)) / 1000 : 0);
    watchTogether = { ...watchTogether, hostId: user.id, hostName: user.display_name, position, updatedAt: now, action: 'host-change', actorId: user.id };
    watchTogetherSessions.set(c.id, watchTogether);
    broadcastVoice(room, 'watch-together', watchTogether);
  }
  return { channelId: c.id, canSpeak: !!(serverPerms(c.server_id, user.id, c.id) & SP.SPEAK), peers, watchTogether };
});
R('POST', '/api/server-channels/(\\d+)/watch-together', ({ user, body, params: [channelId] }) => {
  const c = get('SELECT * FROM server_channels WHERE id=?', channelId);
  if (!c || c.type !== 'voice') throw new E(404, 'Ses kanalı bulunamadı.');
  requirePerm(c.server_id, user.id, SP.VIEW, c.id); requirePerm(c.server_id, user.id, SP.CONNECT, c.id);
  const room = voiceRooms.get(c.id), participant = room?.get(user.id);
  if (!participant) throw new E(409, 'Beraber İzle için önce ses kanalına bağlan.');
  participant.lastSeen = Date.now();
  const action = String(body.action || '');
  if (action === 'set') {
    const active = watchTogetherSessions.get(c.id);
    if (active && active.hostId !== user.id && !(serverPerms(c.server_id, user.id, c.id) & SP.MANAGE_MESSAGES)) throw new E(403, 'Etkin Beraber İzle oturumunu yalnızca başlatan kişi veya mesaj yönetme yetkisi olanlar değiştirebilir.');
    const source = normalizeWatchTogetherLink(body.url);
    const session = { channelId: c.id, sessionId: crypto.randomBytes(12).toString('hex'), ...source,
      hostId: user.id, hostName: user.display_name, state: 'paused', position: 0, updatedAt: Date.now() };
    watchTogetherSessions.set(c.id, session);
    broadcastVoice(room, 'watch-together', { ...session, action: 'set', actorId: user.id });
    return session;
  }
  const session = watchTogetherSessions.get(c.id);
  if (!session) throw new E(404, 'Bu kanalda etkin bir Beraber İzle oturumu yok.');
  if (action === 'clear') {
    if (session.hostId !== user.id && !(serverPerms(c.server_id, user.id, c.id) & SP.MANAGE_MESSAGES)) throw new E(403, 'Bu izleme oturumunu yalnızca başlatan kişi veya mesaj yönetme yetkisi olanlar bitirebilir.');
    watchTogetherSessions.delete(c.id);
    broadcastVoice(room, 'watch-together', { channelId: c.id, sessionId: session.sessionId, cleared: true, actorId: user.id });
    return { ok: true };
  }
  if (!['play', 'pause', 'sync'].includes(action)) throw bad('Geçersiz Beraber İzle işlemi.');
  if (session.hostId !== user.id) throw new E(403, 'Eşzamanlı oynatmayı yalnızca oturumu başlatan kişi yönetebilir.');
  const position = Number(body.position);
  if (!Number.isFinite(position) || position < 0 || position > 86400) throw bad('Geçersiz video konumu.');
  const updated = { ...session, state: action === 'sync' ? session.state : action === 'play' ? 'playing' : 'paused', position, updatedAt: Date.now() };
  watchTogetherSessions.set(c.id, updated);
  broadcastVoice(room, 'watch-together', { ...updated, action, actorId: user.id });
  return updated;
});
R('POST', '/api/server-channels/(\\d+)/voice-heartbeat', ({ user, params: [channelId] }) => {
  const c = get('SELECT * FROM server_channels WHERE id=?', channelId);
  if (!c || c.type !== 'voice') throw new E(404, 'Ses kanalı bulunamadı.');
  requirePerm(c.server_id, user.id, SP.VIEW, c.id); requirePerm(c.server_id, user.id, SP.CONNECT, c.id);
  const participant = voiceRooms.get(c.id)?.get(user.id);
  if (!participant) throw new E(409, 'Ses kanalına yeniden bağlanman gerekiyor.');
  participant.lastSeen = Date.now();
  return { ok: true };
});
R('POST', '/api/server-channels/(\\d+)/voice-state', ({ user, body, params: [channelId] }) => {
  const c = get('SELECT * FROM server_channels WHERE id=?', channelId);
  if (!c || c.type !== 'voice') throw new E(404, 'Ses kanalı bulunamadı.');
  requirePerm(c.server_id, user.id, SP.VIEW, c.id); requirePerm(c.server_id, user.id, SP.CONNECT, c.id);
  if (typeof body.speaking !== 'boolean' || typeof body.streaming !== 'boolean' ||
      (body.streamId !== null && (typeof body.streamId !== 'string' || body.streamId.length > 128)) ||
      (body.streaming && typeof body.streamId !== 'string')) throw bad('Geçersiz ses durumu.');
  if (body.speaking && !(serverPerms(c.server_id, user.id, c.id) & SP.SPEAK)) throw new E(403, 'Bu kanalda konuşma iznin yok.');
  const room = voiceRooms.get(c.id), participant = room?.get(user.id);
  if (!participant) throw new E(409, 'Ses kanalına yeniden bağlanman gerekiyor.');
  participant.lastSeen = Date.now();
  participant.speaking = body.speaking; participant.streaming = body.streaming; participant.streamingStreamId = body.streaming ? body.streamId : null;
  broadcastVoice(room, 'voice-state', { channelId: c.id, userId: user.id, speaking: participant.speaking, streaming: participant.streaming, streamId: participant.streamingStreamId });
  return { ok: true };
});
R('POST', '/api/server-channels/(\\d+)/voice-leave', ({ user, params: [channelId] }) => {
  const c = get('SELECT * FROM server_channels WHERE id=?', channelId);
  if (!c || c.type !== 'voice') throw new E(404, 'Ses kanalı bulunamadı.');
  removeVoiceParticipant(c.id, user.id);
  return { ok: true };
});
R
('POST', '/api/server-channels/(\\d+)/voice-signal', ({ user, body, params: [channelId] }) => {
  const c = get('SELECT * FROM server_channels WHERE id=?', channelId);
  if (!c || c.type !== 'voice') throw new E(404, 'Ses kanalı bulunamadı.');
  requirePerm(c.server_id, user.id, SP.VIEW, c.id); requirePerm(c.server_id, user.id, SP.CONNECT, c.id);
  const room = voiceRooms.get(c.id), targetId = Number(body.targetId);
  if (!room?.has(user.id) || !Number.isSafeInteger(targetId) || !room.has(targetId) || targetId === user.id) throw new E(403, 'Ses bağlantısı için katılımcı bulunamadı.');
  const signal = cleanRtcSignal(body);
  if (!signal) return { ok: true };
  if (signal.description && sdpSendsAudio(signal.description.sdp)) requirePerm(c.server_id, user.id, SP.SPEAK, c.id);
  const sender = room.get(user.id);
  if (sender) sender.lastSeen = Date.now(); // karşı tarafın lastSeen'ini yenilemiyoruz: kopmuş biri başkalarının sinyaliyle hayatta tutulmasın
  push(targetId, 'voice-signal', { channelId: c.id, fromId: user.id, signal });
  return { ok: true };
});
R('POST', '/api/dm-calls', ({ user, body }) => {
  const targetId = Number(body.targetId), target = Number.isSafeInteger(targetId) && get('SELECT * FROM users WHERE id=? AND is_bot=0', targetId);
  if (!target || target.id === user.id || isBlocked(user.id, target.id) || isBlocked(target.id, user.id)) throw new E(404, 'Aranacak kullanıcı bulunamadı.');
  if (!areFriends(user.id, target.id)) throw new E(403, 'DM araması yalnızca arkadaşlarınla yapılabilir.');
  if (!clients.get(target.id)?.size) throw new E(409, 'Bu kullanıcı şu anda çevrim dışı.');
  if (dmCallUsers.has(user.id) || dmCallUsers.has(target.id)) throw new E(409, 'Kullanıcılardan biri başka bir aramada.');
  const id = crypto.randomBytes(16).toString('hex'), now = Date.now();
  const call = { id, callerId: user.id, recipientId: target.id, state: 'ringing', createdAt: now, lastSeen: new Map([[user.id, now], [target.id, now]]), participants: new Map([[user.id, { speaking: false, streaming: false }], [target.id, { speaking: false, streaming: false }]]) };
  dmCalls.set(id, call); dmCallUsers.set(user.id, id); dmCallUsers.set(target.id, id);
  push(target.id, 'dm-call-incoming', { callId: id, from: pub(user) });
  return { callId: id, peer: pub(target) };
});
R('POST', '/api/dm-calls/([a-f0-9]{32})/accept', ({ user, params: [id] }) => {
  const call = dmCalls.get(id);
  if (!call || call.recipientId !== user.id || call.state !== 'ringing') throw new E(404, 'Gelen arama artık geçerli değil.');
  call.state = 'active'; call.acceptedAt = Date.now(); call.lastSeen.set(user.id, call.acceptedAt);
  const peer = get('SELECT * FROM users WHERE id=?', call.callerId);
  addMessage(call.callerId, call.recipientId, JSON.stringify({ type: 'started' }), 'call-event');
  push(call.callerId, 'dm-call-accepted', { callId: id, peer: pub(user) });
  return { ok: true, peer: pub(peer) };
});
R('POST', '/api/dm-calls/([a-f0-9]{32})/reject', ({ user, body, params: [id] }) => {
  const call = dmCalls.get(id);
  if (!call || call.recipientId !== user.id || call.state !== 'ringing') throw new E(404, 'Gelen arama artık geçerli değil.');
  finishDmCall(call, body?.missed ? 'missed' : 'rejected', user.id);
  return { ok: true };
});
R('POST', '/api/dm-calls/([a-f0-9]{32})/end', ({ user, params: [id] }) => {
  const call = dmCalls.get(id);
  if (!call || (call.callerId !== user.id && call.recipientId !== user.id)) throw new E(404, 'Arama bulunamadı.');
  finishDmCall(call, 'ended', user.id);
  return { ok: true };
});
R('POST', '/api/dm-calls/([a-f0-9]{32})/heartbeat', ({ user, params: [id] }) => {
  const call = dmCalls.get(id);
  if (!call || (call.callerId !== user.id && call.recipientId !== user.id)) throw new E(404, 'Arama bağlantısı kapandı.');
  call.lastSeen.set(user.id, Date.now());
  return { ok: true, state: call.state };
});
R('POST', '/api/dm-calls/([a-f0-9]{32})/state', ({ user, body, params: [id] }) => {
  const call = dmCalls.get(id);
  if (!call || call.state !== 'active' || (call.callerId !== user.id && call.recipientId !== user.id)) throw new E(404, 'Arama bulunamadı.');
  if (typeof body.speaking !== 'boolean' || typeof body.streaming !== 'boolean' ||
      (body.streamId != null && (typeof body.streamId !== 'string' || body.streamId.length > 128)) ||
      (body.streaming && typeof body.streamId !== 'string')) throw bad('Geçersiz arama durumu.');
  const participant = call.participants.get(user.id);
  if (!participant) throw new E(404, 'Arama katılımcısı bulunamadı.');
  participant.speaking = body.speaking; participant.streaming = body.streaming; participant.streamId = body.streaming ? body.streamId : null;
  call.lastSeen.set(user.id, Date.now());
  const peerId = user.id === call.callerId ? call.recipientId : call.callerId;
  push(peerId, 'dm-call-state', { callId: id, userId: user.id, speaking: participant.speaking, streaming: participant.streaming, streamId: participant.streamId });
  return { ok: true };
});
R('POST', '/api/dm-calls/([a-f0-9]{32})/signal', ({ user, body, params: [id] }) => {
  const call = dmCalls.get(id);
  if (!call || call.state !== 'active' || (call.callerId !== user.id && call.recipientId !== user.id)) throw new E(404, 'Arama bağlantısı kapandı.');
  const signal = cleanRtcSignal(body);
  if (!signal) return { ok: true };
  const peerId = user.id === call.callerId ? call.recipientId : call.callerId;
  call.lastSeen.set(user.id, Date.now());
  push(peerId, 'dm-call-signal', { callId: id, fromId: user.id, signal });
  return { ok: true };
});
R('DELETE', '/api/blocks/(\\d+)', ({ user, params: [id] }) => { run('DELETE FROM blocks WHERE blocker=? AND blocked=?', user.id, id); push(user.id, 'blocks', {}); return { ok: true }; });
R('PUT', '/api/users/me/server-tag', ({ user, body }) => {
  const previous = get('SELECT server_id FROM user_server_tags WHERE user_id=?', user.id)?.server_id || null;
  const rawServerId = body.serverId;
  if (rawServerId === null || rawServerId === undefined || rawServerId === '') run('DELETE FROM user_server_tags WHERE user_id=?', user.id);
  else {
    const serverId = Number(rawServerId);
    if (!Number.isSafeInteger(serverId) || serverId < 1) throw bad('Sunucu seçimi geçersiz.');
    const server = serverOf(serverId, user.id), config = get('SELECT tag,enabled FROM server_tags WHERE server_id=?', server.id);
    if (!config?.enabled || !config.tag) throw bad('Bu sunucuda kullanılabilir bir etiket yok.');
    run('INSERT INTO user_server_tags(user_id,server_id) VALUES(?,?) ON CONFLICT(user_id) DO UPDATE SET server_id=excluded.server_id', user.id, server.id);
  }
  notifyGuildTagUpdate([...new Set([previous, rawServerId ? Number(rawServerId) : null].filter(Boolean))], [user.id]);
  return { guildTag: activeServerTag(user.id) };
});
R('GET', '/api/users/(\\d+)', ({ user, params: [id] }) => {
  const t = get('SELECT * FROM users WHERE id=?', id);
  if (!t || (t.id !== user.id && isBlocked(user.id, t.id) && !hasDmHistory(user.id, t.id))) throw new E(404, 'Kullanıcı bulunamadı.');
  const online = !!t.is_bot || (clients.has(t.id) && t.presence !== 'invisible');
  const blocked = user.id !== t.id && isBlocked(user.id, t.id), isFriend = areFriends(user.id, t.id), policy = t.message_policy || 'friends';
  const canContinueConversation = user.id !== t.id && !blocked && policy !== 'nobody' && (isFriend || hasAcceptedDmRequest(user.id, t.id));
  const hasMutualInfo = user.id !== t.id && !blocked && !t.is_bot;
  const myFriends = hasMutualInfo ? new Set(all("SELECT CASE WHEN requester=? THEN addressee ELSE requester END AS id FROM friendships WHERE status='accepted' AND (requester=? OR addressee=?)", user.id, user.id, user.id).map(row => row.id)) : new Set();
  const mutualFriends = !hasMutualInfo ? [] : all("SELECT CASE WHEN requester=? THEN addressee ELSE requester END AS id FROM friendships WHERE status='accepted' AND (requester=? OR addressee=?)", t.id, t.id, t.id)
    .map(row => row.id).filter(friendId => friendId !== BOT && myFriends.has(friendId)).slice(0, 8).map(friendId => pub(get('SELECT * FROM users WHERE id=?', friendId)));
  const mutualServers = !hasMutualInfo ? [] : all(`SELECT s.id,s.name,s.icon FROM server_members mine JOIN server_members theirs ON theirs.server_id=mine.server_id
    JOIN servers s ON s.id=mine.server_id WHERE mine.user_id=? AND theirs.user_id=? ORDER BY s.name LIMIT 8`, user.id, t.id);
  return { ...pub(t), ...personalFor(user.id, t.id), banner: t.banner, bio: t.bio, createdAt: t.created_at, presence: online ? (t.presence || 'online') : 'offline', online, friendCount: get("SELECT COUNT(*) c FROM friendships WHERE status='accepted' AND (requester=? OR addressee=?) AND requester!=? AND addressee!=?", t.id, t.id, BOT, BOT).c, mutualFriends, mutualServers, isFriend, blocked, canContinueConversation, canMessage: user.id !== t.id && !blocked && (canContinueConversation || policy === 'everyone'), messagePolicy: policy };
});
R('GET', '/api/users/(\\d+)/personalization', ({ user, params: [id] }) => {
  const targetId = Number(id);
  if (!Number.isSafeInteger(targetId) || targetId === user.id || !get('SELECT id FROM users WHERE id=?', targetId) || !canReadDm(user.id, targetId)) throw new E(404, 'Kullanıcı bulunamadı.');
  return personalFor(user.id, targetId);
});
R('PUT', '/api/users/(\\d+)/personalization', ({ user, params: [id], body }) => {
  const targetId = Number(id);
  if (!Number.isSafeInteger(targetId) || targetId === user.id || !get('SELECT id FROM users WHERE id=?', targetId) || !canReadDm(user.id, targetId)) throw new E(404, 'Kullanıcı bulunamadı.');
  const note = String(body.note ?? '').trim(), nickname = String(body.nickname ?? '').trim();
  if (note.length > 500) throw bad('Not en fazla 500 karakter olabilir.');
  if (nickname.length > 32) throw bad('Takma ad en fazla 32 karakter olabilir.');
  if (!note && !nickname) run('DELETE FROM user_personalizations WHERE user_id=? AND target_id=?', user.id, targetId);
  else run(`INSERT INTO user_personalizations(user_id,target_id,note,nickname,updated_at) VALUES(?,?,?,?,?)
    ON CONFLICT(user_id,target_id) DO UPDATE SET note=excluded.note,nickname=excluded.nickname,updated_at=excluded.updated_at`, user.id, targetId, note, nickname, Date.now());
  push(user.id, 'friends', { personalizationChanged: true, userId: targetId });
  return personalFor(user.id, targetId);
});
R('GET', '/api/friends', ({ user }) => listFor(user.id));
R('GET', '/api/notifications', ({ user }) => all(`SELECT n.id,n.type,n.entity_id AS entityId,n.created_at AS createdAt,n.read_at AS readAt,
  u.id AS actorId,u.username AS actorUsername,u.display_name AS actorDisplayName,u.avatar AS actorAvatar,
  a.translations AS announcementTranslations,a.source_locale AS announcementSourceLocale
  FROM notifications n LEFT JOIN users u ON u.id=n.actor_id
  LEFT JOIN announcements a ON n.type='announcement' AND a.id=n.entity_id
  WHERE n.user_id=? ORDER BY n.created_at DESC LIMIT 100`, user.id)
  .map(n => {
    let announcement = null;
    if (n.type === 'announcement' && n.announcementTranslations) {
      try {
        const translations = JSON.parse(n.announcementTranslations);
        const locale = ANNOUNCEMENT_LOCALES.includes(user.language) ? user.language : 'tr';
        const content = translations[locale] || translations[n.announcementSourceLocale] || translations.tr;
        if (content) announcement = { id: n.entityId, locale, title: content.title, body: content.body, links: content.links || [], createdAt: n.createdAt };
      } catch {}
    }
    return { id: n.id, type: n.type, entityId: n.entityId, createdAt: n.createdAt, readAt: n.readAt,
      actor: n.actorId ? { id: n.actorId, username: n.actorUsername, displayName: n.actorDisplayName, avatar: n.actorAvatar } : null,
      ...(announcement ? { announcement } : {}) };
  }));
R('POST', '/api/notifications/(\\d+)/read', ({ user, params: [id] }) => {
  const n = get('SELECT * FROM notifications WHERE id=? AND user_id=?', id, user.id);
  if (!n) throw new E(404, 'Bildirim bulunamadı.');
  run('UPDATE notifications SET read_at=COALESCE(read_at,?) WHERE id=?', Date.now(), n.id);
  push(user.id, 'notifications', {});
  return { ok: true };
});
R('POST', '/api/notifications/read-all', ({ user }) => { run('UPDATE notifications SET read_at=COALESCE(read_at,?) WHERE user_id=?', Date.now(), user.id); push(user.id, 'notifications', {}); return { ok: true }; });

R('POST', '/api/friends/request', ({ user, body }) => {
  const t = get('SELECT * FROM users WHERE username=?', String(body.username ?? '').trim().replace(/^@/, '').toLowerCase());
  if (!t) throw new E(404, 'Kullanıcı bulunamadı.');
  if (t.id === user.id) throw bad('Kendinize istek gönderemezsiniz.');
  if (get('SELECT 1 FROM blocks WHERE blocker=? AND blocked=?', user.id, t.id)) throw bad('Bu kullanıcıyı engelledin. Ayarlar > Engellenenler bölümünden kaldırabilirsin.');
  if (get('SELECT 1 FROM blocks WHERE blocker=? AND blocked=?', t.id, user.id)) throw new E(404, 'Kullanıcı bulunamadı.');
  if (t.is_bot) throw bad('Resmi hesaba istek gönderilemez.');
  const r = rel(user.id, t.id);
  if (r?.status === 'accepted') throw bad('Zaten arkadaşsınız.');
  if (r && r.requester === user.id) throw bad('İstek zaten gönderildi.');
  if (r) {
    run("UPDATE friendships SET status='accepted' WHERE id=?", r.id);
    run("UPDATE notifications SET read_at=COALESCE(read_at,?) WHERE type='friend-request' AND entity_id=?", Date.now(), r.id);
    notify(user.id, 'friend-accepted', t.id, r.id); notify(t.id, 'friend-accepted', user.id, r.id);
  } else {
    const requestId = Number(run('INSERT INTO friendships(requester,addressee,created_at) VALUES(?,?,?)', user.id, t.id, Date.now()).lastInsertRowid);
    notify(t.id, 'friend-request', user.id, requestId);
    sendFriendRequestEmail(t, user).catch(er => console.error('Arkadaşlık isteği e-postası gönderilemedi:', er.message));
  }
  push(user.id, 'friends', {}); push(t.id, 'friends', {});
  return { ok: true };
});

R('POST', '/api/friends/(\\d+)/(accept|decline)', ({ user, params: [id, act] }) => {
  const f = get("SELECT * FROM friendships WHERE id=? AND addressee=? AND status='pending'", id, user.id);
  if (!f) throw new E(404, 'İstek bulunamadı.');
  if (act === 'accept') run("UPDATE friendships SET status='accepted' WHERE id=?", f.id); else run('DELETE FROM friendships WHERE id=?', f.id);
  run("UPDATE notifications SET read_at=COALESCE(read_at,?) WHERE user_id=? AND type='friend-request' AND entity_id=?", Date.now(), user.id, f.id);
  if (act === 'accept') notify(f.requester, 'friend-accepted', user.id, f.id);
  else { run("UPDATE notifications SET read_at=COALESCE(read_at,?) WHERE user_id=? AND type='friend-request' AND entity_id=?", Date.now(), f.requester, f.id); notify(f.requester, 'friend-declined', user.id, f.id); }
  push(user.id, 'notifications', {});
  push(user.id, 'friends', {}); push(f.requester, 'friends', {});
  return { ok: true };
});

R('DELETE', '/api/friends/(\\d+)', ({ user, params: [id] }) => {
  const f = get('SELECT * FROM friendships WHERE id=? AND (requester=? OR addressee=?)', id, user.id, user.id);
  if (!f) throw new E(404, 'Kayıt bulunamadı.');
  if (f.requester === BOT || f.addressee === BOT) throw bad('Resmi hesapla arkadaşlık kaldırılamaz.');
  run('DELETE FROM friendships WHERE id=?', f.id);
  run('DELETE FROM dm_requests WHERE (sender=? AND recipient=?) OR (sender=? AND recipient=?)', f.requester, f.addressee, f.addressee, f.requester);
  push(f.requester, 'friends', {}); push(f.addressee, 'friends', {});
  return { ok: true };
});

R('DELETE', '/api/conversations/(\\d+)', ({ user, params: [id] }) => {
  const other = Number(id);
  if (!Number.isSafeInteger(other) || other === user.id || !hasDmHistory(user.id, other)) throw new E(404, 'Sohbet bulunamadı.');
  run('INSERT INTO dm_hides(user_id,other_id,hidden_at) VALUES(?,?,?) ON CONFLICT(user_id,other_id) DO UPDATE SET hidden_at=excluded.hidden_at', user.id, other, Date.now());
  push(user.id, 'friends', {});
  return { ok: true };
});

const toMsg = m => ({ id: m.id, sender: m.sender, receiver: m.receiver, body: m.body, kind: m.kind || 'text', file: m.file || null, fileType: m.file_type || null, encrypted: !!m.file_iv, fileSize: m.file_size || null, fileReady: !!m.file_ready, edited: !!m.edited, createdAt: m.created_at });
const addMessage = (s, o, body, kind = 'text', file = null) => {
  run('DELETE FROM dm_hides WHERE (user_id=? AND other_id=?) OR (user_id=? AND other_id=?)', s, o, o, s);
  const ready = kind === 'image' || kind === 'video' ? 0 : 1;
  const id = Number(run('INSERT INTO messages(sender,receiver,body,created_at,kind,file,file_ready) VALUES(?,?,?,?,?,?,?)', s, o, body, Date.now(), kind, file, ready).lastInsertRowid), m = toMsg(get('SELECT * FROM messages WHERE id=?', id));
  push(s, 'message', m); push(o, 'message', m); return m;
};
R('GET', '/api/messages/(\\d+)', ({ user, url, params: [o] }) => {
  if (!canReadDm(user.id, +o)) throw new E(403, 'Bu sohbet artık kullanılamıyor.');
  const after = +url.searchParams.get('after') || 0;
  return all('SELECT * FROM (SELECT * FROM messages WHERE id>? AND ((sender=? AND receiver=?) OR (sender=? AND receiver=?)) ORDER BY id DESC LIMIT 200) ORDER BY id', after, user.id, o, o, user.id).map(toMsg);
});

R('POST', '/api/messages/(\\d+)', ({ user, body, params: [o] }) => {
  const recipient = get('SELECT * FROM users WHERE id=?', +o);
  if (!recipient || recipient.id === user.id || isBlocked(user.id, recipient.id) || isBlocked(recipient.id, user.id)) throw new E(403, 'Bu kullanıcıya mesaj gönderemezsin.');
  if (recipient.id === BOT) throw bad('Resmi hesaba mesaj gönderilemez.');
  const text = String(body.body ?? '').trim();
  if (!text || text.length > 2000) throw bad('Mesaj 1-2000 karakter olmalı.');
  if (recipient.message_policy === 'nobody') throw new E(403, 'Bu kullanıcı mesaj almayı kapatmış.');
  if (areFriends(user.id, recipient.id) || hasAcceptedDmRequest(user.id, recipient.id)) return addMessage(user.id, recipient.id, text);
  if (hasDmHistory(user.id, recipient.id)) throw new E(403, 'Bu sohbet kapatıldı; mesaj gönderemezsin.');
  if (recipient.message_policy !== 'everyone') throw new E(403, 'Bu kullanıcı yalnızca arkadaşlarından mesaj alıyor.');
  const existing = get('SELECT * FROM dm_requests WHERE sender=? AND recipient=?', user.id, recipient.id);
  if (existing?.status === 'pending') return { request: true, pending: true };
  if (existing) run("UPDATE dm_requests SET body=?,status='pending',created_at=? WHERE id=?", text, Date.now(), existing.id);
  else run("INSERT INTO dm_requests(sender,recipient,body,status,created_at) VALUES(?,?,?,'pending',?)", user.id, recipient.id, text, Date.now());
  const requestId = get('SELECT id FROM dm_requests WHERE sender=? AND recipient=?', user.id, recipient.id).id;
  notify(recipient.id, 'dm-request', user.id, requestId); push(recipient.id, 'dm-requests', {});
  return { request: true, pending: false };
});

R('GET', '/api/message-requests', ({ user }) => all(`SELECT r.id AS request_id,r.body,r.created_at,u.* FROM dm_requests r JOIN users u ON u.id=r.sender
  WHERE r.recipient=? AND r.status='pending' ORDER BY r.created_at DESC`, user.id).map(r => ({ id: r.request_id, body: r.body, createdAt: r.created_at, sender: pub(r) })));
R('POST', '/api/message-requests/(\\d+)/(accept|decline)', ({ user, params: [id, action] }) => {
  const request = get("SELECT * FROM dm_requests WHERE id=? AND recipient=? AND status='pending'", id, user.id);
  if (!request || isBlocked(user.id, request.sender) || isBlocked(request.sender, user.id)) throw new E(404, 'Mesaj isteği bulunamadı.');
  if (action === 'decline') {
    run("UPDATE dm_requests SET status='declined',body='' WHERE id=?", request.id);
    run("UPDATE notifications SET read_at=COALESCE(read_at,?) WHERE user_id=? AND type='dm-request' AND entity_id=?", Date.now(), user.id, request.id);
    notify(request.sender, 'dm-declined', user.id, request.id);
    push(user.id, 'dm-requests', {}); push(user.id, 'notifications', {});
    return { ok: true };
  }
  run("UPDATE dm_requests SET status='accepted' WHERE id=?", request.id);
  run("UPDATE notifications SET read_at=COALESCE(read_at,?) WHERE user_id=? AND type='dm-request' AND entity_id=?", Date.now(), user.id, request.id);
  const message = addMessage(request.sender, request.recipient, request.body);
  push(request.sender, 'dm-requests', {});
  push(user.id, 'dm-requests', {});
  push(user.id, 'notifications', {});
  return { ok: true, message };
});

const welcome = uid => {
  const u = get('SELECT display_name FROM users WHERE id=?', uid);
  run("INSERT OR IGNORE INTO friendships(requester,addressee,status,created_at) VALUES(?,?,'accepted',?)", BOT, uid, Date.now());
  addMessage(BOT, uid, `Aven'e hoş geldin, ${u.display_name}. Ben uygulamanın resmi hesabıyım ve seni kısaca tanıştıracağım.`);
  addMessage(BOT, uid, '', 'tour');
  addMessage(BOT, uid, 'Başlamak için sol üstteki artı düğmesiyle bir arkadaş ekleyebilirsin. İstersen önce Ayarlar bölümünden profil resmini, banner\'ını ve hakkında yazını düzenle. İyi sohbetler.');
};
R('PUT', '/api/messages/(\\d+)', ({ user, body, params: [id] }) => {
  const m = get("SELECT * FROM messages WHERE id=? AND sender=? AND kind='text'", id, user.id);
  if (!m) throw new E(404, 'Mesaj bulunamadı.');
  if (!canDm(user.id, m.receiver)) throw new E(403, 'Bu sohbette mesaj düzenleme kapalı.');
  const t = String(body.body ?? '').trim();
  if (!t || t.length > 2000) throw bad('Mesaj 1-2000 karakter olmalı.');
  if (t !== m.body) run('UPDATE messages SET body=?, edited=1 WHERE id=?', t, m.id);
  const out = toMsg(get('SELECT * FROM messages WHERE id=?', m.id));
  push(m.sender, 'edit', out); push(m.receiver, 'edit', out);
  return out;
});
R('DELETE', '/api/messages/(\\d+)', async ({ user, params: [id] }) => {
  const message = get('SELECT * FROM messages WHERE id=?', id);
  if (!message || message.sender !== user.id) throw new E(404, 'Mesaj bulunamadı.');
  if (message.kind === 'image' || message.kind === 'video') {
    const uploadRequest = dmUploadRequests.get(message.id);
    if (uploadRequest && !uploadRequest.destroyed) uploadRequest.destroy(new Error('DM medya yüklemesi mesaj silindiği için iptal edildi.'));
    const deadline = Date.now() + 5000;
    while (dmUploads.has(message.id) && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 20));
    if (dmUploads.has(message.id)) throw new E(409, 'Dosya yüklemesi henüz durdurulamadı. Tekrar dene.');
    const current = get('SELECT * FROM messages WHERE id=?', message.id);
    if (!current || current.sender !== user.id) throw new E(404, 'Mesaj bulunamadı.');
    purgeDmAttachmentFiles(current.file);
    run('DELETE FROM messages WHERE id=?', current.id);
    push(current.sender, 'message-delete', { id: current.id });
    push(current.receiver, 'message-delete', { id: current.id });
    return { ok: true };
  }
  purgeDmAttachmentFiles(message.file);
  run('DELETE FROM messages WHERE id=?', message.id);
  push(message.sender, 'message-delete', { id: message.id });
  push(message.receiver, 'message-delete', { id: message.id });
  return { ok: true };
});

const dmTypeLimit = type => type?.startsWith('video/') ? 50 * 1024 * 1024 : MAXF;
const streamDmBody = async (req, temp, expectedSize, type, maxSize = expectedSize) => {
  const out = fs.createWriteStream(temp, { flags: 'w' }); let received = 0, failed = false;
  await new Promise((resolve, reject) => {
    const fail = error => { if (failed) return; failed = true; req.unpipe(out); out.destroy(); req.resume(); reject(error); };
    req.on('data', chunk => { received += chunk.length; if (received > maxSize || (expectedSize != null && received > expectedSize)) fail(new E(413, 'Dosya boyutu sınırı aşıyor.')); });
    req.on('aborted', () => fail(new E(400, 'Dosya aktarımı yarıda kaldı.')));
    req.on('error', fail); out.on('error', fail);
    out.on('finish', () => expectedSize != null && received !== expectedSize ? fail(new E(400, 'Dosya eksik yüklendi.')) : !failed && resolve());
    req.pipe(out);
  });
  const handle = await fs.promises.open(temp, 'r+');
  try { await handle.sync(); } finally { await handle.close(); }
  if (type && !sniffOk(temp, type)) throw bad('Dosya içeriği seçilen türle uyuşmuyor.');
  return received;
};
const finishDmUpload = messageId => {
  const ready = toMsg(get('SELECT * FROM messages WHERE id=?', messageId));
  push(ready.sender, 'attachment-ready', ready); push(ready.receiver, 'attachment-ready', ready);
  return ready;
};
R('POST', '/api/messages/(\\d+)/attachment', ({ user, body, params: [o] }) => {
  const recipientId = Number(o), type = String(body.type || ''), id = String(body.id || '').toLowerCase(), size = Number(body.size);
  if (!canDm(user.id, recipientId) || recipientId === BOT) throw new E(403, 'Bu sohbette dosya gönderemezsin.');
  if (!/^[a-f0-9]{32}$/.test(id) || !Number.isSafeInteger(size) || size < 1 || size > dmTypeLimit(type)) throw bad(type.startsWith('video/') ? 'Video 50 MB sınırını aşıyor.' : 'Görsel 25 MB sınırını aşıyor.');
  if (!Object.values(MIME).includes(type)) throw bad('Desteklenmeyen dosya türü (PNG, JPG, GIF, WEBP, MP4, WEBM).');
  const kind = type.startsWith('image/') ? 'image' : 'video';
  if (get('SELECT 1 FROM messages WHERE file=?', id)) throw new E(409, 'Bu ek zaten gönderildi.');
  const message = addMessage(user.id, recipientId, '', kind, id);
  run('UPDATE messages SET file_type=?,file_size=? WHERE id=?', type, size, message.id);
  return toMsg(get('SELECT * FROM messages WHERE id=?', message.id));
});

R('DELETE', '/api/messages/(\\d+)/attachment', async ({ user, params: [id] }) => {
  const m = get("SELECT * FROM messages WHERE id=? AND kind IN ('image','video')", id);
  if (!m || m.sender !== user.id) throw new E(404, 'Yüklenen DM eki bulunamadı.');
  if (m.file_ready) throw new E(409, 'Dosya yüklemesi zaten tamamlanmış.');
  const uploadRequest = dmUploadRequests.get(m.id);
  if (uploadRequest && !uploadRequest.destroyed) uploadRequest.destroy(new Error('DM medya yüklemesi kullanıcı tarafından iptal edildi.'));
  const deadline = Date.now() + 5000;
  while (dmUploads.has(m.id) && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 20));
  if (dmUploads.has(m.id)) throw new E(409, 'Yükleme henüz durdurulamadı. Tekrar dene.');
  const current = get("SELECT * FROM messages WHERE id=? AND kind IN ('image','video')", id);
  if (!current || current.sender !== user.id) throw new E(404, 'Yüklenen DM eki bulunamadı.');
  if (current.file_ready) throw new E(409, 'Dosya yüklemesi zaten tamamlanmış.');
  purgeDmAttachmentFiles(current.file);
  run('DELETE FROM messages WHERE id=?', current.id);
  push(current.sender, 'message-delete', { id: current.id }); push(current.receiver, 'message-delete', { id: current.id });
  return { ok: true };
});

R('POST', '/api/messages/(\\d+)/attachment-data', async ({ req, user, params: [id] }) => {
  const m = get("SELECT * FROM messages WHERE id=? AND kind IN ('image','video')", id);
  const legacy = !!m?.file_iv;
  if (!m || m.sender !== user.id || !/^[a-f0-9]{32}$/.test(m.file || '') || (!legacy && !m.file_type) || !m.file_size) throw new E(404, 'DM eki bulunamadı.');
  if (!canDm(user.id, m.receiver)) throw new E(403, 'Bu sohbete dosya yükleyemezsin.');
  if (m.file_ready) return toMsg(m);
  if (dmUploads.has(m.id)) throw new E(409, 'Bu dosya şu anda yükleniyor.');
  const length = req.headers['content-length'] == null ? null : Number(req.headers['content-length']);
  if (length != null && (!Number.isSafeInteger(length) || length !== m.file_size)) throw bad('Dosya boyutu eşleşmiyor.');
  if (m.file_size > (legacy ? MAXF + 16 : dmTypeLimit(m.file_type))) throw bad('Dosya boyutu sınırı aşıyor.');
  const plainFile = legacy ? null : path.join(UP, `${m.file}.${EXT[m.file_type]}`);
  const finalFile = legacy ? path.join(UP, `${m.file}.enc`) : storedMediaPath(m.file);
  const temp = `${plainFile || finalFile}.${crypto.randomBytes(5).toString('hex')}.part`;
  const encryptedTemp = legacy ? null : `${finalFile}.${crypto.randomBytes(5).toString('hex')}.part`;
  dmUploads.add(m.id);
  dmUploadRequests.set(m.id, req);
  try {
    await streamDmBody(req, temp, m.file_size, legacy ? null : m.file_type);
    if (legacy) {
      fs.rmSync(finalFile, { force: true }); fs.renameSync(temp, finalFile);
      run('UPDATE messages SET file_ready=1,storage_iv=NULL,storage_tag=NULL WHERE id=?', m.id);
    } else {
      const encrypted = await encryptFile(temp, encryptedTemp);
      run('UPDATE messages SET storage_iv=?,storage_tag=? WHERE id=?', encrypted.iv, encrypted.tag, m.id);
      fs.rmSync(finalFile, { force: true }); fs.renameSync(encryptedTemp, finalFile); fs.rmSync(temp, { force: true });
      run('UPDATE messages SET file_ready=1 WHERE id=?', m.id);
    }
    return finishDmUpload(m.id);
  } catch (error) { fs.rmSync(temp, { force: true }); if (encryptedTemp) fs.rmSync(encryptedTemp, { force: true }); throw error; }
  finally { dmUploadRequests.delete(m.id); dmUploads.delete(m.id); }
}, false, true);

// Eski sürümdeki AES-GCM ekleri, ilgili hesaptaki anahtar alındığında ortak dosyaya bir kez taşınır.
R('POST', '/api/messages/(\\d+)/attachment-migrate', async ({ req, user, params: [id] }) => {
  const m = get("SELECT * FROM messages WHERE id=? AND kind IN ('image','video')", id);
  if (!m || !/^[a-f0-9]{32}$/.test(m.file || '') || !m.file_iv || !m.file_ready || ![m.sender, m.receiver].includes(user.id)) throw new E(404, 'Eski DM eki bulunamadı.');
  const other = m.sender === user.id ? m.receiver : m.sender;
  if (!canReadDm(user.id, other)) throw new E(403, 'Bu DM eki taşınamıyor.');
  const type = String(req.headers['x-aven-content-type'] || ''), rawLength = req.headers['content-length'], size = rawLength == null ? null : Number(rawLength);
  if (!Object.values(MIME).includes(type) || (m.kind === 'image') !== type.startsWith('image/') || (size != null && (!Number.isSafeInteger(size) || size < 1 || size > dmTypeLimit(type)))) throw bad('Eski medya bilgisi geçersiz veya dosya sınırını aşıyor.');
  if (dmUploads.has(m.id)) throw new E(409, 'Bu dosya şu anda taşınıyor.');
  const temp = path.join(UP, `${m.file}.${crypto.randomBytes(5).toString('hex')}.plain.part`);
  const encryptedPath = storedMediaPath(m.file), encryptedTemp = `${encryptedPath}.${crypto.randomBytes(5).toString('hex')}.part`;
  const legacyPath = path.join(UP, `${m.file}.enc`);
  dmUploads.add(m.id);
  dmUploadRequests.set(m.id, req);
  try {
    const actualSize = await streamDmBody(req, temp, size, type, dmTypeLimit(type));
    const encrypted = await encryptFile(temp, encryptedTemp);
    fs.rmSync(encryptedPath, { force: true }); fs.renameSync(encryptedTemp, encryptedPath); fs.rmSync(temp, { force: true });
    run('UPDATE messages SET file_type=?,file_size=?,file_iv=NULL,storage_iv=?,storage_tag=? WHERE id=?', type, actualSize, encrypted.iv, encrypted.tag, m.id);
    fs.rmSync(legacyPath, { force: true });
    return finishDmUpload(m.id);
  } catch (error) { fs.rmSync(temp, { force: true }); fs.rmSync(encryptedTemp, { force: true }); throw error; }
  finally { dmUploadRequests.delete(m.id); dmUploads.delete(m.id); }
}, false, true);

R('GET', '/api/dm-attachments/(\\d+)', async ({ req, res, user, params: [id] }) => {
  const m = get("SELECT * FROM messages WHERE id=? AND kind IN ('image','video')", id);
  if (!m || !m.file_ready || !/^[a-f0-9]{32}$/.test(m.file || '') || ![m.sender, m.receiver].includes(user.id)) throw new E(404, 'DM eki bulunamadı.');
  const other = m.sender === user.id ? m.receiver : m.sender;
  if (!canReadDm(user.id, other)) throw new E(403, 'Bu DM eki görüntülenemiyor.');
  const legacy = !!m.file_iv, type = m.file_type;
  if (!legacy && (!type || !Object.values(MIME).includes(type))) throw new E(404, 'DM eki bulunamadı.');
  if (!!m.storage_iv !== !!m.storage_tag) throw new E(500, 'DM eki şifreleme kaydı eksik.');
  const serverEncrypted = !!(m.storage_iv && m.storage_tag);
  const file = path.join(UP, serverEncrypted ? `${m.file}.aenc` : legacy ? `${m.file}.enc` : `${m.file}.${EXT[type]}`);
  let stat; try { stat = fs.statSync(file); } catch { throw new E(404, 'DM eki bulunamadı.'); }
  if (serverEncrypted && stat.size !== m.file_size) throw new E(404, 'DM eki tamamlanmamış.');
  if (!serverEncrypted && stat.size !== m.file_size) throw new E(404, 'DM eki tamamlanmamış.');
  if (legacy) {
    res.writeHead(200, { 'Content-Type': 'application/octet-stream', 'Content-Length': stat.size, 'Cache-Control': 'private, no-store', 'X-Aven-IV': m.file_iv, 'X-Content-Type-Options': 'nosniff' });
    fs.createReadStream(file).pipe(res); return;
  }
  const plain = serverEncrypted ? decryptBuffer(await fs.promises.readFile(file), m.storage_iv, m.storage_tag, m.file_size) : null;
  const size = plain ? plain.length : stat.size;
  let start = 0, end = size - 1, status = 200;
  const range = req.headers.range;
  if (type.startsWith('video/') && range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (!match || (!match[1] && !match[2])) { res.writeHead(416, { 'Content-Range': `bytes */${size}` }); res.end(); return; }
    if (!match[1]) { const suffix = Number(match[2]); start = Math.max(0, size - suffix); }
    else start = Number(match[1]);
    if (match[1] && match[2]) end = Number(match[2]);
    if (start >= size || end < start) { res.writeHead(416, { 'Content-Range': `bytes */${size}` }); res.end(); return; }
    end = Math.min(end, size - 1); status = 206;
  }
  const headers = { 'Content-Type': type, 'Content-Length': end - start + 1, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Disposition': 'inline', 'Accept-Ranges': type.startsWith('video/') ? 'bytes' : 'none' };
  if (status === 206) headers['Content-Range'] = `bytes ${start}-${end}/${size}`;
  res.writeHead(status, headers);
  if (plain) res.end(plain.subarray(start, end + 1)); else fs.createReadStream(file, { start, end }).pipe(res);
});

R('POST', '/api/messages/(\\d+)/attachment-ready', () => {
  throw new E(410, 'Ek durumu yalnızca yükleme tamamlandığında güncellenir.');
});

R('POST', '/api/dm/(\\d+)/attachment-signal', ({ user, body, params: [targetRaw] }) => {
  const targetId = Number(targetRaw), transferId = String(body.transferId || '').toLowerCase(), messageId = Number(body.messageId), signal = body.signal;
  const m = get("SELECT * FROM messages WHERE id=? AND file=? AND kind IN ('image','video')", messageId, transferId);
  if (!m || ![m.sender, m.receiver].includes(user.id) || ![m.sender, m.receiver].includes(targetId) || targetId === user.id || !canDm(user.id, targetId)) throw new E(403, 'Dosya aktarım bağlantısı kurulamadı.');
  if (m.sender !== user.id && m.sender !== targetId) throw new E(403, 'Dosya aktarım tarafı geçersiz.');
  if (!clients.has(targetId)) throw new E(409, 'Dosyayı almak için diğer kişinin çevrimiçi olması gerekiyor.');
  if (!signal || typeof signal !== 'object') throw bad('Geçersiz dosya aktarım sinyali.');
  let clean;
  if (signal.type === 'request') clean = { type: 'request' };
  else if (signal.type === 'description') {
    const d = signal.description;
    if (!d || !['offer', 'answer'].includes(d.type) || typeof d.sdp !== 'string' || !d.sdp || d.sdp.length > 100000) throw bad('Geçersiz dosya bağlantısı.');
    clean = { type: 'description', description: { type: d.type, sdp: d.sdp } };
  } else if (signal.type === 'candidate') {
    const c = signal.candidate;
    if (!c || typeof c.candidate !== 'string' || c.candidate.length > 4096) throw bad('Geçersiz ağ adayı.');
    clean = { type: 'candidate', candidate: { candidate: c.candidate, sdpMid: c.sdpMid ?? null, sdpMLineIndex: c.sdpMLineIndex ?? null, usernameFragment: c.usernameFragment ?? null } };
  } else throw bad('Geçersiz dosya aktarım sinyali.');
  push(targetId, 'dm-signal', { fromId: user.id, transferId, messageId: m.id, signal: clean });
  return { ok: true };
});

R('GET', '/api/files/([a-f0-9]{32}\\.[a-z0-9]+)', async ({ req, res, user, params: [n] }) => {
  const serverFile = get('SELECT sm.channel_id,c.server_id,sm.storage_iv,sm.storage_tag FROM server_messages sm JOIN server_channels c ON c.id=sm.channel_id WHERE sm.file=?', n);
  if (!serverFile) throw new E(404, 'Dosya bulunamadı.');
  requirePerm(serverFile.server_id, user.id, SP.VIEW, serverFile.channel_id);
  if (!!serverFile.storage_iv !== !!serverFile.storage_tag) throw new E(500, 'Dosya şifreleme kaydı eksik.');
  let bytes;
  try {
    if (serverFile.storage_iv && serverFile.storage_tag) {
      const encrypted = await fs.promises.readFile(storedMediaPath(n));
      bytes = decryptBuffer(encrypted, serverFile.storage_iv, serverFile.storage_tag);
    } else bytes = await fs.promises.readFile(path.join(UP, path.basename(n)));
  } catch (error) { if (error.code === 'ENOENT') throw new E(404, 'Dosya bulunamadı.'); throw error; }
  const size = bytes.length, rg = /bytes=(\d*)-(\d*)/.exec(req.headers.range || '');
  let s = 0, e = size - 1;
  if (rg) {
    if (!rg[1] && !rg[2]) { res.writeHead(416, { 'Content-Range': `bytes */${size}` }); return res.end(); }
    s = rg[1] ? +rg[1] : Math.max(0, size - +rg[2]); if (rg[1] && rg[2]) e = Math.min(+rg[2], e);
  }
  if (s >= size || s > e || s < 0) { res.writeHead(416, { 'Content-Range': `bytes */${size}` }); return res.end(); }
  res.writeHead(rg ? 206 : 200, { 'Content-Type': MIME[n.split('.')[1]], 'Content-Length': e - s + 1, 'Accept-Ranges': 'bytes', 'Cache-Control': 'private, no-store', ...(rg && { 'Content-Range': `bytes ${s}-${e}/${size}` }) });
  res.end(bytes.subarray(s, e + 1));
});

R('GET', '/api/events', ({ user, req, res }) => {
  req.socket.setNoDelay(true); req.socket.setTimeout(0);
  res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
  res.flushHeaders();
  res.write(`retry: 2000\n\nevent: ver\ndata: "${BUILD}"\n\n`);
  const first = !clients.has(user.id);
  if (first) clients.set(user.id, new Set());
  clients.get(user.id).add(res);
  if (first) friendIds(user.id).forEach(i => push(i, 'friends', {}));
  req.on('close', () => { const s = clients.get(user.id); if (!s) return; s.delete(res); if (!s.size) { clients.delete(user.id); friendIds(user.id).forEach(i => push(i, 'friends', {})); } });
});

const readBody = req => new Promise((ok, no) => {
  let n = 0; const c = [];
  req.on('data', d => { n += d.length; if (n > 400000) { no(new E(413, 'İstek çok büyük.')); req.destroy(); } else c.push(d); });
  req.on('end', () => { try { ok(c.length ? JSON.parse(Buffer.concat(c)) : {}); } catch { no(bad('Geçersiz istek.')); } });
});
const send = (res, code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(obj)); };
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' };

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline' https://www.youtube.com https://s.ytimg.com https://www.instagram.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://*.cdninstagram.com https://*.fbcdn.net; connect-src 'self' https://www.youtube.com https://www.youtube-nocookie.com https://www.instagram.com; media-src 'self' blob:; frame-src https://www.youtube.com https://www.youtube-nocookie.com https://www.instagram.com; frame-ancestors 'none'");
  if (!url.pathname.startsWith('/api/')) {
    let d; try { d = decodeURIComponent(url.pathname); } catch { d = '\0'; }
    const invitePath = /^\/[A-Za-z0-9_-]{12}$/.test(d);
    const appRoute = /^\/channels(?:\/(?:@me(?:\/(?:\d{8}[A-Za-z]|\d+))?|(?:\d{8}[A-Za-z]|\d+)(?:\/\d+)?))?\/?$/.test(d);
    const alias = d === '/admin.co' ? 'admin.html' : d === '/destek' ? 'support.html' : d === '/itiraz' ? 'appeal.html' : d === '/hakkında' || d === '/hakkinda' ? 'index.html' : null;
    const f = path.join(PUB, alias || (d === '/' || invitePath || appRoute ? 'index.html' : d));
    if (d.includes('\0') || !f.startsWith(PUB + path.sep)) { res.writeHead(400); return res.end(); }
    return fs.readFile(f, (e, data) => {
      if (e) { res.writeHead(404); return res.end('404'); }
      const ext = path.extname(f);
      // Her sunucu başlangıcında değişen ?v= damgası: tarayıcı veya IIS önbelleğindeki eski js/css dosyaları asla kullanılmaz.
      if (ext === '.html') data = Buffer.from(data.toString('utf8').replace(/((?:src|href)=")(\/[^"?]+\.(?:js|css))"/g, `$1$2?v=${BUILD}"`));
      res.writeHead(200, { 'Content-Type': TYPES[ext] || 'application/octet-stream', 'Cache-Control': 'no-store' }); res.end(data);
    });
  }
  try {
    const r = routes.find(([m, re]) => m === req.method && re.test(url.pathname));
    if (!r) throw new E(404, 'Bulunamadı.');
    const user = userFrom(req);
    if (user?.__banned) { const er = new E(403, 'Bu hesabın kullanımı kapatıldı.'); er.banned = true; throw er; }
    const adminRequest = url.pathname.startsWith('/api/admin/');
    const admin = adminRequest && url.pathname !== '/api/admin/login' ? adminFrom(req) : null;
    if (adminRequest && url.pathname !== '/api/admin/login' && !admin) throw new E(401, 'Yönetici oturumu gerekli.');
    if (!adminRequest && !r[3] && !user) throw new E(401, 'Oturum gerekli.');
    const body = !r[4] && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) ? await readBody(req) : {};
    const out = await r[2]({ req, res, user, admin, body, url, params: url.pathname.match(r[1]).slice(1) });
    if (out !== undefined) send(res, 200, out);
  } catch (e) {
    const code = e.c || (/UNIQUE/.test(e.message) ? 409 : 500);
    if (code === 500) console.error(e);
    if (!res.headersSent && !res.destroyed) send(res, code, { error: e.c ? e.message : code === 409 ? 'Bu bilgi zaten kayıtlı.' : 'Sunucu hatası.', ...(e.banned ? { code: 'ACCOUNT_BANNED' } : {}) });
  }
});
server.on('error', er => {
  if (er.code === 'EADDRINUSE') {
    console.error(`Aven başlatılamadı: ${HOST}:${PORT} zaten kullanımda. Başka bir Aven örneği çalışıyor olabilir.`);
    process.exit(98);
  }
  console.error('HTTP sunucusu başlatılamadı:', er);
  process.exit(1);
});
server.listen(PORT, HOST, () => console.log(`Aven çalışıyor: http://${HOST}:${PORT}`));

process.on('uncaughtException', er => { console.error('Beklenmeyen hata (uncaughtException):', er); });
process.on('unhandledRejection', er => { console.error('Yakalanmayan söz reddi (unhandledRejection):', er); });
