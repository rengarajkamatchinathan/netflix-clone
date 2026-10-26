-- StreamFlix schema. Safe to run repeatedly (npm run db:setup).

create table if not exists users (
  id serial primary key,
  email text not null unique,
  password_hash text not null,
  role text not null default 'user' check (role in ('user', 'admin')),
  disabled boolean not null default false,
  -- Bumped on password change/reset to sign out every other session.
  session_version int not null default 0,
  recovery_fails int not null default 0,
  recovery_locked_until timestamptz,
  created_at timestamptz not null default now(),
  last_login_at timestamptz
);

create table if not exists security_answers (
  user_id int not null references users(id) on delete cascade,
  slot smallint not null,
  question_key text not null,
  answer_hash text not null,
  primary key (user_id, slot)
);

create table if not exists avatars (
  id text primary key,
  url text not null,
  label text not null default '',
  category text not null default 'Classics',
  sort_order int not null default 0
);

create table if not exists profiles (
  id serial primary key,
  user_id int not null references users(id) on delete cascade,
  name text not null,
  avatar_id text references avatars(id) on delete set null,
  color text not null default '#e50914',
  is_kids boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists profiles_user_idx on profiles(user_id);

create table if not exists channels (
  id text primary key,
  name text not null,
  tagline text not null default '',
  sort_order int not null default 999,
  colors jsonb not null default '{}',
  bumpers jsonb not null default '[]',   -- YouTube links
  hidden boolean not null default false
);
-- Channel logo image, uploaded in the admin panel.
alter table channels add column if not exists logo bytea;
alter table channels add column if not exists logo_type text;
alter table channels add column if not exists logo_updated_at timestamptz;

create table if not exists titles (
  id text primary key,
  seq serial,
  name text not null,
  year int,
  type text not null default 'tv',
  genre text,
  synopsis text,
  category text,
  maturity text,
  image text,
  poster text,
  link text,
  videos jsonb not null default '[]',    -- [{ title, url }]
  needs_review boolean not null default false,
  created_at timestamptz not null default now()
);
-- Hidden titles stay saved but viewers don't see them.
alter table titles add column if not exists hidden boolean not null default false;
-- Scheduled publishing: viewers see the title from this moment on (null = straight away).
alter table titles add column if not exists publish_at timestamptz;

-- Site-wide switches set in the admin panel, e.g. 'sections' = { "series": true, "movies": false }.
create table if not exists settings (
  key text primary key,
  value jsonb not null
);

create table if not exists channel_titles (
  channel_id text not null references channels(id) on delete cascade,
  title_id text not null references titles(id) on delete cascade,
  position int not null default 0,
  primary key (channel_id, title_id)
);
create index if not exists channel_titles_title_idx on channel_titles(title_id);

create table if not exists my_list (
  profile_id int not null references profiles(id) on delete cascade,
  title_id text not null references titles(id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (profile_id, title_id)
);

create table if not exists watch_progress (
  profile_id int not null references profiles(id) on delete cascade,
  title_id text not null references titles(id) on delete cascade,
  pct int not null,
  updated_at timestamptz not null default now(),
  primary key (profile_id, title_id)
);
create index if not exists watch_progress_updated_idx on watch_progress(updated_at);

-- Season and episode the viewer says they're up to (entered by hand in the title preview).
create table if not exists watch_position (
  profile_id int not null references profiles(id) on delete cascade,
  title_id text not null references titles(id) on delete cascade,
  season int not null,
  episode int not null,
  updated_at timestamptz not null default now(),
  primary key (profile_id, title_id)
);

-- One row per Play press (playback happens off-site, so the press is what we count).
-- Feeds "Recently Watched" and the admin stats.
create table if not exists play_events (
  id bigserial primary key,
  profile_id int not null references profiles(id) on delete cascade,
  title_id text not null references titles(id) on delete cascade,
  season int,
  episode int,
  played_at timestamptz not null default now()
);
create index if not exists play_events_profile_idx on play_events(profile_id, played_at desc);
create index if not exists play_events_title_idx on play_events(title_id, played_at);

-- Daily time blocks per channel: [{ "start": 420, "end": 540, "titleIds": [...] }], minutes from midnight.
-- Outside every block the channel plays its whole line-up.
alter table channels add column if not exists schedule jsonb not null default '[]';

-- What viewers see under the bell. Some are written automatically (new show, new episodes,
-- channel goes live); announcements are written by an admin.
create table if not exists notifications (
  id serial primary key,
  kind text not null check (kind in ('title', 'episodes', 'channel', 'announcement')),
  title_id text references titles(id) on delete cascade,
  channel_id text references channels(id) on delete cascade,
  heading text not null,
  body text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists notifications_created_idx on notifications(created_at desc);
-- Notifications newer than this are unread for the profile.
alter table profiles add column if not exists notif_seen_at timestamptz not null default now();
