/**
 * 3D 舞台渲染模块
 * 使用 Three.js 实现 3D 渲染效果
 * - 角色以贴图平面显示（billboard）
 * - 支持基础网格创建
 */
const Stage3D = (function () {
    var scene, camera, renderer;
    var spriteMeshes = new Map();
    var spriteTextures = new Map();
    var createdMeshes = [];
    var meshMap = new Map(); // id -> { id, type, mesh, ...props }
    var _meshIdCounter = 0;
    var groundPlane, gridHelper;
    var _initialized = false;
    var W = 480, H = 360;
    var SCENE_SIZE = 50;

    /** 初始化 3D 舞台 */
    function init(canvas) {
        if (typeof THREE === 'undefined') {
            console.error('[Stage3D] Three.js 未加载');
            return false;
        }
        if (!canvas) {
            console.error('[Stage3D] canvas 元素不存在');
            return false;
        }

        // 确保 canvas 尺寸正确
        canvas.width = W;
        canvas.height = H;
        canvas.style.width = W + 'px';
        canvas.style.height = H + 'px';

        try {
            // 创建场景
            scene = new THREE.Scene();
            scene.background = new THREE.Color(0x87ceeb);

            // 创建相机
            camera = new THREE.PerspectiveCamera(60, W / H, 0.1, 1000);
            camera.position.set(0, 25, 35);
            camera.lookAt(0, 0, 0);

            // 创建渲染器（直接绑定 canvas 上下文）
            renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
            renderer.setSize(W, H, false);
            renderer.shadowMap.enabled = true;
            renderer.shadowMap.type = THREE.PCFSoftShadowMap;

            setupLighting();
            createGround();

            _initialized = true;
            renderLoop();
            console.log('[Stage3D] 初始化成功');
            return true;
        } catch (e) {
            console.error('[Stage3D] 初始化失败:', e.message);
            return false;
        }
    }

    function setupLighting() {
        scene.add(new THREE.AmbientLight(0xffffff, 0.7));
        var dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
        dirLight.position.set(10, 20, 10);
        dirLight.castShadow = true;
        dirLight.shadow.mapSize.width = 1024;
        dirLight.shadow.mapSize.height = 1024;
        dirLight.shadow.camera.near = 0.5;
        dirLight.shadow.camera.far = 100;
        dirLight.shadow.camera.left = -30;
        dirLight.shadow.camera.right = 30;
        dirLight.shadow.camera.top = 30;
        dirLight.shadow.camera.bottom = -30;
        scene.add(dirLight);
    }

    function createGround() {
        var gGeo = new THREE.PlaneGeometry(SCENE_SIZE * 2, SCENE_SIZE * 2);
        var gMat = new THREE.MeshStandardMaterial({ color: 0x88cc88, roughness: 0.8 });
        groundPlane = new THREE.Mesh(gGeo, gMat);
        groundPlane.rotation.x = -Math.PI / 2;
        groundPlane.receiveShadow = true;
        scene.add(groundPlane);

        gridHelper = new THREE.GridHelper(SCENE_SIZE * 2, 20, 0x444444, 0x666666);
        gridHelper.position.y = 0.01;
        gridHelper.material.opacity = 0.25;
        gridHelper.material.transparent = true;
        scene.add(gridHelper);
    }

    /** 2D 坐标转 3D 坐标 */
    function convertCoords(x, y) {
        var scale = SCENE_SIZE / 240;
        return { x: x * scale, y: 1, z: -y * scale };
    }

    /** 获取或创建精灵的 3D 贴图平面 */
    function getOrCreateSpriteMesh(sprite) {
        var mesh = spriteMeshes.get(sprite.id);
        var currentCostume = sprite.costumeName || '';
        var lastCostume = spriteTextures.get(sprite.id);

        // 造型变化时重建
        if (mesh && currentCostume !== lastCostume) {
            if (mesh.material.map) mesh.material.map.dispose();
            mesh.material.dispose();
            scene.remove(mesh);
            mesh = null;
        }

        if (!mesh) {
            var geometry = new THREE.PlaneGeometry(4, 4);
            var material;
            var costumeImg = sprite.costumeImage;

            if (costumeImg) {
                var texture = new THREE.Texture(costumeImg);
                texture.needsUpdate = true;
                // 保持宽高比
                var aspect = costumeImg.width / costumeImg.height;
                geometry = new THREE.PlaneGeometry(4 * aspect, 4);
                material = new THREE.MeshBasicMaterial({
                    map: texture,
                    transparent: true,
                    side: THREE.DoubleSide
                });
            } else {
                // 默认三角箭头用颜色方块
                material = new THREE.MeshBasicMaterial({
                    color: new THREE.Color(sprite.color || '#4a90d9'),
                    side: THREE.DoubleSide
                });
            }
            mesh = new THREE.Mesh(geometry, material);
            mesh.castShadow = true;
            scene.add(mesh);
            spriteMeshes.set(sprite.id, mesh);
            spriteTextures.set(sprite.id, currentCostume);
        }
        return mesh;
    }

    /** 更新精灵的 3D 属性 */
    function updateSpriteMesh(sprite, mesh) {
        var pos = convertCoords(sprite.x, sprite.y);
        mesh.position.set(pos.x, pos.y + (sprite._height3d || 0), pos.z);

        var s = (sprite.size || 100) / 100;
        mesh.scale.set(s, s, s);

        // 旋转：Y 轴旋转面向相机方向
        if (sprite.rotationStyle === 'allAround') {
            mesh.rotation.y = (90 - sprite.direction) * Math.PI / 180;
        } else if (sprite.rotationStyle === 'leftRight') {
            mesh.rotation.y = sprite.direction > 180 ? Math.PI : 0;
        }
        mesh.visible = sprite.visible !== false;
    }

    /** 渲染循环 */
    function renderLoop() {
        if (!_initialized) return;
        requestAnimationFrame(renderLoop);

        if (typeof StageManager !== 'undefined') {
            var sprites = StageManager.getSprites();
            var currentIds = new Set();

            sprites.forEach(function (sprite) {
                currentIds.add(sprite.id);
                var mesh = getOrCreateSpriteMesh(sprite);
                updateSpriteMesh(sprite, mesh);
            });

            // 清理已删除的精灵
            spriteMeshes.forEach(function (mesh, id) {
                if (!currentIds.has(id)) {
                    scene.remove(mesh);
                    if (mesh.geometry) mesh.geometry.dispose();
                    if (mesh.material) {
                        if (mesh.material.map) mesh.material.map.dispose();
                        mesh.material.dispose();
                    }
                    spriteMeshes.delete(id);
                    spriteTextures.delete(id);
                }
            });
        }
        renderer.render(scene, camera);
    }

    /** 创建基础网格 - 返回包含 ID 的包装对象 */
    function createMesh(type, params) {
        params = params || {};
        var x = Number(params.x || 0);
        var y = Number(params.y || 0);
        var z = Number(params.z || 0);
        var color = params.color || '#FF6B35';
        var w = Number(params.w || 4);
        var h = Number(params.h || 4);
        var d = Number(params.d || 4);
        var radius = Number(params.radius || 2);

        var geometry, material;
        switch (type) {
            case 'box':
                geometry = new THREE.BoxGeometry(w, h, d);
                material = new THREE.MeshStandardMaterial({ color: color });
                break;
            case 'sphere':
                geometry = new THREE.SphereGeometry(radius, 16, 16);
                material = new THREE.MeshStandardMaterial({ color: color });
                break;
            case 'cylinder':
                geometry = new THREE.CylinderGeometry(radius, radius, h, 16);
                material = new THREE.MeshStandardMaterial({ color: color });
                break;
            case 'plane':
                geometry = new THREE.PlaneGeometry(w, h);
                material = new THREE.MeshStandardMaterial({ color: color, side: THREE.DoubleSide });
                break;
            case 'cone':
                geometry = new THREE.ConeGeometry(radius, h, 16);
                material = new THREE.MeshStandardMaterial({ color: color });
                break;
            default:
                geometry = new THREE.BoxGeometry(w, h, d);
                material = new THREE.MeshStandardMaterial({ color: color });
        }

        var mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(x, y, z);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        scene.add(mesh);

        var id = ++_meshIdCounter;
        var wrapper = {
            __is3DMesh: true,
            id: id,
            type: type,
            mesh: mesh,
            x: x, y: y, z: z,
            w: w, h: h, d: d, radius: radius,
            color: color,
            scale: 1,
            rotationY: 0,
            visible: true
        };
        meshMap.set(id, wrapper);
        createdMeshes.push(mesh);
        return wrapper;
    }

    /** 应用属性到 Three.js 网格 */
    function applyMeshProperty(wrapper) {
        var mesh = wrapper.mesh;
        if (!mesh) return;
        mesh.position.set(Number(wrapper.x), Number(wrapper.y), Number(wrapper.z));
        var s = Number(wrapper.scale || 1);
        mesh.scale.set(s, s, s);
        mesh.rotation.y = Number(wrapper.rotationY || 0) * Math.PI / 180;
        if (mesh.material && mesh.material.color && wrapper.color) {
            mesh.material.color.set(String(wrapper.color));
        }
        mesh.visible = wrapper.visible !== false;
    }

    /** 获取网格属性 */
    function getMeshProperty(id, attr) {
        var wrapper = meshMap.get(Number(id));
        if (!wrapper) return undefined;
        switch (attr) {
            case 'x': return wrapper.x;
            case 'y': return wrapper.y;
            case 'z': return wrapper.z;
            case 'scale': return wrapper.scale;
            case 'rotationY': return wrapper.rotationY;
            case 'color': return wrapper.color;
            case 'visible': return wrapper.visible;
            case 'w': return wrapper.w;
            case 'h': return wrapper.h;
            case 'd': return wrapper.d;
            case 'radius': return wrapper.radius;
            case 'type': return wrapper.type;
            default: return undefined;
        }
    }

    /** 删除单个网格 */
    function removeMesh(id) {
        var wrapper = meshMap.get(Number(id));
        if (wrapper) {
            if (wrapper.mesh) {
                scene.remove(wrapper.mesh);
                if (wrapper.mesh.geometry) wrapper.mesh.geometry.dispose();
                if (wrapper.mesh.material) wrapper.mesh.material.dispose();
                var idx = createdMeshes.indexOf(wrapper.mesh);
                if (idx >= 0) createdMeshes.splice(idx, 1);
            }
            meshMap.delete(Number(id));
        }
    }

    /** 删除所有手动创建的网格 */
    function clearCreatedMeshes() {
        createdMeshes.forEach(function (m) {
            scene.remove(m);
            if (m.geometry) m.geometry.dispose();
            if (m.material) m.material.dispose();
        });
        createdMeshes = [];
        meshMap.clear();
    }

    /** 设置相机位置 */
    function setCameraPosition(x, y, z) {
        if (camera) {
            camera.position.set(x, y, z);
            camera.lookAt(0, 0, 0);
        }
    }

    /** 设置天空颜色 */
    function setSkyColor(color) {
        if (scene && scene.background) scene.background.set(color);
    }

    /** 设置地面颜色 */
    function setGroundColor(color) {
        if (groundPlane && groundPlane.material) groundPlane.material.color.set(color);
    }

    /** 切换网格显示 */
    function setGridVisible(show) {
        if (gridHelper) gridHelper.visible = !!show;
    }

    function dispose() {
        _initialized = false;
        spriteMeshes.forEach(function (mesh) {
            scene.remove(mesh);
            if (mesh.geometry) mesh.geometry.dispose();
            if (mesh.material) {
                if (mesh.material.map) mesh.material.map.dispose();
                mesh.material.dispose();
            }
        });
        spriteMeshes.clear();
        spriteTextures.clear();
        clearCreatedMeshes();
        if (renderer) renderer.dispose();
    }

    return {
        init: init,
        dispose: dispose,
        setCameraPosition: setCameraPosition,
        isInitialized: function () { return _initialized; },
        getScene: function () { return scene; },
        getCamera: function () { return camera; },
        getRenderer: function () { return renderer; },
        createMesh: createMesh,
        clearCreatedMeshes: clearCreatedMeshes,
        removeMesh: removeMesh,
        setMeshProperty: applyMeshProperty,
        getMeshProperty: getMeshProperty,
        setSkyColor: setSkyColor,
        setGroundColor: setGroundColor,
        setGridVisible: setGridVisible
    };
})();
