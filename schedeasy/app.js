const DAYS=['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
const form=document.querySelector('#class-form');
let editingIndex=null;
const profileFields=['student-name','student-course','student-year','student-semester','download-layout'];

const classes=JSON.parse(localStorage.getItem('schedeasy-classes')||'[]').map(item=>({
  ...item,
  meetings:item.meetings||[{start:timeToMinutes(item.start),end:timeToMinutes(item.end),days:item.days}]
}));

function minutesToDisplay(minutes){
  const hour=Math.floor(minutes/60);
  return `${hour>12?hour-12:hour}:${String(minutes%60).padStart(2,'0')} ${hour>=12?'PM':'AM'}`;
}

function timeToMinutes(value){
  const [hour,minute]=value.split(':').map(Number);
  return hour*60+minute;
}

function escapeHtml(value=''){
  return String(value).replace(/[&<>"']/g,char=>({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'
  })[char]);
}

function parseTime(value){
  const match=value.trim().toUpperCase().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/);

  if(!match||+match[1]>12||+match[1]===0||+match[2]>59) return null;

  let hour=+match[1];

  if(match[3]==='PM'&&hour!==12) hour+=12;
  if(match[3]==='AM'&&hour===12) hour=0;

  return hour*60+(+match[2]);
}

function parseDays(value){
  const map={
    M:'Monday',T:'Tuesday',W:'Wednesday',TH:'Thursday',
    F:'Friday',S:'Saturday',N:'Sunday'
  };

  return (value.trim().toUpperCase().replace(/\s/g,'').match(/TH|[MTWFSN]/g)||[])
    .map(token=>map[token]);
}

function parseSchedule(value){
  const entries=value.split(';').map(item=>item.trim()).filter(Boolean);

  if(!entries.length) throw new Error('Please enter a schedule.');

  return entries.map(entry=>{
    const match=entry.match(
      /^\s*(\d{1,2}:\d{2}\s*(?:AM|PM))\s*-\s*(\d{1,2}:\d{2}\s*(?:AM|PM))\s+([A-Za-z ]+)\s*$/i
    );

    if(!match){
      throw new Error('Use this format: 10:00AM-11:30AM TTH. Separate meetings with a semicolon.');
    }

    const start=parseTime(match[1]);
    const end=parseTime(match[2]);
    const days=parseDays(match[3]);

    if(start===null||end===null||end<=start||!days.length){
      throw new Error('Check the time and day code: M, T, W, TH, F, S, N.');
    }

    return {start,end,days};
  });
}

function getValue(id){
  return document.querySelector(`#${id}`).value.trim();
}

function updateProfile(){
  document.querySelector('#print-name').textContent=
    getValue('student-name')||'Student schedule';

  document.querySelector('#print-course').textContent=
    [
      getValue('student-course'),
      getValue('student-year'),
      getValue('student-semester')
    ].filter(Boolean).join(' · ')||'Course · Year & section · Semester';

  localStorage.setItem(
    'schedeasy-profile',
    JSON.stringify(Object.fromEntries(profileFields.map(id=>[id,getValue(id)])))
  );
}

function saveClasses(){
  localStorage.setItem('schedeasy-classes',JSON.stringify(classes));
}

function meetingToInput(meeting){
  const dayCodes={
    Monday:'M',Tuesday:'T',Wednesday:'W',Thursday:'TH',
    Friday:'F',Saturday:'S',Sunday:'N'
  };

  return `${minutesToDisplay(meeting.start).replace(' ','')}-${minutesToDisplay(meeting.end).replace(' ','')} ${meeting.days.map(day=>dayCodes[day]).join('')}`;
}

function toggleMeetField(){
  const online=document.querySelector('input[name="delivery"]:checked').value==='Online';
  document.querySelector('#meet-field').hidden=!online;

  if(!online) document.querySelector('#meet-link').value='';
}

function cancelEditing(){
  editingIndex=null;

  ['code','name','schedule-input','room','instructor','meet-link'].forEach(id=>{
    document.querySelector(`#${id}`).value='';
  });

  document.querySelector('input[name="delivery"][value="On-campus"]').checked=true;
  toggleMeetField();

  document.querySelector('#form-error').textContent='';
  document.querySelector('.primary[type="submit"]').textContent='Add to schedule';
  document.querySelector('#cancel-edit-button').hidden=true;
}

