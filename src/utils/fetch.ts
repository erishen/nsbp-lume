// Native-fetch variant of nsbp's axios-based doGet. Keep the same call shape
// (doGet returns a Promise that resolves to a response-like object with `.data`
// and `.status`) so services/home + services/photo stay unchanged.
export const doGet = (action: string) => {
  return new Promise<{ data: any; status: number }>((resolve, reject) => {
    let url = action;
    if (action.indexOf("http") === -1) {
      // same-origin: the Lume relay (react_prefix="/") forwards /getPhoto* and
      // /images/* to the node backend; relative URLs keep it host-agnostic.
      if (action.charAt(0) !== "/") url = "/" + action;
    }
    const base =
      typeof window !== "undefined" && "fetch" in window
        ? window.location.origin
        : "";
    const fullUrl =
      action.indexOf("http") !== -1 ? url : base + (url.startsWith("/") ? url : "/" + url);
    fetch(fullUrl, { method: "GET" })
      .then((res) => {
        return res.json().then((data) => {
          resolve({ data, status: res.status });
        });
      })
      .catch(reject);
  });
};
