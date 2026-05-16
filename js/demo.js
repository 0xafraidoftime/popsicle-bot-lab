// popsicle-bot-lab · demo.js
// Real pipeline: Chess.com public API → heuristic feature extraction → trait vector → archetype + Stockfish spec

const ARCHETYPES = [
  {
    name: "Tactical Tornado",
    desc: "Relentlessly aggressive. Sacrifices material for initiative. Opens with e4 and never looks back. If it bleeds, it leads.",
    centroid: { aggression: 0.9, tactical_vision: 0.85, positional_play: 0.25, time_mgmt: 0.5, opening_diversity: 0.4, endgame_strength: 0.35, risk_tolerance: 0.9, blunder_resistance: 0.45 }
  },
  {
    name: "Patient Strategist",
    desc: "Outpost sculptor. Pawn structure devotee. Will happily manoeuvre for 40 moves to reach a slightly better endgame.",
    centroid: { aggression: 0.2, tactical_vision: 0.5, positional_play: 0.9, time_mgmt: 0.75, opening_diversity: 0.35, endgame_strength: 0.85, risk_tolerance: 0.2, blunder_resistance: 0.85 }
  },
  {
    name: "Endgame Surgeon",
    desc: "Trades into endings with frightening precision. Knows every Lucena and Philidor position. King and pawn endgames are not the boring part — they're the whole point.",
    centroid: { aggression: 0.3, tactical_vision: 0.6, positional_play: 0.7, time_mgmt: 0.8, opening_diversity: 0.3, endgame_strength: 0.95, risk_tolerance: 0.3, blunder_resistance: 0.88 }
  },
  {
    name: "Opening Theorist",
    desc: "Memorised 25 moves of the Najdorf. Slightly lost after move 26. The prep is the point.",
    centroid: { aggression: 0.5, tactical_vision: 0.55, positional_play: 0.6, time_mgmt: 0.65, opening_diversity: 0.95, endgame_strength: 0.45, risk_tolerance: 0.45, blunder_resistance: 0.7 }
  },
  {
    name: "Blitz Berserker",
    desc: "Pre-moves on move 3. Flagged three opponents this week. The clock is a weapon.",
    centroid: { aggression: 0.75, tactical_vision: 0.5, positional_play: 0.3, time_mgmt: 0.2, opening_diversity: 0.5, endgame_strength: 0.3, risk_tolerance: 0.8, blunder_resistance: 0.3 }
  },
  {
    name: "Solid Defender",
    desc: "Never loses a won position. Actually never loses. The Berlin Wall is a personality, not just an opening.",
    centroid: { aggression: 0.15, tactical_vision: 0.55, positional_play: 0.75, time_mgmt: 0.85, opening_diversity: 0.2, endgame_strength: 0.8, risk_tolerance: 0.1, blunder_resistance: 0.95 }
  },
  {
    name: "Chaotic Gambiteer",
    desc: "King's Gambit on move 2. Declined? Surprised. Complains the opponent 'played it safe'. Sacrifices are not calculated — they are felt.",
    centroid: { aggression: 0.85, tactical_vision: 0.7, positional_play: 0.2, time_mgmt: 0.4, opening_diversity: 0.7, endgame_strength: 0.25, risk_tolerance: 0.95, blunder_resistance: 0.35 }
  },
  {
    name: "Balanced Pragmatist",
    desc: "Does everything competently. Wins slightly better endgames. Terrifying in aggregate.",
    centroid: { aggression: 0.5, tactical_vision: 0.55, positional_play: 0.55, time_mgmt: 0.6, opening_diversity: 0.55, endgame_strength: 0.6, risk_tolerance: 0.5, blunder_resistance: 0.65 }
  }
];

const TRAIT_KEYS = ["aggression","tactical_vision","positional_play","time_mgmt","opening_diversity","endgame_strength","risk_tolerance","blunder_resistance"];
const TRAIT_LABELS = {
  aggression: "Aggression",
  tactical_vision: "Tactical Vision",
  positional_play: "Positional Play",
  time_mgmt: "Time Mgmt",
  opening_diversity: "Opening Diversity",
  endgame_strength: "Endgame Strength",
  risk_tolerance: "Risk Tolerance",
  blunder_resistance: "Blunder Resistance"
};

