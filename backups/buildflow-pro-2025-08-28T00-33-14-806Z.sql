--
-- PostgreSQL database dump
--

-- Dumped from database version 16.9 (84ade85)
-- Dumped by pg_dump version 16.9

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: email_processed_documents; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.email_processed_documents (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    filename character varying NOT NULL,
    vendor character varying NOT NULL,
    amount numeric(10,2) NOT NULL,
    category character varying NOT NULL,
    status character varying DEFAULT 'pending'::character varying NOT NULL,
    email_subject character varying,
    email_from character varying,
    extracted_data text,
    user_id character varying NOT NULL,
    job_id character varying,
    created_at timestamp without time zone DEFAULT now(),
    processed_at timestamp without time zone,
    attachment_content text,
    mime_type character varying
);


ALTER TABLE public.email_processed_documents OWNER TO neondb_owner;

--
-- Name: email_processing_logs; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.email_processing_logs (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    message_id character varying NOT NULL,
    from_email character varying NOT NULL,
    to_email character varying NOT NULL,
    subject character varying NOT NULL,
    attachment_count integer DEFAULT 0 NOT NULL,
    processed_count integer DEFAULT 0 NOT NULL,
    status character varying DEFAULT 'processing'::character varying NOT NULL,
    job_matched character varying,
    error_message text,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.email_processing_logs OWNER TO neondb_owner;

--
-- Name: employees; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.employees (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    name character varying NOT NULL,
    default_hourly_rate numeric(10,2) DEFAULT '50'::numeric NOT NULL,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.employees OWNER TO neondb_owner;

--
-- Name: job_files; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.job_files (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    job_id character varying NOT NULL,
    file_name character varying NOT NULL,
    original_name character varying NOT NULL,
    file_size integer NOT NULL,
    mime_type character varying NOT NULL,
    object_path character varying,
    uploaded_by_id character varying NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    google_drive_link character varying,
    google_drive_file_id character varying,
    expense_amount numeric(10,2),
    expense_address character varying,
    expense_description character varying,
    expense_category character varying,
    is_expense boolean DEFAULT false
);


ALTER TABLE public.job_files OWNER TO neondb_owner;

--
-- Name: job_notes; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.job_notes (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    job_id character varying NOT NULL,
    user_id character varying NOT NULL,
    note_text text NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.job_notes OWNER TO neondb_owner;

--
-- Name: job_update_notes; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.job_update_notes (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    job_id character varying NOT NULL,
    note text NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.job_update_notes OWNER TO neondb_owner;

--
-- Name: jobs; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.jobs (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    job_address character varying NOT NULL,
    client_name character varying NOT NULL,
    project_name character varying NOT NULL,
    status character varying DEFAULT 'new_job'::character varying NOT NULL,
    builder_margin numeric(5,2) DEFAULT '0'::numeric NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    default_hourly_rate numeric(10,2) DEFAULT 50 NOT NULL,
    is_deleted boolean DEFAULT false,
    deleted_at timestamp without time zone,
    project_manager character varying
);


ALTER TABLE public.jobs OWNER TO neondb_owner;

--
-- Name: labor_entries; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.labor_entries (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    job_id character varying NOT NULL,
    staff_id character varying NOT NULL,
    hourly_rate numeric(10,2) NOT NULL,
    hours_logged numeric(10,2) DEFAULT '0'::numeric NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    manual_hours numeric(10,2) DEFAULT '0'::numeric NOT NULL,
    timesheet_hours numeric(10,2) DEFAULT '0'::numeric NOT NULL
);


ALTER TABLE public.labor_entries OWNER TO neondb_owner;

--
-- Name: materials; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.materials (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    job_id character varying NOT NULL,
    description text NOT NULL,
    supplier character varying NOT NULL,
    amount numeric(10,2) NOT NULL,
    invoice_date character varying,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.materials OWNER TO neondb_owner;

--
-- Name: notifications; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.notifications (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    user_id character varying NOT NULL,
    type character varying(50) NOT NULL,
    title character varying(255) NOT NULL,
    message text NOT NULL,
    read boolean DEFAULT false NOT NULL,
    scheduled_for timestamp without time zone NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    dismissed_at timestamp without time zone
);


ALTER TABLE public.notifications OWNER TO neondb_owner;

--
-- Name: other_costs; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.other_costs (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    job_id character varying NOT NULL,
    description character varying NOT NULL,
    amount numeric(10,2) NOT NULL,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.other_costs OWNER TO neondb_owner;

--
-- Name: reward_achievements; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.reward_achievements (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    user_id character varying NOT NULL,
    achievement_type character varying NOT NULL,
    achievement_name character varying NOT NULL,
    description text,
    points_awarded integer DEFAULT 0 NOT NULL,
    badge_icon character varying,
    achieved_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.reward_achievements OWNER TO neondb_owner;

--
-- Name: reward_catalog; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.reward_catalog (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    reward_type character varying NOT NULL,
    name character varying NOT NULL,
    description text,
    points_cost integer NOT NULL,
    icon character varying,
    category character varying NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    max_redemptions_per_month integer,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.reward_catalog OWNER TO neondb_owner;

--
-- Name: reward_points; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.reward_points (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    user_id character varying NOT NULL,
    total_points integer DEFAULT 0 NOT NULL,
    spent_points integer DEFAULT 0 NOT NULL,
    available_points integer DEFAULT 0 NOT NULL,
    current_streak integer DEFAULT 0 NOT NULL,
    longest_streak integer DEFAULT 0 NOT NULL,
    last_submission_date date,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.reward_points OWNER TO neondb_owner;

--
-- Name: reward_redemptions; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.reward_redemptions (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    user_id character varying NOT NULL,
    reward_type character varying NOT NULL,
    reward_name character varying NOT NULL,
    points_cost integer NOT NULL,
    description text,
    status character varying DEFAULT 'pending'::character varying NOT NULL,
    requested_at timestamp without time zone DEFAULT now(),
    approved_at timestamp without time zone,
    redeemed_at timestamp without time zone,
    approved_by character varying,
    notes text
);


ALTER TABLE public.reward_redemptions OWNER TO neondb_owner;

--
-- Name: reward_settings; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.reward_settings (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    setting_key character varying NOT NULL,
    setting_value integer NOT NULL,
    description text,
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.reward_settings OWNER TO neondb_owner;

--
-- Name: reward_transactions; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.reward_transactions (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    user_id character varying NOT NULL,
    type character varying NOT NULL,
    points integer NOT NULL,
    reason character varying NOT NULL,
    description text,
    related_date date,
    metadata jsonb,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.reward_transactions OWNER TO neondb_owner;

--
-- Name: sessions; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.sessions (
    sid character varying NOT NULL,
    sess jsonb NOT NULL,
    expire timestamp without time zone NOT NULL
);


ALTER TABLE public.sessions OWNER TO neondb_owner;

--
-- Name: staff_members; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.staff_members (
    id character varying NOT NULL,
    name character varying NOT NULL,
    banked_hours character varying DEFAULT '0'::numeric NOT NULL,
    rdo_hours character varying DEFAULT '0'::numeric NOT NULL,
    hourly_rate character varying DEFAULT '0'::numeric NOT NULL,
    tool_cost_owed character varying DEFAULT '0'::numeric NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.staff_members OWNER TO neondb_owner;

--
-- Name: staff_notes; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.staff_notes (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    employee_id character varying NOT NULL,
    created_by_id character varying NOT NULL,
    note_type character varying NOT NULL,
    title character varying(255) NOT NULL,
    content text NOT NULL,
    amount numeric(10,2),
    hours numeric(5,2),
    due_date date,
    status character varying DEFAULT 'active'::character varying NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.staff_notes OWNER TO neondb_owner;

--
-- Name: staff_notes_entries; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.staff_notes_entries (
    id character varying NOT NULL,
    staff_member_id character varying NOT NULL,
    type character varying NOT NULL,
    description text NOT NULL,
    amount character varying DEFAULT '0'::numeric NOT NULL,
    date character varying NOT NULL,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.staff_notes_entries OWNER TO neondb_owner;

--
-- Name: sub_trades; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.sub_trades (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    job_id character varying NOT NULL,
    trade character varying NOT NULL,
    contractor character varying NOT NULL,
    amount numeric(10,2) NOT NULL,
    invoice_date character varying,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.sub_trades OWNER TO neondb_owner;

--
-- Name: timesheet_entries; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.timesheet_entries (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    staff_id character varying NOT NULL,
    job_id character varying,
    date date NOT NULL,
    hours numeric(5,2) NOT NULL,
    approved boolean DEFAULT false NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    description text,
    materials text,
    updated_at timestamp without time zone DEFAULT now(),
    submitted boolean DEFAULT false NOT NULL
);


ALTER TABLE public.timesheet_entries OWNER TO neondb_owner;

--
-- Name: tip_fees; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.tip_fees (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    job_id character varying NOT NULL,
    description character varying NOT NULL,
    amount numeric(10,2) NOT NULL,
    cartage_amount numeric(10,2) NOT NULL,
    total_amount numeric(10,2) NOT NULL,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.tip_fees OWNER TO neondb_owner;

--
-- Name: users; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.users (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    email character varying,
    first_name character varying,
    last_name character varying,
    profile_image_url character varying,
    role character varying DEFAULT 'staff'::character varying NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    google_drive_tokens text,
    employee_id character varying,
    is_assigned boolean DEFAULT false NOT NULL,
    email_notification_preferences text DEFAULT '{"documentProcessing":true,"jobUpdates":true,"timesheetReminders":true}'::text
);


ALTER TABLE public.users OWNER TO neondb_owner;

--
-- Data for Name: email_processed_documents; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.email_processed_documents (id, filename, vendor, amount, category, status, email_subject, email_from, extracted_data, user_id, job_id, created_at, processed_at, attachment_content, mime_type) FROM stdin;
3916b00d-a152-4e04-9089-3c70e2887e73	test-invoice.pdf	Unknown Vendor	0.00	other_costs	pending	Invoice for test job	test@example.com	{"filename":"test-invoice.pdf","vendor":"Unknown Vendor","amount":0,"description":"test-invoice.pdf","date":"2025-08-26","category":"other_costs","confidence":0.5}	46214248	\N	2025-08-26 23:29:34.463786	\N	JVBERi0xLjQKJdPr6eEKMSAwIG9iago8PAovVHlwZSAvQ2F0YWxvZwovUGFnZXMgMiAwIFIKPj4KZW5kb2JqCjIgMCBvYmoKPDwKL1R5cGUgL1BhZ2VzCi9LaWRzIFszIDAgUl0KL0NvdW50IDEKL01lZGlhQm94IFswIDAgNjEyIDc5Ml0KPj4KZW5kb2JqCjMgMCBvYmoKPDwKL1R5cGUgL1BhZ2UKL1BhcmVudCAyIDAgUgovTWVkaWFCb3ggWzAgMCA2MTIgNzkyXQovQ29udGVudHMgNCAwIFIKPj4KZW5kb2JqCjQgMCBvYmoKPDwKL0xlbmd0aCAzNgo+PgpzdHJlYW0KQlQKL0YxIDEyIFRmCjEwMCA3MDAgVGQKKEhlbGxvIFdvcmxkISkgVGoKRVQKZW5kc3RyZWFtCmVuZG9iago1IDAgb2JqCjw8Ci9UeXBlIC9Gb250Ci9CYXNlRm9udCAvSGVsdmV0aWNhCj4+CmVuZG9iagp4cmVmCjAgNgo4MDAwMDAwMDAwIDY1NTM1IGYKMDAwMDAwMDAwOSAwMDAwMCBuCjAwMDAwMDAwNzQgMDAwMDAgbgowMDAwMDAwMTUzIDAwMDAwIG4KMDAwMDAwMDIyOSAwMDAwMCBuCjAwMDAwMDAzMTIgMDAwMDAgbgp0cmFpbGVyCjw8Ci9TaXplIDYKL1Jvb3QgMSAwIFIKPj4Kc3RhcnR4cmVmCjM2NAolJUVPRgo=	application/pdf
\.


--
-- Data for Name: email_processing_logs; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.email_processing_logs (id, message_id, from_email, to_email, subject, attachment_count, processed_count, status, job_matched, error_message, created_at) FROM stdin;
334e9466-612a-491e-af6e-59bfdf58f270	<1755064025.5WCziAS65Q0Cr7D4@cpanel-003-syd.hostingww.com>	"cPanel on mjrbuilders.com.au" <cpanel@mjrbuilders.com.au>	documents@mjrbuilders.com.au	[mjrbuilders.com.au] Client configuration settings for “documents@mjrbuilders.com.au”.	1	0	failed	\N	Invalid email address format	2025-08-13 05:54:01.646098
5cdca8ac-f3c9-48b8-90a6-f8934f6f0987	<1755064025.5WCziAS65Q0Cr7D4@cpanel-003-syd.hostingww.com>	"cPanel on mjrbuilders.com.au" <cpanel@mjrbuilders.com.au>	documents@mjrbuilders.com.au	[mjrbuilders.com.au] Client configuration settings for “documents@mjrbuilders.com.au”.	1	0	failed	\N	Invalid email address format	2025-08-13 05:55:04.025707
79e7a915-1e6b-4e37-8f96-c2b309813feb	<1755064025.5WCziAS65Q0Cr7D4@cpanel-003-syd.hostingww.com>	"cPanel on mjrbuilders.com.au" <cpanel@mjrbuilders.com.au>	documents@mjrbuilders.com.au	[mjrbuilders.com.au] Client configuration settings for “documents@mjrbuilders.com.au”.	1	0	completed	\N	\N	2025-08-13 05:56:10.996716
6d3ff593-a4b3-423c-83a5-3cf20bfa3aa0	<1755064025.5WCziAS65Q0Cr7D4@cpanel-003-syd.hostingww.com>	"cPanel on mjrbuilders.com.au" <cpanel@mjrbuilders.com.au>	documents@mjrbuilders.com.au	[mjrbuilders.com.au] Client configuration settings for “documents@mjrbuilders.com.au”.	1	0	completed	\N	\N	2025-08-13 05:56:11.317143
47874e3c-1e03-49a5-a7c0-e8924025a710	<1755064025.5WCziAS65Q0Cr7D4@cpanel-003-syd.hostingww.com>	"cPanel on mjrbuilders.com.au" <cpanel@mjrbuilders.com.au>	documents@mjrbuilders.com.au	[mjrbuilders.com.au] Client configuration settings for “documents@mjrbuilders.com.au”.	1	0	completed	\N	\N	2025-08-13 06:03:28.427787
bf80bad0-5dc9-49cf-a097-42132c079ebe	<1755064025.5WCziAS65Q0Cr7D4@cpanel-003-syd.hostingww.com>	"cPanel on mjrbuilders.com.au" <cpanel@mjrbuilders.com.au>	documents@mjrbuilders.com.au	[mjrbuilders.com.au] Client configuration settings for “documents@mjrbuilders.com.au”.	1	0	completed	\N	\N	2025-08-13 06:03:28.707644
e904230e-7d3b-4635-8810-837d3e0d191d	<1755064025.5WCziAS65Q0Cr7D4@cpanel-003-syd.hostingww.com>	"cPanel on mjrbuilders.com.au" <cpanel@mjrbuilders.com.au>	documents@mjrbuilders.com.au	[mjrbuilders.com.au] Client configuration settings for “documents@mjrbuilders.com.au”.	1	0	completed	\N	\N	2025-08-13 06:07:58.356326
4737e18d-b757-48dd-a2c2-4bfaa6566287	<1755064025.5WCziAS65Q0Cr7D4@cpanel-003-syd.hostingww.com>	"cPanel on mjrbuilders.com.au" <cpanel@mjrbuilders.com.au>	documents@mjrbuilders.com.au	[mjrbuilders.com.au] Client configuration settings for “documents@mjrbuilders.com.au”.	1	0	completed	\N	\N	2025-08-13 06:08:01.600149
e35054ad-e29b-4d10-9354-50f061772d4b	<1755064025.5WCziAS65Q0Cr7D4@cpanel-003-syd.hostingww.com>	"cPanel on mjrbuilders.com.au" <cpanel@mjrbuilders.com.au>	documents@mjrbuilders.com.au	[mjrbuilders.com.au] Client configuration settings for “documents@mjrbuilders.com.au”.	1	0	completed	\N	\N	2025-08-13 06:11:25.606263
d5b0659e-9062-4659-b44a-74a91c08b773	<1755064025.5WCziAS65Q0Cr7D4@cpanel-003-syd.hostingww.com>	"cPanel on mjrbuilders.com.au" <cpanel@mjrbuilders.com.au>	documents@mjrbuilders.com.au	[mjrbuilders.com.au] Client configuration settings for “documents@mjrbuilders.com.au”.	1	1	completed	\N	\N	2025-08-13 06:11:29.580385
5e9ce66b-8f7e-46d5-8fab-5f8751c30d63	<1755064025.5WCziAS65Q0Cr7D4@cpanel-003-syd.hostingww.com>	"cPanel on mjrbuilders.com.au" <cpanel@mjrbuilders.com.au>	documents@mjrbuilders.com.au	[mjrbuilders.com.au] Client configuration settings for “documents@mjrbuilders.com.au”.	1	0	completed	\N	\N	2025-08-13 06:22:26.95525
1a54786d-867b-4f92-9a5f-7126297fd4fb	<1755064025.5WCziAS65Q0Cr7D4@cpanel-003-syd.hostingww.com>	"cPanel on mjrbuilders.com.au" <cpanel@mjrbuilders.com.au>	documents@mjrbuilders.com.au	[mjrbuilders.com.au] Client configuration settings for “documents@mjrbuilders.com.au”.	1	1	completed	\N	\N	2025-08-13 06:22:30.208792
076a6428-51ad-48c8-a9cf-8610c878089b	<OS8PR06MB73224B2852C0F769DE7EE252A32AA@OS8PR06MB7322.apcprd06.prod.outlook.com>	accounts@mjrbuilders.com.au	documents@mjrbuilders.com.au	12 Spud st	2	0	completed	\N	\N	2025-08-13 07:21:39.23319
74b4a1f1-fd83-48b5-9d88-cf3893523ab2	<OS8PR06MB73224B2852C0F769DE7EE252A32AA@OS8PR06MB7322.apcprd06.prod.outlook.com>	accounts@mjrbuilders.com.au	documents@mjrbuilders.com.au	12 Spud st	2	2	completed	93afa29f-3df3-45e6-a7ed-0add25797c45	\N	2025-08-13 07:21:46.813709
38b782fd-eb59-4f26-bc8f-c15a68ff4430	<OS8PR06MB7322BEC8E85C2EE5711EDA07A32AA@OS8PR06MB7322.apcprd06.prod.outlook.com>	accounts@mjrbuilders.com.au	documents@mjrbuilders.com.au	12 Spud st	1	0	completed	\N	\N	2025-08-13 07:21:51.07575
bbf61001-1882-46f2-b49d-19b293a2a2d6	<OS8PR06MB7322BEC8E85C2EE5711EDA07A32AA@OS8PR06MB7322.apcprd06.prod.outlook.com>	accounts@mjrbuilders.com.au	documents@mjrbuilders.com.au	12 Spud st	1	1	completed	93afa29f-3df3-45e6-a7ed-0add25797c45	\N	2025-08-13 07:21:55.455831
1063f6c6-b2ba-4632-a597-5e1222ea95c5	<OS8PR06MB73229924BDD345FE96E1BE74A32AA@OS8PR06MB7322.apcprd06.prod.outlook.com>	accounts@mjrbuilders.com.au	documents@mjrbuilders.com.au	12 spud street	1	0	completed	\N	\N	2025-08-13 07:20:59.394048
1f3d1c58-f8b9-4d2a-87d3-74aaf97c4497	<OS8PR06MB73229924BDD345FE96E1BE74A32AA@OS8PR06MB7322.apcprd06.prod.outlook.com>	accounts@mjrbuilders.com.au	documents@mjrbuilders.com.au	12 spud street	1	1	completed	93afa29f-3df3-45e6-a7ed-0add25797c45	\N	2025-08-13 07:21:05.507917
7f019946-0836-4f55-b055-6dc36d4a6dbf	<OS8PR06MB7322F80B0BBAB61C02734ED9A32AA@OS8PR06MB7322.apcprd06.prod.outlook.com>	accounts@mjrbuilders.com.au	documents@mjrbuilders.com.au	12 Spud st	2	0	completed	\N	\N	2025-08-13 07:21:10.352459
96a0292a-d078-48a3-bfcc-58afb2e8ed95	<OS8PR06MB7322F80B0BBAB61C02734ED9A32AA@OS8PR06MB7322.apcprd06.prod.outlook.com>	accounts@mjrbuilders.com.au	documents@mjrbuilders.com.au	12 Spud st	2	2	completed	93afa29f-3df3-45e6-a7ed-0add25797c45	\N	2025-08-13 07:21:16.477391
db346646-e9b1-4635-92b5-ad88777a966b	<OS8PR06MB7322D4CB51863BFE30CD3081A32AA@OS8PR06MB7322.apcprd06.prod.outlook.com>	accounts@mjrbuilders.com.au	documents@mjrbuilders.com.au	12 Spud st	2	0	completed	\N	\N	2025-08-13 07:21:20.822863
bc845509-1982-4ae0-b10c-1185864ec2c1	<OS8PR06MB7322D4CB51863BFE30CD3081A32AA@OS8PR06MB7322.apcprd06.prod.outlook.com>	accounts@mjrbuilders.com.au	documents@mjrbuilders.com.au	12 Spud st	2	2	completed	93afa29f-3df3-45e6-a7ed-0add25797c45	\N	2025-08-13 07:21:28.188294
8974725f-c4ca-41f1-8f36-d8ef8632c254	<OS8PR06MB732297DFCA0379476839D190A32AA@OS8PR06MB7322.apcprd06.prod.outlook.com>	accounts@mjrbuilders.com.au	documents@mjrbuilders.com.au	12 Spud st	1	0	completed	\N	\N	2025-08-13 07:21:32.214201
60ab4619-accd-40da-99d5-19432f5f8b57	<OS8PR06MB732297DFCA0379476839D190A32AA@OS8PR06MB7322.apcprd06.prod.outlook.com>	accounts@mjrbuilders.com.au	documents@mjrbuilders.com.au	12 Spud st	1	1	completed	93afa29f-3df3-45e6-a7ed-0add25797c45	\N	2025-08-13 07:21:35.486257
b5709613-de93-43b0-b9f4-066689b954a4	<OS8PR06MB7322773C9FBD3CDEA361987EA32AA@OS8PR06MB7322.apcprd06.prod.outlook.com>	accounts@mjrbuilders.com.au	documents@mjrbuilders.com.au	12 Spud st	2	0	completed	\N	\N	2025-08-13 07:21:59.306877
e25750be-e3a6-4989-a9dc-56c63f897d44	<OS8PR06MB7322773C9FBD3CDEA361987EA32AA@OS8PR06MB7322.apcprd06.prod.outlook.com>	accounts@mjrbuilders.com.au	documents@mjrbuilders.com.au	12 Spud st	2	2	completed	93afa29f-3df3-45e6-a7ed-0add25797c45	\N	2025-08-13 07:22:07.250591
a3ae410f-2c68-47bf-8b10-061a5d06cdd1	<OS8PR06MB73227295ACD7A2D06A95CC46A32AA@OS8PR06MB7322.apcprd06.prod.outlook.com>	accounts@mjrbuilders.com.au	documents@mjrbuilders.com.au	12 Spud st	2	0	completed	\N	\N	2025-08-13 07:22:10.905199
73a8329b-81a8-40d4-a9dd-642399d2df44	<OS8PR06MB73227295ACD7A2D06A95CC46A32AA@OS8PR06MB7322.apcprd06.prod.outlook.com>	accounts@mjrbuilders.com.au	documents@mjrbuilders.com.au	12 Spud st	2	2	completed	93afa29f-3df3-45e6-a7ed-0add25797c45	\N	2025-08-13 07:22:19.459519
3adf3c50-a145-49db-a0eb-07e8873112be	<OS8PR06MB7322D93170B0BBCB06BAE817A32AA@OS8PR06MB7322.apcprd06.prod.outlook.com>	accounts@mjrbuilders.com.au	documents@mjrbuilders.com.au	12 Spud st	2	0	completed	\N	\N	2025-08-13 07:36:20.993366
80d08ba9-d3c6-4020-91ad-2f63034ac619	<OS8PR06MB7322D93170B0BBCB06BAE817A32AA@OS8PR06MB7322.apcprd06.prod.outlook.com>	accounts@mjrbuilders.com.au	documents@mjrbuilders.com.au	12 Spud st	2	2	completed	93afa29f-3df3-45e6-a7ed-0add25797c45	\N	2025-08-13 07:36:30.173381
3777dfd6-6e39-4f51-95ba-a5da98a7e7d8	<OS8PR06MB732235141084FA18D70D8B0EA32AA@OS8PR06MB7322.apcprd06.prod.outlook.com>	accounts@mjrbuilders.com.au	documents@mjrbuilders.com.au	18 haig st	1	0	completed	\N	\N	2025-08-13 08:04:52.330995
b3479540-421b-4f1a-bfe0-7903487d6bd8	<OS8PR06MB732235141084FA18D70D8B0EA32AA@OS8PR06MB7322.apcprd06.prod.outlook.com>	accounts@mjrbuilders.com.au	documents@mjrbuilders.com.au	18 haig st	1	1	completed	e4d5cfa1-f2cf-4543-89bf-9ae2048790b4	\N	2025-08-13 08:04:56.038903
bdfd9e83-594c-4ecf-96b3-8e555e4522c3	<OS8PR06MB732218F9F5E14BAEDDD9537BA32AA@OS8PR06MB7322.apcprd06.prod.outlook.com>	accounts@mjrbuilders.com.au	documents@mjrbuilders.com.au	16 eve	1	0	completed	\N	\N	2025-08-13 08:10:06.227431
17ab0be5-1f04-47d3-b237-070e02a84f91	<OS8PR06MB732218F9F5E14BAEDDD9537BA32AA@OS8PR06MB7322.apcprd06.prod.outlook.com>	accounts@mjrbuilders.com.au	documents@mjrbuilders.com.au	16 eve	1	1	completed	d7bc7c17-372d-4cb1-9d70-abe4916c8c30	\N	2025-08-13 08:10:11.87961
330f8e66-f961-4ff9-beee-7c0e939e922c	<OS8PR06MB73220C64A0E325E3FF9830DCA32AA@OS8PR06MB7322.apcprd06.prod.outlook.com>	accounts@mjrbuilders.com.au	documents@mjrbuilders.com.au	18 Haig	1	0	completed	\N	\N	2025-08-13 08:20:30.658304
1b7320dc-5d36-40df-bfe6-cc3c50591b9b	<OS8PR06MB73220C64A0E325E3FF9830DCA32AA@OS8PR06MB7322.apcprd06.prod.outlook.com>	accounts@mjrbuilders.com.au	documents@mjrbuilders.com.au	18 Haig	1	1	completed	e4d5cfa1-f2cf-4543-89bf-9ae2048790b4	\N	2025-08-13 08:20:36.029377
16890692-7dea-476f-b912-82d852e18c06	webhook-1756250931511-z98usqoji	test@example.com	documents-12345678@mjrbuilders.com.au	Test Invoice for 21 Greenhill Dr	1	0	completed	\N	\N	2025-08-26 23:28:51.851704
830c236f-a1fe-4aca-8e82-79ebc30082af	webhook-1756250931511-z98usqoji	test@example.com	documents-12345678@mjrbuilders.com.au	Test Invoice for 21 Greenhill Dr	1	0	completed	\N	\N	2025-08-26 23:28:54.070483
51d9c038-3d13-4f96-98a2-8de63bf3e75b	webhook-1756250970957-7vh73cd25	test@example.com	documents-12345678@mjrbuilders.com.au	Invoice for test job	1	0	completed	\N	\N	2025-08-26 23:29:31.287198
dde2df62-beca-4d13-b0f3-7c6fd75a9253	webhook-1756250970957-7vh73cd25	test@example.com	documents-12345678@mjrbuilders.com.au	Invoice for test job	1	1	completed	d1253ace-a51f-4ea8-a1a1-2a4b4cf1afd4	\N	2025-08-26 23:29:34.592886
\.


--
-- Data for Name: employees; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.employees (id, name, default_hourly_rate, created_at) FROM stdin;
\.


--
-- Data for Name: job_files; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.job_files (id, job_id, file_name, original_name, file_size, mime_type, object_path, uploaded_by_id, created_at, google_drive_link, google_drive_file_id, expense_amount, expense_address, expense_description, expense_category, is_expense) FROM stdin;
\.


--
-- Data for Name: job_notes; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.job_notes (id, job_id, user_id, note_text, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: job_update_notes; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.job_update_notes (id, job_id, note, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: jobs; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.jobs (id, job_address, client_name, project_name, status, builder_margin, created_at, updated_at, default_hourly_rate, is_deleted, deleted_at, project_manager) FROM stdin;
d1253ace-a51f-4ea8-a1a1-2a4b4cf1afd4	test job			new_job	0.00	2025-08-21 23:20:46.971501	2025-08-21 23:20:46.971501	65.00	f	\N	
\.


--
-- Data for Name: labor_entries; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.labor_entries (id, job_id, staff_id, hourly_rate, hours_logged, created_at, updated_at, manual_hours, timesheet_hours) FROM stdin;
\.


--
-- Data for Name: materials; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.materials (id, job_id, description, supplier, amount, invoice_date, created_at) FROM stdin;
a3abb233-745c-4f34-90b3-af3c02d1e560	d1253ace-a51f-4ea8-a1a1-2a4b4cf1afd4	Consumables	General	0.00	2025-08-21	2025-08-21 23:20:47.060703
\.


--
-- Data for Name: notifications; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.notifications (id, user_id, type, title, message, read, scheduled_for, created_at, dismissed_at) FROM stdin;
\.


--
-- Data for Name: other_costs; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.other_costs (id, job_id, description, amount, created_at) FROM stdin;
\.


--
-- Data for Name: reward_achievements; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.reward_achievements (id, user_id, achievement_type, achievement_name, description, points_awarded, badge_icon, achieved_at) FROM stdin;
\.


--
-- Data for Name: reward_catalog; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.reward_catalog (id, reward_type, name, description, points_cost, icon, category, is_active, max_redemptions_per_month, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: reward_points; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.reward_points (id, user_id, total_points, spent_points, available_points, current_streak, longest_streak, last_submission_date, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: reward_redemptions; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.reward_redemptions (id, user_id, reward_type, reward_name, points_cost, description, status, requested_at, approved_at, redeemed_at, approved_by, notes) FROM stdin;
\.


--
-- Data for Name: reward_settings; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.reward_settings (id, setting_key, setting_value, description, updated_at) FROM stdin;
0d143a94-13a1-403a-a971-67358e1d88a3	dailySubmissionPoints	10	Points awarded for daily timesheet submission	2025-08-17 03:45:46.220373
79855aa6-af35-46ab-8347-b997dec4e5ea	weeklyBonusPoints	50	Bonus points for completing a full work week	2025-08-17 03:45:46.343491
b1314c4c-9f45-44f5-8224-855437f7d5a0	fortnightlyBonusPoints	100	Bonus points for completing a fortnight	2025-08-17 03:45:46.459471
69b3061a-2df2-4c10-a7bb-de6f95bb6ce8	monthlyBonusPoints	200	Bonus points for completing a full month	2025-08-17 03:45:46.574437
aa277d6e-991e-4314-bd3f-50d63fe61bb8	streakBonusMultiplier	15	Streak bonus multiplier (stored as 15 for 1.5x)	2025-08-17 03:45:46.689661
4a824d33-e9c6-4461-8859-126a0f6186db	perfectWeekBonus	25	Bonus for perfect week attendance	2025-08-17 03:45:46.804532
25648c09-12a0-4a20-abf5-f793d519b25c	perfectMonthBonus	100	Bonus for perfect month attendance	2025-08-17 03:45:46.920039
\.


--
-- Data for Name: reward_transactions; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.reward_transactions (id, user_id, type, points, reason, description, related_date, metadata, created_at) FROM stdin;
\.


--
-- Data for Name: sessions; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.sessions (sid, sess, expire) FROM stdin;
rpPrOqx7xFKFwgwrKVluCNBu9tRIYXMo	{"cookie": {"path": "/", "secure": true, "expires": "2025-08-22T02:19:55.294Z", "httpOnly": true, "originalMaxAge": 604800000}, "passport": {"user": {"claims": {"aud": "002d9a91-7cf2-4585-8a06-1d3444a86ebf", "exp": 1755227994, "iat": 1755224394, "iss": "https://replit.com/oidc", "sub": "46214248", "email": "mattroach1111@gmail.com", "at_hash": "vn_11LJF7Q8nKXX4_-dr5g", "username": "mattroach1111", "auth_time": 1755210277, "last_name": null, "first_name": null}, "expires_at": 1755227994, "access_token": "m-LvK7PUyRPniJWbXVRMvNiPCmKG4LBvXWIUdPEVjLr", "refresh_token": "KF8eXdOf5n2LJoeRSmbQn6-cH-np2OOT33f598OKPHA"}}}	2025-08-27 23:17:00
9nfHekmy8R3vaIAQ8WhyiU-0o7zR7CVL	{"cookie": {"path": "/", "secure": false, "expires": "2025-08-28T22:50:12.497Z", "httpOnly": true, "sameSite": "lax", "originalMaxAge": 604800000}, "passport": {"user": {"claims": {"aud": "65de323c-f745-4bb9-878d-073f4f7d334e", "exp": 1755820212, "iat": 1755816612, "iss": "https://replit.com/oidc", "sub": "46214248", "email": "mattroach1111@gmail.com", "at_hash": "3RrIkk4DALN6rqHB3n9RFg", "username": "mattroach1111", "auth_time": 1755816608, "last_name": null, "first_name": null}, "expires_at": 1755820212, "access_token": "rxrkPIAby-SfA12ZQ9kS_HumC4aWufV1DVdflt9o7hP", "refresh_token": "DPTFkQtZG2fNW_3FPA3T36nEL3rn5xr1wwg7sO_4DIg"}}}	2025-08-28 23:20:48
2etdQKEY23dlV7BIO5ld2oBouSTp7FTv	{"cookie": {"path": "/", "secure": true, "expires": "2025-08-22T11:39:45.431Z", "httpOnly": true, "originalMaxAge": 604800000}, "passport": {"user": {"claims": {"aud": "002d9a91-7cf2-4585-8a06-1d3444a86ebf", "exp": 1755261584, "iat": 1755257984, "iss": "https://replit.com/oidc", "sub": "46214248", "email": "mattroach1111@gmail.com", "at_hash": "9ZJMr1pB_rKX7_I3ZyLRXg", "username": "mattroach1111", "auth_time": 1755257984, "last_name": null, "first_name": null}, "expires_at": 1755261584, "access_token": "7IW-TamrjJ9CIrf6shL2zdATbtWDAJhjcYanuYPY52E", "refresh_token": "OZUrLfx0nCr562MDnglLccKNjfXEfSPLbfqL6Ug7jaa"}}}	2025-08-22 22:31:48
OybXFy85dxB9ZTx0fAu0LivMT0SyNcn_	{"cookie": {"path": "/", "secure": true, "expires": "2025-08-22T04:44:03.388Z", "httpOnly": true, "originalMaxAge": 604800000}, "passport": {"user": {"claims": {"aud": "002d9a91-7cf2-4585-8a06-1d3444a86ebf", "exp": 1755236641, "iat": 1755233041, "iss": "https://replit.com/oidc", "sub": "46214248", "email": "mattroach1111@gmail.com", "at_hash": "0MZnyCBB5htwN7xdlLhL6Q", "username": "mattroach1111", "auth_time": 1755171371, "last_name": null, "first_name": null}, "expires_at": 1755236641, "access_token": "6NnzJzhx-gbKpboge8nPrW46qa_XkszHL3MDS0QBq-H", "refresh_token": "Ip-OQc0_NLLBbAoFHtN1Fnjkk24LJAsq0vpgMkbc_Pg"}}}	2025-08-29 05:47:10
VAImbfpehmLbHhmxXdcMECsaiZk2dlMe	{"cookie": {"path": "/", "secure": false, "expires": "2025-08-28T04:46:44.208Z", "httpOnly": true, "sameSite": "lax", "originalMaxAge": 604800000}, "passport": {"user": {"claims": {"aud": "8306750c-f706-411c-abf9-f70f3f0c81ca", "exp": 1755755203, "iat": 1755751603, "iss": "https://replit.com/oidc", "sub": "46214248", "email": "mattroach1111@gmail.com", "at_hash": "-qiuc3y6ZaAjsBBQ1wTpaw", "username": "mattroach1111", "auth_time": 1755751603, "last_name": null, "first_name": null}, "expires_at": 1755755203, "access_token": "ODNnBcWXSECi5yIUazJzYcvB7HKxRcmpwd20K7URYNP", "refresh_token": "d-uFWDaQuJrKOOMNBWSSj0UKPiD_ILykEOt88SFOIBZ"}}}	2025-08-28 04:50:40
eRKnXm20Vsr824LgDRB6sdAQGyFTMUNp	{"cookie": {"path": "/", "secure": true, "expires": "2025-08-25T04:30:58.642Z", "httpOnly": true, "originalMaxAge": 604800000}, "passport": {"user": {"claims": {"aud": "002d9a91-7cf2-4585-8a06-1d3444a86ebf", "exp": 1755495058, "iat": 1755491458, "iss": "https://replit.com/oidc", "sub": "46214248", "email": "mattroach1111@gmail.com", "at_hash": "qB1nXTT5od_-0HFZmaqTCQ", "username": "mattroach1111", "auth_time": 1755168810, "last_name": null, "first_name": null}, "expires_at": 1755495058, "access_token": "pcqkZV_BiyEK6DJVy8izN_pGPHsU5Y2GUA1cSmbhyKe", "refresh_token": "PEeUmB23fZe545hHeTcMIanTA0NSCMWSGkkUuYHFq5r"}}}	2025-08-25 05:29:22
\.


--
-- Data for Name: staff_members; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.staff_members (id, name, banked_hours, rdo_hours, hourly_rate, tool_cost_owed, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: staff_notes; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.staff_notes (id, employee_id, created_by_id, note_type, title, content, amount, hours, due_date, status, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: staff_notes_entries; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.staff_notes_entries (id, staff_member_id, type, description, amount, date, created_at) FROM stdin;
\.


--
-- Data for Name: sub_trades; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.sub_trades (id, job_id, trade, contractor, amount, invoice_date, created_at) FROM stdin;
\.


--
-- Data for Name: timesheet_entries; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.timesheet_entries (id, staff_id, job_id, date, hours, approved, created_at, description, materials, updated_at, submitted) FROM stdin;
\.


--
-- Data for Name: tip_fees; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.tip_fees (id, job_id, description, amount, cartage_amount, total_amount, created_at) FROM stdin;
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.users (id, email, first_name, last_name, profile_image_url, role, created_at, updated_at, google_drive_tokens, employee_id, is_assigned, email_notification_preferences) FROM stdin;
46214248	mattroach1111@gmail.com	\N	\N	\N	admin	2025-08-12 22:59:48.604898	2025-08-21 22:50:12.234	\N	\N	f	{"documentProcessing":false,"jobUpdates":true,"timesheetReminders":true}
\.


--
-- Name: email_processed_documents email_processed_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.email_processed_documents
    ADD CONSTRAINT email_processed_documents_pkey PRIMARY KEY (id);


--
-- Name: email_processing_logs email_processing_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.email_processing_logs
    ADD CONSTRAINT email_processing_logs_pkey PRIMARY KEY (id);


--
-- Name: employees employees_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_pkey PRIMARY KEY (id);


--
-- Name: job_files job_files_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.job_files
    ADD CONSTRAINT job_files_pkey PRIMARY KEY (id);


--
-- Name: job_notes job_notes_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.job_notes
    ADD CONSTRAINT job_notes_pkey PRIMARY KEY (id);


--
-- Name: job_update_notes job_update_notes_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.job_update_notes
    ADD CONSTRAINT job_update_notes_pkey PRIMARY KEY (id);


--
-- Name: jobs jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.jobs
    ADD CONSTRAINT jobs_pkey PRIMARY KEY (id);


--
-- Name: labor_entries labor_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.labor_entries
    ADD CONSTRAINT labor_entries_pkey PRIMARY KEY (id);


--
-- Name: materials materials_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.materials
    ADD CONSTRAINT materials_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: other_costs other_costs_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.other_costs
    ADD CONSTRAINT other_costs_pkey PRIMARY KEY (id);


--
-- Name: reward_achievements reward_achievements_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.reward_achievements
    ADD CONSTRAINT reward_achievements_pkey PRIMARY KEY (id);


--
-- Name: reward_catalog reward_catalog_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.reward_catalog
    ADD CONSTRAINT reward_catalog_pkey PRIMARY KEY (id);


--
-- Name: reward_points reward_points_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.reward_points
    ADD CONSTRAINT reward_points_pkey PRIMARY KEY (id);


--
-- Name: reward_redemptions reward_redemptions_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.reward_redemptions
    ADD CONSTRAINT reward_redemptions_pkey PRIMARY KEY (id);


--
-- Name: reward_settings reward_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.reward_settings
    ADD CONSTRAINT reward_settings_pkey PRIMARY KEY (id);


--
-- Name: reward_settings reward_settings_setting_key_unique; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.reward_settings
    ADD CONSTRAINT reward_settings_setting_key_unique UNIQUE (setting_key);


--
-- Name: reward_transactions reward_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.reward_transactions
    ADD CONSTRAINT reward_transactions_pkey PRIMARY KEY (id);


--
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (sid);


--
-- Name: staff_members staff_members_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.staff_members
    ADD CONSTRAINT staff_members_pkey PRIMARY KEY (id);


--
-- Name: staff_notes_entries staff_notes_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.staff_notes_entries
    ADD CONSTRAINT staff_notes_entries_pkey PRIMARY KEY (id);


--
-- Name: staff_notes staff_notes_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.staff_notes
    ADD CONSTRAINT staff_notes_pkey PRIMARY KEY (id);


--
-- Name: sub_trades sub_trades_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.sub_trades
    ADD CONSTRAINT sub_trades_pkey PRIMARY KEY (id);


--
-- Name: timesheet_entries timesheet_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.timesheet_entries
    ADD CONSTRAINT timesheet_entries_pkey PRIMARY KEY (id);


--
-- Name: tip_fees tip_fees_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.tip_fees
    ADD CONSTRAINT tip_fees_pkey PRIMARY KEY (id);


--
-- Name: users users_email_unique; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_unique UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: IDX_session_expire; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX "IDX_session_expire" ON public.sessions USING btree (expire);


--
-- Name: email_processed_documents email_processed_documents_job_id_jobs_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.email_processed_documents
    ADD CONSTRAINT email_processed_documents_job_id_jobs_id_fk FOREIGN KEY (job_id) REFERENCES public.jobs(id);


--
-- Name: email_processed_documents email_processed_documents_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.email_processed_documents
    ADD CONSTRAINT email_processed_documents_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: job_files job_files_job_id_jobs_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.job_files
    ADD CONSTRAINT job_files_job_id_jobs_id_fk FOREIGN KEY (job_id) REFERENCES public.jobs(id) ON DELETE CASCADE;


--
-- Name: job_files job_files_uploaded_by_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.job_files
    ADD CONSTRAINT job_files_uploaded_by_id_users_id_fk FOREIGN KEY (uploaded_by_id) REFERENCES public.users(id);


--
-- Name: job_notes job_notes_job_id_jobs_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.job_notes
    ADD CONSTRAINT job_notes_job_id_jobs_id_fk FOREIGN KEY (job_id) REFERENCES public.jobs(id) ON DELETE CASCADE;


--
-- Name: job_notes job_notes_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.job_notes
    ADD CONSTRAINT job_notes_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: job_update_notes job_update_notes_job_id_jobs_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.job_update_notes
    ADD CONSTRAINT job_update_notes_job_id_jobs_id_fk FOREIGN KEY (job_id) REFERENCES public.jobs(id) ON DELETE CASCADE;


--
-- Name: labor_entries labor_entries_job_id_jobs_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.labor_entries
    ADD CONSTRAINT labor_entries_job_id_jobs_id_fk FOREIGN KEY (job_id) REFERENCES public.jobs(id) ON DELETE CASCADE;


--
-- Name: labor_entries labor_entries_staff_id_employees_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.labor_entries
    ADD CONSTRAINT labor_entries_staff_id_employees_id_fk FOREIGN KEY (staff_id) REFERENCES public.employees(id);


--
-- Name: materials materials_job_id_jobs_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.materials
    ADD CONSTRAINT materials_job_id_jobs_id_fk FOREIGN KEY (job_id) REFERENCES public.jobs(id) ON DELETE CASCADE;


--
-- Name: notifications notifications_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: other_costs other_costs_job_id_jobs_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.other_costs
    ADD CONSTRAINT other_costs_job_id_jobs_id_fk FOREIGN KEY (job_id) REFERENCES public.jobs(id) ON DELETE CASCADE;


--
-- Name: reward_achievements reward_achievements_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.reward_achievements
    ADD CONSTRAINT reward_achievements_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: reward_points reward_points_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.reward_points
    ADD CONSTRAINT reward_points_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: reward_redemptions reward_redemptions_approved_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.reward_redemptions
    ADD CONSTRAINT reward_redemptions_approved_by_users_id_fk FOREIGN KEY (approved_by) REFERENCES public.users(id);


--
-- Name: reward_redemptions reward_redemptions_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.reward_redemptions
    ADD CONSTRAINT reward_redemptions_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: reward_transactions reward_transactions_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.reward_transactions
    ADD CONSTRAINT reward_transactions_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: staff_notes staff_notes_created_by_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.staff_notes
    ADD CONSTRAINT staff_notes_created_by_id_users_id_fk FOREIGN KEY (created_by_id) REFERENCES public.users(id);


--
-- Name: staff_notes staff_notes_employee_id_employees_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.staff_notes
    ADD CONSTRAINT staff_notes_employee_id_employees_id_fk FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;


--
-- Name: staff_notes_entries staff_notes_entries_staff_member_id_staff_members_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.staff_notes_entries
    ADD CONSTRAINT staff_notes_entries_staff_member_id_staff_members_id_fk FOREIGN KEY (staff_member_id) REFERENCES public.staff_members(id) ON DELETE CASCADE;


--
-- Name: sub_trades sub_trades_job_id_jobs_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.sub_trades
    ADD CONSTRAINT sub_trades_job_id_jobs_id_fk FOREIGN KEY (job_id) REFERENCES public.jobs(id) ON DELETE CASCADE;


--
-- Name: timesheet_entries timesheet_entries_job_id_jobs_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.timesheet_entries
    ADD CONSTRAINT timesheet_entries_job_id_jobs_id_fk FOREIGN KEY (job_id) REFERENCES public.jobs(id);


--
-- Name: timesheet_entries timesheet_entries_staff_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.timesheet_entries
    ADD CONSTRAINT timesheet_entries_staff_id_users_id_fk FOREIGN KEY (staff_id) REFERENCES public.users(id);


--
-- Name: tip_fees tip_fees_job_id_jobs_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.tip_fees
    ADD CONSTRAINT tip_fees_job_id_jobs_id_fk FOREIGN KEY (job_id) REFERENCES public.jobs(id) ON DELETE CASCADE;


--
-- Name: users users_employee_id_employees_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_employee_id_employees_id_fk FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE SET NULL;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: cloud_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE cloud_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO neon_superuser WITH GRANT OPTION;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: cloud_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE cloud_admin IN SCHEMA public GRANT ALL ON TABLES TO neon_superuser WITH GRANT OPTION;


--
-- PostgreSQL database dump complete
--

