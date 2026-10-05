'use strict';
const $=id=>document.getElementById(id),socket=io();
const show=(id,v)=>$(id).hidden=!v;
let state=null,identity=null,choice=null,roundId='',eligible=true,submitting=false,clockOffset=0,toastTimer;
const storageKey='guardians-player-v2';
function toast(text){$('toast').textContent=text;show('toast',true);clearTimeout(toastTimer);toastTimer=setTimeout(()=>show('toast',false),4000);}
const queryPin=new URLSearchParams(location.search).get('pin');if(queryPin)$('pinInput').value=queryPin.replace(/\D/g,'').slice(0,6);
try{identity=JSON.parse(sessionStorage.getItem(storageKey));if(queryPin&&identity?.pin!==queryPin)identity=null;}catch{}
function join(data){socket.emit('join',data,r=>{submitting=false;$('joinButton').disabled=false;if(!r.ok){$('joinError').textContent=r.message;if(identity){identity=null;sessionStorage.removeItem(storageKey);show('joinScreen',true);show('playerGame',false);}return;}
  identity={pin:r.pin,name:r.name,token:r.token};sessionStorage.setItem(storageKey,JSON.stringify(identity));show('joinScreen',false);show('playerGame',true);$('playerName').textContent=r.name;$('playerPin').textContent='입장 번호 '+r.pin;$('joinError').textContent='';
});}
$('joinForm').onsubmit=e=>{e.preventDefault();if(!socket.connected){$('joinError').textContent='서버 연결을 기다려 주세요.';return;}if(submitting)return;submitting=true;$('joinButton').disabled=true;join({pin:$('pinInput').value,name:$('nameInput').value});};
$('leave').onclick=()=>{if(confirm('현재 지킴이를 나가고 다른 대기실로 입장할까요?')){sessionStorage.removeItem(storageKey);location.href='/play';}};
socket.on('connect',()=>{$('connection').textContent='연결됨';$('connection').classList.remove('offline');if(identity)join(identity);});
socket.on('disconnect',()=>{$('connection').textContent='재연결 중';$('connection').classList.add('offline');for(const b of $('playerOptions').children)b.disabled=true;toast('자동으로 다시 연결하고 있어요. 답은 보존됩니다.');});
socket.on('personal',p=>{choice=p.answer;eligible=p.eligible;if(state)render(state);});
function percentage(id,n){$(id).style.width=Math.max(0,Math.min(100,n))+'%';}
function render(s){
  state=s;clockOffset=s.serverNow-Date.now();if(!identity)return;
  $('playerHp').textContent=Math.ceil(s.hp)+'%';$('playerShield').textContent=Math.ceil(s.shield)+'%';percentage('playerHpBar',s.hp);percentage('playerShieldBar',s.shield);
  const asking=['question','review'].includes(s.phase),final=['victory','defeat'].includes(s.phase);
  show('waiting',!asking&&!final);show('playerQuestion',asking);show('playerFinal',final);
  if(!asking&&!final){
    $('waitingTitle').textContent=s.phase==='intro'?'전자칠판을 바라보세요!':s.phase==='waiting'?'지킴이가 다시 모이고 있어요.':'지킴이 참여 완료!';
    $('waitingText').textContent=s.phase==='intro'?'세종대왕과 주시경 선생님이 우리 반을 부르고 있어요.':s.phase==='waiting'?'선생님이 다음 문제를 시작하면 함께할 수 있어요.':'친구들이 모이면 선생님이 모험을 시작합니다. 서로 도움말를 나누며 힘을 합쳐요.';
    const frag=document.createDocumentFragment();s.players.filter(p=>p.connected).forEach(p=>{const span=document.createElement('span');span.className='member';span.textContent=p.name;frag.append(span);});$('waitingMembers').replaceChildren(frag);
    if(s.phase==='lobby'){roundId='';choice=null;}return;
  }
  if(final){$('playerFinalTitle').textContent=s.phase==='victory'?'한글 지키기 성공!':'다시 도전해요!';$('playerFinalText').textContent=s.phase==='victory'?'우리 반의 힘으로 훈민정음을 지켰어요. 친구들과 함께 박수를 보내 주세요!':'실수는 배움의 시작! 함께 풀이을 읽고 더 강한 지킴이가 되어 돌아와요.';return;}
  const q=s.question;if(!q)return;
  if(roundId!==q.roundId){roundId=q.roundId;choice=null;submitting=false;eligible=true;}
  $('playerCategory').textContent=`${q.category} · 도전 ${s.stage+1}`;$('playerQuestionText').textContent=q.question;show('playerHint',!!q.hint&&s.phase==='question');$('playerHint').textContent=q.hint||'';
  const frag=document.createDocumentFragment();q.options.forEach((option,i)=>{
    const b=document.createElement('button');b.type='button';b.className='player-option';if(choice===i)b.classList.add('selected');if(s.phase==='review'&&i===q.answer)b.classList.add('correct');if(s.phase==='review'&&choice===i&&i!==q.answer)b.classList.add('wrong');
    b.disabled=s.phase!=='question'||s.paused||choice!==null||submitting||!socket.connected||!eligible;
    const n=document.createElement('span');n.className='option-number';n.textContent=i+1;const t=document.createElement('span');t.textContent=option;b.append(n,t);
    b.onclick=()=>{if(submitting||choice!==null)return;submitting=true;render(state);socket.timeout(5000).emit('answer',{roundId:q.roundId,choice:i},(err,r)=>{submitting=false;if(err){toast('답 확인 중입니다. 다시 연결하면 제출 여부를 확인할 수 있어요.');socket.disconnect();socket.connect();return;}if(r.ok)choice=r.choice;else toast(r.message);render(state);});};frag.append(b);
  });$('playerOptions').replaceChildren(frag);
  if(s.phase==='review')$('answerStatus').textContent=choice===null?'다음 문제에서 함께 도전해요.':choice===q.answer?'우리 반 공격에 힘을 보탰어요!':'괜찮아요. 풀이을 읽고 다음 문제를 준비해요.';
  else $('answerStatus').textContent=!eligible?'다음 문제부터 참여할 수 있어요.':submitting?'답을 보내는 중…':choice!==null?'답 보내기 완료! 친구들을 응원해 주세요.':s.paused?'잠시 멈춤 · 친구들과 도움말를 나누세요.':'정답을 골라 우리 반의 힘을 모아요.';
  show('playerExplanation',s.phase==='review');$('playerExplanation').textContent=q.explanation||'';
}
socket.on('state',render);socket.on('effect',e=>{if(e.type==='skill')toast('함께 쓰는 큰 힘! 전자칠판을 바라보세요!');});
setInterval(()=>{if(!state)return;$('playerTimer').textContent=state.phase==='review'?'함께 확인':state.paused?'잠시 멈춤':Math.max(0,Math.ceil((state.deadline-Date.now()-clockOffset)/1000))+'초';$('playerTimer').classList.toggle('urgent',state.phase==='question'&&!state.paused&&state.deadline-Date.now()-clockOffset<8000);},150);

