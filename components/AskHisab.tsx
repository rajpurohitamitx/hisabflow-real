"use client";
import { useEffect, useRef, useState } from "react";
import { Mic, Send, ShieldCheck, Check, Edit3, LoaderCircle, BookOpen, Volume2, VolumeX, Square, Languages, Sparkles, Radio } from "lucide-react";

type Msg={role:"user"|"assistant";text:string};
const languages=["Auto","English","Hindi","Tamil","Telugu","Kannada","Malayalam","Marathi","Bengali","Gujarati"];
function confirmationEntries(entities:any){ const out:any[]=[]; for(const [k,v] of Object.entries(entities||{})){ if(k==="fields"&&v&&typeof v==="object"&&!Array.isArray(v)){ for(const [fk,fv] of Object.entries(v as any)) out.push([fk,fv]); } else if(!["matches","text","fields"].includes(k)) out.push([k,v]); } return out; }
function displayField(key:string,value:any){
 if(value==null||value==='') return '';
 if(typeof value==='object') return Array.isArray(value)?value.map((x:any)=>typeof x==='object'?JSON.stringify(x):String(x)).join(', '):JSON.stringify(value);
 if(key==='dueAt'||key==='dueDate'||key==='occurredAt') { const d=new Date(String(value)); if(!Number.isNaN(d.getTime())) return d.toLocaleString('en-IN',{dateStyle:'medium',timeStyle:'short'}); }
 if(/amount|price|total|balance|payment/i.test(key)&&!Number.isNaN(Number(value))) return `₹${Number(value).toLocaleString('en-IN')}`;
 return String(value);
}

