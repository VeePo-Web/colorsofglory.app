UPDATE auth.users
SET encrypted_password = crypt('Merlingrape101!!', gen_salt('bf')),
    email_confirmed_at = COALESCE(email_confirmed_at, now()),
    updated_at = now(),
    recovery_token = '',
    recovery_sent_at = NULL,
    email_change_token_new = '',
    email_change = ''
WHERE email = 'parker@veepo.ca';