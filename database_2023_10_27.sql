--
-- PostgreSQL database dump
--

\restrict a7epxtbp8KIQoBXSIsJ8gHsWOxmwA7VjlfgOn2ZS4SAjo4cXuWYIK1yUJi8Y1oU

-- Dumped from database version 18.3
-- Dumped by pg_dump version 18.3

-- Started on 2026-07-06 09:42:24

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- TOC entry 8 (class 2615 OID 25403)
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

-- *not* creating schema, since initdb creates it


--
-- TOC entry 7642 (class 0 OID 0)
-- Dependencies: 8
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS '';


--
-- TOC entry 3 (class 3079 OID 25442)
-- Name: pg_trgm; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;


--
-- TOC entry 7643 (class 0 OID 0)
-- Dependencies: 3
-- Name: EXTENSION pg_trgm; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pg_trgm IS 'text similarity measurement and index searching based on trigrams';


--
-- TOC entry 2 (class 3079 OID 25404)
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- TOC entry 7644 (class 0 OID 0)
-- Dependencies: 2
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- TOC entry 4 (class 3079 OID 25523)
-- Name: postgis; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA public;


--
-- TOC entry 7645 (class 0 OID 0)
-- Dependencies: 4
-- Name: EXTENSION postgis; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION postgis IS 'PostGIS geometry and geography spatial types and functions';


SET default_table_access_method = heap;

--
-- TOC entry 303 (class 1259 OID 28919)
-- Name: appointment_reschedules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.appointment_reschedules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    appointment_id uuid NOT NULL,
    proposed_by character varying(20) NOT NULL,
    old_service_date date NOT NULL,
    old_start_time time without time zone NOT NULL,
    new_service_date date NOT NULL,
    new_start_time time without time zone NOT NULL,
    reason text,
    status character varying(32) DEFAULT 'pending'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_appointment_reschedules_proposed_by CHECK (((proposed_by)::text = ANY ((ARRAY['customer'::character varying, 'provider'::character varying])::text[]))),
    CONSTRAINT chk_appointment_reschedules_status CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'accepted'::character varying, 'rejected'::character varying])::text[])))
);


--
-- TOC entry 7646 (class 0 OID 0)
-- Dependencies: 303
-- Name: TABLE appointment_reschedules; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.appointment_reschedules IS 'Bảng lưu trữ yêu cầu dời lịch hẹn giữa khách hàng và nhà cung cấp';


--
-- TOC entry 302 (class 1259 OID 28892)
-- Name: appointment_status_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.appointment_status_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    appointment_id uuid NOT NULL,
    from_status character varying(32),
    to_status character varying(32) NOT NULL,
    changed_by uuid,
    changed_role character varying(20) NOT NULL,
    reason text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_appointment_status_logs_changed_role CHECK (((changed_role)::text = ANY ((ARRAY['customer'::character varying, 'provider'::character varying, 'admin'::character varying, 'system'::character varying])::text[])))
);


--
-- TOC entry 7647 (class 0 OID 0)
-- Dependencies: 302
-- Name: TABLE appointment_status_logs; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.appointment_status_logs IS 'Bảng lưu lịch sử chuyển đổi trạng thái của cuộc hẹn dịch vụ';


--
-- TOC entry 264 (class 1259 OID 27773)
-- Name: booking_status_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.booking_status_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    booking_id uuid NOT NULL,
    from_status character varying(30),
    to_status character varying(30) NOT NULL,
    changed_by uuid,
    note text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- TOC entry 263 (class 1259 OID 27697)
-- Name: bookings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bookings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    customer_id uuid NOT NULL,
    provider_id uuid,
    vehicle_id uuid,
    service_category_id uuid NOT NULL,
    service_type character varying(50) NOT NULL,
    pricing_mode character varying(20) DEFAULT 'formula'::character varying NOT NULL,
    pickup_address text NOT NULL,
    pickup_lat numeric(10,7),
    pickup_lng numeric(10,7),
    pickup_point public.geography(Point,4326),
    dropoff_address text,
    dropoff_lat numeric(10,7),
    dropoff_lng numeric(10,7),
    dropoff_point public.geography(Point,4326),
    route_id uuid,
    schedule_id uuid,
    rental_start_date date,
    rental_end_date date,
    distance_km numeric(8,2),
    duration_min integer,
    estimated_fare numeric(18,2),
    driver_quoted_fare numeric(18,2),
    quote_expires_at timestamp with time zone,
    customer_accepted_fare numeric(18,2),
    final_fare numeric(18,2),
    status character varying(30) DEFAULT 'pending'::character varying NOT NULL,
    cancelled_by character varying(20),
    cancel_reason text,
    boarding_otp character varying(64),
    boarding_otp_expires timestamp with time zone,
    boarded_at timestamp with time zone,
    requested_at timestamp with time zone DEFAULT now() NOT NULL,
    driver_quoted_at timestamp with time zone,
    customer_decided_at timestamp with time zone,
    accepted_at timestamp with time zone,
    arrived_at timestamp with time zone,
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    cancelled_at timestamp with time zone,
    payment_method character varying(30),
    payment_status character varying(20) DEFAULT 'unpaid'::character varying NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    customer_note text,
    end_time timestamp with time zone,
    vehicle_type character varying(100),
    vehicle_brand_and_model character varying(255),
    license_plate character varying(50),
    transmission_type character varying(50),
    cargo_type character varying(255),
    cargo_weight character varying(100),
    cargo_dimensions character varying(100),
    issue_description text,
    load_capacity character varying(100),
    lift_height character varying(100),
    terrain_type character varying(100),
    attachment_ids jsonb,
    seat_count integer,
    passenger_name character varying(255),
    passenger_phone character varying(50),
    route_pickup_point character varying(255),
    route_dropoff_point character varying(255),
    delivery_option character varying(50),
    cccd_image character varying(500),
    driver_license_image character varying(500),
    deposit_amount numeric(18,2),
    scheduled_time timestamp with time zone,
    CONSTRAINT chk_bookings_cancelled_by CHECK (((cancelled_by IS NULL) OR ((cancelled_by)::text = ANY ((ARRAY['customer'::character varying, 'provider'::character varying, 'system'::character varying])::text[])))),
    CONSTRAINT chk_bookings_payment_method CHECK (((payment_method IS NULL) OR ((payment_method)::text = ANY ((ARRAY['cash'::character varying, 'wallet'::character varying, 'vnpay'::character varying, 'momo'::character varying, 'zalopay'::character varying])::text[])))),
    CONSTRAINT chk_bookings_payment_status CHECK (((payment_status)::text = ANY ((ARRAY['unpaid'::character varying, 'paid'::character varying, 'refunded'::character varying, 'failed'::character varying])::text[]))),
    CONSTRAINT chk_bookings_pricing_mode CHECK (((pricing_mode)::text = ANY ((ARRAY['formula'::character varying, 'driver_quote'::character varying])::text[]))),
    CONSTRAINT chk_bookings_status CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'searching'::character varying, 'driver_quoted'::character varying, 'customer_accepted'::character varying, 'customer_rejected'::character varying, 'quote_expired'::character varying, 'accepted'::character varying, 'arriving'::character varying, 'arrived'::character varying, 'boarded'::character varying, 'in_progress'::character varying, 'completed'::character varying, 'cancelled'::character varying])::text[])))
);


--
-- TOC entry 7648 (class 0 OID 0)
-- Dependencies: 263
-- Name: COLUMN bookings.boarding_otp; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.bookings.boarding_otp IS 'SHA256 hash of 6-digit boarding OTP (64 chars)';


--
-- TOC entry 7649 (class 0 OID 0)
-- Dependencies: 263
-- Name: COLUMN bookings.scheduled_time; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.bookings.scheduled_time IS 'Scheduled start time for transport bookings (driver rental, heavy equipment, etc.)';


--
-- TOC entry 288 (class 1259 OID 28568)
-- Name: chat_conversations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chat_conversations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    booking_id uuid NOT NULL,
    customer_id uuid NOT NULL,
    provider_id uuid NOT NULL,
    status character varying(20) DEFAULT 'active'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    closed_at timestamp with time zone
);


--
-- TOC entry 289 (class 1259 OID 28599)
-- Name: chat_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chat_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    conversation_id uuid NOT NULL,
    sender_id uuid NOT NULL,
    message_type character varying(20) DEFAULT 'text'::character varying NOT NULL,
    content text NOT NULL,
    metadata jsonb,
    is_read boolean DEFAULT false NOT NULL,
    read_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- TOC entry 260 (class 1259 OID 27631)
-- Name: commission_configs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.commission_configs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    service_type character varying(50) NOT NULL,
    rate_percent numeric(5,2) NOT NULL,
    fixed_fee numeric(18,2) DEFAULT 0,
    effective_from timestamp with time zone DEFAULT now() NOT NULL,
    effective_to timestamp with time zone,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- TOC entry 276 (class 1259 OID 28174)
-- Name: consent_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.consent_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    consent_type character varying(50) NOT NULL,
    action character varying(20) NOT NULL,
    version character varying(20),
    ip_address character varying(50),
    user_agent text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_consent_logs_action CHECK (((action)::text = ANY ((ARRAY['granted'::character varying, 'revoked'::character varying])::text[]))),
    CONSTRAINT chk_consent_logs_consent_type CHECK (((consent_type)::text = ANY ((ARRAY['terms_of_service'::character varying, 'privacy_policy'::character varying, 'marketing_email'::character varying, 'marketing_push'::character varying, 'location_tracking'::character varying, 'data_sharing'::character varying, 'cookie'::character varying])::text[])))
);


--
-- TOC entry 298 (class 1259 OID 28808)
-- Name: core_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.core_settings (
    id integer NOT NULL,
    setting_key character varying(100) NOT NULL,
    setting_value text NOT NULL,
    setting_type character varying(20) DEFAULT 'string'::character varying NOT NULL,
    description text,
    category character varying(50) NOT NULL,
    default_value text,
    validation_rules jsonb,
    updated_by character varying(100),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- TOC entry 7650 (class 0 OID 0)
-- Dependencies: 298
-- Name: TABLE core_settings; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.core_settings IS 'Lưu trữ các cấu hình động của hệ thống (Nhóm 2, 3, 4).';


--
-- TOC entry 297 (class 1259 OID 28807)
-- Name: core_settings_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.core_settings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 7651 (class 0 OID 0)
-- Dependencies: 297
-- Name: core_settings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.core_settings_id_seq OWNED BY public.core_settings.id;


--
-- TOC entry 286 (class 1259 OID 28487)
-- Name: crm_activities; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.crm_activities (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    activity_type character varying(30) NOT NULL,
    subject character varying(255) NOT NULL,
    description text,
    contact_id uuid,
    lead_id uuid,
    deal_id uuid,
    scheduled_at timestamp with time zone,
    completed_at timestamp with time zone,
    completed_by uuid,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_crm_activities_type CHECK (((activity_type)::text = ANY ((ARRAY['call'::character varying, 'meeting'::character varying, 'email'::character varying, 'task'::character varying, 'note'::character varying, 'sms'::character varying, 'others'::character varying])::text[])))
);


--
-- TOC entry 282 (class 1259 OID 28356)
-- Name: crm_contacts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.crm_contacts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    first_name character varying(100) NOT NULL,
    last_name character varying(100) NOT NULL,
    email character varying(255),
    phone character varying(50),
    company_name character varying(200),
    status character varying(30) DEFAULT 'active'::character varying NOT NULL,
    user_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_crm_contacts_status CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'inactive'::character varying, 'archived'::character varying, 'converted'::character varying])::text[])))
);


--
-- TOC entry 284 (class 1259 OID 28413)
-- Name: crm_deals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.crm_deals (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    contact_id uuid NOT NULL,
    name character varying(255) NOT NULL,
    status character varying(50) NOT NULL,
    amount numeric(18,2) NOT NULL,
    probability integer NOT NULL,
    close_date timestamp with time zone,
    assigned_to uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_crm_deals_status CHECK (((status)::text = ANY ((ARRAY['new'::character varying, 'proposal'::character varying, 'negotiation'::character varying, 'closed_won'::character varying, 'closed_lost'::character varying, 'cancelled'::character varying])::text[])))
);


--
-- TOC entry 283 (class 1259 OID 28383)
-- Name: crm_leads; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.crm_leads (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    contact_id uuid NOT NULL,
    status character varying(30) DEFAULT 'new'::character varying NOT NULL,
    estimated_value numeric(18,2) NOT NULL,
    probability integer NOT NULL,
    assigned_to uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_crm_leads_status CHECK (((status)::text = ANY ((ARRAY['new'::character varying, 'contacted'::character varying, 'qualified'::character varying, 'unqualified'::character varying, 'converted'::character varying, 'lost'::character varying])::text[])))
);


--
-- TOC entry 285 (class 1259 OID 28444)
-- Name: crm_tasks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.crm_tasks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title character varying(255) NOT NULL,
    description text,
    status character varying(30) DEFAULT 'pending'::character varying NOT NULL,
    due_date timestamp with time zone,
    contact_id uuid,
    deal_id uuid,
    lead_id uuid,
    assigned_to uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_crm_tasks_status CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'in_progress'::character varying, 'completed'::character varying, 'cancelled'::character varying, 'overdue'::character varying])::text[])))
);


--
-- TOC entry 277 (class 1259 OID 28197)
-- Name: data_deletion_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.data_deletion_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    status character varying(30) DEFAULT 'pending'::character varying NOT NULL,
    reason text,
    requested_at timestamp with time zone DEFAULT now() NOT NULL,
    scheduled_delete_at timestamp with time zone,
    processed_at timestamp with time zone,
    processed_by uuid,
    CONSTRAINT chk_ddr_status CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'processing'::character varying, 'completed'::character varying, 'cancelled'::character varying])::text[])))
);


--
-- TOC entry 262 (class 1259 OID 27670)
-- Name: driver_availability_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.driver_availability_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    provider_id uuid NOT NULL,
    vehicle_id uuid,
    status character varying(20) DEFAULT 'offline'::character varying NOT NULL,
    online_at timestamp with time zone,
    offline_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_driver_availability_status CHECK (((status)::text = ANY ((ARRAY['offline'::character varying, 'online'::character varying, 'busy'::character varying])::text[])))
);


--
-- TOC entry 261 (class 1259 OID 27652)
-- Name: driver_locations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.driver_locations (
    provider_id uuid NOT NULL,
    latitude numeric(10,7) NOT NULL,
    longitude numeric(10,7) NOT NULL,
    location public.geography(Point,4326),
    heading numeric(5,2),
    speed_kmh numeric(5,1),
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- TOC entry 317 (class 1259 OID 29429)
-- Name: food_menu_categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.food_menu_categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    merchant_id uuid NOT NULL,
    name character varying(100) NOT NULL,
    display_order integer DEFAULT 0,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- TOC entry 319 (class 1259 OID 29476)
-- Name: food_menu_item_options; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.food_menu_item_options (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    menu_item_id uuid NOT NULL,
    option_group_name character varying(100) NOT NULL,
    option_name character varying(200) NOT NULL,
    additional_price numeric(18,2) DEFAULT 0,
    is_default boolean DEFAULT false,
    display_order integer DEFAULT 0
);


--
-- TOC entry 318 (class 1259 OID 29447)
-- Name: food_menu_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.food_menu_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    merchant_id uuid NOT NULL,
    menu_category_id uuid,
    name character varying(200) NOT NULL,
    description text,
    price numeric(18,2) NOT NULL,
    original_price numeric(18,2),
    image_url text,
    is_available boolean DEFAULT true,
    is_popular boolean DEFAULT false,
    display_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- TOC entry 316 (class 1259 OID 29401)
-- Name: food_merchant_documents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.food_merchant_documents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    merchant_id uuid NOT NULL,
    document_type character varying(50) NOT NULL,
    file_url text NOT NULL,
    document_number character varying(100),
    issued_date date,
    expiry_date date,
    review_status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    reviewed_by uuid,
    reviewed_at timestamp with time zone,
    review_note text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- TOC entry 315 (class 1259 OID 29368)
-- Name: food_merchants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.food_merchants (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    provider_id uuid NOT NULL,
    merchant_name character varying(200) NOT NULL,
    merchant_short_name character varying(100),
    description text,
    cuisine_type character varying(50),
    opening_time time without time zone,
    closing_time time without time zone,
    preparing_time_min integer DEFAULT 15,
    min_order_amount numeric(18,2) DEFAULT 0,
    delivery_fee_per_km numeric(18,2),
    free_delivery_min numeric(18,2),
    cover_image_url text,
    logo_url text,
    is_open boolean DEFAULT true,
    rating_avg numeric(3,2) DEFAULT 0,
    total_orders integer DEFAULT 0,
    verification_status character varying(20) DEFAULT 'unverified'::character varying NOT NULL,
    verification_note text,
    verified_at timestamp with time zone,
    verified_by uuid,
    status character varying(20) DEFAULT 'active'::character varying,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- TOC entry 321 (class 1259 OID 29545)
-- Name: food_order_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.food_order_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid NOT NULL,
    menu_item_id uuid NOT NULL,
    item_name character varying(200) NOT NULL,
    quantity integer DEFAULT 1 NOT NULL,
    unit_price numeric(18,2) NOT NULL,
    options_description text,
    options_price numeric(18,2) DEFAULT 0,
    note text,
    subtotal numeric(18,2) NOT NULL
);


--
-- TOC entry 322 (class 1259 OID 29572)
-- Name: food_order_status_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.food_order_status_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid NOT NULL,
    from_status character varying(30),
    to_status character varying(30) NOT NULL,
    changed_by uuid,
    changed_by_role character varying(20),
    note text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- TOC entry 320 (class 1259 OID 29494)
-- Name: food_orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.food_orders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    customer_user_id uuid NOT NULL,
    merchant_id uuid NOT NULL,
    shipper_provider_id uuid,
    merchant_service_id uuid,
    shipper_service_id uuid,
    order_number character varying(20) NOT NULL,
    status character varying(30) DEFAULT 'pending'::character varying NOT NULL,
    delivery_address text NOT NULL,
    delivery_latitude numeric(10,7),
    delivery_longitude numeric(10,7),
    customer_phone character varying(20),
    customer_note text,
    subtotal numeric(18,2) NOT NULL,
    delivery_fee numeric(18,2) DEFAULT 0,
    discount_amount numeric(18,2) DEFAULT 0,
    total_amount numeric(18,2) NOT NULL,
    ordered_at timestamp with time zone DEFAULT now() NOT NULL,
    merchant_confirmed_at timestamp with time zone,
    ready_at timestamp with time zone,
    picked_up_at timestamp with time zone,
    delivered_at timestamp with time zone,
    cancelled_at timestamp with time zone,
    cancel_reason text,
    estimated_prep_min integer DEFAULT 15,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- TOC entry 323 (class 1259 OID 29595)
-- Name: food_ratings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.food_ratings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid NOT NULL,
    customer_user_id uuid NOT NULL,
    food_rating integer NOT NULL,
    food_review text,
    delivery_rating integer,
    delivery_review text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    is_edited boolean DEFAULT false NOT NULL,
    CONSTRAINT food_ratings_delivery_rating_check CHECK (((delivery_rating >= 1) AND (delivery_rating <= 5))),
    CONSTRAINT food_ratings_food_rating_check CHECK (((food_rating >= 1) AND (food_rating <= 5)))
);


--
-- TOC entry 296 (class 1259 OID 28783)
-- Name: footer_links; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.footer_links (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    group_key character varying(50) NOT NULL,
    title character varying(100) NOT NULL,
    url text NOT NULL,
    target character varying(20) DEFAULT '_self'::character varying NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- TOC entry 238 (class 1259 OID 26906)
-- Name: industry_categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.industry_categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code character varying(50),
    name character varying(50),
    slug character varying(255),
    icon_url character varying(255),
    description text,
    module_type character varying(50),
    search_mode character varying(30) DEFAULT 'text'::character varying NOT NULL,
    default_view character varying(30) DEFAULT 'list'::character varying NOT NULL,
    nearby_enabled boolean DEFAULT false NOT NULL,
    detail_mode character varying(30) DEFAULT 'provider'::character varying NOT NULL,
    ui_config_json jsonb,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_by uuid,
    CONSTRAINT chk_industry_categories_default_view CHECK (((default_view)::text = ANY ((ARRAY['list'::character varying, 'card'::character varying, 'map'::character varying])::text[]))),
    CONSTRAINT chk_industry_categories_detail_mode CHECK (((detail_mode)::text = ANY ((ARRAY['provider'::character varying, 'provider_service'::character varying, 'profile_first'::character varying])::text[]))),
    CONSTRAINT chk_industry_categories_search_mode CHECK (((search_mode)::text = ANY ((ARRAY['text'::character varying, 'nearby'::character varying, 'hybrid'::character varying])::text[])))
);


--
-- TOC entry 7652 (class 0 OID 0)
-- Dependencies: 238
-- Name: COLUMN industry_categories.module_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.industry_categories.module_type IS 'Loại module chính để FE render và điều hướng: tutor, home_service, beauty, transport, medical, education, etc.';


--
-- TOC entry 7653 (class 0 OID 0)
-- Dependencies: 238
-- Name: COLUMN industry_categories.search_mode; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.industry_categories.search_mode IS 'Chế độ tìm kiếm ưu tiên: text, nearby, hybrid';


--
-- TOC entry 7654 (class 0 OID 0)
-- Dependencies: 238
-- Name: COLUMN industry_categories.default_view; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.industry_categories.default_view IS 'Giao diện hiển thị mặc định: list, card, map';


--
-- TOC entry 7655 (class 0 OID 0)
-- Dependencies: 238
-- Name: COLUMN industry_categories.nearby_enabled; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.industry_categories.nearby_enabled IS 'Có bật chức năng tìm thợ ở gần hay không';


--
-- TOC entry 7656 (class 0 OID 0)
-- Dependencies: 238
-- Name: COLUMN industry_categories.detail_mode; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.industry_categories.detail_mode IS 'Chế độ hiển thị chi tiết: provider, provider_service, profile_first';


--
-- TOC entry 7657 (class 0 OID 0)
-- Dependencies: 238
-- Name: COLUMN industry_categories.ui_config_json; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.industry_categories.ui_config_json IS 'Cấu hình giao diện và hành vi bổ sung dạng JSON (filters, show_map, default_sort, vv)';


--
-- TOC entry 308 (class 1259 OID 29107)
-- Name: job_request_attachments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.job_request_attachments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    job_request_id uuid NOT NULL,
    uploaded_by_user_id uuid,
    file_url text NOT NULL,
    file_type character varying(20) DEFAULT 'image'::character varying NOT NULL,
    file_name character varying(255),
    file_size_bytes integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_job_request_attachments_file_type CHECK (((file_type)::text = ANY ((ARRAY['image'::character varying, 'video'::character varying, 'document'::character varying])::text[])))
);


--
-- TOC entry 7658 (class 0 OID 0)
-- Dependencies: 308
-- Name: TABLE job_request_attachments; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.job_request_attachments IS 'Bảng lưu trữ ảnh/video đính kèm theo yêu cầu dịch vụ';


--
-- TOC entry 309 (class 1259 OID 29134)
-- Name: job_request_quotes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.job_request_quotes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    job_request_id uuid NOT NULL,
    provider_id uuid NOT NULL,
    amount numeric(18,2) NOT NULL,
    description text,
    estimated_duration_hours integer,
    materials_included boolean DEFAULT false NOT NULL,
    valid_until timestamp with time zone,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_job_request_quotes_status CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'accepted'::character varying, 'rejected'::character varying, 'superseded'::character varying])::text[])))
);


--
-- TOC entry 7659 (class 0 OID 0)
-- Dependencies: 309
-- Name: TABLE job_request_quotes; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.job_request_quotes IS 'Bảng lưu trữ báo giá chi tiết từ nhà cung cấp';


--
-- TOC entry 310 (class 1259 OID 29168)
-- Name: job_request_status_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.job_request_status_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    job_request_id uuid NOT NULL,
    from_status character varying(40),
    to_status character varying(40) NOT NULL,
    changed_by uuid,
    note text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- TOC entry 7660 (class 0 OID 0)
-- Dependencies: 310
-- Name: TABLE job_request_status_logs; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.job_request_status_logs IS 'Bảng lưu lịch sử chuyển đổi trạng thái của yêu cầu';


--
-- TOC entry 307 (class 1259 OID 29066)
-- Name: job_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.job_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    customer_user_id uuid NOT NULL,
    provider_id uuid,
    provider_service_id uuid,
    title character varying(200) NOT NULL,
    description text NOT NULL,
    address_text text NOT NULL,
    latitude numeric(10,7),
    longitude numeric(10,7),
    preferred_visit_time timestamp with time zone,
    survey_required boolean DEFAULT false NOT NULL,
    survey_scheduled_at timestamp with time zone,
    scheduled_at timestamp with time zone,
    quoted_amount numeric(18,2),
    quote_note text,
    quoted_at timestamp with time zone,
    status character varying(40) DEFAULT 'new_request'::character varying NOT NULL,
    cancel_reason text,
    reject_reason text,
    accepted_at timestamp with time zone,
    approved_at timestamp with time zone,
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    confirmed_at timestamp with time zone,
    cancelled_at timestamp with time zone,
    disputed_at timestamp with time zone,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_job_requests_status CHECK (((status)::text = ANY ((ARRAY['new_request'::character varying, 'provider_accepted'::character varying, 'survey_scheduled'::character varying, 'quoted'::character varying, 'customer_approved'::character varying, 'in_progress'::character varying, 'provider_completed'::character varying, 'customer_confirmed'::character varying, 'reviewed'::character varying, 'quote_rejected'::character varying, 'cancelled_by_customer'::character varying, 'cancelled_by_provider'::character varying, 'disputed'::character varying])::text[])))
);


--
-- TOC entry 7661 (class 0 OID 0)
-- Dependencies: 307
-- Name: TABLE job_requests; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.job_requests IS 'Bảng lưu trữ thông tin yêu cầu dịch vụ của khách hàng (Flow A)';


--
-- TOC entry 294 (class 1259 OID 28734)
-- Name: landing_banners; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.landing_banners (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    page_key character varying(50) DEFAULT 'landing_home'::character varying NOT NULL,
    banner_key character varying(50) NOT NULL,
    title character varying(255),
    subtitle text,
    description text,
    image_url text NOT NULL,
    mobile_image_url text,
    button_text character varying(100),
    button_link text,
    button_target character varying(20) DEFAULT '_self'::character varying NOT NULL,
    badge_text character varying(100),
    sort_order integer DEFAULT 0 NOT NULL,
    start_at timestamp with time zone,
    end_at timestamp with time zone,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- TOC entry 295 (class 1259 OID 28760)
-- Name: landing_sections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.landing_sections (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    page_key character varying(50) DEFAULT 'landing_home'::character varying NOT NULL,
    section_key character varying(100) NOT NULL,
    section_type character varying(50) NOT NULL,
    title character varying(255),
    subtitle text,
    content text,
    image_url text,
    icon character varying(100),
    config_json jsonb,
    sort_order integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- TOC entry 287 (class 1259 OID 28533)
-- Name: notification_campaigns; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notification_campaigns (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(200) NOT NULL,
    target_roles jsonb,
    target_tags jsonb,
    target_filter jsonb,
    channel character varying(30) DEFAULT 'push'::character varying NOT NULL,
    title character varying(200) NOT NULL,
    body text NOT NULL,
    deep_link character varying(500),
    status character varying(30) DEFAULT 'draft'::character varying NOT NULL,
    scheduled_at timestamp with time zone,
    sent_at timestamp with time zone,
    target_count integer DEFAULT 0 NOT NULL,
    sent_count integer DEFAULT 0 NOT NULL,
    opened_count integer DEFAULT 0 NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_nc_channel CHECK (((channel)::text = ANY ((ARRAY['push'::character varying, 'zalo_oa'::character varying, 'sms'::character varying, 'email'::character varying])::text[]))),
    CONSTRAINT chk_nc_status CHECK (((status)::text = ANY ((ARRAY['draft'::character varying, 'scheduled'::character varying, 'sending'::character varying, 'sent'::character varying, 'failed'::character varying])::text[])))
);


--
-- TOC entry 272 (class 1259 OID 28025)
-- Name: notification_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notification_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    notification_type character varying(50) NOT NULL,
    is_enabled boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- TOC entry 271 (class 1259 OID 28003)
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    type character varying(50) NOT NULL,
    title character varying(200) NOT NULL,
    body text,
    data jsonb,
    is_read boolean DEFAULT false NOT NULL,
    read_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- TOC entry 231 (class 1259 OID 26701)
-- Name: otp_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.otp_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    phone character varying(20) NOT NULL,
    otp_code_hash text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    attempt_count integer DEFAULT 0 NOT NULL,
    is_used boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- TOC entry 267 (class 1259 OID 27858)
-- Name: payment_transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payment_transactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    booking_id uuid NOT NULL,
    user_id uuid NOT NULL,
    amount numeric(18,2) NOT NULL,
    method character varying(30) NOT NULL,
    gateway_ref character varying(200),
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    paid_at timestamp with time zone,
    refunded_at timestamp with time zone,
    refund_amount numeric(18,2),
    metadata jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_pt_method CHECK (((method)::text = ANY ((ARRAY['cash'::character varying, 'wallet'::character varying, 'vnpay'::character varying, 'momo'::character varying, 'zalopay'::character varying])::text[]))),
    CONSTRAINT chk_pt_status CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'completed'::character varying, 'failed'::character varying, 'refunded'::character varying])::text[])))
);


--
-- TOC entry 273 (class 1259 OID 28048)
-- Name: post_categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.post_categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code character varying(50) NOT NULL,
    name character varying(255) NOT NULL,
    slug character varying(255) NOT NULL,
    description text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_by uuid
);


--
-- TOC entry 275 (class 1259 OID 28143)
-- Name: post_media; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.post_media (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    post_id uuid NOT NULL,
    media_type character varying(30) NOT NULL,
    file_url text NOT NULL,
    thumbnail_url text,
    title character varying(255),
    alt_text character varying(255),
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_post_media_type CHECK (((media_type)::text = ANY ((ARRAY['image'::character varying, 'video'::character varying, 'file'::character varying])::text[])))
);


--
-- TOC entry 274 (class 1259 OID 28080)
-- Name: posts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.posts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    category_id uuid,
    author_user_id uuid,
    provider_id uuid,
    industry_category_id uuid,
    service_category_id uuid,
    title character varying(500) NOT NULL,
    slug character varying(500) NOT NULL,
    summary text,
    content text NOT NULL,
    cover_image_url text,
    seo_title character varying(255),
    seo_description text,
    post_type character varying(30) DEFAULT 'article'::character varying NOT NULL,
    status character varying(30) DEFAULT 'draft'::character varying NOT NULL,
    visibility character varying(30) DEFAULT 'public'::character varying NOT NULL,
    published_at timestamp with time zone,
    expired_at timestamp with time zone,
    is_featured boolean DEFAULT false NOT NULL,
    allow_indexing boolean DEFAULT true NOT NULL,
    view_count integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid,
    CONSTRAINT chk_posts_status CHECK (((status)::text = ANY ((ARRAY['draft'::character varying, 'pending_review'::character varying, 'published'::character varying, 'hidden'::character varying, 'archived'::character varying])::text[]))),
    CONSTRAINT chk_posts_type CHECK (((post_type)::text = ANY ((ARRAY['article'::character varying, 'promotion'::character varying, 'provider_profile'::character varying, 'announcement'::character varying, 'seo_landing'::character varying])::text[]))),
    CONSTRAINT chk_posts_visibility CHECK (((visibility)::text = ANY ((ARRAY['public'::character varying, 'private'::character varying, 'provider_only'::character varying])::text[])))
);


--
-- TOC entry 259 (class 1259 OID 27605)
-- Name: price_configs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.price_configs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    service_type character varying(50) NOT NULL,
    pricing_mode character varying(20) DEFAULT 'formula'::character varying NOT NULL,
    base_fare numeric(18,2),
    fare_per_km numeric(18,2),
    fare_per_min numeric(18,2),
    min_fare numeric(18,2),
    surge_enabled boolean DEFAULT false NOT NULL,
    surge_multiplier numeric(4,2) DEFAULT 1.0,
    quote_timeout_sec integer DEFAULT 120,
    accept_timeout_sec integer DEFAULT 60,
    min_quote numeric(18,2),
    max_quote numeric(18,2),
    effective_from timestamp with time zone DEFAULT now() NOT NULL,
    effective_to timestamp with time zone,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_price_configs_pricing_mode CHECK (((pricing_mode)::text = ANY ((ARRAY['formula'::character varying, 'driver_quote'::character varying])::text[])))
);


--
-- TOC entry 269 (class 1259 OID 27929)
-- Name: promotion_usages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.promotion_usages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    promotion_id uuid NOT NULL,
    user_id uuid NOT NULL,
    booking_id uuid NOT NULL,
    discount_amount numeric(18,2) NOT NULL,
    used_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- TOC entry 268 (class 1259 OID 27897)
-- Name: promotions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.promotions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code character varying(50) NOT NULL,
    name character varying(200) NOT NULL,
    type character varying(30) NOT NULL,
    value numeric(18,2) NOT NULL,
    max_discount numeric(18,2),
    min_fare numeric(18,2),
    usage_limit integer,
    used_count integer DEFAULT 0 NOT NULL,
    per_user_limit integer DEFAULT 1,
    valid_from timestamp with time zone NOT NULL,
    valid_to timestamp with time zone NOT NULL,
    service_types jsonb,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_promotions_date_range CHECK ((valid_to > valid_from)),
    CONSTRAINT chk_promotions_type CHECK (((type)::text = ANY ((ARRAY['percent'::character varying, 'fixed'::character varying, 'free_trip'::character varying])::text[]))),
    CONSTRAINT chk_promotions_value_positive CHECK ((value > (0)::numeric))
);


--
-- TOC entry 235 (class 1259 OID 26812)
-- Name: provider_business_profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.provider_business_profiles (
    provider_id uuid NOT NULL,
    company_name character varying(255) NOT NULL,
    exe_year integer,
    legal_name character varying(255),
    tax_code character varying(50),
    business_license_number character varying(100),
    representative_name character varying(255),
    representative_position character varying(255),
    founded_date date,
    hotline character varying(20),
    website_url text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_by uuid
);


--
-- TOC entry 292 (class 1259 OID 28690)
-- Name: provider_contact_request_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.provider_contact_request_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    contact_request_id uuid NOT NULL,
    from_status character varying(30),
    to_status character varying(30) NOT NULL,
    changed_by_user_id uuid,
    note text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- TOC entry 291 (class 1259 OID 28646)
-- Name: provider_contact_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.provider_contact_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    customer_user_id uuid NOT NULL,
    provider_id uuid NOT NULL,
    provider_service_id uuid,
    contact_mode character varying(30) DEFAULT 'direct_reveal'::character varying NOT NULL,
    contact_type character varying(30) DEFAULT 'direct_contact'::character varying NOT NULL,
    customer_name character varying(255),
    customer_phone character varying(20),
    note text,
    status character varying(30) DEFAULT 'created'::character varying NOT NULL,
    revealed_to_customer_at timestamp with time zone,
    revealed_to_provider_at timestamp with time zone,
    provider_response_at timestamp with time zone,
    rejection_reason text,
    ip_address character varying(45),
    user_agent text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_pcr_contact_mode CHECK (((contact_mode)::text = ANY ((ARRAY['direct_reveal'::character varying, 'request_then_accept'::character varying])::text[]))),
    CONSTRAINT chk_pcr_contact_type CHECK (((contact_type)::text = ANY ((ARRAY['direct_contact'::character varying, 'callback_request'::character varying])::text[]))),
    CONSTRAINT chk_pcr_status CHECK (((status)::text = ANY ((ARRAY['created'::character varying, 'revealed'::character varying, 'closed'::character varying, 'expired'::character varying, 'pending_provider_response'::character varying, 'accepted'::character varying, 'rejected'::character varying, 'cancelled'::character varying])::text[])))
);


--
-- TOC entry 245 (class 1259 OID 27178)
-- Name: provider_document_services; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.provider_document_services (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    provider_document_id uuid NOT NULL,
    provider_service_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- TOC entry 236 (class 1259 OID 26840)
-- Name: provider_documents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.provider_documents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    provider_id uuid NOT NULL,
    document_type character varying(50) NOT NULL,
    document_name character varying(255),
    document_number character varying(100),
    issued_by character varying(255),
    issued_date date,
    expiry_date date,
    front_file_url text,
    back_file_url text,
    extra_file_url text,
    verification_status character varying(30) DEFAULT 'pending'::character varying NOT NULL,
    reviewed_by uuid,
    reviewed_at timestamp with time zone,
    rejection_reason text,
    note text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_by uuid,
    license_class character varying(10),
    CONSTRAINT chk_license_class_values CHECK (((license_class IS NULL) OR ((license_class)::text = ANY ((ARRAY['A1'::character varying, 'A2'::character varying, 'B1'::character varying, 'B2'::character varying, 'C'::character varying, 'D'::character varying, 'E'::character varying, 'FC'::character varying])::text[])))),
    CONSTRAINT chk_provider_documents_status CHECK (((verification_status)::text = ANY ((ARRAY['pending'::character varying, 'approved'::character varying, 'rejected'::character varying, 'expired'::character varying])::text[])))
);


--
-- TOC entry 7662 (class 0 OID 0)
-- Dependencies: 236
-- Name: COLUMN provider_documents.license_class; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.provider_documents.license_class IS 'Hạng bằng lái xe (A1/A2/B1/B2/C/D/E/FC). Chỉ áp dụng khi document_type = driving_license.';


--
-- TOC entry 248 (class 1259 OID 27268)
-- Name: provider_import_job_rows; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.provider_import_job_rows (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    job_id uuid NOT NULL,
    row_number integer NOT NULL,
    name character varying(255),
    phone_raw character varying(50),
    phone_normalized character varying(20),
    address text,
    industry_code character varying(50),
    service_code character varying(50),
    url text,
    latitude numeric(10,7),
    longitude numeric(10,7),
    source character varying(100),
    role character varying(50),
    status_raw character varying(50),
    mapped_industry_category_id uuid,
    mapped_service_category_id uuid,
    validation_status character varying(30) DEFAULT 'pending'::character varying NOT NULL,
    validation_errors_json jsonb,
    duplicate_type character varying(50),
    import_result_status character varying(30) DEFAULT 'pending'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_pijr_import_result_status CHECK (((import_result_status)::text = ANY ((ARRAY['pending'::character varying, 'success'::character varying, 'failed'::character varying, 'skipped'::character varying])::text[]))),
    CONSTRAINT chk_pijr_validation_status CHECK (((validation_status)::text = ANY ((ARRAY['pending'::character varying, 'valid'::character varying, 'invalid'::character varying, 'duplicate'::character varying, 'warning'::character varying])::text[])))
);


--
-- TOC entry 7663 (class 0 OID 0)
-- Dependencies: 248
-- Name: TABLE provider_import_job_rows; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.provider_import_job_rows IS 'Lưu trữ dữ liệu thô và kết quả validate cho từng dòng trong file Excel import.';


--
-- TOC entry 7664 (class 0 OID 0)
-- Dependencies: 248
-- Name: COLUMN provider_import_job_rows.duplicate_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.provider_import_job_rows.duplicate_type IS 'Loại duplicate: duplicate_same_service (cùng phone, cùng service) hoặc duplicate_phone_new_service (cùng phone, khác service)';


--
-- TOC entry 247 (class 1259 OID 27238)
-- Name: provider_import_jobs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.provider_import_jobs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    file_name character varying(255) NOT NULL,
    status character varying(30) DEFAULT 'uploaded'::character varying NOT NULL,
    total_rows integer DEFAULT 0 NOT NULL,
    valid_rows integer DEFAULT 0 NOT NULL,
    invalid_rows integer DEFAULT 0 NOT NULL,
    duplicate_rows integer DEFAULT 0 NOT NULL,
    imported_rows integer DEFAULT 0 NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    confirmed_at timestamp with time zone,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_provider_import_jobs_status CHECK (((status)::text = ANY ((ARRAY['uploaded'::character varying, 'validated'::character varying, 'confirmed'::character varying, 'failed'::character varying])::text[])))
);


--
-- TOC entry 7665 (class 0 OID 0)
-- Dependencies: 247
-- Name: TABLE provider_import_jobs; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.provider_import_jobs IS 'Quản lý các đợt import thợ từ file Excel của admin.';


--
-- TOC entry 249 (class 1259 OID 27302)
-- Name: provider_import_metadata; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.provider_import_metadata (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    provider_id uuid NOT NULL,
    source character varying(100),
    source_url text,
    raw_name character varying(255),
    raw_phone character varying(50),
    raw_address text,
    latitude numeric(10,7),
    longitude numeric(10,7),
    import_job_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- TOC entry 7666 (class 0 OID 0)
-- Dependencies: 249
-- Name: TABLE provider_import_metadata; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.provider_import_metadata IS 'Lưu trữ thông tin nguồn gốc của các provider được import từ Excel.';


--
-- TOC entry 234 (class 1259 OID 26787)
-- Name: provider_individual_profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.provider_individual_profiles (
    provider_id uuid NOT NULL,
    full_name character varying(255),
    exe_year integer,
    cccd character varying(50),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_by uuid
);


--
-- TOC entry 246 (class 1259 OID 27205)
-- Name: provider_locations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.provider_locations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    provider_id uuid NOT NULL,
    provider_service_id uuid,
    latitude numeric(10,7) NOT NULL,
    longitude numeric(10,7) NOT NULL,
    location public.geography(Point,4326) NOT NULL,
    address_text text,
    source character varying(50),
    is_primary boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- TOC entry 7667 (class 0 OID 0)
-- Dependencies: 246
-- Name: TABLE provider_locations; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.provider_locations IS 'Lưu trữ vị trí của provider/service phục vụ tính năng tìm kiếm thợ ở gần (phi vận tải).';


--
-- TOC entry 244 (class 1259 OID 27155)
-- Name: provider_service_attributes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.provider_service_attributes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    provider_service_id uuid NOT NULL,
    attr_key character varying(100) NOT NULL,
    value_text text,
    value_number numeric(18,2),
    value_boolean boolean,
    value_json jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid
);


--
-- TOC entry 243 (class 1259 OID 27098)
-- Name: provider_services; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.provider_services (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    provider_id uuid NOT NULL,
    industry_category_id uuid NOT NULL,
    service_category_id uuid NOT NULL,
    service_skill_id uuid,
    exe_year integer,
    pricing_type character varying(30) DEFAULT 'negotiable'::character varying NOT NULL,
    base_price numeric(18,2),
    price_unit character varying(30),
    description text,
    is_primary boolean DEFAULT false NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    verification_status character varying(30) DEFAULT 'pending'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_by uuid,
    CONSTRAINT chk_provider_services_pricing_type CHECK (((pricing_type)::text = ANY ((ARRAY['negotiable'::character varying, 'fixed'::character varying, 'hourly'::character varying, 'survey'::character varying])::text[]))),
    CONSTRAINT chk_provider_services_verification_status CHECK (((verification_status)::text = ANY ((ARRAY['pending'::character varying, 'approved'::character varying, 'rejected'::character varying])::text[])))
);


--
-- TOC entry 237 (class 1259 OID 26878)
-- Name: provider_status_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.provider_status_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    provider_id uuid NOT NULL,
    old_status character varying(30),
    new_status character varying(30) NOT NULL,
    changed_by uuid,
    reason text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- TOC entry 258 (class 1259 OID 27583)
-- Name: provider_vehicle_availabilities; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.provider_vehicle_availabilities (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    vehicle_id uuid NOT NULL,
    date date NOT NULL,
    is_blocked boolean DEFAULT true NOT NULL,
    blocked_reason text
);


--
-- TOC entry 255 (class 1259 OID 27491)
-- Name: provider_vehicle_documents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.provider_vehicle_documents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    vehicle_id uuid NOT NULL,
    document_type character varying(50) NOT NULL,
    document_number character varying(100),
    issued_date date,
    expiry_date date,
    file_url text,
    review_status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    reviewed_by uuid,
    reviewed_at timestamp with time zone,
    review_note text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_by uuid,
    CONSTRAINT chk_pvd_review_status CHECK (((review_status)::text = ANY ((ARRAY['pending'::character varying, 'approved'::character varying, 'rejected'::character varying, 'expired'::character varying])::text[])))
);


--
-- TOC entry 254 (class 1259 OID 27448)
-- Name: provider_vehicles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.provider_vehicles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    provider_id uuid NOT NULL,
    service_id uuid,
    vehicle_type character varying(50) NOT NULL,
    vehicle_brand character varying(100),
    vehicle_model character varying(100),
    year_of_manufacture integer,
    license_plate character varying(20),
    seat_count integer,
    fuel_type character varying(20),
    transmission character varying(20),
    has_ac boolean DEFAULT false NOT NULL,
    has_wifi boolean DEFAULT false NOT NULL,
    color character varying(50),
    status character varying(20) DEFAULT 'active'::character varying NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_by uuid,
    images json,
    description text,
    rental_terms text,
    deposit_amount numeric(18,2),
    delivery_options json,
    CONSTRAINT chk_provider_vehicles_status CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'inactive'::character varying, 'blocked'::character varying, 'suspended'::character varying])::text[])))
);


--
-- TOC entry 233 (class 1259 OID 26744)
-- Name: providers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.providers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    owner_user_id uuid NOT NULL,
    provider_type character varying(20) NOT NULL,
    description text,
    verification_status character varying(30) DEFAULT 'pending'::character varying NOT NULL,
    status character varying(30) DEFAULT 'active'::character varying NOT NULL,
    avg_rating numeric(3,2) DEFAULT 0 NOT NULL,
    total_reviews integer DEFAULT 0 NOT NULL,
    total_jobs_completed integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_by uuid,
    CONSTRAINT chk_providers_status CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'inactive'::character varying, 'blocked'::character varying])::text[]))),
    CONSTRAINT chk_providers_type CHECK (((provider_type)::text = ANY ((ARRAY['individual'::character varying, 'business'::character varying])::text[]))),
    CONSTRAINT chk_providers_verification_status CHECK (((verification_status)::text = ANY ((ARRAY['pending'::character varying, 'approved'::character varying, 'rejected'::character varying, 'suspended'::character varying])::text[])))
);


--
-- TOC entry 232 (class 1259 OID 26722)
-- Name: refresh_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.refresh_tokens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    jti character varying(64) NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    revoked_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- TOC entry 312 (class 1259 OID 29246)
-- Name: reservation_request_options; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reservation_request_options (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    reservation_request_id uuid NOT NULL,
    provider_id uuid NOT NULL,
    title character varying(255) NOT NULL,
    description text,
    price numeric(18,2),
    price_note character varying(255),
    valid_until timestamp with time zone,
    is_selected boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT reservation_request_options_price_check CHECK ((price > (0)::numeric))
);


--
-- TOC entry 7668 (class 0 OID 0)
-- Dependencies: 312
-- Name: TABLE reservation_request_options; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.reservation_request_options IS 'Bảng lưu trữ các phương án tư vấn do provider gửi cho khách hàng chọn';


--
-- TOC entry 313 (class 1259 OID 29283)
-- Name: reservation_request_status_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reservation_request_status_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    reservation_request_id uuid NOT NULL,
    from_status character varying(30),
    to_status character varying(30) NOT NULL,
    changed_by uuid,
    note text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- TOC entry 7669 (class 0 OID 0)
-- Dependencies: 313
-- Name: TABLE reservation_request_status_logs; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.reservation_request_status_logs IS 'Bảng lưu lịch sử chuyển đổi trạng thái của yêu cầu tư vấn';


--
-- TOC entry 311 (class 1259 OID 29207)
-- Name: reservation_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reservation_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    customer_user_id uuid NOT NULL,
    provider_id uuid,
    provider_service_id uuid,
    request_type character varying(50) NOT NULL,
    destination character varying(300),
    start_date date,
    end_date date,
    travelers_count integer,
    budget_range character varying(100),
    note text,
    status character varying(30) DEFAULT 'requested'::character varying NOT NULL,
    cancel_reason text,
    selected_option_id uuid,
    assigned_at timestamp with time zone,
    consulting_at timestamp with time zone,
    options_sent_at timestamp with time zone,
    selected_at timestamp with time zone,
    confirmed_at timestamp with time zone,
    completed_at timestamp with time zone,
    cancelled_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_reservation_requests_status CHECK (((status)::text = ANY ((ARRAY['requested'::character varying, 'assigned'::character varying, 'consulting'::character varying, 'options_sent'::character varying, 'customer_selected'::character varying, 'confirmed'::character varying, 'completed'::character varying, 'reviewed'::character varying, 'cancelled'::character varying, 'closed_unconverted'::character varying])::text[]))),
    CONSTRAINT reservation_requests_travelers_count_check CHECK (((travelers_count >= 1) AND (travelers_count <= 500)))
);


--
-- TOC entry 7670 (class 0 OID 0)
-- Dependencies: 311
-- Name: TABLE reservation_requests; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.reservation_requests IS 'Bảng lưu trữ yêu cầu tư vấn du lịch/đặt dịch vụ của khách hàng (Flow D)';


--
-- TOC entry 270 (class 1259 OID 27964)
-- Name: reviews; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reviews (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    booking_id uuid,
    reviewer_id uuid NOT NULL,
    reviewee_id uuid NOT NULL,
    reviewer_role character varying(20) NOT NULL,
    rating smallint NOT NULL,
    comment text,
    is_visible boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    appointment_id uuid,
    tutor_request_id uuid,
    CONSTRAINT chk_reviews_rating_range CHECK (((rating >= 1) AND (rating <= 5)))
);


--
-- TOC entry 7671 (class 0 OID 0)
-- Dependencies: 270
-- Name: COLUMN reviews.appointment_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.reviews.appointment_id IS 'UUID của service appointment liên quan (Flow B)';


--
-- TOC entry 301 (class 1259 OID 28850)
-- Name: service_appointments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.service_appointments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    customer_user_id uuid NOT NULL,
    provider_id uuid NOT NULL,
    provider_service_id uuid NOT NULL,
    service_date date NOT NULL,
    start_time time without time zone NOT NULL,
    end_time time without time zone,
    duration_minutes integer,
    address_text text NOT NULL,
    latitude numeric(10,7),
    longitude numeric(10,7),
    note text,
    status character varying(32) DEFAULT 'requested'::character varying NOT NULL,
    patient_name character varying(100),
    patient_age integer,
    patient_gender character varying(10),
    care_note text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_service_appointments_status CHECK (((status)::text = ANY ((ARRAY['requested'::character varying, 'accepted'::character varying, 'reschedule_requested'::character varying, 'scheduled'::character varying, 'in_service'::character varying, 'provider_completed'::character varying, 'customer_confirmed'::character varying, 'reviewed'::character varying, 'rejected'::character varying, 'cancelled_by_customer'::character varying, 'cancelled_by_provider'::character varying, 'disputed'::character varying])::text[])))
);


--
-- TOC entry 7672 (class 0 OID 0)
-- Dependencies: 301
-- Name: TABLE service_appointments; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.service_appointments IS 'Bảng lưu trữ chi tiết các cuộc hẹn dịch vụ theo ca/giờ/buổi (Flow B)';


--
-- TOC entry 239 (class 1259 OID 26946)
-- Name: service_categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.service_categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    industry_category_id uuid NOT NULL,
    code character varying(50),
    name character varying(255),
    slug character varying(255),
    icon_url character varying(255),
    description text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_by uuid,
    module_type character varying(50)
);


--
-- TOC entry 241 (class 1259 OID 27014)
-- Name: service_category_attributes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.service_category_attributes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    service_category_id uuid NOT NULL,
    attr_key character varying(100) NOT NULL,
    attr_label character varying(255) NOT NULL,
    data_type character varying(30) NOT NULL,
    is_required boolean DEFAULT false NOT NULL,
    is_filterable boolean DEFAULT false NOT NULL,
    is_searchable boolean DEFAULT false NOT NULL,
    default_value text,
    placeholder text,
    help_text text,
    options_json jsonb,
    validation_json jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_by uuid,
    CONSTRAINT chk_service_category_attributes_data_type CHECK (((data_type)::text = ANY ((ARRAY['text'::character varying, 'textarea'::character varying, 'number'::character varying, 'boolean'::character varying, 'date'::character varying, 'select'::character varying, 'multiselect'::character varying, 'json'::character varying])::text[])))
);


--
-- TOC entry 242 (class 1259 OID 27055)
-- Name: service_category_requirements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.service_category_requirements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    service_category_id uuid NOT NULL,
    requirement_type character varying(50) NOT NULL,
    requirement_code character varying(100) NOT NULL,
    requirement_name character varying(255) NOT NULL,
    description text,
    is_required boolean DEFAULT true NOT NULL,
    applies_to_provider_type character varying(20) DEFAULT 'all'::character varying NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_by uuid,
    CONSTRAINT chk_service_category_requirements_provider_type CHECK (((applies_to_provider_type)::text = ANY ((ARRAY['individual'::character varying, 'business'::character varying, 'all'::character varying])::text[])))
);


--
-- TOC entry 257 (class 1259 OID 27557)
-- Name: service_route_schedules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.service_route_schedules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    route_id uuid NOT NULL,
    departure_time time without time zone NOT NULL,
    seat_count integer NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- TOC entry 256 (class 1259 OID 27531)
-- Name: service_routes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.service_routes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    provider_service_id uuid NOT NULL,
    from_province character varying(100) NOT NULL,
    to_province character varying(100) NOT NULL,
    distance_km numeric(8,2),
    duration_min integer,
    price numeric(18,2) NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- TOC entry 240 (class 1259 OID 26979)
-- Name: service_skills; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.service_skills (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    service_category_id uuid NOT NULL,
    code character varying(50) NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_by uuid
);


--
-- TOC entry 300 (class 1259 OID 28830)
-- Name: setting_audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.setting_audit_logs (
    id integer NOT NULL,
    setting_id integer NOT NULL,
    old_value text,
    new_value text,
    changed_by character varying(100) NOT NULL,
    changed_at timestamp with time zone DEFAULT now() NOT NULL,
    ip_address character varying(45),
    reason text
);


--
-- TOC entry 7673 (class 0 OID 0)
-- Dependencies: 300
-- Name: TABLE setting_audit_logs; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.setting_audit_logs IS 'Lưu vết thay đổi lịch sử cấu hình động để phục vụ audit.';


--
-- TOC entry 299 (class 1259 OID 28829)
-- Name: setting_audit_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.setting_audit_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 7674 (class 0 OID 0)
-- Dependencies: 299
-- Name: setting_audit_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.setting_audit_logs_id_seq OWNED BY public.setting_audit_logs.id;


--
-- TOC entry 293 (class 1259 OID 28715)
-- Name: site_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.site_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    setting_key character varying(100) NOT NULL,
    setting_value_text text,
    setting_value_json jsonb,
    description text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- TOC entry 281 (class 1259 OID 28328)
-- Name: support_ticket_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.support_ticket_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    ticket_id uuid NOT NULL,
    sender_id uuid NOT NULL,
    message text NOT NULL,
    attachments jsonb,
    is_internal boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- TOC entry 280 (class 1259 OID 28279)
-- Name: support_tickets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.support_tickets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    booking_id uuid,
    subject character varying(200) NOT NULL,
    category character varying(50) NOT NULL,
    status character varying(30) DEFAULT 'open'::character varying NOT NULL,
    priority character varying(20) DEFAULT 'normal'::character varying NOT NULL,
    assigned_to uuid,
    first_response_at timestamp with time zone,
    resolved_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    against_id uuid,
    dispute_type character varying(50),
    resolution text,
    fare_adjustment numeric(18,2),
    resolved_by uuid,
    CONSTRAINT chk_support_tickets_category CHECK (((category)::text = ANY ((ARRAY['account'::character varying, 'billing'::character varying, 'app_bug'::character varying, 'driver_issue'::character varying, 'payment'::character varying, 'general'::character varying])::text[]))),
    CONSTRAINT chk_support_tickets_priority CHECK (((priority)::text = ANY ((ARRAY['low'::character varying, 'normal'::character varying, 'high'::character varying, 'urgent'::character varying])::text[]))),
    CONSTRAINT chk_support_tickets_status CHECK (((status)::text = ANY ((ARRAY['open'::character varying, 'assigned'::character varying, 'in_progress'::character varying, 'waiting_user'::character varying, 'resolved'::character varying, 'closed'::character varying])::text[])))
);


--
-- TOC entry 7675 (class 0 OID 0)
-- Dependencies: 280
-- Name: COLUMN support_tickets.resolved_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.support_tickets.resolved_at IS 'Thời điểm ticket/dispute được giải quyết';


--
-- TOC entry 7676 (class 0 OID 0)
-- Dependencies: 280
-- Name: COLUMN support_tickets.against_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.support_tickets.against_id IS 'Người bịKhiếu nại:
 - Khi dispute có booking_id: against_id = booking.provider_id (UUID từ bảng providers)
 - Khi dispute không có booking_id: against_id = user_id bị khiếu nại (UUID từ bảng users)
 - Lưu ý: Không còn FK constraint, phải validate trong application logic';


--
-- TOC entry 7677 (class 0 OID 0)
-- Dependencies: 280
-- Name: COLUMN support_tickets.dispute_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.support_tickets.dispute_type IS 'Loại khiếu nại: wrong_fare, driver_behavior, vehicle_condition, safety, accident, other';


--
-- TOC entry 7678 (class 0 OID 0)
-- Dependencies: 280
-- Name: COLUMN support_tickets.resolution; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.support_tickets.resolution IS 'Nội dung giải quyết dispute';


--
-- TOC entry 7679 (class 0 OID 0)
-- Dependencies: 280
-- Name: COLUMN support_tickets.fare_adjustment; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.support_tickets.fare_adjustment IS 'Điều chỉnh giá (VND) nếu có';


--
-- TOC entry 7680 (class 0 OID 0)
-- Dependencies: 280
-- Name: COLUMN support_tickets.resolved_by; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.support_tickets.resolved_by IS 'Admin đã giải quyết dispute';


--
-- TOC entry 314 (class 1259 OID 29308)
-- Name: tutor_request_applications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tutor_request_applications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tutor_request_id uuid NOT NULL,
    provider_id uuid NOT NULL,
    provider_user_id uuid NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    message text,
    proposed_schedule text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_tutor_request_applications_status CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'accepted'::character varying, 'rejected'::character varying, 'withdrawn'::character varying])::text[])))
);


--
-- TOC entry 7681 (class 0 OID 0)
-- Dependencies: 314
-- Name: TABLE tutor_request_applications; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.tutor_request_applications IS 'Bảng lưu trữ hồ sơ ứng tuyển của gia sư vào một yêu cầu tìm gia sư';


--
-- TOC entry 306 (class 1259 OID 29028)
-- Name: tutor_request_status_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tutor_request_status_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tutor_request_id uuid NOT NULL,
    from_status character varying(32),
    to_status character varying(32) NOT NULL,
    changed_by uuid,
    changed_role character varying(20) NOT NULL,
    reason text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_tutor_request_status_logs_changed_role CHECK (((changed_role)::text = ANY ((ARRAY['customer'::character varying, 'provider'::character varying, 'admin'::character varying, 'system'::character varying])::text[])))
);


--
-- TOC entry 7682 (class 0 OID 0)
-- Dependencies: 306
-- Name: TABLE tutor_request_status_logs; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.tutor_request_status_logs IS 'Bảng lưu lịch sử chuyển đổi trạng thái của yêu cầu gia sư';


--
-- TOC entry 304 (class 1259 OID 28949)
-- Name: tutor_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tutor_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    customer_user_id uuid NOT NULL,
    provider_id uuid,
    subject character varying(100) NOT NULL,
    grade_level character varying(50),
    teaching_mode character varying(20) DEFAULT 'offline'::character varying NOT NULL,
    address_text text,
    latitude numeric(10,7),
    longitude numeric(10,7),
    schedule_preference text NOT NULL,
    note text,
    status character varying(32) DEFAULT 'requested'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    service_category_id uuid NOT NULL,
    CONSTRAINT chk_tutor_requests_status CHECK (((status)::text = ANY ((ARRAY['requested'::character varying, 'matched'::character varying, 'trial_scheduled'::character varying, 'trial_completed'::character varying, 'trial_failed'::character varying, 'active_sessions'::character varying, 'completed'::character varying, 'closed'::character varying, 'reviewed'::character varying, 'rejected'::character varying, 'cancelled'::character varying])::text[]))),
    CONSTRAINT chk_tutor_requests_teaching_mode CHECK (((teaching_mode)::text = ANY ((ARRAY['online'::character varying, 'offline'::character varying, 'hybrid'::character varying])::text[])))
);


--
-- TOC entry 7683 (class 0 OID 0)
-- Dependencies: 304
-- Name: TABLE tutor_requests; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.tutor_requests IS 'Bảng lưu trữ yêu cầu tìm gia sư và thông tin lớp học (Flow C)';


--
-- TOC entry 305 (class 1259 OID 28991)
-- Name: tutor_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tutor_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tutor_request_id uuid NOT NULL,
    provider_id uuid NOT NULL,
    session_type character varying(20) NOT NULL,
    session_date date NOT NULL,
    start_time time without time zone NOT NULL,
    end_time time without time zone NOT NULL,
    status character varying(32) DEFAULT 'scheduled'::character varying NOT NULL,
    note text,
    tutor_report text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_tutor_sessions_session_type CHECK (((session_type)::text = ANY ((ARRAY['trial'::character varying, 'regular'::character varying])::text[]))),
    CONSTRAINT chk_tutor_sessions_status CHECK (((status)::text = ANY ((ARRAY['scheduled'::character varying, 'in_progress'::character varying, 'provider_completed'::character varying, 'customer_confirmed'::character varying, 'completed'::character varying, 'cancelled'::character varying])::text[])))
);


--
-- TOC entry 7684 (class 0 OID 0)
-- Dependencies: 305
-- Name: TABLE tutor_sessions; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.tutor_sessions IS 'Bảng lưu trữ chi tiết từng buổi học thử hoặc buổi học chính thức';


--
-- TOC entry 251 (class 1259 OID 27367)
-- Name: user_identity_files; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_identity_files (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    verification_id uuid NOT NULL,
    file_type character varying(30) NOT NULL,
    file_url text NOT NULL,
    storage_provider character varying(50),
    mime_type character varying(100),
    file_size bigint,
    checksum character varying(128),
    uploaded_by_user_id uuid,
    uploaded_at timestamp with time zone DEFAULT now() NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    CONSTRAINT chk_user_identity_files_type CHECK (((file_type)::text = ANY ((ARRAY['id_front'::character varying, 'id_back'::character varying, 'selfie'::character varying, 'liveness_video'::character varying, 'extracted_face'::character varying, 'cropped_id_face'::character varying])::text[])))
);


--
-- TOC entry 253 (class 1259 OID 27414)
-- Name: user_identity_review_decisions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_identity_review_decisions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    verification_id uuid NOT NULL,
    reviewer_user_id uuid NOT NULL,
    decision character varying(30) NOT NULL,
    reason text,
    metadata_json jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_user_identity_review_decisions_decision CHECK (((decision)::text = ANY ((ARRAY['approve'::character varying, 'reject'::character varying, 'request_resubmission'::character varying])::text[])))
);


--
-- TOC entry 252 (class 1259 OID 27394)
-- Name: user_identity_verification_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_identity_verification_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    verification_id uuid NOT NULL,
    step_name character varying(50) NOT NULL,
    provider_name character varying(100),
    request_payload_json jsonb,
    response_payload_json jsonb,
    status character varying(30) NOT NULL,
    score numeric(5,2),
    error_code character varying(50),
    error_message text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_user_identity_verification_logs_status CHECK (((status)::text = ANY ((ARRAY['success'::character varying, 'failed'::character varying, 'skipped'::character varying])::text[])))
);


--
-- TOC entry 250 (class 1259 OID 27330)
-- Name: user_identity_verifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_identity_verifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    verification_type character varying(30) DEFAULT 'cccd'::character varying NOT NULL,
    status character varying(30) DEFAULT 'draft'::character varying NOT NULL,
    review_mode character varying(30) DEFAULT 'hybrid'::character varying NOT NULL,
    full_name_on_id character varying(255),
    date_of_birth_on_id date,
    gender_on_id smallint,
    id_number character varying(50),
    nationality character varying(100),
    place_of_origin text,
    place_of_residence text,
    issue_date date,
    expiry_date date,
    issuing_authority character varying(255),
    extracted_address text,
    ocr_confidence numeric(5,2),
    face_match_score numeric(5,2),
    liveness_score numeric(5,2),
    submitted_at timestamp with time zone,
    processed_at timestamp with time zone,
    reviewed_at timestamp with time zone,
    reviewed_by uuid,
    rejection_reason text,
    note text,
    is_latest boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_user_identity_verifications_gender CHECK (((gender_on_id IS NULL) OR (gender_on_id = ANY (ARRAY[0, 1])))),
    CONSTRAINT chk_user_identity_verifications_review_mode CHECK (((review_mode)::text = ANY ((ARRAY['auto'::character varying, 'manual'::character varying, 'hybrid'::character varying])::text[]))),
    CONSTRAINT chk_user_identity_verifications_status CHECK (((status)::text = ANY ((ARRAY['draft'::character varying, 'submitted'::character varying, 'processing'::character varying, 'approved'::character varying, 'rejected'::character varying, 'expired'::character varying, 'cancelled'::character varying])::text[]))),
    CONSTRAINT chk_user_identity_verifications_type CHECK (((verification_type)::text = ANY ((ARRAY['cccd'::character varying, 'passport'::character varying, 'driver_license'::character varying, 'other'::character varying])::text[])))
);


--
-- TOC entry 279 (class 1259 OID 28249)
-- Name: user_notes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_notes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    note text NOT NULL,
    is_pinned boolean DEFAULT false NOT NULL,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- TOC entry 290 (class 1259 OID 28628)
-- Name: user_presence; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_presence (
    user_id uuid NOT NULL,
    is_online boolean DEFAULT false NOT NULL,
    last_seen_at timestamp with time zone DEFAULT now() NOT NULL,
    connected_device character varying(50),
    ws_instance_id character varying(100),
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- TOC entry 229 (class 1259 OID 26653)
-- Name: user_profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_profiles (
    user_id uuid NOT NULL,
    bio text,
    preferred_language character varying(20) DEFAULT 'vi'::character varying,
    timezone character varying(50) DEFAULT 'Asia/Ho_Chi_Minh'::character varying,
    is_deleted boolean DEFAULT false NOT NULL,
    deleted_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- TOC entry 228 (class 1259 OID 26634)
-- Name: user_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    role_code character varying(30) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_user_roles_role_code CHECK (((role_code)::text = ANY ((ARRAY['customer'::character varying, 'provider_owner'::character varying, 'provider_staff'::character varying, 'admin'::character varying])::text[])))
);


--
-- TOC entry 230 (class 1259 OID 26675)
-- Name: user_status_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_status_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    old_status character varying(30),
    new_status character varying(30),
    changed_by uuid,
    reason text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- TOC entry 278 (class 1259 OID 28224)
-- Name: user_tags; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_tags (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    tag character varying(50) NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- TOC entry 227 (class 1259 OID 26605)
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    phone character varying(20),
    full_name character varying(255),
    password_hash text,
    gender smallint,
    avatar_url text,
    dob date,
    address_line text,
    status character varying(30) DEFAULT 'active'::character varying NOT NULL,
    account_source character varying(30) DEFAULT 'self_register'::character varying NOT NULL,
    phone_verified boolean DEFAULT false NOT NULL,
    claimed_at timestamp with time zone,
    last_login_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    identity_verification_status character varying(30) DEFAULT 'unverified'::character varying NOT NULL,
    identity_verified_at timestamp with time zone,
    latest_identity_verification_id uuid,
    apple_sub character varying(255),
    is_deactivated boolean DEFAULT false NOT NULL,
    deactivated_at timestamp with time zone,
    google_sub character varying(255),
    CONSTRAINT chk_users_account_source CHECK (((account_source)::text = ANY ((ARRAY['self_register'::character varying, 'admin_created'::character varying, 'imported'::character varying, 'apple'::character varying, 'google'::character varying])::text[]))),
    CONSTRAINT chk_users_gender CHECK (((gender IS NULL) OR (gender = ANY (ARRAY[0, 1])))),
    CONSTRAINT chk_users_identity_verification_status CHECK (((identity_verification_status)::text = ANY ((ARRAY['unverified'::character varying, 'pending'::character varying, 'processing'::character varying, 'verified'::character varying, 'rejected'::character varying, 'expired'::character varying])::text[]))),
    CONSTRAINT chk_users_status CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'pending_activation'::character varying, 'suspended'::character varying, 'blocked'::character varying, 'deleted'::character varying])::text[])))
);


--
-- TOC entry 266 (class 1259 OID 27826)
-- Name: wallet_transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.wallet_transactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    wallet_id uuid NOT NULL,
    type character varying(30) NOT NULL,
    amount numeric(18,2) NOT NULL,
    balance_after numeric(18,2) NOT NULL,
    reference_id uuid,
    reference_type character varying(50),
    gateway_ref character varying(200),
    description text,
    status character varying(20) DEFAULT 'completed'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_wt_status CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'completed'::character varying, 'failed'::character varying, 'reversed'::character varying])::text[]))),
    CONSTRAINT chk_wt_type CHECK (((type)::text = ANY ((ARRAY['topup'::character varying, 'payment'::character varying, 'refund'::character varying, 'withdrawal'::character varying, 'earning'::character varying, 'commission'::character varying, 'bonus'::character varying, 'penalty'::character varying, 'adjust'::character varying])::text[])))
);


--
-- TOC entry 265 (class 1259 OID 27798)
-- Name: wallets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.wallets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    balance numeric(18,2) DEFAULT 0 NOT NULL,
    currency character varying(10) DEFAULT 'VND'::character varying NOT NULL,
    is_frozen boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_wallets_balance_floor CHECK ((balance >= ('-500000'::integer)::numeric)),
    CONSTRAINT chk_wallets_currency CHECK (((currency)::text = ANY ((ARRAY['VND'::character varying, 'USD'::character varying])::text[])))
);


--
-- TOC entry 6529 (class 2604 OID 28811)
-- Name: core_settings id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.core_settings ALTER COLUMN id SET DEFAULT nextval('public.core_settings_id_seq'::regclass);


--
-- TOC entry 6533 (class 2604 OID 28833)
-- Name: setting_audit_logs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.setting_audit_logs ALTER COLUMN id SET DEFAULT nextval('public.setting_audit_logs_id_seq'::regclass);


--
-- TOC entry 7616 (class 0 OID 28919)
-- Dependencies: 303
-- Data for Name: appointment_reschedules; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.appointment_reschedules (id, appointment_id, proposed_by, old_service_date, old_start_time, new_service_date, new_start_time, reason, status, created_at, updated_at) FROM stdin;
\.


--
-- TOC entry 7615 (class 0 OID 28892)
-- Dependencies: 302
-- Data for Name: appointment_status_logs; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.appointment_status_logs (id, appointment_id, from_status, to_status, changed_by, changed_role, reason, created_at) FROM stdin;
\.


--
-- TOC entry 7577 (class 0 OID 27773)
-- Dependencies: 264
-- Data for Name: booking_status_logs; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.booking_status_logs (id, booking_id, from_status, to_status, changed_by, note, created_at) FROM stdin;
\.


--
-- TOC entry 7576 (class 0 OID 27697)
-- Dependencies: 263
-- Data for Name: bookings; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.bookings (id, customer_id, provider_id, vehicle_id, service_category_id, service_type, pricing_mode, pickup_address, pickup_lat, pickup_lng, pickup_point, dropoff_address, dropoff_lat, dropoff_lng, dropoff_point, route_id, schedule_id, rental_start_date, rental_end_date, distance_km, duration_min, estimated_fare, driver_quoted_fare, quote_expires_at, customer_accepted_fare, final_fare, status, cancelled_by, cancel_reason, boarding_otp, boarding_otp_expires, boarded_at, requested_at, driver_quoted_at, customer_decided_at, accepted_at, arrived_at, started_at, completed_at, cancelled_at, payment_method, payment_status, notes, created_at, updated_at, customer_note, end_time, vehicle_type, vehicle_brand_and_model, license_plate, transmission_type, cargo_type, cargo_weight, cargo_dimensions, issue_description, load_capacity, lift_height, terrain_type, attachment_ids, seat_count, passenger_name, passenger_phone, route_pickup_point, route_dropoff_point, delivery_option, cccd_image, driver_license_image, deposit_amount, scheduled_time) FROM stdin;
\.


--
-- TOC entry 7601 (class 0 OID 28568)
-- Dependencies: 288
-- Data for Name: chat_conversations; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.chat_conversations (id, booking_id, customer_id, provider_id, status, created_at, closed_at) FROM stdin;
\.


--
-- TOC entry 7602 (class 0 OID 28599)
-- Dependencies: 289
-- Data for Name: chat_messages; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.chat_messages (id, conversation_id, sender_id, message_type, content, metadata, is_read, read_at, created_at) FROM stdin;
\.


--
-- TOC entry 7573 (class 0 OID 27631)
-- Dependencies: 260
-- Data for Name: commission_configs; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.commission_configs (id, service_type, rate_percent, fixed_fee, effective_from, effective_to, is_active, created_at, updated_at) FROM stdin;
\.


--
-- TOC entry 7589 (class 0 OID 28174)
-- Dependencies: 276
-- Data for Name: consent_logs; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.consent_logs (id, user_id, consent_type, action, version, ip_address, user_agent, created_at) FROM stdin;
\.


--
-- TOC entry 7611 (class 0 OID 28808)
-- Dependencies: 298
-- Data for Name: core_settings; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.core_settings (id, setting_key, setting_value, setting_type, description, category, default_value, validation_rules, updated_by, created_at, updated_at) FROM stdin;
\.


--
-- TOC entry 7599 (class 0 OID 28487)
-- Dependencies: 286
-- Data for Name: crm_activities; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.crm_activities (id, activity_type, subject, description, contact_id, lead_id, deal_id, scheduled_at, completed_at, completed_by, created_by, created_at, updated_at) FROM stdin;
\.


--
-- TOC entry 7595 (class 0 OID 28356)
-- Dependencies: 282
-- Data for Name: crm_contacts; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.crm_contacts (id, first_name, last_name, email, phone, company_name, status, user_id, created_at, updated_at) FROM stdin;
\.


--
-- TOC entry 7597 (class 0 OID 28413)
-- Dependencies: 284
-- Data for Name: crm_deals; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.crm_deals (id, contact_id, name, status, amount, probability, close_date, assigned_to, created_at, updated_at) FROM stdin;
\.


--
-- TOC entry 7596 (class 0 OID 28383)
-- Dependencies: 283
-- Data for Name: crm_leads; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.crm_leads (id, contact_id, status, estimated_value, probability, assigned_to, created_at, updated_at) FROM stdin;
\.


--
-- TOC entry 7598 (class 0 OID 28444)
-- Dependencies: 285
-- Data for Name: crm_tasks; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.crm_tasks (id, title, description, status, due_date, contact_id, deal_id, lead_id, assigned_to, created_at, updated_at) FROM stdin;
\.


--
-- TOC entry 7590 (class 0 OID 28197)
-- Dependencies: 277
-- Data for Name: data_deletion_requests; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.data_deletion_requests (id, user_id, status, reason, requested_at, scheduled_delete_at, processed_at, processed_by) FROM stdin;
\.


--
-- TOC entry 7575 (class 0 OID 27670)
-- Dependencies: 262
-- Data for Name: driver_availability_sessions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.driver_availability_sessions (id, provider_id, vehicle_id, status, online_at, offline_at, created_at) FROM stdin;
\.


--
-- TOC entry 7574 (class 0 OID 27652)
-- Dependencies: 261
-- Data for Name: driver_locations; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.driver_locations (provider_id, latitude, longitude, location, heading, speed_kmh, updated_at) FROM stdin;
\.


--
-- TOC entry 7630 (class 0 OID 29429)
-- Dependencies: 317
-- Data for Name: food_menu_categories; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.food_menu_categories (id, merchant_id, name, display_order, is_active, created_at) FROM stdin;
\.


--
-- TOC entry 7632 (class 0 OID 29476)
-- Dependencies: 319
-- Data for Name: food_menu_item_options; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.food_menu_item_options (id, menu_item_id, option_group_name, option_name, additional_price, is_default, display_order) FROM stdin;
\.


--
-- TOC entry 7631 (class 0 OID 29447)
-- Dependencies: 318
-- Data for Name: food_menu_items; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.food_menu_items (id, merchant_id, menu_category_id, name, description, price, original_price, image_url, is_available, is_popular, display_order, created_at, updated_at) FROM stdin;
\.


--
-- TOC entry 7629 (class 0 OID 29401)
-- Dependencies: 316
-- Data for Name: food_merchant_documents; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.food_merchant_documents (id, merchant_id, document_type, file_url, document_number, issued_date, expiry_date, review_status, reviewed_by, reviewed_at, review_note, created_at, updated_at) FROM stdin;
\.


--
-- TOC entry 7628 (class 0 OID 29368)
-- Dependencies: 315
-- Data for Name: food_merchants; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.food_merchants (id, provider_id, merchant_name, merchant_short_name, description, cuisine_type, opening_time, closing_time, preparing_time_min, min_order_amount, delivery_fee_per_km, free_delivery_min, cover_image_url, logo_url, is_open, rating_avg, total_orders, verification_status, verification_note, verified_at, verified_by, status, created_at, updated_at) FROM stdin;
\.


--
-- TOC entry 7634 (class 0 OID 29545)
-- Dependencies: 321
-- Data for Name: food_order_items; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.food_order_items (id, order_id, menu_item_id, item_name, quantity, unit_price, options_description, options_price, note, subtotal) FROM stdin;
\.


--
-- TOC entry 7635 (class 0 OID 29572)
-- Dependencies: 322
-- Data for Name: food_order_status_logs; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.food_order_status_logs (id, order_id, from_status, to_status, changed_by, changed_by_role, note, created_at) FROM stdin;
\.


--
-- TOC entry 7633 (class 0 OID 29494)
-- Dependencies: 320
-- Data for Name: food_orders; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.food_orders (id, customer_user_id, merchant_id, shipper_provider_id, merchant_service_id, shipper_service_id, order_number, status, delivery_address, delivery_latitude, delivery_longitude, customer_phone, customer_note, subtotal, delivery_fee, discount_amount, total_amount, ordered_at, merchant_confirmed_at, ready_at, picked_up_at, delivered_at, cancelled_at, cancel_reason, estimated_prep_min, created_at, updated_at) FROM stdin;
\.


--
-- TOC entry 7636 (class 0 OID 29595)
-- Dependencies: 323
-- Data for Name: food_ratings; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.food_ratings (id, order_id, customer_user_id, food_rating, food_review, delivery_rating, delivery_review, created_at, is_edited) FROM stdin;
\.


--
-- TOC entry 7609 (class 0 OID 28783)
-- Dependencies: 296
-- Data for Name: footer_links; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.footer_links (id, group_key, title, url, target, sort_order, is_active, created_at, updated_at) FROM stdin;
4b33e0eb-f1b1-4a63-8042-83d9fd2976d9	services	Vận tải & Di chuyển	/danh-muc/van-tai	_self	1	t	2026-07-06 09:18:26.320833+07	2026-07-06 09:18:26.320833+07
9823540b-5bb2-48c3-acbc-925258ea415d	services	Xây dựng & Kỹ thuật	/danh-muc/xay-dung	_self	2	t	2026-07-06 09:18:26.320833+07	2026-07-06 09:18:26.320833+07
0ce9ede1-e53b-4e0c-a714-b06845d39d59	services	Giúp việc & Làm đẹp	/danh-muc/giup-viec	_self	3	t	2026-07-06 09:18:26.320833+07	2026-07-06 09:18:26.320833+07
c7143c8e-28d1-46a1-bbdd-fc8d12712c10	services	Y tế & Giáo dục	/danh-muc/y-te	_self	4	t	2026-07-06 09:18:26.320833+07	2026-07-06 09:18:26.320833+07
df31d7a1-e6fb-4aea-a471-a6cb01f118e1	services	Du lịch & Bảo hiểm	/danh-muc/du-lich	_self	5	t	2026-07-06 09:18:26.320833+07	2026-07-06 09:18:26.320833+07
24f32c41-c7ed-4f27-957c-f93deba0451a	about	Câu chuyện thương hiệu	/about	_self	1	t	2026-07-06 09:18:26.320833+07	2026-07-06 09:18:26.320833+07
64639c96-89a0-4daa-97a3-bd2f1a0d29d3	about	Tin tức & Sự kiện	/bai-viet	_self	2	t	2026-07-06 09:18:26.320833+07	2026-07-06 09:18:26.320833+07
71087f0a-7f59-4019-b8e3-d43712ce3cda	about	Cơ hội nghề nghiệp	/careers	_self	3	t	2026-07-06 09:18:26.320833+07	2026-07-06 09:18:26.320833+07
1a1773e2-35ad-48b6-91da-4a009c8b8ee8	about	Liên hệ hợp tác	/contact	_self	4	t	2026-07-06 09:18:26.320833+07	2026-07-06 09:18:26.320833+07
92913b9d-19dc-40f8-8e7c-1fa93d784c5b	support	Trung tâm trợ giúp	/contact	_self	1	t	2026-07-06 09:18:26.320833+07	2026-07-06 09:18:26.320833+07
db3852a0-f58f-49e8-a40e-3fc8319ad462	support	Điều khoản sử dụng	/terms	_self	2	t	2026-07-06 09:18:26.320833+07	2026-07-06 09:18:26.320833+07
fb0a525c-49f4-47a9-b623-0e3f8ded9c11	support	Chính sách bảo mật	/privacy	_self	3	t	2026-07-06 09:18:26.320833+07	2026-07-06 09:18:26.320833+07
feeac498-cff6-4dc6-8ade-1009f878e8cc	support	Câu hỏi thường gặp	/contact#faq	_self	4	t	2026-07-06 09:18:26.320833+07	2026-07-06 09:18:26.320833+07
\.


--
-- TOC entry 7551 (class 0 OID 26906)
-- Dependencies: 238
-- Data for Name: industry_categories; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.industry_categories (id, code, name, slug, icon_url, description, module_type, search_mode, default_view, nearby_enabled, detail_mode, ui_config_json, is_active, created_at, updated_at, created_by, updated_by) FROM stdin;
a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12	xaydungnoithat	XÂY DỰNG, NỘI THẤT VÀ KỸ THUẬT	xay-dung-noi-that-ky-thuat	/pillar_construction_1773647692104.png	Thi công, sửa chữa nhà cửa và điện máy gia dụng tại nhà.	\N	text	list	f	provider	\N	t	2026-07-06 09:28:47.593612+07	2026-07-06 09:28:47.593612+07	\N	\N
a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13	giupvieclamdep	GIÚP VIỆC, CHĂM SÓC & LÀM ĐẸP	giup-viec-cham-soc-lam-dep	/pillar_housekeeping_1773647750012.png	Dịch vụ chăm sóc gia đình, vệ sinh và làm đẹp tại nhà.	\N	text	list	f	provider	\N	t	2026-07-06 09:28:47.593612+07	2026-07-06 09:28:47.593612+07	\N	\N
a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a15	dulichbaohiem	DU LỊCH, KHÁCH SẠN VÀ BẢO HIỂM	du-lich-khach-san-bao-hiem	/pillar_transportation_1773647657871.png	Dịch vụ tiện ích du lịch, lưu trú và bảo hiểm trọn gói.	\N	text	list	f	provider	\N	t	2026-07-06 09:28:47.593612+07	2026-07-06 09:28:47.593612+07	\N	\N
a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11	vantaidichuyen	VẬN TẢI & DI CHUYỂN	van-tai-di-chuyen	/pillar_transportation_1773647657871.png	Ô tô & xe máy với 18+ ngành nghề đa dạng.	\N	text	list	f	provider	\N	t	2026-07-06 09:28:47.593612+07	2026-07-06 09:28:47.593612+07	\N	\N
a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a14	ytegiaoduc	Y TẾ & GIÁO DỤC	y-te-giao-duc	/pillar_education_medical_1773647770773.png	Chăm sóc sức khỏe và đào tạo tại nhà — 5 ngành.	\N	text	list	f	provider	\N	t	2026-07-06 09:28:47.593612+07	2026-07-06 09:28:47.593612+07	\N	\N
\.


--
-- TOC entry 7621 (class 0 OID 29107)
-- Dependencies: 308
-- Data for Name: job_request_attachments; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.job_request_attachments (id, job_request_id, uploaded_by_user_id, file_url, file_type, file_name, file_size_bytes, created_at) FROM stdin;
\.


--
-- TOC entry 7622 (class 0 OID 29134)
-- Dependencies: 309
-- Data for Name: job_request_quotes; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.job_request_quotes (id, job_request_id, provider_id, amount, description, estimated_duration_hours, materials_included, valid_until, status, created_at, updated_at) FROM stdin;
\.


--
-- TOC entry 7623 (class 0 OID 29168)
-- Dependencies: 310
-- Data for Name: job_request_status_logs; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.job_request_status_logs (id, job_request_id, from_status, to_status, changed_by, note, created_at) FROM stdin;
\.


--
-- TOC entry 7620 (class 0 OID 29066)
-- Dependencies: 307
-- Data for Name: job_requests; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.job_requests (id, customer_user_id, provider_id, provider_service_id, title, description, address_text, latitude, longitude, preferred_visit_time, survey_required, survey_scheduled_at, scheduled_at, quoted_amount, quote_note, quoted_at, status, cancel_reason, reject_reason, accepted_at, approved_at, started_at, completed_at, confirmed_at, cancelled_at, disputed_at, notes, created_at, updated_at) FROM stdin;
\.


--
-- TOC entry 7607 (class 0 OID 28734)
-- Dependencies: 294
-- Data for Name: landing_banners; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.landing_banners (id, page_key, banner_key, title, subtitle, description, image_url, mobile_image_url, button_text, button_link, button_target, badge_text, sort_order, start_at, end_at, is_active, created_at, updated_at) FROM stdin;
e98edb30-e098-493d-908e-3e12d2ce711a	landing_home	hero_main	Giải Pháp Tận Tâm	Chất Lượng Vững Bền.	Hệ sinh thái kết nối chuyên gia hàng đầu, đồng hành cùng bạn giải quyết mọi nhu cầu cuộc sống một cách chuyên nghiệp, minh bạch và tin cậy nhất.	/vietnam-map.png	\N	Yêu cầu ngay	/danh-muc	_self	Kết Nối Dịch Vụ - Vươn Tầm Việt Nam	1	\N	\N	t	2026-07-06 09:18:26.320833+07	2026-07-06 09:18:26.320833+07
f636cd69-5eeb-4045-ab6b-f20db7931b60	landing_home	mid_promo	Trở Thành Nhà Cung Cấp	Mở rộng kinh doanh cùng chúng tôi	Tham gia hệ sinh thái Sàn Dịch Vụ để tiếp cận hàng nghìn khách hàng tiềm năng. Đăng ký ngay hôm nay!	/images/provider-cta.jpg	/images/provider-cta-mobile.jpg	Đăng ký ngay	/partner	_self	Đối tác	2	\N	\N	t	2026-07-06 09:18:26.320833+07	2026-07-06 09:18:26.320833+07
\.


--
-- TOC entry 7608 (class 0 OID 28760)
-- Dependencies: 295
-- Data for Name: landing_sections; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.landing_sections (id, page_key, section_key, section_type, title, subtitle, content, image_url, icon, config_json, sort_order, is_active, created_at, updated_at) FROM stdin;
063c27dd-b7da-4bc7-b79c-36981ada0d92	landing_home	stats_overview	stats	Con Số Ấn Tượng	Những cột mốc đáng tự hào của Sàn Dịch Vụ	\N	\N	BarChart3	{"items": [{"icon": "Users", "label": "Người dùng", "value": "1,240+"}, {"icon": "ShieldCheck", "label": "Nhà cung cấp", "value": "86+"}, {"icon": "CheckCircle2", "label": "Booking thành công", "value": "3,542+"}, {"icon": "Star", "label": "Hài lòng", "value": "98%"}]}	1	t	2026-07-06 09:18:26.320833+07	2026-07-06 09:18:26.320833+07
29ee44db-f2f3-4b77-a2c8-8f07a99ddc15	landing_home	featured_services	features	Dịch Vụ Nổi Bật	Đa dạng ngành nghề, đáp ứng mọi nhu cầu	\N	\N	Briefcase	{"items": [{"url": "/danh-muc/van-tai", "icon": "Truck", "title": "Vận tải & Di chuyển"}, {"url": "/danh-muc/xay-dung", "icon": "Hammer", "title": "Xây dựng & Kỹ thuật"}, {"url": "/danh-muc/giup-viec", "icon": "Sparkles", "title": "Giúp việc & Làm đẹp"}, {"url": "/danh-muc/y-te", "icon": "HeartPulse", "title": "Y tế & Giáo dục"}, {"url": "/danh-muc/du-lich", "icon": "Plane", "title": "Du lịch & Bảo hiểm"}]}	2	t	2026-07-06 09:18:26.320833+07	2026-07-06 09:18:26.320833+07
632ba653-852c-4d7d-8860-d4771490357b	landing_home	how_it_works	steps	Quy Trình Đơn Giản	Chỉ 3 bước để sử dụng dịch vụ	\N	\N	ListOrdered	{"steps": [{"step": 1, "title": "Tìm kiếm dịch vụ", "description": "Chọn ngành nghề và dịch vụ bạn cần"}, {"step": 2, "title": "So sánh nhà cung cấp", "description": "Xem đánh giá, giá và hồ sơ năng lực"}, {"step": 3, "title": "Đặt lịch & Thanh toán", "description": "Xác nhận đơn và thanh toán an toàn qua ví"}]}	3	t	2026-07-06 09:18:26.320833+07	2026-07-06 09:18:26.320833+07
a21907e7-51e4-432e-8168-a6f14451f12c	landing_home	why_choose_us	features	Tại Sao Chọn Sàn Dịch Vụ?	Cam kết chất lượng và minh bạch	\N	\N	ShieldCheck	{"items": [{"icon": "BadgeCheck", "title": "Xác minh danh tính", "description": "100% nhà cung cấp đã qua xác minh danh tính và lý lịch"}, {"icon": "Calculator", "title": "Giá minh bạch", "description": "Bảng giá rõ ràng, không phát sinh chi phí ẩn"}, {"icon": "Star", "title": "Đánh giá thực tế", "description": "Review từ người dùng thực, không chỉnh sửa"}, {"icon": "Headphones", "title": "Hỗ trợ 24/7", "description": "Đội ngũ CSKH sẵn sàng hỗ trợ mọi lúc"}]}	4	t	2026-07-06 09:18:26.320833+07	2026-07-06 09:18:26.320833+07
f6163c16-c3bb-44ae-9ca9-072f37709b5f	landing_home	provider_cta	cta	Bạn Là Nhà Cung Cấp Dịch Vụ?	Tham gia ngay để tiếp cận hàng nghìn khách hàng tiềm năng	<p>Tham gia hệ sinh thái <strong>Sàn Dịch Vụ</strong> để mở rộng kinh doanh, quản lý đơn hàng thông minh và phát triển bền vững.</p>	\N	Store	{"buttons": [{"url": "/partner", "text": "Đăng ký ngay", "variant": "primary"}, {"url": "/partner/about", "text": "Tìm hiểu thêm", "variant": "secondary"}]}	5	t	2026-07-06 09:18:26.320833+07	2026-07-06 09:18:26.320833+07
bcc4cc55-a52c-48fe-a0dc-e7b263b90409	landing_home	faq	info	Câu Hỏi Thường Gặp	Giải đáp nhanh các thắc mắc phổ biến	<div class="faq-list">\n            <details><summary><strong>Sàn Dịch Vụ là gì?</strong></summary><p>Là nền tảng kết nối người dùng với các nhà cung cấp dịch vụ đã qua xác minh, đảm bảo chất lượng và minh bạch.</p></details>\n            <details><summary><strong>Làm sao để đăng ký?</strong></summary><p>Bạn chỉ cần số điện thoại, xác thực OTP và tạo tài khoản trong 30 giây.</p></details>\n            <details><summary><strong>Thanh toán có an toàn không?</strong></summary><p>Chúng tôi sử dụng hệ thống ví điện tử nội bộ, giao dịch được bảo vệ và hoàn tiền nếu dịch vụ không đạt cam kết.</p></details>\n        </div>	\N	HelpCircle	\N	6	t	2026-07-06 09:18:26.320833+07	2026-07-06 09:18:26.320833+07
\.


--
-- TOC entry 7600 (class 0 OID 28533)
-- Dependencies: 287
-- Data for Name: notification_campaigns; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.notification_campaigns (id, name, target_roles, target_tags, target_filter, channel, title, body, deep_link, status, scheduled_at, sent_at, target_count, sent_count, opened_count, created_by, created_at, updated_at) FROM stdin;
\.


--
-- TOC entry 7585 (class 0 OID 28025)
-- Dependencies: 272
-- Data for Name: notification_settings; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.notification_settings (id, user_id, notification_type, is_enabled, created_at, updated_at) FROM stdin;
\.


--
-- TOC entry 7584 (class 0 OID 28003)
-- Dependencies: 271
-- Data for Name: notifications; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.notifications (id, user_id, type, title, body, data, is_read, read_at, created_at) FROM stdin;
\.


--
-- TOC entry 7544 (class 0 OID 26701)
-- Dependencies: 231
-- Data for Name: otp_sessions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.otp_sessions (id, phone, otp_code_hash, expires_at, attempt_count, is_used, created_at, updated_at) FROM stdin;
0ef52dbd-ebdc-4edf-9451-65417b2df75b	0987654321	6e4e292799b7ff6c14655b61d84d88e0ac25f7f21913817005a9e904f4991841	2026-07-06 09:36:31.44764+07	1	f	2026-07-06 09:31:31.651502+07	2026-07-06 09:31:31.651502+07
f818c3e7-7197-4deb-b6c4-77d79221b0b4	0987654321	83ab8051b1155da3fd4b3d7902aa99070324be1ab6f524c103ca9eba320b6d1e	2026-07-06 09:37:18.444479+07	2	t	2026-07-06 09:32:18.445175+07	2026-07-06 09:32:49.277331+07
ca0532fd-2cb0-4a71-bfc6-5f315d330916	0978654321	d5058e3e2e5f632a8dbf9662a7eff16be20405587b876a166dcac43599f9af0a	2026-07-06 09:38:25.590275+07	1	t	2026-07-06 09:33:25.590789+07	2026-07-06 09:34:08.88874+07
\.


--
-- TOC entry 7580 (class 0 OID 27858)
-- Dependencies: 267
-- Data for Name: payment_transactions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.payment_transactions (id, booking_id, user_id, amount, method, gateway_ref, status, paid_at, refunded_at, refund_amount, metadata, created_at, updated_at) FROM stdin;
\.


--
-- TOC entry 7586 (class 0 OID 28048)
-- Dependencies: 273
-- Data for Name: post_categories; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.post_categories (id, code, name, slug, description, is_active, created_at, updated_at, created_by, updated_by) FROM stdin;
\.


--
-- TOC entry 7588 (class 0 OID 28143)
-- Dependencies: 275
-- Data for Name: post_media; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.post_media (id, post_id, media_type, file_url, thumbnail_url, title, alt_text, is_active, created_at) FROM stdin;
\.


--
-- TOC entry 7587 (class 0 OID 28080)
-- Dependencies: 274
-- Data for Name: posts; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.posts (id, category_id, author_user_id, provider_id, industry_category_id, service_category_id, title, slug, summary, content, cover_image_url, seo_title, seo_description, post_type, status, visibility, published_at, expired_at, is_featured, allow_indexing, view_count, created_at, updated_at, updated_by) FROM stdin;
\.


--
-- TOC entry 7572 (class 0 OID 27605)
-- Dependencies: 259
-- Data for Name: price_configs; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.price_configs (id, service_type, pricing_mode, base_fare, fare_per_km, fare_per_min, min_fare, surge_enabled, surge_multiplier, quote_timeout_sec, accept_timeout_sec, min_quote, max_quote, effective_from, effective_to, is_active, created_at, updated_at) FROM stdin;
\.


--
-- TOC entry 7582 (class 0 OID 27929)
-- Dependencies: 269
-- Data for Name: promotion_usages; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.promotion_usages (id, promotion_id, user_id, booking_id, discount_amount, used_at) FROM stdin;
\.


--
-- TOC entry 7581 (class 0 OID 27897)
-- Dependencies: 268
-- Data for Name: promotions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.promotions (id, code, name, type, value, max_discount, min_fare, usage_limit, used_count, per_user_limit, valid_from, valid_to, service_types, is_active, created_at, updated_at) FROM stdin;
\.


--
-- TOC entry 7548 (class 0 OID 26812)
-- Dependencies: 235
-- Data for Name: provider_business_profiles; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.provider_business_profiles (provider_id, company_name, exe_year, legal_name, tax_code, business_license_number, representative_name, representative_position, founded_date, hotline, website_url, created_at, updated_at, created_by, updated_by) FROM stdin;
\.


--
-- TOC entry 7605 (class 0 OID 28690)
-- Dependencies: 292
-- Data for Name: provider_contact_request_logs; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.provider_contact_request_logs (id, contact_request_id, from_status, to_status, changed_by_user_id, note, created_at) FROM stdin;
\.


--
-- TOC entry 7604 (class 0 OID 28646)
-- Dependencies: 291
-- Data for Name: provider_contact_requests; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.provider_contact_requests (id, customer_user_id, provider_id, provider_service_id, contact_mode, contact_type, customer_name, customer_phone, note, status, revealed_to_customer_at, revealed_to_provider_at, provider_response_at, rejection_reason, ip_address, user_agent, created_at, updated_at) FROM stdin;
\.


--
-- TOC entry 7558 (class 0 OID 27178)
-- Dependencies: 245
-- Data for Name: provider_document_services; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.provider_document_services (id, provider_document_id, provider_service_id, created_at) FROM stdin;
\.


--
-- TOC entry 7549 (class 0 OID 26840)
-- Dependencies: 236
-- Data for Name: provider_documents; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.provider_documents (id, provider_id, document_type, document_name, document_number, issued_by, issued_date, expiry_date, front_file_url, back_file_url, extra_file_url, verification_status, reviewed_by, reviewed_at, rejection_reason, note, created_at, updated_at, created_by, updated_by, license_class) FROM stdin;
\.


--
-- TOC entry 7561 (class 0 OID 27268)
-- Dependencies: 248
-- Data for Name: provider_import_job_rows; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.provider_import_job_rows (id, job_id, row_number, name, phone_raw, phone_normalized, address, industry_code, service_code, url, latitude, longitude, source, role, status_raw, mapped_industry_category_id, mapped_service_category_id, validation_status, validation_errors_json, duplicate_type, import_result_status, created_at) FROM stdin;
\.


--
-- TOC entry 7560 (class 0 OID 27238)
-- Dependencies: 247
-- Data for Name: provider_import_jobs; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.provider_import_jobs (id, file_name, status, total_rows, valid_rows, invalid_rows, duplicate_rows, imported_rows, created_by, created_at, confirmed_at, updated_at) FROM stdin;
\.


--
-- TOC entry 7562 (class 0 OID 27302)
-- Dependencies: 249
-- Data for Name: provider_import_metadata; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.provider_import_metadata (id, provider_id, source, source_url, raw_name, raw_phone, raw_address, latitude, longitude, import_job_id, created_at) FROM stdin;
\.


--
-- TOC entry 7547 (class 0 OID 26787)
-- Dependencies: 234
-- Data for Name: provider_individual_profiles; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.provider_individual_profiles (provider_id, full_name, exe_year, cccd, created_at, updated_at, created_by, updated_by) FROM stdin;
\.


--
-- TOC entry 7559 (class 0 OID 27205)
-- Dependencies: 246
-- Data for Name: provider_locations; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.provider_locations (id, provider_id, provider_service_id, latitude, longitude, location, address_text, source, is_primary, created_at, updated_at) FROM stdin;
\.


--
-- TOC entry 7557 (class 0 OID 27155)
-- Dependencies: 244
-- Data for Name: provider_service_attributes; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.provider_service_attributes (id, provider_service_id, attr_key, value_text, value_number, value_boolean, value_json, created_at, created_by) FROM stdin;
\.


--
-- TOC entry 7556 (class 0 OID 27098)
-- Dependencies: 243
-- Data for Name: provider_services; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.provider_services (id, provider_id, industry_category_id, service_category_id, service_skill_id, exe_year, pricing_type, base_price, price_unit, description, is_primary, is_active, verification_status, created_at, updated_at, created_by, updated_by) FROM stdin;
\.


--
-- TOC entry 7550 (class 0 OID 26878)
-- Dependencies: 237
-- Data for Name: provider_status_logs; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.provider_status_logs (id, provider_id, old_status, new_status, changed_by, reason, created_at) FROM stdin;
\.


--
-- TOC entry 7571 (class 0 OID 27583)
-- Dependencies: 258
-- Data for Name: provider_vehicle_availabilities; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.provider_vehicle_availabilities (id, vehicle_id, date, is_blocked, blocked_reason) FROM stdin;
\.


--
-- TOC entry 7568 (class 0 OID 27491)
-- Dependencies: 255
-- Data for Name: provider_vehicle_documents; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.provider_vehicle_documents (id, vehicle_id, document_type, document_number, issued_date, expiry_date, file_url, review_status, reviewed_by, reviewed_at, review_note, created_at, updated_at, created_by, updated_by) FROM stdin;
\.


--
-- TOC entry 7567 (class 0 OID 27448)
-- Dependencies: 254
-- Data for Name: provider_vehicles; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.provider_vehicles (id, provider_id, service_id, vehicle_type, vehicle_brand, vehicle_model, year_of_manufacture, license_plate, seat_count, fuel_type, transmission, has_ac, has_wifi, color, status, notes, created_at, updated_at, created_by, updated_by, images, description, rental_terms, deposit_amount, delivery_options) FROM stdin;
\.


--
-- TOC entry 7546 (class 0 OID 26744)
-- Dependencies: 233
-- Data for Name: providers; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.providers (id, owner_user_id, provider_type, description, verification_status, status, avg_rating, total_reviews, total_jobs_completed, created_at, updated_at, created_by, updated_by) FROM stdin;
\.


--
-- TOC entry 7545 (class 0 OID 26722)
-- Dependencies: 232
-- Data for Name: refresh_tokens; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.refresh_tokens (id, user_id, jti, expires_at, revoked_at, created_at, updated_at) FROM stdin;
fffc148f-3b3b-454d-a328-7d70b1bce660	6211e96f-f3f0-439e-87b0-e1b487286ee7	95bfb4b5432c4806b3a0f6e756d1a30e	2026-08-05 09:32:49.552553+07	\N	2026-07-06 09:32:49.55077+07	2026-07-06 09:32:49.55077+07
6e309613-76f2-4fe0-8998-d0abb87bf2aa	9a970c74-7734-41e3-a67b-ff587ab0cf48	275a5297faa94406a09db3a6c9cd674d	2026-08-05 09:34:09.12805+07	\N	2026-07-06 09:34:09.126857+07	2026-07-06 09:34:09.126857+07
0d8cfd43-4a1e-468e-9568-edff4f692fa2	6211e96f-f3f0-439e-87b0-e1b487286ee7	6656f273a1204797960199b7a53e01b5	2026-08-05 09:36:34.178866+07	\N	2026-07-06 09:36:34.177654+07	2026-07-06 09:36:34.177654+07
\.


--
-- TOC entry 7625 (class 0 OID 29246)
-- Dependencies: 312
-- Data for Name: reservation_request_options; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.reservation_request_options (id, reservation_request_id, provider_id, title, description, price, price_note, valid_until, is_selected, created_at, updated_at) FROM stdin;
\.


--
-- TOC entry 7626 (class 0 OID 29283)
-- Dependencies: 313
-- Data for Name: reservation_request_status_logs; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.reservation_request_status_logs (id, reservation_request_id, from_status, to_status, changed_by, note, created_at) FROM stdin;
\.


--
-- TOC entry 7624 (class 0 OID 29207)
-- Dependencies: 311
-- Data for Name: reservation_requests; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.reservation_requests (id, customer_user_id, provider_id, provider_service_id, request_type, destination, start_date, end_date, travelers_count, budget_range, note, status, cancel_reason, selected_option_id, assigned_at, consulting_at, options_sent_at, selected_at, confirmed_at, completed_at, cancelled_at, created_at, updated_at) FROM stdin;
\.


--
-- TOC entry 7583 (class 0 OID 27964)
-- Dependencies: 270
-- Data for Name: reviews; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.reviews (id, booking_id, reviewer_id, reviewee_id, reviewer_role, rating, comment, is_visible, created_at, appointment_id, tutor_request_id) FROM stdin;
\.


--
-- TOC entry 7614 (class 0 OID 28850)
-- Dependencies: 301
-- Data for Name: service_appointments; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.service_appointments (id, customer_user_id, provider_id, provider_service_id, service_date, start_time, end_time, duration_minutes, address_text, latitude, longitude, note, status, patient_name, patient_age, patient_gender, care_note, created_at, updated_at) FROM stdin;
\.


--
-- TOC entry 7552 (class 0 OID 26946)
-- Dependencies: 239
-- Data for Name: service_categories; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.service_categories (id, industry_category_id, code, name, slug, icon_url, description, is_active, created_at, updated_at, created_by, updated_by, module_type) FROM stdin;
e8806a12-9e5c-4452-a062-788317d7d59b	a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11	taxi_47_cho	Taxi (4,7 chỗ)/ Xe hợp đồng / Xe du lịch (4-7-16-29-45 chỗ)	taxi-47-cho	\N	Dịch vụ vận tải hành khách chuyên nghiệp	t	2026-07-06 09:28:47.593612+07	2026-07-06 09:28:47.593612+07	\N	\N	\N
e84ed410-f400-4ff2-ac7c-e97d682cdbca	a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11	xe_tien_chuyen	Xe tiện chuyến / Xe ghép / Xe Limousine (4-7-12 chỗ)	xe-tien-chuyen	\N	Dịch vụ xe ghép, limousine cao cấp	t	2026-07-06 09:28:47.593612+07	2026-07-06 09:28:47.593612+07	\N	\N	\N
751a5b28-b733-468b-a781-6f250a9040e0	a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11	xe_khach	Xe khách chạy tuyến cố định (Liên tỉnh)	xe-khach	\N	Vận tải hành khách tuyến cố định	t	2026-07-06 09:28:47.593612+07	2026-07-06 09:28:47.593612+07	\N	\N	\N
d0e9080f-5522-456a-9e60-0cb0aca915eb	a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11	xe_tai	Xe tải vận chuyển hàng hóa, xe công (từ 0,5 tấn đến 20 tấn)	xe-tai	\N	Vận chuyển hàng hóa đa trọng tải	t	2026-07-06 09:28:47.593612+07	2026-07-06 09:28:47.593612+07	\N	\N	\N
58e5ed1e-ce52-4aad-8a3d-05a91f37505c	a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11	xe_cau_nang	Xe cẩu, xe nâng, máy xúc	xe-cau-nang	\N	Thiết bị công trình và vận chuyển đặc biệt	t	2026-07-06 09:28:47.593612+07	2026-07-06 09:28:47.593612+07	\N	\N	\N
5b3fc6ee-e14d-419c-bdcf-6e018ae96b47	a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11	cuu_ho	Cứu hộ giao thông (Cẩu kéo ô tô)	cuu-ho-giao-thong	\N	Hỗ trợ sự cố giao thông 24/7	t	2026-07-06 09:28:47.593612+07	2026-07-06 09:28:47.593612+07	\N	\N	\N
463b3210-451f-46be-a5bf-0f0dc81fd545	a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11	lai_xe_ho_o_to	Lái xe ô tô hộ (Bạn uống say - Tôi lái)	lai-xe-ho-o-to	\N	Dịch vụ lái xe hộ an toàn	t	2026-07-06 09:28:47.593612+07	2026-07-06 09:28:47.593612+07	\N	\N	\N
76d1edb7-e682-4498-b384-5bcf977fd287	a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11	lai_xe_theo_ngay	Lái xe theo ngày, lái xe theo chuyến	lai-xe-theo-ngay	\N	Tài xế riêng theo yêu cầu	t	2026-07-06 09:28:47.593612+07	2026-07-06 09:28:47.593612+07	\N	\N	\N
f71a50a8-c2a0-416c-99eb-349e7789eae4	a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11	xe_om_cong_nghe	Xe ôm công nghệ (Xe máy cá nhân)	xe-om-cong-nghe	\N	Vận chuyển hành khách bằng xe máy	t	2026-07-06 09:28:47.593612+07	2026-07-06 09:28:47.593612+07	\N	\N	\N
4b4c861f-c1e3-4508-b8db-8a8491276d32	a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12	sua_dien_nuoc	Sửa chữa Điện nước (Xử lý sự cố 24/7)	sua-dien-nuoc	\N	Khắc phục sự cố điện nước gia đình	t	2026-07-06 09:28:47.593612+07	2026-07-06 09:28:47.593612+07	\N	\N	\N
3e40d508-9b1a-406b-bb0b-f4a625e23247	a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12	tho_ne	Thợ Nề / Xây dựng (Xây mới, sửa chữa, phá dỡ)	tho-ne-xay-dung	\N	Thi công xây dựng và sửa chữa nề	t	2026-07-06 09:28:47.593612+07	2026-07-06 09:28:47.593612+07	\N	\N	\N
23bee936-311f-4ee1-8f55-3f172abf236e	a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12	son_ba	Sơn bả / Chống thấm	son-ba-chong-tham	\N	Dịch vụ hoàn thiện nhà cửa	t	2026-07-06 09:28:47.593612+07	2026-07-06 09:28:47.593612+07	\N	\N	\N
8864dc9e-b408-4725-b718-8e6cf742c578	a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12	tran_thach_cao	Trần thạch cao (Thi công vách, trần)	tran-thach-cao	\N	Thi công nội thất thạch cao	t	2026-07-06 09:28:47.593612+07	2026-07-06 09:28:47.593612+07	\N	\N	\N
3b59a965-2e52-4da0-934f-8a67994e0b8e	a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12	nhom_kinh	Nhôm kính / Cửa cuốn (Lắp đặt, sửa chữa)	nhom-kinh-cua-cuon	\N	Cung cấp và lắp đặt cửa các loại	t	2026-07-06 09:28:47.593612+07	2026-07-06 09:28:47.593612+07	\N	\N	\N
a968bc65-16c5-4510-8006-bc38cc9e7cea	a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12	co_khi	Cơ khí / Hàn xì (Hàng rào, cổng sắt)	co-khi-han-xi	\N	Gia công cơ khí dân dụng	t	2026-07-06 09:28:47.593612+07	2026-07-06 09:28:47.593612+07	\N	\N	\N
0c38f3c2-139f-4e36-bed4-3b181b882742	a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12	tho_moc	Thợ Mộc (Sửa chữa lắp đặt đồ gỗ)	tho-moc	\N	Sửa chữa và sản xuất đồ gỗ	t	2026-07-06 09:28:47.593612+07	2026-07-06 09:28:47.593612+07	\N	\N	\N
4d703889-3f0d-42fc-8d6b-e93230cb0a22	a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12	thong_tac	Thông tắc cống / Hút bể phốt	thong-tac-hut-be-phot	\N	Vệ sinh môi trường đô thị	t	2026-07-06 09:28:47.593612+07	2026-07-06 09:28:47.593612+07	\N	\N	\N
81be41bf-aee2-4dd0-8f92-0c1111f7e84c	a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12	sua_dieu_hoa	Sửa chữa, bảo dưỡng Điều hòa	sua-dieu-hoa	\N	Dịch vụ điện lạnh chuyên nghiệp	t	2026-07-06 09:28:47.593612+07	2026-07-06 09:28:47.593612+07	\N	\N	\N
8d2c62d9-5a66-45e8-a295-88c6872cff6e	a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12	sua_may_giat	Sửa chữa, lắp đặt Máy giặt / Máy sấy	sua-may-giat	\N	Bảo trì thiết bị giặt ủi	t	2026-07-06 09:28:47.593612+07	2026-07-06 09:28:47.593612+07	\N	\N	\N
f869c7e6-a57e-4c09-8ae6-c2e9b68fa711	a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12	sua_tu_lanh	Sửa chữa, lắp đặt Tủ lạnh / Tủ đông	sua-tu-lanh	\N	Sửa chữa thiết bị bảo quản thực phẩm	t	2026-07-06 09:28:47.593612+07	2026-07-06 09:28:47.593612+07	\N	\N	\N
07682fed-1109-440c-ad8f-98c206bc7f14	a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12	thay_loi_loc_nuoc	Thay lõi Máy lọc nước	thay-loi-loc-nuoc	\N	Bảo trì nguồn nước sạch gia đình	t	2026-07-06 09:28:47.593612+07	2026-07-06 09:28:47.593612+07	\N	\N	\N
072ee7dc-cd33-4663-bb4d-fcd92138bebd	a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12	sua_gia_dung	Sửa chữa Bếp từ / Bếp ga / Đồ gia dụng	sua-bep-do-gia-dung	\N	Sửa chữa đồ dùng nhà bếp	t	2026-07-06 09:28:47.593612+07	2026-07-06 09:28:47.593612+07	\N	\N	\N
43262b62-5c2c-4f59-b0b2-a3f7d32d43e0	a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12	tho_khoa	Thợ Khóa (Mở khóa, đánh chìa, khóa thông minh)	tho-khoa	\N	Dịch vụ khóa cửa các loại	t	2026-07-06 09:28:47.593612+07	2026-07-06 09:28:47.593612+07	\N	\N	\N
f69b1390-acc1-4d89-b72c-1a7d00141ffd	a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12	camera_an_ninh	Lắp đặt & Sửa chữa Camera / An ninh	camera-an-ninh	\N	Hệ thống giám sát và báo động	t	2026-07-06 09:28:47.593612+07	2026-07-06 09:28:47.593612+07	\N	\N	\N
cd7c99e7-6753-4def-98ef-bebe2408b9e6	a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12	thiet_bi_van_phong	Sửa chữa thiết bị văn phòng (Máy tính, máy in)	thiet-bi-van-phong	\N	Hỗ trợ kỹ thuật văn phòng	t	2026-07-06 09:28:47.593612+07	2026-07-06 09:28:47.593612+07	\N	\N	\N
07aff5e3-ff28-4605-9c87-be6bda7cf459	a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13	trong_tre	Trông giữ trẻ em tại nhà	trong-tre	\N	Chăm sóc trẻ em tận tâm	t	2026-07-06 09:28:47.593612+07	2026-07-06 09:28:47.593612+07	\N	\N	\N
da05d7fd-088d-484b-8732-d25f12a2b332	a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13	cham_soc_nguoi_than	Chăm sóc người thân tại nhà	cham-soc-nguoi-than	\N	Hỗ trợ sinh hoạt người cao tuổi	t	2026-07-06 09:28:47.593612+07	2026-07-06 09:28:47.593612+07	\N	\N	\N
f54a48c2-3d98-4896-935a-44fbad861a24	a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13	nuoi_benh	Nuôi bệnh tại bệnh viện	nuoi-benh	\N	Dịch vụ chăm sóc y tế tại viện	t	2026-07-06 09:28:47.593612+07	2026-07-06 09:28:47.593612+07	\N	\N	\N
5e651feb-618c-4f09-bf5c-5801453d8ab2	a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13	nau_co	Dịch vụ Nấu cỗ tại nhà	nau-co-tai-nha	\N	Ẩm thực phục vụ sự kiện	t	2026-07-06 09:28:47.593612+07	2026-07-06 09:28:47.593612+07	\N	\N	\N
febf3ecc-7fd7-465b-bbc8-b0374ca8586e	a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13	ve_sinh_cong_nghiep	Vệ sinh công nghiệp, vệ sinh trọn gói	ve-sinh-cong-nghiep	\N	Vệ sinh chuyên sâu cho công trình	t	2026-07-06 09:28:47.593612+07	2026-07-06 09:28:47.593612+07	\N	\N	\N
7c33a957-888f-44c1-9b03-fea270f57665	a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13	ve_sinh_theo_ngay	Vệ sinh theo ngày, theo giờ	ve-sinh-hang-ngay	\N	Duy trì sạch sẽ không gian sống	t	2026-07-06 09:28:47.593612+07	2026-07-06 09:28:47.593612+07	\N	\N	\N
34bf730a-eb84-455e-9b69-42c956a64eeb	a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13	cat_toc	Cắt tóc / Làm tóc tại nhà	cat-toc-lam-toc	\N	Dịch vụ làm đẹp tóc tận nơi	t	2026-07-06 09:28:47.593612+07	2026-07-06 09:28:47.593612+07	\N	\N	\N
3ba3d5a1-180e-4bae-ac91-a4cc4ac1084a	a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13	nails	Làm móng (Nails) tại nhà	lam-mong-nails	\N	Chăm sóc móng chuyên nghiệp	t	2026-07-06 09:28:47.593612+07	2026-07-06 09:28:47.593612+07	\N	\N	\N
76d266bf-e7bc-420a-aad2-21533b90b35c	a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13	makeup	Trang điểm (Makeup) tại nhà	trang-diem-makeup	\N	Trang điểm dự tiệc, sự kiện	t	2026-07-06 09:28:47.593612+07	2026-07-06 09:28:47.593612+07	\N	\N	\N
99c4f1b1-e270-4a91-a30c-13ac26c06c1e	a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13	massage	Massage trị liệu tại nhà	massage-tri-lieu	\N	Thư giãn và hồi phục sức khỏe	t	2026-07-06 09:28:47.593612+07	2026-07-06 09:28:47.593612+07	\N	\N	\N
b0e8ca3e-bc30-45a1-b9fb-f5dfaf210926	a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13	cham_soc_da	Chăm sóc da mặt tại nhà	cham_soc_da_mat	\N	Dịch vụ spa mini tận nhà	t	2026-07-06 09:28:47.593612+07	2026-07-06 09:28:47.593612+07	\N	\N	\N
ae6f3da8-17f0-46ca-826a-e67bd13c72aa	a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13	giup_viec_gio	Giúp việc theo giờ	giup-viec-theo-gio	\N	Dọn dẹp nhà cửa, giặt giũ theo giờ	t	2026-07-06 09:28:47.593612+07	2026-07-06 09:28:47.593612+07	\N	\N	\N
081516b9-2874-4b23-a8e1-3ccc269f822a	a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a15	ve_may_bay	Đặt vé máy bay nội địa / quốc tế	dat-ve-may-bay	\N	Đại lý vé máy bay uy tín	t	2026-07-06 09:28:47.593612+07	2026-07-06 09:28:47.593612+07	\N	\N	\N
e33dec33-a076-4af5-b8a3-786ea09435df	a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a15	khach_san	Đặt phòng khách sạn, homestay, resort	dat-phong-khach-san	\N	Dịch vụ lưu trú toàn cầu	t	2026-07-06 09:28:47.593612+07	2026-07-06 09:28:47.593612+07	\N	\N	\N
24a04b5a-18d5-45ef-8e9d-684ad1c75f95	a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a15	tour_du_lich	Đặt tour ghép / tour riêng theo nhu cầu	dat-tour-du-lich	\N	Tổ chức tour du lịch chuyên nghiệp	t	2026-07-06 09:28:47.593612+07	2026-07-06 09:28:47.593612+07	\N	\N	\N
15b7d6ea-f613-4d51-b1b4-f5ce2fe3283a	a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a15	thue_xe_tu_lai	Thuê xe tự lái / xe du lịch có tài xế	thue-xe-tu-lai	\N	Dịch vụ xe du lịch đa dạng	t	2026-07-06 09:28:47.593612+07	2026-07-06 09:28:47.593612+07	\N	\N	\N
fa774f81-b268-47f8-ac69-83e43b12346e	a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a15	dua_don_san_bay	Đưa đón sân bay 2 chiều	dua-don-san-bay	\N	Vận chuyển sân bay đúng giờ	t	2026-07-06 09:28:47.593612+07	2026-07-06 09:28:47.593612+07	\N	\N	\N
a4aba839-db80-437b-a3ed-a81e03fd4ff9	a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a15	visa_ho_chieu	Hỗ trợ visa, hộ chiếu và lịch trình	visa-ho-chieu	\N	Dịch vụ hồ sơ du lịch nhanh chóng	t	2026-07-06 09:28:47.593612+07	2026-07-06 09:28:47.593612+07	\N	\N	\N
e202833f-294c-488c-ab5e-b03da04d77ae	a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a15	hdv_du_lich	Hướng dẫn viên du lịch theo điểm đến	hdv-du-lich	\N	Đội ngũ HDV nhiệt tình, am hiểu	t	2026-07-06 09:28:47.593612+07	2026-07-06 09:28:47.593612+07	\N	\N	\N
a092c863-6dc4-4e6b-8c18-41a07390e895	a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a15	combo_du_lich	Combo du lịch trọn gói (vé + phòng + xe)	combo-du-lich	\N	Tiết kiệm chi phí với combo trọn gói	t	2026-07-06 09:28:47.593612+07	2026-07-06 09:28:47.593612+07	\N	\N	\N
4e78ae0b-c9d9-49eb-9b36-21d8d3e2121d	a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a15	bao_hiem_du_lich	Bảo hiểm du lịch	bao-hiem-du-lich	\N	An tâm trên mọi cung đường	t	2026-07-06 09:28:47.593612+07	2026-07-06 09:28:47.593612+07	\N	\N	\N
478538ab-a2a8-4372-86e5-d8c83d7d402e	a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a15	sim_esim_du_lich	Dịch vụ SIM / eSIM du lịch	sim-esim-du-lich	\N	Kết nối internet mọi nơi trên thế giới	t	2026-07-06 09:28:47.593612+07	2026-07-06 09:28:47.593612+07	\N	\N	\N
4a4e1c01-5c68-4fd7-a997-9bcdb985f0ff	a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a14	dieu_duong	Điều dưỡng tại nhà (Tiêm, truyền, vật lý trị liệu)	dieu-duong-tai-nha	\N	Chăm sóc y tế gia đình	t	2026-07-06 09:28:47.593612+07	2026-07-06 09:28:47.593612+07	\N	\N	appointment
0cef3a2f-1b9e-4f9e-be0a-a923560abd56	a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a14	lay_mau_xet_nghiem	Lấy mẫu máu xét nghiệm tại nhà	lay-mau-xet-nghiem	\N	Tiện ích y tế tại nhà	t	2026-07-06 09:28:47.593612+07	2026-07-06 09:28:47.593612+07	\N	\N	appointment
54007542-85e1-4b1c-8c78-63720fe3d4c5	a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a14	gia_su_van_hoa	Gia sư văn hóa (Toán, Văn, Anh...)	gia-su-van-hoa	\N	Bồi dưỡng kiến thức văn hóa	t	2026-07-06 09:28:47.593612+07	2026-07-06 09:28:47.593612+07	\N	\N	tutor_session
1f479f43-45db-42f9-a0ca-3ba947028a5c	a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a14	gia_su_nang_khieu	Gia sư năng khiếu (Đàn, họa, võ, bơi)	gia-su-nang-khieu	\N	Phát triển năng khiếu nghệ thuật, thể thao	t	2026-07-06 09:28:47.593612+07	2026-07-06 09:28:47.593612+07	\N	\N	tutor_session
b1aabc11-0001-4000-aa00-000000000001	a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11	taxi_cong_nghe	Taxi công nghệ	taxi-cong-nghe	\N	Dịch vụ taxi đặt qua ứng dụng công nghệ	t	2026-07-06 09:30:11.825457+07	2026-07-06 09:30:11.825457+07	\N	\N	\N
b1aabc11-0001-4000-aa00-000000000002	a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11	xe_om_cn	Xe ôm công nghệ (app)	xe-om-cong-nghe-app	\N	Vận chuyển hành khách bằng xe máy qua ứng dụng	t	2026-07-06 09:30:11.825457+07	2026-07-06 09:30:11.825457+07	\N	\N	\N
b1aabc11-0001-4000-aa00-000000000003	a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11	xe_khach_lien_tinh	Xe khách liên tỉnh	xe-khach-lien-tinh	\N	Vận tải hành khách tuyến cố định liên tỉnh	t	2026-07-06 09:30:11.825457+07	2026-07-06 09:30:11.825457+07	\N	\N	\N
b1aabc11-0001-4000-aa00-000000000004	a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11	xe_ghep_tien_chuyen	Xe ghép tiện chuyến	xe-ghep-tien-chuyen	\N	Dịch vụ xe ghép theo chuyến liên tỉnh	t	2026-07-06 09:30:11.825457+07	2026-07-06 09:30:11.825457+07	\N	\N	\N
b1aabc11-0001-4000-aa00-000000000005	a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11	xe_limousine	Xe Limousine cao cấp	xe-limousine	\N	Vận chuyển cao cấp bằng xe Limousine: sân bay, sự kiện, VIP	t	2026-07-06 09:30:11.825457+07	2026-07-06 09:30:11.825457+07	\N	\N	\N
b1aabc11-0001-4000-aa00-000000000006	a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11	lai_xe_oto_ho	Lái xe ô tô hộ	lai-xe-oto-ho	\N	Lái xe ô tô hộ theo chuyến hoặc theo ngày	t	2026-07-06 09:30:11.825457+07	2026-07-06 09:30:11.825457+07	\N	\N	\N
b1aabc11-0001-4000-aa00-000000000007	a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11	lai_xe_thue_chuyen	Lái xe thuê theo chuyến / ngày	lai-xe-thue-theo-chuyen	\N	Tài xế chuyên nghiệp cho thuê theo chuyến hoặc ngày	t	2026-07-06 09:30:11.825457+07	2026-07-06 09:30:11.825457+07	\N	\N	\N
b1aabc11-0001-4000-aa00-000000000008	a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11	shipper_noi_thanh	Shipper giao hàng nội thành	shipper-noi-thanh	\N	Giao nhận hàng hóa nội thành bằng xe máy hoặc xe tải nhỏ	t	2026-07-06 09:30:11.825457+07	2026-07-06 09:30:11.825457+07	\N	\N	\N
b1aabc11-0001-4000-aa00-000000000009	a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11	xe_tai_hop_dong	Xe tải hợp đồng	xe-tai-hop-dong	\N	Vận tải hàng hóa bằng xe tải theo hợp đồng	t	2026-07-06 09:30:11.825457+07	2026-07-06 09:30:11.825457+07	\N	\N	\N
b1aabc11-0001-4000-aa00-000000000010	a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11	van_tai_bac_nam	Vận tải Bắc-Trung-Nam	van-tai-bac-nam	\N	Vận tải hàng hóa tuyến dài xuyên Bắc-Trung-Nam	t	2026-07-06 09:30:11.825457+07	2026-07-06 09:30:11.825457+07	\N	\N	\N
b1aabc11-0001-4000-aa00-000000000011	a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11	cuu_ho_giao_thong	Cứu hộ giao thông 24/7	cuu-ho-giao-thong-24h	\N	Hỗ trợ sự cố giao thông 24/7: kéo xe, vá lốp, sạc ắc-quy, hộ tống	t	2026-07-06 09:30:11.825457+07	2026-07-06 09:30:11.825457+07	\N	\N	\N
b1aabc11-0001-4000-aa00-000000000012	a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11	cho_thue_xe_tu_lai_oto	Cho thuê xe ô tô tự lái	cho-thue-xe-tu-lai-oto	\N	Cho thuê xe ô tô tự lái theo ngày, giờ hoặc tuần	t	2026-07-06 09:30:11.825457+07	2026-07-06 09:30:11.825457+07	\N	\N	\N
b1aabc11-0001-4000-aa00-000000000013	a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11	cho_thue_xe_may	Cho thuê xe máy tự lái	cho-thue-xe-may-tu-lai	\N	Cho thuê xe máy (xe số, xe ga, xe điện) tự lái theo ngày	t	2026-07-06 09:30:11.825457+07	2026-07-06 09:30:11.825457+07	\N	\N	\N
c1aabc11-0001-4000-bb00-000000000001	a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13	giup_viec_ngay	Giúp việc theo ngày	giup-viec-theo-ngay	\N	Giúp việc nhà trọn ngày, nấu cơm, dọn dẹp	t	2026-07-06 09:30:36.972208+07	2026-07-06 09:30:36.972208+07	\N	\N	\N
c1aabc11-0001-4000-bb00-000000000002	a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13	giup_viec_thang	Giúp việc theo tháng	giup-viec-theo-thang	\N	Giúp việc nhà ở lại hoặc theo tháng dài hạn	t	2026-07-06 09:30:36.972208+07	2026-07-06 09:30:36.972208+07	\N	\N	\N
c1aabc11-0001-4000-bb00-000000000003	a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a14	trung_tam_ngoai_ngu	Trung tâm ngoại ngữ / bồi dưỡng	trung-tam-ngoai-ngu	\N	Trung tâm đào tạo ngoại ngữ, luyện thi, bồi dưỡng kiến thức	t	2026-07-06 09:30:36.972208+07	2026-07-06 09:30:36.972208+07	\N	\N	\N
48d2e027-ecea-48af-ad6a-baa8f9e38d27	a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11	lai_xe_ho_xe_may	Lái xe máy hộ	lai-xe-ho-xe-may	\N	Dịch vụ lái xe máy hộ khi bạn không tiện lái	t	2026-07-06 09:28:47.593612+07	2026-07-06 09:28:47.593612+07	\N	\N	\N
f6b71f51-3105-4b3d-80ae-362a0417d719	a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11	sua_xe_luu_dong	Sửa xe ô tô lưu động (Vá lốp, sửa nhanh)	sua-xe-luu-dong	\N	Sửa chữa nhanh ô tô tại chỗ: vá lốp, thay bình ắc-quy, sửa điện	t	2026-07-06 09:28:47.593612+07	2026-07-06 09:28:47.593612+07	\N	\N	\N
b1aabc11-0001-4000-aa00-000000000014	a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11	xe_tai_chuyen_nha	Xe tải chuyển nhà, chuyển văn phòng trọn gói	xe-tai-chuyen-nha	\N	Vận chuyển đồ đạc chuyển nhà/văn phòng trọn gói (không kèm bốc vác)	t	2026-07-06 09:30:36.972208+07	2026-07-06 09:30:36.972208+07	\N	\N	\N
b1aabc11-0001-4000-aa00-000000000015	a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11	van_chuyen_lien_tinh	Vận chuyển hàng hóa liên tỉnh (0.5-20 tấn)	van-chuyen-hang-lien-tinh	\N	Vận chuyển hàng hóa liên tỉnh từ 0,5 tấn đến 20 tấn	t	2026-07-06 09:30:36.972208+07	2026-07-06 09:30:36.972208+07	\N	\N	\N
b1aabc11-0001-4000-aa00-000000000016	a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11	xe_hop_dong_khach	Xe hợp đồng (4-7-16-29-45 chỗ)	xe-hop-dong-khach	\N	Dịch vụ xe hợp đồng chở khách theo nhu cầu	t	2026-07-06 09:30:36.972208+07	2026-07-06 09:30:36.972208+07	\N	\N	\N
b1aabc11-0001-4000-aa00-000000000017	a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11	goi_do_an	Gọi đồ ăn	goi-do-an	\N	Đặt và giao đồ ăn tận nơi qua nền tảng	t	2026-07-06 09:30:36.972208+07	2026-07-06 09:30:36.972208+07	\N	\N	\N
b1aabc11-0001-4000-aa00-000000000020	a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11	ve_tau_hoa	Vé tàu hỏa	ve-tau-hoa	\N	Đặt vé tàu hỏa nội địa các tuyến	t	2026-07-06 09:30:36.972208+07	2026-07-06 09:30:36.972208+07	\N	\N	\N
d1aabc11-0001-4000-cc00-000000000001	a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a15	nap_the_dt	Nạp thẻ điện thoại	nap-the-dien-thoai	\N	Dịch vụ nạp thẻ điện thoại các mạng	t	2026-07-06 09:30:36.972208+07	2026-07-06 09:30:36.972208+07	\N	\N	\N
d1aabc11-0001-4000-cc00-000000000002	a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a15	xich_lo	Xích lô (du lịch + chở hàng)	xich-lo	\N	Xích lô phục vụ khách du lịch và chở hàng nội thành	t	2026-07-06 09:30:36.972208+07	2026-07-06 09:30:36.972208+07	\N	\N	\N
d1aabc11-0001-4000-cc00-000000000003	a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a15	xe_dien_du_lich	Xe điện khu du lịch	xe-dien-khu-du-lich	\N	Cho thuê hoặc vận chuyển bằng xe điện trong khu du lịch	t	2026-07-06 09:30:36.972208+07	2026-07-06 09:30:36.972208+07	\N	\N	\N
\.


--
-- TOC entry 7554 (class 0 OID 27014)
-- Dependencies: 241
-- Data for Name: service_category_attributes; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.service_category_attributes (id, service_category_id, attr_key, attr_label, data_type, is_required, is_filterable, is_searchable, default_value, placeholder, help_text, options_json, validation_json, created_at, updated_at, created_by, updated_by) FROM stdin;
9007226d-156b-4c26-91f5-43ae50f8ecc0	b1aabc11-0001-4000-aa00-000000000001	vehicle_type	Loại xe	select	t	t	f	\N	\N	\N	["sedan", "suv", "7_cho"]	\N	2026-07-06 09:30:11.825457+07	2026-07-06 09:30:11.825457+07	\N	\N
ff6ae97b-2f91-4f57-89db-ed698025eacc	b1aabc11-0001-4000-aa00-000000000001	seat_count	Số chỗ ngồi	number	t	t	f	\N	\N	\N	\N	\N	2026-07-06 09:30:11.825457+07	2026-07-06 09:30:11.825457+07	\N	\N
13751a63-6db7-40e3-9962-68580f6028b4	b1aabc11-0001-4000-aa00-000000000001	service_provinces	Tỉnh/TP phục vụ	select	t	t	f	\N	\N	\N	\N	\N	2026-07-06 09:30:11.825457+07	2026-07-06 09:30:11.825457+07	\N	\N
b3c0f71f-4f77-486a-9f39-b25b4cd733ac	b1aabc11-0001-4000-aa00-000000000001	has_ac	Có điều hòa	boolean	f	t	f	\N	\N	\N	\N	\N	2026-07-06 09:30:11.825457+07	2026-07-06 09:30:11.825457+07	\N	\N
fa88b9cf-cfbc-4904-9555-cfd1c4bfd4c2	b1aabc11-0001-4000-aa00-000000000001	has_child_seat	Có ghế trẻ em	boolean	f	t	f	\N	\N	\N	\N	\N	2026-07-06 09:30:11.825457+07	2026-07-06 09:30:11.825457+07	\N	\N
a23a7228-ea66-490b-a858-9c447d4d8bc1	b1aabc11-0001-4000-aa00-000000000001	has_wheelchair	Hỗ trợ xe lăn	boolean	f	t	f	\N	\N	\N	\N	\N	2026-07-06 09:30:11.825457+07	2026-07-06 09:30:11.825457+07	\N	\N
e031b33d-4231-4816-a988-7563d42c9e9d	b1aabc11-0001-4000-aa00-000000000001	pricing_model	Mô hình tính giá	select	t	f	f	\N	\N	\N	["theo_km", "theo_thoi_gian", "co_dinh"]	\N	2026-07-06 09:30:11.825457+07	2026-07-06 09:30:11.825457+07	\N	\N
69a16608-af18-424c-967f-d84398d79b0d	b1aabc11-0001-4000-aa00-000000000002	vehicle_type	Loại xe máy	select	t	t	f	\N	\N	\N	["xe_may", "xe_so", "xe_dien"]	\N	2026-07-06 09:30:11.825457+07	2026-07-06 09:30:11.825457+07	\N	\N
a01fc750-f1fd-4aa1-be49-1fb8d8a616ad	b1aabc11-0001-4000-aa00-000000000002	service_provinces	Tỉnh/TP phục vụ	select	t	t	f	\N	\N	\N	\N	\N	2026-07-06 09:30:11.825457+07	2026-07-06 09:30:11.825457+07	\N	\N
2f8701a5-24eb-40e1-af15-b80638ea77ec	b1aabc11-0001-4000-aa00-000000000002	has_helmet	Cung cấp mũ bảo hiểm	boolean	t	t	f	\N	\N	\N	\N	\N	2026-07-06 09:30:11.825457+07	2026-07-06 09:30:11.825457+07	\N	\N
fe972b36-c6c8-4916-b104-3587ff7c72ec	b1aabc11-0001-4000-aa00-000000000002	has_raincoat	Cung cấp áo mưa	boolean	f	t	f	\N	\N	\N	\N	\N	2026-07-06 09:30:11.825457+07	2026-07-06 09:30:11.825457+07	\N	\N
28fd0be0-92ce-4cad-a915-289e2fe94bd5	b1aabc11-0001-4000-aa00-000000000002	max_load_kg	Tải trọng hành lý tối đa (kg)	number	f	f	f	\N	\N	\N	\N	\N	2026-07-06 09:30:11.825457+07	2026-07-06 09:30:11.825457+07	\N	\N
f8e0fa2c-bef1-48cb-9239-414165d415de	b1aabc11-0001-4000-aa00-000000000003	seat_type	Loại ghế	select	t	t	f	\N	\N	\N	["ngoi", "nam", "giuong"]	\N	2026-07-06 09:30:11.825457+07	2026-07-06 09:30:11.825457+07	\N	\N
d5b40b7e-6ef1-4c62-8067-52acb82d7870	b1aabc11-0001-4000-aa00-000000000003	seat_count	Số chỗ	number	t	t	f	\N	\N	\N	\N	\N	2026-07-06 09:30:11.825457+07	2026-07-06 09:30:11.825457+07	\N	\N
4de914aa-908c-4019-821a-2bc43648fb46	b1aabc11-0001-4000-aa00-000000000003	route_type	Loại tuyến	select	t	t	f	\N	\N	\N	["co_dinh", "hop_dong"]	\N	2026-07-06 09:30:11.825457+07	2026-07-06 09:30:11.825457+07	\N	\N
bc2ebe0b-c6b3-453c-baf7-e320b2aadccc	b1aabc11-0001-4000-aa00-000000000003	has_ac	Có điều hòa	boolean	f	t	f	\N	\N	\N	\N	\N	2026-07-06 09:30:11.825457+07	2026-07-06 09:30:11.825457+07	\N	\N
9324a6d3-ae16-482a-9bef-50fd455f5a01	b1aabc11-0001-4000-aa00-000000000003	has_wifi	Có WiFi	boolean	f	t	f	\N	\N	\N	\N	\N	2026-07-06 09:30:11.825457+07	2026-07-06 09:30:11.825457+07	\N	\N
2d4bd275-e1f4-408e-bd85-ca1e76dfb802	b1aabc11-0001-4000-aa00-000000000003	has_usb	Có cổng sạc USB	boolean	f	t	f	\N	\N	\N	\N	\N	2026-07-06 09:30:11.825457+07	2026-07-06 09:30:11.825457+07	\N	\N
4a53404b-f1f3-44b2-a86e-6dd94e381db3	b1aabc11-0001-4000-aa00-000000000003	luggage_allowance_kg	Hành lý cho phép (kg)	number	f	f	f	\N	\N	\N	\N	\N	2026-07-06 09:30:11.825457+07	2026-07-06 09:30:11.825457+07	\N	\N
da63924a-b09f-49a9-b07c-81e0715b3dd6	b1aabc11-0001-4000-aa00-000000000004	route_from_province	Tỉnh/TP đi	select	t	t	f	\N	\N	\N	\N	\N	2026-07-06 09:30:11.825457+07	2026-07-06 09:30:11.825457+07	\N	\N
c899a123-f0de-4ff9-bff1-aa9a211486af	b1aabc11-0001-4000-aa00-000000000004	route_to_province	Tỉnh/TP đến	select	t	t	f	\N	\N	\N	\N	\N	2026-07-06 09:30:11.825457+07	2026-07-06 09:30:11.825457+07	\N	\N
4bf6a559-8bef-4ba1-9b22-07178f07747c	b1aabc11-0001-4000-aa00-000000000004	vehicle_type	Loại xe	select	t	t	f	\N	\N	\N	["xe_4_cho", "xe_7_cho", "xe_16_cho"]	\N	2026-07-06 09:30:11.825457+07	2026-07-06 09:30:11.825457+07	\N	\N
09177ffb-36a1-414d-93bc-b9f686bbfcee	b1aabc11-0001-4000-aa00-000000000004	seat_count_per_trip	Số chỗ / chuyến	number	t	t	f	\N	\N	\N	\N	\N	2026-07-06 09:30:11.825457+07	2026-07-06 09:30:11.825457+07	\N	\N
a2159a01-e313-4c40-bcc7-d50aeb6ab227	b1aabc11-0001-4000-aa00-000000000004	pricing_type	Loại giá vé	select	t	f	f	\N	\N	\N	["per_seat", "full_car"]	\N	2026-07-06 09:30:11.825457+07	2026-07-06 09:30:11.825457+07	\N	\N
e6f5582e-944c-4a6c-a9fe-d5c22d673d7f	b1aabc11-0001-4000-aa00-000000000005	seat_count	Số chỗ ngồi	number	t	t	f	\N	\N	\N	\N	\N	2026-07-06 09:30:11.825457+07	2026-07-06 09:30:11.825457+07	\N	\N
006ec03e-cf4a-47ea-a1f0-e53b98e7d3d4	b1aabc11-0001-4000-aa00-000000000005	vehicle_brand	Hãng xe	select	t	t	f	\N	\N	\N	["Mercedes", "Dcar", "Solati", "Ford"]	\N	2026-07-06 09:30:11.825457+07	2026-07-06 09:30:11.825457+07	\N	\N
409cd959-789b-4548-b0e1-80ad870775bf	b1aabc11-0001-4000-aa00-000000000005	vehicle_model	Dòng xe	text	f	f	f	\N	\N	\N	\N	\N	2026-07-06 09:30:11.825457+07	2026-07-06 09:30:11.825457+07	\N	\N
eaed859e-c649-4875-99a2-dd299724f8b3	b1aabc11-0001-4000-aa00-000000000005	has_wifi	Có WiFi	boolean	f	t	f	\N	\N	\N	\N	\N	2026-07-06 09:30:11.825457+07	2026-07-06 09:30:11.825457+07	\N	\N
b8c98d0d-fd19-45d3-a86c-8e76878517d9	b1aabc11-0001-4000-aa00-000000000005	has_mini_bar	Có mini bar	boolean	f	t	f	\N	\N	\N	\N	\N	2026-07-06 09:30:11.825457+07	2026-07-06 09:30:11.825457+07	\N	\N
462ce270-79df-4efe-810c-e8b384e66ae4	b1aabc11-0001-4000-aa00-000000000005	service_type	Hình thức dịch vụ	select	t	t	f	\N	\N	\N	["airport", "event", "vip_transfer", "tour"]	\N	2026-07-06 09:30:11.825457+07	2026-07-06 09:30:11.825457+07	\N	\N
41498c55-931e-4c0e-a8ac-ade6c77d9be9	b1aabc11-0001-4000-aa00-000000000005	route_type	Phạm vi hoạt động	select	t	t	f	\N	\N	\N	["noi_tinh", "lien_tinh", "bac_nam"]	\N	2026-07-06 09:30:11.825457+07	2026-07-06 09:30:11.825457+07	\N	\N
37465f61-704f-4906-8455-faa7befec3f0	b1aabc11-0001-4000-aa00-000000000006	service_type	Hình thức	select	t	t	f	\N	\N	\N	["theo_chuyen", "theo_ngay", "theo_gio"]	\N	2026-07-06 09:30:11.825457+07	2026-07-06 09:30:11.825457+07	\N	\N
995043ec-9549-496b-93a1-3c8893318caa	b1aabc11-0001-4000-aa00-000000000006	vehicle_types_accepted	Loại xe nhận lái	multiselect	t	t	f	\N	\N	\N	["4_cho", "7_cho", "16_cho", "29_cho", "45_cho"]	\N	2026-07-06 09:30:11.825457+07	2026-07-06 09:30:11.825457+07	\N	\N
f3c3ab26-8c33-4d99-82a4-2b9fbc67a516	b1aabc11-0001-4000-aa00-000000000006	service_provinces	Khu vực hoạt động	select	t	t	f	\N	\N	\N	\N	\N	2026-07-06 09:30:11.825457+07	2026-07-06 09:30:11.825457+07	\N	\N
0e157827-3d1b-4259-9d01-a22ee07f1f13	b1aabc11-0001-4000-aa00-000000000006	night_service	Phục vụ ban đêm	boolean	f	t	f	\N	\N	\N	\N	\N	2026-07-06 09:30:11.825457+07	2026-07-06 09:30:11.825457+07	\N	\N
ce8dc8a1-8536-42ac-8539-f7c775ddd764	b1aabc11-0001-4000-aa00-000000000006	available_24h	Sẵn sàng 24/7	boolean	f	t	f	\N	\N	\N	\N	\N	2026-07-06 09:30:11.825457+07	2026-07-06 09:30:11.825457+07	\N	\N
133b6179-2ee2-4718-a91f-a63e8df0e899	b1aabc11-0001-4000-aa00-000000000007	service_type	Hình thức thuê	select	t	t	f	\N	\N	\N	["per_trip", "per_day", "per_hour"]	\N	2026-07-06 09:30:11.825457+07	2026-07-06 09:30:11.825457+07	\N	\N
0a72f132-f1f9-49ae-a914-2497e4cf81f4	b1aabc11-0001-4000-aa00-000000000007	vehicle_types_accepted	Loại xe nhận lái	multiselect	t	t	f	\N	\N	\N	["4_cho", "7_cho", "16_cho"]	\N	2026-07-06 09:30:11.825457+07	2026-07-06 09:30:11.825457+07	\N	\N
04320683-7b2e-4bc5-b39a-6a039ff851ba	b1aabc11-0001-4000-aa00-000000000007	min_hours	Số giờ tối thiểu	number	f	f	f	\N	\N	\N	\N	\N	2026-07-06 09:30:11.825457+07	2026-07-06 09:30:11.825457+07	\N	\N
f06eae11-5696-41f5-942b-edbdbc71dd16	b1aabc11-0001-4000-aa00-000000000007	service_provinces	Khu vực hoạt động	select	t	t	f	\N	\N	\N	\N	\N	2026-07-06 09:30:11.825457+07	2026-07-06 09:30:11.825457+07	\N	\N
36fbf1bd-69ea-461a-b92a-0e61b0831529	b1aabc11-0001-4000-aa00-000000000008	vehicle_type	Loại phương tiện	select	t	t	f	\N	\N	\N	["xe_may", "xe_ba_banh", "xe_tai_nho"]	\N	2026-07-06 09:30:11.825457+07	2026-07-06 09:30:11.825457+07	\N	\N
24a016b5-1c40-4374-b9ea-5e5a97fa1c1d	b1aabc11-0001-4000-aa00-000000000008	max_load_kg	Tải trọng tối đa (kg)	number	t	t	f	\N	\N	\N	\N	\N	2026-07-06 09:30:11.825457+07	2026-07-06 09:30:11.825457+07	\N	\N
fcc6e04b-dd72-47c2-b6e2-fb0893afd952	b1aabc11-0001-4000-aa00-000000000008	max_size_cm3	Kích thước tối đa (cm3)	number	f	f	f	\N	\N	\N	\N	\N	2026-07-06 09:30:11.825457+07	2026-07-06 09:30:11.825457+07	\N	\N
fc0a6c17-950c-40a0-b276-9d89da88f1a4	b1aabc11-0001-4000-aa00-000000000008	has_refrigeration	Thùng lạnh	boolean	f	t	f	\N	\N	\N	\N	\N	2026-07-06 09:30:11.825457+07	2026-07-06 09:30:11.825457+07	\N	\N
266affbf-a832-4616-81eb-974c5d9278a4	b1aabc11-0001-4000-aa00-000000000008	cargo_types	Loại hàng nhận	multiselect	f	t	f	\N	\N	\N	["thuc_pham", "do_dung", "tai_lieu", "dong_lanh", "de_vo"]	\N	2026-07-06 09:30:11.825457+07	2026-07-06 09:30:11.825457+07	\N	\N
e90402bd-a33c-4952-b49a-4bf5e924c050	b1aabc11-0001-4000-aa00-000000000008	service_provinces	Tỉnh/TP hoạt động	select	t	t	f	\N	\N	\N	\N	\N	2026-07-06 09:30:11.825457+07	2026-07-06 09:30:11.825457+07	\N	\N
cfecf278-b646-4950-98a1-59993bb720ed	b1aabc11-0001-4000-aa00-000000000008	same_day_delivery	Giao trong ngày	boolean	f	t	f	\N	\N	\N	\N	\N	2026-07-06 09:30:11.825457+07	2026-07-06 09:30:11.825457+07	\N	\N
3e0b735f-8fac-4323-9b5e-765a8fd3b68a	b1aabc11-0001-4000-aa00-000000000009	max_load_ton	Tải trọng tối đa (tấn)	number	t	t	f	\N	\N	\N	\N	\N	2026-07-06 09:30:11.825457+07	2026-07-06 09:30:11.825457+07	\N	\N
925b3c45-5036-4ce4-8c2a-31acd65225da	b1aabc11-0001-4000-aa00-000000000009	has_refrigeration	Thùng lạnh	boolean	f	t	f	\N	\N	\N	\N	\N	2026-07-06 09:30:11.825457+07	2026-07-06 09:30:11.825457+07	\N	\N
641557b4-5953-487e-af84-bf26330e27a8	b1aabc11-0001-4000-aa00-000000000009	has_crane	Có cẩu	boolean	f	t	f	\N	\N	\N	\N	\N	2026-07-06 09:30:11.825457+07	2026-07-06 09:30:11.825457+07	\N	\N
60af53ba-81a4-4dec-a126-9a5e3cfe33ff	b1aabc11-0001-4000-aa00-000000000009	body_type	Loại thùng xe	select	t	t	f	\N	\N	\N	["bat", "mui_kin", "dong_lanh", "cau"]	\N	2026-07-06 09:30:11.825457+07	2026-07-06 09:30:11.825457+07	\N	\N
09022266-efc8-4ea3-9a70-cb4e50310a87	b1aabc11-0001-4000-aa00-000000000009	service_area	Phạm vi hoạt động	select	t	t	f	\N	\N	\N	["noi_tinh", "lien_tinh", "bac_nam"]	\N	2026-07-06 09:30:11.825457+07	2026-07-06 09:30:11.825457+07	\N	\N
73d578a3-fcef-4c68-b123-9d674d766224	b1aabc11-0001-4000-aa00-000000000010	route_coverage	Tuyến vận tải	select	t	t	f	\N	\N	\N	["bac_nam", "bac_trung", "trung_nam"]	\N	2026-07-06 09:30:11.825457+07	2026-07-06 09:30:11.825457+07	\N	\N
7a2a2e17-95d7-4491-b437-6457176bd09c	b1aabc11-0001-4000-aa00-000000000010	max_load_ton	Tải trọng tối đa (tấn)	number	t	t	f	\N	\N	\N	\N	\N	2026-07-06 09:30:11.825457+07	2026-07-06 09:30:11.825457+07	\N	\N
fed02749-6322-4493-a1cb-64bc7f00177d	b1aabc11-0001-4000-aa00-000000000010	has_GPS	Có GPS theo dõi	boolean	f	t	f	\N	\N	\N	\N	\N	2026-07-06 09:30:11.825457+07	2026-07-06 09:30:11.825457+07	\N	\N
06395cf7-ca4d-499f-8f19-c098b29d7112	b1aabc11-0001-4000-aa00-000000000010	delivery_days_avg	Số ngày giao hàng trung bình	number	f	f	f	\N	\N	\N	\N	\N	2026-07-06 09:30:11.825457+07	2026-07-06 09:30:11.825457+07	\N	\N
6c69d6b0-0f98-4cf8-8047-d2bbde9a3c9d	b1aabc11-0001-4000-aa00-000000000010	cargo_insurance	Có bảo hiểm hàng hóa	boolean	f	t	f	\N	\N	\N	\N	\N	2026-07-06 09:30:11.825457+07	2026-07-06 09:30:11.825457+07	\N	\N
634d6f30-eace-4d46-8a96-f8bc7c9a7723	b1aabc11-0001-4000-aa00-000000000011	service_types	Loại cứu hộ	multiselect	t	t	f	\N	\N	\N	["keo_xe", "va_lop", "sua_xe", "ho_tong", "day_ach"]	\N	2026-07-06 09:30:11.825457+07	2026-07-06 09:30:11.825457+07	\N	\N
0e7a33e5-1592-4db0-a427-34e4e6b9596a	b1aabc11-0001-4000-aa00-000000000011	vehicle_types_supported	Loại xe hỗ trợ	multiselect	t	t	f	\N	\N	\N	["xe_may", "o_to_con", "xe_tai", "xe_khach"]	\N	2026-07-06 09:30:11.825457+07	2026-07-06 09:30:11.825457+07	\N	\N
f777b73b-994d-47da-874f-42947c732ab4	b1aabc11-0001-4000-aa00-000000000011	response_time_min	Thời gian đến (phút)	number	t	t	f	\N	\N	\N	\N	\N	2026-07-06 09:30:11.825457+07	2026-07-06 09:30:11.825457+07	\N	\N
15347f85-ca84-4ea7-8104-deb837df9d52	b1aabc11-0001-4000-aa00-000000000011	service_provinces	Khu vực hoạt động	select	t	t	f	\N	\N	\N	\N	\N	2026-07-06 09:30:11.825457+07	2026-07-06 09:30:11.825457+07	\N	\N
d4929b4e-aeeb-41bc-aded-4d3e32f60ead	b1aabc11-0001-4000-aa00-000000000011	available_24h	Phục vụ 24/7	boolean	t	t	f	\N	\N	\N	\N	\N	2026-07-06 09:30:11.825457+07	2026-07-06 09:30:11.825457+07	\N	\N
5f89e8d9-9d57-4700-a609-b00333c512d9	b1aabc11-0001-4000-aa00-000000000012	vehicle_brand	Hãng xe	select	t	t	f	\N	\N	\N	["Toyota", "Honda", "Kia", "Mazda", "Ford", "Hyundai", "VinFast", "Mitsubishi"]	\N	2026-07-06 09:30:11.825457+07	2026-07-06 09:30:11.825457+07	\N	\N
c4d5b225-6f78-46c6-9e6b-413190b31ce9	b1aabc11-0001-4000-aa00-000000000012	vehicle_model	Dòng xe	text	t	f	f	\N	\N	\N	\N	\N	2026-07-06 09:30:11.825457+07	2026-07-06 09:30:11.825457+07	\N	\N
7ca35176-b7c2-4644-98dd-ddd1a750bc26	b1aabc11-0001-4000-aa00-000000000012	year_of_manufacture	Năm sản xuất	number	t	t	f	\N	\N	\N	\N	\N	2026-07-06 09:30:11.825457+07	2026-07-06 09:30:11.825457+07	\N	\N
1b5b5fd1-8df4-4b14-9272-46b052951759	b1aabc11-0001-4000-aa00-000000000012	seat_count	Số chỗ ngồi	number	t	t	f	\N	\N	\N	\N	\N	2026-07-06 09:30:11.825457+07	2026-07-06 09:30:11.825457+07	\N	\N
9f818594-ccc1-4a78-88cc-65226a156e84	b1aabc11-0001-4000-aa00-000000000012	fuel_type	Nhiên liệu	select	t	t	f	\N	\N	\N	["xang", "dau", "dien", "hybrid"]	\N	2026-07-06 09:30:11.825457+07	2026-07-06 09:30:11.825457+07	\N	\N
b0925693-dc52-4043-8bcd-644bbe4c2066	b1aabc11-0001-4000-aa00-000000000012	transmission	Hộp số	select	t	t	f	\N	\N	\N	["auto", "manual"]	\N	2026-07-06 09:30:11.825457+07	2026-07-06 09:30:11.825457+07	\N	\N
a489ff7a-9a38-44c5-a543-b329d0544ce5	b1aabc11-0001-4000-aa00-000000000012	rental_type	Hình thức thuê	select	t	t	f	\N	\N	\N	["theo_ngay", "theo_gio", "theo_tuan"]	\N	2026-07-06 09:30:11.825457+07	2026-07-06 09:30:11.825457+07	\N	\N
b3934ebe-7649-49d8-a40c-c6dd67bc2270	b1aabc11-0001-4000-aa00-000000000012	price_per_day	Giá/ngày (VNĐ)	number	f	t	f	\N	\N	\N	\N	\N	2026-07-06 09:30:11.825457+07	2026-07-06 09:30:11.825457+07	\N	\N
e5c011e1-4cca-4e43-b112-8738575147b9	b1aabc11-0001-4000-aa00-000000000012	price_per_hour	Giá/giờ (VNĐ)	number	f	f	f	\N	\N	\N	\N	\N	2026-07-06 09:30:11.825457+07	2026-07-06 09:30:11.825457+07	\N	\N
57da0f26-9b06-4498-b9b2-95c8450db6e2	b1aabc11-0001-4000-aa00-000000000012	deposit_required	Cần đặt cọc	boolean	f	t	f	\N	\N	\N	\N	\N	2026-07-06 09:30:11.825457+07	2026-07-06 09:30:11.825457+07	\N	\N
62a36218-ef22-40da-baf7-270cbd51e75c	b1aabc11-0001-4000-aa00-000000000012	has_driver_option	Có tài xế đi kèm	boolean	f	t	f	\N	\N	\N	\N	\N	2026-07-06 09:30:11.825457+07	2026-07-06 09:30:11.825457+07	\N	\N
456050e4-eca1-4b52-9090-ce10ec8a8a35	b1aabc11-0001-4000-aa00-000000000012	delivery_available	Giao xe tận nơi	boolean	f	t	f	\N	\N	\N	\N	\N	2026-07-06 09:30:11.825457+07	2026-07-06 09:30:11.825457+07	\N	\N
e4d73bb6-4390-4f1f-b7fe-3d3ad81fa5b7	b1aabc11-0001-4000-aa00-000000000012	min_rental_days	Thuê tối thiểu (ngày)	number	f	f	f	\N	\N	\N	\N	\N	2026-07-06 09:30:11.825457+07	2026-07-06 09:30:11.825457+07	\N	\N
1d346f91-2255-47aa-9a57-d65f1ed2ee2e	b1aabc11-0001-4000-aa00-000000000013	vehicle_type	Loại xe máy	select	t	t	f	\N	\N	\N	["xe_so", "xe_ga", "xe_dien"]	\N	2026-07-06 09:30:11.825457+07	2026-07-06 09:30:11.825457+07	\N	\N
5f6d4c0c-e3ac-498a-8dec-466f1de58993	b1aabc11-0001-4000-aa00-000000000013	vehicle_brand	Hãng xe	select	f	t	f	\N	\N	\N	["Honda", "Yamaha", "Suzuki", "VinFast", "Piaggio"]	\N	2026-07-06 09:30:11.825457+07	2026-07-06 09:30:11.825457+07	\N	\N
061e0ba6-a9b3-4ffd-a190-40405ee43013	b1aabc11-0001-4000-aa00-000000000013	vehicle_model	Dòng xe	text	f	f	f	\N	\N	\N	\N	\N	2026-07-06 09:30:11.825457+07	2026-07-06 09:30:11.825457+07	\N	\N
2576124f-efb3-4158-871e-6e8b7891ec25	b1aabc11-0001-4000-aa00-000000000013	engine_cc	Dung tích xi-lanh (cc)	number	f	f	f	\N	\N	\N	\N	\N	2026-07-06 09:30:11.825457+07	2026-07-06 09:30:11.825457+07	\N	\N
cbba6dfd-30a0-46bb-a2fb-332c4a1a3f92	b1aabc11-0001-4000-aa00-000000000013	rental_type	Hình thức thuê	select	t	t	f	\N	\N	\N	["theo_ngay", "theo_gio"]	\N	2026-07-06 09:30:11.825457+07	2026-07-06 09:30:11.825457+07	\N	\N
35878f58-3c44-4925-a4b2-9c2daa45a388	b1aabc11-0001-4000-aa00-000000000013	price_per_day	Giá/ngày (VNĐ)	number	t	t	f	\N	\N	\N	\N	\N	2026-07-06 09:30:11.825457+07	2026-07-06 09:30:11.825457+07	\N	\N
eddfa2f8-b93c-4c40-a386-d8ebd74abcef	b1aabc11-0001-4000-aa00-000000000013	has_helmet	Kèm mũ bảo hiểm	boolean	t	t	f	\N	\N	\N	\N	\N	2026-07-06 09:30:11.825457+07	2026-07-06 09:30:11.825457+07	\N	\N
fcbaafdd-6f82-4029-be64-92ccf547ceda	b1aabc11-0001-4000-aa00-000000000013	delivery_available	Giao xe tận nơi	boolean	f	t	f	\N	\N	\N	\N	\N	2026-07-06 09:30:11.825457+07	2026-07-06 09:30:11.825457+07	\N	\N
2cc33c56-fa87-4ccc-9de1-2d248da619ea	b1aabc11-0001-4000-aa00-000000000013	service_provinces	Tỉnh/TP hoạt động	select	t	t	f	\N	\N	\N	\N	\N	2026-07-06 09:30:11.825457+07	2026-07-06 09:30:11.825457+07	\N	\N
f1253de9-9197-46cb-a0fb-4168bab30e74	b1aabc11-0001-4000-aa00-000000000014	max_load_ton	Tải trọng tối đa (tấn)	number	t	t	f	\N	\N	\N	\N	\N	2026-07-06 09:30:36.972208+07	2026-07-06 09:30:36.972208+07	\N	\N
5d13e6c2-7d08-41e2-a30e-a6f90af9fcbf	b1aabc11-0001-4000-aa00-000000000014	service_type	Loại dịch vụ	select	t	t	f	\N	\N	\N	["chuyen_nha", "chuyen_van_phong", "tron_goi"]	\N	2026-07-06 09:30:36.972208+07	2026-07-06 09:30:36.972208+07	\N	\N
f5a53bcf-21ed-43f2-9d6a-d7d19a18eb3c	b1aabc11-0001-4000-aa00-000000000014	has_packing	Đóng gói đồ đạc	boolean	f	t	f	\N	\N	\N	\N	\N	2026-07-06 09:30:36.972208+07	2026-07-06 09:30:36.972208+07	\N	\N
903fe674-0267-4717-857c-3f32063dc4a3	b1aabc11-0001-4000-aa00-000000000014	service_area	Phạm vi hoạt động	select	t	t	f	\N	\N	\N	["noi_tinh", "lien_tinh"]	\N	2026-07-06 09:30:36.972208+07	2026-07-06 09:30:36.972208+07	\N	\N
bba5cef9-a4bc-409b-919b-6ff2605f3f71	b1aabc11-0001-4000-aa00-000000000015	max_load_ton	Tải trọng (tấn)	number	t	t	f	\N	\N	\N	\N	\N	2026-07-06 09:30:36.972208+07	2026-07-06 09:30:36.972208+07	\N	\N
e3682442-60c7-4afb-b5ac-f3fd08de85ee	b1aabc11-0001-4000-aa00-000000000015	vehicle_type	Loại xe	select	t	t	f	\N	\N	\N	["xe_tai_05t", "xe_tai_1t", "xe_tai_2t5", "xe_tai_5t", "xe_tai_10t", "xe_tai_20t"]	\N	2026-07-06 09:30:36.972208+07	2026-07-06 09:30:36.972208+07	\N	\N
c3a61f7f-5818-4632-b13d-8f5db38cc94b	b1aabc11-0001-4000-aa00-000000000015	has_GPS	GPS theo dõi	boolean	f	t	f	\N	\N	\N	\N	\N	2026-07-06 09:30:36.972208+07	2026-07-06 09:30:36.972208+07	\N	\N
07fccd3c-fcc4-4b6d-b849-ddfa975defbf	b1aabc11-0001-4000-aa00-000000000015	cargo_insurance	Bảo hiểm hàng hóa	boolean	f	t	f	\N	\N	\N	\N	\N	2026-07-06 09:30:36.972208+07	2026-07-06 09:30:36.972208+07	\N	\N
69824cba-a08f-4e67-a807-b7aac66e748b	b1aabc11-0001-4000-aa00-000000000016	seat_count	Số chỗ ngồi	number	t	t	f	\N	\N	\N	\N	\N	2026-07-06 09:30:36.972208+07	2026-07-06 09:30:36.972208+07	\N	\N
822eabec-cb87-400d-869d-4f519bfad0f7	b1aabc11-0001-4000-aa00-000000000016	vehicle_type	Loại xe	select	t	t	f	\N	\N	\N	["xe_4_cho", "xe_7_cho", "xe_16_cho", "xe_29_cho", "xe_45_cho"]	\N	2026-07-06 09:30:36.972208+07	2026-07-06 09:30:36.972208+07	\N	\N
f7f4dab5-a36d-485a-be98-42b30fe825f4	b1aabc11-0001-4000-aa00-000000000016	service_provinces	Tỉnh/TP phục vụ	select	t	t	f	\N	\N	\N	\N	\N	2026-07-06 09:30:36.972208+07	2026-07-06 09:30:36.972208+07	\N	\N
3b930570-d9e3-4cf3-9420-e58c61e31c94	b1aabc11-0001-4000-aa00-000000000016	has_ac	Có điều hòa	boolean	f	t	f	\N	\N	\N	\N	\N	2026-07-06 09:30:36.972208+07	2026-07-06 09:30:36.972208+07	\N	\N
93f995a9-4dd8-4732-950d-69543b804219	b1aabc11-0001-4000-aa00-000000000017	vehicle_type	Loại phương tiện	select	t	t	f	\N	\N	\N	["xe_may", "xe_so", "xe_dien"]	\N	2026-07-06 09:30:36.972208+07	2026-07-06 09:30:36.972208+07	\N	\N
b0d27d79-06d9-42cd-b5ce-8581d18d2795	b1aabc11-0001-4000-aa00-000000000017	service_provinces	Tỉnh/TP hoạt động	select	t	t	f	\N	\N	\N	\N	\N	2026-07-06 09:30:36.972208+07	2026-07-06 09:30:36.972208+07	\N	\N
97b32dcc-d7c8-4c6b-8fe5-f884e141d3ca	b1aabc11-0001-4000-aa00-000000000017	max_delivery_radius_km	Bán kính giao hàng (km)	number	f	t	f	\N	\N	\N	\N	\N	2026-07-06 09:30:36.972208+07	2026-07-06 09:30:36.972208+07	\N	\N
ce7907a5-6be0-4a93-a550-5e0b1fad7442	b1aabc11-0001-4000-aa00-000000000017	has_thermal_bag	Túi giữ nhiệt	boolean	f	t	f	\N	\N	\N	\N	\N	2026-07-06 09:30:36.972208+07	2026-07-06 09:30:36.972208+07	\N	\N
b0a73f56-972a-4528-8ca7-5ab6c6336cf6	48d2e027-ecea-48af-ad6a-baa8f9e38d27	service_provinces	Khu vực hoạt động	select	t	t	f	\N	\N	\N	\N	\N	2026-07-06 09:30:36.972208+07	2026-07-06 09:30:36.972208+07	\N	\N
16db0d58-adc7-4c1a-ac92-62e70a5112cd	48d2e027-ecea-48af-ad6a-baa8f9e38d27	night_service	Phục vụ ban đêm	boolean	f	t	f	\N	\N	\N	\N	\N	2026-07-06 09:30:36.972208+07	2026-07-06 09:30:36.972208+07	\N	\N
014aaebb-7fbc-4810-af97-8786d1904adc	f6b71f51-3105-4b3d-80ae-362a0417d719	service_types	Loại sửa chữa	multiselect	t	t	f	\N	\N	\N	["va_lop", "thay_boi", "sac_binh", "sua_dien", "thay_lop"]	\N	2026-07-06 09:30:36.972208+07	2026-07-06 09:30:36.972208+07	\N	\N
4ec7d94c-2ea8-4494-bd7a-c76d7885a919	f6b71f51-3105-4b3d-80ae-362a0417d719	vehicle_types_supported	Loại xe hỗ trợ	multiselect	t	t	f	\N	\N	\N	["o_to_con", "xe_ban_tai", "xe_tai_nhe"]	\N	2026-07-06 09:30:36.972208+07	2026-07-06 09:30:36.972208+07	\N	\N
f30b3b7a-f0fa-4bee-8b38-db6f4e94c0a3	f6b71f51-3105-4b3d-80ae-362a0417d719	service_provinces	Khu vực hoạt động	select	t	t	f	\N	\N	\N	\N	\N	2026-07-06 09:30:36.972208+07	2026-07-06 09:30:36.972208+07	\N	\N
e5f5538f-a92c-442d-bbd4-316f56ff650d	f6b71f51-3105-4b3d-80ae-362a0417d719	available_24h	Phục vụ 24/7	boolean	f	t	f	\N	\N	\N	\N	\N	2026-07-06 09:30:36.972208+07	2026-07-06 09:30:36.972208+07	\N	\N
c72c84ca-c804-4be5-8852-6d4803715a41	b1aabc11-0001-4000-aa00-000000000020	departure_station	Ga đi	select	t	t	f	\N	\N	\N	\N	\N	2026-07-06 09:30:36.972208+07	2026-07-06 09:30:36.972208+07	\N	\N
ceef26d2-1676-4a84-bd2e-608e6e7c5c5a	b1aabc11-0001-4000-aa00-000000000020	arrival_station	Ga đến	select	t	t	f	\N	\N	\N	\N	\N	2026-07-06 09:30:36.972208+07	2026-07-06 09:30:36.972208+07	\N	\N
fef69c7c-269a-44eb-8bbe-736ffcb19377	b1aabc11-0001-4000-aa00-000000000020	trip_type	Loại chuyến	select	t	t	f	\N	\N	\N	["mot_chieu", "khu_hoi"]	\N	2026-07-06 09:30:36.972208+07	2026-07-06 09:30:36.972208+07	\N	\N
b53c0101-a6c1-4629-9ff6-52624b8f04f5	b1aabc11-0001-4000-aa00-000000000020	seat_type	Loại ghế	select	t	t	f	\N	\N	\N	["ngoi_cung", "ngoi_mem", "ghe_nam"]	\N	2026-07-06 09:30:36.972208+07	2026-07-06 09:30:36.972208+07	\N	\N
3c1e465c-b640-48e8-b0a3-166c95060525	d1aabc11-0001-4000-cc00-000000000001	network	Nhà mạng	select	t	t	f	\N	\N	\N	["viettel", "mobifone", "vinaphone", "vietnamobile"]	\N	2026-07-06 09:30:36.972208+07	2026-07-06 09:30:36.972208+07	\N	\N
767b8421-2390-42d2-b447-2ca8bb1f1d96	d1aabc11-0001-4000-cc00-000000000002	service_type	Loại dịch vụ	select	t	t	f	\N	\N	\N	["du_lich", "cho_hang"]	\N	2026-07-06 09:30:36.972208+07	2026-07-06 09:30:36.972208+07	\N	\N
70a77cbb-8ee1-4aa9-8b0d-0b3297be5d81	d1aabc11-0001-4000-cc00-000000000002	service_provinces	Khu vực hoạt động	select	t	t	f	\N	\N	\N	\N	\N	2026-07-06 09:30:36.972208+07	2026-07-06 09:30:36.972208+07	\N	\N
194d6d94-963c-4caf-b1a8-c3d9250ad10c	d1aabc11-0001-4000-cc00-000000000003	seat_count	Số chỗ ngồi	number	t	t	f	\N	\N	\N	\N	\N	2026-07-06 09:30:36.972208+07	2026-07-06 09:30:36.972208+07	\N	\N
8ca7392c-a510-4540-b758-78a38bf223fe	d1aabc11-0001-4000-cc00-000000000003	location_name	Khu du lịch	text	t	t	f	\N	\N	\N	\N	\N	2026-07-06 09:30:36.972208+07	2026-07-06 09:30:36.972208+07	\N	\N
ed069b5d-60c2-4c36-81aa-4daf3a0cec2d	d1aabc11-0001-4000-cc00-000000000003	pricing_model	Mô hình giá	select	t	f	f	\N	\N	\N	["theo_luot", "theo_gio", "theo_ngay"]	\N	2026-07-06 09:30:36.972208+07	2026-07-06 09:30:36.972208+07	\N	\N
b5b34e6a-6d7f-4ca1-b083-e933aee92dc9	c1aabc11-0001-4000-bb00-000000000003	language	Ngôn ngữ giảng dạy	multiselect	t	t	f	\N	\N	\N	["tieng_anh", "tieng_trung", "tieng_nhat", "tieng_han", "tieng_phap"]	\N	2026-07-06 09:30:36.972208+07	2026-07-06 09:30:36.972208+07	\N	\N
57c459ff-27e6-456d-8f2a-d5bb4d6e286b	c1aabc11-0001-4000-bb00-000000000003	level	Cấp độ	select	t	t	f	\N	\N	\N	["co_ban", "trung_cap", "nang_cao", "luyen_thi"]	\N	2026-07-06 09:30:36.972208+07	2026-07-06 09:30:36.972208+07	\N	\N
b1e90314-97bc-4f0a-a38c-b4d676c52a0e	c1aabc11-0001-4000-bb00-000000000003	teaching_mode	Hình thức	select	t	t	f	\N	\N	\N	["tai_trung_tam", "online", "tai_nha"]	\N	2026-07-06 09:30:36.972208+07	2026-07-06 09:30:36.972208+07	\N	\N
\.


--
-- TOC entry 7555 (class 0 OID 27055)
-- Dependencies: 242
-- Data for Name: service_category_requirements; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.service_category_requirements (id, service_category_id, requirement_type, requirement_code, requirement_name, description, is_required, applies_to_provider_type, is_active, created_at, updated_at, created_by, updated_by) FROM stdin;
99346358-9307-49d2-8ff3-85b8556dd883	b1aabc11-0001-4000-aa00-000000000001	license	gplx_b1_plus	GPLX từ hạng B1 trở lên	\N	t	all	t	2026-07-06 09:30:11.825457+07	2026-07-06 09:30:11.825457+07	\N	\N
becedd0f-c681-4554-8552-e2769cd50356	b1aabc11-0001-4000-aa00-000000000001	document	dang_ky_xe	Đăng ký xe	\N	t	all	t	2026-07-06 09:30:11.825457+07	2026-07-06 09:30:11.825457+07	\N	\N
e4a8b210-8332-4d41-904f-a7cc6b46c9f8	b1aabc11-0001-4000-aa00-000000000001	document	dang_kiem_xe	Đăng kiểm xe còn hạn	\N	t	all	t	2026-07-06 09:30:11.825457+07	2026-07-06 09:30:11.825457+07	\N	\N
be87b1b7-8c1d-437d-8ce5-370c0e3cac63	b1aabc11-0001-4000-aa00-000000000001	document	bao_hiem_tnds	Bảo hiểm TNDS bắt buộc còn hạn	\N	t	all	t	2026-07-06 09:30:11.825457+07	2026-07-06 09:30:11.825457+07	\N	\N
45da3e0d-3a65-4f07-8af7-e1f0563ca8a8	b1aabc11-0001-4000-aa00-000000000001	certificate	ly_lich_tu_phap	Lý lịch tư pháp sạch	\N	t	all	t	2026-07-06 09:30:11.825457+07	2026-07-06 09:30:11.825457+07	\N	\N
ec32dcf3-5cab-4367-a95e-a5c9dc8f3fe1	b1aabc11-0001-4000-aa00-000000000002	license	gplx_a1_plus	GPLX từ hạng A1 trở lên	\N	t	all	t	2026-07-06 09:30:11.825457+07	2026-07-06 09:30:11.825457+07	\N	\N
59b0610d-f16a-49aa-b4b9-05358a3a6aaf	b1aabc11-0001-4000-aa00-000000000002	document	dang_ky_xe	Đăng ký xe	\N	t	all	t	2026-07-06 09:30:11.825457+07	2026-07-06 09:30:11.825457+07	\N	\N
372bd1f4-be19-4867-a4a0-0324b14ef349	b1aabc11-0001-4000-aa00-000000000002	document	bao_hiem_tnds	Bảo hiểm TNDS bắt buộc còn hạn	\N	t	all	t	2026-07-06 09:30:11.825457+07	2026-07-06 09:30:11.825457+07	\N	\N
e241df36-9c7b-490f-aeb2-90843cffee67	b1aabc11-0001-4000-aa00-000000000002	certificate	ly_lich_tu_phap	Lý lịch tư pháp sạch	\N	t	all	t	2026-07-06 09:30:11.825457+07	2026-07-06 09:30:11.825457+07	\N	\N
58ddb897-5126-4949-850c-85a06c843875	b1aabc11-0001-4000-aa00-000000000003	license	gplx_d_plus	GPLX hạng D trở lên	\N	t	all	t	2026-07-06 09:30:11.825457+07	2026-07-06 09:30:11.825457+07	\N	\N
d16e9321-4e46-4758-8215-e4ab3ee1e6e7	b1aabc11-0001-4000-aa00-000000000003	certificate	chung_chi_lai_xe_cn	Chứng chỉ lái xe chuyên nghiệp	\N	t	all	t	2026-07-06 09:30:11.825457+07	2026-07-06 09:30:11.825457+07	\N	\N
e2033088-c2d6-43e7-8dbf-fa73c35b960b	b1aabc11-0001-4000-aa00-000000000003	document	phep_tuyen	Giấy phép kinh doanh vận tải tuyến cố định	\N	t	business	t	2026-07-06 09:30:11.825457+07	2026-07-06 09:30:11.825457+07	\N	\N
fde4fb09-e654-4c53-8b93-1f9e5b9aaab5	b1aabc11-0001-4000-aa00-000000000003	document	dang_ky_xe	Đăng ký xe	\N	t	all	t	2026-07-06 09:30:11.825457+07	2026-07-06 09:30:11.825457+07	\N	\N
8a057f84-6851-4c9c-b64a-d5ed8cf00d8a	b1aabc11-0001-4000-aa00-000000000003	document	dang_kiem_xe	Đăng kiểm xe còn hạn	\N	t	all	t	2026-07-06 09:30:11.825457+07	2026-07-06 09:30:11.825457+07	\N	\N
3783f018-5601-4649-bf45-19ac8c4eed29	b1aabc11-0001-4000-aa00-000000000003	document	bao_hiem_tnds	Bảo hiểm TNDS bắt buộc còn hạn	\N	t	all	t	2026-07-06 09:30:11.825457+07	2026-07-06 09:30:11.825457+07	\N	\N
b467ce4a-3e8b-4a44-8442-ac65b1a9250b	b1aabc11-0001-4000-aa00-000000000004	license	gplx_b2_plus	GPLX hạng B2 trở lên	\N	t	all	t	2026-07-06 09:30:11.825457+07	2026-07-06 09:30:11.825457+07	\N	\N
69abf930-c142-4322-8154-3e4a9161f69c	b1aabc11-0001-4000-aa00-000000000004	document	dang_ky_xe	Đăng ký xe	\N	t	all	t	2026-07-06 09:30:11.825457+07	2026-07-06 09:30:11.825457+07	\N	\N
854d3b51-6dd7-44e0-b919-0a2bd69acd82	b1aabc11-0001-4000-aa00-000000000004	document	bao_hiem_tnds	Bảo hiểm TNDS bắt buộc còn hạn	\N	t	all	t	2026-07-06 09:30:11.825457+07	2026-07-06 09:30:11.825457+07	\N	\N
dfd7af12-1403-4bc3-af8c-291b45f8570b	b1aabc11-0001-4000-aa00-000000000005	license	gplx_d_plus	GPLX hạng D trở lên	\N	t	all	t	2026-07-06 09:30:11.825457+07	2026-07-06 09:30:11.825457+07	\N	\N
71c07bfe-f7cb-4868-9f46-5007cd1c979e	b1aabc11-0001-4000-aa00-000000000005	document	dang_ky_xe	Đăng ký xe	\N	t	all	t	2026-07-06 09:30:11.825457+07	2026-07-06 09:30:11.825457+07	\N	\N
03a67e4b-de15-4a96-9537-6bfba7c21962	b1aabc11-0001-4000-aa00-000000000005	document	dang_kiem_xe	Đăng kiểm xe còn hạn	\N	t	all	t	2026-07-06 09:30:11.825457+07	2026-07-06 09:30:11.825457+07	\N	\N
0cc87b12-2070-47b4-a10d-6ca9d5f15fc9	b1aabc11-0001-4000-aa00-000000000005	document	bao_hiem_tnds	Bảo hiểm TNDS bắt buộc còn hạn	\N	t	all	t	2026-07-06 09:30:11.825457+07	2026-07-06 09:30:11.825457+07	\N	\N
eeb79115-a352-4ea8-b14c-27f525859aa0	b1aabc11-0001-4000-aa00-000000000005	certificate	ly_lich_tu_phap	Lý lịch tư pháp sạch	\N	t	all	t	2026-07-06 09:30:11.825457+07	2026-07-06 09:30:11.825457+07	\N	\N
a4663c4b-3067-44bc-a45b-3d16eb65ca68	b1aabc11-0001-4000-aa00-000000000006	license	gplx_b2_plus	GPLX hạng B2 trở lên	\N	t	all	t	2026-07-06 09:30:11.825457+07	2026-07-06 09:30:11.825457+07	\N	\N
7045c6ba-e56f-4bf7-aa13-7c245d0407f8	b1aabc11-0001-4000-aa00-000000000006	certificate	ly_lich_tu_phap	Lý lịch tư pháp sạch	\N	t	all	t	2026-07-06 09:30:11.825457+07	2026-07-06 09:30:11.825457+07	\N	\N
025a1d50-72b0-4c91-8a8a-0dbd173d7ab6	b1aabc11-0001-4000-aa00-000000000006	certificate	chung_chi_ban_thi_bai	Chứng chỉ thi bằng chuyên nghiệp	\N	f	all	t	2026-07-06 09:30:11.825457+07	2026-07-06 09:30:11.825457+07	\N	\N
46cfd314-347c-4963-835e-5a2999a92984	b1aabc11-0001-4000-aa00-000000000007	license	gplx_b2_plus	GPLX hạng B2 trở lên	\N	t	all	t	2026-07-06 09:30:11.825457+07	2026-07-06 09:30:11.825457+07	\N	\N
55c2061a-b43a-421d-a9d6-0a197f4391bf	b1aabc11-0001-4000-aa00-000000000007	certificate	ly_lich_tu_phap	Lý lịch tư pháp sạch	\N	t	all	t	2026-07-06 09:30:11.825457+07	2026-07-06 09:30:11.825457+07	\N	\N
fbbb45bd-3401-4961-ba43-b415334aeb0d	b1aabc11-0001-4000-aa00-000000000008	license	gplx_phu_hop	GPLX phù hợp với loại phương tiện	\N	t	all	t	2026-07-06 09:30:11.825457+07	2026-07-06 09:30:11.825457+07	\N	\N
6bfb0944-8c71-45b8-8b8e-b389acc0e54c	b1aabc11-0001-4000-aa00-000000000008	document	dang_ky_xe	Đăng ký xe	\N	t	all	t	2026-07-06 09:30:11.825457+07	2026-07-06 09:30:11.825457+07	\N	\N
2fc7240b-50cd-4930-894b-9508f1a214f8	b1aabc11-0001-4000-aa00-000000000008	document	bao_hiem_tnds	Bảo hiểm TNDS bắt buộc còn hạn	\N	t	all	t	2026-07-06 09:30:11.825457+07	2026-07-06 09:30:11.825457+07	\N	\N
23acb25c-b0ea-43d2-8fe5-13ac5d6d509c	b1aabc11-0001-4000-aa00-000000000009	license	gplx_c_plus	GPLX hạng C trở lên	\N	t	all	t	2026-07-06 09:30:11.825457+07	2026-07-06 09:30:11.825457+07	\N	\N
9ef27a62-5dfd-471a-a77c-41aedb02594d	b1aabc11-0001-4000-aa00-000000000009	document	dang_ky_xe	Đăng ký xe	\N	t	all	t	2026-07-06 09:30:11.825457+07	2026-07-06 09:30:11.825457+07	\N	\N
4fac39a6-34fc-4ed5-b556-c2fd25bd0b07	b1aabc11-0001-4000-aa00-000000000009	document	dang_kiem_xe	Đăng kiểm xe còn hạn	\N	t	all	t	2026-07-06 09:30:11.825457+07	2026-07-06 09:30:11.825457+07	\N	\N
81b622e8-969c-4f77-9ef0-b977085ee06f	b1aabc11-0001-4000-aa00-000000000009	document	bao_hiem_tnds	Bảo hiểm TNDS bắt buộc còn hạn	\N	t	all	t	2026-07-06 09:30:11.825457+07	2026-07-06 09:30:11.825457+07	\N	\N
1fadc881-bc5e-4cfc-8f35-d30ca3cbba97	b1aabc11-0001-4000-aa00-000000000009	document	gp_kd_van_tai	Giấy phép kinh doanh vận tải	\N	t	business	t	2026-07-06 09:30:11.825457+07	2026-07-06 09:30:11.825457+07	\N	\N
4bfa6d0a-b198-4985-8e0c-9bcdb1812682	b1aabc11-0001-4000-aa00-000000000010	license	gplx_c_plus	GPLX hạng C trở lên	\N	t	all	t	2026-07-06 09:30:11.825457+07	2026-07-06 09:30:11.825457+07	\N	\N
efc10a89-b0c0-4e11-915b-d22414b608b2	b1aabc11-0001-4000-aa00-000000000010	document	gp_kd_van_tai	Giấy phép kinh doanh vận tải	\N	t	business	t	2026-07-06 09:30:11.825457+07	2026-07-06 09:30:11.825457+07	\N	\N
73920a7b-66ec-420f-84d9-3de30206cdaf	b1aabc11-0001-4000-aa00-000000000010	document	dang_ky_xe	Đăng ký xe	\N	t	all	t	2026-07-06 09:30:11.825457+07	2026-07-06 09:30:11.825457+07	\N	\N
44a7ffeb-5002-4e3b-90f6-dbc6326517a2	b1aabc11-0001-4000-aa00-000000000010	document	dang_kiem_xe	Đăng kiểm xe còn hạn	\N	t	all	t	2026-07-06 09:30:11.825457+07	2026-07-06 09:30:11.825457+07	\N	\N
44347d08-7688-4156-b510-2fd57da55817	b1aabc11-0001-4000-aa00-000000000011	certificate	chung_chi_ky_thuat_oto	Chứng chỉ kỹ thuật ô tô	\N	t	all	t	2026-07-06 09:30:11.825457+07	2026-07-06 09:30:11.825457+07	\N	\N
3134fdfa-04eb-420b-b5c6-e446cf6fb4bd	b1aabc11-0001-4000-aa00-000000000011	document	gp_kinh_doanh	Giấy phép kinh doanh	\N	t	business	t	2026-07-06 09:30:11.825457+07	2026-07-06 09:30:11.825457+07	\N	\N
5e5f0997-a19f-4403-85d2-9c3c22746cbe	b1aabc11-0001-4000-aa00-000000000012	document	dang_ky_xe	Đăng ký xe	\N	t	all	t	2026-07-06 09:30:11.825457+07	2026-07-06 09:30:11.825457+07	\N	\N
fb6cd829-abaa-4875-b35d-58232e3d8703	b1aabc11-0001-4000-aa00-000000000012	document	dang_kiem_xe	Đăng kiểm xe còn hạn	\N	t	all	t	2026-07-06 09:30:11.825457+07	2026-07-06 09:30:11.825457+07	\N	\N
15ff5b7f-1099-4812-800f-ab28fca891b9	b1aabc11-0001-4000-aa00-000000000012	document	bao_hiem_tnds_mo_rong	Bảo hiểm TNDS mở rộng	\N	t	all	t	2026-07-06 09:30:11.825457+07	2026-07-06 09:30:11.825457+07	\N	\N
70ced2b8-1026-4557-9bd0-6d64feac012c	b1aabc11-0001-4000-aa00-000000000012	document	bao_hiem_vat_chat	Bảo hiểm thiệt hại vật chất xe	\N	t	all	t	2026-07-06 09:30:11.825457+07	2026-07-06 09:30:11.825457+07	\N	\N
31cb7741-511e-4886-94fb-cba5df5a4ab9	b1aabc11-0001-4000-aa00-000000000013	document	dang_ky_xe	Đăng ký xe	\N	t	all	t	2026-07-06 09:30:11.825457+07	2026-07-06 09:30:11.825457+07	\N	\N
722af9c4-b2ab-43c8-b1c6-612b31596a0c	b1aabc11-0001-4000-aa00-000000000013	document	bao_hiem_tnds	Bảo hiểm TNDS bắt buộc còn hạn	\N	t	all	t	2026-07-06 09:30:11.825457+07	2026-07-06 09:30:11.825457+07	\N	\N
28c23b0b-d8ac-4cbe-9684-9282bec6167f	b1aabc11-0001-4000-aa00-000000000014	driving_license	gplx_c_plus	GPLX hạng C trở lên	\N	t	all	t	2026-07-06 09:30:36.972208+07	2026-07-06 09:30:36.972208+07	\N	\N
694b98dd-af53-4b73-9310-eaa52efc32d7	b1aabc11-0001-4000-aa00-000000000014	document	dang_ky_xe	Đăng ký xe	\N	t	all	t	2026-07-06 09:30:36.972208+07	2026-07-06 09:30:36.972208+07	\N	\N
1ab3ace6-e887-4f8d-85b9-ce85a4809fb6	b1aabc11-0001-4000-aa00-000000000014	document	bao_hiem_tnds	Bảo hiểm TNDS bắt buộc	\N	t	all	t	2026-07-06 09:30:36.972208+07	2026-07-06 09:30:36.972208+07	\N	\N
e3d04ad4-7ee8-4c8f-8cb9-d0e14cc7bbd1	b1aabc11-0001-4000-aa00-000000000015	driving_license	gplx_c_plus	GPLX hạng C trở lên	\N	t	all	t	2026-07-06 09:30:36.972208+07	2026-07-06 09:30:36.972208+07	\N	\N
9026ef22-4ef9-4f51-94b4-c9f0c2bc3d8a	b1aabc11-0001-4000-aa00-000000000015	document	gp_kd_van_tai	Giấy phép kinh doanh vận tải	\N	t	business	t	2026-07-06 09:30:36.972208+07	2026-07-06 09:30:36.972208+07	\N	\N
947a796f-cde4-41b1-b3d9-5733219b7c4e	b1aabc11-0001-4000-aa00-000000000015	document	dang_ky_xe	Đăng ký xe	\N	t	all	t	2026-07-06 09:30:36.972208+07	2026-07-06 09:30:36.972208+07	\N	\N
ca2d6103-90e4-4f1f-8e9e-fae2e4b1e32f	b1aabc11-0001-4000-aa00-000000000016	driving_license	gplx_b2_plus	GPLX hạng B2 trở lên	\N	t	all	t	2026-07-06 09:30:36.972208+07	2026-07-06 09:30:36.972208+07	\N	\N
8ef40cbc-994d-4c64-8abd-0f9ca0058578	b1aabc11-0001-4000-aa00-000000000016	document	dang_ky_xe	Đăng ký xe	\N	t	all	t	2026-07-06 09:30:36.972208+07	2026-07-06 09:30:36.972208+07	\N	\N
a3399f48-f239-444d-aaaa-f5f8f4aa7670	b1aabc11-0001-4000-aa00-000000000016	document	dang_kiem_xe	Đăng kiểm xe còn hạn	\N	t	all	t	2026-07-06 09:30:36.972208+07	2026-07-06 09:30:36.972208+07	\N	\N
797dca32-7728-4b05-b4cf-4bb77da1dadf	b1aabc11-0001-4000-aa00-000000000016	document	bao_hiem_tnds	Bảo hiểm TNDS bắt buộc	\N	t	all	t	2026-07-06 09:30:36.972208+07	2026-07-06 09:30:36.972208+07	\N	\N
c3eb70d3-0b63-4068-862c-b2049a57ad3b	b1aabc11-0001-4000-aa00-000000000017	driving_license	gplx_a1_plus	GPLX hạng A1 trở lên	\N	t	all	t	2026-07-06 09:30:36.972208+07	2026-07-06 09:30:36.972208+07	\N	\N
0d566f5b-5601-4253-9f56-99e68e0d7d62	b1aabc11-0001-4000-aa00-000000000017	document	dang_ky_xe	Đăng ký xe	\N	t	all	t	2026-07-06 09:30:36.972208+07	2026-07-06 09:30:36.972208+07	\N	\N
bcad0387-447d-4bcc-b1b9-d1305e458f8d	48d2e027-ecea-48af-ad6a-baa8f9e38d27	driving_license	gplx_a1_plus	GPLX hạng A1 trở lên	\N	t	all	t	2026-07-06 09:30:36.972208+07	2026-07-06 09:30:36.972208+07	\N	\N
28cdbfed-795d-47cb-9c5f-c14f80e39e6a	48d2e027-ecea-48af-ad6a-baa8f9e38d27	certificate	ly_lich_tu_phap	Lý lịch tư pháp sạch	\N	t	all	t	2026-07-06 09:30:36.972208+07	2026-07-06 09:30:36.972208+07	\N	\N
466f51d0-e8ca-4dec-bc85-095a770f5927	f6b71f51-3105-4b3d-80ae-362a0417d719	certificate	chung_chi_ky_thuat_oto	Chứng chỉ kỹ thuật ô tô	\N	t	all	t	2026-07-06 09:30:36.972208+07	2026-07-06 09:30:36.972208+07	\N	\N
115fe13c-9922-49dc-9b9d-7ea702d9d3e2	f6b71f51-3105-4b3d-80ae-362a0417d719	document	gp_kinh_doanh	Giấy phép kinh doanh	\N	f	business	t	2026-07-06 09:30:36.972208+07	2026-07-06 09:30:36.972208+07	\N	\N
45020c82-d95c-486b-bc8f-5400167fc5dc	b1aabc11-0001-4000-aa00-000000000020	document	gp_dai_ly_ban_ve	Giấy phép đại lý bán vé	\N	t	business	t	2026-07-06 09:30:36.972208+07	2026-07-06 09:30:36.972208+07	\N	\N
1e14840a-f181-4c6c-94ce-541aaa96b863	c1aabc11-0001-4000-bb00-000000000003	certificate	gp_dao_tao	Giấy phép hoạt động đào tạo/giáo dục	\N	t	business	t	2026-07-06 09:30:36.972208+07	2026-07-06 09:30:36.972208+07	\N	\N
085296bb-1911-4c91-9b61-6fd2a363694c	c1aabc11-0001-4000-bb00-000000000003	certificate	chung_chi_giang_vien	Chứng chỉ giảng viên (TESOL/IELTS/HSK...)	\N	t	all	t	2026-07-06 09:30:36.972208+07	2026-07-06 09:30:36.972208+07	\N	\N
\.


--
-- TOC entry 7570 (class 0 OID 27557)
-- Dependencies: 257
-- Data for Name: service_route_schedules; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.service_route_schedules (id, route_id, departure_time, seat_count, is_active, notes, created_at, updated_at) FROM stdin;
\.


--
-- TOC entry 7569 (class 0 OID 27531)
-- Dependencies: 256
-- Data for Name: service_routes; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.service_routes (id, provider_service_id, from_province, to_province, distance_km, duration_min, price, is_active, notes, created_at, updated_at) FROM stdin;
\.


--
-- TOC entry 7553 (class 0 OID 26979)
-- Dependencies: 240
-- Data for Name: service_skills; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.service_skills (id, service_category_id, code, name, description, is_active, created_at, updated_at, created_by, updated_by) FROM stdin;
\.


--
-- TOC entry 7613 (class 0 OID 28830)
-- Dependencies: 300
-- Data for Name: setting_audit_logs; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.setting_audit_logs (id, setting_id, old_value, new_value, changed_by, changed_at, ip_address, reason) FROM stdin;
\.


--
-- TOC entry 7606 (class 0 OID 28715)
-- Dependencies: 293
-- Data for Name: site_settings; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.site_settings (id, setting_key, setting_value_text, setting_value_json, description, is_active, created_at, updated_at) FROM stdin;
448fd67a-b76a-4aca-b15f-a6ba27650a0c	site_name	Sàn Dịch Vụ	\N	Tên hiển thị trên toàn site	t	2026-07-06 09:18:26.320833+07	2026-07-06 09:18:26.320833+07
d5b3ff75-78ac-4503-8c73-a52952d5abcf	site_tagline	Kết Nối Dịch Vụ - Vươn Tầm Việt Nam	\N	Slogan hiển thị ở Hero section	t	2026-07-06 09:18:26.320833+07	2026-07-06 09:18:26.320833+07
59378146-fb78-4fbc-be82-89c5aa27109b	site_email	contact@sandichvu.com	\N	Email liên hệ hiển thị ở footer	t	2026-07-06 09:18:26.320833+07	2026-07-06 09:18:26.320833+07
78eb2e4c-45aa-43cf-a353-5879d3fc79a9	site_hotline	1900 xxxx	\N	Số điện thoại hotline hiển thị ở footer	t	2026-07-06 09:18:26.320833+07	2026-07-06 09:18:26.320833+07
c19dd560-d38a-4ece-b712-02ff8e2b4de2	facebook_url	https://facebook.com/sandichvu	\N	URL fanpage Facebook	t	2026-07-06 09:18:26.320833+07	2026-07-06 09:18:26.320833+07
9201fc14-7a55-4623-bc85-ca00e76031c7	instagram_url	https://instagram.com/sandichvu	\N	URL Instagram	t	2026-07-06 09:18:26.320833+07	2026-07-06 09:18:26.320833+07
91c6dba7-c698-46e2-993b-ba35062ec5b1	youtube_url	https://youtube.com/@sandichvu	\N	URL YouTube channel	t	2026-07-06 09:18:26.320833+07	2026-07-06 09:18:26.320833+07
21798b36-aae5-41f7-8945-a00a257a5c35	site_logo_url	/logo.png	\N	Đường dẫn logo chính (dùng cho Header/Footer)	t	2026-07-06 09:18:26.320833+07	2026-07-06 09:18:26.320833+07
c70b14db-10b9-49da-9846-2a0903808187	site_favicon_url	/favicon.ico	\N	Đường dẫn favicon	t	2026-07-06 09:18:26.320833+07	2026-07-06 09:18:26.320833+07
37249fcf-1f95-4a02-a962-fffa024df5a4	site_description	Hệ sinh thái kết nối chuyên gia hàng đầu, đồng hành cùng bạn giải quyết mọi nhu cầu cuộc sống.	\N	Meta description cho trang chủ	t	2026-07-06 09:18:26.320833+07	2026-07-06 09:18:26.320833+07
\.


--
-- TOC entry 6231 (class 0 OID 25842)
-- Dependencies: 223
-- Data for Name: spatial_ref_sys; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.spatial_ref_sys (srid, auth_name, auth_srid, srtext, proj4text) FROM stdin;
\.


--
-- TOC entry 7594 (class 0 OID 28328)
-- Dependencies: 281
-- Data for Name: support_ticket_messages; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.support_ticket_messages (id, ticket_id, sender_id, message, attachments, is_internal, created_at) FROM stdin;
\.


--
-- TOC entry 7593 (class 0 OID 28279)
-- Dependencies: 280
-- Data for Name: support_tickets; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.support_tickets (id, user_id, booking_id, subject, category, status, priority, assigned_to, first_response_at, resolved_at, created_at, updated_at, against_id, dispute_type, resolution, fare_adjustment, resolved_by) FROM stdin;
\.


--
-- TOC entry 7627 (class 0 OID 29308)
-- Dependencies: 314
-- Data for Name: tutor_request_applications; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.tutor_request_applications (id, tutor_request_id, provider_id, provider_user_id, status, message, proposed_schedule, created_at, updated_at) FROM stdin;
\.


--
-- TOC entry 7619 (class 0 OID 29028)
-- Dependencies: 306
-- Data for Name: tutor_request_status_logs; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.tutor_request_status_logs (id, tutor_request_id, from_status, to_status, changed_by, changed_role, reason, created_at) FROM stdin;
\.


--
-- TOC entry 7617 (class 0 OID 28949)
-- Dependencies: 304
-- Data for Name: tutor_requests; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.tutor_requests (id, customer_user_id, provider_id, subject, grade_level, teaching_mode, address_text, latitude, longitude, schedule_preference, note, status, created_at, updated_at, service_category_id) FROM stdin;
\.


--
-- TOC entry 7618 (class 0 OID 28991)
-- Dependencies: 305
-- Data for Name: tutor_sessions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.tutor_sessions (id, tutor_request_id, provider_id, session_type, session_date, start_time, end_time, status, note, tutor_report, created_at, updated_at) FROM stdin;
\.


--
-- TOC entry 7564 (class 0 OID 27367)
-- Dependencies: 251
-- Data for Name: user_identity_files; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.user_identity_files (id, verification_id, file_type, file_url, storage_provider, mime_type, file_size, checksum, uploaded_by_user_id, uploaded_at, is_active) FROM stdin;
\.


--
-- TOC entry 7566 (class 0 OID 27414)
-- Dependencies: 253
-- Data for Name: user_identity_review_decisions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.user_identity_review_decisions (id, verification_id, reviewer_user_id, decision, reason, metadata_json, created_at) FROM stdin;
\.


--
-- TOC entry 7565 (class 0 OID 27394)
-- Dependencies: 252
-- Data for Name: user_identity_verification_logs; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.user_identity_verification_logs (id, verification_id, step_name, provider_name, request_payload_json, response_payload_json, status, score, error_code, error_message, created_at) FROM stdin;
\.


--
-- TOC entry 7563 (class 0 OID 27330)
-- Dependencies: 250
-- Data for Name: user_identity_verifications; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.user_identity_verifications (id, user_id, verification_type, status, review_mode, full_name_on_id, date_of_birth_on_id, gender_on_id, id_number, nationality, place_of_origin, place_of_residence, issue_date, expiry_date, issuing_authority, extracted_address, ocr_confidence, face_match_score, liveness_score, submitted_at, processed_at, reviewed_at, reviewed_by, rejection_reason, note, is_latest, created_at, updated_at) FROM stdin;
\.


--
-- TOC entry 7592 (class 0 OID 28249)
-- Dependencies: 279
-- Data for Name: user_notes; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.user_notes (id, user_id, note, is_pinned, created_by, created_at, updated_at) FROM stdin;
\.


--
-- TOC entry 7603 (class 0 OID 28628)
-- Dependencies: 290
-- Data for Name: user_presence; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.user_presence (user_id, is_online, last_seen_at, connected_device, ws_instance_id, updated_at) FROM stdin;
\.


--
-- TOC entry 7542 (class 0 OID 26653)
-- Dependencies: 229
-- Data for Name: user_profiles; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.user_profiles (user_id, bio, preferred_language, timezone, is_deleted, deleted_at, created_at, updated_at) FROM stdin;
6211e96f-f3f0-439e-87b0-e1b487286ee7	\N	vi	Asia/Ho_Chi_Minh	f	\N	2026-07-06 09:32:49.316496+07	2026-07-06 09:32:49.316496+07
9a970c74-7734-41e3-a67b-ff587ab0cf48	\N	vi	Asia/Ho_Chi_Minh	f	\N	2026-07-06 09:34:08.925222+07	2026-07-06 09:34:08.925222+07
30065812-3a88-4fa6-9627-90a6652d75a8	\N	vi	Asia/Ho_Chi_Minh	f	\N	2026-07-06 09:36:53.981202+07	2026-07-06 09:36:53.981202+07
\.


--
-- TOC entry 7541 (class 0 OID 26634)
-- Dependencies: 228
-- Data for Name: user_roles; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.user_roles (id, user_id, role_code, created_at) FROM stdin;
8c5a8764-8384-4d87-b455-42cda0f92560	6211e96f-f3f0-439e-87b0-e1b487286ee7	admin	2026-07-06 09:32:49.316496+07
89b262dc-4de7-4efb-8afa-38fb259edf19	9a970c74-7734-41e3-a67b-ff587ab0cf48	customer	2026-07-06 09:34:08.925222+07
59868493-e886-4cf1-bc99-fee11086562e	30065812-3a88-4fa6-9627-90a6652d75a8	provider_owner	2026-07-06 09:36:53.981202+07
\.


--
-- TOC entry 7543 (class 0 OID 26675)
-- Dependencies: 230
-- Data for Name: user_status_logs; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.user_status_logs (id, user_id, old_status, new_status, changed_by, reason, created_at) FROM stdin;
\.


--
-- TOC entry 7591 (class 0 OID 28224)
-- Dependencies: 278
-- Data for Name: user_tags; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.user_tags (id, user_id, tag, created_by, created_at) FROM stdin;
\.


--
-- TOC entry 7540 (class 0 OID 26605)
-- Dependencies: 227
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.users (id, phone, full_name, password_hash, gender, avatar_url, dob, address_line, status, account_source, phone_verified, claimed_at, last_login_at, created_at, updated_at, identity_verification_status, identity_verified_at, latest_identity_verification_id, apple_sub, is_deactivated, deactivated_at, google_sub) FROM stdin;
9a970c74-7734-41e3-a67b-ff587ab0cf48	0978654321	Customer SDV	$2b$12$KggqfG4urV9nHS6NtpOxrupqsJaMENAI.NiCMklUNCSXwTmvvyB16	0	\N	2001-06-10	\N	active	self_register	t	\N	\N	2026-07-06 09:34:08.925222+07	2026-07-06 09:34:08.925222+07	unverified	\N	\N	\N	f	\N	\N
6211e96f-f3f0-439e-87b0-e1b487286ee7	0987654321	Admin SDV	$2b$12$O0xPtHmc/6WiDBom.ppCw.kxyzTeDyPvZv5hoXVx9K0yAn3xHviqG	0	\N	2001-06-10	\N	active	self_register	t	\N	2026-07-06 09:36:34.174925+07	2026-07-06 09:32:49.316496+07	2026-07-06 09:32:49.316496+07	unverified	\N	\N	\N	f	\N	\N
30065812-3a88-4fa6-9627-90a6652d75a8	0897654321	Provider SDV	$2b$12$ZKeXnEKCEakUaAWJfMmq7OnLMPdtGpdp6iqoqs7BDJqsVSXO3.Uva	0	string	2002-07-06	\N	active	admin_created	f	\N	\N	2026-07-06 09:36:53.981202+07	2026-07-06 09:36:53.981202+07	unverified	\N	\N	\N	f	\N	\N
\.


--
-- TOC entry 7579 (class 0 OID 27826)
-- Dependencies: 266
-- Data for Name: wallet_transactions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.wallet_transactions (id, wallet_id, type, amount, balance_after, reference_id, reference_type, gateway_ref, description, status, created_at) FROM stdin;
\.


--
-- TOC entry 7578 (class 0 OID 27798)
-- Dependencies: 265
-- Data for Name: wallets; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.wallets (id, user_id, balance, currency, is_frozen, created_at, updated_at) FROM stdin;
\.


--
-- TOC entry 7685 (class 0 OID 0)
-- Dependencies: 297
-- Name: core_settings_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.core_settings_id_seq', 1, false);


--
-- TOC entry 7686 (class 0 OID 0)
-- Dependencies: 299
-- Name: setting_audit_logs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.setting_audit_logs_id_seq', 1, false);


--
-- TOC entry 7104 (class 2606 OID 28941)
-- Name: appointment_reschedules appointment_reschedules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointment_reschedules
    ADD CONSTRAINT appointment_reschedules_pkey PRIMARY KEY (id);


--
-- TOC entry 7100 (class 2606 OID 28906)
-- Name: appointment_status_logs appointment_status_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointment_status_logs
    ADD CONSTRAINT appointment_status_logs_pkey PRIMARY KEY (id);


--
-- TOC entry 6892 (class 2606 OID 27785)
-- Name: booking_status_logs booking_status_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_status_logs
    ADD CONSTRAINT booking_status_logs_pkey PRIMARY KEY (id);


--
-- TOC entry 6874 (class 2606 OID 27726)
-- Name: bookings bookings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_pkey PRIMARY KEY (id);


--
-- TOC entry 7045 (class 2606 OID 28581)
-- Name: chat_conversations chat_conversations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_conversations
    ADD CONSTRAINT chat_conversations_pkey PRIMARY KEY (id);


--
-- TOC entry 7049 (class 2606 OID 28616)
-- Name: chat_messages chat_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_messages
    ADD CONSTRAINT chat_messages_pkey PRIMARY KEY (id);


--
-- TOC entry 6860 (class 2606 OID 27648)
-- Name: commission_configs commission_configs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commission_configs
    ADD CONSTRAINT commission_configs_pkey PRIMARY KEY (id);


--
-- TOC entry 6979 (class 2606 OID 28189)
-- Name: consent_logs consent_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consent_logs
    ADD CONSTRAINT consent_logs_pkey PRIMARY KEY (id);


--
-- TOC entry 7084 (class 2606 OID 28825)
-- Name: core_settings core_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.core_settings
    ADD CONSTRAINT core_settings_pkey PRIMARY KEY (id);


--
-- TOC entry 7086 (class 2606 OID 28827)
-- Name: core_settings core_settings_setting_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.core_settings
    ADD CONSTRAINT core_settings_setting_key_key UNIQUE (setting_key);


--
-- TOC entry 7034 (class 2606 OID 28502)
-- Name: crm_activities crm_activities_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_activities
    ADD CONSTRAINT crm_activities_pkey PRIMARY KEY (id);


--
-- TOC entry 7009 (class 2606 OID 28373)
-- Name: crm_contacts crm_contacts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_contacts
    ADD CONSTRAINT crm_contacts_pkey PRIMARY KEY (id);


--
-- TOC entry 7020 (class 2606 OID 28429)
-- Name: crm_deals crm_deals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_deals
    ADD CONSTRAINT crm_deals_pkey PRIMARY KEY (id);


--
-- TOC entry 7015 (class 2606 OID 28399)
-- Name: crm_leads crm_leads_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_leads
    ADD CONSTRAINT crm_leads_pkey PRIMARY KEY (id);


--
-- TOC entry 7026 (class 2606 OID 28460)
-- Name: crm_tasks crm_tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_tasks
    ADD CONSTRAINT crm_tasks_pkey PRIMARY KEY (id);


--
-- TOC entry 6983 (class 2606 OID 28211)
-- Name: data_deletion_requests data_deletion_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.data_deletion_requests
    ADD CONSTRAINT data_deletion_requests_pkey PRIMARY KEY (id);


--
-- TOC entry 6868 (class 2606 OID 27682)
-- Name: driver_availability_sessions driver_availability_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.driver_availability_sessions
    ADD CONSTRAINT driver_availability_sessions_pkey PRIMARY KEY (id);


--
-- TOC entry 6865 (class 2606 OID 27663)
-- Name: driver_locations driver_locations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.driver_locations
    ADD CONSTRAINT driver_locations_pkey PRIMARY KEY (provider_id);


--
-- TOC entry 7175 (class 2606 OID 29441)
-- Name: food_menu_categories food_menu_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.food_menu_categories
    ADD CONSTRAINT food_menu_categories_pkey PRIMARY KEY (id);


--
-- TOC entry 7179 (class 2606 OID 29488)
-- Name: food_menu_item_options food_menu_item_options_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.food_menu_item_options
    ADD CONSTRAINT food_menu_item_options_pkey PRIMARY KEY (id);


--
-- TOC entry 7177 (class 2606 OID 29465)
-- Name: food_menu_items food_menu_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.food_menu_items
    ADD CONSTRAINT food_menu_items_pkey PRIMARY KEY (id);


--
-- TOC entry 7173 (class 2606 OID 29418)
-- Name: food_merchant_documents food_merchant_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.food_merchant_documents
    ADD CONSTRAINT food_merchant_documents_pkey PRIMARY KEY (id);


--
-- TOC entry 7171 (class 2606 OID 29390)
-- Name: food_merchants food_merchants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.food_merchants
    ADD CONSTRAINT food_merchants_pkey PRIMARY KEY (id);


--
-- TOC entry 7183 (class 2606 OID 29561)
-- Name: food_order_items food_order_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.food_order_items
    ADD CONSTRAINT food_order_items_pkey PRIMARY KEY (id);


--
-- TOC entry 7185 (class 2606 OID 29584)
-- Name: food_order_status_logs food_order_status_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.food_order_status_logs
    ADD CONSTRAINT food_order_status_logs_pkey PRIMARY KEY (id);


--
-- TOC entry 7181 (class 2606 OID 29519)
-- Name: food_orders food_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.food_orders
    ADD CONSTRAINT food_orders_pkey PRIMARY KEY (id);


--
-- TOC entry 7187 (class 2606 OID 29612)
-- Name: food_ratings food_ratings_order_id_customer_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.food_ratings
    ADD CONSTRAINT food_ratings_order_id_customer_user_id_key UNIQUE (order_id, customer_user_id);


--
-- TOC entry 7189 (class 2606 OID 29610)
-- Name: food_ratings food_ratings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.food_ratings
    ADD CONSTRAINT food_ratings_pkey PRIMARY KEY (id);


--
-- TOC entry 7080 (class 2606 OID 28804)
-- Name: footer_links footer_links_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.footer_links
    ADD CONSTRAINT footer_links_pkey PRIMARY KEY (id);


--
-- TOC entry 6760 (class 2606 OID 26931)
-- Name: industry_categories industry_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.industry_categories
    ADD CONSTRAINT industry_categories_pkey PRIMARY KEY (id);


--
-- TOC entry 6762 (class 2606 OID 26933)
-- Name: industry_categories industry_categories_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.industry_categories
    ADD CONSTRAINT industry_categories_slug_key UNIQUE (slug);


--
-- TOC entry 7131 (class 2606 OID 29122)
-- Name: job_request_attachments job_request_attachments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_request_attachments
    ADD CONSTRAINT job_request_attachments_pkey PRIMARY KEY (id);


--
-- TOC entry 7136 (class 2606 OID 29154)
-- Name: job_request_quotes job_request_quotes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_request_quotes
    ADD CONSTRAINT job_request_quotes_pkey PRIMARY KEY (id);


--
-- TOC entry 7140 (class 2606 OID 29180)
-- Name: job_request_status_logs job_request_status_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_request_status_logs
    ADD CONSTRAINT job_request_status_logs_pkey PRIMARY KEY (id);


--
-- TOC entry 7128 (class 2606 OID 29087)
-- Name: job_requests job_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_requests
    ADD CONSTRAINT job_requests_pkey PRIMARY KEY (id);


--
-- TOC entry 7074 (class 2606 OID 28756)
-- Name: landing_banners landing_banners_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.landing_banners
    ADD CONSTRAINT landing_banners_pkey PRIMARY KEY (id);


--
-- TOC entry 7078 (class 2606 OID 28780)
-- Name: landing_sections landing_sections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.landing_sections
    ADD CONSTRAINT landing_sections_pkey PRIMARY KEY (id);


--
-- TOC entry 7043 (class 2606 OID 28560)
-- Name: notification_campaigns notification_campaigns_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_campaigns
    ADD CONSTRAINT notification_campaigns_pkey PRIMARY KEY (id);


--
-- TOC entry 6954 (class 2606 OID 28039)
-- Name: notification_settings notification_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_settings
    ADD CONSTRAINT notification_settings_pkey PRIMARY KEY (id);


--
-- TOC entry 6951 (class 2606 OID 28018)
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- TOC entry 6737 (class 2606 OID 26720)
-- Name: otp_sessions otp_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.otp_sessions
    ADD CONSTRAINT otp_sessions_pkey PRIMARY KEY (id);


--
-- TOC entry 6918 (class 2606 OID 27878)
-- Name: payment_transactions payment_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_transactions
    ADD CONSTRAINT payment_transactions_pkey PRIMARY KEY (id);


--
-- TOC entry 6958 (class 2606 OID 28065)
-- Name: post_categories post_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.post_categories
    ADD CONSTRAINT post_categories_pkey PRIMARY KEY (id);


--
-- TOC entry 6960 (class 2606 OID 28067)
-- Name: post_categories post_categories_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.post_categories
    ADD CONSTRAINT post_categories_slug_key UNIQUE (slug);


--
-- TOC entry 6977 (class 2606 OID 28159)
-- Name: post_media post_media_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.post_media
    ADD CONSTRAINT post_media_pkey PRIMARY KEY (id);


--
-- TOC entry 6972 (class 2606 OID 28110)
-- Name: posts posts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.posts
    ADD CONSTRAINT posts_pkey PRIMARY KEY (id);


--
-- TOC entry 6974 (class 2606 OID 28112)
-- Name: posts posts_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.posts
    ADD CONSTRAINT posts_slug_key UNIQUE (slug);


--
-- TOC entry 6858 (class 2606 OID 27628)
-- Name: price_configs price_configs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.price_configs
    ADD CONSTRAINT price_configs_pkey PRIMARY KEY (id);


--
-- TOC entry 6933 (class 2606 OID 27941)
-- Name: promotion_usages promotion_usages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promotion_usages
    ADD CONSTRAINT promotion_usages_pkey PRIMARY KEY (id);


--
-- TOC entry 6924 (class 2606 OID 27925)
-- Name: promotions promotions_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promotions
    ADD CONSTRAINT promotions_code_key UNIQUE (code);


--
-- TOC entry 6926 (class 2606 OID 27923)
-- Name: promotions promotions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promotions
    ADD CONSTRAINT promotions_pkey PRIMARY KEY (id);


--
-- TOC entry 6751 (class 2606 OID 26824)
-- Name: provider_business_profiles provider_business_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.provider_business_profiles
    ADD CONSTRAINT provider_business_profiles_pkey PRIMARY KEY (provider_id);


--
-- TOC entry 7064 (class 2606 OID 28702)
-- Name: provider_contact_request_logs provider_contact_request_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.provider_contact_request_logs
    ADD CONSTRAINT provider_contact_request_logs_pkey PRIMARY KEY (id);


--
-- TOC entry 7060 (class 2606 OID 28669)
-- Name: provider_contact_requests provider_contact_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.provider_contact_requests
    ADD CONSTRAINT provider_contact_requests_pkey PRIMARY KEY (id);


--
-- TOC entry 6799 (class 2606 OID 27188)
-- Name: provider_document_services provider_document_services_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.provider_document_services
    ADD CONSTRAINT provider_document_services_pkey PRIMARY KEY (id);


--
-- TOC entry 6755 (class 2606 OID 26857)
-- Name: provider_documents provider_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.provider_documents
    ADD CONSTRAINT provider_documents_pkey PRIMARY KEY (id);


--
-- TOC entry 6813 (class 2606 OID 27286)
-- Name: provider_import_job_rows provider_import_job_rows_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.provider_import_job_rows
    ADD CONSTRAINT provider_import_job_rows_pkey PRIMARY KEY (id);


--
-- TOC entry 6809 (class 2606 OID 27262)
-- Name: provider_import_jobs provider_import_jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.provider_import_jobs
    ADD CONSTRAINT provider_import_jobs_pkey PRIMARY KEY (id);


--
-- TOC entry 6817 (class 2606 OID 27313)
-- Name: provider_import_metadata provider_import_metadata_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.provider_import_metadata
    ADD CONSTRAINT provider_import_metadata_pkey PRIMARY KEY (id);


--
-- TOC entry 6749 (class 2606 OID 26796)
-- Name: provider_individual_profiles provider_individual_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.provider_individual_profiles
    ADD CONSTRAINT provider_individual_profiles_pkey PRIMARY KEY (provider_id);


--
-- TOC entry 6807 (class 2606 OID 27223)
-- Name: provider_locations provider_locations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.provider_locations
    ADD CONSTRAINT provider_locations_pkey PRIMARY KEY (id);


--
-- TOC entry 6796 (class 2606 OID 27167)
-- Name: provider_service_attributes provider_service_attributes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.provider_service_attributes
    ADD CONSTRAINT provider_service_attributes_pkey PRIMARY KEY (id);


--
-- TOC entry 6792 (class 2606 OID 27123)
-- Name: provider_services provider_services_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.provider_services
    ADD CONSTRAINT provider_services_pkey PRIMARY KEY (id);


--
-- TOC entry 6758 (class 2606 OID 26890)
-- Name: provider_status_logs provider_status_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.provider_status_logs
    ADD CONSTRAINT provider_status_logs_pkey PRIMARY KEY (id);


--
-- TOC entry 6852 (class 2606 OID 27595)
-- Name: provider_vehicle_availabilities provider_vehicle_availabilities_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.provider_vehicle_availabilities
    ADD CONSTRAINT provider_vehicle_availabilities_pkey PRIMARY KEY (id);


--
-- TOC entry 6839 (class 2606 OID 27508)
-- Name: provider_vehicle_documents provider_vehicle_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.provider_vehicle_documents
    ADD CONSTRAINT provider_vehicle_documents_pkey PRIMARY KEY (id);


--
-- TOC entry 6835 (class 2606 OID 27469)
-- Name: provider_vehicles provider_vehicles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.provider_vehicles
    ADD CONSTRAINT provider_vehicles_pkey PRIMARY KEY (id);


--
-- TOC entry 6747 (class 2606 OID 26771)
-- Name: providers providers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.providers
    ADD CONSTRAINT providers_pkey PRIMARY KEY (id);


--
-- TOC entry 6740 (class 2606 OID 26735)
-- Name: refresh_tokens refresh_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refresh_tokens
    ADD CONSTRAINT refresh_tokens_pkey PRIMARY KEY (id);


--
-- TOC entry 7158 (class 2606 OID 29264)
-- Name: reservation_request_options reservation_request_options_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reservation_request_options
    ADD CONSTRAINT reservation_request_options_pkey PRIMARY KEY (id);


--
-- TOC entry 7164 (class 2606 OID 29295)
-- Name: reservation_request_status_logs reservation_request_status_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reservation_request_status_logs
    ADD CONSTRAINT reservation_request_status_logs_pkey PRIMARY KEY (id);


--
-- TOC entry 7150 (class 2606 OID 29225)
-- Name: reservation_requests reservation_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reservation_requests
    ADD CONSTRAINT reservation_requests_pkey PRIMARY KEY (id);


--
-- TOC entry 6942 (class 2606 OID 27982)
-- Name: reviews reviews_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_pkey PRIMARY KEY (id);


--
-- TOC entry 7098 (class 2606 OID 28871)
-- Name: service_appointments service_appointments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_appointments
    ADD CONSTRAINT service_appointments_pkey PRIMARY KEY (id);


--
-- TOC entry 6767 (class 2606 OID 26961)
-- Name: service_categories service_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_categories
    ADD CONSTRAINT service_categories_pkey PRIMARY KEY (id);


--
-- TOC entry 6778 (class 2606 OID 27037)
-- Name: service_category_attributes service_category_attributes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_category_attributes
    ADD CONSTRAINT service_category_attributes_pkey PRIMARY KEY (id);


--
-- TOC entry 6784 (class 2606 OID 27078)
-- Name: service_category_requirements service_category_requirements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_category_requirements
    ADD CONSTRAINT service_category_requirements_pkey PRIMARY KEY (id);


--
-- TOC entry 6846 (class 2606 OID 27574)
-- Name: service_route_schedules service_route_schedules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_route_schedules
    ADD CONSTRAINT service_route_schedules_pkey PRIMARY KEY (id);


--
-- TOC entry 6843 (class 2606 OID 27549)
-- Name: service_routes service_routes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_routes
    ADD CONSTRAINT service_routes_pkey PRIMARY KEY (id);


--
-- TOC entry 6774 (class 2606 OID 26996)
-- Name: service_skills service_skills_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_skills
    ADD CONSTRAINT service_skills_pkey PRIMARY KEY (id);


--
-- TOC entry 7091 (class 2606 OID 28842)
-- Name: setting_audit_logs setting_audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.setting_audit_logs
    ADD CONSTRAINT setting_audit_logs_pkey PRIMARY KEY (id);


--
-- TOC entry 7067 (class 2606 OID 28730)
-- Name: site_settings site_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.site_settings
    ADD CONSTRAINT site_settings_pkey PRIMARY KEY (id);


--
-- TOC entry 7069 (class 2606 OID 28732)
-- Name: site_settings site_settings_setting_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.site_settings
    ADD CONSTRAINT site_settings_setting_key_key UNIQUE (setting_key);


--
-- TOC entry 7007 (class 2606 OID 28343)
-- Name: support_ticket_messages support_ticket_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_ticket_messages
    ADD CONSTRAINT support_ticket_messages_pkey PRIMARY KEY (id);


--
-- TOC entry 7003 (class 2606 OID 28301)
-- Name: support_tickets support_tickets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_tickets
    ADD CONSTRAINT support_tickets_pkey PRIMARY KEY (id);


--
-- TOC entry 7169 (class 2606 OID 29326)
-- Name: tutor_request_applications tutor_request_applications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tutor_request_applications
    ADD CONSTRAINT tutor_request_applications_pkey PRIMARY KEY (id);


--
-- TOC entry 7122 (class 2606 OID 29042)
-- Name: tutor_request_status_logs tutor_request_status_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tutor_request_status_logs
    ADD CONSTRAINT tutor_request_status_logs_pkey PRIMARY KEY (id);


--
-- TOC entry 7112 (class 2606 OID 28971)
-- Name: tutor_requests tutor_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tutor_requests
    ADD CONSTRAINT tutor_requests_pkey PRIMARY KEY (id);


--
-- TOC entry 7118 (class 2606 OID 29013)
-- Name: tutor_sessions tutor_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tutor_sessions
    ADD CONSTRAINT tutor_sessions_pkey PRIMARY KEY (id);


--
-- TOC entry 7047 (class 2606 OID 28583)
-- Name: chat_conversations uq_chat_conversations_booking; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_conversations
    ADD CONSTRAINT uq_chat_conversations_booking UNIQUE (booking_id);


--
-- TOC entry 6863 (class 2606 OID 27650)
-- Name: commission_configs uq_commission_configs_service_effective; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commission_configs
    ADD CONSTRAINT uq_commission_configs_service_effective UNIQUE (service_type, effective_from);


--
-- TOC entry 6764 (class 2606 OID 26935)
-- Name: industry_categories uq_industry_categories_code; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.industry_categories
    ADD CONSTRAINT uq_industry_categories_code UNIQUE (code);


--
-- TOC entry 6956 (class 2606 OID 28041)
-- Name: notification_settings uq_notification_settings_user_type; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_settings
    ADD CONSTRAINT uq_notification_settings_user_type UNIQUE (user_id, notification_type);


--
-- TOC entry 6962 (class 2606 OID 28069)
-- Name: post_categories uq_post_categories_code; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.post_categories
    ADD CONSTRAINT uq_post_categories_code UNIQUE (code);


--
-- TOC entry 6935 (class 2606 OID 27943)
-- Name: promotion_usages uq_promotion_booking; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promotion_usages
    ADD CONSTRAINT uq_promotion_booking UNIQUE (promotion_id, booking_id);


--
-- TOC entry 6801 (class 2606 OID 27190)
-- Name: provider_document_services uq_provider_document_services; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.provider_document_services
    ADD CONSTRAINT uq_provider_document_services UNIQUE (provider_document_id, provider_service_id);


--
-- TOC entry 6819 (class 2606 OID 27315)
-- Name: provider_import_metadata uq_provider_import_metadata_provider; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.provider_import_metadata
    ADD CONSTRAINT uq_provider_import_metadata_provider UNIQUE (provider_id);


--
-- TOC entry 6742 (class 2606 OID 26737)
-- Name: refresh_tokens uq_refresh_tokens_jti; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refresh_tokens
    ADD CONSTRAINT uq_refresh_tokens_jti UNIQUE (jti);


--
-- TOC entry 6944 (class 2606 OID 29205)
-- Name: reviews uq_review_appointment_reviewer; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT uq_review_appointment_reviewer UNIQUE (appointment_id, reviewer_id);


--
-- TOC entry 6946 (class 2606 OID 27984)
-- Name: reviews uq_review_booking_reviewer; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT uq_review_booking_reviewer UNIQUE (booking_id, reviewer_id);


--
-- TOC entry 6948 (class 2606 OID 29351)
-- Name: reviews uq_review_tutor_request_reviewer; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT uq_review_tutor_request_reviewer UNIQUE (tutor_request_id, reviewer_id);


--
-- TOC entry 6780 (class 2606 OID 29196)
-- Name: service_category_attributes uq_sca_category_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_category_attributes
    ADD CONSTRAINT uq_sca_category_key UNIQUE (service_category_id, attr_key);


--
-- TOC entry 6848 (class 2606 OID 27576)
-- Name: service_route_schedules uq_schedule_route_time; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_route_schedules
    ADD CONSTRAINT uq_schedule_route_time UNIQUE (route_id, departure_time);


--
-- TOC entry 6786 (class 2606 OID 29198)
-- Name: service_category_requirements uq_scr_category_code; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_category_requirements
    ADD CONSTRAINT uq_scr_category_code UNIQUE (service_category_id, requirement_code);


--
-- TOC entry 6769 (class 2606 OID 26963)
-- Name: service_categories uq_service_categories_code_per_industry; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_categories
    ADD CONSTRAINT uq_service_categories_code_per_industry UNIQUE (industry_category_id, code);


--
-- TOC entry 6782 (class 2606 OID 27039)
-- Name: service_category_attributes uq_service_category_attributes_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_category_attributes
    ADD CONSTRAINT uq_service_category_attributes_key UNIQUE (service_category_id, attr_key);


--
-- TOC entry 6788 (class 2606 OID 27080)
-- Name: service_category_requirements uq_service_category_requirements; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_category_requirements
    ADD CONSTRAINT uq_service_category_requirements UNIQUE (service_category_id, requirement_code);


--
-- TOC entry 6776 (class 2606 OID 26998)
-- Name: service_skills uq_service_skills_code_per_category; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_skills
    ADD CONSTRAINT uq_service_skills_code_per_category UNIQUE (service_category_id, code);


--
-- TOC entry 6771 (class 2606 OID 29194)
-- Name: service_categories uq_service_slug_per_industry; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_categories
    ADD CONSTRAINT uq_service_slug_per_industry UNIQUE (industry_category_id, name);


--
-- TOC entry 6726 (class 2606 OID 26647)
-- Name: user_roles uq_user_roles; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT uq_user_roles UNIQUE (user_id, role_code);


--
-- TOC entry 6989 (class 2606 OID 28236)
-- Name: user_tags uq_user_tags_user_tag; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_tags
    ADD CONSTRAINT uq_user_tags_user_tag UNIQUE (user_id, tag);


--
-- TOC entry 6854 (class 2606 OID 27597)
-- Name: provider_vehicle_availabilities uq_vehicle_availability_date; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.provider_vehicle_availabilities
    ADD CONSTRAINT uq_vehicle_availability_date UNIQUE (vehicle_id, date);


--
-- TOC entry 6826 (class 2606 OID 27383)
-- Name: user_identity_files user_identity_files_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_identity_files
    ADD CONSTRAINT user_identity_files_pkey PRIMARY KEY (id);


--
-- TOC entry 6832 (class 2606 OID 27428)
-- Name: user_identity_review_decisions user_identity_review_decisions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_identity_review_decisions
    ADD CONSTRAINT user_identity_review_decisions_pkey PRIMARY KEY (id);


--
-- TOC entry 6829 (class 2606 OID 27408)
-- Name: user_identity_verification_logs user_identity_verification_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_identity_verification_logs
    ADD CONSTRAINT user_identity_verification_logs_pkey PRIMARY KEY (id);


--
-- TOC entry 6823 (class 2606 OID 27355)
-- Name: user_identity_verifications user_identity_verifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_identity_verifications
    ADD CONSTRAINT user_identity_verifications_pkey PRIMARY KEY (id);


--
-- TOC entry 6995 (class 2606 OID 28266)
-- Name: user_notes user_notes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_notes
    ADD CONSTRAINT user_notes_pkey PRIMARY KEY (id);


--
-- TOC entry 7053 (class 2606 OID 28639)
-- Name: user_presence user_presence_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_presence
    ADD CONSTRAINT user_presence_pkey PRIMARY KEY (user_id);


--
-- TOC entry 6731 (class 2606 OID 26668)
-- Name: user_profiles user_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_profiles
    ADD CONSTRAINT user_profiles_pkey PRIMARY KEY (user_id);


--
-- TOC entry 6728 (class 2606 OID 26645)
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);


--
-- TOC entry 6734 (class 2606 OID 26686)
-- Name: user_status_logs user_status_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_status_logs
    ADD CONSTRAINT user_status_logs_pkey PRIMARY KEY (id);


--
-- TOC entry 6991 (class 2606 OID 28234)
-- Name: user_tags user_tags_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_tags
    ADD CONSTRAINT user_tags_pkey PRIMARY KEY (id);


--
-- TOC entry 6720 (class 2606 OID 32819)
-- Name: users users_google_sub_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_google_sub_key UNIQUE (google_sub);


--
-- TOC entry 6722 (class 2606 OID 26631)
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- TOC entry 6909 (class 2606 OID 27844)
-- Name: wallet_transactions wallet_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wallet_transactions
    ADD CONSTRAINT wallet_transactions_pkey PRIMARY KEY (id);


--
-- TOC entry 6897 (class 2606 OID 27817)
-- Name: wallets wallets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wallets
    ADD CONSTRAINT wallets_pkey PRIMARY KEY (id);


--
-- TOC entry 6899 (class 2606 OID 27819)
-- Name: wallets wallets_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wallets
    ADD CONSTRAINT wallets_user_id_key UNIQUE (user_id);


--
-- TOC entry 6875 (class 1259 OID 27771)
-- Name: gix_bookings_dropoff; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX gix_bookings_dropoff ON public.bookings USING gist (dropoff_point);


--
-- TOC entry 6876 (class 1259 OID 27772)
-- Name: gix_bookings_pending_pickup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX gix_bookings_pending_pickup ON public.bookings USING gist (pickup_point) WHERE (((status)::text = 'pending'::text) AND (pickup_point IS NOT NULL));


--
-- TOC entry 6877 (class 1259 OID 27770)
-- Name: gix_bookings_pickup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX gix_bookings_pickup ON public.bookings USING gist (pickup_point);


--
-- TOC entry 6866 (class 1259 OID 27669)
-- Name: gix_driver_locations_loc; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX gix_driver_locations_loc ON public.driver_locations USING gist (location);


--
-- TOC entry 6802 (class 1259 OID 27234)
-- Name: gix_provider_locations_location; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX gix_provider_locations_location ON public.provider_locations USING gist (location);


--
-- TOC entry 7105 (class 1259 OID 28947)
-- Name: idx_appointment_reschedules_appointment_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_appointment_reschedules_appointment_id ON public.appointment_reschedules USING btree (appointment_id);


--
-- TOC entry 7106 (class 1259 OID 28948)
-- Name: idx_appointment_reschedules_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_appointment_reschedules_status ON public.appointment_reschedules USING btree (status);


--
-- TOC entry 7101 (class 1259 OID 28917)
-- Name: idx_appointment_status_logs_appointment_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_appointment_status_logs_appointment_id ON public.appointment_status_logs USING btree (appointment_id);


--
-- TOC entry 7102 (class 1259 OID 28918)
-- Name: idx_appointment_status_logs_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_appointment_status_logs_created_at ON public.appointment_status_logs USING btree (created_at);


--
-- TOC entry 7050 (class 1259 OID 28627)
-- Name: idx_chat_messages_conversation_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chat_messages_conversation_created ON public.chat_messages USING btree (conversation_id, created_at DESC);


--
-- TOC entry 6980 (class 1259 OID 28196)
-- Name: idx_consent_logs_type_action; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_consent_logs_type_action ON public.consent_logs USING btree (consent_type, action, created_at DESC);


--
-- TOC entry 6981 (class 1259 OID 28195)
-- Name: idx_consent_logs_user_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_consent_logs_user_created ON public.consent_logs USING btree (user_id, created_at DESC);


--
-- TOC entry 7087 (class 1259 OID 28828)
-- Name: idx_core_settings_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_core_settings_category ON public.core_settings USING btree (category);


--
-- TOC entry 7035 (class 1259 OID 28528)
-- Name: idx_crm_activities_contact; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_crm_activities_contact ON public.crm_activities USING btree (contact_id);


--
-- TOC entry 7036 (class 1259 OID 28530)
-- Name: idx_crm_activities_deal; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_crm_activities_deal ON public.crm_activities USING btree (deal_id);


--
-- TOC entry 7037 (class 1259 OID 28529)
-- Name: idx_crm_activities_lead; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_crm_activities_lead ON public.crm_activities USING btree (lead_id);


--
-- TOC entry 7038 (class 1259 OID 28531)
-- Name: idx_crm_activities_scheduled; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_crm_activities_scheduled ON public.crm_activities USING btree (scheduled_at) WHERE (scheduled_at IS NOT NULL);


--
-- TOC entry 7039 (class 1259 OID 28532)
-- Name: idx_crm_activities_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_crm_activities_type ON public.crm_activities USING btree (activity_type);


--
-- TOC entry 7010 (class 1259 OID 28379)
-- Name: idx_crm_contacts_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_crm_contacts_email ON public.crm_contacts USING btree (email);


--
-- TOC entry 7011 (class 1259 OID 28380)
-- Name: idx_crm_contacts_phone; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_crm_contacts_phone ON public.crm_contacts USING btree (phone);


--
-- TOC entry 7012 (class 1259 OID 28381)
-- Name: idx_crm_contacts_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_crm_contacts_status ON public.crm_contacts USING btree (status);


--
-- TOC entry 7013 (class 1259 OID 28382)
-- Name: idx_crm_contacts_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_crm_contacts_user_id ON public.crm_contacts USING btree (user_id);


--
-- TOC entry 7021 (class 1259 OID 28441)
-- Name: idx_crm_deals_assigned; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_crm_deals_assigned ON public.crm_deals USING btree (assigned_to);


--
-- TOC entry 7022 (class 1259 OID 28443)
-- Name: idx_crm_deals_close_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_crm_deals_close_date ON public.crm_deals USING btree (close_date) WHERE (close_date IS NOT NULL);


--
-- TOC entry 7023 (class 1259 OID 28440)
-- Name: idx_crm_deals_contact; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_crm_deals_contact ON public.crm_deals USING btree (contact_id);


--
-- TOC entry 7024 (class 1259 OID 28442)
-- Name: idx_crm_deals_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_crm_deals_status ON public.crm_deals USING btree (status);


--
-- TOC entry 7016 (class 1259 OID 28411)
-- Name: idx_crm_leads_assigned; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_crm_leads_assigned ON public.crm_leads USING btree (assigned_to);


--
-- TOC entry 7017 (class 1259 OID 28410)
-- Name: idx_crm_leads_contact; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_crm_leads_contact ON public.crm_leads USING btree (contact_id);


--
-- TOC entry 7018 (class 1259 OID 28412)
-- Name: idx_crm_leads_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_crm_leads_status ON public.crm_leads USING btree (status);


--
-- TOC entry 7027 (class 1259 OID 28484)
-- Name: idx_crm_tasks_assigned; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_crm_tasks_assigned ON public.crm_tasks USING btree (assigned_to);


--
-- TOC entry 7028 (class 1259 OID 28481)
-- Name: idx_crm_tasks_contact; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_crm_tasks_contact ON public.crm_tasks USING btree (contact_id);


--
-- TOC entry 7029 (class 1259 OID 28482)
-- Name: idx_crm_tasks_deal; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_crm_tasks_deal ON public.crm_tasks USING btree (deal_id);


--
-- TOC entry 7030 (class 1259 OID 28485)
-- Name: idx_crm_tasks_due_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_crm_tasks_due_date ON public.crm_tasks USING btree (due_date) WHERE (due_date IS NOT NULL);


--
-- TOC entry 7031 (class 1259 OID 28483)
-- Name: idx_crm_tasks_lead; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_crm_tasks_lead ON public.crm_tasks USING btree (lead_id);


--
-- TOC entry 7032 (class 1259 OID 28486)
-- Name: idx_crm_tasks_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_crm_tasks_status ON public.crm_tasks USING btree (status);


--
-- TOC entry 6984 (class 1259 OID 28223)
-- Name: idx_ddr_status_scheduled; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ddr_status_scheduled ON public.data_deletion_requests USING btree (status, scheduled_delete_at) WHERE ((status)::text = ANY ((ARRAY['pending'::character varying, 'processing'::character varying])::text[]));


--
-- TOC entry 6985 (class 1259 OID 28222)
-- Name: idx_ddr_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ddr_user_id ON public.data_deletion_requests USING btree (user_id);


--
-- TOC entry 7081 (class 1259 OID 28805)
-- Name: idx_footer_links_group; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_footer_links_group ON public.footer_links USING btree (group_key);


--
-- TOC entry 7082 (class 1259 OID 28806)
-- Name: idx_footer_links_sort; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_footer_links_sort ON public.footer_links USING btree (sort_order);


--
-- TOC entry 7129 (class 1259 OID 29133)
-- Name: idx_job_request_attachments_job_request_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_job_request_attachments_job_request_id ON public.job_request_attachments USING btree (job_request_id);


--
-- TOC entry 7132 (class 1259 OID 29165)
-- Name: idx_job_request_quotes_job_request_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_job_request_quotes_job_request_id ON public.job_request_quotes USING btree (job_request_id);


--
-- TOC entry 7133 (class 1259 OID 29166)
-- Name: idx_job_request_quotes_provider_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_job_request_quotes_provider_id ON public.job_request_quotes USING btree (provider_id);


--
-- TOC entry 7134 (class 1259 OID 29167)
-- Name: idx_job_request_quotes_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_job_request_quotes_status ON public.job_request_quotes USING btree (status);


--
-- TOC entry 7137 (class 1259 OID 29192)
-- Name: idx_job_request_status_logs_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_job_request_status_logs_created_at ON public.job_request_status_logs USING btree (created_at);


--
-- TOC entry 7138 (class 1259 OID 29191)
-- Name: idx_job_request_status_logs_job_request_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_job_request_status_logs_job_request_id ON public.job_request_status_logs USING btree (job_request_id);


--
-- TOC entry 7123 (class 1259 OID 29103)
-- Name: idx_job_requests_customer_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_job_requests_customer_user_id ON public.job_requests USING btree (customer_user_id);


--
-- TOC entry 7124 (class 1259 OID 29104)
-- Name: idx_job_requests_provider_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_job_requests_provider_id ON public.job_requests USING btree (provider_id);


--
-- TOC entry 7125 (class 1259 OID 29105)
-- Name: idx_job_requests_provider_service_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_job_requests_provider_service_id ON public.job_requests USING btree (provider_service_id);


--
-- TOC entry 7126 (class 1259 OID 29106)
-- Name: idx_job_requests_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_job_requests_status ON public.job_requests USING btree (status);


--
-- TOC entry 7070 (class 1259 OID 28758)
-- Name: idx_landing_banners_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_landing_banners_active ON public.landing_banners USING btree (is_active) WHERE (is_active = true);


--
-- TOC entry 7071 (class 1259 OID 28757)
-- Name: idx_landing_banners_page_key; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_landing_banners_page_key ON public.landing_banners USING btree (page_key);


--
-- TOC entry 7072 (class 1259 OID 28759)
-- Name: idx_landing_banners_sort; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_landing_banners_sort ON public.landing_banners USING btree (sort_order);


--
-- TOC entry 7075 (class 1259 OID 28781)
-- Name: idx_landing_sections_page_key; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_landing_sections_page_key ON public.landing_sections USING btree (page_key);


--
-- TOC entry 7076 (class 1259 OID 28782)
-- Name: idx_landing_sections_sort; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_landing_sections_sort ON public.landing_sections USING btree (sort_order);


--
-- TOC entry 7040 (class 1259 OID 28567)
-- Name: idx_nc_pending_send; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_nc_pending_send ON public.notification_campaigns USING btree (scheduled_at) WHERE (((status)::text = 'scheduled'::text) AND (scheduled_at IS NOT NULL));


--
-- TOC entry 7041 (class 1259 OID 28566)
-- Name: idx_nc_status_scheduled; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_nc_status_scheduled ON public.notification_campaigns USING btree (status, scheduled_at DESC);


--
-- TOC entry 6949 (class 1259 OID 28024)
-- Name: idx_notifications_user_unread; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_user_unread ON public.notifications USING btree (user_id, is_read, created_at DESC);


--
-- TOC entry 6735 (class 1259 OID 26721)
-- Name: idx_otp_sessions_phone_expires_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_otp_sessions_phone_expires_at ON public.otp_sessions USING btree (phone, expires_at);


--
-- TOC entry 7054 (class 1259 OID 28689)
-- Name: idx_pcr_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pcr_created_at ON public.provider_contact_requests USING btree (created_at DESC);


--
-- TOC entry 7055 (class 1259 OID 28685)
-- Name: idx_pcr_customer_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pcr_customer_id ON public.provider_contact_requests USING btree (customer_user_id);


--
-- TOC entry 7056 (class 1259 OID 28686)
-- Name: idx_pcr_provider_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pcr_provider_id ON public.provider_contact_requests USING btree (provider_id);


--
-- TOC entry 7057 (class 1259 OID 28687)
-- Name: idx_pcr_provider_service_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pcr_provider_service_id ON public.provider_contact_requests USING btree (provider_service_id);


--
-- TOC entry 7058 (class 1259 OID 28688)
-- Name: idx_pcr_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pcr_status ON public.provider_contact_requests USING btree (status);


--
-- TOC entry 7061 (class 1259 OID 28714)
-- Name: idx_pcrl_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pcrl_created_at ON public.provider_contact_request_logs USING btree (created_at);


--
-- TOC entry 7062 (class 1259 OID 28713)
-- Name: idx_pcrl_request_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pcrl_request_id ON public.provider_contact_request_logs USING btree (contact_request_id);


--
-- TOC entry 6810 (class 1259 OID 27326)
-- Name: idx_pijr_job_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pijr_job_id ON public.provider_import_job_rows USING btree (job_id);


--
-- TOC entry 6811 (class 1259 OID 27327)
-- Name: idx_pijr_phone_normalized; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pijr_phone_normalized ON public.provider_import_job_rows USING btree (phone_normalized);


--
-- TOC entry 6814 (class 1259 OID 27329)
-- Name: idx_pim_import_job_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pim_import_job_id ON public.provider_import_metadata USING btree (import_job_id);


--
-- TOC entry 6815 (class 1259 OID 27328)
-- Name: idx_pim_provider_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pim_provider_id ON public.provider_import_metadata USING btree (provider_id);


--
-- TOC entry 6975 (class 1259 OID 28172)
-- Name: idx_post_media_post_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_post_media_post_id ON public.post_media USING btree (post_id);


--
-- TOC entry 6963 (class 1259 OID 28166)
-- Name: idx_posts_author_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_posts_author_user_id ON public.posts USING btree (author_user_id);


--
-- TOC entry 6964 (class 1259 OID 28165)
-- Name: idx_posts_category_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_posts_category_id ON public.posts USING btree (category_id);


--
-- TOC entry 6965 (class 1259 OID 28168)
-- Name: idx_posts_industry_category_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_posts_industry_category_id ON public.posts USING btree (industry_category_id);


--
-- TOC entry 6966 (class 1259 OID 28167)
-- Name: idx_posts_provider_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_posts_provider_id ON public.posts USING btree (provider_id);


--
-- TOC entry 6967 (class 1259 OID 28171)
-- Name: idx_posts_published_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_posts_published_at ON public.posts USING btree (published_at);


--
-- TOC entry 6968 (class 1259 OID 28169)
-- Name: idx_posts_service_category_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_posts_service_category_id ON public.posts USING btree (service_category_id);


--
-- TOC entry 6969 (class 1259 OID 28170)
-- Name: idx_posts_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_posts_status ON public.posts USING btree (status);


--
-- TOC entry 6970 (class 1259 OID 28173)
-- Name: idx_posts_title_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_posts_title_trgm ON public.posts USING gin (title public.gin_trgm_ops);


--
-- TOC entry 6752 (class 1259 OID 29064)
-- Name: idx_provider_docs_license_approved; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_provider_docs_license_approved ON public.provider_documents USING btree (provider_id, license_class) WHERE (((document_type)::text = 'driving_license'::text) AND ((verification_status)::text = 'approved'::text));


--
-- TOC entry 6797 (class 1259 OID 27204)
-- Name: idx_provider_document_services_service_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_provider_document_services_service_id ON public.provider_document_services USING btree (provider_service_id);


--
-- TOC entry 6753 (class 1259 OID 26902)
-- Name: idx_provider_documents_provider_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_provider_documents_provider_id ON public.provider_documents USING btree (provider_id);


--
-- TOC entry 6803 (class 1259 OID 27235)
-- Name: idx_provider_locations_provider_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_provider_locations_provider_id ON public.provider_locations USING btree (provider_id);


--
-- TOC entry 6804 (class 1259 OID 27237)
-- Name: idx_provider_locations_provider_primary; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_provider_locations_provider_primary ON public.provider_locations USING btree (provider_id, is_primary);


--
-- TOC entry 6805 (class 1259 OID 27236)
-- Name: idx_provider_locations_service_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_provider_locations_service_id ON public.provider_locations USING btree (provider_service_id);


--
-- TOC entry 6794 (class 1259 OID 27203)
-- Name: idx_provider_service_attributes_service_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_provider_service_attributes_service_id ON public.provider_service_attributes USING btree (provider_service_id);


--
-- TOC entry 6789 (class 1259 OID 27202)
-- Name: idx_provider_services_category_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_provider_services_category_id ON public.provider_services USING btree (service_category_id);


--
-- TOC entry 6790 (class 1259 OID 27201)
-- Name: idx_provider_services_provider_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_provider_services_provider_id ON public.provider_services USING btree (provider_id);


--
-- TOC entry 6756 (class 1259 OID 26903)
-- Name: idx_provider_status_logs_provider_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_provider_status_logs_provider_id ON public.provider_status_logs USING btree (provider_id);


--
-- TOC entry 6743 (class 1259 OID 26901)
-- Name: idx_providers_owner_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_providers_owner_user_id ON public.providers USING btree (owner_user_id);


--
-- TOC entry 6744 (class 1259 OID 26905)
-- Name: idx_providers_status_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_providers_status_active ON public.providers USING btree (status) WHERE ((status)::text = 'active'::text);


--
-- TOC entry 6745 (class 1259 OID 26904)
-- Name: idx_providers_verification_approved; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_providers_verification_approved ON public.providers USING btree (verification_status) WHERE ((verification_status)::text = 'approved'::text);


--
-- TOC entry 6738 (class 1259 OID 26743)
-- Name: idx_refresh_tokens_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_refresh_tokens_user_id ON public.refresh_tokens USING btree (user_id);


--
-- TOC entry 7141 (class 1259 OID 29355)
-- Name: idx_reservation_requests_customer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reservation_requests_customer ON public.reservation_requests USING btree (customer_user_id, status);


--
-- TOC entry 7142 (class 1259 OID 29241)
-- Name: idx_reservation_requests_customer_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reservation_requests_customer_user_id ON public.reservation_requests USING btree (customer_user_id);


--
-- TOC entry 7143 (class 1259 OID 29356)
-- Name: idx_reservation_requests_provider; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reservation_requests_provider ON public.reservation_requests USING btree (provider_id, status);


--
-- TOC entry 7144 (class 1259 OID 29242)
-- Name: idx_reservation_requests_provider_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reservation_requests_provider_id ON public.reservation_requests USING btree (provider_id);


--
-- TOC entry 7145 (class 1259 OID 29243)
-- Name: idx_reservation_requests_provider_service_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reservation_requests_provider_service_id ON public.reservation_requests USING btree (provider_service_id);


--
-- TOC entry 7146 (class 1259 OID 29245)
-- Name: idx_reservation_requests_request_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reservation_requests_request_type ON public.reservation_requests USING btree (request_type);


--
-- TOC entry 7147 (class 1259 OID 29244)
-- Name: idx_reservation_requests_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reservation_requests_status ON public.reservation_requests USING btree (status);


--
-- TOC entry 7148 (class 1259 OID 29357)
-- Name: idx_reservation_requests_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reservation_requests_type ON public.reservation_requests USING btree (request_type, status);


--
-- TOC entry 6936 (class 1259 OID 29354)
-- Name: idx_reviews_appointment; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reviews_appointment ON public.reviews USING btree (appointment_id);


--
-- TOC entry 6937 (class 1259 OID 28001)
-- Name: idx_reviews_booking; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reviews_booking ON public.reviews USING btree (booking_id);


--
-- TOC entry 6938 (class 1259 OID 28000)
-- Name: idx_reviews_reviewee; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reviews_reviewee ON public.reviews USING btree (reviewee_id, created_at DESC);


--
-- TOC entry 6939 (class 1259 OID 29352)
-- Name: idx_reviews_tutor_request; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reviews_tutor_request ON public.reviews USING btree (tutor_request_id);


--
-- TOC entry 7151 (class 1259 OID 29277)
-- Name: idx_rr_options_is_selected; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rr_options_is_selected ON public.reservation_request_options USING btree (reservation_request_id, is_selected);


--
-- TOC entry 7152 (class 1259 OID 29364)
-- Name: idx_rr_options_provider; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rr_options_provider ON public.reservation_request_options USING btree (provider_id);


--
-- TOC entry 7153 (class 1259 OID 29276)
-- Name: idx_rr_options_provider_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rr_options_provider_id ON public.reservation_request_options USING btree (provider_id);


--
-- TOC entry 7154 (class 1259 OID 29363)
-- Name: idx_rr_options_request; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rr_options_request ON public.reservation_request_options USING btree (reservation_request_id);


--
-- TOC entry 7155 (class 1259 OID 29275)
-- Name: idx_rr_options_reservation_request_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rr_options_reservation_request_id ON public.reservation_request_options USING btree (reservation_request_id);


--
-- TOC entry 7156 (class 1259 OID 29365)
-- Name: idx_rr_options_selected; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rr_options_selected ON public.reservation_request_options USING btree (reservation_request_id, is_selected) WHERE (is_selected = true);


--
-- TOC entry 7159 (class 1259 OID 29307)
-- Name: idx_rr_status_logs_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rr_status_logs_created_at ON public.reservation_request_status_logs USING btree (created_at);


--
-- TOC entry 7160 (class 1259 OID 29366)
-- Name: idx_rr_status_logs_request; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rr_status_logs_request ON public.reservation_request_status_logs USING btree (reservation_request_id, created_at DESC);


--
-- TOC entry 7161 (class 1259 OID 29306)
-- Name: idx_rr_status_logs_reservation_request_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rr_status_logs_reservation_request_id ON public.reservation_request_status_logs USING btree (reservation_request_id);


--
-- TOC entry 7162 (class 1259 OID 29367)
-- Name: idx_rr_status_logs_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rr_status_logs_user ON public.reservation_request_status_logs USING btree (changed_by);


--
-- TOC entry 7092 (class 1259 OID 28887)
-- Name: idx_service_appointments_customer_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_service_appointments_customer_user_id ON public.service_appointments USING btree (customer_user_id);


--
-- TOC entry 7093 (class 1259 OID 28888)
-- Name: idx_service_appointments_provider_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_service_appointments_provider_id ON public.service_appointments USING btree (provider_id);


--
-- TOC entry 7094 (class 1259 OID 28889)
-- Name: idx_service_appointments_provider_service_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_service_appointments_provider_service_id ON public.service_appointments USING btree (provider_service_id);


--
-- TOC entry 7095 (class 1259 OID 28891)
-- Name: idx_service_appointments_service_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_service_appointments_service_date ON public.service_appointments USING btree (service_date);


--
-- TOC entry 7096 (class 1259 OID 28890)
-- Name: idx_service_appointments_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_service_appointments_status ON public.service_appointments USING btree (status);


--
-- TOC entry 6765 (class 1259 OID 27096)
-- Name: idx_service_categories_industry_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_service_categories_industry_id ON public.service_categories USING btree (industry_category_id);


--
-- TOC entry 6772 (class 1259 OID 27097)
-- Name: idx_service_skills_category_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_service_skills_category_id ON public.service_skills USING btree (service_category_id);


--
-- TOC entry 7088 (class 1259 OID 28849)
-- Name: idx_setting_audit_logs_changed_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_setting_audit_logs_changed_at ON public.setting_audit_logs USING btree (changed_at);


--
-- TOC entry 7089 (class 1259 OID 28848)
-- Name: idx_setting_audit_logs_setting_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_setting_audit_logs_setting_id ON public.setting_audit_logs USING btree (setting_id);


--
-- TOC entry 7065 (class 1259 OID 28733)
-- Name: idx_site_settings_key; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_site_settings_key ON public.site_settings USING btree (setting_key);


--
-- TOC entry 7004 (class 1259 OID 28354)
-- Name: idx_stm_ticket_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stm_ticket_created ON public.support_ticket_messages USING btree (ticket_id, created_at);


--
-- TOC entry 7005 (class 1259 OID 28355)
-- Name: idx_stm_ticket_public; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stm_ticket_public ON public.support_ticket_messages USING btree (ticket_id, created_at) WHERE (is_internal = false);


--
-- TOC entry 6996 (class 1259 OID 28326)
-- Name: idx_support_tickets_against; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_support_tickets_against ON public.support_tickets USING btree (against_id);


--
-- TOC entry 6997 (class 1259 OID 28324)
-- Name: idx_support_tickets_assigned_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_support_tickets_assigned_status ON public.support_tickets USING btree (assigned_to, status) WHERE (assigned_to IS NOT NULL);


--
-- TOC entry 6998 (class 1259 OID 28325)
-- Name: idx_support_tickets_booking_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_support_tickets_booking_id ON public.support_tickets USING btree (booking_id) WHERE (booking_id IS NOT NULL);


--
-- TOC entry 6999 (class 1259 OID 28327)
-- Name: idx_support_tickets_dispute_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_support_tickets_dispute_type ON public.support_tickets USING btree (dispute_type);


--
-- TOC entry 7000 (class 1259 OID 28323)
-- Name: idx_support_tickets_status_priority; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_support_tickets_status_priority ON public.support_tickets USING btree (status, priority, created_at) WHERE ((status)::text <> ALL ((ARRAY['resolved'::character varying, 'closed'::character varying])::text[]));


--
-- TOC entry 7001 (class 1259 OID 28322)
-- Name: idx_support_tickets_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_support_tickets_user_id ON public.support_tickets USING btree (user_id);


--
-- TOC entry 7165 (class 1259 OID 29343)
-- Name: idx_tutor_request_applications_provider_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tutor_request_applications_provider_id ON public.tutor_request_applications USING btree (provider_id);


--
-- TOC entry 7166 (class 1259 OID 29344)
-- Name: idx_tutor_request_applications_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tutor_request_applications_status ON public.tutor_request_applications USING btree (status);


--
-- TOC entry 7167 (class 1259 OID 29342)
-- Name: idx_tutor_request_applications_tutor_request_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tutor_request_applications_tutor_request_id ON public.tutor_request_applications USING btree (tutor_request_id);


--
-- TOC entry 7119 (class 1259 OID 29054)
-- Name: idx_tutor_request_status_logs_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tutor_request_status_logs_created_at ON public.tutor_request_status_logs USING btree (created_at);


--
-- TOC entry 7120 (class 1259 OID 29053)
-- Name: idx_tutor_request_status_logs_tutor_request_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tutor_request_status_logs_tutor_request_id ON public.tutor_request_status_logs USING btree (tutor_request_id);


--
-- TOC entry 7107 (class 1259 OID 28987)
-- Name: idx_tutor_requests_customer_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tutor_requests_customer_user_id ON public.tutor_requests USING btree (customer_user_id);


--
-- TOC entry 7108 (class 1259 OID 28988)
-- Name: idx_tutor_requests_provider_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tutor_requests_provider_id ON public.tutor_requests USING btree (provider_id);


--
-- TOC entry 7109 (class 1259 OID 32817)
-- Name: idx_tutor_requests_service_category_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tutor_requests_service_category_id ON public.tutor_requests USING btree (service_category_id);


--
-- TOC entry 7110 (class 1259 OID 28990)
-- Name: idx_tutor_requests_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tutor_requests_status ON public.tutor_requests USING btree (status);


--
-- TOC entry 7113 (class 1259 OID 29025)
-- Name: idx_tutor_sessions_provider_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tutor_sessions_provider_id ON public.tutor_sessions USING btree (provider_id);


--
-- TOC entry 7114 (class 1259 OID 29027)
-- Name: idx_tutor_sessions_session_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tutor_sessions_session_date ON public.tutor_sessions USING btree (session_date);


--
-- TOC entry 7115 (class 1259 OID 29026)
-- Name: idx_tutor_sessions_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tutor_sessions_status ON public.tutor_sessions USING btree (status);


--
-- TOC entry 7116 (class 1259 OID 29024)
-- Name: idx_tutor_sessions_tutor_request_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tutor_sessions_tutor_request_id ON public.tutor_sessions USING btree (tutor_request_id);


--
-- TOC entry 6824 (class 1259 OID 27440)
-- Name: idx_user_identity_files_verification_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_identity_files_verification_id ON public.user_identity_files USING btree (verification_id);


--
-- TOC entry 6830 (class 1259 OID 27442)
-- Name: idx_user_identity_review_decisions_verification_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_identity_review_decisions_verification_id ON public.user_identity_review_decisions USING btree (verification_id);


--
-- TOC entry 6827 (class 1259 OID 27441)
-- Name: idx_user_identity_verification_logs_verification_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_identity_verification_logs_verification_id ON public.user_identity_verification_logs USING btree (verification_id);


--
-- TOC entry 6820 (class 1259 OID 27439)
-- Name: idx_user_identity_verifications_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_identity_verifications_user_id ON public.user_identity_verifications USING btree (user_id);


--
-- TOC entry 6992 (class 1259 OID 28277)
-- Name: idx_user_notes_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_notes_user_id ON public.user_notes USING btree (user_id);


--
-- TOC entry 6993 (class 1259 OID 28278)
-- Name: idx_user_notes_user_pinned; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_notes_user_pinned ON public.user_notes USING btree (user_id, is_pinned DESC, created_at DESC);


--
-- TOC entry 7051 (class 1259 OID 28645)
-- Name: idx_user_presence_online; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_presence_online ON public.user_presence USING btree (is_online) WHERE (is_online = true);


--
-- TOC entry 6729 (class 1259 OID 26674)
-- Name: idx_user_profiles_is_deleted; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_profiles_is_deleted ON public.user_profiles USING btree (is_deleted) WHERE (is_deleted = false);


--
-- TOC entry 6724 (class 1259 OID 26697)
-- Name: idx_user_roles_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_roles_user_id ON public.user_roles USING btree (user_id);


--
-- TOC entry 6732 (class 1259 OID 26698)
-- Name: idx_user_status_logs_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_status_logs_user_id ON public.user_status_logs USING btree (user_id);


--
-- TOC entry 6986 (class 1259 OID 28248)
-- Name: idx_user_tags_tag; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_tags_tag ON public.user_tags USING btree (tag);


--
-- TOC entry 6987 (class 1259 OID 28247)
-- Name: idx_user_tags_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_tags_user_id ON public.user_tags USING btree (user_id);


--
-- TOC entry 6716 (class 1259 OID 26699)
-- Name: idx_users_status_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_status_active ON public.users USING btree (status) WHERE ((status)::text = 'active'::text);


--
-- TOC entry 6717 (class 1259 OID 26700)
-- Name: idx_users_verified; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_verified ON public.users USING btree (id) WHERE (phone_verified = true);


--
-- TOC entry 6893 (class 1259 OID 27796)
-- Name: ix_booking_status_logs_booking_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_booking_status_logs_booking_id ON public.booking_status_logs USING btree (booking_id);


--
-- TOC entry 6878 (class 1259 OID 27769)
-- Name: ix_bookings_active_partial; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_bookings_active_partial ON public.bookings USING btree (id) WHERE ((status)::text = ANY ((ARRAY['accepted'::character varying, 'arriving'::character varying, 'in_progress'::character varying])::text[]));


--
-- TOC entry 6879 (class 1259 OID 27765)
-- Name: ix_bookings_completed_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_bookings_completed_at ON public.bookings USING btree (completed_at DESC) WHERE (completed_at IS NOT NULL);


--
-- TOC entry 6880 (class 1259 OID 27757)
-- Name: ix_bookings_customer_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_bookings_customer_id ON public.bookings USING btree (customer_id);


--
-- TOC entry 6881 (class 1259 OID 27768)
-- Name: ix_bookings_customer_payment; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_bookings_customer_payment ON public.bookings USING btree (customer_id, payment_status);


--
-- TOC entry 6882 (class 1259 OID 27762)
-- Name: ix_bookings_customer_requested; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_bookings_customer_requested ON public.bookings USING btree (customer_id, requested_at DESC);


--
-- TOC entry 6883 (class 1259 OID 27766)
-- Name: ix_bookings_pending_partial; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_bookings_pending_partial ON public.bookings USING btree (requested_at DESC) WHERE ((status)::text = 'pending'::text);


--
-- TOC entry 6884 (class 1259 OID 27767)
-- Name: ix_bookings_pickup_coords; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_bookings_pickup_coords ON public.bookings USING btree (pickup_lat, pickup_lng) WHERE ((pickup_lat IS NOT NULL) AND (pickup_lng IS NOT NULL));


--
-- TOC entry 6885 (class 1259 OID 27758)
-- Name: ix_bookings_provider_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_bookings_provider_id ON public.bookings USING btree (provider_id);


--
-- TOC entry 6886 (class 1259 OID 27763)
-- Name: ix_bookings_provider_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_bookings_provider_status ON public.bookings USING btree (provider_id, status);


--
-- TOC entry 6887 (class 1259 OID 27760)
-- Name: ix_bookings_requested_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_bookings_requested_at ON public.bookings USING btree (requested_at DESC);


--
-- TOC entry 6888 (class 1259 OID 27761)
-- Name: ix_bookings_service_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_bookings_service_type ON public.bookings USING btree (service_type);


--
-- TOC entry 6889 (class 1259 OID 27759)
-- Name: ix_bookings_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_bookings_status ON public.bookings USING btree (status);


--
-- TOC entry 6890 (class 1259 OID 27764)
-- Name: ix_bookings_status_requested; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_bookings_status_requested ON public.bookings USING btree (status, requested_at DESC);


--
-- TOC entry 6894 (class 1259 OID 27797)
-- Name: ix_bsl_booking_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_bsl_booking_created ON public.booking_status_logs USING btree (booking_id, created_at);


--
-- TOC entry 6861 (class 1259 OID 27651)
-- Name: ix_commission_configs_service_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_commission_configs_service_type ON public.commission_configs USING btree (service_type);


--
-- TOC entry 6869 (class 1259 OID 27693)
-- Name: ix_das_provider_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_das_provider_id ON public.driver_availability_sessions USING btree (provider_id);


--
-- TOC entry 6870 (class 1259 OID 27695)
-- Name: ix_das_provider_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_das_provider_status ON public.driver_availability_sessions USING btree (provider_id, status);


--
-- TOC entry 6871 (class 1259 OID 27694)
-- Name: ix_das_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_das_status ON public.driver_availability_sessions USING btree (status);


--
-- TOC entry 6872 (class 1259 OID 27696)
-- Name: ix_das_status_online_partial; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_das_status_online_partial ON public.driver_availability_sessions USING btree (provider_id) WHERE ((status)::text = 'online'::text);


--
-- TOC entry 6952 (class 1259 OID 28047)
-- Name: ix_ns_user_type_disabled; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_ns_user_type_disabled ON public.notification_settings USING btree (notification_type, user_id) WHERE (is_enabled = false);


--
-- TOC entry 6910 (class 1259 OID 27889)
-- Name: ix_payment_transactions_booking_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_payment_transactions_booking_id ON public.payment_transactions USING btree (booking_id);


--
-- TOC entry 6911 (class 1259 OID 27892)
-- Name: ix_payment_transactions_gateway_ref; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_payment_transactions_gateway_ref ON public.payment_transactions USING btree (gateway_ref) WHERE (gateway_ref IS NOT NULL);


--
-- TOC entry 6912 (class 1259 OID 27891)
-- Name: ix_payment_transactions_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_payment_transactions_status ON public.payment_transactions USING btree (status);


--
-- TOC entry 6913 (class 1259 OID 27890)
-- Name: ix_payment_transactions_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_payment_transactions_user_id ON public.payment_transactions USING btree (user_id);


--
-- TOC entry 6855 (class 1259 OID 27630)
-- Name: ix_price_configs_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_price_configs_active ON public.price_configs USING btree (is_active, effective_from);


--
-- TOC entry 6856 (class 1259 OID 27629)
-- Name: ix_price_configs_service_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_price_configs_service_type ON public.price_configs USING btree (service_type);


--
-- TOC entry 6927 (class 1259 OID 27961)
-- Name: ix_promotion_usages_booking_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_promotion_usages_booking_id ON public.promotion_usages USING btree (booking_id);


--
-- TOC entry 6928 (class 1259 OID 27959)
-- Name: ix_promotion_usages_promotion_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_promotion_usages_promotion_id ON public.promotion_usages USING btree (promotion_id);


--
-- TOC entry 6929 (class 1259 OID 27960)
-- Name: ix_promotion_usages_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_promotion_usages_user_id ON public.promotion_usages USING btree (user_id);


--
-- TOC entry 6930 (class 1259 OID 27962)
-- Name: ix_promotion_usages_user_promo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_promotion_usages_user_promo ON public.promotion_usages USING btree (user_id, promotion_id);


--
-- TOC entry 6920 (class 1259 OID 27928)
-- Name: ix_promotions_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_promotions_active ON public.promotions USING btree (is_active, valid_from, valid_to) WHERE (is_active = true);


--
-- TOC entry 6921 (class 1259 OID 27927)
-- Name: ix_promotions_active_valid; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_promotions_active_valid ON public.promotions USING btree (is_active, valid_from, valid_to);


--
-- TOC entry 6922 (class 1259 OID 27926)
-- Name: ix_promotions_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_promotions_code ON public.promotions USING btree (code);


--
-- TOC entry 6833 (class 1259 OID 27490)
-- Name: ix_provider_vehicles_provider_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_provider_vehicles_provider_id ON public.provider_vehicles USING btree (provider_id);


--
-- TOC entry 6914 (class 1259 OID 27894)
-- Name: ix_pt_booking; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_pt_booking ON public.payment_transactions USING btree (booking_id);


--
-- TOC entry 6915 (class 1259 OID 27896)
-- Name: ix_pt_pending_partial; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_pt_pending_partial ON public.payment_transactions USING btree (gateway_ref) WHERE ((status)::text = 'pending'::text);


--
-- TOC entry 6916 (class 1259 OID 27895)
-- Name: ix_pt_user_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_pt_user_created ON public.payment_transactions USING btree (user_id, created_at DESC);


--
-- TOC entry 6931 (class 1259 OID 27963)
-- Name: ix_pu_user_promotion; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_pu_user_promotion ON public.promotion_usages USING btree (user_id, promotion_id);


--
-- TOC entry 6849 (class 1259 OID 27604)
-- Name: ix_pva_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_pva_date ON public.provider_vehicle_availabilities USING btree (date);


--
-- TOC entry 6850 (class 1259 OID 27603)
-- Name: ix_pva_vehicle_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_pva_vehicle_id ON public.provider_vehicle_availabilities USING btree (vehicle_id);


--
-- TOC entry 6836 (class 1259 OID 27530)
-- Name: ix_pvd_review_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_pvd_review_status ON public.provider_vehicle_documents USING btree (review_status);


--
-- TOC entry 6837 (class 1259 OID 27529)
-- Name: ix_pvd_vehicle_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_pvd_vehicle_id ON public.provider_vehicle_documents USING btree (vehicle_id);


--
-- TOC entry 6940 (class 1259 OID 28002)
-- Name: ix_reviews_reviewer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_reviews_reviewer ON public.reviews USING btree (reviewer_id, created_at DESC);


--
-- TOC entry 6840 (class 1259 OID 27556)
-- Name: ix_service_routes_from_to; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_service_routes_from_to ON public.service_routes USING btree (from_province, to_province);


--
-- TOC entry 6841 (class 1259 OID 27555)
-- Name: ix_service_routes_svc_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_service_routes_svc_id ON public.service_routes USING btree (provider_service_id);


--
-- TOC entry 6844 (class 1259 OID 27582)
-- Name: ix_srs_route_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_srs_route_id ON public.service_route_schedules USING btree (route_id);


--
-- TOC entry 6900 (class 1259 OID 27852)
-- Name: ix_wallet_transactions_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_wallet_transactions_created_at ON public.wallet_transactions USING btree (created_at DESC);


--
-- TOC entry 6901 (class 1259 OID 27851)
-- Name: ix_wallet_transactions_reference; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_wallet_transactions_reference ON public.wallet_transactions USING btree (reference_type, reference_id);


--
-- TOC entry 6902 (class 1259 OID 27850)
-- Name: ix_wallet_transactions_wallet_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_wallet_transactions_wallet_id ON public.wallet_transactions USING btree (wallet_id);


--
-- TOC entry 6895 (class 1259 OID 27825)
-- Name: ix_wallets_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_wallets_user_id ON public.wallets USING btree (user_id);


--
-- TOC entry 6903 (class 1259 OID 27856)
-- Name: ix_wt_reference; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_wt_reference ON public.wallet_transactions USING btree (reference_id) WHERE (reference_id IS NOT NULL);


--
-- TOC entry 6904 (class 1259 OID 27857)
-- Name: ix_wt_type_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_wt_type_created ON public.wallet_transactions USING btree (type, created_at DESC);


--
-- TOC entry 6905 (class 1259 OID 27854)
-- Name: ix_wt_wallet_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_wt_wallet_created ON public.wallet_transactions USING btree (wallet_id, created_at DESC);


--
-- TOC entry 6906 (class 1259 OID 27855)
-- Name: ix_wt_wallet_type_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_wt_wallet_type_created ON public.wallet_transactions USING btree (wallet_id, type, created_at DESC);


--
-- TOC entry 6793 (class 1259 OID 27154)
-- Name: uq_provider_services_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_provider_services_unique ON public.provider_services USING btree (provider_id, industry_category_id, service_category_id, COALESCE(service_skill_id, '00000000-0000-0000-0000-000000000000'::uuid));


--
-- TOC entry 6919 (class 1259 OID 27893)
-- Name: uq_pt_gateway_ref; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_pt_gateway_ref ON public.payment_transactions USING btree (gateway_ref) WHERE (((status)::text = 'completed'::text) AND (gateway_ref IS NOT NULL) AND ((method)::text <> 'cash'::text));


--
-- TOC entry 6821 (class 1259 OID 27366)
-- Name: uq_user_identity_verifications_latest; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_user_identity_verifications_latest ON public.user_identity_verifications USING btree (user_id) WHERE (is_latest = true);


--
-- TOC entry 6718 (class 1259 OID 26633)
-- Name: uq_users_apple_sub; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_users_apple_sub ON public.users USING btree (apple_sub) WHERE (apple_sub IS NOT NULL);


--
-- TOC entry 6907 (class 1259 OID 27853)
-- Name: uq_wt_topup_gateway_ref; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_wt_topup_gateway_ref ON public.wallet_transactions USING btree (gateway_ref) WHERE (((type)::text = 'topup'::text) AND ((status)::text = 'completed'::text) AND (gateway_ref IS NOT NULL));


--
-- TOC entry 6723 (class 1259 OID 26632)
-- Name: ux_users_phone; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ux_users_phone ON public.users USING btree (phone) WHERE (phone IS NOT NULL);


--
-- TOC entry 7340 (class 2606 OID 28942)
-- Name: appointment_reschedules appointment_reschedules_appointment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointment_reschedules
    ADD CONSTRAINT appointment_reschedules_appointment_id_fkey FOREIGN KEY (appointment_id) REFERENCES public.service_appointments(id) ON DELETE CASCADE;


--
-- TOC entry 7338 (class 2606 OID 28907)
-- Name: appointment_status_logs appointment_status_logs_appointment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointment_status_logs
    ADD CONSTRAINT appointment_status_logs_appointment_id_fkey FOREIGN KEY (appointment_id) REFERENCES public.service_appointments(id) ON DELETE CASCADE;


--
-- TOC entry 7339 (class 2606 OID 28912)
-- Name: appointment_status_logs appointment_status_logs_changed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointment_status_logs
    ADD CONSTRAINT appointment_status_logs_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- TOC entry 7270 (class 2606 OID 27786)
-- Name: booking_status_logs booking_status_logs_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_status_logs
    ADD CONSTRAINT booking_status_logs_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON DELETE CASCADE;


--
-- TOC entry 7271 (class 2606 OID 27791)
-- Name: booking_status_logs booking_status_logs_changed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_status_logs
    ADD CONSTRAINT booking_status_logs_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- TOC entry 7264 (class 2606 OID 27727)
-- Name: bookings bookings_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.users(id) ON DELETE RESTRICT;


--
-- TOC entry 7265 (class 2606 OID 27732)
-- Name: bookings bookings_provider_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_provider_id_fkey FOREIGN KEY (provider_id) REFERENCES public.providers(id) ON DELETE SET NULL;


--
-- TOC entry 7266 (class 2606 OID 27747)
-- Name: bookings bookings_route_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_route_id_fkey FOREIGN KEY (route_id) REFERENCES public.service_routes(id) ON DELETE SET NULL;


--
-- TOC entry 7267 (class 2606 OID 27752)
-- Name: bookings bookings_schedule_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_schedule_id_fkey FOREIGN KEY (schedule_id) REFERENCES public.service_route_schedules(id) ON DELETE SET NULL;


--
-- TOC entry 7268 (class 2606 OID 27742)
-- Name: bookings bookings_service_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_service_category_id_fkey FOREIGN KEY (service_category_id) REFERENCES public.service_categories(id) ON DELETE RESTRICT;


--
-- TOC entry 7269 (class 2606 OID 27737)
-- Name: bookings bookings_vehicle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_vehicle_id_fkey FOREIGN KEY (vehicle_id) REFERENCES public.provider_vehicles(id) ON DELETE SET NULL;


--
-- TOC entry 7295 (class 2606 OID 28190)
-- Name: consent_logs consent_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consent_logs
    ADD CONSTRAINT consent_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 7317 (class 2606 OID 28518)
-- Name: crm_activities crm_activities_completed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_activities
    ADD CONSTRAINT crm_activities_completed_by_fkey FOREIGN KEY (completed_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- TOC entry 7318 (class 2606 OID 28503)
-- Name: crm_activities crm_activities_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_activities
    ADD CONSTRAINT crm_activities_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.crm_contacts(id) ON DELETE SET NULL;


--
-- TOC entry 7319 (class 2606 OID 28523)
-- Name: crm_activities crm_activities_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_activities
    ADD CONSTRAINT crm_activities_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- TOC entry 7320 (class 2606 OID 28513)
-- Name: crm_activities crm_activities_deal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_activities
    ADD CONSTRAINT crm_activities_deal_id_fkey FOREIGN KEY (deal_id) REFERENCES public.crm_deals(id) ON DELETE SET NULL;


--
-- TOC entry 7321 (class 2606 OID 28508)
-- Name: crm_activities crm_activities_lead_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_activities
    ADD CONSTRAINT crm_activities_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.crm_leads(id) ON DELETE SET NULL;


--
-- TOC entry 7308 (class 2606 OID 28374)
-- Name: crm_contacts crm_contacts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_contacts
    ADD CONSTRAINT crm_contacts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- TOC entry 7311 (class 2606 OID 28435)
-- Name: crm_deals crm_deals_assigned_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_deals
    ADD CONSTRAINT crm_deals_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- TOC entry 7312 (class 2606 OID 28430)
-- Name: crm_deals crm_deals_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_deals
    ADD CONSTRAINT crm_deals_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.crm_contacts(id) ON DELETE CASCADE;


--
-- TOC entry 7309 (class 2606 OID 28405)
-- Name: crm_leads crm_leads_assigned_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_leads
    ADD CONSTRAINT crm_leads_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- TOC entry 7310 (class 2606 OID 28400)
-- Name: crm_leads crm_leads_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_leads
    ADD CONSTRAINT crm_leads_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.crm_contacts(id) ON DELETE CASCADE;


--
-- TOC entry 7313 (class 2606 OID 28476)
-- Name: crm_tasks crm_tasks_assigned_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_tasks
    ADD CONSTRAINT crm_tasks_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- TOC entry 7314 (class 2606 OID 28461)
-- Name: crm_tasks crm_tasks_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_tasks
    ADD CONSTRAINT crm_tasks_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.crm_contacts(id) ON DELETE SET NULL;


--
-- TOC entry 7315 (class 2606 OID 28466)
-- Name: crm_tasks crm_tasks_deal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_tasks
    ADD CONSTRAINT crm_tasks_deal_id_fkey FOREIGN KEY (deal_id) REFERENCES public.crm_deals(id) ON DELETE SET NULL;


--
-- TOC entry 7316 (class 2606 OID 28471)
-- Name: crm_tasks crm_tasks_lead_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_tasks
    ADD CONSTRAINT crm_tasks_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.crm_leads(id) ON DELETE SET NULL;


--
-- TOC entry 7296 (class 2606 OID 28217)
-- Name: data_deletion_requests data_deletion_requests_processed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.data_deletion_requests
    ADD CONSTRAINT data_deletion_requests_processed_by_fkey FOREIGN KEY (processed_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- TOC entry 7297 (class 2606 OID 28212)
-- Name: data_deletion_requests data_deletion_requests_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.data_deletion_requests
    ADD CONSTRAINT data_deletion_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE RESTRICT;


--
-- TOC entry 7262 (class 2606 OID 27683)
-- Name: driver_availability_sessions driver_availability_sessions_provider_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.driver_availability_sessions
    ADD CONSTRAINT driver_availability_sessions_provider_id_fkey FOREIGN KEY (provider_id) REFERENCES public.providers(id) ON DELETE CASCADE;


--
-- TOC entry 7263 (class 2606 OID 27688)
-- Name: driver_availability_sessions driver_availability_sessions_vehicle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.driver_availability_sessions
    ADD CONSTRAINT driver_availability_sessions_vehicle_id_fkey FOREIGN KEY (vehicle_id) REFERENCES public.provider_vehicles(id) ON DELETE SET NULL;


--
-- TOC entry 7261 (class 2606 OID 27664)
-- Name: driver_locations driver_locations_provider_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.driver_locations
    ADD CONSTRAINT driver_locations_provider_id_fkey FOREIGN KEY (provider_id) REFERENCES public.providers(id) ON DELETE CASCADE;


--
-- TOC entry 7323 (class 2606 OID 28584)
-- Name: chat_conversations fk_chat_conv_booking; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_conversations
    ADD CONSTRAINT fk_chat_conv_booking FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON DELETE CASCADE;


--
-- TOC entry 7324 (class 2606 OID 28589)
-- Name: chat_conversations fk_chat_conv_customer; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_conversations
    ADD CONSTRAINT fk_chat_conv_customer FOREIGN KEY (customer_id) REFERENCES public.users(id) ON DELETE RESTRICT;


--
-- TOC entry 7325 (class 2606 OID 28594)
-- Name: chat_conversations fk_chat_conv_provider; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_conversations
    ADD CONSTRAINT fk_chat_conv_provider FOREIGN KEY (provider_id) REFERENCES public.users(id) ON DELETE RESTRICT;


--
-- TOC entry 7326 (class 2606 OID 28617)
-- Name: chat_messages fk_chat_msg_conversation; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_messages
    ADD CONSTRAINT fk_chat_msg_conversation FOREIGN KEY (conversation_id) REFERENCES public.chat_conversations(id) ON DELETE CASCADE;


--
-- TOC entry 7327 (class 2606 OID 28622)
-- Name: chat_messages fk_chat_msg_sender; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_messages
    ADD CONSTRAINT fk_chat_msg_sender FOREIGN KEY (sender_id) REFERENCES public.users(id) ON DELETE RESTRICT;


--
-- TOC entry 7357 (class 2606 OID 29278)
-- Name: reservation_requests fk_reservation_requests_selected_option; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reservation_requests
    ADD CONSTRAINT fk_reservation_requests_selected_option FOREIGN KEY (selected_option_id) REFERENCES public.reservation_request_options(id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 7279 (class 2606 OID 29199)
-- Name: reviews fk_reviews_appointment; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT fk_reviews_appointment FOREIGN KEY (appointment_id) REFERENCES public.service_appointments(id) ON DELETE CASCADE;


--
-- TOC entry 7358 (class 2606 OID 29358)
-- Name: reservation_requests fk_rr_selected_option; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reservation_requests
    ADD CONSTRAINT fk_rr_selected_option FOREIGN KEY (selected_option_id) REFERENCES public.reservation_request_options(id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 7328 (class 2606 OID 28640)
-- Name: user_presence fk_user_presence_user; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_presence
    ADD CONSTRAINT fk_user_presence_user FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 7190 (class 2606 OID 27443)
-- Name: users fk_users_latest_identity_verification; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT fk_users_latest_identity_verification FOREIGN KEY (latest_identity_verification_id) REFERENCES public.user_identity_verifications(id);


--
-- TOC entry 7373 (class 2606 OID 29442)
-- Name: food_menu_categories food_menu_categories_merchant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.food_menu_categories
    ADD CONSTRAINT food_menu_categories_merchant_id_fkey FOREIGN KEY (merchant_id) REFERENCES public.food_merchants(id) ON DELETE CASCADE;


--
-- TOC entry 7376 (class 2606 OID 29489)
-- Name: food_menu_item_options food_menu_item_options_menu_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.food_menu_item_options
    ADD CONSTRAINT food_menu_item_options_menu_item_id_fkey FOREIGN KEY (menu_item_id) REFERENCES public.food_menu_items(id) ON DELETE CASCADE;


--
-- TOC entry 7374 (class 2606 OID 29471)
-- Name: food_menu_items food_menu_items_menu_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.food_menu_items
    ADD CONSTRAINT food_menu_items_menu_category_id_fkey FOREIGN KEY (menu_category_id) REFERENCES public.food_menu_categories(id) ON DELETE SET NULL;


--
-- TOC entry 7375 (class 2606 OID 29466)
-- Name: food_menu_items food_menu_items_merchant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.food_menu_items
    ADD CONSTRAINT food_menu_items_merchant_id_fkey FOREIGN KEY (merchant_id) REFERENCES public.food_merchants(id) ON DELETE CASCADE;


--
-- TOC entry 7371 (class 2606 OID 29419)
-- Name: food_merchant_documents food_merchant_documents_merchant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.food_merchant_documents
    ADD CONSTRAINT food_merchant_documents_merchant_id_fkey FOREIGN KEY (merchant_id) REFERENCES public.food_merchants(id) ON DELETE CASCADE;


--
-- TOC entry 7372 (class 2606 OID 29424)
-- Name: food_merchant_documents food_merchant_documents_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.food_merchant_documents
    ADD CONSTRAINT food_merchant_documents_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.users(id);


--
-- TOC entry 7369 (class 2606 OID 29391)
-- Name: food_merchants food_merchants_provider_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.food_merchants
    ADD CONSTRAINT food_merchants_provider_id_fkey FOREIGN KEY (provider_id) REFERENCES public.providers(id) ON DELETE CASCADE;


--
-- TOC entry 7370 (class 2606 OID 29396)
-- Name: food_merchants food_merchants_verified_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.food_merchants
    ADD CONSTRAINT food_merchants_verified_by_fkey FOREIGN KEY (verified_by) REFERENCES public.users(id);


--
-- TOC entry 7382 (class 2606 OID 29567)
-- Name: food_order_items food_order_items_menu_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.food_order_items
    ADD CONSTRAINT food_order_items_menu_item_id_fkey FOREIGN KEY (menu_item_id) REFERENCES public.food_menu_items(id);


--
-- TOC entry 7383 (class 2606 OID 29562)
-- Name: food_order_items food_order_items_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.food_order_items
    ADD CONSTRAINT food_order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.food_orders(id) ON DELETE CASCADE;


--
-- TOC entry 7384 (class 2606 OID 29590)
-- Name: food_order_status_logs food_order_status_logs_changed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.food_order_status_logs
    ADD CONSTRAINT food_order_status_logs_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES public.users(id);


--
-- TOC entry 7385 (class 2606 OID 29585)
-- Name: food_order_status_logs food_order_status_logs_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.food_order_status_logs
    ADD CONSTRAINT food_order_status_logs_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.food_orders(id) ON DELETE CASCADE;


--
-- TOC entry 7377 (class 2606 OID 29520)
-- Name: food_orders food_orders_customer_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.food_orders
    ADD CONSTRAINT food_orders_customer_user_id_fkey FOREIGN KEY (customer_user_id) REFERENCES public.users(id);


--
-- TOC entry 7378 (class 2606 OID 29525)
-- Name: food_orders food_orders_merchant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.food_orders
    ADD CONSTRAINT food_orders_merchant_id_fkey FOREIGN KEY (merchant_id) REFERENCES public.food_merchants(id);


--
-- TOC entry 7379 (class 2606 OID 29535)
-- Name: food_orders food_orders_merchant_service_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.food_orders
    ADD CONSTRAINT food_orders_merchant_service_id_fkey FOREIGN KEY (merchant_service_id) REFERENCES public.provider_services(id);


--
-- TOC entry 7380 (class 2606 OID 29530)
-- Name: food_orders food_orders_shipper_provider_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.food_orders
    ADD CONSTRAINT food_orders_shipper_provider_id_fkey FOREIGN KEY (shipper_provider_id) REFERENCES public.providers(id);


--
-- TOC entry 7381 (class 2606 OID 29540)
-- Name: food_orders food_orders_shipper_service_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.food_orders
    ADD CONSTRAINT food_orders_shipper_service_id_fkey FOREIGN KEY (shipper_service_id) REFERENCES public.provider_services(id);


--
-- TOC entry 7386 (class 2606 OID 29618)
-- Name: food_ratings food_ratings_customer_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.food_ratings
    ADD CONSTRAINT food_ratings_customer_user_id_fkey FOREIGN KEY (customer_user_id) REFERENCES public.users(id);


--
-- TOC entry 7387 (class 2606 OID 29613)
-- Name: food_ratings food_ratings_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.food_ratings
    ADD CONSTRAINT food_ratings_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.food_orders(id) ON DELETE CASCADE;


--
-- TOC entry 7211 (class 2606 OID 26936)
-- Name: industry_categories industry_categories_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.industry_categories
    ADD CONSTRAINT industry_categories_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- TOC entry 7212 (class 2606 OID 26941)
-- Name: industry_categories industry_categories_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.industry_categories
    ADD CONSTRAINT industry_categories_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- TOC entry 7351 (class 2606 OID 29123)
-- Name: job_request_attachments job_request_attachments_job_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_request_attachments
    ADD CONSTRAINT job_request_attachments_job_request_id_fkey FOREIGN KEY (job_request_id) REFERENCES public.job_requests(id) ON DELETE CASCADE;


--
-- TOC entry 7352 (class 2606 OID 29128)
-- Name: job_request_attachments job_request_attachments_uploaded_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_request_attachments
    ADD CONSTRAINT job_request_attachments_uploaded_by_user_id_fkey FOREIGN KEY (uploaded_by_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- TOC entry 7353 (class 2606 OID 29155)
-- Name: job_request_quotes job_request_quotes_job_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_request_quotes
    ADD CONSTRAINT job_request_quotes_job_request_id_fkey FOREIGN KEY (job_request_id) REFERENCES public.job_requests(id) ON DELETE CASCADE;


--
-- TOC entry 7354 (class 2606 OID 29160)
-- Name: job_request_quotes job_request_quotes_provider_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_request_quotes
    ADD CONSTRAINT job_request_quotes_provider_id_fkey FOREIGN KEY (provider_id) REFERENCES public.providers(id) ON DELETE CASCADE;


--
-- TOC entry 7355 (class 2606 OID 29186)
-- Name: job_request_status_logs job_request_status_logs_changed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_request_status_logs
    ADD CONSTRAINT job_request_status_logs_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- TOC entry 7356 (class 2606 OID 29181)
-- Name: job_request_status_logs job_request_status_logs_job_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_request_status_logs
    ADD CONSTRAINT job_request_status_logs_job_request_id_fkey FOREIGN KEY (job_request_id) REFERENCES public.job_requests(id) ON DELETE CASCADE;


--
-- TOC entry 7348 (class 2606 OID 29088)
-- Name: job_requests job_requests_customer_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_requests
    ADD CONSTRAINT job_requests_customer_user_id_fkey FOREIGN KEY (customer_user_id) REFERENCES public.users(id) ON DELETE RESTRICT;


--
-- TOC entry 7349 (class 2606 OID 29093)
-- Name: job_requests job_requests_provider_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_requests
    ADD CONSTRAINT job_requests_provider_id_fkey FOREIGN KEY (provider_id) REFERENCES public.providers(id) ON DELETE SET NULL;


--
-- TOC entry 7350 (class 2606 OID 29098)
-- Name: job_requests job_requests_provider_service_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_requests
    ADD CONSTRAINT job_requests_provider_service_id_fkey FOREIGN KEY (provider_service_id) REFERENCES public.provider_services(id) ON DELETE SET NULL;


--
-- TOC entry 7322 (class 2606 OID 28561)
-- Name: notification_campaigns notification_campaigns_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_campaigns
    ADD CONSTRAINT notification_campaigns_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- TOC entry 7285 (class 2606 OID 28042)
-- Name: notification_settings notification_settings_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_settings
    ADD CONSTRAINT notification_settings_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 7284 (class 2606 OID 28019)
-- Name: notifications notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 7274 (class 2606 OID 27879)
-- Name: payment_transactions payment_transactions_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_transactions
    ADD CONSTRAINT payment_transactions_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON DELETE RESTRICT;


--
-- TOC entry 7275 (class 2606 OID 27884)
-- Name: payment_transactions payment_transactions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_transactions
    ADD CONSTRAINT payment_transactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE RESTRICT;


--
-- TOC entry 7286 (class 2606 OID 28070)
-- Name: post_categories post_categories_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.post_categories
    ADD CONSTRAINT post_categories_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- TOC entry 7287 (class 2606 OID 28075)
-- Name: post_categories post_categories_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.post_categories
    ADD CONSTRAINT post_categories_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- TOC entry 7294 (class 2606 OID 28160)
-- Name: post_media post_media_post_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.post_media
    ADD CONSTRAINT post_media_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.posts(id) ON DELETE CASCADE;


--
-- TOC entry 7288 (class 2606 OID 28118)
-- Name: posts posts_author_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.posts
    ADD CONSTRAINT posts_author_user_id_fkey FOREIGN KEY (author_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- TOC entry 7289 (class 2606 OID 28113)
-- Name: posts posts_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.posts
    ADD CONSTRAINT posts_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.post_categories(id) ON DELETE SET NULL;


--
-- TOC entry 7290 (class 2606 OID 28128)
-- Name: posts posts_industry_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.posts
    ADD CONSTRAINT posts_industry_category_id_fkey FOREIGN KEY (industry_category_id) REFERENCES public.industry_categories(id) ON DELETE SET NULL;


--
-- TOC entry 7291 (class 2606 OID 28123)
-- Name: posts posts_provider_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.posts
    ADD CONSTRAINT posts_provider_id_fkey FOREIGN KEY (provider_id) REFERENCES public.providers(id) ON DELETE SET NULL;


--
-- TOC entry 7292 (class 2606 OID 28133)
-- Name: posts posts_service_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.posts
    ADD CONSTRAINT posts_service_category_id_fkey FOREIGN KEY (service_category_id) REFERENCES public.service_categories(id) ON DELETE SET NULL;


--
-- TOC entry 7293 (class 2606 OID 28138)
-- Name: posts posts_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.posts
    ADD CONSTRAINT posts_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- TOC entry 7276 (class 2606 OID 27954)
-- Name: promotion_usages promotion_usages_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promotion_usages
    ADD CONSTRAINT promotion_usages_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON DELETE RESTRICT;


--
-- TOC entry 7277 (class 2606 OID 27944)
-- Name: promotion_usages promotion_usages_promotion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promotion_usages
    ADD CONSTRAINT promotion_usages_promotion_id_fkey FOREIGN KEY (promotion_id) REFERENCES public.promotions(id) ON DELETE RESTRICT;


--
-- TOC entry 7278 (class 2606 OID 27949)
-- Name: promotion_usages promotion_usages_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promotion_usages
    ADD CONSTRAINT promotion_usages_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE RESTRICT;


--
-- TOC entry 7202 (class 2606 OID 26830)
-- Name: provider_business_profiles provider_business_profiles_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.provider_business_profiles
    ADD CONSTRAINT provider_business_profiles_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- TOC entry 7203 (class 2606 OID 26825)
-- Name: provider_business_profiles provider_business_profiles_provider_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.provider_business_profiles
    ADD CONSTRAINT provider_business_profiles_provider_id_fkey FOREIGN KEY (provider_id) REFERENCES public.providers(id) ON DELETE CASCADE;


--
-- TOC entry 7204 (class 2606 OID 26835)
-- Name: provider_business_profiles provider_business_profiles_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.provider_business_profiles
    ADD CONSTRAINT provider_business_profiles_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- TOC entry 7332 (class 2606 OID 28708)
-- Name: provider_contact_request_logs provider_contact_request_logs_changed_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.provider_contact_request_logs
    ADD CONSTRAINT provider_contact_request_logs_changed_by_user_id_fkey FOREIGN KEY (changed_by_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- TOC entry 7333 (class 2606 OID 28703)
-- Name: provider_contact_request_logs provider_contact_request_logs_contact_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.provider_contact_request_logs
    ADD CONSTRAINT provider_contact_request_logs_contact_request_id_fkey FOREIGN KEY (contact_request_id) REFERENCES public.provider_contact_requests(id) ON DELETE CASCADE;


--
-- TOC entry 7329 (class 2606 OID 28670)
-- Name: provider_contact_requests provider_contact_requests_customer_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.provider_contact_requests
    ADD CONSTRAINT provider_contact_requests_customer_user_id_fkey FOREIGN KEY (customer_user_id) REFERENCES public.users(id) ON DELETE RESTRICT;


--
-- TOC entry 7330 (class 2606 OID 28675)
-- Name: provider_contact_requests provider_contact_requests_provider_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.provider_contact_requests
    ADD CONSTRAINT provider_contact_requests_provider_id_fkey FOREIGN KEY (provider_id) REFERENCES public.providers(id) ON DELETE RESTRICT;


--
-- TOC entry 7331 (class 2606 OID 28680)
-- Name: provider_contact_requests provider_contact_requests_provider_service_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.provider_contact_requests
    ADD CONSTRAINT provider_contact_requests_provider_service_id_fkey FOREIGN KEY (provider_service_id) REFERENCES public.provider_services(id) ON DELETE SET NULL;


--
-- TOC entry 7233 (class 2606 OID 27191)
-- Name: provider_document_services provider_document_services_provider_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.provider_document_services
    ADD CONSTRAINT provider_document_services_provider_document_id_fkey FOREIGN KEY (provider_document_id) REFERENCES public.provider_documents(id) ON DELETE CASCADE;


--
-- TOC entry 7234 (class 2606 OID 27196)
-- Name: provider_document_services provider_document_services_provider_service_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.provider_document_services
    ADD CONSTRAINT provider_document_services_provider_service_id_fkey FOREIGN KEY (provider_service_id) REFERENCES public.provider_services(id) ON DELETE CASCADE;


--
-- TOC entry 7205 (class 2606 OID 26868)
-- Name: provider_documents provider_documents_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.provider_documents
    ADD CONSTRAINT provider_documents_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- TOC entry 7206 (class 2606 OID 26858)
-- Name: provider_documents provider_documents_provider_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.provider_documents
    ADD CONSTRAINT provider_documents_provider_id_fkey FOREIGN KEY (provider_id) REFERENCES public.providers(id) ON DELETE CASCADE;


--
-- TOC entry 7207 (class 2606 OID 26863)
-- Name: provider_documents provider_documents_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.provider_documents
    ADD CONSTRAINT provider_documents_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.users(id);


--
-- TOC entry 7208 (class 2606 OID 26873)
-- Name: provider_documents provider_documents_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.provider_documents
    ADD CONSTRAINT provider_documents_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- TOC entry 7238 (class 2606 OID 27287)
-- Name: provider_import_job_rows provider_import_job_rows_job_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.provider_import_job_rows
    ADD CONSTRAINT provider_import_job_rows_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.provider_import_jobs(id) ON DELETE CASCADE;


--
-- TOC entry 7239 (class 2606 OID 27292)
-- Name: provider_import_job_rows provider_import_job_rows_mapped_industry_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.provider_import_job_rows
    ADD CONSTRAINT provider_import_job_rows_mapped_industry_category_id_fkey FOREIGN KEY (mapped_industry_category_id) REFERENCES public.industry_categories(id) ON DELETE SET NULL;


--
-- TOC entry 7240 (class 2606 OID 27297)
-- Name: provider_import_job_rows provider_import_job_rows_mapped_service_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.provider_import_job_rows
    ADD CONSTRAINT provider_import_job_rows_mapped_service_category_id_fkey FOREIGN KEY (mapped_service_category_id) REFERENCES public.service_categories(id) ON DELETE SET NULL;


--
-- TOC entry 7237 (class 2606 OID 27263)
-- Name: provider_import_jobs provider_import_jobs_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.provider_import_jobs
    ADD CONSTRAINT provider_import_jobs_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- TOC entry 7241 (class 2606 OID 27321)
-- Name: provider_import_metadata provider_import_metadata_import_job_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.provider_import_metadata
    ADD CONSTRAINT provider_import_metadata_import_job_id_fkey FOREIGN KEY (import_job_id) REFERENCES public.provider_import_jobs(id) ON DELETE SET NULL;


--
-- TOC entry 7242 (class 2606 OID 27316)
-- Name: provider_import_metadata provider_import_metadata_provider_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.provider_import_metadata
    ADD CONSTRAINT provider_import_metadata_provider_id_fkey FOREIGN KEY (provider_id) REFERENCES public.providers(id) ON DELETE CASCADE;


--
-- TOC entry 7199 (class 2606 OID 26802)
-- Name: provider_individual_profiles provider_individual_profiles_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.provider_individual_profiles
    ADD CONSTRAINT provider_individual_profiles_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- TOC entry 7200 (class 2606 OID 26797)
-- Name: provider_individual_profiles provider_individual_profiles_provider_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.provider_individual_profiles
    ADD CONSTRAINT provider_individual_profiles_provider_id_fkey FOREIGN KEY (provider_id) REFERENCES public.providers(id) ON DELETE CASCADE;


--
-- TOC entry 7201 (class 2606 OID 26807)
-- Name: provider_individual_profiles provider_individual_profiles_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.provider_individual_profiles
    ADD CONSTRAINT provider_individual_profiles_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- TOC entry 7235 (class 2606 OID 27224)
-- Name: provider_locations provider_locations_provider_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.provider_locations
    ADD CONSTRAINT provider_locations_provider_id_fkey FOREIGN KEY (provider_id) REFERENCES public.providers(id) ON DELETE CASCADE;


--
-- TOC entry 7236 (class 2606 OID 27229)
-- Name: provider_locations provider_locations_provider_service_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.provider_locations
    ADD CONSTRAINT provider_locations_provider_service_id_fkey FOREIGN KEY (provider_service_id) REFERENCES public.provider_services(id) ON DELETE CASCADE;


--
-- TOC entry 7231 (class 2606 OID 27173)
-- Name: provider_service_attributes provider_service_attributes_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.provider_service_attributes
    ADD CONSTRAINT provider_service_attributes_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- TOC entry 7232 (class 2606 OID 27168)
-- Name: provider_service_attributes provider_service_attributes_provider_service_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.provider_service_attributes
    ADD CONSTRAINT provider_service_attributes_provider_service_id_fkey FOREIGN KEY (provider_service_id) REFERENCES public.provider_services(id) ON DELETE CASCADE;


--
-- TOC entry 7225 (class 2606 OID 27144)
-- Name: provider_services provider_services_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.provider_services
    ADD CONSTRAINT provider_services_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- TOC entry 7226 (class 2606 OID 27129)
-- Name: provider_services provider_services_industry_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.provider_services
    ADD CONSTRAINT provider_services_industry_category_id_fkey FOREIGN KEY (industry_category_id) REFERENCES public.industry_categories(id) ON DELETE RESTRICT;


--
-- TOC entry 7227 (class 2606 OID 27124)
-- Name: provider_services provider_services_provider_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.provider_services
    ADD CONSTRAINT provider_services_provider_id_fkey FOREIGN KEY (provider_id) REFERENCES public.providers(id) ON DELETE CASCADE;


--
-- TOC entry 7228 (class 2606 OID 27134)
-- Name: provider_services provider_services_service_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.provider_services
    ADD CONSTRAINT provider_services_service_category_id_fkey FOREIGN KEY (service_category_id) REFERENCES public.service_categories(id) ON DELETE RESTRICT;


--
-- TOC entry 7229 (class 2606 OID 27139)
-- Name: provider_services provider_services_service_skill_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.provider_services
    ADD CONSTRAINT provider_services_service_skill_id_fkey FOREIGN KEY (service_skill_id) REFERENCES public.service_skills(id) ON DELETE RESTRICT;


--
-- TOC entry 7230 (class 2606 OID 27149)
-- Name: provider_services provider_services_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.provider_services
    ADD CONSTRAINT provider_services_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- TOC entry 7209 (class 2606 OID 26896)
-- Name: provider_status_logs provider_status_logs_changed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.provider_status_logs
    ADD CONSTRAINT provider_status_logs_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES public.users(id);


--
-- TOC entry 7210 (class 2606 OID 26891)
-- Name: provider_status_logs provider_status_logs_provider_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.provider_status_logs
    ADD CONSTRAINT provider_status_logs_provider_id_fkey FOREIGN KEY (provider_id) REFERENCES public.providers(id) ON DELETE CASCADE;


--
-- TOC entry 7260 (class 2606 OID 27598)
-- Name: provider_vehicle_availabilities provider_vehicle_availabilities_vehicle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.provider_vehicle_availabilities
    ADD CONSTRAINT provider_vehicle_availabilities_vehicle_id_fkey FOREIGN KEY (vehicle_id) REFERENCES public.provider_vehicles(id) ON DELETE CASCADE;


--
-- TOC entry 7254 (class 2606 OID 27519)
-- Name: provider_vehicle_documents provider_vehicle_documents_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.provider_vehicle_documents
    ADD CONSTRAINT provider_vehicle_documents_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- TOC entry 7255 (class 2606 OID 27514)
-- Name: provider_vehicle_documents provider_vehicle_documents_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.provider_vehicle_documents
    ADD CONSTRAINT provider_vehicle_documents_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- TOC entry 7256 (class 2606 OID 27524)
-- Name: provider_vehicle_documents provider_vehicle_documents_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.provider_vehicle_documents
    ADD CONSTRAINT provider_vehicle_documents_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- TOC entry 7257 (class 2606 OID 27509)
-- Name: provider_vehicle_documents provider_vehicle_documents_vehicle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.provider_vehicle_documents
    ADD CONSTRAINT provider_vehicle_documents_vehicle_id_fkey FOREIGN KEY (vehicle_id) REFERENCES public.provider_vehicles(id) ON DELETE CASCADE;


--
-- TOC entry 7250 (class 2606 OID 27480)
-- Name: provider_vehicles provider_vehicles_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.provider_vehicles
    ADD CONSTRAINT provider_vehicles_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- TOC entry 7251 (class 2606 OID 27470)
-- Name: provider_vehicles provider_vehicles_provider_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.provider_vehicles
    ADD CONSTRAINT provider_vehicles_provider_id_fkey FOREIGN KEY (provider_id) REFERENCES public.providers(id) ON DELETE CASCADE;


--
-- TOC entry 7252 (class 2606 OID 27475)
-- Name: provider_vehicles provider_vehicles_service_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.provider_vehicles
    ADD CONSTRAINT provider_vehicles_service_id_fkey FOREIGN KEY (service_id) REFERENCES public.provider_services(id) ON DELETE SET NULL;


--
-- TOC entry 7253 (class 2606 OID 27485)
-- Name: provider_vehicles provider_vehicles_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.provider_vehicles
    ADD CONSTRAINT provider_vehicles_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- TOC entry 7196 (class 2606 OID 26777)
-- Name: providers providers_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.providers
    ADD CONSTRAINT providers_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- TOC entry 7197 (class 2606 OID 26772)
-- Name: providers providers_owner_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.providers
    ADD CONSTRAINT providers_owner_user_id_fkey FOREIGN KEY (owner_user_id) REFERENCES public.users(id) ON DELETE RESTRICT;


--
-- TOC entry 7198 (class 2606 OID 26782)
-- Name: providers providers_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.providers
    ADD CONSTRAINT providers_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- TOC entry 7195 (class 2606 OID 26738)
-- Name: refresh_tokens refresh_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refresh_tokens
    ADD CONSTRAINT refresh_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 7362 (class 2606 OID 29270)
-- Name: reservation_request_options reservation_request_options_provider_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reservation_request_options
    ADD CONSTRAINT reservation_request_options_provider_id_fkey FOREIGN KEY (provider_id) REFERENCES public.providers(id) ON DELETE CASCADE;


--
-- TOC entry 7363 (class 2606 OID 29265)
-- Name: reservation_request_options reservation_request_options_reservation_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reservation_request_options
    ADD CONSTRAINT reservation_request_options_reservation_request_id_fkey FOREIGN KEY (reservation_request_id) REFERENCES public.reservation_requests(id) ON DELETE CASCADE;


--
-- TOC entry 7364 (class 2606 OID 29301)
-- Name: reservation_request_status_logs reservation_request_status_logs_changed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reservation_request_status_logs
    ADD CONSTRAINT reservation_request_status_logs_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- TOC entry 7365 (class 2606 OID 29296)
-- Name: reservation_request_status_logs reservation_request_status_logs_reservation_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reservation_request_status_logs
    ADD CONSTRAINT reservation_request_status_logs_reservation_request_id_fkey FOREIGN KEY (reservation_request_id) REFERENCES public.reservation_requests(id) ON DELETE CASCADE;


--
-- TOC entry 7359 (class 2606 OID 29226)
-- Name: reservation_requests reservation_requests_customer_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reservation_requests
    ADD CONSTRAINT reservation_requests_customer_user_id_fkey FOREIGN KEY (customer_user_id) REFERENCES public.users(id) ON DELETE RESTRICT;


--
-- TOC entry 7360 (class 2606 OID 29231)
-- Name: reservation_requests reservation_requests_provider_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reservation_requests
    ADD CONSTRAINT reservation_requests_provider_id_fkey FOREIGN KEY (provider_id) REFERENCES public.providers(id) ON DELETE SET NULL;


--
-- TOC entry 7361 (class 2606 OID 29236)
-- Name: reservation_requests reservation_requests_provider_service_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reservation_requests
    ADD CONSTRAINT reservation_requests_provider_service_id_fkey FOREIGN KEY (provider_service_id) REFERENCES public.provider_services(id) ON DELETE SET NULL;


--
-- TOC entry 7280 (class 2606 OID 27985)
-- Name: reviews reviews_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON DELETE CASCADE;


--
-- TOC entry 7281 (class 2606 OID 27995)
-- Name: reviews reviews_reviewee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_reviewee_id_fkey FOREIGN KEY (reviewee_id) REFERENCES public.users(id) ON DELETE RESTRICT;


--
-- TOC entry 7282 (class 2606 OID 27990)
-- Name: reviews reviews_reviewer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_reviewer_id_fkey FOREIGN KEY (reviewer_id) REFERENCES public.users(id) ON DELETE RESTRICT;


--
-- TOC entry 7283 (class 2606 OID 29345)
-- Name: reviews reviews_tutor_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_tutor_request_id_fkey FOREIGN KEY (tutor_request_id) REFERENCES public.tutor_requests(id) ON DELETE CASCADE;


--
-- TOC entry 7335 (class 2606 OID 28872)
-- Name: service_appointments service_appointments_customer_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_appointments
    ADD CONSTRAINT service_appointments_customer_user_id_fkey FOREIGN KEY (customer_user_id) REFERENCES public.users(id) ON DELETE RESTRICT;


--
-- TOC entry 7336 (class 2606 OID 28877)
-- Name: service_appointments service_appointments_provider_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_appointments
    ADD CONSTRAINT service_appointments_provider_id_fkey FOREIGN KEY (provider_id) REFERENCES public.providers(id) ON DELETE RESTRICT;


--
-- TOC entry 7337 (class 2606 OID 28882)
-- Name: service_appointments service_appointments_provider_service_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_appointments
    ADD CONSTRAINT service_appointments_provider_service_id_fkey FOREIGN KEY (provider_service_id) REFERENCES public.provider_services(id) ON DELETE RESTRICT;


--
-- TOC entry 7213 (class 2606 OID 26969)
-- Name: service_categories service_categories_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_categories
    ADD CONSTRAINT service_categories_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- TOC entry 7214 (class 2606 OID 26964)
-- Name: service_categories service_categories_industry_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_categories
    ADD CONSTRAINT service_categories_industry_category_id_fkey FOREIGN KEY (industry_category_id) REFERENCES public.industry_categories(id) ON DELETE CASCADE;


--
-- TOC entry 7215 (class 2606 OID 26974)
-- Name: service_categories service_categories_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_categories
    ADD CONSTRAINT service_categories_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- TOC entry 7219 (class 2606 OID 27045)
-- Name: service_category_attributes service_category_attributes_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_category_attributes
    ADD CONSTRAINT service_category_attributes_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- TOC entry 7220 (class 2606 OID 27040)
-- Name: service_category_attributes service_category_attributes_service_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_category_attributes
    ADD CONSTRAINT service_category_attributes_service_category_id_fkey FOREIGN KEY (service_category_id) REFERENCES public.service_categories(id) ON DELETE CASCADE;


--
-- TOC entry 7221 (class 2606 OID 27050)
-- Name: service_category_attributes service_category_attributes_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_category_attributes
    ADD CONSTRAINT service_category_attributes_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- TOC entry 7222 (class 2606 OID 27086)
-- Name: service_category_requirements service_category_requirements_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_category_requirements
    ADD CONSTRAINT service_category_requirements_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- TOC entry 7223 (class 2606 OID 27081)
-- Name: service_category_requirements service_category_requirements_service_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_category_requirements
    ADD CONSTRAINT service_category_requirements_service_category_id_fkey FOREIGN KEY (service_category_id) REFERENCES public.service_categories(id) ON DELETE CASCADE;


--
-- TOC entry 7224 (class 2606 OID 27091)
-- Name: service_category_requirements service_category_requirements_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_category_requirements
    ADD CONSTRAINT service_category_requirements_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- TOC entry 7259 (class 2606 OID 27577)
-- Name: service_route_schedules service_route_schedules_route_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_route_schedules
    ADD CONSTRAINT service_route_schedules_route_id_fkey FOREIGN KEY (route_id) REFERENCES public.service_routes(id) ON DELETE CASCADE;


--
-- TOC entry 7258 (class 2606 OID 27550)
-- Name: service_routes service_routes_provider_service_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_routes
    ADD CONSTRAINT service_routes_provider_service_id_fkey FOREIGN KEY (provider_service_id) REFERENCES public.provider_services(id) ON DELETE CASCADE;


--
-- TOC entry 7216 (class 2606 OID 27004)
-- Name: service_skills service_skills_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_skills
    ADD CONSTRAINT service_skills_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- TOC entry 7217 (class 2606 OID 26999)
-- Name: service_skills service_skills_service_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_skills
    ADD CONSTRAINT service_skills_service_category_id_fkey FOREIGN KEY (service_category_id) REFERENCES public.service_categories(id) ON DELETE CASCADE;


--
-- TOC entry 7218 (class 2606 OID 27009)
-- Name: service_skills service_skills_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_skills
    ADD CONSTRAINT service_skills_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- TOC entry 7334 (class 2606 OID 28843)
-- Name: setting_audit_logs setting_audit_logs_setting_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.setting_audit_logs
    ADD CONSTRAINT setting_audit_logs_setting_id_fkey FOREIGN KEY (setting_id) REFERENCES public.core_settings(id) ON DELETE CASCADE;


--
-- TOC entry 7306 (class 2606 OID 28349)
-- Name: support_ticket_messages support_ticket_messages_sender_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_ticket_messages
    ADD CONSTRAINT support_ticket_messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES public.users(id) ON DELETE RESTRICT;


--
-- TOC entry 7307 (class 2606 OID 28344)
-- Name: support_ticket_messages support_ticket_messages_ticket_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_ticket_messages
    ADD CONSTRAINT support_ticket_messages_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.support_tickets(id) ON DELETE CASCADE;


--
-- TOC entry 7302 (class 2606 OID 28312)
-- Name: support_tickets support_tickets_assigned_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_tickets
    ADD CONSTRAINT support_tickets_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- TOC entry 7303 (class 2606 OID 28307)
-- Name: support_tickets support_tickets_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_tickets
    ADD CONSTRAINT support_tickets_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON DELETE SET NULL;


--
-- TOC entry 7304 (class 2606 OID 28317)
-- Name: support_tickets support_tickets_resolved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_tickets
    ADD CONSTRAINT support_tickets_resolved_by_fkey FOREIGN KEY (resolved_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- TOC entry 7305 (class 2606 OID 28302)
-- Name: support_tickets support_tickets_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_tickets
    ADD CONSTRAINT support_tickets_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE RESTRICT;


--
-- TOC entry 7366 (class 2606 OID 29332)
-- Name: tutor_request_applications tutor_request_applications_provider_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tutor_request_applications
    ADD CONSTRAINT tutor_request_applications_provider_id_fkey FOREIGN KEY (provider_id) REFERENCES public.providers(id) ON DELETE CASCADE;


--
-- TOC entry 7367 (class 2606 OID 29337)
-- Name: tutor_request_applications tutor_request_applications_provider_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tutor_request_applications
    ADD CONSTRAINT tutor_request_applications_provider_user_id_fkey FOREIGN KEY (provider_user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 7368 (class 2606 OID 29327)
-- Name: tutor_request_applications tutor_request_applications_tutor_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tutor_request_applications
    ADD CONSTRAINT tutor_request_applications_tutor_request_id_fkey FOREIGN KEY (tutor_request_id) REFERENCES public.tutor_requests(id) ON DELETE CASCADE;


--
-- TOC entry 7346 (class 2606 OID 29048)
-- Name: tutor_request_status_logs tutor_request_status_logs_changed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tutor_request_status_logs
    ADD CONSTRAINT tutor_request_status_logs_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- TOC entry 7347 (class 2606 OID 29043)
-- Name: tutor_request_status_logs tutor_request_status_logs_tutor_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tutor_request_status_logs
    ADD CONSTRAINT tutor_request_status_logs_tutor_request_id_fkey FOREIGN KEY (tutor_request_id) REFERENCES public.tutor_requests(id) ON DELETE CASCADE;


--
-- TOC entry 7341 (class 2606 OID 28972)
-- Name: tutor_requests tutor_requests_customer_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tutor_requests
    ADD CONSTRAINT tutor_requests_customer_user_id_fkey FOREIGN KEY (customer_user_id) REFERENCES public.users(id) ON DELETE RESTRICT;


--
-- TOC entry 7342 (class 2606 OID 28977)
-- Name: tutor_requests tutor_requests_provider_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tutor_requests
    ADD CONSTRAINT tutor_requests_provider_id_fkey FOREIGN KEY (provider_id) REFERENCES public.providers(id) ON DELETE RESTRICT;


--
-- TOC entry 7343 (class 2606 OID 32811)
-- Name: tutor_requests tutor_requests_service_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tutor_requests
    ADD CONSTRAINT tutor_requests_service_category_id_fkey FOREIGN KEY (service_category_id) REFERENCES public.service_categories(id) ON DELETE RESTRICT;


--
-- TOC entry 7344 (class 2606 OID 29019)
-- Name: tutor_sessions tutor_sessions_provider_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tutor_sessions
    ADD CONSTRAINT tutor_sessions_provider_id_fkey FOREIGN KEY (provider_id) REFERENCES public.providers(id) ON DELETE RESTRICT;


--
-- TOC entry 7345 (class 2606 OID 29014)
-- Name: tutor_sessions tutor_sessions_tutor_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tutor_sessions
    ADD CONSTRAINT tutor_sessions_tutor_request_id_fkey FOREIGN KEY (tutor_request_id) REFERENCES public.tutor_requests(id) ON DELETE CASCADE;


--
-- TOC entry 7245 (class 2606 OID 27389)
-- Name: user_identity_files user_identity_files_uploaded_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_identity_files
    ADD CONSTRAINT user_identity_files_uploaded_by_user_id_fkey FOREIGN KEY (uploaded_by_user_id) REFERENCES public.users(id);


--
-- TOC entry 7246 (class 2606 OID 27384)
-- Name: user_identity_files user_identity_files_verification_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_identity_files
    ADD CONSTRAINT user_identity_files_verification_id_fkey FOREIGN KEY (verification_id) REFERENCES public.user_identity_verifications(id) ON DELETE CASCADE;


--
-- TOC entry 7248 (class 2606 OID 27434)
-- Name: user_identity_review_decisions user_identity_review_decisions_reviewer_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_identity_review_decisions
    ADD CONSTRAINT user_identity_review_decisions_reviewer_user_id_fkey FOREIGN KEY (reviewer_user_id) REFERENCES public.users(id);


--
-- TOC entry 7249 (class 2606 OID 27429)
-- Name: user_identity_review_decisions user_identity_review_decisions_verification_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_identity_review_decisions
    ADD CONSTRAINT user_identity_review_decisions_verification_id_fkey FOREIGN KEY (verification_id) REFERENCES public.user_identity_verifications(id) ON DELETE CASCADE;


--
-- TOC entry 7247 (class 2606 OID 27409)
-- Name: user_identity_verification_logs user_identity_verification_logs_verification_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_identity_verification_logs
    ADD CONSTRAINT user_identity_verification_logs_verification_id_fkey FOREIGN KEY (verification_id) REFERENCES public.user_identity_verifications(id) ON DELETE CASCADE;


--
-- TOC entry 7243 (class 2606 OID 27361)
-- Name: user_identity_verifications user_identity_verifications_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_identity_verifications
    ADD CONSTRAINT user_identity_verifications_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.users(id);


--
-- TOC entry 7244 (class 2606 OID 27356)
-- Name: user_identity_verifications user_identity_verifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_identity_verifications
    ADD CONSTRAINT user_identity_verifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 7300 (class 2606 OID 28272)
-- Name: user_notes user_notes_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_notes
    ADD CONSTRAINT user_notes_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE RESTRICT;


--
-- TOC entry 7301 (class 2606 OID 28267)
-- Name: user_notes user_notes_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_notes
    ADD CONSTRAINT user_notes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 7192 (class 2606 OID 26669)
-- Name: user_profiles user_profiles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_profiles
    ADD CONSTRAINT user_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 7191 (class 2606 OID 26648)
-- Name: user_roles user_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 7193 (class 2606 OID 26692)
-- Name: user_status_logs user_status_logs_changed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_status_logs
    ADD CONSTRAINT user_status_logs_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES public.users(id);


--
-- TOC entry 7194 (class 2606 OID 26687)
-- Name: user_status_logs user_status_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_status_logs
    ADD CONSTRAINT user_status_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 7298 (class 2606 OID 28242)
-- Name: user_tags user_tags_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_tags
    ADD CONSTRAINT user_tags_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- TOC entry 7299 (class 2606 OID 28237)
-- Name: user_tags user_tags_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_tags
    ADD CONSTRAINT user_tags_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 7273 (class 2606 OID 27845)
-- Name: wallet_transactions wallet_transactions_wallet_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wallet_transactions
    ADD CONSTRAINT wallet_transactions_wallet_id_fkey FOREIGN KEY (wallet_id) REFERENCES public.wallets(id) ON DELETE RESTRICT;


--
-- TOC entry 7272 (class 2606 OID 27820)
-- Name: wallets wallets_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wallets
    ADD CONSTRAINT wallets_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE RESTRICT;


-- Completed on 2026-07-06 09:42:24

--
-- PostgreSQL database dump complete
--

\unrestrict a7epxtbp8KIQoBXSIsJ8gHsWOxmwA7VjlfgOn2ZS4SAjo4cXuWYIK1yUJi8Y1oU

