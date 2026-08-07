/**
 * 3D 模式积木 - 提供 3D 场景控制功能
 */
(function () {
    const C = '#FF6B35'; // 3D 积木颜色：橙色
    BlockRegistry.registerCategory('3d', '3D', C);

    // ===== 3D 相机控制 =====
    BlockRegistry.register({
        type: '3d_camera_position',
        category: '3d',
        color: C,
        label: '设置相机位置 x:{x} y:{y} z:{z}',
        labelKey: 'blocks.3d.camera_position',
        shape: 'stack',
        ports: { flowIn: true, flowOut: true },
        params: [
            { name: 'x', type: 'number', default: 0 },
            { name: 'y', type: 'number', default: 25 },
            { name: 'z', type: 'number', default: 35 }
        ]
    });

    BlockRegistry.register({
        type: '3d_camera_lookat',
        category: '3d',
        color: C,
        label: '相机看向 x:{x} y:{y} z:{z}',
        labelKey: 'blocks.3d.camera_lookat',
        shape: 'stack',
        ports: { flowIn: true, flowOut: true },
        params: [
            { name: 'x', type: 'number', default: 0 },
            { name: 'y', type: 'number', default: 0 },
            { name: 'z', type: 'number', default: 0 }
        ]
    });

    // ===== 3D 对象控制 =====
    BlockRegistry.register({
        type: '3d_set_height',
        category: '3d',
        color: C,
        label: '设置高度为 {height}',
        labelKey: 'blocks.3d.set_height',
        shape: 'stack',
        ports: { flowIn: true, flowOut: true },
        params: [{ name: 'height', type: 'number', default: 10 }]
    });

    BlockRegistry.register({
        type: '3d_change_height',
        category: '3d',
        color: C,
        label: '高度增加 {amount}',
        labelKey: 'blocks.3d.change_height',
        shape: 'stack',
        ports: { flowIn: true, flowOut: true },
        params: [{ name: 'amount', type: 'number', default: 5 }]
    });

    BlockRegistry.register({
        type: '3d_set_scale_3d',
        category: '3d',
        color: C,
        label: '3D 缩放 {scale}%',
        labelKey: 'blocks.3d.set_scale',
        shape: 'stack',
        ports: { flowIn: true, flowOut: true },
        params: [{ name: 'scale', type: 'number', default: 100 }]
    });

    // ===== 3D 场景效果 =====
    BlockRegistry.register({
        type: '3d_set_bgcolor',
        category: '3d',
        color: C,
        label: '设置天空颜色 {color}',
        labelKey: 'blocks.3d.set_bgcolor',
        shape: 'stack',
        ports: { flowIn: true, flowOut: true },
        params: [{ name: 'color', type: 'color', default: '#87CEEB' }]
    });

    BlockRegistry.register({
        type: '3d_set_ground_color',
        category: '3d',
        color: C,
        label: '设置地面颜色 {color}',
        labelKey: 'blocks.3d.set_ground_color',
        shape: 'stack',
        ports: { flowIn: true, flowOut: true },
        params: [{ name: 'color', type: 'color', default: '#88CC88' }]
    });

    BlockRegistry.register({
        type: '3d_toggle_grid',
        category: '3d',
        color: C,
        label: '显示网格 {show}',
        labelKey: 'blocks.3d.toggle_grid',
        shape: 'stack',
        ports: { flowIn: true, flowOut: true },
        params: [{ name: 'show', type: 'dropdown', options: [['显示', 'show'], ['隐藏', 'hide']], default: 'show' }]
    });

    // ===== 3D 报告器 =====
    BlockRegistry.register({
        type: '3d_camera_x',
        category: '3d',
        color: C,
        label: '相机 X',
        labelKey: 'blocks.3d.camera_x',
        shape: 'reporter',
        ports: {},
        params: []
    });

    BlockRegistry.register({
        type: '3d_camera_y',
        category: '3d',
        color: C,
        label: '相机 Y',
        labelKey: 'blocks.3d.camera_y',
        shape: 'reporter',
        ports: {},
        params: []
    });

    BlockRegistry.register({
        type: '3d_camera_z',
        category: '3d',
        color: C,
        label: '相机 Z',
        labelKey: 'blocks.3d.camera_z',
        shape: 'reporter',
        ports: {},
        params: []
    });

    console.log('[3D Blocks] 已注册 3D 积木模块');
})();
