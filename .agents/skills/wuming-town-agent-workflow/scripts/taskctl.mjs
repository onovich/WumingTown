#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const VALID_STATES = new Set([
  'proposed', 'ready', 'claimed', 'in_progress', 'review_requested',
  'changes_requested', 'verified', 'integrated', 'done', 'blocked'
]);

function findRepoRoot(start) {
  let current = path.resolve(start);
  while (true) {
    if (fs.existsSync(path.join(current, 'project-manifest.json')) && fs.existsSync(path.join(current, 'AGENTS.md'))) {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return null;
}

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = findRepoRoot(process.cwd()) ?? findRepoRoot(scriptDir);
if (!root) fail('Cannot locate repository root (expected AGENTS.md and project-manifest.json).');

const coord = path.join(root, 'coordination');
const tasksDir = path.join(coord, 'tasks');
const inboxDir = path.join(coord, 'inbox');
const reportsDir = path.join(coord, 'reports');
const rolesPath = path.join(coord, 'roles.json');
const threadsPath = path.join(coord, 'thread-registry.json');

ensureLayout();

const [command = 'help', ...rawArgs] = process.argv.slice(2);
const args = parseArgs(rawArgs);

try {
  switch (command) {
    case 'init': cmdInit(); break;
    case 'validate': cmdValidate(); break;
    case 'status': cmdStatus(); break;
    case 'next': cmdNext(args); break;
    case 'claim': cmdClaim(args); break;
    case 'complete': cmdComplete(args); break;
    case 'review': cmdReview(args); break;
    case 'integrate': cmdIntegrate(args); break;
    case 'done': cmdDone(args); break;
    case 'block': cmdBlock(args); break;
    case 'unblock': cmdUnblock(args); break;
    case 'send': cmdSend(args); break;
    case 'inbox': cmdInbox(args); break;
    case 'ack': cmdAck(args); break;
    case 'route': cmdRoute(); break;
    case 'register-thread': cmdRegisterThread(args); break;
    case 'unregister-thread': cmdUnregisterThread(args); break;
    case 'threads': cmdThreads(); break;
    case 'create': cmdCreate(args); break;
    case 'help': printHelp(); break;
    default: fail(`Unknown command: ${command}`);
  }
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  fail(message);
}

function parseArgs(values) {
  const result = {};
  for (let i = 0; i < values.length; i += 1) {
    const token = values[i];
    if (!token.startsWith('--')) fail(`Unexpected argument: ${token}`);
    const key = token.slice(2);
    const next = values[i + 1];
    if (next === undefined || next.startsWith('--')) {
      result[key] = true;
    } else {
      result[key] = next;
      i += 1;
    }
  }
  return result;
}

function arg(a, key, required = true) {
  const value = a[key];
  if (required && (value === undefined || value === true || value === '')) fail(`Missing --${key}`);
  return value === true ? undefined : value;
}

function ensureLayout() {
  for (const dir of [coord, tasksDir, inboxDir, reportsDir, path.join(coord, 'decisions'), path.join(coord, 'blockers')]) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function now() { return new Date().toISOString(); }
function taskPath(id) { return path.join(tasksDir, `${id}.json`); }
function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function atomicWrite(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temp = `${file}.${process.pid}.${crypto.randomUUID()}.tmp`;
  fs.writeFileSync(temp, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  fs.renameSync(temp, file);
}
function readTask(id) {
  const file = taskPath(id);
  if (!fs.existsSync(file)) fail(`Task not found: ${id}`);
  return readJson(file);
}
function allTaskFiles() {
  return fs.readdirSync(tasksDir).filter((f) => f.endsWith('.json')).sort().map((f) => path.join(tasksDir, f));
}
function allTasks() { return allTaskFiles().map(readJson); }
function roles() {
  if (!fs.existsSync(rolesPath)) return [];
  const data = readJson(rolesPath);
  return Array.isArray(data.roles) ? data.roles.map((r) => r.id) : [];
}
function threadRegistry() {
  if (!fs.existsSync(threadsPath)) return { schemaVersion: 1, threads: {} };
  const data = readJson(threadsPath);
  data.threads ??= {};
  return data;
}
function history(task, actor, action, details = '') {
  task.history ??= [];
  task.history.push({ at: now(), actor, action, details });
  task.updatedAt = now();
}
function withTaskLock(id, fn) {
  const lock = `${taskPath(id)}.lock`;
  let fd;
  try {
    fd = fs.openSync(lock, 'wx');
  } catch {
    fail(`Task ${id} is locked by another process.`);
  }
  try { return fn(); }
  finally {
    if (fd !== undefined) fs.closeSync(fd);
    fs.rmSync(lock, { force: true });
  }
}
function dependencyDone(id, map) { return map.get(id)?.state === 'done'; }
function assertDependencies(task, map = new Map(allTasks().map((t) => [t.id, t]))) {
  const missing = (task.dependsOn ?? []).filter((id) => !map.has(id));
  if (missing.length) fail(`Task ${task.id} has missing dependencies: ${missing.join(', ')}`);
  const blocked = (task.dependsOn ?? []).filter((id) => !dependencyDone(id, map));
  if (blocked.length) fail(`Task ${task.id} is blocked by: ${blocked.join(', ')}`);
}
function assertOwner(task, agent) {
  if (task.ownerRole !== agent) fail(`${agent} is not owner role ${task.ownerRole} for ${task.id}.`);
  if (task.claimedBy && task.claimedBy !== agent) fail(`Task ${task.id} is claimed by ${task.claimedBy}, not ${agent}.`);
}
function messageId() {
  return `MSG-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
}
function sendMessage({ from, to, taskId = null, kind = 'info', subject, body, artifacts = [] }) {
  const known = roles();
  if (known.length && !known.includes(to)) fail(`Unknown recipient role: ${to}`);
  const id = messageId();
  const dir = path.join(inboxDir, to);
  fs.mkdirSync(dir, { recursive: true });
  const msg = { id, from, to, taskId, kind, subject, body, artifacts, createdAt: now(), acknowledgedAt: null };
  atomicWrite(path.join(dir, `${id}.json`), msg);
  return msg;
}
function reportRelative(id) { return `coordination/reports/${id}.md`; }
function reportAbsolute(id) { return path.join(root, reportRelative(id)); }

function cmdInit() {
  ensureLayout();
  console.log(`Coordination layout ready at ${path.relative(process.cwd(), coord) || coord}`);
}

function cmdValidate() {
  const errors = [];
  const files = allTaskFiles();
  const tasks = [];
  const ids = new Set();
  const knownRoles = new Set(roles());
  for (const file of files) {
    try {
      const t = readJson(file);
      tasks.push(t);
      const required = ['id', 'title', 'summary', 'state', 'ownerRole', 'reviewerRole', 'dependsOn', 'docs', 'acceptance', 'requiredChecks', 'branch', 'createdAt', 'updatedAt', 'history'];
      for (const key of required) if (!(key in t)) errors.push(`${path.basename(file)} missing ${key}`);
      if (ids.has(t.id)) errors.push(`Duplicate task id ${t.id}`);
      ids.add(t.id);
      if (!VALID_STATES.has(t.state)) errors.push(`${t.id} invalid state ${t.state}`);
      if (knownRoles.size && !knownRoles.has(t.ownerRole)) errors.push(`${t.id} unknown ownerRole ${t.ownerRole}`);
      if (knownRoles.size && !knownRoles.has(t.reviewerRole)) errors.push(`${t.id} unknown reviewerRole ${t.reviewerRole}`);
      if (!Array.isArray(t.dependsOn) || !Array.isArray(t.acceptance) || !Array.isArray(t.requiredChecks)) errors.push(`${t.id} array fields invalid`);
      if (path.basename(file, '.json') !== t.id) errors.push(`${t.id} filename mismatch`);
    } catch (e) { errors.push(`${file}: ${e.message}`); }
  }
  const map = new Map(tasks.map((t) => [t.id, t]));
  for (const t of tasks) for (const d of t.dependsOn ?? []) if (!map.has(d)) errors.push(`${t.id} missing dependency ${d}`);
  const visiting = new Set(), visited = new Set();
  function visit(id, chain = []) {
    if (visiting.has(id)) { errors.push(`Dependency cycle: ${[...chain, id].join(' -> ')}`); return; }
    if (visited.has(id)) return;
    visiting.add(id);
    for (const d of map.get(id)?.dependsOn ?? []) visit(d, [...chain, id]);
    visiting.delete(id); visited.add(id);
  }
  for (const id of map.keys()) visit(id);
  if (fs.existsSync(threadsPath)) {
    try {
      const registry = threadRegistry();
      for (const [role, value] of Object.entries(registry.threads ?? {})) {
        if (knownRoles.size && !knownRoles.has(role)) errors.push(`thread registry has unknown role ${role}`);
        if (!value || typeof value.threadId !== 'string' || !value.threadId) errors.push(`thread registry ${role} missing threadId`);
      }
    } catch (e) { errors.push(`thread registry: ${e.message}`); }
  }
  if (fs.existsSync(inboxDir)) {
    for (const roleDir of fs.readdirSync(inboxDir)) {
      const dir = path.join(inboxDir, roleDir);
      if (!fs.statSync(dir).isDirectory()) continue;
      for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.json'))) {
        try {
          const m = readJson(path.join(dir, file));
          for (const k of ['id', 'from', 'to', 'kind', 'subject', 'body', 'createdAt']) if (!(k in m)) errors.push(`${roleDir}/${file} missing ${k}`);
          if (m.to !== roleDir) errors.push(`${roleDir}/${file} recipient mismatch`);
        } catch (e) { errors.push(`${roleDir}/${file}: ${e.message}`); }
      }
    }
  }
  if (errors.length) {
    console.error(`Validation failed with ${errors.length} error(s):`);
    for (const e of errors) console.error(`- ${e}`);
    process.exit(2);
  }
  console.log(`Validation passed: ${tasks.length} task(s), ${knownRoles.size} role(s).`);
}

function cmdStatus() {
  const tasks = allTasks();
  const counts = {};
  for (const t of tasks) counts[t.state] = (counts[t.state] ?? 0) + 1;
  console.log('Task states:');
  for (const state of [...VALID_STATES]) if (counts[state]) console.log(`  ${state}: ${counts[state]}`);
  const ready = tasks.filter((t) => t.state === 'ready');
  if (ready.length) {
    console.log('\nReady:');
    for (const t of ready) console.log(`  ${t.id} [${t.ownerRole}] ${t.title}`);
  }
  const blocked = tasks.filter((t) => t.state === 'blocked');
  if (blocked.length) {
    console.log('\nBlocked:');
    for (const t of blocked) console.log(`  ${t.id}: ${t.blocker?.reason ?? 'unspecified'}`);
  }
  const unread = unreadMessages();
  console.log(`\nUnread inbox messages: ${unread.length}`);
  const perRole = new Map();
  for (const x of unread) perRole.set(x.msg.to, (perRole.get(x.msg.to) ?? 0) + 1);
  for (const [role, count] of [...perRole.entries()].sort()) console.log(`  ${role}: ${count}`);
}

function cmdNext(a) {
  const role = arg(a, 'role');
  const map = new Map(allTasks().map((t) => [t.id, t]));
  const next = [...map.values()].filter((t) => t.ownerRole === role && t.state === 'ready' && (t.dependsOn ?? []).every((d) => dependencyDone(d, map)));
  if (!next.length) return console.log(`No ready tasks for ${role}.`);
  for (const t of next) console.log(`${t.id}\t${t.title}\t${t.branch}`);
}

function cmdClaim(a) {
  const id = arg(a, 'id'); const agent = arg(a, 'agent'); const thread = arg(a, 'thread', false) ?? null;
  withTaskLock(id, () => {
    const task = readTask(id);
    assertOwner(task, agent);
    assertDependencies(task);
    if (!['ready', 'changes_requested', 'claimed'].includes(task.state)) fail(`Cannot claim ${id} from state ${task.state}.`);
    if (task.claimedBy && task.claimedBy !== agent) fail(`${id} already claimed by ${task.claimedBy}.`);
    task.claimedBy = agent; task.threadLabel = thread; task.state = 'in_progress'; task.blocker = null;
    history(task, agent, 'claim', thread ? `thread=${thread}` : '');
    atomicWrite(taskPath(id), task);
  });
  console.log(`${id} claimed by ${agent}.`);
}

function cmdComplete(a) {
  const id = arg(a, 'id'); const agent = arg(a, 'agent'); const summary = arg(a, 'summary');
  withTaskLock(id, () => {
    const task = readTask(id); assertOwner(task, agent);
    if (!['in_progress', 'changes_requested'].includes(task.state)) fail(`Cannot complete ${id} from state ${task.state}.`);
    const report = task.reportPath ?? reportRelative(id);
    if (!fs.existsSync(path.join(root, report))) fail(`Missing work report: ${report}`);
    task.reportPath = report; task.state = 'review_requested';
    history(task, agent, 'complete', summary);
    atomicWrite(taskPath(id), task);
    const msg = sendMessage({ from: agent, to: task.reviewerRole, taskId: id, kind: 'review-request', subject: `${id} ready for review`, body: summary, artifacts: [report, task.branch] });
    console.log(`${id} moved to review_requested; sent ${msg.id} to ${task.reviewerRole}.`);
  });
}

function cmdReview(a) {
  const id = arg(a, 'id'); const agent = arg(a, 'agent'); const verdict = arg(a, 'verdict'); const summary = arg(a, 'summary');
  if (!['verified', 'changes_requested'].includes(verdict)) fail('--verdict must be verified or changes_requested');
  withTaskLock(id, () => {
    const task = readTask(id);
    if (task.state !== 'review_requested') fail(`Cannot review ${id} from state ${task.state}.`);
    if (agent !== task.reviewerRole) fail(`${agent} is not reviewer ${task.reviewerRole}.`);
    task.state = verdict;
    task.review = { reviewer: agent, verdict, summary, at: now() };
    history(task, agent, 'review', `${verdict}: ${summary}`);
    atomicWrite(taskPath(id), task);
    const msg = sendMessage({ from: agent, to: task.ownerRole, taskId: id, kind: verdict === 'verified' ? 'review-approved' : 'changes-requested', subject: `${id} review: ${verdict}`, body: summary, artifacts: task.reportPath ? [task.reportPath] : [] });
    console.log(`${id} review ${verdict}; sent ${msg.id} to ${task.ownerRole}.`);
  });
}

function cmdIntegrate(a) {
  const id = arg(a, 'id'); const agent = arg(a, 'agent'); const summary = arg(a, 'summary');
  withTaskLock(id, () => {
    const task = readTask(id);
    if (agent !== 'project-director') fail('Only project-director may integrate verified work.');
    if (task.state !== 'verified') fail(`Cannot integrate ${id} from state ${task.state}.`);
    task.state = 'integrated'; task.integration = { by: agent, summary, at: now() };
    history(task, agent, 'integrate', summary); atomicWrite(taskPath(id), task);
  });
  console.log(`${id} integrated.`);
}

function cmdDone(a) {
  const id = arg(a, 'id'); const agent = arg(a, 'agent');
  withTaskLock(id, () => {
    const task = readTask(id);
    if (agent !== 'project-director') fail('Only project-director may close integrated work.');
    if (task.state !== 'integrated') fail(`Cannot close ${id} from state ${task.state}.`);
    task.state = 'done'; history(task, agent, 'done'); atomicWrite(taskPath(id), task);
  });
  const promoted = refreshReady(agent);
  console.log(`${id} done.${promoted.length ? ` Promoted: ${promoted.join(', ')}` : ''}`);
}

function refreshReady(actor) {
  const tasks = allTasks(); const map = new Map(tasks.map((t) => [t.id, t])); const promoted = [];
  for (const t of tasks) {
    if (t.state === 'proposed' && (t.dependsOn ?? []).every((d) => dependencyDone(d, map))) {
      t.state = 'ready'; history(t, actor, 'promote-ready', 'all dependencies done'); atomicWrite(taskPath(t.id), t); promoted.push(t.id);
    }
  }
  return promoted;
}

function cmdBlock(a) {
  const id = arg(a, 'id'); const agent = arg(a, 'agent'); const to = arg(a, 'to'); const reason = arg(a, 'reason');
  withTaskLock(id, () => {
    const task = readTask(id); assertOwner(task, agent);
    if (['done', 'integrated'].includes(task.state)) fail(`Cannot block ${id} from ${task.state}.`);
    const previousState = task.state;
    task.state = 'blocked'; task.blocker = { by: agent, to, reason, previousState, at: now() };
    history(task, agent, 'block', reason); atomicWrite(taskPath(id), task);
    const msg = sendMessage({ from: agent, to, taskId: id, kind: 'blocker', subject: `${id} blocked`, body: reason, artifacts: task.reportPath ? [task.reportPath] : [] });
    console.log(`${id} blocked; sent ${msg.id} to ${to}.`);
  });
}

function cmdUnblock(a) {
  const id = arg(a, 'id'); const agent = arg(a, 'agent'); const summary = arg(a, 'summary');
  withTaskLock(id, () => {
    const task = readTask(id);
    if (task.state !== 'blocked') fail(`${id} is not blocked.`);
    const restore = task.blocker?.previousState === 'review_requested' ? 'review_requested' : (task.claimedBy ? 'in_progress' : 'ready');
    task.state = restore; task.blocker = null; history(task, agent, 'unblock', summary); atomicWrite(taskPath(id), task);
  });
  console.log(`${id} unblocked.`);
}

function cmdSend(a) {
  const from = arg(a, 'from');
  const known = roles(); if (known.length && !known.includes(from)) fail(`Unknown sender role: ${from}`); const to = arg(a, 'to'); const subject = arg(a, 'subject'); const body = arg(a, 'body');
  const taskId = arg(a, 'task', false) ?? null; const kind = arg(a, 'kind', false) ?? 'info';
  const artifacts = arg(a, 'artifact', false) ? String(a.artifact).split(',').filter(Boolean) : [];
  const msg = sendMessage({ from, to, taskId, kind, subject, body, artifacts });
  console.log(`Sent ${msg.id} to ${to}.`);
}

function messageFilesForRole(role) {
  const dir = path.join(inboxDir, role);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort().map((f) => path.join(dir, f));
}
function unreadMessages() {
  const result = [];
  if (!fs.existsSync(inboxDir)) return result;
  for (const role of fs.readdirSync(inboxDir).sort()) {
    const dir = path.join(inboxDir, role); if (!fs.statSync(dir).isDirectory()) continue;
    for (const file of messageFilesForRole(role)) { const msg = readJson(file); if (!msg.acknowledgedAt) result.push({ file, msg }); }
  }
  return result;
}
function cmdInbox(a) {
  const role = arg(a, 'role'); const includeAll = Boolean(a.all); const jsonOut = Boolean(a.json);
  const rows = messageFilesForRole(role).map((file) => ({ file, msg: readJson(file) })).filter(({ msg }) => includeAll || !msg.acknowledgedAt);
  if (jsonOut) return console.log(JSON.stringify(rows.map(({ file, msg }) => ({ path: path.relative(root, file), ...msg })), null, 2));
  if (!rows.length) return console.log(`No ${includeAll ? '' : 'unacknowledged '}messages for ${role}.`);
  for (const { file, msg } of rows) console.log(`${msg.id}\t${msg.kind}\t${msg.from}\t${msg.taskId ?? '-'}\t${msg.subject}\t${path.relative(root, file)}`);
}
function cmdAck(a) {
  const role = arg(a, 'role'); const id = arg(a, 'message');
  const file = path.join(inboxDir, role, `${id}.json`);
  if (!fs.existsSync(file)) fail(`Message not found: ${id} in ${role}`);
  const msg = readJson(file); if (!msg.acknowledgedAt) { msg.acknowledgedAt = now(); atomicWrite(file, msg); }
  console.log(`${id} acknowledged by ${role}.`);
}
function cmdRoute() {
  const rows = unreadMessages();
  if (!rows.length) return console.log('No messages require routing.');
  const registry = threadRegistry();
  const groups = new Map();
  for (const row of rows) { const arr = groups.get(row.msg.to) ?? []; arr.push(row); groups.set(row.msg.to, arr); }
  for (const [role, items] of groups) {
    const registered = registry.threads?.[role] ?? null;
    console.log(`\n=== Route to ${role} (${items.length}) ===`);
    if (registered) console.log(`Registered thread: ${registered.threadId}${registered.label ? ` (${registered.label})` : ''}`);
    for (const { file, msg } of items) {
      console.log(`- ${msg.id} [${msg.kind}] task=${msg.taskId ?? '-'} from=${msg.from}`);
      console.log(`  ${msg.subject}: ${msg.body}`);
      console.log(`  file: ${path.relative(root, file)}`);
      if (msg.artifacts?.length) console.log(`  artifacts: ${msg.artifacts.join(', ')}`);
    }
    if (registered) {
      console.log(`Suggested Codex instruction: Continue/steer thread ${registered.threadId} for role ${role} with the unacknowledged messages and paths above. In an Agents SDK/MCP orchestration, use codex-reply with this threadId.`);
    } else {
      console.log(`Suggested Codex instruction: Route the unacknowledged messages above to the active ${role} agent; if absent, explicitly spawn the ${role} custom agent, register its thread, and have it read the listed files.`);
    }
  }
}

function cmdRegisterThread(a) {
  const role = arg(a, 'role'); const threadId = arg(a, 'thread'); const label = arg(a, 'label', false) ?? null;
  const known = roles(); if (known.length && !known.includes(role)) fail(`Unknown role: ${role}`);
  const registry = threadRegistry();
  registry.threads[role] = { threadId, label, registeredAt: now() };
  registry.updatedAt = now(); atomicWrite(threadsPath, registry);
  console.log(`Registered ${role} -> ${threadId}.`);
}
function cmdUnregisterThread(a) {
  const role = arg(a, 'role'); const registry = threadRegistry();
  delete registry.threads[role]; registry.updatedAt = now(); atomicWrite(threadsPath, registry);
  console.log(`Unregistered thread for ${role}.`);
}
function cmdThreads() {
  const entries = Object.entries(threadRegistry().threads ?? {}).sort(([a], [b]) => a.localeCompare(b));
  if (!entries.length) return console.log('No role threads registered.');
  for (const [role, data] of entries) console.log(`${role}\t${data.threadId}\t${data.label ?? ''}\t${data.registeredAt ?? ''}`);
}

function cmdCreate(a) {
  const id = arg(a, 'id'); const title = arg(a, 'title'); const summary = arg(a, 'summary'); const ownerRole = arg(a, 'owner');
  const reviewerRole = arg(a, 'reviewer', false) ?? 'reviewer';
  const known = roles();
  if (known.length && !known.includes(ownerRole)) fail(`Unknown owner role: ${ownerRole}`);
  if (known.length && !known.includes(reviewerRole)) fail(`Unknown reviewer role: ${reviewerRole}`);
  if (fs.existsSync(taskPath(id))) fail(`Task already exists: ${id}`);
  const dependsOn = (arg(a, 'depends', false) ?? '').split(',').filter(Boolean);
  const docList = (arg(a, 'docs', false) ?? 'AGENTS.md').split(',').filter(Boolean);
  const acceptance = (arg(a, 'acceptance', false) ?? 'Acceptance criteria must be refined before ready').split('|');
  const requiredChecks = (arg(a, 'checks', false) ?? 'pnpm typecheck').split('|');
  const task = { id, title, summary, state: dependsOn.length ? 'proposed' : 'ready', ownerRole, reviewerRole, dependsOn, docs: docList, acceptance, requiredChecks, branch: `task/${id}-${slug(title)}`, createdAt: now(), updatedAt: now(), history: [{ at: now(), actor: 'taskctl', action: 'create', details: '' }] };
  atomicWrite(taskPath(id), task); console.log(`Created ${id} in state ${task.state}.`);
}
function slug(value) { return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'task'; }

function printHelp() {
  console.log(`Wuming Town task control\n\nCommands:\n  init | validate | status | route | threads\n  next --role ROLE\n  register-thread --role ROLE --thread THREAD_ID [--label LABEL]\n  unregister-thread --role ROLE\n  create --id ID --title TITLE --summary TEXT --owner ROLE [--reviewer ROLE] [--depends A,B]\n  claim --id ID --agent ROLE [--thread LABEL]\n  complete --id ID --agent ROLE --summary TEXT\n  review --id ID --agent ROLE --verdict verified|changes_requested --summary TEXT\n  integrate --id ID --agent ROLE --summary TEXT\n  done --id ID --agent ROLE\n  block --id ID --agent ROLE --to ROLE --reason TEXT\n  unblock --id ID --agent ROLE --summary TEXT\n  send --from ROLE --to ROLE --subject TEXT --body TEXT [--task ID] [--kind KIND] [--artifact PATHS]\n  inbox --role ROLE [--all] [--json]\n  ack --role ROLE --message MSG-ID`);
}
function fail(message) { console.error(`taskctl: ${message}`); process.exit(1); }
