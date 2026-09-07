import { Controller, Get, Header, Param, ParseUUIDPipe, StreamableFile, Headers, Res } from '@nestjs/common';
import { Public } from '../auth/auth.decorators.js';
import { CatalogService } from './catalog.service.js';

@Controller('media')
export class MediaController {
  constructor(private readonly catalog: CatalogService) {}

  @Public()
  @Get('assets/:id')
  async asset(@Param('id', new ParseUUIDPipe()) id: string, @Headers('range') range: string | undefined,
    @Res() response: { status(code: number): unknown; setHeader(name: string, value: string | number): unknown; end(data?: Buffer): unknown }) {
    const asset = await this.catalog.mediaAsset(id);
    response.setHeader('Content-Type', asset.mime);
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    response.setHeader('Accept-Ranges', 'bytes');
    const length = asset.data.length;
    if (range) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(range);
      const start = match?.[1] ? Number(match[1]) : Math.max(0, length - Number(match?.[2]));
      const end = match?.[1] && match[2] ? Math.min(Number(match[2]), length - 1) : length - 1;
      if (!match || (!match[1] && !match[2]) || !Number.isSafeInteger(start) || start < 0 || start > end || start >= length) {
        response.status(416); response.setHeader('Content-Range', `bytes */${length}`); response.end(); return;
      }
      response.status(206);
      response.setHeader('Content-Range', `bytes ${start}-${end}/${length}`);
      response.setHeader('Content-Length', end - start + 1);
      response.end(asset.data.subarray(start, end + 1)); return;
    }
    response.setHeader('Content-Length', length);
    response.end(asset.data);
  }

  @Public()
  @Get(':id')
  @Header('Cache-Control', 'public, max-age=31536000, immutable')
  @Header('X-Content-Type-Options', 'nosniff')
  async image(@Param('id', new ParseUUIDPipe()) id: string) {
    return new StreamableFile(await this.catalog.image(id), { type: 'image/webp' });
  }
}