function switchTab(t) {
  document.querySelectorAll('.tab').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
  document.getElementById('tab-' + t).classList.add('active');
  document.getElementById('input-' + t).classList.add('active');
}

// ── Fetch games from Chess.com public API ──
async function fetchGames(username, maxGames) {
  // Get recent monthly archives
  const archivesUrl = `https://api.chess.com/pub/player/${username.toLowerCase()}/games/archives`;
  const archivesResp = await fetch(archivesUrl);
  if (!archivesResp.ok) throw new Error(`Player "${username}" not found on Chess.com`);
  const { archives } = await archivesResp.json();
  if (!archives || archives.length === 0) throw new Error('No game archives found');

  // Fetch from most recent months until we have enough
  let games = [];
  for (let i = archives.length - 1; i >= 0 && games.length < maxGames; i--) {
    const resp = await fetch(archives[i]);
    if (!resp.ok) continue;
    const data = await resp.json();
    games = games.concat(data.games || []);
    if (games.length >= maxGames * 2) break; // buffer
  }

  return games.slice(0, maxGames);
}

// ── Heuristic feature extraction from a game ──
function extractFeatures(game, username) {
  const pgn = game.pgn || '';
  const lower = username.toLowerCase();

  // Determine player color
  const isWhite = (game.white?.username || '').toLowerCase() === lower;
  const playerResult = isWhite ? game.white?.result : game.black?.result;

  // Capture count heuristic (count 'x' in moves)
  const captureMatches = pgn.match(/x/g) || [];
  const captureCount = captureMatches.length;

  // Check count
  const checkMatches = pgn.match(/\+/g) || [];
  const checkCount = checkMatches.length;

  // Sacrifice heuristic: N/B sac pattern (Nxf7, Bxf7 in early moves)
  const sacrificePattern = /[NB]x[a-h][1-8]/g;
  const sacrifices = (pgn.match(sacrificePattern) || []).length;

  // Early queen moves (Qd1-? in first 6 moves rough)
  const earlyQueen = /[1-6]\. Q/.test(pgn) ? 1 : 0;

  // Castling (O-O)
  const castled = pgn.includes('O-O');
  const castleMove = pgn.match(/(\d+)\. O-O/);
  const castleMoveNum = castleMove ? parseInt(castleMove[1]) : 40;

  // Time controls — blitz = < 5 min
  const timeClass = game.time_class;
  const isBlitz = timeClass === 'blitz' || timeClass === 'bullet';

  // Result
  const won = playerResult === 'win';
  const lost = playerResult === 'checkmated' || playerResult === 'resigned' || playerResult === 'timeout';
  const drew = playerResult === 'agreed' || playerResult === 'stalemate' || playerResult === 'insufficient';

  // Move count
  const moveMatches = pgn.match(/\d+\./g) || [];
  const moveCount = moveMatches.length;
  const isEndgame = moveCount > 35;

  return { captureCount, checkCount, sacrifices, earlyQueen, castled, castleMoveNum, isBlitz, won, lost, drew, isEndgame, moveCount };
}

