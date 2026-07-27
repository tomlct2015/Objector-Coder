/** 声音类积木 */
(function () {
  const C = '#CF63CF';
  BlockRegistry.registerCategory('sound', '声音', C);

  BlockRegistry.register({
    type: 'sound_play', category: 'sound', color: C,
    label: '播放声音 {name}', labelKey: 'blocks.sound.sound_play', shape: 'stack',
    ports: { flowIn: true, flowOut: true },
    params: [{ name: 'name', type: 'string', default: '' }],
  });

  BlockRegistry.register({
    type: 'sound_play_wait', category: 'sound', color: C,
    label: '播放声音 {name} 并等待', labelKey: 'blocks.sound.sound_play_wait', shape: 'stack',
    ports: { flowIn: true, flowOut: true },
    params: [{ name: 'name', type: 'string', default: '' }],
  });

  BlockRegistry.register({
    type: 'sound_stop', category: 'sound', color: C,
    label: '停止所有声音', labelKey: 'blocks.sound.sound_stop', shape: 'stack',
    ports: { flowIn: true, flowOut: true },
    params: [],
  });

  BlockRegistry.register({
    type: 'sound_stop_name', category: 'sound', color: C,
    label: '停止声音 {name}', labelKey: 'blocks.sound.sound_stop_name', shape: 'stack',
    ports: { flowIn: true, flowOut: true },
    params: [{ name: 'name', type: 'string', default: '' }],
  });

  BlockRegistry.register({
    type: 'sound_set_volume', category: 'sound', color: C,
    label: '将音量设为 {vol}%', labelKey: 'blocks.sound.sound_set_volume', shape: 'stack',
    ports: { flowIn: true, flowOut: true },
    params: [{ name: 'vol', type: 'number', default: 100 }],
  });

  BlockRegistry.register({
    type: 'sound_change_volume', category: 'sound', color: C,
    label: '音量增加 {val}', labelKey: 'blocks.sound.sound_change_volume', shape: 'stack',
    ports: { flowIn: true, flowOut: true },
    params: [{ name: 'val', type: 'number', default: 10 }],
  });

  BlockRegistry.register({
    type: 'sound_get_volume', category: 'sound', color: C,
    label: '音量', labelKey: 'blocks.sound.sound_get_volume', shape: 'reporter',
    ports: { flowIn: false, flowOut: false },
    params: [],
  });

  BlockRegistry.register({
    type: 'sound_load', category: 'sound', color: C,
    label: '加载声音文件 {path}', labelKey: 'blocks.sound.sound_load', shape: 'stack',
    ports: { flowIn: true, flowOut: true },
    params: [{ name: 'path', type: 'string', default: '' }],
  });
})();
