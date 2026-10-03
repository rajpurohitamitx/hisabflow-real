const key=process.env.OPENAI_API_KEY;
if(!key){console.log(JSON.stringify({ok:true,skipped:true,reason:'OPENAI_API_KEY not configured'},null,2));process.exit(0)}
const model=process.env.OPENAI_TEXT_MODEL||'gpt-5';
const r=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({model,input:'Reply with exactly: HISAB_FLOW_OPENAI_OK',max_output_tokens:20})});
if(!r.ok){console.error(await r.text());process.exit(1)}
const data=await r.json();
const text=data.output_text||'';
if(!text.includes('HISAB_FLOW_OPENAI_OK')){console.error('OpenAI response verification failed:',text);process.exit(1)}
console.log(JSON.stringify({ok:true,openai:true,model},null,2));
