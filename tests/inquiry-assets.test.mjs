import test from 'node:test';
import assert from 'node:assert/strict';
import {approvedAsset} from '../scripts/inquiry-release.mjs';
test('repeat inquiry releases recognize only the approved app with retained native form bootstrap',()=>{
 const original=Buffer.from('const forms=["native-inquiry-only"];\nold();\n');
 const source='const forms=["ordinary-forms"];\nupdated();\n';
 const deployed=Buffer.from('const forms=["native-inquiry-only"];\nupdated();\n');
 assert.equal(approvedAsset('app.js',original,deployed,source),true);
 assert.equal(approvedAsset('app.js',original,Buffer.from(deployed+'unexpected();'),source),false);
 assert.equal(approvedAsset('app.js',original,Buffer.from(source),source),false);
 assert.equal(approvedAsset('portal.js',original,deployed,source),false);
 assert.equal(approvedAsset('portal.js',original,original,source),true);
});