function startEditing(index){
  const item=classes[index];

  editingIndex=index;
  document.querySelector('#code').value=item.code;
  document.querySelector('#name').value=item.name;
  document.querySelector('#schedule-input').value=item.meetings.map(meetingToInput).join('; ');
  document.querySelector('#room').value=item.room||'';
  document.querySelector('#instructor').value=item.instructor||'';
  document.querySelector('#meet-link').value=item.meetLink||'';

  document.querySelector(
    `input[name="delivery"][value="${item.delivery||'On-campus'}"]`
  ).checked=true;

  toggleMeetField();

  document.querySelector('#form-error').textContent='';
  document.querySelector('.primary[type="submit"]').textContent='Update class';
  document.querySelector('#cancel-edit-button').hidden=false;

  form.scrollIntoView({behavior:'smooth',block:'center'});
}

function meetingHtml(item,meeting,itemIndex,meetingIndex){
  const location=item.delivery==='Online'?'Online':(item.room||'Room TBA');

  const meet=item.delivery==='Online'&&item.meetLink
    ? `<a class="meet-link" href="${escapeHtml(item.meetLink)}" target="_blank" rel="noopener">Open Google Meet ↗</a>
       <span class="meet-qr" data-meet-link="${escapeHtml(item.meetLink)}" data-qr-id="${itemIndex}-${meetingIndex}"></span>`
    : '';

  return `
    <article class="schedule-entry">
      <span class="entry-time">${minutesToDisplay(meeting.start)} – ${minutesToDisplay(meeting.end)}</span>
      <span class="entry-subject"><strong>${escapeHtml(item.code)}</strong> ${escapeHtml(item.name)}</span>
      <span class="entry-mode">${escapeHtml(location)} ${meet}</span>
    </article>
  `;
}

function renderQRCodes(){
  if(typeof QRCode==='undefined') return;

  document.querySelectorAll('.meet-qr').forEach(element=>{
    if(element.dataset.meetLink&&!element.dataset.created){
      element.dataset.created='true';

      new QRCode(element,{
        text:element.dataset.meetLink,
        width:68,
        height:68,
        colorDark:'#1f1f1f',
        colorLight:'#ffffff',
        correctLevel:QRCode.CorrectLevel.M
      });
    }
  });
}

function render(){
  const conflicts=[];

  document.querySelector('#empty-state').hidden=classes.length!==0;

  document.querySelector('#schedule').innerHTML=DAYS.map((day,dayIndex)=>{
    const meetings=classes.flatMap((item,itemIndex)=>
      item.meetings
        .filter(meeting=>meeting.days.includes(day))
        .map((meeting,meetingIndex)=>({item,meeting,itemIndex,meetingIndex}))
    ).sort((a,b)=>a.meeting.start-b.meeting.start);

    meetings.forEach(({item,meeting,itemIndex})=>{
      classes.forEach((other,otherIndex)=>{
        if(otherIndex<itemIndex){
          other.meetings.forEach(otherMeeting=>{
            if(otherMeeting.days.includes(day)&&meeting.start<otherMeeting.end&&meeting.end>otherMeeting.start){
              conflicts.push(`${item.code} overlaps with ${other.code} on ${day}`);
            }
          });
        }
      });
    });

    return `
      <section class="day-card ${dayIndex%2?'day-card-grey':'day-card-white'}">
        <h3>${day}</h3>
        <div class="day-meetings">
          ${meetings.length
            ? meetings.map(({item,meeting,itemIndex,meetingIndex})=>
                meetingHtml(item,meeting,itemIndex,meetingIndex)
              ).join('')
            : '<p class="no-class">No classes</p>'}
        </div>
      </section>
    `;
  }).join('');

  document.querySelector('#class-items').innerHTML=classes.length
    ? classes.map((item,index)=>`
      <div class="class-item">
        <div>
          <strong>${escapeHtml(item.code)} — ${escapeHtml(item.name)}</strong>
          <p>
            ${item.meetings.map(meeting=>
              `${meeting.days.map(day=>day==='Thursday'?'TH':day[0]).join('')} ${minutesToDisplay(meeting.start)}–${minutesToDisplay(meeting.end)}`
            ).join(' · ')}
            · ${escapeHtml(item.delivery||'On-campus')}
            · ${escapeHtml(item.room||'Room TBA')}
            ${item.instructor?` · ${escapeHtml(item.instructor)}`:''}
          </p>
        </div>
        <div class="class-actions">
          <button class="edit" data-index="${index}">Edit</button>
          <button class="delete" data-index="${index}">Remove</button>
        </div>
      </div>
    `).join('')
    : '<p class="muted">Your class details will appear here.</p>';

  const notice=document.querySelector('#conflict-notice');
  notice.hidden=!conflicts.length;
  notice.textContent=conflicts.length
    ? `Schedule conflict: ${[...new Set(conflicts)].join('; ')}.`
    : '';

  renderQRCodes();
  saveClasses();
}

