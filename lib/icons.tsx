import React from "react";
import { 
  Wifi, Monitor, Video, Cast, Mic, Smartphone, 
  PencilLine, Layers, Accessibility, Volume2, Video as VideoIcon, Tv, PcCase
} from "lucide-react";

// zentrales mapping der equipment-ids auf lucide icons
export const getEquipmentIcon = (id: string | undefined, size = 12) => {
  const i = id?.toLowerCase() || "";
  if (i === "beamer") return <Video size={size} />;
  if (i === "wifi") return <Wifi size={size} />;
  if (i === "whitboard") return <PencilLine size={size} />;
  if (i === "sound") return <Volume2 size={size} />;
  if (i === "videoconf") return <VideoIcon size={size} />;
  if (i === "pc") return <Monitor size={size} />;
  if (i === "tv") return <Tv size={size} />;
  if (i === "accessible" || i === "barrierefrei") return <Accessibility size={size} />;
  return <Layers size={size} />; // fallback icon
};