// ── Aggregate features → 8-dim trait vector ──
function computeTraitVector(featuresList) {
  const n = featuresList.length;
  if (n === 0) return Object.fromEntries(TRAIT_KEYS.map(k => [k, 0.5]));

  const avg = k => featuresList.reduce((s, f) => s + (f[k] || 0), 0) / n;

  const avgCaptures    = avg('captureCount');
  const avgChecks      = avg('checkCount');
  const avgSacrifices  = avg('sacrifices');
  const avgEarlyQueen  = avg('earlyQueen');
  const avgCastleMove  = avg('castleMoveNum');
  const blitzRatio     = avg('isBlitz');
  const winRate        = avg('won');
  const lossRate       = avg('lost');
  const drawRate       = avg('drew');
  const endgameRate    = avg('isEndgame');
  const avgMoveCount   = avg('moveCount');

  // Normalise helpers
  const clamp = (v, lo=0, hi=1) => Math.max(lo, Math.min(hi, v));
  const norm = (v, lo, hi) => clamp((v - lo) / (hi - lo));

  return {
    aggression:         clamp(norm(avgCaptures, 3, 20) * 0.6 + norm(avgChecks, 1, 12) * 0.3 + avgEarlyQueen * 0.1),
    tactical_vision:    clamp(norm(avgChecks, 1, 12) * 0.5 + norm(avgSacrifices, 0, 3) * 0.35 + winRate * 0.15),
    positional_play:    clamp((1 - norm(avgCaptures, 3, 20)) * 0.5 + norm(avgCastleMove < 15 ? 15 - avgCastleMove : 0, 0, 14) * 0.3 + endgameRate * 0.2),
    time_mgmt:          clamp((1 - blitzRatio) * 0.5 + norm(40 - avgCastleMove, 0, 38) * 0.3 + drawRate * 0.2),
    opening_diversity:  clamp(0.5 + (Math.random() * 0.3 - 0.15)), // requires ECO parsing — placeholder with spread
    endgame_strength:   clamp(endgameRate * 0.6 + winRate * 0.3 + (1 - lossRate) * 0.1),
    risk_tolerance:     clamp(norm(avgSacrifices, 0, 4) * 0.5 + norm(avgCaptures, 3, 20) * 0.3 + avgEarlyQueen * 0.2),
    blunder_resistance: clamp((1 - lossRate) * 0.5 + drawRate * 0.2 + winRate * 0.3),
  };
}

// ── Nearest centroid → archetype ──
function matchArchetype(traits) {
  let best = null, bestDist = Infinity;
  for (const arch of ARCHETYPES) {
    let d = 0;
    for (const k of TRAIT_KEYS) d += (traits[k] - arch.centroid[k]) ** 2;
    d = Math.sqrt(d);
    if (d < bestDist) { bestDist = d; best = arch; }
  }
  // confidence: invert distance, normalise roughly
  const confidence = Math.round(Math.max(40, Math.min(97, (1 - bestDist / 2.83) * 100)));
  return { archetype: best, confidence };
}

// ── Trait vector → Stockfish bot spec ──
function generateBotSpec(traits, archetype) {
  const { aggression, tactical_vision, positional_play, time_mgmt, blunder_resistance, risk_tolerance, endgame_strength } = traits;

  const skill_level = Math.round(5 + blunder_resistance * 14);           // 5–19
  const search_depth = Math.round(8 + positional_play * 10);             // 8–18
  const contempt = Math.round((aggression - 0.5) * 80);                   // -40 to +40
  const move_time_ms = Math.round(200 + (1 - aggression) * 800);         // 200–1000ms
  const blunder_prob = parseFloat(Math.max(0, (1 - blunder_resistance - 0.1) * 0.15).toFixed(3));

  const bias = {
    captures:       parseFloat((aggression * 0.4).toFixed(2)),
    checks:         parseFloat((tactical_vision * 0.35).toFixed(2)),
    sacrifices:     parseFloat((risk_tolerance * 0.25).toFixed(2)),
    quiet:          parseFloat((positional_play * 0.5).toFixed(2)),
    simplification: parseFloat((endgame_strength * 0.4).toFixed(2)),
    theory:         parseFloat((time_mgmt * 0.3).toFixed(2)),
  };

  return { skill_level, search_depth, contempt, move_time_ms, blunder_injection_prob: blunder_prob, move_bias: bias, archetype: archetype.name };
}

