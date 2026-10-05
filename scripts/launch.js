'use strict';
require('./export-practice.cjs');
const {spawn,execFile}=require('node:child_process');
const path=require('node:path');
const openBrowser=()=>execFile('powershell.exe',['-NoProfile','-Command',"Start-Process 'http://localhost:3000/'"],{windowsHide:true},error=>{if(error)console.log('브라우저에서 http://localhost:3000/ 를 열어 주세요.');});
async function main(){
  try{const r=await fetch('http://localhost:3000/api/health',{signal:AbortSignal.timeout(800)});const data=await r.json();if(data.app==='jiphyeonjeon-guardians'&&data.version===2){console.log('이미 실행 중인 한글 지킴이를 엽니다.');openBrowser();return;}}catch{}
  const child=spawn(process.execPath,['server.js'],{cwd:path.join(__dirname,'..'),stdio:['inherit','pipe','inherit']});
  let opened=false;
  child.stdout.on('data',data=>{process.stdout.write(data);if(!opened&&data.toString().includes('한글 지킴이:')){opened=true;openBrowser();}});
  child.on('exit',code=>process.exitCode=code||0);child.on('error',e=>{console.error(e.message);process.exitCode=1;});
  process.on('SIGINT',()=>child.kill('SIGINT'));process.on('SIGTERM',()=>child.kill('SIGTERM'));
}
main();


