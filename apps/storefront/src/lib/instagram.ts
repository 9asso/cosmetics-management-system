import { site } from "./site";

export type InstagramPost = {
  id: string;
  image: string;
  caption: string;
  permalink: string;
  isVideo: boolean;
};

type GraphMedia = {
  id: string;
  caption?: string;
  media_type: "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM";
  media_url?: string;
  thumbnail_url?: string;
  permalink: string;
};

type EmbedMedia = {
  id: string;
  shortcode: string;
  display_url?: string;
  is_video?: boolean;
  edge_media_to_caption?: { edges?: Array<{ node?: { text?: string } }> };
};

/** Instagram image URLs are signed and expire after a few days, so refresh well before. */
const REFRESH_SECONDS = 1800;

/**
 * Latest posts of the shop's Instagram account.
 * With INSTAGRAM_ACCESS_TOKEN (a long-lived token for the professional account)
 * the official Graph API is used; otherwise the account's public profile embed.
 */
export async function getInstagramPosts(limit = 8): Promise<InstagramPost[]> {
  const fromApi = await graphApiPosts(limit);
  return fromApi.length ? fromApi : embedPosts(site.instagram.handle, limit);
}

async function graphApiPosts(limit: number): Promise<InstagramPost[]> {
  const token = process.env.INSTAGRAM_ACCESS_TOKEN;
  if (!token) return [];
  const url = new URL("https://graph.instagram.com/me/media");
  url.searchParams.set("fields", "id,caption,media_type,media_url,thumbnail_url,permalink");
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("access_token", token);
  try {
    const response = await fetch(url, { next: { revalidate: REFRESH_SECONDS } });
    if (!response.ok) return [];
    const body = (await response.json()) as { data?: GraphMedia[] };
    return (body.data ?? [])
      .map((media) => ({
        id: media.id,
        image: (media.media_type === "VIDEO" ? media.thumbnail_url : media.media_url) ?? "",
        caption: media.caption ?? "",
        permalink: media.permalink,
        isVideo: media.media_type === "VIDEO",
      }))
      .filter((post) => post.image);
  } catch {
    return [];
  }
}

/** Reads the posts Instagram ships with its public profile embed (instagram.com/<handle>/embed/). */
async function embedPosts(handle: string, limit: number): Promise<InstagramPost[]> {
  try {
    // A full browser user-agent gets a script-only page; a short one gets the posts inline.
    const response = await fetch(`https://www.instagram.com/${encodeURIComponent(handle)}/embed/`, {
      headers: { "User-Agent": "Mozilla/5.0", "Accept-Language": "fr-FR,fr;q=0.9" },
      next: { revalidate: REFRESH_SECONDS },
    });
    if (!response.ok) return [];
    return parseEmbedPosts(await response.text()).slice(0, limit);
  } catch {
    return [];
  }
}

export function parseEmbedPosts(html: string): InstagramPost[] {
  const match = /"contextJSON":("(?:[^"\\]|\\.)*")/.exec(html);
  if (!match) return [];
  try {
    const context = JSON.parse(JSON.parse(match[1]!) as string) as {
      context?: { graphql_media?: Array<{ shortcode_media?: EmbedMedia }> };
    };
    return (context.context?.graphql_media ?? []).flatMap(({ shortcode_media: media }) =>
      media?.display_url && media.shortcode
        ? [
            {
              id: media.id,
              image: media.display_url,
              caption: media.edge_media_to_caption?.edges?.[0]?.node?.text ?? "",
              permalink: `https://www.instagram.com/p/${media.shortcode}/`,
              isVideo: Boolean(media.is_video),
            },
          ]
        : [],
    );
  } catch {
    return [];
  }
}
