-- Visitor Analytics Table
-- Tracks page visits with geolocation data

CREATE TABLE visitor_analytics (
    id RAW(16) DEFAULT SYS_GUID() PRIMARY KEY,
    ip_address VARCHAR2(45) NOT NULL,
    country VARCHAR2(100),
    country_code VARCHAR2(10),
    region VARCHAR2(100),
    city VARCHAR2(100),
    latitude NUMBER(10, 6),
    longitude NUMBER(10, 6),
    user_agent VARCHAR2(500),
    page_path VARCHAR2(500),
    referrer VARCHAR2(500),
    visit_timestamp TIMESTAMP DEFAULT SYSTIMESTAMP,
    session_duration NUMBER, -- in seconds
    user_role VARCHAR2(20) -- public, viewer, editor, admin
);

-- Index for performance
CREATE INDEX idx_analytics_timestamp ON visitor_analytics(visit_timestamp DESC);
CREATE INDEX idx_analytics_country ON visitor_analytics(country);
CREATE INDEX idx_analytics_ip ON visitor_analytics(ip_address);

-- Comments
COMMENT ON TABLE visitor_analytics IS 'Stores visitor analytics data including geolocation';
COMMENT ON COLUMN visitor_analytics.ip_address IS 'Visitor IP address (anonymized for privacy)';
COMMENT ON COLUMN visitor_analytics.latitude IS 'Latitude coordinate for map visualization';
COMMENT ON COLUMN visitor_analytics.longitude IS 'Longitude coordinate for map visualization';
COMMENT ON COLUMN visitor_analytics.visit_timestamp IS 'Timestamp of visit (stored in database timezone, returned as UTC ISO string)';

