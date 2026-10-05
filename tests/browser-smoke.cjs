'use strict';
const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
const {spawn}=require('node:child_process');
const runtime=process.env.CODEX_NODE_MODULES||'C:/Users/cho/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules';
const {chromium}=require(path.join(runtime,'playwright'));
const {io}=require('socket.io-client');
const bank=require('../questions');
const root=path.resolve(__dirname,'..'),url='http://127.0.0.1:3106';
const output=path.join(__dirname,'screenshots');fs.mkdirSync(output,{recursive:true});
const server=spawn(process.execPath,['server.js'],{cwd:root,env:{...process.env,PORT:'3106'},stdio:['ignore','pipe','pipe']});
let logs='',browser;server.stdout.on('data',d=>logs+=d);server.stderr.on('data',d=>logs+=d);
const errors=[],clients=[];
const ack=(socket,event,data)=>new Promise((resolve,reject)=>socket.timeout(4000).emit(event,data,(e,r)=>e?reject(e):resolve(r)));
async function waitForServer(){for(let i=0;i<40;i++){try{if((await fetch(url+'/api/network')).ok)return;}catch{}await new Promise(r=>setTimeout(r,150));}throw new Error('서버 실행 실패: '+logs);}
async function main(){
  await waitForServer();
  browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--autoplay-policy=no-user-gesture-required']});
  const host=await browser.newPage({viewport:{width:1440,height:900}});host.on('pageerror',e=>errors.push('host: '+e.message));
  await host.goto(url+'/host');await host.waitForFunction(()=>document.querySelector('#pin').textContent.length===6);
  const pin=await host.locator('#pin').textContent();
  assert.ok(await host.locator('#qr').evaluate(e=>e.naturalWidth>0));
  await host.screenshot({path:path.join(output,'01-lobby.png')});
  const pupils=[];
  for(let i=0;i<3;i++){
    const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});page.on('pageerror',e=>errors.push('student: '+e.message));
    await page.goto(url+'/play?pin='+pin);await page.locator('#nameInput').fill('테스트 '+(i+1));await page.locator('#joinButton').click();await page.locator('#playerGame').waitFor({state:'visible'});pupils.push(page);
  }
  await host.waitForFunction(()=>document.querySelector('#count').textContent==='3');
  await pupils[0].screenshot({path:path.join(output,'02-student-lobby.png')});
  await host.locator('#preview').click();await host.locator('#cinematic').waitFor({state:'visible'});
  await host.waitForFunction(()=>guardianSound.voice?.readyState>=2);
  assert.ok(await host.evaluate(()=>guardianSound.voice.duration>3));
  await host.screenshot({path:path.join(output,'03-intro.png')});
  await host.evaluate(()=>{previewStarted=Date.now()-25000;currentScene='';});await host.waitForTimeout(250);
  await host.screenshot({path:path.join(output,'04-intro-hero.png')});
  await host.locator('#skip').click();
  await host.locator('#start').click();await host.locator('#cinematic').waitFor({state:'visible'});
  await pupils[0].waitForFunction(()=>document.querySelector('#waitingTitle').textContent.includes('전자칠판'));
  await host.locator('#skip').click();await host.locator('#questionPanel').waitFor({state:'visible'});
  await host.locator('#pause').click();await pupils[0].waitForFunction(()=>document.querySelector('#playerTimer').textContent==='일시 정지');
  assert.equal(await pupils[0].locator('.player-option:disabled').count(),4);
  await host.locator('#showHint').click();await pupils[0].locator('#playerHint').waitFor({state:'visible'});
  await host.locator('#pause').click();await pupils[0].waitForFunction(()=>document.querySelectorAll('.player-option:not(:disabled)').length===4);
  await host.screenshot({path:path.join(output,'05-battle.png')});await pupils[0].screenshot({path:path.join(output,'06-student-question.png')});
  const question=await host.evaluate(()=>state.question);assert.equal(question.answer,undefined);
  const original=bank.find(q=>q.id===question.id),answer=question.options.indexOf(original.options[original.answer]);
  await pupils[0].locator('.player-option').nth(answer).click();await pupils[0].waitForFunction(()=>document.querySelector('#answerStatus').textContent.includes('제출 완료'));
  await pupils[0].reload();await pupils[0].waitForFunction(()=>document.querySelector('#answerStatus').textContent.includes('제출 완료'));assert.equal(await pupils[0].locator('.player-option.selected').count(),1);
  await pupils[1].locator('.player-option').nth((answer+1)%4).click();await pupils[2].locator('.player-option').nth(answer).click();
  await host.waitForFunction(()=>state.phase==='review');await pupils[1].locator('#playerExplanation').waitFor({state:'visible'});
  assert.equal(await host.evaluate(()=>state.roundCorrect),2);assert.equal(await host.evaluate(()=>state.shield),96);
  await host.screenshot({path:path.join(output,'07-review.png')});
  // 학생의 교사용 조작과 잘못된 인증 토큰을 차단합니다.
  const bad=io(url);clients.push(bad);await new Promise(r=>bad.on('connect',r));
  assert.equal((await ack(bad,'host-join',{pin,token:'가'.repeat(64)})).ok,false);
  assert.equal((await ack(bad,'control',{action:'reset'})).ok,false);
  bad.emit('join',{pin,name:'错参数'},3);await host.waitForTimeout(100);
  assert.ok((await fetch(url+'/api/network')).ok);
  // 잘못된 콜백 인수도 서버를 중단시키지 않습니다.
  bad.disconnect();
  let loops=0,skillSeen=false;
  while((await host.evaluate(()=>state.phase))!=='victory'&&loops<24){
    const phase=await host.evaluate(()=>state.phase);
    if(phase==='review'){await host.locator('#next').click();await host.waitForTimeout(70);}
    const s=await host.evaluate(()=>state);
    if(s.phase==='question'){
      const q=bank.find(q=>q.id===s.question.id),a=s.question.options.indexOf(q.options[q.answer]);
      for(const page of pupils){await page.waitForFunction(()=>document.querySelectorAll('.player-option:not(:disabled)').length===4);await page.locator('.player-option').nth(a).click();}
      await host.waitForFunction(()=>state.phase==='review');
      if(await host.locator('#skill').isVisible()){skillSeen=true;await host.screenshot({path:path.join(output,'08-special-skill.png')});await host.waitForTimeout(5650);}
    }
    loops++;
  }
  assert.equal(await host.evaluate(()=>state.phase),'victory');assert.ok(skillSeen);
  await host.screenshot({path:path.join(output,'09-victory.png')});
  await pupils[0].screenshot({path:path.join(output,'10-student-victory.png')});
  await host.locator('#resultAction').click();await host.waitForFunction(()=>state.phase==='lobby');
  // Reconnect freezes the teacher's clock, preserving a safe lesson pace.
  await host.locator('#start').click();await host.locator('#skip').click();await host.waitForFunction(()=>state.phase==='question');
  await host.evaluate(()=>{socket.disconnect();setTimeout(()=>socket.connect(),100);});await host.waitForFunction(()=>state.paused===true);
  await host.locator('#pause').click();await host.waitForFunction(()=>state.paused===false);
  await host.setViewportSize({width:1280,height:720});await host.screenshot({path:path.join(output,'11-battle-720p.png')});
  assert.deepEqual(errors,[]);console.log('PASS: lobby, QR, 3 pupils, WAV playback, cinematic, pause/hints, reconnect/duplicate protection, host authorization, 3 boss victory, skill, 720p.');
  console.log('Screenshots:',output);
}
main().catch(e=>{console.error(e);console.error(logs);process.exitCode=1;}).finally(async()=>{for(const c of clients)c.disconnect();if(browser)await browser.close();server.kill();});
