/**
 * 声音管理器 - 管理音频播放/停止/音量
 */
const SoundManager = (function () {
  let _sounds = {};       // name -> AudioBuffer
  let _playing = {};      // name -> AudioBufferSourceNode
  let _audioCtx = null;
  let _masterGain = null;
  let _volume = 100;      // 0-100

  /** 获取/创建 AudioContext */
  function getAudioContext() {
    if (!_audioCtx) {
      _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      _masterGain = _audioCtx.createGain();
      _masterGain.connect(_audioCtx.destination);
      _masterGain.gain.value = _volume / 100;
    }
    return _audioCtx;
  }

  /** 加载声音文件 */
  async function loadSound(filePath) {
    const ctx = getAudioContext();
    try {
      // 从 file:// 协议加载
      const response = await fetch('file://' + filePath);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer);

      // 用文件名（无扩展名）作为键
      const name = filePath.split(/[\\/]/).pop().replace(/\.[^.]+$/, '');
      _sounds[name] = audioBuffer;
      console.log('[SoundManager] 加载声音:', name);
      return name;
    } catch (err) {
      console.error('[SoundManager] 加载失败:', err);
      return null;
    }
  }

  /** 从项目 sounds/ 目录加载所有声音 */
  async function loadFromProject(projectPath) {
    const dir = projectPath + '/sounds';
    const files = await window.api.listDir(dir);
    if (!files || files.length === 0) return 0;

    let count = 0;
    for (const f of files) {
      if (/\.(mp3|wav|ogg|m4a|aac)$/i.test(f)) {
        const name = await loadSound(dir + '/' + f);
        if (name) count++;
      }
    }
    return count;
  }

  /** 播放声音（不等待） */
  function play(name) {
    const buffer = _sounds[name];
    if (!buffer) {
      console.warn('[SoundManager] 声音不存在:', name);
      return false;
    }

    const ctx = getAudioContext();

    // 如果已在播放，先停止
    if (_playing[name]) {
      try { _playing[name].stop(); } catch {}
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(_masterGain);
    source.start(0);
    _playing[name] = source;

    source.onended = () => {
      if (_playing[name] === source) {
        delete _playing[name];
      }
    };

    return true;
  }

  /** 播放声音并等待完成 */
  function playAndWait(name) {
    return new Promise((resolve) => {
      const buffer = _sounds[name];
      if (!buffer) {
        console.warn('[SoundManager] 声音不存在:', name);
        resolve(false);
        return;
      }

      const ctx = getAudioContext();

      // 如果已在播放，先停止
      if (_playing[name]) {
        try { _playing[name].stop(); } catch {}
      }

      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(_masterGain);
      source.start(0);
      _playing[name] = source;

      source.onended = () => {
        if (_playing[name] === source) {
          delete _playing[name];
        }
        resolve(true);
      };

      // 超时保护
      setTimeout(() => resolve(true), buffer.duration * 1000 + 100);
    });
  }

  /** 停止指定声音 */
  function stop(name) {
    if (_playing[name]) {
      try { _playing[name].stop(); } catch {}
      delete _playing[name];
      return true;
    }
    return false;
  }

  /** 停止所有声音 */
  function stopAll() {
    Object.keys(_playing).forEach(name => {
      try { _playing[name].stop(); } catch {}
    });
    _playing = {};
  }

  /** 设置音量 */
  function setVolume(vol) {
    _volume = Math.max(0, Math.min(100, vol));
    if (_masterGain) {
      _masterGain.gain.value = _volume / 100;
    }
  }

  /** 改变音量 */
  function changeVolume(delta) {
    setVolume(_volume + delta);
  }

  /** 获取音量 */
  function getVolume() {
    return _volume;
  }

  /** 获取已加载的声音列表 */
  function getSoundNames() {
    return Object.keys(_sounds);
  }

  /** 检查声音是否正在播放 */
  function isPlaying(name) {
    return !!_playing[name];
  }

  return {
    loadSound, loadFromProject,
    play, playAndWait, stop, stopAll,
    setVolume, changeVolume, getVolume,
    getSoundNames, isPlaying,
  };
})();
