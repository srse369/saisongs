import { databaseReadService } from './DatabaseReadService.js';
import { databaseWriteService } from './DatabaseWriteService.js';

interface VisitorData {
  ipAddress: string;
  userAgent?: string;
  pagePath?: string;
  referrer?: string;
  userRole?: string;
}

interface GeolocationData {
  country?: string;
  countryCode?: string;
  region?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
}

interface AnalyticsSummary {
  totalVisits: number;
  uniqueVisitors: number;
  countries: { country: string; count: number; countryCode: string }[];
  topPages: { page: string; count: number }[];
  recentVisits: any[];
  locationMarkers: { lat: number; lon: number; city: string; country: string; visits: number }[];
}

class AnalyticsService {
  private geoCache = new Map<string, GeolocationData>();

  /**
   * Get geolocation data for an IP address using ip-api.com (free, no API key needed)
   */
  private async getGeolocation(ip: string): Promise<GeolocationData> {
    // Check cache first
    if (this.geoCache.has(ip)) {
      return this.geoCache.get(ip)!;
    }

    // Skip localhost/private IPs
    if (ip === '::1' || ip === '127.0.0.1' || ip.startsWith('192.168.') || ip.startsWith('10.')) {
      return {
        country: 'Local',
        countryCode: 'LOCAL',
        region: 'Development',
        city: 'Localhost',
        latitude: 0,
        longitude: 0
      };
    }

    try {
      // Use ip-api.com free service (no key required, 45 req/min limit)
      const response = await fetch(`http://ip-api.com/json/${ip}?fields=status,country,countryCode,region,city,lat,lon`);
      
      if (!response.ok) {
        console.warn(`[Analytics] Geolocation API error for ${ip}: ${response.status}`);
        return {};
      }

      const data = await response.json();
      
      if (data.status === 'success') {
        const geoData: GeolocationData = {
          country: data.country,
          countryCode: data.countryCode,
          region: data.region,
          city: data.city,
          latitude: data.lat,
          longitude: data.lon
        };
        
        // Cache for 24 hours
        this.geoCache.set(ip, geoData);
        return geoData;
      }
    } catch (error) {
      console.error(`[Analytics] Failed to get geolocation for ${ip}:`, error);
    }

    return {};
  }

  /**
   * Track a visitor
   */
  async trackVisitor(visitorData: VisitorData): Promise<void> {
    try {
      const geo = await this.getGeolocation(visitorData.ipAddress);

      await databaseWriteService.recordVisitorAnalytics({
        ipAddress: visitorData.ipAddress,
        country: geo.country,
        countryCode: geo.countryCode,
        region: geo.region,
        city: geo.city,
        latitude: geo.latitude,
        longitude: geo.longitude,
        userAgent: visitorData.userAgent,
        pagePath: visitorData.pagePath,
        referrer: visitorData.referrer,
        userRole: visitorData.userRole
      });
    } catch (error) {
      // Don't fail the request if analytics fails
      console.error('[Analytics] ❌ Failed to track visitor:', error);
    }
  }

  /**
   * Get analytics summary
   */
  async getAnalyticsSummary(days: number = 30): Promise<AnalyticsSummary> {
    // Get date range
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Total visits
    const totalVisits = await databaseReadService.getTotalVisitsCount(startDate);

    // Unique visitors (by IP)
    const uniqueVisitors = await databaseReadService.getUniqueVisitorsCount(startDate);

    // Top countries
    const countriesResult = await databaseReadService.getTopCountries(startDate, 10);
    const countries = countriesResult.map((row: any) => ({
      country: row.COUNTRY,
      countryCode: row.COUNTRY_CODE,
      count: Number(row.VISIT_COUNT)
    }));

    // Top pages
    const topPagesResult = await databaseReadService.getTopPages(startDate, 10);
    const topPages = topPagesResult.map((row: any) => ({
      page: row.PAGE,
      count: Number(row.VISIT_COUNT)
    }));

    // Recent visits
    const recentVisitsResult = await databaseReadService.getRecentVisits(startDate, 50);
    const recentVisits = recentVisitsResult.map((row: any) => ({
      id: row.ID,
      ipAddress: row.IP_ADDRESS,
      country: row.COUNTRY,
      city: row.CITY,
      pagePath: row.PAGE_PATH,
      userRole: row.USER_ROLE,
      timestamp: row.TIMESTAMP_UTC
    }));

    // Location markers (grouped by city)
    const locationsResult = await databaseReadService.getVisitorLocations(startDate);
    const locationMarkers = locationsResult.map((row: any) => ({
      lat: Number(row.LATITUDE),
      lon: Number(row.LONGITUDE),
      city: row.CITY,
      country: row.COUNTRY,
      visits: Number(row.VISIT_COUNT)
    }));

    return {
      totalVisits,
      uniqueVisitors,
      countries,
      topPages,
      recentVisits,
      locationMarkers
    };
  }

  /**
   * Get all location markers for map visualization
   */
  async getLocationMarkers(days: number = 30): Promise<any[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const result = await databaseReadService.getVisitorLocationsWithCountryCode(startDate);
    
    return result.map((row: any) => ({
      lat: Number(row.LATITUDE),
      lon: Number(row.LONGITUDE),
      city: row.CITY,
      country: row.COUNTRY,
      countryCode: row.COUNTRY_CODE,
      visits: Number(row.VISIT_COUNT)
    }));
  }
}

export const analyticsService = new AnalyticsService();