// ── Parse PGN text → fake game objects ──
function parsePGNGames(pgnText) {
  // Split on game boundaries
  const raw = pgnText.split(/\n\n(?=\[)/);
  return raw.filter(g => g.trim().length > 20).map(pgn => ({
    pgn,
    time_class: 'rapid',
    white: { username: 'user', result: pgn.includes('1-0') ? 'win' : 'resigned' },
    black: { username: 'opponent', result: pgn.includes('0-1') ? 'win' : 'resigned' },
  }));
}

// ── Render output ──
function renderOutput(traits, archetypeResult, spec, username) {
  const { archetype, confidence } = archetypeResult;

  // Archetype
  document.getElementById('archetype-name').textContent = archetype.name;
  document.getElementById('archetype-desc').textContent = archetype.desc;
  document.getElementById('archetype-conf').textContent = confidence + '%';

  // Trait bars
  const barsEl = document.getElementById('trait-bars');
  barsEl.innerHTML = '';
  for (const key of TRAIT_KEYS) {
    const val = traits[key];
    const pct = Math.round(val * 100);
    barsEl.innerHTML += `
      <div class="trait-row">
        <div class="trait-name">${TRAIT_LABELS[key]}</div>
        <div class="trait-bar-bg"><div class="trait-bar-fill" style="width:0%" data-target="${pct}%"></div></div>
        <div class="trait-val">${pct}</div>
      </div>`;
  }
  // Animate bars after paint
  requestAnimationFrame(() => {
    document.querySelectorAll('.trait-bar-fill').forEach(el => {
      el.style.width = el.dataset.target;
    });
  });

  // Bot spec
  const specEl = document.getElementById('spec-grid');
  const specItems = [
    ['skill_level', spec.skill_level],
    ['search_depth', spec.search_depth],
    ['contempt', spec.contempt],
    ['move_time_ms', spec.move_time_ms],
    ['blunder_prob', spec.blunder_injection_prob],
    ['bias_captures', spec.move_bias.captures],
    ['bias_checks', spec.move_bias.checks],
    ['bias_quiet', spec.move_bias.quiet],
  ];
  specEl.innerHTML = specItems.map(([k,v]) => `
    <div class="spec-item">
      <div class="spec-key">${k}</div>
      <div class="spec-val">${v}</div>
    </div>`).join('');

  // JSON
  const json = {
    username,
    archetype: archetype.name,
    confidence_pct: confidence,
    trait_vector: Object.fromEntries(TRAIT_KEYS.map(k => [k, parseFloat(traits[k].toFixed(3))])),
    stockfish_spec: spec,
  };
  document.getElementById('json-out').textContent = JSON.stringify(json, null, 2);

  document.getElementById('loading').style.display = 'none';
  document.getElementById('output-area').style.display = 'block';
}

// ── Main entry ──
async function runDemo() {
  const btn = document.getElementById('gen-btn');
  const activeTab = document.querySelector('.tab.active').id;
  const isPGN = activeTab === 'tab-pgn';

  document.getElementById('output-area').style.display = 'none';
  document.getElementById('loading').style.display = 'block';
  btn.disabled = true;

  let username = document.getElementById('username-input').value.trim() || 'popsicle_guy';
  const maxGames = parseInt(document.getElementById('games-slider').value) || 20;

  try {
    let games;
    if (isPGN) {
      const pgnText = document.getElementById('pgn-input').value.trim();
      if (!pgnText) throw new Error('Please paste some PGN data first.');
      games = parsePGNGames(pgnText);
      username = 'pgn_import';
      if (games.length === 0) throw new Error('Could not parse any games from the PGN.');
    } else {
      games = await fetchGames(username, maxGames);
    }

    if (games.length === 0) throw new Error('No games found for this user.');

    const features = games.map(g => extractFeatures(g, username));
    const traits = computeTraitVector(features);
    const archetypeResult = matchArchetype(traits);
    const spec = generateBotSpec(traits, archetypeResult.archetype);

    renderOutput(traits, archetypeResult, spec, username);

  } catch (err) {
    document.getElementById('loading').style.display = 'none';
    document.getElementById('output-area').style.display = 'block';
    document.getElementById('archetype-name').textContent = 'Error';
    document.getElementById('archetype-desc').textContent = err.message;
    document.getElementById('archetype-conf').textContent = '—';
    document.getElementById('trait-bars').innerHTML = '';
    document.getElementById('spec-grid').innerHTML = '';
    document.getElementById('json-out').textContent = `{ "error": "${err.message}" }`;
  } finally {
    btn.disabled = false;
  }
}
