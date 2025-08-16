--
-- PostgreSQL database dump
--

-- Dumped from database version 16.9
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
    updated_at timestamp without time zone DEFAULT now()
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
\.


--
-- Data for Name: employees; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.employees (id, name, default_hourly_rate, created_at) FROM stdin;
4820587d-315d-47c7-bee2-2eef5b0217ff	Mark	50.00	2025-08-09 23:35:41.063634
5a89725f-b46b-4ecf-8f0b-d7260bb3ba38	Will	50.00	2025-08-09 23:35:45.203364
9456ed34-ac09-4546-997c-e61a626411e5	Logan	50.00	2025-08-09 23:35:49.451046
3251d65a-0a40-42aa-915a-dd19a1774ba6	Tim	50.00	2025-08-10 01:28:23.824248
787e316f-ba04-437e-ad5a-6b741bb9c6f9	Jesse	50.00	2025-08-10 04:07:55.067418
a746a649-aeed-4f31-91df-30fd198396bf	Greg	50.00	2025-08-10 04:08:02.736378
dfd1c9fb-66d2-4fc4-a812-4b2a8b2c82eb	Liam	50.00	2025-08-10 04:08:07.363058
589b77f2-54e7-4d2e-94b0-55deaac52268	Brie	50.00	2025-08-10 10:11:56.677516
e6a9caf2-7152-4c98-87c5-5108d2584374	Matt	65.00	2025-08-10 11:51:52.573772
9803cfb6-c9bd-42d8-b8f0-ed917a491ab2	Mark Plastering	50.00	2025-08-10 04:08:21.065802
\.


--
-- Data for Name: job_files; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.job_files (id, job_id, file_name, original_name, file_size, mime_type, object_path, uploaded_by_id, created_at, google_drive_link, google_drive_file_id, expense_amount, expense_address, expense_description, expense_category, is_expense) FROM stdin;
c0dbeab6-b3eb-453d-b3ff-30a362b417c5	4f128293-89f3-4b13-bf21-cffccd2238d2	job-sheet.pdf	job-sheet.pdf	56959	application/pdf	/objects/uploads/af9c6f53-9fe3-453f-ae2b-31d784e329c4	46214248	2025-08-13 23:51:37.687949	\N	\N	\N	\N	\N	\N	f
dd64c110-86d4-4a97-89d9-ca16a926b28a	4f128293-89f3-4b13-bf21-cffccd2238d2	21 Greenhill Dr - Sheet1 (1).pdf	21 Greenhill Dr - Sheet1 (1).pdf	56959	application/pdf	/objects/uploads/af9c6f53-9fe3-453f-ae2b-31d784e329c4	46214248	2025-08-13 23:51:38.104742	\N	\N	\N	\N	\N	\N	f
43f1abc6-7d41-4a9a-a25d-8e406b3c2676	e78a3ff6-794f-457b-8d1f-8e6481ff4b4a	job-sheet.pdf	job-sheet.pdf	57092	application/pdf	/objects/uploads/f20fcce5-45be-4cf0-9d0d-cd62463b5897	46214248	2025-08-14 11:17:56.765841	\N	\N	\N	\N	\N	\N	f
4a530868-1bc2-48b9-a5dd-d6448a5d268b	e78a3ff6-794f-457b-8d1f-8e6481ff4b4a	2 Swallow prd, Glenorchy -.pdf	2 Swallow prd, Glenorchy -.pdf	57092	application/pdf	/objects/uploads/f20fcce5-45be-4cf0-9d0d-cd62463b5897	46214248	2025-08-14 11:17:57.141098	\N	\N	\N	\N	\N	\N	f
\.


--
-- Data for Name: jobs; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.jobs (id, job_address, client_name, project_name, status, builder_margin, created_at, updated_at, default_hourly_rate, is_deleted, deleted_at, project_manager) FROM stdin;
4f128293-89f3-4b13-bf21-cffccd2238d2	21 GreenHill St	Hernan	21 GreenHill St	job_in_progress	0.00	2025-08-13 23:51:34.804273	2025-08-13 23:51:34.804273	64.00	f	\N	Matt
e78a3ff6-794f-457b-8d1f-8e6481ff4b4a	2 swallow	Hernan	2 swallow	job_in_progress	0.00	2025-08-14 11:17:54.626445	2025-08-14 11:17:54.626445	64.00	f	\N	\N
\.


