// Client-agnostic config shared by server + client. nsbp-lume has no Windows
// "D:\\Photos" variant; the photo library lives under the served public/images.
export const useCurrentFlag = true;

export const outPhotoDic = "Photos";
export const outPhotoDicPath = ""; // unused in nsbp-lume (server reads public/images)
