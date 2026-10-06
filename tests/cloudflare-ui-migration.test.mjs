import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
const ui=fs.readFileSync('public/portal.js','utf8');
test('migration UI has no Floot service origin',()=>assert.doesNotMatch(ui,/auxesis-portal-service\.floot\.app/));
test('migration UI does not open Floot realtime websocket',()=>{assert.doesNotMatch(ui,/api\('realtime'/);assert.doesNotMatch(ui,/new WebSocket/);});
test('Google popup accepts only same-origin Cloudflare callback',()=>assert.match(ui,/event\.origin!==location\.origin/));
