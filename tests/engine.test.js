import test from 'node:test';
import assert from 'node:assert/strict';
import {sample,parseCSV,backtest,sma,instruments} from '../src/engine.js';
test('demo bars are deterministic and valid for all contracts',()=>{for(const s of Object.keys(instruments)){const b=sample(s);assert.deepEqual(b,sample(s));assert.equal(b.length,240);assert.ok(b.every(v=>v.low<=Math.min(v.open,v.close)&&v.high>=Math.max(v.open,v.close)))}});
test('CSV validates price ranges and ordering',()=>{const h='time,open,high,low,close\n',v='2026-01-01T00:00:00Z,10,12,9,11\n2026-01-01T00:05:00Z,11,13,10,12\n2026-01-01T00:10:00Z,12,14,11,13';assert.equal(parseCSV(h+v).length,3);assert.throws(()=>parseCSV(h+v.replace(',10,12,9,11',',10,8,9,11')));assert.throws(()=>parseCSV(h+v.replace('00:05:00','00:00:00')))});
test('SMA warmup and arithmetic',()=>assert.deepEqual(sma([{close:1},{close:3},{close:5}],2),[null,2,4]));
test('backtest fills at next open and applies costs',()=>{const b=[5,4,3,2,5,6,7,2,1,2].map((close,i)=>({close,open:100+i,time:i}));const r=backtest(b,{fast:2,slow:3,point:2,quantity:2,commission:1,slippage:.25});assert.equal(r.trades.length,1);assert.equal(r.trades[0].entry,105.25);assert.equal(r.trades[0].exit,107.75);assert.equal(r.net,8)});
test('costs reduce returns; empty results and invalid periods handled',()=>{const b=sample();assert.ok(backtest(b,{commission:10,slippage:1}).net<backtest(b,{commission:0,slippage:0}).net);assert.equal(backtest(Array.from({length:40},(_,i)=>({open:10,close:10,time:i}))).trades.length,0);assert.throws(()=>backtest(b,{fast:21,slow:9}))});
