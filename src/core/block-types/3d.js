/**
 * 3D 模式积木 - 对象式 3D 网格控制
 * 创建网格返回对象引用，可通过属性积木读写
 */
(function () {
    const C = '#FF6B35'; // 3D 积木颜色：橙色
    BlockRegistry.registerCategory('3d', '3D', C);

    // ===== 创建网格 (reporter - 返回网格对象) =====
    BlockRegistry.register({
        type: '3d_create_box',
        category: '3d',
        color: C,
        label: '创建立方体 x:{x} y:{y} z:{z} 宽:{w} 高:{h} 深:{d} 颜色:{color}',
        labelKey: 'blocks.3d.create_box',
        shape: 'reporter',
        ports: {},
        params: [
            { name: 'x', type: 'number', default: 0 },
            { name: 'y', type: 'number', default: 2 },
            { name: 'z', type: 'number', default: 0 },
            { name: 'w', type: 'number', default: 4 },
            { name: 'h', type: 'number', default: 4 },
            { name: 'd', type: 'number', default: 4 },
            { name: 'color', type: 'color', default: '#FF6B35' }
        ]
    });

    BlockRegistry.register({
        type: '3d_create_sphere',
        category: '3d',
        color: C,
        label: '创建球体 x:{x} y:{y} z:{z} 半径:{radius} 颜色:{color}',
        labelKey: 'blocks.3d.create_sphere',
        shape: 'reporter',
        ports: {},
        params: [
            { name: 'x', type: 'number', default: 0 },
            { name: 'y', type: 'number', default: 2 },
            { name: 'z', type: 'number', default: 0 },
            { name: 'radius', type: 'number', default: 2 },
            { name: 'color', type: 'color', default: '#4a90d9' }
        ]
    });

    BlockRegistry.register({
        type: '3d_create_cylinder',
        category: '3d',
        color: C,
        label: '创建圆柱 x:{x} y:{y} z:{z} 半径:{radius} 高:{h} 颜色:{color}',
        labelKey: 'blocks.3d.create_cylinder',
        shape: 'reporter',
        ports: {},
        params: [
            { name: 'x', type: 'number', default: 0 },
            { name: 'y', type: 'number', default: 2 },
            { name: 'z', type: 'number', default: 0 },
            { name: 'radius', type: 'number', default: 2 },
            { name: 'h', type: 'number', default: 6 },
            { name: 'color', type: 'color', default: '#66cc66' }
        ]
    });

    BlockRegistry.register({
        type: '3d_create_cone',
        category: '3d',
        color: C,
        label: '创建圆锥 x:{x} y:{y} z:{z} 半径:{radius} 高:{h} 颜色:{color}',
        labelKey: 'blocks.3d.create_cone',
        shape: 'reporter',
        ports: {},
        params: [
            { name: 'x', type: 'number', default: 0 },
            { name: 'y', type: 'number', default: 2 },
            { name: 'z', type: 'number', default: 0 },
            { name: 'radius', type: 'number', default: 2 },
            { name: 'h', type: 'number', default: 6 },
            { name: 'color', type: 'color', default: '#cc6666' }
        ]
    });

    BlockRegistry.register({
        type: '3d_create_plane',
        category: '3d',
        color: C,
        label: '创建平面 x:{x} y:{y} z:{z} 宽:{w} 高:{h} 颜色:{color}',
        labelKey: 'blocks.3d.create_plane',
        shape: 'reporter',
        ports: {},
        params: [
            { name: 'x', type: 'number', default: 0 },
            { name: 'y', type: 'number', default: 0 },
            { name: 'z', type: 'number', default: 0 },
            { name: 'w', type: 'number', default: 10 },
            { name: 'h', type: 'number', default: 10 },
            { name: 'color', type: 'color', default: '#aaaaaa' }
        ]
    });

    // ===== 清除网格 =====
    BlockRegistry.register({
        type: '3d_clear_meshes',
        category: '3d',
        color: C,
        label: '清除所有 3D 网格',
        labelKey: 'blocks.3d.clear_meshes',
        shape: 'stack',
        ports: { flowIn: true, flowOut: true },
        params: []
    });

    // ===== 网格属性 (对象式) =====
    BlockRegistry.register({
        type: '3d_mesh_get_attr',
        category: '3d',
        color: C,
        label: '{obj} 的 {attr}',
        labelKey: 'blocks.3d.mesh_get_attr',
        shape: 'reporter',
        ports: {},
        params: [
            { name: 'obj', type: 'string', default: '' },
            { name: 'attr', type: 'dropdown', options: [
                ['位置X', 'x'], ['位置Y', 'y'], ['位置Z', 'z'],
                ['缩放', 'scale'], ['旋转Y', 'rotationY'],
                ['颜色', 'color'], ['可见', 'visible']
            ], default: 'x' }
        ]
    });

    BlockRegistry.register({
        type: '3d_mesh_set_attr',
        category: '3d',
        color: C,
        label: '{obj} 的 {attr} 设置为 {val}',
        labelKey: 'blocks.3d.mesh_set_attr',
        shape: 'stack',
        ports: { flowIn: true, flowOut: true },
        params: [
            { name: 'obj', type: 'string', default: '' },
            { name: 'attr', type: 'dropdown', options: [
                ['位置X', 'x'], ['位置Y', 'y'], ['位置Z', 'z'],
                ['缩放', 'scale'], ['旋转Y', 'rotationY'],
                ['颜色', 'color'], ['可见', 'visible']
            ], default: 'x' },
            { name: 'val', type: 'string', default: '0' }
        ]
    });

    // ===== 相机控制 =====
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

    // ===== 场景效果 =====
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

    // ===== 报告器 =====
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

    console.log('[3D Blocks] 已注册 3D 积木模块（对象式）');
})();
