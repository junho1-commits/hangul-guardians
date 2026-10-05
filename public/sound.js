'use strict';
class GuardianSound {
  constructor(){this.enabled=false;this.ctx=null;this.music=null;this.voice=null;this.voiceResolve=null;this.step=0;}
  async enable(){this.enabled=true;this.ctx??=new (window.AudioContext||window.webkitAudioContext)();await this.ctx.resume();if(!this.music)this.music=setInterval(()=>this.musicNote(),620);}
  disable(){this.enabled=false;this.stopVoice();if(this.music){clearInterval(this.music);this.music=null;}}
  tone(frequency,duration=.2,volume=.08,type='sine',delay=0){
    if(!this.enabled||!this.ctx)return;const o=this.ctx.createOscillator(),g=this.ctx.createGain(),t=this.ctx.currentTime+delay;
    o.type=type;o.frequency.setValueAtTime(frequency,t);g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(volume,t+.015);g.gain.exponentialRampToValueAtTime(.0001,t+duration);
    o.connect(g);g.connect(this.ctx.destination);o.start(t);o.stop(t+duration+.03);
  }
  musicNote(){const notes=[293.66,329.63,392,440,523.25,440,392,329.63,293.66,392,440,587.33,523.25,440,392,329.63];const note=notes[this.step++%notes.length];this.tone(note,.65,this.voice?.paused===false?.009:.024,'sine');if(this.step%4===0)this.tone(note/2,.95,.025,'triangle');}
  hit(){this.tone(660,.13,.05,'triangle');this.tone(990,.2,.04,'sine',.06);}
  hurt(){this.tone(110,.22,.06,'triangle');}
  summon(){[293.66,392,440,587.33].forEach((n,i)=>this.tone(n,.5,.035,'sine',i*.12));}
  stopVoice(){if(this.voice){const audio=this.voice;audio.onended=null;audio.onerror=null;audio.onloadedmetadata=null;audio.pause();this.voice=null;audio.removeAttribute('src');audio.load();}this.voiceResolve?.();this.voiceResolve=null;}
  playVoice(file,offset=0){
    this.stopVoice();if(!this.enabled)return Promise.resolve();
    const audio=new Audio(file);audio.volume=.9;this.voice=audio;
    return new Promise(resolve=>{
      let done=false;const finish=()=>{if(done)return;done=true;if(this.voice===audio){this.voice=null;this.voiceResolve=null;}resolve();};
      this.voiceResolve=finish;audio.onended=finish;audio.onerror=()=>{if(this.voice===audio)window.dispatchEvent(new CustomEvent('voice-error'));finish();};
      audio.onloadedmetadata=()=>{if(offset>0&&offset<audio.duration)audio.currentTime=offset;};
      audio.play().catch(()=>{if(this.voice===audio)window.dispatchEvent(new CustomEvent('voice-error'));finish();});
    });
  }
}
window.guardianSound=new GuardianSound();
