/** 事件类积木 */
(function () {
  const C = '#FFAB00';
  BlockRegistry.registerCategory('events', '事件', C);

  BlockRegistry.register({
    type: 'event_start', category: 'events', color: C,
    label: '🚩 当程序启动时', labelKey: 'blocks.events.event_start', shape: 'hat',
    ports: { flowIn: false, flowOut: true },
    params: [],
  });
  BlockRegistry.register({
    type: 'event_key_pressed', category: 'events', color: C,
    label: '⌨ 当按下 {key} 键', labelKey: 'blocks.events.event_key_pressed', shape: 'hat',
    ports: { flowIn: false, flowOut: true },
    params: [{ name: 'key', type: 'dropdown', default: 'space', options: ['space', 'up', 'down', 'left', 'right', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'enter', 'shift', 'control', 'alt', 'escape', 'tab', 'backspace'] }],
  });
  BlockRegistry.register({
    type: 'event_sprite_clicked', category: 'events', color: C,
    label: '👆 当精灵被点击', labelKey: 'blocks.events.event_sprite_clicked', shape: 'hat',
    ports: { flowIn: false, flowOut: true },
    params: [],
  });
  BlockRegistry.register({
    type: 'event_broadcast', category: 'events', color: C,
    label: '📡 广播 {msg}', labelKey: 'blocks.events.event_broadcast', shape: 'stack',
    ports: { flowIn: true, flowOut: true },
    params: [{ name: 'msg', type: 'string', default: '消息1' }],
  });
  BlockRegistry.register({
    type: 'event_broadcast_wait', category: 'events', color: C,
    label: '📡 广播 {msg} 并等待', labelKey: 'blocks.events.event_broadcast_wait', shape: 'stack',
    ports: { flowIn: true, flowOut: true },
    params: [{ name: 'msg', type: 'string', default: '消息1' }],
  });
  BlockRegistry.register({
    type: 'event_receive', category: 'events', color: C,
    label: '📩 当接收到 {msg}', labelKey: 'blocks.events.event_receive', shape: 'hat',
    ports: { flowIn: false, flowOut: true },
    params: [{ name: 'msg', type: 'string', default: '消息1' }],
  });
  BlockRegistry.register({
    type: 'event_timer', category: 'events', color: C,
    label: '⏱ 每隔 {sec} 秒', labelKey: 'blocks.events.event_timer', shape: 'hat',
    ports: { flowIn: false, flowOut: true },
    params: [{ name: 'sec', type: 'number', default: 1 }],
  });
})();