--
-- Data for Name: labor_entries; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.labor_entries (id, job_id, staff_id, hourly_rate, hours_logged, created_at, updated_at) FROM stdin;
e0f7b211-42b7-43c4-9800-c5472f35fb1c	4f128293-89f3-4b13-bf21-cffccd2238d2	e6a9caf2-7152-4c98-87c5-5108d2584374	64.00	5.00	2025-08-13 23:51:34.936604	2025-08-13 23:51:34.936604
ffbad303-cef1-4929-84bc-536bd69fc1f4	4f128293-89f3-4b13-bf21-cffccd2238d2	4820587d-315d-47c7-bee2-2eef5b0217ff	64.00	21.00	2025-08-13 23:51:35.165283	2025-08-13 23:51:35.165283
d50c16f2-4ace-4339-b90d-c4345c1cee8e	4f128293-89f3-4b13-bf21-cffccd2238d2	a746a649-aeed-4f31-91df-30fd198396bf	64.00	24.00	2025-08-13 23:51:35.283204	2025-08-13 23:51:35.283204
aaa7e458-21ca-435e-8dcd-3c4130233adf	4f128293-89f3-4b13-bf21-cffccd2238d2	3251d65a-0a40-42aa-915a-dd19a1774ba6	64.00	4.00	2025-08-13 23:51:35.533739	2025-08-13 23:51:35.533739
892caca3-f82d-44ca-839e-86baaeb43dcb	4f128293-89f3-4b13-bf21-cffccd2238d2	589b77f2-54e7-4d2e-94b0-55deaac52268	64.00	0.00	2025-08-13 23:56:56.683755	2025-08-13 23:56:56.683755
6b75653c-4a3b-4ab9-88b7-b08cb7c812a3	4f128293-89f3-4b13-bf21-cffccd2238d2	9803cfb6-c9bd-42d8-b8f0-ed917a491ab2	64.00	0.00	2025-08-13 23:56:56.751019	2025-08-13 23:56:56.751019
d85fe586-c4bd-45c3-b28f-fa9bfee0f232	4f128293-89f3-4b13-bf21-cffccd2238d2	dfd1c9fb-66d2-4fc4-a812-4b2a8b2c82eb	64.00	0.00	2025-08-13 23:56:56.80856	2025-08-13 23:56:56.80856
bb23506e-898f-4650-b7b7-30868fd464e6	4f128293-89f3-4b13-bf21-cffccd2238d2	9456ed34-ac09-4546-997c-e61a626411e5	64.00	0.00	2025-08-13 23:56:56.868919	2025-08-13 23:56:56.868919
1ddda7dd-6314-4551-9da9-928f67dfb41e	4f128293-89f3-4b13-bf21-cffccd2238d2	5a89725f-b46b-4ecf-8f0b-d7260bb3ba38	64.00	0.00	2025-08-13 23:56:56.927985	2025-08-13 23:56:56.927985
1b40eebc-6dca-47a3-bfae-2e2db22563b1	4f128293-89f3-4b13-bf21-cffccd2238d2	787e316f-ba04-437e-ad5a-6b741bb9c6f9	64.00	10.00	2025-08-13 23:51:35.407218	2025-08-14 11:04:34.547
9a9e5e6d-131b-450b-bd3f-64701ea723e9	e78a3ff6-794f-457b-8d1f-8e6481ff4b4a	e6a9caf2-7152-4c98-87c5-5108d2584374	80.00	1.00	2025-08-14 11:17:54.758618	2025-08-14 11:17:54.758618
20f405ba-526f-4438-bb33-5f237335d01f	e78a3ff6-794f-457b-8d1f-8e6481ff4b4a	4820587d-315d-47c7-bee2-2eef5b0217ff	80.00	18.00	2025-08-14 11:17:54.885252	2025-08-14 11:17:54.885252
f44b1a9f-0cc5-4dea-aaf0-a5bc205e054c	e78a3ff6-794f-457b-8d1f-8e6481ff4b4a	589b77f2-54e7-4d2e-94b0-55deaac52268	64.00	0.00	2025-08-14 11:18:02.749264	2025-08-14 11:18:02.749264
e64f79ad-cc2f-42d4-aef1-dc79e820df86	e78a3ff6-794f-457b-8d1f-8e6481ff4b4a	9803cfb6-c9bd-42d8-b8f0-ed917a491ab2	64.00	0.00	2025-08-14 11:18:02.811584	2025-08-14 11:18:02.811584
8e4fb6ce-2fe5-4d53-b494-8c00725d515b	e78a3ff6-794f-457b-8d1f-8e6481ff4b4a	dfd1c9fb-66d2-4fc4-a812-4b2a8b2c82eb	64.00	0.00	2025-08-14 11:18:02.874479	2025-08-14 11:18:02.874479
e96f2712-e683-48bf-90c8-1e521480af4c	e78a3ff6-794f-457b-8d1f-8e6481ff4b4a	a746a649-aeed-4f31-91df-30fd198396bf	64.00	0.00	2025-08-14 11:18:02.937697	2025-08-14 11:18:02.937697
f208b9df-22a9-4350-9ae8-3fb8131ad907	e78a3ff6-794f-457b-8d1f-8e6481ff4b4a	787e316f-ba04-437e-ad5a-6b741bb9c6f9	64.00	0.00	2025-08-14 11:18:03.000848	2025-08-14 11:18:03.000848
fff05ec3-da0e-4d98-8236-65aa705f2e6c	e78a3ff6-794f-457b-8d1f-8e6481ff4b4a	3251d65a-0a40-42aa-915a-dd19a1774ba6	64.00	0.00	2025-08-14 11:18:03.060847	2025-08-14 11:18:03.060847
41918ac7-b350-447e-90de-0708126982a7	e78a3ff6-794f-457b-8d1f-8e6481ff4b4a	9456ed34-ac09-4546-997c-e61a626411e5	64.00	0.00	2025-08-14 11:18:03.122673	2025-08-14 11:18:03.122673
0b0c040a-bd86-4d71-8d02-c68499e7606b	e78a3ff6-794f-457b-8d1f-8e6481ff4b4a	5a89725f-b46b-4ecf-8f0b-d7260bb3ba38	64.00	0.00	2025-08-14 11:18:03.182866	2025-08-14 11:18:03.182866
\.


