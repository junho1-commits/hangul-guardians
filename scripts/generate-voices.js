'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.join(__dirname, '..');
const script = JSON.parse(fs.readFileSync(path.join(root, 'public/intro-script.json'), 'utf8'));
const voices = {
  narrator: { id: 'tc_5c789c34dabcfa0008b0a390', name: '지영' },
  sejong: { id: 'tc_5fe06471a9f79e8f959be96f', name: '성호' },
  ju: { id: 'tc_61f0859907085fc68561c9a1', name: '지훈' },
  boss: { id: 'tc_5c547544fcfee90007fed455', name: '찬구' }
};
function wavDuration(buffer) {
  if (buffer.toString('ascii', 0, 4) !== 'RIFF') throw new Error('WAV 응답이 아닙니다.');
  let byteRate = 0, dataSize = 0;
  for (let i = 12; i + 8 <= buffer.length;) {
    const size = buffer.readUInt32LE(i + 4), tag = buffer.toString('ascii', i, i + 4);
    if (tag === 'fmt ') byteRate = buffer.readUInt32LE(i + 16);
    if (tag === 'data') dataSize = Math.min(size, buffer.length - i - 8);
    i += 8 + size + (size % 2);
  }
  if (!byteRate || !dataSize) throw new Error('빈 음성 응답입니다.');
  return Math.round(dataSize / byteRate * 1000) / 1000;
}
async function main() {
  const key = process.env.TYPECAST_API_KEY;
  if (!key) throw new Error('TYPECAST_API_KEY 환경변수가 필요합니다.');
  const manifestPath = path.join(root, 'public/audio/manifest.json');
  const manifest = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath,'utf8')) : {provider:'Typecast',model:'ssfm-v30',voices,clips:{}};
  for (const clip of [...script.scenes, ...script.effects].filter(c=>!process.argv.includes('--only-boss')||c.id.startsWith('boss-stage-'))) {
    const voice = voices[clip.role];
    const hash = crypto.createHash('sha256').update(JSON.stringify([clip.text,voice.id,clip.emotion])).digest('hex');
    const file = path.join(root, 'public/audio', clip.id + '.wav');
    if (manifest.clips[clip.id]?.hash === hash && fs.existsSync(file)) { console.log('기존 음성 유지:',clip.id); continue; }
    const res = await fetch('https://api.typecast.ai/v1/text-to-speech', {
      method:'POST', headers:{'X-API-KEY':key,'Content-Type':'application/json'},
      body:JSON.stringify({voice_id:voice.id,model:'ssfm-v30',text:clip.text,language:'kor',prompt:{emotion_type:'preset',emotion_preset:clip.emotion,emotion_intensity:1},output:{audio_format:'wav',audio_tempo:1}}),
      signal:AbortSignal.timeout(90000)
    });
    if (!res.ok) throw new Error(`Typecast ${clip.id}: HTTP ${res.status} ${(await res.text()).slice(0,300)}`);
    const buffer = Buffer.from(await res.arrayBuffer());
    const duration = wavDuration(buffer);
    fs.writeFileSync(file,buffer);
    manifest.clips[clip.id] = {file:'/audio/'+clip.id+'.wav',duration,hash,text:clip.text,role:clip.role,voice:voice.name};
    fs.writeFileSync(manifestPath,JSON.stringify(manifest,null,2));
    console.log(`${clip.id}: ${voice.name}, ${duration}초, ${buffer.length} bytes`);
  }
  manifest.provider = 'Typecast';
  manifest.model = 'ssfm-v30';
  manifest.voices = voices;
  fs.writeFileSync(manifestPath,JSON.stringify(manifest,null,2));
  console.log('Typecast 음성 제작 완료.');
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
