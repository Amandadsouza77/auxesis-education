// Pilot-only reconciliation facts. Never retain teaching notes, contacts,
// OAuth tokens, provider payloads or other students in diagnostic metadata.
export function pilotDiagnostics(all,input,config,plan){
 const original=all.find(r=>r._kind==='students'&&r.id===config.studentId);
 const proposed=plan.changes.find(c=>c.kind==='students')?.data||original;
 const normalize=v=>String(v||'').trim().toLowerCase();
 const tracker=input.students.find(r=>r['Student ID']?r['Student ID']===config.studentId:normalize(r.Student)===normalize(config.studentName));
 const ids=new Set(all.filter(r=>r._kind==='lessons'&&r.studentId===config.studentId).map(r=>r.sourceMeta?.calendarEventId));
 const events=input.events.filter(e=>config.seriesIds.includes(e.recurringEventId)||config.eventIds?.includes(e.id)||ids.has(e.id));
 const stamp=v=>typeof v==='string'?v:v?.dateTime||null;
 const business=s=>({rate:s?.rate??null,currency:s?.currency??null,package:s?.package??null,purchased:s?.purchased??null,used:s?.used??null,balanceVerified:s?.balanceVerified??null});
 return {
  readWindow:{timeMin:input.timeMin,timeMax:input.timeMax,timeZone:'America/Toronto'},
  trackerStudent:{rowNumber:tracker?._row??null,rate:tracker?.Rate??null,currency:tracker?.Currency??null,package:tracker?.Package??null},
  portalBefore:business(original),portalProposed:business(proposed),
  calendar:events.map(e=>({eventId:e.id,status:e.status,start:stamp(e.start),end:stamp(e.end),originalStartTime:stamp(e.originalStartTime)})),
  trackerLessons:input.lessons.filter(r=>normalize(r.Student)===normalize(config.studentName)).map(r=>({rowNumber:r._row??null,date:r['Lesson Date'],status:r.Status,eventId:r['Calendar Event ID']||null})),
  proposedLessons:plan.changes.filter(c=>c.kind==='lessons').map(({data:l})=>({id:l.id,eventId:l.sourceMeta?.calendarEventId,start:l.start,end:l.end??null,hours:l.hours??null,status:l.status,chargeable:l.chargeable??null,trackerRowNumber:l.sourceMeta?.trackerLesson?.rowNumber??null}))
 };
}
