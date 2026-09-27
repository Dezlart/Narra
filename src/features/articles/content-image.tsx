"use client";
import { useState } from "react";
import Image from "next/image";
import { ImageOff } from "lucide-react";

type Props = { src: string; alt: string; width?: number; height?: number; fill?: boolean; sizes?: string; className?: string };
/** Storage outages never replace an article with a broken-image icon. */
export function ContentImage(props: Props) {
  const [failedSource, setFailedSource] = useState<string | null>(null);
  if (failedSource === props.src) return <span role="img" aria-label={props.alt || "Изображение временно недоступно"}
    className={`${props.fill ? "absolute inset-0" : "min-h-40 w-full"} flex flex-col items-center justify-center gap-3 rounded-sm bg-muted px-4 py-8 text-center text-sm text-muted-foreground`}>
    <ImageOff aria-hidden="true" className="size-7 stroke-1" /><span>Изображение временно недоступно</span>{props.alt && <span>{props.alt}</span>}
  </span>;
  return <Image {...props} alt={props.alt} unoptimized onError={() => setFailedSource(props.src)} />;
}
