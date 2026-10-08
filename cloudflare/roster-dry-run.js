import {syncPlan} from './sync-plan.js';

const norm=v=>String(v??'').trim().toLowerCase();
const known=v=>!['','unknown','n/a','tbd','—'].includes(norm(v));
const issue=(code,detail)=>({code,detail});
const business=s=>({rate:s?.rate??null,currency:s?.currency??null,package:s?.package??null,purchased:s?.purchased??null,used:s?.used??null,balanceVerified:s?.balanceVerified??null});

// Assess every active Tracker row in memory. These projections are never
// persisted as student/lesson records and cannot be submitted to pilot Apply.
// Full-name Calendar titles supply review candidates, never approved mappings.
export function rosterDryRun(all,input,pilot){
 if(input.complete!==true||input.calendarId!==pilot.calendarId||input.spreadsheetId!==pilot.spreadsheetId)throw new Error('Both configured source reads must complete.');
 const active=input.students.filter(r=>norm(r.Status)==='active'),excludedStatuses={};
 for(const row of input.students.filter(r=>norm(r.Status)!=='active')){const status=norm(row.Status)||'not recorded';excludedStatuses[status]=(excludedStatuses[status]||0)+1;}
 const globalIssues=[];
 if(input.students.some(r=>!known(r.Status)))globalIssues.push(issue('roster-status-review','Some Tracker rows have no confirmed status; they were not assumed active.'));
 if(!active.length)globalIssues.push(issue('no-active-roster','No explicitly Active Tracker students were found.'));
 const eventCounts=new Map();for(const e of input.events)eventCounts.set(e.id,(eventCounts.get(e.id)||0)+1);
 if(input.events.some(e=>!e.id||eventCounts.get(e.id)>1))globalIssues.push(issue('duplicate-event','Calendar contains duplicate or missing occurrence IDs.'));
 const rows=active.map(row=>{
  const name=String(row.Student??'').trim(),id=known(row['Student ID'])?String(row['Student ID']).trim():null,issues=[];
  if(!name)issues.push(issue('missing-student-name','Tracker student name is missing.'));
  if(input.students.filter(r=>norm(r.Student)===norm(name)).length!==1)issues.push(issue('duplicate-student-name','Several Tracker rows have this student name.'));
  if(id&&input.students.filter(r=>String(r['Student ID']??'').trim()===id).length!==1)issues.push(issue('duplicate-student-id','Several Tracker rows share this Student ID.'));
  const matches=all.filter(r=>r._kind==='students'&&(id?r.id===id:norm(r.name)===norm(name)));
  if(matches.length>1)issues.push(issue('ambiguous-portal-student','Several existing preview students match this Tracker row.'));
  if(id&&!matches.length&&all.some(r=>r._kind==='students'&&norm(r.name)===norm(name)))issues.push(issue('student-id-conflict','Tracker identity differs from the existing preview student.'));
  const existing=matches.length===1?matches[0]:null;
  if(!existing)issues.push(issue('opening-record-review','No existing isolated Portal record: identity and opening balances need review before any future import.'));
  const seed=existing||{_kind:'students',id:id||'dry-run-tracker-row-'+row._row,name,balanceVerified:false};
  const logs=input.lessons.filter(r=>norm(r.Student)===norm(name));
  const approvedSeries=seed.id===pilot.studentId&&norm(name)===norm(pilot.studentName)?pilot.seriesIds:[];
  const linked=new Set(all.filter(r=>r._kind==='lessons'&&r.studentId===seed.id).map(r=>r.sourceMeta?.calendarEventId).filter(Boolean));
  const explicit=new Set(logs.map(r=>String(r['Calendar Event ID']??'').trim()).filter(known));
  const confirmed=input.events.filter(e=>approvedSeries.includes(e.recurringEventId)||explicit.has(e.id)||linked.has(e.id));
  // Match the complete name bounded by non-name characters. Never use a first
  // name, email, description, fuzzy spelling or a guessed Calendar identity.
  const escaped=norm(name).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const titlePattern=name?new RegExp('(?:^|[^\\p{L}\\p{N}])'+escaped+'(?=$|[^\\p{L}\\p{N}])','u'):null;
  const titleMatches=titlePattern?input.events.filter(e=>titlePattern.test(norm(e.summary))):[];
  const candidateSeries=new Set(titleMatches.map(e=>e.recurringEventId).filter(Boolean));
  const candidates=input.events.filter(e=>titleMatches.includes(e)||candidateSeries.has(e.recurringEventId)).filter(e=>!confirmed.includes(e));
  return {row,name,seed,existing,logs,issues,confirmed,candidates,approvedSeries};
 });
 const owners=new Map();for(const r of rows)for(const e of [...r.confirmed,...r.candidates]){const set=owners.get(e.id)||new Set();set.add(r);owners.set(e.id,set);}
 const students=rows.map(r=>{
  const {row,name,seed,existing,logs,issues}=r,events=[...r.confirmed,...r.candidates];
  if(events.some(e=>owners.get(e.id).size>1))issues.push(issue('shared-calendar-event','A Calendar occurrence matches more than one active student; mapping needs review.'));
  if(!events.length)issues.push(issue('calendar-mapping-missing','No approved link or exact full-name Calendar candidate was found in this window.'));
  if(r.candidates.length)issues.push(issue('calendar-mapping-review','Full-name Calendar candidates need review; they are not approved mappings.'));
  const confirmedIds=new Set(r.confirmed.map(e=>e.id));
  let plan=null;
  if(events.length&&!issues.some(i=>['missing-student-name','duplicate-student-name','duplicate-student-id','ambiguous-portal-student','student-id-conflict','shared-calendar-event'].includes(i.code))){
   const config={...pilot,studentId:seed.id,studentName:name,seriesIds:r.approvedSeries,eventIds:events.map(e=>e.id)};
   plan=syncPlan(existing?all:[...all,seed],input,config);
   issues.push(...plan.issues.map(({code,detail,recordId})=>({code,detail,...(recordId?{recordId}:{})})));
   for(const {data:lesson} of plan.changes.filter(c=>c.kind==='lessons')){
    const sourceRow=lesson.sourceMeta?.trackerLesson?.row;
    if(known(sourceRow?.['Calendar Event ID'])&&String(sourceRow['Calendar Event ID']).trim()!==lesson.sourceMeta.calendarEventId)issues.push(issue('tracker-event-id-conflict','Tracker row '+lesson.sourceMeta.trackerLesson.rowNumber+' links a different Calendar occurrence.'));
   }
  }
  const projected=plan?.changes.find(c=>c.kind==='students')?.data;
  const changesByKind={};for(const c of plan?.changes||[])changesByKind[c.kind]=(changesByKind[c.kind]||0)+1;
  return {name,trackerRow:row._row,status:row.Status,existingPreviewStudent:!!existing,projectionOnly:!existing,
   confirmedCalendarOccurrences:r.confirmed.length,candidateCalendarOccurrences:r.candidates.length,
   seriesIds:[...new Set(events.map(e=>e.recurringEventId).filter(Boolean))],
   explicitEventIds:[...confirmedIds],trackerLessonCount:logs.length,billingRowCount:plan?.billingRowCount??input.billing.filter(b=>norm(b.Student)===norm(name)).length,
   projectedChangedRecords:plan?.changes.length??null,changesByKind,
   businessBefore:existing?business(existing):null,businessProposed:projected?business(projected):existing?business(existing):null,
   issues,reviewRequired:issues.length>0||globalIssues.length>0};
 });
 const matchedIds=new Set([...owners.keys()]);
 return {scope:'active-roster-dry-run',readOnly:true,canApply:false,activeStudentCount:active.length,trackerStudentCount:input.students.length,
  excludedStatuses,readWindow:{timeMin:input.timeMin,timeMax:input.timeMax,timeZone:'America/Toronto'},
  trackerColumns:{students:Object.keys(input.students[0]||{}).filter(k=>k!=='_row'),lessons:Object.keys(input.lessons[0]||{}).filter(k=>k!=='_row'),billing:Object.keys(input.billing[0]||{}).filter(k=>k!=='_row')},
  calendarOccurrenceCount:input.events.length,unassignedCalendarOccurrences:input.events.filter(e=>!matchedIds.has(e.id)).length,
  studentsNeedingReview:students.filter(s=>s.reviewRequired).length,issues:globalIssues,students,
  comparisonScope:'Existing isolated preview only; missing students are in-memory projections. Production Portal was not read or modified.'};
}
