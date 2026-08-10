-- Objector Community Database Setup
-- Run this SQL in Supabase Dashboard -> SQL Editor
-- 此脚本是幂等的，可安全重复执行

-- ============================================================
-- 1. Tables
-- ============================================================

-- 用户资料
create table if not exists profiles (
  id uuid references auth.users on delete cascade primary key,
  username text unique not null,
  avatar_url text,
  bio text default '',
  created_at timestamptz default now()
);

-- 作品分享
create table if not exists projects (
  id bigint generated always as identity primary key,
  author_id uuid references profiles(id) on delete cascade not null,
  title text not null,
  description text default '',
  thumbnail_url text,
  zip_url text,
  json_data text,
  render_mode text default '2d',
  likes_count int default 0,
  downloads_count int default 0,
  is_public boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 讨论帖子
create table if not exists posts (
  id bigint generated always as identity primary key,
  author_id uuid references profiles(id) on delete cascade not null,
  title text not null,
  content text not null,
  category text default 'general',
  likes_count int default 0,
  comments_count int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 评论（通用：可关联作品、帖子、扩展）
create table if not exists comments (
  id bigint generated always as identity primary key,
  author_id uuid references profiles(id) on delete cascade not null,
  target_type text not null check (target_type in ('project', 'post', 'extension')),
  target_id bigint not null,
  content text not null,
  created_at timestamptz default now()
);

-- 扩展市场
create table if not exists extensions (
  id bigint generated always as identity primary key,
  author_id uuid references profiles(id) on delete cascade not null,
  name text not null,
  ext_id text unique not null,
  description text default '',
  version text default '1.0.0',
  file_url text,
  block_count int default 0,
  downloads_count int default 0,
  likes_count int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 点赞（通用：作品/帖子/扩展）
create table if not exists likes (
  id bigint generated always as identity primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  target_type text not null check (target_type in ('project', 'post', 'extension')),
  target_id bigint not null,
  created_at timestamptz default now(),
  unique(user_id, target_type, target_id)
);

-- 关注
create table if not exists follows (
  follower_id uuid references profiles(id) on delete cascade not null,
  following_id uuid references profiles(id) on delete cascade not null,
  created_at timestamptz default now(),
  primary key(follower_id, following_id)
);

-- 收藏
create table if not exists favorites (
  user_id uuid references profiles(id) on delete cascade not null,
  target_type text not null check (target_type in ('project', 'post', 'extension')),
  target_id bigint not null,
  created_at timestamptz default now(),
  primary key(user_id, target_type, target_id)
);

-- 软件绑定码（用于桌面软件绑定社区账号）
create table if not exists binding_codes (
  id bigint generated always as identity primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  code text not null,
  username text default '',
  expires_at timestamptz not null,
  created_at timestamptz default now()
);

-- 登录日志（记录每次登录，可触发通知邮件）
create table if not exists login_logs (
  id bigint generated always as identity primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  login_at timestamptz default now(),
  user_agent text default '',
  ip_address inet
);

-- ============================================================
-- 2. Indexes
-- ============================================================

create index if not exists idx_projects_author on projects(author_id);
create index if not exists idx_projects_likes on projects(likes_count desc);
create index if not exists idx_projects_created on projects(created_at desc);
create index if not exists idx_posts_author on posts(author_id);
create index if not exists idx_posts_category on posts(category);
create index if not exists idx_posts_created on posts(created_at desc);
create index if not exists idx_comments_target on comments(target_type, target_id);
create index if not exists idx_extensions_author on extensions(author_id);
create index if not exists idx_extensions_ext_id on extensions(ext_id);
create index if not exists idx_likes_target on likes(target_type, target_id);
create index if not exists idx_likes_user on likes(user_id);
create index if not exists idx_follows_follower on follows(follower_id);
create index if not exists idx_follows_following on follows(following_id);
create index if not exists idx_favorites_user on favorites(user_id);
create index if not exists idx_binding_codes_code on binding_codes(code);
create index if not exists idx_binding_codes_user on binding_codes(user_id);
create index if not exists idx_login_logs_user on login_logs(user_id);
create index if not exists idx_login_logs_time on login_logs(login_at desc);

-- ============================================================
-- 3. Row Level Security (RLS)
-- ============================================================

alter table profiles enable row level security;
alter table projects enable row level security;
alter table posts enable row level security;
alter table comments enable row level security;
alter table extensions enable row level security;
alter table likes enable row level security;
alter table follows enable row level security;
alter table favorites enable row level security;
alter table binding_codes enable row level security;
alter table login_logs enable row level security;

-- Profiles: anyone can read, only owner can update
drop policy if exists "Profiles are viewable by everyone" on profiles;
create policy "Profiles are viewable by everyone" on profiles for select using (true);
drop policy if exists "Users can update own profile" on profiles;
create policy "Users can update own profile" on profiles for update using (auth.uid() = id);
drop policy if exists "Users can insert own profile" on profiles;
create policy "Users can insert own profile" on profiles for insert with check (auth.uid() = id);

-- Projects: anyone can read public, owner can CRUD
drop policy if exists "Public projects are viewable by everyone" on projects;
create policy "Public projects are viewable by everyone" on projects for select using (is_public = true or auth.uid() = author_id);
drop policy if exists "Users can create projects" on projects;
create policy "Users can create projects" on projects for insert with check (auth.uid() = author_id);
drop policy if exists "Users can update own projects" on projects;
create policy "Users can update own projects" on projects for update using (auth.uid() = author_id);
drop policy if exists "Users can delete own projects" on projects;
create policy "Users can delete own projects" on projects for delete using (auth.uid() = author_id);

-- Posts: anyone can read, owner can CRUD
drop policy if exists "Posts are viewable by everyone" on posts;
create policy "Posts are viewable by everyone" on posts for select using (true);
drop policy if exists "Users can create posts" on posts;
create policy "Users can create posts" on posts for insert with check (auth.uid() = author_id);
drop policy if exists "Users can update own posts" on posts;
create policy "Users can update own posts" on posts for update using (auth.uid() = author_id);
drop policy if exists "Users can delete own posts" on posts;
create policy "Users can delete own posts" on posts for delete using (auth.uid() = author_id);

-- Comments: anyone can read, owner can CRUD
drop policy if exists "Comments are viewable by everyone" on comments;
create policy "Comments are viewable by everyone" on comments for select using (true);
drop policy if exists "Users can create comments" on comments;
create policy "Users can create comments" on comments for insert with check (auth.uid() = author_id);
drop policy if exists "Users can update own comments" on comments;
create policy "Users can update own comments" on comments for update using (auth.uid() = author_id);
drop policy if exists "Users can delete own comments" on comments;
create policy "Users can delete own comments" on comments for delete using (auth.uid() = author_id);

-- Extensions: anyone can read, owner can CRUD
drop policy if exists "Extensions are viewable by everyone" on extensions;
create policy "Extensions are viewable by everyone" on extensions for select using (true);
drop policy if exists "Users can create extensions" on extensions;
create policy "Users can create extensions" on extensions for insert with check (auth.uid() = author_id);
drop policy if exists "Users can update own extensions" on extensions;
create policy "Users can update own extensions" on extensions for update using (auth.uid() = author_id);
drop policy if exists "Users can delete own extensions" on extensions;
create policy "Users can delete own extensions" on extensions for delete using (auth.uid() = author_id);

-- Likes: anyone can read, owner can CRUD
drop policy if exists "Likes are viewable by everyone" on likes;
create policy "Likes are viewable by everyone" on likes for select using (true);
drop policy if exists "Users can create likes" on likes;
create policy "Users can create likes" on likes for insert with check (auth.uid() = user_id);
drop policy if exists "Users can delete own likes" on likes;
create policy "Users can delete own likes" on likes for delete using (auth.uid() = user_id);

-- Follows: anyone can read, owner can CRUD
drop policy if exists "Follows are viewable by everyone" on follows;
create policy "Follows are viewable by everyone" on follows for select using (true);
drop policy if exists "Users can create follows" on follows;
create policy "Users can create follows" on follows for insert with check (auth.uid() = follower_id);
drop policy if exists "Users can delete own follows" on follows;
create policy "Users can delete own follows" on follows for delete using (auth.uid() = follower_id);

-- Favorites: anyone can read, owner can CRUD
drop policy if exists "Favorites are viewable by everyone" on favorites;
create policy "Favorites are viewable by everyone" on favorites for select using (true);
drop policy if exists "Users can create favorites" on favorites;
create policy "Users can create favorites" on favorites for insert with check (auth.uid() = user_id);
drop policy if exists "Users can delete own favorites" on favorites;
create policy "Users can delete own favorites" on favorites for delete using (auth.uid() = user_id);

-- Binding Codes: anyone can read (for verification), owner can CRUD
drop policy if exists "Binding codes are readable by anyone" on binding_codes;
create policy "Binding codes are readable by anyone" on binding_codes for select using (true);
drop policy if exists "Users can create own binding codes" on binding_codes;
create policy "Users can create own binding codes" on binding_codes for insert with check (auth.uid() = user_id);
drop policy if exists "Users can delete own binding codes" on binding_codes;
create policy "Users can delete own binding codes" on binding_codes for delete using (auth.uid() = user_id);

-- Login Logs: owner can insert and read own logs
drop policy if exists "Users can insert own login logs" on login_logs;
create policy "Users can insert own login logs" on login_logs for insert with check (auth.uid() = user_id);
drop policy if exists "Users can read own login logs" on login_logs;
create policy "Users can read own login logs" on login_logs for select using (auth.uid() = user_id);

-- ============================================================
-- 4. Triggers: auto-create profile on signup, update counts
-- ============================================================

-- Auto-create profile when a new user signs up
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, username, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

-- 先删除旧 trigger 再创建（幂等）
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- 4b. 注销账户 RPC 函数（删除用户及其所有数据）
-- ============================================================

create or replace function public.delete_user_account(target_user_id uuid)
returns boolean as $$
begin
  -- 验证调用者是否是本人
  if auth.uid() <> target_user_id then
    raise exception 'Permission denied';
  end if;
  -- 删除所有关联数据（通过 ON DELETE CASCADE 自动删除）
  delete from public.profiles where id = target_user_id;
  return true;
end;
$$ language plpgsql security definer;

-- ============================================================
-- 4c. 登录通知邮件触发器（可选：需要配置 Supabase Edge Function）
-- ============================================================
-- 方法1：使用 Supabase 内置的 Inbucket（开发环境）
-- 方法2：部署 Edge Function 调用 Resend/SendGrid 等邮件服务
--
-- 部署 Edge Function 的步骤：
-- 1. 安装 Supabase CLI: npm install -g supabase
-- 2. 创建 Edge Function:
--    supabase functions new login-notification
-- 3. 编写函数（supabase/functions/login-notification/index.ts）:
--    import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
--    import { Resend } from "npm:resend@2.0.0"
--    serve(async (req) => {
--      const { user_id, email, login_at } = await req.json()
--      const resend = new Resend(Deno.env.get('RESEND_API_KEY'))
--      await resend.emails.send({
--        from: 'Objector <noreply@yourdomain.com>',
--        to: email,
--        subject: '登录通知 - Objector Community',
--        html: `<p>你好！</p><p>你的账号在 ${login_at} 成功登录。</p><p>如果不是你的操作，请立即修改密码。</p>`
--      })
--      return new Response(JSON.stringify({ success: true }))
--    })
-- 4. 部署: supabase functions deploy login-notification
-- 5. 设置环境变量: supabase secrets set RESEND_API_KEY=re_xxx
--
-- 触发器（调用 Edge Function）：
-- create or replace function public.notify_login()
-- returns trigger as $$
-- begin
--   perform net.http_post(
--     url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/login-notification',
--     body := jsonb_build_object('user_id', new.user_id, 'email', (select email from auth.users where id = new.user_id), 'login_at', new.login_at),
--     headers := jsonb_build_object('Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY', 'Content-Type', 'application/json')
--   );
--   return new;
-- end;
-- $$ language plpgsql security definer;
--
-- create trigger on_login
--   after insert on login_logs
--   for each row execute procedure public.notify_login();

-- Like triggers: update likes_count on target
create or replace function public.handle_like_change()
returns trigger as $$
begin
  if tg_op = 'INSERT' then
    if new.target_type = 'project' then
      update projects set likes_count = likes_count + 1 where id = new.target_id;
    elsif new.target_type = 'post' then
      update posts set likes_count = likes_count + 1 where id = new.target_id;
    elsif new.target_type = 'extension' then
      update extensions set likes_count = likes_count + 1 where id = new.target_id;
    end if;
    return new;
  elsif tg_op = 'DELETE' then
    if old.target_type = 'project' then
      update projects set likes_count = likes_count - 1 where id = old.target_id;
    elsif old.target_type = 'post' then
      update posts set likes_count = likes_count - 1 where id = old.target_id;
    elsif old.target_type = 'extension' then
      update extensions set likes_count = likes_count - 1 where id = old.target_id;
    end if;
    return old;
  end if;
end;
$$ language plpgsql security definer;

drop trigger if exists on_like_change on likes;
create trigger on_like_change
  after insert or delete on likes
  for each row execute procedure public.handle_like_change();

-- Comment trigger: update comments_count
create or replace function public.handle_comment_change()
returns trigger as $$
begin
  if tg_op = 'INSERT' then
    if new.target_type = 'project' then
      -- no comments_count on projects table (optional)
    elsif new.target_type = 'post' then
      update posts set comments_count = comments_count + 1 where id = new.target_id;
    elsif new.target_type = 'extension' then
      -- no comments_count on extensions table (optional)
    end if;
    return new;
  elsif tg_op = 'DELETE' then
    if old.target_type = 'post' then
      update posts set comments_count = comments_count - 1 where id = old.target_id;
    elsif old.target_type = 'extension' then
      -- no comments_count on extensions table (optional)
    end if;
    return old;
  end if;
end;
$$ language plpgsql security definer;

drop trigger if exists on_comment_change on comments;
create trigger on_comment_change
  after insert or delete on comments
  for each row execute procedure public.handle_comment_change();

-- ============================================================
-- 5. Storage Buckets
-- ============================================================
-- 在 Supabase Dashboard -> Storage 中手动创建以下 3 个 public bucket：
--   projects   (用于作品缩略图和 ZIP)
--   extensions (用于扩展文件 .json/.js)
--   avatars    (用于用户头像)
--
-- 或通过以下 SQL 创建（在 SQL Editor 中执行）：
insert into storage.buckets (id, name, public) values ('projects', 'projects', true) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('extensions', 'extensions', true) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true) on conflict (id) do nothing;
--
-- Storage policies (allow authenticated users to upload, anyone to read):
-- projects bucket:
--   SELECT: anyone
--   INSERT/UPDATE/DELETE: authenticated users only
-- extensions bucket: same
-- avatars bucket: same

-- ============================================================
-- 6. 增量：posts 表添加 category CHECK 约束（支持 learn 分类）
-- ============================================================
-- 如果 category 列已有 CHECK 约束，需要先删除再重建
do $$
begin
  -- 尝试删除旧的 category check 约束（可能叫不同名字）
  begin
    alter table posts drop constraint if exists posts_category_check;
  exception when others then null;
  end;
  -- 添加包含 learn 的新约束
  begin
    alter table posts add constraint posts_category_check
      check (category in ('general','question','tutorial','showcase','learn'));
  exception when others then null;
  end;
end $$;

-- ============================================================
-- 7. 增量：comments 表添加 target_type CHECK 约束（支持 extension）
-- ============================================================
-- 如果 target_type 列已有 CHECK 约束，需要先删除再重建
do $$
begin
  begin
    alter table comments drop constraint if exists comments_target_type_check;
  exception when others then null;
  end;
  begin
    alter table comments add constraint comments_target_type_check
      check (target_type in ('project', 'post', 'extension'));
  exception when others then null;
  end;
end $$;

-- ============================================================
-- 8. 增量：projects 表添加 render_mode 列
-- ============================================================
alter table projects add column if not exists render_mode text default '2d';
