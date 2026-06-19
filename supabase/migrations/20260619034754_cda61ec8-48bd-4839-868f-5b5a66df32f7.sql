
REVOKE EXECUTE ON FUNCTION public.canvas_move_card(uuid, real, real, integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.canvas_bulk_move(jsonb) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.canvas_link_cards(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.canvas_unlink_card(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.canvas_group_cards(uuid[]) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.canvas_set_section(uuid, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.canvas_promote_to_final(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public._assert_canvas_write(uuid) FROM PUBLIC, anon, authenticated;
