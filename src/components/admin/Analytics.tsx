import React, { useState, useEffect } from 'react';
import { WorldMap } from './WorldMap';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { RoleBadge } from '../common/RoleBadge';
import type { UserRole } from '../../contexts/AuthContext';
import { API_BASE_URL } from '../../services/ApiClient';

interface AnalyticsSummary {
  totalVisits: number;
  uniqueVisitors: number;
  countries: { country: string; count: number; countryCode: string }[];
  topPages: { page: string; count: number }[];
  recentVisits: any[];
  locationMarkers: { lat: number; lon: number; city: string; country: string; visits: number }[];
}

export const Analytics: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [timeRange, setTimeRange] = useState(30); // days
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAnalytics();
  }, [timeRange]);

  const fetchAnalytics = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const userRole = sessionStorage.getItem('songstudio_auth_role');
      const response = await fetch(`${API_BASE_URL}/analytics/summary?days=${timeRange}`, {
        headers: userRole ? { 'X-User-Role': userRole } : {}
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch analytics');
      }
      
      const data = await response.json();
      setSummary(data);
    } catch (err) {
      console.error('Analytics fetch error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto p-6">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-800 dark:text-red-200">{error}</p>
          <button
            onClick={fetchAnalytics}
            className="mt-2 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="max-w-7xl mx-auto p-6">
        <p className="text-gray-600 dark:text-gray-400">No analytics data available</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Analytics</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Visitor statistics and global reach</p>
        </div>
        
        {/* Time range selector */}
        <select
          value={timeRange}
          onChange={(e) => setTimeRange(Number(e.target.value))}
          className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
        >
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
          <option value={365}>Last year</option>
        </select>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Visits</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">{summary.totalVisits.toLocaleString()}</p>
            </div>
            <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-full">
              <i className="fas fa-eye text-2xl text-blue-600 dark:text-blue-400"></i>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Unique Visitors</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">{summary.uniqueVisitors.toLocaleString()}</p>
            </div>
            <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-full">
              <i className="fas fa-users text-2xl text-green-600 dark:text-green-400"></i>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Countries</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">{summary.countries.length}</p>
            </div>
            <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-full">
              <i className="fas fa-globe text-2xl text-purple-600 dark:text-purple-400"></i>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Locations</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">
                {summary.locationMarkers.filter(m => m.lat !== 0 && m.lon !== 0).length}
              </p>
            </div>
            <div className="p-3 bg-orange-100 dark:bg-orange-900/30 rounded-full">
              <i className="fas fa-map-marker-alt text-2xl text-orange-600 dark:text-orange-400"></i>
            </div>
          </div>
        </div>
      </div>

      {/* World Map */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Global Reach</h2>
        <WorldMap markers={summary.locationMarkers} />
      </div>

      {/* Two columns: Top Countries and Top Pages */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Countries */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Top Countries</h2>
          <div className="space-y-3">
            {summary.countries.slice(0, 10).map((country, index) => {
              // Convert country code to flag emoji (e.g., "US" -> 🇺🇸)
              const getFlagEmoji = (countryCode: string) => {
                if (!countryCode || countryCode === 'LOCAL') return '🌍';
                return countryCode
                  .toUpperCase()
                  .split('')
                  .map(char => String.fromCodePoint(127397 + char.charCodeAt(0)))
                  .join('');
              };
              
              return (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{getFlagEmoji(country.countryCode)}</span>
                    <span className="text-gray-700 dark:text-gray-300">{country.country}</span>
                  </div>
                  <span className="font-semibold text-gray-900 dark:text-white">{country.count}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Top Pages */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Top Pages</h2>
          <div className="space-y-3">
            {summary.topPages.slice(0, 10).map((page, index) => (
              <div key={index} className="flex items-center justify-between">
                <span className="text-gray-700 dark:text-gray-300 truncate flex-1">{page.page || '/'}</span>
                <span className="font-semibold text-gray-900 dark:text-white ml-4">{page.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Visits */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Recent Visits</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-900/50">
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Time</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">IP Address</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Location</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Page</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Role</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {summary.recentVisits
                .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                .slice(0, 20)
                .map((visit, index) => (
                <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <td className="px-4 py-3 text-sm text-gray-900 dark:text-white whitespace-nowrap font-mono">
                    {new Date(visit.timestamp).toLocaleString('en-US', {
                      year: 'numeric',
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                      fractionalSecondDigits: 3,
                      hour12: false
                    })}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 font-mono whitespace-nowrap">
                    {visit.ipAddress || 'Unknown'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                    {visit.city ? `${visit.city}, ${visit.country}` : visit.country || 'Unknown'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                    {visit.pagePath || '/'}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <RoleBadge role={(visit.userRole || 'public') as UserRole} size="sm" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Analytics;

