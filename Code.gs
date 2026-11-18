/* TASK ASSIGNER - Amace Solutions Pvt. Ltd. | Backend (Google Apps Script)
   SETUP: run setup() once, then Deploy > New deployment > Web app (Execute as: Me, Access: Anyone). Only this file is needed in Apps Script. */
const TZ = Session.getScriptTimeZone();
const APP_URL = ''; // optional: link of the page if you host it online (shown in emails)
const ADMIN_EMAIL = 'your@email.com'; // <-- put the admin email here (used for forgot-password code)
const sh = n => SpreadsheetApp.getActive().getSheetByName(n);
const today = () => Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd');
const ds = v => v instanceof Date ? Utilities.formatDate(v, TZ, 'yyyy-MM-dd') : String(v == null ? '' : v);

function doGet() { return ContentService.createTextOutput('Task Assigner API is running.'); }

/* All calls from the website (index.html on any computer) arrive here */
function doPost(e) {
  let o;
  try {
    const F = { login, getData, createTask, closeTask, extendTask, saveNote, addUser, setTeam, setPassword, deleteUser, sendResetCode, resetPassword, createTeam, deleteTeam, updateUser, editTask, setProgress, setRights, deleteTask, downloadFile, loginData, logout, ping, changePassword };
    const r = JSON.parse(e.postData.contents);
    if (!F[r.fn]) throw new Error('Unknown action');
    o = { ok: true, data: F[r.fn].apply(null, r.args || []) };
  } catch (x) { o = { ok: false, error: String(x.message || x) }; }
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

function setup() {
  const ss = SpreadsheetApp.getActive();
  const H = {
    Users: ['UserID', 'Name', 'Email', 'Password', 'Role', 'Team', 'Rights'],
    Tasks: ['ID', 'Title', 'Description', 'AssignedTo', 'AssignedName', 'CreatedBy', 'CreatedAt', 'DueDate', 'Status', 'ClosedAt', 'ClosedDetails', 'Reminded', 'BlockNotified', 'Progress', 'ClosedBy', 'Targets', 'Files'],
    Notes: ['UserID', 'Date', 'Note']
  };
  for (const n in H) {
    const s = ss.getSheetByName(n) || ss.insertSheet(n);
    if (!s.getLastRow()) s.appendRow(H[n]);
    s.getRange('A:M').setNumberFormat('@');
  }
  // Role: Admin (can assign tasks) or Employee. Team = any team name (used for team assignment).
  if (sh('Users').getLastRow() < 2) sh('Users').appendRow(['admin', 'Admin', ADMIN_EMAIL, mkPw('admin123'), 'Admin', 'Management']);
  ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === 'dailyCheck').forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('dailyCheck').timeBased().everyDays(1).atHour(9).create();
}

const _M = {}; // per-request memo: every sheet is read only once per request (big speed-up)
function rows(n) {
  if (!_M[n]) {
    const v = sh(n).getDataRange().getValues(), h = v.shift();
    _M[n] = v.map((r, i) => { const o = { _r: i + 2 }; h.forEach((k, j) => o[k] = ds(r[j])); return o; });
  }
  return _M[n].map(o => Object.assign({}, o));
}
const SENDER_NAME = 'Amace Solutions - Task Assigner'; // name shown to the receiver
const FROM_ALIAS = ''; // optional: a "Send mail as" alias of the deploying Gmail account
const ex = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');
function tpl(head, rs, note) {
  return '<div style="font-family:Segoe UI,Arial,sans-serif;max-width:560px;border:1px solid #eee;border-radius:12px;overflow:hidden">'
    + '<div style="background:#e3262e;background:linear-gradient(135deg,#e3262e,#b8447a);color:#fff;padding:14px 18px;font-size:18px;font-weight:600">' + ex(head) + '</div>'
    + '<table style="width:100%;border-collapse:collapse;font-size:14px">' + rs.map(r => '<tr><td style="padding:10px 18px;width:130px;color:#777;vertical-align:top;border-bottom:1px solid #f1e9f3"><b>' + ex(r[0]) + '</b></td><td style="padding:10px 18px;border-bottom:1px solid #f1e9f3">' + ex(r[1]) + '</td></tr>').join('') + '</table>'
    + (note ? '<p style="padding:4px 18px;font-size:14px">' + ex(note) + '</p>' : '') + '</div>';
}
function mail(to, s, b, o) {
  if (!to) return; o = o || {};
  const body = b + '<p style="font-size:12px;color:#888">Amace Solutions Pvt. Ltd.' + (APP_URL ? ' - <a href="' + APP_URL + '">Open Task Assigner</a>' : '') + '</p>';
  const opt = { htmlBody: body, name: o.name || SENDER_NAME }; if (o.replyTo) opt.replyTo = o.replyTo;
  if (FROM_ALIAS) { opt.from = FROM_ALIAS; GmailApp.sendEmail(to, '[Task Assigner] ' + s, '', opt); }
  else { opt.to = to; opt.subject = '[Task Assigner] ' + s; MailApp.sendEmail(opt); }
}
const status = k => k.Status === 'Closed' ? 'Closed' : (k.DueDate < today() ? 'Blocked' : 'Open');

