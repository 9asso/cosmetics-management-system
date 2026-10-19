import { Catalog } from "@/components/Catalog";
import { CategoryShowcase } from "@/components/CategoryShowcase";
import { HeroCarousel } from "@/components/HeroCarousel";
import { PartnersMarquee } from "@/components/PartnersMarquee";
import { ProductTabs } from "@/components/ProductTabs";
import { PromoBanner } from "@/components/PromoBanner";
import { RoutineBuilder } from "@/components/RoutineBuilder";
import { InstagramFeed, TikTokFeed } from "@/components/SocialFeeds";
import { TrendingBrands } from "@/components/TrendingBrands";
import { getInstagramPosts } from "@/lib/instagram";

export default async function Home() {
  const instagramPosts = await getInstagramPosts();
  return (
    <>
      <HeroCarousel />
      <PartnersMarquee />
      <CategoryShowcase />
      <TrendingBrands />
      <ProductTabs />
      <PromoBanner />
      <RoutineBuilder />
      {/* <ValueStats /> */}
      <Catalog />
      <InstagramFeed posts={instagramPosts} />
      <TikTokFeed />
    </>
  );
}
