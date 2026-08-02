const FACE_ID_PREFIX = "releases/face-id";

const FIXED_ASSETS = Object.freeze({
  "face-id-explicit-mp3": {
    key: `${FACE_ID_PREFIX}/masters/saint-ed-x-face-id-explicit.mp3`,
    filename: "Saint Ed X - Face ID (Explicit).mp3",
    contentType: "audio/mpeg",
    accessTypes: ["DJ"]
  },
  "face-id-clean-mp3": {
    key: `${FACE_ID_PREFIX}/masters/saint-ed-x-face-id-clean.mp3`,
    filename: "Saint Ed X - Face ID (Clean).mp3",
    contentType: "audio/mpeg",
    accessTypes: ["DJ"]
  },
  "face-id-explicit-wav": {
    key: `${FACE_ID_PREFIX}/masters/saint-ed-x-face-id-explicit.wav`,
    filename: "Saint Ed X - Face ID (Explicit).wav",
    contentType: "audio/wav",
    accessTypes: ["DJ"]
  },
  "face-id-clean-wav": {
    key: `${FACE_ID_PREFIX}/masters/saint-ed-x-face-id-clean.wav`,
    filename: "Saint Ed X - Face ID (Clean).wav",
    contentType: "audio/wav",
    accessTypes: ["DJ"]
  },
  "face-id-dj-cover": {
    key: `${FACE_ID_PREFIX}/artwork/saint-ed-x-face-id-dj-cover.png`,
    filename: "Saint Ed X - Face ID - DJ Cover.png",
    contentType: "image/png",
    accessTypes: ["DJ"]
  },
  "white-bronco-dj-cover": {
    key: "releases/white-bronco/artwork/saint-ed-x-white-bronco-dj-cover.png",
    filename: "Saint Ed X - White Bronco - DJ Cover.png",
    contentType: "image/png",
    accessTypes: ["DJ"]
  },
  "amber-dj-cover": {
    key: "releases/amber/artwork/saint-ed-x-amber-dj-cover.png",
    filename: "Saint Ed X - Amber - DJ Cover.png",
    contentType: "image/png",
    accessTypes: ["DJ"]
  }
});

export const PRIVATE_ASSET_IDS = Object.freeze(Object.keys(FIXED_ASSETS));

export function resolvePrivateAsset(assetId, context) {
  const fixed = FIXED_ASSETS[String(assetId || "")];
  if (fixed) return fixed;

  if (assetId === "face-id-personalized-artwork" && context?.recipientId &&
      context?.personalizedArtworkAvailable) {
    return {
      key: `recipients/${context.recipientId}/artwork/face-id-licensed-preview.jpg`,
      filename: "Saint Ed X - Face ID (Licensed Preview).jpg",
      contentType: "image/jpeg",
      accessTypes: ["DJ"]
    };
  }
  return null;
}
