import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createReviewHandler } from '../src/router.js';
import { createReviewStream } from '../src/review-stream.js';
import { withCodexCompatibility } from '../src/codex-compat.js';
import { REVIEW_TASK_REMINDER } from '../src/review-framing.js';

const collect=async stream=>{const result=[];for await(const chunk of stream)result.push(chunk);return result;};
const output=text=>[{type:'block-start',index:0,blockType:'text'}, {type:'text-delta',index:0,text},
  {type:'block-end',index:0,block:{type:'text',text}},{type:'finish',reason:{kind:'stop'}}];
function runtime(routing, respond) {
  let listener;let entries=0;const calls=[];const prepared=[];
  const llm={
    stream(request){assert.ok(++entries<20,'rerouting must terminate');return listener(request,()=>respond(request,calls));},
    async prepareCall(config,signal,configure){
      const info=config.provider==='kimi-coding'?{systemPromptUpdate:'in-history',reasoning:{efforts:[{id:'low'},{id:'high'}]}}:{systemPromptUpdate:'in-history'};
      const resolved=configure(config,info);prepared.push(resolved);
      return {...info,config:resolved,stream(request){return llm.stream(request);}};
    },
  };
  const handler=createReviewHandler({readRouting:()=>routing,stream:createReviewStream(llm),cleanupMs:20});
  listener=withCodexCompatibility(handler,options=>llm.stream(options));
  return {llm,calls,prepared,handler};
}
const input=()=>Object.freeze({purpose:'auto-review',provider:'openai-codex',model:'session',temperature:0,
  system:'REVIEW_POLICY\nOnly strict risk/decision JSON is allowed.',
  messages:Object.freeze([{role:'user',content:[{type:'text',text:'{"kind":"tool-call","name":"read"}'}]}]),signal:new AbortController().signal});
for(const mode of ['session','chain'])test(`${mode}: frozen reviewer goes through preparation/framing and temperature removal exactly once`,async()=>{
  const h=runtime({mode,routes:mode==='chain'?[{provider:'openai-codex',model:'target'}]:[],timeoutMs:1000},async function*(request,calls){
    calls.push(request);assert.equal('temperature' in request,false);
    assert.equal(request.messages.at(-1).content[0].text,REVIEW_TASK_REMINDER);
    yield* output('{"risk":"low","decision":"allow"}');
  });
  const original=input();assert.deepEqual(await collect(h.llm.stream(original)),output('{"risk":"low","decision":"allow"}'));
  assert.equal(h.calls.length,1);assert.equal(h.prepared.length,1);
  assert.equal(original.messages.length,1);assert.equal(original.temperature,0);
  assert.equal(h.calls[0].model,mode==='session'?'session':'target');
});
test('AUTH before an answer advances to prepared Kimi with supported effort',async()=>{
 const h=runtime({mode:'chain',routes:[{provider:'moonshotai',model:'old'},{provider:'kimi-coding',model:'k3'}],timeoutMs:1000},async function*(request,calls){
  calls.push(request);
  if(request.provider==='moonshotai'){yield {type:'finish',reason:{kind:'error',failure:{code:'AUTH',message:'401'}}};return;}
  assert.equal(request.reasoningEffort,'low');yield* output('{"risk":"medium","decision":"deny","reason":"No authorization"}');
 });
 assert.deepEqual(await collect(h.llm.stream(input())),output('{"risk":"medium","decision":"deny","reason":"No authorization"}'));
 assert.equal(h.calls.length,2);
});
for(const answer of ['{"risk":"high","decision":"deny"}','malformed reviewer prose'])test(`never retries or rewrites ${answer}`,async()=>{
 const h=runtime({mode:'chain',routes:[{provider:'openai-codex',model:'one'},{provider:'kimi-coding',model:'k3'}],timeoutMs:1000},async function*(request,calls){calls.push(request);yield* output(answer);});
 assert.deepEqual(await collect(h.llm.stream(input())),output(answer));assert.equal(h.calls.length,1);
});
