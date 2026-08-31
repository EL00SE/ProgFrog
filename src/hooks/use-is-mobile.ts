"use client";

import * as React from "react";

const MOBILE_QUERY = "(max-width: 639px)";

/** True on phone-width screens. Starts false (SSR-safe), settles after mount. */
export function useIsMobile() {
  const [mobile, setMobile] = React.useState(false);
  React.useEffect(() => {
    const mq = window.matchMedia(MOBILE_QUERY);
    const sync = () => setMobile(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  return mobile;
}