function login(id, pw) {
  const q = String(id).trim().toLowerCase(), ch = CacheService.getScriptCache(), k = 'LF_' + q.slice(0, 60).replace(/[^\w@.-]/g, '_');
  const n = +(ch.get(k) || 0);
  if (n >= 5) throw new Error('Too many failed attempts. Try again after 10 minutes.');
  const u = rows('Users').filter(x => x.UserID.toLowerCase() === q || x.Name.toLowerCase() === q).find(x => checkPw(pw, x.Password));
  if (!u) {
    ch.put(k, String(n + 1), 600);
    if (n + 1 >= 5) logEvt(q, 'LOGIN LOCKED', 'too many failed attempts');
    throw new Error('Invalid User ID or password');
  }
  ch.remove(k);
  if (!String(u.Password).startsWith('h1$')) sh('Users').getRange(u._r, 4).setValue(mkPw(pw)); // upgrade an old plain-text password
  const t = Utilities.getUuid();
  ch.put(t, u.UserID, 21600);
  return t;
}
function loginData(id, pw) { const t = login(id, pw); return { t, d: getData(t) }; } // login + first screen in ONE call (faster)
function logout(t) { CacheService.getScriptCache().remove(t); }
function ping() { return 'ok'; } // the website calls this on open to wake the server while you type

function me(t) {
  const id = CacheService.getScriptCache().get(t);
  const u = id && rows('Users').find(x => x.UserID === id);
  if (!u) throw new Error('SESSION');
  return u;
}

function getData(t) {
  taskCols(); userCols();
  const u = me(t), users = rows('Users'), adm = u.Role === 'Admin';
  const any = can(u, 'assign') || can(u, 'users') || can(u, 'teams');
  const tasks = rows('Tasks').map(x => {
    x.slots = slotsOf(x); x.Targets = ''; x.files = parseFiles(x.Files); x.Files = ''; x.byMe = x.CreatedBy === u.UserID;
    const my = x.slots.filter(s => s.members.includes(u.UserID));
    x.mine = my.length > 0; x.mineDone = x.mine && my.every(s => s.by);
    x.State = (!x.byMe && x.mineDone) ? 'Closed' : status(x);
    x.canClose = x.Status !== 'Closed' && (x.byMe || (x.mine && !x.mineDone && status(x) !== 'Blocked'));
    return x;
  }).filter(x => x.byMe || x.mine).reverse();
  return {
    user: { id: u.UserID, name: u.Name, role: u.Role, can: { assign: can(u, 'assign'), users: can(u, 'users'), teams: can(u, 'teams'), rights: adm } }, tasks, today: today(),
    people: any ? users.map(x => ({ id: x.UserID, name: x.Name, email: can(u, 'users') ? x.Email : '', role: x.Role, team: x.Team, rights: adm ? x.Rights : '' })) : [],
    teams: any ? teamList() : [],
    notes: rows('Notes').filter(n => n.UserID === u.UserID)
  };
}

/* A task = ONE row. Targets column holds the assignee "slots" (users and teams) as JSON.
   User slot: closed by that user. Team slot: closed for the whole team when any member closes it. */
