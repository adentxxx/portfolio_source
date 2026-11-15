"use client";

import { publicPath } from "@/lib/public-path";
import { useState } from "react";

export function CaseImage({
  src,
  inModal = false,
}: {
  src: string;
  /** Inside the case modal: no scroll roll, the modal's own corner radius. */
  inModal?: boolean;
}) {
  const [ready, setReady] = useState(false);

  return (
    <div
      data-roll={inModal ? undefined : "media"}
      className={
        inModal
          ? "card-modal-media relative aspect-[116/50] w-full overflow-hidden bg-surface-control"
          : "relative aspect-[116/50] w-full overflow-hidden rounded-[24px] bg-surface-control"
      }
    >
      {ready ? null : <div className="media-skeleton absolute inset-0" aria-hidden />}
      {/* Unoptimized case photos. A native img reports load even when the
          file is already in cache; next/image can leave the skeleton up. */}
      <img
        src={publicPath(src)}
        alt=""
        className={
          ready
            ? "absolute inset-0 size-full object-cover"
            : "absolute inset-0 size-full object-cover opacity-0"
        }
        onLoad={() => setReady(true)}
        onError={() => setReady(true)}
        ref={(node) => {
          if (node?.complete) setReady(true);
        }}
      />
    </div>
  );
}
