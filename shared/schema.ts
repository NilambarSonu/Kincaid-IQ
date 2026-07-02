import { pgTable, text, serial, timestamp, integer, real, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const logs = pgTable("logs", {
  id: serial("id").primaryKey(),
  prompt: text("prompt").notNull(),
  provider: text("provider").notNull(),
  response: text("response").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertLogSchema = createInsertSchema(logs).omit({ id: true, createdAt: true });

export type Log = typeof logs.$inferSelect;
export type InsertLog = z.infer<typeof insertLogSchema>;

export const prospects5500Indiana = pgTable("prospects_5500_indiana", {
  id: serial("id").primaryKey(),
  ein: text("ein").notNull(),
  sponsorName: text("sponsor_name").notNull(),
  city: text("city").notNull(),
  state: text("state").notNull().default("IN"),
  industry: text("industry").notNull(),
  naicsCode: text("naics_code").notNull(),
  participants: integer("participants").notNull(),
  formYear: integer("form_year").notNull(),
  metroRegion: text("metro_region").notNull(),
  metroLabel: text("metro_label").notNull(),
  welfareCodes: text("welfare_codes").notNull().default(""),
  carriers: jsonb("carriers").$type<string[]>().notNull().default([]),
  hasStopLoss: boolean("has_stop_loss").notNull().default(false),
  renewalMonth: integer("renewal_month").notNull(),
  rxScore: integer("rx_score"),
  slScore: integer("sl_score"),
  estCommission: integer("est_commission").notNull().default(0),
});

export const insertProspectSchema = createInsertSchema(prospects5500Indiana).omit({ id: true });
export type Prospect5500 = typeof prospects5500Indiana.$inferSelect;
export type InsertProspect5500 = z.infer<typeof insertProspectSchema>;

export const brokerProfiles = pgTable("broker_profiles", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  firm: text("firm").notNull(),
  targetSizes: jsonb("target_sizes").$type<string[]>().notNull().default([]),
  targetMetros: jsonb("target_metros").$type<string[]>().notNull().default([]),
  targetIndustries: jsonb("target_industries").$type<string[]>().notNull().default([]),
  serviceWedge: text("service_wedge").notNull().default("fullrenewal"),
  salesMotion: text("sales_motion").notNull().default("strategic"),
});

export const insertBrokerProfileSchema = createInsertSchema(brokerProfiles).omit({ id: true });
export type BrokerProfile = typeof brokerProfiles.$inferSelect;
export type InsertBrokerProfile = z.infer<typeof insertBrokerProfileSchema>;

export const brokerBooks = pgTable("broker_books", {
  id: serial("id").primaryKey(),
  brokerId: integer("broker_id").notNull(),
  clientName: text("client_name").notNull(),
  industry: text("industry").notNull(),
  employees: integer("employees").notNull(),
  annualSpend: integer("annual_spend").notNull().default(0),
  planType: text("plan_type").notNull().default("Self-Funded"),
  metro: text("metro").notNull().default("indianapolis"),
  renewalMonth: integer("renewal_month").notNull().default(1),
});

export const insertBrokerBookSchema = createInsertSchema(brokerBooks).omit({ id: true });
export type BrokerBook = typeof brokerBooks.$inferSelect;
export type InsertBrokerBook = z.infer<typeof insertBrokerBookSchema>;

export const prospectRecommendations = pgTable("prospect_recommendations", {
  id: serial("id").primaryKey(),
  brokerId: integer("broker_id").notNull(),
  prospectId: integer("prospect_id").notNull(),
  matchScore: real("match_score").notNull(),
  scoreBreakdown: jsonb("score_breakdown").$type<Record<string, number>>().notNull().default({}),
  fitFlags: jsonb("fit_flags").$type<string[]>().notNull().default([]),
  openingAngle: text("opening_angle").notNull().default(""),
  whyThisAccount: jsonb("why_this_account").$type<string[]>().notNull().default([]),
  mode: text("mode").notNull().default("quiz"),
});

export const insertRecommendationSchema = createInsertSchema(prospectRecommendations).omit({ id: true });
export type ProspectRecommendation = typeof prospectRecommendations.$inferSelect;
export type InsertRecommendation = z.infer<typeof insertRecommendationSchema>;

export const savedProspectLists = pgTable("saved_prospect_lists", {
  id: serial("id").primaryKey(),
  brokerId: integer("broker_id").notNull(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertSavedListSchema = createInsertSchema(savedProspectLists).omit({ id: true, createdAt: true });
export type SavedProspectList = typeof savedProspectLists.$inferSelect;
export type InsertSavedList = z.infer<typeof insertSavedListSchema>;

export const savedProspectListItems = pgTable("saved_prospect_list_items", {
  id: serial("id").primaryKey(),
  listId: integer("list_id").notNull(),
  prospectId: integer("prospect_id").notNull(),
  notes: text("notes").notNull().default(""),
  priority: text("priority").notNull().default("medium"),
  addedAt: timestamp("added_at").defaultNow().notNull(),
  sponsorName: text("sponsor_name").notNull().default(""),
  city: text("city").notNull().default(""),
  industry: text("industry").notNull().default(""),
  participants: integer("participants").notNull().default(0),
  metroLabel: text("metro_label").notNull().default(""),
  ein: text("ein").notNull().default(""),
  matchScore: integer("match_score").notNull().default(0),
  estCommission: integer("est_commission").notNull().default(0),
});

export const insertSavedListItemSchema = createInsertSchema(savedProspectListItems).omit({ id: true, addedAt: true });
export type SavedProspectListItem = typeof savedProspectListItems.$inferSelect;
export type InsertSavedListItem = z.infer<typeof insertSavedListItemSchema>;

export const conversations = pgTable("conversations", {
  id: serial("id").primaryKey(),
  title: text("title").notNull().default("New Chat"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertConversationSchema = createInsertSchema(conversations).omit({ id: true, createdAt: true });
export type Conversation = typeof conversations.$inferSelect;
export type InsertConversation = z.infer<typeof insertConversationSchema>;

export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").notNull(),
  role: text("role").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertMessageSchema = createInsertSchema(messages).omit({ id: true, createdAt: true });
export type Message = typeof messages.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;
