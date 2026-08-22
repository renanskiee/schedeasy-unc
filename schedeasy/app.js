const DAYS = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday'
];

const form = document.querySelector('#class-form');
let editingIndex = null;

const profileFields = [
  'student-name',
  'student-course',
  'student-year',
  'student-semester'
];

const classes = JSON.parse(
  localStorage.getItem('schedeasy-classes') || '[]'
).map(item => ({
  ...item,
  meetings: item.meetings || [
    {
      start: timeToMinutes(item.start),
      end: timeToMinutes(item.end),
      days: item.days
    }
  ]
}));

function minutesToDisplay(minutes) {
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;

  return `${hour > 12 ? hour - 12 : hour}:${String(minute).padStart(2, '0')} ${
    hour >= 12 ? 'PM' : 'AM'
  }`;
}

function timeToMinutes(value) {
  const [hour, minute] = value.split(':').map(Number);
  return hour * 60 + minute;
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

function parseTime(value) {
  const match = value
    .trim()
    .toUpperCase()
    .match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/);

  if (
    !match ||
    Number(match[1]) > 12 ||
    Number(match[1]) === 0 ||
    Number(match[2]) > 59
  ) {
    return null;
  }

  let hour = Number(match[1]);

  if (match[3] === 'PM' && hour !== 12) hour += 12;
  if (match[3] === 'AM' && hour === 12) hour = 0;

  return hour * 60 + Number(match[2]);
}

function parseDays(value) {
  const map = {
    M: 'Monday',
    T: 'Tuesday',
    W: 'Wednesday',
    TH: 'Thursday',
    F: 'Friday',
    S: 'Saturday',
    N: 'Sunday'
  };

  const tokens = value
    .trim()
    .toUpperCase()
    .replace(/\s/g, '')
    .match(/TH|[MTWFSN]/g) || [];

  return tokens.map(token => map[token]);
}

