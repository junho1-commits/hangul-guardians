'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {Game}=require('../game');
function setup(n=4){let time=1000;const game=new Game('123456','host',()=>time);const players=Array.from({length:n},(_,i)=>game.join('대원 '+i));return {game,players,advance:n=>time+=n};}
test('정답 비공개, 중복 제출과 이전 문제 답안 차단',()=>{
  const {game,players}=setup();game.startGame();assert.equal(game.snapshot().question.answer,undefined);
  const id=game.question.roundId;assert.equal(game.answer(players[0].token,id,game.question.answer).ok,true);
  const hp=game.hp;assert.equal(game.answer(players[0].token,id,game.question.answer).ok,false);assert.equal(game.hp,hp);
  assert.equal(game.answer(players[1].token,'previous-round',0).ok,false);
  assert.equal(game.answer(players[1].token,id,'0').ok,false);
});
test('전원 제출 후 해설 공개, 정답은 공격과 게이지 충전',()=>{
  const {game,players}=setup();game.startGame();for(const p of players)game.answer(p.token,game.question.roundId,game.question.answer);
  assert.equal(game.phase,'review');assert.ok(Math.abs(game.hp-82)<.001);assert.equal(game.sejong,26);assert.equal(game.ju,26);
  assert.equal(game.snapshot().question.answer,game.question.answer);assert.equal(game.snapshot().roundCorrect,4);
});
test('일시 정지 중 시간과 답안은 멈추고 재개 시 남은 시간 보존',()=>{
  const {game,players,advance}=setup();game.startGame();advance(10000);game.pause();advance(60000);game.tick();assert.equal(game.phase,'question');
  assert.equal(game.answer(players[0].token,game.question.roundId,0).ok,false);game.pause();assert.equal(game.deadline-game.now(),20000);
  advance(20001);game.tick();assert.equal(game.phase,'review');assert.equal(game.missing,4);assert.equal(game.shield,94);
});
test('늦은 제출로 데미지를 우회할 수 없고 오답은 학급 크기로 정규화',()=>{
  const {game,players,advance}=setup();game.startGame();game.answer(players[0].token,game.question.roundId,(game.question.answer+1)%4);assert.equal(game.shield,97);
  advance(31000);assert.equal(game.answer(players[1].token,game.question.roundId,game.question.answer).ok,false);assert.equal(game.correct,0);
});
test('4라운드 정답으로 합동 필살기, 3단계 정화와 승리까지 진행',()=>{
  const {game,players}=setup();game.startGame();let rounds=0,skills=0;
  while(game.phase!=='victory'&&rounds<22){
    assert.equal(game.phase,'question');for(const p of players)game.answer(p.token,game.question.roundId,game.question.answer);
    skills+=game.events.filter(e=>e.type==='skill').length;game.events=[];game.next();rounds++;
  }
  assert.equal(game.phase,'victory');assert.equal(game.stage,2);assert.ok(skills>=3);assert.ok(rounds<=15);
});
test('7문제 안에 보스를 정화하지 못하면 재도전 결과, 대기실 정리',()=>{
  const {game,players}=setup();game.startGame();for(let i=0;i<7;i++){for(const p of players)game.answer(p.token,game.question.roundId,(game.question.answer+1)%4);game.next();}
  assert.equal(game.phase,'defeat');game.reset();assert.equal(game.phase,'lobby');assert.equal(game.hp,100);assert.equal(game.shield,100);
});
test('이름 검증, 정원 제한, 재접속 토큰, 진행 중 신규 입장 제한',()=>{
  const {game,players}=setup();assert.throws(()=>game.join(''));assert.throws(()=>game.join('대원 0'));assert.equal(game.join('',players[0].token),players[0]);
  game.startGame();assert.throws(()=>game.join('새 대원'));assert.equal(game.join('',players[0].token),players[0]);
});
test('연결된 대원이 없으면 기다리고 재연결 후 문제 시작',()=>{
  const {game,players}=setup();players.forEach(p=>p.connected=false);game.startGame();assert.equal(game.phase,'waiting');players[0].connected=true;game.next();assert.equal(game.phase,'question');assert.equal(game.roster.length,1);
});
