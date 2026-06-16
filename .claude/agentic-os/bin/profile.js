#!/usr/bin/env node
const { loadProfile, saveProfile, profilePath, addIdentity } = require('../hooks/lib/profile');
const cmd = process.argv[2];
function flag(name) { const i = process.argv.indexOf('--' + name); return i >= 0 ? process.argv[i + 1] : undefined; }
if (cmd === 'get') {
  process.stdout.write(JSON.stringify(loadProfile(), null, 2) + '\n');
} else if (cmd === 'init') {
  saveProfile({}); console.log('profile initialized at', profilePath());
} else if (cmd === 'add-identity') {
  // Per-org commit identity: matched against the repo's git remote URL. e.g.
  //   profile.js add-identity --match "dronequote|leadprospecting" --email me@leadprospecting.ai [--name "..."] [--attribution solo]
  const saved = addIdentity({ match: flag('match'), email: flag('email'), name: flag('name'), attribution: flag('attribution') });
  if (!saved || saved.error) { console.error((saved && saved.error) || 'usage: profile.js add-identity --match <regex> --email <email> [--name <name>] [--attribution solo|co-authored]'); process.exit(2); }
  if (saved.warning) console.error('⚠ ' + saved.warning);
  process.stdout.write(JSON.stringify(saved.identities, null, 2) + '\n');
} else if (cmd === 'set') {
  const updates = {};
  for (const arg of process.argv.slice(3)) {
    const i = arg.indexOf('=');
    if (i <= 0) continue;
    const key = arg.slice(0, i), val = arg.slice(i + 1);
    if (key.includes('.')) { // dotted -> nested (e.g. preferences.communicationStyle)
      const [head, ...rest] = key.split('.');
      let o = (updates[head] = updates[head] || {});
      for (let j = 0; j < rest.length - 1; j++) o = (o[rest[j]] = o[rest[j]] || {});
      o[rest[rest.length - 1]] = val;
    } else updates[key] = val;
  }
  process.stdout.write(JSON.stringify(saveProfile(updates), null, 2) + '\n');
} else {
  console.error('usage: profile.js get | init | set k=v ...'); process.exit(2);
}
