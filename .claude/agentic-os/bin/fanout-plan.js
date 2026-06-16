#!/usr/bin/env node
'use strict';
// Plan disjoint parallel batches from a tasks file. node bin/fanout-plan.js <tasks.json>
const fs = require('node:fs');
const { planFanout } = require('../src/fanout');
let tasks = []; try { tasks = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')); } catch { console.log('usage: fanout-plan.js <tasks.json> [{id,files}]'); process.exit(0); }
const batches = planFanout(tasks);
console.log(JSON.stringify({ batches: batches.length, plan: batches }, null, 2));
