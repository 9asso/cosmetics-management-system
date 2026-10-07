import "reflect-metadata";
import type { IncomingMessage, ServerResponse } from "node:http";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { AppModule } from "./app.module.js";

type ExpressHandler = (
  request: IncomingMessage,
  response: ServerResponse,
) => void;

let handlerPromise: Promise<ExpressHandler> | undefined;

async function createHandler() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: ["error", "warn", "log"],
  });
  app.useBodyParser("raw", {
    type: "application/octet-stream",
    limit: "30mb",
  });
  app.useBodyParser("json", { limit: "8mb" });

  const origins = new Set(
    (
      process.env.CORS_ORIGINS ??
      "http://localhost:1420,http://localhost:5173,tauri://localhost,http://tauri.localhost,https://tauri.localhost"
    )
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
  );
  for (const hostname of [
    process.env.VERCEL_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL,
  ]) {
    if (hostname) origins.add(`https://${hostname}`);
  }
  app.enableCors({
    origin: (origin, callback) =>
      callback(null, !origin || origins.has(origin)),
    credentials: true,
  });
  app.setGlobalPrefix("api/v1");
  await app.init();
  return app.getHttpAdapter().getInstance() as ExpressHandler;
}

export default async function handler(
  request: IncomingMessage,
  response: ServerResponse,
) {
  handlerPromise ??= createHandler();
  const express = await handlerPromise;
  express(request, response);
}
