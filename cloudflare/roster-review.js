const norm=v=>String(v??'').trim().toLowerCase();
const known=v=>!['','unknown','n/a','tbd','—'].includes(norm(v));
const stamp=v=>typeof v==='string'?v:v?.dateTime||v?.date||null;
const pattern=name=>new RegExp('(?:^|[^\\p{L}\\p{N}])'+norm(name).replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'(?=$|[^\\p{L}\\p{N}])','u');
const day=v=>v&&Number.isFinite(Date.parse(v))?new Intl.DateTimeFormat('en-CA',{timeZone:'America/Toronto',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(v)):null;
const rowDay=v=>/^\d{4}-\d{2}-\d{2}$/.test(String(v||''))?String(v):day(String(v||'')+' 12:00:00 GMT');
const number=v=>typeof v==='number'&&Number.isFinite(v)?v:known(v)&&/^-?\d+(?:\.\d+)?$/.test(String(v).trim())?Number(v):null;
// Titles are evidence for an owner's mapping review; omit contact details and
// links. Descriptions, attendees, teaching notes and payment references stay out.
const title=v=>String(v??'').replace(/https?:\/\/\S+/gi,'[link omitted]').replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi,'[email omitted]').replace(/\+?\d[\d ().-]{7,}\d/g,'[phone omitted]').slice(0,200);
const problem=(code,detail)=>({code,detail});

// Reassess the whitelisted saved evidence as well as fresh reads. This allows
// corrections to review rules without another Google read or business write.
export function assessRosterReview(evidence){
 const review=structuredClone(evidence),groups=new Map(review.calendarInventory.map(g=>[g.key,g]));
 for(const g of groups.values()){
  const labels=g.titleLabels.join(' ');
  g.reviewRole=/\b(?:invoice|billing|payment|renewal)\b/i.test(labels)?'operational-reminder':/\b(?:hold|tbd|tentative)\b/i.test(labels)?'provisional-schedule':g.events.length&&g.events.every(e=>e.status==='cancelled')?'cancelled-history':'lesson-candidate';
 }
 for(const student of review.students){
  const slots=new Map();
  for(const c of student.calendarCandidates){
   const g=groups.get(c.calendarGroup);if(g?.reviewRole!=='lesson-candidate')continue;
   for(const e of g.events)if(e.status!=='cancelled'&&e.start&&e.end){
    const key=Date.parse(e.start)+'|'+Date.parse(e.end),owners=slots.get(key)||new Set();owners.add(g.key);slots.set(key,owners);
   }
  }
  const duplicateGroups=new Set([...slots.values()].filter(owners=>owners.size>1).flatMap(owners=>[...owners]));
  for(const c of student.calendarCandidates){
   const g=groups.get(c.calendarGroup);c.reviewRole=g?.reviewRole||'unresolved';
   c.conflicts=c.conflicts.filter(i=>!['duplicate-active-slot','scheduled-cancellation-review','calendar-time-review'].includes(i.code));
   if(c.reviewRole==='operational-reminder')c.assessment='excluded-operational-reminder';
   else if(c.reviewRole==='provisional-schedule')c.assessment='provisional-schedule-review';
   else if(c.reviewRole==='cancelled-history')c.assessment='cancelled-history-review';
   if(c.reviewRole==='lesson-candidate'&&g.events.some(e=>e.status!=='cancelled'&&(!/^\d{4}-\d{2}-\d{2}T/.test(e.start||'')||!/^\d{4}-\d{2}-\d{2}T/.test(e.end||'')||!Number.isFinite(Date.parse(e.start))||!Number.isFinite(Date.parse(e.end))||Date.parse(e.end)<=Date.parse(e.start)))){
    c.conflicts.push(problem('calendar-time-review','Current lesson candidate lacks a valid timed Calendar start/end interval.'));
    c.assessment='insufficient-or-conflicting-evidence';
   }
   if(duplicateGroups.has(c.calendarGroup)){
    c.conflicts.push(problem('duplicate-active-slot','More than one candidate series has an active occurrence at the same actual start/end time.'));
    c.assessment='insufficient-or-conflicting-evidence';
   }
   for(const match of c.trackerDateMatches){
    const row=student.lessonEvidence.find(l=>l.row===match.trackerRow),e=g?.events.find(e=>e.id===match.eventId);
    if(norm(row?.status)==='scheduled'&&e?.status==='cancelled'){
     c.conflicts.push(problem('scheduled-cancellation-review','Tracker still says Scheduled for cancelled Calendar occurrence at row '+row.row+'.'));
     if(c.assessment==='supported-proposal-awaiting-owner-review')c.assessment='insufficient-or-conflicting-evidence';
    }
   }
   c.approved=false;
  }
  student.proposedCalendarGroups=student.calendarCandidates.filter(c=>c.assessment==='supported-proposal-awaiting-owner-review').map(c=>c.calendarGroup);
 }
 review.supportedProposalStudents=review.students.filter(s=>s.proposedCalendarGroups.length).length;
 review.reviewRules='Operational reminders, provisional schedules and wholly cancelled series cannot be proposed as current lessons. Source status and duplicate-slot conflicts remain review items.';
 return review;
}

