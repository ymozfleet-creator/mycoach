-- ============================================================
-- コサポ データベーススキーマ v1.0（P1: 認証・DB・審査管理）
-- Supabase SQL Editor にそのまま貼り付けて実行してください
-- ============================================================

-- ---------- 1. プロフィール（ロール管理） ----------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'student' check (role in ('student','company','admin')),
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

-- サインアップ時に自動でプロフィール行を作成（ロールはメタデータから、adminは不可）
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, role)
  values (new.id,
    case when new.raw_user_meta_data->>'role' in ('student','company')
         then new.raw_user_meta_data->>'role' else 'student' end);
  return new;
end; $$;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ヘルパー関数
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from profiles where id = auth.uid() and role = 'admin');
$$;
create or replace function public.is_approved_company() returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from companies where user_id = auth.uid() and status = 'approved');
$$;

create policy "profiles: read own or admin" on public.profiles
  for select using (auth.uid() = id or public.is_admin());
create policy "profiles: insert own" on public.profiles
  for insert with check (auth.uid() = id and role in ('student','company'));

-- ---------- 2. 学生 ----------
create table public.students (
  id bigint generated always as identity primary key,
  user_id uuid not null unique references auth.users(id) on delete cascade,
  name text not null,
  kana text,
  category text not null check (category in ('univ','hs')),   -- univ=18歳以上 / hs=高校生
  school text, pref text,
  sport text not null,
  event text, pb text, pb_label text,
  training text, appeal text, video_url text, photo_url text,
  status text not null default 'pending' check (status in ('pending','approved','suspended')),
  parent_consent text not null default 'na' check (parent_consent in ('na','waiting','verified')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.students enable row level security;

-- 野球の登録をDBレベルでも遮断（画面のポカヨケの二重化）
alter table public.students add constraint no_baseball check (sport not like '%野球%');
-- URLスキーム制約（javascript:等の混入をDBレベルでも遮断）と文字数上限
alter table public.students add constraint video_url_scheme
  check (video_url is null or video_url = '' or video_url ~* '^https?://');
alter table public.students add constraint appeal_len   check (appeal   is null or char_length(appeal)   <= 2000);
alter table public.students add constraint training_len check (training is null or char_length(training) <= 2000);

-- 閲覧：本人／運営／承認済み企業（かつ学生が公開中のみ）
create policy "students: select" on public.students for select using (
  user_id = auth.uid()
  or public.is_admin()
  or (public.is_approved_company() and status = 'approved')
);
create policy "students: insert own" on public.students
  for insert with check (user_id = auth.uid());
create policy "students: update own" on public.students
  for update using (user_id = auth.uid());
create policy "students: admin update" on public.students
  for update using (public.is_admin());

-- 学生本人は status / parent_consent を変更できない（運営専用）＋高校生は同意必須フロー
create or replace function public.guard_student_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    new.status := old.status;
    new.parent_consent := old.parent_consent;
  end if;
  if new.category = 'hs' and new.parent_consent = 'na' then
    new.parent_consent := 'waiting';   -- 高校生は同意書確認待ちから開始
  end if;
  new.updated_at := now();
  return new;
end; $$;
create trigger trg_guard_student before update on public.students
  for each row execute function public.guard_student_update();

create or replace function public.init_student_consent()
returns trigger language plpgsql as $$
begin
  if new.category = 'hs' then new.parent_consent := 'waiting'; end if;
  return new;
end; $$;
create trigger trg_init_student before insert on public.students
  for each row execute function public.init_student_consent();

-- ---------- 3. 戦績・SNS ----------
create table public.student_records (
  id bigint generated always as identity primary key,
  student_id bigint not null references public.students(id) on delete cascade,
  year text, text text not null,
  created_at timestamptz not null default now()
);
create table public.student_sns (
  id bigint generated always as identity primary key,
  student_id bigint not null references public.students(id) on delete cascade,
  type text not null,
  url text not null constraint sns_url_scheme check (url ~* '^https?://')
);
alter table public.student_records enable row level security;
alter table public.student_sns enable row level security;

create policy "records: select" on public.student_records for select using (
  exists (select 1 from students s where s.id = student_id
    and (s.user_id = auth.uid() or public.is_admin()
         or (public.is_approved_company() and s.status = 'approved')))
);
create policy "records: owner write" on public.student_records for all using (
  exists (select 1 from students s where s.id = student_id and s.user_id = auth.uid())
);
create policy "sns: select" on public.student_sns for select using (
  exists (select 1 from students s where s.id = student_id
    and (s.user_id = auth.uid() or public.is_admin()
         or (public.is_approved_company() and s.status = 'approved')))
);
create policy "sns: owner write" on public.student_sns for all using (
  exists (select 1 from students s where s.id = student_id and s.user_id = auth.uid())
);

-- ---------- 4. 企業 ----------
create table public.companies (
  id bigint generated always as identity primary key,
  user_id uuid not null unique references auth.users(id) on delete cascade,
  name text not null,
  industry text, address text, url text, person text,
  budget text, purpose text, interest text,
  status text not null default 'pending' check (status in ('pending','approved','suspended')),
  created_at timestamptz not null default now()
);
alter table public.companies enable row level security;

create policy "companies: select own or admin" on public.companies
  for select using (user_id = auth.uid() or public.is_admin());
create policy "companies: insert own" on public.companies
  for insert with check (user_id = auth.uid());
create policy "companies: update own" on public.companies
  for update using (user_id = auth.uid());
create policy "companies: admin update" on public.companies
  for update using (public.is_admin());

create or replace function public.guard_company_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then new.status := old.status; end if;
  return new;
end; $$;
create trigger trg_guard_company before update on public.companies
  for each row execute function public.guard_company_update();

-- ---------- 5. チェック（目星：企業側のみ・学生には構造的に不可視） ----------
create table public.checks (
  company_user_id uuid not null references auth.users(id) on delete cascade,
  student_id bigint not null references public.students(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (company_user_id, student_id)
);
alter table public.checks enable row level security;

-- 企業本人と運営のみ。学生に付与するポリシーは存在しない＝学生からは一切読めない
create policy "checks: company own" on public.checks for all using (
  company_user_id = auth.uid() and public.is_approved_company()
) with check (company_user_id = auth.uid() and public.is_approved_company());
create policy "checks: admin read" on public.checks for select using (public.is_admin());

-- ---------- 6. 更新通知（フィード） ----------
create table public.notifications (
  id bigint generated always as identity primary key,
  student_id bigint not null references public.students(id) on delete cascade,
  type text not null,
  message text not null,
  created_at timestamptz not null default now()
);
alter table public.notifications enable row level security;

-- 挿入：学生本人が自分の更新について発行（アプリが差分検出して挿入）
create policy "notifications: student insert own" on public.notifications
  for insert with check (
    exists (select 1 from students s where s.id = student_id and s.user_id = auth.uid())
  );
-- 閲覧：チェック済みの承認企業と運営のみ（学生本人にも見せない＝チェック企業の存在を推測させない）
create policy "notifications: checked company read" on public.notifications
  for select using (
    public.is_admin()
    or (public.is_approved_company()
        and exists (select 1 from checks c
              where c.student_id = notifications.student_id
                and c.company_user_id = auth.uid()))
  );

-- ---------- 7. 支援相談（目星→事務局） ----------
create table public.inquiries (
  id bigint generated always as identity primary key,
  company_user_id uuid not null references auth.users(id) on delete cascade,
  student_id bigint not null references public.students(id) on delete cascade,
  budget text, message text,
  status text not null default 'new'
    check (status in ('new','meeting','nego','contracted','closed')),
  created_at timestamptz not null default now()
);
alter table public.inquiries enable row level security;

create policy "inquiries: company insert" on public.inquiries
  for insert with check (company_user_id = auth.uid() and public.is_approved_company());
create policy "inquiries: company read own" on public.inquiries
  for select using (company_user_id = auth.uid() or public.is_admin());
create policy "inquiries: admin update" on public.inquiries
  for update using (public.is_admin());

-- ---------- 8. 監査ログ（閲覧記録：未成年情報保護の説明責任） ----------
create table public.audit_logs (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete set null,
  action text not null,
  target text,
  created_at timestamptz not null default now()
);
alter table public.audit_logs enable row level security;
create policy "audit: authenticated insert" on public.audit_logs
  for insert with check (auth.uid() = user_id);
create policy "audit: admin read" on public.audit_logs
  for select using (public.is_admin());

-- ---------- 9. ストレージ（顔写真） ----------
insert into storage.buckets (id, name, public) values ('photos','photos', false)
on conflict (id) do nothing;

create policy "photos: upload to own folder" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "photos: update own" on storage.objects
  for update to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "photos: authenticated read" on storage.objects
  for select to authenticated using (bucket_id = 'photos');
-- 非公開バケット：URLを知っていても未ログインでは閲覧不可。アプリが署名付きURL（1時間有効）を発行して表示

-- ---------- 10. インデックス ----------
create index idx_students_status on public.students(status);
create index idx_notifications_student_created on public.notifications(student_id, created_at desc);
create index idx_inquiries_status on public.inquiries(status);
create index idx_checks_company on public.checks(company_user_id);

-- ============================================================
-- 実行後の初期設定（手順書§4参照）：
-- 1) Authentication > Providers > Email で確認メールを一旦オフ（検証を簡単にするため）
-- 2) 運営アカウントをサインアップ後、以下で admin に昇格：
--    update public.profiles set role='admin'
--    where id = (select id from auth.users where email = 'あなたの運営メール');
-- ============================================================

-- ============================================================
-- 【既にv1.0を実行済みのDB向け 移行SQL】（新規構築の場合は不要）
-- 
-- ============================================================
