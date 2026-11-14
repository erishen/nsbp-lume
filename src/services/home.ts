import { doGet } from "@utils/fetch";
import { GET_PHOTO_MENU } from "@store/constants";
import type { Dispatch } from "redux";

// Prefetch the photo menu into the store during SSR (called from the node SSR
// backend via route.loadData), and/or on the client. nsbp-lume's doGet resolves
// to { data, status } where data is the parsed JSON body ({ data: [...] }).
export const loadData = (
  resolve: ((data?: unknown) => void) | null = null
) => {
  return (dispatch: Dispatch) => {
    doGet("/getPhotoMenu")
      .then((res) => {
        if (res.status >= 200 && res.status < 300) {
          dispatch({
            type: GET_PHOTO_MENU,
            menu: res.data?.data || [],
          });
          resolve && resolve(res.data);
        } else {
          throw new Error(`Status ${res.status}`);
        }
      })
      .catch((err: Error) => {
        console.error("Failed to preload photos:", err);
        resolve && resolve();
      });
  };
};
