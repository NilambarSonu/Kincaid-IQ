import { getStripeSync } from './stripeClient';

export class WebhookHandlers {
  static async processWebhook(payload: Buffer, signature: string): Promise<void> {
    const stripeSync = await getStripeSync();
    await stripeSync.processWebhook(payload, signature);
  }
}
