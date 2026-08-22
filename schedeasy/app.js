const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const form = document.querySelector('#class-form');
const classes = JSON.parse(localStorage.getItem('schedeasy-classes') || '[]').map(item =>
  item.meetings ? item : ({
    ...item,
    meetings: [{ start: timeToMinutes(item.start), end: timeToMinutes(item.end), days: item.days }]
  })
);

const profileFields = [
  'student-name',
  'student-course',
  'student-year',
  'student-semester',
  'pdf-layout'
];

function minutesToDisplay(minutes) {
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  return `${hour > 12 ? hour - 12 : hour}:${String(minute).padStart(2, '0')} ${hour >= 12 ? 'PM' : 'AM'}`;
}

function timeToMinutes(value) {
  const [hour, minute] = value.split(':').map(Number);
  return hour * 60 + minute;
}

function parseTime(value) {
  const match = value.trim().toUpperCase().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/);

  if (!match || Number(match[2]) > 59 || Number(match[1]) > 12 || Number(match[1]) === 0) {
    return null;
  }

  let hour = Number(match[1]);

  if (match[3] === 'PM' && hour !== 12) hour += 12;
  if (match[3] === 'AM' && hour === 12) hour = 0;

  return hour * 60 + Number(match[2]);
}

function parseDays(value) {
  const dayMap = {
    M: 'Monday',
    T: 'Tuesday',
    W: 'Wednesday',
    TH: 'Thursday',
    F: 'Friday',
    S: 'Saturday',
    N: 'Sunday'
  };

  const tokens = value.trim().toUpperCase().replace(/\s/g, '').match(/TH|[MTWFSN]/g) || [];
  return tokens.map(token => dayMap[token]);
}

function parseSchedule(value) {
  const entries = value.split(';').map(entry => entry.trim()).filter(Boolean);

  if (!entries.length) throw new Error('Please enter a schedule.');

  return entries.map(entry => {
    const match = entry.match(
      /^\s*(\d{1,2}:\d{2}\s*(?:AM|PM))\s*-\s*(\d{1,2}:\d{2}\s*(?:AM|PM))\s+([A-Za-z ]+)\s*$/i
    );

    if (!match) {
      throw new Error('Use this format: 10:00AM-11:30AM TTH. Separate multiple meetings with a semicolon.');
    }

    const start = parseTime(match[1]);
    const end = parseTime(match[2]);
    const days = parseDays(match[3]);

    if (start === null || end === null || end <= start || !days.length) {
      throw new Error('Check the time and day code: M, T, W, TH, F, S, N.');
    }

    return { start, end, days };
  });
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  })[char]);
}

function saveClasses() {
  localStorage.setItem('schedeasy-classes', JSON.stringify(classes));
}

function getProfile(id) {
  return document.querySelector(`#${id}`).value.trim();
}

function setPrintLayout() {
  const layout = getProfile('pdf-layout') || 'portrait';

  document.body.classList.toggle('print-landscape', layout === 'landscape');
  document.body.classList.toggle('print-portrait', layout !== 'landscape');

  document.querySelector('#print-page-style').textContent =
    `@page { size: ${layout}; margin: 10mm; }`;
}

function updatePrintProfile() {
  document.querySelector('#print-name').textContent =
    getProfile('student-name') || 'Student schedule';

  document.querySelector('#print-course').textContent =
    [
      getProfile('student-course'),
      getProfile('student-year'),
      getProfile('student-semester')
    ].filter(Boolean).join(' · ') || 'Course · Year & section · Semester';

  setPrintLayout();
}

function saveProfile() {
  const profile = Object.fromEntries(
    profileFields.map(id => [id, getProfile(id)])
  );

  localStorage.setItem('schedeasy-profile', JSON.stringify(profile));
  updatePrintProfile();
}

function meetingHtml(item, meeting) {
  const meetLink = item.meetLink
    ? `<a href="${escapeHtml(item.meetLink)}" target="_blank" rel="noopener">Google Meet ↗</a>`
    : '';

  const mode = item.delivery === 'Online'
    ? '<em>Online</em>'
    : (item.room ? `<em>${escapeHtml(item.room)}</em>` : '');

  return `
    <article class="schedule-entry" style="--subject-color:${item.color}">
      <span class="entry-time">${minutesToDisplay(meeting.start)} – ${minutesToDisplay(meeting.end)}</span>
      <span class="entry-subject"><strong>${escapeHtml(item.code)}</strong> ${escapeHtml(item.name)}</span>
      <span class="entry-mode">${mode}${meetLink}</span>
    </article>
  `;
}

