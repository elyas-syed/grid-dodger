import { showcase } from "./showcase-config.mjs";

const stages = [
  { kicker: '01 / GROUNDED CONTEXT', title: 'Read the board.', description: 'The engine describes the board and calculates each move’s immediate outcome. Decider receives explicit facts, not an image to guess from.' },
  { kicker: '02 / CLOSED-OPTION DECISION', title: 'Three options. One choice.', description: 'Strands Decider 2B evaluates left, stay, and right. In this illustration, it chooses right. A probability describes its relative preference—not a survival guarantee.' },
  { kicker: '03 / REGISTERED TOOL', title: 'Turn the choice into a move.', description: 'The application applies its configured fallback policy, then dispatches one registered movement tool. The game engine advances the board and checks the result.' },
  { kicker: '04 / BEDROCK RECAP', title: 'Give the run a story.', description: 'When a run ends, Amazon Bedrock receives the score, outcome, and recent moves. It generates a short recap grounded in what actually happened.' }
];
const buttons = [...document.querySelectorAll('.stage-button')];
const board = document.querySelector('.board-panel');
const toggle = document.querySelector('.animation-toggle');
const motion = matchMedia('(prefers-reduced-motion: reduce)');
let current = 0;
let paused = motion.matches;
let timer;
function show(index) {
  current = index;
  const stage = stages[index];
  buttons.forEach((button, i) => { button.classList.toggle('active', i === index); button.setAttribute('aria-pressed', String(i === index)); });
  board.dataset.step = String(index);
  document.querySelector('.stage-kicker').textContent = stage.kicker;
  document.querySelector('.stage-title').textContent = stage.title;
  document.querySelector('.stage-description').textContent = stage.description;
}
function sync() {
  clearInterval(timer);
  toggle.setAttribute('aria-pressed', String(paused));
  toggle.innerHTML = paused ? 'Play animation <span aria-hidden="true">▷</span>' : 'Pause animation <span aria-hidden="true">Ⅱ</span>';
  if (!paused && !document.hidden) timer = setInterval(() => show((current + 1) % stages.length), 3500);
}
buttons.forEach((button, index) => button.addEventListener('click', () => { paused = true; show(index); sync(); }));
toggle.addEventListener('click', () => { paused = !paused; sync(); });
motion.addEventListener('change', () => { paused = motion.matches; sync(); });
document.addEventListener('visibilitychange', sync);
show(0);
sync();

// This showcase serves recorded media only; it never starts the game or inference.
const demo = document.getElementById('demo');
document.querySelectorAll('a[href="#demo"]').forEach(link => {
  link.addEventListener('click', event => {
    event.preventDefault();
    demo.scrollIntoView({ block: 'start', behavior: motion.matches ? 'auto' : 'smooth' });
    history.replaceState(null, '', '#demo');
    document.getElementById('demo-title').focus({ preventScroll: true });
  });
});

const video = document.getElementById('demo-video');
const poster = document.getElementById('demo-poster');
const status = document.getElementById('demo-status');
if (showcase.videoSrc) {
  video.src = showcase.videoSrc;
  video.preload = 'metadata';
  video.hidden = false;
  poster.hidden = true;
  document.getElementById('demo-commentary').hidden = false;
  status.textContent = 'RECORDED GAMEPLAY';
  document.getElementById('demo-caption-text').textContent = 'Recorded real Decider gameplay. Playback does not call a live model.';
  video.addEventListener('error', () => {
    document.getElementById('demo-commentary').hidden = true;
    video.hidden = true;
    poster.hidden = false;
    status.textContent = 'RECORDING UNAVAILABLE';
    document.getElementById('demo-caption-text').textContent = 'The recording could not load. The image above is a still from an earlier real run.';
  });
}

// One destination to update when a separate release repository is ready.
for (const link of document.querySelectorAll('[data-repository-path]')) {
  const file = link.dataset.repositoryPath;
  const root = showcase.repositoryUrl.replace(/\/$/, '');
  link.href = file ? `${root}/blob/${encodeURIComponent(showcase.repositoryRef)}/${file}` : root;
}

// Keep summaries aligned when playing, seeking, or replaying the recording.
{
const summaries=[
{at:0,phase:'MEET THE MODEL',title:'A small model. Every move matters.',body:'Strands Decider 2B is a small, open-source decision model from AWS.'},
{at:10.88,phase:'HUMAN MODE',title:'You fly.',body:'Move left, stay, or right. Dodge falling hazards and aim for 500 points.'},
{at:20.16,phase:'DECIDER MODE',title:'Decider takes the controls.',body:'The model receives the board state and possible move outcomes, then selects a movement tool.'},
{at:29.04,phase:'FOLLOW THE DECISION',title:'See the choice. Follow the move.',body:'The panel shows the selected move, relative preferences, and request time. The game executes the action.'},
{at:38,phase:'SHADOW MODE',title:'Your controls. An AI copilot.',body:'Decider suggests the next move. You can follow its advice or choose another direction.'},
{at:46,phase:'BEDROCK RECAP',title:'Bedrock tells the story.',body:'Amazon Bedrock writes a short recap from the score and recent moves.'},
{at:52,phase:'REUSABLE PATTERN',title:'Three options. One decision.',body:'Give the model context, a question, and fixed options. Your application acts on its choice.'},
{at:58,phase:'YOUR NEXT MOVE',title:'Try it yourself.',body:'Run the game locally or deploy it in your AWS account. Source: github.com/elyas-syed/grid-dodger'}
];
let active=-1;
function syncSummary(){let next=0;for(let i=1;i<summaries.length;i++){if(video.currentTime>=summaries[i].at)next=i;}if(next===active)return;active=next;const s=summaries[next];document.getElementById('commentary-phase').textContent=s.phase;document.getElementById('commentary-title').textContent=s.title;document.getElementById('commentary-body').textContent=s.body;}
for(const event of ['timeupdate','seeked','loadedmetadata','ended'])video.addEventListener(event,syncSummary);
syncSummary();
}