function slotsOf(k) {
  if (k.Targets) { try { return JSON.parse(k.Targets); } catch (e) {} }
  const c = k.Status === 'Closed'; // older tasks (one row per person)
  return [{ t: 'U', id: k.AssignedTo, name: k.AssignedName, members: [k.AssignedTo], by: c ? k.AssignedTo : '', byName: c ? (k.ClosedBy || k.AssignedName) : '', at: c ? k.ClosedAt : '', note: c ? k.ClosedDetails : '' }];
}
function rec(k) {
  const us = rows('Users');
  return [...new Set([].concat(...slotsOf(k).map(x => x.members)))].map(id => us.find(u => u.UserID === id)).filter(Boolean);
}
function createTask(t, x) {
  taskCols();
  const u = me(t);
  if (!can(u, 'assign')) throw new Error('You do not have permission to assign tasks');
  const to = [].concat(x.to || []);
  if (!x.title || !x.due || !to.length) throw new Error('Fill title, assignee and due date');
  if (x.due < today()) throw new Error('Due date is in the past');
  if (String(x.title).length > 200 || String(x.desc || '').length > 5000) throw new Error('Title (max 200) or description (max 5000) is too long');
  const all = rows('Users'), sl = [];
  to.forEach(v => {
    if (v.startsWith('T:')) { const m = all.filter(a => a.Team === v.slice(2)); if (m.length) sl.push({ t: 'T', id: v.slice(2), name: v.slice(2) + ' (team)', members: m.map(a => a.UserID) }); }
    else { const a = all.find(r => r.UserID === v.slice(2)); if (a) sl.push({ t: 'U', id: a.UserID, name: a.Name, members: [a.UserID] }); }
  });
  if (!sl.length) throw new Error('No assignee found (a team with no members cannot be assigned)');
  sl.forEach(s => { s.by = ''; s.byName = ''; s.at = ''; s.note = ''; });
  const names = sl.map(s => s.name).join(', '), id = 'T' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  const files = saveFiles(x.files);
  sh('Tasks').appendRow([id, x.title, x.desc || '', sl.map(s => s.id).join(','), names, u.UserID, today(), x.due, 'Open', '', '', '', '', 'Assigned', '', JSON.stringify(sl), JSON.stringify(files)]);
  const note = 'Please complete it and close it with details before the due date.' + (sl.some(s => s.t === 'T') ? ' For team tasks, when one person closes it, it is closed for the whole team.' : '');
  [...new Set([].concat(...sl.map(s => s.members)))].forEach(uid => {
    const a = all.find(r => r.UserID === uid);
    if (a) mail(a.Email, 'New task: ' + x.title, tpl('New task assigned to you', [['Task', x.title], ['Details', x.desc || '-'], ['Assigned to', names], ['Assigned by', u.Name], ['Due date', x.due]].concat(files.length ? [['Attachments', files.map(f => f.name).join(', ') + ' (open Task Assigner to download)']] : []), note), { name: u.Name + ' (Task Assigner)', replyTo: u.Email });
  });
  return sl.length;
}

