export function encodeWav(samples,sampleRate) {
 const count=Math.floor(samples.length*16000/sampleRate),buffer=new ArrayBuffer(44+count*2),view=new DataView(buffer);
 const str=(offset,text)=>{for(let i=0;i<text.length;i++)view.setUint8(offset+i,text.charCodeAt(i));};
 str(0,'RIFF');view.setUint32(4,36+count*2,true);str(8,'WAVE');str(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);view.setUint32(24,16000,true);view.setUint32(28,32000,true);view.setUint16(32,2,true);view.setUint16(34,16,true);str(36,'data');view.setUint32(40,count*2,true);
 for(let i=0;i<count;i++){const start=Math.floor(i*sampleRate/16000),end=Math.max(start+1,Math.floor((i+1)*sampleRate/16000));let value=0;for(let j=start;j<end&&j<samples.length;j++)value+=samples[j];value=Math.max(-1,Math.min(1,value/(end-start)));view.setInt16(44+i*2,value<0?value*32768:value*32767,true);}return buffer;
}
export async function createRecorder(onLevel,deviceId) {
 const stream=await navigator.mediaDevices.getUserMedia({audio:deviceId?{deviceId:{exact:deviceId},channelCount:1,echoCancellation:true}: {channelCount:1,echoCancellation:true},video:false});
 let context;
 try {
  context=new AudioContext();await context.audioWorklet.addModule('./pcm-worklet.js');
  const source=context.createMediaStreamSource(stream),worklet=new AudioWorkletNode(context,'pcm-recorder'),mute=context.createGain();mute.gain.value=0;
  const chunks=[];let total=0,closed=false,energy=0;
  worklet.port.onmessage=({data})=>{if(closed)return;chunks.push(data);total+=data.length;let sum=0;for(const v of data)sum+=v*v;energy+=sum;onLevel(Math.min(1,Math.sqrt(sum/data.length)*6));};
  source.connect(worklet);worklet.connect(mute);mute.connect(context.destination);await context.resume();
  function snapshot(seconds=30){
   const count=Math.min(total,Math.floor(context.sampleRate*seconds));
   if(count<context.sampleRate*.3)return null;
   const samples=new Float32Array(count);let offset=count;
   for(let i=chunks.length-1;i>=0&&offset>0;i--){const c=chunks[i],n=Math.min(offset,c.length);offset-=n;samples.set(c.subarray(c.length-n),offset);}
   return encodeWav(samples,context.sampleRate);
  }
  return {snapshot,async stop(cancel=false){closed=true;stream.getTracks().forEach(t=>t.stop());source.disconnect();worklet.disconnect();const rate=context.sampleRate;await context.close();if(cancel)return null;if(total<rate*.3||Math.sqrt(energy/Math.max(1,total))<.0001)throw new Error('录音中没有检测到声音，请检查麦克风后重试。');const samples=new Float32Array(total);let offset=0;for(const c of chunks){samples.set(c,offset);offset+=c.length;}return encodeWav(samples,rate);}};
 } catch(error){stream.getTracks().forEach(t=>t.stop());await context?.close();throw error;}
}
