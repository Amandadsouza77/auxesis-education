// Store an IANA region, rather than a seasonal UTC offset, for future scheduling.
export function isRegionalTimeZone(value){
  if(typeof value!=='string'||!(value==='UTC'||/^[A-Za-z_+-]+(?:\/[A-Za-z0-9_+.-]+)+$/.test(value)))return false;
  try{new Intl.DateTimeFormat('en',{timeZone:value}).format();return true;}catch{return false;}
}
export function currentOffset(zone,date=new Date()){
  return new Intl.DateTimeFormat('en',{timeZone:zone,timeZoneName:'longOffset'}).formatToParts(date).find(p=>p.type==='timeZoneName').value.replace('GMT','UTC');
}
export function legacyOffset(value){
  const utc=/^UTC([+−-])(\d{2}):(00|15|30|45)$/.exec(value);
  const gmt=/^GMT ([+-])([0-9]{1,2}(?:\.(?:25|5|75))?)$/.exec(value);
  const hours=value==='UTC±00:00'?0:utc?(utc[1]==='+'?1:-1)*(Number(utc[2])+Number(utc[3])/60):gmt?Number(gmt[1]+gmt[2]):NaN;
  return Number.isFinite(hours)&&hours>=-12&&hours<=14;
}
export function populateTimeZones(select){
  const available=typeof Intl.supportedValuesOf==='function'?Intl.supportedValuesOf('timeZone'):JSON.parse(select.dataset.examples||'[]').map(([,zone])=>zone);
  const zones=new Set(['UTC',...available]);
  const detected=Intl.DateTimeFormat().resolvedOptions().timeZone;
  if(isRegionalTimeZone(detected))zones.add(detected);
  const date=new Date(),previous=select.value;
  select.replaceChildren(new Option('Choose a region / city',''));
  for(const zone of [...zones].sort())select.add(new Option(zone.replaceAll('_',' ')+' — '+currentOffset(zone,date)+' now',zone));
  select.value=zones.has(previous)?previous:zones.has(detected)?detected:'';
}
