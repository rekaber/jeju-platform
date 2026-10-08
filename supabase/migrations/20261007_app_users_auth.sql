-- 로그인 계정을 PC(브라우저)별 localStorage 대신 DB에 공용 저장
-- 테이블은 anon이 직접 읽고 쓸 수 없고, 아래 RPC 함수로만 접근한다.

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE TABLE IF NOT EXISTS public.app_users (
  id          TEXT PRIMARY KEY,
  pw_hash     TEXT NOT NULL,
  must_change BOOLEAN NOT NULL DEFAULT TRUE,
  role        TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.app_sessions (
  token      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    TEXT NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '12 hours'
);

ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.app_users, public.app_sessions FROM anon, authenticated;

INSERT INTO public.app_users (id, pw_hash, must_change, role) VALUES
  ('admin',       extensions.crypt('1234!', extensions.gen_salt('bf')), TRUE, 'admin'),
  ('jejusoa6891', extensions.crypt('1234!', extensions.gen_salt('bf')), TRUE, 'user'),
  ('jjy0811',     extensions.crypt('1234!', extensions.gen_salt('bf')), TRUE, 'user'),
  ('jeju',        extensions.crypt('1234!', extensions.gen_salt('bf')), TRUE, 'user'),
  ('jeju2343',    extensions.crypt('1234!', extensions.gen_salt('bf')), TRUE, 'user')
ON CONFLICT (id) DO NOTHING;

-- ── 내부 헬퍼 ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public._auth_new_session(p_id TEXT)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE v_token UUID;
BEGIN
  DELETE FROM app_sessions WHERE expires_at < NOW();
  INSERT INTO app_sessions (user_id) VALUES (p_id) RETURNING token INTO v_token;
  RETURN v_token;
END $$;

CREATE OR REPLACE FUNCTION public._auth_admin_id(p_token UUID)
RETURNS TEXT
LANGUAGE sql SECURITY DEFINER SET search_path = public, extensions AS $$
  SELECT u.id FROM app_sessions s JOIN app_users u ON u.id = s.user_id
  WHERE s.token = p_token AND s.expires_at > NOW() AND u.role = 'admin';
$$;

REVOKE EXECUTE ON FUNCTION public._auth_new_session(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._auth_admin_id(UUID) FROM PUBLIC, anon, authenticated;

-- ── 로그인 ───────────────────────────────────────────
-- 최초 로그인(must_change)이면 토큰 없이 응답 → 비밀번호 변경 후 토큰 발급
CREATE OR REPLACE FUNCTION public.auth_login(p_id TEXT, p_pw TEXT)
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE u app_users;
BEGIN
  SELECT * INTO u FROM app_users WHERE id = p_id;
  IF NOT FOUND THEN
    RETURN json_build_object('ok', FALSE, 'error', 'not_found');
  END IF;
  IF crypt(p_pw, u.pw_hash) <> u.pw_hash THEN
    RETURN json_build_object('ok', FALSE, 'error', 'bad_password');
  END IF;
  IF u.must_change THEN
    RETURN json_build_object('ok', TRUE, 'must_change', TRUE, 'role', u.role);
  END IF;
  RETURN json_build_object('ok', TRUE, 'must_change', FALSE, 'role', u.role,
                           'token', _auth_new_session(u.id));
END $$;

-- 최초 비밀번호 변경과 일반 비밀번호 변경 공용
CREATE OR REPLACE FUNCTION public.auth_set_password(p_id TEXT, p_old TEXT, p_new TEXT)
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE u app_users;
BEGIN
  SELECT * INTO u FROM app_users WHERE id = p_id;
  IF NOT FOUND THEN
    RETURN json_build_object('ok', FALSE, 'error', 'not_found');
  END IF;
  IF crypt(p_old, u.pw_hash) <> u.pw_hash THEN
    RETURN json_build_object('ok', FALSE, 'error', 'bad_password');
  END IF;
  IF p_new IS NULL OR length(p_new) < 4 THEN
    RETURN json_build_object('ok', FALSE, 'error', 'too_short');
  END IF;
  IF p_new = '1234!' THEN
    RETURN json_build_object('ok', FALSE, 'error', 'default_password');
  END IF;
  IF p_new = p_old THEN
    RETURN json_build_object('ok', FALSE, 'error', 'same_password');
  END IF;
  UPDATE app_users
     SET pw_hash = crypt(p_new, gen_salt('bf')), must_change = FALSE, updated_at = NOW()
   WHERE id = p_id;
  DELETE FROM app_sessions WHERE user_id = p_id;
  RETURN json_build_object('ok', TRUE, 'role', u.role, 'token', _auth_new_session(p_id));
END $$;

CREATE OR REPLACE FUNCTION public.auth_session(p_token UUID)
RETURNS JSON
LANGUAGE sql SECURITY DEFINER SET search_path = public, extensions AS $$
  SELECT COALESCE(
    (SELECT json_build_object('ok', TRUE, 'id', u.id, 'role', u.role)
       FROM app_sessions s JOIN app_users u ON u.id = s.user_id
      WHERE s.token = p_token AND s.expires_at > NOW()),
    json_build_object('ok', FALSE));
$$;

CREATE OR REPLACE FUNCTION public.auth_logout(p_token UUID)
RETURNS VOID
LANGUAGE sql SECURITY DEFINER SET search_path = public, extensions AS $$
  DELETE FROM app_sessions WHERE token = p_token;
$$;

-- ── 관리자 ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.auth_admin_list(p_token UUID)
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
BEGIN
  IF _auth_admin_id(p_token) IS NULL THEN
    RETURN json_build_object('ok', FALSE, 'error', 'forbidden');
  END IF;
  RETURN json_build_object('ok', TRUE, 'users', COALESCE(
    (SELECT json_agg(json_build_object('id', id, 'role', role, 'must_change', must_change)
                     ORDER BY (role = 'admin') DESC, id)
       FROM app_users), '[]'::json));
END $$;

CREATE OR REPLACE FUNCTION public.auth_admin_add(p_token UUID, p_id TEXT)
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
BEGIN
  IF _auth_admin_id(p_token) IS NULL THEN
    RETURN json_build_object('ok', FALSE, 'error', 'forbidden');
  END IF;
  IF p_id IS NULL OR p_id !~ '^[A-Za-z0-9가-힣._-]{2,20}$' THEN
    RETURN json_build_object('ok', FALSE, 'error', 'invalid_id');
  END IF;
  IF EXISTS (SELECT 1 FROM app_users WHERE id = p_id) THEN
    RETURN json_build_object('ok', FALSE, 'error', 'exists');
  END IF;
  INSERT INTO app_users (id, pw_hash, must_change, role)
  VALUES (p_id, crypt('1234!', gen_salt('bf')), TRUE, 'user');
  RETURN json_build_object('ok', TRUE);
END $$;

CREATE OR REPLACE FUNCTION public.auth_admin_reset(p_token UUID, p_id TEXT)
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
BEGIN
  IF _auth_admin_id(p_token) IS NULL THEN
    RETURN json_build_object('ok', FALSE, 'error', 'forbidden');
  END IF;
  UPDATE app_users
     SET pw_hash = crypt('1234!', gen_salt('bf')), must_change = TRUE, updated_at = NOW()
   WHERE id = p_id;
  IF NOT FOUND THEN
    RETURN json_build_object('ok', FALSE, 'error', 'not_found');
  END IF;
  DELETE FROM app_sessions WHERE user_id = p_id;
  RETURN json_build_object('ok', TRUE);
END $$;

CREATE OR REPLACE FUNCTION public.auth_admin_delete(p_token UUID, p_id TEXT)
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE v_admin TEXT := _auth_admin_id(p_token);
BEGIN
  IF v_admin IS NULL THEN
    RETURN json_build_object('ok', FALSE, 'error', 'forbidden');
  END IF;
  IF p_id = v_admin THEN
    RETURN json_build_object('ok', FALSE, 'error', 'self');
  END IF;
  IF p_id IN ('admin', 'jejusoa6891', 'jjy0811', 'jeju', 'jeju2343')
     OR EXISTS (SELECT 1 FROM app_users WHERE id = p_id AND role = 'admin') THEN
    RETURN json_build_object('ok', FALSE, 'error', 'protected');
  END IF;
  DELETE FROM app_users WHERE id = p_id;
  IF NOT FOUND THEN
    RETURN json_build_object('ok', FALSE, 'error', 'not_found');
  END IF;
  RETURN json_build_object('ok', TRUE);
END $$;

GRANT EXECUTE ON FUNCTION
  public.auth_login(TEXT, TEXT),
  public.auth_set_password(TEXT, TEXT, TEXT),
  public.auth_session(UUID),
  public.auth_logout(UUID),
  public.auth_admin_list(UUID),
  public.auth_admin_add(UUID, TEXT),
  public.auth_admin_reset(UUID, TEXT),
  public.auth_admin_delete(UUID, TEXT)
TO anon, authenticated;