form.addEventListener('submit',event=>{
  event.preventDefault();

  try{
    const classData={
      code:getValue('code'),
      name:getValue('name'),
      meetings:parseSchedule(getValue('schedule-input')),
      room:getValue('room'),
      instructor:getValue('instructor'),
      delivery:document.querySelector('input[name="delivery"]:checked').value,
      meetLink:getValue('meet-link')
    };

    if(editingIndex!==null){
      classes[editingIndex]=classData;
      editingIndex=null;
    }else{
      classes.push(classData);
    }

    cancelEditing();
    render();
  }catch(error){
    document.querySelector('#form-error').textContent=error.message;
  }
});

document.querySelectorAll('input[name="delivery"]').forEach(input=>{
  input.addEventListener('change',toggleMeetField);
});

document.querySelector('#class-items').addEventListener('click',event=>{
  const index=Number(event.target.dataset.index);

  if(event.target.matches('.edit')) startEditing(index);

  if(event.target.matches('.delete')){
    classes.splice(index,1);

    if(editingIndex===index) cancelEditing();
    else if(editingIndex!==null&&index<editingIndex) editingIndex-=1;

    render();
  }
});

document.querySelector('#cancel-edit-button').addEventListener('click',cancelEditing);

document.querySelector('#clear-button').addEventListener('click',()=>{
  if(classes.length&&confirm('Remove all classes from this schedule?')){
    classes.length=0;
    cancelEditing();
    render();
  }
});

document.querySelector('#download-button').addEventListener('click',async()=>{
  updateProfile();

  const button=document.querySelector('#download-button');
  const layout=getValue('download-layout')||'portrait';
  const exportWidth=layout==='landscape'?1500:1050;

  const isIOS=
    /iPad|iPhone|iPod/.test(navigator.userAgent)||
    (navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);

  const imagePreview=isIOS?window.open('about:blank','_blank'):null;

  if(imagePreview){
    imagePreview.document.write(`
      <title>Preparing schedule…</title>
      <p style="font-family:Arial;text-align:center;padding:40px;">
        Preparing your schedule image…
      </p>
    `);
  }

  button.disabled=true;
  button.textContent='Preparing image…';

  try{
    const canvas=await html2canvas(document.querySelector('#schedule-capture'),{
      scale:2,
      backgroundColor:'#ffffff',
      useCORS:true,
      windowWidth:1600,

      onclone:clonedDocument=>{
        const capture=clonedDocument.querySelector('#schedule-capture');
        const actions=capture.querySelector('.actions');

        capture.classList.add('export-mode',`export-${layout}`);
        capture.style.width=`${exportWidth}px`;
        capture.style.maxWidth='none';

        if(actions) actions.remove();
      }
    });

    const filename=`${
      (getValue('student-name')||'my').replace(/[^a-z0-9]/gi,'-').toLowerCase()
    }-${layout}-schedule.png`;

    canvas.toBlob(blob=>{
      if(!blob) throw new Error('Unable to create the schedule image.');

      const imageUrl=URL.createObjectURL(blob);

      if(isIOS&&imagePreview){
        imagePreview.location.href=imageUrl;

        setTimeout(()=>URL.revokeObjectURL(imageUrl),60000);
      }else{
        const link=document.createElement('a');
        link.href=imageUrl;
        link.download=filename;
        document.body.appendChild(link);
        link.click();
        link.remove();

        setTimeout(()=>URL.revokeObjectURL(imageUrl),1000);
      }
    },'image/png');
  }catch(error){
    if(imagePreview) imagePreview.close();

    alert('Unable to create the schedule image. Please try again.');
    console.error(error);
  }finally{
    button.disabled=false;
    button.textContent='Download as image';
  }
});

const savedProfile=JSON.parse(localStorage.getItem('schedeasy-profile')||'{}');

profileFields.forEach(id=>{
  const field=document.querySelector(`#${id}`);
  field.value=savedProfile[id]||field.value;
  field.addEventListener('input',updateProfile);
  field.addEventListener('change',updateProfile);
});

updateProfile();
toggleMeetField();
render();
