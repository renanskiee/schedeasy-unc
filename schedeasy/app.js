const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const START_HOUR = 7, END_HOUR = 21, SLOTS_PER_HOUR = 2;
const form = document.querySelector('#class-form');
const classes = JSON.parse(localStorage.getItem('schedeasy-classes') || '[]').map(item => item.meetings ? item : ({
  ...item,
  meetings: [{ start: timeToMinutes(item.start), end: timeToMinutes(item.end), days: item.days }]
}));
const profileFields = ['student-name', 'student-course', 'student-year'];

function minutesToDisplay(minutes) { const h = Math.floor(minutes / 60), m = minutes % 60; return `${h > 12 ? h - 12 : h}:` + String(m).padStart(2, '0') + (h >= 12 ? ' PM' : ' AM'); }
function minutesToRange(minutes) { return `${minutesToDisplay(minutes)}–${minutesToDisplay(minutes + 30)}`; }
function timeToMinutes(value) { const [h, m] = value.split(':').map(Number); return h * 60 + m; }
function parseTime(value) {
  const match = value.trim().toUpperCase().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/);
  if (!match || Number(match[2]) > 59 || Number(match[1]) > 12 || Number(match[1]) === 0) return null;
  let h = Number(match[1]); if (match[3] === 'PM' && h !== 12) h += 12; if (match[3] === 'AM' && h === 12) h = 0;
  return h * 60 + Number(match[2]);
}
function parseDays(value) {
  const map = { M:'Monday', T:'Tuesday', W:'Wednesday', TH:'Thursday', F:'Friday', S:'Saturday', N:'Sunday' };
  return ((value.trim().toUpperCase().replace(/\s/g, '').match(/TH|[MTWFSN]/g)) || []).map(token => map[token]);
}
function parseSchedule(value) {
  const entries = value.split(';').map(entry => entry.trim()).filter(Boolean);
  if (!entries.length) throw new Error('Please enter a schedule.');
  return entries.map(entry => {
    const match = entry.match(/^\s*(\d{1,2}:\d{2}\s*(?:AM|PM))\s*-\s*(\d{1,2}:\d{2}\s*(?:AM|PM))\s+([A-Za-z ]+)\s*$/i);
    if (!match) throw new Error('Use this format: 10:00AM-11:30AM TTH. Separate multiple meetings with a semicolon.');
    const start = parseTime(match[1]), end = parseTime(match[2]), days = parseDays(match[3]);
    if (start === null || end === null || end <= start || !days.length) throw new Error('Check the time and day code (M, T, W, TH, F, S, N).');
    return { start, end, days };
  });
}
function escapeHtml(value = '') { return String(value).replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;' })[char]); }
function save() { localStorage.setItem('schedeasy-classes', JSON.stringify(classes)); }
function saveProfile() { localStorage.setItem('schedeasy-profile', JSON.stringify(Object.fromEntries(profileFields.map(id => [id, document.querySelector(`#${id}`).value.trim()])))); updatePrintProfile(); }
function updatePrintProfile() { const get = id => document.querySelector(`#${id}`).value.trim(); document.querySelector('#print-name').textContent = get('student-name') || 'Student schedule'; document.querySelector('#print-course').textContent = [get('student-course'), get('student-year')].filter(Boolean).join(' · ') || 'Course · Year level'; }
function render() {
  const schedule = document.querySelector('#schedule'), classItems = document.querySelector('#class-items');
  document.querySelector('#empty-state').hidden = classes.length !== 0;
  const grid = ['<div class="day-head">Time</div>', ...DAYS.map(day => `<div class="day-head">${day.slice(0, 3)}</div>` )];
  for (let slot = 0; slot < (END_HOUR - START_HOUR) * SLOTS_PER_HOUR; slot++) {
    const minutes = START_HOUR * 60 + slot * 30; grid.push(`<div class="time">${minutesToRange(minutes)}</div>`); DAYS.forEach(() => grid.push('<div class="cell"></div>'));
  }
  const conflicts = [];
  classes.forEach((item, index) => item.meetings.forEach(meeting => meeting.days.forEach(day => {
    const col = DAYS.indexOf(day) + 2, row = Math.max(2, Math.floor((meeting.start - START_HOUR * 60) / 30) + 2), span = Math.max(1, Math.ceil((meeting.end - meeting.start) / 30));
    const where = item.delivery === 'Online' ? 'Online class' : (item.room || 'Room TBA');
    const meet = item.meetLink ? `<a href="${escapeHtml(item.meetLink)}" target="_blank" rel="noopener">Open Google Meet</a>` : '';
    grid.push(`<article class="event" style="grid-column:${col};grid-row:${row} / span ${span};background:${item.color}" title="${escapeHtml(item.name)}"><strong>${escapeHtml(item.code)}</strong><small>${escapeHtml(where)}</small>${meet}</article>`);
    classes.forEach((other, otherIndex) => { if (otherIndex < index) other.meetings.forEach(otherMeeting => { if (otherMeeting.days.includes(day) && meeting.start < otherMeeting.end && meeting.end > otherMeeting.start) conflicts.push(`${item.code} overlaps with ${other.code} on ${day}`); }); });
  })));
  schedule.innerHTML = grid.join('');
  classItems.innerHTML = classes.length ? classes.map((item, index) => `<div class="class-item"><div class="class-meta"><i class="color-dot" style="background:${item.color}"></i><div><strong>${escapeHtml(item.code)} — ${escapeHtml(item.name)}</strong><p>${item.meetings.map(m => `${m.days.map(d => d === 'Thursday' ? 'TH' : d[0]).join('')} ${minutesToDisplay(m.start)}–${minutesToDisplay(m.end)}`).join(' · ')} · ${item.delivery || 'On-campus'}${item.delivery === 'Online' ? '' : ` · ${escapeHtml(item.room || 'Room TBA')}`}${item.instructor ? ` · ${escapeHtml(item.instructor)}` : ''}${item.meetLink ? ' · Google Meet added' : ''}</p></div></div><button class="delete" data-index="${index}">Remove</button></div>`).join('') : '<p class="muted">Your class details will appear here.</p>';
  const notice = document.querySelector('#conflict-notice'); notice.hidden = !conflicts.length; notice.textContent = conflicts.length ? `Schedule conflict: ${[...new Set(conflicts)].join('; ')}.` : '';
  save();
}
form.addEventListener('submit', event => { event.preventDefault(); const error = document.querySelector('#form-error'); try { const meetings = parseSchedule(document.querySelector('#schedule-input').value); const delivery = document.querySelector('input[name="delivery"]:checked').value; error.textContent = ''; classes.push({ code: document.querySelector('#code').value.trim(), name: document.querySelector('#name').value.trim(), meetings, room: document.querySelector('#room').value.trim(), instructor: document.querySelector('#instructor').value.trim(), delivery, meetLink: document.querySelector('#meet-link').value.trim(), color: document.querySelector('#color').value }); ['code','name','schedule-input','room','instructor','meet-link'].forEach(id => document.querySelector(`#${id}`).value = ''); document.querySelector('input[name="delivery"][value="On-campus"]').checked = true; document.querySelector('#meet-field').hidden = true; document.querySelector('#color').value = '#2563eb'; render(); } catch (err) { error.textContent = err.message; } });
document.querySelectorAll('input[name="delivery"]').forEach(input => input.addEventListener('change', () => { document.querySelector('#meet-field').hidden = document.querySelector('input[name="delivery"]:checked').value !== 'Online'; }));
const savedProfile = JSON.parse(localStorage.getItem('schedeasy-profile') || '{}'); profileFields.forEach(id => { document.querySelector(`#${id}`).value = savedProfile[id] || ''; document.querySelector(`#${id}`).addEventListener('input', saveProfile); });
document.querySelector('#class-items').addEventListener('click', event => { if (event.target.matches('.delete')) { classes.splice(Number(event.target.dataset.index), 1); render(); } });
document.querySelector('#clear-button').addEventListener('click', () => { if (classes.length && confirm('Remove all classes from this schedule?')) { classes.length = 0; render(); } });
document.querySelector('#download-button').addEventListener('click', () => window.print());
updatePrintProfile();
render();
