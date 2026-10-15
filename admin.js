'use strict';
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const date=v=>v?new Date(Number(v)).toLocaleString('tr-TR',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}):'—';
const day=v=>v?new Date(Number(v)).toLocaleDateString('tr-TR',{day:'2-digit',month:'short',year:'numeric'}):'—';
const stateLabel={open:'Açık',answered:'Yanıtlandı',closed:'Kapalı'};
let currentPage='overview', currentTicket=null, filter='open', users=[], servers=[], ticketRows=[], announcements=[], pollTimer=null, searchTimer=null;
async function api(path,method='GET',body){const r=await fetch('/api/admin'+path,{method,headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined,credentials:'same-origin'});const d=await r.json().catch(()=>({}));if(!r.ok){const message=r.status===404&&method==='POST'&&path==='/announcements'?'Duyuru gönderme API rotası sunucuda bulunamadı. Aven sunucusunu yeniden başlatın.':d.error||'İstek tamamlanamadı.';const e=new Error(message);e.status=r.status;throw e;}return d;}
function toast(message,error=false){const el=document.createElement('div');el.className='toast'+(error?' error':'');el.textContent=message;$('#toast-region').append(el);setTimeout(()=>el.remove(),3200);}
function showLogin(message=''){$('#login-screen').hidden=false;$('#admin-app').hidden=true;$('#login-error').textContent=message;clearInterval(pollTimer);}
function showApp(name){$('#login-screen').hidden=true;$('#admin-app').hidden=false;$('#admin-name').textContent=name||'Yönetici';$('#today-label').textContent=new Date().toLocaleDateString('tr-TR',{weekday:'short',day:'2-digit',month:'short'});navigate('overview');refreshAll().catch(e=>toast(e.message,true));clearInterval(pollTimer);pollTimer=setInterval(()=>{if(document.hidden)return;refreshOverview().catch(()=>{});loadTicketList().then(()=>{if(currentTicket&&currentPage==='support')return refreshSelectedTicket();}).catch(()=>{});if(currentPage==='users')loadUsers().catch(()=>{});if(currentPage==='servers')loadServers().catch(()=>{});},20000);}
function navigate(page,refresh=true){currentPage=page;$$('.nav-item').forEach(b=>b.classList.toggle('active',b.dataset.page===page));$$('.page-section').forEach(s=>s.classList.toggle('active',s.id==='page-'+page));const title={overview:'Genel Bakış',users:'Kullanıcılar',servers:'Sunucular',support:'Destek',announcements:'Duyurular'}[page]||'Genel Bakış';$('#page-title').textContent=title;$('#page-crumb').textContent=title;if(!refresh)return;if(page==='overview')refreshOverview().catch(e=>toast(e.message,true));if(page==='users')loadUsers().catch(e=>toast(e.message,true));if(page==='servers')loadServers().catch(e=>toast(e.message,true));if(page==='support')loadTicketList().catch(e=>toast(e.message,true));if(page==='announcements')loadAnnouncements().catch(e=>toast(e.message,true));}
async function refreshAll(){await Promise.all([refreshOverview(),loadTicketList()]);}
async function refreshOverview(){const d=await api('/overview');$('#stat-users').textContent=Number(d.users).toLocaleString('tr-TR');$('#stat-online').textContent=Number(d.onlineUsers).toLocaleString('tr-TR');$('#stat-servers').textContent=Number(d.servers).toLocaleString('tr-TR');$('#stat-tickets').textContent=Number(d.openTickets).toLocaleString('tr-TR');$('#nav-user-count').textContent=Number(d.users).toLocaleString('tr-TR');renderOverviewUsers(d.activeUsers||[]);renderOverviewTickets(d.recentTickets||[]);}
const setHTML=(el,html)=>{if(el.__h===html)return;el.__h=html;el.innerHTML=html;};
const initial=v=>esc((v||'?').slice(0,1).toUpperCase());
const verifiedServerBadge=()=>`<span class="verified-server-badge" title="Doğrulanmış Sunucu" role="img" aria-label="Doğrulanmış Sunucu"><img src="/sunucurozet/${encodeURIComponent('doğrulanmış_sunucu.png')}" alt="" aria-hidden="true"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="m3.5 8.2 2.8 2.7 6.2-6.1"/></svg></span>`;
function renderOverviewUsers(list){
  const box=$('#overview-users');
  if(!list.length){setHTML(box,'<div class="empty-list">Şu anda görünür aktif kullanıcı yok.</div>');return;}
  setHTML(box,list.slice(0,5).map((u,i)=>`<div class="compact-user" style="animation-delay:${i*35}ms"><span class="user-initial">${initial(u.displayName||u.username)}</span><span class="user-identity"><b>${esc(u.displayName)}</b><small>@${esc(u.username)}</small></span><span class="status-pill"><i></i>${esc(u.presenceLabel||'Çevrimiçi')}</span></div>`).join(''));
}
function renderOverviewTickets(list){
  const box=$('#overview-tickets');
  if(!list.length){setHTML(box,'<div class="empty-list">Henüz açık destek talebi yok.</div>');return;}
  setHTML(box,list.slice(0,4).map((t,i)=>`<div class="ticket-preview" data-open-ticket="${Number(t.id)}" style="animation-delay:${i*35}ms"><span>${t.kind==='appeal'?'⚑':'✳'}</span><div><b>${esc(t.subject)}</b><small>${esc(t.displayName)} · ${esc(t.email)}</small></div><time>${esc(date(t.updatedAt))}</time></div>`).join(''));
}
async function loadUsers(){
  const q=$('#user-search').value.trim(),d=await api('/users'+(q?'?q='+encodeURIComponent(q):''));
  users=d.users||[];
  $('#users-total-label').textContent='('+d.total+')';
  const body=$('#users-table');
  if(!users.length){setHTML(body,'<tr><td colspan="5" class="empty-cell">Eşleşen kullanıcı bulunamadı.</td></tr>');return;}
  setHTML(body,users.map(u=>`<tr data-user-id="${Number(u.id)}" class="${u.banned?'is-banned':''}"><td><div class="table-user"><span class="user-initial">${initial(u.displayName||u.username)}</span><span><b>${esc(u.displayName)}</b><small>@${esc(u.username)}</small></span></div></td><td class="table-email">${esc(u.email)}</td><td>${u.online?`<span class="status-pill"><i></i>${esc(u.presenceLabel||'Çevrimiçi')}</span>`:'<span class="status-pill offline"><i></i>Çevrimdışı</span>'}</td><td>${esc(day(u.createdAt))}</td><td>${u.banned?'<span class="status-pill banned"><i></i>Banlı</span>':'<span class="local-ip">Aktif</span>'}</td></tr>`).join(''));
}
async function loadServers(){
  const d=await api('/servers');
  servers=d.servers||[];
  $('#servers-total-label').textContent='('+servers.length+')';
  const box=$('#servers-list');
  if(!servers.length){setHTML(box,'<div class="empty-list">Henüz sunucu oluşturulmamış.</div>');return;}
  setHTML(box,servers.map((s,i)=>`<article class="server-card" data-server-id="${Number(s.id)}" style="animation-delay:${i*30}ms"><div class="server-top"><span class="server-icon">${initial(s.name)}</span><div><b class="server-card-name">${esc(s.name)}${s.verified?verifiedServerBadge():''}</b><small>Sahibi: ${esc(s.ownerDisplayName)} · ${esc(day(s.createdAt))}</small></div><span class="status-pill${s.verified?' verified-server-status':''}"><i></i>${s.verified?'Doğrulanmış':'Açık'}</span></div><div class="server-stats"><span><b>${Number(s.memberCount).toLocaleString('tr-TR')}</b> üye</span><span><b>${Number(s.onlineCount).toLocaleString('tr-TR')}</b> aktif üye</span><span><b>${Number(s.channelCount).toLocaleString('tr-TR')}</b> kanal</span></div></article>`).join(''));
}
const announcementLocales={tr:'Türkçe',en:'English',de:'Deutsch'};
function renderAnnouncementArchive(){
  const box=$('#admin-announcement-list');
  $('#announcements-total-label').textContent=`(${announcements.length})`;
  if(!announcements.length){setHTML(box,'<div class="empty-list">Henüz duyuru yayımlanmamış. Yeni duyuru oluşturmak için ＋ düğmesine basın.</div>');return;}
  setHTML(box,announcements.map(item=>{
    const source=item.translations?.tr||{title:item.title,body:item.body,links:[]};
    const languageBlocks=Object.entries(item.translations||{}).map(([locale,translation])=>`<section class="announcement-language"><span>${esc(announcementLocales[locale]||locale)}</span><div><b>${esc(translation.title)}</b><p>${esc(translation.body)}</p>${(translation.links||[]).map(link=>`<a href="${esc(link.url)}" target="_blank" rel="noopener noreferrer">${esc(link.label)} · ${esc(link.url)}</a>`).join('')}</div></section>`).join('');
    return `<article class="admin-announcement-card"><header><span class="announcement-card-icon">◉</span><div><h4>${esc(source.title)}</h4><small>Türkçe · ${esc(date(item.createdAt))} · ${esc(item.createdBy)}</small></div><span class="announcement-live">Yayımlandı</span></header><p class="announcement-archive-copy">${esc(source.body)}</p>${source.links?.length?`<div class="announcement-card-links">${source.links.map(link=>`<a href="${esc(link.url)}" target="_blank" rel="noopener noreferrer">${esc(link.label)} ↗</a>`).join('')}</div>`:''}<details><summary>Çeviriler ve bağlantı kayıtları</summary><div class="announcement-language-list">${languageBlocks}</div></details></article>`;
  }).join(''));
}
async function loadAnnouncements(){announcements=await api('/announcements');renderAnnouncementArchive();}
function openAnnouncementComposer(){
  if($('.announcement-compose-overlay'))return;
  const overlay=document.createElement('div');overlay.className='announcement-compose-overlay';
  overlay.innerHTML=`<form class="announcement-compose" role="dialog" aria-modal="true" aria-labelledby="announcement-compose-title"><header><span class="announcement-compose-mark">◉</span><div><small>AVEN · TOPLULUK BİLDİRİMİ</small><h2 id="announcement-compose-title">Yeni duyuru</h2></div><button type="button" class="announcement-compose-close" aria-label="Kapat">×</button></header><p class="announcement-compose-note">Duyuru Türkçe yazılır ve her kullanıcıya hesap ayarındaki dilde otomatik çevrilerek iletilir.</p><label>Başlık<input name="title" maxlength="100" required placeholder="Kısa duyuru başlığı"></label><label>Duyuru metni<textarea name="body" rows="5" maxlength="1800" required placeholder="Duyurunun içeriğini yaz…"></textarea><small>En fazla 1800 karakter</small></label><div class="announcement-link-fields"><p>İsteğe bağlı yönlendirmeler <small>Bağlantı boş bırakılırsa duyuruda görünmez.</small></p>${[1,2].map(index=>`<fieldset><legend>Bağlantı ${index}</legend><label>Buton yazısı<input name="link${index}Label" maxlength="60" placeholder="Örn. Etkinliğe katıl"></label><label>Site adresi<input name="link${index}Url" type="url" maxlength="500" placeholder="https://…"></label></fieldset>`).join('')}</div><label>Gönderme şifresi<input name="password" type="password" required autocomplete="off" placeholder="Şifreyi gir"></label><p class="announcement-compose-error" aria-live="polite"></p><footer><button type="button" class="button" data-compose-cancel>Vazgeç</button><button type="submit" class="button primary announcement-publish">Gönder</button></footer></form>`;
  document.body.append(overlay);const form=$('form',overlay);let escape=null;const close=()=>{overlay.remove();if(escape)document.removeEventListener('keydown',escape);};
  $('.announcement-compose-close',overlay).onclick=close; $('[data-compose-cancel]',overlay).onclick=close;
  overlay.addEventListener('mousedown',event=>{if(event.target===overlay)close();});
  escape=event=>{if(event.key==='Escape')close();};document.addEventListener('keydown',escape);
  form.onsubmit=async event=>{
    event.preventDefault();const button=$('.announcement-publish',form),error=$('.announcement-compose-error',form);button.disabled=true;error.textContent='';button.textContent='Gönderiliyor…';
    const payload=Object.fromEntries(new FormData(form).entries());
    try{const created=await api('/announcements','POST',payload);announcements=[created,...announcements];renderAnnouncementArchive();close();navigate('announcements',false);toast('Duyuru tüm kullanıcılara yayımlandı.');}
    catch(er){error.textContent=er.message;button.disabled=false;button.textContent='Gönder';}
  };
}
async function loadTicketList(){
  const d=await api('/support/tickets?status='+encodeURIComponent(filter));
  ticketRows=d.tickets||[];
  const open=ticketRows.filter(t=>t.status!=='closed').length;
  $('#nav-ticket-count').textContent=String(open);$('#support-open-count').textContent=String(open);
  renderTicketList();
}
function renderTicketList(){
  const box=$('#admin-ticket-list');
  if(!ticketRows.length){setHTML(box,'<div class="empty-list">'+(filter==='open'?'Açık talep yok.':'Henüz destek talebi yok.')+'</div>');return;}
  setHTML(box,ticketRows.map((t,i)=>`<button class="admin-ticket${currentTicket===Number(t.id)?' selected':''}" data-ticket-id="${Number(t.id)}" style="animation-delay:${i*22}ms"><span class="admin-ticket-row"><b>${esc(t.subject)}</b><span class="ticket-status ${esc(t.status)}">${esc(stateLabel[t.status]||t.status)}</span></span><small>${t.kind==='appeal'?'<span class="kind-badge">BAN İTİRAZI</span> ':''}${esc(t.displayName)} · ${esc(t.email)}</small><small>${esc(t.lastMessage||'Henüz mesaj yok')}</small><span class="admin-ticket-meta"><span>#${Number(t.id)} · ${Number(t.messageCount)} mesaj</span><time>${esc(date(t.updatedAt))}</time></span></button>`).join(''));
}
async function openTicket(id){
  currentTicket=Number(id);renderTicketList();
  const data=await api('/support/tickets/'+currentTicket);
  renderAdminThread(data);
}
let threadSig='';
function renderAdminThread(data,keepBottom=false){
  const box=$('#admin-thread'),t=data.ticket,messages=data.messages||[];
  threadSig=`${t.id}:${t.status}:${messages.length}:${t.updatedAt}`;
  const old=$('.thread-messages',box),wasBottom=old?old.scrollHeight-old.scrollTop-old.clientHeight<65:true;
  const sameTicket=box.dataset.ticket===String(t.id),draft=sameTicket?($('#admin-reply-form [name=message]',box)?.value||''):'';
  box.dataset.ticket=String(t.id);
  const hasAdmin=messages.some(m=>m.authorType==='admin');const autoNote=t.status==='closed'?`<div class="appeal-banner auto"><b>Otomatik silinecek</b><span>Bu talep kapalı; ${esc(date(Number(t.closedAt||t.updatedAt)+3600000))} civarında silinecek. Silinmeden önce durumu değiştirerek yeniden açabilirsiniz.</span></div>`:(t.status==='open'&&!hasAdmin?`<div class="appeal-banner auto"><b>Yanıt bekliyor</b><span>Yanıt verilmezse bu talep ${esc(date(Number(t.createdAt)+86400000))} tarihinde otomatik silinir.</span></div>`:'');const appeal=autoNote+(t.kind==='appeal'?'<div class="appeal-banner"><b>Ban itirazı</b><span>Bu kullanıcı giriş yapamaz; yanıtınız e-posta ile gönderilir. Banı kaldırmak için Kullanıcılar sayfasında satıra sağ tıklayın.</span></div>':'');
  box.innerHTML=`<header class="thread-head"><div class="thread-person"><span class="user-initial">${initial(t.displayName)}</span><div><b>${esc(t.subject)}</b><small>${esc(t.displayName)} · ${esc(t.email)} · Talep #${Number(t.id)}</small></div></div><div class="thread-actions"><select id="ticket-status-select" aria-label="Talep durumu"><option value="open" ${t.status==='open'?'selected':''}>Açık</option><option value="answered" ${t.status==='answered'?'selected':''}>Yanıtlandı</option><option value="closed" ${t.status==='closed'?'selected':''}>Kapalı</option></select><button id="close-ticket-button">${t.status==='closed'?'Yeniden aç':'Kapat'}</button></div></header>${appeal}<div class="thread-messages">${messages.map(m=>`<article class="message ${m.authorType==='admin'?'admin':''}"><div class="message-meta"><b>${m.authorType==='admin'?'Aven Destek':esc(t.displayName)}</b><time>${esc(date(m.createdAt))}</time></div><div class="message-bubble">${esc(m.body)}</div></article>`).join('')||'<div class="empty-list">Bu talepte henüz mesaj yok.</div>'}</div>${t.status==='closed'?'<div class="empty-list">Bu talep kapalı. Silinmeden önce durumu değiştirerek tekrar açabilirsiniz.</div>':'<form id="admin-reply-form" class="reply-form"><textarea name="message" maxlength="4000" required placeholder="İsterseniz yanıt yazın (zorunlu değil)…" rows="1"></textarea><button type="submit">Yanıtla <span>→</span></button></form>'}`;
  const msgBox=$('.thread-messages',box);if(keepBottom||wasBottom)msgBox.scrollTop=msgBox.scrollHeight;
  const ta=$('#admin-reply-form [name=message]',box);if(ta&&draft)ta.value=draft;
  $('#ticket-status-select',box).onchange=async e=>{try{await api('/support/tickets/'+currentTicket,'PATCH',{status:e.target.value});await loadTicketList();await openTicket(currentTicket);toast('Talep durumu güncellendi.');}catch(er){toast(er.message,true);}};
  $('#close-ticket-button',box).onclick=async()=>{try{const status=t.status==='closed'?'open':'closed';await api('/support/tickets/'+currentTicket,'PATCH',{status});await loadTicketList();await openTicket(currentTicket);toast(status==='closed'?'Talep kapatıldı.':'Talep yeniden açıldı.');}catch(er){toast(er.message,true);}};
  $('#admin-reply-form',box)?.addEventListener('submit',async e=>{e.preventDefault();const form=e.currentTarget,button=$('button',form),message=$('[name=message]',form).value.trim();if(!message)return;button.disabled=true;try{const r=await api('/support/tickets/'+currentTicket+'/messages','POST',{message});await loadTicketList();await openTicket(currentTicket);toast(r.emailed?'Yanıt gönderildi; kullanıcıya e-posta da iletiliyor.':'Yanıt gönderildi.');}catch(er){toast(er.message,true);button.disabled=false;}});
}
async function refreshSelectedTicket(){
  if(!currentTicket)return;
  let data;try{data=await api('/support/tickets/'+currentTicket);}catch(er){if(er.status===404){currentTicket=null;threadSig='';const box=$('#admin-thread');box.dataset.ticket='';box.innerHTML='<div class="empty-list">Bu talep silindi (süresi doldu veya kapatıldı).</div>';renderTicketList();return;}throw er;}
  const sig=`${data.ticket.id}:${data.ticket.status}:${(data.messages||[]).length}:${data.ticket.updatedAt}`;
  if(sig!==threadSig)renderAdminThread(data,true);
}
// ---- Kullanıcılar: sağ tık ile ban / ban kaldır (banned.json otomatik güncellenir) ----
let ctxMenu=null;
function closeCtx(){if(ctxMenu){ctxMenu.remove();ctxMenu=null;}}
function openServerVerificationDialog(server){
  closeCtx();
  const verified=!server.verified,overlay=document.createElement('div');overlay.className='verify-overlay';
  overlay.innerHTML=`<form class="verify-modal" role="dialog" aria-modal="true" aria-labelledby="verify-title"><span class="verify-mark">${verified?'✓':'↶'}</span><h3 id="verify-title">${verified?'Sunucuyu doğrula':'Doğrulamayı kaldır'}</h3><p><b>${esc(server.name)}</b> ${verified?'sunucusuna Doğrulanmış Sunucu rozeti verilecek.':'sunucusunun doğrulanmış rozeti kaldırılacak.'}</p><label>Gönderme şifresi<input name="password" type="password" required autocomplete="off" placeholder="Şifreyi gir"></label><small class="verify-error" aria-live="polite"></small><footer><button type="button" class="verify-cancel">Vazgeç</button><button type="submit" class="verify-submit">${verified?'Sunucuyu doğrula':'Rozeti kaldır'}</button></footer></form>`;
  document.body.append(overlay);const form=$('form',overlay),input=$('input[name=password]',form),submit=$('.verify-submit',form),error=$('.verify-error',form);let escapeHandler=null;
  const close=()=>{input.value='';overlay.remove();if(escapeHandler)document.removeEventListener('keydown',escapeHandler);};
  $('.verify-cancel',form).onclick=close;overlay.addEventListener('mousedown',event=>{if(event.target===overlay)close();});
  escapeHandler=event=>{if(event.key==='Escape')close();};document.addEventListener('keydown',escapeHandler);input.focus();
  form.onsubmit=async event=>{
    event.preventDefault();submit.disabled=true;submit.textContent='Kaydediliyor…';error.textContent='';
    try{await api('/servers/'+Number(server.id)+'/verified','POST',{verified,password:input.value});close();toast(verified?'Sunucu doğrulandı.':'Doğrulama rozeti kaldırıldı.');loadServers().catch(er=>toast(er.message,true));}
    catch(er){error.textContent=er.message;submit.disabled=false;submit.textContent=verified?'Sunucuyu doğrula':'Rozeti kaldır';input.focus();}
  };
}
async function toggleBan(u){
  const ban=!u.banned;
  if(!confirm(ban?`${u.displayName} (${u.email}) banlansın mı?\n\nOturumları kapatılır ve bu hesapla giriş engellenir.`:`${u.displayName} (${u.email}) için ban kaldırılsın mı?\n\nKullanıcı tekrar giriş yapabilir.`))return;
  try{await api('/users/'+u.id+'/'+(ban?'ban':'unban'),'POST');toast(ban?'Kullanıcı banlandı.':'Ban kaldırıldı.');await loadUsers();}
  catch(er){toast(er.message,true);}
}
let badgeDialog=null;
function closeBadgeDialog(){if(badgeDialog){badgeDialog.remove();badgeDialog=null;}}
async function openBadgeDialog(u){
  closeCtx();closeBadgeDialog();
  const overlay=document.createElement('div');overlay.className='badge-overlay';overlay.setAttribute('role','presentation');
  overlay.innerHTML=`<section class="badge-dialog" role="dialog" aria-modal="true" aria-labelledby="badge-dialog-title"><header class="badge-dialog-head"><span class="badge-dialog-mark">✦</span><div><small>KULLANICI ROZETLERİ</small><h2 id="badge-dialog-title">${esc(u.displayName)} <span>· @${esc(u.username)}</span></h2></div><button type="button" class="badge-dialog-close" aria-label="Kapat">×</button></header><p class="badge-dialog-copy"><b>Rozet seç</b> · public/rozetler klasöründeki PNG dosyaları burada otomatik listelenir.</p><div class="badge-admin-grid"><div class="empty-list">Rozetler yükleniyor…</div></div><footer class="badge-dialog-foot"><span><i></i> Seçilen rozet profil ve sohbetlerde görünür.</span><button type="button" class="badge-dialog-done">Tamam</button></footer></section>`;
  document.body.append(overlay);badgeDialog=overlay;
  const close=()=>{if(badgeDialog===overlay)closeBadgeDialog();};
  $('.badge-dialog-close',overlay).onclick=close;$('.badge-dialog-done',overlay).onclick=close;
  overlay.addEventListener('mousedown',event=>{if(event.target===overlay)close();});
  const grid=$('.badge-admin-grid',overlay);let badges=[];
  const render=()=>{
    if(!badges.length){grid.innerHTML='<div class="badge-admin-empty"><span>◇</span><b>Henüz PNG rozeti yok</b><small>public/rozetler klasörüne bir .png dosyası ekleyip bu pencereyi yeniden aç.</small></div>';return;}
    grid.innerHTML=badges.map(badge=>`<button type="button" class="badge-admin-card${badge.assigned?' is-assigned':''}" data-badge-file="${esc(badge.file)}" aria-pressed="${badge.assigned}"><span class="badge-admin-art"><img src="${esc(badge.image)}" alt=""></span><span class="badge-admin-info"><b>${esc(badge.name)}</b><small>${esc(badge.file)}</small></span><span class="badge-admin-state">${badge.assigned?'✓ Eklendi':'+ Rozet ver'}</span></button>`).join('');
  };
  grid.onclick=async event=>{
    const card=event.target.closest('[data-badge-file]');if(!card)return;
    const badge=badges.find(item=>item.file===card.dataset.badgeFile);if(!badge)return;
    card.disabled=true;
    try{
      const assigned=!badge.assigned;
      const result=await api('/users/'+u.id+'/badges','PATCH',{file:badge.file,assigned});
      badge.assigned=result.assigned;render();
      toast(assigned?'Rozet kullanıcıya eklendi.':'Rozet kullanıcıdan kaldırıldı.');
    }catch(error){toast(error.message,true);card.disabled=false;}
  };
  try{const data=await api('/users/'+u.id+'/badges');if(!overlay.isConnected)return;badges=data.badges||[];render();}
  catch(error){if(overlay.isConnected)grid.innerHTML=`<div class="badge-admin-empty"><b>Rozetler yüklenemedi</b><small>${esc(error.message)}</small></div>`;}
}
const WARN_CATS=['Küfür veya hakaret','Taciz veya zorbalık','Spam veya istenmeyen reklam','Uygunsuz içerik paylaşımı','Dolandırıcılık veya yanıltma','Topluluk kurallarının genel ihlali'];
function openWarn(u){
  const n=Number(u.warnCount||0)+1,o=document.createElement('div');o.className='warn-overlay';
  o.innerHTML=`<form class="warn-modal"><h3>${esc(u.displayName)} kullanıcısını uyar</h3><p class="warn-sub">Bu <b>${n}. uyarı</b> olacak (${n}/3). Uyarılar geri alınamaz; kullanıcıya bot mesajı ve sert bir e-posta gider.</p><label>Uyarı sebebi<select name="category">${WARN_CATS.map(c=>`<option>${esc(c)}</option>`).join('')}</select></label><label>Ek açıklama (isteğe bağlı)<textarea name="details" maxlength="300" rows="3" placeholder="Kullanıcıya gösterilecek kısa not"></textarea></label><div class="warn-actions"><button type="button" class="warn-cancel">Vazgeç</button><button type="submit" class="warn-send">Uyarıyı gönder</button></div></form>`;
  document.body.append(o);const f=$('form',o),close=()=>o.remove();
  $('.warn-cancel',o).onclick=close;o.addEventListener('mousedown',e=>{if(e.target===o)close();});
  f.onsubmit=async e=>{e.preventDefault();const b=$('.warn-send',o);b.disabled=true;
    try{await api('/users/'+u.id+'/warn','POST',{category:f.category.value,details:f.details.value});toast(`${n}. uyarı gönderildi.`);close();await loadUsers();}
    catch(er){toast(er.message,true);b.disabled=false;}};
}
// Tarayıcının kendi sağ tık menüsü (Öğeyi denetle vb.) bu panelde hiçbir yerde açılmaz.
document.addEventListener('contextmenu',e=>{
  e.preventDefault();closeCtx();
  if($('#admin-app').hidden)return;
  const card=e.target.closest('#servers-list .server-card[data-server-id]');
  if(card){
    const server=servers.find(item=>Number(item.id)===Number(card.dataset.serverId));if(!server)return;
    const menu=document.createElement('div');menu.className='ctx-menu';menu.setAttribute('role','menu');
    menu.innerHTML=`<div class="ctx-title">${esc(server.name)}<small>${server.verified?'Doğrulanmış sunucu':'Sunucu işlemleri'}</small></div><button type="button" role="menuitem" class="ctx-item verify-action">${server.verified?'↶ Doğrulamayı kaldır':'✓ Sunucuyu doğrula'}</button>`;
    document.body.append(menu);const w=menu.offsetWidth,h=menu.offsetHeight;
    menu.style.left=Math.max(6,Math.min(e.clientX,innerWidth-w-6))+'px';menu.style.top=Math.max(6,Math.min(e.clientY,innerHeight-h-6))+'px';
    $('.verify-action',menu).onclick=()=>openServerVerificationDialog(server);ctxMenu=menu;return;
  }
  const row=e.target.closest('#users-table tr[data-user-id]');
  if(!row)return;
  const u=users.find(x=>Number(x.id)===Number(row.dataset.userId));if(!u)return;
  const menu=document.createElement('div');menu.className='ctx-menu';menu.setAttribute('role','menu');
  menu.innerHTML=`<div class="ctx-title">${esc(u.displayName)}<small>${esc(u.email)}</small></div><button type="button" role="menuitem" class="ctx-item badge-action">✦ Rozet ver</button><button type="button" role="menuitem" class="ctx-item warn" ${Number(u.warnCount)>=3?'disabled':''}>${Number(u.warnCount)>=3?'Uyarı limiti doldu (3/3)':`Uyarı ver (${Number(u.warnCount||0)}/3)`}</button><button type="button" role="menuitem" class="ctx-item ${u.banned?'unban':'ban'}">${u.banned?'Banı aç':'Üyeyi banla'}</button>`;
  document.body.append(menu);
  const w=menu.offsetWidth,h=menu.offsetHeight;
  menu.style.left=Math.max(6,Math.min(e.clientX,innerWidth-w-6))+'px';menu.style.top=Math.max(6,Math.min(e.clientY,innerHeight-h-6))+'px';
  $('.ctx-item.badge-action',menu).onclick=()=>openBadgeDialog(u);$('.ctx-item.warn',menu).onclick=()=>{closeCtx();openWarn(u);};$('.ctx-item.ban,.ctx-item.unban',menu).onclick=()=>{closeCtx();toggleBan(u);};
  ctxMenu=menu;
},true);
document.addEventListener('click',e=>{if(!e.target.closest('.ctx-menu'))closeCtx();});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeCtx();closeBadgeDialog();}});
window.addEventListener('scroll',closeCtx,true);window.addEventListener('resize',closeCtx);window.addEventListener('blur',closeCtx);
$('#login-form').addEventListener('submit',async e=>{e.preventDefault();const form=e.currentTarget,button=$('.login-submit',form);button.disabled=true;$('#login-error').textContent='';try{const d=await fetch('/api/admin/login',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify({username:form.username.value,password:form.password.value})});const x=await d.json().catch(()=>({}));if(!d.ok)throw new Error(x.error||'Giriş yapılamadı.');form.password.value='';showApp(x.username);}catch(er){$('#login-error').textContent=er.message;}finally{button.disabled=false;}});
$('#logout-button').onclick=async()=>{try{await api('/logout','POST');}catch{}showLogin('');};
$$('.nav-item').forEach(b=>b.onclick=()=>navigate(b.dataset.page));
$$('[data-goto]').forEach(b=>b.onclick=()=>navigate(b.dataset.goto));
$$('[data-announcement-create]').forEach(b=>b.onclick=openAnnouncementComposer);
$('#overview-tickets').addEventListener('click',e=>{const row=e.target.closest('[data-open-ticket]');if(row){filter='all';$$('[data-filter]').forEach(b=>b.classList.toggle('active',b.dataset.filter==='all'));navigate('support');openTicket(row.dataset.openTicket).catch(er=>toast(er.message,true));}});
$('#admin-ticket-list').addEventListener('click',e=>{const row=e.target.closest('[data-ticket-id]');if(row)openTicket(row.dataset.ticketId).catch(er=>toast(er.message,true));});
$$('[data-filter]').forEach(b=>b.onclick=()=>{filter=b.dataset.filter;$$('[data-filter]').forEach(x=>x.classList.toggle('active',x===b));loadTicketList().catch(er=>toast(er.message,true));});
$('#user-search').addEventListener('input',()=>{clearTimeout(searchTimer);searchTimer=setTimeout(()=>loadUsers().catch(er=>toast(er.message,true)),250);});
$('#refresh-button').onclick=async e=>{const b=e.currentTarget;b.classList.add('spinning');try{await refreshAll();if(currentPage==='users')await loadUsers();if(currentPage==='servers')await loadServers();if(currentPage==='announcements')await loadAnnouncements();if(currentTicket&&currentPage==='support')await refreshSelectedTicket();toast('Veriler güncellendi.');}catch(er){toast(er.message,true);}finally{setTimeout(()=>b.classList.remove('spinning'),450);}};
$('#admin-ticket-list').addEventListener('click',e=>{const row=e.target.closest('[data-ticket-id]');if(row)currentTicket=Number(row.dataset.ticketId);});
api('/session').then(s=>showApp(s.username)).catch(()=>showLogin(''));
