const OPEN_METEO_BASE = "https://api.open-meteo.com/v1/forecast";

export interface WeatherDay {
  date: string;
  tempMax: number;
  tempMin: number;
  weatherCode: number;
  precipitation: number;
  windSpeed: number;
  description: string;
  icon: string;
}

export interface WeatherForecast {
  latitude: number;
  longitude: number;
  days: WeatherDay[];
}

const WMO_CODES: Record<number, { description: string; icon: string }> = {
  0: { description: "Sereno", icon: "sun" },
  1: { description: "Prevalentemente sereno", icon: "sun" },
  2: { description: "Parzialmente nuvoloso", icon: "cloud-sun" },
  3: { description: "Coperto", icon: "cloud" },
  45: { description: "Nebbia", icon: "cloud-fog" },
  48: { description: "Nebbia con brina", icon: "cloud-fog" },
  51: { description: "Pioviggine leggera", icon: "cloud-drizzle" },
  53: { description: "Pioviggine moderata", icon: "cloud-drizzle" },
  55: { description: "Pioviggine intensa", icon: "cloud-drizzle" },
  61: { description: "Pioggia leggera", icon: "cloud-rain" },
  63: { description: "Pioggia moderata", icon: "cloud-rain" },
  65: { description: "Pioggia intensa", icon: "cloud-rain-wind" },
  66: { description: "Pioggia gelata leggera", icon: "cloud-hail" },
  67: { description: "Pioggia gelata intensa", icon: "cloud-hail" },
  71: { description: "Neve leggera", icon: "snowflake" },
  73: { description: "Neve moderata", icon: "snowflake" },
  75: { description: "Neve intensa", icon: "snowflake" },
  77: { description: "Granuli di neve", icon: "snowflake" },
  80: { description: "Rovescio leggero", icon: "cloud-rain" },
  81: { description: "Rovescio moderato", icon: "cloud-rain" },
  82: { description: "Rovescio violento", icon: "cloud-rain-wind" },
  85: { description: "Rovescio di neve leggero", icon: "snowflake" },
  86: { description: "Rovescio di neve intenso", icon: "snowflake" },
  95: { description: "Temporale", icon: "cloud-lightning" },
  96: { description: "Temporale con grandine leggera", icon: "cloud-lightning" },
  99: { description: "Temporale con grandine forte", icon: "cloud-lightning" },
};

export async function fetchWeatherForecast(
  lat: number,
  lon: number,
  days = 7
): Promise<WeatherForecast | null> {
  try {
    const params = new URLSearchParams({
      latitude: lat.toString(),
      longitude: lon.toString(),
      daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max",
      timezone: "Europe/Rome",
      forecast_days: Math.min(days, 16).toString(),
    });

    const response = await fetch(`${OPEN_METEO_BASE}?${params}`);
    if (!response.ok) return null;

    const data = await response.json();
    const daily = data.daily;
    if (!daily) return null;

    const forecastDays: WeatherDay[] = daily.time.map(
      (date: string, i: number) => {
        const code = daily.weather_code[i] ?? 0;
        const wmo = WMO_CODES[code] || { description: "N/D", icon: "cloud" };

        return {
          date,
          tempMax: daily.temperature_2m_max[i],
          tempMin: daily.temperature_2m_min[i],
          weatherCode: code,
          precipitation: daily.precipitation_sum[i] ?? 0,
          windSpeed: daily.wind_speed_10m_max[i] ?? 0,
          description: wmo.description,
          icon: wmo.icon,
        };
      }
    );

    return {
      latitude: data.latitude,
      longitude: data.longitude,
      days: forecastDays,
    };
  } catch {
    return null;
  }
}

export function isRainyDay(day: WeatherDay): boolean {
  return day.precipitation > 2 || [61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99].includes(day.weatherCode);
}

export function getWeatherSeverity(day: WeatherDay): "good" | "moderate" | "bad" {
  if (day.precipitation > 10 || day.windSpeed > 60 || [65, 67, 75, 82, 86, 95, 96, 99].includes(day.weatherCode)) {
    return "bad";
  }
  if (day.precipitation > 2 || day.windSpeed > 30 || [51, 53, 55, 61, 63, 71, 73, 80, 81, 85].includes(day.weatherCode)) {
    return "moderate";
  }
  return "good";
}
