-- ============================================================
-- コサポ 追加スキーマ：事務局が連絡先メールを参照できるようにする
-- （auth.users のメールを admin にだけ開示する。学生・企業からは0件）
-- SQL Editor に貼り付けて実行してください
-- ============================================================
create or replace function public.admin_user_emails()
returns table (user_id uuid, email text)
language sql stable security definer set search_path = public
as $$
  select u.id, u.email::text
  from auth.users u
  where public.is_admin();
$$;

revoke all on function public.admin_user_emails() from public, anon;
grant execute on function public.admin_user_emails() to authenticated;
