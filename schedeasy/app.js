const DAYS=['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
const classes=JSON.parse(localStorage.getItem('schedeasy-classes')||'[]');
const fields=['student-name','student-course','student-year','student-semester','image-layout'];
const $=id=>document.querySelector(id);

const display=m=>{let h=Math.floor(m/60),n=m%60;return`${h>12?h-12:h}:${String(n).padStart(2,'0')} ${h>=12?'PM':'AM'}`};
const esc=s=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const time=s=>{const x=s.trim().toUpperCase().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/);if(!x)return null;let h=+x[1],m=+x[2];if(h>12||h===0||m>59)return null;if(x[3]==='PM'&&h!==12)h+=12;if(x[3]==='AM'&&h===12)h=0;return h*60+m};
const days=s=>{const map={M:'Monday',T:'Tuesday',W:'Wednesday',TH:'Thursday',F:'Friday',S:'Saturday',N:'Sunday'};return(s.toUpperCase().replace(/\s/g,'').match(/TH|[MTWFSN]/g)||[]).map(x=>map[x])};
function parseSchedule(v){
  return v.split(';').map(x=>x.trim()).filter(Boolean).map(x=>{
    const m=x.match(/^(\d{1,2}:\d{2}\s*(?:AM|PM))\s*-\s*(\d{1,2}:\d{2}\s*(?:AM|PM))\s+([A-Za-z ]+)$/i);
    if(!m)throw Error('Use: 10:00AM-11:30AM TTH');
    const start=time(m[1]),end=time(m[2]),d=days(m[3]);
    if(start===null||end===null||end<=start||!d.length)throw Error('Check time or day code.');
    return{start,end,days:d};
  });
}
function profile(){return Object.fromEntries(fields.map(x=>[x,$('#'+x).value.trim()]))}
function saveProfile(){localStorage.setItem('schedeasy-profile',JSON.stringify(profile()));header()}
function save(){localStorage.setItem('schedeasy-classes',JSON.stringify(classes))}
function header(){
  const p=profile();
  $('#print-name').textContent=`Name: ${p['student-name']||'Student name'}`;
  $('#print-course').textContent=`Course: ${p['student-course']||'—'}`;
  $('#print-year').textContent=`Year & Section: ${p['student-year']||'—'}`;
  $('#print-semester').textContent=`Semester: ${p['student-semester']||'—'}`;
  $('#printable-schedule').classList.toggle('landscape',p['image-layout']==='landscape');
}
function entry(item,m){
  const light=item.color==='#ffffff';
  const place=item.delivery==='Online'?'Online':item.room||'Room TBA';
  const link=item.meetLink?`<a href="${esc(item.meetLink)}" target="_blank">Google Meet ↗</a>`:'';
  return`<article class="schedule-entry ${light?'light':''}" style="--card:${item.color}">
    <b>${display(m.start)} – ${display(m.end)}</b>
    <span><strong>${esc(item.code)}</strong> ${esc(item.name)}</span>
    <small>${esc(place)} ${link}</small>
  </article>`;
}
function render(){
  const conflicts=[];
  $('#schedule').innerHTML=DAYS.map((day,i)=>{
    const list=classes.flatMap((item,ix)=>item.meetings.filter(m=>m.days.includes(day)).map(m=>({item,m,ix}))).sort((a,b)=>a.m.start-b.m.start);
    list.forEach(({item,m,ix})=>classes.forEach((o,oi)=>{if(oi<ix)o.meetings.forEach(x=>{if(x.days.includes(day)&&m.start<x.end&&m.end>x.start)conflicts.push(`${item.code} overlaps with ${o.code} on ${day}`)})}));
    return`<section class="day-card ${i%2===0?'dark':'light-day'}"><h3>${day}</h3><div>${list.length?list.map(x=>entry(x.item,x.m)).join(''):'<i>No classes</i>'}</div></section>`;
  }).join('');
  $('#empty-state').hidden=classes.length>0;
  $('#conflict-notice').hidden=!conflicts.length;
  $('#conflict-notice').textContent=conflicts.length?[...new Set(conflicts)].join('; '):'';
  $('#class-items').innerHTML=classes.map((x,i)=>`<div class="class-item"><span><b>${esc(x.code)}</b> — ${esc(x.name)}</span><button class="text-button remove" data-i="${i}">Remove</button></div>`).join('');
  save();
}
$('#class-form').addEventListener('submit',e=>{
  e.preventDefault();
  try{
    const delivery=document.querySelector('input[name="delivery"]:checked').value;
    classes.push({code:$('#code').value.trim(),name:$('#name').value.trim(),meetings:parseSchedule($('#schedule-input').value),room:$('#room').value.trim(),instructor:$('#instructor').value.trim(),delivery,meetLink:$('#meet-link').value.trim(),color:$('#color').value});
    e.target.reset();$('#meet-field').hidden=true;$('#form-error').textContent='';render();
  }catch(err){$('#form-error').textContent=err.message}
});
document.querySelectorAll('input[name="delivery"]').forEach(x=>x.addEventListener('change',()=>$('#meet-field').hidden=document.querySelector('input[name="delivery"]:checked').value!=='Online'));
fields.forEach(id=>{const p=JSON.parse(localStorage.getItem('schedeasy-profile')||'{}');$('#'+id).value=p[id]||$('#'+id).value;$('#'+id).addEventListener('change',saveProfile);$('#'+id).addEventListener('input',saveProfile)});
$('#class-items').addEventListener('click',e=>{if(e.target.matches('.remove')){classes.splice(+e.target.dataset.i,1);render()}});
$('#clear-button').onclick=()=>{if(confirm('Remove all classes?')){classes.length=0;render()}};
$('#download-button').onclick=async()=>{
  header();
  const canvas=await html2canvas($('#printable-schedule'),{scale:2,useCORS:true,backgroundColor:'#ffffff'});
  const a=document.createElement('a');
  a.download=`SchedEasy-${($('#student-name').value||'schedule').replace(/\s+/g,'-')}.jpg`;
  a.href=canvas.toDataURL('image/jpeg',.95);
  a.click();
};
header();render();
