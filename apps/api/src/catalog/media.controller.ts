import { Controller, Get, Header, Param, ParseUUIDPipe, StreamableFile } from '@nestjs/common';
import { Public } from '../auth/auth.decorators.js';
import { CatalogService } from './catalog.service.js';

@Controller('media')
export class MediaController {
  constructor(private readonly catalog: CatalogService) {}

  @Public()
  @Get(':id')
  @Header('Cache-Control', 'public, max-age=31536000, immutable')
  @Header('X-Content-Type-Options', 'nosniff')
  async image(@Param('id', new ParseUUIDPipe()) id: string) {
    return new StreamableFile(await this.catalog.image(id), { type: 'image/webp' });
  }
}
