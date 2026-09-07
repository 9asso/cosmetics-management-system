// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import type { ProductMediaInput } from '@cosmetics/contracts';
import { ProductMediaEditor } from './ProductMediaEditor';
import { api } from '../lib/api';
vi.mock('../lib/api', () => ({api:{uploadProductMedia:vi.fn()}}));
afterEach(() => {cleanup();vi.resetAllMocks();});
function Harness() {
  const [media,setMedia] = useState<ProductMediaInput>({images:['/first.webp','/second.webp'],videoUrl:'/preview.mp4'});
  return <><ProductMediaEditor value={media} onChange={setMedia}/><output>{JSON.stringify(media)}</output></>;
}
describe('product media editor', () => {
  it('changes the featured image, removes a photo and removes the single preview', () => {
    render(<Harness/>);
    fireEvent.click(screen.getByRole('button',{name:'Mettre à la une'}));
    expect(screen.getByRole('status').textContent).toContain('"images":["/second.webp","/first.webp"]');
    fireEvent.click(screen.getByRole('button',{name:'Retirer l’image 1'}));
    fireEvent.click(screen.getByRole('button',{name:'Retirer la vidéo'}));
    expect(screen.getByRole('status').textContent).toBe('{"images":["/first.webp"],"videoUrl":""}');
  });
  it('uploads each selected image and preserves successful uploads if a later file fails', async () => {
    vi.mocked(api.uploadProductMedia).mockResolvedValueOnce({url:'/uploaded.webp',type:'image'}).mockRejectedValueOnce(new Error('Connexion interrompue'));
    render(<Harness/>);
    fireEvent.change(screen.getByLabelText('Ajouter des images (5 Mo chacune)'),{target:{files:[new File(['a'],'a.png',{type:'image/png'}),new File(['b'],'b.png',{type:'image/png'})]}});
    await screen.findByRole('alert');
    expect(screen.getByRole('alert').textContent).toContain('Connexion interrompue');
    await waitFor(()=>expect(screen.getByRole('status').textContent).toContain('/uploaded.webp'));
  });
  it('rejects unsupported files before uploading', async () => {
    render(<Harness/>);
    fireEvent.change(screen.getByLabelText('Ajouter des images (5 Mo chacune)'),{target:{files:[new File(['<svg/>'],'unsafe.svg',{type:'image/svg+xml'})]}});
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(api.uploadProductMedia).not.toHaveBeenCalled();
  });
});
