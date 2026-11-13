-- ============================================================
-- コサポ 移行SQL v1.0 → v1.1（構築済みDB用・SQL Editorで1回実行）
-- 内容：①学生メールの企業側漏えい対策（emailカラム廃止、RPCに一本化）
--       ②URL・文字数制約の追加 ③写真バケットの非公開化
--       ④profilesの自己修復用insertポリシー
-- ============================================================

-- ① emailカラム廃止（連絡先は admin_user_emails() RPC＝運営のみ参照に一本化）
alter table public.students  drop column if exists email;
alter table public.companies drop column if exists email;

-- ② 入力制約
alter table public.students drop constraint if exists video_url_scheme;
alter table public.students add constraint video_url_scheme
  check (video_url is null or video_url = '' or video_url ~* '^https?://');
alter table public.students drop constraint if exists appeal_len;
alter table public.students add constraint appeal_len
  check (appeal is null or char_length(appeal) <= 2000);
alter table public.students drop constraint if exists training_len;
alter table public.students add constraint training_len
  check (training is null or char_length(training) <= 2000);
alter table public.student_sns drop constraint if exists sns_url_scheme;
alter table public.student_sns add constraint sns_url_scheme
  check (url ~* '^https?://');
alter table public.inquiries drop constraint if exists inquiry_msg_len;
alter table public.inquiries add constraint inquiry_msg_len
  check (message is null or char_length(message) <= 2000);

-- ③ 写真バケットを非公開化（アプリは署名付きURLで表示）
update storage.buckets set public = false where id = 'photos';
drop policy if exists "photos: public read" on storage.objects;
drop policy if exists "photos: authenticated read" on storage.objects;
create policy "photos: authenticated read" on storage.objects
  for select to authenticated using (bucket_id = 'photos');

-- ④ profiles 自己修復用insertポリシー
drop policy if exists "profiles: insert own" on public.profiles;
create policy "profiles: insert own" on public.profiles
  for insert with check (auth.uid() = id and role in ('student','company'));
