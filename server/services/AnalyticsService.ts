import { databaseService } from './DatabaseService.js';

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
      console.log(`[Analytics] 🔍 Tracking visitor: IP=${visitorData.ipAddress}, Role=${visitorData.userRole}, Path=${visitorData.pagePath}`);
      
      const geo = await this.getGeolocation(visitorData.ipAddress);
      
      console.log(`[Analytics] 📍 Geolocation: ${geo.city || 'unknown'}, ${geo.country || 'unknown'} (${geo.latitude},${geo.longitude})`);

      await databaseService.query(`
        INSERT INTO visitor_analytics (
          ip_address, country, country_code, region, city,
          latitude, longitude, user_agent, page_path,
          referrer, user_role
        ) VALUES (:1, :2, :3, :4, :5, :6, :7, :8, :9, :10, :11)
      `, [
        visitorData.ipAddress,
        geo.country || null,
        geo.countryCode || null,
        geo.region || null,
        geo.city || null,
        geo.latitude || null,
        geo.longitude || null,
        visitorData.userAgent || null,
        visitorData.pagePath || null,
        visitorData.referrer || null,
        visitorData.userRole || 'public'
      ]);
      
      console.log(`[Analytics] ✅ Visitor tracked successfully`);
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
    const totalVisitsResult = await databaseService.query(`
      SELECT COUNT(*) as total
      FROM visitor_analytics
      WHERE visit_timestamp >= :1
    `, [startDate]);
    const totalVisits = Number(totalVisitsResult[0]?.TOTAL || 0);

    // Unique visitors (by IP)
    const uniqueVisitorsResult = await databaseService.query(`
      SELECT COUNT(DISTINCT ip_address) as unique_count
      FROM visitor_analytics
      WHERE visit_timestamp >= :1
    `, [startDate]);
    const uniqueVisitors = Number(uniqueVisitorsResult[0]?.UNIQUE_COUNT || 0);

    // Top countries
    const countriesResult = await databaseService.query(`
      SELECT 
        country, 
        country_code,
        COUNT(*) as visit_count
      FROM visitor_analytics
      WHERE visit_timestamp >= :1 AND country IS NOT NULL
      GROUP BY country, country_code
      ORDER BY visit_count DESC
      FETCH FIRST 10 ROWS ONLY
    `, [startDate]);
    
    const countries = countriesResult.map((row: any) => ({
      country: row.COUNTRY,
      countryCode: row.COUNTRY_CODE,
      count: Number(row.VISIT_COUNT)
    }));

    // Top pages
    const topPagesResult = await databaseService.query(`
      SELECT 
        page_path as page,
        COUNT(*) as visit_count
      FROM visitor_analytics
      WHERE visit_timestamp >= :1 AND page_path IS NOT NULL
      GROUP BY page_path
      ORDER BY visit_count DESC
      FETCH FIRST 10 ROWS ONLY
    `, [startDate]);
    
    const topPages = topPagesResult.map((row: any) => ({
      page: row.PAGE,
      count: Number(row.VISIT_COUNT)
    }));

    // Recent visits
    const recentVisitsResult = await databaseService.query(`
      SELECT 
        RAWTOHEX(id) as id,
        ip_address,
        country,
        city,
        page_path,
        user_role,
        visit_timestamp,
        TO_CHAR(visit_timestamp AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.FF3"Z"') as timestamp_utc
      FROM visitor_analytics
      WHERE visit_timestamp >= :1
      ORDER BY visit_timestamp DESC
      FETCH FIRST 50 ROWS ONLY
    `, [startDate]);
    
    const recentVisits = recentVisitsResult.map((row: any) => ({
      id: row.ID,
      ipAddress: row.IP_ADDRESS,
      country: row.COUNTRY,
      city: row.CITY,
      pagePath: row.PAGE_PATH,
      userRole: row.USER_ROLE,
      timestamp: row.TIMESTAMP_UTC // Use UTC ISO string instead of raw timestamp
    }));

    // Location markers (grouped by city)
    const locationsResult = await databaseService.query(`
      SELECT 
        latitude,
        longitude,
        city,
        country,
        COUNT(*) as visit_count
      FROM visitor_analytics
      WHERE visit_timestamp >= :1 
        AND latitude IS NOT NULL 
        AND longitude IS NOT NULL
      GROUP BY latitude, longitude, city, country
      ORDER BY visit_count DESC
    `, [startDate]);
    
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

    const result = await databaseService.query(`
      SELECT 
        latitude,
        longitude,
        city,
        country,
        country_code,
        COUNT(*) as visit_count
      FROM visitor_analytics
      WHERE visit_timestamp >= :1 
        AND latitude IS NOT NULL 
        AND longitude IS NOT NULL
      GROUP BY latitude, longitude, city, country, country_code
      ORDER BY visit_count DESC
    `, [startDate]);
    
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

