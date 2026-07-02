CREATE TABLE "broker_books" (
	"id" serial PRIMARY KEY NOT NULL,
	"broker_id" integer NOT NULL,
	"client_name" text NOT NULL,
	"industry" text NOT NULL,
	"employees" integer NOT NULL,
	"annual_spend" integer DEFAULT 0 NOT NULL,
	"plan_type" text DEFAULT 'Self-Funded' NOT NULL,
	"metro" text DEFAULT 'indianapolis' NOT NULL,
	"renewal_month" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "broker_profiles" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"firm" text NOT NULL,
	"target_sizes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"target_metros" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"target_industries" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"service_wedge" text DEFAULT 'fullrenewal' NOT NULL,
	"sales_motion" text DEFAULT 'strategic' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"prompt" text NOT NULL,
	"provider" text NOT NULL,
	"response" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prospect_recommendations" (
	"id" serial PRIMARY KEY NOT NULL,
	"broker_id" integer NOT NULL,
	"prospect_id" integer NOT NULL,
	"match_score" real NOT NULL,
	"score_breakdown" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"fit_flags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"opening_angle" text DEFAULT '' NOT NULL,
	"why_this_account" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"mode" text DEFAULT 'quiz' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prospects_5500_indiana" (
	"id" serial PRIMARY KEY NOT NULL,
	"ein" text NOT NULL,
	"sponsor_name" text NOT NULL,
	"city" text NOT NULL,
	"state" text DEFAULT 'IN' NOT NULL,
	"industry" text NOT NULL,
	"naics_code" text NOT NULL,
	"participants" integer NOT NULL,
	"form_year" integer NOT NULL,
	"metro_region" text NOT NULL,
	"metro_label" text NOT NULL,
	"welfare_codes" text DEFAULT '' NOT NULL,
	"carriers" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"has_stop_loss" boolean DEFAULT false NOT NULL,
	"renewal_month" integer NOT NULL,
	"rx_score" integer,
	"sl_score" integer,
	"est_commission" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "saved_prospect_list_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"list_id" integer NOT NULL,
	"prospect_id" integer NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"priority" text DEFAULT 'medium' NOT NULL,
	"added_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "saved_prospect_lists" (
	"id" serial PRIMARY KEY NOT NULL,
	"broker_id" integer NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"password" text NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
