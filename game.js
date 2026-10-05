'use strict';
const {randomInt,randomUUID} = require('node:crypto');
const bank = require('./questions');
const BOSSES = [
  {name:'먹물 괴물',subtitle:'말의 뜻을 흐리는 먹물',category:'맞춤법',color:'#c677ff'},
  {name:'뒤죽박죽 도깨비',subtitle:'서로의 마음을 가리는 가림막',category:'순우리말 · 다듬은 말',color:'#ff977a'},
  {name:'깜빡깜빡 괴물',subtitle:'글자의 자리를 뒤섞는 어둠',category:'띄어쓰기',color:'#a6a0ff'}
];
function shuffle(array) { const out=[...array]; for(let i=out.length-1;i>0;i--){const j=randomInt(i+1);[out[i],out[j]]=[out[j],out[i]];} return out; }
class Game {
  constructor(pin,hostToken,now=()=>Date.now()) {
    this.pin=pin; this.hostToken=hostToken; this.now=now; this.players=new Map();
    this.phase='lobby';this.stage=0;this.round=0;this.hp=100;this.shield=100;this.sejong=0;this.ju=0;
    this.correct=0;this.wrong=0;this.missing=0;this.maxCombo=0;this.combo=0;this.events=[];
    this.deadline=0;this.paused=false;this.remaining=0;this.question=null;this.lastSeen=now();
    this.questionSeconds=30;this.used=new Set();this.roster=[];this.answers=new Map();this.stageCleared=false;
  }
  join(name,token) {
    if(typeof token==='string' && this.players.has(token)) return this.players.get(token);
    if(this.phase!=='lobby') throw new Error('전투가 시작되었습니다. 선생님이 대기실로 돌아오면 입장할 수 있어요.');
    if(this.players.size>=60) throw new Error('지킴이는 최대 60명까지 참여할 수 있어요.');
    name=String(name||'').trim().replace(/[<>\x00-\x1f]/g,'').slice(0,20);
    if(!name) throw new Error('지킴이 이름을 입력해 주세요.');
    if([...this.players.values()].some(p=>p.name===name)) throw new Error('같은 이름이 있어요. 번호를 붙여 주세요.');
    const id=randomUUID(),p={token:id,name,connected:true,correct:0,answers:0};
    this.players.set(id,p); return p;
  }
  emit(type,payload={}) {this.events.push({type,...payload});}
  startIntro(duration) {
    if(this.phase!=='lobby') return;
    if(![...this.players.values()].some(p=>p.connected)) throw new Error('먼저 지킴이가 입장해야 합니다. 혼자 확인하려면 체험 대원을 추가하세요.');
    this.phase='intro';this.introStartedAt=this.now();this.deadline=this.now()+duration*1000;
  }
  startGame() {
    if(this.phase!=='intro' && this.phase!=='lobby') return;
    this.stage=0;this.hp=100;this.shield=100;this.sejong=0;this.ju=0;this.round=0;
    this.used.clear();this.correct=0;this.wrong=0;this.missing=0;this.combo=0;this.maxCombo=0;
    for(const p of this.players.values()){p.correct=0;p.answers=0;}
    this.openQuestion();
  }
  openQuestion() {
    this.roster=[...this.players.values()].filter(p=>p.connected).map(p=>p.token);
    if(!this.roster.length){this.phase='waiting';this.paused=false;this.deadline=0;return;}
    const categories=this.stage===0?['맞춤법']:this.stage===1?['순우리말','다듬은 말']:['띄어쓰기'];
    const pool=bank.filter(q=>categories.includes(q.category)&&!this.used.has(q.id));
    const q=shuffle(pool)[0];
    if(!q) throw new Error('출제할 문제가 없습니다.');
    this.used.add(q.id);
    const order=shuffle([0,1,2,3]);
    this.question={...q,options:order.map(i=>q.options[i]),answer:order.indexOf(q.answer),roundId:randomUUID()};
    this.round++;this.answers.clear();this.phase='question';this.paused=false;this.hintVisible=false;this.stageCleared=false;
    this.deadline=this.now()+this.questionSeconds*1000;
  }
  answer(token,roundId,choice) {
    if(this.phase!=='question') return {ok:false,message:'지금은 답을 받는 시간이 아니에요.'};
    if(this.paused) return {ok:false,message:'잠시 멈췄어요. 선생님이 재개하면 답할 수 있어요.'};
    if(this.now()>=this.deadline) {this.closeQuestion();return {ok:false,message:'답 보내기 시간이 끝났어요.'};}
    if(roundId!==this.question.roundId||!Number.isInteger(choice)||choice<0||choice>3) return {ok:false,message:'현재 문제의 보기를 선택해 주세요.'};
    if(!this.roster.includes(token)) return {ok:false,message:'다음 문제부터 함께 참여해요.'};
    if(this.answers.has(token)) return {ok:false,message:'이미 답을 보내했어요.'};
    const player=this.players.get(token),correct=choice===this.question.answer,n=this.roster.length;
    this.answers.set(token,{choice,correct});player.answers++;
    if(correct){
      player.correct++;this.correct++;this.combo++;this.maxCombo=Math.max(this.maxCombo,this.combo);
      const damage=18/n;this.hp=Math.max(0,this.hp-damage);
      this.sejong=Math.min(100,this.sejong+26/n);this.ju=Math.min(100,this.ju+26/n);
      this.emit('hit',{damage:Math.round(damage*10)/10,name:player.name,combo:this.combo});
      if(this.sejong>=99.99&&this.ju>=99.99){
        this.sejong=0;this.ju=0;this.hp=Math.max(0,this.hp-24);this.shield=Math.min(100,this.shield+18);
        this.deadline+=5500;this.emit('skill',{damage:24});
      }
    } else {
      this.wrong++;this.combo=0;this.shield=Math.max(0,this.shield-12/n);this.emit('guard-hit');
    }
    if(this.answers.size===this.roster.length) this.closeQuestion();
    return {ok:true,choice};
  }
  closeQuestion() {
    if(this.phase!=='question') return;
    const absent=this.roster.length-this.answers.size;
    this.missing+=absent;this.shield=Math.max(0,this.shield-6*absent/this.roster.length);
    this.phase='review';this.paused=false;this.deadline=0;
    this.stageCleared=this.hp<=0.001;
    this.failed=this.shield<=0.001||(!this.stageCleared&&this.round>=7);
  }
  next() {
    if(this.phase==='waiting'){this.openQuestion();return;}
    if(this.phase!=='review') return;
    if(this.failed){this.phase='defeat';this.emit('defeat');return;}
    if(this.stageCleared){
      if(this.stage===2){this.phase='victory';this.emit('victory');return;}
      this.stage++;this.hp=100;this.round=0;this.shield=Math.min(100,this.shield+12);this.emit('stage',{stage:this.stage});
    }
    this.openQuestion();
  }
  pause() {
    if(this.phase!=='question') return;
    if(this.paused){this.deadline=this.now()+this.remaining;this.paused=false;}
    else {this.remaining=Math.max(0,this.deadline-this.now());this.paused=true;}
  }
  tick() {
    if(this.phase==='intro'&&this.now()>=this.deadline) this.startGame();
    if(this.phase==='question'&&!this.paused&&this.now()>=this.deadline) this.closeQuestion();
  }
  reset() {
    this.phase='lobby';this.paused=false;this.deadline=0;this.question=null;this.hp=100;this.shield=100;
    this.stage=0;this.round=0;this.sejong=0;this.ju=0;this.answers.clear();this.roster=[];this.used.clear();
    this.correct=0;this.wrong=0;this.missing=0;this.combo=0;this.maxCombo=0;this.failed=false;this.stageCleared=false;
    for(const [id,p] of this.players) if(!p.connected||p.bot) this.players.delete(id);
  }
  snapshot() {
    const q=this.question;
    const publicQuestion=q?{id:q.id,roundId:q.roundId,category:q.category,question:q.question,options:q.options,hint:this.hintVisible||this.phase==='review'?q.hint:null}:null;
    if(publicQuestion&&this.phase!=='question'){publicQuestion.answer=q.answer;publicQuestion.explanation=q.explanation;}
    const correctThisRound=[...this.answers.values()].filter(a=>a.correct).length;
    return {pin:this.pin,phase:this.phase,stage:this.stage,round:this.round,boss:BOSSES[this.stage],hp:this.hp,shield:this.shield,sejong:this.sejong,ju:this.ju,combo:this.combo,
      players:[...this.players.values()].map(p=>({name:p.name,connected:p.connected,bot:!!p.bot})),
      submitted:this.answers.size,total:this.roster.length,deadline:this.deadline,serverNow:this.now(),paused:this.paused,remaining:this.remaining,
      question:publicQuestion,introStartedAt:this.introStartedAt,stageCleared:this.stageCleared,failed:!!this.failed,
      roundCorrect:this.phase==='review'?correctThisRound:null,
      stats:{correct:this.correct,wrong:this.wrong,missing:this.missing,maxCombo:this.maxCombo},questionSeconds:this.questionSeconds};
  }
}
module.exports={Game,BOSSES};

