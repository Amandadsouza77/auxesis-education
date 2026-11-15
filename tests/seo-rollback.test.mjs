import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync,copyFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';

for (const mode of ['unchanged','different-release','own-release']) test('rollback guard: '+mode,()=>{
 const root=mkdtempSync(join(tmpdir(),'auxesis-rollback-test-'));
 try {
  mkdirSync(join(root,'work'));
  mkdirSync(join(root,'content'));
  copyFileSync('content/approved-public-corrections.json',join(root,'content','approved-public-corrections.json'));
  writeFileSync(join(root,'work','approved-audit-release.json'),JSON.stringify({deployment:'saved-deployment'}));
  const script=resolve('scripts/approved-audit-release.mjs');
  const runner=`
   let current=${JSON.stringify(mode)}==='unchanged'?'saved-deployment':'new-deployment';
   let sha=${JSON.stringify(mode)}==='different-release'?'someone-else':'candidate-sha';
   let writes=0;
   process.env.GITHUB_SHA='candidate-sha';
   globalThis.fetch=async(url,options={})=>{
    if(options.method==='POST'){writes++;current='saved-deployment';}
    const result={canonical_deployment:{id:current,deployment_trigger:{metadata:{commit_hash:sha}}}};
    return {ok:true,json:async()=>({success:true,result})};
   };
   process.argv=[process.execPath,${JSON.stringify(script)},'rollback'];
   await import(${JSON.stringify(pathToFileURL(script).href)});
   process.on('exit',()=>console.log('MOCK_WRITES='+writes));
  `;
  const result=spawnSync(process.execPath,['--input-type=module','-e',runner],{cwd:root,encoding:'utf8'});
  assert.equal(result.status,mode==='different-release'?1:0,result.stderr);
  assert.match(result.stdout,new RegExp('MOCK_WRITES='+(mode==='own-release'?1:0)));
 } finally {rmSync(root,{recursive:true,force:true});}
});
