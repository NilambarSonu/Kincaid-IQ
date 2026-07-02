import { db } from "./db";
import {
  logs,
  prospects5500Indiana,
  brokerProfiles,
  brokerBooks,
  savedProspectLists,
  savedProspectListItems,
} from "@shared/schema";
import type {
  Prospect5500,
  InsertProspect5500,
  BrokerProfile,
  InsertBrokerProfile,
  BrokerBook,
  InsertBrokerBook,
  SavedProspectList,
  InsertSavedList,
  SavedProspectListItem,
  InsertSavedListItem,
} from "@shared/schema";
import { eq, desc, count } from "drizzle-orm";

export interface IStorage {
  getLogs(): Promise<typeof logs.$inferSelect[]>;
  createLog(prompt: string, provider: string, response: string): Promise<typeof logs.$inferSelect>;
  getProspectCount(): Promise<number>;
  getAllProspects(): Promise<Prospect5500[]>;
  createProspect(data: InsertProspect5500): Promise<Prospect5500>;
  createBrokerProfile(data: InsertBrokerProfile): Promise<BrokerProfile>;
  createBookClient(data: InsertBrokerBook): Promise<BrokerBook>;
  createSavedList(data: InsertSavedList): Promise<SavedProspectList>;
  createListItem(data: InsertSavedListItem): Promise<SavedProspectListItem>;
}

export class DatabaseStorage implements IStorage {
  async getLogs() {
    return await db.select().from(logs).orderBy(desc(logs.createdAt));
  }

  async createLog(prompt: string, provider: string, response: string) {
    const [log] = await db
      .insert(logs)
      .values({ prompt, provider, response })
      .returning();
    return log;
  }

  async getProspectCount(): Promise<number> {
    const [row] = await db.select({ value: count() }).from(prospects5500Indiana);
    return row?.value ?? 0;
  }

  async getAllProspects(): Promise<Prospect5500[]> {
    return db.select().from(prospects5500Indiana);
  }

  async createProspect(data: InsertProspect5500): Promise<Prospect5500> {
    const [row] = await db.insert(prospects5500Indiana).values(data).returning();
    return row;
  }

  async createBrokerProfile(data: InsertBrokerProfile): Promise<BrokerProfile> {
    const [row] = await db.insert(brokerProfiles).values(data).returning();
    return row;
  }

  async createBookClient(data: InsertBrokerBook): Promise<BrokerBook> {
    const [row] = await db.insert(brokerBooks).values(data).returning();
    return row;
  }

  async createSavedList(data: InsertSavedList): Promise<SavedProspectList> {
    const [row] = await db.insert(savedProspectLists).values(data).returning();
    return row;
  }

  async createListItem(data: InsertSavedListItem): Promise<SavedProspectListItem> {
    const [row] = await db.insert(savedProspectListItems).values(data).returning();
    return row;
  }
}

export const storage = new DatabaseStorage();