function closeTask(t, id, d) {
  const l = LockService.getScriptLock(); l.waitLock(15000);
  try { closeTask_(t, id, d); } finally { l.releaseLock(); }
}
function closeTask_(t, id, d) {
  const u = me(t), k = rows('Tasks').find(x => x.ID === id);
  if (!k) throw new Error('Task not found');
  if (k.Status === 'Closed') throw new Error('Already closed');
  if (!String(d).trim()) throw new Error('Enter what was done');
  if (String(d).length > 5000) throw new Error('Text is too long (max 5000 characters)');
  const sl = slotsOf(k), owner = k.CreatedBy === u.UserID;
  let tg;
  if (owner) tg = sl.filter(x => !x.by);
  else {
    if (!sl.some(x => x.members.includes(u.UserID))) throw new Error('Not allowed');
    tg = sl.filter(x => !x.by && x.members.includes(u.UserID));
    if (!tg.length) throw new Error('You have already closed this task');
    if (status(k) === 'Blocked') throw new Error('Task is blocked. Contact the person who assigned it.');
  }
  tg.forEach(x => { x.by = u.UserID; x.byName = u.Name; x.at = today(); x.note = String(d).trim(); });
  const ts = sh('Tasks'), done = sl.filter(x => x.by).length;
  ts.getRange(k._r, 16).setValue(JSON.stringify(sl));
  if (done === sl.length) {
    ts.getRange(k._r, 9, 1, 3).setValues([['Closed', today(), String(d).trim()]]);
    ts.getRange(k._r, 14, 1, 2).setValues([['Completed', u.Name]]);
  }
  const c = rows('Users').find(x => x.UserID === k.CreatedBy);
  mail(c && c.Email, 'Task closed: ' + k.Title, tpl(done === sl.length ? 'Task closed' : 'Task update: closed by ' + u.Name,
    [['Task', k.Title], ['Details', k.Description || '-'], ['Assigned to', k.AssignedName], ['Closed by', u.Name], ['Closed on', today()], ['What was done', d], ['Progress', done + ' of ' + sl.length + ' closed']]),
    { name: u.Name + ' (Task Assigner)', replyTo: u.Email });
}

function extendTask(t, id, due) {
  const u = me(t), k = rows('Tasks').find(x => x.ID === id);
  if (!k || k.CreatedBy !== u.UserID) throw new Error('Only the task creator can reopen it');
  if (slotsOf(k).every(x => x.by)) throw new Error('Task is already closed');
  if (due < today()) throw new Error('Due date is in the past');
  const s = sh('Tasks');
  s.getRange(k._r, 8).setValue(due); s.getRange(k._r, 9).setValue('Open'); s.getRange(k._r, 12, 1, 2).setValues([['', '']]);
  rec(k).forEach(a => mail(a.Email, 'Task reopened: ' + k.Title, tpl('Task reopened / due date changed', [['Task', k.Title], ['Details', k.Description || '-'], ['Changed by', u.Name], ['New due date', due]]), { name: u.Name + ' (Task Assigner)', replyTo: u.Email }));
}

