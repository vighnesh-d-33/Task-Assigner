let tk,D,tab='home',cur=new Date(),sel;const $=s=>document.querySelector(s);
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
let busy=0;
const pub=async(f,...a)=>{busy++;document.body.classList.add('busy');let r;try{r=await(await fetch(API_URL,{method:'POST',body:JSON.stringify({fn:f,args:a})})).json()}catch(e){throw new Error('Cannot reach server. Check API_URL in config.js and your internet connection.')}finally{if(--busy<1)document.body.classList.remove('busy')}
if(!r.ok)throw new Error(r.error);return r.data};
const run=(f,...a)=>pub(f,tk,...a);
const fail=e=>{const m=e.message||String(e);if(m.includes('SESSION')){alert('Session expired. Please login again.');location.reload()}else alert(m.replace('Error: ',''))};
async function go(){const b=$('#lb');b.disabled=true;try{const r=await pub('loginData',$('#u').value,$('#p').value);tk=r.t;D=r.d;$('#L').classList.add('hide');$('#A').classList.remove('hide');draw();idle()}catch(e){$('#err').textContent=(e.message||e).replace('Error: ','')}b.disabled=false}
async function load(){try{D=await run('getData');draw()}catch(e){fail(e)}}
const TITLES={home:'Dashboard',assign:'Assign Task',users:'Users',teams:'Teams',notes:'Daily Notes',detail:'Task Details',rights:'User Rights'};
function draw(){const adm=D.user.role==='Admin';
const c=D.user.can,it=[['home','🏠','Dashboard'],c.assign&&['assign','➕','Assign Task'],c.users&&['users','👥','Users'],c.teams&&['teams','🏷️','Teams'],c.rights&&['rights','🔐','User Rights'],['notes','📅','Notes']].filter(Boolean);
$('#side').innerHTML=`<div class="brand"><img src="icon.png" alt=""><div><b>amace solutions pvt.ltd.</b><small>TASK ASSIGNER</small></div></div>
<nav>${it.map(i=>`<a class="${(tab==i[0]||(tab=='detail'&&i[0]=='home'))?'on':''}" onclick="tab='${i[0]}';draw()"><span>${i[1]}</span>${i[2]}</a>`).join('')}</nav>
<div class="me"><div class="av">${esc((D.user.name||'?')[0])}</div><div><b>${esc(D.user.name)}</b><small>${esc(D.user.role)}</small></div><button onclick="chPw()" title="Change password">🔑</button><button onclick="logout()" title="Logout">⏻</button></div>
<div class="addr">#429, 12th Cross Rd, 4th Phase, Peenya Industrial Area, Bengaluru – 560 058</div>`;
$('#main').innerHTML=`<div class="top"><h1>${TITLES[tab]}</h1><small>${D.today}</small></div>`+({home,assign,users,teams,notes,detail,rights}[tab]||home)()}
const list=(a,e)=>a.length?a.map(card).join(''):`<small class="mut">${e}</small>`;
const st=(l,n,c,i)=>`<div class="stat ${c}"><span>${i}</span><b>${n}</b><small>${l}</small></div>`;
let q='',fs='';
const match=k=>(!fs||k.State==fs)&&(!q||[k.Title,k.Description,k.AssignedName,k.CreatedBy,k.DueDate].join(' ').toLowerCase().includes(q.toLowerCase()));
const lists=()=>{const T=D.tasks.filter(match),a=T.filter(k=>k.mine),b=T.filter(k=>k.byMe&&!k.mine);
return `<div class="grid2"><div class="box"><h3>Assigned to me (${a.length})</h3>${list(a,'No tasks found.')}</div><div class="box"><h3>Assigned by me (${b.length})</h3>${list(b,'No tasks found.')}</div></div>`};
function home(){const T=D.tasks,n=s=>T.filter(k=>k.State==s).length,soon=T.filter(k=>k.State=='Open'&&(new Date(k.DueDate)-new Date(D.today))/864e5<=2).length;
return `<div class="stats">${st('Open',n('Open'),'g','🟢')}${st('Due within 2 days',soon,'a','⏰')}${st('Blocked',n('Blocked'),'r','🔒')}${st('Closed',n('Closed'),'p','✅')}</div>
<div class="tools"><input placeholder="🔍 Search by title, description, person or date" value="${esc(q)}" oninput="q=this.value;$('#lists').innerHTML=lists()">
<select onchange="fs=this.value;$('#lists').innerHTML=lists()">${['','Open','Blocked','Closed'].map(s=>`<option value="${s}" ${s==fs?'selected':''}>${s||'All status'}</option>`).join('')}</select></div><div id="lists">${lists()}</div>`}
const doneBox=k=>{const c=k.slots.filter(s=>s.by),m=k.slots.length>1;return c.length?`<div class="done">${m?`<b>${c.length} of ${k.slots.length} closed</b>`:''}${c.map(s=>`<div>✔ ${(m||s.t=='T')?esc(s.name)+': ':''}closed by <b>${esc(s.byName)}</b> on ${s.at}${s.note?' — '+esc(s.note):''}</div>`).join('')}</div>`:''};
function card(k){let a=`<button class="s" onclick="openT('${k.ID}')">📂 Open</button>`;
if(k.byMe&&k.Status!='Closed')a+=`<button class="s" onclick="editT('${k.ID}')">✏️ Edit task</button>`+(k.State=='Blocked'?`<button class="s" onclick="ext('${k.ID}')">Reopen / extend</button>`:'');
if(k.byMe)a+=`<button class="s" onclick="delTask('${k.ID}')">🗑️ Delete</button>`;
if(k.State=='Blocked'&&!k.byMe)a+='<small>🔒 Blocked after due date. Contact the person who assigned it.</small>';
return `<div class="card ${k.State}" ondblclick="openT('${k.ID}')" title="Double-click to open"><div class="row"><b>${esc(k.Title)}</b><span class="b ${k.State}">${k.State}</span></div><p>${esc(k.Description)}</p>
<small>To: ${esc(k.AssignedName)} · By: ${esc(k.CreatedBy)} · Assigned: ${k.CreatedAt} · Due: <b>${k.DueDate}</b>${k.files.length?' · 📎 '+k.files.length+' file(s)':''}</small>${doneBox(k)}<div>${a}</div></div>`}
function ask(t,html,cb,nl){$('#mt').textContent=t;$('#mi').innerHTML=html;M.classList.remove('hide');setTimeout(()=>{const i=$('#mi input,#mi textarea');i&&i.focus()},50);$('#mok').onclick=async()=>{try{await cb($('#mv').value);M.classList.add('hide');nl||load()}catch(e){fail(e)}}}
const closeT=id=>ask('Closing details','<textarea id="mv" rows="4" placeholder="What was done?"></textarea>',v=>run('closeTask',id,v));
const ext=id=>ask('New due date',`<input id="mv" type="date" min="${D.today}">`,v=>run('extendTask',id,v));
let AF=[];
function assign(){AF=[];return `<div class="box"><h3>Assign new task</h3><label>Title</label><input id="ti"><label>Description</label><textarea id="de" rows="3"></textarea>
<div class="ph"><label>Assign to (select one or more teams / employees)</label><input class="srch" placeholder="🔍 Search name or team" oninput="fPick(this.value)"></div>
<div class="pick" onchange="selC()"><div class="grp"><b>Teams</b>${D.teams.map(t=>`<label class="ck"><input type="checkbox" value="T:${esc(t)}">🏷️ ${esc(t)}</label>`).join('')||'<small class="mut">No teams yet</small>'}</div>
<div class="grp"><b>Employees</b>${D.people.map(p=>`<label class="ck"><input type="checkbox" value="U:${esc(p.id)}">${esc(p.name)} (${esc(p.id)})${p.team?' · '+esc(p.team):''}</label>`).join('')}</div><small class="mut nom hide">No match found</small></div><small id="selc" class="mut"></small>
<label>Attachments (optional · up to 5 files, 5 MB each)</label><input id="fl" type="file" multiple onchange="pickF(this)"><div id="fls" class="chips"></div><br>
<label>Due date</label><input id="du" type="date" min="${D.today}"><button class="p" onclick="send(this)">Assign &amp; send email</button></div>`}
function fPick(q){q=q.trim().toLowerCase();let n=0;document.querySelectorAll('.pick .grp').forEach(g=>{let v=0;g.querySelectorAll('.ck').forEach(c=>{const s=!q||c.textContent.toLowerCase().includes(q);c.classList.toggle('hide',!s);if(s)v++});g.classList.toggle('hide',!v);n+=v});$('.nom').classList.toggle('hide',n>0)}
function selC(){const n=document.querySelectorAll('.pick input:checked').length;$('#selc').textContent=n?n+' selected':''}
function pickF(inp){[...inp.files].forEach(f=>{if(AF.length>=5)return alert('Maximum 5 files per task');if(f.size>5*1048576)return alert(f.name+' is larger than 5 MB');
const r=new FileReader();r.onload=()=>{AF.push({name:f.name,type:f.type,data:r.result.split(',')[1],size:f.size});rF()};r.readAsDataURL(f)});inp.value=''}
const rF=()=>{$('#fls').innerHTML=AF.map((f,i)=>`<span>📎 ${esc(f.name)} (${fmt(f.size)}) <a href="#" onclick="AF.splice(${i},1);rF();return false" style="text-decoration:none">✕</a></span>`).join('')};
async function send(b){b.disabled=true;const t=b.textContent;b.textContent=AF.length?'Uploading…':'Sending…';try{const to=[...document.querySelectorAll('.pick input:checked')].map(i=>i.value);
await run('createTask',{title:$('#ti').value,desc:$('#de').value,to,due:$('#du').value,files:AF.map(f=>({name:f.name,type:f.type,data:f.data}))});alert('Task assigned. Emails sent.');tab='home';load()}catch(e){b.disabled=false;b.textContent=t;fail(e)}}
const ymd=(y,m,d)=>y+'-'+String(m+1).padStart(2,'0')+'-'+String(d).padStart(2,'0');
function notes(){const y=cur.getFullYear(),m=cur.getMonth(),f=new Date(y,m,1).getDay(),n=new Date(y,m+1,0).getDate();
let c=['S','M','T','W','T','F','S'].map(d=>`<div class="h">${d}</div>`).join('')+'<div class="h"></div>'.repeat(f);
for(let d=1;d<=n;d++){const k=ymd(y,m,d);c+=`<div class="${D.notes.some(x=>x.Date==k)?'n ':''}${k==D.today?'t ':''}${k==sel?'x':''}" onclick="sel='${k}';draw()">${d}</div>`}
const nt=(D.notes.find(x=>x.Date==sel)||{}).Note||'';
return `<div class="box"><div class="row"><button class="s" onclick="cur=new Date(${y},${m-1},1);draw()">‹</button><b>${cur.toLocaleString('default',{month:'long'})} ${y}</b><button class="s" onclick="cur=new Date(${y},${m+1},1);draw()">›</button></div><br><div class="cal">${c}</div></div>
<div class="box">${sel?`<h3>Note for ${sel}</h3><textarea id="nt" rows="5">${esc(nt)}</textarea><button class="p" onclick="saveN()">Save note</button>`:'<small>Select a date to add or view your daily note. Dots mark days with notes.</small>'}</div>`}
async function saveN(){try{await run('saveNote',sel,$('#nt').value);D=await run('getData');draw();alert('Saved')}catch(e){fail(e)}}

