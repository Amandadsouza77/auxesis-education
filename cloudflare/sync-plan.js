const known=v=>v!==undefined&&v!==null&&!['','unknown','n/a','tbd','—'].includes(String(v).trim().toLowerCase());
const norm=v=>String(v||'').trim().toLowerCase();
const day=v=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Toronto',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(v));
const rowDay=v=>{const s=String(v||'').trim();if(/^\d{4}-\d{2}-\d{2}$/.test(s))return s;const t=Date.parse(s+' 12:00:00 GMT');return Number.isFinite(t)?day(new Date(t).toISOString()):'';};
const stamp=v=>typeof v==='string'?v:v?.dateTime;
const eventId=r=>r.sourceMeta?.calendarEventId;
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);

// Pure reconciliation. Calendar supplies schedule; Tracker supplies business
// identity, attendance and teaching-log evidence. It never mutates a source.
export function syncPlan(all,input,config){
 if(!config.studentId||!config.calendarId||!config.spreadsheetId||!Array.isArray(config.seriesIds)||!config.seriesIds.length)throw new Error('Configure one pilot student and their Calendar series first.');
 if(input.complete!==true||input.calendarId!==config.calendarId||input.spreadsheetId!==config.spreadsheetId)throw new Error('Both source reads must complete for the configured Calendar and Tracker.');
 const original=all.find(r=>r._kind==='students'&&r.id===config.studentId);if(!original)throw new Error('The configured pilot student is missing.');
 const matching=input.students.filter(r=>known(r['Student ID'])?r['Student ID']===original.id:norm(r.Student)===norm(config.studentName));if(matching.length!==1)throw new Error('The pilot must match exactly one Tracker row.');
 const row=matching[0],student={...original},changes=[],issues=[],lessons=all.filter(r=>r._kind==='lessons'&&r.studentId===student.id).map(r=>structuredClone(r));
 const issue=(code,detail,recordId)=>issues.push({code,detail,...(recordId?{recordId}:{})});
 for(const [header,field] of Object.entries({'Student':'name','Nationality':'nationality','Country of Residence':'country','Curriculum':'programme','Subject / Level':'subject','Package':'package','Status':'status','Pronouns':'pronouns'}))if(known(row[header]))student[field]=String(row[header]).trim();
 if(known(row.Rate)){const n=Number(row.Rate);if(!Number.isFinite(n)||n<0||n>10000)issue('invalid-rate','Tracker rate is invalid.');else student.rate=n;}if(known(row.Currency)){if(!['CAD','USD','EUR','GBP','AUD'].includes(row.Currency))issue('invalid-currency','Tracker currency is invalid.');else student.currency=row.Currency;}if(known(row.Discount)){const m=String(row.Discount).match(/^(\d+(?:\.\d+)?)%$/);if(m&&+m[1]<=100)student.discount=+m[1];else issue('discount-review','Discount needs a confirmed percentage.');}
 const parent=all.find(r=>r._kind==='parents'&&r.id===student.parentId);if(parent){const next={...parent};for(const [h,k] of [['Parent / Guardian','name'],['Parent / Guardian Mobile','mobile']])if(known(row[h]))next[k]=String(row[h]).trim();if(!equal(parent,next))changes.push({kind:'parents',data:next});}
 const pilotRows=input.lessons.filter(r=>norm(r.Student)===norm(config.studentName));
 const touched=new Set(),selected=input.events.filter(e=>config.seriesIds.includes(e.recurringEventId)||config.eventIds?.includes(e.id)||lessons.some(l=>eventId(l)===e.id));
 for(const e of selected){if(!e.id||touched.has(e.id)){issue('duplicate-event','Calendar supplied duplicate or missing event IDs.');continue;}touched.add(e.id);const matches=lessons.filter(l=>eventId(l)===e.id);if(matches.length>1){issue('duplicate-link','Several lessons share one Calendar event.',e.id);continue;}let l=matches[0];const start=stamp(e.start),end=stamp(e.end);
  if(e.status==='cancelled'){
   if(!l){
    // First sync has no Portal link yet. Link only a timed Calendar slot and
    // one corroborating cancelled Tracker row; retain all other conflicts.
    const cancelledStart=start||stamp(e.originalStartTime);
    const validTime=cancelledStart&&Number.isFinite(Date.parse(cancelledStart));
    const rows=validTime?pilotRows.filter(r=>known(r['Calendar Event ID'])?String(r['Calendar Event ID']).trim()===e.id:rowDay(r['Lesson Date'])===day(cancelledStart)):[];
    if(rows.length!==1||norm(rows[0].Status)!=='cancelled'){
     issue('unmatched-cancellation','Cancelled occurrence needs a timed Calendar slot and one matching cancelled Tracker row.',e.id);continue;
    }
    const candidates=lessons.filter(x=>!eventId(x)&&Date.parse(x.start)===Date.parse(cancelledStart));
    if(candidates.length>1){issue('ambiguous-lesson','Several imported lessons match this cancelled event.',e.id);continue;}
    l=candidates[0];
    if(!l){
     // A sparse cancellation has no duration. Do not infer hours, an end time,
     // chargeability or package debits from the recurring series.
     l={id:'calendar-'+encodeURIComponent(config.calendarId+'|'+e.id),_kind:'lessons',studentId:student.id,start:new Date(cancelledStart).toISOString(),subject:[student.programme,student.subject].filter(Boolean).join(' '),hours:null,timeVerified:!!start,durationVerified:false,status:'Cancelled',planning:[],notes:{covered:'',outcome:'',next:''},resources:[],privateNotes:''};
     lessons.push(l);
    }
   }
   if(['Completed','No-show'].includes(l.status)){issue('history-conflict','Calendar cancellation conflicts with recorded attendance.',l.id);continue;}
   l.status='Cancelled';if(l.chargeable===undefined)l.chargeable=null;
  }
  else{if(!start||!end||!Number.isFinite(Date.parse(start))||!Number.isFinite(Date.parse(end))||Date.parse(end)<=Date.parse(start)){issue('invalid-time','A lesson must have valid timed start and end values.',e.id);continue;}if(!l){const candidates=lessons.filter(x=>!eventId(x)&&Date.parse(x.start)===Date.parse(start));if(candidates.length>1){issue('ambiguous-lesson','Several imported lessons match this event.',e.id);continue;}l=candidates[0];if(!l){l={id:'calendar-'+encodeURIComponent(config.calendarId+'|'+e.id),_kind:'lessons',studentId:student.id,start,subject:[student.programme,student.subject].filter(Boolean).join(' '),hours:(Date.parse(end)-Date.parse(start))/3600000,status:'Scheduled',planning:[],notes:{covered:'',outcome:'',next:''},resources:[],privateNotes:''};lessons.push(l);}}if(['Completed','No-show'].includes(l.status)&&Date.parse(l.start)!==Date.parse(start)){issue('history-conflict','Calendar moved a lesson with recorded attendance.',l.id);continue;}if(l.status==='Cancelled'){issue('cancellation-conflict','Calendar is active but the business record is cancelled.',l.id);continue;}l.start=new Date(start).toISOString();l.end=new Date(end).toISOString();l.hours=(Date.parse(end)-Date.parse(start))/3600000;l.timeVerified=true;l.durationVerified=true;}
  l.sourceMeta={...l.sourceMeta,calendarId:config.calendarId,calendarEventId:e.id,recurringEventId:e.recurringEventId||null,originalStartTime:stamp(e.originalStartTime)||null};}
 for(const l of lessons)if(eventId(l)&&!touched.has(eventId(l))&&Date.parse(l.start)>=Date.parse(input.timeMin)&&Date.parse(l.start)<Date.parse(input.timeMax))issue('missing-event','Linked occurrence was not returned; retain it for review.',l.id);
 const duplicateDays=new Set(pilotRows.map(r=>rowDay(r['Lesson Date'])).filter((d,i,a)=>d&&a.indexOf(d)!==i)),flaggedDays=new Set();
 for(const r of pilotRows){const d=rowDay(r['Lesson Date']);if(!d){issue('invalid-date','A Tracker lesson has an invalid date.');continue;}if(duplicateDays.has(d)){if(!flaggedDays.has(d)){issue('ambiguous-log','Tracker has more than one pilot lesson row on '+d);flaggedDays.add(d);}continue;}if(d<day(input.timeMin)||d>=day(input.timeMax))continue;const found=lessons.filter(l=>day(l.start)===d);if(found.length!==1){issue('ambiguous-log','Tracker log needs one exact lesson on '+d);continue;}const l=found[0],s=norm(r.Status),e=selected.find(e=>e.id===eventId(l));if(s==='cancelled'&&e&&e.status!=='cancelled')issue('cancellation-conflict','Tracker cancelled '+d+' but Calendar is still active.',l.id);if(s==='completed'&&e?.status==='cancelled')issue('attendance-conflict','Tracker attendance conflicts with Calendar cancellation.',l.id);if(['completed','no show','no-show','cancelled'].includes(s)){const next=s==='completed'?'Completed':s==='cancelled'?'Cancelled':'No-show';if(['Completed','No-show'].includes(l.status)&&l.status!==next)issue('attendance-conflict','Existing attendance needs reconciliation.',l.id);else if(l.status!==next){l.status=next;student.balanceVerified=false;}}if(s==='cancelled'&&/(?:^|;\s*)no charge\.?$/i.test(String(r['Lesson Focus']||'').trim()))l.chargeable=false;l.notes={...l.notes};const previous=l.sourceMeta?.trackerLesson?.row||l.sourceMeta?.original||{};for(const [header,key] of [['Lesson Focus','covered'],['Homework / Next Step','next']])if(known(r[header])){const current=String(l.notes[key]||''),incoming=String(r[header]);if(current&&current!==incoming&&current!==String(previous[header]||''))issue('note-conflict','Portal and Tracker both contain different teaching notes.',l.id);else l.notes[key]=incoming;}l.sourceMeta={...l.sourceMeta,trackerLesson:{date:d,row:r,rowNumber:r._row}};}
 student.sourceData={...student.sourceData,trackerSync:row};if(!equal(original,student))changes.push({kind:'students',data:student});for(const l of lessons){const before=all.find(r=>r.id===l.id);if(!equal(before,l))changes.push({kind:'lessons',data:l});}
 const billing=input.billing.filter(r=>norm(r.Student)===norm(config.studentName)),evidence={id:'tracker-billing-'+student.id,studentId:student.id,sourceMeta:{spreadsheetId:config.spreadsheetId,sheet:'Billing'},rows:billing},old=all.find(r=>r.id===evidence.id);if(!equal(old&&Object.fromEntries(Object.entries(old).filter(([k])=>k!=='_kind')),evidence))changes.push({kind:'trackerEvidence',data:evidence});return {studentId:student.id,studentName:student.name,changes,issues,canApply:issues.length===0,eventCount:selected.length,trackerLessonCount:input.lessons.filter(r=>norm(r.Student)===norm(config.studentName)).length,billingRowCount:billing.length};
}
