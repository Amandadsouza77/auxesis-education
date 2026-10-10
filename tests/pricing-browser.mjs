import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true});
const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
let checks=0;
try{
for(const width of [320,390,768,1440]){
await page.setViewportSize({width,height:900});
for(const route of ['/','/how-tutoring-works/#fees','/subjects-programmes/','/enquire/']){
await page.goto('http://localhost:8080'+route);await page.evaluate(()=>document.fonts.ready);
assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${route} overflow ${width}`);checks++;
if(route==='/'){
assert.match(await page.locator('main').innerText(),/US\$100 per full 60-minute lesson/);
assert.match(await page.locator('.lesson-highlight').innerText(),/Expert IB Tutoring\. A Full 60 Minutes\./);
if(width===390||width===1440)await page.screenshot({path:`qa/home-${width}.png`,fullPage:true});
await page.locator('.lesson-highlight a').click();assert.ok(page.url().endsWith('/how-tutoring-works/#fees'));checks++;
}else if(route.includes('#fees')){
assert.equal(await page.locator('.discount-card').count(),4);
const text=await page.locator('#fees').innerText();for(const s of ['same subject','12 weeks in advance','up to 10%','50%','cannot be combined','complimentary 20-minute'])assert.ok(text.includes(s),s);checks++;
if(width===390||width===1440)await page.screenshot({path:`qa/fees-${width}.png`,fullPage:false});
await page.locator('#fees .actions a').first().click();assert.ok(page.url().endsWith('/enquire/'));assert.equal(await page.locator('#enquiry-form').isVisible(),true);checks++;
}else if(route.includes('subjects')){
for(const section of ['#ib','#myp'])assert.equal(await page.locator(section+' a[href="/how-tutoring-works/#fees"]').count(),1);checks++;
}
}
await page.goto('http://localhost:8080/');
if(width<1320){await page.getByRole('button',{name:'Menu',exact:true}).click();await page.locator('.main-navigation a[href="/how-tutoring-works/"]').click();assert.ok(page.url().endsWith('/how-tutoring-works/'));checks++;}
await page.goto('http://localhost:8080/');await page.locator('.home-hero .button').first().click();assert.ok(page.url().endsWith('/enquire/'));checks++;
}
assert.deepEqual(errors,[]);console.log(`PASS: ${checks} responsive layout, pricing, discount eligibility, navigation and enquiry-access checks; no browser errors.`);
}finally{await browser.close()}
