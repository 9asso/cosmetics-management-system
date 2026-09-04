import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';

const app = await NestFactory.create(AppModule);
const origins = (process.env.CORS_ORIGINS ?? 'http://localhost:1420,http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim());

app.enableCors({ origin: origins, credentials: true });
app.setGlobalPrefix('api/v1');
app.enableShutdownHooks();

if (process.env.NODE_ENV !== 'production') {
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Cosmetics Commerce API')
    .setDescription('Wholesale management and retail commerce platform API')
    .setVersion('0.2.0')
    .build();
  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, swaggerConfig));
}

await app.listen(Number(process.env.API_PORT ?? 4000));
