// Also makes the five tab routes prefetchable, so leaving a detail page for a
// tab (Done, a back link) switches instantly — the pager shows the pane, which
// is already mounted, and this fallback is never visible there.
import { PageSkeleton } from "@/components/route-skeletons";

export default PageSkeleton;
