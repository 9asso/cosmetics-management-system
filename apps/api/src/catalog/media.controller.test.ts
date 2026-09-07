import { describe, expect, it, vi } from 'vitest';
import { MediaController } from './media.controller.js';
import type { CatalogService } from './catalog.service.js';
import { CatalogController } from './catalog.controller.js';
import { AuthGuard } from '../auth/auth.guard.js';
import { Reflector } from '@nestjs/core';
import type { AuthService } from '../auth/auth.service.js';
import type { ExecutionContext } from '@nestjs/common';
describe('media delivery', () => {
  it.each([['bytes=2-4',206,'234'],['bytes=-3',206,'789'],['bytes=8-99',206,'89'],['bytes=10-',416,undefined],['bytes=4-2',416,undefined],['bytes=-',416,undefined],['bytes=0-1,4-5',416,undefined]])('handles range %s',async (range,status,body) => {
    const catalog={mediaAsset:vi.fn().mockResolvedValue({data:Buffer.from('0123456789'),mime:'video/mp4'})} as unknown as CatalogService;
    const response={status:vi.fn(),setHeader:vi.fn(),end:vi.fn()};
    await new MediaController(catalog).asset('id',range,response);
    expect(response.status).toHaveBeenCalledWith(status);
    expect(response.end.mock.calls[0]?.[0]?.toString()).toBe(body);
  });
  it.each(['STAFF','CASHIER','ACCOUNTANT'])('rejects media changes by %s',async role=>{
    const guard=new AuthGuard(new Reflector(),{authenticate:vi.fn().mockResolvedValue({id:'user',role})} as unknown as AuthService);
    for(const method of ['upload','updateMedia'] as const) {
      const context={getHandler:()=>CatalogController.prototype[method],getClass:()=>CatalogController,switchToHttp:()=>({getRequest:()=>({headers:{authorization:'Bearer test'}})})} as unknown as ExecutionContext;
      await expect(guard.canActivate(context)).rejects.toThrow('permissions');
    }
  });
});
