import { FeedSkeleton } from "@/features/public-content/feed";
export default function Loading() {
  return <main id="main-content" tabIndex={-1} className="page-container py-12"><FeedSkeleton /></main>;
}
