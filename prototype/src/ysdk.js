/*
 * Прослойка к SDK Яндекс Игр.
 *
 * Игра обращается только сюда и ничего не знает про YaGames. Благодаря этому
 * один и тот же код работает и на платформе, и в локальном плейтесте, где
 * SDK нет вовсе: все методы тогда просто отвечают «нет площадки».
 *
 * Покрываемые требования площадки (нумерация из «Требований к игре»):
 *   1.19.2 LoadingAPI.ready()           — ready()
 *   1.19.3 GameplayAPI.start()/stop()   — gameplayStart()/gameplayStop()
 *   1.19.4 game_api_pause/resume        — подписка ниже, плюс потеря фокуса (1.3)
 *   4.1    реклама только через SDK     — interstitial()/rewarded()
 *   4.7    пауза и тишина на рекламе    — onPause/onResume вокруг показа
 *   1.9    прогресс переживает F5       — save()/load() поверх облака игрока
 *
 * Вызовы SDK обёрнуты в try/catch и не блокируют игру: если платформа
 * ответит не тем или не ответит совсем, игрок этого не заметит.
 */
(function () {
  var ysdk = null, player = null, started = false;
  var pauseHandlers = [], resumeHandlers = [];
  var saveTimer = null, savePending = null, lastSave = 0;
  var SAVE_GAP = 10000;            // setData ограничен сотней вызовов за 5 минут

  function fire(list, arg) {
    for (var i = 0; i < list.length; i++) {
      try { list[i](arg); } catch (e) {}
    }
  }

  function pauseAll() { fire(pauseHandlers); }
  function resumeAll() { fire(resumeHandlers); }

  // Платформа шлёт эти события в окно игры; на них же завязана пауза рекламы.
  window.addEventListener('game_api_pause', pauseAll);
  window.addEventListener('game_api_resume', resumeAll);
  // Потеря фокуса вкладки — отдельное требование (1.3), SDK о ней не сообщает.
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) pauseAll(); else resumeAll();
  });
  window.addEventListener('blur', pauseAll);
  window.addEventListener('focus', resumeAll);

  function init(done) {
    var finished = false;
    var finish = function () {
      if (finished) return;
      finished = true;
      try { done(!!ysdk); } catch (e) {}
    };
    // Если SDK не ответит, игра всё равно должна стартовать: ждём не дольше
    // четырёх секунд и идём дальше без площадки.
    setTimeout(finish, 4000);

    if (!window.YaGames || !window.YaGames.init) { finish(); return; }
    try {
      window.YaGames.init().then(function (sdk) {
        ysdk = sdk;
        try {
          sdk.getPlayer({ scopes: false }).then(function (p) { player = p; finish(); }, finish);
        } catch (e) { finish(); }
      }, finish);
    } catch (e) { finish(); }
  }

  /** Момент, когда игрок может играть. Без этого вызова игру не примут. */
  function ready() {
    try { ysdk && ysdk.features && ysdk.features.LoadingAPI && ysdk.features.LoadingAPI.ready(); } catch (e) {}
  }

  function gameplayStart() {
    if (started) return;
    started = true;
    try { ysdk && ysdk.features && ysdk.features.GameplayAPI && ysdk.features.GameplayAPI.start(); } catch (e) {}
  }

  function gameplayStop() {
    if (!started) return;
    started = false;
    try { ysdk && ysdk.features && ysdk.features.GameplayAPI && ysdk.features.GameplayAPI.stop(); } catch (e) {}
  }

  /* --------------------------------------------------------------- реклама */

  // Колбэки передаём и вложенными в callbacks, и плоско: у разных версий SDK
  // форма аргумента различается, лишние ключи ей не мешают.
  function advArgs(cbs) {
    var a = { callbacks: cbs };
    for (var k in cbs) if (cbs.hasOwnProperty(k)) a[k] = cbs[k];
    return a;
  }

  /** Полноэкранная — только в логической паузе (4.4): между сменами. */
  function interstitial(done) {
    if (!ysdk || !ysdk.adv || !ysdk.adv.showFullscreenAdv) { done && done(false); return; }
    var over = false;
    var end = function (shown) {
      if (over) return;
      over = true;
      resumeAll();
      done && done(!!shown);
    };
    try {
      ysdk.adv.showFullscreenAdv(advArgs({
        onOpen: pauseAll,
        onClose: function (wasShown) { end(wasShown); },
        onError: function () { end(false); }
      }));
    } catch (e) { end(false); }
    setTimeout(function () { end(false); }, 20000);   // не зависаем, если показ молчит
  }

  /** Вознаграждаемое видео: награду выдаём только по onRewarded. */
  function rewarded(onReward, done) {
    if (!ysdk || !ysdk.adv || !ysdk.adv.showRewardedVideo) { done && done(false); return; }
    var paid = false, over = false;
    var end = function () {
      if (over) return;
      over = true;
      resumeAll();
      done && done(paid);
    };
    try {
      ysdk.adv.showRewardedVideo(advArgs({
        onOpen: pauseAll,
        onRewarded: function () { paid = true; try { onReward && onReward(); } catch (e) {} },
        onClose: end,
        onError: end
      }));
    } catch (e) { end(); }
    setTimeout(end, 90000);
  }

  /* ------------------------------------------------------------ сохранения */

  /** Облачный прогресс. Локальный localStorage остаётся и работает без сети. */
  function load(done) {
    if (!player || !player.getData) { done(null); return; }
    var over = false;
    var end = function (data) { if (over) return; over = true; done(data || null); };
    setTimeout(function () { end(null); }, 4000);
    try { player.getData().then(end, function () { end(null); }); }
    catch (e) { end(null); }
  }

  function flush() {
    saveTimer = null;
    if (!savePending || !player || !player.setData) return;
    var data = savePending;
    savePending = null;
    lastSave = Date.now();
    try { player.setData(data).then(null, function () {}); } catch (e) {}
  }

  /** Пишем не чаще раза в десять секунд: у setData есть лимит частоты. */
  function save(data) {
    if (!player || !player.setData) return;
    savePending = data;
    if (saveTimer) return;
    var wait = Math.max(0, SAVE_GAP - (Date.now() - lastSave));
    saveTimer = setTimeout(flush, wait);
  }

  function lang() {
    try { return (ysdk && ysdk.environment && ysdk.environment.i18n && ysdk.environment.i18n.lang) || 'ru'; }
    catch (e) { return 'ru'; }
  }

  window.YGames = {
    init: init,
    ready: ready,
    gameplayStart: gameplayStart,
    gameplayStop: gameplayStop,
    interstitial: interstitial,
    rewarded: rewarded,
    save: save,
    load: load,
    flush: flush,
    lang: lang,
    onPause: function (fn) { pauseHandlers.push(fn); },
    onResume: function (fn) { resumeHandlers.push(fn); },
    isPlatform: function () { return !!ysdk; }
  };
})();
