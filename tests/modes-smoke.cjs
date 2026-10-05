'use strict';
const {spawn}=require('node:child_process'),assert=require('node:assert/strict');
const {chromium}=require('C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const child=spawn(process.execPath,['server.js'],{env:{...process.env,PORT:'3117'},stdio:'ignore'});
(async()=>{let browser;try{
for(let i=0;i<40;i++){try{if((await fetch('http://localhost:3117/api/health')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
browser=await chromium.launch({channel:'msedge',headless:true});
const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto('http://localhost:3117/');assert.equal(await page.locator('.mode-card').count(),3);await page.screenshot({path:'tests/screenshots/12-modes.png'});
await page.goto('http://localhost:3117/learn');await page.locator('#begin').waitFor({state:'visible'});await page.waitForFunction(()=>!document.querySelector('#begin').disabled);await page.selectOption('#category','맞춤법');await page.click('#begin');await page.click('#help');assert.equal(await page.locator('#hint').isVisible(),true);assert.equal(await page.locator('#time').textContent(),'천천히 풀어요');await page.click('#options button');assert.equal(await page.locator('#explanation').isVisible(),true);await page.screenshot({path:'tests/screenshots/13-learn.png'});
await page.goto('http://localhost:3117/solo');await page.waitForFunction(()=>!document.querySelector('#begin').disabled);await page.click('#begin');assert.equal(await page.locator('#help').isVisible(),false);
await page.evaluate(()=>deadline=Date.now()-1);await page.waitForFunction(()=>!document.querySelector('#next').hidden);assert.match(await page.locator('#feedback').textContent(),/시간/);await page.click('#next');
for(let i=1;i<12;i++){await page.click('#options button:first-child');await page.click('#next');}
assert.equal(await page.locator('#finish').isVisible(),true);assert.match(await page.locator('#summary').textContent(),/12문제/);await page.screenshot({path:'tests/screenshots/14-solo-result.png'});await page.click('#again');assert.match(await page.locator('#progress').textContent(),/1 \/ 12/);
await page.goto('http://localhost:3117/host');await page.waitForFunction(()=>typeof state!=='undefined'&&state&&introAssetsReady);await page.click('#bots');await page.waitForFunction(()=>state.players.length===3);await page.click('#start');await page.click('#skip');await page.waitForFunction(()=>state.phase==='question');await page.click('#showHint');await page.locator('#hint').waitFor({state:'visible'});assert.equal(await page.locator('#hint').isVisible(),true);
await page.setViewportSize({width:390,height:844});await page.goto('http://localhost:3117/');assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:'tests/screenshots/15-modes-mobile.png'});assert.deepEqual(errors,[]);console.log('세 가지 놀이, 도움말, 시간 종료, 12문제 결과, 다시 풀기, 단체 진행, 휴대기기 화면 확인 통과');
}finally{await browser?.close();child.kill();}})().catch(e=>{console.error(e);process.exitCode=1;});