export function rosterReview(all,input,pilot){
 if(input.complete!==true||input.calendarId!==pilot.calendarId||input.spreadsheetId!==pilot.spreadsheetId)throw new Error('Both configured source reads must complete.');
 const active=input.students.filter(r=>norm(r.Status)==='active'),remaining=active.filter(r=>norm(r.Student)!==norm(pilot.studentName));
 const groups=new Map();
 for(const e of input.events){
  const key=e.recurringEventId?'series:'+e.recurringEventId:'event:'+e.id;
  if(!groups.has(key))groups.set(key,{key,seriesId:e.recurringEventId||null,events:[],titles:new Set(),rawTitles:[]});
  const g=groups.get(key);g.rawTitles.push(norm(e.summary));if(e.summary)g.titles.add(title(e.summary));
  g.events.push({id:e.id,status:e.status,start:stamp(e.start),end:stamp(e.end),originalStartTime:stamp(e.originalStartTime),torontoDate:day(stamp(e.start)||stamp(e.originalStartTime))});
 }
 const groupList=[...groups.values()];
 for(const g of groupList)g.fullNameOwners=active.filter(r=>known(r.Student)&&g.rawTitles.some(t=>pattern(r.Student).test(t))).map(r=>String(r.Student).trim());
 const invoiceOwners=new Map();for(const b of input.billing)if(known(b['Invoice #'])){const key=norm(b['Invoice #']);invoiceOwners.set(key,(invoiceOwners.get(key)||0)+1);}
 const students=remaining.map(r=>{
  const name=String(r.Student??'').trim(),first=name.split(/\s+/)[0],identityIssues=[],financeIssues=[];
  const duplicateName=input.students.filter(s=>norm(s.Student)===norm(name)).length!==1;
  const firstNameOwners=active.filter(s=>norm(s.Student).split(/\s+/)[0]===norm(first)).map(s=>String(s.Student).trim());
  const existing=all.filter(s=>s._kind==='students'&&(known(r['Student ID'])?s.id===String(r['Student ID']).trim():norm(s.name)===norm(name)));
  if(duplicateName)identityIssues.push(problem('duplicate-tracker-name','Tracker name is not unique.'));
  if(existing.length!==1)identityIssues.push(problem('preview-identity-unresolved','No unique existing isolated preview identity; production identity has not been compared.'));
  const logs=input.lessons.filter(l=>norm(l.Student)===norm(name)),bills=input.billing.filter(b=>norm(b.Student)===norm(name));
  const invoiceFacts=bills.map(b=>{
   const billed=number(b['Amount Billed']),received=number(b['Amount Received']);
   if(known(b['Invoice #'])&&invoiceOwners.get(norm(b['Invoice #']))>1)financeIssues.push(problem('duplicate-invoice-evidence','Invoice number appears on multiple Billing rows; do not double-count it.'));
   if(norm(b.Status)==='paid'&&(!known(b['Paid On'])||received===null))financeIssues.push(problem('payment-evidence-incomplete','Paid status lacks a payment date or readable amount received on Billing row '+b._row+'.'));
   if(norm(b.Status)==='paid'&&billed!==null&&received!==null&&received<billed)financeIssues.push(problem('payment-status-review','Paid status and billed/received amounts need review on Billing row '+b._row+'.'));
   if(known(b.Currency)&&norm(b.Currency)!==norm(r.Currency))financeIssues.push(problem('billing-currency-review','Historical invoice currency differs from the current roster currency on Billing row '+b._row+'.'));
   return {row:b._row,invoiceNumber:b['Invoice #']??null,invoiceDate:b['Invoice Date']??null,dueDate:b['Due Date']??null,paidOn:b['Paid On']??null,amountBilled:b['Amount Billed']??null,amountReceived:b['Amount Received']??null,lessonCount:b['# Lessons']??null,currency:b.Currency??null,status:b.Status??null};
  });
  const rate=number(r.Rate);if(rate===null||rate<0||rate>10000)financeIssues.push(problem('rate-review','Current Tracker rate needs review.'));
  if(!['CAD','USD','EUR','GBP','AUD'].includes(r.Currency))financeIssues.push(problem('currency-review','Current Tracker currency needs review.'));
  const lessons=logs.map(l=>({row:l._row,date:l['Lesson Date'],status:l.Status,eventId:l['Calendar Event ID']||null}));
  const candidates=[];
  for(const g of groupList){
   const full=g.fullNameOwners.includes(name),firstMatch=known(first)&&g.rawTitles.some(t=>pattern(first).test(t));
   // A full name already belonging to another student is not an alias for a
   // different student who shares their first name.
   if(!full&&(!firstMatch||g.fullNameOwners.length))continue;
   const ambiguous=duplicateName||(full?g.fullNameOwners.length!==1:firstNameOwners.length!==1);
   const corroboration=[],conflicts=[];
   for(const l of logs){
    const d=rowDay(l['Lesson Date']);if(!d)continue;
    const matches=g.events.filter(e=>e.torontoDate===d);
    if(matches.length===1){
     const e=matches[0];corroboration.push({trackerRow:l._row,date:d,eventId:e.id});
     if((norm(l.Status)==='completed'&&e.status==='cancelled')||(norm(l.Status)==='cancelled'&&e.status!=='cancelled'))conflicts.push(problem('lesson-status-review','Tracker and Calendar statuses differ for row '+l._row+'.'));
     if(known(l['Calendar Event ID'])&&String(l['Calendar Event ID']).trim()!==e.id)conflicts.push(problem('tracker-event-id-conflict','Tracker event ID differs for row '+l._row+'.'));
    }else if(matches.length>1)conflicts.push(problem('ambiguous-date','Multiple Calendar occurrences share Tracker lesson date '+d+'.'));
   }
   const distinctDates=new Set(corroboration.map(x=>x.date)).size;
   const supported=!ambiguous&&!conflicts.length&&(full||distinctDates>=2);
   candidates.push({calendarGroup:g.key,basis:full?'exact-full-name':'exact-first-name-only',matchedName:full?name:first,possibleStudents:full?g.fullNameOwners:firstNameOwners,
    occurrenceCount:g.events.length,trackerDateMatches:corroboration,conflicts,
    assessment:supported?'supported-proposal-awaiting-owner-review':ambiguous?'ambiguous-name':'insufficient-or-conflicting-evidence',approved:false});
  }
  const explicitFields=Object.entries(r).filter(([k,v])=>known(v)&&/opening.*(?:balance|lessons)|(?:remaining.*lessons|paid.*through|balance.*(?:date|as of))/i.test(k)).map(([column,value])=>({column,value}));
  return {name,trackerRow:r._row,identity:{studentId:known(r['Student ID'])?String(r['Student ID']).trim():null,previewStudentId:existing.length===1?existing[0].id:null,identityIssues,lessonRows:lessons.map(l=>l.row),billingRows:invoiceFacts.map(b=>b.row)},
   arrangement:{rate:r.Rate??null,currency:r.Currency??null,package:r.Package??null,discount:r.Discount??null,schedule:r.Schedule??null,startDate:r['Start date']??null,programme:r.Curriculum??null,subject:r['Subject / Level']??null},
   calendarCandidates:candidates,proposedCalendarGroups:candidates.filter(c=>c.assessment==='supported-proposal-awaiting-owner-review').map(c=>c.calendarGroup),
   lessonEvidence:lessons,billingEvidence:invoiceFacts,
   openingBalance:{value:null,verified:false,explicitSourceFields:explicitFields,issues:[problem('opening-balance-unverified',explicitFields.length?'Opening fields require a confirmed unit, cutoff and reconciliation before a balance can be approved.':'The current Tracker roster has no explicit opening balance, carry-forward or paid-through evidence.')],financeIssues,
    explanation:'Invoice lesson quantities and historical attendance are evidence, not an opening balance. No purchases, usage, financial debits or balances were inferred.'}};
 });
 const sourceAliases={lessons:[...new Set(input.lessons.map(r=>String(r.Student??'').trim()).filter(Boolean))].filter(n=>!active.some(r=>norm(r.Student)===norm(n))),billing:[...new Set(input.billing.map(r=>String(r.Student??'').trim()).filter(Boolean))].filter(n=>!active.some(r=>norm(r.Student)===norm(n)))};
 return assessRosterReview({scope:'roster-mapping-balance-review',readOnly:true,canApply:false,studentCount:students.length,
  readWindow:{timeMin:input.timeMin,timeMax:input.timeMax,timeZone:'America/Toronto'},
  sourceScope:{previewOnly:true,productionIdentityCompared:false,openingBalancesCalculated:false,excludedNonActiveRows:input.students.length-active.length},
  supportedProposalStudents:students.filter(s=>s.proposedCalendarGroups.length).length,verifiedOpeningBalances:0,
  sourceAliases,students,calendarInventory:groupList.map(g=>({key:g.key,seriesId:g.seriesId,titleLabels:[...g.titles],fullNameOwners:g.fullNameOwners,events:g.events})),
  warning:'All proposed mappings remain unapproved. No records are imported, source values changed, automation enabled or production modified.'});
}
