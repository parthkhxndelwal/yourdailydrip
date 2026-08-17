import { Leaf } from "lucide-react";

import { isVideoUrl } from "@/lib/products";
import { cn } from "@/lib/utils";

export function ProductImageGallery({
  name,
  images,
  active,
  onSelect,
}: {
  name: string;
  images: string[];
  active: number;
  onSelect: (index: number) => void;
}) {
  const image = images[active];

  return (
    <div>
      {image ? (
        <>
          {isVideoUrl(image) ? (
            <video
              src={image}
              controls
              autoPlay
              muted
              loop
              playsInline
              preload="metadata"
              aria-label={`${name} — video ${active + 1}`}
              className="aspect-square w-full rounded-2xl bg-sand object-contain"
            />
          ) : (
            <img
              src={image}
              alt={`${name} — view ${active + 1}`}
              width={900}
              height={900}
              className="aspect-square w-full rounded-2xl bg-sand object-contain"
            />
          )}
          {images.length > 1 && (
            <div className="mt-4 flex gap-3">
              {images.map((img, i) => (
                <button
                  key={i}
                  onClick={() => onSelect(i)}
                  aria-label={`View image ${i + 1}`}
                  className={cn(
                    "size-20 overflow-hidden rounded-lg border-2 bg-sand",
                    i === active ? "border-primary" : "border-transparent",
                  )}
                >
                  {isVideoUrl(img) ? (
                    <video src={img} muted playsInline preload="metadata" className="size-full object-cover" />
                  ) : (
                    <img src={img} alt="" width={80} height={80} loading="lazy" className="size-full object-cover" />
                  )}
                </button>
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="grid aspect-square w-full place-items-center rounded-2xl bg-sand">
          <div className="text-center">
            <Leaf className="mx-auto size-10 text-leaf" />
            <p className="mt-2 text-sm text-muted-foreground">Image coming soon</p>
          </div>
        </div>
      )}
    </div>
  );
}
