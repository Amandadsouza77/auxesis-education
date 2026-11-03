type Item=Record<string,any>;
const sid='5febba2d-82ee-5585-805f-a3fc5e89f803';
const spreadsheetId='1UrdpPD4AWU1H1Ok7Txb-sL1hIXoIEVN8u--8fZqXwUQ';
const calendarId='classroom107924035776692772286@group.calendar.google.com';
const replacement='6osm2e1mc4oj0b9n6ksjgb9kckp36b9p6pgm4b9p6phjgc9p6cp3gpj6cg';
const evidence=[
 {row:37,id:'300e998c-60fb-5fd7-b57b-ef631e5a3022',date:'Oct 13, 2026',status:'Cancelled',focus:'Holiday cancellation; no charge.',next:'Does not consume a prepaid lesson. Resume regular lessons Oct 20/21; carry two unused credits forward.',old:'60r3iohi6oq68b9o6srj6b9k61h62b9p70oj4b9m6lijicb4ckqmae9mco_20261013T091500Z',start:'2026-10-13T09:15:00Z',end:'2026-10-13T10:15:00Z'},
 {row:40,id:'50f5e66f-ae05-51a3-b97a-42d03129c2e5',date:'Oct 14, 2026',status:'Completed',focus:'Membranes and membrane transport practice questions.',next:'Initially described as cancelled, but Andie called the next day to take the 6:30 AM slot. Treat as one rescheduled lesson, not a cancelled or additional lesson; no extra credit owed for this move.',old:'c5h36dph71gmabb5c5gj6b9k68sj8bb1cko3gb9n6ssj6c9n70om6opn68_20261014T084500Z',start:'2026-10-14T10:30:00Z',end:'2026-10-14T11:30:00Z'}
];
const iso=(value:any)=>{const text=typeof value==='string'?value:value?.dateTime;return text&&Number.isFinite(Date.parse(text))?new Date(text).toISOString():'';};
export const octoberReconciliation={
 eventIds:[...evidence.map(e=>e.old),replacement],
 plan(all:Item[],input:Item,config:Item){
  const issues:Item[]=[],changes:Item[]=[],sourceRepairs:Item[]=[];
  const issue=(detail:string)=>issues.push({code:'evidence-conflict',detail});
  if(!input.complete||config.studentId!==sid||config.spreadsheetId!==spreadsheetId||config.calendarId!==calendarId||input.spreadsheetId!==spreadsheetId||input.calendarId!==calendarId)issue('The original Tracker, Calendar and Andie pilot must match the verified evidence.');
  const roster=input.students.filter((r:Item)=>r['Student ID']===sid);
  if(roster.length!==1||roster[0].Student!=='Andie Ng')issue('Students row 9 must uniquely identify Andie Ng.');
  for(const verified of evidence){
   const rows=input.lessons.filter((r:Item)=>r.Student==='Andie Ng'&&r['Lesson Date']===verified.date);
   const row=rows[0],lesson=all.find(r=>r.id===verified.id&&r._kind==='lessons'&&r.studentId===sid);
   if(rows.length!==1||!row||row._row!==verified.row||row.Status!==verified.status||row['Lesson Focus']!==verified.focus||row['Homework / Next Step']!==verified.next||row['Student ID']&&row['Student ID']!==sid){issue('Tracker Lessons row '+verified.row+' changed; re-verify the source before reconciling.');continue;}
   const old=input.events.find((e:Item)=>e.id===verified.old),event=input.events.find((e:Item)=>e.id===(verified.status==='Completed'?replacement:verified.old));
   const target=verified.status==='Completed'?replacement:verified.old;
   if(!lesson||![verified.old,target].includes(lesson.sourceMeta?.calendarEventId)||!old||old.status!=='cancelled'||!event||event.status!==(verified.status==='Completed'?'confirmed':'cancelled')||iso(event.start)!==iso(verified.start)||iso(event.end)!==iso(verified.end)||String(event.summary||'').trim()!=='Andie'){issue('Calendar evidence or existing lesson link changed for '+verified.date+'.');continue;}
   if(['Completed','No-show'].includes(lesson.status)&&lesson.status!==verified.status){issue('Existing attendance conflicts for '+verified.date+'.');continue;}
   if((lesson.notes?.covered&&lesson.notes.covered!==verified.focus)||(lesson.notes?.next&&lesson.notes.next!==verified.next)){issue('Existing teaching notes conflict for '+verified.date+'.');continue;}
   if(!row['Student ID'])sourceRepairs.push({range:'Lessons!G'+verified.row,before:'',after:sid,student:'Andie Ng',date:verified.date});
   const next=structuredClone(lesson);
   next.status=verified.status;next.start=iso(verified.start);next.end=iso(verified.end);next.hours=1;next.timeVerified=true;next.durationVerified=true;
   if(verified.status==='Cancelled')next.chargeable=false;
   next.notes={...next.notes,covered:verified.focus,next:verified.next};
   next.sourceMeta={...next.sourceMeta,calendarId,calendarEventId:target,trackerLesson:{date:verified.date,row:{...row,'Student ID':sid}},...(target!==verified.old?{replacementEvidence:{replaces:verified.old,eventId:target,verifiedOn:'2026-10-14',trackerRow:verified.row},recurringEventId:null,originalStartTime:null}:{})};
   if(JSON.stringify(next)!==JSON.stringify(lesson))changes.push({kind:'lessons',data:next});
  }
  // This is a review proposal only. No source, financial, entitlement or package writes.
  return {studentId:sid,studentName:'Andie Ng',changes:issues.length?[]:changes,sourceRepairs:issues.length?[]:sourceRepairs,issues,canApply:false,previewOnly:true,eventCount:input.events.length,trackerLessonCount:2,billingRowCount:0};
 }
};

