const toronto=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Toronto',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
const parts=date=>Object.fromEntries(toronto.formatToParts(date).filter(p=>p.type!=='literal').map(p=>[p.type,Number(p.value)]));

// Sheets lesson dates are civil dates. Read whole Toronto days, including the
// morning of the first day, and preserve those dates across DST transitions.
export function sourceWindow(now){
 const today=parts(now);
 const midnight=offset=>{
  const target=Date.UTC(today.year,today.month-1,today.day+offset);
  let instant=target;
  for(let i=0;i<3;i++){
   const p=parts(new Date(instant)),local=Date.UTC(p.year,p.month-1,p.day,p.hour,p.minute,p.second);
   if(local===target)return new Date(instant).toISOString();
   instant+=target-local;
  }
  throw new Error('The Calendar read window could not be resolved.');
 };
 return {timeMin:midnight(-7),timeMax:midnight(56)};
}
