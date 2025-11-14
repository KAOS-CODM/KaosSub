-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.admin_otp_attempts (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  otp_code character varying NOT NULL,
  success boolean NOT NULL,
  ip_address character varying,
  attempted_at timestamp with time zone DEFAULT now(),
  CONSTRAINT admin_otp_attempts_pkey PRIMARY KEY (id),
  CONSTRAINT admin_otp_attempts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.admin_otps (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  otp_code character varying NOT NULL,
  expires_at timestamp with time zone NOT NULL,
  used boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  email character varying,
  ip_address character varying,
  purpose character varying DEFAULT 'registration'::character varying,
  CONSTRAINT admin_otps_pkey PRIMARY KEY (id),
  CONSTRAINT admin_otps_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.admin_settings (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  setting_key character varying NOT NULL UNIQUE,
  setting_value text,
  description text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT admin_settings_pkey PRIMARY KEY (id)
);
CREATE TABLE public.contact_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name character varying NOT NULL,
  email character varying NOT NULL,
  message text NOT NULL,
  submitted_at timestamp with time zone DEFAULT now(),
  status character varying DEFAULT 'new'::character varying,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT contact_messages_pkey PRIMARY KEY (id)
);
CREATE TABLE public.data_plans (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  network_id uuid NOT NULL,
  data_type_id uuid NOT NULL,
  name character varying NOT NULL,
  description text,
  price numeric NOT NULL,
  validity character varying,
  data_volume character varying,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  vtu_variation_id character varying,
  CONSTRAINT data_plans_pkey PRIMARY KEY (id),
  CONSTRAINT data_plans_network_id_fkey FOREIGN KEY (network_id) REFERENCES public.networks(id),
  CONSTRAINT data_plans_data_type_id_fkey FOREIGN KEY (data_type_id) REFERENCES public.data_types(id)
);
CREATE TABLE public.data_types (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  name character varying NOT NULL UNIQUE,
  description text,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT data_types_pkey PRIMARY KEY (id)
);
CREATE TABLE public.networks (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  name character varying NOT NULL UNIQUE,
  logo_url character varying,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT networks_pkey PRIMARY KEY (id)
);
CREATE TABLE public.newsletter_subscribers (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  email character varying NOT NULL UNIQUE,
  subscribed_at timestamp with time zone DEFAULT now(),
  active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT newsletter_subscribers_pkey PRIMARY KEY (id)
);
CREATE TABLE public.orders (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  network_id uuid NOT NULL,
  data_plan_id uuid NOT NULL,
  phone_number character varying NOT NULL,
  amount_paid numeric NOT NULL,
  status character varying NOT NULL CHECK (status::text = ANY (ARRAY['processing'::character varying::text, 'success'::character varying::text, 'failed'::character varying::text, 'pending'::character varying::text])),
  isub_reference character varying,
  isub_response jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT orders_pkey PRIMARY KEY (id),
  CONSTRAINT orders_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id),
  CONSTRAINT orders_network_id_fkey FOREIGN KEY (network_id) REFERENCES public.networks(id),
  CONSTRAINT orders_data_plan_id_fkey FOREIGN KEY (data_plan_id) REFERENCES public.data_plans(id)
);
CREATE TABLE public.profiles (
  id uuid NOT NULL,
  email character varying NOT NULL,
  full_name character varying,
  phone_number character varying,
  balance numeric DEFAULT 0.00,
  role character varying DEFAULT 'user'::character varying CHECK (role::text = ANY (ARRAY['user'::character varying::text, 'admin'::character varying::text])),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  preferences jsonb DEFAULT '{}'::jsonb,
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
);
CREATE TABLE public.registration_otps (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  email character varying NOT NULL,
  otp_code character varying NOT NULL,
  purpose character varying DEFAULT 'registration'::character varying,
  expires_at timestamp with time zone NOT NULL,
  used boolean DEFAULT false,
  attempts integer DEFAULT 0,
  ip_address character varying,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT registration_otps_pkey PRIMARY KEY (id)
);
CREATE TABLE public.transactions (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  type character varying NOT NULL CHECK (type::text = ANY (ARRAY['deposit'::character varying::text, 'purchase'::character varying::text, 'refund'::character varying::text])),
  amount numeric NOT NULL,
  status character varying NOT NULL CHECK (status::text = ANY (ARRAY['pending'::character varying::text, 'success'::character varying::text, 'failed'::character varying::text, 'cancelled'::character varying::text])),
  payment_method character varying DEFAULT 'paystack'::character varying,
  payment_reference character varying,
  metadata jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT transactions_pkey PRIMARY KEY (id),
  CONSTRAINT transactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.wallet_transactions (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  type character varying NOT NULL CHECK (type::text = ANY (ARRAY['credit'::character varying::text, 'debit'::character varying::text])),
  amount numeric NOT NULL,
  balance_before numeric NOT NULL,
  balance_after numeric NOT NULL,
  description text NOT NULL,
  reference character varying,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT wallet_transactions_pkey PRIMARY KEY (id),
  CONSTRAINT wallet_transactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);
