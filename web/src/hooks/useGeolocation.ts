"use client";
import { useState } from "react";
// TODO: 현위치 훅 구현
export function useGeolocation() {
  const [coords] = useState<{ lat: number; lng: number } | null>(null);
  return coords;
}