function parseSchedule(value) {
  const entries = value
    .split(';')
    .map(item => item.trim())
    .filter(Boolean);

  if (!entries.length) {
    throw new Error('Please enter a schedule.');
  }

  return entries.map(entry => {
    const match = entry.match(
      /^\s*(\d{1,2}:\d{2}\s*(?:AM|PM))\s*-\s*(\d{1,2}:\d{2}\s*(?:AM|PM))\s+([A-Za-z ]+)\s*$/i
    );

    if (!match) {
      throw new Error(
        'Use this format: 10:00AM-11:30AM TTH. Separate meetings with a semicolon.'
      );
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

function getProfile(id) {
  return document.querySelector(`#${id}`).value.trim();
}

function updateProfile() {
  document.querySelector('#print-name').textContent =
    getProfile('student-name') || 'Student schedule';

  document.querySelector('#print-course').textContent =
    [
      getProfile('student-course'),
      getProfile('student-year'),
      getProfile('student-semester')
    ].filter(Boolean).join(' · ') || 'Course · Year & section · Semester';

  const profile = Object.fromEntries(
    profileFields.map(id => [id, getProfile(id)])
  );

  localStorage.setItem('schedeasy-profile', JSON.stringify(profile));
}

function saveClasses() {
  localStorage.setItem('schedeasy-classes', JSON.stringify(classes));
}

function meetingToInput(meeting) {
  const dayCodes = {
    Monday: 'M',
    Tuesday: 'T',
    Wednesday: 'W',
    Thursday: 'TH',
    Friday: 'F',
    Saturday: 'S',
    Sunday: 'N'
  };

  return `${minutesToDisplay(meeting.start).replace(' ', '')}-${minutesToDisplay(
    meeting.end
  ).replace(' ', '')} ${meeting.days.map(day => dayCodes[day]).join('')}`;
}

function startEditing(index) {
  const item = classes[index];

  editingIndex = index;

  document.querySelector('#code').value = item.code;
  document.querySelector('#name').value = item.name;
  document.querySelector('#schedule-input').value =
    item.meetings.map(meetingToInput).join('; ');
  document.querySelector('#room').value = item.room || '';
  document.querySelector('#instructor').value = item.instructor || '';

  document.querySelector(
    `input[name="delivery"][value="${item.delivery || 'On-campus'}"]`
  ).checked = true;

  document.querySelector('#form-error').textContent = '';
  document.querySelector('.primary[type="submit"]').textContent = 'Update class';

  form.scrollIntoView({
    behavior: 'smooth',
    block: 'center'
  });
}

function meetingHtml(item, meeting) {
  const location = item.delivery === 'Online'
    ? 'Online'
    : (item.room || 'Room TBA');

  return `
    <article class="schedule-entry">
      <span class="entry-time">
        ${minutesToDisplay(meeting.start)} – ${minutesToDisplay(meeting.end)}
      </span>
      <span class="entry-subject">
        <strong>${escapeHtml(item.code)}</strong> ${escapeHtml(item.name)}
      </span>
      <span class="entry-mode">${escapeHtml(location)}</span>
    </article>
  `;
}

function render() {
  const conflicts = [];

  document.querySelector('#empty-state').hidden = classes.length !== 0;

  document.querySelector('#schedule').innerHTML = DAYS.map((day, index) => {
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
      <section class="day-card ${index % 2 ? 'day-card-grey' : 'day-card-white'}">
        <h3>${day}</h3>
        <div class="day-meetings">
          ${
            meetings.length
              ? meetings.map(({ item, meeting }) => meetingHtml(item, meeting)).join('')
              : '<p class="no-class">No classes</p>'
          }
        </div>
      </section>
    `;
  }).join('');

  document.querySelector('#class-items').innerHTML = classes.length
    ? classes.map((item, index) => `
        <div class="class-item">
          <div>
            <strong>${escapeHtml(item.code)} — ${escapeHtml(item.name)}</strong>
            <p>
              ${item.meetings.map(meeting =>
                `${meeting.days
                  .map(day => day === 'Thursday' ? 'TH' : day[0])
                  .join('')} ${minutesToDisplay(meeting.start)}–${minutesToDisplay(meeting.end)}`
              ).join(' · ')}
              · ${escapeHtml(item.delivery || 'On-campus')}
              · ${escapeHtml(item.room || 'Room TBA')}
              ${item.instructor ? ` · ${escapeHtml(item.instructor)}` : ''}
            </p>
          </div>

          <div class="class-actions">
            <button class="edit" data-index="${index}">Edit</button>
            <button class="delete" data-index="${index}">Remove</button>
          </div>
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

  try {
    const classData = {
      code: getProfile('code'),
      name: getProfile('name'),
      meetings: parseSchedule(getProfile('schedule-input')),
      room: getProfile('room'),
      instructor: getProfile('instructor'),
      delivery: document.querySelector('input[name="delivery"]:checked').value
    };

    if (editingIndex !== null) {
      classes[editingIndex] = classData;
      editingIndex = null;
    } else {
      classes.push(classData);
    }

    document.querySelector('#form-error').textContent = '';

    ['code', 'name', 'schedule-input', 'room', 'instructor'].forEach(id => {
      document.querySelector(`#${id}`).value = '';
    });

    document.querySelector(
      'input[name="delivery"][value="On-campus"]'
    ).checked = true;

    document.querySelector('.primary[type="submit"]').textContent =
      'Add to schedule';

    render();
  } catch (error) {
    document.querySelector('#form-error').textContent = error.message;
  }
});

document.querySelector('#class-items').addEventListener('click', event => {
  const index = Number(event.target.dataset.index);

  if (event.target.matches('.edit')) {
    startEditing(index);
  }

  if (event.target.matches('.delete')) {
    classes.splice(index, 1);

    if (editingIndex === index) {
      editingIndex = null;
      document.querySelector('.primary[type="submit"]').textContent =
        'Add to schedule';
    } else if (editingIndex !== null && index < editingIndex) {
      editingIndex -= 1;
    }

    render();
  }
});

document.querySelector('#clear-button').addEventListener('click', () => {
  if (classes.length && confirm('Remove all classes from this schedule?')) {
    classes.length = 0;
    editingIndex = null;

    document.querySelector('.primary[type="submit"]').textContent =
      'Add to schedule';

    render();
  }
});

document.querySelector('#download-button').addEventListener('click', async () => {
  updateProfile();

  const button = document.querySelector('#download-button');
  button.disabled = true;
  button.textContent = 'Preparing image…';

  try {
    const canvas = await html2canvas(
      document.querySelector('#schedule-capture'),
      {
        scale: 2,
        backgroundColor: '#ffffff',
        useCORS: true
      }
    );

    const link = document.createElement('a');

    link.download = `${
      (getProfile('student-name') || 'my')
        .replace(/[^a-z0-9]/gi, '-')
        .toLowerCase()
    }-schedule.png`;

    link.href = canvas.toDataURL('image/png');
    link.click();
  } finally {
    button.disabled = false;
    button.textContent = 'Download as image';
  }
});

const savedProfile = JSON.parse(
  localStorage.getItem('schedeasy-profile') || '{}'
);

profileFields.forEach(id => {
  const field = document.querySelector(`#${id}`);

  field.value = savedProfile[id] || field.value;
  field.addEventListener('input', updateProfile);
  field.addEventListener('change', updateProfile);
});

updateProfile();
render();
