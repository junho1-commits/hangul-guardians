'use strict';
const express = require('express');
const http = require('node:http');
const os = require('node:os');
const fs = require('node:fs');
const path = require('node:path');
const {randomBytes,randomInt,timingSafeEqual} = require('node:crypto');
const {Server} = require('socket.io');
const QRCode = require('qrcode');
const {Game} = require('./game');
const app=express(),server=http.createServer(app),io=new Server(server,{maxHttpBufferSize:16000});
const rooms=new Map(),port=Number(process.env.PORT||3000);
const configuredPublicUrl=process.env.PUBLIC_URL||process.env.RENDER_EXTERNAL_URL||'';
const publicBase=configuredPublicUrl?new URL(configuredPublicUrl).origin:'';
const intro=JSON.parse(fs.readFileSync(path.join(__dirname,'public/intro-script.json'),'utf8'));
let manifest={clips:{}};
try{manifest=JSON.parse(fs.readFileSync(path.join(__dirname,'public/audio/manifest.json'),'utf8'));}catch{}
const introDuration=intro.scenes.reduce((n,s)=>n+(manifest.clips[s.id]?.duration||7)+0.65,0)+3;
const local=req=>['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress);
const equals=(a,b)=>typeof a==='string'&&typeof b==='string'&&Buffer.byteLength(a)===Buffer.byteLength(b)&&timingSafeEqual(Buffer.from(a),Buffer.from(b));
app.disable('x-powered-by');
app.get('/api/health',(req,res)=>res.json({app:'jiphyeonjeon-guardians',version:2}));
app.use(express.json({limit:'8kb'}));
app.use((req,res,next)=>{res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','same-origin');next();});
app.get('/host',(req,res)=>res.sendFile(path.join(__dirname,req.query.room==='1'?'public/host.html':'public/index.html')));
app.get('/play',(req,res)=>res.sendFile(path.join(__dirname,req.query.join==='1'||req.query.pin?'public/play.html':'public/index.html')));
app.get(['/learn','/solo'],(req,res)=>res.sendFile(path.join(__dirname,'public/practice.html')));
app.get('/api/practice',(req,res)=>res.json(require('./questions')));
app.get('/api/network',(req,res)=>{
  if(publicBase)return res.json({urls:[publicBase],port});
  const addresses=Object.values(os.networkInterfaces()).flat().filter(n=>n.family==='IPv4'&&!n.internal).map(n=>n.address);
  const preferred=addresses.filter(a=>!a.startsWith('169.254.'));
  res.json({urls:preferred.map(a=>`http://${a}:${port}`),port});
});
app.post('/api/rooms',(req,res)=>{
  if(!publicBase&&!local(req)) return res.status(403).json({error:'교사용 대기실은 이 컴퓨터에서 만들어 주세요.'});
  if(rooms.size>=20) return res.status(429).json({error:'대기실이 너무 많아요. 서버를 다시 실행해 주세요.'});
  let pin;do{pin=String(randomInt(100000,1000000));}while(rooms.has(pin));
  const token=randomBytes(32).toString('hex'),game=new Game(pin,token);
  rooms.set(pin,game);res.json({pin,token});
});
app.get('/api/qr',async(req,res)=>{
  const pin=String(req.query.pin||''),base=String(req.query.base||'');
  if(!rooms.has(pin))return res.status(404).send('대기실을 찾을 수 없습니다.');
  let url;try{url=new URL(base);}catch{return res.status(400).send('잘못된 주소');}
  const available=Object.values(os.networkInterfaces()).flat().filter(n=>n.family==='IPv4').map(n=>n.address);
  if(!(publicBase&&url.origin===publicBase)&&!(url.protocol==='http:'&&available.includes(url.hostname)&&Number(url.port||80)===port)) return res.status(400).send('교실 접속 주소를 선택해 주세요.');
  const image=await QRCode.toBuffer(`${url.origin}/play?pin=${pin}`,{width:280,margin:2,color:{dark:'#101c30',light:'#ffffff'}});
  res.type('png').send(image);
});
app.use(express.static(path.join(__dirname,'public')));
function broadcast(game){io.to(game.pin).emit('state',game.snapshot());for(const event of game.events.splice(0))io.to(game.pin).emit('effect',event);}
function personal(socket,game){const p=game.players.get(socket.data.playerToken);socket.emit('personal',{name:p?.name,answer:game.answers.get(socket.data.playerToken)?.choice??null,eligible:game.roster.includes(socket.data.playerToken)});}
io.on('connection',socket=>{
  let calls=0;const counter=setInterval(()=>calls=0,1000);
  const limited=()=>++calls>25;
  socket.on('host-join',(data,ack=()=>{})=>{
    if(typeof ack!=='function')ack=()=>{};
    if(limited())return;const game=rooms.get(String(data?.pin));
    if(!game||!equals(data?.token,game.hostToken))return ack({ok:false,message:'대기실을 다시 만들어 주세요.'});
    if(game.hostSocket&&game.hostSocket!==socket.id) io.sockets.sockets.get(game.hostSocket)?.disconnect(true);
    game.hostSocket=socket.id;socket.data.host=true;socket.data.pin=game.pin;socket.join(game.pin);game.lastSeen=Date.now();
    ack({ok:true});socket.emit('state',game.snapshot());
  });
  socket.on('join',(data,ack=()=>{})=>{
    if(typeof ack!=='function')ack=()=>{};
    if(limited())return ack({ok:false,message:'잠시 후 다시 시도하세요.'});
    const game=rooms.get(String(data?.pin));if(!game)return ack({ok:false,message:'입장 번호를 확인해 주세요.'});
    try{
      if(socket.data.pin&&socket.data.pin!==game.pin)throw new Error('다른 대기실에 연결되어 있어요. 페이지를 새로 열어 주세요.');
      const p=game.join(data?.name,data?.token);
      if(p.socketId&&p.socketId!==socket.id)io.sockets.sockets.get(p.socketId)?.disconnect(true);
      p.connected=true;p.socketId=socket.id;socket.data.pin=game.pin;socket.data.playerToken=p.token;socket.join(game.pin);
      ack({ok:true,token:p.token,name:p.name,pin:game.pin});broadcast(game);personal(socket,game);
    }catch(e){ack({ok:false,message:e.message});}
  });
  socket.on('answer',(data,ack=()=>{})=>{
    if(typeof ack!=='function')ack=()=>{};
    if(limited())return;const game=rooms.get(socket.data.pin);if(!game||!socket.data.playerToken)return ack({ok:false,message:'먼저 입장해 주세요.'});
    const result=game.answer(socket.data.playerToken,data?.roundId,data?.choice);ack(result);broadcast(game);personal(socket,game);
  });
  socket.on('control',(data,ack=()=>{})=>{
    if(typeof ack!=='function')ack=()=>{};
    if(limited())return;const game=rooms.get(socket.data.pin);if(!game||!socket.data.host||game.hostSocket!==socket.id)return ack({ok:false,message:'교사용 화면에서 조작해 주세요.'});
    try{
      switch(data?.action){
        case 'intro':game.startIntro(introDuration);break;
        case 'skip':if(game.phase==='intro')game.startGame();break;
        case 'next':game.next();break;
        case 'pause':game.pause();break;
        case 'hint':if(game.phase==='question')game.hintVisible=true;break;
        case 'close':game.closeQuestion();break;
        case 'reset':game.reset();break;
        case 'seconds':if(game.phase==='lobby'&&[20,30,45,60].includes(data.value))game.questionSeconds=data.value;break;
        case 'bots':if(game.phase==='lobby')for(let i=0;i<3&&game.players.size<60;i++){const p=game.join('체험 대원 '+(game.players.size+1));p.bot=true;}break;
        case 'remove-bots':if(game.phase==='lobby')for(const [id,p]of game.players)if(p.bot)game.players.delete(id);break;
        case 'retry':if(game.phase==='defeat'){game.phase='lobby';game.startGame();}break;
      }
      game.lastSeen=Date.now();broadcast(game);ack({ok:true});
    }catch(e){ack({ok:false,message:e.message});}
  });
  socket.on('disconnect',()=>{
    clearInterval(counter);const game=rooms.get(socket.data.pin);if(!game)return;
    if(socket.data.host&&game.hostSocket===socket.id){game.hostSocket=null;if(game.phase==='question'&&!game.paused)game.pause();}
    const p=game.players.get(socket.data.playerToken);if(p&&p.socketId===socket.id)p.connected=false;
    broadcast(game);
  });
});
const tick=setInterval(()=>{
  for(const [pin,game]of rooms){
    const before=game.phase;game.tick();
    if(game.phase==='question'&&!game.paused){
      for(const token of game.roster){const p=game.players.get(token);if(p?.bot&&!game.answers.has(token)&&Date.now()>game.deadline-game.questionSeconds*1000+1800+randomInt(2500)){
        const correct=randomInt(100)<83;game.answer(token,game.question.roundId,correct?game.question.answer:(game.question.answer+1)%4);
      }}
    }
    if(before!==game.phase||game.events.length)broadcast(game);
    if(!game.hostSocket&&![...game.players.values()].some(p=>p.connected&&!p.bot)&&Date.now()-game.lastSeen>4*60*60*1000)rooms.delete(pin);
  }
},250);
server.listen(port,'0.0.0.0',()=>console.log(`한글 지킴이: http://localhost:${port}/host`));
server.on('error',e=>{console.error(e.code==='EADDRINUSE'?`포트 ${port} 사용 중입니다. 기존 게임 창을 종료하고 다시 실행하세요.`:e.message);process.exit(1);});
function shutdown(){clearInterval(tick);io.close();server.close();}
process.on('SIGTERM',shutdown);process.on('SIGINT',shutdown);


