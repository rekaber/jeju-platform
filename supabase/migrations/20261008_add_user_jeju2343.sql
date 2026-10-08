INSERT INTO public.app_users (id, pw_hash, must_change, role) VALUES
  ('jeju2343', extensions.crypt('1234!', extensions.gen_salt('bf')), TRUE, 'user')
ON CONFLICT (id) DO NOTHING;

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
