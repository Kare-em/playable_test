/*
 * Звук «Магазина у дома» — синтез через Web Audio, без файлов и лицензий:
 * каждый эффект собирается из осцилляторов и шума прямо в браузере.
 * Вес — ноль байт ассетов, тембр правится одной строкой.
 */
(function () {
  'use strict';

  var ctx = null, master = null, noiseBuf = null;
  var muted = false;
  try { muted = localStorage.getItem('shopsort.muted') === '1'; } catch (e) {}

  function ensure() {
    if (ctx) return ctx;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try { ctx = new AC(); } catch (e) { return null; }
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.55;
    master.connect(ctx.destination);
    return ctx;
  }

  function noise() {
    if (noiseBuf) return noiseBuf;
    var len = Math.floor(ctx.sampleRate * 0.3);
    noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    var d = noiseBuf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return noiseBuf;
  }

  // Одна нота: тип волны, частота (с опциональным глиссандо), огибающая.
  function tone(o) {
    var c = ensure(); if (!c) return;
    var t0 = c.currentTime + (o.delay || 0);
    var osc = c.createOscillator();
    var gain = c.createGain();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(o.freq, t0);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.to), t0 + o.dur);
    var peak = o.gain == null ? 0.2 : o.gain;
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(peak, t0 + (o.attack || 0.008));
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);
    osc.connect(gain); gain.connect(master);
    osc.start(t0); osc.stop(t0 + o.dur + 0.02);
  }

  // Шумовой слой: глухой стук товара о полку, щелчки.
  function hit(o) {
    var c = ensure(); if (!c) return;
    var t0 = c.currentTime + (o.delay || 0);
    var src = c.createBufferSource(); src.buffer = noise();
    var filt = c.createBiquadFilter();
    filt.type = o.type || 'lowpass';
    filt.frequency.value = o.cutoff || 900;
    var gain = c.createGain();
    gain.gain.setValueAtTime(o.gain == null ? 0.18 : o.gain, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);
    src.connect(filt); filt.connect(gain); gain.connect(master);
    src.start(t0); src.stop(t0 + o.dur + 0.02);
  }

  var SCALE = [0, 4, 7, 12];               // мажорное трезвучие для продажи

  function play(name, param) {
    if (muted) return;
    var c = ensure(); if (!c) return;
    switch (name) {
      case 'select':
        tone({ type: 'triangle', freq: 760, to: 1020, dur: 0.07, gain: 0.16 });
        break;
      case 'place':
        tone({ type: 'sine', freq: 260, to: 120, dur: 0.14, gain: 0.22 });
        hit({ dur: 0.07, cutoff: 700, gain: 0.14 });
        break;
      case 'deny':
        tone({ type: 'square', freq: 180, to: 120, dur: 0.14, gain: 0.12 });
        break;
      case 'sale':
        // чем длиннее комбо, тем выше трезвучие — слышно, что серия растёт
        var base = 523.25 * Math.pow(2, Math.min(param || 0, 6) / 12);
        SCALE.forEach(function (semi, i) {
          tone({ type: 'triangle', freq: base * Math.pow(2, semi / 12),
                 dur: 0.16, gain: 0.15, delay: i * 0.055 });
        });
        break;
      case 'wrong':
        tone({ type: 'triangle', freq: 392, dur: 0.14, gain: 0.14 });
        tone({ type: 'triangle', freq: 330, dur: 0.20, gain: 0.14, delay: 0.1 });
        break;
      case 'coin':
        tone({ type: 'square', freq: 1180, to: 1680, dur: 0.06, gain: 0.07 });
        break;
      case 'booster':
        tone({ type: 'sine', freq: 420, to: 1250, dur: 0.20, gain: 0.14 });
        break;
      case 'button':
        hit({ dur: 0.03, cutoff: 2200, gain: 0.10 });
        tone({ type: 'sine', freq: 620, dur: 0.05, gain: 0.10 });
        break;
      case 'win':
        [523.25, 659.25, 783.99, 1046.5].forEach(function (f, i) {
          tone({ type: 'triangle', freq: f, dur: 0.30, gain: 0.17, delay: i * 0.11 });
        });
        break;
      case 'lose':
        [440, 392, 311].forEach(function (f, i) {
          tone({ type: 'triangle', freq: f, dur: 0.34, gain: 0.15, delay: i * 0.15 });
        });
        break;
    }
  }

  window.ShopAudio = {
    // браузеры запускают звук только после жеста пользователя
    unlock: function () { var c = ensure(); if (c && c.state === 'suspended') c.resume(); },
    play: play,
    isMuted: function () { return muted; },
    toggle: function () {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.55;
      try { localStorage.setItem('shopsort.muted', muted ? '1' : '0'); } catch (e) {}
      if (!muted) play('button');
      return muted;
    }
  };
})();
