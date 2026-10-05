'use strict';
const $=id=>document.getElementById(id),socket=io(),sound=window.guardianSound;
let credentials=null,state=null,networkBase='',clockOffset=0,script=null,manifest=null,previewStarted=0,currentScene='',sceneStart=0,skillTimer=null,skillGeneration=0;
let introAssetsReady=false,previousPhase='',lastQuestionId='',toastTimer;
const storedKey='guardians-host-v2';
const show=(id,value)=>$(id).hidden=!value;
function toast(message){$('toast').textContent=message;show('toast',true);clearTimeout(toastTimer);toastTimer=setTimeout(()=>show('toast',false),4500);}
async function api(url,options){const r=await fetch(url,options);if(!r.ok)throw new Error((await r.json().catch(()=>({}))).error||'연결을 확인해 주세요.');return r.json();}
async function createRoom(){credentials=await api('/api/rooms',{method:'POST'});sessionStorage.setItem(storedKey,JSON.stringify(credentials));connectHost();}
function connectHost(){if(!credentials)return;socket.emit('host-join',credentials,async r=>{if(!r.ok){try{await createRoom();}catch(e){toast(e.message);}}else refreshQr();});}
function control(action,extra={}){socket.emit('control',{action,...extra},r=>{if(!r.ok)toast(r.message);});}
function members(container,players){const frag=document.createDocumentFragment();players.forEach(p=>{const el=document.createElement('span');el.className='member'+(!p.connected?' offline':'');el.textContent=p.name;frag.append(el);});container.replaceChildren(frag);}
function refreshQr(){if(!credentials||!networkBase){$('qr').hidden=true;return;} $('qr').hidden=false;$('qr').src='/api/qr?pin='+credentials.pin+'&base='+encodeURIComponent(networkBase);$('joinUrl').textContent=networkBase+'/play';}
function percent(id,value){$(id).style.width=Math.max(0,Math.min(100,value))+'%';}
function render(s){
  state=s;clockOffset=s.serverNow-Date.now();
  const isLobby=s.phase==='lobby',isEnd=['victory','defeat'].includes(s.phase);
  show('lobby',isLobby);show('battle',['question','review','waiting'].includes(s.phase));show('result',isEnd);
  $('pin').textContent=s.pin;$('count').textContent=s.players.filter(p=>p.connected).length;members($('roster'),s.players);$('seconds').value=s.questionSeconds;
  show('removeBots',s.players.some(p=>p.bot));$('start').disabled=!s.players.some(p=>p.connected)||!introAssetsReady;
  if(s.phase!=='intro'&&!previewStarted){show('cinematic',false);if(previousPhase==='intro')sound.stopVoice();currentScene='';}
  $('stageLabel').textContent=`한글 지키기 ${s.stage+1} / 3 · ${s.boss.category}`;$('bossName').textContent=s.boss.name;
  percent('hpBar',s.hp);$('hpValue').textContent=`남은 먹물 ${Math.ceil(s.hp)}%`;
  percent('shieldBar',s.shield);$('shieldValue').textContent=Math.ceil(s.shield)+'%';$('teamCount').textContent=`우리 반 ${s.players.filter(p=>p.connected).length}명 · 모든 정답이 하나의 힘으로`;
  percent('sejongBar',s.sejong);percent('juBar',s.ju);$('combo').textContent=s.combo>=3?s.combo+' 연속 정답!':'';
  $('bossSprite').style.filter=s.stage===1?'hue-rotate(45deg)':s.stage===2?'hue-rotate(-25deg)':'none';
  if(s.phase==='waiting'){
    $('questionText').textContent='다시 연결되면 이어서 출발합니다.';$('hostOptions').replaceChildren();$('category').textContent='지킴이 연결 대기';$('roundLabel').textContent='';$('submitted').textContent='학생 기기의 연결을 확인해 주세요.';$('reviewStatus').textContent='';show('hint',false);
  }else if(s.question){
    const q=s.question;$('questionText').textContent=q.question;$('category').textContent=q.category;$('roundLabel').textContent=`${s.round}번째 문제`;
    if(q.roundId!==lastQuestionId||s.phase==='review'){
      const frag=document.createDocumentFragment();q.options.forEach((option,i)=>{const el=document.createElement('div');el.className='host-option'+(s.phase==='review'&&i===q.answer?' correct':'');const n=document.createElement('span');n.className='option-number';n.textContent=i+1;const text=document.createElement('span');text.textContent=option;el.append(n,text);frag.append(el);});$('hostOptions').replaceChildren(frag);lastQuestionId=q.roundId;
    }
    show('hint',!!q.hint);$('hint').textContent=s.phase==='review'?q.explanation:q.hint||'';
    $('submitted').textContent=`답 ${s.submitted} / ${s.total}명`;
    $('reviewStatus').textContent=s.phase==='review'?`정답 ${s.roundCorrect}명 · ${s.stageCleared?'먹물 지우기 완료!':s.failed?'배운 내용을 확인하고 다시 도전해요.':'함께 풀이을 읽어 보세요.'}`:s.paused?'잠시 멈춤 · 함께 도움말를 나누어요.':'휴대기기에서 답을 보내하세요.';
  }
  const question=s.phase==='question';show('pause',question);show('showHint',question);show('closeRound',question);show('next',s.phase==='review'||s.phase==='waiting');
  $('pause').textContent=s.paused?'다시 시작':'잠시 멈춤';$('next').textContent=s.failed?'다시 도전 준비 →':s.stageCleared?(s.stage===2?'지키기 결과 보기 →':'다음 괴물 등장 →'):s.phase==='waiting'?'연결된 대원과 계속 →':'다음 문제 →';
  if(isEnd){
    const win=s.phase==='victory';$('resultEyebrow').textContent=win?'한글 지키기 완료':'다시 모이는 지킴이';$('resultTitle').textContent=win?'우리 반이 한글을 지켰어요!':'함께 배우면 더 강해져요.';
    $('resultDescription').textContent=win?'괴물의 먹물을 지우고 훈민정음의 빛을 되찾았습니다. 우리 말과 글을 바르게 쓰는 모험은 계속됩니다.':'맞춤법과 말의 뜻을 함께 살펴보고 다시 도전해 보세요. 실수도 배움의 한 걸음입니다.';
    const entries=[['함께 맞힌 답',s.stats.correct],['최고 연속 정답',s.stats.maxCombo],['우리 반 대원',s.players.length]];
    const frag=document.createDocumentFragment();for(const [label,n]of entries){const d=document.createElement('div'),strong=document.createElement('strong'),small=document.createElement('span');strong.textContent=n;small.textContent=label;d.append(strong,small);frag.append(d);}$('stats').replaceChildren(frag);$('resultAction').textContent=win?'새로운 한글 지키기':'다시 도전하기';
  }
  previousPhase=s.phase;
}
const headings={peace:['1446 · 마음을 전하는 글자','소중한 글자, 한글'],danger:['집현전 보호막 이상','글자가 사라지고 있다!'],boss:['훈민정음을 노리는 어둠','먹물 도깨비 등장'],sejong:['글자를 만드는 힘','세종대왕'],ju:['우리 말과 글의 지킴이','주시경 선생님'],challenge:['보호막이 무너지고 있습니다','함께할 힘이 필요해!'],summon:['그대들의 지혜를 모아 주시오','한글 지킴이, 모여라!'],team:['모든 정답이 하나의 힘으로','우리 반 모두가 주인공'],title:['세종 · 주시경의 우리말 대작전','한글 지킴이']};
function cinematicTick(){
  if(!introAssetsReady)return;
  const start=previewStarted||(state?.phase==='intro'?state.introStartedAt:0);if(!start)return;
  const elapsed=Math.max(0,((previewStarted?Date.now():Date.now()+clockOffset)-start)/1000);
  let time=0,index=script.scenes.length-1,offset=0,clip;
  for(let i=0;i<script.scenes.length;i++){const scene=script.scenes[i],duration=manifest.clips[scene.id].duration+.65;if(elapsed<time+duration){index=i;offset=elapsed-time;break;}time+=duration;offset=manifest.clips[script.scenes[index].id].duration;}
  clip=script.scenes[index];show('cinematic',true);
  if(clip.id!==currentScene){
    currentScene=clip.id;sceneStart=elapsed-offset;$('cinematic').dataset.scene=clip.scene;
    $('speaker').textContent=clip.speaker;$('dialogueText').textContent=clip.text;
    const heading=headings[clip.scene],small=document.createElement('small');small.textContent=heading[0];$('cinemaHeading').replaceChildren(small,document.createTextNode(heading[1]));
    $('sceneNumber').textContent=`${index+1} / ${script.scenes.length}`;
    $('summonNames').replaceChildren();if(['summon','team'].includes(clip.scene))for(const p of state?.players||[]){const n=document.createElement('span');n.textContent=p.name;$('summonNames').append(n);}
    sound.playVoice(manifest.clips[clip.id].file,offset);if(['sejong','ju','summon','title'].includes(clip.scene))sound.summon();if(clip.scene==='boss')sound.hurt();
  }
  const total=script.scenes.reduce((t,s)=>t+manifest.clips[s.id].duration+.65,0)+3;
  $('cinemaProgress').style.width=Math.min(100,elapsed/total*100)+'%';
  if(previewStarted&&elapsed>=total){previewStarted=0;currentScene='';show('cinematic',false);sound.stopVoice();}
}
async function enableSound(){await sound.enable();$('sound').textContent='소리 끄기';$('sound').setAttribute('aria-label','소리 끄기');}
$('start').onclick=async()=>{await enableSound();control('intro');};
$('preview').onclick=async()=>{if(!introAssetsReady)return toast('음성을 준비하고 있어요.');await enableSound();previewStarted=Date.now();currentScene='';cinematicTick();};
$('skip').onclick=()=>{if(previewStarted){previewStarted=0;currentScene='';show('cinematic',false);sound.stopVoice();}else control('skip');};
$('sound').onclick=async()=>{if(sound.enabled){sound.disable();$('sound').textContent='소리 켜기';$('sound').setAttribute('aria-label','소리 켜기');}else{await enableSound();currentScene='';}};
$('fullscreen').onclick=()=>{(document.fullscreenElement?document.exitFullscreen():document.documentElement.requestFullscreen()).catch(()=>toast('브라우저의 전체 화면 기능을 사용해 주세요.'));};
$('network').onchange=()=>{networkBase=$('network').value;localStorage.setItem('guardians-network',networkBase);refreshQr();};
$('seconds').onchange=()=>control('seconds',{value:Number($('seconds').value)});
for(const [id,action]of [['bots','bots'],['removeBots','remove-bots'],['pause','pause'],['showHint','hint'],['closeRound','close'],['next','next']])$(id).onclick=()=>control(action);
function reset(){if(confirm('전투를 끝내고 대기실로 돌아갈까요?')){control('reset');sound.stopVoice();hideSkill();}}
$('reset').onclick=reset;$('resultLobby').onclick=()=>control('reset');$('resultAction').onclick=()=>control(state?.phase==='defeat'?'retry':'reset');
socket.on('connect',()=>{$('connection').textContent='교실 연결됨';$('connection').classList.remove('offline');connectHost();});
socket.on('disconnect',()=>{$('connection').textContent='다시 연결 중';$('connection').classList.add('offline');toast('연결이 끊겼어요. 자동으로 다시 연결합니다.');});
socket.on('state',render);
function hideSkill(){clearTimeout(skillTimer);skillGeneration++;show('skill',false);}
socket.on('effect',async e=>{
  if(e.type==='hit'){sound.hit();$('bossSprite').classList.remove('hit');void $('bossSprite').offsetWidth;$('bossSprite').classList.add('hit');attackParticles(e.combo);}
  if(e.type==='guard-hit'){sound.hurt();attackParticles(0,true);}
  if(e.type==='skill'){
    show('skill',true);sound.summon();const generation=++skillGeneration;clearTimeout(skillTimer);skillTimer=setTimeout(()=>show('skill',false),5500);
    await sound.playVoice('/audio/skill-sejong.wav');if(generation===skillGeneration)await sound.playVoice('/audio/skill-ju.wav');
  }
  if(e.type==='stage'){sound.summon();toast('새로운 괴물가 나타났어요! 함께 먹물을 지워요.');}
  if(e.type==='victory')sound.playVoice('/audio/victory.wav');if(e.type==='defeat')sound.playVoice('/audio/retry.wav');
});
window.addEventListener('voice-error',()=>toast('음성을 재생하지 못했어요. 소리 켜기를 눌러 주세요.'));
setInterval(()=>{
  cinematicTick();if(!state)return;
  $('timer').textContent=state.phase==='question'?(state.paused?'잠시 멈춤':Math.max(0,Math.ceil((state.deadline-Date.now()-clockOffset)/1000))+'초'):state.phase==='review'?'함께 확인':'연결 대기';
  $('timer').classList.toggle('urgent',state.phase==='question'&&!state.paused&&state.deadline-Date.now()-clockOffset<8000);
},100);
const canvas=$('particles'),ctx=canvas.getContext('2d');let particles=[];const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
function resize(){canvas.width=innerWidth;canvas.height=innerHeight;}resize();addEventListener('resize',resize);
function attackParticles(combo,hurt=false){if(reduced)return;for(let i=0;i<14;i++)particles.push({x:innerWidth*(hurt?.5:.2),y:innerHeight*.68,vx:(hurt?-1:1)*(6+Math.random()*10),vy:(Math.random()-.5)*4,life:40,color:hurt?'#9beefa':combo%2?'#ffe395':'#8ceeff'});}
function animate(){ctx.clearRect(0,0,canvas.width,canvas.height);particles=particles.filter(p=>p.life>0);for(const p of particles){p.x+=p.vx;p.y+=p.vy;p.life--;ctx.globalAlpha=p.life/40;ctx.fillStyle=p.color;ctx.shadowColor=p.color;ctx.shadowBlur=12;ctx.beginPath();ctx.arc(p.x,p.y,3,0,Math.PI*2);ctx.fill();}ctx.globalAlpha=1;requestAnimationFrame(animate);}animate();
(async()=>{
  try{
    const [network,intro,voices]=await Promise.all([api('/api/network'),api('/intro-script.json'),api('/audio/manifest.json')]);script=intro;manifest=voices;
    introAssetsReady=script.scenes.every(s=>manifest.clips[s.id]);if(!introAssetsReady)toast('시작 이야기 음성 파일을 확인해 주세요.');
    network.urls.forEach(url=>{const o=document.createElement('option');o.value=url;o.textContent=url;$('network').append(o);});
    networkBase=network.urls.includes(localStorage.getItem('guardians-network'))?localStorage.getItem('guardians-network'):network.urls[0]||'';$('network').value=networkBase;
    if(!networkBase){$('networkHelp').textContent='무선 인터넷 연결 후 서버를 다시 실행하세요. 현재는 이 컴퓨터에서만 체험할 수 있어요.';$('joinUrl').textContent='http://localhost:'+network.port+'/play';}
    try{credentials=JSON.parse(sessionStorage.getItem(storedKey));}catch{}
    if(credentials)connectHost();else await createRoom();
    if(state)render(state);
  }catch(e){toast(e.message);$('connection').textContent='실행 상태 확인 필요';}
})();


