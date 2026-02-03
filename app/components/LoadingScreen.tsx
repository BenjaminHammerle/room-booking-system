"use client";

import { ShieldCheck } from "lucide-react";

interface LoadingScreenProps {
  text?: string;
}

export default function LoadingScreen({ 
  text = "mci system check..." 
}: LoadingScreenProps) {
  return (
    <div className="rbs-loading-screen">
      <ShieldCheck size={80} className="mb-6 text-[var(--rbs-light-blue)]" />
      <span>{text}</span>
    </div>
  );
}
