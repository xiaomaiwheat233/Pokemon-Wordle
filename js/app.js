/* ============================================================
 * 宝可梦弗一把 —— 游戏逻辑
 * 数据：js/pokedex-data.js（window.POKEDEX_DATA，由 tools/build_data.py 生成）
 * ============================================================ */
(function () {
  'use strict';

  // ---------- 常量 ----------
  const DATA = window.POKEDEX_DATA.pokemon;
  const MAX_GUESSES = 8;
  const STAT_CLOSE = 10;      // 单维种族值「接近」阈值
  const TOTAL_CLOSE = 15;     // 种族值合计「接近」阈值
  const STAT_COLS = [
    ['hp', 'HP'], ['atk', '攻击'], ['def', '防御'],
    ['spa', '特攻'], ['spd', '特防'], ['spe', '速度'],
  ];
  const GEN_NAMES = {
    1: '第一世代', 2: '第二世代', 3: '第三世代', 4: '第四世代', 5: '第五世代',
    6: '第六世代', 7: '第七世代', 8: '第八世代', 9: '第九世代',
  };
  const TYPE_COLORS = {
    '一般': '#A8A878', '火': '#F08030', '水': '#6890F0', '电': '#F8D030',
    '草': '#78C850', '冰': '#98D8D8', '格斗': '#C03028', '毒': '#A040A0',
    '地面': '#E0C068', '飞行': '#A890F0', '超能力': '#F85888', '虫': '#A8B820',
    '岩石': '#B8A038', '幽灵': '#705898', '龙': '#7038F8', '恶': '#705848',
    '钢': '#B8B8D0', '妖精': '#EE99AC',
  };

  // 难度模式：简单 = 全功能；普通 = 无剪影；困难 = 无剪影且无提示
  const MODE_ORDER = ['easy', 'normal', 'hard'];
  const MODES = {
    easy: {
      name: '简单', silhouette: true, hints: true,
      desc: '保留全部功能：最后一次竞猜给出剪影图，可使用「💡 提示」',
    },
    normal: {
      name: '普通', silhouette: false, hints: true,
      desc: '不提供剪影图，仍可使用一次「💡 提示」',
    },
    hard: {
      name: '困难', silhouette: false, hints: false,
      desc: '不提供剪影图，且无法使用「💡 提示」，只能靠反馈推理',
    },
  };

  // 可比较的 12 个词条：定义在一处，供反馈表判定、吻合度统计、词条提示共用
  function sameTypes(p, t) {
    return p.types.length === t.types.length &&
      p.types.every(function (x) { return t.types.indexOf(x) !== -1; });
  }
  function sharesAbility(p, t) {
    var tAb = t.abilities.concat(t.hiddenAbilities);
    return p.abilities.concat(p.hiddenAbilities).some(function (a) { return tAb.indexOf(a) !== -1; });
  }
  const FIELDS = [
    { key: 'hp', label: 'HP', answer: function (t) { return t.hp; }, correct: function (p, t) { return p.hp === t.hp; } },
    { key: 'atk', label: '攻击', answer: function (t) { return t.atk; }, correct: function (p, t) { return p.atk === t.atk; } },
    { key: 'def', label: '防御', answer: function (t) { return t.def; }, correct: function (p, t) { return p.def === t.def; } },
    { key: 'spa', label: '特攻', answer: function (t) { return t.spa; }, correct: function (p, t) { return p.spa === t.spa; } },
    { key: 'spd', label: '特防', answer: function (t) { return t.spd; }, correct: function (p, t) { return p.spd === t.spd; } },
    { key: 'spe', label: '速度', answer: function (t) { return t.spe; }, correct: function (p, t) { return p.spe === t.spe; } },
    { key: 'total', label: '种族值合计', answer: function (t) { return t.total; }, correct: function (p, t) { return p.total === t.total; } },
    { key: 'types', label: '属性', answer: function (t) { return t.types.join('/'); }, correct: sameTypes },
    { key: 'gen', label: '世代', answer: function (t) { return GEN_NAMES[t.gen]; }, correct: function (p, t) { return p.gen === t.gen; } },
    { key: 'ability', label: '特性', answer: function (t) { return t.abilities.concat(t.hiddenAbilities).join('、'); }, correct: sharesAbility },
    { key: 'stage', label: '进化段数', answer: function (t) { return t.stage + ' 段'; }, correct: function (p, t) { return p.stage === t.stage; } },
    { key: 'mega', label: 'Mega', answer: function (t) { return t.canMega ? '可Mega' : '不可'; }, correct: function (p, t) { return p.canMega === t.canMega; } },
  ];
  const REVEAL_COUNT = 3; // 「揭示词条」一次给出的词条数

  // ---------- 状态 ----------
  const state = {
    target: null,     // 本轮答案
    guesses: [],      // 已猜的宝可梦
    over: false,      // 本轮是否结束
    genSel: 0,        // 0 = 全部世代
    diffSel: 'easy',  // 设置面板中选中的难度
    mode: 'easy',     // 本局生效的难度（开始竞猜时锁定）
    imgOk: true,      // 目标图片是否加载成功
    hintUsed: false,  // 本局是否已用过提示（每局限一次）
  };

  // 名称索引（中文 + 英文小写）
  const byName = new Map();
  DATA.forEach(function (p) {
    byName.set(p.name, p);
    var en = (p.nameEn || '').toLowerCase();
    if (en && !byName.has(en)) byName.set(en, p);
  });

  // ---------- DOM ----------
  var $ = function (id) { return document.getElementById(id); };
  var genButtonsEl = $('gen-buttons');
  var diffButtonsEl = $('diff-buttons');
  var diffNote = $('diff-note');
  var modeTag = $('mode-tag');
  var btnStart = $('btn-start');
  var setupCard = $('setup-card');
  var gameControls = $('game-controls');
  var hintWrap = $('hint-wrap');
  var btnHint = $('btn-hint');
  var hintMenu = $('hint-menu');
  var btnGiveup = $('btn-giveup');
  var hintLength = $('hint-length');
  var hintFields = $('hint-fields');
  var hintFill = $('hint-fill');
  var hintInfo = $('hint-info');
  var attemptLeftEl = $('attempt-left');
  var targetImg = $('target-img');
  var targetOverlay = $('target-overlay');
  var targetStatus = $('target-status');
  var input = $('guess-input');
  var suggestList = $('suggest-list');
  var toastEl = $('toast');
  var banner = $('result-banner');
  var tbody = $('guess-tbody');
  var tableEl = $('guess-table');
  var emptyHint = $('empty-hint');
  var activeIndex = -1; // 联想列表当前高亮项

  // ---------- 工具 ----------
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function pad4(n) { return String(n).padStart(4, '0'); }

  var toastTimer = null;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('show'); }, 2200);
  }

  // ---------- 世代选择 ----------
  var GEN_CHOICES = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
  function renderGenButtons() {
    GEN_CHOICES.forEach(function (g) {
      var btn = document.createElement('button');
      btn.className = 'gen-btn' + (g === state.genSel ? ' selected' : '');
      btn.textContent = g === 0 ? '全部' : GEN_NAMES[g];
      btn.title = g === 0 ? '全部 1025 只宝可梦' : GEN_NAMES[g] + '（点击「开始竞猜」后生效）';
      btn.addEventListener('click', function () {
        state.genSel = g;
        genButtonsEl.querySelectorAll('.gen-btn').forEach(function (b) { b.classList.remove('selected'); });
        btn.classList.add('selected');
      });
      genButtonsEl.appendChild(btn);
    });
  }

  function poolFor(sel) {
    return sel === 0 ? DATA : DATA.filter(function (p) { return p.gen === sel; });
  }

  // ---------- 难度选择 ----------
  function renderDiffButtons() {
    MODE_ORDER.forEach(function (key) {
      var m = MODES[key];
      var btn = document.createElement('button');
      btn.className = 'gen-btn' + (key === state.diffSel ? ' selected' : '');
      btn.textContent = m.name;
      btn.title = m.desc;
      btn.addEventListener('click', function () {
        state.diffSel = key;
        diffButtonsEl.querySelectorAll('.gen-btn').forEach(function (b) { b.classList.remove('selected'); });
        btn.classList.add('selected');
        diffNote.textContent = m.name + '模式：' + m.desc;
      });
      diffButtonsEl.appendChild(btn);
    });
    diffNote.textContent = MODES[state.diffSel].name + '模式：' + MODES[state.diffSel].desc;
  }

  // ---------- 开始竞猜 ----------
  function startGame() {
    var pool = poolFor(state.genSel);
    state.target = pool[Math.floor(Math.random() * pool.length)];
    state.guesses = [];
    state.over = false;
    state.imgOk = true;
    state.hintUsed = false;
    state.mode = state.diffSel; // 本局难度锁定

    // 困难模式：整局隐藏提示按钮
    if (MODES[state.mode].hints) {
      hintWrap.classList.remove('hidden');
      btnHint.disabled = false;
    } else {
      hintWrap.classList.add('hidden');
      btnHint.disabled = true;
    }

    // 隐藏设置面板，显示游戏中控制栏
    setupCard.classList.add('hidden');
    gameControls.classList.remove('hidden');
    hintMenu.classList.remove('open');
    hintInfo.innerHTML = '';
    modeTag.textContent = MODES[state.mode].name + '模式';
    modeTag.dataset.mode = state.mode;

    // 重置反馈表
    tbody.innerHTML = '';
    updateTableVisibility();
    updateAttempts();

    // 重置结果横幅
    banner.className = 'card result-banner hidden';
    banner.innerHTML = '';

    // 目标：开局不给剪影，最后一次竞猜时才给出
    targetStatus.classList.remove('answer-name');
    updateSilhouette();

    // 输入框
    input.disabled = false;
    input.value = '';
    hideSuggest();
    input.focus();
  }

  // ---------- 目标图片：开局隐藏，最后一次竞猜给出剪影 ----------
  function setTargetVisual(mode) {
    var t = state.target;
    var hasImg = !!(t && t.img && state.imgOk);
    if (!hasImg || mode === 'none') {
      // 无图或尚未到给出剪影的时机：只显示「？」
      targetImg.classList.add('hidden');
      targetImg.classList.remove('silhouette', 'reveal');
      targetOverlay.classList.remove('hidden');
      return;
    }
    targetImg.classList.remove('hidden');
    targetImg.src = t.img;
    targetImg.classList.toggle('silhouette', mode === 'silhouette');
    targetImg.classList.toggle('reveal', mode === 'reveal');
    targetOverlay.classList.add('hidden');
  }

  function updateSilhouette() {
    if (state.over || !state.target) return;
    // 普通/困难模式：不提供剪影
    if (!MODES[state.mode].silhouette) {
      setTargetVisual('none');
      targetStatus.textContent = MODES[state.mode].name + '模式：本局不提供剪影图';
      return;
    }
    var remaining = MAX_GUESSES - state.guesses.length;
    if (remaining <= 1) {
      setTargetVisual('silhouette');
      targetStatus.textContent = '剪影图已给出 · 这是最后一次竞猜！';
    } else {
      setTargetVisual('none');
      targetStatus.textContent = '第 ' + MAX_GUESSES + ' 次竞猜时给出剪影图 · 还剩 ' + remaining + ' 次';
    }
  }

  targetImg.addEventListener('error', function () {
    state.imgOk = false;
    targetImg.classList.add('hidden');
    targetOverlay.classList.remove('hidden');
    if (!state.over) updateSilhouette();
  });

  function updateAttempts() {
    attemptLeftEl.textContent = MAX_GUESSES - state.guesses.length;
  }

  function updateTableVisibility() {
    if (state.guesses.length > 0) {
      tableEl.classList.remove('hidden');
      emptyHint.classList.add('hidden');
    } else {
      tableEl.classList.add('hidden');
      emptyHint.classList.remove('hidden');
    }
  }

  // ---------- 联想输入 ----------
  function normalizeSearch(value) {
    return String(value || '').trim().toLocaleLowerCase('zh-CN');
  }

  function hideSuggest() {
    suggestList.classList.remove('open');
    activeIndex = -1;
  }

  function showSuggest(query) {
    var q = normalizeSearch(query);
    if (!q || input.disabled || state.over) { hideSuggest(); return; }

    var cands = poolFor(state.genSel).filter(function (p) {
      var name = normalizeSearch(p.name);
      var nameEn = normalizeSearch(p.nameEn);
      return p.name.indexOf(q) !== -1 ||
        name.indexOf(q) !== -1 ||
        nameEn.indexOf(q) !== -1;
    });
    cands.sort(function (a, b) {
      var as = normalizeSearch(a.name).indexOf(q) === 0 || normalizeSearch(a.nameEn).indexOf(q) === 0 ? 1 : 0;
      var bs = normalizeSearch(b.name).indexOf(q) === 0 || normalizeSearch(b.nameEn).indexOf(q) === 0 ? 1 : 0;
      return bs - as || a.id - b.id;
    });
    cands = cands.slice(0, 12);

    suggestList.innerHTML = '';
    if (cands.length === 0) {
      suggestList.innerHTML = '<div class="suggest-empty">没有找到匹配的宝可梦</div>';
    } else {
      cands.forEach(function (p, i) {
        var guessed = state.guesses.some(function (g) { return g.id === p.id; });
        var item = document.createElement('div');
        item.className = 'suggest-item' + (guessed ? ' guessed' : '');
        item.dataset.id = p.id;
        item.innerHTML =
          (p.img ? '<img src="' + p.img + '" alt="" loading="lazy">' : '') +
          '<div class="si-name">' + esc(p.name) +
          (p.nameEn ? ' <span style="color:#9ca3af;font-size:12px">' + esc(p.nameEn) + '</span>' : '') +
          '</div>' +
          '<div class="si-id">#' + pad4(p.id) + ' · ' + GEN_NAMES[p.gen] + (guessed ? ' · 已猜' : '') + '</div>';
        item.addEventListener('mousedown', function (e) {
          e.preventDefault();
          if (!guessed) pickPokemon(p);
        });
        item.addEventListener('mouseenter', function () { setActive(i); });
        suggestList.appendChild(item);
      });
    }
    activeIndex = -1;
    suggestList.classList.add('open');
  }

  function setActive(i) {
    var items = suggestList.querySelectorAll('.suggest-item');
    if (activeIndex >= 0 && items[activeIndex]) items[activeIndex].classList.remove('active');
    activeIndex = i;
    if (i >= 0 && items[i]) {
      items[i].classList.add('active');
      items[i].scrollIntoView({ block: 'nearest' });
    }
  }

  function activeEntry() {
    var items = suggestList.querySelectorAll('.suggest-item');
    if (activeIndex >= 0 && activeIndex < items.length) {
      var id = items[activeIndex].dataset.id;
      return byId(Number(id));
    }
    return null;
  }

  function byId(id) {
    // 数据按 id 升序排列，可直接索引：id 从 1 开始连续
    return DATA[id - 1];
  }

  input.addEventListener('input', function () { showSuggest(input.value); });
  // 中文输入法组合输入结束后，部分浏览器不会再次触发可用的 input 事件。
  input.addEventListener('compositionend', function () { showSuggest(input.value); });
  input.addEventListener('focus', function () {
    if (input.value.trim()) showSuggest(input.value);
  });
  input.addEventListener('keydown', function (e) {
    var items = suggestList.querySelectorAll('.suggest-item');
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive(Math.min(activeIndex + 1, items.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive(activeIndex - 1 < 0 ? items.length - 1 : activeIndex - 1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      var entry = activeEntry();
      if (!entry) {
        var exact = byName.get(input.value.trim()) || byName.get(input.value.trim().toLowerCase());
        if (exact) { entry = exact; }
      }
      if (entry) {
        pickPokemon(entry);
      } else if (state.target && !state.over) {
        toast('请从联想列表中选择，或输入完整的宝可梦名称');
      }
    } else if (e.key === 'Escape') {
      hideSuggest();
    }
  });
  document.addEventListener('mousedown', function (e) {
    if (!suggestList.contains(e.target) && e.target !== input) hideSuggest();
    if (!hintMenu.contains(e.target) && e.target !== btnHint) hintMenu.classList.remove('open');
  });

  // ---------- 猜测与判定 ----------
  function pickPokemon(entry) {
    // 对战模式由 duel.js 接管猜测流程，但复用同一个输入框与联想入口。
    if (window.POKEMON_DUEL && window.POKEMON_DUEL.active) {
      window.POKEMON_DUEL.submit(entry);
      return;
    }
    if (!state.target || state.over) return;
    if (state.guesses.some(function (g) { return g.id === entry.id; })) {
      toast('「' + entry.name + '」已经猜过了！');
      return;
    }
    state.guesses.push(entry);
    renderRow(entry);
    updateTableVisibility();
    updateAttempts();
    input.value = '';
    hideSuggest();

    if (entry.id === state.target.id) {
      endGame(true);
    } else if (state.guesses.length >= MAX_GUESSES) {
      endGame(false);
    } else {
      // 最后一次竞猜时给出剪影
      updateSilhouette();
      input.focus();
    }
  }

  // ---------- 反馈行渲染 ----------
  function makeCell(cls, html, title) {
    var td = document.createElement('td');
    td.className = 'cell ' + cls;
    td.innerHTML = html;
    if (title) td.title = title;
    return td;
  }

  function arrowOf(diff) {
    return diff === 0 ? '' : (diff > 0 ? '↓' : '↑');
  }

  function clsOf(diff, closeThr) {
    if (diff === 0) return 'cell-correct';
    if (Math.abs(diff) <= closeThr) return 'cell-close';
    return 'cell-far';
  }

  function statCell(gVal, tVal, closeThr, suffix, title) {
    var diff = gVal - tVal;
    var arrow = arrowOf(diff);
    var html = '<span class="cell-body"><span class="cell-value">' + gVal + (suffix || '') + '</span>' +
      (arrow ? '<span class="arrow">' + arrow + '</span>' : '') + '</span>';
    return makeCell(clsOf(diff, closeThr), html, title);
  }

  function renderRow(entry) {
    var t = state.target;
    var tr = document.createElement('tr');
    tr.className = 'new-row';

    // 宝可梦（固定列）
    var tdPoke = document.createElement('td');
    tdPoke.className = 'col-poke';
    tdPoke.innerHTML =
      '<div class="poke-cell">' +
      (entry.img ? '<img src="' + entry.img + '" alt="" loading="lazy">' : '<span class="p-id">无图</span>') +
      '<div><div class="p-name">' + esc(entry.name) + '</div>' +
      '<div class="p-id">#' + pad4(entry.id) + ' · ' + GEN_NAMES[entry.gen] + '</div></div>' +
      '</div>';
    tr.appendChild(tdPoke);

    // 六维种族值 + 合计
    STAT_COLS.forEach(function (col) {
      tr.appendChild(statCell(entry[col[0]], t[col[0]], STAT_CLOSE));
    });
    tr.appendChild(statCell(entry.total, t.total, TOTAL_CLOSE, '', '种族值合计'));

    // 属性（集合比较，双属性顺序无关）
    var tSet = new Set(t.types);
    var matched = entry.types.filter(function (x) { return tSet.has(x); }).length;
    var typeCls;
    if (entry.types.length === t.types.length && matched === entry.types.length) typeCls = 'cell-correct';
    else if (matched > 0) typeCls = 'cell-close';
    else typeCls = 'cell-far';
    var chips = entry.types.map(function (ty) {
      return '<span class="type-chip" style="background:' + (TYPE_COLORS[ty] || '#94a3b8') + '">' + esc(ty) + '</span>';
    }).join('');
    tr.appendChild(makeCell(typeCls, '<div class="type-chips">' + chips + '</div>'));

    // 世代
    var gDiff = entry.gen - t.gen;
    var gArrow = arrowOf(gDiff);
    tr.appendChild(makeCell(clsOf(gDiff, 1),
      '<span class="cell-body"><span class="cell-value">' + GEN_NAMES[entry.gen] + '</span>' +
      (gArrow ? '<span class="arrow">' + gArrow + '</span>' : '') + '</span>'));

    // 特性
    var tAb = new Set(t.abilities.concat(t.hiddenAbilities));
    var shared = entry.abilities.concat(entry.hiddenAbilities).some(function (a) { return tAb.has(a); });
    var abHtml = entry.abilities.map(esc).join('、') +
      (entry.hiddenAbilities.length
        ? ' <span class="ability-hidden">(' + entry.hiddenAbilities.map(esc).join('、') + '·隐)</span>'
        : '');
    tr.appendChild(makeCell(shared ? 'cell-correct' : 'cell-far', abHtml, '与答案拥有任意相同特性即绿色'));

    // 进化段数
    tr.appendChild(statCell(entry.stage, t.stage, 1, '段',
      '该宝可梦位于' + entry.lineLength + '段进化链的第 ' + entry.stage + ' 段'));

    // Mega
    var megaEq = entry.canMega === t.canMega;
    tr.appendChild(makeCell(megaEq ? 'cell-correct' : 'cell-far',
      '<span class="cell-value">' + (entry.canMega ? '可Mega' : '不可') + '</span>',
      '能否 Mega 进化'));

    tbody.appendChild(tr);
  }

  // ---------- 结束 ----------
  function endGame(win, gaveUp) {
    state.over = true;
    input.disabled = true;
    input.value = '';
    hideSuggest();
    hintMenu.classList.remove('open');

    var t = state.target;
    // 揭示目标
    setTargetVisual('reveal');
    targetStatus.classList.add('answer-name');
    targetStatus.textContent = t.name + ' · ' + GEN_NAMES[t.gen] + ' · ' + t.types.join('/');

    // 恢复设置面板，隐藏游戏中控制栏
    setupCard.classList.remove('hidden');
    gameControls.classList.add('hidden');

    // 横幅
    banner.className = 'card result-banner ' + (win ? 'win' : 'lose');
    var tries = state.guesses.length;
    var title = win ? '🎉 恭喜猜中！' : (gaveUp ? '🏳️ 已放弃' : '😢 很遗憾，未能猜出');
    var subTail = win ? '，第 ' + tries + ' 次猜中！' : (gaveUp ? '，要不要再来一把？' : '，8 次机会已用完');
    banner.innerHTML =
      (t.img ? '<img src="' + t.img + '" alt="' + esc(t.name) + '">' : '') +
      '<div class="rb-body">' +
      '<div class="rb-title">' + title + '</div>' +
      '<div class="rb-sub">正确答案：<b>' + esc(t.name) + '</b>（#' + pad4(t.id) + ' · ' +
      GEN_NAMES[t.gen] + ' · ' + esc(t.types.join('/')) + '）' + subTail + '</div>' +
      '</div>' +
      '<div class="rb-actions">' +
      '<button class="btn btn-primary" id="btn-again">🔄 再来一局</button>' +
      '<span class="again-hint">或重新选择世代后点击「开始竞猜」</span>' +
      '</div>';
    $('btn-again').addEventListener('click', startGame);
  }

  // ---------- 放弃 ----------
  btnGiveup.addEventListener('click', function () {
    if (!state.target || state.over) return;
    endGame(false, true);
  });

  // ---------- 提示 ----------
  btnHint.addEventListener('click', function () {
    if (!state.target || state.over) {
      toast('请先开始竞猜');
      return;
    }
    if (!MODES[state.mode].hints) {
      toast('困难模式无法使用提示');
      return;
    }
    if (state.hintUsed) {
      toast('本局提示已用完（每局限一次）');
      return;
    }
    hintMenu.classList.toggle('open');
  });

  function showHint(text) {
    var chip = document.createElement('div');
    chip.className = 'hint-chip';
    chip.textContent = text;
    hintInfo.appendChild(chip);
    toast(text);
  }

  function useHint(type) {
    hintMenu.classList.remove('open');
    if (!state.target || state.over) return;
    if (!MODES[state.mode].hints) {
      toast('困难模式无法使用提示');
      return;
    }
    if (state.hintUsed) {
      toast('本局提示已用完（每局限一次）');
      return;
    }
    state.hintUsed = true;
    btnHint.disabled = true;
    var t = state.target;
    if (type === 'length') {
      showHint('💡 名字共 ' + Array.from(t.name).length + ' 个字');
    } else if (type === 'fields') {
      revealFieldsHint();
    } else if (type === 'fill') {
      autoFillGuess();
    }
  }
  hintLength.addEventListener('click', function () { useHint('length'); });
  hintFields.addEventListener('click', function () { useHint('fields'); });
  hintFill.addEventListener('click', function () { useHint('fill'); });

  // 「揭示 3 个词条」：优先公布你还没有猜中过（绿色）的词条
  function unrevealedFields() {
    var t = state.target;
    return FIELDS.filter(function (f) {
      return !state.guesses.some(function (g) { return f.correct(g, t); });
    });
  }

  function revealFieldsHint() {
    var cands = unrevealedFields();
    if (cands.length === 0) {
      showHint('💡 全部词条都已被你猜中过，无需揭示！');
      return;
    }
    // 随机取 3 个（不足 3 个则全部给出）
    var picked = [];
    for (var i = 0; i < REVEAL_COUNT && cands.length > 0; i++) {
      picked.push(cands.splice(Math.floor(Math.random() * cands.length), 1)[0]);
    }
    picked.forEach(function (f) {
      showHint('💡 ' + f.label + '：' + f.answer(state.target));
    });
  }

  // 与答案的数据吻合项数（与反馈表一致的 12 个词条）
  function countMatches(p, t) {
    var n = 0;
    FIELDS.forEach(function (f) { if (f.correct(p, t)) n++; });
    return n;
  }

  // 随机填入一只 ≥ 半数数据吻合的宝可梦（排除答案本身与已猜过的），消耗一次竞猜
  function autoFillGuess() {
    var t = state.target;
    var need = Math.ceil(FIELDS.length / 2);
    var pool = poolFor(state.genSel).filter(function (p) {
      return p.id !== t.id && !state.guesses.some(function (g) { return g.id === p.id; });
    });
    var best = [], bestN = 0;
    pool.forEach(function (p) {
      var n = countMatches(p, t);
      if (n > bestN) bestN = n;
      if (n >= need) best.push(p);
    });
    if (best.length === 0) {
      // 兜底：没有 ≥ 半数吻合的候选时，取吻合数最多的一只
      toast('💡 本世代池中没有 ≥ 半数吻合的候选，已取最接近的一只');
      best = pool.filter(function (p) { return countMatches(p, t) === bestN; });
    }
    var c = best[Math.floor(Math.random() * best.length)];
    showHint('💡 已自动填入「' + c.name + '」（' + countMatches(c, t) + '/' + FIELDS.length + ' 项吻合）');
    pickPokemon(c);
  }

  // ---------- 初始化 ----------
  btnStart.addEventListener('click', startGame);
  renderGenButtons();
  renderDiffButtons();
  updateTableVisibility();
  updateAttempts();
  targetStatus.textContent = '点击「开始竞猜」抽取目标';
})();
