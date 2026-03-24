import React, { useState } from 'react';
import { MapPin, ExternalLink } from 'lucide-react';
import { buildStaticMapUrl, isGeocodingConfigured } from '@/utils/geocoding';

interface PropertyMapWidgetProps {
  latitude: number;
  longitude: number;
  address?: string;
  height?: number;
}

export function PropertyMapWidget({
  latitude,
  longitude,
  address,
  height = 200,
}: PropertyMapWidgetProps) {
  const [imgError, setImgError] = useState(false);

  const googleMapsUrl = `https://www.google.com/maps?q=${latitude},${longitude}`;

  if (!isGeocodingConfigured() || imgError) {
    return (
      <div
        className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-slate-200 bg-slate-50 text-slate-400"
        style={{ height }}
      >
        <MapPin className="w-5 h-5" />
        {address && <p className="text-xs text-center px-4">{address}</p>}
        <a
          href={googleMapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-xs text-blue-500 hover:underline"
        >
          <ExternalLink className="w-3 h-3" />
          Apri in Google Maps
        </a>
      </div>
    );
  }

  const mapUrl = buildStaticMapUrl(latitude, longitude, 600, height);

  if (!mapUrl) return null;

  return (
    <div className="relative rounded-lg overflow-hidden border border-slate-200">
      <img
        src={mapUrl}
        alt={address ? `Mappa: ${address}` : 'Mappa proprietà'}
        className="w-full object-cover"
        style={{ height }}
        onError={() => setImgError(true)}
      />
      <a
        href={googleMapsUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="absolute bottom-2 right-2 flex items-center gap-1 rounded-md bg-white/90 px-2 py-1 text-xs text-slate-700 shadow hover:bg-white transition-colors"
      >
        <ExternalLink className="w-3 h-3" />
        Apri in Maps
      </a>
    </div>
  );
}
