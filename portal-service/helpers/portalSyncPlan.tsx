import { createHash } from 'crypto';

type Item=Record<string,any>;
const hash=(v:any)=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const normal=(v:any)=>String(v||'').trim();
const localDate=(v:any)=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Toronto',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(v));
function rowDate(v:any){const s=normal(v);if(/^\d{4}-\d{2}-\d{2}$/.test(s))return s;const d=Date.parse(s+' 12:00:00 GMT');return Number.isFinite(d)?new Date(d).toISOString().slice(0,10):'';}
function instant(v:any){const raw=typeof v==='string'?v:v?.dateTime;return raw&&Number.isFinite(Date.parse(raw))?new Date(raw).toISOString():null;}

function plan(all:Item[],input:Item,config:Item){
 const {calendarId,spreadsheetId,studentId,series}=config;
 if(!calendarId||!spreadsheetId||!studentId||!Array.isArray(series)||!series.length)throw new Error('Configure one pilot student first.');
 if(input.calendarId!==calendarId||input.spreadsheetId!==spreadsheetId||input.studentId!==studentId)throw new Error('Only the configured pilot student is enabled.');
 const student=all.find(r=>r._kind==='students'&&r.id===studentId);
 if(!student)throw new Error('The pilot student mapping needs review.');
 if(!Array.isArray(input.events)||input.events.length>500||!Array.isArray(input.lessonRows)||input.lessonRows.length>1000)throw new Error('Invalid source snapshot.');
 const from=instant(input.from),through=instant(input.through);
 if(!from||!through||Date.parse(through)<=Date.parse(from)||Date.parse(through)-Date.parse(from)>100*86400000)throw new Error('Choose a sync window of at most 100 days.');
 const changes:Item[]=[],issues:Item[]=[],seen=new Set<string>();let matched=0,unchanged=0;
 const lessons=all.filter(r=>r._kind==='lessons'&&r.studentId===studentId);
 const rows=input.lessonRows.filter((r:Item)=>normal(r.Student)===student.name);
 const source=input.studentRow;
 if(!source||normal(source.Student)!==student.name)throw new Error('The pilot student is missing from the Student Tracker.');
 const s:Item={...student,programme:normal(source.Curriculum)||student.programme,subject:normal(source['Subject / Level'])||student.subject,status:normal(source.Status)||student.status,package:normal(source.Package)||student.package};
 if(source.Rate!==undefined&&Number.isFinite(Number(source.Rate))&&Number(source.Rate)>0)s.rate=Number(source.Rate);
 if(['CAD','USD','EUR','GBP','AUD'].includes(normal(source.Currency)))s.currency=normal(source.Currency);
 // Tracker does not expose an opening balance here. Never replay purchases or attendance debits.
 if(hash(s)!==hash(student))changes.push({kind:'students',data:s});
 for(const event of input.events){
  const eid=normal(event.id),recurring=normal(event.recurringEventId||event.recurring_event_id);
  const existing=lessons.filter(l=>l.sourceMeta?.calendarEventId===eid);
  if(!eid||seen.has(eid)){issues.push({code:'duplicate-event',eventId:eid});continue;}seen.add(eid);
  if(!series.includes(recurring)&&!series.some((r:string)=>eid.startsWith(r+'_'))&&existing.length===0)continue;
  if(/\b(hold|tentative)\b/i.test(event.summary||'')||event.status==='tentative')continue;
  if(existing.length>1){issues.push({code:'duplicate-portal-link',eventId:eid});continue;}
  let old=existing[0];const start=instant(event.start)||instant(old?.start),end=instant(event.end);
  if(!start){issues.push({code:'missing-event-time',eventId:eid});continue;}
  if(Date.parse(start)<Date.parse(from)||Date.parse(start)>=Date.parse(through))continue;
  if(!old){const candidates=lessons.filter(l=>!l.sourceMeta?.calendarEventId&&(instant(l.start)===start||l.timeVerified!==true&&localDate(l.start)===localDate(start)));if(candidates.length>1){issues.push({code:'ambiguous-portal-link',eventId:eid});continue;}old=candidates[0];}
  const dateKey=localDate(start),original=instant(event.originalStartTime||event.original_start_time);
  const business=rows.filter((r:Item)=>normal(r['Calendar Event ID'])===eid||!r['Calendar Event ID']&&rowDate(r['Lesson Date'])===dateKey);
  if(business.length>1){issues.push({code:'ambiguous-tracker-row',eventId:eid});continue;}
  const fallback=business.length?business:rows.filter((r:Item)=>original&&rowDate(r['Lesson Date'])===localDate(original));
  if(fallback.length>1){issues.push({code:'ambiguous-tracker-row',eventId:eid});continue;}
  const row=fallback[0];
  let status=old?.status||'Scheduled',chargeable=old?.chargeable??null;
  if(row&&['Scheduled','Completed','Cancelled','No-show','Rescheduled','Needs lesson log review'].includes(row.Status))status=row.Status;
  if(event.status==='cancelled')status='Cancelled';
  else if(row?.Status==='Cancelled')issues.push({code:'calendar-tracker-cancellation-conflict',eventId:eid});
  if(status==='Cancelled'&&row){const wording=normal(row['Lesson Focus'])+' '+normal(row['Homework / Next Step']);if(/no charge|does not consume|not charged/i.test(wording))chargeable=false;}
  const hours=end?(Date.parse(end)-Date.parse(start))/3600000:old?.hours;
  if(!hours||hours<=0||hours>3){issues.push({code:'invalid-duration',eventId:eid});continue;}
  const fingerprint=hash({eid,start,hours,status,chargeable,row:row||null,recurring,original});
  if(old?.sourceMeta?.sync?.fingerprint===fingerprint){unchanged++;matched++;continue;}
  const lesson:Item={...(old||{id:'calendar-'+hash([calendarId,eid]).slice(0,32),studentId,subject:student.subject,planning:[],resources:[],privateNotes:'',notes:{covered:'',outcome:'',next:''}}),start,hours,status,chargeable,timeVerified:true,durationVerified:true};
  if(row)lesson.notes={...lesson.notes,covered:normal(row['Lesson Focus']),next:normal(row['Homework / Next Step'])};
  const history=[...(old?.scheduleHistory||[])];if(old&&(instant(old.start)!==start||old.status!==status))history.push({start:old.start,status:old.status,changedAt:input.observedAt||new Date().toISOString(),source:'Google Calendar / Student Tracker'});
  if(history.length)lesson.scheduleHistory=history.slice(-50);
  if(status==='Cancelled')lesson.rescheduleRequired=old?.rescheduleRequired||false;
  lesson.sourceMeta={...old?.sourceMeta,calendarEventId:eid,sync:{calendarId,recurringEventId:recurring,originalStartTime:original,trackerRow:row?._row||null,fingerprint,source:input.mode==='google'?'google':'connected-app-snapshot',syncedAt:input.observedAt||new Date().toISOString()}};
  changes.push({kind:'lessons',data:lesson});matched++;
 }
 // An absent event is never treated as a cancellation; direct tombstones are required.
 return {changes,summary:{studentId,studentName:student.name,calendarId,spreadsheetId,from,through,matched,updated:changes.filter(c=>c.kind==='lessons').length,unchanged,issues,mode:input.mode==='google'?'google':'connected-app-snapshot'}};
}

export const portalSyncPlan={plan};
