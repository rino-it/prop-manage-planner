import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Cloud, CloudRain, CloudSnow, CloudLightning, Sun, CloudDrizzle, CloudFog, Wind, Droplets, Thermometer } from 'lucide-react';
import { fetchWeatherForecast, getWeatherSeverity, type WeatherDay } from '@/utils/weather';
import { format, parseISO } from 'date-fns';
import { it } from 'date-fns/locale';

interface WeatherWidgetProps {
  latitude: number;
  longitude: number;
  propertyName?: string;
  compact?: boolean;
  days?: number;
}

const ICON_MAP: Record<string, React.ElementType> = {
  sun: Sun,
  'cloud-sun': Cloud,
  cloud: Cloud,
  'cloud-fog': CloudFog,
  'cloud-drizzle': CloudDrizzle,
  'cloud-rain': CloudRain,
  'cloud-rain-wind': CloudRain,
  'cloud-hail': CloudRain,
  snowflake: CloudSnow,
  'cloud-lightning': CloudLightning,
};

const SEVERITY_COLORS: Record<string, string> = {
  good: 'bg-green-100 text-green-800',
  moderate: 'bg-yellow-100 text-yellow-800',
  bad: 'bg-red-100 text-red-800',
};

function DayCard({ day }: { day: WeatherDay }) {
  const IconComponent = ICON_MAP[day.icon] || Cloud;
  const severity = getWeatherSeverity(day);
  const dateFormatted = format(parseISO(day.date), 'EEE d', { locale: it });

  return (
    <div className="flex flex-col items-center gap-1 p-2 rounded-lg hover:bg-slate-50 transition-colors min-w-[70px]">
      <span className="text-xs font-medium text-slate-600 capitalize">{dateFormatted}</span>
      <IconComponent className={`w-6 h-6 ${severity === 'bad' ? 'text-red-500' : severity === 'moderate' ? 'text-yellow-500' : 'text-blue-400'}`} />
      <div className="flex gap-1 text-xs">
        <span className="font-semibold">{Math.round(day.tempMax)}</span>
        <span className="text-slate-400">{Math.round(day.tempMin)}</span>
      </div>
      {day.precipitation > 0 && (
        <div className="flex items-center gap-0.5 text-xs text-blue-500">
          <Droplets className="w-3 h-3" />
          <span>{day.precipitation.toFixed(1)}</span>
        </div>
      )}
    </div>
  );
}

export function WeatherWidget({ latitude, longitude, propertyName, compact = false, days = 7 }: WeatherWidgetProps) {
  const { data: forecast, isLoading, isError } = useQuery({
    queryKey: ['weather', latitude, longitude, days],
    queryFn: () => fetchWeatherForecast(latitude, longitude, days),
    staleTime: 30 * 60 * 1000, // 30 minuti
    refetchInterval: 60 * 60 * 1000, // 1 ora
    enabled: !!latitude && !!longitude,
  });

  if (isLoading) {
    return (
      <Card className="animate-pulse">
        <CardContent className="p-4">
          <div className="h-16 bg-slate-100 rounded" />
        </CardContent>
      </Card>
    );
  }

  if (isError || !forecast) return null;

  const today = forecast.days[0];
  if (!today) return null;

  const todaySeverity = getWeatherSeverity(today);

  if (compact) {
    const IconComponent = ICON_MAP[today.icon] || Cloud;
    return (
      <div className="flex items-center gap-2 text-sm">
        <IconComponent className="w-4 h-4 text-blue-400" />
        <span>{Math.round(today.tempMax)}/{Math.round(today.tempMin)}</span>
        {today.precipitation > 0 && (
          <Badge variant="outline" className="text-xs py-0">
            <Droplets className="w-3 h-3 mr-1" />
            {today.precipitation.toFixed(1)}mm
          </Badge>
        )}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">
            <div className="flex items-center gap-2">
              <Thermometer className="w-4 h-4" />
              {propertyName ? `Meteo - ${propertyName}` : 'Previsioni Meteo'}
            </div>
          </CardTitle>
          <Badge className={`text-xs ${SEVERITY_COLORS[todaySeverity]}`}>
            {todaySeverity === 'good' ? 'Bel tempo' : todaySeverity === 'moderate' ? 'Variabile' : 'Maltempo'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-3 mb-3 p-2 bg-slate-50 rounded-lg">
          {(() => {
            const TodayIcon = ICON_MAP[today.icon] || Cloud;
            return <TodayIcon className="w-10 h-10 text-blue-400" />;
          })()}
          <div>
            <div className="text-lg font-semibold">{today.description}</div>
            <div className="text-sm text-slate-500 flex items-center gap-3">
              <span>{Math.round(today.tempMax)} / {Math.round(today.tempMin)}</span>
              {today.precipitation > 0 && (
                <span className="flex items-center gap-1">
                  <Droplets className="w-3 h-3" /> {today.precipitation.toFixed(1)}mm
                </span>
              )}
              {today.windSpeed > 0 && (
                <span className="flex items-center gap-1">
                  <Wind className="w-3 h-3" /> {Math.round(today.windSpeed)} km/h
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex overflow-x-auto gap-1 pb-1">
          {forecast.days.slice(1).map((day) => (
            <DayCard key={day.date} day={day} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
