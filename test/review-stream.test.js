import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createReviewStream } from '../src/review-stream.js';

const collect = async stream => { const result = []; for await (const chunk of stream) result.push(chunk); return result; };
const stop = { type: 'finish', reason: { kind: 'stop' } };
function harness(info) {
  const prepared = []; const dispatched = [];
  const llm = { async prepareCall(config, signal, configure) {
    const controls = configure(config, info);
    const resolved = { ...controls, ...(controls.reasoningEffort === undefined && info.reasoning?.defaultEffort
      ? { reasoningEffort: info.reasoning.defaultEffort } : {}) };
    prepared.push({config, signal, resolved});
    return { config: resolved, stream: async function* (request) { dispatched.push(request); yield stop; } };
  } };
  return { run: createReviewStream(llm), prepared, dispatched };
}
const options = extra => Object.freeze({provider:'p',model:'m',purpose:'auto-review',
  system:'REVIEW_POLICY',messages:Object.freeze([]),sessionId:'s',signal:new AbortController().signal,...extra});

test('always-thinking models receive their first advertised effort instead of implicit off', async () => {
  const h = harness({reasoning:{efforts:[{id:'low'},{id:'high'},{id:'max'}]}});
  const request = options();
  assert.deepEqual(await collect(h.run(request)), [stop]);
  assert.equal(h.dispatched[0].reasoningEffort, 'low');
  assert.equal('reasoningEffort' in request, false);
  for (const key of Object.keys(request)) assert.equal(h.dispatched[0][key],request[key]);
  assert.equal(h.prepared[0].signal, request.signal);
  assert.ok(Object.isFrozen(h.dispatched[0]));
});
for (const [label,info,extra,expected] of [
  ['non-reasoning',{}, {}, undefined],
  ['optional reasoning',{reasoning:{efforts:[{id:'off'},{id:'high'}]}},{},undefined],
  ['adapter default',{reasoning:{efforts:[{id:'low'},{id:'high'}],defaultEffort:'high'}},{},'high'],
  ['explicit effort',{reasoning:{efforts:[{id:'low'},{id:'high'}]}},{reasoningEffort:'high'},'high'],
  ['unsupported explicit effort',{reasoning:{efforts:[{id:'low'}]}},{reasoningEffort:'max'},'max'],
  ['empty capability list',{reasoning:{efforts:[]}},{},undefined],
]) test(`preserves ${label} without clamping or aliasing`, async () => {
  const h = harness(info); await collect(h.run(options(extra)));
  assert.equal(h.dispatched[0].reasoningEffort,expected);
});
test('retains private routing symbols and uses registration-bound stream, not a new call', async () => {
  const key=Symbol('route'); const h=harness({}); const request=options({[key]:{},maxTokens:123,stop:['END'],temperature:0});
  await collect(h.run(request));
  assert.equal(h.dispatched.length,1); assert.equal(h.dispatched[0][key],request[key]);
  assert.equal(h.prepared[0].config.maxTokens,123);
  assert.equal(h.prepared[0].config.stop,request.stop);
  assert.equal(h.prepared[0].config.temperature,0);
  assert.equal('system' in h.prepared[0].config,false);
});
test('preparation failures propagate unchanged for router classification', async () => {
  const failure=Object.assign(new Error('not configured'),{code:'AUTH'});
  const run=createReviewStream({prepareCall:async()=>{throw failure;}});
  await assert.rejects(collect(run(options())),error=>error===failure);
});