function saveNote(t, date, text) {
  if (String(text).length > 5000 || !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Invalid note');
  const u = me(t), s = sh('Notes'), n = rows('Notes').find(x => x.UserID === u.UserID && x.Date === date);
  if (n) { if (text.trim()) s.getRange(n._r, 3).setValue(text); else s.deleteRow(n._r); }
  else if (text.trim()) s.appendRow([u.UserID, date, text]);
}

/* Runs daily at 9 AM: 2-day reminder, then block + notify after due date (only people who have not closed yet) */
function dailyCheck() {
  taskCols();
  const td = today(), users = rows('Users'), s = sh('Tasks');
  rows('Tasks').forEach(k => {
    if (k.Status === 'Closed') return;
    const sl = slotsOf(k), days = Math.round((new Date(k.DueDate) - new Date(td)) / 864e5);
    const c = users.find(x => x.UserID === k.CreatedBy);
    const pend = [...new Set([].concat(...sl.filter(x => !x.by).map(x => x.members)))].map(id => users.find(u => u.UserID === id)).filter(Boolean);
    const info = [['Task', k.Title], ['Details', k.Description || '-'], ['Assigned to', k.AssignedName], ['Assigned by', c ? c.Name : k.CreatedBy], ['Due date', k.DueDate]];
    if (days >= 0 && days <= 2 && !k.Reminded) {
      pend.forEach(a => mail(a.Email, 'Reminder: due ' + k.DueDate, tpl('Reminder: task due soon', info.concat([['Days left', days]]), 'Please close it with details before the due date.'), { replyTo: c && c.Email }));
      s.getRange(k._r, 12).setValue('Y');
    }
    if (days < 0 && !k.BlockNotified) {
      const b = tpl('Task blocked', info, 'The due date has passed, so the task is blocked for the assignees. Only the creator can reopen or close it.');
      pend.forEach(a => mail(a.Email, 'Task BLOCKED: ' + k.Title, b)); mail(c && c.Email, 'Task BLOCKED: ' + k.Title, b);
      s.getRange(k._r, 13).setValue('Y');
    }
  });
}

/* ---- include() for separate Style.html / Script.html ---- */
function include(f) { return HtmlService.createHtmlOutputFromFile(f).getContent(); }

/* ---- User management (Admin only) ---- */
function adm(t) { const u = me(t); if (u.Role !== 'Admin') throw new Error('Admin only'); return u; }
function userRow(id) { const u = rows('Users').find(x => x.UserID === id); if (!u) throw new Error('User not found'); return u; }
function addUser(t, x) {
  const a = need(t, 'users');
  if (x.role === 'Admin' && a.Role !== 'Admin') throw new Error('Only an Admin can create an Admin');
  if (!/^[\w.@-]+$/.test(x.id || '')) throw new Error('User ID: letters, numbers . _ - @ only');
  if (!x.name || !/^\S+@\S+\.\S+$/.test(x.email || '')) throw new Error('Enter name and a valid email');
  pwCheck(x.pw);
  if (rows('Users').some(u => u.UserID.toLowerCase() === x.id.toLowerCase())) throw new Error('User ID already exists');
  sh('Users').appendRow([x.id, x.name, x.email, mkPw(x.pw), x.role === 'Admin' ? 'Admin' : 'Employee', (x.team || '').trim()]);
  logEvt(a.UserID, 'USER CREATED', x.id);
  mail(x.email, 'Your account is created', tpl('Your account is ready', [['User ID', x.id], ['Name', x.name], ['Role', x.role === 'Admin' ? 'Admin' : 'Employee']], 'Your administrator will give you the password. Please change it after your first login (key button), or use Forgot password.'));
}
function setTeam(t, id, team) { const a = need(t, 'users'), u = userRow(id); guard(a, u); sh('Users').getRange(u._r, 6).setValue(String(team).trim()); }
function setPassword(t, id, pw) {
  const a = need(t, 'users'), u = userRow(id); guard(a, u);
  pwCheck(pw);
  sh('Users').getRange(u._r, 4).setValue(mkPw(pw));
  logEvt(a.UserID, 'PASSWORD SET BY ADMIN', id);
}
function deleteUser(t, id) {
  const a = need(t, 'users'), u = userRow(id); guard(a, u);
  if (id === a.UserID) throw new Error('You cannot delete yourself');
  sh('Users').deleteRow(u._r);
  logEvt(a.UserID, 'USER DELETED', id);
}

/* ---- Forgot password: works for EVERY user, identified by User ID (never by email).
   Admin accounts: the code goes to ADMIN_EMAIL. Other users: the code goes to their own email. ---- */
function mask(e) { return String(e).replace(/^(.).*(@.*)$/, '$1***$2'); }
function byId(id) { // User ID first; a Name works only when it is unique
  const q = String(id || '').trim().toLowerCase(), us = rows('Users');
  const a = us.find(x => x.UserID.toLowerCase() === q);
  if (a) return a;
  const m = us.filter(x => x.Name.toLowerCase() === q);
  if (m.length > 1) throw new Error('More than one user has this name. Please use the User ID.');
  return m[0];
}
function sendResetCode(id) {
  const u = byId(id);
  if (!u) throw new Error('User ID not found');
  const to = u.Role === 'Admin' ? ADMIN_EMAIL : u.Email;
  if (!to || !/^\S+@\S+\.\S+$/.test(to) || to === 'your@email.com')
    throw new Error(u.Role === 'Admin' ? 'ADMIN_EMAIL is not set correctly at the top of Code.gs' : 'No valid email is set for this account');
  if (MailApp.getRemainingDailyQuota() < 1) throw new Error('Daily email limit reached. Try again tomorrow.');
  const c = String(Math.floor(100000 + Math.random() * 900000));
  mail(to, 'Password reset code', tpl('Password reset code', [['User ID', u.UserID], ['Code', c], ['Valid for', '10 minutes']], 'Only the account with the User ID above will be changed. If you did not ask for this, ignore this email.'));
  const ch = CacheService.getScriptCache();
  ch.put('RC_' + u.UserID, c, 600); ch.put('RA_' + u.UserID, '0', 600);
  return 'Code sent to ' + mask(to) + ' (also check Spam / Promotions)';
}
/* Run this once from the Apps Script editor to check that email sending works */
function testMail() {
  mail(ADMIN_EMAIL, 'Test email', tpl('Test email', [['Status', 'Email sending works']]));
  Logger.log('Test mail sent to ' + ADMIN_EMAIL + '. Remaining daily quota: ' + MailApp.getRemainingDailyQuota());
}
function resetPassword(id, code, pw) {
  const u = byId(id);
  if (!u) throw new Error('User ID not found');
  const ch = CacheService.getScriptCache(), c = ch.get('RC_' + u.UserID), n = +(ch.get('RA_' + u.UserID) || 0);
  if (!c || n >= 5) throw new Error('Code expired. Request a new one.');
  if (String(code).trim() !== c) { ch.put('RA_' + u.UserID, String(n + 1), 600); throw new Error('Wrong code'); }
  pwCheck(pw);
  sh('Users').getRange(u._r, 4).setValue(mkPw(pw)); logEvt(u.UserID, 'PASSWORD RESET (forgot password)', '');
  ch.remove('RC_' + u.UserID);
}

/* ---- Teams & user editing (Admin only) ---- */
function tsh() {
  let s = sh('Teams');
  if (!s) { s = SpreadsheetApp.getActive().insertSheet('Teams'); s.appendRow(['Team']); s.getRange('A:A').setNumberFormat('@'); }
  return s;
}
function teamList() {
  tsh();
  return [...new Set(rows('Teams').map(x => x.Team).concat(rows('Users').map(x => x.Team)).filter(String))].sort();
}
function createTeam(t, name) {
  need(t, 'teams'); name = String(name || '').trim();
  if (!/^[\w &.-]{2,40}$/.test(name)) throw new Error('Team name: 2-40 letters, numbers, spaces, & . - only');
  if (teamList().some(x => x.toLowerCase() === name.toLowerCase())) throw new Error('Team already exists');
  tsh().appendRow([name]);
}
function deleteTeam(t, name) {
  need(t, 'teams'); const s = tsh();
  rows('Teams').filter(x => x.Team === name).reverse().forEach(x => s.deleteRow(x._r));
  rows('Users').filter(u => u.Team === name).forEach(u => sh('Users').getRange(u._r, 6).setValue(''));
}
function updateUser(t, id, x) {
  const a = need(t, 'users'), u = userRow(id);
  guard(a, u);
  if (x.role === 'Admin' && a.Role !== 'Admin') throw new Error('Only an Admin can make someone Admin');
  if (!x.name || !/^\S+@\S+\.\S+$/.test(x.email || '')) throw new Error('Enter name and a valid email');
  if (id === a.UserID && x.role !== 'Admin') throw new Error('You cannot remove your own Admin role');
  sh('Users').getRange(u._r, 2, 1, 2).setValues([[x.name, x.email]]);
  sh('Users').getRange(u._r, 5, 1, 2).setValues([[x.role === 'Admin' ? 'Admin' : 'Employee', (x.team || '').trim()]]);
}

function editTask(t, id, x) {
  const u = me(t), k = rows('Tasks').find(r => r.ID === id);
  if (!k || k.CreatedBy !== u.UserID) throw new Error('Only the task creator can edit it');
  if (k.Status === 'Closed') throw new Error('Closed tasks cannot be edited');
  if (!String(x.title || '').trim() || !x.due) throw new Error('Enter title and due date');
  if (x.due !== k.DueDate && x.due < today()) throw new Error('Due date is in the past');
  const s = sh('Tasks');
  s.getRange(k._r, 2, 1, 2).setValues([[x.title.trim(), x.desc || '']]);
  if (x.due !== k.DueDate) { s.getRange(k._r, 8).setValue(x.due); s.getRange(k._r, 9).setValue('Open'); s.getRange(k._r, 12, 1, 2).setValues([['', '']]); }
  rec(k).forEach(a => mail(a.Email, 'Task updated: ' + x.title, tpl('Task updated', [['Task', x.title.trim()], ['Details', x.desc || '-'], ['Updated by', u.Name], ['Due date', x.due]]), { name: u.Name + ' (Task Assigner)', replyTo: u.Email }));
}

/* ---- Task progress (Assigned / In Progress / Resolved / Completed) ---- */
function taskCols() { // adds new columns to older Tasks sheets (checked once every 6 hours)
  const c = CacheService.getScriptCache(); if (c.get('TC')) return;
  const s = sh('Tasks'), h = s.getRange(1, 1, 1, Math.max(17, s.getLastColumn())).getValues()[0];
  if (h[13] !== 'Progress') s.getRange(1, 14).setValue('Progress');
  if (h[14] !== 'ClosedBy') s.getRange(1, 15).setValue('ClosedBy');
  if (h[15] !== 'Targets') s.getRange(1, 16).setValue('Targets');
  if (h[16] !== 'Files') s.getRange(1, 17).setValue('Files');
  c.put('TC', '1', 21600); delete _M.Tasks;
}
function setProgress(t, id, p) {
  const u = me(t), k = rows('Tasks').find(x => x.ID === id);
  if (!k) throw new Error('Task not found');
  const owner = k.CreatedBy === u.UserID;
  if (!owner && k.AssignedTo !== u.UserID) throw new Error('Not allowed');
  if (k.Status === 'Closed') throw new Error('Ticket already closed');
  if (!owner && status(k) === 'Blocked') throw new Error('Task is blocked. Contact the person who assigned it.');
  if (!['Assigned', 'In Progress', 'Resolved', 'Completed'].includes(p)) throw new Error('Invalid status');
  sh('Tasks').getRange(k._r, 14).setValue(p);
}

/* ---- Permissions: Admin = everything. Others: Dashboard + Notes only, plus tabs granted in "User Rights" ---- */
const RIGHTS = ['assign', 'users', 'teams'];
const can = (u, r) => u.Role === 'Admin' || String(u.Rights || '').split(',').includes(r);
function need(t, r) { const u = me(t); if (!can(u, r)) throw new Error('You do not have permission for this action'); return u; }
function guard(a, u) { if (u.Role === 'Admin' && a.Role !== 'Admin') throw new Error('Only an Admin can change an Admin account'); }
function userCols() { const c = CacheService.getScriptCache(); if (c.get('UC')) return; const s = sh('Users'); if (s.getRange(1, 7).getValue() !== 'Rights') s.getRange(1, 7).setValue('Rights'); c.put('UC', '1', 21600); delete _M.Users; }
function setRights(t, id, list) {
  adm(t); userCols();
  const u = userRow(id);
  if (u.Role === 'Admin') throw new Error('Admins already have all rights');
  logEvt(adm(t).UserID, 'RIGHTS CHANGED', id + ' -> ' + [].concat(list || []).join(','));
  sh('Users').getRange(u._r, 7).setValue([].concat(list || []).filter(x => RIGHTS.includes(x)).join(','));
}

/* ---- Delete task (only the person who assigned it) ---- */
function deleteTask(t, id) {
  const l = LockService.getScriptLock(); l.waitLock(15000);
  try {
    const u = me(t), k = rows('Tasks').find(x => x.ID === id);
    if (!k) throw new Error('Task not found');
    if (k.CreatedBy !== u.UserID) throw new Error('Only the person who assigned this task can delete it');
    if (k.Status !== 'Closed') {
      const us = rows('Users');
      [...new Set([].concat(...slotsOf(k).filter(x => !x.by).map(x => x.members)))].map(i => us.find(r => r.UserID === i)).filter(Boolean)
        .forEach(a => mail(a.Email, 'Task deleted: ' + k.Title, tpl('Task deleted', [['Task', k.Title], ['Details', k.Description || '-'], ['Deleted by', u.Name]], 'This task was removed by the person who assigned it. No further action is needed.'), { name: u.Name + ' (Task Assigner)', replyTo: u.Email }));
    }
    sh('Tasks').deleteRow(k._r);
    parseFiles(k.Files).forEach(f => { try { DriveApp.getFileById(f.id).setTrashed(true); } catch (e) {} });
  } finally { l.releaseLock(); }
}

/* ---- Task attachments: stored privately in the deployer's Google Drive (folder "Task Assigner Files"),
   downloaded only through this script after a permission check (task creator or assignees). ---- */
const BAD_EXT = /\.(exe|bat|cmd|com|msi|scr|vbs|js|jar|ps1|sh|dll)$/i;
function parseFiles(s) { try { return JSON.parse(s || '[]'); } catch (e) { return []; } }
function saveFiles(list) {
  list = [].concat(list || []);
  if (!list.length) return [];
  if (list.length > 5) throw new Error('Maximum 5 files per task');
  list.forEach(x => {
    const n = String(x.name || 'file');
    if (BAD_EXT.test(n)) throw new Error('This file type is not allowed: ' + n);
    if (String(x.data || '').length * 0.75 > 5 * 1024 * 1024) throw new Error(n + ' is larger than 5 MB');
  });
  const it = DriveApp.getFoldersByName('Task Assigner Files'), dir = it.hasNext() ? it.next() : DriveApp.createFolder('Task Assigner Files');
  return list.map(x => {
    const name = String(x.name || 'file').replace(/[\\/:*?"<>|]/g, '_').slice(0, 120), bytes = Utilities.base64Decode(x.data);
    const f = dir.createFile(Utilities.newBlob(bytes, x.type || 'application/octet-stream', name));
    return { id: f.getId(), name, size: bytes.length, type: x.type || '' };
  });
}
function downloadFile(t, id, fid) {
  const u = me(t), k = rows('Tasks').find(x => x.ID === id);
  if (!k) throw new Error('Task not found');
  if (k.CreatedBy !== u.UserID && !slotsOf(k).some(s => s.members.includes(u.UserID))) throw new Error('Not allowed');
  const f = parseFiles(k.Files).find(x => x.id === fid);
  if (!f) throw new Error('File not found');
  const b = DriveApp.getFileById(fid).getBlob();
  return { name: f.name, type: f.type || b.getContentType(), data: Utilities.base64Encode(b.getBytes()) };
}
/* Run once from the editor to give Drive permission, then deploy a new version */
function authorize() { DriveApp.getRootFolder(); MailApp.getRemainingDailyQuota(); }

/* ---- Security: hashed passwords, lockout, audit log, change password ---- */
function pepper() { const p = PropertiesService.getScriptProperties(); let v = p.getProperty('PEPPER'); if (!v) { v = Utilities.getUuid() + Utilities.getUuid(); p.setProperty('PEPPER', v); } return v; }
function hpw(pw, salt) { return Utilities.base64Encode(Utilities.computeHmacSha256Signature(String(pw), salt + pepper())); }
function mkPw(pw) { const s = Utilities.getUuid().replace(/-/g, '').slice(0, 16); return 'h1$' + s + '$' + hpw(pw, s); }
function checkPw(pw, st) { st = String(st); if (st.startsWith('h1$')) { const p = st.split('$'); return p.length === 3 && hpw(pw, p[1]) === p[2]; } return st === String(pw); }
function pwCheck(p) { p = String(p || ''); if (p.length < 8 || !/[A-Za-z]/.test(p) || !/\d/.test(p)) throw new Error('Password must be at least 8 characters with letters and numbers'); }
function changePassword(t, oldPw, newPw) {
  const u = me(t);
  if (!checkPw(oldPw, u.Password)) throw new Error('Current password is wrong');
  pwCheck(newPw);
  sh('Users').getRange(u._r, 4).setValue(mkPw(newPw));
  logEvt(u.UserID, 'PASSWORD CHANGED', '');
}
function logEvt(who, what, detail) {
  try {
    let s = sh('Log');
    if (!s) { s = SpreadsheetApp.getActive().insertSheet('Log'); s.appendRow(['Time', 'User', 'Event', 'Detail']); }
    s.appendRow([new Date(), who, what, String(detail || '')]);
  } catch (e) {}
}
/* Run ONCE from the editor: converts every existing plain-text password to a secure hash */
function migratePasswords() {
  rows('Users').forEach(u => { if (!u.Password.startsWith('h1$')) sh('Users').getRange(u._r, 4).setValue(mkPw(u.Password)); });
  Logger.log('All passwords are now hashed.');
}
