import { describe, expect, it } from "vitest";
import { parseEmbedPosts } from "./instagram";

const embedHtml = (context: unknown) =>
  `<script>requireLazy([],{"isProfileEmbed":true,"contextJSON":${JSON.stringify(JSON.stringify(context))}});</script>`;

describe("parseEmbedPosts", () => {
  it("reads posts from Instagram's public profile embed", () => {
    const html = embedHtml({
      context: {
        username: "yamourabeauty",
        graphql_media: [
          {
            shortcode_media: {
              id: "1",
              shortcode: "DepkxqwuEBQ",
              display_url: "https://instagram.example/1.jpg",
              is_video: true,
              edge_media_to_caption: { edges: [{ node: { text: "روتين العناية \"Arencia\"" } }] },
            },
          },
          { shortcode_media: { id: "2", shortcode: "DepUQuEDpK9", display_url: "https://instagram.example/2.jpg" } },
          { shortcode_media: { id: "3", shortcode: "NoImage" } },
        ],
      },
    });
    expect(parseEmbedPosts(html)).toEqual([
      {
        id: "1",
        image: "https://instagram.example/1.jpg",
        caption: "روتين العناية \"Arencia\"",
        permalink: "https://www.instagram.com/p/DepkxqwuEBQ/",
        isVideo: true,
      },
      { id: "2", image: "https://instagram.example/2.jpg", caption: "", permalink: "https://www.instagram.com/p/DepUQuEDpK9/", isVideo: false },
    ]);
  });

  it("returns nothing for a login wall or unexpected markup", () => {
    expect(parseEmbedPosts("<html>Connectez-vous</html>")).toEqual([]);
    expect(parseEmbedPosts('"contextJSON":"{not json"')).toEqual([]);
  });
});