export default function AskHisab(){
 const [text,setText]=useState("");
 const [msgs,setMsgs]=useState<Msg[]>([{role:"assistant",text:"I’m your business copilot. Speak naturally — English, Hindi, Tamil, Telugu or mixed language. I’ll understand the intent, check your live records, and ask before making a risky financial change."}]);
 const [pending,setPending]=useState<any>(null); const pendingRef=useRef<any>(null); const [busy,setBusy]=useState(false); const [listening,setListening]=useState(false); const [speaking,setSpeaking]=useState(false); const [voiceEnabled,setVoiceEnabled]=useState(true); const [language,setLanguage]=useState("Auto");
 const recRef=useRef<any>(null); const wakeRef=useRef<any>(null); const voiceSessionRef=useRef(false); const busyRef=useRef(false); const speakingRef=useRef(false); const mediaRef=useRef<MediaRecorder|null>(null); const autoListenTimerRef=useRef<any>(null); const silenceTimerRef=useRef<any>(null); const audioContextRef=useRef<AudioContext|null>(null); const livePcRef=useRef<RTCPeerConnection|null>(null); const liveDcRef=useRef<RTCDataChannel|null>(null); const liveStreamRef=useRef<MediaStream|null>(null); const chunksRef=useRef<Blob[]>([]); const audioRef=useRef<HTMLAudioElement|null>(null);
 useEffect(()=>{pendingRef.current=pending;},[pending]);
 useEffect(()=>{busyRef.current=busy;},[busy]);
 useEffect(()=>{speakingRef.current=speaking;},[speaking]);
 useEffect(()=>{
   const Recognition=(window as any).SpeechRecognition||(window as any).webkitSpeechRecognition;
   if(!Recognition) return;
   let stopped=false; let permissionReady=false;
   const requestMicPermission=async()=>{
     try{
       if(navigator.mediaDevices?.getUserMedia){
         const stream=await navigator.mediaDevices.getUserMedia({audio:true});
         stream.getTracks().forEach(t=>t.stop());
         permissionReady=true;
       }
     }catch{}
   };
   const startAfterPermission=async()=>{await requestMicPermission(); if(!stopped) startWake();};
   function startWake(){
     if(stopped||wakeRef.current||mediaRef.current||livePcRef.current||speakingRef.current||busyRef.current) return;
     try{
       const r=new Recognition(); wakeRef.current=r; r.continuous=true; r.interimResults=true; r.lang="en-IN";
       r.onresult=(e:any)=>{
         let heard=""; for(let i=e.resultIndex;i<e.results.length;i++) heard+=` ${e.results[i][0].transcript}`;
         const raw=heard.trim();
         const n=raw.toLowerCase().replace(/[^a-z0-9\s]/g," ").replace(/\s+/g," ").trim();
         const match=n.match(/\b(?:hi|hey|hai|hello)\s+(?:hisab|hisaab|hesab|hisabflow|hisab flow)\b\s*(.*)$/i);
         if(match){
           try{r.stop()}catch{} wakeRef.current=null; voiceSessionRef.current=true;
           const tail=String(match[1]||"").trim();
           setTimeout(()=>{ if(tail) { send(tail); } else startVoice(true); },180);
         }
       };
       r.onerror=()=>{wakeRef.current=null; if(!stopped)setTimeout(startWake,900)};
       r.onend=()=>{wakeRef.current=null; if(!stopped)setTimeout(startWake,500)};
       r.start();
     }catch{wakeRef.current=null; if(!stopped)setTimeout(startWake,1200)}
   };
   startAfterPermission();
   const timer=setInterval(()=>{if(permissionReady||navigator.permissions===undefined) startWake();},1500);
   return()=>{stopped=true;clearInterval(timer);try{wakeRef.current?.stop()}catch{}wakeRef.current=null;};
 },[]);
 useEffect(()=>()=>{try{wakeRef.current?.stop()}catch{} recRef.current?.stop();mediaRef.current?.stop();if(autoListenTimerRef.current)clearTimeout(autoListenTimerRef.current);if(silenceTimerRef.current)clearTimeout(silenceTimerRef.current);audioContextRef.current?.close();audioRef.current?.pause();livePcRef.current?.close();liveStreamRef.current?.getTracks().forEach(t=>t.stop())},[]);

 async function speak(answer:string){
   if(!voiceEnabled||!answer.trim()) return;
   try{recRef.current?.stop()}catch{}
   try{mediaRef.current?.stop()}catch{}
   setListening(false);
   const localMode=process.env.NEXT_PUBLIC_AI_PROVIDER==='ollama'||process.env.NEXT_PUBLIC_AI_PROVIDER==='gemini';
   if(localMode){
     if("speechSynthesis" in window){setSpeaking(true);const u=new SpeechSynthesisUtterance(answer);u.lang=language==='Hindi'?'hi-IN':language==='Tamil'?'ta-IN':language==='Telugu'?'te-IN':'en-IN';u.onend=()=>{setSpeaking(false);if(voiceSessionRef.current&&!busy)setTimeout(()=>startVoice(true),350)};u.onerror=()=>setSpeaking(false);speechSynthesis.cancel();speechSynthesis.speak(u)}
     return;
   }
   try{setSpeaking(true);const r=await fetch('/api/voice/speak',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({text:answer,language})});if(!r.ok)throw new Error();const blob=await r.blob();const url=URL.createObjectURL(blob);audioRef.current=new Audio(url);audioRef.current.onended=()=>{setSpeaking(false);URL.revokeObjectURL(url);if(voiceSessionRef.current&&!busy)setTimeout(()=>startVoice(true),350)};await audioRef.current.play();}
   catch{if("speechSynthesis" in window){setSpeaking(true);const u=new SpeechSynthesisUtterance(answer);u.lang=language==='Hindi'?'hi-IN':language==='Tamil'?'ta-IN':language==='Telugu'?'te-IN':'en-IN';u.onend=()=>{setSpeaking(false);if(voiceSessionRef.current&&!busy)setTimeout(()=>startVoice(true),350)};u.onerror=()=>setSpeaking(false);speechSynthesis.cancel();speechSynthesis.speak(u)}else setSpeaking(false)}
 }
 function stopSpeaking(){audioRef.current?.pause();if("speechSynthesis" in window)speechSynthesis.cancel();setSpeaking(false)}
 async function send(value=text, pendingOverride?:any){
   if(!value.trim()||busy)return;
   const clean=value.trim();
   const yes=/^(yes|yeah|yep|yup|ok|okay|sure|confirm|confirmed|confirm it|confirm this|u confirm it|you confirm it|do it|go ahead|proceed|haan|ha|ji|bilkul|theek|ठीक|हाँ|हां|जी|ஆம்|ஆமாம்|சரி|అవును|ಹೌದು|അതെ|હા|हो)$/i.test(clean);
   // A confirmation is an answer to the current pending action, never a new AI command.
   // Execute the ORIGINAL action exactly once; do not send "yes" back through the
   // interpreter, which was the source of repeated confirmation loops.
   if(yes && pending && !pending.auto && pending.actionId){
     setText(""); setMsgs(m=>[...m,{role:"user",text:clean}]);
     const actionToExecute=pending;
     setPending(null);
     setBusy(true);
     try{
       const er=await fetch('/api/ai/execute',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({actionId:actionToExecute.actionId,confirmed:true})});
       const ed=await er.json();
       if(!er.ok) throw new Error(ed.error||'The action could not be executed.');
       const done=ed.result?.message||'Done. The requested change has been recorded.';
       setMsgs(m=>[...m,{role:'assistant',text:done}]);
       await speak(done);
     }catch(e:any){ setMsgs(m=>[...m,{role:'assistant',text:e.message||'I could not complete that action.'}]); }
     finally{setBusy(false)}
     return;
   }
   setText("");setMsgs(m=>[...m,{role:"user",text:clean}]);setBusy(true);
   try{
     const r=await fetch('/api/ask',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({text:clean,conversationId:'main',pendingContext:pendingOverride||((pending&&!pending.auto&&clean.split(/\s+/).length<=12)?{intent:pending.result?.intent,entities:pending.result?.entities,question:pending.result?.response}:null)})});
     const d=await r.json();if(!r.ok)throw new Error(d.error||'Something went wrong.');
     const result=d.result;const answer=result.response||'I understood the request.';
     if(d.pendingConfirmed&&d.actionId){
       const er=await fetch('/api/ai/execute',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({actionId:d.actionId,confirmed:true})});
       const ed=await er.json(); if(!er.ok) throw new Error(ed.error||'The pending action could not be executed.');
       const done=ed.result?.message||'Done. The requested change has been recorded.'; setPending(null); setMsgs(m=>[...m,{role:'assistant',text:done}]); await speak(done); return;
     }
     const needsFollowup=Boolean(result.needsClarification||result.requiresConfirmation||result.risk!=='LOW');
     const affirmative=/^(yes|yeah|yep|yup|ok|okay|sure|confirm|confirmed|confirm it|confirm this|u confirm it|you confirm it|do it|go ahead|proceed|haan|ha|ji|bilkul|theek|ठीक|हाँ|हां|जी|ஆம்|ஆமாம்|சரி|అవును|ಹೌದು|അതെ|હા)\b/i.test(clean);
     const resolvingNewCustomer=Boolean(pendingOverride?.entities?.customerResolution==='CREATE_OR_CONFIRM' && affirmative && result?.entities?.createCustomer && (result?.entities?.customerName||result?.entities?.proposedCustomerName) && result?.needsClarification===false);
     const confirmingExistingAction=Boolean(pendingOverride && affirmative && !pendingOverride.entities?.customerResolution && result?.intent && result.intent!=='UNKNOWN' && !result.needsClarification);
     const shouldExecuteNow=Boolean(resolvingNewCustomer || confirmingExistingAction);
     if(shouldExecuteNow) setPending(null);
     else if(needsFollowup) setPending({actionId:d.actionId,result});
     else if(result.intent!=='UNKNOWN') setPending({actionId:d.actionId,result,auto:true});
     else setPending(null);
     if(!shouldExecuteNow){ setMsgs(m=>[...m,{role:'assistant',text:answer}]); await speak(answer); }
     if(shouldExecuteNow){
       setBusy(true);
       try{
         const er=await fetch('/api/ai/execute',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({actionId:d.actionId,confirmed:true})});
         const ed=await er.json();
         if(!er.ok) throw new Error(ed.error||'The action could not be executed.');
         const done=ed.result?.message||'Done. The requested change has been recorded.';
         setMsgs(m=>[...m,{role:'assistant',text:done}]);setPending(null);await speak(done);
       }catch(e:any){setMsgs(m=>[...m,{role:'assistant',text:e.message||'I could not complete that action.'}])}
       finally{setBusy(false)}
       return;
     }
     if(voiceSessionRef.current && !voiceEnabled){ voiceSessionRef.current=false; }
   }catch(e:any){setMsgs(m=>[...m,{role:'assistant',text:e.message||'Something went wrong.'}])}
   finally{setBusy(false)}
 }
 async function execute(confirmed=true){if(!pending)return;setBusy(true);try{const r=await fetch('/api/ai/execute',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({actionId:pending.actionId,confirmed,entitiesOverride:pending.result?.entities||undefined})});const d=await r.json();if(!r.ok){setMsgs(m=>[...m,{role:'assistant',text:d.error||'The action could not be executed.'}]);if(d.matches)setPending({...pending,matches:d.matches});return}const answer=d.result?.message||'Done. The live business records have been updated.';setMsgs(m=>[...m,{role:'assistant',text:answer}]);setPending(null);await speak(answer)}finally{setBusy(false)}}
 async function startLiveVoice(){
   if(process.env.NEXT_PUBLIC_AI_PROVIDER==='gemini'){setMsgs(m=>[...m,{role:"assistant",text:"Free hosted mode uses the regular microphone button. It keeps audio out of our server and sends only the recognized text to Hisab Flow."}]);return;}
   if(livePcRef.current){livePcRef.current.close();livePcRef.current=null;liveDcRef.current=null;liveStreamRef.current?.getTracks().forEach(t=>t.stop());liveStreamRef.current=null;setListening(false);return;}
   if(!navigator.mediaDevices?.getUserMedia||!window.RTCPeerConnection){setMsgs(m=>[...m,{role:"assistant",text:"Live voice is not available in this browser. Use the regular microphone button instead."}]);return;}
   try{
     setBusy(true); const pc=new RTCPeerConnection(); livePcRef.current=pc; pc.ontrack=(event)=>{const audio=document.createElement("audio");audio.autoplay=true;audio.srcObject=event.streams[0];audio.setAttribute("aria-label","Hisab Flow live voice");}; const stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true}}); liveStreamRef.current=stream; stream.getTracks().forEach(t=>pc.addTrack(t,stream));
     const dc=pc.createDataChannel("oai-events"); liveDcRef.current=dc;
     dc.onopen=()=>{setListening(true);setMsgs(m=>[...m,{role:"assistant",text:"Live voice is on. Talk normally — you can interrupt me naturally."}]);};
     dc.onmessage=async(ev)=>{try{const event=JSON.parse(ev.data);if(event.type==="conversation.item.input_audio_transcription.completed"&&event.transcript){setMsgs(m=>[...m,{role:"user",text:event.transcript}]);}
       if(event.type==="response.function_call_arguments.done"&&event.name==="hisab_command"){
         const args=JSON.parse(event.arguments||"{}");const command=String(args.text||"");if(!command)return;
         const r=await fetch('/api/ask',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({text:command,conversationId:'live-voice'})});const d=await r.json();const payload=r.ok?{ok:true,actionId:d.actionId,result:d.result}:{ok:false,error:d.error||'Command failed'};
         if(r.ok){const answer=d.result?.response||'I understood the request.';setMsgs(m=>[...m,{role:'assistant',text:answer}]);if(d.result?.risk==='LOW'&&d.result?.intent!=='UNKNOWN'){await fetch('/api/ai/execute',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({actionId:d.actionId,confirmed:true})});}}
         dc.send(JSON.stringify({type:'conversation.item.create',item:{type:'function_call_output',call_id:event.call_id,output:JSON.stringify(payload)}}));dc.send(JSON.stringify({type:'response.create'}));
       }
       if(event.type==="error"){setMsgs(m=>[...m,{role:"assistant",text:event.error?.message||"Live voice encountered an error."}]);}
     }catch{}}
     pc.onconnectionstatechange=()=>{if(["failed","closed","disconnected"].includes(pc.connectionState)){setListening(false);setBusy(false)}};
     const offer=await pc.createOffer();await pc.setLocalDescription(offer);await new Promise<void>(resolve=>{if(pc.iceGatheringState==="complete")return resolve();const f=()=>{if(pc.iceGatheringState==="complete"){pc.removeEventListener('icegatheringstatechange',f);resolve()}};pc.addEventListener('icegatheringstatechange',f)});
     const resp=await fetch('/api/voice/realtime',{method:'POST',headers:{'Content-Type':'application/sdp','x-hisab-language':language},body:pc.localDescription?.sdp||''});if(!resp.ok)throw new Error(await resp.text());const answer=await resp.text();await pc.setRemoteDescription({type:'answer',sdp:answer});
   }catch(e:any){livePcRef.current?.close();livePcRef.current=null;liveDcRef.current=null;liveStreamRef.current?.getTracks().forEach(t=>t.stop());liveStreamRef.current=null;setListening(false);setMsgs(m=>[...m,{role:'assistant',text:e.message||'Live voice needs a cloud voice provider. In free local mode, use the regular microphone button instead.'}]);}
   finally{setBusy(false)}
 }
 async function startVoice(auto=false){
   // Once voice is activated, keep the in-app hands-free session enabled. The
   // wake listener will resume after this turn unless Hisab is speaking/thinking.
   voiceSessionRef.current=true;
   if(listening){recRef.current?.stop();mediaRef.current?.stop();setListening(false);return}
   const localMode=process.env.NEXT_PUBLIC_AI_PROVIDER==='ollama'||process.env.NEXT_PUBLIC_AI_PROVIDER==='gemini';
   if(!localMode){
     if(typeof MediaRecorder!=="undefined"&&navigator.mediaDevices?.getUserMedia&&process.env.NEXT_PUBLIC_VOICE_CAPTURE!=="off"){
       try{const stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true}});const mr=new MediaRecorder(stream,{mimeType:MediaRecorder.isTypeSupported('audio/webm;codecs=opus')?'audio/webm;codecs=opus':undefined});chunksRef.current=[];mr.ondataavailable=e=>e.data.size&&chunksRef.current.push(e.data);mr.onstop=async()=>{stream.getTracks().forEach(t=>t.stop());const blob=new Blob(chunksRef.current,{type:mr.mimeType||'audio/webm'});const fd=new FormData();fd.append('file',blob,'voice.webm');fd.append('language',language==='Auto'?'':language.toLowerCase());setBusy(true);try{const r=await fetch('/api/voice/transcribe',{method:'POST',body:fd});const d=await r.json();if(!r.ok)throw new Error(d.error||'Voice transcription failed.');if(d.text){setText(d.text);await send(d.text)}}catch(e:any){setMsgs(m=>[...m,{role:'assistant',text:e.message||'Voice transcription failed. You can still type.'}])}finally{setBusy(false)}};mr.start();mediaRef.current=mr;setListening(true);return}catch{/* fall through */}}
     const SR=(window as any).SpeechRecognition||(window as any).webkitSpeechRecognition;if(!SR){setMsgs(m=>[...m,{role:'assistant',text:'Voice capture is unavailable in this browser. Please allow microphone access or type naturally.'}]);return}const r=new SR();recRef.current=r;r.lang=language==='Hindi'?'hi-IN':language==='Tamil'?'ta-IN':language==='Telugu'?'te-IN':language==='Kannada'?'kn-IN':language==='Malayalam'?'ml-IN':language==='Marathi'?'mr-IN':language==='Bengali'?'bn-IN':language==='Gujarati'?'gu-IN':'en-IN';r.interimResults=true;r.continuous=false;r.onstart=()=>setListening(true);r.onend=()=>setListening(false);r.onerror=()=>setListening(false);r.onresult=(e:any)=>{let final="";for(let i=0;i<e.results.length;i++)final+=e.results[i][0].transcript;setText(final)};r.start();return;
   }
   if(typeof MediaRecorder==="undefined"||!navigator.mediaDevices?.getUserMedia){setMsgs(m=>[...m,{role:"assistant",text:'Voice recording is unavailable in this browser. You can still type naturally.'}]);return}
   try{
     const stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true}});
     const mime=MediaRecorder.isTypeSupported('audio/webm;codecs=opus')?'audio/webm;codecs=opus':(MediaRecorder.isTypeSupported('audio/webm')?'audio/webm':'');
     const mr=mime?new MediaRecorder(stream,{mimeType:mime}):new MediaRecorder(stream);
     chunksRef.current=[];
     mr.ondataavailable=e=>e.data.size&&chunksRef.current.push(e.data);
     let heardSpeech=false; let lastLevel=0;
     // Automatic silence detection makes clarification turns hands-free. The user can
     // still press the mic button to stop immediately.
     const AudioCtx=window.AudioContext||(window as any).webkitAudioContext;
     const ctx=AudioCtx?new AudioCtx():null; audioContextRef.current=ctx;
     if(ctx){
       const source=ctx.createMediaStreamSource(stream);const analyser=ctx.createAnalyser();analyser.fftSize=1024;source.connect(analyser);const data=new Uint8Array(analyser.fftSize);
       const tick=()=>{if(!mediaRef.current||mediaRef.current!==mr)return;analyser.getByteTimeDomainData(data);let sum=0;for(const v of data){const n=(v-128)/128;sum+=n*n}const rms=Math.sqrt(sum/data.length);lastLevel=rms;if(rms>0.018)heardSpeech=true;if(heardSpeech&&rms<0.012){if(!silenceTimerRef.current)silenceTimerRef.current=setTimeout(()=>{if(mediaRef.current===mr)mr.stop();},1200)}else if(rms>=0.012&&silenceTimerRef.current){clearTimeout(silenceTimerRef.current);silenceTimerRef.current=null}requestAnimationFrame(tick)};requestAnimationFrame(tick);
     }
     mr.onstop=async()=>{
       if(silenceTimerRef.current){clearTimeout(silenceTimerRef.current);silenceTimerRef.current=null} audioContextRef.current?.close();audioContextRef.current=null;
       stream.getTracks().forEach(t=>t.stop());mediaRef.current=null;setListening(false);
       const blob=new Blob(chunksRef.current,{type:mr.mimeType||'audio/webm'});if(blob.size<1000){if(auto)setMsgs(m=>[...m,{role:'assistant',text:'I didn’t hear a reply. Say your answer when you are ready.'}]);return}
       const fd=new FormData();fd.append('file',blob,'voice.webm');fd.append('language',language==='Auto'?'':language.toLowerCase());
       setBusy(true);
       try{const r=await fetch('/api/voice/transcribe',{method:'POST',body:fd});const d=await r.json();if(!r.ok)throw new Error(d.error||'Voice transcription failed.');const transcript=String(d.text||'').trim();if(!transcript)throw new Error('I could not hear a clear sentence. Please try again.');setText(transcript);const currentPending=pendingRef.current;await send(transcript,currentPending&&!currentPending.auto?{intent:currentPending.result?.intent,entities:currentPending.result?.entities,question:currentPending.result?.response}:undefined)}catch(e:any){setMsgs(m=>[...m,{role:'assistant',text:e.message||'Voice transcription failed. You can still type.'}])}finally{setBusy(false)}};
     mr.start(150);mediaRef.current=mr;setListening(true);
   }catch(e:any){setMsgs(m=>[...m,{role:'assistant',text:e?.message||'Please allow microphone access and try again.'}]);}
 }
 const suggestions=["Ramesh paid 5k","Ramesh-ku rendu chain bill pannu, 20k cash received","Who owes me the most?","Show purchases above 50,000","What should I do today?","Explain why sales changed this month"];
 return <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
  <div className="card overflow-hidden shadow-[0_24px_70px_rgba(12,27,22,.08)]">
   <div className="bg-[#0a1712] px-5 py-5 text-white sm:px-7"><div className="flex flex-wrap items-center justify-between gap-3"><div><div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.18em] text-white/45"><Sparkles size={13} className="text-[#70d8ad]"/> AI business copilot</div><div className="mt-2 text-xl font-black tracking-tight">One conversation with your business.</div></div><div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs text-[#9fe3c5]"><ShieldCheck size={15}/> Safe execution</div></div></div>
   <div className="min-h-[470px] space-y-4 bg-[#f8faf9] p-4 sm:p-6">{msgs.map((m,i)=><div key={i} className={`flex ${m.role==='user'?'justify-end':''}`}><div className={`max-w-[88%] rounded-[22px] px-4 py-3 text-sm leading-6 shadow-sm ${m.role==='user'?'bg-[#0c6b4d] text-white':'border border-[#e3e9e5] bg-white text-[#26372f]'}`}>{m.text}</div></div>)}{busy&&<div className="flex items-center gap-2 text-xs text-[#819088]"><LoaderCircle className="animate-spin" size={15}/> Understanding your business…</div>}
    {pending&&!pending.auto&&<div className="rounded-[22px] border border-[#cfe6da] bg-[#eff8f3] p-4"><div className="flex items-center justify-between"><div className="font-black">{pending.result?.needsClarification?'I need one quick answer':'Review before I do it'}</div><span className="badge badge-amber">{pending.result?.needsClarification?'Listening for your answer':'Confirmation'}</span></div><div className="mt-3 text-sm leading-6 text-[#52625a]">{pending.result?.response}</div><div className="mt-3 grid gap-2 text-sm">{confirmationEntries(pending.result.entities||{}).filter(([k,v]:any)=>v!==null&&v!=='').map(([k,v]:any)=><div key={k} className="flex justify-between gap-4 rounded-xl bg-white/70 px-3 py-2"><span className="text-[#718078]">{k}</span><b className="text-right">{displayField(k,v)}</b></div>)}</div>{pending.matches?.length>0&&<div className="mt-3 rounded-xl bg-white p-3 text-sm"><div className="font-bold">Choose the matching customer</div>{pending.matches.map((x:any)=><button key={x.id} onClick={()=>setPending({...pending,result:{...pending.result,entities:{...pending.result.entities,customerId:x.id,customerName:x.name,customerResolution:'RESOLVED',createCustomer:false}}})} className="mt-2 block w-full rounded-xl border border-[#e3e9e5] p-3 text-left hover:bg-[#f5f7f5]">{x.name} <span className="text-xs text-[#89968f]">{x.phone||''}</span></button>)}</div>}<div className="mt-4 flex flex-wrap gap-2">{pending.result?.entities?.customerResolution==='CREATE_OR_CONFIRM'&&<button className="btn btn-soft" onClick={()=>{setPending({...pending,result:{...pending.result,entities:{...pending.result.entities,createCustomer:true},needsClarification:false,response:`Add ${pending.result.entities.proposedCustomerName} and continue with this ${pending.result.intent==='CREATE_SALE'?'sale':pending.result.intent==='CREATE_PURCHASE'?'purchase':'action'}?`}})}} disabled={busy}>Add customer</button>}<button className="btn btn-primary" onClick={()=>execute(true)} disabled={busy}><Check size={15}/> Confirm</button><button className="btn btn-ghost" onClick={()=>setPending(null)}><Edit3 size={15}/> Cancel</button></div></div>}
    {pending?.auto&&<div className="rounded-[22px] border border-[#d8e8df] bg-[#eff8f3] p-4 text-sm"><div className="flex items-center gap-2 font-bold"><BookOpen size={15} className="text-[#0c6b4d]"/> Ready to use live data</div><button onClick={()=>execute(true)} className="mt-3 btn btn-soft">Run from live data <Check size={15}/></button></div>}
   </div>
   <div className="border-t border-[#e3e9e5] bg-white p-4 sm:p-5"><div className="mb-3 flex flex-wrap items-center gap-2"><div className="flex items-center gap-2 rounded-full bg-[#f2f6f3] px-3 py-2 text-xs text-[#52625a]"><Languages size={14}/><select value={language} onChange={e=>setLanguage(e.target.value)} className="bg-transparent font-semibold outline-none">{languages.map(x=><option key={x}>{x}</option>)}</select></div><button onClick={()=>setVoiceEnabled(!voiceEnabled)} className="btn btn-ghost !rounded-full !px-3 !py-2 text-xs">{voiceEnabled?<Volume2 size={14}/>:<VolumeX size={14}/>} Voice {voiceEnabled?'on':'off'}</button>{speaking&&<button onClick={stopSpeaking} className="btn btn-ghost !rounded-full !px-3 !py-2 text-xs"><Square size={12}/> Stop</button>}</div><div className="flex items-end gap-2"><button onClick={startLiveVoice} disabled={busy} title="ChatGPT-style live voice" className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl transition ${livePcRef.current?'bg-[#ffe8e7] text-[#a42d28]':'bg-[#edf7f2] text-[#0c6b4d] hover:bg-[#dff2e9]'}`}>{livePcRef.current?<Square size={18}/>:<Radio size={19}/>}</button><button onClick={()=>startVoice()} disabled={busy||!!livePcRef.current} title="Record a voice message" className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#f3f6f4] text-[#52625a] hover:bg-[#e8efeb]">{listening&&!livePcRef.current?<Square size={18}/>:<Mic size={19}/>}</button><textarea value={text} onChange={e=>setText(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send()}}} className="field min-h-[52px] resize-none !rounded-2xl" placeholder="Say anything… in any language. I’ll understand the meaning."/><button onClick={()=>send()} disabled={busy||!text.trim()} className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#0c6b4d] text-white disabled:opacity-40"><Send size={18}/></button></div><div className="mt-2 text-[11px] text-[#91a099]">Natural speech → transcription → intent → entity matching → validation → safe business engine. No rigid sentence templates.</div></div>
  </div>
  <div className="space-y-4"><div className="card p-5"><div className="font-black">Speak naturally</div><p className="mt-1 text-xs leading-5 text-[#819088]">The examples are only prompts — you don't have to speak this way.</p><div className="mt-3 space-y-2">{suggestions.map(x=><button key={x} onClick={()=>setText(x)} className="block w-full rounded-2xl border border-[#e3e9e5] p-3 text-left text-sm text-[#52625a] transition hover:-translate-y-0.5 hover:bg-[#f7faf8]">“{x}”</button>)}</div></div><div className="card p-5"><div className="font-black">How your data stays safe</div><div className="mt-3 space-y-3 text-xs leading-5 text-[#718078]"><div><b className="text-[#26372f]">Understand</b><br/>AI interprets language; it does not write directly to the database.</div><div><b className="text-[#26372f]">Validate</b><br/>Business rules, permissions, entity matching and confirmation run before financial changes.</div><div><b className="text-[#26372f]">Execute</b><br/>The deterministic accounting engine creates payments, sales, inventory movements and audit events.</div></div></div></div>
 </div>
}