function forgot(){const id=$('#u').value.trim();
if(!id){$('#err').textContent='Type your User ID in the box above first, then click Forgot password.';$('#u').focus();return}
$('#err').textContent='';
ask('Forgot password',`<label>User ID</label><input id="mv" class="ro" value="${esc(id)}" readonly><small class="mut">A 6-digit reset code will be sent to the email linked with this User ID.</small><br><br>`,async()=>{const m=await pub('sendResetCode',id);
setTimeout(()=>ask('Reset password for '+id,`<small class="mut">${esc(m)}</small><input id="mv" placeholder="6-digit code"><input id="mv2" type="password" placeholder="New password (min 8, letters + numbers)">`,async v=>{await pub('resetPassword',id,v,$('#mv2').value);alert('Password changed for '+id+'. Please login.')},1),0)},1)}
const tOpts=s=>'<option value="">No team</option>'+D.teams.map(t=>`<option ${t==s?'selected':''}>${esc(t)}</option>`).join('');
function users(){return `<div class="box"><h3>Create user</h3><div class="g"><input id="nid" placeholder="User ID"><input id="nnm" placeholder="Full name"><input id="nem" placeholder="Email"><input id="npw" placeholder="Password (min 8, letters + numbers)">
<select id="nro"><option>Employee</option>${D.user.role=='Admin'?'<option>Admin</option>':''}</select><select id="ntm">${tOpts('')}</select></div><small class="mut">Need a new team? Create it first in the Teams menu.</small><br><br><button class="p" onclick="addU()">Create user</button></div>
<div class="box"><h3>All users (${D.people.length})</h3><div class="tw"><table><tr><th>ID</th><th>Name</th><th>Email</th><th>Role</th><th>Team</th><th></th></tr>
${D.people.map(p=>`<tr><td>${esc(p.id)}</td><td>${esc(p.name)}</td><td>${esc(p.email)}</td><td><span class="tag ${esc(p.role)}">${esc(p.role)}</span></td><td>${esc(p.team)||'—'}</td><td class="nw">
${p.role=='Admin'&&D.user.role!='Admin'?'':`<button class="s" onclick="editU('${esc(p.id)}')">✏️ Edit</button><button class="s" onclick="rp('${esc(p.id)}')">🔑</button><button class="s" onclick="du('${esc(p.id)}')">🗑️</button>`}</td></tr>`).join('')}</table></div></div>`}
async function addU(){try{await run('addUser',{id:$('#nid').value,name:$('#nnm').value,email:$('#nem').value,pw:$('#npw').value,role:$('#nro').value,team:$('#ntm').value});D=await run('getData');draw();alert('User created')}catch(e){fail(e)}}
function editU(id){const p=D.people.find(x=>x.id==id);ask('Edit user: '+id,`<label>Name</label><input id="mv" value="${esc(p.name)}"><label>Email</label><input id="ue" value="${esc(p.email)}">
<label>Role</label><select id="ur"><option ${p.role=='Employee'?'selected':''}>Employee</option>${D.user.role=='Admin'?`<option ${p.role=='Admin'?'selected':''}>Admin</option>`:''}</select><label>Team</label><select id="ut">${tOpts(p.team)}</select>`,
v=>run('updateUser',id,{name:v,email:$('#ue').value,role:$('#ur').value,team:$('#ut').value}))}
const rp=id=>ask('New password for '+id,'<input id="mv" placeholder="New password (min 8, letters + numbers)">',v=>run('setPassword',id,v));
const du=async id=>{if(confirm('Delete user '+id+'?'))try{await run('deleteUser',id);load()}catch(e){fail(e)}};
function teams(){return `<div class="box"><h3>Create team</h3><div class="inl"><input id="tn" placeholder="Team name (e.g. Sales, Service, Accounts)"><button class="p" onclick="addT()">Create team</button></div></div>
<div class="grid3">${D.teams.map(t=>{const m=D.people.filter(p=>p.team==t);return `<div class="box team"><div class="row"><h3>${esc(t)}</h3><button class="s" onclick="delT('${esc(t)}')">🗑️</button></div>
<small class="mut">${m.length} member(s)</small><div class="chips">${m.map(p=>`<span>${esc(p.name)}</span>`).join('')||'<small class="mut">No members yet. Add them from Users → Edit.</small>'}</div></div>`}).join('')||'<small class="mut">No teams yet. Create your first team above.</small>'}</div>`}
async function addT(){try{await run('createTeam',$('#tn').value);load()}catch(e){fail(e)}}
const delT=async t=>{if(confirm('Delete team '+t+'? Members will be left without a team.'))try{await run('deleteTeam',t);load()}catch(e){fail(e)}};
function editT(id){const k=D.tasks.find(x=>x.ID==id);ask('Edit task',`<label>Title</label><input id="mv" value="${esc(k.Title)}"><label>Description</label><textarea id="ed" rows="3">${esc(k.Description)}</textarea>
<label>Due date</label><input id="edu" type="date" min="${D.today}" value="${k.DueDate}">`,v=>run('editTask',id,{title:v,desc:$('#ed').value,due:$('#edu').value}))}
let curT;const openT=id=>{curT=id;tab='detail';draw();scrollTo(0,0)};
function detail(){const k=D.tasks.find(x=>x.ID==curT);if(!k){tab='home';return home()}
const tm=k.slots.some(s=>s.t=='T'&&!s.by);
return `<button class="s" onclick="tab='home';draw()">← Back to tasks</button>
<div class="box" style="margin-top:12px"><div class="row"><h3>${esc(k.Title)}</h3><span class="b ${k.State}">${k.State}</span></div>
<div class="g dl"><div><small>Assigned to</small><b>${esc(k.AssignedName)}</b></div><div><small>Assigned by</small><b>${esc(k.CreatedBy)}</b></div><div><small>Assigned on</small><b>${k.CreatedAt}</b></div><div><small>Due date</small><b>${k.DueDate}</b></div></div>
<label>Description</label><div class="desc">${esc(k.Description)||'—'}</div>${fileList(k)}${doneBox(k)}
${k.canClose?`<label>What was done / Description</label>${tm?'<small class="mut">Team task: when one person closes it, it closes for the whole team.</small>':''}<textarea id="cd" rows="4" placeholder="Write what was done to complete this task"></textarea><button class="p" onclick="closeD('${k.ID}',this)">Close task</button>`
:(k.State=='Blocked'&&!k.byMe?'<div class="done warn">🔒 Blocked after the due date. Contact the person who assigned it.</div>':'')}
${k.byMe?`<div style="margin-top:12px">${k.Status!='Closed'?`<button class="s" onclick="editT('${k.ID}')">✏️ Edit task</button><button class="s" onclick="ext('${k.ID}')">📅 Change due date</button>`:''}<button class="s" onclick="delTask('${k.ID}')">🗑️ Delete task</button></div>`:''}</div>`}
async function closeD(id,b){b.disabled=true;try{await run('closeTask',id,$('#cd').value);D=await run('getData');draw();alert('Task closed')}catch(e){b.disabled=false;fail(e)}}
async function delTask(id){if(!confirm('Delete this task permanently? Pending assignees will be notified by email.'))return;try{await run('deleteTask',id);tab='home';await load()}catch(e){fail(e)}}
const RT=[['assign','Assign Task'],['users','Users'],['teams','Teams']];
function rights(){const L=D.people.filter(p=>p.role!='Admin');
return `<div class="box"><h3>User Rights</h3><p class="mut">By default every user sees only <b>Dashboard</b> and <b>Notes</b>. Tick the extra tabs a user may use. Changes save automatically. Admins always have every tab.</p>
<div class="tw"><table><tr><th>User</th><th>Team</th>${RT.map(r=>`<th>${r[1]}</th>`).join('')}</tr>
${L.map(p=>{const h=(p.rights||'').split(',');return `<tr><td>${esc(p.name)} <small class="mut">(${esc(p.id)})</small></td><td>${esc(p.team)||'—'}</td>${RT.map(r=>`<td><input type="checkbox" class="rt" data-u="${esc(p.id)}" value="${r[0]}" ${h.includes(r[0])?'checked':''} onchange="saveR('${esc(p.id)}')"></td>`).join('')}</tr>`}).join('')||'<tr><td colspan="5" class="mut">No employees yet.</td></tr>'}</table></div></div>`}
async function saveR(id){const l=[...document.querySelectorAll(`.rt[data-u="${id}"]:checked`)].map(i=>i.value);try{await run('setRights',id,l);D.people.find(x=>x.id==id).rights=l.join(',')}catch(e){fail(e);load()}}
const fmt=n=>n>1048576?(n/1048576).toFixed(1)+' MB':Math.ceil(n/1024)+' KB';
const MT={pdf:'application/pdf',png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',gif:'image/gif',webp:'image/webp',bmp:'image/bmp',svg:'image/svg+xml',mp4:'video/mp4',webm:'video/webm',mov:'video/quicktime',mp3:'audio/mpeg',wav:'audio/wav',ogg:'audio/ogg',m4a:'audio/mp4'};
const fext=n=>(n.split('.').pop()||'').toLowerCase();
const kind=f=>{const e=fext(f.name),t=f.type||'';if(t.startsWith('image/')||['png','jpg','jpeg','gif','webp','bmp','svg'].includes(e))return'img';if(t=='application/pdf'||e=='pdf')return'pdf';
if(t.startsWith('video/')||['mp4','webm','mov'].includes(e))return'vid';if(t.startsWith('audio/')||['mp3','wav','ogg','m4a'].includes(e))return'aud';
if(t.startsWith('text/')||['txt','csv','json','xml','log','md'].includes(e))return'txt';return''};
const fileList=k=>k.files.length?`<label>Attachments</label><div class="files">${k.files.map(f=>`<div class="fr">📎 <span>${esc(f.name)} <small>(${fmt(f.size)})</small></span>
${kind(f)?`<button class="s" onclick="prev('${k.ID}','${f.id}',this)">👁️ Preview</button>`:''}<button class="s" onclick="dl('${k.ID}','${f.id}',this)">⬇ Download</button></div>`).join('')}</div>`:'';
async function getF(id,fid){const f=await run('downloadFile',id,fid),bin=atob(f.data),u=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)u[i]=bin.charCodeAt(i);
const ty=(f.type&&f.type!='application/octet-stream')?f.type:(MT[fext(f.name)]||f.type);return{f,blob:new Blob([u],{type:ty})}}
function saveB(blob,name){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();a.remove()}
async function dl(id,fid,b){const t=b.innerHTML;b.disabled=true;b.textContent='Downloading…';try{const{f,blob}=await getF(id,fid);saveB(blob,f.name)}catch(e){fail(e)}b.disabled=false;b.innerHTML=t}
let PU='';
async function prev(id,fid,b){const t=b.innerHTML;b.disabled=true;b.textContent='Loading…';
try{const{f,blob}=await getF(id,fid),k=kind(f);closeP();PU=URL.createObjectURL(blob);$('#pt').textContent=f.name;$('#pd').onclick=()=>saveB(blob,f.name);
$('#pb').innerHTML=k=='img'?`<img src="${PU}" alt="">`:k=='pdf'?`<iframe src="${PU}"></iframe>`:k=='vid'?`<video src="${PU}" controls></video>`:k=='aud'?`<audio src="${PU}" controls></audio>`:k=='txt'?'<pre id="ptx"></pre>':'<p class="mut">Preview is not available for this file type. Please use Download.</p>';
if(k=='txt')$('#ptx').textContent=(await blob.text()).slice(0,200000);$('#P').classList.remove('hide')}catch(e){fail(e)}b.disabled=false;b.innerHTML=t}
function closeP(){$('#P').classList.add('hide');$('#pb').innerHTML='';if(PU)URL.revokeObjectURL(PU);PU=''}
async function logout(){try{await run('logout')}catch(e){}location.reload()}
const chPw=()=>ask('Change password','<label>Current password</label><input id="mv" type="password" autocomplete="current-password"><label>New password</label><input id="mv2" type="password" placeholder="min 8, letters + numbers" autocomplete="new-password">',async v=>{await run('changePassword',v,$('#mv2').value);alert('Password changed')},1);
let idleT;const idle=()=>{clearTimeout(idleT);idleT=setTimeout(()=>{alert('You were logged out because of inactivity.');logout()},20*60*1000)};
['click','keydown','mousemove','touchstart'].forEach(e=>addEventListener(e,()=>{if(tk)idle()}));
pub('ping').catch(()=>{}); // wakes the server while you type your login
