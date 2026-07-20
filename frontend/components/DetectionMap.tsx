"use client";

import { useEffect, useRef } from "react";
import { severityColor } from "@/lib/colors";

export interface Pin {
  id: string;
  lat: number;
  lng: number;
  type: "trash" | "pothole";
  severity: number;
  image: string | null;
  time: string;
}

const timeFmt = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
});

interface Props {
  pins: Pin[];
  onResolve?: (pin: Pin) => Promise<void> | void;
  onPinClick?: (pin: Pin) => void;
  focusPin?: Pin | null;
  userLocation?: { lat: number; lng: number } | null;
}

function pinKey(p: Pin): string {
  return `${p.lat},${p.lng},${p.type}`;
}

export default function DetectionMap({ pins, onResolve, onPinClick, focusPin, userLocation }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<unknown>(null);
  const layerRef = useRef<unknown>(null);
  const userLayerRef = useRef<unknown>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markersRef = useRef<Map<string, any>>(new Map());
  const onResolveRef = useRef(onResolve);
  onResolveRef.current = onResolve;
  const onPinClickRef = useRef(onPinClick);
  onPinClickRef.current = onPinClick;

  useEffect(() => {
    if (!mapRef.current) return;
    let aborted = false;

    if (!document.querySelector('link[href*="leaflet"]')) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }

    import("leaflet").then((L) => {
      if (aborted || !mapRef.current) return;

      if (!mapInstanceRef.current) {
        const map = L.map(mapRef.current, { zoomControl: true, scrollWheelZoom: true });
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: "© OpenStreetMap contributors",
        }).addTo(map);
        mapInstanceRef.current = map;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const map = mapInstanceRef.current as any;
      if (layerRef.current) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (layerRef.current as any).remove();
      }
      markersRef.current.clear();
      const group = L.layerGroup().addTo(map);
      layerRef.current = group;

      if (pins.length === 0) {
        map.setView([20, 0], 2);
        return;
      }

      pins.forEach((pin) => {
        const color = severityColor(pin.severity);
        const radius = 6 + (Math.max(0, Math.min(100, pin.severity)) / 100) * 14;
        const marker = L.circleMarker([pin.lat, pin.lng], {
          radius,
          color,
          weight: 2,
          fillColor: color,
          fillOpacity: 0.55,
        });
        marker.bindPopup(() => buildPopup(pin, onResolveRef));
        marker.on('click', () => {
          if (onPinClickRef.current) {
            onPinClickRef.current(pin);
          }
        });
        marker.addTo(group);
        markersRef.current.set(pinKey(pin), marker);
      });

      if (pins.length === 1) {
        map.setView([pins[0].lat, pins[0].lng], 14);
      } else {
        const lats = pins.map((p) => p.lat);
        const lngs = pins.map((p) => p.lng);
        map.fitBounds(
          L.latLngBounds([Math.min(...lats), Math.min(...lngs)], [Math.max(...lats), Math.max(...lngs)]),
          { padding: [30, 30] },
        );
      }
    });

    return () => {
      aborted = true;
    };
  }, [pins]);

  // focusPin — fly to and open popup when changed
  useEffect(() => {
    if (!focusPin || !mapInstanceRef.current) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const map = mapInstanceRef.current as any;
    map.flyTo([focusPin.lat, focusPin.lng], Math.max(map.getZoom(), 15), { duration: 0.6 });
    const marker = markersRef.current.get(pinKey(focusPin));
    if (marker) {
      setTimeout(() => marker.openPopup(), 650);
    }
  }, [focusPin]);

  // user location marker
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    import("leaflet").then((L) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const map = mapInstanceRef.current as any;
      if (userLayerRef.current) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (userLayerRef.current as any).remove();
        userLayerRef.current = null;
      }
      if (!userLocation) return;
      const layer = L.layerGroup().addTo(map);
      L.circleMarker([userLocation.lat, userLocation.lng], {
        radius: 8,
        color: "#fff",
        weight: 3,
        fillColor: "#3b82f6",
        fillOpacity: 0.9,
      })
        .bindTooltip("You are here")
        .addTo(layer);
      userLayerRef.current = layer;
    });
  }, [userLocation]);

  // invalidate size on container resize (fullscreen toggle, layout changes)
  useEffect(() => {
    if (!mapRef.current) return;
    const el = mapRef.current;
    const ro = new ResizeObserver(() => {
      if (mapInstanceRef.current) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (mapInstanceRef.current as any).invalidateSize();
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (mapInstanceRef.current as any).remove();
        mapInstanceRef.current = null;
        layerRef.current = null;
        userLayerRef.current = null;
        markersRef.current.clear();
      }
    };
  }, []);

  return (
    <div
      ref={mapRef}
      style={{
        height: "100%",
        minHeight: "480px",
        width: "100%",
        overflow: "hidden",
      }}
    />
  );
}

function buildPopup(
  pin: Pin,
  onResolveRef: React.MutableRefObject<((pin: Pin) => Promise<void> | void) | undefined>,
): HTMLElement {
  const root = document.createElement("div");
  root.style.minWidth = "240px";

  if (pin.image) {
    const img = document.createElement("img");
    img.src = pin.image;
    img.width = 240;
    img.style.borderRadius = "8px";
    img.style.display = "block";
    img.style.marginBottom = "6px";
    root.appendChild(img);
  }

  const meta = document.createElement("div");
  meta.innerHTML = `<b>${pin.type === "pothole" ? "POTHOLE" : "TRASH"}</b> · severity ${pin.severity.toFixed(1)}<br/><span style="color:#888">${timeFmt.format(new Date(pin.time))}</span>`;
  root.appendChild(meta);

  if (onResolveRef.current) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = "Resolve";
    btn.style.cssText =
      "margin-top:8px;background:#3CFFD0;color:#000;font-weight:700;font-size:11px;letter-spacing:0.15em;text-transform:uppercase;padding:6px 14px;border-radius:18px;border:0;cursor:pointer";
    btn.onclick = async () => {
      if (!onResolveRef.current) return;
      btn.disabled = true;
      btn.textContent = "Resolving…";
      try {
        await onResolveRef.current(pin);
      } catch {
        btn.disabled = false;
        btn.textContent = "Retry resolve";
      }
    };
    root.appendChild(btn);
  }

  return root;
}
