"use client";

import { usePathname } from "next/navigation";
import Script from "next/script";
import { useEffect, useRef } from "react";

const YM_COUNTER_ID = 114692409;

declare global {
  interface Window {
    ym?: (...args: unknown[]) => void;
  }
}

function isPrivatePath(pathname: string) {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}

/**
 * Yandex Metrica counter, the owner's snippet as is. The first page view
 * comes from `init`; later App Router navigations send their own `hit`,
 * with the previous address as the referrer. The admin is never counted
 * or recorded by Webvisor.
 */
export function YandexMetrika() {
  const pathname = usePathname();
  const skip = isPrivatePath(pathname);
  const previous = useRef<string | null>(null);

  useEffect(() => {
    if (skip) return;
    const url = window.location.href;
    if (previous.current === null) {
      previous.current = url;
      return;
    }
    if (previous.current === url) return;
    window.ym?.(YM_COUNTER_ID, "hit", url, { referer: previous.current });
    previous.current = url;
  }, [pathname, skip]);

  if (skip) return null;

  return (
    <>
      <Script id="yandex-metrika" strategy="afterInteractive">
        {`(function(m,e,t,r,i,k,a){
    m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
    m[i].l=1*new Date();
    for (var j = 0; j < document.scripts.length; j++) {if (document.scripts[j].src === r) { return; }}
    k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)
})(window, document,'script','https://mc.yandex.ru/metrika/tag.js?id=${YM_COUNTER_ID}', 'ym');

ym(${YM_COUNTER_ID}, 'init', {ssr:true, webvisor:true, clickmap:true, ecommerce:"dataLayer", referrer: document.referrer, url: location.href, accurateTrackBounce:true, trackLinks:true});`}
      </Script>
      <noscript>
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`https://mc.yandex.ru/watch/${YM_COUNTER_ID}`}
            style={{ position: "absolute", left: "-9999px" }}
            alt=""
          />
        </div>
      </noscript>
    </>
  );
}
