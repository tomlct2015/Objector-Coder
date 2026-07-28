-- Objector Community Database Setup
-- Run this SQL in Supabase Dashboard -> SQL Editor

-- ============================================================
-- 1. Tables
-- ============================================================

-- 用户资料
create table profiles (
  id uuid references auth.users on delete cascade primary key,
  username text unique not null,
  avatar_url text,
  bio text default '',
  created_at timestamptz default now()
);

-- 作品分享
create table projects (
  id bigint generated always as identity primary key,
  author_id uuid references profiles(id) on delete cascade not null,
  title text not null,
  description text default '',
  thumbnail_url text,
  zip_url text,
  json_data text,
  likes_count int default 0,
  downloads_count int default 0,
  is_public boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 讨论帖子
create table posts (
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

-- 评论（通用：可关联作品或帖子）
create table comments (
  id bigint generated always as identity primary key,
  author_id uuid references profiles(id) on delete cascade not null,
  target_type text not null check (target_type in ('project', 'post')),
  target_id bigint not null,
  content text not null,
  created_at timestamptz default now()
);

-- 扩展市场
create table extensions (
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
create table likes (
  id bigint generated always as identity primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  target_type text not null check (target_type in ('project', 'post', 'extension')),
  target_id bigint not null,
  created_at timestamptz default now(),
  unique(user_id, target_type, target_id)
);

-- 关注
create table follows (
  follower_id uuid references profiles(id) on delete cascade not null,
  following_id uuid references profiles(id) on delete cascade not null,
  created_at timestamptz default now(),
  primary key(follower_id, following_id)
);

-- 收藏
create table favorites (
  user_id uuid references profiles(id) on delete cascade not null,
  target_type text not null check (target_type in ('project', 'post', 'extension')),
  target_id bigint not null,
  created_at timestamptz default now(),
  primary key(user_id, target_type, target_id)
);

-- ============================================================
-- 2. Indexes
-- ============================================================

create index idx_projects_author on projects(author_id);
create index idx_projects_likes on projects(likes_count desc);
create index idx_projects_created on projects(created_at desc);
create index idx_posts_author on posts(author_id);
create index idx_posts_category on posts(category);
create index idx_posts_created on posts(created_at desc);
create index idx_comments_target on comments(target_type, target_id);
create index idx_extensions_author on extensions(author_id);
create index idx_extensions_ext_id on extensions(ext_id);
create index idx_likes_target on likes(target_type, target_id);
create index idx_likes_user on likes(user_id);
create index idx_follows_follower on follows(follower_id);
create index idx_follows_following on follows(following_id);
create index idx_favorites_user on favorites(user_id);

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

-- Profiles: anyone can read, only owner can update
create policy "Profiles are viewable by everyone" on profiles for select using (true);
create policy "Users can update own profile" on profiles for update using (auth.uid() = id);
create policy "Users can insert own profile" on profiles for insert with check (auth.uid() = id);

-- Projects: anyone can read public, owner can CRUD
create policy "Public projects are viewable by everyone" on projects for select using (is_public = true or auth.uid() = author_id);
create policy "Users can create projects" on projects for insert with check (auth.uid() = author_id);
create policy "Users can update own projects" on projects for update using (auth.uid() = author_id);
create policy "Users can delete own projects" on projects for delete using (auth.uid() = author_id);

-- Posts: anyone can read, owner can CRUD
create policy "Posts are viewable by everyone" on posts for select using (true);
create policy "Users can create posts" on posts for insert with check (auth.uid() = author_id);
create policy "Users can update own posts" on posts for update using (auth.uid() = author_id);
create policy "Users can delete own posts" on posts for delete using (auth.uid() = author_id);

-- Comments: anyone can read, owner can CRUD
create policy "Comments are viewable by everyone" on comments for select using (true);
create policy "Users can create comments" on comments for insert with check (auth.uid() = author_id);
create policy "Users can update own comments" on comments for update using (auth.uid() = author_id);
create policy "Users can delete own comments" on comments for delete using (auth.uid() = author_id);

-- Extensions: anyone can read, owner can CRUD
create policy "Extensions are viewable by everyone" on extensions for select using (true);
create policy "Users can create extensions" on extensions for insert with check (auth.uid() = author_id);
create policy "Users can update own extensions" on extensions for update using (auth.uid() = author_id);
create policy "Users can delete own extensions" on extensions for delete using (auth.uid() = author_id);

-- Likes: anyone can read, owner can CRUD
create policy "Likes are viewable by everyone" on likes for select using (true);
create policy "Users can create likes" on likes for insert with check (auth.uid() = user_id);
create policy "Users can delete own likes" on likes for delete using (auth.uid() = user_id);

-- Follows: anyone can read, owner can CRUD
create policy "Follows are viewable by everyone" on follows for select using (true);
create policy "Users can create follows" on follows for insert with check (auth.uid() = follower_id);
create policy "Users can delete own follows" on follows for delete using (auth.uid() = follower_id);

-- Favorites: anyone can read, owner can CRUD
create policy "Favorites are viewable by everyone" on favorites for select using (true);
create policy "Users can create favorites" on favorites for insert with check (auth.uid() = user_id);
create policy "Users can delete own favorites" on favorites for delete using (auth.uid() = user_id);

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
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

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
    end if;
    return new;
  elsif tg_op = 'DELETE' then
    if old.target_type = 'post' then
      update posts set comments_count = comments_count - 1 where id = old.target_id;
    end if;
    return old;
  end if;
end;
$$ language plpgsql security definer;

create trigger on_comment_change
  after insert or delete on comments
  for each row execute procedure public.handle_comment_change();

-- ============================================================
-- 5. Storage Buckets
-- ============================================================
-- Run these in Supabase Dashboard -> Storage, or use API:
-- insert into storage.buckets (id, name, public) values ('projects', 'projects', true);
-- insert into storage.buckets (id, name, public) values ('extensions', 'extensions', true);
-- insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true);
--
-- Storage policies (allow authenticated users to upload, anyone to read):
-- projects bucket:
--   SELECT: anyone
--   INSERT/UPDATE/DELETE: authenticated users only
-- extensions bucket: same
-- avatars bucket: same