--
-- Data for Name: materials; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.materials (id, job_id, description, supplier, amount, invoice_date, created_at) FROM stdin;
9a9680f1-34b9-463f-9054-d84f9bf35f04	e78a3ff6-794f-457b-8d1f-8e6481ff4b4a	one trim arcs	Clennetts	33.00	12/8	2025-08-14 11:17:56.10377
02a0c541-dff3-4fbb-a387-89e71cacf5de	e78a3ff6-794f-457b-8d1f-8e6481ff4b4a	coveralac dur pine	Clennetts	75.00	13/8	2025-08-14 11:17:56.283609
4bcbfccc-0ff7-4f80-845a-74e9877120f4	e78a3ff6-794f-457b-8d1f-8e6481ff4b4a	Consumables	Unknown Supplier	45.84	\N	2025-08-14 11:17:54.946341
187c311b-d96b-4488-9d84-d102ea5cd393	4f128293-89f3-4b13-bf21-cffccd2238d2	ply brace	Clennetts	71.00	\N	2025-08-13 23:51:35.660953
82e35935-adfd-4493-80a8-28e8b136955f	4f128293-89f3-4b13-bf21-cffccd2238d2	coveralls	Bunnings	13.00	\N	2025-08-13 23:51:35.841013
7418eaa6-c8c7-4c84-acd0-54d8002610b8	4f128293-89f3-4b13-bf21-cffccd2238d2	surface protection, gloves	Bunnings	105.00	\N	2025-08-13 23:51:36.02148
bb1c5152-4553-415f-a9b2-c3054438d398	4f128293-89f3-4b13-bf21-cffccd2238d2	insulation batts	Bunnings	77.00	\N	2025-08-13 23:51:36.200239
9344b44f-4a49-43d1-93b8-738727877096	4f128293-89f3-4b13-bf21-cffccd2238d2	plaster gear, plastic, trims	Bunnings	244.00	\N	2025-08-13 23:51:36.37744
2cef9f55-5814-4823-a5fc-ad42719520a9	4f128293-89f3-4b13-bf21-cffccd2238d2	joint compound, filler, plaster gear	Bunnings	217.00	\N	2025-08-13 23:51:36.581577
9f67d40a-83d7-4d68-9b4d-8904e73585f4	4f128293-89f3-4b13-bf21-cffccd2238d2	pine, flooring, sikka, mouldings	Bunnings	195.00	\N	2025-08-13 23:51:36.759874
ef67b86c-ce23-4645-b1bf-c5e708dd13bc	4f128293-89f3-4b13-bf21-cffccd2238d2	Nails, filler	Bunnings	82.00	\N	2025-08-13 23:51:36.945709
0be83b2a-585d-49f9-a487-0af56b0521e1	4f128293-89f3-4b13-bf21-cffccd2238d2	Mould killer, pine mouldings	Bunnings	41.00	\N	2025-08-13 23:51:37.13015
2aef41ac-78e6-4091-88b6-ff05ba8a0839	4f128293-89f3-4b13-bf21-cffccd2238d2	consumables	Unknown Supplier	62.70	\N	2025-08-13 23:51:35.59268
67d4649f-bb0c-4295-a809-638d82cdb5d5	e78a3ff6-794f-457b-8d1f-8e6481ff4b4a	Flooring tas oak, framing pine	Clennetts	234.00	6/8	2025-08-14 11:17:55.009879
3aab1b8d-1e36-4a34-91fc-688883fd22d9	e78a3ff6-794f-457b-8d1f-8e6481ff4b4a	hw flooring, tape	Clennetts	235.00	7/8	2025-08-14 11:17:55.19691
b89c6346-3eb6-45f2-bb22-e36696c87dc0	e78a3ff6-794f-457b-8d1f-8e6481ff4b4a	hinges x 7	Clennetts	53.00	8/8	2025-08-14 11:17:55.379487
25c847c0-a2f4-4587-8101-07eb35681c6e	e78a3ff6-794f-457b-8d1f-8e6481ff4b4a	junction box, brass caps	Bunnings	23.00	4/8	2025-08-14 11:17:55.561725
9e3e21ff-4315-48eb-9c87-bbc9732119f5	e78a3ff6-794f-457b-8d1f-8e6481ff4b4a	Key safe, scraper	Bunnings	57.00	4/8	2025-08-14 11:17:55.742367
99cc959c-694d-4de4-863c-ec6130d1556f	e78a3ff6-794f-457b-8d1f-8e6481ff4b4a	Multi blades	Bunnings	54.00	6/8	2025-08-14 11:17:55.923122
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
-- Data for Name: reward_transactions; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.reward_transactions (id, user_id, type, points, reason, description, related_date, metadata, created_at) FROM stdin;
\.


