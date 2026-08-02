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
          <a href="${base}search-users.html" class="nav-link ${isPage('search-users') ? 'active' : ''}">🔍 查找用户</a>
        </div>
        <div class="nav-actions">
          <a href="${base}../editor/index.html" class="nav-btn nav-btn-accent">🚀 去创作</a>
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
  // User Card 用户卡片
  // ============================================================

  function renderUserCard(profile) {
    const initial = (profile.username || '?')[0].toUpperCase();
    const avatar = profile.avatar_url || `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 60 60'><rect fill='%23252545' width='60' height='60' rx='30'/><text fill='%2389b4fa' font-size='24' x='50%25' y='55%25' text-anchor='middle'>${initial}</text></svg>`;
    const bio = profile.bio ? API.escapeHtml(profile.bio.slice(0, 60)) + (profile.bio.length > 60 ? '...' : '') : '<span style="color:var(--muted,#6c7086)">暂无简介</span>';
    return `
      <a href="profile.html?id=${profile.id}" class="card user-card">
        <div class="user-card-inner">
          <img src="${avatar}" class="user-card-avatar" alt="${API.escapeHtml(profile.username)}" />
          <div class="user-card-info">
            <div class="user-card-name">${API.escapeHtml(profile.username)}</div>
            <div class="user-card-bio">${bio}</div>
            <div class="user-card-joined">加入于 ${new Date(profile.created_at).toLocaleDateString()}</div>
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
    return comments.map(c => renderCommentItem(c)).join('');
  }

  function renderCommentItem(c) {
    const author = c.profiles || {};
    const initial = (author.username || '?')[0].toUpperCase();
    const avatar = author.avatar_url || `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'><rect fill='%23252545' width='40' height='40' rx='20'/><text fill='%2389b4fa' font-size='16' x='50%25' y='55%25' text-anchor='middle'>${initial}</text></svg>`;
    return `
      <div class="comment-item">
        <div class="comment-header">
          <a href="profile.html?id=${c.author_id}" class="comment-author">
            <img src="${avatar}" class="comment-avatar" alt="${API.escapeHtml(author.username || '匿名')}" />
            <span>${API.escapeHtml(author.username || '匿名')}</span>
          </a>
          <span class="comment-time">${API.formatTime(c.created_at)}</span>
        </div>
        <div class="comment-content">${API.escapeHtml(c.content)}</div>
      </div>
    `;
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
  // Fill Cards with Load More 卡片加载更多
  // ============================================================

  /**
   * 渲染卡片列表，超过 pageSize 时隐藏多余卡片并显示“加载更多”按钮
   * @param {HTMLElement} container - 卡片容器（需有 card-grid 或 card-list 类）
   * @param {string[]} cardsHtml - 卡片 HTML 字符串数组
   * @param {number} [pageSize=5] - 每次显示的卡片数
   */
  function fillCards(container, cardsHtml, pageSize) {
    var size = pageSize || 5;
    if (!cardsHtml || cardsHtml.length === 0) return;
    var shown = Math.min(size, cardsHtml.length);
    var html = '';
    for (var i = 0; i < cardsHtml.length; i++) {
      html += '<div class="card-wrapper' + (i >= shown ? ' card-hidden' : '') + '">' + cardsHtml[i] + '</div>';
    }
    if (cardsHtml.length > shown) {
      html += '<div class="load-more-wrap"><button class="btn btn-outline load-more-btn">点击加载更多 (' + shown + '/' + cardsHtml.length + ')</button></div>';
    }
    container.innerHTML = html;

    // 绑定加载更多
    var btn = container.querySelector('.load-more-btn');
    if (btn) {
      btn.addEventListener('click', function () {
        var wrappers = container.querySelectorAll('.card-wrapper.card-hidden');
        var revealed = 0;
        for (var j = 0; j < wrappers.length && revealed < size; j++) {
          wrappers[j].classList.remove('card-hidden');
          revealed++;
        }
        var remaining = container.querySelectorAll('.card-wrapper.card-hidden').length;
        var totalVisible = container.querySelectorAll('.card-wrapper:not(.card-hidden)').length;
        if (remaining === 0) {
          btn.parentElement.style.display = 'none';
        } else {
          btn.textContent = '点击加载更多 (' + totalVisible + '/' + cardsHtml.length + ')';
        }
      });
    }
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
    renderNav, renderProjectCard, renderPostCard, renderArticleCard, renderExtensionCard, renderUserCard,
    renderCommentList, renderCommentItem, renderCommentForm, bindCommentForm,
    renderPagination, renderLikeButton, renderEmpty, renderLoading, showToast,
    fillCards,
  };
})();
