'use strict';
const {spawn}=require('node:child_process');
const path=require('node:path');
const assert=require('node:assert/strict');
const {chromium}=require('C:/Users/PC-1/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(__dirname,'..');let browser;
const server=spawn(process.execPath,['server.js'],{cwd:root,env:{...process.env,PORT:'3106'},stdio:'ignore'});
async function main(){
  for(let i=0;i<30;i++){try{if((await fetch('http://127.0.0.1:3106/api/network')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
  browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
  const page=await browser.newPage({viewport:{width:1440,height:900}});
  await page.addInitScript(()=>{window.voiceErrors=0;window.addEventListener('voice-error',()=>window.voiceErrors++);});
  await page.goto('http://127.0.0.1:3106/host');await page.waitForFunction(()=>introAssetsReady&&credentials);
  await page.locator('#preview').click();await page.waitForFunction(()=>guardianSound.voice?.readyState>=2);
  await page.evaluate(()=>{previewStarted=Date.now()-23500;currentScene='';});await page.waitForTimeout(1200);
  await page.screenshot({path:path.join(root,'tests/screenshots/04-intro-hero.png')});
  await page.locator('#skip').click();await page.waitForTimeout(300);
  assert.equal(await page.evaluate(()=>window.voiceErrors),0);
  await page.locator('#bots').click();await page.waitForFunction(()=>state.players.length===3);
  await page.locator('#start').click();await page.locator('#skip').click();await page.waitForFunction(()=>state.phase==='question');await page.locator('#pause').click();await page.locator('#showHint').click();await page.waitForTimeout(600);
  await page.screenshot({path:path.join(root,'tests/screenshots/05-battle.png')});
  assert.ok(await page.evaluate(()=>{
    const q=document.querySelector('#questionPanel').getBoundingClientRect();const sprites=[...document.querySelectorAll('.arena-characters .sprite')];
    return sprites.every(s=>s.getBoundingClientRect().top>=q.bottom-2);
  }),'캐릭터가 문제 패널에 가려지지 않아야 합니다.');
  await page.setViewportSize({width:1280,height:720});await page.waitForTimeout(150);
  await page.screenshot({path:path.join(root,'tests/screenshots/11-battle-720p.png')});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  assert.equal(await page.evaluate(()=>window.voiceErrors),0);console.log('PASS: actual WAV playback, scene change/skip without false errors, independent sprites, 900p and 720p layout.');
}
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{if(browser)await browser.close();server.kill();});
