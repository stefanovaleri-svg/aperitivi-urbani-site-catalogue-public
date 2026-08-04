export type PublicMedia = {
  publicPath: string;
  contentType: string;
  mediaType: string | null;
  altText: string | null;
};

export type PublicPost = {
  id: string;
  sourceUrl: string;
  publishedAt: string | null;
  summary: string | null;
  tags: string[];
  media: PublicMedia[];
};

export type PublicVenue = {
  id: string;
  slug: string;
  name: string;
  aliases: string[];
  city: string | null;
  neighbourhood: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  coordinateStatus: "valid" | "missing" | "invalid" | "outlier";
  resolutionStatus: "resolved" | "candidate" | "unresolved";
};

export type PublicCatalog = {
  schemaVersion: string;
  creator: { handle: string; displayName: string; profileUrl: string };
  coverage: {
    expectedPosts: number;
    attemptedPosts: number;
    completePosts: number;
    excludedIncompleteRecords: number;
    venueCount: number;
    mediaCount: number;
  };
  venues: PublicVenue[];
  posts: PublicPost[];
  listings: Array<{
    id: string;
    venueId: string;
    postId: string;
    sourceUrl: string;
  }>;
};