--
-- Data for Name: sessions; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.sessions (sid, sess, expire) FROM stdin;
q4tnhz4pZIUv1DzRAphhUtfS2E-3NPHv	{"cookie": {"path": "/", "secure": true, "expires": "2025-08-19T02:38:55.978Z", "httpOnly": true, "originalMaxAge": 604800000}, "replit.com": {"code_verifier": "7OsT_mXRdtK89qPtjUq3QJnuaeI2Zk2tvpSGwlpBaNA"}}	2025-08-19 02:38:56
VjzgL3kDnI20eWbAUHSb9mZtUyweyX9O	{"cookie": {"path": "/", "secure": true, "expires": "2025-08-17T02:02:24.143Z", "httpOnly": true, "originalMaxAge": 604800000}}	2025-08-17 02:02:25
OWvxU9HXfu3dLBdK20RTZ_9Y7j0Re0mo	{"cookie": {"path": "/", "secure": true, "expires": "2025-08-19T02:39:05.291Z", "httpOnly": true, "originalMaxAge": 604800000}, "replit.com": {"code_verifier": "NwI_7qUDMDq4TUsdAYNprmQlk-FojZt8xit55KmUHr4"}}	2025-08-19 02:39:06
S8126APswEFUFlZTTC3uDIm8GvyMExI6	{"cookie": {"path": "/", "secure": true, "expires": "2025-08-19T02:39:11.539Z", "httpOnly": true, "originalMaxAge": 604800000}, "replit.com": {"code_verifier": "_XL6xkUVxzklQsYe2TlK7YBdAKfrDqIdjwo5C-xk5O8"}}	2025-08-19 02:39:12
EdpSuhvtxOoC6NpFAYnU4LZl763vlYlI	{"cookie": {"path": "/", "secure": true, "expires": "2025-08-19T02:39:42.778Z", "httpOnly": true, "originalMaxAge": 604800000}, "replit.com": {"code_verifier": "I3gEyet3Xoa2JG7u7U46MGzpySRDsKllFPQadgBGXeU"}}	2025-08-19 02:39:43
K6ZOsNwEwSlU_soQnYoov8_9HEpt7q6b	{"cookie": {"path": "/", "secure": true, "expires": "2025-08-17T22:36:04.530Z", "httpOnly": true, "originalMaxAge": 604800000}, "replit.com": {"code_verifier": "clk4UBC47DBc1-poXGKY3rrhHsouGr2_wUZZ6IKnj3A"}}	2025-08-17 22:36:05
j1dJBL601E8e6tEzLVBnSn4R6lwqKT_B	{"cookie": {"path": "/", "secure": true, "expires": "2025-08-19T11:02:19.283Z", "httpOnly": true, "originalMaxAge": 604800000}, "replit.com": {"code_verifier": "3djQuNIzsHz9A2D7_3K1ZS0rF2RG8u2SYUHoTcEXrK0"}}	2025-08-19 11:02:20
q2laE7LAWEb7aWnCmNZBuEpI3CLgcdnr	{"cookie": {"path": "/", "secure": true, "expires": "2025-08-19T11:02:22.025Z", "httpOnly": true, "originalMaxAge": 604800000}, "replit.com": {"code_verifier": "qiyWoNWh3tTWxIcBK4hWqI3GqOEkP_wFUqrT8Q-rcE0"}}	2025-08-19 11:02:23
0CcKDHnVh_RZHS9GU2GQEakddgekM2Zm	{"cookie": {"path": "/", "secure": true, "expires": "2025-08-19T11:02:30.317Z", "httpOnly": true, "originalMaxAge": 604800000}, "replit.com": {"code_verifier": "QtL-kQ0FSjHttBkgtWt8cK7dWxTdnjet1nIq88zpvlo"}}	2025-08-19 11:02:31
7P_I_biHJJIgadMWtRfb9Gc1aLEvO-pG	{"cookie": {"path": "/", "secure": true, "expires": "2025-08-19T11:02:52.236Z", "httpOnly": true, "originalMaxAge": 604800000}, "replit.com": {"code_verifier": "KAJGfWeGZlH8zDurFv01huzEsXqO1ahR13l-p2kc6r4"}}	2025-08-19 11:02:53
3GqM-sLwh3vI07b-2KjLB0ghj4DwjWzs	{"cookie": {"path": "/", "secure": true, "expires": "2025-08-19T11:04:15.731Z", "httpOnly": true, "originalMaxAge": 604800000}, "replit.com": {"code_verifier": "zcEjS1nOIUhoHtUKfZhOM54hUwrNpcoIo3zDkfCoSKI"}}	2025-08-19 11:04:16
tewq67nSORIivw0MDyMQ6mHerQF6vA4F	{"cookie": {"path": "/", "secure": true, "expires": "2025-08-19T11:04:22.476Z", "httpOnly": true, "originalMaxAge": 604800000}, "replit.com": {"code_verifier": "F6A4LNUCw55TeOCeHn4lhNHGkDmKSbavXUBmcY_Tyqw"}}	2025-08-19 11:04:23
rkZUQTQEyh18fea404E0u6OQLX2-RERg	{"cookie": {"path": "/", "secure": true, "expires": "2025-08-19T11:15:02.478Z", "httpOnly": true, "originalMaxAge": 604800000}, "replit.com": {"code_verifier": "g-DAe5W6uTPjg_hdb7Z2yDx4K3so5Q7dSdWi3ZhovM0"}}	2025-08-19 11:15:03
LCE4VEIXMD0IgmHNP0ORlU8SGHArQU_q	{"cookie": {"path": "/", "secure": true, "expires": "2025-08-19T11:15:03.606Z", "httpOnly": true, "originalMaxAge": 604800000}, "replit.com": {"code_verifier": "JOZEc1naoe6PnDDLE5PF8ULfBvXFcA7EhQYUpmw1zgU"}}	2025-08-19 11:15:04
2etdQKEY23dlV7BIO5ld2oBouSTp7FTv	{"cookie": {"path": "/", "secure": true, "expires": "2025-08-22T11:39:45.431Z", "httpOnly": true, "originalMaxAge": 604800000}, "passport": {"user": {"claims": {"aud": "002d9a91-7cf2-4585-8a06-1d3444a86ebf", "exp": 1755261584, "iat": 1755257984, "iss": "https://replit.com/oidc", "sub": "46214248", "email": "mattroach1111@gmail.com", "at_hash": "9ZJMr1pB_rKX7_I3ZyLRXg", "username": "mattroach1111", "auth_time": 1755257984, "last_name": null, "first_name": null}, "expires_at": 1755261584, "access_token": "7IW-TamrjJ9CIrf6shL2zdATbtWDAJhjcYanuYPY52E", "refresh_token": "OZUrLfx0nCr562MDnglLccKNjfXEfSPLbfqL6Ug7jaa"}}}	2025-08-22 22:31:48
9hgJzHwOIBNJz0RCIMv3opixlC-Cge_4	{"cookie": {"path": "/", "secure": true, "expires": "2025-08-17T02:09:22.366Z", "httpOnly": true, "originalMaxAge": 604800000}}	2025-08-17 02:09:23
CCJLB0LwCcZKaPKMDOmBkuORjS2_R4eb	{"cookie": {"path": "/", "secure": true, "expires": "2025-08-17T02:09:22.710Z", "httpOnly": true, "originalMaxAge": 604800000}}	2025-08-17 02:09:23
rpPrOqx7xFKFwgwrKVluCNBu9tRIYXMo	{"cookie": {"path": "/", "secure": true, "expires": "2025-08-22T02:19:55.294Z", "httpOnly": true, "originalMaxAge": 604800000}, "passport": {"user": {"claims": {"aud": "002d9a91-7cf2-4585-8a06-1d3444a86ebf", "exp": 1755227994, "iat": 1755224394, "iss": "https://replit.com/oidc", "sub": "46214248", "email": "mattroach1111@gmail.com", "at_hash": "vn_11LJF7Q8nKXX4_-dr5g", "username": "mattroach1111", "auth_time": 1755210277, "last_name": null, "first_name": null}, "expires_at": 1755227994, "access_token": "m-LvK7PUyRPniJWbXVRMvNiPCmKG4LBvXWIUdPEVjLr", "refresh_token": "KF8eXdOf5n2LJoeRSmbQn6-cH-np2OOT33f598OKPHA"}}}	2025-08-23 22:02:23
OybXFy85dxB9ZTx0fAu0LivMT0SyNcn_	{"cookie": {"path": "/", "secure": true, "expires": "2025-08-22T04:44:03.388Z", "httpOnly": true, "originalMaxAge": 604800000}, "passport": {"user": {"claims": {"aud": "002d9a91-7cf2-4585-8a06-1d3444a86ebf", "exp": 1755236641, "iat": 1755233041, "iss": "https://replit.com/oidc", "sub": "46214248", "email": "mattroach1111@gmail.com", "at_hash": "0MZnyCBB5htwN7xdlLhL6Q", "username": "mattroach1111", "auth_time": 1755171371, "last_name": null, "first_name": null}, "expires_at": 1755236641, "access_token": "6NnzJzhx-gbKpboge8nPrW46qa_XkszHL3MDS0QBq-H", "refresh_token": "Ip-OQc0_NLLBbAoFHtN1Fnjkk24LJAsq0vpgMkbc_Pg"}}}	2025-08-23 22:07:59
4fJ3sUCY6lkDAP6ra-IIJYHOnx8K94S-	{"cookie": {"path": "/", "secure": true, "expires": "2025-08-19T02:39:38.579Z", "httpOnly": true, "originalMaxAge": 604800000}, "replit.com": {"code_verifier": "ajJso9CLyzOGeK6hJV4kEQqTwb1Ea16FfHG2qCjt2lU"}}	2025-08-19 02:39:39
UXtXIw6JAvUwSh-YXwpytqquyiV2aJjZ	{"cookie": {"path": "/", "secure": true, "expires": "2025-08-19T02:51:49.124Z", "httpOnly": true, "originalMaxAge": 604800000}, "passport": {"user": {"claims": {"aud": "002d9a91-7cf2-4585-8a06-1d3444a86ebf", "exp": 1754970708, "iat": 1754967108, "iss": "https://replit.com/oidc", "sub": "46214248", "email": "mattroach1111@gmail.com", "at_hash": "lJ6YmsvSw6859NXQTj-8UA", "username": "mattroach1111", "auth_time": 1754818720, "last_name": null, "first_name": null}, "expires_at": 1754970708, "access_token": "SJJMm3sOgXd4F9ywE6SO6ipovUcHCGEsDZqLy6WBaxy", "refresh_token": "gmkxIgWU4N9V92BvDDUSe782UaqLEqOa_9uiMDCH6_3"}}}	2025-08-19 02:59:38
YH-todqTRBcGyxnfnAKdI_R9hLDyhUQD	{"cookie": {"path": "/", "secure": true, "expires": "2025-08-21T10:52:23.115Z", "httpOnly": true, "originalMaxAge": 604800000}, "passport": {"user": {"claims": {"aud": "002d9a91-7cf2-4585-8a06-1d3444a86ebf", "exp": 1755172342, "iat": 1755168742, "iss": "https://replit.com/oidc", "sub": "46214248", "email": "mattroach1111@gmail.com", "at_hash": "doTYO8MTsnRj-e-7rhY7vQ", "username": "mattroach1111", "auth_time": 1755168742, "last_name": null, "first_name": null}, "expires_at": 1755172342, "access_token": "2HBWfSXckaFax9IZB5SoB0MEi4E6sTB8xk8haeJ5N6R", "refresh_token": "inwRw2Dc_t5yce7jP4XUersO0fIZJwY1bdQsN83AT7F"}}}	2025-08-21 11:25:34
z8DJFy0Ax2PZoq-8cIsqISyugDRgJDsM	{"cookie": {"path": "/", "secure": true, "expires": "2025-08-19T02:39:48.456Z", "httpOnly": true, "originalMaxAge": 604800000}, "replit.com": {"code_verifier": "TGNo2TVyx9bcNtHn7efBN7okdvOpb5vtd9sV02shSro"}}	2025-08-19 02:39:49
fMwrXOANTPp6qbubCw0oGl0wAge03xIG	{"cookie": {"path": "/", "secure": true, "expires": "2025-08-19T02:39:55.406Z", "httpOnly": true, "originalMaxAge": 604800000}, "replit.com": {"code_verifier": "BPl9-w6hDUfGKP02sq5IcogUF73JdV2nFgDk4ql3AFg"}}	2025-08-19 02:39:56
ngeqFA8UHs-dpYjDosc3K8DtE7X5hnex	{"cookie": {"path": "/", "secure": true, "expires": "2025-08-19T11:02:36.782Z", "httpOnly": true, "originalMaxAge": 604800000}, "replit.com": {"code_verifier": "uXchMekaqcPqrJMkjLHR6cs4iuVx9DpbhLRB8mCSrQ0"}}	2025-08-19 11:02:37
6uHMXRIkCacdcveWarVaNbF8qtfGr4Hh	{"cookie": {"path": "/", "secure": true, "expires": "2025-08-19T11:03:51.797Z", "httpOnly": true, "originalMaxAge": 604800000}, "replit.com": {"code_verifier": "SJeTWibSwIlOC_nbTXh37_m4hMv6MtkDMhnYr5anf2s"}}	2025-08-19 11:03:52
eRKnXm20Vsr824LgDRB6sdAQGyFTMUNp	{"cookie": {"path": "/", "secure": true, "expires": "2025-08-21T22:47:15.837Z", "httpOnly": true, "originalMaxAge": 604800000}, "passport": {"user": {"claims": {"aud": "002d9a91-7cf2-4585-8a06-1d3444a86ebf", "exp": 1755215232, "iat": 1755211632, "iss": "https://replit.com/oidc", "sub": "46214248", "email": "mattroach1111@gmail.com", "at_hash": "m7G7Ezo949-Ou9b5IkcFgQ", "username": "mattroach1111", "auth_time": 1755168810, "last_name": null, "first_name": null}, "expires_at": 1755215232, "access_token": "_62TIuWwz6iN9ebK7iT4a_lLccmmCmq5jo0rby9QEg8", "refresh_token": "s-LQ0ks3k5rT8WLg5Wbo5lYAQVSQ_7LlhYPDMLUyoxR"}}}	2025-08-21 22:58:16
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
0219e47f-bb4f-400f-853c-68fe654e4424	4f128293-89f3-4b13-bf21-cffccd2238d2	plastering	Knauf	7192.00	\N	2025-08-13 23:51:37.306418
3553f14e-705e-4473-814a-af2cd0ca862e	e78a3ff6-794f-457b-8d1f-8e6481ff4b4a	plastering	Knauf	1908.00	\N	2025-08-14 11:17:56.463326
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
cf4f4c3d-25b1-4f8e-a253-d370ac6bfb9d	4f128293-89f3-4b13-bf21-cffccd2238d2	tip and cartage	345.00	69.00	414.00	2025-08-13 23:51:37.374941
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.users (id, email, first_name, last_name, profile_image_url, role, created_at, updated_at, google_drive_tokens, employee_id, is_assigned, email_notification_preferences) FROM stdin;
1e3e61a8-9485-403f-9681-a410ec090f9d	mark@company.local	Mark	M	\N	staff	2025-08-10 10:07:08.043105	2025-08-10 10:07:08.043105	\N	\N	f	{"documentProcessing":true,"jobUpdates":true,"timesheetReminders":true}
052417e9-041e-4459-9c7c-1943a1118cf3	jesse@company.local	Jesse		\N	staff	2025-08-10 10:07:08.043105	2025-08-10 10:07:08.043105	\N	\N	f	{"documentProcessing":true,"jobUpdates":true,"timesheetReminders":true}
46214248	mattroach1111@gmail.com	\N	\N	\N	admin	2025-08-12 22:59:48.604898	2025-08-15 11:39:45.029	\N	\N	f	{"documentProcessing":false,"jobUpdates":true,"timesheetReminders":true}
4820587d-315d-47c7-bee2-2eef5b0217ff	mark2@company.local	Mark	\N	\N	admin	2025-08-10 10:19:14.793876	2025-08-11 05:29:49.303	\N	\N	f	{"documentProcessing":true,"jobUpdates":true,"timesheetReminders":true}
5a89725f-b46b-4ecf-8f0b-d7260bb3ba38	will@company.local	Will	\N	\N	admin	2025-08-10 10:17:18.187905	2025-08-11 05:29:55.276	\N	\N	f	{"documentProcessing":true,"jobUpdates":true,"timesheetReminders":true}
589b77f2-54e7-4d2e-94b0-55deaac52268	brie@company.local	Brie	\N	\N	admin	2025-08-10 10:17:18.187905	2025-08-11 05:30:00.154	\N	\N	f	{"documentProcessing":true,"jobUpdates":true,"timesheetReminders":true}
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

