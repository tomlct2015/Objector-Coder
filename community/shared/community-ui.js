/**
 * Objector Community UI - 通用 UI 组件
 * 依赖: CommunityAPI
 */
const CommunityUI = (function () {
  const API = CommunityAPI;

  // ============================================================
  // Navigation 导航栏
  // ============================================================

  function renderNav(containerId, basePath) {
    const container = document.getElementById(containerId || 'nav');
    if (!container) return;
    const base = basePath || '';
    const user = API.getUser();
    const profile = API.getProfile();

    container.innerHTML = `
      <div class="nav-inner">
        <a href="${base}index.html" class="nav-logo">⚡ Objector 社区</a>
        <div class="nav-links">
          <a href="${base}index.html" class="nav-link ${isPage('community/index') || (!isPage('projects') && !isPage('posts') && !isPage('extensions') && !isPage('learn') && isPage('index')) ? 'active' : ''}">首页</a>
          <a href="${base}projects.html" class="nav-link ${isPage('projects') || isPage('project-detail') ? 'active' : ''}">作品</a>
          <a href="${base}posts.html" class="nav-link ${isPage('posts') || (isPage('post-detail') && !isPage('learn')) || isPage('post-new') ? 'active' : ''}">讨论</a>
          <a href="${base}extensions.html" class="nav-link ${isPage('extensions') || isPage('extension-detail') ? 'active' : ''}">扩展</a>
          <a href="${base}learn/index.html" class="nav-link ${isPage('learn') ? 'active' : ''}">📖 学习</a>
          <a href="https://tomlct2015.github.io/Objector-Coder/editor" class="nav-link">去创作</a>
        </div>
        <div class="nav-actions">
          ${user ? `
            <span class="nav-user" onclick="window.location.href='${base}profile.html?id=${user.id}'">
              <span class="nav-avatar">${(profile?.username || 'U')[0].toUpperCase()}</span>
              <span class="nav-username">${API.escapeHtml(profile?.username || 'User')}</span>
            </span>
            <button class="nav-btn nav-btn-ghost" id="btn-logout">退出</button>
          ` : `
            <a href="${base}login.html" class="nav-btn nav-btn-primary">登录 / 注册</a>
          `}
        </div>
      </div>
    `;

    // Bind logout
    container.querySelector('#btn-logout')?.addEventListener('click', async () => {
      await API.signOut();
      window.location.href = 'index.html';
    });
  }

  function isPage(name) {
    return window.location.pathname.includes(name);
  }

  // ============================================================
  // Cards 卡片
  // ============================================================

  function renderProjectCard(project) {
    const author = project.profiles || {};
    return `
      <a href="project-detail.html?id=${project.id}" class="card project-card">
        <div class="card-thumb">
          ${project.thumbnail_url
            ? `<img src="${project.thumbnail_url}" alt="" loading="lazy" />`
            : '<div class="card-thumb-placeholder">🎮</div>'}
        </div>
        <div class="card-body">
          <div class="card-title">${API.escapeHtml(project.title)}</div>
          <div class="card-meta">
            <span class="card-author">${API.escapeHtml(author.username || '匿名')}</span>
            <span class="card-stats">
              <span>❤ ${project.likes_count || 0}</span>
              <span>⬇ ${project.downloads_count || 0}</span>
            </span>
          </div>
        </div>
      </a>
    `;
  }

  function renderPostCard(post) {
    const author = post.profiles || {};
    const categoryLabels = { general: '综合', question: '提问', tutorial: '教程', showcase: '展示' };
    const categoryColors = { general: '#89b4fa', question: '#f9e2af', tutorial: '#a6e3a1', showcase: '#f38ba8' };
    return `
      <a href="post-detail.html?id=${post.id}" class="card post-card">
        <div class="card-body">
          <div class="card-top-row">
            <span class="card-category" style="background:${categoryColors[post.category] || categoryColors.general}">${categoryLabels[post.category] || '综合'}</span>
            <span class="card-time">${API.formatTime(post.created_at)}</span>
          </div>
          <div class="card-title">${API.escapeHtml(post.title)}</div>
          <div class="card-preview">${API.escapeHtml((post.content || '').slice(0, 100))}${(post.content || '').length > 100 ? '...' : ''}</div>
          <div class="card-meta">
            <span class="card-author">${API.escapeHtml(author.username || '匿名')}</span>
            <span class="card-stats">
              <span>❤ ${post.likes_count || 0}</span>
              <span>💬 ${post.comments_count || 0}</span>
            </span>
          </div>
        </div>
      </a>
    `;
  }

  function renderArticleCard(post, linkBase) {
    const author = post.profiles || {};
    const base = linkBase || '';
    return `
      <a href="${base}article.html?id=${post.id}" class="card article-card">
        <div class="card-body">
          <div class="card-top-row">
            <span class="card-category" style="background:#cba6f7">📖 学习</span>
            <span class="card-time">${API.formatTime(post.created_at)}</span>
          </div>
          <div class="card-title">${API.escapeHtml(post.title)}</div>
          <div class="card-preview">${API.escapeHtml((post.content || '').slice(0, 150))}${(post.content || '').length > 150 ? '...' : ''}</div>
          <div class="card-meta">
            <span class="card-author">${API.escapeHtml(author.username || '匿名')}</span>
            <span class="card-stats">
              <span>❤ ${post.likes_count || 0}</span>
              <span>💬 ${post.comments_count || 0}</span>
            </span>
          </div>
        </div>
      </a>
    `;
  }

  function renderExtensionCard(ext) {
    const author = ext.profiles || {};
    return `
      <a href="extension-detail.html?id=${ext.id}" class="card extension-card">
        <div class="card-body">
          <div class="card-title">🧩 ${API.escapeHtml(ext.name)}</div>
          <div class="card-desc">${API.escapeHtml(ext.description || '暂无描述')}</div>
          <div class="card-meta">
            <span class="card-author">${API.escapeHtml(author.username || '匿名')}</span>
            <span class="card-stats">
              <span>v${API.escapeHtml(ext.version || '1.0.0')}</span>
              <span>⬇ ${ext.downloads_count || 0}</span>
            </span>
          </div>
        </div>
      </a>
    `;
  }

  // ============================================================
  // Comments 评论
  // ============================================================

  function renderCommentList(comments) {
    if (!comments || comments.length === 0) {
      return '<div class="empty-hint">暂无评论</div>';
    }
    return comments.map(c => {
      const author = c.profiles || {};
      return `
        <div class="comment-item">
          <div class="comment-header">
            <a href="profile.html?id=${c.author_id}" class="comment-author">${API.escapeHtml(author.username || '匿名')}</a>
            <span class="comment-time">${API.formatTime(c.created_at)}</span>
          </div>
          <div class="comment-content">${API.escapeHtml(c.content)}</div>
        </div>
      `;
    }).join('');
  }

  function renderCommentForm(targetType, targetId, onAdded) {
    const user = API.getUser();
    if (!user) {
      return '<div class="comment-form-locked"><a href="login.html">登录</a>后才能评论</div>';
    }
    const formId = `comment-form-${targetType}-${targetId}`;
    return `
      <div class="comment-form" id="${formId}">
        <textarea class="comment-input" placeholder="写下你的评论..." rows="3"></textarea>
        <button class="btn btn-primary btn-sm comment-submit">发表评论</button>
      </div>
    `;
  }

  function bindCommentForm(targetType, targetId, containerSelector, onAdded) {
    const container = document.querySelector(containerSelector);
    if (!container) return;
    const btn = container.querySelector('.comment-submit');
    const input = container.querySelector('.comment-input');
    if (!btn || !input) return;

    btn.addEventListener('click', async () => {
      const content = input.value.trim();
      if (!content) return;
      btn.disabled = true;
      btn.textContent = '发送中...';
      const { error } = await API.addComment(targetType, targetId, content);
      btn.disabled = false;
      btn.textContent = '发表评论';
      if (error) {
        alert('评论失败: ' + error.message);
      } else {
        input.value = '';
        if (onAdded) onAdded();
      }
    });
  }

  // ============================================================
  // Pagination 分页
  // ============================================================

  function renderPagination(containerOrCurrentPage, currentPageOrTotal, pageSizeOrCallback, callback) {
    // 支持两种调用方式:
    // 旧: renderPagination(currentPage, totalCount, pageSize) => 返回 HTML 字符串
    // 新: renderPagination('container-id', currentPage, total, callback)
    let container, currentPage, totalCount, onPageChange;

    if (typeof containerOrCurrentPage === 'string' && document.getElementById(containerOrCurrentPage)) {
      // 新方式: renderPagination('container-id', currentPage, total, callback)
      container = document.getElementById(containerOrCurrentPage);
      currentPage = currentPageOrTotal;
      totalCount = pageSizeOrCallback;
      onPageChange = callback;
    } else {
      // 旧方式: renderPagination(currentPage, totalCount, pageSize) => 返回 HTML
      return _renderPaginationHtml(containerOrCurrentPage, currentPageOrTotal, pageSizeOrCallback);
    }

    if (!container) return;
    const pageSize = CommunityAPI.PAGE_SIZE || 12;
    const html = _renderPaginationHtml(currentPage, totalCount, pageSize);
    container.innerHTML = html;

    if (onPageChange) {
      container.querySelectorAll('.page-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          const page = parseInt(btn.dataset.page);
          if (page && page !== currentPage) {
            onPageChange(page);
          }
        });
      });
    }
  }

  function _renderPaginationHtml(currentPage, totalCount, pageSize) {
    const totalPages = Math.ceil(totalCount / pageSize);
    if (totalPages <= 1) return '';

    let html = '<div class="pagination">';
    if (currentPage > 1) {
      html += `<a href="#" class="page-btn" data-page="${currentPage - 1}">&laquo; 上一页</a>`;
    }
    for (let i = 1; i <= totalPages && i <= 10; i++) {
      html += `<a href="#" class="page-btn ${i === currentPage ? 'active' : ''}" data-page="${i}">${i}</a>`;
    }
    if (currentPage < totalPages) {
      html += `<a href="#" class="page-btn" data-page="${currentPage + 1}">下一页 &raquo;</a>`;
    }
    html += '</div>';
    return html;
  }

  function extraParams() {
    const params = new URLSearchParams(window.location.search);
    let extra = '';
    for (const [key, val] of params) {
      if (key !== 'page') extra += `&${key}=${encodeURIComponent(val)}`;
    }
    return extra;
  }

  // ============================================================
  // Like Button 点赞按钮
  // ============================================================

  async function renderLikeButton(container, targetType, targetId, initialCount, initialLiked) {
    container.innerHTML = `
      <button class="like-btn ${initialLiked ? 'liked' : ''}" data-type="${targetType}" data-id="${targetId}">
        <span class="like-icon">❤</span>
        <span class="like-count">${initialCount || 0}</span>
      </button>
    `;
    const btn = container.querySelector('.like-btn');
    const countEl = container.querySelector('.like-count');
    let liked = initialLiked;
    let count = initialCount || 0;

    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (!API.getUser()) {
        window.location.href = 'login.html';
        return;
      }
      btn.disabled = true;
      const result = await API.toggleLike(targetType, targetId);
      btn.disabled = false;
      liked = result.liked;
      count += liked ? 1 : -1;
      btn.classList.toggle('liked', liked);
      countEl.textContent = count;
    });
  }

  // ============================================================
  // Empty State 空状态
  // ============================================================

  function renderEmpty(message, icon) {
    return `
      <div class="empty-state">
        <div class="empty-icon">${icon || '📭'}</div>
        <div class="empty-text">${message || '暂无内容'}</div>
      </div>
    `;
  }

  // ============================================================
  // Loading 加载状态
  // ============================================================

  function renderLoading() {
    return '<div class="loading-spinner"><div class="spinner"></div><div>加载中...</div></div>';
  }

  // ============================================================
  // Toast 提示
  // ============================================================

  function showToast(message, type) {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type || 'info'}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  return {
    renderNav, renderProjectCard, renderPostCard, renderArticleCard, renderExtensionCard,
    renderCommentList, renderCommentForm, bindCommentForm,
    renderPagination, renderLikeButton, renderEmpty, renderLoading, showToast,
  };
})();
