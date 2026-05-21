import { env as privateEnv } from "$env/dynamic/private";
import { init, type InstantAdminDatabase } from "@instantdb/admin";
import schema from "../../instant.schema";
import type { AppSchema } from "../../instant.schema";

function requiredEnv(name: string, value: string | undefined) {
  if (!value) {
    throw new Error(`${name} is not configured.`);
  }

  return value;
}

let adminDb: InstantAdminDatabase<AppSchema, true, any> | null = null;

export function getAdminDb() {
  adminDb ??= init({
    appId: requiredEnv("VITE_INSTANT_APP_ID", privateEnv.VITE_INSTANT_APP_ID),
    adminToken: requiredEnv("INSTANT_APP_ADMIN_TOKEN", privateEnv.INSTANT_APP_ADMIN_TOKEN),
    schema,
    useDateObjects: true,
  });

  return adminDb;
}
