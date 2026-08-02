/**
 * Objector Community API - Supabase SDK Wrapper
 * 提供认证、CRUD、上传等社区功能
 * 
 * 使用前需引入 Supabase CDN：
 * <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
 */
const CommunityAPI = (function () {
  let _supabase = null;
  let _user = null;
  let _profile = null;

  // ============================================================
  // 配置 - 替换为你的 Supabase 项目 URL 和 anon key
  // ============================================================
  const SUPABASE_URL = 'https://hmwjmiuyctrlqeumrqpe.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhtd2ptaXV5Y3RybHFldW1ycXBlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTE0Nzk1MywiZXhwIjoyMTAwNzIzOTUzfQ.a6cTgGJL5t5BQYZ0tyvgCsO6U9R-am5npVZp_CxwXq0';

  const PAGE_SIZE = 12;

  /** 初始化 Supabase 客户端 */
  function init() {
    // 兼容 UMD 全局对象的不同暴露方式
    var sb = window.supabase;
    if (!sb) {
      console.error('[CommunityAPI] Supabase SDK not loaded. window.supabase is undefined.');
      return false;
    }
    // UMD 版本可能直接暴露 createClient 函数，也可能是对象
    if (typeof sb === 'function') {
      _supabase = sb(SUPABASE_URL, SUPABASE_ANON_KEY);
    } else if (typeof sb.createClient === 'function') {
      _supabase = sb.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    } else {
      console.error('[CommunityAPI] Supabase SDK loaded but createClient not found. supabase =', sb);
      return false;
    }
    console.log('[CommunityAPI] Initialized successfully');
    return true;
  }

  /** 是否已配置 Supabase */
  function isConfigured() {
    return SUPABASE_URL !== 'YOUR_SUPABASE_URL' && _supabase !== null;
  }

  // ============================================================
  // Auth 认证
  // ============================================================

  async function signUp(email, password, username) {
    if (!_supabase) return { error: 'Not initialized' };
    const { data, error } = await _supabase.auth.signUp({
      email, password,
      options: { data: { username } }
    });
    if (!error) _user = data.user;
    return { data, error };
  }

  async function signIn(email, password) {
    if (!_supabase) return { error: 'Not initialized' };
    const { data, error } = await _supabase.auth.signInWithPassword({ email, password });
    if (!error) {
      _user = data.user;
      await loadProfile();
      await recordLogin();
    }
    return { data, error };
  }

  /** 发送 OTP 验证码到邮箱（无密码登录） */
  async function sendLoginOtp(email) {
    if (!_supabase) return { error: 'Not initialized' };
    const { data, error } = await _supabase.auth.signInWithOtp({ email });
    return { data, error };
  }

  /** 验证 OTP 验证码完成登录 */
  async function verifyLoginOtp(email, token) {
    if (!_supabase) return { error: 'Not initialized' };
    const { data, error } = await _supabase.auth.verifyOtp({ email, token, type: 'email' });
    if (!error && data.user) {
      _user = data.user;
      await loadProfile();
      await recordLogin();
    }
    return { data, error };
  }

  /** 记录登录日志（触发登录通知邮件） */
  async function recordLogin() {
    if (!_supabase || !_user) return;
    try {
      await _supabase.from('login_logs').insert({
        user_id: _user.id,
        login_at: new Date().toISOString(),
        user_agent: navigator.userAgent || 'unknown',
      });
    } catch (e) {
      console.warn('[LoginLog] record failed:', e.message);
    }
  }

  async function signOut() {
    if (!_supabase) return;
    await _supabase.auth.signOut();
    _user = null;
    _profile = null;
  }

  /** 注销账户（删除用户及其所有数据） */
  async function deleteAccount(password) {
    if (!_supabase || !_user) return { error: 'Not logged in' };
    // 先重新验证密码以确保是本人操作
    const { error: authError } = await _supabase.auth.signInWithPassword({
      email: _user.email, password
    });
    if (authError) return { error: authError.message || '密码验证失败' };
    // 删除用户所有相关数据（通过 RPC 调用服务端删除）
    try {
      const { data, error } = await _supabase.rpc('delete_user_account', { target_user_id: _user.id });
      if (error) return { error: error.message };
      // 删除 auth.users 中的用户（调用 Supabase 内置方法）
      await _supabase.auth.admin.deleteUser(_user.id).catch(() => {});
      // 本地登出
      await _supabase.auth.signOut();
      _user = null;
      _profile = null;
      return { data: { success: true } };
    } catch (e) {
      return { error: e.message };
    }
  }

  async function getCurrentUser() {
    if (!_supabase) return null;
    const { data } = await _supabase.auth.getUser();
    _user = data.user;
    if (_user && !_profile) await loadProfile();
    return _user;
  }

  async function loadProfile() {
    if (!_user) return null;
    const { data } = await _supabase
      .from('profiles')
      .select('*')
      .eq('id', _user.id)
      .single();
    _profile = data;
    return _profile;
  }

  async function restoreSession() {
    if (!_supabase) return false;
    try {
      // 方法1: 尝试 getSession（从内存/存储恢复）
      const { data } = await _supabase.auth.getSession();
      if (data.session) {
        _user = data.session.user;
        await loadProfile();
        return true;
      }
    } catch (e) {
      console.warn('[CommunityAPI] getSession failed:', e.message);
    }

    // 方法2: 手动从 localStorage 读取 Supabase 存储的 token
    try {
      const key = 'sb-' + SUPABASE_URL.replace('https://', '').replace('.supabase.co', '') + '-auth-token';
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.currentSession && parsed.currentSession.user) {
          _user = parsed.currentSession.user;
          // 用 access_token 设置 session 给当前客户端
          await _supabase.auth.setSession({
            access_token: parsed.currentSession.access_token,
            refresh_token: parsed.currentSession.refresh_token
          });
          await loadProfile();
          return true;
        }
      }
    } catch (e) {
      console.warn('[CommunityAPI] localStorage session restore failed:', e.message);
    }

    // 方法3: 通过 API 调用获取当前用户
    try {
      const { data } = await _supabase.auth.getUser();
      if (data.user) {
        _user = data.user;
        await loadProfile();
        return true;
      }
    } catch (e) {
      console.warn('[CommunityAPI] getUser failed:', e.message);
    }

    return false;
  }

  function getProfile(userId) {
    if (!userId && _profile) return { data: _profile };
    return getProfileById(userId || (_user ? _user.id : null));
  }
  function getUser() { return _user; }

  async function updateProfile(updates) {
    if (!_user) return { error: 'Not logged in' };
    const { data, error } = await _supabase
      .from('profiles')
      .update(updates)
      .eq('id', _user.id)
      .select()
      .single();
    if (!error) _profile = data;
    return { data, error };
  }

  // ============================================================
  // Projects 作品
  // ============================================================

  async function getProjects(page = 1, sort = 'newest', search = '') {
    if (!_supabase) return { data: [], count: 0 };
    let query = _supabase
      .from('projects')
      .select('*, profiles(username, avatar_url)', { count: 'exact' })
      .eq('is_public', true);

    if (search) query = query.ilike('title', `%${search}%`);
    if (sort === 'newest') query = query.order('created_at', { ascending: false });
    else if (sort === 'popular') query = query.order('likes_count', { ascending: false });
    else if (sort === 'downloads') query = query.order('downloads_count', { ascending: false });

    query = query.range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
    const { data, error, count } = await query;
    const total = count || 0;
    return { data: data || [], total, count: total, error };
  }

  async function getProject(id) {
    if (!_supabase) return { data: null };
    const { data } = await _supabase
      .from('projects')
      .select('*, profiles(username, avatar_url)')
      .eq('id', id)
      .single();
    return { data };
  }

  async function publishProject(titleOrData, descriptionOrZip, zipBlob, thumbnailBlob) {
    if (!_user) return { error: 'Not logged in' };

    let title, description, jsonData, isPublic;
    if (typeof titleOrData === 'object' && titleOrData !== null) {
      title = titleOrData.title;
      description = titleOrData.description || '';
      jsonData = titleOrData.json_data || null;
      isPublic = titleOrData.is_public !== undefined ? titleOrData.is_public : true;
      zipBlob = descriptionOrZip;
    } else {
      title = titleOrData;
      description = descriptionOrZip || '';
    }

    let zipUrl = null;
    let thumbUrl = null;

    if (zipBlob) {
      const zipPath = `${_user.id}/${Date.now()}.zip`;
      const { error: zipErr } = await _supabase.storage.from('projects').upload(zipPath, zipBlob, {
        contentType: 'application/zip', upsert: false
      });
      if (!zipErr) {
        const { data: urlData } = _supabase.storage.from('projects').getPublicUrl(zipPath);
        zipUrl = urlData.publicUrl;
      }
    }

    if (thumbnailBlob) {
      const thumbPath = `${_user.id}/${Date.now()}_thumb.png`;
      const { error: thumbErr } = await _supabase.storage.from('projects').upload(thumbPath, thumbnailBlob, {
        contentType: 'image/png', upsert: false
      });
      if (!thumbErr) {
        const { data: urlData } = _supabase.storage.from('projects').getPublicUrl(thumbPath);
        thumbUrl = urlData.publicUrl;
      }
    }

    if (!jsonData && typeof EditorState !== 'undefined' && EditorState.projectPath) {
      jsonData = localStorage.getItem('vfs:' + EditorState.projectPath + '/scripts/main.json');
    }

    const { data, error } = await _supabase.from('projects').insert({
      author_id: _user.id,
      title, description,
      zip_url: zipUrl,
      thumbnail_url: thumbUrl,
      json_data: jsonData,
      is_public: isPublic !== undefined ? isPublic : true,
    }).select().single();

    return { data, error };
  }

  async function deleteProject(id) {
    if (!_user) return { error: 'Not logged in' };
    return await _supabase.from('projects').delete().eq('id', id).eq('author_id', _user.id);
  }

  async function updateProject(id, updates, zipBlob) {
    if (!_user) return { error: 'Not logged in' };

    // 如果有新 ZIP，先上传
    if (zipBlob) {
      const zipPath = `${_user.id}/${id}_${Date.now()}.zip`;
      const { error: zipErr } = await _supabase.storage.from('projects').upload(zipPath, zipBlob, {
        contentType: 'application/zip', upsert: true
      });
      if (!zipErr) {
        const { data: urlData } = _supabase.storage.from('projects').getPublicUrl(zipPath);
        updates.zip_url = urlData.publicUrl;
      }
    }

    const { data, error } = await _supabase
      .from('projects').update(updates).eq('id', id).eq('author_id', _user.id).select().single();
    return { data, error };
  }

  async function getUserProjectByTitle(userId, title) {
    if (!_supabase) return null;
    const { data } = await _supabase
      .from('projects')
      .select('id, title, description')
      .eq('author_id', userId)
      .eq('title', title)
      .limit(1);
    return (data && data.length > 0) ? data[0] : null;
  }

  async function incrementDownloads(id) {
    if (!_supabase) return;
    await _supabase.rpc('increment', { row_id: id, table_name: 'projects', column_name: 'downloads_count' });
    // Fallback: manual increment if RPC not set up
    const proj = await getProject(id);
    if (proj) {
      await _supabase.from('projects').update({ downloads_count: proj.downloads_count + 1 }).eq('id', id);
    }
  }

  // ============================================================
  // Posts 帖子
  // ============================================================

  async function getPosts(page = 1, category = '', sort = 'newest', search = '') {
    if (!_supabase) return { data: [], count: 0 };
    // 'all' 表示不筛选分类
    if (category === 'all') category = '';
    let query = _supabase
      .from('posts')
      .select('*, profiles(username, avatar_url)', { count: 'exact' });

    if (category) query = query.eq('category', category);
    if (search) query = query.ilike('title', `%${search}%`);
    if (sort === 'newest') query = query.order('created_at', { ascending: false });
    else if (sort === 'popular') query = query.order('likes_count', { ascending: false });
    else if (sort === 'active') query = query.order('comments_count', { ascending: false });

    query = query.range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
    const { data, error, count } = await query;
    const total = count || 0;
    return { data: data || [], total, count: total, error };
  }

  async function getPost(id) {
    if (!_supabase) return { data: null };
    const { data } = await _supabase
      .from('posts')
      .select('*, profiles(username, avatar_url)')
      .eq('id', id)
      .single();
    return { data };
  }

  async function createPost(titleOrData, content, category) {
    if (!_user) return { error: 'Not logged in' };
    let t, c, cat;
    if (typeof titleOrData === 'object' && titleOrData !== null) {
      t = titleOrData.title;
      c = titleOrData.content;
      cat = titleOrData.category || 'general';
    } else {
      t = titleOrData;
      c = content;
      cat = category || 'general';
    }
    const { data, error } = await _supabase.from('posts').insert({
      author_id: _user.id, title: t, content: c, category: cat
    }).select().single();
    return { data, error };
  }

  async function updatePost(id, updates) {
    if (!_user) return { error: 'Not logged in' };
    const { data, error } = await _supabase
      .from('posts').update(updates).eq('id', id).eq('author_id', _user.id).select().single();
    return { data, error };
  }

  async function deletePost(id) {
    if (!_user) return { error: 'Not logged in' };
    return await _supabase.from('posts').delete().eq('id', id).eq('author_id', _user.id);
  }

  // ============================================================
  // Comments 评论
  // ============================================================

  async function getComments(targetType, targetId) {
    if (!_supabase) return { data: [] };
    const { data } = await _supabase
      .from('comments')
      .select('*, profiles(username, avatar_url)')
      .eq('target_type', targetType)
      .eq('target_id', targetId)
      .order('created_at', { ascending: true });
    return { data: data || [] };
  }

  async function addComment(targetType, targetId, content) {
    if (!_user) return { error: 'Not logged in' };
    const { data, error } = await _supabase.from('comments').insert({
      author_id: _user.id, target_type: targetType, target_id: targetId, content
    }).select('*, profiles(username, avatar_url)').single();
    return { data, error };
  }

  async function deleteComment(id) {
    if (!_user) return { error: 'Not logged in' };
    return await _supabase.from('comments').delete().eq('id', id).eq('author_id', _user.id);
  }

  // ============================================================
  // Extensions 扩展
  // ============================================================

  async function getExtensions(page = 1, search = '', sort = 'newest') {
    if (!_supabase) return { data: [], count: 0 };
    let query = _supabase
      .from('extensions')
      .select('*, profiles(username, avatar_url)', { count: 'exact' });

    if (search) query = query.ilike('name', `%${search}%`);
    if (sort === 'newest') query = query.order('created_at', { ascending: false });
    else if (sort === 'popular') query = query.order('likes_count', { ascending: false });
    else if (sort === 'downloads') query = query.order('downloads_count', { ascending: false });

    query = query.range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
    const { data, error, count } = await query;
    const total = count || 0;
    return { data: data || [], total, count: total, error };
  }

  async function getExtension(id) {
    if (!_supabase) return { data: null };
    const { data } = await _supabase
      .from('extensions')
      .select('*, profiles(username, avatar_url)')
      .eq('id', id)
      .single();
    return { data };
  }

  async function publishExtension(name, extId, description, version, fileContent) {
    if (!_user) return { error: 'Not logged in' };

    let fileUrl = null;
    if (fileContent) {
      // fileContent 可以是 Blob, string 或带 name 属性的对象
      let blob, fileExt, contentType;
      if (typeof fileContent === 'string') {
        blob = new Blob([fileContent], { type: 'application/json' });
        fileExt = '.json';
        contentType = 'application/json';
      } else if (fileContent instanceof Blob) {
        blob = fileContent;
        const isJs = fileContent.name && fileContent.name.endsWith('.js');
        fileExt = isJs ? '.js' : '.json';
        contentType = isJs ? 'application/javascript' : 'application/json';
      } else {
        blob = new Blob([typeof fileContent === 'object' ? JSON.stringify(fileContent) : String(fileContent)], { type: 'application/json' });
        fileExt = '.json';
        contentType = 'application/json';
      }
      // 对 extId 做 ASCII 安全化处理（Supabase Storage key 不允许非 ASCII 字符）
      const safeExtId = String(extId).replace(/[^a-zA-Z0-9_\-]/g, function(ch) {
        return '_u' + ch.charCodeAt(0).toString(16) + '_';
      });
      const filePath = `${_user.id}/${safeExtId}_${Date.now()}${fileExt}`;

      // 确保 bucket 存在
      try {
        await _supabase.storage.from('extensions').list('', { limit: 1 });
      } catch (bucketErr) {
        console.warn('[publishExtension] bucket 检查失败，尝试创建:', bucketErr.message);
      }

      const { error } = await _supabase.storage.from('extensions').upload(filePath, blob, {
        contentType,
        upsert: false,
        cacheControl: '0',
      });
      if (error) {
        console.error('[publishExtension] 上传失败:', error.message);
        return { error: { message: '文件上传失败: ' + error.message + '。请检查 Supabase storage bucket "extensions" 是否已创建。' } };
      }
      const { data: urlData } = _supabase.storage.from('extensions').getPublicUrl(filePath);
      fileUrl = urlData.publicUrl;
    }

    // 使用 upsert 避免 ext_id 重复键错误（自动覆盖同 ext_id 的记录）
    const { data, error } = await _supabase.from('extensions').upsert({
      author_id: _user.id, name, ext_id: extId,
      description: description || '', version: version || '1.0.0',
      file_url: fileUrl,
    }, { onConflict: 'ext_id' }).select().single();
    return { data, error };
  }

  async function updateExtension(id, updates, fileContent) {
    if (!_user) return { error: 'Not logged in' };

    if (fileContent) {
      let blob, fileExt, contentType;
      if (typeof fileContent === 'string') {
        blob = new Blob([fileContent], { type: 'application/json' });
        fileExt = '.json';
        contentType = 'application/json';
      } else if (fileContent instanceof Blob) {
        blob = fileContent;
        const isJs = fileContent.name && fileContent.name.endsWith('.js');
        fileExt = isJs ? '.js' : '.json';
        contentType = isJs ? 'application/javascript' : 'application/json';
      } else {
        blob = new Blob([JSON.stringify(fileContent)], { type: 'application/json' });
        fileExt = '.json';
        contentType = 'application/json';
      }
      const filePath = `${_user.id}/${id}_${Date.now()}${fileExt}`;
      const { error } = await _supabase.storage.from('extensions').upload(filePath, blob, {
        contentType,
        upsert: true,
        cacheControl: '0',
      });
      if (!error) {
        const { data: urlData } = _supabase.storage.from('extensions').getPublicUrl(filePath);
        updates.file_url = urlData.publicUrl;
      }
    }

    const { data, error } = await _supabase
      .from('extensions').update(updates).eq('id', id).eq('author_id', _user.id).select().single();
    return { data, error };
  }

  async function getUserExtensionByName(userId, name) {
    if (!_supabase) return null;
    const { data } = await _supabase
      .from('extensions')
      .select('id, name, ext_id, description, version')
      .eq('author_id', userId)
      .eq('name', name)
      .limit(1);
    return (data && data.length > 0) ? data[0] : null;
  }

  async function deleteExtension(id) {
    if (!_user) return { error: 'Not logged in' };
    return await _supabase.from('extensions').delete().eq('id', id).eq('author_id', _user.id);
  }

  // ============================================================
  // Likes 点赞
  // ============================================================

  async function toggleLike(targetType, targetId) {
    if (!_user) return { error: 'Not logged in' };
    // Check if already liked
    const { data: existing } = await _supabase
      .from('likes')
      .select('id')
      .eq('user_id', _user.id)
      .eq('target_type', targetType)
      .eq('target_id', targetId)
      .single();

    if (existing) {
      await _supabase.from('likes').delete().eq('id', existing.id);
      return { liked: false };
    } else {
      await _supabase.from('likes').insert({
        user_id: _user.id, target_type: targetType, target_id: targetId
      });
      return { liked: true };
    }
  }

  async function isLiked(targetType, targetId) {
    if (!_user || !_supabase) return false;
    const { data } = await _supabase
      .from('likes')
      .select('id')
      .eq('user_id', _user.id)
      .eq('target_type', targetType)
      .eq('target_id', targetId)
      .single();
    return !!data;
  }

  // ============================================================
  // Favorites 收藏
  // ============================================================

  async function toggleFavorite(targetType, targetId) {
    if (!_user) return { error: 'Not logged in' };
    const { data: existing } = await _supabase
      .from('favorites')
      .select('target_id')
      .eq('user_id', _user.id)
      .eq('target_type', targetType)
      .eq('target_id', targetId)
      .single();

    if (existing) {
      await _supabase.from('favorites')
        .delete()
        .eq('user_id', _user.id)
        .eq('target_type', targetType)
        .eq('target_id', targetId);
      return { favorited: false };
    } else {
      await _supabase.from('favorites').insert({
        user_id: _user.id, target_type: targetType, target_id: targetId
      });
      return { favorited: true };
    }
  }

  // ============================================================
  // Follows 关注
  // ============================================================

  async function toggleFollow(userId) {
    if (!_user) return { error: 'Not logged in' };
    if (userId === _user.id) return { error: 'Cannot follow yourself' };
    const { data: existing } = await _supabase
      .from('follows')
      .select('follower_id')
      .eq('follower_id', _user.id)
      .eq('following_id', userId)
      .single();

    if (existing) {
      await _supabase.from('follows')
        .delete()
        .eq('follower_id', _user.id)
        .eq('following_id', userId);
      return { following: false };
    } else {
      await _supabase.from('follows').insert({
        follower_id: _user.id, following_id: userId
      });
      return { following: true };
    }
  }

  async function isFollowing(userId) {
    if (!_user || !_supabase) return false;
    const { data } = await _supabase
      .from('follows')
      .select('follower_id')
      .eq('follower_id', _user.id)
      .eq('following_id', userId)
      .single();
    return !!data;
  }

  async function getFollowers(userId) {
    if (!_supabase) return [];
    const { data } = await _supabase
      .from('follows')
      .select('profiles!follows_follower_id_fkey(id, username, avatar_url)')
      .eq('following_id', userId);
    return (data || []).map(d => d.profiles);
  }

  async function getFollowing(userId) {
    if (!_supabase) return [];
    const { data } = await _supabase
      .from('follows')
      .select('profiles!follows_following_id_fkey(id, username, avatar_url)')
      .eq('follower_id', userId);
    return (data || []).map(d => d.profiles);
  }

  // ============================================================
  // Profile 用户主页数据
  // ============================================================

  async function getUserProjects(userId) {
    if (!_supabase) return { data: [] };
    const { data } = await _supabase
      .from('projects')
      .select('*')
      .eq('author_id', userId)
      .eq('is_public', true)
      .order('created_at', { ascending: false });
    return { data: data || [] };
  }

  async function getUserPosts(userId) {
    if (!_supabase) return { data: [] };
    const { data } = await _supabase
      .from('posts')
      .select('*')
      .eq('author_id', userId)
      .order('created_at', { ascending: false });
    return { data: data || [] };
  }

  async function getUserExtensions(userId) {
    if (!_supabase) return { data: [] };
    const { data } = await _supabase
      .from('extensions')
      .select('*')
      .eq('author_id', userId)
      .order('created_at', { ascending: false });
    return { data: data || [] };
  }

  async function getUserFavorites(userId, targetType) {
    if (!_supabase) return { data: [] };
    let query = _supabase.from('favorites').select('*, projects(*), posts(*), extensions(*)').eq('user_id', userId);
    if (targetType) query = query.eq('target_type', targetType);
    const { data } = await query;
    return { data: data || [] };
  }

  async function getProfileById(userId) {
    if (!_supabase) return { data: null };
    const { data } = await _supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    return { data };
  }

  // ============================================================
  // Binding Codes - Software Account Binding
  // ============================================================

  /** Generate a random 6-digit binding code for the current user */
  async function generateBindingCode() {
    if (!_user) return { error: 'Not logged in' };
    if (!_supabase) return { error: 'Not initialized' };

    // Delete old codes from this user
    await _supabase.from('binding_codes').delete().eq('user_id', _user.id);

    // Generate 6-digit code
    var code = String(Math.floor(100000 + Math.random() * 900000));

    // Expires in 5 minutes
    var expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

    var profile = _profile || await loadProfile();
    var username = profile ? profile.username : (_user.email || 'Unknown');

    const { data, error } = await _supabase.from('binding_codes').insert({
      user_id: _user.id,
      code: code,
      expires_at: expiresAt,
      username: username,
    }).select().single();

    if (error) return { error };
    return { data: { code: code, expires_at: expiresAt, username: username } };
  }

  /** Verify a binding code and return user info if valid */
  async function verifyBindingCode(code) {
    if (!_supabase) return { error: 'Not initialized' };
    if (!code || code.length !== 6) return { error: 'Invalid code format' };

    const { data, error } = await _supabase
      .from('binding_codes')
      .select('*, profiles(username, avatar_url)')
      .eq('code', code)
      .single();

    if (error || !data) return { error: 'Code not found or invalid' };

    // Check expiry
    if (new Date(data.expires_at) < new Date()) {
      return { error: 'Code expired' };
    }

    // Delete the used code
    await _supabase.from('binding_codes').delete().eq('id', data.id);

    return {
      data: {
        user_id: data.user_id,
        username: data.profiles ? data.profiles.username : (data.username || 'Unknown'),
        email: data.user_id,
      }
    };
  }

  // ============================================================
  // Utility
  // ============================================================

  function formatTime(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    const now = new Date();
    const diff = (now - d) / 1000;
    if (diff < 60) return '刚刚';
    if (diff < 3600) return Math.floor(diff / 60) + ' 分钟前';
    if (diff < 86400) return Math.floor(diff / 3600) + ' 小时前';
    if (diff < 604800) return Math.floor(diff / 86400) + ' 天前';
    return d.toLocaleDateString('zh-CN');
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  function getParams() {
    return Object.fromEntries(new URLSearchParams(window.location.search));
  }

  // Aliases for pages
  async function likeTarget(targetType, targetId) { return toggleLike(targetType, targetId); }
  async function unlikeTarget(targetType, targetId) { return toggleLike(targetType, targetId); }
  async function followUser(userId) { return toggleFollow(userId); }
  async function unfollowUser(userId) { return toggleFollow(userId); }
  async function getFavorites(targetType) { return getUserFavorites(_user ? _user.id : null, targetType); }

  return {
    init, isConfigured, restoreSession,
    signUp, signIn, signOut, getCurrentUser, loadProfile, getProfile, getUser, updateProfile,
    getProjects, getProject, getProjectById: getProject, publishProject, deleteProject, updateProject, getUserProjectByTitle, incrementDownloads,
    getPosts, getPost, getPostById: getPost, createPost, updatePost, deletePost,
    getComments, addComment, deleteComment,
    getExtensions, getExtension, getExtensionById: getExtension, publishExtension, deleteExtension, updateExtension, getUserExtensionByName,
    toggleLike, likeTarget, unlikeTarget, isLiked,
    toggleFavorite, toggleFollow, followUser, unfollowUser, isFollowing, getFollowers, getFollowing,
    getFavorites,
    getUserProjects, getUserPosts, getUserExtensions, getUserFavorites, getProfileById,
    formatTime, escapeHtml, getParams,
    generateBindingCode, verifyBindingCode,
    sendLoginOtp, verifyLoginOtp, recordLogin,
    deleteAccount,
    PAGE_SIZE,
  };
})();
