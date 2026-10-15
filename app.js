'use strict';
const $ = (s, r = document) => r.querySelector(s), root = $('#root'), sleep = ms => new Promise(r => setTimeout(r, ms));
const inviteUrl = code => new URL('/' + code, location.origin).href;
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const VERIFIED_SERVER_BADGE_URL = '/image/sunucurozet/' + encodeURIComponent('doğrulanmış_sunucu.png');
const verifiedServerBadge = (extraClass = '') => `<span class="verified-server-badge${extraClass ? ` ${extraClass}` : ''}" title="Doğrulanmış Sunucu" role="img" aria-label="Doğrulanmış Sunucu"><img src="${VERIFIED_SERVER_BADGE_URL}" alt="" aria-hidden="true"></span>`;
const av = (u, c = '') => u.avatar ? `<img class="av ${c}" src="${u.avatar}" alt="">` : `<span class="av ${c}">${esc([...u.displayName][0] || '?').toUpperCase()}</span>`;
const AVEN_UI_ICONS = {
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.7 9a2.4 2.4 0 1 1 4.3 1.5c-.8 1-2 1.1-2 2.7M12 16.7h.01"/>',
  inbox: '<rect x="3.5" y="5.5" width="17" height="13" rx="3"/><path d="m5 8 7 5.5L19 8"/>',
  add: '<path d="M12 5v14M5 12h14"/>',
  search: '<circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 4.2 4.2"/>',
  join: '<path d="M7 17 17 7M8 7h9v9"/>',
  settings: '<path d="M10.2 2.7h3.6l.55 2.25a7.5 7.5 0 0 1 1.55.65l2.05-1.05L20.5 7.1l-1.05 2.05c.27.48.49 1 .65 1.55l2.25.55v3.6l-2.25.55a7.5 7.5 0 0 1-.65 1.55l1.05 2.05-2.55 2.55-2.05-1.05a7.5 7.5 0 0 1-1.55.65l-.55 2.25h-3.6l-.55-2.25a7.5 7.5 0 0 1-1.55-.65L6.05 21.6 3.5 19.05l1.05-2.05a7.5 7.5 0 0 1-.65-1.55l-2.25-.55v-3.6l2.25-.55c.16-.55.38-1.07.65-1.55L3.5 7.1l2.55-2.55L8.1 5.6c.48-.27 1-.49 1.55-.65l.55-2.25Z"/><circle cx="12" cy="12" r="3.2"/>',
  copy: '<rect x="8.5" y="8.5" width="11.5" height="12" rx="2"/><path d="M15.5 8.5V5.8a1.8 1.8 0 0 0-1.8-1.8H5.8A1.8 1.8 0 0 0 4 5.8v7.9a1.8 1.8 0 0 0 1.8 1.8h2.7"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
  more: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
  users: '<path d="M16 20v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 18.5V20M10 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM17 4.4a3.5 3.5 0 0 1 0 6.8M20 20v-1.5a3.5 3.5 0 0 0-2.5-3.35"/>',
  attach: '<path d="m8 12.5 6.7-6.7a3 3 0 0 1 4.2 4.2l-8.5 8.5a4.5 4.5 0 0 1-6.4-6.4l8.1-8.1"/>',
  back: '<path d="m14.5 5-7 7 7 7M8 12h12"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  logout: '<path d="M10 17l5-5-5-5M15 12H3"/><path d="M12 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6"/>',
  edit: '<path d="m14 5 5 5M4 20l4.2-.8L19 8.4a2.1 2.1 0 0 0-3-3L5.2 16.2 4 20Z"/>',
  trash: '<path d="M4.5 7h15M9 7V4.5h6V7m2.8 0-.8 13h-10L6.2 7M10 10v6m4-6v6"/>',
  note: '<path d="M5 4.5h14v11l-4.5 4H5zM8 9h8M8 12.5h6"/><path d="M14.5 19.5v-4H19"/>'
};
const uiIcon = name => `<svg class="aven-ui-icon" viewBox="0 0 24 24" aria-hidden="true">${AVEN_UI_ICONS[name] || AVEN_UI_ICONS.info}</svg>`;
function readAppRoute(pathname = location.pathname) {
  const path = pathname.replace(/\/+$/, '') || '/';
  if (path === '/' || path === '/channels/@me') return { kind: 'home' };
  const dm = path.match(/^\/channels\/@me\/(\d{8}[A-Za-z])$/);
  if (dm) return { kind: 'dm', publicId: dm[1].toUpperCase() };
  const legacyDm = path.match(/^\/channels\/@me\/(\d+)$/);
  if (legacyDm && Number.isSafeInteger(Number(legacyDm[1])) && Number(legacyDm[1]) > 0) return { kind: 'dm', userId: Number(legacyDm[1]) };
  const server = path.match(/^\/channels\/((?:\d{8}[A-Za-z])|\d+)(?:\/(\d+))?$/);
  if (server && /^[0-9]{8}[A-Z]$/i.test(server[1])) {
    const channelId = server[2] && Number.isSafeInteger(Number(server[2])) && Number(server[2]) > 0 ? Number(server[2]) : null;
    return { kind: 'server', publicId: server[1].toUpperCase(), channelId };
  }
  if (server && Number.isSafeInteger(Number(server[1])) && Number(server[1]) > 0) {
    const channelId = server[2] && Number.isSafeInteger(Number(server[2])) && Number(server[2]) > 0 ? Number(server[2]) : null;
    return { kind: 'server', serverId: Number(server[1]), channelId };
  }
  return null;
}
function appRoutePath(route) {
  if (route.kind === 'server') {
    const serverId = /^[0-9]{8}[A-Z]$/i.test(String(route.publicId || '')) ? String(route.publicId).toUpperCase() : Number(route.serverId);
    return `/channels/${serverId}${Number(route.channelId) ? `/${Number(route.channelId)}` : ''}`;
  }
  return route.kind === 'dm' && /^[0-9]{8}[A-Z]$/i.test(String(route.publicId || '')) ? `/channels/@me/${String(route.publicId).toUpperCase()}`
    : route.kind === 'dm' && Number(route.userId) ? `/channels/@me/${Number(route.userId)}` : '/channels/@me';
}
function writeAppRoute(route, mode = 'push') {
  if (!route || mode === 'none') return;
  const path = appRoutePath(route);
  if (location.pathname === path && !location.search && !location.hash) return;
  history[mode === 'replace' ? 'replaceState' : 'pushState']({ avenRoute: true }, '', path);
}
function authTargetAppRoute() {
  const route = readAppRoute() || { kind: 'home' };
  const mode = location.pathname === appRoutePath(route) && !location.search && !location.hash ? 'none' : 'replace';
  return { route, mode };
}
const SERVER_TAG_BADGE_ALIASES = {
  '🌙': 'crest', '🍃': 'leaf', '⚔️': 'swords', '💗': 'heart', '🔥': 'flame', '💧': 'drop', '💀': 'skull', '⚡': 'bolt',
  '✨': 'spark', '🍄': 'mushroom', '🐝': 'bee', '💎': 'gem', '🏆': 'trophy', '🌿': 'sprout', '🦋': 'butterfly', '🌸': 'flower', '🛡️': 'shield', '🎮': 'gamepad'
};
const SERVER_TAG_BADGE_STORAGE = Object.fromEntries(Object.entries(SERVER_TAG_BADGE_ALIASES).map(([legacy, icon]) => [icon, legacy]));
const SERVER_TAG_BADGE_SHAPES = {
  crest: '<path d="M12 3 21 19H3z"/><path d="m8.5 15 3.5-7 3.5 7M10 12h4"/>',
  leaf: '<path d="M19.5 4.5C11 4 5 7.3 5 13a5 5 0 0 0 5 5c5.7 0 9-6 9.5-13.5Z"/><path d="M4 20c2.5-4 6-6.5 11-9"/>',
  swords: '<path d="m5 4 14 16M19 4 5 20M4 4l4 1-3 3-1-4ZM20 4l-4 1 3 3 1-4ZM4 20l4-1-3-3-1 4ZM20 20l-4-1 3-3 1 4Z"/>',
  heart: '<path d="M20.5 8.8c0 4.6-8.5 10-8.5 10s-8.5-5.4-8.5-10a4.4 4.4 0 0 1 8.5-1.5 4.4 4.4 0 0 1 8.5 1.5Z"/>',
  flame: '<path d="M12 21a7 7 0 0 0 7-7c0-4-3-6-4-10-1 3-2 4-4 5-1-2-2-3-2-5-1 3-4 6-4 10a7 7 0 0 0 7 7Z"/><path d="M10 17a2.5 2.5 0 0 0 4 2"/>',
  drop: '<path d="M12 3.3S5.5 11 5.5 15.2a6.5 6.5 0 0 0 13 0C18.5 11 12 3.3 12 3.3Z"/><path d="M9 15.5a3 3 0 0 0 2.5 2.8"/>',
  skull: '<path d="M12 3.5a8 8 0 0 0-5 14.3V21h10v-3.2a8 8 0 0 0-5-14.3Z"/><circle cx="9.2" cy="11" r="1"/><circle cx="14.8" cy="11" r="1"/><path d="M10 16h4M12 14v2"/>',
  bolt: '<path d="m13.5 2.8-9 11h6l-.5 7.4 9-11h-6z"/>',
  spark: '<path d="m12 3 1.8 6.2L20 11l-6.2 1.8L12 19l-1.8-6.2L4 11l6.2-1.8L12 3ZM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8L19 16Z"/>',
  mushroom: '<path d="M4 11a8 8 0 0 1 16 0v1H4zM12 12v5M9 17h6l1 3H8z"/><path d="M9 8h.01M14 7h.01M16.5 10h.01"/>',
  bee: '<path d="M12 4v16M8 6l8 12M16 6 8 18"/><path d="M12 4a6 6 0 0 0-4 10.5V18h8v-3.5A6 6 0 0 0 12 4Z"/><path d="m9 3-2-2M15 3l2-2"/>',
  gem: '<path d="m4 8 3-4h10l3 4-8 12L4 8Z"/><path d="M4 8h16M7 4l2 4 3 12 3-12 2-4"/>',
  trophy: '<path d="M8 4h8v5a4 4 0 0 1-8 0V4ZM8 6H4v2a4 4 0 0 0 4 4M16 6h4v2a4 4 0 0 1-4 4M12 13v5M8 21h8M9 18h6"/>',
  sprout: '<path d="M12 20v-8M12 13c0-5-3-8-8-8 0 5 3 8 8 8ZM12 10c0-4 2-6 7-6 0 4-2 6-7 6ZM6 20h12"/>',
  butterfly: '<path d="M12 12c-2-5-8-8-9-4-1 3 3 5 8 5-5 0-8 2-7 5 1 3 6 1 8-4M12 12c2-5 8-8 9-4 1 3-3 5-8 5 5 0 8 2 7 5-1 3-6 1-8-4ZM12 5v14"/>',
  flower: '<circle cx="12" cy="12" r="2.2"/><path d="M12 4.2c2.5-3 5.5-.4 3.5 2.4M19.5 8c3.5.3 3.5 4.3 0 4M17 17c1.5 3.2-2 5-4 2M7 17c-1.5 3.2 2 5 4 2M4.5 8c-3.5.3-3.5 4.3 0 4M8 6.6C6 3.8 9 1.2 12 4.2"/>',
  shield: '<path d="M12 3 19 5v5.2c0 4.7-2.9 8-7 10.8-4.1-2.8-7-6.1-7-10.8V5z"/><path d="m9 12 2 2 4-4"/>',
  gamepad: '<path d="M7 8h10a4 4 0 0 1 3.8 5l-1 3.4a2.5 2.5 0 0 1-4.1 1.1l-2.1-1.8h-3.2l-2.1 1.8a2.5 2.5 0 0 1-4.1-1.1l-1-3.4A4 4 0 0 1 7 8Z"/><path d="M8 11v4M6 13h4M16 12h.01M18 14h.01"/>'
};
const SERVER_TAG_BADGES = Object.keys(SERVER_TAG_BADGE_SHAPES);
const SERVER_TAG_BADGE_LABELS = { crest: 'Aven arması', leaf: 'Yaprak', swords: 'Kılıçlar', heart: 'Kalp', flame: 'Alev', drop: 'Damla', skull: 'Kafatası', bolt: 'Şimşek', spark: 'Işıltı', mushroom: 'Mantar', bee: 'Arı', gem: 'Mücevher', trophy: 'Kupa', sprout: 'Filiz', butterfly: 'Kelebek', flower: 'Çiçek', shield: 'Kalkan', gamepad: 'Oyun' };
const normalizeServerTagBadge = badge => Object.hasOwn(SERVER_TAG_BADGE_ALIASES, badge) ? SERVER_TAG_BADGE_ALIASES[badge] : Object.hasOwn(SERVER_TAG_BADGE_SHAPES, badge) ? badge : 'crest';
const serverTagBadgeIcon = badge => {
  const key = normalizeServerTagBadge(badge);
  return `<svg class="server-tag-emblem" viewBox="0 0 24 24" aria-hidden="true">${SERVER_TAG_BADGE_SHAPES[key]}</svg>`;
};
const privateNoteCard = note => typeof note === 'string' && note.trim() ? `<section class="profile-private-note"><div>${uiIcon('note')}<small>${translateText('SANA ÖZEL NOT')}</small></div><p>${esc(note)}</p></section>` : '';
const LANGUAGE_LOCALES = { tr: 'tr-TR', en: 'en-US', de: 'de-DE' };
const TRANSLATIONS = {
  en: {
    'Çevrimiçi':'Online','Boşta':'Idle','Rahatsız Etmeyin':'Do Not Disturb','Görünmez':'Invisible','Çevrimdışı':'Offline',
    'Hesabın kapatıldı':'Your account has been disabled','AVEN GÜVENLİK BİLDİRİMİ':'AVEN SECURITY NOTICE','Oturumun sonlandırıldı. Bu hesapla tekrar giriş yapılamaz. Bir hata olduğunu düşünüyorsan itiraz için destek talebi oluşturabilirsin.':'Your session has ended. You cannot sign in to this account again. If you think this is a mistake, contact support to appeal.','Destek talebi oluştur':'Contact support','HESAP':'ACCOUNT','UYGULAMA':'APP','GİZLİLİK':'PRIVACY','AVEN':'AVEN','PROFİL GÖRÜNÜMÜ':'PROFILE DISPLAY','ŞU ANKİ ETİKET':'CURRENT TAG','Bugün':'Today','Dün':'Yesterday','Bir aramada':'In a call','Aranıyor':'Calling',
    'Bu hesap zaten açık.':'This account is already active.','Hesabın değiştiriliyor':'Switching account','Güvenli bağlantı kuruluyor…':'Establishing a secure connection…','Profilin hazırlanıyor…':'Preparing your profile…','Sohbetlerin yükleniyor…':'Loading your chats…','Bu bilgisayardan kaldır':'Remove from this device','Bu hesap':'This account','Hesap ekle':'Add account','Bu bilgisayarda kayıtlı hesap yok.':'No accounts are saved on this device.',
    'Bir hata oluştu.':'Something went wrong.','Aven yükleniyor':'Loading Aven','Hesabın oluşturuldu':'Account created','Hesabın güvence altına alınıyor…':'Securing your account…','Sohbet alanın yükleniyor…':'Loading your chats…',
    'Destek Merkezi':'Support Center','Gelen kutusu':'Inbox','Arkadaş ekle':'Add Friend','Sunucular':'Servers','Davetle katıl':'Join with an invite','Sunucu oluştur':'Create a server','Sunucuya katıl':'Join a server','Arkadaşlarını davet et':'Invite friends','Sunucu yönetimi':'Server settings','Arkadaş davet et':'Invite friends','Kanal ayarları':'Channel settings','Henüz metin kanalı yok.':'No text channels yet.','Henüz ses kanalı yok.':'No voice channels yet.','ÜYELER':'MEMBERS','Henüz üye yok.':'No members yet.','profilini gör':'view profile','Sunucu sahibi':'Server owner','Ekranını yayınlıyor':'is sharing their screen','YAYINDA':'LIVE',
    'Ekranını yayınla':'Share your screen','Yayını durdur':'Stop streaming','Yayını izle':'Watch stream','Bağlanıyor…':'Connecting…','Yayın bağlantısı hazırlanıyor…':'Preparing stream connection…','Canlı ekran yayını':'Live screen share','Ekranın karşı tarafa iletiliyor':'Your screen is being shared','Canlı yayın · Sen':'Live stream · You','Aven üyesi':'Aven member','Yayını küçült':'Minimize stream','Yayını büyüt':'Expand stream','Ses bağlantısı sürüyor':'Voice connection is active','Kanala dön':'Return to channel','Mikrofonu aç':'Unmute microphone','Mikrofonu kapat':'Mute microphone','Mikrofon':'Microphone','Bağlantıyı kes':'Disconnect','Önce bir ses kanalına veya DM aramasına katıl.':'Join a voice channel or DM call first.','Ekran paylaşımı bu tarayıcıda desteklenmiyor.':'Screen sharing is not supported in this browser.','Ekran seçicisi açılamadı:':'Could not open the screen picker:','Ses bağlantısı yayın seçilirken kapandı.':'The voice connection closed while selecting a stream.','Paylaşılacak ekran seçilemedi.':'No screen was selected to share.','Ekranını paylaşmak için aramanın bağlanmasını bekle.':'Wait for the call to connect before sharing your screen.','Ses bağlantısı yenilenemedi:':'Could not reconnect to voice:','Konuşma göstergesi başlatılamadı:':'Could not start the voice activity indicator:',
    'Profil':'Profile','Ayarlar':'Settings','Hesap':'Account','Uygulama':'App','Gizlilik':'Privacy','Dil':'Language','Profil':'Profile','İletişim':'Communication','Ses':'Audio','Şifre':'Password','Tema':'Appearance','Engellenenler':'Blocked users','Hesap Detayı':'Account details','Hakkında':'About','Profili düzenle':'Edit profile','Profilindeki bilgileri ve görselleri yönet.':'Manage your profile information and images.','Profil fotoğrafı':'Profile picture','Arkadaşların seni kolayca tanısın.':'Help your friends recognize you.','Profil resmi':'Profile image','Resmi değiştir':'Change image','Kaldır':'Remove','Rozetler':'Badges','Henüz rozetin yok.':'You do not have any badges yet.','Profil bannerı':'Profile banner','Profil kartının üst kısmında görünür.':'Shown at the top of your profile card.','Görsel seç':'Choose image','Profil görünümü':'PROFILE DISPLAY','Profil etiketi':'Profile tag','Açık sunucu etiketlerinden birini seç. Seçtiğin etiket adının yanında profilinde, mesajlarda ve sunucularda görünür.':'Choose one of your active server tags. It will appear beside your name on your profile, messages, and in servers.','ŞU ANKİ ETİKET':'CURRENT TAG','Seçilmedi':'Not selected','Etiket kullanma':'Do not use a tag','Profilinde sunucu etiketi gösterme':'Hide the server tag on your profile','Üyesi olduğun sunucularda şu anda açık bir etiket bulunmuyor.':'None of your servers currently have an active tag.','Etiketler yüklenemedi:':'Could not load tags:','Profil etiketi güncellendi.':'Profile tag updated.','Profil etiketi kaldırıldı.':'Profile tag removed.','Profil bilgileri':'Profile information','Herkese açık profilinde gösterilen ad ve açıklama.':'Your public display name and bio.','Görünen ad':'Display name','Kullanıcı adı':'Username','Hakkında':'About','Değişiklikleri kaydet':'Save changes','Kaydedildi':'Saved','Kimler mesaj gönderebilir?':'Who can message you?','Mesaj istekleri kabul edilene kadar sohbet listene eklenmez.':'Message requests do not appear in your chat list until accepted.','Arkadaşlarım':'My friends','Yalnızca arkadaşların mesaj gönderebilir.':'Only your friends can message you.','Herkes':'Everyone','Arkadaş olmayanların mesajı isteklerde bekler.':'Messages from non-friends will appear as requests.','Hiç kimse':'Nobody','Kimse sana DM gönderemez.':'Nobody can send you direct messages.','Seçimin otomatik kaydedilir.':'Your choice is saved automatically.','SES AYGITLARI':'AUDIO DEVICES','Mikrofon ve hoparlör':'Microphone and speakers','Tercih ettiğin aygıtları seç. Mikrofon değişikliği açık ses kanalına hemen uygulanır.':'Choose your preferred devices. Microphone changes apply to your active voice channel immediately.','Giriş aygıtı':'Input device','Mikrofon aygıtları yükleniyor…':'Loading microphone devices…','Çıkış aygıtı':'Output device','Hoparlör aygıtları yükleniyor…':'Loading speaker devices…','Mikrofon seç':'Select microphone','Ses çıkışı seç':'Select audio output','Mikrofon listesinin tamamını görmek için tarayıcıdan mikrofon erişimine izin ver.':'Allow microphone access in your browser to see all available devices.','Aygıtları yenile':'Refresh devices','Mikrofon değiştirildi.':'Microphone changed.','Ses çıkışı güncellendi.':'Audio output updated.','Ses aygıtları yenilendi.':'Audio devices refreshed.','Ses aygıtları yüklenemedi:':'Could not load audio devices:','Ses aygıtları yenilenemedi:':'Could not refresh audio devices:','Mikrofon izni alınamadı:':'Could not get microphone permission:','Şifreyi değiştir':'Change password','Mevcut şifre':'Current password','Yeni şifre (en az 8 karakter)':'New password (at least 8 characters)','Şifre değiştirildi':'Password changed','Tema':'Appearance','Koyu':'Dark','Gece':'Midnight','Açık':'Light','Çıkış yap':'Log out','Profilin tamamını görüntüle':'View full profile','Arkadaş':'Friend','Katılım':'Joined','Genel bakış':'Overview','Ortak arkadaşlar':'Mutual friends','Ortak sunucular':'Mutual servers','ŞU ANDA':'NOW','AVEN’E KATILDI':'JOINED AVEN','Mesaj gönder':'Send message','Hakkında henüz bir şey yazılmamış.':'Nothing here yet.','Henüz bir şey yazılmamış.':'Nothing here yet.','Arkadaşlıktan çıkar':'Remove friend','Engellendi':'Blocked','Mesaj kapalı':'Messages disabled','Daha fazla bilgi al':'Learn more','Sunucu etiketini değiştir':'Change server tag','sunucusunu göster':'show server','＋ Sunucu etiketi':'＋ Server tag','Sunucu etiketi':'Server tag','sunucu etiketi':'server tag','Profil sunucu etiketini seç':'Choose a profile server tag','Bu aramayla eşleşen sunucu etiketi yok.':'No server tags match this search.','Etiket rozeti':'Tag badge','ÖNİZLEME':'PREVIEW','Sunucu Profili':'SERVER PROFILE','Sunucu Etiketi':'Server Tag','Üyelerin adlarının yanında görünecek kısa bir etiket ve rozet seç. Üyeler profillerinden hangi sunucu etiketini kullanacaklarını belirleyebilir.':'Choose a short tag and badge to appear beside member names. Members can select their server tag from their profile.','Sunucu etiketini etkinleştir':'Enable server tag','Etkinleştirildiğinde üyeler seçip kullanabilir.':'Members can select and use it when enabled.','En fazla 4 İngilizce harf veya rakam kullan.':'Use up to 4 English letters or numbers.','Mesajlarda ve üye listesinde böyle görünür.':'This is how it appears in messages and the member list.','Üyeler bu etiketi profillerindeki etiket seçicisinden kullanabilir.':'Members can select this tag from their profile.','Sunucu etiketi güncellendi.':'Server tag updated.','SUNUCUYA KATILIM':'JOINING','Davetler':'Invites','Arkadaşlarına davet bağlantısı gönder veya bağlantıyı kopyala.':'Send an invite link to friends or copy the link.','Bağlantı oluştur':'Create link','Kanallar':'Channels','Metin kanalı':'Text channel','Ses kanalı':'Voice channel','Düzenle':'Edit','Rolleri':'Roles','Rolleri düzenle':'Edit roles','Rolleri yönet':'Manage roles','Varsayılan rol':'Default role','Vazgeç':'Cancel','Kaydet':'Save','Bekliyor':'Pending','İstek gönderildi':'Request sent','Hesabına resmi bir uyarı verildi.':'An official warning was issued to your account.','Yeni bir rozet kazandın':'You earned a new badge','Rozet profilinden kaldırıldı':'Badge removed from your profile','rozetin hesabına eklendi ve profilinde görünmeye başladı.':'badge was added to your account and is now shown on your profile.','rozeti hesabından kaldırıldı.':'badge was removed from your account.','Rozet':'Badge','Yeni bir hesap oluştur':'Create a new account','İstek gönderildi':'Request sent','Arkadaşlık isteği gönderildi.':'Friend request sent.','Bekleyen istekler':'Pending requests','Arkadaşlarını kullanıcı adlarıyla bul.':'Find friends by username.','Gelen istekleri onayla veya reddet.':'Accept or decline incoming requests.','Reddet':'Decline','Kabul et':'Accept','İstek gönderildi ·':'Request sent ·','Bekleyen isteğin yok.':'You have no pending requests.','Aramak için en az 2 karakter yaz.':'Enter at least 2 characters to search.','Kullanıcılar aranıyor…':'Searching users…','Kullanıcı bulunamadı.':'No users found.','Ekle':'Add','Aven resmi hesabı':'Official Aven account','Aven uygulamasının resmi hesabı.':'The official account for the Aven app.','Resmi':'Official','Doğrulanmış Bot Geliştiricisi':'Verified Bot Developer','Aven Erken Destekçisi':'Aven Early Supporter','Sunucu Sahibi':'Server Owner','Dil seç':'Choose a language','Discord\'ta kullanmak istediğin dili seç.':'Choose the language you want to use in Aven.','Türkçe':'Turkish','English':'English','Almanca':'German','Deutsch':'German','Dil':'Language','Dil ayarı bu hesapta saklanır.':'This language preference is saved to this account.','İngilizce':'English','Türkçe':'Turkish','Almanca':'German','Bağlantılar':'Connections','Bulunamadı':'Not found','Görünür ad 1-32 karakter olmalı.':'Display name must be 1–32 characters.','Bu kullanıcı adı alınmış.':'This username is already taken.','Geçersiz profil resmi.':'Invalid profile image.','Hakkında en fazla 160 karakter olabilir.':'About text can be up to 160 characters.','Geçersiz banner.':'Invalid banner.','Geçersiz tema.':'Invalid theme.','Geçersiz durum.':'Invalid status.','Geçersiz mesajlaşma tercihi.':'Invalid messaging preference.','Mevcut şifre hatalı.':'Current password is incorrect.','Kullanıcı adı 3-20 karakter olmalı; yalnızca harf, rakam, _ ve . kullanılabilir.':'Username must be 3–20 characters and can contain only letters, numbers, _ and .','Şifre en az 8 karakter olmalı.':'Password must be at least 8 characters.','Profil fotoğrafı':'Profile picture','Aven’e katıldın':'You joined Aven','Aven\'e katıldığın tarih:':'You joined Aven on:','Görünüm':'Appearance','Mesajlaşma':'Messaging','Paylaşım':'Sharing','Gizlilik':'Privacy','Arkadaşlarınla konuşmak ve paylaşmak için.':'A place to talk and share with your friends.','Arkadaşlarınla anında yazış.':'Message your friends instantly.','Kullanıcı adıyla ara ve istekleri yönet.':'Search by username and manage requests.','Fotoğraf ve videoları sohbetlere ekle.':'Share photos and videos in chats.','Fotoğrafını ve hakkında yazını düzenle.':'Edit your picture and bio.','Mesaj ayarlarını seç ve kullanıcıları engelle.':'Choose message settings and block users.','Koyu, gece veya açık temayı kullan.':'Choose dark, midnight, or light appearance.','Sürüm':'Version','Daha fazla bilgi al':'Learn more','Sunucu oluşturuldu':'Server created','Hesap Detayı':'Account details','Hesap Detayı':'Account details','Kanala katıl':'Join channel','Ses kanalına katıl':'Join voice channel','Henüz bağlı kimse yok':'No one is connected yet','Ses kanalında':'In a voice channel','Canlı yayın':'Live stream','Ekranın karşı tarafa iletiliyor':'Your screen is being sent to other participants','Canlı yayın · Sen':'Live stream · You','Yayın bağlantısı hazırlanıyor…':'Preparing stream connection…','Yayını izlemek için':'To watch the stream','Profil ayarları':'Profile settings','Kullanıcı ayarları':'User settings','Görünürlük':'Visibility','Başarılı':'Success','Hesap bağlantıları':'Account connections','Spotify':'Spotify','Yayın':'Stream','Dil seçimi':'Language selection',
    'Rozet işlemi geçersiz.':'Invalid badge action.','Sunucu etiketi bulunamadı.':'Server tag not found.','Sunucu etiketini yalnızca sunucu sahibi düzenleyebilir.':'Only the server owner can edit the server tag.','Bu sunucuda kullanılabilir bir etiket yok.':'There is no available tag on this server.','Sunucuya katıldın.':'You joined the server.','Sunucuyu aç':'Open server','Oluşturulma:':'Created:','Sahibi:':'Owner:','çevrim içi':'online','üye':'members','Davet bağlantıları':'Invite links','7 gün geçerli':'Valid for 7 days'
  },
  de: {
    'Çevrimiçi':'Online','Boşta':'Abwesend','Rahatsız Etmeyin':'Bitte nicht stören','Görünmez':'Unsichtbar','Çevrimdışı':'Offline',
    'Hesabın kapatıldı':'Dein Konto wurde deaktiviert','AVEN GÜVENLİK BİLDİRİMİ':'AVEN-SICHERHEITSHINWEIS','Oturumun sonlandırıldı. Bu hesapla tekrar giriş yapılamaz. Bir hata olduğunu düşünüyorsan itiraz için destek talebi oluşturabilirsin.':'Deine Sitzung wurde beendet. Du kannst dich nicht erneut bei diesem Konto anmelden. Wenn du glaubst, dass dies ein Fehler ist, wende dich an den Support.','Destek talebi oluştur':'Support kontaktieren','HESAP':'KONTO','UYGULAMA':'APP','GİZLİLİK':'DATENSCHUTZ','AVEN':'AVEN','PROFİL GÖRÜNÜMÜ':'PROFILANZEIGE','ŞU ANKİ ETİKET':'AKTUELLES TAG','Bugün':'Heute','Dün':'Gestern','Bir aramada':'In einem Anruf','Aranıyor':'Ruft an',
    'Bu hesap zaten açık.':'Dieses Konto ist bereits aktiv.','Hesabın değiştiriliyor':'Konto wird gewechselt','Güvenli bağlantı kuruluyor…':'Sichere Verbindung wird hergestellt…','Profilin hazırlanıyor…':'Dein Profil wird vorbereitet…','Sohbetlerin yükleniyor…':'Deine Chats werden geladen…','Bu bilgisayardan kaldır':'Von diesem Gerät entfernen','Bu hesap':'Dieses Konto','Hesap ekle':'Konto hinzufügen','Bu bilgisayarda kayıtlı hesap yok.':'Auf diesem Gerät sind keine Konten gespeichert.',
    'Bir hata oluştu.':'Ein Fehler ist aufgetreten.','Aven yükleniyor':'Aven wird geladen','Hesabın oluşturuldu':'Konto erstellt','Hesabın güvence altına alınıyor…':'Dein Konto wird gesichert…','Sohbet alanın yükleniyor…':'Deine Chats werden geladen…',
    'Destek Merkezi':'Support-Center','Gelen kutusu':'Posteingang','Arkadaş ekle':'Freund hinzufügen','Sunucular':'Server','Davetle katıl':'Mit Einladung beitreten','Sunucu oluştur':'Server erstellen','Sunucuya katıl':'Server beitreten','Arkadaşlarını davet et':'Freunde einladen','Sunucu yönetimi':'Servereinstellungen','Arkadaş davet et':'Freunde einladen','Kanal ayarları':'Kanaleinstellungen','Henüz metin kanalı yok.':'Noch keine Textkanäle.','Henüz ses kanalı yok.':'Noch keine Sprachkanäle.','ÜYELER':'MITGLIEDER','Henüz üye yok.':'Noch keine Mitglieder.','profilini gör':'Profil ansehen','Sunucu sahibi':'Serverinhaber','Ekranını yayınlıyor':'teilt den Bildschirm','YAYINDA':'LIVE',
    'Ekranını yayınla':'Bildschirm teilen','Yayını durdur':'Stream beenden','Yayını izle':'Stream ansehen','Bağlanıyor…':'Verbindung wird hergestellt…','Yayın bağlantısı hazırlanıyor…':'Streamverbindung wird vorbereitet…','Canlı ekran yayını':'Live-Bildschirmübertragung','Ekranın karşı tarafa iletiliyor':'Dein Bildschirm wird übertragen','Canlı yayın · Sen':'Live-Stream · Du','Aven üyesi':'Aven-Mitglied','Yayını küçült':'Stream minimieren','Yayını büyüt':'Stream vergrößern','Ses bağlantısı sürüyor':'Sprachverbindung aktiv','Kanala dön':'Zum Kanal zurückkehren','Mikrofonu aç':'Mikrofon einschalten','Mikrofonu kapat':'Mikrofon ausschalten','Mikrofon':'Mikrofon','Bağlantıyı kes':'Verbindung trennen','Önce bir ses kanalına veya DM aramasına katıl.':'Tritt zuerst einem Sprachkanal oder DM-Anruf bei.','Ekran paylaşımı bu tarayıcıda desteklenmiyor.':'Bildschirmübertragung wird von diesem Browser nicht unterstützt.','Ekran seçicisi açılamadı:':'Bildschirmauswahl konnte nicht geöffnet werden:','Ses bağlantısı yayın seçilirken kapandı.':'Die Sprachverbindung wurde während der Streamauswahl getrennt.','Paylaşılacak ekran seçilemedi.':'Es wurde kein Bildschirm zum Teilen ausgewählt.','Ekranını paylaşmak için aramanın bağlanmasını bekle.':'Warte, bis der Anruf verbunden ist, bevor du deinen Bildschirm teilst.','Ses bağlantısı yenilenemedi:':'Sprachverbindung konnte nicht wiederhergestellt werden:','Konuşma göstergesi başlatılamadı:':'Sprachaktivitätsanzeige konnte nicht gestartet werden:',
    'Profil':'Profil','Ayarlar':'Einstellungen','Hesap':'Konto','Uygulama':'App','Gizlilik':'Datenschutz','Dil':'Sprache','İletişim':'Kommunikation','Ses':'Audio','Şifre':'Passwort','Tema':'Darstellung','Engellenenler':'Blockierte Nutzer','Hesap Detayı':'Kontodetails','Hakkında':'Über Aven','Profili düzenle':'Profil bearbeiten','Profilindeki bilgileri ve görselleri yönet.':'Verwalte deine Profilinformationen und Bilder.','Profil fotoğrafı':'Profilbild','Arkadaşların seni kolayca tanısın.':'Damit deine Freunde dich leicht erkennen.','Profil resmi':'Profilbild','Resmi değiştir':'Bild ändern','Kaldır':'Entfernen','Rozetler':'Abzeichen','Henüz rozetin yok.':'Du hast noch keine Abzeichen.','Profil bannerı':'Profilbanner','Profil kartının üst kısmında görünür.':'Wird oben auf deiner Profilkarte angezeigt.','Görsel seç':'Bild auswählen','PROFİL GÖRÜNÜMÜ':'PROFILANZEIGE','Profil etiketi':'Server-Tag','Açık sunucu etiketlerinden birini seç. Seçtiğin etiket adının yanında profilinde, mesajlarda ve sunucularda görünür.':'Wähle eines deiner aktiven Server-Tags. Es erscheint neben deinem Namen im Profil, in Nachrichten und auf Servern.','ŞU ANKİ ETİKET':'AKTUELLES TAG','Seçilmedi':'Nicht ausgewählt','Etiket kullanma':'Kein Tag verwenden','Profilinde sunucu etiketi gösterme':'Server-Tag im Profil ausblenden','Üyesi olduğun sunucularda şu anda açık bir etiket bulunmuyor.':'Keiner deiner Server hat derzeit ein aktives Tag.','Etiketler yüklenemedi:':'Tags konnten nicht geladen werden:','Profil etiketi güncellendi.':'Profil-Tag aktualisiert.','Profil etiketi kaldırıldı.':'Profil-Tag entfernt.','Profil bilgileri':'Profilinformationen','Herkese açık profilinde gösterilen ad ve açıklama.':'Dein öffentlicher Anzeigename und deine Beschreibung.','Görünen ad':'Anzeigename','Kullanıcı adı':'Benutzername','Hakkında':'Über mich','Değişiklikleri kaydet':'Änderungen speichern','Kaydedildi':'Gespeichert','Kimler mesaj gönderebilir?':'Wer darf dir Nachrichten senden?','Mesaj istekleri kabul edilene kadar sohbet listene eklenmez.':'Nachrichtenanfragen erscheinen erst nach Annahme in deiner Chatliste.','Arkadaşlarım':'Meine Freunde','Yalnızca arkadaşların mesaj gönderebilir.':'Nur deine Freunde können dir Nachrichten senden.','Herkes':'Jeder','Arkadaş olmayanların mesajı isteklerde bekler.':'Nachrichten von Nicht-Freunden werden als Anfragen angezeigt.','Hiç kimse':'Niemand','Kimse sana DM gönderemez.':'Niemand kann dir Direktnachrichten senden.','Seçimin otomatik kaydedilir.':'Deine Auswahl wird automatisch gespeichert.','SES AYGITLARI':'AUDIOGERÄTE','Mikrofon ve hoparlör':'Mikrofon und Lautsprecher','Tercih ettiğin aygıtları seç. Mikrofon değişikliği açık ses kanalına hemen uygulanır.':'Wähle deine bevorzugten Geräte. Änderungen am Mikrofon werden sofort im aktiven Sprachkanal übernommen.','Giriş aygıtı':'Eingabegerät','Mikrofon aygıtları yükleniyor…':'Mikrofone werden geladen…','Çıkış aygıtı':'Ausgabegerät','Hoparlör aygıtları yükleniyor…':'Lautsprecher werden geladen…','Mikrofon seç':'Mikrofon auswählen','Ses çıkışı seç':'Audioausgabe auswählen','Mikrofon listesinin tamamını görmek için tarayıcıdan mikrofon erişimine izin ver.':'Erlaube den Mikrofonzugriff im Browser, um alle verfügbaren Geräte zu sehen.','Aygıtları yenile':'Geräte aktualisieren','Mikrofon değiştirildi.':'Mikrofon geändert.','Ses çıkışı güncellendi.':'Audioausgabe aktualisiert.','Ses aygıtları yenilendi.':'Audiogeräte aktualisiert.','Ses aygıtları yüklenemedi:':'Audiogeräte konnten nicht geladen werden:','Ses aygıtları yenilenemedi:':'Audiogeräte konnten nicht aktualisiert werden:','Mikrofon izni alınamadı:':'Mikrofonberechtigung konnte nicht abgerufen werden:','Şifreyi değiştir':'Passwort ändern','Mevcut şifre':'Aktuelles Passwort','Yeni şifre (en az 8 karakter)':'Neues Passwort (mindestens 8 Zeichen)','Şifre değiştirildi':'Passwort geändert','Koyu':'Dunkel','Gece':'Mitternacht','Açık':'Hell','Çıkış yap':'Abmelden','Profilin tamamını görüntüle':'Vollständiges Profil ansehen','Arkadaş':'Freund','Katılım':'Beigetreten','Genel bakış':'Übersicht','Ortak arkadaşlar':'Gemeinsame Freunde','Ortak sunucular':'Gemeinsame Server','ŞU ANDA':'JETZT','AVEN’E KATILDI':'AVEN BEIGETRETEN','Mesaj gönder':'Nachricht senden','Hakkında henüz bir şey yazılmamış.':'Hier steht noch nichts.','Henüz bir şey yazılmamış.':'Hier steht noch nichts.','Arkadaşlıktan çıkar':'Freund entfernen','Engellendi':'Blockiert','Mesaj kapalı':'Nachrichten deaktiviert','Daha fazla bilgi al':'Mehr erfahren','Sunucu etiketini değiştir':'Server-Tag ändern','sunucusunu göster':'Server anzeigen','＋ Sunucu etiketi':'＋ Server-Tag','Sunucu etiketi':'Server-Tag','sunucu etiketi':'Server-Tag','Profil sunucu etiketini seç':'Profil-Server-Tag auswählen','Bu aramayla eşleşen sunucu etiketi yok.':'Keine Server-Tags für diese Suche gefunden.','Etiket rozeti':'Tag-Abzeichen','ÖNİZLEME':'VORSCHAU','SUNUCU PROFİLİ':'SERVERPROFIL','Sunucu Etiketi':'Server-Tag','Üyelerin adlarının yanında görünecek kısa bir etiket ve rozet seç. Üyeler profillerinden hangi sunucu etiketini kullanacaklarını belirleyebilir.':'Wähle ein kurzes Tag und ein Abzeichen, das neben den Namen der Mitglieder erscheint. Mitglieder können ihr Server-Tag im Profil auswählen.','Sunucu etiketini etkinleştir':'Server-Tag aktivieren','Etkinleştirildiğinde üyeler seçip kullanabilir.':'Mitglieder können es nach der Aktivierung auswählen und verwenden.','En fazla 4 İngilizce harf veya rakam kullan.':'Verwende bis zu 4 englische Buchstaben oder Zahlen.','Mesajlarda ve üye listesinde böyle görünür.':'So wird es in Nachrichten und der Mitgliederliste angezeigt.','Üyeler bu etiketi profillerindeki etiket seçicisinden kullanabilir.':'Mitglieder können dieses Tag in ihrem Profil auswählen.','Sunucu etiketi güncellendi.':'Server-Tag aktualisiert.','Davetler':'Einladungen','Arkadaşlarına davet bağlantısı gönder veya bağlantıyı kopyala.':'Sende deinen Freunden einen Einladungslink oder kopiere ihn.','Bağlantı oluştur':'Link erstellen','Kanallar':'Kanäle','Metin kanalı':'Textkanal','Ses kanalı':'Sprachkanal','Düzenle':'Bearbeiten','Rolleri':'Rollen','Rolleri düzenle':'Rollen bearbeiten','Rolleri yönet':'Rollen verwalten','Varsayılan rol':'Standardrolle','Vazgeç':'Abbrechen','Kaydet':'Speichern','Bekliyor':'Ausstehend','İstek gönderildi':'Anfrage gesendet','Hesabına resmi bir uyarı verildi.':'Dein Konto hat eine offizielle Verwarnung erhalten.','Yeni bir rozet kazandın':'Du hast ein neues Abzeichen erhalten','Rozet profilinden kaldırıldı':'Abzeichen aus deinem Profil entfernt','rozetin hesabına eklendi ve profilinde görünmeye başladı.':'Abzeichen wurde deinem Konto hinzugefügt und ist jetzt in deinem Profil sichtbar.','rozeti hesabından kaldırıldı.':'Abzeichen wurde von deinem Konto entfernt.','Rozet':'Abzeichen','Arkadaşlık isteği gönderildi.':'Freundschaftsanfrage gesendet.','Bekleyen istekler':'Ausstehende Anfragen','Arkadaşlarını kullanıcı adlarıyla bul.':'Finde Freunde anhand ihres Benutzernamens.','Gelen istekleri onayla veya reddet.':'Nimm eingehende Anfragen an oder lehne sie ab.','Reddet':'Ablehnen','Kabul et':'Annehmen','İstek gönderildi ·':'Anfrage gesendet ·','Bekleyen isteğin yok.':'Du hast keine offenen Anfragen.','Aramak için en az 2 karakter yaz.':'Gib mindestens 2 Zeichen für die Suche ein.','Kullanıcılar aranıyor…':'Nutzer werden gesucht…','Kullanıcı bulunamadı.':'Keine Nutzer gefunden.','Ekle':'Hinzufügen','Aven uygulamasının resmi hesabı.':'Das offizielle Konto der Aven-App.','Resmi':'Offiziell','Doğrulanmış Bot Geliştiricisi':'Verifizierter Bot-Entwickler','Aven Erken Destekçisi':'Früher Aven-Unterstützer','Sunucu Sahibi':'Serverinhaber','Dil seç':'Sprache auswählen','Discord\'ta kullanmak istediğin dili seç.':'Wähle die Sprache, die du in Aven verwenden möchtest.','Türkçe':'Türkisch','English':'Englisch','Almanca':'Deutsch','Deutsch':'Deutsch','İngilizce':'Englisch','Dil ayarı bu hesapta saklanır.':'Diese Spracheinstellung wird für dieses Konto gespeichert.','Bağlantılar':'Verbindungen','Görünür ad 1-32 karakter olmalı.':'Der Anzeigename muss 1–32 Zeichen lang sein.','Bu kullanıcı adı alınmış.':'Dieser Benutzername ist bereits vergeben.','Geçersiz profil resmi.':'Ungültiges Profilbild.','Hakkında en fazla 160 karakter olabilir.':'Der Infotext darf höchstens 160 Zeichen lang sein.','Geçersiz banner.':'Ungültiges Banner.','Geçersiz tema.':'Ungültige Darstellung.','Geçersiz durum.':'Ungültiger Status.','Geçersiz mesajlaşma tercihi.':'Ungültige Nachrichteneinstellung.','Mevcut şifre hatalı.':'Das aktuelle Passwort ist falsch.','Kullanıcı adı 3-20 karakter olmalı; yalnızca harf, rakam, _ ve . kullanılabilir.':'Der Benutzername muss 3–20 Zeichen lang sein und darf nur Buchstaben, Zahlen, _ und . enthalten.','Şifre en az 8 karakter olmalı.':'Das Passwort muss mindestens 8 Zeichen lang sein.','Aven\'e katıldığın tarih:':'Aven beigetreten am:','Görünüm':'Darstellung','Mesajlaşma':'Nachrichten','Paylaşım':'Teilen','Arkadaşlarınla konuşmak ve paylaşmak için.':'Ein Ort zum Reden und Teilen mit deinen Freunden.','Arkadaşlarınla anında yazış.':'Schreibe deinen Freunden sofort.','Kullanıcı adıyla ara ve istekleri yönet.':'Suche nach Benutzernamen und verwalte Anfragen.','Fotoğraf ve videoları sohbetlere ekle.':'Teile Fotos und Videos in Chats.','Fotoğrafını ve hakkında yazını düzenle.':'Bearbeite dein Bild und deinen Infotext.','Mesaj ayarlarını seç ve kullanıcıları engelle.':'Lege Nachrichteneinstellungen fest und blockiere Nutzer.','Koyu, gece veya açık temayı kullan.':'Wähle dunkle, mitternächtliche oder helle Darstellung.','Kanala katıl':'Kanal beitreten','Ses kanalına katıl':'Sprachkanal beitreten','Henüz bağlı kimse yok':'Noch niemand verbunden','Ses kanalında':'In einem Sprachkanal','Canlı yayın':'Live-Stream','Yayın bağlantısı hazırlanıyor…':'Streamverbindung wird vorbereitet…','Önce bir ses kanalına veya DM aramasına katıl.':'Tritt zuerst einem Sprachkanal oder DM-Anruf bei.','Sunucuya katıldın.':'Du bist dem Server beigetreten.','Sunucuyu aç':'Server öffnen','Oluşturulma:':'Erstellt:','Sahibi:':'Inhaber:','çevrim içi':'online','üye':'Mitglieder','Davet bağlantıları':'Einladungslinks','7 gün geçerli':'7 Tage gültig'
  }
};
Object.assign(TRANSLATIONS.en, {
  'Sunucuyu sil':'Delete server','ve içindeki kanallar kalıcı olarak silinecek.':'and all of its channels will be permanently deleted.','Sunucu silindi.':'Server deleted.',
  'Profilini düzenle':'Edit your profile','Çıkış Yap':'Log out','Hesap Değiştir':'Switch account','Ayarları kapat':'Close settings','Sunucu ayarları':'Server settings','Sunucu banner\'ı':'Server banner','Sunucu başlığında görünür.':'Shown in the server header.','Sunucu adı':'Server name','Sunucunun adını ve görsellerini düzenle. Değişiklikler bütün üyelere yansır.':'Edit the server name and images. Changes are visible to all members.','JPG, PNG, GIF veya WebP görseli seç.':'Choose a JPG, PNG, GIF, or WebP image.','SUNUCU PROFİLİ':'SERVER PROFILE','KİŞİLER':'PEOPLE','Üyeler':'Members','Sunucudaki üyeler ve atanmış rolleri.':'Server members and their assigned roles.','Sunucu sahibi e-posta adresine gönderilen kodu doğrula.':'Verify the code sent to the server owner’s email address.','Kod gönder':'Send code','Doğrulama kodu':'Verification code','Sunucuyu kalıcı olarak sil':'Delete server permanently','Sunucu ayarlarını değiştirme iznin yok.':'You do not have permission to change server settings.','SUNUCU DAVETİ':'SERVER INVITE','SUNUCU DAVET BAĞLANTISI':'SERVER INVITE LINK','Bağlantıyı kopyala':'Copy link','DM ile gönder':'Send in DM','Davet bağlantısını oluştur':'Create invite link','İzinler':'Permissions','İzin ver':'Allow','Varsayılanı kullan':'Use default','İzinleri kaydet':'Save permissions','İzinler kaydedildi; görünüm yenilenemedi:':'Permissions saved, but the view could not be refreshed:','Kanal kimliğini kopyala':'Copy channel ID','Kanal adı':'Channel name','Açıklama':'Description','Kanalı sil':'Delete channel','Rol oluştur':'Create role','Rol adı':'Role name','Yönetici · Tüm izinler':'Administrator · All permissions','Henüz atanmış rol yok.':'No roles assigned yet.','Henüz özel rol oluşturulmamış.':'No custom roles have been created yet.','Sunucu adını değiştir':'Change server name','Metin kanalı oluştur':'Create text channel','Ses kanalı oluştur':'Create voice channel','Sunucuya arkadaş davet et':'Invite friends to the server','Kanal ayarları':'Channel settings','Rolleri yönet':'Manage roles','Aramaya dön':'Return to call','Bir aramada':'In a call','Aranıyor':'Calling','Mesajlar yükleniyor…':'Loading messages…','Arkadaşlar':'Friends','Arkadaşlar (':'Friends (','İstekler':'Requests','Tümü':'All','Okunmamış':'Unread','Hepsini okundu işaretle':'Mark all as read','İptal':'Cancel','Engel kaldırıldı':'User unblocked','Kullanıcı adı gir':'Enter a username','Arkadaşsınız':'You are friends','Hoş geldin,':'Welcome,','Soldan bir arkadaşını seç ve yazışmaya başla.':'Select a friend on the left to start chatting.','Kullanıcı adıyla ara, istek gönder.':'Search by username and send a request.','Dosya paylaş':'Share a file','Fotoğraf ve videolar VDS’de tutulmadan cihazlar arasında aktarılır (en çok 25 MB).':'Photos and videos are transferred between devices without being stored on the server (up to 25 MB).','Mesajı düzenle':'Edit a message','Kendi mesajına çift tıkla. Düzenlenen mesajda "düzenlendi" yazar.':'Double-click your message to edit it. Edited messages are marked “edited”.','Gönder':'Send','Dosyaları bırak':'Drop files','Görseller 25 MB · Videolar 50 MB · En fazla 5 yükleme aynı anda':'Images up to 25 MB · Videos up to 50 MB · Up to 5 uploads at a time','İlk mesajını yaz':'Write your first message','Birlikte tanıdığınız kişi':'People you both know','Henüz ortak arkadaş yok':'No mutual friends yet','Birlikte bulunduğunuz yer':'Servers you share','Henüz ortak sunucu yok':'No mutual servers yet','Aven’de çevrimiçi':'Online on Aven','Şu anda çevrimdışı':'Currently offline','Profil etkinliği':'Profile activity','Aven resmi hesabı.':'The official Aven account.','Bir dil seç':'Choose a language','Aven\'de kullanmak istediğin dili seç. Bu tercih yalnızca açık olan hesaba kaydedilir.':'Choose the language you want to use in Aven. This preference is saved only to the current account.','Dil':'Language','Arayüz dili':'Interface language','Dil tercihin bu hesaba kaydedilir; hesap değiştirdiğinde o hesabın dili kullanılır.':'Your language preference is saved to this account. When you switch accounts, that account’s language is used.','Türkçe':'Turkish','İngilizce':'English','Almanca':'German','Aven Early Supporter':'Aven Early Supporter','Aven Official':'Aven Official','Verified Bot Developer':'Verified Bot Developer','Admin':'Administrator','Turkish':'Turkish','German':'German','English':'English','Sunucu etiketi':'Server tag','Profil sunucu etiketini seç':'Choose a profile server tag','Açık sunucu etiketlerinden birini seç. Seçtiğin etiket adının yanında profilinde, mesajlarda ve sunucularda görünür.':'Choose one of your active server tags. It appears next to your name on your profile, in messages, and in servers.','Dil ayarı kaydedilemedi.':'Could not save language preference.',
  'Bu tarayıcı ses çıkış aygıtı seçimini desteklemiyor.':'This browser does not support choosing an audio output device.','Bu tarayıcı ses aygıtlarını listeleyemiyor':'This browser cannot list audio devices','Tarayıcı ses aygıtlarını listelemeyi desteklemiyor.':'This browser does not support listing audio devices.','Mikrofon erişimi için güvenli HTTPS bağlantısı gerekli.':'A secure HTTPS connection is required for microphone access.','Varsayılan çıkış':'Default output','Varsayılan mikrofon':'Default microphone','Varsayılan ses çıkışı':'Default audio output','Mikrofon bulunamadı. Aygıtı bağlayıp listeyi yenile.':'No microphone found. Connect a device and refresh the list.','Seçilen aygıt, sesli kanaldaki diğer katılımcıların sesini çalar.':'The selected device plays audio from other participants in voice channels.','Bu tarayıcıda çıkış aygıtı seçimi desteklenmiyor; varsayılan hoparlör kullanılır.':'Output device selection is not supported in this browser; the default speaker will be used.','Seçilen mikrofon ses akışı vermedi.':'The selected microphone did not provide an audio stream.','Görsel boyutu çok büyük. Daha küçük bir görsel seç.':'Image is too large. Choose a smaller one.','Resim okunamadı.':'Could not read the image.','Sunucu bilgisi yükleniyor…':'Loading server information…','Aven kullanıcısı':'Aven user','ŞU AN':'NOW','AVEN ROZET BİLDİRİMİ':'AVEN BADGE NOTICE','Sesli arama sona erdi':'Voice call ended','Sesli arama başladı':'Voice call started','Görüşme süresi':'Call duration','Kapat':'Close','Video oynatıcı':'Video player','Tam ekran oynatıcıyı aç':'Open full-screen player','Oynat':'Play','Duraklat':'Pause','Video konumu':'Video position','Ses seviyesi':'Volume','Hesabının durumu':'Account status','Uyarı sebebi':'Reason for warning','Hesap Detayı\'nı aç':'Open account details','Uyarı geri alınmaz ve affedilmez.':'Warnings cannot be revoked or forgiven.','Yeni kod gönder':'Send a new code','E-postanı doğrula':'Verify your email','Hesabını aktifleştirmek için 6 haneli kodu gir.':'Enter the 6-digit code to activate your account.','Kod 10 dakika geçerli.':'The code is valid for 10 minutes.','Hesabı doğrula':'Verify account','E-postayı değiştir':'Change email','Kayıt ol':'Sign up','Giriş yap':'Log in','Hesabın var mı?':'Already have an account?','Hesabın yok mu?':'Need an account?','Aven’i keşfet':'Discover Aven','Topluluk Kuralları':'Community Guidelines','Resmi Aven kuralları':'Official Aven guidelines','İÇİNDEKİLER':'CONTENTS','Saygı ve nezaket':'Respect and kindness','Güvenlik ve mahremiyet':'Safety and privacy','Paylaşılan içerikler':'Shared content','Kötüye kullanım':'Abuse','Saygılı iletişim kur':'Communicate respectfully','Güvenliğin ve mahremiyeti koru':'Protect safety and privacy','Paylaşılan içeriklere dikkat et':'Be mindful of shared content','Aven’i kötüye kullanma':'Do not misuse Aven','Birlikte koruyalım':'Let’s protect the community','Görünür ad 1-32 karakter olmalı.':'Display name must be 1–32 characters.','Arkadaşını seç':'Choose a friend','sunucusuna katıldın.':'joined the server.','Uyarı sebebi':'Reason for warning'
});
Object.assign(TRANSLATIONS.de, {
  'Sunucuyu sil':'Server löschen','ve içindeki kanallar kalıcı olarak silinecek.':'und alle Kanäle werden dauerhaft gelöscht.','Sunucu silindi.':'Server gelöscht.',
  'Profilini düzenle':'Profil bearbeiten','Çıkış Yap':'Abmelden','Hesap Değiştir':'Konto wechseln','Ayarları kapat':'Einstellungen schließen','Sunucu ayarları':'Servereinstellungen','Sunucu banner\'ı':'Serverbanner','Sunucu başlığında görünür.':'Wird im Serverkopf angezeigt.','Sunucu adı':'Servername','Sunucunun adını ve görsellerini düzenle. Değişiklikler bütün üyelere yansır.':'Bearbeite Servername und Bilder. Änderungen sind für alle Mitglieder sichtbar.','JPG, PNG, GIF veya WebP görseli seç.':'Wähle ein JPG-, PNG-, GIF- oder WebP-Bild.','SUNUCU PROFİLİ':'SERVERPROFIL','KİŞİLER':'PERSONEN','Üyeler':'Mitglieder','Sunucudaki üyeler ve atanmış rolleri.':'Servermitglieder und ihre zugewiesenen Rollen.','Sunucu sahibi e-posta adresine gönderilen kodu doğrula.':'Bestätige den Code, der an die E-Mail-Adresse des Serverinhabers gesendet wurde.','Kod gönder':'Code senden','Doğrulama kodu':'Bestätigungscode','Sunucuyu kalıcı olarak sil':'Server dauerhaft löschen','Sunucu ayarlarını değiştirme iznin yok.':'Du darfst die Servereinstellungen nicht ändern.','SUNUCU DAVETİ':'SERVEREINLADUNG','SUNUCU DAVET BAĞLANTISI':'SERVER-EINLADUNGSLINK','Bağlantıyı kopyala':'Link kopieren','DM ile gönder':'Per Direktnachricht senden','Davet bağlantısını oluştur':'Einladungslink erstellen','İzinler':'Berechtigungen','İzin ver':'Erlauben','Varsayılanı kullan':'Standard verwenden','İzinleri kaydet':'Berechtigungen speichern','İzinler kaydedildi; görünüm yenilenemedi:':'Berechtigungen gespeichert, aber die Ansicht konnte nicht aktualisiert werden:','Kanal kimliğini kopyala':'Kanal-ID kopieren','Kanal adı':'Kanalname','Açıklama':'Beschreibung','Kanalı sil':'Kanal löschen','Rol oluştur':'Rolle erstellen','Rol adı':'Rollenname','Yönetici · Tüm izinler':'Administrator · Alle Berechtigungen','Henüz atanmış rol yok.':'Noch keine Rollen zugewiesen.','Henüz özel rol oluşturulmamış.':'Es wurden noch keine benutzerdefinierten Rollen erstellt.','Sunucu adını değiştir':'Servername ändern','Metin kanalı oluştur':'Textkanal erstellen','Ses kanalı oluştur':'Sprachkanal erstellen','Sunucuya arkadaş davet et':'Freunde auf den Server einladen','Aramaya dön':'Zum Anruf zurückkehren','Bir aramada':'In einem Anruf','Aranıyor':'Ruft an','Mesajlar yükleniyor…':'Nachrichten werden geladen…','Arkadaşlar':'Freunde','Arkadaşlar (':'Freunde (','İstekler':'Anfragen','Tümü':'Alle','Okunmamış':'Ungelesen','Hepsini okundu işaretle':'Alle als gelesen markieren','İptal':'Abbrechen','Engel kaldırıldı':'Nutzer entsperrt','Kullanıcı adı gir':'Benutzernamen eingeben','Arkadaşsınız':'Ihr seid befreundet','Hoş geldin,':'Willkommen,','Soldan bir arkadaşını seç ve yazışmaya başla.':'Wähle links einen Freund aus, um zu chatten.','Kullanıcı adıyla ara, istek gönder.':'Suche nach Benutzernamen und sende eine Anfrage.','Dosya paylaş':'Datei teilen','Mesajı düzenle':'Nachricht bearbeiten','Kendi mesajına çift tıkla. Düzenlenen mesajda "düzenlendi" yazar.':'Doppelklicke auf deine Nachricht, um sie zu bearbeiten. Bearbeitete Nachrichten sind markiert.','Gönder':'Senden','Dosyaları bırak':'Dateien hier ablegen','İlk mesajını yaz':'Schreibe deine erste Nachricht','Birlikte tanıdığınız kişi':'Gemeinsame Kontakte','Henüz ortak arkadaş yok':'Noch keine gemeinsamen Freunde','Birlikte bulunduğunuz yer':'Gemeinsame Server','Henüz ortak sunucu yok':'Noch keine gemeinsamen Server','Aven’de çevrimiçi':'Auf Aven online','Şu anda çevrimdışı':'Derzeit offline','Profil etkinliği':'Profilaktivität','Aven resmi hesabı.':'Das offizielle Aven-Konto.','Bir dil seç':'Sprache auswählen','Aven\'de kullanmak istediğin dili seç. Bu tercih yalnızca açık olan hesaba kaydedilir.':'Wähle die Sprache für Aven. Diese Einstellung wird nur für das aktuelle Konto gespeichert.','Dil':'Sprache','Arayüz dili':'Oberflächensprache','Dil tercihin bu hesaba kaydedilir; hesap değiştirdiğinde o hesabın dili kullanılır.':'Deine Spracheinstellung wird für dieses Konto gespeichert. Beim Kontowechsel gilt die Sprache des jeweiligen Kontos.','Türkçe':'Türkisch','İngilizce':'Englisch','Almanca':'Deutsch','Aven Early Supporter':'Früher Aven-Unterstützer','Aven Official':'Aven Offiziell','Verified Bot Developer':'Verifizierter Bot-Entwickler','Admin':'Administrator','Turkish':'Türkisch','German':'Deutsch','English':'Englisch','Sunucu etiketi':'Server-Tag','Profil sunucu etiketini seç':'Profil-Server-Tag auswählen','Dil ayarı kaydedilemedi.':'Spracheinstellung konnte nicht gespeichert werden.',
  'Bu tarayıcı ses çıkış aygıtı seçimini desteklemiyor.':'Dieser Browser unterstützt keine Auswahl des Audioausgabegeräts.','Bu tarayıcı ses aygıtlarını listeleyemiyor':'Dieser Browser kann Audiogeräte nicht auflisten','Tarayıcı ses aygıtlarını listelemeyi desteklemiyor.':'Dieser Browser unterstützt das Auflisten von Audiogeräten nicht.','Mikrofon erişimi için güvenli HTTPS bağlantısı gerekli.':'Für den Mikrofonzugriff ist eine sichere HTTPS-Verbindung erforderlich.','Varsayılan çıkış':'Standardausgabe','Varsayılan mikrofon':'Standardmikrofon','Varsayılan ses çıkışı':'Standard-Audioausgabe','Mikrofon bulunamadı. Aygıtı bağlayıp listeyi yenile.':'Kein Mikrofon gefunden. Schließe ein Gerät an und aktualisiere die Liste.','Seçilen aygıt, sesli kanaldaki diğer katılımcıların sesini çalar.':'Das ausgewählte Gerät gibt den Ton anderer Teilnehmer im Sprachkanal wieder.','Bu tarayıcıda çıkış aygıtı seçimi desteklenmiyor; varsayılan hoparlör kullanılır.':'Dieser Browser unterstützt keine Auswahl des Ausgabegeräts. Der Standardlautsprecher wird verwendet.','Seçilen mikrofon ses akışı vermedi.':'Das ausgewählte Mikrofon hat keinen Audiostream bereitgestellt.','Görsel boyutu çok büyük. Daha küçük bir görsel seç.':'Das Bild ist zu groß. Wähle ein kleineres Bild.','Resim okunamadı.':'Das Bild konnte nicht gelesen werden.','Sunucu bilgisi yükleniyor…':'Serverinformationen werden geladen…','Aven kullanıcısı':'Aven-Nutzer','ŞU AN':'JETZT','AVEN ROZET BİLDİRİMİ':'AVEN-ABZEICHENHINWEIS','Sesli arama sona erdi':'Sprachanruf beendet','Sesli arama başladı':'Sprachanruf gestartet','Görüşme süresi':'Gesprächsdauer','Kapat':'Schließen','Video oynatıcı':'Videoplayer','Tam ekran oynatıcıyı aç':'Vollbildplayer öffnen','Oynat':'Abspielen','Duraklat':'Pausieren','Video konumu':'Videoposition','Ses seviyesi':'Lautstärke','Hesabının durumu':'Kontostatus','Uyarı sebebi':'Grund der Verwarnung','Hesap Detayı\'nı aç':'Kontodetails öffnen','Uyarı geri alınmaz ve affedilmez.':'Verwarnungen können nicht aufgehoben oder verziehen werden.','Yeni kod gönder':'Neuen Code senden','E-postanı doğrula':'E-Mail bestätigen','Hesabını aktifleştirmek için 6 haneli kodu gir.':'Gib den 6-stelligen Code ein, um dein Konto zu aktivieren.','Kod 10 dakika geçerli.':'Der Code ist 10 Minuten gültig.','Hesabı doğrula':'Konto bestätigen','E-postayı değiştir':'E-Mail ändern','Kayıt ol':'Registrieren','Giriş yap':'Anmelden','Hesabın var mı?':'Hast du bereits ein Konto?','Hesabın yok mu?':'Noch kein Konto?','Aven’i keşfet':'Aven entdecken','Topluluk Kuralları':'Community-Richtlinien','Resmi Aven kuralları':'Offizielle Aven-Richtlinien','İÇİNDEKİLER':'INHALT','Saygı ve nezaket':'Respekt und Freundlichkeit','Güvenlik ve mahremiyet':'Sicherheit und Datenschutz','Paylaşılan içerikler':'Geteilte Inhalte','Kötüye kullanım':'Missbrauch','Saygılı iletişim kur':'Kommuniziere respektvoll','Güvenliğin ve mahremiyeti koru':'Schütze Sicherheit und Privatsphäre','Paylaşılan içeriklere dikkat et':'Gehe achtsam mit geteilten Inhalten um','Aven’i kötüye kullanma':'Missbrauche Aven nicht','Birlikte koruyalım':'Schützen wir die Community gemeinsam','sunucusuna katıldın.':'dem Server beigetreten.','Aven kullanıcısı':'Aven-Nutzer'
});
Object.assign(TRANSLATIONS.en, {
  'Ortak noktalarınız':'Your mutual connections','Durum ve birlikte bulunduğunuz alanlar.':'Your status and shared spaces.','ORTAK ARKADAŞ':'MUTUAL FRIEND','Engeli kaldır':'Unblock','Kullanıcı adını yazarak arkadaşlık isteği gönder. Kabul edilince DM listenize eklenir.':'Send a friend request by username. Once accepted, they will appear in your DM list.','Arkadaş olunca sohbetleriniz iki tarafta da görünür.':'When you become friends, your chats appear for both of you.','Dosya bu cihazda bulunamadı.':'File not found on this device.','Dosya yüklemesi tamamlandı.':'File upload complete.','Bu cihazda görüntüleniyor; ortak aktarım tamamlanamadı:':'Shown on this device; shared transfer could not be completed:','Eski medya açılamadı:':'Could not open older media:','Bu eski ek, ortak görüntülemeye geçirmek için bir cihazdaki eski anahtara ihtiyaç duyuyor.':'This older attachment needs an old key from one device to enable shared viewing.','desteklenmeyen dosya türü.':'unsupported file type.','video 50 MB sınırını aşıyor.':'video exceeds the 50 MB limit.','görsel sıkıştırma öncesi 100 MB sınırını aşıyor.':'image exceeds the 100 MB limit before compression.','sıkıştırılmış görsel 25 MB sınırını aşıyor.':'compressed image exceeds the 25 MB limit.','İzin önceliği: üye → üye rolleri → @everyone → rol varsayılanı.':'Permission priority: member → member roles → @everyone → role default.','İzin hedefi':'Permission target','Üye:':'Member:','AVEN ROZET BİLDİRİMİ':'AVEN BADGE NOTICE','ŞU AN':'NOW','sunucusuna katıldın.':'joined the server.'
});
Object.assign(TRANSLATIONS.de, {
  'Ortak noktalarınız':'Eure gemeinsamen Kontakte','Durum ve birlikte bulunduğunuz alanlar.':'Dein Status und gemeinsam genutzte Bereiche.','ORTAK ARKADAŞ':'GEMEINSAME FREUNDE','Engeli kaldır':'Entsperren','Kullanıcı adını yazarak arkadaşlık isteği gönder. Kabul edilince DM listenize eklenir.':'Sende eine Freundschaftsanfrage mit dem Benutzernamen. Nach der Annahme erscheint die Person in deiner Direktnachrichtenliste.','Arkadaş olunca sohbetleriniz iki tarafta da görünür.':'Wenn ihr befreundet seid, erscheinen eure Chats bei euch beiden.','Dosya bu cihazda bulunamadı.':'Datei auf diesem Gerät nicht gefunden.','Dosya yüklemesi tamamlandı.':'Datei-Upload abgeschlossen.','Bu cihazda görüntüleniyor; ortak aktarım tamamlanamadı:':'Auf diesem Gerät angezeigt; gemeinsame Übertragung konnte nicht abgeschlossen werden:','Eski medya açılamadı:':'Ältere Medien konnten nicht geöffnet werden:','Bu eski ek, ortak görüntülemeye geçirmek için bir cihazdaki eski anahtara ihtiyaç duyuyor.':'Dieser ältere Anhang benötigt den alten Schlüssel eines Geräts für die gemeinsame Anzeige.','desteklenmeyen dosya türü.':'nicht unterstützter Dateityp.','video 50 MB sınırını aşıyor.':'Video überschreitet das Limit von 50 MB.','görsel sıkıştırma öncesi 100 MB sınırını aşıyor.':'Bild überschreitet vor der Komprimierung das Limit von 100 MB.','sıkıştırılmış görsel 25 MB sınırını aşıyor.':'Komprimiertes Bild überschreitet das Limit von 25 MB.','İzin önceliği: üye → üye rolleri → @everyone → rol varsayılanı.':'Berechtigungsreihenfolge: Mitglied → Mitgliederrollen → @everyone → Rollenstandard.','İzin hedefi':'Berechtigungsziel','Üye:':'Mitglied:','AVEN ROZET BİLDİRİMİ':'AVEN-ABZEICHENHINWEIS','ŞU AN':'JETZT','sunucusuna katıldın.':'dem Server beigetreten.'
});
Object.assign(TRANSLATIONS.en, {
  'Bildirimler':'Notifications','GELEN KUTUSU':'INBOX','Burada yeni bir şey yok.':'Nothing new here.','Bir kullanıcı':'A user',
  'Ortak arkadaşınız yok.':'You have no mutual friends.','Ortak sunucu':'Mutual server','Ortak sunucunuz yok.':'You have no mutual servers.','Ortak sunucu yok':'No mutual servers','Tümünü gör':'See all',
  'ORTAK SUNUCU':'MUTUAL SERVER','ORTAK SUNUCULAR':'MUTUAL SERVERS','PROFİL ÖZETİ':'PROFILE SUMMARY','ORTAK ARKADAŞ':'MUTUAL FRIEND',
  'Profil etkinliği':'Profile activity','Aven resmi hesabı.':'The official Aven account.','Henüz bir şey yazılmamış.':'Nothing here yet.',
});
Object.assign(TRANSLATIONS.de, {
  'Bildirimler':'Benachrichtigungen','GELEN KUTUSU':'POSTEINGANG','Burada yeni bir şey yok.':'Hier gibt es nichts Neues.','Bir kullanıcı':'Ein Nutzer',
  'Ortak arkadaşınız yok.':'Ihr habt noch keine gemeinsamen Freunde.','Ortak sunucu':'Gemeinsamer Server','Ortak sunucunuz yok.':'Ihr habt keine gemeinsamen Server.','Ortak sunucu yok':'Keine gemeinsamen Server','Tümünü gör':'Alle ansehen',
  'ORTAK SUNUCU':'GEMEINSAMER SERVER','ORTAK SUNUCULAR':'GEMEINSAME SERVER','PROFİL ÖZETİ':'PROFILÜBERSICHT','ORTAK ARKADAŞ':'GEMEINSAMER FREUND',
  'Profil etkinliği':'Profilaktivität','Aven resmi hesabı.':'Das offizielle Aven-Konto.','Henüz bir şey yazılmamış.':'Hier steht noch nichts.',
});
Object.assign(TRANSLATIONS.en, {
  'Bir arama başlat':'Start a call','Not ekle':'Add note','Notu düzenle':'Edit note','Sadece sana görünür':'Only visible to you','Arkadaş takma adı ekle':'Add friend nickname','Takma adı düzenle':'Edit nickname','Not':'Note','Takma ad':'Nickname','Bu not yalnızca sana görünür.':'This note is only visible to you.','Bu takma ad yalnızca senin DM görünümünde kullanılır.':'This nickname is only used in your DM view.','Notunu yalnızca sen görebilirsin.':'Only you can see your note.','Not ekli · sadece sana görünür':'Note added · only visible to you','Temizle':'Clear',
  'Sunucu veya kanal ara':'Search servers or channels','Sunucu veya kanal bulunamadı.':'No servers or channels found.','Sunucular ve kanallar aranıyor…':'Searching servers and channels…','Sunucu':'Server','Kanal':'Channel','Ses kanalı':'Voice channel','Metin kanalı':'Text channel'
});
Object.assign(TRANSLATIONS.de, {
  'Bir arama başlat':'Anruf starten','Not ekle':'Notiz hinzufügen','Notu düzenle':'Notiz bearbeiten','Sadece sana görünür':'Nur für dich sichtbar','Arkadaş takma adı ekle':'Spitznamen hinzufügen','Takma adı düzenle':'Spitznamen bearbeiten','Not':'Notiz','Takma ad':'Spitzname','Bu not yalnızca sana görünür.':'Diese Notiz ist nur für dich sichtbar.','Bu takma ad yalnızca senin DM görünümünde kullanılır.':'Dieser Spitzname wird nur in deiner DM-Ansicht verwendet.','Notunu yalnızca sen görebilirsin.':'Nur du kannst deine Notiz sehen.','Not ekli · sadece sana görünür':'Notiz hinzugefügt · nur für dich sichtbar','Temizle':'Leeren',
  'Sunucu veya kanal ara':'Server oder Kanal suchen','Sunucu veya kanal bulunamadı.':'Keine Server oder Kanäle gefunden.','Sunucular ve kanallar aranıyor…':'Server und Kanäle werden gesucht…','Sunucu':'Server','Kanal':'Kanal','Ses kanalı':'Sprachkanal','Metin kanalı':'Textkanal'
});
Object.assign(TRANSLATIONS.en, { 'SANA ÖZEL NOT': 'YOUR PRIVATE NOTE' });
Object.assign(TRANSLATIONS.de, { 'SANA ÖZEL NOT': 'DEINE PRIVATE NOTIZ' });
Object.assign(TRANSLATIONS.en, {
  'Bu işlem geri alınamaz. Sunucuyu silmek istediğinden emin misin?':'This cannot be undone. Are you sure you want to delete this server?',
  'Silme işlemi bir onayla başlatılır ve geri alınamaz.':'Deletion starts after confirmation and cannot be undone.',
  'Üyeleri ayrı göster':'Display members separately','Bu role sahip üyeler üye listesinde ayrı başlık altında görünür.':'Members with this role appear in their own section in the member list.','Ayrı':'Separate','Rol ara':'Search roles','Roller':'Roles',
  'Mesajı herkesten sil':'Delete message for everyone','Bu mesaj sohbetten ve ekli dosyasından herkesten silinsin mi?':'Delete this message and its attachment for everyone?','Mesaj silindi.':'Message deleted.'
});
Object.assign(TRANSLATIONS.de, {
  'Bu işlem geri alınamaz. Sunucuyu silmek istediğinden emin misin?':'Dies kann nicht rückgängig gemacht werden. Möchtest du diesen Server wirklich löschen?',
  'Silme işlemi bir onayla başlatılır ve geri alınamaz.':'Das Löschen beginnt nach Bestätigung und kann nicht rückgängig gemacht werden.',
  'Üyeleri ayrı göster':'Mitglieder separat anzeigen','Bu role sahip üyeler üye listesinde ayrı başlık altında görünür.':'Mitglieder mit dieser Rolle werden in einem eigenen Abschnitt der Mitgliederliste angezeigt.','Ayrı':'Separat','Rol ara':'Rollen suchen','Roller':'Rollen',
  'Mesajı herkesten sil':'Nachricht für alle löschen','Bu mesaj sohbetten ve ekli dosyasından herkesten silinsin mi?':'Diese Nachricht und ihren Anhang für alle löschen?','Mesaj silindi.':'Nachricht gelöscht.'
});
Object.assign(TRANSLATIONS.en, {
  'Mesajı Düzenle':'Edit message','Yanıtla':'Reply','İlet':'Forward','Metni Kopyala':'Copy text','Mesajı herkesten sil':'Delete for everyone',
  'Mesajı ilet':'Forward message','Mesajı göndermek istediğin DM sohbetini seç.':'Choose a DM conversation to send this message to.','İletilecek uygun bir sohbet bulunamadı.':'No eligible conversation is available.','Mesaj metni kopyalandı.':'Message text copied.','Metin panoya kopyalanamadı.':'Could not copy the text.','Mesaj iletildi.':'Message forwarded.','İletilen mesaj için mesaj isteği gönderildi.':'Message request sent with the forwarded message.','Mesaj işlemleri':'Message actions','DM mesajına çift tıklayarak işlem menüsünü açabilirsin.':'Double-click a DM message to open its action menu.'
});
Object.assign(TRANSLATIONS.de, {
  'Mesajı Düzenle':'Nachricht bearbeiten','Yanıtla':'Antworten','İlet':'Weiterleiten','Metni Kopyala':'Text kopieren','Mesajı herkesten sil':'Für alle löschen',
  'Mesajı ilet':'Nachricht weiterleiten','Mesajı göndermek istediğin DM sohbetini seç.':'Wähle einen Direktchat aus, an den du diese Nachricht senden möchtest.','İletilecek uygun bir sohbet bulunamadı.':'Kein geeigneter Chat zum Weiterleiten gefunden.','Mesaj metni kopyalandı.':'Nachrichtentext kopiert.','Metin panoya kopyalanamadı.':'Der Text konnte nicht kopiert werden.','Mesaj iletildi.':'Nachricht weitergeleitet.','İletilen mesaj için mesaj isteği gönderildi.':'Nachrichtenanfrage mit der weitergeleiteten Nachricht gesendet.','Mesaj işlemleri':'Nachrichtenaktionen','DM mesajına çift tıklayarak işlem menüsünü açabilirsin.':'Doppelklicke auf eine DM-Nachricht, um das Aktionsmenü zu öffnen.'
});
Object.assign(TRANSLATIONS.en, {
  'Kayıt için 3-7 karakter; harf, rakam, _ ve . kullanılabilir.':'Use 3–7 characters for your username: letters, numbers, _ and . are allowed.',
  'Kayıtta görünen ad en fazla 8 karakter olabilir.':'Your display name can be up to 8 characters during sign-up.',
  'Kayıt sırasında görünen ad en fazla 8 karakter olmalı.':'Your display name can be up to 8 characters during sign-up.',
  'Kayıt sırasında kullanıcı adı en fazla 7 karakter olmalı.':'Your username can be up to 7 characters during sign-up.',
  'Üyeler bu rolü kendileri ekleyebilsin':'Members can assign this role to themselves','Üyeler yalnızca sunucu veya kanal izni vermeyen rolleri kendileri seçebilir.':'Members can only self-assign roles without server or channel permissions.','Üyeler kendileri seçebilir':'Members can self-assign',
  'Kendisi seçebilen roller sunucu izni taşıyamaz.':'Self-assignable roles cannot have server permissions.','Kendisi seçebilen rollere kanal izni eklenemez.':'Channel permissions cannot be added to self-assignable roles.','Kendisi seçebilen roller sunucu veya kanal izni taşıyamaz.':'Self-assignable roles cannot have server or channel permissions.','Bu rol kendin tarafından seçilemiyor.':'You cannot assign this role to yourself.','Bu rolü kendin kaldıramazsın.':'You cannot remove this role yourself.','Önce kendin seçebilen rolü üyelerden kaldırın.':'Remove this self-assignable role from members before disabling it.',
  'Arkadaşsınız':'Friends'
});
Object.assign(TRANSLATIONS.de, {
  'Kayıt için 3-7 karakter; harf, rakam, _ ve . kullanılabilir.':'Verwende für den Benutzernamen 3–7 Zeichen: Buchstaben, Zahlen, _ und . sind erlaubt.',
  'Kayıtta görünen ad en fazla 8 karakter olabilir.':'Dein Anzeigename darf bei der Registrierung höchstens 8 Zeichen lang sein.',
  'Kayıt sırasında görünen ad en fazla 8 karakter olmalı.':'Dein Anzeigename darf bei der Registrierung höchstens 8 Zeichen lang sein.',
  'Kayıt sırasında kullanıcı adı en fazla 7 karakter olmalı.':'Dein Benutzername darf bei der Registrierung höchstens 7 Zeichen lang sein.',
  'Üyeler bu rolü kendileri ekleyebilsin':'Mitglieder können diese Rolle selbst auswählen','Üyeler yalnızca sunucu veya kanal izni vermeyen rolleri kendileri seçebilir.':'Mitglieder können nur Rollen ohne Server- oder Kanalberechtigungen selbst auswählen.','Üyeler kendileri seçebilir':'Selbst auswählbar',
  'Kendisi seçebilen roller sunucu izni taşıyamaz.':'Selbst auswählbare Rollen können keine Serverberechtigungen haben.','Kendisi seçebilen rollere kanal izni eklenemez.':'Selbst auswählbaren Rollen können keine Kanalberechtigungen hinzugefügt werden.','Kendisi seçebilen roller sunucu veya kanal izni taşıyamaz.':'Selbst auswählbare Rollen können keine Server- oder Kanalberechtigungen haben.','Bu rol kendin tarafından seçilemiyor.':'Du kannst diese Rolle nicht selbst auswählen.','Bu rolü kendin kaldıramazsın.':'Du kannst diese Rolle nicht selbst entfernen.','Önce kendin seçebilen rolü üyelerden kaldırın.':'Entferne diese selbst auswählbare Rolle zuerst von allen Mitgliedern.',
  'Arkadaşsınız':'Freunde'
});
Object.assign(TRANSLATIONS.en, {
  'Geliştirici':'Developer','GELİŞTİRİCİ':'DEVELOPER','Geliştirici modu':'Developer Mode','Geliştirici Modu':'Developer Mode',
  'Geliştirici modu, kullanıcı ve sunucu kimliklerini sağ tık menülerinden kopyalama seçeneklerini açar.':'Developer Mode adds copy ID actions to user and server context menus.',
  'Kimlikleri uygulama içindeki menülerden kopyalamak için geliştirici modunu aç.':'Enable Developer Mode to copy IDs from menus in the app.',
  'Sağ tık menülerinde kullanıcı, sunucu ve kanal ID’sini kopyalama seçeneklerini göster.':'Show options to copy user, server, and channel IDs in right-click menus.',
  'Bu özellik açıkken kullanıcı ve sunucu menülerinde kimlik kopyalama seçenekleri görünür.':'When enabled, user and server menus show copy ID actions.',
  'Kullanıcı ID’si':'User ID','Kullanıcı ID\'sini kopyala':'Copy User ID','Kullanıcı ID\'sini Kopyala':'Copy User ID',
  'Modu açınca kendi ID’ni ve diğer kimlikleri kopyalayabilirsin.':'Enable the mode to copy your ID and other IDs.',
  'Kimlik panoya kopyalanamadı.':'Could not copy the ID to the clipboard.','Kimlik bulunamadı.':'ID not found.','Kullanıcı ID’si kopyalandı.':'User ID copied.','Sunucu ID’si kopyalandı.':'Server ID copied.','Kanal kimliği kopyalandı.':'Channel ID copied.',
  'Kanal kimliğini kopyala':'Copy Channel ID','Sunucu ID’sini kopyala':'Copy Server ID','Sunucudan Ayrıl':'Leave Server'
});
Object.assign(TRANSLATIONS.de, {
  'Geliştirici':'Entwickler','GELİŞTİRİCİ':'ENTWICKLER','Geliştirici modu':'Entwicklermodus','Geliştirici Modu':'Entwicklermodus',
  'Geliştirici modu, kullanıcı ve sunucu kimliklerini sağ tık menülerinden kopyalama seçeneklerini açar.':'Der Entwicklermodus fügt Optionen zum Kopieren von Benutzer- und Server-IDs in Kontextmenüs hinzu.',
  'Kimlikleri uygulama içindeki menülerden kopyalamak için geliştirici modunu aç.':'Aktiviere den Entwicklermodus, um IDs aus den Menüs der App zu kopieren.',
  'Sağ tık menülerinde kullanıcı, sunucu ve kanal ID’sini kopyalama seçeneklerini göster.':'Zeigt Optionen zum Kopieren von Benutzer-, Server- und Kanal-IDs in Kontextmenüs an.',
  'Bu özellik açıkken kullanıcı ve sunucu menülerinde kimlik kopyalama seçenekleri görünür.':'Bei aktiviertem Modus zeigen Benutzer- und Servermenüs Optionen zum Kopieren von IDs.',
  'Kullanıcı ID’si':'Benutzer-ID','Kullanıcı ID\'sini kopyala':'Benutzer-ID kopieren','Kullanıcı ID\'sini Kopyala':'Benutzer-ID kopieren',
  'Modu açınca kendi ID’ni ve diğer kimlikleri kopyalayabilirsin.':'Aktiviere den Modus, um deine ID und andere IDs zu kopieren.',
  'Kimlik panoya kopyalanamadı.':'Die ID konnte nicht in die Zwischenablage kopiert werden.','Kimlik bulunamadı.':'ID nicht gefunden.','Kullanıcı ID’si kopyalandı.':'Benutzer-ID kopiert.','Sunucu ID’si kopyalandı.':'Server-ID kopiert.','Kanal kimliği kopyalandı.':'Kanal-ID kopiert.',
  'Kanal kimliğini kopyala':'Kanal-ID kopieren','Sunucu ID’sini kopyala':'Server-ID kopieren','Sunucudan Ayrıl':'Server verlassen'
});
Object.assign(TRANSLATIONS.en, {
  'Yayını Durdur':'Stop Stream','Yayını Değiştir':'Change Stream','Yayın Kalitesi':'Stream Quality',
  'Kare Hızı':'Frame Rate','Çözünürlük':'Resolution','Yayın Sesini Paylaş':'Share Stream Audio',
  'Yayın sesi için konuşma izni gerekir.':'Speaking permission is required to share stream audio.',
  'Sistem veya sekme sesini paylaş':'Share system or tab audio','Yayın sesi paylaşılıyor.':'Stream audio is being shared.',
  'Yayın sesi kapatıldı.':'Stream audio was turned off.','Yayın Kalitesi:':'Stream Quality:',
  'uygulandı.':'applied.','Bu ekran seçimi ses izi sağlamadı; yayın sesi kapalı başladı.':'This capture did not provide an audio track, so stream audio started off.',
  'Yeni kaynakta ses yakalanmadı; yayın sesi kapalı kaldı.':'The new source provided no audio, so stream audio remains off.',
  'Bu aramada yayın sesi paylaşma iznin yok.':'You do not have permission to share audio in this call.',
  'Önce yayını başlat.':'Start streaming first.','Etkin bir yayın bulunamadı.':'No active stream found.'
});
Object.assign(TRANSLATIONS.de, {
  'Yayını Durdur':'Stream beenden','Yayını Değiştir':'Stream wechseln','Yayın Kalitesi':'Streamqualität',
  'Kare Hızı':'Bildrate','Çözünürlük':'Auflösung','Yayın Sesini Paylaş':'Stream-Audio teilen',
  'Yayın sesi için konuşma izni gerekir.':'Zum Teilen des Stream-Audios ist eine Sprechberechtigung erforderlich.',
  'Sistem veya sekme sesini paylaş':'System- oder Tab-Audio teilen','Yayın sesi paylaşılıyor.':'Stream-Audio wird geteilt.',
  'Yayın sesi kapatıldı.':'Stream-Audio wurde ausgeschaltet.','Yayın Kalitesi:':'Streamqualität:',
  'uygulandı.':'angewendet.','Bu ekran seçimi ses izi sağlamadı; yayın sesi kapalı başladı.':'Diese Aufnahmequelle liefert keine Audiospur. Stream-Audio wurde ausgeschaltet.',
  'Yeni kaynakta ses yakalanmadı; yayın sesi kapalı kaldı.':'Die neue Quelle liefert kein Audio. Stream-Audio bleibt ausgeschaltet.',
  'Bu aramada yayın sesi paylaşma iznin yok.':'Du darfst in diesem Anruf kein Audio teilen.',
  'Önce yayını başlat.':'Starte zuerst einen Stream.','Etkin bir yayın bulunamadı.':'Kein aktiver Stream gefunden.'
});
const BADGE_TRANSLATIONS = {
  tr: { 'Aven Early Supporter': 'Aven\'in İlk Destekçisi', 'Aven Official': 'Resmi Aven', 'Verified Bot Developer': 'Doğrulanmış Bot Geliştiricisi', Admin: 'Yönetici' },
  en: { 'Aven Early Supporter': 'Aven Early Supporter', 'Aven Official': 'Aven Official', 'Verified Bot Developer': 'Verified Bot Developer', Admin: 'Administrator' },
  de: { 'Aven Early Supporter': 'Früher Aven-Unterstützer', 'Aven Official': 'Offizielles Aven-Konto', 'Verified Bot Developer': 'Verifizierter Bot-Entwickler', Admin: 'Administrator' }
};
const NOTIFICATION_COPY = {
  tr: {
    'friend-request': 'sana arkadaşlık isteği gönderdi.',
    'friend-accepted': 'arkadaşlık isteğini kabul etti.',
    'friend-declined': 'arkadaşlık isteğini reddetti.',
    'dm-request': 'sana mesaj isteği gönderdi.',
    'dm-declined': 'mesaj isteğini reddetti.',
    'profile-update': 'profilini güncelledi.',
    fallback: 'profilini güncelledi.'
  },
  en: {
    'friend-request': 'sent you a friend request.',
    'friend-accepted': 'accepted your friend request.',
    'friend-declined': 'declined your friend request.',
    'dm-request': 'sent you a message request.',
    'dm-declined': 'declined your message request.',
    'profile-update': 'updated your profile.',
    fallback: 'updated your profile.'
  },
  de: {
    'friend-request': 'hat dir eine Freundschaftsanfrage gesendet.',
    'friend-accepted': 'hat deine Freundschaftsanfrage angenommen.',
    'friend-declined': 'hat deine Freundschaftsanfrage abgelehnt.',
    'dm-request': 'hat dir eine Nachrichtenanfrage gesendet.',
    'dm-declined': 'hat deine Nachrichtenanfrage abgelehnt.',
    'profile-update': 'hat dein Profil aktualisiert.',
    fallback: 'hat dein Profil aktualisiert.'
  }
};
let uiLanguage = 'tr';
const localizationTextState = new WeakMap(), localizationAttributeState = new WeakMap();
const localeValue = () => LANGUAGE_LOCALES[uiLanguage] || LANGUAGE_LOCALES.tr;
function translateText(source, language = uiLanguage) {
  if (!source) return source;
  const badgeMap = BADGE_TRANSLATIONS[language] || {};
  const sourceText = String(source), trimmedSource = sourceText.trim(), exactBadge = badgeMap[trimmedSource];
  if (exactBadge) return sourceText.replace(trimmedSource, exactBadge);
  if (language === 'tr') {
    let output = sourceText;
    for (const [name, translated] of Object.entries(badgeMap)) {
      const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      output = output.replace(new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, 'giu'), translated);
    }
    return output;
  }
  const map = TRANSLATIONS[language];
  const trimmed = String(source).trim();
  if (!trimmed) return source;
  const direct = map[trimmed];
  if (direct) return source.replace(trimmed, direct);
  for (const [turkish, translated] of Object.entries(map)) {
    if (translated === trimmed) return source.replace(trimmed, turkish);
  }
  let output = String(source);
  const keys = Object.keys(map).sort((a, b) => b.length - a.length);
  for (const key of keys) {
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    output = output.replace(new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, 'giu'), map[key]);
  }
  return output;
}
const LOCALIZATION_USER_TEXT = 'script,style,textarea,[contenteditable="true"],[data-notification-title],.dm-search-result-title,.dm-search-result-subtitle,.guild-member-name,.guild-member-username,.guild-member-role,.guild-channel,.guild-voice-member span,.voice-person b,.voice-stream-label,.profile-tag-choice-copy small,.server-tag-preview-name>span:first-child,.server-tag-preview-body h3,.dm-server,.dm-profile-handle,.guild-tag-chip b,.device-account b,.device-account small,.msg .mt,.guild-message>div:not(header)';
const LOCALIZATION_DYNAMIC_ATTRIBUTES = 'script,style,[data-notification-title],.dm-search-result-title,.dm-search-result-subtitle,.guild-member-name,.guild-member-username,.guild-member-role,.guild-channel,.guild-voice-member span,.voice-person b,.voice-stream-label,.profile-tag-choice-copy small,.server-tag-preview-name>span:first-child,.server-tag-preview-body h3,.dm-server,.dm-profile-handle,.guild-tag-chip b,.device-account b,.device-account small,.msg .mt,.guild-message>div:not(header)';
function localizeTextNode(node) {
  if (!node.parentElement || node.parentElement.closest(LOCALIZATION_USER_TEXT)) return;
  const bio = node.parentElement.closest('.dm-profile-about p,.profile-about p,.bio');
  if (bio && !bio.querySelector('i')) return;
  const current = node.nodeValue;
  let state = localizationTextState.get(node);
  if (!state || current !== state.output) state = { source: current, output: current };
  const output = translateText(state.source);
  state.output = output; localizationTextState.set(node, state);
  if (current !== output) node.nodeValue = output;
}
function localizeElementAttributes(element) {
  if (element.matches(LOCALIZATION_DYNAMIC_ATTRIBUTES)) return;
  for (const name of ['title', 'aria-label', 'placeholder', 'alt']) {
    if (!element.hasAttribute(name)) continue;
    let states = localizationAttributeState.get(element);
    if (!states) { states = new Map(); localizationAttributeState.set(element, states); }
    const current = element.getAttribute(name), previous = states.get(name);
    const source = previous && current === previous.output ? previous.source : current;
    const output = translateText(source);
    states.set(name, { source, output });
    if (current !== output) element.setAttribute(name, output);
  }
}
function localizeTree(node = document.body) {
  if (node.nodeType === Node.TEXT_NODE) { localizeTextNode(node); return; }
  if (node.nodeType !== Node.ELEMENT_NODE && node !== document.body) return;
  if (node.nodeType === Node.ELEMENT_NODE) localizeElementAttributes(node);
  node.childNodes.forEach(localizeTree);
}
function applyLanguage(language = me?.language || 'tr', refreshVisible = false) {
  uiLanguage = ['tr', 'en', 'de'].includes(language) ? language : 'tr';
  document.documentElement.lang = uiLanguage;
  localizeTree(document.body);
  const inbox = $('.inbox-modal');
  if (inbox) drawInbox(inbox);
  if (refreshVisible && guildMode && currentGuild) renderGuildView();
  if (refreshVisible && view === 'chat' && active) {
    chatHeader();
    const panel = $('#dm-profile');
    if (panel) { panel.dataset.userId = ''; renderDmProfile(); }
  }
}
const localizationObserver = new MutationObserver(records => {
  for (const record of records) {
    if (record.type === 'characterData') localizeTextNode(record.target);
    else if (record.type === 'attributes') localizeElementAttributes(record.target);
    else record.addedNodes.forEach(localizeTree);
  }
});
if (document.body) { localizeTree(document.body); localizationObserver.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['title', 'aria-label', 'placeholder', 'alt'] }); }
const PRESENCE_LABELS = { online: 'Çevrimiçi', idle: 'Boşta', dnd: 'Rahatsız Etmeyin', invisible: 'Görünmez', offline: 'Çevrimdışı' };
let announcementQueue = [], announcementCurrentId = 0, announcementFetching = null, announcementShowing = false, announcementCloseTimer = 0, announcementUserId = 0;
// Uygulama açıkken geliştirici araçları ve kaynak görüntüleme kısayollarını engelle.
document.addEventListener('keydown', event => {
  const key = String(event.key || '').toLowerCase();
  const code = String(event.code || '').toLowerCase();
  const inspectKeys = ['keyi', 'keyj', 'keyc', 'keyk', 'keye', 'keym', 'keyp'];
  const pressedInspectKey = inspectKeys.includes(code) || ['i', 'ı', 'j', 'c', 'k', 'e', 'm', 'p'].includes(key);
  const devtools = event.key === 'F12' || (event.altKey && event.key === 'F12') || (event.ctrlKey && event.shiftKey && pressedInspectKey) ||
    ((event.metaKey || event.ctrlKey) && event.altKey && ['keyi', 'keyj', 'keyc'].includes(code)) ||
    ((event.ctrlKey || event.metaKey) && ['u', 'ü'].includes(key));
  if (devtools) { event.preventDefault(); event.stopImmediatePropagation(); }
}, true);

document.addEventListener('click', e => {
  const m = $('.me, .guild-user');
  if (!m) return;
  const menu = $('.account-menu', m), button = $('.me-p, [data-guild-profile]', m);
  if (!menu?.classList.contains('on') || m.contains(e.target)) return;
  menu.classList.remove('on'); menu.setAttribute('aria-hidden', 'true'); button.setAttribute('aria-expanded', 'false');
});
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  const submenu = $('.account-submenu.on'), parentMenu = $('.account-menu.on');
  if (submenu) {
    submenu.classList.remove('on');
    $('.status-toggle', parentMenu)?.setAttribute('aria-expanded', 'false');
    $('[data-account="switch"]', parentMenu)?.setAttribute('aria-expanded', 'false');
    return;
  }
  const menu = $('.account-menu.on'), button = $('.me-p, [data-guild-profile]');
  if (menu) { menu.classList.remove('on'); menu.setAttribute('aria-hidden', 'true'); button?.setAttribute('aria-expanded', 'false'); }
  $('.device-context')?.remove();
});
const fmt = t => { const d = new Date(t), tm = d.toLocaleTimeString(localeValue(), { hour: '2-digit', minute: '2-digit' }); return d.toDateString() === new Date().toDateString() ? tm : d.toLocaleDateString(localeValue()) + ' ' + tm; };
async function api(p, method = 'GET', body, signal) {
  const r = await fetch('/api' + p, { method, headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined, signal });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) { const error = new Error(d.error || 'Bir hata oluştu.'); error.code = d.code; throw error; }
  return d;
}
function toast(m, err, ms = 2600) { const t = document.createElement('div'); t.className = 'toast' + (err ? ' e' : ''); t.textContent = translateText(m); document.body.append(t); setTimeout(() => t.remove(), ms); return t; }
let bannedScreenShown = false;
async function showBannedScreen(message = 'Bu hesabın kullanımı kapatıldı.') {
  if (bannedScreenShown) return;
  bannedScreenShown = true;
  dmSearchCleanup?.(); dmSearchCleanup = null;
  es?.close(); clearInterval(poll);
  if (voiceSession) await leaveVoice(false, false).catch(() => {});
  me = null; document.documentElement.dataset.theme = 'dark';
  root.innerHTML = `<main class="account-banned-screen fade"><section class="account-banned-card"><div class="account-banned-mark" aria-hidden="true">✕</div><p class="account-banned-kicker">AVEN GÜVENLİK BİLDİRİMİ</p><h1>Hesabın kapatıldı</h1><p>${esc(message)}</p><small>Oturumun sonlandırıldı. Bu hesapla tekrar giriş yapılamaz. Bir hata olduğunu düşünüyorsan itiraz için destek talebi oluşturabilirsin.</small><a class="account-banned-action" href="/itiraz">Destek talebi oluştur <span aria-hidden="true">→</span></a></section></main>`;
}

function renderDeviceAccounts(el, accounts, currentId) {
  if (!el) return;
  if (el.classList.contains('known-accounts')) {
    el.hidden = !accounts.length;
    if (!accounts.length) { el.innerHTML = ''; return; }
  }
  el.innerHTML = accounts.length ? accounts.map(a => `<button type="button" class="device-account${a.id === currentId ? ' current' : ''}" data-device-account="${a.id}">
    ${a.avatar ? `<img src="${esc(a.avatar)}" alt="">` : `<i>${esc(a.displayName[0] || '?').toUpperCase()}</i>`}
    <span><b>${esc(a.displayName)}</b><small>@${esc(a.username)}${a.id === currentId ? ` · ${translateText('Bu hesap')}` : ''}</small></span><em>→</em>
  </button>`).join('') + (accounts.length < 2 ? '<button type="button" class="add-device-account" data-add-device-account><span>＋</span><b>Hesap ekle</b></button>' : '') : '<p class="device-accounts-empty">Bu bilgisayarda kayıtlı hesap yok.</p><button type="button" class="add-device-account" data-add-device-account><span>＋</span><b>Hesap ekle</b></button>';
}
async function refreshDeviceAccounts() {
  const targets = [...document.querySelectorAll('.known-accounts,.account-list')];
  if (!targets.length) return;
  const accounts = await api('/accounts');
  targets.forEach(el => renderDeviceAccounts(el, accounts, me?.id));
}
async function switchDeviceAccount(userId) {
  if (Number(userId) === me?.id) { toast('Bu hesap zaten açık.'); return; }
  const transition = splash('Hesabın değiştiriliyor', ['Güvenli bağlantı kuruluyor…', 'Profilin hazırlanıyor…', 'Sohbetlerin yükleniyor…'], true);
  try {
    if (voiceSession) await leaveVoice(false);
    me = await api('/accounts/switch', 'POST', { userId: Number(userId) });
    const friends = await getFr();
    es?.close(); clearInterval(poll); profId = null;
    await transition;
    await boot(false, friends);
  } catch (er) {
    await transition;
    try { me = await api('/me'); await boot(false); }
    catch { location.reload(); return; }
    toast(er.message, 1);
  }
}
document.addEventListener('contextmenu', e => {
  const row = e.target.closest('[data-device-account]');
  if (!row) return;
  e.preventDefault(); $('.device-context')?.remove();
  const menu = document.createElement('div');
  menu.className = 'device-context pop';
  menu.innerHTML = '<button type="button" data-remove-device-account>Bu bilgisayardan kaldır</button>';
  document.body.append(menu);
  menu.style.left = Math.max(8, Math.min(e.clientX, innerWidth - menu.offsetWidth - 8)) + 'px';
  menu.style.top = Math.max(8, Math.min(e.clientY, innerHeight - menu.offsetHeight - 8)) + 'px';
  menu.dataset.userId = row.dataset.deviceAccount;
});
document.addEventListener('contextmenu', e => {
  if (!e.target.closest('[data-device-account],[data-uid],[data-dm-server],[data-channel],[data-guild],[data-self-context],[data-voice-share],[data-dm-call-share],.pk')) e.preventDefault();
});
document.addEventListener('contextmenu', e => {
  const target = e.target.closest('[data-self-context]');
  if (!target || !me?.developerMode) return;
  e.preventDefault(); e.stopPropagation();
  userContextMenu(e.clientX, e.clientY, me);
});
document.addEventListener('click', async e => {
  const remove = e.target.closest('[data-remove-device-account]');
  if (remove) {
    const menu = remove.closest('.device-context'), userId = menu.dataset.userId;
    remove.disabled = true;
    try {
      await api('/accounts/' + userId, 'DELETE');
      menu.remove();
      await refreshDeviceAccounts();
      toast('Hesap bu bilgisayardan kaldırıldı.');
    } catch (er) { menu.remove(); toast(er.message, 1); }
    return;
  }
  if (e.target.closest('.device-context')) return;
  $('.device-context')?.remove();
  const add = e.target.closest('[data-add-device-account]');
  if (add) {
    if (!me) {
      $('[name=login]', root)?.focus();
      toast('Eklemek istediğin hesapla giriş yapabilir veya kayıt olabilirsin.');
      return;
    }
    try {
      if (voiceSession) await leaveVoice(false);
      await api('/logout', 'POST');
      es?.close(); clearInterval(poll); me = null; document.documentElement.dataset.theme = 'dark';
      authScreen(false);
    } catch (er) { toast(er.message, 1); }
    return;
  }
  const account = e.target.closest('[data-device-account]');
  if (!account) return;
  try { await switchDeviceAccount(account.dataset.deviceAccount); }
  catch (er) { toast(er.message, 1); }
});
const byLast = (a, b) => (b.last?.createdAt || 0) - (a.last?.createdAt || 0);
const getFr = async () => { const d = await api('/friends'); d.friends.sort(byLast); d.conversations.sort(byLast); return d; };
const store = new Map();
const deletedDmMessageIds = new Set();
let animateBotWelcomeFor = 0;
const badgeMarks = u => {
  const badges = Array.isArray(u.badges) ? [...u.badges] : [];
  if (u.bot && !badges.some(badge => badge.file?.toLocaleLowerCase('tr') === 'aven official.png')) {
    badges.push({ file: 'Aven Official.png', name: 'Aven Official', image: '/rozetler/Aven%20Official.png' });
  }
  return badges.length
    ? `<span class="user-badge-marks" aria-label="Rozetler">${badges.map(badge => `<img src="${esc(badge.image || `/rozetler/${encodeURIComponent(badge.file || '')}`)}" alt="" title="${esc(badge.name || badge.file || 'Rozet')}">`).join('')}</span>`
    : '';
};
const badgeRow = u => badgeMarks(u) ? `<div class="profile-badge-row">${badgeMarks(u)}</div>` : '';
const dmDisplayName = u => u?.nickname || u?.displayName || '';
const tagPreview = u => `${u.bot ? '<span class="tag">Resmi</span>' : ''}${u.guildTag?.tag ? `<button type="button" class="guild-tag-chip guild-tag-preview-trigger" data-profile-tag-action="preview" data-server-id="${Number(u.guildTag.serverId) || 0}" title="${esc(u.guildTag.serverName)} sunucusunu göster" aria-label="${esc(u.guildTag.serverName)} sunucusunu göster" aria-expanded="false"><i>${serverTagBadgeIcon(u.guildTag.badge)}</i><b>${esc(u.guildTag.tag)}</b></button>` : ''}`;
const profileTag = u => {
  const isMe = Number(u.id) === Number(me?.id);
  const badge = u.guildTag?.tag
    ? `<button type="button" class="guild-tag-chip profile-guild-tag-trigger" data-profile-tag-action="${isMe ? 'pick' : 'preview'}" data-server-id="${Number(u.guildTag.serverId) || 0}" title="${isMe ? 'Sunucu etiketini değiştir' : `${esc(u.guildTag.serverName)} sunucusunu göster`}" aria-label="${isMe ? 'Sunucu etiketini değiştir' : `${esc(u.guildTag.serverName)} sunucusunu göster`}" aria-expanded="false"><i>${serverTagBadgeIcon(u.guildTag.badge)}</i><b>${esc(u.guildTag.tag)}</b></button>`
    : isMe ? '<button type="button" class="profile-guild-tag-add" data-profile-tag-action="pick" aria-expanded="false">＋ Sunucu etiketi</button>' : '';
  return `${u.bot ? '<span class="tag">Resmi</span>' : ''}${badge}`;
};
const TOUR = `<div class="tour-h"><span class="tl"></span><h4>Aven'e kısa bir bakış</h4><p>Beş adımda her şey elinin altında.</p></div><ol class="steps">${[
  ['Arkadaşlar', 'Kullanıcı adıyla arama yap, istek gönder, kabul et. Listen her zaman güncel kalır.'],
  ['Anlık mesajlaşma', 'Mesajlar sayfayı yenilemeden karşı tarafa ulaşır. DM mesajına çift tıklayarak işlem menüsünü açabilirsin.'],
  ['Dosya paylaşımı', 'Fotoğraf ve videolar sohbette iki cihaz arasında aktarılır; Aven sunucusunda tutulmaz.'],
  ['Profil', 'Profil resmi, banner ve hakkında yazısıyla kendini anlat. Arkadaşının adına tıklayıp profiline bak.'],
  ['Gizlilik', 'Bir kullanıcıya sağ tıklayıp engelleyebilirsin. Engellediklerini Ayarlar bölümünde görür ve kaldırırsın.']
].map(([t, d]) => `<li><b>${t}</b><span>${d}</span></li>`).join('')}</ol>`;
async function copyDeveloperIdentifier(label, value) {
  try {
    if (!value) throw new Error('Kimlik bulunamadı.');
    await navigator.clipboard.writeText(String(value));
    toast(`${label} kopyalandı.`);
  } catch (er) { toast(er.message === 'Kimlik bulunamadı.' ? er.message : 'Kimlik panoya kopyalanamadı.', 1); }
}
function ctxMenu(x, y, f) {
  if (!f) return;
  $('.ctx')?.remove();
  const m = document.createElement('div'); m.className = 'ctx pop';
  const hasConversation = fr.conversations.some(item => item.id === f.id) || fr.friends.some(item => item.id === f.id && item.last);
  const canPersonalize = !f.bot && f.id !== me.id && f.isFriend !== false;
  m.innerHTML = `<button data-a="profile">Profili gör</button>${canPersonalize ? `<button data-a="call">Bir arama başlat</button><div class="ctx-personal-action"><button data-a="note">${f.note ? 'Notu düzenle' : 'Not ekle'}</button><small>Sadece sana görünür</small></div><button data-a="nickname">${f.nickname ? 'Takma adı düzenle' : 'Arkadaş takma adı ekle'}</button>` : ''}${f.isFriend === false ? '<button data-a="add-friend">Arkadaş ekle</button>' : ''}<button data-a="dm">DM Mesaj Gönder</button>${hasConversation && !f.bot ? '<button class="danger" data-a="delete-dm">DM’i sil</button>' : ''}${f.bot || f.isFriend === false ? '' : '<button data-a="remove">Arkadaşlıktan çıkar</button>'}${f.bot ? '' : '<button class="danger" data-a="block">Engelle</button>'}${me?.developerMode && f.publicId ? `<div class="ctx-divider"></div><button data-a="copy-user-id">${uiIcon('copy')} Kullanıcı ID'sini kopyala</button>` : ''}`;
  document.body.append(m);
  m.style.left = Math.max(8, Math.min(x, innerWidth - m.offsetWidth - 8)) + 'px'; m.style.top = Math.max(8, Math.min(y, innerHeight - m.offsetHeight - 8)) + 'px';
  const close = () => { m.remove(); document.removeEventListener('click', close); document.removeEventListener('keydown', key); }, key = e => e.key === 'Escape' && close();
  setTimeout(() => { document.addEventListener('click', close); document.addEventListener('keydown', key); });
  m.onclick = async e => {
    const act = e.target.closest('[data-a]')?.dataset.a; if (!act) return;
    try {
      if (act === 'copy-user-id') await copyDeveloperIdentifier('Kullanıcı ID’si', f.publicId);
      else if (act === 'profile') profileModal(f.id);
      else if (act === 'dm') openDirectMessage(f.id);
      else if (act === 'call') startDmCall(f).catch(er => toast(er.message, 1));
      else if (act === 'note') editDmPersonalization(f, 'note');
      else if (act === 'nickname') editDmPersonalization(f, 'nickname');
      else if (act === 'add-friend') {
        await api('/friends/request', 'POST', { username: f.username });
        await loadFriends();
        toast('Arkadaşlık isteği gönderildi.');
      }
      else if (act === 'delete-dm') {
        await api('/conversations/' + f.id, 'DELETE');
        if (active === f.id) { active = null; view = 'chat'; renderMain(); }
        await loadFriends(); toast('DM yalnızca senin listenden kaldırıldı.');
      }
      else if (act === 'block' && confirm(`${f.displayName} engellensin mi? Arkadaşlığınız silinir ve birbirinize mesaj atamazsınız.`)) { await api('/blocks', 'POST', { userId: f.id }); await loadFriends(); toast('Kullanıcı engellendi'); }
      else if (act === 'remove' && confirm(`${f.displayName} arkadaşlıktan çıkarılsın mı?`)) { await api('/friends/' + f.fid, 'DELETE'); await loadFriends(); }
    } catch (er) { toast(er.message, 1); }
  };
}

async function editDmPersonalization(user, field) {
  let current;
  try { current = await api(`/users/${user.id}/personalization`); }
  catch (er) { toast(er.message, 1); return; }
  const editingNote = field === 'note';
  const title = editingNote ? (current.note ? 'Notu düzenle' : 'Not ekle') : (current.nickname ? 'Takma adı düzenle' : 'Arkadaş takma adı ekle');
  const label = editingNote ? 'Not' : 'Takma ad';
  const control = editingNote
    ? `<textarea name="value" maxlength="500" rows="5" placeholder="Notunu yalnızca sen görebilirsin.">${esc(current.note)}</textarea><small class="personal-note-private">Sadece sana görünür</small>`
    : `<input name="value" maxlength="32" value="${esc(current.nickname)}" placeholder="${esc(user.displayName)}" autocomplete="off">`;
  const { modal, close } = guildForm(`<h3>${title}</h3><p>${editingNote ? 'Bu not yalnızca senin hesabında görünür.' : 'Bu takma ad yalnızca senin DM görünümünde kullanılır.'}</p><label>${label}${control}</label><div class="guild-form-actions">${(editingNote ? current.note : current.nickname) ? '<button type="button" class="btn danger" data-clear-personal-field>Temizle</button>' : ''}<button type="button" class="btn" data-close>Vazgeç</button><button class="btn primary" type="submit">Kaydet</button></div>`, async (form, close) => {
    const value = String($('[name=value]', form).value || '').trim();
    const saved = await api(`/users/${user.id}/personalization`, 'PUT', { note: editingNote ? value : current.note, nickname: editingNote ? current.nickname : value });
    Object.assign(user, saved);
    await loadFriends(); close();
    const panel = $('#dm-profile'); if (Number(active) === Number(user.id) && panel) { panel.dataset.userId = ''; renderDmProfile(); }
    toast('Kaydedildi');
  });
  $('[data-close]', modal)?.addEventListener('click', close);
  $('[data-clear-personal-field]', modal)?.addEventListener('click', async event => {
    const button = event.currentTarget; button.disabled = true;
    try {
      const saved = await api(`/users/${user.id}/personalization`, 'PUT', { note: editingNote ? '' : current.note, nickname: editingNote ? current.nickname : '' });
      Object.assign(user, saved); await loadFriends(); close();
      const panel = $('#dm-profile'); if (Number(active) === Number(user.id) && panel) { panel.dataset.userId = ''; renderDmProfile(); }
      toast('Kaydedildi');
    } catch (er) { toast(er.message, 1); button.disabled = false; }
  });
}

function canManageMemberRoles(member) {
  if (!guildMode || !currentGuild || !member) return false;
  if (Number(member.id) === Number(me?.id)) return !!currentGuild.me.owner || currentGuild.roles.some(role => !role.everyone && role.selfAssignable && role.selfAssignableEligible && !role.permissions);
  if (Number(member.id) === Number(currentGuild.ownerId)) return false;
  const owner = currentGuild.me.owner, admin = !!(currentGuild.me.permissions & SERVER_ADMIN);
  if (!owner && !(currentGuild.me.permissions & 8)) return false;
  const actor = currentGuild.members.find(item => Number(item.id) === Number(me.id));
  const topPosition = item => Math.max(0, ...(item?.roleIds || []).map(id => { const role = currentGuild.roles.find(candidate => Number(candidate.id) === Number(id)); return role && !role.selfAssignable ? role.position : 0; }));
  const actorTop = topPosition(actor), targetTop = topPosition(member);
  return owner || admin || targetTop < actorTop;
}
function canBanServerMember(member) {
  if (!guildMode || !currentGuild || !member || Number(member.id) === Number(me?.id) || Number(member.id) === Number(currentGuild.ownerId)) return false;
  const owner = !!currentGuild.me.owner, admin = !!(currentGuild.me.permissions & SERVER_ADMIN);
  if (!owner && !admin) return false;
  if (owner) return true;
  const roleTop = item => Math.max(0, ...(item?.roleIds || []).map(id => {
    const role = currentGuild.roles.find(candidate => Number(candidate.id) === Number(id));
    return role && !role.selfAssignable ? Number(role.position) || 0 : 0;
  }));
  const actor = currentGuild.members.find(item => Number(item.id) === Number(me.id));
  return roleTop(member) < roleTop(actor);
}
function manageableMemberRoles(member) {
  if (!canManageMemberRoles(member)) return [];
  if (Number(member.id) === Number(me?.id)) return currentGuild.roles.filter(role => !role.everyone && (currentGuild.me.owner || role.selfAssignable && role.selfAssignableEligible && !role.permissions));
  const owner = currentGuild.me.owner, admin = !!(currentGuild.me.permissions & SERVER_ADMIN);
  const actor = currentGuild.members.find(item => Number(item.id) === Number(me.id));
  const actorTop = Math.max(0, ...(actor?.roleIds || []).map(id => { const role = currentGuild.roles.find(candidate => Number(candidate.id) === Number(id)); return role && !role.selfAssignable ? role.position : 0; }));
  return currentGuild.roles.filter(role => !role.everyone && (owner || admin || role.position < actorTop));
}
function userContextMenu(x, y, user) {
  $('.ctx')?.remove();
  const menu = document.createElement('div');
  menu.className = 'ctx pop';
  const isFriend = fr.friends.some(item => item.id === user.id);
  const guildTarget = currentGuild?.members.find(item => Number(item.id) === Number(user.id));
  const roleAction = canManageMemberRoles(guildTarget) ? '<button data-user-action="server-roles">Sunucu rollerini düzenle</button>' : '';
  const banAction = canBanServerMember(guildTarget) ? '<button class="danger" data-user-action="server-ban">Üyeyi yasakla</button>' : '';
  const isMe = Number(user.id) === Number(me.id);
  menu.innerHTML = `<button data-user-action="profile">Profili gör</button>${roleAction}${banAction}${isFriend || isMe ? '' : '<button data-user-action="friend">Arkadaş ekle</button>'}${isMe ? '' : '<button data-user-action="dm">DM Mesaj Gönder</button>'}${isMe || user.bot ? '' : '<button class="danger" data-user-action="block">Engelle</button>'}${me?.developerMode && user.publicId ? `<div class="ctx-divider"></div><button data-user-action="copy-user-id">${uiIcon('copy')} Kullanıcı ID'sini kopyala</button>` : ''}`;
  document.body.append(menu);
  if (x > innerWidth - 300) menu.classList.add('left-roles');
  menu.style.left = `${Math.max(8, Math.min(x, innerWidth - menu.offsetWidth - 8))}px`;
  menu.style.top = `${Math.max(8, Math.min(y, innerHeight - menu.offsetHeight - 8))}px`;
  const close = () => { menu.remove(); document.removeEventListener('click', outside); document.removeEventListener('keydown', key); };
  const outside = event => { if (!menu.contains(event.target)) close(); };
  const key = event => { if (event.key === 'Escape') close(); };
  setTimeout(() => { document.addEventListener('click', outside); document.addEventListener('keydown', key); });
  menu.onclick = async event => {
    const action = event.target.closest('[data-user-action]')?.dataset.userAction;
    if (!action) return;
    close();
    try {
      if (action === 'copy-user-id') await copyDeveloperIdentifier('Kullanıcı ID’si', user.publicId);
      else if (action === 'profile') guildTarget ? openServerMemberCard(user.id).catch(er => toast(er.message, 1)) : profileModal(user.id);
      else if (action === 'server-roles') memberRolesModal(Number(user.id));
      else if (action === 'server-ban') serverBanMemberModal(guildTarget);
      else if (action === 'dm') openDirectMessage(user.id);
      else if (action === 'friend') {
        await api('/friends/request', 'POST', { username: user.username });
        await loadFriends();
        toast('Arkadaşlık isteği gönderildi.');
      } else if (action === 'block' && confirm(`${user.displayName} engellensin mi?`)) {
        await api('/blocks', 'POST', { userId: user.id });
        await loadFriends();
        toast('Kullanıcı engellendi.');
      }
    } catch (er) { toast(er.message, 1); }
  };
}

function serverBanMemberModal(member) {
  if (!member || !canBanServerMember(member)) return toast('Bu üyeyi yasaklama yetkin yok.', 1);
  const serverId = Number(currentGuild.id), serverName = currentGuild.name;
  let reasonDraft = '';
  const { modal, close } = guildModal('<form class="guild-form server-ban-form"></form>', (root, close) => {
    const form = $('form', root);
    const showReason = () => {
      form.innerHTML = `<div class="server-ban-heading"><span aria-hidden="true">⌑</span><div><small>${esc(serverName)} · ÜYE YÖNETİMİ</small><h3>${esc(member.displayName)} üyesini yasakla</h3><p>Bu işlem yalnızca bu sunucuya erişimi kaldırır.</p></div></div>
        <label>Yasaklama nedeni<textarea name="reason" rows="4" maxlength="500" minlength="3" required placeholder="Örneğin: Topluluk kurallarını tekrar tekrar ihlal etti.">${esc(reasonDraft)}</textarea><small>Bu neden sunucu yöneticileri tarafından görülebilir.</small></label>
        <div class="guild-form-actions"><button type="button" class="btn" data-close>Vazgeç</button><button type="submit" class="btn danger">Devam et</button></div>`;
      const input = $('[name=reason]', form);
      $('[data-close]', form).onclick = close;
      form.onsubmit = event => {
        event.preventDefault();
        reasonDraft = input.value.trim();
        if (reasonDraft.length < 3 || reasonDraft.length > 500) { input.setCustomValidity('Neden 3-500 karakter olmalı.'); input.reportValidity(); input.setCustomValidity(''); return; }
        showReview();
      };
    };
    const showReview = () => {
      form.innerHTML = `<div class="server-ban-confirm"><span aria-hidden="true">!</span><small>SON ONAY</small><h3>${esc(member.displayName)} sunucudan çıkarılacak</h3><p><b>${esc(serverName)}</b> sunucusuna erişimi kapatılacak. Bu hesap Aven'den veya diğer sunuculardan etkilenmez.</p><div class="server-ban-reason-preview"><small>YASAKLAMA NEDENİ</small><p>${esc(reasonDraft)}</p></div><div class="guild-form-actions"><button type="button" class="btn" data-ban-back>Geri dön</button><button type="button" class="btn danger" data-ban-confirm>Yasaklamayı onayla</button></div></div>`;
      $('[data-ban-back]', form).onclick = showReason;
      $('[data-ban-confirm]', form).onclick = async event => {
        const button = event.currentTarget; button.disabled = true;
        try {
          await api(`/servers/${serverId}/bans`, 'POST', { userId: member.id, reason: reasonDraft });
          close();
          await reloadGuild(serverId);
          toast(`${member.displayName} bu sunucudan yasaklandı.`);
        } catch (er) { toast(er.message, 1); button.disabled = false; }
      };
    };
    showReason();
  });
}
function serverBanContextMenu(event, serverId, member, onUnbanned) {
  event.preventDefault(); event.stopPropagation();
  $('.server-ban-context')?.remove();
  const menu = document.createElement('div'); menu.className = 'ctx pop server-ban-context';
  menu.innerHTML = '<button class="danger" data-server-ban-unban>Banı kaldır</button>';
  document.body.append(menu);
  menu.style.left = `${Math.max(8, Math.min(event.clientX, innerWidth - menu.offsetWidth - 8))}px`;
  menu.style.top = `${Math.max(8, Math.min(event.clientY, innerHeight - menu.offsetHeight - 8))}px`;
  const close = () => { menu.remove(); document.removeEventListener('click', outside); document.removeEventListener('keydown', key); };
  const outside = e => { if (!menu.contains(e.target)) close(); }, key = e => { if (e.key === 'Escape') close(); };
  setTimeout(() => { document.addEventListener('click', outside); document.addEventListener('keydown', key); });
  $('[data-server-ban-unban]', menu).onclick = async () => {
    const button = $('[data-server-ban-unban]', menu); button.disabled = true;
    try {
      await api(`/servers/${serverId}/bans/${member.id}`, 'DELETE');
      close(); onUnbanned?.();
      toast(`Yasak kaldırıldı. ${member.displayName} yeniden davetle katılabilir; sunucu kanalına bildirim gönderilmedi.`);
    } catch (er) { toast(er.message, 1); button.disabled = false; }
  };
}

let build, beat = 0, profId = null, poll, me, fr = { friends: [], incoming: [], outgoing: [], conversations: [], messageRequests: [] }, notifications = [], active = null, view = 'chat', tab = 'friends', unread = {}, seen = new Set(), es, firstOpen = true, dmSearchCleanup = null;
const SERVER_PERMS = [
  [1, 'Kanalı görüntüle'], [2, 'Mesaj gönder'], [4, 'Kanal yönet'], [8, 'Rol yönet'],
  [16, 'Mesaj yönet'], [32, 'Ses kanalına bağlan'], [64, 'Konuş'], [128, 'Sunucu yönet'], [256, 'Davet oluştur'],
  [512, 'Fotoğraf yükle']
];
const SERVER_ADMIN = 1024;
let guildMode = false, guilds = [], currentGuild = null, currentGuildId = null, currentGuildChannel = null, guildMessageIds = new Set(), guildRouteToken = 0, guildChannelToken = 0;
let renderedGuildId = null, renderedGuildChannelId = null, renderedMainView = null, renderedMainActive = null, renderedSideTab = null;
const sideListScroll = new Map();
let serverMemberPopoverCleanup = null;
let voiceSession = null, voiceStream = null, screenStream = null, voiceHeartbeatTimer = null, voiceActivityTimer = null, voiceAudioContext = null, voicePlaybackContext = null, voiceAnalyser = null, voiceMembers = [], voicePeers = new Map(), voiceSignalQueues = new Map(), pendingVoiceSignals = [], voiceVideoStreams = new Map(), voiceRemoteAudioTracks = new Map(), voiceRemoteShareStreamIds = new Map(), voiceWatchedStreams = new Set(), voiceExpandedStreams = new Set(), voiceSpeaking = false, voiceStreaming = false, voiceJoining = false, voiceAttemptId = 0, audioDeviceChangeBound = false, voiceAudioUnlockBound = false;
let watchTogetherSession = null, togetherPlayer = null, togetherPlayerReady = false, togetherPlayerSessionId = '', togetherPlayerInitSessionId = '', togetherPlayerGeneration = 0, togetherJoined = false, togetherSyncTimer = null, togetherApiPromise = null, instagramEmbedPromise = null, togetherApplyingRemote = false;
let incomingDmCall = null, dmCallSignalQueue = Promise.resolve(), dmCallElapsedTimer = null, dmCallMinimized = false, dmCallStartedAt = 0, dmCallStarting = false;
const APP_SOUND_PATHS = {
  action: '/bildirimsesleri/arama%C3%B6zelliklerinia%C3%A7%C4%B1pkapama-bildirimi.mp3',
  call: '/bildirimsesleri/aramasesi-bildirimi.mp3',
  message: '/bildirimsesleri/mesajgelme-bildirimi.mp3',
  voice: '/bildirimsesleri/sesebirigelince-bildirimi.mp3'
};
const appSoundPlayers = new Map();
let messageSoundTimer = null, voiceSoundTimer = null, incomingCallTimeout = null;
function playAppSound(kind, { coalesce = false } = {}) {
  if (coalesce && kind === 'message') { clearTimeout(messageSoundTimer); messageSoundTimer = setTimeout(() => playAppSound(kind), 420); return; }
  if (coalesce && kind === 'voice') { clearTimeout(voiceSoundTimer); voiceSoundTimer = setTimeout(() => playAppSound(kind), 500); return; }
  const src = APP_SOUND_PATHS[kind]; if (!src) return;
  let audio = appSoundPlayers.get(kind);
  if (!audio) { audio = new Audio(src); audio.preload = 'auto'; appSoundPlayers.set(kind, audio); }
  try { audio.pause(); audio.currentTime = 0; audio.volume = 0.72; audio.play().catch(() => {}); } catch {}
}
document.addEventListener('pointerdown', () => appSoundPlayers.forEach(audio => audio.load()), { once: true, passive: true });
const screenShareOptions = { source: 'screen', fps: 30, width: 1280, height: 720, audio: false };
const voiceIceServers = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun.cloudflare.com:3478' },
  { urls: 'stun:stun1.l.google.com:19302' }
];
let voiceIceConfigLoaded = false, voiceIceConfigPromise = null;
async function loadVoiceIceConfig() {
  if (voiceIceConfigLoaded) return;
  if (!voiceIceConfigPromise) {
    voiceIceConfigPromise = api('/rtc-config').then(config => {
      const servers = Array.isArray(config?.iceServers) ? config.iceServers.filter(server => {
        const urls = Array.isArray(server?.urls) ? server.urls : [server?.urls];
        return urls.some(url => typeof url === 'string' && /^(?:stun|stuns|turn|turns):/i.test(url));
      }) : [];
      const hasTurn = servers.some(server => {
        const urls = Array.isArray(server.urls) ? server.urls : [server.urls];
        return urls.some(url => /^turns?:/i.test(url));
      });
      if (!servers.length) throw new Error('Ses sunucusu geçerli ICE ayarları göndermedi.');
      if (!hasTurn) throw new Error('TURN aktarım ayarı alınamadı. Sunucunun .env ve /api/rtc-config ayarını kontrol et.');
      voiceIceServers.splice(0, voiceIceServers.length, ...servers);
      voiceIceConfigLoaded = true;
    }).finally(() => { voiceIceConfigPromise = null; });
  }
  return voiceIceConfigPromise;
}
let dmMediaDbPromise = null;
function dmMediaDb() {
  if (!dmMediaDbPromise) dmMediaDbPromise = new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) return reject(new Error('Bu tarayıcı yerel DM medya saklamayı desteklemiyor.'));
    const request = indexedDB.open('aven-dm-media', 1);
    request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains('attachments')) request.result.createObjectStore('attachments', { keyPath: 'id' }); };
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction('attachments', 'readwrite'), store = tx.objectStore('attachments'), cursor = store.openCursor();
      cursor.onsuccess = () => { const item = cursor.result; if (!item) return; if (!item.value?.key || !item.value?.iv) item.delete(); item.continue(); };
      resolve(db);
    };
    request.onerror = () => reject(request.error || new Error('Yerel medya alanı açılamadı.'));
  });
  return dmMediaDbPromise;
}
async function dmMediaGet(id) {
  const db = await dmMediaDb();
  return new Promise((resolve, reject) => {
    const request = db.transaction('attachments').objectStore('attachments').get(id);
    request.onsuccess = async () => {
      const value = request.result || null;
      if (value && (!value.key || !value.iv || (value.owner && value.owner !== me?.id))) { await dmMediaDelete(id).catch(() => {}); resolve(null); }
      else resolve(value);
    };
    request.onerror = () => reject(request.error);
  });
}
async function dmMediaPut(record) {
  const db = await dmMediaDb();
  return new Promise((resolve, reject) => { const request = db.transaction('attachments', 'readwrite').objectStore('attachments').put(record); request.onsuccess = () => resolve(); request.onerror = () => reject(request.error); });
}
async function dmMediaDelete(id) {
  const db = await dmMediaDb();
  return new Promise((resolve, reject) => { const request = db.transaction('attachments', 'readwrite').objectStore('attachments').delete(id); request.onsuccess = () => resolve(); request.onerror = () => reject(request.error); });
}
const mediaToBase64 = bytes => {
  let binary = ''; for (const byte of new Uint8Array(bytes)) binary += String.fromCharCode(byte);
  return btoa(binary);
};
const mediaFromBase64 = value => Uint8Array.from(atob(value), char => char.charCodeAt(0));
async function compressDmImage(file) {
  if (!file.type.startsWith('image/') || file.type === 'image/gif' || !('createImageBitmap' in window)) return file;
  let bitmap;
  try { bitmap = await createImageBitmap(file); } catch { return file; }
  try {
    const scale = Math.min(1, 1920 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale)); canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext('2d', { alpha: true });
    if (!context) return file;
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/webp', .82));
    if (!blob || blob.type !== 'image/webp' || blob.size >= file.size) return file;
    const base = String(file.name || 'gorsel').replace(/\.[^.]+$/, '') || 'gorsel';
    return new File([blob], `${base}.webp`, { type: 'image/webp', lastModified: file.lastModified || Date.now() });
  } finally { bitmap.close?.(); }
}
async function compressDmVideo(file) {
  if (!file.type.startsWith('video/')) return file;
  if (typeof MediaRecorder !== 'function' || !HTMLCanvasElement.prototype.captureStream || !HTMLMediaElement.prototype.captureStream) {
    throw new Error('Bu tarayıcı 720p video sıkıştırmasını desteklemiyor.');
  }
  const sourceUrl = URL.createObjectURL(file), video = document.createElement('video');
  video.preload = 'auto'; video.playsInline = true; video.muted = true; video.src = sourceUrl;
  let sourceStream = null, outputStream = null, frameRequest = 0, recorder = null;
  try {
    await new Promise((resolve, reject) => {
      const loaded = () => { cleanup(); resolve(); }, failed = () => { cleanup(); reject(new Error('Video dosyası okunamadı.')); };
      const cleanup = () => { video.removeEventListener('loadedmetadata', loaded); video.removeEventListener('error', failed); };
      video.addEventListener('loadedmetadata', loaded, { once: true }); video.addEventListener('error', failed, { once: true }); video.load();
    });
    if (!video.videoWidth || !video.videoHeight || !Number.isFinite(video.duration) || video.duration <= 0) throw new Error('Video bilgileri okunamadı.');
    const needsDownscale = video.videoWidth > 1280 || video.videoHeight > 720;
    const scale = Math.min(1, 1280 / video.videoWidth, 720 / video.videoHeight);
    const width = Math.max(2, Math.round(video.videoWidth * scale / 2) * 2);
    const height = Math.max(2, Math.round(video.videoHeight * scale / 2) * 2);
    const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) throw new Error('Video sıkıştırma başlatılamadı.');
    sourceStream = video.captureStream();
    outputStream = canvas.captureStream(24);
    for (const track of sourceStream.getAudioTracks()) outputStream.addTrack(track);
    sourceStream.addEventListener('addtrack', event => {
      if (event.track.kind === 'audio' && !outputStream.getAudioTracks().length) outputStream.addTrack(event.track);
    });
    const mimeType = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']
      .find(type => MediaRecorder.isTypeSupported(type));
    if (!mimeType) throw new Error('Bu tarayıcı desteklenen video biçiminde sıkıştırma yapamıyor.');
    const sourceBitrate = file.size * 8 / video.duration;
    const videoBitsPerSecond = Math.max(400000, Math.min(1600000, Math.round(sourceBitrate * .72)));
    recorder = new MediaRecorder(outputStream, { mimeType, videoBitsPerSecond, audioBitsPerSecond: 96000 });
    const chunks = [];
    const recording = new Promise((resolve, reject) => {
      recorder.ondataavailable = event => { if (event.data?.size) chunks.push(event.data); };
      recorder.onerror = () => reject(new Error('Video sıkıştırma tamamlanamadı.'));
      recorder.onstop = () => resolve(new Blob(chunks, { type: recorder.mimeType || mimeType }));
    });
    recording.catch(() => {});
    const ended = new Promise((resolve, reject) => {
      video.addEventListener('ended', resolve, { once: true });
      video.addEventListener('error', () => reject(new Error('Video sıkıştırılırken dosya okunamadı.')), { once: true });
    });
    ended.catch(() => {});
    recorder.start(1000);
    const drawFrame = () => {
      if (video.readyState >= 2 && !video.ended) context.drawImage(video, 0, 0, width, height);
      if (!video.ended && recorder?.state === 'recording') frameRequest = requestAnimationFrame(drawFrame);
    };
    await video.play();
    drawFrame();
    await ended;
    if (recorder.state !== 'inactive') recorder.stop();
    const blob = await recording;
    if (!blob.size || (!needsDownscale && blob.size >= file.size)) return file;
    const base = String(file.name || 'video').replace(/\.[^.]+$/, '') || 'video';
    return new File([blob], `${base}.webm`, { type: 'video/webm', lastModified: file.lastModified || Date.now() });
  } finally {
    if (frameRequest) cancelAnimationFrame(frameRequest);
    if (recorder && recorder.state !== 'inactive') recorder.stop();
    for (const track of sourceStream?.getTracks() || []) track.stop();
    for (const track of outputStream?.getTracks() || []) track.stop();
    video.pause(); video.removeAttribute('src'); video.load(); URL.revokeObjectURL(sourceUrl);
  }
}
const dmTransfers = new Map();
const decryptedDmMedia = new Map();
const decryptingDmMedia = new Map();
const uploadingDmMedia = new Set();
const dmUploadProgress = new Map(), pendingDmFiles = new Map(), dmUploadQueue = [], activeDmRequests = new Map(), cancelledDmUploads = new Set();
let activeDmUploads = 0, activeVideoPlayer = null, activeVideoModal = null;
const DM_VIDEO_LIMIT = 50 * 1024 * 1024, DM_IMAGE_LIMIT = 25 * 1024 * 1024, DM_UPLOAD_CONCURRENCY = 5;
const voicePreferences = {
  get input() { return localStorage.getItem('aven-mic-device') || ''; },
  set input(id) { id ? localStorage.setItem('aven-mic-device', id) : localStorage.removeItem('aven-mic-device'); },
  get output() { return localStorage.getItem('aven-speaker-device') || ''; },
  set output(id) { id ? localStorage.setItem('aven-speaker-device', id) : localStorage.removeItem('aven-speaker-device'); }
};

/* ---------- Giriş / Kayıt ---------- */
const rules = {
  email: v => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) || 'Geçerli bir mail adresi girin.',
  username: v => /^[a-z0-9_.]{3,7}$/i.test(v) || 'Kayıt için 3-7 karakter; harf, rakam, _ ve . kullanılabilir.',
  displayName: v => v.includes('@') ? 'Görünen ad mail adresi olamaz.' : v.length <= 8 || 'Kayıtta görünen ad en fazla 8 karakter olabilir.',
  password: v => v.length >= 8 || 'Şifre en az 8 karakter olmalı.'
};
const field = (n, l, t, ac, eye, maxLength = 128) => `<label class="f"><input name="${n}" type="${t}" autocomplete="${ac}" placeholder=" " maxlength="${maxLength}"><span>${l}</span>${eye ? '<button type="button" class="eye" tabindex="-1">Göster</button>' : ''}<small></small></label>`;

function communityRulesScreen() {
  history.replaceState(null, '', location.pathname + location.search + '#topluluk-kurallari');
  root.innerHTML = `<main class="guidelines fade"><header class="guidelines-nav"><button class="guidelines-brand" type="button" aria-label="Aven keşfet sayfasına dön">Aven<span>.</span></button><button class="btn guidelines-back" type="button">Keşfet'e dön</button></header><section class="guidelines-hero"><div class="guidelines-hero-inner"><span class="guidelines-kicker"><i></i> AVEN TOPLULUK STANDARTLARI</span><h1>Birlikte daha iyi<br><em>bir sohbet alanı</em> kuruyoruz.</h1><p>Aven, insanların güvenli, saygılı ve keyifli bir ortamda iletişim kurması için var. Bu kurallar, topluluğumuzdaki herkesin alanını korumak için hazırlanmıştır.</p><div class="guidelines-meta"><span>Son güncelleme: 6 Ekim 2026</span><span>Resmi Aven kuralları</span></div></div></section><section class="guidelines-body"><aside class="guidelines-index"><span>İÇİNDEKİLER</span><a href="#saygi">Saygı ve nezaket</a><a href="#guvenlik">Güvenlik ve mahremiyet</a><a href="#icerik">Paylaşılan içerikler</a><a href="#kotuye">Kötüye kullanım</a><a href="#bildirim">Sorun bildirimi</a></aside><div class="guidelines-content"><article id="saygi"><span class="guideline-number">01</span><div><h2>Saygılı iletişim kur</h2><p>İnsanlara kimlikleri, düşünceleri veya farklılıkları nedeniyle saldırma, aşağılama ya da hedef gösterme. Taciz, tehdit, nefret söylemi ve zorbalık Aven'de kabul edilmez.</p><ul><li>Karşındaki kişiyi küçük düşürmeye veya korkutmaya çalışma.</li><li>İstenmeyen ısrarcı mesajlar ve hedefli saldırılar gönderme.</li><li>Bir tartışmayı kişisel saldırıya dönüştürme.</li></ul></div></article><article id="guvenlik"><span class="guideline-number">02</span><div><h2>Güvenliği ve mahremiyeti koru</h2><p>Başkasının özel bilgilerini izinsiz paylaşma. Şifre, konum, telefon, fotoğraf veya yazışmaları rıza olmadan yayınlamak güveni ve güvenliği ihlal eder.</p><ul><li>Kimlik avı, dolandırıcılık ve kötü amaçlı bağlantılar paylaşma.</li><li>Başkasının hesabına erişmeye veya hesabını ele geçirmeye çalışma.</li><li>Güvenlik açığı fark edersen bunu kötüye kullanmadan Aven'e bildir.</li></ul></div></article><article id="icerik"><span class="guideline-number">03</span><div><h2>Paylaşılan içeriklere dikkat et</h2><p>Fotoğraf, video, bağlantı ve mesaj paylaşırken içeriğin alıcılar üzerindeki etkisini düşün. Yasa dışı, şiddeti teşvik eden veya cinsel istismar içeren içeriklere izin verilmez.</p><ul><li>Çocukların cinsel istismarını içeren içerikleri asla paylaşma.</li><li>Aşırı şiddet, tehdit veya suç işlemeye teşvik eden içerik yayınlama.</li><li>Telif hakkı ve kişisel veri kurallarına saygı göster.</li></ul></div></article><article id="kotuye"><span class="guideline-number">04</span><div><h2>Aven'i kötüye kullanma</h2><p>Spam, otomatik hesaplar, sahte kimlikler ve hizmeti bozmayı amaçlayan davranışlar topluluğun deneyimini zedeler.</p><ul><li>Mesaj, arkadaşlık isteği veya davetlerle diğer kişileri rahatsız etme.</li><li>Aven'in çalışmasını bozacak kod, bot veya saldırı kullanma.</li><li>Başka bir kişi ya da resmi Aven hesabı gibi davranma.</li></ul></div></article><article id="bildirim"><span class="guideline-number">05</span><div><h2>Birlikte koruyalım</h2><p>Bir davranışın bu kuralları ihlal ettiğini düşünüyorsan kullanıcıyı engelle ve Aven yöneticisine bildir. Kötüye kullanımı kendi başına büyütmek yerine kanıtları güvenli biçimde sakla.</p><div class="guidelines-callout"><strong>Aven'in amacı açık.</strong><span>Herkesin kendini güvende hissedebildiği, sakin ve yaratıcı bir sohbet alanı oluşturmak.</span></div></div></article></div></section><footer class="guidelines-footer"><span>© Aven · Resmi Topluluk Kuralları</span><button class="guidelines-back" type="button">Aven keşfet'e dön</button></footer></main>`;
  const back = () => { history.replaceState(null, '', '/'); introScreen(); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  root.querySelectorAll('.guidelines-back,.guidelines-brand').forEach(button => button.onclick = back);
}

function aboutPublicScreen() {
  history.replaceState(null, '', '/hakkında');
  root.innerHTML = `<main class="about-public-page">
    <header class="about-public-nav">
      <a class="about-public-brand" href="/">Aven<span>.</span></a>
      <nav class="about-public-links" aria-label="Aven bağlantıları">
        <a href="/#topluluk-kurallari">Topluluk Kuralları</a>
        <a href="/destek">Yardım</a>
        <a class="about-public-home" href="/">Aven'i aç</a>
      </nav>
    </header>

    <section class="about-public-hero">
      <img class="about-public-logo" src="/image/profil.png" alt="" width="64" height="64">
      <h1>Arkadaşlarınla konuş.<br><span>Topluluğunu kur.</span></h1>
      <p>Aven; mesajlaşmak, sesli kanallarda buluşmak ve kendi sunucunu açmak için yaptığımız bir platform. Karmaşık olmasın, ilk girişte ne yapacağını herkes bilsin istedik.</p>
      <div class="about-public-actions">
        <a class="about-public-cta" href="/">Aven'e katıl</a>
        <a class="about-public-secondary" href="/#topluluk-kurallari">Topluluk kuralları</a>
      </div>
    </section>

    <section class="about-public-story">
      <h2>Neden Aven?</h2>
      <div class="about-public-story-copy">
        <p>Bir arkadaş grubu, bir oyun ekibi ya da aynı şeylerle ilgilenen insanlar için net ve kullanması kolay bir yer arıyorduk. Bulamayınca Aven'i yapmaya başladık.</p>
        <p>İki kişilik bir sohbet de olsa kalabalık bir sunucu da olsa, her şey tek yerde ve elinin altında olsun istiyoruz.</p>
      </div>
    </section>

    <footer class="about-public-footer">
      <span>© Aven</span>
      <span class="about-public-footer-links"><a href="/#topluluk-kurallari">Topluluk kuralları</a><a href="/destek">Yardım</a></span>
    </footer>
  </main>`;
}
function introScreen(returnToSettings = false) {
  history.replaceState(null, '', '/');
  const joinText = returnToSettings ? 'Uygulamaya dön' : 'Aven’e katıl';
  root.innerHTML = `<main class="intro fade">
    <header class="intro-nav">
      <a class="intro-brand" href="#" aria-label="Aven giriş ekranı">Aven<span>.</span></a>
      <button class="btn intro-login">${returnToSettings ? 'Uygulamaya dön' : 'Giriş yap'}</button>
    </header>

    <section class="intro-hero">
      <div class="intro-copy">
        <h1>Arkadaşlarınla güzel anlar biriktir.</h1>
        <p>Arkadaşlarını ekle, anında mesajlaş, fotoğraf ve videolarını paylaş. Sohbet etmek için gereken her şey tek yerde.</p>
        <div class="intro-actions">
          <button class="btn primary intro-join">${joinText}</button>
          <a class="intro-explore" href="/hakkında">Hakkında</a>
          <a class="intro-rules-link" href="#topluluk-kurallari">Topluluk Kuralları</a>
        </div>
      </div>

      <div class="intro-preview" aria-hidden="true">
        <div class="intro-preview-bar"><b>Hafta sonu ekibi</b><span>3 kişi çevrimiçi</span></div>
        <div class="intro-msg"><i style="--c:#e07a9b">E</i><div><small>Elif</small><p>Cumartesi akşamı müsait misiniz?</p></div></div>
        <div class="intro-msg"><i style="--c:#5fa8d3">C</i><div><small>Can</small><p>Ben varım, kampın fotoğraflarını da getiriyorum.</p><span class="intro-shot"></span></div></div>
        <div class="intro-msg"><i style="--c:#7bc29a">D</i><div><small>Deniz</small><p>Ben de geliyorum, saat 8 olur mu?</p></div></div>
        <div class="intro-msg me"><div><p>Olur, görüşürüz!</p><small>düzenlendi</small></div></div>
      </div>
    </section>

    <footer class="intro-footer">
      <span>© Aven</span>
      <a class="intro-about-link" href="/hakkında">Hakkında</a>
      <button class="intro-back">${returnToSettings ? 'Ayarlar’a dön' : 'Giriş / kayıt ekranına dön'}</button>
    </footer>
  </main>`;
  const backToAuth = reg => {
    history.replaceState(null, '', location.pathname + location.search);
    if (returnToSettings && me) {
      stab = 'about';
      boot(false).then(() => setView('settings')).catch(er => toast(er.message, 1));
    } else authScreen(reg);
  };
  $('.intro-brand').onclick = e => { e.preventDefault(); backToAuth(true); };
  $('.intro-login').onclick = () => backToAuth(false);
  $('.intro-back').onclick = () => backToAuth(true);
  root.querySelectorAll('.intro-join').forEach(b => b.onclick = () => backToAuth(true));
  $('.intro-rules-link').onclick = event => { event.preventDefault(); communityRulesScreen(); };
}


function verificationScreen(email, maskedEmail = email) {
  root.innerHTML = `<main class="auth fade"><div class="auth-layout"><form class="card verification-card" novalidate><div class="auth-brand"><img src="/image/profil.png" alt="Aven"><h1 class="brand">Aven</h1></div><p class="sub">Doğrulama kodunu <b>${esc(maskedEmail)}</b> adresine gönderdik.</p><div class="verification-heading"><h2>E-postanı doğrula</h2><p>Hesabını aktifleştirmek için 6 haneli kodu gir.</p></div><div class="verification-code" role="group" aria-label="6 haneli doğrulama kodu">${Array.from({ length: 6 }, (_, i) => `<input inputmode="numeric" pattern="[0-9]*" maxlength="1" aria-label="${i + 1}. kod hanesi" autocomplete="one-time-code">`).join('')}</div><div class="verification-meta"><span class="verification-countdown">Kod 10 dakika geçerli.</span><button type="button" class="link-button verification-resend" disabled>Yeni kod gönder</button></div><div class="err"></div><button class="btn primary" type="submit">Hesabı doğrula</button><button class="btn verification-change" type="button">E-postayı değiştir</button></form></div></main>`;
  const form = $('form', root), inputs = [...root.querySelectorAll('.verification-code input')], errBox = $('.err', form), submit = $('button[type=submit]', form), resend = $('.verification-resend', form), countdown = $('.verification-countdown', form);
  let endsAt = Date.now() + 10 * 60 * 1000, resendAt = Date.now() + 60000;
  const focusNext = (index, value) => { if (/^\d$/.test(value) && inputs[index + 1]) inputs[index + 1].focus(); };
  inputs.forEach((input, index) => {
    input.oninput = () => { input.value = input.value.replace(/\D/g, '').slice(-1); focusNext(index, input.value); };
    input.onkeydown = event => { if (event.key === 'Backspace' && !input.value && inputs[index - 1]) inputs[index - 1].focus(); };
    input.onpaste = event => { const value = (event.clipboardData?.getData('text') || '').replace(/\D/g, '').slice(0, 6); if (!value) return; event.preventDefault(); inputs.forEach((item, i) => { item.value = value[i] || ''; }); inputs[Math.min(value.length, 5)].focus(); };
  });
  const clock = () => {
    const left = Math.max(0, endsAt - Date.now()), sec = Math.ceil(left / 1000);
    countdown.textContent = left ? `Kod ${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')} geçerli.` : 'Kodun süresi doldu. Yeni kod iste.';
    const wait = Math.max(0, resendAt - Date.now()); resend.disabled = wait > 0; resend.textContent = wait ? `Yeni kod gönder (${Math.ceil(wait / 1000)} sn)` : 'Yeni kod gönder';
  };
  const timer = setInterval(clock, 1000); clock();
  const cleanup = () => clearInterval(timer);
  $('.verification-change', form).onclick = () => { cleanup(); authScreen(true); };
  resend.onclick = async () => {
    resend.disabled = true;
    try { const result = await api('/register/resend', 'POST', { email }); endsAt = result.expiresAt; resendAt = Date.now() + 60000; errBox.textContent = ''; inputs.forEach(input => input.value = ''); inputs[0].focus(); }
    catch (er) { errBox.textContent = er.message; }
    finally { clock(); }
  };
  form.onsubmit = async event => {
    event.preventDefault(); errBox.textContent = ''; const code = inputs.map(input => input.value).join('');
    if (!/^\d{6}$/.test(code)) { errBox.textContent = '6 haneli kodu eksiksiz girin.'; inputs.find(input => !input.value)?.focus(); return; }
    submit.disabled = true;
    try { me = await api('/register/verify', 'POST', { email, code }); cleanup(); await splash('E-posta doğrulandı', ['Hesabın güvence altına alınıyor…', 'Profilin hazırlanıyor…', 'Sohbet alanın yükleniyor…']); const target = authTargetAppRoute(); await boot(true, undefined, target.route, target.mode); }
    catch (er) { errBox.textContent = er.message; submit.disabled = false; }
  };
  inputs[0].focus();
}

function authScreen(reg = true) {
  dmSearchCleanup?.(); dmSearchCleanup = null;
  root.innerHTML = `<main class="auth fade"><div class="auth-layout"><form class="card" novalidate><div class="auth-brand"><img src="/image/profil.png" alt="Aven"><h1 class="brand">Aven</h1></div><p class="sub">${reg ? 'Hesabını oluştur ve sohbete başla.' : 'Tekrar hoş geldin.'}</p>
  ${reg ? field('email', 'Mail', 'email', 'email') + field('username', 'Kullanıcı adı', 'text', 'username', false, 7) + field('displayName', 'Görünen ad', 'text', 'nickname', false, 8) : field('login', 'Mail veya kullanıcı adı', 'text', 'username')}
  ${!reg ? '<div class="known-accounts" aria-label="Bu bilgisayarda kayıtlı hesaplar" hidden></div>' : ''}
  ${field('password', 'Şifre', 'password', reg ? 'new-password' : 'current-password', true)}
  <div class="err"></div><button class="btn primary">${reg ? 'Kayıt ol' : 'Giriş yap'}</button>
  <p class="alt">${reg ? 'Hesabın var mı?' : 'Hesabın yok mu?'} <a href="#">${reg ? 'Giriş yap' : 'Kayıt ol'}</a></p></form>
  </div></main>`;
  const f = $('form'), btn = $('.btn', f), errBox = $('.err', f);
  $('.alt a', f).onclick = e => { e.preventDefault(); authScreen(!reg); };
  const known = $('.known-accounts', root);
  if (known) refreshDeviceAccounts().catch(er => toast(er.message, 1));
  $('.eye', f).onclick = e => { const i = $('[name=password]', f), h = i.type === 'password'; i.type = h ? 'text' : 'password'; e.target.textContent = h ? 'Gizle' : 'Göster'; };
  f.onsubmit = async e => {
    e.preventDefault(); errBox.textContent = ''; const data = {}; let ok = true;
    f.querySelectorAll('input').forEach(i => {
      const v = i.name === 'password' ? i.value : i.value.trim(); data[i.name] = v;
      const m = !v ? 'Bu alan boş bırakılamaz.' : reg ? rules[i.name]?.(v) : true, lab = i.closest('.f');
      lab.classList.toggle('bad', m !== true && m !== undefined); $('small', lab).textContent = m === true || m === undefined ? '' : m;
      if (m !== true && m !== undefined) ok = false;
    });
    if (!ok) { f.classList.remove('shake'); void f.offsetWidth; f.classList.add('shake'); return; }
    btn.disabled = true;
    try {
      const result = await api(reg ? '/register' : '/login', 'POST', data);
      if (reg && result.verificationRequired) { verificationScreen(result.email, result.maskedEmail); return; }
      me = result; if (reg) await splash(); const target = authTargetAppRoute(); await boot(reg, undefined, target.route, target.mode);
    }
    catch (er) {
      if (reg && /doğrulama bekliyor/i.test(er.message)) { verificationScreen(data.email, data.email); return; }
      errBox.textContent = er.message; btn.disabled = false;
    }
  };
}

async function splash(title = 'Hesabın oluşturuldu', steps = ['Hesabın güvence altına alınıyor…', 'Profilin hazırlanıyor…', 'Sohbet alanın yükleniyor…'], loading = false) {
  root.innerHTML = `<div class="splash fade${loading ? ' switching' : ''}"><div>${loading ? '<div class="aven-loader" role="img" aria-label="Aven yükleniyor"><span class="aven-loader-orbit orbit-red"></span><span class="aven-loader-orbit orbit-blue"></span><span class="aven-loader-orbit orbit-dark"></span><span class="aven-loader-core"><img src="/image/profil.png" alt=""></span></div>' : '<div class="check"><svg viewBox="0 0 52 52"><circle cx="26" cy="26" r="24"/><path d="M14 27l8 8 16-17"/></svg></div>'}<h2>${esc(title)}</h2><p id="sp"></p><div class="bar"><i></i></div></div></div>`;
  for (const s of steps) {
    const message = $('#sp');
    message.textContent = s;
    message.classList.remove('step-in');
    void message.offsetWidth;
    message.classList.add('step-in');
    await sleep(loading ? 1750 : 1100);
  }
}

/* ---------- Ana uygulama ---------- */
async function boot(fresh, friends, route = { kind: 'home' }, routeMode = 'replace') {
  teardownTogetherPlayer(true);
  applyLanguage(me?.language || 'tr');
  resetAnnouncementQueueForUser();
  guildRouteToken++;
  guildChannelToken++;
  const previousView = $('.guild-app');
  previousView?.classList.add('route-leaving');
  guildMode = false; currentGuild = null; renderedGuildId = null; renderedGuildChannelId = null;
  document.documentElement.dataset.theme = me.theme; active = null; view = 'chat'; unread = {};
  fr = friends || await getFr();
  guilds = await api('/servers');
  notifications = await api('/notifications').catch(() => []);
  root.innerHTML = `<div class="app" id="app">${guildRailMarkup()}<aside class="side"><div class="side-h"><span class="brand"><img src="/logo.png" alt="">Aven</span><div class="side-actions"><a class="icon support-link" href="/destek" title="Destek Merkezi" aria-label="Destek Merkezi">${uiIcon('help')}</a><button class="icon inbox-button" data-inbox title="Gelen kutusu" aria-label="Gelen kutusu">${uiIcon('inbox')}</button><button class="icon" id="add" title="Arkadaş ekle" aria-label="Arkadaş ekle">${uiIcon('add')}</button></div></div><div class="tabs"></div><div class="dm-quick-search"><label><span>${uiIcon('search')}</span><input data-server-channel-search type="search" placeholder="Sunucu veya kanal ara" autocomplete="off" aria-label="Sunucu veya kanal ara"><kbd>Ctrl K</kbd></label><div class="dm-quick-search-results" data-search-results role="listbox" hidden></div></div><div class="list" id="list"></div><div class="me"></div></aside><section class="main" id="main"></section><aside class="dm-profile-panel" id="dm-profile" aria-label="Kullanıcı profili" hidden></aside></div>`;
  $('#add').onclick = addModal; $('#list').onclick = listClick;
  renderServerRail();
  bindGuildRail();
  renderSide(); renderMain(); initServerChannelSearch(); connect();
  ensureVoiceDock();
  const list = $('#list'); let press;
  list.oncontextmenu = e => { const it = e.target.closest('[data-uid]'); if (it) { e.preventDefault(); ctxMenu(e.clientX, e.clientY, friend(+it.dataset.uid)); } };
  list.ontouchstart = e => { const it = e.target.closest('[data-uid]'), t = e.touches[0]; if (it) press = setTimeout(() => ctxMenu(t.clientX, t.clientY, friend(+it.dataset.uid)), 550); };
  list.ontouchend = list.ontouchmove = () => clearTimeout(press);
  const bot = fresh && route?.kind === 'home' && fr.friends.find(f => f.bot);
  animateBotWelcomeFor = bot?.id || 0;
  if (bot) { view = 'chat'; openChat(bot.id); }
  const invite = new URLSearchParams(location.search).get('invite') || location.pathname.match(/^\/([A-Za-z0-9_-]{12})$/)?.[1];
  if (invite) {
    writeAppRoute({ kind: 'home' }, 'replace');
    try { const joined = await api(`/invites/${encodeURIComponent(invite)}/join`, 'POST'); await enterGuilds(joined.id); toast(`${joined.name} sunucusuna katıldın.`); }
    catch (er) { toast(er.message, 1); }
    return;
  }
  if (fresh && bot) return;
  if (route?.kind === 'server') {
    const publicServer = route.publicId ? guilds.find(server => String(server.publicId || '').toUpperCase() === route.publicId) : null;
    const serverId = route.publicId ? publicServer?.id : route.serverId;
    if (!serverId) { toast('Sunucu bulunamadı.', 1); writeAppRoute({ kind: 'home' }, 'replace'); return; }
    try { await enterGuilds(serverId, route.channelId, routeMode); }
    catch (er) {
      if (routeMode !== 'none') throw er;
      toast(er.message, 1);
      await boot(false, undefined, { kind: 'home' }, 'replace');
    }
    return;
  }
  if (route?.kind === 'dm') {
    const contact = [...fr.friends, ...fr.conversations].find(item => route.publicId
      ? String(item.publicId || '').toUpperCase() === route.publicId
      : Number(item.id) === Number(route.userId));
    if (contact) {
      active = Number(contact.id); view = 'chat'; renderSide(); renderMain();
      writeAppRoute({ kind: 'dm', publicId: contact.publicId }, routeMode === 'none' && route.userId ? 'replace' : routeMode);
      return;
    }
    writeAppRoute({ kind: 'home' }, 'replace');
    return;
  }
  writeAppRoute({ kind: 'home' }, routeMode);
}

const ANNOUNCEMENT_UI = {
  tr: { eyebrow: 'AVEN DUYURUSU', close: 'Kapat', closeAfter: seconds => `${seconds} saniye sonra kapatabilirsin`, hint: 'Duyuru kapatıldığında yeniden gösterilmez.' },
  en: { eyebrow: 'AVEN ANNOUNCEMENT', close: 'Close', closeAfter: seconds => `You can close this in ${seconds} seconds`, hint: 'This announcement will not be shown again after you close it.' },
  de: { eyebrow: 'AVEN MITTEILUNG', close: 'Schließen', closeAfter: seconds => `In ${seconds} Sekunden kannst du sie schließen`, hint: 'Nach dem Schließen wird diese Mitteilung nicht erneut angezeigt.' }
};
function resetAnnouncementQueueForUser() {
  const userId = Number(me?.id) || 0;
  if (announcementUserId === userId) return;
  clearInterval(announcementCloseTimer); announcementCloseTimer = 0;
  $('[data-announcement-overlay]')?.remove(); announcementQueue = []; announcementCurrentId = 0; announcementShowing = false; announcementFetching = null;
  announcementUserId = userId;
}
async function loadUnreadAnnouncements() {
  if (!me?.id || announcementFetching) return announcementFetching;
  const requestUserId = Number(me.id), request = (async () => {
    const unread = await api('/announcements/unread');
    if (Number(me?.id) !== requestUserId) return;
    for (const item of unread) {
      if (Number(item.id) === announcementCurrentId || announcementQueue.some(queued => Number(queued.id) === Number(item.id))) continue;
      announcementQueue.push(item);
    }
    await showNextAnnouncement();
  })();
  announcementFetching = request;
  try { await request; }
  catch (error) { if (error.status !== 401) toast(error.message, 1); }
  finally { if (announcementFetching === request) announcementFetching = null; }
}
async function showNextAnnouncement() {
  if (announcementShowing || $('[data-announcement-overlay]') || !announcementQueue.length) return;
  const notice = announcementQueue.shift();
  announcementCurrentId = Number(notice.id);
  let claim;
  try { claim = await api(`/announcements/${announcementCurrentId}/view`, 'POST'); }
  catch {
    announcementQueue.unshift(notice); announcementCurrentId = 0;
    setTimeout(() => loadUnreadAnnouncements().catch(() => {}), 5000);
    return;
  }
  if (!claim.viewed) { announcementCurrentId = 0; return showNextAnnouncement(); }
  presentAnnouncement(notice);
}
function presentAnnouncement(notice) {
  if (!notice || $('[data-announcement-overlay]')) return;
  announcementCurrentId = Number(notice.id) || 0;
  const locale = ['tr', 'en', 'de'].includes(notice.locale) ? notice.locale : 'tr', copy = ANNOUNCEMENT_UI[locale];
  const overlay = document.createElement('div'); overlay.className = 'announcement-overlay'; overlay.dataset.announcementOverlay = '';
  overlay.innerHTML = `<section class="announcement-dialog" role="dialog" aria-modal="true" aria-labelledby="announcement-title" lang="${locale}"><button type="button" class="announcement-close" data-announcement-close disabled aria-label="${esc(copy.close)}" title="${esc(copy.closeAfter(2))}">×</button><div class="announcement-art"><img src="/image/bildiri.png?v=20261013.4" alt=""></div><div class="announcement-copy"><small class="announcement-eyebrow">${esc(copy.eyebrow)}</small><h2 id="announcement-title" data-notification-title>${esc(notice.title)}</h2><p class="announcement-body" data-notification-title>${esc(notice.body)}</p><div class="announcement-links">${(notice.links || []).filter(link => link.url && link.label).map(link => `<a href="${esc(link.url)}" target="_blank" rel="noopener noreferrer" data-notification-title>${esc(link.label)} <span aria-hidden="true">↗</span></a>`).join('')}</div></div><footer class="announcement-footer"><span>${esc(copy.hint)}</span><small class="announcement-countdown">${esc(copy.closeAfter(2))}</small></footer></section>`;
  document.body.append(overlay); announcementShowing = true;
  const closeButton = $('[data-announcement-close]', overlay), countdown = $('.announcement-countdown', overlay);
  let seconds = 2;
  announcementCloseTimer = setInterval(() => {
    seconds--;
    if (seconds > 0) { closeButton.title = copy.closeAfter(seconds); countdown.textContent = copy.closeAfter(seconds); return; }
    clearInterval(announcementCloseTimer); announcementCloseTimer = 0;
    closeButton.disabled = false; closeButton.classList.add('ready'); closeButton.title = copy.close; countdown.textContent = copy.close;
    closeButton.focus({ preventScroll: true });
  }, 1000);
  const dismiss = () => {
    if (closeButton.disabled || !overlay.isConnected) return;
    clearInterval(announcementCloseTimer); announcementCloseTimer = 0;
    overlay.remove(); announcementShowing = false; announcementCurrentId = 0;
    if (announcementQueue.length) showNextAnnouncement(); else loadUnreadAnnouncements().catch(() => {});
  };
  closeButton.onclick = dismiss;
  overlay._announcementDismiss = dismiss;
}
document.addEventListener('keydown', event => {
  const overlay = $('[data-announcement-overlay]');
  if (!overlay || event.key !== 'Escape') return;
  const closeButton = $('[data-announcement-close]', overlay);
  if (closeButton?.disabled) return;
  event.preventDefault(); event.stopImmediatePropagation(); overlay._announcementDismiss?.();
});

function connect() {
  es?.close(); clearInterval(poll); firstOpen = true; beat = Date.now(); es = new EventSource('/api/events');
  poll = setInterval(async () => {
    if (Date.now() - beat > 45000) return connect();
    if (es.readyState === 1) return;
    if (guildMode && currentGuildChannel?.type === 'text') { refreshGuildMessages(true).catch(() => {}); return; }
    if (view !== 'chat' || !active) return;
    const last = Math.max(0, ...seen);
    try { (await api(`/messages/${active}?after=${last}`)).forEach(addMsg); } catch {}
  }, 5000);
  es.onopen = () => { refreshNotifications(); loadUnreadAnnouncements().catch(() => {}); if (!firstOpen) { loadFriends(); if (view === 'chat' && active) openChat(active, true); } firstOpen = false; };
  es.addEventListener('friends', e => {
    const update = JSON.parse(e.data || '{}');
    loadFriends().then(async () => {
      if (update.personalizationChanged && Number(update.userId) === Number(active)) {
        const panel = $('#dm-profile');
        if (panel) { panel.dataset.userId = ''; renderDmProfile(); }
      }
      if (update.badgesChanged && view === 'chat' && active) await openChat(active, true);
      if (update.badgesChanged && guildMode && currentGuildId) await reloadGuild(currentGuildId);
      if (update.guildTagChanged) {
        me = { ...me, ...await api('/me') };
        if (guildMode && currentGuildId) await reloadGuild(currentGuildId);
        else if (guildMode) renderGuildView();
        else if (view === 'chat' && active) await openChat(active, true);
        else { renderSide(); renderServerRail(); }
      }
      if (profId) profileModal(profId, 1);
    }).catch(er => toast(er.message, 1));
  });
  es.addEventListener('dm-requests', () => loadFriends().catch(er => toast(er.message, 1)));
  es.addEventListener('notifications', () => refreshNotifications());
  es.addEventListener('announcement', () => loadUnreadAnnouncements().catch(() => {}));
  es.addEventListener('ping', () => { beat = Date.now(); });
  es.addEventListener('ver', e => { beat = Date.now(); const v = JSON.parse(e.data); if (build && build !== v) return location.reload(); build = v; });
  es.addEventListener('standing', () => { toast('Hesabına resmi bir uyarı verildi.', 1, 4200); if (view === 'settings' && stab === 'account') loadStanding(); });
  es.addEventListener('account-banned', e => showBannedScreen(JSON.parse(e.data).message));
  es.addEventListener('profile', e => {
    const update = JSON.parse(e.data || '{}');
    if (update.badgesChanged && Number(update.userId) === Number(me?.id)) {
      api('/me').then(async user => {
        const menuWasOpen = !!$('.account-menu.on');
        me = { ...me, ...user };
        if (guildMode) renderGuildView(); else renderSide();
        if (menuWasOpen) {
          const menu = $('.account-menu'), button = $('.me-p, [data-guild-profile]');
          menu?.classList.add('on'); menu?.setAttribute('aria-hidden', 'false'); button?.setAttribute('aria-expanded', 'true');
        }
        if (view === 'chat' && active) await openChat(active, true);
        if (view === 'settings' && stab === 'profile') renderMain();
        if (profId) profileModal(profId, 1);
      }).catch(er => toast(er.message, 1));
      return;
    }
    if (profId) profileModal(profId, 1);
  });
  es.addEventListener('blocks', () => { if (view === 'settings') loadBlocks(); });
  es.addEventListener('message', e => addMsg(JSON.parse(e.data)));
  es.addEventListener('message-delete', e => removeDmMessage(JSON.parse(e.data).id));
  es.addEventListener('edit', e => editMsg(JSON.parse(e.data)));
  es.addEventListener('attachment-ready', e => updateAttachmentReady(JSON.parse(e.data)));
  es.addEventListener('dm-signal', e => handleDmSignal(JSON.parse(e.data)).catch(er => toast(`Medya doğrudan aktarılamadı: ${er.message}`, 1)));
  es.addEventListener('server', async e => {
    const data = JSON.parse(e.data);
    try {
      const previousGuildList = JSON.stringify(guilds);
      const previousGuild = currentGuild ? JSON.stringify(currentGuild) : null;
      let shouldRenderGuild = !!data.tagUpdated;
      if (data.tagUpdated) me = { ...me, ...await api('/me') };
      guilds = await api('/servers');
      shouldRenderGuild ||= JSON.stringify(guilds) !== previousGuildList;
      if (data.invitedBy) toast(`Sunucuya davet edildin: ${guilds.find(server => server.id === data.serverId)?.name || 'yeni sunucu'}`);
      if (!guildMode) renderServerRail();
      if (data.banned && Number(voiceSession?.guildId) === Number(data.serverId)) await leaveVoice(false);
      if ((data.left || data.banned) && Number(currentGuildId) === Number(data.serverId)) {
        currentGuildId = guilds[0]?.id || null; currentGuild = null; currentGuildChannel = null; shouldRenderGuild = true;
      }
      if (data.banned) toast(`Bu sunucuya erişimin kaldırıldı.${data.reason ? ` Sebep: ${data.reason}` : ''}`, 1, 6000);
      if (data.deleted && currentGuildId === data.serverId) { currentGuildId = null; currentGuild = null; currentGuildChannel = null; shouldRenderGuild = true; }
      if (currentGuildId && guilds.some(s => s.id === currentGuildId)) {
        currentGuild = await api('/servers/' + currentGuildId);
        currentGuildChannel = currentGuild.channels.find(c => c.id === currentGuildChannel?.id) || currentGuild.channels[0] || null;
        shouldRenderGuild ||= JSON.stringify(currentGuild) !== previousGuild;
      }
      if (data.bansChanged && Number(currentGuildId) === Number(data.serverId)) $('.server-settings-modal')?.__refreshServerBans?.();
      if (voiceSession && Number(voiceSession.guildId) === Number(currentGuildId)) {
        const activeChannel = currentGuild?.channels.find(c => Number(c.id) === Number(voiceSession.channelId));
        if (!activeChannel) await leaveVoice(false);
        else if (voiceSession.canSpeak && !(activeChannel.permissions & 64)) {
          voiceSession.canSpeak = false;
          voiceStream?.getTracks().forEach(track => track.stop()); voiceStream = null;
        }
      }
        if (guildMode && shouldRenderGuild) {
          writeAppRoute(currentGuildId
          ? { kind: 'server', serverId: currentGuildId, publicId: currentGuild.publicId, channelId: currentGuildChannel?.id }
            : { kind: 'home' }, 'replace');
          renderGuildView();
        }
    } catch (er) { if (guildMode) toast(er.message, 1); }
  });
  es.addEventListener('server-message', e => {
    const message = JSON.parse(e.data);
    if (guildMode && Number(message.channelId) === Number(currentGuildChannel?.id)) appendGuildMessage(message);
  });
  es.addEventListener('server-message-delete', e => {
    const message = JSON.parse(e.data);
    if (!guildMode || Number(message.channelId) !== Number(currentGuildChannel?.id)) return;
    $(`[data-guild-message="${message.id}"]`)?.remove(); guildMessageIds.delete(message.id);
  });
  es.addEventListener('voice-join', e => {
    const { channelId, participant } = JSON.parse(e.data);
    if (Number(channelId) === Number(voiceSession?.channelId) && Number(participant.id) !== Number(me?.id)) playAppSound('voice', { coalesce: true });
    const channel = currentGuild?.channels.find(item => Number(item.id) === Number(channelId));
    if (channel) channel.participants = [...(channel.participants || []).filter(p => p.id !== participant.id), participant];
    if (Number(channelId) === Number(voiceSession?.channelId)) voiceMembers = [...voiceMembers.filter(p => p.id !== participant.id), participant];
    if (Number(voiceSession?.channelId) === Number(channelId) && me.id < participant.id) {
      createVoicePeer(participant.id, true).catch(er => toast(`Ses bağlantısı kurulamadı: ${er.message}`, 1));
    }
    if (guildMode) renderGuildView();
  });
  es.addEventListener('voice-leave', e => {
    const { channelId, userId, closed } = JSON.parse(e.data);
    if (Number(channelId) === Number(voiceSession?.channelId) && Number(userId) !== Number(me?.id) && !closed) playAppSound('voice', { coalesce: true });
    pendingVoiceSignals = pendingVoiceSignals.filter(item => Number(item.channelId) !== Number(channelId) || Number(item.fromId) !== Number(userId));
    if (closed && Number(voiceSession?.channelId) === Number(channelId)) {
      leaveVoice(false, false);
      return;
    }
    const channel = currentGuild?.channels.find(item => Number(item.id) === Number(channelId));
    if (channel) channel.participants = (channel.participants || []).filter(p => p.id !== userId);
    if (Number(channelId) === Number(voiceSession?.channelId)) {
      voiceMembers = voiceMembers.filter(p => p.id !== userId);
      closeVoicePeer(userId);
    }
    if (guildMode) renderGuildView();
  });
  es.addEventListener('voice-state', e => {
    const state = JSON.parse(e.data), channel = currentGuild?.channels.find(item => Number(item.id) === Number(state.channelId));
    if (channel) channel.participants = (channel.participants || []).map(participant => participant.id === state.userId ? { ...participant, speaking: state.speaking, streaming: state.streaming, streamId: state.streamId } : participant);
    if (Number(state.channelId) === Number(voiceSession?.channelId)) {
      voiceMembers = voiceMembers.map(participant => participant.id === state.userId ? { ...participant, speaking: state.speaking, streaming: state.streaming, streamId: state.streamId } : participant);
      if (state.streaming && state.streamId) {
        voiceRemoteShareStreamIds.set(state.userId, state.streamId);
        voiceRemoteAudioTracks.get(state.userId)?.forEach(entry => { if (entry.isShareAudio) entry.streamId = state.streamId; });
        const peer = voicePeers.get(Number(state.userId)), track = peer?.videoTransceiver?.receiver?.track;
        if (track?.readyState === 'live' && !track.muted) renderRemoteVideo(state.userId, new MediaStream([track]), voiceMembers.find(member => member.id === state.userId));
      } else if (!state.streaming) {
        voiceVideoStreams.delete(state.userId);
        voiceWatchedStreams.delete(state.userId); voiceExpandedStreams.delete(state.userId);
        const shareStreamId = voiceRemoteShareStreamIds.get(state.userId) || state.streamId;
        removeRemoteShareAudio(state.userId, shareStreamId);
        voiceRemoteShareStreamIds.delete(state.userId);
        renderVoiceVideos();
      }
    }
    updateVoiceIndicators(state.userId);
    updateVoiceDock();
  });
  es.addEventListener('watch-together', e => {
    const update = JSON.parse(e.data);
    if (Number(update.channelId) !== Number(voiceSession?.channelId)) return;
    if (update.cleared) {
      if (!watchTogetherSession || watchTogetherSession.sessionId === update.sessionId) {
        watchTogetherSession = null; togetherJoined = false; teardownTogetherPlayer(false, false);
        if (guildMode) renderTogetherWatch();
      }
      return;
    }
    const changedSession = watchTogetherSession?.sessionId !== update.sessionId;
    const changedHost = !changedSession && Number(watchTogetherSession?.hostId) !== Number(update.hostId);
    if (changedSession) { togetherJoined = false; teardownTogetherPlayer(false, false); }
    else if (changedHost) teardownTogetherPlayer(true, false);
    watchTogetherSession = { ...update };
    if (update.actorId !== me.id && !changedHost) applyTogetherUpdate(update);
    if (guildMode) (changedSession || changedHost) ? renderTogetherWatch() : updateTogetherStatus();
  });
  es.addEventListener('voice-signal', e => {
    const { channelId, fromId, signal } = JSON.parse(e.data);
    if (voiceJoining && guildMode && Number(channelId) === Number(currentGuildChannel?.id)) {
      pendingVoiceSignals = pendingVoiceSignals.filter(item => Date.now() - item.receivedAt < 30000);
      pendingVoiceSignals.push({ channelId: Number(channelId), fromId: Number(fromId), signal, receivedAt: Date.now() });
      if (pendingVoiceSignals.length > 128) pendingVoiceSignals.splice(0, pendingVoiceSignals.length - 128);
      return;
    }
    if (Number(channelId) !== Number(voiceSession?.channelId)) return;
    queueVoiceSignal(fromId, signal);
  });
  es.addEventListener('dm-call-incoming', e => handleIncomingDmCall(JSON.parse(e.data)));
  es.addEventListener('dm-call-accepted', e => {
    const data = JSON.parse(e.data);
    if (voiceSession?.kind !== 'dm' || voiceSession.callId !== data.callId) return;
    voiceSession.peer = data.peer; voiceSession.status = 'connecting';
    voiceMembers = [me, { ...data.peer, speaking: false, streaming: false }];
    renderDmCallScreen(); updateVoiceDock();
    createVoicePeer(data.peer.id, true).then(() => startVoiceActivityMonitor()).catch(er => { toast(`Arama bağlantısı kurulamadı: ${er.message}`, 1); leaveVoice(false).catch(() => {}); });
  });
  es.addEventListener('dm-call-rejected', e => {
    const data = JSON.parse(e.data);
    if (voiceSession?.kind !== 'dm' || voiceSession.callId !== data.callId) return;
    leaveVoice(false, false).finally(() => toast('Arama karşı tarafça reddedildi.'));
  });
  es.addEventListener('dm-call-ended', e => {
    const data = JSON.parse(e.data);
    if (voiceSession?.kind === 'dm' && voiceSession.callId === data.callId) {
      const message = data.reason === 'missed' ? 'Arama yanıtlanmadı.' : data.reason === 'connection-lost' ? 'Arama bağlantısı kapandı.' : 'Arama sona erdi.';
      leaveVoice(false, false).finally(() => toast(message));
    }
    if (incomingDmCall?.callId === data.callId) dismissIncomingDmCall();
  });
  es.addEventListener('dm-call-signal', e => {
    const data = JSON.parse(e.data);
    if (voiceSession?.kind !== 'dm' || voiceSession.callId !== data.callId) return;
    dmCallSignalQueue = dmCallSignalQueue.then(() => handleVoiceSignal(data.fromId, data.signal)).catch(er => toast(`Arama sinyali alınamadı: ${er.message}`, 1));
  });
  es.addEventListener('dm-call-state', e => {
    const state = JSON.parse(e.data);
    if (voiceSession?.kind !== 'dm' || voiceSession.callId !== state.callId) return;
    voiceMembers = voiceMembers.map(participant => participant.id === state.userId ? { ...participant, speaking: state.speaking, streaming: state.streaming, streamId: state.streamId } : participant);
    if (state.streaming && state.streamId) {
      voiceRemoteShareStreamIds.set(state.userId, state.streamId);
      voiceRemoteAudioTracks.get(state.userId)?.forEach(entry => { if (entry.isShareAudio) entry.streamId = state.streamId; });
      const peer = voicePeers.get(Number(state.userId)), track = peer?.videoTransceiver?.receiver?.track;
      if (track?.readyState === 'live' && !track.muted) renderRemoteVideo(state.userId, new MediaStream([track]), voiceMembers.find(member => member.id === state.userId));
    } else if (!state.streaming) {
      voiceVideoStreams.delete(state.userId); voiceWatchedStreams.delete(state.userId); voiceExpandedStreams.delete(state.userId);
      voiceRemoteShareStreamIds.delete(state.userId);
      removeRemoteShareAudio(state.userId, state.streamId);
    }
    updateDmCallSpeaking(); updateVoiceDock(); renderVoiceVideos();
  });
}

function renderServerRail() {
  const list = $('.guild-rail-server-list');
  if (!list) return;
  list.innerHTML = guilds.map(server => `<button type="button" class="guild-icon${guildMode && server.id === currentGuildId ? ' on' : ''}" data-guild="${server.id}" title="${esc(server.name)}" aria-label="${esc(server.name)}">${server.icon ? `<img src="${esc(server.icon)}" alt="">` : esc([...server.name][0]?.toUpperCase() || '?')}</button>`).join('');
}

function guildRailMarkup() {
  return `<nav class="guild-rail" aria-label="Sunucular">
    <button type="button" class="guild-home${guildMode ? '' : ' on'}" data-guild-dm title="Mesajlar"><img src="/image/profil.png" alt="Mesajlar"></button>
    <i class="guild-rail-line"></i><div class="guild-rail-server-list"></div>
    <button type="button" class="guild-add" data-new-server title="Sunucu oluştur" aria-label="Sunucu oluştur">＋</button>
    <button type="button" class="guild-join" data-join-server title="Davetle katıl" aria-label="Davetle katıl">↗</button>
  </nav>`;
}

function bindGuildRail() {
  const rail = $('.guild-rail');
  if (!rail) return;
  rail.onclick = event => {
    const server = event.target.closest('[data-guild]');
    if (server) { enterGuilds(Number(server.dataset.guild)).catch(er => toast(er.message, 1)); return; }
    if (event.target.closest('[data-guild-dm]')) {
      if (guildMode) boot(false, undefined, { kind: 'home' }, 'push').catch(er => toast(er.message, 1));
      else { active = null; view = 'chat'; writeAppRoute({ kind: 'home' }); renderSide(); renderMain(); }
      return;
    }
    if (event.target.closest('[data-new-server]')) newGuildModal();
    else if (event.target.closest('[data-join-server]')) joinGuildModal();
  };
  rail.oncontextmenu = event => {
    const server = event.target.closest('[data-guild]');
    if (!server) return;
    event.preventDefault();
    openServerContextMenu(Number(server.dataset.guild), event.clientX, event.clientY).catch(er => toast(er.message, 1));
  };
}

async function enterGuilds(selectedId, selectedChannelId = null, routeMode = 'push') {
  dmSearchCleanup?.(); dmSearchCleanup = null;
  if (voiceSession?.kind === 'dm') minimizeDmCall();
  const routeToken = ++guildRouteToken;
  guildChannelToken++;
  if (routeToken !== guildRouteToken) return;
  guildMode = true; active = null; view = 'servers';
  guilds = await api('/servers');
  if (routeToken !== guildRouteToken) return;
  if (selectedId && !guilds.some(server => Number(server.id) === Number(selectedId))) throw new Error('Sunucu bulunamadı.');
  if (selectedId) currentGuildId = Number(selectedId);
  else if (!guilds.some(s => s.id === currentGuildId)) currentGuildId = guilds[0]?.id || null;
  if (currentGuildId && guilds.some(s => s.id === currentGuildId)) {
    currentGuild = await api('/servers/' + currentGuildId);
    if (routeToken !== guildRouteToken) return;
    const requestedChannel = selectedChannelId && currentGuild.channels.find(c => Number(c.id) === Number(selectedChannelId));
    if (requestedChannel) currentGuildChannel = requestedChannel;
    else if (!currentGuild.channels.some(c => Number(c.id) === Number(currentGuildChannel?.id))) currentGuildChannel = currentGuild.channels[0] || null;
  } else { currentGuildId = null; currentGuild = null; currentGuildChannel = null; }
  const routeChannelWasInvalid = !!selectedChannelId && !currentGuild?.channels.some(c => Number(c.id) === Number(selectedChannelId));
  const effectiveRouteMode = routeChannelWasInvalid || routeMode === 'none' && !selectedChannelId ? 'replace' : routeMode;
  writeAppRoute(currentGuildId
    ? { kind: 'server', serverId: currentGuildId, publicId: currentGuild.publicId, channelId: currentGuildChannel?.id }
    : { kind: 'home' }, effectiveRouteMode);
  renderGuildView(false);
  renderServerRail();
  ensureVoiceDock();
  if (currentGuildChannel?.type === 'voice') loadVoiceMembers(currentGuildChannel.id).catch(er => toast(er.message, 1));
  if (voiceSession && currentGuildId === voiceSession.guildId) {
    const channel = currentGuild?.channels.find(item => item.id === voiceSession.channelId);
    if (channel) channel.participants = voiceMembers;
    updateVoiceDock();
  }
}

function renderGuildView(preservePosition = true) {
  const previousWatchPanel = $('[data-watch-together-panel]');
  const preserveTogetherPanel = !!(previousWatchPanel && togetherPlayer && watchTogetherSession &&
    previousWatchPanel.dataset.sessionId === watchTogetherSession.sessionId &&
    Number(watchTogetherSession.channelId) === Number(currentGuildChannel?.id) && currentGuildChannel?.type === 'voice');
  if (!preserveTogetherPanel) teardownTogetherPlayer(true);
  const sameServer = preservePosition && renderedGuildId === (Number(currentGuildId) || null);
  const sameChannel = sameServer && renderedGuildChannelId === (Number(currentGuildChannel?.id) || null);
  const enterClass = !sameServer ? ' guild-enter' : '';
  const previousMessageScroll = sameChannel ? $('#guild-chat-msgs')?.scrollTop ?? null : null;
  const previousChannelListScroll = sameServer ? $('.guild-channel-list')?.scrollTop ?? null : null;
  const previousMembersScroll = sameServer ? $('.guild-members')?.scrollTop ?? null : null;
  const previousRailScroll = $('.guild-rail')?.scrollTop ?? null;
  closeServerMemberPopover();
  const allowed = currentGuild?.me.permissions || 0;
  root.innerHTML = `<div class="app guild-app${enterClass}${currentGuildChannel ? ' channel-open' : ''}" id="app">
    ${guildRailMarkup()}
    <aside class="guild-side">
      <header class="guild-side-head"><div class="guild-side-title"><b class="guild-side-title-name">${currentGuild ? esc(currentGuild.name) : 'Sunucular'}</b>${currentGuild?.verified ? verifiedServerBadge() : ''}</div>${currentGuild && (allowed & 128 || currentGuild.me.owner) ? '<button data-server-menu title="Sunucu yönetimi">•••</button>' : ''}</header>
      ${currentGuild ? `<div class="guild-channel-list">
        <div class="guild-category"><span>METİN KANALLARI</span>${allowed & 4 || currentGuild.me.owner ? '<button data-new-channel="text" title="Metin kanalı oluştur">＋</button>' : ''}</div>
        ${currentGuild.channels.filter(c => c.type === 'text').map(c => `<button class="guild-channel${c.id === currentGuildChannel?.id ? ' on' : ''}" data-channel="${c.id}"><span>#</span>${esc(c.name)}${allowed & 4 || currentGuild.me.owner ? `<i data-channel-menu="${c.id}" title="Kanal ayarları">•••</i>` : ''}</button>`).join('') || '<small class="guild-empty-note">Henüz metin kanalı yok.</small>'}
        <div class="guild-category"><span>SESLİ KANALLAR</span>${allowed & 4 || currentGuild.me.owner ? '<button data-new-channel="voice" title="Ses kanalı oluştur">＋</button>' : ''}</div>
        ${currentGuild.channels.filter(c => c.type === 'voice').map(c => `<div class="guild-voice-channel"><button class="guild-channel${c.id === currentGuildChannel?.id ? ' on' : ''}" data-channel="${c.id}"><span class="voice-channel-glyph" aria-hidden="true"></span>${esc(c.name)}${allowed & 4 || currentGuild.me.owner ? `<i data-channel-menu="${c.id}" title="Kanal ayarları">•••</i>` : ''}</button>${(c.participants || []).length ? `<div class="guild-voice-list">${c.participants.map(participant => `<div class="guild-voice-member${participant.speaking ? ' speaking' : ''}" data-voice-member="${participant.id}" title="${esc(participant.displayName)}${participant.streaming ? ' · Yayında' : ''}">${av(participant)}<span class="guild-voice-member-name">${esc(participant.displayName)}</span>${tagPreview(participant)}${participant.streaming ? '<i class="voice-live-badge">YAYINDA</i>' : ''}</div>`).join('')}</div>` : ''}</div>`).join('') || '<small class="guild-empty-note">Henüz ses kanalı yok.</small>'}
      </div>` : `<div class="guild-empty"><span>▦</span><b>Sunucuların burada</b><p>Bir sunucu oluştur veya davet bağlantısıyla katıl.</p><button class="btn primary" data-new-server>Sunucu oluştur</button><button class="btn" data-join-server>Davetle katıl</button></div>`}
       <footer class="guild-user"><button data-guild-profile data-self-context title="Profili gör" aria-label="Hesap menüsünü aç">${av(me)}<span><b>${esc(me.displayName)}</b><small>@${esc(me.username)}</small></span></button>${profileTag(me)}<button data-guild-settings title="Ayarlar" aria-label="Ayarlar">${uiIcon('settings')}</button><button data-guild-logout title="Çıkış yap" aria-label="Çıkış yap">${uiIcon('logout')}</button></footer>
    </aside>
    <main class="guild-main" id="guild-main">${currentGuild ? guildMainMarkup() : '<div class="guild-welcome"><span>▦</span><h2>Bir sunucu seç</h2><p>Soldan bir sunucu aç veya yeni bir sunucu oluştur.</p></div>'}</main>
  </div>`;
  if (preserveTogetherPanel) $('[data-watch-together-panel]')?.replaceWith(previousWatchPanel);
  if (previousChannelListScroll !== null) $('.guild-channel-list')?.scrollTo({ top: previousChannelListScroll });
  if (previousMembersScroll !== null) $('.guild-members')?.scrollTo({ top: previousMembersScroll });
  if (previousRailScroll !== null) $('.guild-rail')?.scrollTo({ top: previousRailScroll });
  renderServerRail();
  bindGuildRail();
  renderedGuildId = Number(currentGuildId) || null;
  renderedGuildChannelId = Number(currentGuildChannel?.id) || null;
  const guildHeader = $('.guild-side-head');
  if (guildHeader && currentGuild?.banner) {
    guildHeader.classList.add('has-banner');
    guildHeader.style.backgroundImage = 'linear-gradient(0deg,#0b0d12d9 0%,#0b0d124e 78%,#0b0d121c 100%),url("' + currentGuild.banner + '")';
  }
  const guildUser = $('.guild-user');
  guildUser.insertAdjacentHTML('beforeend', accountMenuMarkup());
  bindAccountMenu(guildUser, $('[data-guild-profile]', guildUser), $('.account-menu', guildUser), () => {
    renderGuildView();
    renderServerRail();
  });
  $('.guild-side')?.querySelectorAll('[data-new-server]').forEach(b => b.onclick = newGuildModal);
  $('.guild-side')?.querySelectorAll('[data-join-server]').forEach(b => b.onclick = joinGuildModal);
  $('[data-guild-settings]')?.addEventListener('click', async () => { await boot(false); stab = 'profile'; setView('settings'); });
  $('[data-guild-logout]')?.addEventListener('click', logoutUser);
  $('[data-server-menu]')?.addEventListener('click', serverMenuModal);
  root.querySelectorAll('[data-new-channel]').forEach(b => b.onclick = () => channelModal(b.dataset.newChannel));
  root.querySelectorAll('[data-channel]').forEach(b => b.onclick = () => selectGuildChannel(+b.dataset.channel));
  root.querySelectorAll('[data-channel-menu]').forEach(b => b.onclick = e => { e.stopPropagation(); channelMenuModal(+b.dataset.channelMenu); });
  root.querySelectorAll('[data-channel]').forEach(b => b.oncontextmenu = e => {
    e.preventDefault(); e.stopPropagation();
    openChannelContextMenu(+b.dataset.channel, e.clientX, e.clientY);
  });
  root.querySelectorAll('[data-member-profile]').forEach(b => {
    b.onclick = () => openServerMemberCard(+b.dataset.memberProfile).catch(er => toast(er.message, 1));
    b.oncontextmenu = e => {
      e.preventDefault(); e.stopPropagation();
      const member = currentGuild?.members.find(item => item.id === Number(b.dataset.memberProfile));
      if (member) userContextMenu(e.clientX, e.clientY, member);
    };
  });
  root.querySelectorAll('[data-role-manage]').forEach(b => b.onclick = roleModal);
  root.querySelectorAll('[data-guild-invite]').forEach(b => b.onclick = createGuildInvite);
  root.querySelectorAll('[data-voice-join]').forEach(b => b.onclick = async () => {
    if (voiceJoining) return;
    b.disabled = true; b.textContent = 'Bağlanıyor...';
    try { await joinVoice(); }
    catch (er) { toast(er.message, 1); if (b.isConnected) { b.disabled = false; b.textContent = 'Ses kanalına katıl'; } }
  });
  root.querySelectorAll('[data-voice-leave]').forEach(b => b.onclick = leaveVoice);
  root.querySelectorAll('[data-voice-mute]').forEach(b => b.onclick = toggleVoiceMute);
  root.querySelectorAll('[data-voice-share]').forEach(b => {
    b.onclick = () => (screenStream ? stopScreenShare() : openScreenShareSetup()).catch(er => toast(er.message, 1));
    bindScreenShareContextMenu(b);
  });
  root.querySelectorAll('[data-watch-together-open]').forEach(b => b.onclick = openWatchTogetherModal);
  $('[data-guild-back]')?.addEventListener('click', () => $('#app')?.classList.remove('channel-open'));
  const membersToggle = $('[data-guild-members]'), textLayout = $('.guild-text-layout');
  if (membersToggle && textLayout) {
    const closeMembers = () => { textLayout.classList.remove('members-open'); membersToggle.setAttribute('aria-expanded', 'false'); };
    membersToggle.addEventListener('click', () => {
      const open = textLayout.classList.toggle('members-open');
      membersToggle.setAttribute('aria-expanded', String(open));
    });
    textLayout.addEventListener('click', event => {
      if (textLayout.classList.contains('members-open') && !event.target.closest('.guild-members') && !event.target.closest('[data-guild-members]')) closeMembers();
    });
  }
  if (currentGuildChannel?.type === 'text') refreshGuildMessages(false, previousMessageScroll).catch(er => toast(er.message, 1));
  updateVoicePanel();
  renderTogetherWatch(preserveTogetherPanel);
  ensureVoiceDock();
}

function togetherPosition(session = watchTogetherSession) {
  if (!session) return 0;
  const elapsed = session.state === 'playing' ? Math.max(0, Date.now() - Number(session.updatedAt || Date.now())) / 1000 : 0;
  return Math.max(0, Number(session.position || 0) + elapsed);
}
function updateTogetherStatus() {
  const status = $('[data-watch-together-status]');
  if (!status || !watchTogetherSession) return;
  status.textContent = watchTogetherSession.platform === 'instagram'
    ? 'Instagram içeriği yerleşik oynatıcıda açılır; oynatma ve ses her katılımcıda ayrı kontrol edilir.'
    : watchTogetherSession.state === 'playing'
      ? `Senkron oynatılıyor · ${watchTogetherSession.hostName || 'Oturum sahibi'} yönetiyor`
      : `Duraklatıldı · ${watchTogetherSession.hostName || 'Oturum sahibi'} başlatabilir`;
}
function teardownTogetherPlayer(preserveSession = true, publishSync = true) {
  togetherPlayerGeneration++; togetherPlayerInitSessionId = '';
  if (togetherSyncTimer) clearInterval(togetherSyncTimer);
  togetherSyncTimer = null;
  if (togetherPlayer && togetherPlayerReady) {
    try {
      const position = Number(togetherPlayer.getCurrentTime?.()) || 0;
      if (publishSync && watchTogetherSession && watchTogetherSession.hostId === me?.id) {
        watchTogetherSession = { ...watchTogetherSession, position, updatedAt: Date.now() };
        api(`/server-channels/${watchTogetherSession.channelId}/watch-together`, 'POST', { action: 'sync', position }).catch(() => {});
      }
    } catch {}
  }
  try { togetherPlayer?.destroy?.(); } catch {}
  togetherPlayer = null; togetherPlayerReady = false; togetherPlayerSessionId = '';
  if (!preserveSession) togetherJoined = false;
}
function loadTogetherYouTubeApi() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (togetherApiPromise) return togetherApiPromise;
  togetherApiPromise = new Promise((resolve, reject) => {
    let settled = false, script = null;
    const fail = error => {
      if (settled) return;
      settled = true; clearTimeout(timeout);
      if (script) { script.dataset.avenFailed = 'true'; script.remove(); }
      reject(error);
    };
    const timeout = setTimeout(() => fail(new Error('YouTube bağlantısı zamanında kurulamadı.')), 18000);
    const priorReady = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      try { priorReady?.(); } catch {}
      resolve(window.YT);
    };
    script = document.querySelector('script[src="https://www.youtube.com/iframe_api"]');
    if (script?.dataset.avenFailed === 'true') { script.remove(); script = null; }
    if (!script) {
      script = document.createElement('script'); script.src = 'https://www.youtube.com/iframe_api'; script.async = true;
    }
    script.addEventListener('error', () => fail(new Error('YouTube bağlantısı kurulamadı. Bu tarayıcı veya ağ YouTube’a erişemiyor olabilir.')), { once: true });
    if (!script.isConnected) document.head.append(script);
  }).catch(error => { togetherApiPromise = null; throw error; });
  return togetherApiPromise;
}
function showTogetherYouTubeUnavailable(sessionId, error) {
  if (watchTogetherSession?.sessionId !== sessionId) return;
  const status = $('[data-watch-together-status]');
  if (status) status.textContent = error.message;
  const join = $('[data-watch-together-join]');
  if (join) { join.disabled = true; join.textContent = 'YouTube bağlantısı yok'; }
  const frame = $('.together-video-frame');
  if (!frame) return;
  frame.innerHTML = `<div class="together-unavailable"><p>${esc(error.message)}</p><div><a href="${esc(watchTogetherSession.url)}" target="_blank" rel="noopener noreferrer">YouTube’da aç ↗</a><button type="button" data-watch-together-retry>Yeniden dene</button></div></div>`;
  $('[data-watch-together-retry]', frame)?.addEventListener('click', () => {
    const current = watchTogetherSession;
    if (!current || current.sessionId !== sessionId) return;
    const failedScript = document.querySelector('script[src="https://www.youtube.com/iframe_api"]');
    failedScript?.remove(); togetherApiPromise = null;
    teardownTogetherPlayer(true, false);
    frame.innerHTML = '<div id="together-youtube-player"></div>';
    initTogetherYouTube(current);
  });
}
function initTogetherYouTube(session) {
  const sessionId = session.sessionId;
  if (togetherPlayerInitSessionId === sessionId) return;
  togetherPlayerInitSessionId = sessionId;
  const generation = togetherPlayerGeneration;
  loadTogetherYouTubeApi().then(YT => {
    if (generation !== togetherPlayerGeneration || !YT?.Player || !document.getElementById('together-youtube-player') || watchTogetherSession?.sessionId !== sessionId) return;
    togetherPlayerInitSessionId = '';
    const isHost = Number(session.hostId) === Number(me?.id);
    togetherPlayerSessionId = sessionId;
    togetherPlayer = new YT.Player('together-youtube-player', {
      width: '100%', height: '100%', videoId: session.videoId,
      playerVars: { autoplay: 0, controls: isHost ? 1 : 0, enablejsapi: 1, playsinline: 1, rel: 0, origin: location.origin },
      events: {
        onReady: event => {
          if (watchTogetherSession?.sessionId !== sessionId) return;
          togetherPlayerReady = true;
          const join = $('[data-watch-together-join]');
          if (join) { join.disabled = false; join.textContent = isHost ? 'İzlemeyi başlat' : 'İzlemeye katıl'; }
          if (togetherJoined) {
            event.target.seekTo(togetherPosition(), true);
            if (watchTogetherSession.state === 'playing') event.target.playVideo();
          }
          updateTogetherStatus();
          if (isHost) togetherSyncTimer = setInterval(() => {
            if (!togetherPlayerReady || !togetherPlayer || togetherPlayer.getPlayerState?.() !== 1) return;
            const position = Number(togetherPlayer.getCurrentTime?.()) || 0;
            watchTogetherSession = { ...watchTogetherSession, position, state: 'playing', updatedAt: Date.now() };
            publishTogetherAction('sync', position);
          }, 4000);
        },
        onStateChange: event => {
          if (!isHost || togetherApplyingRemote || watchTogetherSession?.sessionId !== sessionId) return;
          if (event.data === YT.PlayerState.PLAYING) publishTogetherAction('play', Number(event.target.getCurrentTime?.()) || 0);
          else if (event.data === YT.PlayerState.PAUSED || event.data === YT.PlayerState.ENDED) publishTogetherAction('pause', Number(event.target.getCurrentTime?.()) || 0);
        },
        onError: event => {
          const status = $('[data-watch-together-status]');
          if (status) status.textContent = `YouTube bu videoyu gömülü oynatmaya izin vermedi (hata ${event.data}). Başka bir bağlantı deneyin.`;
        }
      }
    });
  }).catch(error => {
    showTogetherYouTubeUnavailable(sessionId, error);
  });
}
async function publishTogetherAction(action, position) {
  const session = watchTogetherSession;
  if (!session || Number(session.hostId) !== Number(me?.id) || !voiceSession || session.channelId !== voiceSession.channelId) return;
  try {
    const result = await api(`/server-channels/${session.channelId}/watch-together`, 'POST', { action, position });
    if (watchTogetherSession?.sessionId === result.sessionId) watchTogetherSession = result;
    updateTogetherStatus();
  } catch (error) {
    if (action !== 'sync') toast(`İzleme durumu eşitlenemedi: ${error.message}`, 1);
  }
}
function applyTogetherUpdate(update) {
  if (!togetherJoined || !togetherPlayerReady || !togetherPlayer || update.platform !== 'youtube') return;
  try {
    const target = togetherPosition(update), current = Number(togetherPlayer.getCurrentTime?.()) || 0;
    if (Math.abs(target - current) > 1.6) togetherPlayer.seekTo(target, true);
    const playerState = togetherPlayer.getPlayerState?.();
    togetherApplyingRemote = true;
    if (update.action === 'play' || (update.state === 'playing' && playerState !== 1)) togetherPlayer.playVideo();
    else if (update.action === 'pause' || (update.state !== 'playing' && playerState === 1)) togetherPlayer.pauseVideo();
    setTimeout(() => { togetherApplyingRemote = false; }, 700);
  } catch { togetherApplyingRemote = false; }
}
function ensureInstagramEmbed() {
  if (window.instgrm?.Embeds) { window.instgrm.Embeds.process(); return; }
  if (instagramEmbedPromise) { instagramEmbedPromise.then(() => window.instgrm?.Embeds?.process()).catch(() => {}); return; }
  instagramEmbedPromise = new Promise((resolve, reject) => {
    let script = document.querySelector('script[src="https://www.instagram.com/embed.js"]');
    const isNew = !script;
    if (!script) { script = document.createElement('script'); script.src = 'https://www.instagram.com/embed.js'; script.async = true; }
    script.addEventListener('load', () => { script.dataset.avenLoaded = 'true'; resolve(); }, { once: true });
    script.addEventListener('error', () => reject(new Error('Instagram yerleşik oynatıcısı yüklenemedi.')), { once: true });
    if (window.instgrm?.Embeds || script.dataset.avenLoaded === 'true') resolve();
    else if (isNew) document.head.append(script);
    setTimeout(() => reject(new Error('Instagram yerleşik oynatıcısı zamanında yüklenemedi.')), 15000);
  }).catch(error => { instagramEmbedPromise = null; const status = $('[data-watch-together-status]'); if (status) status.textContent = error.message; });
}
function renderTogetherWatch(preservePlayer = false) {
  const panel = $('[data-watch-together-panel]');
  const session = watchTogetherSession;
  if (!panel) { teardownTogetherPlayer(true); return; }
  const relevant = session && voiceSession?.kind !== 'dm' && Number(session.channelId) === Number(currentGuildChannel?.id) && currentGuildChannel?.type === 'voice';
  if (!relevant) {
    panel.parentElement?.classList.remove('watch-active');
    panel.hidden = true; panel.innerHTML = '';
    if (togetherPlayer) teardownTogetherPlayer(true);
    return;
  }
  panel.parentElement?.classList.add('watch-active');
  panel.dataset.sessionId = session.sessionId;
  if (preservePlayer && togetherPlayer && togetherPlayerSessionId === session.sessionId && session.platform === 'youtube') {
    updateTogetherStatus();
    return;
  }
  if (togetherPlayerSessionId && togetherPlayerSessionId !== session.sessionId) {
    teardownTogetherPlayer(false, false); togetherJoined = false;
  }
  panel.hidden = false;
  const isHost = Number(session.hostId) === Number(me?.id);
  const endButton = isHost || !!(currentGuildChannel.permissions & 16)
    ? '<button type="button" class="btn danger" data-watch-together-end>Bitir</button>' : '';
  const localControls = session.platform === 'youtube'
    ? `<button type="button" class="btn primary" data-watch-together-join ${togetherPlayerReady ? '' : 'disabled'} ${togetherJoined ? 'hidden' : ''}>${togetherPlayerReady ? (isHost ? 'İzlemeyi başlat' : 'İzlemeye katıl') : 'Oynatıcı yükleniyor…'}</button><button type="button" class="btn" data-watch-together-local-leave ${togetherJoined ? '' : 'hidden'}>İzlemeden ayrıl</button>`
    : '';
  panel.innerHTML = `<header class="together-heading"><div><small>BERABER İZLE · BETA</small><b>${session.platform === 'youtube' ? 'YouTube' : 'Instagram'} · ${esc(session.hostName || 'Oturum sahibi')}</b></div><span data-watch-together-status class="together-status"></span><div class="together-actions">${localControls}${endButton}</div></header>${session.platform === 'youtube'
    ? '<div class="together-video-frame"><div id="together-youtube-player"></div></div>'
    : `<div class="together-instagram-embed"><blockquote class="instagram-media" data-instgrm-permalink="${esc(session.url)}" data-instgrm-version="14"></blockquote></div>`}`;
  updateTogetherStatus();
  $('[data-watch-together-join]', panel)?.addEventListener('click', () => {
    if (!togetherPlayerReady || !togetherPlayer) return;
    const currentSession = watchTogetherSession;
    if (!currentSession || currentSession.sessionId !== session.sessionId) return;
    togetherJoined = true;
    const position = togetherPosition(currentSession);
    togetherPlayer.seekTo(position, true);
    if (Number(currentSession.hostId) === Number(me?.id) || currentSession.state === 'playing') togetherPlayer.playVideo();
    else togetherPlayer.pauseVideo();
    const join = $('[data-watch-together-join]', panel); if (join) join.hidden = true;
    const leave = $('[data-watch-together-local-leave]', panel); if (leave) leave.hidden = false;
    const status = $('[data-watch-together-status]', panel);
    if (status && !isHost && currentSession.state !== 'playing') status.textContent = 'İzlemeye bağlandın · oturum sahibi başlatınca oynatılır';
  });
  $('[data-watch-together-local-leave]', panel)?.addEventListener('click', () => {
    togetherJoined = false; try { togetherPlayer?.pauseVideo?.(); } catch {}
    const join = $('[data-watch-together-join]', panel), leave = $('[data-watch-together-local-leave]', panel);
    if (join) join.hidden = false;
    if (leave) leave.hidden = true;
    updateTogetherStatus();
  });
  $('[data-watch-together-end]', panel)?.addEventListener('click', async () => {
    try {
      await api(`/server-channels/${session.channelId}/watch-together`, 'POST', { action: 'clear' });
      watchTogetherSession = null; togetherJoined = false; teardownTogetherPlayer(false, false); renderTogetherWatch();
    } catch (error) { toast(error.message, 1); }
  });
  if (session.platform === 'youtube' && (!togetherPlayer || togetherPlayerSessionId !== session.sessionId)) initTogetherYouTube(session);
  else if (session.platform === 'instagram') ensureInstagramEmbed();
}
function openWatchTogetherModal() {
  if (!voiceSession || voiceSession.kind === 'dm' || Number(voiceSession.channelId) !== Number(currentGuildChannel?.id)) {
    toast('Beraber İzle için önce bu ses kanalına bağlan.', 1); return;
  }
  guildForm(`<header><small>BERABER İZLE · BETA</small><h2>Birlikte video izle</h2><p>Bir YouTube videosu veya herkese açık Instagram gönderisi/Reels bağlantısı ekle.</p></header><label>Video bağlantısı<input name="watchUrl" type="url" required maxlength="500" placeholder="https://www.youtube.com/watch?v=…"></label><p class="guild-form-note">YouTube oynatma her katılımcının tarayıcısında açılır; YouTube reklamları gösterilebilir. Instagram içeriği resmi yerleşik oynatıcıda açılır ve eşzamanlı kontrol desteklemez.</p><footer><button type="button" class="btn" data-watch-cancel>İptal</button><button type="submit" class="btn primary">Bağlantıyı başlat</button></footer>`, async (form, close) => {
    const result = await api(`/server-channels/${voiceSession.channelId}/watch-together`, 'POST', { action: 'set', url: form.elements.watchUrl.value });
    watchTogetherSession = result; togetherJoined = false; teardownTogetherPlayer(false, false); close(); renderGuildView();
  });
  const modal = $('.guild-modal');
  $('[data-watch-cancel]', modal)?.addEventListener('click', () => modal.remove());
}

function screenShareIcon() {
  return '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="4" width="17" height="12" rx="2"></rect><path d="M8 20h8M12 16v4M9 9h6M12 7v4"></path></svg>';
}

function guildMainMarkup() {
  if (!currentGuildChannel) return `<div class="guild-welcome"><span>▦</span><h2>${esc(currentGuild.name)}</h2><p>Henüz erişebildiğin bir kanal yok. Sunucu yöneticisinden kanal izni isteyebilirsin.</p>${currentGuild.me.owner ? '<button class="btn primary" data-new-channel="text">Metin kanalı oluştur</button>' : ''}</div>`;
  const c = currentGuildChannel, canManage = !!(currentGuild.me.permissions & 4) || currentGuild.me.owner;
  const members = guildMemberGroups();
  if (c.type === 'voice') return `<header class="guild-chat-head"><button class="guild-mobile-back" data-guild-back title="Kanallara dön" aria-label="Kanallara dön">←</button><div><b><span class="voice-channel-glyph" aria-hidden="true"></span> ${esc(c.name)}</b><small>${esc(c.topic || 'Sesli konuşmaya katıl')}</small></div></header>
    <section class="guild-voice-area"><div class="voice-panel" id="voice-panel" role="list" aria-live="polite"></div><section class="watch-together-panel" data-watch-together-panel hidden></section>
      <div class="voice-stream-stage" id="voice-stream-stage"></div>
      <footer class="voice-control-bar"><small class="voice-capacity-note">Ses ve ekran paylaşımı bu kanaldaki katılımcılara iletilir.</small>
        <div class="voice-actions">${Number(voiceSession?.channelId) === Number(c.id) ? `${voiceSession.canSpeak && voiceStream ? '<button class="btn" data-voice-mute>Mikrofonu kapat</button>' : ''}<button class="btn voice-share-button${voiceStreaming ? ' active' : ''}" data-voice-share>${screenShareIcon()}<span>${voiceStreaming ? 'Yayını durdur' : 'Ekranını yayınla'}</span></button><button type="button" class="btn together-open-button" data-watch-together-open>Beraber İzle <small>(BETA)</small></button><button class="btn danger" data-voice-leave>Bağlantıyı kes</button>` : '<button class="btn primary" data-voice-join>Ses kanalına katıl</button>'}</div>
      </footer>
    </section>`;
  return `<header class="guild-chat-head"><button class="guild-mobile-back" data-guild-back title="Kanallara dön" aria-label="Kanallara dön">←</button><div><b>${c.type === 'voice' ? '◖' : '#'} ${esc(c.name)}</b><small>${esc(c.topic || currentGuild.name)}${!c.topic && currentGuild.verified ? verifiedServerBadge('verified-server-badge-inline') : ''}</small></div><button type="button" class="guild-mobile-members" data-guild-members aria-label="Üyeleri göster" aria-expanded="false" title="Üyeler">${uiIcon('users')}<span>${currentGuild.members.length}</span></button>${canManage ? `<button class="btn sm" data-channel-menu="${c.id}" aria-label="Kanal ayarları" title="Kanal ayarları">Kanal ayarları</button>` : ''}</header>
    <section class="guild-text-layout"><div class="guild-text-column"><div class="guild-chat-msgs" id="guild-chat-msgs"><div class="guild-loading">Mesajlar yükleniyor…</div></div>
    ${(c.permissions & 2) ? `<form class="guild-composer">${c.permissions & 512 ? '<label class="guild-attach" title="Fotoğraf yükle">＋<input type="file" accept="image/png,image/jpeg,image/gif,image/webp" multiple hidden></label>' : ''}<textarea rows="1" maxlength="2000" placeholder="#${esc(c.name)} kanalına mesaj gönder"></textarea><button class="btn primary">Gönder</button></form>` : '<div class="guild-readonly">Bu kanalda mesaj göndermek için iznin yok.</div>'}</div>
    ${members}</section>`;
}

function guildMemberGroups() {
  const online = currentGuild.members.filter(member => member.online !== false), offline = currentGuild.members.filter(member => member.online === false);
  const channelVoiceMembers = currentGuild.channels.filter(channel => channel.type === 'voice').flatMap(channel => channel.participants || []);
  const voiceIds = new Set(channelVoiceMembers.map(member => member.id));
  const speakingIds = new Set(channelVoiceMembers.filter(member => member.speaking).map(member => member.id));
  const streamingIds = new Set(channelVoiceMembers.filter(member => member.streaming).map(member => member.id));
  const groups = [];
  // @everyone is an implicit baseline permission role, not a member-list badge.
  const sortedRoles = currentGuild.roles.filter(role => !role.everyone).sort((a, b) => b.position - a.position);
  const assignedRoles = member => member.roleIds.map(id => currentGuild.roles.find(role => role.id === id)).filter(role => role && !role.everyone).sort((a, b) => b.position - a.position);
  const highestRoles = new Map(currentGuild.members.map(member => [member.id, assignedRoles(member)[0]?.id]));
  const hoistedRoles = new Map(online.map(member => [member.id, assignedRoles(member).find(role => role.displaySeparately)?.id]));
  for (const role of sortedRoles.filter(role => role.displaySeparately)) {
    const members = online.filter(member => hoistedRoles.get(member.id) === role.id);
    if (members.length) groups.push({ title: role.name, color: role.color, members });
  }
  const groupedIds = new Set(groups.flatMap(group => group.members.map(member => member.id)));
  const ungrouped = online.filter(member => !groupedIds.has(member.id));
  if (ungrouped.length) groups.push({ title: 'Çevrimiçi', members: ungrouped });
  if (offline.length) groups.push({ title: 'Çevrimdışı', members: offline });
  const content = groups.map(group => `<section class="guild-member-group"><header${group.color ? ` style="--member-role-color:${esc(group.color)}"` : ''}>${esc(group.title)} <span>${group.members.length}</span></header>${group.members.map(member => {
    const highest = currentGuild.roles.find(role => role.id === highestRoles.get(member.id));
    const badge = highest ? `<small class="guild-member-role" style="--member-role-color:${esc(highest.color)}">${esc(highest.name)}</small>` : '';
    return `<div class="guild-member${member.online ? '' : ' offline'}${voiceIds.has(member.id) ? ' in-voice' : ''}${speakingIds.has(member.id) ? ' speaking' : ''}" data-member-id="${member.id}">
      <div class="guild-member-identity"><button type="button" class="guild-member-profile" data-member-profile="${member.id}" title="${esc(member.displayName)} profilini gör"><span class="guild-member-avatar">${av(member)}<i class="guild-presence-dot ${esc(member.presence || (member.online === false ? 'offline' : 'online'))}"></i></span>
      <span class="guild-member-meta"><b><span class="guild-member-name">${esc(member.displayName)}</span>${Number(member.id) === Number(currentGuild.ownerId) ? '<img class="owner-mark" src="/image/sunucusahibi_tac.png?v=20261012.5" alt="Sunucu sahibi" title="Sunucu sahibi">' : ''}</b>${badge}<small class="guild-member-username">@${esc(member.username)}</small></span></button>${tagPreview(member)}</div>
      ${streamingIds.has(member.id) ? '<span class="guild-member-stream" title="Ekranını yayınlıyor">YAYINDA</span>' : voiceIds.has(member.id) ? '<span class="guild-member-voice" title="Ses kanalında"><i class="voice-channel-glyph"></i></span>' : ''}
    </div>`;
  }).join('')}</section>`).join('');
  return `<aside class="guild-members"><header><span>ÜYELER</span><b>${currentGuild.members.length}</b></header>${content || '<p class="guild-members-empty">Henüz üye yok.</p>'}</aside>`;
}

async function selectGuildChannel(id, routeMode = 'push') {
  if (!currentGuild?.channels.some(c => c.id === id)) return;
  const selectionToken = ++guildChannelToken;
  currentGuildChannel = currentGuild.channels.find(c => c.id === id);
  writeAppRoute({ kind: 'server', serverId: currentGuildId, publicId: currentGuild.publicId, channelId: currentGuildChannel.id }, routeMode);
  if (currentGuildChannel.type !== 'voice') voiceMembers = [];
  guildMessageIds = new Set();
  const app = $('.guild-app');
  app?.classList.add('channel-switching');
  if (selectionToken !== guildChannelToken) return;
  renderGuildView(false);
  if (currentGuildChannel.type === 'voice') loadVoiceMembers(id).catch(er => toast(er.message, 1));
}

function guildMessageMarkup(m) {
  if (m.kind === 'system') return `<article class="guild-system-message" data-guild-message="${m.id}"><small>AVEN · SUNUCU BİLDİRİMİ</small><p>${esc(m.body)}</p><time>${fmt(m.createdAt)}</time></article>`;
  const canDelete = m.author.id === me.id || !!(currentGuildChannel?.permissions & 16);
  const content = m.kind === 'image' && m.file
    ? `<img class="guild-image" src="/api/files/${esc(m.file)}" alt="Paylaşılan fotoğraf" loading="lazy">`
    : `<p>${esc(m.body)}</p>`;
  return `<article class="guild-message" data-guild-message="${m.id}">${av(m.author)}<div><header><b class="guild-message-author"><span>${esc(m.author.displayName)}</span>${tagPreview(m.author)}</b><small>${fmt(m.createdAt)}${m.edited ? ' · düzenlendi' : ''}</small>${canDelete ? `<button data-delete-guild-message="${m.id}" title="Mesajı sil">Sil</button>` : ''}</header>${content}</div></article>`;
}
function guildOnboardingMarkup(channel) {
  return `<section class="guild-onboarding">
    <h2>${esc(currentGuild.name)} sunucusunun<br>${esc(channel.name)} kanalına hoş geldin!</h2>
    <p>Burası senin yeni sunucun. Başlamak için birkaç adım atalım.</p>
    <div class="guild-onboarding-steps">
      <button type="button" class="guild-onboarding-step" data-onboarding-action="message"><span>➤</span><b>İlk mesajını yaz</b><i>›</i></button>
      <button type="button" class="guild-onboarding-step" data-onboarding-action="copy-invite"><span>↗</span><b>Sunucu davet bağlantısını kopyala</b><i>›</i></button>
      <button type="button" class="guild-onboarding-step" data-onboarding-action="invite-friends"><span>♧</span><b>Arkadaşlarını davet et</b><i>›</i></button>
    </div>
  </section>`;
}
async function refreshGuildMessages(quiet = false, preservedScrollTop = null) {
  if (!guildMode || currentGuildChannel?.type !== 'text') return;
  const channelId = currentGuildChannel.id;
  const list = await api(`/server-channels/${channelId}/messages`);
  if (Number(currentGuildChannel?.id) !== Number(channelId)) return;
  const box = $('#guild-chat-msgs'); if (!box) return;
  const previousScrollTop = box.scrollTop;
  const stickToBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 48;
  if (!box.dataset.deleteBound) {
    box.dataset.deleteBound = '1';
    box.onclick = async e => {
      const onboarding = e.target.closest('[data-onboarding-action]');
      if (onboarding) {
        const action = onboarding.dataset.onboardingAction;
        if (action === 'message') $('.guild-composer textarea')?.focus();
        else if (action === 'copy-invite') copyGuildInvite(currentGuildId).catch(er => toast(er.message, 1));
        else if (action === 'invite-friends') inviteFriendsModal(currentGuildId).catch(er => toast(er.message, 1));
        return;
      }
      const image = e.target.closest('.guild-image');
      if (image) { lightbox(image.src); return; }
      const button = e.target.closest('[data-delete-guild-message]'); if (!button) return;
      if (!confirm('Bu sunucu mesajı silinsin mi?')) return;
      button.disabled = true;
      try { await api('/server-messages/' + button.dataset.deleteGuildMessage, 'DELETE'); $(`[data-guild-message="${button.dataset.deleteGuildMessage}"]`)?.remove(); guildMessageIds.delete(Number(button.dataset.deleteGuildMessage)); }
      catch (er) { toast(er.message, 1); button.disabled = false; }
    };
  }
  if (quiet) {
    list.filter(m => !guildMessageIds.has(m.id)).forEach(m => { guildMessageIds.add(m.id); box.insertAdjacentHTML('beforeend', guildMessageMarkup(m)); });
  } else {
    guildMessageIds = new Set(list.map(m => m.id));
    box.innerHTML = list.length ? list.map(guildMessageMarkup).join('') : guildOnboardingMarkup(currentGuildChannel);
  }
  box.scrollTop = Number.isFinite(preservedScrollTop)
    ? Math.min(preservedScrollTop, Math.max(0, box.scrollHeight - box.clientHeight))
    : quiet && !stickToBottom ? previousScrollTop : list.length ? box.scrollHeight : 0;
  const form = $('.guild-composer');
  if (form && !form.dataset.bound) {
    form.dataset.bound = '1';
    const input = $('textarea', form);
    input.oninput = () => { input.style.height = 'auto'; input.style.height = `${input.scrollHeight}px`; };
    input.onkeydown = e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); form.requestSubmit(); } };
    form.onsubmit = async e => {
      e.preventDefault(); const body = input.value.trim(); if (!body) return;
      input.value = ''; input.style.height = 'auto';
      try { appendGuildMessage(await api(`/server-channels/${currentGuildChannel.id}/messages`, 'POST', { body })); }
      catch (er) { toast(er.message, 1); input.value = body; }
    };
    const fileInput = $('.guild-attach input', form);
    if (fileInput) fileInput.onchange = e => {
      [...e.target.files].forEach(file => uploadGuildFile(file, channelId));
      e.target.value = '';
    };
  }
}
function appendGuildMessage(m) {
  if (guildMessageIds.has(m.id)) return;
  guildMessageIds.add(m.id);
  const box = $('#guild-chat-msgs'); if (!box) return;
  const previousScrollTop = box.scrollTop;
  const stickToBottom = m.author?.id === me.id || box.scrollHeight - box.scrollTop - box.clientHeight < 48;
  $('.guild-chat-empty,.guild-onboarding', box)?.remove(); box.insertAdjacentHTML('beforeend', guildMessageMarkup(m));
  box.scrollTop = stickToBottom ? box.scrollHeight : previousScrollTop;
}
async function uploadGuildFile(file, channelId) {
  if (!/^(image\/(png|jpeg|gif|webp))$/.test(file.type)) return toast('Yalnızca PNG, JPG, GIF veya WEBP fotoğraf yüklenebilir.', 1);
  if (file.size > 100 * 1024 * 1024) return toast('Fotoğraf sıkıştırma öncesi 100 MB sınırını aşıyor.', 1);
  const notice = toast('Fotoğraf hazırlanıyor ve yükleniyor…', 0, 120000);
  try {
    const compressed = await compressDmImage(file);
    if (compressed.size > 25 * 1024 * 1024) throw new Error('Sıkıştırılmış fotoğraf 25 MB sınırını aşıyor.');
    const response = await fetch(`/api/server-channels/${channelId}/file`, { method: 'POST', headers: { 'Content-Type': compressed.type }, body: compressed });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Fotoğraf yüklenemedi.');
    if (Number(currentGuildChannel?.id) === Number(channelId)) appendGuildMessage(result);
    toast(compressed !== file ? 'Fotoğraf sıkıştırılarak gönderildi.' : 'Fotoğraf gönderildi.');
  } catch (er) { toast(er.message || 'Fotoğraf yüklenemedi.', 1); }
  finally { notice.remove(); }
}

async function loadVoiceMembers(channelId) {
  const members = await api(`/server-channels/${channelId}/voice-members`);
  if (!guilds.some(server => server.id === currentGuildId) || !currentGuild?.channels.some(item => Number(item.id) === Number(channelId))) return;
  const channel = currentGuild?.channels.find(item => Number(item.id) === Number(channelId));
  if (channel) channel.participants = members;
  if (Number(voiceSession?.channelId) === Number(channelId)) {
    voiceMembers = members;
    updateVoicePanel();
  } else if (guildMode) renderGuildView();
}
function handleIncomingDmCall(data) {
  if (!data?.callId || !data.from) return;
  if (voiceSession || incomingDmCall) {
    api(`/dm-calls/${data.callId}/reject`, 'POST').catch(() => {});
    return;
  }
  incomingDmCall = data;
  renderIncomingDmCall();
  const ringtone = appSoundPlayers.get('call') || new Audio(APP_SOUND_PATHS.call);
  appSoundPlayers.set('call', ringtone);
  ringtone.onended = () => { if (incomingDmCall?.callId === data.callId) rejectIncomingDmCall(true); };
  ringtone.onerror = () => {};
  ringtone.currentTime = 0; ringtone.volume = 0.78; ringtone.play().catch(() => {});
  clearTimeout(incomingCallTimeout);
  incomingCallTimeout = setTimeout(() => { if (incomingDmCall?.callId === data.callId) rejectIncomingDmCall(true); }, 44000);
}
function dismissIncomingDmCall() {
  clearTimeout(incomingCallTimeout); incomingCallTimeout = null;
  const ringtone = appSoundPlayers.get('call');
  if (ringtone) { ringtone.onended = null; ringtone.pause(); ringtone.currentTime = 0; }
  $('#dm-call-incoming')?.remove();
  incomingDmCall = null;
}
async function getVoiceMicrophone() {
  if (!navigator.mediaDevices?.getUserMedia) throw new Error('Mikrofon için güvenli HTTPS bağlantısı gerekli.');
  const audio = { echoCancellation: true, noiseSuppression: true, autoGainControl: true };
  if (voicePreferences.input) audio.deviceId = { exact: voicePreferences.input };
  try { return await navigator.mediaDevices.getUserMedia({ audio }); }
  catch (er) {
    const missingDevice = ['NotFoundError', 'OverconstrainedError', 'DevicesNotFoundError'].includes(er.name);
    if (voicePreferences.input && missingDevice) {
      voicePreferences.input = '';
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
        toast('Seçili mikrofon bulunamadı; varsayılan mikrofon kullanılıyor.', 1);
        return stream;
      } catch (fallbackError) { er = fallbackError; }
    }
    throw new Error(`Mikrofon açılamadı: ${er.message}`);
  }
}
async function getDmCallMicrophone() {
  const [, stream] = await Promise.all([loadVoiceIceConfig(), getVoiceMicrophone()]);
  return stream;
}
const DM_CALL_ICONS = {
  reject: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>',
  accept: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 16.4v3a2 2 0 0 1-2.2 2 19.7 19.7 0 0 1-8.6-3.1 19.4 19.4 0 0 1-6-6A19.7 19.7 0 0 1 1.2 3.7 2 2 0 0 1 3.2 1.5h3a2 2 0 0 1 2 1.7c.1.9.4 1.7.7 2.5a2 2 0 0 1-.5 2.1L7.1 9.1a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.5c.8.3 1.6.6 2.5.7a2 2 0 0 1 2 2.4Z"/></svg>',
  mic: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="2.5" width="6" height="12" rx="3"/><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3.5M9 21.5h6"/></svg>',
  micOff: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 9v2.5a3 3 0 0 0 5.1 2.1M15 9V5.5a3 3 0 0 0-5.7-1.3M5.5 11.5a6.5 6.5 0 0 0 11.2 4.5M12 18v3.5M9 21.5h6M3 3l18 18"/></svg>',
  share: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8M12 17v4M12 13V7m-3 3 3-3 3 3"/></svg>',
  hangup: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 14.2v2.3a2 2 0 0 0 2 2h2.7a2 2 0 0 0 1.9-1.4l.6-1.8a14.4 14.4 0 0 1 5.6 0l.6 1.8a2 2 0 0 0 1.9 1.4H20a2 2 0 0 0 2-2v-2.3a2 2 0 0 0-1.2-1.8 21 21 0 0 0-17.6 0A2 2 0 0 0 2 14.2Z"/></svg>',
  expand: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 4H4v4M16 4h4v4M4 16v4h4M20 16v4h-4M4 8l6-6M20 8l-6-6M4 16l6 6M20 16l-6 6"/></svg>',
  shrink: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/></svg>'
};
function renderIncomingDmCall(message = '') {
  if (!incomingDmCall) return;
  let layer = $('#dm-call-incoming');
  if (!layer) { layer = document.createElement('div'); layer.id = 'dm-call-incoming'; document.body.append(layer); }
  const caller = incomingDmCall.from;
  layer.className = 'dm-call-screen dm-call-incoming';
  layer.innerHTML = `<section class="dm-call-card" role="dialog" aria-modal="true" aria-labelledby="dm-call-incoming-title">
    <span class="dm-call-kicker">AVEN · GELEN ARAMA</span>
    <div class="dm-call-rings"><span></span><span></span><span></span><div class="dm-call-avatar">${av(caller, 'dm-call-avatar-image')}</div></div>
    <h2 id="dm-call-incoming-title">${esc(caller.displayName || 'Aven kullanıcısı')}</h2><p>@${esc(caller.username || '')} seni arıyor</p>
    <small class="dm-call-feedback">${esc(message || 'Sesli arama')}</small>
    <div class="dm-call-controls"><button type="button" class="dm-call-control reject" data-call-reject aria-label="Aramayı reddet" title="Reddet"${incomingDmCall.accepting ? ' disabled' : ''}>${DM_CALL_ICONS.reject}</button><button type="button" class="dm-call-control accept" data-call-accept aria-label="Aramayı kabul et" title="Kabul et"${incomingDmCall.accepting ? ' disabled' : ''}>${DM_CALL_ICONS.accept}</button></div>
    <span class="dm-call-control-labels"><small>Reddet</small><small>Kabul et</small></span>
  </section>`;
  $('[data-call-reject]', layer).onclick = () => rejectIncomingDmCall();
  $('[data-call-accept]', layer).onclick = () => {
    if (!incomingDmCall || incomingDmCall.accepting) return;
    incomingDmCall.accepting = true;
    renderIncomingDmCall('Mikrofon hazırlanıyor…');
    acceptIncomingDmCall().catch(er => {
      if (!voiceSession && voicePlaybackContext?.state === 'running') voicePlaybackContext.suspend().catch(() => {});
      if (incomingDmCall) { incomingDmCall.accepting = false; renderIncomingDmCall(er.message); }
      else toast(er.message, 1);
    });
  };
}
async function rejectIncomingDmCall(missed = false) {
  const call = incomingDmCall;
  if (!call) return;
  try { await api(`/dm-calls/${call.callId}/reject`, 'POST', { missed }); }
  catch (er) { if (er.code !== 404) toast(er.message, 1); }
  dismissIncomingDmCall();
}
async function acceptIncomingDmCall() {
  const call = incomingDmCall;
  if (!call) return;
  if (voiceSession) throw new Error('Önce açık olan aramayı bitir.');
  unlockVoicePlayback();
  const [, stream] = await Promise.all([loadVoiceIceConfig(), getDmCallMicrophone()]);
  playAppSound('action');
  voiceStream = stream;
  voiceSession = { kind: 'dm', callId: call.callId, peerId: call.from.id, peer: call.from, status: 'connecting', canSpeak: true };
  dismissIncomingDmCall();
  voiceMembers = [me, { ...call.from, speaking: false, streaming: false }];
  voiceSpeaking = false; voiceStreaming = false; dmCallMinimized = false; dmCallStartedAt = 0;
  renderDmCallScreen(); ensureVoiceDock();
  try {
    const result = await api(`/dm-calls/${call.callId}/accept`, 'POST');
    voiceSession.peer = result.peer;
    voiceMembers = [me, { ...result.peer, speaking: false, streaming: false }];
    await createVoicePeer(result.peer.id, false);
    startVoiceActivityMonitor(); startDmCallHeartbeat();
    renderDmCallScreen(); updateVoiceDock();
  } catch (er) {
    await leaveVoice(false, false).catch(() => {});
    throw er;
  }
}
async function startDmCall(peer) {
  if (!peer || peer.bot) throw new Error('Resmi bot hesapları aranamaz.');
  if (peer.online === false) throw new Error('Bu kullanıcı şu anda çevrim dışı.');
  if (voiceSession) {
    if (voiceSession.kind === 'dm' && Number(voiceSession.peerId) === Number(peer.id)) { showDmCallScreen(); return; }
    throw new Error('Önce açık olan aramayı bitir.');
  }
  if (incomingDmCall) throw new Error('Önce gelen aramayı yanıtla veya reddet.');
  if (dmCallStarting) return;
  dmCallStarting = true;
  unlockVoicePlayback();
  let stream;
  try {
    const [, microphone] = await Promise.all([loadVoiceIceConfig(), getDmCallMicrophone()]);
    stream = microphone;
    const result = await api('/dm-calls', 'POST', { targetId: Number(peer.id) });
    playAppSound('action');
    voiceStream = stream;
    voiceSession = { kind: 'dm', callId: result.callId, peerId: Number(peer.id), peer: result.peer || peer, status: 'calling', canSpeak: true };
    voiceMembers = [me, { ...(result.peer || peer), speaking: false, streaming: false }];
    voiceSpeaking = false; voiceStreaming = false; dmCallMinimized = false; dmCallStartedAt = 0;
    renderDmCallScreen(); ensureVoiceDock(); startDmCallHeartbeat();
  } catch (er) {
    stream?.getTracks().forEach(track => track.stop());
    if (!voiceSession && voicePlaybackContext?.state === 'running') voicePlaybackContext.suspend().catch(() => {});
    throw er;
  } finally { dmCallStarting = false; }
}
function startDmCallHeartbeat() {
  clearInterval(voiceHeartbeatTimer);
  const callId = voiceSession?.callId;
  if (!callId) return;
  voiceHeartbeatTimer = setInterval(() => api(`/dm-calls/${callId}/heartbeat`, 'POST').catch(er => {
    if (voiceSession?.kind !== 'dm' || voiceSession.callId !== callId) return;
    leaveVoice(false, false).finally(() => toast(`Arama bağlantısı kapandı: ${er.message}`, 1));
  }), 15000);
}
function showDmCallScreen() {
  if (voiceSession?.kind !== 'dm') return;
  dmCallMinimized = false;
  renderDmCallScreen(); updateVoiceDock();
}
function minimizeDmCall() {
  if (voiceSession?.kind !== 'dm') return;
  dmCallMinimized = true;
  const layer = $('#dm-call-screen'); if (layer) layer.hidden = true;
  renderVoiceVideos();
  updateVoiceDock();
}
function startDmCallClock() {
  clearInterval(dmCallElapsedTimer);
  dmCallElapsedTimer = setInterval(() => {
    const clock = $('#dm-call-duration');
    if (!clock || !dmCallStartedAt) return;
    const elapsed = Math.floor((Date.now() - dmCallStartedAt) / 1000);
    clock.textContent = `${String(Math.floor(elapsed / 60)).padStart(2, '0')}:${String(elapsed % 60).padStart(2, '0')}`;
  }, 1000);
}
function renderDmCallScreen() {
  if (voiceSession?.kind !== 'dm') return;
  let layer = $('#dm-call-screen');
  if (!layer) { layer = document.createElement('div'); layer.id = 'dm-call-screen'; document.body.append(layer); }
  releaseVoiceStage(layer.querySelector('.voice-stream-stage'));
  const peer = voiceSession.peer || friend(voiceSession.peerId) || { id: voiceSession.peerId, displayName: 'Aven kullanıcısı', username: '' };
  const status = voiceSession.status === 'calling' ? 'Karşı taraf aranıyor…' : voiceSession.status === 'active' ? 'Bağlandı' : 'Bağlanıyor…';
  const muted = !voiceStream?.getAudioTracks().some(track => track.enabled);
  layer.className = 'dm-call-screen dm-call-active'; layer.hidden = dmCallMinimized;
  layer.innerHTML = `<section class="dm-call-window" role="dialog" aria-modal="true" aria-label="${esc(peer.displayName)} ile sesli arama">
    <header class="dm-call-topbar"><span><i class="dm-call-live-dot"></i> ${voiceSession.status === 'calling' ? 'Aranıyor' : 'Bir aramada'}</span><span class="dm-call-top-name">${esc(peer.displayName)}</span><button type="button" data-call-minimize title="Küçült ve sohbete dön" aria-label="Küçült">−</button></header>
    <main class="dm-call-stage">
      <div class="dm-call-participants">
        <article class="dm-call-person${voiceSpeaking ? ' speaking' : ''}"><div class="dm-call-avatar">${av(me, 'dm-call-avatar-image')}</div><b>${esc(me.displayName)} <small>(Sen)</small></b><span>${muted ? 'Mikrofon kapalı' : voiceSpeaking ? 'Konuşuyor' : 'Dinliyor'}</span></article>
        <article class="dm-call-person${voiceMembers.find(item => Number(item.id) === Number(peer.id))?.speaking ? ' speaking' : ''}"><div class="dm-call-avatar">${av(peer, 'dm-call-avatar-image')}</div><b>${esc(peer.displayName)}</b><span>${status}<i id="dm-call-duration">${dmCallStartedAt ? '00:00' : ''}</i></span></article>
      </div>
      <div class="voice-stream-stage" id="voice-stream-stage"></div>
    </main>
    <footer class="dm-call-footer"><div class="dm-call-call-meta"><small>${esc(peer.username ? '@' + peer.username : 'Aven DM')}</small><b>${status}</b></div><div class="dm-call-controls">
      <button type="button" class="dm-call-control${muted ? ' muted' : ''}" data-dm-call-mute title="${muted ? 'Mikrofonu aç' : 'Mikrofonu kapat'}" aria-label="${muted ? 'Mikrofonu aç' : 'Mikrofonu kapat'}">${muted ? DM_CALL_ICONS.micOff : DM_CALL_ICONS.mic}</button>
      <button type="button" class="dm-call-control${screenStream ? ' sharing' : ''}" data-dm-call-share title="${screenStream ? 'Yayını durdur' : 'Ekranını yayınla'}" aria-label="${screenStream ? 'Yayını durdur' : 'Ekranını yayınla'}"${voiceSession.status !== 'active' && !screenStream ? ' disabled' : ''}>${DM_CALL_ICONS.share}</button>
      <button type="button" class="dm-call-control end" data-dm-call-end title="Aramayı bitir" aria-label="Aramayı bitir">${DM_CALL_ICONS.hangup}</button>
    </div></footer>
  </section>`;
  $('[data-call-minimize]', layer).onclick = minimizeDmCall;
  $('[data-dm-call-mute]', layer).onclick = () => toggleVoiceMute();
  $('[data-dm-call-share]', layer).onclick = () => (screenStream ? stopScreenShare() : openScreenShareSetup()).catch(er => toast(er.message, 1));
  bindScreenShareContextMenu($('[data-dm-call-share]', layer));
  $('[data-dm-call-end]', layer).onclick = () => leaveVoice().catch(er => toast(er.message, 1));
  renderVoiceVideos();
  if (dmCallStartedAt) startDmCallClock();
}
function updateDmCallSpeaking() {
  const people = document.querySelectorAll('#dm-call-screen .dm-call-person');
  const remoteSpeaking = !!voiceMembers.find(participant => Number(participant.id) === Number(voiceSession?.peerId))?.speaking;
  people[0]?.classList.toggle('speaking', voiceSpeaking);
  people[1]?.classList.toggle('speaking', remoteSpeaking);
}
function updateDmCallControls() {
  const muted = !voiceStream?.getAudioTracks().some(track => track.enabled);
  const mute = $('#dm-call-screen [data-dm-call-mute]');
  if (mute) {
    mute.classList.toggle('muted', muted);
    mute.title = muted ? 'Mikrofonu aç' : 'Mikrofonu kapat';
    mute.setAttribute('aria-label', mute.title);
    mute.innerHTML = muted ? DM_CALL_ICONS.micOff : DM_CALL_ICONS.mic;
  }
  const share = $('#dm-call-screen [data-dm-call-share]');
  if (share) {
    share.classList.toggle('sharing', !!screenStream);
    share.title = screenStream ? 'Yayını durdur' : 'Ekranını yayınla';
    share.setAttribute('aria-label', share.title);
    share.innerHTML = DM_CALL_ICONS.share;
    share.disabled = voiceSession?.status !== 'active' && !screenStream;
    bindScreenShareContextMenu(share);
  }
}
async function joinVoice() {
  if (!currentGuildChannel || currentGuildChannel.type !== 'voice') return;
  if (!(currentGuildChannel.permissions & 32)) throw new Error('Bu ses kanalına bağlanma iznin yok.');
  if (voiceJoining) return;
  if (voiceSession && Number(voiceSession.channelId) === Number(currentGuildChannel.id)) return;
  const attemptId = ++voiceAttemptId;
  const channelId = currentGuildChannel.id, canSpeak = !!(currentGuildChannel.permissions & 64);
  voiceJoining = true;
  pendingVoiceSignals = pendingVoiceSignals.filter(item => Number(item.channelId) !== Number(channelId));
  try {
    unlockVoicePlayback();
    if (voiceSession) await leaveVoice(false);
    const iceConfigReady = loadVoiceIceConfig();
    if (canSpeak) {
      voiceStream = await getVoiceMicrophone();
    }
    await iceConfigReady;
    if (attemptId !== voiceAttemptId || !guildMode || Number(currentGuildChannel?.id) !== Number(channelId)) {
      voiceStream?.getTracks().forEach(track => track.stop()); voiceStream = null; return;
    }
    const details = await api(`/server-channels/${channelId}/voice-join`, 'POST');
    if (attemptId !== voiceAttemptId || !guildMode || Number(currentGuildChannel?.id) !== Number(channelId)) {
      voiceStream?.getTracks().forEach(track => track.stop()); voiceStream = null;
      try { await api(`/server-channels/${channelId}/voice-leave`, 'POST'); }
      catch (er) { toast(`İptal edilen ses bağlantısı kapatılamadı: ${er.message}`, 1); }
      return;
    }
    if (!details.canSpeak) { voiceStream?.getTracks().forEach(track => track.stop()); voiceStream = null; }
    watchTogetherSession = details.watchTogether || null;
    togetherJoined = false;
    voiceSession = { channelId, guildId: currentGuildId, channelName: currentGuildChannel.name, guildName: currentGuild.name, canSpeak: details.canSpeak };
    playAppSound('action');
    voiceMembers = [me, ...details.peers.filter(p => p.id !== me.id)];
    const channel = currentGuild?.channels.find(item => Number(item.id) === Number(channelId));
    if (channel) channel.participants = voiceMembers;
    voiceSpeaking = false; voiceStreaming = false;
    voiceHeartbeatTimer = setInterval(() => api(`/server-channels/${channelId}/voice-heartbeat`, 'POST').catch(er => {
      toast(`Ses bağlantısı yenilenemedi: ${er.message}`, 1);
      leaveVoice();
    }), 15000);
    for (const peer of details.peers) if (me.id < peer.id) await createVoicePeer(peer.id, true);
    flushPendingVoiceSignals(channelId);
    if (details.canSpeak && voiceStream) startVoiceActivityMonitor();
    renderGuildView();
    updateVoiceDock();
  } catch (er) {
    if (voiceSession && Number(voiceSession.channelId) === Number(channelId)) await leaveVoice(false);
    else { voiceStream?.getTracks().forEach(track => track.stop()); voiceStream = null; }
    throw er;
  } finally {
    voiceJoining = false;
    if (Number(voiceSession?.channelId) !== Number(channelId)) {
      pendingVoiceSignals = pendingVoiceSignals.filter(item => Number(item.channelId) !== Number(channelId));
      if (voicePlaybackContext?.state === 'running') voicePlaybackContext.suspend().catch(() => {});
    }
  }
}
function updateVoicePanel() {
  const panel = $('#voice-panel'); if (!panel) return;
  const visibleMembers = Number(voiceSession?.channelId) === Number(currentGuildChannel?.id) ? voiceMembers : currentGuildChannel?.participants || [];
  panel.innerHTML = visibleMembers.length ? visibleMembers.map(p => `<article class="voice-person${p.speaking ? ' speaking' : ''}" data-voice-person="${p.id}" role="listitem" title="${esc(p.displayName)}"><span class="voice-person-avatar">${av(p)}</span><span class="voice-person-copy"><b class="voice-person-name"><span>${esc(p.displayName)}${p.id === me.id && Number(voiceSession?.channelId) === Number(currentGuildChannel?.id) ? ' (sen)' : ''}</span>${tagPreview(p)}</b>${p.streaming ? '<i class="voice-live-badge">YAYINDA</i>' : ''}</span></article>`).join('') : '<span class="voice-waiting" role="listitem">Henüz bağlı kimse yok</span>';
  const activeVoiceIds = new Set(visibleMembers.map(member => Number(member.id)));
  document.querySelectorAll('.guild-member[data-member-id]').forEach(member => {
    const participant = visibleMembers.find(item => Number(item.id) === Number(member.dataset.memberId));
    member.classList.toggle('in-voice', activeVoiceIds.has(Number(member.dataset.memberId)));
    member.classList.toggle('speaking', !!participant?.speaking);
  });
  document.querySelectorAll('.guild-voice-member[data-voice-member]').forEach(member => {
    const participant = visibleMembers.find(item => Number(item.id) === Number(member.dataset.voiceMember));
    member.classList.toggle('speaking', !!participant?.speaking);
  });
  renderVoiceVideos();
  const mute = $('[data-voice-mute]');
  const enabled = !!voiceStream?.getAudioTracks().some(track => track.enabled);
  if (mute && voiceSession) { mute.textContent = enabled ? 'Mikrofonu kapat' : 'Mikrofonu aç'; mute.classList.toggle('muted', !enabled); }
}
function updateVoiceIndicators(userId = me?.id) {
  const participant = voiceMembers.find(member => Number(member.id) === Number(userId)) ||
    currentGuild?.channels.flatMap(channel => channel.participants || []).find(member => Number(member.id) === Number(userId));
  document.querySelectorAll(`[data-member-id="${userId}"],[data-voice-member="${userId}"],[data-voice-person="${userId}"]`).forEach(row => {
    row.classList.toggle('speaking', !!participant?.speaking);
    const badge = row.querySelector('.guild-member-stream,.voice-live-badge');
    if (participant?.streaming && !badge) row.insertAdjacentHTML('beforeend', '<i class="voice-live-badge">YAYINDA</i>');
    else if (!participant?.streaming && badge) badge.remove();
  });
}
function ensureVoiceDock() {
  let dock = $('#voice-dock');
  if (!voiceSession) { dock?.remove(); return; }
  if (!dock) {
    dock = document.createElement('aside');
    dock.id = 'voice-dock';
    dock.className = 'voice-dock';
    dock.setAttribute('aria-live', 'polite');
    document.body.append(dock);
  }
  updateVoiceDock();
}
function updateVoiceDock() {
  const dock = $('#voice-dock');
  if (!dock || !voiceSession) return;
  const muted = !voiceStream?.getAudioTracks().some(track => track.enabled);
  if (voiceSession.kind === 'dm') {
    const peer = voiceSession.peer || friend(voiceSession.peerId) || { displayName: 'Aven kullanıcısı' };
    dock.style.display = '';
    dock.hidden = !dmCallMinimized;
    dock.classList.add('dm-call-dock');
    const peerSpeaking = !!voiceMembers.find(item => Number(item.id) === Number(voiceSession.peerId))?.speaking;
    dock.innerHTML = `<span class="voice-dock-avatar${peerSpeaking ? ' speaking' : ''}">${av(peer)}</span><div class="voice-dock-meta"><b>${voiceSession.status === 'calling' ? 'Aranıyor…' : 'Sesli arama sürüyor'}</b><small>${esc(peer.displayName)}</small></div><div class="voice-dock-actions"><button type="button" data-dock-return title="Aramaya dön">Aramaya dön</button><button type="button" data-dock-mute title="${muted ? 'Mikrofonu aç' : 'Mikrofonu kapat'}">${muted ? 'Mikrofonu aç' : 'Mikrofon'}</button>${screenStream ? '<button type="button" data-dock-stop-share>Yayını durdur</button>' : ''}<button type="button" class="disconnect" data-dock-leave title="Aramayı bitir">Kapat</button></div>`;
    $('[data-dock-return]', dock).onclick = showDmCallScreen;
    $('[data-dock-mute]', dock).onclick = () => toggleVoiceMute();
    $('[data-dock-stop-share]', dock)?.addEventListener('click', () => stopScreenShare().catch(er => toast(er.message, 1)));
    $('[data-dock-leave]', dock).onclick = () => leaveVoice().catch(er => toast(er.message, 1));
    return;
  }
  const onVoiceScreen = guildMode && Number(currentGuildId) === Number(voiceSession.guildId) &&
    currentGuildChannel?.type === 'voice' && Number(currentGuildChannel.id) === Number(voiceSession.channelId);
  dock.hidden = onVoiceScreen;
  dock.style.display = onVoiceScreen ? 'none' : '';
  dock.classList.remove('dm-call-dock');
  dock.innerHTML = `<span class="voice-dock-avatar${voiceSpeaking ? ' speaking' : ''}">${av(me)}</span><div class="voice-dock-meta"><b>Ses bağlantısı sürüyor</b><small>${esc(voiceSession.guildName)} · ${esc(voiceSession.channelName)}</small></div><div class="voice-dock-actions"><button type="button" data-dock-return title="Ses kanalına dön">Kanala dön</button>${voiceStream ? `<button type="button" data-dock-mute title="${muted ? 'Mikrofonu aç' : 'Mikrofonu kapat'}">${muted ? 'Mikrofonu aç' : 'Mikrofon'}</button>` : ''}${screenStream ? '<button type="button" data-dock-stop-share>Yayını durdur</button>' : ''}<button type="button" class="disconnect" data-dock-leave title="Ses bağlantısını kes">Bağlantıyı kes</button></div>`;
  $('[data-dock-return]', dock).onclick = async () => {
    try {
      if (guildMode && Number(currentGuildId) === Number(voiceSession.guildId)) await selectGuildChannel(voiceSession.channelId);
      else await enterGuilds(voiceSession.guildId, voiceSession.channelId);
    } catch (er) { toast(`Ses kanalına dönülemedi: ${er.message}`, 1); }
  };
  $('[data-dock-mute]', dock)?.addEventListener('click', () => toggleVoiceMute().catch(er => toast(er.message, 1)));
  $('[data-dock-stop-share]', dock)?.addEventListener('click', () => stopScreenShare().catch(er => toast(er.message, 1)));
  $('[data-dock-leave]', dock).onclick = () => leaveVoice().catch(er => toast(er.message, 1));
}
function renderVoiceVideos() {
  const stage = voiceSession?.kind === 'dm'
    ? $('#dm-call-screen .voice-stream-stage')
    : $('#voice-stream-stage');
  if (!stage) return;
  if (voiceSession?.kind === 'dm' && dmCallMinimized) {
    for (const tile of stage.__avenStreamTiles?.values() || []) {
      const video = tile.querySelector('video');
      if (video) { video.pause(); video.srcObject = null; }
    }
    return;
  }
  const streams = new Map([...voiceVideoStreams.entries()].map(([id, entry]) => [Number(id), entry]).filter(([id, entry]) => entry && Number(id) !== Number(me.id)));
  for (const participant of voiceMembers) {
    const id = Number(participant.id);
    if (id !== Number(me.id) && participant.streaming && !streams.has(id)) streams.set(id, { participant, loading: true });
  }
  // Keep the local display capture out of the playback stage. Rendering a
  // recursive preview adds another video decode and can make sharing stutter.
  const tiles = stage.__avenStreamTiles || (stage.__avenStreamTiles = new Map());
  for (const [id, tile] of tiles) {
    if (streams.has(id)) continue;
    tile.querySelector('video').srcObject = null;
    tile.remove(); tiles.delete(id);
  }
  for (const [id, entry] of streams) {
    let tile = tiles.get(id);
    if (!tile) {
      tile = document.createElement('article'); tile.className = 'voice-stream-tile is-teaser';
      const video = document.createElement('video'); video.autoplay = true; video.playsInline = true; video.muted = true;
      const placeholder = document.createElement('div'); placeholder.className = 'voice-stream-placeholder';
      placeholder.innerHTML = `${DM_CALL_ICONS.share}<span>Canlı ekran yayını</span>`;
      const overlay = document.createElement('div'); overlay.className = 'voice-stream-overlay';
      const button = document.createElement('button'); button.type = 'button'; button.className = 'voice-stream-watch';
      overlay.append(button);
      const expand = document.createElement('button'); expand.type = 'button'; expand.className = 'voice-stream-expand'; expand.hidden = true;
      const label = document.createElement('span'); label.className = 'voice-stream-label';
      tile.append(video, placeholder, overlay, label, expand); tiles.set(id, tile);
    }
    const video = tile.querySelector('video'), button = tile.querySelector('.voice-stream-watch'), expand = tile.querySelector('.voice-stream-expand');
    const track = entry.stream?.getVideoTracks?.()[0];
    const ready = !!track && track.readyState === 'live' && !track.muted;
    const playing = ready;
    const expanded = playing && voiceExpandedStreams.has(id);
    tile.classList.toggle('is-watching', playing); tile.classList.toggle('is-expanded', expanded); tile.classList.toggle('is-teaser', !playing);
    tile.classList.toggle('is-local', !!entry.local);
    const placeholder = tile.querySelector('.voice-stream-placeholder');
    placeholder.hidden = playing;
    placeholder.querySelector('span').textContent = entry.local ? 'Ekranın karşı tarafa iletiliyor' : ready ? 'Canlı ekran yayını' : 'Yayın bağlantısı hazırlanıyor…';
    tile.querySelector('.voice-stream-overlay').classList.toggle('is-visible', !playing && !entry.local && ready);
    button.hidden = !!entry.local || playing;
    button.disabled = !ready;
    button.textContent = ready ? 'Yayını izle' : 'Bağlanıyor…'; button.setAttribute('aria-label', ready ? 'Yayını izle' : 'Yayın bağlantısı hazırlanıyor');
    expand.hidden = !playing;
    expand.title = expanded ? 'Yayını küçült' : 'Yayını büyüt';
    expand.setAttribute('aria-label', expand.title);
    expand.setAttribute('aria-pressed', String(expanded));
    expand.innerHTML = expanded ? DM_CALL_ICONS.shrink : DM_CALL_ICONS.expand;
    const participant = entry.participant || voiceMembers.find(member => Number(member.id) === id);
    tile.querySelector('.voice-stream-label').textContent = entry.local ? translateText('Canlı yayın · Sen') : participant?.displayName || translateText('Aven üyesi');
    if (playing) {
      if (video.srcObject !== entry.stream) video.srcObject = entry.stream;
      if (video.paused) video.play().catch(() => {});
    } else {
      if (!video.paused) video.pause();
      if (video.srcObject) video.srcObject = null;
    }
    if (tile.parentElement !== stage) stage.append(tile);
    button.onclick = () => {
      if (!ready) return;
      voiceWatchedStreams.add(id);
      renderVoiceVideos();
    };
    expand.onclick = () => {
      if (voiceExpandedStreams.has(id)) voiceExpandedStreams.delete(id);
      else voiceExpandedStreams.add(id);
      renderVoiceVideos();
    };
  }
}
function releaseVoiceStage(stage) {
  if (!stage?.__avenStreamTiles) return;
  for (const tile of stage.__avenStreamTiles.values()) {
    const video = tile.querySelector('video');
    if (video) { video.pause(); video.srcObject = null; }
  }
  stage.__avenStreamTiles.clear();
}
function updateVoiceShareButtons() {
  document.querySelectorAll('[data-voice-share]').forEach(button => {
    button.classList.toggle('active', voiceStreaming);
    bindScreenShareContextMenu(button);
    const label = $('span', button);
    if (label) label.textContent = voiceStreaming ? 'Yayını durdur' : 'Ekranını yayınla';
  });
  updateScreenShareMenuState();
  updateVoiceDock();
}
function renderRemoteVideo(userId, stream, participant) {
  const existing = voiceVideoStreams.get(userId);
  voiceVideoStreams.set(userId, { ...existing, stream, participant: participant || voiceMembers.find(member => Number(member.id) === Number(userId)) });
  renderVoiceVideos();
}
function queueVoiceSignal(fromId, signal) {
  const userId = Number(fromId);
  if (!Number.isSafeInteger(userId)) return;
  const previous = voiceSignalQueues.get(userId) || Promise.resolve();
  const next = previous.then(() => handleVoiceSignal(userId, signal)).catch(er => toast(`Ses sinyali alınamadı: ${er.message}`, 1));
  voiceSignalQueues.set(userId, next);
  return next;
}
function flushPendingVoiceSignals(channelId) {
  const ready = [];
  pendingVoiceSignals = pendingVoiceSignals.filter(item => {
    if (Number(item.channelId) === Number(channelId)) { ready.push(item); return false; }
    return Date.now() - item.receivedAt < 30000;
  });
  ready.forEach(item => queueVoiceSignal(item.fromId, item.signal));
}
async function voiceSendSignal(targetId, signal) {
  if (voiceSession?.kind === 'dm') {
    await api(`/dm-calls/${voiceSession.callId}/signal`, 'POST', signal);
    return;
  }
  const channelId = voiceSession?.channelId;
  if (!channelId) return;
  await api(`/server-channels/${channelId}/voice-signal`, 'POST', { targetId, ...signal });
}
async function createVoicePeer(userId, initiate) {
  if (voicePeers.has(userId) || !voiceSession) return voicePeers.get(userId);
  const pc = new RTCPeerConnection({ iceServers: voiceIceServers });
  const peer = { pc, pendingCandidates: [], remoteCandidates: [], descriptionSent: false, initialDescriptionSent: false, makingOffer: false, ignoreOffer: false, isSettingRemoteAnswerPending: false, polite: me.id > userId, videoTransceiver: null, voiceAudioTransceiver: null, shareAudioTransceiver: null };
  voicePeers.set(userId, peer);
  // Transceiver hatlarını yalnızca teklif gönderen taraf açar. Cevaplayan
  // taraf gelen offer'daki hatları alıp kendi mikrofon iziyle eşleştirir.
  if (initiate) {
    peer.voiceAudioTransceiver = pc.addTransceiver('audio', { direction: voiceStream ? 'sendrecv' : 'recvonly' });
    if (voiceStream) await peer.voiceAudioTransceiver.sender.replaceTrack(voiceStream.getAudioTracks()[0] || null);
    peer.videoTransceiver = pc.addTransceiver('video', { direction: 'sendrecv' });
    if (screenStream) {
      const videoTrack = screenStream.getVideoTracks()[0];
      const audioTrack = screenStream.getAudioTracks()[0];
      if (videoTrack) await peer.videoTransceiver.sender.replaceTrack(videoTrack);
      if (audioTrack && voiceSession.canSpeak) {
        peer.shareAudioTransceiver = pc.addTransceiver('audio', { direction: 'sendrecv' });
        await peer.shareAudioTransceiver.sender.replaceTrack(screenShareOptions.audio ? audioTrack : null);
      }
    }
  }
  pc.onicecandidate = e => {
    if (!e.candidate) return;
    if (!peer.descriptionSent) { peer.pendingCandidates.push(e.candidate.toJSON()); return; }
    sendVoiceCandidate(userId, peer, e.candidate.toJSON());
  };
  pc.ontrack = e => {
    if (e.track.kind === 'video') {
      const stream = e.streams[0] || new MediaStream([e.track]);
      const participant = voiceMembers.find(member => Number(member.id) === Number(userId));
    if (participant?.streamId) voiceRemoteShareStreamIds.set(userId, participant.streamId);
    else if (stream.id) voiceRemoteShareStreamIds.set(userId, stream.id);
      const removeVideo = () => {
        voiceVideoStreams.delete(userId);
        voiceWatchedStreams.delete(userId);
        voiceExpandedStreams.delete(userId);
        renderVoiceVideos();
      };
      e.track.onunmute = () => renderRemoteVideo(userId, stream, participant);
      e.track.onmute = () => renderVoiceVideos();
      e.track.onended = removeVideo;
      if (!e.track.muted) renderRemoteVideo(userId, stream, participant);
      return;
    }
    const participant = voiceMembers.find(member => Number(member.id) === Number(userId));
    const isShareAudio = e.transceiver !== firstAudioTransceiver(pc);
    if (isShareAudio) peer.shareAudioTransceiver ||= e.transceiver;
    const streamId = isShareAudio ? (participant?.streamId || e.streams[0]?.id || null) : null;
    if (isShareAudio && streamId) voiceRemoteShareStreamIds.set(userId, streamId);
    attachRemoteVoiceTrack(userId, e.track, { streamId, isShareAudio });
    e.track.onended = () => removeRemoteVoiceTrack(userId, e.track.id);
    e.track.onmute = () => { const audio = isShareAudio ? $(`[data-share-audio-track="${e.track.id}"]`) : $(`[data-voice-audio="${userId}"]`); if (audio) audio.__avenNeedsGesture = true; };
    e.track.onunmute = () => { const audio = isShareAudio ? $(`[data-share-audio-track="${e.track.id}"]`) : $(`[data-voice-audio="${userId}"]`); if (audio) playRemoteVoiceAudio(audio); };
  };
  pc.oniceconnectionstatechange = () => {
    if (pc.iceConnectionState === 'failed' && peer.initialDescriptionSent && !peer.restartingIce && voiceSession) {
      peer.restartingIce = true;
      pc.restartIce();
      setTimeout(() => { peer.restartingIce = false; }, 3000);
    }
  };
  pc.onconnectionstatechange = () => {
    if (!voiceSession || voicePeers.get(userId) !== peer) return;
    if (pc.connectionState === 'connected') {
      clearTimeout(peer.reconnectTimer); peer.reconnectTimer = null;
      peer.reconnectAttempts = 0;
      if (voiceSession.kind === 'dm' && voiceSession.status !== 'active') {
        voiceSession.status = 'active'; dmCallStartedAt = Date.now();
        renderDmCallScreen(); updateVoiceDock(); startDmCallClock();
      }
      return;
    }
    if (pc.connectionState === 'connecting' || pc.connectionState === 'new') {
      clearTimeout(peer.reconnectTimer); peer.reconnectTimer = null;
      return;
    }
    if (pc.connectionState !== 'disconnected' && pc.connectionState !== 'failed') return;
    clearTimeout(peer.reconnectTimer);
    const reconnectDelay = pc.connectionState === 'failed' ? Math.min(10000, 3500 + (peer.reconnectAttempts || 0) * 1500) : 5000;
    peer.reconnectTimer = setTimeout(() => {
      if (!voiceSession || voicePeers.get(userId) !== peer) return;
      if (pc.connectionState === 'connected') return;
      const attempts = (peer.reconnectAttempts || 0) + 1;
      closeVoicePeer(userId);
      createVoicePeer(userId, me.id < userId).then(nextPeer => { nextPeer.reconnectAttempts = attempts; })
        .catch(er => toast(`Ses bağlantısı yenilenemedi: ${er.message}`, 1));
    }, reconnectDelay);
  };
  pc.onnegotiationneeded = async () => {
    if (!peer.initialDescriptionSent || pc.signalingState !== 'stable' || !voiceSession || voicePeers.get(userId) !== peer) return;
    try {
      peer.makingOffer = true;
      peer.descriptionSent = false;
      await pc.setLocalDescription();
      await voiceSendSignal(userId, { description: { type: pc.localDescription.type, sdp: pc.localDescription.sdp } });
      await sendPendingVoiceCandidates(userId, peer);
    } catch (er) { toast(`Yayın bağlantısı kurulamadı: ${er.message}`, 1); }
    finally { peer.makingOffer = false; }
  };
  if (initiate) {
    const description = await pc.createOffer();
    await pc.setLocalDescription(description);
    await voiceSendSignal(userId, { description: { type: pc.localDescription.type, sdp: pc.localDescription.sdp } });
    await sendPendingVoiceCandidates(userId, peer);
    peer.initialDescriptionSent = true;
  }
  return peer;
}
async function sendVoiceCandidate(userId, peer, candidate) {
  if (!voiceSession || voicePeers.get(userId) !== peer) return;
  try { await voiceSendSignal(userId, { candidate }); }
  catch (er) { if (voicePeers.get(userId) === peer) toast(`Ağ adayı gönderilemedi: ${er.message}`, 1); }
}
async function sendPendingVoiceCandidates(userId, peer) {
  peer.descriptionSent = true;
  for (const candidate of peer.pendingCandidates.splice(0)) await sendVoiceCandidate(userId, peer, candidate);
}
function resumeRemoteVoiceAudio(force = false) {
  if (voiceSession && voicePlaybackContext?.state === 'suspended') voicePlaybackContext.resume().catch(() => {});
  document.querySelectorAll('.voice-audio audio[data-voice-audio],.voice-audio audio[data-share-audio-track]').forEach(audio => {
    if (!audio.srcObject?.getTracks().length) return;
    if (force) audio.__avenNeedsGesture = true;
    if (!audio.__avenNeedsGesture) return;
    audio.__avenNeedsGesture = false;
    playRemoteVoiceAudio(audio);
  });
}
function bindVoiceAudioRecovery() {
  if (voiceAudioUnlockBound) return;
  const recover = () => {
    if (document.hidden) return;
    if (voiceAudioContext && voiceAudioContext.state !== 'running') voiceAudioContext.resume().catch(() => {});
    if (voiceSession && voicePlaybackContext && voicePlaybackContext.state !== 'running') voicePlaybackContext.resume().catch(() => {});
    resumeRemoteVoiceAudio(true);
  };
  document.addEventListener('pointerdown', recover, { passive: true });
  document.addEventListener('keydown', recover);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) recover(); });
  window.addEventListener('pageshow', recover);
  voiceAudioUnlockBound = true;
}
function mobileVoicePlaybackRequired() {
  return !!(navigator.userAgentData?.mobile || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));
}
function unlockVoicePlayback() {
  if (!mobileVoicePlaybackRequired()) return;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return;
  try {
    if (!voicePlaybackContext || voicePlaybackContext.state === 'closed') voicePlaybackContext = new AudioContextClass({ latencyHint: 'interactive' });
    if (voicePlaybackContext.state !== 'running') voicePlaybackContext.resume().catch(() => {});
    bindVoiceAudioRecovery();
  } catch { voicePlaybackContext = null; }
}
function remoteVoiceAudio(userId) {
  let audio = $(`[data-voice-audio="${userId}"]`);
  if (audio) return audio;
  bindVoiceAudioRecovery();
  audio = document.createElement('audio');
  audio.dataset.voiceAudio = userId; audio.autoplay = true; audio.muted = false; audio.volume = 1; audio.playsInline = true; audio.setAttribute('aria-hidden', 'true');
  audio.srcObject = new MediaStream();
  const root = document.querySelector('.voice-audio') || Object.assign(document.body.appendChild(document.createElement('div')), { className: 'voice-audio' });
  root.append(audio);
  audio.__avenSinkReady = applyVoiceOutput(audio).catch(async () => {
    voicePreferences.output = '';
    try { await audio.setSinkId?.(''); } catch {}
  });
  return audio;
}
function playRemoteVoiceAudio(audio) {
  if (!audio.srcObject?.getTracks().length) return;
  const userId = Number(audio.dataset.voiceAudio || audio.dataset.shareAudioUser);
  Promise.resolve(audio.__avenSinkReady).then(() => audio.play()).then(() => {
    audio.__avenNeedsGesture = false;
    if (mobileVoicePlaybackRequired()) stopMobileVoiceFallback(userId);
  }).catch(() => {
    audio.__avenNeedsGesture = true;
    if (mobileVoicePlaybackRequired()) startMobileVoiceFallback(userId);
  });
}
function startMobileVoiceFallback(userId) {
  if (!mobileVoicePlaybackRequired() || !voiceSession) return;
  unlockVoicePlayback();
  const context = voicePlaybackContext;
  if (!context || context.state === 'closed') return;
  for (const entry of voiceRemoteAudioTracks.get(userId)?.values() || []) {
    if (entry.source || entry.track.muted || entry.track.readyState !== 'live') continue;
    try {
      const source = context.createMediaStreamSource(new MediaStream([entry.track]));
      const gain = context.createGain();
      gain.gain.value = 1;
      source.connect(gain);
      gain.connect(context.destination);
      entry.source = source;
      entry.gain = gain;
      entry.playbackContext = context;
    } catch (er) { console.warn('Mobil ses yedek çıkışı açılamadı.', er); }
  }
  if (context.state !== 'running') context.resume().catch(() => {});
}
function stopMobileVoiceFallback(userId) {
  for (const entry of voiceRemoteAudioTracks.get(userId)?.values() || []) {
    if (!entry.source) continue;
    try { entry.source.disconnect(); } catch {}
    try { entry.gain?.disconnect(); } catch {}
    entry.source = null;
    entry.gain = null;
    entry.playbackContext = null;
  }
}
function attachRemoteVoiceTrack(userId, track, metadata) {
  const tracks = voiceRemoteAudioTracks.get(userId) || new Map();
  if (tracks.has(track.id)) return;
  const entry = { track, ...metadata };
  tracks.set(track.id, entry);
  voiceRemoteAudioTracks.set(userId, tracks);
  if (metadata.isShareAudio) {
    // Keep screen audio on its own media element so browsers do not select only
    // the microphone track when a MediaStream contains multiple audio tracks.
    const audio = document.createElement('audio');
    audio.dataset.shareAudioUser = userId; audio.dataset.shareAudioTrack = track.id;
    audio.autoplay = true; audio.muted = false; audio.volume = 1; audio.playsInline = true;
    audio.setAttribute('aria-hidden', 'true'); audio.srcObject = new MediaStream([track]);
    const container = document.querySelector('.voice-audio') || Object.assign(document.body.appendChild(document.createElement('div')), { className: 'voice-audio' });
    container.append(audio);
    bindVoiceAudioRecovery();
    audio.__avenSinkReady = applyVoiceOutput(audio).catch(async () => { try { await audio.setSinkId?.(''); } catch {} });
    playRemoteVoiceAudio(audio);
    return;
  }
  const audio = remoteVoiceAudio(userId), stream = audio.srcObject;
  if (!stream.getTracks().some(item => item.id === track.id)) stream.addTrack(track);
  playRemoteVoiceAudio(audio);
}
function removeRemoteVoiceTrack(userId, trackId) {
  const tracks = voiceRemoteAudioTracks.get(userId), entry = tracks?.get(trackId);
  if (!entry) return;
  try { entry.source?.disconnect(); } catch {}
  try { entry.gain?.disconnect(); } catch {}
  tracks.delete(trackId);
  if (!tracks.size) voiceRemoteAudioTracks.delete(userId);
  if (entry.isShareAudio) {
    $(`[data-share-audio-track="${trackId}"]`)?.remove();
    return;
  }
  const audio = $(`[data-voice-audio="${userId}"]`), stream = audio?.srcObject;
  const track = stream instanceof MediaStream && stream.getTracks().find(item => item.id === trackId);
  if (track) stream.removeTrack(track);
}
function removeRemoteShareAudio(userId, streamId) {
  const tracks = voiceRemoteAudioTracks.get(userId);
  if (!tracks) return;
  for (const [trackId, entry] of tracks) {
    if (entry.isShareAudio && (!streamId || !entry.streamId || entry.streamId === streamId)) removeRemoteVoiceTrack(userId, trackId);
  }
}
function firstAudioTransceiver(pc) {
  return pc.getTransceivers().find(t => t.receiver?.track?.kind === 'audio' && t.direction !== 'stopped') || null;
}
async function bindAnsweringTransceivers(peer) {
  const live = peer.pc.getTransceivers().filter(t => t.direction !== 'stopped');
  const audios = live.filter(t => t.receiver?.track?.kind === 'audio');
  const videos = live.filter(t => t.receiver?.track?.kind === 'video');
  const micTrack = voiceStream?.getAudioTracks()[0] || null;
  if (!peer.voiceAudioTransceiver && audios[0]) {
    peer.voiceAudioTransceiver = audios[0];
    audios[0].direction = micTrack ? 'sendrecv' : 'recvonly';
    if (micTrack) await audios[0].sender.replaceTrack(micTrack);
  }
  if (!peer.videoTransceiver && videos[0]) {
    peer.videoTransceiver = videos[0];
    videos[0].direction = 'sendrecv';
    const screenVideo = screenStream?.getVideoTracks()[0];
    if (screenVideo) await videos[0].sender.replaceTrack(screenVideo);
  }
  if (!peer.shareAudioTransceiver && audios[1]) {
    peer.shareAudioTransceiver = audios[1];
    const screenAudio = screenStream?.getAudioTracks()[0];
    if (screenAudio && voiceSession?.canSpeak) {
      audios[1].direction = 'sendrecv';
      await audios[1].sender.replaceTrack(screenShareOptions.audio ? screenAudio : null);
    }
  }
  const localScreenAudio = screenStream?.getAudioTracks()[0];
  if (!peer.shareAudioTransceiver && localScreenAudio && voiceSession?.canSpeak) {
    peer.shareAudioTransceiver = peer.pc.addTransceiver('audio', { direction: 'sendrecv' });
    await peer.shareAudioTransceiver.sender.replaceTrack(screenShareOptions.audio ? localScreenAudio : null);
  }
}
async function handleVoiceSignal(userId, signal) {
  const peer = await createVoicePeer(userId, false), pc = peer.pc;
  if (signal.description) {
    const readyForOffer = !peer.makingOffer && (pc.signalingState === 'stable' || peer.isSettingRemoteAnswerPending);
    const offerCollision = signal.description.type === 'offer' && !readyForOffer;
    peer.ignoreOffer = !peer.polite && offerCollision;
    if (peer.ignoreOffer) return;
    peer.isSettingRemoteAnswerPending = signal.description.type === 'answer';
    await pc.setRemoteDescription(signal.description);
    peer.isSettingRemoteAnswerPending = false;
    if (signal.description.type === 'offer') await bindAnsweringTransceivers(peer);
    for (const candidate of peer.remoteCandidates.splice(0)) await pc.addIceCandidate(candidate).catch(() => {});
    if (signal.description.type === 'offer') {
      peer.descriptionSent = false;
      await pc.setLocalDescription();
      await voiceSendSignal(userId, { description: { type: pc.localDescription.type, sdp: pc.localDescription.sdp } });
      await sendPendingVoiceCandidates(userId, peer);
    }
    peer.initialDescriptionSent = true;
  } else if (signal.candidate && !peer.ignoreOffer) {
    if (!pc.remoteDescription) peer.remoteCandidates.push(signal.candidate);
    else await pc.addIceCandidate(signal.candidate);
  }
}
function closeVoicePeer(userId) {
  const peer = voicePeers.get(userId);
  if (!peer) return;
  peer.pc.ontrack = null; clearTimeout(peer.reconnectTimer); peer.pc.close(); voicePeers.delete(userId); voiceSignalQueues.delete(userId); voiceVideoStreams.delete(userId); voiceWatchedStreams.delete(userId); voiceExpandedStreams.delete(userId);
  for (const trackId of [...(voiceRemoteAudioTracks.get(userId)?.keys() || [])]) removeRemoteVoiceTrack(userId, trackId);
  voiceRemoteShareStreamIds.delete(userId);
  $(`[data-voice-audio="${userId}"]`)?.remove();
  renderVoiceVideos();
}
async function toggleVoiceMute() {
  if (!voiceStream) return;
  const enabled = !voiceStream.getAudioTracks().some(track => track.enabled);
  voiceStream.getAudioTracks().forEach(track => { track.enabled = enabled; });
  playAppSound('action');
  updateDmCallControls();
  updateVoicePanel();
  updateVoiceDock();
}
async function leaveVoice(render = true, notify = true) {
  const session = voiceSession;
  if (!session) return;
  closeScreenShareMenu();
  if (notify) playAppSound('action');
  pendingVoiceSignals = pendingVoiceSignals.filter(item => Number(item.channelId) !== Number(session.channelId));
  teardownTogetherPlayer(false);
  if (session.kind !== 'dm') { watchTogetherSession = null; togetherJoined = false; }
  const sharedStream = screenStream;
  screenStream = null; voiceStreaming = false;
  sharedStream?.getTracks().forEach(track => { track.onended = null; track.stop(); });
  const notification = notify
    ? api(session.kind === 'dm' ? `/dm-calls/${session.callId}/end` : `/server-channels/${session.channelId}/voice-leave`, 'POST').catch(er => toast(`${session.kind === 'dm' ? 'Arama' : 'Ses kanalı'} kapatılırken bildirim gönderilemedi: ${er.message}`, 1))
    : Promise.resolve();
  voiceSession = null; voiceStateQueue = Promise.resolve(); voiceStateErrorShown = false;
  clearInterval(voiceHeartbeatTimer); voiceHeartbeatTimer = null;
  clearInterval(voiceActivityTimer); voiceActivityTimer = null; voiceAnalyser = null;
  const audioContext = voiceAudioContext; voiceAudioContext = null;
  audioContext?.close().catch(() => {});
  voicePeers.forEach(peer => peer.pc.close()); voicePeers.clear(); voiceSignalQueues.clear();
  voiceStream?.getTracks().forEach(track => track.stop()); voiceStream = null;
  document.querySelectorAll('.voice-audio audio').forEach(audio => audio.remove());
  voiceRemoteAudioTracks.forEach(tracks => tracks.forEach(entry => entry.source?.disconnect()));
  voiceVideoStreams.clear(); voiceRemoteAudioTracks.clear(); voiceRemoteShareStreamIds.clear(); voiceMembers = []; voiceSpeaking = false; voiceStreaming = false;
  if (!voiceJoining && voicePlaybackContext?.state === 'running') voicePlaybackContext.suspend().catch(() => {});
  voiceWatchedStreams.clear(); voiceExpandedStreams.clear();
  const channel = currentGuild?.channels.find(item => Number(item.id) === Number(session.channelId));
  if (channel) channel.participants = (channel.participants || []).filter(participant => participant.id !== me.id);
  clearInterval(dmCallElapsedTimer); dmCallElapsedTimer = null; dmCallStartedAt = 0; dmCallMinimized = false;
  releaseVoiceStage($('#dm-call-screen .voice-stream-stage'));
  $('#dm-call-screen')?.remove();
  updateVoicePanel();
  ensureVoiceDock();
  if (render && guildMode && currentGuildChannel?.type === 'voice') renderGuildView();
  await notification;
}

let voiceStateQueue = Promise.resolve(), voiceStateErrorShown = false;
function publishVoiceState() {
  if (!voiceSession) return Promise.resolve();
  const channelId = voiceSession.channelId, state = { speaking: voiceSpeaking, streaming: voiceStreaming, streamId: voiceStreaming ? screenStream?.id || null : null };
  voiceMembers = voiceMembers.map(participant => participant.id === me.id ? { ...participant, ...state } : participant);
  const channel = currentGuild?.channels.find(item => Number(item.id) === Number(channelId));
  if (channel) channel.participants = voiceMembers;
  updateVoiceIndicators(me.id);
  updateVoiceDock();
  if (voiceSession.kind === 'dm') updateDmCallSpeaking();
  const endpoint = voiceSession.kind === 'dm' ? `/dm-calls/${voiceSession.callId}/state` : `/server-channels/${channelId}/voice-state`;
  const operation = voiceStateQueue.catch(() => {}).then(() => api(endpoint, 'POST', state));
  voiceStateQueue = operation.catch(() => {});
  return operation.then(result => { voiceStateErrorShown = false; return result; })
    .catch(er => {
      if (!voiceStateErrorShown) { toast(`Ses durumu eşitlenemedi: ${er.message}`, 1); voiceStateErrorShown = true; }
      throw er;
    });
}
function startVoiceActivityMonitor() {
  if (!voiceStream?.getAudioTracks().length || !window.AudioContext) return;
  try {
    voiceAudioContext = new AudioContext();
    if (voiceAudioContext.state === 'suspended') voiceAudioContext.resume().catch(er => toast(`Ses çözümleyicisi başlatılamadı: ${er.message}`, 1));
    voiceAnalyser = voiceAudioContext.createAnalyser();
    voiceAnalyser.fftSize = 256;
    voiceAudioContext.createMediaStreamSource(voiceStream).connect(voiceAnalyser);
    const samples = new Float32Array(voiceAnalyser.fftSize);
    let lastVoiceAt = 0;
    voiceActivityTimer = setInterval(() => {
      if (!voiceAnalyser || !voiceStream?.getAudioTracks().some(track => track.enabled)) {
        if (voiceSpeaking) { voiceSpeaking = false; publishVoiceState().catch(() => {}); }
        return;
      }
      voiceAnalyser.getFloatTimeDomainData(samples);
      let power = 0;
      for (let index = 0; index < samples.length; index++) power += samples[index] * samples[index];
      const volume = Math.sqrt(power / samples.length);
      if (volume > 0.035) {
        lastVoiceAt = Date.now();
        if (!voiceSpeaking) { voiceSpeaking = true; publishVoiceState().catch(() => {}); }
      } else if (voiceSpeaking && Date.now() - lastVoiceAt > 500) {
        voiceSpeaking = false; publishVoiceState().catch(() => {});
      }
    }, 180);
  } catch (er) {
    toast(`Konuşma göstergesi başlatılamadı: ${er.message}`, 1);
  }
}
function screenCaptureConstraints() {
  return {
    video: {
      frameRate: { ideal: screenShareOptions.fps, max: screenShareOptions.fps },
      width: { ideal: screenShareOptions.width, max: screenShareOptions.width },
      height: { ideal: screenShareOptions.height, max: screenShareOptions.height },
      resizeMode: 'crop-and-scale'
    },
    // İzi baştan iste ki kullanıcı yayın sürerken menüden açabilsin.
    // Ses, uygulama seçeneği açılana kadar karşı tarafa gönderilmez.
    audio: true,
    preferCurrentTab: screenShareOptions.source === 'tab',
    selfBrowserSurface: 'exclude',
    systemAudio: 'include'
  };
}
async function selectScreenCapture() {
  if (!navigator.mediaDevices?.getDisplayMedia) throw new Error('Ekran paylaşımı bu tarayıcıda desteklenmiyor.');
  try { return await navigator.mediaDevices.getDisplayMedia(screenCaptureConstraints()); }
  catch (er) {
    if (er.name === 'NotAllowedError') return null;
    throw new Error(`Ekran seçicisi açılamadı: ${er.message}`);
  }
}
async function applyScreenShareSenderSettings(sender, options = screenShareOptions) {
  if (!sender?.getParameters || !sender?.setParameters) return;
  try {
    const parameters = sender.getParameters();
    if (!parameters.encodings?.length) return;
    const bitrateByHeight = { 480: 650_000, 720: 1_400_000, 1080: 2_800_000, 1440: 4_500_000 };
    parameters.encodings[0].maxBitrate = bitrateByHeight[options.height] || 1_400_000;
    parameters.encodings[0].maxFramerate = options.fps;
    parameters.degradationPreference = 'maintain-resolution';
    await sender.setParameters(parameters);
  } catch {}
}
async function connectScreenStreamToPeers(stream, shareAudio = screenShareOptions.audio) {
  const changes = [];
  const replace = async (sender, track) => {
    if (!sender) return;
    const previous = sender.track;
    await sender.replaceTrack(track);
    changes.push([sender, previous]);
  };
  const audioTrack = stream.getAudioTracks()[0] || null;
  try {
    for (const peer of voicePeers.values()) {
      await replace(peer.videoTransceiver?.sender, stream.getVideoTracks()[0] || null);
      if (audioTrack && voiceSession?.canSpeak && !peer.shareAudioTransceiver) {
        peer.shareAudioTransceiver = peer.pc.addTransceiver('audio', { direction: 'sendrecv' });
      }
      await replace(peer.shareAudioTransceiver?.sender, audioTrack && shareAudio && voiceSession?.canSpeak ? audioTrack : null);
      await applyScreenShareSenderSettings(peer.videoTransceiver?.sender);
    }
  } catch (er) {
    for (const [sender, previous] of changes.reverse()) await sender.replaceTrack(previous).catch(() => {});
    throw er;
  }
}
function bindScreenStream(stream) {
  const track = stream.getVideoTracks()[0];
  track.contentHint = 'detail';
  track.onended = () => { if (screenStream === stream) stopScreenShare().catch(er => toast(er.message, 1)); };
  track.onmute = track.onunmute = () => renderVoiceVideos();
}
function prepareScreenAudioTrack(track, enabled) {
  if (!track) return;
  track.enabled = !!enabled;
  try { track.contentHint = 'music'; } catch {}
  track.applyConstraints({ echoCancellation: false, noiseSuppression: false, autoGainControl: false }).catch(() => {});
}
async function startScreenShare() {
  if (!voiceSession) throw new Error('Önce bir ses kanalına veya DM aramasına katıl.');
  const session = voiceSession;
  const stream = await selectScreenCapture();
  if (!stream) return;
  if (voiceSession !== session) {
    stream.getTracks().forEach(item => item.stop());
    throw new Error('Ses bağlantısı yayın seçilirken kapandı.');
  }
  if (!stream.getVideoTracks()[0]) { stream.getTracks().forEach(item => item.stop()); throw new Error('Paylaşılacak ekran seçilemedi.'); }
  const audioTrack = stream.getAudioTracks()[0] || null;
  const shareAudio = !!(screenShareOptions.audio && audioTrack && session.canSpeak);
  prepareScreenAudioTrack(audioTrack, shareAudio);
  if (screenShareOptions.audio && !shareAudio) {
    screenShareOptions.audio = false;
    toast('Bu ekran seçimi ses izi sağlamadı; yayın sesi kapalı başladı.', 1);
  }
  screenStream = stream; voiceStreaming = true;
  bindScreenStream(stream);
  playAppSound('action');
  renderVoiceVideos();
  updateVoiceShareButtons(); updateDmCallControls();
  try {
    await connectScreenStreamToPeers(stream, shareAudio);
    if (voiceSession !== session) throw new Error('Ses bağlantısı yayın başlatılırken kapandı.');
    await publishVoiceState();
  } catch (er) {
    await stopScreenShare(false);
    throw er;
  }
}
async function changeScreenShare({ enableAudio = screenShareOptions.audio, requireAudio = false } = {}) {
  if (!screenStream || !voiceSession) throw new Error('Etkin bir yayın bulunamadı.');
  const session = voiceSession, previous = screenStream;
  const next = await selectScreenCapture();
  if (!next) return false;
  if (voiceSession !== session) {
    next.getTracks().forEach(track => track.stop());
    throw new Error('Ses bağlantısı yayın değiştirilirken kapandı.');
  }
  if (!next.getVideoTracks()[0]) { next.getTracks().forEach(track => track.stop()); throw new Error('Yeni paylaşım kaynağı seçilemedi.'); }
  const audioTrack = next.getAudioTracks()[0] || null;
  if (requireAudio && (!audioTrack || !session.canSpeak)) {
    next.getTracks().forEach(track => track.stop());
    throw new Error('Ses izni alınamadı. Ekran seçicisinde sekme veya sistem sesini paylaşmayı seç.');
  }
  const shareAudio = !!(enableAudio && audioTrack && session.canSpeak);
  prepareScreenAudioTrack(audioTrack, shareAudio);
  try { await connectScreenStreamToPeers(next, shareAudio); }
  catch (er) { next.getTracks().forEach(track => track.stop()); throw er; }
  screenStream = next;
  screenShareOptions.audio = shareAudio;
  voiceStreaming = true;
  bindScreenStream(next);
  previous.getTracks().forEach(track => { track.onended = null; track.stop(); });
  if (enableAudio && !shareAudio) toast('Yeni kaynakta ses yakalanmadı; yayın sesi kapalı kaldı.', 1);
  renderVoiceVideos(); updateVoiceShareButtons(); updateDmCallControls();
  await publishVoiceState();
  return true;
}
async function setScreenShareAudio(enabled) {
  if (!screenStream) throw new Error('Önce yayını başlat.');
  if (!voiceSession?.canSpeak) throw new Error('Bu aramada yayın sesi paylaşma iznin yok.');
  const audioTrack = screenStream.getAudioTracks()[0];
  if (enabled && !audioTrack) return changeScreenShare({ enableAudio: true, requireAudio: true });
  prepareScreenAudioTrack(audioTrack, enabled);
  await connectScreenStreamToPeers(screenStream, !!enabled);
  screenShareOptions.audio = !!enabled;
  updateScreenShareMenuState();
  toast(enabled ? 'Yayın sesi paylaşılıyor.' : 'Yayın sesi kapatıldı.');
  return true;
}
async function applyScreenShareQuality(fps, width, height) {
  const track = screenStream?.getVideoTracks()[0];
  if (!track) throw new Error('Etkin bir yayın bulunamadı.');
  const previous = { fps: screenShareOptions.fps, width: screenShareOptions.width, height: screenShareOptions.height };
  try {
    await track.applyConstraints({
      frameRate: { ideal: fps, max: fps }, width: { ideal: width, max: width },
      height: { ideal: height, max: height }, resizeMode: 'crop-and-scale'
    });
  } catch (er) {
    throw new Error(`Bu tarayıcı yayın kalitesini canlı değiştiremedi: ${er.message}`);
  }
  Object.assign(screenShareOptions, { fps, width, height });
  await Promise.all([...voicePeers.values()].map(peer => applyScreenShareSenderSettings(peer.videoTransceiver?.sender)));
  updateScreenShareMenuState();
  toast(`${translateText('Yayın Kalitesi:')} ${height}p · ${fps} FPS ${translateText('uygulandı.')}`);
  return previous;
}
function closeScreenShareMenu() {
  const menu = $('#screen-share-context-menu');
  if (!menu) return;
  menu.__cleanup?.();
  menu.remove();
}
function updateScreenShareMenuState() {
  const menu = $('#screen-share-context-menu');
  if (!menu) return;
  const audio = $('[data-share-audio-toggle]', menu);
  audio?.setAttribute('aria-checked', String(!!screenShareOptions.audio));
  audio?.classList.toggle('selected', !!screenShareOptions.audio);
  if (audio) {
    audio.disabled = !voiceSession?.canSpeak;
    audio.title = audio.disabled ? 'Yayın sesi için konuşma izni gerekir.' : 'Sistem veya sekme sesini paylaş';
  }
  $('[data-share-audio-check]', menu)?.replaceChildren(document.createTextNode(screenShareOptions.audio ? '✓' : ''));
  menu.querySelectorAll('[data-share-fps]').forEach(button => {
    const selected = Number(button.dataset.shareFps) === screenShareOptions.fps;
    button.classList.toggle('selected', selected);
    button.setAttribute('aria-checked', String(selected));
  });
  menu.querySelectorAll('[data-share-resolution]').forEach(button => {
    const selected = Number(button.dataset.shareResolution) === screenShareOptions.height;
    button.classList.toggle('selected', selected);
    button.setAttribute('aria-checked', String(selected));
  });
}
function bindScreenShareContextMenu(button) {
  if (!button) return;
  let pressTimer = 0;
  button.addEventListener('pointerdown', event => {
    if (event.pointerType !== 'touch' || !screenStream) return;
    pressTimer = window.setTimeout(() => {
      const rect = button.getBoundingClientRect();
      openScreenShareContextMenu({ clientX: Math.min(rect.left, innerWidth - 246), clientY: Math.min(rect.top, innerHeight - 330), preventDefault() {} }, button);
      pressTimer = 0;
    }, 550);
  }, { passive: true });
  for (const name of ['pointerup', 'pointercancel', 'pointerleave']) button.addEventListener(name, () => { if (pressTimer) clearTimeout(pressTimer); pressTimer = 0; }, { passive: true });
  button.oncontextmenu = event => {
    event.preventDefault();
    if (!screenStream) return;
    openScreenShareContextMenu(event, button);
  };
}
function openScreenShareContextMenu(event, button) {
  closeScreenShareMenu();
  const menu = document.createElement('div');
  menu.id = 'screen-share-context-menu';
  menu.className = 'share-context-menu';
  menu.setAttribute('role', 'menu');
  menu.innerHTML = `<button type="button" class="share-context-item danger" data-share-stop role="menuitem"><span class="share-context-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8m-4-4v4M9 9l6 4m0-4-6 4"/></svg></span><span>Yayını Durdur</span></button>
    <button type="button" class="share-context-item" data-share-change role="menuitem"><span class="share-context-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8m-4-4v4m-2-9 2-2 2 2m-2-2v5"/></svg></span><span>Yayını Değiştir</span></button>
    <div class="share-context-divider"></div>
    <div class="share-quality-wrap"><button type="button" class="share-context-item" data-share-quality-toggle aria-expanded="false" aria-haspopup="true"><span>Yayın Kalitesi</span><span class="share-context-chevron">›</span></button>
      <div class="share-quality-submenu" data-share-quality-menu hidden role="menu">
        <small>Kare Hızı</small>
        <button type="button" data-share-fps="15" role="menuitemradio" aria-checked="false"><span>15 FPS</span><i></i></button>
        <button type="button" data-share-fps="30" role="menuitemradio" aria-checked="false"><span>30 FPS</span><i></i></button>
        <button type="button" data-share-fps="60" role="menuitemradio" aria-checked="false"><span>60 FPS</span><i></i></button>
        <hr><small>Çözünürlük</small>
        <button type="button" data-share-resolution="480" role="menuitemradio" aria-checked="false"><span>480p</span><i></i></button>
        <button type="button" data-share-resolution="720" role="menuitemradio" aria-checked="false"><span>720p</span><i></i></button>
        <button type="button" data-share-resolution="1080" role="menuitemradio" aria-checked="false"><span>1080p</span><i></i></button>
        <button type="button" data-share-resolution="1440" role="menuitemradio" aria-checked="false"><span>1440p</span><i></i></button>
      </div>
    </div>
    <button type="button" class="share-context-item" data-share-audio-toggle role="checkbox" aria-checked="false"><span>Yayın Sesini Paylaş</span><span class="share-context-check" data-share-audio-check></span></button>`;
  document.body.append(menu);
  const menuWidth = 238;
  const left = Math.max(8, Math.min(event.clientX, window.innerWidth - menuWidth - 8));
  menu.style.left = `${left}px`;
  menu.style.top = `${Math.max(8, Math.min(event.clientY, window.innerHeight - menu.offsetHeight - 8))}px`;
  if (left + menuWidth + 250 > window.innerWidth - 8) menu.classList.add('opens-left');
  const qualityMenu = $('[data-share-quality-menu]', menu), qualityToggle = $('[data-share-quality-toggle]', menu), qualityWrap = $('.share-quality-wrap', menu);
  const showQualityMenu = () => {
    qualityMenu.hidden = false;
    qualityToggle.setAttribute('aria-expanded', 'true');
    const row = qualityWrap.getBoundingClientRect(), submenu = qualityMenu.getBoundingClientRect();
    const shift = Math.min(0, window.innerHeight - row.top - submenu.height - 8);
    qualityMenu.style.top = `${shift}px`;
  };
  qualityWrap.onmouseenter = showQualityMenu;
  qualityWrap.onmouseleave = () => {
    if (qualityMenu.contains(document.activeElement)) return;
    qualityMenu.hidden = true;
    qualityToggle.setAttribute('aria-expanded', 'false');
  };
  qualityToggle.onclick = () => {
    if (qualityMenu.hidden) showQualityMenu();
    else { qualityMenu.hidden = true; qualityToggle.setAttribute('aria-expanded', 'false'); }
  };
  $('[data-share-stop]', menu).onclick = () => { closeScreenShareMenu(); stopScreenShare().catch(er => toast(er.message, 1)); };
  $('[data-share-change]', menu).onclick = () => {
    closeScreenShareMenu();
    changeScreenShare().catch(er => toast(er.message, 1));
  };
  $('[data-share-audio-toggle]', menu).onclick = async () => {
    const enabled = !screenShareOptions.audio;
    if (enabled && !screenStream?.getAudioTracks().length) closeScreenShareMenu();
    try { await setScreenShareAudio(enabled); }
    catch (er) { toast(er.message, 1); }
  };
  menu.querySelectorAll('[data-share-fps]').forEach(item => item.onclick = async () => {
    try { await applyScreenShareQuality(Number(item.dataset.shareFps), screenShareOptions.width, screenShareOptions.height); }
    catch (er) { toast(er.message, 1); }
  });
  menu.querySelectorAll('[data-share-resolution]').forEach(item => item.onclick = async () => {
    const height = Number(item.dataset.shareResolution), width = { 480: 854, 720: 1280, 1080: 1920, 1440: 2560 }[height];
    try { await applyScreenShareQuality(screenShareOptions.fps, width, height); }
    catch (er) { toast(er.message, 1); }
  });
  const outside = e => { if (!menu.contains(e.target) && !button.contains(e.target)) closeScreenShareMenu(); };
  const keydown = e => { if (e.key === 'Escape') closeScreenShareMenu(); };
  menu.__cleanup = () => {
    document.removeEventListener('pointerdown', outside, true);
    document.removeEventListener('keydown', keydown, true);
  };
  document.addEventListener('pointerdown', outside, true);
  document.addEventListener('keydown', keydown, true);
  updateScreenShareMenuState();
}
function openScreenShareSetup() {
  if (!voiceSession) return Promise.reject(new Error('Önce bir ses kanalına veya DM aramasına katıl.'));
  if (voiceSession.kind === 'dm' && voiceSession.status !== 'active') return Promise.reject(new Error('Ekranını paylaşmak için aramanın bağlanmasını bekle.'));
  // Tarayıcının yerel ekran seçicisi gerçek pencere/sekme önizlemelerini sunar.
  // Araya özel bir modal koymak bu canlı kaynak önizlemelerini gösteremediği gibi
  // paylaşımın başlaması için gereksiz ikinci bir tıklama da gerektiriyordu.
  return startScreenShare();
}
async function stopScreenShare(notify = true) {
  const stream = screenStream;
  if (!stream) return;
  closeScreenShareMenu();
  playAppSound('action');
  const sharedTrackIds = new Set(stream.getTracks().map(track => track.id));
  screenStream = null; voiceStreaming = false;
  stream.getTracks().forEach(track => { track.onended = null; track.stop(); });
  renderVoiceVideos(); updateVoiceShareButtons(); updateDmCallControls();
  const detach = [];
  for (const peer of voicePeers.values()) {
    for (const sender of [peer.videoTransceiver?.sender, peer.shareAudioTransceiver?.sender].filter(item => item && sharedTrackIds.has(item.track?.id))) {
      detach.push(sender.replaceTrack(null).catch(() => {}));
    }
  }
  const state = notify && voiceSession ? publishVoiceState().catch(() => {}) : Promise.resolve();
  await Promise.all([Promise.all(detach), state]);
}

function guildModal(content, onReady) {
  const modal = document.createElement('div'); modal.className = 'modal fade guild-modal';
  modal.innerHTML = `<div class="dlg pop guild-dialog">${content}</div>`;
  const observer = new MutationObserver(() => { if (!modal.isConnected) { document.removeEventListener('keydown', onKey); observer.disconnect(); } });
  const close = () => { modal.remove(); document.removeEventListener('keydown', onKey); observer.disconnect(); };
  const onKey = e => { if (e.key === 'Escape' && [...document.querySelectorAll('.modal')].at(-1) === modal) close(); };
  modal.onclick = e => { if (e.target === modal) close(); };
  document.addEventListener('keydown', onKey); document.body.append(modal); observer.observe(document.body, { childList: true, subtree: true }); onReady?.(modal, close);
  return { modal, close };
}
function guildForm(content, submit) {
  const { modal, close } = guildModal(`<form class="guild-form">${content}</form>`, root => {
    const form = $('form', root); form.onsubmit = async e => {
      e.preventDefault(); const button = $('button[type=submit]', form); button.disabled = true;
      try { await submit(form, close); } catch (er) { toast(er.message, 1); button.disabled = false; }
    };
  });
  return { modal, close };
}
async function reloadGuild(id = currentGuildId) {
  guilds = await api('/servers');
  currentGuildId = guilds.some(s => s.id === Number(id)) ? Number(id) : guilds[0]?.id || null;
  currentGuild = currentGuildId ? await api('/servers/' + currentGuildId) : null;
  if (!currentGuild?.channels.some(c => c.id === currentGuildChannel?.id)) currentGuildChannel = currentGuild?.channels[0] || null;
  writeAppRoute(currentGuildId
    ? { kind: 'server', serverId: currentGuildId, publicId: currentGuild.publicId, channelId: currentGuildChannel?.id }
    : { kind: 'home' }, 'replace');
  renderGuildView();
}
function applyGuildProfileUpdate(server) {
  if (!server || Number(server.id) !== Number(currentGuildId)) return;
  currentGuild = { ...currentGuild, ...server };
  guilds = guilds.map(item => Number(item.id) === Number(server.id) ? { ...item, ...server } : item);

  const sideHeader = $('.guild-side-head');
  const sideName = $('.guild-side-title-name');
  if (sideName) sideName.textContent = server.name;
  if (sideHeader) {
    const badge = $('.verified-server-badge', sideHeader);
    if (server.verified && !badge) sideName?.insertAdjacentHTML('afterend', verifiedServerBadge());
    else if (!server.verified) badge?.remove();
    sideHeader.classList.toggle('has-banner', !!server.banner);
    sideHeader.style.backgroundImage = server.banner
      ? `linear-gradient(90deg,#101218e8,#101218aa),url("${server.banner}")`
      : '';
  }

  const serverButton = $(`.guild-icon[data-guild="${Number(server.id)}"]`);
  if (serverButton) {
    serverButton.title = server.name;
    serverButton.innerHTML = server.icon
      ? `<img src="${esc(server.icon)}" alt="">`
      : esc([...server.name][0]?.toUpperCase() || '?');
  }

  const settingsName = $('.server-settings-nav header b');
  if (settingsName) settingsName.textContent = server.name;
  const welcomeName = $('#guild-main .guild-welcome h2');
  if (welcomeName) welcomeName.textContent = server.name;
  if (currentGuildChannel?.type === 'text' && !currentGuildChannel.topic) {
    const channelSubtitle = $('.guild-chat-head > div > small');
    if (channelSubtitle) channelSubtitle.innerHTML = `${esc(server.name)}${server.verified ? verifiedServerBadge('verified-server-badge-inline') : ''}`;
  }
  const onboardingTitle = $('#guild-chat-msgs .guild-onboarding h2');
  if (onboardingTitle && currentGuildChannel) {
    onboardingTitle.innerHTML = `${esc(server.name)} sunucusunun<br>${esc(currentGuildChannel.name)} kanalına hoş geldin!`;
  }
}
function newGuildModal() {
  guildForm('<h3>Sunucu oluştur</h3><p>Aven’de arkadaşlarınla buluşacağın yeni bir alan oluştur.</p><label>Sunucu adı<input name="name" maxlength="32" required placeholder="Örn. Arkadaş grubu"></label><div class="guild-form-actions"><button type="button" class="btn" data-close>Vazgeç</button><button class="btn primary" type="submit">Oluştur</button></div>', async (form, close) => {
    const result = await api('/servers', 'POST', { name: $('input[name=name]', form).value });
    close(); currentGuildChannel = null; await enterGuilds(result.id); toast('Sunucu oluşturuldu.');
  });
  $('.guild-modal [data-close]')?.addEventListener('click', () => $('.guild-modal')?.remove());
}
function joinGuildModal() {
  guildForm(`<div class="invite-heading"><span>↗</span><div><h3>Davetle sunucuya katıl</h3><p>Bağlantıyı ya da 12 haneli davet kodunu buraya yapıştır.</p></div></div><label>Davet bağlantısı veya kod<input name="invite" required autocomplete="off" placeholder="${esc(location.host)}/davetkodu"></label><div class="guild-form-actions"><button type="button" class="btn" data-close>Vazgeç</button><button class="btn primary" type="submit">Sunucuya katıl</button></div>`, async (form, close) => {
    const value = $('input[name=invite]', form).value.trim(), code = /^[A-Za-z0-9_-]{12}$/.test(value) ? value : (() => {
      try {
        const parsed = new URL(/^[a-z][a-z\d+.-]*:\/\//i.test(value) ? value : `https://${value}`);
        return parsed.searchParams.get('invite') || parsed.pathname.split('/').filter(Boolean).pop();
      } catch { return value; }
    })();
    if (!/^[A-Za-z0-9_-]{6,40}$/.test(code)) throw new Error('Davet kodunu kontrol et.');
    const result = await api(`/invites/${encodeURIComponent(code)}/join`, 'POST'); close(); currentGuildChannel = null; await enterGuilds(result.id); toast(`${result.name} sunucusuna katıldın.`);
  });
  $('.guild-modal [data-close]')?.addEventListener('click', () => $('.guild-modal')?.remove());
}
async function createGuildInvite(serverId = currentGuildId) {
  const invite = await api(`/servers/${serverId}/invites`, 'POST');
  const link = inviteUrl(invite.code);
  showGuildInviteLink(serverId, link);
}
async function copyGuildInvite(serverId = currentGuildId) {
  const invite = await api(`/servers/${serverId}/invites`, 'POST');
  const link = inviteUrl(invite.code);
  try {
    await navigator.clipboard.writeText(link);
    toast('Sunucu davet bağlantısı kopyalandı.');
  } catch {
    toast('Bağlantı panoya kopyalanamadı. Açılan pencereden kopyalayabilirsin.', 1);
    showGuildInviteLink(serverId, link);
  }
}
function showGuildInviteLink(serverId, link) {
  guildModal(`<div class="invite-heading"><span>↗</span><div><h3>Arkadaşlarını davet et</h3><p>Bağlantı 7 gün boyunca geçerli.</p></div></div><div class="invite-link-label">SUNUCU DAVET BAĞLANTISI</div><div class="guild-invite-link"><span>${/^https:\/\//.test(link) ? esc(link) : `https://${esc(link)}`}</span><button type="button" class="btn primary" data-copy>Bağlantıyı kopyala</button></div><div class="guild-form-actions"><button type="button" class="btn" data-close>Kapat</button><button type="button" class="btn invite-friends-open" data-invite-friends>Arkadaş seç</button></div>`, (modal) => {
    $('[data-close]', modal).onclick = () => modal.remove();
    $('[data-copy]', modal).onclick = async e => {
      try {
        await navigator.clipboard.writeText(/^https:\/\//.test(link) ? link : `https://${link}`);
        e.target.textContent = 'Kopyalandı';
      }
      catch { toast('Bağlantı kopyalanamadı. Adresi seçip kopyalayabilirsin.', 1); }
    };
    $('[data-invite-friends]', modal).onclick = () => { modal.remove(); inviteFriendsModal(serverId); };
  });
}
async function inviteFriendsModal(serverId) {
  const server = guilds.find(item => item.id === Number(serverId));
  const [friends, detail] = await Promise.all([getFr(), api(`/servers/${serverId}`)]);
  const entries = friends.friends.filter(friend => !friend.bot);
  const emptyMessage = 'Henüz davet edebileceğin bir arkadaşın yok.';
  guildModal(`<div class="invite-heading"><span>↗</span><div><h3>${esc(server?.name || detail.name)} sunucusuna davet et</h3><p>Arkadaşına davet bağlantısı gönder. Sunucuya katılım, bağlantıyı kabul ederek yapılır.</p></div></div><label class="invite-search"><span>⌕</span><input type="search" placeholder="Arkadaşlarını ara" autocomplete="off"></label><div class="invite-friend-list">${entries.length ? entries.map(friend => `<div class="invite-friend" data-invite-friend-row="${friend.id}">${av(friend)}<span><b>${esc(friend.displayName)}</b><small>@${esc(friend.username)}</small></span><span class="invite-friend-actions"><button type="button" class="btn sm primary" data-share-server-invite="${friend.id}">DM ile gönder</button></span></div>`).join('') : `<p class="invite-friend-empty">${emptyMessage}</p>`}</div><div class="guild-form-actions"><button class="btn" data-close>Kapat</button></div>`, modal => {
    $('[data-close]', modal).onclick = () => modal.remove();
    const search = $('.invite-search input', modal);
    search.oninput = () => modal.querySelectorAll('.invite-friend').forEach(row => { row.hidden = !row.textContent.toLocaleLowerCase('tr').includes(search.value.trim().toLocaleLowerCase('tr')); });
    modal.querySelectorAll('[data-share-server-invite]').forEach(button => button.onclick = async () => {
      button.disabled = true;
      try {
        const invite = await api(`/servers/${serverId}/invites`, 'POST');
        const message = await api(`/messages/${button.dataset.shareServerInvite}`, 'POST', { body: inviteUrl(invite.code) });
        if (message.request) {
          button.textContent = message.pending ? 'İstek gönderilmiş' : 'İstek gönderildi';
          toast('Davet bağlantısı mesaj isteği olarak gönderildi.');
        } else {
          button.textContent = 'Gönderildi';
          toast('Sunucu daveti arkadaşına DM ile gönderildi.');
        }
      } catch (er) { toast(er.message, 1); button.disabled = false; }
    });
  });
}
async function openServerContextMenu(serverId, x, y) {
  $('.server-context-pop')?.remove();
  const server = guilds.find(item => item.id === Number(serverId));
  if (!server) return;
  const detail = await api(`/servers/${serverId}`);
  const owner = detail.me.owner, perms = detail.me.permissions;
  const menu = document.createElement('div');
  menu.className = 'server-context-pop pop';
  menu.innerHTML = `<div class="server-context-title">${esc(server.name)}</div>
    ${(perms & 256) || owner ? '<button data-server-action="invite">♧ <span>Sunucuya davet et</span></button><button data-server-action="link">↗ <span>Davet bağlantısını oluştur</span></button>' : ''}
      ${owner ? `<div class="server-context-divider"></div>
      <div class="server-context-parent"><button data-server-action="settings">⚙ <span>Sunucu ayarları</span><i>›</i></button><div class="server-context-submenu">
        <button data-server-action="profile">▤ <span>Sunucu profili</span></button>
        <button data-server-action="members">♙ <span>Üyeler</span></button>
        <button data-server-action="roles">♙ <span>Roller</span></button>
        <button data-server-action="invites">↗ <span>Davetler</span></button>
        <button data-server-action="text">＋ <span>Metin kanalı oluştur</span></button><button data-server-action="voice">◖ <span>Ses kanalı oluştur</span></button>
        <button data-server-action="rename">✎ <span>Sunucu adını değiştir</span></button>
        <button class="danger" data-server-action="delete">⌫ <span>Sunucuyu sil</span></button>
      </div></div>` : `${perms & SERVER_ADMIN ? '<button data-server-action="settings">⚙ <span>Sunucu ayarları</span></button>' : ''}${perms & 8 ? '<button data-server-action="roles">♙ <span>Rolleri yönet</span></button>' : ''}${perms & 4 ? '<button data-server-action="text">＋ <span>Metin kanalı oluştur</span></button><button data-server-action="voice">◖ <span>Ses kanalı oluştur</span></button>' : ''}`}
    <button data-server-action="open">▦ <span>Sunucuyu aç</span></button>
    ${!owner ? '<div class="server-context-divider"></div><button class="danger" data-server-action="leave">↪ <span>Sunucudan Ayrıl</span></button>' : ''}
    ${me?.developerMode ? `<div class="server-context-divider"></div><button data-server-action="copy-id">${uiIcon('copy')} <span>Sunucu ID’sini kopyala</span></button>` : ''}`;
  document.body.append(menu);
  if (x > innerWidth - 490) menu.classList.add('left-submenu');
  menu.style.left = `${Math.max(8, Math.min(x, innerWidth - menu.offsetWidth - 8))}px`;
  menu.style.top = `${Math.max(8, Math.min(y, innerHeight - menu.offsetHeight - 8))}px`;
  const close = () => { menu.remove(); document.removeEventListener('click', outside); document.removeEventListener('keydown', onKey); };
  const outside = event => { if (!menu.contains(event.target)) close(); };
  const onKey = event => { if (event.key === 'Escape') close(); };
  setTimeout(() => { document.addEventListener('click', outside); document.addEventListener('keydown', onKey); });
  menu.onclick = async event => {
    const action = event.target.closest('[data-server-action]')?.dataset.serverAction;
    if (!action) return;
    if (action === 'copy-id') {
      close();
      return copyDeveloperIdentifier('Sunucu ID’si', server.publicId);
    }
    if (action === 'leave') {
      close();
      if (!confirm(`${server.name} sunucusundan ayrılmak istiyor musun?`)) return;
      try {
        if (voiceSession?.kind === 'server' && Number(voiceSession.guildId) === Number(serverId)) await leaveVoice(false);
        await api(`/servers/${serverId}/leave`, 'POST');
        guilds = await api('/servers');
        if (Number(currentGuildId) === Number(serverId)) await enterGuilds(guilds[0]?.id || null, null, 'replace');
        renderServerRail();
        toast(`${server.name} sunucusundan ayrıldın.`);
      } catch (er) { toast(er.message, 1); }
      return;
    }
    if (action === 'settings') {
      close();
      if (!owner && !(perms & SERVER_ADMIN)) return toast('Sunucu ayarlarına yalnızca sunucu sahibi veya yöneticiler erişebilir.', 1);
      try { await enterGuilds(serverId); serverSettingsModal(serverId); }
      catch (er) { toast(er.message, 1); }
      return;
    }
    close();
    try {
      if (action === 'invite') return await inviteFriendsModal(serverId);
      if (action === 'link') return await createGuildInvite(serverId);
      await enterGuilds(serverId);
      if (action === 'open') return;
      if (action === 'roles') return roleListModal();
      if (action === 'profile' || action === 'members' || action === 'invites') return serverSettingsModal(serverId, action);
      if (action === 'text' || action === 'voice') return channelModal(action);
      if (action === 'rename') return renameGuildModal();
      if (action === 'delete') return serverDeletionModal(serverId);
    } catch (er) { toast(er.message, 1); }
  };
}
function serverMenuModal() {
  if (!currentGuild?.me.owner && !(currentGuild?.me.permissions & SERVER_ADMIN)) {
    toast('Sunucu ayarlarına yalnızca sunucu sahibi veya yöneticiler erişebilir.', 1);
    return;
  }
  serverSettingsModal(currentGuildId);
}
function serverDeletionModal(serverId, closeSettings = () => {}) {
  const server = guilds.find(item => Number(item.id) === Number(serverId));
  if (!server) return toast('Sunucu bulunamadı.', 1);
  const { close } = guildModal(`<div class="server-delete-flow"><span class="server-delete-mark" aria-hidden="true">!</span><h3>Sunucuyu sil</h3><p><b>${esc(server.name)}</b> ve içindeki kanallar kalıcı olarak silinecek. Bu işlem geri alınamaz. Sunucuyu silmek istediğinden emin misin?</p><div class="guild-form-actions"><button type="button" class="btn" data-close>Vazgeç</button><button type="button" class="btn danger" data-server-delete-confirm>Sunucuyu sil</button></div></div>`, (root, close) => {
    $('[data-close]', root).onclick = close;
    const deleteButton = $('[data-server-delete-confirm]', root);
    deleteButton.onclick = async () => {
      deleteButton.disabled = true;
      try {
        await api(`/servers/${serverId}`, 'DELETE');
        close(); closeSettings(); currentGuildId = null; currentGuild = null; currentGuildChannel = null;
        await reloadGuild(null); renderServerRail(); toast('Sunucu silindi.');
      } catch (er) { toast(er.message, 1); deleteButton.disabled = false; }
    };
  });
}
function serverSettingsModal(serverId, initialSection = 'profile') {
  const owner = !!currentGuild?.me.owner, perms = currentGuild?.me.permissions || 0;
  const canManageBans = owner || !!(perms & SERVER_ADMIN);
  if ((!owner && !canManageBans) || Number(currentGuild?.id) !== Number(serverId)) {
    toast('Sunucu ayarlarına yalnızca sunucu sahibi veya yöneticiler erişebilir.', 1);
    return;
  }
  const sections = [
    ...(owner ? [['profile', 'Sunucu profili']] : []),
    ...(owner ? [['tag', 'Sunucu Etiketi']] : []),
    ['members', 'Üyeler'],
    ...(canManageBans ? [['bans', 'Yasaklananlar']] : []),
    ...(perms & 8 || owner ? [['roles', 'Roller']] : []),
    ...(perms & 256 || owner ? [['invites', 'Davetler']] : []),
    ...(perms & 4 || owner ? [['channels', 'Kanallar']] : [])
  ];
  const { modal, close } = guildModal(`<div class="server-settings-shell"><aside class="server-settings-nav"><header><small>SUNUCU AYARLARI</small><b>${esc(currentGuild.name)}</b></header>${sections.map(([key, label]) => `<button type="button" data-server-section="${key}">${label}</button>`).join('')}<button type="button" class="server-settings-close" data-close>Ayarları kapat</button></aside><section class="server-settings-content"></section></div>`, modal => {
    const content = $('.server-settings-content', modal);
    let activeSection = null;
    const renderSection = section => {
      const previousScroll = activeSection === section ? content.scrollTop : null;
      activeSection = section;
      modal.querySelectorAll('[data-server-section]').forEach(button => button.classList.toggle('on', button.dataset.serverSection === section));
      const manageable = owner || !!(perms & 128);
      if (section === 'profile') {
        content.innerHTML = `<div class="server-settings-title"><span>GENEL</span><h2>Sunucu profili</h2><p>Sunucunun adını ve görsellerini düzenle. Değişiklikler bütün üyelere yansır.</p></div>
          <form class="server-profile-form">
          <div class="server-profile-icon-editor"><div class="server-profile-icon-preview" data-server-icon-preview>${currentGuild.icon ? `<img src="${esc(currentGuild.icon)}" alt="">` : esc([...currentGuild.name][0]?.toUpperCase() || '?')}</div><div><b>Sunucu simgesi</b><small>JPG, PNG, GIF veya WebP görseli seç.</small><div class="server-profile-image-actions"><button type="button" class="btn sm" data-pick-server-icon>Görsel seç</button><button type="button" class="btn sm" data-clear-server-icon${currentGuild.icon ? '' : ' hidden'}>Kaldır</button></div></div><input type="file" data-server-icon-file accept="image/*" hidden></div>
          <div class="server-profile-banner-editor${currentGuild.banner ? ' has-image' : ''}" data-server-banner-preview${currentGuild.banner ? ` style="background-image:linear-gradient(90deg,#0b0d12a8,#0b0d1240),url('${esc(currentGuild.banner)}')"` : ''}><div><b>Sunucu banner'ı</b><small>Sunucu başlığında görünür.</small></div><div class="server-profile-image-actions"><button type="button" class="btn sm" data-pick-server-banner>Görsel seç</button><button type="button" class="btn sm" data-clear-server-banner${currentGuild.banner ? '' : ' hidden'}>Kaldır</button></div></div><input type="file" data-server-banner-file accept="image/*" hidden>
          <label>Sunucu adı<input name="name" maxlength="32" required value="${esc(currentGuild.name)}"></label>
          ${manageable ? '<button class="btn primary" type="submit">Değişiklikleri kaydet</button>' : '<p class="server-settings-note">Sunucu ayarlarını değiştirme iznin yok.</p>'}</form>
          ${owner ? '<div class="server-danger-zone"><div><b>Sunucuyu sil</b><small>Silme işlemi bir onayla başlatılır ve geri alınamaz.</small></div><button class="btn danger" data-delete-server>Sunucuyu sil</button></div>' : ''}`;
        const form = $('.server-profile-form', content);
        let icon = currentGuild.icon || null, banner = currentGuild.banner || null;
        const iconPreview = $('[data-server-icon-preview]', form), bannerPreview = $('[data-server-banner-preview]', form);
        const renderImagePreviews = () => {
          iconPreview.innerHTML = icon ? `<img src="${esc(icon)}" alt="">` : esc([...currentGuild.name][0]?.toUpperCase() || '?');
          $('[data-clear-server-icon]', form).hidden = !icon;
          bannerPreview.classList.toggle('has-image', !!banner);
          bannerPreview.style.backgroundImage = banner ? `linear-gradient(90deg,#0b0d12a8,#0b0d1240),url("${banner}")` : '';
          $('[data-clear-server-banner]', form).hidden = !banner;
        };
        const pickImage = (selector, width, height, setValue, maxLength) => {
          const fileInput = $(selector, form);
          fileInput.onchange = async () => {
            const file = fileInput.files?.[0];
            if (!file) return;
            try { setValue(await toAvatar(file, width, height, .72, maxLength)); renderImagePreviews(); }
            catch (er) { toast(er.message, 1); }
            finally { fileInput.value = ''; }
          };
          return () => fileInput.click();
        };
        $('[data-pick-server-icon]', form).onclick = pickImage('[data-server-icon-file]', 256, 256, value => icon = value, 90000);
        $('[data-pick-server-banner]', form).onclick = pickImage('[data-server-banner-file]', 960, 280, value => banner = value, 240000);
        $('[data-clear-server-icon]', form).onclick = () => { icon = null; renderImagePreviews(); };
        $('[data-clear-server-banner]', form).onclick = () => { banner = null; renderImagePreviews(); };
        form.onsubmit = async event => {
          event.preventDefault();
          const button = $('button[type=submit]', content); button.disabled = true;
          try {
            const updatedServer = await api(`/servers/${serverId}`, 'PATCH', { name: $('input[name=name]', content).value, icon, banner });
            applyGuildProfileUpdate(updatedServer);
            button.disabled = false;
            toast('Sunucu profili güncellendi.');
          }
          catch (er) { toast(er.message, 1); button.disabled = false; }
        };
        $('[data-delete-server]', content)?.addEventListener('click', async () => {
          serverDeletionModal(serverId, close);
        });
      } else if (section === 'tag') {
        const config = currentGuild.serverTag || { tag: '', badge: 'crest', enabled: false };
        content.innerHTML = `<div class="server-settings-title"><span>SUNUCU PROFİLİ</span><h2>Sunucu Etiketi</h2><p>Üyelerin adlarının yanında görünecek kısa bir etiket ve rozet seç. Üyeler profillerinden hangi sunucu etiketini kullanacaklarını belirleyebilir.</p></div>
          <div class="server-tag-settings-layout"><form class="server-tag-form">
            <label class="server-tag-enable"><input type="checkbox" name="enabled" ${config.enabled ? 'checked' : ''}><span><b>Sunucu etiketini etkinleştir</b><small>Etkinleştirildiğinde üyeler seçip kullanabilir.</small></span><i></i></label>
            <label class="server-tag-label">Sunucu etiketi<input name="tag" maxlength="4" autocomplete="off" spellcheck="false" value="${esc(config.tag)}" placeholder="AVEN"><small>En fazla 4 İngilizce harf veya rakam kullan.</small></label>
            <fieldset class="server-tag-badge-field"><legend>Etiket amblemi</legend><div class="server-tag-badge-grid">${SERVER_TAG_BADGES.map(badge => `<button type="button" data-tag-badge="${badge}" aria-label="${SERVER_TAG_BADGE_LABELS[badge]}" title="${SERVER_TAG_BADGE_LABELS[badge]}" aria-pressed="${badge === normalizeServerTagBadge(config.badge)}">${serverTagBadgeIcon(badge)}</button>`).join('')}</div></fieldset>
            <button class="btn primary" type="submit">Etiketi kaydet</button>
          </form><aside class="server-tag-preview"><small>ÖNİZLEME</small><div class="server-tag-preview-message">${av(me)}<span class="server-tag-preview-copy"><b class="server-tag-preview-name"><span>${esc(me.displayName)}</span><span class="guild-tag-chip"><i data-tag-preview-badge>${serverTagBadgeIcon(config.badge)}</i><b data-tag-preview-label>${esc(config.tag || 'AVEN')}</b></span></b><small>Mesajlarda ve üye listesinde böyle görünür.</small></span></div><p>Üyeler bu etiketi profillerindeki etiket seçicisinden kullanabilir.</p></aside></div>`;
        const form = $('.server-tag-form', content), input = $('input[name=tag]', form), enabledInput = $('input[name=enabled]', form);
        let badge = normalizeServerTagBadge(config.badge);
        const refreshTagPreview = () => {
          $('[data-tag-preview-label]', content).textContent = input.value.trim().toUpperCase() || 'AVEN';
          $('[data-tag-preview-badge]', content).innerHTML = serverTagBadgeIcon(badge);
          $('.server-tag-preview', content).classList.toggle('disabled', !enabledInput.checked);
        };
        form.querySelectorAll('[data-tag-badge]').forEach(button => button.classList.toggle('selected', button.dataset.tagBadge === badge));
        form.querySelectorAll('[data-tag-badge]').forEach(button => button.onclick = () => {
          badge = button.dataset.tagBadge;
          form.querySelectorAll('[data-tag-badge]').forEach(option => { option.classList.toggle('selected', option === button); option.setAttribute('aria-pressed', String(option === button)); });
          refreshTagPreview();
        });
        input.oninput = () => { input.value = input.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4); refreshTagPreview(); };
        enabledInput.onchange = refreshTagPreview;
        form.onsubmit = async event => {
          event.preventDefault();
          const button = $('button[type=submit]', form); button.disabled = true;
          try {
            await api(`/servers/${serverId}/tag`, 'PATCH', { tag: input.value.trim().toUpperCase(), badge: SERVER_TAG_BADGE_STORAGE[badge] || badge, enabled: enabledInput.checked });
            await reloadGuild(serverId); renderSection('tag'); toast('Sunucu etiketi güncellendi.');
          } catch (er) { toast(er.message, 1); button.disabled = false; }
        };
        refreshTagPreview();
      } else if (section === 'members') {
        content.innerHTML = `<div class="server-settings-title"><span>KİŞİLER</span><h2>Üyeler <small>${currentGuild.members.length}</small></h2><p>Sunucudaki üyeler ve atanmış rolleri.</p></div>
          <div class="server-settings-members">${currentGuild.members.map(member => {
            const roles = member.roleIds.map(id => currentGuild.roles.find(role => role.id === id)).filter(role => role && !role.everyone);
            return `<div class="server-settings-member"><button type="button" class="server-settings-member-profile" data-settings-member-profile="${member.id}" aria-label="${esc(member.displayName)} profilini gör">${av(member)}<span><b><span class="server-settings-member-name">${esc(member.displayName)}</span></b><small>@${esc(member.username)}</small></span></button>${tagPreview(member)}${roles.map(role => `<i style="--role-color:${esc(role.color)}">${esc(role.name)}</i>`).join('')}${(perms & 8) || owner ? `<button type="button" data-settings-member="${member.id}">Rolleri düzenle</button>` : ''}</div>`;
          }).join('')}</div>`;
        content.querySelectorAll('[data-settings-member-profile]').forEach(button => button.onclick = () => openServerMemberCard(+button.dataset.settingsMemberProfile, button).catch(er => toast(er.message, 1)));
        content.querySelectorAll('[data-settings-member]').forEach(button => button.onclick = () => { close(); memberRolesModal(+button.dataset.settingsMember); });
      } else if (section === 'bans') {
        content.innerHTML = `<div class="server-settings-title"><span>ÜYE YÖNETİMİ</span><h2>Yasaklananlar</h2><p>Bu üyeler sunucuya davet bağlantısıyla yeniden katılamaz. Bir üyeye sağ tıklayıp banı kaldırabilirsin.</p></div><div class="server-bans-list"><p class="server-bans-loading">Yasaklanan üyeler yükleniyor…</p></div>`;
        api(`/servers/${serverId}/bans`).then(bans => {
          if (!modal.isConnected || activeSection !== 'bans') return;
          const list = $('.server-bans-list', content);
          list.innerHTML = bans.length ? bans.map(ban => `<article class="server-ban-row" data-server-ban-id="${ban.id}" tabindex="0" aria-label="${esc(ban.displayName)} yasaklı üye; banı kaldırmak için sağ tıkla">
            <div class="server-ban-member">${av({ displayName: ban.displayName, avatar: ban.avatar }, 'server-ban-avatar')}<span><b>${esc(ban.displayName)}</b><small>@${esc(ban.username)} · ID: ${esc(ban.publicId)}</small></span></div>
            <div class="server-ban-detail"><small>YASAKLAMA NEDENİ</small><p>${esc(ban.reason)}</p><span>${new Date(ban.createdAt).toLocaleString(localeValue())} · ${esc(ban.moderator)} tarafından</span></div>
          </article>`).join('') : '<div class="server-bans-empty"><span>✓</span><b>Yasaklanan üye yok</b><p>Bu sunucuda yönetilen bir yasak bulunmuyor.</p></div>';
          list.querySelectorAll('[data-server-ban-id]').forEach(row => {
            const ban = bans.find(item => Number(item.id) === Number(row.dataset.serverBanId));
            row.oncontextmenu = event => ban && serverBanContextMenu(event, serverId, ban, () => renderSection('bans'));
          });
        }).catch(er => {
          if (activeSection === 'bans' && modal.isConnected) $('.server-bans-list', content).innerHTML = `<p class="server-bans-loading">${esc(er.message)}</p>`;
        });
      } else if (section === 'roles') {
        content.innerHTML = `<div class="server-settings-title"><span>KİŞİLER</span><h2>Roller</h2><p>Üyelerin rollerini ve izinlerini düzenle.</p></div><div class="server-settings-actions"><button class="btn primary" data-settings-roles>Rolleri yönet</button></div>${currentGuild.roles.map(role => `<div class="server-settings-role"><i style="--role-color:${esc(role.color)}"></i><span>${esc(role.name)}</span><small>${role.everyone ? 'Varsayılan rol' : `${currentGuild.members.filter(member => member.roleIds.includes(role.id)).length} üye`}</small></div>`).join('')}`;
        $('[data-settings-roles]', content).onclick = () => { close(); roleListModal(); };
      } else if (section === 'invites') {
        content.innerHTML = `<div class="server-settings-title"><span>KATILIM</span><h2>Davetler</h2><p>Arkadaşlarına davet bağlantısı gönder veya bağlantıyı kopyala.</p></div><div class="server-settings-actions"><button class="btn primary" data-settings-friend-invite>Arkadaşlarını davet et</button><button class="btn" data-settings-link-invite>Bağlantı oluştur</button></div><div class="server-settings-invite-note">Davet bağlantıları <b>https://${esc(location.host)}/kod</b> biçimindedir ve 7 gün geçerlidir.</div>`;
        $('[data-settings-friend-invite]', content).onclick = () => { close(); inviteFriendsModal(serverId).catch(er => toast(er.message, 1)); };
        $('[data-settings-link-invite]', content).onclick = () => { close(); createGuildInvite(serverId).catch(er => toast(er.message, 1)); };
      } else {
        content.innerHTML = `<div class="server-settings-title"><span>KANALLAR</span><h2>Kanallar</h2><p>Metin ve ses kanallarını yönet.</p></div><div class="server-settings-actions"><button class="btn primary" data-settings-new-channel="text">＋ Metin kanalı</button><button class="btn" data-settings-new-channel="voice">◖ Ses kanalı</button></div>${currentGuild.channels.map(channel => `<div class="server-settings-role"><i>${channel.type === 'voice' ? '◖' : '#'}</i><span>${esc(channel.name)}</span><small>${channel.type === 'voice' ? 'Ses kanalı' : 'Metin kanalı'}</small><button data-settings-channel="${channel.id}">Düzenle</button></div>`).join('')}`;
        content.querySelectorAll('[data-settings-new-channel]').forEach(button => button.onclick = () => { close(); channelModal(button.dataset.settingsNewChannel); });
        content.querySelectorAll('[data-settings-channel]').forEach(button => button.onclick = () => { const channel = currentGuild.channels.find(item => item.id === Number(button.dataset.settingsChannel)); close(); channelModal(channel.type, channel); });
      }
      activeSection = section;
      if (previousScroll !== null) requestAnimationFrame(() => { if (content.isConnected) content.scrollTop = previousScroll; });
    };
    modal.__refreshServerBans = () => renderSection('bans');
    modal.querySelectorAll('[data-server-section]').forEach(button => button.onclick = () => renderSection(button.dataset.serverSection));
    $('[data-close]', modal).onclick = () => close();
    const fallbackSection = owner ? sections[0][0] : canManageBans ? 'bans' : sections[0][0];
    renderSection(sections.some(([key]) => key === initialSection) ? initialSection : fallbackSection);
  });
  modal.classList.add('server-settings-modal');
  return close;
}
function renameGuildModal() {
  guildForm(`<h3>Sunucu adını değiştir</h3><label>Yeni ad<input name="name" maxlength="32" required value="${esc(currentGuild.name)}"></label><div class="guild-form-actions"><button type="button" class="btn" data-close>Vazgeç</button><button class="btn primary" type="submit">Kaydet</button></div>`, async (form, close) => {
    await api('/servers/' + currentGuildId, 'PATCH', { name: $('input', form).value }); close(); await reloadGuild();
  });
  $('.guild-modal [data-close]')?.addEventListener('click', () => $('.guild-modal')?.remove());
}
function channelModal(type, channel = null) {
  const edit = !!channel;
  guildForm(`<h3>${edit ? 'Kanal ayarları' : type === 'voice' ? 'Ses kanalı oluştur' : 'Metin kanalı oluştur'}</h3>
    <label>Kanal adı<input name="name" maxlength="40" required value="${esc(channel?.name || '')}" placeholder="genel-sohbet"></label>
    <label>Açıklama<input name="topic" maxlength="120" value="${esc(channel?.topic || '')}" placeholder="Kanal hakkında kısa bilgi"></label>
    <div class="guild-form-actions">${edit ? '<button type="button" class="btn" data-permissions>İzinler</button><button type="button" class="btn danger" data-delete>Kanalı sil</button>' : ''}<button type="button" class="btn" data-close>Vazgeç</button><button class="btn primary" type="submit">${edit ? 'Kaydet' : 'Oluştur'}</button></div>`, async (form, close) => {
    const data = { name: $('input[name=name]', form).value, topic: $('input[name=topic]', form).value };
    let created;
    if (edit) await api(`/servers/${currentGuildId}/channels/${channel.id}`, 'PATCH', data);
    else created = await api(`/servers/${currentGuildId}/channels`, 'POST', { ...data, type });
    close(); await reloadGuild();
    if (created && currentGuild?.channels.some(item => item.id === created.id)) await selectGuildChannel(created.id);
  });
  $('.guild-modal [data-close]')?.addEventListener('click', () => $('.guild-modal')?.remove());
  $('.guild-modal [data-permissions]')?.addEventListener('click', () => { $('.guild-modal')?.remove(); channelPermissionsModal(channel); });
  $('.guild-modal [data-delete]')?.addEventListener('click', async () => {
    if (!confirm(`#${channel.name} kanalı ve mesajları silinsin mi?`)) return;
    try { await api(`/servers/${currentGuildId}/channels/${channel.id}`, 'DELETE'); $('.guild-modal')?.remove(); await reloadGuild(); }
    catch (er) { toast(er.message, 1); }
  });
}
function channelMenuModal(id) {
  const channel = currentGuild?.channels.find(c => c.id === id); if (channel) channelModal(channel.type, channel);
}
function openChannelContextMenu(channelId, x, y) {
  const channel = currentGuild?.channels.find(item => item.id === channelId);
  if (!channel) return;
  $('.channel-context-pop')?.remove();
  const canManage = !!(currentGuild.me.permissions & 4) || currentGuild.me.owner;
  const canInvite = !!(currentGuild.me.permissions & 256) || currentGuild.me.owner;
  const menu = document.createElement('div');
  menu.className = 'server-context-pop channel-context-pop pop';
  menu.innerHTML = `<div class="server-context-title">${channel.type === 'voice' ? 'Ses kanalı' : 'Metin kanalı'} · ${esc(channel.name)}</div>
    <button data-channel-action="open">↗ <span>${channel.type === 'voice' ? 'Ses kanalına katıl' : 'Kanala git'}</span></button>
    ${(canInvite || canManage) ? '<button data-channel-action="invite">♧ <span>Sunucuya arkadaş davet et</span></button>' : ''}
    <div class="server-context-divider"></div>
    ${canManage ? `<div class="server-context-parent"><button data-channel-action="settings">⚙ <span>Kanal ayarları</span><i>›</i></button><div class="server-context-submenu">
      <button data-channel-action="edit">✎ <span>Kanalı düzenle</span></button>
      <button data-channel-action="permissions">♙ <span>İzinleri düzenle</span></button>
      <button class="danger" data-channel-action="delete">⌫ <span>Kanalı sil</span></button>
    </div></div>` : ''}
    ${me?.developerMode ? `<button data-channel-action="copy">${uiIcon('copy')} <span>Kanal kimliğini kopyala</span></button>` : ''}`;
  document.body.append(menu);
  if (x > innerWidth - 490) menu.classList.add('left-submenu');
  menu.style.left = `${Math.max(8, Math.min(x, innerWidth - menu.offsetWidth - 8))}px`;
  menu.style.top = `${Math.max(8, Math.min(y, innerHeight - menu.offsetHeight - 8))}px`;
  const close = () => { menu.remove(); document.removeEventListener('click', outside); document.removeEventListener('keydown', onKey); };
  const outside = event => { if (!menu.contains(event.target)) close(); };
  const onKey = event => { if (event.key === 'Escape') close(); };
  setTimeout(() => { document.addEventListener('click', outside); document.addEventListener('keydown', onKey); });
  menu.onclick = async event => {
    const action = event.target.closest('[data-channel-action]')?.dataset.channelAction;
    if (!action) return;
    if (action === 'settings') { close(); return channelModal(channel.type, channel); }
    close();
    try {
      if (action === 'open') return selectGuildChannel(channel.id);
      if (action === 'invite') return inviteFriendsModal(currentGuildId);
      if (action === 'edit') return channelModal(channel.type, channel);
      if (action === 'permissions') return channelPermissionsModal(channel);
      if (action === 'copy') {
        await navigator.clipboard.writeText(String(channel.id));
        toast('Kanal kimliği kopyalandı.');
      }
      if (action === 'delete') {
        if (!confirm(`#${channel.name} kanalı ve mesajları silinsin mi?`)) return;
        await api(`/servers/${currentGuildId}/channels/${channel.id}`, 'DELETE');
        await reloadGuild(currentGuildId);
        toast('Kanal silindi.');
      }
    } catch (er) { toast(er.message, 1); }
  };
}
function channelPermissionsModal(channel) {
  const targetRows = [
    ...currentGuild.roles.map(r => ({ type: 'role', id: r.id, name: r.everyone ? '@everyone' : r.name })),
    ...currentGuild.members.map(m => ({ type: 'member', id: m.id, name: `Üye: ${m.displayName}` }))
  ];
  const options = targetRows.map(t => `<option value="${t.type}:${t.id}">${esc(t.name)}</option>`).join('');
  const permissionRows = SERVER_PERMS.map(([bit, name]) => `<label class="permission-row"><span>${esc(name)}</span><select data-permission="${bit}"><option value="inherit">Varsayılanı kullan</option><option value="allow">İzin ver</option><option value="deny">Reddet</option></select></label>`).join('');
  const { modal, close } = guildModal(`<h3>#${esc(channel.name)} · Kanal izinleri</h3><p>İzin önceliği: üye → üye rolleri → @everyone → rol varsayılanı.</p><label>İzin hedefi<select data-permission-target>${options}</select></label><div class="permission-list">${permissionRows}</div><p class="permission-error" data-permission-error role="alert" hidden></p><div class="guild-form-actions"><button type="button" class="btn" data-close>Kapat</button><button type="button" class="btn primary" data-save>İzinleri kaydet</button></div>`, (root, close) => {
    const select = $('[data-permission-target]', root);
    const showCurrent = () => {
      const [type, rawId] = select.value.split(':'), id = Number(rawId), saved = channel.overwrites.find(o => o.targetType === type && o.targetId === id);
      root.querySelectorAll('[data-permission]').forEach(node => {
        const bit = Number(node.dataset.permission);
        node.value = saved && (saved.allow & bit) ? 'allow' : saved && (saved.deny & bit) ? 'deny' : 'inherit';
      });
    };
    select.onchange = showCurrent; showCurrent();
    $('[data-close]', root).onclick = close;
    $('[data-save]', root).onclick = async e => {
      e.preventDefault(); e.stopPropagation();
      const button = e.currentTarget, error = $('[data-permission-error]', root); button.disabled = true; button.textContent = 'Kaydediliyor…'; error.hidden = true;
      try {
        const [targetType, rawId] = select.value.split(':'), targetId = Number(rawId);
        let allow = 0, deny = 0;
        root.querySelectorAll('[data-permission]').forEach(node => { const bit = Number(node.dataset.permission); if (node.value === 'allow') allow |= bit; if (node.value === 'deny') deny |= bit; });
        if (allow || deny) await api(`/servers/${currentGuildId}/channels/${channel.id}/overwrites`, 'PUT', { targetType, targetId, allow, deny });
        else await api(`/servers/${currentGuildId}/channels/${channel.id}/overwrites/${targetType}/${targetId}`, 'DELETE');
        close(); toast('Kanal izinleri kaydedildi.'); reloadGuild().catch(er => toast(`İzinler kaydedildi; görünüm yenilenemedi: ${er.message}`, 1));
      } catch (er) { error.textContent = er.message; error.hidden = false; toast(er.message, 1); button.disabled = false; button.textContent = 'İzinleri kaydet'; }
    };
  });
  return { modal, close };
}
function roleListModal() {
  const roles = currentGuild.roles;
  guildModal(`<h3>Sunucu rolleri</h3><div class="guild-role-list">${roles.map(r => `<div class="guild-role-row"><i style="--role-color:${esc(r.color)}"></i><span>${esc(r.name)}${r.everyone ? ' · herkese otomatik verilir' : `${r.displaySeparately ? '<small>Üyeleri ayrı göster</small>' : ''}${r.selfAssignable ? '<small>Üyeler kendileri seçebilir</small>' : ''}`}</span>${r.everyone && !currentGuild.me.owner ? '<small>Sadece sunucu sahibi düzenleyebilir</small>' : `<button data-edit-role="${r.id}" title="Rolü düzenle">Düzenle</button>`}${r.everyone ? '' : `<button class="danger" data-remove-role="${r.id}" title="Rolü sil">Sil</button>`}</div>`).join('')}</div><div class="guild-form-actions"><button class="btn" data-close>Kapat</button><button class="btn primary" data-create-role>Rol oluştur</button></div>`, modal => {
    $('[data-close]', modal).onclick = () => modal.remove();
    $('[data-create-role]', modal).onclick = () => { modal.remove(); roleModal(); };
    modal.querySelectorAll('[data-edit-role]').forEach(b => b.onclick = () => { const role = roles.find(r => r.id === +b.dataset.editRole); modal.remove(); roleModal(role); });
    modal.querySelectorAll('[data-remove-role]').forEach(b => b.onclick = async () => {
      const role = roles.find(r => r.id === +b.dataset.removeRole);
      if (!confirm(`${role.name} rolü silinsin mi? Üyelerden kaldırılacak.`)) return;
      try { await api(`/servers/${currentGuildId}/roles/${role.id}`, 'DELETE'); modal.remove(); await reloadGuild(); roleListModal(); }
      catch (er) { toast(er.message, 1); }
    });
  });
}
function roleModal(role = null) {
  const edit = !!role, checked = bit => !!(role?.permissions & bit);
  const permissionInputs = SERVER_PERMS.map(([bit, name]) => `<label class="permission-check"><input type="checkbox" name="permission" value="${bit}" ${checked(bit) ? 'checked' : ''}><span>${esc(name)}</span></label>`).join('');
  const adminInput = !role?.everyone ? `<label class="permission-check role-admin-toggle"><input type="checkbox" name="administrator" ${checked(SERVER_ADMIN) ? 'checked' : ''}><span>Yönetici · Tüm izinler</span></label>` : '';
  guildForm(`<h3>${edit ? 'Rolü düzenle' : 'Rol oluştur'}</h3><label>Rol adı<input name="name" maxlength="24" required value="${esc(role?.name || '')}" placeholder="Örn. Moderatör"${role?.everyone ? ' readonly' : ''}></label>
    ${role?.everyone ? '<small>Bu varsayılan rol sunucuya katılan herkese otomatik verilir.</small>' : ''}
    <label>Rol rengi<input name="color" type="color" value="${esc(role?.color || '#8992a8')}"></label>${!role?.everyone ? `<label class="permission-check role-hoist-setting"><input type="checkbox" name="displaySeparately" ${role?.displaySeparately ? 'checked' : ''}><span>Üyeleri ayrı göster</span><small>Bu role sahip üyeler üye listesinde ayrı başlık altında görünür.</small></label><label class="permission-check role-self-assignment-setting"><input type="checkbox" name="selfAssignable" ${role?.selfAssignable ? 'checked' : ''} ${role?.selfAssignableChannelSafe === false && !role?.selfAssignable ? 'disabled' : ''}><span>Üyeler bu rolü kendileri ekleyebilsin</span><small>Üyeler yalnızca sunucu veya kanal izni vermeyen rolleri kendileri seçebilir.</small></label>` : ''}<section class="role-permissions"><b>Sunucu izinleri</b>${permissionInputs}${adminInput}</section>
    <div class="guild-form-actions"><button type="button" class="btn" data-close>Vazgeç</button><button class="btn primary" type="submit">${edit ? 'Kaydet' : 'Rol oluştur'}</button></div>`, async (form, close) => {
    let permissions = [...form.querySelectorAll('[name=permission]:checked')].reduce((bits, input) => bits | Number(input.value), 0);
    if ($('[name=administrator]', form)?.checked) permissions |= SERVER_ADMIN;
    const data = { name: $('input[name=name]', form).value, color: $('input[name=color]', form).value, permissions, displaySeparately: $('[name=displaySeparately]', form)?.checked || false, selfAssignable: $('[name=selfAssignable]', form)?.checked || false };
    await api(`/servers/${currentGuildId}/roles${edit ? `/${role.id}` : ''}`, edit ? 'PATCH' : 'POST', data);
    close(); await reloadGuild(); roleListModal();
  });
  const form = $('.guild-modal .guild-form'), admin = $('[name=administrator]', form);
  const selfAssign = $('[name=selfAssignable]', form), permissionChecks = [...form.querySelectorAll('[name=permission]')];
  const syncSelfAssign = () => {
    if (!selfAssign) return;
    const hasPermissions = !!admin?.checked || permissionChecks.some(input => !input.disabled && input.checked);
    if (hasPermissions) selfAssign.checked = false;
    selfAssign.disabled = hasPermissions || role?.selfAssignableChannelSafe === false;
  };
  syncSelfAssign();
  permissionChecks.forEach(input => input.addEventListener('change', syncSelfAssign));
  if (admin) {
    let savedBits = role?.permissions & ~SERVER_ADMIN || 0;
    const syncAdmin = () => {
      permissionChecks.forEach(input => {
        input.disabled = admin.checked;
        input.checked = admin.checked || !!(savedBits & Number(input.value));
      });
    };
    if (admin.checked) syncAdmin();
    admin.onchange = () => {
      if (admin.checked) savedBits = permissionChecks.reduce((bits, input) => bits | (input.checked ? Number(input.value) : 0), 0);
      syncAdmin();
      syncSelfAssign();
    };
    permissionChecks.forEach(input => input.onchange = () => {
      if (!admin.checked) savedBits = permissionChecks.reduce((bits, item) => bits | (item.checked ? Number(item.value) : 0), 0);
    });
  }
  $('.guild-modal [data-close]')?.addEventListener('click', () => $('.guild-modal')?.remove());
}
function memberRolesModal(memberId) {
  const member = currentGuild?.members.find(m => m.id === memberId); if (!member) return;
  if (!canManageMemberRoles(member)) { toast('Bu üyeye rol verme yetkin yok.', 1); return; }
  const roles = manageableMemberRoles(member);
  guildForm(`<h3>${esc(member.displayName)} · Rolleri</h3><div class="guild-member-role-list">${roles.map(r => `<label class="permission-check"><input type="checkbox" name="member-role" value="${r.id}" ${member.roleIds.includes(r.id) ? 'checked' : ''}><i style="--role-color:${esc(r.color)}"></i><span>${esc(r.name)}</span></label>`).join('') || '<small>Bu üyeye verebileceğin uygun bir rol yok.</small>'}</div><div class="guild-form-actions"><button type="button" class="btn" data-close>Vazgeç</button>${roles.length ? '<button class="btn primary" type="submit">Kaydet</button>' : ''}</div>`, async (form, close) => {
    const chosen = new Set([...form.querySelectorAll('[name=member-role]:checked')].map(i => Number(i.value)));
    for (const role of roles) {
      const had = member.roleIds.includes(role.id), want = chosen.has(role.id);
      if (had !== want) await api(`/servers/${currentGuildId}/members/${member.id}/roles/${role.id}`, want ? 'PUT' : 'DELETE');
    }
    close(); await reloadGuild();
  });
  $('.guild-modal [data-close]')?.addEventListener('click', () => $('.guild-modal')?.remove());
}
async function openServerMemberCard(memberId, anchor = null) {
  const member = currentGuild?.members.find(item => item.id === Number(memberId));
  if (!member) return;
  const guildId = currentGuildId, canManageRoles = canManageMemberRoles(member), manageableRoles = manageableMemberRoles(member), manageableRoleIds = new Set(manageableRoles.map(role => role.id));
  const profile = await api('/users/' + member.id);
  if (!currentGuild || currentGuildId !== guildId) return;
  const target = anchor?.isConnected ? anchor : $(`.guild-member[data-member-id="${member.id}"]`);
  if (!target) return;
  closeServerMemberPopover();
  const popover = document.createElement('section');
  popover.className = 'server-member-popover';
  popover.setAttribute('aria-label', `${profile.displayName} profili`);
  const renderRoles = () => {
    const roles = member.roleIds.map(id => currentGuild?.roles.find(role => role.id === id)).filter(role => role && !role.everyone);
    return roles.map(role => `<span class="member-role-chip${role.everyone ? ' is-default' : ''}" style="--role-color:${esc(role.color)}">${esc(role.name)}${manageableRoleIds.has(role.id) ? `<button type="button" data-remove-member-role="${role.id}" title="${esc(role.name)} rolünü kaldır">×</button>` : ''}</span>`).join('') || '<small class="member-no-roles">Henüz atanmış rol yok.</small>';
  };
  popover.innerHTML = `<button type="button" class="member-profile-close" data-close aria-label="Kapat">×</button>
    <div class="member-profile-banner banner"></div>
    <div class="member-profile-content">
      ${av(profile, 'member-profile-avatar')}<h2 class="member-profile-display-name">${esc(profile.displayName)}</h2><div class="member-profile-tag">${profileTag(profile)}</div><small class="member-profile-username">@${esc(profile.username)} · ${PRESENCE_LABELS[profile.presence] || 'Çevrimdışı'}</small>
      ${badgeRow(profile)}
      <p class="member-profile-bio">${profile.bio ? esc(profile.bio) : '<i>Henüz bir şey yazılmamış.</i>'}</p>
      ${member.id !== me.id ? `<div class="member-profile-actions"><button type="button" class="member-action-dm" data-member-dm>Mesaj gönder</button>${profile.isFriend ? '<button type="button" class="member-action-friend is-friend" disabled>Arkadaşsınız</button>' : '<button type="button" class="member-action-friend" data-member-friend>Arkadaş ekle</button>'}</div>` : ''}
      <div class="member-profile-roles">${renderRoles()}</div>
      ${canManageRoles && manageableRoles.length ? `<button type="button" class="member-add-role" data-toggle-roles>＋ Rol ekle</button>
        <div class="member-role-menu" hidden><label class="member-role-search">⌕<input type="search" placeholder="Rol ara" autocomplete="off"></label><div class="member-role-options"></div></div>` : ''}
    </div>`;
  setBanner(popover, profile);
  document.body.append(popover);
  const position = () => {
    if (!popover.isConnected || !target.isConnected) return closeServerMemberPopover();
    const rect = target.getBoundingClientRect(), width = popover.offsetWidth, height = popover.offsetHeight;
    let left = rect.left - width - 14;
    if (left < 8 && rect.right + width + 14 < innerWidth - 8) left = rect.right + 14;
    popover.style.left = `${Math.max(8, Math.min(left, innerWidth - width - 8))}px`;
    popover.style.top = `${Math.max(8, Math.min(rect.top - 24, innerHeight - height - 8))}px`;
  };
  const outside = event => { if (!popover.contains(event.target) && !target.contains(event.target)) closeServerMemberPopover(); };
  const keydown = event => { if (event.key === 'Escape') closeServerMemberPopover(); };
  serverMemberPopoverCleanup = () => {
    document.removeEventListener('click', outside);
    document.removeEventListener('keydown', keydown);
    removeEventListener('resize', position);
    removeEventListener('scroll', position, true);
    serverMemberPopoverCleanup = null;
  };
  const close = () => closeServerMemberPopover();
  $('[data-close]', popover).onclick = close;
  $('[data-member-dm]', popover)?.addEventListener('click', () => { close(); openDirectMessage(member.id); });
  $('[data-member-friend]', popover)?.addEventListener('click', async event => {
    const button = event.currentTarget; button.disabled = true;
    try { await api('/friends/request', 'POST', { username: profile.username }); await loadFriends(); toast('Arkadaşlık isteği gönderildi.'); close(); }
    catch (er) { toast(er.message, 1); button.disabled = false; }
  });
  position();
  setTimeout(() => {
    if (!popover.isConnected) return;
    document.addEventListener('click', outside);
    document.addEventListener('keydown', keydown);
    addEventListener('resize', position);
    addEventListener('scroll', position, true);
  });
  const menu = $('.member-role-menu', popover), search = $('.member-role-search input', popover), options = $('.member-role-options', popover);
  const refreshRoles = () => {
    if (!options) return;
    const query = search.value.trim().toLocaleLowerCase('tr');
    const available = manageableMemberRoles(member).filter(role => role.name.toLocaleLowerCase('tr').includes(query));
    options.innerHTML = available.map(role => `<label class="member-role-option"><input type="checkbox" data-toggle-member-role="${role.id}" ${member.roleIds.includes(role.id) ? 'checked' : ''}><i style="--role-color:${esc(role.color)}"></i><span>${esc(role.name)}</span>${role.displaySeparately ? '<small title="Üyeleri ayrı göster">Ayrı</small>' : ''}</label>`).join('') || '<small>Uygun rol bulunamadı.</small>';
  };
  const changeMemberRole = async (roleId, assign, reopenMenu = false) => {
    const query = search?.value || '';
    try {
      await api(`/servers/${guildId}/members/${member.id}/roles/${roleId}`, assign ? 'PUT' : 'DELETE');
      close(); await reloadGuild(guildId); await openServerMemberCard(member.id);
      const refreshedMenu = $('.member-role-menu'), refreshedSearch = $('.member-role-search input');
      if (reopenMenu && refreshedMenu && refreshedSearch) { refreshedMenu.hidden = false; refreshedSearch.value = query; refreshedSearch.dispatchEvent(new Event('input')); refreshedSearch.focus(); }
    } catch (er) { toast(er.message, 1); }
  };
  if (menu) {
    refreshRoles();
    $('[data-toggle-roles]', popover).onclick = () => { menu.hidden = !menu.hidden; if (!menu.hidden) search.focus(); };
    search.oninput = refreshRoles;
    options.onchange = event => {
      const input = event.target.closest('[data-toggle-member-role]');
      if (!input) return;
      input.disabled = true;
      changeMemberRole(input.dataset.toggleMemberRole, input.checked, true);
    };
    popover.querySelectorAll('[data-remove-member-role]').forEach(button => button.onclick = () => changeMemberRole(button.dataset.removeMemberRole, false, !menu.hidden));
  }
}
function closeServerMemberPopover() {
  $('.server-member-popover')?.remove();
  serverMemberPopoverCleanup?.();
}

async function loadFriends() {
  fr = await getFr();
  if (guildMode || !$('.side')) return;
  if (active && ![...fr.friends, ...fr.conversations].some(f => f.id === active)) { active = null; if (view === 'chat') { writeAppRoute({ kind: 'home' }, 'replace'); renderMain(); } }
  else if (view === 'chat' && active) {
    chatHeader();
    syncDmComposer(active).catch(er => toast(er.message, 1));
  } else if (view === 'chat') renderMain();
  renderSide();
}

function renderSide() {
  const previousList = $('#list');
  if (previousList && renderedSideTab) sideListScroll.set(renderedSideTab, previousList.scrollTop);
  const t = $('.tabs'), inc = fr.incoming.length;
  const requestCount = inc + fr.messageRequests.length;
  t.innerHTML = `<button data-t="friends" class="${tab === 'friends' ? 'on' : ''}">Arkadaşlar (${fr.friends.filter(f => !f.bot).length})</button><button data-t="requests" class="${tab === 'requests' ? 'on' : ''}">İstekler${requestCount ? ` <span class="badge">${requestCount}</span>` : ''}</button>`;
  t.onclick = e => { const b = e.target.closest('[data-t]'); if (b) { tab = b.dataset.t; renderSide(); } };
  const lastMessagePreview = last => {
    if (!last) return '';
    if (last.kind === 'image') return 'Fotoğraf';
    if (last.kind === 'video') return 'Video';
    if (last.kind === 'call-event') { try { return JSON.parse(last.body).type === 'ended' ? 'Sesli arama sona erdi' : 'Sesli arama başladı'; } catch { return 'Sesli arama'; } }
    return last.body;
  };
  const row = (u, extra, cls = '', attr = '') => `<div class="item ${cls}" ${attr}><span class="ava">${av(u)}${u.online ? `<i class="dot ${u.presence || 'online'}"></i>` : ''}</span><div class="t"><b>${esc(dmDisplayName(u))}${tagPreview(u)}</b><small>${u.note ? `<span class="dm-private-note-mark" title="Not ekli · sadece sana görünür">▤ </span>` : ''}${u.last ? esc((u.last.sender === me.id ? 'Sen: ' : '') + lastMessagePreview(u.last)) : '@' + esc(u.username)}</small></div>${extra}</div>`;
  let h = '';
  if (tab === 'friends') {
    h = fr.friends.map(u => row(u, `${unread[u.id] ? `<span class="badge">${unread[u.id]}</span>` : ''}<button class="x" data-act="remove" data-id="${u.fid}" title="Arkadaşlıktan çıkar">✕</button>`, u.id === active && view === 'chat' ? 'on' : '', `data-uid="${u.id}"`)).join('')
      || '<div class="empty">Henüz arkadaşın yok.<br>+ ile arkadaş ekleyebilirsin.</div>';
    if (fr.conversations.length) h += `<h4>Sohbetler</h4>${fr.conversations.map(u => row(u, `${u.blocked ? '<small class="dm-locked-tag">Engellendi</small>' : !u.canMessage ? '<small class="dm-locked-tag">Mesaj kapalı</small>' : ''}${unread[u.id] ? `<span class="badge">${unread[u.id]}</span>` : ''}`, u.id === active && view === 'chat' ? 'on' : '', `data-uid="${u.id}"`)).join('')}`;
  } else {
    h = (fr.messageRequests.length ? '<h4>Mesaj istekleri</h4>' + fr.messageRequests.map(request => row(request.sender, `<span class="dm-request-actions"><small class="dm-request-preview">${esc(request.body)}</small><span><button class="btn sm primary" data-dm-request="accept" data-id="${request.id}" data-sender-id="${request.sender.id}" title="Mesaj isteğini kabul et">✓</button><button class="btn sm danger" data-dm-request="decline" data-id="${request.id}" title="Mesaj isteğini sil">×</button></span></span>`)).join('') : '')
      + (inc ? '<h4>Gelen arkadaşlık istekleri</h4>' + fr.incoming.map(u => row(u, `<button class="btn sm primary" data-act="accept" data-id="${u.fid}">Kabul</button><button class="btn sm" data-act="decline" data-id="${u.fid}">Reddet</button>`)).join('') : '')
      + (fr.outgoing.length ? '<h4>Gönderilen</h4>' + fr.outgoing.map(u => row(u, `<button class="btn sm" data-act="remove" data-id="${u.fid}">İptal</button>`)).join('') : '')
      || '<div class="empty">Bekleyen istek yok.</div>';
  }
  const list = $('#list');
  list.innerHTML = h;
  list.scrollTop = renderedSideTab === tab && previousList ? previousList.scrollTop : sideListScroll.get(tab) || 0;
  renderedSideTab = tab;
  const inbox = $('[data-inbox]'), notificationCount = notifications.filter(item => !item.readAt).length;
  if (inbox) { inbox.innerHTML = `${uiIcon('inbox')}${notificationCount ? `<i>${notificationCount > 9 ? '9+' : notificationCount}</i>` : ''}`; inbox.onclick = () => inboxModal(); }
  const m = $('.me');
  m.innerHTML = `${accountMenuMarkup()}
  <button class="me-p" data-self-context aria-expanded="false" title="Hesap menüsü">${av(me)}<span><b>${esc(me.displayName)}</b><small>@${esc(me.username)}</small></span></button>${profileTag(me)}<button class="icon me-settings" title="Ayarlar" aria-label="Ayarlar">${uiIcon('settings')}</button><button class="icon me-logout" title="Çıkış yap" aria-label="Çıkış yap">${uiIcon('logout')}</button>`;
  bindAccountMenu(m, $('.me-p', m), $('.account-menu', m), renderSide);
  $('.me-settings', m).onclick = () => { $('.account-menu', m).classList.remove('on'); stab = 'profile'; setView('settings'); };
  $('.me-logout', m).onclick = logoutUser;
}

function initServerChannelSearch() {
  dmSearchCleanup?.();
  const input = $('[data-server-channel-search]'), panel = $('[data-search-results]'), wrap = $('.dm-quick-search');
  if (!input || !panel || !wrap) return;
  let timer = 0, controller = null, selected = -1;
  const buttons = () => [...panel.querySelectorAll('[data-search-result]')];
  const close = () => { panel.hidden = true; panel.innerHTML = ''; input.setAttribute('aria-expanded', 'false'); selected = -1; };
  const render = results => {
    panel.innerHTML = results.map(result => {
      const server = guilds.find(item => Number(item.id) === Number(result.serverId));
      const icon = result.kind === 'server'
        ? server?.icon ? `<img src="${esc(server.icon)}" alt="">` : esc([...result.serverName][0]?.toUpperCase() || 'S')
        : result.channelType === 'voice' ? '<span class="voice-channel-glyph" aria-hidden="true"></span>' : '#';
      const subtitle = result.kind === 'server' ? 'Sunucu' : `${result.serverName} · ${result.channelType === 'voice' ? 'Ses kanalı' : 'Metin kanalı'}`;
      return `<button type="button" class="dm-search-result" role="option" aria-selected="false" data-search-result data-kind="${result.kind}" data-server-id="${result.serverId}"${result.channelId ? ` data-channel-id="${result.channelId}"` : ''}><span class="dm-search-result-icon">${icon}</span><span class="dm-search-result-copy"><b class="dm-search-result-title">${esc(result.kind === 'server' ? result.serverName : result.channelName)}</b><small class="dm-search-result-subtitle">${esc(subtitle)}</small></span><i>${result.kind === 'server' ? '↗' : '#'}</i></button>`;
    }).join('') || '<p class="dm-search-empty">Sunucu veya kanal bulunamadı.</p>';
    panel.hidden = false; input.setAttribute('aria-expanded', 'true'); selected = -1;
  };
  const search = async () => {
    const query = input.value.trim();
    controller?.abort(); controller = null;
    if (!query) return close();
    panel.innerHTML = '<p class="dm-search-empty">Sunucular ve kanallar aranıyor…</p>';
    panel.hidden = false; input.setAttribute('aria-expanded', 'true');
    controller = new AbortController();
    try {
      const results = await api('/server-search?q=' + encodeURIComponent(query), 'GET', undefined, controller.signal);
      if (input.value.trim() === query) render(results);
    } catch (error) {
      if (error.name !== 'AbortError' && input.value.trim() === query) panel.innerHTML = `<p class="dm-search-empty">${esc(error.message)}</p>`;
    }
  };
  const choose = async button => {
    if (!button) return;
    const serverId = Number(button.dataset.serverId), channelId = Number(button.dataset.channelId) || 0;
    close(); input.value = ''; input.blur();
    try { await enterGuilds(serverId, channelId || null); }
    catch (error) { toast(error.message, 1); }
  };
  input.addEventListener('input', () => { clearTimeout(timer); controller?.abort(); timer = setTimeout(search, 180); });
  input.addEventListener('keydown', event => {
    const options = buttons();
    if (event.key === 'ArrowDown' && options.length) { event.preventDefault(); selected = (selected + 1) % options.length; options.forEach((button, index) => button.setAttribute('aria-selected', String(index === selected))); options[selected].scrollIntoView({ block: 'nearest' }); }
    else if (event.key === 'ArrowUp' && options.length) { event.preventDefault(); selected = (selected - 1 + options.length) % options.length; options.forEach((button, index) => button.setAttribute('aria-selected', String(index === selected))); options[selected].scrollIntoView({ block: 'nearest' }); }
    else if (event.key === 'Enter' && options.length) { event.preventDefault(); choose(options[selected < 0 ? 0 : selected]); }
    else if (event.key === 'Escape') close();
  });
  panel.addEventListener('click', event => choose(event.target.closest('[data-search-result]')));
  const outside = event => { if (!wrap.contains(event.target)) close(); };
  const shortcut = event => { if ((event.ctrlKey || event.metaKey) && String(event.key).toLowerCase() === 'k') { event.preventDefault(); input.focus(); input.select(); } };
  document.addEventListener('click', outside, true);
  document.addEventListener('keydown', shortcut, true);
  dmSearchCleanup = () => { clearTimeout(timer); controller?.abort(); document.removeEventListener('click', outside, true); document.removeEventListener('keydown', shortcut, true); };
}

async function refreshNotifications() {
  try { notifications = await api('/notifications'); } catch { return; }
  const button = $('[data-inbox]');
  if (button) { const count = notifications.filter(item => !item.readAt).length; button.innerHTML = `${uiIcon('inbox')}${count ? `<i>${count > 9 ? '9+' : count}</i>` : ''}`; }
  const modal = $('.inbox-modal'); if (modal) drawInbox(modal);
}
function notificationTitle(item) {
  if (item.type === 'announcement' && item.announcement) {
    const labels = { tr: 'Duyuru:', en: 'Announcement:', de: 'Mitteilung:' };
    return `<span data-notification-title>${labels[uiLanguage] || labels.tr} ${esc(item.announcement.title)}</span>`;
  }
  const copy = NOTIFICATION_COPY[uiLanguage] || NOTIFICATION_COPY.tr;
  const who = esc(item.actor?.displayName || (uiLanguage === 'de' ? 'Ein Nutzer' : uiLanguage === 'en' ? 'A user' : 'Bir kullanıcı'));
  return `<span data-notification-title>${who} ${copy[item.type] || copy.fallback}</span>`;
}
const INBOX_ANNOUNCEMENT_ICON = '<span class="inbox-announcement-icon" aria-hidden="true"><svg viewBox="0 0 40 40" focusable="false"><path d="M13 9.5h13.5a2 2 0 0 1 2 2v13H13a2 2 0 0 1-2-2v-11a2 2 0 0 1 2-2Z" fill="#eeeaff"/><path d="M15.5 14h8M15.5 17.5h6" stroke="#8378d4" stroke-linecap="round" stroke-width="1.35"/><rect x="7" y="16.5" width="26" height="18.5" rx="4.5" fill="#7067c7" stroke="#b8b0ff" stroke-width="1.15"/><path d="m8 19 10.3 7.6a2.8 2.8 0 0 0 3.4 0L32 19M8.7 32l7.2-5.8m15.4 5.8-7.2-5.8" fill="none" stroke="#f3f1ff" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"/><circle cx="30.5" cy="11" r="6.5" fill="#282745" stroke="#a5dffc" stroke-width="1.1"/><text x="30.5" y="13.5" fill="#d8f5ff" font-family="Arial,sans-serif" font-size="7" font-weight="700" text-anchor="middle">A</text></svg></span>';
function inboxFriendIcon(type) {
  const marks = {
    'friend-request': '<path d="M8 3.5v9M3.5 8h9"/>',
    'friend-accepted': '<path d="m3.5 8 3 3 6-7"/>',
    'friend-declined': '<path d="m4.5 4.5 7 7m0-7-7 7"/>'
  };
  if (!marks[type]) return '';
  return `<span class="inbox-announcement-icon inbox-friend-icon" aria-hidden="true"><svg viewBox="0 0 36 36" focusable="false"><circle cx="14" cy="12" r="4.4" fill="#ded9ff"/><path d="M5.5 28c.3-5.5 3.2-8.5 8.5-8.5s8.3 3 8.5 8.5" fill="#8176ec" stroke="#c4bbff" stroke-linejoin="round" stroke-width="1.1"/><circle cx="24.5" cy="14.5" r="3.4" fill="#a9e9ff"/><path d="M21.7 20c3.5-.4 6.6 1.8 7.2 5.5" fill="none" stroke="#a9e9ff" stroke-linecap="round" stroke-width="1.7"/></svg><span class="inbox-friend-state"><svg viewBox="0 0 16 16" focusable="false">${marks[type]}</svg></span></span>`;
}
function inboxItemIcon(item) {
  if (item.type === 'announcement') return INBOX_ANNOUNCEMENT_ICON;
  if (item.type.startsWith('friend-')) return inboxFriendIcon(item.type);
  return item.actor ? av(item.actor) : '<span class="av">A</span>';
}
function drawInbox(modal) {
  const mode = modal.dataset.mode || 'all', list = mode === 'unread' ? notifications.filter(item => !item.readAt) : mode === 'requests' ? notifications.filter(item => item.type.endsWith('request')) : notifications;
  $('.inbox-items', modal).innerHTML = list.map(item => `<article class="inbox-item${item.readAt ? '' : ' unread'}" data-notification="${item.id}"><span class="ava">${inboxItemIcon(item)}</span><div><b>${notificationTitle(item)}</b><small>${fmt(item.createdAt)}</small></div>${!item.readAt && item.type === 'friend-request' ? `<span class="inbox-actions"><button class="btn sm primary" data-inbox-action="accept" data-id="${item.entityId}">✓</button><button class="btn sm" data-inbox-action="decline" data-id="${item.entityId}">×</button></span>` : !item.readAt && item.type === 'dm-request' ? `<span class="inbox-actions"><button class="btn sm primary" data-inbox-action="dm-accept" data-id="${item.entityId}">✓</button><button class="btn sm" data-inbox-action="dm-decline" data-id="${item.entityId}">×</button></span>` : '<span class="inbox-open">›</span>'}</article>`).join('') || '<div class="empty">Burada yeni bir şey yok.</div>';
}
async function inboxModal() {
  await refreshNotifications();
  $('.inbox-modal')?.remove();
  const modal = document.createElement('div'); modal.className = 'modal inbox-modal fade'; modal.dataset.mode = 'all';
  modal.innerHTML = `<section class="inbox-dialog pop"><header><div><small>GELEN KUTUSU</small><h2>Bildirimler</h2></div><button class="icon" data-inbox-close aria-label="Kapat">×</button></header><nav><button data-inbox-tab="all" class="on">Tümü</button><button data-inbox-tab="unread">Okunmamış</button><button data-inbox-tab="requests">İstekler</button><button data-inbox-readall>Hepsini okundu işaretle</button></nav><div class="inbox-items"></div></section>`;
  document.body.append(modal); drawInbox(modal);
  const close = () => { modal.remove(); document.removeEventListener('keydown', key); }, key = e => e.key === 'Escape' && close();
  modal.onclick = async e => {
    if (e.target === modal || e.target.closest('[data-inbox-close]')) return close();
    const tabButton = e.target.closest('[data-inbox-tab]');
    if (tabButton) { modal.dataset.mode = tabButton.dataset.inboxTab; modal.querySelectorAll('[data-inbox-tab]').forEach(button => button.classList.toggle('on', button === tabButton)); return drawInbox(modal); }
    if (e.target.closest('[data-inbox-readall]')) { await api('/notifications/read-all', 'POST'); await refreshNotifications(); return; }
    const action = e.target.closest('[data-inbox-action]');
    if (action) {
      action.disabled = true;
      try {
        if (action.dataset.inboxAction.startsWith('dm-')) await api(`/message-requests/${action.dataset.id}/${action.dataset.inboxAction.slice(3)}`, 'POST');
        else await api(`/friends/${action.dataset.id}/${action.dataset.inboxAction}`, 'POST');
        await Promise.all([loadFriends(), refreshNotifications()]);
      } catch (er) { toast(er.message, 1); action.disabled = false; }
      return;
    }
    const row = e.target.closest('[data-notification]'); if (!row) return;
    const item = notifications.find(value => value.id === Number(row.dataset.notification));
    if (!item) return;
    if (item.type === 'announcement' && item.announcement) {
      try { await api(`/announcements/${item.entityId}/view`, 'POST'); }
      catch (error) { toast(error.message, 1); }
      await refreshNotifications();
      close();
      presentAnnouncement(item.announcement);
      return;
    }
    if (!item.readAt) await api(`/notifications/${item.id}/read`, 'POST').catch(() => {});
    await refreshNotifications();
    if (item.type === 'profile-update' && item.actor) profileModal(item.actor.id);
    else if (item.type === 'friend-request' || item.type === 'dm-request') { tab = 'requests'; renderSide(); }
    else if (item.type === 'friend-accepted' && item.actor) openDirectMessage(item.actor.id);
  };
  document.addEventListener('keydown', key);
}

function accountMenuMarkup() {
  const presence = me.presence || 'online';
  return `<div class="account-menu" aria-hidden="true">
    <div class="account-cover"${me.banner ? ` style="background-image:linear-gradient(110deg,rgba(10,15,30,.08),rgba(10,15,30,.34)),url('${me.banner}')"` : ''}></div>
    <div class="account-summary" data-self-context><span class="account-avatar ${presence}">${av(me, 'xl')}</span><div class="account-summary-name"><b>${esc(me.displayName)}</b>${profileTag(me)}</div><small>@${esc(me.username)}</small>${badgeRow(me)}<p>${me.bio ? esc(me.bio) : 'Hakkında henüz bir şey yazılmamış.'}</p></div>
    <div class="account-actions"><button data-account="edit"><span><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></svg></span> Profili Düzenle</button>
      <button class="status-toggle" data-account="status" aria-expanded="false"><span class="presence-dot ${presence}"></span><span class="status-label">${PRESENCE_LABELS[presence] || PRESENCE_LABELS.online}</span><i>›</i></button>
      <div class="status-options account-submenu">${Object.entries(PRESENCE_LABELS).filter(([key]) => key !== 'offline').map(([key, label]) => `<button data-presence="${key}" class="${key === presence ? 'selected' : ''}"><span class="presence-dot ${key}"></span>${label}${key === presence ? '<b>✓</b>' : ''}</button>`).join('')}</div>
    </div>
    <div class="account-switch"><button data-account="switch" aria-expanded="false"><span><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M17 4.5a3.5 3.5 0 0 1 0 7M21.5 20a6.5 6.5 0 0 0-4-6"/></svg></span> Hesap Değiştir<i>›</i></button><div class="account-list account-submenu"></div></div>
    ${me.developerMode && me.publicId ? `<div class="account-id-copy"><button data-account="copy-id"><span>${uiIcon('copy')}</span> Kullanıcı ID'sini Kopyala</button></div>` : ''}
    <div class="account-logout"><button data-account="logout"><span><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5M21 12H9"/></svg></span> Çıkış Yap</button></div>
  </div>`;
}

function bindAccountMenu(container, accountButton, menu, refresh) {
  const closeSubmenus = () => {
    $('.status-options', menu).classList.remove('on');
    $('.account-list', menu).classList.remove('on');
    $('.status-toggle', menu).setAttribute('aria-expanded', 'false');
    $('[data-account="switch"]', menu).setAttribute('aria-expanded', 'false');
  };
  accountButton.onclick = () => {
    const open = menu.classList.toggle('on');
    if (!open) closeSubmenus();
    menu.setAttribute('aria-hidden', String(!open));
    accountButton.setAttribute('aria-expanded', String(open));
  };
  container.onclick = async e => {
    const action = e.target.closest('[data-account]')?.dataset.account;
    const status = e.target.closest('[data-presence]')?.dataset.presence;
    if (status) {
      e.stopPropagation();
      try {
        const keepMenuOpen = menu.classList.contains('on');
        me = await api('/me', 'PUT', { presence: status });
        refresh();
        if (keepMenuOpen) {
          const nextMenu = $('.account-menu'), nextButton = $('.me-p, [data-guild-profile]');
          nextMenu.classList.add('on'); nextMenu.setAttribute('aria-hidden', 'false'); nextButton.setAttribute('aria-expanded', 'true');
        }
        toast(`Durumun: ${PRESENCE_LABELS[status]}`);
      } catch (er) { toast(er.message, 1); }
      return;
    }
    if (action === 'status') {
      const toggle = $('.status-toggle', menu), options = $('.status-options', menu);
      const open = options.classList.toggle('on');
      if (open) { $('.account-list', menu).classList.remove('on'); $('[data-account="switch"]', menu).setAttribute('aria-expanded', 'false'); }
      toggle.setAttribute('aria-expanded', String(open));
    } else if (action === 'edit') {
      menu.classList.remove('on'); menu.setAttribute('aria-hidden', 'true'); accountButton.setAttribute('aria-expanded', 'false');
      closeSubmenus(); stab = 'profile';
      if (guildMode) { await boot(false); setView('settings'); }
      else setView('settings');
    }
    else if (action === 'switch') {
      const button = $('[data-account="switch"]', menu), list = $('.account-list', menu);
      const open = list.classList.toggle('on');
      if (open) { $('.status-options', menu).classList.remove('on'); $('.status-toggle', menu).setAttribute('aria-expanded', 'false'); }
      button.setAttribute('aria-expanded', String(open));
      if (open) refreshDeviceAccounts().catch(er => toast(er.message, 1));
    } else if (action === 'copy-id') {
      menu.classList.remove('on'); menu.setAttribute('aria-hidden', 'true'); accountButton.setAttribute('aria-expanded', 'false'); closeSubmenus();
      await copyDeveloperIdentifier('Kullanıcı ID’si', me.publicId);
    } else if (action === 'logout') logoutUser();
  };
}

async function logoutUser() {
  try {
    if (voiceSession) await leaveVoice(false);
    await api('/logout', 'POST');
    es?.close(); clearInterval(poll); me = null;
    history.replaceState(null, '', '/');
    document.documentElement.dataset.theme = 'dark';
    authScreen(false);
  } catch (er) { toast(er.message, 1); }
}

async function restoreAppRoute(route = readAppRoute()) {
  const requested = route || { kind: 'home' };
  if (requested.kind === 'home' && (location.pathname !== '/channels/@me' || location.search || location.hash)) writeAppRoute(requested, 'replace');
  if (requested.kind === 'server') {
    const publicServer = requested.publicId ? guilds.find(server => String(server.publicId || '').toUpperCase() === requested.publicId) : null;
    if (requested.publicId && !publicServer) { await boot(false, undefined, { kind: 'home' }, 'replace'); return; }
    await enterGuilds(publicServer?.id ?? requested.serverId, requested.channelId, 'none');
    return;
  }
  if (guildMode) {
    await boot(false, undefined, requested, 'none');
    return;
  }
  if (requested.kind === 'dm') {
    const contact = [...fr.friends, ...fr.conversations].find(item => requested.publicId
      ? String(item.publicId || '').toUpperCase() === requested.publicId
      : Number(item.id) === Number(requested.userId));
    if (!contact) {
      active = null; view = 'chat'; writeAppRoute({ kind: 'home' }, 'replace');
      renderSide(); renderMain();
      return;
    }
    active = Number(contact.id); view = 'chat';
    writeAppRoute({ kind: 'dm', publicId: contact.publicId }, 'replace');
  } else {
    active = null; view = 'chat';
  }
  renderSide(); renderMain();
}
window.addEventListener('popstate', () => {
  if (!me) return;
  restoreAppRoute().catch(error => {
    toast(error.message, 1);
    boot(false, undefined, { kind: 'home' }, 'replace').catch(er => toast(er.message, 1));
  });
});

async function listClick(e) {
  if (e.target.closest('[data-profile-tag-action]')) return;
  const dmRequest = e.target.closest('[data-dm-request]');
  if (dmRequest) {
    const { id, dmRequest: action } = dmRequest.dataset;
    dmRequest.disabled = true;
    try {
      await api(`/message-requests/${id}/${action}`, 'POST');
      await loadFriends();
      if (action === 'accept') {
        const contact = fr.conversations.find(item => item.id === Number(dmRequest.dataset.senderId));
        if (contact) openChat(contact.id);
        toast('Mesaj isteği kabul edildi.');
      }
    } catch (er) { toast(er.message, 1); dmRequest.disabled = false; }
    return;
  }
  const b = e.target.closest('[data-act]');
  if (b) {
    const { act, id } = b.dataset;
    if (act === 'remove' && !confirm('Bu kaydı silmek istediğine emin misin?')) return;
    try {
      await (act === 'remove' ? api('/friends/' + id, 'DELETE') : api(`/friends/${id}/${act}`, 'POST'));
      await loadFriends();
    } catch (er) { toast(er.message, 1); }
    return;
  }
  const it = e.target.closest('[data-uid]'); if (it) { view = 'chat'; openChat(+it.dataset.uid); }
}

function setView(v) { view = v; renderSide(); renderMain(); }

function renderMain() {
  const m = $('#main'), app = $('#app'); app.classList.toggle('open', view !== 'chat' || !!active);
  const sameMain = renderedMainView === view && (view !== 'chat' || renderedMainActive === active);
  const previousMainScroll = sameMain
    ? view === 'settings' ? $('.settings-content', m)?.scrollTop ?? null
      : view === 'profile' ? $('.panel', m)?.scrollTop ?? null
        : view === 'chat' ? $('#msgs', m)?.scrollTop ?? null
          : m.scrollTop
    : null;
  const previousSettingsNavScroll = sameMain && view === 'settings' ? $('.settings-nav', m)?.scrollTop ?? null : null;
  app.classList.toggle('dm-open', view === 'chat' && !!active);
  renderDmProfile();
  const back = `<button class="icon back" title="Geri" aria-label="Geri">${uiIcon('back')}</button>`;
  const bindBack = () => { const b = $('.back', m); if (b) b.onclick = () => app.classList.remove('open'); };
  if (view === 'profile') {
    const pu = { ...me, online: (me.presence || 'online') !== 'invisible', friendCount: fr.friends.filter(f => !f.bot).length };
    m.innerHTML = `<div class="main-h">${back}<b>Profil</b></div><div class="panel fade"><div class="box pcard">${profCard(pu)}</div></div>`; setBanner(m, pu);
  } else if (view === 'settings') settingsView(m, back);
  else if (active) { chatView(m, back); openChat(active, true, previousMainScroll); }
 
  else m.innerHTML = `<div class="main-h">${back}<b>Ana sayfa</b></div><div class="home home-v2 fade">
    <div class="home-hello">${av(me, 'xl')}<div><h2>Hoş geldin, ${esc(me.displayName)}</h2><p>Soldan bir arkadaşını seç ve yazışmaya başla.</p></div></div>
    <div class="home-stats">
      <div class="home-stat"><b>${fr.friends.filter(f => !f.bot).length}</b><span>Arkadaş</span></div>
      <div class="home-stat"><b>${fr.friends.filter(f => f.online && !f.bot).length}</b><span>Çevrimiçi</span></div>
      <div class="home-stat"><b>${fr.incoming.length}</b><span>Bekleyen istek</span></div>
    </div>
    <div class="home-tips">
      <div class="home-tip"><b>Arkadaş ekle</b><span>Kullanıcı adıyla ara, istek gönder.</span><button class="btn sm primary" id="hadd">Arkadaş ekle</button></div>
      <div class="home-tip"><b>Dosya paylaş</b><span>Fotoğraf ve videolar içeriği tutulmadan cihazlar arasında aktarılır ve anonimlik sağlanır. (en çok 25 MB).</span></div>
      <div class="home-tip"><b>Mesaj işlemleri</b><span>DM mesajına sağ tıklayarak düzenleme, yanıtla, ilet ve kopyala seçeneklerini aç.</span></div>
    </div></div>`;
  bindBack(); $('#hadd')?.addEventListener('click', addModal);
  renderedMainView = view;
  renderedMainActive = active;
  if (sameMain && view !== 'chat' && previousMainScroll !== null) requestAnimationFrame(() => {
    const target = view === 'settings' ? $('.settings-content', m) : view === 'profile' ? $('.panel', m) : m;
    if (target?.isConnected) target.scrollTop = previousMainScroll;
    if (view === 'settings' && previousSettingsNavScroll !== null) $('.settings-nav', m).scrollTop = previousSettingsNavScroll;
  });
}

/* ---------- Sohbet ---------- */
const friend = id => fr.friends.find(f => f.id === id) || fr.conversations.find(f => f.id === id);
async function openDirectMessage(id) {
  let profile;
  try { profile = await api('/users/' + id); }
  catch (er) { toast(er.message, 1); return; }
  if (profile.isFriend || fr.conversations.some(item => item.id === profile.id)) {
    if (guildMode) await boot(false);
    view = 'chat'; openChat(profile.id); return;
  }
  const allowed = profile.messagePolicy === 'everyone' && profile.canMessage;
  const explanation = allowed
    ? 'Bu kişi arkadaş olmayanlardan gelen mesajları istek olarak alıyor.'
    : profile.messagePolicy === 'nobody'
      ? 'Bu kullanıcı DM alımını kapatmış. Mesaj gönderemezsin.'
      : profile.messagePolicy === 'friends'
        ? 'Bu kullanıcı yalnızca arkadaşlarından mesaj alıyor. Önce arkadaşlık isteği gönderebilirsin.'
        : 'Bu kullanıcıyla mesajlaşma şu anda kullanılamıyor.';
  const { modal } = guildModal(`<form class="dm-request-form">
    <header class="invite-heading">${av(profile)}<div><h3>${esc(profile.displayName)}</h3><p>@${esc(profile.username)}</p></div></header>
    <p class="dm-request-note">${esc(explanation)}</p>
    ${allowed ? '<textarea name="body" maxlength="2000" required placeholder="İlk mesajını yaz…" rows="4"></textarea>' : ''}
    <div class="guild-form-actions">${profile.messagePolicy !== 'nobody' ? '<button type="button" class="btn" data-dm-add-friend>Arkadaş ekle</button>' : ''}<button type="button" class="btn" data-close>Vazgeç</button><button type="submit" class="btn primary"${allowed ? '' : ' disabled'}>${allowed ? 'Mesaj isteği gönder' : 'Mesaj gönderilemiyor'}</button></div>
  </form>`, (root, close) => {
    $('[data-close]', root).onclick = close;
    $('[data-dm-add-friend]', root)?.addEventListener('click', async event => {
      event.currentTarget.disabled = true;
      try { await api('/friends/request', 'POST', { username: profile.username }); await loadFriends(); close(); toast('Arkadaşlık isteği gönderildi.'); }
      catch (er) { toast(er.message, 1); event.currentTarget.disabled = false; }
    });
    $('form', root).onsubmit = async event => {
      event.preventDefault();
      const button = $('button[type=submit]', root);
      button.disabled = true;
      try {
        const result = await api(`/messages/${profile.id}`, 'POST', { body: $('[name=body]', root).value });
        close();
        if (result.request) toast('Mesaj isteği gönderildi.');
        else { await loadFriends(); if (guildMode) await boot(false); openChat(profile.id); }
      } catch (er) { toast(er.message, 1); button.disabled = false; }
    };
  });
  if (allowed) $('textarea[name=body]', modal).focus();
}
function chatView(m, back) {
  m.innerHTML = `<div class="main-h" id="ch">${back}<div class="chat-head"></div><div class="chat-actions"><button class="icon dm-call-button" data-chat-call title="Sesli ara" aria-label="Sesli ara">${DM_CALL_ICONS.accept}</button><button class="icon" data-chat-profile title="Profili gör" aria-label="Profili gör">${uiIcon('info')}</button><button class="icon" data-chat-more title="Diğer seçenekler" aria-label="Diğer seçenekler">${uiIcon('more')}</button></div></div><div class="msgs" id="msgs"></div><div class="dm-reply-preview" hidden></div><form class="comp"><label class="icon att" title="Fotoğraf / video ekle" aria-label="Fotoğraf veya video ekle">${uiIcon('attach')}<input type="file" accept="image/png,image/jpeg,image/gif,image/webp,video/mp4,video/webm" multiple hidden></label><textarea rows="1" maxlength="2000" placeholder="@ ile arkadaşına mesaj yaz…"></textarea><button class="btn primary">Gönder</button></form><div class="drop">Dosyaları bırak<small>Görseller 25 MB · Videolar 50 MB · En fazla 5 yükleme aynı anda</small></div>`;
  chatHeader();
  const f = $('.comp', m), ta = $('textarea', f), box = $('#msgs', m), dz = $('.drop', m); let dc = 0;
  const replyPreview = $('.dm-reply-preview', m); let replyToMessage = null;
  const clearReply = () => { replyToMessage = null; replyPreview.hidden = true; replyPreview.replaceChildren(); ta.maxLength = 2000; };
  const setReply = message => {
    replyToMessage = message;
    const author = message.sender === me.id ? me.displayName : (friend(message.sender)?.displayName || 'Kullanıcı');
    const excerpt = message.kind === 'text' ? message.body : message.kind === 'image' ? 'Fotoğraf' : message.kind === 'video' ? 'Video' : 'Mesaj';
    const prefix = `↪ ${author}: ${excerpt.slice(0, 180)}\n`;
    replyPreview.innerHTML = `<span><b>${esc(author)} kişisine yanıt</b><small>${esc(excerpt.slice(0, 180))}</small></span><button type="button" data-dm-reply-clear aria-label="Yanıtı kaldır">×</button>`;
    replyPreview.hidden = false; replyPreview.dataset.prefix = prefix; ta.maxLength = Math.max(1, 2000 - prefix.length);
    if (ta.value.length > ta.maxLength) ta.value = ta.value.slice(0, ta.maxLength);
    ta.focus();
  };
  replyPreview.onclick = event => { if (event.target.closest('[data-dm-reply-clear]')) clearReply(); };
  m.ondragenter = e => { e.preventDefault(); if (view === 'chat') { dc++; dz.classList.add('on'); } };
  m.ondragover = e => e.preventDefault();
  m.ondragleave = () => { if (--dc <= 0) { dc = 0; dz.classList.remove('on'); } };
  m.ondrop = e => { e.preventDefault(); dc = 0; dz.classList.remove('on'); queueDmFiles([...e.dataTransfer.files]); };
  $('.att input', m).onchange = e => { queueDmFiles([...e.target.files]); e.target.value = ''; };
  ta.onpaste = e => { const files = [...e.clipboardData.files]; if (files.length) { e.preventDefault(); queueDmFiles(files); } };
  box.onclick = e => {
    const deleteButton = e.target.closest('[data-delete-dm-message]');
    if (deleteButton) { e.preventDefault(); e.stopPropagation(); deleteDmMessage(+deleteButton.closest('.msg').dataset.id, deleteButton); return; }
    const editButton = e.target.closest('.ed-btn'); if (editButton) startEdit(editButton.closest('.msg'));
  };
  box.oncontextmenu = event => {
    const message = event.target.closest('.msg');
    if (!message || !store.has(+message.dataset.id)) return;
    event.preventDefault(); event.stopPropagation(); dmMessageContextMenu(event.clientX, event.clientY, +message.dataset.id, { onReply: setReply });
  };
  box.ondblclick = event => {
    const message = event.target.closest('.msg');
    if (!message || !store.has(+message.dataset.id)) return;
    event.preventDefault(); event.stopPropagation(); dmMessageContextMenu(event.clientX, event.clientY, +message.dataset.id, { onReply: setReply });
  };
  ta.oninput = () => { ta.style.height = 'auto'; ta.style.height = ta.scrollHeight + 'px'; };
  ta.onkeydown = e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); f.requestSubmit(); } };
  f.onsubmit = async e => {
    e.preventDefault(); const body = ta.value.trim(); if (!body) return;
    ta.value = ''; ta.style.height = 'auto';
    const outgoing = replyToMessage ? `${replyPreview.dataset.prefix || ''}${body}` : body;
    try { addMsg(await api('/messages/' + active, 'POST', { body: outgoing })); clearReply(); } catch (er) { toast(er.message, 1); ta.value = body; }
  };
  if (friend(active)?.bot) f.outerHTML = '<div class="notice">Bu resmi bir hesaptır; mesaj gönderilemez.</div>';
  else {
    ta.focus();
    syncDmComposer(active).catch(er => toast(er.message, 1));
  }
}
async function syncDmComposer(targetId) {
  const profile = await api('/users/' + targetId);
  if (view !== 'chat' || active !== targetId) return;
  const form = $('.comp');
  if (!profile.canContinueConversation && form) {
    const reason = profile.blocked
      ? 'Bu kullanıcı engellendi; sohbet geçmişi duruyor ancak mesaj gönderemezsin.'
      : profile.messagePolicy === 'nobody'
        ? 'Bu kullanıcı mesaj almayı kapatmış; sohbet geçmişi duruyor ancak mesaj gönderemezsin.'
        : 'Arkadaş olmadığınız için mesaj gönderemezsin. Sohbet geçmişi saklandı.';
    form.outerHTML = `<div class="notice dm-locked-notice">${esc(reason)}</div>`;
  } else if (profile.canContinueConversation && $('.dm-locked-notice') && !friend(targetId)?.bot) {
    renderMain();
  }
}
function chatHeader() {
  const f = friend(active), h = $('#ch'); if (!f || !h) return;
  $('.chat-head', h).innerHTML = `<div class="chat-head-identity"><button class="pk" title="Profili gör"><span class="ava">${av(f)}${f.online ? `<i class="dot ${f.presence || 'online'}"></i>` : ''}</span><div class="t"><b>${esc(dmDisplayName(f))}</b><br><small>${PRESENCE_LABELS[f.presence] || (f.online ? 'Çevrimiçi' : 'Çevrimdışı')} · @${esc(f.username)}</small></div></button>${tagPreview(f)}</div>`;
  const pk = $('.pk', h); pk.onclick = () => profileModal(f.id); pk.oncontextmenu = e => { e.preventDefault(); ctxMenu(e.clientX, e.clientY, f); };
  $('[data-chat-profile]', h).onclick = () => profileModal(f.id);
  $('[data-chat-more]', h).onclick = e => { const r = e.currentTarget.getBoundingClientRect(); ctxMenu(r.left, r.bottom, f); };
  const call = $('[data-chat-call]', h);
  if (call) {
    call.disabled = !!f.bot || !!voiceSession && !(voiceSession.kind === 'dm' && Number(voiceSession.peerId) === Number(f.id));
    call.title = f.bot ? 'Resmi bot hesabı aranamaz' : voiceSession?.kind === 'dm' && Number(voiceSession.peerId) === Number(f.id) ? 'Aramaya dön' : 'Sesli ara';
    call.onclick = () => voiceSession?.kind === 'dm' && Number(voiceSession.peerId) === Number(f.id)
      ? showDmCallScreen()
      : startDmCall(f).catch(er => toast(er.message, 1));
  }
}

function renderDmProfile() {
  const panel = $('#dm-profile');
  if (!panel) return;
  const userId = view === 'chat' && active ? Number(active) : 0;
  const cached = userId ? friend(userId) : null;
  if (!userId || !cached) {
    panel.hidden = true;
    panel.dataset.userId = '';
    return;
  }
  panel.hidden = false;
  if (panel.dataset.userId === String(userId)) return;
  panel.dataset.userId = String(userId);

  const paint = user => {
    if (!panel.isConnected || panel.dataset.userId !== String(userId) || view !== 'chat' || Number(active) !== userId) return;
    const presence = PRESENCE_LABELS[user.presence] || (user.online ? 'Çevrimiçi' : 'Çevrimdışı');
    const presenceClass = ['online', 'idle', 'dnd', 'offline', 'invisible'].includes(user.presence) ? user.presence : (user.online ? 'online' : 'offline');
  const joined = user.createdAt ? new Date(user.createdAt).toLocaleDateString(localeValue(), { day: 'numeric', month: 'long', year: 'numeric' }) : '—';
    const mutualFriends = Array.isArray(user.mutualFriends) ? user.mutualFriends.length : 0;
    const mutualServers = Array.isArray(user.mutualServers) ? user.mutualServers.length : 0;
    panel.innerHTML = `<div class="dm-profile-cover banner"></div><div class="dm-profile-card"><div class="dm-profile-avatar-wrap">${av(user)}</div><div class="dm-profile-heading"><h2>${esc(dmDisplayName(user) || 'Aven kullanıcısı')}</h2><div class="dm-profile-server-tag">${profileTag(user)}</div></div><span class="dm-profile-handle">@${esc(user.username || '')}</span>${badgeRow(user)}<span class="dm-profile-presence"><i class="dot ${presenceClass}"></i>${esc(presence)}</span></div><section class="dm-profile-about"><small>HAKKINDA</small><p>${user.bio ? esc(user.bio) : '<i>Henüz bir şey yazılmamış.</i>'}</p></section><div class="dm-profile-stats"><div><b>${Number(user.friendCount) || 0}</b><small>Arkadaş</small></div>${user.bot ? '' : `<div><b>${mutualFriends}</b><small>Ortak arkadaş</small></div>`}</div><div class="dm-profile-joined"><small>AVEN’E KATILDI</small><b>${joined}</b>${user.bot ? '' : `<small>${mutualServers} ortak sunucu</small>`}</div>${privateNoteCard(user.note)}<div class="dm-profile-actions"><button type="button" class="btn" data-dm-profile-open>Profilin tamamını görüntüle</button></div>`;
    setBanner(panel, user);
    $('[data-dm-profile-open]', panel).onclick = () => profileModal(userId);
  };

  paint(cached);
  api(`/users/${userId}`).then(user => paint({ ...cached, ...user })).catch(() => {});
}

async function openChat(id, keep, restoreScrollTop = null) {
  if (!keep || active !== id) { active = id; view = 'chat'; unread[id] = 0; writeAppRoute({ kind: 'dm', publicId: friend(id)?.publicId }); renderSide(); renderMain(); return; }
  const previousScrollTop = arguments.length >= 3 ? restoreScrollTop : $('#msgs')?.scrollTop ?? null;
  unread[id] = 0; renderSide();
  try {
    const list = await api('/messages/' + id); if (active !== id) return;
    const box = $('#msgs'); if (!box) return;
    const animateIntro = animateBotWelcomeFor === id;
    if (animateIntro) animateBotWelcomeFor = 0;
    seen = new Set(list.map(x => x.id)); prevM = null; box.replaceChildren();
    if (!list.length) { const f = friend(id); box.innerHTML = `<div class="start">${av(f, 'xl')}<h3>${esc(f.displayName)}</h3><p>@${esc(f.username)} ile sohbetin başlangıcı. İlk mesajı yaz ya da bir fotoğraf/video sürükleyip bırak.</p></div>`; }
    list.forEach(m => put(box, m, animateIntro));
    box.scrollTop = Number.isFinite(previousScrollTop)
      ? Math.min(previousScrollTop, Math.max(0, box.scrollHeight - box.clientHeight))
      : box.scrollHeight;
  } catch (er) { toast(er.message, 1); }
}

let prevM = null;
const dayLabel = t => { const d = new Date(t), n = new Date().setHours(0, 0, 0, 0), k = Math.round((n - new Date(t).setHours(0, 0, 0, 0)) / 864e5); return k === 0 ? translateText('Bugün') : k === 1 ? translateText('Dün') : d.toLocaleDateString(localeValue(), { day: 'numeric', month: 'long', year: 'numeric' }); };
const sameDay = (x, y) => new Date(x).toDateString() === new Date(y).toDateString();
function msgEl(m, animateBot = false) {
  const mine = m.sender === me.id, u = mine ? me : friend(m.sender) || { displayName: '?' }, d = document.createElement('div');
  const cont = m.kind !== 'call-event' && prevM && prevM.kind !== 'call-event' && prevM.sender === m.sender && m.createdAt - prevM.createdAt < 3e5 && sameDay(prevM.createdAt, m.createdAt);
  prevM = m; store.set(m.id, m); d.dataset.id = m.id; d.className = 'msg' + (mine ? ' mine' : '') + (cont ? ' cont' : '') + (u.bot ? ' bot' + (animateBot ? ' onboarding' : '') : '');
  if (m.kind === 'call-event') {
    let event = {}; try { event = JSON.parse(m.body); } catch {}
    const ended = event.type === 'ended', seconds = Math.floor(Math.max(0, Number(event.durationMs) || 0) / 1000);
    const duration = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
    d.className = 'msg call-event-message';
    d.innerHTML = `<div class="call-event-card"><span class="call-event-icon">${ended ? DM_CALL_ICONS.hangup : DM_CALL_ICONS.accept}</span><span class="call-event-copy"><b>${ended ? 'Sesli arama sona erdi' : 'Sesli arama başladı'}</b><small>${ended ? `Görüşme süresi · ${duration}` : `${esc(u.displayName)} ile görüşme başladı`}</small></span><time>${fmt(m.createdAt)}</time></div>`;
    return d;
  }
  d.innerHTML = `${av(u)}<div class="mb"><div class="mh"><b><span class="message-author-name">${esc(u.displayName)}</span>${tagPreview(u)}</b><time>${fmt(m.createdAt)}</time>${mine && m.kind === 'text' ? `<button class="ed-btn" title="Düzenle" aria-label="Düzenle">${uiIcon('edit')}</button>` : ''}${mine ? `<button class="dm-delete-btn" data-delete-dm-message title="Mesajı herkesten sil" aria-label="Mesajı herkesten sil">${uiIcon('trash')}</button>` : ''}</div><div class="mt"></div></div>`;
  fill(d, m); return d;
}
function put(box, m, animateBot = false) {
  box.querySelector('.start')?.remove();
  if (!prevM || !sameDay(prevM.createdAt, m.createdAt)) box.insertAdjacentHTML('beforeend', `<div class="day"><span>${dayLabel(m.createdAt)}</span></div>`);
  box.append(msgEl(m, animateBot));
}
const VIDEO_PLAYER_ICONS = {
  play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.8c0-.8.9-1.3 1.6-.9l9 6.2a1.1 1.1 0 0 1 0 1.8l-9 6.2a1.1 1.1 0 0 1-1.6-.9z" fill="currentColor"/></svg>',
  pause: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h3.7v14H7zM13.3 5H17v14h-3.7z" fill="currentColor"/></svg>',
  expand: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 4H4v4M16 4h4v4M4 16v4h4m12-4v4h-4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  file: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 2.8h8l5 5V21a1.2 1.2 0 0 1-1.2 1.2H6A1.2 1.2 0 0 1 4.8 21V4A1.2 1.2 0 0 1 6 2.8Z" fill="currentColor" opacity=".18"/><path d="M14 2.8v5h5M8 13h8M8 16.5h8" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>'
};
function createVideoPlayer(src) {
  const root = document.createElement('div'); root.className = 'aven-player'; root.tabIndex = 0; root.setAttribute('role', 'group'); root.setAttribute('aria-label', 'Video oynatıcı');
  const stage = document.createElement('div'); stage.className = 'aven-player-stage';
  const video = document.createElement('video'); video.className = 'media'; video.src = src; video.preload = 'metadata'; video.playsInline = true;
  const centerPlay = document.createElement('button'); centerPlay.type = 'button'; centerPlay.className = 'aven-player-center'; centerPlay.setAttribute('aria-label', 'Oynat'); centerPlay.innerHTML = VIDEO_PLAYER_ICONS.play;
  const controls = document.createElement('div'); controls.className = 'aven-player-controls';
  const play = document.createElement('button'); play.type = 'button'; play.className = 'aven-player-play'; play.setAttribute('aria-label', 'Oynat');
  const seek = document.createElement('input'); seek.type = 'range'; seek.className = 'aven-player-seek'; seek.min = '0'; seek.max = '1000'; seek.value = '0'; seek.setAttribute('aria-label', 'Video konumu');
  const time = document.createElement('span'); time.className = 'aven-player-time'; time.textContent = '00:00 / 00:00';
  const volume = document.createElement('input'); volume.type = 'range'; volume.className = 'aven-player-volume'; volume.min = '0'; volume.max = '1'; volume.step = '.05'; volume.value = '1'; volume.setAttribute('aria-label', 'Ses seviyesi');
  const expand = document.createElement('button'); expand.type = 'button'; expand.className = 'aven-player-expand'; expand.title = 'Tam ekran oynatıcıyı aç'; expand.setAttribute('aria-label', 'Tam ekran oynatıcıyı aç'); expand.innerHTML = VIDEO_PLAYER_ICONS.expand;
  const format = value => { if (!Number.isFinite(value)) return '00:00'; const min = Math.floor(value / 60).toString().padStart(2, '0'); const sec = Math.floor(value % 60).toString().padStart(2, '0'); return `${min}:${sec}`; };
  const toggle = () => video.paused ? video.play().catch(() => {}) : video.pause();
  const sync = () => {
    seek.value = video.duration ? String(Math.round(video.currentTime / video.duration * 1000)) : '0';
    time.textContent = `${format(video.currentTime)} / ${format(video.duration)}`;
    play.innerHTML = video.paused ? VIDEO_PLAYER_ICONS.play : VIDEO_PLAYER_ICONS.pause; play.setAttribute('aria-label', video.paused ? 'Oynat' : 'Duraklat'); centerPlay.innerHTML = video.paused ? VIDEO_PLAYER_ICONS.play : VIDEO_PLAYER_ICONS.pause; centerPlay.setAttribute('aria-label', video.paused ? 'Oynat' : 'Duraklat');
    root.classList.toggle('is-playing', !video.paused);
  };
  root.addEventListener('pointerdown', () => { activeVideoPlayer = { root, video }; }, { passive: true });
  root.addEventListener('focusin', () => { activeVideoPlayer = { root, video }; });
  root.addEventListener('click', () => { activeVideoPlayer = { root, video }; if (!root.contains(document.activeElement)) root.focus({ preventScroll: true }); });
  play.onclick = toggle; centerPlay.onclick = toggle; video.onclick = toggle; controls.onclick = event => event.stopPropagation();
  video.onplay = sync; video.onpause = sync; video.ontimeupdate = sync; video.onloadedmetadata = sync; video.onended = sync;
  seek.oninput = () => { if (video.duration) video.currentTime = video.duration * Number(seek.value) / 1000; };
  seek.onchange = sync;
  volume.oninput = () => { video.volume = Number(volume.value); video.muted = video.volume === 0; };
  expand.onclick = event => { event.stopPropagation(); openVideoTheater(src, video.currentTime, { root, video }); };
  stage.append(video, centerPlay, controls); controls.append(play, time, seek, volume, expand); root.append(stage); sync();
  return { root, video };
}
function openVideoTheater(src, startAt = 0, previousPlayer = null) {
  const previousWasPlaying = !!previousPlayer && !previousPlayer.video.paused;
  previousPlayer?.video.pause();
  const modal = document.createElement('div'); modal.className = 'modal aven-video-modal fade';
  modal.innerHTML = '<section class="aven-video-shell" role="dialog" aria-label="Video"><button type="button" class="aven-video-close" aria-label="Kapat"><span aria-hidden="true">×</span><kbd>ESC</kbd></button><div class="aven-video-slot"></div></section>';
  const player = createVideoPlayer(src); player.root.classList.add('theater-size'); $('.aven-video-slot', modal).append(player.root);
  const close = () => {
    if (!modal.isConnected) return;
    player.video.pause(); modal.remove(); activeVideoModal = null;
    if (previousPlayer?.root?.isConnected) {
      previousPlayer.video.currentTime = player.video.currentTime;
      activeVideoPlayer = previousPlayer; previousPlayer.root.focus({ preventScroll: true });
      if (previousWasPlaying) previousPlayer.video.play().catch(() => {});
    } else activeVideoPlayer = null;
  };
  modal._avenClose = close; modal.onclick = event => { if (event.target === modal || event.target.closest('.aven-video-close')) close(); };
  document.body.append(modal); activeVideoModal = modal; activeVideoPlayer = player;
  const seekAndResume = () => {
    if (Number.isFinite(startAt) && startAt > 0) player.video.currentTime = Math.min(startAt, player.video.duration || startAt);
    if (previousWasPlaying) player.video.play().catch(() => {});
  };
  if (player.video.readyState >= 1) seekAndResume(); else player.video.addEventListener('loadedmetadata', seekAndResume, { once: true });
  player.root.focus({ preventScroll: true });
}
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && activeVideoModal) { event.preventDefault(); activeVideoModal._avenClose?.(); return; }
  const typing = event.target.closest?.('textarea,input:not([type=range]),[contenteditable="true"]');
  if (event.code === 'Space' && !typing && activeVideoPlayer?.root?.isConnected && (activeVideoModal || activeVideoPlayer.root.contains(document.activeElement))) {
    event.preventDefault(); activeVideoPlayer.video.paused ? activeVideoPlayer.video.play().catch(() => {}) : activeVideoPlayer.video.pause();
  }
}, true);
function fill(d, m) {
  const t = $('.mt', d); t.replaceChildren(); t.classList.toggle('has-media', m.kind === 'image' || m.kind === 'video');
  if (m.kind === 'tour') { t.classList.add('tour'); t.innerHTML = TOUR; return; }
  if (m.kind === 'warning') { try { t.classList.add('warn-msg'); t.innerHTML = warnCard(JSON.parse(m.file)); } catch { t.textContent = m.body; } return; }
  if (m.kind === 'badge') {
    t.classList.add('badge-system-msg');
    let badge = null; try { badge = JSON.parse(m.file); } catch {}
    if (!badge || typeof badge !== 'object') { t.textContent = m.body; return; }
    const granted = badge.action === 'granted', card = document.createElement('section');
    card.className = `badge-system-card ${granted ? 'granted' : 'removed'}`;
    const emblem = document.createElement('span'); emblem.className = 'badge-system-emblem';
    const image = document.createElement('img'); image.src = typeof badge.image === 'string' ? badge.image : `/rozetler/${encodeURIComponent(badge.file || '')}`; image.alt = '';
    image.onerror = () => { emblem.textContent = '✦'; image.remove(); };
    emblem.append(image);
    const copy = document.createElement('span'); copy.className = 'badge-system-copy';
    const label = document.createElement('small'); label.textContent = translateText('AVEN ROZET BİLDİRİMİ');
    const title = document.createElement('b'); title.textContent = translateText(granted ? 'Yeni bir rozet kazandın' : 'Rozet profilinden kaldırıldı');
    const detail = document.createElement('span'); detail.textContent = translateText(granted
      ? `${badge.name || 'Rozet'} rozetin hesabına eklendi ve profilinde görünmeye başladı.`
      : `${badge.name || 'Rozet'} rozeti hesabından kaldırıldı.`);
    copy.append(label, title, detail); card.append(emblem, copy); t.append(card); return;
  }
  if (m.kind === 'unavailable') { t.classList.add('has-media'); renderDmAttachment(t, m); return; }
  if (m.kind === 'image' || m.kind === 'video') {
    t.classList.add('has-media'); renderDmAttachment(t, m); return;
  }
  if (m.kind !== 'text') {
    const stick = () => { const b = $('#msgs'); if (b && b.scrollHeight - b.scrollTop - b.clientHeight < 700) b.scrollTop = b.scrollHeight; };
    if (m.kind === 'video') {
      const player = createVideoPlayer('/api/files/' + m.file);
      player.video.addEventListener('loadedmetadata', stick, { once: true });
      t.append(player.root);
    } else {
      const el = document.createElement('img'); el.className = 'media'; el.src = '/api/files/' + m.file; el.onload = stick; el.onclick = () => lightbox(el.src); t.append(el);
    }
    return;
  }
  t.append(document.createTextNode(m.body));
  const inviteCode = m.body.match(/(?:https?:\/\/[^\s/]+)?\/([A-Za-z0-9_-]{12})(?=$|[?#\s])/i)?.[1]
    || m.body.match(/[?&]invite=([A-Za-z0-9_-]{12})(?=$|[&#\s])/i)?.[1]
    || m.body.trim().match(/^([A-Za-z0-9_-]{12})$/)?.[1];
  if (inviteCode) renderInvitePreview(t, inviteCode);
  if (m.edited) { const s = document.createElement('span'); s.className = 'ed'; s.textContent = 'düzenlendi'; t.append(s); }
}
async function renderInvitePreview(container, code) {
  const card = document.createElement('section');
  card.className = 'dm-invite-preview';
  card.innerHTML = '<div class="dm-invite-loading">Sunucu daveti yükleniyor…</div>';
  container.append(card);
  try {
    const invite = await api(`/invites/${encodeURIComponent(code)}`);
    if (!card.isConnected) return;
    const cover = invite.banner ? ` style="background-image:linear-gradient(180deg,#070a1280,#070a12aa),url('${esc(invite.banner)}')"` : '';
    const icon = invite.icon ? `<img src="${esc(invite.icon)}" alt="">` : esc([...invite.name][0]?.toUpperCase() || '?');
    card.innerHTML = `<div class="dm-invite-cover"${cover}></div><div class="dm-invite-content">
      <div class="dm-invite-avatar">${icon}</div>
      <div class="dm-invite-details">
        <div class="dm-invite-eyebrow"><span>SUNUCU DAVETİ</span><i>7 gün geçerli</i></div>
        <div class="dm-invite-name-row"><h3>${esc(invite.name)}</h3>${invite.verified ? verifiedServerBadge('verified-server-badge-invite') : ''}${invite.serverTag ? `<span class="guild-tag-chip"><i>${serverTagBadgeIcon(invite.serverTag.badge)}</i><b>${esc(invite.serverTag.tag)}</b></span>` : ''}</div>
        <p class="dm-invite-stats"><span>● ${invite.onlineCount.toLocaleString(localeValue())} çevrim içi</span><i></i>${invite.memberCount.toLocaleString(localeValue())} üye</p>
        <p class="dm-invite-owner">Oluşturulma: ${new Date(invite.createdAt).toLocaleDateString(localeValue(), { month: 'short', year: 'numeric' })}</p>
      </div>
      <button type="button" class="dm-invite-join"${invite.isMember ? ' data-open-server' : ''} data-server-id="${invite.serverId || ''}" data-invite-code="${esc(code)}">${invite.isMember ? 'Sunucuya git' : 'Sunucuya katıl'}</button>
    </div>`;
    const button = $('.dm-invite-join', card);
    button.dataset.serverId = invite.serverId;
    button.onclick = async () => {
      button.disabled = true;
      try {
        const server = invite.isMember
          ? { id: invite.serverId }
          : await api(`/invites/${encodeURIComponent(code)}/join`, 'POST');
        if (guildMode) await enterGuilds(server.id);
        else { await enterGuilds(server.id); }
      } catch (er) { toast(er.message, 1); button.disabled = false; }
    };
  } catch (er) {
    if (card.isConnected) card.innerHTML = `<p class="dm-invite-invalid">${esc(er.message)}</p>`;
  }
}
function startEdit(d) {
  const id = +d.dataset.id, t = $('.mt', d), old = store.get(id).body, ta = document.createElement('textarea'); let fin = false;
  if ($('textarea', t)) return;
  ta.className = 'edit'; ta.value = old; ta.maxLength = 2000; ta.rows = Math.min(8, old.split('\n').length); t.replaceChildren(ta); ta.focus(); ta.setSelectionRange(old.length, old.length);
  const done = async save => {
    if (fin) return; fin = true; const v = ta.value.trim();
    if (save && v && v !== old) { try { editMsg(await api('/messages/' + id, 'PUT', { body: v })); return; } catch (er) { toast(er.message, 1); } }
    fill(d, store.get(id));
  };
  ta.onkeydown = e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); done(true); } else if (e.key === 'Escape') done(false); };
  ta.onblur = () => done(false);
}
function editMsg(m) {
  store.set(m.id, m); const d = $(`.msg[data-id="${m.id}"]`); if (d) { fill(d, m); d.classList.remove('flash'); void d.offsetWidth; d.classList.add('flash'); }
  const f = friend(m.sender === me.id ? m.receiver : m.sender); if (f?.last && f.last.createdAt === m.createdAt) { f.last.body = m.body; renderSide(); }
}
function lightbox(src) {
  const m = document.createElement('div'); m.className = 'modal lb fade'; m.innerHTML = '<img alt="">'; $('img', m).src = src; m.onclick = () => m.remove(); document.body.append(m);
}
function dmMessageContextMenu(x, y, messageId, { onReply } = {}) {
  const message = store.get(Number(messageId));
  if (!message || !['text', 'image', 'video', 'unavailable'].includes(message.kind)) return;
  $('.ctx')?.remove();
  const menu = document.createElement('div'); menu.className = 'ctx pop dm-message-context-menu';
  const mine = Number(message.sender) === Number(me.id);
  const icon = (path, fill = 'none') => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${path}" fill="${fill}"/></svg>`;
  const action = (name, label, svg, danger = false) => `<button type="button" class="${danger ? 'danger' : ''}" data-dm-message-action="${name}">${svg}<span>${esc(translateText(label))}</span></button>`;
  menu.innerHTML = `${mine && message.kind === 'text' ? action('edit', 'Mesajı Düzenle', uiIcon('edit')) : ''}${action('reply', 'Yanıtla', icon('M9 14 4 9l5-5M4 9h9a6 6 0 0 1 6 6v1'))}${message.kind === 'text' ? `${action('forward', 'İlet', icon('m15 14 5-5-5-5M20 9h-9a6 6 0 0 0-6 6v1'))}${action('copy', 'Metni Kopyala', icon('M8 7h10a2 2 0 0 1 2 2v10H9a2 2 0 0 1-2-2V7ZM5 17H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v1'))}` : ''}${mine ? `<span class="ctx-divider" role="separator"></span>${action('delete', 'Mesajı herkesten sil', icon('M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7m4 3v6m4-6v6'), true)}` : ''}`;
  document.body.append(menu);
  menu.style.left = `${Math.max(8, Math.min(x, innerWidth - menu.offsetWidth - 8))}px`;
  menu.style.top = `${Math.max(8, Math.min(y, innerHeight - menu.offsetHeight - 8))}px`;
  const close = () => { menu.remove(); document.removeEventListener('click', outside); document.removeEventListener('keydown', key); };
  const outside = event => { if (!menu.contains(event.target)) close(); };
  const key = event => { if (event.key === 'Escape') close(); };
  setTimeout(() => { document.addEventListener('click', outside); document.addEventListener('keydown', key); });
  menu.onclick = async event => {
    const action = event.target.closest('[data-dm-message-action]')?.dataset.dmMessageAction;
    if (!action) return;
    close();
    if (action === 'edit' && mine && message.kind === 'text') { const node = $(`.msg[data-id="${message.id}"]`); if (node) startEdit(node); }
    else if (action === 'delete' && mine) deleteDmMessage(message.id);
    else if (action === 'reply') onReply?.(message);
    else if (action === 'copy' && message.kind === 'text') {
      try {
        if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(message.body);
        else {
          const input = document.createElement('textarea'); input.value = message.body; input.style.cssText = 'position:fixed;opacity:0'; document.body.append(input); input.select();
          const copied = document.execCommand('copy'); input.remove(); if (!copied) throw new Error('Clipboard unavailable');
        }
        toast('Mesaj metni kopyalandı.');
      }
      catch { toast('Metin panoya kopyalanamadı.', 1); }
    } else if (action === 'forward' && message.kind === 'text') forwardDmMessage(message);
  };
}
function forwardDmMessage(message) {
  const recipients = [...new Map([...fr.friends, ...fr.conversations].filter(user => user.id !== active && !user.bot && !user.blocked && user.canMessage !== false).map(user => [user.id, user])).values()];
  const { modal, close } = guildModal(`<h3>${esc(translateText('Mesajı ilet'))}</h3><p>${esc(translateText('Mesajı göndermek istediğin DM sohbetini seç.'))}</p><div class="dm-forward-list">${recipients.map(user => `<button type="button" data-dm-forward-to="${user.id}">${av(user)}<span><b>${esc(dmDisplayName(user))}</b><small>@${esc(user.username)}</small></span><i>›</i></button>`).join('') || `<div class="empty">${esc(translateText('İletilecek uygun bir sohbet bulunamadı.'))}</div>`}</div><div class="guild-form-actions"><button type="button" class="btn" data-dm-forward-cancel>${esc(translateText('Vazgeç'))}</button></div>`, (root, close) => {
    root.querySelector('[data-dm-forward-cancel]').onclick = close;
    root.querySelectorAll('[data-dm-forward-to]').forEach(button => button.onclick = async () => {
      button.disabled = true;
      try {
        const recipientId = Number(button.dataset.dmForwardTo), prefix = '↪ İletildi:\n', forwarded = prefix + message.body.slice(0, 2000 - prefix.length);
        const result = await api(`/messages/${recipientId}`, 'POST', { body: forwarded });
        close();
        if (result.request) toast('İletilen mesaj için mesaj isteği gönderildi.');
        else toast('Mesaj iletildi.');
      } catch (error) { toast(error.message, 1); button.disabled = false; }
    });
  });
}
async function deleteDmMessage(messageId, button = null) {
  const message = store.get(Number(messageId));
  if (!message || message.sender !== me.id) return;
  if (!confirm('Bu mesaj sohbetten ve ekli dosyasından herkesten silinsin mi?')) return;
  if (button) button.disabled = true;
  try {
    await api(`/messages/${message.id}`, 'DELETE');
    removeDmMessage(message.id);
    toast('Mesaj silindi.');
  } catch (er) { toast(er.message, 1); if (button?.isConnected) button.disabled = false; }
}
const transferKey = (userId, id) => `${Number(userId)}:${id}`;
async function dmAttachmentSignal(target, message, signal) {
  return api(`/dm/${target}/attachment-signal`, 'POST', { transferId: message.file, messageId: message.id, signal });
}
function closeDmTransfer(key) {
  const session = dmTransfers.get(key); if (!session) return;
  session.pc?.close(); dmTransfers.delete(key);
}
async function startAttachmentTransfer(target, message, record) {
  const contact = friend(target);
  if (!record?.key || !record?.iv || ![message.sender, message.receiver].includes(me.id) || ![message.sender, message.receiver].includes(target) || target === me.id || !contact || !contact.online || contact.blocked) return;
  const key = transferKey(target, message.file), existing = dmTransfers.get(key);
  if (existing && existing.pc.connectionState !== 'failed' && existing.pc.connectionState !== 'closed') return;
  if (existing) closeDmTransfer(key);
  await loadVoiceIceConfig();
  const pc = new RTCPeerConnection({ iceServers: voiceIceServers }), channel = pc.createDataChannel('aven-attachment');
  const session = { pc, message, target, channel, candidates: [] }; dmTransfers.set(key, session);
  pc.onicecandidate = event => { if (event.candidate) dmAttachmentSignal(target, message, { type: 'candidate', candidate: event.candidate.toJSON() }).catch(() => {}); };
  pc.onconnectionstatechange = () => { if (['failed', 'closed'].includes(pc.connectionState)) closeDmTransfer(key); };
  channel.onopen = () => {
    try {
      channel.send(JSON.stringify({ type: 'key', id: message.file, kind: message.kind, mime: record.mime, name: record.name, size: record.size, key: mediaToBase64(record.key), iv: mediaToBase64(record.iv) }));
      setTimeout(() => closeDmTransfer(key), 2500);
    } catch (er) { toast(er.message, 1); closeDmTransfer(key); }
  };
  const offer = await pc.createOffer(); await pc.setLocalDescription(offer);
  try { await dmAttachmentSignal(target, message, { type: 'description', description: { type: pc.localDescription.type, sdp: pc.localDescription.sdp } }); }
  catch (er) { closeDmTransfer(key); throw er; }
}
async function handleDmSignal({ fromId, transferId, messageId, signal }) {
  fromId = Number(fromId);
  const key = transferKey(fromId, transferId);
  let session = dmTransfers.get(key);
  let message = store.get(Number(messageId));
  if (!message) {
    const history = await api(`/messages/${fromId}`);
    message = history.find(item => item.id === Number(messageId));
    if (message) store.set(message.id, message);
  }
  if (!message || message.file !== transferId || ![message.sender, message.receiver].includes(me.id)) return;
  if (signal.type === 'request') {
    const record = await dmMediaGet(transferId);
    if (record) await startAttachmentTransfer(fromId, message, record);
    return;
  }
  if (!session) {
    const pc = new RTCPeerConnection({ iceServers: voiceIceServers });
    session = { pc, message, target: fromId, candidates: [] }; dmTransfers.set(key, session);
    pc.onicecandidate = event => { if (event.candidate) dmAttachmentSignal(fromId, message, { type: 'candidate', candidate: event.candidate.toJSON() }).catch(() => {}); };
    pc.onconnectionstatechange = () => { if (['failed', 'closed'].includes(pc.connectionState)) closeDmTransfer(key); };
    pc.ondatachannel = event => receiveDmAttachment(event.channel, session);
  }
  if (signal.type === 'candidate') {
    if (session.pc.remoteDescription) await session.pc.addIceCandidate(signal.candidate);
    else session.candidates.push(signal.candidate);
    return;
  }
  if (signal.type !== 'description') return;
  await session.pc.setRemoteDescription(signal.description);
  for (const candidate of session.candidates.splice(0)) await session.pc.addIceCandidate(candidate);
  if (signal.description.type === 'offer') {
    const answer = await session.pc.createAnswer(); await session.pc.setLocalDescription(answer);
    await dmAttachmentSignal(fromId, message, { type: 'description', description: { type: session.pc.localDescription.type, sdp: session.pc.localDescription.sdp } });
  }
}
function receiveDmAttachment(channel, session) {
  channel.onmessage = async event => {
    try {
      if (typeof event.data !== 'string') return;
      const packet = JSON.parse(event.data);
      if (packet.type !== 'key' || packet.id !== session.message.file || packet.kind !== session.message.kind || !/^(image\/(png|jpeg|gif|webp)|video\/(mp4|webm))$/.test(packet.mime) || (packet.kind === 'image') !== packet.mime.startsWith('image/') || !Number.isSafeInteger(packet.size) || packet.size < 1 || packet.size > 25 * 1024 * 1024) throw new Error('Medya anahtar bilgisi geçersiz.');
      const rawKey = mediaFromBase64(packet.key), iv = mediaFromBase64(packet.iv);
      if (rawKey.byteLength !== 32 || iv.byteLength !== 12) throw new Error('Medya anahtar boyutu geçersiz.');
      await dmMediaPut({ id: packet.id, owner: me.id, key: rawKey, iv, kind: packet.kind, mime: packet.mime, name: String(packet.name || 'medya').slice(0, 120), size: packet.size, savedAt: Date.now() });
      const history = await api(`/messages/${session.target}`).catch(() => []);
      const latest = history.find(item => item.id === session.message.id);
      if (latest) { session.message = latest; store.set(latest.id, latest); }
      const node = $(`.msg[data-id="${session.message.id}"] .mt`);
      if (node) renderDmAttachment(node, session.message);
      toast('DM medyasının erişim anahtarı güvenli bağlantıyla alındı.');
      closeDmTransfer(transferKey(session.target, session.message.file));
    } catch (er) { toast(er.message, 1); closeDmTransfer(transferKey(session.target, session.message.file)); }
  };
}
function requestDmAttachment(message, quiet = false) {
  const target = message.sender === me.id ? message.receiver : message.sender;
  const contact = friend(target);
  if (!contact || contact.blocked) return quiet ? undefined : toast('Engellenen kişiden eski dosya anahtarı istenemiyor.', 1);
  dmAttachmentSignal(target, message, { type: 'request' }).then(() => { if (!quiet) toast('Dosya sahibinin cihazından aktarım istendi.'); }).catch(er => { if (!quiet) toast(er.message, 1); });
}
function dmBytesLabel(bytes) {
  const value = Number(bytes) || 0;
  if (value < 1024 * 1024) return `${(value / 1024).toLocaleString(localeValue(), { maximumFractionDigits: 1 })} KB`;
  return `${(value / (1024 * 1024)).toLocaleString(localeValue(), { maximumFractionDigits: 2 })} MB`;
}
function setDmUploadProgress(messageId, loaded, total) {
  const ratio = total ? Math.min(100, Math.round(loaded / total * 100)) : 0;
  dmUploadProgress.set(messageId, ratio);
  const state = $(`.msg[data-id="${messageId}"] .dm-upload-status`);
  if (state) {
    $('.dm-upload-label', state).textContent = `${dmBytesLabel(loaded)} / ${dmBytesLabel(total)} · %${ratio}`;
    $('.dm-upload-fill', state).style.width = `${ratio}%`;
    $('.dm-upload-track', state).setAttribute('aria-valuenow', String(ratio));
  }
}
function uploadDmBinary(url, blob, type, onProgress = () => {}, messageId = null) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest(); xhr.open('POST', url); xhr.withCredentials = true;
    if (messageId != null) activeDmRequests.set(messageId, xhr);
    const clear = () => { if (messageId != null && activeDmRequests.get(messageId) === xhr) activeDmRequests.delete(messageId); };
    xhr.setRequestHeader('Content-Type', 'application/octet-stream');
    if (type) xhr.setRequestHeader('X-Aven-Content-Type', type);
    xhr.upload.onprogress = event => { if (event.lengthComputable) onProgress(event.loaded, event.total); };
    xhr.onerror = () => { clear(); reject(new Error('Ağ bağlantısı kesildi; yükleme tamamlanmadı.')); };
    xhr.onabort = () => { clear(); const error = new Error('Yükleme iptal edildi.'); error.cancelled = true; error.messageId = messageId; reject(error); };
    xhr.onload = () => {
      clear();
      let payload = {}; try { payload = JSON.parse(xhr.responseText || '{}'); } catch {}
      if (xhr.status < 200 || xhr.status >= 300) return reject(new Error(payload.error || 'Dosya yüklenemedi.'));
      resolve(payload);
    };
    xhr.send(blob);
  });
}
async function cancelDmUpload(message, button) {
  if (!message || cancelledDmUploads.has(message.id)) return;
  cancelledDmUploads.add(message.id); if (button) button.disabled = true;
  activeDmRequests.get(message.id)?.abort();
  try {
    await api(`/messages/${message.id}/attachment`, 'DELETE');
    pendingDmFiles.delete(message.id); dmUploadProgress.delete(message.id); removeDmMessage(message.id);
    toast('Yükleme iptal edildi.');
  } catch (error) {
    if (button?.isConnected) button.disabled = false;
    toast(error.message, 1);
  }
}
async function decryptLegacyDmMedia(message, media) {
  const response = await fetch(`/api/dm-attachments/${message.id}`, { cache: 'no-store' });
  if (!response.ok) throw new Error('Eski medya sunucudan alınamadı.');
  const serverIv = mediaFromBase64(response.headers.get('X-Aven-IV') || ''), localIv = new Uint8Array(media.iv);
  if (serverIv.length !== 12 || serverIv.some((byte, index) => byte !== localIv[index])) throw new Error('Eski medya anahtarı eşleşmiyor.');
  const raw = new Uint8Array(media.key), key = await crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['decrypt']), encrypted = await response.arrayBuffer();
  let plain;
  try { plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: serverIv, additionalData: new TextEncoder().encode(message.file) }, key, encrypted); }
  catch { plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: serverIv }, key, encrypted); }
  return new Blob([plain], { type: media.mime });
}
async function migrateLegacyDmMedia(message, media) {
  if (decryptingDmMedia.has(`migrate:${message.file}`)) return decryptingDmMedia.get(`migrate:${message.file}`);
  const pending = (async () => {
    const plain = await decryptLegacyDmMedia(message, media);
    if (!['image/png','image/jpeg','image/gif','image/webp','video/mp4','video/webm'].includes(plain.type)) throw new Error('Eski medya türü desteklenmiyor.');
    const migrated = await uploadDmBinary(`/api/messages/${message.id}/attachment-migrate`, plain, plain.type);
    const cached = decryptedDmMedia.get(message.file); if (cached?.url) URL.revokeObjectURL(cached.url);
    decryptedDmMedia.delete(message.file);
    await dmMediaDelete(message.file).catch(() => {});
    updateAttachmentReady(migrated);
    return migrated;
  })();
  decryptingDmMedia.set(`migrate:${message.file}`, pending);
  try { return await pending; } finally { if (decryptingDmMedia.get(`migrate:${message.file}`) === pending) decryptingDmMedia.delete(`migrate:${message.file}`); }
}
async function renderDmAttachment(element, message) {
  const initialState = `${!!message.fileReady}:${!!message.encrypted}:${message.kind}:${message.fileType || ''}`;
  const media = await dmMediaGet(message.file).catch(() => null);
  if (!element.isConnected) return;
  const latest = store.get(message.id), latestState = latest && `${!!latest.fileReady}:${!!latest.encrypted}:${latest.kind}:${latest.fileType || ''}`;
  if (latest && latestState !== initialState) return renderDmAttachment(element, latest);
  element.replaceChildren();
  if (!message.fileReady) {
    element.classList.add('attachment-missing');
    const ratio = dmUploadProgress.get(message.id) || 0;
    if (uploadingDmMedia.has(message.id)) {
      const file = pendingDmFiles.get(message.id), name = file?.name || (message.kind === 'video' ? 'Video' : 'Fotoğraf'), size = file?.size || message.fileSize || 0;
      element.innerHTML = `<div class="dm-upload-status"><span class="dm-upload-icon" aria-hidden="true">${VIDEO_PLAYER_ICONS.file}</span><div class="dm-upload-main"><div class="dm-upload-heading"><span class="dm-upload-name" title="${esc(name)}">${esc(name)}</span><span class="dm-upload-size">${dmBytesLabel(size)}</span></div><div class="dm-upload-label">Yükleme hazırlanıyor · %${ratio}</div><div class="dm-upload-track" role="progressbar" aria-label="Dosya yükleme" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${ratio}"><i class="dm-upload-fill" style="width:${ratio}%"></i></div></div><button type="button" class="dm-upload-cancel" data-attachment-upload-cancel aria-label="Yüklemeyi iptal et" title="Yüklemeyi iptal et">×</button></div>`;
    }
    else if (message.encrypted && message.sender === me.id && media?.ciphertext) element.innerHTML = '<span>Eski ekin yüklemesi tamamlanmadı.</span><button type="button" class="btn sm" data-legacy-upload-retry>Yeniden dene</button>';
    else if (message.sender === me.id && pendingDmFiles.has(message.id)) element.innerHTML = '<span>Yükleme tamamlanmadı.</span><button type="button" class="btn sm" data-attachment-upload-retry>Yeniden dene</button>';
    else element.innerHTML = `<span>${message.kind === 'unavailable' ? 'Bu eski medya artık kullanılamıyor.' : 'Dosya yüklemesi tamamlanmadı.'}</span>`;
    $('[data-attachment-upload-retry]', element)?.addEventListener('click', event => { event.currentTarget.disabled = true; enqueueDmUpload({ message, file: pendingDmFiles.get(message.id), retry: true }); });
    $('[data-attachment-upload-cancel]', element)?.addEventListener('click', event => { event.stopPropagation(); cancelDmUpload(message, event.currentTarget); });
    $('[data-legacy-upload-retry]', element)?.addEventListener('click', async event => {
      event.currentTarget.disabled = true;
      try {
        const ready = await uploadDmBinary(`/api/messages/${message.id}/attachment-data`, new Blob([media.ciphertext]));
        const saved = { ...media }; delete saved.ciphertext; await dmMediaPut(saved); updateAttachmentReady(ready);
        await startAttachmentTransfer(message.receiver, ready, saved).catch(() => {});
      } catch (error) { event.currentTarget.disabled = false; toast(error.message, 1); }
    }, { once: true });
    return;
  }
  if (message.kind === 'unavailable') {
    element.classList.add('attachment-missing'); element.textContent = 'Bu eski medya artık kullanılamıyor.'; return;
  }
  if (message.encrypted) {
    if (media?.key && media?.iv) {
      element.classList.add('attachment-missing'); element.innerHTML = '<span>Eski fotoğraf ortak erişime aktarılıyor…</span>';
      try { await migrateLegacyDmMedia(message, media); }
      catch (error) {
        if (!element.isConnected) return;
        try {
          const cached = await decryptLegacyDmMedia(message, media), url = URL.createObjectURL(cached);
          decryptedDmMedia.set(message.file, { blob: cached, url }); element.replaceChildren();
          if (message.kind === 'video') element.append(createVideoPlayer(url).root);
          else { const img = document.createElement('img'); img.className = 'media'; img.alt = media.name || 'Paylaşılan fotoğraf'; img.src = url; img.onclick = () => lightbox(url); element.append(img); }
          toast(`Bu cihazda görüntüleniyor; ortak aktarım tamamlanamadı: ${error.message}`, 1);
        } catch (decryptError) { element.textContent = `Eski medya açılamadı: ${decryptError.message}`; }
      }
      return;
    }
    element.classList.add('attachment-missing');
    const otherId = message.sender === me.id ? message.receiver : message.sender;
    const contact = friend(otherId), canRequest = contact?.online && !contact.blocked;
    element.innerHTML = `<span>Bu eski ek, ortak görüntülemeye geçirmek için bir cihazdaki eski anahtara ihtiyaç duyuyor.</span>${canRequest ? '<button type="button" class="btn sm" data-attachment-request>Eski medyayı aktar</button>' : '<small>Diğer kişinin eski medya anahtarı çevrimiçi olduğunda aktarılabilir.</small>'}`;
    $('[data-attachment-request]', element)?.addEventListener('click', () => requestDmAttachment(message), { once: true });
    return;
  }
  if (!message.fileType) { element.classList.add('attachment-missing'); element.textContent = 'Bu ekin dosya bilgisi bulunamadı.'; return; }
  const url = `/api/dm-attachments/${message.id}`;
  if (message.kind === 'video') { const player = createVideoPlayer(url); element.append(player.root); }
  else { const img = document.createElement('img'); img.className = 'media'; img.alt = 'Paylaşılan fotoğraf'; img.src = url; img.onclick = () => lightbox(url); element.append(img); }
}
function enqueueDmUpload(job) {
  dmUploadQueue.push(job); pumpDmUploadQueue();
}
function queueDmFiles(files) {
  const target = active;
  if (view !== 'chat' || !target) return;
  const accepted = [];
  for (const file of files) {
    const video = file.type.startsWith('video/'), allowed = /^(image\/(png|jpeg|gif|webp)|video\/(mp4|webm))$/.test(file.type);
    if (!allowed) { toast(`${file.name}: desteklenmeyen dosya türü.`, 1); continue; }
    if (video && file.size > DM_VIDEO_LIMIT) { toast(`${file.name}: video 50 MB sınırını aşıyor.`, 1); continue; }
    if (!video && file.size > 100 * 1024 * 1024) { toast(`${file.name}: görsel sıkıştırma öncesi 100 MB sınırını aşıyor.`, 1); continue; }
    accepted.push(file);
  }
  accepted.forEach(file => dmUploadQueue.push({ file, target }));
  const queuedTotal = dmUploadQueue.length + activeDmUploads;
  if (queuedTotal > DM_UPLOAD_CONCURRENCY) toast(`${queuedTotal} dosya sırada; aynı anda en fazla 5'i yüklenir.`, 0, 3600);
  pumpDmUploadQueue();
}
function pumpDmUploadQueue() {
  while (activeDmUploads < DM_UPLOAD_CONCURRENCY && dmUploadQueue.length) {
    const job = dmUploadQueue.shift(); activeDmUploads++;
    (async () => {
      try {
        if (job.retry) {
          if (!job.file) throw new Error('Yüklemek için dosya bu cihazda bulunamadı.');
          await uploadDmAttachment(job.message, job.file);
          toast('Dosya yüklemesi tamamlandı.');
        } else await sendFile(job.file, job.target);
      } catch (error) {
        if (error.cancelled) { if (error.messageId != null) cancelledDmUploads.delete(error.messageId); return; }
        if (job.message) { const node = $(`.msg[data-id="${job.message.id}"] .mt`); if (node) renderDmAttachment(node, job.message); }
        toast(error.message || 'Dosya gönderilemedi.', 1);
      } finally { activeDmUploads--; pumpDmUploadQueue(); }
    })();
  }
}
async function uploadDmAttachment(message, file) {
  if (uploadingDmMedia.has(message.id)) throw new Error('Bu dosyanın yüklemesi zaten sürüyor.');
  if (!file || file.size !== message.fileSize || file.type !== message.fileType) throw new Error('Yeniden seçilen dosya, ilk dosyayla aynı tür ve boyutta olmalı.');
  uploadingDmMedia.add(message.id); dmUploadProgress.set(message.id, 0);
  const node = $(`.msg[data-id="${message.id}"] .mt`); if (node) renderDmAttachment(node, message);
  try {
    if (cancelledDmUploads.has(message.id)) { const error = new Error('Yükleme iptal edildi.'); error.cancelled = true; error.messageId = message.id; throw error; }
    const ready = await uploadDmBinary(`/api/messages/${message.id}/attachment-data`, file, null, (loaded, total) => setDmUploadProgress(message.id, loaded, total), message.id);
    pendingDmFiles.delete(message.id); dmUploadProgress.delete(message.id); updateAttachmentReady(ready); return ready;
  } finally { uploadingDmMedia.delete(message.id); }
}
async function sendFile(file, target) {
  if (!file || !target) return;
  const sourceIsVideo = file.type.startsWith('video/');
  const preparing = sourceIsVideo ? toast('Video 720p’ye sıkıştırılıyor; bu işlem biraz sürebilir…', 0, 120000) : null;
  let compressed;
  try { compressed = sourceIsVideo ? await compressDmVideo(file) : await compressDmImage(file); }
  finally { preparing?.remove(); }
  const video = compressed.type.startsWith('video/'), limit = video ? DM_VIDEO_LIMIT : DM_IMAGE_LIMIT;
  if (compressed.size > limit) throw new Error(video ? `${file.name}: video 50 MB sınırını aşıyor.` : `${file.name}: sıkıştırılmış görsel 25 MB sınırını aşıyor.`);
  const id = [...crypto.getRandomValues(new Uint8Array(16))].map(byte => byte.toString(16).padStart(2, '0')).join('');
  const message = await api(`/messages/${target}/attachment`, 'POST', { id, type: compressed.type, size: compressed.size });
  pendingDmFiles.set(message.id, compressed); dmUploadProgress.set(message.id, 0); addMsg(message);
  try { await uploadDmAttachment(message, compressed); }
  catch (error) { const node = $(`.msg[data-id="${message.id}"] .mt`); if (node) renderDmAttachment(node, message); throw error; }
  toast(compressed !== file ? (video ? 'Video 720p’ye sıkıştırılarak DM’ye kaydedildi.' : 'Sıkıştırılmış görsel DM’ye kaydedildi.') : 'Medya DM’ye kaydedildi.');
}
function updateAttachmentReady(message) {
  store.set(message.id, message);
  if (!message.encrypted && message.file) {
    const cached = decryptedDmMedia.get(message.file); if (cached?.url) URL.revokeObjectURL(cached.url);
    decryptedDmMedia.delete(message.file); dmMediaDelete(message.file).catch(() => {});
  }
  const node = $(`.msg[data-id="${message.id}"] .mt`);
  if (node) { node.classList.add('has-media'); renderDmAttachment(node, message); }
}
function addMsg(m) {
  const id = Number(m?.id);
  if (!Number.isSafeInteger(id) || deletedDmMessageIds.has(id) || store.has(id)) return;
  store.set(id, m);
  const other = m.sender === me.id ? m.receiver : m.sender, box = $('#msgs'), f = friend(other);
  if (f) { f.last = { sender: m.sender, body: m.body, kind: m.kind, createdAt: m.createdAt }; fr.friends.sort(byLast); fr.conversations.sort(byLast); }
  const inactiveDm = m.sender !== me.id && (document.hidden || view !== 'chat' || Number(other) !== Number(active));
  if (inactiveDm) {
    playAppSound('message', { coalesce: true });
    const sender = friend(other);
    if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
      const kind = m.kind === 'image' ? 'Fotoğraf' : m.kind === 'video' ? 'Video' : 'Yeni mesaj';
      try {
        const notice = new Notification(sender?.displayName || 'Aven', { body: kind, icon: '/logo.png', tag: `aven-dm-${other}` });
        notice.onclick = () => { window.focus(); notice.close(); if (sender) openDirectMessage(sender.id); };
      } catch {}
    }
  }
  if (view === 'chat' && other === active && box) {
    if (seen.has(id)) return;
    const stickToBottom = m.sender === me.id || box.scrollHeight - box.scrollTop - box.clientHeight < 48;
    seen.add(id); put(box, m);
    if (stickToBottom) box.scrollTop = box.scrollHeight;
  } else if (m.sender !== me.id) unread[other] = (unread[other] || 0) + 1;
  if ($('.side')) renderSide();
}
function removeDmMessage(messageId) {
  const id = Number(messageId);
  const message = store.get(id);
  deletedDmMessageIds.add(id);
  if (deletedDmMessageIds.size > 2000) deletedDmMessageIds.delete(deletedDmMessageIds.values().next().value);
  $(`.msg[data-id="${id}"]`)?.remove(); store.delete(id); seen.delete(id); prevM = null;
  if (message?.file) {
    const cachedMedia = decryptedDmMedia.get(message.file);
    if (cachedMedia?.url) URL.revokeObjectURL(cachedMedia.url);
    decryptedDmMedia.delete(message.file);
    dmMediaDelete(message.file).catch(() => {});
    for (const [key, session] of dmTransfers) if (session.message?.id === id || session.message?.file === message.file) closeDmTransfer(key);
  }
  pendingDmFiles.delete(id); dmUploadProgress.delete(id); cancelledDmUploads.delete(id);
  loadFriends().catch(() => {});
}

/* ---------- Uyarılar / Hesap Detayı ---------- */
const WARN_TAIL = ['', 'Bu senin ilk resmi uyarın. Tekrarı hâlinde hesabın daha da kısıtlanır.', 'Bu ikinci ve ağır bir uyarı. Yalnızca bir uyarı hakkın kaldı; bir sonraki ihlal hesabını doğrudan riske atar.', 'Bu SON uyarın. Uyarı hakkın tükendi; bir sonraki ihlalde ek uyarı verilmeden hesabın kalıcı olarak kapatılır.'];
const STANDING = [['gayet iyi', "Aven'in Hizmet Koşullarına ve Topluluk İlkelerine uyduğun için teşekkür ederiz. Kuralları ihlal edip etmediğini buradan görüntüleyebilirsin."],
  ['kısıtlı', 'Hesabına 1 resmi uyarı verildi. Kurallara uymaya devam etmezsen hesabın daha da kısıtlanır.'],
  ['çok kısıtlı', 'Hesabına 2 resmi uyarı verildi. Yalnızca 1 uyarı hakkın kaldı; bir sonraki ihlal hesabını riske atar.'],
  ['risk altında', 'Hesabına 3 resmi uyarı verildi ve uyarı hakkın tükendi. Bir sonraki ihlalde hesabın kalıcı olarak kapatılır.']];
const warnCard = w => `<div class="warn-card"><div class="warn-top"><span class="warn-ico"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 2 20h20L12 3z"/><path d="M12 10v5M12 18v.01"/></svg></span><div><small>AVEN GÜVENLİK BİLDİRİMİ</small><b>${w.number}. uyarı aldın</b></div><span class="warn-count">${w.number}/${w.max}</span></div><div class="warn-reason"><small>Uyarı sebebi</small>${esc(w.category)}${w.details ? `<em>${esc(w.details)}</em>` : ''}</div><div class="warn-pips">${[1, 2, 3].map(i => `<i class="${i <= w.number ? 'on' : ''}"></i>`).join('')}</div><p class="warn-tail">${esc(WARN_TAIL[w.number] || '')}</p><button class="btn sm" data-open-standing>Hesap Detayı'nı aç</button></div>`;
function renderStanding(el, s) {
  const lv = Math.min(s.count, 3), [label, text] = STANDING[lv];
  el.innerHTML = `<div class="std lv${lv}"><div class="std-head">${av(me, 'xl')}<div><h3>Hesabının durumu <b>${label}</b></h3><p>${text}</p></div></div>
  <div class="std-track">${s.steps.map((n, i) => `<div class="std-step${i < lv ? ' done' : ''}${i === lv ? ' cur' : ''}"><span>${i === lv ? (lv ? '!' : '✓') : ''}</span><small>${n}</small></div>`).join('')}</div>
  <div class="std-meta"><b>${s.count}/${s.max}</b> uyarı kullanıldı · Uyarılar geri alınmaz ve affedilmez.</div>
  ${s.warnings.map(w => `<div class="std-warn"><b>${w.number}. uyarı</b><span>${esc(w.category)}${w.details ? ' — ' + esc(w.details) : ''}</span><time>${fmt(w.createdAt)}</time></div>`).join('')}</div>`;
}
async function loadStanding() { const el = $('#standing'); if (!el) return; try { renderStanding(el, await api('/me/standing')); } catch (er) { el.textContent = er.message; } }
document.addEventListener('click', e => { if (e.target.closest('[data-open-standing]') && me) { stab = 'account'; setView('settings'); } });

/* ---------- Ayarlar ---------- */
const STABS = [['profile', 'Profil'], ['communication', 'İletişim'], ['audio', 'Ses'], ['language', 'Dil'], ['password', 'Şifre'], ['theme', 'Tema'], ['blocks', 'Engellenenler'], ['account', 'Hesap Detayı'], ['developer', 'Geliştirici'], ['about', 'Hakkında']];
const SETTINGS_GROUPS = [['HESAP', ['profile', 'password', 'account']], ['UYGULAMA', ['communication', 'audio', 'language', 'theme']], ['GİZLİLİK', ['blocks']], ['AVEN', ['developer', 'about']]];
let stab = 'profile';
async function applyVoiceOutput(audio, deviceId = voicePreferences.output) {
  if (typeof audio.setSinkId !== 'function') {
    if (deviceId) throw new Error('Bu tarayıcı ses çıkış aygıtı seçimini desteklemiyor.');
    return;
  }
  try { await audio.setSinkId(deviceId || ''); }
  catch (er) {
    if (!deviceId) throw er;
    voicePreferences.output = '';
    await audio.setSinkId('');
  }
}
async function refreshAudioDevices(container = document, requestPermission = false) {
  const input = $('[data-audio-input]', container), output = $('[data-audio-output]', container);
  if (!input || !output) return;
  if (!navigator.mediaDevices?.enumerateDevices) {
    input.innerHTML = '<option value="">Bu tarayıcı ses aygıtlarını listeleyemiyor</option>';
    output.innerHTML = '<option value="">Varsayılan çıkış</option>';
    toast('Tarayıcı ses aygıtlarını listelemeyi desteklemiyor.', 1);
    return;
  }
  if (requestPermission) {
    if (!navigator.mediaDevices.getUserMedia) throw new Error('Mikrofon erişimi için güvenli HTTPS bağlantısı gerekli.');
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach(track => track.stop());
  }
  const devices = await navigator.mediaDevices.enumerateDevices();
  const microphones = devices.filter(device => device.kind === 'audioinput');
  const speakers = devices.filter(device => device.kind === 'audiooutput');
  input.innerHTML = '<option value="">Varsayılan mikrofon</option>' + microphones.map((device, index) =>
    `<option value="${esc(device.deviceId)}">${esc(device.label || `Mikrofon ${index + 1}`)}</option>`).join('');
  if (voicePreferences.input && microphones.some(device => device.deviceId === voicePreferences.input)) input.value = voicePreferences.input;
  else if (voicePreferences.input) voicePreferences.input = '';
  const supportsSinkId = typeof HTMLMediaElement.prototype.setSinkId === 'function';
  output.innerHTML = '<option value="">Varsayılan ses çıkışı</option>' + speakers.map((device, index) =>
    `<option value="${esc(device.deviceId)}">${esc(device.label || `Ses çıkışı ${index + 1}`)}</option>`).join('');
  output.disabled = !supportsSinkId;
  if (supportsSinkId && voicePreferences.output && speakers.some(device => device.deviceId === voicePreferences.output)) output.value = voicePreferences.output;
  else if (voicePreferences.output && !speakers.some(device => device.deviceId === voicePreferences.output)) voicePreferences.output = '';
  const inputNote = $('[data-audio-input-note]', container);
  if (inputNote) inputNote.textContent = microphones.length ? `${microphones.length} mikrofon bulundu. Seçimin sonraki sesli kanallarda da kullanılacak.` : 'Mikrofon bulunamadı. Aygıtı bağlayıp listeyi yenile.';
  const outputNote = $('[data-audio-output-note]', container);
  if (outputNote) outputNote.textContent = supportsSinkId
    ? 'Seçilen aygıt, sesli kanaldaki diğer katılımcıların sesini çalar.'
    : 'Bu tarayıcıda çıkış aygıtı seçimi desteklenmiyor; varsayılan hoparlör kullanılır.';
  if (!audioDeviceChangeBound) {
    navigator.mediaDevices.addEventListener?.('devicechange', () => {
      if ($('[data-audio-input]')) refreshAudioDevices().catch(er => toast(`Ses aygıtları yenilenemedi: ${er.message}`, 1));
    });
    audioDeviceChangeBound = true;
  }
  input.onchange = async () => {
    voicePreferences.input = input.value;
    if (voiceSession?.canSpeak) {
      try { await changeVoiceInput(input.value); toast('Mikrofon değiştirildi.'); }
      catch (er) { toast(er.message, 1); }
    }
    refreshAudioDevices().catch(er => toast(er.message, 1));
  };
  output.onchange = async () => {
    voicePreferences.output = output.value;
    try {
      for (const audio of document.querySelectorAll('.voice-audio audio')) await applyVoiceOutput(audio);
      toast('Ses çıkışı güncellendi.');
    } catch (er) { toast(er.message, 1); }
  };
}
async function changeVoiceInput(deviceId) {
  if (!voiceStream || !navigator.mediaDevices?.getUserMedia) return;
  const oldStream = voiceStream, oldTrack = oldStream.getAudioTracks()[0], wasEnabled = oldTrack?.enabled ?? true;
  const audio = { echoCancellation: true, noiseSuppression: true, autoGainControl: true };
  if (deviceId) audio.deviceId = { exact: deviceId };
  const replacement = await navigator.mediaDevices.getUserMedia({ audio });
  const nextTrack = replacement.getAudioTracks()[0];
  if (!nextTrack) { replacement.getTracks().forEach(track => track.stop()); throw new Error('Seçilen mikrofon ses akışı vermedi.'); }
  nextTrack.enabled = wasEnabled;
  const senders = [...voicePeers.values()].map(({ pc }) => pc.getSenders().find(sender => sender.track?.kind === 'audio')).filter(Boolean);
  const replaced = [];
  try {
    for (const sender of senders) { await sender.replaceTrack(nextTrack); replaced.push(sender); }
    voiceStream = replacement;
    oldStream.getTracks().forEach(track => track.stop());
    if (voiceActivityTimer) {
      clearInterval(voiceActivityTimer); voiceActivityTimer = null; voiceAnalyser = null;
      const oldContext = voiceAudioContext; voiceAudioContext = null;
      oldContext?.close().catch(() => {});
      startVoiceActivityMonitor();
    }
    updateVoicePanel();
  } catch (er) {
    for (const sender of replaced) await sender.replaceTrack(oldTrack).catch(() => {});
    replacement.getTracks().forEach(track => track.stop());
    throw new Error(`Mikrofon değiştirilemedi: ${er.message}`);
  }
}
const aboutHtml = () => `<div class="abt"><div class="abt-orbs"><i></i><i></i><i></i></div>
  <div class="abt-hero"><div class="abt-logo"><span class="ring"></span><span class="ring r2"></span><img src="/image/profil.png" alt="Aven"></div><h2 class="abt-name">Aven</h2><p class="abt-sub">Arkadaşlarınla konuşmak ve paylaşmak için.</p><span class="abt-ver">Sürüm 1.0.0</span></div>
  <div class="abt-grid">${[
    ['01', 'Mesajlaşma', 'Arkadaşlarınla anında yazış.'],
    ['02', 'Arkadaşlar', 'Kullanıcı adıyla ara ve istekleri yönet.'],
    ['03', 'Paylaşım', 'Fotoğraf ve videoları sohbetlere ekle.'],
    ['04', 'Profil', 'Fotoğrafını ve hakkında yazını düzenle.'],
    ['05', 'Gizlilik', 'Mesaj ayarlarını seç ve kullanıcıları engelle.'],
    ['06', 'Görünüm', 'Koyu, gece veya açık temayı kullan.']
  ].map(([i, t, d], n) => `<div class="abt-card" style="--i:${n}"><span class="ic">${i}</span><b>${t}</b><span>${d}</span></div>`).join('')}</div>
  <p class="abt-foot">Aven'e katıldığın tarih: <b>${new Date(me.createdAt).toLocaleDateString(localeValue())}</b></p>
  <button type="button" class="btn about-more-info">Daha fazla bilgi al <span aria-hidden="true">→</span></button></div>`;
async function fillSettingsGuildTagPicker(container) {
  if (!container) return;
  container.innerHTML = '<div class="profile-tag-loading">Sunucu etiketleri yükleniyor…</div>';
  const draw = servers => {
    if (!container.isConnected) return;
    const selectedId = Number(me.guildTag?.serverId) || 0;
    const current = container.closest('.settings-profile-tag')?.querySelector('.settings-profile-tag-current');
    if (current) current.innerHTML = `<small>ŞU ANKİ ETİKET</small>${me.guildTag?.tag ? `<span class="guild-tag-chip"><i>${serverTagBadgeIcon(me.guildTag.badge)}</i><b>${esc(me.guildTag.tag)}</b></span>` : '<b class="settings-profile-tag-none">Seçilmedi</b>'}`;
    container.innerHTML = `<button type="button" class="profile-tag-choice" data-settings-guild-tag="" aria-pressed="${selectedId === 0}">
        <span class="profile-tag-choice-icon">×</span><span class="profile-tag-choice-copy"><b>Etiket kullanma</b><small>Profilinde sunucu etiketi gösterme</small></span><i>${selectedId === 0 ? '✓' : '›'}</i>
      </button>${servers.map(server => `<button type="button" class="profile-tag-choice" data-settings-guild-tag="${server.id}" aria-pressed="${selectedId === Number(server.id)}">
        <span class="profile-tag-choice-icon">${server.icon ? `<img src="${esc(server.icon)}" alt="">` : esc([...server.name][0]?.toUpperCase() || '?')}</span><span class="profile-tag-choice-copy"><span class="profile-tag-choice-label"><span class="guild-tag-chip"><i>${serverTagBadgeIcon(server.serverTag.badge)}</i><b>${esc(server.serverTag.tag)}</b></span></span><small>${esc(server.name)}</small></span><i>${selectedId === Number(server.id) ? '✓' : '›'}</i>
      </button>`).join('')}${servers.length ? '' : '<p class="profile-tag-empty">Üyesi olduğun sunucularda şu anda açık bir etiket bulunmuyor.</p>'}`;
    container.onclick = async event => {
      const choice = event.target.closest('[data-settings-guild-tag]');
      if (!choice || !container.contains(choice)) return;
      container.querySelectorAll('button').forEach(button => { button.disabled = true; });
      const serverId = choice.dataset.settingsGuildTag;
      try {
        const result = await api('/users/me/server-tag', 'PUT', { serverId: serverId ? Number(serverId) : null });
        me.guildTag = result.guildTag;
        guilds = await api('/servers').catch(() => guilds);
        draw(guilds.filter(server => server.serverTag?.enabled && server.serverTag.tag));
        await loadFriends().catch(() => {});
        if (guildMode && currentGuildId) await reloadGuild(currentGuildId);
        else if (view === 'chat' && active) await openChat(active, true);
        if (profId) profileModal(profId, true);
        toast(serverId ? 'Profil etiketi güncellendi.' : 'Profil etiketi kaldırıldı.');
      } catch (er) {
        toast(er.message, 1);
        container.querySelectorAll('button').forEach(button => { button.disabled = false; });
      }
    };
  };
  try {
    guilds = await api('/servers');
    draw(guilds.filter(server => server.serverTag?.enabled && server.serverTag.tag));
  } catch (er) {
    if (container.isConnected) container.innerHTML = `<p class="profile-tag-empty">Etiketler yüklenemedi: ${esc(er.message)}</p>`;
  }
}
function settingsView(m, back) {
  const labels = new Map(STABS);
  m.innerHTML = `<div class="main-h">${back}<b>Ayarlar</b></div><div class="settings-layout"><aside class="settings-nav" role="tablist" aria-label="Ayarlar">
  ${SETTINGS_GROUPS.map(([group, keys]) => `<div class="settings-nav-group"><p>${group}</p>${keys.map(key => `<button class="settings-tab${key === stab ? ' on' : ''}" data-t="${key}" role="tab" aria-selected="${key === stab}">${labels.get(key)}</button>`).join('')}</div>`).join('')}
  </aside><div class="settings-content"><div class="panel sp settings-panel fade">
  <div class="pane settings-pane${stab === 'profile' ? ' on' : ''}" data-p="profile"><div class="settings-page-heading"><small>HESAP</small><h2>Profili düzenle</h2><p>Profilindeki bilgileri ve görselleri yönet.</p></div><form class="box settings-profile-form" id="pf">
  <div class="settings-card-heading"><div><h3>Profil fotoğrafı</h3><p>Arkadaşların seni kolayca tanısın.</p></div></div><div class="settings-avatar-editor">${av(me, 'xl')}<div class="settings-avatar-controls"><b>Profil resmi</b><small>JPG veya PNG · Kare görsel önerilir</small><div class="settings-control-actions"><label class="btn sm" for="pic">Resmi değiştir</label><input id="pic" type="file" accept="image/*" hidden>${me.avatar ? '<button type="button" class="btn sm danger" id="rm">Kaldır</button>' : ''}</div></div><div class="settings-badges-preview"><b>Rozetler</b>${badgeRow(me) || '<small class="settings-badges-empty">Henüz rozetin yok.</small>'}</div></div>
  <div class="settings-banner-editor"><div class="banner sb"></div><div class="settings-banner-actions"><div><b>Profil bannerı</b><small>Profil kartının üst kısmında görünür.</small></div><div class="settings-control-actions"><label class="btn sm" for="ban">Görsel seç</label><input id="ban" type="file" accept="image/*" hidden>${me.banner ? '<button type="button" class="btn sm danger" id="rmb">Kaldır</button>' : ''}</div></div></div>
  <section class="settings-profile-tag"><div class="settings-profile-tag-heading"><div><small>PROFİL GÖRÜNÜMÜ</small><h3>Profil etiketi</h3><p>Açık sunucu etiketlerinden birini seç. Seçtiğin etiket adının yanında profilinde, mesajlarda ve sunucularda görünür.</p></div><div class="settings-profile-tag-current"><small>ŞU ANKİ ETİKET</small>${me.guildTag?.tag ? `<span class="guild-tag-chip"><i>${serverTagBadgeIcon(me.guildTag.badge)}</i><b>${esc(me.guildTag.tag)}</b></span>` : '<b class="settings-profile-tag-none">Seçilmedi</b>'}</div></div><div class="settings-profile-tag-options" data-settings-guild-tag-options></div></section>
<div class="settings-fields-heading"><h3>Profil bilgileri</h3><p>Herkese açık profilinde gösterilen ad ve açıklama.</p></div>${field('displayName', 'Görünen ad', 'text', 'off')}${field('username', 'Kullanıcı adı', 'text', 'off')}<label class="f settings-bio-field"><textarea name="bio" maxlength="160" rows="4" placeholder=" "></textarea><span>Hakkında</span><small><b data-bio-count>${(me.bio || '').length}</b> / 160</small></label><button class="btn primary settings-save">Değişiklikleri kaydet</button></form></div>
  <div class="pane${stab === 'communication' ? ' on' : ''}" data-p="communication"><section class="box communication-settings"><h3>Kimler mesaj gönderebilir?</h3><p>Mesaj istekleri kabul edilene kadar sohbet listene eklenmez.</p><div class="communication-options" role="radiogroup" aria-label="Mesaj gönderme izni">
    <label><input type="radio" name="messagePolicy" value="friends"${(me.messagePolicy || 'friends') === 'friends' ? ' checked' : ''}><span><b>Arkadaşlarım</b><small>Yalnızca arkadaşların mesaj gönderebilir.</small></span></label>
    <label><input type="radio" name="messagePolicy" value="everyone"${me.messagePolicy === 'everyone' ? ' checked' : ''}><span><b>Herkes</b><small>Arkadaş olmayanların mesajı isteklerde bekler.</small></span></label>
    <label><input type="radio" name="messagePolicy" value="nobody"${me.messagePolicy === 'nobody' ? ' checked' : ''}><span><b>Hiç kimse</b><small>Kimse sana DM gönderemez.</small></span></label>
  </div><small class="communication-saved" aria-live="polite">Seçimin otomatik kaydedilir.</small></section></div>
  <div class="pane${stab === 'audio' ? ' on' : ''}" data-p="audio"><section class="box audio-settings"><div class="audio-settings-heading"><span>SES AYGITLARI</span><h3>Mikrofon ve hoparlör</h3><p>Tercih ettiğin aygıtları seç. Mikrofon değişikliği açık ses kanalına hemen uygulanır.</p></div>
    <label class="audio-device-field"><span><b>Giriş aygıtı</b><small data-audio-input-note>Mikrofon aygıtları yükleniyor…</small></span><select data-audio-input aria-label="Mikrofon seç"></select></label>
    <label class="audio-device-field"><span><b>Çıkış aygıtı</b><small data-audio-output-note>Hoparlör aygıtları yükleniyor…</small></span><select data-audio-output aria-label="Ses çıkışı seç"></select></label>
    <div class="audio-settings-footer"><p>Mikrofon listesinin tamamını görmek için tarayıcıdan mikrofon erişimine izin ver.</p><button type="button" class="btn primary" data-audio-refresh>Aygıtları yenile</button></div>
  </section></div>
  <div class="pane${stab === 'language' ? ' on' : ''}" data-p="language"><section class="box language-settings"><div class="audio-settings-heading"><span>UYGULAMA</span><h3>Bir dil seç</h3><p>Aven'de kullanmak istediğin dili seç. Bu tercih yalnızca açık olan hesaba kaydedilir.</p></div><label class="audio-device-field language-device-field"><span><b>Dil</b><small>Arayüz dili</small></span><select data-language aria-label="Dil seç"><option value="tr"${(me.language || 'tr') === 'tr' ? ' selected' : ''}>🇹🇷 Türkçe</option><option value="en"${me.language === 'en' ? ' selected' : ''}>🇬🇧 English</option><option value="de"${me.language === 'de' ? ' selected' : ''}>🇩🇪 Almanca</option></select></label><small class="language-saved-note">Dil tercihin bu hesaba kaydedilir; hesap değiştirdiğinde o hesabın dili kullanılır.</small></section></div>
  <div class="pane${stab === 'password' ? ' on' : ''}" data-p="password"><form class="box" id="pw"><h3>Şifre</h3>${field('current', 'Mevcut şifre', 'password', 'current-password')}${field('next', 'Yeni şifre (en az 8 karakter)', 'password', 'new-password')}<button class="btn primary">Şifreyi değiştir</button></form></div>
  <div class="pane${stab === 'theme' ? ' on' : ''}" data-p="theme"><div class="box"><h3>Tema</h3><div class="seg">${[['dark', 'Koyu'], ['night', 'Gece'], ['light', 'Açık']].map(([k, l]) => `<button class="btn ${me.theme === k ? 'on' : ''}" data-th="${k}">${l}</button>`).join('')}</div></div></div>
  <div class="pane${stab === 'blocks' ? ' on' : ''}" data-p="blocks"><div class="box"><h3>Engellenenler</h3><div id="bl" class="res"></div></div></div>
  <div class="pane${stab === 'account' ? ' on' : ''}" data-p="account"><section class="box"><div id="standing" class="standing"></div></section></div>
  <div class="pane${stab === 'developer' ? ' on' : ''}" data-p="developer"><div class="settings-page-heading"><small>GELİŞTİRİCİ</small><h2>Geliştirici</h2><p>Kimlikleri uygulama içindeki menülerden kopyalamak için geliştirici modunu aç.</p></div><section class="box developer-settings"><label class="developer-mode-option"><span><b>Geliştirici modu</b><small>Sağ tık menülerinde kullanıcı, sunucu ve kanal ID’sini kopyalama seçeneklerini göster.</small></span><input type="checkbox" data-developer-mode${me.developerMode ? ' checked' : ''}><i aria-hidden="true"></i></label>${me.developerMode ? `<div class="developer-own-id"><div><b>Kullanıcı ID’si</b><code>${esc(me.publicId || '—')}</code></div><button type="button" class="btn sm" data-copy-own-id>${uiIcon('copy')} Kullanıcı ID'sini kopyala</button></div>` : ''}</section></div>
  <div class="pane settings-pane${stab === 'about' ? ' on' : ''}" data-p="about">${aboutHtml()}</div>
  <button class="btn danger settings-logout" id="out">Çıkış yap</button></div></div></div>`;
  const save = async changes => {
    const button = $('.settings-save', m);
    if (button) button.disabled = true;
    try {
      me = await api('/me', 'PUT', changes);
      document.documentElement.dataset.theme = me.theme || 'dark';
      renderSide();
      renderMain();
      if (changes.language) applyLanguage(me.language);
      if (profId) profileModal(profId, true);
      toast('Kaydedildi');
    } catch (er) {
      toast(er.message, 1);
      const currentButton = $('.settings-save', m);
      if (currentButton) currentButton.disabled = false;
      const developerToggle = $('[data-developer-mode]', m);
      if (developerToggle) developerToggle.checked = !!me.developerMode;
    }
  };
  const pf = $('#pf', m); $('[name=displayName]', pf).value = me.displayName; $('[name=username]', pf).value = me.username; $('[name=bio]', pf).value = me.bio || ''; setBanner(m, me);
  fillSettingsGuildTagPicker($('[data-settings-guild-tag-options]', pf));
  $('[name=bio]', pf).oninput = e => { $('[data-bio-count]', pf).textContent = e.target.value.length; };
  $('#ban', m).onchange = async e => { const f = e.target.files[0]; if (f) try { save({ banner: await toAvatar(f, 720, 240) }); } catch (er) { toast(er.message, 1); } };
  $('#rmb', m)?.addEventListener('click', () => save({ banner: null }));
  pf.onsubmit = e => { e.preventDefault(); save({ displayName: $('[name=displayName]', pf).value, username: $('[name=username]', pf).value, bio: $('[name=bio]', pf).value }); };
  $('#pic', m).onchange = async e => { const f = e.target.files[0]; if (f) try { save({ avatar: await toAvatar(f) }); } catch (er) { toast(er.message, 1); } };
  $('#rm', m)?.addEventListener('click', () => save({ avatar: null }));
  m.querySelectorAll('[name=messagePolicy]').forEach(input => input.onchange = () => save({ messagePolicy: input.value }));
  $('[data-language]', m)?.addEventListener('change', event => save({ language: event.currentTarget.value }));
  $('[data-developer-mode]', m)?.addEventListener('change', event => save({ developerMode: event.currentTarget.checked }));
  $('[data-copy-own-id]', m)?.addEventListener('click', event => {
    if (!me.developerMode) return;
    const button = event.currentTarget;
    button.disabled = true;
    copyDeveloperIdentifier('Kullanıcı ID’si', me.publicId).finally(() => { if (button.isConnected) button.disabled = false; });
  });
  $('.about-more-info', m)?.addEventListener('click', () => { history.pushState({ avenPublicPage: 'about' }, '', '/hakkında'); aboutPublicScreen(); });
  m.querySelectorAll('[data-th]').forEach(b => b.onclick = () => save({ theme: b.dataset.th }));
  $('#pw', m).onsubmit = async e => {
    e.preventDefault(); const f = e.target;
    try { await api('/password', 'PUT', { current: f.current.value, next: f.next.value }); f.reset(); toast('Şifre değiştirildi'); } catch (er) { toast(er.message, 1); }
  };
  $('#out', m).onclick = async () => {
    try { if (voiceSession) await leaveVoice(false); await api('/logout', 'POST'); es?.close(); clearInterval(poll); me = null; document.documentElement.dataset.theme = 'dark'; authScreen(false); }
    catch (er) { toast(er.message, 1); }
  };
  $('[data-audio-refresh]', m)?.addEventListener('click', async event => {
    const button = event.currentTarget; button.disabled = true;
    try { await refreshAudioDevices(m, true); toast('Ses aygıtları yenilendi.'); }
    catch (er) { toast(`Mikrofon izni alınamadı: ${er.message}`, 1); }
    finally { button.disabled = false; }
  });
  if (stab === 'audio') refreshAudioDevices(m).catch(er => toast(`Ses aygıtları yüklenemedi: ${er.message}`, 1));
  if (stab === 'account') loadStanding();
  const tabs = $('.settings-nav', m);
  $('.settings-tab.on', tabs)?.scrollIntoView({ inline: 'center', block: 'nearest' });
  tabs.onclick = e => {
    const b = e.target.closest('.settings-tab'); if (!b || b.dataset.t === stab) return;
    const keys = STABS.map(t => t[0]), dir = keys.indexOf(b.dataset.t) > keys.indexOf(stab) ? 'r' : 'l';
    stab = b.dataset.t;
    tabs.querySelectorAll('.settings-tab').forEach(x => { const active = x === b; x.classList.toggle('on', active); x.setAttribute('aria-selected', String(active)); });
    m.querySelectorAll('.pane').forEach(pn => { pn.classList.remove('on', 'go-l', 'go-r'); if (pn.dataset.p === stab) { void pn.offsetWidth; pn.classList.add('on', 'go-' + dir); } });
    b.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
    $('.settings-content', m).scrollTop = 0;
    if (stab === 'blocks') loadBlocks();
    if (stab === 'audio') refreshAudioDevices(m).catch(er => toast(`Ses aygıtları yüklenemedi: ${er.message}`, 1));
    if (stab === 'account') loadStanding();
  };
  loadBlocks();
}
function toAvatar(file, W = 192, H = 192, quality = .85, maxLength = 0) {
  return new Promise((ok, no) => {
    const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => {
      const r = W / H, sw = Math.min(img.width, img.height * r), sh = sw / r, c = document.createElement('canvas'), ctx = c.getContext('2d');
      let scale = 1, q = quality, data = '';
      for (let attempt = 0; attempt < 12; attempt++) {
        c.width = Math.max(1, Math.round(W * scale)); c.height = Math.max(1, Math.round(H * scale));
        ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, 0, 0, c.width, c.height);
        data = c.toDataURL('image/jpeg', q);
        if (!maxLength || data.length <= maxLength) break;
        if (q > .5) q = Math.max(.5, q - .1); else scale *= .85;
      }
      URL.revokeObjectURL(url);
      if (maxLength && data.length > maxLength) return no(new Error('Görsel boyutu çok büyük. Daha küçük bir görsel seç.'));
      ok(data);
    };
    img.onerror = () => { URL.revokeObjectURL(url); no(new Error('Resim okunamadı.')); }; img.src = url;
  });
}
const setBanner = (root, u) => {
  const b = $('.banner', root);
  if (b) b.style.backgroundImage = u.banner ? `linear-gradient(110deg,rgba(10,15,30,.08),rgba(10,15,30,.34)),url('${u.banner}')` : '';
};
const profCard = u => `<div class="banner"></div><div class="pbody"><div class="profile-avatar-wrap">${av(u, 'xl pav')}</div><h2>${esc(u.displayName)}${profileTag(u)}</h2><small>@${esc(u.username)} · ${PRESENCE_LABELS[u.presence] || (u.online ? 'Çevrimiçi' : 'Çevrimdışı')}</small>${badgeRow(u)}<p class="bio">${u.bio ? esc(u.bio) : '<i>Henüz bir şey yazılmamış.</i>'}</p><div class="stats"><div><b>${u.friendCount}</b><span>Arkadaş</span></div><div><b>${new Date(u.createdAt).toLocaleDateString(localeValue())}</b><span>Katılım</span></div></div></div>`;
function closeProfileTagPopup() {
  document.querySelectorAll('.profile-guild-tag-menu,.server-tag-preview-popover').forEach(popup => popup.remove());
  document.querySelectorAll('[data-profile-tag-action][aria-expanded="true"]').forEach(button => button.setAttribute('aria-expanded', 'false'));
}
function positionProfileTagPopup(popup, trigger) {
  const rect = trigger.getBoundingClientRect(), width = Math.min(350, innerWidth - 24);
  popup.style.width = `${width}px`;
  popup.style.left = `${Math.max(12, Math.min(rect.left, innerWidth - width - 12))}px`;
  popup.style.top = `${Math.max(12, Math.min(rect.bottom + 8, innerHeight - popup.offsetHeight - 12))}px`;
}
function profileTagServerRow(server, selectedId) {
  const selected = Number(server.id) === Number(selectedId);
  const icon = server.icon ? `<img src="${esc(server.icon)}" alt="">` : esc([...server.name][0]?.toUpperCase() || '?');
  return `<button type="button" data-profile-tag-select="${server.id}" aria-pressed="${selected}"><i>${icon}</i><span><b>${esc(server.name)}</b><small><span class="guild-tag-chip"><i>${serverTagBadgeIcon(server.serverTag.badge)}</i><b>${esc(server.serverTag.tag)}</b></span></small></span><em>${selected ? '✓' : '›'}</em></button>`;
}
async function openProfileTagPicker(trigger) {
  closeProfileTagPopup();
  trigger.setAttribute('aria-expanded', 'true');
  const popup = document.createElement('section');
  popup.className = 'profile-guild-tag-menu';
  popup.setAttribute('role', 'dialog'); popup.setAttribute('aria-label', 'Profil sunucu etiketini seç');
  popup.innerHTML = '<label class="profile-tag-menu-search"><span>⌕</span><input type="search" placeholder="Sunucu ara" autocomplete="off"></label><small>SUNUCU ETİKETİ SEÇ</small><div class="profile-tag-menu-options"><p>Sunucular yükleniyor…</p></div><button type="button" class="profile-guild-tag-clear" data-profile-tag-clear>Etiketi kaldır</button>';
  document.body.append(popup); positionProfileTagPopup(popup, trigger);
  try {
    const servers = (await api('/servers')).filter(server => server.serverTag?.enabled && server.serverTag.tag);
    if (!popup.isConnected) return;
    const options = $('.profile-tag-menu-options', popup), search = $('input', popup);
    const draw = () => {
      const q = search.value.trim().toLocaleLowerCase('tr');
      const visible = servers.filter(server => `${server.name} ${server.serverTag.tag}`.toLocaleLowerCase('tr').includes(q));
      options.innerHTML = visible.map(server => profileTagServerRow(server, me.guildTag?.serverId)).join('') || '<p>Bu aramayla eşleşen sunucu etiketi yok.</p>';
      positionProfileTagPopup(popup, trigger);
    };
    search.oninput = draw;
    draw();
    search.focus();
  } catch (er) {
    if (popup.isConnected) $('.profile-tag-menu-options', popup).innerHTML = `<p>Etiketler yüklenemedi: ${esc(er.message)}</p>`;
  }
}
async function openServerTagPreview(trigger) {
  closeProfileTagPopup();
  trigger.setAttribute('aria-expanded', 'true');
  const popup = document.createElement('section');
  popup.className = 'server-tag-preview-popover';
  popup.setAttribute('role', 'dialog'); popup.setAttribute('aria-label', 'Sunucu bilgisi');
  popup.innerHTML = '<p class="server-tag-preview-loading">Sunucu bilgisi yükleniyor…</p>';
  document.body.append(popup); positionProfileTagPopup(popup, trigger);
  try {
    const server = await api(`/server-tags/${Number(trigger.dataset.serverId)}/preview`);
    if (!popup.isConnected) return;
    const icon = server.icon ? `<img src="${esc(server.icon)}" alt="">` : `<i>${esc([...server.name][0]?.toUpperCase() || '?')}</i>`;
    const banner = server.banner ? ` style="background-image:linear-gradient(90deg,#0d1220aa,#0d122033),url('${esc(server.banner)}')"` : '';
    popup.innerHTML = `<div class="server-tag-preview-banner"${banner}></div><div class="server-tag-preview-body"><div class="server-tag-preview-icon">${icon}</div><h3>${esc(server.name)} <span class="guild-tag-chip"><i>${serverTagBadgeIcon(server.serverTag.badge)}</i><b>${esc(server.serverTag.tag)}</b></span></h3><p><i></i>${Number(server.onlineCount).toLocaleString(localeValue())} çevrim içi <span>·</span> ${Number(server.memberCount).toLocaleString(localeValue())} üye</p><small>Oluşturulma: ${new Date(server.createdAt).toLocaleDateString(localeValue(), { month: 'short', year: 'numeric' })}</small><small>Sahibi: ${esc(server.owner)}</small></div>`;
    positionProfileTagPopup(popup, trigger);
  } catch (er) {
    if (popup.isConnected) popup.innerHTML = `<p class="server-tag-preview-loading">${esc(er.message)}</p>`;
  }
}
document.addEventListener('click', async event => {
  const tagAction = event.target.closest('[data-profile-tag-action]');
  if (tagAction) {
    event.preventDefault();
    event.stopPropagation();
    const current = $('.profile-guild-tag-menu,.server-tag-preview-popover');
    if (current && tagAction.getAttribute('aria-expanded') === 'true') { closeProfileTagPopup(); return; }
    if (tagAction.dataset.profileTagAction === 'pick') await openProfileTagPicker(tagAction);
    else await openServerTagPreview(tagAction);
    return;
  }
  const choice = event.target.closest('[data-profile-tag-select],[data-profile-tag-clear]');
  if (choice) {
    const serverId = choice.hasAttribute('data-profile-tag-clear') ? null : Number(choice.dataset.profileTagSelect);
    choice.disabled = true;
    try {
      const result = await api('/users/me/server-tag', 'PUT', { serverId });
      me.guildTag = result.guildTag; guilds = await api('/servers').catch(() => guilds);
      await loadFriends().catch(() => {});
      closeProfileTagPopup();
      if (guildMode && currentGuildId) await reloadGuild(currentGuildId);
      else if (view === 'chat' && active) await openChat(active, true);
      else if (view === 'profile') renderMain();
      else { renderSide(); renderServerRail(); }
      if (profId) profileModal(profId, true);
      toast(serverId ? 'Profil etiketi güncellendi.' : 'Profil etiketi kaldırıldı.');
    } catch (er) { toast(er.message, 1); choice.disabled = false; }
    return;
  }
  if (!event.target.closest('.profile-guild-tag-menu,.server-tag-preview-popover')) closeProfileTagPopup();
});
document.addEventListener('keydown', event => { if (event.key === 'Escape') closeProfileTagPopup(); });
async function profileModal(id, quiet) {
  let u;
  try { u = await api('/users/' + id); } catch (er) { if (quiet) { $('.pm')?.__closeProfile?.(); $('.pm')?.remove(); profId = null; return; } return toast(er.message, 1); }
  const self = Number(u.id) === Number(me.id);
  $('.pm')?.__closeProfile?.(); $('.pm')?.remove(); profId = id;
  const m = document.createElement('div'); m.className = 'modal pm' + (quiet ? '' : ' fade');
  const sharedFriends = u.mutualFriends || [], sharedServers = u.mutualServers || [];
  const action = self ? '<button class="btn primary" data-profile-edit>Profili düzenle</button>' : u.blocked ? '<button class="btn" disabled>Engelli</button>' : `${u.isFriend ? '' : '<button class="btn primary" data-profile-friend>Arkadaş ekle</button>'}<button class="btn" data-profile-message>Mesaj gönder</button>`;
  const joinedDate = new Date(u.createdAt).toLocaleDateString(localeValue(), { day: 'numeric', month: 'long', year: 'numeric' });
  const presence = PRESENCE_LABELS[u.presence] || (u.online ? 'Çevrimiçi' : 'Çevrimdışı');
  const activityPanel = () => `<div class="profile-detail-intro"><small>PROFİL ÖZETİ</small><h3>Ortak noktalarınız</h3><p>Durum ve birlikte bulunduğunuz alanlar.</p></div>
    <div class="profile-now-card"><div class="profile-now-head"><small>ŞU ANDA</small><span class="profile-presence"><i class="dot ${u.presence || 'offline'}"></i>${esc(presence)}</span></div><div class="profile-activity"><span>${av(u, 'xl')}</span><div><b>${esc(u.displayName)}</b><p>${u.online ? 'Aven’de çevrimiçi' : 'Şu anda çevrimdışı'}</p></div><span class="profile-now-mark ${u.online ? (u.presence || 'online') : 'offline'}"></span></div></div>
    <div class="profile-connection-grid"><div><small>ORTAK ARKADAŞ</small><b>${sharedFriends.length}</b><span>${sharedFriends.length ? 'Birlikte tanıdığınız kişi' : 'Henüz ortak arkadaş yok'}</span></div><div><small>ORTAK SUNUCU</small><b>${sharedServers.length}</b><span>${sharedServers.length ? 'Birlikte bulunduğunuz yer' : 'Henüz ortak sunucu yok'}</span></div></div>
    <div class="profile-joined"><small>AVEN’E KATILDI</small><b>${joinedDate}</b></div>${privateNoteCard(u.note)}
    <div class="profile-shared-preview"><div><small>ORTAK SUNUCULAR</small><button data-profile-tab="servers">Tümünü gör <i>›</i></button></div>${sharedServers.length ? sharedServers.slice(0, 3).map(server => `<span class="profile-server-chip">${server.icon ? `<img src="${esc(server.icon)}" alt="">` : `<i>${esc([...server.name][0]?.toUpperCase() || '?')}</i>`}<b>${esc(server.name)}</b></span>`).join('') : '<p>Henüz ortak sunucunuz yok.</p>'}</div>`;
  m.innerHTML = `<section class="profile-sheet${quiet ? '' : ' pop'}"><button class="icon profile-close" data-profile-close aria-label="Kapat">×</button><aside class="profile-overview"><div class="profile-banner banner"></div><div class="profile-hero"><div class="profile-avatar-wrap">${av(u, 'xl pav')}</div><h2>${esc(u.displayName)}${profileTag(u)}</h2><p>@${esc(u.username)}</p>${badgeRow(u)}<span class="profile-presence"><i class="dot ${u.presence || 'offline'}"></i>${esc(presence)}</span><div class="profile-actions">${action}</div></div><div class="profile-about"><small>HAKKINDA</small><p>${u.bio ? esc(u.bio) : '<i>Henüz bir şey yazılmamış.</i>'}</p></div><div class="profile-stats"><div><b>${u.friendCount || 0}</b><small>Arkadaş</small></div><div><b>${new Date(u.createdAt).toLocaleDateString(localeValue(),{day:'2-digit',month:'short',year:'numeric'})}</b><small>Katılım</small></div></div></aside><section class="profile-detail"><nav class="profile-tabs"><button data-profile-tab="activity" class="on">Genel bakış</button><button data-profile-tab="friends">Ortak arkadaşlar <i>${sharedFriends.length}</i></button><button data-profile-tab="servers">Ortak sunucular <i>${sharedServers.length}</i></button></nav><div class="profile-tab-content" data-profile-content>${activityPanel()}</div></section></section>`;
  if (u.bot) {
    $('[data-profile-tab="friends"]', m)?.remove();
    $('[data-profile-tab="servers"]', m)?.remove();
    $('.profile-connection-grid', m)?.remove();
    $('.profile-shared-preview', m)?.remove();
    $('.profile-detail-intro h3', m).textContent = 'Profil etkinliği';
    $('.profile-detail-intro p', m).textContent = 'Aven resmi hesabı.';
  }
  setBanner(m, u);
  m.onclick = async e => {
    if (e.target === m || e.target.closest('[data-profile-close]')) { closeProfile(); return; }
    const tabButton = e.target.closest('[data-profile-tab]');
    if (tabButton) {
      m.querySelectorAll('.profile-tabs [data-profile-tab]').forEach(button => button.classList.toggle('on', button.dataset.profileTab === tabButton.dataset.profileTab));
      const pane = $('[data-profile-content]', m), key = tabButton.dataset.profileTab;
      pane.innerHTML = key === 'activity'
        ? activityPanel()
        : key === 'friends' ? (sharedFriends.length ? sharedFriends.map(friend => `<button class="profile-shared-row" data-profile-user="${friend.id}">${av(friend)}<span><b>${esc(friend.displayName)}</b><small>@${esc(friend.username)}</small></span><i>›</i></button>`).join('') : '<div class="profile-empty">Ortak arkadaşınız yok.</div>')
          : (sharedServers.length ? sharedServers.map(server => `<div class="profile-shared-row">${server.icon ? `<img src="${esc(server.icon)}" alt="">` : `<span class="profile-server-icon">${esc([...server.name][0]?.toUpperCase() || '?')}</span>`}<span><b>${esc(server.name)}</b><small>Ortak sunucu</small></span></div>`).join('') : '<div class="profile-empty">Ortak sunucunuz yok.</div>');
      return;
    }
    const shared = e.target.closest('[data-profile-user]');
    if (shared) return profileModal(Number(shared.dataset.profileUser));
    if (e.target.closest('[data-profile-edit]')) { closeProfile(); stab = 'profile'; setView('settings'); }
    if (e.target.closest('[data-profile-friend]')) {
      const button = $('[data-profile-friend]', m); button.disabled = true;
      try { await api('/friends/request', 'POST', { username: u.username }); await loadFriends(); toast('Arkadaşlık isteği gönderildi.'); }
      catch (er) { toast(er.message, 1); button.disabled = false; }
    }
    if (e.target.closest('[data-profile-message]')) openDirectMessage(u.id);
  };
  const key = e => { if (e.key === 'Escape' && m.isConnected) closeProfile(); };
  const closeProfile = () => { m.remove(); profId = null; document.removeEventListener('keydown', key); };
  m.__closeProfile = closeProfile;
  document.addEventListener('keydown', key); document.body.append(m);
}
async function loadBlocks() {
  const el = $('#bl'); if (!el) return;
  const l = await api('/blocks').catch(() => []);
  el.previousElementSibling.textContent = `Engellenenler (${l.length})`;
  el.innerHTML = l.map(u => `<div class="item">${av(u)}<div class="t"><b>${esc(u.displayName)}</b><small>@${esc(u.username)}</small></div><button class="btn sm" data-ub="${u.id}">Engeli kaldır</button></div>`).join('') || '<small>Kimseyi engellemedin.</small>';
  el.onclick = async e => { const b = e.target.closest('[data-ub]'); if (b) { try { await api('/blocks/' + b.dataset.ub, 'DELETE'); toast('Engel kaldırıldı'); loadBlocks(); } catch (er) { toast(er.message, 1); } } };
}

/* ---------- Arkadaş ekle ---------- */
function addModal() {
  const m = document.createElement('div'); m.className = 'modal fade';
  m.innerHTML = `<section class="friend-dialog pop"><aside class="friend-dialog-nav"><small>ARKADAŞLAR</small><button class="on" data-add-tab="add">Arkadaş ekle <i>＋</i></button><button data-add-tab="pending">Bekleyen istekler <i>${fr.incoming.length}</i></button><div class="friend-dialog-tip"><b>Birlikte sohbet edin</b><p>Kullanıcı adını yazarak arkadaşlık isteği gönder. Kabul edilince DM listenize eklenir.</p></div></aside><section class="friend-dialog-content"><header><div><small>AVEN · SOSYAL</small><h2 data-add-title>Arkadaş ekle</h2><p data-add-description>Arkadaşlarını kullanıcı adlarıyla bul.</p></div><button class="icon" data-add-close aria-label="Kapat">×</button></header><div class="friend-add-pane"><label class="friend-search"><span>⌕</span><input placeholder="Kullanıcı adı gir" autocomplete="off"><button class="btn primary" data-add-send disabled>İstek gönder</button></label><div class="friend-add-note">Arkadaş olunca sohbetleriniz iki tarafta da görünür.</div><div class="res"></div></div><div class="friend-pending-pane" hidden></div></section></section>`;
  document.body.append(m);
  const input = $('input', m), res = $('.res', m), send = $('[data-add-send]', m);
  let timer, pendingSearch = null;
  const close = () => { clearTimeout(timer); pendingSearch?.abort(); m.remove(); document.removeEventListener('keydown', esc2); }, esc2 = e => e.key === 'Escape' && close();
  document.addEventListener('keydown', esc2); m.onclick = e => { if (e.target === m || e.target.closest('[data-add-close]')) close(); };
  const labels = { friend: 'Arkadaşsınız', sent: 'İstek gönderildi' };
  const showPending = () => {
    const pending = $('.friend-pending-pane', m);
    pending.innerHTML = [...fr.incoming.map(u => `<article class="friend-request-row">${av(u, 'friend-request-avatar')}<span class="friend-request-person"><b>${esc(u.displayName)}</b><small>@${esc(u.username)}</small></span><div class="friend-request-actions"><button class="btn sm" data-request="decline" data-id="${u.fid}" aria-label="Reddet" title="Reddet">${DM_CALL_ICONS.reject}</button><button class="btn sm primary" data-request="accept" data-id="${u.fid}" aria-label="Kabul et" title="Kabul et">${DM_CALL_ICONS.accept}</button></div></article>`), ...fr.outgoing.map(u => `<article class="friend-request-row outgoing">${av(u, 'friend-request-avatar')}<span class="friend-request-person"><b>${esc(u.displayName)}</b><small>İstek gönderildi · @${esc(u.username)}</small></span><i>Bekliyor</i></article>`)].join('') || '<div class="empty">Bekleyen isteğin yok.</div>';
  };
  const showTab = tabName => {
    m.querySelectorAll('[data-add-tab]').forEach(button => button.classList.toggle('on', button.dataset.addTab === tabName));
    $('.friend-add-pane', m).hidden = tabName !== 'add'; $('.friend-pending-pane', m).hidden = tabName !== 'pending';
    $('[data-add-title]', m).textContent = tabName === 'add' ? 'Arkadaş ekle' : 'Bekleyen istekler';
    $('[data-add-description]', m).textContent = tabName === 'add' ? 'Arkadaşlarını kullanıcı adlarıyla bul.' : 'Gelen istekleri onayla veya reddet.';
    if (tabName === 'pending') showPending(); else input.focus();
  };
  m.querySelectorAll('[data-add-tab]').forEach(button => button.onclick = () => showTab(button.dataset.addTab));
  async function search() {
    const q = input.value.trim();
    if (q.length < 2) { res.innerHTML = q ? '<div class="empty">Aramak için en az 2 karakter yaz.</div>' : ''; return; }
    pendingSearch?.abort();
    const controller = pendingSearch = new AbortController();
    res.innerHTML = '<div class="empty">Kullanıcılar aranıyor…</div>';
    try {
      const list = await api('/users/search?q=' + encodeURIComponent(q), 'GET', undefined, controller.signal);
      if (input.value.trim() !== q || controller.signal.aborted) return;
      const exact = list.find(u => u.username.toLowerCase() === q.replace(/^@/, '').toLowerCase());
      send.disabled = !q || ['friend', 'sent'].includes(exact?.rel);
      res.innerHTML = list.map(u => `<div class="item" data-search-profile="${u.id}">${av(u)}<div class="t"><b>${esc(u.displayName)}</b><small>@${esc(u.username)}</small></div>${labels[u.rel] ? `<small>${labels[u.rel]}</small>` : `<button class="btn sm primary" data-u="${esc(u.username)}">${u.rel === 'received' ? 'Kabul et' : 'Ekle'}</button>`}</div>`).join('') || '<div class="empty">Kullanıcı bulunamadı.</div>';
    } catch (er) {
      if (er.name !== 'AbortError' && input.value.trim() === q) res.innerHTML = `<div class="empty">${esc(er.message)}</div>`;
    } finally { if (pendingSearch === controller) pendingSearch = null; }
  }
  input.oninput = () => { send.disabled = !input.value.trim(); pendingSearch?.abort(); clearTimeout(timer); timer = setTimeout(search, 350); };
  send.onclick = async () => { const q = input.value.trim().replace(/^@/, ''); if (!q) return; send.disabled = true; try { await api('/friends/request', 'POST', { username: q }); toast('Arkadaşlık isteği gönderildi.'); await loadFriends(); await refreshNotifications(); input.value = ''; res.innerHTML = ''; } catch (er) { toast(er.message, 1); send.disabled = false; } };
  res.onclick = async e => {
    const b = e.target.closest('[data-u]');
    if (b) { b.disabled = true; try { await api('/friends/request', 'POST', { username: b.dataset.u }); toast('İstek gönderildi'); await loadFriends(); search(); } catch (er) { toast(er.message, 1); b.disabled = false; } return; }
    const profile = e.target.closest('[data-search-profile]'); if (profile) profileModal(Number(profile.dataset.searchProfile));
  };
  $('.friend-pending-pane', m).onclick = async e => { const b = e.target.closest('[data-request]'); if (!b) return; b.disabled = true; try { await api(`/friends/${b.dataset.id}/${b.dataset.request}`, 'POST'); await loadFriends(); await refreshNotifications(); showPending(); } catch (er) { toast(er.message, 1); b.disabled = false; } };
  input.focus();
}

const startRoute = readAppRoute() || { kind: 'home' };
const startRouteMode = location.pathname === appRoutePath(startRoute) && !location.search && !location.hash ? 'none' : 'replace';
let initialPath = location.pathname;
try { initialPath = decodeURIComponent(initialPath); } catch {}
if (location.hash === '#topluluk-kurallari') communityRulesScreen();
else if (['/hakkında', '/hakkinda'].includes(initialPath.replace(/\/$/, '').toLocaleLowerCase('tr'))) aboutPublicScreen();
else api('/me').then(u => { me = u; return boot(false, undefined, startRoute, startRouteMode); }).catch(er => {
  if (er.code === 'ACCOUNT_BANNED') return showBannedScreen(er.message);
  if (location.pathname === '/') return introScreen();
  api('/accounts').then(accounts => authScreen(accounts.length === 0)).catch(error => { if (error.code === 'ACCOUNT_BANNED') showBannedScreen(error.message); else { toast(error.message, 1); authScreen(true); } });
});
