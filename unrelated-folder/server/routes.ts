import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { getRepoContent, listUserRepos } from "./github";
import { getUncachableStripeClient, getStripePublishableKey } from "./stripeClient";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

const anthropic = new Anthropic({
  apiKey: process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL,
});

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  app.get("/api/github/repos", async (req: Request, res: Response) => {
    try {
      const repos = await listUserRepos();
      res.json(repos);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Use a simpler route for GitHub contents to avoid path-to-regexp issues
  app.get("/api/github/repos/:owner/:repo/contents", async (req: Request, res: Response) => {
    try {
      const owner = String(req.params.owner);
      const repo = String(req.params.repo);
      const path = typeof req.query.path === "string" ? req.query.path : "";
      const content = await getRepoContent(owner, repo, path);
      res.json(content);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/pull-kincaid", async (req: Request, res: Response) => {
    try {
      const { prompt } = z.object({ prompt: z.string() }).parse(req.body);

      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 8192,
        system: "You are an expert engineer with access to the Kincaid IQ transparency engine codebase. Your task is to provide the full source code for the components requested. Return ONLY the code, no markdown blocks, no explanations.",
        messages: [{ role: "user", content: `Pull all code for: ${prompt}` }],
      });

      const content = response.content[0];
      const code = content?.type === "text" ? content.text : "";
      
      await storage.createLog(`Pull Kincaid IQ: ${prompt}`, "anthropic-kincaid", code);

      res.json({ code });
    } catch (error: any) {
      console.error("Error pulling Kincaid IQ code:", error);
      res.status(500).json({ error: "Failed to pull Kincaid IQ code via Claude" });
    }
  });

  app.get(api.logs.list.path, async (req: Request, res: Response) => {
    try {
      const logs = await storage.getLogs();
      res.json(logs);
    } catch (error) {
      console.error("Error fetching logs:", error);
      res.status(500).json({ error: "Failed to fetch logs" });
    }
  });

  app.post(api.logs.create.path, async (req: Request, res: Response) => {
    try {
      const { prompt } = api.logs.create.input.parse(req.body);

      const [openaiResponse, anthropicResponse] = await Promise.allSettled([
        openai.chat.completions.create({
          model: "gpt-5.1",
          messages: [{ role: "user", content: prompt }],
        }),
        anthropic.messages.create({
          model: "claude-sonnet-4-6",
          max_tokens: 8192,
          messages: [{ role: "user", content: prompt }],
        })
      ]);

      let openaiText = "";
      if (openaiResponse.status === "fulfilled") {
        openaiText = openaiResponse.value.choices[0]?.message?.content || "No response content";
      } else {
        openaiText = `Error: ${openaiResponse.reason?.message || "Unknown error"}`;
        console.error("OpenAI Error:", openaiResponse.reason);
      }

      let anthropicText = "";
      if (anthropicResponse.status === "fulfilled") {
        const content = anthropicResponse.value.content[0];
        anthropicText = content?.type === "text" ? content.text : "No text response content";
      } else {
        anthropicText = `Error: ${anthropicResponse.reason?.message || "Unknown error"}`;
        console.error("Anthropic Error:", anthropicResponse.reason);
      }

      const log1 = await storage.createLog(prompt, "openai", openaiText);
      const log2 = await storage.createLog(prompt, "anthropic", anthropicText);

      res.status(201).json([log1, log2]);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      console.error("Error processing prompt:", error);
      res.status(500).json({ error: "Failed to process prompt" });
    }
  });

  // ── Stripe Routes ─────────────────────────────────────────────────────────
  app.get("/api/stripe/publishable-key", async (_req: Request, res: Response) => {
    try {
      const key = await getStripePublishableKey();
      res.json({ publishableKey: key });
    } catch (error: any) {
      res.status(500).json({ error: "Stripe not configured", details: error.message });
    }
  });

  app.get("/api/stripe/products", async (_req: Request, res: Response) => {
    try {
      const stripe = await getUncachableStripeClient();
      const products = await stripe.products.list({ active: true, expand: ["data.default_price"] });
      res.json({ products: products.data });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/stripe/checkout", async (req: Request, res: Response) => {
    try {
      const { priceId, successUrl, cancelUrl, customerId } = z.object({
        priceId: z.string(),
        successUrl: z.string().optional(),
        cancelUrl: z.string().optional(),
        customerId: z.string().optional(),
      }).parse(req.body);

      const stripe = await getUncachableStripeClient();
      const origin = req.headers.origin || `https://${process.env.REPLIT_DOMAINS?.split(",")[0]}`;

      const sessionParams: any = {
        payment_method_types: ["card"],
        mode: "subscription",
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: successUrl || `${origin}/billing?success=1&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: cancelUrl || `${origin}/billing?canceled=1`,
        subscription_data: { trial_period_days: 14 },
      };

      if (customerId) sessionParams.customer = customerId;

      const session = await stripe.checkout.sessions.create(sessionParams);
      res.json({ url: session.url, sessionId: session.id });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/stripe/customer-portal", async (req: Request, res: Response) => {
    try {
      const { customerId } = z.object({ customerId: z.string() }).parse(req.body);
      const stripe = await getUncachableStripeClient();
      const origin = req.headers.origin || `https://${process.env.REPLIT_DOMAINS?.split(",")[0]}`;

      const session = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: `${origin}/billing`,
      });
      res.json({ url: session.url });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/stripe/create-customer", async (req: Request, res: Response) => {
    try {
      const { email, name, metadata } = z.object({
        email: z.string().email(),
        name: z.string().optional(),
        metadata: z.record(z.string()).optional(),
      }).parse(req.body);

      const stripe = await getUncachableStripeClient();
      const customer = await stripe.customers.create({ email, name, metadata });
      res.json({ customerId: customer.id, customer });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/stripe/subscription/:subscriptionId", async (req: Request, res: Response) => {
    try {
      const stripe = await getUncachableStripeClient();
      const subscription = await stripe.subscriptions.retrieve(req.params.subscriptionId as string);
      res.json({ subscription });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ── Pull Code ─────────────────────────────────────────────────────────────
  app.post("/api/pull-code", async (req: Request, res: Response) => {
    try {
      const { prompt } = z.object({ prompt: z.string() }).parse(req.body);

      const response = await openai.chat.completions.create({
        model: "gpt-5.2-codex",
        messages: [
          { role: "system", content: "You are a specialized code generation assistant. Return ONLY the code, no markdown blocks, no explanations." },
          { role: "user", content: prompt }
        ],
      });

      const code = response.choices[0]?.message?.content || "";
      await storage.createLog(prompt, "openai-codex", code);
      res.json({ code });
    } catch (error) {
      console.error("Error pulling code:", error);
      res.status(500).json({ error: "Failed to pull code from ChatGPT" });
    }
  });

  return httpServer;
}