function render() {
  const schedule = document.querySelector('#schedule');
  const classItems = document.querySelector('#class-items');
  const conflicts = [];

  document.querySelector('#empty-state').hidden = classes.length !== 0;

  schedule.innerHTML = DAYS.map((day, index) => {
    const meetings = classes
      .flatMap((item, itemIndex) =>
        item.meetings
          .filter(meeting => meeting.days.includes(day))
          .map(meeting => ({ item, meeting, itemIndex }))
      )
      .sort((a, b) => a.meeting.start - b.meeting.start);

    meetings.forEach(({ item, meeting, itemIndex }) => {
      classes.forEach((other, otherIndex) => {
        if (otherIndex < itemIndex) {
          other.meetings.forEach(otherMeeting => {
            if (
              otherMeeting.days.includes(day) &&
              meeting.start < otherMeeting.end &&
              meeting.end > otherMeeting.start
            ) {
              conflicts.push(`${item.code} overlaps with ${other.code} on ${day}`);
            }
          });
        }
      });
    });

    return `
      <section class="day-card ${index % 2 === 0 ? 'day-card-dark' : 'day-card-light'}">
        <h3>${day}</h3>
        <div class="day-meetings">
          ${meetings.length
            ? meetings.map(({ item, meeting }) => meetingHtml(item, meeting)).join('')
            : '<p class="no-class">No classes</p>'}
        </div>
      </section>
    `;
  }).join('');

  classItems.innerHTML = classes.length
    ? classes.map((item, index) => `
        <div class="class-item">
          <div class="class-meta">
            <i class="color-dot" style="background:${item.color}"></i>
            <div>
              <strong>${escapeHtml(item.code)} — ${escapeHtml(item.name)}</strong>
              <p>
                ${item.meetings.map(meeting =>
                  `${meeting.days.map(day => day === 'Thursday' ? 'TH' : day[0]).join('')}
                  ${minutesToDisplay(meeting.start)}–${minutesToDisplay(meeting.end)}`
                ).join(' · ')}
                · ${item.delivery || 'On-campus'}
                ${item.delivery === 'Online' ? '' : ` · ${escapeHtml(item.room || 'Room TBA')}`}
                ${item.instructor ? ` · ${escapeHtml(item.instructor)}` : ''}
              </p>
            </div>
          </div>
          <button class="delete" data-index="${index}">Remove</button>
        </div>
      `).join('')
    : '<p class="muted">Your class details will appear here.</p>';

  const notice = document.querySelector('#conflict-notice');
  notice.hidden = !conflicts.length;
  notice.textContent = conflicts.length
    ? `Schedule conflict: ${[...new Set(conflicts)].join('; ')}.`
    : '';

  saveClasses();
}

form.addEventListener('submit', event => {
  event.preventDefault();

  const error = document.querySelector('#form-error');

  try {
    const meetings = parseSchedule(document.querySelector('#schedule-input').value);
    const delivery = document.querySelector('input[name="delivery"]:checked').value;

    classes.push({
      code: document.querySelector('#code').value.trim(),
      name: document.querySelector('#name').value.trim(),
      meetings,
      room: document.querySelector('#room').value.trim(),
      instructor: document.querySelector('#instructor').value.trim(),
      delivery,
      meetLink: document.querySelector('#meet-link').value.trim(),
      color: document.querySelector('#color').value
    });

    error.textContent = '';

    ['code', 'name', 'schedule-input', 'room', 'instructor', 'meet-link']
      .forEach(id => document.querySelector(`#${id}`).value = '');

    document.querySelector('input[name="delivery"][value="On-campus"]').checked = true;
    document.querySelector('#meet-field').hidden = true;
    document.querySelector('#color').value = '#2563eb';

    render();
  } catch (err) {
    error.textContent = err.message;
  }
});

document.querySelectorAll('input[name="delivery"]').forEach(input => {
  input.addEventListener('change', () => {
    document.querySelector('#meet-field').hidden =
      document.querySelector('input[name="delivery"]:checked').value !== 'Online';
  });
});

const printStyle = document.createElement('style');
printStyle.id = 'print-page-style';
document.head.appendChild(printStyle);

const savedProfile = JSON.parse(localStorage.getItem('schedeasy-profile') || '{}');

profileFields.forEach(id => {
  const input = document.querySelector(`#${id}`);
  input.value = savedProfile[id] || input.value;
  input.addEventListener('input', saveProfile);
  input.addEventListener('change', saveProfile);
});

document.querySelector('#class-items').addEventListener('click', event => {
  if (event.target.matches('.delete')) {
    classes.splice(Number(event.target.dataset.index), 1);
    render();
  }
});

document.querySelector('#clear-button').addEventListener('click', () => {
  if (classes.length && confirm('Remove all classes from this schedule?')) {
    classes.length = 0;
    render();
  }
});

document.querySelector('#download-button').addEventListener('click', () => {
  updatePrintProfile();
  window.print();
});

updatePrintProfile();
render();
